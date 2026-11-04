import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { createCatalog } from '../../lib/core/catalog/catalog.ts';
import { readModel } from '../../lib/core/catalog/test-support.ts';
import {
  validateFunctionalRegions,
  type FunctionalRegions,
} from '../../lib/core/catalog/functional-regions.ts';
import {
  ALL_DOMAINS,
  COMPARE_COLORS,
  comparedAreas,
  domainAreas,
  validateNeuropsychDomains,
  type NeuropsychDomains,
  type NeurosynthTerms,
} from '../../lib/core/catalog/neuropsych-domains.ts';
import type { Manifest } from '../../lib/types/index.ts';
import {
  AREAS_SHOWN,
  TERMS_SHOWN,
  areaCount,
  areaCountShort,
  functionList,
  comparisonProfile,
  functionProfile,
  resultsSentence,
  sharedCount,
} from './functions-view.ts';

const manifest = readModel<Manifest>('cdmd/manifest.json');
const regions = new Map(manifest.regions.map((region) => [region.id, region]));
const domains = validateNeuropsychDomains(
  readModel<NeuropsychDomains>('cdmd/neuropsych-domains.json'),
  regions,
  readModel<NeurosynthTerms>('cdmd/neurosynth-terms.json'),
);
const functionalRegions = validateFunctionalRegions(
  readModel<FunctionalRegions>('cdmd/functional-regions.json'),
  regions,
);
const deps = (found = 0) => ({
  domains,
  anatomy: createCatalog(manifest),
  functionalRegions,
  deficitsMatching: () => found,
});

describe('functionList', () => {
  test('without a query: the overview row, then every curated function under its group, no terms', () => {
    const list = functionList(domains, '', 'en');
    assert.equal(list.overview?.id, ALL_DOMAINS);
    assert.equal(list.overview?.studies, null);
    assert.deepEqual(
      list.groups.map(({ id }) => id),
      domains.groups.map(({ id }) => id),
    );
    assert.equal(list.groups.flatMap(({ rows }) => rows).length, domains.domains.length);
    assert.equal(list.termGroups.length, 0);
    assert.equal(list.suggestion, null);
    const first = list.groups[0]!.rows[0]!;
    assert.match(first.detail, /^[\d,]+ studies? · \d+ areas?/);
    assert.equal(first.lang, null);
  });

  test('a query lists terms: at most 20 shown, the rest counted, clinical groups apart, marked English in French', () => {
    const list = functionList(domains, ' a ', 'fr');
    assert.equal(list.overview, null);
    const shown = list.termGroups.flatMap(({ rows }) => rows);
    assert.equal(shown.length, TERMS_SHOWN);
    assert.equal(list.termsMore, list.matches.terms - TERMS_SHOWN);
    assert.ok(shown.every((row) => row.lang === 'en'));
    assert.deepEqual(
      list.termGroups.map(({ id }) => id),
      ['terms-function', 'terms-population'].filter((id) =>
        list.termGroups.some((group) => group.id === id),
      ),
    );
    const english = functionList(domains, 'a', 'en');
    assert.ok(english.termGroups.flatMap(({ rows }) => rows).every((row) => row.lang === null));
  });

  test('a query that matches nothing offers the nearest name', () => {
    const list = functionList(domains, 'langauge', 'en');
    assert.deepEqual(list.matches, { functions: 0, terms: 0 });
    assert.equal(list.suggestion !== null && list.suggestion.length > 0, true);
    assert.equal(functionList(domains, 'language', 'en').suggestion, null);
  });

  test('the result sentence is the existing one in either language', () => {
    assert.equal(
      resultsSentence({ functions: 1, terms: 2 }, 'en'),
      '1 function and 2 Neurosynth terms',
    );
    assert.equal(resultsSentence({ functions: 0, terms: 0 }, 'en'), 'No match');
    assert.equal(resultsSentence({ functions: 0, terms: 0 }, 'fr'), 'Aucun résultat');
  });
});

describe('area counts', () => {
  test('say areas and structures at the threshold', () => {
    const id = domains.domains[0]!.id;
    assert.match(
      areaCount(domains, id, 'en'),
      /^\d+ HCP-MMP areas?( and \d+ structures?)? at z ≥ 3$/,
    );
    assert.match(areaCountShort(domains, id, 'en'), /^\d+ areas?(, \d+ structures?)?$/);
  });
});

describe('functionProfile', () => {
  test('the overview lists the overview functions as links and has no areas', () => {
    const profile = functionProfile(deps(), ALL_DOMAINS, 'en');
    assert.equal(profile.all, true);
    assert.equal(profile.name, 'All functions');
    assert.equal(profile.term, null);
    assert.equal(profile.areas.length, 0);
    assert.equal(profile.lesions, null);
    assert.equal(profile.overview.length, domains.domains.filter((d) => d.overview).length);
  });

  test('a curated function: areas strongest first with side, division and z; lesion checks; its kind line', () => {
    const id = domains.domains.find((d) => domainAreas(domains, d.id).length > AREAS_SHOWN)!.id;
    const profile = functionProfile(deps(), id, 'en');
    assert.equal(profile.searched, false);
    assert.equal(profile.areas.length, domainAreas(domains, id).length);
    const zs = profile.areas.map(({ z }) => Number(z));
    assert.deepEqual(
      zs,
      [...zs].sort((a, b) => b - a),
    );
    assert.match(profile.areas[0]!.name, / · (Left|Right)/);
    assert.ok(profile.areas.some(({ division }) => division !== null));
    assert.ok(profile.lesions !== null);
    assert.match(
      `${profile.term!.before}${profile.term!.term}${profile.term!.after}`,
      /^Activation evidence · Neurosynth term “.+” · [\d,]+|\d+ studies?/,
    );
    assert.equal(profile.lesionBridge, null);
  });

  test('a searched term has no lesion section; a population term bridges only where Deficits match', () => {
    const population = [...domains.search!.terms.values()].find((r) => r.kind === 'population')!;
    const withMatches = functionProfile(deps(3), population.id, 'en');
    assert.equal(withMatches.searched, true);
    assert.equal(withMatches.lesions, null);
    assert.equal(withMatches.lesionBridge?.query, population.term);
    assert.match(withMatches.lesionBridge!.text, /^Deficits: 3 lesion profiles match “/);
    assert.equal(functionProfile(deps(0), population.id, 'en').lesionBridge, null);
    const fn = [...domains.search!.terms.values()].find((r) => r.kind === 'function')!;
    assert.equal(functionProfile(deps(3), fn.id, 'en').lesionBridge, null);
  });

  test('the caveat names the kind of evidence', () => {
    const copyOf = (id: string) => functionProfile(deps(), id, 'en').caveat;
    const term = [...domains.search!.terms.values()];
    assert.notEqual(
      copyOf(domains.domains[0]!.id),
      copyOf(term.find((r) => r.kind === 'function')!.id),
    );
    assert.notEqual(
      copyOf(term.find((r) => r.kind === 'function')!.id),
      copyOf(term.find((r) => r.kind === 'population')!.id),
    );
  });

  test('an unknown function fails loudly', () => {
    assert.throws(() => functionProfile(deps(), 'no-such-function', 'en'), /Unknown function/);
  });
});

describe('comparisonProfile', () => {
  test('each function in its colour, the areas both reach with both z, then each one’s own areas', () => {
    const id = 'compare:working-memory,term:action';
    const profile = comparisonProfile(deps(), id, 'fr');
    const memory = domainAreas(domains, 'working-memory');
    const action = domainAreas(domains, 'term:action');
    const actionRegions = new Set(action.map(({ region }) => region));
    const both = memory.filter(({ region }) => actionRegions.has(region));
    assert.ok(both.length > 0 && both.length < memory.length);

    assert.equal(profile.name, 'Mémoire de travail · action');
    assert.deepEqual(
      profile.functions.map((entry) => [entry.id, entry.lang, entry.colour]),
      [
        ['working-memory', null, COMPARE_COLORS[0]],
        ['term:action', 'en', COMPARE_COLORS[1]],
      ],
    );
    assert.deepEqual(
      profile.shared.areas.map(({ region }) => region).sort(),
      both.map(({ region }) => region).sort(),
    );
    const first = profile.shared.areas[0]!;
    const zOf = (areas: typeof memory) =>
      areas
        .find(({ region }) => region === first.region)!
        .z.toFixed(1)
        .replace('.', ',');
    assert.deepEqual(first.z, [zOf(memory), zOf(action)]);
    assert.match(first.name, / · (Gauche|Droit|Médian)/);
    // Every area appears once: shared, or under the one function that reaches it.
    assert.equal(profile.only[0]!.areas.length, memory.length - both.length);
    assert.equal(profile.only[1]!.areas.length, action.length - both.length);
    assert.ok(profile.only[0]!.areas.every(({ region }) => !actionRegions.has(region)));
    assert.equal(
      sharedCount(domains, id, 'en'),
      `Both reach ${areaCountShortOf(both.map(({ region }) => region))} at z\u00a0≥\u00a03`,
    );
    assert.equal(comparedAreas(domains, id).length, memory.length + action.length - both.length);
  });

  test('a function or the overview is not a comparison', () => {
    assert.throws(() => comparisonProfile(deps(), 'working-memory', 'en'), /Not a comparison/);
    assert.throws(() => comparisonProfile(deps(), ALL_DOMAINS, 'en'), /Not a comparison/);
  });
});

/** The short count the list rows use, for a set of regions. */
function areaCountShortOf(regions: string[]): string {
  const structures = regions.filter((region) => region.startsWith(`${domains.structure_atlas}:`));
  const areas = regions.length - structures.length;
  return `${areas} ${areas === 1 ? 'area' : 'areas'}${structures.length ? `, ${structures.length} ${structures.length === 1 ? 'structure' : 'structures'}` : ''}`;
}
