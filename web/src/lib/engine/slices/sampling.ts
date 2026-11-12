import { AGREEMENT_COLORS, categoryAt } from '../../core/catalog/segmentation-agreement.ts';
import type { ComparedStructure } from '../../core/catalog/segmentation-agreement.ts';
import { mapColour } from '../../core/user-map/display.ts';
import type { MapDisplay, MapOverlap } from '../../core/user-map/display.ts';
import type { Frame } from './coordinates.ts';
import type { Volume } from './volume.ts';

type Rgb = ArrayLike<number>;

/** The MRI and segmentation volumes with the segmentation's label records. */
export interface SliceVolumes {
  mri: Volume;
  segmentation: Volume;
  metadata: { labels: Readonly<Record<number, { color: Rgb }>> };
  /** One compared structure's agreement, drawn instead of the segmentation's colours. */
  agreement?: {
    structure: Pick<ComparedStructure, 'code' | 'aseg_label'>;
    /** NextBrain's compared structures on the segmentation's grid. */
    compared: Volume;
  };
  /** The reader's own map, drawn over the scan and the segmentation as the cut faces draw it. */
  map?: SliceMap;
  /** A tab's paint, drawn over the scan as its cut faces are: each label of the cut atlas's grid in its colour. */
  paint?: SlicePaint;
}

/** The cut atlas's label grid and, by label code, the paint's colour, or null where it paints nothing. */
export interface SlicePaint {
  volume: Volume;
  colors: readonly (Rgb | null)[];
}

/** The reader's map at a point of this brain (surface RAS mm; NaN for none), and how it is drawn. */
export interface SliceMap {
  at(x: number, y: number, z: number): number;
  display: MapDisplay;
  /** Drawn against the paint, a function's areas, instead of on its own scale. */
  overlap: MapOverlap | null;
}

export interface SliceDisplay {
  size: number;
  fieldOfView: number;
  windowCenter: number;
  windowWidth: number;
  overlay: boolean;
}

/** Canvas rows run from superior/anterior to inferior/posterior. */
export function renderSlice(
  volumes: SliceVolumes,
  frame: Frame,
  display: SliceDisplay,
): Uint8ClampedArray {
  const { size, fieldOfView, windowCenter, windowWidth, overlay } = display;
  const { agreement } = volumes;
  if (
    !Number.isInteger(size) ||
    size < 2 ||
    size > 2048 ||
    !Number.isFinite(fieldOfView) ||
    fieldOfView <= 0 ||
    !Number.isFinite(windowCenter) ||
    !Number.isFinite(windowWidth) ||
    windowWidth <= 0
  ) {
    throw new RangeError('Invalid slice resolution or MRI window.');
  }
  const pixels = new Uint8ClampedArray(size * size * 4);
  const step = fieldOfView / size;
  const origin = frame.center
    .clone()
    .addScaledVector(frame.u, -fieldOfView / 2 + step / 2)
    .addScaledVector(frame.v, fieldOfView / 2 - step / 2);
  const point: [number, number, number] = [0, 0, 0];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      point[0] = origin.x + step * (x * frame.u.x - y * frame.v.x);
      point[1] = origin.y + step * (x * frame.u.y - y * frame.v.y);
      point[2] = origin.z + step * (x * frame.u.z - y * frame.v.z);
      const label = volumes.segmentation.label(point);
      const gray = Math.max(
        0,
        Math.min(
          255,
          ((volumes.mri.linear(point) - windowCenter + windowWidth / 2) * 255) / windowWidth,
        ),
      );
      const index = (y * size + x) * 4;
      const category =
        agreement && categoryAt(agreement.structure, label, agreement.compared.label(point));
      const color = agreement
        ? category && AGREEMENT_COLORS[category]
        : overlay && label
          ? volumes.metadata.labels[label]!.color
          : null;
      for (let channel = 0; channel < 3; channel++) {
        pixels[index + channel] = color ? gray * 0.55 + color[channel]! * 0.45 : gray;
      }
      const painted = volumes.paint && volumes.paint.colors[volumes.paint.volume.label(point)];
      if (painted)
        for (let channel = 0; channel < 3; channel++) pixels[index + channel] = painted[channel]!;
      const mapped =
        volumes.map &&
        mapColour(
          volumes.map.at(...point),
          volumes.map.display,
          volumes.map.overlap && { colours: volumes.map.overlap, painted: Boolean(painted) },
        );
      if (mapped) {
        const { opacity } = volumes.map!.display;
        for (let channel = 0; channel < 3; channel++) {
          pixels[index + channel] =
            pixels[index + channel]! * (1 - opacity) + mapped[channel]! * 255 * opacity;
        }
      }
      // A structure only NextBrain labels can lie where aseg labels nothing; it is still drawn.
      pixels[index + 3] = label || category || painted ? 255 : 0;
    }
  return pixels;
}
