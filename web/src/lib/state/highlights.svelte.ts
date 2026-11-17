import { HIGHLIGHT_COLORS, MAX_HIGHLIGHTS } from '../types/constants.ts';
import type { HighlightColor, HighlightedRegion } from '../types/index.ts';
import type { LesionStore } from './lesion.svelte.ts';
import type { SessionStore } from './session.svelte.ts';

/** Drawn, set aside by what the tab in front shows, or lifted by a masthead choice (`highlightStatus`). */
export type HighlightStatus = 'drawn' | 'aside' | 'lifted';

/**
 * The reader's highlighted regions, in the order they were added, each in one of the deficits' six
 * finding colours. A new region takes the colour the fewest hold, the first on a tie, so the first
 * three take the three that stay apart under colour-vision deficiency. A region added or recoloured
 * brings back highlights a masthead choice lifted, as painting does.
 */
export function createHighlights({
  status,
  showPaint,
}: {
  status: () => HighlightStatus;
  /** Ends the reader's lift (`showOverLift`). */
  showPaint: () => void;
}) {
  let list = $state.raw<readonly HighlightedRegion[]>([]);
  const current = $derived(status());

  const has = (region: string) => list.some((entry) => entry.region === region);
  function known(region: string) {
    if (!has(region)) throw new Error(`${region} is not highlighted.`);
  }
  function shown() {
    if (current === 'lifted') showPaint();
  }

  function leastHeld(): HighlightColor {
    const held = HIGHLIGHT_COLORS.map(
      (color) => list.filter((entry) => entry.color === color).length,
    );
    return HIGHLIGHT_COLORS[held.indexOf(Math.min(...held))]!;
  }

  return {
    get list() {
      return list;
    },
    get full() {
      return list.length >= MAX_HIGHLIGHTS;
    },
    get status() {
      return current;
    },
    has,
    /** Highlights the region in the colour the fewest hold, or takes its highlight away; true when added. */
    toggle(region: string): boolean {
      if (has(region)) {
        list = list.filter((entry) => entry.region !== region);
        return false;
      }
      if (list.length >= MAX_HIGHLIGHTS) {
        throw new RangeError(`At most ${MAX_HIGHLIGHTS} regions can be highlighted.`);
      }
      list = [...list, { region, color: leastHeld() }];
      shown();
      return true;
    },
    recolor(region: string, color: HighlightColor) {
      known(region);
      list = list.map((entry) => (entry.region === region ? { region, color } : entry));
      shown();
    },
    remove(region: string) {
      known(region);
      list = list.filter((entry) => entry.region !== region);
    },
    /** The highlights a link carries, in its order, in place of the reader's. */
    replace(next: readonly HighlightedRegion[]) {
      if (
        next.length > MAX_HIGHLIGHTS ||
        new Set(next.map(({ region }) => region)).size !== next.length
      ) {
        throw new RangeError('A set of highlights names each region once, at most twelve.');
      }
      list = next.map(({ region, color }) => ({ region, color }));
    },
    /** Draws highlights a masthead choice lifted. */
    show() {
      if (current !== 'lifted') throw new Error('The highlights are not lifted.');
      showPaint();
    },
  };
}

export type HighlightsStore = ReturnType<typeof createHighlights>;

/**
 * Draws the reader's highlights over the masthead choice that lifted them. An Anatomy paint that
 * choice lifted with them ends, as a new paint ends the others, so it does not take the stage back.
 */
export function showOverLift(
  session: Pick<
    SessionStore,
    'setConnectivitySeed' | 'setDisorderShown' | 'setLayersShown' | 'showPaint'
  >,
  lesion: Pick<LesionStore, 'mode' | 'setMode'>,
): void {
  session.setConnectivitySeed(null);
  session.setDisorderShown(null);
  session.setLayersShown(false);
  if (lesion.mode !== 'lesion') lesion.setMode('lesion');
  session.showPaint();
}
