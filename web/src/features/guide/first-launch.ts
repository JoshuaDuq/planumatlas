// What boot asks of the guided tour, kept apart so the tour and driver.js load only when it starts.
import { PREF_KEYS, readPref } from '../../lib/state/prefs.ts';

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
 * Whether to start the tour by itself: on a first visit, and only to a page opened plainly, since a
 * link someone shared opens a view the reader came to see. Starting the tour, by hand or not,
 * counts as having seen it.
 */
export function firstLaunch(hash: string): boolean {
  if (readPref(PREF_KEYS.guide) === SEEN) return false;
  return parameters(hash).every(([key]) => HOME_PARAMS.includes(key));
}
