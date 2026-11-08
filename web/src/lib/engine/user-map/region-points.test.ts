import { BoxGeometry, Mesh, SphereGeometry } from 'three';
import type { BufferGeometry } from 'three';
import { computeBoundsTree } from 'three-mesh-bvh';
import { expect, test } from 'vitest';
import { rasToWorld } from '../slices/coordinates.ts';
import { regionPoints } from './region-points.ts';

// Sizes in millimetres; the scene's world unit is the metre.
function solid(geometry: BufferGeometry, center: [number, number, number]): Mesh {
  geometry.scale(0.001, 0.001, 0.001);
  geometry.boundsTree = computeBoundsTree.call(geometry);
  const mesh = new Mesh(geometry);
  mesh.position.copy(rasToWorld(center));
  return mesh;
}

const triples = (points: Float32Array) =>
  Array.from({ length: points.length / 3 }, (_, n) => [...points.subarray(3 * n, 3 * n + 3)]);

test('a sphere holds the whole millimetres within its radius, and none beyond its facets', () => {
  const center: [number, number, number] = [3.4, -2.2, 7.6];
  const radius = 10;
  const found = new Set(
    triples(regionPoints([solid(new SphereGeometry(radius, 64, 48), center)])).map(String),
  );
  const distance = ([i, j, k]: number[]) =>
    Math.hypot(i! - center[0], j! - center[1], k! - center[2]);
  for (let i = -8; i <= 15; i++) {
    for (let j = -14; j <= 10; j++) {
      for (let k = -4; k <= 19; k++) {
        const d = distance([i, j, k]);
        // The facets lie within 0.02 mm inside the sphere at 64 × 48 segments.
        if (d < radius - 0.05) expect(found.has(String([i, j, k])), `${i},${j},${k}`).toBe(true);
        if (d > radius) expect(found.has(String([i, j, k])), `${i},${j},${k}`).toBe(false);
      }
    }
  }
});

test('overlapping solids give each point once, where they are drawn', () => {
  // Two 4.5 mm boxes 2 mm apart in x, moved by their transforms.
  const points = regionPoints([
    solid(new BoxGeometry(4.5, 4.5, 4.5), [50, -20, 30]),
    solid(new BoxGeometry(4.5, 4.5, 4.5), [52, -20, 30]),
  ]);
  const all = triples(points).map(String);
  expect(new Set(all).size).toBe(all.length);
  // x 48..54, y −22..−18, z 28..32.
  expect(all.length).toBe(7 * 5 * 5);
  expect(all).toContain(String([48, -22, 28]));
  expect(all).toContain(String([54, -18, 32]));
});
