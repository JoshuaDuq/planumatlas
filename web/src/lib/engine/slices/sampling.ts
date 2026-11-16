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
  overlay: boolean;
}

/** The MRI window a slice's grey is drawn through. */
export interface SliceWindow {
  windowCenter: number;
  windowWidth: number;
}

/**
 * A slice sampled once: each pixel's MRI intensity and all of the pixel that the window does not
 * change, so a new window draws it again without reading a volume (`windowSlice`).
 */
export interface SliceSamples {
  /**
   * The MRI's trilinear intensity at each pixel, as a double: it lies between the 8-bit voxels' values,
   * so neither a 256-entry table of grey levels nor a float would draw the same bytes.
   */
  intensity: Float64Array;
  /** The colour mixed into each pixel's grey: its label's under the overlay, or its agreement's; null for none. */
  tint: (Rgb | null)[];
  /** 1 where a paint covers the pixel: its colour then hides the grey, whatever the window. */
  painted: Uint8Array;
  /** Every pixel's alpha, and each painted pixel's colour with the map drawn over it. */
  fixed: Uint8ClampedArray;
  /**
   * The reader's map over the unpainted pixels it colours: their indices, and three terms per pixel,
   * `colour · 255 · opacity`, added to `keep` (1 − opacity) of what the window draws there.
   */
  map: { pixels: Uint32Array; terms: Float64Array; keep: number } | null;
}

/** Canvas rows run from superior/anterior to inferior/posterior. */
export function sampleSlice(
  volumes: SliceVolumes,
  frame: Frame,
  display: SliceDisplay,
): SliceSamples {
  const { size, fieldOfView, overlay } = display;
  const { agreement, paint, map } = volumes;
  if (
    !Number.isInteger(size) ||
    size < 2 ||
    size > 2048 ||
    !Number.isFinite(fieldOfView) ||
    fieldOfView <= 0
  ) {
    throw new RangeError('Invalid slice resolution.');
  }
  const count = size * size;
  const intensity = new Float64Array(count);
  // Filled in pixel order, so it holds no holes.
  const tint: (Rgb | null)[] = [];
  const painted = new Uint8Array(count);
  const fixed = new Uint8ClampedArray(count * 4);
  const mapped = map && { pixels: new Uint32Array(count), terms: new Float64Array(count * 3) };
  let mappedCount = 0;
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
      const pixel = y * size + x;
      const index = pixel * 4;
      const label = volumes.segmentation.label(point);
      intensity[pixel] = volumes.mri.linear(point);
      const category =
        agreement && categoryAt(agreement.structure, label, agreement.compared.label(point));
      tint.push(
        (agreement
          ? category && AGREEMENT_COLORS[category]
          : overlay && label
            ? volumes.metadata.labels[label]!.color
            : null) ?? null,
      );
      const colour = paint && paint.colors[paint.volume.label(point)];
      if (colour) {
        painted[pixel] = 1;
        for (let channel = 0; channel < 3; channel++) fixed[index + channel] = colour[channel]!;
      }
      const shown =
        map &&
        mapColour(
          map.at(...point),
          map.display,
          map.overlap && { colours: map.overlap, painted: Boolean(colour) },
        );
      if (shown) {
        const { opacity } = map!.display;
        if (colour) {
          for (let channel = 0; channel < 3; channel++)
            fixed[index + channel] =
              fixed[index + channel]! * (1 - opacity) + shown[channel]! * 255 * opacity;
        } else {
          mapped!.pixels[mappedCount] = pixel;
          for (let channel = 0; channel < 3; channel++)
            mapped!.terms[mappedCount * 3 + channel] = shown[channel]! * 255 * opacity;
          mappedCount++;
        }
      }
      // A structure only NextBrain labels can lie where aseg labels nothing; it is still drawn.
      fixed[index + 3] = label || category || colour ? 255 : 0;
    }
  return {
    intensity,
    tint,
    painted,
    fixed,
    map: mapped
      ? {
          pixels: mapped.pixels.slice(0, mappedCount),
          terms: mapped.terms.slice(0, mappedCount * 3),
          keep: 1 - map!.display.opacity,
        }
      : null,
  };
}

/**
 * A sampled slice's RGBA pixels through an MRI window: the grey, mixed 0.55 to 0.45 with a pixel's
 * tint, then the reader's map over it at its opacity. Each step rounds as the canvas's bytes do, so the
 * pixels are those that sampling through this window draws.
 */
export function windowSlice(
  samples: SliceSamples,
  { windowCenter, windowWidth }: SliceWindow,
): Uint8ClampedArray {
  if (!Number.isFinite(windowCenter) || !Number.isFinite(windowWidth) || windowWidth <= 0) {
    throw new RangeError('Invalid MRI window.');
  }
  const { intensity, tint, painted, map } = samples;
  const pixels = samples.fixed.slice();
  for (let pixel = 0; pixel < intensity.length; pixel++) {
    if (painted[pixel]) continue;
    const gray = Math.max(
      0,
      Math.min(255, ((intensity[pixel]! - windowCenter + windowWidth / 2) * 255) / windowWidth),
    );
    const color = tint[pixel];
    const index = pixel * 4;
    for (let channel = 0; channel < 3; channel++) {
      pixels[index + channel] = color ? gray * 0.55 + color[channel]! * 0.45 : gray;
    }
  }
  if (map)
    for (let n = 0; n < map.pixels.length; n++) {
      const index = map.pixels[n]! * 4;
      for (let channel = 0; channel < 3; channel++) {
        pixels[index + channel] = pixels[index + channel]! * map.keep + map.terms[n * 3 + channel]!;
      }
    }
  return pixels;
}
