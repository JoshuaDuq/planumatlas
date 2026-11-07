import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { Mesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { test } from 'vitest';
import { readRepoJson, repoRoot } from '../../../../test/repo.ts';
import { modelDirectory } from '../../engine/model/test-support.ts';
import type { Manifest } from '../../types/index.ts';
import { anatomies } from '../catalog/test-support.ts';
import { createField } from '../coordinates/field.ts';
import { invertField } from './inverse-field.ts';
import type { NiftiVolume } from './nifti.ts';
import {
  createSampler,
  gridSampler,
  resample,
  sampleCortex,
  sampleThrough,
  volumeGrid,
} from './sampling.ts';

const reference = readRepoJson<{
  shape: [number, number, number];
  affine: number[][];
  data: (number | null)[];
  pial: number[][];
  white: number[][];
  texture: (number | null)[];
}>('web/src/lib/core/user-map/fixtures/vol-to-surf.json');

const volume = (
  data: ArrayLike<number | null>,
  overrides: Partial<NiftiVolume> = {},
): NiftiVolume => ({
  shape: reference.shape,
  voxelToWorld: reference.affine,
  data: Float32Array.from(data, (value) => value ?? NaN),
  intent: 0,
  description: '',
  ...overrides,
});

test('a linear map is read back exactly anywhere between its voxel centres, and not beyond them', () => {
  const [nx, ny, nz] = reference.shape;
  const linear = (x: number, y: number, z: number) => 0.5 * x - 2 * y + 0.25 * z + 3;
  const data: number[] = [];
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const [x, y, z] = [0, 1, 2].map((r) =>
          [i, j, k, 1].reduce((sum, v, c) => sum + reference.affine[r]![c]! * v, 0),
        );
        data.push(linear(x!, y!, z!));
      }
  const sample = createSampler(volume(data));
  const world = (i: number, j: number, k: number) =>
    [0, 1, 2].map((r) =>
      [i, j, k, 1].reduce((sum, v, c) => sum + reference.affine[r]![c]! * v, 0),
    ) as [number, number, number];
  const voxels: [number, number, number][] = [
    [0, 0, 0],
    [nx - 1, ny - 1, nz - 1],
    [2.3, 4.71, 0.05],
    [5.99, 0.5, 7.5],
  ];
  for (const voxel of voxels) {
    const point = world(...voxel);
    assert.ok(Math.abs(sample(...point) - linear(...point)) < 1e-4, `${voxel}`);
  }
  assert.ok(Number.isNaN(sample(...world(-0.01, 2, 2))));
  assert.ok(Number.isNaN(sample(...world(2, ny - 0.99, 2))));
});

test('a single slice cannot be read as a map in three dimensions', () => {
  assert.throws(
    () => createSampler(volume([1, 2], { shape: [2, 1, 1] })),
    /single slice along one axis/,
  );
});

test('each vertex takes nilearn’s vol_to_surf value between its pial and white positions', () => {
  const values = sampleCortex(
    Float32Array.from(reference.pial.flat()),
    Float32Array.from(reference.white.flat()),
    createSampler(volume(reference.data)),
  );
  assert.equal(values.length, reference.texture.length);
  for (const [vertex, expected] of reference.texture.entries()) {
    if (expected === null) assert.ok(Number.isNaN(values[vertex]!), `vertex ${vertex}`);
    // Float32 vertex positions against nilearn's float64.
    else
      assert.ok(Math.abs(values[vertex]! - expected) < 1e-4, `vertex ${vertex}: ${values[vertex]}`);
  }
});

// The published anatomy: a map in MNI152NLin2009cAsym carried onto it through the inverted field.
const models = 'public/models/cdmd/';
const { coordinate_spaces: spaces, solid_envelopes } = readRepoJson<Manifest>(
  `${models}manifest.json`,
);
const { field: record } = spaces!.spaces.find(({ id }) => id === 'mni152nlin2009casym')!;
const bytes = gunzipSync(readFileSync(resolve(repoRoot, models, record.file)));
const fieldData = new Int16Array(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
);
const inverse = invertField(record, fieldData);

// A 2 mm grid over the template's whole brain, as an fMRI map in that space would be.
function templateMap(value: (x: number, y: number, z: number) => number): NiftiVolume {
  const shape: [number, number, number] = [97, 115, 97];
  const voxelToWorld = [
    [2, 0, 0, -96],
    [0, 2, 0, -132],
    [0, 0, 2, -78],
    [0, 0, 0, 1],
  ];
  const data = new Float32Array(shape[0] * shape[1] * shape[2]);
  for (let k = 0, n = 0; k < shape[2]; k++)
    for (let j = 0; j < shape[1]; j++)
      for (let i = 0; i < shape[0]; i++, n++) data[n] = value(2 * i - 96, 2 * j - 132, 2 * k - 78);
  return { shape, voxelToWorld, data, intent: 0, description: '' };
}

test('a blob around an MNI coordinate peaks on this brain where the Coordinate tool places that coordinate', () => {
  for (const centre of [
    [-42, 22, 6],
    [38, -22, 56],
    [-24, -4, -20],
  ] as const) {
    const blob = templateMap((x, y, z) =>
      Math.exp(
        -((x - centre[0]) ** 2 + (y - centre[1]) ** 2 + (z - centre[2]) ** 2) / (2 * 4 ** 2),
      ),
    );
    const placed = createField(record, fieldData).map(centre)!;
    // The 1 mm grid around the placed coordinate.
    const grid = {
      origin: placed.map((value) => Math.round(value) - 6) as [number, number, number],
      shape: [13, 13, 13] as [number, number, number],
      spacing: 1,
    };
    const values = resample(grid, sampleThrough(inverse, createSampler(blob)));
    const peak = values.indexOf(Math.max(...values));
    const at = [peak % 13, Math.floor(peak / 13) % 13, Math.floor(peak / 169)].map(
      (index, axis) => grid.origin[axis]! + index,
    );
    // The nearest 1 mm voxel centre to the placed point is at most √3/2 mm from it.
    assert.ok(
      Math.hypot(...at.map((v, axis) => v - placed[axis]!)) <= 0.9,
      `${centre}: ${at} vs ${placed}`,
    );
  }
});

test('a map covering the template reaches nearly every vertex of this brain’s cortex', async () => {
  const buffer = await readFile(new URL(solid_envelopes!.file, modelDirectory(anatomies.default)));
  const { scene } = await new GLTFLoader().parseAsync(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
    '',
  );
  const surfaces = new Map<string, Float32Array>();
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const world = object.geometry.getAttribute('position').array as Float32Array;
    const ras = new Float32Array(world.length);
    for (let v = 0; v < world.length; v += 3) {
      ras[v] = world[v]! * 1000;
      ras[v + 1] = -world[v + 2]! * 1000;
      ras[v + 2] = world[v + 1]! * 1000;
    }
    surfaces.set(`${object.userData['hemisphere']}:${object.userData['boundary']}`, ras);
  });
  const ones = sampleThrough(inverse, createSampler(templateMap(() => 1)));
  for (const hemisphere of ['left', 'right']) {
    const values = sampleCortex(
      surfaces.get(`${hemisphere}:pial`)!,
      surfaces.get(`${hemisphere}:white`)!,
      ones,
    );
    const covered = values.filter((value) => value === 1).length / values.length;
    assert.ok(covered > 0.995, `${hemisphere}: ${covered}`);
  }
});

test('the cut volume’s grid has its centres on whole millimetres and fills the inverted field', () => {
  const { origin, shape, spacing } = volumeGrid(inverse);
  assert.equal(spacing, 1);
  for (let axis = 0; axis < 3; axis++) {
    const end = inverse.origin[axis]! + inverse.spacing * (inverse.shape[axis]! - 1);
    const last = origin[axis]! + shape[axis]! - 1;
    assert.ok(Number.isInteger(origin[axis]), `${origin}`);
    assert.ok(origin[axis]! >= inverse.origin[axis]! && origin[axis]! - 1 < inverse.origin[axis]!);
    assert.ok(last <= end && last + 1 > end, `axis ${axis}: ${last} of ${end}`);
  }
});

test('the cut volume is read back trilinear between its centres, and not past a corner without a value', () => {
  const grid = {
    shape: [3, 3, 3] as [number, number, number],
    origin: [-1, 0, 2] as [number, number, number],
    spacing: 2,
  };
  const values = Float32Array.from({ length: 27 }, (_, n) => (n % 3) + 10 * Math.floor(n / 9));
  const at = gridSampler(grid, values);
  // x index 0.5, z index 1.25: 0.5 + 10 · 1.25.
  assert.equal(at(0, 1, 4.5), 13);
  assert.ok(Number.isNaN(at(-1.5, 0, 2)));
  values[26] = Number.NaN;
  assert.ok(Number.isNaN(gridSampler(grid, values)(1.5, 2.5, 4.5)));
  assert.equal(gridSampler(grid, values)(-1, 0, 2), 0);
});
