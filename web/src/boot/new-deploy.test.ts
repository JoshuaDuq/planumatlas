import { expect, test } from 'vitest';
import type { Notice } from '../lib/types/index.ts';
import { offerReloadAfterDeploy } from './new-deploy.ts';

function listening(lang: string) {
  const events = new EventTarget();
  const notices: Notice[] = [];
  offerReloadAfterDeploy(
    { session: { notify: (notice) => notices.push(notice) }, language: { current: lang } },
    events,
  );
  return { events, notices };
}

const lostChunk = (payload: Error) =>
  Object.assign(new Event('vite:preloadError', { cancelable: true }), { payload });

test('a lazy chunk a newer deploy removed offers the reload, and its caller sees asset-updated', () => {
  const { events, notices } = listening('en');
  const error = new TypeError('Failed to fetch dynamically imported module');
  const event = lostChunk(error);
  events.dispatchEvent(event);
  expect(notices).toEqual([{ text: 'Planum was updated. Reload to continue.', action: 'reload' }]);
  expect(error).toHaveProperty('code', 'asset-updated');
  // Prevented, Vite would resolve the import to undefined rather than reject it.
  expect(event.defaultPrevented).toBe(false);
});

test('the notice is in the reader’s language', () => {
  const { events, notices } = listening('fr');
  events.dispatchEvent(lostChunk(new TypeError('Failed to fetch dynamically imported module')));
  expect(notices).toEqual([
    { text: 'Planum a été mis à jour. Rechargez la page pour continuer.', action: 'reload' },
  ]);
});
