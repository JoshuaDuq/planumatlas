import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { test } from 'vitest';
import { readRepoJson, repoRoot } from '../../../../test/repo.ts';
import type { Manifest } from '../../types/index.ts';
import { carryVolume } from './carry.ts';
import { regionCourse } from './course.ts';
import { invertField } from './inverse-field.ts';
import { volumeOf } from './nifti.ts';
import type { NiftiImage } from './nifti.ts';
import { gridSampler } from './sampling.ts';

const models = 'public/models/cdmd/';
const { field: record } = readRepoJson<Manifest>(`${models}manifest.json`).coordinate_spaces!
  .spaces[0]!;
const bytes = gunzipSync(readFileSync(resolve(repoRoot, models, record.file)));
const inverse = invertField(
  record,
  new Int16Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)),
);

const shape: [number, number, number] = [91, 109, 91];
const voxelToWorld = [
  [2, 0, 0, -90],
  [0, 2, 0, -126],
  [0, 0, 2, -72],
  [0, 0, 0, 1],
];
const voxels = shape[0] * shape[1] * shape[2];
/** Template x (mm) at each voxel. */
const x = (i: number) => -90 + 2 * (i % shape[0]);

function image(values: ((i: number) => number)[]): NiftiImage {
  return {
    shape,
    voxelToWorld,
    volumes: values.map((value) => Float32Array.from({ length: voxels }, (_, i) => value(i))),
    secondsPerVolume: 2,
    intent: 0,
    description: '',
  };
}

// Whole-millimetre points of this brain: a block in the left hemisphere, and one far outside.
const block: number[] = [];
for (let i = -40; i < -30; i++)
  for (let j = -10; j < 0; j++) for (let k = 20; k < 30; k++) block.push(i, j, k);
const points = Float32Array.from([...block, 400, 0, 0]);

test('each volume’s mean is over the region’s points the map has a value at, read through the field', () => {
  // Linear in template x, so trilinear reading gives each point's template x exactly.
  const series = image([(i) => x(i), () => 0, (i) => (x(i) < -35 ? 5 : 0)]);
  const course = regionCourse(series, inverse, points);
  const at = new Float64Array(3);
  let sum = 0;
  for (let p = 0; p < block.length / 3; p++) {
    assert.ok(inverse.map(block[3 * p]!, block[3 * p + 1]!, block[3 * p + 2]!, at));
    sum += at[0]!;
  }
  assert.equal(course.points, 1001);
  assert.equal(course.counts[0], 1000);
  assert.ok(Math.abs(course.means[0]! - sum / 1000) < 1e-4);
  // No value anywhere: no mean, not a mean of zero.
  assert.equal(course.counts[1], 0);
  assert.ok(Number.isNaN(course.means[1]!));
  // Only the points with a value count, so the mean is the value, not diluted by the rest.
  assert.ok(course.counts[2]! > 0 && course.counts[2]! < 1000);
  assert.equal(course.means[2], 5);
});

test('a point’s value is the one the cut faces draw at that centre of the 1 mm grid', () => {
  const series = image([(i) => Math.sin(i / 97) * 3 + (i % 5 === 0 ? 0 : 1)]);
  const cortex = { pial: new Float32Array(3), white: new Float32Array(3) };
  const carried = carryVolume(volumeOf(series, 0), inverse, { left: cortex, right: cortex });
  const drawn = gridSampler(carried.grid, carried.volume);
  let sum = 0;
  let count = 0;
  for (let p = 0; p < block.length / 3; p++) {
    const value = drawn(block[3 * p]!, block[3 * p + 1]!, block[3 * p + 2]!);
    if (Number.isNaN(value)) continue;
    sum += value;
    count++;
  }
  const course = regionCourse(series, inverse, Float32Array.from(block));
  assert.equal(course.counts[0], count);
  assert.ok(Math.abs(course.means[0]! - sum / count) < 1e-5);
});
