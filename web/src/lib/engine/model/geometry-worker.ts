import { BufferAttribute, BufferGeometry, Mesh } from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { SerializedBVH } from 'three-mesh-bvh';
import { featherBorders } from '../render/border-feather.ts';

/** A mesh's vertices and triangles, copied exactly, with the range and groups a BVH reads. */
export interface GeometryCopy {
  position: Float32Array;
  index: Uint16Array | Uint32Array | null;
  drawRange: { start: number; count: number };
  groups: { start: number; count: number; materialIndex?: number }[];
}

/** The model's BVHs, or a cortical atlas's border feathers, one per geometry in order. */
export interface GeometryJob {
  type: 'bvh' | 'feather';
  token: number;
  geometries: GeometryCopy[];
}

export type GeometryReply =
  | { token: number; bvhs: SerializedBVH[] }
  | { token: number; feathers: Float32Array[] }
  | { token: number; error: string };

/** The slice of a dedicated worker's global scope this module uses (the app's tsconfig is DOM). */
interface WorkerScope {
  onmessage: ((event: MessageEvent<GeometryJob>) => void) | null;
  postMessage(message: GeometryReply, transfer: Transferable[]): void;
}

function geometryOf({ position, index, drawRange, groups }: GeometryCopy): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  if (index) geometry.setIndex(new BufferAttribute(index, 1));
  geometry.setDrawRange(drawRange.start, drawRange.count);
  for (const { start, count, materialIndex } of groups)
    geometry.addGroup(start, count, materialIndex);
  return geometry;
}

const scope = globalThis as unknown as WorkerScope;

scope.onmessage = ({ data: { type, token, geometries } }) => {
  try {
    const built = geometries.map(geometryOf);
    if (type === 'bvh') {
      // The model keeps its own index; only the tree and its triangle order come back.
      const bvhs = built.map((geometry) => {
        const bvh = MeshBVH.serialize(new MeshBVH(geometry, { indirect: true }), {
          cloneBuffers: false,
        });
        bvh.index = null;
        return bvh;
      });
      const transfers = bvhs.flatMap((bvh) => [...bvh.roots, bvh.indirectBuffer!.buffer]);
      scope.postMessage({ token, bvhs }, transfers);
      return;
    }
    const meshes = built.map((geometry) => new Mesh(geometry));
    featherBorders(meshes);
    const feathers = meshes.map(
      (mesh) => mesh.geometry.getAttribute('_feather').array as Float32Array,
    );
    scope.postMessage(
      { token, feathers },
      feathers.map((feather) => feather.buffer),
    );
  } catch (error) {
    // The job's caller rethrows it; the worker stays up for the next one.
    scope.postMessage({ token, error: error instanceof Error ? error.message : String(error) }, []);
  }
};
