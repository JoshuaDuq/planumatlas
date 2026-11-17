// The visual field map's switch for the named visual areas, on a small retinotopy record rather than the
// published manifest: off at first, what it says either way, and the agreement and source it brings.
import { afterEach, expect, test } from 'vitest';
import { flushSync } from 'svelte';
import { page, userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import { t } from '../../lib/core/i18n/index.ts';
import { parseVisualFieldTerritories } from '../../lib/core/learning/visual-field.ts';
import type { Language } from '../../lib/types/index.ts';
import type { Retinotopy } from '../../lib/types/manifest.ts';
import { expectAxeClean } from '../../lib/ui/a11y-test-support.ts';
import { createVisualFieldMapStore } from '../../lib/state/visual-field-map.svelte.ts';
import type { ViewStore } from '../../lib/state/view.svelte.ts';
import '../../styles/index.css';
import VisualFieldMap from './VisualFieldMap.svelte';
import { createVisualFieldExplorer } from './visual-field-explorer.svelte.ts';

const hemisphere = (wang: [number, number, number]) => ({
  area_mm2: { V1: 2235, V2: 2230, V3: 1745 },
  extrapolated_share: 0.408,
  agreement_dice: {
    V1: { 'hcp-mmp': 0.9, julich: 0.68, wang: wang[0] },
    V2: { 'hcp-mmp': 0.76, julich: 0.56, wang: wang[1] },
    V3: { 'hcp-mmp': 0.78, julich: 0.57, wang: wang[2] },
  },
});

const record: Retinotopy = {
  file: 'retinotopy.json',
  label: 'Predicted retinotopy (Benson template v4.0)',
  citation: 'https://doi.org/10.1167/18.13.23',
  method_citation: 'https://doi.org/10.1371/journal.pcbi.1003538',
  license: 'AGPL-3.0',
  attributes: { x: '_FIELD_X', y: '_FIELD_Y', sigma: '_PRF_SIGMA', area: '_VISUAL_AREA' },
  areas: [
    { code: 1, name: 'V1' },
    { code: 2, name: 'V2' },
    { code: 3, name: 'V3' },
  ],
  measured_eccentricity_deg: 8,
  maximum_eccentricity_deg: 90,
  hemispheres: { left: hemisphere([0.72, 0.68, 0.57]), right: hemisphere([0.72, 0.66, 0.6]) },
  method: 'Interpolated through the registered spheres.',
  visual_areas: {
    label: 'Visual areas (Wang et al. 2015 maximum-probability atlas)',
    citation: 'https://doi.org/10.1093/cercor/bhu277',
    license: 'CC BY 4.0',
    attribute: '_WANG_AREA',
    areas: [
      { code: 1, name: 'V1v' },
      { code: 15, name: 'LO1' },
    ],
    method: 'Nearest registered template vertex.',
  },
};

const territories = parseVisualFieldTerritories({
  areas: { V1: 1, V2: 2, V3: 3 },
  hemispheres: {
    left: { x: [2], y: [2], area: [1], mm2: [3] },
    right: { x: [-2], y: [2], area: [1], mm2: [4] },
  },
});

afterEach(() => cleanup());

function mount(lang: Language = 'en') {
  const dot = { x: 2, y: 2, radius: 1 };
  const current = {
    explorer: 'circuits',
    lang,
    hemisphere: 'both',
    lesson: { circuit: null, step: 0, visited: [], route: false, map: 'visual-field', dot },
  };
  const store = createVisualFieldMapStore({ moveDot: () => undefined });
  const model = createVisualFieldExplorer({
    view: { current } as unknown as Pick<ViewStore, 'current'>,
    excursions: { openMap: async () => undefined, showMapScene: async () => undefined },
    lesson: { moveDot: () => undefined },
    store,
    visualField: { territories: async () => territories, follow: () => undefined },
    retinotopy: record,
    tours: [],
    openTour: () => undefined,
  });
  render(VisualFieldMap, { props: { model } });
  flushSync();
  return store;
}

test('the areas start unnamed; the switch names them and brings their agreement and key', async () => {
  const store = mount();
  const copy = t('en', 'visualField');
  const toggle = page.getByRole('switch', { name: copy.nameAreas });
  await expect.element(toggle).toHaveAttribute('aria-checked', 'false');
  await expect.element(page.getByText(copy.areasNote)).toBeVisible();
  expect(document.body.textContent).not.toContain(copy.legendOutlines);

  await userEvent.click(toggle);
  expect(store.areasNamed).toBe(true);
  await expect.element(toggle).toHaveAttribute('aria-checked', 'true');
  await expect
    .element(
      page.getByText(
        'In the left hemisphere, the atlas’s V1, V2 and V3 overlap the predicted ones at Dice 0.72, 0.68 and 0.57.',
      ),
    )
    .toBeVisible();
  await expect.element(page.getByText(copy.legendOutlines)).toBeVisible();
  await expectAxeClean();
});

test('the atlas is cited among the sources, opening in a new tab', () => {
  mount();
  const copy = t('en', 'visualField');
  const link = page.getByRole('link', { name: `${copy.areasSource} ${t('en', 'link').newTab}` });
  expect(link.element().getAttribute('href')).toBe('https://doi.org/10.1093/cercor/bhu277');
  expect(link.element().getAttribute('target')).toBe('_blank');
});

test('in French the agreement reads with decimal commas', async () => {
  const store = mount('fr');
  store.nameAreas(true);
  flushSync();
  await expect
    .element(
      page.getByText(
        'Dans l’hémisphère gauche, les V1, V2 et V3 de l’atlas recouvrent ceux prédits avec un Dice de 0,72, 0,68 et 0,57.',
      ),
    )
    .toBeVisible();
});

test('the reading at a clicked point names its visual area, alone beyond V1–V3', () => {
  const store = mount();
  const reading = () => document.querySelector('.note[aria-live="polite"]')!.textContent!.trim();
  store.read(
    { x: 3, y: 2, sigma: 0.6, area: 'V2', hemisphere: 'left' },
    { name: 'V2v', hemisphere: 'left' },
  );
  flushSync();
  expect(reading()).toMatch(/^Left V2: .*The dot now shows it\. Named area: V2v\.$/);
  store.read(null, { name: 'LO1', hemisphere: 'left' });
  flushSync();
  expect(reading()).toBe('Left LO1: the template predicts no visual field position here.');
  store.read(null, null);
  flushSync();
  expect(reading()).toBe(t('en', 'visualField').readingNone);
});
