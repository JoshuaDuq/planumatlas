import type { Explorer, Manifest, SurfaceColor } from '../../types/index.ts';

/** One cited work, as the build writes it to `references.json` (build/references.ts). */
export interface Work {
  type: 'article' | 'chapter' | 'dataset' | 'software';
  title: string;
  /** PubMed's form, "Van Essen DC"; a name that is not in it (a group's) is kept whole. */
  authors: readonly string[];
  year: number | null;
  journal: string | null;
  book: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  publisher: string | null;
  doi: string | null;
  pmid: string | null;
  url: string | null;
}

export interface ReferenceLibrary {
  /** Keyed as `data/reference-records.json` keys them: `pmid:…` or `doi:…`. */
  works: Readonly<Record<string, Work>>;
  /** Planum itself, from `CITATION.cff`. */
  planum: Work;
  /** The wording the HCP data use terms require (`docs/reference/references.md`, Acknowledgements). */
  hcpAcknowledgement: string;
}

/** Where the site serves the library, beside the page (build/references.ts writes it). */
export const REFERENCES_FILE = 'references.json';

/** The library, revalidated at each request so it always matches the manifest the deploy publishes. */
export async function fetchReferenceLibrary(base: string): Promise<ReferenceLibrary> {
  const response = await fetch(`${base}${REFERENCES_FILE}`, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${REFERENCES_FILE}: HTTP ${response.status}`);
  return (await response.json()) as ReferenceLibrary;
}

/** What on screen a work is behind, in the order the list gives them. */
export const BEHIND = [
  'planum',
  'subject',
  'atlas',
  'colouring',
  'internal',
  'spinalCord',
  'function',
  'deficit',
  'tracts',
  'strokeCases',
  'visualField',
] as const;
export type Behind = (typeof BEHIND)[number];

/** One citation as a section publishes it, and what on screen it is behind. */
export interface Cited {
  behind: Behind;
  citation: string;
}

/** What is on screen, as the reference list reads it. */
export interface OnScreen {
  atlas: string;
  surfaceColor: SurfaceColor;
  detail: string;
  internalVisible: boolean;
  spinalCordVisible: boolean;
  explorer: Explorer;
  selectedFunction: string | null;
  /** The connectivity seed and the disorder while their paint is drawn; null when lifted or not shown. */
  connectivitySeed: string | null;
  disorderShown: string | null;
  /** The layer IV paint's sources (`cortical_layers` file `source`) while it is shown; else null. */
  layers: readonly string[] | null;
  /** The open deficit's references as DOI links; null when no deficit is open in front. */
  deficit: readonly string[] | null;
  /** The drawn tracts' source, or null when none are drawn. */
  tracts: string | null;
  strokeCases: boolean;
  visualFieldMap: boolean;
}

export interface ViewCitations {
  cited: readonly Cited[];
  /** An HCP-derived layer is shown, so the acknowledgement the HCP terms require goes with the list. */
  hcp: boolean;
}

const DOI_URL = 'https://doi.org/';
const PUBMED_URL = /^https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)\/?$/;

/**
 * The works one citation field names: its DOI and PubMed links, where a field may list several
 * separated by commas or semicolons. Any other text (a repository, a tool's page) names no work.
 * scripts/fetch_references.py reads the fields the same way.
 */
export function identifiersOf(citation: string): { dois: string[]; pmids: string[] } {
  const parts = citation.split(/[,;]\s+/);
  return {
    dois: parts
      .filter((part) => part.startsWith(DOI_URL))
      .map((part) => part.slice(DOI_URL.length).toLowerCase()),
    pmids: parts.flatMap((part) => PUBMED_URL.exec(part)?.[1] ?? []),
  };
}

/** A manifest field that cites (scripts/fetch_references.py `CITATION_KEYS`). */
export const isCitationField = (key: string) =>
  ['citation', 'citations', 'doi', 'source_url'].includes(key) || key.endsWith('_citation');

/** Every citation field's text in a published record, however deep. */
export function citationFields(value: unknown, key = ''): string[] {
  if (Array.isArray(value)) return value.flatMap((inner) => citationFields(inner, key));
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([inner, field]) => citationFields(field, inner));
  }
  return typeof value === 'string' && isCitationField(key) ? [value] : [];
}

type Section = { citation?: string; citations?: string[] } | undefined;
const citationsOf = (section: Section) =>
  section ? [...(section.citation ? [section.citation] : []), ...(section.citations ?? [])] : [];

/** The citations behind what is on screen, in the order of `BEHIND`; Planum itself is not among them. */
export function viewCitations(manifest: Partial<Manifest>, view: OnScreen): ViewCitations {
  const cited: Cited[] = [];
  const add = (behind: Behind, citations: readonly (string | undefined)[]) => {
    for (const citation of citations) if (citation) cited.push({ behind, citation });
  };
  const cut = (id: string) => manifest.cut_atlases?.find((atlas) => atlas.id === id)?.citation;

  add('subject', [manifest.anatomy?.source_url]);
  // A cut samples the atlas, the colouring's map or the internal anatomy's labels, each cited there.
  add('atlas', [manifest.atlases?.find((atlas) => atlas.id === view.atlas)?.citation]);
  const networks = manifest.networks as
    { citation?: string; parcellation?: { citation?: string } } | undefined;
  const colouring = {
    network: [networks?.citation, networks?.parcellation?.citation],
    'cab-np': citationsOf(manifest.cab_np as Section),
    territory: [manifest.arterial_territories?.citation],
    striatal: [manifest.striatal_networks?.citation],
    cerebellar: [manifest.cerebellar_functions?.citation],
  } as Partial<Record<SurfaceColor, (string | undefined)[]>>;
  add('colouring', colouring[view.surfaceColor] ?? []);
  if (view.explorer === 'anatomy' && view.connectivitySeed) {
    add('colouring', citationsOf(manifest.functional_connectivity as Section));
  }
  if (view.explorer === 'anatomy' && view.disorderShown) {
    add('colouring', citationsOf(manifest.disorder_effects as Section));
  }
  if (view.explorer === 'anatomy') add('colouring', view.layers ?? []);
  if (view.internalVisible) {
    // A level built from several segmentations (the learning set) cites each one the manifest names.
    const level = manifest.detail_levels?.find(({ id }) => id === view.detail);
    add('internal', Object.keys(level?.source_grids ?? { [view.detail]: null }).map(cut));
  }
  if (view.spinalCordVisible) {
    add(
      'spinalCord',
      (manifest.supplemental_layers ?? []).flatMap((layer) => layer.citations),
    );
  }
  if (view.explorer === 'functions' && view.selectedFunction) {
    add('function', citationsOf(manifest.neuropsych_domains as Section));
    if (view.selectedFunction.startsWith('term:')) {
      add('function', citationsOf(manifest.neurosynth_terms as Section));
    }
  }
  add('deficit', view.deficit ?? []);
  add('tracts', [view.tracts ?? undefined]);
  if (view.strokeCases) add('strokeCases', manifest.stroke_cases?.citations ?? []);
  if (view.visualFieldMap) {
    // The map names the cortex it reads by Wang et al.'s areas.
    add('visualField', [
      manifest.retinotopy?.citation,
      manifest.retinotopy?.method_citation,
      manifest.retinotopy?.visual_areas.citation,
    ]);
  }
  const hcp =
    view.atlas === 'hcp-mmp' ||
    view.surfaceColor === 'cab-np' ||
    (view.explorer === 'anatomy' && view.connectivitySeed !== null) ||
    view.visualFieldMap;
  return { cited, hcp };
}

/** One work on the list, and everything on screen it is behind. */
export interface ListedWork {
  key: string;
  work: Work;
  behind: Behind[];
}

/**
 * Planum, then each work the citations name, once, with every part of the view it is behind.
 * A citation the library lacks fails: the build refuses a manifest whose citations have no record.
 */
export function viewReferences(
  { cited }: Pick<ViewCitations, 'cited'>,
  library: ReferenceLibrary,
): ListedWork[] {
  const byDoi = new Map(
    Object.entries(library.works).flatMap(([key, work]) => (work.doi ? [[work.doi, key]] : [])),
  );
  const listed = new Map<string, ListedWork>([
    ['planum', { key: 'planum', work: library.planum, behind: ['planum'] }],
  ]);
  for (const { behind, citation } of cited) {
    const { dois, pmids } = identifiersOf(citation);
    const keys = [
      ...dois.map((doi) => byDoi.get(doi) ?? `doi:${doi}`),
      ...pmids.map((pmid) => `pmid:${pmid}`),
    ];
    for (const key of keys) {
      const work = library.works[key];
      if (!work) throw new Error(`references.json has no record for ${key}.`);
      const entry = listed.get(key) ?? { key, work, behind: [] };
      if (!entry.behind.includes(behind)) entry.behind.push(behind);
      listed.set(key, entry);
    }
  }
  return [...listed.values()];
}

// Formats. Each takes the listed works and gives the text a reader saves or pastes.

const NAME = /^(.+) (\p{Lu}{1,4})(?: (Jr|Sr|2nd|3rd|II|III|IV))?$/u;

/** A PubMed-form name's parts; null for a name kept whole. */
function nameParts(author: string) {
  const match = NAME.exec(author);
  return match ? { family: match[1]!, initials: [...match[2]!], suffix: match[3] ?? null } : null;
}

const pageRange = (pages: string) => pages.split(/\s*[-–]\s*/);
const doiLink = (work: Work) => (work.doi ? `${DOI_URL}${work.doi}` : null);
/** Where a reader finds the work: its DOI, else its PubMed page, else its own address. */
export const linkOf = (work: Work) =>
  doiLink(work) ?? (work.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${work.pmid}/` : null) ?? work.url;

/** Vancouver's six authors before "et al.", in PubMed's form. */
const authorLine = (authors: readonly string[]) =>
  authors.length > 6 ? `${authors.slice(0, 6).join(', ')}, et al.` : authors.join(', ');
const sentence = (text: string) => (/[.?!]$/.test(text) ? text : `${text}.`);
/** What a work that is not a paper is, named in its line and its BibTeX note. */
const KINDS: Partial<Record<Work['type'], string>> = { dataset: 'Dataset', software: 'Software' };

/** One work as a reference list cites it, in the style the manifest's own citations use, without its link. */
export function citationOf(work: Work): string {
  const authors = authorLine(work.authors);
  const parts = [work.year === null ? sentence(authors) : `${authors} (${work.year})`.trim()];
  const kind = KINDS[work.type];
  parts.push(sentence(`${work.title}${kind ? ` [${kind.toLowerCase()}]` : ''}`));
  if (work.type === 'article' && work.journal) {
    const issue = work.issue ? `(${work.issue})` : '';
    const pages = work.pages ? `:${pageRange(work.pages).join('–')}` : '';
    parts.push(sentence(`${work.journal}${work.volume ? ` ${work.volume}${issue}` : ''}${pages}`));
  } else if (work.type === 'chapter' && work.book) {
    parts.push(sentence(`In: ${work.book}`));
  }
  if (work.type !== 'article' && work.publisher) parts.push(sentence(work.publisher));
  return parts.filter(Boolean).join(' ');
}

/** The list as plain text: one work a line with its link, then the acknowledgement it carries. */
export function referenceText(
  listed: readonly ListedWork[],
  acknowledgement: string | null,
): string {
  const lines = listed.map(({ work }) =>
    [citationOf(work), linkOf(work)].filter(Boolean).join(' '),
  );
  return `${[...lines, ...(acknowledgement ? ['', acknowledgement] : [])].join('\n')}\n`;
}

const LATEX: Record<string, string> = {
  '\\': '\\textbackslash{}',
  '~': '\\textasciitilde{}',
  '^': '\\textasciicircum{}',
};
/** Text with TeX's special characters escaped. */
const latex = (text: string) =>
  text.replace(/[\\{}&%$#_~^]/g, (char) => LATEX[char] ?? `\\${char}`);
/** A DOI or URL stays verbatim, as BibTeX styles print it; one with a brace would end its field. */
const verbatim = (text: string) => {
  if (/[{}]/.test(text)) throw new Error(`Cannot write ${text} in BibTeX.`);
  return text;
};

function bibName(author: string) {
  const parts = nameParts(author);
  if (!parts) return `{${latex(author)}}`;
  const given = parts.initials.map((initial) => `${initial}.`).join(' ');
  return [latex(parts.family), ...(parts.suffix ? [parts.suffix] : []), given].join(', ');
}

/** Each entry's key: its first author's surname and year, lettered where two would share one. */
function bibKeys(listed: readonly ListedWork[]): string[] {
  const seen = new Map<string, number>();
  return listed.map(({ key, work }) => {
    if (key === 'planum') return 'planum';
    const first = work.authors[0] ?? work.title;
    const surname = (nameParts(first)?.family ?? first)
      .normalize('NFD')
      .replace(/[^A-Za-z]/g, '')
      .toLowerCase();
    const base = `${surname || 'anon'}${work.year ?? ''}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count ? `${base}${String.fromCharCode(97 + count)}` : base;
  });
}

const BIB_TYPES: Record<Work['type'], string> = {
  article: 'article',
  chapter: 'incollection',
  dataset: 'misc',
  software: 'misc',
};

/** The list as BibTeX: one entry a work, titles braced so their capitals stay. */
export function bibtex(listed: readonly ListedWork[]): string {
  const keys = bibKeys(listed);
  return listed
    .map(({ work }, index) => {
      const fields: [string, string | null][] = [
        ['author', work.authors.length ? work.authors.map(bibName).join(' and ') : null],
        ['title', `{${latex(work.title)}}`],
        ['journal', work.type === 'article' && work.journal ? latex(work.journal) : null],
        ['booktitle', work.book ? latex(work.book) : null],
        ['publisher', work.type !== 'article' && work.publisher ? latex(work.publisher) : null],
        ['year', work.year === null ? null : String(work.year)],
        ['volume', work.volume ? latex(work.volume) : null],
        ['number', work.issue ? latex(work.issue) : null],
        ['pages', work.pages ? latex(pageRange(work.pages).join('--')) : null],
        ['doi', work.doi ? verbatim(work.doi) : null],
        ['pmid', work.pmid],
        ['url', !work.doi && work.url ? verbatim(work.url) : null],
        ['note', KINDS[work.type] ?? null],
      ];
      const body = fields
        .filter((field): field is [string, string] => field[1] !== null)
        .map(([name, value]) => `  ${name} = {${value}},`);
      return `@${BIB_TYPES[work.type]}{${keys[index]},\n${body.join('\n')}\n}\n`;
    })
    .join('\n');
}

const RIS_TYPES: Record<Work['type'], string> = {
  article: 'JOUR',
  chapter: 'CHAP',
  dataset: 'DATA',
  software: 'COMP',
};

/** The list as RIS, with the format's CRLF line ends. */
export function ris(listed: readonly ListedWork[]): string {
  return listed
    .map(({ work }) => {
      const [first, last] = work.pages ? pageRange(work.pages) : [];
      const tags: [string, string | null | undefined][] = [
        ['TY', RIS_TYPES[work.type]],
        ...work.authors.map((author): [string, string] => {
          const parts = nameParts(author);
          return [
            'AU',
            parts
              ? [
                  parts.family,
                  parts.initials.map((initial) => `${initial}.`).join(''),
                  parts.suffix,
                ]
                  .filter(Boolean)
                  .join(', ')
              : author,
          ];
        }),
        ['TI', work.title],
        ['T2', work.journal ?? work.book],
        ['PY', work.year === null ? null : String(work.year)],
        ['VL', work.volume],
        ['IS', work.issue],
        ['SP', first],
        ['EP', last],
        ['PB', work.type === 'article' ? null : work.publisher],
        ['DO', work.doi],
        ['UR', linkOf(work)],
        ['ER', ''],
      ];
      return tags
        .filter((tag): tag is [string, string] => tag[1] !== null && tag[1] !== undefined)
        .map(([tag, value]) => `${tag}  - ${value}`)
        .join('\r\n');
    })
    .map((entry) => `${entry}\r\n`)
    .join('\r\n');
}
