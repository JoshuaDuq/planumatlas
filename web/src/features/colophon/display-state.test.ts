import assert from 'node:assert/strict';
import { test } from 'vitest';
import { DEFAULT_DISPLAY, displayChanges } from './display-state.ts';
import type { DisplayView } from './display-state.ts';

const defaults: DisplayView = {
  lang: 'en',
  explorer: 'anatomy',
  anatomy: 'cdmd',
  referenceAnatomy: 'cdmd',
  hemisphere: 'both',
  cortexVisible: true,
  cortexOpacity: 1,
  internalVisible: true,
  hiddenRegions: new Set(),
  isolatedRegion: null,
  focused: false,
  selectedRegion: null,
};

test('nothing is listed at the defaults', () => {
  assert.deepEqual(displayChanges(defaults, DEFAULT_DISPLAY), []);
});

test('each setting away from its default is named, in order, in the reader’s language', () => {
  const changed: DisplayView = {
    ...defaults,
    hemisphere: 'left',
    cortexOpacity: 0.15,
    internalVisible: false,
    hiddenRegions: new Set(['a', 'b', 'c']),
    isolatedRegion: 'a',
    focused: true,
  };
  assert.deepEqual(displayChanges(changed, DEFAULT_DISPLAY), [
    'Left hemisphere',
    'Cortex 15%',
    'Internal anatomy hidden',
    '3 parts hidden',
    'Region isolated',
    'Focus on',
  ]);
  assert.deepEqual(
    displayChanges({ ...changed, lang: 'fr', hiddenRegions: new Set(['a']) }, DEFAULT_DISPLAY),
    [
      'Hémisphère gauche',
      'Cortex à 15 %',
      'Anatomie interne masquée',
      '1 partie masquée',
      'Région isolée',
      'Ciblage activé',
    ],
  );
});

test('a hidden cortex is said once, without its opacity', () => {
  assert.deepEqual(
    displayChanges({ ...defaults, cortexVisible: false, cortexOpacity: 0.4 }, DEFAULT_DISPLAY),
    ['Cortex hidden'],
  );
});

test('Tracts over its own anatomy opens on a see-through cortex, which is its default there', () => {
  const tracts = { ...defaults, explorer: 'diffusion' as const, cortexOpacity: 0.16 };
  assert.deepEqual(displayChanges(tracts, DEFAULT_DISPLAY), []);
  assert.deepEqual(displayChanges({ ...tracts, cortexOpacity: 1 }, DEFAULT_DISPLAY), [
    'Cortex 100%',
  ]);
  assert.deepEqual(displayChanges({ ...defaults, cortexOpacity: 0.16 }, DEFAULT_DISPLAY), [
    'Cortex 16%',
  ]);
});

test('under a lesson, what its step prepared is not listed, and the reader’s own changes from it are', () => {
  const region = { id: 'landmark' } as DisplayView['selectedRegion'];
  const prepared = {
    ...DEFAULT_DISPLAY,
    hemisphere: 'left' as const,
    cortexVisible: false,
    hiddenRegions: new Set(['cover']),
    focused: true,
  };
  const step: DisplayView = { ...defaults, ...prepared, selectedRegion: region };
  assert.deepEqual(displayChanges(step, prepared), []);
  assert.deepEqual(
    displayChanges(
      {
        ...step,
        hemisphere: 'both',
        cortexVisible: true,
        hiddenRegions: new Set(),
        focused: false,
      },
      prepared,
    ),
    ['Both hemispheres', 'Cortex shown', '1 part shown', 'Focus off'],
  );
  // With nothing selected, the step's Focus has ended with the selection: nothing to list.
  assert.deepEqual(displayChanges({ ...step, focused: false, selectedRegion: null }, prepared), []);
});
