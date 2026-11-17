import { Color, DataTexture, FloatType, RGBAFormat, SRGBColorSpace } from 'three';
import type { BufferGeometry } from 'three';
import type { Region, Rgb } from '../../types/index.ts';

/** Texels in a palette: one for every value the published byte index can take. */
export const PALETTE_SIZE = 256;

/** The slice of the manifest's `networks` the colours read. */
export interface NetworkMetadata {
  networks: readonly string[];
  colors: Readonly<Record<string, Rgb>>;
}

/** The network palette, in the manifest's network order: texel k is the k-th network. */
export function networkPalette({ networks, colors }: NetworkMetadata): DataTexture {
  return paletteTexture(networks.map((name) => colors[name]!));
}

/**
 * One texel per index of a per-vertex field (`_NETWORK`, `_TERRITORY`): texel k (1-based) holds the
 * k-th published colour decoded from sRGB, with 1 for "this vertex has one"; texel 0 and every texel
 * past the palette hold four zeros.
 *
 * The vertex stage looks each vertex's colour up by its index (materials.ts), and the colour, not the
 * index, is interpolated. A triangle spanning Visual (1) and Default (7) blends the two colours that
 * actually meet there, across roughly the one millimetre between vertices; an interpolated index would
 * sweep through five networks it never touches.
 *
 * The fourth channel says whether a vertex has a colour at all. The medial wall is in no network and
 * keeps whatever colour its region already had, so nothing invents a network where the parcellation
 * declines to put one.
 *
 * Float, as the per-vertex attribute this replaced was: a byte per channel would round the linear
 * colours and move the pixels drawn.
 */
export function paletteTexture(colors: readonly Rgb[]): DataTexture {
  if (colors.length >= PALETTE_SIZE) {
    throw new RangeError(`A palette holds at most ${PALETTE_SIZE - 1} colours.`);
  }
  const data = new Float32Array(PALETTE_SIZE * 4);
  colors.forEach(([red, green, blue], at) => {
    const color = new Color().setRGB(red / 255, green / 255, blue / 255, SRGBColorSpace);
    data.set([color.r, color.g, color.b, 1], (at + 1) * 4);
  });
  const texture = new DataTexture(data, PALETTE_SIZE, 1, RGBAFormat, FloatType);
  texture.needsUpdate = true;
  return texture;
}

/**
 * The build writes one index per published territory; a larger one means the mesh and the manifest
 * disagree, which drawing it as "no territory" would hide.
 */
export function checkTerritories(
  geometry: BufferGeometry,
  territories: readonly { color: Rgb }[],
): void {
  const field = geometry.getAttribute('_territory');
  if (!field) return;
  for (let vertex = 0; vertex < field.count; vertex += 1) {
    const index = field.getX(vertex);
    if (!Number.isInteger(index) || index < 0 || index > territories.length) {
      throw new Error(`Vertex index ${index} has no published territory.`);
    }
  }
}

/**
 * The colour of the territory holding most of a region, when one holds a majority. A region drawn
 * whole, as a deep structure's surface or a cut voxel is, has one code, so it can only show that.
 */
export function majorityTerritoryColor(
  region: Pick<Region, 'territories'> | undefined,
  territories: readonly { id: string; color: Rgb }[],
): Rgb | null {
  const largest = region?.territories?.[0];
  if (!largest || largest.fraction < 0.5) return null;
  const entry = territories.find((candidate) => candidate.id === largest.territory);
  if (!entry) throw new Error(`No arterial territory ${largest.territory} is published.`);
  return entry.color;
}
