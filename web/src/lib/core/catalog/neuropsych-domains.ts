import type { Language, Paint, Region, Rgb } from '../../types/index.ts';
import { FINDING_COLORS } from '../clinical/catalog.ts';
import { nearest } from './nearest.ts';

export interface DomainGroup {
  id: string;
  name: string;
  name_fr: string;
}

/** A curated neuropsychological function, as `neuropsych-domains.json` lists it. */
export interface Domain {
  id: string;
  name: string;
  name_fr: string;
  term: string;
  group: string;
  overview: boolean;
  color: Rgb;
  [field: string]: unknown;
}

export type TermKind = 'function' | 'population';

/** A searched Neurosynth term, shaped like a domain so the Functions list can treat both alike. */
export interface TermRecord {
  id: string;
  term: string;
  kind: TermKind;
  name: string;
  name_fr: string;
  overview: false;
  group: null;
  studies: number;
  searchKey: string;
  areas: { region: string; z: number }[];
  /** Its areas on each listed atlas with a term table (supervisor review 3.1), strongest first. */
  atlasAreas: Record<string, { region: string; z: number }[]>;
}

export type DomainRecord = Domain | TermRecord;

export interface DomainMember {
  domain: string;
  z: number;
}

export interface ZBand {
  from: number;
  color: Rgb;
}

/** `neurosynth-terms.json`. */
export interface NeurosynthTerms {
  id: string;
  atlas: string;
  structure_atlas: string;
  threshold_z: number;
  derivation: Record<string, unknown>;
  regions: string[];
  /** `[term, studies, kind, [[region index, z], …]]`. */
  terms: [string, number, TermKind, [number, number][]][];
  /** Those of `terms` neurosynth.org has no analysis page for. */
  neurosynth_org_missing: string[];
  /** Each listed atlas's regions, and each term's `[region index, z]` there at the threshold. */
  atlases: Record<string, { regions: string[]; terms: Record<string, [number, number][]> }>;
}

/** The validated term search, attached to the partition as `search`. */
export interface TermSearch {
  terms: Map<string, TermRecord>;
  /** The listed atlases the terms were measured on, where a term paints. */
  atlases: string[];
  derivation: Record<string, unknown>;
  /** The searched terms neurosynth.org has no analysis page for. */
  missingPages: string[];
}

/** `neuropsych-domains.json`; `validateNeuropsychDomains` attaches `search`. */
export interface NeuropsychDomains {
  id: string;
  atlas: string;
  structure_atlas: string;
  structures: string[];
  /** The teaching set, whose units in `units` are drawn with the score of the structure each names. */
  unit_atlas: string;
  units: Record<string, string>;
  threshold_z: number;
  z_scale: ZBand[];
  groups: DomainGroup[];
  domains: Domain[];
  regions: Record<string, DomainMember[]>;
  /** The other cortical atlases whose regions list functions, each having passed the measured gate. */
  region_atlases: string[];
  /** Their regions' domains, from each atlas's own parcel means; none of them is painted. */
  atlas_regions: Record<string, Record<string, DomainMember[]>>;
  derivation: { studies: Record<string, number>; [field: string]: unknown };
  lesion_checks: Record<string, unknown>;
  /** The curated functions' terms neurosynth.org has no analysis page for. */
  neurosynth_org_missing: string[];
  search?: TermSearch | null;
  [field: string]: unknown;
}

/**
 * Each HCP-MMP area's neuropsychological domains: those whose meta-analytic
 * association reaches the published threshold there, strongest first.
 */

/** The overview the Functions list opens with: every area drawn as its strongest overview domain. */
export const ALL_DOMAINS = 'all';

/** A searched Neurosynth term's function id is its term after this prefix. */
const TERM = 'term:';
export const isTermId = (id: unknown): id is string =>
  typeof id === 'string' && id.startsWith(TERM);

/** A comparison's id: the compared functions' ids, comma-separated, after this prefix. */
const COMPARE = 'compare:';
/**
 * Two functions: with the areas both reach, three colours, all the finding palette keeps apart from
 * one another and from tissue under colour-vision deficiency. A third would need a fourth.
 */
export const COMPARE_MIN = 2;
export const COMPARE_MAX = 2;
/** Each compared function's colour in order, then the colour of areas more than one reaches. */
export const COMPARE_COLORS: readonly Rgb[] = FINDING_COLORS.slice(0, COMPARE_MAX);
export const SHARED_COLOR: Rgb = FINDING_COLORS[COMPARE_MAX]!;

export const compareId = (ids: readonly string[]) => `${COMPARE}${ids.join(',')}`;

/** The functions a comparison names, in order; null for any other id. */
export const comparedIds = (id: string | null | undefined): string[] | null =>
  id?.startsWith(COMPARE) ? id.slice(COMPARE.length).split(',') : null;

/** Whether `id` compares two or three distinct published functions or terms. */
export function validComparison(partition: NeuropsychDomains, id: string): boolean {
  const ids = comparedIds(id);
  return (
    ids !== null &&
    ids.length >= COMPARE_MIN &&
    ids.length <= COMPARE_MAX &&
    new Set(ids).size === ids.length &&
    ids.every((member) => domainRecord(partition, member) !== null)
  );
}

/** A function's or a comparison's name; a comparison names its functions in order. */
export function functionName(partition: NeuropsychDomains, id: string, lang: Language): string {
  const ids = comparedIds(id) ?? [id];
  return ids
    .map((member) => {
      const record = domainRecord(partition, member);
      if (!record) throw new Error(`Unknown neuropsychological domain: ${member}`);
      return domainName(record, lang);
    })
    .join(' · ');
}

export interface ComparedArea {
  region: string;
  /** Each compared function's z here, in order; null where it falls below the threshold. */
  z: (number | null)[];
  /** How many of the compared functions reach the area. */
  reached: number;
}

/**
 * Every area or structure at least one compared function reaches, those more of them reach first,
 * then by the strongest z among them; ties keep the first function's order.
 */
export function comparedAreas(partition: NeuropsychDomains, id: string): ComparedArea[] {
  if (!validComparison(partition, id)) throw new Error(`Invalid comparison: ${id}`);
  const ids = comparedIds(id)!;
  const areas = new Map<string, ComparedArea>();
  ids.forEach((member, index) => {
    for (const { region, z } of domainAreas(partition, member)) {
      let area = areas.get(region);
      if (!area) {
        area = { region, z: ids.map(() => null), reached: 0 };
        areas.set(region, area);
      }
      area.z[index] = z;
      area.reached += 1;
    }
  });
  const strongest = (area: ComparedArea) => Math.max(...area.z.map((z) => z ?? -Infinity));
  return [...areas.values()].sort((a, b) => b.reached - a.reached || strongest(b) - strongest(a));
}

const normalize = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/** Kinds of searched term: one naming a function, task or stimulus, or one naming a clinical group. */
export const TERM_KINDS = ['function', 'population'];

/**
 * The published term search, checked against the regions it names: each term with its study count, its
 * kind and the regions it reaches, strongest first. None may repeat a curated function's term or reach nothing.
 */
function validateTerms(
  published: NeurosynthTerms,
  partition: NeuropsychDomains,
  regions: ReadonlyMap<string, Region>,
): TermSearch {
  if (
    published?.id !== 'neurosynth-terms' ||
    published.atlas !== partition.atlas ||
    published.structure_atlas !== partition.structure_atlas ||
    published.threshold_z !== partition.threshold_z ||
    !Array.isArray(published.regions) ||
    !Array.isArray(published.terms) ||
    !Array.isArray(published.neurosynth_org_missing) ||
    !published.atlases ||
    Object.keys(published.atlases).join() !== partition.region_atlases.join() ||
    published.neurosynth_org_missing.some(
      (term) => !published.terms.some(([name]) => name === term),
    )
  ) {
    throw new Error('Invalid Neurosynth term search.');
  }
  for (const id of published.regions) {
    if (!sampledRegion(partition, regions.get(id)))
      throw new Error(`Invalid Neurosynth term region: ${id}`);
  }
  const curated = new Set(partition.domains.map((domain) => domain.term));
  const terms = new Map<string, TermRecord>();
  for (const [term, studies, kind, reached] of published.terms) {
    if (
      typeof term !== 'string' ||
      !term ||
      terms.has(`${TERM}${term}`) ||
      curated.has(term) ||
      !Number.isInteger(studies) ||
      !TERM_KINDS.includes(kind) ||
      !reached.length ||
      reached.some(([index, z]) => !published.regions[index] || !(z >= published.threshold_z))
    ) {
      throw new Error(`Invalid Neurosynth term: ${term}`);
    }
    terms.set(`${TERM}${term}`, {
      id: `${TERM}${term}`,
      term,
      kind,
      name: term,
      name_fr: term,
      overview: false,
      group: null,
      studies,
      searchKey: normalize(term),
      areas: reached.map(([index, z]) => ({ region: published.regions[index], z })),
      atlasAreas: {},
    });
  }
  const atlases = Object.entries(published.atlases);
  for (const [atlas, table] of atlases) {
    if (
      table.regions.some(
        (id) => regions.get(id)?.atlas !== atlas || regions.get(id)?.kind !== 'cortex',
      ) ||
      Object.keys(table.terms).length !== terms.size
    ) {
      throw new Error(`Invalid Neurosynth term search on ${atlas}.`);
    }
    for (const [term, reached] of Object.entries(table.terms)) {
      const record = terms.get(`${TERM}${term}`);
      if (
        !record ||
        reached.some(([index, z]) => !table.regions[index] || !(z >= published.threshold_z))
      ) {
        throw new Error(`Invalid Neurosynth term on ${atlas}: ${term}`);
      }
      record.atlasAreas[atlas] = reached.map(([index, z]) => ({
        region: table.regions[index]!,
        z,
      }));
    }
  }
  return {
    terms,
    atlases: atlases.map(([atlas]) => atlas),
    derivation: published.derivation,
    missingPages: published.neurosynth_org_missing,
  };
}

/** The published partition, checked against the regions it assigns, with the term search where one is published. */
export function validateNeuropsychDomains(
  partition: NeuropsychDomains,
  regions: ReadonlyMap<string, Region>,
  published: NeurosynthTerms | null = null,
): NeuropsychDomains {
  if (
    partition?.id !== 'neuropsych-domains' ||
    !Array.isArray(partition.domains) ||
    !partition.regions ||
    !Array.isArray(partition.groups) ||
    !partition.structure_atlas ||
    !Array.isArray(partition.structures) ||
    !partition.unit_atlas ||
    !partition.units ||
    !Array.isArray(partition.neurosynth_org_missing) ||
    partition.neurosynth_org_missing.some(
      (term) => !partition.domains.some((domain) => domain.term === term),
    )
  ) {
    throw new Error('Invalid neuropsychological-domain partition.');
  }
  for (const [unit, structure] of Object.entries(partition.units)) {
    const region = regions.get(unit);
    if (
      region?.atlas !== partition.unit_atlas ||
      region.kind !== 'structure' ||
      regions.get(structure)?.atlas !== partition.structure_atlas ||
      !sampledRegion(partition, regions.get(structure))
    ) {
      throw new Error(`Invalid neuropsychological-domain teaching unit: ${unit}`);
    }
  }
  const groups = new Set<string>();
  for (const group of partition.groups) {
    if (!group.id || groups.has(group.id) || !group.name || !group.name_fr) {
      throw new Error(`Invalid neuropsychological-domain group: ${group.id}`);
    }
    groups.add(group.id);
  }
  const ids = new Set<string>();
  for (const domain of partition.domains) {
    if (
      !domain.id ||
      domain.id === ALL_DOMAINS ||
      ids.has(domain.id) ||
      !domain.name ||
      !domain.name_fr ||
      !domain.term ||
      !groups.has(domain.group) ||
      typeof domain.overview !== 'boolean' ||
      domain.color?.length !== 3 ||
      !Number.isInteger(partition.derivation?.studies?.[domain.id]) ||
      !partition.lesion_checks?.[domain.id]
    ) {
      throw new Error(`Invalid neuropsychological domain: ${domain.id}`);
    }
    ids.add(domain.id);
  }
  if (!partition.domains.some((domain) => domain.overview))
    throw new Error('No neuropsychological domain is in the overview.');
  const starts = partition.z_scale?.map((band) => band.from) ?? [];
  if (
    !starts.length ||
    starts[0] !== partition.threshold_z ||
    starts.some((start, index) => index && start <= starts[index - 1]) ||
    partition.z_scale.some((band) => band.color?.length !== 3)
  ) {
    throw new Error('Invalid neuropsychological-domain z scale.');
  }
  partition.search = published && validateTerms(published, partition, regions);
  if (
    !Array.isArray(partition.region_atlases) ||
    !partition.atlas_regions ||
    Object.keys(partition.atlas_regions).some((atlas) => !partition.region_atlases.includes(atlas))
  ) {
    throw new Error('Invalid neuropsychological-domain partition.');
  }
  for (const [atlas, assigned] of Object.entries(partition.atlas_regions)) {
    for (const [id, members] of Object.entries(assigned)) {
      const region = regions.get(id);
      if (
        region?.atlas !== atlas ||
        region.kind !== 'cortex' ||
        !members.length ||
        members.some((member) => !ids.has(member.domain) || !(member.z >= partition.threshold_z))
      ) {
        throw new Error(`Invalid neuropsychological-domain assignment: ${id}`);
      }
    }
  }
  for (const [id, members] of Object.entries(partition.regions)) {
    const region = regions.get(id);
    const scored =
      region?.atlas === partition.atlas ||
      (region?.atlas === partition.structure_atlas &&
        partition.structures.includes(region.source_name as string));
    if (
      !scored ||
      !members.length ||
      members.some((member) => !ids.has(member.domain) || !(member.z >= partition.threshold_z))
    ) {
      throw new Error(`Invalid neuropsychological-domain assignment: ${id}`);
    }
  }
  return partition;
}

export const domainRecord = (
  partition: NeuropsychDomains | null | undefined,
  id: string,
): DomainRecord | null =>
  (isTermId(id)
    ? partition?.search?.terms.get(id)
    : partition?.domains.find((domain) => domain.id === id)) ?? null;

/** A function's or term's analysis page on neurosynth.org, by its Neurosynth term; null where the site has none. */
export function neurosynthPage(partition: NeuropsychDomains, id: string): string | null {
  const record = domainRecord(partition, id);
  if (!record) throw new Error(`Unknown neuropsychological domain: ${id}`);
  const missing = isTermId(id) ? partition.search!.missingPages : partition.neurosynth_org_missing;
  return missing.includes(record.term)
    ? null
    : `https://neurosynth.org/analyses/terms/${encodeURIComponent(record.term)}/`;
}

/** How many studies a function's term rests on. */
export const domainStudies = (partition: NeuropsychDomains, id: string): number =>
  isTermId(id)
    ? (domainRecord(partition, id) as TermRecord).studies
    : partition.derivation.studies[id];

/**
 * Searched terms matching `query`, best first: the term itself, then those with a word starting with it,
 * then the rest holding it; more studies first within each.
 */
export function matchingTerms(partition: NeuropsychDomains, query: string): TermRecord[] {
  const term = normalize(query);
  if (!term || !partition.search) return [];
  const rank = (record: TermRecord) =>
    record.searchKey === term
      ? 0
      : record.searchKey.startsWith(term) || record.searchKey.includes(` ${term}`)
        ? 1
        : 2;
  return [...partition.search.terms.values()]
    .filter((record) => record.searchKey.includes(term))
    .sort((a, b) => rank(a) - rank(b) || b.studies - a.studies || a.term.localeCompare(b.term));
}

/** The function name or searched term a query that matched nothing most likely misspells, curated names first. */
export const nearestName = (partition: NeuropsychDomains, query: string, lang: Language) =>
  nearest(query, [
    ...partition.domains.map((domain) => domainName(domain, lang)),
    ...partition.domains.map((domain) => domain.term),
    ...(partition.search ? [...partition.search.terms.values()].map((record) => record.term) : []),
  ]);

/** The scored region whose domains a region has: a teaching unit's structure, otherwise itself. */
export const scoredSource = (partition: NeuropsychDomains, regionId: string) =>
  partition.units[regionId] ?? regionId;

/** The published members of a region: on HCP-MMP or a structure, else on a listed atlas. */
const membersOf = (partition: NeuropsychDomains, regionId: string): DomainMember[] =>
  partition.regions[scoredSource(partition, regionId)] ??
  partition.atlas_regions[regionId.slice(0, regionId.indexOf(':'))]?.[regionId] ??
  [];

/**
 * An area's domains with their z, in the published order (strongest share of the domain's cortical
 * peak first, which the overview paint reads); the lists reorder them by z (`functionsAt`).
 */
export const domainsOf = (partition: NeuropsychDomains | null | undefined, regionId: string) =>
  (partition ? membersOf(partition, regionId) : []).map((member) => ({
    ...(domainRecord(partition, member.domain) as Domain),
    z: member.z,
  }));

/**
 * The functions a region lists, highest z first: the order measured on 2026-11-10 (supervisor review
 * 1.1, D3) put the expected function first in 5 of 7 test regions, where share of peak managed 2.
 */
export const functionsAt = (partition: NeuropsychDomains, regionId: string) =>
  domainsOf(partition, regionId).sort((a, b) => b.z - a.z);

/**
 * The domain an area is drawn as: the one picked when the reader picks one and
 * the area reaches it, otherwise its strongest overview domain.
 */
export function shownDomain(
  partition: NeuropsychDomains | null | undefined,
  regionId: string,
  picked: string | null,
): Domain | null {
  const members = partition?.regions[scoredSource(partition, regionId)];
  if (!members) return null;
  const member = members.find((entry) =>
    picked ? entry.domain === picked : (domainRecord(partition, entry.domain) as Domain).overview,
  );
  return member ? (domainRecord(partition, member.domain) as Domain) : null;
}

/** The domains the overview draws together; the rest overlap them and are shown one at a time. */
export const overviewDomains = (partition: NeuropsychDomains) =>
  partition.domains.filter((domain) => domain.overview);

export const domainName = (record: DomainRecord, lang: Language = 'en') =>
  lang === 'fr' ? record.name_fr : record.name;

/** Domains matching `query` by name in either language or by term, under their groups in authored order. */
export function groupedDomains(partition: NeuropsychDomains, query: string, lang: Language) {
  const term = normalize(query);
  const matches = (domain: Domain) =>
    !term ||
    [domain.name, domain.name_fr, domain.term].some((text) => normalize(text).includes(term));
  return partition.groups
    .map((group) => ({
      group,
      name: lang === 'fr' ? group.name_fr : group.name,
      domains: partition.domains.filter((domain) => domain.group === group.id && matches(domain)),
    }))
    .filter((entry) => entry.domains.length > 0);
}

/** Whether the domains were measured on a region: an area of their atlas, or a sampled structure. */
const sampledRegion = (partition: NeuropsychDomains, region: Region | undefined) =>
  (region?.atlas === partition.atlas && region.kind === 'cortex') ||
  (region?.atlas === partition.structure_atlas &&
    partition.structures.includes(region.source_name as string));

/** Whether a region has domains: one they were measured on, a listed atlas's area, or a teaching unit carrying a structure's. */
export const scoredRegion = (partition: NeuropsychDomains, region: Region | undefined) =>
  sampledRegion(partition, region) ||
  (region !== undefined && region.id in partition.units) ||
  (region !== undefined &&
    region.kind === 'cortex' &&
    partition.region_atlases.includes(region.atlas as string));

/** The regions a listed structure is drawn as: the teaching units carrying its score, unless FreeSurfer's segmentation is shown. */
export function drawnAs(partition: NeuropsychDomains, regionId: string, detail: string): string[] {
  if (detail === partition.structure_atlas) return [regionId];
  const units = Object.keys(partition.units).filter((unit) => partition.units[unit] === regionId);
  return units.length ? units : [regionId];
}

/**
 * A paint's regions to reveal: its areas, and its structures on FreeSurfer's segmentation when that is
 * shown, else on the teaching set.
 */
export function revealedRegions(
  partition: NeuropsychDomains,
  paint: Paint,
  detail: string,
): string[] {
  const other =
    detail === partition.structure_atlas ? partition.unit_atlas : partition.structure_atlas;
  return [...paint.colors.keys()].filter((id) => !id.startsWith(`${other}:`));
}

/**
 * The atlas a function is painted on (supervisor review 3.1): the reader's own where its regions list
 * functions, for a curated function or the overview; otherwise HCP-MMP. Searched terms and
 * comparisons have no table on the other atlases.
 */
export function paintAtlas(partition: NeuropsychDomains, id: string, atlas: string): string {
  return atlas !== partition.atlas &&
    partition.region_atlases.includes(atlas) &&
    (!isTermId(id) || Boolean(partition.search?.atlases.includes(atlas))) &&
    !comparedIds(id)
    ? atlas
    : partition.atlas;
}

/** Each scored region of an atlas, with the structures, and its members. */
function assignedOn(partition: NeuropsychDomains, atlas: string): Record<string, DomainMember[]> {
  if (atlas === partition.atlas) return partition.regions;
  const own = partition.atlas_regions[atlas];
  if (!own) throw new Error(`No functions are published on ${atlas}.`);
  const structures = Object.entries(partition.regions).filter(([region]) =>
    region.startsWith(`${partition.structure_atlas}:`),
  );
  return { ...own, ...Object.fromEntries(structures) };
}

/** Every area or structure that reaches a domain, strongest first; ties keep the published order. */
export function domainAreas(
  partition: NeuropsychDomains,
  id: string,
  atlas: string = partition.atlas,
): { region: string; z: number }[] {
  if (isTermId(id)) {
    const record = domainRecord(partition, id) as TermRecord;
    if (atlas === partition.atlas) return record.areas;
    const own = record.atlasAreas[atlas];
    if (!own) throw new Error(`No term table on ${atlas}.`);
    // The atlas's own areas, with the structures the term reaches, strongest first.
    return [
      ...own,
      ...record.areas.filter(({ region }) => region.startsWith(`${partition.structure_atlas}:`)),
    ].sort((a, b) => b.z - a.z);
  }
  return Object.entries(assignedOn(partition, atlas))
    .flatMap(([region, members]) =>
      members.filter((member) => member.domain === id).map((member) => ({ region, z: member.z })),
    )
    .sort((a, b) => b.z - a.z);
}

/** The z-scale band a mean z falls in: the last whose start it reaches. */
export function zBand(partition: NeuropsychDomains, z: number): ZBand | undefined {
  // Array.prototype.findLast is ES2023; web/tsconfig.app.json lib is ES2022 (reported on #4).
  return partition.z_scale.reduceRight<ZBand | undefined>(
    (found, band) => found ?? (z >= band.from ? band : undefined),
    undefined,
  );
}

/**
 * The model paint for `ALL_DOMAINS`, each area in its strongest overview domain's colour; for one
 * domain or searched term alone, each area in its z-scale band's colour; for a comparison, each area
 * in the colour of the one function reaching it, or the shared colour. Each teaching unit takes its
 * structure's colour.
 */
export function domainPaint(
  partition: NeuropsychDomains,
  id: string,
  atlas: string = partition.atlas,
  from: number = partition.threshold_z,
): Paint {
  const compared = comparedIds(id);
  if (id !== ALL_DOMAINS && !compared && !domainRecord(partition, id))
    throw new Error(`Unknown neuropsychological domain: ${id}`);
  if (paintAtlas(partition, id, atlas) !== atlas)
    throw new Error('Comparisons, and terms without a table there, are painted on HCP-MMP only.');
  // One function or term alone takes a raised threshold (supervisor review 3.2); the rest keep the published one.
  if (from !== partition.threshold_z && (id === ALL_DOMAINS || compared))
    throw new Error('Only a single function or term takes another threshold.');
  const colors = new Map<string, Rgb>();
  if (compared) {
    for (const { region, z, reached } of comparedAreas(partition, id))
      colors.set(
        region,
        reached > 1 ? SHARED_COLOR : COMPARE_COLORS[z.findIndex((value) => value !== null)]!,
      );
  } else if (id !== ALL_DOMAINS) {
    for (const { region, z } of domainAreas(partition, id, atlas))
      if (z >= from) colors.set(region, zBand(partition, z)!.color);
  } else {
    // Each region in its first overview function, in the published share-of-peak order.
    for (const [region, members] of Object.entries(assignedOn(partition, atlas))) {
      const first = members.find(
        (member) => (domainRecord(partition, member.domain) as Domain).overview,
      );
      if (first) colors.set(region, (domainRecord(partition, first.domain) as Domain).color);
    }
  }
  for (const [unit, structure] of Object.entries(partition.units)) {
    const color = colors.get(structure);
    if (color) colors.set(unit, color);
  }
  // The stage replaces a paint only under a new id, so a raised threshold is part of it.
  const raised = from === partition.threshold_z ? '' : `:z${from}`;
  return { id: `function:${id}${raised}`, colors };
}
