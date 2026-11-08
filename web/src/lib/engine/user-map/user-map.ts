import { BufferAttribute, BufferGeometry, Color, Float32BufferAttribute } from 'three';
import type { InterleavedBufferAttribute, Mesh, MeshPhysicalMaterial, TypedArray } from 'three';
import { fetchAsset } from '../../core/assets/asset-cache.ts';
import { loadFieldData } from '../../core/coordinates/field.ts';
import { readIn } from '../../core/coordinates/spaces.ts';
import type { CarriedMap, CortexSurfaces } from '../../core/user-map/carry.ts';
import type { MapCourse } from '../../core/user-map/course.ts';
import { VOLUMES_PER_SECOND } from '../../core/user-map/display.ts';
import type { CortexSurface, MapDisplay, MapSummary } from '../../core/user-map/display.ts';
import { MapFileError } from '../../core/user-map/map-file-error.ts';
import {
  partitionField,
  partitionParents,
  partitionPoints,
} from '../../core/user-map/partition.ts';
import type { Parents } from '../../core/user-map/partition.ts';
import { gridSampler } from '../../core/user-map/sampling.ts';
import type { BrainAtlas } from '../model/brain-atlas.ts';
import type { BrainSections } from '../slices/sections.ts';
import { greyed } from '../render/materials.ts';
import type { AnatomicalUserData } from '../render/materials.ts';
import { prefersReducedMotion } from '../render/scene.ts';
import {
  clearUserMapVolume,
  dropPrevious,
  setUserMapDisplay,
  setUserMapVolume,
} from './overlay.ts';
import { regionPoints } from './region-points.ts';
import type {
  CarryJob,
  ClusterJob,
  CourseJob,
  ExtentJob,
  UserMapJob,
  UserMapReply,
} from './user-map-worker.ts';
import type { Cluster } from '../../core/user-map/clusters.ts';

const HEMISPHERES = ['left', 'right'] as const;
type Hemisphere = (typeof HEMISPHERES)[number];

/** How far from the pial towards the white surface each lies. */
const SURFACE_DEPTH: Record<Exclude<CortexSurface, 'pial'>, number> = { mid: 0.5, white: 1 };
const ATTRIBUTE = '_user_map';
/** The cortex's values in the volume drawn before, while a series moves on from it. */
const PREVIOUS = '_user_map_previous';
/** A volume's share of a second at the fastest playback. */
const STEP_MS = 1000 / VOLUMES_PER_SECOND;

interface RibbonLabels {
  file: string;
  vertex_counts: Record<(typeof HEMISPHERES)[number], number>;
  region_ids: string[];
}

/** A newer map was asked for before this one was carried. */
export class SupersededError extends Error {
  override name = 'AbortError';
}

/**
 * Jobs of one kind run one at a time in the worker; one asked for while another runs is sent only if
 * it is still the newest when that one is done, so scrubbing a series carries no volume passed over.
 */
function newestOnly() {
  let asked = 0;
  let running: Promise<unknown> = Promise.resolve();
  return async <T>(run: () => Promise<T>): Promise<T> => {
    const ask = ++asked;
    await running;
    if (ask !== asked) throw new SupersededError('A newer job was asked for.');
    const result = run();
    running = result.catch(() => {});
    return result;
  };
}

/** The map as a volume is drawn: its small clusters are trimmed only above one voxel. */
const extentKey = (volume: number, threshold: number, minVoxels: number) =>
  minVoxels > 1 ? `${volume}/${threshold}/${minVoxels}` : `${volume}`;

/**
 * The reader's own map on this brain: read and carried in a worker, drawn per vertex on the cortex
 * and per voxel on every cut face. `baseUrl` is where the anatomy publishes its fields and labels.
 */
export function createUserMap({
  atlas,
  sections,
  baseUrl,
  invalidate,
}: {
  atlas: BrainAtlas;
  /** The linked MRI, which draws the map on its planes from the same 1 mm grid as the cut faces. */
  sections: Pick<BrainSections, 'setUserMap'>;
  baseUrl: URL;
  invalidate: () => void;
}) {
  const uniforms = atlas.userMap;
  let worker: Worker | null = null;
  let token = 0;
  const waiting = new Map<
    number,
    { resolve: (reply: UserMapReply) => void; reject: (error: Error) => void }
  >();
  const inverted = new Set<string>();
  let cortexSent = false;
  let carried: CarriedMap | null = null;
  let at: ((x: number, y: number, z: number) => number) | null = null;
  let painted: string | null = null;
  let request = 0;
  const ribbons = new Map<string, Promise<Uint16Array>>();
  // Each region's whole-millimetre points, by atlas and region: the solids do not change.
  const regions = new Map<string, Float32Array>();

  const start = () => {
    if (worker) return worker;
    worker = new Worker(new URL('./user-map-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }: MessageEvent<UserMapReply>) => {
      const job = waiting.get(data.token);
      waiting.delete(data.token);
      if ('error' in data) {
        job?.reject(
          data.file ? new MapFileError(data.file.code, data.file.params) : new Error(data.error),
        );
      } else job?.resolve(data);
    };
    worker.onerror = (event) => {
      for (const job of waiting.values()) job.reject(new Error(event.message));
      waiting.clear();
    };
    return worker;
  };

  const post = (job: UserMapJob, transfer: Transferable[]) =>
    new Promise<UserMapReply>((resolve, reject) => {
      waiting.set(job.token, { resolve, reject });
      start().postMessage(job, transfer);
    });

  // The native surfaces, in surface RAS millimetres (glTF metres: x right, y superior, z posterior).
  const cortexSurfaces = async () => {
    const envelopes = await atlas.ensureEnvelopes();
    const ras = (hemisphere: string, boundary: string) => {
      const world = surface(envelopes, hemisphere, boundary).getAttribute('position').array;
      const out = new Float32Array(world.length);
      for (let v = 0; v < world.length; v += 3) {
        out[v] = world[v]! * 1000;
        out[v + 1] = -world[v + 2]! * 1000;
        out[v + 2] = world[v + 1]! * 1000;
      }
      return out;
    };
    const of = (hemisphere: string): CortexSurfaces => ({
      pial: ras(hemisphere, 'pial'),
      white: ras(hemisphere, 'white'),
    });
    return { left: of('left'), right: of('right') };
  };

  const ribbon = (record: RibbonLabels) => {
    let loading = ribbons.get(record.file);
    if (!loading) {
      loading = fetchAsset(new URL(record.file, baseUrl)).then((buffer) => {
        const labels = new Uint16Array(buffer);
        if (labels.length !== record.vertex_counts.left + record.vertex_counts.right) {
          throw new Error(`${record.file} does not label every native vertex.`);
        }
        return labels;
      });
      ribbons.set(record.file, loading);
      loading.catch(() => ribbons.delete(record.file));
    }
    return loading;
  };

  /**
   * Each hemisphere's parcels of an atlas and their native parents, found once from the pial positions the
   * atlas was published with: a parcel moved onto another surface still has the same parents.
   */
  const layouts = new Map<
    string,
    Promise<Map<Hemisphere, { parents: Parents; meshes: Map<number, Mesh> }>>
  >();
  const layout = (id: string) => {
    let found = layouts.get(id);
    if (!found) {
      found = (async () => {
        const layer = atlas.layers.get(id);
        const record = atlas.manifest.atlases.find((entry) => entry.id === id)?.ribbon_labels as
          RibbonLabels | undefined;
        if (!layer || !record) throw new Error(`No native labels for the ${id} cortex.`);
        const [labels, envelopes] = await Promise.all([ribbon(record), atlas.ensureEnvelopes()]);
        const byRegion = new Map(
          layer.meshes.map((mesh) => [mesh.userData['region_id'] as string, mesh as Mesh]),
        );
        const result = new Map<Hemisphere, { parents: Parents; meshes: Map<number, Mesh> }>();
        let at = 0;
        for (const hemisphere of HEMISPHERES) {
          const count = record.vertex_counts[hemisphere];
          const pial = surface(envelopes, hemisphere, 'pial');
          const parcels = new Map<number, ArrayLike<number>>();
          const meshes = new Map<number, Mesh>();
          for (const [index, region] of record.region_ids.entries()) {
            const mesh = byRegion.get(region);
            if (!mesh || mesh.userData['hemisphere'] !== hemisphere) continue;
            parcels.set(index, pialOf(mesh));
            meshes.set(index, mesh);
          }
          const parents = partitionParents(
            {
              faces: pial.getIndex()!.array,
              pial: pial.getAttribute('position').array,
              labels: labels.subarray(at, at + count),
            },
            parcels,
          );
          at += count;
          result.set(hemisphere, { parents, meshes });
        }
        return result;
      })();
      layouts.set(id, found);
      found.catch(() => layouts.delete(id));
    }
    return found;
  };

  /**
   * Give each parcel of the drawn cortical atlas its vertices' values, once per map and atlas; with
   * `blend`, each keeps the values drawn until now to move on from.
   */
  const paintCortex = async (blend = false) => {
    const id = atlas.settings.atlas;
    const map = carried;
    if (!map || painted === id) return;
    const hemispheres = await layout(id);
    if (map !== carried || id !== atlas.settings.atlas) return;
    for (const [hemisphere, { parents, meshes }] of hemispheres) {
      for (const [index, field] of partitionField(parents, map.cortex[hemisphere])) {
        const mesh = meshes.get(index)!;
        const drawn = mesh.geometry.getAttribute(ATTRIBUTE) as BufferAttribute | undefined;
        if (blend && drawn) {
          const kept = mesh.geometry.getAttribute(PREVIOUS) as BufferAttribute | undefined;
          if (kept) overwrite(checked(kept, drawn.array), drawn.array);
          else mesh.geometry.setAttribute(PREVIOUS, new BufferAttribute(drawn.array.slice(), 2));
        }
        // Written over in place: a replaced attribute's GPU buffer is freed only with its geometry.
        if (drawn) overwrite(checked(drawn, field), field);
        else mesh.geometry.setAttribute(ATTRIBUTE, new BufferAttribute(field, 2));
        userData(mesh).userMapReady.value = true;
      }
    }
    painted = id;
    invalidate();
  };

  const unpaint = () => {
    for (const layer of atlas.layers.values()) {
      for (const mesh of layer.meshes) {
        // The values stay for the next map to write over; `userMapReady` hides them.
        if (mesh.geometry.getAttribute(ATTRIBUTE)) userData(mesh).userMapReady.value = false;
      }
    }
    painted = null;
  };

  // The surface the cortex is drawn on: the reader's choice while the map shows and no cut is open (a cut
  // face spans pial to white, so the surface it meets must be the pial).
  let surfaceChoice: CortexSurface = 'pial';
  let drawnSurface: { atlas: string; surface: CortexSurface } = { atlas: '', surface: 'pial' };
  let surfaceRequest = 0;
  const wantedSurface = (): CortexSurface =>
    uniforms.userMapOn.value && !atlas.settings.cutActive ? surfaceChoice : 'pial';

  /** Move the drawn atlas's parcels onto the surface wanted, and the last one back to the pial. */
  const placeSurface = async () => {
    const id = atlas.settings.atlas;
    const surface = wantedSurface();
    if (drawnSurface.atlas === id && drawnSurface.surface === surface) return;
    const ask = ++surfaceRequest;
    if (drawnSurface.atlas && drawnSurface.surface !== 'pial') {
      await moveParcels(drawnSurface.atlas, 'pial', ask);
    }
    if (ask !== surfaceRequest) return;
    if (surface !== 'pial') await moveParcels(id, surface, ask);
    if (ask !== surfaceRequest) return;
    drawnSurface = { atlas: id, surface };
    invalidate();
  };

  /** Nothing moves once a newer placement is asked for; what moves is recorded as it moves. */
  const moveParcels = async (id: string, target: CortexSurface, ask: number) => {
    const [hemispheres, envelopes] = await Promise.all([layout(id), atlas.ensureEnvelopes()]);
    if (ask !== surfaceRequest) return;
    drawnSurface = { atlas: id, surface: target };
    for (const [hemisphere, { parents, meshes }] of hemispheres) {
      if (target === 'pial') {
        for (const mesh of meshes.values()) restorePial(mesh);
        continue;
      }
      const pial = surface(envelopes, hemisphere, 'pial');
      const white = surface(envelopes, hemisphere, 'white');
      const depth = SURFACE_DEPTH[target];
      const from = pial.getAttribute('position').array;
      const to = white.getAttribute('position').array;
      const native = new BufferGeometry();
      native.setAttribute(
        'position',
        new Float32BufferAttribute(
          Float32Array.from(from, (value, i) => value + depth * (to[i]! - value)),
          3,
        ),
      );
      native.setIndex(pial.getIndex());
      native.computeVertexNormals();
      const positions = partitionPoints(parents, native.getAttribute('position').array);
      const normals = partitionPoints(parents, native.getAttribute('normal').array, true);
      native.dispose();
      for (const [index, mesh] of meshes) {
        if (!published.has(mesh)) {
          published.set(mesh, {
            position: mesh.geometry.getAttribute('position').array.slice(),
            normal: mesh.geometry.getAttribute('normal').array.slice(),
          });
        }
        placeOn(mesh, positions.get(index)!, normals.get(index)!);
      }
    }
  };

  // How the map is drawn now; a new extent of it is drawn the same way.
  let shown: MapDisplay | null = null;
  let drawnExtent = '';
  let drawnVolume = 0;
  let extentRequest = 0;
  const extents = newestOnly();
  const tables = newestOnly();

  // A series moving between volumes: the frame request, and when the last volume was placed.
  let blendFrame = 0;
  let placedAt = -Infinity;

  const stopBlend = () => {
    if (blendFrame) cancelAnimationFrame(blendFrame);
    blendFrame = 0;
  };

  /** Stop any move between volumes and draw the current one alone. */
  const settle = () => {
    stopBlend();
    dropPrevious(uniforms);
  };

  /**
   * Move linearly from the previous volume to this one over as long as the last step took, so a playing
   * series flows from volume to volume; a step on its own takes one playback step.
   */
  const blendIn = (since: number) => {
    const duration = since < 2 * STEP_MS ? Math.max(since, STEP_MS) : STEP_MS;
    const start = performance.now();
    const frame = (now: number) => {
      const share = Math.min(1, Math.max(0, (now - start) / duration));
      if (share < 1) {
        uniforms.userMapBlend.value = share;
        blendFrame = requestAnimationFrame(frame);
      } else settle();
      invalidate();
    };
    blendFrame = requestAnimationFrame(frame);
  };

  /**
   * Put a carried map on the cut faces, the linked MRI and the cortex; with `blend`, the volume drawn
   * until now moves into it (never under reduced motion).
   */
  const place = async (map: CarriedMap, blend = false) => {
    const moving = blend && !prefersReducedMotion();
    stopBlend();
    unpaint();
    carried = map;
    at = gridSampler(map.grid, map.volume);
    setUserMapVolume(uniforms, map.grid, map.volume, moving);
    if (moving) uniforms.userMapBlend.value = 0;
    if (shown) sections.setUserMap({ at, display: shown });
    await paintCortex(moving);
    const now = performance.now();
    if (moving) blendIn(now - placedAt);
    placedAt = now;
    invalidate();
  };

  /** A structure's closed solids, or else the shown cortical atlas's ribbon solid for a parcel. */
  const solidsOf = async (id: string): Promise<Mesh[]> => {
    const structures = [...atlas.layers.values()]
      .flatMap((layer) => layer.meshes)
      .filter(({ userData }) => userData['region_id'] === id && userData['kind'] === 'structure');
    if (structures.length) return structures;
    const wedges = await atlas.ensureRibbonWedges(atlas.settings.atlas, baseUrl);
    return wedges.filter(({ userData }) => userData['region_id'] === id);
  };

  const onChange = () => {
    if (carried && painted !== atlas.settings.atlas) {
      settle();
      unpaint();
      paintCortex().catch(report);
    }
    void placeSurface().catch(report);
  };
  const report = (error: Error) => {
    console.error(error);
    atlas.dispatchEvent(new CustomEvent('loaderror', { detail: error }));
  };
  atlas.addEventListener('change', onChange);

  return {
    /**
     * Read a NIfTI file given in `space` and carry it onto this brain, replacing any map; nothing is
     * drawn until `show`. Rejects with the reason a file cannot be read or placed.
     */
    async load(file: ArrayBuffer, space: string, volume: number): Promise<MapSummary> {
      const ask = ++request;
      const metadata = atlas.manifest.coordinate_spaces;
      if (!metadata) throw new Error('This anatomy publishes no template registration.');
      const { id, field: record } = readIn(metadata, space);
      const job: CarryJob = { kind: 'carry', token: ++token, file, space: id, volume };
      const transfer: Transferable[] = [file];
      if (!inverted.has(id)) {
        job.field = { record, data: await loadFieldData(record, baseUrl) };
        transfer.push(job.field.data.buffer);
      }
      if (!cortexSent) {
        job.cortex = await cortexSurfaces();
        for (const side of HEMISPHERES) {
          transfer.push(job.cortex[side].pial.buffer, job.cortex[side].white.buffer);
        }
      }
      const { map, summary } = (await post(job, transfer)) as {
        map: CarriedMap;
        summary: MapSummary;
      };
      inverted.add(id);
      cortexSent = true;
      if (ask !== request) throw new SupersededError('A newer map was opened.');
      drawnExtent = extentKey(volume, Number.NaN, 0);
      drawnVolume = volume;
      shown = null;
      sections.setUserMap(null);
      setUserMapDisplay(uniforms, null);
      uniforms.userMapBase.value.setFromColor(
        greyed(new Color(atlas.manifest.appearance.tissue.cortex)),
      );
      await place(map);
      return summary;
    },
    /** A volume's clusters and peaks beyond `threshold`, as nilearn's `get_clusters_table`. */
    async clusters(threshold: number, minVoxels: number, volume: number): Promise<Cluster[]> {
      if (!carried) throw new Error('No map is loaded.');
      const reply = await tables(() =>
        post({ kind: 'clusters', token: ++token, volume, threshold, minVoxels } as ClusterJob, []),
      );
      return (reply as { clusters: Cluster[] }).clusters;
    },
    /**
     * Draw a volume of the map without its clusters smaller than `minVoxels` beyond ±threshold, as
     * nilearn's `threshold_img(…, cluster_threshold=minVoxels)`; below two voxels, the whole volume.
     */
    async extent(threshold: number, minVoxels: number, volume: number): Promise<void> {
      if (!carried) throw new Error('No map is loaded.');
      const key = extentKey(volume, threshold, minVoxels);
      if (key === drawnExtent) return;
      const ask = ++extentRequest;
      const loaded = request;
      const { map } = (await extents(() =>
        post({ kind: 'extent', token: ++token, volume, threshold, minVoxels } as ExtentJob, []),
      )) as { map: CarriedMap };
      if (ask !== extentRequest || loaded !== request) {
        throw new SupersededError('A newer extent was asked for.');
      }
      const moved = volume !== drawnVolume;
      drawnExtent = key;
      drawnVolume = volume;
      await place(map, moved);
    },
    /**
     * A region's mean in each volume of the loaded map, over its whole millimetres inside the region's
     * solid; null for a region with none (neither a structure nor a parcel of the shown cortex).
     */
    async course(region: string): Promise<MapCourse | null> {
      if (!carried) throw new Error('No map is loaded.');
      const loaded = request;
      const key = `${atlas.settings.atlas}/${region}`;
      let points = regions.get(key);
      if (!points) {
        const solids = await solidsOf(region);
        if (!solids.length) return null;
        points = regionPoints(solids);
        regions.set(key, points);
      }
      const job: CourseJob = { kind: 'course', token: ++token, points: points.slice() };
      const { course } = (await post(job, [job.points.buffer])) as { course: MapCourse };
      if (loaded !== request) throw new SupersededError('A newer map was opened.');
      return course;
    },
    /** The cortex's surface while the map is drawn and no cut is open; the pial otherwise. */
    setSurface(surface: CortexSurface): void {
      surfaceChoice = surface;
      void placeSurface().catch(report);
    },
    /** Draw the loaded map with these settings, or hide it with null. */
    show(display: MapDisplay | null): void {
      if (display && !carried) throw new Error('No map is loaded.');
      shown = display;
      setUserMapDisplay(uniforms, display);
      sections.setUserMap(display && { at: at!, display });
      void placeSurface().catch(report);
      invalidate();
    },
    /** Forget the map. */
    clear(): void {
      request++;
      stopBlend();
      carried = null;
      at = null;
      shown = null;
      unpaint();
      clearUserMapVolume(uniforms);
      sections.setUserMap(null);
      void placeSurface().catch(report);
      invalidate();
    },
    dispose(): void {
      atlas.removeEventListener('change', onChange);
      worker?.terminate();
      worker = null;
      for (const job of waiting.values()) job.reject(new SupersededError('The engine closed.'));
      waiting.clear();
      stopBlend();
      clearUserMapVolume(uniforms);
    },
  };
}

// A moved parcel's published pial positions and normals as stored (the normals quantized), copied
// before it first moves and dropped when it is back on the pial.
const published = new WeakMap<Mesh, { position: TypedArray; normal: TypedArray }>();

function pialOf(mesh: Mesh): ArrayLike<number> {
  return published.get(mesh)?.position ?? mesh.geometry.getAttribute('position').array;
}

function restorePial(mesh: Mesh): void {
  const kept = published.get(mesh);
  if (!kept) return;
  placeOn(mesh, kept.position, kept.normal);
  published.delete(mesh);
}

/**
 * Moved in place, so the drawn buffers are reused; a pending BVH sees the version change. Both are
 * checked before either is written, so a parcel is never left half moved.
 */
function placeOn(mesh: Mesh, position: TypedArray, normal: TypedArray): void {
  const writes = [
    [checked(mesh.geometry.getAttribute('position'), position), position],
    [checked(mesh.geometry.getAttribute('normal'), normal), normal],
  ] as const;
  for (const [attribute, values] of writes) overwrite(attribute, values);
  settle(mesh);
}

/** Values of the attribute's own type, or floats for a normalized one (the assets' Int16 normals). */
function checked(
  attribute: BufferAttribute | InterleavedBufferAttribute,
  values: TypedArray,
): BufferAttribute {
  if (attribute instanceof BufferAttribute && attribute.array.length === values.length) {
    if (values.constructor === attribute.array.constructor) return attribute;
    if (attribute.normalized && attribute.itemSize === 3 && values instanceof Float32Array) {
      return attribute;
    }
  }
  throw new Error('A parcel is written over only by values of its own length and type.');
}

function overwrite(attribute: BufferAttribute, values: TypedArray): void {
  if (values.constructor === attribute.array.constructor) attribute.array.set(values);
  else {
    // setXYZ quantizes into the normalized integer type.
    for (let i = 0; i < attribute.count; i++) {
      attribute.setXYZ(i, values[3 * i]!, values[3 * i + 1]!, values[3 * i + 2]!);
    }
  }
  attribute.needsUpdate = true;
}

/** Bounds and the picking tree follow the surface drawn, so a click lands where it is seen. */
function settle(mesh: Mesh): void {
  mesh.geometry.computeBoundingBox();
  mesh.geometry.computeBoundingSphere();
  (mesh.geometry as { boundsTree?: { refit(): void } }).boundsTree?.refit();
}

function surface(envelopes: readonly Mesh[], hemisphere: string, boundary: string) {
  const mesh = envelopes.find(
    ({ userData }) => userData['hemisphere'] === hemisphere && userData['boundary'] === boundary,
  );
  if (!mesh) throw new Error(`Missing the ${hemisphere} ${boundary} envelope.`);
  return mesh.geometry;
}

const userData = (mesh: Mesh) =>
  (mesh.material as MeshPhysicalMaterial).userData as AnatomicalUserData;

export type UserMap = ReturnType<typeof createUserMap>;
