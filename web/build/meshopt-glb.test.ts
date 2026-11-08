import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';
import type { BufferAttribute, Mesh, Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { compressGlb, modelLayers } from './meshopt-glb.ts';

const publicDirectory = fileURLToPath(new URL('../../public/', import.meta.url));
const published = (path: string) => new Uint8Array(readFileSync(resolve(publicDirectory, path)));
const parse = (bytes: Uint8Array, loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)) =>
  loader.parseAsync(bytes.slice().buffer, '');

function meshes(scene: Object3D): Mesh[] {
  const found: Mesh[] = [];
  scene.traverse((object) => {
    if ((object as Mesh).isMesh) found.push(object as Mesh);
  });
  return found;
}

/** Type, layout and every byte of an attribute or index. */
function exactly(attribute: BufferAttribute) {
  const { array, itemSize, normalized, count } = attribute;
  const bytes = Buffer.from(array.buffer, array.byteOffset, array.byteLength).toString('base64');
  return { type: array.constructor.name, itemSize, normalized, count, bytes };
}

// A cortical atlas carries every attribute kind the layers publish; the envelopes share one index
// accessor between each hemisphere's pial and white surfaces.
test.each(['models/cdmd/cortex-destrieux.glb', 'models/cdmd/tissue-envelopes.glb'])(
  'BUILD-14 %s, as the site serves it, loads into the published geometry',
  { timeout: 60_000 },
  async (path) => {
    const source = published(path);
    const served = await compressGlb(source);
    assert.ok(served.byteLength < source.byteLength);
    const [before, after] = await Promise.all([parse(source), parse(served)]);
    const [expected, actual] = [meshes(before.scene), meshes(after.scene)];
    assert.equal(actual.length, expected.length);
    expected.forEach((mesh, at) => {
      const other = actual[at]!;
      assert.equal(other.name, mesh.name);
      assert.deepEqual(other.userData, mesh.userData);
      assert.deepEqual(other.matrixWorld.elements, mesh.matrixWorld.elements);
      // Decoded positions arrive last, so they are added last; attributes are bound by name.
      const names = Object.keys(mesh.geometry.attributes).sort();
      assert.deepEqual(Object.keys(other.geometry.attributes).sort(), names);
      for (const name of names) {
        assert.deepEqual(
          exactly(other.geometry.getAttribute(name) as BufferAttribute),
          exactly(mesh.geometry.getAttribute(name) as BufferAttribute),
          `${mesh.name} ${name}`,
        );
      }
      assert.deepEqual(exactly(other.geometry.index!), exactly(mesh.geometry.index!), mesh.name);
    });
    // A reader without the decoder refuses the file rather than reading the empty fallback.
    await assert.rejects(parse(served, new GLTFLoader()), /setMeshoptDecoder/);
  },
);

test('BUILD-14 every published GLB is either a model layer or comparison geometry, never both', () => {
  const directory = resolve(publicDirectory, 'models/cdmd');
  const files = readdirSync(directory);
  const comparison = files
    .filter((file) => /^atlas-comparison.*\.json$/.test(file))
    .map(
      (file) =>
        JSON.parse(readFileSync(resolve(directory, file), 'utf8')) as {
          geometry: { file: string };
        },
    )
    .map(({ geometry }) => `models/cdmd/${geometry.file}`);
  const layers = modelLayers(publicDirectory);
  assert.ok(layers.includes('models/cdmd/learning.glb'));
  assert.ok(comparison.every((path) => !layers.includes(path)));
  assert.deepEqual(
    [...layers, ...comparison].sort(),
    files.filter((file) => file.endsWith('.glb')).map((file) => `models/cdmd/${file}`),
  );
});
