import type { Region } from '../../types/index.ts';

/**
 * Real stroke lesions with each person's language score: the Aphasia Recovery Cohort (Gibson et al.
 * 2024; `manifest.stroke_cases` file), 228 people with chronic left-hemisphere stroke. Each lesion
 * was carried onto this brain; a region's share is the share of its cut voxels the lesion covers.
 */

export type WabType =
  | 'Global'
  | 'Broca'
  | 'TranscorticalMotor'
  | 'Wernicke'
  | 'Conduction'
  | 'Anomic'
  | 'None';

export interface StrokeCase {
  id: string;
  /** WAB-R aphasia quotient, 0–100. */
  aq: number;
  /** Null where the cohort did not record it. */
  type: WabType | null;
  /** Days after the stroke of the scan the lesion was drawn on, and of the WAB. */
  scan_day: number;
  test_day: number;
  /** The authors' lesion volume on SPM12's grid. */
  volume_cm3: number;
  /** Share of each region's cut voxels the lesion covers, from 1%. */
  regions: Readonly<Record<string, number>>;
  /** Where its runs sit in the masks buffer, in uint32 values. */
  runs: readonly [number, number];
}

export interface AqBand {
  id: 'very-severe' | 'severe' | 'moderate' | 'mild' | 'within-normal-limits';
  min: number;
}

export interface StrokeCases {
  id: 'stroke_cases';
  source: { short: string; citation: string; doi: string; pmid: number; dataset: string };
  reaches_min: number;
  test_windows: readonly number[];
  pairs: { volume_ratio_max: number; aq_difference_min: number };
  aq_bands: readonly AqBand[];
  exceptions: { share_min: number; aq_min: number; shown: number };
  masks: {
    file: string;
    sha256: string;
    shape: readonly [number, number, number];
    order: 'F';
    voxel_to_surface_ras_mm: readonly (readonly number[])[];
  };
  cases: readonly StrokeCase[];
}

const TYPES = new Set(['Global', 'Broca', 'TranscorticalMotor', 'Wernicke', 'Conduction', 'Anomic', 'None']);

/** The published cohort, checked against itself and against the regions it names. */
export function validateStrokeCases(
  data: StrokeCases,
  regions: ReadonlyMap<string, Region>,
): StrokeCases {
  if (
    data?.id !== 'stroke_cases' ||
    !data.source?.doi?.startsWith('https://doi.org/') ||
    !(data.reaches_min > 0 && data.reaches_min < 1) ||
    !data.test_windows?.length ||
    !(data.pairs?.volume_ratio_max >= 1) ||
    data.aq_bands?.[0]?.min !== 0 ||
    data.masks?.order !== 'F' ||
    data.masks.shape?.length !== 3 ||
    !Array.isArray(data.cases)
  ) {
    throw new Error('Invalid stroke cases.');
  }
  const ids = new Set<string>();
  let end = 0;
  for (const entry of data.cases) {
    if (
      ids.has(entry.id) ||
      !(entry.aq >= 0 && entry.aq <= 100) ||
      !(entry.type === null || TYPES.has(entry.type)) ||
      !(entry.volume_cm3 > 0) ||
      entry.runs[0] !== end ||
      entry.runs[1] % 2 !== 0
    ) {
      throw new Error(`Invalid stroke case ${entry.id}.`);
    }
    for (const [region, share] of Object.entries(entry.regions) as [string, number][]) {
      if (!regions.has(region) || !(share > 0 && share <= 1)) {
        throw new Error(`Stroke case ${entry.id} names ${region} with share ${share}.`);
      }
    }
    ids.add(entry.id);
    end += entry.runs[1];
  }
  return data;
}

export const gapDays = (entry: StrokeCase) => Math.abs(entry.test_day - entry.scan_day);

export const shareOf = (entry: StrokeCase, region: string) => entry.regions[region] ?? 0;

/** The cases whose lesion reaches the region, tested within `maxGap` days of their scan. */
export function reaching(data: StrokeCases, region: string, maxGap: number): StrokeCase[] {
  return data.cases.filter(
    (entry) => shareOf(entry, region) >= data.reaches_min && gapDays(entry) <= maxGap,
  );
}

/**
 * Lesions of a similar volume whose scores differ widely, lower score first. Widest gap first, and
 * each person appears in one pair only, so stepping through them does not keep showing one case.
 */
export function discordantPairs(data: StrokeCases, cases: readonly StrokeCase[]) {
  const { volume_ratio_max, aq_difference_min } = data.pairs;
  const pairs: [StrokeCase, StrokeCase][] = [];
  for (let i = 0; i < cases.length; i++) {
    for (let j = i + 1; j < cases.length; j++) {
      const [p, q] = [cases[i]!, cases[j]!];
      const ratio = Math.max(p.volume_cm3, q.volume_cm3) / Math.min(p.volume_cm3, q.volume_cm3);
      if (ratio <= volume_ratio_max && Math.abs(p.aq - q.aq) >= aq_difference_min) {
        pairs.push(p.aq <= q.aq ? [p, q] : [q, p]);
      }
    }
  }
  pairs.sort(
    (x, y) => y[1].aq - y[0].aq - (x[1].aq - x[0].aq) || x[0].id.localeCompare(y[0].id),
  );
  const seen = new Set<string>();
  return pairs.filter(([p, q]) => {
    if (seen.has(p.id) || seen.has(q.id)) return false;
    seen.add(p.id).add(q.id);
    return true;
  });
}

/** Much of the region lesioned and a mild aphasia or none: the highest scores first. */
export function exceptions(data: StrokeCases, cases: readonly StrokeCase[], region: string) {
  const { share_min, aq_min, shown } = data.exceptions;
  return cases
    .filter((entry) => shareOf(entry, region) >= share_min && entry.aq >= aq_min)
    .sort((p, q) => q.aq - p.aq || shareOf(q, region) - shareOf(p, region))
    .slice(0, shown);
}

export function band(data: StrokeCases, aq: number): AqBand['id'] {
  return data.aq_bands.findLast((entry) => aq >= entry.min)!.id;
}

/**
 * Where two lesions differ: the selected region first, then the regions of its own atlas and the deep
 * structures either lesion reaches, by how far their shares differ.
 */
export function differences(
  data: StrokeCases,
  a: StrokeCase,
  b: StrokeCase,
  region: string,
  limit: number,
) {
  const atlas = region.slice(0, region.indexOf(':'));
  const row = (id: string) => ({ id, a: shareOf(a, id), b: shareOf(b, id) });
  const others = [...new Set([...Object.keys(a.regions), ...Object.keys(b.regions)])]
    .filter((id) => id !== region && (id.startsWith(`${atlas}:`) || id.startsWith('aseg:')))
    .map(row)
    .filter((entry) => Math.max(entry.a, entry.b) >= data.reaches_min)
    .sort((p, q) => Math.abs(q.a - q.b) - Math.abs(p.a - p.b) || p.id.localeCompare(q.id));
  return [row(region), ...others.slice(0, limit - 1)];
}
