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
  const visualField = {
    available: true,
    show: (map: { dot: VisualFieldDot | null } | null) => calls.push(['show', map?.dot ?? null]),
    setProbing: (probing: boolean) => calls.push(['probing', probing]),
  };
  let current = $state({ explorer: 'anatomy', lesson: CLOSED });
  const view = {
    get current() {
      return current;
    },
  } as unknown as ViewStore;
  const stop = $effect.root(() => syncVisualFieldMap(visualField, view));
  flushSync();
  return {
    calls,
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
  map.read({ x: 4, y: -2, sigma: 0.8, area: 'V2', hemisphere: 'left' });
  map.read(null);
  expect(moved).toEqual([{ x: 4, y: -2, radius: 0.8 }]);
  expect(map.reading).toBeNull();
});
