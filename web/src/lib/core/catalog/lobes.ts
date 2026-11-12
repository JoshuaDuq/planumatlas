import type { Language, Region, Rgb } from '../../types/index.ts';
import { labelOf } from './labels.ts';

/**
 * The atlases whose regions the list groups by lobe (labels.ts): Destrieux by its own table, and
 * Julich-Brain through each area's location tag. HCP-MMP and Schaefer group by network instead.
 */
const LOBE_ATLASES: ReadonlySet<string> = new Set(['destrieux', 'julich']);

/** The atlas a lobe colouring shows when the one on screen has no lobes. */
export const LOBE_ATLAS = 'destrieux';

export const groupsByLobe = (atlas: string | null | undefined): boolean =>
  LOBE_ATLASES.has(atlas ?? '');

/**
 * The colouring a page opened plainly, and Start over, show: the lobes, which the stage can key in
 * nine rows, where the atlas has them; an atlas's own region colours otherwise. A link's own colour
 * is never replaced by it.
 */
export const openingColour = (atlas: string): 'lobe' | 'atlas' =>
  groupsByLobe(atlas) ? 'lobe' : 'atlas';

/**
 * One colour per lobe, in the order the key lists them: front to back over the convexity, then the
 * cortex the convexity hides. The nine colours of Paul Tol's "muted" qualitative scheme
 * (https://sronpersonalpages.nl/~pault/, Fig. 4; values checked against that page 2026-11-11),
 * designed to stay distinct under the common colour-vision deficiencies. A lobe is a navigation
 * group, not a measured boundary (destrieux-labels.ts), so these colours are the interface's and no
 * atlas publishes them.
 */
export const LOBE_COLORS: Readonly<Record<string, Rgb>> = {
  Frontal: [136, 204, 238],
  Central: [204, 102, 119],
  Parietal: [221, 204, 119],
  Occipital: [68, 170, 153],
  Temporal: [170, 68, 153],
  'Lateral fissure': [153, 153, 51],
  Insula: [17, 119, 51],
  Cingulate: [51, 34, 136],
  Limbic: [136, 34, 85],
};

const lobes = new WeakMap<Region, string | null>();

/** The lobe a cortical region is listed under, by its English name; null for any other region. */
export function lobeOf(region: Region): string | null {
  if (region.kind !== 'cortex' || !groupsByLobe(region.atlas)) return null;
  let lobe = lobes.get(region);
  if (lobe === undefined) {
    lobe = labelOf(region, 'en')?.group ?? null;
    if (lobe !== null && !(lobe in LOBE_COLORS)) {
      throw new Error(`No colour for the lobe ${lobe} of ${region.id}.`);
    }
    lobes.set(region, lobe);
  }
  return lobe;
}

/** The colour a region takes under the lobe colouring; null where it keeps its tissue colour. */
export function lobeColor(region: Region): Rgb | null {
  const lobe = lobeOf(region);
  return lobe === null ? null : LOBE_COLORS[lobe]!;
}

/** The lobes an atlas's regions fall in, in key order, each by its group's name (lobeKeyRows qualifies a shared one). */
export function lobeRows(
  regions: Iterable<Region>,
  atlas: string,
  lang: Language,
): { id: string; color: Rgb; label: string }[] {
  const names = new Map<string, string>();
  for (const region of regions) {
    if (region.atlas !== atlas) continue;
    const lobe = lobeOf(region);
    if (lobe !== null && !names.has(lobe)) names.set(lobe, labelOf(region, lang)!.group);
  }
  return Object.entries(LOBE_COLORS)
    .filter(([lobe]) => names.has(lobe))
    .map(([lobe, color]) => ({ id: lobe, color, label: names.get(lobe)! }));
}
