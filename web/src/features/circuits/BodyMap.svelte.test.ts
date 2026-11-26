// The body map's panel on a small record rather than the published manifest: the part shown, the areas
// that are its key, what it leaves out and its sources.
import { afterEach, expect, test } from 'vitest';
import { flushSync } from 'svelte';
import { page, userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import { t } from '../../lib/core/i18n/index.ts';
import { en as panelEn } from '../../lib/core/i18n/areas/bodyMapPanel.ts';
import { createBodyMapStore } from '../../lib/state/body-map.svelte.ts';
import type { ViewStore } from '../../lib/state/view.svelte.ts';
import type { Language } from '../../lib/types/index.ts';
import type { BodyMap as BodyMapRecord } from '../../lib/types/manifest.ts';
import { expectAxeClean } from '../../lib/ui/a11y-test-support.ts';
import '../../styles/index.css';
import BodyMap from './BodyMap.svelte';
import { createBodyMapExplorer } from './body-map-explorer.svelte.ts';

const hemisphere = (moves: 'left' | 'right', footOff: number) => ({
  moves,
  strip_mm2: 6200,
  assigned_share: 0.8,
  area_mm2: { foot: 1349.7, hand: 1594.0, tongue: 2068.3 },
  off_strip_share: { foot: footOff, hand: 0.109, tongue: 0.238 },
});

const record: BodyMapRecord = {
  label: 'Body map',
  source: 'HCP motor task group maps',
  citations: [
    'https://doi.org/10.1/barch',
    'https://doi.org/10.1/vanessen',
    'https://doi.org/10.1/wu',
  ],
  license: 'HCP Open Access Data Use Terms',
  method: 'Winner on the strip.',
  files: { destrieux: { file: 'body-map-destrieux.field', vertex_count: 10 } },
  parts: [
    { code: 1, id: 'foot' },
    { code: 2, id: 'hand' },
    { code: 3, id: 'tongue' },
  ],
  people: 486,
  floor: { d: 0.5, z: 11.02 },
  hemispheres: { left: hemisphere('right', 0.643), right: hemisphere('left', 0.728) },
  validation: {},
};

afterEach(() => cleanup());

function mount(lang: Language = 'en') {
  const current = {
    explorer: 'circuits',
    lang,
    lesson: { circuit: null, step: 0, visited: [], route: false, map: 'body-map' },
  };
  const store = createBodyMapStore();
  const model = createBodyMapExplorer({
    view: { current } as unknown as Pick<ViewStore, 'current'>,
    excursions: { openBodyMap: async () => undefined },
    store,
    record,
  });
  render(BodyMap, { props: { model } });
  flushSync();
  return store;
}

test('BODY-06 every part is shown at first; a choice shows one alone', async () => {
  const store = mount();
  const copy = panelEn;
  const all = page.getByRole('radio', { name: copy.all });
  await expect.element(all).toHaveAttribute('aria-checked', 'true');
  await userEvent.click(page.getByRole('radio', { name: copy.parts.hand }));
  expect(store.part).toBe('hand');
  await expect
    .element(page.getByRole('radio', { name: copy.parts.hand }))
    .toHaveAttribute('aria-checked', 'true');
  await expectAxeClean();
});

test("BODY-06 the table gives each part's area on the strip per hemisphere, and the limits quote the record", async () => {
  mount();
  const table = page.getByRole('table', { name: 'Area on the strip' });
  await expect.element(table).toBeVisible();
  const rows = [...table.element().querySelectorAll('tbody tr')].map((row) =>
    [...row.querySelectorAll('th, td')].map((cell) => cell.textContent!.trim()),
  );
  expect(rows).toEqual([
    ['Foot', '1,350 mm²', '1,350 mm²'],
    ['Hand', '1,594 mm²', '1,594 mm²'],
    ['Tongue', '2,068 mm²', '2,068 mm²'],
  ]);
  await expect
    .element(page.getByText(/64–73% of the foot’s map at that effect lies off the strip/))
    .toBeVisible();
  await expect.element(page.getByText(/A group average of 486 other adults/)).toBeVisible();
  await expect.element(page.getByText(/Cohen’s d ≥ 0.5/)).toBeVisible();
});

test('BODY-06 in French the areas take a no-break space and the decimal comma', async () => {
  mount('fr');
  const table = page.getByRole('table', { name: 'Aire sur la bande' });
  const first = table.element().querySelector('tbody td')!.textContent!;
  expect(first).toBe('1 350 mm²');
  await expect.element(page.getByText(/d de Cohen ≥ 0,5/)).toBeVisible();
});

test('BODY-06 the sources open in a new tab, the HCP data first', () => {
  mount();
  const copy = panelEn;
  const newTab = t('en', 'link').newTab;
  const hrefs = [copy.dataset, copy.task, copy.project, copy.registration].map((name) =>
    page
      .getByRole('link', { name: `${name} ${newTab}` })
      .element()
      .getAttribute('href'),
  );
  expect(hrefs).toEqual([
    'https://neurovault.org/collections/457/',
    'https://doi.org/10.1/barch',
    'https://doi.org/10.1/vanessen',
    'https://doi.org/10.1/wu',
  ]);
});

test('BODY-06 nothing is drawn while another map or a lesson is open', () => {
  const current = {
    explorer: 'circuits',
    lang: 'en',
    lesson: { circuit: 'vision', step: 0, visited: [0], route: false },
  };
  const model = createBodyMapExplorer({
    view: { current } as unknown as Pick<ViewStore, 'current'>,
    excursions: { openBodyMap: async () => undefined },
    store: createBodyMapStore(),
    record,
  });
  render(BodyMap, { props: { model } });
  flushSync();
  expect(document.querySelector('#body-map-title')).toBeNull();
});
