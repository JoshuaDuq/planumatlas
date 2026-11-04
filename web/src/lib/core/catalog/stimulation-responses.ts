import type { Language, Region } from '../../types/index.ts';

/**
 * Responses to single-pulse electrical stimulation recorded with stereo-EEG in 27 people
 * with epilepsy (Lyu et al. 2025; `manifest.stimulation_responses` file): channel pairs
 * counted by the authors' anatomical labels and by side. A region takes a label from the
 * cortical channels landing in it, or by name; nothing is measured in the anatomy shown.
 */

export type Side = 'same' | 'opposite';
/** `from`: stimulated at the label, recorded elsewhere; `to`: recorded at the label. */
export type Direction = 'from' | 'to';

export interface StimulationLabel {
  id: string;
  name: string;
  name_fr: string;
  /** A thalamic site's name in the choice between sites. */
  short?: string;
  short_fr?: string;
}

export interface StimulationPair {
  from: string;
  to: string;
  side: Side;
  tested: number;
  responded: number;
  /** People in whom this pair of labels was tested. */
  subjects: number;
}

/** A region's labels: one, or the thalamus's three positional sites. */
export type RegionLabels =
  | { labels: string[]; basis: 'name' }
  | { labels: [string]; basis: 'contacts'; channels: number; subjects: number; share: number };

export interface StimulationResponses {
  id: 'stimulation-responses';
  source: { short: string; citation: string; doi: string; pmid: number; dataset: string };
  subjects: number;
  excluded: number;
  /** A rate is drawn only from pairs tested in this many people. */
  min_subjects: number;
  labels: StimulationLabel[];
  pairs: StimulationPair[];
  regions: Record<string, RegionLabels>;
}

export interface ResponseRow {
  label: StimulationLabel;
  pair: StimulationPair;
  rate: number;
  /** Tested in enough people for its rate to be drawn. */
  drawn: boolean;
}

/** The published counts, checked against the labels and regions they name. */
export function validateStimulationResponses(
  data: StimulationResponses,
  regions: ReadonlyMap<string, Region>,
): StimulationResponses {
  if (
    data?.id !== 'stimulation-responses' ||
    !data.source?.doi?.startsWith('https://doi.org/') ||
    !data.source.dataset?.startsWith('https://doi.org/') ||
    !(data.subjects > 0) ||
    !(data.min_subjects >= 1) ||
    !Array.isArray(data.labels) ||
    !Array.isArray(data.pairs) ||
    !data.regions
  ) {
    throw new Error('Invalid stimulation responses.');
  }
  const labels = new Set(data.labels.map((label) => label.id));
  if (labels.size !== data.labels.length || data.labels.some((l) => !l.name || !l.name_fr)) {
    throw new Error('Invalid stimulation-response labels.');
  }
  const pairs = new Set<string>();
  for (const pair of data.pairs) {
    const key = `${pair.from}|${pair.to}|${pair.side}`;
    if (
      pairs.has(key) ||
      !labels.has(pair.from) ||
      !labels.has(pair.to) ||
      (pair.side !== 'same' && pair.side !== 'opposite') ||
      !(pair.tested >= 1) ||
      !(pair.responded >= 0 && pair.responded <= pair.tested) ||
      !(pair.subjects >= 1 && pair.subjects <= data.subjects)
    ) {
      throw new Error(`Invalid stimulation-response pair: ${key}`);
    }
    pairs.add(key);
  }
  for (const [id, entry] of Object.entries(data.regions)) {
    if (
      !regions.has(id) ||
      !entry.labels.length ||
      entry.labels.some((label) => !labels.has(label)) ||
      (entry.basis === 'contacts' &&
        (entry.labels.length !== 1 || !(entry.share > 0.5 && entry.share <= 1))) ||
      (entry.basis !== 'contacts' && entry.basis !== 'name')
    ) {
      throw new Error(`Invalid stimulation-response assignment: ${id}`);
    }
  }
  return data;
}

export function labelsOf(
  data: StimulationResponses | null | undefined,
  regionId: string,
): RegionLabels | null {
  return data?.regions[regionId] ?? null;
}

export const labelById = (data: StimulationResponses, id: string): StimulationLabel =>
  data.labels.find((label) => label.id === id)!;

/**
 * The other end of every tested pair from or to `label` on one side. Rates drawn from enough
 * people come first, highest first; the rest follow by how often they were tested.
 */
export function responseRows(
  data: StimulationResponses,
  label: string,
  direction: Direction,
  side: Side,
): ResponseRow[] {
  return data.pairs
    .filter((pair) => pair.side === side && (direction === 'from' ? pair.from : pair.to) === label)
    .map((pair) => ({
      label: labelById(data, direction === 'from' ? pair.to : pair.from),
      pair,
      rate: pair.responded / pair.tested,
      drawn: pair.subjects >= data.min_subjects,
    }))
    .sort(
      (a, b) =>
        Number(b.drawn) - Number(a.drawn) ||
        (a.drawn ? b.rate - a.rate : 0) ||
        b.pair.tested - a.pair.tested,
    );
}

/** Labels never tested with `label` in this direction and side, in display order. */
export function untested(
  data: StimulationResponses,
  label: string,
  direction: Direction,
  side: Side,
): StimulationLabel[] {
  const tested = new Set(responseRows(data, label, direction, side).map((row) => row.label.id));
  return data.labels.filter((candidate) => !tested.has(candidate.id));
}

export const stimulationLabelName = (label: StimulationLabel, lang: Language): string =>
  lang === 'fr' ? label.name_fr : label.name;

export const stimulationLabelShort = (label: StimulationLabel, lang: Language): string =>
  (lang === 'fr' ? label.short_fr : label.short) ?? stimulationLabelName(label, lang);
