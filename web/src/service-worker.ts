/**
 * Repeat-visit caching for the published anatomy and diffusion data.
 *
 * The model is the expensive part of this site and the part that changes
 * least, yet the app asks for it with `no-cache`, and the HTTP cache lets it
 * go after ten minutes. This worker keeps it across visits.
 *
 * Every published file is requested as `<path>?v=<its own content hash>`, and
 * the build writes the current map of those versions in below. A request is
 * stored only when its version is the one this deploy publishes, and only once
 * its bytes hash to it; on activation, entries whose URL the deploy no longer
 * publishes are deleted, and nothing else. A deploy that changes one file
 * therefore re-downloads that file alone.
 *
 * The page registers this worker only once it has started, so it hands over
 * the files it downloaded before then; they are stored on the same terms.
 *
 * The build's scripts, styles and fonts under `assets/` are named by their own
 * hash, so a stored copy never goes stale: they are served from storage first.
 * A tab left open across a deploy, which replaces them on the server, can then
 * still load the lazy code it has loaded before (anything else gets the
 * "Planum was updated" notice). The `ASSET_LIMIT` most recently stored are
 * kept; each page load drops the rest.
 *
 * It does not make the site work offline: the page itself is never stored
 * here, and navigations always go to the network first.
 *
 * The build type-strips this file to `sw.js` (build/published-files.ts).
 */

interface PublishedVersions {
  base: string;
  files: Record<string, string>;
  gunzipped: Record<string, string>;
}

declare const __PUBLISHED_VERSIONS__: PublishedVersions;

const PUBLISHED = __PUBLISHED_VERSIONS__;
const CACHE = 'planum-models';
const ASSETS = 'planum-assets';
// A build is about 22 files and 4 MB, and a visit loads most of them: about four deploys' worth.
const ASSET_LIMIT = 100;
// When the worker stored an asset, in milliseconds since the epoch; the oldest are dropped first.
const STORED_AT = 'x-planum-stored';
const worker = self as unknown as ServiceWorkerGlobalScope;

/** A same-origin URL's path from the published root, or null. */
function publishedPath(url: URL): string | null {
  if (url.origin !== worker.location.origin || !url.pathname.startsWith(PUBLISHED.base))
    return null;
  return decodeURIComponent(url.pathname.slice(PUBLISHED.base.length));
}

/** The path of the file a URL asks for, when it asks for the version this deploy publishes; else null. */
function currentPath(url: URL): string | null {
  const path = publishedPath(url);
  return path !== null &&
    path in PUBLISHED.files &&
    url.searchParams.get('v') === PUBLISHED.files[path]
    ? path
    : null;
}

async function versionOf(buffer: ArrayBuffer): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
  return [...digest.subarray(0, 8)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

/** Whether a same-origin URL is one of the build's hashed files. */
function isBuildAsset(url: URL): boolean {
  return (
    url.origin === worker.location.origin && url.pathname.startsWith(`${PUBLISHED.base}assets/`)
  );
}

/** A build file from storage, else from the network, stored when it arrives whole. */
async function buildAsset(event: FetchEvent, key: string): Promise<Response> {
  const cache = await caches.open(ASSETS);
  const stored = await cache.match(key);
  if (stored) return stored;
  // Its name is its content's hash, so the HTTP cache cannot hold other bytes under it.
  const response = await fetch(event.request);
  if (response.status === 200 && !response.redirected) {
    const headers = new Headers(response.headers);
    headers.set(STORED_AT, String(Date.now()));
    event.waitUntil(cache.put(key, new Response(response.clone().body, { status: 200, headers })));
  }
  return response;
}

/** Keep the `ASSET_LIMIT` build files stored last. */
async function pruneAssets(): Promise<void> {
  if (!(await caches.has(ASSETS))) return;
  const cache = await caches.open(ASSETS);
  const entries = await Promise.all(
    (await cache.keys()).map(async (request) => ({
      request,
      stored: Number((await cache.match(request))?.headers.get(STORED_AT)),
    })),
  );
  entries.sort((a, b) => b.stored - a.stored);
  for (const { request } of entries.slice(ASSET_LIMIT)) await cache.delete(request);
}

/** Store `bytes` under `key` only if they hash to the version this deploy publishes for `path`. */
async function store(key: string, path: string, bytes: ArrayBuffer, headers: HeadersInit) {
  // A `.gz` file a server sends with Content-Encoding arrives as its contents.
  const version = await versionOf(bytes);
  if (version !== PUBLISHED.files[path] && version !== PUBLISHED.gunzipped[path]) return;
  const cache = await caches.open(CACHE);
  await cache.put(key, new Response(bytes, { status: 200, headers }));
}

worker.addEventListener('install', () => worker.skipWaiting());

worker.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        // Caches from before the rename to Planum, including the one per model
        // version kept before files were versioned one by one.
        if (name.startsWith('neuroatlas-models')) await caches.delete(name);
      }
      const cache = await caches.open(CACHE);
      for (const request of await cache.keys()) {
        if (currentPath(new URL(request.url)) === null) await cache.delete(request);
      }
      await worker.clients.claim();
    })(),
  );
});

worker.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  // The page carries the versions its requests ask for, and GitHub Pages lets
  // the browser keep it ten minutes, so it is always revalidated.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' })
        .then((response) => (response.redirected ? fetch(request) : response))
        .catch(() => fetch(request)),
    );
    event.waitUntil(pruneAssets());
    return;
  }
  const url = new URL(request.url);
  if (isBuildAsset(url)) {
    event.respondWith(buildAsset(event, url.pathname));
    return;
  }
  const path = currentPath(url);
  if (path === null) return;

  event.respondWith(
    (async () => {
      const key = url.pathname + url.search;
      const cache = await caches.open(CACHE);
      const stored = await cache.match(key);
      if (stored) return stored;
      // Revalidate: the HTTP cache may still hold bytes from before the deploy. Built from the
      // page's request, so it keeps that request's priority.
      const response = await fetch(new Request(request, { cache: 'no-cache' }));
      // A partial, failed or mismatched response must not become the copy every
      // later visit gets; the page sees it and reports it.
      if (response.ok && response.status === 200) {
        const copy = response.clone();
        event.waitUntil(copy.arrayBuffer().then((bytes) => store(key, path, bytes, copy.headers)));
      }
      return response;
    })(),
  );
});

// A file the page downloaded before this worker controlled it (asset-cache.ts `handOverUnseen`).
worker.addEventListener('message', (event) => {
  const { url, headers, body } = event.data as {
    url: string;
    headers: [string, string][];
    body: Blob;
  };
  const address = new URL(url);
  const path = currentPath(address);
  if (path === null) return;
  const key = address.pathname + address.search;
  event.waitUntil(
    (async () => {
      if (await (await caches.open(CACHE)).match(key)) return;
      await store(key, path, await body.arrayBuffer(), headers);
    })(),
  );
});
