import type { Region } from '../../types/index.ts';
import { labelOf } from './labels.ts';
import { belongsToDetail } from './visibility.ts';

/**
 * Where a grouped unit's parts can be shown on their own: the level that draws them and the system
 * they belong to there. The drawn parts must share one level and one system, and be more than half
 * of that system's structures on the unit's side. A unit that is a small share of a system has no
 * such view: showing the system would show mostly something else.
 */
export function partsSystem(
  unit: Region,
  regions: ReadonlyMap<string, Region>,
): { detail: string; system: string } | null {
  const parts = (unit.constituent_regions ?? [])
    .map((id) => {
      const part = regions.get(id);
      if (!part) throw new Error(`Missing learning constituent: ${id}`);
      return part;
    })
    .filter((part) => part.kind === 'structure');
  const details = new Set(parts.map((part) => part.atlas!));
  if (details.size !== 1) return null;
  const systems = new Set(parts.map((part) => labelOf(part, 'en')!.group));
  if (systems.size !== 1) return null;
  const [detail] = details as Set<string>;
  const [system] = systems as Set<string>;
  let members = 0;
  for (const region of regions.values()) {
    if (
      region.kind === 'structure' &&
      belongsToDetail(region, detail!) &&
      (unit.hemisphere === 'midline' || region.hemisphere === unit.hemisphere) &&
      labelOf(region, 'en')!.group === system
    ) {
      members += 1;
    }
  }
  return parts.length * 2 > members ? { detail: detail!, system: system! } : null;
}
