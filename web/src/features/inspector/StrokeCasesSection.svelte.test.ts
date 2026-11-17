// Stroke cases: where focus goes when the button pressed goes with what it changed, and how the
// plot's dots and the table of cases are picked.
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { flushSync } from 'svelte';
import { cleanup, render } from 'vitest-browser-svelte';
import { cdp, page, userEvent } from 'vitest/browser';
import type { StrokeCase, StrokeCases } from '../../lib/core/catalog/stroke-cases.ts';
import type { StrokeCasesStore } from '../../lib/state/stroke-cases.svelte.ts';
import { expectAxeClean, withMedia } from '../../lib/ui/a11y-test-support.ts';
import { FOCUS_TARGETS, registerFocusTarget } from '../../lib/ui/focus.ts';
import type { Region } from '../../lib/types/index.ts';
import '../../styles/index.css';
import './inspector.css';
import StrokeCasesSection from './StrokeCasesSection.svelte';

const IFG = 'destrieux:left:12';
const OTHER = 'destrieux:left:40';

const person = (id: string, aq: number, volume_cm3: number, share: number): StrokeCase => ({
  id,
  aq,
  type: 'Broca',
  scan_day: 400,
  test_day: 400,
  volume_cm3,
  regions: { [IFG]: share },
  runs: [0, 2],
});

// Two pairs of similar volume and widely different score.
const cohort: StrokeCases = {
  id: 'stroke_cases',
  source: {
    short: 's',
    citation: 'c',
    doi: 'https://doi.org/10.1/x',
    pmid: 1,
    dataset: 'https://doi.org/10.1/y',
  },
  reaches_min: 0.05,
  test_windows: [90, 365],
  pairs: { volume_ratio_max: 1.25, aq_difference_min: 25 },
  aq_bands: [
    { id: 'very-severe', min: 0 },
    { id: 'severe', min: 26 },
    { id: 'moderate', min: 51 },
    { id: 'mild', min: 76 },
    { id: 'within-normal-limits', min: 93.8 },
  ],
  exceptions: { share_min: 0.4, aq_min: 76, shown: 2 },
  masks: { file: 'm', sha256: '0', shape: [2, 2, 2], order: 'F', voxel_to_surface_ras_mm: [] },
  cases: [
    person('A', 20, 50, 0.6),
    person('B', 80, 52, 0.3),
    person('C', 30, 10, 0.3),
    person('D', 90, 11, 0.3),
  ],
};

function mount(
  regionId: string,
  chosen: string[],
  state: { status: string; data?: StrokeCases; error?: unknown } = {
    status: 'ready',
    data: cohort,
  },
  lang: 'en' | 'fr' = 'en',
) {
  const store = $state({
    available: true,
    cohort: state,
    retries: 0,
    retry() {
      store.retries += 1;
      store.cohort = { status: 'loading' };
    },
    chosen,
    drawn: { status: 'idle' },
    load() {},
    // The Deficits list's ask to open the section (4.2); nothing asks here.
    revealing: false,
    reveal() {},
    revealed() {},
    // The store's own rule: a third pick replaces the second.
    toggled: [] as string[],
    toggle(id: string) {
      store.toggled.push(id);
      const { chosen } = store;
      if (chosen.includes(id)) store.chosen = chosen.filter((other) => other !== id);
      else store.chosen = chosen.length < 2 ? [...chosen, id] : [chosen[0]!, id];
    },
    show: (ids: readonly string[]) => (store.chosen = [...ids]),
    clear: () => (store.chosen = []),
  });
  render(StrokeCasesSection, {
    region: { id: regionId } as Region,
    lang,
    store: store as unknown as StrokeCasesStore,
    label: (id: string) => ({ name: id }),
  });
  document.querySelector<HTMLElement>('.stroke-cases summary')?.click();
  flushSync();
  return store;
}

afterEach(() => cleanup());

test('Show a pair hands focus to Next pair, which takes its place', async () => {
  const store = mount(IFG, []);
  await page.getByRole('button', { name: 'Show a pair' }).click();
  expect(store.chosen).toEqual(['A', 'B']);
  await expect
    .poll(() => document.activeElement)
    .toBe(page.getByRole('button', { name: 'Next pair' }).element());
});

test('Clear hands focus to the plot when cases reach the region', async () => {
  const store = mount(IFG, ['A', 'B']);
  await page.getByRole('button', { name: 'Clear cases' }).click();
  expect(store.chosen).toEqual([]);
  await expect
    .poll(() => document.activeElement)
    .toBe(document.querySelector('.case-plot [tabindex="0"]'));
});

test('Clear hands focus to the region’s title when the section goes with the cases', async () => {
  document.body.insertAdjacentHTML('beforeend', '<h2 id="region-title" tabindex="-1">Region</h2>');
  const title = document.getElementById('region-title')!;
  const unregister = registerFocusTarget(FOCUS_TARGETS.regionTitle, () => title);
  try {
    // No case reaches this region: the section is there only while a case is shown.
    mount(OTHER, ['A']);
    await page.getByRole('button', { name: 'Clear cases' }).click();
    expect(document.querySelector('.stroke-cases')).toBeNull();
    await expect.poll(() => document.activeElement).toBe(title);
  } finally {
    unregister();
    title.remove();
  }
});

describe('INSP-45 a cohort that failed says why, and offers what can help', () => {
  const coded = (code: string) => Object.assign(new Error('x'), { code });
  const note = () => document.querySelector<HTMLElement>('[role=alert]')!;
  const title = () => document.getElementById('region-title')!;
  let unregister = () => {};
  beforeEach(() => {
    document.body.insertAdjacentHTML(
      'beforeend',
      '<h2 id="region-title" tabindex="-1">Region</h2>',
    );
    unregister = registerFocusTarget(FOCUS_TARGETS.regionTitle, title);
  });
  afterEach(() => {
    unregister();
    title().remove();
  });

  test('a failed download says what to check and offers Retry, which asks again and keeps focus in the region', async () => {
    const store = mount(IFG, [], { status: 'error', error: coded('asset-fetch') });
    expect(note().textContent).toBe(
      'The cohort could not be loaded. A file could not be downloaded. Check the connection and try again.',
    );
    expect(getComputedStyle(note()).color).toBe(dangerInk());
    expect(dangerInk()).not.toBe(getComputedStyle(document.body).color);
    const retry = page.getByRole('button', { name: 'Retry' });
    (retry.element() as HTMLElement).focus();
    await userEvent.keyboard('{Enter}');
    expect(store.retries).toBe(1);
    await expect.poll(() => document.activeElement).toBe(title());
  });

  test('bytes that no longer match the page ask for a reload, in French too', () => {
    mount(IFG, [], { status: 'error', error: coded('asset-updated') }, 'fr');
    expect(note().textContent).toBe(
      'Un fichier du serveur ne correspond plus à cette page\u202f; Planum a probablement été mis à jour. Rechargez la page pour continuer.',
    );
    expect(document.querySelector('.actions button')?.textContent?.trim()).toBe('Recharger');
  });

  test('any other failure says the cohort could not be loaded, and offers nothing that would fail again', () => {
    mount(IFG, [], { status: 'error', error: new Error('Invalid stroke cases') });
    expect(note().textContent).toBe('The cohort could not be loaded.');
    expect(document.querySelector('.actions')).toBeNull();
  });
});

describe('INSP-55 every dot can be pressed, the labels are read, and a table lists every case', () => {
  const ready = (cases: StrokeCase[]) => ({ status: 'ready', data: { ...cohort, cases } });
  /** The section at a panel's width, once the plot is drawn at it. */
  async function atWidth(px: number) {
    document.querySelector<HTMLElement>('.stroke-cases')!.style.width = `${px}px`;
    await expect
      .poll(() => document.querySelector('.case-plot')?.getAttribute('width'))
      .toBe(String(px));
  }
  const centre = (id: string) => {
    const box = document.querySelector(`[data-case="${id}"] .dot`)!.getBoundingClientRect();
    return [box.left + box.width / 2, box.top + box.height / 2] as const;
  };
  const caseAt = (x: number, y: number) =>
    document.elementFromPoint(x, y)?.closest('[data-case]')?.getAttribute('data-case') ?? null;
  /** What sixteen presses at `radius` around the dot would take. */
  const around = (id: string, radius: number) => {
    const [x, y] = centre(id);
    return Array.from({ length: 16 }, (_, k) =>
      caseAt(x + radius * Math.cos((k * Math.PI) / 8), y + radius * Math.sin((k * Math.PI) / 8)),
    );
  };
  async function pressAt(x: number, y: number) {
    const plot = document.querySelector('.case-plot')!;
    const box = plot.getBoundingClientRect();
    await userEvent.click(plot, { position: { x: x - box.left, y: y - box.top } });
  }
  const openTable = () => page.getByText('Table of cases').click();
  const rowIds = () =>
    [...document.querySelectorAll('.case-table tbody th')].map((cell) => cell.textContent!.trim());
  const sorted = () =>
    [...document.querySelectorAll('.case-table thead th')].map((cell) => [
      cell.textContent!.trim(),
      cell.getAttribute('aria-sort'),
    ]);

  test('an isolated dot takes a press 12px from its centre all round, 22px with a coarse pointer', async () => {
    mount(IFG, []);
    await atWidth(289);
    expect(around('A', 11.5)).toEqual(Array(16).fill('A'));
    expect(around('A', 12.5)).toEqual(Array(16).fill(null));
    // Touch emulation is what makes Chromium report a coarse primary pointer.
    await cdp().send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    try {
      await expect.poll(() => around('A', 21.5)).toEqual(Array(16).fill('A'));
      expect(around('A', 22.5)).toEqual(Array(16).fill(null));
    } finally {
      await cdp().send('Emulation.setTouchEmulationEnabled', { enabled: false });
    }
  });

  test('in a crowd a press takes the nearest dot, not the one drawn last', async () => {
    const store = mount(
      IFG,
      [],
      ready([
        person('P', 50, 30, 0.5),
        person('Q', 50, 32, 0.5),
        person('R', 10, 10, 0.5),
        person('S', 90, 100, 0.5),
      ]),
    );
    await atWidth(289);
    const [px, py] = centre('P');
    const [qx, qy] = centre('Q');
    // Under 8px apart, so drawn dots touch and 12px circles would hand both sides to Q.
    expect(qy).toBe(py);
    expect(qx - px).toBeGreaterThan(4);
    expect(qx - px).toBeLessThan(8);
    await pressAt(px + (qx - px) / 4, py);
    await pressAt(qx - (qx - px) / 4, py);
    await pressAt(px - 8, py - 6);
    expect(store.toggled).toEqual(['P', 'Q', 'P']);
    // The press moves the plot's one tab stop to the dot it took, as a click on the dot did.
    expect(document.querySelector('.case-plot [tabindex="0"]')?.getAttribute('data-case')).toBe(
      'P',
    );
  });

  test('the labels are set at the caption size and never touch, on every axis the plot can draw', async () => {
    const STOPS = [0.1, 0.3, 1, 3, 10, 30, 100, 300, 1000, 3000];
    const overlap = (p: DOMRect, q: DOMRect) =>
      p.left < q.right && q.left < p.right && p.top < q.bottom && q.top < p.bottom;
    // The panel's narrowest (a 320px phone) and its desktop width, every label; at 200% text on
    // the phone, the ticks (the titles are then wider than the plot).
    for (const [px, root] of [
      [276, ''],
      [289, ''],
      [276, '200%'],
    ] as const) {
      document.documentElement.style.fontSize = root;
      try {
        for (const lang of ['en', 'fr'] as const) {
          const store = mount(IFG, [], undefined, lang);
          await atWidth(px);
          for (const [i, low] of STOPS.entries()) {
            for (const high of STOPS.slice(i + 1)) {
              store.cohort = ready([person('L', 40, low, 0.5), person('H', 60, high, 0.5)]);
              flushSync();
              const plot = document.querySelector('.case-plot')!;
              const frame = plot.getBoundingClientRect();
              const ticks = [...plot.querySelectorAll('.tick')];
              const labels = root ? ticks : [...plot.querySelectorAll('text')];
              const at = `${lang} ${px}px ${root || '100%'} ${low}–${high}`;
              expect(getComputedStyle(ticks[0]!).fontSize, at).toBe(root ? '26px' : '13px');
              // Every axis names at least two stops, so its scale can be read.
              expect(ticks.length, at).toBeGreaterThan(4);
              const boxes = labels.map((label) => label.getBoundingClientRect());
              for (const [k, box] of boxes.entries()) {
                expect(box.left >= frame.left && box.right <= frame.right, at).toBe(true);
                expect(box.top >= frame.top && box.bottom <= frame.bottom, at).toBe(true);
                for (const other of boxes.slice(k + 1)) expect(overlap(box, other), at).toBe(false);
              }
            }
          }
          cleanup();
        }
      } finally {
        document.documentElement.style.fontSize = '';
      }
    }
  });

  test('the table lists every case, closed until asked, and its headings sort it both ways', async () => {
    mount(IFG, []);
    expect(document.querySelector('.case-table')?.checkVisibility()).toBe(false);
    await openTable();
    expect(document.querySelector('.case-table caption')?.textContent).toBe(
      'Every case in the plot. Each column heading sorts the table.',
    );
    // By volume first: the dots from left to right.
    expect(rowIds()).toEqual(['ARC C', 'ARC D', 'ARC A', 'ARC B']);
    expect(sorted()).toEqual([
      ['Case', null],
      ['Lesion volume, cm³', 'ascending'],
      ['WAB-AQ', null],
    ]);
    const first = document.querySelector<HTMLTableRowElement>('.case-table tbody tr')!;
    expect([...first.cells].map((cell) => cell.textContent!.trim())).toEqual([
      'ARC C',
      '10.0',
      '30.0',
    ]);
    await page.getByRole('button', { name: 'WAB-AQ', exact: true }).click();
    expect(rowIds()).toEqual(['ARC A', 'ARC C', 'ARC B', 'ARC D']);
    expect(sorted()).toEqual([
      ['Case', null],
      ['Lesion volume, cm³', null],
      ['WAB-AQ', 'ascending'],
    ]);
    await page.getByRole('button', { name: 'WAB-AQ', exact: true }).click();
    expect(rowIds()).toEqual(['ARC D', 'ARC B', 'ARC C', 'ARC A']);
    expect(sorted()[2]).toEqual(['WAB-AQ', 'descending']);
    // From the keyboard, as the native button it is.
    (page.getByRole('button', { name: 'Case', exact: true }).element() as HTMLElement).focus();
    await userEvent.keyboard('{Enter}');
    expect(rowIds()).toEqual(['ARC A', 'ARC B', 'ARC C', 'ARC D']);
    expect(sorted()).toEqual([
      ['Case', 'ascending'],
      ['Lesion volume, cm³', null],
      ['WAB-AQ', null],
    ]);
  });

  test('in French, with the decimal comma', async () => {
    mount(IFG, [], undefined, 'fr');
    await page.getByText('Tableau des cas').click();
    expect(sorted().map(([name]) => name)).toEqual(['Cas', 'Volume de la lésion, cm³', 'QA-WAB']);
    expect(document.querySelector('.case-table tbody td')?.textContent).toBe('10,0');
    expect(document.querySelector('.case-table caption')?.textContent).toBe(
      'Chaque cas du graphique. Chaque en-tête de colonne trie le tableau.',
    );
  });

  test('a row and its dot are one choice: the same press, pressed state and colour', async () => {
    const viaDot = mount(IFG, []);
    await atWidth(289);
    await pressAt(...centre('B'));
    const dotStop = document.querySelector('.case-plot [tabindex="0"]')?.getAttribute('data-case');
    cleanup();

    const store = mount(IFG, []);
    await atWidth(289);
    await openTable();
    const row = (id: string) => page.getByRole('button', { name: `ARC ${id}`, exact: true });
    await row('B').click();
    expect(store.toggled).toEqual(viaDot.toggled);
    expect(store.chosen).toEqual(viaDot.chosen);
    expect(document.querySelector('.case-plot [tabindex="0"]')?.getAttribute('data-case')).toBe(
      dotStop,
    );
    await row('D').click();
    expect(store.chosen).toEqual(['B', 'D']);
    for (const id of ['A', 'B', 'C', 'D']) {
      const dot = document.querySelector(`[data-case="${id}"]`)!;
      const pressed = row(id).element().getAttribute('aria-pressed');
      expect(pressed, id).toBe(dot.getAttribute('aria-pressed'));
      expect(pressed, id).toBe(String(id === 'B' || id === 'D'));
      // A chosen row's swatch is its dot's colour, the colour its lesion takes on the brain.
      if (pressed === 'true') {
        expect(
          getComputedStyle(row(id).element().querySelector('.case-dot')!).backgroundColor,
        ).toBe(getComputedStyle(dot.querySelector('.dot')!).fill);
      }
    }
  });

  test('targets and rows are 24px tall, 44px with a coarse pointer, and keep their state in forced colours', async () => {
    mount(IFG, ['A']);
    await openTable();
    const heights = () =>
      [...document.querySelectorAll('.case-table button')].map(
        (button) => button.getBoundingClientRect().height,
      );
    expect(Math.min(...heights())).toBeGreaterThanOrEqual(24);
    await cdp().send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    try {
      await expect.poll(() => Math.min(...heights())).toBeGreaterThanOrEqual(44);
    } finally {
      await cdp().send('Emulation.setTouchEmulationEnabled', { enabled: false });
    }
    await withMedia([{ name: 'forced-colors', value: 'active' }], () => {
      const swatch = (id: string) =>
        getComputedStyle(
          page
            .getByRole('button', { name: `ARC ${id}`, exact: true })
            .element()
            .querySelector('.case-dot')!,
        );
      // The swatch's fill is painted away: a pressed row's is filled with Highlight, the others ringed.
      expect([swatch('A').borderTopWidth, swatch('A').borderTopColor]).toEqual([
        '5px',
        system('Highlight'),
      ]);
      expect([swatch('B').borderTopWidth, swatch('B').borderTopColor]).toEqual([
        '1px',
        system('CanvasText'),
      ]);
      // SVG keeps its own paint, so the plot takes the system's; the chosen dot is ringed.
      const dot = (id: string) =>
        getComputedStyle(document.querySelector(`[data-case="${id}"] .dot`)!);
      expect(dot('B').fill).toBe(system('CanvasText'));
      expect([dot('A').stroke, dot('A').strokeWidth]).toEqual([system('CanvasText'), '2px']);
      expect(getComputedStyle(document.querySelector('.case-plot .tick')!).fill).toBe(
        system('CanvasText'),
      );
    });
  });

  test('the section passes axe with a case chosen and the table open', async () => {
    mount(IFG, ['A', 'B']);
    // In the inspector's scope, which styles the section's commands.
    document.querySelector('.stroke-cases')!.parentElement!.classList.add('region-detail');
    await openTable();
    await expectAxeClean();
  });
});

/** A system colour as the browser resolves it now. */
function system(name: string) {
  const probe = document.body.appendChild(document.createElement('span'));
  probe.style.color = name;
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

function dangerInk() {
  const probe = document.body.appendChild(document.createElement('span'));
  probe.style.color = 'var(--danger)';
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}
