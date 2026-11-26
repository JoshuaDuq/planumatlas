import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { Manifest } from '../../types/index.ts';
import {
  bibtex,
  citationFields,
  citationOf,
  identifiersOf,
  referenceText,
  ris,
  viewCitations,
  viewReferences,
  type ListedWork,
  type OnScreen,
  type ReferenceLibrary,
  type Work,
} from './citations.ts';
import { referenceListRows } from './provenance.ts';

const NONE = {
  journal: null,
  book: null,
  volume: null,
  issue: null,
  pages: null,
  publisher: null,
  doi: null,
  pmid: null,
  url: null,
};
const destrieux: Work = {
  ...NONE,
  type: 'article',
  title:
    'Automatic parcellation of human cortical gyri and sulci using standard anatomical nomenclature',
  authors: ['Destrieux C', 'Fischl B', 'Dale A', 'Halgren E'],
  year: 2010,
  journal: 'NeuroImage',
  volume: '53',
  issue: '1',
  pages: '1-15',
  doi: '10.1016/j.neuroimage.2010.06.010',
  pmid: '20547229',
};
const mills: Work = {
  ...NONE,
  type: 'dataset',
  title: 'HCP-MMP1.0 projected on fsaverage',
  authors: ['Mills K'],
  year: 2016,
  publisher: 'figshare',
  doi: '10.6084/m9.figshare.3498446.v2',
};
const planum: Work = {
  ...NONE,
  type: 'software',
  title: 'Planum',
  authors: ['Duquette J'],
  year: null,
  url: 'https://planumatlas.com',
};
const listed = (...works: Work[]): ListedWork[] =>
  works.map((work, index) => ({ key: `k${index}`, work, behind: ['atlas'] }));

test('a citation field names the DOIs and PubMed records it links, and nothing else', () => {
  assert.deepEqual(
    identifiersOf(
      'https://doi.org/10.1016/S1053-8119(09)70884-5; https://doi.org/10.1016/j.neuroimage.2005.02.018',
    ),
    { dois: ['10.1016/s1053-8119(09)70884-5', '10.1016/j.neuroimage.2005.02.018'], pmids: [] },
  );
  assert.deepEqual(
    identifiersOf('https://github.com/MICA-MNI/ENIGMA, https://pubmed.ncbi.nlm.nih.gov/34194050/'),
    { dois: [], pmids: ['34194050'] },
  );
  assert.deepEqual(
    identifiersOf('Fonov VS, Evans AC (2009) Unbiased templates. NeuroImage 47:S102'),
    {
      dois: [],
      pmids: [],
    },
  );
});

test('the citation fields are citation, citations, doi, source_url and any *_citation, however deep', () => {
  const record = {
    citation: 'a',
    url: 'not a citation',
    anatomy: { source_url: 'b', label: 'c' },
    retinotopy: { method_citation: 'd' },
    spaces: [{ doi: 'e', citation: 'f' }],
    layers: [{ citations: ['g', 'h'], license_url: 'i' }],
  };
  assert.deepEqual(citationFields(record).sort(), ['a', 'b', 'd', 'e', 'f', 'g', 'h']);
});

const opening: OnScreen = {
  atlas: 'destrieux',
  surfaceColor: 'atlas',
  detail: 'learning',
  internalVisible: true,
  spinalCordVisible: false,
  explorer: 'anatomy',
  selectedFunction: null,
  connectivitySeed: null,
  disorderShown: null,
  layers: null,
  deficit: null,
  tracts: null,
  strokeCases: false,
  visualFieldMap: false,
  bodyMap: false,
};
const manifest = {
  anatomy: { source_url: 'https://doi.org/10.1/subject' },
  atlases: [
    { id: 'destrieux', citation: 'https://doi.org/10.1/destrieux' },
    { id: 'hcp-mmp', citation: 'https://doi.org/10.1/glasser' },
  ],
  cut_atlases: [
    { id: 'hcp-mmp', citation: 'https://doi.org/10.1/glasser' },
    { id: 'nextbrain', citation: 'https://doi.org/10.1/nextbrain' },
    { id: 'arterial', citation: 'https://doi.org/10.1/liu' },
  ],
  detail_levels: [
    { id: 'aseg' },
    { id: 'nextbrain' },
    { id: 'learning', source_grids: { nextbrain: {}, aseg: {} } },
  ],
  networks: {
    citation: 'https://doi.org/10.1/yeo',
    parcellation: { citation: 'https://doi.org/10.1/schaefer' },
  },
  cab_np: { citation: 'https://doi.org/10.1/ji' },
  arterial_territories: { citation: 'https://doi.org/10.1/liu' },
  striatal_networks: { citation: 'https://doi.org/10.1/choi' },
  cerebellar_functions: { citation: 'https://doi.org/10.1/nettekoven' },
  functional_connectivity: {
    citations: ['https://doi.org/10.1/domhof-data', 'https://pubmed.ncbi.nlm.nih.gov/34746628/'],
  },
  disorder_effects: { citations: ['https://pubmed.ncbi.nlm.nih.gov/34194050/'] },
  supplemental_layers: [{ citations: ['https://doi.org/10.1/pam50'] }],
  neuropsych_domains: {
    citations: ['https://doi.org/10.1/glasser', 'https://doi.org/10.1/neurosynth'],
  },
  neurosynth_terms: { citations: ['https://doi.org/10.1/neurosynth'] },
  stroke_cases: { citations: ['https://doi.org/10.1/arc'] },
  retinotopy: {
    citation: 'https://doi.org/10.1/benson18',
    method_citation: 'https://doi.org/10.1/benson14',
    visual_areas: { citation: 'https://doi.org/10.1/wang' },
  },
  body_map: {
    citations: [
      'https://doi.org/10.1/barch',
      'https://doi.org/10.1/vanessen',
      'https://doi.org/10.1/wu',
    ],
  },
} as unknown as Partial<Manifest>;
const cited = (view: Partial<OnScreen>) =>
  viewCitations(manifest, { ...opening, ...view }).cited.map(
    ({ behind, citation }) => `${behind} ${citation.replace('https://doi.org/10.1/', '')}`,
  );

test('the opening view cites its subject, its atlas and the segmentations its internal anatomy is built from', () => {
  // The learning set is built from NextBrain and aseg; the manifest cites NextBrain alone.
  assert.deepEqual(cited({}), ['subject subject', 'atlas destrieux', 'internal nextbrain']);
  assert.equal(viewCitations(manifest, opening).hcp, false);
});

test('each colouring and paint cites its own source', () => {
  assert.deepEqual(cited({ surfaceColor: 'network' }).slice(2, 4), [
    'colouring yeo',
    'colouring schaefer',
  ]);
  assert.deepEqual(cited({ surfaceColor: 'cab-np' })[2], 'colouring ji');
  assert.deepEqual(cited({ surfaceColor: 'territory' })[2], 'colouring liu');
  assert.deepEqual(cited({ surfaceColor: 'striatal' })[2], 'colouring choi');
  assert.deepEqual(cited({ surfaceColor: 'cerebellar' })[2], 'colouring nettekoven');
  assert.deepEqual(cited({ connectivitySeed: 'destrieux:left:1' }).slice(2, 4), [
    'colouring domhof-data',
    'colouring https://pubmed.ncbi.nlm.nih.gov/34746628/',
  ]);
  assert.deepEqual(
    cited({ disorderShown: 'epilepsy' })[2],
    'colouring https://pubmed.ncbi.nlm.nih.gov/34194050/',
  );
  // A paint asked for in Anatomy is not on screen once another tab is in front.
  assert.ok(
    !cited({ connectivitySeed: 'x', explorer: 'circuits' }).some((c) => c.includes('34746628')),
  );
});

test('the layer IV paint cites the layers’ paper and the collection that carried them, in Anatomy only', () => {
  const layers = ['https://doi.org/10.1/wagstyl', 'https://doi.org/10.1/bigbrainwarp'];
  assert.deepEqual(cited({ layers }).slice(2, 4), ['colouring wagstyl', 'colouring bigbrainwarp']);
  assert.ok(!cited({ layers, explorer: 'functions' }).some((c) => c.includes('wagstyl')));
  assert.equal(viewCitations(manifest, { ...opening, layers }).hcp, false);
});

test('the cord, an open function, deficit, tract set, stroke cohort and visual field map each add theirs', () => {
  assert.ok(cited({ spinalCordVisible: true }).includes('spinalCord pam50'));
  assert.deepEqual(
    cited({ explorer: 'functions', selectedFunction: 'language' }).filter((c) =>
      c.startsWith('function'),
    ),
    ['function glasser', 'function neurosynth'],
  );
  assert.deepEqual(
    cited({ explorer: 'functions', selectedFunction: 'term:pain' }).filter((c) =>
      c.startsWith('function'),
    ),
    ['function glasser', 'function neurosynth', 'function neurosynth'],
  );
  assert.ok(cited({ deficit: ['https://doi.org/10.1/dronkers'] }).includes('deficit dronkers'));
  assert.ok(cited({ tracts: 'https://doi.org/10.1/cdmd' }).includes('tracts cdmd'));
  assert.ok(cited({ strokeCases: true }).includes('strokeCases arc'));
  assert.deepEqual(
    cited({ visualFieldMap: true }).filter((c) => c.startsWith('visualField')),
    ['visualField benson18', 'visualField benson14', 'visualField wang'],
  );
  assert.ok(!cited({ internalVisible: false }).some((c) => c.startsWith('internal')));
});

test('the HCP acknowledgement goes with HCP-MMP, CAB-NP, HCP connectivity and the HCP 7T visual field map', () => {
  const hcp = (view: Partial<OnScreen>) => viewCitations(manifest, { ...opening, ...view }).hcp;
  assert.equal(hcp({ atlas: 'hcp-mmp' }), true);
  assert.equal(hcp({ surfaceColor: 'cab-np' }), true);
  assert.equal(hcp({ connectivitySeed: 'destrieux:left:1' }), true);
  assert.equal(hcp({ visualFieldMap: true }), true);
  assert.equal(hcp({ surfaceColor: 'network' }), false);
});

test('BODY-07 the open body map cites its task, project and registration papers, with the HCP acknowledgement', () => {
  assert.deepEqual(
    cited({ bodyMap: true }).filter((c) => c.startsWith('bodyMap')),
    ['bodyMap barch', 'bodyMap vanessen', 'bodyMap wu'],
  );
  assert.ok(!cited({ bodyMap: false }).some((c) => c.startsWith('bodyMap')));
  assert.equal(viewCitations(manifest, { ...opening, bodyMap: true }).hcp, true);
  assert.equal(viewCitations(manifest, { ...opening, bodyMap: false }).hcp, false);
});

const library: ReferenceLibrary = {
  works: { 'pmid:20547229': destrieux, 'doi:10.6084/m9.figshare.3498446.v2': mills },
  planum,
  hcpAcknowledgement: 'Data were provided [in part] by the Human Connectome Project.',
};

test('a work cited for two parts of the view is listed once, under both, after Planum', () => {
  const list = viewReferences(
    {
      cited: [
        { behind: 'atlas', citation: 'https://doi.org/10.1016/J.NEUROIMAGE.2010.06.010' },
        { behind: 'subject', citation: 'https://doi.org/10.6084/m9.figshare.3498446.v2' },
        { behind: 'function', citation: 'https://pubmed.ncbi.nlm.nih.gov/20547229/' },
      ],
    },
    library,
  );
  assert.deepEqual(
    list.map(({ key, behind }) => [key, behind]),
    [
      ['planum', ['planum']],
      ['pmid:20547229', ['atlas', 'function']],
      ['doi:10.6084/m9.figshare.3498446.v2', ['subject']],
    ],
  );
  assert.deepEqual(
    referenceListRows(list, null, 'en').map(({ label }) => label),
    ['Planum', 'Atlas · Function', 'Subject'],
  );
});

test('a citation the library has no record for fails', () => {
  assert.throws(
    () =>
      viewReferences(
        { cited: [{ behind: 'atlas', citation: 'https://doi.org/10.1/none' }] },
        library,
      ),
    /no record for doi:10\.1\/none/,
  );
});

test('a work is cited as the manifest cites: authors (year) title. journal volume(issue):pages', () => {
  assert.equal(
    citationOf(destrieux),
    'Destrieux C, Fischl B, Dale A, Halgren E (2010) Automatic parcellation of human cortical gyri and sulci using standard anatomical nomenclature. NeuroImage 53(1):1–15.',
  );
  assert.equal(
    citationOf(mills),
    'Mills K (2016) HCP-MMP1.0 projected on fsaverage [dataset]. figshare.',
  );
  assert.equal(citationOf(planum), 'Duquette J. Planum [software].');
  const many = { ...destrieux, authors: ['A A', 'B B', 'C C', 'D D', 'E E', 'F F', 'G G'] };
  assert.ok(citationOf(many).startsWith('A A, B B, C C, D D, E E, F F, et al. (2010) '));
});

test('the text list gives each work a line with its link, then the acknowledgement', () => {
  assert.equal(
    referenceText(listed(planum, mills), 'Data were provided by the HCP.'),
    [
      'Duquette J. Planum [software]. https://planumatlas.com',
      'Mills K (2016) HCP-MMP1.0 projected on fsaverage [dataset]. figshare. https://doi.org/10.6084/m9.figshare.3498446.v2',
      '',
      'Data were provided by the HCP.',
      '',
    ].join('\n'),
  );
});

test('an article’s BibTeX entry', () => {
  assert.equal(
    bibtex(listed(destrieux)),
    [
      '@article{destrieux2010,',
      '  author = {Destrieux, C. and Fischl, B. and Dale, A. and Halgren, E.},',
      '  title = {{Automatic parcellation of human cortical gyri and sulci using standard anatomical nomenclature}},',
      '  journal = {NeuroImage},',
      '  year = {2010},',
      '  volume = {53},',
      '  number = {1},',
      '  pages = {1--15},',
      '  doi = {10.1016/j.neuroimage.2010.06.010},',
      '  pmid = {20547229},',
      '}',
      '',
    ].join('\n'),
  );
});

test('BibTeX escapes TeX’s specials, keeps suffixes and group names, and letters a repeated key', () => {
  const awkward: Work = {
    ...destrieux,
    title: 'Pain & touch: 50% of {cases} in #3_a',
    authors: ['Van Valin RD Jr', 'GENIC Investigators'],
  };
  const entries = bibtex(listed(awkward, { ...awkward, title: 'Second' }));
  assert.ok(
    entries.includes('  title = {{Pain \\& touch: 50\\% of \\{cases\\} in \\#3\\_a}},'),
    entries,
  );
  assert.ok(
    entries.includes('  author = {Van Valin, Jr, R. D. and {GENIC Investigators}},'),
    entries,
  );
  assert.deepEqual(
    [...entries.matchAll(/^@article\{(\w+),$/gm)].map(([, key]) => key),
    ['vanvalin2010', 'vanvalin2010b'],
  );
});

test('a dataset and Planum are BibTeX misc entries that say what they are', () => {
  assert.equal(
    bibtex(listed(mills)),
    [
      '@misc{mills2016,',
      '  author = {Mills, K.},',
      '  title = {{HCP-MMP1.0 projected on fsaverage}},',
      '  publisher = {figshare},',
      '  year = {2016},',
      '  doi = {10.6084/m9.figshare.3498446.v2},',
      '  note = {Dataset},',
      '}',
      '',
    ].join('\n'),
  );
  assert.ok(
    bibtex([{ key: 'planum', work: planum, behind: ['planum'] }]).startsWith('@misc{planum,\n'),
  );
});

test('an article’s RIS record, with CRLF line ends and the ER tag that ends it', () => {
  assert.equal(
    ris(listed(destrieux)),
    [
      'TY  - JOUR',
      'AU  - Destrieux, C.',
      'AU  - Fischl, B.',
      'AU  - Dale, A.',
      'AU  - Halgren, E.',
      'TI  - Automatic parcellation of human cortical gyri and sulci using standard anatomical nomenclature',
      'T2  - NeuroImage',
      'PY  - 2010',
      'VL  - 53',
      'IS  - 1',
      'SP  - 1',
      'EP  - 15',
      'DO  - 10.1016/j.neuroimage.2010.06.010',
      'UR  - https://doi.org/10.1016/j.neuroimage.2010.06.010',
      'ER  - ',
      '',
    ].join('\r\n'),
  );
  assert.ok(ris(listed(mills)).startsWith('TY  - DATA\r\nAU  - Mills, K.\r\n'));
  assert.ok(ris(listed(mills)).includes('\r\nPB  - figshare\r\n'));
});
