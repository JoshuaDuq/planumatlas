import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { test } from 'vitest';
import { readRepoJson, repoRoot } from '../../../../test/repo.ts';
import type { Manifest } from '../../types/index.ts';
import { carryImage, carryVolume } from './carry.ts';
import { invertField } from './inverse-field.ts';
import { volumeOf } from './nifti.ts';
import type { NiftiImage } from './nifti.ts';

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

const shape: [number, number, number] = [101, 121, 101];
const voxels = shape[0] * shape[1] * shape[2];

/** A template map with a volume per function of the voxel index. */
function image(values: ((i: number) => number)[], origin = -100): NiftiImage {
  // Sheared, so a voxel's edges are not its affine's diagonal.
  const voxelToWorld = [
    [2, 0.5, 0, origin],
    [0, 2, 0, origin - 20],
    [0, 0, 2, origin + 20],
    [0, 0, 0, 1],
  ];
  return {
    shape,
    voxelToWorld,
    volumes: values.map((value) => Float32Array.from({ length: voxels }, (_, i) => value(i))),
    secondsPerVolume: values.length > 1 ? 2 : null,
    intent: 0,
    description: '',
  };
}

test('a carried map says its grid, its voxel edges, its range and how much of the cortex it reaches', () => {
  const { map, summary } = carryImage(image([(i) => (i % 7) - 3]), 0, inverse, cortex);
  assert.deepEqual(summary.shape, [101, 121, 101]);
  assert.deepEqual(summary.voxelMm, [2, Math.hypot(0.5, 2), 2]);
  assert.deepEqual(summary.range, [-3, 3]);
  assert.equal(summary.binary, false);
  assert.equal(summary.volumes, 1);
  assert.equal(summary.secondsPerVolume, null);
  assert.equal(summary.cortexCovered, 0.5);
  assert.ok(Number.isFinite(map.cortex.left[0]!));
  assert.ok(Number.isNaN(map.cortex.right[0]!));
  assert.equal(map.volume.length, 2 * map.grid.shape[0] * map.grid.shape[1] * map.grid.shape[2]);
});

test('a map of zeros and ones is a mask; NaN does not count against it', () => {
  const { summary } = carryImage(
    image([(i) => (i < 1000 ? Number.NaN : i % 2)]),
    0,
    inverse,
    cortex,
  );
  assert.equal(summary.binary, true);
  assert.deepEqual(summary.range, [0, 1]);
});

test('a map with nothing to draw, or nowhere near the brain, is refused', () => {
  assert.throws(
    () => carryImage(image([() => Number.NaN]), 0, inverse, cortex),
    /no finite values/,
  );
  assert.throws(() => carryImage(image([() => 0]), 0, inverse, cortex), /only zeros/);
  assert.throws(
    () => carryImage(image([() => 1], 5000), 0, inverse, cortex),
    /does not reach the brain/,
  );
});

test('a series is summarised over every volume and carries the volume asked for', () => {
  const series = image([() => 0, () => 4, () => -2]);
  const { map, summary } = carryImage(series, 1, inverse, cortex);
  assert.deepEqual(summary.range, [-2, 4]);
  assert.equal(summary.binary, false);
  assert.equal(summary.volumes, 3);
  assert.equal(summary.secondsPerVolume, 2);
  assert.ok(Math.abs(map.cortex.left[0]! - 4) < 1e-6);
  const last = carryVolume(volumeOf(series, 2), inverse, cortex);
  assert.ok(Math.abs(last.cortex.left[0]! + 2) < 1e-6);
});

test('a series reaches the cortex its voxels reach in any volume, and is refused only when none does', () => {
  // An empty first volume is shown as it is, not refused.
  const late = carryImage(image([() => 0, () => 3]), 0, inverse, cortex);
  assert.ok(Number.isNaN(late.map.cortex.left[0]!));
  assert.equal(late.summary.cortexCovered, 0.5);
  assert.throws(
    () => carryImage(image([() => 0, () => 1], 5000), 0, inverse, cortex),
    /does not reach the brain/,
  );
});
