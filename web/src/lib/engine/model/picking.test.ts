import { describe, expect, test } from 'vitest';
import { Mesh, PerspectiveCamera, Vector3 } from 'three';
import type { Region } from '../../types/index.ts';
import { rasToWorld } from '../slices/coordinates.ts';
import { inSight } from './picking.ts';
import type { AtlasMesh } from './layers.ts';
import type { StageHit } from './picking.ts';

const region = (id: string): Region => ({ id, label: id, hemisphere: 'left', kind: 'structure' });
const regions = new Map(['a', 'b'].map((id) => [id, region(id)]));
const meshOf = (id: string) => {
  const mesh = new Mesh() as unknown as AtlasMesh;
  mesh.userData = { region_id: id };
  return mesh;
};

describe('inSight', () => {
  // The camera 0.5 m along +z looks at the origin, where the name stands.
  const camera = new PerspectiveCamera();
  camera.position.set(0, 0, 0.5);
  camera.lookAt(0, 0, 0);
  const point: [number, number, number] = [0, 0, 0];
  const at = rasToWorld(point);
  const reach = at.distanceTo(new Vector3(0, 0, 0.5));
  /** Whether a's name stands in sight when the first thing its ray meets is `hit`, at its point unless said. */
  const sees = (hit: Partial<StageHit>, distance = reach) =>
    inSight([{ id: 'a', point }], {
      regions,
      meshes: [meshOf('a'), meshOf('b')],
      camera,
      size: { width: 100, height: 100 },
      intersect: () => ({ point: at, distance, ...hit }) as StageHit,
    })[0];

  test('a name meeting its own region is in sight; one behind something nearer is not', () => {
    expect(sees({ object: meshOf('a') })).toBe(true);
    expect(sees({ region: regions.get('a')! })).toBe(true);
    expect(sees({ object: meshOf('b') }, reach / 2)).toBe(false);
  });

  test('a surface met at the point is in sight whichever region’s triangle the ray meets; a cut face is not', () => {
    // The edge two regions share.
    expect(sees({ object: meshOf('b') })).toBe(true);
    // A cut moved along its normal: the face at the carried point now shows another region, or none.
    expect(sees({ region: regions.get('b')! })).toBe(false);
    expect(sees({ region: null })).toBe(false);
  });
});
