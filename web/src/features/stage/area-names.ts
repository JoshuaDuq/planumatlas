// The visual areas' names on the map's stage: an area is named once on each hemisphere, centred on its
// anchor (`placeCentred`) in the engine's order, larger areas first, so a crowded stage keeps the larger
// areas' names and zooming in brings the smaller ones back.
import type { NamedVisualArea, Rect, Size, VisualAreaName } from '../../lib/types/index.ts';
import { placeCentred } from './stage-labels.ts';

/** A drawn name's key: its hemisphere and its area. */
export const areaNameKey = ({ hemisphere, name }: NamedVisualArea) => `${hemisphere}:${name}`;

/** The box of each name that stands, by its key; a name with no measured size is an error. */
export function areaNameBoxes(
  names: readonly VisualAreaName[],
  sizes: ReadonlyMap<string, Size>,
  bounds: Rect,
  obstacles: readonly Rect[],
): Map<string, Rect> {
  const boxes = placeCentred(
    names.map((entry) => {
      const size = sizes.get(areaNameKey(entry));
      if (!size) throw new Error(`No name is drawn for the ${entry.hemisphere} ${entry.name}.`);
      return { point: entry.point, size };
    }),
    bounds,
    obstacles,
  );
  return new Map(
    names.flatMap((entry, index) => {
      const box = boxes[index];
      return box ? [[areaNameKey(entry), box] as const] : [];
    }),
  );
}
