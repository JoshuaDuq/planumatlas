import { UNSTATED, readIn } from '../../lib/core/coordinates/spaces.ts';
import { grouped, percent, withUnit } from '../../lib/core/format.ts';
import { t } from '../../lib/core/i18n/index.ts';
import {
  NEGATIVE_RAMP,
  POSITIVE_RAMP,
  mapNumber,
  mapTitle,
} from '../../lib/core/user-map/display.ts';
import type { MapSummary } from '../../lib/core/user-map/display.ts';
import type { UserMapStore } from '../../lib/state/user-map.svelte.ts';
import type { CoordinateSpaces, Language } from '../../lib/types/index.ts';
import type { CaptionFacts } from '../snapshot/snapshot.ts';
import type { KeySources } from '../stage/stage-keys.ts';

const css = (ramp: readonly (readonly number[])[]) =>
  ramp.map((rgb) => `rgb(${rgb.map((channel) => Math.round(channel * 255)).join(' ')})`);

/** A series volume's place from 1, its count, and its time when the header gives the spacing. */
export function volumeParts(
  { volumes, secondsPerVolume }: Pick<MapSummary, 'volumes' | 'secondsPerVolume'>,
  volume: number,
  lang: Language,
): [place: string, count: string, time: string | null] {
  const time =
    secondsPerVolume === null
      ? null
      : withUnit(mapNumber(volume * secondsPerVolume, lang), 's', lang);
  return [grouped(volume + 1), grouped(volumes), time];
}

/**
 * The map's key: its title (with a series' volume, by its time when the header gives one), and a
 * colour scale for each sign the map has beyond its threshold.
 */
export function mapKey(map: UserMapStore, lang: Language): KeySources['map'] {
  const { state, settings, statistic } = map;
  if (!map.drawn || state.status !== 'ready') return null;
  const { threshold, max } = settings;
  const [low, high] = state.summary.range;
  const copy = t(lang, 'overlay');
  const rows = [];
  if (high > threshold) {
    rows.push({
      id: 'positive',
      ramp: css(POSITIVE_RAMP),
      label: copy.keyRange(statistic, mapNumber(threshold, lang), mapNumber(max, lang)),
    });
  }
  if (low < -threshold) {
    rows.push({
      id: 'negative',
      ramp: css(NEGATIVE_RAMP),
      label: copy.keyRange(statistic, mapNumber(-threshold, lang), mapNumber(-max, lang)),
    });
  }
  if (state.summary.volumes < 2) return { title: map.title, rows };
  const [place, count, time] = volumeParts(state.summary, map.volume, lang);
  return { title: copy.keyVolume(map.title, time ?? `${place}/${count}`), rows };
}

/**
 * What the exported image's caption says of the map: its title, then the file when the title is not
 * the file's, the template it was carried from, the scale, and an opacity below full.
 */
export function mapCaption(
  map: UserMapStore,
  spaces: CoordinateSpaces,
  lang: Language,
): CaptionFacts['overlay'] {
  const { state, settings, statistic } = map;
  if (!map.drawn || state.status !== 'ready') return null;
  const { label } = readIn(spaces, map.space);
  const copy = t(lang, 'overlay');
  const { threshold, max, opacity } = settings;
  return {
    title: map.title,
    details: [
      ...(map.title === mapTitle(state.name) ? [] : [state.name]),
      map.space === UNSTATED ? copy.captionUnstated(label) : copy.captionTemplate(label),
      ...(state.summary.volumes > 1
        ? [copy.captionVolume(...volumeParts(state.summary, map.volume, lang))]
        : []),
      copy.captionScale(statistic, mapNumber(threshold, lang), mapNumber(max, lang)),
      ...(map.minVoxels > 1 ? [copy.captionMinVoxels(String(map.minVoxels))] : []),
      ...(opacity < 1 ? [copy.captionOpacity(percent(opacity, lang))] : []),
      ...(map.surface === 'pial' ? [] : [copy.captionSurface(copy.surfaces[map.surface])]),
    ],
  };
}
