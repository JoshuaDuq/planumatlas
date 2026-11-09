import { AssetError, fetchPublished, publishedRecord } from './published-assets.ts';

/**
 * One in-flight request per URL.
 *
 * The head script starts the anatomy downloads before this module graph has
 * even parsed. Those Response promises live on `globalThis.__planumAssets`
 * and are consumed here so a second fetch of the same 25 MB file never opens.
 */
declare global {
  var __planumAssets: Record<string, Promise<Response>> | undefined;
}

export interface AssetProgress {
  loaded: number;
  total: number;
}

type ProgressListener = (event: AssetProgress) => void;

const inflight = new Map<
  string,
  { promise: Promise<ArrayBuffer>; listeners: ProgressListener[] }
>();

/** A verified download the service worker never saw, as the page received it. */
export interface UnseenFile {
  /** The versioned URL it was requested at, the worker's storage key. */
  url: string;
  headers: [string, string][];
  body: Blob;
}

const unseen: UnseenFile[] = [];
let handOver: ((file: UnseenFile) => void) | null = null;
let released = false;

/**
 * The built site registers a service worker only after it has started (keep-cached.ts), so the
 * first visit's downloads pass it by. Those are kept until `store` takes them, then handed over as
 * they finish; the worker stores each only if its bytes hash to its own published record.
 */
export function handOverUnseen(store: (file: UnseenFile) => void): void {
  handOver = store;
  for (const file of unseen.splice(0)) store(file);
}

/**
 * No worker will take them, because registration failed or the app did not start: drop the copies
 * and keep no more.
 */
export function releaseUnseen(): void {
  released = true;
  unseen.length = 0;
}

export async function sha256Hex(buffer: BufferSource): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * `size` is the decoded byte count the build recorded. Content-Length is only
 * a fallback, and never under Content-Encoding: it then counts the gzip
 * bytes while the stream yields decoded ones, and the bar passes 100%.
 */
async function readWithProgress(
  response: Response,
  onChunk: ProgressListener,
  size: number | undefined,
): Promise<ArrayBuffer> {
  const length = response.headers.get('Content-Encoding')
    ? 0
    : Number(response.headers.get('Content-Length'));
  const total = size ?? (length || 0);
  if (!response.body) {
    const buffer = await response.arrayBuffer();
    onChunk({ loaded: buffer.byteLength, total: total || buffer.byteLength });
    return buffer;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    if (total) onChunk({ loaded, total });
  }
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  onChunk({ loaded, total: total || loaded });
  return bytes.buffer;
}

async function download(
  key: string,
  early: Promise<Response> | undefined,
  notify: ProgressListener,
  priority: RequestPriority | undefined,
): Promise<ArrayBuffer> {
  const record = publishedRecord(key);
  const passesWorker =
    import.meta.env.PROD && 'serviceWorker' in navigator && !navigator.serviceWorker.controller;
  let buffer: ArrayBuffer;
  let response: Response;
  let expected: { sha256: string; size: number } | undefined = record ?? undefined;
  try {
    response = early ? await early : await fetchPublished(key, priority && { priority });
    if (!response.ok) {
      throw new AssetError(
        'asset-fetch',
        `Asset request failed: HTTP ${response.status} (${key})`,
        {
          status: response.status,
        },
      );
    }
    // A `.gz` file sent with Content-Encoding arrives as its contents.
    if (record?.gunzipped && response.headers.get('Content-Encoding')) expected = record.gunzipped;
    buffer = await readWithProgress(response, notify, expected?.size);
  } catch (error) {
    // fetch and a dropped body stream both reject with a TypeError.
    if (!(error instanceof TypeError)) throw error;
    throw new AssetError('asset-fetch', `Asset download failed: ${key}`, { cause: error });
  }
  if (expected && (await sha256Hex(buffer)) !== expected.sha256) {
    throw new AssetError('asset-updated', `Published file changed since this page loaded: ${key}`);
  }
  // Released while this one downloaded: nothing will take it.
  if (record && passesWorker && !released) {
    const url = new URL(key);
    url.searchParams.set('v', record.version);
    // A copy, so the worker gets the bytes as verified whatever callers do with the buffer.
    const file = { url: url.href, headers: [...response.headers], body: new Blob([buffer]) };
    if (!handOver) unseen.push(file);
    else {
      // Storing for the next visit must not fail this one's verified load.
      try {
        handOver(file);
      } catch (error) {
        console.warn('Service worker hand-over failed:', error);
      }
    }
  }
  return buffer;
}

/**
 * The verified bytes of one published file, as an ArrayBuffer shared by concurrent callers. A
 * prefetch asks for `low` priority; a caller that joins it waits on that same request.
 */
export function fetchAsset(
  url: string | URL,
  {
    onProgress,
    priority,
  }: { onProgress?: ProgressListener | undefined; priority?: RequestPriority | undefined } = {},
): Promise<ArrayBuffer> {
  const key = new URL(url, globalThis.location?.href).href;
  const existing = inflight.get(key);
  if (existing) {
    if (onProgress) existing.listeners.push(onProgress);
    return existing.promise;
  }
  const listeners = onProgress ? [onProgress] : [];
  const notify: ProgressListener = (event) => {
    for (const listener of listeners) listener(event);
  };
  const early = globalThis.__planumAssets?.[key];
  if (early) delete globalThis.__planumAssets![key];
  const promise = download(key, early, notify, priority).finally(() => inflight.delete(key));
  inflight.set(key, { promise, listeners });
  return promise;
}
