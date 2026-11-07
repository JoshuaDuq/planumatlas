import assert from 'node:assert/strict';
import { test } from 'vitest';
import { readRepoJson } from '../../../../test/repo.ts';
import { clusterTable, withoutSmallClusters, type Cluster } from './clusters.ts';
import type { NiftiVolume } from './nifti.ts';

interface SparseMap {
  shape: [number, number, number];
  affine: number[][];
  /** [i, j, k, value] for every voxel that is not 0; NaN as null. */
  values: [number, number, number, number | null][];
}

const reference = readRepoJson<{
  maps: Record<string, SparseMap>;
  tables: {
    name: string;
    map: string;
    threshold: number;
    minDistance: number;
    minVoxels: number;
    /** With a minimum size, the voxels threshold_img keeps, [i, j, k]. */
    kept?: [number, number, number][];
    clusters: Cluster[];
  }[];
}>('web/src/lib/core/user-map/fixtures/clusters.json');

function volume({ shape, affine, values }: SparseMap): NiftiVolume {
  const [nx, ny, nz] = shape;
  const data = new Float32Array(nx * ny * nz);
  for (const [i, j, k, value] of values) data[i + nx * (j + ny * k)] = value ?? NaN;
  return { shape, voxelToWorld: affine, data, intent: 0, description: '' };
}

// Values as the float32 nilearn read; coordinates are compared apart, to float precision.
const withoutPlaces = (clusters: Cluster[]) =>
  clusters.map(({ peaks, ...cluster }) => ({
    ...cluster,
    values: peaks.map(({ value }) => Math.fround(value)),
  }));

for (const { name, map, threshold, minDistance, minVoxels, kept, clusters } of reference.tables) {
  test(`nilearn’s cluster table: ${name}`, () => {
    const source = volume(reference.maps[map]!);
    const table = clusterTable(source, threshold, minDistance, minVoxels);
    assert.deepEqual(withoutPlaces(table), withoutPlaces(clusters));
    for (const [c, { id, sign, peaks }] of table.entries()) {
      for (const [p, { mm }] of peaks.entries()) {
        const expected = clusters[c]!.peaks[p]!.mm;
        const error = Math.hypot(...mm.map((v, axis) => v - expected[axis]!));
        assert.ok(error < 1e-9, `cluster ${sign * id}, peak ${p}: ${mm} against ${expected}`);
      }
    }
    if (!kept) return;
    // What is drawn: beyond the threshold, exactly the voxels nilearn's threshold_img keeps.
    const [nx, ny] = source.shape;
    const drawn = withoutSmallClusters(source, threshold, minVoxels);
    const beyond: number[] = [];
    drawn.forEach((value, n) => {
      if (Math.abs(value) > Math.fround(threshold)) beyond.push(n);
    });
    assert.deepEqual(
      beyond,
      kept.map(([i, j, k]) => i + nx * (j + ny * k)).sort((a, b) => a - b),
    );
  });
}

test('a threshold below 0 or not finite is refused', () => {
  const map = volume(reference.maps.touching!);
  for (const threshold of [-0.5, NaN, Infinity]) {
    assert.throws(() => clusterTable(map, threshold), /finite number of at least 0/);
  }
});

test('a minimum cluster size must be a whole number of voxels; below two it removes nothing', () => {
  const map = volume(reference.maps['spikes']!);
  assert.throws(() => clusterTable(map, 2, 8, 2.5), /whole number of voxels/);
  assert.throws(() => withoutSmallClusters(map, 2, -1), /whole number of voxels/);
  assert.deepEqual(withoutSmallClusters(map, 2, 1), map.data);
  assert.notStrictEqual(withoutSmallClusters(map, 2, 1), map.data);
});
