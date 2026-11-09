import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAsset, handOverUnseen, type AssetProgress, type UnseenFile } from './asset-cache.ts';
import { publish, recordOf, sha256 } from './published-test-support.ts';

const bytesOf = (count: number) => new Uint8Array(count).map((_, i) => i + 1);

function responseFor(count: number) {
  const body = bytesOf(count);
  return new Response(body, {
    status: 200,
    headers: { 'Content-Length': String(body.byteLength) },
  });
}

describe('fetchAsset', () => {
  it('reuses an in-flight request and fans progress out to every listener', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => responseFor(8));
    const seenA: AssetProgress[] = [];
    const seenB: AssetProgress[] = [];
    const a = fetchAsset('https://example.test/a.glb', {
      onProgress: (event) => seenA.push({ ...event }),
    });
    const b = fetchAsset('https://example.test/a.glb', {
      onProgress: (event) => seenB.push({ ...event }),
    });
    const [left, right] = await Promise.all([a, b]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(left.byteLength).toBe(8);
    expect(right.byteLength).toBe(8);
    expect(seenA.at(-1)).toEqual({ loaded: 8, total: 8 });
    expect(seenB.at(-1)).toEqual({ loaded: 8, total: 8 });
  });

  it('consumes a head-started response instead of opening a second download', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    globalThis.__planumAssets = { 'https://example.test/b.glb': Promise.resolve(responseFor(4)) };
    const buffer = await fetchAsset('https://example.test/b.glb');
    expect(buffer.byteLength).toBe(4);
    expect(fetch).not.toHaveBeenCalled();
    expect(globalThis.__planumAssets['https://example.test/b.glb']).toBeUndefined();
  });

  it('fails bytes that are not the published file as an update, not as data', async () => {
    publish({ 'models/bert/manifest.json': recordOf(bytesOf(6)) });
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response(new Uint8Array([9, 9, 9, 9, 9, 9])),
    );
    await expect(
      fetchAsset('https://example.test/neuroatlas/models/bert/manifest.json'),
    ).rejects.toMatchObject({ code: 'asset-updated' });
  });

  it('passes the published bytes and names their version in the request', async () => {
    publish({ 'models/bert/manifest.json': recordOf(bytesOf(6)) });
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => responseFor(6));
    const buffer = await fetchAsset('https://example.test/neuroatlas/models/bert/manifest.json');
    expect(new Uint8Array(buffer)).toEqual(bytesOf(6));
    expect(fetch.mock.calls[0][0]).toMatch(/manifest\.json\?v=[0-9a-f]{16}$/);
  });

  it('carries the asset-fetch code for HTTP and network failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('', { status: 503 }));
    await expect(fetchAsset('https://example.test/c.glb')).rejects.toMatchObject({
      code: 'asset-fetch',
      status: 503,
    });
    const failure = new TypeError('Failed to fetch');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      throw failure;
    });
    const error = await fetchAsset('https://example.test/c.glb').catch((caught) => caught);
    expect(error).toMatchObject({ code: 'asset-fetch', cause: failure });
    expect(error.status).toBeUndefined();
  });

  it('reports a gzip-encoded response against the decoded size, never past it', async () => {
    publish({ 'models/bert/learning.glb': recordOf(bytesOf(40)) });
    // The server's Content-Length counts the gzip bytes; the stream yields decoded ones.
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(bytesOf(40), {
          headers: { 'Content-Encoding': 'gzip', 'Content-Length': '12' },
        }),
    );
    const seen: AssetProgress[] = [];
    await fetchAsset('https://example.test/neuroatlas/models/bert/learning.glb', {
      onProgress: (event) => seen.push(event),
    });
    expect(seen.every(({ loaded, total }) => total === 40 && loaded <= total)).toBe(true);
  });

  it('does not take an encoded Content-Length for the total when no size is published', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(bytesOf(40), {
          headers: { 'Content-Encoding': 'gzip', 'Content-Length': '12' },
        }),
    );
    const seen: AssetProgress[] = [];
    await fetchAsset('https://example.test/d.glb', { onProgress: (event) => seen.push(event) });
    expect(seen).toEqual([{ loaded: 40, total: 40 }]);
  });

  it('checks a .gz file a server decodes on the way against its contents', async () => {
    const contents = bytesOf(30);
    const file = new Uint8Array(gzipSync(contents));
    publish({
      'diffusion/a.trk.gz': {
        ...recordOf(file),
        gunzipped: { sha256: sha256(contents), size: contents.byteLength },
      },
    });
    const url = 'https://example.test/neuroatlas/diffusion/a.trk.gz';
    const fetch = vi.spyOn(globalThis, 'fetch');
    fetch.mockImplementation(async () => new Response(file));
    expect(new Uint8Array(await fetchAsset(url))).toEqual(file);
    const seen: AssetProgress[] = [];
    fetch.mockImplementation(
      async () => new Response(contents, { headers: { 'Content-Encoding': 'gzip' } }),
    );
    expect(
      new Uint8Array(await fetchAsset(url, { onProgress: (event) => seen.push(event) })),
    ).toEqual(contents);
    expect(seen.at(-1)).toEqual({ loaded: 30, total: 30 });
    fetch.mockImplementation(
      async () => new Response(bytesOf(29), { headers: { 'Content-Encoding': 'gzip' } }),
    );
    await expect(fetchAsset(url)).rejects.toMatchObject({ code: 'asset-updated' });
  });
});

describe('handOverUnseen', () => {
  afterEach(() => vi.unstubAllEnvs());
  const base = 'https://example.test/neuroatlas/models/bert/';
  const records = {
    'models/bert/manifest.json': recordOf(bytesOf(6)),
    'models/bert/learning.glb': recordOf(bytesOf(4)),
  };
  const serve = () =>
    vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (url) => responseFor(String(url).includes('manifest') ? 6 : 4));

  it('SW-11 gives the service worker each verified download it did not see, at its versioned URL, before and after it is ready', async () => {
    vi.stubEnv('PROD', true);
    vi.stubGlobal('navigator', { serviceWorker: { controller: null } });
    publish(records);
    serve();
    await fetchAsset(`${base}manifest.json`);
    const handed: UnseenFile[] = [];
    handOverUnseen((file) => handed.push(file));
    expect(handed.map(({ url }) => url)).toEqual([
      `${base}manifest.json?v=${records['models/bert/manifest.json'].version}`,
    ]);
    await fetchAsset(`${base}learning.glb`);
    expect(handed.map(({ url }) => url)).toEqual([
      `${base}manifest.json?v=${records['models/bert/manifest.json'].version}`,
      `${base}learning.glb?v=${records['models/bert/learning.glb'].version}`,
    ]);
    expect(new Uint8Array(await handed[1]!.body.arrayBuffer())).toEqual(bytesOf(4));
    expect(handed[1]!.headers).toEqual([['content-length', '4']]);
  });

  it('SW-11 keeps nothing the worker sees itself, in development, unverified or failing its check', async () => {
    const handed: UnseenFile[] = [];
    handOverUnseen((file) => handed.push(file));
    vi.stubEnv('PROD', true);
    vi.stubGlobal('navigator', { serviceWorker: { controller: null } });
    const fetch = serve();
    // No published map: nothing was verified.
    await fetchAsset(`${base}manifest.json`);
    publish(records);
    vi.stubGlobal('navigator', { serviceWorker: { controller: {} } });
    await fetchAsset(`${base}manifest.json`);
    vi.stubGlobal('navigator', { serviceWorker: { controller: null } });
    vi.stubEnv('PROD', false);
    await fetchAsset(`${base}learning.glb`);
    vi.stubEnv('PROD', true);
    fetch.mockImplementation(async () => responseFor(5));
    await expect(fetchAsset(`${base}learning.glb`)).rejects.toMatchObject({
      code: 'asset-updated',
    });
    expect(handed).toEqual([]);
  });

  it('SW-11 drops what it kept, and keeps no more, once no worker will take it', async () => {
    // A fresh module: releasing is for the life of the page.
    vi.resetModules();
    const cache = await import('./asset-cache.ts');
    const { default: published } = await import('./published-files.ts');
    Object.assign(published, { base: '/neuroatlas/', files: records });
    vi.stubEnv('PROD', true);
    vi.stubGlobal('navigator', { serviceWorker: { controller: null } });
    serve();
    await cache.fetchAsset(`${base}manifest.json`);
    cache.releaseUnseen();
    await cache.fetchAsset(`${base}learning.glb`);
    const handed: UnseenFile[] = [];
    cache.handOverUnseen((file) => handed.push(file));
    await cache.fetchAsset(`${base}learning.glb`);
    expect(handed).toEqual([]);
  });

  it('SW-11 keeps nothing from a download still running when the copies are released', async () => {
    vi.resetModules();
    const cache = await import('./asset-cache.ts');
    const { default: published } = await import('./published-files.ts');
    Object.assign(published, { base: '/neuroatlas/', files: records });
    vi.stubEnv('PROD', true);
    vi.stubGlobal('navigator', { serviceWorker: { controller: null } });
    let arrive!: (response: Response) => void;
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise<Response>((resolve) => (arrive = resolve)),
    );
    const loading = cache.fetchAsset(`${base}learning.glb`);
    await vi.waitFor(() => expect(arrive).toBeDefined());
    cache.releaseUnseen();
    arrive(responseFor(4));
    await loading;
    const handed: UnseenFile[] = [];
    cache.handOverUnseen((file) => handed.push(file));
    expect(handed).toEqual([]);
  });

  it('SW-11 a hand-over that throws is warned about and the load still succeeds', async () => {
    vi.resetModules();
    const cache = await import('./asset-cache.ts');
    const { default: published } = await import('./published-files.ts');
    Object.assign(published, { base: '/neuroatlas/', files: records });
    vi.stubEnv('PROD', true);
    vi.stubGlobal('navigator', { serviceWorker: { controller: null } });
    serve();
    const failure = new DOMException('worker gone', 'InvalidStateError');
    cache.handOverUnseen(() => {
      throw failure;
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(new Uint8Array(await cache.fetchAsset(`${base}learning.glb`))).toEqual(bytesOf(4));
    expect(warn).toHaveBeenCalledWith('Service worker hand-over failed:', failure);
  });
});
