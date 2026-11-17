import { flushSync } from 'svelte';
import { expect, test } from 'vitest';
import type { CircuitSessionState } from '../core/learning/session.ts';
import type { VisualFieldDot } from '../engine/api.ts';
import type { ViewStore } from './view.svelte.ts';
import { createVisualFieldMapStore, syncVisualFieldMap } from './visual-field-map.svelte.ts';

const CLOSED: CircuitSessionState = { circuit: null, step: 0, visited: [], route: false };
const dot = { x: 2, y: 1, radius: 1 };

function fixture() {
  const calls: unknown[][] = [];
  // Each `showAreas` call's download, which the test lets finish; awaiting it in a test runs after the
  // sync's own handler, which was attached first.
  const downloads: { resolve: () => void; promise: Promise<void> }[] = [];
  const visualField = {
    available: true,
    show: (map: { dot: VisualFieldDot | null } | null) => calls.push(['show', map?.dot ?? null]),
    setProbing: (probing: boolean) => calls.push(['probing', probing]),
    showAreas: (on: boolean) => {
      calls.push(['showAreas', on]);
      let resolve!: () => void;
      const promise = new Promise<void>((done) => (resolve = done));
      downloads.push({ resolve, promise });
      return promise;
    },
  };
  let current = $state({ explorer: 'anatomy', lesson: CLOSED });
  const view = {
    get current() {
      return current;
    },
  } as unknown as ViewStore;
  const map = createVisualFieldMapStore({ moveDot: () => undefined });
  const stop = $effect.root(() => syncVisualFieldMap(visualField, view, map));
  flushSync();
  return {
    calls,
    downloads,
    map,
    stop,
    set(explorer: string, lesson: CircuitSessionState) {
      current = { explorer, lesson };
      flushSync();
    },
  };
}

test('the stage draws the map and reads clicks exactly while the map is open in the Circuits tab', () => {
  const { calls, set, stop } = fixture();
  expect(calls).toEqual([]);
  set('circuits', { ...CLOSED, map: 'visual-field', dot });
  expect(calls).toEqual([
    ['show', dot],
    ['probing', true],
  ]);
  set('circuits', { ...CLOSED, map: 'visual-field', dot: { x: -3, y: 1, radius: 2 } });
  expect(calls.at(-1)).toEqual(['show', { x: -3, y: 1, radius: 2 }]);
  set('anatomy', { ...CLOSED, map: 'visual-field', dot });
  expect(calls.slice(-2)).toEqual([
    ['show', null],
    ['probing', false],
  ]);
  stop();
});

test('another change of the view redraws nothing while the dot stays where it is', () => {
  const { calls, set, stop } = fixture();
  set('circuits', { ...CLOSED, map: 'visual-field', dot });
  const drawn = calls.length;
  // A new view state with the same dot, as a display change while the map is open makes.
  set('circuits', { ...CLOSED, map: 'visual-field', dot: { ...dot } });
  expect(calls.length).toBe(drawn);
  stop();
});

test('a click on V1–V3 makes the dot the predicted receptive field there; a miss leaves it', () => {
  const moved: VisualFieldDot[] = [];
  const map = createVisualFieldMapStore({ moveDot: (next) => moved.push(next) });
  map.read(
    { x: 4, y: -2, sigma: 0.8, area: 'V2', hemisphere: 'left' },
    { name: 'V2v', hemisphere: 'left' },
  );
  expect(map.area).toEqual({ name: 'V2v', hemisphere: 'left' });
  map.read(null, { name: 'LO1', hemisphere: 'left' });
  expect(moved).toEqual([{ x: 4, y: -2, radius: 0.8 }]);
  expect(map.reading).toBeNull();
  // Beyond V3 the reading is the area's name alone.
  expect(map.area).toEqual({ name: 'LO1', hemisphere: 'left' });
  map.forgetReading();
  expect(map.area).toBeUndefined();
});

test('the areas are outlined while the map is open with the switch on, and named once their anchors are in', async () => {
  const { calls, downloads, map, set, stop } = fixture();
  map.nameAreas(true);
  flushSync();
  expect(calls).toEqual([]);
  set('circuits', { ...CLOSED, map: 'visual-field', dot });
  expect(calls.at(-1)).toEqual(['showAreas', true]);
  expect(map.areasShown).toBe(false);
  downloads.at(-1)!.resolve();
  await downloads.at(-1)!.promise;
  expect(map.areasShown).toBe(true);
  set('anatomy', { ...CLOSED, map: 'visual-field', dot });
  expect(calls.at(-1)).toEqual(['showAreas', false]);
  expect(map.areasShown).toBe(false);
  stop();
});

test('a switch turned back off before the anchors arrive leaves the areas unnamed', async () => {
  const { downloads, map, set, stop } = fixture();
  set('circuits', { ...CLOSED, map: 'visual-field', dot });
  map.nameAreas(true);
  flushSync();
  map.nameAreas(false);
  flushSync();
  // The turn-off's own call settles first, then the overtaken download.
  downloads[1]!.resolve();
  await downloads[1]!.promise;
  downloads[0]!.resolve();
  await downloads[0]!.promise;
  expect(map.areasShown).toBe(false);
  stop();
});

test('the visual areas start unnamed, and the reader’s switch outlasts the map closing and opening', () => {
  const map = createVisualFieldMapStore({ moveDot: () => undefined });
  expect(map.areasNamed).toBe(false);
  map.nameAreas(true);
  // The map opened afresh forgets the click, not the switch.
  map.forgetReading();
  expect(map.areasNamed).toBe(true);
  map.nameAreas(false);
  expect(map.areasNamed).toBe(false);
});
