// Imported when borders are first drawn: none of it, the cortex's patch included, is needed before (BUILD-15).
import type {
  DataTexture,
  IUniform,
  Material,
  WebGLProgramParametersWithUniforms,
  WebGLRenderer,
} from 'three';
import type { Region } from '../../types/index.ts';
import type { SurfaceHit } from '../render/picking.ts';
import type { AtlasMesh, Layer } from './layers.ts';
import { attachVertexCodes } from './vertex-codes.ts';
import { cornerWeights } from './visual-field.ts';

/** A patched cortical material's borders: drawn or not, and its mesh's bytes for the atlas drawn. */
export interface BordersUniforms {
  bordersMix: IUniform<number>;
  bordersCodes: IUniform<DataTexture | null>;
  bordersWidth: IUniform<number>;
  bordersReady: IUniform<boolean>;
}

/** A mesh's bytes for the atlas drawn, kept to name the point under the pointer (`bordersRegionAt`). */
interface BorderNames {
  overlay: string;
  classes: Uint8Array;
  /** The atlas's source label plus one, 0 for none. */
  labels: Uint8Array;
}

/** A published byte: one to three of the five classes' bits (no area, then classes 1 to 4). */
export const isBorderByte = (byte: number): boolean =>
  byte > 0 && byte < 32 && [1, 2, 4, 8, 16].filter((bit) => byte & bit).length <= 3;

/** The borders' line: a light core cased in dark, half-widths in device pixels, linear values (`BORDER_INK`). */
const LINE = { core: 0.75, casing: 1.75, light: 0.9, dark: 0.012 };

const VERTEX_DECLARATIONS = `uniform highp sampler2D bordersCodes;
uniform int bordersWidth;
uniform bool bordersReady;
uniform float bordersMix;
varying vec4 vBorders;`;

/*
 * Each class the vertex's byte holds takes an equal share of it: classes 1-4 in the four channels, no
 * area (bit 0) the remainder. Interpolated, two shares meet on the border the vertex cells put there.
 */
const VERTEX = `vBorders = vec4(0.0);
if (bordersMix > 0.5 && bordersReady) {
  int bordersBits = int(texelFetch(bordersCodes, ivec2(gl_VertexID % bordersWidth, gl_VertexID / bordersWidth), 0).r * 255.0 + 0.5);
  vec4 bordersIn = vec4(notEqual(ivec4(bordersBits) & ivec4(2, 4, 8, 16), ivec4(0)));
  vBorders = bordersIn / (dot(bordersIn, vec4(1.0)) + float(bordersBits & 1));
}`;

/*
 * Last, so the lines stay over every colouring, the scan and the reader's maps; the core takes the light a
 * white surface would reflect. The gap's own slope breaks at the border, so each share's slope is used.
 */
const FRAGMENT = `
        if (bordersMix > 0.5) {
          vec4 bordersSlopes = fwidth(vBorders);
          float bordersShare[5] = float[5](vBorders.x, vBorders.y, vBorders.z, vBorders.w,
            1.0 - dot(vBorders, vec4(1.0)));
          float bordersSlope[5] = float[5](bordersSlopes.x, bordersSlopes.y, bordersSlopes.z,
            bordersSlopes.w, fwidth(dot(vBorders, vec4(1.0))));
          int bordersFirst = 0;
          int bordersSecond = 1;
          if (bordersShare[1] > bordersShare[0]) {
            bordersFirst = 1;
            bordersSecond = 0;
          }
          for (int i = 2; i < 5; i++) {
            if (bordersShare[i] > bordersShare[bordersFirst]) {
              bordersSecond = bordersFirst;
              bordersFirst = i;
            } else if (bordersShare[i] > bordersShare[bordersSecond]) {
              bordersSecond = i;
            }
          }
          float bordersPixels = (bordersShare[bordersFirst] - bordersShare[bordersSecond])
            / max(bordersSlope[bordersFirst] + bordersSlope[bordersSecond], 1e-6);
          float bordersCore = 1.0 - smoothstep(${LINE.core - 0.5}, ${LINE.core + 0.5}, bordersPixels);
          float bordersCased = 1.0 - smoothstep(${LINE.casing - 0.5}, ${LINE.casing + 0.5}, bordersPixels);
          vec3 bordersLuma = vec3(0.2126, 0.7152, 0.0722);
          float bordersLight = min(dot(reflectedLight.directDiffuse + reflectedLight.indirectDiffuse,
            bordersLuma) / max(dot(material.diffuseColor, bordersLuma), 1e-3), 1.0);
          vec3 bordersInk = mix(vec3(${LINE.dark}), vec3(${LINE.light}) * bordersLight, bordersCore);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, bordersInk, bordersCased);
        }`;

/**
 * Teach a cortical material (`createAnatomicalMaterial`) to draw another atlas's borders, read by vertex
 * index as its thickness is, so the cortex gains no vertex attribute. It draws none until given bytes.
 */
export function addAtlasBorders(material: Material): void {
  const uniforms: BordersUniforms = {
    bordersMix: { value: 0 },
    bordersCodes: { value: null },
    bordersWidth: { value: 1 },
    bordersReady: { value: false },
  };
  material.userData['borders'] = uniforms;
  const compile = material.onBeforeCompile;
  const key = material.customProgramCacheKey();
  material.onBeforeCompile = (
    shader: WebGLProgramParametersWithUniforms,
    renderer: WebGLRenderer,
  ) => {
    compile.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `${VERTEX_DECLARATIONS}\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>\n${VERTEX}`,
    );
    shader.fragmentShader =
      `varying vec4 vBorders;\nuniform float bordersMix;\n${shader.fragmentShader}`.replace(
        '#include <tonemapping_fragment>',
        `${FRAGMENT}\n#include <tonemapping_fragment>`,
      );
  };
  material.customProgramCacheKey = () => `${key}-borders`;
  material.needsUpdate = true;
}

/**
 * Give each mesh of `atlas`'s cortex its vertices' bytes for `overlay`'s borders: their classes, which the
 * cortex draws (`attachVertexCodes`), then their labels, which name a point. A byte no vertex can hold,
 * or a label naming no region of `overlay` on its region's side, refuses the file whole.
 */
export function attachBorders(
  layer: Pick<Layer, 'meshes'>,
  field: Uint8Array,
  regions: readonly Region[],
  atlas: string,
  overlay: string,
): void {
  const classes = field.subarray(0, field.length / 2);
  const labels = field.subarray(field.length / 2);
  if (field.length % 2 || !classes.every(isBorderByte)) {
    throw new Error(`The ${overlay} borders on ${atlas} hold a byte no vertex can.`);
  }
  const ids = new Set(regions.map(({ id }) => id));
  let at = 0;
  for (const region of regions.filter((entry) => entry.atlas === atlas)) {
    for (const byte of new Set(labels.subarray(at, (at += region.vertex_count!)))) {
      if (!ids.has(`${overlay}:${region.hemisphere}:${byte - 1}`)) {
        throw new Error(
          `The ${overlay} borders on ${atlas} name no ${overlay} region ${byte - 1}.`,
        );
      }
    }
  }
  const placed = attachVertexCodes(layer, classes, regions, atlas, `${overlay} borders`, (data) => {
    const borders = (data as { borders?: BordersUniforms }).borders;
    return borders
      ? { codes: borders.bordersCodes, width: borders.bordersWidth, ready: borders.bordersReady }
      : null;
  });
  for (const [mesh, start] of placed) {
    const end = start + mesh.geometry.getAttribute('position').count;
    const names: BorderNames = {
      overlay,
      classes: classes.subarray(start, end),
      labels: labels.subarray(start, end),
    };
    mesh.userData['borderNames'] = names;
  }
}

/**
 * The region of the atlas whose borders a cortical mesh draws where a ray met it, as the line is drawn: the
 * class with the largest share of the triangle's corners at the point, each corner's share split evenly
 * over its classes, named by the nearest corner holding that class alone. On a tie the class a corner holds
 * alone wins. A non-region is named as such. Null off a mesh drawing borders.
 */
export function bordersRegionAt(
  hit: SurfaceHit,
  regions: ReadonlyMap<string, Region>,
): Region | null {
  const mesh = hit.object as AtlasMesh | undefined;
  const names = mesh?.userData['borderNames'] as BorderNames | undefined;
  if (!mesh || !hit.face || !names) return null;
  const weights = cornerWeights(mesh, hit.point, hit.face);
  if (!weights) return null;
  const corners = [hit.face.a, hit.face.b, hit.face.c];
  const shares = [0, 0, 0, 0, 0];
  const held = (code: number) => [1, 2, 4, 8, 16].filter((bit) => code & bit).length;
  corners.forEach((corner, k) => {
    const code = names.classes[corner]!;
    for (let value = 0; value < 5; value++) {
      if (code & (1 << value)) shares[value]! += weights.getComponent(k) / held(code);
    }
  });
  const alone = (value: number) => corners.filter((corner) => names.classes[corner] === 1 << value);
  let best = shares.indexOf(Math.max(...shares));
  for (let value = 0; value < 5; value++) {
    if (shares[value] === shares[best] && !alone(best).length && alone(value).length) best = value;
  }
  const [corner] = alone(best).sort(
    (a, b) => weights.getComponent(corners.indexOf(b)) - weights.getComponent(corners.indexOf(a)),
  );
  if (corner === undefined) throw new Error(`No corner holds border class ${best} alone here.`);
  const side = regions.get(mesh.userData['region_id'] as string)!.hemisphere;
  const id = `${names.overlay}:${side}:${names.labels[corner]! - 1}`;
  const region = regions.get(id);
  if (!region) throw new Error(`Unknown region: ${id}`);
  return region;
}
