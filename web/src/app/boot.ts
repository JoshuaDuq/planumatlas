import { flushSync } from 'svelte';
import { ASSET_BASE } from '../../build/site.ts';
import { keepAnatomyCached } from '../boot/keep-cached.ts';
import { releaseUnseen } from '../lib/core/assets/asset-cache.ts';
import { loadAnatomies, resolveAnatomy } from '../lib/core/assets/published-anatomy.ts';
import { t } from '../lib/core/i18n/index.ts';
import { startFailure } from '../lib/core/i18n/errors.ts';
import { prefetchAtlas } from '../lib/core/state/boot.ts';
import type { ConnectionHints } from '../lib/core/state/boot.ts';
import { decodeState } from '../lib/core/state/url-state.ts';
import type {
  CreateEngine,
  Engine,
  EngineError,
  EngineModel,
  EngineSections,
} from '../lib/engine/api.ts';
import { createEngine as createRealEngine } from '../lib/engine/index.ts';
import { qualityProfile } from '../lib/engine/render/quality.ts';
import { APP } from './application.svelte.ts';
import type { App } from './application.svelte.ts';
import { bindAppLifecycle } from './lifecycle.ts';
import { missingWebgl } from './webgl-check.ts';
import { composeWorld } from './world.ts';
import { firstLaunch } from '../features/guide/first-launch.ts';
import { openingColour } from '../lib/core/catalog/lobes.ts';

/** What `mount` is given for `App.svelte`: its status and language follow the app, and every region can read the app from the context. */
export function shellOptions(app: App) {
  return {
    props: {
      get status() {
        return app.session.state.status;
      },
      get lang() {
        return app.language.current;
      },
    },
    context: new Map([[APP, app]]),
  };
}

/** How long the idle callback may wait before the first cut is prepared anyway. */
const PREFETCH_FALLBACK_MS = 1500;

const atlasPrefetched = new WeakSet<EngineModel>();

/**
 * The first time the reader points at or focuses the Atlas control, fetch the other cortical atlas
 * ahead of a switch (app.js:73-82), where the GPU and connection allow it.
 */
export function prefetchOtherAtlas(model: EngineModel): void {
  if (atlasPrefetched.has(model)) return;
  atlasPrefetched.add(model);
  const atlas = prefetchAtlas(model.manifest.atlases, model.settings.atlas, {
    prefetchLayers: qualityProfile().prefetchLayers,
    connection: (globalThis.navigator as { connection?: ConnectionHints } | undefined)?.connection,
  });
  if (!atlas) return;
  model.prefetchLayer(atlas.id).catch((error) => console.warn('Prefetch failed:', error));
}

/**
 * Once the first atlas is on screen, download, build and compile the first cut, which otherwise
 * waits for all three after the click. The gate reads memory and the connection, not the GPU.
 * Called once the start's layers are in; two frames on, the first brain has been drawn.
 */
function prefetchFirstCut(sections: EngineSections): void {
  if (!qualityProfile({ integrated: false }).prefetchCut) return;
  const idle =
    globalThis.requestIdleCallback ?? ((run: () => void) => setTimeout(run, PREFETCH_FALLBACK_MS));
  requestAnimationFrame(() =>
    requestAnimationFrame(() =>
      idle(() => {
        sections.prefetch().catch((error) => console.warn('Cut prefetch failed:', error));
      }),
    ),
  );
}

/**
 * Opens the engine on the stage, for the atlas and detail level a link names. A layer this anatomy
 * does not publish opens the defaults instead: the link's check then names it (app.js:176-190).
 */
async function openEngine(
  app: App,
  createEngine: CreateEngine,
  manifestUrl: string,
  wanted: { atlas?: string | undefined; detail?: string | undefined },
): Promise<Engine> {
  const host = document.getElementById('viewport');
  if (!host) throw new Error('The stage element #viewport is not on the page.');
  const open = (atlas?: string, detail?: string) =>
    createEngine({
      host,
      manifestUrl,
      ...(atlas !== undefined && { atlas }),
      ...(detail !== undefined && { detail }),
      theme: app.theme.current,
      // The layers download in parallel: once the start has failed, the session drops the other's progress.
      onProgress: (progress) => app.session.setProgress(progress),
    });
  try {
    return await open(wanted.atlas, wanted.detail);
  } catch (error) {
    if ((error as EngineError).code !== 'unknown-layer') throw error;
    console.error(error);
    return await open();
  }
}

/**
 * Loads the anatomy and opens the app on it (app.js:93-212, 2079-2156; main.js:76-97). The page
 * is mounted already, so its stage says the load's progress and a failure; the reader is told
 * of those by the stage itself, not here. Resolves once the start is over, on a failure screen
 * or a ready stage.
 *
 * `createEngine` is a parameter so the whole start can be exercised without a GPU.
 */
export async function startApp(
  app: App,
  createEngine: CreateEngine = createRealEngine,
): Promise<void> {
  const missing = missingWebgl();
  if (missing) {
    app.fail(new Error(missing), { text: t(app.language.current, 'errors')[missing] });
    return;
  }
  try {
    const arrived = location.hash;
    // A link is applied field by field: what this anatomy cannot apply is named, not fatal.
    const link = decodeState(arrived);
    const wanted = link.state;
    const modelsUrl = `${ASSET_BASE}models`;
    const published = await loadAnatomies(`${modelsUrl}/anatomies.json`);
    const requested = wanted.anatomy ?? undefined;
    const unpublished =
      requested !== undefined && !published.anatomies.some(({ id }) => id === requested);
    if (unpublished) link.rejected.push('anatomy');
    // Resolve the requested subject before constructing a scene for it.
    const anatomy = resolveAnatomy(published, unpublished ? undefined : requested);
    const engine = await openEngine(
      app,
      createEngine,
      `${modelsUrl}/${anatomy}/manifest.json`,
      wanted,
    );

    // A page opened plainly shows the opening picture; a link shows the colour it was written with.
    if (arrived.replace(/^#/, '') === '') {
      wanted.surfaceColor = openingColour(engine.model.settings.atlas);
    }
    const world = await composeWorld(app, engine, published.default);
    // The regions that draw from the engine mount here, and hand over the ports the controllers reach.
    app.attach(world);
    flushSync();
    // The camera opened inside the brain with no dock to clear: frame it with the dock in place.
    engine.camera.setFramingSource(app.stage.framing);
    engine.camera.applyView('oblique', { immediate: true });
    const notApplied = await world.links.restore(link, { immediate: true });
    app.session.setLoaded();
    world.links.report(notApplied);
    if (firstLaunch(arrived)) {
      // The controls a ready stage shows are drawn before the tour counts which ones it can point at.
      flushSync();
      app.ports.startGuide(true);
    }
    prefetchFirstCut(engine.sections);
    globalThis.addEventListener('hashchange', world.links.onHashChange);
    app.defer(() => globalThis.removeEventListener('hashchange', world.links.onHashChange));
    bindAppLifecycle(app);
    keepAnatomyCached();
  } catch (error) {
    console.error(error);
    // No worker will take this page's downloads now.
    releaseUnseen();
    app.dispose();
    const failure = startFailure(
      error,
      app.language.current,
      location.hash.replace(/^#/, '') !== '',
    );
    app.fail(error instanceof Error ? error : new Error(String(error), { cause: error }), failure);
  }
}
