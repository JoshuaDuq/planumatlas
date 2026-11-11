import type { Paint, Region, Rgb } from '../../types/index.ts';

/**
 * Resting functional connectivity between an atlas's areas (`manifest.functional_connectivity` file):
 * the group mean of 200 HCP young adults' correlations (Domhof et al. 2021), r × 100 for each pair once,
 * the upper triangle row by row in the order of `regions`. Only atlases the dataset parcellates and
 * whose table passed its validation are published (Julich-Brain).
 */
export interface FunctionalConnectivity {
  id: 'functional-connectivity';
  source: { short: string; citation: string; pmid: number; dataset: string; terms: string };
  people: number;
  ages: string;
  /** The paint's steps: a partner from `from` up to the next step takes its colour; below the first, none. */
  r_scale: { from: number; color: Rgb }[];
  atlases: Record<string, { regions: string[]; r: number[] }>;
}

export interface Partner {
  region: string;
  /** The group-mean correlation, -1 to 1. */
  r: number;
}

/** The published file, checked against the regions it names. */
export function validateFunctionalConnectivity(
  data: FunctionalConnectivity,
  regions: ReadonlyMap<string, Region>,
): FunctionalConnectivity {
  const scale = data?.r_scale;
  if (
    data?.id !== 'functional-connectivity' ||
    !data.source?.dataset?.startsWith('https://doi.org/') ||
    !Number.isInteger(data.source.pmid) ||
    !(data.people >= 1) ||
    !Array.isArray(scale) ||
    !scale.length ||
    scale.some((step, index) => !(step.from > (scale[index - 1]?.from ?? 0) && step.from < 1))
  ) {
    throw new Error('Invalid functional connectivity.');
  }
  for (const [atlas, table] of Object.entries(data.atlases)) {
    const n = table.regions.length;
    if (
      new Set(table.regions).size !== n ||
      table.regions.some(
        (id) => regions.get(id)?.atlas !== atlas || regions.get(id)?.kind !== 'cortex',
      ) ||
      table.r.length !== (n * (n - 1)) / 2 ||
      table.r.some((value) => !Number.isInteger(value) || value < -100 || value > 100)
    ) {
      throw new Error(`Invalid functional connectivity on ${atlas}.`);
    }
  }
  return data;
}

/** The atlas whose table holds `regionId`, and its row; null for a region with none. */
function rowOf(data: FunctionalConnectivity | null | undefined, regionId: string) {
  for (const [atlas, table] of Object.entries(data?.atlases ?? {})) {
    const index = table.regions.indexOf(regionId);
    if (index >= 0) return { table: data!.atlases[atlas]!, index };
  }
  return null;
}

/** Whether a region has a row, so its sheet offers the section. */
export const hasConnectivity = (
  data: FunctionalConnectivity | null | undefined,
  regionId: string,
) => rowOf(data, regionId) !== null;

/** Every other area's correlation with `seed`, strongest first; the published order breaks ties. */
export function partnersOf(data: FunctionalConnectivity, seed: string): Partner[] {
  const row = rowOf(data, seed);
  if (!row) throw new Error(`${seed} has no functional connectivity.`);
  const { table, index } = row;
  const n = table.regions.length;
  // Pair (i, j), i < j, sits after the earlier rows' pairs, at j − i − 1 within row i.
  const at = (i: number, j: number) => i * n - (i * (i + 1)) / 2 + (j - i - 1);
  return table.regions
    .map((region, other) => ({ region, other }))
    .filter(({ other }) => other !== index)
    .map(({ region, other }) => ({
      region,
      r: table.r[index < other ? at(index, other) : at(other, index)]! / 100,
    }))
    .sort((a, b) => b.r - a.r);
}

/** The step a correlation falls in, or null below the first. */
export function rStep(data: FunctionalConnectivity, r: number): number | null {
  let step: number | null = null;
  data.r_scale.forEach((entry, index) => {
    if (r >= entry.from) step = index;
  });
  return step;
}

/** The seed's partners in their step's colour; the seed itself is left for its selection outline. */
export function connectivityPaint(data: FunctionalConnectivity, seed: string): Paint {
  const colors = new Map<string, Rgb>();
  for (const { region, r } of partnersOf(data, seed)) {
    const step = rStep(data, r);
    if (step !== null) colors.set(region, data.r_scale[step]!.color);
  }
  return { id: `connectivity:${seed}`, colors };
}
