import type { Language } from '../types/index.ts';
import { PREF_KEYS, defaultStorage, readPref, writePref } from './prefs.ts';

const LANGUAGES: readonly Language[] = ['en', 'fr'];

/**
 * The language to start in: the link's, else the reader's saved choice, else the first of the
 * browser's preferred languages that the app speaks, else English (state/boot.js:4).
 * `linkLanguage` is what `decodeState` found in the link; a `lang` the link gets wrong is absent
 * there and reported elsewhere, so it does not decide this. `preferred` is `navigator.languages`.
 */
export function startLanguage(
  linkLanguage: Language | undefined,
  saved: string | null,
  preferred: readonly string[],
): Language {
  if (linkLanguage) return linkLanguage;
  if (saved === 'fr' || saved === 'en') return saved;
  const spoken = preferred
    .map((tag) => tag.toLowerCase().split('-')[0])
    .find((primary): primary is Language => LANGUAGES.includes(primary as Language));
  return spoken ?? 'en';
}

/** The reader's language. `<html lang>` follows it, and a choice is remembered. */
export function createLanguage(
  linkLanguage: Language | undefined,
  {
    storage = defaultStorage(),
    preferred = navigator.languages,
  }: { storage?: Storage | null; preferred?: readonly string[] } = {},
) {
  const initial = startLanguage(linkLanguage, readPref(PREF_KEYS.language, storage), preferred);
  let language = $state<Language>(initial);
  document.documentElement.lang = initial;
  return {
    get current() {
      return language;
    },
    set(next: Language) {
      if (!LANGUAGES.includes(next)) throw new RangeError(`Unknown language: ${next}`);
      language = next;
      document.documentElement.lang = next;
      writePref(PREF_KEYS.language, next, storage);
    },
    /** The language a link carries: shown and announced, never remembered (app.js:612). */
    follow(next: Language) {
      if (!LANGUAGES.includes(next)) throw new RangeError(`Unknown language: ${next}`);
      language = next;
      document.documentElement.lang = next;
    },
  };
}

export type LanguageStore = ReturnType<typeof createLanguage>;
