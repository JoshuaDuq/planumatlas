import { Vector3 } from 'three';
import type {
  BufferGeometry,
  Data3DTexture,
  DataTexture,
  Intersection,
  IUniform,
  Material,
  Matrix4,
  Mesh,
  Vector2,
  WebGLProgramParametersWithUniforms,
  WebGLRenderer,
} from 'three';
import {
  ANATOMICAL_WORLD,
  EXPLODE_SHIFT_UNIFORM,
  anatomicalPoint,
  explodeShift,
} from '../model/explode.ts';
import { rasToWorld, worldToRas } from '../slices/coordinates.ts';
import type { Volume } from '../slices/volume.ts';
import { HIGHLIGHT_CHUNK } from './highlight.ts';
import { LABEL_AT } from './label-sampling.ts';
import type { Label } from './palette.ts';

/**
 * How far inside itself a surface reads the map. A structure's surface lies on its labels' boundary; 1 mm in,
 * 94% of CDMD's outer cerebellar surface is in a mapped region, the rest mostly exposed white matter.
 */
export const MAP_DEPTH_MM = 1;

/** A cut atlas's label grid as a surface reads it: the cut's own volume, texture and highlight codes. */
export interface SurfaceMap {
  atlas: string;
  labels: readonly Label[];
  volume: Volume;
  texture: Data3DTexture;
  worldToVoxel: Matrix4;
  shape: Vector3;
  /** `createMapPalette`: the map's labels opaque in their colour, all others transparent. */
  palette: DataTexture;
  highlightCodes: Vector2;
  highlightLifts: Vector2;
}

export interface SurfaceMapUniforms {
  surfaceMapVolume: IUniform<Data3DTexture>;
  surfaceMapPalette: IUniform<DataTexture>;
  worldToSurfaceMap: IUniform<Matrix4>;
  surfaceMapShape: IUniform<Vector3>;
  surfaceMapHighlightCodes: IUniform<Vector2>;
  surfaceMapHighlightLifts: IUniform<Vector2>;
  [uniform: string]: IUniform;
}

/** Shared by every surface that draws the map; the highlight codes are the cut's, so a region lights on both. */
export const surfaceMapUniforms = (map: SurfaceMap): SurfaceMapUniforms => ({
  surfaceMapVolume: { value: map.texture },
  surfaceMapPalette: { value: map.palette },
  worldToSurfaceMap: { value: map.worldToVoxel },
  surfaceMapShape: { value: map.shape },
  surfaceMapHighlightCodes: { value: map.highlightCodes },
  surfaceMapHighlightLifts: { value: map.highlightLifts },
});

/** Whether a material draws the map now; `drawLayers` sets it. */
export const drawsSurfaceMap = (material: Material): IUniform<boolean> | undefined =>
  material.userData['surfaceMapHere'] as IUniform<boolean> | undefined;

/** Draw only the map regions `shown` keeps: one hidden or isolated away leaves the surface its own colour, as on a cut. */
export function showSurfaceMapRegions(map: SurfaceMap, shown: (regionId: string) => boolean): void {
  const data = map.palette.image.data as Float32Array;
  let changed = false;
  for (const [code, label] of map.labels.entries()) {
    if (!label.region_id?.startsWith(`${map.atlas}:`)) continue;
    const alpha = shown(label.region_id) ? 1 : 0;
    if (data[code * 4 + 3] === alpha) continue;
    data[code * 4 + 3] = alpha;
    changed = true;
  }
  if (changed) map.palette.needsUpdate = true;
}

/**
 * Colour a surface by the map region beneath it, read as a cut face reads it (`labelAt`); where the map has no
 * region the surface keeps its own colour.
 */
export function addSurfaceMap(material: Material, uniforms: SurfaceMapUniforms): void {
  const here: IUniform<boolean> = { value: false };
  material.userData['surfaceMapHere'] = here;
  const compile = material.onBeforeCompile;
  const key = material.customProgramCacheKey();
  const depth = rasToWorld([MAP_DEPTH_MM, 0, 0]).length();
  material.onBeforeCompile = (
    shader: WebGLProgramParametersWithUniforms,
    renderer: WebGLRenderer,
  ) => {
    compile.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms, {
      surfaceMapHere: here,
      explodeShift: explodeShift(material),
    });
    shader.vertexShader = `uniform mat4 worldToSurfaceMap;
${EXPLODE_SHIFT_UNIFORM}varying vec3 surfaceMapVoxel;
${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      surfaceMapVoxel = (worldToSurfaceMap * vec4(${ANATOMICAL_WORLD}
        - normalize(mat3(modelMatrix) * objectNormal) * ${depth.toFixed(6)}, 1.0)).xyz;`,
    );
    shader.fragmentShader = `uniform bool surfaceMapHere;
uniform highp usampler3D surfaceMapVolume;
uniform sampler2D surfaceMapPalette;
uniform ivec3 surfaceMapShape;
uniform vec2 surfaceMapHighlightCodes;
uniform vec2 surfaceMapHighlightLifts;
varying vec3 surfaceMapVoxel;
${LABEL_AT}
${HIGHLIGHT_CHUNK}
${shader.fragmentShader}`.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      if (surfaceMapHere) {
        uint mapCode = labelAt(surfaceMapVolume, surfaceMapShape, surfaceMapVoxel);
        vec4 mapped = texelFetch(surfaceMapPalette, ivec2(int(mapCode), 0), 0);
        if (mapped.a >= 0.5) {
          float here = float(mapCode);
          diffuseColor.rgb = liftHighlight(mapped.rgb,
            here == surfaceMapHighlightCodes.y ? surfaceMapHighlightLifts.y
              : here == surfaceMapHighlightCodes.x ? surfaceMapHighlightLifts.x : 0.0);
        }
      }`,
    );
  };
  material.customProgramCacheKey = () => `${key}-surface-map-v1`;
  material.needsUpdate = true;
}

const normalA = new Vector3();
const normalB = new Vector3();
const normalC = new Vector3();

/**
 * The map region a hit on a surface drawing the map lies in, by the shader's rule: the vertex normal at the hit,
 * the anatomy's position, `MAP_DEPTH_MM` in. Null where the map has no region.
 */
export function surfaceMapRegionAt(
  hit: Intersection<Mesh<BufferGeometry, Material>>,
  map: SurfaceMap,
): string | null {
  const { face, barycoord, object } = hit;
  if (!face || !barycoord) throw new Error('A surface map is read at a triangle hit.');
  const normals = object.geometry.getAttribute('normal');
  const normal = new Vector3()
    .addScaledVector(normalA.fromBufferAttribute(normals, face.a), barycoord.x)
    .addScaledVector(normalB.fromBufferAttribute(normals, face.b), barycoord.y)
    .addScaledVector(normalC.fromBufferAttribute(normals, face.c), barycoord.z)
    .transformDirection(object.matrixWorld);
  const point = anatomicalPoint(hit).addScaledVector(
    normal,
    -rasToWorld([MAP_DEPTH_MM, 0, 0]).length(),
  );
  const label = map.labels[map.volume.label(worldToRas(point))];
  return label?.region_id?.startsWith(`${map.atlas}:`) ? label.region_id : null;
}
