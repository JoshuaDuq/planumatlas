import type BodyMap from './BodyMap.svelte';

// The panel is a chunk of its own (BUILD-15): fetched when the map first opens, and kept after.
let component = $state<typeof BodyMap | null>(null);
let loading: Promise<void> | null = null;

export const bodyMapPanel = {
  get component() {
    return component;
  },
};

export function loadBodyMapPanel(): Promise<void> {
  loading ??= import('./BodyMap.svelte')
    .then((module) => {
      component = module.default;
    })
    .catch((error: unknown) => {
      loading = null;
      throw error;
    });
  return loading;
}
