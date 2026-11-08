import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MeshoptDecoder } from 'meshoptimizer/decoder';
import { MeshoptEncoder } from 'meshoptimizer/encoder';

const EXTENSION = 'EXT_meshopt_compression';
const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const FLOAT = 5126;
const INDEX_SIZES: Readonly<Record<number, number>> = { 5123: 2, 5125: 4 };

type Mode = 'ATTRIBUTES' | 'INDICES';

interface BufferView {
  buffer: number;
  byteOffset?: number;
  byteLength: number;
  byteStride?: number;
  extensions?: Record<string, unknown>;
}

interface Accessor {
  bufferView?: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  type: string;
  sparse?: unknown;
}

interface Gltf {
  buffers: { byteLength: number; uri?: string; extensions?: Record<string, unknown> }[];
  bufferViews: BufferView[];
  accessors: Accessor[];
  meshes?: { primitives: { attributes: Record<string, number>; indices?: number }[] }[];
  extensionsUsed?: string[];
  extensionsRequired?: string[];
}

function readGlb(glb: Uint8Array): { gltf: Gltf; bin: Uint8Array } {
  const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  if (view.getUint32(0, true) !== GLB_MAGIC || view.getUint32(4, true) !== 2) {
    throw new Error('Not a glTF 2.0 binary.');
  }
  let gltf: Gltf | null = null;
  let bin: Uint8Array = new Uint8Array(0);
  for (let at = 12; at < glb.byteLength;) {
    const length = view.getUint32(at, true);
    const chunk = glb.subarray(at + 8, at + 8 + length);
    const type = view.getUint32(at + 4, true);
    if (type === JSON_CHUNK) gltf = JSON.parse(new TextDecoder().decode(chunk)) as Gltf;
    else if (type === BIN_CHUNK) bin = chunk;
    at += 8 + length;
  }
  if (!gltf) throw new Error('The GLB has no JSON chunk.');
  return { gltf, bin };
}

function writeGlb(gltf: Gltf, bin: Uint8Array): Uint8Array {
  const text = new TextEncoder().encode(JSON.stringify(gltf));
  const json = new Uint8Array(text.length + (-text.length & 3)).fill(0x20);
  json.set(text);
  const body = new Uint8Array(bin.length + (-bin.length & 3));
  body.set(bin);
  const glb = new Uint8Array(12 + 8 + json.length + 8 + body.length);
  const view = new DataView(glb.buffer);
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, glb.length, true);
  view.setUint32(12, json.length, true);
  view.setUint32(16, JSON_CHUNK, true);
  glb.set(json, 20);
  view.setUint32(20 + json.length, body.length, true);
  view.setUint32(24 + json.length, BIN_CHUNK, true);
  glb.set(body, 28 + json.length);
  return glb;
}

/** The views a mesh reads float positions or triangle indices from, each with how it is encoded. */
function compressible(gltf: Gltf): Map<number, { mode: Mode; stride: number; count: number }> {
  const views = new Map<number, { mode: Mode; stride: number; count: number }>();
  const claim = (index: number, mode: Mode, stride: number) => {
    const accessor = gltf.accessors[index]!;
    const view = gltf.bufferViews[accessor.bufferView!]!;
    const plain =
      !accessor.sparse &&
      !accessor.byteOffset &&
      (view.byteStride ?? stride) === stride &&
      view.byteLength === accessor.count * stride;
    const known = views.get(accessor.bufferView!);
    const shared = known && (known.mode !== mode || known.count !== accessor.count);
    if (!plain || shared) {
      throw new Error(`Accessor ${index} is not one tightly packed view of its own.`);
    }
    views.set(accessor.bufferView!, { mode, stride, count: accessor.count });
  };
  for (const mesh of gltf.meshes ?? []) {
    for (const { attributes, indices } of mesh.primitives) {
      const position = gltf.accessors[attributes['POSITION']!]!;
      if (position.componentType !== FLOAT || position.type !== 'VEC3') {
        throw new Error('Positions must be float VEC3.');
      }
      claim(attributes['POSITION']!, 'ATTRIBUTES', 12);
      if (indices === undefined) continue;
      const size = INDEX_SIZES[gltf.accessors[indices]!.componentType];
      if (!size) throw new Error('Indices must be 16- or 32-bit.');
      claim(indices, 'INDICES', size);
    }
  }
  return views;
}

/**
 * The GLB with its positions and triangle indices under EXT_meshopt_compression (vertex codec 0),
 * every other view copied as it is. The encoding is lossless and keeps order: ATTRIBUTES for the
 * positions, INDICES for the triangles, where TRIANGLES would rotate each triangle's corners and
 * change the order translucent surfaces blend in. A view that does not decode to its source bytes
 * stops the build.
 */
export async function compressGlb(glb: Uint8Array): Promise<Uint8Array> {
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
  const { gltf, bin } = readGlb(glb);
  if (gltf.buffers.length !== 1 || gltf.buffers[0]!.uri !== undefined) {
    throw new Error('Only a GLB whose one buffer is its binary chunk is compressed.');
  }
  const targets = compressible(gltf);
  if (!targets.size) throw new Error('The GLB has no mesh to compress.');

  const parts: Uint8Array[] = [];
  let length = 0;
  const append = (bytes: Uint8Array) => {
    const padding = -length & 3;
    if (padding) parts.push(new Uint8Array(padding));
    parts.push(bytes);
    const offset = length + padding;
    length = offset + bytes.length;
    return offset;
  };
  let fallback = 0;
  gltf.bufferViews = gltf.bufferViews.map((view, index) => {
    const start = view.byteOffset ?? 0;
    const source = bin.subarray(start, start + view.byteLength);
    const target = targets.get(index);
    if (!target) return { ...view, byteOffset: append(source) };
    const { mode, stride, count } = target;
    const encoded = MeshoptEncoder.encodeGltfBuffer(source, count, stride, mode, 0);
    const decoded = new Uint8Array(count * stride);
    MeshoptDecoder.decodeGltfBuffer(decoded, count, stride, encoded, mode);
    if (!Buffer.from(decoded).equals(source)) {
      throw new Error(`View ${index} does not decode to its source bytes.`);
    }
    const byteOffset = fallback;
    fallback += view.byteLength + (-view.byteLength & 3);
    const meshopt = { buffer: 0, byteOffset: append(encoded), byteLength: encoded.length };
    return {
      ...view,
      buffer: 1,
      byteOffset,
      extensions: {
        ...view.extensions,
        [EXTENSION]: { ...meshopt, byteStride: stride, count, mode },
      },
    };
  });
  const body = new Uint8Array(length);
  let at = 0;
  for (const part of parts) {
    body.set(part, at);
    at += part.length;
  }
  // The fallback buffer holds no data: a reader without the decoder must refuse the file.
  gltf.buffers = [
    { byteLength: length },
    { byteLength: fallback, extensions: { [EXTENSION]: { fallback: true } } },
  ];
  gltf.extensionsUsed = [...(gltf.extensionsUsed ?? []), EXTENSION];
  gltf.extensionsRequired = [...(gltf.extensionsRequired ?? []), EXTENSION];
  return writeGlb(gltf, body);
}

interface LayerManifest {
  atlases?: { file: string }[];
  detail_levels?: { file: string }[];
  solid_envelopes?: { file: string };
  supplemental_layers?: { file: string }[];
}

/**
 * The GLBs each published anatomy's model loader reads (`models/anatomies.json`, then each
 * anatomy's manifest), keyed as the published map is. The atlas comparison geometry is left out:
 * the app checks it against the SHA-256 its manifest records, which only the published bytes match.
 */
export function modelLayers(publicDirectory: string): string[] {
  const read = <T>(path: string) =>
    JSON.parse(readFileSync(resolve(publicDirectory, path), 'utf8')) as T;
  const { anatomies } = read<{ anatomies: { id: string }[] }>('models/anatomies.json');
  return anatomies
    .flatMap(({ id }) => {
      const manifest = read<LayerManifest>(`models/${id}/manifest.json`);
      const layers = [
        ...(manifest.atlases ?? []),
        ...(manifest.detail_levels ?? []),
        ...(manifest.solid_envelopes ? [manifest.solid_envelopes] : []),
        ...(manifest.supplemental_layers ?? []),
      ];
      return layers.map(({ file }) => `models/${id}/${file}`);
    })
    .sort();
}
