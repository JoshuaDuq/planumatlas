import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { Region } from '../../types/index.ts';
import {
  cellsOf,
  layerIvStep,
  layerPaint,
  layersPainted,
  paintedLayerSources,
  sharesOf,
  validateCorticalLayers,
  type CorticalLayers,
} from './cortical-layers.ts';
import { asRegion } from './test-support.ts';

const regions = new Map<string, Region>([
  ['julich:left:4', asRegion({ atlas: 'julich', kind: 'cortex' })],
  ['julich:right:4', asRegion({ atlas: 'julich', kind: 'cortex' })],
  ['hcp-mmp:left:8', asRegion({ atlas: 'hcp-mmp', kind: 'cortex' })],
  ['hcp-mmp:left:0', asRegion({ atlas: 'hcp-mmp', kind: 'non-region' })],
  ['aseg:left:17', asRegion({ atlas: 'aseg', kind: 'structure' })],
]);
const data = (): CorticalLayers => ({
  id: 'cortical-layers',
  source: { paper: 'https://doi.org/p', collection: 'https://doi.org/c' },
  layers: ['I', 'II', 'III', 'IV', 'V', 'VI'],
  layer_iv_scale: [
    { from: 0, color: [1, 1, 1] },
    { from: 0.07, color: [2, 2, 2] },
    { from: 0.09, color: [3, 3, 3] },
  ],
  regions: {
    'julich:left:4': [80, 90, 310, 50, 220, 250],
    'hcp-mmp:left:8': [100, 100, 300, 90, 200, 210],
  },
  cells: {
    datasets: [
      {
        key: 'Motor_4a',
        area: 'Area 4a (PreCG)',
        doi: 'https://doi.org/d',
        patches: 9,
        mean: [30.5, 79.5, 50.3, 49.9, 45.8, 43.8],
        sd: [9.5, 23.7, 12.3, 24.5, 8.7, 7.9],
      },
    ],
    regions: { 'julich:left:4': 'Motor_4a', 'julich:right:4': 'Motor_4a' },
  },
});

test('INSP-58 · a parcel reads its six shares and its Julich-Brain area’s cells; a parcel without shares reads none', () => {
  const layers = validateCorticalLayers(data(), regions);
  assert.deepEqual(sharesOf(layers, 'julich:left:4'), [0.08, 0.09, 0.31, 0.05, 0.22, 0.25]);
  assert.equal(cellsOf(layers, 'julich:left:4')!.area, 'Area 4a (PreCG)');
  // The right area has cells by name but no shares, so its section shows nothing.
  assert.equal(sharesOf(layers, 'julich:right:4'), null);
  assert.equal(cellsOf(layers, 'hcp-mmp:left:8'), null);
  assert.equal(sharesOf(null, 'julich:left:4'), null);
});

test('INSP-58 · the file is refused when shares do not sum to one or name what is not a cortical parcel', () => {
  const broken: ((value: CorticalLayers) => void)[] = [
    (value) => (value.regions['julich:left:4'] = [80, 90, 310, 50, 220, 251]),
    (value) => (value.regions['julich:left:4'] = [80, 90, 310, 50, 470]),
    (value) => (value.regions['hcp-mmp:left:0'] = [100, 100, 300, 90, 200, 210]),
    (value) => (value.regions['aseg:left:17'] = [100, 100, 300, 90, 200, 210]),
    // An id whose prefix is not its region's atlas: the paint picks an atlas's parcels by prefix.
    (value) => {
      regions.set('julich:left:9', asRegion({ atlas: 'hcp-mmp', kind: 'cortex' }));
      value.regions['julich:left:9'] = [100, 100, 300, 90, 200, 210];
    },
    (value) => (value.cells.regions['hcp-mmp:left:8'] = 'Motor_4a'),
    (value) => (value.cells.regions['julich:left:4'] = 'Area_44'),
    (value) => (value.cells.datasets[0]!.mean = [1, 2, 3]),
    (value) => (value.layer_iv_scale[0]!.from = 0.01),
    (value) => (value.layer_iv_scale[2]!.from = 0.05),
    (value) => (value.source.paper = 'pmid:1'),
  ];
  for (const breaking of broken) {
    const value = data();
    breaking(value);
    assert.throws(() => validateCorticalLayers(value, regions), /Invalid cortical/);
  }
  regions.delete('julich:left:9');
  assert.doesNotThrow(() => validateCorticalLayers(data(), regions));
});

test('STAGE-73 · the paint is drawn, and its sources cited, only in Anatomy, asked for, not lifted, once downloaded', () => {
  const layers = data();
  const asked = { explorer: 'anatomy', paintLifted: false, layersShown: true } as const;
  assert.deepEqual(paintedLayerSources(asked, layers), ['https://doi.org/p', 'https://doi.org/c']);
  assert.equal(layersPainted(asked, layers), true);
  // A masthead colour or atlas lifts it: the stage shows another colouring, which cites its own.
  for (const state of [
    { ...asked, paintLifted: true },
    { ...asked, explorer: 'functions' as const },
    { ...asked, layersShown: false },
  ]) {
    assert.equal(paintedLayerSources(state, layers), null);
    assert.equal(layersPainted(state, layers), false);
  }
  assert.equal(paintedLayerSources(asked, null), null);
});

test('STAGE-73 · a layer IV share takes the step it reaches, and the paint holds the shown atlas’s parcels only', () => {
  const layers = data();
  assert.deepEqual(
    [0, 0.0699, 0.07, 0.0899, 0.09, 0.3].map((share) => layerIvStep(layers, share)),
    [0, 0, 1, 1, 2, 2],
  );
  const paint = layerPaint(layers, 'julich');
  assert.equal(paint.id, 'layers:julich');
  assert.deepEqual([...paint.colors], [['julich:left:4', [1, 1, 1]]]);
  assert.deepEqual([...layerPaint(layers, 'hcp-mmp').colors], [['hcp-mmp:left:8', [3, 3, 3]]]);
});
