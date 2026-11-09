// Checks the built site in web/dist (after `npm run build --prefix web`, from the repository
// root): the published data, the chunks, the page's head and the service worker's version map.
// BUILD-02 to BUILD-06, BUILD-14 and BUILD-15 in web/docs/testing/rules/boot-and-assets.md. It
// fails if dist/index.html is absent.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { runInNewContext } from 'node:vm';
import { gzipSync } from 'node:zlib';
import { modelLayers } from '../../web/build/meshopt-glb.ts';

const dist = resolve('web/dist');
const published = resolve('public');
const indexPath = resolve(dist, 'index.html');
assert.ok(existsSync(indexPath), `${indexPath} is missing: build the site first`);

// BUILD-03: the site is indexed.
const html = readFileSync(indexPath);
const text = html.toString('utf8');
assert.ok(!text.includes('noindex'), 'the page is not marked noindex');

// BUILD-04: Three.js core and the BVH index are chunks of their own.
const assets = readdirSync(resolve(dist, 'assets'));
const chunkPath = (name) => {
  const matches = assets.filter((file) => new RegExp(`^${name}-[\\w-]+\\.js$`).test(file));
  assert.equal(matches.length, 1, `exactly one ${name} chunk, found ${matches}`);
  return `assets/${matches[0]}`;
};
const chunk = (name) => readFileSync(resolve(dist, chunkPath(name)), 'utf8');
assert.ok(chunk('three').includes('WebGLRenderer'), 'the three chunk holds WebGLRenderer');
assert.ok(chunk('bvh').includes('MeshBVH'), 'the bvh chunk holds MeshBVH');

// BUILD-06: the charset within the first 1024 bytes, the prefetch script ahead of the stylesheet.
assert.ok(
  html.subarray(0, 1024).toString('utf8').includes('<meta charset="UTF-8"'),
  'charset first',
);
const script = text.indexOf('window.__planumAssets');
assert.ok(script > -1, 'the prefetch script is inlined');
assert.ok(script < text.indexOf('rel="stylesheet"'), 'the prefetch script precedes the stylesheet');

// BUILD-07 and BUILD-05: the head map holds models/ versions only.
const head = JSON.parse(text.match(/var versions = (.*);$/m)[1]);
assert.ok(Object.keys(head).length > 0, 'the head map is not empty');
assert.ok(
  Object.keys(head).every((path) => path.startsWith('models/')),
  'the head map is models/ only',
);
assert.ok(!text.includes('__PUBLISHED_VERSIONS__') && !text.includes('__ASSET_BASE__'));

// BUILD-05: sw.js beside the bundle, with {base, files, gunzipped} of published files.
const worker = readFileSync(resolve(dist, 'sw.js'), 'utf8');
assert.ok(worker.includes('planum-models'));
const map = JSON.parse(worker.match(/^const PUBLISHED = (.*);$/m)[1]);
assert.deepEqual(Object.keys(map), ['base', 'files', 'gunzipped']);
assert.equal(map.base, '/');
for (const [path, version] of Object.entries(map.files)) {
  assert.match(version, /^[0-9a-f]{16}$/, path);
  assert.ok(existsSync(resolve(published, path)), `${path} is published`);
  // BUILD-02: the site serves the published data itself.
  assert.ok(existsSync(resolve(dist, path)), `${path} is in the built site`);
}
// Every published file is mapped: the keys equal a directory walk of the published trees.
const walk = (directory) =>
  readdirSync(resolve(published, directory), {
    recursive: true,
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile())
    .map(
      (entry) =>
        `${directory}/${relative(resolve(published, directory), resolve(entry.parentPath, entry.name)).split(sep).join('/')}`,
    );
assert.deepEqual(Object.keys(map.files).sort(), [...walk('models'), ...walk('diffusion')].sort());
// BUILD-14: each version is that of the bytes the site serves: a model layer's meshopt-compressed
// GLB, which a reader without the decoder must refuse, and every other file as published.
const layers = new Set(modelLayers(published));
assert.ok(layers.size > 0, 'the anatomies publish model layers');
for (const [path, version] of Object.entries(map.files)) {
  const served = readFileSync(resolve(dist, path));
  const sha256 = createHash('sha256').update(served).digest('hex');
  assert.equal(sha256.slice(0, 16), version, `${path} is served as its version names`);
  if (layers.has(path)) {
    const gltf = JSON.parse(served.subarray(20, 20 + served.readUInt32LE(12)).toString('utf8'));
    assert.ok(
      gltf.extensionsRequired.includes('EXT_meshopt_compression'),
      `${path} is compressed`,
    );
  } else {
    const original = readFileSync(resolve(published, path));
    assert.ok(served.equals(original), `${path} is served as published`);
  }
}
for (const [path, version] of Object.entries(map.gunzipped)) {
  assert.ok(path.endsWith('.gz'), path);
  assert.match(version, /^[0-9a-f]{16}$/, path);
}
for (const [path, version] of Object.entries(head)) assert.equal(map.files[path], version, path);

// BUILD-15: byte ceilings on a first visit. Raw bytes for the scripts the browser parses before the
// app runs; gzip, as the host serves it, for everything a cold start downloads before the brain.
const CEILINGS = { entry: 1_250_000, three: 760_000, coldStart: 22_600_000 };
const linked = (pattern) => [...text.matchAll(pattern)].map((match) => match[1]);
const entry = linked(/<script type="module" crossorigin src="\/([^"]+)"/g);
assert.equal(entry.length, 1, `one entry script, found ${entry}`);
// The clinical records are a chunk of their own, which the entry requests as it runs.
const clinical = chunkPath('neuropsychology');
assert.ok(
  readFileSync(resolve(dist, entry[0]), 'utf8').includes(clinical.replace('assets/', './')),
  `the entry requests ${clinical}`,
);
// What the head script fetches on a plain visit, read by running it over the built files.
const origin = 'https://planum.invalid';
const prefetched = [];
const page = {
  window: {},
  location: { hash: '', origin },
  URL,
  URLSearchParams,
  WritableStream,
  fetch(url) {
    const path = new URL(url).pathname.slice(1);
    prefetched.push(path);
    return Promise.resolve(new Response(readFileSync(resolve(dist, path))));
  },
};
runInNewContext(text.match(/<script>(window\.__planumAssets[\s\S]*?)<\/script>/)[1], page);
// A request can start once another settles (the index, the cortex): wait until none is added.
for (let known = 0; Object.keys(page.window.__planumAssets).length > known;) {
  known = Object.keys(page.window.__planumAssets).length;
  await Promise.all(Object.values(page.window.__planumAssets));
}
const anatomy = JSON.parse(readFileSync(resolve(dist, 'models/anatomies.json'), 'utf8')).default;
const opened = JSON.parse(readFileSync(resolve(dist, `models/${anatomy}/manifest.json`), 'utf8'));
for (const [layer, entries] of [
  ['cortex', opened.atlases],
  ['detail', opened.detail_levels],
]) {
  assert.ok(
    entries.some(({ file }) => prefetched.includes(`models/${anatomy}/${file}`)),
    `the cold-start set holds a ${layer} GLB of ${anatomy}; the head script fetched ${prefetched}`,
  );
}
const coldStart = [
  ...entry,
  ...linked(/<link rel="modulepreload" crossorigin href="\/([^"]+)"/g),
  ...linked(/<link rel="stylesheet" crossorigin href="\/([^"]+)"/g),
  clinical,
  ...prefetched,
].map((path) => {
  const bytes = readFileSync(resolve(dist, path));
  return { path, raw: bytes.length, gzip: gzipSync(bytes).length };
});
const rawOf = (path) => coldStart.find((file) => file.path === path).raw;
const sizes = {
  entry: rawOf(entry[0]),
  three: rawOf(chunkPath('three')),
  coldStart: coldStart.reduce((sum, file) => sum + file.gzip, 0),
};
console.table(coldStart);
for (const [budget, ceiling] of Object.entries(CEILINGS)) {
  console.log(`${budget}: ${sizes[budget]} bytes (ceiling ${ceiling})`);
  assert.ok(
    sizes[budget] <= ceiling,
    `${budget} is ${sizes[budget]} bytes, over its ${ceiling}-byte ceiling (BUILD-15): move code out ` +
      `of the first visit (a dynamic import) rather than raising it`,
  );
}

console.log(
  `dist ok: ${Object.keys(map.files).length} published files, ${Object.keys(head).length} in the head map`,
);
