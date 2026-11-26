import { MeshPhysicalMaterial, MeshStandardMaterial } from 'three';
import type {
  BufferGeometry,
  Color,
  DataTexture,
  IUniform,
  Vector3,
  Mesh,
  WebGLProgramParametersWithUniforms,
} from 'three';
import type { Region } from '../../types/index.ts';
import { VISUAL_RESPONSE_THRESHOLD } from '../../core/learning/visual-field.ts';
import { SULC_RAMP, sulcExtent } from '../../core/catalog/sulcal-depth.ts';
import { POSITIVE_RAMP } from '../../core/user-map/display.ts';
import {
  USER_MAP_COLOUR,
  USER_MAP_OVER_SCAN,
  addUserMapPainted,
  addUserMapToSurface,
  createUserMapUniforms,
} from '../user-map/overlay.ts';
import type { UserMapUniforms } from '../user-map/overlay.ts';
import { isPhone } from './device.ts';

/** The tissue-class display colours (`appearance.tissue` in the manifest). */
export interface TissuePalette {
  cortex: string;
  gray: string;
  white: string;
  fluid: string;
  unlabelled: string;
}

/** How a tissue is lit (`appearance.tissue` in the manifest). */
export interface TissueAppearance extends TissuePalette {
  roughness: number;
  clearcoat: number;
  clearcoat_roughness: number;
  ior: number;
  specular_intensity: number;
}

/** The slice of the manifest's `appearance` the materials read. */
export interface Appearance {
  tissue: TissueAppearance;
  intensity: {
    low: number;
    high: number;
    surface_strength: number;
    cut_strength: number;
    solid_relief_mm: number;
  };
  folds: {
    low: number;
    high: number;
    openness_low: number;
    openness_high: number;
    direct_strength: number;
    indirect_strength: number;
  };
  /** The span each shading field was normalised over; absent in a file written before that. */
  field_ranges?: Readonly<Record<string, readonly [number, number]>>;
}

/** What `createAnatomicalMaterial` leaves on `material.userData`. */
export interface AnatomicalUserData {
  tissueVariation: IUniform<number>;
  networkMix: IUniform<number> | null;
  territoryMix: IUniform<number> | null;
  /** 1 while the cortex shows its thickness, where its vertices carry it. */
  thicknessMix: IUniform<number> | null;
  /** This mesh's thickness bytes, one texel per vertex in vertex order, once its atlas's have loaded. */
  thickness: ThicknessUniforms | null;
  /** 1 while the cortex shows its sulcal depth; null for a file without the depth's span. */
  sulcMix: IUniform<number> | null;
  /** True once this mesh carries the reader's map per vertex (`_user_map`). */
  userMapReady: IUniform<boolean>;
  /** This mesh's body-map codes, as `thickness` holds its thickness; null without a body map. */
  bodyMap: BodyMapUniforms | null;
}

/**
 * A mesh's thickness, read by vertex index rather than as an attribute: vertex attributes are the
 * cortex program's scarcest resource (`VISUAL_FIELD`). Row-major, `width` texels a row; `ready` false
 * reads none.
 */
export interface ThicknessUniforms {
  thicknessCodes: IUniform<DataTexture | null>;
  thicknessWidth: IUniform<number>;
  thicknessReady: IUniform<boolean>;
}

/** A mesh's body-map codes (0 none, then foot, hand, tongue), read by vertex index as thickness is. */
export interface BodyMapUniforms {
  bodyMapCodes: IUniform<DataTexture | null>;
  bodyMapWidth: IUniform<number>;
  bodyMapReady: IUniform<boolean>;
}

/** The body map's uniforms, one set shared by every cortical material of an anatomy. */
export interface BodyMapShared {
  /** 1 while the map replaces the cortex's colours. */
  bodyMapMix: IUniform<number>;
  /** The one part drawn, by its code; 0 draws every part. */
  bodyMapPart: IUniform<number>;
  /** Each part's colour by its code, texel 0 none. */
  bodyMapPalette: IUniform<DataTexture | null>;
  /** The grey the cortex off the map takes, linear. */
  bodyMapBase: IUniform<Vector3>;
}

/**
 * The network and territory colours, one texel per index (network-colors.ts), shared by every
 * cortical material of an anatomy; null where the manifest publishes none.
 */
export interface SurfacePalettes {
  network: DataTexture | null;
  territory: DataTexture | null;
  /**
   * The colour of each published thickness byte, texel 0 (the unmeasured) none: a uniform every
   * cortical material shares, filled when the first atlas's thickness downloads.
   */
  thickness: IUniform<DataTexture | null> | null;
  bodyMap: BodyMapShared | null;
}

/** The visual-field map's uniforms, one set shared by every cortical material of an anatomy. */
export interface VisualFieldUniforms {
  /** 1 while the map replaces the cortex's colours. */
  visualMix: IUniform<number>;
  /** The dot's centre (x right, y up) and radius, in degrees; a negative radius draws no dot. */
  visualProbe: IUniform<Vector3>;
  /** The eccentricity the template was fitted to, in degrees; beyond it the map is drawn darker. */
  visualMeasured: IUniform<number>;
  /** 1 while the named visual areas' borders are drawn on the map. */
  visualAreasMix: IUniform<number>;
  /**
   * Each named area's border class by its code, 1 to 4, no two areas that meet alike; 0 for no area
   * (`areaBorderClasses`). Filled the first time the borders are drawn.
   */
  visualAreaClass: IUniform<Float32Array>;
}

/*
 * The map is achromatic but for the dot's response: V1, V2 and V3 as three greys, lightest first, on a
 * darker cortex, so the areas' borders read under the stage's light; the measured eccentricity is a
 * light line, and the cortex beyond it darker. Linear values.
 */
const VISUAL_TONES = {
  outside: 0.045,
  areas: [0.6, 0.27, 0.11],
  extrapolated: 0.65,
  line: 0.85,
  border: 1,
};

/** Display colours describe tissue classes, never a measured tissue albedo. */
export function tissueColor(
  region: { tissue?: string; kind?: string; source_name?: string },
  palette: TissuePalette,
): string {
  const named = region.tissue ? palette[region.tissue as keyof TissuePalette] : undefined;
  if (named) return named;
  if (region.kind === 'non-region') return palette.unlabelled;
  if (region.kind === 'cortex') return palette.cortex;
  // A region without a name matches no pattern, so it is gray matter.
  const name = region.source_name ?? '';
  if (/(?:^|[-_\s])(?:ventricles?|vent|CSF)(?:$|[-_\s])/i.test(name)) return palette.fluid;
  if (/white|^CC_|callosum/i.test(name)) return palette.white;
  return palette.gray;
}

/**
 * What focus draws a region it does not hold in: its tissue's lightness without its hue, which
 * would tint the selection seen through it, and is the same grey on a cut face.
 */
export function ghostColor(
  region: Parameters<typeof tissueColor>[0],
  palette: TissuePalette,
  color: Color,
): Color {
  return greyed(color.set(tissueColor(region, palette)));
}

/** A colour as a ghost draws it: its own luminance, as grey. */
export function greyed(color: Color): Color {
  const { r, g, b } = color;
  return color.setScalar(0.2126 * r + 0.7152 * g + 0.0722 * b);
}

/*
 * Published atlas colours run down to near-black (Destrieux's long insular gyrus, many HCP-MMP
 * areas: OKLab lightness 0.14-0.16), which vanishes on the near-black stage. Below the knee, lightness
 * is mapped linearly onto [floor, knee], keeping order, hue and chroma; lighter colours are untouched.
 * The published value stays in the data and exports; only the stage draws the lifted one.
 */
const STAGE_LIGHTNESS = { floor: 0.3, knee: 0.45 };

const toLab = (r: number, g: number, b: number): [number, number, number] => {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};

const fromLab = (L: number, a: number, b: number): [number, number, number] => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
};

/** A published colour (linear sRGB) as the stage draws it: lifted above the floor if it is darker. */
export function stageLegible(color: Color): Color {
  const [L, a, b] = toLab(color.r, color.g, color.b);
  const { floor, knee } = STAGE_LIGHTNESS;
  if (L >= knee) return color;
  const lifted = floor + (L / knee) * (knee - floor);
  // Lifting can leave the gamut; chroma gives way, never hue or the lifted lightness. Grey at the
  // lifted lightness is always inside, so the most chroma that fits is found by bisection.
  const inGamut = (rgb: number[]) => rgb.every((c) => c >= -1e-6 && c <= 1 + 1e-6);
  let [inside, outside] = [0, 1];
  if (inGamut(fromLab(lifted, a, b))) inside = 1;
  else
    for (let i = 0; i < 16; i++) {
      const mid = (inside + outside) / 2;
      if (inGamut(fromLab(lifted, a * mid, b * mid))) inside = mid;
      else outside = mid;
    }
  const rgb = fromLab(lifted, a * inside, b * inside);
  return color.setRGB(...(rgb.map((c) => Math.min(1, Math.max(0, c))) as [number, number, number]));
}

/**
 * How to read one shading field back to its source units.
 *
 * The published files store these fields as normalized unsigned integers over
 * a span the build measured and the manifest carries, so the attribute arrives
 * in 0..1 rather than in millimetres of sulcal depth. A file written before
 * that encoding carries no span and is read straight through.
 */
export function fieldDecode(ranges: Appearance['field_ranges'], name: string): [number, number] {
  const span = ranges?.[name];
  return span ? [span[0], span[1] - span[0]] : [0, 1];
}

/**
 * Every cortical vertex carries its depth, the medial wall's too: the ramp is centred on 0, each
 * hemisphere's mean, and spans ±`sulcExtent`; interpolated in sRGB as the key's gradient is.
 */
const SULC_FRAGMENT = `
      if (sulcMix > 0.0) {
        float sulcAt = clamp(0.5 + 0.5 * vSulcalDepth / sulcExtent, 0.0, 1.0) * ${SULC_RAMP.length - 1}.0;
        int sulcLow = min(int(sulcAt), ${SULC_RAMP.length - 2});
        vec3 sulcSrgb = mix(sulcRamp[sulcLow], sulcRamp[sulcLow + 1], sulcAt - float(sulcLow));
        diffuseColor.rgb = mix(diffuseColor.rgb, sRGBTransferEOTF(vec4(sulcSrgb, 1.0)).rgb, sulcMix);
      }`;

/** The sulcal depth ramp's sRGB stops, 0–1, as the shader's `sulcRamp` array reads them. */
const SULC_STOPS = new Float32Array(SULC_RAMP.flat().map((channel) => channel / 255));

/**
 * Source morphometry modulates illumination, independently of atlas colour.
 *
 * The network layer is all-or-nothing across a build — either it was built
 * and every cortical mesh carries it, or none does — so this adds at most one
 * program variant rather than one per mesh; so is the territory layer. The
 * vertex stage looks each vertex's colour up in the palette by its index,
 * because an index cannot be interpolated (network-colors.ts).
 */
function addFoldShading(
  material: MeshPhysicalMaterial,
  { folds, intensity, field_ranges: ranges }: Appearance,
  networkPalette: DataTexture | null,
  territoryPalette: DataTexture | null,
  thicknessPalette: IUniform<DataTexture | null> | null,
  bodyMap: BodyMapShared | null,
  visual: VisualFieldUniforms | null,
  userMap: UserMapUniforms,
): void {
  const withNetworks = networkPalette !== null;
  const withTerritories = territoryPalette !== null;
  const withThickness = thicknessPalette !== null;
  const withBodyMap = bodyMap !== null;
  // Thickness and the body map pass their colour through one varying: the map is drawn over tissue grey.
  const withCodes = withThickness || withBodyMap;
  const extent = sulcExtent(ranges);
  const withSulc = extent !== null;
  const variation = { value: intensity.surface_strength };
  const networkMix = { value: 0 };
  const territoryMix = { value: 0 };
  const thicknessMix = { value: 0 };
  const sulcMix = { value: 0 };
  const thickness: ThicknessUniforms = {
    thicknessCodes: { value: null },
    thicknessWidth: { value: 1 },
    thicknessReady: { value: false },
  };
  const bodyCodes: BodyMapUniforms = {
    bodyMapCodes: { value: null },
    bodyMapWidth: { value: 1 },
    bodyMapReady: { value: false },
  };
  const userData: AnatomicalUserData = {
    tissueVariation: variation,
    networkMix: withNetworks ? networkMix : null,
    territoryMix: withTerritories ? territoryMix : null,
    thicknessMix: withThickness ? thicknessMix : null,
    thickness: withThickness ? thickness : null,
    sulcMix: withSulc ? sulcMix : null,
    userMapReady: { value: false },
    bodyMap: withBodyMap ? bodyCodes : null,
  };
  Object.assign(material.userData, userData);
  const painted = addUserMapPainted(material);
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.tissueVariation = variation;
    if (withNetworks) {
      shader.uniforms.networkMix = networkMix;
      shader.uniforms.networkPalette = { value: networkPalette };
    }
    if (withTerritories) {
      shader.uniforms.territoryMix = territoryMix;
      shader.uniforms.territoryPalette = { value: territoryPalette };
    }
    if (withThickness) {
      shader.uniforms.thicknessMix = thicknessMix;
      shader.uniforms.thicknessPalette = thicknessPalette;
      Object.assign(shader.uniforms, thickness);
    }
    if (withBodyMap) Object.assign(shader.uniforms, bodyMap, bodyCodes);
    if (withSulc) {
      shader.uniforms.sulcMix = sulcMix;
      shader.uniforms.sulcExtent = { value: extent };
      shader.uniforms.sulcRamp = { value: SULC_STOPS };
    }
    if (visual) {
      Object.assign(shader.uniforms, visual);
      shader.uniforms.visualXDecode = { value: fieldDecode(ranges, '_FIELD_X') };
      shader.uniforms.visualYDecode = { value: fieldDecode(ranges, '_FIELD_Y') };
      shader.uniforms.visualSigmaDecode = { value: fieldDecode(ranges, '_PRF_SIGMA') };
    }
    Object.assign(shader.uniforms, userMap);
    shader.uniforms.userMapReady = userData.userMapReady;
    shader.uniforms.userMapPainted = painted;
    shader.uniforms.sulcDecode = { value: fieldDecode(ranges, '_SULC') };
    shader.uniforms.opennessDecode = { value: fieldDecode(ranges, '_OPENNESS') };
    shader.uniforms.t1Decode = { value: fieldDecode(ranges, '_T1') };
    shader.uniforms.t1Range = { value: [intensity.low, intensity.high] };
    shader.uniforms.opennessRange = { value: [folds.openness_low, folds.openness_high] };
    shader.uniforms.foldRange = { value: [folds.low, folds.high] };
    shader.uniforms.foldStrength = {
      value: [folds.direct_strength, folds.indirect_strength],
    };
    shader.vertexShader = `attribute float _sulc;
attribute float _openness;
attribute float _t1;
uniform vec2 sulcDecode;
uniform vec2 opennessDecode;
uniform vec2 t1Decode;
attribute vec2 _user_map;
attribute vec2 _user_map_previous;
uniform float userMapBlend;
varying float vOpenness;
varying float vT1;
varying float vSulcalDepth;
varying vec2 vUserMap;
${withNetworks ? 'attribute float _network;\nuniform highp sampler2D networkPalette;\nvarying vec4 vNetworkColor;' : ''}
${withTerritories ? 'attribute float _territory;\nuniform highp sampler2D territoryPalette;\nvarying vec4 vTerritoryColor;' : ''}
${withCodes ? 'varying vec4 vCodeColor;' : ''}
${withThickness ? 'uniform highp sampler2D thicknessPalette;\nuniform highp sampler2D thicknessCodes;\nuniform int thicknessWidth;\nuniform bool thicknessReady;' : ''}
${withBodyMap ? BODY_MAP_VERTEX_DECLARATIONS : ''}
${visual ? visualVertexDeclarations(visual.visualAreaClass.value.length) : ''}
${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
vSulcalDepth = _sulc * sulcDecode.y + sulcDecode.x;
vOpenness = _openness * opennessDecode.y + opennessDecode.x;
vT1 = _t1 * t1Decode.y + t1Decode.x;
vUserMap = userMapBlend < 1.0 ? mix(_user_map_previous, _user_map, userMapBlend) : _user_map;
${withNetworks ? 'vNetworkColor = texelFetch(networkPalette, ivec2(int(_network + 0.5), 0), 0);' : ''}
${withTerritories ? 'vTerritoryColor = texelFetch(territoryPalette, ivec2(int(_territory + 0.5), 0), 0);' : ''}
${withCodes ? 'vCodeColor = vec4(0.0);' : ''}
${withThickness ? THICKNESS_VERTEX : ''}
${withBodyMap ? BODY_MAP_VERTEX : ''}
${visual ? VISUAL_VERTEX : ''}`,
    );
    shader.fragmentShader = `varying float vSulcalDepth;
varying float vOpenness;
varying float vT1;
uniform vec2 opennessRange;
uniform vec2 t1Range;
uniform float tissueVariation;
uniform vec2 foldRange;
uniform vec2 foldStrength;
varying vec2 vUserMap;
uniform bool userMapReady;
uniform vec3 userMapBase;
${USER_MAP_COLOUR}
${withNetworks ? 'varying vec4 vNetworkColor;\nuniform float networkMix;' : ''}
${withTerritories ? 'varying vec4 vTerritoryColor;\nuniform float territoryMix;' : ''}
${withCodes ? 'varying vec4 vCodeColor;' : ''}
${withThickness ? 'uniform float thicknessMix;' : ''}
${withBodyMap ? 'uniform float bodyMapMix;\nuniform vec3 bodyMapBase;' : ''}
${withSulc ? `uniform float sulcMix;\nuniform float sulcExtent;\nuniform vec3 sulcRamp[${SULC_RAMP.length}];` : ''}
${visual ? VISUAL_FRAGMENT_DECLARATIONS : ''}
${shader.fragmentShader}`
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
      ${
        withNetworks
          ? `
      // The fourth channel is zero off the networked surface, so the medial
      // wall keeps its region colour however far this is turned up.
      diffuseColor.rgb = mix(
        diffuseColor.rgb, vNetworkColor.rgb, networkMix * vNetworkColor.a);`
          : ''
      }
      ${
        withTerritories
          ? `
      // As for networks: a vertex outside every territory keeps its region colour.
      diffuseColor.rgb = mix(
        diffuseColor.rgb, vTerritoryColor.rgb, territoryMix * vTerritoryColor.a);`
          : ''
      }
      ${
        withThickness
          ? `
      // A vertex not measured, or whose thickness has not loaded (byte 0), keeps its tissue colour.
      diffuseColor.rgb = mix(
        diffuseColor.rgb, vCodeColor.rgb, thicknessMix * vCodeColor.a);`
          : ''
      }
      ${withSulc ? SULC_FRAGMENT : ''}
      ${visual ? VISUAL_FRAGMENT : ''}
      ${withBodyMap ? BODY_MAP_FRAGMENT : ''}
      ${USER_MAP_FRAGMENT}
      float intensity = clamp((vT1 - t1Range.x) / (t1Range.y - t1Range.x), 0.0, 1.0);
      diffuseColor.rgb *= 1.0 + tissueVariation * (2.0 * intensity - 1.0);
      ${USER_MAP_COLOUR_FRAGMENT}`,
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
      float depth = smoothstep(foldRange.x, foldRange.y, vSulcalDepth);
      float shut = 1.0 - smoothstep(opennessRange.x, opennessRange.y, vOpenness);
      float fold = mix(shut, depth, 0.25);
      reflectedLight.directDiffuse *= 1.0 - foldStrength.x * fold;
      reflectedLight.indirectDiffuse *= 1.0 - foldStrength.y * fold;
      reflectedLight.indirectSpecular *= 1.0 - foldStrength.y * fold;`,
      )
      .replace('#include <tonemapping_fragment>', USER_MAP_OVER_SCAN);
  };
  material.customProgramCacheKey = () =>
    `source-tissue-relief-v7${withNetworks ? '-network' : ''}${withTerritories ? '-territory' : ''}${withThickness ? '-thickness' : ''}${withBodyMap ? '-body' : ''}${withSulc ? '-sulc' : ''}${visual ? '-visual' : ''}`;
}

/**
 * A structure that carries baked openness (the cerebellar lobules) is darkened in its fissures as the
 * cortex is in its sulci, by openness alone: a structure has no sulcal depth.
 */
function addOpennessShading(
  material: MeshPhysicalMaterial,
  { folds, field_ranges: ranges }: Appearance,
): void {
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.opennessDecode = { value: fieldDecode(ranges, '_OPENNESS') };
    shader.uniforms.opennessRange = { value: [folds.openness_low, folds.openness_high] };
    shader.uniforms.foldStrength = {
      value: [folds.direct_strength, folds.indirect_strength],
    };
    shader.vertexShader = `attribute float _openness;
uniform vec2 opennessDecode;
varying float vOpenness;
${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
vOpenness = _openness * opennessDecode.y + opennessDecode.x;`,
    );
    shader.fragmentShader = `varying float vOpenness;
uniform vec2 opennessRange;
uniform vec2 foldStrength;
${shader.fragmentShader}`.replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>
      float shut = 1.0 - smoothstep(opennessRange.x, opennessRange.y, vOpenness);
      reflectedLight.directDiffuse *= 1.0 - foldStrength.x * shut;
      reflectedLight.indirectDiffuse *= 1.0 - foldStrength.y * shut;
      reflectedLight.indirectSpecular *= 1.0 - foldStrength.y * shut;`,
    );
  };
  material.customProgramCacheKey = () => 'structure-openness-v1';
}

/*
 * Each vertex's position is weighted by whether it lies in V1–V3, and the fragment divides the
 * weight back out: a triangle reaching past V3 then interpolates only its V1–V3 corners, where a
 * plain average would pull it towards fixation (zero) across the band.
 */
// gl_VertexID is the vertex's own index in an indexed draw, so it finds the vertex's byte.
const THICKNESS_VERTEX = `float thicknessCode = thicknessReady
  ? texelFetch(thicknessCodes, ivec2(gl_VertexID % thicknessWidth, gl_VertexID / thicknessWidth), 0).r * 255.0
  : 0.0;
vCodeColor = texelFetch(thicknessPalette, ivec2(int(thicknessCode + 0.5), 0), 0);`;

const BODY_MAP_VERTEX_DECLARATIONS = `uniform highp sampler2D bodyMapPalette;
uniform highp sampler2D bodyMapCodes;
uniform int bodyMapWidth;
uniform bool bodyMapReady;
uniform float bodyMapMix;
uniform int bodyMapPart;`;

/*
 * Premultiplied, so a triangle between a part and the cortex off the map blends the part's colour into
 * the grey rather than through the unassigned texel's.
 */
const BODY_MAP_VERTEX = `if (bodyMapMix > 0.5) {
  int bodyCode = bodyMapReady
    ? int(texelFetch(bodyMapCodes, ivec2(gl_VertexID % bodyMapWidth, gl_VertexID / bodyMapWidth), 0).r * 255.0 + 0.5)
    : 0;
  vec4 bodyColor = bodyCode > 0 && (bodyMapPart == 0 || bodyMapPart == bodyCode)
    ? texelFetch(bodyMapPalette, ivec2(bodyCode, 0), 0)
    : vec4(0.0);
  vCodeColor = vec4(bodyColor.rgb * bodyColor.a, bodyColor.a);
}`;

const BODY_MAP_FRAGMENT = `
      if (bodyMapMix > 0.5) {
        diffuseColor.rgb = vCodeColor.a > 0.0
          ? mix(bodyMapBase, vCodeColor.rgb / vCodeColor.a, vCodeColor.a)
          : bodyMapBase;
      }`;

/**
 * The retinotopy each cortical vertex is published with, packed two attributes from five
 * (`packVisualField`): field x, field y and pRF sigma as published, then the V1–V3 code and the named
 * area's code. Unpacked, the cortex program needs every vertex attribute WebGL 2 guarantees, gl_VertexID
 * counted, and a GPU that counts one more fails to link it: the cortex is then never drawn.
 */
export const VISUAL_FIELD = '_visual_field';
export const VISUAL_CODES = '_visual_codes';

const visualVertexDeclarations = (areaCodes: number) => `attribute vec3 ${VISUAL_FIELD};
attribute vec2 ${VISUAL_CODES};
uniform vec2 visualXDecode;
uniform vec2 visualYDecode;
uniform vec2 visualSigmaDecode;
uniform float visualAreaClass[${areaCodes}];
varying vec3 vVisualField;
varying vec2 vVisualArea;
varying vec4 vVisualAreaClass;`;

/*
 * A named area's code cannot be interpolated, so each vertex carries its area's border class as one of
 * four channels; across a triangle the channels interpolate to each class's share of the point.
 */
const VISUAL_VERTEX = `float visualIn = step(0.5, ${VISUAL_CODES}.x);
vVisualField = visualIn * vec3(
  ${VISUAL_FIELD}.x * visualXDecode.y + visualXDecode.x,
  ${VISUAL_FIELD}.y * visualYDecode.y + visualYDecode.x,
  ${VISUAL_FIELD}.z * visualSigmaDecode.y + visualSigmaDecode.x);
vVisualArea = vec2(visualIn * ${VISUAL_CODES}.x, visualIn);
int visualBorderClass = int(visualAreaClass[int(${VISUAL_CODES}.y + 0.5)] + 0.5);
vVisualAreaClass = vec4(equal(ivec4(visualBorderClass), ivec4(1, 2, 3, 4)));`;

const VISUAL_FRAGMENT_DECLARATIONS = `varying vec3 vVisualField;
varying vec2 vVisualArea;
varying vec4 vVisualAreaClass;
uniform float visualAreasMix;
uniform float visualMix;
uniform vec3 visualProbe;
uniform float visualMeasured;

// exp(-x) I0(x), x >= 0 (Abramowitz & Stegun 9.8.1–9.8.2).
float visualI0e(float x) {
  if (x < 3.75) {
    float y = x * x / 14.0625;
    return (1.0 + y * (3.5156229 + y * (3.0899424 + y * (1.2067492 + y * (0.2659732 + y * (0.0360768
      + y * 0.0045813)))))) * exp(-x);
  }
  float y = 3.75 / x;
  return (0.39894228 + y * (0.01328592 + y * (0.00225319 + y * (-0.00157565 + y * (0.00916281
    + y * (-0.02057706 + y * (0.02635537 + y * (-0.01647633 + y * 0.00392377)))))))) / sqrt(x);
}

// The share of a unit-volume Gaussian pRF inside the dot, as predictedResponse (core/learning/visual-field.ts) computes it.
float visualCovered(float d, float r, float s) {
  float a = max(0.0, d - 6.0 * s);
  float b = min(r, d + 6.0 * s);
  if (a >= b) return 0.0;
  float h = (b - a) / 24.0;
  float total = 0.0;
  for (int i = 0; i <= 24; i++) {
    float rho = a + float(i) * h;
    float weight = i == 0 || i == 24 ? 1.0 : (i % 2 == 1 ? 4.0 : 2.0);
    total += weight * rho * exp(-(rho - d) * (rho - d) / (2.0 * s * s)) * visualI0e(rho * d / (s * s));
  }
  return total * h / (3.0 * s * s);
}`;

/*
 * While the reader's map is on, the cortex is one grey, keeping its T1 texture and fold shading, and a
 * vertex whose parents mostly have a value takes the map's colour beyond the threshold, lit as tissue is.
 * Against a function, its painted areas keep the paint.
 */
const USER_MAP_FRAGMENT = `
      bool userMapDrawn = userMapOn && userMapReady;
      if (userMapDrawn && userMapGreys()) diffuseColor.rgb = userMapBase;`;

const USER_MAP_COLOUR_FRAGMENT = `
      vec4 userMapMapped = vec4(0.0);
      if (userMapDrawn && vUserMap.y >= 0.5) userMapMapped = userMapColour(vUserMap.x / vUserMap.y);
      diffuseColor.rgb = mix(
        diffuseColor.rgb, sRGBTransferEOTF(vec4(userMapMapped.rgb, 1.0)).rgb, userMapMapped.a);`;

const [V1_TONE, V2_TONE, V3_TONE] = VISUAL_TONES.areas.map((tone) => tone.toFixed(3));

const rampEnd = (rgb: readonly number[]) => `vec3(${rgb.map((c) => c.toFixed(1)).join(', ')})`;

/*
 * The dot is drawn as the activation it predicts, on FSL's red–yellow scale: each vertex's response
 * as a share of its response to the dot centred on its pRF, so a small dot lights every area it
 * reaches. The measured eccentricity is a line. The named areas' borders, when shown, are light lines
 * where the shares of two border classes meet (no area being a fifth), beneath the response.
 */
const VISUAL_FRAGMENT = `
      if (visualMix > 0.5) {
        vec3 tone = vec3(${VISUAL_TONES.outside.toFixed(3)});
        float share = vVisualArea.y;
        vec3 field = vVisualField / max(share, 0.5);
        if (share >= 0.5) {
          float area = floor(vVisualArea.x / share + 0.5);
          tone = vec3(area < 1.5 ? ${V1_TONE} : area < 2.5 ? ${V2_TONE} : ${V3_TONE});
          float eccentricity = length(field.xy);
          if (eccentricity > visualMeasured) tone *= ${VISUAL_TONES.extrapolated.toFixed(3)};
          float line = 1.0 - smoothstep(0.0, 1.5 * fwidth(eccentricity), abs(eccentricity - visualMeasured));
          tone = mix(tone, vec3(${VISUAL_TONES.line.toFixed(3)}), 0.7 * line);
        }
        if (visualAreasMix > 0.5) {
          float classes[5] = float[5](vVisualAreaClass.x, vVisualAreaClass.y, vVisualAreaClass.z,
            vVisualAreaClass.w, 1.0 - dot(vVisualAreaClass, vec4(1.0)));
          float first = 0.0;
          float second = 0.0;
          for (int i = 0; i < 5; i++) {
            if (classes[i] > first) {
              second = first;
              first = classes[i];
            } else if (classes[i] > second) {
              second = classes[i];
            }
          }
          float gap = first - second;
          float border = 1.0 - smoothstep(0.0, max(fwidth(gap), 1e-6), gap);
          tone = mix(tone, vec3(${VISUAL_TONES.border.toFixed(3)}), border);
        }
        if (share >= 0.5 && visualProbe.z >= 0.0) {
          float s = field.z;
          float q = visualProbe.z * visualProbe.z / (2.0 * s * s);
          float centred = q < 1e-3 ? q * (1.0 - 0.5 * q) : 1.0 - exp(-q);
          float response = visualCovered(distance(field.xy, visualProbe.xy), visualProbe.z, s) / centred;
          float edge = fwidth(response);
          float drawn = smoothstep(${VISUAL_RESPONSE_THRESHOLD} - edge, ${VISUAL_RESPONSE_THRESHOLD} + edge, response);
          float share = clamp((response - ${VISUAL_RESPONSE_THRESHOLD}) / ${(1 - VISUAL_RESPONSE_THRESHOLD).toFixed(3)}, 0.0, 1.0);
          vec3 hot = mix(${rampEnd(POSITIVE_RAMP[0])}, ${rampEnd(POSITIVE_RAMP[1])}, share);
          tone = mix(tone, sRGBTransferEOTF(vec4(hot, 1.0)).rgb, drawn);
        }
        diffuseColor.rgb = tone;
      }`;

export function createAnatomicalMaterial(
  mesh: Mesh<BufferGeometry, MeshStandardMaterial>,
  region: Region,
  appearance: Appearance,
  visual: VisualFieldUniforms | null = null,
  userMap: UserMapUniforms = createUserMapUniforms(),
  palettes: SurfacePalettes = { network: null, territory: null, thickness: null, bodyMap: null },
): MeshPhysicalMaterial {
  const material = new MeshPhysicalMaterial();
  MeshStandardMaterial.prototype.copy.call(material, mesh.material);
  material.roughness = appearance.tissue.roughness;
  // The coat lobe is a second lighting pass. On a phone it is what drops the
  // frame; the coat itself is a thin sheen the small screen does not carry.
  material.clearcoat = isPhone() ? 0 : appearance.tissue.clearcoat;
  material.clearcoatRoughness = appearance.tissue.clearcoat_roughness;
  material.ior = appearance.tissue.ior;
  material.specularIntensity = appearance.tissue.specular_intensity;
  const cortical = region.kind === 'cortex' || region.kind === 'non-region';
  const field = (name: string) => {
    const attribute = mesh.geometry.getAttribute(name);
    if (
      !attribute ||
      attribute.itemSize !== 1 ||
      attribute.count !== mesh.geometry.attributes.position!.count
    ) {
      material.dispose();
      throw new Error(`Missing source shading attribute ${name}: ${region.id}`);
    }
  };
  if (cortical) {
    for (const name of ['_sulc', '_openness', '_t1']) field(name);
    if (visual) {
      for (const [name, itemSize] of [
        [VISUAL_FIELD, 3],
        [VISUAL_CODES, 2],
      ] as const) {
        if (mesh.geometry.getAttribute(name)?.itemSize !== itemSize) {
          material.dispose();
          throw new Error(`Missing visual-field attribute ${name}: ${region.id}`);
        }
      }
    }
    // A palette colours the meshes that carry its index.
    const palette = (name: string, texture: DataTexture | null) =>
      texture && mesh.geometry.getAttribute(name) ? texture : null;
    addFoldShading(
      material,
      appearance,
      palette('_network', palettes.network),
      palette('_territory', palettes.territory),
      // Every cortical mesh can carry it: each atlas's thickness is attached once it downloads.
      palettes.thickness,
      palettes.bodyMap,
      visual,
      userMap,
    );
  } else {
    if (mesh.geometry.getAttribute('_openness')) {
      field('_openness');
      addOpennessShading(material, appearance);
    }
    addUserMapToSurface(material, userMap);
  }
  return material;
}
