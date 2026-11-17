// Which regions the stage names, and where: those facing the reader that the camera shows large enough
// to label, largest first, up to 24, so zooming in names smaller ones; the selection whenever it faces
// the reader (handoff F3). Under Lobes colour a cortical region is named by its lobe.
import { lobeOf } from '../../lib/core/catalog/lobes.ts';
import type {
  CapAnchor,
  FacingPoint,
  Rect,
  Region,
  ScreenPoint,
  Vec3,
} from '../../lib/types/index.ts';

export const MAX_NAMES = 24;
/** A region is named once it would span this many CSS pixels on the stage. */
export const NAMED_SIZE_PX = 48;
/** Of a lobe's regions, the largest this many are asked whether they face the reader. */
const LOBE_PROBES = 3;

/** A name the stage draws. */
export interface Named {
  key: string;
  /** The region a click on the name selects; null for a lobe, which the colour key names. */
  region: string | null;
  /** The lobe it names; null for a region. */
  lobe: string | null;
  point: ScreenPoint;
  /** Where the point is drawn, in RAS mm, which a camera move carries until the next choice. */
  drawn: Vec3;
}

export interface NameSources {
  /** Every region of the anatomy, for a cut face's record. */
  regions: ReadonlyMap<string, Region>;
  /** The cortical regions and structures drawn now that a click could select. */
  drawn: readonly Region[];
  /** CSS pixels per millimetre where the camera looks (the scale bar's). */
  scale: number;
  /** Named whenever it faces the reader, whatever its size. */
  selected: string | null;
  /** Lobes colour: name each cortical region's lobe instead. */
  byLobe: boolean;
  /** The cut's faces while the reader sees the cut's open side; none otherwise. */
  faces: readonly CapAnchor[];
  /** How squarely the cut is seen (the cosine of the angle to its normal); a face's size shrinks with it. */
  faceCosine: number;
  /** The visible stage: a point outside it is not named. */
  bounds: Rect;
  facing(ids: readonly string[]): (FacingPoint | null)[];
  project(points: readonly Vec3[]): (ScreenPoint | null)[];
}

interface Candidate {
  key: string;
  region: string | null;
  lobe: string | null;
  areaMm2: number;
  /** Surface regions asked whether they face the reader, largest first; empty for a cut face. */
  members: { id: string; areaMm2: number }[];
  /** A cut face's point, the largest face's where several share the key. */
  face: { point: Vec3; areaMm2: number } | null;
}

/**
 * The cortex, its lobes and the structures facing the reader, named in priority order: the selection
 * first, then by size. One ray is cast per region asked, in batches of the names still wanted, so a
 * stage of hundreds of parcels asks only the largest.
 */
export function chooseNames(sources: NameSources): Named[] {
  const { regions, drawn, scale, selected, byLobe, faces, faceCosine, bounds } = sources;
  const groupOf = (region: Region) => {
    const lobe = byLobe ? lobeOf(region) : null;
    return lobe
      ? { key: `lobe:${lobe}:${region.hemisphere}`, region: null, lobe }
      : { key: region.id, region: region.id, lobe: null };
  };
  const areaOf = (region: Region) => {
    if (region.surface_area_mm2 === undefined) {
      throw new Error(`The manifest gives no surface area for ${region.id}.`);
    }
    return region.surface_area_mm2;
  };

  const surface = new Map<string, Candidate>();
  const cut = new Map<string, Candidate>();
  const add = (
    into: Map<string, Candidate>,
    group: Pick<Candidate, 'key' | 'region' | 'lobe'>,
    areaMm2: number,
    member: Candidate['members'][number] | null,
    face: Candidate['face'],
  ) => {
    const candidate = into.get(group.key) ?? { ...group, areaMm2: 0, members: [], face: null };
    candidate.areaMm2 += areaMm2;
    if (member) candidate.members.push(member);
    if (face && (!candidate.face || face.areaMm2 > candidate.face.areaMm2)) candidate.face = face;
    into.set(group.key, candidate);
  };
  for (const region of drawn) {
    const areaMm2 = areaOf(region);
    add(surface, groupOf(region), areaMm2, { id: region.id, areaMm2 }, null);
    // Under Lobes colour the selection is named as itself too.
    if (region.id === selected && groupOf(region).key !== region.id) {
      add(
        surface,
        { key: region.id, region: region.id, lobe: null },
        areaMm2,
        { id: region.id, areaMm2 },
        null,
      );
    }
  }
  for (const face of faces) {
    const region = regions.get(face.region);
    if (!region) throw new Error(`Unknown region: ${face.region}`);
    add(cut, groupOf(region), face.areaMm2, null, face);
  }

  // A convex body's mean projected area is a quarter of its surface's (Cauchy), a flat face's its own.
  const sizeOf = (candidate: Candidate) =>
    candidate.face
      ? Math.sqrt(candidate.areaMm2 * faceCosine) * scale
      : (Math.sqrt(candidate.areaMm2) / 2) * scale;
  const ordered = [...surface.values(), ...cut.values()]
    .map((candidate) => ({ candidate, size: sizeOf(candidate) }))
    .filter(({ candidate, size }) => size >= NAMED_SIZE_PX || candidate.key === selected)
    .sort(
      (a, b) =>
        Number(b.candidate.key === selected) - Number(a.candidate.key === selected) ||
        b.size - a.size ||
        a.candidate.key.localeCompare(b.candidate.key),
    )
    .map(({ candidate }) => candidate);
  for (const candidate of ordered) candidate.members.sort((a, b) => b.areaMm2 - a.areaMm2);

  const inside = ({ x, y }: ScreenPoint) =>
    x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height;
  const named: Named[] = [];
  const done = new Set<string>();
  let next = 0;
  while (named.length < MAX_NAMES && next < ordered.length) {
    const batch: Candidate[] = [];
    while (batch.length < MAX_NAMES - named.length && next < ordered.length) {
      const candidate = ordered[next++]!;
      if (!done.has(candidate.key)) batch.push(candidate);
    }
    const asked = batch.flatMap(({ members }) => members.slice(0, LOBE_PROBES).map(({ id }) => id));
    const answers = asked.length ? sources.facing(asked) : [];
    const answer = new Map(asked.map((id, index) => [id, answers[index] ?? null]));
    const withFaces = batch.filter(({ face }) => face);
    const projected = sources.project(withFaces.map(({ face }) => face!.point));
    for (const candidate of batch) {
      if (named.length === MAX_NAMES) break;
      if (done.has(candidate.key)) continue;
      let point: FacingPoint | null = null;
      if (candidate.face) {
        const onScreen = projected[withFaces.indexOf(candidate)];
        point = onScreen ? { ...onScreen, drawn: candidate.face.point } : null;
      } else {
        // A lobe stands on its largest region that faces the reader on the stage, not one off its edge.
        point =
          candidate.members
            .slice(0, LOBE_PROBES)
            .map(({ id }) => answer.get(id))
            .find((found): found is FacingPoint => Boolean(found) && inside(found!)) ?? null;
      }
      if (!point || !inside(point)) continue;
      done.add(candidate.key);
      const { x, y, drawn: at } = point;
      named.push({
        key: candidate.key,
        region: candidate.region,
        lobe: candidate.lobe,
        point: { x, y },
        drawn: at,
      });
    }
  }
  return named;
}

/**
 * How squarely the camera sees the cut's open face, the cosine of its angle to the face's normal; 0 or
 * less from the side the cut keeps, where the anatomy hides the faces. `back` is the camera's world
 * basis out of the screen, `normal` the cut's own in RAS; a reversed cut keeps the other side.
 */
export function cutCosine(back: Vec3, normal: Vec3, reverse: boolean): number {
  // World x, y, z are RAS right, superior and posterior.
  const toward = back[0] * normal[0] - back[2] * normal[1] + back[1] * normal[2];
  return reverse ? -toward : toward;
}

/**
 * Whether the names are drawn: the switch is on and the stage shows the anatomy where it lies, without
 * names of its own. Plan 1's Study mode (WP8) must add itself here: names are always off while studying.
 */
export function namesDrawn(view: {
  namesShown: boolean;
  exploded: boolean;
  /** The tract reference is shown alone. */
  tractReference: boolean;
  /** A lesson's whole route is on the stage, with its landmarks named. */
  routeShown: boolean;
  /** The visual-field map is open, naming its own areas. */
  mapOpen: boolean;
}): boolean {
  return (
    view.namesShown && !view.exploded && !view.tractReference && !view.routeShown && !view.mapOpen
  );
}
