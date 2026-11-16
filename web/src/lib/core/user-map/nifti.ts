import { MapFileError } from './map-file-error.ts';

// Not built on nifti-reader-js (in @niivue/niivue): it takes the qform when qform_code > sform_code,
// where nibabel takes the sform, so a map would land elsewhere than nilearn shows it.

/** The most voxels one volume may hold. */
export const MAX_VOXELS = 32 * 2 ** 20;
/** The most values a series may hold across its volumes: 256 MB as float32. */
export const MAX_VALUES = 64 * 2 ** 20;

/** A NIfTI-1 image as nibabel reads it: one 3-D volume, or a series of them along the fourth axis. */
export interface NiftiImage {
  shape: [number, number, number];
  /** Voxel indices (i, j, k) to world millimetres, row-major 4×4, as nibabel's `img.affine`. */
  voxelToWorld: number[][];
  /** Each volume's scaled values, x fastest (the file's own order), non-finite values as NaN. */
  volumes: Float32Array[];
  /**
   * nibabel's `get_zooms()[3]` in seconds, for a series whose header gives the time axis a unit
   * (`xyzt_units`) and a positive spacing; null otherwise.
   */
  secondsPerVolume: number | null;
  /** `intent_code`: what the values are, when the writer said (NIFTI_INTENT_*). */
  intent: number;
  /** `descrip`, up to its first NUL; SPM names its statistic there. */
  description: string;
}

/** One volume of an image, as it is sampled and its clusters are found. */
export interface NiftiVolume extends Omit<NiftiImage, 'volumes' | 'secondsPerVolume'> {
  data: Float32Array;
}

export function volumeOf(
  { shape, voxelToWorld, volumes, intent, description }: NiftiImage,
  index: number,
): NiftiVolume {
  const data = volumes[index];
  if (!data) throw new RangeError(`The image has no volume ${index}.`);
  return { shape, voxelToWorld, data, intent, description };
}

/** `xyzt_units` time codes (NIFTI_UNITS_SEC, _MSEC, _USEC) in seconds. */
const TIME_UNITS: Readonly<Record<number, number>> = { 8: 1, 16: 1e-3, 24: 1e-6 };

type Read = (view: DataView, offset: number, little: boolean) => number;

const DATA_TYPES: Record<number, { bytes: number; read: Read }> = {
  2: { bytes: 1, read: (view, offset) => view.getUint8(offset) },
  4: { bytes: 2, read: (view, offset, little) => view.getInt16(offset, little) },
  8: { bytes: 4, read: (view, offset, little) => view.getInt32(offset, little) },
  16: { bytes: 4, read: (view, offset, little) => view.getFloat32(offset, little) },
  64: { bytes: 8, read: (view, offset, little) => view.getFloat64(offset, little) },
  256: { bytes: 1, read: (view, offset) => view.getInt8(offset) },
  512: { bytes: 2, read: (view, offset, little) => view.getUint16(offset, little) },
  768: { bytes: 4, read: (view, offset, little) => view.getUint32(offset, little) },
};

/** `sizeof_hdr`: NIfTI-1's header. NIfTI-2's 540 bytes are refused. */
const HEADER_BYTES = 348;
/** Room for header extensions (AFNI's XML, FreeSurfer's tags): writers' metadata takes kilobytes. */
const EXTENSION_BYTES = 16 * 2 ** 20;

/**
 * The most bytes a map file may hold, refused before it is read: the 352 bytes before the earliest
 * data (the header and its four extension-flag bytes), room for extensions, and MAX_VALUES values of
 * the widest type read, float64. So the largest series that can be shown fits with its extensions.
 * A .nii.gz is held to it too: gzip grows only incompressible data, by 5 bytes in 65,535 (41 KB
 * here), which the room for extensions covers.
 */
export const MAX_FILE_BYTES =
  352 + EXTENSION_BYTES + MAX_VALUES * Math.max(...Object.values(DATA_TYPES).map((t) => t.bytes));

/**
 * A .nii.gz reaches the inflater a slice at a time, and a slice is inflated only once the last one's
 * bytes have been read. Deflate expands at most 1,032 to 1, so no more than 17 MB is inflated past
 * the length a header states. In Chromium a 58 MB .nii.gz inflated in about the 0.6 s it took whole;
 * 4 KiB slices took 1.6 times as long.
 */
const SLICE_BYTES = 2 ** 14;

const UNSUPPORTED_TYPES: Record<number, string> = {
  1: 'binary',
  32: 'complex64',
  128: 'RGB24',
  1024: 'int64',
  1280: 'uint64',
  1536: 'float128',
  1792: 'complex128',
  2048: 'complex256',
  2304: 'RGBA32',
};

/** nibabel's `Nifti1Header.quaternion_threshold`: three float32 epsilons. */
const QUATERNION_THRESHOLD = 3 * 2 ** -23;

/** Read a single-file NIfTI-1 image (.nii or .nii.gz) as nibabel's `img.affine` and `get_fdata()`. */
export async function readNifti(buffer: ArrayBuffer): Promise<NiftiImage> {
  const head = new Uint8Array(buffer, 0, Math.min(2, buffer.byteLength));
  const view = head[0] === 0x1f && head[1] === 0x8b ? await inflate(buffer) : new DataView(buffer);
  const { little, shape, count, type, offset, end } = layout(view);
  const voxels = shape[0] * shape[1] * shape[2];
  if (end > view.byteLength) {
    throw new MapFileError('truncated', [end, view.byteLength]);
  }

  // nibabel's get_slope_inter: a zero or non-finite slope means no scaling, whatever the intercept.
  let slope = view.getFloat32(112, little);
  let inter = view.getFloat32(116, little);
  if (slope === 0 || !Number.isFinite(slope)) [slope, inter] = [1, 0];
  else if (!Number.isFinite(inter)) {
    throw new MapFileError('intercept', [inter]);
  }

  const voxelToWorld = bestAffine(view, little);

  const data = new Float32Array(voxels * count);
  for (let i = 0; i < data.length; i++) {
    const value = type.read(view, offset + i * type.bytes, little) * slope + inter;
    data[i] = value;
    if (!Number.isFinite(data[i])) {
      if (Number.isFinite(value)) {
        throw new MapFileError('overflow', [value]);
      }
      data[i] = NaN;
    }
  }
  const descrip = new Uint8Array(view.buffer, view.byteOffset + 148, 80);
  const nul = descrip.indexOf(0);
  const description = new TextDecoder('latin1').decode(descrip.subarray(0, nul < 0 ? 80 : nul));
  const volumes = Array.from({ length: count }, (_, n) =>
    data.subarray(n * voxels, (n + 1) * voxels),
  );
  return {
    shape,
    voxelToWorld,
    volumes,
    secondsPerVolume: count > 1 ? secondsPerVolume(view, little) : null,
    intent: view.getInt16(68, little),
    description,
  };
}

function secondsPerVolume(view: DataView, little: boolean): number | null {
  const unit = TIME_UNITS[view.getUint8(123) & 0x38];
  const spacing = view.getFloat32(92, little);
  return unit && Number.isFinite(spacing) && spacing > 0 ? spacing * unit : null;
}

/** The file a reader gave, read whole only when it is no larger than a map file may be. */
export function readMapFile(file: Blob): Promise<ArrayBuffer> {
  if (file.size > MAX_FILE_BYTES) {
    return Promise.reject(new MapFileError('fileSize', [file.size, MAX_FILE_BYTES]));
  }
  return file.arrayBuffer();
}

/**
 * A .nii.gz inflated no further than its header says the file runs: the header is checked first,
 * then the file fills one buffer of the length it states. A stream that runs past it is cancelled
 * and refused, never cut short, so a small gzip of zeros cannot fill the tab's memory.
 */
async function inflate(buffer: ArrayBuffer): Promise<DataView> {
  const reader = slices(buffer).pipeThrough(new DecompressionStream('gzip')).getReader();
  // The stream failing, read or cancelled (the next slice may have failed meanwhile), is a damaged gzip.
  const damaged = (cause: unknown): never => {
    throw new MapFileError('gzip', [], { cause });
  };
  let file = new Uint8Array(HEADER_BYTES);
  let length = 0;
  for (;;) {
    const { value: chunk } = await reader.read().catch(damaged);
    if (!chunk) return new DataView(file.buffer, 0, length);
    try {
      file = kept(file, length, chunk);
    } catch (refused) {
      await reader.cancel().catch(damaged);
      throw refused;
    }
    length += chunk.length;
  }
}

/**
 * `file` with `chunk` written at `length`. Until the header is whole, `file` is the header alone;
 * then it is checked, and the file grows once to the length it states, which no chunk may pass.
 */
function kept(
  file: Uint8Array<ArrayBuffer>,
  length: number,
  chunk: Uint8Array,
): Uint8Array<ArrayBuffer> {
  const total = length + chunk.length;
  if (length >= HEADER_BYTES) {
    if (total > file.length) throw new MapFileError('inflated', [file.length]);
    file.set(chunk, length);
    return file;
  }
  const header = Math.min(chunk.length, HEADER_BYTES - length);
  file.set(chunk.subarray(0, header), length);
  if (total < HEADER_BYTES) return file;
  const { end } = layout(new DataView(file.buffer));
  if (total > end) throw new MapFileError('inflated', [end]);
  const whole = new Uint8Array(end);
  whole.set(file);
  whole.set(chunk.subarray(header), HEADER_BYTES);
  return whole;
}

/** `buffer` as a stream of slices, each made when it is asked for. */
function slices(buffer: ArrayBuffer): ReadableStream<Uint8Array<ArrayBuffer>> {
  let at = 0;
  return new ReadableStream(
    {
      pull(controller) {
        if (at === buffer.byteLength) {
          controller.close();
          return;
        }
        const slice = new Uint8Array(buffer, at, Math.min(SLICE_BYTES, buffer.byteLength - at));
        at += slice.length;
        controller.enqueue(slice);
      },
    },
    { highWaterMark: 0 },
  );
}

/**
 * Where a file's values lie, from its header: everything checked before a value is read, so a
 * .nii.gz is refused for it before it is inflated.
 */
function layout(view: DataView) {
  const little = byteOrder(view);
  if (view.byteLength < HEADER_BYTES) throw new MapFileError('header');

  const magic = String.fromCharCode(...new Uint8Array(view.buffer, view.byteOffset + 344, 4));
  if (magic === 'ni1\0') {
    throw new MapFileError('pair');
  }
  if (magic !== 'n+1\0') {
    throw new MapFileError('magic');
  }

  const { shape, count } = imageShape(view, little);

  const code = view.getInt16(70, little);
  const type = DATA_TYPES[code];
  if (!type) {
    const name = UNSUPPORTED_TYPES[code];
    throw name
      ? new MapFileError('storedType', [name, code])
      : new MapFileError('unknownType', [code]);
  }

  const voxOffset = view.getFloat32(108, little);
  if (!(voxOffset >= 352)) {
    throw new MapFileError('offset', [voxOffset]);
  }
  const offset = Math.trunc(voxOffset);
  const end = offset + shape[0] * shape[1] * shape[2] * count * type.bytes;
  if (end > MAX_FILE_BYTES) {
    throw new MapFileError('declared', [end, MAX_FILE_BYTES]);
  }
  return { little, shape, count, type, offset, end };
}

/** True for little-endian, from `sizeof_hdr`. */
function byteOrder(view: DataView): boolean {
  if (view.byteLength >= 4) {
    for (const little of [true, false]) if (view.getInt32(0, little) === 348) return little;
    if ([true, false].some((little) => view.getInt32(0, little) === 540)) {
      throw new MapFileError('nifti2');
    }
  }
  throw new MapFileError('notNifti');
}

function imageShape(view: DataView, little: boolean) {
  const dim = Array.from({ length: 8 }, (_, i) => view.getInt16(40 + 2 * i, little));
  const rank = dim[0];
  if (rank < 3 || rank > 7) {
    throw new MapFileError('rank', [rank]);
  }
  const sizes = dim.slice(1, rank + 1);
  if (sizes.some((n) => n < 1)) {
    throw new MapFileError('emptyAxis', [sizes.join(' × ')]);
  }
  if (sizes.slice(4).some((n) => n > 1)) {
    throw new MapFileError('dimensions', [sizes.join(' × ')]);
  }
  const shape = sizes.slice(0, 3) as [number, number, number];
  const voxels = shape[0] * shape[1] * shape[2];
  if (voxels > MAX_VOXELS) {
    throw new MapFileError('tooLarge', [shape.join(' × '), MAX_VOXELS]);
  }
  const count = sizes[3] ?? 1;
  if (voxels * count > MAX_VALUES) {
    throw new MapFileError('tooManyVolumes', [count, Math.floor(MAX_VALUES / voxels)]);
  }
  return { shape, count };
}

/** nibabel's `get_best_affine()` after the fixes its header check makes on load. */
function bestAffine(view: DataView, little: boolean): number[][] {
  const float = (offset: number) => view.getFloat32(offset, little);
  // Codes outside NIfTI's 0–5 are reset to 0, as nibabel's _chk_xform_code does.
  const xformCode = (offset: number) => {
    const code = view.getInt16(offset, little);
    return code >= 0 && code <= 5 ? code : 0;
  };
  let rows: number[][];
  if (xformCode(254) !== 0) {
    rows = [280, 296, 312].map((row) => [0, 4, 8, 12].map((column) => float(row + column)));
  } else if (xformCode(252) !== 0) {
    rows = qform(float);
  } else {
    throw new MapFileError('orientation');
  }
  const affine = [...rows, [0, 0, 0, 1]];
  if (!affine.flat().every(Number.isFinite)) {
    throw new MapFileError('affineFinite');
  }
  const [a, b, c] = [0, 1, 2].map((column) => rows.map((row) => row[column])) as [
    number[],
    number[],
    number[],
  ];
  const det =
    a[0] * (b[1] * c[2] - b[2] * c[1]) +
    a[1] * (b[2] * c[0] - b[0] * c[2]) +
    a[2] * (b[0] * c[1] - b[1] * c[0]);
  const lengths = Math.hypot(...a) * Math.hypot(...b) * Math.hypot(...c);
  // Relative to the axis lengths, so the test does not depend on voxel size.
  if (!(Math.abs(det) > 1e-6 * lengths)) {
    throw new MapFileError('singular');
  }
  return affine;
}

/** nibabel's `get_qform()`: `fillpositive` for w, then `quat2mat`, zooms and qfac. */
function qform(float: (offset: number) => number): number[][] {
  const [x, y, z] = [256, 260, 264].map(float) as [number, number, number];
  const w2 = 1 - (x * x + y * y + z * z);
  let w: number;
  if (Math.abs(w2) < QUATERNION_THRESHOLD) {
    w = 0;
  } else if (w2 < 0) {
    throw new MapFileError('quaternion');
  } else {
    w = Math.sqrt(w2);
  }
  const s = 2 / (w * w + x * x + y * y + z * z);
  const [X, Y, Z] = [x * s, y * s, z * s];
  const [wX, wY, wZ] = [w * X, w * Y, w * Z];
  const [xX, xY, xZ] = [x * X, x * Y, x * Z];
  const [yY, yZ, zZ] = [y * Y, y * Z, z * Z];
  const rotation = [
    [1 - (yY + zZ), xY - wZ, xZ + wY],
    [xY + wZ, 1 - (xX + zZ), yZ - wX],
    [xZ - wY, yZ + wX, 1 - (xX + yY)],
  ];
  // nibabel's header check on load: qfac outside ±1 becomes 1, a zero pixdim 1, a negative one its abs.
  const pixdim = [76, 80, 84, 88].map(float) as [number, number, number, number];
  const qfac = pixdim[0] === -1 || pixdim[0] === 1 ? pixdim[0] : 1;
  const zooms = pixdim.slice(1).map((size) => (size === 0 ? 1 : Math.abs(size)));
  zooms[2] *= qfac;
  const offsets = [268, 272, 276].map(float);
  return rotation.map((row, i) => [...row.map((r, j) => r * zooms[j]), offsets[i]]);
}
