// Where each region's cut face is, measured as drawn: the caps rasterised on a 1 mm grid over the
// plane, each cell taken by the highest-ranked cap that draws there, as the stencil claims draw them.
import { Vector3 } from 'three';
import type { CapAnchor } from '../../types/index.ts';
import { worldToRas } from '../slices/coordinates.ts';
import type { Solid, SolidHit, SolidSections } from './solid-sections.ts';

/** A grid cell's side in world metres: 1 mm, the label volumes' own spacing. */
const CELL_M = 0.001;
const CELL_MM2 = (CELL_M * 1000) ** 2;
/** A cell no cap has claimed yet, and one claimed by a cap that names no region there. */
const FREE = -1;
const UNNAMED = -2;

export interface CapNaming {
  solids: Pick<SolidSections, 'solids' | 'plane' | 'pointInside'>;
  /** Whether the cap draws at a hit (`TissueSections.capVisibleAt`). */
  visibleAt(hit: SolidHit): boolean;
  /** The region the cap names at a hit (`TissueSections.named`). */
  regionAt(hit: SolidHit): string | null;
}

/** A sectioned cap's triangles, in world space: three positions each, no index. */
function capTriangles(solid: Solid): ArrayLike<number> {
  const position = solid.cap.geometry.getAttribute('position');
  return position.array.subarray(0, solid.cap.geometry.drawRange.count * 3);
}

/** The world points whose extent on the plane holds the cap: its triangles, or a stencil cap's solid. */
function extentPoints(solid: Solid): Vector3[] {
  if (!solid.sectioned) {
    const { min, max } = solid.bounds;
    return [0, 1, 2, 3, 4, 5, 6, 7].map(
      (corner) =>
        new Vector3(
          corner & 1 ? max.x : min.x,
          corner & 2 ? max.y : min.y,
          corner & 4 ? max.z : min.z,
        ),
    );
  }
  const array = capTriangles(solid);
  const points: Vector3[] = [];
  for (let at = 0; at < array.length; at += 3) {
    points.push(new Vector3(array[at]!, array[at + 1]!, array[at + 2]!));
  }
  return points;
}

/**
 * Each region's cut face as the plane shows it: its area, and its own cell nearest the centroid of
 * its cells, so the point lies on the face where a curved face's centroid would not. Largest first.
 */
export function capAnchors({ solids, visibleAt, regionAt }: CapNaming): CapAnchor[] {
  const shown = solids.solids.filter((solid) => solid.group.visible);
  if (!shown.length) return [];
  const { normal } = solids.plane;
  const origin = solids.plane.coplanarPoint(new Vector3());
  const u = new Vector3(Math.abs(normal.x) < 0.9 ? 1 : 0, Math.abs(normal.x) < 0.9 ? 0 : 1, 0)
    .cross(normal)
    .normalize();
  const v = new Vector3().crossVectors(normal, u);
  const offset = new Vector3();
  const onPlane = (point: Vector3): [number, number] => {
    offset.subVectors(point, origin);
    return [offset.dot(u) / CELL_M, offset.dot(v) / CELL_M];
  };

  /** The cells, on the plane, that a set of world points spans. */
  const spanOf = (points: readonly Vector3[]) => {
    const span = { sLow: Infinity, tLow: Infinity, sHigh: -Infinity, tHigh: -Infinity };
    for (const point of points) {
      const [s, t] = onPlane(point);
      span.sLow = Math.min(span.sLow, s);
      span.tLow = Math.min(span.tLow, t);
      span.sHigh = Math.max(span.sHigh, s);
      span.tHigh = Math.max(span.tHigh, t);
    }
    return span;
  };
  const whole = spanOf(shown.flatMap(extentPoints));
  const [s0, t0] = [Math.floor(whole.sLow), Math.floor(whole.tLow)];
  const columns = Math.ceil(whole.sHigh) - s0 + 1;
  const rows = Math.ceil(whole.tHigh) - t0 + 1;
  const owner = new Int32Array(columns * rows).fill(FREE);
  const names: string[] = [];
  const indices = new Map<string, number>();

  const centre = new Vector3();
  const centreOf = (column: number, row: number) =>
    centre
      .copy(origin)
      .addScaledVector(u, (s0 + column + 0.5) * CELL_M)
      .addScaledVector(v, (t0 + row + 0.5) * CELL_M);

  // Highest ranked first: the last of `solids` draws first and keeps what it claims.
  for (let rank = shown.length - 1; rank >= 0; rank--) {
    const solid = shown[rank]!;
    const claim = (column: number, row: number) => {
      const cell = row * columns + column;
      if (owner[cell] !== FREE) return;
      const point = centreOf(column, row);
      // A stencil cap covers the plane; it draws only inside its solid.
      if (!solid.sectioned && !solids.pointInside(solid, point, normal)) return;
      const hit = {
        point,
        distance: 0,
        object: solid.cap,
        source: solid.source,
        region: solid.region,
      } as unknown as SolidHit;
      if (!visibleAt(hit)) return;
      const region = regionAt(hit);
      if (region === null) {
        owner[cell] = UNNAMED;
        return;
      }
      let index = indices.get(region);
      if (index === undefined) {
        index = names.push(region) - 1;
        indices.set(region, index);
      }
      owner[cell] = index;
    };
    if (!solid.sectioned) {
      const { sLow, tLow, sHigh, tHigh } = spanOf(extentPoints(solid));
      for (let row = Math.floor(tLow) - t0; row < Math.min(rows, Math.ceil(tHigh) - t0); row++) {
        for (
          let column = Math.floor(sLow) - s0;
          column < Math.min(columns, Math.ceil(sHigh) - s0);
          column++
        ) {
          claim(column, row);
        }
      }
      continue;
    }
    const array = capTriangles(solid);
    const corner = new Vector3();
    for (let at = 0; at + 9 <= array.length; at += 9) {
      const [a, b, c] = [0, 3, 6].map((k) =>
        onPlane(corner.set(array[at + k]!, array[at + k + 1]!, array[at + k + 2]!)),
      ) as [[number, number], [number, number], [number, number]];
      const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (Math.abs(area) < 1e-12) continue;
      const sign = Math.sign(area);
      const edge = (p: [number, number], q: [number, number], s: number, t: number) =>
        sign * ((q[0] - p[0]) * (t - p[1]) - (q[1] - p[1]) * (s - p[0]));
      const sLow = Math.min(a[0], b[0], c[0]);
      const sHigh = Math.max(a[0], b[0], c[0]);
      const tLow = Math.min(a[1], b[1], c[1]);
      const tHigh = Math.max(a[1], b[1], c[1]);
      // Cells whose centres the triangle holds, edges included, so neighbours leave no seam.
      for (let row = Math.ceil(tLow - t0 - 0.5); row <= Math.floor(tHigh - t0 - 0.5); row++) {
        const t = t0 + row + 0.5;
        for (
          let column = Math.ceil(sLow - s0 - 0.5);
          column <= Math.floor(sHigh - s0 - 0.5);
          column++
        ) {
          const s = s0 + column + 0.5;
          if (edge(a, b, s, t) >= 0 && edge(b, c, s, t) >= 0 && edge(c, a, s, t) >= 0) {
            claim(column, row);
          }
        }
      }
    }
  }

  const count = new Float64Array(names.length);
  const sumS = new Float64Array(names.length);
  const sumT = new Float64Array(names.length);
  for (let cell = 0; cell < owner.length; cell++) {
    const index = owner[cell]!;
    if (index < 0) continue;
    count[index]! += 1;
    sumS[index]! += cell % columns;
    sumT[index]! += Math.floor(cell / columns);
  }
  const nearest = new Int32Array(names.length).fill(-1);
  const distance = new Float64Array(names.length).fill(Infinity);
  for (let cell = 0; cell < owner.length; cell++) {
    const index = owner[cell]!;
    if (index < 0) continue;
    const ds = (cell % columns) - sumS[index]! / count[index]!;
    const dt = Math.floor(cell / columns) - sumT[index]! / count[index]!;
    const squared = ds * ds + dt * dt;
    if (squared < distance[index]!) {
      distance[index] = squared;
      nearest[index] = cell;
    }
  }
  return names
    .map((region, index) => {
      const cell = nearest[index]!;
      return {
        region,
        point: worldToRas(centreOf(cell % columns, Math.floor(cell / columns))),
        areaMm2: count[index]! * CELL_MM2,
      };
    })
    .sort((a, b) => b.areaMm2 - a.areaMm2 || a.region.localeCompare(b.region));
}
