import assert from 'node:assert/strict';
import { test } from 'vitest';
import { overlapAreas, vertexAreas } from './overlap.ts';

test('FUNC-53 · each vertex takes a third of every triangle it is a corner of', () => {
  // A 3 × 2 rectangle split along a diagonal: corners 0 and 2 belong to both triangles.
  const positions = [0, 0, 0, 3, 0, 0, 3, 2, 0, 0, 2, 0];
  const areas = vertexAreas([0, 1, 2, 0, 2, 3], positions);
  assert.deepEqual(Array.from(areas), [2, 1, 2, 1]);
  // A unit cube's twelve triangles: 6 in all, ¾ at each corner.
  const cube = [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1];
  const faces = [
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0,
    4, 3, 4, 7,
  ];
  const corners = vertexAreas(faces, cube);
  assert.ok(Math.abs(corners.reduce((sum, area) => sum + area, 0) - 6) < 1e-12);
  assert.throws(() => vertexAreas([0, 1], positions), /whole triangles/);
});

test('FUNC-53 · the map is above its threshold where positive, counted over cortical parcels only', () => {
  // Parcels: 1 and 2 cortex, 2 painted; 0 is the medial wall.
  const labels = [1, 1, 2, 2, 2, 0];
  const areas = [1, 2, 4, 8, 16, 32];
  const values = [5, -5, 5, 3, Number.NaN, 9];
  const total = overlapAreas({ values, labels, areas }, new Set([1, 2]), new Set([2]), 3);
  // Map: vertex 0 (1) and 2 (4); a value at the threshold, a negative one and none are not the map's.
  assert.deepEqual(total, { map: 5, function: 28, both: 4 });
  assert.throws(
    () => overlapAreas({ values: [1], labels, areas }, new Set(), new Set(), 0),
    /same vertices/,
  );
});
