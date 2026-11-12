/**
 * One MPR panel's picture (ui/chrome/sections.js:353-388, 290-293): the resampled slice, where the
 * crosshair falls on it, the saved copy with its markings drawn in, and the inverse from a click on
 * it to a point in RAS millimetres.
 */
import { decimal } from '../../lib/core/format.ts';
import { t } from '../../lib/core/i18n/index.ts';
import type { MprPlane, PlaneFrame, PlaneTracts, Vec3 } from '../../lib/engine/api.ts';
import type { Language } from '../../lib/types/index.ts';
import { sideConvention } from './mpr-words.ts';

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

/** NiiVue's viridis, as the tract MRI drew FA: its four stops, linear between them over 256 levels. */
const VIRIDIS_STOPS = [
  [0, 68, 1, 84],
  [64, 49, 104, 142],
  [192, 53, 183, 121],
  [255, 253, 231, 37],
] as const;
export const VIRIDIS: readonly (readonly [number, number, number])[] = Array.from(
  { length: 256 },
  (_, level) => {
    const upper = VIRIDIS_STOPS.findIndex(([at]) => at >= level);
    const high = VIRIDIS_STOPS[upper]!;
    const low = VIRIDIS_STOPS[Math.max(0, upper - 1)]!;
    const share = high[0] === low[0] ? 0 : (level - low[0]) / (high[0] - low[0]);
    return [1, 2, 3].map((channel) =>
      Math.round(low[channel]! + share * (high[channel]! - low[channel]!)),
    ) as unknown as [number, number, number];
  },
);

/**
 * FA over a resampled slice, each pixel at its centre as the engine samples the slice: viridis over
 * 0–1 at `opacity`, nothing where FA has no value.
 */
export function blendFa(
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

/** The tracts on a slice, one pixel wide in each segment's direction colour. */
export function drawTracts(
  pixels: Uint8ClampedArray,
  size: number,
  fieldOfView: number,
  { ends, colors }: PlaneTracts,
): void {
  const scale = size / fieldOfView;
  for (let segment = 0; segment < colors.length / 3; segment++) {
    const x0 = ends[4 * segment]! * scale + size / 2;
    const y0 = size / 2 - ends[4 * segment + 1]! * scale;
    const dx = ends[4 * segment + 2]! * scale + size / 2 - x0;
    const dy = size / 2 - ends[4 * segment + 3]! * scale - y0;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
    for (let s = 0; s <= steps; s++) {
      const x = Math.floor(x0 + (dx * s) / steps);
      const y = Math.floor(y0 + (dy * s) / steps);
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      const index = (y * size + x) * 4;
      for (let channel = 0; channel < 3; channel++)
        pixels[index + channel] = colors[3 * segment + channel]!;
    }
  }
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

/**
 * The panel as saved: the drawn slice with the crosshair, the edge letters, the side convention of
 * an axial or coronal panel and the plane's offset in the bitmap.
 */
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

  const convention = sideConvention(frame.edges);
  context.textAlign = 'left';
  if (convention) {
    const mark = t(lang, 'mpr').conventionMarks[convention];
    context.font = '600 13px ui-sans-serif, system-ui, sans-serif';
    context.strokeText(mark, 10, 22);
    context.fillText(mark, 10, 22);
  }

  const annotation = `${t(lang, 'mpr').labels[plane]} ${decimal(crosshair[AXES[plane]], 1, lang, { signed: true })} mm`;
  context.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';
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
