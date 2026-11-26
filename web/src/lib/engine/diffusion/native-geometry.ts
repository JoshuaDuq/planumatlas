import { BufferAttribute, BufferGeometry, Matrix4 } from 'three';
import { TRACT_SLAB_MM } from '../api.ts';
import type { PlaneTracts } from '../api.ts';
import { streamlineLengths } from './streamlines.ts';
import { directionColors } from './tract-decode.ts';

/** RAS millimeters → the normal viewer's R/S/−A meters; no registration. Applied as the lines' matrix. */
export const RAS_MM_TO_WORLD = new Matrix4().set(
  0.001,
  0,
  0,
  0,
  0,
  0,
  0.001,
  0,
  0,
  -0.001,
  0,
  0,
  0,
  0,
  0,
  1,
);

/**
 * The point stride of the lines drawn while the camera moves: 1.5 mm chords of the 0.5 mm
 * streamlines, measured within 0.3 mm of them on CDMD; still frames draw every point.
 */
export const MOTION_STRIDE = 3;

const segmentCount = (offsets: Uint32Array, line: number, stride: number) =>
  Math.ceil((offsets[line + 1]! - 1 - offsets[line]!) / stride);

export function filterTractGeometry(
  geometry: BufferGeometry,
  offsets: Uint32Array,
  lengths: Float64Array,
  minimum: number,
  stride = 1,
  membership?: Uint8Array,
): void {
  if (!Number.isFinite(minimum) || minimum < 1) {
    throw new RangeError('Minimum streamline length must be at least 1 mm.');
  }
  if (membership && membership.length !== lengths.length) {
    throw new RangeError('Streamline membership must match the number of lines.');
  }
  const index = geometry.index!;
  const indices = index.array as Uint32Array;
  let needed = 0;
  for (let line = 0; line < lengths.length; line++)
    needed += 2 * segmentCount(offsets, line, stride);
  if (needed > indices.length)
    throw new RangeError(`The index holds too few segments for stride ${stride}.`);
  let count = 0;
  for (let line = 0; line < lengths.length; line++) {
    if (membership ? !membership[line] : lengths[line]! < minimum) continue;
    const last = offsets[line + 1]! - 1;
    for (let point = offsets[line]!; point < last; point += stride) {
      indices[count++] = point;
      indices[count++] = Math.min(point + stride, last);
    }
  }
  index.needsUpdate = true;
  geometry.setDrawRange(0, count);
}

/** The lines drawn while the camera moves: `geometry`'s own buffers, joined every MOTION_STRIDE points. */
export function createMotionGeometry(
  geometry: BufferGeometry,
  offsets: Uint32Array,
  lengths: Float64Array,
  minimum: number,
): BufferGeometry {
  const motion = new BufferGeometry();
  motion.setAttribute('position', geometry.getAttribute('position'));
  motion.setAttribute('color', geometry.getAttribute('color'));
  let segments = 0;
  for (let line = 0; line < lengths.length; line++)
    segments += segmentCount(offsets, line, MOTION_STRIDE);
  motion.setIndex(new BufferAttribute(new Uint32Array(segments * 2), 1));
  filterTractGeometry(motion, offsets, lengths, minimum, MOTION_STRIDE);
  motion.boundingBox = geometry.boundingBox!.clone();
  motion.boundingSphere = geometry.boundingSphere!.clone();
  return motion;
}

/**
 * Lines over the source points themselves, in RAS millimeters: draw them with RAS_MM_TO_WORLD as
 * their matrix. The points are shared, never copied: the linked MRI's planes read the same decode.
 */
export function createTractGeometry(
  points: Float32Array,
  offsets: Uint32Array,
  lengths: Float64Array = streamlineLengths(points, offsets),
  colors: Uint16Array = directionColors(points, offsets),
): { geometry: BufferGeometry; lengths: Float64Array } {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(points, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3, true));
  const segments = points.length / 3 - lengths.length;
  geometry.setIndex(new BufferAttribute(new Uint32Array(segments * 2), 1));
  filterTractGeometry(geometry, offsets, lengths, 1);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return { geometry, lengths };
}

/** Indexed segments per box in `segmentRuns`. */
const RUN = 16;

/**
 * The box round each run of RUN indexed segments of `points`, as min x, y, z then max x, y, z, so a
 * plane query tests a run once rather than each of its segments.
 */
export function segmentRuns(points: Float32Array, index: Uint32Array): Float32Array {
  const runs = new Float32Array(6 * Math.ceil(index.length / (2 * RUN)));
  for (let run = 0; run < runs.length / 6; run++) {
    const box = 6 * run;
    runs.fill(Infinity, box, box + 3).fill(-Infinity, box + 3, box + 6);
    for (let k = 2 * RUN * run; k < Math.min(index.length, 2 * RUN * (run + 1)); k++) {
      const point = 3 * index[k]!;
      for (let axis = 0; axis < 3; axis++) {
        runs[box + axis] = Math.min(runs[box + axis]!, points[point + axis]!);
        runs[box + 3 + axis] = Math.max(runs[box + 3 + axis]!, points[point + axis]!);
      }
    }
  }
  return runs;
}

/**
 * The indexed segments of `points` (RAS mm) within TRACT_SLAB_MM of a plane through `origin`, each
 * clipped to the slab and given as (across, up) mm along the plane's unit `u` and `v`, with the
 * direction colour of the whole segment.
 */
export function segmentsNearPlane(
  points: Float32Array,
  index: Uint32Array,
  plane: {
    origin: readonly number[];
    normal: readonly number[];
    u: readonly number[];
    v: readonly number[];
  },
): PlaneTracts {
  return segmentsNearPlanes(points, index, plane, [0], segmentRuns(points, index))[0]!;
}

/**
 * `segmentsNearPlane` for planes parallel to `plane`, each `offsets` mm from it along its normal, in
 * one pass over the segments: a series of sections costs about what one plane does. `runs` is
 * `segmentRuns` of these points and this index.
 */
export function segmentsNearPlanes(
  points: Float32Array,
  index: Uint32Array,
  plane: {
    origin: readonly number[];
    normal: readonly number[];
    u: readonly number[];
    v: readonly number[];
  },
  offsets: readonly number[],
  runs: Float32Array,
): PlaneTracts[] {
  if (runs.length !== 6 * Math.ceil(index.length / (2 * RUN)))
    throw new RangeError('The segment runs were taken of another index.');
  const { origin, normal, u, v } = plane;
  // Each plane's segments, written into arrays that double as they fill: a plane keeps hundreds of
  // thousands of segments of every tract shown.
  const kept = offsets.map(() => ({
    count: 0,
    ends: new Float32Array(4096),
    colors: new Uint8Array(3072),
  }));
  // Whether a run's box comes within the slab of a plane; the micrometre covers rounding.
  const reaches = (box: number) => {
    let middle = 0;
    let reach = TRACT_SLAB_MM + 1e-3;
    for (let axis = 0; axis < 3; axis++) {
      middle += normal[axis]! * ((runs[box + axis]! + runs[box + 3 + axis]!) / 2 - origin[axis]!);
      reach += (Math.abs(normal[axis]!) * (runs[box + 3 + axis]! - runs[box + axis]!)) / 2;
    }
    for (const offset of offsets) if (Math.abs(offset - middle) <= reach) return true;
    return false;
  };
  for (let k = 0; k < index.length; k += 2) {
    if (k % (2 * RUN) === 0 && !reaches((6 * k) / (2 * RUN))) {
      k += 2 * RUN - 2;
      continue;
    }
    const i = 3 * index[k]!;
    const j = 3 * index[k + 1]!;
    // Scalars, and the length only for a segment that reaches a slab: most of a run's do not.
    const px = points[i]! - origin[0]!,
      py = points[i + 1]! - origin[1]!,
      pz = points[i + 2]! - origin[2]!;
    const sx = points[j]! - points[i]!,
      sy = points[j + 1]! - points[i + 1]!,
      sz = points[j + 2]! - points[i + 2]!;
    const start0 = normal[0]! * px + normal[1]! * py + normal[2]! * pz;
    const rise = normal[0]! * sx + normal[1]! * sy + normal[2]! * sz;
    const lowest = Math.min(start0, start0 + rise) - TRACT_SLAB_MM;
    const highest = Math.max(start0, start0 + rise) + TRACT_SLAB_MM;
    let length = -1;
    for (let n = 0; n < offsets.length; n++) {
      const offset = offsets[n]!;
      if (offset < lowest || offset > highest) continue;
      if (length < 0) length = Math.hypot(sx, sy, sz);
      if (length === 0) break;
      const from = start0 - offset;
      // The part of the segment inside the slab, as fractions of it.
      let start = 0;
      let end = 1;
      if (rise === 0) {
        if (Math.abs(from) > TRACT_SLAB_MM) continue;
      } else {
        const low = (-TRACT_SLAB_MM - from) / rise;
        const high = (TRACT_SLAB_MM - from) / rise;
        start = Math.max(0, Math.min(low, high));
        end = Math.min(1, Math.max(low, high));
        if (start > end) continue;
      }
      // In-plane positions do not depend on the offset: u and v are normal to it.
      const ax = px + start * sx,
        ay = py + start * sy,
        az = pz + start * sz;
      const bx = px + end * sx,
        by = py + end * sy,
        bz = pz + end * sz;
      const piece = kept[n]!;
      if (4 * piece.count === piece.ends.length) {
        const ends = new Float32Array(2 * piece.ends.length);
        const colors = new Uint8Array(2 * piece.colors.length);
        ends.set(piece.ends);
        colors.set(piece.colors);
        Object.assign(piece, { ends, colors });
      }
      const e = 4 * piece.count;
      const c = 3 * piece.count++;
      piece.ends[e] = u[0]! * ax + u[1]! * ay + u[2]! * az;
      piece.ends[e + 1] = v[0]! * ax + v[1]! * ay + v[2]! * az;
      piece.ends[e + 2] = u[0]! * bx + u[1]! * by + u[2]! * bz;
      piece.ends[e + 3] = v[0]! * bx + v[1]! * by + v[2]! * bz;
      piece.colors[c] = Math.round((255 * Math.abs(sx)) / length);
      piece.colors[c + 1] = Math.round((255 * Math.abs(sy)) / length);
      piece.colors[c + 2] = Math.round((255 * Math.abs(sz)) / length);
    }
  }
  return kept.map(({ count, ends, colors }) => ({
    ends: ends.slice(0, 4 * count),
    colors: colors.slice(0, 3 * count),
  }));
}
