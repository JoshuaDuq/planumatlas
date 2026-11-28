// The invitation and link fields, kept apart so the tour and driver.js load only when it starts.
import { PREF_KEYS, defaultStorage, readPref } from '../../lib/state/prefs.ts';

/** What the tour keeps of the reader's view: the brain, its atlases and the language. */
export const HOME_PARAMS = ['anatomy', 'atlas', 'cuts', 'detail', 'lang'];

export const SEEN = 'seen';

export const parameters = (hash: string) =>
  hash
    .replace(/^#/, '')
    .split('&')
    .filter(Boolean)
    .map((pair) => pair.split('=') as [string, string]);

/**
 * Whether the opening view offers the short tour. Shared views and readers who have
 * already started a tour use the settings menu, as do readers who block site data.
 */
export function firstLaunch(hash: string, storage: Storage | null = defaultStorage()): boolean {
  if (!storage || readPref(PREF_KEYS.guide, storage) === SEEN) return false;
  return parameters(hash).every(([key]) => HOME_PARAMS.includes(key));
}
