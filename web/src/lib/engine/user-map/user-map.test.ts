import assert from 'node:assert/strict';
import { afterEach, test, vi } from 'vitest';
import { BufferAttribute, BufferGeometry, Mesh, MeshPhysicalMaterial } from 'three';
import type { CarriedMap } from '../../core/user-map/carry.ts';
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

/** Carries every map with its token as the cortex's value, or answers with `refusal`. */
class FakeWorker {
  static refusal: Omit<Extract<UserMapReply, { error: string }>, 'token'> | null = null;
  onmessage: ((event: { data: UserMapReply }) => void) | null = null;
  postMessage({ token }: UserMapJob) {
    const { refusal } = FakeWorker;
    if (refusal) {
      queueMicrotask(() => this.onmessage!({ data: { token, ...structuredClone(refusal) } }));
      return;
    }
    const map: CarriedMap = {
      grid: { shape: [1, 1, 1], origin: [0, 0, 0], spacing: 1 },
      volume: new Float32Array(1),
      cortex: { left: new Float32Array([token]), right: new Float32Array([token]) },
      summary: {} as CarriedMap['summary'],
    };
    queueMicrotask(() => this.onmessage!({ data: { token, map } }));
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

function setup() {
  vi.stubGlobal('Worker', FakeWorker);
  const parcel = (region: string, hemisphere: string) => {
    const material = new MeshPhysicalMaterial();
    material.userData['userMapReady'] = { value: false };
    return Object.assign(new Mesh(triangle(0.01), material), {
      userData: { region_id: region, hemisphere },
    });
  };
  // Two cortical atlases, each a parcel a hemisphere.
  const layers = new Map(
    ['hcp', 'julich'].map((id) => [id, { meshes: [parcel('a', 'left'), parcel('b', 'right')] }]),
  );
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
});

const ready = (mesh: Mesh) =>
  (mesh.material as MeshPhysicalMaterial).userData['userMapReady'].value as boolean;

test('each map and extent is written over the cortex’s own buffer, and a removed map is hidden', async () => {
  const { userMap, mesh } = setup();
  await userMap.load(new ArrayBuffer(4), 'mni');
  const drawn = mesh.geometry.getAttribute('_user_map');
  assert.deepEqual([...drawn.array], [1, 1, 1, 1, 1, 1]);
  assert.equal(ready(mesh), true);
  await userMap.extent(2, 5);
  assert.equal(mesh.geometry.getAttribute('_user_map'), drawn);
  assert.deepEqual([...drawn.array], [2, 2, 2, 2, 2, 2]);
  assert.equal((drawn as BufferAttribute).version, 1);
  userMap.clear();
  assert.equal(ready(mesh), false);
});

test('the cortex moves between surfaces in its own buffers and comes back to the published pial', async () => {
  const { userMap, mesh } = setup();
  const position = mesh.geometry.getAttribute('position');
  const normal = mesh.geometry.getAttribute('normal');
  const pial = [...position.array];
  const pialNormals = [...normal.array];
  await userMap.load(new ArrayBuffer(4), 'mni');
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

test('a file the worker refused rejects with its code, for the overlay to word', async () => {
  const { userMap } = setup();
  FakeWorker.refusal = {
    error: 'This map holds only zeros.',
    file: { code: 'zeros', params: [] },
  };
  const refused = await userMap.load(new ArrayBuffer(4), 'mni').catch((error: unknown) => error);
  assert.ok(refused instanceof MapFileError);
  assert.equal(refused.code, 'zeros');
});

test('an atlas changed while its parcels were being moved is left on the pial', async () => {
  const { userMap, atlas, layers } = setup();
  await userMap.load(new ArrayBuffer(4), 'mni');
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
