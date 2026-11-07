import assert from 'node:assert/strict';
import { test } from 'vitest';
import { clusterCsv, peakLabel } from './cluster-csv.ts';
import type { Cluster } from './clusters.ts';

const clusters: Cluster[] = [
  {
    id: 1,
    sign: 1,
    voxels: 156,
    sizeMm3: 1248,
    peaks: [
      { mm: [-38, -22, 56], value: 7.58 },
      { mm: [-30, -10, 60], value: 5.25 },
    ],
  },
  { id: 1, sign: -1, voxels: 30, sizeMm3: 240, peaks: [{ mm: [46, -62, 36], value: -4.1 }] },
];

test('a peak is its cluster’s number, a sub-peak takes a letter after it, and a negative cluster its sign', () => {
  assert.deepEqual(
    [
      peakLabel({ id: 1, sign: 1 }, 0),
      peakLabel({ id: 1, sign: 1 }, 1),
      peakLabel({ id: 12, sign: 1 }, 3),
      peakLabel({ id: 1, sign: -1 }, 0),
      peakLabel({ id: 1, sign: -1 }, 2),
    ],
    ['1', '1a', '12c', '-1', '-1b'],
  );
});

test('the CSV has one row per peak at full precision, the cluster’s size on its peak only', () => {
  const csv = clusterCsv(clusters, {
    file: 'zstat1.nii.gz',
    template: 'mni152nlin2009casym',
    statistic: 'z',
    threshold: 3.1,
  });
  assert.equal(
    csv,
    [
      'peak,sign,x_mm,y_mm,z_mm,value,statistic,cluster_size_mm3,cluster_voxels,threshold,template,file',
      '1,1,-38,-22,56,7.58,z,1248,156,3.1,mni152nlin2009casym,zstat1.nii.gz',
      '1a,1,-30,-10,60,5.25,z,,,3.1,mni152nlin2009casym,zstat1.nii.gz',
      '-1,-1,46,-62,36,-4.1,z,240,30,3.1,mni152nlin2009casym,zstat1.nii.gz',
      '',
    ].join('\r\n'),
  );
});
