import cdmdRecords from '../../../../../data/diffusion-cdmd.yaml';
import type { Translated } from '../clinical/types.ts';

/** A scalar map shown beside the tracts (T1, FA). */
export interface TractMap {
  id: string;
  file: string;
  name: Translated;
  colormap: string;
  range: readonly [number, number];
  opacity: number;
}

/** The anatomical fibre classes, in the order the Tracts list shows them. */
export const TRACT_CLASSES = ['association', 'projection', 'commissural'] as const;
export type TractClass = (typeof TRACT_CLASSES)[number];

export interface TractBundle {
  id: string;
  file: string;
  name: Translated;
  class: TractClass;
  /** A numbered segment's anatomical part (TractSeg's CC_1–CC_7). */
  segment?: Translated;
  initial?: boolean;
  /** The atlas files an averaged bundle is made of (scripts/prepare_diffusion_mni152.py). */
  sources?: readonly string[];
}

/** One diffusion dataset's catalog (`data/diffusion-*.yaml`), as authored. */
export interface TractCatalog {
  id: string;
  name: Translated;
  source: string;
  license: string;
  provenance: string;
  anatomy: string;
  reference_space: string;
  overlay_cortex_opacity: number;
  resample_step_mm: number;
  /** What the Tracts tab says of the dataset: its name, what the view is, its source link and its files. */
  text: Readonly<
    Record<
      'en' | 'fr',
      Readonly<Record<'dataset' | 'reference' | 'source' | 'otherAnatomy' | 'files', string>>
    >
  >;
  brain_outline: {
    file: string;
    provenance: string;
    source: string;
    intensity_threshold: number;
    step_size: number;
    opacity: number;
  };
  maps: readonly TractMap[];
  bundles: readonly TractBundle[];
  /** Present when the tracts are an averaged atlas placed on a template, not tracked in the anatomy. */
  atlas?: {
    archive: string;
    url: string;
    sha256: string;
    keep_every: number;
    voxel_centre_correction_mm: readonly number[];
    minimum_white_matter_share: number;
  };
}

const cdmd = cdmdRecords as TractCatalog;

/** Every tract catalog loaded so far; config/model.yaml's tract_catalogs names the files. */
export const TRACT_CATALOGS: TractCatalog[] = [cdmd];

let template: Promise<unknown> | undefined;

/**
 * Adds the MNI template's catalog, fetched when that brain is opened and before anything reads
 * `tractCatalog` for it (BUILD-15). Any other anatomy has no catalog beyond CDMD's to add.
 */
export function loadTractCatalog(anatomy: string): Promise<unknown> | undefined {
  if (anatomy === 'mni152') {
    template ??= import('../../../../../data/diffusion-mni152.yaml').then((records) =>
      TRACT_CATALOGS.push(records.default as TractCatalog),
    );
  }
  return template;
}

/** An anatomy's own tracts, or CDMD's as an independent reference for one without. */
export function tractCatalog(anatomy: string): TractCatalog {
  return TRACT_CATALOGS.find((catalog) => catalog.anatomy === anatomy) ?? cdmd;
}

/** The ids of an anatomy's own tract bundles; none for an anatomy whose tracts are a reference. */
export function ownTractIds(anatomy: string): string[] {
  const catalog = tractCatalog(anatomy);
  return catalog.anatomy === anatomy ? catalog.bundles.map((bundle) => bundle.id) : [];
}
