import assert from 'node:assert/strict';
import { test } from 'vitest';
import { Color, ColorManagement, LinearSRGBColorSpace, SRGBColorSpace, Vector3 } from 'three';
import {
  MOTION_STRIDE,
  RAS_MM_TO_WORLD,
  createMotionGeometry,
  createTractGeometry,
  filterTractGeometry,
  segmentRuns,
  segmentsNearPlane,
  segmentsNearPlanes,
} from './native-geometry.ts';

const points = new Float32Array([
  100, 200, 300, 103, 204, 300, 100, 200, 300, -100, 0, 0, -100, 0, 20,
]);
const offsets = new Uint32Array([0, 3, 5]);

test('native tract coordinates preserve RAS orientation and millimeter scale', () => {
  const original = points.slice();
  const { geometry, lengths } = createTractGeometry(points, offsets);
  const position = geometry.getAttribute('position');
  assert.equal(position.count, points.length / 3);
  // The lines draw the source points themselves; their matrix carries mm → m and the axes.
  assert.equal(position.array, points);
  const world = new Vector3().fromBufferAttribute(position, 0).applyMatrix4(RAS_MM_TO_WORLD);
  assert.ok(Math.abs(world.x - 0.1) < 1e-7);
  assert.ok(Math.abs(world.y - 0.3) < 1e-7);
  assert.ok(Math.abs(world.z + 0.2) < 1e-7);
  assert.deepEqual(points, original);
  assert.deepEqual(Array.from(lengths), [10, 20]);
  geometry.dispose();
});

test('native lines never join separate streamlines and filter only their indices', () => {
  const { geometry, lengths } = createTractGeometry(points, offsets);
  assert.deepEqual(Array.from(geometry.index!.array), [0, 1, 1, 2, 3, 4]);
  const position = geometry.getAttribute('position');
  const color = geometry.getAttribute('color');
  const index = geometry.index;
  filterTractGeometry(geometry, offsets, lengths, 15);
  assert.deepEqual(Array.from(geometry.index!.array.slice(0, geometry.drawRange.count)), [3, 4]);
  assert.equal(geometry.index, index);
  assert.equal(geometry.getAttribute('position'), position);
  assert.equal(geometry.getAttribute('color'), color);
  filterTractGeometry(geometry, offsets, lengths, 25);
  assert.equal(geometry.drawRange.count, 0);
  geometry.dispose();
});

test('direction colours display as |R|, |A|, |S| after the sRGB output encoding', () => {
  const line = new Float32Array([0, 0, 0, 3, 4, 0, 6, 8, 0, 0, 0, 0, 0, 0, 5]);
  const { geometry } = createTractGeometry(line, new Uint32Array([0, 3, 5]));
  const color = geometry.getAttribute('color');
  const shown = (index: number) =>
    new Color(color.getX(index), color.getY(index), color.getZ(index)).getRGB(
      new Color(),
      SRGBColorSpace,
    );
  assert.equal(ColorManagement.workingColorSpace, LinearSRGBColorSpace);
  const expectations: [number, number[]][] = [
    [1, [0.6, 0.8, 0]],
    [4, [0, 0, 1]],
  ];
  for (const [index, expected] of expectations) {
    const { r, g, b } = shown(index);
    [r, g, b].forEach((value, axis) =>
      assert.ok(Math.abs(value - expected[axis]!) < 1 / 255, `${value} ≠ ${expected[axis]}`),
    );
  }
  geometry.dispose();
});

test('a minimum below 1 mm is rejected', () => {
  const { geometry, lengths } = createTractGeometry(points, offsets);
  for (const minimum of [0, -1, NaN]) {
    assert.throws(() => filterTractGeometry(geometry, offsets, lengths, minimum), /at least 1 mm/);
  }
});

test('DIFF-09 a point with no direction is black, as is the tract centre of a doubled point', () => {
  const doubled = new Float32Array([1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 5, 1]);
  const { geometry } = createTractGeometry(doubled, new Uint32Array([0, 4]));
  const color = geometry.getAttribute('color');
  // Points 0 and 1 have a zero central difference; point 3 has a one-sided one along x and y.
  for (const index of [0, 1]) {
    assert.deepEqual([color.getX(index), color.getY(index), color.getZ(index)], [0, 0, 0]);
  }
  assert.ok(color.getX(3) > 0 && color.getY(3) > 0 && color.getZ(3) === 0);
  geometry.dispose();
});

test('DIFF-07 a streamline exactly as long as the minimum is kept', () => {
  const { geometry, lengths } = createTractGeometry(points, offsets);
  filterTractGeometry(geometry, offsets, lengths, 20);
  assert.deepEqual(Array.from(geometry.index!.array.slice(0, geometry.drawRange.count)), [3, 4]);
  geometry.dispose();
});

test('DIFF-06 the bounds of the lines are the bounds of the source points', () => {
  const { geometry } = createTractGeometry(points, offsets);
  assert.deepEqual(geometry.boundingBox!.min.toArray(), [-100, 0, 0]);
  assert.deepEqual(geometry.boundingBox!.max.toArray(), [103, 204, 300]);
  geometry.dispose();
});

test('the motion lines join every third point of the same buffers, ending on each streamline’s last', () => {
  assert.equal(MOTION_STRIDE, 3);
  // Seven points and two: strides of 3 end on point 6, and a two-point streamline keeps its one segment.
  const long = new Float32Array(Array.from({ length: 9 }, (_, i) => [i, 0, 0]).flat());
  const ends = new Uint32Array([0, 7, 9]);
  const { geometry, lengths } = createTractGeometry(long, ends);
  const motion = createMotionGeometry(geometry, ends, lengths, 1);
  assert.deepEqual(
    Array.from(motion.index!.array.slice(0, motion.drawRange.count)),
    [0, 3, 3, 6, 7, 8],
  );
  assert.equal(motion.getAttribute('position'), geometry.getAttribute('position'));
  assert.equal(motion.getAttribute('color'), geometry.getAttribute('color'));
  assert.ok(motion.boundingSphere!.equals(geometry.boundingSphere!));
  filterTractGeometry(motion, ends, lengths, 2, MOTION_STRIDE);
  assert.deepEqual(Array.from(motion.index!.array.slice(0, motion.drawRange.count)), [0, 3, 3, 6]);
  // A stride the index was not sized for would write past it.
  assert.throws(() => filterTractGeometry(motion, ends, lengths, 1), /index/);
  geometry.dispose();
  motion.dispose();
});

test('a segment crossing a plane is cut where it leaves the 2 mm slab, laid flat on the plane, in its direction colour', () => {
  // An axial plane through z = 10, seen with u along A and v along R, so the axes are not the identity.
  const plane = { origin: [0, 0, 10], normal: [0, 0, 1], u: [0, 1, 0], v: [1, 0, 0] };
  const crossing = new Float32Array([3, 0, 6, 3, 4, 14]); // z 6 → 14, y 0 → 4: rises 2 mm in z per mm of y
  const { ends, colors } = segmentsNearPlane(crossing, new Uint32Array([0, 1]), plane);
  // Clipped to z 8 → 12, which is y 1 → 3, at R = 3.
  assert.deepEqual([...ends], [1, 3, 3, 3]);
  const length = Math.hypot(4, 8);
  assert.deepEqual(
    [...colors],
    [0, Math.round((255 * 4) / length), Math.round((255 * 8) / length)],
  );
});

test('a plane keeps the segments within the slab whole and drops those beyond it, flat or not', () => {
  const plane = { origin: [0, 0, 0], normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] };
  // prettier-ignore
  const points = new Float32Array([
    0, 0, 1.5, 5, 0, 1.5, // flat, inside: whole
    0, 0, 2.5, 5, 0, 2.5, // flat, just beyond: dropped
    0, 0, 3, 0, 1, 9, // rising, wholly above: dropped
    0, 0, -1, 0, 2, 1, // rising, wholly inside: whole
    1, 1, 1, 1, 1, 1, // no length: dropped
  ]);
  const { ends, colors } = segmentsNearPlane(
    points,
    new Uint32Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
    plane,
  );
  assert.deepEqual([...ends], [0, 0, 5, 0, 0, 0, 0, 2]);
  assert.equal(colors.length, 6);
});

test('SECT-44 parallel planes taken in one pass keep, each, what the plane alone keeps', () => {
  // A random walk of 3,000 points in steps up to 1 mm that climbs from z −20 to +20 mm: segments that
  // cross, graze and miss each slab.
  let state = 11;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32 - 0.5;
  };
  const points = new Float32Array(3000 * 3);
  points[2] = -20;
  for (let n = 3; n < points.length; n += 3) {
    points[n] = points[n - 3]! + random();
    points[n + 1] = points[n - 2]! + random();
    points[n + 2] = points[n - 1]! + 40 / 2999 + random();
  }
  const index = new Uint32Array(2 * 2999).map((_, k) => (k >> 1) + (k & 1));
  const plane = { origin: [1, -2, 0.25], normal: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] };
  const offsets = [-13, 0, 4, 13];
  const together = segmentsNearPlanes(points, index, plane, offsets, segmentRuns(points, index));
  offsets.forEach((offset, n) => {
    const alone = segmentsNearPlane(points, index, {
      ...plane,
      origin: plane.origin.map((value, axis) => value + offset * plane.normal[axis]!),
    });
    assert.ok(alone.colors.length > 0, `the plane ${offset} mm along keeps segments`);
    assert.deepEqual([...together[n]!.colors], [...alone.colors]);
    assert.equal(together[n]!.ends.length, alone.ends.length);
    together[n]!.ends.forEach((value, k) => assert.ok(Math.abs(value - alone.ends[k]!) < 1e-4));
  });
});

test('a run’s box is the extent of its segments’ ends, sixteen segments to a run', () => {
  // Point p is (p, −3p − 1, −3p − 2). A filter has left 20 segments of one streamline, then 10 of
  // another from point 32: a run spans both.
  const points = new Float32Array(60 * 3).map((_, n) => (n % 3 === 0 ? n / 3 : -n));
  const index = new Uint32Array([
    ...Array.from({ length: 20 }, (_, s) => [s, s + 1]).flat(),
    ...Array.from({ length: 10 }, (_, s) => [32 + s, 33 + s]).flat(),
  ]);
  const runs = segmentRuns(points, index);
  // prettier-ignore
  assert.deepEqual([...runs], [
    0, -49, -50, 16, -1, -2, // the first 16 segments: points 0 to 16
    16, -127, -128, 42, -49, -50, // the last 14: points 16 to 20 and 32 to 42
  ]);
});

test('runs skip only segments the slab would drop: what is kept is what testing every segment keeps', () => {
  // A random walk of 4,000 points in steps up to 1 mm through z −30 to +30 mm, cut by an oblique plane.
  let state = 5;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32 - 0.5;
  };
  const points = new Float32Array(4000 * 3);
  points[2] = -30;
  for (let n = 3; n < points.length; n += 3) {
    points[n] = points[n - 3]! + random();
    points[n + 1] = points[n - 2]! + random();
    points[n + 2] = points[n - 1]! + 60 / 3999 + random();
  }
  // Pieces of 23 segments in shuffled order, so a run beyond the slab can be followed by one in it.
  const pieces = Array.from({ length: Math.ceil(3999 / 23) }, (_, n) => n);
  for (let n = pieces.length - 1; n > 0; n--) {
    const other = Math.floor((random() + 0.5) * (n + 1));
    [pieces[n], pieces[other]] = [pieces[other]!, pieces[n]!];
  }
  const index = new Uint32Array(
    pieces.flatMap((piece) =>
      Array.from({ length: Math.min(23, 3999 - 23 * piece) }, (_, s) => [
        23 * piece + s,
        23 * piece + s + 1,
      ]).flat(),
    ),
  );
  const normal = [0.3, -0.2, 0.9].map((value, _, all) => value / Math.hypot(...all));
  const u = [0.2, 0.3, 0].map((value, _, all) => value / Math.hypot(...all));
  const v = [
    normal[1]! * u[2]! - normal[2]! * u[1]!,
    normal[2]! * u[0]! - normal[0]! * u[2]!,
    normal[0]! * u[1]! - normal[1]! * u[0]!,
  ];
  const plane = { origin: [0.4, -1.1, 0.7], normal, u, v };
  // One box round everything: no run is skipped.
  const everything = segmentRuns(points, index).map((_, n) => (n % 6 < 3 ? -1e30 : 1e30));
  const runs = segmentRuns(points, index);
  // One plane at a time, as a slide asks, then a series of them in one pass.
  for (const offsets of [...Array.from({ length: 121 }, (_, n) => [-24 + n * 0.4]), [-20, 0, 9]]) {
    const [culled, whole] = [runs, everything].map((boxes) =>
      segmentsNearPlanes(points, index, plane, offsets, boxes),
    );
    offsets.forEach((offset, n) => {
      assert.ok(whole![n]!.colors.length > 0, `the plane ${offset} mm along keeps segments`);
      assert.deepEqual([...culled![n]!.ends], [...whole![n]!.ends], `ends at ${offset} mm`);
      assert.deepEqual([...culled![n]!.colors], [...whole![n]!.colors], `colours at ${offset} mm`);
    });
  }
  assert.throws(() => segmentsNearPlanes(points, index.subarray(0, 64), plane, [0], runs), /runs/);
});
