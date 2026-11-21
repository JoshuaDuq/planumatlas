import { EventEmitter } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { Plugin } from 'vite';
import { FIXTURE_FILES, FIXTURE_GZ } from './published-fixture.ts';
import { headVersions, publishedAssets, workerVersions } from './published-files.ts';
import { ASSET_BASE } from './site.ts';

// The unit files share one module cache (isolate: false): import this file's modules afresh under its
// mock, and leave none built on it to the next file.
vi.hoisted(() => vi.resetModules());
afterAll(() => {
  vi.resetModules();
});

// The plugin hashes `public/`; here it hashes the small fixture tree instead, once it has checked
// that it was asked for the real one.
const fixture = await vi.hoisted(async () => {
  const { createPublishedFixture } = await import('./published-fixture.ts');
  return createPublishedFixture();
});
afterAll(() => rmSync(fixture, { recursive: true, force: true }));
vi.mock('../../scripts/published-version.mjs', async (importActual) => {
  const actual = await importActual<typeof import('../../scripts/published-version.mjs')>();
  const published = fileURLToPath(new URL('../../public', import.meta.url));
  return {
    ...actual,
    publishedFiles: (directory: string) => {
      expect(directory).toBe(published);
      return actual.publishedFiles(fixture);
    },
    publishedRecord: (directory: string, path: string) => {
      expect(directory).toBe(published);
      return actual.publishedRecord(fixture, path);
    },
  };
});

const webRoot = fileURLToPath(new URL('../', import.meta.url));
const publicDirectory = resolve(webRoot, '../public');
const publishedModule = resolve(webRoot, 'src/lib/core/assets/published-files.ts');
const elsewhereModule = resolve(webRoot, 'src/lib/core/assets/published-elsewhere.ts');

/** A plugin hook, whether written as a function or as `{ handler }`. */
function hook(plugin: Plugin, name: keyof Plugin): (...args: unknown[]) => unknown {
  const entry = plugin[name] as unknown;
  const fn = typeof entry === 'function' ? entry : (entry as { handler: unknown }).handler;
  return (fn as (...args: unknown[]) => unknown).bind({});
}

const FILE_VERSIONS = {
  'diffusion/snail/tract.trk.gz': FIXTURE_GZ.version,
  'models/anatomies.json': FIXTURE_FILES['models/anatomies.json'].version,
  'models/bert/cortex-destrieux.glb': FIXTURE_FILES['models/bert/cortex-destrieux.glb'].version,
  'models/bert/manifest.json': FIXTURE_FILES['models/bert/manifest.json'].version,
};

describe('the version maps the build writes', () => {
  const written = mkdtempSync(resolve(tmpdir(), 'planum-sw-'));
  afterAll(() => rmSync(written, { recursive: true, force: true }));

  it('BUILD-05 gives the service worker every file at the first 16 hex of its SHA-256, and each .gz by its contents', async () => {
    const plugin = publishedAssets();
    hook(plugin, 'configResolved')({ root: written, command: 'build', build: { outDir: '.' } });
    await hook(plugin, 'closeBundle')();
    const worker = readFileSync(resolve(written, 'sw.js'), 'utf8');
    const map = JSON.parse(worker.match(/^const PUBLISHED = (.*);$/m)![1]!);
    expect(Object.keys(map)).toEqual(['base', 'files', 'gunzipped']);
    expect(map).toEqual({
      base: '/',
      files: FILE_VERSIONS,
      gunzipped: { [FIXTURE_GZ.path]: FIXTURE_GZ.contentsVersion },
    });
    expect(worker).toContain('planum-models');
  });

  it('BUILD-05 gives the head script the models/ files only', () => {
    const plugin = publishedAssets();
    const [tag] = hook(plugin, 'transformIndexHtml')('') as { children: string }[];
    const head = JSON.parse(tag!.children.match(/var versions = (.*);$/m)![1]!);
    expect(head).toEqual({
      'models/anatomies.json': 'c24aea467c0bc797',
      'models/bert/cortex-destrieux.glb': '034abd800e367720',
      'models/bert/manifest.json': 'b96049c398b69d08',
    });
  });

  it('BUILD-05 workerVersions and headVersions keep a record without contents out of gunzipped', () => {
    const published = {
      'models/a.glb': { version: '0123456789abcdef', sha256: '', size: 1 },
      'diffusion/b.trk.gz': {
        version: 'fedcba9876543210',
        sha256: '',
        size: 1,
        gunzipped: { sha256: 'aaaaaaaaaaaaaaaa00', size: 2 },
      },
    };
    expect(workerVersions(published)).toEqual({
      base: '/',
      files: { 'models/a.glb': '0123456789abcdef', 'diffusion/b.trk.gz': 'fedcba9876543210' },
      gunzipped: { 'diffusion/b.trk.gz': 'aaaaaaaaaaaaaaaa' },
    });
    expect(headVersions(published)).toEqual({ 'models/a.glb': '0123456789abcdef' });
  });
});

describe('the build config', () => {
  it('BUILD-09 declares lang="en" and the title "Planum"', () => {
    const html = readFileSync(resolve(webRoot, 'index.html'), 'utf8');
    expect(html).toMatch(/<html lang="en">/);
    expect(html).toMatch(/<title>Planum<\/title>/);
  });
});

describe('the head script the build injects', () => {
  it('BUILD-07 is one inline script in head, with the published root and versions written in', () => {
    const tags = hook(publishedAssets(), 'transformIndexHtml')('') as {
      tag: string;
      injectTo: string;
      children: string;
    }[];
    expect(tags).toHaveLength(1);
    expect(tags[0]).toMatchObject({ tag: 'script', injectTo: 'head' });
    expect(tags[0]!.children).not.toMatch(/__PUBLISHED_VERSIONS__|__ASSET_BASE__/);
    expect(tags[0]!.children).toContain('var root = "/";');
    expect(tags[0]!.children).toContain('"models/anatomies.json":"c24aea467c0bc797"');
  });

  it('BUILD-01 serves assets from /', () => {
    expect(ASSET_BASE).toBe('/');
  });
});

describe('the dev server watcher', () => {
  function startServer() {
    const watcher = Object.assign(new EventEmitter(), { add: vi.fn() });
    const module = {};
    const server = {
      watcher,
      ws: { send: vi.fn() },
      moduleGraph: { getModuleById: vi.fn(() => module), invalidateModule: vi.fn() },
    };
    const plugin = publishedAssets();
    hook(plugin, 'configureServer')(server);
    return { plugin, server, module };
  }
  const loadedFiles = (plugin: Plugin) =>
    JSON.parse(
      (hook(plugin, 'load')(publishedModule) as string).replace(/^export default |;$/g, ''),
    ).files as Record<string, unknown>;

  it('BUILD-16 gives the entry the default anatomy and leaves another anatomy to its own chunk', () => {
    // The published index lists mni152 beside the default; its files stay off the first visit.
    const path = 'models/mni152/manifest.json';
    mkdirSync(resolve(fixture, 'models/mni152'), { recursive: true });
    writeFileSync(resolve(fixture, path), '{"atlases":[]}');
    try {
      const { plugin, server } = startServer();
      server.watcher.emit('all', 'add', resolve(publicDirectory, path));
      const elsewhere = JSON.parse(
        (hook(plugin, 'load')(elsewhereModule) as string).replace(/^export default |;$/g, ''),
      ) as Record<string, unknown>;
      expect(Object.keys(elsewhere)).toEqual([path]);
      expect(elsewhere[path]).not.toHaveProperty('version');
      expect(loadedFiles(plugin)).not.toHaveProperty(path);
      expect(loadedFiles(plugin)).toHaveProperty('models/bert/manifest.json');
    } finally {
      rmSync(resolve(fixture, 'models/mni152'), { recursive: true, force: true });
    }
  });

  it('BUILD-08 watches the published trees, which lie outside the app root', () => {
    const { server } = startServer();
    expect(server.watcher.add).toHaveBeenCalledWith([
      resolve(publicDirectory, 'models'),
      resolve(publicDirectory, 'diffusion'),
    ]);
  });

  it('BUILD-08 sends a full reload and updates the map on add, change and unlink', () => {
    const { plugin, server, module } = startServer();
    const file = resolve(publicDirectory, 'models/anatomies.json');
    server.watcher.emit('all', 'change', file);
    expect(server.ws.send).toHaveBeenLastCalledWith({ type: 'full-reload' });
    expect(server.moduleGraph.invalidateModule).toHaveBeenLastCalledWith(module);
    // The app's map carries no version: it is the sha256's first 16 digits.
    const record = loadedFiles(plugin)['models/anatomies.json'] as Record<string, unknown>;
    expect(record).not.toHaveProperty('version');
    expect(record['sha256']).toMatch(/^c24aea467c0bc797/);

    server.watcher.emit('all', 'unlink', file);
    expect(server.ws.send).toHaveBeenCalledTimes(2);
    expect(loadedFiles(plugin)['models/anatomies.json']).toBeUndefined();

    server.watcher.emit('all', 'add', file);
    expect(server.ws.send).toHaveBeenCalledTimes(3);
    expect(loadedFiles(plugin)['models/anatomies.json']).toBeDefined();
  });

  it('BUILD-08 ignores other events and files outside the published trees', () => {
    const { server } = startServer();
    server.watcher.emit('all', 'addDir', resolve(publicDirectory, 'models'));
    server.watcher.emit('all', 'change', resolve(publicDirectory, 'robots.txt'));
    expect(server.ws.send).not.toHaveBeenCalled();
  });
});
