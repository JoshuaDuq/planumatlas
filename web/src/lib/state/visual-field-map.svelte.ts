import { untrack } from 'svelte';
import type {
  EngineVisualField,
  NamedVisualArea,
  VisualFieldDot,
  VisualFieldReading,
} from '../engine/api.ts';
import type { LessonStore } from './session.svelte.ts';
import type { View, ViewStore } from './view.svelte.ts';

/** Where the dot starts: up and to the right of fixation, inside the measured field. */
export const START_DOT: VisualFieldDot = { x: 2, y: 2, radius: 1 };

/** The map is drawn, its hemispheres paired, while its lesson is open in front on Circuits. */
export const visualFieldMapOpen = ({ explorer, lesson }: Pick<View, 'explorer' | 'lesson'>) =>
  explorer === 'circuits' && lesson.map === 'visual-field';

/**
 * The cortex the reader last clicked on the open map, and whether the visual areas are named, reactive;
 * the dot itself is the lesson's.
 */
export function createVisualFieldMapStore(lesson: Pick<LessonStore, 'moveDot'>) {
  // Undefined until a click; null for a click that met no V1–V3, or no named area.
  let reading = $state.raw<VisualFieldReading | null | undefined>(undefined);
  let area = $state.raw<NamedVisualArea | null | undefined>(undefined);
  let areasNamed = $state(false);
  let areasShown = $state(false);
  return {
    get reading() {
      return reading;
    },
    /** The named visual area last clicked. */
    get area() {
      return area;
    },
    /** The reader's switch: outline and name the visual areas on the map, kept as the map closes and opens. */
    get areasNamed() {
      return areasNamed;
    },
    nameAreas(on: boolean) {
      areasNamed = on;
    },
    /** The stage outlines the areas and can say where their names stand (`syncVisualFieldMap`). */
    get areasShown() {
      return areasShown;
    },
    setAreasShown(on: boolean) {
      areasShown = on;
    },
    /** A click read the cortex: the dot becomes the predicted pRF there, and the area there is named. */
    read(next: VisualFieldReading | null, named: NamedVisualArea | null) {
      reading = next;
      area = named;
      if (next) lesson.moveDot({ x: next.x, y: next.y, radius: next.sigma });
    },
    /** A map opened afresh starts from nothing clicked. */
    forgetReading() {
      reading = undefined;
      area = undefined;
    },
  };
}

export type VisualFieldMapStore = ReturnType<typeof createVisualFieldMapStore>;

const sameDot = (a: VisualFieldDot | null, b: VisualFieldDot | null) =>
  a === b || (a !== null && b !== null && a.x === b.x && a.y === b.y && a.radius === b.radius);

/**
 * The stage draws the map, and a click reads the cortex, exactly while the map is open in front; it
 * outlines the named areas while the reader's switch is on too, and says so once their anchors are read.
 */
export function syncVisualFieldMap(
  visualField: Pick<EngineVisualField, 'available' | 'show' | 'setProbing' | 'showAreas'>,
  view: Pick<ViewStore, 'current'>,
  map: Pick<VisualFieldMapStore, 'areasNamed' | 'setAreasShown'>,
) {
  if (!visualField.available) return;
  // The dot last drawn. Only a new dot is drawn: a redraw of the same one would turn the hemispheres
  // back into the map's pair after a lesson leaving the map has ended it (`lesson.ts`, endMapStage).
  let drawn: VisualFieldDot | null = null;
  $effect(() => {
    const dot = visualFieldMapOpen(view.current) ? view.current.lesson.dot! : null;
    untrack(() => {
      if (sameDot(dot, drawn)) return;
      visualField.show(dot && { dot });
      if (Boolean(dot) !== Boolean(drawn)) visualField.setProbing(Boolean(dot));
      drawn = dot;
    });
  });
  let outlined = false;
  $effect(() => {
    const on = visualFieldMapOpen(view.current) && map.areasNamed;
    untrack(() => {
      if (on === outlined) return;
      outlined = on;
      if (!on) map.setAreasShown(false);
      // A download overtaken by the switch turned back resolves after it, and shows nothing.
      visualField.showAreas(on).then(
        () => {
          if (outlined === on) map.setAreasShown(on);
        },
        (error: unknown) => console.error(error),
      );
    });
  });
}
