import { Group, Matrix4 } from 'three';
import type { Box3, Color, Intersection, Mesh, Plane, Quaternion, Raycaster } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { HEMISPHERES, SURFACE_COLORS } from '../../types/index.ts';
import type {
  DisplaySettings,
  Hemisphere,
  LoadProgress,
  ModelState,
  Paint,
  Region,
  SurfaceColor,
  Vec3,
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
import { validateFunctionalConnectivity } from '../../core/catalog/functional-connectivity.ts';
import type { FunctionalConnectivity } from '../../core/catalog/functional-connectivity.ts';
import { validateDisorderEffects } from '../../core/catalog/disorder-effects.ts';
import type { DisorderEffects } from '../../core/catalog/disorder-effects.ts';
import type { StimulationFtract } from '../../core/catalog/stimulation-ftract.ts';
import type { StimulationResponses } from '../../core/catalog/stimulation-responses.ts';
import { belongsToDetail, visibilityOf } from '../../core/catalog/visibility.ts';
import { createDissection } from '../../core/state/dissection.ts';
import { fetchAsset } from '../../core/assets/asset-cache.ts';
import type { VisualFieldUniforms } from '../render/materials.ts';
import type { MriUniforms } from '../render/mri-material.ts';
import { drawsSurfaceMap, surfaceMapRegionAt } from '../tissues/map-surface.ts';
import type { SurfaceMap } from '../tissues/map-surface.ts';
import type { SurfaceHit } from '../render/picking.ts';
import type { UserMapUniforms } from '../user-map/overlay.ts';
import type { NamedVisualArea, VisualFieldDot, VisualFieldReading } from '../api.ts';
import { exposedWhiteMatter } from '../tissues/white-matter-surfaces.ts';
import type { WhiteMatterSurfaces } from '../tissues/white-matter-surfaces.ts';
import { ModelLayers, unknownLayer } from './layers.ts';
import type { AtlasMesh, GlbLoader, Layer } from './layers.ts';
import { fetchManifest, validateManifest } from './manifest.ts';
import type { AtlasManifest } from './manifest.ts';
import { hitRegion, inSight, nearestHit } from './picking.ts';
import type { FacingScene, StageHit } from './picking.ts';
import { Placement } from './placement.ts';
import { combineProgress } from './progress.ts';
import type { ProgressCallback } from './progress.ts';
import { SurfaceMaterials } from './surface-materials.ts';
import {
  assertSurfaceColor,
  drawLayers,
  drawWhiteMatterAndScan,
  surfaceColorOn,
  visibleMeshes,
} from './visibility.ts';
import {
  showVisualAreaBorders,
  visualAreaAt,
  visualFieldActivation,
  visualFieldAt,
  visualFieldRegion,
} from './visual-field.ts';

export { SURFACE_COLORS };
export type { AtlasManifest, AtlasMesh, GlbLoader, Layer };

export interface LoadOptions {
  /**
   * Both first layers' downloads together until the cortex is shown; from then on the internal
   * anatomy's alone, marked `internal`.
   */
  onProgress?: ProgressCallback;
  /** The detail level to open; the published default when absent. */
  detail?: string;
  /** The cortex is in and shown, its borders not yet blended; the internal anatomy may still be loading. */
  onCortex?: (model: BrainAtlas) => void;
  /** The shown cortex now has its border blend; the internal anatomy is not yet shown. */
  onBlended?: () => void;
}

type Triple = [number, number, number];

/** The atlas events: `change` (the state), `selectionchange` (the region or null), `loaderror`. */
export interface BrainAtlasEventMap {
  change: CustomEvent<ModelState>;
  selectionchange: CustomEvent<Region | null>;
  loaderror: CustomEvent<Error>;
}

function asOptions(onProgressOrOptions?: ProgressCallback | LoadOptions): LoadOptions {
  if (typeof onProgressOrOptions === 'function') return { onProgress: onProgressOrOptions };
  return onProgressOrOptions ?? {};
}

/**
 * Asset-only controller. Add .group to your scene; coordinates remain untouched.
 *
 * It holds the display state and answers for the model; the work is in its seams: the layers it
 * loads and releases (`layers.ts`), picking (`picking.ts`), what is shown and in which colour
 * (`visibility.ts`), the materials and their programs (`surface-materials.ts`), and where each
 * surface is placed (`placement.ts`).
 */
export class BrainAtlas extends EventTarget {
  static async load(
    manifestUrl: string | URL,
    atlasId?: string,
    onProgressOrOptions?: ProgressCallback | LoadOptions,
  ): Promise<BrainAtlas> {
    const options = asOptions(onProgressOrOptions);
    const url = new URL(manifestUrl, globalThis.location.href);
    const { manifest, companions } = await fetchManifest(url);
    // The site serves the layers meshopt-compressed (web/build/meshopt-glb.ts); public/ does not.
    const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const path = new URL('.', url).href;
    const loader: GlbLoader = {
      async loadAsync(file, onProgress, priority) {
        const buffer = await fetchAsset(new URL(file, path), { onProgress, priority });
        return gltf.parseAsync(buffer, path);
      },
    };
    const model = new BrainAtlas(manifest, loader, ...companions);
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
  readonly connectivity: FunctionalConnectivity | null;
  readonly disorders: DisorderEffects | null;
  /** A panel's colours for named regions, every other region in tissue colour; null for none. */
  paint: Paint | null = null;
  clippingPlanes: Plane[] = [];
  private readonly materials: SurfaceMaterials;
  private readonly layerStore: ModelLayers;
  private readonly placement: Placement;
  private readonly dissection;
  private atlasId: string;
  private detailId: string;
  // Pushed in by the sections, which own the plane. Keeping it here is what
  // lets `settings` be the whole display state, so visibility reads one place.
  private cutAtlasId: string | null = null;
  private cutActive = false;
  private internalSystem: string | null = null;
  private internalConstituents = new Set<string>();
  private hemisphere: Hemisphere = 'both';
  private cortexVisible = true;
  private cortexOpacity = 1;
  private internalVisible = true;
  private spinalCordVisible = false;
  private spinalCordRequest = 0;
  private surfaceColor: SurfaceColor = 'atlas';
  private selectedId: string | null = null;
  private isolatedId: string | null = null;
  private focused = false;
  private ghostedAround: ReadonlySet<string> | null = null;
  /** The atlas and the detail level shown before the ones shown now: kept, the rest released (ATLAS-10). */
  private previousAtlas: string | null = null;
  private previousDetail: string | null = null;
  // Separate, so a detail change does not cancel an atlas change still loading, or the reverse.
  private atlasRequest = 0;
  private detailRequest = 0;
  private isDisposed = false;
  /** Where the thickness files are, from its first download, and the atlas layers that carry it. */
  private thickness: { base: string | URL; carried: WeakSet<Layer> } | null = null;

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
    connectivity: FunctionalConnectivity | null = null,
    disorders: DisorderEffects | null = null,
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
    this.connectivity = connectivity && validateFunctionalConnectivity(connectivity, this.regions);
    this.disorders = disorders && validateDisorderEffects(disorders, this.regions);
    this.materials = new SurfaceMaterials(manifest, this.regions);
    const layerStore = new ModelLayers(this, this.materials);
    this.layerStore = layerStore;
    this.placement = new Placement({
      manifest,
      regions: this.regions,
      layers: layerStore.layers,
      get whiteMatterSurfaces() {
        return layerStore.whiteMatterSurfaces;
      },
      atlas: () => this.atlasId,
      detail: () => this.detailId,
    });
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

  /** The visual-field map's uniforms, shared by every cortical material; null without retinotopy. */
  get visualField(): VisualFieldUniforms | null {
    return this.materials.visualField;
  }

  /** The reader's own map, shared by every cortical material and every cut face. */
  get userMap(): UserMapUniforms {
    return this.materials.userMap;
  }

  get sourceColors(): WeakMap<Mesh, Color> {
    return this.materials.sourceColors;
  }

  get layers(): Map<string, Layer> {
    return this.layerStore.layers;
  }

  /** The native pial and white envelopes: every one, and the white ones the dissection exposes. */
  get envelopes(): Mesh[] | null {
    return this.layerStore.envelopes;
  }

  get whiteMatterSurfaces(): WhiteMatterSurfaces | null {
    return this.layerStore.whiteMatterSurfaces;
  }

  get ribbonWedges(): Map<string, Mesh[]> {
    return this.layerStore.ribbonWedges;
  }

  get spinalCordLoadState(): 'unloaded' | 'loading' | 'ready' | 'error' {
    return this.layerStore.spinalCordLoadState;
  }

  get spinalCordLoadError(): unknown {
    return this.layerStore.spinalCordLoadError;
  }

  /**
   * Load what the first frame draws: one cortical atlas and one detail level. The cortex is shown
   * as soon as it is in (`onCortex`); this resolves once the internal anatomy and the cortex's
   * border blend are in too. The envelopes and the cord wait until something needs them.
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
    const report = options.onProgress;
    const progress = combineProgress(['detail', 'atlas'], report);
    const together = progress.track('detail');
    let internal: LoadProgress = { loaded: 0, total: 0, internal: true };
    let shown = false;
    const detail = this.loadLayer(level.id, level.file, (event) => {
      internal = { ...event, internal: true };
      if (shown) report?.(internal);
      else together(event);
    });
    const cortex = this.loadLayer(atlas.id, atlas.file, progress.track('atlas'));
    const show = (this.layerStore.drawable(atlas.id) ?? cortex).then(() => {
      this.detailId = level.id;
      this.atlasId = atlas.id;
      this.update();
      shown = true;
      options.onCortex?.(this);
      report?.(internal);
    });
    const blended = Promise.all([cortex, show]).then(() => options.onBlended?.());
    await Promise.all([detail, cortex, show, blended]);
    this.isolatedId = null;
    this.select(null);
  }

  /** See `ModelLayers.ensureEnvelopes`. */
  ensureEnvelopes(onProgress?: ProgressCallback, priority?: RequestPriority): Promise<Mesh[]> {
    return this.layerStore.ensureEnvelopes(onProgress, priority);
  }

  /** Hidden cortex exposes white matter the moment it is hidden; the envelopes follow and repaint. */
  loadEnvelopesBehind(): void {
    this.layerStore.loadEnvelopesBehind();
  }

  /** See `ModelLayers.ensureSpinalCord`. */
  ensureSpinalCord(onProgress?: ProgressCallback, priority?: RequestPriority): Promise<void> {
    return this.layerStore.ensureSpinalCord(onProgress, priority);
  }

  /** See `ModelLayers.ensureSupplemental`. */
  ensureSupplementalLayer(id: string, onProgress?: ProgressCallback, priority?: RequestPriority) {
    return this.layerStore.ensureSupplemental(id, onProgress, priority);
  }

  /** See `ModelLayers.ensureRibbonWedges`. */
  ensureRibbonWedges(
    atlas: string,
    baseUrl: string | URL,
    priority?: RequestPriority,
  ): Promise<Mesh[]> {
    return this.layerStore.ensureRibbonWedges(atlas, baseUrl, priority);
  }

  /** Whether a layer is whole: loaded, and a cortex's border blend in (not merely drawable). */
  hasLayer(id: string): boolean {
    return this.layerStore.hasLayer(id);
  }

  /** See `ModelLayers.loadLayer`. */
  loadLayer(
    id: string,
    file: string,
    onProgress?: ProgressCallback,
    priority?: RequestPriority,
  ): Promise<Layer> {
    return this.layerStore.loadLayer(id, file, onProgress, priority);
  }

  async setAtlas(id: string, onProgress?: ProgressCallback): Promise<void> {
    const atlas = this.manifest.atlases.find((entry) => entry.id === id);
    if (!atlas) throw unknownLayer(`Unknown atlas: ${id}`);
    const request = ++this.atlasRequest;
    await this.loadLayer(id, atlas.file, onProgress);
    if (request !== this.atlasRequest) return;
    // Shown, the thickness comes with the atlas, so its cortex is never drawn without it.
    if (this.surfaceColor === 'thickness') {
      await this.ensureThickness(id, this.thickness!.base);
      if (request !== this.atlasRequest) return;
    }
    if (id !== this.atlasId) this.previousAtlas = this.atlasId;
    this.atlasId = id;
    this.release(this.manifest.atlases, [id, this.previousAtlas]);
    this.surfaceColor = surfaceColorOn(id, this.surfaceColor, this.cabNp);
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
    if (id !== this.detailId) this.previousDetail = this.detailId;
    this.detailId = id;
    this.release(this.manifest.detail_levels, [id, this.previousDetail]);
    this.internalSystem = null;
    this.internalConstituents = new Set();
    this.isolatedId = null;
    this.update();
  }

  /** Free the layers of one kind but those `kept` (ATLAS-10); the explode measures again. */
  private release(kind: readonly { id: string }[], kept: readonly (string | null)[]): void {
    if (this.layerStore.release(kind, kept)) this.placement.forgetShifts();
  }

  /** What the cut is doing, reported by the sections that own the plane. */
  setCutState({ atlas, active }: { atlas: string | null; active: boolean }): void {
    if (atlas === this.cutAtlasId && active === this.cutActive) return;
    this.cutAtlasId = atlas;
    this.cutActive = active;
    // A cut is drawn where the anatomy lies, so it opens on the brain assembled.
    if (active) this.placement.assemble();
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
      exploded: this.placement.exploded,
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
    return visibleMeshes(this.layers, this.whiteMatterSurfaces);
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
    const view = {
      settings,
      selectedRegion: this.selectedId ? this.regions.get(this.selectedId)! : null,
      manifest: this.manifest,
      regions: this.regions,
      cabNp: this.cabNp,
      clippingPlanes: this.clippingPlanes,
      layers: this.layers,
      whiteMatter: this.whiteMatterSurfaces,
      materials: this.materials,
    };
    if (
      !this.whiteMatterSurfaces &&
      !this.layerStore.envelopesLoading &&
      exposedWhiteMatter(settings, this.regions).size
    ) {
      this.loadEnvelopesBehind();
    }
    drawWhiteMatterAndScan(view);
    this.placement.place();
    drawLayers(view);
    if (dropped) this.dispatchEvent(new CustomEvent('selectionchange', { detail: null }));
    this.dispatchEvent(new CustomEvent('change', { detail: this.state }));
  }

  /**
   * The nearest visible hit the cut keeps (`nearestHit`). On a surface drawing the cerebellar map it names the map's
   * region there, as a cut face through it does; elsewhere on that surface, its own region.
   */
  intersect(raycaster: Raycaster): (Intersection<AtlasMesh> & Pick<StageHit, 'mapRegion'>) | null {
    this.group.updateMatrixWorld(true);
    const hit = this.nearestHit(raycaster, this.visibleMeshes);
    const map = this.materials.cerebellarMap;
    if (!hit || !map || !drawsSurfaceMap(hit.object.material)?.value) return hit;
    const id = surfaceMapRegionAt(hit, map);
    const region = id ? this.regions.get(id)! : null;
    // A region hidden or isolated away is not drawn there (`showSurfaceMapRegions`), so the surface's own answers.
    return region && this.canSelect(region) ? { ...hit, mapRegion: region } : hit;
  }

  nearestHit(raycaster: Raycaster, meshes: readonly AtlasMesh[]): Intersection<AtlasMesh> | null {
    return nearestHit(raycaster, meshes, this.clippingPlanes);
  }

  pick(raycaster: Raycaster): Region | null {
    const hit = this.intersect(raycaster);
    return hit && hitRegion(hit, this.regions);
  }

  /** See `inSight` (`picking.ts`). */
  inSight(
    targets: readonly { id: string; point: Vec3 }[],
    view: Omit<FacingScene, 'regions' | 'meshes'>,
  ) {
    return inSight(targets, { ...view, regions: this.regions, meshes: this.visibleMeshes });
  }

  /**
   * The mean of the region's voxel centres (a cortical parcel's, in the ribbon), in surface RAS
   * millimetres; null for an unknown id or a non-region. It can lie outside a curved region.
   */
  centroidOf(regionId: string | null): Triple | null {
    return this.placementOf(regionId, 'centroid_ras_mm');
  }

  /** The region's own voxel nearest its centroid: where the linked MRI and a cut go to show it. */
  anchorOf(regionId: string | null): Triple | null {
    return this.placementOf(regionId, 'anchor_ras_mm');
  }

  private placementOf(
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

  /**
   * Pull the anatomy apart, or put it back together, on the camera's spring; with the next frame under
   * reduced motion. A change of mind turns the pieces where they are. Throws while a cut or the
   * visual-field map shows the anatomy where it lies.
   */
  setExploded(exploded: boolean): void {
    if (typeof exploded !== 'boolean') throw new TypeError('The exploded view must be boolean.');
    if (exploded && this.cutActive) {
      throw new Error('A cut shows the anatomy where it lies; close it before exploding.');
    }
    if (exploded && this.placement.medialPair) {
      throw new Error('The visual-field map pairs the hemispheres; close it before exploding.');
    }
    this.placement.explode(exploded);
    this.update();
  }

  /** Move the explode on to `now`, a frame's `performance.now()`; true when the anatomy moved. */
  stepExplode(now: number): boolean {
    return this.placement.step(now);
  }

  /** See `Placement.anatomicalFrame`. */
  get anatomicalFrame(): Quaternion {
    return this.placement.anatomicalFrame;
  }

  /** Where `mesh` is drawn once the explode has arrived: framing fits that, not a frame in flight. */
  settledMatrixWorld(mesh: Mesh, target = new Matrix4()): Matrix4 {
    return this.placement.settledMatrixWorld(mesh, target);
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
    assertSurfaceColor(mode, {
      manifest: this.manifest,
      cabNp: this.cabNp,
      atlas: this.atlasId,
      scanned: Boolean(this.materials.mri),
      cerebellarMapped: Boolean(this.materials.cerebellarMap),
      thickened: this.carriesThickness(this.atlasId),
    });
    this.surfaceColor = mode;
    this.update();
  }

  /** Whether the loaded cortex of `atlas` carries its thickness. */
  carriesThickness(atlas: string): boolean {
    const layer = this.layers.get(atlas);
    return Boolean(layer && this.thickness?.carried.has(layer));
  }

  /**
   * This brain's cortical thickness on a loaded atlas's cortex, a byte per vertex, downloaded once for
   * each time that atlas loads. Rejects for an atlas the build publishes none for.
   */
  async ensureThickness(atlas: string, baseUrl: string | URL): Promise<void> {
    const record = this.manifest.cortical_thickness?.files[atlas];
    if (!record) throw new Error(`No cortical thickness is published for the ${atlas} cortex.`);
    const layer = this.layers.get(atlas);
    if (!layer) throw new Error(`The ${atlas} cortex has not loaded.`);
    this.thickness ??= { base: baseUrl, carried: new WeakSet() };
    if (this.thickness.carried.has(layer)) return;
    const url = new URL(record.file, new URL(baseUrl, globalThis.location?.href));
    const [buffer, { attachThickness, thicknessPalette }] = await Promise.all([
      fetchAsset(url),
      import('./cortical-thickness.ts'),
    ]);
    // A layer released while its thickness downloaded is not drawn; its next load downloads again.
    if (this.layers.get(atlas) !== layer || this.thickness.carried.has(layer)) return;
    const palette = this.materials.thicknessPalette!;
    palette.value ??= thicknessPalette(this.manifest.cortical_thickness!);
    attachThickness(layer, new Uint8Array(buffer), this.manifest.regions, atlas);
    this.thickness.carried.add(layer);
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
    if (Boolean(map) !== this.placement.medialPair) {
      this.placement.setMedialPair(Boolean(map));
      this.update();
    }
  }

  /** See `Placement.medialPair`. */
  get medialPair(): boolean {
    return this.placement.medialPair;
  }

  /** See `visualFieldActivation` (`visual-field.ts`). */
  visualFieldActivation(dot: VisualFieldDot): Box3 | null {
    if (!this.visualField) throw new Error('This anatomy publishes no retinotopy.');
    return visualFieldActivation(dot, this.visibleMeshes, this.manifest);
  }

  /** The current atlas's region of a hemisphere where the visual-field map is measured (`visual-field.ts`). */
  visualFieldRegion(hemisphere: 'left' | 'right'): string {
    const layer = this.layers.get(this.atlasId);
    if (!this.visualField || !this.manifest.retinotopy || !layer) {
      throw new Error('No cortical atlas with retinotopy is drawn.');
    }
    return visualFieldRegion(hemisphere, layer, this.manifest, this.regions);
  }

  /** See `visualFieldAt` (`visual-field.ts`); null without retinotopy. */
  visualFieldAt(hit: SurfaceHit): VisualFieldReading | null {
    if (!this.visualField) return null;
    return visualFieldAt(hit, this.manifest, this.regions);
  }

  /** See `visualAreaAt` (`visual-field.ts`); null without retinotopy. */
  visualAreaAt(hit: SurfaceHit): NamedVisualArea | null {
    if (!this.visualField) return null;
    return visualAreaAt(hit, this.manifest, this.regions);
  }

  /** See `showVisualAreaBorders` (`visual-field.ts`), on the shown atlas's cortex. */
  showVisualAreas(on: boolean): void {
    if (!this.visualField) throw new Error('This anatomy publishes no retinotopy.');
    showVisualAreaBorders(on, this.visualField, this.layers.get(this.atlasId)!.meshes);
  }

  setMriAnatomy(anatomy: { mriUniforms: MriUniforms } | null): void {
    this.materials.attachMri(anatomy, this.layers.values(), this.whiteMatterSurfaces);
  }

  /** The cerebellar map the cerebellar cortex and lobules draw under the cerebellar functions colour. */
  setCerebellarMap(map: SurfaceMap): void {
    this.materials.attachCerebellarMap(map, this.layers.values());
  }

  /** See `SurfaceMaterials.programSamples`. */
  programSamples(): Mesh[] {
    return this.materials.programSamples(this.layers.values(), this.whiteMatterSurfaces);
  }

  /** See `SurfaceMaterials.cutProgramSamples`. */
  cutProgramSamples(): Mesh[] {
    return this.materials.cutProgramSamples(this.layers.values(), this.whiteMatterSurfaces);
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
    this.placement.explode(false);
    this.internalVisible = true;
    this.spinalCordVisible = false;
    this.surfaceColor = 'atlas';
    this.isolatedId = null;
    this.ghostedAround = null;
    this.select(null);
  }

  dispose(): void {
    this.isDisposed = true;
    this.spinalCordRequest += 1;
    this.atlasRequest += 1;
    this.detailRequest += 1;
    this.layerStore.dispose();
    this.materials.dispose();
    this.group.removeFromParent();
  }

  /** A region that has just been hidden cannot stay isolated: nothing would be left to see. */
  private releaseHiddenIsolation(): void {
    if (this.isolatedId && this.dissection.state.hiddenRegions.has(this.isolatedId)) {
      this.isolatedId = null;
    }
  }
}
