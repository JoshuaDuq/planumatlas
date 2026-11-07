import { encodeCsv } from '../comparison/catalog.ts';
import type { Cluster } from './clusters.ts';

/**
 * Each peak's label: its cluster's number, then a, b, … for the cluster's sub-peaks, as nilearn's table.
 * nilearn numbers negative clusters from 1 again, so a negative cluster's label carries its sign.
 */
export function peakLabel(cluster: Pick<Cluster, 'id' | 'sign'>, index: number): string {
  const id = `${cluster.sign < 0 ? '-' : ''}${cluster.id}`;
  return index ? `${id}${String.fromCharCode(96 + index)}` : id;
}

/** The table at full precision: one row per peak, in template millimetres. */
export function clusterCsv(
  clusters: readonly Cluster[],
  {
    file,
    template,
    statistic,
    threshold,
  }: {
    file: string;
    template: string;
    statistic: string | null;
    threshold: number;
  },
): string {
  return encodeCsv(
    clusters.flatMap((cluster) =>
      cluster.peaks.map((peak, index) => ({
        peak: peakLabel(cluster, index),
        sign: cluster.sign,
        x_mm: peak.mm[0],
        y_mm: peak.mm[1],
        z_mm: peak.mm[2],
        value: peak.value,
        statistic: statistic ?? '',
        cluster_size_mm3: index ? '' : cluster.sizeMm3,
        cluster_voxels: index ? '' : cluster.voxels,
        threshold,
        template,
        file,
      })),
    ),
  );
}
