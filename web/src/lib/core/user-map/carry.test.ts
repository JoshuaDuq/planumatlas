import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { test } from 'vitest';
import { readRepoJson, repoRoot } from '../../../../test/repo.ts';
import type { Manifest } from '../../types/index.ts';
import { carryMap } from './carry.ts';
import { invertField } from './inverse-field.ts';
import type { NiftiVolume } from './nifti.ts';

const models = 'public/models/cdmd/';
const { field: record } = readRepoJson<Manifest>(`${models}manifest.json`).coordinate_spaces!
  .spaces[0]!;
const bytes = gunzipSync(readFileSync(resolve(repoRoot, models, record.file)));
const inverse = invertField(
  record,
  new Int16Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)),
);
// Two vertices of this brain: one inside it, one far beyond any template.
const cortex = {
  left: { pial: Float32Array.of(-30, -20, 50), white: Float32Array.of(-28, -20, 45) },
  right: { pial: Float32Array.of(400, 0, 0), white: Float32Array.of(400, 0, 0) },
};

function map(value: (i: number) => number, origin = -100): NiftiVolume {
  const shape: [number, number, number] = [101, 121, 101];
  const data = Float32Array.from({ length: shape[0] * shape[1] * shape[2] }, (_, i) => value(i));
  // Sheared, so a voxel's edges are not its affine's diagonal.
  const voxelToWorld = [
    [2, 0.5, 0, origin],
    [0, 2, 0, origin - 20],
    [0, 0, 2, origin + 20],
    [0, 0, 0, 1],
  ];
  return { shape, voxelToWorld, data, intent: 0, description: '' };
}

test('a carried map says its grid, its voxel edges, its range and how much of the cortex it reaches', () => {
  const carried = carryMap(
    map((i) => (i % 7) - 3),
    inverse,
    cortex,
  );
  assert.deepEqual(carried.summary.shape, [101, 121, 101]);
  assert.deepEqual(carried.summary.voxelMm, [2, Math.hypot(0.5, 2), 2]);
  assert.deepEqual(carried.summary.range, [-3, 3]);
  assert.equal(carried.summary.binary, false);
  assert.equal(carried.summary.cortexCovered, 0.5);
  assert.ok(Number.isFinite(carried.cortex.left[0]!));
  assert.ok(Number.isNaN(carried.cortex.right[0]!));
  assert.equal(
    carried.volume.length,
    carried.grid.shape[0] * carried.grid.shape[1] * carried.grid.shape[2],
  );
});

test('a map of zeros and ones is a mask; NaN does not count against it', () => {
  const carried = carryMap(
    map((i) => (i < 1000 ? Number.NaN : i % 2)),
    inverse,
    cortex,
  );
  assert.equal(carried.summary.binary, true);
  assert.deepEqual(carried.summary.range, [0, 1]);
});

test('a map with nothing to draw, or nowhere near the brain, is refused', () => {
  assert.throws(
    () =>
      carryMap(
        map(() => Number.NaN),
        inverse,
        cortex,
      ),
    /no finite values/,
  );
  assert.throws(
    () =>
      carryMap(
        map(() => 0),
        inverse,
        cortex,
      ),
    /only zeros/,
  );
  assert.throws(
    () =>
      carryMap(
        map(() => 1, 5000),
        inverse,
        cortex,
      ),
    /does not reach the brain/,
  );
});
