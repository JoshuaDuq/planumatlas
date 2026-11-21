// Which regions the stage names, and where: those facing the reader that the camera shows large enough
// to label, by how much of each is turned toward it, largest first, up to 24, so zooming in names smaller
// ones and turning names what comes into view; the selection whenever it faces
// the reader (handoff F3). Under Lobes colour a cortical region is named by its lobe. A name already
// shown keeps its place while it is still in sight and not much smaller, so a small move renames nothing.
// A name is written once: of two that read the same, as the two sides' frontal lobes do, the first is drawn;
// and no two dots stand closer than 14 px.
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
/** A name already shown is kept until its region spans less than this: a zoom back and forth renames nothing. */
export const KEPT_SIZE_PX = 36;
/** Of a lobe's regions, the largest this many are asked whether they face the reader. */
const LOBE_PROBES = 3;
/** Two names' dots stand at least this far apart, so neither reads as the other's. */
export const DOT_APART_PX = 14;

/** A name the stage draws. */
export interface Named {
  key: string;
  /** The region a click on the name selects; null for a lobe, which the colour key names. */
  region: string | null;
  /** The lobe it names; null for a region. */
  lobe: string | null;
  /** The region whose surface or cut face holds the point: the region itself, or one of the lobe's. */
  on: string;
  /** The point is on a cut face, which a moved cut carries. */
  face: boolean;
  point: ScreenPoint;
  /** Where the point is drawn, in RAS mm, which a camera move carries until the next choice. */
  drawn: Vec3;
}

/** A name the stage shows now, which the next choice keeps where it can. */
export interface Kept extends Pick<Named, 'key' | 'on' | 'face'> {
  /** Where it stands now while that is still in sight (`EngineModel.inSight`); null once it is not. */
  drawn: Vec3 | null;
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
  /**
   * The names shown now: each is named again first, where it stands while that is in sight, else at a
   * point it is found at again.
   */
  kept: readonly Kept[];
  /** The words a name is drawn with: of two names that read the same, only the first in priority order is drawn. */
  words(name: Pick<Named, 'region' | 'lobe'>): string;
  /** How much of each region is turned toward the camera, in mm² seen (`EngineModel.facingArea`). */
  facingArea(ids: readonly string[]): number[];
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
  /** A cut face, the largest where several share the key. */
  face: CapAnchor | null;
}

/**
 * The cortex, its lobes and the structures facing the reader, named in priority order: the selection
 * first, then the names kept, then by size. One ray is cast per region asked, in batches of the names
 * still wanted, so a stage of hundreds of parcels asks only the largest.
 */
export function chooseNames(sources: NameSources): Named[] {
  const { regions, drawn, scale, selected, byLobe, faces, faceCosine, bounds } = sources;
  const kept = new Map(sources.kept.map((name) => [name.key, name]));
  const groupOf = (region: Region) => {
    const lobe = byLobe ? lobeOf(region) : null;
    return lobe
      ? { key: `lobe:${lobe}:${region.hemisphere}`, region: null, lobe }
      : { key: region.id, region: region.id, lobe: null };
  };
  // How much of each region the camera sees turned toward it, whatever stands in front.
  const turned = sources.facingArea(drawn.map(({ id }) => id));

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
  drawn.forEach((region, index) => {
    const areaMm2 = turned[index]!;
    if (!areaMm2) return;
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
  });
  for (const face of faces) {
    const region = regions.get(face.region);
    if (!region) throw new Error(`Unknown region: ${face.region}`);
    add(cut, groupOf(region), face.areaMm2, null, face);
  }

  // A surface's area turned toward the camera is its size seen; a flat face's is its area foreshortened.
  const sizeOf = (candidate: Candidate) =>
    candidate.face
      ? Math.sqrt(candidate.areaMm2 * faceCosine) * scale
      : Math.sqrt(candidate.areaMm2) * scale;
  // Kept on the same kind of point: a name on a cut face is not kept by its surface, nor the reverse.
  const keptAs = (candidate: Candidate) =>
    kept.get(candidate.key)?.face === (candidate.face !== null) ? kept.get(candidate.key)! : null;
  const ordered = [...surface.values(), ...cut.values()]
    .map((candidate) => ({ candidate, size: sizeOf(candidate), kept: keptAs(candidate) !== null }))
    .filter(
      ({ candidate, size, kept }) =>
        size >= (kept ? KEPT_SIZE_PX : NAMED_SIZE_PX) || candidate.key === selected,
    )
    .sort(
      (a, b) =>
        Number(b.candidate.key === selected) - Number(a.candidate.key === selected) ||
        Number(b.kept) - Number(a.kept) ||
        b.size - a.size ||
        a.candidate.key.localeCompare(b.candidate.key),
    )
    .map(({ candidate }) => candidate);
  for (const candidate of ordered) {
    candidate.members.sort((a, b) => b.areaMm2 - a.areaMm2);
    // A kept lobe is asked first about the region its name stood on, so its dot stays there.
    const at = candidate.members.findIndex(({ id }) => id === keptAs(candidate)?.on);
    if (at > 0) candidate.members.unshift(...candidate.members.splice(at, 1));
  }

  const inside = ({ x, y }: ScreenPoint) =>
    x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height;
  const named: Named[] = [];
  const done = new Set<string>();
  const written = new Set<string>();
  let next = 0;
  while (named.length < MAX_NAMES && next < ordered.length) {
    const batch: Candidate[] = [];
    while (batch.length < MAX_NAMES - named.length && next < ordered.length) {
      const candidate = ordered[next++]!;
      if (!done.has(candidate.key) && !written.has(sources.words(candidate))) batch.push(candidate);
    }
    // A kept name still in sight stands where it is, and a cut face at its anchor: no ray asks for either.
    const held = (candidate: Candidate) => keptAs(candidate)?.drawn ?? null;
    const pinned = batch.filter((candidate) => held(candidate) || candidate.face);
    const asked = batch
      .filter((candidate) => !pinned.includes(candidate))
      .flatMap(({ members }) => members.slice(0, LOBE_PROBES).map(({ id }) => id));
    const answers = asked.length ? sources.facing(asked) : [];
    const answer = new Map(asked.map((id, index) => [id, answers[index] ?? null]));
    const projected = sources.project(
      pinned.map((candidate) => held(candidate) ?? candidate.face!.point),
    );
    for (const candidate of batch) {
      if (named.length === MAX_NAMES) break;
      const words = sources.words(candidate);
      if (done.has(candidate.key) || written.has(words)) continue;
      let point: FacingPoint | null = null;
      let on: string | null = null;
      if (pinned.includes(candidate)) {
        const onScreen = projected[pinned.indexOf(candidate)];
        point = onScreen ? { ...onScreen, drawn: held(candidate) ?? candidate.face!.point } : null;
        on = held(candidate) ? keptAs(candidate)!.on : candidate.face!.region;
      } else {
        // A lobe stands on its largest region that faces the reader on the stage, not one off its edge.
        on =
          candidate.members.slice(0, LOBE_PROBES).find(({ id }) => {
            const found = answer.get(id);
            return found && inside(found);
          })?.id ?? null;
        point = on === null ? null : answer.get(on)!;
      }
      if (!point || on === null || !inside(point)) continue;
      const crowds = named.some(
        (other) => Math.hypot(other.point.x - point!.x, other.point.y - point!.y) < DOT_APART_PX,
      );
      if (crowds) continue;
      done.add(candidate.key);
      written.add(words);
      const { x, y, drawn: at } = point;
      named.push({
        key: candidate.key,
        region: candidate.region,
        lobe: candidate.lobe,
        on,
        face: candidate.face !== null,
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
 * a focused ghost, mode paint, tracts, circuit lesson, or visual-field map already directing attention.
 * Plan 1's Study mode (WP8) must add itself here: names are always off while studying.
 */
export function namesDrawn(view: {
  namesShown: boolean;
  exploded: boolean;
  /** The tract reference is shown alone. */
  tractReference: boolean;
  /** A circuit lesson (whole route or landmark step) is open on the stage. */
  lessonOpen: boolean;
  /** The visual-field map is open, naming its own areas. */
  mapOpen: boolean;
  /** Focus is active: one region stands out against a grey ghost cortex. */
  focused: boolean;
  /** Functions, Deficits, or another data paint is active on the stage. */
  painted: boolean;
  /** The Tracts explorer is active over a grey ghost cortex. */
  tracts: boolean;
}): boolean {
  return (
    view.namesShown &&
    !view.exploded &&
    !view.tractReference &&
    !view.lessonOpen &&
    !view.mapOpen &&
    !view.focused &&
    !view.painted &&
    !view.tracts
  );
}
