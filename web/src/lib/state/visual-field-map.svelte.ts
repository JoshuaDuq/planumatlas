import { untrack } from 'svelte';
import type { EngineVisualField, VisualFieldDot, VisualFieldReading } from '../engine/api.ts';
import type { LessonStore } from './session.svelte.ts';
import type { ViewStore } from './view.svelte.ts';

/** Where the dot starts: up and to the right of fixation, inside the measured field. */
export const START_DOT: VisualFieldDot = { x: 2, y: 2, radius: 1 };

/** The cortex the reader last clicked on the open map, reactive; the dot itself is the lesson's. */
export function createVisualFieldMapStore(lesson: Pick<LessonStore, 'moveDot'>) {
  // Undefined until a click; null for a click that met no V1–V3.
  let reading = $state.raw<VisualFieldReading | null | undefined>(undefined);
  return {
    get reading() {
      return reading;
    },
    /** A click read the cortex: the dot becomes the predicted pRF there. */
    read(next: VisualFieldReading | null) {
      reading = next;
      if (next) lesson.moveDot({ x: next.x, y: next.y, radius: next.sigma });
    },
    /** A map opened afresh starts from nothing clicked. */
    forgetReading() {
      reading = undefined;
    },
  };
}

export type VisualFieldMapStore = ReturnType<typeof createVisualFieldMapStore>;

/** The stage draws the map, and a click reads the cortex, exactly while the map is open in front. */
export function syncVisualFieldMap(
  visualField: Pick<EngineVisualField, 'available' | 'show' | 'setProbing'>,
  view: Pick<ViewStore, 'current'>,
) {
  if (!visualField.available) return;
  let shown = false;
  $effect(() => {
    const { explorer, lesson } = view.current;
    const dot = explorer === 'circuits' && lesson.map === 'visual-field' ? lesson.dot! : null;
    untrack(() => {
      if (dot) {
        visualField.show({ dot });
      } else if (shown) {
        visualField.show(null);
      }
      if (Boolean(dot) !== shown) visualField.setProbing(Boolean(dot));
      shown = Boolean(dot);
    });
  });
}
