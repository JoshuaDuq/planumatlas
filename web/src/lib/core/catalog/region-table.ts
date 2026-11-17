import type { Region } from '../../types/index.ts';
import { encodeCsv } from '../csv.ts';
import { labelOf } from './labels.ts';
import { belongsToDetail } from './visibility.ts';

/** What the table covers: one surface atlas and one internal-anatomy level of one brain. */
export interface RegionTableScope {
  anatomy: string;
  atlas: string;
  detail: string;
  regions: readonly Region[];
}

const required = <T>(value: T | undefined, field: string, region: Region): T => {
  if (value === undefined) throw new Error(`Region ${region.id} has no ${field}.`);
  return value;
};

/** The areas of the atlas, then the structures of the level, in manifest order; unlabelled surface is no region. */
const tabled = ({ atlas, detail, regions }: RegionTableScope) =>
  regions.filter(
    (region) =>
      (region.kind === 'cortex' && region.atlas === atlas) ||
      (region.kind === 'structure' && belongsToDetail(region, detail)),
  );

function row(region: Region) {
  const en = labelOf(region, 'en')!;
  const fr = labelOf(region, 'fr')!;
  const cortex = region.kind === 'cortex';
  const [cx, cy, cz] = required(region.centroid_ras_mm, 'centroid', region);
  const [ax, ay, az] = required(region.anchor_ras_mm, 'anchor', region);
  // Both lists are published largest first.
  const network = region.networks?.[0];
  const territory = region.territories?.[0];
  return {
    id: region.id,
    atlas: required(region.atlas, 'atlas', region),
    name_en: en.name,
    name_fr: fr.name,
    hemisphere: region.hemisphere,
    group_en: en.group,
    group_fr: fr.group,
    source_label: required(region.source_name, 'source label', region),
    surface_area_mm2: cortex ? required(region.surface_area_mm2, 'surface area', region) : '',
    volume_mm3: cortex ? '' : required(region.segmentation_volume_mm3, 'volume', region),
    centroid_surface_ras_x_mm: cx,
    centroid_surface_ras_y_mm: cy,
    centroid_surface_ras_z_mm: cz,
    anchor_surface_ras_x_mm: ax,
    anchor_surface_ras_y_mm: ay,
    anchor_surface_ras_z_mm: az,
    largest_network: network?.network ?? '',
    largest_network_share: network?.fraction ?? '',
    largest_territory: territory?.territory ?? '',
    largest_territory_share: territory?.fraction ?? '',
  };
}

/** One row per region of the shown atlas and internal-anatomy level, at the manifest's full precision. */
export function regionTableCsv(scope: RegionTableScope): string {
  const rows = tabled(scope).map(row);
  if (!rows.length) throw new Error(`No regions in ${scope.atlas} or ${scope.detail}.`);
  return encodeCsv(rows);
}

export const regionTableFilename = ({ anatomy, atlas, detail }: RegionTableScope) =>
  `planum-regions-${anatomy}-${atlas}-${detail}.csv`;
