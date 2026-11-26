// How a published body-map file is laid on an atlas's cortex meshes.
import { describe, expect, test } from 'vitest';
import { BufferAttribute, BufferGeometry, Mesh, MeshPhysicalMaterial } from 'three';
import type { Region } from '../../types/index.ts';
import type { AnatomicalUserData } from '../render/materials.ts';
import { attachBodyMap } from './body-map.ts';

function mesh(id: string, vertices: number, withBodyMap = true) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(vertices * 3), 3));
  const material = new MeshPhysicalMaterial();
  material.userData = {
    bodyMap: withBodyMap
      ? {
          bodyMapCodes: { value: null },
          bodyMapWidth: { value: 1 },
          bodyMapReady: { value: false },
        }
      : null,
  } satisfies Pick<AnatomicalUserData, 'bodyMap'>;
  const shown = new Mesh(geometry, material);
  shown.userData['region_id'] = id;
  return shown;
}

const region = (id: string, vertexCount: number) =>
  ({ id, atlas: 'a', vertex_count: vertexCount }) as Region;
const slot = (shown: Mesh) =>
  (shown.material as MeshPhysicalMaterial).userData['bodyMap'] as AnatomicalUserData['bodyMap'];

describe("BODY-01 an atlas's body map lies on its own cortex's vertices, codes 0 to 3, all of it or none", () => {
  const regions = [region('a:left:1', 3), region('a:right:1', 2)];

  test("gives each mesh its region's codes, read by vertex index", () => {
    const meshes = [mesh('a:right:1', 2), mesh('a:left:1', 3)];
    attachBodyMap({ meshes }, Uint8Array.from([1, 2, 3, 0, 2]), regions, 'a');
    expect([...(slot(meshes[1]!)!.bodyMapCodes.value!.image.data as Uint8Array)]).toEqual([
      1, 2, 3,
    ]);
    expect([...(slot(meshes[0]!)!.bodyMapCodes.value!.image.data as Uint8Array)]).toEqual([0, 2]);
    expect(meshes.map((shown) => slot(shown)!.bodyMapReady.value)).toEqual([true, true]);
  });

  test.each([
    ['a code no part has', [mesh('a:right:1', 2), mesh('a:left:1', 3)], [1, 2, 4, 0, 0]],
    ['too few codes', [mesh('a:right:1', 2), mesh('a:left:1', 3)], [1, 2, 3, 0]],
    [
      'a cortex built without the map',
      [mesh('a:right:1', 2, false), mesh('a:left:1', 3, false)],
      [1, 2, 3, 0, 0],
    ],
  ])('refuses %s, and draws none of it', (_, meshes, codes) => {
    expect(() => attachBodyMap({ meshes }, Uint8Array.from(codes), regions, 'a')).toThrow(
      /body map/,
    );
    expect(meshes.map((shown) => slot(shown)?.bodyMapReady.value ?? false)).toEqual([false, false]);
  });
});
