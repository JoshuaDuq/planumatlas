import type { Language, Region } from '../../types/index.ts';
import type { Direction, Side } from './stimulation-responses.ts';

/**
 * F-TRACT's responses to single-pulse stimulation (v2307; `manifest.stimulation_ftract` file):
 * per pair of Julich-Brain 3.0 areas, the probability that stimulating one evoked a response in
 * the other, with the stimulation–recording pairs and implantations it rests on, and where a rate
 * is drawn and enough pairs responded, when the response peaked. A Julich-Brain region takes the
 * F-TRACT area of its name; each hemisphere keeps its own values.
 */

export interface FtractParcel {
  /** F-TRACT's name for the area. */
  name: string;
  hemisphere: 'left' | 'right';
  /** The Julich-Brain region of the same name, and its 3.1 name; null for none. */
  region: string | null;
  area: string | null;
}

/** Stimulated parcel, recorded parcel, pairs tested, implantations, and the probability (null below `min_pairs`). */
export type FtractPair = [number, number, number, number, number | null];

/**
 * Stimulated parcel, recorded parcel, the median peak delay and its median absolute deviation
 * (ms), and the distance between the two areas' centroids in this brain (mm; null within an area
 * or where an end takes no region). Published only for a pair whose rate is drawn.
 */
export type FtractDelayEntry = [number, number, number, number, number | null];

export interface FtractDelay {
  peak: number;
  mad: number;
  distance: number | null;
}

export interface StimulationFtract {
  id: 'stimulation-ftract';
  source: { short: string; citation: string; doi: string; pmid: number; dataset: string };
  implantations: number;
  people: number;
  /** F-TRACT publishes a probability only from this many pairs. */
  min_pairs: number;
  /** A rate is drawn only from pairs recorded in this many implantations. */
  min_implantations: number;
  /** F-TRACT publishes a peak delay only from this many responding pairs. */
  min_responses: number;
  /** Responses later than this many ms after the pulse are not counted, so no delay exceeds it. */
  window_ms: number;
  parcels: FtractParcel[];
  pairs: FtractPair[];
  delays: FtractDelayEntry[];
}

export interface FtractRow {
  parcel: number;
  rate: number;
  tested: number;
  implantations: number;
  delay: FtractDelay | null;
}

export interface FtractRows {
  /** Rates drawn from enough pairs and implantations, highest first. */
  drawn: FtractRow[];
  /** Areas on that side tested too thinly for a rate, and never tested. */
  tooFew: number;
  untested: number;
}

/** The published file, checked against the regions it names. */
export function validateStimulationFtract(
  data: StimulationFtract,
  regions: ReadonlyMap<string, Region>,
): StimulationFtract {
  if (
    data?.id !== 'stimulation-ftract' ||
    !data.source?.doi?.startsWith('https://doi.org/') ||
    !data.source.dataset?.startsWith('https://doi.org/') ||
    !(data.people >= 1 && data.people <= data.implantations) ||
    !(data.min_pairs >= 1) ||
    !(data.min_implantations >= 1) ||
    !(data.min_responses >= 1 && data.min_responses <= data.min_pairs) ||
    !(data.window_ms > 0) ||
    !Array.isArray(data.parcels) ||
    !Array.isArray(data.pairs) ||
    !Array.isArray(data.delays)
  ) {
    throw new Error('Invalid F-TRACT stimulation responses.');
  }
  const named = new Set<string>();
  const taken = new Set<string>();
  for (const parcel of data.parcels) {
    const key = `${parcel.name}|${parcel.hemisphere}`;
    const region = parcel.region === null ? null : regions.get(parcel.region);
    if (
      named.has(key) ||
      (parcel.hemisphere !== 'left' && parcel.hemisphere !== 'right') ||
      (parcel.region !== null &&
        (!region ||
          region.atlas !== 'julich' ||
          region.hemisphere !== parcel.hemisphere ||
          taken.has(parcel.region) ||
          !parcel.area)) ||
      (parcel.region === null && parcel.area !== null)
    ) {
      throw new Error(`Invalid F-TRACT parcel: ${key}`);
    }
    named.add(key);
    if (parcel.region) taken.add(parcel.region);
  }
  const pairs = new Set<string>();
  const drawn = new Set<string>();
  for (const [from, to, tested, implantations, probability] of data.pairs) {
    const key = `${from}|${to}`;
    if (
      pairs.has(key) ||
      !data.parcels[from] ||
      !data.parcels[to] ||
      !(implantations >= 1 && implantations <= Math.min(tested, data.implantations)) ||
      (probability === null) !== tested < data.min_pairs ||
      (probability !== null && !(probability >= 0 && probability <= 1))
    ) {
      throw new Error(`Invalid F-TRACT pair: ${key}`);
    }
    pairs.add(key);
    if (probability !== null && implantations >= data.min_implantations) drawn.add(key);
  }
  const timed = new Set<string>();
  for (const [from, to, peak, mad, distance] of data.delays) {
    const key = `${from}|${to}`;
    const placed = from !== to && !!data.parcels[from]?.region && !!data.parcels[to]?.region;
    if (
      timed.has(key) ||
      !drawn.has(key) ||
      !(peak > 0 && peak <= data.window_ms) ||
      !(mad >= 0 && Number.isFinite(mad)) ||
      (distance === null) === placed ||
      (distance !== null && !(distance > 0 && Number.isFinite(distance)))
    ) {
      throw new Error(`Invalid F-TRACT delay: ${key}`);
    }
    timed.add(key);
  }
  return data;
}

/** The F-TRACT parcel a region takes, or null. */
export function ftractParcelOf(
  data: StimulationFtract | null | undefined,
  regionId: string,
): number | null {
  const index = data?.parcels.findIndex((parcel) => parcel.region === regionId) ?? -1;
  return index < 0 ? null : index;
}

/**
 * The areas on one side stimulated from, or recorded at, `parcel`. A rate is drawn from F-TRACT's
 * probability where the pair was recorded in enough implantations; drawn rows run highest first,
 * the more tested first among equals, each with its peak delay where one is published.
 */
export function ftractRows(
  data: StimulationFtract,
  parcel: number,
  direction: Direction,
  side: Side,
): FtractRows {
  const own = data.parcels[parcel]!.hemisphere;
  const hemisphere = side === 'same' ? own : own === 'left' ? 'right' : 'left';
  const delays = new Map<number, FtractDelay>();
  for (const [from, to, peak, mad, distance] of data.delays) {
    if ((direction === 'from' ? from : to) !== parcel) continue;
    delays.set(direction === 'from' ? to : from, { peak, mad, distance });
  }
  const drawn: FtractRow[] = [];
  let tooFew = 0;
  for (const [from, to, tested, implantations, probability] of data.pairs) {
    if ((direction === 'from' ? from : to) !== parcel) continue;
    const other = direction === 'from' ? to : from;
    if (data.parcels[other]!.hemisphere !== hemisphere) continue;
    if (probability !== null && implantations >= data.min_implantations) {
      const delay = delays.get(other) ?? null;
      drawn.push({ parcel: other, rate: probability, tested, implantations, delay });
    } else {
      tooFew += 1;
    }
  }
  drawn.sort((a, b) => b.rate - a.rate || b.tested - a.tested);
  const areas = data.parcels.filter((candidate) => candidate.hemisphere === hemisphere).length;
  return { drawn, tooFew, untested: areas - drawn.length - tooFew };
}

/** The longest centroid distance of any delay, so every area's plot of delay by distance shares one scale. */
export const ftractFarthest = (data: StimulationFtract): number =>
  data.delays.reduce((farthest, delay) => Math.max(farthest, delay[4] ?? 0), 0);

/** The Julich-Brain 3.1 name a parcel matched, else F-TRACT's; French calls an area "Aire", as the atlas does. */
export const ftractParcelName = (parcel: FtractParcel, lang: Language): string => {
  const name = parcel.area ?? parcel.name;
  return lang === 'fr' ? name.replace(/^Area /, 'Aire ') : name;
};
