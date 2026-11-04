import type { VisualFieldDot, VisualFieldPoint } from '../../engine/api.ts';

export type VisualArea = 'V1' | 'V2' | 'V3';
export const VISUAL_AREAS: readonly VisualArea[] = ['V1', 'V2', 'V3'];
export type FieldHemisphere = 'left' | 'right';

/** One hemisphere's V1–V3 vertices: predicted pRF centre (degrees), area code and midthickness mm². */
export interface HemisphereTerritories {
  x: Float32Array;
  y: Float32Array;
  area: Uint8Array;
  mm2: Float32Array;
}

/** The published `retinotopy.json`, read into typed arrays. */
export type VisualFieldTerritories = Record<FieldHemisphere, HemisphereTerritories>;

/** Read and check the sidecar the build writes beside the manifest. */
export function parseVisualFieldTerritories(document: unknown): VisualFieldTerritories {
  const { areas, hemispheres } = document as {
    areas: Record<string, number>;
    hemispheres: Record<string, Record<'x' | 'y' | 'area' | 'mm2', number[]>>;
  };
  if (JSON.stringify(areas) !== JSON.stringify({ V1: 1, V2: 2, V3: 3 })) {
    throw new Error('The retinotopy sidecar must code V1, V2 and V3 as 1, 2 and 3.');
  }
  const read = (side: FieldHemisphere): HemisphereTerritories => {
    const hemisphere = hemispheres?.[side];
    if (!hemisphere) throw new Error(`The retinotopy sidecar has no ${side} hemisphere.`);
    const count = hemisphere.x.length;
    if ([hemisphere.y, hemisphere.area, hemisphere.mm2].some((values) => values.length !== count)) {
      throw new Error(`The ${side} hemisphere's retinotopy arrays differ in length.`);
    }
    if (hemisphere.area.some((code) => code < 1 || code > 3)) {
      throw new Error(`The ${side} hemisphere lists a vertex outside V1–V3.`);
    }
    return {
      x: Float32Array.from(hemisphere.x),
      y: Float32Array.from(hemisphere.y),
      area: Uint8Array.from(hemisphere.area),
      mm2: Float32Array.from(hemisphere.mm2),
    };
  };
  return { left: read('left'), right: read('right') };
}

/**
 * The cortex the dot covers in each hemisphere and area, in mm² of midthickness: every vertex whose
 * predicted pRF centre lies inside the dot, as the map draws its territory.
 */
export function territoryOf(
  territories: VisualFieldTerritories,
  { x, y, radius }: VisualFieldDot,
): Record<FieldHemisphere, Record<VisualArea, number>> {
  const sum = ({ x: xs, y: ys, area, mm2 }: HemisphereTerritories) => {
    const totals = [0, 0, 0, 0];
    const reach = radius * radius;
    for (let vertex = 0; vertex < xs.length; vertex += 1) {
      const dx = xs[vertex]! - x;
      const dy = ys[vertex]! - y;
      if (dx * dx + dy * dy <= reach) totals[area[vertex]!]! += mm2[vertex]!;
    }
    return { V1: totals[1]!, V2: totals[2]!, V3: totals[3]! };
  };
  return { left: sum(territories.left), right: sum(territories.right) };
}

/** The hemisphere that represents a point: the left hemisphere the right half-field. Null on the meridian. */
export function hemisphereFor({ x }: VisualFieldPoint): FieldHemisphere | null {
  return x > 0 ? 'left' : x < 0 ? 'right' : null;
}

/** Eccentricity, and polar angle from the upper vertical meridian (0°) to the lower (180°), in degrees. */
export function polar({ x, y }: VisualFieldPoint): { eccentricity: number; angle: number } {
  const eccentricity = Math.hypot(x, y);
  return {
    eccentricity,
    angle: eccentricity === 0 ? 0 : (Math.acos(y / eccentricity) * 180) / Math.PI,
  };
}

/** Which quarter of the field a point lies in, by the side it is on and whether it is above fixation. */
export function quadrant({ x, y }: VisualFieldPoint): {
  vertical: 'upper' | 'lower' | null;
  horizontal: 'left' | 'right' | null;
} {
  return {
    vertical: y > 0 ? 'upper' : y < 0 ? 'lower' : null,
    horizontal: x > 0 ? 'right' : x < 0 ? 'left' : null,
  };
}

/*
 * The disc's radial scale is logarithmic, as cortical magnification roughly is: equal steps outward
 * on the disc are about equal distances along V1. With this constant the measured 8° falls near
 * three fifths of the radius and 90° at the rim.
 */
const LOG_OFFSET_DEG = 0.25;

/** Where an eccentricity falls on the disc, 0 at fixation to 1 at `maximum`. */
export function discRadius(eccentricity: number, maximum: number): number {
  return Math.log1p(eccentricity / LOG_OFFSET_DEG) / Math.log1p(maximum / LOG_OFFSET_DEG);
}

/** The eccentricity at a radius on the disc; the inverse of `discRadius`. */
export function eccentricityAt(radius: number, maximum: number): number {
  return LOG_OFFSET_DEG * Math.expm1(radius * Math.log1p(maximum / LOG_OFFSET_DEG));
}

/** A visual-field point on the unit disc: right is +x, up is +y. */
export function toDisc(point: VisualFieldPoint, maximum: number): VisualFieldPoint {
  const { eccentricity } = polar(point);
  if (eccentricity === 0) return { x: 0, y: 0 };
  const scale = discRadius(eccentricity, maximum) / eccentricity;
  return { x: point.x * scale, y: point.y * scale };
}

/** The visual-field point at a place on the unit disc, held inside the field's maximum. */
export function fromDisc(place: VisualFieldPoint, maximum: number): VisualFieldPoint {
  const radius = Math.min(Math.hypot(place.x, place.y), 1);
  if (radius === 0) return { x: 0, y: 0 };
  const eccentricity = eccentricityAt(radius, maximum);
  const length = Math.hypot(place.x, place.y);
  return { x: (place.x / length) * eccentricity, y: (place.y / length) * eccentricity };
}

/** The dot's outline on the disc: its circle in degrees, which the log scale bends. */
export function dotOutline(dot: VisualFieldDot, maximum: number, points = 72): VisualFieldPoint[] {
  return Array.from({ length: points }, (_, index) => {
    const turn = (2 * Math.PI * index) / points;
    return toDisc(
      { x: dot.x + dot.radius * Math.cos(turn), y: dot.y + dot.radius * Math.sin(turn) },
      maximum,
    );
  });
}
