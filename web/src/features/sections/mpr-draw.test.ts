// Where a click on a panel's picture lands in the head, where the crosshair is marked on it, and its edge letters, with fixed frames;
// and a picture drawn again from what its plane kept, against the published scan.
import { describe, expect, test } from 'vitest';
import type { PlaneFrame, PlaneTracts, Vec3 } from '../../lib/engine/api.ts';
import { stagedFrame } from '../../lib/engine/slices/coordinates.ts';
import { sampleSlice, windowSlice } from '../../lib/engine/slices/sampling.ts';
import type { SliceWindow } from '../../lib/engine/slices/sampling.ts';
import { publishedSlices, referenceSlice } from '../../lib/engine/slices/slice-test-support.ts';
import {
  PLANES,
  VIRIDIS,
  blendFa,
  crosshairOnPlane,
  drawTracts,
  edgeLetter,
  faLevels,
  pointOnPlane,
} from './mpr-draw.ts';

const axial: PlaneFrame = {
  center: [0, 0, 10],
  normal: [0, 0, 1],
  u: [1, 0, 0],
  v: [0, 1, 0],
  edges: ['A', 'R', 'P', 'L'],
};
const sagittal: PlaneFrame = {
  center: [-5, 0, 0],
  normal: [1, 0, 0],
  u: [0, -1, 0],
  v: [0, 0, 1],
  edges: ['S', 'P', 'I', 'A'],
};

describe('a click on the picture', () => {
  test('the middle of an axial picture is the frame centre', () => {
    expect(pointOnPlane(axial, 0.5, 0.5, 256)).toEqual([0, 0, 10]);
  });

  test("the top-left corner of an axial picture is left-anterior (screen right is the patient's right)", () => {
    expect(pointOnPlane(axial, 0, 0, 256)).toEqual([-128, 128, 10]);
    expect(pointOnPlane(axial, 1, 1, 256)).toEqual([128, -128, 10]);
  });

  test('a sagittal picture runs posterior to anterior across and inferior to superior down', () => {
    expect(pointOnPlane(sagittal, 0.75, 0.25, 200)).toEqual([-5, -50, 50]);
  });

  test('the field of view scales the reach', () => {
    expect(pointOnPlane(axial, 1, 0.5, 100)).toEqual([50, 0, 10]);
  });
});

describe('where the crosshair falls on a picture', () => {
  test('is the inverse of a click: the point under a click marks the crosshair at that click', () => {
    const point = pointOnPlane(sagittal, 0.75, 0.25, 200);
    expect(crosshairOnPlane(sagittal, point, 200)).toEqual([0.75, 0.25]);
  });

  test('ignores the distance off the plane: an axial picture marks right and anterior alone', () => {
    // 64 mm right and anterior of the centre of a 256 mm field, 30 mm above the slice.
    expect(crosshairOnPlane(axial, [64, 64, 40], 256)).toEqual([0.75, 0.25]);
  });
});

describe('an edge letter', () => {
  test("is the reader's: right and left are D and G in French", () => {
    expect(['R', 'L', 'A', 'P', 'S', 'I'].map((edge) => edgeLetter(edge, 'fr'))).toEqual([
      'D',
      'G',
      'A',
      'P',
      'S',
      'I',
    ]);
  });

  test('is never a guess: an unknown letter is an error', () => {
    expect(() => edgeLetter('X', 'en')).toThrow(RangeError);
  });
});

/** `blendFa` as a plane was drawn with before it kept FA's levels, verbatim but for its name: FA read at every pixel. */
function referenceBlendFa(
  pixels: Uint8ClampedArray,
  frame: PlaneFrame,
  size: number,
  fieldOfView: number,
  fa: (point: Vec3) => number,
  opacity: number,
): void {
  const step = fieldOfView / size;
  const point: [number, number, number] = [0, 0, 0];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const across = (x + 0.5) * step - fieldOfView / 2;
      const up = fieldOfView / 2 - (y + 0.5) * step;
      for (let axis = 0; axis < 3; axis++)
        point[axis] = frame.center[axis]! + frame.u[axis]! * across + frame.v[axis]! * up;
      const value = fa(point);
      if (Number.isNaN(value)) continue;
      const colour = VIRIDIS[Math.round(255 * Math.max(0, Math.min(1, value)))]!;
      const index = (y * size + x) * 4;
      for (let channel = 0; channel < 3; channel++)
        pixels[index + channel] =
          pixels[index + channel]! * (1 - opacity) + colour[channel]! * opacity;
    }
}

describe('a plane drawn again from what it kept', () => {
  test('SECT-38 is, byte for byte, the plane read afresh: through each window, with labels, FA and the tracts on and off', () => {
    const { volumes } = publishedSlices();
    // The scan's own 0.5 mm pixels over a 64 mm field, through the left putamen and off the voxel grid.
    const size = 128;
    const fieldOfView = 64;
    const crosshair = [-28.3, -8.6, 22.2] as const;
    // FA past both ends of 0–1, and none above z = 30.
    const fa = ([x, y, z]: Vec3) =>
      z > 30 ? Number.NaN : 0.5 + 0.7 * Math.sin(x / 6) * Math.cos(y / 9);
    // Segments across the picture, along an edge and wholly off it, in their direction colours.
    const tracts: PlaneTracts = {
      ends: Float32Array.from([-30, -20, 25, 18, -32, 31.9, 32, 31.9, 40, 40, 50, 45, 0, 0, 3, -2]),
      colors: Uint8Array.from([255, 0, 0, 0, 255, 0, 0, 0, 255, 120, 60, 200]),
    };
    // The published window, the narrowest the slider gives, a wide one, centres that clamp every pixel
    // to white and to black, and one between whole numbers.
    const windows: SliceWindow[] = [
      [94, 188],
      [94, 10],
      [127.5, 1000],
      [-300, 40],
      [400, 40],
      [93.7, 187.3],
    ].map(([windowCenter, windowWidth]) => ({
      windowCenter: windowCenter!,
      windowWidth: windowWidth!,
    }));
    const firstDifference = (a: Uint8ClampedArray, b: Uint8ClampedArray) =>
      a.length === b.length ? a.findIndex((value, index) => value !== b[index]) : 0;
    for (const plane of PLANES) {
      const staged = stagedFrame(plane, crosshair, false);
      const frame: PlaneFrame = {
        center: staged.center.toArray(),
        normal: staged.normal.toArray(),
        u: staged.u.toArray(),
        v: staged.v.toArray(),
        edges: staged.edges,
      };
      const levels = faLevels(frame, size, fieldOfView, fa);
      for (const overlay of [false, true]) {
        const samples = sampleSlice(volumes, staged, { size, fieldOfView, overlay });
        for (const window of windows) {
          const sampled = referenceSlice(volumes, staged, {
            size,
            fieldOfView,
            overlay,
            ...window,
          });
          for (const opacity of [0, 0.35, 1])
            for (const withTracts of [false, true]) {
              const expected = sampled.slice();
              if (opacity) referenceBlendFa(expected, frame, size, fieldOfView, fa, opacity);
              if (withTracts) drawTracts(expected, size, fieldOfView, tracts);
              const drawn = windowSlice(samples, window);
              if (opacity) blendFa(drawn, levels, opacity);
              if (withTracts) drawTracts(drawn, size, fieldOfView, tracts);
              const name = `${plane}, overlay ${overlay}, window ${window.windowCenter}/${window.windowWidth}, FA ${opacity}, tracts ${withTracts}`;
              expect(firstDifference(drawn, expected), name).toBe(-1);
            }
        }
      }
    }
  });
});
