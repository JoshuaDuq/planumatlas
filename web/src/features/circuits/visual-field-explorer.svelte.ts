// The visual-field map's state and commands for the Circuits tab: opening it, the dot the reader
// moves, the territory it covers and the cortex last clicked. `VisualFieldMap` draws it.
import { tick } from 'svelte';
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
import { scrollToTop } from '../../lib/ui/scroll.ts';
import type { Retinotopy } from '../../lib/types/manifest.ts';

export interface VisualFieldExplorerDeps {
  view: Pick<ViewStore, 'current'>;
  excursions: Pick<Excursions, 'openMap' | 'showMapScene'>;
  lesson: Pick<LessonStore, 'moveDot'>;
  store: VisualFieldMapStore;
  visualField: Pick<EngineVisualField, 'territories' | 'follow'>;
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
  let title: HTMLElement | null = null;

  const open = $derived(
    view.current.explorer === 'circuits' && view.current.lesson.map === 'visual-field',
  );
  const dot = $derived(view.current.lesson.dot ?? lastDot);
  // The hemisphere that represents the dot; on the vertical meridian, the left.
  const side = $derived<FieldHemisphere>(hemisphereFor(dot) ?? 'left');
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

    /**
     * Opens the map at its top, its title taking focus, as a lesson's does (`settle`): the detail may
     * have been scrolled by another tab's profile, and the list's handoff would leave focus on Back.
     */
    async openMap() {
      store.forgetReading();
      await excursions.openMap(dot);
      await tick();
      // A newer scene command overtook the opening: no map, nothing to focus.
      if (!open) return;
      if (!title) throw new Error('The visual field map is not mounted.');
      scrollToTop(title);
      title.focus({ preventScroll: true });
    },

    attachTitle(element: HTMLElement) {
      title = element;
      return () => {
        if (title === element) title = null;
      };
    },

    /** Display hid a hemisphere, so half the map is gone: `returnToMap` puts both back. */
    get hidden() {
      return open && view.current.hemisphere !== 'both';
    },

    returnToMap() {
      return excursions.showMapScene();
    },

    /** The dot moves, and the stage pans onto the cortex it drives once that leaves the middle. */
    moveDot(next: VisualFieldDot) {
      lesson.moveDot(next);
      lastDot = next;
      visualField.follow(next);
    },
  };
}

export type VisualFieldExplorer = ReturnType<typeof createVisualFieldExplorer>;
