import assert from 'node:assert/strict';
import { afterAll, afterEach, test, vi } from 'vitest';
import { BoxGeometry, BufferAttribute, BufferGeometry, Mesh, MeshPhysicalMaterial } from 'three';
import { computeBoundsTree } from 'three-mesh-bvh';
import type { CarriedMap } from '../../core/user-map/carry.ts';
import type { MapSummary } from '../../core/user-map/display.ts';
import { MapFileError } from '../../core/user-map/map-file-error.ts';
import { AssetError } from '../../core/assets/published-assets.ts';
import type { BrainAtlas } from '../model/brain-atlas.ts';
import type { SliceMap } from '../slices/sampling.ts';
import { createUserMapUniforms } from './overlay.ts';
import type { UserMapJob, UserMapReply } from './user-map-worker.ts';
import { createUserMap } from './user-map.ts';

// The unit files share one module cache (isolate: false): import this file's modules afresh under its
// mocks, and leave none built on them to the next file.
vi.hoisted(() => vi.resetModules());
afterAll(() => {
  vi.resetModules();
});

vi.mock('../../core/assets/asset-cache.ts', () => ({
  fetchAsset: async () => new Uint16Array([0, 0]).buffer,
}));
vi.mock('../../core/coordinates/field.ts', () => ({
  loadFieldData: async () => new Int16Array(1),
}));
// One parcel a hemisphere, its three vertices the native ones; the parents are the parcels' indices.
vi.mock('../../core/user-map/partition.ts', () => ({
  partitionParents: (_: unknown, parcels: Map<number, unknown>) => [...parcels.keys()],
  partitionField: (parents: number[], values: ArrayLike<number>) =>
    new Map(parents.map((index) => [index, new Float32Array(6).fill(values[0]!)])),
  partitionPoints: (parents: number[], native: ArrayLike<number>) =>
    new Map(parents.map((index) => [index, Float32Array.from(native)])),
}));

/**
 * Carries every map with its token as the cortex's value, gives a region's point count as its course,
 * or answers with `refusal`; keeps each job.
 */
class FakeWorker {
  static refusal: Omit<Extract<UserMapReply, { error: string }>, 'token'> | null = null;
  static jobs: UserMapJob[] = [];
  /** Replies kept until the test sends them, while it holds the worker busy. */
  static held: (() => void)[] | null = null;
  /** The worker script is gone, as after a newer deploy: every worker fails to load. */
  static unloaded = false;
  static created = 0;
  onmessage: ((event: { data: UserMapReply }) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  constructor() {
    FakeWorker.created += 1;
  }
  reply(data: UserMapReply) {
    const send = () => this.onmessage!({ data });
    if (FakeWorker.held) FakeWorker.held.push(send);
    else queueMicrotask(send);
  }
  postMessage(job: UserMapJob) {
    if (FakeWorker.unloaded) {
      queueMicrotask(() => this.onerror!(new Event('error')));
      return;
    }
    FakeWorker.jobs.push(job);
    const { token } = job;
    const { refusal } = FakeWorker;
    if (refusal) {
      this.reply({ token, ...structuredClone(refusal) });
      return;
    }
    if (job.kind === 'course') {
      const points = job.points.length / 3;
      const course = { means: Float32Array.of(points), counts: Uint32Array.of(points), points };
      this.reply({ token, course });
      return;
    }
    const map: CarriedMap = {
      grid: { shape: [1, 1, 1], origin: [0, 0, 0], spacing: 1 },
      volume: new Float32Array(2),
      cortex: { left: new Float32Array([token]), right: new Float32Array([token]) },
    };
    const summary = { volumes: 3 } as MapSummary;
    this.reply({ token, map, summary });
  }
  terminate() {}
}

const triangle = (x: number) => {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array([x, 0, 0, 0, x, 0, 0, 0, 1]), 3),
  );
  // As the assets store them (KHR_mesh_quantization): float positions, normalized Int16 normals.
  geometry.setAttribute(
    'normal',
    new BufferAttribute(new Int16Array([0, 0, 32767, 0, 0, 32767, 0, 0, 32767]), 3, true),
  );
  geometry.setIndex([0, 1, 2]);
  return geometry;
};

/** Frames requested and not yet drawn; a test draws them with `drawFrames`. */
let frames = new Map<number, FrameRequestCallback>();
let frameId = 0;
/** Draw the requested frames at `after` ms from now, and the frames they request in turn. */
function drawFrames(after: number) {
  for (let left = 100; frames.size && left; left--) {
    const due = [...frames.values()];
    frames = new Map();
    for (const frame of due) frame(performance.now() + after);
  }
}

function setup() {
  vi.stubGlobal('Worker', FakeWorker);
  frames = new Map();
  vi.stubGlobal('requestAnimationFrame', (frame: FrameRequestCallback) => {
    frames.set(++frameId, frame);
    return frameId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  const parcel = (region: string, hemisphere: string) => {
    const material = new MeshPhysicalMaterial();
    material.userData['userMapReady'] = [{ value: false }, { value: false }];
    return Object.assign(new Mesh(triangle(0.01), material), {
      userData: { region_id: region, hemisphere },
    });
  };
  // A 3 mm cube of a structure at the origin (glTF metres).
  const cube = new BoxGeometry(0.003, 0.003, 0.003);
  cube.boundsTree = computeBoundsTree.call(cube);
  const structure = Object.assign(new Mesh(cube), {
    userData: { region_id: 'thalamus', kind: 'structure' },
  });
  // Two cortical atlases, each a parcel a hemisphere, and the structures.
  const layers = new Map<string, { meshes: Mesh[] }>([
    ...['hcp', 'julich'].map((id): [string, { meshes: Mesh[] }] => [
      id,
      { meshes: [parcel('a', 'left'), parcel('b', 'right')] },
    ]),
    ['structures', { meshes: [structure] }],
  ]);
  const envelopes = ['left', 'right'].flatMap((hemisphere) =>
    [
      ['pial', 0.01],
      ['white', 0.03],
    ].map(([boundary, x]) =>
      Object.assign(new Mesh(triangle(x as number)), { userData: { hemisphere, boundary } }),
    ),
  );
  const atlas = Object.assign(new EventTarget(), {
    userMap: createUserMapUniforms(),
    layers,
    manifest: {
      atlases: [...layers.keys()].map((id) => ({
        id,
        ribbon_labels: {
          file: `${id}.labels`,
          vertex_counts: { left: 1, right: 1 },
          region_ids: ['a', 'b'],
        },
      })),
      coordinate_spaces: { spaces: [{ id: 'mni', field: {} }], unstated: { reads_as: 'mni' } },
      appearance: { tissue: { cortex: '#808080' } },
    },
    settings: { atlas: 'hcp', cutActive: false },
    ensureEnvelopes: async () => envelopes,
    ensureRibbonWedges: async () => [],
  });
  atlas.addEventListener('loaderror', (event) => {
    throw (event as CustomEvent).detail;
  });
  // Each list of maps the linked MRI was given, as slots in drawing order.
  const sliced: number[][] = [];
  const userMap = createUserMap({
    atlas: atlas as unknown as BrainAtlas,
    sections: {
      setUserMaps: (maps: readonly SliceMap[]) => sliced.push(maps.map((map) => map.slot)),
    },
    baseUrl: new URL('https://planum.test/'),
    invalidate() {},
  });
  const [first, second] = userMap.maps as [
    (typeof userMap.maps)[number],
    (typeof userMap.maps)[number],
  ];
  return { userMap, first, second, sliced, atlas, mesh: layers.get('hcp')!.meshes[0]!, layers };
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeWorker.refusal = null;
  FakeWorker.jobs = [];
  FakeWorker.held = null;
  FakeWorker.unloaded = false;
  FakeWorker.created = 0;
});

const ready = (mesh: Mesh, slot = 0) =>
  (mesh.material as MeshPhysicalMaterial).userData['userMapReady'][slot].value as boolean;
const display = { threshold: 1, max: 2, opacity: 1, colours: 'red-yellow' } as const;
/** Slot 0's values at the three vertices, the vec4's first half: (sum, share) pairs. */
const own = (values: ArrayLike<number>, slot = 0) =>
  Array.from({ length: values.length / 4 }, (_, v) => [
    values[4 * v + 2 * slot],
    values[4 * v + 2 * slot + 1],
  ]).flat();

test('each map and extent is written over the cortex’s own buffer, and a removed map is hidden', async () => {
  const { first, mesh } = setup();
  await first.load(new ArrayBuffer(4), 'mni', 0);
  const drawn = mesh.geometry.getAttribute('_user_map');
  assert.deepEqual([...drawn.array], [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0]);
  assert.equal(ready(mesh), true);
  const version = (drawn as BufferAttribute).version;
  await first.extent(2, 5, 0);
  assert.equal(mesh.geometry.getAttribute('_user_map'), drawn);
  assert.deepEqual(own(drawn.array), [2, 2, 2, 2, 2, 2]);
  assert.equal((drawn as BufferAttribute).version, version + 1);
  first.clear();
  assert.equal(ready(mesh), false);
});

test('a new volume of a series moves from the last one drawn, on the grid and the cortex', async () => {
  const { first, atlas, mesh } = setup();
  const uniforms = atlas.userMap;
  await first.load(new ArrayBuffer(4), 'mni', 0);
  const loaded = uniforms.userMapVolume0.value;
  assert.ok(loaded);
  assert.equal(uniforms.userMapPrevious.value, null);
  await first.extent(1, 0, 1);
  assert.equal(uniforms.userMapPrevious.value, loaded);
  assert.notEqual(uniforms.userMapVolume0.value, loaded);
  assert.equal(uniforms.userMapBlend.value, 0);
  assert.equal(uniforms.userMapMoving.value, 0);
  assert.deepEqual(own(mesh.geometry.getAttribute('_user_map_previous').array), [1, 1, 1, 1, 1, 1]);
  assert.deepEqual(own(mesh.geometry.getAttribute('_user_map').array), [2, 2, 2, 2, 2, 2]);
  drawFrames(100);
  assert.ok(uniforms.userMapBlend.value > 0 && uniforms.userMapBlend.value < 1);
  drawFrames(1000);
  assert.equal(uniforms.userMapBlend.value, 1);
  assert.equal(uniforms.userMapPrevious.value, null);
});

test('a new extent of the same volume, or any volume under reduced motion, is drawn at once', async () => {
  const { first, atlas } = setup();
  const uniforms = atlas.userMap;
  await first.load(new ArrayBuffer(4), 'mni', 0);
  await first.extent(1, 5, 0);
  assert.equal(uniforms.userMapPrevious.value, null);
  assert.equal(uniforms.userMapBlend.value, 1);
  assert.equal(frames.size, 0);
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }));
  await first.extent(1, 5, 1);
  assert.equal(uniforms.userMapPrevious.value, null);
  assert.equal(uniforms.userMapBlend.value, 1);
  assert.equal(frames.size, 0);
});

test('the cortex moves between surfaces in its own buffers and comes back to the published pial', async () => {
  const { userMap, first, mesh } = setup();
  const position = mesh.geometry.getAttribute('position');
  const normal = mesh.geometry.getAttribute('normal');
  const pial = [...position.array];
  const pialNormals = [...normal.array];
  await first.load(new ArrayBuffer(4), 'mni', 0);
  first.show(display);
  const x = () => position.array[0]!;
  userMap.setSurface('white');
  await vi.waitFor(() => assert.ok(Math.abs(x() - 0.03) < 1e-7));
  // The white triangle's own normal, quantized into the stored Int16 normals.
  const [nx, ny, nz] = [1 / 0.03, 1 / 0.03, 1].map((n, _, all) => n / Math.hypot(...all));
  const quantized = [nx, ny, nz].map((n) => Math.round(n! * 32767));
  assert.deepEqual([...normal.array], [...quantized, ...quantized, ...quantized]);
  userMap.setSurface('mid');
  await vi.waitFor(() => assert.ok(Math.abs(x() - 0.02) < 1e-7));
  userMap.setSurface('pial');
  await vi.waitFor(() => assert.deepEqual([...position.array], pial));
  assert.deepEqual([...normal.array], pialNormals);
  assert.equal(mesh.geometry.getAttribute('position'), position);
  assert.equal(mesh.geometry.getAttribute('normal'), normal);
});

test('the cortex takes the chosen surface without a map, and the pial under a cut', async () => {
  const { userMap, atlas, mesh } = setup();
  const x = () => mesh.geometry.getAttribute('position').array[0]!;
  userMap.setSurface('white');
  await vi.waitFor(() => assert.ok(Math.abs(x() - 0.03) < 1e-7));
  atlas.settings.cutActive = true;
  atlas.dispatchEvent(new Event('change'));
  await vi.waitFor(() => assert.equal(x(), Math.fround(0.01)));
  atlas.settings.cutActive = false;
  atlas.dispatchEvent(new Event('change'));
  await vi.waitFor(() => assert.ok(Math.abs(x() - 0.03) < 1e-7));
});

test('a file the worker refused rejects with its code, for the overlay to word', async () => {
  const { first } = setup();
  FakeWorker.refusal = {
    error: 'This map holds only zeros.',
    file: { code: 'zeros', params: [] },
  };
  const refused = await first.load(new ArrayBuffer(4), 'mni', 0).catch((error: unknown) => error);
  assert.ok(refused instanceof MapFileError);
  assert.equal(refused.code, 'zeros');
});

test('a worker script a newer deploy removed rejects as updated, and the next load tries a new worker', async () => {
  const { first } = setup();
  vi.stubGlobal('dispatchEvent', () => true);
  FakeWorker.unloaded = true;
  for (const attempt of [1, 2]) {
    const failed = await first.load(new ArrayBuffer(4), 'mni', 0).catch((error: unknown) => error);
    assert.ok(failed instanceof AssetError);
    assert.equal(failed.code, 'asset-updated');
    assert.equal(FakeWorker.created, attempt);
  }
});

test('ATLAS-10 an atlas released and loaded again is painted and moved on its new meshes', async () => {
  const { userMap, first, atlas, layers } = setup();
  await first.load(new ArrayBuffer(4), 'mni', 0);
  first.show(display);
  userMap.setSurface('white');
  const released = layers.get('hcp')!.meshes[0]!;
  await vi.waitFor(() => assert.ok(ready(released)));
  const show = async (id: string) => {
    atlas.settings.atlas = id;
    atlas.dispatchEvent(new Event('change'));
    await vi.waitFor(() =>
      assert.ok(layers.get(id)!.meshes.every((mesh) => mesh.geometry.getAttribute('_user_map'))),
    );
  };
  await show('julich');
  // The model let `hcp` go and loaded it again: new meshes, on the published pial.
  layers.set('hcp', {
    meshes: (['left', 'right'] as const).map((hemisphere, at) => {
      const material = new MeshPhysicalMaterial();
      material.userData['userMapReady'] = [{ value: false }, { value: false }];
      return Object.assign(new Mesh(triangle(0.01), material), {
        userData: { region_id: 'ab'[at], hemisphere },
      });
    }),
  });
  await show('hcp');
  const [loaded] = layers.get('hcp')!.meshes;
  assert.equal(ready(loaded!), true);
  await vi.waitFor(() =>
    assert.ok(Math.abs(loaded!.geometry.getAttribute('position').array[0]! - 0.03) < 1e-7),
  );
});

test('an atlas changed while its parcels were being moved is left on the pial', async () => {
  const { userMap, first, atlas, layers } = setup();
  await first.load(new ArrayBuffer(4), 'mni', 0);
  first.show(display);
  const [hcp, julich] = ['hcp', 'julich'].map(
    (id) => layers.get(id)!.meshes[0]!.geometry.getAttribute('position').array,
  );
  userMap.setSurface('white');
  atlas.settings.atlas = 'julich';
  atlas.dispatchEvent(new Event('change'));
  await vi.waitFor(() => assert.ok(Math.abs(julich![0]! - 0.03) < 1e-7));
  assert.equal(hcp![0], Math.fround(0.01));
});

test('a volume is carried once for each volume and extent asked for, never again for the one drawn', async () => {
  const { first, mesh } = setup();
  assert.deepEqual(await first.load(new ArrayBuffer(4), 'mni', 1), { volumes: 3 });
  // Below two voxels nothing is trimmed, so the volume carried at load is the one drawn at any threshold.
  await first.extent(2, 0, 1);
  await first.extent(3, 1, 1);
  await first.extent(2, 0, 2);
  await first.extent(2, 5, 2);
  await first.extent(2, 5, 2);
  const jobs = FakeWorker.jobs.map((job) =>
    job.kind === 'carry' || job.kind === 'extent' ? [job.kind, job.volume] : [job.kind],
  );
  assert.deepEqual(jobs, [
    ['carry', 1],
    ['extent', 2],
    ['extent', 2],
  ]);
  assert.deepEqual(own(mesh.geometry.getAttribute('_user_map').array), [3, 3, 3, 3, 3, 3]);
});

test('a structure’s course is read at its whole millimetres; a region without a solid has none', async () => {
  const { first } = setup();
  await first.load(new ArrayBuffer(4), 'mni', 0);
  // −1, 0 and 1 mm along each axis of the 3 mm cube.
  const course = await first.course('thalamus');
  assert.equal(course?.points, 27);
  assert.equal(await first.course('nowhere'), null);
  // The worker is sent a copy, so the points kept for the region survive the transfer.
  await first.course('thalamus');
  const sent = FakeWorker.jobs.filter((job) => job.kind === 'course');
  assert.equal(sent.length, 2);
  assert.notEqual(sent[0]!.points, sent[1]!.points);
});

test('volumes asked for while one is carried are sent only if still the newest when it is done', async () => {
  const { first } = setup();
  await first.load(new ArrayBuffer(4), 'mni', 0);
  const carried = () =>
    FakeWorker.jobs.flatMap((job) => (job.kind === 'extent' ? [job.volume] : []));
  const outcome = (volume: number) =>
    first.extent(2, 0, volume).then(
      () => 'drawn',
      (error: Error) => error.name,
    );
  FakeWorker.held = [];
  const earliest = outcome(1);
  await vi.waitFor(() => assert.deepEqual(carried(), [1]));
  const later = [2, 3, 4].map(outcome);
  FakeWorker.held.shift()!();
  await vi.waitFor(() => assert.deepEqual(carried(), [1, 4]));
  FakeWorker.held.shift()!();
  // The first was carried, but is not drawn over the newer one asked for meanwhile.
  assert.deepEqual(await Promise.all([earliest, ...later]), [
    'AbortError',
    'AbortError',
    'AbortError',
    'drawn',
  ]);
});

test('FUNC-60 · two maps write their own halves of each vertex, and removing one hides only its own', async () => {
  const { first, second, mesh } = setup();
  await first.load(new ArrayBuffer(4), 'mni', 0);
  await second.load(new ArrayBuffer(4), 'mni', 0);
  const drawn = mesh.geometry.getAttribute('_user_map');
  // The worker carries each map with its token as every value: 1 for the first, 2 for the second.
  assert.deepEqual([...drawn.array], [1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 2, 2]);
  assert.deepEqual([ready(mesh, 0), ready(mesh, 1)], [true, true]);
  second.clear();
  assert.deepEqual([ready(mesh, 0), ready(mesh, 1)], [true, false]);
  const jobs = FakeWorker.jobs.map((job) => [job.kind, job.slot]);
  assert.deepEqual(jobs, [
    ['carry', 0],
    ['carry', 1],
  ]);
});

test('FUNC-60 · the linked MRI is given the drawn maps under first, and the one on top follows setTop', async () => {
  const { userMap, first, second, sliced, atlas } = setup();
  await first.load(new ArrayBuffer(4), 'mni', 0);
  await second.load(new ArrayBuffer(4), 'mni', 0);
  first.show(display);
  second.show({ ...display, colours: 'green-magenta' });
  assert.equal(atlas.userMap.userMapTop.value, 1);
  assert.deepEqual(sliced.at(-1), [0, 1]);
  userMap.setTop(0);
  assert.equal(atlas.userMap.userMapTop.value, 0);
  assert.deepEqual(sliced.at(-1), [1, 0]);
  first.show(null);
  assert.deepEqual(sliced.at(-1), [1]);
  assert.throws(() => userMap.setTop(2), RangeError);
});

test('FUNC-60 · another map placed while a series moves leaves the move alone', async () => {
  const { first, second, atlas } = setup();
  const uniforms = atlas.userMap;
  await first.load(new ArrayBuffer(4), 'mni', 0);
  await second.load(new ArrayBuffer(4), 'mni', 0);
  await first.extent(1, 0, 1);
  const held = uniforms.userMapPrevious.value;
  assert.ok(held);
  assert.equal(uniforms.userMapMoving.value, 0);
  // A new extent of the other map, without a volume change: drawn at once, the series keeps moving.
  await second.extent(1, 5, 0);
  assert.equal(uniforms.userMapPrevious.value, held);
  assert.equal(uniforms.userMapBlend.value, 0);
  drawFrames(1000);
  assert.equal(uniforms.userMapPrevious.value, null);
  assert.equal(uniforms.userMapBlend.value, 1);
});
