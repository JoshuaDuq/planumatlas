import {
  MAGMA,
  cellColour,
  networkSpans,
  pairR,
  type NetworkMatrix,
} from '../../lib/core/catalog/network-matrix.ts';
import type { Rgb } from '../../lib/types/index.ts';

/** A parcel with itself has no correlation to show: a neutral grey apart from the ramp. */
export const DIAGONAL: Rgb = [128, 128, 128];

/** One pixel per pair, row by row, in the published order. */
export function matrixPixels(matrix: NetworkMatrix): ImageData {
  const n = matrix.parcels.length;
  const image = new ImageData(n, n);
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      const r = pairR(matrix, i, j);
      image.data.set([...(r === null ? DIAGONAL : cellColour(matrix, r)), 255], (i * n + j) * 4);
    }
  }
  return image;
}

/** The pair under a point of the drawn matrix, its row first; null outside it. */
export function cellAt(
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
  x: number,
  y: number,
  n: number,
): [number, number] | null {
  const row = Math.floor(((y - rect.top) / rect.height) * n);
  const column = Math.floor(((x - rect.left) / rect.width) * n);
  return row >= 0 && row < n && column >= 0 && column < n ? [row, column] : null;
}

const css = ([red, green, blue]: Rgb) => `rgb(${red} ${green} ${blue})`;

/**
 * The matrix as a figure to save: title, the network strips along both axes with the networks' names
 * down the left, the matrix at `cell` pixels a pair with the networks' borders, and the colour scale.
 */
export function matrixSheet({
  matrix,
  colours,
  names,
  title,
  scale,
  footer,
  cell = 3,
}: {
  matrix: NetworkMatrix;
  colours: Readonly<Record<string, Rgb>>;
  names: (network: string) => string;
  title: string;
  scale: string;
  footer: string;
  cell?: number;
}): HTMLCanvasElement {
  const n = matrix.parcels.length;
  const side = n * cell;
  const font = '13px system-ui, sans-serif';
  const pad = 24;
  const label = 190;
  const strip = 10;
  const left = pad + label + strip + 4;
  const top = pad + 34 + strip + 4;
  const canvas = document.createElement('canvas');
  canvas.width = left + side + pad;
  canvas.height = top + side + 86;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#111';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#eee';
  context.font = '600 15px system-ui, sans-serif';
  context.fillText(title, pad, pad + 14);

  const pixels = document.createElement('canvas');
  pixels.width = pixels.height = n;
  pixels.getContext('2d')!.putImageData(matrixPixels(matrix), 0, 0);
  context.imageSmoothingEnabled = false;
  context.drawImage(pixels, left, top, side, side);

  context.font = font;
  context.textBaseline = 'middle';
  context.textAlign = 'right';
  for (const span of networkSpans(matrix)) {
    const from = span.start * cell;
    const length = span.count * cell;
    context.fillStyle = css(colours[span.network]!);
    context.fillRect(left + from, top - strip - 4, length, strip);
    context.fillRect(left - strip - 4, top + from, strip, length);
    context.fillStyle = '#ddd';
    context.fillText(names(span.network), left - strip - 10, top + from + length / 2);
    if (span.start > 0) {
      context.fillStyle = 'rgb(255 255 255 / 0.7)';
      context.fillRect(left + from, top, 1, side);
      context.fillRect(left, top + from, side, 1);
    }
  }

  const rampTop = top + side + 22;
  const ramp = context.createLinearGradient(left, 0, left + side, 0);
  MAGMA.forEach((colour, at) => ramp.addColorStop(at / (MAGMA.length - 1), css(colour)));
  context.fillStyle = ramp;
  context.fillRect(left, rampTop, side, 10);
  context.fillStyle = '#ddd';
  context.textAlign = 'left';
  context.fillText(String(matrix.scale[0]), left, rampTop + 22);
  context.textAlign = 'right';
  context.fillText(String(matrix.scale[1]), left + side, rampTop + 22);
  context.fillText(scale, left - strip - 10, rampTop + 5);
  context.textAlign = 'left';
  context.fillStyle = '#aaa';
  context.fillText(footer, pad, rampTop + 46);
  return canvas;
}
