import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'vitest';
import { readRepoJson, repoRoot } from '../../../../test/repo.ts';
import { MAX_VOXELS, readNifti } from './nifti.ts';

const FIXTURES = 'web/src/lib/core/user-map/fixtures/';

/** nibabel's `img.shape`, `img.affine` and `get_fdata()` (x fastest) per fixture, from make-fixtures.py. */
const expected = readRepoJson<
  Record<
    string,
    {
      shape: number[];
      affine: number[][];
      intent: number;
      description: string;
      data: (number | null | 'Infinity' | '-Infinity')[];
    }
  >
>(`${FIXTURES}expected.json`);

/** A fixture's bytes, optionally patched through a DataView. */
function fixture(name: string, patch?: (view: DataView) => void): ArrayBuffer {
  const file = readFileSync(resolve(repoRoot, FIXTURES, name));
  const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  patch?.(new DataView(buffer));
  return buffer;
}

/** Within half a float32 step of nibabel's float64, which is all a Float32Array can hold. */
const F32 = 2 ** -24;

async function assertReadsAsNibabel(name: string, buffer = fixture(name)) {
  const volume = await readNifti(buffer);
  const wanted = expected[name]!;
  assert.deepEqual(volume.shape, wanted.shape);
  assert.equal(volume.intent, wanted.intent);
  assert.equal(volume.description, wanted.description);
  assert.deepEqual(
    volume.voxelToWorld.map((row) => row.length),
    [4, 4, 4, 4],
  );
  volume.voxelToWorld.flat().forEach((value, i) => {
    const target = wanted.affine.flat()[i]!;
    assert.ok(Math.abs(value - target) <= F32 * Math.max(1, Math.abs(target)), `affine ${i}`);
  });
  assert.equal(volume.data.length, wanted.data.length);
  wanted.data.forEach((target, i) => {
    const value = volume.data[i]!;
    if (typeof target === 'number') {
      assert.ok(
        Math.abs(value - target) <= F32 * Math.abs(target),
        `voxel ${i}: ${value} ≠ ${target}`,
      );
    } else {
      assert.ok(Number.isNaN(value), `voxel ${i}: ${value}, nibabel ${target}`);
    }
  });
}

test('the sform places a map when its code is set, over a different qform', async () => {
  await assertReadsAsNibabel('float32-sform.nii');
});

test('a qform with a higher code than the sform still loses to it, as in nibabel', async () => {
  await assertReadsAsNibabel('int8-qform-over-sform.nii');
});

test('a big-endian int16 map is scaled and placed by its qform with qfac −1', async () => {
  await assertReadsAsNibabel('int16-be-qform.nii');
});

test('a gzipped mask reads as the file inside it', async () => {
  await assertReadsAsNibabel('uint8-mask.nii.gz');
});

test('float64 NaN and ±Inf read as NaN, from the data offset past an extension', async () => {
  await assertReadsAsNibabel('float64-nonfinite.nii');
});

test('uint16, int32 and big-endian uint32 keep sign and width; a 0 or NaN slope means no scaling', async () => {
  for (const name of ['uint16-slope.nii', 'int32-slope-zero.nii', 'uint32-be-slope-nan.nii']) {
    await assertReadsAsNibabel(name);
  }
});

test('the qform takes the fixes nibabel makes on load, and its quaternion threshold', async () => {
  // qfac 0, pixdims 0 and −3, sform_code 7, and w² just under the threshold.
  await assertReadsAsNibabel('qform-fixups.nii');
});

test('a 4-D file holding one volume reads as 3-D; more volumes are refused with their count', async () => {
  const dims = (...dim: number[]) =>
    fixture('float32-sform.nii', (view) => {
      dim.forEach((n, i) => view.setInt16(40 + 2 * i, n, true));
    });
  await assertReadsAsNibabel('float32-sform.nii', dims(4, 3, 4, 2, 1));
  // nibabel ignores dims past dim[0], so a 3-D file may leave them 0 or stale.
  await assertReadsAsNibabel('float32-sform.nii', dims(3, 3, 4, 2, 0, 5));
  await assert.rejects(readNifti(dims(4, 3, 4, 2, 3)), /holds 3 volumes/);
  await assert.rejects(readNifti(dims(5, 3, 4, 2, 1, 2)), /holds 2 volumes/);
  await assert.rejects(readNifti(dims(2, 3, 4)), /not a 3-D volume/);
  await assert.rejects(readNifti(dims(3, 3, 0, 2)), /empty axis/);
});

test('a grid over MAX_VOXELS is refused by its size; one at the limit is not', async () => {
  const grid = (z: number) =>
    fixture('float32-sform.nii', (view) => {
      [512, 512, z].forEach((n, i) => view.setInt16(42 + 2 * i, n, true));
    });
  assert.equal(512 * 512 * 128, MAX_VOXELS);
  await assert.rejects(readNifti(grid(129)), /512 × 512 × 129 voxels, over the limit/);
  await assert.rejects(readNifti(grid(128)), /truncated/);
});

test('files that are not single-file NIfTI-1 are refused, each for its reason', async () => {
  const sizeofHdr = (little: boolean) =>
    fixture('float32-sform.nii', (view) => view.setInt32(0, 540, little));
  await assert.rejects(readNifti(sizeofHdr(true)), /NIfTI-2/);
  await assert.rejects(readNifti(sizeofHdr(false)), /NIfTI-2/);
  const magic = (text: string) =>
    fixture('float32-sform.nii', (view) => {
      [...text].forEach((char, i) => view.setUint8(344 + i, char.charCodeAt(0)));
    });
  await assert.rejects(readNifti(magic('ni1\0')), /\.hdr\/\.img pair/);
  await assert.rejects(readNifti(magic('n+2\0')), /no NIfTI magic/);
  await assert.rejects(
    readNifti(fixture('float32-sform.nii').slice(0, 300)),
    /inside its NIfTI header/,
  );
  await assert.rejects(
    readNifti(new TextEncoder().encode('not an image').buffer),
    /not a NIfTI image/,
  );
});

test('a map without a usable orientation is refused', async () => {
  const sform = (patch: (view: DataView) => void) => readNifti(fixture('float32-sform.nii', patch));
  await assert.rejects(
    sform((view) => [252, 254].forEach((offset) => view.setInt16(offset, 0, true))),
    /states no orientation/,
  );
  await assert.rejects(
    sform((view) => view.setFloat32(280, NaN, true)),
    /non-finite entry/,
  );
  await assert.rejects(
    sform((view) => [312, 316, 320].forEach((offset) => view.setFloat32(offset, 0, true))),
    /singular/,
  );
  const quaternion = fixture('int16-be-qform.nii', (view) => {
    [256, 260, 264].forEach((offset) => view.setFloat32(offset, 0.9, false));
  });
  await assert.rejects(readNifti(quaternion), /quaternion is not a rotation/);
});

test('data that cannot be read as stored, or shown as float32, is refused', async () => {
  const header = (patch: (view: DataView) => void) =>
    readNifti(fixture('float32-sform.nii', patch));
  await assert.rejects(
    header((view) => view.setInt16(70, 128, true)),
    /RGB24 values \(data type 128\)/,
  );
  await assert.rejects(
    header((view) => view.setInt16(70, 3, true)),
    /code 3 is not a NIfTI-1 type/,
  );
  await assert.rejects(
    header((view) => view.setFloat32(108, 348, true)),
    /vox_offset 348/,
  );
  const whole = fixture('float32-sform.nii');
  await assert.rejects(readNifti(whole.slice(0, whole.byteLength - 1)), /truncated/);
  const gzip = fixture('uint8-mask.nii.gz');
  await assert.rejects(readNifti(gzip.slice(0, gzip.byteLength - 20)), /could not be decompressed/);
  const nanIntercept = fixture('int16-be-qform.nii', (view) => view.setFloat32(116, NaN, false));
  await assert.rejects(readNifti(nanIntercept), /scl_inter\) is NaN/);
  const huge = fixture('float64-nonfinite.nii', (view) => {
    view.setFloat64(view.getFloat32(108, true), 1e300, true);
  });
  await assert.rejects(readNifti(huge), /1e\+300, beyond the float32 range/);
});
