// The guided tour in Chromium, over a stand-in for the page: which stops it keeps, the view each
// opens and the reader's view put back, where focus and keys go, a target re-rendered mid-tour,
// and axe. Opening it from the settings menu is the
// masthead's (Masthead.svelte.test.ts).
import { afterEach, beforeEach, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { expectAxeClean } from '../../lib/ui/a11y-test-support.ts';
import '../../app/layout.css';
import { firstLaunch, startGuide } from './tour.ts';

const TARGETS = `
  <header id="masthead">
    <div class="data-bar">Destrieux · Regions</div>
    <div class="masthead-end"><span class="popover-host" style="display: contents"><button>⋯</button></span></div>
  </header>
  <div role="tablist">
    <button id="workspace-tab-functions" role="tab">Functions</button>
    <button id="workspace-tab-deficits" role="tab">Deficits</button>
    <button id="workspace-tab-circuits" role="tab">Circuits</button>
    <button id="workspace-tab-diffusion" role="tab">Tracts</button>
  </div>
  <main id="viewport" style="height: 300px">
    <canvas width="300" height="200" role="application" aria-label="Brain model"></canvas>
  </main>
  <div class="orientation-gizmo"><button>S</button></div>
  <div class="stage-toolbar">
    <span class="popover-host" style="display: contents"><button>Section</button></span>
    <span class="popover-host" style="display: contents"><button>Lesion</button></span>
    <span class="popover-host" style="display: contents"><button>Coordinate</button></span>
    <span class="popover-host" style="display: contents"><button>Display</button></span>
  </div>`;

/** The reader's own view: a region open in a lateral view, on the Destrieux atlas. */
const READER = '#anatomy=cdmd&atlas=destrieux&detail=learning&region=destrieux:left:29&view=left';
const HOME = '#anatomy=cdmd&atlas=destrieux&detail=learning';

let closed = 0;
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
});
afterEach(() => {
  document.querySelector<HTMLButtonElement>('.driver-popover-close-btn')?.click();
  removeEventListener('hashchange', recordHash);
  document.getElementById('fixture')?.remove();
  history.replaceState(history.state, '', location.pathname + location.search);
  localStorage.removeItem('planum.guide');
});

const start = (lang: 'en' | 'fr' = 'en') =>
  startGuide(lang, { animate: false, onClose: () => closed++ });
const card = () => document.querySelector<HTMLElement>('.driver-popover')!;
const title = () => card().querySelector('.driver-popover-title')!.textContent;
const next = () => card().querySelector<HTMLButtonElement>('.driver-popover-next-btn')!;
const key = (target: Element, type: 'keydown' | 'keyup', name: string) => {
  const event = new KeyboardEvent(type, { key: name, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
};

const STOPS = 13;

test('thirteen stops in order, in English and French, with focus on Next', async () => {
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
    'Lesion',
    'Coordinate',
    'The medial surface',
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
  expect(card().querySelector('.driver-popover-progress-text')!.textContent).toBe('1 sur 13');
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
    `${HOME}&lesion=-35.5,-9.5,63.5,10`,
    `${HOME}&coord=-38,-22,56&space=mni152nlin2009casym`,
    `${HOME}&hemi=left&view=right`,
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

test('the first launch offers the tour once, and only to a page opened plainly', () => {
  expect(firstLaunch(HOME)).toBe(true);
  expect(firstLaunch('')).toBe(true);
  expect(firstLaunch(READER)).toBe(false);
  start();
  expect(firstLaunch(HOME)).toBe(false);
});

test('a target the layout hides is left out of the stops and the count', () => {
  document.querySelector<HTMLElement>('.orientation-gizmo')!.style.display = 'none';
  start();
  expect(card().querySelector('.driver-popover-progress-text')!.textContent).toBe('1 of 12');
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
  next().click();
  await expectAxeClean();
});
