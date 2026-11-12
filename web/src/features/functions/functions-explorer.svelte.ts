// The Functions tab's state and commands (viewer/ui/panels/functions.js:97-168, 320-335, 384-390):
// the latest-wins run, the busy and failure state of the profile's meta line, the open and restore
// hand-offs. `FunctionList`, `FunctionProfile` and `FunctionRestore` draw it.
import { tick } from 'svelte';
import type { KeyGround } from '../../lib/types/index.ts';
import { createLatestRunner } from '../../lib/core/async/latest.ts';
import type { createCatalog } from '../../lib/core/catalog/catalog.ts';
import type { FunctionalRegions } from '../../lib/core/catalog/functional-regions.ts';
import {
  ALL_DOMAINS,
  COMPARE_MAX,
  comparedIds,
  compareId,
  paintAtlas,
  type NeuropsychDomains,
} from '../../lib/core/catalog/neuropsych-domains.ts';
import { t } from '../../lib/core/i18n/index.ts';
import { stageMessage } from '../../lib/core/panels/clinical.ts';
import type { Excursions } from '../../lib/controller/excursion.svelte.ts';
import type { MapOverlapFacts } from '../../lib/state/map-overlap.svelte.ts';
import type { SessionStore } from '../../lib/state/session.svelte.ts';
import { FOCUS_TARGETS, focusHeading, requestFocus } from '../../lib/ui/focus.ts';
import { scrollToTop } from '../../lib/ui/scroll.ts';
import { areaCount, atlasName, sharedCount } from './functions-view.ts';

export interface FunctionExplorerDeps {
  session: Pick<SessionStore, 'state' | 'setFunctionQuery' | 'setPaintFrom'>;
  /** The S3 controller's members the tab calls (`createExcursions`). */
  excursions: Pick<
    Excursions,
    | 'openFunction'
    | 'openFunctionMri'
    | 'openListedRegion'
    | 'restoreBeforeExcursion'
    | 'restorable'
    | 'offerReload'
    | 'searchIn'
    | 'deficitsMatching'
    | 'beneath'
    | 'showBeneathCortex'
  >;
  domains: NeuropsychDomains;
  anatomy: Pick<ReturnType<typeof createCatalog>, 'get'>;
  functionalRegions: FunctionalRegions | null;
  /** X2's entry point, which opens a deficit under its own runner. */
  openDeficit: (id: string) => unknown;
  /** The atlas the cortex is drawn on now. */
  atlas: () => string;
  /** What shows where the paint leaves an area (paint.ts `keyGround`). */
  ground: () => KeyGround;
  /** The reader's map drawn against the open function, or null. */
  mapOverlap: () => MapOverlapFacts | null;
}

/** The legacy run options: which busy and failure sentence, and which operation a bare failure names. */
type Run = {
  busy: 'loading' | 'restoring';
  failure: 'failed' | 'restoreFailed' | null;
  operation: 'colour' | 'region';
};

const OPEN: Run = { busy: 'loading', failure: 'failed', operation: 'colour' };
const OPEN_AREA: Run = { busy: 'loading', failure: null, operation: 'region' };
const RESTORE: Run = { busy: 'restoring', failure: 'restoreFailed', operation: 'colour' };

export function createFunctionExplorer(deps: FunctionExplorerDeps) {
  const { session, excursions, domains } = deps;
  const runner = createLatestRunner();

  let opening = $state(false);
  // Compare mode turns the list's rows into checkboxes; the picks outlive a comparison's profile.
  let comparing = $state(false);
  let picked = $state<string[]>([]);
  let run = $state<Run>(OPEN);
  // A failure belongs to the profile it happened in: another function or language clears it.
  let failed = $state.raw<{ profile: string; error: unknown } | null>(null);

  let search: HTMLInputElement | null = null;
  let profile: HTMLElement | null = null;
  let list: HTMLElement | null = null;

  /** The open function's id, in the Functions tab. */
  const selected = (): string | null =>
    session.state.explorer === 'functions' ? session.state.selectedFunction : null;
  const profileKey = () => `${session.state.lang}|${session.state.selectedFunction}`;
  const error = $derived(failed?.profile === profileKey() ? failed.error : null);

  /** Starts a run, which overtakes any earlier one: only the latest speaks. */
  function start<T>(options: Run, action: () => Promise<T> | T) {
    opening = true;
    run = options;
    failed = null;
    return runner.run(action, {
      onError: (cause) => {
        failed = { profile: profileKey(), error: cause };
        excursions.offerReload(cause);
      },
      onSettled: () => {
        opening = false;
      },
    });
  }

  /** The profile's name takes focus once it opens. */
  function focusTitle() {
    const title = profile?.querySelector<HTMLElement>('[data-function-title]');
    if (!title) throw new Error('The function profile has no title to focus.');
    focusHeading(title);
  }

  async function openFunction(id: string): Promise<boolean> {
    const outcome = await start(OPEN, async () => {
      const preparing = excursions.openFunction(id);
      // The controller rendered the profile; a re-selected function has its heading already.
      await tick();
      if (!profile) throw new Error('The function profile is not mounted.');
      scrollToTop(profile);
      focusTitle();
      return preparing;
    });
    return outcome.ok && outcome.value !== false;
  }

  return {
    get query() {
      return session.state.functionQuery;
    },
    get lang() {
      return session.state.lang;
    },
    get ground() {
      return deps.ground();
    },
    /** The Functions tab is in front. */
    get exploring() {
      return session.state.explorer === 'functions';
    },
    get selected() {
      return selected();
    },
    /** The list's rows pick functions to compare instead of opening one. */
    get comparing() {
      return comparing;
    },
    /** The functions picked to compare, in the order picked. */
    get picked(): readonly string[] {
      return picked;
    },
    /** A run is in flight: areas and Restore turn the reader away. */
    get opening() {
      return opening;
    },
    /** Whether the scene from before this excursion can be put back. */
    get restorable() {
      return excursions.restorable;
    },
    /** The profile's meta line: work in progress, a failure, or what the stage shows. */
    get meta(): string {
      const id = selected();
      if (!id) return '';
      const { lang } = session.state;
      const copy = t(lang, 'functions');
      const shownOn = atlasName(paintAtlas(domains, id, deps.atlas()), lang);
      const text = {
        ...t(lang, 'clinical'),
        loading: copy.loading(shownOn),
        failed: copy.failed(shownOn),
      };
      return stageMessage(text, {
        opening,
        busy: run.busy,
        error,
        failure: run.failure,
        operation: run.operation,
        lang,
        status:
          id === ALL_DOMAINS
            ? copy.shown(shownOn)
            : comparedIds(id)
              ? sharedCount(domains, id, lang)
              : areaCount(
                  domains,
                  id,
                  lang,
                  paintAtlas(domains, id, deps.atlas()),
                  session.state.paintFrom ?? domains.threshold_z,
                ),
      });
    },
    get failed() {
      return Boolean(error);
    },
    domains,
    /** The open single function's paint threshold: the reader's raised one, else the published z. */
    get paintFrom(): number {
      return session.state.paintFrom ?? domains.threshold_z;
    },
    /** Raises or lowers it; the published value is written as none, so a link leaves it out. */
    setPaintFrom(value: number) {
      session.setPaintFrom(value === domains.threshold_z ? null : value);
    },
    get mapOverlap() {
      return deps.mapOverlap();
    },
    /** The atlas the open function is painted on: the reader's own where it can be, else HCP-MMP. */
    get atlas() {
      return paintAtlas(domains, selected() ?? ALL_DOMAINS, deps.atlas());
    },
    anatomy: deps.anatomy,
    functionalRegions: deps.functionalRegions,
    deficitsMatching: excursions.deficitsMatching,
    get beneath() {
      return excursions.beneath;
    },
    showBeneathCortex: excursions.showBeneathCortex,

    setQuery: (query: string) => session.setFunctionQuery(query),
    /** A search carried to the Deficits tab. */
    searchDeficits: (query: string) => excursions.searchIn('deficits', query),
    openDeficit: deps.openDeficit,

    /** Enters or leaves compare mode; leaving forgets the picks. */
    toggleComparing() {
      comparing = !comparing;
      picked = [];
    },
    /** Picks or unpicks a function; a full set takes no more. */
    togglePick(id: string) {
      if (picked.includes(id)) picked = picked.filter((entry) => entry !== id);
      else if (picked.length < COMPARE_MAX) picked = [...picked, id];
    },
    /** Opens the comparison of the picked functions. */
    compare: (): Promise<boolean> => openFunction(compareId(picked)),

    /** The field takes focus with its text selected (the `/` key). */
    focusSearch() {
      search?.focus();
      search?.select();
    },
    attachSearch(input: HTMLInputElement, listRoot: HTMLElement) {
      search = input;
      list = listRoot;
      return () => {
        if (search === input) search = null;
        if (list === listRoot) list = null;
      };
    },
    attachProfile(root: HTMLElement) {
      profile = root;
      return () => {
        if (profile === root) profile = null;
      };
    },

    /**
     * Opens a function or a comparison: the S3 controller draws it and downloads what it needs, the
     * profile starts at its top and its name takes focus at once (functions.js:157). The entry point
     * S3 takes as `panels.openFunction`; `chooseMode` and a paint pick call it too.
     */
    openFunction,

    /** The Linked MRI at the open function's strongest area, its paint over the scan; `instant` for a key press. */
    openMri(options: { instant: boolean }) {
      const id = selected();
      if (!id) throw new Error('No function is open to show in the Linked MRI.');
      return excursions.openFunctionMri(id, options);
    },

    /** An area the profile names: drawn, selected and framed; its name then takes focus. */
    async openArea(region: string): Promise<void> {
      if (opening) return;
      const outcome = await start(OPEN_AREA, () => excursions.openListedRegion(region));
      if (!outcome.ok || outcome.value === false) return;
      // The region's name is brought to the top below the profile, then takes focus (clinical.js:23-30).
      if (requestFocus(FOCUS_TARGETS.regionTitle, { preventScroll: true })) {
        (document.activeElement as HTMLElement).scrollIntoView({ block: 'start' });
      }
    },

    /** The profile closes with the excursion it opened, so focus returns to its row in the list, or to the tab Restore returned to. */
    async restore(): Promise<void> {
      if (opening) return;
      const id = session.state.selectedFunction;
      const outcome = await start(RESTORE, () => excursions.restoreBeforeExcursion());
      if (!outcome.ok || outcome.value === false) return;
      // The workspace has returned to the list by the time the page has settled.
      await tick();
      // Restore returned to another tab: focus goes to its region, else to that tab.
      if (session.state.explorer !== 'functions') {
        requestFocus(FOCUS_TARGETS.regionTitle, { fallback: FOCUS_TARGETS.activeTab });
        return;
      }
      // A comparison returns to the button that opened it, a function to its row.
      const opener = comparedIds(id)
        ? '[data-compare-open]'
        : id && `[data-function="${CSS.escape(id)}"]`;
      const row = opener && list?.parentElement?.querySelector<HTMLElement>(opener);
      (row || search)?.focus();
    },
  };
}

export type FunctionExplorer = ReturnType<typeof createFunctionExplorer>;
