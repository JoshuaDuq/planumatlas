import type { createCatalog } from '../core/catalog/catalog.ts';
import { VISIBILITY_SETTINGS, type VisibilitySettings } from '../core/catalog/visibility.ts';
import type { ViewStore } from './view.svelte.ts';

/** The same setting: a set by its members, as the engine sends new sets with every change. */
const same = (a: unknown, b: unknown) =>
  a instanceof Set && b instanceof Set
    ? a.size === b.size && [...a].every((id) => b.has(id))
    : a === b;

/**
 * What the view derives from the catalog (app.js:1620-1623): its language, groups and count, and the
 * settings and search the stage's lobe key and the list's system picker and searches read.
 */
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
  // The lobe key and the system picker name a group as the tree does with every system listed
  // (`sharedGroupNames`): the tree's own groups while no system is chosen.
  const everySystem = $derived(
    shown.internalSystem === null
      ? groups
      : catalog.groups({ ...shown, internalSystem: null, lang }),
  );
  // In an object, so the count's version moves with each walk: a derived run again to an equal
  // value keeps its version, older than the settings', and Svelte runs it at every later change of
  // the view. A setting that leaves the count as it was, as a surface colour does, would
  // otherwise bring the walk back with every camera preset.
  const counted = $derived({ visible: catalog.visibleCount(shown) });
  return {
    get lang() {
      return lang;
    },
    /** The settings that decide what is on screen: the same object until one of them changes. */
    get settings() {
      return shown;
    },
    get groups() {
      return groups;
    },
    /** The groups with no system chosen. */
    get everySystem() {
      return everySystem;
    },
    get visibleCount() {
      return counted.visible;
    },
    /** A region's label in the view's language, read reactively. */
    label: (id: string) => catalog.label(id, view.current),
    /** The catalog's search over what is on screen, in the view's language, read reactively. */
    search: (query: string, limit?: number) => catalog.search(query, { ...shown, lang }, limit),
  };
}

export type CatalogStore = ReturnType<typeof createCatalogStore>;
