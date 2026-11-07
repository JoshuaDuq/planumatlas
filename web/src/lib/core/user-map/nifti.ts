import { MapFileError } from './map-file-error.ts';

// Not built on nifti-reader-js (in @niivue/niivue): it takes the qform when qform_code > sform_code,
// where nibabel takes the sform, so a map would land elsewhere than nilearn shows it.

/** The most voxels a map may hold. */
export const MAX_VOXELS = 32 * 2 ** 20;

/** A single 3-D NIfTI-1 volume as nibabel reads it. */
export interface NiftiVolume {
  shape: [number, number, number];
  /** Voxel indices (i, j, k) to world millimetres, row-major 4×4, as nibabel's `img.affine`. */
  voxelToWorld: number[][];
  /** Scaled values, x fastest (the file's own order), non-finite values as NaN. */
  data: Float32Array;
  /** `intent_code`: what the values are, when the writer said (NIFTI_INTENT_*). */
  intent: number;
  /** `descrip`, up to its first NUL; SPM names its statistic there. */
  description: string;
}

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

/** Read a single-file NIfTI-1 volume (.nii or .nii.gz) as nibabel's `img.affine` and `get_fdata()`. */
export async function readNifti(buffer: ArrayBuffer): Promise<NiftiVolume> {
  const head = new Uint8Array(buffer, 0, Math.min(2, buffer.byteLength));
  const bytes = head[0] === 0x1f && head[1] === 0x8b ? await inflate(buffer) : buffer;
  const view = new DataView(bytes);
  const little = byteOrder(view);
  if (view.byteLength < 348) throw new MapFileError('header');

  const magic = String.fromCharCode(...new Uint8Array(bytes, 344, 4));
  if (magic === 'ni1\0') {
    throw new MapFileError('pair');
  }
  if (magic !== 'n+1\0') {
    throw new MapFileError('magic');
  }

  const shape = volumeShape(view, little);
  const voxels = shape[0] * shape[1] * shape[2];

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
  const end = offset + voxels * type.bytes;
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

  const data = new Float32Array(voxels);
  for (let i = 0; i < voxels; i++) {
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
  return { shape, voxelToWorld, data, intent: view.getInt16(68, little), description };
}

async function inflate(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
  try {
    return await new Response(stream).arrayBuffer();
  } catch (cause) {
    throw new MapFileError('gzip', [], { cause });
  }
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

function volumeShape(view: DataView, little: boolean): [number, number, number] {
  const dim = Array.from({ length: 8 }, (_, i) => view.getInt16(40 + 2 * i, little));
  const rank = dim[0];
  if (rank < 3 || rank > 7) {
    throw new MapFileError('rank', [rank]);
  }
  const sizes = dim.slice(1, rank + 1);
  if (sizes.some((n) => n < 1)) {
    throw new MapFileError('emptyAxis', [sizes.join(' × ')]);
  }
  const volumes = sizes.slice(3).reduce((product, n) => product * n, 1);
  if (volumes > 1) {
    throw new MapFileError('volumes', [volumes]);
  }
  const shape = sizes.slice(0, 3) as [number, number, number];
  if (shape[0] * shape[1] * shape[2] > MAX_VOXELS) {
    throw new MapFileError('tooLarge', [shape.join(' × '), MAX_VOXELS]);
  }
  return shape;
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
