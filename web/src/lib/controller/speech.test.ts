// The announcer's sentences for a scripted sequence, read off viewer/app.js:1658-1693.
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createSession } from '../core/state/session.ts';
import type { Region, ShownNotice } from '../types/index.ts';
import { createSpeech } from './speech.ts';
import type { SpeechView } from './speech.ts';

const region = (hemisphere: 'left' | 'right') => ({ id: 'r', hemisphere }) as Region;
const base: SpeechView = {
  lang: 'en',
  selectedRegion: null,
  hiddenRegions: new Set(),
  notice: null,
  status: 'ready',
};
const speech = () => createSpeech(() => 'Precentral gyrus');
/** A notice as the session shows it: its parts numbered as they arrived. */
const shown = (kind: ShownNotice['kind'], ...parts: [number, string][]): ShownNotice => ({
  kind,
  text: parts.map(([, text]) => text).join(' '),
  parts: parts.map(([id, text]) => ({ id, text })),
});

test('the first view says nothing; a selection says its name and side, once', () => {
  const next = speech().next;
  assert.deepEqual(next(base), []);
  const selected = { ...base, selectedRegion: region('left') };
  assert.deepEqual(next(selected), ['Selected: Precentral gyrus, left']);
  assert.deepEqual(next(selected), []);
});

test('clearing the selection says an empty sentence, as the legacy announcer did', () => {
  const { next } = speech();
  next({ ...base, selectedRegion: region('right') });
  assert.deepEqual(next(base), ['']);
});

test('a notice outranks the selection it accompanies, and is said once', () => {
  const { next } = speech();
  const notice = shown('info', [1, 'Internal anatomy is hidden']);
  const view = { ...base, selectedRegion: region('left'), notice };
  assert.deepEqual(next(view), ['Internal anatomy is hidden']);
  assert.deepEqual(next(view), []);
  assert.deepEqual(next({ ...view, selectedRegion: region('right') }), [
    'Selected: Precentral gyrus, right',
  ]);
});

test('a changed count of hidden parts joins the sentence, and stands alone when nothing else is said', () => {
  const { next } = speech();
  next(base);
  const hidden = { ...base, hiddenRegions: new Set(['a', 'b']) };
  assert.deepEqual(next(hidden), ['2 parts hidden']);
  assert.deepEqual(next(hidden), []);
  assert.deepEqual(
    next({ ...hidden, selectedRegion: region('left'), hiddenRegions: new Set(['a']) }),
    ['Selected: Precentral gyrus, left. 1 part hidden'],
  );
  assert.deepEqual(
    next({ ...base, selectedRegion: region('left'), notice: shown('info', [1, 'Done.']) }),
    ['Done. All parts shown'],
  );
});

test('a lost context is said once after any other sentence, and the restore when it is ready again', () => {
  const { next } = speech();
  next(base);
  const lost = { ...base, status: 'context-lost' as const };
  assert.deepEqual(next(lost), ['The 3D view was interrupted by the graphics driver. Restoring…']);
  assert.deepEqual(next(lost), []);
  assert.deepEqual(next(base), ['Anatomy loaded.']);
  assert.deepEqual(next(base), []);
});

test('French sentences follow the view’s language', () => {
  const { next } = speech();
  next({ ...base, lang: 'fr' });
  assert.deepEqual(next({ ...base, lang: 'fr', selectedRegion: region('right') }), [
    'Sélectionné : Precentral gyrus, droite',
  ]);
});

test('an eye press’s part sentence leads the count and joins a notice or selection that goes with it', () => {
  const { next, part } = speech();
  next(base);
  part('Hidden: Precentral gyrus, left.');
  assert.deepEqual(next({ ...base, hiddenRegions: new Set(['a']) }), [
    'Hidden: Precentral gyrus, left. 1 part hidden',
  ]);
  part('Shown: Precentral gyrus, left.');
  assert.deepEqual(next({ ...base, notice: shown('info', [1, 'Done']) }), [
    'Done. Shown: Precentral gyrus, left. All parts shown',
  ]);
});

test('a part sentence is said once and only with a changed count', () => {
  const { next, part } = speech();
  next(base);
  part('Hidden: Precentral gyrus, left.');
  assert.deepEqual(next(base), []);
  assert.deepEqual(next({ ...base, hiddenRegions: new Set(['a']) }), ['1 part hidden']);
});

test('KEY-18 a standing error is said once: information joining it says only its own sentence', () => {
  const { next } = speech();
  next(base);
  const error = shown('error', [1, 'Could not load HCP-MMP.']);
  assert.deepEqual(next({ ...base, notice: error }), ['Could not load HCP-MMP.']);
  const beside = shown('error', [1, 'Could not load HCP-MMP.'], [2, 'Both hemispheres shown.']);
  assert.deepEqual(next({ ...base, notice: beside }), ['Both hemispheres shown.']);
  assert.deepEqual(next({ ...base, notice: error, selectedRegion: region('left') }), [
    'Selected: Precentral gyrus, left',
  ]);
  next(base);
  assert.deepEqual(next({ ...base, notice: error }), ['Could not load HCP-MMP.']);
});

/** The session's own notices through the announcer, as the app wires them. */
function announced() {
  const session = createSession({ views: ['oblique'] });
  const { next } = speech();
  next(base);
  const say = (selectedRegion: Region | null = null) =>
    next({ ...base, selectedRegion, notice: session.assemble({}).notice });
  return { session, say };
}

test('KEY-18 the same failure again is said again', () => {
  const { session, say } = announced();
  const offline = { kind: 'error' as const, text: 'Could not load HCP-MMP.', key: 'atlas' };
  session.notify(offline);
  assert.deepEqual(say(), ['Could not load HCP-MMP.']);
  session.notify(offline);
  assert.deepEqual(say(), ['Could not load HCP-MMP.']);
  assert.deepEqual(say(), []);
});

test('KEY-18 an error resolved, or one arriving ahead of information, says only what is new, and a selection still speaks', () => {
  const { session, say } = announced();
  session.notify({ kind: 'error', text: 'Could not load HCP-MMP.', key: 'atlas' });
  session.notify({ kind: 'info', text: 'Both hemispheres shown.' });
  assert.deepEqual(say(), ['Could not load HCP-MMP. Both hemispheres shown.']);
  session.resolveNotice('atlas');
  assert.deepEqual(say(region('left')), ['Selected: Precentral gyrus, left']);
  session.notify({ kind: 'error', text: 'Could not show the spinal cord.', key: 'cord' });
  assert.deepEqual(say(region('left')), ['Could not show the spinal cord.']);
  assert.equal(
    session.assemble({}).notice!.text,
    'Could not show the spinal cord. Both hemispheres shown.',
  );
});
