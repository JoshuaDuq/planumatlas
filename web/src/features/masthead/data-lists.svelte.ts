import type DataLists from './DataLists.svelte';

// The data popover's lists are a chunk of their own (BUILD-15): fetched on the first intent, and kept
// for every bar after.
let component = $state<typeof DataLists | null>(null);
let loading: Promise<void> | null = null;

export const dataLists = {
  get component() {
    return component;
  },
};

export function loadLists(): Promise<void> {
  loading ??= import('./DataLists.svelte').then((module) => {
    component = module.default;
  });
  return loading;
}
