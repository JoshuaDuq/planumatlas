import { MeshPhysicalMaterial, MeshStandardMaterial } from 'three';
import type {
  BufferGeometry,
  Color,
  IUniform,
  Vector3,
  Mesh,
  WebGLProgramParametersWithUniforms,
} from 'three';
import type { Region } from '../../types/index.ts';
import {
  USER_MAP_COLOUR,
  USER_MAP_OVER_SCAN,
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
  /** True once this mesh carries the reader's map per vertex (`_user_map`). */
  userMapReady: IUniform<boolean>;
}

/** The visual-field map's uniforms, one set shared by every cortical material of an anatomy. */
export interface VisualFieldUniforms {
  /** 1 while the map replaces the cortex's colours. */
  visualMix: IUniform<number>;
  /** The dot's centre (x right, y up) and radius, in degrees; a negative radius draws no dot. */
  visualProbe: IUniform<Vector3>;
  /** The eccentricity the template was fitted to, in degrees; beyond it the map is drawn darker. */
  visualMeasured: IUniform<number>;
  /** The dot's colour, linear. */
  visualAccent: IUniform<Color>;
}

/*
 * The map is achromatic but for the dot: V1, V2 and V3 as three greys, lightest first, on a darker
 * cortex, so the areas' borders read under the stage's light; the measured eccentricity is a light
 * line, and the cortex beyond it darker. Linear values.
 */
const VISUAL_TONES = { outside: 0.045, areas: [0.6, 0.27, 0.11], extrapolated: 0.65, line: 0.85 };

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
 * Source morphometry modulates illumination, independently of atlas colour.
 *
 * `withNetworks` is all-or-nothing across a build — either the network layer
 * was built and every cortical mesh carries it, or none does — so this adds at
 * most one program variant rather than one per mesh.
 */
function addFoldShading(
  material: MeshPhysicalMaterial,
  { folds, intensity, field_ranges: ranges }: Appearance,
  withNetworks: boolean,
  withTerritories: boolean,
  visual: VisualFieldUniforms | null,
  userMap: UserMapUniforms,
): void {
  const variation = { value: intensity.surface_strength };
  const networkMix = { value: 0 };
  const territoryMix = { value: 0 };
  const userData: AnatomicalUserData = {
    tissueVariation: variation,
    networkMix: withNetworks ? networkMix : null,
    territoryMix: withTerritories ? territoryMix : null,
    userMapReady: { value: false },
  };
  Object.assign(material.userData, userData);
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.tissueVariation = variation;
    if (withNetworks) shader.uniforms.networkMix = networkMix;
    if (withTerritories) shader.uniforms.territoryMix = territoryMix;
    if (visual) {
      Object.assign(shader.uniforms, visual);
      shader.uniforms.visualXDecode = { value: fieldDecode(ranges, '_FIELD_X') };
      shader.uniforms.visualYDecode = { value: fieldDecode(ranges, '_FIELD_Y') };
      shader.uniforms.visualSigmaDecode = { value: fieldDecode(ranges, '_PRF_SIGMA') };
    }
    Object.assign(shader.uniforms, userMap);
    shader.uniforms.userMapReady = userData.userMapReady;
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
varying float vOpenness;
varying float vT1;
varying float vSulcalDepth;
varying vec2 vUserMap;
${withNetworks ? 'attribute vec4 _networkColor;\nvarying vec4 vNetworkColor;' : ''}
${withTerritories ? 'attribute vec4 _territoryColor;\nvarying vec4 vTerritoryColor;' : ''}
${visual ? VISUAL_VERTEX_DECLARATIONS : ''}
${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
vSulcalDepth = _sulc * sulcDecode.y + sulcDecode.x;
vOpenness = _openness * opennessDecode.y + opennessDecode.x;
vT1 = _t1 * t1Decode.y + t1Decode.x;
vUserMap = _user_map;
${withNetworks ? 'vNetworkColor = _networkColor;' : ''}
${withTerritories ? 'vTerritoryColor = _territoryColor;' : ''}
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
      ${visual ? VISUAL_FRAGMENT : ''}
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
    `source-tissue-relief-v6${withNetworks ? '-network' : ''}${withTerritories ? '-territory' : ''}${visual ? '-visual' : ''}`;
}

/*
 * Each vertex's position is weighted by whether it lies in V1–V3, and the fragment divides the
 * weight back out: a triangle reaching past V3 then interpolates only its V1–V3 corners, where a
 * plain average would pull it towards fixation (zero) across the band.
 */
const VISUAL_VERTEX_DECLARATIONS = `attribute float _field_x;
attribute float _field_y;
attribute float _prf_sigma;
attribute float _visual_area;
uniform vec2 visualXDecode;
uniform vec2 visualYDecode;
uniform vec2 visualSigmaDecode;
varying vec3 vVisualField;
varying vec2 vVisualArea;`;

const VISUAL_VERTEX = `float visualIn = step(0.5, _visual_area);
vVisualField = visualIn * vec3(
  _field_x * visualXDecode.y + visualXDecode.x,
  _field_y * visualYDecode.y + visualYDecode.x,
  _prf_sigma * visualSigmaDecode.y + visualSigmaDecode.x);
vVisualArea = vec2(visualIn * _visual_area, visualIn);`;

const VISUAL_FRAGMENT_DECLARATIONS = `varying vec3 vVisualField;
varying vec2 vVisualArea;
uniform float visualMix;
uniform vec3 visualProbe;
uniform float visualMeasured;
uniform vec3 visualAccent;`;

/*
 * While the reader's map is on, the cortex is one grey, keeping its T1 texture and fold shading, and a
 * vertex whose parents mostly have a value takes the map's colour beyond the threshold, lit as tissue is.
 */
const USER_MAP_FRAGMENT = `
      bool userMapDrawn = userMapOn && userMapReady;
      if (userMapDrawn) diffuseColor.rgb = userMapBase;`;

const USER_MAP_COLOUR_FRAGMENT = `
      vec4 userMapMapped = vec4(0.0);
      if (userMapDrawn && vUserMap.y >= 0.5) userMapMapped = userMapColour(vUserMap.x / vUserMap.y);
      diffuseColor.rgb = mix(
        diffuseColor.rgb, sRGBTransferEOTF(vec4(userMapMapped.rgb, 1.0)).rgb, userMapMapped.a);`;

const [V1_TONE, V2_TONE, V3_TONE] = VISUAL_TONES.areas.map((tone) => tone.toFixed(3));

/*
 * The dot's territory is the cortex whose predicted pRF centre lies inside it; its reach, drawn
 * fainter, the cortex whose pRF comes within one sigma of it. The measured eccentricity is a line.
 */
const VISUAL_FRAGMENT = `
      if (visualMix > 0.5) {
        vec3 tone = vec3(${VISUAL_TONES.outside.toFixed(3)});
        float share = vVisualArea.y;
        if (share >= 0.5) {
          vec3 field = vVisualField / share;
          float area = floor(vVisualArea.x / share + 0.5);
          tone = vec3(area < 1.5 ? ${V1_TONE} : area < 2.5 ? ${V2_TONE} : ${V3_TONE});
          float eccentricity = length(field.xy);
          if (eccentricity > visualMeasured) tone *= ${VISUAL_TONES.extrapolated.toFixed(3)};
          float line = 1.0 - smoothstep(0.0, 1.5 * fwidth(eccentricity), abs(eccentricity - visualMeasured));
          tone = mix(tone, vec3(${VISUAL_TONES.line.toFixed(3)}), 0.7 * line);
          if (visualProbe.z >= 0.0) {
            float d = distance(field.xy, visualProbe.xy);
            float edge = fwidth(d);
            float core = 1.0 - smoothstep(visualProbe.z - edge, visualProbe.z + edge, d);
            float reach = 1.0 - smoothstep(visualProbe.z + field.z - edge, visualProbe.z + field.z + edge, d);
            tone = mix(tone, visualAccent, max(core, 0.45 * reach));
          }
        }
        diffuseColor.rgb = tone;
      }`;

export function createAnatomicalMaterial(
  mesh: Mesh<BufferGeometry, MeshStandardMaterial>,
  region: Region,
  appearance: Appearance,
  visual: VisualFieldUniforms | null = null,
  userMap: UserMapUniforms = createUserMapUniforms(),
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
  if (cortical) {
    for (const name of ['_sulc', '_openness', '_t1']) {
      const attribute = mesh.geometry.getAttribute(name);
      if (
        !attribute ||
        attribute.itemSize !== 1 ||
        attribute.count !== mesh.geometry.attributes.position!.count
      ) {
        material.dispose();
        throw new Error(`Missing source shading attribute ${name}: ${region.id}`);
      }
    }
    if (visual) {
      for (const name of ['_field_x', '_field_y', '_prf_sigma', '_visual_area']) {
        if (!mesh.geometry.getAttribute(name)) {
          material.dispose();
          throw new Error(`Missing visual-field attribute ${name}: ${region.id}`);
        }
      }
    }
    addFoldShading(
      material,
      appearance,
      Boolean(mesh.geometry.getAttribute('_network')),
      Boolean(mesh.geometry.getAttribute('_territory')),
      visual,
      userMap,
    );
  } else addUserMapToSurface(material, userMap);
  return material;
}
