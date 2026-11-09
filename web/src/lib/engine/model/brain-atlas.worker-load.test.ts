import { afterEach, expect, test, vi } from 'vitest';
import { BoxGeometry, Mesh } from 'three';
import { offerReloadAfterDeploy } from '../../../boot/new-deploy.ts';
import type { Notice } from '../../types/index.ts';
import { GeometryJobs } from './brain-atlas.ts';

/** A geometry worker that answers its first job with `error`, before any message. */
function failingWorker(error: () => Event) {
  return class {
    onerror: ((event: Event) => void) | null = null;
    postMessage() {
      queueMicrotask(() => this.onerror!(error()));
    }
    terminate() {}
  };
}

/** The page as the app starts it: `dispatchEvent` on the window reaches the startup listener. */
function page() {
  const window = new EventTarget();
  vi.stubGlobal('dispatchEvent', (event: Event) => window.dispatchEvent(event));
  const notices: Notice[] = [];
  offerReloadAfterDeploy(
    { session: { notify: (notice) => notices.push(notice) }, language: { current: 'en' } },
    window,
  );
  return notices;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test('a worker script that did not load fails the job as asset-updated and offers the reload', async () => {
  const notices = page();
  vi.stubGlobal(
    'Worker',
    failingWorker(() => new Event('error')),
  );
  const jobs = new GeometryJobs();
  await expect(jobs.feather([new Mesh(new BoxGeometry())])).rejects.toMatchObject({
    code: 'asset-updated',
  });
  expect(notices).toEqual([{ text: 'Planum was updated. Reload to continue.', action: 'reload' }]);
});

test('a worker script that threw stays an uncoded failure with no notice', async () => {
  const notices = page();
  vi.stubGlobal(
    'Worker',
    failingWorker(() => Object.assign(new Event('error'), { message: 'boom' })),
  );
  const failure = new GeometryJobs().feather([new Mesh(new BoxGeometry())]);
  await expect(failure).rejects.toThrow('boom');
  await expect(failure).rejects.not.toHaveProperty('code');
  expect(notices).toEqual([]);
});
