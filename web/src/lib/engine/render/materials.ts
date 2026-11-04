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
): void {
  const variation = { value: intensity.surface_strength };
  const networkMix = { value: 0 };
  const territoryMix = { value: 0 };
  const userData: AnatomicalUserData = {
    tissueVariation: variation,
    networkMix: withNetworks ? networkMix : null,
    territoryMix: withTerritories ? territoryMix : null,
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
varying float vOpenness;
varying float vT1;
varying float vSulcalDepth;
${withNetworks ? 'attribute vec4 _networkColor;\nvarying vec4 vNetworkColor;' : ''}
${withTerritories ? 'attribute vec4 _territoryColor;\nvarying vec4 vTerritoryColor;' : ''}
${visual ? VISUAL_VERTEX_DECLARATIONS : ''}
${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
vSulcalDepth = _sulc * sulcDecode.y + sulcDecode.x;
vOpenness = _openness * opennessDecode.y + opennessDecode.x;
vT1 = _t1 * t1Decode.y + t1Decode.x;
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
      float intensity = clamp((vT1 - t1Range.x) / (t1Range.y - t1Range.x), 0.0, 1.0);
      diffuseColor.rgb *= 1.0 + tissueVariation * (2.0 * intensity - 1.0);`,
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
      );
  };
  material.customProgramCacheKey = () =>
    `source-tissue-relief-v5${withNetworks ? '-network' : ''}${withTerritories ? '-territory' : ''}${visual ? '-visual' : ''}`;
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
    );
  }
  return material;
}
