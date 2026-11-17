import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  bibtex,
  citationFields,
  identifiersOf,
  REFERENCES_FILE,
  viewCitations,
  viewReferences,
  type OnScreen,
} from '../src/lib/core/panels/citations.ts';
import type { Manifest } from '../src/lib/types/index.ts';
import { libraryFrom, readLibrary, referenceLibrary, type LibrarySources } from './references.ts';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const json = <T>(path: string) =>
  JSON.parse(readFileSync(resolve(repositoryRoot, path), 'utf8')) as T;
const library = readLibrary();

const BIBLIOGRAPHY = [
  '## Acknowledgements',
  '',
  '**Human Connectome Project.** The HCP terms require an acknowledgement, in this wording:',
  '',
  '> Data were provided [in part] by the Human Connectome Project.',
  '',
  '**Computing.** Another acknowledgement:',
  '',
  '> This research was enabled in part by support provided by an alliance.',
].join('\n');
const sources = (extra: Partial<LibrarySources> = {}): LibrarySources => ({
  records: {
    'pmid:1': { title: 'One', authors: ['Roe R'], year: 2001, doi: '10.1/one', pmid: '1' },
    'doi:10.2/two': {
      type: 'dataset',
      title: 'Two',
      authors: ['Poe P'],
      year: 2002,
      doi: '10.2/two',
    },
  },
  manifests: [{ atlases: [{ id: 'a', citation: 'https://doi.org/10.1/ONE' }] }],
  tractSources: ['https://doi.org/10.2/two'],
  clinicalPmids: ['1'],
  citation: {
    title: 'Planum',
    url: 'https://planumatlas.com',
    authors: [{ 'family-names': 'Doe', 'given-names': 'Jane Quinn' }],
  },
  bibliography: BIBLIOGRAPHY,
  ...extra,
});

describe('the reference library the build writes', () => {
  it('holds a record for every DOI and PMID the published manifests and tract catalogs cite', () => {
    const { anatomies } = json<{ anatomies: { id: string }[] }>('public/models/anatomies.json');
    const dois = new Set(Object.values(library.works).map((work) => work.doi));
    const pmids = new Set(Object.values(library.works).map((work) => work.pmid));
    let cited = 0;
    for (const { id } of anatomies) {
      for (const field of citationFields(json(`public/models/${id}/manifest.json`))) {
        const found = identifiersOf(field);
        for (const doi of found.dois) expect(dois.has(doi), doi).toBe(true);
        for (const pmid of found.pmids) expect(pmids.has(pmid), pmid).toBe(true);
        cited += found.dois.length + found.pmids.length;
      }
    }
    expect(cited).toBeGreaterThan(30);
  });

  it('stops the build at a cited DOI or PubMed record with no record, naming each', () => {
    expect(() =>
      libraryFrom(
        sources({
          manifests: [
            {
              citations: ['https://doi.org/10.9/missing', 'https://pubmed.ncbi.nlm.nih.gov/99/'],
            },
          ],
        }),
      ),
    ).toThrow('no record for doi:10.9/missing, pmid:99.');
    expect(() => libraryFrom(sources({ clinicalPmids: ['7'] }))).toThrow('no record for pmid:7.');
  });

  it('carries exactly the cited works, matched by DOI whatever its case', () => {
    expect(Object.keys(libraryFrom(sources()).works)).toEqual(['doi:10.2/two', 'pmid:1']);
    expect(
      Object.keys(libraryFrom(sources({ tractSources: [], clinicalPmids: [] })).works),
    ).toEqual(['pmid:1']);
  });

  it('cites Planum as CITATION.cff names it, with initials and no contact details', () => {
    // CITATION.cff gives each author's email too.
    const author = {
      'family-names': 'Doe',
      'given-names': 'Jane Quinn',
      email: 'jane@example.org',
    };
    const { planum } = libraryFrom(
      sources({ citation: { ...sources().citation, authors: [author] } }),
    );
    expect(planum).toMatchObject({
      type: 'software',
      title: 'Planum',
      authors: ['Doe JQ'],
      url: 'https://planumatlas.com',
    });
    expect(JSON.stringify(planum)).not.toContain('@');
  });

  it('quotes the HCP acknowledgement from the bibliography, and stops without it', () => {
    expect(libraryFrom(sources()).hcpAcknowledgement).toBe(
      'Data were provided [in part] by the Human Connectome Project.',
    );
    expect(() => libraryFrom(sources({ bibliography: '## Acknowledgements\n' }))).toThrow(
      'no HCP acknowledgement',
    );
    expect(library.hcpAcknowledgement).toMatch(
      /^Data were provided \[in part\] by the Human Connectome Project, WU-Minn Consortium/,
    );
  });

  it('is written to references.json beside the page', () => {
    const plugin = referenceLibrary();
    const hook = (name: 'buildStart' | 'generateBundle') =>
      plugin[name] as unknown as (this: unknown, ...args: unknown[]) => unknown;
    const emitFile = vi.fn();
    hook('buildStart').call({});
    hook('generateBundle').call({ emitFile });
    expect(emitFile).toHaveBeenCalledWith({
      type: 'asset',
      fileName: REFERENCES_FILE,
      source: JSON.stringify(library),
    });
    expect(REFERENCES_FILE).toBe('references.json');
  });
});

const OPENING: OnScreen = {
  atlas: 'destrieux',
  surfaceColor: 'atlas',
  detail: 'learning',
  internalVisible: true,
  spinalCordVisible: false,
  explorer: 'anatomy',
  selectedFunction: null,
  connectivitySeed: null,
  disorderShown: null,
  layers: null,
  deficit: null,
  tracts: null,
  strokeCases: false,
  visualFieldMap: false,
};

it('the opening view’s references are Planum, the subject’s dataset, Destrieux and NextBrain', () => {
  const manifest = json<Manifest>('public/models/cdmd/manifest.json');
  const citations = viewCitations(manifest, OPENING);
  expect(citations.hcp).toBe(false);
  expect(
    viewReferences(citations, library).map(({ key, behind, work }) => [key, behind, work.title]),
  ).toEqual([
    ['planum', ['planum'], 'Planum'],
    [
      'doi:10.6084/m9.figshare.c.5315474.v1',
      ['subject'],
      'Comprehensive diffusion MRI dataset for in vivo human brain microstructure mapping using 300 mT/m gradients',
    ],
    [
      'pmid:20547229',
      ['atlas'],
      'Automatic parcellation of human cortical gyri and sulci using standard anatomical nomenclature',
    ],
    [
      'pmid:41193801',
      ['internal'],
      'A probabilistic histological atlas of the human brain for MRI segmentation',
    ],
  ]);
});

/**
 * A narrow BibTeX grammar: `@type{key,` then `  name = {value},` lines and `}`. A value's braces
 * balance once TeX's escaped ones are set aside, and no TeX special stands unescaped outside the
 * verbatim DOI and URL fields.
 */
function parseBibtex(text: string) {
  const entries = text.split(/\n(?=@)/);
  const keys = new Set<string>();
  for (const entry of entries) {
    const lines = entry.trimEnd().split('\n');
    const head = /^@(article|incollection|misc)\{([a-z0-9]+),$/.exec(lines[0]!);
    expect(head, lines[0]).not.toBeNull();
    expect(keys.has(head![2]!), head![2]).toBe(false);
    keys.add(head![2]!);
    expect(lines.at(-1)).toBe('}');
    for (const line of lines.slice(1, -1)) {
      const field = /^ {2}([a-z]+) = \{(.*)\},$/.exec(line);
      expect(field, line).not.toBeNull();
      const [, name, value] = field!;
      const bare = value!.replace(/\\[{}&%$#_]/g, '').replace(/\\text\w+\{\}/g, '');
      let depth = 0;
      for (const char of bare) {
        depth += char === '{' ? 1 : char === '}' ? -1 : 0;
        expect(depth, line).toBeGreaterThanOrEqual(0);
      }
      expect(depth, line).toBe(0);
      if (name !== 'doi' && name !== 'url') expect(bare, line).not.toMatch(/[&%$#_~^\\]/);
    }
  }
  return keys.size;
}

it('every work the library holds gives a BibTeX entry that parses', () => {
  const listed = [
    { key: 'planum', work: library.planum, behind: ['planum' as const] },
    ...Object.entries(library.works).map(([key, work]) => ({
      key,
      work,
      behind: ['deficit' as const],
    })),
  ];
  expect(parseBibtex(bibtex(listed))).toBe(listed.length);
});

it('the narrow BibTeX grammar refuses an unbalanced brace and an unescaped special', () => {
  expect(() => parseBibtex('@misc{a,\n  title = {{x}},\n  note = {y{},\n}\n')).toThrow();
  expect(() => parseBibtex('@misc{a,\n  title = {{50% x}},\n}\n')).toThrow();
});
