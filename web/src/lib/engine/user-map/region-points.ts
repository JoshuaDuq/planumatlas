import { Raycaster, Vector3 } from 'three';
import type { Mesh } from 'three';
import { rasToWorld, worldToRas } from '../slices/coordinates.ts';
import { crossings, worldBounds } from '../slices/region-at.ts';

/** Rows run this far (mm) off the whole millimetre, never along a marching-cubes mesh's lattice edges. */
const OFFSET = [0.0013, 0.0007] as const;
const X = new Vector3(1, 0, 0);

/**
 * The whole-millimetre points of surface RAS inside any of a region's closed solids, xyz interleaved,
 * by the winding count along rows in x (as `regionAt` decides a point).
 */
export function regionPoints(solids: readonly Mesh[]): Float32Array {
  const inside = new Set<number>();
  const raycaster = new Raycaster();
  // Keys of points within ±1024 mm of the origin.
  const key = (i: number, j: number, k: number) =>
    ((i + 1024) * 2048 + (j + 1024)) * 2048 + k + 1024;
  for (const solid of solids) {
    solid.updateWorldMatrix(true, false);
    const bounds = worldBounds(solid);
    const [x0, y0, z0] = worldToRas(bounds.min);
    const [x1, y1, z1] = worldToRas(bounds.max);
    const [ylow, yhigh] = [Math.min(y0, y1), Math.max(y0, y1)];
    const start = x0 - 1;
    for (let j = Math.ceil(ylow); j <= yhigh; j++) {
      for (let k = Math.ceil(z0); k <= z1; k++) {
        raycaster.set(rasToWorld([start, j + OFFSET[0], k + OFFSET[1]]), X);
        const hits = crossings(solid, raycaster);
        if (!hits.length) continue;
        let next = 0;
        let winding = 0;
        for (let i = Math.ceil(x0); i <= x1; i++) {
          const distance = (i - start) / 1000;
          while (next < hits.length && hits[next]!.distance < distance)
            winding += hits[next++]!.sign;
          if (winding !== 0) inside.add(key(i, j, k));
        }
      }
    }
  }
  const points = new Float32Array(3 * inside.size);
  let n = 0;
  for (const value of inside) {
    points[n++] = Math.floor(value / 2048 ** 2) - 1024;
    points[n++] = (Math.floor(value / 2048) % 2048) - 1024;
    points[n++] = (value % 2048) - 1024;
  }
  return points;
}
