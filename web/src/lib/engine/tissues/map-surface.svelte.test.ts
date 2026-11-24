import { expect, test } from 'vitest';
import {
  DirectionalLight,
  FloatType,
  Mesh,
  MeshPhysicalMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';
import { HIGHLIGHT_LIFT } from './highlight.ts';
import { addSurfaceMap, drawsSurfaceMap, surfaceMapUniforms } from './map-surface.ts';
import type { SurfaceMap } from './map-surface.ts';
import { D2, M3, surfaceMap } from './map-surface-test-support.ts';

// Real WebGL: the colour a surface takes is what its fragment shader writes.
const SHADER_COMPILE_TIMEOUT_MS = 30_000;

/** The linear colour drawn at the middle of a half-millimetre plane facing the light and the camera. */
function draw(map: SurfaceMap, drawn = true): [number, number, number] {
  const renderer = new WebGLRenderer({ canvas: document.createElement('canvas') });
  const scene = new Scene();
  const material = new MeshPhysicalMaterial();
  addSurfaceMap(material, surfaceMapUniforms(map));
  drawsSurfaceMap(material)!.value = drawn;
  scene.add(new Mesh(new PlaneGeometry(0.0005, 0.0005), material));
  const sun = new DirectionalLight(0xffffff, Math.PI);
  sun.position.set(0, 0, 1);
  scene.add(sun);
  const camera = new OrthographicCamera(-0.00025, 0.00025, 0.00025, -0.00025, 0.001, 1);
  camera.position.z = 0.01;
  const target = new WebGLRenderTarget(4, 4, { type: FloatType });
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  const pixel = new Float32Array(4);
  renderer.readRenderTargetPixels(target, 1, 1, 1, 1, pixel);
  target.dispose();
  material.dispose();
  map.texture.dispose();
  map.palette.dispose();
  renderer.dispose();
  // dispose() keeps the context; a live one counts against the browser's cap (scene.ts).
  renderer.forceContextLoss();
  return [pixel[0]!, pixel[1]!, pixel[2]!];
}

test(
  'a surface takes the colour of the map region 1 mm inside it, not of the label at its boundary',
  { timeout: SHADER_COMPILE_TIMEOUT_MS },
  () => {
    const [red, green, blue] = draw(surfaceMap(M3, D2));
    expect(red).toBeGreaterThan(4 * blue);
    expect(green).toBeCloseTo(blue, 3);
  },
);

test(
  'where the map labels no region, or the surface is not drawing it, the surface keeps its own colour',
  { timeout: SHADER_COMPILE_TIMEOUT_MS },
  () => {
    for (const tone of [draw(surfaceMap(1, M3)), draw(surfaceMap(M3, D2), false)]) {
      expect(tone[0]).toBeGreaterThan(0.2);
      expect(tone[1]).toBeCloseTo(tone[0], 3);
      expect(tone[2]).toBeCloseTo(tone[0], 3);
    }
  },
);

test(
  'the pointed-at map region is lifted on the surface as on its cut face',
  { timeout: SHADER_COMPILE_TIMEOUT_MS },
  () => {
    const plain = draw(surfaceMap(M3, D2));
    const pointed = surfaceMap(M3, D2);
    pointed.highlightCodes.set(M3, -1);
    pointed.highlightLifts.set(HIGHLIGHT_LIFT.hovered, 0);
    const lifted = draw(pointed);
    // Toward white: the dark channels rise most.
    expect(lifted[2] - plain[2]).toBeGreaterThan(0.05);
    expect(lifted[0]).toBeGreaterThanOrEqual(plain[0]);
  },
);
