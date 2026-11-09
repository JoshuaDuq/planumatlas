import { flushSync } from 'svelte';
import { expect, test } from 'vitest';
import type { ModelState, Paint, Region } from '../types/index.ts';
import { createCortexHold } from './cortex-hold.svelte.ts';
import { createPaintSeeThrough } from './paint-see-through.svelte.ts';

const regions = new Map<string, Region>([
  ['ctx', { id: 'ctx', label: 'ctx', hemisphere: 'left', kind: 'cortex', atlas: 'dk' }],
  ['put', { id: 'put', label: 'put', hemisphere: 'left', kind: 'structure', atlas: 'aseg' }],
]);
const paint = (kind: string, ...ids: string[]): Paint => ({
  id: `${kind}:x`,
  colors: new Map(ids.map((id) => [id, [255, 0, 0] as const])),
});

function setup(opacity = 1) {
  const state = $state({
    atlas: 'dk',
    detail: 'aseg',
    internalSystem: null,
    internalConstituents: new Set<string>(),
    cutAtlas: null,
    cutActive: false,
    hemisphere: 'both',
    cortexVisible: true,
    cortexOpacity: opacity,
    exploded: false,
    internalVisible: true,
    spinalCordVisible: true,
    surfaceColor: 'atlas',
    paint: null as Paint | null,
    isolatedRegion: null,
    focused: false,
    ghostedAround: null,
    hiddenRegions: new Set<string>(),
    dissectionCanUndo: false,
    selectedRegion: null,
    visibleMeshCount: 0,
  } as ModelState);
  const hold = createCortexHold({
    get opacity() {
      return state.cortexOpacity;
    },
    setOpacity: (value) => (state.cortexOpacity = value),
  });
  const model = {
    get settings() {
      return state;
    },
    ghostAround: (ids: readonly string[] | null) => {
      state.ghostedAround = ids && new Set(ids);
    },
  };
  let store!: ReturnType<typeof createPaintSeeThrough>;
  const stop = $effect.root(() => {
    store = createPaintSeeThrough({
      view: { current: state },
      model,
      regions,
      hold,
      seeThrough: 0.3,
    });
  });
  flushSync();
  const set = (change: Partial<ModelState>) => {
    Object.assign(state, change);
    flushSync();
  };
  return { state, store, model, hold, set, stop };
}

test('a function or deficit painting a structure sees through the cortex until the paint goes', () => {
  for (const kind of ['function', 'deficit']) {
    const { state, store, set, stop } = setup();
    set({ paint: paint(kind, 'ctx', 'put') });
    expect([state.cortexOpacity, store.heldOpacity]).toEqual([0.3, 1]);
    set({ paint: null });
    expect([state.cortexOpacity, store.heldOpacity]).toEqual([1, null]);
    stop();
  }
});

test('a cortex-only paint, a lesion paint or a hidden structure keeps the cortex opaque', () => {
  const { state, set, stop } = setup();
  set({ paint: paint('function', 'ctx') });
  expect(state.cortexOpacity).toBe(1);
  set({ paint: paint('lesion', 'put') });
  expect(state.cortexOpacity).toBe(1);
  set({ paint: paint('deficit', 'put'), internalVisible: false });
  expect(state.cortexOpacity).toBe(1);
  // Showing the structures again sees through.
  set({ internalVisible: true });
  expect(state.cortexOpacity).toBe(0.3);
  stop();
});

test("the reader's own opacity is kept, not held or given back", () => {
  const { state, store, set, stop } = setup();
  set({ paint: paint('function', 'put') });
  set({ cortexOpacity: 0.6 });
  expect(store.heldOpacity).toBeNull();
  set({ paint: null });
  expect(state.cortexOpacity).toBe(0.6);
  stop();
});

test('a cortex already see-through is left as it is', () => {
  const { state, store, set, stop } = setup(0.5);
  set({ paint: paint('deficit', 'put') });
  expect([state.cortexOpacity, store.heldOpacity]).toEqual([0.5, null]);
  set({ paint: null });
  expect(state.cortexOpacity).toBe(0.5);
  stop();
});

test('what the paint leaves unpainted is a grey ghost while it sees through', () => {
  const { state, set, stop } = setup();
  set({ paint: paint('function', 'ctx', 'put') });
  expect(state.ghostedAround).toEqual(new Set());
  set({ paint: paint('function', 'ctx') });
  expect(state.ghostedAround).toBeNull();
  stop();
});

test('a ghost set since the paint is left to its owner, and a reset under the paint ghosts again', () => {
  const { state, model, set, stop } = setup();
  set({ paint: paint('deficit', 'put') });
  // Tracts greys around nothing too, under its own set.
  model.ghostAround([]);
  const tracts = state.ghostedAround;
  set({ paint: null });
  expect(state.ghostedAround).toBe(tracts);
  set({ ghostedAround: null, paint: paint('deficit', 'put') });
  set({ ghostedAround: null });
  expect(state.ghostedAround).toEqual(new Set());
  stop();
});
