/**
 * View-level state, and the assembly of the single snapshot every UI module
 * renders from.
 *
 * The model owns what is displayed; the session owns how the interface is
 * arranged around it. Keeping both behind one `assemble` means panels are
 * updated from one place, and cannot be reached by two update paths that
 * disagree.
 *
 * Free of the DOM and of Three.js, so all of it is unit tested.
 */
import { EXPLORERS } from '../../types/constants.ts';
import type {
  Explorer,
  Language,
  LoadProgress,
  LoadStatus,
  Notice,
  SessionState,
  Theme,
} from '../../types/index.ts';

/** Inputs that consume typed characters, where a global shortcut would steal them. */
const TYPING_INPUT_TYPES = new Set<string | undefined>([
  'text',
  'search',
  'email',
  'number',
  'password',
  'tel',
  'url',
  undefined,
]);

/** Keys a slider moves itself with; a shortcut on them would leave it dead. */
const RANGE_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]);

/** The parts of a focused element that decide whether a shortcut may act. */
export interface ShortcutTarget {
  isContentEditable?: boolean;
  tagName?: string;
  type?: string;
}

/**
 * Whether a single-key shortcut may act, given what currently has focus.
 * Without this, `3` could not be typed into search, and `3b` is a real
 * HCP-MMP area. A slider gives up only its own keys when the key is given,
 * and every key when it is not.
 */
export function shortcutsAllowed(target: ShortcutTarget | null | undefined, key?: string): boolean {
  if (!target) return true;
  if (target.isContentEditable) return false;
  const tag = target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return false;
  if (tag === 'INPUT' && target.type === 'range') return key !== undefined && !RANGE_KEYS.has(key);
  if (tag === 'INPUT') return !TYPING_INPUT_TYPES.has(target.type);
  return true;
}

const asLanguage = (value: string): Language => (value === 'en' || value === 'fr' ? value : 'en');

/** The model is on screen and takes commands: ready, or ready with a download behind it. */
export const modelUsable = (status: LoadStatus): boolean =>
  status === 'ready' || status === 'switching';

export interface SessionOptions {
  views: Iterable<string>;
  theme?: Theme;
  lang?: string;
}

export function createSession({ views, theme = 'dark', lang = 'en' }: SessionOptions) {
  const knownViews = new Set(views);
  let holds = 0;
  let held: Notice[] | null = null;
  // Where a lost context goes back to: the start it interrupted, or the model on screen.
  let lostFrom: 'loading' | 'ready' = 'ready';
  // One notice from several, each said once; the first action offered wins.
  const joined = (notices: (Notice | null)[]): Notice => {
    const present = notices.filter((notice): notice is Notice => Boolean(notice));
    return {
      text: present.reduce(
        (text, { text: next }) => (text.includes(next) ? text : `${text} ${next}`.trim()),
        '',
      ),
      action: present.find((notice) => notice.action)?.action ?? null,
    };
  };
  let state: SessionState = {
    view: 'oblique',
    query: '',
    explorer: 'anatomy',
    functionQuery: '',
    selectedFunction: null,
    clinicalQuery: '',
    selectedDeficit: null,
    // One of the open deficit's findings shown alone, or null for all of them.
    selectedFinding: null,
    // The reader chose a masthead colour or atlas over the open function's or deficit's paint.
    paintLifted: false,
    expanded: new Set(),
    theme,
    lang: asLanguage(lang),
    status: 'loading',
    progress: null,
    error: null,
    notice: null,
  };

  /** Any deliberate action supersedes a standing notice. */
  const act = (change: Partial<SessionState>) => {
    state = { ...state, notice: null, ...change };
    return true;
  };

  return {
    setView(view: string) {
      if (!knownViews.has(view)) return false;
      return act({ view });
    },

    setQuery: (query: string) => act({ query }),

    setExplorer(explorer: Explorer) {
      if (!EXPLORERS.includes(explorer)) throw new Error(`Unknown explorer: ${explorer}`);
      return act({ explorer, paintLifted: false });
    },

    setFunctionQuery: (functionQuery: string) => act({ functionQuery }),
    setFunction: (selectedFunction: string | null) => act({ selectedFunction, paintLifted: false }),
    setClinicalQuery: (clinicalQuery: string) => act({ clinicalQuery }),
    setDeficit: (selectedDeficit: string | null) =>
      act({ selectedDeficit, selectedFinding: null, paintLifted: false }),
    setFinding: (selectedFinding: string | null) => act({ selectedFinding, paintLifted: false }),
    liftPaint: () => act({ paintLifted: true }),
    /** The reader asked for a paint again, as the lesion's findings on the brain. */
    showPaint: () => act({ paintLifted: false }),

    toggleGroup(name: string) {
      const expanded = new Set(state.expanded);
      if (!expanded.delete(name)) expanded.add(name);
      return act({ expanded });
    },

    setExpanded: (expanded: Iterable<string>) => act({ expanded: new Set(expanded) }),

    setTheme: (value: Theme) => act({ theme: value }),

    setLang: (value: string) => act({ lang: asLanguage(value) }),

    /*
     * The load lifecycle. Every status change is one of these events:
     *
     *   loading ──loaded──▶ ready ⇄ switching (setSwitching / endSwitching)
     *   loading | ready | switching ──contextLost──▶ context-lost ──contextRestored──▶ where it was lost
     *   anything ──error──▶ error, which is final
     *
     * An event that arrives where it has no meaning is a race the stage outlives (a late progress
     * after a failure, a download during a lost context) and changes nothing; one that only a bug
     * could send throws.
     */

    /** The start's own download. Only the start shows it: elsewhere it changes nothing. */
    setProgress(progress: LoadProgress | null) {
      if (state.status === 'loading') act({ progress });
    },

    /** The start is over. A context lost meanwhile still stands, and its restoration lands on ready. */
    setLoaded() {
      if (state.status === 'context-lost' && lostFrom === 'loading') {
        lostFrom = 'ready';
        return;
      }
      if (state.status !== 'loading') throw new Error(`The start already ended (${state.status}).`);
      act({ status: 'ready', progress: null });
    },

    /**
     * A download behind a model that is already on screen: the model stays
     * usable and only the status bar reports. Progress is not an action, so a
     * standing notice stays, and the first load keeps its own status.
     */
    setSwitching(progress: LoadProgress | null) {
      if (modelUsable(state.status)) state = { ...state, status: 'switching', progress };
    },

    endSwitching() {
      if (state.status === 'switching') state = { ...state, status: 'ready', progress: null };
    },

    setError: (error: Error) => act({ status: 'error', error, progress: null }),

    /** The GPU dropped the context. Recoverable; the stage says so in the reader's language. */
    setContextLost() {
      if (state.status === 'error') return;
      lostFrom = state.status === 'loading' ? 'loading' : 'ready';
      act({ status: 'context-lost', progress: null });
    },

    /** The GPU gave the context back: the stage returns to where it was lost. */
    setContextRestored() {
      if (state.status === 'error') return;
      if (state.status !== 'context-lost') throw new Error('The GPU context was not lost.');
      act({ status: lostFrom });
    },

    /**
     * `{ text, action }`; cleared by the next action or by the reader, never by a timer.
     * A notice arriving while another stands joins it, so neither goes unread.
     */
    notify(notice: Notice | null) {
      if (notice !== null && typeof notice?.text !== 'string') {
        throw new TypeError('A notice needs text.');
      }
      if (notice && held) held.push(notice);
      else state = { ...state, notice: notice && joined([state.notice, notice]) };
    },

    /**
     * While a link is applied its own steps are actions that would clear a notice
     * raised meanwhile, so notices wait until the last hold is released.
     */
    holdNotices() {
      holds += 1;
      held ??= [];
    },

    /** Show what waited, after `lead` (the link's own notice), as one notice; the first action offered wins. */
    releaseNotices(lead: Notice | null = null) {
      if (!held) throw new Error('No notices are held.');
      if (lead) held.unshift(lead);
      holds -= 1;
      if (holds > 0) return;
      const waiting = held;
      held = null;
      if (waiting.length) state = { ...state, notice: joined([state.notice, ...waiting]) };
    },

    /**
     * One object, assembled once per change. Derived values — search results,
     * groups, visible counts — are computed by the catalog at render time and
     * deliberately absent here.
     */
    assemble<M extends object>(modelState: M): M & SessionState {
      return { ...modelState, ...state };
    },
  };
}

export type Session = ReturnType<typeof createSession>;
