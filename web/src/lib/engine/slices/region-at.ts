import { Box3, DoubleSide, Matrix3, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { acceleratedRaycast } from 'three-mesh-bvh';
import type { Region } from '../../types/index.ts';
import { rasToWorld } from './coordinates.ts';
import type { Ras } from './coordinates.ts';

/** The model's reads behind `drawnRegionAt`. */
export interface DrawnSolidsModel {
  readonly regions: ReadonlyMap<string, Region>;
  readonly state: { readonly atlas: string };
  readonly visibleMeshes: readonly Mesh[];
  ensureRibbonWedges(atlas: string, baseUrl: string | URL): Promise<Mesh[]>;
}

// Both faces count: the exit from inside a closed surface is a back face.
const PROBE = new MeshBasicMaterial({ side: DoubleSide });
// Off every axis, so the ray does not run along the grid-aligned faces of a marching-cubes mesh.
const RAY = new Vector3(1, 0.37, 0.21).normalize();

/**
 * The region of the smallest closed solid that holds a point, by the winding count along one ray (as
 * the cut's caps decide it); null when none does.
 */
export function regionAt(solids: readonly Mesh[], point: Ras): string | null {
  const world = rasToWorld(point);
  const raycaster = new Raycaster(world, RAY);
  const size = new Vector3();
  let best: { region: string; volume: number } | null = null;
  for (const solid of solids) {
    const bounds = worldBounds(solid);
    if (!bounds.containsPoint(world)) continue;
    const winding = crossings(solid, raycaster).reduce((sum, { sign }) => sum + sign, 0);
    if (winding === 0) continue;
    const volume = bounds.getSize(size).x * size.y * size.z;
    if (!best || volume < best.volume) {
      best = { region: solid.userData['region_id'] as string, volume };
    }
  }
  return best?.region ?? null;
}

export function worldBounds({ geometry, matrixWorld }: Mesh): Box3 {
  geometry.computeBoundingBox();
  return new Box3().copy(geometry.boundingBox!).applyMatrix4(matrixWorld);
}

/**
 * Where a ray crosses a closed solid, nearest first, each +1 leaving it and −1 entering (the ray
 * against the face's normal); their sum before a point is its winding count.
 */
export function crossings(solid: Mesh, raycaster: Raycaster): { distance: number; sign: number }[] {
  const probe = new Mesh(solid.geometry, PROBE);
  probe.matrixWorld.copy(solid.matrixWorld);
  probe.raycast = acceleratedRaycast;
  const normals = new Matrix3().getNormalMatrix(solid.matrixWorld);
  const normal = new Vector3();
  const { direction } = raycaster.ray;
  return raycaster.intersectObject(probe, false).map((hit) => ({
    distance: hit.distance,
    sign: Math.sign(normal.copy(hit.face!.normal).applyNormalMatrix(normals).dot(direction)),
  }));
}

/**
 * The region the 3D brain draws at a point (source RAS mm): a structure of the shown detail level, or
 * a shown cortical parcel through its ribbon solid, which the first call downloads.
 */
export async function drawnRegionAt(
  model: DrawnSolidsModel,
  baseUrl: string | URL,
  point: Ras,
): Promise<Region | null> {
  const wedges = await model.ensureRibbonWedges(model.state.atlas, baseUrl);
  // Read after the download: what is shown may have changed during it.
  const shown = model.visibleMeshes.filter((mesh) => mesh.userData['region_id']);
  const cortex = new Set(
    shown.filter((mesh) => mesh.userData['kind'] === 'cortex').map((m) => m.userData['region_id']),
  );
  const solids = [
    ...shown.filter((mesh) => mesh.userData['kind'] === 'structure'),
    ...wedges.filter((wedge) => cortex.has(wedge.userData['region_id'])),
  ];
  for (const solid of solids) solid.updateWorldMatrix(true, false);
  const id = regionAt(solids, point);
  return id === null ? null : model.regions.get(id)!;
}
