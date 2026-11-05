import type { Rgb } from './paint.ts';
import type { Region } from './region.ts';

type Matrix4 = readonly (readonly number[])[];

/** A file the manifest points at, as `fetchAsset` loads it. */
export interface ManifestFile {
  file: string;
  sha256?: string;
}

/** A published label grid (`slices/volume.ts` reads it). */
export interface ManifestVolume extends ManifestFile {
  sha256: string;
  decoded_sha256: string;
  byte_length: number;
  dtype: string;
  shape: readonly number[];
  order: string;
  voxel_to_surface_ras_mm: readonly (readonly number[])[];
}

export interface ManifestAtlas {
  id: string;
  label: string;
  annotation: string;
  citation: string;
  license_file?: string;
  file: string;
  region_count: number;
  surface_shading?: Record<string, unknown>;
  ribbon_labels?: Record<string, unknown>;
}

export interface ManifestSourceGrid {
  voxel_to_surface_ras_mm: Matrix4;
  voxel_size_mm: readonly number[];
}

export interface ManifestDetailLevel {
  id: string;
  label: string;
  file: string;
  region_count: number;
  /** Absent on a level built from several source grids (`learning`). */
  voxel_to_surface_ras_mm?: Matrix4;
  voxel_size_mm?: readonly number[];
  source_grids?: Record<string, ManifestSourceGrid>;
  palette_method?: string;
  display_geometry: Record<string, unknown>;
}

export interface ManifestCutAtlas {
  id: string;
  label: string;
  citation: string;
  procedure?: string;
  surface: boolean;
}

export interface ManifestSupplementalLayer {
  id: string;
  label: string;
  file: string;
  region_count: number;
  sha256: string;
  citations: string[];
  license: string;
  license_file: string;
  attribution: string;
  /** Two opposite corners, `[min, max]` (slices/sections.js:117). */
  bounds_ras_mm: readonly [readonly number[], readonly number[]];
  /** The vertebral levels the cord reaches, top to bottom. */
  vertebral_levels: string[];
}

export interface ManifestAppearance {
  tissue: Record<string, string | number>;
  folds: Record<string, unknown>;
  see_through_opacity?: number;
  intensity?: Record<string, unknown>;
  lighting?: Record<string, unknown>;
  occlusion?: Record<string, unknown>;
  field_ranges?: Record<string, unknown>;
}

export interface ManifestAnatomy {
  id: string;
  subject: string;
  display_name: string;
  label: string;
  individual: boolean;
  source_url?: string;
  reconstruction?: string;
  hcp_projected_from?: string;
}

/**
 * `manifest.json` as `validateManifest` (model/brain-atlas.js:75) accepts it.
 * Sections that only some anatomies publish are optional.
 */
export interface Manifest {
  schema_version: 1;
  atlases: ManifestAtlas[];
  regions: Region[];
  detail_levels: ManifestDetailLevel[];
  appearance: ManifestAppearance;
  solid_envelopes: ManifestFile & { source?: string };
  anatomy: ManifestAnatomy;
  coordinate_system?: Record<string, unknown>;
  cut_atlases?: ManifestCutAtlas[];
  supplemental_layers?: ManifestSupplementalLayer[];
  networks?: Record<string, unknown>;
  cab_np?: ManifestFile & Record<string, unknown>;
  functional_regions?: ManifestFile & Record<string, unknown>;
  neuropsych_domains?: ManifestFile & Record<string, unknown>;
  neurosynth_terms?: ManifestFile & Record<string, unknown>;
  boundary_certainty?: ManifestFile & Record<string, unknown>;
  /** The comparison's file, and the compared NextBrain volume on aseg's grid. */
  segmentation_agreement?: ManifestFile & { volume: ManifestVolume } & Record<string, unknown>;
  arterial_territories?: ArterialTerritories;
  coordinate_spaces?: CoordinateSpaces;
  cerebellar_functions?: CerebellarFunctions;
  striatal_networks?: StriatalNetworks;
  retinotopy?: Retinotopy;
  receptor_fingerprints?: ManifestFile & Record<string, unknown>;
  stimulation_responses?: ManifestFile & Record<string, unknown>;
  stimulation_ftract?: ManifestFile & Record<string, unknown>;
  stroke_cases?: StrokeCasesRecord;
  volumes?: ManifestFile;
  tissues?: ManifestFile;
  atlas_comparison?: ManifestFile;
  atlas_comparisons?: (ManifestFile & { atlases: readonly [string, string] })[];
  boundary_convention?: string;
  limitations?: string[];
  provenance?: Record<string, unknown>;
}

/** One functional region of the cerebellar atlas, the same on both sides. */
export interface CerebellarFunctionRegion {
  id: string;
  domain: string;
  name: string;
  name_fr: string;
  description: string;
  description_fr: string;
  color: Rgb;
}

/** `manifest.cerebellar_functions`: the registered Nettekoven et al. (2024) group atlas. */
export interface CerebellarFunctions {
  id: 'nettekoven';
  label: string;
  citation: string;
  license: string;
  domains: Record<string, { name: string; name_fr: string }>;
  regions: CerebellarFunctionRegion[];
  registration: Record<string, unknown>;
  method: string;
}

/** `manifest.striatal_networks`: the registered Choi et al. (2012) striatal network atlas. */
export interface StriatalNetworks {
  id: 'choi';
  label: string;
  citation: string;
  license: string;
  networks: Record<string, { name: string; name_fr: string }>;
  /** Below this confidence a voxel's network holds a plurality, not a majority, of its 25 cortical vertices. */
  minimum_confidence: number;
  registration: Record<string, unknown>;
  method: string;
}

/** One branch territory of the arterial territory atlas. */
export interface ArterialTerritory {
  id: string;
  major: string;
  name: string;
  name_fr: string;
  color: Rgb;
}

/** `manifest.arterial_territories`: the registered Liu et al. (2023) atlas and its palette. */
export interface ArterialTerritories {
  id: 'arterial';
  label: string;
  citation: string;
  license: string;
  attribute: '_TERRITORY';
  major: Record<string, { name: string; name_fr: string; short: string }>;
  territories: ArterialTerritory[];
  registration: Record<string, unknown>;
  method: string;
}

/** What one hemisphere's predicted V1–V3 measure on this brain. */
export interface RetinotopyHemisphere {
  area_mm2: Record<string, number>;
  /** The share of V1–V3's area predicted beyond the measured eccentricity. */
  extrapolated_share: number;
  /** Area-weighted Dice of each predicted area with the parcels of each atlas named for it. */
  agreement_dice: Record<string, Record<string, number>>;
}

/** `manifest.stroke_cases`: the Aphasia Recovery Cohort's lesions on this brain, and their masks. */
export interface StrokeCasesRecord extends ManifestFile {
  sha256: string;
  masks: { file: string; sha256: string };
  cases: number;
  label: string;
  license: string;
  citations: string[];
  method: string;
}

/** `manifest.retinotopy`: V1–V3 retinotopy predicted by the Benson template, carried per cortical vertex. */
export interface Retinotopy extends ManifestFile {
  label: string;
  citation: string;
  method_citation: string;
  license: string;
  attributes: { x: '_FIELD_X'; y: '_FIELD_Y'; sigma: '_PRF_SIGMA'; area: '_VISUAL_AREA' };
  areas: { code: number; name: string }[];
  measured_eccentricity_deg: number;
  maximum_eccentricity_deg: number;
  hemispheres: Record<'left' | 'right', RetinotopyHemisphere>;
  method: string;
}

/** A published template's field: each grid node's displacement onto this brain's surface RAS. */
export interface CoordinateField {
  file: string;
  /** Nodes along each axis. */
  shape: readonly number[];
  components: number;
  dtype: string;
  order: string;
  interleaved: boolean;
  compression: string;
  byte_length: number;
  sha256: string;
  decoded_sha256: string;
  /** Node indices to template millimetres. */
  node_to_template_mm: Matrix4;
  /** Millimetres per stored unit. */
  unit_mm: number;
  /** Stored in every component of a node beyond the template's brain. */
  outside: number;
}

/** A template a published coordinate can be given in, and how well it registered to this brain. */
export interface CoordinateSpace {
  id: string;
  label: string;
  description: string;
  citation: string;
  doi: string;
  license: string;
  copyright: string;
  field: CoordinateField;
  registration: Record<string, unknown>;
}

/** Where another template's reading of the same numbers lands beside a published one's, in mm. */
export interface CoordinateOffsets {
  cortex_offset_mm: { median: number; p95: number; max: number };
  subcortical_offset_mm: Record<string, number>;
  sphere_overlap: Record<string, number>;
}

/** `manifest.coordinate_spaces`: published MNI coordinates placed on this brain by registration. */
export interface CoordinateSpaces {
  label: string;
  radius_mm: number;
  spaces: CoordinateSpace[];
  /** A coordinate whose template is not stated is read as `reads_as`; the alternatives were measured against it. */
  unstated: {
    reads_as: string;
    alternatives: {
      id: string;
      label: string;
      description: string;
      against: Record<string, CoordinateOffsets>;
    }[];
  };
  method: string;
}
