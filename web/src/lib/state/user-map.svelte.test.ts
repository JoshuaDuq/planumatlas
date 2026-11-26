import { expect, test, vi } from 'vitest';
import type { Cluster } from '../core/user-map/clusters.ts';
import { VOLUMES_PER_SECOND } from '../core/user-map/display.ts';
import type { MapSummary } from '../core/user-map/display.ts';
import { MapFileError } from '../core/user-map/map-file-error.ts';
import { MAX_FILE_BYTES } from '../core/user-map/nifti.ts';
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
  volumes: 1,
  secondsPerVolume: null,
  cortexCovered: 0.99,
};

/**
 * The maps and their fake engine; `store` and `engine` are the first slot's, which a single map
 * is read into.
 */
function setup(color: SurfaceColor = 'atlas', table?: (threshold: number) => Cluster[]) {
  const engines = createFakeUserMap(true, table);
  const display = {
    color,
    setColor(value: SurfaceColor) {
      display.color = value;
    },
  };
  const maps = createUserMapStore({ engine: engines, display });
  return { engine: engines.maps[0]!, engines, display, store: maps.maps[0]!, maps };
}

const file = (name: string) => new File([new Uint8Array(4)], name);
// `open` reads the file before it asks the engine, which then waits to be settled.
const loading = (engine: { readonly loading: boolean }) =>
  expect.poll(() => engine.loading).toBe(true);

test('a statistical map waits for its threshold, then is drawn over the tissue colour it takes from the atlas', async () => {
  const { engine, display, store } = setup();
  const opened = store.open(file('zstat1.nii.gz'));
  await loading(engine);
  expect(store.state).toEqual({ status: 'loading', name: 'zstat1.nii.gz' });
  engine.settle(summary);
  await opened;
  expect(store.state).toEqual({ status: 'ready', name: 'zstat1.nii.gz', summary });
  expect(store.settings).toEqual({
    threshold: Number.NaN,
    max: 7.81,
    opacity: 1,
    colours: 'red-yellow',
  });
  expect(store.title).toBe('zstat1');
  expect(store.statistic).toBe('z');
  expect(engine.shown).toBeNull();
  expect(display.color).toBe('atlas');

  store.setSettings({ ...store.settings, threshold: 3.1 });
  expect(engine.shown).toEqual({ threshold: 3.1, max: 7.81, opacity: 1, colours: 'red-yellow' });
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
  store.setSettings({ threshold: 9, max: 7.81, opacity: 1, colours: 'red-yellow' });
  expect(engine.shown).toBeNull();
  expect(store.drawn).toBe(false);
  store.setSettings({ threshold: 3.1, max: 7.81, opacity: 0.5, colours: 'red-yellow' });
  expect(engine.shown).toEqual({ threshold: 3.1, max: 7.81, opacity: 0.5, colours: 'red-yellow' });
});

test('the scan and a colour the reader chose meanwhile are left as they are', async () => {
  const { engine, display, store } = setup('mri');
  const opened = store.open(file('mask.nii'));
  await loading(engine);
  engine.settle({ ...summary, range: [0, 1], binary: true });
  await opened;
  expect(store.settings).toEqual({ threshold: 0.5, max: 1, opacity: 1, colours: 'red-yellow' });
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
  const refused = new MapFileError('tooManyVolumes', [300, 61]);
  engine.settle(refused);
  await second;
  expect(store.state).toEqual({ status: 'error', name: 'b.nii', error: refused });
  // The last map is not left on the stage under the error.
  expect(engine.loaded).toBeNull();
});

test('FUNC-55 · a file larger than any map is reported by name, never read nor handed to the engine', async () => {
  const { engine, store } = setup();
  const huge = file('bold.nii.gz');
  Object.defineProperty(huge, 'size', { value: MAX_FILE_BYTES + 1 });
  const read = vi.spyOn(huge, 'arrayBuffer');
  await store.open(huge);
  expect(store.state).toMatchObject({ status: 'error', name: 'bold.nii.gz' });
  const { error } = store.state as { error: MapFileError };
  expect(error).toBeInstanceOf(MapFileError);
  expect([error.code, error.params]).toEqual(['fileSize', [MAX_FILE_BYTES + 1, MAX_FILE_BYTES]]);
  expect(read).not.toHaveBeenCalled();
  expect(engine.loading).toBe(false);
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
  store.setSettings({ threshold: 3.1, max: 6, opacity: 0.8, colours: 'red-yellow' });
  store.setTitle('Faces > Houses');
  const moved = store.setSpace('spm12');
  await loading(engine);
  expect(store.state.status).toBe('loading');
  engine.settle(summary);
  await moved;
  expect(engine.loaded).toBe('spm12');
  expect(engine.shown).toEqual({ threshold: 3.1, max: 6, opacity: 0.8, colours: 'red-yellow' });
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
    volume: 0,
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
  const { engines, maps } = setup();
  maps.setSurface('mid');
  expect([maps.surface, engines.surface]).toEqual(['mid', 'mid']);
});

test('a minimum cluster size trims the drawn map and the table at the threshold drawn', async () => {
  const { engine, store } = setup();
  const opened = store.open(file('zstat1.nii.gz'));
  await loading(engine);
  engine.settle(summary);
  await opened;
  store.setSettings({ ...store.settings, threshold: 3.1 });
  store.setMinVoxels(20);
  expect(engine.extents.at(-1)).toEqual([3.1, 20, 0]);
  await expect.poll(() => store.clusters.status === 'ready' && store.clusters.minVoxels).toBe(20);
  expect(engine.clusterSizes.at(-1)).toEqual([3.1, 20, 0]);
  store.setSettings({ ...store.settings, threshold: 4 });
  expect(engine.extents.at(-1)).toEqual([4, 20, 0]);
  expect(() => store.setMinVoxels(2.5)).toThrow(RangeError);
  expect(store.minVoxels).toBe(20);
  // Each trimmed map placed says so, for the linked MRI to draw it again.
  const before = store.placed;
  store.setMinVoxels(30);
  await expect.poll(() => store.placed).toBeGreaterThan(before);
});

const series: MapSummary = { ...summary, volumes: 3, secondsPerVolume: 2 };

async function openSeries(name = 'fir.nii.gz') {
  const context = setup();
  const opened = context.store.open(file(name));
  await loading(context.engine);
  context.engine.settle(series);
  await opened;
  return context;
}

test('a series draws the volume chosen, and lists that volume’s clusters', async () => {
  const { engine, store } = await openSeries();
  expect(engine.loadedVolume).toBe(0);
  store.setSettings({ ...store.settings, threshold: 3.1 });
  store.setVolume(2);
  expect(store.volume).toBe(2);
  expect(engine.extents.at(-1)).toEqual([3.1, 0, 2]);
  await expect.poll(() => store.clusters.status === 'ready' && store.clusters.volume).toBe(2);
  expect(engine.clusterSizes.at(-1)).toEqual([3.1, 0, 2]);
  expect(() => store.setVolume(3)).toThrow(RangeError);
  expect(() => store.setVolume(1.5)).toThrow(RangeError);
  expect(store.volume).toBe(2);
});

test('a series read again in another template keeps its volume; another file starts at the first', async () => {
  const { engine, store } = await openSeries();
  store.setVolume(2);
  const reread = store.setSpace('spm12');
  await loading(engine);
  engine.settle(series);
  await reread;
  expect([engine.loadedVolume, store.volume]).toEqual([2, 2]);
  const next = store.open(file('other.nii.gz'));
  await loading(engine);
  engine.settle(series);
  await next;
  expect([engine.loadedVolume, store.volume]).toEqual([0, 0]);
});

test('a drawn series plays volume by volume and loops, listing no clusters until it is paused', async () => {
  vi.useFakeTimers();
  try {
    const { engine, store } = await openSeries();
    expect(() => store.setPlaying(true)).toThrow(/drawn series/);
    store.setSettings({ ...store.settings, threshold: 3.1 });
    store.setVolume(1);
    store.setPlaying(true);
    expect(store.clusters).toEqual({ status: 'idle' });
    await vi.advanceTimersByTimeAsync(0);
    expect(store.volume).toBe(2);
    await vi.advanceTimersByTimeAsync(1000 / VOLUMES_PER_SECOND);
    expect(store.volume).toBe(0);
    expect(engine.extents.map(([, , volume]) => volume)).toEqual([0, 1, 2, 0]);
    store.setPlaying(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(store.volume).toBe(0);
    await vi.waitFor(() =>
      expect(store.clusters.status === 'ready' && store.clusters.volume).toBe(0),
    );
    // Hiding the map stops it.
    store.setPlaying(true);
    store.setShown(false);
    expect(store.playing).toBe(false);
  } finally {
    vi.useRealTimers();
  }
});

test('a region’s course is the engine’s', async () => {
  const course = { means: Float32Array.of(1, 2, 3), counts: Uint32Array.of(5, 5, 5), points: 5 };
  const engines = createFakeUserMap(true, undefined, (region) => (region === 'v1' ? course : null));
  const store = createUserMapStore({
    engine: engines,
    display: { color: 'atlas' as SurfaceColor, setColor() {} },
  }).maps[0]!;
  const engine = engines.maps[0]!;
  const opened = store.open(file('fir.nii.gz'));
  await loading(engine);
  engine.settle(series);
  await opened;
  expect(await store.course('v1')).toBe(course);
  expect(await store.course('thalamus')).toBeNull();
});

/** A first map read and drawn in `space`, and the maps it was read into. */
async function drawnFirst(space = 'spm12') {
  const context = setup();
  const { engine, store } = context;
  const opened = store.open(file('zstat1.nii.gz'), space);
  await loading(engine);
  engine.settle(summary);
  await opened;
  store.setSettings({ ...store.settings, threshold: 3.1 });
  return context;
}

test('FUNC-60 · a map added beside another goes on top in its template, in the other colour scale', async () => {
  const { engines, display, maps, store } = await drawnFirst();
  expect(maps.free).toBe(1);
  const added = maps.add(file('mask.nii'));
  const second = maps.maps[1]!;
  await loading(engines.maps[1]!);
  engines.maps[1]!.settle({ ...summary, range: [0, 1], binary: true });
  await added;
  expect([maps.top, engines.top]).toEqual([1, 1]);
  expect(engines.maps[1]!.loaded).toBe('spm12');
  expect(second.settings).toEqual({ threshold: 0.5, max: 1, opacity: 1, colours: 'green-magenta' });
  expect(maps.drawnMaps.map((map) => map.slot)).toEqual([1, 0]);
  expect(maps.free).toBeNull();
  expect(() => maps.add(file('third.nii'))).toThrow(/Every map slot/);
  // The tissue colour is held until the last drawn map goes.
  expect(display.color).toBe('tissue');
  store.setShown(false);
  expect(display.color).toBe('tissue');
  second.remove();
  expect(display.color).toBe('atlas');
  expect(maps.listed.map((map) => map.slot)).toEqual([0]);
});

test('FUNC-60 · either map can be drawn on top, but only a loaded one', async () => {
  const { engines, maps } = await drawnFirst();
  expect(() => maps.setTop(1)).toThrow(/slot 1/);
  const added = maps.add(file('b.nii'));
  await loading(engines.maps[1]!);
  engines.maps[1]!.settle(summary);
  await added;
  maps.setTop(0);
  expect([maps.top, engines.top]).toEqual([0, 0]);
  expect(maps.listed.map((map) => map.slot)).toEqual([0, 1]);
  // A map added in place of the one underneath goes over the one left.
  maps.maps[1]!.remove();
  const again = maps.add(file('c.nii'));
  await loading(engines.maps[1]!);
  engines.maps[1]!.settle(summary);
  await again;
  expect([maps.top, engines.top]).toEqual([1, 1]);
});

test('FUNC-62 · a second series is refused while the other map is one, which stays as it was drawn', async () => {
  const { engines, maps, store } = await drawnFirst();
  const added = maps.add(file('fir.nii.gz'));
  await loading(engines.maps[1]!);
  engines.maps[1]!.settle(series);
  await added;
  expect(maps.maps[1]!.state.status).toBe('ready');
  // Read again in place of the first: now both would step through volumes.
  const again = store.open(file('fir2.nii.gz'));
  await loading(engines.maps[0]!);
  engines.maps[0]!.settle(series);
  await again;
  expect(store.state).toMatchObject({ status: 'error', name: 'fir2.nii.gz' });
  expect((store.state as { error: MapFileError }).error.code).toBe('secondSeries');
  expect(engines.maps[0]!.loaded).toBeNull();
  expect(maps.maps[1]!.state).toMatchObject({ status: 'ready', summary: series });
  expect(engines.maps[1]!.loaded).toBe('spm12');
});

test('FUNC-60 · a removed map leaves nothing of itself in its slot: the next map read there is drawn whole', async () => {
  const { engines, maps } = await drawnFirst();
  const second = maps.maps[1]!;
  const added = maps.add(file('b.nii'));
  await loading(engines.maps[1]!);
  engines.maps[1]!.settle(summary);
  await added;
  second.setSettings({ ...second.settings, threshold: 3 });
  second.setMinVoxels(20);
  second.setShown(false);
  second.setTitle('Faces');
  second.remove();
  const again = maps.add(file('c.nii'));
  await loading(engines.maps[1]!);
  engines.maps[1]!.settle(summary);
  await again;
  second.setSettings({ ...second.settings, threshold: 3 });
  expect([second.shown, second.drawn, second.minVoxels, second.title]).toEqual([
    true,
    true,
    0,
    'c',
  ]);
  expect(engines.maps[1]!.extents.at(-1)).toEqual([3, 0, 0]);
});
