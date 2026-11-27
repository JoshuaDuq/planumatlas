// How a published borders file is laid on the shown atlas's cortex meshes.
import { describe, expect, test } from 'vitest';
import {
  BufferAttribute,
  BufferGeometry,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
} from 'three';
import type { Material } from 'three';
import type { Region } from '../../types/index.ts';
import { appearance } from '../render/test-support.ts';
import { SurfaceMaterials } from './surface-materials.ts';
import { addAtlasBorders, attachBorders, isBorderByte } from './atlas-borders.ts';
import type { BordersUniforms } from './atlas-borders.ts';

function mesh(id: string, vertices: number, withBorders = true) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(vertices * 3), 3));
  const material = new MeshPhysicalMaterial();
  if (withBorders) addAtlasBorders(material);
  const shown = new Mesh(geometry, material);
  shown.userData['region_id'] = id;
  return shown;
}

const region = (id: string, vertexCount = 0, kind: Region['kind'] = 'cortex') => {
  const [atlas, hemisphere] = id.split(':');
  return { id, atlas, hemisphere, kind, vertex_count: vertexCount } as Region;
};
const slot = (shown: Mesh) =>
  (shown.material as MeshPhysicalMaterial).userData['borders'] as BordersUniforms | undefined;
const bytes = (shown: Mesh) => [...(slot(shown)!.bordersCodes.value!.image.data as Uint8Array)];
const overlay = ['b:left:0', 'b:left:1', 'b:right:0', 'c:left:4', 'c:right:5'].map((id) =>
  region(id),
);
const unlabelled = ['b:left:-1', 'b:right:-1'].map((id) => region(id, 0, 'non-region'));

describe("BORDER-01 another atlas's borders lie on the shown cortex's vertices, one to three classes and one label each, all or none", () => {
  const regions = [region('a:left:1', 3), region('a:right:1', 2), ...overlay, ...unlabelled];

  test('a class byte holds one to three of the five classes, never none', () => {
    expect([0b1, 0b10, 0b10010, 0b111, 0b11001].map(isBorderByte)).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
    expect([0, 0b1111, 0b11110, 32, 255].map(isBorderByte)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  test("gives each mesh its region's classes to draw and labels to name, and the next atlas's replace them", () => {
    const meshes = [mesh('a:right:1', 2), mesh('a:left:1', 3)];
    // Classes for a:left:1's three vertices and a:right:1's two, then their labels plus one.
    attachBorders({ meshes }, Uint8Array.from([2, 6, 4, 1, 3, 1, 1, 2, 0, 1]), regions, 'a', 'b');
    expect(bytes(meshes[1]!)).toEqual([2, 6, 4]);
    expect(bytes(meshes[0]!)).toEqual([1, 3]);
    expect(meshes.map((shown) => slot(shown)!.bordersReady.value)).toEqual([true, true]);
    expect([...meshes[1]!.userData['borderNames'].labels]).toEqual([1, 1, 2]);
    expect([...meshes[0]!.userData['borderNames'].labels]).toEqual([0, 1]);
    const first = slot(meshes[0]!)!.bordersCodes.value!;
    let disposed = false;
    first.addEventListener('dispose', () => (disposed = true));
    attachBorders({ meshes }, Uint8Array.from([8, 8, 8, 16, 24, 5, 5, 5, 6, 6]), regions, 'a', 'c');
    expect(bytes(meshes[0]!)).toEqual([16, 24]);
    expect(meshes[0]!.userData['borderNames'].overlay).toBe('c');
    expect(disposed).toBe(true);
  });

  test.each([
    ['a class byte with no class', [2, 6, 0, 1, 3, 1, 1, 2, 0, 1], true],
    ['a class byte with four classes', [2, 6, 30, 1, 3, 1, 1, 2, 0, 1], true],
    ['a label naming no region on its side', [2, 6, 4, 1, 3, 1, 1, 2, 0, 2], true],
    ['too few bytes', [2, 6, 4, 1, 1, 1, 2, 0], true],
    ['a cortex drawn without borders', [2, 6, 4, 1, 3, 1, 1, 2, 0, 1], false],
  ])('refuses %s, and draws none of it', (_, codes, patched) => {
    const meshes = [mesh('a:right:1', 2, patched), mesh('a:left:1', 3, patched)];
    expect(() => attachBorders({ meshes }, Uint8Array.from(codes), regions, 'a', 'b')).toThrow(
      /b borders/,
    );
    expect(meshes.map((shown) => slot(shown)?.bordersReady.value ?? false)).toEqual([false, false]);
    expect(meshes.map((shown) => shown.userData['borderNames'])).toEqual([undefined, undefined]);
  });
});

describe('BORDER-06 the cortex takes the borders patch on their first showing, a cortex loaded later too', () => {
  const dressable = (id: string) => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(9), 3));
    for (const name of ['_sulc', '_openness', '_t1']) {
      geometry.setAttribute(name, new BufferAttribute(new Float32Array(3), 1));
    }
    const shown = new Mesh(geometry, new MeshStandardMaterial());
    shown.userData['region_id'] = id;
    return shown;
  };
  const regions = new Map([
    ['a:left:1', { id: 'a:left:1', kind: 'cortex' }],
    ['a:left:-1', { id: 'a:left:-1', kind: 'non-region' }],
    ['aseg:left:17', { id: 'aseg:left:17', kind: 'structure' }],
  ] as [string, Region][]);

  test('a patched material keeps its own chain and takes a program of its own', () => {
    const material = new MeshPhysicalMaterial();
    const chained: string[] = [];
    material.onBeforeCompile = () => void chained.push('own');
    material.customProgramCacheKey = () => 'cortex';
    addAtlasBorders(material);
    expect(material.customProgramCacheKey()).toBe('cortex-borders');
    const shader = { uniforms: {}, vertexShader: '', fragmentShader: '' };
    material.onBeforeCompile(shader as never, null as never);
    expect(chained).toEqual(['own']);
    expect(Object.keys(shader.uniforms)).toContain('bordersCodes');
  });

  test('every cortical material is patched once, a structure never, and a cortex dressed after as it is', () => {
    const materials = new SurfaceMaterials({ appearance } as never, regions);
    const dress = (id: string) =>
      materials.dress(
        dressable(id) as never,
        regions.get(id)!,
        regions.get(id)!.kind !== 'structure',
      );
    const layer = { meshes: [dress('a:left:1'), dress('a:left:-1'), dress('aseg:left:17')] };
    const patched: Material[] = [];
    materials.attachBorders((material) => patched.push(material), [layer as never]);
    expect(patched).toEqual([layer.meshes[0]!.material, layer.meshes[1]!.material]);
    materials.attachBorders(() => patched.push(new MeshPhysicalMaterial()), [layer as never]);
    expect(patched).toHaveLength(2);
    const later = dress('a:left:1');
    expect(patched.at(-1)).toBe(later.material);
    dress('aseg:left:17');
    expect(patched).toHaveLength(3);
  });
});
