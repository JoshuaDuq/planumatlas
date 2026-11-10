import assert from 'node:assert/strict';
import { test } from 'vitest';
import { tractCatalog } from './diffusion/catalogs.ts';
import { bridgeText, circuitsMatching, elsewhere } from './elsewhere.ts';
import { tractRows, tractsMatching } from './tracts.ts';

test('the other tabs that find something come in tab order; the searched tab is never counted', () => {
  const found = elsewhere('anatomy', {
    anatomy: () => {
      throw new Error('The searched tab is not counted again.');
    },
    functions: () => 0,
    deficits: () => 5,
    circuits: () => 1,
    diffusion: () => 2,
  });
  assert.deepEqual(found, [
    { mode: 'deficits', count: 5 },
    { mode: 'circuits', count: 1 },
    { mode: 'diffusion', count: 2 },
  ]);
});

const circuit = (id: string, name: string, route: string, nameFr = name, routeFr = route) => ({
  id,
  name: { en: name, fr: nameFr },
  route: { en: route, fr: routeFr },
});
const circuits = [
  circuit(
    'motor',
    'Basal ganglia motor loops',
    'cortex → putamen → GPi → thalamus',
    'Boucles motrices des ganglions de la base',
    'cortex → putamen → GPi → thalamus',
  ),
  circuit('memory', 'Hippocampal–diencephalic pathway', 'fornix → mammillary bodies'),
];

test('a circuit is found by its name or its route, in the reader’s language, accents and case folded', () => {
  const ids = (query: string, lang: 'en' | 'fr' = 'en') =>
    circuitsMatching(circuits, query, lang).map(({ id }) => id);
  assert.deepEqual(ids('basal ganglia'), ['motor']);
  assert.deepEqual(ids('FORNIX'), ['memory']);
  assert.deepEqual(ids('ganglions de la base', 'fr'), ['motor']);
  assert.deepEqual(ids('ganglions de la base'), []);
  assert.deepEqual(ids('hippocampal–diencephalic'), ['memory']);
  assert.deepEqual(ids('  '), []);
});

test('a tract is found by its name in either language, accents folded', () => {
  const rows = tractRows(tractCatalog('cdmd').bundles);
  const keys = (query: string, lang: 'en' | 'fr' = 'en') =>
    tractsMatching(rows, query, lang).map(({ key }) => key);
  assert.deepEqual(keys('arcuate'), ['af']);
  assert.deepEqual(keys('arque', 'fr'), ['af']);
  assert.deepEqual(keys('arcuate', 'fr'), []);
  // A blank search keeps every row, as the Tracts list shows them all.
  assert.equal(tractsMatching(rows, ' ', 'en').length, rows.length);
});

test('a bridge names the tab, the count and the words, in both languages', () => {
  assert.equal(
    bridgeText('en', { mode: 'anatomy', count: 1 }, 'arcuate'),
    'Anatomy: 1 region matches “arcuate”',
  );
  assert.equal(
    bridgeText('en', { mode: 'diffusion', count: 2 }, 'arcuate'),
    'Tracts: 2 tract bundles match “arcuate”',
  );
  assert.equal(
    bridgeText('en', { mode: 'circuits', count: 1 }, 'basal ganglia'),
    'Circuits: 1 guided circuit matches “basal ganglia”',
  );
  assert.equal(
    bridgeText('en', { mode: 'deficits', count: 5 }, 'aphasia'),
    'Deficits: 5 lesion profiles match “aphasia”',
  );
  assert.equal(
    bridgeText('en', { mode: 'functions', count: 1 }, 'memory'),
    'Functions: 1 activation map matches “memory”',
  );
  assert.equal(
    bridgeText('fr', { mode: 'anatomy', count: 2 }, 'arqué'),
    'Anatomie : 2 régions correspondent à « arqué »',
  );
  assert.equal(
    bridgeText('fr', { mode: 'diffusion', count: 1 }, 'arqué'),
    'Faisceaux : 1 faisceau correspond à « arqué »',
  );
  assert.equal(
    bridgeText('fr', { mode: 'circuits', count: 2 }, 'thalamus'),
    'Circuits : 2 circuits guidés correspondent à « thalamus »',
  );
});
