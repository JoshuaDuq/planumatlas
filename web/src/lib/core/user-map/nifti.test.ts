import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, test, vi } from 'vitest';
import { readRepoJson, repoRoot } from '../../../../test/repo.ts';
import { MAX_FILE_BYTES, MAX_VALUES, MAX_VOXELS, readMapFile, readNifti } from './nifti.ts';

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
  const image = await readNifti(buffer);
  const wanted = expected[name]!;
  assert.deepEqual(image.shape, wanted.shape);
  assert.equal(image.intent, wanted.intent);
  assert.equal(image.description, wanted.description);
  assert.equal(image.secondsPerVolume, null);
  assert.deepEqual(
    image.voxelToWorld.map((row) => row.length),
    [4, 4, 4, 4],
  );
  image.voxelToWorld.flat().forEach((value, i) => {
    const target = wanted.affine.flat()[i]!;
    assert.ok(Math.abs(value - target) <= F32 * Math.max(1, Math.abs(target)), `affine ${i}`);
  });
  assert.equal(image.volumes.length, 1);
  const data = image.volumes[0]!;
  assert.equal(data.length, wanted.data.length);
  wanted.data.forEach((target, i) => {
    const value = data[i]!;
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

test('a 4-D file holding one volume reads as 3-D; axes past the fourth are refused', async () => {
  const dims = (...dim: number[]) =>
    fixture('float32-sform.nii', (view) => {
      dim.forEach((n, i) => view.setInt16(40 + 2 * i, n, true));
    });
  await assertReadsAsNibabel('float32-sform.nii', dims(4, 3, 4, 2, 1));
  // nibabel ignores dims past dim[0], so a 3-D file may leave them 0 or stale.
  await assertReadsAsNibabel('float32-sform.nii', dims(3, 3, 4, 2, 0, 5));
  await assert.rejects(readNifti(dims(4, 3, 4, 2, 3)), /truncated/);
  await assert.rejects(readNifti(dims(5, 3, 4, 2, 1, 2)), /dimensions are 3 × 4 × 2 × 1 × 2/);
  await assert.rejects(readNifti(dims(2, 3, 4)), /neither a 3-D volume nor a series/);
  await assert.rejects(readNifti(dims(3, 3, 0, 2)), /empty axis/);
});

/** float32-sform.nii as a series of `count` volumes, volume n holding its values plus n. */
function series(count: number, units: number, spacing: number): ArrayBuffer {
  const file = fixture('float32-sform.nii');
  const view = new DataView(file);
  const offset = view.getFloat32(108, true);
  const voxels = (file.byteLength - offset) / 4;
  const out = new ArrayBuffer(offset + 4 * voxels * count);
  new Uint8Array(out).set(new Uint8Array(file, 0, offset));
  const target = new DataView(out);
  for (let n = 0; n < count; n++) {
    for (let i = 0; i < voxels; i++) {
      target.setFloat32(
        offset + 4 * (n * voxels + i),
        view.getFloat32(offset + 4 * i, true) + n,
        true,
      );
    }
  }
  target.setInt16(40, 4, true);
  target.setInt16(48, count, true);
  target.setUint8(123, units);
  target.setFloat32(92, spacing, true);
  return out;
}

test('a series reads each volume in the file’s order, and its spacing in seconds from the time unit', async () => {
  const base = (await readNifti(fixture('float32-sform.nii'))).volumes[0]!;
  // NIFTI_UNITS_MM | NIFTI_UNITS_SEC: fMRIPrep's BOLD header.
  const image = await readNifti(series(3, 2 | 8, 2));
  assert.equal(image.volumes.length, 3);
  image.volumes.forEach((volume, n) => {
    assert.deepEqual(
      Array.from(volume, (value) => (Number.isNaN(value) ? null : value)),
      Array.from(base, (value) => (Number.isNaN(value) ? null : Math.fround(value + n))),
    );
  });
  assert.equal(image.secondsPerVolume, 2);
  assert.equal((await readNifti(series(3, 2 | 16, 720))).secondsPerVolume, 0.72);
  // nibabel's own header and concat_imgs leave the unit unknown: no time is guessed.
  assert.equal((await readNifti(series(3, 2, 1))).secondsPerVolume, null);
  assert.equal((await readNifti(series(3, 2 | 8, 0))).secondsPerVolume, null);
});

test('a volume over MAX_VOXELS, or a series over MAX_VALUES, is refused by its size', async () => {
  const grid = (z: number, volumes = 1) =>
    fixture('float32-sform.nii', (view) => {
      [4, 512, 512, z, volumes].forEach((n, i) => view.setInt16(40 + 2 * i, n, true));
    });
  assert.equal(512 * 512 * 128, MAX_VOXELS);
  assert.equal(2 * MAX_VOXELS, MAX_VALUES);
  await assert.rejects(readNifti(grid(129)), /512 × 512 × 129 voxels, over the limit/);
  await assert.rejects(readNifti(grid(128, 3)), /holds 3 volumes; up to 2 of its size/);
  await assert.rejects(readNifti(grid(128, 2)), /truncated/);
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

const gzip = (buffer: ArrayBuffer) => {
  const bytes = gzipSync(new Uint8Array(buffer));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
};

const Inflater = DecompressionStream;
afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * DecompressionStream as the reader meets it, its output cut into chunks of at most `size` bytes;
 * `bytes` counts what has been pulled from it.
 */
function inflatedIn(size: number): { bytes: number } {
  const pulled = { bytes: 0 };
  vi.stubGlobal(
    'DecompressionStream',
    class {
      readonly writable: WritableStream<BufferSource>;
      readonly readable: ReadableStream<Uint8Array>;
      constructor(format: CompressionFormat) {
        const inner = new Inflater(format);
        this.writable = inner.writable;
        this.readable = inner.readable.pipeThrough(
          new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, controller) {
              pulled.bytes += chunk.length;
              for (let at = 0; at < chunk.length; at += size) {
                controller.enqueue(chunk.subarray(at, at + size));
              }
            },
          }),
        );
      }
    },
  );
  return pulled;
}

/** Every fixture file, by name: expected.json also records the nibabel version. */
const FIXTURE_NAMES = Object.keys(expected).filter((name) => name.includes('.nii'));

test('FUNC-55 · a file larger than any map file can be is refused before it is read', async () => {
  // The 352 bytes before the earliest data, 16 MiB for extensions and MAX_VALUES float64 values.
  assert.equal(MAX_FILE_BYTES, 352 + 16 * 2 ** 20 + 8 * MAX_VALUES);
  const huge = new File([], 'bold.nii');
  Object.defineProperty(huge, 'size', { value: MAX_FILE_BYTES + 1 });
  const read = vi.spyOn(huge, 'arrayBuffer');
  await assert.rejects(
    readMapFile(huge),
    /This file is 553\u202f648\u202f481 bytes, over the limit of 553\u202f648\u202f480\./,
  );
  assert.equal(read.mock.calls.length, 0);
  for (const name of FIXTURE_NAMES) {
    const bytes = fixture(name);
    assert.deepEqual(
      new Uint8Array(await readMapFile(new File([bytes], name))),
      new Uint8Array(bytes),
    );
  }
});

test('FUNC-56 · a .nii.gz reads as the .nii inside it, however its inflated bytes arrive', async () => {
  const files = FIXTURE_NAMES.filter((name) => name.endsWith('.nii')).map((name) => fixture(name));
  for (const nii of [...files, series(3, 2 | 8, 2)]) {
    const image = await readNifti(nii);
    assert.deepEqual(await readNifti(gzip(nii)), image);
    // Chunks that end inside the header, at its end and past it.
    for (const size of [1, 100, 348, 349]) {
      inflatedIn(size);
      assert.deepEqual(await readNifti(gzip(nii)), image);
      vi.unstubAllGlobals();
    }
  }
});

test('FUNC-56 · a gzip that inflates past its header’s length is refused, having inflated little of it', async () => {
  // float32-sform.nii states 448 bytes; a byte more, or 64 MiB of zeros (64 KB compressed), follows.
  const file = new Uint8Array(fixture('float32-sform.nii'));
  const past = (extra: number) => {
    const bytes = new Uint8Array(file.length + extra);
    bytes.set(file);
    return gzip(bytes.buffer);
  };
  await assert.rejects(readNifti(past(1)), /runs past the 448 bytes its header describes/);
  const bomb = past(64 * 2 ** 20);
  assert.ok(bomb.byteLength < 2 ** 17);
  const pulled = inflatedIn(2 ** 14);
  await assert.rejects(readNifti(bomb), /runs past the 448 bytes its header describes/);
  assert.ok(pulled.bytes < 2 ** 20, `${pulled.bytes} bytes inflated`);
});

test('FUNC-56 · a gzip is refused for its header before the rest is inflated', async () => {
  const zeros = new Uint8Array(64 * 2 ** 20);
  // 64 MiB of zeros under a header.
  const under = (header: ArrayBuffer) => {
    zeros.set(new Uint8Array(header));
    return gzip(zeros.buffer);
  };
  let pulled = inflatedIn(2 ** 14);
  const magic = fixture('float32-sform.nii', (view) => view.setUint8(345, 0x2d));
  await assert.rejects(readNifti(under(magic)), /no NIfTI magic/);
  assert.ok(pulled.bytes < 2 ** 20, `${pulled.bytes} bytes inflated`);
  // A data offset past every map's size: refused uncompressed too, where it would read as truncated.
  const offset = fixture('float32-sform.nii', (view) => view.setFloat32(108, 2 ** 30, true));
  const declared =
    /header describes 1\u202f073\u202f741\u202f920 bytes, over the limit of 553\u202f648\u202f480/;
  await assert.rejects(readNifti(offset), declared);
  pulled = inflatedIn(2 ** 14);
  await assert.rejects(readNifti(under(offset)), declared);
  assert.ok(pulled.bytes < 2 ** 20, `${pulled.bytes} bytes inflated`);
});
