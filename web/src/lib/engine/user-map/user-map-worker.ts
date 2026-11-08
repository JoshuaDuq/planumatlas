import { carryImage, carryVolume } from '../../core/user-map/carry.ts';
import { clusterTable, withoutSmallClusters } from '../../core/user-map/clusters.ts';
import type { Cluster } from '../../core/user-map/clusters.ts';
import type { CarriedMap, CortexSurfaces } from '../../core/user-map/carry.ts';
import { regionCourse } from '../../core/user-map/course.ts';
import type { MapCourse } from '../../core/user-map/course.ts';
import type { MapSummary } from '../../core/user-map/display.ts';
import { invertField } from '../../core/user-map/inverse-field.ts';
import { MapFileError } from '../../core/user-map/map-file-error.ts';
import type { InverseField } from '../../core/user-map/inverse-field.ts';
import { readNifti, volumeOf } from '../../core/user-map/nifti.ts';
import type { NiftiImage } from '../../core/user-map/nifti.ts';
import type { CoordinateField } from '../../types/index.ts';

/** Read a file and carry one of its volumes onto this brain through a template's field. */
export interface CarryJob {
  kind: 'carry';
  token: number;
  file: ArrayBuffer;
  space: string;
  volume: number;
  /** Sent until the worker has inverted this space's field; it keeps the inversion. */
  field?: { record: CoordinateField; data: Int16Array };
  /** Sent once; the worker keeps them. */
  cortex?: { left: CortexSurfaces; right: CortexSurfaces };
}

/** A volume of the last carried map's clusters and peaks beyond a threshold, in its own template space. */
export interface ClusterJob {
  kind: 'clusters';
  token: number;
  volume: number;
  threshold: number;
  /** nilearn's cluster_threshold: smaller clusters are left out. */
  minVoxels: number;
}

/** A volume of the last carried map, its clusters smaller than `minVoxels` beyond ±threshold removed. */
export interface ExtentJob {
  kind: 'extent';
  token: number;
  volume: number;
  threshold: number;
  minVoxels: number;
}

/** A region's mean in each volume of the last carried map, over its points (surface RAS mm). */
export interface CourseJob {
  kind: 'course';
  token: number;
  points: Float32Array;
}

export type UserMapJob = CarryJob | ClusterJob | ExtentJob | CourseJob;

export type UserMapReply =
  | { token: number; map: CarriedMap; summary?: MapSummary }
  | { token: number; clusters: Cluster[] }
  | { token: number; course: MapCourse }
  | { token: number; error: string; file?: Pick<MapFileError, 'code' | 'params'> };

interface WorkerScope {
  onmessage: ((event: MessageEvent<UserMapJob>) => void) | null;
  postMessage(message: UserMapReply, transfer: Transferable[]): void;
}

const scope = globalThis as unknown as WorkerScope;
const inverses = new Map<string, InverseField>();
let cortex: CarryJob['cortex'];
// Kept for its volumes, clusters and their extent, with the space it was carried from.
let source: { image: NiftiImage; inverse: InverseField } | null = null;
// The newest carry asked for, by token (an older one may arrive later): only it is kept as the source.
let latest = 0;

function post(token: number, map: CarriedMap, summary?: MapSummary) {
  scope.postMessage({ token, map, summary }, [
    map.volume.buffer,
    map.cortex.left.buffer,
    map.cortex.right.buffer,
  ]);
}

scope.onmessage = async ({ data: job }) => {
  try {
    if (job.kind !== 'carry') {
      if (!source || !cortex) throw new Error('No map has been carried.');
      const { image, inverse } = source;
      if (job.kind === 'course') {
        const course = regionCourse(image, inverse, job.points);
        scope.postMessage({ token: job.token, course }, [
          course.means.buffer,
          course.counts.buffer,
        ]);
        return;
      }
      const read = volumeOf(image, job.volume);
      if (job.kind === 'clusters') {
        const clusters = clusterTable(read, job.threshold, undefined, job.minVoxels);
        scope.postMessage({ token: job.token, clusters }, []);
        return;
      }
      const data = withoutSmallClusters(read, job.threshold, job.minVoxels);
      post(job.token, carryVolume({ ...read, data }, inverse, cortex));
      return;
    }
    latest = Math.max(latest, job.token);
    if (job.cortex) cortex = job.cortex;
    if (job.field) inverses.set(job.space, invertField(job.field.record, job.field.data));
    const inverse = inverses.get(job.space);
    if (!inverse || !cortex) throw new Error(`No inverted field or cortex for ${job.space}.`);
    const image = await readNifti(job.file);
    const { map, summary } = carryImage(image, job.volume, inverse, cortex);
    if (job.token === latest) source = { image, inverse };
    post(job.token, map, summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const file =
      error instanceof MapFileError ? { code: error.code, params: error.params } : undefined;
    scope.postMessage({ token: job.token, error: message, file }, []);
  }
};
