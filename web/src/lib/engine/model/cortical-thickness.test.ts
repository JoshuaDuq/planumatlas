// How a published thickness file is laid on an atlas's cortex meshes.
import { describe, expect, test } from 'vitest';
import { BufferAttribute, BufferGeometry, Mesh, MeshPhysicalMaterial } from 'three';
import type { Region } from '../../types/index.ts';
import type { AnatomicalUserData } from '../render/materials.ts';
import { attachThickness } from './cortical-thickness.ts';

function mesh(id: string, vertices: number) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(vertices * 3), 3));
  const material = new MeshPhysicalMaterial();
  material.userData = {
    thickness: {
      thicknessCodes: { value: null },
      thicknessWidth: { value: 1 },
      thicknessReady: { value: false },
    },
  } satisfies Pick<AnatomicalUserData, 'thickness'>;
  const shown = new Mesh(geometry, material);
  shown.userData['region_id'] = id;
  return shown;
}

const region = (id: string, atlas: string, vertexCount?: number) =>
  ({ id, atlas, vertex_count: vertexCount }) as Region;
const uniforms = (shown: Mesh) =>
  (shown.material as MeshPhysicalMaterial).userData['thickness'] as AnatomicalUserData['thickness'];
const texels = (shown: Mesh) => [
  ...(uniforms(shown)!.thicknessCodes.value!.image.data as Uint8Array),
];

describe('THICK-03 a thickness file on its cortex', () => {
  // Meshes in another order than the regions: the regions' order decides.
  const regions = [
    region('a:left:1', 'a', 3),
    region('b:left:1', 'b', 9),
    region('a:left:-1', 'a', 2),
    region('a:right:1', 'a', 4),
  ];

  test("gives each mesh its region's bytes, in the published regions' order", () => {
    const meshes = [mesh('a:right:1', 4), mesh('a:left:-1', 2), mesh('a:left:1', 3)];
    attachThickness({ meshes }, Uint8Array.from([1, 2, 3, 0, 0, 7, 8, 9, 10]), regions, 'a');
    expect(texels(meshes[2]!)).toEqual([1, 2, 3]);
    expect(texels(meshes[1]!)).toEqual([0, 0]);
    expect(texels(meshes[0]!)).toEqual([7, 8, 9, 10]);
    expect(meshes.map((shown) => uniforms(shown)!.thicknessReady.value)).toEqual([
      true,
      true,
      true,
    ]);
    // A disposed geometry frees its texture.
    let disposed = false;
    uniforms(meshes[0]!)!.thicknessCodes.value!.addEventListener(
      'dispose',
      () => (disposed = true),
    );
    meshes[0]!.geometry.dispose();
    expect(disposed).toBe(true);
  });

  test('a mesh larger than a row wraps to the next, its last row padded', () => {
    const big = mesh('a:left:1', 5000);
    const codes = Uint8Array.from({ length: 5000 }, (_, index) => (index % 250) + 1);
    attachThickness({ meshes: [big] }, codes, [region('a:left:1', 'a', 5000)], 'a');
    const texture = uniforms(big)!.thicknessCodes.value!;
    expect([texture.image.width, texture.image.height]).toEqual([4096, 2]);
    expect(uniforms(big)!.thicknessWidth.value).toBe(4096);
    // Vertex 4096 is texel (0, 1): row-major, as the shader reads gl_VertexID.
    expect(texels(big)[4096]).toBe(codes[4096]);
    expect(texels(big).slice(5000)).toEqual(Array(3192).fill(0));
  });

  test.each([
    [
      'a mesh that is not its region',
      [mesh('a:right:1', 4), mesh('a:left:-1', 2), mesh('a:left:1', 4)],
      9,
    ],
    ['bytes left over', [mesh('a:right:1', 4), mesh('a:left:-1', 2), mesh('a:left:1', 3)], 10],
    ['too few bytes', [mesh('a:right:1', 4), mesh('a:left:-1', 2), mesh('a:left:1', 3)], 8],
  ])('refuses %s, and draws none of it', (_, meshes, bytes) => {
    expect(() => attachThickness({ meshes }, new Uint8Array(bytes), regions, 'a')).toThrow(
      /a:left:1: its mesh is not the cortex|does not cover its cortex|a:right:1: its mesh/,
    );
    expect(meshes.map((shown) => uniforms(shown)!.thicknessReady.value)).toEqual([
      false,
      false,
      false,
    ]);
  });
});
