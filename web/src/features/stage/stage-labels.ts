// Where the route landmarks' labels stand: beside the dot on their anchor where that is clear, else stood off
// along a leader, never over another label, another dot or the stage's own chrome.
import type { Rect, ScreenPoint, Size } from '../../lib/engine/api.ts';

/** Where a label stands and at which size. */
export interface Placement {
  box: Rect;
  slot: number;
  /** Index into the label's sizes: the full label first, then shorter ones. */
  variant: number;
  /** Stood off its dot: a leader joins them. */
  leader: boolean;
}

export interface LabelRequest {
  /** The projected anchor, or null behind the camera. */
  point: ScreenPoint | null;
  /** The label's sizes, preferred first. */
  sizes: readonly Size[];
}

/** Above right (where the route's numbers have always stood), right, below right, the left side, then above and below. */
const SIDES = [
  [1, -1],
  [1, 0],
  [1, 1],
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
] as const;
/** How far a label stands off beyond its own side of the dot; the first is beside it, with no leader. */
const STEPS = [0, 16, 32, 52, 76, 104] as const;
/** The dot's own room, which no other label covers. */
const DOT_PX = 8;
/** Clear space kept between two labels, and between a label and a chrome box. */
const GAP_PX = 2;

const SLOTS = SIDES.length * STEPS.length;

/** A label's box in `slot` round `point`: diagonal sides put the dot at the box's near corner, as before. */
function slotBox(point: ScreenPoint, { width, height }: Size, slot: number): Rect {
  const [sx, sy] = SIDES[slot % SIDES.length]!;
  const step = STEPS[Math.floor(slot / SIDES.length)]!;
  const x =
    sx > 0
      ? point.x + (sy ? 4 : 6) + step
      : sx < 0
        ? point.x - (sy ? 4 : 6) - step - width
        : point.x - width / 2;
  // Straight above or below, the box clears the dot; on a diagonal the dot sits at its near corner.
  const reach = sx ? -4 : 6;
  const y =
    sy < 0
      ? point.y - reach - height - step
      : sy > 0
        ? point.y + reach + step
        : point.y - height / 2;
  return { x, y, width, height };
}

const overlap = (a: Rect, b: Rect, gap: number) =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) + gap) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) + gap);

/** A leader crossing a label costs as much as this much overlap: worse than a small overlap, never free. */
const CROSSING_COST = 64;

/** Whether the segment from `a` to `b` passes through `box` (Liang–Barsky clipping). */
function crosses(a: ScreenPoint, b: ScreenPoint, box: Rect): boolean {
  let enter = 0;
  let leave = 1;
  const d = { x: b.x - a.x, y: b.y - a.y };
  for (const [p, q] of [
    [-d.x, a.x - box.x],
    [d.x, box.x + box.width - a.x],
    [-d.y, a.y - box.y],
    [d.y, box.y + box.height - a.y],
  ] as const) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) enter = Math.max(enter, t);
    else leave = Math.min(leave, t);
    if (enter > leave) return false;
  }
  return true;
}

/** The area of `box` outside `bounds`. */
function outside(box: Rect, bounds: Rect): number {
  const inside =
    Math.max(0, Math.min(box.x + box.width, bounds.x + bounds.width) - Math.max(box.x, bounds.x)) *
    Math.max(0, Math.min(box.y + box.height, bounds.y + bounds.height) - Math.max(box.y, bounds.y));
  return box.width * box.height - inside;
}

/**
 * Each label's place, in order: the first clear slot, trying each size in turn, else its last size where
 * it overlaps least. Null for a point behind the camera.
 */
export function placeLabels(
  requests: readonly LabelRequest[],
  bounds: Rect,
  obstacles: readonly Rect[],
): (Placement | null)[] {
  const dots = requests.map(({ point }) =>
    point
      ? { x: point.x - DOT_PX / 2, y: point.y - DOT_PX / 2, width: DOT_PX, height: DOT_PX }
      : null,
  );
  const placed: Rect[] = [];
  // The chrome, then each label as it is placed.
  const blockers = [...obstacles];
  const leaders: [ScreenPoint, ScreenPoint][] = [];
  return requests.map(({ point, sizes }, index) => {
    if (!point) return null;
    // Its own dot sits at the box's near corner or edge, outside it.
    const others = dots.filter((dot, at): dot is Rect => dot !== null && at !== index);
    const cost = (box: Rect, slot: number) => {
      let spent = outside(box, bounds);
      for (const other of blockers) spent += overlap(box, other, GAP_PX);
      for (const dot of others) spent += overlap(box, dot, 0);
      // Neither its leader through another label nor another's leader through it.
      if (slot >= SIDES.length) {
        const end = leaderEnd(point, box);
        for (const other of placed) if (crosses(point, end, other)) spent += CROSSING_COST;
      }
      for (const [a, b] of leaders) if (crosses(a, b, box)) spent += CROSSING_COST;
      return spent;
    };
    let chosen: Placement | null = null;
    for (let variant = 0; variant < sizes.length && !chosen; variant++) {
      for (let slot = 0; slot < SLOTS; slot++) {
        const box = slotBox(point, sizes[variant]!, slot);
        // Under a square pixel: rounding, not a collision.
        if (cost(box, slot) < 1) {
          chosen = { box, slot, variant, leader: slot >= SIDES.length };
          break;
        }
      }
    }
    if (!chosen) {
      const variant = sizes.length - 1;
      let least = Infinity;
      for (let slot = 0; slot < SLOTS; slot++) {
        const box = slotBox(point, sizes[variant]!, slot);
        const spent = cost(box, slot);
        if (spent < least) {
          least = spent;
          chosen = { box, slot, variant, leader: slot >= SIDES.length };
        }
      }
    }
    placed.push(chosen!.box);
    blockers.push(chosen!.box);
    if (chosen!.leader) leaders.push([point, leaderEnd(point, chosen!.box)]);
    return chosen;
  });
}

/** Where a leader from `point` meets `box`: the nearest point of the box's edge. */
export function leaderEnd(point: ScreenPoint, box: Rect): ScreenPoint {
  return {
    x: Math.max(box.x, Math.min(point.x, box.x + box.width)),
    y: Math.max(box.y, Math.min(point.y, box.y + box.height)),
  };
}

/** The stage's own chrome a label must not cover. */
const CHROME = [
  '.stage-dock',
  '.orientation-gizmo',
  '.stage-key',
  '#scale-bar',
  '#orientation > span',
  '.viewport-help',
  '.exit-fullscreen',
].join(', ');

/** The chrome's boxes as drawn now, in the host's pixels. */
function measureChrome(host: HTMLElement): Rect[] {
  const origin = host.getBoundingClientRect();
  return [...host.querySelectorAll<HTMLElement>(CHROME)].flatMap((node) => {
    if (!node.checkVisibility({ visibilityProperty: true, opacityProperty: true })) return [];
    const box = node.getBoundingClientRect();
    if (!box.width || !box.height) return [];
    return [
      { x: box.left - origin.left, y: box.top - origin.top, width: box.width, height: box.height },
    ];
  });
}

/** The chrome's boxes, measured again only after a resize or `stale()`: a camera frame reads no layout. */
export function watchChrome(host: HTMLElement, changed: () => void) {
  let rects: Rect[] | null = null;
  const stale = () => {
    rects = null;
    changed();
  };
  const observer = new ResizeObserver(stale);
  observer.observe(host);
  for (const node of host.querySelectorAll(`${CHROME}, #stage-keys`)) observer.observe(node);
  return {
    rects: () => (rects ??= measureChrome(host)),
    stale,
    dispose: () => observer.disconnect(),
  };
}

/** The visible stage, less a margin, as the bounds labels keep inside. */
export function labelBounds(visible: Rect): Rect {
  const margin = 4;
  return {
    x: visible.x + margin,
    y: visible.y + margin,
    width: Math.max(0, visible.width - 2 * margin),
    height: Math.max(0, visible.height - 2 * margin),
  };
}
