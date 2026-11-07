// The visual-field map's state and commands for the Circuits tab: opening it, the dot the reader
// moves, the territory it covers and the cortex last clicked. `VisualFieldMap` draws it.
import { hemisphereFor, territoryOf } from '../../lib/core/learning/visual-field.ts';
import type {
  FieldHemisphere,
  VisualFieldTerritories,
} from '../../lib/core/learning/visual-field.ts';
import type { EngineVisualField, VisualFieldDot } from '../../lib/engine/api.ts';
import type { Excursions } from '../../lib/controller/excursion.svelte.ts';
import type { VisualFieldMapStore } from '../../lib/state/visual-field-map.svelte.ts';
import type { LessonStore } from '../../lib/state/session.svelte.ts';
import type { ViewStore } from '../../lib/state/view.svelte.ts';
import { START_DOT } from '../../lib/state/visual-field-map.svelte.ts';
import type { Translated } from '../../lib/core/clinical/types.ts';
import type { Retinotopy } from '../../lib/types/manifest.ts';

export interface VisualFieldExplorerDeps {
  view: Pick<ViewStore, 'current'>;
  excursions: Pick<Excursions, 'openMap' | 'showMapSide'>;
  lesson: Pick<LessonStore, 'moveDot'>;
  store: VisualFieldMapStore;
  visualField: Pick<EngineVisualField, 'territories'>;
  /** The manifest's record, or null on an anatomy that publishes no retinotopy. */
  retinotopy: Retinotopy | null;
  /** The guided circuits with a landmark that offers this map, and how to open one. */
  tours: readonly { id: string; name: Translated }[];
  openTour: (id: string) => unknown;
}

export function createVisualFieldExplorer(deps: VisualFieldExplorerDeps) {
  const { view, excursions, lesson, store, visualField, retinotopy, tours, openTour } = deps;
  let territories = $state.raw<VisualFieldTerritories | null>(null);
  let failed = $state(false);
  // The last dot shown, which the map opens on again.
  let lastDot = START_DOT;

  const open = $derived(
    view.current.explorer === 'circuits' && view.current.lesson.map === 'visual-field',
  );
  const dot = $derived(view.current.lesson.dot ?? lastDot);
  // The hemisphere the stage shows; a link may have opened the map on either.
  const side = $derived<FieldHemisphere>(view.current.hemisphere === 'right' ? 'right' : 'left');
  const territory = $derived(territories && territoryOf(territories, dot));

  /** Downloads the territories on the map's first showing. */
  async function loadTerritories() {
    if (territories) return;
    failed = false;
    try {
      territories = await visualField.territories();
    } catch (error) {
      failed = true;
      throw error;
    }
  }

  return {
    /** The anatomy publishes predicted retinotopy, so the map is offered. */
    available: retinotopy !== null,
    tours,
    openTour,
    get lang() {
      return view.current.lang;
    },
    get open() {
      return open;
    },
    get retinotopy() {
      return retinotopy!;
    },
    get dot() {
      return dot;
    },
    get reading() {
      return store.reading;
    },
    get side() {
      return side;
    },
    /** mm² per hemisphere and area under the dot; null until the territories have loaded. */
    get territory() {
      return territory;
    },
    get failed() {
      return failed;
    },

    loadTerritories,

    async openMap() {
      store.forgetReading();
      await excursions.openMap(dot);
    },

    /**
     * Both hemispheres are drawn, so the other one covers the map's medial cortex: Start over or
     * Display's Both left the map's view, which `returnToMap` puts back.
     */
    get hidden() {
      return open && view.current.hemisphere === 'both';
    },

    returnToMap() {
      return excursions.showMapSide(hemisphereFor(dot) ?? 'left');
    },

    /** The dot moves; crossing the vertical meridian turns the stage to the other hemisphere. */
    moveDot(next: VisualFieldDot) {
      lesson.moveDot(next);
      lastDot = next;
      const wanted = hemisphereFor(next);
      if (wanted && wanted !== side) void excursions.showMapSide(wanted);
    },
  };
}

export type VisualFieldExplorer = ReturnType<typeof createVisualFieldExplorer>;
