// Which regions the stage names, and where: those the reader sees large enough to label, by how much of each
// shows on the stage, largest first, up to 24, so zooming in names smaller ones and turning names what comes
// into view; the selection wherever any of it shows (handoff F3). What shows is asked, not reckoned: a grid of
// rays over the anatomy (`sightGrid`, `EngineModel.seenAt`) says which region, surface or cut face, the reader
// sees at each cell, so a region behind another is not named and each dot stands in the middle of the widest
// part of what shows. Under Lobes colour a cortical region is named by its lobe. A name already shown keeps
// its place while it is still in sight and not much smaller, so a small move renames nothing. A name is
// written once: of two that read the same, as the two sides' frontal lobes do, the first is drawn; and no
// two dots stand closer than 14 px.
import { lobeOf } from '../../lib/core/catalog/lobes.ts';
import type { Rect, Region, ScreenPoint, SeenPoint, Vec3 } from '../../lib/types/index.ts';

export const MAX_NAMES = 24;
/** A region is named once what shows of it would fill a square this many CSS pixels a side. */
export const NAMED_SIZE_PX = 40;
/** A name already shown is kept until its region shows less than this: a zoom back and forth renames nothing. */
export const KEPT_SIZE_PX = 30;
/** Two names' dots stand at least this far apart, so neither reads as the other's. */
export const DOT_APART_PX = 14;
/** The most cells a grid asks: a ray each, some 40 µs. */
const MAX_CELLS = 2000;
/** The finest a grid's cells are, in CSS pixels. */
const MIN_CELL_PX = 10;
/** A kept dot left at the rim of a patch at least this many cells deep moves back to its middle. */
const RIM_DEPTH = 3;

/** A grid of points over the stage, a ray asked through each. */
export interface SightGrid {
  /** The first cell's centre, the cells' side, and how many across and down, in CSS pixels. */
  x: number;
  y: number;
  cell: number;
  columns: number;
  rows: number;
}

/** What the reader sees at each cell of a grid, row by row (`EngineModel.seenAt`). */
export interface Sight extends SightGrid {
  seen: readonly (SeenPoint | null)[];
}

/** The grid over `rect`: square cells, as fine as `MAX_CELLS` rays allow and no finer than `MIN_CELL_PX`. */
export function sightGrid(rect: Rect): SightGrid {
  const cell = Math.max(MIN_CELL_PX, Math.sqrt((rect.width * rect.height) / MAX_CELLS));
  return {
    x: rect.x + cell / 2,
    y: rect.y + cell / 2,
    cell,
    columns: Math.max(0, Math.floor(rect.width / cell)),
    rows: Math.max(0, Math.floor(rect.height / cell)),
  };
}

/** The centre of each of a grid's cells, row by row. */
export function sightPoints({ x, y, cell, columns, rows }: SightGrid): ScreenPoint[] {
  return Array.from({ length: columns * rows }, (_, at) => ({
    x: x + (at % columns) * cell,
    y: y + Math.floor(at / columns) * cell,
  }));
}

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
  /** The regions drawn now that a click could select (a map's, on the surfaces drawing it): a surface names no other. */
  drawn: readonly Region[];
  /** What the reader sees, over the anatomy on the visible stage. */
  sight: Sight;
  /** Named wherever any of it shows, whatever its size. */
  selected: string | null;
  /** Where the selection shows when no cell of the grid falls on it: a ray asked at its own anchor. */
  selectedAt: (ScreenPoint & SeenPoint) | null;
  /** Lobes colour: name each cortical region's lobe instead. */
  byLobe: boolean;
  /** The visible stage: a point outside it is not named. */
  bounds: Rect;
  /**
   * The names shown now: each is named again first, where it stands while that is in sight, else in the
   * middle of what shows of it.
   */
  kept: readonly Kept[];
  /** The words a name is drawn with: of two names that read the same, only the first in priority order is drawn. */
  words(name: Pick<Named, 'region' | 'lobe'>): string;
  project(points: readonly Vec3[]): (ScreenPoint | null)[];
  /** What the reader sees at each point, as the grid was asked: a dot between cells is asked there. */
  seenAt(points: readonly ScreenPoint[]): (SeenPoint | null)[];
}

interface Candidate {
  key: string;
  region: string | null;
  lobe: string | null;
  /** The grid's cells that show it. */
  cells: number[];
}

/**
 * How deep each of `cells` lies inside them: 1 on the rim, where a cell beside it (or the grid's edge) is not
 * theirs, one more each step in. Its deepest cell is the middle of the widest part.
 */
function depths(cells: readonly number[], { columns, rows }: SightGrid): Map<number, number> {
  const depth = new Map<number, number>();
  const own = new Set(cells);
  const beside = (cell: number) => {
    const [column, row] = [cell % columns, Math.floor(cell / columns)];
    return [
      column > 0 ? cell - 1 : -1,
      column < columns - 1 ? cell + 1 : -1,
      row > 0 ? cell - columns : -1,
      row < rows - 1 ? cell + columns : -1,
    ];
  };
  let rim = cells.filter((cell) => beside(cell).some((other) => !own.has(other)));
  for (let level = 1; rim.length; level++) {
    for (const cell of rim) depth.set(cell, level);
    const next = new Set<number>();
    for (const cell of rim) {
      for (const other of beside(cell)) if (own.has(other) && !depth.has(other)) next.add(other);
    }
    rim = [...next];
  }
  return depth;
}

/**
 * The middle of a patch: the deepest of its cells, the nearest their mean of those as deep; how deep that
 * is; and the mean of its deepest cells, in cells across and down, which falls between cells where several
 * are as deep.
 */
function middle(depth: ReadonlyMap<number, number>, { columns }: SightGrid) {
  const deepest = Math.max(...depth.values());
  const core = [...depth].filter(([, level]) => level === deepest).map(([cell]) => cell);
  const column = core.reduce((sum, cell) => sum + (cell % columns), 0) / core.length;
  const row = core.reduce((sum, cell) => sum + Math.floor(cell / columns), 0) / core.length;
  const off = (cell: number) =>
    Math.hypot((cell % columns) - column, Math.floor(cell / columns) - row);
  const cell = core.reduce((best, other) => (off(other) < off(best) ? other : best));
  return { cell, deepest, column, row };
}

/**
 * The cortex, its lobes and the structures the reader sees, named in priority order: the selection first,
 * then the names kept, then by how much of each shows.
 */
export function chooseNames(sources: NameSources): Named[] {
  const { regions, sight, selected, selectedAt, byLobe, bounds } = sources;
  const kept = new Map(sources.kept.map((name) => [name.key, name]));
  const selectable = new Set(sources.drawn.map(({ id }) => id));
  const groupOf = (region: Region) => {
    const lobe = byLobe ? lobeOf(region) : null;
    return lobe
      ? { key: `lobe:${lobe}:${region.hemisphere}`, region: null, lobe }
      : { key: region.id, region: region.id, lobe: null };
  };

  const candidates = new Map<string, Candidate>();
  const claim = (group: Omit<Candidate, 'cells'>, cell: number) => {
    const candidate = candidates.get(group.key) ?? { ...group, cells: [] };
    candidate.cells.push(cell);
    candidates.set(group.key, candidate);
  };
  sight.seen.forEach((seen, cell) => {
    // A surface names only what a click on it would select; a cut face names whatever it cuts.
    if (!seen || (!seen.face && !selectable.has(seen.id))) return;
    const region = regions.get(seen.id);
    if (!region) throw new Error(`Unknown region: ${seen.id}`);
    const group = groupOf(region);
    claim(group, cell);
    // Under Lobes colour the selection is named as itself too.
    if (region.id === selected && group.key !== region.id) {
      claim({ key: region.id, region: region.id, lobe: null }, cell);
    }
  });
  if (selected !== null && selectedAt && !candidates.has(selected)) {
    candidates.set(selected, { key: selected, region: selected, lobe: null, cells: [] });
  }

  const sizeOf = ({ cells }: Candidate) => Math.sqrt(cells.length) * sight.cell;
  const ordered = [...candidates.values()]
    .map((candidate) => ({
      candidate,
      size: sizeOf(candidate),
      kept: kept.has(candidate.key),
    }))
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

  const inside = ({ x, y }: ScreenPoint) =>
    x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height;
  const cellAt = ({ x, y }: ScreenPoint) => {
    const column = Math.round((x - sight.x) / sight.cell);
    const row = Math.round((y - sight.y) / sight.cell);
    return column < 0 || row < 0 || column >= sight.columns || row >= sight.rows
      ? -1
      : row * sight.columns + column;
  };
  // A kept name still in sight stands where it is, unless that is now the rim of a wide patch.
  const held = ordered.map(({ key }) => kept.get(key)?.drawn ?? null);
  const projected = sources.project(held.filter((point) => point !== null));
  let nextProjected = 0;

  const named: Named[] = [];
  const written = new Set<string>();
  ordered.forEach((candidate, index) => {
    const onScreen = held[index] ? projected[nextProjected++]! : null;
    if (named.length === MAX_NAMES) return;
    const words = sources.words(candidate);
    if (written.has(words)) return;
    let found: (ScreenPoint & Pick<Named, 'on' | 'face' | 'drawn'>) | null = null;
    const depth = candidate.cells.length ? depths(candidate.cells, sight) : null;
    const core = depth && middle(depth, sight);
    if (onScreen && inside(onScreen)) {
      const rim =
        core !== null && core.deepest >= RIM_DEPTH && (depth!.get(cellAt(onScreen)) ?? 1) === 1;
      const was = kept.get(candidate.key)!;
      if (!rim) found = { ...onScreen, on: was.on, face: was.face, drawn: held[index]! };
    }
    if (!found && core) {
      // Between cells where several are as deep, if a ray there meets the same name; else on the cell.
      const between = {
        x: sight.x + core.column * sight.cell,
        y: sight.y + core.row * sight.cell,
      };
      const onCell = Number.isInteger(core.column) && Number.isInteger(core.row);
      const [met] = onCell ? [null] : sources.seenAt([between]);
      const same = met && candidate.cells.some((cell) => sight.seen[cell]!.id === met.id);
      const at = same
        ? between
        : {
            x: sight.x + (core.cell % sight.columns) * sight.cell,
            y: sight.y + Math.floor(core.cell / sight.columns) * sight.cell,
          };
      const seen = same ? met : sight.seen[core.cell]!;
      found = { ...at, on: seen.id, face: seen.face, drawn: seen.drawn };
    }
    if (!found && candidate.key === selected && selectedAt) {
      found = {
        x: selectedAt.x,
        y: selectedAt.y,
        on: selectedAt.id,
        face: selectedAt.face,
        drawn: selectedAt.drawn,
      };
    }
    if (!found || !inside(found)) return;
    const { x, y, on, face, drawn } = found;
    if (named.some((other) => Math.hypot(other.point.x - x, other.point.y - y) < DOT_APART_PX)) {
      return;
    }
    written.add(words);
    named.push({
      key: candidate.key,
      region: candidate.region,
      lobe: candidate.lobe,
      on,
      face,
      point: { x, y },
      drawn,
    });
  });
  return named;
}

/**
 * Whether the names are drawn: the switch is on and the stage shows the anatomy where it lies, without
 * a focused ghost, mode paint, tracts, circuit lesson, or visual-field map already directing attention.
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
