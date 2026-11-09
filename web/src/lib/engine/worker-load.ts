import { AssetError } from '../core/assets/published-assets.ts';

/**
 * A worker whose script threw fires an ErrorEvent; one whose script did not load fires a plain
 * Event. A built page's worker script stops loading once a newer deploy has replaced it, so that
 * failure is `asset-updated`, and the page hears of it as it does of a lost lazy chunk. Null for a
 * script that threw.
 */
export function workerLoadFailure(event: Event, worker: string): AssetError | null {
  if ('message' in event) return null;
  const error = new AssetError('asset-updated', `The ${worker} worker script did not load.`, {
    cause: event,
  });
  globalThis.dispatchEvent(Object.assign(new Event('vite:preloadError'), { payload: error }));
  return error;
}
