// Imported by the network matrix dialog alone, a chunk of its own (BUILD-15).
import type { Rgb } from '../../types/index.ts';

/**
 * The network matrix (`manifest.network_matrix` file): the group-mean resting correlation of 200 HCP
 * young adults (Domhof et al. 2021) between Schaefer's 200 parcels, in display order (network by
 * network in `networks`' order, left before right), r × 100 for each pair once, the upper triangle
 * row by row; `blocks` is each pair of networks' Fisher-z mean r, self pairs left out.
 */
export interface NetworkMatrix {
  id: 'network-matrix';
  source: { short: string; citation: string; pmid: number; dataset: string; terms: string };
  people: number;
  ages: string;
  parcellation: { short: string; citation: string; doi: string };
  networks: string[];
  parcels: { network: string; hemisphere: 'left' | 'right'; name: string }[];
  r: number[];
  blocks: number[][];
  /** Per network: its mean within itself exceeds its mean with every other network. */
  within_exceeds: boolean[];
  /** The colour scale's ends: 0, and the pairs' 99th percentile out to the next 0.05. */
  scale: [number, number];
  /** The share of pairs below 0, measured before r was rounded for publishing. */
  negative_share: number;
}

/** A network's run of parcels along either axis. */
export interface NetworkSpan {
  network: string;
  start: number;
  count: number;
}

/**
 * matplotlib's magma, 33 stops of its 256-colour table (`_cm_listed.py`), in sRGB bytes: within
 * 1.25 of 255 of the table everywhere, where 9 stops miss it by 9.5. Dark for none, light for strong.
 */
export const MAGMA: readonly Rgb[] = [
  [0, 0, 4],
  [3, 3, 17],
  [10, 8, 34],
  [19, 13, 51],
  [29, 17, 70],
  [40, 17, 90],
  [54, 16, 106],
  [67, 15, 118],
  [80, 18, 124],
  [93, 23, 127],
  [105, 28, 129],
  [118, 33, 129],
  [130, 38, 129],
  [143, 42, 129],
  [156, 46, 127],
  [169, 50, 125],
  [182, 55, 121],
  [195, 59, 117],
  [207, 65, 112],
  [219, 72, 106],
  [230, 81, 99],
  [238, 92, 94],
  [245, 105, 92],
  [249, 120, 93],
  [251, 135, 97],
  [253, 150, 104],
  [254, 165, 113],
  [254, 180, 123],
  [254, 195, 135],
  [254, 209, 148],
  [253, 224, 162],
  [252, 238, 176],
  [252, 253, 191],
];

/** The published file, checked against the networks this brain names and colours. */
export function readNetworkMatrix(value: unknown, networks: readonly string[]): NetworkMatrix {
  const data = value as NetworkMatrix;
  const n = data?.parcels?.length ?? 0;
  const spans = n ? networkSpans(data) : [];
  if (
    data?.id !== 'network-matrix' ||
    !data.source?.dataset?.startsWith('https://doi.org/') ||
    !data.parcellation?.doi?.startsWith('https://doi.org/') ||
    data.networks?.join() !== networks.join() ||
    spans.map((span) => span.network).join() !== networks.join() ||
    data.parcels.some((parcel) => !['left', 'right'].includes(parcel.hemisphere) || !parcel.name) ||
    data.r?.length !== (n * (n - 1)) / 2 ||
    data.r.some((r) => !Number.isInteger(r) || r < -100 || r > 100) ||
    data.blocks?.length !== networks.length ||
    data.blocks.some((row) => row.length !== networks.length || !row.every(Number.isFinite)) ||
    data.within_exceeds?.length !== networks.length ||
    data.scale?.[0] !== 0 ||
    !(data.scale[1] > 0 && data.scale[1] <= 1) ||
    !(data.negative_share >= 0 && data.negative_share < 1)
  ) {
    throw new Error('Invalid network matrix.');
  }
  return data;
}

/** Each network's run of parcels; a network met twice (its parcels apart) is two runs. */
export function networkSpans(matrix: Pick<NetworkMatrix, 'parcels'>): NetworkSpan[] {
  const spans: NetworkSpan[] = [];
  matrix.parcels.forEach(({ network }, index) => {
    const last = spans.at(-1);
    if (last?.network === network) last.count += 1;
    else spans.push({ network, start: index, count: 1 });
  });
  return spans;
}

/** The correlation between parcels `i` and `j`; null on the diagonal, which the matrix leaves empty. */
export function pairR(matrix: Pick<NetworkMatrix, 'parcels' | 'r'>, i: number, j: number) {
  if (i === j) return null;
  const [a, b] = i < j ? [i, j] : [j, i];
  const n = matrix.parcels.length;
  // Pair (a, b), a < b, sits after the earlier rows' pairs, at b − a − 1 within row a.
  return matrix.r[a * n - (a * (a + 1)) / 2 + (b - a - 1)]! / 100;
}

/** The ramp's colour `share` of the way along it, in sRGB bytes; outside 0–1 it holds its end. */
export function magmaAt(share: number): Rgb {
  const at = Math.min(1, Math.max(0, share)) * (MAGMA.length - 1);
  const low = Math.min(Math.floor(at), MAGMA.length - 2);
  const t = at - low;
  return [0, 1, 2].map((channel) =>
    Math.round(MAGMA[low]![channel]! * (1 - t) + MAGMA[low + 1]![channel]! * t),
  ) as unknown as Rgb;
}

/** A correlation's colour over the matrix's scale; a negative one takes the scale's floor. */
export const cellColour = (matrix: Pick<NetworkMatrix, 'scale'>, r: number) =>
  magmaAt((r - matrix.scale[0]) / (matrix.scale[1] - matrix.scale[0]));
