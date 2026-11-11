import type { StrokeCases } from '../core/catalog/stroke-cases.ts';
import type { EngineStrokeCases } from '../engine/api.ts';
import type { SurfaceColor } from '../types/index.ts';
import type { CortexHold } from './cortex-hold.svelte.ts';

export type CohortState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; data: StrokeCases }
  | { status: 'error'; error: unknown };

/** The surface colour the stage shows lesions under: the tissue's own, so no atlas colour competes. */
const UNDER = 'tissue' satisfies SurfaceColor;
/** What the cases hold the cortex see-through under. */
const CASES = 'stroke-cases';

/**
 * The stroke cases on the stage: one person's lesion, or two compared. While any is shown the cortex
 * is see-through and tissue-coloured, as it was not before; clearing gives back whichever of the two
 * is still as the cases left it. A display changed meanwhile, by the reader or a reset, is theirs.
 */
export function createStrokeCasesStore({
  engine,
  display,
}: {
  engine: EngineStrokeCases;
  display: {
    /** The see-through cortex, held with whatever else is drawn inside it. */
    hold: CortexHold;
    readonly seeThrough: number;
    readonly color: SurfaceColor;
    setColor(color: SurfaceColor): void;
  };
}) {
  let cohort = $state.raw<CohortState>({ status: 'idle' });
  let chosen = $state.raw<readonly string[]>([]);
  let drawn = $state.raw<
    { status: 'idle' | 'drawing' | 'ready' } | { status: 'error'; error: unknown }
  >({ status: 'idle' });
  // The surface colour before the cases changed it; null when they left it alone.
  let heldColorState = $state<SurfaceColor | null>(null);
  // The selected region's cases were asked for from elsewhere (the Deficits list): the section opens them.
  let revealing = $state(false);
  let request = 0;

  // Held only while the display still shows what the cases set; anything else has taken it over.
  const heldOpacity = () => (display.hold.owns(CASES) ? display.hold.held : null);
  const heldColor = () =>
    heldColorState !== null && display.color === UNDER ? heldColorState : null;

  /** The cohort, downloaded once; a failure stays failed until the reader retries it. */
  function load(): void {
    if (!engine.available || cohort.status !== 'idle') return;
    fetchCohort();
  }

  function fetchCohort(): void {
    cohort = { status: 'loading' };
    engine.cases().then(
      (data) => (cohort = { status: 'ready', data }),
      (error: unknown) => {
        cohort = { status: 'error', error };
        console.error(error);
      },
    );
  }

  /** Taken when cases first appear; a display the reader changes while they are shown stays theirs. */
  function hold(): void {
    display.hold.acquire(CASES, display.seeThrough);
    heldColorState = display.color === UNDER ? null : display.color;
    if (heldColorState !== null) display.setColor(UNDER);
  }

  function release(): void {
    const color = heldColor();
    heldColorState = null;
    display.hold.release(CASES);
    if (color !== null) display.setColor(color);
  }

  function draw(ids: readonly string[]): void {
    const first = !chosen.length;
    chosen = ids;
    const ask = ++request;
    if (!ids.length) {
      drawn = { status: 'idle' };
      void engine.show([]);
      release();
      return;
    }
    if (first) hold();
    drawn = { status: 'drawing' };
    engine.show(ids).then(
      () => {
        if (ask === request) drawn = { status: 'ready' };
      },
      (error: unknown) => {
        if (ask !== request) return;
        console.error(error);
        chosen = [];
        release();
        drawn = { status: 'error', error };
      },
    );
  }

  return {
    get available() {
      return engine.available;
    },
    get cohort() {
      return cohort;
    },
    /** The cases on the stage, first and second. */
    get chosen() {
      return chosen;
    },
    get drawn() {
      return drawn;
    },
    /** What the cortex is given back on clearing, while the cases still hold it: its opacity and colour, or null. */
    get heldOpacity() {
      return heldOpacity();
    },
    get heldColor() {
      return heldColor();
    },
    load,
    /** Whether the section is asked to open on the selected region's cases, once they can be shown. */
    get revealing() {
      return revealing;
    },
    /** Ask the section to open; it says when it has, or a new selection withdraws the ask. */
    reveal(): void {
      revealing = true;
    },
    revealed(): void {
      revealing = false;
    },
    /** The reader's Retry after a failed download: the cohort asked for again. */
    retry(): void {
      if (cohort.status !== 'error') throw new Error('The cohort has not failed.');
      fetchCohort();
    },
    /** Whether every id names a case of the cohort; downloads the cohort if need be. */
    async known(ids: readonly string[]): Promise<boolean> {
      const data = await engine.cases();
      return ids.every((id) => data.cases.some((entry) => entry.id === id));
    },
    /** A case picked: the first becomes the one shown, the next is compared with it, a chosen one is let go. */
    toggle(id: string): void {
      if (chosen.includes(id)) draw(chosen.filter((other) => other !== id));
      else draw(chosen.length < 2 ? [...chosen, id] : [chosen[0]!, id]);
    },
    show: (ids: readonly string[]) => draw(ids.slice(0, 2)),
    clear: () => draw([]),
  };
}

export type StrokeCasesStore = ReturnType<typeof createStrokeCasesStore>;
