// Where each tract's streamlines end on the cortex (supervisor review 4.3), measured on the
// subject's own aparc.a2009s+aseg by brain_model/layers/tract_ends.py. Only CDMD's tracts have it.
import cdmdEnds from '../../../../../public/diffusion/cdmd-sub-013/tract-ends.json' with { type: 'json' };
import type { TractCatalog } from './catalogs.ts';

export interface TractEnds {
  radius_mm: number;
  minimum_share: number;
  method: string;
  bundles: Record<string, { ends: number; regions: [string, number][] }>;
}

const ENDS: Readonly<Record<string, TractEnds>> = {
  'cdmd-sub-013': cdmdEnds as unknown as TractEnds,
};

/** The ends a catalog's bundles reach, checked against its bundles; null for a catalog without them. */
export function tractEnds(catalog: Pick<TractCatalog, 'id' | 'bundles'>): TractEnds | null {
  const ends = ENDS[catalog.id] ?? null;
  if (!ends) return null;
  const ids = catalog.bundles.map((bundle) => bundle.id);
  if (Object.keys(ends.bundles).sort().join() !== [...ids].sort().join()) {
    throw new Error(`The tract ends of ${catalog.id} do not match its bundles.`);
  }
  return ends;
}
