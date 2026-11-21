// Names in columns beside the anatomy, as an atlas plate labels its figure: each name level with its dot
// where it can be, wrapped to its column's width, pushed apart where names crowd, kept in the order of their
// dots down the column so the leaders do not cross, and clear of the stage's chrome.
import type { Rect, ScreenPoint, Size } from '../../lib/engine/api.ts';
import { calloutEnd } from './stage-labels.ts';
import type { Side } from './stage-labels.ts';

export interface ColumnRequest {
  /** The projected dot, or null where it has none. */
  point: ScreenPoint | null;
  /** Its size wrapped to lines no wider than `width`; wider only where one word is. */
  size(width: number): Size;
  /** The column it stood in last, kept while its dot is not well past the anatomy's middle. */
  side?: Side;
  /** Named in a column however far its leader runs across the anatomy: the selection. */
  always?: boolean;
}

/** A name's words as drawn: each word's width, a space's, and a line's height, in CSS px. */
export interface Words {
  widths: readonly number[];
  space: number;
  line: number;
}

/** The widest line and the count of lines when `words` wrap at `width`, broken at spaces as the browser breaks them. */
export function wrap({ widths, space }: Words, width: number): { width: number; lines: number } {
  let [widest, current, lines] = [0, widths[0] ?? 0, 1];
  for (const word of widths.slice(1)) {
    if (current + space + word <= width) {
      current += space + word;
      continue;
    }
    widest = Math.max(widest, current);
    current = word;
    lines += 1;
  }
  return { width: Math.max(widest, current), lines };
}

export interface ColumnPlacement {
  box: Rect;
  side: Side;
}

/** Clear space between the anatomy and a column's near edge. */
export const ANATOMY_GAP_PX = 16;
/**
 * A column opens once it has this much room, and stays open until it has less than `KEEP_COLUMN_PX`: a turn
 * at the edge of the room does not move the names back and forth.
 */
export const OPEN_COLUMN_PX = 112;
export const KEEP_COLUMN_PX = 80;
/** Clear space between two names in a column, and between a name and a chrome box. */
const ROW_GAP_PX = 2;
/**
 * A strip narrower than this between chrome and the stage's top or bottom edge is that chrome's gutter, not
 * room for a name: a name under the scale bar or over the gizmo stands outside the picture.
 */
const EDGE_STRIP_PX = 48;
/** What a leader's run across the anatomy costs a name, per pixel, against a pixel it is pushed off its dot's level. */
const ACROSS_COST = 0.5;
/** What a name pays to change column: a small gain does not move it while the camera moves. */
const SWITCH_COST_PX = 24;
/** What a name left out costs, times its rank from the end: more than any place, and more the higher its priority. */
const LEFT_OUT_COST = 10_000;
/** Rounds of moving single names to the other column while that lowers the cost. */
const ROUNDS = 3;
/** A leader passing nearer another name's dot than this reads as pointing at it. */
const DOT_CLEAR_PX = 9;
/** What two leaders that cross, or one over another name's dot, cost the plate. */
const CONFLICT_COST_PX = 48;
/**
 * The farthest a leader runs across, as a share of the anatomy's width: with only the far side's column
 * open, a name past it is left out rather than drawn across the whole anatomy.
 */
const MAX_ACROSS = 0.6;

interface Column {
  side: Side;
  /** The edge against the anatomy, and the room from it to the stage's edge. */
  near: number;
  width: number;
}

const overlaps = (low: number, high: number, from: number, to: number) => low < to && high > from;

/** A name's box in its column at `top`: against the column's near edge, so names align on the anatomy's side. */
function boxIn({ side, near }: Column, { width, height }: Size, top: number): Rect {
  return { x: side === 'left' ? near - width : near, y: top, width, height };
}

/**
 * The spans down the stage a column leaves free for names as wide as `reach`: the stage less each chrome
 * box that reaches into it so far from the anatomy, and less the gutter strip between such a box and the
 * stage's top or bottom edge (`EDGE_STRIP_PX`).
 */
function freeSpans(
  column: Column,
  reach: number,
  bounds: Rect,
  obstacles: readonly Rect[],
): [number, number][] {
  const [x0, x1] =
    column.side === 'left'
      ? [column.near - reach, column.near]
      : [column.near, column.near + reach];
  const blocked = obstacles
    .filter((box) => overlaps(box.x, box.x + box.width, x0, x1))
    .map((box) => [box.y - ROW_GAP_PX, box.y + box.height + ROW_GAP_PX] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const spans: [number, number][] = [];
  let from = bounds.y;
  for (const [low, high] of blocked) {
    if (low > from) spans.push([from, Math.min(low, bounds.y + bounds.height)]);
    from = Math.max(from, high);
  }
  const bottom = bounds.y + bounds.height;
  if (from < bottom) spans.push([from, bottom]);
  return spans.filter(([low, high]) => {
    const edges = Number(low === bounds.y) + Number(high === bottom);
    return high > low && (edges !== 1 || high - low >= EDGE_STRIP_PX);
  });
}

/**
 * Tops for names in one span, in the order of their dots: each as near level with its dot as the names
 * above and below it allow. Crowded names are merged into blocks centred on their dots' mean, each block
 * held inside the span.
 */
function pack(
  rows: readonly { want: number; height: number }[],
  [low, high]: [number, number],
): number[] {
  const blocks: { first: number; last: number; top: number; height: number; offsets: number[] }[] =
    [];
  rows.forEach(({ want, height }, index) => {
    let block = { first: index, last: index, top: want, height, offsets: [0] };
    for (;;) {
      block.top = Math.min(Math.max(block.top, low), high - block.height);
      const above = blocks.at(-1);
      if (!above || above.top + above.height + ROW_GAP_PX <= block.top) break;
      // Merged, the block's top is the mean of where each of its names would stand.
      const offsets = [
        ...above.offsets,
        ...block.offsets.map((offset) => offset + above.height + ROW_GAP_PX),
      ];
      const wanted = rows.slice(above.first, block.last + 1).map(({ want }) => want);
      blocks.pop();
      block = {
        first: above.first,
        last: block.last,
        top: wanted.reduce((sum, want, at) => sum + want - offsets[at]!, 0) / wanted.length,
        height: above.height + ROW_GAP_PX + block.height,
        offsets,
      };
    }
    blocks.push(block);
  });
  return blocks.flatMap(({ top, offsets }) => offsets.map((offset) => top + offset));
}

/**
 * Each name's place in a column beside the anatomy, wrapped to the column's width, requests in priority
 * order; null where it has no dot, fits neither column, or its column is full. A name starts in the column
 * it stood in last, else on its dot's side, and moves to the other while that lowers the plate's cost: how
 * far each name is pushed off its dot's level, half how far its leader runs across, a toll to switch, and
 * each two leaders in conflict (`conflict`); while the stage `moving`, a name changes column only where its
 * own no longer holds it, so none crosses the anatomy mid-turn. `open` are the columns open last time, with
 * the columns open now returned beside the places. Null where neither side of the anatomy has room for a
 * column: the names then stand beside their dots.
 */
export function placeColumns(
  requests: readonly ColumnRequest[],
  anatomy: Rect,
  bounds: Rect,
  obstacles: readonly Rect[],
  open: readonly Side[] = [],
  moving = false,
): { placed: (ColumnPlacement | null)[]; open: Side[] } | null {
  const left: Column = {
    side: 'left',
    near: anatomy.x - ANATOMY_GAP_PX,
    width: anatomy.x - ANATOMY_GAP_PX - bounds.x,
  };
  const right: Column = {
    side: 'right',
    near: anatomy.x + anatomy.width + ANATOMY_GAP_PX,
    width: bounds.x + bounds.width - (anatomy.x + anatomy.width + ANATOMY_GAP_PX),
  };
  const columns = [left, right].filter(
    ({ side, width }) => width >= (open.includes(side) ? KEEP_COLUMN_PX : OPEN_COLUMN_PX),
  );
  if (!columns.length) return null;
  const middle = anatomy.x + anatomy.width / 2;
  // Each name's size in each column it fits and its leader reaches.
  const reach = anatomy.width * MAX_ACROSS;
  const fits = requests.map(({ point, size, always }) =>
    point
      ? new Map(
          columns.flatMap((column) => {
            const fitted = size(column.width);
            const across = Math.abs(column.near - point.x);
            return fitted.width <= column.width && (always || across <= reach)
              ? [[column, fitted] as const]
              : [];
          }),
        )
      : new Map<Column, Size>(),
  );
  let chosen = requests.map(({ point, side }, index): Column | null => {
    if (!point) return null;
    const first = side ?? (point.x < middle ? 'left' : 'right');
    const order = [...fits[index]!.keys()].sort(
      (a, b) => Number(b.side === first) - Number(a.side === first),
    );
    return order[0] ?? null;
  });
  let best = layout(chosen);
  for (let round = 0; round < (moving ? 0 : ROUNDS); round++) {
    let moved = false;
    chosen.forEach((column, index) => {
      const other = column && columns.find((candidate) => candidate !== column);
      if (!other || !fits[index]!.has(other)) return;
      const trial = chosen.map((entry, at) => (at === index ? other : entry));
      const tried = layout(trial);
      if (tried.cost >= best.cost - 1) return;
      [chosen, best, moved] = [trial, tried, true];
    });
    if (!moved) break;
  }
  return { placed: best.placed, open: columns.map(({ side }) => side) };

  function layout(assignment: readonly (Column | null)[]) {
    const placed: (ColumnPlacement | null)[] = requests.map(() => null);
    for (const column of columns) {
      const rows = assignment
        .flatMap((entry, index) =>
          entry === column
            ? [{ index, size: fits[index]!.get(column)!, point: requests[index]!.point! }]
            : [],
        )
        .sort((a, b) => a.point.y - b.point.y);
      const reach = Math.max(0, ...rows.map(({ size }) => size.width));
      const spans = freeSpans(column, reach, bounds, obstacles);
      spread(rows, spans).forEach((group, at) => {
        const tops = untangle(group, spans[at]!, column);
        group.forEach(({ index, size }, row) => {
          placed[index] = { box: boxIn(column, size, tops[row]!), side: column.side };
        });
      });
    }
    let cost = 0;
    const leaders: Leader[] = [];
    requests.forEach(({ point, side }, index) => {
      const entry = placed[index];
      if (!point || !assignment[index]) return;
      if (!entry) {
        cost += LEFT_OUT_COST * (requests.length - index);
        return;
      }
      const end = calloutEnd(entry.box, entry.side);
      leaders.push({ dot: point, end });
      cost +=
        Math.abs(end.y - point.y) +
        ACROSS_COST * Math.abs(end.x - point.x) +
        (side && side !== entry.side ? SWITCH_COST_PX : 0);
    });
    return { placed, cost: cost + CONFLICT_COST_PX * conflicts(leaders) };
  }
}

interface Row {
  /** The request's index: its priority, the lower the higher. */
  index: number;
  size: Size;
  point: ScreenPoint;
}

/**
 * A column's names, in their dots' order, shared among the spans its chrome leaves free so the order holds
 * down the whole column: each to the span nearest its dot, an overfull span's last names to the next and its
 * first to the one before, and the lowest-priority names out of a span still overfull.
 */
function spread(rows: readonly Row[], spans: readonly [number, number][]): Row[][] {
  const groups: Row[][] = spans.map(() => []);
  if (!spans.length) return groups;
  for (const row of rows) {
    const away = spans.map(([low, high]) => Math.max(0, low - row.point.y, row.point.y - high));
    groups[away.indexOf(Math.min(...away))]!.push(row);
  }
  const load = (group: Row[]) =>
    group.reduce((sum, { size }) => sum + size.height + ROW_GAP_PX, -ROW_GAP_PX);
  const room = (at: number) => spans[at]![1] - spans[at]![0];
  for (let at = 0; at < groups.length - 1; at++) {
    while (groups[at]!.length && load(groups[at]!) > room(at)) {
      groups[at + 1]!.unshift(groups[at]!.pop()!);
    }
  }
  for (let at = groups.length - 1; at > 0; at--) {
    while (groups[at]!.length && load(groups[at]!) > room(at)) {
      groups[at - 1]!.push(groups[at]!.shift()!);
    }
  }
  groups.forEach((group, at) => {
    while (group.length && load(group) > room(at)) {
      const lowest = Math.max(...group.map(({ index }) => index));
      group.splice(
        group.findIndex(({ index }) => index === lowest),
        1,
      );
    }
  });
  return groups;
}

/** Which side of the line through `a` and `b` a point is on: 1, -1, or 0 on it. */
const turn = (a: ScreenPoint, b: ScreenPoint, c: ScreenPoint) =>
  Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));

/** How far `p` is from the segment `a`–`b`. */
function away(p: ScreenPoint, a: ScreenPoint, b: ScreenPoint): number {
  const [dx, dy] = [b.x - a.x, b.y - a.y];
  const along = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)),
  );
  return Math.hypot(p.x - a.x - along * dx, p.y - a.y - along * dy);
}

interface Leader {
  dot: ScreenPoint;
  end: ScreenPoint;
}

/** Two leaders that cross, or one that passes over the other's dot. */
function conflict(a: Leader, b: Leader): boolean {
  const crossed =
    turn(a.dot, a.end, b.dot) * turn(a.dot, a.end, b.end) < 0 &&
    turn(b.dot, b.end, a.dot) * turn(b.dot, b.end, a.end) < 0;
  return (
    crossed || away(b.dot, a.dot, a.end) < DOT_CLEAR_PX || away(a.dot, b.dot, b.end) < DOT_CLEAR_PX
  );
}

/** How many pairs of leaders are in conflict. */
function conflicts(leaders: readonly Leader[]): number {
  let count = 0;
  for (let i = 0; i < leaders.length; i++) {
    for (let j = i + 1; j < leaders.length; j++) if (conflict(leaders[i]!, leaders[j]!)) count += 1;
  }
  return count;
}

/**
 * The tops of one span's names, packed in their dots' order, then two neighbours swapped wherever that
 * leaves fewer leaders in conflict: dots at different depths across the anatomy can cross, or pass over each
 * other, where their names stand in order. The order changes in place.
 */
function untangle(group: Row[], span: [number, number], column: Column): number[] {
  const tops = () =>
    pack(
      group.map(({ point, size }) => ({ want: point.y - size.height / 2, height: size.height })),
      span,
    );
  const tangle = (at: number[]) =>
    conflicts(
      group.map(({ point, size }, row) => ({
        dot: point,
        end: calloutEnd(boxIn(column, size, at[row]!), column.side),
      })),
    );
  let at = tops();
  let tangled = tangle(at);
  for (let pass = 0; pass < group.length && tangled; pass++) {
    let improved = false;
    for (let row = 0; row + 1 < group.length && tangled; row++) {
      [group[row], group[row + 1]] = [group[row + 1]!, group[row]!];
      const tried = tops();
      const left = tangle(tried);
      if (left < tangled) {
        [at, tangled, improved] = [tried, left, true];
        continue;
      }
      [group[row], group[row + 1]] = [group[row + 1]!, group[row]!];
    }
    if (!improved) break;
  }
  return at;
}
