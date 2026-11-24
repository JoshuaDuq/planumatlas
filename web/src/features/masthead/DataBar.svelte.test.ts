// The data bar against the APG Disclosure table and the legacy header.js cases
// (chrome.contract.test.js:167-200, 249-273, header.test.js), as behaviour in a real browser.
import { tick } from 'svelte';
import { afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { loadTemplateCopy } from '../../lib/core/i18n/index.ts';
import { cdp, page, userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import type { ManifestAnatomy } from '../../lib/types/index.ts';
import axe from 'axe-core';
import type { ComponentProps } from 'svelte';
import { withMedia } from '../../lib/ui/a11y-test-support.ts';
import { loadLists } from './data-lists.svelte.ts';
import Fixture from './data-bar-test-support.svelte';

type Bar = ComponentProps<typeof Fixture>['bar'];
const WIDE = [1600, 900] as const;
const PHONE = [390, 844] as const;

const anatomy = (id: string, individual = true): ManifestAnatomy => ({
  id,
  subject: id,
  display_name: `CDMD “${id}”`,
  label: id,
  individual,
});
const subjects = [anatomy('sub_013'), anatomy('sub_014')];

function barProps(overrides: Record<string, unknown> = {}) {
  const props: Bar = {
    lang: 'en' as const,
    status: 'ready' as const,
    progress: null,
    atlas: 'destrieux',
    surfaceColor: 'tissue' as const,
    detail: 'learning',
    paint: null,
    atlases: ['destrieux', 'hcp-mmp', 'aseg'],
    detailLevels: ['learning', 'nextbrain'],
    colourings: {
      networks: {
        networks: ['Vis', 'Default'],
        colors: { Vis: [120, 18, 134], Default: [205, 62, 78] },
      },
      cabNp: { atlas: 'hcp-mmp', networks: ['Visual1'], colors: { Visual1: [0, 0, 255] } },
    } as never,
    anatomy: subjects[0],
    anatomies: subjects,
    reference: null,
    borrowed: null,
    ...overrides,
  };
  return props;
}

const el = (locator: { element(): Element }) => locator.element() as HTMLElement;
const list = (name: string) => page.getByRole('toolbar', { name, exact: true });
const options = (name: string) => [...el(list(name)).querySelectorAll<HTMLButtonElement>('button')];
const nameOf = (button: HTMLElement) => button.querySelector('.data-option-name')!.textContent;
const asideOf = (button: HTMLElement) =>
  button.querySelector('.data-option-aside')?.textContent ?? null;
const names = (name: string) => options(name).map(nameOf);
const asides = (name: string) => options(name).map(asideOf);
const option = (name: string, text: string) =>
  options(name).find((button) => nameOf(button) === text)!;
const pressed = (name: string) =>
  options(name).filter((button) => button.getAttribute('aria-pressed') === 'true');
// The pressed option as the summary reads it: its name, then how far it has loaded.
const chosen = (name: string) => {
  const [button] = pressed(name);
  return [nameOf(button), asideOf(button)].filter(Boolean).join(' · ');
};
// What an option says under its name: its description.
const noteOf = (button: HTMLElement) =>
  button.hasAttribute('aria-describedby')
    ? document.getElementById(button.getAttribute('aria-describedby')!)!.textContent
    : null;
const note = (name: string) => noteOf(pressed(name)[0])!;
const notes = (name: string) => options(name).map(noteOf);
// Named for what it draws first: the subject's kind (FR « Sujet »), or the atlas where that is unknown.
const summary = () => page.getByRole('button', { name: /^(Subject|Sujet|Atlas) / });
const more = () => page.getByRole('button', { name: 'More settings', exact: true });
const bar = () => document.querySelector<HTMLElement>('.data-bar')!;
const announced = () => document.getElementById('announcer')!.textContent;
const commands = (calls: string[]) => calls.filter((call) => call !== 'atlas-intent');
// axe in both themes at desktop and phone width, once the measured collapse has caught up with each size.
async function withTouch(check: () => Promise<void>) {
  const session = cdp();
  await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  try {
    await check();
  } finally {
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: false });
  }
}

async function expectAxeClean(
  sizes: (readonly [number, number])[] = [WIDE, PHONE],
  themes: string[] = ['light', 'dark'],
) {
  const still = document.head.appendChild(document.createElement('style'));
  still.textContent = '*, *::before, *::after { transition: none !important; }';
  try {
    for (const theme of themes) {
      document.documentElement.dataset.theme = theme;
      for (const [width, height] of sizes) {
        // A new size reaches the frame in a later rendering step, which a loaded machine can hold
        // past a poll's one second: wait for the resize itself, then for the bar to refit.
        if (innerWidth !== width || innerHeight !== height) {
          const resized = new Promise((resolve) =>
            addEventListener('resize', resolve, { once: true }),
          );
          await page.viewport(width, height);
          await resized;
        }
        // The summary refits in the frame after its size changes.
        await settle();
        const results = await axe.run(document.body, {
          runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
          rules: { region: { enabled: false } },
        });
        expect(
          results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' ')}`),
          `${theme} ${width}px`,
        ).toEqual([]);
      }
    }
  } finally {
    still.remove();
    delete document.documentElement.dataset.theme;
    await page.viewport(...WIDE);
  }
}
const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
// Svelte has applied the change and the bar's size observer has seen the layout it left: the
// observer reports in the frame after a change, so two frames cover a refit it triggers.
const settle = async () => {
  await tick();
  await frame();
  await frame();
};

/** A wide window, with the summary's popover open on its fields; `fields: false` leaves it closed. */
async function wide(
  props = barProps(),
  { fields = true, ...extra }: Record<string, unknown> & { fields?: boolean } = {},
) {
  await page.viewport(...WIDE);
  const view = await render(Fixture, { bar: props, ...extra });
  await settle();
  if (fields && !props.reference) {
    el(summary()).click();
    // Opening waits for the lists' chunk.
    await expect.poll(() => el(summary()).getAttribute('aria-expanded')).toBe('true');
    await settle();
  }
  return view;
}
async function phone(props = barProps(), extra: Record<string, unknown> = {}) {
  await page.viewport(...PHONE);
  const view = await render(Fixture, { bar: props, ...extra });
  await settle();
  return view;
}

// The lists are a chunk the bar fetches on the first intent; fetched once here, a press opens them at once.
beforeAll(() => loadLists());
beforeEach(() => page.viewport(...WIDE));
afterEach(() => {
  cleanup();
});

describe('DataBar lists', () => {
  test('four named lists, the chosen option described by its note; subject is offered only with a choice', async () => {
    await wide();
    for (const name of ['Subject', 'Atlas', 'Colour', 'Internal anatomy']) {
      expect(note(name).length, name).toBeGreaterThan(0);
      expect(el(list(name)).getAttribute('aria-orientation'), name).toBe('vertical');
    }
    expect(note('Atlas')).toBe('Sulcal and gyral regions, 74 per hemisphere');
    expect(names('Subject')).toEqual(['CDMD sub_013', 'CDMD sub_014']);
  });

  test('every atlas and level says what it is, the chosen one in full; an option is named by its name alone', async () => {
    const view = await wide(barProps({ atlas: 'hcp-mmp' }));
    expect(notes('Atlas')).toEqual([
      'Sulcal and gyral regions, 74 per hemisphere',
      'Multimodal areas, 180 per hemisphere (Glasser 2016)',
      'FreeSurfer’s standard subcortical segmentation',
    ]);
    expect(notes('Internal anatomy')).toEqual([
      'Overview structures grouped from NextBrain and aseg labels, with CerebNet cerebellar lobules where published',
      'Histology-based atlas at 0.4\u202fmm',
    ]);
    // Colours and subjects are described only when chosen.
    expect(notes('Colour').filter(Boolean)).toEqual(['Tissue colours, shaded by T1 brightness']);
    expect(notes('Subject')).toEqual(['One individual’s MRI reconstruction', null]);
    await expect
      .element(list('Atlas').getByRole('button', { name: 'HCP-MMP', exact: true }))
      .toHaveAccessibleDescription('Multimodal areas, 180 per hemisphere (Glasser 2016)');
    await view.rerender({ bar: barProps({ atlas: 'destrieux', lang: 'fr' }) });
    expect(notes('Atlas').slice(0, 2)).toEqual([
      'Régions des sillons et des gyrus, 74 par hémisphère',
      'Aires multimodales, 180 par hémisphère',
    ]);
  });

  test('the subject note says what the brain on screen is: one person, or the MNI average', async () => {
    await wide();
    expect(note('Subject')).toBe('One individual’s MRI reconstruction');
    cleanup();
    await loadTemplateCopy();
    const template = anatomy('mni152', false);
    await wide(barProps({ anatomy: template, anatomies: [subjects[0], template] }));
    expect(note('Subject')).toBe(
      'An average of 152 young adults at mean adult size, with an averaged atlas’s tracts and no spinal cord',
    );
  });

  test('one subject and one detail level offer no list at all', async () => {
    await wide(barProps({ anatomies: [subjects[0]], detailLevels: ['learning'] }));
    expect(page.getByRole('toolbar', { name: 'Subject' }).elements()).toHaveLength(0);
    expect(page.getByRole('toolbar', { name: 'Internal anatomy' }).elements()).toHaveLength(0);
    // One published subject is not a choice: the colophon names it (legacy hides the whole field).
    expect(bar().querySelector('.study-name')).toBeNull();
    const captions = [...bar().querySelectorAll('.masthead-data .data-label')];
    expect(captions.map((caption) => caption.textContent)).toEqual(['Atlas', 'Colour']);
  });

  test('every option is listed, colours in named groups, each saying what else it changes', async () => {
    const view = await wide();
    expect(names('Atlas')).toEqual(['Destrieux', 'HCP-MMP', 'FreeSurfer aseg']);
    // No paint option while no tab paints: assistive technology lists only real choices.
    expect(names('Colour')).toEqual([
      'Tissue',
      'T1 MRI',
      'Lobes',
      'Regions',
      'Yeo 7 networks',
      'CAB-NP networks',
    ]);
    expect(asides('Colour')).toEqual([null, null, null, null, null, 'Atlas becomes HCP-MMP']);
    expect(
      [...el(list('Colour')).querySelectorAll('[role=group]')].map(
        (group) => document.getElementById(group.getAttribute('aria-labelledby')!)?.textContent,
      ),
    ).toEqual(['Appearance', 'Parcellation', 'Networks']);
    // Colour defined on HCP-MMP areas: the option for another atlas names the colour it drops.
    await view.rerender({ bar: barProps({ atlas: 'hcp-mmp', surfaceColor: 'cab-np' }) });
    expect(asides('Atlas')).toEqual(['Colour becomes Regions', null, 'Colour becomes Regions']);
    expect(asides('Colour')[0]).toBeNull();
  });

  test('a colouring with colours of its own draws them beside its name, unannounced', async () => {
    await wide();
    const strip = (name: string) =>
      [...(option('Colour', name).querySelector('.data-option-palette')?.children ?? [])].map(
        (segment) => getComputedStyle(segment).backgroundColor,
      );
    expect(strip('Yeo 7 networks')).toEqual(['rgb(120, 18, 134)', 'rgb(205, 62, 78)']);
    expect(strip('CAB-NP networks')).toEqual(['rgb(0, 0, 255)']);
    expect(strip('Lobes')).toHaveLength(9);
    for (const name of ['Tissue', 'T1 MRI', 'Regions']) expect(strip(name), name).toEqual([]);
    const yeo = option('Colour', 'Yeo 7 networks');
    expect(yeo.querySelector('.data-option-palette')!.getAttribute('aria-hidden')).toBe('true');
    await expect
      .element(list('Colour').getByRole('button', { name: 'Yeo 7 networks', exact: true }))
      .toBeInTheDocument();
  });

  test('the chosen option alone is pressed and marked by a check, not by colour alone (WCAG 1.4.1)', async () => {
    await wide();
    for (const name of ['Subject', 'Atlas', 'Colour', 'Internal anatomy']) {
      expect(pressed(name), name).toHaveLength(1);
      for (const button of options(name)) {
        const marked = button.getAttribute('aria-pressed') === 'true';
        expect(button.querySelector('.data-option-check svg') !== null, nameOf(button)).toBe(
          marked,
        );
      }
    }
    expect(chosen('Atlas')).toBe('Destrieux');
    expect(chosen('Colour')).toBe('Tissue');
  });

  test('a choice downloading stays pressed with its progress, and reverts if it does not land', async () => {
    const bar = $state(barProps());
    let land!: () => void;
    await wide(bar, {
      onCommand: () => {
        bar.status = 'switching';
        return new Promise<void>((resolve) => (land = resolve));
      },
    });
    await userEvent.click(option('Atlas', 'HCP-MMP'));
    await expect.poll(() => chosen('Atlas')).toBe('HCP-MMP · Loading…');
    bar.progress = { loaded: 34, total: 100 };
    await expect.poll(() => chosen('Atlas')).toMatch(/^HCP-MMP · Loading 34/);
    bar.status = 'ready';
    land();
    await expect.poll(() => chosen('Atlas')).toBe('Destrieux');
  });

  test('a choice stays pressed before its download has begun', async () => {
    // The app turns to switching only once a download starts, a moment after the press.
    const bar = $state(barProps());
    let land!: () => void;
    await wide(bar, { onCommand: () => new Promise<void>((resolve) => (land = resolve)) });
    await userEvent.click(option('Atlas', 'HCP-MMP'));
    await settle();
    expect(chosen('Atlas')).toBe('HCP-MMP · Loading…');
    bar.status = 'switching';
    await settle();
    expect(chosen('Atlas')).toBe('HCP-MMP · Loading…');
    Object.assign(bar, { status: 'ready', atlas: 'hcp-mmp' });
    land();
    await expect.poll(() => chosen('Atlas')).toBe('HCP-MMP');
  });

  test('a choice that lands during another download shows its name, the other its progress', async () => {
    const bar = $state(barProps());
    await wide(bar, {
      onCommand: () => {
        bar.status = 'switching';
        return new Promise(() => {});
      },
    });
    await userEvent.click(option('Atlas', 'HCP-MMP'));
    await userEvent.click(option('Internal anatomy', 'NextBrain'));
    await expect.poll(() => chosen('Internal anatomy')).toMatch(/ · Loading…$/);
    bar.atlas = 'hcp-mmp';
    await expect.poll(() => chosen('Atlas')).toBe('HCP-MMP');
    expect(chosen('Internal anatomy')).toMatch(/ · Loading…$/);
  });

  test('each list calls its command and the popover stays open; the pressed option calls nothing', async () => {
    const calls: string[] = [];
    await wide(barProps(), { calls });
    await userEvent.click(option('Atlas', 'Destrieux'));
    await userEvent.click(option('Atlas', 'FreeSurfer aseg'));
    await userEvent.click(option('Colour', 'T1 MRI'));
    await userEvent.click(option('Internal anatomy', 'NextBrain'));
    await userEvent.click(option('Subject', 'CDMD sub_014'));
    expect(commands(calls)).toEqual([
      'atlas:aseg',
      'colour:mri',
      'detail:nextbrain',
      'anatomy:sub_014',
    ]);
    expect(el(summary()).getAttribute('aria-expanded')).toBe('true');
  });

  test('arrows move between options without choosing; Enter chooses (decision 0003)', async () => {
    const calls: string[] = [];
    await wide(barProps(), { calls });
    option('Atlas', 'Destrieux').focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(option('Atlas', 'HCP-MMP'));
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(option('Atlas', 'FreeSurfer aseg'));
    expect(commands(calls)).toEqual([]);
    await userEvent.keyboard('{Enter}');
    expect(commands(calls)).toEqual(['atlas:aseg']);
    // Across the colour groups, as one list.
    option('Colour', 'T1 MRI').focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(option('Colour', 'Lobes'));
  });

  test('pointing at or focusing an Atlas option is an intent to switch atlas; other lists are not', async () => {
    const calls: string[] = [];
    await wide(barProps(), { calls });
    calls.length = 0;
    await userEvent.hover(option('Colour', 'T1 MRI'));
    option('Colour', 'T1 MRI').focus();
    expect(calls).toEqual([]);
    await userEvent.hover(option('Atlas', 'HCP-MMP'));
    expect(calls).toEqual(['atlas-intent']);
    option('Atlas', 'HCP-MMP').focus();
    expect(calls).toEqual(['atlas-intent', 'atlas-intent']);
  });

  test('a tab painting the brain is the pressed Colour option while it paints', async () => {
    const paint = { id: 'function:memory', colors: new Map() };
    const view = await wide(barProps());
    // The option is added when a tab starts painting and leaves when it stops.
    await view.rerender({ bar: barProps({ paint }) });
    expect(chosen('Colour')).toBe('Functions');
    expect(names('Colour')[0]).toBe('Functions');
    expect(note('Colour')).toMatch(/^Set by the Functions tab/);
    await view.rerender({ bar: barProps() });
    expect(chosen('Colour')).toBe('Tissue');
    expect(names('Colour')).not.toContain('Functions');
  });

  test('STAGE-74 · a paint a region’s sheet asks for names itself in the Colour list, its note and the summary', async () => {
    const view = await wide(barProps());
    for (const [id, name, set] of [
      ['layers:hcp-mmp', 'Layer IV', /^Set by a region’s sheet: layer IV’s share/],
      ['disorder:scz', 'Disorder', /^Set by a region’s sheet: one disorder’s/],
      ['connectivity:julich:left:1', 'Connectivity', /^Set by a region’s sheet: the outlined/],
    ] as const) {
      await view.rerender({ bar: barProps({ paint: { id, colors: new Map() } }) });
      expect(chosen('Colour')).toBe(name);
      expect(note('Colour')).toMatch(set);
      expect(el(summary()).getAttribute('aria-label')).toContain(`Colour ${name},`);
    }
    await view.rerender({
      bar: barProps({ lang: 'fr', paint: { id: 'layers:hcp-mmp', colors: new Map() } }),
    });
    expect(chosen('Couleur')).toBe('Couche IV');
  });

  test('an atlas a function set names the tab beside it, and its note the atlas that comes back', async () => {
    const view = await wide(barProps({ atlas: 'hcp-mmp' }));
    expect(chosen('Atlas')).toBe('HCP-MMP');
    expect(note('Atlas')).toMatch(/^Multimodal areas/);

    await view.rerender({
      bar: barProps({ atlas: 'hcp-mmp', borrowed: { own: 'destrieux', by: 'functions' } }),
    });
    expect(chosen('Atlas')).toBe('HCP-MMP · via Functions');
    expect(note('Atlas')).toBe(
      'Set by the Functions tab: its maps lie on HCP-MMP areas. Leaving the function brings back Destrieux.',
    );
    // The note is printed under its list, so the list carries no tooltip saying it twice.
    expect(el(list('Atlas')).hasAttribute('data-tooltip')).toBe(false);
  });

  test('another subject waits while switching, and focus stays where it was', async () => {
    const calls: string[] = [];
    const props = $state(barProps());
    await wide(props, { calls });
    option('Subject', 'CDMD sub_014').focus();
    props.status = 'switching';
    await expect
      .poll(() => option('Subject', 'CDMD sub_014').getAttribute('aria-disabled'))
      .toBe('true');
    expect(document.activeElement).toBe(option('Subject', 'CDMD sub_014'));
    await userEvent.keyboard('{Enter}');
    expect(commands(calls)).toEqual([]);
    expect(option('Atlas', 'HCP-MMP').hasAttribute('aria-disabled')).toBe(false);
  });

  test('French strings and names', async () => {
    await wide(barProps({ lang: 'fr' }));
    for (const name of ['Sujet', 'Atlas', 'Couleur', 'Anatomie interne']) {
      expect(options(name).length, name).toBeGreaterThan(0);
    }
    expect(
      [...el(list('Couleur')).querySelectorAll('[role=group]')].map(
        (group) => document.getElementById(group.getAttribute('aria-labelledby')!)?.textContent,
      ),
    ).toEqual(['Apparence', 'Parcellisation', 'Réseaux']);
    expect(asides('Couleur').at(-1)).toBe('L’atlas devient HCP-MMP');
  });

  test('every option is a 24 px target at least (WCAG 2.5.8)', async () => {
    await wide();
    for (const button of bar().querySelectorAll('.data-option')) {
      const box = button.getBoundingClientRect();
      expect(box.height).toBeGreaterThanOrEqual(24);
      expect(box.width).toBeGreaterThanOrEqual(24);
    }
  });
});

describe('DataBar summary and popover', () => {
  test('the summary reads caption and value, and its name starts with those words (WCAG 2.5.3)', async () => {
    await wide(barProps(), { fields: false });
    const toggle = el(summary());
    expect(toggle.getAttribute('aria-label')).toBe(
      'Subject Individual, Atlas Destrieux, Colour Tissue, Internal anatomy Teaching set',
    );
    expect(toggle.innerText.split(/\s+/).join(' ')).toBe(
      'Subject Individual Atlas Destrieux Colour Tissue',
    );
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBe(bar().querySelector('.masthead-data')!.id);
    expect(toggle.dataset.tooltip).toBe('Atlas and display settings');
  });

  test('the subject says whether the brain is one person’s or the template, in both languages', async () => {
    await loadTemplateCopy();
    const template = anatomy('mni152', false);
    const view = await wide(barProps({ anatomy: template }), { fields: false });
    const drawn = () => el(summary()).innerText.split(/\s+/).slice(0, 2).join(' ');
    expect(drawn()).toBe('Subject Template');
    await view.rerender({ bar: barProps({ anatomy: template, lang: 'fr' }) });
    expect(drawn()).toBe('Sujet Modèle');
    await view.rerender({ bar: barProps({ lang: 'fr' }) });
    expect(drawn()).toBe('Sujet Individuel');
  });

  test('pointing at or focusing the summary is an intent to switch atlas', async () => {
    const calls: string[] = [];
    await phone(barProps(), { calls });
    await userEvent.hover(summary());
    expect(calls).toEqual(['atlas-intent']);
    el(summary()).focus();
    expect(calls).toEqual(['atlas-intent', 'atlas-intent']);
  });

  test('the popover opens on the summary, keeps focus there, and prints the notes', async () => {
    await phone();
    expect(page.getByRole('toolbar', { name: 'Atlas' }).elements()).toHaveLength(0);
    await summary().click();
    await expect.element(list('Atlas')).toBeVisible();
    expect(el(summary()).getAttribute('aria-expanded')).toBe('true');
    expect(
      pressed('Atlas')[0].querySelector<HTMLElement>('.data-option-note')!.checkVisibility(),
      'notes are printed',
    ).toBe(true);
    expect(
      Math.abs(
        bar().querySelector('.masthead-data')!.getBoundingClientRect().right -
          (window.innerWidth - 12),
      ),
    ).toBeLessThan(2);
  });

  test('Tab leaves the summary into the lists in order, one stop each, then onward; leaving closes it', async () => {
    await phone();
    el(summary()).focus();
    await userEvent.keyboard('{Enter}');
    await expect.element(list('Subject')).toBeVisible();
    expect(document.activeElement).toBe(el(summary()));
    for (const [name, stop] of [
      ['Atlas', 'Destrieux'],
      ['Colour', 'Tissue'],
      ['Internal anatomy', 'Teaching set'],
      ['Subject', 'CDMD sub_013'],
    ]) {
      await userEvent.keyboard('{Tab}');
      expect(document.activeElement, name).toBe(option(name, stop));
    }
    // Full screen is not offered on a phone: the next stop is Save image.
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(el(page.getByRole('button', { name: 'Save image (PNG)' })));
    expect(el(summary()).getAttribute('aria-expanded')).toBe('false');
  });

  test('on a phone the colour follows the atlas, as it is read', async () => {
    await phone();
    await summary().click();
    const top = (name: string) => el(list(name)).getBoundingClientRect().top;
    expect(top('Atlas')).toBeLessThan(top('Colour'));
    expect(top('Colour')).toBeLessThan(top('Internal anatomy'));
    expect(top('Internal anatomy')).toBeLessThan(top('Subject'));
  });

  test('MAST-45 · on a wide window the lists stand two by two, each row ruled straight across', async () => {
    await wide();
    const field = (name: string) =>
      el(list(name)).closest<HTMLElement>('.data-field')!.getBoundingClientRect();
    expect(field('Colour').left).toBeGreaterThanOrEqual(field('Atlas').right);
    expect(field('Colour').top).toBe(field('Atlas').top);
    expect(field('Internal anatomy').left).toBe(field('Atlas').left);
    expect(field('Subject').left).toBe(field('Colour').left);
    expect(field('Subject').top).toBe(field('Internal anatomy').top);
    expect(field('Subject').top).toBeGreaterThanOrEqual(
      Math.max(field('Atlas').bottom, field('Colour').bottom),
    );
    const popover = bar().querySelector('.masthead-data')!.getBoundingClientRect();
    expect(popover.right).toBeLessThanOrEqual(window.innerWidth);
  });

  test("MAST-45 · with one subject the colour runs the popover's height beside the other two", async () => {
    await wide(barProps({ anatomies: [subjects[0]] }));
    const field = (name: string) =>
      el(list(name)).closest<HTMLElement>('.data-field')!.getBoundingClientRect();
    expect(field('Colour').top).toBe(field('Atlas').top);
    expect(field('Colour').bottom).toBe(field('Internal anatomy').bottom);
  });

  test('the open popover reports its right edge for the stage, and nothing once closed', async () => {
    const panels: [number | null, boolean][] = [];
    await wide(barProps(), { panels, fields: false });
    expect(panels).toEqual([]);
    await summary().click();
    const popover = bar().querySelector<HTMLElement>('.masthead-data')!;
    await expect.poll(() => panels.length).toBeGreaterThan(0);
    const [right, immediate] = panels.at(-1)!;
    // The laid-out edge, measured before the entry scale has settled: where the popover ends once it has.
    await Promise.all(popover.getAnimations().map((animation) => animation.finished));
    expect(Math.abs(right! - popover.getBoundingClientRect().right)).toBeLessThan(1);
    expect(immediate).toBe(false);
    el(summary()).focus();
    await userEvent.keyboard('{Escape}');
    expect(panels.at(-1)).toEqual([null, true]);
    await summary().click();
    await expect.poll(() => panels.at(-1)![0]).not.toBeNull();
    await page.getByRole('button', { name: 'Canvas' }).click();
    expect(panels.at(-1)).toEqual([null, false]);
  });

  test('Escape closes, returns focus to the summary and is marked handled', async () => {
    await phone();
    await summary().click();
    option('Colour', 'Tissue').focus();
    let prevented = false;
    document.addEventListener('keydown', (event) => (prevented = event.defaultPrevented), {
      once: true,
    });
    await userEvent.keyboard('{Escape}');
    expect(prevented).toBe(true);
    expect(el(summary()).getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(el(summary()));
  });

  test('a press outside closes it without moving focus', async () => {
    await phone();
    await summary().click();
    // The popover covers the canvas on a phone: press on a masthead control beside it.
    const save = page.getByRole('button', { name: 'Save image (PNG)' });
    await save.click();
    expect(el(summary()).getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(el(save));
  });

  test('the data popover and the settings panel are never open together', async () => {
    await phone();
    await summary().click();
    await more().click();
    expect(el(summary()).getAttribute('aria-expanded')).toBe('false');
    expect(el(more()).getAttribute('aria-expanded')).toBe('true');
    await summary().click();
    expect(el(summary()).getAttribute('aria-expanded')).toBe('true');
    expect(el(more()).getAttribute('aria-expanded')).toBe('false');
  });

  test('a keyboard open is instant; a pointer open animates', async () => {
    await phone();
    el(summary()).focus();
    await userEvent.keyboard('{Enter}');
    expect(bar().querySelector('.masthead-data')!.hasAttribute('data-instant')).toBe(true);
    await userEvent.keyboard('{Enter}');
    await summary().click();
    expect(bar().querySelector('.masthead-data')!.hasAttribute('data-instant')).toBe(false);
  });

  test('reduced motion keeps the opacity transition and drops the chevron turn', async () => {
    await phone();
    await withMedia([{ name: 'prefers-reduced-motion', value: 'reduce' }], async () => {
      await summary().click();
      expect(getComputedStyle(bar().querySelector('.masthead-data')!).transitionProperty).toBe(
        'opacity',
      );
      expect(getComputedStyle(el(summary()), '::after').transitionDuration).toBe('0s');
    });
  });

  test('a window narrowed to a phone’s keeps the open popover and the focus in it', async () => {
    await wide();
    option('Atlas', 'HCP-MMP').focus();
    await page.viewport(...PHONE);
    await settle();
    expect(el(summary()).getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(option('Atlas', 'HCP-MMP'));
  });

  test('on a wide window the summary shows the subject, the atlas and the colour; the rest is in its name', async () => {
    await wide(barProps(), { fields: false });
    const node = bar().querySelector<HTMLElement>('.data-summary')!;
    expect(node.dataset.short).toBeUndefined();
    expect(
      [...node.querySelectorAll<HTMLElement>('.data-summary-part')].map((part) => [
        part.dataset.part,
        part.checkVisibility(),
      ]),
    ).toEqual([
      ['subject', true],
      ['atlas', true],
      ['colour', true],
    ]);
    expect(el(summary()).getAttribute('aria-label')).toContain('Teaching set');
  });

  test('where the atlas would be cut short, the first arrangement that keeps it whole is drawn', async () => {
    const node = () => bar().querySelector<HTMLElement>('.data-summary')!;
    const visible = () =>
      [...node().querySelectorAll<HTMLElement>('.data-summary-part')]
        .filter((part) => getComputedStyle(part).display !== 'none')
        .map((part) => part.dataset.part);
    const whole = () => {
      const atlas = node().querySelector<HTMLElement>('[data-part=atlas] .data-summary-value')!;
      return atlas.scrollWidth <= atlas.clientWidth;
    };
    // A phone has room for the atlas and the colour: the subject yields, and is in the popover.
    await phone();
    expect(visible()).toEqual(['atlas', 'colour']);
    expect(whole()).toBe(true);
    cleanup();
    // Narrower still, the atlas stands alone; the name keeps every part.
    await page.viewport(300, 800);
    await render(Fixture, { bar: barProps() });
    await settle();
    expect(node().dataset.short).toBe('colour subject');
    expect(visible()).toEqual(['atlas']);
    expect(whole()).toBe(true);
    expect(el(summary()).getAttribute('aria-label')).toMatch(
      /^Subject Individual, .*Colour Tissue/,
    );
  });

  test('landscape ≤ 480 px tall lays the popover out in two columns', async () => {
    await page.viewport(844, 390);
    await render(Fixture, { bar: barProps() });
    await settle();
    await summary().click();
    const columns = getComputedStyle(bar().querySelector('.masthead-data')!).gridTemplateColumns;
    expect(columns.split(' ')).toHaveLength(2);
  });

  test('the lists fit at 320 px with spaced, enlarged text (WCAG 1.4.10, 1.4.12)', async () => {
    await page.viewport(320, 640);
    await render(Fixture, { bar: barProps() });
    document.documentElement.style.fontSize = '200%';
    const spacing = document.head.appendChild(document.createElement('style'));
    spacing.textContent =
      '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }';
    try {
      await settle();
      await summary().click();
      const popover = bar().querySelector<HTMLElement>('.masthead-data')!;
      const box = popover.getBoundingClientRect();
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(window.innerWidth);
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
      for (const button of popover.querySelectorAll('.data-option')) {
        expect(button.scrollWidth).toBeLessThanOrEqual(button.clientWidth);
      }
    } finally {
      spacing.remove();
      document.documentElement.style.fontSize = '';
    }
  });
});

describe('DataBar touch and refit', () => {
  const box = (element: Element) => element.getBoundingClientRect();

  test('on a phone every option and the summary are 44 px targets (WCAG 2.5.8)', async () => {
    await phone();
    await summary().click();
    // offsetHeight is the layout size: the popover's scale-in does not change it.
    expect(el(summary()).offsetHeight).toBeGreaterThanOrEqual(44);
    for (const button of bar().querySelectorAll<HTMLElement>('.data-option')) {
      expect(button.offsetHeight).toBeGreaterThanOrEqual(44);
    }
  });

  test('touch options stay in the disclosure on a wide screen, 44 px, anchored under the summary', async () => {
    await withTouch(async () => {
      await wide(barProps(), { fields: false });
      expect(el(summary()).offsetHeight).toBeGreaterThanOrEqual(44);
      // As wide as its words, not the whole column.
      expect(box(el(summary())).width).toBeLessThan(500);
      await summary().click();
      for (const button of bar().querySelectorAll<HTMLElement>('.data-option')) {
        expect(button.offsetHeight).toBeGreaterThanOrEqual(44);
      }
      const popover = bar().querySelector('.masthead-data')!;
      expect(Math.abs(box(popover).left - box(el(summary())).left)).toBeLessThan(3);
      expect(parseFloat(getComputedStyle(bar()).paddingLeft)).toBeGreaterThan(0);
      await expectAxeClean([WIDE], ['light']);
    });
  });

  test('the desktop bar passes axe in French', async () => {
    await wide(barProps({ lang: 'fr' }));
    await expectAxeClean([WIDE], ['light']);
  });

  test('Space opens the summary', async () => {
    await phone();
    el(summary()).focus();
    await userEvent.keyboard(' ');
    expect(el(summary()).getAttribute('aria-expanded')).toBe('true');
  });

  test('Escape closes the popover with focus on the page, and is marked handled', async () => {
    await phone();
    await summary().click();
    bar().querySelector<HTMLElement>('.masthead-data .data-label')!.click();
    (document.activeElement as HTMLElement).blur();
    expect(document.activeElement).toBe(document.body);
    let prevented = false;
    window.addEventListener('keydown', (event) => (prevented = event.defaultPrevented), {
      once: true,
    });
    await userEvent.keyboard('{Escape}');
    expect(prevented).toBe(true);
    expect(el(summary()).getAttribute('aria-expanded')).toBe('false');
  });
});

describe('DataBar tract reference', () => {
  const reference = { label: 'Tract reference', description: 'Bundles drawn on the HCP template' };

  test('shows its name only, with its description reachable by keyboard and described', async () => {
    await wide(barProps({ reference }));
    expect(bar().hasAttribute('data-reference')).toBe(true);
    expect(page.getByRole('toolbar').elements()).toHaveLength(0);
    const name = bar().querySelector<HTMLElement>('.study-name')!;
    expect(name.textContent!.trim()).toBe('Tract reference');
    expect(name.dataset.tooltip).toBe(reference.description);
    expect(name.tabIndex).toBe(0);
    expect(document.getElementById(name.getAttribute('aria-describedby')!)!.textContent).toBe(
      reference.description,
    );
    el(page.getByRole('link', { name: 'Skip to model' })).focus();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(name);
    await expect.element(page.getByRole('tooltip')).toHaveTextContent(reference.description);
  });

  test('on a phone the summary is the name alone and there is no popover to open', async () => {
    await phone(barProps({ reference }));
    expect(bar().querySelector<HTMLElement>('.data-toggle')!.checkVisibility()).toBe(false);
    expect(page.getByRole('toolbar').elements()).toHaveLength(0);
    expect(bar().querySelector('.study-name')!.checkVisibility()).toBe(true);
  });

  test('focus stays on the name when the reference is passed again or the language changes', async () => {
    const props = $state(barProps({ reference }));
    await wide(props);
    el(page.getByRole('link', { name: 'Skip to model' })).focus();
    await userEvent.keyboard('{Tab}');
    const name = bar().querySelector<HTMLElement>('.study-name')!;
    expect(document.activeElement).toBe(name);
    props.reference = { ...reference };
    await settle();
    expect(document.activeElement).toBe(name);
    props.lang = 'fr';
    await settle();
    expect(document.activeElement).toBe(name);
  });

  test('focus inside the data bar when the reference starts moves on, not to the page', async () => {
    const props = $state(barProps());
    await wide(props);
    option('Colour', 'Tissue').focus();
    props.reference = reference;
    await settle();
    expect(document.activeElement).not.toBe(document.body);
    expect(bar().contains(document.activeElement)).toBe(false);
  });
});

describe('DataBar announcements', () => {
  const downloads = (props: Bar) => () => {
    props.status = 'switching';
    return new Promise(() => {});
  };

  test('a download started here is announced when it starts and when it lands', async () => {
    const props = $state(barProps());
    await wide(props, { onCommand: downloads(props) });
    await userEvent.click(option('Atlas', 'HCP-MMP'));
    await expect.poll(announced).toBe('HCP-MMP: Loading…');
    Object.assign(props, { status: 'ready', atlas: 'hcp-mmp' });
    await expect.poll(announced).toBe('Anatomy loaded.');
  });

  test('a download that begins after the press is announced too', async () => {
    const props = $state(barProps());
    await wide(props, { onCommand: () => new Promise(() => {}) });
    await userEvent.click(option('Atlas', 'HCP-MMP'));
    await settle();
    expect(announced()).toBe('');
    props.status = 'switching';
    await expect.poll(announced).toBe('HCP-MMP: Loading…');
    Object.assign(props, { status: 'ready', atlas: 'hcp-mmp' });
    await expect.poll(announced).toBe('Anatomy loaded.');
  });

  test('in French, with a French spacing before the colon', async () => {
    const props = $state(barProps({ lang: 'fr' }));
    await wide(props, { onCommand: downloads(props) });
    await userEvent.click(option('Atlas', 'HCP-MMP'));
    await expect.poll(announced).toBe('HCP-MMP : Chargement…');
    Object.assign(props, { status: 'ready', atlas: 'hcp-mmp' });
    await expect.poll(announced).toBe('Anatomie chargée.');
  });

  test('a download that fails says nothing more (the notice does)', async () => {
    const props = $state(barProps());
    await wide(props, { onCommand: downloads(props) });
    await userEvent.click(option('Atlas', 'HCP-MMP'));
    await expect.poll(announced).toBe('HCP-MMP: Loading…');
    Object.assign(props, { status: 'ready' });
    await settle();
    expect(announced()).toBe('HCP-MMP: Loading…');
  });

  test('a choice that needs no download says nothing, and a later download is not taken for it', async () => {
    const props = $state(barProps());
    await wide(props);
    await userEvent.click(option('Colour', 'T1 MRI'));
    await settle();
    props.status = 'switching';
    await settle();
    expect(announced()).toBe('');
  });
});

describe('DataBar accessibility', () => {
  test('axe clean on the bar, in both themes and at phone width', async () => {
    await wide();
    await expectAxeClean();
  });

  test('axe clean with the popover open, in English and French', async () => {
    for (const lang of ['en', 'fr'] as const) {
      await phone(barProps({ lang }));
      await summary().click();
      // English in light, French in dark: the bar's colours are in the first test's matrix.
      await expectAxeClean([PHONE], [lang === 'en' ? 'light' : 'dark']);
      cleanup();
    }
  });

  test('forced colours keep a palette’s colours: they are data', async () => {
    await wide();
    await withMedia([{ name: 'forced-colors', value: 'active' }], async () => {
      const segment = option('Colour', 'Yeo 7 networks').querySelector(
        '.data-option-palette > span',
      )!;
      expect(getComputedStyle(segment).backgroundColor).toBe('rgb(120, 18, 134)');
    });
  });

  test('forced colours: the check is drawn in the option’s own text colour', async () => {
    await wide();
    await withMedia([{ name: 'forced-colors', value: 'active' }], async () => {
      const [button] = pressed('Atlas');
      const check = button.querySelector('.data-option-check svg')!;
      expect(getComputedStyle(check).stroke).toBe(getComputedStyle(button).color);
    });
  });
});
