import { DiffusionInputError } from '../../core/diffusion/validation.ts';
import type { DiffusionInputCode } from '../../core/diffusion/validation.ts';
import { streamlineLengths } from './streamlines.ts';

/** A tract file's streamlines in RAS millimetres, with each streamline's first point and the end. */
export interface TractPoints {
  pts: Float32Array<ArrayBuffer>;
  offsetPt0: Uint32Array<ArrayBuffer>;
}

/** What the 3D lines draw besides the points: one exact length per streamline and the direction colours. */
export interface TractLines extends TractPoints {
  lengths: Float64Array<ArrayBuffer>;
  colors: Uint16Array<ArrayBuffer>;
}

export interface TractJob {
  token: number;
  buffer: ArrayBuffer;
  /** Whether to build the lengths and colours as well as the points. */
  lines: boolean;
}

export type TractReply =
  | ({ token: number } & (TractPoints | TractLines))
  | { token: number; error: string; code?: DiffusionInputCode };

const HEADER = 1000;

async function inflate(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return buffer;
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

/**
 * A TrackVis .trk version 2 file (trackvis.org/docs/?subsect=fileformat). Points are stored in
 * voxel millimetres from the voxel corner; vox_to_ras maps voxel centres to RAS. The arithmetic is
 * NiiVue 0.69's `readTRK` (float32 matrices, gl-matrix's product order), so the points are its bits.
 */
export function readTrk(buffer: ArrayBuffer): TractPoints {
  if (buffer.byteLength < HEADER) throw new Error('A TRK file needs a 1000-byte header.');
  const header = new DataView(buffer, 0, HEADER);
  if (new TextDecoder().decode(new Uint8Array(buffer, 0, 5)) !== 'TRACK') {
    throw new Error('Not a TRK file: it does not start with "TRACK".');
  }
  // hdr_size is 1000 in the file's own byte order.
  const little = header.getInt32(996, true) === HEADER;
  if (!little && header.getInt32(996, false) !== HEADER) {
    throw new Error('Not a TRK file: hdr_size is not 1000 in either byte order.');
  }
  if (header.getInt32(992, little) !== 2) throw new Error('Only TRK version 2 is read.');
  const int16 = (at: number) => header.getInt16(at, little);
  const float = (at: number) => header.getFloat32(at, little);
  const dims = [int16(6), int16(8), int16(10)];
  const voxel = [float(12), float(16), float(20)];
  if (dims.some((size) => size < 1) || voxel.some((size) => !(size > 0))) {
    throw new Error('The TRK header needs positive dimensions and voxel sizes.');
  }
  const scalars = int16(36);
  const properties = int16(238);
  if (scalars < 0 || scalars > 10 || properties < 0 || properties > 10) {
    throw new Error('A TRK file holds 0 to 10 scalars and properties.');
  }
  const toRas = Float32Array.from({ length: 16 }, (_, index) => float(440 + index * 4));
  if (toRas[15] === 0) throw new Error('The TRK file does not record vox_to_ras.');
  const tracks = header.getInt32(988, little);

  const body = buffer.byteLength - HEADER;
  if (body % 4) throw new Error('The TRK body is not whole 4-byte values.');
  let count = new Int32Array(buffer, HEADER, body / 4);
  if (!little) {
    const words = new DataView(buffer, HEADER);
    count = count.map((_, word) => words.getInt32(word * 4, false));
  }
  const values = new Float32Array(count.buffer, count.byteOffset, count.length);

  // vox_to_ras × (1/voxel size, −0.5), in float32 like gl-matrix's mat4.
  const zoom = Float32Array.of(
    1 / voxel[0]!,
    0,
    0,
    -0.5,
    0,
    1 / voxel[1]!,
    0,
    -0.5,
    0,
    0,
    1 / voxel[2]!,
    -0.5,
    0,
    0,
    0,
    1,
  );
  const m = new Float32Array(16);
  for (let row = 0; row < 4; row++) {
    for (let column = 0; column < 4; column++) {
      m[row * 4 + column] =
        toRas[row * 4]! * zoom[column]! +
        toRas[row * 4 + 1]! * zoom[4 + column]! +
        toRas[row * 4 + 2]! * zoom[8 + column]! +
        toRas[row * 4 + 3]! * zoom[12 + column]!;
    }
  }

  const stride = 3 + scalars;
  let lines = 0;
  let points = 0;
  for (let word = 0; word < count.length; lines++) {
    const n = count[word]!;
    if (n < 1) throw new Error(`TRK streamline ${lines} has ${n} points.`);
    points += n;
    word += 1 + n * stride + properties;
    if (word > count.length) throw new Error('The TRK body ends inside a streamline.');
  }
  if (!lines) throw new Error('Empty TRK file.');
  if (tracks && tracks !== lines) {
    throw new Error(`The TRK header counts ${tracks} streamlines; the body holds ${lines}.`);
  }

  const pts = new Float32Array(points * 3);
  const offsetPt0 = new Uint32Array(lines + 1);
  let word = 0;
  let point = 0;
  for (let line = 0; line < lines; line++) {
    const n = count[word++]!;
    offsetPt0[line] = point;
    for (let each = 0; each < n; each++, word += stride) {
      const x = values[word]!;
      const y = values[word + 1]!;
      const z = values[word + 2]!;
      pts[point * 3] = x * m[0]! + y * m[1]! + z * m[2]! + m[3]!;
      pts[point * 3 + 1] = x * m[4]! + y * m[5]! + z * m[6]! + m[7]!;
      pts[point * 3 + 2] = x * m[8]! + y * m[9]! + z * m[10]! + m[11]!;
      point++;
    }
    word += properties;
  }
  offsetPt0[lines] = point;
  return { pts, offsetPt0 };
}

// Direction colours are display values, as in NiiVue; three.js reads vertex colours as linear and
// encodes them to sRGB on output, so each 8-bit display level is stored as its linear value.
// 8-bit linear storage would display 73 of the 256 levels wrongly, so they stay 16-bit.
const LINEAR_LEVELS = Uint16Array.from({ length: 256 }, (_, level) => {
  const value = level / 255;
  return Math.round(65535 * (value < 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
});

export function directionColors(
  points: Float32Array,
  offsets: Uint32Array,
): Uint16Array<ArrayBuffer> {
  const colors = new Uint16Array(points.length);
  for (let line = 0; line < offsets.length - 1; line++) {
    const start = offsets[line]!;
    const end = offsets[line + 1]! - 1;
    for (let point = start; point <= end; point++) {
      const before = Math.max(start, point - 1) * 3;
      const after = Math.min(end, point + 1) * 3;
      const right = points[after]! - points[before]!;
      const anterior = points[after + 1]! - points[before + 1]!;
      const superior = points[after + 2]! - points[before + 2]!;
      const magnitude = Math.hypot(right, anterior, superior);
      if (magnitude === 0) continue;
      colors[point * 3] = LINEAR_LEVELS[Math.round((255 * Math.abs(right)) / magnitude)]!;
      colors[point * 3 + 1] = LINEAR_LEVELS[Math.round((255 * Math.abs(anterior)) / magnitude)]!;
      colors[point * 3 + 2] = LINEAR_LEVELS[Math.round((255 * Math.abs(superior)) / magnitude)]!;
    }
  }
  return colors;
}

/** The worker's job: a published tract file, compressed or not, to the arrays the viewer needs. */
export async function decodeTract({ token, buffer, lines }: TractJob): Promise<{
  reply: TractReply;
  transfer: ArrayBuffer[];
}> {
  try {
    const tract = readTrk(await inflate(buffer));
    if (!lines) {
      return { reply: { token, ...tract }, transfer: [tract.pts.buffer, tract.offsetPt0.buffer] };
    }
    const lengths = streamlineLengths(tract.pts, tract.offsetPt0) as Float64Array<ArrayBuffer>;
    const colors = directionColors(tract.pts, tract.offsetPt0);
    return {
      reply: { token, ...tract, lengths, colors },
      transfer: [tract.pts.buffer, tract.offsetPt0.buffer, lengths.buffer, colors.buffer],
    };
  } catch (error) {
    // Relayed to the page, which throws it again there; a streamline error keeps its class.
    const code = error instanceof DiffusionInputError ? error.code : undefined;
    return { reply: { token, error: (error as Error).message, code }, transfer: [] };
  }
}
