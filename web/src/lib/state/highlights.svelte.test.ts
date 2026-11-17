import { expect, test, vi } from 'vitest';
import { VIEW_NAMES } from '../types/constants.ts';
import { createHighlights, showOverLift } from './highlights.svelte.ts';
import type { HighlightStatus } from './highlights.svelte.ts';
import type { LesionMode } from './lesion.svelte.ts';
import { createSessionStore } from './session.svelte.ts';

function setup(initial: HighlightStatus = 'drawn') {
  const status = $state({ current: initial });
  const showPaint = vi.fn();
  const store = createHighlights({ status: () => status.current, showPaint });
  return { store, status, showPaint };
}

test('STORE-37 a new region takes the colour the fewest hold, the first on a tie; a second press takes it away', () => {
  const { store } = setup();
  for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) expect(store.toggle(id)).toBe(true);
  expect(store.list.map(({ color }) => color)).toEqual([
    'blue',
    'raspberry',
    'green',
    'amber',
    'violet',
    'pink',
    'blue',
  ]);
  store.remove('b');
  store.toggle('h');
  expect(store.list.at(-1)).toEqual({ region: 'h', color: 'raspberry' });
  expect(store.toggle('h')).toBe(false);
  expect(store.has('h')).toBe(false);
  store.recolor('a', 'pink');
  expect(store.list[0]).toEqual({ region: 'a', color: 'pink' });
});

test('STORE-37 twelve at most: a thirteenth throws and changes nothing, and one can still be taken out', () => {
  const { store } = setup();
  const ids = Array.from({ length: 12 }, (_, index) => `r${index}`);
  for (const id of ids) store.toggle(id);
  expect(store.full).toBe(true);
  expect(() => store.toggle('r12')).toThrow(RangeError);
  expect(store.list.map(({ region }) => region)).toEqual(ids);
  expect(store.toggle('r3')).toBe(false);
  expect(store.full).toBe(false);
});

test('STORE-37 adding or recolouring draws again highlights a masthead choice lifted, and nothing else', () => {
  const { store, status, showPaint } = setup('lifted');
  store.toggle('a');
  expect(showPaint).toHaveBeenCalledOnce();
  status.current = 'aside';
  store.recolor('a', 'green');
  store.toggle('b');
  expect(() => store.show()).toThrow('not lifted');
  status.current = 'drawn';
  store.toggle('c');
  store.remove('c');
  expect(showPaint).toHaveBeenCalledOnce();
  status.current = 'lifted';
  store.remove('b');
  expect(showPaint).toHaveBeenCalledOnce();
  store.show();
  expect(showPaint).toHaveBeenCalledTimes(2);
});

test('STORE-37 a link replaces the set in its order; a repeat, a thirteenth or an unknown region throws', () => {
  const { store } = setup();
  store.toggle('x');
  store.replace([
    { region: 'b', color: 'amber' },
    { region: 'a', color: 'blue' },
  ]);
  expect(store.list).toEqual([
    { region: 'b', color: 'amber' },
    { region: 'a', color: 'blue' },
  ]);
  expect(() =>
    store.replace([
      { region: 'a', color: 'blue' },
      { region: 'a', color: 'pink' },
    ]),
  ).toThrow(RangeError);
  expect(() =>
    store.replace(
      Array.from({ length: 13 }, (_, index) => ({ region: `r${index}`, color: 'blue' })),
    ),
  ).toThrow(RangeError);
  expect(store.list.map(({ region }) => region)).toEqual(['b', 'a']);
  expect(() => store.recolor('x', 'green')).toThrow('not highlighted');
  expect(() => store.remove('x')).toThrow('not highlighted');
});

test('STORE-37 drawn again over a masthead choice, they end the Anatomy paint it lifted with them', () => {
  const session = createSessionStore({ views: VIEW_NAMES });
  const lesion = {
    mode: 'functions' as LesionMode,
    setMode(next: LesionMode) {
      lesion.mode = next;
    },
  };
  session.setLayersShown(true);
  session.liftPaint();
  showOverLift(session, lesion);
  expect(session.state).toMatchObject({ layersShown: false, paintLifted: false });
  expect(lesion.mode).toBe('lesion');
  session.setConnectivitySeed('julich:left:1');
  session.liftPaint();
  showOverLift(session, lesion);
  expect(session.state).toMatchObject({ connectivitySeed: null, paintLifted: false });
  session.setDisorderShown('schizophrenia');
  session.liftPaint();
  showOverLift(session, lesion);
  expect(session.state).toMatchObject({ disorderShown: null, paintLifted: false });
});
