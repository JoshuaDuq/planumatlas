import { expect, test } from 'vitest';
import {
  BufferAttribute,
  Color,
  DataTexture,
  DirectionalLight,
  DoubleSide,
  FloatType,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  SRGBColorSpace,
  Scene,
  UnsignedByteType,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';
import type { BufferGeometry, Material, WebGLProgramParametersWithUniforms } from 'three';
import { arterial_territories, networks } from '../../../../../public/models/cdmd/manifest.json';
import type { Region, Rgb } from '../../types/index.ts';
import { createAnatomicalMaterial } from './materials.ts';
import type { AnatomicalUserData, SurfacePalettes } from './materials.ts';
import { networkPalette, paletteTexture } from './network-colors.ts';
import { appearance } from './test-support.ts';

// Real WebGL: the colour a vertex receives is what the vertex stage looks up, so only a drawn frame can
// show that the palette texture draws what the per-vertex float attribute it replaced drew.
const SHADER_COMPILE_TIMEOUT_MS = 60_000;
const SIZE = 48;

const NETWORK_COLORS = networks.networks.map(
  (name) => networks.colors[name as keyof typeof networks.colors] as unknown as Rgb,
);
const TERRITORY_COLORS = arterial_territories.territories.map(
  ({ color }) => color as unknown as Rgb,
);

/** Linear float colours, one per vertex, as the removed `paletteColors` built the attribute. */
function attributeColors(indices: ArrayLike<number>, colors: readonly Rgb[]): Float32Array {
  const palette = colors.map(([red, green, blue]) =>
    new Color().setRGB(red / 255, green / 255, blue / 255, SRGBColorSpace),
  );
  const values = new Float32Array(indices.length * 4);
  for (let vertex = 0; vertex < indices.length; vertex += 1) {
    const color = palette[Math.round(indices[vertex]!) - 1];
    if (color) values.set([color.r, color.g, color.b, 1], vertex * 4);
  }
  return values;
}

/** The same palette in bytes: what an RGBA8 texture would hold. */
function bytePalette(texture: DataTexture): DataTexture {
  const floats = texture.image.data as Float32Array;
  const bytes = Uint8Array.from(floats, (value) => Math.round(value * 255));
  const palette = new DataTexture(bytes, floats.length / 4, 1, RGBAFormat, UnsignedByteType);
  palette.needsUpdate = true;
  return palette;
}

/**
 * A patch of cortex 24 vertices a side whose indices change from vertex to vertex, so every triangle
 * blends two or three colours, and which also holds 0 and indices past the palette (none).
 */
function cortex(): BufferGeometry {
  const geometry = new PlaneGeometry(0.01, 0.01, 23, 23);
  const count = geometry.getAttribute('position').count;
  const field = (value: (vertex: number) => number) =>
    new BufferAttribute(
      Float32Array.from({ length: count }, (_, vertex) => value(vertex)),
      1,
    );
  geometry.setAttribute(
    '_sulc',
    field((vertex) => 0.5 + 0.4 * Math.sin(vertex * 0.37)),
  );
  geometry.setAttribute(
    '_openness',
    field((vertex) => 0.5 + 0.4 * Math.cos(vertex * 0.21)),
  );
  geometry.setAttribute(
    '_t1',
    field((vertex) => 0.5 + 0.3 * Math.sin(vertex * 0.11)),
  );
  const index = (modulus: number, step: number) =>
    new BufferAttribute(
      Uint8Array.from({ length: count }, (_, vertex) => (vertex * step) % modulus),
      1,
    );
  geometry.setAttribute('_network', index(NETWORK_COLORS.length + 3, 5));
  geometry.setAttribute('_territory', index(TERRITORY_COLORS.length + 1, 7));
  return geometry;
}

const FIELDS = {
  network: { field: '_network', sampler: 'networkPalette', colors: NETWORK_COLORS },
  territory: { field: '_territory', sampler: 'territoryPalette', colors: TERRITORY_COLORS },
} as const;

type Mode = keyof typeof FIELDS;

function surface(geometry: BufferGeometry, mode: Mode, palettes: SurfacePalettes, mix: number) {
  const mesh = new Mesh(
    geometry,
    new MeshStandardMaterial({ color: '#8a7f78', roughness: 0.6, side: DoubleSide }),
  );
  const material = createAnatomicalMaterial(
    mesh,
    { id: 'r', kind: 'cortex' } as Region,
    appearance,
    null,
    undefined,
    palettes,
  );
  const userData = material.userData as AnatomicalUserData;
  userData.tissueVariation.value = 0;
  (mode === 'network' ? userData.networkMix : userData.territoryMix)!.value = mix;
  return material;
}

/** The material as it drew before: each vertex's colour read from a float attribute, not looked up. */
function fromAttribute(material: Material, geometry: BufferGeometry, mode: Mode): void {
  const { field, sampler, colors } = FIELDS[mode];
  geometry.setAttribute(
    `${field}Color`,
    new BufferAttribute(attributeColors(geometry.getAttribute(field).array, colors), 4),
  );
  const compile = material.onBeforeCompile;
  const key = material.customProgramCacheKey();
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer) => {
    compile.call(material, shader, renderer);
    const lookup = `texelFetch(${sampler}, ivec2(int(${field} + 0.5), 0), 0)`;
    expect(shader.vertexShader).toContain(lookup);
    shader.vertexShader = `attribute vec4 ${field}Color;
${shader.vertexShader.replace(lookup, `${field}Color`)}`;
  };
  material.customProgramCacheKey = () => `${key}-attribute`;
}

/** Every pixel of the patch, lit by one light, in linear float. */
function draw(geometry: BufferGeometry, material: Material): Float32Array {
  const renderer = new WebGLRenderer({ canvas: document.createElement('canvas') });
  const scene = new Scene();
  scene.add(new Mesh(geometry, material));
  const light = new DirectionalLight(0xffffff, Math.PI);
  light.position.set(0.3, 0.4, 1);
  scene.add(light);
  const camera = new OrthographicCamera(-0.005, 0.005, 0.005, -0.005, 0.001, 1);
  camera.position.z = 0.1;
  const target = new WebGLRenderTarget(SIZE, SIZE, { type: FloatType });
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  const pixels = new Float32Array(SIZE * SIZE * 4);
  renderer.readRenderTargetPixels(target, 0, 0, SIZE, SIZE, pixels);
  target.dispose();
  material.dispose();
  renderer.dispose();
  // dispose() keeps the context; a live one counts against the browser's cap (scene.ts).
  renderer.forceContextLoss();
  return pixels;
}

const largestDifference = (a: Float32Array, b: Float32Array) =>
  a.reduce((largest, value, at) => Math.max(largest, Math.abs(value - b[at]!)), 0);

const distinctColours = (pixels: Float32Array) =>
  new Set(Array.from({ length: SIZE * SIZE }, (_, at) => pixels.slice(at * 4, at * 4 + 3).join()))
    .size;

for (const mode of ['network', 'territory'] as const) {
  test(
    `SHADER-08 the ${mode} palette texture draws every pixel the per-vertex float colours drew`,
    { timeout: SHADER_COMPILE_TIMEOUT_MS },
    () => {
      const palettes = {
        network: networkPalette(networks as never),
        territory: paletteTexture(TERRITORY_COLORS),
      };
      const geometry = cortex();
      const looked = draw(geometry, surface(geometry, mode, palettes, 1));
      const before = surface(geometry, mode, palettes, 1);
      fromAttribute(before, geometry, mode);
      const carried = draw(geometry, before);
      // Bit for bit: the texture holds the float32 values the attribute held.
      expect(largestDifference(looked, carried)).toBe(0);
      // The colours are drawn, and many of them: the comparison is not of two blank frames.
      const plain = draw(geometry, surface(geometry, mode, palettes, 0));
      expect(largestDifference(looked, plain)).toBeGreaterThan(0.05);
      expect(distinctColours(looked)).toBeGreaterThan(100);
      // A byte per channel would round the linear colours and move the pixels.
      const bytes = { ...palettes, [mode]: bytePalette(palettes[mode]) };
      expect(
        largestDifference(draw(geometry, surface(geometry, mode, bytes, 1)), carried),
      ).toBeGreaterThan(0);
      palettes.network.dispose();
      palettes.territory.dispose();
      geometry.dispose();
    },
  );
}
