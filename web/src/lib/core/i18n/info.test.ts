import { expect, test } from 'vitest';
import { METHODS_PAGES } from '../methods.ts';
import { TRANSLATIONS } from './index.ts';

const TABS = ['anatomy', 'functions', 'deficits', 'circuits', 'tracts'] as const;
const TOOLS = ['section', 'lesion', 'coordinate', 'overlay', 'display'] as const;
const words = (text: string) => text.trim().split(/\s+/).length;

test('I18N-31 · ten places say what they show, where it comes from and a caution, in both languages', () => {
  for (const lang of ['en', 'fr'] as const) {
    const copy = TRANSLATIONS[lang].info;
    for (const place of [...TABS, ...TOOLS]) {
      expect(place in METHODS_PAGES, `${place} has a methods page`).toBe(true);
      for (const part of ['shows', 'source', 'caution'] as const) {
        const text = copy[place][part];
        expect(text.trim(), `${lang} ${place}.${part}`).not.toBe('');
        expect(words(text), `${lang} ${place}.${part} in words`).toBeLessThanOrEqual(60);
      }
    }
    for (const place of TABS) expect(copy[place].scope.trim()).not.toBe('');
    for (const place of TOOLS) expect('scope' in copy[place]).toBe(false);
  }
  // Only English is held to one short line; French may wrap to two.
  for (const place of TABS) {
    expect(TRANSLATIONS.en.info[place].scope.length, place).toBeLessThanOrEqual(60);
  }
  expect(TRANSLATIONS.en.info.functions.scope).toBe(
    'Where imaging studies of a function report activation.',
  );
  expect(TRANSLATIONS.en.info.deficits.scope).toBe(
    'Lesion evidence: where damage is linked to a deficit.',
  );
});
