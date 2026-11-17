import { Box3, BufferAttribute } from 'three';
import type { BufferGeometry, Mesh } from 'three';
import { featherBorders } from '../render/border-feather.ts';
import { workerLoadFailure } from '../worker-load.ts';
import type { GeometryCopy, GeometryJob, GeometryReply } from './geometry-worker.ts';

export type Bvh = typeof import('three-mesh-bvh');

/** A geometry as the worker takes it: copied, so the drawn buffers stay where they are. */
function copyGeometry(geometry: BufferGeometry): GeometryCopy {
  const position = geometry.getAttribute('position');
  if (
    !(position instanceof BufferAttribute) ||
    !(position.array instanceof Float32Array) ||
    position.itemSize !== 3 ||
    position.normalized
  ) {
    throw new Error('Geometry work needs plain float positions.');
  }
  const index = geometry.getIndex();
  return {
    position: position.array.slice(),
    index: index ? (index.array.slice() as Uint16Array | Uint32Array) : null,
    drawRange: { ...geometry.drawRange },
    groups: geometry.groups.map((group) => ({ ...group })),
  };
}

/** Workers that share each BVH job; feathers have one more of their own. */
const BVH_WORKERS = 2;

/** Consecutive runs of `geometries` with about equal triangle counts: at most `parts`, none empty. */
function splitByTriangles(
  geometries: readonly BufferGeometry[],
  parts: number,
): BufferGeometry[][] {
  const size = (geometry: BufferGeometry) =>
    (geometry.getIndex() ?? geometry.getAttribute('position')).count;
  const total = geometries.reduce((sum, geometry) => sum + size(geometry), 0);
  const runs: BufferGeometry[][] = [[]];
  let done = 0;
  for (const geometry of geometries) {
    if (runs.at(-1)!.length && done >= (total * runs.length) / parts) runs.push([]);
    runs.at(-1)!.push(geometry);
    done += size(geometry);
  }
  return runs;
}

/**
 * The model's BVHs and border feathers, computed in workers so that loading a layer, the envelopes
 * or a cut's wedges keeps every frame short. A layer's feathers and its detail level's BVHs run side
 * by side, and the BVHs are split between workers; each tree depends on its geometry alone. Where
 * there is no Worker (Node), the same functions run on this thread: what changes is where the work
 * runs, never its result.
 */
export class GeometryJobs {
  /** The feather worker, then the BVH workers. */
  private workers: Worker[] | null = null;
  private failure: Error | null = null;
  private token = 0;
  private readonly pending = new Map<
    number,
    { resolve: (reply: GeometryReply) => void; reject: (error: Error) => void }
  >();

  /** Give each geometry that has none the indirect BVH `new MeshBVH(geometry, { indirect: true })` builds. */
  async bvhs({ MeshBVH }: Bvh, geometries: readonly BufferGeometry[]): Promise<void> {
    const wanted = geometries.filter((geometry) => !geometry.boundsTree);
    if (!wanted.length) return;
    const workers = this.ensureWorkers();
    if (!workers) {
      for (const geometry of wanted)
        geometry.boundsTree = new MeshBVH(geometry, { indirect: true });
      return;
    }
    // A parcel moved off the pial meanwhile (user-map.ts) does not take a tree of where it was.
    const positions = wanted.map((geometry) => {
      const attribute = geometry.getAttribute('position') as BufferAttribute;
      return { attribute, version: attribute.version };
    });
    const replies = await Promise.all(
      splitByTriangles(wanted, BVH_WORKERS).map((part, at) =>
        this.run(workers[1 + at]!, 'bvh', part),
      ),
    );
    const trees = replies.flatMap((reply) => {
      if (!('bvhs' in reply))
        throw new Error('The geometry worker answered a BVH job with feathers.');
      return reply.bvhs;
    });
    trees.forEach((data, at) => {
      const geometry = wanted[at]!;
      const { attribute, version } = positions[at]!;
      const moved =
        geometry.getAttribute('position') !== attribute || attribute.version !== version;
      // A ray that came first has built it already; after a move, the next ray builds it.
      if (geometry.boundsTree || moved) return;
      const tree = MeshBVH.deserialize(data, geometry, { setIndex: false });
      // Building sets the box of a geometry that has none; deserializing does not.
      geometry.boundingBox ??= tree.getBoundingBox(new Box3());
      geometry.boundsTree = tree;
    });
  }

  /** `featherBorders(meshes)`, off this thread. */
  async feather(meshes: readonly Mesh[]): Promise<void> {
    const workers = this.ensureWorkers();
    if (!workers) return featherBorders(meshes);
    const reply = await this.run(
      workers[0]!,
      'feather',
      meshes.map((mesh) => mesh.geometry),
    );
    if (!('feathers' in reply)) throw new Error('The geometry worker answered feathers with BVHs.');
    // Into the attribute the layer was first drawn with, so the buffer on the GPU is reused.
    reply.feathers.forEach((values, at) => {
      const feather = meshes[at]!.geometry.getAttribute('_feather') as BufferAttribute;
      feather.copyArray(values);
      feather.needsUpdate = true;
    });
  }

  dispose(): void {
    for (const worker of this.workers ?? []) worker.terminate();
    this.workers = null;
    this.failure = new Error('BrainAtlas was disposed during geometry work.');
    for (const pending of this.pending.values()) pending.reject(this.failure);
    this.pending.clear();
  }

  private run(
    worker: Worker,
    type: GeometryJob['type'],
    geometries: readonly BufferGeometry[],
  ): Promise<GeometryReply> {
    const copies = geometries.map(copyGeometry);
    const transfers = copies.flatMap(({ position, index }) =>
      index ? [position.buffer, index.buffer] : [position.buffer],
    );
    const token = ++this.token;
    return new Promise((resolve, reject) => {
      this.pending.set(token, { resolve, reject });
      worker.postMessage({ type, token, geometries: copies } satisfies GeometryJob, transfers);
    });
  }

  /** The workers, or null where the platform has none; one that failed fails every later job. */
  private ensureWorkers(): Worker[] | null {
    if (this.failure) throw this.failure;
    if (this.workers) return this.workers;
    if (typeof Worker === 'undefined') return null;
    const workers = Array.from(
      { length: 1 + BVH_WORKERS },
      () => new Worker(new URL('./geometry-worker.ts', import.meta.url), { type: 'module' }),
    );
    for (const worker of workers) {
      worker.onmessage = ({ data }: MessageEvent<GeometryReply>) => {
        const pending = this.pending.get(data.token)!;
        this.pending.delete(data.token);
        if ('error' in data) pending.reject(new Error(data.error));
        else pending.resolve(data);
      };
      worker.onerror = (event) => {
        this.failure =
          workerLoadFailure(event, 'geometry') ??
          new Error(event.message || 'Geometry work failed', { cause: event });
        for (const each of workers) each.terminate();
        this.workers = null;
        for (const pending of this.pending.values()) pending.reject(this.failure);
        this.pending.clear();
      };
    }
    this.workers = workers;
    return workers;
  }
}
