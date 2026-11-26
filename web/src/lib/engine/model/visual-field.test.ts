// The named visual areas' border classes: areas that meet never share one, so the shader draws every
// border between them; a map that four classes cannot separate is refused.
import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshPhysicalMaterial,
} from 'three';
import { VISUAL_CODES, VISUAL_FIELD } from '../render/materials.ts';
import { areaBorderClasses, packVisualField } from './visual-field.ts';
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
  geometry.setAttribute(
    VISUAL_CODES,
    new Float32BufferAttribute(
      corners.flatMap((code) => [0, code]),
      2,
    ),
  );
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

test('packing keeps every published retinotopy value exactly, in its type and in the order the shader reads it', () => {
  const geometry = new BufferGeometry();
  const fields = {
    _field_x: [0, 1, 65535],
    _field_y: [7, 30000, 2],
    _prf_sigma: [65535, 0, 12345],
  };
  for (const [name, values] of Object.entries(fields)) {
    geometry.setAttribute(name, new BufferAttribute(Uint16Array.from(values), 1, true));
  }
  geometry.setAttribute('_visual_area', new BufferAttribute(Uint8Array.from([0, 1, 3]), 1));
  geometry.setAttribute('_wang_area', new BufferAttribute(Uint8Array.from([25, 0, 9]), 1));
  packVisualField(geometry, 'a-left');
  const field = geometry.getAttribute(VISUAL_FIELD) as BufferAttribute;
  assert.ok(field.array instanceof Uint16Array && field.normalized);
  assert.deepEqual([...field.array], [0, 7, 65535, 1, 30000, 0, 65535, 2, 12345]);
  const codes = geometry.getAttribute(VISUAL_CODES) as BufferAttribute;
  assert.ok(codes.array instanceof Uint8Array && !codes.normalized);
  assert.deepEqual([...codes.array], [0, 25, 1, 0, 3, 9]);
  for (const name of [...Object.keys(fields), '_visual_area', '_wang_area']) {
    assert.equal(geometry.getAttribute(name), undefined);
  }
});
