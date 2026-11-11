import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { Manifest, Region } from '../../types/index.ts';
import {
  connectivityPaint,
  hasConnectivity,
  partnersOf,
  validateFunctionalConnectivity,
  type FunctionalConnectivity,
} from './functional-connectivity.ts';
import { asRegion, readModel } from './test-support.ts';

const IDS = ['julich:left:1', 'julich:left:2', 'julich:right:1', 'julich:right:2'];
const regions = new Map<string, Region>([
  ...IDS.map((id) => [id, asRegion({ atlas: 'julich', kind: 'cortex' })] as const),
  ['destrieux:left:1', asRegion({ atlas: 'destrieux', kind: 'cortex' })],
]);

// Pairs once, row by row: (0,1) (0,2) (0,3) (1,2) (1,3) (2,3).
const table = (): FunctionalConnectivity => ({
  id: 'functional-connectivity',
  source: { short: 's', citation: 'c', pmid: 1, dataset: 'https://doi.org/10.25493/x', terms: 't' },
  people: 200,
  ages: '22–35',
  r_scale: [
    { from: 0.15, color: [1, 1, 1] },
    { from: 0.3, color: [2, 2, 2] },
    { from: 0.45, color: [3, 3, 3] },
  ],
  atlases: { julich: { regions: [...IDS], r: [20, 60, 10, 35, -5, 45] } },
});

test('INSP-48 · a region’s partners run strongest first, read from either side of the pair', () => {
  const data = validateFunctionalConnectivity(table(), regions);
  assert.deepEqual(partnersOf(data, 'julich:right:1'), [
    { region: 'julich:left:1', r: 0.6 },
    { region: 'julich:right:2', r: 0.45 },
    { region: 'julich:left:2', r: 0.35 },
  ]);
  assert.deepEqual(
    partnersOf(data, 'julich:left:2').map(({ r }) => r),
    [0.35, 0.2, -0.05],
  );
  assert.ok(hasConnectivity(data, 'julich:left:1'));
  assert.ok(!hasConnectivity(data, 'destrieux:left:1'));
  assert.throws(() => partnersOf(data, 'destrieux:left:1'), /no functional connectivity/);
});

test('STAGE-61 · the paint colours partners by step from the floor and leaves the seed unfilled', () => {
  const paint = connectivityPaint(
    validateFunctionalConnectivity(table(), regions),
    'julich:left:1',
  );
  assert.equal(paint.id, 'connectivity:julich:left:1');
  // r 0.20, 0.60 and 0.10: the last is below the floor.
  assert.deepEqual(
    [...paint.colors],
    [
      ['julich:right:1', [3, 3, 3]],
      ['julich:left:2', [1, 1, 1]],
    ],
  );
});

test('a table that does not fit its regions or a scale that does not rise is refused', () => {
  for (const change of [
    (data: FunctionalConnectivity) => data.atlases.julich!.r.pop(),
    (data: FunctionalConnectivity) => (data.atlases.julich!.r[0] = 0.5),
    (data: FunctionalConnectivity) => (data.atlases.julich!.regions[0] = 'destrieux:left:1'),
    (data: FunctionalConnectivity) => (data.r_scale[1]!.from = 0.1),
  ]) {
    const data = table();
    change(data);
    assert.throws(() => validateFunctionalConnectivity(data, regions), /Invalid functional/);
  }
});

test('the published table validates on CDMD; left area 4a’s strongest partner is the right one', () => {
  const manifest = readModel<Manifest>('cdmd/manifest.json');
  const byId = new Map(manifest.regions.map((region) => [region.id, region]));
  const data = validateFunctionalConnectivity(
    readModel<FunctionalConnectivity>(`cdmd/${manifest.functional_connectivity!.file}`),
    byId,
  );
  assert.deepEqual(Object.keys(data.atlases), ['julich']);
  const area = (name: string, side: string) =>
    manifest.regions.find(
      (region) =>
        region.atlas === 'julich' && region.source_name === name && region.hemisphere === side,
    )!.id;
  const partners = partnersOf(data, area('Area 4a (PreCG)', 'left'));
  assert.equal(partners[0]!.region, area('Area 4a (PreCG)', 'right'));
  assert.equal(partners.length, 277);
});
