// Stroke cases: where focus goes when the button pressed goes with what it changed.
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { flushSync } from 'svelte';
import { cleanup, render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import type { StrokeCase, StrokeCases } from '../../lib/core/catalog/stroke-cases.ts';
import type { StrokeCasesStore } from '../../lib/state/stroke-cases.svelte.ts';
import { FOCUS_TARGETS, registerFocusTarget } from '../../lib/ui/focus.ts';
import type { Region } from '../../lib/types/index.ts';
import '../../styles/index.css';
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
    toggle() {},
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

function dangerInk() {
  const probe = document.body.appendChild(document.createElement('span'));
  probe.style.color = 'var(--danger)';
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}
