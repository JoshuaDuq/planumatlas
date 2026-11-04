import type { Coordinate } from '../core/coordinates/parse.ts';
import type { Coordinates } from '../core/coordinates/spaces.ts';
import type { SceneCommands } from '../core/state/scene-commands.ts';
import type { Engine } from '../engine/api.ts';
import type { LesionStore } from '../state/lesion.svelte.ts';
import type { ViewName } from '../types/index.ts';

/**
 * Placing a published coordinate from the stage: carried onto this brain by its space's field, then
 * marked by the one sphere, with the cut and the camera brought to it and its report as Anatomy's detail.
 * The camera faces the cut the point now lies on, or with no cut, the side of the brain it lies in: the
 * marking is drawn through the brain, so seen from the other side it would sit on the wrong hemisphere.
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
    camera: Pick<Engine['camera'], 'focusPoint' | 'faceCut' | 'applyView'>;
  };
  commands: Pick<SceneCommands, 'begin'>;
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
    /** Place it unless it lies beyond its template's brain; false then. A later command takes over. */
    async place(entered: Coordinate, space: string): Promise<boolean> {
      const current = commands.begin();
      const landing = await coordinates.map(entered, space);
      if (landing && current()) {
        ui.showAnatomy();
        lesion.placeCoordinate({ entered, space }, landing, coordinates.metadata.radius_mm);
        const { centre, radius } = lesion.sphere!;
        engine.sections.setCrosshair(centre);
        if (engine.sections.active) {
          const faced = engine.camera.faceCut();
          if (faced) ui.showView(faced);
        } else if (Math.abs(centre[0]) >= radius) {
          const side = centre[0] > 0 ? 'right' : 'left';
          ui.showView(side);
          engine.camera.applyView(side);
        } else {
          engine.camera.focusPoint(centre);
        }
        ui.showDetail();
        if (lesion.replaced) ui.sayLesionReplaced();
      }
      return landing !== null;
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
