import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Mesh } from 'three';
import type { BufferGeometry } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { test } from 'vitest';
import { modelDirectory } from '../../engine/model/test-support.ts';
import type { Manifest } from '../../types/index.ts';
import { anatomies, readModel } from '../catalog/test-support.ts';
import { partitionField, partitionParents, partitionPoints } from './partition.ts';

// One triangle whose corners are parcels 1, 1 and 2: its three edges and its centre are added.
const corners = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
];
const mean = (...vertices: number[]) =>
  [0, 1, 2].map(
    (axis) => vertices.reduce((sum, v) => sum + corners[v]![axis]!, 0) / vertices.length,
  );
const surface = { faces: [0, 1, 2], pial: corners.flat(), labels: [1, 1, 2] };

test('a parcel keeps its native vertices, then its edge midpoints in sorted order, then the centre', () => {
  // Parcel 1: vertices 0 and 1, edges (0,1), (0,2), (1,2), the centre. Parcel 2: vertex 2, edges (0,2), (1,2), the centre.
  const parcels = new Map([
    [
      1,
      [
        ...corners[0]!,
        ...corners[1]!,
        ...mean(0, 1),
        ...mean(0, 2),
        ...mean(1, 2),
        ...mean(0, 1, 2),
      ],
    ],
    [2, [...corners[2]!, ...mean(0, 2), ...mean(1, 2), ...mean(0, 1, 2)]],
  ]);
  const fields = partitionField(partitionParents(surface, parcels), [4, NaN, 10]);
  // (sum over parents with a value / parents, share of parents with a value)
  assert.deepEqual(
    [...fields.get(1)!],
    [4, 1, 0, 0, 2, 0.5, 7, 1, 5, 0.5, 14 / 3, 2 / 3].map(Math.fround),
  );
  assert.deepEqual([...fields.get(2)!], [10, 1, 7, 1, 5, 0.5, 14 / 3, 2 / 3].map(Math.fround));
});

test('a parcel whose vertices are not where its native surface puts them is refused', () => {
  const swapped = new Map([[2, [...corners[2]!, ...mean(1, 2), ...mean(0, 2), ...mean(0, 1, 2)]]]);
  assert.throws(() => partitionParents(surface, swapped), /vertex 1 is not where/);
  const short = new Map([[2, [...corners[2]!, ...mean(0, 2), ...mean(1, 2)]]]);
  assert.throws(
    () => partitionParents(surface, short),
    /has 3 vertices; its native surface gives 4/,
  );
});

// Every published cortical atlas tiles the published native pial surface the way the build did.
const directory = modelDirectory(anatomies.default);
const manifest = readModel<Manifest>(`${anatomies.default}/manifest.json`);
const scene = async (file: string) => {
  const bytes = await readFile(new URL(file, directory));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const meshes: Mesh<BufferGeometry>[] = [];
  (await new GLTFLoader().parseAsync(buffer as ArrayBuffer, '')).scene.traverse((object) => {
    if (object instanceof Mesh) meshes.push(object);
  });
  return meshes;
};
const envelopes = scene(manifest.solid_envelopes!.file);

test.each(manifest.atlases.map((atlas) => atlas.id))(
  'the published %s parcels sit where the native pial surface and its ribbon labels put them',
  async (id) => {
    const atlas = manifest.atlases.find((entry) => entry.id === id)!;
    const record = atlas.ribbon_labels as {
      file: string;
      vertex_counts: Record<'left' | 'right', number>;
      region_ids: string[];
    };
    const labels = new Uint16Array(
      (await readFile(new URL(record.file, directory))).buffer.slice(0),
    );
    const [native, parcels] = await Promise.all([envelopes, scene(atlas.file)]);
    let at = 0;
    let checked = 0;
    for (const hemisphere of ['left', 'right'] as const) {
      const count = record.vertex_counts[hemisphere];
      const own = labels.subarray(at, at + count);
      at += count;
      const pial = native.find(
        ({ userData }) => userData['hemisphere'] === hemisphere && userData['boundary'] === 'pial',
      )!.geometry;
      const byLabel = new Map<number, ArrayLike<number>>();
      for (const mesh of parcels) {
        const index = record.region_ids.indexOf(mesh.userData['region_id'] as string);
        if (index >= 0 && record.region_ids[index]!.includes(`:${hemisphere}:`)) {
          byLabel.set(index, mesh.geometry.getAttribute('position').array);
        }
      }
      const fields = partitionParents(
        { faces: pial.getIndex()!.array, pial: pial.getAttribute('position').array, labels: own },
        byLabel,
      );
      checked += fields.size;
    }
    assert.equal(checked, parcels.length, id);
  },
);

test('a parcel vertex lies on another native surface where its parents do, and its normal is their mean made unit', () => {
  const parcels = new Map([[2, [...corners[2]!, ...mean(0, 2), ...mean(1, 2), ...mean(0, 1, 2)]]]);
  const parents = partitionParents(surface, parcels);
  // The white surface one millimetre under the pial, as a mid-thickness or white surface is.
  const white = corners.flatMap(([x, y, z]) => [x!, y!, z! - 1]);
  assert.deepEqual(
    [...partitionPoints(parents, white).get(2)!],
    [0, 1, -1, 0, 0.5, -1, 0.5, 0.5, -1, 1 / 3, 1 / 3, -1].map(Math.fround),
  );
  const normals = [0, 0, 1, 1, 0, 0, 0, 0, 1];
  const unit = partitionPoints(parents, normals, true).get(2)!;
  assert.deepEqual(Array.from(unit.slice(0, 3)), [0, 0, 1]);
  assert.deepEqual(Array.from(unit.slice(6, 9)), [Math.SQRT1_2, 0, Math.SQRT1_2].map(Math.fround));
});
