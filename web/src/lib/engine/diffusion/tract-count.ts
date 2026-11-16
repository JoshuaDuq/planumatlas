import { streamlinesCrossing } from '../lesion/measure.ts';
import { failure, inflate, readTrk } from './tract-decode.ts';
import type { TractFailure, TractPoints } from './tract-decode.ts';

/** A lesion in scanner RAS millimetres, where a tract file's points are. */
export interface ScannerSphere {
  centre: [number, number, number];
  radius: number;
}

/**
 * One lesion bundle to count. Without `buffer` or `points` the worker answers from what it keeps of
 * the file, or replies `missing` and the page sends one of them.
 */
export interface CountJob {
  token: number;
  file: string;
  sphere: ScannerSphere;
  /** The published file, compressed or not, decoded here. */
  buffer?: ArrayBuffer;
  /** Points the page has decoded already (the Tracts tab's), copied: counted, never kept. */
  points?: TractPoints;
}

export type CountReply =
  | { token: number; crossing: number; total: number }
  | { token: number; missing: true }
  | TractFailure;

/** Halving a float32 coordinate is exact, so each point's 2 mm cell is exact too. */
const CELL_MM = 2;

/**
 * How far past the lesion a bundle's points are kept, so the lesion placed again 5 mm away, or made
 * 5 mm larger, decodes nothing.
 */
const NEAR_MM = 5;

/**
 * The most decoded points kept. CDMD's 29 lesion bundles decode to 0.8 to 10.2 MB each, 126 MB
 * together. Those within NEAR_MM of a 10 mm lesion took 42 MB on average over 72 places in both
 * hemispheres, 70 MB at most, so this keeps a typical lesion's neighbourhood and never every
 * streamline. A bundle let go keeps its occupancy and is read again only when a lesion reaches it.
 */
const HELD_BYTES = 64 * 2 ** 20;

/**
 * The 2 mm cells of a bundle's bounding box that hold one of its points, one byte a cell. On CDMD
 * that is 4.8 to 117 KB a bundle and 1.7 MB for all 29 a lesion can count.
 */
interface Occupancy {
  origin: [number, number, number];
  size: [number, number, number];
  cells: Uint8Array;
}

function occupancy(pts: Float32Array): Occupancy {
  const low = [Infinity, Infinity, Infinity];
  const high = [-Infinity, -Infinity, -Infinity];
  for (let p = 0; p < pts.length; p += 3) {
    for (let axis = 0; axis < 3; axis++) {
      const cell = Math.floor(pts[p + axis]! / CELL_MM);
      if (!Number.isFinite(cell)) throw new Error('Streamline coordinates must be finite.');
      low[axis] = Math.min(low[axis]!, cell);
      high[axis] = Math.max(high[axis]!, cell);
    }
  }
  const origin = low as Occupancy['origin'];
  const size = high.map((top, axis) => top - origin[axis] + 1) as Occupancy['size'];
  const cells = new Uint8Array(size[0] * size[1] * size[2]);
  for (let p = 0; p < pts.length; p += 3) {
    const x = Math.floor(pts[p]! / CELL_MM) - origin[0];
    const y = Math.floor(pts[p + 1]! / CELL_MM) - origin[1];
    const z = Math.floor(pts[p + 2]! / CELL_MM) - origin[2];
    cells[x + size[0] * (y + size[1] * z)] = 1;
  }
  return { origin, size, cells };
}

/** How far a coordinate lies outside one cell's span on an axis, rounded as a point's difference is. */
const gap = (centre: number, cell: number) =>
  Math.max(cell * CELL_MM - centre, centre - (cell + 1) * CELL_MM, 0);

/**
 * Whether an occupied cell comes within `reach` of the centre. Each step rounds no further than the
 * same step of `streamlineMembership` for a point inside that cell, in the same order, so at the
 * lesion's own radius a bundle with a point the exact test counts always reaches: pruning never
 * changes a count.
 */
function reaches(
  { origin, size, cells }: Occupancy,
  [cx, cy, cz]: ScannerSphere['centre'],
  reach: number,
): boolean {
  const r2 = reach * reach;
  // A cell wider than the reach on each side: the gap, not this range, decides.
  const span = (centre: number, axis: 0 | 1 | 2) => [
    Math.max(0, Math.floor((centre - reach) / CELL_MM) - 1 - origin[axis]),
    Math.min(size[axis] - 1, Math.floor((centre + reach) / CELL_MM) + 1 - origin[axis]),
  ];
  const [x0, x1] = span(cx, 0);
  const [y0, y1] = span(cy, 1);
  const [z0, z1] = span(cz, 2);
  for (let z = z0!; z <= z1!; z++) {
    const dz = gap(cz, origin[2] + z);
    for (let y = y0!; y <= y1!; y++) {
      const dy = gap(cy, origin[1] + y);
      for (let x = x0!; x <= x1!; x++) {
        if (!cells[x + size[0] * (y + size[1] * z)]) continue;
        const dx = gap(cx, origin[0] + x);
        if (dx * dx + dy * dy + dz * dz <= r2) return true;
      }
    }
  }
  return false;
}

/** Every lesion bundle counted, by file: its streamline count and occupancy. */
const counted = new Map<string, { total: number; occupancy: Occupancy }>();
/** The decoded points kept, least recently used first, HELD_BYTES at most. */
const held = new Map<string, TractPoints>();
let heldBytes = 0;

const bytes = ({ pts, offsetPt0 }: TractPoints) => pts.byteLength + offsetPt0.byteLength;

function hold(file: string, points: TractPoints): void {
  held.set(file, points);
  heldBytes += bytes(points);
  for (const [other, kept] of held) {
    if (heldBytes <= HELD_BYTES) break;
    held.delete(other);
    heldBytes -= bytes(kept);
  }
}

/**
 * The worker's count: how many of a bundle's streamlines have a point in the sphere, by the exact
 * test the drawn lesion tract uses. A bundle whose occupancy the sphere does not reach crosses none,
 * read without its points; the others are counted on the points kept, the copy the page sends, or
 * the file decoded again. Points decoded here are kept while the lesion is within NEAR_MM of them.
 */
export async function countTract({
  token,
  file,
  sphere,
  buffer,
  points,
}: CountJob): Promise<CountReply> {
  try {
    const { centre, radius } = sphere;
    let bundle = counted.get(file);
    let source = held.get(file);
    if (source && reaches(bundle!.occupancy, centre, radius + NEAR_MM)) {
      held.delete(file);
      held.set(file, source);
    }
    if (bundle && !reaches(bundle.occupancy, centre, radius)) {
      return { token, crossing: 0, total: bundle.total };
    }
    if (!source) {
      if (points) source = points;
      else if (buffer) source = readTrk(await inflate(buffer));
      else return { token, missing: true };
    }
    if (!bundle) {
      bundle = { total: source.offsetPt0.length - 1, occupancy: occupancy(source.pts) };
      counted.set(file, bundle);
    }
    if (buffer && !held.has(file) && reaches(bundle.occupancy, centre, radius + NEAR_MM)) {
      hold(file, source);
    }
    const crossing = streamlinesCrossing(source.pts, source.offsetPt0, sphere);
    return { token, crossing, total: bundle.total };
  } catch (error) {
    return failure(token, error);
  }
}
