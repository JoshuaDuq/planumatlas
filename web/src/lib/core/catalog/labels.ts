import type { Language, Region } from '../../types/index.ts';
import { nextbrainSystem } from './nextbrain-systems.ts';
import { DESTRIEUX_LABELS } from './destrieux-labels.ts';
import { dominantNetwork, networkName } from './networks.ts';
import { DESTRIEUX_LABELS_FR } from './destrieux-labels.fr.ts';
import { julichLabel, LOBE_FR } from './julich-labels.ts';
import { schaeferLabel } from './schaefer-labels.ts';
import { NEXTBRAIN_LABELS_FR } from './nextbrain-labels.fr.ts';
import { STRUCTURE_LABELS } from './structure-groups.ts';
import { STRUCTURE_LABELS_FR } from './structure-groups.fr.ts';
import { DESIKAN_LOBES, DESIKAN_REGIONS } from './desikan-labels.ts';
import { WHITE_MATTER_LABELS } from './white-matter-labels.ts';
import { WHITE_MATTER_LABELS_FR } from './white-matter-labels.fr.ts';
import { canonicalSourceName } from './source-names.ts';

/** A region's display name, short code, navigation group and search aliases. */
export interface RegionLabel {
  name: string;
  code: string | null;
  group: string;
  subgroup?: string | null;
  aliases: string[];
}

const UNLABELLED: Record<Language, RegionLabel> = {
  en: { name: 'Unlabelled', code: null, group: 'Unlabelled', aliases: [] },
  fr: { name: 'Non étiqueté', code: null, group: 'Non étiqueté', aliases: [] },
};

const BUCKETS = ['A–C', 'D–F', 'G–I', 'J–L', 'M–O', 'P–R', 'S–U', 'V–Z'];

/** HCP-MMP codes are cleaned mechanically: `L_V1_ROI` -> `V1`. Never expanded. */
const hcpCode = (sourceName: string) => sourceName.replace(/^[LR]_/, '').replace(/_ROI$/, '');

const capitalised = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

/**
 * Published NextBrain names are lowercase snake_case: the separator becomes a space and the first
 * letter a capital, as every other atlas's names are written. The words stay the published ones,
 * but for its cortex, whose Desikan-Killiany names FreeSurfer runs together: those are written out.
 */
const readable = (sourceName: string) =>
  capitalised(DESIKAN_REGIONS[sourceName]?.structure ?? sourceName.replaceAll('_', ' '));

function alphabeticalBucket(code: string): string {
  const first = code[0].toUpperCase();
  if (first >= '0' && first <= '9') return '0–9';
  const index = Math.floor((first.charCodeAt(0) - 65) / 3);
  return BUCKETS[index] ?? BUCKETS.at(-1)!;
}

/** Systems outside the cerebral hemispheres: a see-through cerebral cortex reveals nothing of them. */
const OUTSIDE_CEREBRUM = new Set(['Cerebellum', 'Brainstem']);

/**
 * Whether the cerebral cortex hides a region: a structure of the forebrain's deep systems (basal
 * ganglia, thalamus, limbic structures, fornix, corpus callosum), not one of the cerebellum or brainstem.
 */
export const beneathCortex = (region: Region) =>
  region.kind === 'structure' && !OUTSIDE_CEREBRUM.has(labelOf(region, 'en')!.group);

/**
 * A region's display name, short code, navigation group and search aliases.
 *
 * Destrieux and aseg names come from curated tables. HCP-MMP has no name table
 * in this repository, so its areas keep their published codes rather than
 * being given invented expansions. NextBrain follows the same rule: its French
 * table is filled in as terms are verified, and every name it does not cover
 * falls back to the published English one.
 *
 * HCP-MMP's 360 codes group by the network they mostly fall in. Alphabetical
 * buckets ordered them without telling a reader anything, and the network is
 * measured on this surface rather than asserted. Destrieux keeps its lobes:
 * those name where a fold is, which is what that atlas is for. Julich-Brain's
 * areas join the same lobes through the location each of its names gives.
 * Schaefer's parcels group by the Yeo network each is published in.
 */
export function labelOf(region: Region, lang: Language = 'en'): RegionLabel | null {
  const isFr = lang === 'fr';
  if (region.kind === 'non-region') return isFr ? UNLABELLED.fr : UNLABELLED.en;

  if (
    region.atlas === 'learning' ||
    region.atlas === 'arterial' ||
    region.atlas === 'nettekoven' ||
    region.atlas === 'choi' ||
    region.supplemental
  ) {
    return {
      name: region.display_names![lang],
      code: null,
      group: region.system_names![lang],
      subgroup: region.family_names?.[lang] ?? region.family ?? null,
      aliases: [region.source_name, ...(region.aliases?.[lang] ?? [])].filter(
        (alias): alias is string => Boolean(alias),
      ),
    };
  }

  const sourceName = region.source_name!;

  // NextBrain names are published for both its solid nuclei and its cut-only
  // regions, so the atlas decides this before the kind does.
  if (region.atlas === 'nextbrain') {
    const entry = isFr ? NEXTBRAIN_LABELS_FR[sourceName] : undefined;
    const name = entry?.name ?? readable(sourceName);
    return {
      name,
      code: null,
      group: nextbrainSystem(region, lang),
      aliases: entry?.aliases ?? (isFr ? [] : (DESIKAN_REGIONS[sourceName]?.aliases ?? [])),
    };
  }

  if (region.atlas === 'wmparc') {
    const entry =
      (isFr ? WHITE_MATTER_LABELS_FR[sourceName] : undefined) ?? WHITE_MATTER_LABELS[sourceName];
    if (!entry) return null;
    return { name: entry.name, code: null, group: entry.group, aliases: entry.aliases };
  }

  if (region.kind === 'structure') {
    const table = isFr ? STRUCTURE_LABELS_FR : STRUCTURE_LABELS;
    const entry = table[sourceName] ?? STRUCTURE_LABELS[sourceName];
    if (!entry) return null;
    return { name: entry.name, code: null, group: entry.system, aliases: [] };
  }

  if (region.atlas === 'hcp-mmp') {
    const code = hcpCode(sourceName);
    const network = dominantNetwork(region);
    return {
      name: code,
      code,
      group: network ? networkName(network, lang) : alphabeticalBucket(code),
      aliases: [],
    };
  }

  if (region.atlas === 'julich') return julichLabel(sourceName, lang);

  // NextBrain's cortex carries the same Desikan-Killiany names, so its French table serves both.
  if (region.atlas === 'desikan') {
    const lobe = DESIKAN_LOBES[sourceName];
    if (!lobe) return null;
    const entry = isFr ? NEXTBRAIN_LABELS_FR[sourceName] : undefined;
    return {
      name: entry?.name ?? readable(sourceName),
      code: null,
      group: isFr ? LOBE_FR[lobe]! : lobe,
      aliases: entry?.aliases ?? (isFr ? [] : (DESIKAN_REGIONS[sourceName]?.aliases ?? [])),
    };
  }

  if (region.atlas === 'schaefer') return schaeferLabel(region, lang);

  const key = canonicalSourceName(sourceName);
  const table = isFr ? DESTRIEUX_LABELS_FR : DESTRIEUX_LABELS;
  const entry = table[key] ?? DESTRIEUX_LABELS[key];
  if (!entry) return null;
  return {
    name: entry.name,
    code: null,
    group: entry.lobe,
    aliases: entry.aliases ?? [],
  };
}
