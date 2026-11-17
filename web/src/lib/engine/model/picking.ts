import { Box3, Raycaster, Vector3 } from 'three';
import type { Camera, Intersection, Mesh, Plane, Ray } from 'three';
import type { FacingPoint, Region, Size } from '../../types/index.ts';
import { rasToWorld, worldToRas } from '../slices/coordinates.ts';
import type { Bvh } from './geometry-jobs.ts';
import type { AtlasMesh } from './layers.ts';

// Reused by nearestHit. A hover tests every visible mesh, and a fresh list per
// pointer frame would collect as the pointer moves.
const rayBox = new Box3();
const rayBoxHit = new Vector3();
const raySlots: { mesh: Mesh; entry: number }[] = [];
const rayHits: Intersection[] = [];

/**
 * Where the ray enters a mesh's world box, or Infinity when it misses.
 *
 * Inside the box the entry is 0: a triangle of that mesh may sit on the
 * camera. Three's box test returns the exit in that case, which would hide
 * the mesh behind a farther hit.
 */
function boxEntry(mesh: Mesh, ray: Ray): number {
  const { geometry } = mesh;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  rayBox.copy(geometry.boundingBox!).applyMatrix4(mesh.matrixWorld);
  if (rayBox.containsPoint(ray.origin)) return 0;
  return ray.intersectBox(rayBox, rayBoxHit) ? ray.origin.distanceTo(rayBoxHit) : Infinity;
}

/**
 * The nearest hit on `meshes` that `planes` keep. Raycaster must already be configured with the
 * host camera and pointer.
 *
 * Meshes are tested from the front of the ray. Once a hit is in hand, a box
 * that starts beyond it cannot hold a closer triangle, so the rest of the
 * brain is not walked. A clipped hit does not count: the retained face
 * behind it still has to be found.
 */
export function nearestHit(
  raycaster: Raycaster,
  meshes: readonly AtlasMesh[],
  planes: readonly Plane[],
): Intersection<AtlasMesh> | null {
  const clipped = planes.length > 0;
  let count = 0;
  for (const mesh of meshes) {
    const entry = boxEntry(mesh, raycaster.ray);
    if (entry === Infinity) continue;
    const slot = raySlots[count];
    if (slot) {
      slot.mesh = mesh;
      slot.entry = entry;
    } else {
      raySlots[count] = { mesh, entry };
    }
    count += 1;
  }
  for (let i = 1; i < count; i++) {
    const slot = raySlots[i]!;
    let j = i;
    while (j > 0 && raySlots[j - 1]!.entry > slot.entry) {
      raySlots[j] = raySlots[j - 1]!;
      j -= 1;
    }
    raySlots[j] = slot;
  }
  const firstHitOnly = raycaster.firstHitOnly;
  if (clipped) raycaster.firstHitOnly = false;
  try {
    let best: Intersection | null = null;
    let bestDistance = Infinity;
    for (let i = 0; i < count; i++) {
      const { mesh, entry } = raySlots[i]!;
      // The world box is a little loose after the matrix, so a hair of slack
      // keeps a triangle that lands on the box face.
      if (entry > bestDistance + 1e-5) break;
      rayHits.length = 0;
      mesh.raycast(raycaster, rayHits);
      for (let h = 0; h < rayHits.length; h++) {
        const hit = rayHits[h]!;
        if (hit.distance >= bestDistance) continue;
        if (clipped && !planes.every((plane) => plane.distanceToPoint(hit.point) >= -1e-9)) {
          continue;
        }
        best = hit;
        bestDistance = hit.distance;
      }
    }
    return best as Intersection<AtlasMesh> | null;
  } finally {
    raycaster.firstHitOnly = firstHitOnly;
  }
}

/** The region a hit names: none for a miss or the medial wall. */
export function regionOf(
  hit: Intersection<AtlasMesh> | null,
  regions: ReadonlyMap<string, Region>,
): Region | null {
  if (!hit || hit.object.userData['kind'] === 'non-region') return null;
  return regions.get(hit.object.userData['region_id'] as string) ?? null;
}

/** A hit on the drawn surfaces or on a cut face, which names its own region (`BrainSections.intersect`). */
export type StageHit = Intersection & { region?: Region | null };

/** The region a surface or cut-face hit names, as `BrainSections.pick` reads it. */
export function hitRegion(hit: StageHit, regions: ReadonlyMap<string, Region>): Region | null {
  if (hit.region !== undefined) return hit.region;
  return regionOf(hit as Intersection<AtlasMesh>, regions);
}

/** The stage a label point is looked for on. */
export interface FacingScene {
  regions: ReadonlyMap<string, Region>;
  /** The meshes drawn now; a region without one faces no one. */
  meshes: readonly AtlasMesh[];
  camera: Camera;
  size: Size;
  /** The nearest drawn surface or cut face along a ray. */
  intersect: (raycaster: Raycaster) => StageHit | null;
}

/** Float slack past a label point that still counts as meeting it, in world metres. */
const FACING_SLACK_M = 0.0005;

const facingRay = new Raycaster();
facingRay.firstHitOnly = true;
const eye = new Vector3();
const onScreen = new Vector3();

/** Where a region's name stands: a parcel's most open pial vertex, a structure's anchor. */
function labelPoint(region: Region): readonly [number, number, number] {
  const field = region.kind === 'cortex' ? 'label_point_ras_mm' : 'anchor_ras_mm';
  if (region.kind !== 'cortex' && region.kind !== 'structure') {
    throw new Error(`A ${region.kind} is not named on the stage: ${region.id}`);
  }
  const point = region[field];
  if (!point) throw new Error(`The manifest places no ${field} for ${region.id}.`);
  return point;
}

/**
 * Each region's label point, where its mesh is drawn, on a canvas of `size` when the first thing a
 * ray from the camera meets on its way there is that region, at the point or before it. The point
 * returned with it is where the ray met the region, so a camera move can carry it until the next
 * call. A region's own fold in front of its point still names it: the name stands over the region.
 */
export function facing(
  ids: readonly string[],
  { regions, meshes, camera, size, intersect }: FacingScene,
): (FacingPoint | null)[] {
  camera.updateMatrixWorld();
  camera.getWorldPosition(eye);
  return ids.map((id) => {
    const region = regions.get(id);
    if (!region) throw new Error(`Unknown region: ${id}`);
    const point = labelPoint(region);
    const mesh = meshes.find((candidate) => candidate.userData['region_id'] === id);
    if (!mesh) return null;
    mesh.updateWorldMatrix(true, false);
    // Node transforms are identities, so the matrix is the explode's shift or the medial pair's turn.
    const world = rasToWorld(point).applyMatrix4(mesh.matrixWorld);
    onScreen.copy(world).project(camera);
    // Beyond the far side of normalized depth: behind the camera.
    if (onScreen.z > 1) return null;
    const reach = world.distanceTo(eye);
    facingRay.set(eye, world.sub(eye).normalize());
    const hit = intersect(facingRay);
    if (!hit || hit.distance > reach + FACING_SLACK_M || hitRegion(hit, regions)?.id !== id) {
      return null;
    }
    return {
      x: ((onScreen.x + 1) / 2) * size.width,
      y: ((1 - onScreen.y) / 2) * size.height,
      drawn: worldToRas(hit.point),
    };
  });
}

/** A raycast that builds the mesh's BVH first if neither the worker nor an earlier ray has. */
export function raycastWithBvh({ MeshBVH, acceleratedRaycast }: Bvh): Mesh['raycast'] {
  return function (this: Mesh, raycaster, intersects) {
    this.geometry.boundsTree ??= new MeshBVH(this.geometry, { indirect: true });
    acceleratedRaycast.call(this, raycaster, intersects);
  };
}
