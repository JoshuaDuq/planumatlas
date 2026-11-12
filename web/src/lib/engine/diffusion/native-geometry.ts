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

const dot = (a: readonly number[], b: readonly number[]) =>
  a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;

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
  const { origin, normal, u, v } = plane;
  const ends: number[] = [];
  const colors: number[] = [];
  for (let k = 0; k < index.length; k += 2) {
    const i = 3 * index[k]!;
    const j = 3 * index[k + 1]!;
    const p = [points[i]! - origin[0]!, points[i + 1]! - origin[1]!, points[i + 2]! - origin[2]!];
    const step = [
      points[j]! - points[i]!,
      points[j + 1]! - points[i + 1]!,
      points[j + 2]! - points[i + 2]!,
    ];
    const length = Math.hypot(step[0]!, step[1]!, step[2]!);
    if (length === 0) continue;
    const from = dot(normal, p);
    const rise = dot(normal, step);
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
    for (const t of [start, end]) {
      const q = [p[0]! + t * step[0]!, p[1]! + t * step[1]!, p[2]! + t * step[2]!];
      ends.push(dot(u, q), dot(v, q));
    }
    for (const value of step) colors.push(Math.round((255 * Math.abs(value)) / length));
  }
  return { ends: Float32Array.from(ends), colors: Uint8Array.from(colors) };
}
