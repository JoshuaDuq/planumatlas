import { tick } from 'svelte';
import { createLatestRunner } from '../../lib/core/async/latest.ts';
import type { createCatalog } from '../../lib/core/catalog/catalog.ts';
import type { ClinicalCatalog } from '../../lib/core/clinical/catalog.ts';
import type { ReaderState } from '../../lib/core/state/reader-state.ts';
import type { Excursions } from '../../lib/controller/excursion.svelte.ts';
import type { SessionStore } from '../../lib/state/session.svelte.ts';
import type { ViewStore } from '../../lib/state/view.svelte.ts';
import { FOCUS_TARGETS, focusHeading, requestFocus } from '../../lib/ui/focus.ts';
import { scrollToTop } from '../../lib/ui/scroll.ts';

/** What the Deficits panels reach outside the stores for; I1 composes them from the controller. */
export interface DeficitsDeps {
  clinical: ClinicalCatalog;
  anatomy: Pick<ReturnType<typeof createCatalog>, 'get'>;
  /** The language and the open deficit key a failure to the profile it happened in. */
  session: Pick<SessionStore, 'state' | 'setClinicalQuery'>;
  view: Pick<ViewStore, 'current'>;
  /** The S3 controller's members the tab calls (`createExcursions`). */
  excursions: Pick<
    Excursions,
    | 'openDeficit'
    | 'openDeficitMri'
    | 'pickPaint'
    | 'openListedRegion'
    | 'captureDeficitView'
    | 'restoreDeficitView'
    | 'resumeDeficit'
    | 'restoreBeforeExcursion'
    | 'restorable'
    | 'offerReload'
    | 'involved'
    | 'checkedMaps'
    | 'beneath'
    | 'showBeneathCortex'
  >;
  /** X1's entry point, which opens a function under its own runner. */
  openFunction: (id: string) => unknown;
  /** The clinical material kept in reach of the list; absent where it is not published. */
  clinicalLinks?: {
    /** Opens the stage's Lesion tool. */
    simulateLesion(): void;
  };
}

type Busy = 'loading' | 'restoring';
type Failure = 'restoreFailed';
type Operation = 'deficit' | 'region';

/**
 * The Deficits explorer's one runner (clinical.js:224-330), shared by the list, the profile, Restore
 * and the region inspector's related list. A later open overtakes an earlier one; only the latest
 * reports (`createLatestRunner`).
 */
export function createDeficitsExplorer(deps: DeficitsDeps) {
  const runner = createLatestRunner();
  /** The elements the controller moves focus to; the components bind them. */
  const refs: {
    heading: HTMLElement | null;
    scroller: HTMLElement | null;
    search: HTMLInputElement | null;
    list: HTMLElement | null;
  } = { heading: null, scroller: null, search: null, list: null };

  let opening = $state(false);
  let busy = $state<Busy>('loading');
  let failure = $state<Failure | null>(null);
  let operation = $state<Operation>('deficit');
  let regionReturn = $state.raw<{
    deficit: string;
    region: string;
    trigger: HTMLButtonElement;
    scene: ReaderState;
    scrollTop: number;
  } | null>(null);
  const canReturnToFinding = $derived(
    regionReturn !== null &&
      deps.view.current.explorer === 'deficits' &&
      deps.view.current.selectedDeficit === regionReturn.deficit &&
      deps.view.current.selectedRegion?.id === regionReturn.region,
  );
  // A failure belongs to the profile it happened in: another deficit or language clears it (clinical.js:521-525).
  let lastFailure = $state.raw<{ profile: string; error: unknown } | null>(null);
  const profileKey = () => `${deps.session.state.lang}|${deps.session.state.selectedDeficit}`;
  const actionError = $derived(lastFailure?.profile === profileKey() ? lastFailure.error : null);

  /**
   * Runs `action` as the one latest run. False when it failed, or reported that a later command
   * overtook it ("did not do what it says"), so the caller does not follow it with its hand-off.
   */
  async function run(
    action: () => Promise<unknown> | unknown,
    {
      busyText = 'loading',
      failureText = null,
      failed = 'deficit',
    }: { busyText?: Busy; failureText?: Failure | null; failed?: Operation } = {},
  ): Promise<boolean> {
    opening = true;
    busy = busyText;
    failure = failureText;
    operation = failed;
    lastFailure = null;
    const outcome = await runner.run(action, {
      onError(error) {
        lastFailure = { profile: profileKey(), error };
        deps.excursions.offerReload(error);
      },
      onSettled() {
        opening = false;
      },
    });
    return outcome.ok && outcome.value !== false;
  }

  /**
   * The panels' entry point (`openDeficit(id): unknown`, S3's `deps.panels`). The profile renders at
   * once and the brain is prepared behind it; once the profile for `id` is in the page it starts at
   * its top and its heading takes focus (deviation x2-focus-after-render).
   */
  async function openDeficit(id: string): Promise<void> {
    regionReturn = null;
    const running = run(() => deps.excursions.openDeficit(id));
    await tick();
    const { heading } = refs;
    if (heading?.dataset.deficit === id) {
      scrollToTop(heading);
      focusHeading(heading);
    }
    await running;
  }

  /** Open a mapped region at the top of the inspector and hold the profile's reading position. */
  async function openRegion(id: string, trigger: HTMLButtonElement): Promise<void> {
    if (opening) return;
    const deficit = deps.session.state.selectedDeficit;
    const scene = canReturnToFinding ? regionReturn!.scene : deps.excursions.captureDeficitView();
    const scrollTop = refs.scroller?.scrollTop ?? 0;
    if (!(await run(() => deps.excursions.openListedRegion(id), { failed: 'region' }))) return;
    const { selectedRegion, selectedDeficit, explorer } = deps.view.current;
    if (deficit && selectedRegion && selectedDeficit === deficit && explorer === 'deficits') {
      regionReturn = { deficit, region: selectedRegion.id, trigger, scene, scrollTop };
    }
    await tick();
    const focused = requestFocus(FOCUS_TARGETS.regionTitle, { preventScroll: true });
    if (canReturnToFinding && refs.scroller) {
      refs.scroller.scrollTop = 0;
    } else if (focused) {
      document.activeElement!.scrollIntoView({ block: 'start' });
    }
  }

  /** Restore the map behind the inspector, then focus the matching link in its original finding. */
  async function returnToFinding(): Promise<void> {
    if (!canReturnToFinding || opening) return;
    const { trigger, scene, scrollTop } = regionReturn!;
    if (
      !(await run(() => deps.excursions.restoreDeficitView(scene), {
        busyText: 'restoring',
        failureText: 'restoreFailed',
      }))
    ) {
      return;
    }
    regionReturn = null;
    await tick();
    if (trigger.isConnected) {
      if (refs.scroller) refs.scroller.scrollTop = scrollTop;
      trigger.focus({ preventScroll: true });
      trigger.scrollIntoView({ block: 'nearest' });
    }
  }

  /** The profile closes with the excursion it opened, so focus returns to its row in the list, or to the tab Restore returned to. */
  async function restore(deficit: string): Promise<void> {
    if (opening) return;
    if (
      !(await run(() => deps.excursions.restoreBeforeExcursion(), {
        busyText: 'restoring',
        failureText: 'restoreFailed',
      }))
    ) {
      return;
    }
    await tick();
    // Restore returned to another tab: focus goes to its region, else to that tab.
    if (deps.session.state.explorer !== 'deficits') {
      requestFocus(FOCUS_TARGETS.regionTitle, { fallback: FOCUS_TARGETS.activeTab });
      return;
    }
    const row = refs.list?.querySelector<HTMLElement>(
      `[data-deficit="${CSS.escape(deficit)}"] .row`,
    );
    (row ?? refs.search)?.focus();
  }

  return {
    refs,
    deps,
    get opening() {
      return opening;
    },
    get busy() {
      return busy;
    },
    get failure() {
      return failure;
    },
    get operation() {
      return operation;
    },
    get actionError() {
      return actionError;
    },
    /** Whether the scene from before this excursion's first deficit can be put back. */
    get restorable() {
      return deps.excursions.restorable;
    },
    involved: deps.excursions.involved,
    checkedMaps: deps.excursions.checkedMaps,
    setQuery: (query: string) => deps.session.setClinicalQuery(query),
    openFunction: deps.openFunction,
    clinicalLinks: deps.clinicalLinks ?? null,
    openDeficit,
    openRegion,
    resumeDeficit: deps.excursions.resumeDeficit,
    get canReturnToFinding() {
      return canReturnToFinding;
    },
    discardOldRegion() {
      if (regionReturn && !canReturnToFinding) regionReturn = null;
    },
    returnToFinding,
    /** The Linked MRI at the open deficit's first cited region, its paint over the scan; `instant` for a key press. */
    openMri(options: { instant: boolean }) {
      const { selectedDeficit, selectedFinding } = deps.session.state;
      if (!selectedDeficit) throw new Error('No deficit is open to show in the Linked MRI.');
      return deps.excursions.openDeficitMri(selectedDeficit, selectedFinding, options);
    },
    restore,
    focusSearch() {
      refs.search?.focus();
      refs.search?.select();
    },
  };
}

export type DeficitsExplorer = ReturnType<typeof createDeficitsExplorer>;
