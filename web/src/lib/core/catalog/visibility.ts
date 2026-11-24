import type { DisplaySettings, Region } from '../../types/index.ts';
import { MAP_ATLASES, SURFACE_MAPS, cutAtlasesOf, cutLabelsReason } from './cut-labels.ts';
import { labelOf } from './labels.ts';

/**
 * Where a region's geometry lives, and therefore what can hide it.
 *
 * Cortical patches and the two unlabelled medial surfaces live in a per-atlas
 * surface layer. Structures live in a detail level — two segmentations of the
 * same internal anatomy, of which exactly one is drawn. A tissue region has no
 * mesh at all: it is drawn only where the cut plane samples its label volume,
 * so the surface atlas and the cortex controls cannot hide it, and with no cut
 * on screen it is nowhere at all.
 */
const isSurface = (region: Region) => region.kind === 'cortex' || region.kind === 'non-region';
const isStructure = (region: Region) => region.kind === 'structure';
const isTissue = (region: Region) => region.kind === 'tissue-region';
// The build calls a label no area either the medial wall or, in Julich-Brain, a gap map: cortex
// not yet mapped. The wall closes the surface across the corpus callosum, ventricles and
// thalamus, so drawn with them it would cover real anatomy.
const isMedialWall = (region: Region) => {
  if (region.kind !== 'non-region') return false;
  if (!region.source_name) throw new Error(`Non-region ${region.id} has no source name.`);
  return !region.source_name.startsWith('GapMap-');
};
/**
 * The display settings `visibilityOf` reads. No other setting puts a region on screen or takes it
 * off, so a walk over every region that reads only these need not run again when they hold.
 */
export const VISIBILITY_SETTINGS = [
  'atlas',
  'detail',
  'internalSystem',
  'internalConstituents',
  'cutAtlas',
  'cutActive',
  'hemisphere',
  'cortexVisible',
  'cortexOpacity',
  'internalVisible',
  'spinalCordVisible',
  'surfaceColor',
  'hiddenRegions',
  'isolatedRegion',
] as const satisfies readonly (keyof DisplaySettings)[];
export type VisibilitySettings = Pick<DisplaySettings, (typeof VISIBILITY_SETTINGS)[number]>;

export const belongsToDetail = (region: Region, detail: string) =>
  region.supplemental === true ||
  region.atlas === detail ||
  Boolean(region.also_drawn_in?.includes(detail));
// Gyral white matter is drawn on the white envelope's cut face, which the cortex controls hide.
const followsCortex = (region: Region) => isSurface(region) || region.atlas === 'wmparc';

const hemisphereAllows = (region: Region, settings: VisibilitySettings) =>
  settings.hemisphere === 'both' ||
  region.hemisphere === 'midline' ||
  region.hemisphere === settings.hemisphere;

/** The overview's source constituents inherit its system, irrespective of atlas taxonomy. */
export function internalSystemAllows(region: Region, settings: VisibilitySettings): boolean {
  if (!settings.internalSystem || isSurface(region)) return true;
  if (settings.detail === 'learning' && region.atlas !== 'learning' && !region.supplemental) {
    return settings.internalConstituents.has(region.id);
  }
  return labelOf(region, 'en')!.group === settings.internalSystem;
}

/** A map's region the stage draws on its structures' surfaces, with or without a cut (`SURFACE_MAPS`). */
const onSurfaces = (region: Region, settings: VisibilitySettings) =>
  region.atlas === settings.cutAtlas &&
  Boolean(SURFACE_MAPS[region.atlas]?.includes(settings.detail)) &&
  settings.internalVisible !== false;

/** With no cut, an isolated cerebellar map region is drawn on the cerebellar surfaces that hold it. */
const drawsIsolated = (region: Region, settings: VisibilitySettings) =>
  !settings.cutActive &&
  settings.cutAtlas === MAP_ATLASES.cerebellar &&
  Boolean(region.cerebellar_functions?.some(({ region: id }) => id === settings.isolatedRegion));

export type HiddenReason =
  | 'no-mri'
  | 'below-cut-resolution'
  | 'other-colour'
  | 'no-cut'
  | 'other-detail'
  | 'other-atlas'
  | 'other-system'
  | 'hemisphere'
  | 'cortex-hidden'
  | 'internal-hidden'
  | 'internal-shown'
  | 'spinal-cord-hidden'
  | 'removed'
  | 'isolated';

export type Visibility = { visible: true; reason: null } | { visible: false; reason: HiddenReason };

/**
 * Whether a region is currently on screen, and if not, why.
 *
 * The single source of truth for that question. The model applies it to
 * meshes; the navigator uses `reason` to explain an absence instead of
 * silently omitting the row. Two implementations would drift, and the drift
 * would be invisible.
 */
export function visibilityOf(region: Region, settings: VisibilitySettings): Visibility {
  const hidden = (reason: HiddenReason): Visibility => ({ visible: false, reason });
  if (settings.surfaceColor === 'mri' && region.mri_registered === false) return hidden('no-mri');
  // The cut's labels follow the surface atlas and the detail level, so a parcel or a structure the
  // stage does not show is on no cut either.
  if (isTissue(region)) {
    // Measured in its source grid, but smaller than any block its cut samples.
    if (!cutAtlasesOf(region).length) return hidden('below-cut-resolution');
    // The cut's labels follow the colouring and the internal anatomy, so either can be the remedy.
    const relabelled = settings.cutAtlas && cutLabelsReason(region, settings.cutAtlas);
    if (relabelled) return hidden(relabelled);
    if ((!settings.cutActive || !settings.cutAtlas) && !onSurfaces(region, settings)) {
      return hidden('no-cut');
    }
  } else if (isStructure(region)) {
    if (!belongsToDetail(region, settings.detail)) return hidden('other-detail');
  } else if (isSurface(region) && region.atlas !== settings.atlas) {
    return hidden('other-atlas');
  }
  if (!internalSystemAllows(region, settings)) return hidden('other-system');
  if (!hemisphereAllows(region, settings)) return hidden('hemisphere');
  if (followsCortex(region) && !(settings.cortexVisible && settings.cortexOpacity > 0)) {
    return hidden('cortex-hidden');
  }
  if (isStructure(region) && settings.internalVisible === false) {
    return hidden('internal-hidden');
  }
  if (isMedialWall(region) && settings.internalVisible !== false) return hidden('internal-shown');
  if (region.atlas === 'pam50' && settings.spinalCordVisible === false) {
    return hidden('spinal-cord-hidden');
  }
  if (settings.hiddenRegions?.has(region.id)) return hidden('removed');
  if (
    settings.isolatedRegion &&
    region.id !== settings.isolatedRegion &&
    !drawsIsolated(region, settings)
  ) {
    return hidden('isolated');
  }
  return { visible: true, reason: null };
}
