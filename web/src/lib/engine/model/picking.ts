import { Box3, Matrix3, Raycaster, Vector3 } from 'three';
import type { BufferGeometry, Camera, Intersection, Mesh, Plane, Ray } from 'three';
import type { FacingPoint, Region, Size, Vec3 } from '../../types/index.ts';
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

/** Where a ray from the eye to `world` first meets region `id`, at the point or before it; null where it meets anything else first. */
function meetsFirst(
  id: string,
  world: Vector3,
  { regions, intersect }: FacingScene,
): Vector3 | null {
  const reach = world.distanceTo(eye);
  facingRay.set(eye, world.sub(eye).normalize());
  const hit = intersect(facingRay);
  if (!hit || hit.distance > reach + FACING_SLACK_M || hitRegion(hit, regions)?.id !== id) {
    return null;
  }
  return hit.point;
}

/** Points sampled over each named mesh, spread apart where it is most open. */
const SURFACE_SAMPLES = 48;
/** The vertices they are sampled from: an even stride through the mesh, at most this many. */
const SAMPLE_POOL = 1536;
/** The most points one region is asked at; a call asks each region's first, then more while it has rays to spare. */
const FACING_TRIES = 6;
/** Rays a call may spend past each region's first, per region it asks. */
const SPARE_PER_REGION = 2;
/** The first tries keep near the middle of a region's side in view, a spread apart; the rest search its edges. */
const NEAR_TRIES = 3;
/** A near try stands at least this share of the region's spread on screen from the misses. */
const TRY_APART = 0.35;

interface SurfaceSamples {
  positions: Float32Array;
  normals: Float32Array;
}
const sampled = new WeakMap<BufferGeometry, SurfaceSamples>();

/**
 * Points spread over a mesh where it is most open, with their normals, in its own space: farthest-point
 * samples of the more open half (`_openness`, the share of directions a vertex sees out of the brain) of an
 * even stride through its vertices; all of the stride where the mesh bakes no openness. Measured once.
 */
function surfaceSamples(geometry: BufferGeometry): SurfaceSamples {
  const cached = sampled.get(geometry);
  if (cached) return cached;
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  if (!normal) throw new Error('A named mesh carries no normals to find the side it shows.');
  const openness = geometry.getAttribute('_openness');
  const step = Math.max(1, Math.floor(position.count / SAMPLE_POOL));
  let pool = Array.from({ length: Math.ceil(position.count / step) }, (_, at) => at * step);
  if (openness) {
    pool.sort((a, b) => openness.getX(b) - openness.getX(a));
    pool = pool.slice(0, Math.max(SURFACE_SAMPLES, Math.ceil(pool.length / 2)));
  }
  const count = Math.min(SURFACE_SAMPLES, pool.length);
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const nearest = new Float64Array(pool.length).fill(Infinity);
  const [taken, at] = [new Vector3(), new Vector3()];
  // The most open first, then each the farthest from those taken.
  let next = 0;
  for (let index = 0; index < count; index++) {
    const vertex = pool[next]!;
    taken.fromBufferAttribute(position, vertex).toArray(positions, index * 3);
    at.fromBufferAttribute(normal, vertex)
      .normalize()
      .toArray(normals, index * 3);
    let farthest = -1;
    pool.forEach((candidate, slot) => {
      const away = at.fromBufferAttribute(position, candidate).distanceToSquared(taken);
      if (away < nearest[slot]!) nearest[slot] = away;
      if (nearest[slot]! > farthest) [farthest, next] = [nearest[slot]!, slot];
    });
  }
  const samples = { positions, normals };
  sampled.set(geometry, samples);
  return samples;
}
const toEye = new Vector3();
const normalMatrix = new Matrix3();
const sampleNormal = new Vector3();

/** A point a region is looked for at: in the world, and on screen in normalized device coordinates. */
interface Lookout {
  world: Vector3;
  x: number;
  y: number;
}

/** Where `world` falls on screen, or null behind the camera. */
function lookout(world: Vector3, camera: Camera): Lookout | null {
  onScreen.copy(world).project(camera);
  // Beyond the far side of normalized depth: behind the camera.
  return onScreen.z > 1 ? null : { world, x: onScreen.x, y: onScreen.y };
}

/** A region's samples on the side the camera sees and inside the canvas, nearest their middle on screen first. */
function lookouts(mesh: AtlasMesh, camera: Camera): Lookout[] {
  const { positions, normals } = surfaceSamples(mesh.geometry);
  normalMatrix.getNormalMatrix(mesh.matrixWorld);
  const seen: Lookout[] = [];
  for (let at = 0; at < positions.length / 3; at++) {
    const world = new Vector3().fromArray(positions, at * 3).applyMatrix4(mesh.matrixWorld);
    sampleNormal.fromArray(normals, at * 3).applyMatrix3(normalMatrix);
    if (sampleNormal.dot(toEye.subVectors(eye, world)) <= 0) continue;
    const point = lookout(world, camera);
    if (point && Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1) seen.push(point);
  }
  const middle = {
    x: seen.reduce((sum, { x }) => sum + x, 0) / seen.length,
    y: seen.reduce((sum, { y }) => sum + y, 0) / seen.length,
  };
  const off = ({ x, y }: Lookout) => Math.hypot(x - middle.x, y - middle.y);
  return seen.sort((a, b) => off(a) - off(b));
}

/** How far on screen `point` is from the nearest of `from`. */
const apart = (point: Lookout, from: readonly Lookout[]) =>
  Math.min(...from.map(({ x, y }) => Math.hypot(point.x - x, point.y - y)));

/**
 * The next point to ask after misses: for the first tries the one nearest the middle (`points` come in that
 * order) a spread apart from every miss, so a dot stays central where it can; after them, the one farthest
 * from every miss, which finds the part a nearer region leaves showing. None once all are taken.
 */
function nextTry(points: readonly Lookout[], missed: readonly Lookout[]): Lookout | undefined {
  if (missed.length < NEAR_TRIES) {
    const middle = points[0]!;
    const spread =
      points.reduce((sum, { x, y }) => sum + Math.hypot(x - middle.x, y - middle.y), 0) /
      points.length;
    const near = points.find((point) => apart(point, missed) >= spread * TRY_APART);
    if (near) return near;
  }
  let [best, reach] = [undefined as Lookout | undefined, 0];
  for (const point of points) {
    const near = apart(point, missed);
    if (near > reach) [best, reach] = [point, near];
  }
  return best;
}

/**
 * Where each region shows, on a canvas of `size`: a point a ray from the camera meets that region at or
 * before, so a name's dot stands on a surface the reader sees. The middle of the region's side in view is
 * asked first (`lookouts`), then (`nextTry`) points out from it, then the samples farthest from every miss,
 * which find the part a nearer region leaves showing; the label point last, or alone where no sample faces
 * the camera.
 * Each region's first point is asked; a call then spends at most `SPARE_PER_REGION` more rays per region it
 * asks. The point returned with it is where the ray met the region, so a camera move can carry it until the
 * next call. A region's own fold in front of its point still names it: the name stands over the region.
 */
export function facing(ids: readonly string[], scene: FacingScene): (FacingPoint | null)[] {
  const { regions, meshes, camera, size } = scene;
  camera.updateMatrixWorld();
  camera.getWorldPosition(eye);
  let spare = ids.length * SPARE_PER_REGION;
  return ids.map((id) => {
    const region = regions.get(id);
    if (!region) throw new Error(`Unknown region: ${id}`);
    const label = rasToWorld(labelPoint(region));
    const mesh = meshes.find((candidate) => candidate.userData['region_id'] === id);
    if (!mesh) return null;
    mesh.updateWorldMatrix(true, false);
    // Node transforms are identities, so the matrix is the explode's shift or the medial pair's turn.
    const seen = lookouts(mesh, camera);
    const missed: Lookout[] = [];
    const ask = (point: Lookout | null): FacingPoint | null => {
      if (!point) return null;
      if (missed.length) spare -= 1;
      const met = meetsFirst(id, point.world.clone(), scene);
      if (!met) {
        missed.push(point);
        return null;
      }
      return {
        x: ((point.x + 1) / 2) * size.width,
        y: ((1 - point.y) / 2) * size.height,
        drawn: worldToRas(met),
      };
    };
    let next: Lookout | undefined = seen[0];
    while (next && missed.length < FACING_TRIES && (!missed.length || spare > 0)) {
      const found = ask(next);
      if (found) return found;
      next = nextTry(seen, missed);
    }
    if (seen.length && (missed.length === FACING_TRIES || !spare)) return null;
    return ask(lookout(label.applyMatrix4(mesh.matrixWorld), camera));
  });
}

/**
 * How much of each region's surface is turned toward the camera, in mm² as the camera sees it: its published
 * surface area times the mean, over its samples, of the cosine between a sample's normal and the way to the
 * eye (none for a sample turned away), so a convex body shows a quarter of its surface on average and a face
 * turned square to the camera all of it. What stands in front is not counted out: `facing` asks that. None
 * for a region not drawn.
 */
export function facingArea(ids: readonly string[], scene: FacingScene): number[] {
  const { regions, meshes, camera } = scene;
  camera.updateMatrixWorld();
  camera.getWorldPosition(eye);
  return ids.map((id) => {
    const region = regions.get(id);
    if (!region) throw new Error(`Unknown region: ${id}`);
    const mesh = meshes.find((candidate) => candidate.userData['region_id'] === id);
    if (!mesh) return 0;
    if (region.surface_area_mm2 === undefined) {
      throw new Error(`The manifest gives no surface area for ${id}.`);
    }
    mesh.updateWorldMatrix(true, false);
    const { positions, normals } = surfaceSamples(mesh.geometry);
    normalMatrix.getNormalMatrix(mesh.matrixWorld);
    let turned = 0;
    for (let at = 0; at < positions.length / 3; at++) {
      sampledWorld.fromArray(positions, at * 3).applyMatrix4(mesh.matrixWorld);
      sampleNormal
        .fromArray(normals, at * 3)
        .applyMatrix3(normalMatrix)
        .normalize();
      turned += Math.max(0, sampleNormal.dot(toEye.subVectors(eye, sampledWorld).normalize()));
    }
    return (region.surface_area_mm2 * turned) / (positions.length / 3);
  });
}
const sampledWorld = new Vector3();

/**
 * Whether each point a name stands on (where `facing` met its region, or its cut face's anchor) is
 * still in sight: the first thing a ray from the camera meets on its way there is that region, at the
 * point or before it. One ray each.
 */
export function inSight(
  targets: readonly { id: string; point: Vec3 }[],
  scene: FacingScene,
): boolean[] {
  const { regions, camera } = scene;
  camera.updateMatrixWorld();
  camera.getWorldPosition(eye);
  return targets.map(({ id, point }) => {
    if (!regions.has(id)) throw new Error(`Unknown region: ${id}`);
    const world = rasToWorld(point);
    onScreen.copy(world).project(camera);
    return onScreen.z <= 1 && meetsFirst(id, world, scene) !== null;
  });
}

/** A raycast that builds the mesh's BVH first if neither the worker nor an earlier ray has. */
export function raycastWithBvh({ MeshBVH, acceleratedRaycast }: Bvh): Mesh['raycast'] {
  return function (this: Mesh, raycaster, intersects) {
    this.geometry.boundsTree ??= new MeshBVH(this.geometry, { indirect: true });
    acceleratedRaycast.call(this, raycaster, intersects);
  };
}
