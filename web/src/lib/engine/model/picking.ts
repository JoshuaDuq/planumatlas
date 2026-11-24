import { Box3, Raycaster, Vector2, Vector3 } from 'three';
import type { Camera, Intersection, Mesh, Plane, Ray } from 'three';
import type { Region, ScreenPoint, SeenPoint, Size, Vec3 } from '../../types/index.ts';
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

/** The stage a name's rays are cast on. */
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

/**
 * Whether each point a name stands on (where `seenAt` met its region) is still in sight: the first
 * thing a ray from the camera meets on its way there is that region, at the point or before it, or, while
 * the region is drawn, anything at the point itself: a point met on the edge two regions share can meet
 * the neighbour's triangle there. One ray each.
 */
export function inSight(
  targets: readonly { id: string; point: Vec3 }[],
  scene: FacingScene,
): boolean[] {
  const { regions, meshes, camera, intersect } = scene;
  camera.updateMatrixWorld();
  camera.getWorldPosition(eye);
  return targets.map(({ id, point }) => {
    if (!regions.has(id)) throw new Error(`Unknown region: ${id}`);
    const world = rasToWorld(point);
    onScreen.copy(world).project(camera);
    if (onScreen.z > 1) return false;
    const reach = world.distanceTo(eye);
    facingRay.set(eye, world.sub(eye).normalize());
    const hit = intersect(facingRay);
    if (!hit || hit.distance > reach + FACING_SLACK_M) return false;
    if (hitRegion(hit, regions)?.id === id) return true;
    return (
      hit.distance >= reach - FACING_SLACK_M &&
      meshes.some((mesh) => mesh.userData['region_id'] === id)
    );
  });
}

const through = new Vector2();

/**
 * What the reader sees at each point of a canvas of `size`: the region the first surface or cut face along a
 * ray from the camera through the point names, and where the ray met it. One ray each.
 */
export function seenAt(
  points: readonly ScreenPoint[],
  { regions, camera, size, intersect }: Omit<FacingScene, 'meshes'>,
): (SeenPoint | null)[] {
  camera.updateMatrixWorld();
  return points.map(({ x, y }) => {
    facingRay.setFromCamera(
      through.set((x / size.width) * 2 - 1, 1 - (y / size.height) * 2),
      camera,
    );
    const hit = intersect(facingRay);
    const region = hit && hitRegion(hit, regions);
    return region
      ? { id: region.id, face: hit.region !== undefined, drawn: worldToRas(hit.point) }
      : null;
  });
}

/** A raycast that builds the mesh's BVH first if neither the worker nor an earlier ray has. */
export function raycastWithBvh({ MeshBVH, acceleratedRaycast }: Bvh): Mesh['raycast'] {
  return function (this: Mesh, raycaster, intersects) {
    this.geometry.boundsTree ??= new MeshBVH(this.geometry, { indirect: true });
    acceleratedRaycast.call(this, raycaster, intersects);
  };
}
