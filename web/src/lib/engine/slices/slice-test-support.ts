// The linked MRI's slices in the tests: the published CDMD volumes read from disk, and the sampling a
// slice was drawn with before it kept its samples, as the reference those samples must still draw byte
// for byte through every window (SLICE-41, SECT-38). Not shipped.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { readRepoJson, repoRoot } from '../../../../test/repo.ts';
import { AGREEMENT_COLORS, categoryAt } from '../../core/catalog/segmentation-agreement.ts';
import { mapColour } from '../../core/user-map/display.ts';
import type { Frame } from './coordinates.ts';
import type { SliceDisplay, SliceVolumes, SliceWindow } from './sampling.ts';
import { Volume } from './volume.ts';
import type { VolumeFile } from './volume.ts';

const DIRECTORY = 'public/models/cdmd';

/** A published CDMD volume, decoded from disk as `loadVolume` decodes it. */
export function publishedVolume(record: VolumeFile): Volume {
  const bytes = gunzipSync(readFileSync(resolve(repoRoot, DIRECTORY, record.file)));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const data = record.dtype === '<u2' ? new Uint16Array(buffer) : new Uint8Array(buffer);
  return new Volume(record, data);
}

/** The published scan and aseg segmentation with its label records, and the display they open at. */
export function publishedSlices() {
  const record = readRepoJson<{
    mri: VolumeFile;
    segmentation: VolumeFile;
    labels: Record<number, { color: number[] }>;
    display: {
      field_of_view_mm: number;
      texture_size: number;
      window_center: number;
      window_width: number;
    };
  }>(`${DIRECTORY}/volumes.json`);
  return {
    volumes: {
      mri: publishedVolume(record.mri),
      segmentation: publishedVolume(record.segmentation),
      metadata: { labels: record.labels },
    },
    display: record.display,
  };
}

const toLinear = (value: number) =>
  value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
const toSrgb = (value: number) =>
  value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;

/**
 * `renderSlice` as the linked MRI drew each plane with on every window change before P13, but for its
 * name, its display's type, and the maps, which it mixed in sRGB bytes: here in linear light, as the
 * cut faces mix them, from the scan's or the paint's bytes, and rounded once.
 */
export function referenceSlice(
  volumes: SliceVolumes,
  frame: Frame,
  display: SliceDisplay & SliceWindow,
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
      const light = [0, 1, 2].map((channel) => toLinear(pixels[index + channel]! / 255));
      let drawn = false;
      for (const map of volumes.maps ?? []) {
        const mapped = mapColour(
          map.at(...point),
          map.display,
          map.overlap && { colours: map.overlap, painted: Boolean(painted) },
        );
        if (!mapped) continue;
        drawn = true;
        const { opacity } = map.display;
        for (let channel = 0; channel < 3; channel++) {
          light[channel] = light[channel]! * (1 - opacity) + toLinear(mapped[channel]!) * opacity;
        }
      }
      if (drawn)
        for (let channel = 0; channel < 3; channel++)
          pixels[index + channel] = toSrgb(light[channel]!) * 255;
      // A structure only NextBrain labels can lie where aseg labels nothing; it is still drawn.
      pixels[index + 3] = label || category || painted ? 255 : 0;
    }
  return pixels;
}
