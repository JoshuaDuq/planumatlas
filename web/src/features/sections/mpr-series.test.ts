// The serial sections' geometry on CDMD's labelled box as nibabel measures it on aseg.mgz, with the
// panels' frames as the stage faces each cut. Fixed expected values.
import { describe, expect, test } from 'vitest';
import { stagedFrame } from '../../lib/engine/slices/coordinates.ts';
import type { MprPlane, PlaneFrame, Vec3 } from '../../lib/engine/api.ts';
import {
  LOCALIZER,
  SERIES_COUNT,
  cropOf,
  frameAt,
  lineOnLocalizer,
  onCrop,
  pointOnCrop,
  seriesPositions,
} from './mpr-series.ts';

const CDMD = { min: [-68.5, -85.5, -51.5], max: [66.5, 66.5, 89.5] } as const satisfies {
  min: Vec3;
  max: Vec3;
};
const FOV = 256;
const SIZE = 512;

function panel(plane: MprPlane): PlaneFrame {
  const frame = stagedFrame(plane, [0, 0, 0], false);
  const array = (vector: { toArray(): number[] }) => vector.toArray() as unknown as Vec3;
  return {
    center: array(frame.center),
    normal: array(frame.normal),
    u: array(frame.u),
    v: array(frame.v),
    edges: [...frame.edges],
  };
}

describe('SECT-40 the positions', () => {
  test.each([
    ['axial', 2, 13, -46, 84],
    ['coronal', 1, 14, -79, 61],
    ['sagittal', 0, 12, -61, 59],
  ] as const)(
    'the %s series lies on axis %d, eleven sections %d mm apart from %d to %d mm',
    (_, axis, spacing, first, last) => {
      const series = seriesPositions(CDMD, axis);
      expect(series.spacing).toBe(spacing);
      expect(series.positions).toEqual(
        Array.from({ length: SERIES_COUNT }, (__, index) => first + index * spacing),
      );
      expect(series.positions.at(-1)).toBe(last);
      // Centred: as far inside the box at one end as at the other, to the millimetre.
      const inside = [first - CDMD.min[axis], CDMD.max[axis] - last];
      expect(Math.abs(inside[0]! - inside[1]!)).toBeLessThanOrEqual(1);
      expect(Math.min(...inside)).toBeGreaterThan(0);
    },
  );

  test('a box thinner than eleven half-millimetres has no series', () => {
    expect(() => seriesPositions({ min: [0, 0, 0], max: [1, 1, 5] }, 2)).toThrow(RangeError);
  });

  test('a section is its panel moved along the normal, with the same axes and letters', () => {
    const axial = panel('axial');
    const moved = frameAt(axial, 2, 19);
    expect(moved.center).toEqual([0, 0, 19]);
    expect([moved.normal, moved.u, moved.v, moved.edges]).toEqual([
      axial.normal,
      axial.u,
      axial.v,
      axial.edges,
    ]);
  });
});

describe('SECT-41 one scale for every picture', () => {
  test('an axial section shows the labelled box and 4 mm about it, in pixels of the 0.5 mm square', () => {
    // x −72.5…70.5 and y −89.5…70.5 mm, from the square's corner at (−128, +128).
    expect(cropOf(frameAt(panel('axial'), 2, 19), CDMD, FOV, SIZE)).toEqual({
      x: 111,
      y: 115,
      width: 286,
      height: 320,
    });
  });

  test('the localizer is widened about the box to the sections’ shape, not cut', () => {
    const sections = cropOf(panel('axial'), CDMD, FOV, SIZE);
    const sagittal = frameAt(panel(LOCALIZER.axial), 0, -1);
    // Its own box is 320 × 298 px: the height grows by 60 px, 30 above.
    expect(cropOf(sagittal, CDMD, FOV, SIZE, sections.width / sections.height)).toEqual({
      x: 77,
      y: 39,
      width: 320,
      height: 358,
    });
  });

  test('a click on a cropped picture finds the point under it, and that point falls back where it was clicked', () => {
    const frame = frameAt(panel('coronal'), 1, -9);
    const crop = cropOf(frame, CDMD, FOV, SIZE);
    const point = pointOnCrop(frame, crop, 0.25, 0.6, FOV, SIZE);
    expect(point[1]).toBe(-9);
    const [x, y] = onCrop(frame, crop, point, FOV, SIZE);
    expect(x).toBeCloseTo(0.25, 12);
    expect(y).toBeCloseTo(0.6, 12);
  });

  test('each axial section crosses the sagittal localizer as a horizontal line at its height', () => {
    const sagittal = frameAt(panel('sagittal'), 0, -1);
    const crop = { x: 77, y: 39, width: 320, height: 358 };
    // z = +19 mm is row (128 − 19) × 2 = 218 of the square, 179 of the crop's 358.
    expect(lineOnLocalizer(sagittal, crop, 2, 19, FOV, SIZE)).toEqual({ vertical: false, at: 0.5 });
    const coronal = frameAt(panel('coronal'), 1, -9);
    expect(
      lineOnLocalizer(coronal, cropOf(coronal, CDMD, FOV, SIZE), 0, 0, FOV, SIZE).vertical,
    ).toBe(true);
  });
});
