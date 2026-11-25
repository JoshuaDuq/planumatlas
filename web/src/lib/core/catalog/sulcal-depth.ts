import type { Rgb } from '../../types/index.ts';

/**
 * Moreland's cool–warm diverging map, its 33 control points as matplotlib tabulates them
 * (`_cm.py`, `_coolwarm_data`), in sRGB bytes: blue below zero (gyral crowns), red above (sulci).
 */
export const SULC_RAMP: readonly Rgb[] = [
  [59, 76, 192],
  [68, 90, 204],
  [77, 104, 215],
  [87, 117, 225],
  [98, 130, 234],
  [108, 142, 241],
  [119, 154, 247],
  [130, 165, 251],
  [141, 176, 254],
  [152, 185, 255],
  [163, 194, 255],
  [174, 201, 253],
  [184, 208, 249],
  [194, 213, 244],
  [204, 217, 238],
  [213, 219, 230],
  [221, 221, 221],
  [229, 216, 209],
  [236, 211, 197],
  [241, 204, 185],
  [245, 196, 173],
  [247, 187, 160],
  [247, 177, 148],
  [247, 166, 135],
  [244, 154, 123],
  [241, 141, 111],
  [236, 127, 99],
  [229, 112, 88],
  [222, 96, 77],
  [213, 80, 66],
  [203, 62, 56],
  [192, 40, 47],
  [180, 4, 38],
];

/**
 * The key's half-width in mm, centred on 0 (each hemisphere's mean): the published depths' larger
 * end, out to the whole millimetre, so no vertex lies beyond it. Null for a file without the span.
 */
export function sulcExtent(
  ranges: Readonly<Record<string, readonly [number, number]>> | undefined,
): number | null {
  const span = ranges?.['_SULC'];
  return span ? Math.ceil(Math.max(-span[0], span[1])) : null;
}
