/**
 * Which labels a cut samples. They are not a choice of their own: a cut shows inside what the stage
 * shows outside, so the labels follow the masthead's Atlas, Colour and Internal anatomy. A colouring
 * drawn from a cut-only atlas (the arterial territories, the striatal networks, the cerebellar
 * functional regions) samples that atlas; an internal-anatomy level with labels of its own
 * (NextBrain) samples those; anything else samples the surface atlas. A paint names the surface
 * atlas's regions, so it keeps the surface atlas.
 */
import type { CutMode, DisplaySettings, Region, SurfaceColor } from '../../types/index.ts';

/** The colourings that are a cut-only atlas's own map, by that atlas. */
export const MAP_ATLASES = {
  territory: 'arterial',
  striatal: 'choi',
  cerebellar: 'nettekoven',
} as const satisfies Partial<Record<SurfaceColor, string>>;

type MapColour = keyof typeof MAP_ATLASES;

/**
 * The maps that colour the cortex too, as the surface draws them vertex by vertex: a cut draws them
 * in the cortical ribbon voxel by voxel. Every other cut keeps the surface atlas's own parcels there.
 */
export const CORTICAL_MAPS: ReadonlySet<string> = new Set([MAP_ATLASES.territory]);

/**
 * The maps the structures' surfaces draw too, by the detail levels whose structures carry them (the cerebellar
 * cortex and lobules, which hold its shares): there their regions are on show with no cut.
 */
export const SURFACE_MAPS: Readonly<Record<string, readonly string[]>> = {
  [MAP_ATLASES.cerebellar]: ['aseg', 'learning'],
};

const isMapColour = (colour: string): colour is MapColour => Object.hasOwn(MAP_ATLASES, colour);

/** The colouring whose map is this cut atlas, or null for labels no colouring brings. */
export function mapColourOf(cutAtlas: string): MapColour | null {
  return (
    (Object.keys(MAP_ATLASES) as MapColour[]).find((colour) => MAP_ATLASES[colour] === cutAtlas) ??
    null
  );
}

/**
 * The plane a map seen only on cuts opens on, through its centre: the one that shows the most of it
 * there on CDMD (striatal networks axial, 10 of 14 against 6 coronal; cerebellar regions coronal, 26
 * of 32 against 24 axial).
 */
const MAP_PLANES = { striatal: 'axial', cerebellar: 'coronal' } as const satisfies Partial<
  Record<MapColour, CutMode>
>;

/**
 * The cut choosing this colour opens, through its map regions' voxel-weighted centre in surface RAS
 * millimetres; null for a colour the surface shows.
 */
export function mapCut(
  colour: SurfaceColor,
  regions: Iterable<Region>,
): { plane: CutMode; centre: [number, number, number] } | null {
  if (!Object.hasOwn(MAP_PLANES, colour)) return null;
  const atlas = MAP_ATLASES[colour as keyof typeof MAP_PLANES];
  const centre: [number, number, number] = [0, 0, 0];
  let voxels = 0;
  for (const region of regions) {
    if (region.atlas !== atlas) continue;
    const { voxel_count: count, centroid_ras_mm: centroid } = region;
    if (!count || !centroid) throw new Error(`${region.id} has no voxels to place a cut by.`);
    for (const axis of [0, 1, 2] as const) centre[axis] += centroid[axis] * count;
    voxels += count;
  }
  if (!voxels) throw new Error(`No ${atlas} region to cut through.`);
  return {
    plane: MAP_PLANES[colour as keyof typeof MAP_PLANES],
    centre: centre.map((sum) => sum / voxels) as [number, number, number],
  };
}

/** The cut atlases whose cuts draw a cut-only region: its own, unless it is published for others. */
export const cutAtlasesOf = (region: Region): readonly (string | null | undefined)[] =>
  region.cut_atlases ?? [region.atlas];

/**
 * The cut atlas the stage's settings call for, from the ids the build publishes. The surface atlas
 * must be one of them: every surface atlas is published with its labels projected into the ribbon.
 */
export function cutAtlasFor(
  {
    atlas,
    detail,
    surfaceColor,
    paint,
  }: Pick<DisplaySettings, 'atlas' | 'detail' | 'surfaceColor' | 'paint'>,
  published: ReadonlySet<string>,
): string {
  if (!paint) {
    const map = isMapColour(surfaceColor) ? MAP_ATLASES[surfaceColor] : null;
    if (map && published.has(map)) return map;
    if (published.has(detail)) return detail;
  }
  if (!published.has(atlas)) throw new Error(`No cut labels are published for the ${atlas} atlas.`);
  return atlas;
}

/**
 * Why a cut-only region is not on the cut although a cut may be: the colouring shown puts other
 * labels there, or the internal-anatomy level does. A region of a map is shown by that map's colour
 * and one of NextBrain by its level; one the surface atlases' cuts share (gyral white matter) is
 * shown once neither the colouring nor the level replaces the surface atlas's labels. Null while its
 * labels are the cut's.
 */
export function cutLabelsReason(
  region: Region,
  cutAtlas: string,
): 'other-colour' | 'other-detail' | null {
  const atlases = cutAtlasesOf(region);
  if (atlases.includes(cutAtlas)) return null;
  const own = atlases.find((id) => id === region.atlas);
  const replacing = own ?? cutAtlas;
  return mapColourOf(replacing) ? 'other-colour' : 'other-detail';
}

/**
 * The colouring that puts a region on the cut: its map's, or, for a region the surface atlases'
 * cuts share, the atlas's own colours.
 */
export function colourShowing(region: Region): SurfaceColor {
  return (
    cutAtlasesOf(region)
      .map((id) => (id ? mapColourOf(id) : null))
      .find((colour) => colour !== null) ?? 'atlas'
  );
}
