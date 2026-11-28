// A search typed in one tab, run against the other tabs' catalogues (U1): each tab that finds
// something is offered as a way on, with the count it would list. Region aliases stay nomenclature
// (destrieux-labels.ts), so a symptom or a tract is found where it is catalogued, not as a region.
import { MODES } from '../types/constants.ts';
import type { Explorer, Language } from '../types/index.ts';
import { t } from './i18n/index.ts';
import type { Circuit, Landmark } from './learning/catalog.ts';
import { foldForSearch } from './tracts.ts';

/** Another tab's matches for the same words. */
export interface Elsewhere {
  mode: Explorer;
  count: number;
}

/** The other tabs that find something, in tab order. Only their counts are computed. */
export function elsewhere(from: Explorer, counts: Record<Explorer, () => number>): Elsewhere[] {
  return MODES.filter((mode) => mode !== from)
    .map((mode) => ({ mode, count: counts[mode]() }))
    .filter(({ count }) => count > 0);
}

type SearchableCircuit = Pick<Circuit, 'name' | 'route'> & {
  steps: readonly Pick<Landmark, 'name'>[];
};

/** Guided circuits whose title, route or landmark names hold the localized search words. */
export function circuitsMatching<C extends SearchableCircuit>(
  circuits: readonly C[],
  query: string,
  lang: Language,
): C[] {
  const needle = foldForSearch(query.trim(), lang);
  if (!needle) return [];
  const matches = (text: string) => foldForSearch(text, lang).includes(needle);
  return circuits.filter(
    (circuit) =>
      matches(circuit.name[lang]) ||
      matches(circuit.route[lang]) ||
      circuit.steps.some((step) => matches(step.name[lang])),
  );
}

/** A list's way on to another tab: "Deficits: 5 lesion profiles match “aphasia”". */
export function bridgeText(lang: Language, { mode, count }: Elsewhere, query: string): string {
  if (mode === 'functions') return t(lang, 'clinical').functionBridge(count, query);
  if (mode === 'deficits') return t(lang, 'functions').deficitBridge(count, query);
  return t(lang, 'workspace').bridges[mode](count, query);
}
