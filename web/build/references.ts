import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { parse } from 'yaml';
import {
  citationFields,
  identifiersOf,
  REFERENCES_FILE,
  type ReferenceLibrary,
  type Work,
} from '../src/lib/core/panels/citations.ts';
import { ASSET_BASE } from './site.ts';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));

/** A record of `data/reference-records.json`, as scripts/fetch_references.py writes it. */
interface FetchedRecord {
  type?: Work['type'];
  title: string;
  authors?: string[];
  year: number;
  journal?: string | null;
  book?: string | null;
  volume?: string | null;
  issue?: string | null;
  pages?: string | null;
  publisher?: string | null;
  doi?: string | null;
  pmid?: string;
}

/** What the library is built from, as read from the repository. */
export interface LibrarySources {
  records: Readonly<Record<string, FetchedRecord>>;
  /** Every published manifest. */
  manifests: readonly unknown[];
  /** Each tract catalog's source (`data/diffusion-*.yaml`). */
  tractSources: readonly string[];
  /** The PMIDs the deficit findings cite (`data/neuropsychology.yaml`). */
  clinicalPmids: readonly string[];
  /** `CITATION.cff`, parsed. */
  citation: {
    title: string;
    url: string;
    authors: { 'family-names': string; 'given-names'?: string }[];
  };
  /** `docs/reference/references.md`. */
  bibliography: string;
}

const initials = (given: string) =>
  given
    .split(/[\s.-]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase())
    .join('');

function workOf(record: FetchedRecord): Work {
  return {
    type: record.type ?? 'article',
    title: record.title,
    authors: record.authors ?? [],
    year: record.year,
    journal: record.journal ?? null,
    book: record.book ?? null,
    volume: record.volume ?? null,
    issue: record.issue ?? null,
    pages: record.pages ?? null,
    publisher: record.publisher ?? null,
    doi: record.doi ?? null,
    pmid: record.pmid ?? null,
    url: null,
  };
}

/** The acknowledgement the HCP terms require, quoted under its heading in the bibliography. */
function hcpAcknowledgement(bibliography: string): string {
  const lines = bibliography.split('\n');
  const heading = lines.findIndex((line) => line.startsWith('**Human Connectome Project.**'));
  const quote = lines.slice(heading + 1).find((line) => line.startsWith('> '));
  if (heading < 0 || !quote) throw new Error('references.md quotes no HCP acknowledgement.');
  return quote.slice(2);
}

/**
 * The records every citation of the published manifests, the tract catalogs and the deficit
 * findings names, with Planum itself and the HCP acknowledgement. A cited DOI or PMID without a
 * record stops the build.
 */
export function libraryFrom(sources: LibrarySources): ReferenceLibrary {
  const byDoi = new Map(
    Object.entries(sources.records).flatMap(([key, record]) =>
      record.doi ? [[record.doi, key] as const] : [],
    ),
  );
  const cited = [
    ...sources.manifests.flatMap((manifest) => citationFields(manifest)),
    ...sources.tractSources,
  ].map(identifiersOf);
  const keys = new Set([
    ...cited.flatMap(({ dois }) => dois.map((doi) => byDoi.get(doi) ?? `doi:${doi}`)),
    ...cited.flatMap(({ pmids }) => pmids.map((pmid) => `pmid:${pmid}`)),
    ...sources.clinicalPmids.map((pmid) => `pmid:${pmid}`),
  ]);
  const missing = [...keys].filter((key) => !Object.hasOwn(sources.records, key)).sort();
  if (missing.length) {
    throw new Error(
      `data/reference-records.json has no record for ${missing.join(', ')}. ` +
        'Add each with `uv run python scripts/fetch_references.py --doi <DOI>` (or `--pmid <PMID>`).',
    );
  }
  const { citation } = sources;
  return {
    works: Object.fromEntries([...keys].sort().map((key) => [key, workOf(sources.records[key]!)])),
    planum: {
      type: 'software',
      title: citation.title,
      authors: citation.authors.map((author) =>
        [author['family-names'], initials(author['given-names'] ?? '')].filter(Boolean).join(' '),
      ),
      year: null,
      journal: null,
      book: null,
      volume: null,
      issue: null,
      pages: null,
      publisher: null,
      doi: null,
      pmid: null,
      url: citation.url,
    },
    hcpAcknowledgement: hcpAcknowledgement(sources.bibliography),
  };
}

/** The library from the repository's own files. */
export function readLibrary(root = repositoryRoot): ReferenceLibrary {
  const text = (path: string) => readFileSync(resolve(root, path), 'utf8');
  const index = JSON.parse(text('public/models/anatomies.json')) as { anatomies: { id: string }[] };
  return libraryFrom({
    records: (
      JSON.parse(text('data/reference-records.json')) as { records: LibrarySources['records'] }
    ).records,
    manifests: index.anatomies.map(({ id }) =>
      JSON.parse(text(`public/models/${id}/manifest.json`)),
    ),
    tractSources: readdirSync(resolve(root, 'data'))
      .filter((file) => /^diffusion-.+\.yaml$/.test(file))
      .sort()
      .map((file) => (parse(text(`data/${file}`)) as { source: string }).source),
    clinicalPmids: (
      parse(text('data/neuropsychology.yaml')) as { references: { pmid: string }[] }
    ).references.map(({ pmid }) => String(pmid)),
    citation: parse(text('CITATION.cff')) as LibrarySources['citation'],
    bibliography: text('docs/reference/references.md'),
  });
}

/**
 * Writes `references.json`, the records the view's reference list reads, and fails the build when a
 * manifest cites a DOI or PMID with no record. The development server checks at start and serves the
 * library read afresh, so a fetched record shows on the next opening.
 */
export function referenceLibrary(): Plugin {
  let library: ReferenceLibrary;
  return {
    name: 'reference-library',
    buildStart() {
      library = readLibrary();
    },
    configureServer(server) {
      server.middlewares.use(`${ASSET_BASE}${REFERENCES_FILE}`, (_request, response) => {
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify(readLibrary()));
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: REFERENCES_FILE, source: JSON.stringify(library) });
    },
  };
}
