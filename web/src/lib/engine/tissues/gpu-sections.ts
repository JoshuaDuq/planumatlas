import {
  Data3DTexture,
  DataTexture,
  FloatType,
  Group,
  LinearFilter,
  Matrix4,
  Mesh,
  NearestFilter,
  RedFormat,
  RedIntegerFormat,
  RGBAFormat,
  UnsignedByteType,
  UnsignedShortType,
  Vector2,
  Vector3,
} from 'three';
import type { Color, Intersection, IUniform, Material, Raycaster } from 'three';
import type { Region } from '../../types/index.ts';
import type { Frame } from '../slices/coordinates.ts';
import { clippingPlane, worldToRas, worldToVoxelMatrix } from '../slices/coordinates.ts';
import { fetchAsset } from '../../core/assets/asset-cache.ts';
import type { ProgressCallback } from '../model/progress.ts';
import { loadVolume } from '../slices/volume.ts';
import type { Volume, VolumeFile } from '../slices/volume.ts';
import { codeIndex, liftFor } from './highlight.ts';
import {
  createPalette,
  ghostKey,
  labelVisible,
  usesAtlasColors,
  usesNetworkColors,
  usesPaint,
} from './palette.ts';
import type { Label, PaletteLookup, PaletteState } from './palette.ts';
import { SolidSections } from './solid-sections.ts';
import type { SolidHit } from './solid-sections.ts';
import {
  BANDS,
  addSolidSources,
  enclosingFirst,
  indexLabels,
  paintSolids,
  solidSource,
} from './solid-assets.ts';
import type { LabelIndex } from './solid-assets.ts';
import { createWhiteMatter } from './white-matter.ts';
import type { WhiteMatter, WhiteMatterRecord } from './white-matter.ts';
import { createMriUniforms, setMriHighlight, setMriWindow } from '../render/mri-material.ts';
import type { MriUniforms } from '../render/mri-material.ts';
import type { Appearance } from '../render/materials.ts';
import { token } from '../render/tokens.ts';
import { createCapLabels, updateCapLabels } from './cap-labels.ts';
import {
  STRIATAL_ATLAS,
  createStriatalPalette,
  createStriatalUniforms,
} from './striatal-overlay.ts';
import type { StriatalUniforms } from './striatal-overlay.ts';
import type { UserMapUniforms } from '../user-map/overlay.ts';
import type { CapLabelUniforms } from './cap-labels.ts';
import { createEdgeUniforms, pairTexture } from './boundary-edges.ts';
import type { EdgeUniforms } from './boundary-edges.ts';
import type { BoundaryCertainty } from '../../core/catalog/boundary-certainty.ts';

/** `volumes.json`: the MRI and segmentation records, their labels and the default MRI window. */
export interface VolumeMetadata {
  schema_version: number;
  mri: VolumeFile;
  segmentation: VolumeFile;
  labels: Readonly<Record<number, { name: string; color: readonly number[] }>>;
  display: {
    field_of_view_mm: number;
    texture_size: number;
    window_center: number;
    window_width: number;
  };
}

/** One atlas's published label volume and its label table (`tissue-labels.json`). */
export interface TissueAtlasRecord extends VolumeFile {
  labels: readonly Label[];
  voxel_spacing_mm?: readonly number[];
  /** The striatal network atlas's confidence classes: 0 outside, 1 filled, 2 low, 3 confident. */
  confidence?: VolumeFile & { classes: readonly string[] };
}

export interface TissueMetadata {
  schema_version: number;
  atlases: Readonly<Record<string, TissueAtlasRecord>>;
  white_matter?: WhiteMatterRecord & VolumeFile;
}

export interface Highlight {
  hovered?: string | null;
  selected?: string | null;
}

/** The registered MRI the cut materials sample. */
export interface Anatomy {
  texture: Data3DTexture;
  volume: Volume;
  worldToVoxel: Matrix4;
  mriUniforms: MriUniforms;
  capLabels: CapLabelUniforms;
  capEdges: EdgeUniforms;
  striatal: StriatalUniforms;
  userMap: UserMapUniforms;
}

/** One loaded cut atlas: its label grid on the GPU, which the caps sample where it has no parcel solids. */
export interface TissueLayer {
  metadata: TissueAtlasRecord;
  volume: Volume;
  texture: Data3DTexture;
  palette: DataTexture;
  uniforms: {
    worldToVoxel: IUniform<Matrix4>;
    volumeShape: IUniform<Vector3>;
    highlightCodes: IUniform<Vector2>;
    highlightLifts: IUniform<Vector2>;
  };
  paletteKey: string | null;
  solidLabels: LabelIndex;
  codes: Map<string, number>;
  wedged: boolean;
  edges: EdgeUniforms;
}

/**
 * The part of the model (`BrainAtlas`, legacy `model/brain-atlas.js`) that the
 * cut reads and drives; the model itself belongs to another chunk.
 */
export interface CutModel extends EventTarget {
  readonly manifest: {
    appearance: Appearance;
    networks?: PaletteLookup['networks'];
    arterial_territories?: { territories: NonNullable<PaletteLookup['territories']> };
    supplemental_layers?: { id: string; bounds_ras_mm?: readonly (readonly number[])[] }[];
  };
  readonly regions: ReadonlyMap<string, Region>;
  readonly cabNp: PaletteLookup['cabNp'] | null;
  readonly userMap: UserMapUniforms;
  readonly boundaryCertainty: BoundaryCertainty | null;
  readonly layers: ReadonlyMap<string, { meshes: Mesh[] }>;
  readonly sourceColors: Pick<ReadonlyMap<Mesh, Color>, 'get'>;
  readonly state: PaletteState;
  ensureEnvelopes(onProgress?: ProgressCallback, priority?: RequestPriority): Promise<Mesh[]>;
  ensureSpinalCord(onProgress?: ProgressCallback, priority?: RequestPriority): Promise<unknown>;
  ensureRibbonWedges(
    atlas: string,
    baseUrl: string | URL,
    priority?: RequestPriority,
  ): Promise<Mesh[]>;
}

/** A cut hit with the region it names and the label it landed on. */
export type CutHit = (Intersection | SolidHit) & { region?: Region | null; label?: Label };

const readJson = async <T>(url: URL, priority?: RequestPriority): Promise<T> =>
  JSON.parse(new TextDecoder().decode(await fetchAsset(url, { priority }))) as T;

/** One persistent GPU plane reads categorical tissue IDs from the native 3D grid. */
export class TissueSections {
  readonly group = new Group();
  readonly layers = new Map<string, TissueLayer>();
  readonly solids = new SolidSections();
  anatomy: Anatomy | null = null;
  solidsReady = false;
  private readonly pending = new Map<string, Promise<void>>();
  metadata: TissueMetadata | null = null;
  private metadataLoading: Promise<void> | null = null;
  private volumeMetadata: VolumeMetadata | null = null;
  private volumeMetadataLoading: Promise<VolumeMetadata> | null = null;
  private current: TissueLayer | null = null;
  private disposed = false;
  private mriLoading: Promise<Anatomy> | null = null;
  private solidsLoading: Promise<void> | null = null;
  private readonly details = new Map<string, number>();
  private whiteMatter: WhiteMatter | null = null;
  private paintKey: string | undefined;
  private striatalPalette: DataTexture | null = null;
  private striatalConfidence: {
    texture: Data3DTexture;
    worldToVoxel: Matrix4;
    shape: Vector3;
  } | null = null;

  private readonly model: CutModel;
  private readonly baseUrl: string | URL;

  constructor(model: CutModel, baseUrl: string | URL) {
    this.model = model;
    this.baseUrl = baseUrl;
    this.group.name = 'GPU labelled tissue sections';
    this.group.add(this.solids.group);
  }

  /** What a cut label's colour is looked up in: its region and each published network palette. */
  get paletteLookup(): PaletteLookup {
    const { regions, manifest, cabNp } = this.model;
    return {
      regions,
      networks: manifest.networks,
      ...(cabNp && { cabNp }),
      ...(manifest.arterial_territories && {
        territories: manifest.arterial_territories.territories,
      }),
    };
  }

  async loadMetadata(priority?: RequestPriority): Promise<void> {
    if (this.metadata) return;
    if (this.metadataLoading) return this.metadataLoading;
    this.metadataLoading = (async () => {
      const metadata = await readJson<TissueMetadata>(
        new URL('tissue-labels.json', this.baseUrl),
        priority,
      );
      if (metadata.schema_version !== 1) throw new Error('Unsupported tissue label schema.');
      this.metadata = metadata;
    })().finally(() => {
      this.metadataLoading = null;
    });
    return this.metadataLoading;
  }

  /** `volumes.json`: the MRI and segmentation headers and the default MRI window. */
  async loadVolumeMetadata(priority?: RequestPriority): Promise<VolumeMetadata> {
    if (this.volumeMetadata) return this.volumeMetadata;
    if (this.volumeMetadataLoading) return this.volumeMetadataLoading;
    this.volumeMetadataLoading = (async () => {
      const metadata = await readJson<VolumeMetadata>(
        new URL('volumes.json', this.baseUrl),
        priority,
      );
      if (metadata.schema_version !== 1) throw new Error('Unsupported MRI schema.');
      this.volumeMetadata = metadata;
      return metadata;
    })().finally(() => {
      this.volumeMetadataLoading = null;
    });
    return this.volumeMetadataLoading;
  }

  /**
   * The native T1 on the GPU. MRI surface colour needs nothing more, and the
   * linked MRI views read the same volume rather than downloading it again.
   */
  async loadMri(priority?: RequestPriority): Promise<Anatomy> {
    if (this.anatomy) return this.anatomy;
    if (this.mriLoading) return this.mriLoading;
    this.mriLoading = (async () => {
      const metadata = await this.loadVolumeMetadata(priority);
      const volume = await loadVolume(
        metadata.mri,
        new URL('volumes.json', this.baseUrl),
        priority,
      );
      if (this.disposed) throw new Error('Tissue sections disposed during MRI loading.');
      this.anatomy = this.createAnatomy(volume);
      this.setWindow(metadata.display.window_center, metadata.display.window_width);
      return this.anatomy;
    })().finally(() => {
      this.mriLoading = null;
    });
    return this.mriLoading;
  }

  /**
   * The MRI, the tissue envelopes every cut caps and the cord, built from the
   * model's own meshes; the first cut is what downloads the envelopes and cord
   * when nothing has yet.
   */
  async loadAnatomy(priority?: RequestPriority): Promise<void> {
    if (this.solidsReady) return;
    if (this.solidsLoading) return this.solidsLoading;
    this.solidsLoading = (async () => {
      await this.loadMetadata(priority);
      const parcels = this.metadata!.white_matter;
      const cord = this.model.manifest.supplemental_layers?.some((layer) => layer.id === 'pam50');
      const [, envelopes, parcelVolume] = await Promise.all([
        this.loadMri(priority),
        this.model.ensureEnvelopes(undefined, priority),
        parcels ? loadVolume(parcels, this.baseUrl, priority) : null,
        cord ? this.model.ensureSpinalCord(undefined, priority) : null,
      ]);
      if (this.disposed) throw new Error('Tissue sections disposed during MRI loading.');
      const anatomy = this.anatomy!;
      this.whiteMatter = parcelVolume && parcels ? createWhiteMatter(parcels, parcelVolume) : null;
      addSolidSources(
        this.solids,
        envelopes.map((mesh) => solidSource(mesh)),
        anatomy,
        this.model.manifest.appearance,
        BANDS.envelope,
        this.whiteMatter,
      );
      if (cord) {
        const meshes = this.model.manifest.supplemental_layers!.flatMap(
          (layer) => this.model.layers.get(layer.id)!.meshes,
        );
        const sources = enclosingFirst(
          meshes.map((mesh) =>
            solidSource(mesh, { ...mesh.userData }, this.model.sourceColors.get(mesh)),
          ),
        );
        addSolidSources(
          this.solids,
          sources,
          anatomy,
          this.model.manifest.appearance,
          BANDS.structure,
        );
      }
      this.solidsReady = true;
    })().finally(() => {
      this.solidsLoading = null;
    });
    return this.solidsLoading;
  }

  /** Whether the cut caps the detail level the model now shows. */
  hasDetail(detail: string): boolean {
    return this.details.has(detail);
  }

  /** Cap the internal anatomy the viewer is showing; both levels segment the same. */
  addDetail(detail: string): void {
    if (this.details.has(detail)) return;
    const layer = this.model.layers.get(detail);
    if (!layer) throw new Error(`Detail level has not loaded: ${detail}`);
    const sources = enclosingFirst(
      layer.meshes.map((mesh) =>
        solidSource(mesh, { ...mesh.userData, detail }, this.model.sourceColors.get(mesh)),
      ),
    );
    addSolidSources(
      this.solids,
      sources,
      this.anatomy!,
      this.model.manifest.appearance,
      BANDS.structure,
    );
    this.details.set(detail, sources.length);
  }

  createAnatomy(volume: Volume): Anatomy {
    if (!(volume.data instanceof Uint8Array)) throw new Error('Expected native uint8 MRI.');
    const texture = new Data3DTexture(volume.data, ...volume.shape);
    texture.format = RedFormat;
    texture.type = UnsignedByteType;
    texture.internalFormat = 'R8';
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;
    const worldToVoxel = worldToVoxelMatrix(volume);
    const anatomy = {
      texture,
      volume,
      worldToVoxel,
      mriUniforms: createMriUniforms({ texture, worldToVoxel, volume }),
      capLabels: createCapLabels(),
      capEdges: createEdgeUniforms(),
      striatal: createStriatalUniforms(),
      userMap: this.model.userMap,
    };
    this.markWith(anatomy.mriUniforms);
    return anatomy;
  }

  /**
   * Which colour marks a pointed-at or chosen cut face.
   *
   * The scan is achromatic, so the mark is the theme's one accent rather than
   * a lift toward white, which bright tissue would drown. Called again when
   * the theme changes, because the two palettes name different accents.
   */
  markWith(uniforms: MriUniforms | undefined = this.anatomy?.mriUniforms): void {
    const accent = token('--accent');
    if (uniforms && accent) setMriHighlight(uniforms, accent);
  }

  setWindow(center: number, width: number): void {
    if (this.anatomy) setMriWindow(this.anatomy.mriUniforms, center, width);
  }

  /**
   * Whether the cut colours the striatum by its own voxels' networks, and how confidently: under
   * Yeo colouring, or with the striatal network labels in their own colours, when the anatomy
   * publishes them. The caller loads that atlas's volume before drawing.
   */
  wantsStriatal(): boolean {
    const state = this.model.state;
    return (
      Boolean(this.metadata?.atlases[STRIATAL_ATLAS]) &&
      !usesPaint(state) &&
      (usesNetworkColors(state) || (state.cutAtlas === STRIATAL_ATLAS && usesAtlasColors(state)))
    );
  }

  /**
   * Point the cut and the caps at the striatal network volume, or switch it off.
   *
   * Switched off, the sampler still holds the drawn layer's own label volume, as the cap labels'
   * does: an integer sampler bound to three's empty float texture makes WebGL drop every draw of
   * the material, and with it every cap on the cut.
   */
  private updateStriatal(uniforms: StriatalUniforms, layer: TissueLayer): boolean {
    const source = this.wantsStriatal() ? this.layers.get(STRIATAL_ATLAS) : undefined;
    uniforms.striatalEnabled.value = Boolean(source);
    if (source) this.striatalPalette ??= createStriatalPalette(source.metadata.labels);
    const sampled = source ?? layer;
    uniforms.striatalVolume.value = sampled.texture;
    uniforms.striatalPalette.value = source ? this.striatalPalette : layer.palette;
    uniforms.worldToStriatal.value = sampled.uniforms.worldToVoxel.value;
    uniforms.striatalShape.value = sampled.uniforms.volumeShape.value;
    const confidence = source ? this.striatalConfidence : null;
    uniforms.striatalConfidence.value = confidence?.texture ?? sampled.texture;
    uniforms.worldToConfidence.value =
      confidence?.worldToVoxel ?? sampled.uniforms.worldToVoxel.value;
    uniforms.confidenceShape.value = confidence?.shape ?? sampled.uniforms.volumeShape.value;
    return Boolean(source);
  }

  /** The striatal network atlas's confidence classes on the GPU, beside its labels. */
  private async loadStriatalConfidence(
    record: NonNullable<TissueAtlasRecord['confidence']>,
    priority?: RequestPriority,
  ) {
    const volume = await loadVolume(record, this.baseUrl, priority);
    if (!(volume.data instanceof Uint8Array)) throw new Error('Expected uint8 confidence classes.');
    const texture = new Data3DTexture(volume.data, ...volume.shape);
    texture.format = RedIntegerFormat;
    texture.type = UnsignedByteType;
    texture.internalFormat = 'R8UI';
    texture.minFilter = NearestFilter;
    texture.magFilter = NearestFilter;
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;
    this.striatalConfidence = {
      texture,
      worldToVoxel: worldToVoxelMatrix(volume),
      shape: new Vector3(...volume.shape),
    };
  }

  /**
   * Load one named label volume. The caller owns which atlas the cut samples; a prefetch asks for
   * `low` priority.
   */
  async load(atlas: string, priority?: RequestPriority): Promise<void> {
    if (this.disposed) throw new Error('Tissue sections disposed.');
    await Promise.all([this.loadMetadata(priority), this.loadAnatomy(priority)]);
    this.addDetail(this.model.state.detail);
    if (this.layers.has(atlas)) return;
    const loading = this.pending.get(atlas);
    if (loading) return loading;
    const metadata = this.metadata!.atlases[atlas];
    if (!metadata) throw new Error(`Missing tissue atlas: ${atlas}`);
    const pending = Promise.all([
      loadVolume(metadata, this.baseUrl, priority),
      this.model.ensureRibbonWedges(atlas, this.baseUrl, priority),
      metadata.confidence ? this.loadStriatalConfidence(metadata.confidence, priority) : null,
    ])
      .then(([volume, wedges]) => {
        if (this.disposed) throw new Error('Tissue sections disposed during loading.');
        const layer = this.createLayer(metadata, volume);
        const certainty = this.model.boundaryCertainty;
        if (certainty?.atlas === atlas) {
          layer.edges.edgeEnabled.value = true;
          layer.edges.edgePairs.value = pairTexture(
            layer.codes,
            metadata.labels.length,
            certainty.pairs,
          );
        }
        addSolidSources(
          this.solids,
          wedges.map((wedge) => solidSource(wedge)),
          this.anatomy!,
          this.model.manifest.appearance,
          BANDS.ribbon,
        );
        layer.wedged = wedges.length > 0;
        this.layers.set(atlas, layer);
      })
      .finally(() => this.pending.delete(atlas));
    this.pending.set(atlas, pending);
    return pending;
  }

  createLayer(metadata: TissueAtlasRecord, volume: Volume): TissueLayer {
    if (!this.anatomy) throw new Error('MRI must load before creating tissue sections.');
    if (!(volume.data instanceof Uint16Array)) throw new Error('Expected uint16 tissue labels.');
    const texture = new Data3DTexture(volume.data, ...volume.shape);
    texture.format = RedIntegerFormat;
    texture.type = UnsignedShortType;
    texture.internalFormat = 'R16UI';
    texture.minFilter = NearestFilter;
    texture.magFilter = NearestFilter;
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;
    const palette = new DataTexture(
      new Float32Array(metadata.labels.length * 4),
      metadata.labels.length,
      1,
      RGBAFormat,
      FloatType,
    );
    palette.needsUpdate = true;
    const uniforms: TissueLayer['uniforms'] = {
      worldToVoxel: { value: worldToVoxelMatrix(volume) },
      volumeShape: { value: new Vector3(...volume.shape) },
      // A sampled cap covers many labels, so it compares the pointed-at and
      // chosen codes rather than carrying a lift of its own.
      highlightCodes: { value: new Vector2(-1, -1) },
      highlightLifts: { value: new Vector2(0, 0) },
    };
    return {
      metadata,
      volume,
      texture,
      palette,
      uniforms,
      paletteKey: null,
      solidLabels: indexLabels(metadata.labels),
      codes: codeIndex(metadata.labels),
      wedged: false,
      edges: createEdgeUniforms(),
    };
  }

  update(frame: Frame, atlas: string, reverse = false): true {
    const layer = this.layers.get(atlas);
    if (!layer) throw new Error(`Tissue atlas has not loaded: ${atlas}`);
    this.current = layer;
    const state = this.model.state;
    const anatomy = this.anatomy!;
    anatomy.mriUniforms.scanEnabled.value = state.surfaceColor === 'mri';
    updateCapLabels(anatomy.capLabels, layer, state);
    const striatal = this.updateStriatal(anatomy.striatal, layer);
    anatomy.capEdges.edgeEnabled.value = layer.edges.edgeEnabled.value;
    anatomy.capEdges.edgePairs.value = layer.edges.edgePairs.value;
    // Every cut is drawn by the solids; a cut-only atlas has no parcel solids,
    // so its caps take their colours from its label volume (updateCapLabels).
    this.solids.group.visible = true;
    this.whiteMatter?.update({
      atlas,
      isolatedRegion: state.isolatedRegion,
      hiddenRegions: state.hiddenRegions,
    });
    // Colour does not depend on where the plane sits. A drag only moves the
    // plane, and repainting every solid there is work the frame cannot spare.
    const constituents = state.internalConstituents
      ? [...state.internalConstituents].sort().join(',')
      : '';
    const paintKey = [
      state.surfaceColor,
      state.paint?.id,
      state.atlas,
      state.hemisphere,
      state.cortexVisible,
      state.cortexOpacity,
      state.isolatedRegion,
      ghostKey(state),
      state.internalVisible,
      state.internalSystem,
      state.spinalCordVisible,
      state.detail,
      state.cutAtlas,
      state.cutActive,
      constituents,
      atlas,
      layer.wedged,
      striatal,
      this.whiteMatter?.active ?? false,
      [...(state.hiddenRegions ?? [])].sort().join(','),
    ].join('|');
    if (paintKey !== this.paintKey) {
      this.paintKey = paintKey;
      paintSolids(this.solids as unknown as Parameters<typeof paintSolids>[0], {
        labels: layer.solidLabels,
        state,
        atlas,
        detail: state.detail,
        wedged: layer.wedged,
        appearance: this.model.manifest.appearance,
        lookup: this.paletteLookup,
        whiteMatter: this.whiteMatter?.active ? this.whiteMatter : null,
        striatal,
      });
    }
    this.solids.update(clippingPlane(frame, reverse));
    const key = JSON.stringify([
      state.surfaceColor,
      state.paint?.id ?? null,
      state.hemisphere,
      state.cortexVisible,
      state.cortexOpacity,
      state.isolatedRegion,
      ghostKey(state),
      state.internalSystem,
      state.detail,
      [...(state.hiddenRegions ?? [])].sort(),
    ]);
    if (key !== layer.paletteKey) {
      layer.palette.image.data = createPalette(
        layer.metadata.labels,
        state,
        this.model.manifest.appearance.tissue,
        this.paletteLookup,
      );
      layer.palette.needsUpdate = true;
      layer.paletteKey = key;
    }
    return true;
  }

  /**
   * Light the cut faces of the pointed-at and the chosen region.
   *
   * Off the state loop on purpose: a pointer answers this once a frame,
   * and a full render would rebuild every panel that often.
   */
  setHighlight(highlight: Highlight = {}): void {
    this.solids.highlight(highlight);
    this.whiteMatter?.setHighlight(highlight);
    for (const layer of this.layers.values()) {
      const code = (region: string | null | undefined) =>
        (region == null ? undefined : layer.codes.get(region)) ?? -1;
      layer.uniforms.highlightCodes.value.set(code(highlight.hovered), code(highlight.selected));
      layer.uniforms.highlightLifts.value.set(
        liftFor(highlight.hovered, highlight),
        liftFor(highlight.selected, highlight),
      );
    }
  }

  /** CPU picking uses the label rule the GPU shader draws with. */
  capVisibleAt(hit: SolidHit): boolean {
    const state = this.model.state;
    const parcel = this.whiteMatterAt(hit);
    if (parcel != null && state.hiddenRegions?.has(parcel)) return false;
    if (
      parcel !== undefined &&
      state.isolatedRegion !== null &&
      this.whiteMatter!.holds(state.isolatedRegion) &&
      parcel !== state.isolatedRegion
    )
      return false;
    if (!((hit.object as Mesh).material as Material).userData.sampledLabels.value) return true;
    const code = this.current!.volume.label(worldToRas(hit.point));
    const label = this.current!.metadata.labels[code];
    return (
      (code === 0 && !state.isolatedRegion) ||
      Boolean(label && labelVisible(label, state, { regions: this.model.regions }))
    );
  }

  intersect(raycaster: Raycaster): CutHit | null {
    if (!this.current) return null;
    this.group.updateMatrixWorld(true);
    const hit = this.solids.intersect(raycaster, (candidate) => this.capVisibleAt(candidate));
    if (!hit) return null;
    if (((hit.object as Mesh).material as Material).userData.sampledLabels.value) {
      const code = this.current.volume.label(worldToRas(hit.point));
      const label = this.current.metadata.labels[code];
      const visible =
        label && labelVisible(label, this.model.state, { regions: this.model.regions });
      return {
        ...hit,
        region: visible ? (this.model.regions.get(label.region_id!) ?? null) : null,
        label,
      };
    }
    // A cap was drawn from its own geometry, and only the atlas's own labels
    // are on the 1 mm grid: resampling it under a nucleus answers with
    // whatever the segmentation put there, which is a different detail
    // level's region entirely. What was drawn is what was pointed at.
    if (hit.region) return { ...hit, region: this.model.regions.get(hit.region) ?? null };
    const code = this.current.volume.label(worldToRas(hit.point));
    const label = this.current.metadata.labels[code];
    // The solid that was hit is the anatomy drawn there, and it is the one the
    // viewer is showing: resampling the label grid here could name a region
    // from a detail level that is not on screen, or a parcel across the
    // boundary the cap just drew.
    const parcel = this.whiteMatterAt(hit);
    const id = hit.source.userData['region_id'] ?? parcel ?? label?.region_id ?? null;
    return { ...hit, region: this.model.regions.get(id) ?? null, label };
  }

  /** The gyral white-matter parcel a white-envelope cap draws at a hit, if it samples one. */
  whiteMatterAt(hit: SolidHit): string | null | undefined {
    if (hit.source.userData['boundary'] !== 'white' || !this.whiteMatter?.active) return undefined;
    return this.whiteMatter.regionAt(new Vector3(...worldToRas(hit.point)));
  }

  dispose(): void {
    this.disposed = true;
    this.solids.dispose();
    this.whiteMatter?.dispose();
    for (const layer of this.layers.values()) {
      layer.texture.dispose();
      layer.palette.dispose();
    }
    this.striatalPalette?.dispose();
    this.striatalConfidence?.texture.dispose();
    this.anatomy?.texture.dispose();
    this.anatomy = null;
    this.layers.clear();
    this.group.removeFromParent();
  }
}
