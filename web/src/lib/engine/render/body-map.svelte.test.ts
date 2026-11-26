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
  RedFormat,
  SRGBColorSpace,
  Scene,
  UnsignedByteType,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';
import type { BufferGeometry, Material } from 'three';
import { BODY_PART_COLORS } from '../../core/learning/body-map.ts';
import type { Region } from '../../types/index.ts';
import { createAnatomicalMaterial } from './materials.ts';
import type { AnatomicalUserData, BodyMapShared, SurfacePalettes } from './materials.ts';
import { paletteTexture } from './network-colors.ts';
import { appearance } from './test-support.ts';

// Real WebGL: the code is read in the vertex stage by gl_VertexID, so only a drawn frame shows that each
// vertex takes its part's colour, the grey off the map, and nothing when the map is off.
const SHADER_COMPILE_TIMEOUT_MS = 60_000;
const SIZE = 16;
const GREY = new Vector3(0.21, 0.21, 0.21);

/** A flat quad whose four vertices carry the same shading fields. */
function patch(): BufferGeometry {
  const geometry = new PlaneGeometry(0.01, 0.01, 1, 1);
  const constant = (value: number) => new BufferAttribute(new Float32Array(4).fill(value), 1);
  geometry.setAttribute('_sulc', constant(0.5));
  geometry.setAttribute('_openness', constant(0.8));
  geometry.setAttribute('_t1', constant(0.5));
  return geometry;
}

const codeTexture = (bytes: number[], width = bytes.length) => {
  const texture = new DataTexture(Uint8Array.from(bytes), width, 1, RedFormat, UnsignedByteType);
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
};

function shared(mix: number, part: number): BodyMapShared {
  return {
    bodyMapMix: { value: mix },
    bodyMapPart: { value: part },
    bodyMapPalette: { value: paletteTexture(BODY_PART_COLORS) },
    bodyMapBase: { value: GREY.clone() },
  };
}

/** The cortex's material, its four vertices given `code`, or a plain one painted `colour`. */
function surface(
  geometry: BufferGeometry,
  palettes: Partial<SurfacePalettes>,
  setUp: (userData: AnatomicalUserData, material: Material & { color: Color }) => void,
) {
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
    { network: null, territory: null, thickness: null, bodyMap: null, ...palettes },
  );
  const userData = material.userData as AnatomicalUserData;
  userData.tissueVariation.value = 0;
  setUp(userData, material);
  return material;
}

const coded = (geometry: BufferGeometry, code: number, body: BodyMapShared) =>
  surface(geometry, { bodyMap: body }, ({ bodyMap }) => {
    bodyMap!.bodyMapCodes.value = codeTexture([code, code, code, code]);
    bodyMap!.bodyMapWidth.value = 4;
    bodyMap!.bodyMapReady.value = true;
  });

const painted = (geometry: BufferGeometry, colour: Color) =>
  surface(geometry, {}, (_, material) => material.color.copy(colour));

const partColour = (code: number) => {
  const [red, green, blue] = BODY_PART_COLORS[code - 1]!;
  return new Color().setRGB(red / 255, green / 255, blue / 255, SRGBColorSpace);
};

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

test(
  'BODY-05 the cortex draws each part in its colour where it wins and grey off the map, one part alone when picked',
  { timeout: SHADER_COMPILE_TIMEOUT_MS },
  () => {
    const geometry = patch();
    const grey = new Color().setRGB(GREY.x, GREY.y, GREY.z);
    for (const code of [1, 2, 3]) {
      const drawn = draw(geometry, coded(geometry, code, shared(1, 0)));
      // The same lighting over a surface painted the part's colour: only the colour lookup differs.
      expect(
        largestDifference(drawn, draw(geometry, painted(geometry, partColour(code)))),
        `part ${code}`,
      ).toBeLessThan(1e-3);
    }
    const off = draw(geometry, coded(geometry, 0, shared(1, 0)));
    expect(largestDifference(off, draw(geometry, painted(geometry, grey)))).toBeLessThan(1e-3);
    // The hand alone: the foot's cortex goes grey, the hand's keeps its colour.
    const footAlone = draw(geometry, coded(geometry, 1, shared(1, 2)));
    expect(largestDifference(footAlone, off)).toBeLessThan(1e-3);
    const handAlone = draw(geometry, coded(geometry, 2, shared(1, 2)));
    expect(
      largestDifference(handAlone, draw(geometry, painted(geometry, partColour(2)))),
    ).toBeLessThan(1e-3);
    // Off, the cortex keeps its own colour whatever its codes.
    const tissue = draw(geometry, painted(geometry, new Color('#8a7f78')));
    expect(
      largestDifference(draw(geometry, coded(geometry, 2, shared(0, 0))), tissue),
    ).toBeLessThan(1e-3);
    geometry.dispose();
  },
);

test(
  'BODY-05 thickness through the varying the two share draws as it does without the body map',
  { timeout: SHADER_COMPILE_TIMEOUT_MS },
  () => {
    const geometry = patch();
    const thicknessPalette = paletteTexture([[200, 40, 40]]);
    const thickened = (body: BodyMapShared | null) =>
      surface(geometry, { thickness: { value: thicknessPalette }, bodyMap: body }, (userData) => {
        userData.thickness!.thicknessCodes.value = codeTexture([1, 1, 1, 1]);
        userData.thickness!.thicknessWidth.value = 4;
        userData.thickness!.thicknessReady.value = true;
        userData.thicknessMix!.value = 1;
      });
    const alone = draw(geometry, thickened(null));
    expect(largestDifference(alone, draw(geometry, thickened(shared(0, 0))))).toBeLessThan(1e-6);
    // And differs from tissue, so the comparison above is not between two untinted surfaces.
    const tissue = draw(geometry, painted(geometry, new Color('#8a7f78')));
    expect(largestDifference(alone, tissue)).toBeGreaterThan(0.05);
    geometry.dispose();
  },
);
