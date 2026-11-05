import { BoxGeometry, Mesh, SphereGeometry } from 'three';
import type { BufferGeometry } from 'three';
import { computeBoundsTree } from 'three-mesh-bvh';
import { describe, expect, test } from 'vitest';
import type { Region } from '../../types/index.ts';
import { rasToWorld } from './coordinates.ts';
import { drawnRegionAt, regionAt } from './region-at.ts';
import type { DrawnSolidsModel } from './region-at.ts';

// Sizes in millimetres; the scene's world unit is the metre.
function solid(
  geometry: BufferGeometry,
  center: [number, number, number],
  userData: Record<string, unknown>,
): Mesh {
  geometry.scale(0.001, 0.001, 0.001);
  geometry.boundsTree = computeBoundsTree.call(geometry);
  const mesh = new Mesh(geometry);
  mesh.position.copy(rasToWorld(center));
  mesh.userData = userData;
  mesh.updateMatrixWorld(true);
  return mesh;
}

const structure = (id: string, size: number, center: [number, number, number] = [0, 0, 0]) =>
  solid(new BoxGeometry(size, size, size), center, { region_id: id, kind: 'structure' });

describe('regionAt', () => {
  const outer = structure('outer', 40);
  const inner = solid(new SphereGeometry(5, 24, 16), [10, 0, 0], { region_id: 'inner' });

  test.each([
    ['inside the nested solid, the smaller one', [10, 2, -1], 'inner'],
    ['inside only the enclosing solid', [-10, 5, 5], 'outer'],
    ['outside both', [30, 0, 0], null],
    ['in the bounds of the sphere but outside its surface', [14.5, 4.5, 4.5], 'outer'],
  ] as const)('%s', (_, point, expected) => {
    expect(regionAt([outer, inner], point)).toBe(expected);
  });

  test('a solid moved by its transform is found where it is drawn', () => {
    expect(regionAt([structure('moved', 4, [50, -20, 30])], [51, -19, 31])).toBe('moved');
  });
});

describe('drawnRegionAt', () => {
  const regions = new Map(
    ['thalamus', 'parcel', 'hidden-parcel'].map((id) => [id, { id } as Region]),
  );
  const pial = (id: string) =>
    Object.assign(new Mesh(), { userData: { region_id: id, kind: 'cortex' } });
  const wedge = (id: string, center: [number, number, number]) =>
    solid(new BoxGeometry(6, 6, 6), center, { region_id: id, kind: 'ribbon' });

  function model(visibleMeshes: Mesh[]): DrawnSolidsModel {
    return {
      regions,
      state: { atlas: 'destrieux' },
      visibleMeshes,
      ensureRibbonWedges: async () => [
        wedge('parcel', [40, 0, 0]),
        wedge('hidden-parcel', [-40, 0, 0]),
      ],
    };
  }

  test('names a shown structure and a shown parcel through its ribbon solid', async () => {
    const shown = model([structure('thalamus', 10), pial('parcel')]);
    expect(await drawnRegionAt(shown, 'https://x/', [1, 1, 1])).toBe(regions.get('thalamus'));
    expect(await drawnRegionAt(shown, 'https://x/', [41, 0, 0])).toBe(regions.get('parcel'));
  });

  test('passes over what is not drawn: a hidden parcel, a hidden structure', async () => {
    const shown = model([pial('parcel')]);
    expect(await drawnRegionAt(shown, 'https://x/', [-40, 0, 0])).toBeNull();
    expect(await drawnRegionAt(shown, 'https://x/', [0, 0, 0])).toBeNull();
  });
});
