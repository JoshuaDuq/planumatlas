import { untrack } from 'svelte';
import { visibilityOf } from '../core/catalog/visibility.ts';
import { paintKind } from '../core/state/paint.ts';
import type { ModelState, Region } from '../types/index.ts';
import type { CortexHold } from './cortex-hold.svelte.ts';

const PAINT = 'paint';

/**
 * A function or deficit painting a structure the cortex covers holds the cortex see-through, so its
 * cortical and subcortical regions show at once; the hold goes with the paint or the structures.
 */
export function createPaintSeeThrough({
  view,
  regions,
  hold,
  seeThrough,
}: {
  view: { readonly current: ModelState };
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

  return {
    /** The reader's own cortex opacity while the paint holds it see-through, for a link to carry. */
    get heldOpacity(): number | null {
      return hold.owns(PAINT) ? hold.held : null;
    },
  };
}

export type PaintSeeThrough = ReturnType<typeof createPaintSeeThrough>;
