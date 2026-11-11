import assert from 'node:assert/strict';
import { beforeAll, describe, test } from 'vitest';
import type { Manifest, Paint, SurfaceColor } from '../../types/index.ts';
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
import { legendFor, paintFor, paintKind } from './paint.ts';
import type { PaintState } from './paint.ts';

/** What the key reads: the paint's state and the surface colour under it. */
type KeyState = PaintState & { surfaceColor: SurfaceColor };

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
  explorer: 'functions',
  atlas: 'hcp-mmp',
  selectedFunction: 'all',
  selectedDeficit: 'aphasia',
  selectedFinding: null,
  paintLifted: false,
  paintFrom: null,
  connectivitySeed: null,
  lang: 'en',
};
const paintOf = (id: string): Paint => ({ id, colors: new Map() });

test('a tab paints only while it is in front, on the atlas its map is defined on, and not once lifted', () => {
  assert.equal(paintFor(base, sources)!.id, 'function:all');
  assert.equal(paintFor({ ...base, atlas: 'destrieux' }, sources), null);
  // FUNC-46: a listed atlas takes the paint on its own areas (supervisor review 3.1).
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
  assert.equal(paintFor({ ...seeded, explorer: 'functions' }, withData)!.id, 'function:all');
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
    explorer: 'functions',
    atlas: 'hcp-mmp',
    selectedFunction,
    selectedDeficit: null,
    selectedFinding: null,
    paintLifted: false,
    paintFrom: null,
    connectivitySeed: null,
    lang,
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

  test('a deficit’s FreeSurfer structures are painted and keyed on their teaching-set stand-ins', () => {
    const state: KeyState = {
      surfaceColor: 'tissue',
      explorer: 'deficits',
      atlas: 'destrieux',
      selectedFunction: null,
      selectedDeficit: 'dystonia',
      selectedFinding: null,
      paintLifted: false,
      paintFrom: null,
      connectivitySeed: null,
      lang: 'en',
    };
    const paint = paintFor(state, both)!;
    for (const structure of catalog.mappedRegions('dystonia')) {
      for (const id of catalog.standIns(structure)) {
        assert.deepEqual(paint.colors.get(id), paint.colors.get(structure), id);
      }
    }
    assert.ok(paint.colors.has('learning:left:pallidum-internal'));
    const teachingOnly = (id: string) => id.startsWith('learning:');
    const legend = legendFor({ ...state, paint }, { ...both, drawn: teachingOnly })!;
    assert.deepEqual(
      legend.rows.map((row) => row.absent),
      legend.rows.map(() => false),
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
    assert.equal(data.deficits.length, 131);
    for (const deficit of data.deficits) {
      const state: KeyState = {
        surfaceColor: 'tissue',
        explorer: 'deficits',
        atlas: 'destrieux',
        selectedFunction: null,
        selectedDeficit: deficit.id,
        selectedFinding: null,
        paintLifted: false,
        paintFrom: null,
        connectivitySeed: null,
        lang: 'en',
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
