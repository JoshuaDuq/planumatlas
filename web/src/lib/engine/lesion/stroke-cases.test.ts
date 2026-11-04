import assert from 'node:assert/strict';
import { Matrix4 } from 'three';
import { test } from 'vitest';
import { partitionPair, surfaceOf, voxelsOf } from './stroke-cases.ts';

const SHAPE = [32, 32, 32] as const;
const flat = (x: number, y: number, z: number) => x + SHAPE[0] * (y + SHAPE[1] * z);

function cube(from: number, to: number): Set<number> {
  const set = new Set<number>();
  for (let z = from; z < to; z++) for (let y = from; y < to; y++) for (let x = from; x < to; x++) set.add(flat(x, y, z));
  return set;
}

/** The volume a closed triangle soup encloses, by the divergence theorem. */
function enclosed(positions: Float32Array): number {
  let volume = 0;
  for (let i = 0; i < positions.length; i += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = positions.subarray(i, i + 9) as unknown as number[];
    volume += (ax! * (by! * cz! - bz! * cy!) - ay! * (bx! * cz! - bz! * cx!) + az! * (bx! * cy! - by! * cx!)) / 6;
  }
  return Math.abs(volume);
}

test('runs decode to the voxels they name', () => {
  const masks = new Uint32Array([5, 3, 40, 1, 7, 2]);
  assert.deepEqual([...voxelsOf(masks, [0, 4])].sort((a, b) => a - b), [5, 6, 7, 40]);
  assert.deepEqual([...voxelsOf(masks, [4, 2])], [7, 8]);
});

test('a pair splits into disjoint parts that cover both lesions', () => {
  const [onlyA, onlyB, both] = partitionPair(new Set([1, 2, 3]), new Set([3, 4]));
  assert.deepEqual([[...onlyA], [...onlyB], [...both]], [[1, 2], [4], [3]]);
});

test('a voxel cube meshes as a closed surface of its own volume, where the grid puts it', () => {
  // 1 mm voxels; the grid's origin sits at (-16, -16, -16) mm.
  const toRas = new Matrix4().makeTranslation(-16, -16, -16);
  const positions = surfaceOf(cube(8, 18), SHAPE, toRas);
  assert.ok(positions.length > 0);
  // 10 mm on a side: smoothing rounds the edges, so a little less than 1000 mm³, never more.
  const volume = enclosed(positions);
  assert.ok(volume > 850 && volume < 1000, `enclosed ${volume} mm³`);
  let sum = [0, 0, 0];
  for (let i = 0; i < positions.length; i += 3) sum = sum.map((value, axis) => value + positions[i + axis]!);
  const centre = sum.map((value) => value / (positions.length / 3));
  // Voxel centres 8…17 lie around 12.5, minus the 16 mm origin.
  for (const value of centre) assert.ok(Math.abs(value - -3.5) < 0.05, `centre ${centre}`);
});

test('a difference one voxel thin keeps its surface, where its voxels are', () => {
  // The second lesion is a 10 mm cube; the first is the same cube with a 10 × 10 × 1 sheet on top.
  const sheet = new Set<number>();
  for (let y = 8; y < 18; y++) for (let x = 8; x < 18; x++) sheet.add(flat(x, y, 18));
  const first = new Set([...cube(8, 18), ...sheet]);
  const [onlyFirst, onlySecond, both] = partitionPair(first, cube(8, 18));
  assert.equal(onlyFirst.size, 100);
  assert.equal(onlySecond.size, 0);
  assert.equal(both.size, 1000);
  const toRas = new Matrix4().makeTranslation(-16, -16, -16);
  const positions = surfaceOf(onlyFirst, SHAPE, toRas);
  assert.ok(positions.length > 0, 'the sheet must not vanish');
  const volume = enclosed(positions);
  assert.ok(volume > 15 && volume < 110, `the sheet encloses ${volume} mm³ for 100 voxels`);
  let z = 0;
  for (let i = 2; i < positions.length; i += 3) z += positions[i]!;
  assert.ok(Math.abs(z / (positions.length / 3) - 2) < 0.1, 'the sheet sits at its own voxels');
});

/** Whether a point lies inside a closed triangle soup: a ray along +x crosses it an odd number of times. */
function inside(positions: Float32Array, [px, py, pz]: number[]): boolean {
  let crossings = 0;
  for (let i = 0; i < positions.length; i += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = positions.subarray(i, i + 9) as unknown as number[];
    // Möller–Trumbore with the direction (1, 0, 0), nudged off edges.
    const e1 = [bx! - ax!, by! - ay!, bz! - az!];
    const e2 = [cx! - ax!, cy! - ay!, cz! - az!];
    const h = [0, -e2[2]!, e2[1]!];
    const a = e1[0]! * h[0]! + e1[1]! * h[1]! + e1[2]! * h[2]!;
    if (Math.abs(a) < 1e-12) continue;
    const s = [px! - ax!, py! + 1e-7 - ay!, pz! + 2e-7 - az!];
    const u = (s[0]! * h[0]! + s[1]! * h[1]! + s[2]! * h[2]!) / a;
    if (u < 0 || u > 1) continue;
    const q = [s[1]! * e1[2]! - s[2]! * e1[1]!, s[2]! * e1[0]! - s[0]! * e1[2]!, s[0]! * e1[1]! - s[1]! * e1[0]!];
    const v = q[0]! / a;
    if (v < 0 || u + v > 1) continue;
    if ((e2[0]! * q[0]! + e2[1]! * q[1]! + e2[2]! * q[2]!) / a > 0) crossings++;
  }
  return crossings % 2 === 1;
}

test('smoothing never carries the surface across a voxel centre: a one-voxel gap stays open', () => {
  // Two 10 × 10 × 4 slabs with one empty layer between them; smoothed freely, the gap's middle fills.
  const set = new Set<number>();
  for (const z of [8, 9, 10, 11, 13, 14, 15, 16]) {
    for (let y = 8; y < 18; y++) for (let x = 8; x < 18; x++) set.add(flat(x, y, z));
  }
  const positions = surfaceOf(set, SHAPE, new Matrix4());
  assert.equal(inside(positions, [12, 12, 10]), true, 'a slab voxel is inside');
  assert.equal(inside(positions, [12, 12, 12]), false, 'the gap between the slabs stays empty');
});
