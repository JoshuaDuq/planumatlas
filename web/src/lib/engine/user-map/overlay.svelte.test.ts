import { expect, test } from 'vitest';
import {
  AmbientLight,
  BufferAttribute,
  Color,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  FloatType,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  OrthographicCamera,
  PlaneGeometry,
  SRGBColorSpace,
  Scene,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';
import type { WebGLProgramParametersWithUniforms } from 'three';
import type { ColourScale } from '../../core/user-map/display.ts';
import type { Grid } from '../../core/user-map/sampling.ts';
import type { Region } from '../../types/index.ts';
import { createAnatomicalMaterial } from '../render/materials.ts';
import { setPainted } from '../render/mri-material.ts';
import { appearance } from '../render/test-support.ts';
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

interface Drawn {
  value: number;
  colours?: ColourScale;
  opacity?: number;
  /** The value of the volume a series is moving on from: this map is the one moving. */
  previous?: number;
}

/** A 2×2×2 volume holding `value` everywhere, as (sum, share) pairs. */
const filled = (value: number) => new Float32Array(16).map((_, index) => (index % 2 ? 1 : value));
const GRID: Grid = { shape: [2, 2, 2], origin: [-0.5, -0.5, -0.5], spacing: 1 };

/** The sRGB bytes a cut face draws where the map holds `value`, painted or not, against a function or not. */
function capAt(value: number, { painted, against }: { painted: boolean; against: boolean }) {
  return capOf([{ value }], { painted, against, top: 0 });
}

/** The sRGB bytes a cut face draws where each slot's map holds its value, `top` drawn over the other. */
function capOf(
  maps: Drawn[],
  {
    painted,
    against,
    top,
    blend = 1,
  }: { painted: boolean; against: boolean; top: number; blend?: number },
) {
  const userMap = createUserMapUniforms();
  setUserMapOverlap(userMap, against ? OVERLAP : null);
  userMap.userMapTop.value = top;
  for (const [slot, { value, colours = 'red-yellow', opacity = 1, previous }] of maps.entries()) {
    setUserMapDisplay(userMap, slot, { threshold: 0.5, max: 1, opacity, colours });
    // Each voxel's sum and share: the value everywhere.
    if (previous !== undefined) setUserMapVolume(userMap, slot, GRID, filled(previous));
    setUserMapVolume(userMap, slot, GRID, filled(value), previous !== undefined);
  }
  userMap.userMapBlend.value = blend;
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
  for (const slot of maps.keys()) clearUserMapVolume(userMap, slot);
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

test(
  'FUNC-60 · two maps on a cut face: each in its own scale, the one on top drawn over the other',
  { timeout: SHADER_COMPILE_TIMEOUT_MS },
  () => {
    const off = { painted: false, against: false };
    // 0.8 is 60% up each scale from the threshold 0.5 to the top 1.
    const warm = [255, 153, 0];
    const green = [0, 214, 0];
    const both: Drawn[] = [{ value: 0.8 }, { value: 0.8, colours: 'green-magenta' }];
    expect(capOf(both, { ...off, top: 1 })).toEqual(green);
    expect(capOf(both, { ...off, top: 0 })).toEqual(warm);
    // Where the top map has no value beyond its threshold, the one under shows.
    expect(
      capOf([{ value: 0.8 }, { value: 0.2, colours: 'green-magenta' }], { ...off, top: 1 }),
    ).toEqual(warm);
    // Half see-through on top: mixed in linear light, the bytes the Linked MRI draws (sampling.test.ts).
    expect(
      capOf([{ value: 0.8 }, { value: 0.8, colours: 'green-magenta', opacity: 0.5 }], {
        ...off,
        top: 1,
      }),
    ).toEqual([Math.round(oetf(0.5) * 255), 187, 0]);
  },
);

/**
 * The cortex's lit colour where each slot's map holds its value at every vertex (`_user_map`: the
 * first map's sum and share in xy, the second's in zw), `ready` saying which slots have painted it.
 */
function cortexOf(
  maps: (Drawn | null)[],
  {
    top,
    ready = [true, true],
    blend = 1,
  }: { top: number; ready?: [boolean, boolean]; blend?: number },
) {
  const userMap = createUserMapUniforms();
  userMap.userMapTop.value = top;
  userMap.userMapBase.value.set(0.2, 0.2, 0.2);
  const geometry = new PlaneGeometry(0.0005, 0.0005);
  const count = geometry.getAttribute('position').count;
  for (const name of ['_sulc', '_openness', '_t1']) {
    geometry.setAttribute(name, new Float32BufferAttribute(new Float32Array(count).fill(0.5), 1));
  }
  const values = new Float32Array(4 * count);
  const previous = new Float32Array(4 * count);
  for (const [slot, map] of maps.entries()) {
    if (!map) continue;
    const { value, colours = 'red-yellow', opacity = 1 } = map;
    setUserMapDisplay(userMap, slot, { threshold: 0.5, max: 1, opacity, colours });
    for (let v = 0; v < count; v++) {
      values.set([value, 1], 4 * v + 2 * slot);
      previous.set([map.previous ?? value, 1], 4 * v + 2 * slot);
    }
    if (map.previous !== undefined) userMap.userMapMoving.value = slot;
  }
  geometry.setAttribute('_user_map', new BufferAttribute(values, 4));
  geometry.setAttribute('_user_map_previous', new BufferAttribute(previous, 4));
  userMap.userMapBlend.value = blend;
  const mesh = new Mesh(
    geometry,
    new MeshStandardMaterial({ color: '#336699', roughness: 0.3, side: DoubleSide }),
  );
  const material = createAnatomicalMaterial(
    mesh,
    { id: 'r', kind: 'cortex' } as Region,
    appearance,
    null,
    userMap,
  );
  ready.forEach((on, slot) => (material.userData['userMapReady'][slot].value = on));
  const renderer = new WebGLRenderer({ canvas: document.createElement('canvas') });
  const scene = new Scene();
  const sun = new DirectionalLight(0xffffff, Math.PI);
  sun.position.set(0.3, 0.2, 1);
  scene.add(new Mesh(geometry, material), sun, new AmbientLight(0xffffff, 0.4));
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
  return Array.from(pixel.subarray(0, 3));
}

test(
  'FUNC-60 · the cortex reads each map from its own half of a vertex, the one on top drawn over',
  { timeout: SHADER_COMPILE_TIMEOUT_MS },
  () => {
    const warm: Drawn = { value: 0.8 };
    const green: Drawn = { value: 0.8, colours: 'green-magenta' };
    const firstAlone = cortexOf([warm, null], { top: 0 });
    const secondAlone = cortexOf([null, green], { top: 1 });
    expect(firstAlone).not.toEqual(secondAlone);
    expect(cortexOf([warm, green], { top: 1 })).toEqual(secondAlone);
    expect(cortexOf([warm, green], { top: 0 })).toEqual(firstAlone);
    // Below its threshold, or not yet painted on this mesh, the top map leaves the other showing.
    expect(cortexOf([warm, { ...green, value: 0.2 }], { top: 1 })).toEqual(firstAlone);
    expect(cortexOf([warm, green], { top: 1, ready: [true, false] })).toEqual(firstAlone);
    // Half see-through on top: the second's green over the first's warm colour, both in the mix.
    const [r, g, b] = cortexOf([warm, { ...green, opacity: 0.5 }], { top: 1 });
    expect(r).toBeGreaterThan(secondAlone[0]!);
    expect(r).toBeLessThan(firstAlone[0]!);
    expect(g).toBeGreaterThan(firstAlone[1]!);
    expect(b).toBeCloseTo(firstAlone[2]!, 6);
  },
);

test(
  'FUNC-60 · a series moving in either slot moves only its own map, on the cortex and on a cut face',
  { timeout: SHADER_COMPILE_TIMEOUT_MS },
  () => {
    // Moving on from 0.2 (below the threshold) to 0.8: at the start of the move it is not drawn.
    const warm: Drawn = { value: 0.8 };
    const green: Drawn = { value: 0.8, colours: 'green-magenta' };
    const firstAlone = cortexOf([warm, null], { top: 0 });
    const secondAlone = cortexOf([null, green], { top: 1 });
    const grey = cortexOf([{ ...warm, value: 0.2 }, null], { top: 0 });
    expect(cortexOf([{ ...warm, previous: 0.2 }, null], { top: 0, blend: 0 })).toEqual(grey);
    expect(cortexOf([{ ...warm, previous: 0.2 }, null], { top: 0, blend: 1 })).toEqual(firstAlone);
    expect(cortexOf([null, { ...green, previous: 0.2 }], { top: 1, blend: 0 })).toEqual(grey);
    expect(cortexOf([null, { ...green, previous: 0.2 }], { top: 1, blend: 1 })).toEqual(
      secondAlone,
    );
    // The other map stays where it is while the moving one starts over.
    expect(cortexOf([warm, { ...green, previous: 0.2 }], { top: 1, blend: 0 })).toEqual(firstAlone);
    expect(cortexOf([{ ...warm, previous: 0.2 }, green], { top: 0, blend: 0 })).toEqual(
      secondAlone,
    );

    const off = { painted: false, against: false };
    const warmBytes = [255, 153, 0];
    const greenBytes = [0, 214, 0];
    expect(capOf([warm, { ...green, previous: 0.2 }], { ...off, top: 1, blend: 0 })).toEqual(
      warmBytes,
    );
    expect(capOf([warm, { ...green, previous: 0.2 }], { ...off, top: 1, blend: 1 })).toEqual(
      greenBytes,
    );
    expect(capOf([{ ...warm, previous: 0.2 }, green], { ...off, top: 0, blend: 0 })).toEqual(
      greenBytes,
    );
    expect(capOf([{ ...warm, previous: 0.2 }, green], { ...off, top: 0, blend: 1 })).toEqual(
      warmBytes,
    );
  },
);
