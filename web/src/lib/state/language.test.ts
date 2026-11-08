// Ported from viewer/state/boot.test.js (startLanguage): `decodeState` is S4's, so the link's
// language arrives already decoded, and an unreadable `lang` arrives as undefined.
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { createLanguage, startLanguage } from './language.svelte.ts';
import { blockedStorage, fakeStorage } from './test-support.ts';

describe('startLanguage', () => {
  test('STORE-22: the start language is the link’s, else the saved one, else English', () => {
    expect(startLanguage('fr', 'en', [])).toBe('fr');
    expect(startLanguage(undefined, 'fr', [])).toBe('fr');
    expect(startLanguage(undefined, null, [])).toBe('en');
    expect(startLanguage('en', 'fr', [])).toBe('en');
    expect(startLanguage(undefined, 'de', [])).toBe('en');
  });

  test('without a link or a saved choice, the browser’s first language the app speaks decides', () => {
    expect(startLanguage(undefined, null, ['fr-CA', 'en-US'])).toBe('fr');
    expect(startLanguage(undefined, null, ['FR'])).toBe('fr');
    expect(startLanguage(undefined, null, ['de-DE', 'fr-FR', 'en'])).toBe('fr');
    expect(startLanguage(undefined, null, ['en-GB', 'fr'])).toBe('en');
    expect(startLanguage(undefined, null, ['de-DE', 'es'])).toBe('en');
    expect(startLanguage(undefined, 'de', ['fr-FR'])).toBe('fr');
    expect(startLanguage(undefined, 'en', ['fr-FR'])).toBe('en');
    expect(startLanguage('en', null, ['fr-FR'])).toBe('en');
  });
});

describe('STORE-22: every saved value with and without a link language', () => {
  test.each([
    [undefined, null, 'en'],
    [undefined, 'en', 'en'],
    [undefined, 'fr', 'fr'],
    [undefined, 'de', 'en'],
    ['fr', null, 'fr'],
    ['fr', 'en', 'fr'],
    ['en', 'fr', 'en'],
    ['en', 'de', 'en'],
  ] as const)('link %j, saved %j starts in %s', (link, saved, expected) => {
    expect(startLanguage(link, saved, [])).toBe(expected);
  });
});

describe('createLanguage', () => {
  const root = { lang: '' };
  beforeEach(() => {
    (globalThis as Record<string, unknown>).document = { documentElement: root };
    root.lang = '';
  });
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).document;
  });
  const storageOption = (storage: unknown) =>
    ({ storage, preferred: ['en-US'] }) as { storage: Storage; preferred: string[] };

  test('starts from the saved language and sets <html lang>', () => {
    const language = createLanguage(undefined, storageOption(fakeStorage({ 'planum-lang': 'fr' })));
    expect(language.current).toBe('fr');
    expect(root.lang).toBe('fr');
  });

  test('a link wins over the saved language and is not itself remembered', () => {
    const storage = fakeStorage({ 'planum-lang': 'fr' });
    const language = createLanguage('en', storageOption(storage));
    expect(language.current).toBe('en');
    expect(storage.store['planum-lang']).toBe('fr');
  });

  test('choosing a language persists it and <html lang> follows', () => {
    const storage = fakeStorage();
    const language = createLanguage(undefined, storageOption(storage));
    expect(root.lang).toBe('en');
    language.set('fr');
    expect(language.current).toBe('fr');
    expect(root.lang).toBe('fr');
    expect(storage.store['planum-lang']).toBe('fr');
  });

  test('following a link’s language changes <html lang> and is not remembered', () => {
    const storage = fakeStorage({ 'planum-lang': 'en' });
    const language = createLanguage(undefined, storageOption(storage));
    language.follow('fr');
    expect(language.current).toBe('fr');
    expect(root.lang).toBe('fr');
    expect(storage.store['planum-lang']).toBe('en');
    expect(() => language.follow('de' as never)).toThrow(RangeError);
  });

  test('an unknown language is an error', () => {
    const language = createLanguage(undefined, storageOption(fakeStorage()));
    expect(() => language.set('de' as never)).toThrow(RangeError);
    expect(language.current).toBe('en');
  });

  test('a French browser starts in French until the reader chooses', () => {
    const storage = fakeStorage();
    const language = createLanguage(undefined, {
      storage: storage as unknown as Storage,
      preferred: ['fr-CA', 'en'],
    });
    expect(language.current).toBe('fr');
    expect(root.lang).toBe('fr');
    expect(storage.store['planum-lang']).toBeUndefined();
  });

  test('blocked site data still switches language, without memory', () => {
    const language = createLanguage(undefined, storageOption(blockedStorage));
    language.set('fr');
    expect(language.current).toBe('fr');
  });
});
