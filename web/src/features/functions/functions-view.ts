// What the Functions list and profile say, as plain data (viewer/ui/panels/functions.js:50-67,
// 173-318, 421-456). The components only draw it.
import { functionalName, functionalRegionOf } from '../../lib/core/catalog/functional-regions.ts';
import type { FunctionalRegions } from '../../lib/core/catalog/functional-regions.ts';
import {
  ALL_DOMAINS,
  COMPARE_COLORS,
  comparedAreas,
  comparedIds,
  domainAreas,
  domainName,
  domainRecord,
  domainStudies,
  functionName,
  functionsAt,
  groupedDomains,
  isTermId,
  matchingTerms,
  nearestName,
  neurosynthPage,
  overviewDomains,
  scoredRegion,
  SHARED_COLOR,
  type Domain,
  type NeuropsychDomains,
  type TermRecord,
} from '../../lib/core/catalog/neuropsych-domains.ts';
import { count, decimal } from '../../lib/core/format.ts';
import { t } from '../../lib/core/i18n/index.ts';
import { checkedParcels } from '../../lib/core/panels/provenance.ts';
import type { Region, Language, Rgb } from '../../lib/types/index.ts';

/** Areas listed before the rest fold under a disclosure. */
export const AREAS_SHOWN = 12;
/** Searched terms listed under the curated functions; the rest wait for a narrower query. */
export const TERMS_SHOWN = 20;
/** A region's functions listed before "Show all N". */
export const REGION_ROWS_SHOWN = 8;

/** How many of `regions` are areas and how many structures. */
function splitCounts(partition: NeuropsychDomains, regions: string[]): [number, number] {
  const structures = regions.filter((region) =>
    region.startsWith(`${partition.structure_atlas}:`),
  ).length;
  return [regions.length - structures, structures];
}

/** How many of the regions a domain reaches are areas and how many structures. */
const reachedCounts = (
  partition: NeuropsychDomains,
  id: string,
  atlas = partition.atlas,
  from = partition.threshold_z,
): [number, number] =>
  splitCounts(
    partition,
    domainAreas(partition, id, atlas)
      .filter(({ z }) => z >= from)
      .map(({ region }) => region),
  );

/** An atlas's short name, as the masthead says it. */
export const atlasName = (atlas: string, lang: Language) =>
  (t(lang, 'header').atlasShort as Record<string, string>)[atlas] ?? atlas;

/** The areas and structures both compared functions reach, as the comparison's meta line says it. */
export const sharedCount = (partition: NeuropsychDomains, id: string, lang: Language): string =>
  t(lang, 'functions').both(
    t(lang, 'functions').areasShort(
      ...splitCounts(
        partition,
        comparedAreas(partition, id)
          .filter((area) => area.reached > 1)
          .map(({ region }) => region),
      ),
    ),
    decimal(partition.threshold_z, 0, lang),
  );

/** The areas and structures a domain reaches at the threshold on the atlas it is painted on, as the profile says it. */
export const areaCount = (
  partition: NeuropsychDomains,
  id: string,
  lang: Language,
  atlas = partition.atlas,
  from = partition.threshold_z,
): string =>
  t(lang, 'functions').areas(
    ...reachedCounts(partition, id, atlas, from),
    decimal(from, Number.isInteger(from) ? 0 : 1, lang),
    atlasName(atlas, lang),
  );

/** The same count as a list row says it, beside the row's other facts. */
export const areaCountShort = (partition: NeuropsychDomains, id: string, lang: Language): string =>
  t(lang, 'functions').areasShort(...reachedCounts(partition, id));

export interface FunctionRow {
  id: string;
  name: string;
  /** Null for the overview row and a region's rows. */
  studies: number | null;
  /** A region's row: its z, as the column shows it. */
  figure?: string;
  /** Read, not shown: the row's name continues with it. */
  detail: string;
  /** A searched term is English whatever the reader's language. */
  lang: Language | null;
}

export interface FunctionGroup {
  id: string;
  name: string;
  rows: FunctionRow[];
}

/** The functions the selected region reaches, highest z first (supervisor review 1.1). */
export interface RegionFunctions {
  rows: FunctionRow[];
  /** A teaching unit, which carries its structure's score. */
  unit: boolean;
}

export interface FunctionList {
  /** The selected region's functions, first; null with no scored region selected or while searching. */
  atRegion: RegionFunctions | null;
  /** The "All functions" row, which opens the overview; absent while searching. */
  overview: FunctionRow | null;
  groups: FunctionGroup[];
  /** Searched terms follow the curated groups, clinical groups apart from the rest. */
  termGroups: FunctionGroup[];
  /** Matching terms past the `TERMS_SHOWN` listed. */
  termsMore: number;
  /** How many curated functions and how many Neurosynth terms the query matches. */
  matches: { functions: number; terms: number };
  /** The nearest name when nothing matches. */
  suggestion: string | null;
}

/** The list for `query`: curated functions under their groups, then the Neurosynth terms that match. */
export function functionList(
  domains: NeuropsychDomains,
  rawQuery: string,
  lang: Language,
  region: Region | null = null,
): FunctionList {
  const copy = t(lang, 'functions');
  const query = rawQuery.trim();
  const curated = groupedDomains(domains, query, lang);
  const terms = matchingTerms(domains, query);
  const row = (record: Domain | TermRecord, searched: boolean): FunctionRow => {
    const studies = domainStudies(domains, record.id);
    return {
      id: record.id,
      name: searched ? record.term : domainName(record, lang),
      studies,
      detail: copy.termDetail(
        count(studies, 'study', lang),
        areaCountShort(domains, record.id, lang),
      ),
      lang: searched && lang !== 'en' ? 'en' : null,
    };
  };
  const shown = terms.slice(0, TERMS_SHOWN);
  return {
    atRegion:
      query || !region || !scoredRegion(domains, region)
        ? null
        : {
            rows: functionsAt(domains, region.id).map((record) => {
              const z = decimal(record.z, 1, lang);
              return {
                id: record.id,
                name: domainName(record, lang),
                studies: null,
                figure: z,
                detail: `z ${z}`,
                lang: null,
              };
            }),
            unit: region.id in domains.units,
          },
    overview: query
      ? null
      : {
          id: ALL_DOMAINS,
          name: copy.all,
          studies: null,
          detail: copy.allDetail,
          lang: null,
        },
    groups: curated.map(({ group, name, domains: members }) => ({
      id: group.id,
      name,
      rows: members.map((record) => row(record, false)),
    })),
    termGroups: (['function', 'population'] as const).flatMap((kind) => {
      const rows = shown.filter((record) => record.kind === kind);
      return rows.length
        ? [
            {
              id: `terms-${kind}`,
              name: kind === 'function' ? copy.termsHeading : copy.populationsHeading,
              rows: rows.map((record) => row(record, true)),
            },
          ]
        : [];
    }),
    termsMore: Math.max(0, terms.length - TERMS_SHOWN),
    matches: {
      functions: curated.reduce((sum, entry) => sum + entry.domains.length, 0),
      terms: terms.length,
    },
    suggestion:
      query && !curated.length && !terms.length ? nearestName(domains, query, lang) : null,
  };
}

/** The result-count sentence a search says (`results`). */
export const resultsSentence = (matches: FunctionList['matches'], lang: Language): string =>
  t(lang, 'functions').results(matches.functions, matches.terms);

export interface AreaRow {
  region: string;
  /** "Name · Side". */
  name: string;
  division: string | null;
  /** The z score as the row prints it. */
  z: string;
}

export interface LesionRow {
  /** Unique among a function's checks; several checks can name the same deficit. */
  association: string;
  deficit: string;
  name: string;
  detail: string;
}

export interface OverviewLink {
  id: string;
  name: string;
  detail: string;
  colour: Rgb;
}

/** A function's page on neurosynth.org, named by its Neurosynth term, which is English. */
export interface NeurosynthLink {
  term: string;
  href: string;
}

const neurosynthLink = (domains: NeuropsychDomains, id: string): NeurosynthLink | null => {
  const href = neurosynthPage(domains, id);
  return href ? { term: domainRecord(domains, id)!.term, href } : null;
};

/** What the profile of one function shows, below its name. */
export interface FunctionProfileContent {
  all: boolean;
  searched: boolean;
  /** The function's own name, or "All functions". */
  name: string;
  /** A searched term, for the kind line; null for a curated function and the overview. */
  term: { before: string; term: string; after: string } | null;
  caveat: string;
  /** Searched clinical group: the Deficits tab's lesion profiles for the same words. */
  lesionBridge: { text: string; query: string } | null;
  overview: OverviewLink[];
  areas: AreaRow[];
  /** The strongest area's z, the threshold control's top; 0 for the overview. */
  top: number;
  noAreas: string;
  lesions: LesionRow[] | null;
  /** Said with the lesion checks when the function is painted on another atlas than theirs. */
  lesionsOn: string | null;
  method: string;
  citation: string;
  /** Null for the overview and for a term neurosynth.org has no page for. */
  neurosynth: NeurosynthLink | null;
}

type ProfileSources = Parameters<typeof functionProfile>[0];

/** An area's name with its side, and the functional division it belongs to. */
function placeOf(
  { anatomy, functionalRegions }: Pick<ProfileSources, 'anatomy' | 'functionalRegions'>,
  id: string,
  region: string,
  lang: Language,
): Omit<AreaRow, 'z'> {
  const entry = anatomy.get(region);
  if (!entry) throw new Error(`Unknown region in function ${id}: ${region}`);
  const division =
    functionalRegionOf(functionalRegions, 'named', region) ??
    functionalRegionOf(functionalRegions, 'sections', region);
  return {
    region,
    name: `${entry.label.name} · ${t(lang, 'sides').capitalized[entry.region.hemisphere]}`,
    division: division ? functionalName(division, lang) : null,
  };
}

type LesionCheck = Parameters<typeof checkedParcels>[0] & {
  association: string;
  deficit: string;
  deficit_name: Record<Language, string>;
};

/** The profile of `id`: the overview, a searched term or a curated function. */
export function functionProfile(
  {
    domains,
    anatomy,
    functionalRegions,
    deficitsMatching,
    atlas,
  }: {
    domains: NeuropsychDomains;
    /** The atlas the function is painted on (`paintAtlas`). */
    atlas: string;
    anatomy: { get(id: string): { region: Region; label: { name: string } } | null };
    functionalRegions: FunctionalRegions | null;
    deficitsMatching: (query: string, lang: Language) => number;
  },
  id: string,
  lang: Language,
): FunctionProfileContent {
  const copy = t(lang, 'functions');
  const domainCopy = t(lang, 'domains');
  const all = id === ALL_DOMAINS;
  const searched = isTermId(id);
  const record = all ? null : domainRecord(domains, id);
  if (!all && !record) throw new Error(`Unknown function: ${id}`);
  const source = (domains.sources as Record<string, { short: string; citation: string }>)[
    domains.scores_source as string
  ];

  const areas = all
    ? []
    : domainAreas(domains, id, atlas).map(({ region, z }) => ({
        ...placeOf({ anatomy, functionalRegions }, id, region, lang),
        z: decimal(z, 1, lang),
      }));

  const population = record?.kind === 'population';
  const found = searched && population ? deficitsMatching((record as TermRecord).term, lang) : 0;
  const checks =
    !all && !searched ? (domains.lesion_checks as Record<string, LesionCheck[]>)[id] : null;

  let term: FunctionProfileContent['term'] = null;
  if (record) {
    // The study count arrives as words; the term, as the English it is, is marked by the caller.
    const [before, after] = copy
      .term('\u0000', count(domainStudies(domains, id), 'study', lang))
      .split('\u0000');
    term = { before, term: record.term, after };
  }

  return {
    all,
    searched,
    name: all ? copy.all : domainName(record!, lang),
    term,
    caveat: !searched ? copy.caveat : population ? copy.populationCaveat : copy.termCaveat,
    lesionBridge: found
      ? {
          text: copy.deficitBridge(found, (record as TermRecord).term),
          query: (record as TermRecord).term,
        }
      : null,
    overview: all
      ? overviewDomains(domains).map((domain) => ({
          id: domain.id,
          name: domainName(domain, lang),
          detail: areaCountShort(domains, domain.id, lang),
          colour: domain.color,
        }))
      : [],
    areas,
    top: all ? 0 : Math.max(0, ...domainAreas(domains, id, atlas).map(({ z }) => z)),
    noAreas: copy.none(decimal(domains.threshold_z, 0, lang), atlasName(atlas, lang)),
    lesions: checks
      ? checks.map((check) => ({
          association: check.association,
          deficit: check.deficit,
          name: check.deficit_name[lang],
          detail: `${check.references.join(', ')} · ${checkedParcels(check, lang)}`,
        }))
      : null,
    lesionsOn: checks && atlas !== domains.atlas ? copy.lesionsOn : null,
    method: domainCopy.note(source.short),
    citation: source.citation,
    neurosynth: all ? null : neurosynthLink(domains, id),
  };
}

/** One of a comparison's functions, in the colour its own areas take. */
export interface ComparedFunction {
  id: string;
  name: string;
  /** A searched term is English whatever the reader's language. */
  lang: Language | null;
  detail: string;
  colour: Rgb;
  neurosynth: NeurosynthLink | null;
}

/** An area both compared functions reach, with each one's z in order. */
export interface SharedAreaRow extends Omit<AreaRow, 'z'> {
  z: string[];
}

export interface ComparisonContent {
  name: string;
  functions: ComparedFunction[];
  shared: { colour: Rgb; areas: SharedAreaRow[] };
  /** Each function's areas the other does not reach, strongest first. */
  only: (ComparedFunction & { areas: AreaRow[] })[];
  method: string;
  citation: string;
}

/** What the profile of a comparison shows: its functions, the areas both reach, then each one's own. */
export function comparisonProfile(
  sources: Pick<ProfileSources, 'domains' | 'anatomy' | 'functionalRegions'> & { atlas?: string },
  id: string,
  lang: Language,
): ComparisonContent {
  const { domains } = sources;
  const ids = comparedIds(id);
  if (!ids) throw new Error(`Not a comparison: ${id}`);
  const copy = t(lang, 'functions');
  const areas = comparedAreas(domains, id);
  const functions = ids.map((member, index): ComparedFunction => {
    const record = domainRecord(domains, member)!;
    return {
      id: member,
      name: isTermId(member) ? record.term : domainName(record, lang),
      lang: isTermId(member) && lang !== 'en' ? 'en' : null,
      detail: copy.termDetail(
        count(domainStudies(domains, member), 'study', lang),
        areaCountShort(domains, member, lang),
      ),
      colour: COMPARE_COLORS[index]!,
      neurosynth: neurosynthLink(domains, member),
    };
  });
  const source = (domains.sources as Record<string, { short: string; citation: string }>)[
    domains.scores_source as string
  ];
  return {
    name: functionName(domains, id, lang),
    functions,
    shared: {
      colour: SHARED_COLOR,
      areas: areas
        .filter((area) => area.reached > 1)
        .map((area) => ({
          ...placeOf(sources, id, area.region, lang),
          z: area.z.map((z) => decimal(z!, 1, lang)),
        })),
    },
    only: functions.map((entry, index) => ({
      ...entry,
      areas: areas
        .filter((area) => area.reached === 1 && area.z[index] !== null)
        .map((area) => ({
          ...placeOf(sources, id, area.region, lang),
          z: decimal(area.z[index]!, 1, lang),
        })),
    })),
    method: t(lang, 'domains').note(source.short),
    citation: source.citation,
  };
}
