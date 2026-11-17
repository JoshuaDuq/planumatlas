import { Box3, Triangle, Vector3 } from 'three';
import type { Region } from '../../types/index.ts';
import { VISUAL_RESPONSE_THRESHOLD, predictedResponse } from '../../core/learning/visual-field.ts';
import { fieldDecode } from '../render/materials.ts';
import type { VisualFieldUniforms } from '../render/materials.ts';
import type { SurfaceHit } from '../render/picking.ts';
import type { NamedVisualArea, VisualFieldDot, VisualFieldReading } from '../api.ts';
import type { AtlasMesh, Layer } from './layers.ts';
import type { AtlasManifest } from './manifest.ts';

/**
 * The world box of the drawn cortex the dot is predicted to drive at least as strongly as the map
 * colours (`VISUAL_RESPONSE_THRESHOLD`), each vertex read as the shader reads it; null where it
 * drives none.
 */
export function visualFieldActivation(
  dot: VisualFieldDot,
  meshes: readonly AtlasMesh[],
  manifest: AtlasManifest,
): Box3 | null {
  const ranges = manifest.appearance.field_ranges;
  const [xLow, xSpan] = fieldDecode(ranges, '_FIELD_X');
  const [yLow, ySpan] = fieldDecode(ranges, '_FIELD_Y');
  const [sigmaLow, sigmaSpan] = fieldDecode(ranges, '_PRF_SIGMA');
  const box = new Box3();
  const point = new Vector3();
  for (const mesh of meshes) {
    const { geometry } = mesh;
    const area = geometry.getAttribute('_visual_area');
    if (!area) continue;
    const [x, y, sigma] = ['_field_x', '_field_y', '_prf_sigma'].map((name) =>
      geometry.getAttribute(name)!,
    );
    const position = geometry.getAttribute('position');
    mesh.updateWorldMatrix(true, false);
    for (let vertex = 0; vertex < area.count; vertex += 1) {
      if (area.getX(vertex) < 0.5) continue;
      const s = sigma!.getX(vertex) * sigmaSpan + sigmaLow;
      const distance = Math.hypot(
        x!.getX(vertex) * xSpan + xLow - dot.x,
        y!.getX(vertex) * ySpan + yLow - dot.y,
      );
      if (distance > dot.radius + 6 * s) continue;
      if (predictedResponse(distance, dot.radius, s) < VISUAL_RESPONSE_THRESHOLD) continue;
      box.expandByPoint(point.fromBufferAttribute(position, vertex).applyMatrix4(mesh.matrixWorld));
    }
  }
  return box.isEmpty() ? null : box;
}

/**
 * The region of a hemisphere in `layer` with the most predicted V1 vertices inside the measured
 * eccentricity: where the map is measured rather than extrapolated, near the occipital pole.
 */
export function visualFieldRegion(
  hemisphere: 'left' | 'right',
  layer: Layer,
  manifest: AtlasManifest,
  regions: ReadonlyMap<string, Region>,
): string {
  const ranges = manifest.appearance.field_ranges;
  const [xLow, xSpan] = fieldDecode(ranges, '_FIELD_X');
  const [yLow, ySpan] = fieldDecode(ranges, '_FIELD_Y');
  const measured = manifest.retinotopy!.measured_eccentricity_deg;
  let best: { id: string; count: number } | null = null;
  for (const mesh of layer.meshes) {
    const region = regions.get(mesh.userData['region_id'] as string)!;
    if (region.kind !== 'cortex' || region.hemisphere !== hemisphere) continue;
    const { geometry } = mesh;
    const [area, x, y] = ['_visual_area', '_field_x', '_field_y'].map((name) =>
      geometry.getAttribute(name)!,
    );
    let count = 0;
    for (let vertex = 0; vertex < area!.count; vertex += 1) {
      const eccentricity = Math.hypot(
        x!.getX(vertex) * xSpan + xLow,
        y!.getX(vertex) * ySpan + yLow,
      );
      if (area!.getX(vertex) === 1 && eccentricity <= measured) count += 1;
    }
    if (count > (best?.count ?? 0)) best = { id: region.id, count };
  }
  if (!best) throw new Error(`No ${hemisphere} region holds predicted V1.`);
  return best.id;
}

/**
 * What the predicted retinotopy says where a ray met a cortical mesh, read as the map draws it:
 * only the triangle's V1–V3 corners are interpolated, and a point less than half in V1–V3 has
 * no reading. Null off the cortex.
 */
export function visualFieldAt(
  hit: SurfaceHit,
  manifest: AtlasManifest,
  regions: ReadonlyMap<string, Region>,
): VisualFieldReading | null {
  const mesh = hit.object as AtlasMesh | undefined;
  const area = mesh?.geometry?.getAttribute('_visual_area');
  if (!mesh || !hit.face || !area) return null;
  const weights = cornerWeights(mesh, hit.point, hit.face);
  if (!weights) return null;
  const { a, b, c } = hit.face;
  const corners = [a, b, c];
  const inside = corners.map((corner, k) =>
    area.getX(corner) >= 0.5 ? weights.getComponent(k) : 0,
  );
  const share = inside[0]! + inside[1]! + inside[2]!;
  if (share < 0.5) return null;
  const ranges = manifest.appearance.field_ranges;
  const read = (name: string, attribute: string): number => {
    const [low, span] = fieldDecode(ranges, name);
    const values = mesh.geometry.getAttribute(attribute);
    return (
      corners.reduce((sum, corner, k) => sum + inside[k]! * (values.getX(corner) * span + low), 0) /
      share
    );
  };
  const code = Math.round(
    corners.reduce((sum, corner, k) => sum + inside[k]! * area.getX(corner), 0) / share,
  );
  const name = manifest.retinotopy!.areas.find((entry) => entry.code === code)?.name;
  if (!name) throw new Error(`Visual-area code ${code} is not published.`);
  const region = regions.get(mesh.userData['region_id'] as string)!;
  return {
    x: read('_FIELD_X', '_field_x'),
    y: read('_FIELD_Y', '_field_y'),
    sigma: read('_PRF_SIGMA', '_prf_sigma'),
    area: name as VisualFieldReading['area'],
    hemisphere: region.hemisphere as VisualFieldReading['hemisphere'],
  };
}

/** Where `point` (world) lies on the face's triangle, as barycentric weights; null for a degenerate one. */
function cornerWeights(
  mesh: AtlasMesh,
  point: Vector3,
  { a, b, c }: { a: number; b: number; c: number },
): Vector3 | null {
  const position = mesh.geometry.getAttribute('position');
  return Triangle.getBarycoord(
    mesh.worldToLocal(point.clone()),
    new Vector3().fromBufferAttribute(position, a),
    new Vector3().fromBufferAttribute(position, b),
    new Vector3().fromBufferAttribute(position, c),
    new Vector3(),
  );
}

/**
 * The named visual area where a ray met a cortical mesh, read as its borders are drawn: the code holding
 * the largest share of the triangle's corners at the point. Null off the cortex and outside every area.
 */
export function visualAreaAt(
  hit: SurfaceHit,
  manifest: AtlasManifest,
  regions: ReadonlyMap<string, Region>,
): NamedVisualArea | null {
  const mesh = hit.object as AtlasMesh | undefined;
  const codes = mesh?.geometry?.getAttribute('_wang_area');
  if (!mesh || !hit.face || !codes) return null;
  const weights = cornerWeights(mesh, hit.point, hit.face);
  if (!weights) return null;
  const shares = new Map<number, number>();
  const { a, b, c } = hit.face;
  [a, b, c].forEach((corner, k) => {
    const code = Math.round(codes.getX(corner));
    shares.set(code, (shares.get(code) ?? 0) + weights.getComponent(k));
  });
  const [code] = [...shares].reduce((best, entry) => (entry[1] > best[1] ? entry : best));
  if (code === 0) return null;
  const name = manifest.retinotopy!.visual_areas.areas.find((entry) => entry.code === code)?.name;
  if (!name) throw new Error(`Named visual-area code ${code} is not published.`);
  const region = regions.get(mesh.userData['region_id'] as string)!;
  return { name, hemisphere: region.hemisphere as NamedVisualArea['hemisphere'] };
}

/**
 * Each named area's border class by its code, 1 to 4, so that no two areas that meet share one: the
 * shader draws a border where two classes' shares meet, no area being a fifth class. Areas meeting the
 * most others are classed first; one that meets all four classes is an error.
 */
export function areaBorderClasses(meshes: readonly AtlasMesh[], size: number): Float32Array {
  const neighbours = Array.from({ length: size }, () => new Set<number>());
  for (const mesh of meshes) {
    const codes = mesh.geometry.getAttribute('_wang_area');
    if (!codes) throw new Error(`No named visual areas on ${mesh.userData['region_id']}.`);
    const index = mesh.geometry.getIndex();
    const corner = (at: number) => Math.round(codes.getX(index ? index.getX(at) : at));
    for (let at = 0; at < (index ? index.count : codes.count); at += 3) {
      const [p, q, r] = [corner(at), corner(at + 1), corner(at + 2)];
      for (const [one, other] of [
        [p, q],
        [q, r],
        [r, p],
      ] as const) {
        if (!one || !other || one === other) continue;
        neighbours[one]!.add(other);
        neighbours[other]!.add(one);
      }
    }
  }
  const classes = new Float32Array(size);
  const order = [...neighbours.keys()]
    .slice(1)
    .sort((a, b) => neighbours[b]!.size - neighbours[a]!.size || a - b);
  for (const code of order) {
    const taken = new Set([...neighbours[code]!].map((other) => classes[other]));
    const free = [1, 2, 3, 4].find((value) => !taken.has(value));
    if (free === undefined) {
      throw new Error(`Named visual area ${code} meets areas of all four border classes.`);
    }
    classes[code] = free;
  }
  return classes;
}

/** Draw the named areas' borders on the map, or stop; their classes are found the first time. */
export function showVisualAreaBorders(
  on: boolean,
  uniforms: VisualFieldUniforms,
  meshes: readonly AtlasMesh[],
): void {
  const classes = uniforms.visualAreaClass.value;
  if (on && !classes.some((value) => value > 0)) {
    classes.set(areaBorderClasses(meshes, classes.length));
  }
  uniforms.visualAreasMix.value = on ? 1 : 0;
}
