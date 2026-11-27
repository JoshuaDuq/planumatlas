// What the stage's colour keys say and how they fit the stage (viewport-chrome.js:23-42, 269-402).
import { SULC_RAMP } from '../../lib/core/catalog/sulcal-depth.ts';
import { THICKNESS_RAMP } from '../../lib/core/catalog/thickness-ramp.ts';
import { cabNpName, networkCss, networkName } from '../../lib/core/catalog/networks.ts';
import { decimal, withUnit } from '../../lib/core/format.ts';
import { atlasSwitchLabel, t } from '../../lib/core/i18n/index.ts';
import type { Legend } from '../../lib/core/state/paint.ts';
import { modelUsable } from '../../lib/core/state/session.ts';
import type {
  ArterialTerritory,
  CerebellarFunctionRegion,
  Language,
  LoadStatus,
  ModelState,
  Rgb,
  SurfaceColor,
} from '../../lib/types/index.ts';

/** A key longer than this many rows starts folded where the stage is crowded. */
const KEY_FOLD_ROWS = 8;
const KEY_FOLD_WIDTH_PX = 1000;
/** Stage room to keep for the anatomy before expanding a phone's legend. */
const PHONE_ANATOMY_ROOM_PX = 240;
const KEY_ROW_PX = 24;
const TOUCH_ROW_PX = 44;
/** Narrower than this, a paint key keeps its rows and drops its note. */
export const KEY_NOTE_MIN_WIDTH_PX = 600;
/** The title row, foot and edges of a plate. */
const KEY_HEAD_PX = 42;
/** The space between stacked plates (`--space-2`). */
export const KEY_GAP_PX = 8;

export type KeyName = 'map' | 'map-2' | 'network' | 'paint' | 'borders' | 'cases' | 'direction';

export interface KeyRow {
  id: string;
  /** A swatch colour: channels, or a CSS colour for the direction key. */
  color: Rgb | string;
  label: string;
  pressed: boolean;
  /** Keyed but not drawn in this view. */
  absent: boolean;
  /** A colour scale instead of one colour: CSS colours from its start to its end. */
  ramp?: readonly string[];
  /** The line another atlas's borders are drawn with instead of a colour (`BORDER_LINE`). */
  line?: boolean;
}

/** One plate of the stage key, in the order the plates are drawn. */
export interface KeyPlate {
  name: KeyName;
  /** What the reader's fold is remembered under. */
  map: string;
  title: string;
  rows: KeyRow[];
  /** The sentence under its rows: the paint key's, or where a volumetric map is drawn; empty for the others. */
  note: string;
  /** Each row is a toggle that shows that row alone. */
  pickable: boolean;
  /** A command under the rows that opens a figure of the map's own (Yeo's networks: their matrix). */
  action?: { id: 'network-matrix'; label: string };
}

/** A partition with named colours: Yeo's networks and CAB-NP. */
export interface ColoredNetworks {
  networks: readonly string[];
  colors: Readonly<Record<string, Rgb>>;
}

export interface KeySources {
  lang: Language;
  status: LoadStatus;
  surfaceColor: SurfaceColor;
  networks: ColoredNetworks | null;
  cabNp: ColoredNetworks | null;
  /** The arterial territories' palette, in the atlas's order, when the build publishes them. */
  territories?: readonly ArterialTerritory[] | null;
  /** The cerebellar functional regions, in the atlas's order, when the build publishes them. */
  cerebellar?: readonly CerebellarFunctionRegion[] | null;
  /** The thickness key's ends in mm, when the build publishes this brain's cortical thickness. */
  thickness?: readonly [number, number] | null;
  /** The build publishes the network matrix (`manifest.network_matrix`). */
  networkMatrix?: boolean;
  /** The sulcal depth key's half-width in mm, centred on 0, when the cortex carries the depth's span. */
  sulc?: number | null;
  /** The lobes of the atlas on screen, in key order (`lobeRows`); empty for an atlas grouped otherwise. */
  lobes?: readonly { id: string; color: Rgb; label: string }[] | null;
  /** The key of the paint on show (`legendFor`), or null. */
  legend: Legend | null;
  /** The atlas whose borders are drawn over the cortex, or null. */
  borders?: string | null;
  /** The stroke cases on the stage: each one's colour and name, and the shared colour for two. */
  cases?: { title: string; rows: { id: string; color: Rgb | string; label: string }[] } | null;
  /** The streamlines are drawn, coloured by direction. */
  directionShown: boolean;
  /** The reader's own maps on the stage, the one on top first: each one's slot, name, and each sign's colour scale and range. */
  maps?: {
    slot: number;
    title: string;
    rows: { id: string; ramp: readonly string[]; label: string }[];
  }[];
}

const row = (id: string, color: Rgb | string, label: string, pressed = false, absent = false) => ({
  id,
  color,
  label,
  pressed,
  absent,
});

/** The line's sRGB inks, as the cortex draws it facing the light (`BORDER_LINE`, linear). */
export const BORDER_INK = { core: '#f2f2f2', casing: '#1b1b1b' };

/** The swatch's CSS colour. */
export const swatchColor = (color: Rgb | string) =>
  typeof color === 'string' ? color : networkCss(color);

/**
 * The surface colour the key explains: none while a ghost keeps no region in it, as the held tracts
 * do with nothing selected; the selection and a route's regions keep it.
 */
export const keyedSurface = (
  state: Pick<ModelState, 'surfaceColor' | 'ghostedAround' | 'selectedRegion'>,
): SurfaceColor =>
  state.ghostedAround?.size === 0 && !state.selectedRegion ? 'tissue' : state.surfaceColor;

/**
 * The plates the stage shows now, in drawing order. A paint covers the masthead's colour, so that
 * colour's plate would explain nothing on screen and is left out while a paint's key is up.
 */
export function keyPlates(sources: KeySources): KeyPlate[] {
  const { lang, surfaceColor, legend } = sources;
  const ready = modelUsable(sources.status);
  const plates: KeyPlate[] = [];
  for (const map of ready ? (sources.maps ?? []) : []) {
    plates.push({
      // One plate per slot, each folded on its own.
      name: map.slot === 0 ? 'map' : 'map-2',
      map: map.slot === 0 ? 'user-map' : 'user-map-2',
      title: map.title,
      rows: map.rows.map((entry) => ({
        ...row(entry.id, entry.ramp[0]!, entry.label),
        ramp: entry.ramp,
      })),
      note: '',
      pickable: false,
    });
  }
  // A key is titled as the masthead's Colour field names its map.
  const maps: Record<string, string> = t(lang, 'display').surfaceColors;

  // A volumetric map colours only the cut: the structures it reaches keep their tissue whole.
  const onCuts = t(lang, 'display').mapOnCuts;
  const partition =
    ready && !legend
      ? surfaceColor === 'network' || surfaceColor === 'striatal'
        ? sources.networks
        : surfaceColor === 'cab-np'
          ? sources.cabNp
          : null
      : null;
  if (partition) {
    const name = surfaceColor === 'cab-np' ? cabNpName : networkName;
    plates.push({
      name: 'network',
      map: surfaceColor,
      title: maps[surfaceColor]!,
      rows: partition.networks.map((key) => row(key, partition.colors[key]!, name(key, lang))),
      note: surfaceColor === 'striatal' ? onCuts : '',
      pickable: false,
      ...(surfaceColor === 'network' &&
        sources.networkMatrix && {
          action: { id: 'network-matrix' as const, label: t(lang, 'display').networkMatrix },
        }),
    });
  }

  if (ready && !legend && surfaceColor === 'cerebellar' && sources.cerebellar) {
    plates.push({
      name: 'network',
      map: surfaceColor,
      title: maps[surfaceColor]!,
      rows: sources.cerebellar.map((region) =>
        row(region.id, region.color, lang === 'fr' ? region.name_fr : region.name),
      ),
      note: t(lang, 'display').mapOnCerebellum,
      pickable: false,
    });
  }

  if (ready && !legend && surfaceColor === 'thickness' && sources.thickness) {
    const [low, high] = sources.thickness;
    const words = t(lang, 'display');
    plates.push({
      name: 'network',
      map: surfaceColor,
      title: maps[surfaceColor]!,
      rows: [
        {
          ...row(
            'thickness',
            THICKNESS_RAMP[0]!,
            words.keyRange(decimal(low, 1, lang), withUnit(decimal(high, 1, lang), 'mm', lang)),
          ),
          ramp: THICKNESS_RAMP.map(networkCss),
        },
      ],
      note: words.thicknessNote,
      pickable: false,
    });
  }

  if (ready && !legend && surfaceColor === 'sulc' && sources.sulc) {
    const words = t(lang, 'display');
    plates.push({
      name: 'network',
      map: surfaceColor,
      title: maps[surfaceColor]!,
      rows: [
        {
          ...row(
            'sulc',
            SULC_RAMP[0]!,
            words.keyRange(
              decimal(-sources.sulc, 0, lang),
              withUnit(decimal(sources.sulc, 0, lang, { signed: true }), 'mm', lang),
            ),
          ),
          ramp: SULC_RAMP.map(networkCss),
        },
      ],
      note: words.sulcNote,
      pickable: false,
    });
  }

  if (ready && !legend && surfaceColor === 'territory' && sources.territories) {
    plates.push({
      name: 'network',
      map: surfaceColor,
      title: maps[surfaceColor]!,
      rows: sources.territories.map((territory) =>
        row(territory.id, territory.color, lang === 'fr' ? territory.name_fr : territory.name),
      ),
      note: '',
      pickable: false,
    });
  }

  if (ready && !legend && surfaceColor === 'lobe' && sources.lobes?.length) {
    plates.push({
      name: 'network',
      map: surfaceColor,
      title: maps[surfaceColor]!,
      rows: sources.lobes.map((lobe) => row(lobe.id, lobe.color, lobe.label)),
      note: '',
      pickable: false,
    });
  }

  if (ready && legend) {
    plates.push({
      name: 'paint',
      map: legend.map,
      title: legend.title,
      rows: legend.rows.map((entry) =>
        row(entry.id, entry.color, entry.label, entry.pressed, entry.absent),
      ),
      note: legend.note,
      pickable: legend.pickable !== false && legend.rows.length > 1,
    });
  }

  if (ready && sources.borders) {
    const words = t(lang, 'display');
    plates.push({
      name: 'borders',
      map: 'borders',
      title: words.bordersKey(atlasSwitchLabel(sources.borders, lang)),
      rows: [{ ...row('line', BORDER_INK.core, words.bordersLine), line: true }],
      note: '',
      pickable: false,
    });
  }

  if (ready && sources.cases) {
    plates.push({
      name: 'cases',
      map: 'cases',
      title: sources.cases.title,
      rows: sources.cases.rows.map((entry) => row(entry.id, entry.color, entry.label)),
      note: '',
      pickable: false,
    });
  }

  if (ready && sources.directionShown) {
    const copy = t(lang, 'viewport').directionKey;
    plates.push({
      name: 'direction',
      map: 'direction',
      title: copy.title,
      rows: [
        row('lr', 'var(--scene-direction-lr)', copy.leftRight),
        row('ap', 'var(--scene-direction-ap)', copy.anteriorPosterior),
        row('si', 'var(--scene-direction-si)', copy.superiorInferior),
      ],
      note: '',
      pickable: false,
    });
  }
  return plates;
}

/**
 * The saved image's caption line for the reader's highlights: the key's title, that they are the
 * reader's marks, then the regions the image draws, named as the key names them. Null without that key.
 */
export function highlightCaption(
  plates: readonly KeyPlate[],
  lang: Language,
): { title: string; details: string[] } | null {
  const plate = plates.find((entry) => entry.map === 'highlight');
  if (!plate) return null;
  return {
    title: plate.title,
    details: [
      t(lang, 'display').highlightKey.marks,
      ...plate.rows.filter((entry) => !entry.absent).map((entry) => entry.label),
    ],
  };
}

/** What `defaultOpen` weighs: the stage's visible rectangle, its gutter and the dock's height. */
export interface StageRoom {
  width: number;
  height: number;
  gutter: number;
  dockHeight: number;
}

type SizedPlate = Pick<KeyPlate, 'name' | 'map' | 'pickable'> & { count: number };
type KeyDevice = { phone: boolean; coarse: boolean };

/** The height a plate takes, open or folded to its title. */
export function keyHeight(plate: SizedPlate, { phone, coarse }: KeyDevice, open: boolean): number {
  if (!open) return KEY_HEAD_PX;
  // A finding is a sentence and a highlighted region a full name with its side: one to a line.
  const single = plate.map === 'deficit' || plate.map === 'highlight';
  const columns = phone && plate.name !== 'direction' && !single ? 2 : 1;
  const rowPx = plate.pickable && (phone || coarse) ? TOUCH_ROW_PX : KEY_ROW_PX;
  return KEY_HEAD_PX + Math.ceil(plate.count / columns) * rowPx;
}

/**
 * Whether a plate starts open when the reader has not folded it (viewport-chrome.js:304-320). A long
 * key starts folded to its title where the stage is narrow or its rows would not fit above the dock;
 * on a phone an expanded key uses at most half that room and leaves room for the anatomy. Weigh
 * each plate under the `above` pixels taken by earlier plates and their gaps. `stage` is null until
 * the stage has a size.
 */
export function defaultOpen(
  plate: SizedPlate,
  device: KeyDevice,
  stage: StageRoom | null,
  above = 0,
): boolean {
  const need = above + keyHeight(plate, device, true);
  const room = stage ? stage.height - 3 * stage.gutter - stage.dockHeight : -Infinity;
  const crowded = Boolean(stage?.width) && (stage!.width < KEY_FOLD_WIDTH_PX || need > room);
  const phoneBudget = Math.min(room / 2, room - PHONE_ANATOMY_ROOM_PX);
  return !(
    (plate.count > KEY_FOLD_ROWS && crowded) ||
    (device.phone && Boolean(stage?.height) && need > phoneBudget)
  );
}

/**
 * The band the keys take off the framing rectangle (viewport-chrome.js:403-415): the top strip down
 * to the keys' foot or the right column, whichever leaves the anatomy the larger square. Nothing
 * while the keys or the stage have no size.
 */
export function keyBand(
  size: { width: number; height: number },
  visible: { width: number; height: number } | null,
  gutter: number,
): { top: number; right: number } {
  if (!size.width || !size.height || !visible?.width || !visible.height)
    return { top: 0, right: 0 };
  const top = Math.round(gutter + size.height);
  const right = Math.round(gutter + size.width);
  const { width, height } = visible;
  return Math.min(width, height - top) >= Math.min(width - right, height)
    ? { top, right: 0 }
    : { top: 0, right };
}
