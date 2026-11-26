import type CircuitDiagram from './CircuitDiagram.svelte';

// The diagram is a chunk of its own (BUILD-15): fetched when a circuit that has one first opens, and
// kept for every lesson after, so notes mounted again draw it at once.
let component = $state<typeof CircuitDiagram | null>(null);
let loading: Promise<void> | null = null;

export const circuitDiagram = {
  get component() {
    return component;
  },
};

export function loadCircuitDiagram(): Promise<void> {
  loading ??= import('./CircuitDiagram.svelte').then((module) => {
    component = module.default;
  });
  return loading;
}
