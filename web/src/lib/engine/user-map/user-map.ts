import { BufferAttribute, BufferGeometry, Color, Float32BufferAttribute } from 'three';
import type { InterleavedBufferAttribute, Mesh, MeshPhysicalMaterial, TypedArray } from 'three';
import { fetchAsset } from '../../core/assets/asset-cache.ts';
import { loadFieldData } from '../../core/coordinates/field.ts';
import { readIn } from '../../core/coordinates/spaces.ts';
import type { CarriedMap, CortexSurfaces } from '../../core/user-map/carry.ts';
import type { MapCourse } from '../../core/user-map/course.ts';
import { MAP_SLOTS, VOLUMES_PER_SECOND } from '../../core/user-map/display.ts';
import type {
  CortexSurface,
  MapDisplay,
  MapOverlap,
  MapSummary,
} from '../../core/user-map/display.ts';
import { MapFileError } from '../../core/user-map/map-file-error.ts';
import {
  partitionField,
  partitionParents,
  partitionPoints,
} from '../../core/user-map/partition.ts';
import type { Parents } from '../../core/user-map/partition.ts';
import { overlapAreas, vertexAreas } from '../../core/user-map/overlap.ts';
import type { OverlapAreas } from '../../core/user-map/overlap.ts';
import { gridSampler } from '../../core/user-map/sampling.ts';
import type { BrainAtlas, Layer } from '../model/brain-atlas.ts';
import type { BrainSections } from '../slices/sections.ts';
import type { SliceMap } from '../slices/sampling.ts';
import { greyed } from '../render/materials.ts';
import type { AnatomicalUserData } from '../render/materials.ts';
import { prefersReducedMotion } from '../render/camera-motion.ts';
import {
  clearUserMapVolume,
  dropPrevious,
  setUserMapDisplay,
  setUserMapOverlap,
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
import { workerLoadFailure } from '../worker-load.ts';

const HEMISPHERES = ['left', 'right'] as const;
type Hemisphere = (typeof HEMISPHERES)[number];

/** How far from the pial towards the white surface each lies. */
const SURFACE_DEPTH: Record<Exclude<CortexSurface, 'pial'>, number> = { mid: 0.5, white: 1 };
/** Each cortical vertex's sum and share for both maps: the first's in xy, the second's in zw. */
const ATTRIBUTE = '_user_map';
const ITEM_SIZE = 2 * MAP_SLOTS;
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
 * The reader's own maps on this brain, `MAP_SLOTS` of them: each read and carried in one worker, drawn
 * per vertex on the cortex and per voxel on every cut face, the one on top over the other. `baseUrl`
 * is where the anatomy publishes its fields and labels.
 */
export function createUserMap({
  atlas,
  sections,
  baseUrl,
  invalidate,
}: {
  atlas: BrainAtlas;
  /** The linked MRI, which draws the maps on its planes from the same 1 mm grids as the cut faces. */
  sections: Pick<BrainSections, 'setUserMaps'>;
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
      const failure = workerLoadFailure(event, 'user map');
      // A worker that never loaded drops every later job silently: the next job starts another.
      if (failure) worker = null;
      const error = failure ?? new Error(event.message);
      for (const job of waiting.values()) job.reject(error);
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

  // Each native vertex's mid-thickness area in mm², found once: the surfaces do not change.
  let midAreas: Promise<Record<Hemisphere, Float64Array>> | null = null;
  const nativeAreas = () => {
    midAreas ??= Promise.all([atlas.ensureEnvelopes(), cortexSurfaces()]).then(
      ([envelopes, surfaces]) => {
        const of = (hemisphere: Hemisphere) => {
          const { pial, white } = surfaces[hemisphere];
          return vertexAreas(
            surface(envelopes, hemisphere, 'pial').getIndex()!.array,
            pial.map((value, i) => (value + white[i]!) / 2),
          );
        };
        return { left: of('left'), right: of('right') };
      },
    );
    midAreas.catch(() => (midAreas = null));
    return midAreas;
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
   * atlas was published with: a parcel moved onto another surface still has the same parents. Kept by
   * layer, so an atlas released and loaded again (ATLAS-10) is laid out on its new meshes.
   */
  const layouts = new WeakMap<
    Layer,
    Promise<Map<Hemisphere, { parents: Parents; meshes: Map<number, Mesh> }>>
  >();
  const layout = (id: string) => {
    const layer = atlas.layers.get(id);
    let found = layer && layouts.get(layer);
    if (!found) {
      found = (async () => {
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
      if (layer) {
        layouts.set(layer, found);
        found.catch(() => layouts.delete(layer));
      }
    }
    return found;
  };

  // The surface the cortex is drawn on: the reader's choice, map or not, while no cut is open (a cut face
  // spans pial to white, so the surface it meets must be the pial).
  let surfaceChoice: CortexSurface = 'pial';
  let drawnSurface: { atlas: string; layer: Layer | null; surface: CortexSurface } = {
    atlas: '',
    layer: null,
    surface: 'pial',
  };
  let surfaceRequest = 0;
  const wantedSurface = (): CortexSurface => (atlas.settings.cutActive ? 'pial' : surfaceChoice);

  /** Move the drawn atlas's parcels onto the surface wanted, and the last one back to the pial. */
  const placeSurface = async () => {
    const id = atlas.settings.atlas;
    const layer = atlas.layers.get(id) ?? null;
    const surface = wantedSurface();
    if (drawnSurface.layer === layer && drawnSurface.surface === surface) return;
    const ask = ++surfaceRequest;
    // A released layer took its moved parcels with it.
    const moved = atlas.layers.get(drawnSurface.atlas) === drawnSurface.layer;
    if (drawnSurface.layer && moved && drawnSurface.surface !== 'pial') {
      await moveParcels(drawnSurface.atlas, 'pial', ask);
    }
    if (ask !== surfaceRequest) return;
    if (surface !== 'pial') await moveParcels(id, surface, ask);
    if (ask !== surfaceRequest) return;
    drawnSurface = { atlas: id, layer, surface };
    invalidate();
  };

  /** Nothing moves once a newer placement is asked for; what moves is recorded as it moves. */
  const moveParcels = async (id: string, target: CortexSurface, ask: number) => {
    const [hemispheres, envelopes] = await Promise.all([layout(id), atlas.ensureEnvelopes()]);
    if (ask !== surfaceRequest) return;
    drawnSurface = { atlas: id, layer: atlas.layers.get(id) ?? null, surface: target };
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

  // Drawn against a function, every drawn map takes the overlap colours (the app compares one alone).
  let overlap: MapOverlap | null = null;

  // A series moving between volumes (`userMapMoving` names its slot): the frame request.
  let blendFrame = 0;

  const stopBlend = () => {
    if (blendFrame) cancelAnimationFrame(blendFrame);
    blendFrame = 0;
  };

  /** Stop any move between volumes and draw every map's current one alone. */
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

  /** The drawn maps on the linked MRI, the one under first. */
  const drawSections = () => {
    const top = uniforms.userMapTop.value;
    const drawn = slots
      .map((slot) => slot.slice())
      .filter((map): map is SliceMap => map !== null)
      .sort((a, b) => Number(a.slot === top) - Number(b.slot === top));
    sections.setUserMaps(drawn);
  };

  /** A map slot: its carried volume, how it is drawn, and its half of each cortical vertex's values. */
  const createSlot = (slot: number) => {
    let carried: CarriedMap | null = null;
    let at: ((x: number, y: number, z: number) => number) | null = null;
    let painted: string | null = null;
    let request = 0;
    let shown: MapDisplay | null = null;
    let drawnExtent = '';
    let drawnVolume = 0;
    let extentRequest = 0;
    let placedAt = -Infinity;
    const extents = newestOnly();
    const tables = newestOnly();

    const moving = () =>
      uniforms.userMapMoving.value === slot && uniforms.userMapPrevious.value !== null;

    /**
     * Give each parcel of the drawn cortical atlas this map's half of its vertices' values, once per map
     * and atlas; with `blend`, each keeps the values drawn until now to move on from.
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
          const drawn = packed(mesh, ATTRIBUTE, field.length / 2);
          if (blend) {
            const kept = packed(mesh, PREVIOUS, field.length / 2).copyArray(drawn.array);
            kept.needsUpdate = true;
          }
          // Written over in place: a replaced attribute's GPU buffer is freed only with its geometry.
          const values = drawn.array as Float32Array;
          for (let v = 0, n = 2 * slot; v < field.length; v += 2, n += ITEM_SIZE) {
            values[n] = field[v]!;
            values[n + 1] = field[v + 1]!;
          }
          drawn.needsUpdate = true;
          userData(mesh).userMapReady[slot]!.value = true;
        }
      }
      painted = id;
      invalidate();
    };

    const unpaint = () => {
      for (const layer of atlas.layers.values()) {
        for (const mesh of layer.meshes) {
          // The values stay for the next map to write over; `userMapReady` hides them.
          if (mesh.geometry.getAttribute(ATTRIBUTE))
            userData(mesh).userMapReady[slot]!.value = false;
        }
      }
      painted = null;
    };

    /**
     * Put a carried map on the cut faces, the linked MRI and the cortex; with `blend`, the volume drawn
     * until now moves into it (never under reduced motion), and another map's move stops.
     */
    const place = async (map: CarriedMap, blend = false) => {
      const move = blend && !prefersReducedMotion();
      if (move || moving()) stopBlend();
      unpaint();
      carried = map;
      at = gridSampler(map.grid, map.volume);
      setUserMapVolume(uniforms, slot, map.grid, map.volume, move);
      if (move) uniforms.userMapBlend.value = 0;
      if (shown) drawSections();
      await paintCortex(move);
      const now = performance.now();
      if (move) blendIn(now - placedAt);
      placedAt = now;
      invalidate();
    };

    return {
      /** What the linked MRI draws of this map, or null while it is not drawn. */
      slice(): SliceMap | null {
        return shown && at ? { slot, at, display: shown, overlap } : null;
      },
      /** Paint the shown atlas's cortex after an atlas change. */
      follow(): void {
        if (!carried || painted === atlas.settings.atlas) return;
        if (moving()) settle();
        unpaint();
        paintCortex().catch(report);
      },
      api: {
        async load(file: ArrayBuffer, space: string, volume: number): Promise<MapSummary> {
          const ask = ++request;
          const metadata = atlas.manifest.coordinate_spaces;
          if (!metadata) throw new Error('This anatomy publishes no template registration.');
          const record = readIn(metadata, space);
          const { id } = record;
          const job: CarryJob = { kind: 'carry', token: ++token, slot, file, space: id, volume };
          const transfer: Transferable[] = [file];
          if (!inverted.has(id)) {
            if (record.native) job.native = record.native;
            else {
              job.field = {
                record: record.field,
                data: await loadFieldData(record.field, baseUrl),
              };
              transfer.push(job.field.data.buffer);
            }
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
          setUserMapDisplay(uniforms, slot, null);
          drawSections();
          uniforms.userMapBase.value.setFromColor(
            greyed(new Color(atlas.manifest.appearance.tissue.cortex)),
          );
          await place(map);
          return summary;
        },
        async clusters(threshold: number, minVoxels: number, volume: number): Promise<Cluster[]> {
          if (!carried) throw new Error('No map is loaded.');
          const job: ClusterJob = {
            kind: 'clusters',
            token: ++token,
            slot,
            volume,
            threshold,
            minVoxels,
          };
          const reply = await tables(() => post(job, []));
          return (reply as { clusters: Cluster[] }).clusters;
        },
        async extent(threshold: number, minVoxels: number, volume: number): Promise<void> {
          if (!carried) throw new Error('No map is loaded.');
          const key = extentKey(volume, threshold, minVoxels);
          if (key === drawnExtent) return;
          const ask = ++extentRequest;
          const loaded = request;
          const job: ExtentJob = {
            kind: 'extent',
            token: ++token,
            slot,
            volume,
            threshold,
            minVoxels,
          };
          const { map } = (await extents(() => post(job, []))) as { map: CarriedMap };
          if (ask !== extentRequest || loaded !== request) {
            throw new SupersededError('A newer extent was asked for.');
          }
          const moved = volume !== drawnVolume;
          drawnExtent = key;
          drawnVolume = volume;
          await place(map, moved);
        },
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
          const job: CourseJob = { kind: 'course', token: ++token, slot, points: points.slice() };
          const { course } = (await post(job, [job.points.buffer])) as { course: MapCourse };
          if (loaded !== request) throw new SupersededError('A newer map was opened.');
          return course;
        },
        show(display: MapDisplay | null): void {
          if (display && !carried) throw new Error('No map is loaded.');
          shown = display;
          setUserMapDisplay(uniforms, slot, display);
          drawSections();
          void placeSurface().catch(report);
          invalidate();
        },
        async overlapAreas(regions: readonly string[]): Promise<OverlapAreas> {
          if (!carried || !shown) throw new Error('No map is drawn.');
          const map = carried;
          const { threshold } = shown;
          const id = atlas.settings.atlas;
          const record = atlas.manifest.atlases.find((entry) => entry.id === id)?.ribbon_labels as
            RibbonLabels | undefined;
          if (!record) throw new Error(`No native labels for the ${id} cortex.`);
          const [labels, areas] = await Promise.all([ribbon(record), nativeAreas()]);
          const wanted = new Set(regions);
          const cortex = new Set<number>();
          const inside = new Set<number>();
          for (const [index, region] of record.region_ids.entries()) {
            if (atlas.regions.get(region)?.kind === 'cortex') cortex.add(index);
            if (wanted.has(region)) inside.add(index);
          }
          const total: OverlapAreas = { map: 0, function: 0, both: 0 };
          let at = 0;
          for (const hemisphere of HEMISPHERES) {
            const count = record.vertex_counts[hemisphere];
            const part = overlapAreas(
              {
                values: map.cortex[hemisphere],
                labels: labels.subarray(at, at + count),
                areas: areas[hemisphere],
              },
              cortex,
              inside,
              threshold,
            );
            at += count;
            total.map += part.map;
            total.function += part.function;
            total.both += part.both;
          }
          return total;
        },
        clear(): void {
          request++;
          if (moving()) stopBlend();
          carried = null;
          at = null;
          shown = null;
          unpaint();
          clearUserMapVolume(uniforms, slot);
          drawSections();
          void placeSurface().catch(report);
          invalidate();
        },
      },
    };
  };

  const slots = Array.from({ length: MAP_SLOTS }, (_, slot) => createSlot(slot));

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
    for (const slot of slots) slot.follow();
    void placeSurface().catch(report);
  };
  const report = (error: Error) => {
    console.error(error);
    atlas.dispatchEvent(new CustomEvent('loaderror', { detail: error }));
  };
  atlas.addEventListener('change', onChange);

  return {
    /**
     * The map slots. Each one's `load` reads a NIfTI file given in `space` and carries it onto this
     * brain, replacing that slot's map; nothing is drawn until its `show`. It rejects with the reason a
     * file cannot be read or placed.
     */
    maps: slots.map((slot) => slot.api),
    /** Draw this slot's map over the other's. */
    setTop(slot: number): void {
      if (!Number.isInteger(slot) || slot < 0 || slot >= MAP_SLOTS) {
        throw new RangeError(`There is no map slot ${slot}.`);
      }
      uniforms.userMapTop.value = slot;
      drawSections();
      invalidate();
    },
    /** The surface the shown atlas's cortex is drawn on now. */
    drawnSurface(): CortexSurface {
      return drawnSurface.atlas === atlas.settings.atlas &&
        drawnSurface.layer === atlas.layers.get(drawnSurface.atlas)
        ? drawnSurface.surface
        : 'pial';
    },
    /** The cortex's surface, with or without a map, while no cut is open; the pial under a cut. */
    setSurface(surface: CortexSurface): void {
      surfaceChoice = surface;
      void placeSurface().catch(report);
    },
    /** Draw the maps against the paint, a function's areas, in these colours; null draws them on their own scales. */
    setOverlap(next: MapOverlap | null): void {
      overlap = next;
      setUserMapOverlap(uniforms, next);
      drawSections();
      invalidate();
    },
    dispose(): void {
      atlas.removeEventListener('change', onChange);
      worker?.terminate();
      worker = null;
      for (const job of waiting.values()) job.reject(new SupersededError('The engine closed.'));
      waiting.clear();
      stopBlend();
      for (const slot of slots.keys()) clearUserMapVolume(uniforms, slot);
    },
  };
}

/**
 * A parcel's packed per-vertex values for both maps, made the first time either map is drawn on it.
 * Whoever writes it marks it for upload.
 */
function packed(mesh: Mesh, name: string, vertices: number): BufferAttribute {
  const found = mesh.geometry.getAttribute(name);
  if (!found) {
    const made = new BufferAttribute(new Float32Array(vertices * ITEM_SIZE), ITEM_SIZE);
    mesh.geometry.setAttribute(name, made);
    return made;
  }
  if (
    !(found instanceof BufferAttribute) ||
    found.itemSize !== ITEM_SIZE ||
    found.count !== vertices ||
    !(found.array instanceof Float32Array)
  ) {
    throw new Error(`${name} does not hold ${ITEM_SIZE} floats for each of ${vertices} vertices.`);
  }
  return found;
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
