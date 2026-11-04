import { COMPARE_COLORS, SHARED_COLOR } from '../catalog/neuropsych-domains.ts';
import type { StrokeCase, StrokeCases } from '../catalog/stroke-cases.ts';
import { decimal } from '../format.ts';
import { t } from '../i18n/index.ts';
import type { Language } from '../../types/index.ts';

/** A case as the sheet and the stage key name it: its aphasia type and its score. */
export function caseTitle(entry: StrokeCase, lang: Language): string {
  const copy = t(lang, 'strokeCases');
  return copy.title(entry.type ? copy.types[entry.type] : copy.unrecorded, decimal(entry.aq, 1, lang));
}

/** The stage key for the cases on show: one in the lesion's ink, or two and the damage they share. */
export function casesKey(data: StrokeCases, chosen: readonly string[], lang: Language) {
  const copy = t(lang, 'strokeCases');
  const cases = chosen.map((id) => data.cases.find((entry) => entry.id === id)!);
  if (!cases.length) return null;
  if (cases.length === 1) {
    return {
      title: copy.heading,
      rows: [{ id: cases[0]!.id, color: 'var(--overlay-ink)', label: caseTitle(cases[0]!, lang) }],
    };
  }
  return {
    title: copy.heading,
    rows: [
      ...cases.map((entry, index) => ({
        id: entry.id,
        color: COMPARE_COLORS[index]!,
        label: copy.only(caseTitle(entry, lang)),
      })),
      { id: 'both', color: SHARED_COLOR, label: copy.both },
    ],
  };
}
