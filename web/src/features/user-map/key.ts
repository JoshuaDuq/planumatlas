import { UNSTATED, readIn } from '../../lib/core/coordinates/spaces.ts';
import { percent } from '../../lib/core/format.ts';
import { t } from '../../lib/core/i18n/index.ts';
import {
  COLOUR_SCALES,
  mapNumber,
  mapTitle,
  volumeParts,
} from '../../lib/core/user-map/display.ts';
import type { MapLayer, UserMapStore } from '../../lib/state/user-map.svelte.ts';
import type { CoordinateSpaces, Language } from '../../lib/types/index.ts';
import type { CaptionFacts } from '../snapshot/snapshot.ts';
import type { KeySources } from '../stage/stage-keys.ts';

const css = (ramp: readonly (readonly number[])[]) =>
  ramp.map((rgb) => `rgb(${rgb.map((channel) => Math.round(channel * 255)).join(' ')})`);

/**
 * A map's key: its title (with a series' volume, by its time when the header gives one), and a
 * colour scale for each sign the map has beyond its threshold, in the map's colours.
 */
export function mapKey(
  map: MapLayer,
  lang: Language,
): NonNullable<KeySources['maps']>[number] | null {
  const { state, settings, statistic } = map;
  if (!map.drawn || state.status !== 'ready') return null;
  const { threshold, max } = settings;
  const { positive, negative } = COLOUR_SCALES[settings.colours];
  const [low, high] = state.summary.range;
  const copy = t(lang, 'overlay');
  const rows = [];
  if (high > threshold) {
    rows.push({
      id: 'positive',
      ramp: css(positive),
      label: copy.keyRange(statistic, mapNumber(threshold, lang), mapNumber(max, lang)),
    });
  }
  if (low < -threshold) {
    rows.push({
      id: 'negative',
      ramp: css(negative),
      label: copy.keyRange(statistic, mapNumber(-threshold, lang), mapNumber(-max, lang)),
    });
  }
  const { slot } = map;
  if (state.summary.volumes < 2) return { slot, title: map.title, rows };
  const [place, count, time] = volumeParts(state.summary, map.volume, lang);
  return { slot, title: copy.keyVolume(map.title, time ?? `${place}/${count}`), rows };
}

/** The drawn maps' keys, the one on top first. */
export function mapKeys(maps: UserMapStore, lang: Language): KeySources['maps'] {
  return maps.drawnMaps.map((map) => mapKey(map, lang)!);
}

/**
 * What the exported image's caption says of each drawn map, the one on top first: its title, then the
 * file when the title is not the file's, the template it was carried from, the scale, an opacity
 * below full, and what it is drawn over.
 */
export function mapCaptions(
  maps: UserMapStore,
  spaces: CoordinateSpaces,
  lang: Language,
): NonNullable<CaptionFacts['overlays']> {
  const drawn = maps.drawnMaps;
  return drawn.map((map, index) =>
    mapCaption(map, maps, spaces, lang, index === 0 ? drawn[1]?.title : undefined),
  );
}

function mapCaption(
  map: MapLayer,
  maps: Pick<UserMapStore, 'surface'>,
  spaces: CoordinateSpaces,
  lang: Language,
  over: string | undefined,
): NonNullable<CaptionFacts['overlays']>[number] {
  const { state, settings, statistic } = map;
  if (state.status !== 'ready') throw new Error('Only a loaded map has a caption.');
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
      ...(maps.surface === 'pial' ? [] : [copy.captionSurface(copy.surfaces[maps.surface])]),
      ...(over === undefined ? [] : [copy.captionOver(over)]),
    ],
  };
}
