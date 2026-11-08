import assert from 'node:assert/strict';
import { afterEach, test, vi } from 'vitest';
import { BoxGeometry, BufferAttribute, BufferGeometry, Mesh, MeshPhysicalMaterial } from 'three';
import { computeBoundsTree } from 'three-mesh-bvh';
import type { CarriedMap } from '../../core/user-map/carry.ts';
import type { MapSummary } from '../../core/user-map/display.ts';
import { MapFileError } from '../../core/user-map/map-file-error.ts';
import type { BrainAtlas } from '../model/brain-atlas.ts';
import { createUserMapUniforms } from './overlay.ts';
import type { UserMapJob, UserMapReply } from './user-map-worker.ts';
import { createUserMap } from './user-map.ts';

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
  onmessage: ((event: { data: UserMapReply }) => void) | null = null;
  reply(data: UserMapReply) {
    const send = () => this.onmessage!({ data });
    if (FakeWorker.held) FakeWorker.held.push(send);
    else queueMicrotask(send);
  }
  postMessage(job: UserMapJob) {
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
    material.userData['userMapReady'] = { value: false };
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
  const userMap = createUserMap({
    atlas: atlas as unknown as BrainAtlas,
    sections: { setUserMap() {} },
    baseUrl: new URL('https://planum.test/'),
    invalidate() {},
  });
  return { userMap, atlas, mesh: layers.get('hcp')!.meshes[0]!, layers };
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeWorker.refusal = null;
  FakeWorker.jobs = [];
  FakeWorker.held = null;
});

const ready = (mesh: Mesh) =>
  (mesh.material as MeshPhysicalMaterial).userData['userMapReady'].value as boolean;

test('each map and extent is written over the cortex’s own buffer, and a removed map is hidden', async () => {
  const { userMap, mesh } = setup();
  await userMap.load(new ArrayBuffer(4), 'mni', 0);
  const drawn = mesh.geometry.getAttribute('_user_map');
  assert.deepEqual([...drawn.array], [1, 1, 1, 1, 1, 1]);
  assert.equal(ready(mesh), true);
  await userMap.extent(2, 5, 0);
  assert.equal(mesh.geometry.getAttribute('_user_map'), drawn);
  assert.deepEqual([...drawn.array], [2, 2, 2, 2, 2, 2]);
  assert.equal((drawn as BufferAttribute).version, 1);
  userMap.clear();
  assert.equal(ready(mesh), false);
});

test('a new volume of a series moves from the last one drawn, on the grid and the cortex', async () => {
  const { userMap, atlas, mesh } = setup();
  const uniforms = atlas.userMap;
  await userMap.load(new ArrayBuffer(4), 'mni', 0);
  const first = uniforms.userMapVolume.value;
  assert.ok(first);
  assert.equal(uniforms.userMapPrevious.value, null);
  await userMap.extent(1, 0, 1);
  assert.equal(uniforms.userMapPrevious.value, first);
  assert.notEqual(uniforms.userMapVolume.value, first);
  assert.equal(uniforms.userMapBlend.value, 0);
  assert.deepEqual([...mesh.geometry.getAttribute('_user_map_previous').array], [1, 1, 1, 1, 1, 1]);
  assert.deepEqual([...mesh.geometry.getAttribute('_user_map').array], [2, 2, 2, 2, 2, 2]);
  drawFrames(100);
  assert.ok(uniforms.userMapBlend.value > 0 && uniforms.userMapBlend.value < 1);
  drawFrames(1000);
  assert.equal(uniforms.userMapBlend.value, 1);
  assert.equal(uniforms.userMapPrevious.value, null);
});

test('a new extent of the same volume, or any volume under reduced motion, is drawn at once', async () => {
  const { userMap, atlas } = setup();
  const uniforms = atlas.userMap;
  await userMap.load(new ArrayBuffer(4), 'mni', 0);
  await userMap.extent(1, 5, 0);
  assert.equal(uniforms.userMapPrevious.value, null);
  assert.equal(uniforms.userMapBlend.value, 1);
  assert.equal(frames.size, 0);
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }));
  await userMap.extent(1, 5, 1);
  assert.equal(uniforms.userMapPrevious.value, null);
  assert.equal(uniforms.userMapBlend.value, 1);
  assert.equal(frames.size, 0);
});

test('the cortex moves between surfaces in its own buffers and comes back to the published pial', async () => {
  const { userMap, mesh } = setup();
  const position = mesh.geometry.getAttribute('position');
  const normal = mesh.geometry.getAttribute('normal');
  const pial = [...position.array];
  const pialNormals = [...normal.array];
  await userMap.load(new ArrayBuffer(4), 'mni', 0);
  userMap.show({ threshold: 1, max: 2, opacity: 1 });
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
  const { userMap } = setup();
  FakeWorker.refusal = {
    error: 'This map holds only zeros.',
    file: { code: 'zeros', params: [] },
  };
  const refused = await userMap.load(new ArrayBuffer(4), 'mni', 0).catch((error: unknown) => error);
  assert.ok(refused instanceof MapFileError);
  assert.equal(refused.code, 'zeros');
});

test('an atlas changed while its parcels were being moved is left on the pial', async () => {
  const { userMap, atlas, layers } = setup();
  await userMap.load(new ArrayBuffer(4), 'mni', 0);
  userMap.show({ threshold: 1, max: 2, opacity: 1 });
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
  const { userMap, mesh } = setup();
  assert.deepEqual(await userMap.load(new ArrayBuffer(4), 'mni', 1), { volumes: 3 });
  // Below two voxels nothing is trimmed, so the volume carried at load is the one drawn at any threshold.
  await userMap.extent(2, 0, 1);
  await userMap.extent(3, 1, 1);
  await userMap.extent(2, 0, 2);
  await userMap.extent(2, 5, 2);
  await userMap.extent(2, 5, 2);
  const jobs = FakeWorker.jobs.map((job) =>
    job.kind === 'carry' || job.kind === 'extent' ? [job.kind, job.volume] : [job.kind],
  );
  assert.deepEqual(jobs, [
    ['carry', 1],
    ['extent', 2],
    ['extent', 2],
  ]);
  assert.deepEqual([...mesh.geometry.getAttribute('_user_map').array], [3, 3, 3, 3, 3, 3]);
});

test('a structure’s course is read at its whole millimetres; a region without a solid has none', async () => {
  const { userMap } = setup();
  await userMap.load(new ArrayBuffer(4), 'mni', 0);
  // −1, 0 and 1 mm along each axis of the 3 mm cube.
  const course = await userMap.course('thalamus');
  assert.equal(course?.points, 27);
  assert.equal(await userMap.course('nowhere'), null);
  // The worker is sent a copy, so the points kept for the region survive the transfer.
  await userMap.course('thalamus');
  const sent = FakeWorker.jobs.filter((job) => job.kind === 'course');
  assert.equal(sent.length, 2);
  assert.notEqual(sent[0]!.points, sent[1]!.points);
});

test('volumes asked for while one is carried are sent only if still the newest when it is done', async () => {
  const { userMap } = setup();
  await userMap.load(new ArrayBuffer(4), 'mni', 0);
  const carried = () =>
    FakeWorker.jobs.flatMap((job) => (job.kind === 'extent' ? [job.volume] : []));
  const outcome = (volume: number) =>
    userMap.extent(2, 0, volume).then(
      () => 'drawn',
      (error: Error) => error.name,
    );
  FakeWorker.held = [];
  const first = outcome(1);
  await vi.waitFor(() => assert.deepEqual(carried(), [1]));
  const later = [2, 3, 4].map(outcome);
  FakeWorker.held.shift()!();
  await vi.waitFor(() => assert.deepEqual(carried(), [1, 4]));
  FakeWorker.held.shift()!();
  // The first was carried, but is not drawn over the newer one asked for meanwhile.
  assert.deepEqual(await Promise.all([first, ...later]), [
    'AbortError',
    'AbortError',
    'AbortError',
    'drawn',
  ]);
});
