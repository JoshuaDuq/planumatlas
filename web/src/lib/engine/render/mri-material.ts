import { Color, LinearSRGBColorSpace, Vector2, Vector3 } from 'three';
import type {
  Data3DTexture,
  IUniform,
  Material,
  Matrix4,
  WebGLProgramParametersWithUniforms,
  WebGLRenderer,
} from 'three';
import { rasToWorld } from '../slices/coordinates.ts';

/**
 * How a mark reads where the scan already owns luminance.
 *
 * `lift` is how much of it moves brightness: enough to survive greyscale and
 * a colour-blind reader, not enough for a marked cortex to pass for white
 * matter. `tint` is how much moves hue, which an achromatic scan leaves free.
 */
const MRI_MARK = { lift: 0.33, tint: 1.8 };

/**
 * How far inside itself a structure's surface reads the scan. The surface lies on its labels' boundary,
 * where a trilinear read mixes in the neighbour (a lateral ventricle reads 107 there, 48 inside); 1 mm in,
 * every teaching-set structure reads within 7 of its interior median.
 */
const SURFACE_DEPTH_MM = 1;

const LUMA = 'vec3(0.2126, 0.7152, 0.0722)';

const glsl = (value: number) => (Number.isInteger(value) ? `${value}.0` : `${value}`);

/** The scan, its contrast window and the mark colour, shared by every surface and cut material. */
export interface MriUniforms {
  scanEnabled: IUniform<boolean>;
  scanVolume: IUniform<Data3DTexture | null>;
  worldToScan: IUniform<Matrix4>;
  scanShape: IUniform<Vector3>;
  scanWindow: IUniform<Vector2>;
  scanHighlight: IUniform<Color>;
  [uniform: string]: IUniform;
}

/** Where a surface reads the scan: the cortex between its pial and white surfaces (`_t1`), any other just inside itself. */
export type MriSurfaceSample = 'mid-thickness' | 'inside';

/** One scan, contrast window and mark colour shared by every surface and cut material. */
export function createMriUniforms(anatomy: {
  texture: Data3DTexture | null;
  worldToVoxel: Matrix4;
  volume: { shape: readonly [number, number, number] };
}): MriUniforms {
  return {
    scanEnabled: { value: false },
    scanVolume: { value: anatomy.texture },
    worldToScan: { value: anatomy.worldToVoxel },
    scanShape: { value: new Vector3(...anatomy.volume.shape) },
    scanWindow: { value: new Vector2() },
    scanHighlight: { value: new Color().setStyle('#4fb6e0', LinearSRGBColorSpace) },
  };
}

export function setMriWindow(uniforms: MriUniforms, center: number, width: number): void {
  if (!Number.isFinite(center) || !Number.isFinite(width) || width <= 0) {
    throw new RangeError('MRI window requires a finite center and positive width.');
  }
  uniforms.scanWindow.value.set(center, width);
}

/**
 * The colour a pointed-at or chosen cut face is marked with, from the theme.
 *
 * Stored as the display bytes the token spells, not converted to the working
 * space, because the mark is mixed into a display grey and decoded with it.
 */
export function setMriHighlight(uniforms: MriUniforms, color: string): void {
  if (typeof color !== 'string' || !color.trim()) {
    throw new RangeError('MRI highlight requires a CSS colour.');
  }
  uniforms.scanHighlight.value.setStyle(color.trim(), LinearSRGBColorSpace);
}

/** Whether a material shows its own colour, a tab's paint, over the scan instead of the scan. */
export function setScanPainted(
  material: { userData: { scanPainted?: { value: boolean } } },
  painted: boolean,
): void {
  const uniform = material.userData.scanPainted;
  if (uniform) uniform.value = painted;
}

// The window maps signal to a display grey, as the linked MRI canvas writes it.
const SCAN_FRAGMENT = `
uniform bool scanEnabled;
uniform bool scanPainted;
uniform highp sampler3D scanVolume;
uniform vec3 scanShape;
uniform vec2 scanWindow;
float scanSignal(vec3 voxel) {
  if (any(lessThan(voxel, vec3(0.0))) || any(greaterThan(voxel, scanShape - 1.0))) return 0.0;
  return texture(scanVolume, (voxel + 0.5) / scanShape).r * 255.0;
}
float scanGray(float signal) {
  return clamp((signal - scanWindow.x + scanWindow.y * 0.5) / scanWindow.y, 0.0, 1.0);
}
`;

function replaceOnce(source: string, include: string, text: string): string {
  if (!source.includes(include)) throw new Error(`The MRI appearance needs ${include}.`);
  return source.replace(include, text);
}

function extend(
  material: Material,
  uniforms: MriUniforms,
  key: string,
  edit: (shader: WebGLProgramParametersWithUniforms) => void,
): void {
  const compile = material.onBeforeCompile;
  const base = material.customProgramCacheKey();
  const painted = { value: false };
  material.userData['scanPainted'] = painted;
  material.onBeforeCompile = (
    shader: WebGLProgramParametersWithUniforms,
    renderer: WebGLRenderer,
  ) => {
    compile.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms, { scanPainted: painted });
    edit(shader);
  };
  material.customProgramCacheKey = () => `${base}-${key}`;
  material.needsUpdate = true;
}

/**
 * A cut face shows the scan as the linked MRI does: unlit, the exact windowed grey of the plane it lies on.
 * A painted face shows its paint, unlit too, in the key's colours.
 *
 * `highlight` is spliced into the shader as a GLSL expression for the mark: the solids' `capLift`.
 */
export function addMriCutAppearance(
  material: Material,
  uniforms: MriUniforms,
  highlight: string,
): void {
  extend(material, uniforms, `mri-${highlight}`, (shader) => {
    shader.vertexShader = replaceOnce(
      `varying vec3 scanWorld;\n${shader.vertexShader}`,
      '#include <begin_vertex>',
      `#include <begin_vertex>
      scanWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
    );
    shader.fragmentShader = replaceOnce(
      `${SCAN_FRAGMENT}
      uniform mat4 worldToScan;
      uniform vec3 scanHighlight;
      varying vec3 scanWorld;
      ${shader.fragmentShader}`,
      '#include <opaque_fragment>',
      `
        if (scanEnabled && scanPainted) {
          outgoingLight = diffuseColor.rgb;
        } else if (scanEnabled) {
          float gray = scanGray(scanSignal((worldToScan * vec4(scanWorld, 1.0)).xyz));
          // The scan is the luminance channel, so a mark rides on hue instead:
          // the accent normalised to unit luma, scaled by the scan's own
          // brightness, which tints the face without flattening the tissue
          // under it. Lifting toward white would read as brighter tissue.
          float mark = ${highlight};
          float lifted = clamp(gray + mark * ${glsl(MRI_MARK.lift)}, 0.0, 1.0);
          vec3 hue = scanHighlight / max(dot(scanHighlight, ${LUMA}), 1e-4);
          vec3 tone = clamp(mix(vec3(lifted), lifted * hue,
            min(mark * ${glsl(MRI_MARK.tint)}, 1.0)), 0.0, 1.0);
          // The linked canvas writes display grayscale bytes. Decode here so
          // the composer's sRGB output conversion returns the same values.
          outgoingLight = sRGBTransferEOTF(vec4(tone, 1.0)).rgb;
        }
        #include <opaque_fragment>
      `,
    );
  });
}

/**
 * A surface shows the scan of the tissue it bounds, lit by the stage's own diffuse light; a painted surface
 * shows its paint in the same light.
 *
 * The light is what a white surface receives, which the stage calibrates to about 1 where a surface faces it
 * squarely: there the scan's own grey shows, and elsewhere only darker. Specular is left out, since a
 * highlight would read as brighter tissue. `SCAN_SHADE` lets the reader's map over the scan take the same light.
 */
export function addMriSurfaceAppearance(
  material: Material,
  uniforms: MriUniforms,
  sample: MriSurfaceSample,
): void {
  extend(material, uniforms, `mri-surface-${sample}`, (shader) => {
    const midThickness = sample === 'mid-thickness';
    if (midThickness && !shader.fragmentShader.includes('varying float vT1;')) {
      throw new Error('Mid-thickness MRI needs the cortex shading and its _t1 field.');
    }
    if (!midThickness) {
      const depth = rasToWorld([SURFACE_DEPTH_MM, 0, 0]).length();
      shader.vertexShader = replaceOnce(
        `uniform mat4 worldToScan;\nvarying vec3 scanVoxel;\n${shader.vertexShader}`,
        '#include <begin_vertex>',
        `#include <begin_vertex>
      vec3 scanAt = (modelMatrix * vec4(transformed, 1.0)).xyz
        - normalize(mat3(modelMatrix) * objectNormal) * ${glsl(depth)};
      scanVoxel = (worldToScan * vec4(scanAt, 1.0)).xyz;`,
      );
    }
    const lit = replaceOnce(
      `${SCAN_FRAGMENT}${midThickness ? '' : 'varying vec3 scanVoxel;\n'}${shader.fragmentShader}`,
      '#include <lights_physical_fragment>',
      `vec3 scanPaint = diffuseColor.rgb;
      if (scanEnabled) diffuseColor.rgb = vec3(1.0);
      #include <lights_physical_fragment>`,
    );
    shader.fragmentShader = replaceOnce(
      lit,
      '#include <opaque_fragment>',
      `
        float scanShade = 1.0;
        if (scanEnabled) {
          scanShade = min(dot(reflectedLight.directDiffuse + reflectedLight.indirectDiffuse, ${LUMA}), 1.0);
          float gray = scanGray(${midThickness ? 'vT1' : 'scanSignal(scanVoxel)'});
          vec3 albedo = scanPainted ? scanPaint : sRGBTransferEOTF(vec4(vec3(gray), 1.0)).rgb;
          outgoingLight = albedo * scanShade;
        }
        #define SCAN_SHADE
        #include <opaque_fragment>
      `,
    );
  });
}
