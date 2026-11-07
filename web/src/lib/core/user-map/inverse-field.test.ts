import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { test } from 'vitest';
import { readRepoJson, readRepoYaml, repoRoot } from '../../../../test/repo.ts';
import type { Manifest } from '../../types/index.ts';
import { createField } from '../coordinates/field.ts';
import { invertField } from './inverse-field.ts';

const models = 'public/models/cdmd/';
const { coordinate_spaces: published } = readRepoJson<Manifest>(`${models}manifest.json`);
// The limit the build set for the published field's own grid against SynthMorph's full field.
const GRID_P95 = readRepoYaml<{ acceptance: { grid_error_p95_max_mm: number } }>(
  'config/coordinate-spaces.yaml',
).acceptance.grid_error_p95_max_mm;

function decoded(file: string): Int16Array {
  const bytes = gunzipSync(readFileSync(resolve(repoRoot, models, file)));
  return new Int16Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}

function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const percentile = (values: number[], share: number) =>
  values.sort((a, b) => a - b)[Math.floor(share * (values.length - 1))]!;

for (const { id, field: record } of published!.spaces) {
  const data = decoded(record.file);
  const forward = createField(record, data);
  const inverse = invertField(record, data);

  test(`${id}: the published field carries every solved node back onto itself`, () => {
    const [mx, my, mz] = inverse.shape;
    let solved = 0;
    for (let n = 0; n < mx * my * mz; n++) {
      const p = [inverse.nodes[3 * n]!, inverse.nodes[3 * n + 1]!, inverse.nodes[3 * n + 2]!];
      if (Number.isNaN(p[0]!)) continue;
      solved++;
      const q = [n % mx, Math.floor(n / mx) % my, Math.floor(n / (mx * my))].map(
        (index, axis) => inverse.origin[axis]! + inverse.spacing * index,
      );
      const landed = forward.map(p as [number, number, number]);
      assert.ok(landed, `${id}: node ${n} solved beyond the field`);
      // Newton's tolerance, plus the float32 the nodes are stored in.
      assert.ok(Math.hypot(...landed.map((v, axis) => v - q[axis]!)) < 2e-3, `${id}: node ${n}`);
    }
    // Not vacuous: the solved nodes fill more than a litre of this brain.
    assert.ok(solved * inverse.spacing ** 3 > 1e6, `${id}: ${solved} nodes`);
  });

  // Measured as the build measured the published grid: in this brain's millimetres.
  test(`${id}: a point of this brain read through the inverse lands back within the field’s grid error`, () => {
    const next = random(7);
    const [nx, ny, nz] = record.shape as [number, number, number];
    const affine = record.node_to_template_mm;
    const errors: number[] = [];
    const out = new Float64Array(3);
    while (errors.length < 20_000) {
      const node = [next() * (nx - 1), next() * (ny - 1), next() * (nz - 1)];
      const p = node.map((value, axis) => affine[axis]![axis]! * value + affine[axis]![3]!) as [
        number,
        number,
        number,
      ];
      const q = forward.map(p);
      if (!q || !inverse.map(...q, out)) continue;
      const back = forward.map([out[0]!, out[1]!, out[2]!]);
      assert.ok(back, `${id}: ${q} read beyond the field`);
      errors.push(Math.hypot(back[0] - q[0], back[1] - q[1], back[2] - q[2]));
    }
    assert.ok(percentile(errors, 0.95) <= GRID_P95, `${id}: p95 ${percentile(errors, 0.95)} mm`);
    assert.ok(percentile(errors, 1) < 1, `${id}: max ${percentile(errors, 1)} mm`);
  });
}

test('a point off the inverse grid, or needing a node beyond the brain, has no template point', () => {
  const { field: record } = published!.spaces[0]!;
  const inverse = invertField(record, decoded(record.file));
  const out = new Float64Array(3);
  const [x, y, z] = inverse.origin;
  assert.equal(inverse.map(x - 1, y, z, out), false);
  // A grid corner lies far outside the head.
  assert.equal(inverse.map(x, y, z, out), false);
  assert.equal(inverse.map(0, 0, 0, out), true);
});
