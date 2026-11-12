import type { MapOverlapFacts } from '../../lib/state/map-overlap.svelte.ts';

/** What the profile is told of a reader's map, settable by a test and read reactively, as the store's is. */
export function createOverlapHolder() {
  let current = $state.raw<MapOverlapFacts | null>(null);
  return {
    get current() {
      return current;
    },
    set current(next: MapOverlapFacts | null) {
      current = next;
    },
  };
}
