<!--
  The Functions tab's list (viewer/ui/panels/functions.js:384-390, 405-456, index.html:258-277,301-304):
  the search field, the functions under their groups, the Neurosynth terms a search finds, the
  bridge to the Deficits tab and the list's scope. A list of buttons, not a listbox (decision 37 on
  #4): each row opens a profile, and every row is a Tab stop. In compare mode each row is a
  checkbox instead, and a bar under the list opens the comparison of the two picked. The field's
  Down and Enter and the rows' Up and Down are `listNav`, which leaves every other key alone.
  - the field has a visible label (WCAG 3.3.2, deviations/x1-search-label.md);
  - the result count is said 500 ms after typing pauses, not again on a language switch
    (deviations/x1-result-announcement.md);
  - groups are lists (deviations/x1-list-semantics.md).
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import {
    COMPARE_MAX,
    compareId,
    functionName,
  } from '../../lib/core/catalog/neuropsych-domains.ts';
  import { grouped } from '../../lib/core/format.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import { registerCurrentItem } from '../../lib/core/workspace.ts';
  import { createDebouncedAnnouncer } from '../../lib/ui/announcer.svelte.ts';
  import EmptyState from '../../lib/ui/EmptyState.svelte';
  import { listNav } from '../../lib/ui/list-nav.ts';
  import SearchBridge from '../../lib/ui/SearchBridge.svelte';
  import type { FunctionExplorer } from './functions-explorer.svelte.ts';
  import { functionList, resultsSentence, type FunctionRow } from './functions-view.ts';

  let { model }: { model: FunctionExplorer } = $props();

  const uid = $props.id();
  const lang = $derived(model.lang);
  const copy = $derived(t(lang, 'functions'));
  const query = $derived(model.query.trim());
  const content = $derived(functionList(model.domains, query, lang));
  const deficits = $derived(query ? model.deficitsMatching(query, lang) : 0);
  const empty = $derived(
    query !== '' && content.matches.functions === 0 && content.matches.terms === 0,
  );

  const full = $derived(model.picked.length === COMPARE_MAX);

  let input = $state<HTMLInputElement | null>(null);
  let listElement = $state<HTMLElement | null>(null);

  $effect(() => {
    if (input && listElement) return model.attachSearch(input, listElement);
  });
  $effect(() => {
    if (input && listElement) {
      const navigation = listNav(listElement, {
        field: input,
        rows: '.function-row, .search-bridge',
      });
      return () => navigation.destroy();
    }
  });
  $effect(() =>
    registerCurrentItem(
      () => listElement?.querySelector<HTMLElement>('[aria-current="true"]') ?? null,
    ),
  );

  // The count of results is said once typing pauses, from the query and the counts only: a
  // language switch changes neither, so it says nothing (the sentence is read untracked).
  const announcer = createDebouncedAnnouncer();
  $effect(() => () => announcer.dispose());
  const functionCount = $derived(content.matches.functions);
  const termCount = $derived(content.matches.terms);
  $effect(() => {
    if (query === '') {
      announcer.reset();
      return;
    }
    void functionCount;
    void termCount;
    announcer.say(untrack(() => resultsSentence(content.matches, lang)));
  });

  function onkeydown(event: KeyboardEvent) {
    if (event.isComposing || event.key !== 'Escape' || model.query === '') return;
    // Handled: the page's own Escape would go on to clear the selection.
    event.preventDefault();
    model.setQuery('');
  }

  function suggest(name: string) {
    model.setQuery(name);
    input?.focus();
  }

  function clear() {
    model.setQuery('');
    input?.focus();
  }
</script>

<div class="head" hidden={!model.exploring}>
  <div class="head-row">
    <label class="search-label" for="{uid}-search">{copy.search}</label>
    <button
      type="button"
      class="compare-toggle"
      aria-pressed={model.comparing}
      onclick={() => model.toggleComparing()}
    >
      {model.comparing ? copy.compareCancel : copy.compare}
    </button>
  </div>
  <div class="search-box">
    <svg
      class="search-affordance"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
    <input
      bind:this={input}
      id="{uid}-search"
      type="search"
      aria-controls="{uid}-list"
      autocomplete="off"
      spellcheck="false"
      bind:value={() => model.query, (value) => model.setQuery(value)}
      {onkeydown}
    />
    {#if query !== ''}
      <button
        type="button"
        class="search-clear"
        aria-label={t(lang, 'navigator').clearSearch}
        onclick={clear}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    {:else}
      <kbd class="search-shortcut" aria-hidden="true">/</kbd>
    {/if}
  </div>
</div>

<div class="browser scroll-fade" hidden={!model.exploring}>
  <div id="{uid}-list" role="group" aria-label={copy.list} bind:this={listElement}>
    {#if content.overview && !model.comparing}
      <ul class="rows">
        <li>{@render row(content.overview, true)}</li>
      </ul>
    {/if}
    {#each [...content.groups, ...content.termGroups] as group (group.id)}
      <div role="group" aria-labelledby="{uid}-{group.id}" class="group">
        <h3 id="{uid}-{group.id}" class="group-heading">
          <span>{group.name}</span>
          <span class="column-head" aria-hidden="true">{copy.studiesColumn}</span>
        </h3>
        <ul class="rows">
          {#each group.rows as item (item.id)}
            <li>{@render row(item)}</li>
          {/each}
        </ul>
      </div>
    {/each}
    {#if content.termsMore}
      <p class="note">{copy.termsMore(content.termsMore)}</p>
    {/if}
    {#if empty}
      <EmptyState title={t(lang, 'navigator').noMatch(query)} message={copy.noResults} />
      {#if content.suggestion}
        <SearchBridge
          text={copy.suggest(content.suggestion)}
          onclick={() => suggest(content.suggestion!)}
        />
      {/if}
    {/if}
    {#if deficits}
      <SearchBridge
        text={copy.deficitBridge(deficits, query)}
        onclick={() => model.searchDeficits(query)}
      />
    {/if}
  </div>
  <!-- The list's scope stands under the whole list; a search says its count instead. -->
  <p class="scope-note" hidden={query !== ''}>
    {copy.coverage(model.domains.domains.length, model.domains.search?.terms.size ?? 0)}
  </p>
  {#if model.comparing}
    <div class="compare-bar">
      <p class="compare-picked" aria-live="polite">
        {full
          ? functionName(model.domains, compareId(model.picked), lang)
          : copy.comparePrompt(model.picked.length)}
      </p>
      <button
        type="button"
        class="compare-open"
        data-compare-open
        aria-disabled={full ? undefined : 'true'}
        onclick={() => full && model.compare()}
      >
        {copy.compareOpen}
      </button>
    </div>
  {/if}
</div>

<!-- The overview is the whole list, not a coloured function: it starts on the inset, like the captions. -->
{#snippet row(item: FunctionRow, overview = false)}
  {@const current = !model.comparing && item.id === model.selected}
  {@const checked = model.comparing && model.picked.includes(item.id)}
  <button
    type="button"
    class="function-row"
    class:counted={item.studies !== null}
    data-function={item.id}
    role={model.comparing ? 'checkbox' : undefined}
    aria-checked={model.comparing ? checked : undefined}
    aria-disabled={model.comparing && full && !checked ? 'true' : undefined}
    aria-current={current ? 'true' : undefined}
    data-selected={String(current)}
    onclick={() => (model.comparing ? model.togglePick(item.id) : model.openFunction(item.id))}
  >
    {#if model.comparing}
      <span class="pick" aria-hidden="true"></span>
    {/if}
    <span class="row-name" lang={item.lang ?? undefined}>{item.name}</span>
    {#if item.studies !== null}
      <span class="group-count" aria-hidden="true">{grouped(item.studies)}</span>
    {/if}
    <span class="visually-hidden">, {item.detail}</span>
    {#if !model.comparing}
      <span class="chevron" aria-hidden="true"></span>
    {/if}
  </button>
{/snippet}

<style>
  @layer features {
    .head {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding: var(--space-3) var(--panel-inset);
      border-bottom: 1px solid var(--border-subtle);
      background: var(--surface-base);
    }
    .head-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
    }
    /* Compare and Cancel are text, like Restore: an accent word at the label's end. */
    .compare-toggle {
      flex: none;
      min-height: 24px;
      height: auto;
      margin: 0;
      padding: 0;
      border: 0;
      background: none;
      color: var(--accent);
      font-size: var(--text-caption);
      font-weight: 400;
      line-height: var(--lh-caption);
    }
    .compare-toggle:focus-visible {
      outline-offset: 2px;
    }
    .search-box {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
    }
    .search-affordance {
      position: absolute;
      left: 10px;
      width: 14px;
      height: 14px;
      color: var(--text-tertiary);
      pointer-events: none;
    }
    .search-clear {
      position: absolute;
      inset-block: 0;
      right: var(--space-1);
      margin-block: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      min-height: 0;
      padding: 0;
      border: 0;
      border-radius: var(--radius-control);
      background: transparent;
      color: var(--text-tertiary);
    }
    /* The keycap sits as far inside the field's end as it does inside its top and bottom. */
    .search-shortcut {
      position: absolute;
      right: 6px;
      padding: 0 6px;
      pointer-events: none;
    }
    :global(:root[data-single-keys='off']) .search-shortcut {
      display: none;
    }

    .group {
      isolation: isolate;
    }
    .rows {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    /* Groups follow the tree's section rhythm: ruled captions after the first, each staying in view while its rows scroll under it. */
    .group + .group,
    .rows + .group {
      margin-top: var(--space-2);
    }
    .group-heading {
      position: sticky;
      top: -1px;
      z-index: 1;
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-4) var(--panel-inset) var(--space-1);
      border-top: 1px solid var(--border-subtle);
      background: var(--surface-base);
      color: var(--text-secondary);
      font-size: var(--text-caption);
      font-weight: 600;
      line-height: var(--lh-caption);
      overflow-wrap: anywhere;
    }
    .group:first-child > .group-heading {
      padding-top: var(--space-3);
      border-top: 0;
    }
    /* A column head ends where the rows' figures end. */
    .column-head {
      flex: none;
      color: var(--text-tertiary);
      font-weight: 400;
      white-space: nowrap;
      /* Where touch keeps the chevron in the row, the head ends before its slot and gap. */
      margin-right: calc(var(--indent) - var(--panel-inset));
    }

    .function-row {
      position: relative;
      display: flex;
      align-items: center;
      gap: var(--space-2);
      width: 100%;
      min-height: var(--row-height);
      height: auto;
      margin: 0;
      padding: max(0px, (var(--row-height) - var(--lh-ui)) / 2) var(--panel-inset);
      border: 0;
      border-radius: 0;
      background: transparent;
      color: var(--text-primary);
      font-size: var(--text-ui);
      font-weight: 400;
      line-height: var(--lh-ui);
      text-align: left;
      /* Arrow navigation keeps the focused row below its sticky group heading. */
      scroll-margin-block-start: calc(var(--lh-caption) + var(--space-6));
      transition: background-color var(--ui-transition) var(--ease-ui);
    }
    .function-row:focus-visible {
      outline-offset: -2px;
    }
    .function-row[data-selected='true'] {
      background: var(--accent-wash);
      color: var(--accent);
      font-weight: 600;
    }
    .row-name {
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;
      text-wrap: pretty;
    }
    /* A compare pick: a checkbox in a 12px slot, centred on the first line. */
    .pick {
      flex: none;
      position: relative;
      align-self: flex-start;
      width: 12px;
      height: 12px;
      margin-top: calc((var(--lh-ui) - 12px) / 2);
      border-radius: var(--radius-mark);
      box-shadow: inset 0 0 0 1px var(--border-control);
    }
    .function-row[aria-checked='true'] .pick {
      background: var(--accent);
      box-shadow: none;
    }
    .function-row[aria-checked='true'] .pick::after {
      content: '';
      position: absolute;
      left: 4px;
      top: 1.5px;
      width: 3px;
      height: 6.5px;
      border-right: 1.5px solid var(--surface-base);
      border-bottom: 1.5px solid var(--surface-base);
      transform: rotate(45deg);
    }
    .function-row[aria-disabled='true'] {
      color: var(--text-tertiary);
      cursor: default;
    }
    .function-row[aria-disabled='true'] .pick {
      opacity: 0.5;
    }
    .group-count {
      flex: none;
      min-width: 2ch;
      margin-left: auto;
      color: var(--text-tertiary);
      font-size: var(--text-caption);
      font-weight: 400;
      line-height: var(--lh-caption);
      font-variant-numeric: tabular-nums;
      text-align: right;
      white-space: nowrap;
    }
    .function-row[data-selected='true'] .group-count {
      color: inherit;
    }
    .chevron {
      flex: none;
      width: 6px;
      height: 6px;
      margin: 0 3px;
      color: var(--text-tertiary);
      border-right: 1.5px solid currentColor;
      border-bottom: 1.5px solid currentColor;
      transform: translateX(-1.6px) rotate(-45deg);
    }
    .function-row[aria-current='true'] .chevron {
      color: inherit;
    }
    /* A mouse sees the chevron on hover, focus or selection; touch always. */
    @media (hover: hover) and (pointer: fine) {
      .compare-open:hover:not([aria-disabled='true']) {
        background: var(--primary-fill-hover);
        border-color: var(--primary-fill-hover);
      }
      .compare-toggle:hover {
        color: var(--accent-hover);
        text-decoration: underline;
        text-underline-offset: 3px;
      }
      .chevron {
        opacity: 0;
      }
      .function-row:hover:not([data-selected='true']) {
        background: var(--surface-hover);
      }
      .function-row:hover .chevron {
        opacity: 1;
        transition: opacity var(--ui-transition) var(--ease-ui);
      }
      .function-row:focus-visible .chevron,
      .function-row[aria-current='true']:not(.counted) .chevron {
        opacity: 1;
      }
      /* A figure keeps the data edge at rest and gives its place to the chevron on hover or focus; a selected row keeps its figure. */
      .counted .chevron {
        position: absolute;
        top: 50%;
        right: var(--panel-inset);
        margin-top: -3px;
      }
      .column-head {
        margin-right: 0;
      }
      .function-row:is(:hover, :focus-visible) .group-count {
        visibility: hidden;
      }
    }
    /* After the hover rule, which shares its weight: a pointer press tints the row at once. */
    .function-row:active:not([data-selected='true'], :focus-visible) {
      background: var(--surface-pressed);
      transition-duration: 0s;
    }
    @media (pointer: coarse) {
      .function-row {
        min-height: 44px;
      }
      .compare-toggle,
      .compare-open {
        min-height: 44px;
      }
      .search-clear {
        width: 44px;
        height: 44px;
        right: 0;
      }
      input[type='search'] {
        padding-right: 44px;
      }
      .search-shortcut {
        display: none;
      }
    }
    @media (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      .search-shortcut {
        display: none;
      }
    }

    /* The picks and the Compare button stay in view under the list while it scrolls. */
    .compare-bar {
      position: sticky;
      bottom: 0;
      z-index: 2;
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--panel-inset);
      border-top: 1px solid var(--border-subtle);
      background: var(--surface-base);
    }
    .compare-picked {
      flex: 1;
      min-width: 0;
      color: var(--text-secondary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      overflow-wrap: anywhere;
      text-wrap: pretty;
    }
    .compare-open {
      flex: none;
      background: var(--primary-fill);
      border-color: var(--primary-fill);
      color: var(--primary-ink);
      transition:
        background-color var(--ui-transition) var(--ease-ui),
        transform var(--press-transition) var(--ease-ui);
    }
    .compare-open:active:not([aria-disabled='true'], :focus-visible) {
      transform: scale(var(--press-scale));
    }
    .compare-open[aria-disabled='true'] {
      background: transparent;
      border-color: var(--border-control);
      color: var(--text-tertiary);
      cursor: default;
    }
    .note {
      padding: var(--space-3) var(--panel-inset);
      color: var(--text-secondary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
    /* A list's scope: one tertiary line at its foot, a count or a caveat. */
    .scope-note {
      padding: var(--space-3) var(--panel-inset) var(--space-4);
      border-top: 1px solid var(--border-subtle);
      color: var(--text-tertiary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      font-variant-numeric: tabular-nums;
      text-wrap: pretty;
    }
  }
  @layer a11y {
    @media (forced-colors: active) {
      input[type='search']:focus-visible {
        outline-color: Highlight;
      }
      .function-row[aria-checked='true'] .pick {
        background: Highlight;
      }
      .function-row[aria-checked='true'] .pick::after {
        border-color: HighlightText;
      }
      .function-row[data-selected='true'] {
        outline: 2px solid Highlight;
        outline-offset: -2px;
      }
    }
  }
</style>
