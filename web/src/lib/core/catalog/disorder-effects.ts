import type { Language, Paint, Region, Rgb } from '../../types/index.ts';

/** The atlas ENIGMA reports cortical thickness on: a disorder's cortex is painted only there. */
export const DISORDER_ATLAS = 'desikan';

export type DisorderMeasure = 'thickness' | 'volume';

/**
 * Case–control differences from the ENIGMA working groups (`manifest.disorder_effects` file): per
 * disorder, Cohen's d (patients minus controls) for each Desikan-Killiany region's cortical thickness
 * and each aseg structure's volume, published only where its table's false discovery rate is met.
 */
export interface DisorderEffects {
  id: 'disorder-effects';
  source: { short: string; citation: string; pmid: number; repository: string; commit: string };
  false_discovery_rate: number;
  /** Below `split` a difference takes the paler colour of its direction, from it the darker. */
  d_scale: { split: number; smaller: [Rgb, Rgb]; larger: [Rgb, Rgb] };
  /** Every region some table reports, significant or not. */
  regions: string[];
  disorders: Disorder[];
}

export interface Disorder {
  id: string;
  name: Record<Language, string>;
  measures: Record<
    DisorderMeasure,
    {
      pmid: number;
      patients: number | null;
      controls: number | null;
      tested: number;
      population?: Record<Language, string>;
    }
  >;
  /** Region id to d, significant differences only. */
  effects: Record<string, number>;
}

export interface DisorderEffect {
  disorder: Disorder;
  d: number;
  measure: DisorderMeasure;
}

/** The published file, checked against the regions it names. */
export function validateDisorderEffects(
  data: DisorderEffects,
  regions: ReadonlyMap<string, Region>,
): DisorderEffects {
  const scale = data?.d_scale;
  const reported = (id: string) => {
    const region = regions.get(id);
    return (
      (region?.atlas === DISORDER_ATLAS && region.kind === 'cortex') ||
      (region?.atlas === 'aseg' && region.kind === 'structure')
    );
  };
  if (
    data?.id !== 'disorder-effects' ||
    !Number.isInteger(data.source?.pmid) ||
    !(data.false_discovery_rate > 0 && data.false_discovery_rate < 1) ||
    !(scale?.split > 0 && scale.split < 1) ||
    scale.smaller?.length !== 2 ||
    scale.larger?.length !== 2 ||
    !data.disorders?.length ||
    !data.regions.every(reported)
  ) {
    throw new Error('Invalid disorder effects.');
  }
  const listed = new Set(data.regions);
  for (const disorder of data.disorders) {
    for (const [id, d] of Object.entries(disorder.effects)) {
      if (!listed.has(id) || !Number.isFinite(d) || d === 0) {
        throw new Error(`Invalid disorder effect of ${disorder.id} on ${id}.`);
      }
    }
  }
  return data;
}

/** A difference's colour: its direction's paler step below the split, the darker from it. */
export function dColor(data: DisorderEffects, d: number): Rgb {
  const side = d < 0 ? data.d_scale.smaller : data.d_scale.larger;
  return side[Math.abs(d) < data.d_scale.split ? 0 : 1]!;
}

/**
 * The region the tables report for `regionId`: itself, or the aseg structure a teaching-set unit
 * stands in for (`units`, neuropsych-domains.json); null where no table reports it.
 */
export function reportedRegion(
  data: DisorderEffects | null | undefined,
  regionId: string,
  units: Readonly<Record<string, string>>,
): string | null {
  const id = units[regionId] ?? regionId;
  return data?.regions.includes(id) ? id : null;
}

/** Every disorder's significant difference in a reported region, largest first; the published order breaks ties. */
export function effectsOf(data: DisorderEffects, reported: string): DisorderEffect[] {
  const measure: DisorderMeasure = reported.startsWith(`${DISORDER_ATLAS}:`)
    ? 'thickness'
    : 'volume';
  return data.disorders
    .filter((disorder) => reported in disorder.effects)
    .map((disorder) => ({ disorder, d: disorder.effects[reported]!, measure }))
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
}

/** One disorder's differences in their colours; a structure's teaching-set stand-ins take its colour. */
export function disorderPaint(
  data: DisorderEffects,
  id: string,
  standIns: (region: string) => readonly string[],
): Paint {
  const disorder = data.disorders.find((entry) => entry.id === id);
  if (!disorder) throw new Error(`Unknown disorder: ${id}`);
  const colors = new Map<string, Rgb>();
  for (const [region, d] of Object.entries(disorder.effects)) {
    const color = dColor(data, d);
    colors.set(region, color);
    for (const standIn of standIns(region)) colors.set(standIn, color);
  }
  return { id: `disorder:${id}`, colors };
}
