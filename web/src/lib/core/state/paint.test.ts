import assert from 'node:assert/strict';
import { beforeAll, describe, test } from 'vitest';
import type {
  HighlightedRegion,
  Manifest,
  ModelState,
  Paint,
  SurfaceColor,
} from '../../types/index.ts';
import { readRepoYaml } from '../../../../test/repo.ts';
import { readModel } from '../catalog/test-support.ts';
import {
  ALL_DOMAINS,
  COMPARE_COLORS,
  SHARED_COLOR,
  validateNeuropsychDomains,
} from '../catalog/neuropsych-domains.ts';
import type { NeuropsychDomains, NeurosynthTerms } from '../catalog/neuropsych-domains.ts';
import { createClinicalCatalog, findingPaint } from '../clinical/catalog.ts';
import type { ClinicalCatalog } from '../clinical/catalog.ts';
import type { ClinicalData } from '../clinical/types.ts';
import type { FunctionalConnectivity } from '../catalog/functional-connectivity.ts';
import type { DisorderEffects } from '../catalog/disorder-effects.ts';
import type { CorticalLayers } from '../catalog/cortical-layers.ts';
import {
  comparesMap,
  FUNCTION_OVERLAP_COLOR,
  HIGHLIGHT_RGB,
  highlightStatus,
  legendFor,
  MAP_OVERLAP,
  paintFor,
  paintKind,
} from './paint.ts';
import type { HighlightState } from './paint.ts';

/** What the key reads: the paint's state, the surface colour under it and any ghost. */
type KeyState = HighlightState &
  Pick<ModelState, 'focused' | 'ghostedAround'> & {
    surfaceColor: SurfaceColor;
  };

const domains = {
  atlas: 'hcp-mmp',
  unit_atlas: 'learning',
  units: {},
  domains: [
    { id: 'language', name: 'Language', name_fr: 'Langage', overview: true, color: [1, 2, 3] },
    { id: 'memory', name: 'Memory', name_fr: 'Mémoire', overview: true, color: [4, 5, 6] },
    { id: 'reading', name: 'Reading', name_fr: 'Lecture', overview: false, color: [7, 8, 9] },
  ],
  regions: {
    'hcp-mmp:left:1': [
      { domain: 'memory', z: 7 },
      { domain: 'language', z: 4 },
    ],
  },
  structure_atlas: 'aseg',
  threshold_z: 3,
  region_atlases: ['julich'],
  atlas_regions: { julich: { 'julich:left:1': [{ domain: 'language', z: 6 }] } },
  z_scale: [
    { from: 3, color: [30, 30, 30] },
    { from: 5, color: [50, 50, 50] },
    { from: 10, color: [90, 90, 90] },
  ],
} as unknown as NeuropsychDomains;
const associations = [
  {
    id: 'naming',
    title: { en: 'Naming', fr: 'Dénomination' },
    mappings: [{ region: 'destrieux:left:1' }],
  },
  {
    id: 'repetition',
    title: { en: 'Repetition', fr: 'Répétition' },
    mappings: [{ region: 'destrieux:left:2' }],
  },
];
const clinical = {
  paint: (id: string, finding: string | null = null) => findingPaint(id, associations, finding),
  get: () => ({ name: { en: 'Aphasia', fr: 'Aphasie' } }),
  standIns: () => [],
} as unknown as ClinicalCatalog;
const drawn = new Set(['destrieux:left:1', 'destrieux:left:2']);
const sources = { domains, clinical, drawn: (id: string) => drawn.has(id) };
const base: KeyState = {
  surfaceColor: 'tissue',
  focused: false,
  ghostedAround: null,
  explorer: 'functions',
  atlas: 'hcp-mmp',
  selectedFunction: 'all',
  selectedDeficit: 'aphasia',
  selectedFinding: null,
  paintLifted: false,
  paintFrom: null,
  connectivitySeed: null,
  disorderShown: null,
  lang: 'en',
  lesson: { circuit: null },
};
const paintOf = (id: string): Paint => ({ id, colors: new Map() });

test('a tab paints only while it is in front, on the atlas its map is defined on, and not once lifted', () => {
  assert.equal(paintFor(base, sources)!.id, 'function:all');
  assert.equal(paintFor({ ...base, atlas: 'destrieux' }, sources), null);
  // FUNC-46: a listed atlas takes the paint on its own areas.
  const julich = paintFor({ ...base, atlas: 'julich', selectedFunction: 'language' }, sources)!;
  assert.deepEqual([...julich.colors.keys()], ['julich:left:1']);
  assert.equal(paintFor({ ...base, atlas: 'julich' }, sources)!.colors.get('julich:left:1')![0], 1);
  assert.equal(paintFor({ ...base, selectedFunction: null }, sources), null);
  assert.equal(paintFor({ ...base, paintLifted: true }, sources), null);
  assert.equal(paintFor({ ...base, explorer: 'anatomy' }, sources), null);
  assert.equal(
    paintFor({ ...base, explorer: 'deficits', atlas: 'destrieux' }, sources)!.id,
    'deficit:aphasia',
  );
  assert.equal(
    paintFor({ ...base, explorer: 'deficits', selectedFinding: 'naming' }, sources)!.id,
    'deficit:aphasia:naming',
  );
  assert.equal(paintFor({ ...base, explorer: 'deficits', selectedDeficit: null }, sources), null);
});

test('FUNC-49 · a raised threshold paints fewer areas, and the key outlines the bands nothing then carries', () => {
  assert.equal(
    paintFor({ ...base, selectedFunction: 'memory', paintFrom: 5 }, sources)!.colors.size,
    1,
  );
  assert.equal(
    paintFor({ ...base, selectedFunction: 'language', paintFrom: 5 }, sources)!.colors.size,
    0,
  );
  const paint = paintFor({ ...base, selectedFunction: 'memory', paintFrom: 5 }, sources)!;
  const key = legendFor(
    { ...base, selectedFunction: 'memory', paintFrom: 5, paint, lang: 'en' },
    sources,
  )!;
  assert.deepEqual(
    key.rows.map((row) => [row.label, Boolean(row.absent)]),
    [
      ['z\u00a0≥\u00a010', true],
      ['z\u00a05\u00a0to\u00a010', false],
      ['z\u00a03\u00a0to\u00a05', true],
    ],
  );
  // The overview ignores it.
  assert.equal(paintFor({ ...base, paintFrom: 5 }, sources)!.id, 'function:all');
});

test('the key lists the overview, or the z scale of the function chosen, or each finding of the open deficit', () => {
  const paint = paintOf('function:memory');
  const functions = legendFor({ ...base, selectedFunction: 'memory', paint, lang: 'fr' }, sources)!;
  assert.equal(functions.map, 'function');
  assert.equal(functions.title, 'Mémoire');
  assert.equal(functions.pickable, false);
  assert.deepEqual(
    functions.rows.map((row) => [row.label, row.color]),
    [
      ['z\u00a0≥\u00a010', [90, 90, 90]],
      ['z\u00a05\u00a0à\u00a010', [50, 50, 50]],
      ['z\u00a03\u00a0à\u00a05', [30, 30, 30]],
    ],
  );
  const overview = legendFor({ ...base, paint: paintOf('function:all') }, sources)!;
  assert.deepEqual(
    overview.rows.map((row) => [row.id, row.pressed]),
    [
      ['language', false],
      ['memory', false],
    ],
  );
  assert.notEqual(overview.pickable, false);
  const deficit = legendFor(
    { ...base, explorer: 'deficits', paint: clinical.paint('aphasia').paint },
    sources,
  )!;
  assert.equal(deficit.title, 'Aphasia');
  assert.deepEqual(
    deficit.rows.map((row) => [row.id, row.label, row.pressed]),
    [
      ['naming', 'Naming', false],
      ['repetition', 'Repetition', false],
    ],
  );
  assert.equal(legendFor({ ...base, paint: null }, sources), null);
});

test('a comparison keys each function and the areas both reach, greying a colour no area carries', () => {
  const state = { ...base, selectedFunction: 'compare:language,memory' };
  const paint = paintFor(state, sources)!;
  assert.equal(paint.id, 'function:compare:language,memory');
  const legend = legendFor({ ...state, paint, lang: 'fr' }, sources)!;
  assert.equal(legend.title, 'Langage · Mémoire');
  assert.equal(legend.pickable, false);
  // The one painted area is reached by both, so neither function's own colour is on the stage.
  assert.deepEqual(
    legend.rows.map((row) => [row.id, row.label, row.color, row.absent]),
    [
      ['language', 'Langage', COMPARE_COLORS[0], true],
      ['memory', 'Mémoire', COMPARE_COLORS[1], true],
      ['shared', 'Les deux', SHARED_COLOR, false],
    ],
  );
});

test('FUNC-51 · against a drawn map, one function paints its areas in one colour and keys three', () => {
  const state = { ...base, selectedFunction: 'memory' };
  const plain = paintFor(state, sources)!;
  const paint = paintFor(state, { ...sources, mapsDrawn: 1 })!;
  assert.equal(paint.id, 'function:memory:map');
  assert.deepEqual([...paint.colors.keys()], [...plain.colors.keys()]);
  assert.ok([...paint.colors.values()].every((color) => color === FUNCTION_OVERLAP_COLOR));
  assert.deepEqual(
    [FUNCTION_OVERLAP_COLOR, MAP_OVERLAP.map, MAP_OVERLAP.both],
    [COMPARE_COLORS[0], COMPARE_COLORS[1], SHARED_COLOR],
  );
  const legend = legendFor(
    { ...state, paint, lang: 'fr' },
    { ...sources, map: { title: 'zstat1', threshold: 3.1 } },
  )!;
  assert.equal(legend.title, 'Mémoire · zstat1');
  assert.deepEqual(
    legend.rows.map((row) => [row.id, row.label, row.color]),
    [
      ['function', 'Mémoire, z\u00a0≥\u00a03', COMPARE_COLORS[0]],
      ['map', 'zstat1 au-dessus de 3,1', COMPARE_COLORS[1]],
      ['shared', 'Les deux', SHARED_COLOR],
    ],
  );
  // A raised threshold that paints nothing greys the function's row.
  const empty = { ...base, selectedFunction: 'language', paintFrom: 5 };
  const none = legendFor(
    { ...empty, paint: paintFor(empty, { ...sources, mapsDrawn: 1 }) },
    { ...sources, map: { title: 'zstat1', threshold: 3 } },
  )!;
  assert.equal(none.rows[0]!.absent, true);
});

test('FUNC-51 · only one function, painted in front, is drawn against the map', () => {
  const one = { ...base, selectedFunction: 'memory' };
  assert.equal(comparesMap(one, true, domains), true);
  for (const state of [
    { ...one, selectedFunction: ALL_DOMAINS },
    { ...one, selectedFunction: 'compare:language,memory' },
    { ...one, selectedFunction: null },
    { ...one, paintLifted: true },
    { ...one, explorer: 'deficits' as const },
    { ...one, atlas: 'destrieux' },
  ]) {
    assert.equal(comparesMap(state, true, domains), false);
    assert.equal(
      paintFor(state, { ...sources, mapsDrawn: 1 })?.id.endsWith(':map') ?? false,
      false,
    );
  }
  assert.equal(comparesMap(one, false, domains), false);
  // Two maps drawn at once: the function keeps its own paint, and neither map is compared.
  assert.equal(paintFor(one, { ...sources, mapsDrawn: 2 })!.id, paintFor(one, sources)!.id);
  // Without a map the key is the z scale, whatever the source says.
  const plain = legendFor({ ...one, paint: paintFor(one, sources) }, { ...sources, map: null })!;
  assert.equal(plain.rows.length, domains.z_scale.length);
});

// Pairs once: (1,2) r 0.50, (1,3) r 0.20, (2,3) r 0.10.
const connectivity: FunctionalConnectivity = {
  id: 'functional-connectivity',
  source: { short: 's', citation: 'c', pmid: 1, dataset: 'https://doi.org/10.25493/x', terms: 't' },
  people: 200,
  ages: '22–35',
  r_scale: [
    { from: 0.15, color: [1, 1, 1] },
    { from: 0.3, color: [2, 2, 2] },
    { from: 0.45, color: [3, 3, 3] },
  ],
  atlases: {
    julich: { regions: ['julich:left:1', 'julich:left:2', 'julich:left:3'], r: [50, 20, 10] },
  },
};

test('STAGE-62 · Anatomy paints a seed’s connectivity over a lesion’s findings, on its atlas only, until lifted', () => {
  const seeded: KeyState = {
    ...base,
    explorer: 'anatomy',
    atlas: 'julich',
    connectivitySeed: 'julich:left:1',
  };
  const lesion = { kind: 'functions' as const, paint: paintOf('lesion:x'), rows: [] };
  const withData = { ...sources, connectivity, lesion };
  assert.equal(paintFor(seeded, withData)!.id, 'connectivity:julich:left:1');
  assert.equal(paintFor({ ...seeded, connectivitySeed: null }, withData)!.id, 'lesion:x');
  assert.equal(paintFor({ ...seeded, atlas: 'hcp-mmp' }, withData)!.id, 'lesion:x');
  assert.equal(paintFor({ ...seeded, explorer: 'functions' }, withData)!.id, 'function:all@julich');
  assert.equal(paintFor({ ...seeded, paintLifted: true }, withData), null);
});

test('STAGE-63 · the connectivity key names the seed and lists the r steps strongest first, outlining any nothing carries', () => {
  const state: KeyState = {
    ...base,
    explorer: 'anatomy',
    atlas: 'julich',
    connectivitySeed: 'julich:left:1',
  };
  const legend = legendFor(
    { ...state, paint: paintFor(state, { ...sources, connectivity }) },
    { ...sources, connectivity, label: (id) => `name of ${id}` },
  )!;
  assert.equal(legend.map, 'connectivity');
  assert.equal(legend.title, 'Resting connectivity with name of julich:left:1');
  assert.equal(legend.pickable, false);
  // r 0.50 reaches the top step, 0.20 the first; none falls in 0.30 to 0.45.
  assert.deepEqual(
    legend.rows.map(({ label, absent }) => [label, absent]),
    [
      ['r\u00a0≥\u00a00.45', false],
      ['r\u00a00.30\u00a0to\u00a00.45', true],
      ['r\u00a00.15\u00a0to\u00a00.30', false],
    ],
  );
  assert.match(legend.note, /below r 0\.15, as half of all pairs do/);
});

const measure = { pmid: 1, patients: 10, controls: 12, tested: 2 };
const disorders: DisorderEffects = {
  id: 'disorder-effects',
  source: {
    short: 's',
    citation: 'c',
    pmid: 1,
    repository: 'https://github.com/x/y',
    commit: 'abc',
  },
  false_discovery_rate: 0.05,
  d_scale: {
    split: 0.2,
    smaller: [
      [1, 1, 1],
      [2, 2, 2],
    ],
    larger: [
      [3, 3, 3],
      [4, 4, 4],
    ],
  },
  regions: ['desikan:left:1', 'desikan:left:2'],
  disorders: [
    {
      id: 'scz',
      name: { en: 'Schizophrenia', fr: 'Schizophrénie' },
      measures: { thickness: measure, volume: measure },
      effects: { 'desikan:left:1': -0.4, 'desikan:left:2': 0.1 },
    },
  ],
};

test('STAGE-75 · Anatomy paints a disorder on Desikan-Killiany only, over connectivity and a lesion, until lifted', () => {
  const shown: KeyState = {
    ...base,
    explorer: 'anatomy',
    atlas: 'desikan',
    disorderShown: 'scz',
    connectivitySeed: 'julich:left:1',
  };
  const lesion = { kind: 'functions' as const, paint: paintOf('lesion:x'), rows: [] };
  const withData = { ...sources, connectivity, disorders, lesion };
  assert.equal(paintFor(shown, withData)!.id, 'disorder:scz');
  assert.equal(paintFor({ ...shown, atlas: 'destrieux' }, withData)!.id, 'lesion:x');
  assert.equal(
    paintFor({ ...shown, disorderShown: null, atlas: 'julich' }, withData)!.id,
    'connectivity:julich:left:1',
  );
  assert.equal(paintFor({ ...shown, explorer: 'functions' }, withData), null);
  assert.equal(paintFor({ ...shown, paintLifted: true }, withData), null);
});

test('STAGE-66 · the disorder key names it and lists four steps from larger to smaller, outlining any nothing carries', () => {
  const state: KeyState = { ...base, explorer: 'anatomy', atlas: 'desikan', disorderShown: 'scz' };
  const legend = legendFor(
    { ...state, paint: paintFor(state, { ...sources, disorders }) },
    { ...sources, disorders },
  )!;
  assert.equal(legend.map, 'disorder');
  assert.equal(legend.title, 'Schizophrenia: patients minus controls');
  assert.equal(legend.pickable, false);
  // d −0.4 is a darker thinning, 0.1 a paler thickening; neither a darker thickening nor a paler thinning.
  assert.deepEqual(
    legend.rows.map(({ label, color, absent }) => [label, color, absent]),
    [
      ['Thicker or larger, d\u00a0≥\u00a00.2', [4, 4, 4], true],
      ['Thicker or larger, d\u00a0<\u00a00.2', [3, 3, 3], false],
      ['Thinner or smaller, d\u00a0>\u00a0−0.2', [1, 1, 1], true],
      ['Thinner or smaller, d\u00a0≤\u00a0−0.2', [2, 2, 2], false],
    ],
  );
  assert.match(
    legend.note,
    /survives a 5% false discovery rate\. Tissue-coloured regions show none/,
  );
});

// IV shares 7.2%, 11.7% and 6.9%: the second, third and first steps.
const layers: CorticalLayers = {
  id: 'cortical-layers',
  source: { paper: 'https://doi.org/p', collection: 'https://doi.org/c' },
  layers: ['I', 'II', 'III', 'IV', 'V', 'VI'],
  layer_iv_scale: [
    { from: 0, color: [1, 1, 1] },
    { from: 0.07, color: [2, 2, 2] },
    { from: 0.09, color: [3, 3, 3] },
    { from: 0.12, color: [4, 4, 4] },
  ],
  regions: {
    'hcp-mmp:left:8': [100, 100, 330, 72, 200, 198],
    'hcp-mmp:left:9': [100, 100, 300, 117, 190, 193],
    'julich:left:1': [100, 100, 300, 69, 200, 231],
  },
  cells: { datasets: [], regions: {} },
};

test('STAGE-73 · Anatomy paints layer IV’s share on the shown atlas, over a lesion and the highlights, until lifted', () => {
  const shown: KeyState = { ...base, explorer: 'anatomy', atlas: 'hcp-mmp', layersShown: true };
  const lesion = { kind: 'functions' as const, paint: paintOf('lesion:x'), rows: [] };
  const withData = { ...sources, layers, lesion };
  const paint = paintFor(shown, withData)!;
  assert.equal(paint.id, 'layers:hcp-mmp');
  assert.deepEqual(
    [...paint.colors],
    [
      ['hcp-mmp:left:8', [2, 2, 2]],
      ['hcp-mmp:left:9', [3, 3, 3]],
    ],
  );
  assert.deepEqual(
    [...paintFor({ ...shown, atlas: 'julich' }, withData)!.colors],
    [['julich:left:1', [1, 1, 1]]],
  );
  // Until the file has arrived the lesion's findings stay; another tab paints its own.
  assert.equal(paintFor(shown, { ...sources, lesion })!.id, 'lesion:x');
  assert.equal(paintKind(paintFor({ ...shown, explorer: 'functions' }, withData)), 'function');
  assert.equal(paintFor({ ...shown, paintLifted: true }, withData), null);
  const marks = [{ region: 'hcp-mmp:left:8', color: 'blue' as const }];
  assert.equal(highlightStatus(shown, { ...withData, highlights: marks }), 'aside');
  assert.equal(
    highlightStatus({ ...shown, layersShown: false }, { ...sources, layers, highlights: marks }),
    'drawn',
  );
});

test('STAGE-74 · the layer key lists the four steps darkest first, outlining any nothing carries', () => {
  const state: KeyState = { ...base, explorer: 'anatomy', atlas: 'hcp-mmp', layersShown: true };
  const legend = legendFor(
    { ...state, paint: paintFor(state, { ...sources, layers }) },
    { ...sources, layers },
  )!;
  assert.equal(legend.map, 'layers');
  assert.equal(legend.title, 'Layer IV’s share of the cortex’s thickness');
  assert.equal(legend.pickable, false);
  assert.deepEqual(
    legend.rows.map(({ label, color, absent }) => [label, color, absent]),
    [
      ['12% or more', [4, 4, 4], true],
      ['9% to 12%', [3, 3, 3], false],
      ['7% to 9%', [2, 2, 2], false],
      ['0% to 7%', [1, 1, 1], true],
    ],
  );
  assert.match(legend.note, /darker is more\. Tissue-coloured areas have no six layers/);
  const french = legendFor(
    { ...state, lang: 'fr', paint: paintFor(state, { ...sources, layers }) },
    { ...sources, layers },
  )!;
  assert.equal(french.rows[2]!.label, 'de 7 % à 9 %');
});

test('a paint names its tab by its id', () => {
  assert.equal(paintKind(paintOf('function:language')), 'function');
  assert.equal(paintKind(paintOf('deficit:aphasia:naming')), 'deficit');
  assert.equal(paintKind(null), null);
});

test('a finding none of whose regions is drawn coloured is keyed as absent, and the note says why', () => {
  const state: KeyState = {
    ...base,
    explorer: 'deficits',
    paint: clinical.paint('aphasia').paint,
  };
  assert.deepEqual(
    legendFor(state, sources)!.rows.map((row) => row.absent),
    [false, false],
  );
  drawn.delete('destrieux:left:2');
  const hidden = legendFor(state, sources)!;
  assert.deepEqual(
    hidden.rows.map((row) => row.absent),
    [false, true],
  );
  assert.match(hidden.note, /outlined finding has no region coloured/);
  const picked = legendFor(
    { ...state, selectedFinding: 'naming', paint: clinical.paint('aphasia', 'naming').paint },
    sources,
  )!;
  assert.deepEqual(
    picked.rows.map((row) => row.absent),
    [false, false],
    'a finding not picked is muted, not absent',
  );
  drawn.add('destrieux:left:2');
});

test('the deficit key distinguishes a visible shared region from a hidden region', () => {
  const shared = { ...associations[1]!, mappings: associations[0]!.mappings };
  const hidden = { ...associations[1]!, id: 'hidden' };
  const catalog = {
    ...clinical,
    paint: (id: string, finding: string | null = null) =>
      findingPaint(id, [associations[0]!, shared, hidden], finding),
  } as unknown as ClinicalCatalog;
  const state = { ...base, explorer: 'deficits' as const };
  const catalogSources = {
    ...sources,
    clinical: catalog,
    drawn: (id: string) => id.endsWith(':1'),
  };
  const key = legendFor({ ...state, paint: catalog.paint('aphasia').paint }, catalogSources)!;
  assert.deepEqual(
    key.rows.map(({ shared, absent }) => [Boolean(shared), absent]),
    [
      [false, false],
      [true, false],
      [false, true],
    ],
  );
  const selected = {
    ...state,
    selectedFinding: shared.id,
    paint: catalog.paint('aphasia', shared.id).paint,
  };
  const picked = legendFor(selected, catalogSources)!;
  assert.equal(picked.rows[1]!.pressed, true);
  assert.equal(picked.rows[1]!.absent, false);
  assert.equal(Boolean(picked.rows[1]!.shared), false);
});

describe('the published cdmd functions and deficits', () => {
  const manifest = readModel<Manifest>('cdmd/manifest.json');
  const regionsById = new Map(manifest.regions.map((region) => [region.id, region]));
  const load = <T>(path: string) => readModel<T>(`cdmd/${path}`);
  let published: ReturnType<typeof validateNeuropsychDomains>;
  let data: ClinicalData;
  let catalog: ClinicalCatalog;
  let both: { domains: typeof published; clinical: ClinicalCatalog };
  beforeAll(() => {
    published = validateNeuropsychDomains(
      load<NeuropsychDomains>(manifest.neuropsych_domains!.file),
      regionsById,
      load<NeurosynthTerms>(manifest.neurosynth_terms!.file),
    );
    data = readRepoYaml<ClinicalData>('data/neuropsychology.yaml');
    catalog = createClinicalCatalog(data, manifest, published.units);
    both = { domains: published, clinical: catalog };
  });
  const functionState = (selectedFunction: string, lang: 'en' | 'fr' = 'en'): KeyState => ({
    surfaceColor: 'tissue',
    focused: false,
    ghostedAround: null,
    explorer: 'functions',
    atlas: 'hcp-mmp',
    selectedFunction,
    selectedDeficit: null,
    selectedFinding: null,
    paintLifted: false,
    paintFrom: null,
    connectivitySeed: null,
    disorderShown: null,
    lang,
    lesson: { circuit: null },
  });

  test('STATE-54 a function keys its z bands, strongest first, in the language of the reader', () => {
    const state = functionState('language', 'fr');
    const paint = paintFor(state, both)!;
    const fr = legendFor({ ...state, paint }, { ...both, drawn: () => true })!;
    assert.equal(fr.title, 'Langage');
    assert.equal(fr.pickable, false);
    assert.deepEqual(
      fr.rows.map((row) => [row.label, row.color]),
      [
        ['z ≥ 10', [10, 62, 125]],
        ['z 5 à 10', [43, 131, 199]],
        ['z 3 à 5', [150, 200, 240]],
      ],
    );
    const en = legendFor({ ...state, lang: 'en', paint }, { ...both, drawn: () => true })!;
    assert.deepEqual(
      en.rows.map((row) => row.label),
      ['z ≥ 10', 'z 5 to 10', 'z 3 to 5'],
    );
    assert.equal(
      en.note,
      'Mean consistency z per area; darker is more consistent. Tissue-coloured areas fall below 3.',
    );
  });

  test('a raised threshold is the floor the key’s note names, in the reader’s notation', () => {
    const state = { ...functionState('language', 'fr'), paintFrom: 3.5 };
    const note = (lang: 'en' | 'fr') =>
      legendFor({ ...state, lang, paint: paintFor(state, both) }, { ...both, drawn: () => true })!
        .note;
    assert.equal(
      note('en'),
      'Mean consistency z per area; darker is more consistent. Tissue-coloured areas fall below 3.5.',
    );
    assert.match(note('fr')!, /sont sous 3,5\.$/);
  });

  test('STATE-54 the overview keys the eleven overview functions, none pressed', () => {
    const state = functionState('all');
    const overview = legendFor(
      { ...state, paint: paintFor(state, both) },
      { ...both, drawn: () => true },
    )!;
    assert.equal(overview.title, 'Neuropsychological functions');
    assert.equal(
      overview.note,
      'Each area shows its strongest function; tissue-coloured areas reach none. Choose one to see all its areas.',
    );
    assert.equal(overview.rows.length, 11);
    assert.equal(overview.rows[0]!.id, 'executive');
    assert.equal(overview.rows[10]!.id, 'emotion');
    assert.ok(overview.rows.every((row) => row.pressed === false));
  });

  test('under the T1 colour the key says the scan shows where nothing is painted, in both languages', () => {
    const state = { ...functionState('all'), surfaceColor: 'mri' as const };
    const note = (lang: 'en' | 'fr') =>
      legendFor({ ...state, lang, paint: paintFor(state, both) }, { ...both, drawn: () => true })!
        .note;
    assert.equal(
      note('en'),
      'Each area shows its strongest function; areas where the scan shows reach none. Choose one to see all its areas.',
    );
    assert.equal(
      note('fr'),
      'Chaque aire montre sa fonction la plus forte\u202f; les aires où l’IRM reste visible n’en atteignent aucune. Choisissez-en une pour voir toutes ses aires.',
    );
  });

  test('a see-through paint’s ghost makes the key name grey areas, and the scan still wins', () => {
    const state = {
      ...functionState('compare:working-memory,attention'),
      ghostedAround: new Set<string>(),
    };
    const note = (over: Partial<KeyState>) => {
      const shown = { ...state, ...over };
      return legendFor({ ...shown, paint: paintFor(shown, both) }, { ...both, drawn: () => true })!
        .note;
    };
    assert.equal(
      note({}),
      'Areas each function reaches at z\u00a0≥\u00a03, and those both reach. Grey areas reach neither.',
    );
    assert.equal(
      note({ ghostedAround: null, focused: true, lang: 'fr' }),
      'Les aires que chaque fonction atteint à z\u00a0≥\u00a03, et celles que les deux atteignent. Les aires grises n’en atteignent aucune.',
    );
    assert.match(note({ surfaceColor: 'mri' }), /Areas where the scan shows reach neither/);
    assert.match(note({ ghostedAround: null }), /Tissue-coloured areas reach neither/);
  });

  test('a deficit’s FreeSurfer structures are painted and keyed on their teaching-set stand-ins', () => {
    const state: KeyState = {
      surfaceColor: 'tissue',
      focused: false,
      ghostedAround: null,
      explorer: 'deficits',
      atlas: 'destrieux',
      selectedFunction: null,
      selectedDeficit: 'somatoparaphrenia',
      selectedFinding: null,
      paintLifted: false,
      paintFrom: null,
      connectivitySeed: null,
      disorderShown: null,
      lang: 'en',
      lesson: { circuit: null },
    };
    const paint = paintFor(state, both)!;
    for (const structure of catalog.mappedRegions('somatoparaphrenia')) {
      for (const id of catalog.standIns(structure)) {
        assert.deepEqual(paint.colors.get(id), paint.colors.get(structure), id);
      }
    }
    assert.ok(paint.colors.has('learning:right:pallidum-internal'));
    const teachingOnly = (id: string) => id.startsWith('learning:');
    const legend = legendFor({ ...state, paint }, { ...both, drawn: teachingOnly })!;
    // Only the finding with no overlay is greyed.
    assert.deepEqual(
      legend.rows.map((row) => row.absent),
      [false, true],
    );
  });

  test('STATE-56 every function, term, deficit and finding has a paint and a key in both languages', () => {
    assert.equal(published.domains.length, 70);
    const terms = [...published.search!.terms.keys()];
    assert.equal(terms.length, 277);
    const everyDrawn = { ...both, drawn: () => true };
    for (const id of [ALL_DOMAINS, ...published.domains.map((d) => d.id), ...terms]) {
      const state = functionState(id);
      const paint = paintFor(state, both)!;
      assert.equal(paint.id, `function:${id}`, id);
      assert.equal(paintFor({ ...state, atlas: 'destrieux' }, both), null, id);
      if (id === ALL_DOMAINS) continue;
      for (const lang of ['en', 'fr'] as const) {
        const legend = legendFor({ ...state, lang, paint }, everyDrawn)!;
        assert.equal(legend.rows.length, 3, id);
      }
    }
    assert.equal(data.deficits.length, 177);
    for (const deficit of data.deficits) {
      const state: KeyState = {
        surfaceColor: 'tissue',
        focused: false,
        ghostedAround: null,
        explorer: 'deficits',
        atlas: 'destrieux',
        selectedFunction: null,
        selectedDeficit: deficit.id,
        selectedFinding: null,
        paintLifted: false,
        paintFrom: null,
        connectivitySeed: null,
        disorderShown: null,
        lang: 'en',
        lesson: { circuit: null },
      };
      const findings = catalog.paint(deficit.id).findings.map(({ association }) => association.id);
      for (const finding of [null, ...findings]) {
        const chosen = { ...state, selectedFinding: finding };
        const paint = paintFor(chosen, both)!;
        assert.equal(
          paint.id,
          finding ? `deficit:${deficit.id}:${finding}` : `deficit:${deficit.id}`,
        );
        assert.equal(paintFor({ ...chosen, paintLifted: true }, both), null);
        for (const lang of ['en', 'fr'] as const) {
          const legend = legendFor({ ...chosen, lang, paint }, everyDrawn)!;
          assert.equal(legend.title, deficit.name[lang === 'en' ? 'en' : 'fr'], deficit.id);
          assert.equal(legend.rows.length, findings.length, deficit.id);
        }
      }
    }
  });
});

describe('the lesion', () => {
  const lesion = {
    kind: 'deficits' as const,
    paint: paintOf('lesion:-45,-25,30:15'),
    rows: [
      { id: 'naming', color: [57, 135, 229] as const, title: { en: 'Naming', fr: 'Dénomination' } },
    ],
  };
  const anatomy: KeyState = { ...base, explorer: 'anatomy' };

  test('paints the findings near it while Anatomy, where its report is, is in front', () => {
    assert.equal(paintFor(anatomy, { ...sources, lesion })!.id, 'lesion:-45,-25,30:15');
    assert.equal(paintFor({ ...anatomy, paintLifted: true }, { ...sources, lesion }), null);
    assert.equal(paintFor(anatomy, { ...sources, lesion: null }), null);
    // Another tab's own paint is that tab's.
    assert.equal(paintFor(base, { ...sources, lesion })!.id, 'function:all');
  });

  test('keys each coloured finding by its title', () => {
    const legend = legendFor(
      { ...anatomy, lang: 'fr', paint: lesion.paint },
      { ...sources, lesion },
    );
    assert.equal(legend!.map, 'lesion');
    assert.equal(legend!.pickable, false);
    assert.deepEqual(legend!.rows, [
      { id: 'naming', color: [57, 135, 229], label: 'Dénomination', pressed: false },
    ]);
  });
});

describe('the reader’s highlights', () => {
  const marks: HighlightedRegion[] = [
    { region: 'destrieux:left:1', color: 'blue' },
    { region: 'destrieux:left:9', color: 'violet' },
  ];
  const withMarks = { ...sources, highlights: marks };
  const anatomy: KeyState = { ...base, explorer: 'anatomy' };
  const shownId = 'highlight:destrieux:left:1:blue,destrieux:left:9:violet';

  test('STATE-69 · the six highlight colours are the deficits’ finding colours, in their order', () => {
    assert.deepEqual(HIGHLIGHT_RGB, {
      blue: [57, 135, 229],
      raspberry: [213, 81, 129],
      green: [0, 131, 0],
      amber: [201, 133, 0],
      violet: [98, 80, 214],
      pink: [232, 123, 164],
    });
  });

  test('STATE-68 · they are painted alone, each region in its colour, while nothing else is', () => {
    const paint = paintFor(anatomy, withMarks)!;
    assert.equal(paint.id, shownId);
    assert.deepEqual(
      [...paint.colors],
      [
        ['destrieux:left:1', [57, 135, 229]],
        ['destrieux:left:9', [98, 80, 214]],
      ],
    );
    assert.equal(highlightStatus(anatomy, withMarks), 'drawn');
    // A tab with nothing open shows them too.
    assert.equal(paintFor({ ...base, selectedFunction: null }, withMarks)!.id, shownId);
    assert.equal(paintFor({ ...base, explorer: 'circuits' }, withMarks)!.id, shownId);
    assert.equal(paintFor(anatomy, sources), null);
  });

  test('STATE-68 · a function opened sets them aside without a trace, and closing it gives them back', () => {
    // A highlight on an area the function paints: the function's paint is its own, unchanged.
    const onArea = {
      ...sources,
      highlights: [{ region: 'hcp-mmp:left:1', color: 'pink' as const }],
    };
    const opened = { ...base, selectedFunction: 'memory' };
    const alone = paintFor(opened, sources)!;
    assert.equal(alone.colors.has('hcp-mmp:left:1'), true);
    assert.deepEqual(paintFor(opened, onArea), alone);
    assert.equal(highlightStatus(opened, onArea), 'aside');
    // Open on an atlas it has no areas on, it paints nothing, and they stay aside.
    assert.equal(paintFor({ ...opened, atlas: 'destrieux' }, onArea), null);
    // Closed: the same highlights, painted as before.
    assert.equal(
      paintFor({ ...opened, selectedFunction: null }, onArea)!.id,
      'highlight:hcp-mmp:left:1:pink',
    );
  });

  test('STATE-68 · a deficit, a lesson, a map, an Anatomy paint or the reader’s map sets them aside too', () => {
    assert.equal(paintFor({ ...base, explorer: 'deficits' }, withMarks)!.id, 'deficit:aphasia');
    assert.equal(
      paintFor({ ...base, explorer: 'deficits', selectedDeficit: null }, withMarks)!.id,
      shownId,
    );
    assert.equal(
      paintFor({ ...base, explorer: 'circuits', lesson: { circuit: 'v' } }, withMarks),
      null,
    );
    assert.equal(
      paintFor(
        { ...base, explorer: 'circuits', lesson: { circuit: null, map: 'visual-field' } },
        withMarks,
      ),
      null,
    );
    const lesion = { kind: 'deficits' as const, paint: paintOf('lesion:x'), rows: [] };
    assert.equal(paintFor(anatomy, { ...withMarks, lesion })!.id, 'lesion:x');
    assert.equal(highlightStatus(anatomy, { ...withMarks, lesion }), 'aside');
    assert.equal(paintFor(anatomy, { ...withMarks, mapsDrawn: 1 }), null);
    assert.equal(paintFor(anatomy, { ...withMarks, mapsDrawn: 2 }), null);
  });

  test('STATE-68 · a masthead choice lifts them as it lifts any paint; behind evidence they are aside', () => {
    assert.equal(paintFor({ ...anatomy, paintLifted: true }, withMarks), null);
    assert.equal(highlightStatus({ ...anatomy, paintLifted: true }, withMarks), 'lifted');
    assert.equal(highlightStatus({ ...base, paintLifted: true }, withMarks), 'aside');
  });

  test('STATE-68 · an Anatomy paint a masthead choice lifted holds them aside no longer: they are lifted with it', () => {
    const painted: KeyState = { ...anatomy, atlas: 'hcp-mmp', layersShown: true };
    const both = { ...withMarks, layers };
    assert.equal(highlightStatus(painted, both), 'aside');
    assert.equal(highlightStatus({ ...painted, paintLifted: true }, both), 'lifted');
    const lesion = { kind: 'deficits' as const, paint: paintOf('lesion:x'), rows: [] };
    assert.equal(
      highlightStatus({ ...anatomy, paintLifted: true }, { ...withMarks, lesion }),
      'lifted',
    );
  });

  test('STAGE-72 · the key is the reader’s: titled so, every region named, one not drawn outlined', () => {
    const paint = paintFor(anatomy, withMarks)!;
    const names: Record<string, string> = {
      'destrieux:left:1': 'Region one, left',
      'destrieux:left:9': 'Region nine, left',
    };
    const named = (id: string) => names[id]!;
    // `drawn` holds destrieux:left:1 and :2, so :9 is not drawn in this view.
    assert.deepEqual(legendFor({ ...anatomy, paint }, { ...sources, named }), {
      map: 'highlight',
      title: 'Your highlights',
      note: 'Regions you highlighted, in the colours you chose: your own marks, not data. Tissue-coloured regions are not highlighted. An outlined region is not drawn in this view.',
      pickable: false,
      rows: [
        {
          id: 'destrieux:left:1',
          color: [57, 135, 229],
          label: 'Region one, left',
          pressed: false,
          absent: false,
        },
        {
          id: 'destrieux:left:9',
          color: [98, 80, 214],
          label: 'Region nine, left',
          pressed: false,
          absent: true,
        },
      ],
    });
    const french = legendFor(
      { ...anatomy, lang: 'fr', surfaceColor: 'mri', paint },
      { ...sources, named, drawn: () => true },
    )!;
    assert.equal(french.title, 'Vos surlignages');
    assert.equal(
      french.note,
      'Les régions que vous avez surlignées, dans les couleurs choisies : vos marques personnelles, pas des données. Les régions où l’IRM reste visible ne sont pas surlignées.',
    );
  });
});
