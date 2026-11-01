import { DataTexture, FloatType, Matrix4, RGBAFormat, Vector3 } from 'three';
import type {
  Data3DTexture,
  IUniform,
  Material,
  WebGLProgramParametersWithUniforms,
  WebGLRenderer,
} from 'three';
import { LABEL_AT } from './label-sampling.ts';
import type { Label } from './palette.ts';

/** The cut atlas whose voxels give the striatum its network colours. */
export const STRIATAL_ATLAS = 'choi';

/**
 * The striatal network volume the cut and the caps read for colour only.
 *
 * Yeo colouring paints a cut label by the network holding most of its region,
 * and a caudate or putamen label has none: the striatum's networks vary voxel
 * by voxel (Choi et al. 2012). With these set, a striatal voxel takes its own
 * network's colour whatever labels the cut draws; which region it is, whether
 * it shows and how it lights stay with the cut's own labels. A voxel Choi et al. are not confident
 * of, or that the atlas only filled, is drawn paler.
 */
export interface StriatalUniforms {
  striatalEnabled: IUniform<boolean>;
  striatalVolume: IUniform<Data3DTexture | null>;
  striatalPalette: IUniform<DataTexture | null>;
  worldToStriatal: IUniform<Matrix4>;
  striatalShape: IUniform<Vector3>;
  striatalConfidence: IUniform<Data3DTexture | null>;
  worldToConfidence: IUniform<Matrix4>;
  confidenceShape: IUniform<Vector3>;
  [uniform: string]: IUniform;
}

/** The confidence class a voxel at or above the minimum confidence has (`tissue-labels.json`). */
export const CONFIDENT = 3;
/** How far toward its own grey a less confident voxel's network colour is drawn. */
export const UNCERTAIN_FADE = 0.65;

export function createStriatalUniforms(): StriatalUniforms {
  return {
    striatalEnabled: { value: false },
    striatalVolume: { value: null },
    striatalPalette: { value: null },
    worldToStriatal: { value: new Matrix4() },
    striatalShape: { value: new Vector3() },
    striatalConfidence: { value: null },
    worldToConfidence: { value: new Matrix4() },
    confidenceShape: { value: new Vector3() },
  };
}

/** `striatalColour(rgb, world)`: the network colour of the striatal voxel at `world`, else `rgb`. */
export const STRIATAL_COLOUR = `
${LABEL_AT}
uniform bool striatalEnabled;
uniform highp usampler3D striatalVolume;
uniform sampler2D striatalPalette;
uniform mat4 worldToStriatal;
uniform ivec3 striatalShape;
uniform highp usampler3D striatalConfidence;
uniform mat4 worldToConfidence;
uniform ivec3 confidenceShape;

vec3 striatalColour(vec3 rgb, vec3 world) {
  if (!striatalEnabled) return rgb;
  uint code = labelAt(striatalVolume, striatalShape, (worldToStriatal * vec4(world, 1.0)).xyz);
  vec4 network = texelFetch(striatalPalette, ivec2(int(code), 0), 0);
  if (network.a < 0.5) return rgb;
  uint grade = labelAt(striatalConfidence, confidenceShape, (worldToConfidence * vec4(world, 1.0)).xyz);
  float grey = dot(network.rgb, vec3(0.2126, 0.7152, 0.0722));
  return grade < ${CONFIDENT}u ? mix(network.rgb, vec3(grey), ${UNCERTAIN_FADE.toFixed(2)}) : network.rgb;
}
`;

/** Each striatal network label in its published colour, opaque; every other label transparent. */
export function striatalPaletteData(labels: readonly Label[]): Float32Array {
  const data = new Float32Array(labels.length * 4);
  for (const [code, label] of labels.entries()) {
    if (!label.region_id?.startsWith(`${STRIATAL_ATLAS}:`)) continue;
    // The palette is linear, as the cut's own palette is after `setPublished`.
    const [red, green, blue] = label.color.map((channel) => srgbToLinear(channel / 255));
    data.set([red!, green!, blue!, 1], code * 4);
  }
  return data;
}

export function createStriatalPalette(labels: readonly Label[]): DataTexture {
  const palette = new DataTexture(
    striatalPaletteData(labels),
    labels.length,
    1,
    RGBAFormat,
    FloatType,
  );
  palette.needsUpdate = true;
  return palette;
}

function srgbToLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** Let a cap take the striatal network colour where its solid is a striatal structure. */
export function addStriatalOverlay(material: Material, uniforms: StriatalUniforms): void {
  material.userData.striatalHere = { value: false };
  const compile = material.onBeforeCompile;
  const key = material.customProgramCacheKey();
  material.onBeforeCompile = (
    shader: WebGLProgramParametersWithUniforms,
    renderer: WebGLRenderer,
  ) => {
    compile.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.uniforms.striatalHere = material.userData.striatalHere;
    shader.fragmentShader = `
      uniform bool striatalHere;
      ${STRIATAL_COLOUR}
      ${shader.fragmentShader}`.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
        if (striatalHere) diffuseColor.rgb = striatalColour(diffuseColor.rgb, sourceWorld);`,
    );
  };
  material.customProgramCacheKey = () => `${key}-striatal-v1`;
}
