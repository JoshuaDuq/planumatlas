<!--
  Find a region (navigator.js:390-461, 704-732): U6's combobox over the catalog's ranked matches,
  with the sentences that say what else there is, after the list. One option stands for a structure's
  sides, as one tree row does, and the matches another structure set holds follow under its name
  (2026-11-20 review). Matches that another atlas draws are reported with a button that switches to
  it, not dropped; so are the other tabs that find the same words, with a button that carries the
  search there (U1). A region the colour or the internal anatomy keeps off the cut is listed, and
  revealed by changing that. Choosing a result empties the query, so the tree returns around it, then
  selects the side pressed, or the one the tree's row would, or reveals it.
-->
<script lang="ts">
  import type { CatalogGroup, CatalogRow } from '../../lib/core/catalog/catalog.ts';
  import type { HiddenReason } from '../../lib/core/catalog/visibility.ts';
  import type { Elsewhere } from '../../lib/core/elsewhere.ts';
  import { count } from '../../lib/core/format.ts';
  import { atlasSwitchLabel, t } from '../../lib/core/i18n/index.ts';
  import {
    groupDisplayName,
    matchesElsewhere,
    searchSections,
    searchStructures,
    sharedGroupNames,
    UNREVEALABLE,
  } from '../../lib/core/panels/navigator.ts';
  import type { Explorer, Language } from '../../lib/types/index.ts';
  import EmptyState from '../../lib/ui/EmptyState.svelte';
  import SearchCombobox, { type SearchGroup } from '../../lib/ui/SearchCombobox.svelte';
  import SearchResults from './SearchResults.svelte';

  interface Surface {
    id: string;
    label: string;
  }

  interface Props {
    lang: Language;
    query: string;
    /** The catalog's ranked matches for a query under the current display, up to `limit`, with the real total. */
    search: (query: string, limit?: number) => { rows: CatalogRow[]; total: number };
    /** The tree's groups: a group name two vocabularies share says which one it is. */
    groups: readonly CatalogGroup[];
    selectedId: string | null;
    atlases: readonly Surface[];
    atlas: string;
    /** A region that is on screen was chosen. */
    onSelect: (id: string) => void;
    /** A region that is not on screen was chosen: undo what hides it, then select it. */
    onReveal: (reason: HiddenReason, id: string) => void;
    /** A rejection is the caller's to report: it is not caught here. */
    onAtlas: (id: string) => void | Promise<void>;
    /** The other tabs that find the same words. */
    elsewhere: (query: string) => Elsewhere[];
    /** Carries the query to another tab. A rejection is the caller's to report. */
    onElsewhere: (mode: Explorer) => void | Promise<void>;
  }

  let {
    lang,
    query = $bindable(),
    search,
    groups,
    selectedId,
    atlases,
    atlas,
    onSelect,
    onReveal,
    onAtlas,
    elsewhere,
    onElsewhere,
  }: Props = $props();

  interface Note {
    /** What found nothing: the heading of the first sentence, when nothing is listed. */
    title?: string;
    text: string;
    action?: { label: string; run: () => void | Promise<void> };
  }

  /** How many results the list shows: past it, a sentence says how many there are. */
  const RESULT_CAP = 50;

  const copy = $derived(t(lang, 'navigator'));
  const trimmed = $derived(query.trim());
  // Every match: the list is capped by structure, after the sides are put together.
  const found = $derived(trimmed ? search(trimmed, Infinity) : { rows: [], total: 0 });
  // A row hidden by an atlas mismatch is elsewhere, not absent: it is reported with the switch.
  const everySection = $derived(
    searchSections(found.rows.filter((row) => row.reason !== 'other-atlas')),
  );
  const total = $derived(everySection.reduce((sum, section) => sum + section.structures.length, 0));
  /** The sections as listed: the first RESULT_CAP structures, in their order. */
  const sections = $derived.by(() => {
    let room = RESULT_CAP;
    return everySection
      .map((section) => {
        const structures = section.structures.slice(0, room);
        room -= structures.length;
        return { ...section, structures };
      })
      .filter((section) => section.structures.length);
  });
  /** Each listed structure by its option's value, its first side's region. */
  const here = $derived(
    new Map(
      sections.flatMap(({ set, structures }) =>
        structures.map((sides) => [sides[0]!.region.id, { set, sides }] as const),
      ),
    ),
  );
  const others = $derived(trimmed ? elsewhere(trimmed) : []);
  const shared = $derived(sharedGroupNames(groups));
  const place = (row: CatalogRow) => groupDisplayName(row.label.group, row.region, shared, lang);
  /** The selected region's side, which a structure's own press keeps, as the tree's row does. */
  const selectedSide = $derived(
    groups.flatMap((group) => group.rows).find((row) => row.region.id === selectedId)?.region
      .hemisphere,
  );
  const heading = (set: string | null) =>
    set === null
      ? undefined
      : set === ''
        ? t(lang, 'reasons')['other-detail']
        : copy.alsoIn(atlasSwitchLabel(set, lang));

  const sentences = $derived.by((): Note[] => {
    const atlasNames = t(lang, 'atlases') as Record<string, string | undefined>;
    const named = ({ id, label }: Surface) => atlasNames[id] ?? label;
    // Nothing is being searched for: the notes are not shown (navigator.js:745-755).
    if (!trimmed) return [];
    const result: Note[] = [];
    // The hint is for a search that found nothing anywhere; matches elsewhere are the next step.
    if (here.size === 0 && found.rows.length === 0 && others.length === 0) {
      result.push({ text: copy.noMatchHint });
    }
    if (total > here.size) {
      result.push({ text: copy.showingCapped(here.size, count(total, 'match', lang)) });
    }
    for (const { atlas: other, rows } of matchesElsewhere(
      found.rows.filter((row) => row.reason === 'other-atlas'),
      atlases,
      atlas,
    )) {
      result.push({
        text: copy.matchesInOther(
          count(searchStructures(rows).length, 'match', lang),
          named(other),
        ),
        action: { label: copy.switchAtlas, run: () => onAtlas(other.id) },
      });
    }
    const tabs = t(lang, 'workspace').modes;
    for (const { mode, count: matches } of others) {
      result.push({
        text: copy.matchesInTab(count(matches, 'match', lang), tabs[mode]),
        action: { label: copy.showInTab(tabs[mode]), run: () => onElsewhere(mode) },
      });
    }
    if (here.size === 0) result[0].title = copy.noMatch(trimmed);
    return result;
  });

  // Said once typing pauses: the count, or what was not found and where to look instead.
  const status = $derived(
    [
      here.size > 0 && total === here.size ? `${count(here.size, 'match', lang)}.` : null,
      ...sentences.flatMap((note) => [note.title ? `${note.title}.` : null, note.text.trim()]),
    ]
      .filter((sentence) => sentence !== null)
      .join(' '),
  );

  const groupsOfOptions = $derived<SearchGroup[]>(
    sections.map(({ set, structures }) => ({
      heading: heading(set),
      options: structures.map((sides) => ({
        value: sides[0]!.region.id,
        disabled: sides.every((row) => UNREVEALABLE.has(row.reason)),
        current: sides.some((row) => row.region.id === selectedId),
      })),
    })),
  );

  let root: HTMLElement;
  const field = () => root.querySelector<HTMLInputElement>('input[role="combobox"]')!;

  /** Moves focus to the field, and selects its text for a new search (the `/` key). */
  export function focusSearch({ select = true }: { select?: boolean } = {}) {
    field().focus();
    if (select) field().select();
  }

  /**
   * The side a structure's press chooses: the selected region's side, then left, right and midline,
   * one on screen first, as the tree's row does. A side that cannot be revealed is never chosen.
   */
  function sideToChoose(sides: readonly CatalogRow[]): CatalogRow {
    const order = [selectedSide, 'left', 'right', 'midline'];
    const ranked = sides
      .filter((row) => !UNREVEALABLE.has(row.reason))
      .toSorted((a, b) => order.indexOf(a.region.hemisphere) - order.indexOf(b.region.hemisphere));
    return ranked.find((row) => row.visible) ?? ranked[0]!;
  }

  /** U6 never offers a disabled option, so a structure that cannot be revealed is not chosen here. */
  function choose(value: string, from?: Element) {
    const { sides } = here.get(value)!;
    const pressed = from?.closest<HTMLElement>('[data-pick]')?.dataset.pick;
    const row = sides.find((side) => side.region.id === pressed) ?? sideToChoose(sides);
    // A chosen hit belongs in the tree beside its neighbours; the query would keep the list in front of it.
    query = '';
    if (row.visible) onSelect(row.region.id);
    else onReveal(row.reason, row.region.id);
  }

  /** A button here goes when the list is rebuilt, so focus goes back to the field first. */
  function run(action: () => void | Promise<void>) {
    focusSearch({ select: false });
    return action();
  }
</script>

<div class="anatomy-search" bind:this={root}>
  <SearchCombobox
    bind:query
    groups={groupsOfOptions}
    label={copy.searchLabel}
    listLabel={copy.searchResults}
    clearLabel={copy.clearSearch}
    {status}
    showShortcut
    onselect={choose}
  >
    {#snippet option({ value })}
      {@const { set, sides } = here.get(value)!}
      <SearchResults
        {sides}
        query={trimmed}
        {lang}
        place={place(sides[0]!)}
        {selectedId}
        underSet={set !== null}
      />
    {/snippet}
    {#snippet notes()}
      {#each sentences as note (note.text)}
        <EmptyState
          title={note.title}
          message={note.text.trim()}
          actionLabel={note.action?.label}
          onaction={note.action && (() => run(note.action!.run))}
        />
      {/each}
    {/snippet}
  </SearchCombobox>
</div>

<style>
  @layer features {
    /* The field, list and notes are the explorer's own flow, so the field can stay pinned above them. */
    .anatomy-search,
    .anatomy-search > :global(.search) {
      display: contents;
    }
  }
</style>
