import type { Language, ModelState, Paint, Rgb, SessionState } from '../../types/index.ts';
import type { Translated } from '../clinical/types.ts';
import {
  ALL_DOMAINS,
  COMPARE_COLORS,
  comparedIds,
  domainName,
  domainPaint,
  domainRecord,
  functionName,
  isTermId,
  overviewDomains,
  SHARED_COLOR,
} from '../catalog/neuropsych-domains.ts';
import type { NeuropsychDomains } from '../catalog/neuropsych-domains.ts';
import type { ClinicalCatalog } from '../clinical/catalog.ts';
import { decimal } from '../format.ts';
import { t } from '../i18n/index.ts';

/** The state the paint and its key are derived from: the model's with the session's over it. */
export type PaintState = Pick<ModelState, 'atlas'> &
  Pick<
    SessionState,
    'explorer' | 'selectedFunction' | 'selectedDeficit' | 'selectedFinding' | 'paintLifted' | 'lang'
  > & { paint?: Paint | null };

/** The findings near a placed lesion on the brain: its paint and the coloured findings, in rank order. */
export interface LesionPaint {
  /** The territories of the functions it reaches, or the regions its nearby findings cite. */
  kind: 'functions' | 'deficits';
  paint: Paint;
  rows: readonly { id: string; color: Rgb; title: Translated }[];
}

/** Which tab a paint belongs to, by its id: `function:…`, `deficit:…` or `lesion:…`. */
export const paintKind = (paint: Paint | null | undefined): string | null =>
  paint?.id.slice(0, paint.id.indexOf(':')) || null;

/**
 * The tab's paint: the open function on its own atlas, the open deficit, or the findings near a
 * lesion, whose report is Anatomy's, while that tab is in front and the reader has not chosen a
 * masthead colour or atlas over it.
 */
export function paintFor(
  state: PaintState,
  {
    domains,
    clinical,
    lesion = null,
  }: { domains: NeuropsychDomains; clinical: ClinicalCatalog; lesion?: LesionPaint | null },
): Paint | null {
  if (state.paintLifted) return null;
  if (state.explorer === 'anatomy' && lesion) return lesion.paint;
  if (state.explorer === 'functions' && state.selectedFunction && state.atlas === domains.atlas) {
    return domainPaint(domains, state.selectedFunction);
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
  map: 'function' | 'deficit' | 'lesion';
  title: string;
  note: string;
  /** False for a z scale, whose bands are not toggles. */
  pickable?: boolean;
  rows: LegendRow[];
}

/**
 * The stage key for the paint on show: the overview's functions, or the one function chosen on the z
 * scale, strongest band first, or each of the open deficit's findings. Only the overview's and the
 * deficit's rows are toggles; a scale's bands are not.
 */
export function legendFor(
  state: PaintState & Pick<ModelState, 'surfaceColor'>,
  {
    domains,
    clinical,
    drawn,
    lesion = null,
  }: {
    domains: NeuropsychDomains;
    clinical: ClinicalCatalog;
    drawn: (region: string, state: PaintState) => boolean;
    lesion?: LesionPaint | null;
  },
): Legend | null {
  const kind = paintKind(state.paint);
  const lang: Language = state.lang;
  // Under the T1 colour what the paint leaves shows the scan, not the tissue colour.
  const scan = state.surfaceColor === 'mri';
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
        note: copy.keyCompare(scan),
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
      const bands = domains.z_scale
        .map((band, index) => ({
          id: `z-${band.from}`,
          color: band.color,
          pressed: false,
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
        note: isTermId(picked.id) ? copy.keyScaleTerm(scan) : copy.keyScale(scan),
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
      note: copy.keyAll(scan),
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
        ? copy.keyOne(scan)
        : state.selectedFinding
          ? copy.keyPicked
          : copy.keyAll(scan);
    return {
      map: 'deficit',
      title: clinical.get(state.selectedDeficit!).name[lang]!,
      note: rows.some((row) => row.absent) ? `${note} ${copy.keyAbsent}` : note,
      rows,
    };
  }
  return null;
}
