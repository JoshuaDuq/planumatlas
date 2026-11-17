import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { Manifest, Region } from '../../types/index.ts';
import {
  ftractFarthest,
  ftractParcelName,
  ftractParcelOf,
  ftractRows,
  validateStimulationFtract,
  type FtractDelayEntry,
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

const catalog = (
  pairs: FtractPair[],
  parcels: FtractParcel[] = PARCELS,
  delays: FtractDelayEntry[] = [],
) =>
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
    min_responses: 10,
    window_ms: 50,
    parcels,
    pairs,
    delays,
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

test('a drawn row carries the peak delay of its own direction, with no distance where an end has no region', () => {
  const data = catalog(
    [
      [0, 0, 40, 5, 0.2],
      [0, 1, 30, 5, 0.6],
      [1, 0, 50, 9, 0.7],
      [0, 2, 20, 4, 0.5],
      [0, 3, 12, 3, 0.1],
    ],
    PARCELS,
    [
      [0, 0, 13, 4, null],
      [0, 1, 26, 8, null],
      [1, 0, 30, 5, null],
      [0, 2, 35, 6, 92.4],
    ],
  );
  const delays = (direction: 'from' | 'to', side: 'same' | 'opposite') =>
    ftractRows(data, 0, direction, side).drawn.map((row) => [row.parcel, row.delay]);
  assert.deepEqual(delays('from', 'same'), [
    [1, { peak: 26, mad: 8, distance: null }],
    [0, { peak: 13, mad: 4, distance: null }],
  ]);
  assert.deepEqual(delays('to', 'same'), [
    [1, { peak: 30, mad: 5, distance: null }],
    [0, { peak: 13, mad: 4, distance: null }],
  ]);
  // Ten responses are needed for a delay: the 10% pair has none.
  assert.deepEqual(delays('from', 'opposite'), [
    [2, { peak: 35, mad: 6, distance: 92.4 }],
    [3, null],
  ]);
});

test('a delay the file cannot support is refused', () => {
  const placed: FtractPair = [0, 2, 20, 4, 0.5];
  assert.doesNotThrow(() =>
    validateStimulationFtract(catalog([placed], PARCELS, [[0, 2, 20, 3, 92.4]]), regions),
  );
  const refused: [FtractPair[], FtractDelayEntry][] = [
    // Two implantations: no rate is drawn, so no delay is shown.
    [[[0, 2, 12, 2, 0.9]], [0, 2, 20, 3, 92.4]],
    // Past F-TRACT's 50 ms window.
    [[placed], [0, 2, 51, 3, 92.4]],
    // Two placed areas without a distance, a distance to an area with no region, and one within an area.
    [[placed], [0, 2, 20, 3, null]],
    [[[0, 1, 30, 5, 0.6]], [0, 1, 20, 3, 12]],
    [[[0, 0, 40, 5, 0.2]], [0, 0, 13, 4, 5]],
  ];
  for (const [pairs, delay] of refused) {
    assert.throws(
      () => validateStimulationFtract(catalog(pairs, PARCELS, [delay]), regions),
      new RegExp(`delay: ${delay[0]}\\|${delay[1]}`),
    );
  }
  assert.throws(
    () =>
      validateStimulationFtract(
        catalog([placed], PARCELS, [
          [0, 2, 20, 3, 92.4],
          [0, 2, 21, 3, 92.4],
        ]),
        regions,
      ),
    /delay: 0\|2/,
  );
});

test('every plot shares the farthest distance of any delay', () => {
  const delays: FtractDelayEntry[] = [
    [0, 0, 13, 4, null],
    [0, 2, 35, 6, 92.4],
    [1, 0, 30, 5, 40],
  ];
  assert.equal(ftractFarthest(catalog([], PARCELS, delays)), 92.4);
  assert.equal(ftractFarthest(catalog([])), 0);
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
  // Read from F-TRACT's matrices: left Area 45 to left Op9 peaks at 18 ms (MAD 5.859).
  const op9 = data.parcels.findIndex(
    (entry) => entry.name === 'Area Op9 (Frontal Operculum)' && entry.hemisphere === 'left',
  );
  const row = ftractRows(data, left, 'from', 'same').drawn.find((entry) => entry.parcel === op9)!;
  assert.deepEqual([row.delay!.peak, row.delay!.mad], [18, 5.859]);
  assert.equal(ftractParcelOf(data, 'destrieux:left:14'), null);
  // 3.1 carved Area 6v1 out of a 3.0 gap map; F-TRACT has no such area.
  assert.equal(ftractParcelOf(data, 'julich:left:117'), null);
});
