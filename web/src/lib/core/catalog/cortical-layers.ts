import type { Paint, Region, Rgb, SessionState } from '../../types/index.ts';

/** The six cortical layers, from the pial surface in. */
export const LAYERS = ['I', 'II', 'III', 'IV', 'V', 'VI'] as const;
/** Layer IV, the granular layer: thick in sensory cortex, almost absent in motor cortex. */
export const LAYER_IV = 3;
/** A parcel's shares are published in thousandths that sum to this. */
const WHOLE = 1000;

/**
 * BigBrain's cortical layers (`manifest.cortical_layers` file). Each cortical parcel's six layer shares,
 * in thousandths of the six thicknesses' sum, are one post-mortem brain's (Wagstyl et al. 2020) at the
 * parcel of the same name on fsaverage. For twelve Julich-Brain areas, the cells detected per (0.1 mm)³
 * in each layer of image patches cut from the same brain reach the area by its name.
 */
export interface CorticalLayers {
  id: 'cortical-layers';
  /** The layers' paper (Wagstyl et al. 2020) and the collection that carried them to fsaverage (BigBrainWarp), as DOI links. */
  source: { paper: string; collection: string };
  layers: string[];
  /** The paint's steps: a parcel from `from` up to the next step takes its colour; the first is 0. */
  layer_iv_scale: { from: number; color: Rgb }[];
  /** Region id to its six shares in thousandths. */
  regions: Record<string, number[]>;
  cells: {
    datasets: CellDataset[];
    /** Region id to the dataset measured in its Julich-Brain area. */
    regions: Record<string, string>;
  };
}

export interface CellDataset {
  key: string;
  /** The Julich-Brain area the patches were cut from. */
  area: string;
  doi: string;
  patches: number;
  /** Cells per (0.1 mm)³ in each layer: the mean and SD over the patches. */
  mean: number[];
  sd: number[];
}

const sixOf = (values: unknown, valid: (value: number) => boolean) =>
  Array.isArray(values) &&
  values.length === LAYERS.length &&
  values.every((value) => typeof value === 'number' && valid(value));

/** The published file, checked against the regions it names: each a cortical parcel of the atlas its id names. */
export function validateCorticalLayers(
  data: CorticalLayers,
  regions: ReadonlyMap<string, Region>,
): CorticalLayers {
  const scale = data?.layer_iv_scale;
  const parcel = (id: string, atlas?: string) => {
    const region = regions.get(id);
    return (
      region?.kind === 'cortex' &&
      region.atlas === id.slice(0, id.indexOf(':')) &&
      (atlas === undefined || region.atlas === atlas)
    );
  };
  if (
    data?.id !== 'cortical-layers' ||
    ![data.source?.paper, data.source?.collection].every((doi) =>
      doi?.startsWith('https://doi.org/'),
    ) ||
    data.layers?.join() !== LAYERS.join() ||
    !Array.isArray(scale) ||
    scale[0]?.from !== 0 ||
    scale.some((step, index) => index > 0 && !(step.from > scale[index - 1]!.from && step.from < 1))
  ) {
    throw new Error('Invalid cortical layers.');
  }
  for (const [id, shares] of Object.entries(data.regions)) {
    if (
      !parcel(id) ||
      !sixOf(shares, (value) => Number.isInteger(value) && value >= 0) ||
      shares.reduce((sum, value) => sum + value, 0) !== WHOLE
    ) {
      throw new Error(`Invalid cortical layer shares of ${id}.`);
    }
  }
  const keys = new Set(data.cells.datasets.map((dataset) => dataset.key));
  if (
    keys.size !== data.cells.datasets.length ||
    data.cells.datasets.some(
      (dataset) =>
        !dataset.doi.startsWith('https://doi.org/') ||
        !(dataset.patches >= 2) ||
        !sixOf(dataset.mean, (value) => value >= 0) ||
        !sixOf(dataset.sd, (value) => value >= 0),
    ) ||
    Object.entries(data.cells.regions).some(([id, key]) => !keys.has(key) || !parcel(id, 'julich'))
  ) {
    throw new Error('Invalid cortical cell counts.');
  }
  return data;
}

/**
 * Whether the stage draws layer IV's share, as `paintFor` does: asked for in Anatomy, not lifted by a
 * masthead choice, and the file downloaded. What names or cites the paint reads this, not the ask alone.
 */
export const layersPainted = (
  state: Pick<SessionState, 'explorer' | 'paintLifted' | 'layersShown'>,
  data: CorticalLayers | null,
): boolean =>
  state.explorer === 'anatomy' && !state.paintLifted && state.layersShown && data !== null;

/** The paint's sources, the layers' paper and the collection that carried them, while it is drawn; else null. */
export const paintedLayerSources = (
  state: Pick<SessionState, 'explorer' | 'paintLifted' | 'layersShown'>,
  data: CorticalLayers | null,
): [string, string] | null =>
  layersPainted(state, data) ? [data!.source.paper, data!.source.collection] : null;

/** A region's six shares as fractions, or null where none is published (no six layers, or no data). */
export function sharesOf(data: CorticalLayers | null, regionId: string): number[] | null {
  const shares = data?.regions[regionId];
  return shares ? shares.map((value) => value / WHOLE) : null;
}

/** The cell counts measured in a region's Julich-Brain area, or null. */
export function cellsOf(data: CorticalLayers | null, regionId: string): CellDataset | null {
  const key = data?.cells.regions[regionId];
  return key ? data!.cells.datasets.find((dataset) => dataset.key === key)! : null;
}

/** The step a layer IV share falls in. */
export function layerIvStep(data: CorticalLayers, share: number): number {
  let step = 0;
  data.layer_iv_scale.forEach((entry, index) => {
    if (share >= entry.from) step = index;
  });
  return step;
}

/** Layer IV's share across one atlas's cortex, each parcel in its step's colour; a parcel without shares keeps its tissue colour. */
export function layerPaint(data: CorticalLayers, atlas: string): Paint {
  const colors = new Map<string, Rgb>();
  for (const [id, shares] of Object.entries(data.regions)) {
    if (!id.startsWith(`${atlas}:`)) continue;
    colors.set(id, data.layer_iv_scale[layerIvStep(data, shares[LAYER_IV]! / WHOLE)]!.color);
  }
  return { id: `layers:${atlas}`, colors };
}
