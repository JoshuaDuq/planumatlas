import { BufferAttribute, BufferGeometry, Matrix4 } from 'three';
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
 * their matrix. The points are shared, never copied, so the MRI navigator can read the same decode.
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
