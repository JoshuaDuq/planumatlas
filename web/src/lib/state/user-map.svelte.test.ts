import { expect, test } from 'vitest';
import type { Cluster } from '../core/user-map/clusters.ts';
import type { MapSummary } from '../core/user-map/display.ts';
import { MapFileError } from '../core/user-map/map-file-error.ts';
import { createFakeUserMap } from '../engine/fake/user-map.ts';
import type { SurfaceColor } from '../types/index.ts';
import { createUserMapStore } from './user-map.svelte.ts';

const summary: MapSummary = {
  shape: [97, 115, 97],
  voxelMm: [2, 2, 2],
  range: [-5.2, 7.8054],
  binary: false,
  intent: 5,
  description: '',
  cortexCovered: 0.99,
};

function setup(color: SurfaceColor = 'atlas', table?: (threshold: number) => Cluster[]) {
  const engine = createFakeUserMap(true, table);
  const display = {
    color,
    setColor(value: SurfaceColor) {
      display.color = value;
    },
  };
  const store = createUserMapStore({ engine, display });
  return { engine, display, store };
}

const file = (name: string) => new File([new Uint8Array(4)], name);
// `open` reads the file before it asks the engine, which then waits to be settled.
const loading = (engine: ReturnType<typeof createFakeUserMap>) =>
  expect.poll(() => engine.loading).toBe(true);

test('a statistical map waits for its threshold, then is drawn over the tissue colour it takes from the atlas', async () => {
  const { engine, display, store } = setup();
  const opened = store.open(file('zstat1.nii.gz'));
  await loading(engine);
  expect(store.state).toEqual({ status: 'loading', name: 'zstat1.nii.gz' });
  engine.settle(summary);
  await opened;
  expect(store.state).toEqual({ status: 'ready', name: 'zstat1.nii.gz', summary });
  expect(store.settings).toEqual({ threshold: Number.NaN, max: 7.81, opacity: 1 });
  expect(store.title).toBe('zstat1');
  expect(store.statistic).toBe('z');
  expect(engine.shown).toBeNull();
  expect(display.color).toBe('atlas');

  store.setSettings({ ...store.settings, threshold: 3.1 });
  expect(engine.shown).toEqual({ threshold: 3.1, max: 7.81, opacity: 1 });
  expect(display.color).toBe('tissue');
  store.setShown(false);
  expect(engine.shown).toBeNull();
  expect(display.color).toBe('atlas');
});

test('the title and statistic are the reader’s to change; an empty title gives the file’s back', async () => {
  const { engine, store } = setup();
  const opened = store.open(file('spmT_0001.nii'));
  await loading(engine);
  engine.settle({ ...summary, intent: 0 });
  await opened;
  expect(store.statistic).toBe('t');
  store.setTitle('  Faces > Houses ');
  store.setStatistic(null);
  expect([store.title, store.statistic]).toEqual(['Faces > Houses', null]);
  store.setTitle('   ');
  expect(store.title).toBe('spmT_0001');
});

test('a threshold the stage cannot draw hides the map until it can', async () => {
  const { engine, store } = setup();
  const opened = store.open(file('zstat1.nii.gz'));
  await loading(engine);
  engine.settle(summary);
  await opened;
  store.setSettings({ threshold: 9, max: 7.81, opacity: 1 });
  expect(engine.shown).toBeNull();
  expect(store.drawn).toBe(false);
  store.setSettings({ threshold: 3.1, max: 7.81, opacity: 0.5 });
  expect(engine.shown).toEqual({ threshold: 3.1, max: 7.81, opacity: 0.5 });
});

test('the scan and a colour the reader chose meanwhile are left as they are', async () => {
  const { engine, display, store } = setup('mri');
  const opened = store.open(file('mask.nii'));
  await loading(engine);
  engine.settle({ ...summary, range: [0, 1], binary: true });
  await opened;
  expect(store.settings).toEqual({ threshold: 0.5, max: 1, opacity: 1 });
  expect(display.color).toBe('mri');

  display.color = 'atlas';
  store.setShown(false);
  store.setShown(true);
  expect(display.color).toBe('tissue');
  display.color = 'network';
  store.remove();
  expect(display.color).toBe('network');
  expect(engine.shown).toBeNull();
  expect(store.state).toEqual({ status: 'empty' });
});

test('a file that cannot be placed is reported by name, and the colour taken for the last map is given back', async () => {
  const { engine, display, store } = setup();
  const first = store.open(file('a.nii'));
  await loading(engine);
  engine.settle(summary);
  await first;
  store.setSettings({ ...store.settings, threshold: 2 });
  expect(display.color).toBe('tissue');
  const second = store.open(file('b.nii'));
  await loading(engine);
  expect(display.color).toBe('atlas');
  const volumes = new MapFileError('volumes', [3]);
  engine.settle(volumes);
  await second;
  expect(store.state).toEqual({ status: 'error', name: 'b.nii', error: volumes });
  // The last map is not left on the stage under the error.
  expect(engine.loaded).toBeNull();
});

test('a map opened over one still loading replaces it, and the first never lands', async () => {
  const { engine, store } = setup();
  const first = store.open(file('first.nii'));
  await loading(engine);
  const second = store.open(file('second.nii'));
  await loading(engine);
  await first;
  expect(store.state).toEqual({ status: 'loading', name: 'second.nii' });
  engine.settle(summary);
  await second;
  expect(store.state.status === 'ready' && store.state.name).toBe('second.nii');
});

test('another template reads the same file again and keeps how it is drawn', async () => {
  const { engine, store } = setup();
  const opened = store.open(file('zstat1.nii.gz'));
  await loading(engine);
  engine.settle(summary);
  await opened;
  store.setSettings({ threshold: 3.1, max: 6, opacity: 0.8 });
  store.setTitle('Faces > Houses');
  const moved = store.setSpace('spm12');
  await loading(engine);
  expect(store.state.status).toBe('loading');
  engine.settle(summary);
  await moved;
  expect(engine.loaded).toBe('spm12');
  expect(engine.shown).toEqual({ threshold: 3.1, max: 6, opacity: 0.8 });
  expect(store.title).toBe('Faces > Houses');
});

test('the cluster table follows the threshold the map is drawn at, not its scale or opacity', async () => {
  const peak = (threshold: number): Cluster[] => [
    {
      id: 1,
      sign: 1,
      voxels: 10,
      sizeMm3: 80,
      peaks: [{ mm: [-38, -22, 56], value: threshold + 4 }],
    },
  ];
  const { engine, store } = setup('atlas', peak);
  const opened = store.open(file('zstat1.nii.gz'));
  await loading(engine);
  engine.settle(summary);
  await opened;
  expect(store.clusters).toEqual({ status: 'idle' });
  store.setSettings({ ...store.settings, threshold: 3.1 });
  await expect.poll(() => store.clusters.status).toBe('ready');
  expect(store.clusters).toEqual({
    status: 'ready',
    threshold: 3.1,
    minVoxels: 0,
    data: peak(3.1),
  });
  store.setSettings({ ...store.settings, max: 6, opacity: 0.5 });
  store.setSettings({ ...store.settings, threshold: 4 });
  await expect.poll(() => store.clusters.status === 'ready' && store.clusters.threshold).toBe(4);
  expect(engine.clusterThresholds).toEqual([3.1, 4]);
  store.setShown(false);
  expect(store.clusters).toEqual({ status: 'idle' });
});

test('the cortex surface chosen reaches the engine', () => {
  const { engine, store } = setup();
  store.setSurface('mid');
  expect([store.surface, engine.surface]).toEqual(['mid', 'mid']);
});

test('a minimum cluster size trims the drawn map and the table at the threshold drawn', async () => {
  const { engine, store } = setup();
  const opened = store.open(file('zstat1.nii.gz'));
  await loading(engine);
  engine.settle(summary);
  await opened;
  store.setSettings({ ...store.settings, threshold: 3.1 });
  store.setMinVoxels(20);
  expect(engine.extents.at(-1)).toEqual([3.1, 20]);
  await expect.poll(() => store.clusters.status === 'ready' && store.clusters.minVoxels).toBe(20);
  expect(engine.clusterSizes.at(-1)).toEqual([3.1, 20]);
  store.setSettings({ ...store.settings, threshold: 4 });
  expect(engine.extents.at(-1)).toEqual([4, 20]);
  expect(() => store.setMinVoxels(2.5)).toThrow(RangeError);
  expect(store.minVoxels).toBe(20);
  // Each trimmed map placed says so, for the linked MRI to draw it again.
  const before = store.placed;
  store.setMinVoxels(30);
  await expect.poll(() => store.placed).toBeGreaterThan(before);
});
