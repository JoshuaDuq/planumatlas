import type { EXPLORERS } from './constants.ts';
import type { ShownNotice } from './notice.ts';

export type Explorer = (typeof EXPLORERS)[number];
export type Language = 'en' | 'fr';
export type Theme = 'light' | 'dark';

/** `switching` is a download behind a model already on screen (state/session.js:121). */
export type LoadStatus = 'loading' | 'ready' | 'switching' | 'context-lost' | 'error';

export interface LoadProgress {
  loaded: number;
  total: number;
  /** The cortex is drawn, and this is the internal anatomy still loading. */
  internal?: boolean;
}

/** The reader's session state (`createSession`, state/session.js:49). */
export interface SessionState {
  view: string;
  query: string;
  explorer: Explorer;
  functionQuery: string;
  selectedFunction: string | null;
  clinicalQuery: string;
  selectedDeficit: string | null;
  /** One of the open deficit's findings shown alone, or null for all of them. */
  selectedFinding: string | null;
  /** The reader chose a masthead colour or atlas over the open function's or deficit's paint. */
  paintLifted: boolean;
  /** A single function's or term's paint threshold the reader raised, or null for the published z 3. */
  paintFrom: number | null;
  /**
   * The region whose resting functional connectivity Anatomy paints, from its sheet's "Paint on the
   * brain"; null for none. Not written to links.
   */
  connectivitySeed: string | null;
  /**
   * The disorder whose case–control differences Anatomy paints on Desikan-Killiany, from a region
   * sheet's "Paint on the brain"; null for none. Not written to links.
   */
  disorderShown: string | null;
  /** The Tracts tab's open profile: a tract row's key, or null for the list. Not written to links. */
  selectedTract: string | null;
  /** The Tracts tab's streamlines stay drawn on the other tabs, over their own anatomy. */
  keepTracts: boolean;
  expanded: ReadonlySet<string>;
  theme: Theme;
  lang: Language;
  status: LoadStatus;
  progress: LoadProgress | null;
  error: Error | null;
  notice: ShownNotice | null;
}
