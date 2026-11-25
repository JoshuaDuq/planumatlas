import type { CorticalThickness, Region, Rgb } from '../../types/index.ts';
import { THICKNESS_RAMP } from './thickness-ramp.ts';

export { THICKNESS_RAMP };

/** The ramp's colour `share` of the way along it, in sRGB bytes; outside 0–1 it holds its end. */
export function rampColour(share: number): Rgb {
  const at = Math.min(1, Math.max(0, share)) * (THICKNESS_RAMP.length - 1);
  const low = Math.floor(at);
  const high = Math.min(low + 1, THICKNESS_RAMP.length - 1);
  const t = at - low;
  return [0, 1, 2].map((channel) =>
    Math.round(THICKNESS_RAMP[low]![channel]! * (1 - t) + THICKNESS_RAMP[high]![channel]! * t),
  ) as unknown as Rgb;
}

/** The thickness a published byte stands for, in mm; null for the unmeasured. */
export function thicknessOf(code: number, { encoding }: Pick<CorticalThickness, 'encoding'>) {
  return code === encoding.unmeasured ? null : (code / encoding.levels) * encoding.maximum_mm;
}

/** The colour each published byte draws, from 1 to `levels`, over the record's display range. */
export function byteColours(record: Pick<CorticalThickness, 'encoding' | 'display_range_mm'>) {
  const [low, high] = record.display_range_mm;
  return Array.from({ length: record.encoding.levels }, (_, index) =>
    rampColour((thicknessOf(index + 1, record)! - low) / (high - low)),
  );
}

/** Each cortical region's mean thickness and standard deviation, in mm. */
export type RegionThickness = ReadonlyMap<string, { mean: number; sd: number }>;

/** The published regions file, every entry a cortical region of this brain with two finite values. */
export function readRegionThickness(
  value: unknown,
  regions: ReadonlyMap<string, Region>,
): RegionThickness {
  const entries = (value as { regions?: unknown } | null)?.regions;
  if (!entries || typeof entries !== 'object') throw new Error('No region thickness is published.');
  const thickness = new Map<string, { mean: number; sd: number }>();
  for (const [id, pair] of Object.entries(entries)) {
    if (regions.get(id)?.kind !== 'cortex') throw new Error(`${id} is not a cortical region.`);
    if (!Array.isArray(pair) || pair.length !== 2 || !pair.every(Number.isFinite))
      throw new Error(`${id} has no mean and standard deviation.`);
    thickness.set(id, { mean: pair[0] as number, sd: pair[1] as number });
  }
  return thickness;
}
