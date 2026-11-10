import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { NVImage, NVMeshLoaders } from '@niivue/niivue';
import { Vector3 } from 'three';
import { test } from 'vitest';
import type { TractCatalog } from '../../core/diffusion/catalogs.ts';
import { validateVolume } from '../../core/diffusion/validation.ts';
import type { DiffusionVolume } from '../../core/diffusion/validation.ts';
import { readRepoJson, readRepoYaml, repoRoot } from '../../../../test/repo.ts';
import { RAS_MM_TO_WORLD } from './native-geometry.ts';
import { streamlineLengths, summarizeLengths } from './streamlines.ts';

interface FileRecord {
  file: string;
  source_sha256: string;
  published_sha256: string;
  resampled_sha256?: string;
  quantisation?: { scl_slope: number; scl_inter: number; max_abs_error: number };
  shape: number[];
  affine: number[][];
  points: number;
  streamlines: number;
  rasmm_samples: { index: number; position: number[] }[];
  length_summaries: Record<string, number | null>[];
}
interface Provenance {
  files: FileRecord[];
}
interface OutlineProvenance {
  source: string;
  source_sha256: string;
  published_sha256: string;
  source_affine?: number[][];
  intensity_threshold: number;
  step_size_voxels: number;
  limitations: string;
  vertices: number;
  triangles: number;
  ras_bounds_mm: [number[], number[]];
}
type Catalog = TractCatalog & {
  brain_outline: TractCatalog['brain_outline'] & { source_map?: boolean };
};

const directory = 'public/diffusion/';
const { tract_catalogs: paths } = readRepoYaml<{ tract_catalogs: string[] }>('config/model.yaml');
const catalogs = paths.map((path) => {
  const catalog = readRepoYaml<Catalog>(path);
  return {
    catalog,
    provenance: readRepoJson<Provenance>(`${directory}${catalog.provenance}`),
  };
});
// The published T1 is a derivative of the reconstruction's pinned input.
const T1_SOURCE = readRepoYaml<{
  anatomies: Record<string, { reconstruction: { input: string } }>;
}>('config/model.yaml').anatomies.cdmd!.reconstruction.input;
const BUNDLES: Record<string, number> = { 'cdmd-sub-013': 30 };
const digest = (buffer: Uint8Array) => createHash('sha256').update(buffer).digest('hex');
const arrayBuffer = (buffer: Uint8Array) =>
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
const published = (file: string) => readFile(resolve(repoRoot, directory, file));

function near(actual: number, expected: number, tolerance = 0.0001) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
}

for (const { catalog, provenance } of catalogs) {
  test.each(catalog.maps.map((map) => [map.file, map] as const))(
    `${catalog.id}: DIFF-13 scalar map %s is its source or a display-precision derivative on the source's grid`,
    async (_file, map) => {
      const record = provenance.files.find((file) => map.file.endsWith(`/${file.file}`))!;
      const data = await published(map.file);
      const image = await NVImage.loadFromUrl({ url: arrayBuffer(data), name: map.file });
      validateVolume(image as DiffusionVolume);
      assert.deepEqual(image.hdr!.dims.slice(1, 4), record.shape);
      for (let row = 0; row < 4; row++) {
        for (let column = 0; column < 4; column++) {
          near(image.hdr!.affine[row]![column]!, record.affine[row]![column]!);
        }
      }
      if (!record.quantisation) {
        assert.equal(digest(data), record.source_sha256);
        return;
      }
      assert.equal(digest(data), record.published_sha256);
      const sourceData = await readFile(resolve(repoRoot, T1_SOURCE));
      assert.equal(digest(sourceData), record.source_sha256);
      const source = await NVImage.loadFromUrl({ url: arrayBuffer(sourceData), name: T1_SOURCE });
      const [header, original] = [image.hdr!, source.hdr!];
      for (const key of ['dims', 'pixDims', 'affine', 'qform_code', 'sform_code'] as const) {
        assert.deepEqual(header[key], original[key], key);
      }
      for (const key of [
        'quatern_b',
        'quatern_c',
        'quatern_d',
        'qoffset_x',
        'qoffset_y',
        'qoffset_z',
      ] as const) {
        assert.equal(header[key], original[key], key);
      }
      assert.equal(header.datatypeCode, 4);
      assert.equal(header.scl_slope, record.quantisation.scl_slope);
      assert.equal(header.scl_inter, record.quantisation.scl_inter);
      // NiiVue holds the float64 source as float32, so its rounding is added to the bound.
      const bound = record.quantisation.max_abs_error;
      assert.ok(bound <= header.scl_slope / 2 + 1e-9);
      const [values, expected] = [image.img!, source.img!];
      let worst = 0;
      for (let index = 0; index < expected.length; index++) {
        const value = values[index]! * header.scl_slope + header.scl_inter;
        worst = Math.max(worst, Math.abs(value - expected[index]!));
      }
      assert.ok(worst <= bound + 3e-5, `${worst} exceeds ${bound}`);
    },
  );

  test(`${catalog.id}: the catalogue names ${BUNDLES[catalog.id]} distinct bundles`, () => {
    assert.equal(catalog.bundles.length, BUNDLES[catalog.id]);
    assert.equal(new Set(catalog.bundles.map((bundle) => bundle.id)).size, catalog.bundles.length);
  });

  test.each(catalog.bundles.map((bundle) => [bundle.id, bundle] as const))(
    `${catalog.id}: DIFF-14 bundle %s decodes in the NiBabel RAS+ space with matching geometry and lengths (DIFF-06, DIFF-15)`,
    async (_id, bundle) => {
      const record = provenance.files.find((file) => bundle.file.endsWith(`/${file.file}`));
      assert.ok(record, `Missing provenance for ${bundle.id}`);
      const compressed = await published(bundle.file);
      assert.equal(digest(compressed), record.published_sha256);
      const original = gunzipSync(compressed);
      // Packaged losslessly, a file decompresses to its source; resampled, to its resampled TRK.
      assert.equal(digest(original), record.resampled_sha256 ?? record.source_sha256);
      const mesh = await NVMeshLoaders.readTRK(arrayBuffer(original));
      assert.equal(mesh.pts.length / 3, record.points);
      assert.equal(mesh.offsetPt0.length - 1, record.streamlines);
      for (const sample of record.rasmm_samples) {
        for (let axis = 0; axis < 3; axis++) {
          near(mesh.pts[sample.index * 3 + axis]!, sample.position[axis]!);
        }
        // The lines draw these points themselves, with RAS_MM_TO_WORLD as their matrix.
        const world = new Vector3(
          ...(mesh.pts.subarray(sample.index * 3, sample.index * 3 + 3) as unknown as [
            number,
            number,
            number,
          ]),
        ).applyMatrix4(RAS_MM_TO_WORLD);
        near(world.x * 1000, sample.position[0]!, 0.001);
        near(-world.z * 1000, sample.position[1]!, 0.001);
        near(world.y * 1000, sample.position[2]!, 0.001);
      }
      const lengths = streamlineLengths(mesh.pts, mesh.offsetPt0);
      for (const expected of record.length_summaries) {
        const actual = summarizeLengths(lengths, expected.minimum_mm!);
        assert.equal(actual.shown, expected.shown, bundle.id);
        for (const statistic of ['mean', 'min', 'max'] as const) {
          const value = expected[`${statistic}_mm`];
          if (value === null) assert.equal(actual[statistic], null);
          else near(actual[statistic]!, value!, 0.001);
        }
      }
    },
  );

  test(`${catalog.id}: DIFF-16 the MRI outline belongs to the tract reference and has explicit processing provenance`, async () => {
    const settings = catalog.brain_outline;
    const outline = readRepoJson<OutlineProvenance>(`${directory}${settings.provenance}`);
    // A skull-stripped map is outlined on its own grid; otherwise the catalog names
    // a skull-stripped volume in the same scanner frame.
    const source = settings.source_map
      ? await published(outline.source)
      : await readFile(resolve(repoRoot, settings.source));
    const file = await published(settings.file);
    assert.equal(digest(source), outline.source_sha256);
    assert.equal(digest(file), outline.published_sha256);
    if (settings.source_map) assert.deepEqual(outline.source_affine, provenance.files[0]!.affine);
    else assert.equal(outline.source, settings.source);
    assert.equal(outline.intensity_threshold, settings.intensity_threshold);
    assert.equal(outline.step_size_voxels, settings.step_size);
    assert.match(outline.limitations, /not a pial or labeled/);
    assert.equal(file.readUInt32LE(0), 0x46546c67);
    assert.equal(file.readUInt32LE(4), 2);
    assert.equal(file.readUInt32LE(8), file.length);
    const length = file.readUInt32LE(12);
    const gltf = JSON.parse(file.subarray(20, 20 + length).toString()) as {
      meshes: { primitives: { attributes: { POSITION: number }; indices: number }[] }[];
      accessors: { count: number; min: number[]; max: number[] }[];
    };
    const primitive = gltf.meshes[0]!.primitives[0]!;
    const position = gltf.accessors[primitive.attributes.POSITION]!;
    assert.equal(position.count, outline.vertices);
    assert.equal(gltf.accessors[primitive.indices]!.count, outline.triangles * 3);
    const [minimum, maximum] = outline.ras_bounds_mm as [
      [number, number, number],
      [number, number, number],
    ];
    const expectedMinimum = [minimum[0], minimum[2], -maximum[1]].map((value) => value / 1000);
    const expectedMaximum = [maximum[0], maximum[2], -minimum[1]].map((value) => value / 1000);
    for (let axis = 0; axis < 3; axis++) {
      assert.ok(Math.abs(position.min[axis]! - expectedMinimum[axis]!) < 1e-7);
      assert.ok(Math.abs(position.max[axis]! - expectedMaximum[axis]!) < 1e-7);
    }
  });
}
