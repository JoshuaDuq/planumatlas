/**
 * The Linked MRI's axes and the point under a click: all the dialog's controller needs, kept apart
 * from the drawing so that the page's first visit does not carry it (BUILD-15).
 */
import type { MprPlane, PlaneFrame, Vec3 } from '../../lib/engine/api.ts';

/** The crosshair axis each plane's slider moves (sections.js:17). */
export const AXES: Readonly<Record<MprPlane, 0 | 1 | 2>> = { sagittal: 0, coronal: 1, axial: 2 };
export const PLANES = ['sagittal', 'coronal', 'axial'] as const satisfies readonly MprPlane[];

/** The coordinate limit of the MRI's slider and the keys' clamp (sections.js:289). */
export const COORDINATE_LIMIT = 128;

/**
 * The point under a click at (`xFraction`, `yFraction`) of the picture, from its top-left corner
 * (coordinates.js pointOnFrame). `fieldOfView` is the side of the square the frame spans.
 */
export function pointOnPlane(
  frame: PlaneFrame,
  xFraction: number,
  yFraction: number,
  fieldOfView: number,
): Vec3 {
  const across = (xFraction - 0.5) * fieldOfView;
  const up = (0.5 - yFraction) * fieldOfView;
  return [0, 1, 2].map(
    (axis) => frame.center[axis]! + frame.u[axis]! * across + frame.v[axis]! * up,
  ) as unknown as Vec3;
}
