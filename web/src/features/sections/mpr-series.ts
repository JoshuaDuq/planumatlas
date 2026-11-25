/**
 * Serial sections of the Linked MRI: evenly spaced sections of one plane across the box the
 * segmentation labels, every picture cropped to that box so the sections share one scale, and a
 * localizer on a crossing plane marking where they lie.
 */
import type { MprPlane, PlaneFrame, Vec3 } from '../../lib/engine/api.ts';
import { crosshairOnPlane, pointOnPlane } from './mpr-draw.ts';
import type { Crop } from './mpr-draw.ts';

export const SERIES_COUNT = 11;
/** Kept around the labelled box in every picture, so no tissue meets the picture's edge. */
const MARGIN_MM = 4;

export interface Box {
  readonly min: Vec3;
  readonly max: Vec3;
}

/** The plane that crosses every section of a series, at right angles. */
export const LOCALIZER: Readonly<Record<MprPlane, MprPlane>> = {
  axial: 'sagittal',
  coronal: 'sagittal',
  sagittal: 'coronal',
};

/**
 * The sections' positions on an axis: a whole number of millimetres apart and centred on the box, so
 * the series spans it as SERIES_COUNT equal parts would, each section at a part's middle.
 */
export function seriesPositions(
  box: Box,
  axis: 0 | 1 | 2,
): { positions: number[]; spacing: number } {
  const spacing = Math.round((box.max[axis] - box.min[axis]) / SERIES_COUNT);
  if (spacing < 1)
    throw new RangeError(`The labelled box is too thin on axis ${axis} for a series.`);
  const centre = Math.round((box.min[axis] + box.max[axis]) / 2);
  const half = (SERIES_COUNT - 1) / 2;
  return {
    positions: Array.from(
      { length: SERIES_COUNT },
      (_, index) => centre + (index - half) * spacing,
    ),
    spacing,
  };
}

/** A panel's frame moved along its normal to `position` on its axis, as the panel would be there. */
export function frameAt(frame: PlaneFrame, axis: 0 | 1 | 2, position: number): PlaneFrame {
  const center: [number, number, number] = [0, 0, 0];
  center[axis] = position;
  return { ...frame, center };
}

/**
 * The box with its margin as a picture of `frame` shows it, in pixels of the sampled square. With
 * `aspect` (width over height), the shorter side grows evenly about the box until the crop has it.
 */
export function cropOf(
  frame: PlaneFrame,
  box: Box,
  fieldOfView: number,
  size: number,
  aspect?: number,
): Crop {
  const range = (direction: Vec3) => {
    const values = [0, 1, 2, 3, 4, 5, 6, 7].map((corner) =>
      [0, 1, 2].reduce(
        (sum, axis) =>
          sum +
          ((corner >> axis) & 1 ? box.max : box.min)[axis]! * direction[axis]! -
          frame.center[axis]! * direction[axis]!,
        0,
      ),
    );
    return [Math.min(...values) - MARGIN_MM, Math.max(...values) + MARGIN_MM];
  };
  const scale = size / fieldOfView;
  const [left, right] = range(frame.u).map((across) => (across + fieldOfView / 2) * scale);
  const [low, high] = range(frame.v).map((up) => (fieldOfView / 2 - up) * scale);
  let x = Math.floor(left!);
  let y = Math.floor(high!);
  let width = Math.ceil(right!) - x;
  let height = Math.ceil(low!) - y;
  if (aspect !== undefined) {
    if (width / height < aspect) {
      const grown = Math.round(height * aspect);
      x -= Math.floor((grown - width) / 2);
      width = grown;
    } else {
      const grown = Math.round(width / aspect);
      y -= Math.floor((grown - height) / 2);
      height = grown;
    }
  }
  return { x, y, width, height };
}

/** The point under (`xFraction`, `yFraction`) of a cropped picture, from its top-left corner. */
export function pointOnCrop(
  frame: PlaneFrame,
  crop: Crop,
  xFraction: number,
  yFraction: number,
  fieldOfView: number,
  size: number,
): Vec3 {
  return pointOnPlane(
    frame,
    (crop.x + xFraction * crop.width) / size,
    (crop.y + yFraction * crop.height) / size,
    fieldOfView,
  );
}

/** Where a point falls on a cropped picture, as fractions from its top-left corner. */
export function onCrop(
  frame: PlaneFrame,
  crop: Crop,
  point: Vec3,
  fieldOfView: number,
  size: number,
): [number, number] {
  const [across, down] = crosshairOnPlane(frame, point, fieldOfView);
  return [(across * size - crop.x) / crop.width, (down * size - crop.y) / crop.height];
}

/** Where the section at `position` on `axis` crosses the localizer: a vertical or horizontal line. */
export function lineOnLocalizer(
  localizer: PlaneFrame,
  crop: Crop,
  axis: 0 | 1 | 2,
  position: number,
  fieldOfView: number,
  size: number,
): { vertical: boolean; at: number } {
  const point: [number, number, number] = [...localizer.center];
  point[axis] = position;
  const [x, y] = onCrop(localizer, crop, point, fieldOfView, size);
  const vertical = Math.abs(localizer.u[axis]!) > 0.5;
  return { vertical, at: vertical ? x : y };
}

export interface SheetPicture {
  canvas: HTMLCanvasElement;
  /** Bottom-left: what the picture is. */
  label: string;
  /** Top, right, bottom and left letters, or none. */
  letters?: readonly string[];
  /** Top-left: the side convention's word, or none. */
  convention?: string | null;
}

const INK = '#f2f6fa';
const RING = '#0e1116';
const LINE = 'rgba(242, 246, 250, 0.72)';
const FOOTER_HEIGHT = 30;
export const SHEET_COLUMNS = 4;

function mark(context: CanvasRenderingContext2D, text: string, x: number, y: number) {
  context.strokeText(text, x, y);
  context.fillText(text, x, y);
}

/**
 * The series as one picture: the localizer, then the sections in order, SHEET_COLUMNS to a row at
 * the sections' own resolution on black; the localizer's section lines; and a footer saying what the
 * sheet shows. Each picture's letters and convention are drawn where its marks are on screen.
 */
export function seriesSheet({
  localizer,
  lines,
  sections,
  footer,
}: {
  localizer: SheetPicture;
  lines: readonly { vertical: boolean; at: number }[];
  sections: readonly SheetPicture[];
  footer: string;
}): HTMLCanvasElement {
  const cell = { width: sections[0]!.canvas.width, height: sections[0]!.canvas.height };
  const pictures = [localizer, ...sections];
  const rows = Math.ceil(pictures.length / SHEET_COLUMNS);
  const sheet = document.createElement('canvas');
  sheet.width = cell.width * SHEET_COLUMNS;
  sheet.height = cell.height * rows + FOOTER_HEIGHT;
  const context = sheet.getContext('2d')!;
  context.fillStyle = '#000000';
  context.fillRect(0, 0, sheet.width, sheet.height);
  context.lineJoin = 'round';

  for (const [index, picture] of pictures.entries()) {
    const left = (index % SHEET_COLUMNS) * cell.width;
    const top = Math.floor(index / SHEET_COLUMNS) * cell.height;
    context.drawImage(picture.canvas, left, top, cell.width, cell.height);

    if (picture === localizer) {
      context.beginPath();
      for (const { vertical, at } of lines) {
        if (vertical) {
          const x = Math.round(left + at * cell.width) + 0.5;
          context.moveTo(x, top);
          context.lineTo(x, top + cell.height);
        } else {
          const y = Math.round(top + at * cell.height) + 0.5;
          context.moveTo(left, y);
          context.lineTo(left + cell.width, y);
        }
      }
      context.strokeStyle = RING;
      context.lineWidth = 3;
      context.stroke();
      context.strokeStyle = LINE;
      context.lineWidth = 1;
      context.stroke();
    }

    context.lineWidth = 3;
    context.strokeStyle = RING;
    context.fillStyle = INK;
    if (picture.letters) {
      context.font = '600 15px ui-sans-serif, system-ui, sans-serif';
      context.textAlign = 'center';
      const places: [number, number][] = [
        [left + cell.width / 2, top + 22],
        [left + cell.width - 16, top + cell.height / 2 + 5],
        [left + cell.width / 2, top + cell.height - 12],
        [left + 16, top + cell.height / 2 + 5],
      ];
      for (const [side, place] of places.entries()) mark(context, picture.letters[side]!, ...place);
    }
    context.textAlign = 'left';
    if (picture.convention) {
      context.font = '600 13px ui-sans-serif, system-ui, sans-serif';
      mark(context, picture.convention, left + 10, top + 22);
    }
    context.font = '13px ui-monospace, SFMono-Regular, Menlo, monospace';
    mark(context, picture.label, left + 10, top + cell.height - 12);
  }

  context.fillStyle = 'rgba(242, 246, 250, 0.78)';
  context.font = '13px ui-sans-serif, system-ui, sans-serif';
  context.fillText(footer, 10, sheet.height - 10);
  return sheet;
}
