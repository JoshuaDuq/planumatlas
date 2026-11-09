import { failureNotice } from '../lib/core/i18n/errors.ts';
import type { Notice } from '../lib/types/index.ts';

/**
 * A file of this build that no longer loads means a newer deploy replaced the site under the open
 * page. Vite raises `vite:preloadError` for a lazy chunk, the worker sites for a worker script. The
 * error still reaches its caller, now coded `asset-updated` so the panel words it; the notice offers
 * the reload. Not prevented: Vite would then resolve the import to undefined.
 */
export function offerReloadAfterDeploy(
  app: { session: { notify(notice: Notice): void }; language: { readonly current: string } },
  events: Pick<EventTarget, 'addEventListener'> = globalThis,
): void {
  events.addEventListener('vite:preloadError', (event) => {
    const error = (event as VitePreloadErrorEvent).payload;
    Object.assign(error, { code: 'asset-updated' });
    app.session.notify(failureNotice(error, app.language.current, 'start'));
  });
}
