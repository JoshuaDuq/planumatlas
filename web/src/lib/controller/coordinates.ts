import type { Coordinate } from '../core/coordinates/parse.ts';
import type { Coordinates } from '../core/coordinates/spaces.ts';
import type { SceneCommands } from '../core/state/scene-commands.ts';
import type { Engine } from '../engine/api.ts';
import type { LesionStore } from '../state/lesion.svelte.ts';
import type { ViewName } from '../types/index.ts';

/**
 * Placing a published coordinate from the stage: carried onto this brain by its space's field, then
 * marked by the one sphere, with its report as Anatomy's detail and a cut through it, faced: most
 * landings lie in sulci, the insula, the medial wall or beneath the cortex, which the outside does not
 * show. The reader's own cut moves to it, or a coronal one opens.
 */
export function createCoordinatePlacement({
  coordinates,
  lesion,
  engine,
  commands,
  ui,
}: {
  coordinates: Pick<Coordinates, 'metadata' | 'map'>;
  lesion: Pick<LesionStore, 'placeCoordinate' | 'sphere' | 'replaced' | 'restoreReplaced'>;
  engine: {
    sections: Pick<Engine['sections'], 'setCrosshair' | 'active'>;
    camera: Pick<Engine['camera'], 'faceCut'>;
  };
  commands: Pick<SceneCommands, 'begin' | 'cut' | 'failIfCurrent'>;
  ui: {
    showAnatomy(): void;
    showDetail(): void;
    /** The named view the camera now holds. */
    showView(view: ViewName): void;
    /** The one sphere held a lesion the reader placed, which the coordinate has taken; offers its undo. */
    sayLesionReplaced(): void;
    sayLesionRestored(): void;
  };
}) {
  return {
    metadata: coordinates.metadata,
    /**
     * Place it unless it lies beyond its template's brain; false then. A later command takes over.
     * A cut that fails to open is said as the section's failure: the coordinate is placed all the same.
     */
    async place(entered: Coordinate, space: string): Promise<boolean> {
      const current = commands.begin();
      const landing = await coordinates.map(entered, space);
      if (!landing || !current()) return landing !== null;
      ui.showAnatomy();
      lesion.placeCoordinate({ entered, space }, landing, coordinates.metadata.radius_mm);
      engine.sections.setCrosshair(lesion.sphere!.centre);
      ui.showDetail();
      if (lesion.replaced) ui.sayLesionReplaced();
      try {
        if (!engine.sections.active && !(await commands.cut('coronal', current))) return true;
      } catch (error) {
        commands.failIfCurrent(current, 'section', error);
        return true;
      }
      const faced = engine.camera.faceCut();
      if (faced) ui.showView(faced);
      return true;
    },
    /** The replacement's undo: the lesion back as it was, and the coordinate gone. A later command takes over. */
    undoReplacement(): void {
      commands.begin();
      lesion.restoreReplaced();
      ui.sayLesionRestored();
    },
  };
}

export type CoordinatePlacement = ReturnType<typeof createCoordinatePlacement>;
