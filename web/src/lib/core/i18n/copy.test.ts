import { expect, test } from 'vitest';
import * as guide from './areas/guide.ts';
import * as template from './areas/template.ts';
import { TRANSLATIONS } from './index.ts';

// The tour's and the template's wording load on demand, but are approved as the rest is.
const TABLES = {
  en: { ...TRANSLATIONS.en, guide: guide.en, template: template.en },
  fr: { ...TRANSLATIONS.fr, guide: guide.fr, template: template.fr },
};

/**
 * I18N-04: the approved copy. Each language's table is written to a committed snapshot, every
 * function called at fixed arguments, so a change of wording shows up in review. Regenerate with
 * `vitest -u` only for a reviewed change of the record.
 */

/** Argument pools by parameter kind; the i-th call takes the (i + position)-th member of each. */
const POOLS = {
  s: ['Alpha', ''],
  n: [0, 1, 2, 183, 12345],
  b: [true, false],
  g: ['tissue', 'scan', 'grey'],
  a: [['a', 'b'], ['one'], []],
  l: [null, '3.5'],
  o: [{ individual: true }, { individual: false }],
  d: [
    [1, 2, 3],
    [182, 218, 182],
  ],
  // Seconds to wait, or none given.
  w: [null, 1, 60],
} as const;

/** Parameter kinds of every function that takes anything but strings, by `area.leaf`. */
const KINDS: Record<string, string> = {
  'dissection.hiddenCount': 'n',
  'functional.section': 'n',
  'functional.contested': 'nn',
  'footer.colophon': 'sb',
  'template.deficitsElsewhere': 'n',
  'template.circuitsElsewhere': 'n',
  'footer.kind': 'b',
  'footer.sourceFiles': 'nb',
  'footer.visibleRegions': 'n',
  'footer.feedbackFailed.rateLimited': 'w',
  'boundary.summary': 'snn',
  'boundary.more': 'n',
  'receptors.note': 'snnsn',
  'territories.unassigned': 's',
  'cerebellarFunctions.unassigned': 's',
  'comparison.more': 'n',
  'domains.band': 'sl',
  'domains.keyScale': 'gs',
  'domains.keyScaleTerm': 'gs',
  'domains.keyAll': 'g',
  'domains.keyCompare': 'g',
  'domains.keyMap': 'b',
  'deficitKey.keyAll': 'g',
  'deficitKey.keyOne': 'g',
  'connectivity.keyNote': 'sg',
  'domains.lesionCheck': 'a',
  'functions.areas': 'nns',
  'functions.areasShort': 'nn',
  'functions.coverage': 'nn',
  'functions.deficitBridge': 'ns',
  'functions.more': 'n',
  'functions.results': 'nn',
  'functions.termsMore': 'n',
  'mpr.note': 'o',
  'mpr.readout': 'ssn',
  'navigator.showingCapped': 'ns',
  'shortcuts.singleKeysNote': 'b',
  'clinical.evidenceKind': 'n',
  'clinical.functionBridge': 'ns',
  'clinical.results': 'n',
  'clinical.regionsMarked': 'nnb',
  'circuits.landmarkCount': 'n',
  'circuits.coverage': 'nn',
  'circuits.step': 'nn',
  'circuits.stepShort': 'nn',
  'diffusion.matches': 'n',
  'diffusion.streamlines': 'nn',
  'diffusion.bundlesDrawn': 'nn',
  'mri.grid': 'ds',
  'mri.dialog.grid': 'ds',
  'mri.dialog.range': 'n',
  'mri.dialog.moved': 'd',
  'viewport.loadingWithTotal': 'nn',
  'lesion.cited': 'sn',
  'overlay.reasons.fileSize': 'nn',
  'overlay.reasons.declared': 'nn',
  'overlay.reasons.inflated': 'n',
  'overlay.reasons.rank': 'n',
  'overlay.reasons.volumes': 'n',
  'overlay.reasons.tooLarge': 'sn',
  'overlay.reasons.storedType': 'sn',
  'overlay.reasons.unknownType': 'n',
  'overlay.reasons.offset': 'n',
  'overlay.reasons.truncated': 'nn',
  'overlay.reasons.intercept': 'n',
  'overlay.reasons.overflow': 'n',
};

type Fn = (...args: unknown[]) => unknown;

/** Each call of a function at the fixed arguments, with what it says or the error it throws. */
function calls(fn: Fn, path: string): { args: unknown[]; said: unknown; threw: boolean }[] {
  const kinds = KINDS[path] ?? 's'.repeat(fn.length);
  return Array.from({ length: 5 }, (_, i) => {
    const args = [...kinds].map((kind, position) => {
      const pool = POOLS[kind as keyof typeof POOLS] as readonly unknown[];
      return pool[(i + position) % pool.length];
    });
    try {
      return { args, said: fn(...args), threw: false };
    } catch (error) {
      return { args, said: `throws ${(error as Error).message}`, threw: true };
    }
  });
}

/** What a function says at the fixed arguments; a throw is recorded too. */
function sample(fn: Fn, path: string): string[] {
  const said = calls(fn, path).map(
    ({ args, said }) => `${JSON.stringify(args)} → ${JSON.stringify(said)}`,
  );
  return [...new Set(said)];
}

/** The table with each function replaced by what it says. */
function resolve(node: unknown, path: string): unknown {
  if (typeof node === 'function') return sample(node as Fn, path);
  if (Array.isArray(node)) return node.map((item) => resolve(item, path));
  if (node && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node).map(([key, value]) => [
        key,
        resolve(value, path ? `${path}.${key}` : key),
      ]),
    );
  }
  return node;
}

/** Spaces and hyphens that look alike are written by name, so a review can see them. */
const visible = (json: string) =>
  json.replaceAll(' ', '<NNBSP>').replaceAll(' ', '<NBSP>').replaceAll('\u2011', '<NBHY>');

for (const lang of ['en', 'fr'] as const) {
  test(`I18N-04 · the ${lang} interface says the approved copy`, async () => {
    const text = JSON.stringify(resolve(TABLES[lang], ''), null, 1);
    await expect(visible(text)).toMatchFileSnapshot(`./__snapshots__/copy.${lang}.txt`);
  });
}

/** Every string a table says, by `area.leaf` path; functions are called as for the snapshot. */
function texts(node: unknown, path: string): { path: string; text: string }[] {
  if (typeof node === 'string') return [{ path, text: node }];
  if (typeof node === 'function') {
    return calls(node as Fn, path).flatMap(({ said, threw }) => (threw ? [] : texts(said, path)));
  }
  if (Array.isArray(node)) return node.flatMap((item) => texts(item, path));
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([key, value]) =>
      texts(value, path ? `${path}.${key}` : key),
    );
  }
  return [];
}

const NNBSP = String.fromCodePoint(0x202f);
const NBSP = String.fromCodePoint(0x00a0);

/** A mark after any character without NNBSP before it, or « » without NBSP inside. */
const MISSPACED = new RegExp(`(?<=.)(?<!${NNBSP})[;:?!]|«(?!${NBSP})|(?<!${NBSP})»`, 'gsu');

/** Each place a text breaks I18N-31, with the characters before it. */
const misspaced = (text: string) =>
  [...text.matchAll(MISSPACED)].map(({ index }) => text.slice(Math.max(0, index - 16), index + 1));

/** French text kept as written although a mark has no NNBSP before it. */
const FRENCH_SPACING_KEPT = [
  { path: 'guide.stops.body', excerpt: '(touche ?)', why: 'names the ? key, not a question' },
  { path: 'shortcuts.singleKeysNote', excerpt: '/ et ?)', why: 'names the / and ? keys' },
];

test('I18N-31 · the French spacing check finds a missing or wrong space', () => {
  const kept = [`Accord${NNBSP}: a${NNBSP}; b${NNBSP}? c${NNBSP}!`, '?', `«${NBSP}a${NBSP}»`];
  expect(kept.map(misspaced)).toEqual([[], [], []]);
  const broken = ['Accord : a', 'Accord: a', `Accord${NBSP}: a`, '« a »', `«${NNBSP}a${NNBSP}»`];
  expect(broken.map((text) => misspaced(text).length)).toEqual([1, 1, 1, 2, 2]);
});

test('I18N-31 · French sets NNBSP before ; : ? ! and NBSP inside « »', () => {
  const unused = new Set(FRENCH_SPACING_KEPT);
  const found = texts(TABLES.fr, '').flatMap(({ path, text }) => {
    let rest = text;
    for (const kept of FRENCH_SPACING_KEPT) {
      if (kept.path !== path || !rest.includes(kept.excerpt)) continue;
      rest = rest.replaceAll(kept.excerpt, '');
      unused.delete(kept);
    }
    return misspaced(rest).map((at) => `${path}: ${visible(at)}`);
  });
  expect([...new Set(found)]).toEqual([]);
  // An exception that no longer matches would excuse nothing: drop it.
  expect([...unused]).toEqual([]);
});
