<!--
  What one search result shows (navigator.js:265-388): the name with the query marked, the code or
  alias that explains a match the name does not, a key for each side as the tree draws them, and a
  second line naming the group (or, for a structure that is not on screen, why). One result stands
  for a structure's sides, as one tree row does (2026-11-20 review): a press on a side's key chooses
  that side. The option is U6's; this is its content.

  The drawn parts are `aria-hidden` and one visually hidden sentence is the option's name, because
  "L" is not what is said and an option has to say its sides, its group and what a press will do.
  The sentence starts with the visible name, so a voice command by name finds it (WCAG 2.5.3).
-->
<script lang="ts">
  import type { CatalogRow } from '../../lib/core/catalog/catalog.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import {
    matchedAlias,
    matchSegments,
    reasonText,
    UNREVEALABLE,
  } from '../../lib/core/panels/navigator.ts';
  import type { Language } from '../../lib/types/index.ts';

  interface Props {
    /** The structure's sides, left before right before midline. */
    sides: readonly CatalogRow[];
    /** The trimmed query the rows were found with. */
    query: string;
    lang: Language;
    /** The group as the tree names it, which qualifies a name two vocabularies share. */
    place: string;
    selectedId: string | null;
    /** Under a structure set's heading, which already says why it is not on screen. */
    underSet: boolean;
  }

  let { sides, query, lang, place, selectedId, underSet }: Props = $props();

  const copy = $derived(t(lang, 'navigator'));
  const first = $derived(sides[0]!);
  const said = (rows: readonly CatalogRow[]) =>
    new Intl.ListFormat(lang, { type: 'conjunction' }).format(
      rows.map((row) => t(lang, 'sides').words[row.region.hemisphere]),
    );
  const alias = $derived(
    matchedAlias(first.label, query) ?? (first.via ? copy.includes(first.via.name) : null),
  );
  const heard = $derived(alias ? `${first.label.name}, ${alias}` : first.label.name);
  const shown = $derived(sides.filter((row) => row.visible));
  const reason = $derived(shown.length ? null : reasonText(first.reason!, first.region, lang));
  const usable = (row: CatalogRow) => !UNREVEALABLE.has(row.reason);
  // A press chooses a side on screen when there is one, so only those are said.
  const spoken = $derived(
    shown.length
      ? `${heard}, ${said(shown)}, ${place}`
      : (sides.some(usable) ? copy.rowHiddenAria : copy.rowUnavailableAria)(
          heard,
          said(sides),
          reason!,
        ),
  );
  const selected = $derived(sides.some((row) => row.region.id === selectedId));
</script>

{#snippet marked(text: string)}
  {#each matchSegments(text, query) as segment}
    {#if segment.match}<mark class="query-match">{segment.text}</mark>{:else}{segment.text}{/if}
  {/each}
{/snippet}

<span class="result" data-selected={selected || undefined} data-hidden={!shown.length || undefined}>
  <span class="line" aria-hidden="true" data-tooltip={shown.length ? undefined : spoken}>
    <span class="title"
      >{@render marked(first.label.name)}{#if alias}<span class="alias"
          >({@render marked(alias)})</span
        >{/if}</span
    >
    <span class="sides">
      {#each sides as row (row.region.id)}
        <span
          class="side-key"
          data-side={row.region.hemisphere}
          data-state={row.visible ? 'shown' : 'hidden'}
          data-selected={row.region.id === selectedId || undefined}
          data-pick={usable(row) ? row.region.id : undefined}
          >{t(lang, 'sides').glyphs[row.region.hemisphere]}</span
        >
      {/each}
    </span>
    <span class="second">{reason !== null && !underSet ? reason : place}</span>
  </span>
  <span class="visually-hidden">{spoken}</span>
</span>

<style>
  @layer features {
    .result {
      display: block;
    }
    /* A name and its sides' keys on one line, the quieter second line under both (navigator.css:36-59). */
    .line {
      display: grid;
      grid-template-columns: minmax(0, 1fr) max-content;
      align-items: baseline;
      gap: 0 var(--space-3);
    }
    .title {
      grid-column: 1;
      grid-row: 1;
      min-width: 0;
      line-height: var(--lh-ui);
      overflow-wrap: anywhere;
      text-wrap: pretty;
    }
    .alias {
      margin-inline-start: var(--space-1);
      color: var(--text-tertiary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
    /* The tree's side keys, in its order; the row's own press chooses the side on screen. */
    .sides {
      --side-key: 28px;
      grid-column: 2;
      grid-row: 1 / 3;
      align-self: center;
      display: flex;
      gap: var(--space-1);
    }
    .sides .side-key {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .sides .side-key:not([data-pick]) {
      cursor: default;
    }
    /* A finger's keys, as the tree's (tree.css): 44 px targets round a 28 px face. */
    @media (pointer: coarse) {
      .sides {
        --side-key: 44px;
        gap: 0;
      }
      .sides .side-key[data-state='hidden']::before {
        background: transparent;
      }
    }
    .result[data-selected] .side-key:not([data-selected], [data-state='hidden']) {
      background: var(--surface-tonal-hover);
    }
    .second {
      grid-column: 1;
      grid-row: 2;
      color: var(--text-secondary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      overflow-wrap: anywhere;
    }
    .result[data-hidden] .title,
    .result[data-hidden] .second {
      color: var(--text-tertiary);
    }
    .result[data-selected] {
      font-weight: 600;
    }
    .result[data-selected] .second,
    .result[data-selected] .alias {
      color: inherit;
    }
    .query-match {
      background: transparent;
      color: var(--accent);
      font-weight: 600;
    }
  }
  @layer a11y {
    /* Forced colours drop the accent and the weight is barely visible: underline the match. */
    @media (forced-colors: active) {
      .query-match {
        color: inherit;
        text-decoration: underline;
        text-underline-offset: 2px;
      }
    }
  }
</style>
