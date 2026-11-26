import { Data3DTexture, FloatType, Matrix4, NearestFilter, RGFormat, Vector3 } from 'three';
import type { IUniform, Material, WebGLProgramParametersWithUniforms, WebGLRenderer } from 'three';
import { COLOUR_SCALES, MAP_SLOTS } from '../../core/user-map/display.ts';
import type { MapDisplay, MapOverlap } from '../../core/user-map/display.ts';
import type { Grid } from '../../core/user-map/sampling.ts';
import { ANATOMICAL_WORLD, EXPLODE_SHIFT_UNIFORM, explodeShift } from '../model/explode.ts';

/** Where the map has no value: GLSL cannot be trusted to keep a NaN through a fast-math compile. */
export const NO_DATA = -3e38;

const SLOTS = Array.from({ length: MAP_SLOTS }, (_, slot) => slot);

/** One of the reader's maps, as the shaders read it. */
export interface MapSlotUniforms {
  on: IUniform<boolean>;
  threshold: IUniform<number>;
  max: IUniform<number>;
  opacity: IUniform<number>;
  /** The colour scale's sRGB ends: positive low and high, then negative low and high. */
  ramp: IUniform<Vector3[]>;
  volume: IUniform<Data3DTexture | null>;
  worldToMap: IUniform<Matrix4>;
  shape: IUniform<Vector3>;
}

/**
 * The reader's maps, shared by every cortical material and every cut face: each slot's uniforms are
 * named with its number (`userMapOn0`, `userMapOn1`, …), the rest once.
 */
export interface UserMapUniforms {
  /** The scan colours the surfaces, so the maps are drawn over it, in the scan's light. */
  userMapOverScan: IUniform<boolean>;
  /** The cortex's colour while a map is on, linear. */
  userMapBase: IUniform<Vector3>;
  /** The map drawn over the other. */
  userMapTop: IUniform<number>;
  /** The volume a series drew before, held while it moves from it to its slot's volume. */
  userMapPrevious: IUniform<Data3DTexture | null>;
  /** How far the moving slot has gone from `userMapPrevious` to its volume: 1 draws its volume alone. */
  userMapBlend: IUniform<number>;
  userMapMoving: IUniform<number>;
  /** Drawn against a painted function (`MapOverlap`): its colours, sRGB. */
  userMapOverlap: IUniform<boolean>;
  userMapOverlapMap: IUniform<Vector3>;
  userMapOverlapBoth: IUniform<Vector3>;
  [uniform: string]: IUniform;
}

export function createUserMapUniforms(): UserMapUniforms {
  const uniforms: UserMapUniforms = {
    userMapOverScan: { value: false },
    userMapBase: { value: new Vector3() },
    userMapTop: { value: MAP_SLOTS - 1 },
    userMapPrevious: { value: null },
    userMapBlend: { value: 1 },
    userMapMoving: { value: 0 },
    userMapOverlap: { value: false },
    userMapOverlapMap: { value: new Vector3() },
    userMapOverlapBoth: { value: new Vector3() },
  };
  for (const slot of SLOTS) {
    Object.assign(uniforms, {
      [`userMapOn${slot}`]: { value: false },
      [`userMapThreshold${slot}`]: { value: 0 },
      [`userMapMax${slot}`]: { value: 1 },
      [`userMapOpacity${slot}`]: { value: 1 },
      [`userMapRamp${slot}`]: { value: Array.from({ length: 4 }, () => new Vector3()) },
      [`userMapVolume${slot}`]: { value: null },
      [`worldToUserMap${slot}`]: { value: new Matrix4() },
      [`userMapShape${slot}`]: { value: new Vector3() },
    });
  }
  return uniforms;
}

export function slotUniforms(uniforms: UserMapUniforms, slot: number): MapSlotUniforms {
  if (!SLOTS.includes(slot)) throw new RangeError(`There is no map slot ${slot}.`);
  return {
    on: uniforms[`userMapOn${slot}`]!,
    threshold: uniforms[`userMapThreshold${slot}`]!,
    max: uniforms[`userMapMax${slot}`]!,
    opacity: uniforms[`userMapOpacity${slot}`]!,
    ramp: uniforms[`userMapRamp${slot}`]!,
    volume: uniforms[`userMapVolume${slot}`]!,
    worldToMap: uniforms[`worldToUserMap${slot}`]!,
    shape: uniforms[`userMapShape${slot}`]!,
  };
}

export function setUserMapOverlap(uniforms: UserMapUniforms, overlap: MapOverlap | null): void {
  uniforms.userMapOverlap.value = overlap !== null;
  if (!overlap) return;
  uniforms.userMapOverlapMap.value.set(...overlap.map).divideScalar(255);
  uniforms.userMapOverlapBoth.value.set(...overlap.both).divideScalar(255);
}

/** A material's own flag: whether it shows the paint, which the map's overlap colours read. */
export function addUserMapPainted(material: Material): IUniform<boolean> {
  const painted = { value: false };
  material.userData['userMapPainted'] = painted;
  return painted;
}

export function setUserMapDisplay(
  uniforms: UserMapUniforms,
  slot: number,
  display: MapDisplay | null,
): void {
  const own = slotUniforms(uniforms, slot);
  own.on.value = display !== null;
  if (!display) return;
  own.threshold.value = display.threshold;
  own.max.value = display.max;
  own.opacity.value = display.opacity;
  const { positive, negative } = COLOUR_SCALES[display.colours];
  [...positive, ...negative].forEach(([r, g, b], end) => own.ramp.value[end]!.set(r, g, b));
}

/**
 * A slot's sum and share (`resample`) on a 1 mm grid of this brain as an RG32F texture, read with
 * texelFetch. With `keepPrevious` the volume it drew until now is held to blend from, on the same
 * grid; another slot's held volume is let go.
 */
export function setUserMapVolume(
  uniforms: UserMapUniforms,
  slot: number,
  grid: Grid,
  values: Float32Array,
  keepPrevious = false,
): void {
  const own = slotUniforms(uniforms, slot);
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
  if (keepPrevious) {
    dropPrevious(uniforms);
    uniforms.userMapPrevious.value = own.volume.value;
    uniforms.userMapMoving.value = slot;
  } else {
    if (uniforms.userMapMoving.value === slot) dropPrevious(uniforms);
    own.volume.value?.dispose();
  }
  own.volume.value = texture;
  own.shape.value.set(nx, ny, nz);
  // World (glTF metres: x right, y superior, z posterior) to the grid's voxels in surface RAS.
  const [ox, oy, oz] = grid.origin;
  const s = grid.spacing;
  // prettier-ignore
  own.worldToMap.value.set(
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

export function clearUserMapVolume(uniforms: UserMapUniforms, slot: number): void {
  const own = slotUniforms(uniforms, slot);
  if (uniforms.userMapMoving.value === slot) dropPrevious(uniforms);
  own.volume.value?.dispose();
  own.volume.value = null;
  own.on.value = false;
}

/**
 * `userMapColour0(value)`, `userMapColour1(value)`: the sRGB colour of a value on that map's scale and
 * its opacity, or 0 alpha where it is not drawn; against a function, as `mapColour` draws it.
 * `userMapGreys()`: whether the surface is grey where no map is drawn, which a painted area is not
 * against a function.
 */
export const USER_MAP_COLOUR = `
uniform bool userMapOverScan;
uniform bool userMapOverlap;
uniform vec3 userMapOverlapMap;
uniform vec3 userMapOverlapBoth;
uniform bool userMapPainted;
uniform int userMapTop;
bool userMapGreys() {
  return !(userMapOverlap && userMapPainted);
}
vec4 userMapColourOn(float value, float threshold, float top, float opacity, vec3 ramp[4]) {
  if (userMapOverlap) {
    if (!(value > threshold)) return vec4(0.0);
    return vec4(userMapPainted ? userMapOverlapBoth : userMapOverlapMap, opacity);
  }
  float magnitude = abs(value);
  if (!(magnitude > threshold) || value < ${NO_DATA.toExponential()} * 0.5) return vec4(0.0);
  float share = min(1.0, (magnitude - threshold) / (top - threshold));
  vec3 colour = value > 0.0 ? mix(ramp[0], ramp[1], share) : mix(ramp[2], ramp[3], share);
  return vec4(colour, opacity);
}
${SLOTS.map(
  (slot) => `uniform bool userMapOn${slot};
uniform float userMapThreshold${slot};
uniform float userMapMax${slot};
uniform float userMapOpacity${slot};
uniform vec3 userMapRamp${slot}[4];
vec4 userMapColour${slot}(float value) {
  return userMapColourOn(
    value, userMapThreshold${slot}, userMapMax${slot}, userMapOpacity${slot}, userMapRamp${slot});
}`,
).join('\n')}
`;

/**
 * `userMapAt0(world)`, `userMapAt1(world)`: sum and share trilinear between the voxel centres, their
 * quotient where the share is at least half (`valueOf`), NO_DATA elsewhere. While a series moves
 * between volumes, the pairs of both are mixed first, so the values pass linearly from one to the next.
 */
const USER_MAP_AT = `
uniform highp sampler3D userMapPrevious;
uniform float userMapBlend;
uniform int userMapMoving;
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
${SLOTS.map(
  (slot) => `uniform highp sampler3D userMapVolume${slot};
uniform mat4 worldToUserMap${slot};
uniform vec3 userMapShape${slot};
float userMapAt${slot}(vec3 world) {
  vec3 voxel = (worldToUserMap${slot} * vec4(world, 1.0)).xyz;
  if (any(lessThan(voxel, vec3(0.0))) || any(greaterThan(voxel, userMapShape${slot} - 1.0))) {
    return ${NO_DATA.toExponential()};
  }
  ivec3 base = min(ivec3(floor(voxel)), ivec3(userMapShape${slot}) - 2);
  vec3 f = voxel - vec3(base);
  vec2 m = userMapPair(userMapVolume${slot}, base, f);
  if (userMapBlend < 1.0 && userMapMoving == ${slot}) {
    m = mix(userMapPair(userMapPrevious, base, f), m, userMapBlend);
  }
  return m.y >= 0.5 ? m.x / m.y : ${NO_DATA.toExponential()};
}`,
).join('\n')}
`;

const LUMA = 'vec3(0.2126, 0.7152, 0.0722)';

/** Whether any map is on, for a shader that declares `USER_MAP_COLOUR`. */
export const USER_MAP_ANY_ON = SLOTS.map((slot) => `userMapOn${slot}`).join(' || ');

/**
 * GLSL that mixes `userMapMapped0` and `userMapMapped1` (sRGB colour, alpha) into `target`, the map
 * under first and the map on top last, each in the light `lit` gives its colour.
 */
export function stackUserMaps(
  target: string,
  lit: (rgb: string) => string = (rgb) => `sRGBTransferEOTF(vec4(${rgb}, 1.0)).rgb`,
): string {
  return `
        {
          vec4 userMapUnder = userMapTop == 1 ? userMapMapped0 : userMapMapped1;
          vec4 userMapOver = userMapTop == 1 ? userMapMapped1 : userMapMapped0;
          if (userMapUnder.a > 0.0) ${target} = mix(${target}, ${lit('userMapUnder.rgb')}, userMapUnder.a);
          if (userMapOver.a > 0.0) ${target} = mix(${target}, ${lit('userMapOver.rgb')}, userMapOver.a);
        }`;
}

/** After the scan has written the fragment: the maps where they are drawn, in the light the scan takes. */
export const USER_MAP_OVER_SCAN = `
        if (userMapOverScan) {
          float userMapShade = 1.0;
          #ifdef SCAN_SHADE
          userMapShade = scanShade;
          #endif
          ${stackUserMaps(
            'gl_FragColor.rgb',
            (rgb) => `sRGBTransferEOTF(vec4(${rgb}, 1.0)).rgb * userMapShade`,
          )}
        }
        #include <tonemapping_fragment>`;

/**
 * Draw the maps on a cut face, unlit: a cut face is a section of a map, and its colours are the key's.
 * Beneath the threshold the face keeps its tissue or scan as grey, as the cortex is. Added after the
 * scan's appearance, so it is applied after it.
 */
export function addUserMapToCap(material: Material, uniforms: UserMapUniforms): void {
  const compile = material.onBeforeCompile;
  const key = material.customProgramCacheKey();
  const painted = addUserMapPainted(material);
  material.onBeforeCompile = (
    shader: WebGLProgramParametersWithUniforms,
    renderer: WebGLRenderer,
  ) => {
    compile.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms, { userMapPainted: painted });
    shader.fragmentShader = `${USER_MAP_COLOUR}${USER_MAP_AT}${shader.fragmentShader}`.replace(
      '#include <opaque_fragment>',
      `
        if (${USER_MAP_ANY_ON}) {
          ${SLOTS.map(
            (slot) => `vec4 userMapMapped${slot} =
            userMapOn${slot} ? userMapColour${slot}(userMapAt${slot}(sourceWorld)) : vec4(0.0);`,
          ).join('\n')}
          if (userMapGreys()) outgoingLight = vec3(dot(outgoingLight, ${LUMA}));
          ${stackUserMaps('outgoingLight')}
        }
        #include <opaque_fragment>
      `,
    );
  };
  material.customProgramCacheKey = () => `${key}-user-map-v7`;
}

/**
 * Draw the maps on a deep structure's surface, or the cerebellum's: read where the surface lies, lit as
 * tissue is, the rest of the surface grey. The cortex reads them between its pial and white surfaces instead.
 */
export function addUserMapToSurface(material: Material, uniforms: UserMapUniforms): void {
  const compile = material.onBeforeCompile;
  const key = material.customProgramCacheKey();
  const painted = addUserMapPainted(material);
  material.onBeforeCompile = (
    shader: WebGLProgramParametersWithUniforms,
    renderer: WebGLRenderer,
  ) => {
    compile.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms, {
      explodeShift: explodeShift(material),
      userMapPainted: painted,
    });
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
        ${SLOTS.map((slot) => `vec4 userMapMapped${slot} = vec4(0.0);`).join('\n')}
        if (${USER_MAP_ANY_ON}) {
          ${SLOTS.map(
            (slot) =>
              `if (userMapOn${slot}) userMapMapped${slot} = userMapColour${slot}(userMapAt${slot}(userMapWorld));`,
          ).join('\n')}
          if (userMapGreys()) diffuseColor.rgb = vec3(dot(diffuseColor.rgb, ${LUMA}));
          ${stackUserMaps('diffuseColor.rgb')}
        }`,
      )
      .replace('#include <tonemapping_fragment>', USER_MAP_OVER_SCAN);
  };
  material.customProgramCacheKey = () => `${key}-user-map-surface-v7`;
}
