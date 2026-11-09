import { expect, test } from 'vitest';
import { workerLoadFailure } from './worker-load.ts';

/** The first `error` event a real module worker fires. */
function firstError(url: string): Promise<Event> {
  return new Promise((resolve) => {
    const worker = new Worker(url, { type: 'module' });
    worker.onerror = (event) => {
      event.preventDefault();
      worker.terminate();
      resolve(event);
    };
  });
}

test('a worker script that is gone is asset-updated, and the page hears of it', async () => {
  const heard: unknown[] = [];
  const listen = (event: Event) => heard.push((event as VitePreloadErrorEvent).payload);
  addEventListener('vite:preloadError', listen);
  const error = workerLoadFailure(await firstError('/assets/gone-worker-0000.js'), 'test');
  removeEventListener('vite:preloadError', listen);
  expect(error).toMatchObject({ code: 'asset-updated' });
  expect(heard).toEqual([error]);
});

test('a worker script that threw is not mistaken for one that did not load', async () => {
  const script = URL.createObjectURL(
    new Blob(['throw new Error("boom")'], { type: 'text/javascript' }),
  );
  const heard: unknown[] = [];
  const listen = (event: Event) => heard.push(event);
  addEventListener('vite:preloadError', listen);
  expect(workerLoadFailure(await firstError(script), 'test')).toBeNull();
  removeEventListener('vite:preloadError', listen);
  URL.revokeObjectURL(script);
  expect(heard).toEqual([]);
});
