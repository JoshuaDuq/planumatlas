import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { Manifest, Region } from '../../types/index.ts';
import {
  labelsOf,
  responseRows,
  untested,
  validateStimulationResponses,
  type StimulationPair,
  type StimulationResponses,
} from './stimulation-responses.ts';
import { asRegion, readModel } from './test-support.ts';

const pair = (
  from: string,
  to: string,
  responded: number,
  tested: number,
  subjects = 3,
  side: StimulationPair['side'] = 'same',
): StimulationPair => ({ from, to, side, tested, responded, subjects });

const catalog = (pairs: StimulationPair[], regions: StimulationResponses['regions'] = {}) =>
  ({
    id: 'stimulation-responses',
    source: {
      short: 'Lyu et al. (2025)',
      citation: 'c',
      doi: 'https://doi.org/10.1038/x',
      pmid: 1,
      dataset: 'https://doi.org/10.5281/y',
    },
    subjects: 5,
    excluded: 0,
    min_subjects: 3,
    labels: ['A', 'B', 'C', 'D'].map((id) => ({ id, name: id, name_fr: id })),
    pairs,
    regions,
  }) satisfies StimulationResponses;

const regions = new Map<string, Region>([
  ['destrieux:left:14', asRegion({ atlas: 'destrieux', hemisphere: 'left' })],
]);

test('rates drawn from enough people come first, highest first; the rest follow by how often tested', () => {
  const data = catalog([
    pair('A', 'B', 1, 4),
    pair('A', 'C', 3, 4),
    pair('A', 'D', 2, 2, 1),
    pair('A', 'A', 9, 9, 2),
    pair('B', 'A', 4, 4),
  ]);
  const rows = responseRows(data, 'A', 'from', 'same');
  assert.deepEqual(
    rows.map((row) => [row.label.id, row.rate, row.drawn]),
    [
      ['C', 0.75, true],
      ['B', 0.25, true],
      ['A', 1, false],
      ['D', 1, false],
    ],
  );
});

test('recorded here takes the pairs ending at the label, on the chosen side only', () => {
  const data = catalog([
    pair('B', 'A', 1, 2),
    pair('C', 'A', 1, 2, 3, 'opposite'),
    pair('A', 'D', 1, 2),
  ]);
  assert.deepEqual(
    responseRows(data, 'A', 'to', 'same').map((row) => row.label.id),
    ['B'],
  );
  assert.deepEqual(
    responseRows(data, 'A', 'to', 'opposite').map((row) => row.label.id),
    ['C'],
  );
  assert.deepEqual(
    untested(data, 'A', 'to', 'same').map((label) => label.id),
    ['A', 'C', 'D'],
  );
});

test('counts that cannot be, or an assignment the file cannot support, are refused', () => {
  assert.throws(
    () => validateStimulationResponses(catalog([pair('A', 'B', 5, 4)]), regions),
    /pair: A\|B\|same/,
  );
  assert.throws(
    () => validateStimulationResponses(catalog([pair('A', 'B', 1, 4, 6)]), regions),
    /pair: A\|B\|same/,
  );
  assert.throws(
    () =>
      validateStimulationResponses(
        catalog([], { 'destrieux:left:99': { labels: ['A'], basis: 'name' } }),
        regions,
      ),
    /assignment: destrieux:left:99/,
  );
  const twoFromContacts = catalog([], {
    'destrieux:left:14': {
      labels: ['A', 'B'] as unknown as [string],
      basis: 'contacts',
      channels: 10,
      subjects: 3,
      share: 0.6,
    },
  });
  assert.throws(
    () => validateStimulationResponses(twoFromContacts, regions),
    /assignment: destrieux:left:14/,
  );
});

test('the published file validates against CDMD; the thalamus takes the three positional sites', () => {
  const manifest = readModel<Manifest>('cdmd/manifest.json');
  const data = validateStimulationResponses(
    readModel<StimulationResponses>(`cdmd/${manifest.stimulation_responses!.file}`),
    new Map(manifest.regions.map((region) => [region.id, region])),
  );
  assert.deepEqual(labelsOf(data, 'learning:left:thalamus')?.labels, ['antTH', 'midTH', 'pstTH']);
  assert.equal(labelsOf(data, 'hcp-mmp:left:1'), null);
  const triangular = labelsOf(data, 'destrieux:left:14')!;
  assert.equal(triangular.basis, 'contacts');
  assert.deepEqual(triangular.labels, ['LFC']);
  // 76 899 of the 240 319 tested pairs responded, as the paper reports.
  const totals = data.pairs.reduce(
    (sum, item) => [sum[0]! + item.responded, sum[1]! + item.tested],
    [0, 0],
  );
  assert.deepEqual(totals, [76899, 240319]);
});
