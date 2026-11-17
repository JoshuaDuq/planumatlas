import type {
  BufferGeometry,
  DataTexture,
  Group,
  Material,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  Texture,
} from 'three';
import type { Region } from '../../types/index.ts';
import { loadRibbonSources } from '../tissues/solid-assets.ts';
import { createWhiteMatterSurfaces } from '../tissues/white-matter-surfaces.ts';
import type { WhiteMatterSurfaces } from '../tissues/white-matter-surfaces.ts';
import { GeometryJobs } from './geometry-jobs.ts';
import type { AtlasManifest } from './manifest.ts';
import { raycastWithBvh } from './picking.ts';
import { combineProgress } from './progress.ts';
import type { ProgressCallback } from './progress.ts';
import type { SurfaceMaterials } from './surface-materials.ts';

/** The part of a glTF loader the model uses: one published file, with download progress. */
export interface GlbLoader {
  loadAsync(
    file: string,
    onProgress?: ProgressCallback,
    priority?: RequestPriority,
  ): Promise<{ scene: Group }>;
}

/** One loaded GLB: its scene, the region meshes in it, and the colours their borders blend through. */
export interface Layer {
  scene: Group;
  meshes: AtlasMesh[];
  featherPalette: DataTexture | null;
}

export type AtlasMesh = Mesh<BufferGeometry, MeshPhysicalMaterial>;

const ENVELOPES = 'native-envelopes';
const SPINAL_CORD = 'spinal-cord';
/** The cord's supplemental layer id; the spinal cord controls show and hide only it. */
export const CORD_LAYER = 'pam50';

/** A layer id this manifest does not publish; the app tells it from a failed download by this code. */
export const unknownLayer = (message: string) =>
  Object.assign(new Error(message), { code: 'unknown-layer' });

function disposeScene(scene: Object3D): void {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  scene.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    geometries.add(mesh.geometry);
    for (const material of [mesh.material].flat()) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if ((value as Texture | null | undefined)?.isTexture) textures.add(value as Texture);
      }
    }
  });
  for (const geometry of geometries) {
    geometry.boundsTree = undefined;
    geometry.dispose();
  }
  for (const material of materials) material.dispose();
  for (const texture of textures) texture.dispose();
  scene.removeFromParent();
}

/** What the layers need of the model that holds them. */
export interface LayerHost {
  readonly manifest: AtlasManifest;
  readonly regions: ReadonlyMap<string, Region>;
  /** Where each loaded layer is added, hidden until the model shows it. */
  readonly group: Group;
  readonly loader: GlbLoader;
  readonly disposed: boolean;
  /** Draw the model again: what has just loaded may now be shown. */
  update(): void;
  dispatchEvent(event: Event): boolean;
}

/**
 * The model's published geometry: the layers (cortical atlases, detail levels, the cord), the native
 * envelopes and the ribbon wedges, each downloaded once however many callers wait on it, and the
 * layers no longer shown released (ATLAS-10).
 */
export class ModelLayers {
  readonly layers = new Map<string, Layer>();
  /** The native pial and white envelopes: every one, and the white ones the dissection exposes. */
  envelopes: Mesh[] | null = null;
  whiteMatterSurfaces: WhiteMatterSurfaces | null = null;
  readonly ribbonWedges = new Map<string, Mesh[]>();
  spinalCordLoadState: 'unloaded' | 'loading' | 'ready' | 'error' = 'unloaded';
  spinalCordLoadError: unknown = null;
  private readonly pending = new Map<string, Promise<unknown>>();
  /** Each loading layer once it can be drawn, before a cortex's border blend is in (`loadLayer`). */
  private readonly parsed = new Map<string, Promise<{ layer: Layer }>>();
  private readonly geometryJobs = new GeometryJobs();
  /** Who hears each pending download, keyed as `pending` is. */
  private readonly listeners = new Map<string, ProgressCallback[]>();
  private readonly host: LayerHost;
  private readonly materials: SurfaceMaterials;

  constructor(host: LayerHost, materials: SurfaceMaterials) {
    this.host = host;
    this.materials = materials;
  }

  /** Whether the envelopes are downloading now. */
  get envelopesLoading(): boolean {
    return this.pending.has(ENVELOPES);
  }

  /**
   * The native pial and white envelopes, downloaded the first time exposed
   * white matter or a cut needs them. Resolves to every
   * envelope mesh; a failed download is retried by the next call. `onProgress`
   * hears the download, whether this call starts it or joins one under way.
   */
  async ensureEnvelopes(
    onProgress?: ProgressCallback,
    priority?: RequestPriority,
  ): Promise<Mesh[]> {
    const host = this.host;
    if (host.disposed) throw new Error('BrainAtlas has been disposed.');
    if (this.envelopes) return this.envelopes;
    if (this.pending.has(ENVELOPES)) {
      this.join(ENVELOPES, onProgress);
      return this.pending.get(ENVELOPES) as Promise<Mesh[]>;
    }
    const loading = Promise.all([
      host.loader.loadAsync(
        host.manifest.solid_envelopes.file,
        this.share(ENVELOPES, onProgress),
        priority,
      ),
      import('three-mesh-bvh'),
    ])
      .then(async ([{ scene }, bvh]) => {
        let envelopes: Mesh[];
        try {
          if (host.disposed) throw new Error('BrainAtlas disposed during tissue loading.');
          envelopes = [];
          scene.traverse((object) => {
            if ((object as Mesh).isMesh) envelopes.push(object as Mesh);
          });
          // Every envelope is a cut source, and the white ones are picked too.
          await this.geometryJobs.bvhs(
            bvh,
            envelopes.map((mesh) => mesh.geometry),
          );
          if (host.disposed) throw new Error('BrainAtlas disposed during tissue loading.');
          const surfaces = createWhiteMatterSurfaces(scene, host.manifest.appearance);
          for (const mesh of surfaces.meshes) {
            mesh.raycast = raycastWithBvh(bvh);
            this.materials.dressWhiteMatter(mesh);
          }
          this.whiteMatterSurfaces = surfaces;
          this.envelopes = envelopes;
          host.group.add(surfaces.group);
        } catch (error) {
          disposeScene(scene);
          throw error;
        }
        host.update();
        return envelopes;
      })
      .finally(() => this.settled(ENVELOPES));
    this.pending.set(ENVELOPES, loading);
    return loading;
  }

  /** Hidden cortex exposes white matter the moment it is hidden; the envelopes follow and repaint. */
  loadEnvelopesBehind(): void {
    this.ensureEnvelopes().catch((error: Error) => {
      if (this.host.disposed) return;
      console.error(error);
      this.host.dispatchEvent(new CustomEvent('loaderror', { detail: error }));
    });
  }

  /**
   * The cord's layer, downloaded the first time the cord is shown or a cut caps it.
   * A failure clears the request so the next one retries.
   * `onProgress` hears the download, whether this call starts it or joins one under way.
   */
  async ensureSpinalCord(onProgress?: ProgressCallback, priority?: RequestPriority): Promise<void> {
    if (this.host.disposed) throw new Error('BrainAtlas has been disposed.');
    const layers = (this.host.manifest.supplemental_layers ?? []).filter(
      (layer) => layer.id === CORD_LAYER,
    );
    if (!layers.length) throw new Error('This anatomy does not publish a spinal cord.');
    if (this.pending.has(SPINAL_CORD)) {
      this.join(SPINAL_CORD, onProgress);
      return this.pending.get(SPINAL_CORD) as Promise<void>;
    }
    if (layers.every((layer) => this.layers.has(layer.id))) return;
    this.spinalCordLoadState = 'loading';
    const progress = combineProgress(
      layers.map((layer) => layer.id),
      this.share(SPINAL_CORD, onProgress),
    );
    const loading = Promise.all(
      layers.map((layer) =>
        this.loadLayer(layer.id, layer.file, progress.track(layer.id), priority),
      ),
    )
      .then(
        () => {
          this.spinalCordLoadState = 'ready';
          this.spinalCordLoadError = null;
          if (!this.host.disposed) this.host.update();
        },
        (error: unknown) => {
          this.spinalCordLoadState = 'error';
          this.spinalCordLoadError = error;
          throw error;
        },
      )
      .finally(() => this.settled(SPINAL_CORD));
    this.pending.set(SPINAL_CORD, loading);
    return loading;
  }

  /**
   * One supplemental layer, downloaded the first time one of its regions is wanted or a cut caps
   * it; the cord's is `ensureSpinalCord`. Shared and retried as any layer is (`loadLayer`).
   */
  async ensureSupplemental(
    id: string,
    onProgress?: ProgressCallback,
    priority?: RequestPriority,
  ): Promise<void> {
    if (id === CORD_LAYER) return this.ensureSpinalCord(onProgress, priority);
    const layer = this.host.manifest.supplemental_layers?.find((entry) => entry.id === id);
    if (!layer) throw unknownLayer(`This anatomy publishes no supplemental layer ${id}.`);
    if (this.hasLayer(id)) return;
    await this.loadLayer(layer.id, layer.file, onProgress, priority);
    if (!this.host.disposed) this.host.update();
  }

  /**
   * One closed ribbon solid per parcel of an atlas, cut from the envelopes and
   * kept, geometry and BVH alike, for the next cut.
   */
  async ensureRibbonWedges(
    atlas: string,
    baseUrl: string | URL,
    priority?: RequestPriority,
  ): Promise<Mesh[]> {
    if (this.host.disposed) throw new Error('BrainAtlas has been disposed.');
    const cached = this.ribbonWedges.get(atlas);
    if (cached) return cached;
    const key = `ribbon:${atlas}`;
    if (this.pending.has(key)) return this.pending.get(key) as Promise<Mesh[]>;
    const loading = (async () => {
      const envelopes = await this.ensureEnvelopes(undefined, priority);
      const [wedges, bvh] = await Promise.all([
        loadRibbonSources(this.host.manifest, baseUrl, atlas, envelopes, priority),
        import('three-mesh-bvh'),
      ]);
      try {
        if (this.host.disposed) throw new Error('BrainAtlas was disposed during loading.');
        await this.geometryJobs.bvhs(
          bvh,
          wedges.map((wedge) => wedge.geometry),
        );
        if (this.host.disposed) throw new Error('BrainAtlas was disposed during loading.');
      } catch (error) {
        for (const wedge of wedges) wedge.geometry.dispose();
        throw error;
      }
      this.ribbonWedges.set(atlas, wedges);
      return wedges;
    })().finally(() => this.pending.delete(key));
    this.pending.set(key, loading);
    return loading;
  }

  /** Whether a layer is whole: loaded, and a cortex's border blend in (not merely drawable). */
  hasLayer(id: string): boolean {
    return this.layers.has(id) && !this.pending.has(id);
  }

  /** A loading layer once it can be drawn, before a cortex's border blend is in; else undefined. */
  drawable(id: string): Promise<{ layer: Layer }> | undefined {
    return this.parsed.get(id);
  }

  /**
   * One layer, resolved once it is whole. A cortex is drawable before its border blend is back from
   * the worker: it is drawn with none until then (`drawable`), and `initialize` redraws it (`onBlended`).
   */
  async loadLayer(
    id: string,
    file: string,
    onProgress?: ProgressCallback,
    priority?: RequestPriority,
  ): Promise<Layer> {
    const host = this.host;
    if (host.disposed) throw new Error('BrainAtlas has been disposed.');
    // Pending first: a cortex is among the layers while its blend is still on its way.
    if (this.pending.has(id)) {
      this.join(id, onProgress);
      return this.pending.get(id) as Promise<Layer>;
    }
    const loaded = this.layers.get(id);
    if (loaded) return loaded;
    const parsed = Promise.all([
      host.loader.loadAsync(file, this.share(id, onProgress), priority),
      import('three-mesh-bvh'),
    ]).then(async ([{ scene }, bvh]) => {
      if (host.disposed) {
        disposeScene(scene);
        throw new Error('BrainAtlas was disposed during loading.');
      }
      const raycast = raycastWithBvh(bvh);
      const corticalLayer = host.manifest.atlases.some((atlas) => atlas.id === id);
      const meshes: AtlasMesh[] = [];
      const originalMaterials = new Set<Material>();
      try {
        scene.traverse((object) => {
          const mesh = object as Mesh<BufferGeometry, MeshStandardMaterial>;
          if (!mesh.isMesh) return;
          const region = host.regions.get(mesh.userData['region_id'] as string);
          if (!region) throw new Error(`Mesh has no manifest region: ${mesh.name}`);
          for (const field of [
            'label',
            'hemisphere',
            'atlas',
            'source_label_id',
            'kind',
          ] as const) {
            if (mesh.userData[field] !== region[field]) {
              throw new Error(`Mesh metadata mismatch: ${region.id}.${field}`);
            }
          }
          if (!mesh.material.isMeshStandardMaterial) {
            throw new Error(`Expected a standard glTF material: ${region.id}`);
          }
          originalMaterials.add(mesh.material);
          // Indirect indexing preserves the scientific source triangle order.
          mesh.raycast = raycast;
          const shown = this.materials.dress(mesh, region, corticalLayer);
          // Region meshes never move after load. Skipping per-frame matrix
          // updates is free on 400+ nuclei.
          shown.matrixAutoUpdate = false;
          shown.updateMatrix();
          meshes.push(shown);
        });
        if (!meshes.length) throw new Error(`Empty brain model layer: ${id}`);
      } catch (error) {
        disposeScene(scene);
        throw error;
      } finally {
        for (const material of originalMaterials) material.dispose();
      }
      const geometries = meshes.map((mesh) => mesh.geometry);
      // A cortical atlas tiles one surface, so its parcels meet at shared borders. Its parcels are
      // picked, never cut: their BVHs follow the picture, and a ray that arrives first builds its own.
      const cortical = meshes.every((mesh) =>
        ['cortex', 'non-region'].includes(mesh.userData['kind']),
      );
      let featherPalette: DataTexture | null = null;
      let feathered = Promise.resolve();
      if (cortical) {
        featherPalette = this.materials.addFeathers(meshes);
        feathered = this.geometryJobs.feather(meshes);
        this.geometryJobs.bvhs(bvh, geometries).catch((error: Error) => {
          if (host.disposed) return;
          console.error(error);
          host.dispatchEvent(new CustomEvent('loaderror', { detail: error }));
        });
      } else {
        // A detail level's or the cord's structures are cut sources, which the first cut needs whole.
        try {
          await this.geometryJobs.bvhs(bvh, geometries);
          if (host.disposed) throw new Error('BrainAtlas was disposed during loading.');
        } catch (error) {
          disposeScene(scene);
          throw error;
        }
      }
      const layer: Layer = { scene, meshes, featherPalette };
      scene.visible = false;
      host.group.add(scene);
      this.layers.set(id, layer);
      return { layer, feathered };
    });
    const loading = parsed
      .then(async ({ layer, feathered }) => {
        try {
          await feathered;
          if (host.disposed) throw new Error('BrainAtlas was disposed during loading.');
        } catch (error) {
          if (!host.disposed) {
            this.layers.delete(id);
            layer.scene.removeFromParent();
            disposeScene(layer.scene);
            layer.featherPalette?.dispose();
          }
          throw error;
        }
        return layer;
      })
      .finally(() => {
        this.settled(id);
        this.parsed.delete(id);
      });
    this.pending.set(id, loading);
    this.parsed.set(id, parsed);
    return loading;
  }

  /**
   * Free every loaded layer of one kind (the cortical atlases, or the detail levels) but those `kept`:
   * its geometry and BVHs, materials and border-blend palette, on the GPU and here (ATLAS-10). A
   * layer still loading is left to finish. Showing a released layer again loads it as the first time
   * did, from the HTTP cache or the service worker when they hold it. Returns whether any was freed.
   */
  release(kind: readonly { id: string }[], kept: readonly (string | null)[]): boolean {
    let released = false;
    for (const { id } of kind) {
      const layer = this.layers.get(id);
      if (!layer || kept.includes(id) || this.pending.has(id)) continue;
      this.layers.delete(id);
      disposeScene(layer.scene);
      layer.featherPalette?.dispose();
      released = true;
    }
    return released;
  }

  dispose(): void {
    this.geometryJobs.dispose();
    for (const layer of this.layers.values()) {
      disposeScene(layer.scene);
      layer.featherPalette?.dispose();
    }
    if (this.whiteMatterSurfaces) disposeScene(this.whiteMatterSurfaces.group);
    for (const wedges of this.ribbonWedges.values()) {
      for (const wedge of wedges) {
        wedge.geometry.boundsTree = undefined;
        wedge.geometry.dispose();
      }
    }
    this.ribbonWedges.clear();
    this.layers.clear();
  }

  /** The callback a new download reports to; callers that join it later are added to the same list. */
  private share(key: string, onProgress?: ProgressCallback): ProgressCallback {
    const heard = onProgress ? [onProgress] : [];
    this.listeners.set(key, heard);
    return (event) => {
      for (const listener of heard) listener(event);
    };
  }

  private join(key: string, onProgress?: ProgressCallback): void {
    if (onProgress) this.listeners.get(key)!.push(onProgress);
  }

  private settled(key: string): void {
    this.pending.delete(key);
    this.listeners.delete(key);
  }
}
