import { test } from 'vitest';
import assert from 'node:assert/strict';
import type { Region } from '../../types/index.ts';
import {
  ALL_DOMAINS,
  COMPARE_COLORS,
  comparedAreas,
  domainAreas,
  domainPaint,
  domainRecord,
  domainsOf,
  functionsAt,
  paintAtlas,
  domainStudies,
  drawnAs,
  functionName,
  groupedDomains,
  matchingTerms,
  nearestName,
  neurosynthPage,
  overviewDomains,
  revealedRegions,
  scoredRegion,
  SHARED_COLOR,
  shownDomain,
  validComparison,
  validateNeuropsychDomains,
  type TermRecord,
} from './neuropsych-domains.ts';
import { nearest } from './nearest.ts';
import { asRegion } from './test-support.ts';

// The fixtures are mutated into invalid shapes on purpose, so they are not typed as the real thing.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fixture = any;

const regions = new Map<string, Region>([
  ['hcp-mmp:left:1', asRegion({ atlas: 'hcp-mmp', kind: 'cortex' })],
  ['hcp-mmp:right:1', asRegion({ atlas: 'hcp-mmp', kind: 'cortex' })],
  ['destrieux:left:1', asRegion({ atlas: 'destrieux' })],
  ['julich:left:2', asRegion({ id: 'julich:left:2', atlas: 'julich', kind: 'cortex' })],
  ['julich:left:3', asRegion({ id: 'julich:left:3', atlas: 'julich', kind: 'cortex' })],
  ['aseg:left:18', asRegion({ atlas: 'aseg', kind: 'structure', source_name: 'Left-Amygdala' })],
  [
    'aseg:left:4',
    asRegion({ atlas: 'aseg', kind: 'structure', source_name: 'Left-Lateral-Ventricle' }),
  ],
  [
    'learning:left:amygdala',
    asRegion({ id: 'learning:left:amygdala', atlas: 'learning', kind: 'structure' }),
  ],
  [
    'learning:left:thalamus',
    asRegion({ id: 'learning:left:thalamus', atlas: 'learning', kind: 'structure' }),
  ],
]);
const partition = (): Fixture => ({
  id: 'neuropsych-domains',
  atlas: 'hcp-mmp',
  structure_atlas: 'aseg',
  structures: ['Left-Amygdala'],
  unit_atlas: 'learning',
  units: { 'learning:left:amygdala': 'aseg:left:18' },
  threshold_z: 3,
  z_scale: [
    { from: 3, color: [30, 30, 30] },
    { from: 5, color: [50, 50, 50] },
    { from: 10, color: [90, 90, 90] },
  ],
  groups: [
    { id: 'cognition', name: 'Cognition', name_fr: 'Cognition' },
    { id: 'perception', name: 'Perception', name_fr: 'Perception' },
  ],
  domains: [
    {
      id: 'language',
      term: 'language',
      group: 'cognition',
      name: 'Language',
      name_fr: 'Langage',
      overview: true,
      color: [1, 2, 3],
    },
    {
      id: 'memory',
      term: 'episodic memory',
      group: 'cognition',
      name: 'Memory',
      name_fr: 'Mémoire',
      overview: true,
      color: [4, 5, 6],
    },
    {
      id: 'visual',
      term: 'visual',
      group: 'perception',
      name: 'Visual',
      name_fr: 'Visuel',
      overview: true,
      color: [7, 8, 9],
    },
  ],
  lesion_checks: { language: [], memory: [], visual: [] },
  neurosynth_org_missing: ['visual'],
  derivation: { studies: { language: 1101, memory: 332, visual: 3110 } },
  regions: {
    'hcp-mmp:left:1': [
      { domain: 'memory', z: 7.5 },
      { domain: 'language', z: 3.2 },
    ],
    'hcp-mmp:right:1': [{ domain: 'language', z: 4.1 }],
    'aseg:left:18': [{ domain: 'memory', z: 3.5 }],
  },
  region_atlases: ['julich'],
  atlas_regions: {
    julich: {
      'julich:left:2': [
        { domain: 'visual', z: 4.5 },
        { domain: 'language', z: 6.1 },
      ],
    },
  },
});

test('an area lists its domains strongest first and is drawn as the strongest unless one is picked', () => {
  const published = validateNeuropsychDomains(partition(), regions);
  assert.deepEqual(
    domainsOf(published, 'hcp-mmp:left:1').map((record) => [record.id, record.z]),
    [
      ['memory', 7.5],
      ['language', 3.2],
    ],
  );
  assert.equal(shownDomain(published, 'hcp-mmp:left:1', null)!.id, 'memory');
  assert.equal(shownDomain(published, 'hcp-mmp:left:1', 'language')!.id, 'language');
  assert.deepEqual(domainsOf(published, 'hcp-mmp:left:2'), []);
  assert.equal(shownDomain(published, 'hcp-mmp:left:2', null), null);
});

test('FUNC-40 · a region’s functions are listed by raw z, highest first, on HCP-MMP, structures and listed atlases', () => {
  const published = validateNeuropsychDomains(partition(), regions);
  // Published by share of peak (memory, language); listed by z.
  assert.deepEqual(
    functionsAt(published, 'hcp-mmp:left:1').map((record) => [record.id, record.z]),
    [
      ['memory', 7.5],
      ['language', 3.2],
    ],
  );
  assert.deepEqual(
    functionsAt(published, 'julich:left:2').map((record) => record.id),
    ['language', 'visual'],
  );
  assert.deepEqual(
    functionsAt(published, 'learning:left:amygdala').map((record) => record.id),
    ['memory'],
  );
  // A listed atlas's region that reaches nothing is scored, and has no function.
  assert.equal(scoredRegion(published, regions.get('julich:left:3')), true);
  assert.deepEqual(functionsAt(published, 'julich:left:3'), []);
  // An atlas not listed is not scored.
  assert.equal(scoredRegion(published, regions.get('destrieux:left:1')), false);
  // The listed atlases add nothing to a function's areas, its paint or its counts.
  assert.ok(
    domainAreas(published, 'language').every(({ region }) => !region.startsWith('julich:')),
  );
});

test('FUNC-46 · a curated function or the overview paints on a listed atlas’s own areas; terms and comparisons stay on HCP-MMP', () => {
  const published = validateNeuropsychDomains(partition(), regions, terms());
  assert.equal(paintAtlas(published, 'language', 'julich'), 'julich');
  assert.equal(paintAtlas(published, ALL_DOMAINS, 'julich'), 'julich');
  assert.equal(paintAtlas(published, 'language', 'destrieux'), 'hcp-mmp');
  // A searched term paints on its own table there, with the structures it reaches.
  assert.equal(paintAtlas(published, 'term:fear', 'julich'), 'julich');
  assert.deepEqual(domainAreas(published, 'term:fear', 'julich'), [
    { region: 'aseg:left:18', z: 9.1 },
    { region: 'julich:left:3', z: 5.5 },
  ]);
  assert.equal(paintAtlas(published, 'compare:language,memory', 'julich'), 'hcp-mmp');
  // On Julich-Brain: its own areas, with the structures and the teaching units carrying them.
  assert.deepEqual(domainAreas(published, 'language', 'julich'), [
    { region: 'julich:left:2', z: 6.1 },
  ]);
  assert.deepEqual(domainAreas(published, 'memory', 'julich'), [
    { region: 'aseg:left:18', z: 3.5 },
  ]);
  assert.deepEqual(
    [...domainPaint(published, 'memory', 'julich').colors],
    [
      ['aseg:left:18', [30, 30, 30]],
      ['learning:left:amygdala', [30, 30, 30]],
    ],
  );
  // The overview takes each area's first overview function, as on HCP-MMP.
  assert.deepEqual(
    domainPaint(published, ALL_DOMAINS, 'julich').colors.get('julich:left:2'),
    [7, 8, 9],
  );
  assert.ok(
    [...domainPaint(published, ALL_DOMAINS, 'julich').colors.keys()].every(
      (id) => !id.startsWith('hcp-mmp:'),
    ),
  );
  assert.throws(() => domainPaint(published, 'compare:language,memory', 'julich'), /HCP-MMP/);
  // Term tables missing, on an unlisted atlas, or naming a term the search does not offer, are refused.
  for (const change of [
    (p: Fixture) => (p.atlases = {}),
    (p: Fixture) => (p.atlases = { schaefer: p.atlases.julich }),
    (p: Fixture) => (p.atlases.julich.terms.praxis = []),
    (p: Fixture) => (p.atlases.julich.terms.fear = [[1, 2.5]]),
  ]) {
    const broken = terms();
    change(broken);
    assert.throws(() => validateNeuropsychDomains(partition(), regions, broken), /Neurosynth term/);
  }
});

test('FUNC-49 · a single function or term paints only the areas at or above the reader’s threshold', () => {
  const published = validateNeuropsychDomains(partition(), regions, terms());
  assert.deepEqual(
    [...domainPaint(published, 'memory', 'hcp-mmp', 5).colors.keys()],
    ['hcp-mmp:left:1'],
  );
  assert.deepEqual(
    [...domainPaint(published, 'term:fear', 'hcp-mmp', 5).colors.keys()],
    ['aseg:left:18', 'learning:left:amygdala'],
  );
  // The stage replaces a paint only under a new id, so each threshold names its own.
  assert.equal(domainPaint(published, 'memory', 'hcp-mmp').id, 'function:memory');
  assert.equal(domainPaint(published, 'memory', 'hcp-mmp', 5).id, 'function:memory:z5');
  assert.equal(domainPaint(published, 'term:fear', 'hcp-mmp', 5.5).id, 'function:term:fear:z5.5');
  // The overview and a comparison keep the published threshold.
  assert.throws(() => domainPaint(published, ALL_DOMAINS, 'hcp-mmp', 5), /threshold/);
  assert.throws(() => domainPaint(published, 'compare:language,memory', 'hcp-mmp', 5), /threshold/);
});

test('a listed atlas’s assignment off that atlas, unlisted or below the threshold is rejected', () => {
  for (const change of [
    (p: Fixture) => {
      p.atlas_regions.julich['destrieux:left:1'] = [{ domain: 'memory', z: 4 }];
    },
    (p: Fixture) => {
      p.region_atlases = [];
    },
    (p: Fixture) => {
      p.atlas_regions.julich['julich:left:2'][0].z = 2.5;
    },
  ]) {
    const broken = partition();
    change(broken);
    assert.throws(
      () => validateNeuropsychDomains(broken, regions),
      /Invalid neuropsychological-domain/,
    );
  }
});

test('a domain assigned below the threshold, off its atlas or unknown is rejected', () => {
  for (const [change, message] of [
    [
      (p: Fixture) => {
        p.regions['hcp-mmp:left:1'][1].z = 2.9;
      },
      /assignment: hcp-mmp:left:1/,
    ],
    [
      (p: Fixture) => {
        p.regions['destrieux:left:1'] = [{ domain: 'memory', z: 4 }];
      },
      /assignment: destrieux:left:1/,
    ],
    [
      (p: Fixture) => {
        p.regions['hcp-mmp:left:1'][0].domain = 'praxis';
      },
      /assignment: hcp-mmp:left:1/,
    ],
    [
      (p: Fixture) => {
        delete p.lesion_checks.memory;
      },
      /domain: memory/,
    ],
    [
      (p: Fixture) => {
        p.domains[2].group = 'action';
      },
      /domain: visual/,
    ],
    [
      (p: Fixture) => {
        p.regions['aseg:left:4'] = [{ domain: 'memory', z: 4 }];
      },
      /assignment: aseg:left:4/,
    ],
    [
      (p: Fixture) => {
        p.units['learning:left:thalamus'] = 'aseg:left:4';
      },
      /teaching unit: learning:left:thalamus/,
    ],
    [
      (p: Fixture) => {
        p.units['hcp-mmp:right:1'] = 'aseg:left:18';
      },
      /teaching unit: hcp-mmp:right:1/,
    ],
    [
      (p: Fixture) => {
        p.units['learning:left:thalamus'] = 'hcp-mmp:left:1';
      },
      /teaching unit: learning:left:thalamus/,
    ],
    [
      (p: Fixture) => {
        delete p.units;
      },
      /Invalid neuropsychological-domain partition/,
    ],
    [
      (p: Fixture) => {
        p.domains[2].id = ALL_DOMAINS;
      },
      /domain: all/,
    ],
    [
      (p: Fixture) => {
        p.z_scale[0].from = 2;
      },
      /z scale/,
    ],
    [
      (p: Fixture) => {
        p.z_scale[2].from = 5;
      },
      /z scale/,
    ],
    [
      (p: Fixture) => {
        p.groups.push({ id: 'cognition', name: 'Again', name_fr: 'Encore' });
      },
      /group: cognition/,
    ],
    [
      (p: Fixture) => {
        delete p.domains[2].overview;
      },
      /domain: visual/,
    ],
    [
      (p: Fixture) => {
        delete p.derivation.studies.visual;
      },
      /domain: visual/,
    ],
    [
      (p: Fixture) => {
        for (const domain of p.domains) domain.overview = false;
      },
      /No neuropsychological domain is in the overview/,
    ],
  ] as [(p: Fixture) => void, RegExp][]) {
    const broken = partition();
    change(broken);
    assert.throws(() => validateNeuropsychDomains(broken, regions), message);
  }
});

test('the list groups domains in authored order and finds them by either name or by term, accents aside', () => {
  const published = validateNeuropsychDomains(partition(), regions);
  assert.deepEqual(
    groupedDomains(published, '', 'fr').map((entry) => [
      entry.name,
      entry.domains.map((d) => d.id),
    ]),
    [
      ['Cognition', ['language', 'memory']],
      ['Perception', ['visual']],
    ],
  );
  assert.deepEqual(
    groupedDomains(published, 'EPISODIC', 'en').map((entry) => entry.domains.map((d) => d.id)),
    [['memory']],
  );
  assert.deepEqual(
    groupedDomains(published, 'memoire', 'en').map((entry) => entry.domains.map((d) => d.id)),
    [['memory']],
  );
  assert.deepEqual(groupedDomains(published, 'praxis', 'en'), []);
});

test('a domain lists its every area strongest first, overlaps included', () => {
  const published = validateNeuropsychDomains(partition(), regions);
  assert.deepEqual(domainAreas(published, 'language'), [
    { region: 'hcp-mmp:right:1', z: 4.1 },
    { region: 'hcp-mmp:left:1', z: 3.2 },
  ]);
  assert.deepEqual(domainAreas(published, 'visual'), []);
});

test('the overview paints each area its strongest domain, and one domain paints its every area by z band', () => {
  const published = validateNeuropsychDomains(partition(), regions);
  const all = domainPaint(published, ALL_DOMAINS);
  assert.equal(all.id, 'function:all');
  assert.deepEqual(
    [...all.colors],
    [
      ['hcp-mmp:left:1', [4, 5, 6]],
      ['hcp-mmp:right:1', [1, 2, 3]],
      ['aseg:left:18', [4, 5, 6]],
      ['learning:left:amygdala', [4, 5, 6]],
    ],
  );
  assert.deepEqual(
    [...domainPaint(published, 'language').colors],
    [
      ['hcp-mmp:right:1', [30, 30, 30]],
      ['hcp-mmp:left:1', [30, 30, 30]],
    ],
  );
  assert.deepEqual(
    [...domainPaint(published, 'memory').colors],
    [
      ['hcp-mmp:left:1', [50, 50, 50]],
      ['aseg:left:18', [30, 30, 30]],
      ['learning:left:amygdala', [30, 30, 30]],
    ],
  );
  assert.equal(domainPaint(published, 'visual').colors.size, 0);
  assert.throws(
    () => domainPaint(published, 'praxis'),
    /Unknown neuropsychological domain: praxis/,
  );
});

test('the overview draws an area as its strongest overview domain, passing over one shown only alone', () => {
  const published = partition();
  published.domains[1].overview = false;
  validateNeuropsychDomains(published, regions);
  assert.deepEqual(
    overviewDomains(published).map((domain) => domain.id),
    ['language', 'visual'],
  );
  // Memory is hcp-mmp:left:1's strongest domain, but not an overview one.
  assert.equal(shownDomain(published, 'hcp-mmp:left:1', null)!.id, 'language');
  assert.equal(shownDomain(published, 'hcp-mmp:left:1', 'memory')!.id, 'memory');
  assert.deepEqual(
    [...domainPaint(published, ALL_DOMAINS).colors.values()],
    [
      [1, 2, 3],
      [1, 2, 3],
    ],
  );
});

test('a sampled structure is scored like an area; another structure, or another atlas, is not', () => {
  const published = validateNeuropsychDomains(partition(), regions);
  assert.equal(scoredRegion(published, regions.get('aseg:left:18')), true);
  assert.equal(scoredRegion(published, regions.get('aseg:left:4')), false);
  assert.equal(scoredRegion(published, regions.get('hcp-mmp:left:1')), true);
  assert.equal(scoredRegion(published, regions.get('destrieux:left:1')), false);
  assert.deepEqual(domainAreas(published, 'memory'), [
    { region: 'hcp-mmp:left:1', z: 7.5 },
    { region: 'aseg:left:18', z: 3.5 },
  ]);
  assert.deepEqual(domainPaint(published, 'memory').colors.get('aseg:left:18'), [30, 30, 30]);
});

test('a teaching unit has the domains of the structure it lies in; one carrying none has none', () => {
  const published = validateNeuropsychDomains(partition(), regions);
  assert.equal(scoredRegion(published, regions.get('learning:left:amygdala')), true);
  assert.equal(scoredRegion(published, regions.get('learning:left:thalamus')), false);
  assert.deepEqual(
    domainsOf(published, 'learning:left:amygdala'),
    domainsOf(published, 'aseg:left:18'),
  );
  assert.equal(shownDomain(published, 'learning:left:amygdala', null)!.id, 'memory');
  assert.deepEqual(domainsOf(published, 'learning:left:thalamus'), []);
  // The profile lists the structure measured, not the units drawn for it.
  assert.deepEqual(
    domainAreas(published, 'memory').map(({ region }) => region),
    ['hcp-mmp:left:1', 'aseg:left:18'],
  );
});

test('a function’s structures are revealed on the teaching set unless FreeSurfer’s segmentation is shown', () => {
  const published = validateNeuropsychDomains(partition(), regions);
  const memory = domainPaint(published, 'memory');
  assert.deepEqual(revealedRegions(published, memory, 'aseg'), ['hcp-mmp:left:1', 'aseg:left:18']);
  for (const detail of ['learning', 'nextbrain']) {
    assert.deepEqual(revealedRegions(published, memory, detail), [
      'hcp-mmp:left:1',
      'learning:left:amygdala',
    ]);
    assert.deepEqual(drawnAs(published, 'aseg:left:18', detail), ['learning:left:amygdala']);
  }
  assert.deepEqual(drawnAs(published, 'aseg:left:18', 'aseg'), ['aseg:left:18']);
  assert.deepEqual(drawnAs(published, 'hcp-mmp:left:1', 'learning'), ['hcp-mmp:left:1']);
  // Both pallidal segments carry the pallidum's score, so a listed pallidum opens both.
  const split = partition();
  split.units['learning:left:thalamus'] = 'aseg:left:18';
  assert.deepEqual(drawnAs(validateNeuropsychDomains(split, regions), 'aseg:left:18', 'learning'), [
    'learning:left:amygdala',
    'learning:left:thalamus',
  ]);
});

const terms = (): Fixture => ({
  id: 'neurosynth-terms',
  atlas: 'hcp-mmp',
  structure_atlas: 'aseg',
  threshold_z: 3,
  derivation: {},
  regions: ['aseg:left:18', 'hcp-mmp:left:1', 'hcp-mmp:right:1'],
  terms: [
    [
      'fear',
      363,
      'function',
      [
        [0, 9.1],
        [1, 3.4],
      ],
    ],
    ['fear conditioning', 120, 'function', [[0, 6.2]]],
    ['conditioned fear', 90, 'function', [[2, 3]]],
    ['interference', 400, 'function', [[2, 3]]],
    ['aphasia', 205, 'population', [[1, 4]]],
  ],
  neurosynth_org_missing: ['interference'],
  atlases: {
    julich: {
      regions: ['julich:left:2', 'julich:left:3'],
      terms: {
        fear: [[1, 5.5]],
        'fear conditioning': [],
        'conditioned fear': [],
        interference: [],
        aphasia: [[0, 3.2]],
      },
    },
  },
});

test('FUNC-44 · a function or term links its neurosynth.org page by its Neurosynth term', () => {
  const published = validateNeuropsychDomains(partition(), regions, terms());
  assert.equal(
    neurosynthPage(published, 'memory'),
    'https://neurosynth.org/analyses/terms/episodic%20memory/',
  );
  assert.equal(
    neurosynthPage(published, 'term:fear conditioning'),
    'https://neurosynth.org/analyses/terms/fear%20conditioning/',
  );
  assert.throws(() => neurosynthPage(published, 'praxis'), /Unknown neuropsychological domain/);
});

test('FUNC-45 · a term neurosynth.org has no page for gets no link', () => {
  const published = validateNeuropsychDomains(partition(), regions, terms());
  assert.equal(neurosynthPage(published, 'visual'), null);
  assert.equal(neurosynthPage(published, 'term:interference'), null);
});

test('a missing-page list that is absent or names a term its file does not publish is rejected', () => {
  for (const change of [
    (p: Fixture) => {
      delete p.neurosynth_org_missing;
    },
    (p: Fixture) => {
      p.neurosynth_org_missing = ['praxis'];
    },
  ]) {
    const domains = partition();
    change(domains);
    assert.throws(
      () => validateNeuropsychDomains(domains, regions),
      /Invalid neuropsychological-domain partition/,
    );
    const searched = terms();
    change(searched);
    assert.throws(
      () => validateNeuropsychDomains(partition(), regions, searched),
      /Invalid Neurosynth term search/,
    );
  }
});

test('searched terms paint the regions they reach by z band and keep their kind', () => {
  const published = validateNeuropsychDomains(partition(), regions, terms());
  assert.equal(domainRecord(published, 'term:language'), null);
  assert.equal((domainRecord(published, 'term:aphasia') as TermRecord).kind, 'population');
  assert.equal(domainStudies(published, 'term:fear'), 363);
  assert.equal(domainStudies(published, 'language'), 1101);
  assert.deepEqual(domainAreas(published, 'term:fear'), [
    { region: 'aseg:left:18', z: 9.1 },
    { region: 'hcp-mmp:left:1', z: 3.4 },
  ]);
  assert.deepEqual(
    [...domainPaint(published, 'term:fear').colors],
    [
      ['aseg:left:18', [50, 50, 50]],
      ['hcp-mmp:left:1', [30, 30, 30]],
      ['learning:left:amygdala', [50, 50, 50]],
    ],
  );
  assert.equal(domainPaint(published, 'term:fear').id, 'function:term:fear');
  assert.throws(
    () => domainPaint(published, 'term:praxis'),
    /Unknown neuropsychological domain: term:praxis/,
  );
});

test('a comparison names two distinct published functions or terms, in order', () => {
  const published = validateNeuropsychDomains(partition(), regions, terms());
  assert.equal(validComparison(published, 'compare:language,memory'), true);
  assert.equal(validComparison(published, 'compare:term:fear,memory'), true);
  for (const id of [
    'language',
    'compare:language',
    'compare:language,language',
    'compare:language,praxis',
    'compare:all,language',
    'compare:language,memory,visual',
  ]) {
    assert.equal(validComparison(published, id), false, id);
  }
  assert.equal(functionName(published, 'compare:memory,language', 'fr'), 'Mémoire · Langage');
  assert.equal(functionName(published, 'compare:term:fear,memory', 'en'), 'fear · Memory');
  assert.equal(functionName(published, 'visual', 'en'), 'Visual');
});

test('a comparison lists the areas both reach first, then each one’s own, strongest first', () => {
  const published = validateNeuropsychDomains(partition(), regions, terms());
  assert.deepEqual(comparedAreas(published, 'compare:language,memory'), [
    { region: 'hcp-mmp:left:1', z: [3.2, 7.5], reached: 2 },
    { region: 'hcp-mmp:right:1', z: [4.1, null], reached: 1 },
    { region: 'aseg:left:18', z: [null, 3.5], reached: 1 },
  ]);
  assert.throws(
    () => comparedAreas(published, 'compare:language'),
    /Invalid comparison: compare:language/,
  );
});

test('a comparison paints each area in the colour of the one function reaching it, or the shared colour', () => {
  const published = validateNeuropsychDomains(partition(), regions, terms());
  const paint = domainPaint(published, 'compare:language,memory');
  assert.equal(paint.id, 'function:compare:language,memory');
  assert.deepEqual(
    [...paint.colors],
    [
      ['hcp-mmp:left:1', SHARED_COLOR],
      ['hcp-mmp:right:1', COMPARE_COLORS[0]],
      ['aseg:left:18', COMPARE_COLORS[1]],
      ['learning:left:amygdala', COMPARE_COLORS[1]],
    ],
  );
  assert.throws(
    () => domainPaint(published, 'compare:language,praxis'),
    /Invalid comparison: compare:language,praxis/,
  );
});

test('a term search ranks the term itself, then word starts, then the rest, larger literatures first', () => {
  const published = validateNeuropsychDomains(partition(), regions, terms());
  assert.deepEqual(
    matchingTerms(published, ' Fear ').map((record) => record.term),
    ['fear', 'fear conditioning', 'conditioned fear'],
  );
  assert.deepEqual(
    matchingTerms(published, 'cond').map((record) => record.term),
    ['fear conditioning', 'conditioned fear'],
  );
  assert.deepEqual(
    matchingTerms(published, 'fer').map((record) => record.term),
    ['interference'],
  );
  assert.deepEqual(matchingTerms(published, ''), []);
  assert.deepEqual(matchingTerms(validateNeuropsychDomains(partition(), regions), 'fear'), []);
});

test('a term below the threshold, reaching nothing, of no kind, repeating a curated function or off its atlas is rejected', () => {
  for (const [change, message] of [
    [
      (p: Fixture) => {
        p.terms[0][3][1][1] = 2.9;
      },
      /term: fear/,
    ],
    [
      (p: Fixture) => {
        p.terms[0][3][1][0] = 7;
      },
      /term: fear/,
    ],
    [
      (p: Fixture) => {
        p.terms.push(['fear', 1, 'function', [[0, 4]]]);
      },
      /term: fear/,
    ],
    [
      (p: Fixture) => {
        p.terms[2][3] = [];
      },
      /term: conditioned fear/,
    ],
    [
      (p: Fixture) => {
        p.terms[0][2] = 'anatomy';
      },
      /term: fear/,
    ],
    [
      (p: Fixture) => {
        p.terms.push(['language', 1101, 'function', [[1, 5]]]);
      },
      /term: language/,
    ],
    [
      (p: Fixture) => {
        p.regions.push('aseg:left:4');
      },
      /term region: aseg:left:4/,
    ],
    [
      (p: Fixture) => {
        p.regions.push('learning:left:amygdala');
      },
      /term region: learning:left:amygdala/,
    ],
    [
      (p: Fixture) => {
        p.threshold_z = 2;
      },
      /Invalid Neurosynth term search/,
    ],
    [
      (p: Fixture) => {
        p.atlas = 'destrieux';
      },
      /Invalid Neurosynth term search/,
    ],
  ] as [(p: Fixture) => void, RegExp][]) {
    const broken = terms();
    change(broken);
    assert.throws(() => validateNeuropsychDomains(partition(), regions, broken), message);
  }
});

test('CAT-42 · a misspelt query is offered the closest name or term within one edit per four letters', () => {
  const published = validateNeuropsychDomains(partition(), regions, terms());
  assert.equal(nearestName(published, 'Langauge', 'en'), 'Language');
  assert.equal(nearestName(published, 'interferance', 'en'), 'interference');
  assert.equal(nearestName(published, 'memoire', 'fr'), 'Mémoire');
  assert.equal(nearestName(published, 'nicotine', 'en'), null);
  assert.equal(nearestName(published, 'fea', 'en'), null);
});

test('CAT-42 · the allowance is one edit per four letters of the query', () => {
  assert.equal(nearest('lnagauge', ['Language']), 'Language'); // two edits, eight letters
  assert.equal(nearest('lnagaueg', ['Language']), null); // three edits, eight letters
  assert.equal(nearest('mtoro', ['Motor']), null); // two edits, five letters
});
