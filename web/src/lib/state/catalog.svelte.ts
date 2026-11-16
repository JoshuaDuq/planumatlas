import type { createCatalog } from '../core/catalog/catalog.ts';
import { VISIBILITY_SETTINGS, type VisibilitySettings } from '../core/catalog/visibility.ts';
import type { ViewStore } from './view.svelte.ts';

/** The same setting: a set by its members, as the engine sends new sets with every change. */
const same = (a: unknown, b: unknown) =>
  a instanceof Set && b instanceof Set
    ? a.size === b.size && [...a].every((id) => b.has(id))
    : a === b;

/** What the view derives from the catalog (app.js:1620-1623): its language, groups and count. */
export function createCatalogStore(catalog: ReturnType<typeof createCatalog>, view: ViewStore) {
  $effect.pre(() => catalog.setLanguage(view.current.lang));
  const lang = $derived(view.current.lang);
  // Every change is a new view, a camera preset, a selection or a moved cut among them, and each
  // walk below passes over every region, the groups sorting them by name. So the walks read only
  // the settings that decide visibility, kept as one object until one of them changes (STORE-36).
  let kept: VisibilitySettings | null = null;
  const shown = $derived.by(() => {
    const current = view.current;
    const last = kept;
    if (last && VISIBILITY_SETTINGS.every((name) => same(last[name], current[name]))) return last;
    kept = Object.fromEntries(
      VISIBILITY_SETTINGS.map((name) => [name, current[name]]),
    ) as VisibilitySettings;
    return kept;
  });
  const groups = $derived(catalog.groups({ ...shown, lang }));
  const visibleCount = $derived(catalog.visibleCount(shown));
  return {
    get lang() {
      return lang;
    },
    get groups() {
      return groups;
    },
    get visibleCount() {
      return visibleCount;
    },
    /** A region's label in the view's language, read reactively. */
    label: (id: string) => catalog.label(id, view.current),
  };
}

export type CatalogStore = ReturnType<typeof createCatalogStore>;
