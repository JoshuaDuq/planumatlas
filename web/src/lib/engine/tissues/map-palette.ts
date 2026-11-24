import { DataTexture, FloatType, RGBAFormat } from 'three';
import type { Label } from './palette.ts';

/** Each label of the map `atlas` in its published colour, opaque; every other label transparent. */
export function mapPaletteData(labels: readonly Label[], atlas: string): Float32Array {
  const data = new Float32Array(labels.length * 4);
  for (const [code, label] of labels.entries()) {
    if (!label.region_id?.startsWith(`${atlas}:`)) continue;
    // The palette is linear, as the cut's own palette is after `setPublished`.
    const [red, green, blue] = label.color.map((channel) => srgbToLinear(channel / 255));
    data.set([red!, green!, blue!, 1], code * 4);
  }
  return data;
}

export function createMapPalette(labels: readonly Label[], atlas: string): DataTexture {
  const palette = new DataTexture(
    mapPaletteData(labels, atlas),
    labels.length,
    1,
    RGBAFormat,
    FloatType,
  );
  palette.needsUpdate = true;
  return palette;
}

function srgbToLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}
