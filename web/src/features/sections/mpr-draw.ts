/**
 * One MPR panel's picture (ui/chrome/sections.js:353-388, 290-293): the resampled slice, where the
 * crosshair falls on it, the saved copy with its markings drawn in, and the inverse from a click on
 * it to a point in RAS millimetres.
 */
import { decimal } from '../../lib/core/format.ts';
import { t } from '../../lib/core/i18n/index.ts';
import type { MprPlane, PlaneFrame, Vec3 } from '../../lib/engine/api.ts';
import type { Language } from '../../lib/types/index.ts';

/** The crosshair axis each plane's slider moves (sections.js:17). */
export const AXES: Readonly<Record<MprPlane, 0 | 1 | 2>> = { sagittal: 0, coronal: 1, axial: 2 };
export const PLANES = ['sagittal', 'coronal', 'axial'] as const satisfies readonly MprPlane[];

/** The coordinate limit of the MRI's slider and the keys' clamp (sections.js:289). */
export const COORDINATE_LIMIT = 128;

const dot = (a: readonly number[], b: readonly number[]) =>
  a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;

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

/** The crosshair's ink and the dark ring that holds it off bright tissue, on screen and in a saved picture. */
export const CROSSHAIR_INK = '#4fb6e0';
export const CROSSHAIR_RING = '#0e1116';

/** Where the crosshair falls on a panel's picture, as fractions from its top-left corner. */
export function crosshairOnPlane(
  frame: PlaneFrame,
  crosshair: Vec3,
  fieldOfView: number,
): [number, number] {
  const displacement = crosshair.map((value, axis) => value - frame.center[axis]!);
  return [
    dot(displacement, frame.u) / fieldOfView + 0.5,
    0.5 - dot(displacement, frame.v) / fieldOfView,
  ];
}

/**
 * Draws the slice alone: the crosshair and letters are marked over it at screen resolution, so they
 * stay one pixel and legible however small the panel is. The canvas takes the slice's size, which clears it.
 */
export function drawSlice(
  canvas: HTMLCanvasElement,
  pixels: Uint8ClampedArray,
  size: number,
): void {
  canvas.width = size;
  canvas.height = size;
  // The MRI keeps all source intensities, including voxels no label covers.
  for (let index = 3; index < pixels.length; index += 4) pixels[index] = 255;
  canvas
    .getContext('2d')!
    .putImageData(new ImageData(pixels as Uint8ClampedArray<ArrayBuffer>, size, size), 0, 0);
}

export interface PanelMarks {
  plane: MprPlane;
  frame: PlaneFrame;
  fieldOfView: number;
  crosshair: Vec3;
  lang: Language;
}

/** The panel as saved: the drawn slice with the crosshair, the edge letters and the plane's offset in the bitmap. */
export function annotatedCopy(slice: HTMLCanvasElement, marks: PanelMarks): HTMLCanvasElement {
  const { plane, frame, fieldOfView, crosshair, lang } = marks;
  const size = slice.width;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d')!;
  context.drawImage(slice, 0, 0);

  const [across, down] = crosshairOnPlane(frame, crosshair, fieldOfView);
  const x = across * size;
  const y = down * size;
  context.beginPath();
  context.moveTo(x, 0);
  context.lineTo(x, size);
  context.moveTo(0, y);
  context.lineTo(size, y);
  context.strokeStyle = CROSSHAIR_RING;
  context.lineWidth = 3;
  context.stroke();
  context.strokeStyle = CROSSHAIR_INK;
  context.lineWidth = 1;
  context.stroke();

  context.textAlign = 'center';
  context.font = '600 15px ui-sans-serif, system-ui, sans-serif';
  context.lineWidth = 3;
  context.strokeStyle = CROSSHAIR_RING;
  context.fillStyle = '#f2f6fa';
  const places: [number, number][] = [
    [size / 2, 22],
    [size - 16, size / 2],
    [size / 2, size - 14],
    [16, size / 2],
  ];
  for (const [index, place] of places.entries()) {
    const letter = edgeLetter(frame.edges[index]!, lang);
    context.strokeText(letter, ...place);
    context.fillText(letter, ...place);
  }

  const annotation = `${t(lang, 'mpr').labels[plane]} ${decimal(crosshair[AXES[plane]], 1, lang, { signed: true })} mm`;
  context.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.textAlign = 'left';
  context.strokeText(annotation, 10, size - 12);
  context.fillText(annotation, 10, size - 12);
  return canvas;
}

/** An edge's letter in the reader's language (R and L are D and G in French). */
export function edgeLetter(edge: string, lang: Language): string {
  const letters = t(lang, 'orientation');
  if (!Object.hasOwn(letters, edge)) throw new RangeError(`Unknown orientation letter: ${edge}`);
  return letters[edge as keyof typeof letters];
}
