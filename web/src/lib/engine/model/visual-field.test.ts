// The named visual areas' border classes: areas that meet never share one, so the shader draws every
// border between them; a map that four classes cannot separate is refused.
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { BufferGeometry, Float32BufferAttribute, Mesh, MeshPhysicalMaterial } from 'three';
import { areaBorderClasses } from './visual-field.ts';
import type { AtlasMesh } from './layers.ts';

/** A mesh of the given triangles, each corner its own vertex carrying the named area's code. */
function surface(triangles: readonly (readonly [number, number, number])[]): AtlasMesh {
  const geometry = new BufferGeometry();
  const corners = triangles.flat();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(
      corners.flatMap(() => [0, 0, 0]),
      3,
    ),
  );
  geometry.setAttribute('_wang_area', new Float32BufferAttribute(corners, 1));
  geometry.setIndex(corners.map((_, index) => index));
  const mesh = new Mesh(geometry, new MeshPhysicalMaterial()) as AtlasMesh;
  mesh.userData = { region_id: 'a-left' };
  return mesh;
}

test('areas that meet get different classes, no area is class 0, and an area meeting none still gets one', () => {
  // 1, 2, 3 and 4 meet each other; 5 meets 1 alone; 6 meets nothing; 0 is cortex outside every area.
  const mesh = surface([
    [1, 2, 3],
    [1, 2, 4],
    [2, 3, 4],
    [1, 5, 0],
  ]);
  const classes = areaBorderClasses([mesh], 7);
  assert.equal(classes[0], 0);
  const met = [
    [1, 2],
    [1, 3],
    [1, 4],
    [2, 3],
    [2, 4],
    [3, 4],
    [1, 5],
  ];
  for (const [a, b] of met) assert.notEqual(classes[a!], classes[b!], `${a} and ${b} meet`);
  for (const code of [1, 2, 3, 4, 5, 6]) assert.ok(classes[code]! >= 1 && classes[code]! <= 4);
});

test('a map four classes cannot separate is refused', () => {
  // Five areas each meeting every other.
  const mesh = surface([
    [1, 2, 3],
    [1, 4, 5],
    [2, 4, 5],
    [3, 4, 5],
    [2, 3, 4],
    [1, 2, 5],
    [1, 3, 4],
  ]);
  assert.throws(() => areaBorderClasses([mesh], 6), /meets areas of all four border classes/);
});
