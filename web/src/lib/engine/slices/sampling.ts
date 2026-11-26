import { AGREEMENT_COLORS, categoryAt } from '../../core/catalog/segmentation-agreement.ts';
import type { ComparedStructure } from '../../core/catalog/segmentation-agreement.ts';
import { mapColour } from '../../core/user-map/display.ts';
import type { MapDisplay, MapOverlap } from '../../core/user-map/display.ts';
import type { SliceCrop } from '../../types/index.ts';
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
  /** The reader's drawn maps, the one under first, drawn over the scan and the segmentation as the cut faces draw them. */
  maps?: readonly SliceMap[];
  /** A tab's paint, drawn over the scan as its cut faces are: each label of the cut atlas's grid in its colour. */
  paint?: SlicePaint;
  /** The colours the stage's cut faces show, by the same grid, mixed into the grey as the overlay's are. */
  colours?: SlicePaint;
  /**
   * The selection, tinted as the overlay tints and outlined over everything else on the slice, but
   * not over an agreement, which inks the selected structure itself.
   */
  selection?: SliceSelection;
}

/** The cut atlas's labels that are the selected region, and the colour of its outline. */
export interface SliceSelection {
  volume: Volume;
  codes: ReadonlySet<number>;
  colour: Rgb;
}

/** The cut atlas's label grid and, by label code, the paint's colour, or null where it paints nothing. */
export interface SlicePaint {
  volume: Volume;
  colors: readonly (Rgb | null)[];
}

/** One of the reader's maps at a point of this brain (surface RAS mm; NaN for none), and how it is drawn. */
export interface SliceMap {
  /** The map slot it is drawn from. */
  slot: number;
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
  /** Every pixel's alpha, and each painted pixel's colour with the maps drawn over it. */
  fixed: Uint8ClampedArray;
  /** The unpainted pixels any of the reader's maps colours, and how the maps mix there. */
  maps: SliceMaps;
}

/**
 * At each pixel, each of `layers` maps in drawing order, in linear light as the cut faces mix them:
 * `keep` (1 − opacity, or 1 where that map draws nothing) of what lies under it, plus three terms,
 * the map's linear colour · opacity (0 where it draws nothing).
 */
export interface SliceMaps {
  layers: number;
  pixels: Uint32Array;
  keep: Float64Array;
  terms: Float64Array;
}

const toLinear = (value: number) =>
  value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
const toSrgb = (value: number) =>
  value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;
const LINEAR_BYTES = Float64Array.from({ length: 256 }, (_, byte) => toLinear(byte / 255));

/** Mix the maps recorded at `slot` over the pixel at `index` in linear light, and write it back in sRGB bytes. */
function mixMaps(pixels: Uint8ClampedArray, index: number, maps: SliceMaps, slot: number): void {
  const { layers, keep, terms } = maps;
  for (let channel = 0; channel < 3; channel++) {
    let light = LINEAR_BYTES[pixels[index + channel]!]!;
    for (let at = slot * layers; at < (slot + 1) * layers; at++)
      light = light * keep[at]! + terms[at * 3 + channel]!;
    pixels[index + channel] = toSrgb(light) * 255;
  }
}

/**
 * Canvas rows run from superior/anterior to inferior/posterior. With a crop, the pixels outside it are
 * not sampled: they read as transparent and unlabelled, and windowing draws them black or grey.
 */
export function sampleSlice(
  volumes: SliceVolumes,
  frame: Frame,
  display: SliceDisplay,
  crop: SliceCrop = { x: 0, y: 0, width: display.size, height: display.size },
): SliceSamples {
  const { size, fieldOfView, overlay } = display;
  const { agreement, paint, colours, selection, maps = [] } = volumes;
  // The paint and the colours are the cut's labels; the selection may be another grid's.
  const cut = paint?.volume ?? colours?.volume;
  if (paint && colours && paint.volume !== colours.volume)
    throw new Error('The paint and the colours are drawn by one grid of cut labels.');
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
  const tint = Array<Rgb | null>(count).fill(null);
  const painted = new Uint8Array(count);
  const fixed = new Uint8ClampedArray(count * 4);
  const layers = maps.length;
  const mapped: SliceMaps = {
    layers,
    pixels: new Uint32Array(layers ? count : 0),
    keep: new Float64Array(count * layers),
    terms: new Float64Array(count * layers * 3),
  };
  let mappedCount = 0;
  // An outline over an agreement would hide the pixels one segmentation alone labels at its edge.
  const chosen = selection && !agreement ? new Uint8Array(count) : null;
  const step = fieldOfView / size;
  const origin = frame.center
    .clone()
    .addScaledVector(frame.u, -fieldOfView / 2 + step / 2)
    .addScaledVector(frame.v, fieldOfView / 2 - step / 2);
  const point: [number, number, number] = [0, 0, 0];
  const [left, right] = [Math.max(0, crop.x), Math.min(size, crop.x + crop.width)];
  const [top, bottom] = [Math.max(0, crop.y), Math.min(size, crop.y + crop.height)];
  for (let y = top; y < bottom; y++)
    for (let x = left; x < right; x++) {
      point[0] = origin.x + step * (x * frame.u.x - y * frame.v.x);
      point[1] = origin.y + step * (x * frame.u.y - y * frame.v.y);
      point[2] = origin.z + step * (x * frame.u.z - y * frame.v.z);
      const pixel = y * size + x;
      const index = pixel * 4;
      const label = volumes.segmentation.label(point);
      const code = cut ? cut.label(point) : 0;
      intensity[pixel] = volumes.mri.linear(point);
      if (
        chosen &&
        selection!.codes.has(selection!.volume === cut ? code : selection!.volume.label(point))
      )
        chosen[pixel] = 1;
      const category =
        agreement && categoryAt(agreement.structure, label, agreement.compared.label(point));
      tint[pixel] =
        (agreement
          ? category && AGREEMENT_COLORS[category]
          : colours
            ? colours.colors[code]
            : overlay && label
              ? volumes.metadata.labels[label]!.color
              : null) ?? null;
      // The selection is tinted as the overlay tints, over any other tint, and outlined below.
      if (chosen?.[pixel]) tint[pixel] = selection!.colour;
      const colour = paint && paint.colors[code];
      if (colour) {
        painted[pixel] = 1;
        for (let channel = 0; channel < 3; channel++) fixed[index + channel] = colour[channel]!;
      }
      let drawn = false;
      for (const [layer, map] of maps.entries()) {
        const shown = mapColour(
          map.at(...point),
          map.display,
          map.overlap && { colours: map.overlap, painted: Boolean(colour) },
        );
        const at = mappedCount * layers + layer;
        const opacity = shown ? map.display.opacity : 0;
        mapped.keep[at] = 1 - opacity;
        for (let channel = 0; channel < 3; channel++)
          mapped.terms[at * 3 + channel] = shown ? toLinear(shown[channel]!) * opacity : 0;
        drawn ||= Boolean(shown);
      }
      // A painted pixel is mixed now; its slot is then free for the next pixel.
      if (drawn && colour) mixMaps(fixed, index, mapped, mappedCount);
      else if (drawn) mapped.pixels[mappedCount++] = pixel;
      // A structure only NextBrain labels can lie where aseg labels nothing; it is still drawn.
      fixed[index + 3] = label || category || colour ? 255 : 0;
    }
  if (chosen) {
    // Two pixels wide, one either side of the boundary, so it holds where a picture is drawn small.
    for (let y = top; y < bottom; y++)
      for (let x = left; x < right; x++) {
        const pixel = y * size + x;
        const inside = chosen[pixel];
        const edge =
          (x > left && chosen[pixel - 1] !== inside) ||
          (x < right - 1 && chosen[pixel + 1] !== inside) ||
          (y > top && chosen[pixel - size] !== inside) ||
          (y < bottom - 1 && chosen[pixel + size] !== inside);
        if (!edge) continue;
        painted[pixel] = 1;
        fixed.set([...Array.from(selection!.colour), 255], pixel * 4);
      }
    // The maps are drawn under the outline, not over it.
    let kept = 0;
    for (let n = 0; n < mappedCount; n++) {
      if (painted[mapped.pixels[n]!]) continue;
      mapped.pixels[kept] = mapped.pixels[n]!;
      mapped.keep.copyWithin(kept * layers, n * layers, (n + 1) * layers);
      mapped.terms.copyWithin(kept * layers * 3, n * layers * 3, (n + 1) * layers * 3);
      kept++;
    }
    mappedCount = kept;
  }
  return {
    intensity,
    tint,
    painted,
    fixed,
    maps: {
      layers,
      pixels: mapped.pixels.slice(0, mappedCount),
      keep: mapped.keep.slice(0, mappedCount * layers),
      terms: mapped.terms.slice(0, mappedCount * layers * 3),
    },
  };
}

/**
 * A sampled slice's RGBA pixels through an MRI window: the grey, mixed 0.55 to 0.45 with a pixel's
 * tint and rounded to sRGB bytes, then the reader's maps over it at their opacities, in drawing order,
 * in linear light and rounded once, so the pixels are those that sampling through this window draws.
 */
export function windowSlice(
  samples: SliceSamples,
  { windowCenter, windowWidth }: SliceWindow,
): Uint8ClampedArray {
  if (!Number.isFinite(windowCenter) || !Number.isFinite(windowWidth) || windowWidth <= 0) {
    throw new RangeError('Invalid MRI window.');
  }
  const { intensity, tint, painted, maps } = samples;
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
  for (let n = 0; n < maps.pixels.length; n++) mixMaps(pixels, maps.pixels[n]! * 4, maps, n);
  return pixels;
}
