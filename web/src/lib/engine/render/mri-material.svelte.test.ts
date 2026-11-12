import { expect, test } from 'vitest';
import {
  Color,
  Data3DTexture,
  DirectionalLight,
  FloatType,
  LinearFilter,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  OrthographicCamera,
  PlaneGeometry,
  RedFormat,
  SRGBColorSpace,
  Scene,
  UnsignedByteType,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';
import type { Material, WebGLProgramParametersWithUniforms } from 'three';
import {
  addUserMapToSurface,
  clearUserMapVolume,
  createUserMapUniforms,
  setUserMapDisplay,
  setUserMapVolume,
} from '../user-map/overlay.ts';
import {
  addMriCutAppearance,
  addMriSurfaceAppearance,
  createMriUniforms,
  setMriHighlight,
  setMriWindow,
  setPainted,
} from './mri-material.ts';
import type { MriUniforms } from './mri-material.ts';

// Real WebGL: what the scan looks like on a cut face or a surface is what the fragment shader writes.
const SIGNAL = 100;
// Each test compiles its own MeshPhysicalMaterial program on SwiftShader (0.1 to 0.3 s on an idle
// machine), which a loaded machine can stretch past the browser project's 15 s default.
const SHADER_COMPILE_TIMEOUT_MS = 30_000;

const oetf = (value: number) =>
  value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;
const eotf = (value: number) =>
  value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
const luma = ([red, green, blue]: number[]) => 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;

/** Deep enough that a surface's read 1 mm inside stays on the grid. */
const UNIFORM = [SIGNAL, SIGNAL, SIGNAL, SIGNAL];
/** Lit squarely, and so strongly that only the clamp keeps the light at 1. */
const SQUARE = { angle: 0, intensity: 3 * Math.PI };
/** 60° off the normal: about half the light. */
const OBLIQUE = { angle: Math.PI / 3, intensity: Math.PI };

/**
 * A scan of 1 mm voxels whose slabs along z hold `slabs`. The plane drawn at z = 0 lies halfway
 * between the middle two slabs, facing +z.
 */
function scan(slabs: number[], center: number, width: number) {
  const data = new Uint8Array(4 * slabs.length);
  slabs.forEach((value, z) => data.fill(value, 4 * z, 4 * z + 4));
  const texture = new Data3DTexture(data, 2, 2, slabs.length);
  texture.format = RedFormat;
  texture.type = UnsignedByteType;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  const uniforms = createMriUniforms({
    texture,
    worldToVoxel: new Matrix4()
      .makeTranslation(0.5, 0.5, slabs.length / 2 - 0.5)
      .multiply(new Matrix4().makeScale(1000, 1000, 1000)),
    volume: { shape: [2, 2, slabs.length] },
  });
  uniforms.scanEnabled.value = true;
  setMriWindow(uniforms, center, width);
  return uniforms;
}

/** The display colour drawn at the middle of a half-millimetre plane, under one directional light. */
function draw(material: Material, light = SQUARE): [number, number, number] {
  const renderer = new WebGLRenderer({ canvas: document.createElement('canvas') });
  const scene = new Scene();
  scene.add(new Mesh(new PlaneGeometry(0.0005, 0.0005), material));
  const sun = new DirectionalLight(0xffffff, light.intensity);
  sun.position.set(Math.sin(light.angle), 0, Math.cos(light.angle));
  scene.add(sun);
  const camera = new OrthographicCamera(-0.00025, 0.00025, 0.00025, -0.00025, 0.001, 1);
  camera.position.z = 0.01;
  const target = new WebGLRenderTarget(4, 4, { type: FloatType });
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  const pixel = new Float32Array(4);
  renderer.readRenderTargetPixels(target, 1, 1, 1, 1, pixel);
  target.dispose();
  renderer.dispose();
  // dispose() keeps the context; a live one counts against the browser's cap (scene.ts).
  renderer.forceContextLoss();
  return [oetf(pixel[0]!), oetf(pixel[1]!), oetf(pixel[2]!)];
}

function release(material: Material, uniforms: MriUniforms) {
  material.dispose();
  uniforms.scanVolume.value!.dispose();
}

/** A cut face of a constant scan, with `mark` as the mark amount. */
function cutFace(mark: string): [number, number, number] {
  // A window centred above the signal leaves the unmarked grey at 0.25, room for a lift.
  const uniforms = scan([SIGNAL, SIGNAL], 150, 200);
  setMriHighlight(uniforms, '#4fb6e0');
  const material = new MeshPhysicalMaterial();
  addMriCutAppearance(material, uniforms, mark);
  const tone = draw(material);
  release(material, uniforms);
  return tone;
}

function surface(slabs: number[], center: number, width: number, light = SQUARE) {
  const uniforms = scan(slabs, center, width);
  const material = new MeshPhysicalMaterial();
  addMriSurfaceAppearance(material, uniforms, 'inside');
  const tone = draw(material, light);
  release(material, uniforms);
  return tone;
}

test(
  'an unmarked cut face is the scan grey, with no hue',
  { timeout: SHADER_COMPILE_TIMEOUT_MS },
  () => {
    const [red, green, blue] = cutFace('0.0');
    // (100 - 150 + 100) / 200 of the window.
    expect(red).toBeCloseTo(0.25, 2);
    expect(green).toBeCloseTo(red, 3);
    expect(blue).toBeCloseTo(red, 3);
  },
);

test(
  'a marked cut face takes the accent as hue at the lifted grey, instead of washing toward white',
  { timeout: SHADER_COMPILE_TIMEOUT_MS },
  () => {
    const tone = cutFace('1.0');
    const [red, , blue] = tone;
    // The mark moves hue toward the accent (#4fb6e0 is blue-green)...
    expect(blue - red).toBeGreaterThan(0.2);
    // ...while luma is the grey lifted by 0.33, not white: a luminance-only mark would
    // read as brighter tissue.
    expect(luma(tone)).toBeCloseTo(0.25 + 0.33, 2);
    expect(luma(tone)).toBeLessThan(0.9);
  },
);

test(
  'a surface shows the scan grey where it is lit squarely, never brighter, and darker where it is not',
  { timeout: SHADER_COMPILE_TIMEOUT_MS },
  () => {
    const square = surface(UNIFORM, 150, 200);
    expect(square[0]).toBeCloseTo(0.25, 2);
    expect(square[1]).toBeCloseTo(square[0], 3);
    expect(square[2]).toBeCloseTo(square[0], 3);
    // Linear light: cos 60° of the light, less the little the surface reflects specularly.
    const oblique = surface(UNIFORM, 150, 200, OBLIQUE);
    const share = eotf(oblique[0]) / eotf(0.25);
    expect(share).toBeGreaterThan(0.4);
    expect(share).toBeLessThan(0.55);
  },
);

test(
  'a structure surface reads the tissue 1 mm inside itself, not the boundary it lies on',
  { timeout: SHADER_COMPILE_TIMEOUT_MS },
  () => {
    // Inside (behind the plane) is 10, outside 200; the boundary itself reads their mean, 105.
    const [gray] = surface([10, 10, 200, 200], 128, 256);
    expect(gray).toBeCloseTo(10 / 256, 2);
  },
);

test(
  'the cortex shows its mid-thickness T1, not the scan at its pial surface',
  { timeout: SHADER_COMPILE_TIMEOUT_MS },
  () => {
    const uniforms = scan([200, 200], 128, 256);
    const material = new MeshPhysicalMaterial();
    // The cortex's shading carries `_t1` as vT1 (materials.ts); here a constant 60.
    material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      shader.vertexShader = `varying float vT1;\n${shader.vertexShader}`.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvT1 = 60.0;',
      );
      shader.fragmentShader = `varying float vT1;\n${shader.fragmentShader}`;
    };
    addMriSurfaceAppearance(material, uniforms, 'mid-thickness');
    const [gray] = draw(material);
    release(material, uniforms);
    expect(gray).toBeCloseTo(60 / 256, 2);
  },
);

test(
  "the reader's map over a lit scan takes the scan's light",
  { timeout: SHADER_COMPILE_TIMEOUT_MS },
  () => {
    const mapped = (light: typeof SQUARE) => {
      const uniforms = scan(UNIFORM, 150, 200);
      const userMap = createUserMapUniforms();
      setUserMapDisplay(userMap, { threshold: 0, max: 1, opacity: 1 });
      setUserMapVolume(
        userMap,
        { shape: [2, 2, 2], origin: [-0.5, -0.5, -0.5], spacing: 1 },
        new Float32Array(16).map((_, index) => (index % 2 ? 1 : 0.8)),
      );
      userMap.userMapOverScan.value = true;
      const material = new MeshPhysicalMaterial();
      addUserMapToSurface(material, userMap);
      addMriSurfaceAppearance(material, uniforms, 'inside');
      const tone = draw(material, light);
      release(material, uniforms);
      clearUserMapVolume(userMap);
      return tone;
    };
    const square = mapped(SQUARE);
    // The map's colour, not the scan grey, is what is drawn.
    expect(Math.max(...square) - Math.min(...square)).toBeGreaterThan(0.2);
    const share = luma(mapped(OBLIQUE).map(eotf)) / luma(square.map(eotf));
    expect(share).toBeGreaterThan(0.4);
    expect(share).toBeLessThan(0.55);
  },
);

/** A function's paint colour, as the key spells it. */
const PAINT = [208, 64, 48] as const;

function painted(
  add: (material: MeshPhysicalMaterial, uniforms: MriUniforms) => void,
  light = SQUARE,
) {
  const uniforms = scan(UNIFORM, 150, 200);
  const material = new MeshPhysicalMaterial({
    color: new Color().setRGB(PAINT[0] / 255, PAINT[1] / 255, PAINT[2] / 255, SRGBColorSpace),
  });
  add(material, uniforms);
  setPainted(material, true);
  const tone = draw(material, light);
  release(material, uniforms);
  return tone;
}

test(
  'a painted surface shows its paint over the scan, in the light the scan takes',
  { timeout: SHADER_COMPILE_TIMEOUT_MS },
  () => {
    const surfacePaint = (light: typeof SQUARE) =>
      painted((material, uniforms) => addMriSurfaceAppearance(material, uniforms, 'inside'), light);
    const square = surfacePaint(SQUARE);
    square.forEach((channel, index) => expect(channel).toBeCloseTo(PAINT[index]! / 255, 2));
    const share = luma(surfacePaint(OBLIQUE).map(eotf)) / luma(square.map(eotf));
    expect(share).toBeGreaterThan(0.4);
    expect(share).toBeLessThan(0.55);
  },
);

test(
  "a painted cut face shows its paint unlit, in the key's colours",
  { timeout: SHADER_COMPILE_TIMEOUT_MS },
  () => {
    // Lit obliquely, which would darken it were it lit.
    const tone = painted(
      (material, uniforms) => addMriCutAppearance(material, uniforms, '0.0'),
      OBLIQUE,
    );
    tone.forEach((channel, index) => expect(channel).toBeCloseTo(PAINT[index]! / 255, 2));
  },
);
