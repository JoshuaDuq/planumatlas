import {
  Box3,
  BufferAttribute,
  Color,
  Group,
  Matrix4,
  Mesh,
  Plane,
  SRGBColorSpace,
  Triangle,
  Vector3,
} from 'three';
import type {
  BufferGeometry,
  DataTexture,
  Intersection,
  Material,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  Ray,
  Raycaster,
  Texture,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { HEMISPHERES, SURFACE_COLORS } from '../../types/index.ts';
import type {
  DisplaySettings,
  Hemisphere,
  Manifest,
  ManifestAppearance,
  ModelState,
  Paint,
  Region,
  SurfaceColor,
} from '../../types/index.ts';
import { labelOf } from '../../core/catalog/labels.ts';
import { validateCabNp } from '../../core/catalog/networks.ts';
import type { CabNpPartition } from '../../core/catalog/networks.ts';
import { validateFunctionalRegions } from '../../core/catalog/functional-regions.ts';
import type { FunctionalRegions } from '../../core/catalog/functional-regions.ts';
import { validateNeuropsychDomains } from '../../core/catalog/neuropsych-domains.ts';
import type { NeuropsychDomains, NeurosynthTerms } from '../../core/catalog/neuropsych-domains.ts';
import { validateBoundaryCertainty } from '../../core/catalog/boundary-certainty.ts';
import type { BoundaryCertainty } from '../../core/catalog/boundary-certainty.ts';
import { validateSegmentationAgreement } from '../../core/catalog/segmentation-agreement.ts';
import type { SegmentationAgreement } from '../../core/catalog/segmentation-agreement.ts';
import { validateReceptorFingerprints } from '../../core/catalog/receptor-fingerprints.ts';
import type { ReceptorFingerprints } from '../../core/catalog/receptor-fingerprints.ts';
import { validateStimulationResponses } from '../../core/catalog/stimulation-responses.ts';
import { validateStimulationFtract } from '../../core/catalog/stimulation-ftract.ts';
import type { StimulationFtract } from '../../core/catalog/stimulation-ftract.ts';
import type { StimulationResponses } from '../../core/catalog/stimulation-responses.ts';
import { belongsToDetail, visibilityOf } from '../../core/catalog/visibility.ts';
import { createDissection } from '../../core/state/dissection.ts';
import { fetchAsset } from '../../core/assets/asset-cache.ts';
import {
  ghostColor,
  tissueColor,
  createAnatomicalMaterial,
  fieldDecode,
  stageLegible,
} from '../render/materials.ts';
import type { Appearance, AnatomicalUserData, VisualFieldUniforms } from '../render/materials.ts';
import { addUserMapToSurface, createUserMapUniforms } from '../user-map/overlay.ts';
import type { SurfaceHit } from '../render/picking.ts';
import type { VisualFieldDot, VisualFieldReading } from '../api.ts';
import { VISUAL_RESPONSE_THRESHOLD, predictedResponse } from '../../core/learning/visual-field.ts';
import { GHOST } from '../render/draw-order.ts';
import {
  attachNetworkColors,
  attachTerritoryColors,
  majorityTerritoryColor,
} from '../render/network-colors.ts';
import type { NetworkMetadata } from '../render/network-colors.ts';
import {
  FEATHER_ITEM_SIZE,
  addBorderFeather,
  createFeatherPalette,
  featherBorders,
  writeFeatherPalette,
} from '../render/border-feather.ts';
import {
  addMriSurfaceAppearance,
  createMriUniforms,
  setScanPainted,
} from '../render/mri-material.ts';
import type { MriSurfaceSample, MriUniforms } from '../render/mri-material.ts';
import { ghosted, ghosting } from '../tissues/palette.ts';
import { loadRibbonSources } from '../tissues/solid-assets.ts';
import { createWhiteMatterSurfaces, exposedWhiteMatter } from '../tissues/white-matter-surfaces.ts';
import type { WhiteMatterSurfaces } from '../tissues/white-matter-surfaces.ts';
import type { GeometryCopy, GeometryJob, GeometryReply } from './geometry-worker.ts';
import { combineProgress } from './progress.ts';
import type { ProgressCallback } from './progress.ts';

export { SURFACE_COLORS };

/**
 * What the model reads of the published `manifest.json`: the shared manifest type with the
 * appearance and networks the materials need typed as they read them.
 */
export interface AtlasManifest extends Omit<Manifest, 'appearance' | 'networks'> {
  appearance: Appearance & Pick<ManifestAppearance, 'see_through_opacity'>;
  networks?: NetworkMetadata;
}

/** The part of a glTF loader the model uses: one published file, with download progress. */
export interface GlbLoader {
  loadAsync(file: string, onProgress?: ProgressCallback): Promise<{ scene: Group }>;
}

export interface LoadOptions {
  onProgress?: ProgressCallback;
  /** The detail level to open; the published default when absent. */
  detail?: string;
}

/** One loaded GLB: its scene, the region meshes in it, and the colours their borders blend through. */
export interface Layer {
  scene: Group;
  meshes: AtlasMesh[];
  featherPalette: DataTexture | null;
}

export type AtlasMesh = Mesh<BufferGeometry, MeshPhysicalMaterial>;

type Triple = [number, number, number];

/** The atlas events: `change` (the state), `selectionchange` (the region or null), `loaderror`. */
export interface BrainAtlasEventMap {
  change: CustomEvent<ModelState>;
  selectionchange: CustomEvent<Region | null>;
  loaderror: CustomEvent<Error>;
}

// Reused by intersect. A hover tests every visible mesh, and a fresh list per
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

const ENVELOPES = 'native-envelopes';
const SPINAL_CORD = 'spinal-cord';
// The space left between the medial pair's occipital poles.
const MEDIAL_PAIR_GAP_M = 0.01;

/** A layer id this manifest does not publish; the app tells it from a failed download by this code. */
const unknownLayer = (message: string) =>
  Object.assign(new Error(message), { code: 'unknown-layer' });

function asOptions(onProgressOrOptions?: ProgressCallback | LoadOptions): LoadOptions {
  if (typeof onProgressOrOptions === 'function') return { onProgress: onProgressOrOptions };
  return onProgressOrOptions ?? {};
}

const isSurfaceColor = (mode: string): mode is SurfaceColor =>
  (SURFACE_COLORS as readonly string[]).includes(mode);

function validateManifest(manifest: AtlasManifest): void {
  // Named individually because these fail together for one boring reason — a
  // manifest cached from an earlier deploy — and "expected schema version 1"
  // sends the reader to look at the version, which was never the problem.
  const seeThroughOpacity = manifest.appearance?.see_through_opacity;
  const missing = [
    ['schema_version 1', manifest.schema_version === 1],
    ['atlases', manifest.atlases?.length > 0],
    ['regions', Array.isArray(manifest.regions)],
    ['detail_levels', manifest.detail_levels?.length > 0],
    ['appearance', Boolean(manifest.appearance?.tissue && manifest.appearance?.folds)],
    ['native tissue envelopes', Boolean(manifest.solid_envelopes?.file)],
    [
      'appearance.see_through_opacity',
      !manifest.neuropsych_domains || (seeThroughOpacity! > 0 && seeThroughOpacity! < 1),
    ],
    [
      'anatomy',
      Boolean(manifest.anatomy?.subject && manifest.anatomy?.display_name) &&
        typeof manifest.anatomy.individual === 'boolean',
    ],
  ]
    .filter(([, present]) => !present)
    .map(([field]) => field);
  if (missing.length) {
    throw new Error(
      `Invalid brain model manifest: missing or invalid ${missing.join(', ')}. ` +
        'A stale cached copy will do this; reload ignoring the cache.',
    );
  }
  const ids = new Set<string>();
  for (const region of manifest.regions) {
    if (
      !region.id ||
      ids.has(region.id) ||
      !region.label ||
      !['left', 'right', 'midline'].includes(region.hemisphere) ||
      !['cortex', 'structure', 'non-region', 'tissue-region'].includes(region.kind)
    ) {
      throw new Error(`Invalid or duplicate region metadata: ${region.id}`);
    }
    ids.add(region.id);
  }
}

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

type Bvh = typeof import('three-mesh-bvh');

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
    reply.feathers.forEach((values, at) => {
      meshes[at]!.geometry.setAttribute('_feather', new BufferAttribute(values, FEATHER_ITEM_SIZE));
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
        this.failure = new Error(event.message || 'Geometry work failed', { cause: event });
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

/** A raycast that builds the mesh's BVH first if neither the worker nor an earlier ray has. */
function raycastWithBvh({ MeshBVH, acceleratedRaycast }: Bvh): Mesh['raycast'] {
  return function (this: Mesh, raycaster, intersects) {
    this.geometry.boundsTree ??= new MeshBVH(this.geometry, { indirect: true });
    acceleratedRaycast.call(this, raycaster, intersects);
  };
}

/**
 * A copy that compiles to the same program. `clone` leaves the shader chain behind, and a physical
 * clone defines PHYSICAL, which the anatomical material's standard copy does not.
 */
function programCopy(material: Material): Material {
  const copy = material.clone();
  copy.defines = { ...material.defines };
  copy.onBeforeCompile = material.onBeforeCompile;
  copy.customProgramCacheKey = material.customProgramCacheKey;
  return copy;
}

/** The cortex carries its scan at mid-thickness (`_t1`); every other region reads it inside itself. */
const mriSample = (region: Region): MriSurfaceSample =>
  region.kind === 'cortex' || region.kind === 'non-region' ? 'mid-thickness' : 'inside';

/** Asset-only controller. Add .group to your scene; coordinates remain untouched. */
export class BrainAtlas extends EventTarget {
  static async load(
    manifestUrl: string | URL,
    atlasId?: string,
    onProgressOrOptions?: ProgressCallback | LoadOptions,
  ): Promise<BrainAtlas> {
    const options = asOptions(onProgressOrOptions);
    const url = new URL(manifestUrl, globalThis.location.href);
    const readJson = async <T>(address: string | URL) =>
      JSON.parse(new TextDecoder().decode(await fetchAsset(address))) as T;
    const manifest = await readJson<AtlasManifest>(url.href);
    const [
      cabNp,
      functionalRegions,
      domains,
      terms,
      boundaryCertainty,
      receptors,
      agreement,
      stimulation,
      ftract,
    ] = await Promise.all([
      manifest.cab_np ? readJson<CabNpPartition>(new URL(manifest.cab_np.file, url)) : null,
      manifest.functional_regions
        ? readJson<FunctionalRegions>(new URL(manifest.functional_regions.file, url))
        : null,
      manifest.neuropsych_domains
        ? readJson<NeuropsychDomains>(new URL(manifest.neuropsych_domains.file, url))
        : null,
      manifest.neurosynth_terms
        ? readJson<NeurosynthTerms>(new URL(manifest.neurosynth_terms.file, url))
        : null,
      manifest.boundary_certainty
        ? readJson<BoundaryCertainty>(new URL(manifest.boundary_certainty.file, url))
        : null,
      manifest.receptor_fingerprints
        ? readJson<ReceptorFingerprints>(new URL(manifest.receptor_fingerprints.file, url))
        : null,
      manifest.segmentation_agreement
        ? readJson<SegmentationAgreement>(new URL(manifest.segmentation_agreement.file, url))
        : null,
      manifest.stimulation_responses
        ? readJson<StimulationResponses>(new URL(manifest.stimulation_responses.file, url))
        : null,
      manifest.stimulation_ftract
        ? readJson<StimulationFtract>(new URL(manifest.stimulation_ftract.file, url))
        : null,
    ]);
    // The site serves the layers meshopt-compressed (web/build/meshopt-glb.ts); public/ does not.
    const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const path = new URL('.', url).href;
    const loader: GlbLoader = {
      async loadAsync(file, onProgress) {
        const buffer = await fetchAsset(new URL(file, path), { onProgress });
        return gltf.parseAsync(buffer, path);
      },
    };
    const model = new BrainAtlas(
      manifest,
      loader,
      cabNp,
      functionalRegions,
      domains,
      terms,
      boundaryCertainty,
      receptors,
      agreement,
      stimulation,
      ftract,
    );
    try {
      await model.initialize(atlasId, options);
      return model;
    } catch (error) {
      model.dispose();
      throw error;
    }
  }

  readonly manifest: AtlasManifest;
  loader: GlbLoader;
  readonly group = new Group();
  readonly regions: Map<string, Region>;
  readonly cabNp: CabNpPartition | null;
  readonly functionalRegions: FunctionalRegions | null;
  readonly domains: NeuropsychDomains | null;
  readonly boundaryCertainty: BoundaryCertainty | null;
  readonly receptors: ReceptorFingerprints | null;
  readonly segmentationAgreement: SegmentationAgreement | null;
  readonly stimulation: StimulationResponses | null;
  readonly ftract: StimulationFtract | null;
  /** The visual-field map's uniforms, shared by every cortical material; null without retinotopy. */
  readonly visualField: VisualFieldUniforms | null;
  /** The reader's own map, shared by every cortical material and every cut face. */
  readonly userMap = createUserMapUniforms();
  /** A panel's colours for named regions, every other region in tissue colour; null for none. */
  paint: Paint | null = null;
  readonly layers = new Map<string, Layer>();
  /** The native pial and white envelopes: every one, and the white ones the dissection exposes. */
  envelopes: Mesh[] | null = null;
  whiteMatterSurfaces: WhiteMatterSurfaces | null = null;
  readonly ribbonWedges = new Map<string, Mesh[]>();
  readonly sourceColors = new WeakMap<Mesh, Color>();
  clippingPlanes: Plane[] = [];
  spinalCordLoadState: 'unloaded' | 'loading' | 'ready' | 'error' = 'unloaded';
  spinalCordLoadError: unknown = null;
  private readonly dissection;
  private readonly pending = new Map<string, Promise<unknown>>();
  private readonly geometryJobs = new GeometryJobs();
  /** Who hears each pending download, keyed as `pending` is. */
  private readonly listeners = new Map<string, ProgressCallback[]>();
  private atlasId: string;
  private detailId: string;
  // Pushed in by the sections, which own the plane. Keeping it here is what
  // lets `settings` be the whole display state, so visibility reads one place.
  private cutAtlasId: string | null = null;
  private cutActive = false;
  private internalSystem: string | null = null;
  private internalConstituents = new Set<string>();
  private hemisphere: Hemisphere = 'both';
  /** While the visual-field map is drawn, the right hemisphere's cortex is turned to face the left's way. */
  private medialPairOn = false;
  private pairPlacement: Matrix4 | null = null;
  private cortexVisible = true;
  private cortexOpacity = 1;
  private internalVisible = true;
  private spinalCordVisible = false;
  private spinalCordRequest = 0;
  private surfaceColor: SurfaceColor = 'atlas';
  private mriUniforms: MriUniforms | null = null;
  private selectedId: string | null = null;
  private isolatedId: string | null = null;
  private focused = false;
  private ghostedAround: ReadonlySet<string> | null = null;
  // Separate, so a detail change does not cancel an atlas change still loading, or the reverse.
  private atlasRequest = 0;
  private detailRequest = 0;
  private isDisposed = false;

  constructor(
    manifest: AtlasManifest,
    loader: GlbLoader,
    cabNp: CabNpPartition | null = null,
    functionalRegions: FunctionalRegions | null = null,
    domains: NeuropsychDomains | null = null,
    terms: NeurosynthTerms | null = null,
    boundaryCertainty: BoundaryCertainty | null = null,
    receptors: ReceptorFingerprints | null = null,
    segmentationAgreement: SegmentationAgreement | null = null,
    stimulation: StimulationResponses | null = null,
    ftract: StimulationFtract | null = null,
  ) {
    super();
    validateManifest(manifest);
    this.manifest = manifest;
    this.loader = loader;
    this.group.name = 'Brain atlas';
    this.regions = new Map(manifest.regions.map((region) => [region.id, region]));
    this.cabNp = cabNp && validateCabNp(cabNp, this.regions);
    this.functionalRegions =
      functionalRegions && validateFunctionalRegions(functionalRegions, this.regions);
    this.domains = domains && validateNeuropsychDomains(domains, this.regions, terms);
    this.boundaryCertainty =
      boundaryCertainty && validateBoundaryCertainty(boundaryCertainty, this.regions);
    this.receptors = receptors && validateReceptorFingerprints(receptors, this.regions);
    this.segmentationAgreement =
      segmentationAgreement && validateSegmentationAgreement(segmentationAgreement, this.regions);
    this.stimulation = stimulation && validateStimulationResponses(stimulation, this.regions);
    this.ftract = ftract && validateStimulationFtract(ftract, this.regions);
    this.visualField = manifest.retinotopy
      ? {
          visualMix: { value: 0 },
          visualProbe: { value: new Vector3(0, 0, -1) },
          visualMeasured: { value: manifest.retinotopy.measured_eccentricity_deg },
        }
      : null;
    this.dissection = createDissection(this.regions);
    // What `initialize` is asked for by default; nothing is drawn until it has loaded them.
    this.atlasId = manifest.atlases[0]!.id;
    this.detailId = this.defaultDetail;
  }

  addEventListener<K extends keyof BrainAtlasEventMap>(
    type: K,
    listener: (event: BrainAtlasEventMap[K]) => void,
    options?: AddEventListenerOptions | boolean,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ): void {
    super.addEventListener(type, listener, options);
  }

  removeEventListener<K extends keyof BrainAtlasEventMap>(
    type: K,
    listener: (event: BrainAtlasEventMap[K]) => void,
    options?: EventListenerOptions | boolean,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean,
  ): void {
    super.removeEventListener(type, listener, options);
  }

  /** Whether `dispose` has run; the commands and the app's own checks read it. */
  get disposed(): boolean {
    return this.isDisposed;
  }

  /** The grouped learning overview when published, otherwise the native segmentation. */
  get defaultDetail(): string {
    const levels = this.manifest.detail_levels;
    return (levels.find((level) => level.id === 'learning') ?? levels[0]!).id;
  }

  /**
   * Load what the first frame draws: one cortical atlas and one detail level.
   * The envelopes and the cord wait until something needs them.
   */
  async initialize(
    atlasId: string = this.manifest.atlases[0]!.id,
    onProgressOrOptions?: ProgressCallback | LoadOptions,
  ): Promise<void> {
    const options = asOptions(onProgressOrOptions);
    const atlas = this.manifest.atlases.find((entry) => entry.id === atlasId);
    if (!atlas) throw unknownLayer(`Unknown atlas: ${atlasId}`);
    const detailId = options.detail === undefined ? this.defaultDetail : options.detail;
    const level = this.manifest.detail_levels.find((entry) => entry.id === detailId);
    if (!level) throw unknownLayer(`Unknown detail level: ${detailId}`);
    const progress = combineProgress(['detail', 'atlas'], options.onProgress);
    await Promise.all([
      this.loadLayer(level.id, level.file, progress.track('detail')),
      this.loadLayer(atlas.id, atlas.file, progress.track('atlas')),
    ]);
    this.detailId = level.id;
    this.atlasId = atlas.id;
    this.isolatedId = null;
    this.select(null);
  }

  /**
   * The native pial and white envelopes, downloaded the first time exposed
   * white matter or a cut needs them. Resolves to every
   * envelope mesh; a failed download is retried by the next call. `onProgress`
   * hears the download, whether this call starts it or joins one under way.
   */
  async ensureEnvelopes(onProgress?: ProgressCallback): Promise<Mesh[]> {
    if (this.isDisposed) throw new Error('BrainAtlas has been disposed.');
    if (this.envelopes) return this.envelopes;
    if (this.pending.has(ENVELOPES)) {
      this.join(ENVELOPES, onProgress);
      return this.pending.get(ENVELOPES) as Promise<Mesh[]>;
    }
    const loading = Promise.all([
      this.loader.loadAsync(this.manifest.solid_envelopes.file, this.share(ENVELOPES, onProgress)),
      import('three-mesh-bvh'),
    ])
      .then(async ([{ scene }, bvh]) => {
        let envelopes: Mesh[];
        try {
          if (this.isDisposed) throw new Error('BrainAtlas disposed during tissue loading.');
          envelopes = [];
          scene.traverse((object) => {
            if ((object as Mesh).isMesh) envelopes.push(object as Mesh);
          });
          // Every envelope is a cut source, and the white ones are picked too.
          await this.geometryJobs.bvhs(
            bvh,
            envelopes.map((mesh) => mesh.geometry),
          );
          if (this.isDisposed) throw new Error('BrainAtlas disposed during tissue loading.');
          const surfaces = createWhiteMatterSurfaces(scene, this.manifest.appearance);
          for (const mesh of surfaces.meshes) {
            mesh.raycast = raycastWithBvh(bvh);
            addUserMapToSurface(mesh.material, this.userMap);
            if (this.mriUniforms) {
              addMriSurfaceAppearance(mesh.material, this.mriUniforms, 'inside');
            }
          }
          this.whiteMatterSurfaces = surfaces;
          this.envelopes = envelopes;
          this.group.add(surfaces.group);
        } catch (error) {
          disposeScene(scene);
          throw error;
        }
        this.update();
        return envelopes;
      })
      .finally(() => this.settled(ENVELOPES));
    this.pending.set(ENVELOPES, loading);
    return loading;
  }

  /** Hidden cortex exposes white matter the moment it is hidden; the envelopes follow and repaint. */
  loadEnvelopesBehind(): void {
    this.ensureEnvelopes().catch((error: Error) => {
      if (this.isDisposed) return;
      console.error(error);
      this.dispatchEvent(new CustomEvent('loaderror', { detail: error }));
    });
  }

  /**
   * Every supplemental layer (the cord assembly), downloaded the first time
   * the cord is shown. A failure clears the request so the next one retries.
   * `onProgress` hears the download, whether this call starts it or joins one under way.
   */
  async ensureSpinalCord(onProgress?: ProgressCallback): Promise<void> {
    if (this.isDisposed) throw new Error('BrainAtlas has been disposed.');
    const layers = this.manifest.supplemental_layers ?? [];
    if (!layers.some((layer) => layer.id === 'pam50')) {
      throw new Error('This anatomy does not publish a spinal cord.');
    }
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
      layers.map((layer) => this.loadLayer(layer.id, layer.file, progress.track(layer.id))),
    )
      .then(
        () => {
          this.spinalCordLoadState = 'ready';
          this.spinalCordLoadError = null;
          if (!this.isDisposed) this.update();
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
   * One closed ribbon solid per parcel of an atlas, cut from the envelopes and
   * kept, geometry and BVH alike, for the next cut.
   */
  async ensureRibbonWedges(atlas: string, baseUrl: string | URL): Promise<Mesh[]> {
    if (this.isDisposed) throw new Error('BrainAtlas has been disposed.');
    const cached = this.ribbonWedges.get(atlas);
    if (cached) return cached;
    const key = `ribbon:${atlas}`;
    if (this.pending.has(key)) return this.pending.get(key) as Promise<Mesh[]>;
    const loading = (async () => {
      const envelopes = await this.ensureEnvelopes();
      const [wedges, bvh] = await Promise.all([
        loadRibbonSources(this.manifest, baseUrl, atlas, envelopes),
        import('three-mesh-bvh'),
      ]);
      try {
        if (this.isDisposed) throw new Error('BrainAtlas was disposed during loading.');
        await this.geometryJobs.bvhs(
          bvh,
          wedges.map((wedge) => wedge.geometry),
        );
        if (this.isDisposed) throw new Error('BrainAtlas was disposed during loading.');
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

  async loadLayer(id: string, file: string, onProgress?: ProgressCallback): Promise<Layer> {
    if (this.isDisposed) throw new Error('BrainAtlas has been disposed.');
    const loaded = this.layers.get(id);
    if (loaded) return loaded;
    if (this.pending.has(id)) {
      this.join(id, onProgress);
      return this.pending.get(id) as Promise<Layer>;
    }
    const loading = Promise.all([
      this.loader.loadAsync(file, this.share(id, onProgress)),
      import('three-mesh-bvh'),
    ])
      .then(async ([{ scene }, bvh]) => {
        if (this.isDisposed) {
          disposeScene(scene);
          throw new Error('BrainAtlas was disposed during loading.');
        }
        const raycast = raycastWithBvh(bvh);
        const corticalLayer = this.manifest.atlases.some((atlas) => atlas.id === id);
        const meshes: AtlasMesh[] = [];
        const originalMaterials = new Set<Material>();
        try {
          scene.traverse((object) => {
            const mesh = object as Mesh<BufferGeometry, MeshStandardMaterial>;
            if (!mesh.isMesh) return;
            const region = this.regions.get(mesh.userData['region_id'] as string);
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
            if (this.manifest.networks) {
              attachNetworkColors(mesh.geometry, this.manifest.networks);
            }
            if (this.manifest.arterial_territories) {
              attachTerritoryColors(mesh.geometry, this.manifest.arterial_territories.territories);
            }
            const shown = mesh as unknown as AtlasMesh;
            shown.material = createAnatomicalMaterial(
              mesh,
              region,
              this.manifest.appearance,
              // Every cortical atlas carries the predicted retinotopy on every vertex.
              corticalLayer ? this.visualField : null,
              this.userMap,
            );
            // Drawn before the structures it meets, whichever loaded first (`opaqueOrder`).
            if (corticalLayer) shown.userData['cortical'] = true;
            if (this.mriUniforms) {
              addMriSurfaceAppearance(shown.material, this.mriUniforms, mriSample(region));
            }
            this.sourceColors.set(shown, stageLegible(shown.material.color.clone()));
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
        try {
          if (cortical) await this.geometryJobs.feather(meshes);
          // A detail level's or the cord's structures are cut sources, which the first cut needs whole.
          else await this.geometryJobs.bvhs(bvh, geometries);
          if (this.isDisposed) throw new Error('BrainAtlas was disposed during loading.');
        } catch (error) {
          disposeScene(scene);
          throw error;
        }
        if (cortical) {
          featherPalette = createFeatherPalette(meshes.length);
          for (const mesh of meshes) addBorderFeather(mesh.material, featherPalette);
          this.geometryJobs.bvhs(bvh, geometries).catch((error: Error) => {
            if (this.isDisposed) return;
            console.error(error);
            this.dispatchEvent(new CustomEvent('loaderror', { detail: error }));
          });
        }
        const layer: Layer = { scene, meshes, featherPalette };
        scene.visible = false;
        this.group.add(scene);
        this.layers.set(id, layer);
        return layer;
      })
      .finally(() => this.settled(id));
    this.pending.set(id, loading);
    return loading;
  }

  async setAtlas(id: string, onProgress?: ProgressCallback): Promise<void> {
    const atlas = this.manifest.atlases.find((entry) => entry.id === id);
    if (!atlas) throw unknownLayer(`Unknown atlas: ${id}`);
    const request = ++this.atlasRequest;
    await this.loadLayer(id, atlas.file, onProgress);
    if (request !== this.atlasRequest) return;
    this.atlasId = id;
    // CAB-NP groups one atlas's areas; any other atlas has none to colour.
    if (this.surfaceColor === 'cab-np' && id !== this.cabNp!.atlas) this.surfaceColor = 'atlas';
    this.isolatedId = null;
    this.select(null);
  }

  /**
   * Choose which segmentation of the internal anatomy is drawn.
   *
   * Exactly one level is ever visible: both describe the same anatomy, so
   * drawing them together would put two thalami in the same place. A selection
   * belonging to the level being left is dropped by `update`.
   */
  async setDetail(id: string, onProgress?: ProgressCallback): Promise<void> {
    const level = this.manifest.detail_levels.find((entry) => entry.id === id);
    if (!level) throw unknownLayer(`Unknown detail level: ${id}`);
    const request = ++this.detailRequest;
    await this.loadLayer(id, level.file, onProgress);
    if (request !== this.detailRequest) return;
    this.detailId = id;
    this.internalSystem = null;
    this.internalConstituents = new Set();
    this.isolatedId = null;
    this.update();
  }

  /** What the cut is doing, reported by the sections that own the plane. */
  setCutState({ atlas, active }: { atlas: string | null; active: boolean }): void {
    if (atlas === this.cutAtlasId && active === this.cutActive) return;
    this.cutAtlasId = atlas;
    this.cutActive = active;
    this.update();
  }

  /**
   * The display settings, as a plain object. Cheap: it walks nothing.
   *
   * Kept separate from `state` because the visibility rule needs these, and
   * `state` reads visibleMeshCount -> visibleMeshes -> mesh.visible, which
   * would recurse through the value being computed.
   */
  get settings(): DisplaySettings {
    return {
      atlas: this.atlasId,
      detail: this.detailId,
      internalSystem: this.internalSystem,
      internalConstituents: this.internalConstituents,
      cutAtlas: this.cutAtlasId,
      cutActive: this.cutActive,
      hemisphere: this.hemisphere,
      cortexVisible: this.cortexVisible,
      cortexOpacity: this.cortexOpacity,
      internalVisible: this.internalVisible,
      spinalCordVisible: this.spinalCordVisible,
      surfaceColor: this.surfaceColor,
      paint: this.paint,
      isolatedRegion: this.isolatedId,
      focused: this.focused,
      ghostedAround: this.ghostedAround,
      ...this.dissection.state,
    };
  }

  get state(): ModelState {
    return {
      ...this.settings,
      selectedRegion: this.selectedId === null ? null : (this.regions.get(this.selectedId) ?? null),
      visibleMeshCount: this.visibleMeshes.length,
    };
  }

  get visibleMeshes(): AtlasMesh[] {
    const meshes: AtlasMesh[] = [...this.layers.values()]
      .filter((layer) => layer.scene.visible)
      .flatMap((layer) => layer.meshes.filter((mesh) => mesh.visible));
    if (this.whiteMatterSurfaces) {
      meshes.push(...this.whiteMatterSurfaces.meshes.filter((mesh) => mesh.visible));
    }
    return meshes;
  }

  update(): void {
    // A selection the new settings no longer show is dropped before anything is drawn around it.
    const selected = this.selectedId ? this.regions.get(this.selectedId)! : null;
    const dropped = selected !== null && !this.canSelect(selected);
    if (dropped) {
      this.selectedId = null;
      this.focused = false;
    }
    const settings = this.settings;
    const { appearance } = this.manifest;
    const ghostState = {
      ...settings,
      selectedRegion: this.selectedId ? this.regions.get(this.selectedId)! : null,
    };
    const ghosts = ghosting(settings);
    // Focus sees through the cortex; a route's or Tracts' grey cortex keeps the reader's opacity.
    const focusOpacity = this.focused ? appearance.see_through_opacity! : 1;
    if (
      !this.whiteMatterSurfaces &&
      !this.pending.has(ENVELOPES) &&
      exposedWhiteMatter(settings, this.regions).size
    ) {
      this.loadEnvelopesBehind();
    }
    this.whiteMatterSurfaces?.update(
      { ...settings, cortexOpacity: Math.min(settings.cortexOpacity, focusOpacity) },
      this.regions,
      this.clippingPlanes,
      ghosts,
    );
    const paint = this.paint;
    // A tab's paint is drawn over the scan, which stays wherever nothing is painted.
    const mri = this.surfaceColor === 'mri';
    if (this.mriUniforms) this.mriUniforms.scanEnabled.value = mri;
    for (const [id, layer] of this.layers) {
      layer.scene.visible =
        id === this.detailId ||
        id === this.atlasId ||
        (this.manifest.supplemental_layers ?? []).some((entry) => entry.id === id);
      const corticalLayer = this.manifest.atlases.some((atlas) => atlas.id === id);
      for (const mesh of layer.meshes) {
        const region = this.regions.get(mesh.userData['region_id'] as string)!;
        const cortex = region.kind === 'cortex' || region.kind === 'non-region';
        if (corticalLayer && region.hemisphere === 'right') {
          mesh.updateMatrix();
          if (this.medialPairOn) mesh.matrix.premultiply(this.pairPlacement!);
        }
        // A ghost is grey at the see-through opacity; what it holds in colour is opaque.
        const ghost = ghosted(region.id, ghostState);
        const cabNpNetwork =
          this.surfaceColor === 'cab-np' && !paint ? this.cabNp!.regions[region.id] : null;
        // The cortex carries its territories per vertex; a deep structure is drawn whole, as its cut is.
        const territory =
          this.surfaceColor === 'territory' && !paint && !cortex
            ? majorityTerritoryColor(region, this.manifest.arterial_territories!.territories)
            : null;
        mesh.visible = visibilityOf(region, settings).visible;
        const material = mesh.material;
        const userData = material.userData as AnatomicalUserData;
        if (cortex) {
          // Only tissue colour carries the T1 brightness it was tuned against;
          // under a published palette that modulation would distort the datum.
          userData.tissueVariation.value =
            this.surfaceColor === 'tissue' && !paint && !ghost
              ? appearance.intensity.surface_strength
              : 0;
          if (userData.networkMix) {
            userData.networkMix.value = this.surfaceColor === 'network' && !paint && !ghost ? 1 : 0;
          }
          if (userData.territoryMix) {
            userData.territoryMix.value =
              this.surfaceColor === 'territory' && !paint && !ghost ? 1 : 0;
          }
        }
        if (material.clippingPlanes !== this.clippingPlanes) {
          material.clippingPlanes = this.clippingPlanes;
          material.needsUpdate = true;
        }
        // Under network colour this shows only where no network reaches: the
        // medial wall keeps the tissue it always had.
        material.color.copy(this.sourceColors.get(mesh)!);
        const painted = paint?.colors.get(region.id);
        setScanPainted(material, Boolean(painted));
        if (painted) {
          material.color.setRGB(
            painted[0] / 255,
            painted[1] / 255,
            painted[2] / 255,
            SRGBColorSpace,
          );
        } else if (paint) {
          material.color.set(tissueColor(region, appearance.tissue));
        } else if (cabNpNetwork) {
          // Published sRGB, converted as the per-vertex network colours are.
          const [r, g, b] = this.cabNp!.colors[cabNpNetwork]!;
          material.color.setRGB(r / 255, g / 255, b / 255, SRGBColorSpace);
        } else if (territory) {
          material.color.setRGB(
            territory[0] / 255,
            territory[1] / 255,
            territory[2] / 255,
            SRGBColorSpace,
          );
        } else if (this.surfaceColor !== 'atlas' || region.kind === 'non-region') {
          material.color.set(tissueColor(region, appearance.tissue));
        }
        // Selection is drawn by the outline pass. Tinting the material would
        // alter a region's atlas colour, which is the datum being displayed.
        // A painted area is what the paint is about, so a see-through cortex leaves it opaque, and
        // the unpainted cortex around it gives the context. What a ghost holds is opaque for the same reason.
        if (ghost) {
          ghostColor(region, appearance.tissue, material.color);
          material.opacity = cortex
            ? Math.min(focusOpacity, this.cortexOpacity)
            : appearance.see_through_opacity!;
        } else {
          material.opacity = cortex && !painted && !ghosts ? this.cortexOpacity : 1;
        }
        mesh.userData['ghost'] = ghost ? (cortex ? GHOST.cortex : GHOST.deep) : GHOST.none;
        const transparent = material.opacity < 1;
        if (material.transparent !== transparent) {
          material.transparent = transparent;
          material.needsUpdate = true;
        }
        material.depthWrite = !transparent || mesh.userData['ghost'] === GHOST.deep;
      }
      // Under the scan only a painted parcel shows its colour, so only it is blended into.
      if (layer.featherPalette) {
        writeFeatherPalette(
          layer.featherPalette,
          layer.meshes,
          (mesh) =>
            mesh.visible && (!mri || Boolean(paint?.colors.has(mesh.userData['region_id']))),
        );
      }
    }
    if (dropped) this.dispatchEvent(new CustomEvent('selectionchange', { detail: null }));
    this.dispatchEvent(new CustomEvent('change', { detail: this.state }));
  }

  /**
   * Raycaster must already be configured with the host camera and pointer.
   *
   * Meshes are tested from the front of the ray. Once a hit is in hand, a box
   * that starts beyond it cannot hold a closer triangle, so the rest of the
   * brain is not walked. A clipped hit does not count: the retained face
   * behind it still has to be found.
   */
  intersect(raycaster: Raycaster): Intersection<AtlasMesh> | null {
    this.group.updateMatrixWorld(true);
    return this.nearestHit(raycaster, this.visibleMeshes);
  }

  nearestHit(raycaster: Raycaster, meshes: readonly AtlasMesh[]): Intersection<AtlasMesh> | null {
    const planes = this.clippingPlanes;
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

  pick(raycaster: Raycaster): Region | null {
    const hit = this.intersect(raycaster);
    if (!hit || hit.object.userData['kind'] === 'non-region') return null;
    return this.regions.get(hit.object.userData['region_id'] as string) ?? null;
  }

  /**
   * The mean of the region's voxel centres (a cortical parcel's, in the ribbon), in surface RAS
   * millimetres; null for an unknown id or a non-region. It can lie outside a curved region.
   */
  centroidOf(regionId: string | null): Triple | null {
    return this.placement(regionId, 'centroid_ras_mm');
  }

  /** The region's own voxel nearest its centroid: where the linked MRI and a cut go to show it. */
  anchorOf(regionId: string | null): Triple | null {
    return this.placement(regionId, 'anchor_ras_mm');
  }

  private placement(
    regionId: string | null,
    field: 'centroid_ras_mm' | 'anchor_ras_mm',
  ): Triple | null {
    const region = regionId ? this.regions.get(regionId) : undefined;
    if (!region || region.kind === 'non-region') return null;
    const value = region[field];
    if (!value) throw new Error(`The manifest places no ${field} for ${regionId}.`);
    return [...value];
  }

  setClippingPlanes(planes: Plane[]): void {
    if (
      !Array.isArray(planes) ||
      planes.some(
        (plane) =>
          !plane.isPlane ||
          !Number.isFinite(plane.constant) ||
          !plane.normal.toArray().every(Number.isFinite) ||
          Math.abs(plane.normal.length() - 1) > 1e-6,
      )
    ) {
      throw new Error('Clipping requires normalized, finite Three.js planes.');
    }
    this.clippingPlanes = planes;
    this.update();
  }

  /**
   * Whether a region can be the selection right now.
   *
   * The shared rule answers it, because a region may be drawn as geometry, as
   * a cut label, or both, and `settings` now carries all three displays.
   *
   * `select` and `update` must ask the same question. Two answers would let a
   * selection be accepted and then dropped again on the same call, which is
   * silent by construction.
   */
  canSelect(region: Region): boolean {
    if (region.supplemental && !this.layers.has(region.atlas!)) return false;
    return visibilityOf(region, this.settings).visible;
  }

  select(id: string | null): void {
    if (id !== null) {
      const region = this.regions.get(id);
      if (!region) throw new Error(`Unknown region: ${id}`);
      if (region.kind === 'non-region') throw new Error(`Cannot select a non-region: ${id}`);
      if (!this.canSelect(region)) throw new Error(`Region is not visible: ${id}`);
    }
    this.selectedId = id;
    // Focus follows the selection from pick to pick, and ends with it.
    if (id === null) this.focused = false;
    this.update();
    this.dispatchEvent(new CustomEvent('selectionchange', { detail: this.state.selectedRegion }));
  }

  setInternalSystem(system: string | null): void {
    if (
      system !== null &&
      !this.manifest.regions.some(
        (region) =>
          region.kind === 'structure' &&
          belongsToDetail(region, this.detailId) &&
          labelOf(region, 'en')!.group === system,
      )
    ) {
      throw new Error(`Unknown internal anatomy system: ${system}`);
    }
    this.internalSystem = system;
    this.internalConstituents = new Set(
      this.manifest.regions
        .filter((region) => region.atlas === 'learning' && region.system_names!['en'] === system)
        .flatMap((region) => region.constituent_regions ?? []),
    );
    this.isolatedId = null;
    this.update();
  }

  setHemisphere(hemisphere: Hemisphere): void {
    if (!HEMISPHERES.includes(hemisphere)) {
      throw new Error(`Invalid hemisphere: ${hemisphere}`);
    }
    this.hemisphere = hemisphere;
    this.isolatedId = null;
    this.update();
  }

  setCortexVisible(visible: boolean): void {
    if (typeof visible !== 'boolean') throw new TypeError('Cortex visibility must be boolean.');
    this.cortexVisible = visible;
    this.isolatedId = null;
    this.update();
  }

  setCortexOpacity(opacity: number): void {
    if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
      throw new RangeError('Cortex opacity must be between 0 and 1.');
    }
    this.cortexOpacity = opacity;
    this.update();
  }

  setInternalVisible(visible: boolean): void {
    if (typeof visible !== 'boolean') {
      throw new TypeError('Internal anatomy visibility must be boolean.');
    }
    this.internalVisible = visible;
    this.isolatedId = null;
    this.update();
  }

  async setSpinalCordVisible(visible: boolean, onProgress?: ProgressCallback): Promise<void> {
    if (typeof visible !== 'boolean') {
      throw new TypeError('Spinal cord visibility must be boolean.');
    }
    if (this.isDisposed) throw new Error('BrainAtlas has been disposed.');
    const request = ++this.spinalCordRequest;
    if (visible) {
      await this.ensureSpinalCord(onProgress);
      if (request !== this.spinalCordRequest) return;
    }
    this.spinalCordVisible = visible;
    this.isolatedId = null;
    this.update();
  }

  setSurfaceColor(mode: string): void {
    if (!isSurfaceColor(mode)) {
      throw new TypeError(`Unknown surface colour: ${mode}`);
    }
    if (mode === 'mri' && !this.mriUniforms) {
      throw new Error('MRI must load before selecting MRI appearance.');
    }
    if (mode === 'network' && !this.manifest.networks) {
      throw new Error('This model carries no network layer.');
    }
    if (mode === 'territory' && !this.manifest.arterial_territories) {
      throw new Error('This model carries no arterial territories.');
    }
    if (mode === 'cab-np') {
      if (!this.cabNp) throw new Error('This model carries no CAB-NP partition.');
      if (this.atlasId !== this.cabNp.atlas) {
        throw new Error(`CAB-NP colours ${this.cabNp.atlas} areas; show that atlas first.`);
      }
    }
    this.surfaceColor = mode;
    this.update();
  }

  /**
   * Draw `{ id, colors }` over the surface colour: each region in `colors` takes its sRGB
   * bytes, every other region its tissue colour. A paint is replaced whole, by id; null lifts it.
   */
  setPaint(paint: Paint | null): void {
    if (paint !== null && (typeof paint?.id !== 'string' || !(paint.colors instanceof Map))) {
      throw new TypeError('A paint needs an id and a Map of region colours.');
    }
    if ((paint?.id ?? null) === (this.paint?.id ?? null)) return;
    this.paint = paint;
    this.update();
  }

  /**
   * Draw the predicted retinotopy over the cortex, with the dot or without; null gives the cortex its
   * colours back. While it is drawn the hemispheres are a medial pair (`medialPair`). Throws without
   * retinotopy or for a bad dot.
   */
  showVisualField(map: { dot: VisualFieldDot | null } | null): void {
    const uniforms = this.visualField;
    if (!uniforms) throw new Error('This anatomy publishes no retinotopy.');
    const dot = map?.dot ?? null;
    if (dot && !([dot.x, dot.y].every(Number.isFinite) && dot.radius >= 0)) {
      throw new RangeError(`A visual-field dot needs a finite centre and a radius ≥ 0.`);
    }
    uniforms.visualMix.value = map ? 1 : 0;
    uniforms.visualProbe.value.set(dot?.x ?? 0, dot?.y ?? 0, dot ? dot.radius : -1);
    if (Boolean(map) !== this.medialPairOn) {
      this.pairPlacement ??= this.medialPairPlacement();
      this.medialPairOn = Boolean(map);
      this.update();
    }
  }

  /**
   * Both medial walls in sight at once: the right hemisphere's cortex turned half a turn about the
   * superior axis, set behind the left's occipital pole, the poles 10 mm apart. A rotation, never a
   * mirror, so each hemisphere keeps its own handedness.
   */
  get medialPair(): boolean {
    return this.medialPairOn;
  }

  private medialPairPlacement(): Matrix4 {
    const box = new Box3();
    for (const atlas of this.manifest.atlases) {
      for (const mesh of this.layers.get(atlas.id)?.meshes ?? []) {
        if (this.regions.get(mesh.userData['region_id'] as string)!.hemisphere !== 'left') continue;
        box.expandByObject(mesh);
      }
    }
    if (box.isEmpty()) throw new Error('No left cortex is loaded to pair the hemispheres on.');
    const behind = 2 * box.max.z + MEDIAL_PAIR_GAP_M;
    return new Matrix4().makeRotationY(Math.PI).setPosition(0, 0, behind);
  }

  /**
   * The world box of the drawn cortex the dot is predicted to drive at least as strongly as the map
   * colours (`VISUAL_RESPONSE_THRESHOLD`), each vertex read as the shader reads it; null where it
   * drives none.
   */
  visualFieldActivation(dot: VisualFieldDot): Box3 | null {
    if (!this.visualField) throw new Error('This anatomy publishes no retinotopy.');
    const ranges = this.manifest.appearance.field_ranges;
    const [xLow, xSpan] = fieldDecode(ranges, '_FIELD_X');
    const [yLow, ySpan] = fieldDecode(ranges, '_FIELD_Y');
    const [sigmaLow, sigmaSpan] = fieldDecode(ranges, '_PRF_SIGMA');
    const box = new Box3();
    const point = new Vector3();
    for (const mesh of this.visibleMeshes) {
      const { geometry } = mesh;
      const area = geometry.getAttribute('_visual_area');
      if (!area) continue;
      const [x, y, sigma] = ['_field_x', '_field_y', '_prf_sigma'].map((name) =>
        geometry.getAttribute(name)!,
      );
      const position = geometry.getAttribute('position');
      mesh.updateWorldMatrix(true, false);
      for (let vertex = 0; vertex < area.count; vertex += 1) {
        if (area.getX(vertex) < 0.5) continue;
        const s = sigma!.getX(vertex) * sigmaSpan + sigmaLow;
        const distance = Math.hypot(
          x!.getX(vertex) * xSpan + xLow - dot.x,
          y!.getX(vertex) * ySpan + yLow - dot.y,
        );
        if (distance > dot.radius + 6 * s) continue;
        if (predictedResponse(distance, dot.radius, s) < VISUAL_RESPONSE_THRESHOLD) continue;
        box.expandByPoint(
          point.fromBufferAttribute(position, vertex).applyMatrix4(mesh.matrixWorld),
        );
      }
    }
    return box.isEmpty() ? null : box;
  }

  /**
   * The current atlas's region of a hemisphere with the most predicted V1 vertices inside the measured
   * eccentricity: where the map is measured rather than extrapolated, near the occipital pole.
   */
  visualFieldRegion(hemisphere: 'left' | 'right'): string {
    const layer = this.layers.get(this.atlasId);
    const published = this.manifest.retinotopy;
    if (!this.visualField || !published || !layer) {
      throw new Error('No cortical atlas with retinotopy is drawn.');
    }
    const ranges = this.manifest.appearance.field_ranges;
    const [xLow, xSpan] = fieldDecode(ranges, '_FIELD_X');
    const [yLow, ySpan] = fieldDecode(ranges, '_FIELD_Y');
    const measured = published.measured_eccentricity_deg;
    let best: { id: string; count: number } | null = null;
    for (const mesh of layer.meshes) {
      const region = this.regions.get(mesh.userData['region_id'] as string)!;
      if (region.kind !== 'cortex' || region.hemisphere !== hemisphere) continue;
      const { geometry } = mesh;
      const [area, x, y] = ['_visual_area', '_field_x', '_field_y'].map((name) =>
        geometry.getAttribute(name)!,
      );
      let count = 0;
      for (let vertex = 0; vertex < area!.count; vertex += 1) {
        const eccentricity = Math.hypot(
          x!.getX(vertex) * xSpan + xLow,
          y!.getX(vertex) * ySpan + yLow,
        );
        if (area!.getX(vertex) === 1 && eccentricity <= measured) count += 1;
      }
      if (count > (best?.count ?? 0)) best = { id: region.id, count };
    }
    if (!best) throw new Error(`No ${hemisphere} region holds predicted V1.`);
    return best.id;
  }

  /**
   * What the predicted retinotopy says where a ray met a cortical mesh, read as the map draws it:
   * only the triangle's V1–V3 corners are interpolated, and a point less than half in V1–V3 has
   * no reading. Null off the cortex.
   */
  visualFieldAt(hit: SurfaceHit): VisualFieldReading | null {
    const mesh = hit.object as AtlasMesh | undefined;
    const area = mesh?.geometry?.getAttribute('_visual_area');
    if (!this.visualField || !mesh || !hit.face || !area) return null;
    const { a, b, c } = hit.face;
    const position = mesh.geometry.getAttribute('position');
    const local = mesh.worldToLocal(hit.point.clone());
    const weights = Triangle.getBarycoord(
      local,
      new Vector3().fromBufferAttribute(position, a),
      new Vector3().fromBufferAttribute(position, b),
      new Vector3().fromBufferAttribute(position, c),
      new Vector3(),
    );
    if (!weights) return null;
    const corners = [a, b, c];
    const inside = corners.map((corner, k) =>
      area.getX(corner) >= 0.5 ? weights.getComponent(k) : 0,
    );
    const share = inside[0]! + inside[1]! + inside[2]!;
    if (share < 0.5) return null;
    const ranges = this.manifest.appearance.field_ranges;
    const read = (name: string, attribute: string): number => {
      const [low, span] = fieldDecode(ranges, name);
      const values = mesh.geometry.getAttribute(attribute);
      return (
        corners.reduce(
          (sum, corner, k) => sum + inside[k]! * (values.getX(corner) * span + low),
          0,
        ) / share
      );
    };
    const code = Math.round(
      corners.reduce((sum, corner, k) => sum + inside[k]! * area.getX(corner), 0) / share,
    );
    const name = this.manifest.retinotopy!.areas.find((entry) => entry.code === code)?.name;
    if (!name) throw new Error(`Visual-area code ${code} is not published.`);
    const region = this.regions.get(mesh.userData['region_id'] as string)!;
    return {
      x: read('_FIELD_X', '_field_x'),
      y: read('_FIELD_Y', '_field_y'),
      sigma: read('_PRF_SIGMA', '_prf_sigma'),
      area: name as VisualFieldReading['area'],
      hemisphere: region.hemisphere as VisualFieldReading['hemisphere'],
    };
  }

  setMriAnatomy(anatomy: { mriUniforms: MriUniforms } | null): void {
    if (!anatomy) throw new Error('MRI anatomy has not loaded.');
    if (this.mriUniforms === anatomy.mriUniforms) return;
    if (this.mriUniforms) throw new Error('MRI anatomy is already attached.');
    this.mriUniforms = anatomy.mriUniforms;
    // Envelopes that load later take it as they arrive.
    for (const mesh of this.whiteMatterSurfaces?.meshes ?? []) {
      addMriSurfaceAppearance(mesh.material, this.mriUniforms, 'inside');
    }
    for (const layer of this.layers.values()) {
      for (const mesh of layer.meshes) {
        addMriSurfaceAppearance(mesh.material, this.mriUniforms, this.mriSampleOf(mesh));
      }
    }
  }

  /**
   * Detached meshes on the loaded geometry, in a copy of each kind of material as Focus draws it
   * (see-through) and, until a scan is attached, as the T1 MRI colour does: compiled ahead, neither
   * pays for its programs in the frame that first shows it. Never disposed: disposing a material
   * releases the programs it compiled.
   */
  programSamples(): Mesh[] {
    const scan = createMriUniforms({
      texture: null,
      worldToVoxel: new Matrix4(),
      volume: { shape: [1, 1, 1] },
    });
    return this.programKinds().flatMap((kind) => {
      const { geometry, material } = kind;
      const seeThrough = programCopy(material);
      seeThrough.transparent = true;
      const samples = [new Mesh(geometry, seeThrough)];
      if (!this.mriUniforms) {
        const scanned = programCopy(material);
        addMriSurfaceAppearance(scanned, scan, this.mriSampleOf(kind));
        samples.push(new Mesh(geometry, scanned));
      }
      return samples;
    });
  }

  /**
   * Copies of each kind of material clipped as a cut draws it, opaque and see-through, compiled
   * ahead like `programSamples`: three compiles a see-through double-sided material as two passes.
   */
  cutProgramSamples(): Mesh[] {
    const planes = [new Plane()];
    return this.programKinds().flatMap(({ geometry, material }) =>
      [false, true].map((transparent) => {
        const clipped = programCopy(material);
        clipped.clippingPlanes = planes;
        clipped.transparent = transparent;
        return new Mesh(geometry, clipped);
      }),
    );
  }

  /** Exposed white matter carries no region of its own; it reads the white matter inside it. */
  private mriSampleOf(mesh: Mesh): MriSurfaceSample {
    if (this.whiteMatterSurfaces?.meshes.includes(mesh as never)) return 'inside';
    return mriSample(this.regions.get(mesh.userData['region_id'] as string)!);
  }

  /**
   * One loaded mesh per kind of material the surfaces draw with. White matter is a kind of its
   * own: its clearcoat is not in the key it shares with the structures.
   */
  private programKinds(): Mesh<BufferGeometry, Material>[] {
    const kinds = new Map<string, Mesh<BufferGeometry, Material>>();
    const sources: [string, Mesh<BufferGeometry, Material>[]][] = [
      ['layer', [...this.layers.values()].flatMap((layer) => layer.meshes)],
      ['white-matter', this.whiteMatterSurfaces?.meshes ?? []],
    ];
    for (const [source, meshes] of sources) {
      for (const mesh of meshes) {
        const { material } = mesh;
        const kind = [source, material.type, material.customProgramCacheKey(), material.side];
        kinds.set(kind.join('|'), mesh);
      }
    }
    return [...kinds.values()];
  }

  isolate(): void {
    if (!this.selectedId) throw new Error('Select a region before isolating.');
    this.isolatedId = this.selectedId;
    this.update();
  }

  /** Release isolation on its own, leaving every other setting alone. */
  clearIsolation(): void {
    this.isolatedId = null;
    this.update();
  }

  setFocused(focused: boolean): void {
    if (typeof focused !== 'boolean') throw new TypeError('Focus must be boolean.');
    if (focused && !this.selectedId) throw new Error('Select a region before focusing.');
    if (focused && this.manifest.appearance.see_through_opacity === undefined) {
      throw new Error('This build publishes no see-through opacity.');
    }
    this.focused = focused;
    this.update();
  }

  /** Grey every region but these and their constituents, the selection and a paint's; null ends it. */
  ghostAround(ids: readonly string[] | null): void {
    if (ids !== null) {
      if (this.manifest.appearance.see_through_opacity === undefined) {
        throw new Error('This build publishes no see-through opacity.');
      }
      for (const id of ids) if (!this.regions.has(id)) throw new Error(`Unknown region: ${id}`);
    }
    this.ghostedAround =
      ids &&
      new Set(ids.flatMap((id) => [id, ...(this.regions.get(id)!.constituent_regions ?? [])]));
    this.update();
  }

  get dissectionSelection(): { selectedId: string | null; isolatedId: string | null } {
    return { selectedId: this.selectedId, isolatedId: this.isolatedId };
  }

  hideRegions(ids: string[]): void {
    if (!this.dissection.hide(ids, this.dissectionSelection)) return;
    this.releaseHiddenIsolation();
    this.update();
  }

  showRegions(ids: string[]): void {
    if (this.dissection.show(ids, this.dissectionSelection)) this.update();
  }

  restoreHiddenRegions(): void {
    if (this.dissection.restore(this.dissectionSelection)) this.update();
  }

  undoDissection(): void {
    const previous = this.dissection.undo();
    if (!previous) return;
    const { isolatedId, selectedId } = previous as {
      isolatedId: string | null;
      selectedId: string | null;
    };
    this.isolatedId = null;
    if (isolatedId && this.canSelect(this.regions.get(isolatedId)!)) {
      this.isolatedId = isolatedId;
    }
    const selected = selectedId === null ? undefined : this.regions.get(selectedId);
    this.select(selected && this.canSelect(selected) ? selected.id : null);
  }

  loadHiddenRegions(ids: string[]): void {
    this.dissection.load(ids);
    this.releaseHiddenIsolation();
    this.update();
  }

  reset(): void {
    this.spinalCordRequest += 1;
    this.dissection.reset();
    this.clippingPlanes = [];
    this.internalSystem = null;
    this.internalConstituents = new Set();
    this.hemisphere = 'both';
    this.cortexVisible = true;
    this.cortexOpacity = 1;
    this.internalVisible = true;
    this.spinalCordVisible = false;
    this.surfaceColor = 'atlas';
    this.isolatedId = null;
    this.ghostedAround = null;
    this.select(null);
  }

  dispose(): void {
    this.isDisposed = true;
    this.geometryJobs.dispose();
    this.spinalCordRequest += 1;
    this.atlasRequest += 1;
    this.detailRequest += 1;
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
    this.group.removeFromParent();
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

  /** A region that has just been hidden cannot stay isolated: nothing would be left to see. */
  private releaseHiddenIsolation(): void {
    if (this.isolatedId && this.dissection.state.hiddenRegions.has(this.isolatedId)) {
      this.isolatedId = null;
    }
  }
}
