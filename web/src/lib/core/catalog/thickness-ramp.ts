// The stage key draws the thickness ramp before anything else of the thickness has loaded.
import type { Rgb } from '../../types/index.ts';

/**
 * matplotlib's viridis from 0.2 to 1, nine even stops: lightness rises from L* 32 to 91, so the thinnest
 * cortex stays legible on the dark stage, where viridis's own near-black start would sink.
 */
export const THICKNESS_RAMP: readonly Rgb[] = [
  [65, 68, 135],
  [52, 95, 141],
  [42, 120, 142],
  [33, 144, 140],
  [34, 168, 132],
  [67, 191, 113],
  [122, 209, 81],
  [188, 223, 39],
  [253, 231, 37],
];
