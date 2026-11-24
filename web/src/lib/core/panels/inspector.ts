import type { Explorer, Language, Region } from '../../types/index.ts';
import { count } from '../format.ts';
import { atlasSwitchLabel, t } from '../i18n/index.ts';

/**
 * What the inspector shows when a region is or is not selected.
 *
 * The empty anatomy panel is a hint. It does not repeat atlas, surface,
 * hemisphere or cut — those belong to the View and Sections tasks.
 */
export function inspectorEmptyChrome({
  selectedRegion,
  explorer,
}: {
  selectedRegion: Region | null;
  explorer: Explorer;
}) {
  const hasRegion = Boolean(selectedRegion);
  const quiet = !hasRegion && explorer !== 'anatomy';
  return {
    hideTitle: !hasRegion,
    hideHint: quiet,
    hideFacts: !hasRegion,
    hideActions: !hasRegion,
  };
}

/** A learning-atlas union can carry fifty source ids; past this many they are counted. */
const MAX_LISTED_SOURCE_IDS = 8;

export interface SourceLabel {
  atlas: string;
  ids: string | null;
  stacked: boolean;
  /** The complete id list, when the row counts them instead of listing them. */
  all?: string;
}

/**
 * The source label row: the source atlas, then its label ids in the code voice. Two ids
 * share the label's line; a longer list, or a reference with no id, takes the line under it.
 */
export function sourceLabel(
  region: Pick<Region, 'source_atlas' | 'source_label_id' | 'source_label_ids'> & {
    atlas: string;
  },
  lang: Language,
): SourceLabel {
  const ids = region.source_label_ids;
  const sourceAtlas = atlasSwitchLabel(region.source_atlas ?? region.atlas, lang);
  if (!ids && region.source_label_id == null) {
    const atlases: Record<string, string | undefined> = t(lang, 'atlases');
    return { atlas: atlases[region.atlas] ?? sourceAtlas, ids: null, stacked: true };
  }
  if (!ids) return { atlas: sourceAtlas, ids: String(region.source_label_id), stacked: false };
  if (ids.length > MAX_LISTED_SOURCE_IDS) {
    return {
      atlas: `${sourceAtlas} · ${count(ids.length, 'label', lang)}`,
      ids: null,
      stacked: false,
      all: ids.join(', '),
    };
  }
  return { atlas: sourceAtlas, ids: ids.join(', '), stacked: ids.length > 2 };
}

/** How many functions and deficits the lead names; the sections below list them all. */
const LEAD_NAMES = 2;

/** One labelled row of the lead: what kind of fact it is, then the region's value for it. */
export type LeadRow = [label: string, value: string];

/**
 * The region at a glance for a reader new to it (2026-11-20 review): its network, its strongest
 * functions and the deficits mapped on it, each as its section has it, one labelled row apiece.
 * A region with none has no rows.
 */
export function regionLead(
  {
    network,
    functions,
    deficits,
  }: { network: string | null; functions: readonly string[]; deficits: readonly string[] },
  lang: Language,
): LeadRow[] {
  const copy = t(lang, 'inspector').lead;
  const named = (names: readonly string[]) => names.slice(0, LEAD_NAMES).join(', ');
  const rows: LeadRow[] = [];
  if (network) rows.push([copy.network, network]);
  if (functions.length) rows.push([copy.functions, named(functions)]);
  if (deficits.length) rows.push([copy.deficits, named(deficits)]);
  return rows;
}
