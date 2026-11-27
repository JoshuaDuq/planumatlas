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
const BUNDLES: Record<string, number> = { 'cdmd-sub-013': 35, 'mni152-hcp1065': 23 };
const digest = (buffer: Uint8Array) => createHash('sha256').update(buffer).digest('hex');
const arrayBuffer = (buffer: Uint8Array) =>
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
const bytesOf = (array: ArrayBufferView) =>
  new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
const published = (file: string) => readFile(resolve(repoRoot, directory, file));

function near(actual: number, expected: number, tolerance = 0.0001) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
}

/** The datatypes the T1 and its source are stored in: NIFTI_TYPE_INT16 and _FLOAT64. */
const VOXELS = { 4: Int16Array, 64: Float64Array } as const;

/**
 * An inflated NIfTI-1 file's grid and scaling, read at the standard's header offsets, and its voxels
 * as a view from `vox_offset`.
 */
function nifti1(bytes: Uint8Array<ArrayBuffer>) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(view.getInt32(0, true), 348, 'a little-endian NIfTI-1 header');
  const int16s = (offset: number, count: number) =>
    Array.from({ length: count }, (_, i) => view.getInt16(offset + 2 * i, true));
  const float32s = (offset: number, count: number) =>
    Array.from({ length: count }, (_, i) => view.getFloat32(offset + 4 * i, true));
  const dims = int16s(40, 8);
  const datatype = view.getInt16(70, true);
  const Voxels = VOXELS[datatype as keyof typeof VOXELS];
  assert.ok(Voxels, `datatype ${datatype}`);
  return {
    dims,
    pixDims: float32s(76, 8),
    qform_code: view.getInt16(252, true),
    sform_code: view.getInt16(254, true),
    /** quatern_b, _c, _d, then qoffset_x, _y, _z. */
    quaternion: float32s(256, 6),
    /** srow_x, _y, _z. */
    srow: float32s(280, 12),
    datatype,
    scl_slope: view.getFloat32(112, true),
    scl_inter: view.getFloat32(116, true),
    voxels: new Voxels(
      bytes.buffer,
      bytes.byteOffset + view.getFloat32(108, true),
      dims[1]! * dims[2]! * dims[3]!,
    ),
  };
}

for (const { catalog, provenance } of catalogs) {
  test.each(catalog.maps.map((map) => [map.file, map] as const))(
    `${catalog.id}: DIFF-13 scalar map %s is its source or a display-precision derivative on the source's grid`,
    async (_file, map) => {
      const record = provenance.files.find((file) => map.file.endsWith(`/${file.file}`))!;
      const data = await published(map.file);
      // NiiVue inflates through a web stream, a slice at a time: on a loaded machine the T1's float64
      // source took over 30 s that way. Node's zlib, the inflater under that stream, does it at once.
      const inflated = gunzipSync(data);
      const image = await NVImage.loadFromUrl({
        url: arrayBuffer(inflated),
        name: map.file.replace(/\.gz$/, ''),
      });
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
      // Both files are compared as their bytes hold them; NiiVue's reading of the derivative is
      // held to its bytes.
      const [derivative, source] = [nifti1(inflated), nifti1(gunzipSync(sourceData))];
      for (const key of [
        'dims',
        'pixDims',
        'qform_code',
        'sform_code',
        'quaternion',
        'srow',
      ] as const) {
        assert.deepEqual(derivative[key], source[key], key);
      }
      assert.equal(derivative.datatype, 4);
      assert.equal(derivative.scl_slope, record.quantisation.scl_slope);
      assert.equal(derivative.scl_inter, record.quantisation.scl_inter);
      assert.equal(source.datatype, 64);
      assert.deepEqual([source.scl_slope, source.scl_inter], [1, 0], 'the source is unscaled');
      const niivue = image.hdr!;
      assert.deepEqual(
        [niivue.datatypeCode, niivue.scl_slope, niivue.scl_inter],
        [derivative.datatype, derivative.scl_slope, derivative.scl_inter],
      );
      assert.equal(Buffer.compare(bytesOf(image.img!), bytesOf(derivative.voxels)), 0);
      const bound = record.quantisation.max_abs_error;
      assert.ok(bound <= derivative.scl_slope / 2 + 1e-9);
      const [values, expected] = [derivative.voxels, source.voxels];
      let worst = 0;
      for (let index = 0; index < expected.length; index++) {
        const value = values[index]! * derivative.scl_slope + derivative.scl_inter;
        worst = Math.max(worst, Math.abs(value - expected[index]!));
      }
      // NiBabel's float64 arithmetic on the float64 source, so the recorded bound holds exactly.
      assert.ok(worst <= bound, `${worst} exceeds ${bound}`);
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
