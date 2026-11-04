import { flushSync } from 'svelte';
import { expect, test, vi } from 'vitest';
import type { StrokeCases } from '../core/catalog/stroke-cases.ts';
import type { EngineStrokeCases } from '../engine/api.ts';
import type { SurfaceColor } from '../types/index.ts';
import { syncStrokeCases } from './engine-sync.svelte.ts';
import { createCortexHold } from './cortex-hold.svelte.ts';
import { createStrokeCasesStore } from './stroke-cases.svelte.ts';
import type { ViewStore } from './view.svelte.ts';

function setup({ opacity = 1, color = 'atlas' as SurfaceColor } = {}) {
  const engine: EngineStrokeCases = {
    available: true,
    cases: vi.fn(async () => ({ cases: [{ id: 'a' }, { id: 'b' }] }) as unknown as StrokeCases),
    show: vi.fn(async () => {}),
  };
  const display = {
    opacity,
    color,
    setOpacity(value: number) {
      display.opacity = value;
    },
    setColor(value: SurfaceColor) {
      display.color = value;
    },
  };
  const hold = createCortexHold(display);
  const store = createStrokeCasesStore({
    engine,
    display: {
      hold,
      seeThrough: 0.3,
      get color() {
        return display.color;
      },
      setColor: display.setColor,
    },
  });
  return { store, display, engine, hold };
}

const settle = () => new Promise((resolve) => setTimeout(resolve));

test('picks fill the first case, then the second, and a third replaces the second', () => {
  const { store } = setup();
  store.toggle('a');
  expect(store.chosen).toEqual(['a']);
  store.toggle('b');
  expect(store.chosen).toEqual(['a', 'b']);
  store.toggle('c');
  expect(store.chosen).toEqual(['a', 'c']);
  store.toggle('a');
  expect(store.chosen).toEqual(['c']);
});

test('cases make an opaque atlas-coloured cortex see-through tissue, and clearing gives both back', () => {
  const { store, display } = setup();
  store.toggle('a');
  expect([display.opacity, display.color]).toEqual([0.3, 'tissue']);
  expect([store.heldOpacity, store.heldColor]).toEqual([1, 'atlas']);
  store.toggle('b');
  store.clear();
  expect([display.opacity, display.color]).toEqual([1, 'atlas']);
});

test('a display changed while cases are shown is kept, not held or given back', () => {
  const { store, display } = setup();
  store.toggle('a');
  display.setOpacity(0.6);
  display.setColor('mri');
  // The link writes what is on screen, not what the cases took over.
  expect([store.heldOpacity, store.heldColor]).toEqual([null, null]);
  store.toggle('b');
  expect([display.opacity, display.color]).toEqual([0.6, 'mri']);
  store.clear();
  expect([display.opacity, display.color]).toEqual([0.6, 'mri']);
});

test('a cortex already see-through or tissue-coloured is left as it is', () => {
  const { store, display } = setup({ opacity: 0.5, color: 'tissue' });
  store.toggle('a');
  store.clear();
  expect([display.opacity, display.color]).toEqual([0.5, 'tissue']);
});

test('a tract and the cases share the see-through cortex, which only the last to go gives back', () => {
  // Tract first, then a case: clearing the tract leaves the case see-through.
  const first = setup();
  first.hold.acquire('lesion-tract', 0.16);
  first.store.toggle('a');
  first.hold.release('lesion-tract');
  expect(first.display.opacity).toBe(0.16);
  first.store.clear();
  expect(first.display.opacity).toBe(1);
  // A case first, then a tract: clearing the case leaves the tract see-through, and nothing stays so.
  const second = setup();
  second.store.toggle('a');
  second.hold.acquire('lesion-tract', 0.16);
  second.store.clear();
  expect(second.display.opacity).toBe(0.3);
  second.hold.release('lesion-tract');
  expect(second.display.opacity).toBe(1);
});

test('a draw that fails lets the cases and the display go', async () => {
  const { store, display, engine } = setup();
  vi.mocked(engine.show).mockRejectedValueOnce(new Error('no masks'));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  store.toggle('a');
  await settle();
  expect(store.drawn.status).toBe('error');
  expect(store.chosen).toEqual([]);
  expect([display.opacity, display.color]).toEqual([1, 'atlas']);
});

test('a draw the reader has moved past cannot report its failure', async () => {
  const { store, engine } = setup();
  let failFirst!: (error: Error) => void;
  vi.mocked(engine.show).mockImplementationOnce(
    () => new Promise<void>((_, reject) => (failFirst = reject)),
  );
  store.toggle('a');
  store.toggle('b');
  await settle();
  failFirst(new Error('overtaken'));
  await settle();
  expect(store.drawn.status).toBe('ready');
  expect(store.chosen).toEqual(['a', 'b']);
});

test('a cohort that fails to load is not fetched again', async () => {
  const { store, engine } = setup();
  vi.mocked(engine.cases).mockRejectedValueOnce(new Error('offline'));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  store.load();
  await settle();
  store.load();
  expect(store.cohort.status).toBe('error');
  expect(engine.cases).toHaveBeenCalledOnce();
});

test('ids are known only if the cohort holds every one', async () => {
  const { store } = setup();
  expect(await store.known(['a', 'b'])).toBe(true);
  expect(await store.known(['a', 'z'])).toBe(false);
});

test('cases go when the region whose sheet picked them is deselected, and stay as it changes', () => {
  const cases = { chosen: ['a'] as readonly string[], clear: vi.fn() };
  let selectedRegion = $state<{ id: string } | null>({ id: 'destrieux:left:12' });
  const view = {
    get current() {
      return { selectedRegion };
    },
  } as unknown as ViewStore;
  const stop = $effect.root(() => syncStrokeCases(view, cases));
  flushSync();
  selectedRegion = { id: 'destrieux:left:14' };
  flushSync();
  expect(cases.clear).not.toHaveBeenCalled();
  selectedRegion = null;
  flushSync();
  expect(cases.clear).toHaveBeenCalledOnce();
  stop();
});
