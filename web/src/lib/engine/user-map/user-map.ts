import { BufferAttribute, BufferGeometry, Color, Float32BufferAttribute } from 'three';
import type { Mesh, MeshPhysicalMaterial } from 'three';
import { fetchAsset } from '../../core/assets/asset-cache.ts';
import { loadFieldData } from '../../core/coordinates/field.ts';
import { readIn } from '../../core/coordinates/spaces.ts';
import type { CarriedMap, CortexSurfaces } from '../../core/user-map/carry.ts';
import type { CortexSurface, MapDisplay, MapSummary } from '../../core/user-map/display.ts';
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
import { clearUserMapVolume, setUserMapDisplay, setUserMapVolume } from './overlay.ts';
import type {
  CarryJob,
  ClusterJob,
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

  const start = () => {
    if (worker) return worker;
    worker = new Worker(new URL('./user-map-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }: MessageEvent<UserMapReply>) => {
      const job = waiting.get(data.token);
      waiting.delete(data.token);
      if ('error' in data) job?.reject(new Error(data.error));
      else job?.resolve(data);
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

  /** Give each parcel of the drawn cortical atlas its vertices' values, once per map and atlas. */
  const paintCortex = async () => {
    const id = atlas.settings.atlas;
    const map = carried;
    if (!map || painted === id) return;
    const hemispheres = await layout(id);
    if (map !== carried || id !== atlas.settings.atlas) return;
    for (const [hemisphere, { parents, meshes }] of hemispheres) {
      for (const [index, field] of partitionField(parents, map.cortex[hemisphere])) {
        const mesh = meshes.get(index)!;
        mesh.geometry.setAttribute(ATTRIBUTE, new BufferAttribute(field, 2));
        userData(mesh).userMapReady.value = true;
      }
    }
    painted = id;
    invalidate();
  };

  const unpaint = () => {
    for (const layer of atlas.layers.values()) {
      for (const mesh of layer.meshes) {
        if (!mesh.geometry.getAttribute(ATTRIBUTE)) continue;
        mesh.geometry.deleteAttribute(ATTRIBUTE);
        userData(mesh).userMapReady.value = false;
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
      await moveParcels(drawnSurface.atlas, 'pial');
    }
    if (ask !== surfaceRequest) return;
    if (surface !== 'pial') await moveParcels(id, surface);
    if (ask !== surfaceRequest) return;
    drawnSurface = { atlas: id, surface };
    invalidate();
  };

  const moveParcels = async (id: string, target: CortexSurface) => {
    const [hemispheres, envelopes] = await Promise.all([layout(id), atlas.ensureEnvelopes()]);
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
        pialOf(mesh);
        mesh.geometry.setAttribute('position', new BufferAttribute(positions.get(index)!, 3));
        mesh.geometry.setAttribute('normal', new BufferAttribute(normals.get(index)!, 3));
        settle(mesh);
      }
    }
  };

  // How the map is drawn now; a new extent of it is drawn the same way.
  let shown: MapDisplay | null = null;
  let extentKey = '';
  let extentRequest = 0;

  /** Put a carried map on the cut faces, the linked MRI and the cortex. */
  const place = async (map: CarriedMap) => {
    unpaint();
    carried = map;
    at = gridSampler(map.grid, map.volume);
    setUserMapVolume(uniforms, map.grid, map.volume);
    if (shown) sections.setUserMap({ at, display: shown });
    await paintCortex();
    invalidate();
  };

  const onChange = () => {
    if (carried && painted !== atlas.settings.atlas) {
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
    async load(file: ArrayBuffer, space: string): Promise<MapSummary> {
      const ask = ++request;
      const metadata = atlas.manifest.coordinate_spaces;
      if (!metadata) throw new Error('This anatomy publishes no template registration.');
      const { id, field: record } = readIn(metadata, space);
      const job: CarryJob = { kind: 'carry', token: ++token, file, space: id };
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
      const { map } = (await post(job, transfer)) as { map: CarriedMap };
      inverted.add(id);
      cortexSent = true;
      if (ask !== request) throw new SupersededError('A newer map was opened.');
      extentKey = '';
      shown = null;
      sections.setUserMap(null);
      setUserMapDisplay(uniforms, null);
      uniforms.userMapBase.value.setFromColor(
        greyed(new Color(atlas.manifest.appearance.tissue.cortex)),
      );
      await place(map);
      return map.summary;
    },
    /** The loaded map's clusters and peaks beyond `threshold`, as nilearn's `get_clusters_table`. */
    async clusters(threshold: number, minVoxels: number): Promise<Cluster[]> {
      if (!carried) throw new Error('No map is loaded.');
      const job: ClusterJob = { kind: 'clusters', token: ++token, threshold, minVoxels };
      return ((await post(job, [])) as { clusters: Cluster[] }).clusters;
    },
    /**
     * Draw the map without its clusters smaller than `minVoxels` beyond ±threshold, as nilearn's
     * `threshold_img(…, cluster_threshold=minVoxels)`; below two voxels, the whole map.
     */
    async extent(threshold: number, minVoxels: number): Promise<void> {
      if (!carried) throw new Error('No map is loaded.');
      const key = minVoxels > 1 ? `${threshold}/${minVoxels}` : '';
      if (key === extentKey) return;
      const ask = ++extentRequest;
      const loaded = request;
      const job: ExtentJob = { kind: 'extent', token: ++token, threshold, minVoxels };
      const { map } = (await post(job, [])) as { map: CarriedMap };
      if (ask !== extentRequest || loaded !== request) {
        throw new SupersededError('A newer extent was asked for.');
      }
      extentKey = key;
      await place(map);
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
      clearUserMapVolume(uniforms);
    },
  };
}

// Each parcel's published pial geometry, kept the first time it is read so a moved parcel can go back.
const published = new WeakMap<Mesh, { position: BufferAttribute; normal: BufferAttribute }>();

function pialOf(mesh: Mesh): ArrayLike<number> {
  let kept = published.get(mesh);
  if (!kept) {
    kept = {
      position: mesh.geometry.getAttribute('position') as BufferAttribute,
      normal: mesh.geometry.getAttribute('normal') as BufferAttribute,
    };
    published.set(mesh, kept);
  }
  return kept.position.array;
}

function restorePial(mesh: Mesh): void {
  const kept = published.get(mesh);
  if (!kept || mesh.geometry.getAttribute('position') === kept.position) return;
  mesh.geometry.setAttribute('position', kept.position);
  mesh.geometry.setAttribute('normal', kept.normal);
  settle(mesh);
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
