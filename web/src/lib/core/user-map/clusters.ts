import type { NiftiVolume } from './nifti.ts';

/** A voxel centre in world millimetres and the map's value there. */
export interface Peak {
  mm: [number, number, number];
  value: number;
}

/** A cluster of nilearn's table: its peak, its sub-peaks and its size. */
export interface Cluster {
  /** From 1 within its sign, in nilearn's order: nilearn numbers the negative clusters from 1 again. */
  id: number;
  sign: 1 | -1;
  voxels: number;
  /** Voxels times the voxel volume, truncated to a whole mm³ as nilearn's table gives it. */
  sizeMm3: number;
  /** The cluster's peak first, then its sub-peaks as nilearn reports them. */
  peaks: Peak[];
}

/** nilearn's table gives a cluster's peak and at most three sub-peaks. */
const PEAKS_PER_CLUSTER = 4;

type Shape = readonly [number, number, number];

/** A voxel's or a region's place in scipy's `label` numbering: C order, the last index fastest. */
type Order = (i: number, j: number, k: number) => number;

/**
 * The clusters of a map beyond ±threshold and their peaks, as nilearn 0.12.1's
 * `get_clusters_table(img, threshold, two_sided=True, min_distance=minDistanceMm)`:
 *
 * - a voxel joins a cluster when its value times the sign is strictly above the threshold, compared in
 *   float32 as numpy compares a float32 map; NaN joins none;
 * - clusters are face-connected; positive clusters come first, each sign by its most extreme value;
 * - peaks are the cluster's own local maxima over 26 neighbours, a face-connected plateau counting once,
 *   at its centre voxel (half voxels rounded to even), or its voxel nearest that centre when the centre
 *   falls outside it; a voxel whose neighbours all share its value is no peak unless the whole cluster is
 *   constant (`np.isclose`);
 * - peaks run from the most extreme, each kept when farther than `minDistanceMm` from the last one kept;
 * - with `cluster_threshold=minVoxels`, a cluster of fewer voxels is left out before the clusters are ranked.
 *
 * Exact ties between peaks or between clusters keep scipy's label order. numpy's argsort keeps that
 * order for up to 16 entries; beyond that its quicksort breaks ties in no defined order.
 */
export function clusterTable(
  { shape, voxelToWorld, data }: NiftiVolume,
  threshold: number,
  minDistanceMm = 8,
  minVoxels = 0,
): Cluster[] {
  checkThreshold(threshold, minVoxels);
  const [nx, ny, nz] = shape;
  const nxy = nx * ny;
  const count = nxy * nz;
  const [r0, r1, r2] = [voxelToWorld[0]!, voxelToWorld[1]!, voxelToWorld[2]!];
  const world = (n: number): [number, number, number] => {
    const [i, j, k] = indices(n, shape);
    return [
      r0[0]! * i + r0[1]! * j + r0[2]! * k + r0[3]!,
      r1[0]! * i + r1[1]! * j + r1[2]! * k + r1[3]!,
      r2[0]! * i + r2[1]! * j + r2[2]! * k + r2[3]!,
    ];
  };
  const order: Order = (i, j, k) => (i * ny + j) * nz + k;

  // nilearn multiplies the header's float32 zooms; nibabel writes them as the affine's column lengths.
  const zoom = (c: number) =>
    Math.fround(Math.sqrt(r0[c]! * r0[c]! + r1[c]! * r1[c]! + r2[c]! * r2[c]!));
  const voxelVolume = Math.fround(Math.fround(zoom(0) * zoom(1)) * zoom(2));
  const cutoff = Math.fround(threshold);

  const labels = new Int32Array(count);
  const members = new Int32Array(count);
  const marks = new Int8Array(count);
  const table: Cluster[] = [];

  for (const sign of [1, -1] as const) {
    labels.fill(0);
    for (let n = 0; n < count; n++) if (sign * data[n]! > cutoff) labels[n] = -1;
    const starts = [0];
    for (let seed = 0; seed < count; seed++) {
      if (labels[seed] === -1) {
        starts.push(flood(labels, starts.length, seed, members, starts.at(-1)!, shape));
      }
    }

    const clusters = starts.slice(1).map((end, c) => {
      const start = starts[c]!;
      let top = -Infinity,
        bottom = Infinity,
        first = Infinity;
      for (let p = start; p < end; p++) {
        const n = members[p]!;
        const value = sign * data[n]!;
        top = Math.max(top, value);
        bottom = Math.min(bottom, value);
        first = Math.min(first, order(...indices(n, shape)));
      }
      return { id: c + 1, start, end, top, bottom, first };
    });
    const sized = clusters.filter(({ start, end }) => end - start >= minVoxels);
    sized.sort((a, b) => b.top - a.top || a.first - b.first);

    for (const [rank, { id, start, end, top, bottom }] of sized.entries()) {
      // np.isclose(max, min) on float32 values, so in float32.
      const f = Math.fround;
      const constant = top === bottom || f(top - bottom) <= f(f(1e-8) + f(f(1e-5) * bottom));

      const candidates: number[] = [];
      for (let p = start; p < end; p++) {
        const n = members[p]!;
        const value = sign * data[n]!;
        const [i, j, k] = indices(n, shape);
        let highest = true;
        let flat = true;
        window: for (let dk = k > 0 ? -1 : 0; dk <= (k < nz - 1 ? 1 : 0); dk++) {
          for (let dj = j > 0 ? -1 : 0; dj <= (j < ny - 1 ? 1 : 0); dj++) {
            for (let di = i > 0 ? -1 : 0; di <= (i < nx - 1 ? 1 : 0); di++) {
              const m = n + di + nx * dj + nxy * dk;
              const neighbour = labels[m] === id ? sign * data[m]! : 0;
              if (neighbour > value) {
                highest = false;
                break window;
              }
              if (neighbour !== value) flat = false;
            }
          }
        }
        if (highest && (constant || !flat)) {
          candidates.push(n);
          marks[n] = -1;
        }
      }

      const plateaus = new Int32Array(candidates.length);
      const peaks: { voxel: number; value: number; first: number }[] = [];
      let tail = 0;
      for (const seed of candidates) {
        if (marks[seed] !== -1) continue;
        const from = tail;
        tail = flood(marks, 1, seed, plateaus, from, shape);
        const voxel = plateauVoxel(plateaus.subarray(from, tail), shape, order);
        let first = Infinity;
        for (const n of plateaus.subarray(from, tail))
          first = Math.min(first, order(...indices(n, shape)));
        peaks.push({ voxel, value: sign * data[voxel]!, first });
      }
      peaks.sort((a, b) => b.value - a.value || a.first - b.first);

      // nilearn's _pare_subpeaks measures each peak from the last one kept, not from every one kept.
      const kept = [world(peaks[0]!.voxel)];
      const reported = [peaks[0]!.voxel];
      for (let p = 1; p < peaks.length && reported.length < PEAKS_PER_CLUSTER; p++) {
        const at = world(peaks[p]!.voxel);
        const [x, y, z] = kept.at(-1)!;
        if (Math.sqrt((at[0] - x) ** 2 + (at[1] - y) ** 2 + (at[2] - z) ** 2) > minDistanceMm) {
          kept.push(at);
          reported.push(peaks[p]!.voxel);
        }
      }

      const voxels = end - start;
      table.push({
        id: rank + 1,
        sign,
        voxels,
        sizeMm3: Math.trunc(voxels * voxelVolume),
        peaks: reported.map((voxel, p) => ({ mm: kept[p]!, value: data[voxel]! })),
      });
    }
  }
  return table;
}

/**
 * The map with every voxel of a cluster smaller than `minVoxels` set to 0, as nilearn's
 * `threshold_img(img, threshold, cluster_threshold=minVoxels, two_sided=True)` removes them; every
 * other voxel, beneath the threshold too, is kept as it was, so the map still interpolates as before.
 */
export function withoutSmallClusters(
  { shape, data }: Pick<NiftiVolume, 'shape' | 'data'>,
  threshold: number,
  minVoxels: number,
): Float32Array {
  checkThreshold(threshold, minVoxels);
  const out = data.slice();
  if (minVoxels <= 1) return out;
  const count = shape[0] * shape[1] * shape[2];
  const labels = new Int32Array(count);
  const members = new Int32Array(count);
  const cutoff = Math.fround(threshold);
  for (const sign of [1, -1] as const) {
    labels.fill(0);
    for (let n = 0; n < count; n++) if (sign * data[n]! > cutoff) labels[n] = -1;
    let tail = 0;
    for (let seed = 0; seed < count; seed++) {
      if (labels[seed] !== -1) continue;
      const end = flood(labels, 1, seed, members, tail, shape);
      if (end - tail < minVoxels) for (let p = tail; p < end; p++) out[members[p]!] = 0;
      tail = end;
    }
  }
  return out;
}

function checkThreshold(threshold: number, minVoxels: number): void {
  if (!(Number.isFinite(threshold) && threshold >= 0)) {
    throw new Error(`A cluster threshold must be a finite number of at least 0, not ${threshold}.`);
  }
  if (!(Number.isInteger(minVoxels) && minVoxels >= 0)) {
    throw new Error(`A minimum cluster size must be a whole number of voxels, not ${minVoxels}.`);
  }
}

/**
 * The voxel nilearn reports for a plateau: the one at its centre of mass, rounded as numpy rounds, or the
 * plateau's voxel nearest that centre (first in label order) when the centre falls outside it. A
 * plateau's voxels share one value, so its centre of mass is their mean index.
 */
function plateauVoxel(plateau: Int32Array, shape: Shape, order: Order): number {
  const [nx, ny] = shape;
  let [si, sj, sk] = [0, 0, 0];
  for (const n of plateau) {
    const [i, j, k] = indices(n, shape);
    [si, sj, sk] = [si + i, sj + j, sk + k];
  }
  const ci = roundHalfEven(si / plateau.length);
  const cj = roundHalfEven(sj / plateau.length);
  const ck = roundHalfEven(sk / plateau.length);
  const centre = ci + nx * (cj + ny * ck);
  if (plateau.includes(centre)) return centre;
  let nearest = -1;
  let best = Infinity;
  let bestOrder = Infinity;
  for (const n of plateau) {
    const [i, j, k] = indices(n, shape);
    const distance = (i - ci) ** 2 + (j - cj) ** 2 + (k - ck) ** 2;
    const at = order(i, j, k);
    if (distance < best || (distance === best && at < bestOrder)) {
      [nearest, best, bestOrder] = [n, distance, at];
    }
  }
  return nearest;
}

function indices(n: number, [nx, ny]: Shape): [number, number, number] {
  const i = n % nx;
  const j = ((n - i) / nx) % ny;
  return [i, j, (n - i - nx * j) / (nx * ny)];
}

/** Gives the face-connected run of voxels marked -1 around `seed` the mark `to`, queued from `tail`. */
function flood(
  marks: Int32Array | Int8Array,
  to: number,
  seed: number,
  queue: Int32Array,
  tail: number,
  shape: Shape,
): number {
  const [nx, ny, nz] = shape;
  const nxy = nx * ny;
  const take = (m: number) => {
    if (marks[m] === -1) {
      marks[m] = to;
      queue[tail++] = m;
    }
  };
  take(seed);
  for (let head = tail - 1; head < tail; head++) {
    const n = queue[head]!;
    const [i, j, k] = indices(n, shape);
    if (i > 0) take(n - 1);
    if (i < nx - 1) take(n + 1);
    if (j > 0) take(n - nx);
    if (j < ny - 1) take(n + nx);
    if (k > 0) take(n - nxy);
    if (k < nz - 1) take(n + nxy);
  }
  return tail;
}

/** numpy's `round`: halves go to the even neighbour. */
function roundHalfEven(x: number): number {
  const r = Math.round(x);
  return r - x === 0.5 && r % 2 !== 0 ? r - 1 : r;
}
