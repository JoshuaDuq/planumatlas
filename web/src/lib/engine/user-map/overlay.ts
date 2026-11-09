import { Data3DTexture, FloatType, Matrix4, NearestFilter, RGFormat, Vector3 } from 'three';
import type { IUniform, Material, WebGLProgramParametersWithUniforms, WebGLRenderer } from 'three';
import { NEGATIVE_RAMP, POSITIVE_RAMP } from '../../core/user-map/display.ts';
import type { MapDisplay } from '../../core/user-map/display.ts';
import type { Grid } from '../../core/user-map/sampling.ts';
import { ANATOMICAL_WORLD, EXPLODE_SHIFT_UNIFORM, explodeShift } from '../model/explode.ts';

/** Where the map has no value: GLSL cannot be trusted to keep a NaN through a fast-math compile. */
export const NO_DATA = -3e38;

/** The reader's map, shared by every cortical material and every cut face. */
export interface UserMapUniforms {
  userMapOn: IUniform<boolean>;
  /** The scan colours the surfaces, so the map is drawn over it, in the scan's light. */
  userMapOverScan: IUniform<boolean>;
  userMapThreshold: IUniform<number>;
  userMapMax: IUniform<number>;
  userMapOpacity: IUniform<number>;
  /** The cortex's colour while the map is on, linear. */
  userMapBase: IUniform<Vector3>;
  userMapVolume: IUniform<Data3DTexture | null>;
  /** The volume drawn before, held while a series moves from it to `userMapVolume`. */
  userMapPrevious: IUniform<Data3DTexture | null>;
  /** How far a series has moved from the previous volume to this one: 1 draws this one alone. */
  userMapBlend: IUniform<number>;
  worldToUserMap: IUniform<Matrix4>;
  userMapShape: IUniform<Vector3>;
  [uniform: string]: IUniform;
}

export function createUserMapUniforms(): UserMapUniforms {
  return {
    userMapOn: { value: false },
    userMapOverScan: { value: false },
    userMapThreshold: { value: 0 },
    userMapMax: { value: 1 },
    userMapOpacity: { value: 1 },
    userMapBase: { value: new Vector3() },
    userMapVolume: { value: null },
    userMapPrevious: { value: null },
    userMapBlend: { value: 1 },
    worldToUserMap: { value: new Matrix4() },
    userMapShape: { value: new Vector3() },
  };
}

export function setUserMapDisplay(uniforms: UserMapUniforms, display: MapDisplay | null): void {
  uniforms.userMapOn.value = display !== null;
  if (!display) return;
  uniforms.userMapThreshold.value = display.threshold;
  uniforms.userMapMax.value = display.max;
  uniforms.userMapOpacity.value = display.opacity;
}

/**
 * The map's sum and share (`resample`) on a 1 mm grid of this brain as an RG32F texture, read with
 * texelFetch. With `keepPrevious` the volume drawn until now is held to blend from, on the same grid.
 */
export function setUserMapVolume(
  uniforms: UserMapUniforms,
  grid: Grid,
  values: Float32Array,
  keepPrevious = false,
): void {
  const [nx, ny, nz] = grid.shape;
  if (values.length !== 2 * nx * ny * nz) throw new Error('The map volume does not fill its grid.');
  const texture = new Data3DTexture(values, nx, ny, nz);
  texture.format = RGFormat;
  texture.type = FloatType;
  texture.internalFormat = 'RG32F';
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  dropPrevious(uniforms);
  if (keepPrevious) uniforms.userMapPrevious.value = uniforms.userMapVolume.value;
  else uniforms.userMapVolume.value?.dispose();
  uniforms.userMapVolume.value = texture;
  uniforms.userMapShape.value.set(nx, ny, nz);
  // World (glTF metres: x right, y superior, z posterior) to the grid's voxels in surface RAS.
  const [ox, oy, oz] = grid.origin;
  const s = grid.spacing;
  // prettier-ignore
  uniforms.worldToUserMap.value.set(
    1000 / s, 0, 0, -ox / s,
    0, 0, -1000 / s, -oy / s,
    0, 1000 / s, 0, -oz / s,
    0, 0, 0, 1,
  );
}

/** Free the volume blended from, once the series has arrived at the next. */
export function dropPrevious(uniforms: UserMapUniforms): void {
  uniforms.userMapPrevious.value?.dispose();
  uniforms.userMapPrevious.value = null;
  uniforms.userMapBlend.value = 1;
}

export function clearUserMapVolume(uniforms: UserMapUniforms): void {
  dropPrevious(uniforms);
  uniforms.userMapVolume.value?.dispose();
  uniforms.userMapVolume.value = null;
  uniforms.userMapOn.value = false;
}

const vec3 = (rgb: readonly number[]) => `vec3(${rgb.map((c) => c.toFixed(1)).join(', ')})`;

/** `userMapColour(value)`: the sRGB colour of a value and the map's opacity, or 0 alpha where it is not drawn. */
export const USER_MAP_COLOUR = `
uniform bool userMapOn;
uniform bool userMapOverScan;
uniform float userMapThreshold;
uniform float userMapMax;
uniform float userMapOpacity;
vec4 userMapColour(float value) {
  float magnitude = abs(value);
  if (!(magnitude > userMapThreshold) || value < ${NO_DATA.toExponential()} * 0.5) return vec4(0.0);
  float share = min(1.0, (magnitude - userMapThreshold) / (userMapMax - userMapThreshold));
  vec3 colour = value > 0.0
    ? mix(${vec3(POSITIVE_RAMP[0])}, ${vec3(POSITIVE_RAMP[1])}, share)
    : mix(${vec3(NEGATIVE_RAMP[0])}, ${vec3(NEGATIVE_RAMP[1])}, share);
  return vec4(colour, userMapOpacity);
}
`;

/**
 * `userMapAt(world)`: sum and share trilinear between the voxel centres, their quotient where the share is
 * at least half (`valueOf`), NO_DATA elsewhere. While a series moves between volumes, the pairs of both
 * are mixed first, so the values pass linearly from one volume to the next.
 */
const USER_MAP_AT = `
uniform highp sampler3D userMapVolume;
uniform highp sampler3D userMapPrevious;
uniform float userMapBlend;
uniform mat4 worldToUserMap;
uniform vec3 userMapShape;
vec2 userMapPair(highp sampler3D volume, ivec3 base, vec3 f) {
  vec2 c000 = texelFetch(volume, base, 0).rg;
  vec2 c100 = texelFetch(volume, base + ivec3(1, 0, 0), 0).rg;
  vec2 c010 = texelFetch(volume, base + ivec3(0, 1, 0), 0).rg;
  vec2 c110 = texelFetch(volume, base + ivec3(1, 1, 0), 0).rg;
  vec2 c001 = texelFetch(volume, base + ivec3(0, 0, 1), 0).rg;
  vec2 c101 = texelFetch(volume, base + ivec3(1, 0, 1), 0).rg;
  vec2 c011 = texelFetch(volume, base + ivec3(0, 1, 1), 0).rg;
  vec2 c111 = texelFetch(volume, base + ivec3(1, 1, 1), 0).rg;
  return mix(
    mix(mix(c000, c100, f.x), mix(c010, c110, f.x), f.y),
    mix(mix(c001, c101, f.x), mix(c011, c111, f.x), f.y),
    f.z);
}
float userMapAt(vec3 world) {
  vec3 voxel = (worldToUserMap * vec4(world, 1.0)).xyz;
  if (any(lessThan(voxel, vec3(0.0))) || any(greaterThan(voxel, userMapShape - 1.0))) {
    return ${NO_DATA.toExponential()};
  }
  ivec3 base = min(ivec3(floor(voxel)), ivec3(userMapShape) - 2);
  vec3 f = voxel - vec3(base);
  vec2 m = userMapPair(userMapVolume, base, f);
  if (userMapBlend < 1.0) m = mix(userMapPair(userMapPrevious, base, f), m, userMapBlend);
  return m.y >= 0.5 ? m.x / m.y : ${NO_DATA.toExponential()};
}
`;

const LUMA = 'vec3(0.2126, 0.7152, 0.0722)';

/** After the scan has written the fragment: the map where it is drawn, in the light the scan takes. */
export const USER_MAP_OVER_SCAN = `
        if (userMapOverScan && userMapMapped.a > 0.0) {
          vec3 userMapLight = sRGBTransferEOTF(vec4(userMapMapped.rgb, 1.0)).rgb;
          #ifdef SCAN_SHADE
          userMapLight *= scanShade;
          #endif
          gl_FragColor.rgb = mix(gl_FragColor.rgb, userMapLight, userMapMapped.a);
        }
        #include <tonemapping_fragment>`;

/**
 * Draw the map on a cut face, unlit: a cut face is a section of the map, and its colours are the key's.
 * Beneath the threshold the face keeps its tissue or scan as grey, as the cortex is. Added after the
 * scan's appearance, so it is applied after it.
 */
export function addUserMapToCap(material: Material, uniforms: UserMapUniforms): void {
  const compile = material.onBeforeCompile;
  const key = material.customProgramCacheKey();
  material.onBeforeCompile = (
    shader: WebGLProgramParametersWithUniforms,
    renderer: WebGLRenderer,
  ) => {
    compile.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = `${USER_MAP_COLOUR}${USER_MAP_AT}${shader.fragmentShader}`.replace(
      '#include <opaque_fragment>',
      `
        if (userMapOn) {
          vec4 mapped = userMapColour(userMapAt(sourceWorld));
          outgoingLight = mix(
            vec3(dot(outgoingLight, ${LUMA})), sRGBTransferEOTF(vec4(mapped.rgb, 1.0)).rgb, mapped.a);
        }
        #include <opaque_fragment>
      `,
    );
  };
  material.customProgramCacheKey = () => `${key}-user-map-v5`;
}

/**
 * Draw the map on a deep structure's surface, or the cerebellum's: read where the surface lies, lit as
 * tissue is, the rest of the surface grey. The cortex reads it between its pial and white surfaces instead.
 */
export function addUserMapToSurface(material: Material, uniforms: UserMapUniforms): void {
  const compile = material.onBeforeCompile;
  const key = material.customProgramCacheKey();
  material.onBeforeCompile = (
    shader: WebGLProgramParametersWithUniforms,
    renderer: WebGLRenderer,
  ) => {
    compile.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms, { explodeShift: explodeShift(material) });
    shader.vertexShader =
      `${EXPLODE_SHIFT_UNIFORM}varying vec3 userMapWorld;\n${shader.vertexShader}`.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
      userMapWorld = ${ANATOMICAL_WORLD};`,
      );
    shader.fragmentShader = `varying vec3 userMapWorld;
${USER_MAP_COLOUR}${USER_MAP_AT}${shader.fragmentShader}`
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec4 userMapMapped = vec4(0.0);
        if (userMapOn) {
          userMapMapped = userMapColour(userMapAt(userMapWorld));
          diffuseColor.rgb = mix(
            vec3(dot(diffuseColor.rgb, ${LUMA})),
            sRGBTransferEOTF(vec4(userMapMapped.rgb, 1.0)).rgb,
            userMapMapped.a);
        }`,
      )
      .replace('#include <tonemapping_fragment>', USER_MAP_OVER_SCAN);
  };
  material.customProgramCacheKey = () => `${key}-user-map-surface-v5`;
}
