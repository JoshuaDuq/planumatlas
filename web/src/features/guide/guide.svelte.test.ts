// The guided tour in Chromium, over a stand-in for the page: which stops it keeps, the view each
// opens and the reader's view put back, where focus and keys go, a target re-rendered mid-tour,
// and axe. Opening it from the settings menu is the
// masthead's (Masthead.svelte.test.ts).
import { afterEach, beforeEach, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { expectAxeClean } from '../../lib/ui/a11y-test-support.ts';
import '../../app/layout.css';
import { firstLaunch } from './first-launch.ts';
import { startGuide } from './tour.ts';
import type { GuidePaint } from './tour.ts';

const TARGETS = `
  <header id="masthead">
    <div class="data-bar">Destrieux · Regions</div>
    <div class="masthead-end"><span class="popover-host" style="display: contents"><button>⋯</button></span></div>
  </header>
  <aside id="workspace-panel" style="height: 120px">Region detail</aside>
  <div class="workspace-tabs" role="tablist">
    <button id="workspace-tab-functions" role="tab">Functions</button>
    <button id="workspace-tab-deficits" role="tab">Deficits</button>
    <button id="workspace-tab-circuits" role="tab">Circuits</button>
    <button id="workspace-tab-diffusion" role="tab">Tracts</button>
  </div>
  <main id="viewport" style="height: 300px">
    <canvas width="300" height="200" role="application" aria-label="Brain model"></canvas>
  </main>
  <div class="orientation-gizmo"><button>S</button></div>
  <div class="stage-dock"><div class="stage-toolbar">
    <span class="popover-host" style="display: contents"><button class="stage-tool" data-tool="section">Section</button></span>
    <span class="popover-host" style="display: contents"><button class="stage-tool" data-tool="display">Display</button></span>
    <span class="popover-host" style="display: contents"><button class="stage-tool" data-tool="place" data-offers="lesion coordinate overlay">Add</button></span>
  </div></div>`;

/** The reader's own view: a region open in a lateral view, on the Destrieux atlas. */
const READER = '#anatomy=cdmd&atlas=destrieux&detail=learning&region=destrieux:left:29&view=left';
const HOME = '#anatomy=cdmd&atlas=destrieux&detail=learning';

let closed = 0;
let closedBy: { pointer: boolean }[] = [];
let hashes: string[] = [];
const recordHash = () => hashes.push(location.hash);
beforeEach(async () => {
  await page.viewport(1280, 800);
  history.replaceState(history.state, '', READER);
  hashes = [];
  addEventListener('hashchange', recordHash);
  document.body.insertAdjacentHTML('beforeend', `<div id="fixture">${TARGETS}</div>`);
  // The app styles its own controls; the stand-ins only need to pass target-size and contrast.
  for (const button of document.querySelectorAll<HTMLElement>('#fixture button')) {
    Object.assign(button.style, { minWidth: '24px', minHeight: '24px', background: 'none' });
  }
  closed = 0;
  closedBy = [];
  mriOpens = [];
  languages = [];
  reserved = [];
});
afterEach(() => {
  document.querySelector<HTMLButtonElement>('.driver-popover-close-btn')?.click();
  removeEventListener('hashchange', recordHash);
  document.getElementById('fixture')?.remove();
  history.replaceState(history.state, '', location.pathname + location.search);
  localStorage.removeItem('planum.guide');
});

/** A stand-in for the docked Linked MRI, opened and closed as the app's would be. */
let mriOpens: string[] = [];
const dockMri = (on: string) => {
  mriOpens.push(on);
  if (document.querySelector('.mpr-dock')) return;
  document
    .getElementById('fixture')!
    .insertAdjacentHTML(
      'beforeend',
      '<section class="mpr-dock" aria-label="Linked MRI sections" style="height: 200px"></section>',
    );
};
const mri = {
  open: dockMri,
  openPaint: (paint: GuidePaint) =>
    dockMri('function' in paint ? `function:${paint.function}` : `deficit:${paint.deficit}`),
  close() {
    document.querySelector('.mpr-dock')?.remove();
  },
};
let languages: string[] = [];
let reserved: { right: number; bottom: number }[] = [];
const start = (lang: 'en' | 'fr' = 'en', short = false) =>
  startGuide(lang, {
    short,
    animate: false,
    onClose: (how) => {
      closed++;
      closedBy.push(how);
    },
    onLanguage: (next) => languages.push(next),
    mri,
    reserve: (band) => reserved.push(band),
  });
const card = () => document.querySelector<HTMLElement>('.driver-popover')!;
const title = () => card().querySelector('.driver-popover-title')!.textContent;
const next = () => card().querySelector<HTMLButtonElement>('.driver-popover-next-btn')!;
const key = (target: Element, type: 'keydown' | 'keyup', name: string) => {
  const event = new KeyboardEvent(type, { key: name, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
};

const STOPS = 16;

test('sixteen stops in order, in English and French, with focus on Next', async () => {
  start();
  const titles = [title()];
  await expect.poll(() => document.activeElement).toBe(next());
  for (let i = 1; i < STOPS; i++) {
    next().click();
    titles.push(title());
  }
  expect(titles).toEqual([
    'How to use Planum',
    'The brain',
    'Anatomical directions',
    'Section',
    'Linked MRI',
    'Lesion',
    'Coordinate',
    'Overlay',
    'The medial surface',
    'The exploded view',
    'The top bar',
    'Functions',
    'Deficits',
    'Circuits',
    'Tracts',
    'Settings',
  ]);
  expect(next().textContent).toBe('Done');
  expect(document.querySelector('.driver-active-element')).toBe(
    document.querySelector('.masthead-end button'),
  );
  next().click();
  expect(closed).toBe(1);

  start('fr');
  expect(title()).toBe('Utiliser Planum');
  expect(card().lang).toBe('fr');
  expect(card().querySelector('.driver-popover-progress-text')!.textContent).toBe('1 sur 16');
});

test('GUIDE-03 · a first visit runs six stops after the welcome; the last starts the full tour', async () => {
  start('en', true);
  const titles = [title()];
  while (next().textContent !== 'Done') {
    next().click();
    titles.push(title());
  }
  expect(titles).toEqual([
    'How to use Planum',
    'The brain',
    'A region’s detail',
    'Five ways in',
    'Functions',
    'Section',
    'Tools on the picture',
  ]);
  // The dock card says what Add brings onto the brain.
  expect(card().textContent).toMatch(/Add brings something onto the brain/);
  const everything = card().querySelector<HTMLButtonElement>('.guide-everything')!;
  expect(everything.textContent).toBe(`See everything (${STOPS} stops)`);
  // On a line under the words, so the count, Back and Done keep the footer to one line.
  const footer = card().querySelector('.driver-popover-footer')!;
  expect(footer.contains(everything)).toBe(false);
  const tops = [...footer.querySelectorAll('.driver-popover-progress-text, button')].map(
    (element) =>
      Math.round(element.getBoundingClientRect().top + element.getBoundingClientRect().height / 2),
  );
  expect(new Set(tops).size).toBe(1);
  everything.click();
  expect(title()).toBe('How to use Planum');
  expect(card().querySelector('.driver-popover-progress-text')!.textContent).toBe(`1 of ${STOPS}`);
  // Starting the full tour is no close: the reader's view comes back only when it ends.
  expect(closed).toBe(0);
  card().querySelector<HTMLButtonElement>('.driver-popover-close-btn')!.click();
  expect(closed).toBe(1);
  expect(location.hash).toBe(READER);
});

test('each stop opens its feature over the home view, and closing puts the reader’s view back', () => {
  const entries = history.length;
  const showing = () => document.documentElement.hasAttribute('data-guide-showing');
  start();
  const undimmed = [showing()];
  for (let i = 1; i < STOPS; i++) {
    next().click();
    undimmed.push(showing());
  }
  // Only the welcome, which points at nothing, dims the page.
  expect(undimmed).toEqual([false, ...Array(STOPS - 1).fill(true)]);
  expect(hashes).toEqual([
    HOME,
    `${HOME}&region=destrieux:left:29`,
    `${HOME}&view=superior`,
    `${HOME}&cut=coronal`,
    `${HOME}&cut=coronal&region=destrieux:left:29`,
    `${HOME}&lesion=-35.5,-9.5,63.5,10`,
    `${HOME}&coord=-38,44,26&space=unstated`,
    // Overlay: a reader's map is never in a link.
    HOME,
    `${HOME}&hemi=left&view=right`,
    `${HOME}&explode=1&view=anterior`,
    HOME,
    // The stop's atlas replaces the reader's, as opening a function in the app does.
    '#anatomy=cdmd&atlas=hcp-mmp&detail=learning&cuts=hcp-mmp&tab=functions&function=language',
    `${HOME}&tab=deficits&deficit=aphasia`,
    `${HOME}&tab=circuits&circuit=vision`,
    `${HOME}&tab=diffusion`,
    HOME,
  ]);
  next().click();
  expect(showing()).toBe(false);
  expect(location.hash).toBe(READER);
  expect(hashes.at(-1)).toBe(READER);
  // The stops replace the entry: Back still leaves the page the reader came from.
  expect(history.length).toBe(entries);
});

test('GUIDE-04 · the opening lobes stay through the stops, except on an atlas without lobes', () => {
  const walk = (reader: string) => {
    history.replaceState(history.state, '', reader);
    start();
    const shown = [location.hash];
    for (let i = 1; i < STOPS; i++) {
      next().click();
      shown.push(location.hash);
    }
    next().click();
    return shown;
  };
  const lobes = walk(`${HOME}&colors=lobe`);
  const functions = lobes.findIndex((hash) => hash.includes('atlas=hcp-mmp'));
  expect(lobes).toHaveLength(STOPS);
  expect(lobes[functions]).not.toContain('colors=');
  expect(lobes.filter((hash) => hash.includes('&colors=lobe'))).toHaveLength(STOPS - 1);
  expect(location.hash).toBe(`${HOME}&colors=lobe`);
  // Any other colour of the reader's gives way to the stops' own.
  expect(walk(`${HOME}&colors=tissue`).filter((hash) => hash.includes('colors='))).toEqual([]);
});

test('the exploded view stop pulls the brain apart, and moving on, going back or closing puts it back', () => {
  const exploded = () => location.hash.includes('explode=1');
  const previous = () => card().querySelector<HTMLButtonElement>('.driver-popover-prev-btn')!;
  start();
  while (title() !== 'The exploded view') next().click();
  expect(exploded()).toBe(true);
  expect(document.querySelector('.driver-active-element')).toBe(
    document.querySelector('.stage-tool[data-tool="display"]'),
  );
  next().click();
  expect(exploded()).toBe(false);
  previous().click();
  expect(exploded()).toBe(true);
  previous().click();
  expect(title()).toBe('The medial surface');
  expect(exploded()).toBe(false);
  next().click();
  key(next(), 'keydown', 'Escape');
  expect(closed).toBe(1);
  expect(location.hash).toBe(READER);
});

test('a stop that points at a control leaves the page live; the welcome alone holds it back', async () => {
  const pressed: string[] = [];
  const tab = document.getElementById('workspace-tab-functions')!;
  tab.addEventListener('click', () => pressed.push(title()));
  start();
  // driver.js draws its overlay on the stop's first frame.
  await expect.poll(() => document.querySelector('.driver-overlay path')).not.toBeNull();
  // A real pointer: the overlay over the welcome takes the press, and does not end the tour.
  await userEvent.click(tab, { force: true });
  expect(pressed).toEqual([]);
  expect(closed).toBe(0);
  next().click();
  await userEvent.click(tab);
  expect(pressed).toEqual(['The brain']);
  expect(title()).toBe('The brain');
});

test('the close says whether a pointer or the keyboard ended the tour', async () => {
  start();
  await userEvent.click(card().querySelector('.driver-popover-close-btn')!);
  start();
  next().focus();
  key(next(), 'keydown', 'Escape');
  expect(closedBy).toEqual([{ pointer: true }, { pointer: false }]);
});

test('starting the tour again ends the one under way first, so the reader’s view still comes back', () => {
  start();
  next().click();
  next().click();
  expect(location.hash).toBe(`${HOME}&view=superior`);
  start();
  expect(closed).toBe(1);
  expect(title()).toBe('How to use Planum');
  card().querySelector<HTMLButtonElement>('.driver-popover-close-btn')!.click();
  expect(location.hash).toBe(READER);
});

test('the Linked MRI stop opens the panel it points at, and leaving closes only what it opened', () => {
  const stop = (n: number) => {
    start();
    for (let i = 1; i < n; i++) next().click();
  };
  const MRI_STOP = 5;
  stop(MRI_STOP);
  expect(title()).toBe('Linked MRI');
  expect(document.querySelector('.driver-active-element')).toBe(
    document.querySelector('.mpr-dock'),
  );
  next().click();
  expect(document.querySelector('.mpr-dock')).toBeNull();
  card().querySelector<HTMLButtonElement>('.driver-popover-prev-btn')!.click();
  // On the left precentral gyrus, which the stop selects as its link does.
  expect([title(), mriOpens]).toEqual(['Linked MRI', ['destrieux:left:29', 'destrieux:left:29']]);
  card().querySelector<HTMLButtonElement>('.driver-popover-close-btn')!.click();
  expect(document.querySelector('.mpr-dock')).toBeNull();

  // A panel the reader already had open stays open.
  mri.open('destrieux:left:29');
  stop(MRI_STOP + 1);
  expect(title()).toBe('Lesion');
  expect(document.querySelector('.mpr-dock')).not.toBeNull();
});

test('the Functions and Deficits stops open the Linked MRI on their paint, closed once the tour moves on', () => {
  start();
  while (title() !== 'Functions') next().click();
  expect(mriOpens.at(-1)).toBe('function:language');
  expect(document.querySelector('.mpr-dock')).not.toBeNull();
  next().click();
  expect([title(), mriOpens.at(-1)]).toEqual(['Deficits', 'deficit:aphasia']);
  // Opened again over its own panel, it is still the tour's to close.
  next().click();
  expect(title()).toBe('Circuits');
  expect(document.querySelector('.mpr-dock')).toBeNull();
});

test.each([
  ['a stage tool’s menu', 'popover stage-popover'],
  ['the cut’s section bar', 'section-bar'],
])('%s is not covered by the card, which steps aside without its arrow', async (_, className) => {
  start();
  while (title() !== 'Lesion') next().click();
  const at = card().getBoundingClientRect();
  const arrow = () => getComputedStyle(card().querySelector('.driver-popover-arrow')!).display;
  expect(arrow()).not.toBe('none');
  // The panel opens where the card sits, as the dock's panels open over the dock stops' cards.
  document
    .getElementById('fixture')!
    .insertAdjacentHTML(
      'beforeend',
      `<div class="${className}" style="position: fixed; left: ${at.left - 100}px; top: ${at.top}px; width: 200px; height: 120px"></div>`,
    );
  const panel = document.querySelector(`.${className.split(' ').at(-1)}`)!;
  const { right } = panel.getBoundingClientRect();
  await expect
    .poll(() => card().getBoundingClientRect().left, { timeout: 2000 })
    .toBeGreaterThanOrEqual(right);
  expect(arrow()).toBe('none');
  // Gone, the card goes back to where driver.js put it, arrow and all.
  panel.remove();
  await expect.poll(() => card().getBoundingClientRect().left, { timeout: 2000 }).toBe(at.left);
  expect(arrow()).not.toBe('none');
});

test('a phone leaves the Linked MRI stop out, as its scan opens over the page', async () => {
  await page.viewport(390, 800);
  start();
  expect(card().querySelector('.driver-popover-progress-text')!.textContent).toBe('1 of 15');
  for (let i = 1; i < 15; i++) next().click();
  expect(mriOpens).toEqual([]);
});

test('the brain stop’s card sits in the stage’s dark space, in a band the anatomy is framed clear of', async () => {
  start();
  next().click();
  expect(title()).toBe('The brain');
  const stage = document.querySelector('#viewport canvas')!.getBoundingClientRect();
  await expect
    .poll(() => Math.round(card().getBoundingClientRect().right), { timeout: 2000 })
    .toBe(Math.round(stage.right - 8));
  const box = card().getBoundingClientRect();
  expect(box.left).toBeGreaterThanOrEqual(stage.left);
  expect(Math.round(box.top + box.height / 2)).toBe(Math.round(stage.top + stage.height / 2));
  expect(reserved).toEqual([
    { right: 0, bottom: 0 },
    { right: Math.round(box.width) + 16, bottom: 0 },
  ]);
  next().click();
  expect(reserved.at(-1)).toEqual({ right: 0, bottom: 0 });
  card().querySelector<HTMLButtonElement>('.driver-popover-close-btn')!.click();
  expect(reserved.at(-1)).toEqual({ right: 0, bottom: 0 });
});

test('a new card is hidden until it takes its seat, so it never shows where driver.js put it', async () => {
  start();
  next().click();
  expect(title()).toBe('The brain');
  // Rendered beside the stage by driver.js, not yet moved into it.
  expect(getComputedStyle(card()).visibility).toBe('hidden');
  const stage = document.querySelector('#viewport canvas')!.getBoundingClientRect();
  await expect.poll(() => getComputedStyle(card()).visibility).toBe('visible');
  // Shown already at its seat, with no slide from where it was rendered.
  expect(Math.round(card().getBoundingClientRect().right)).toBe(Math.round(stage.right - 8));
  expect(document.activeElement).toBe(next());
});

test('the panel tabs’ cards sit in the stage’s dark space, off the panel they open', async () => {
  // The stage lies right of the tabs, as the panel does beside it: a card driver.js puts beside a tab
  // starts over the panel.
  Object.assign(document.querySelector<HTMLElement>('#viewport canvas')!.style, {
    marginLeft: '400px',
    width: '600px',
  });
  start();
  while (title() !== 'Functions') next().click();
  const stage = document.querySelector('#viewport canvas')!.getBoundingClientRect();
  // Beside the docked MRI the card sits over the dock, inside the stage, and the anatomy above it.
  for (const stop of ['Functions', 'Deficits']) {
    expect(title()).toBe(stop);
    const dock = document.querySelector('.stage-dock')!.getBoundingClientRect();
    await expect
      .poll(() => Math.round(card().getBoundingClientRect().bottom), { timeout: 2000 })
      .toBe(Math.round(dock.top - 8));
    const box = card().getBoundingClientRect();
    expect(Math.round(box.left)).toBeGreaterThanOrEqual(Math.round(stage.left + 8));
    expect(Math.round(box.right)).toBeLessThanOrEqual(Math.round(stage.right - 8));
    await expect
      .poll(() => reserved.at(-1))
      .toEqual({ right: 0, bottom: Math.round(card().offsetHeight) + 16 });
    next().click();
  }
  for (const stop of ['Circuits', 'Tracts']) {
    expect(title()).toBe(stop);
    await expect
      .poll(() => Math.round(card().getBoundingClientRect().right), { timeout: 2000 })
      .toBe(Math.round(stage.right - 8));
    expect(reserved.at(-1)).toEqual({ right: Math.round(card().offsetWidth) + 16, bottom: 0 });
    next().click();
  }
});

test('a phone’s first cards sit above the dock, in a band the anatomy is framed clear of', async () => {
  await page.viewport(390, 800);
  // The phone's stage fills the page down to the dock.
  Object.assign(document.querySelector<HTMLElement>('#viewport')!.style, { height: '600px' });
  Object.assign(document.querySelector<HTMLElement>('#viewport canvas')!.style, {
    height: '600px',
  });
  start();
  for (const stop of ['How to use Planum', 'The brain']) {
    expect(title()).toBe(stop);
    const dock = document.querySelector('.stage-dock')!.getBoundingClientRect();
    await expect
      .poll(() => Math.round(card().getBoundingClientRect().bottom), { timeout: 2000 })
      .toBe(Math.round(dock.top - 8));
    await expect
      .poll(() => reserved.at(-1))
      .toEqual({ right: 0, bottom: Math.round(card().offsetHeight) + 16 });
    next().click();
  }
  card().querySelector<HTMLButtonElement>('.driver-popover-close-btn')!.click();
  expect(reserved.at(-1)).toEqual({ right: 0, bottom: 0 });
});

test('a phone’s panel tab cards sit under the tabs, over the raised sheet, else above the dock', async () => {
  await page.viewport(390, 800);
  Object.assign(document.querySelector<HTMLElement>('#viewport')!.style, { height: '600px' });
  start();
  while (title() !== 'Deficits') next().click();
  const tab = document.querySelector('#workspace-tab-deficits')!.getBoundingClientRect();
  await expect
    .poll(() => Math.round(card().getBoundingClientRect().top), { timeout: 2000 })
    .toBe(Math.round(tab.bottom + 8));
  expect(reserved.at(-1)).toEqual({ right: 0, bottom: 0 });
  // A lowered sheet leaves no room under its tabs.
  Object.assign(document.querySelector<HTMLElement>('[role="tablist"]')!.style, {
    position: 'fixed',
    bottom: '0',
  });
  next().click();
  expect(title()).toBe('Circuits');
  const dock = document.querySelector('.stage-dock')!.getBoundingClientRect();
  await expect
    .poll(() => Math.round(card().getBoundingClientRect().bottom), { timeout: 2000 })
    .toBe(Math.round(dock.top - 8));
});

test('the first card offers the languages; choosing one starts the tour again in it', async () => {
  history.replaceState(history.state, '', `${READER}&lang=en`);
  start();
  const choices = () => [...card().querySelectorAll<HTMLButtonElement>('.guide-languages button')];
  expect(choices().map((b) => [b.textContent, b.lang, b.getAttribute('aria-pressed')])).toEqual([
    ['English', 'en', 'true'],
    ['Français', 'fr', 'false'],
  ]);
  choices()[0]!.click();
  expect(languages).toEqual([]);
  await userEvent.click(choices()[1]!);
  expect(languages).toEqual(['fr']);
  expect([title(), card().lang, closed]).toEqual(['Utiliser Planum', 'fr', 0]);
  expect(choices().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
  // The stops show the home view in the new language, and closing keeps it.
  expect(location.hash).toBe(`${HOME}&lang=fr`);
  next().click();
  expect(card().querySelectorAll('.guide-languages')).toHaveLength(0);
  card().querySelector<HTMLButtonElement>('.driver-popover-close-btn')!.click();
  expect([location.hash, closed]).toEqual([`${READER}&lang=fr`, 1]);
});

test('the first launch offers the tour once, and only to a page opened plainly', () => {
  expect(firstLaunch(HOME)).toBe(true);
  expect(firstLaunch('')).toBe(true);
  expect(firstLaunch(READER)).toBe(false);
  // Blocked site data cannot remember the tour was seen, which would open it on every visit.
  expect(firstLaunch(HOME, null)).toBe(false);
  start();
  expect(firstLaunch(HOME)).toBe(false);
});

test('the first card offers Skip tour, by pointer or keyboard, which closes it for good', async () => {
  start();
  const skip = () => card().querySelector<HTMLButtonElement>('.guide-skip');
  expect(skip()!.textContent).toBe('Skip tour');
  await userEvent.click(skip()!);
  expect([closed, closedBy, location.hash]).toEqual([1, [{ pointer: true }], READER]);
  expect(document.querySelector('.driver-popover')).toBeNull();
  expect(firstLaunch(HOME)).toBe(false);

  start('fr');
  await expect.poll(() => document.activeElement).toBe(next());
  await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
  expect(document.activeElement).toBe(skip());
  expect(skip()!.textContent).toBe('Passer la visite');
  await userEvent.keyboard('{Enter}');
  expect([closed, closedBy[1]]).toEqual([2, { pointer: false }]);

  start();
  next().click();
  expect(skip()).toBeNull();
});

test('a target the layout hides is left out of the stops and the count', () => {
  document.querySelector<HTMLElement>('.orientation-gizmo')!.style.display = 'none';
  start();
  expect(card().querySelector('.driver-popover-progress-text')!.textContent).toBe('1 of 15');
});

test('Add without Overlay to offer, as on a phone’s stage, has no Overlay stop', () => {
  document.querySelector<HTMLElement>('.stage-tool[data-tool="place"]')!.dataset.offers =
    'lesion coordinate';
  start();
  expect(card().querySelector('.driver-popover-progress-text')!.textContent).toBe('1 of 15');
  const titles = [title()];
  for (let i = 1; i < 15; i++) {
    next().click();
    titles.push(title());
  }
  expect(titles).toContain('Coordinate');
  expect(titles).not.toContain('Overlay');
});

test('a target re-rendered after the tour starts is still the one highlighted', () => {
  start();
  const host = document.querySelector('.masthead-end .popover-host')!;
  host.replaceChildren(Object.assign(document.createElement('button'), { textContent: '⋯' }));
  for (let i = 1; i < STOPS; i++) next().click();
  expect(document.querySelector('.driver-active-element')).toBe(host.firstElementChild);
});

test('the card answers the arrows and Escape, claimed from the page keymap; elsewhere they stay the page’s', () => {
  start();
  for (const name of ['ArrowUp', 'ArrowDown']) {
    expect(key(next(), 'keydown', name).defaultPrevented, name).toBe(true);
  }
  // Enter and Space press the focused button; claiming them would stop the tour's own buttons.
  expect(key(next(), 'keydown', 'Enter').defaultPrevented).toBe(false);
  expect(key(next(), 'keydown', ' ').defaultPrevented).toBe(false);
  expect(key(next(), 'keydown', 'ArrowLeft').defaultPrevented).toBe(true);
  expect(title()).toBe('How to use Planum');
  expect(key(next(), 'keydown', 'ArrowRight').defaultPrevented).toBe(true);
  expect(title()).toBe('The brain');
  // Escape in an open menu, or on the brain, is the page's: the tour stays.
  const elsewhere = document.querySelector('.orientation-gizmo button')!;
  expect(key(elsewhere, 'keydown', 'Escape').defaultPrevented).toBe(false);
  key(elsewhere, 'keyup', 'Escape');
  expect(title()).toBe('The brain');
  expect(key(next(), 'keydown', 'ArrowLeft').defaultPrevented).toBe(true);
  expect(title()).toBe('How to use Planum');
  expect(key(next(), 'keydown', 'Escape').defaultPrevented).toBe(true);
  expect(closed).toBe(1);
  expect(document.querySelector('.driver-popover')).toBeNull();
  expect(location.hash).toBe(READER);
});

test('axe: light and dark, desktop and 390 px', async () => {
  start();
  // The first card, with its languages and Skip tour, then a stop that points at a control.
  await expectAxeClean();
  next().click();
  await expectAxeClean();
});
