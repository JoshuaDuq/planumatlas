import { expect, test } from 'vitest';
import {
  AmbientLight,
  Color,
  FloatType,
  Mesh,
  MeshPhysicalMaterial,
  OrthographicCamera,
  PlaneGeometry,
  SRGBColorSpace,
  Scene,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';
import type { WebGLProgramParametersWithUniforms } from 'three';
import { setPainted } from '../render/mri-material.ts';
import {
  addUserMapToCap,
  clearUserMapVolume,
  createUserMapUniforms,
  setUserMapDisplay,
  setUserMapOverlap,
  setUserMapVolume,
} from './overlay.ts';

// Real WebGL: a cut face's colour is what the fragment shader writes (SwiftShader compiles slowly).
const SHADER_COMPILE_TIMEOUT_MS = 30_000;
const OVERLAP = { map: [213, 81, 129], both: [0, 131, 0] } as const;
const PAINT = [208, 64, 48] as const;

const oetf = (value: number) =>
  value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;

/** The sRGB bytes a cut face draws where the map holds `value`, painted or not, against a function or not. */
function capAt(value: number, { painted, against }: { painted: boolean; against: boolean }) {
  const userMap = createUserMapUniforms();
  setUserMapDisplay(userMap, { threshold: 0.5, max: 1, opacity: 1 });
  setUserMapOverlap(userMap, against ? OVERLAP : null);
  // Each voxel's sum and share: the value everywhere.
  setUserMapVolume(
    userMap,
    { shape: [2, 2, 2], origin: [-0.5, -0.5, -0.5], spacing: 1 },
    new Float32Array(16).map((_, index) => (index % 2 ? 1 : value)),
  );
  const material = new MeshPhysicalMaterial({
    color: new Color().setRGB(PAINT[0] / 255, PAINT[1] / 255, PAINT[2] / 255, SRGBColorSpace),
  });
  // The solid's material gives the cap its world position (solid-material.ts).
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.vertexShader = `varying vec3 sourceWorld;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nsourceWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
    );
    shader.fragmentShader = `varying vec3 sourceWorld;\n${shader.fragmentShader}`;
  };
  addUserMapToCap(material, userMap);
  setPainted(material, painted);
  userMap.userMapOn.value = true;

  const renderer = new WebGLRenderer({ canvas: document.createElement('canvas') });
  const scene = new Scene();
  scene.add(new Mesh(new PlaneGeometry(0.0005, 0.0005), material), new AmbientLight(0xffffff, 1));
  const camera = new OrthographicCamera(-0.00025, 0.00025, 0.00025, -0.00025, 0.001, 1);
  camera.position.z = 0.01;
  const target = new WebGLRenderTarget(4, 4, { type: FloatType });
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  const pixel = new Float32Array(4);
  renderer.readRenderTargetPixels(target, 1, 1, 1, 1, pixel);
  target.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  material.dispose();
  clearUserMapVolume(userMap);
  return [0, 1, 2].map((channel) => Math.round(oetf(pixel[channel]!) * 255));
}

test(
  'FUNC-52 · against a function, a cut face draws the map in one colour off the paint and another on it',
  { timeout: SHADER_COMPILE_TIMEOUT_MS },
  () => {
    const against = { against: true };
    expect(capAt(0.8, { ...against, painted: false })).toEqual([...OVERLAP.map]);
    expect(capAt(0.8, { ...against, painted: true })).toEqual([...OVERLAP.both]);
    // Without the map, the paint stays beneath, in its hue; off it the face is grey.
    const [red, green, blue] = capAt(0.2, { ...against, painted: true });
    expect(red).toBeGreaterThan(2 * green!);
    expect(red).toBeGreaterThan(2 * blue!);
    const [grey, ...rest] = capAt(0.2, { ...against, painted: false });
    expect(rest).toEqual([grey, grey]);
    // A negative value is not activation: not drawn.
    expect(capAt(-0.8, { ...against, painted: false })).toEqual([grey, grey, grey]);
    // On its own scale the map is drawn whatever is painted, and the paint greys beneath it.
    expect(capAt(-0.8, { against: false, painted: true })).not.toEqual([grey, grey, grey]);
    const [r, g, b] = capAt(0.2, { against: false, painted: true });
    expect([g, b]).toEqual([r, r]);
  },
);
