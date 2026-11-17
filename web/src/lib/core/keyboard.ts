/**
 * Marks a region whose controls use letters or digits themselves: the masthead, the panels
 * and the stage dock (legacy `#sheet, #masthead, #stage-dock`, ui/chrome/shortcuts.js:9-10).
 * The global single-key shortcuts (S5a) skip a pressable control inside a marked region, so an
 * `h` pressed on a hemisphere button does not also change the hemisphere. Controls outside
 * those regions are not marked (conductor decision 7 on #4).
 */
export const OWN_KEYS_ATTRIBUTE = 'data-own-keys';

export const OWN_KEYS_SELECTOR = `[${OWN_KEYS_ATTRIBUTE}]`;

/** Pressable controls: the only targets that keep their keys (shortcuts.js:9). */
const OWN_KEYS = 'button, summary, [role="tab"]';

/** The parts of a focused element that say whether it has keys of its own. */
export interface OwnKeysTarget {
  matches?(selector: string): boolean;
  closest?(selector: string): unknown;
}

/** Letters, digits and symbols: the keys WCAG 2.1.4 lets a reader turn off. */
export const isCharacterKey = (key: unknown): key is string =>
  typeof key === 'string' && [...key].length === 1;

/**
 * Whether a one-character shortcut may act. Off entirely if the reader turned them off, and never
 * from a pressable control inside a region that marks its keys as its own (`data-own-keys`: the
 * masthead, the panels, the stage dock): an `h` pressed on a hemisphere button would otherwise
 * change the hemisphere. A tree row, or a view preset over the canvas, keeps the shortcuts.
 */
export function characterShortcutAllowed(
  target: OwnKeysTarget | null | undefined,
  enabled: boolean,
): boolean {
  if (!enabled) return false;
  return !(target?.matches?.(OWN_KEYS) && target.closest?.(OWN_KEYS_SELECTOR));
}
