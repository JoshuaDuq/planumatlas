import { untrack } from 'svelte';
import type { FunctionalConnectivity } from '../core/catalog/functional-connectivity.ts';
import type { DisorderEffects } from '../core/catalog/disorder-effects.ts';
import type { NeuropsychDomains } from '../core/catalog/neuropsych-domains.ts';
import type { ClinicalCatalog } from '../core/clinical/catalog.ts';
import { isIndependentTractReference } from '../core/diffusion/presentation.ts';
import type { CircuitCatalog } from '../core/learning/catalog.ts';
import { paintFor } from '../core/state/paint.ts';
import type { LesionPaint } from '../core/state/paint.ts';
import type { Engine, EngineModel, EngineTracts, SectionsState } from '../engine/api.ts';
import type { ModelState } from '../types/index.ts';
import type { StrokeCasesStore } from './stroke-cases.svelte.ts';
import type { ViewStore } from './view.svelte.ts';

/**
 * The engine's display state, mirrored. Assigned synchronously in the `change` listener, as a copy:
 * `sections.state` is mutated in place, so the same object twice would not be a change.
 */
export function createEngineSync(engine: Pick<Engine, 'model' | 'sections' | 'on'>) {
  const modelSnapshot = (state: ModelState): ModelState => ({ ...state });
  const sectionsSnapshot = (state: SectionsState): SectionsState => ({
    ...state,
    crosshair: [...state.crosshair],
  });
  let model = $state.raw(modelSnapshot(engine.model.state));
  let sections = $state.raw(sectionsSnapshot(engine.sections.state));
  const stop = engine.on('change', (change) => {
    model = modelSnapshot(change.model);
    sections = sectionsSnapshot(change.sections);
  });
  return {
    get model() {
      return model;
    },
    get sections() {
      return sections;
    },
    dispose: stop,
  };
}

export type EngineSync = ReturnType<typeof createEngineSync>;

/**
 * Paints the model from the view, before the view's snapshot is read (app.js:1612). A changed paint
 * makes the model emit `change`, which updates the view and runs this again; it ends because
 * `setPaint` ignores a paint it already shows.
 */
export function syncPaint(
  model: Pick<EngineModel, 'setPaint'>,
  view: ViewStore,
  sources: {
    domains: NeuropsychDomains;
    clinical: ClinicalCatalog;
    lesion?: { readonly paint: LesionPaint | null };
    connectivity?: FunctionalConnectivity | null;
    disorders?: DisorderEffects | null;
    /** The reader's map, which a function is then painted against. */
    userMap?: { readonly drawn: boolean };
  },
) {
  $effect.pre(() =>
    model.setPaint(
      paintFor(view.current, {
        ...sources,
        lesion: sources.lesion?.paint ?? null,
        mapDrawn: sources.userMap?.drawn ?? false,
      }),
    ),
  );
}

/**
 * Pushes the view's look to the stage (app.js:1618-1630, 1638-1639): the language, whether the tract
 * reference is shown alone, and the atlas comparison's outline, which a cut or the reference hides.
 * Each effect reads primitives only, so a keystroke or a tab that changes none of them draws nothing.
 */
export function syncPresentation(
  engine: Pick<Engine, 'present' | 'comparison'>,
  view: ViewStore,
  engineState: EngineSync,
) {
  const lang = $derived(view.current.lang);
  const referenceOnly = $derived(isIndependentTractReference(view.current));
  const comparisonShown = $derived(engineState.sections.mode === 'off' && !referenceOnly);
  $effect(() => engine.present({ lang, referenceOnly }));
  $effect(() => engine.comparison.setVisible(comparisonShown));
}

/**
 * Draws the open lesson landmark's own tract while the Circuits tab shows it, and takes it away
 * however the lesson ends: a step without one, another tab, an excursion or a link. A failed
 * download is said once; coming back to the landmark tries again.
 */
export function syncLessonTract(
  tracts: Pick<EngineTracts, 'showLandmarkTract' | 'clearLandmarkTract'>,
  view: ViewStore,
  circuits: Pick<CircuitCatalog, 'get'>,
  fail: (error: unknown) => void,
) {
  let shown: string | null = null;
  $effect(() => {
    const { explorer, lesson } = view.current;
    const tract =
      // The whole route is no one landmark, so it draws none's tract.
      explorer === 'circuits' && lesson.circuit && !lesson.route
        ? (circuits.get(lesson.circuit).steps[lesson.step]!.tract ?? null)
        : null;
    if (tract === shown) return;
    shown = tract;
    untrack(() => {
      if (tract) tracts.showLandmarkTract(tract).catch(fail);
      else tracts.clearLandmarkTract();
    });
  });
}

/**
 * Stroke cases are picked in a region's sheet, which also clears them: once no region is selected the
 * sheet is gone, so the cases on the stage go with it rather than stay where nothing controls them.
 */
export function syncStrokeCases(
  view: ViewStore,
  cases: Pick<StrokeCasesStore, 'chosen' | 'clear'>,
) {
  const selected = $derived(view.current.selectedRegion !== null);
  $effect(() => {
    if (!selected && untrack(() => cases.chosen.length)) cases.clear();
  });
}
