import { decimal } from '../format.ts';
import type { Language, Rgb } from '../../types/index.ts';

/** sRGB ends of each sign's scale, threshold first: FSL's Red-Yellow and Blue-Lightblue. */
export const POSITIVE_RAMP = [
  [1, 0, 0],
  [1, 1, 0],
] as const;
export const NEGATIVE_RAMP = [
  [0, 0, 1],
  [0, 1, 1],
] as const;

/** How a map is drawn: values whose magnitude exceeds `threshold`, coloured up to `max`, over the grey. */
export interface MapDisplay {
  threshold: number;
  max: number;
  /** 1 draws the map's colours as the key gives them; less lets the tissue show through. */
  opacity: number;
}

/** The native surfaces the cortex can be drawn on, all this brain's own, one vertex each. */
export const CORTEX_SURFACES = ['pial', 'mid', 'white'] as const;
export type CortexSurface = (typeof CORTEX_SURFACES)[number];

/** The statistics a key can name its values by. */
export const STATISTICS = ['z', 't', 'F', 'r'] as const;
export type Statistic = (typeof STATISTICS)[number];

/** NIFTI_INTENT_CORREL, _TTEST, _FTEST and _ZSCORE. */
const INTENTS: Readonly<Record<number, Statistic>> = { 2: 'r', 3: 't', 4: 'F', 5: 'z' };
const SPM_STATISTICS: Readonly<Record<string, Statistic>> = { T: 't', F: 'F', Z: 'z' };

/**
 * The statistic a file says it holds: its intent code, else SPM's `SPM{T_[df]}` description, else
 * FSL's and SPM's own output names (zstat1, tstat1, zfstat1, fstat1, spmT_0001, spmF_0001).
 */
export function fileStatistic(intent: number, description: string, name: string): Statistic | null {
  const spm = /^SPM\{([TFZ])/.exec(description)?.[1];
  if (INTENTS[intent]) return INTENTS[intent];
  if (spm) return SPM_STATISTICS[spm]!;
  const output = /^(zf?stat|tstat|fstat|spmT_|spmF_)\d/.exec(name)?.[1];
  if (!output) return null;
  return output.startsWith('z') ? 'z' : output.startsWith('t') || output === 'spmT_' ? 't' : 'F';
}

/** A file's name without its NIfTI extension: the map's title until the reader gives another. */
export function mapTitle(name: string): string {
  return name.replace(/\.nii(\.gz)?$/i, '');
}

/** A series plays at most this many volumes a second, slower when a volume takes longer to carry. */
export const VOLUMES_PER_SECOND = 4;

/** What the reader is told about a map once it is carried onto this brain. */
export interface MapSummary {
  shape: [number, number, number];
  /** Voxel edge lengths in template millimetres. */
  voxelMm: [number, number, number];
  /** The smallest and largest finite values in the file. */
  range: [number, number];
  /** Every finite value is 0 or 1: a mask, read at 0.5 as its edge. */
  binary: boolean;
  /** What the header says the values are, when it says. */
  intent: number;
  description: string;
  /** 1 for a single map; a series' volumes along its fourth axis. */
  volumes: number;
  /** A series' spacing in seconds, when its header gives one. */
  secondsPerVolume: number | null;
  /** Share of this brain's cortical vertices the map reaches (in any volume, for a series). */
  cortexCovered: number;
}

/** A display is drawable with a threshold of zero or more below a finite top, and an opacity in (0, 1]. */
export function validDisplay({ threshold, max, opacity }: MapDisplay): boolean {
  return (
    Number.isFinite(threshold) &&
    Number.isFinite(max) &&
    threshold >= 0 &&
    max > threshold &&
    opacity > 0 &&
    opacity <= 1
  );
}

/** Significant digits a map's numbers are shown and its default scale is rounded to. */
const DIGITS = 3;

/** A map value as the reader reads and types it: three significant digits, trailing zeros dropped. */
export function mapNumber(value: number, lang: Language): string {
  const digits =
    value === 0 ? 0 : Math.max(0, DIGITS - 1 - Math.floor(Math.log10(Math.abs(value))));
  return decimal(value, digits, lang, { trim: true });
}

/**
 * A statistical map has no threshold until the reader gives one: which is right is their analysis's
 * call, and drawing every value but zero shows mostly noise. The scale runs to the largest magnitude,
 * rounded up to three significant digits so the key's number is the scale's. A mask is thresholded
 * at 0.5, where interpolation puts its edge, as the stroke lesions are.
 */
export function defaultDisplay({ range, binary }: MapSummary): MapDisplay {
  if (binary) return { threshold: 0.5, max: 1, opacity: 1 };
  const largest = Math.max(Math.abs(range[0]), Math.abs(range[1]));
  const step = 10 ** (Math.floor(Math.log10(largest)) - (DIGITS - 1));
  const max = Number((Math.ceil(largest / step) * step).toPrecision(DIGITS));
  return { threshold: Number.NaN, max, opacity: 1 };
}

/**
 * The map drawn against a painted function: its positive values beyond the threshold in `map`, or in
 * `both` where the paint is. Negative values are not activation, so they are not drawn.
 */
export interface MapOverlap {
  map: Rgb;
  both: Rgb;
}

/** A value's sRGB colour, or null where it is not drawn (NaN, or not beyond the threshold). */
export function mapColour(
  value: number,
  { threshold, max }: Pick<MapDisplay, 'threshold' | 'max'>,
  overlap: { colours: MapOverlap; painted: boolean } | null = null,
): [number, number, number] | null {
  if (overlap) {
    if (!(value > threshold)) return null;
    const rgb = overlap.painted ? overlap.colours.both : overlap.colours.map;
    return rgb.map((c) => c / 255) as [number, number, number];
  }
  const magnitude = Math.abs(value);
  if (!(magnitude > threshold)) return null;
  const share = Math.min(1, (magnitude - threshold) / (max - threshold));
  const [low, high] = value > 0 ? POSITIVE_RAMP : NEGATIVE_RAMP;
  return [0, 1, 2].map((c) => low[c] + share * (high[c] - low[c])) as [number, number, number];
}
