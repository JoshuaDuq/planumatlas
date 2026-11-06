import { untrack } from 'svelte';
import { visibilityOf } from '../core/catalog/visibility.ts';
import { paintKind } from '../core/state/paint.ts';
import type { EngineModel } from '../engine/api.ts';
import type { ModelState, Region } from '../types/index.ts';
import type { CortexHold } from './cortex-hold.svelte.ts';

const PAINT = 'paint';

/**
 * A function or deficit painting a structure the cortex covers holds the cortex see-through, so its
 * cortical and subcortical regions show at once; the hold goes with the paint or the structures.
 * What the paint leaves unpainted is a grey ghost, as under Focus: beige tissue would tint the
 * paint seen through it, and blended folds pile into a fog.
 */
export function createPaintSeeThrough({
  view,
  model,
  regions,
  hold,
  seeThrough,
}: {
  view: { readonly current: ModelState };
  model: Pick<EngineModel, 'ghostAround' | 'settings'>;
  regions: ReadonlyMap<string, Region>;
  hold: CortexHold;
  seeThrough: number;
}) {
  const wanted = $derived.by(() => {
    const state = view.current;
    if (!state.cortexVisible || !['function', 'deficit'].includes(paintKind(state.paint)!)) {
      return false;
    }
    return [...state.paint!.colors.keys()].some((id) => {
      const region = regions.get(id);
      return region?.kind === 'structure' && visibilityOf(region, state).visible;
    });
  });
  $effect.pre(() => {
    if (wanted) untrack(() => hold.acquire(PAINT, seeThrough));
    else untrack(() => hold.release(PAINT));
  });
  // The ghost the paint set, so ending it never ends one a route or Tracts has set since.
  let ghost: ReadonlySet<string> | null = null;
  $effect.pre(() => {
    const on = wanted;
    // Read so a reset that ends the ghost under a standing paint brings it back.
    const unghosted = view.current.ghostedAround === null;
    untrack(() => {
      if (on && unghosted) {
        // Painted regions never ghost, so nothing needs naming.
        model.ghostAround([]);
        ghost = model.settings.ghostedAround;
      } else if (!on && ghost) {
        if (model.settings.ghostedAround === ghost) model.ghostAround(null);
        ghost = null;
      }
    });
  });

  return {
    /** The reader's own cortex opacity while the paint holds it see-through, for a link to carry. */
    get heldOpacity(): number | null {
      return hold.owns(PAINT) ? hold.held : null;
    },
  };
}

export type PaintSeeThrough = ReturnType<typeof createPaintSeeThrough>;
