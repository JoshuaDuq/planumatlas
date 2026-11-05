import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { Manifest, Region } from '../../types/index.ts';
import {
  ftractParcelName,
  ftractParcelOf,
  ftractRows,
  validateStimulationFtract,
  type FtractPair,
  type FtractParcel,
  type StimulationFtract,
} from './stimulation-ftract.ts';
import { asRegion, readModel } from './test-support.ts';

const parcel = (name: string, hemisphere: 'left' | 'right', region: string | null = null) =>
  ({ name, hemisphere, region, area: region ? name : null }) satisfies FtractParcel;

// 0 and 1 on the left, 2 and 3 on the right.
const PARCELS = [
  parcel('Area A', 'left', 'julich:left:1'),
  parcel('Area B', 'left'),
  parcel('Area A', 'right', 'julich:right:1'),
  parcel('Area B', 'right'),
];

const catalog = (pairs: FtractPair[], parcels: FtractParcel[] = PARCELS) =>
  ({
    id: 'stimulation-ftract',
    source: {
      short: 'F-TRACT',
      citation: 'c',
      doi: 'https://doi.org/10.1016/x',
      pmid: 1,
      dataset: 'https://doi.org/10.25493/y',
    },
    implantations: 20,
    people: 18,
    min_pairs: 10,
    min_implantations: 3,
    parcels,
    pairs,
  }) satisfies StimulationFtract;

const regions = new Map<string, Region>([
  ['julich:left:1', asRegion({ atlas: 'julich', hemisphere: 'left' })],
  ['julich:right:1', asRegion({ atlas: 'julich', hemisphere: 'right' })],
  ['destrieux:left:1', asRegion({ atlas: 'destrieux', hemisphere: 'left' })],
]);

test('drawn rates run highest first; thin pairs are counted, and the rest of the side never tested', () => {
  const data = catalog([
    [0, 0, 40, 5, 0.2],
    [0, 1, 30, 5, 0.6],
    [0, 2, 12, 2, 0.9], // two implantations: no rate
    [0, 3, 4, 3, null], // four pairs: F-TRACT publishes none
    [1, 0, 50, 9, 0.7],
  ]);
  const same = ftractRows(data, 0, 'from', 'same');
  assert.deepEqual(
    same.drawn.map((row) => [row.parcel, row.rate]),
    [
      [1, 0.6],
      [0, 0.2],
    ],
  );
  assert.deepEqual([same.tooFew, same.untested], [0, 0]);
  const opposite = ftractRows(data, 0, 'from', 'opposite');
  assert.deepEqual([opposite.drawn.length, opposite.tooFew, opposite.untested], [0, 2, 0]);
  const recorded = ftractRows(data, 0, 'to', 'same');
  assert.deepEqual(
    recorded.drawn.map((row) => row.parcel),
    [1, 0],
  );
  // A right parcel's same side is the right hemisphere: nothing was stimulated from it.
  assert.deepEqual(ftractRows(data, 2, 'from', 'same'), { drawn: [], tooFew: 0, untested: 2 });
});

test('equal rates put the more tested pair first', () => {
  const data = catalog([
    [0, 1, 12, 3, 0.5],
    [0, 0, 40, 3, 0.5],
  ]);
  assert.deepEqual(
    ftractRows(data, 0, 'from', 'same').drawn.map((row) => row.parcel),
    [0, 1],
  );
});

test('a pair or parcel the file cannot support is refused', () => {
  assert.throws(
    () => validateStimulationFtract(catalog([[0, 1, 12, 13, 0.5]]), regions),
    /pair: 0\|1/,
  );
  assert.throws(
    () => validateStimulationFtract(catalog([[0, 1, 9, 3, 0.5]]), regions),
    /pair: 0\|1/,
  );
  assert.throws(
    () => validateStimulationFtract(catalog([[0, 1, 12, 3, null]]), regions),
    /pair: 0\|1/,
  );
  assert.throws(
    () => validateStimulationFtract(catalog([[0, 7, 12, 3, 0.5]]), regions),
    /pair: 0\|7/,
  );
  const wrongSide = [parcel('Area A', 'right', 'julich:left:1')];
  assert.throws(
    () => validateStimulationFtract(catalog([], wrongSide), regions),
    /parcel: Area A\|right/,
  );
  const notJulich = [parcel('Area A', 'left', 'destrieux:left:1')];
  assert.throws(
    () => validateStimulationFtract(catalog([], notJulich), regions),
    /parcel: Area A\|left/,
  );
  const twice = [
    parcel('Area A', 'left', 'julich:left:1'),
    parcel('Area C', 'left', 'julich:left:1'),
  ];
  assert.throws(
    () => validateStimulationFtract(catalog([], twice), regions),
    /parcel: Area C\|left/,
  );
});

test('French calls an area "Aire" and keeps other names', () => {
  assert.equal(ftractParcelName(parcel('Area 45 (IFG)', 'left', 'r'), 'fr'), 'Aire 45 (IFG)');
  assert.equal(ftractParcelName(parcel('STN (Subthalamus)', 'left'), 'fr'), 'STN (Subthalamus)');
});

test('the published file validates against CDMD; each hemisphere keeps its own area', () => {
  const manifest = readModel<Manifest>('cdmd/manifest.json');
  const data = validateStimulationFtract(
    readModel<StimulationFtract>(`cdmd/${manifest.stimulation_ftract!.file}`),
    new Map(manifest.regions.map((region) => [region.id, region])),
  );
  const left = ftractParcelOf(data, 'julich:left:1')!;
  const right = ftractParcelOf(data, 'julich:right:1')!;
  assert.deepEqual(
    [data.parcels[left]!.hemisphere, data.parcels[right]!.hemisphere],
    ['left', 'right'],
  );
  assert.equal(data.parcels[left]!.area, 'Area 45 (IFG)');
  assert.equal(ftractParcelOf(data, 'destrieux:left:14'), null);
  // 3.1 carved Area 6v1 out of a 3.0 gap map; F-TRACT has no such area.
  assert.equal(ftractParcelOf(data, 'julich:left:117'), null);
});
