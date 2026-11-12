import type {
  KeyGround,
  Language,
  ModelState,
  Paint,
  Rgb,
  SessionState,
} from '../../types/index.ts';
import type { Translated } from '../clinical/types.ts';
import {
  ALL_DOMAINS,
  COMPARE_COLORS,
  comparedIds,
  domainName,
  domainPaint,
  paintAtlas,
  domainRecord,
  functionName,
  isTermId,
  overviewDomains,
  SHARED_COLOR,
} from '../catalog/neuropsych-domains.ts';
import type { NeuropsychDomains } from '../catalog/neuropsych-domains.ts';
import type { ClinicalCatalog } from '../clinical/catalog.ts';
import { connectivityPaint } from '../catalog/functional-connectivity.ts';
import type { FunctionalConnectivity } from '../catalog/functional-connectivity.ts';
import { decimal } from '../format.ts';
import { t } from '../i18n/index.ts';
import { mapNumber } from '../user-map/display.ts';
import type { MapOverlap } from '../user-map/display.ts';

/** The state the paint and its key are derived from: the model's with the session's over it. */
export type PaintState = Pick<ModelState, 'atlas'> &
  Pick<
    SessionState,
    | 'explorer'
    | 'selectedFunction'
    | 'selectedDeficit'
    | 'selectedFinding'
    | 'paintLifted'
    | 'lang'
    | 'paintFrom'
    | 'connectivitySeed'
  > & { paint?: Paint | null };

/** The findings near a placed lesion on the brain: its paint and the coloured findings, in rank order. */
export interface LesionPaint {
  /** The territories of the functions it reaches, or the regions its nearby findings cite. */
  kind: 'functions' | 'deficits';
  paint: Paint;
  rows: readonly { id: string; color: Rgb; title: Translated }[];
}

/** Which tab a paint belongs to, by its id: `function:…`, `deficit:…`, `lesion:…` or `connectivity:…`. */
export const paintKind = (paint: Paint | null | undefined): string | null =>
  paint?.id.slice(0, paint.id.indexOf(':')) || null;

/** The colours of a function compared with the reader's map: its areas, the map's, and where both are. */
export const FUNCTION_OVERLAP_COLOR: Rgb = COMPARE_COLORS[0]!;
export const MAP_OVERLAP: MapOverlap = { map: COMPARE_COLORS[1]!, both: SHARED_COLOR };

/** Whether the reader's drawn map is compared with the open function: one function or term alone, painted. */
export function comparesMap(
  state: PaintState,
  mapDrawn: boolean,
  domains: NeuropsychDomains,
): boolean {
  const id = state.selectedFunction;
  return (
    mapDrawn &&
    !state.paintLifted &&
    state.explorer === 'functions' &&
    id !== null &&
    id !== ALL_DOMAINS &&
    !comparedIds(id) &&
    state.atlas === paintAtlas(domains, id, state.atlas)
  );
}

/**
 * The tab's paint: the open function on its own atlas, the open deficit, or in Anatomy the resting
 * connectivity a region's sheet asked for, else the findings near a lesion, whose report is Anatomy's;
 * while that tab is in front and the reader has not chosen a masthead colour or atlas over it. Against
 * the reader's drawn map, a function's areas take one colour, so the map's two colours read against it.
 */
export function paintFor(
  state: PaintState,
  {
    domains,
    clinical,
    lesion = null,
    connectivity = null,
    mapDrawn = false,
  }: {
    domains: NeuropsychDomains;
    clinical: ClinicalCatalog;
    lesion?: LesionPaint | null;
    connectivity?: FunctionalConnectivity | null;
    mapDrawn?: boolean;
  },
): Paint | null {
  if (state.paintLifted) return null;
  if (
    state.explorer === 'anatomy' &&
    state.connectivitySeed &&
    connectivity?.atlases[state.atlas]
  ) {
    return connectivityPaint(connectivity, state.connectivitySeed);
  }
  if (state.explorer === 'anatomy' && lesion) return lesion.paint;
  // On its own atlas where the function was measured there (supervisor review 3.1), else on HCP-MMP.
  if (
    state.explorer === 'functions' &&
    state.selectedFunction &&
    state.atlas === paintAtlas(domains, state.selectedFunction, state.atlas)
  ) {
    const single = state.selectedFunction !== ALL_DOMAINS && !comparedIds(state.selectedFunction);
    const paint = domainPaint(
      domains,
      state.selectedFunction,
      state.atlas,
      single ? (state.paintFrom ?? domains.threshold_z) : domains.threshold_z,
    );
    if (!comparesMap(state, mapDrawn, domains)) return paint;
    return {
      id: `${paint.id}:map`,
      colors: new Map([...paint.colors.keys()].map((region) => [region, FUNCTION_OVERLAP_COLOR])),
    };
  }
  if (state.explorer === 'deficits' && state.selectedDeficit) {
    return clinical.paint(state.selectedDeficit, state.selectedFinding).paint;
  }
  return null;
}

/** One row of the stage key. */
export interface LegendRow {
  id: string;
  color: Rgb | string;
  label: string;
  pressed: boolean;
  /** Keyed but greyed: no region in this view carries the colour. */
  absent?: boolean;
}

export interface Legend {
  map: 'function' | 'deficit' | 'lesion' | 'connectivity';
  title: string;
  note: string;
  /** False for a z scale, whose bands are not toggles. */
  pickable?: boolean;
  rows: LegendRow[];
}

/**
 * What shows where a paint leaves a region: the T1 scan under the scan colour, which draws over a
 * ghost too; a ghost's grey under Focus, a route, Tracts or a see-through paint (the engine's
 * `ghosting`); else tissue.
 */
export const keyGround = (
  state: Pick<ModelState, 'surfaceColor' | 'focused' | 'ghostedAround'>,
): KeyGround =>
  state.surfaceColor === 'mri' ? 'scan' : state.focused || state.ghostedAround ? 'grey' : 'tissue';

/**
 * The stage key for the paint on show: the overview's functions, or the one function chosen on the z
 * scale, strongest band first, or each of the open deficit's findings. Only the overview's and the
 * deficit's rows are toggles; a scale's bands are not.
 */
export function legendFor(
  state: PaintState & Pick<ModelState, 'surfaceColor' | 'focused' | 'ghostedAround'>,
  {
    domains,
    clinical,
    drawn,
    lesion = null,
    connectivity = null,
    label = null,
    map = null,
  }: {
    domains: NeuropsychDomains;
    clinical: ClinicalCatalog;
    drawn: (region: string, state: PaintState) => boolean;
    lesion?: LesionPaint | null;
    connectivity?: FunctionalConnectivity | null;
    /** A region's name, for the connectivity key's seed. */
    label?: ((id: string) => string) | null;
    /** The reader's drawn map, which a function's key then reads against. */
    map?: { title: string; threshold: number } | null;
  },
): Legend | null {
  const kind = paintKind(state.paint);
  const lang: Language = state.lang;
  const ground = keyGround(state);
  if (kind === 'connectivity') {
    const copy = t(lang, 'connectivity');
    const scale = connectivity!.r_scale;
    // A step no painted area carries is outlined, as a function's band is.
    const carried = new Set([...state.paint!.colors.values()].map((color) => color.join()));
    return {
      map: 'connectivity',
      title: copy.keyTitle(label!(state.connectivitySeed!)),
      note: copy.keyNote(decimal(scale[0]!.from, 2, lang), ground),
      pickable: false,
      rows: scale
        .map((step, index) => ({
          id: `r-${step.from}`,
          color: step.color,
          pressed: false,
          absent: !carried.has(step.color.join()),
          label: copy.step(
            decimal(step.from, 2, lang),
            index + 1 < scale.length ? decimal(scale[index + 1]!.from, 2, lang) : null,
          ),
        }))
        .reverse(),
    };
  }
  if (kind === 'lesion') {
    const copy = t(lang, 'lesion');
    const functions = lesion!.kind === 'functions';
    return {
      map: 'lesion',
      title: functions ? copy.keyFunctionsTitle : copy.keyTitle,
      note: functions ? copy.keyFunctionsNote : copy.keyNote,
      pickable: false,
      rows: lesion!.rows.map(({ id, color, title }) => ({
        id,
        color,
        label: title[lang],
        pressed: false,
      })),
    };
  }
  if (kind === 'function') {
    const copy = t(lang, 'domains');
    if (map && comparesMap(state, true, domains)) {
      const name = domainName(domainRecord(domains, state.selectedFunction!)!, lang);
      const floor = decimal(state.paintFrom ?? domains.threshold_z, 1, lang, { trim: true });
      const row = (id: string, color: Rgb, text: string): LegendRow => ({
        id,
        color,
        label: text,
        pressed: false,
      });
      return {
        map: 'function',
        title: `${name} · ${map.title}`,
        pickable: false,
        note: copy.keyMap(state.surfaceColor === 'mri'),
        rows: [
          {
            ...row('function', FUNCTION_OVERLAP_COLOR, copy.keyMapFunction(name, floor)),
            absent: state.paint!.colors.size === 0,
          },
          row('map', MAP_OVERLAP.map, copy.keyMapAbove(map.title, mapNumber(map.threshold, lang))),
          row('shared', MAP_OVERLAP.both, copy.keyShared),
        ],
      };
    }
    const compared = comparedIds(state.selectedFunction);
    if (compared) {
      // A colour no area carries is keyed but greyed, as a deficit's is.
      const carried = new Set([...state.paint!.colors.values()].map((color) => color.join()));
      const row = (id: string, color: Rgb, label: string): LegendRow => ({
        id,
        color,
        label,
        pressed: false,
        absent: !carried.has(color.join()),
      });
      return {
        map: 'function',
        title: functionName(domains, state.selectedFunction!, lang),
        pickable: false,
        note: copy.keyCompare(ground),
        rows: [
          ...compared.map((id, index) =>
            row(id, COMPARE_COLORS[index]!, domainName(domainRecord(domains, id)!, lang)),
          ),
          row('shared', SHARED_COLOR, copy.keyShared),
        ],
      };
    }
    if (state.selectedFunction !== ALL_DOMAINS) {
      const picked = domainRecord(domains, state.selectedFunction!)!;
      // A band no painted area carries, a raised threshold's below it included, is outlined.
      const carried = new Set([...state.paint!.colors.values()].map((color) => color.join()));
      const bands = domains.z_scale
        .map((band, index) => ({
          id: `z-${band.from}`,
          color: band.color,
          pressed: false,
          absent: !carried.has(band.color.join()),
          label: copy.band(
            decimal(band.from, 0, lang),
            index + 1 < domains.z_scale.length
              ? decimal(domains.z_scale[index + 1]!.from, 0, lang)
              : null,
          ),
        }))
        .reverse();
      return {
        map: 'function',
        title: domainName(picked, lang),
        pickable: false,
        note: (isTermId(picked.id) ? copy.keyScaleTerm : copy.keyScale)(
          ground,
          decimal(state.paintFrom ?? domains.threshold_z, 1, lang, { trim: true }),
        ),
        rows: bands,
      };
    }
    const row = (record: ReturnType<typeof overviewDomains>[number]): LegendRow => ({
      id: record.id,
      color: record.color,
      label: domainName(record, lang),
      pressed: false,
    });
    return {
      map: 'function',
      title: copy.keyTitle,
      note: copy.keyAll(ground),
      rows: overviewDomains(domains).map(row),
    };
  }
  if (kind === 'deficit') {
    const copy = t(lang, 'deficitKey');
    const { findings } = clinical.paint(state.selectedDeficit!);
    // A finding whose colour no drawn region carries, because its regions are not drawn in this view or
    // take an earlier finding's colour, is keyed but greyed, so the key promises nothing the stage lacks.
    // A FreeSurfer structure is shown by its teaching-set stand-ins, too.
    const shows = (association: (typeof findings)[number]['association'], color: Rgb) =>
      association.mappings.some(({ region }) =>
        [region, ...clinical.standIns(region)].some(
          (id) => state.paint!.colors.get(id)?.join() === color.join() && drawn(id, state),
        ),
      );
    const rows = findings.map(({ association, color }) => ({
      id: association.id,
      color,
      label: association.title[lang]!,
      pressed: association.id === state.selectedFinding,
      absent:
        (!state.selectedFinding || association.id === state.selectedFinding) &&
        !shows(association, color),
    }));
    const note =
      findings.length === 1
        ? copy.keyOne(ground)
        : state.selectedFinding
          ? copy.keyPicked
          : copy.keyAll(ground);
    return {
      map: 'deficit',
      title: clinical.get(state.selectedDeficit!).name[lang]!,
      note: rows.some((row) => row.absent) ? `${note} ${copy.keyAbsent}` : note,
      rows,
    };
  }
  return null;
}
