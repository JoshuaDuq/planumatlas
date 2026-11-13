<!--
  The Deficits list (clinical.js:352-445), for the workspace's list slot: a search field over deficits
  grouped by domain. A list of buttons, not a listbox: rows open a profile, they are not options. Each
  row stays a Tab stop and the arrow keys are a convenience (U6's `listNav`, decision 38 on #4).
-->
<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { bridgeText, type Elsewhere } from '../../lib/core/elsewhere.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import { deficitsForRegion } from '../../lib/core/panels/clinical.ts';
  import { registerCurrentItem } from '../../lib/core/workspace.ts';
  import type { View } from '../../lib/state/view.svelte.ts';
  import type { Explorer } from '../../lib/types/index.ts';
  import { createDebouncedAnnouncer } from '../../lib/ui/announcer.svelte.ts';
  import DrillRow from '../../lib/ui/DrillRow.svelte';
  import LinkRow from './LinkRow.svelte';
  import EmptyState from '../../lib/ui/EmptyState.svelte';
  import { listNav } from '../../lib/ui/list-nav.ts';
  import SearchBridge from '../../lib/ui/SearchBridge.svelte';
  import ShowAll from '../../lib/ui/ShowAll.svelte';
  import AboutData from '../info/AboutData.svelte';
  import ScopeLine from '../info/ScopeLine.svelte';
  import DeficitSearch from './DeficitSearch.svelte';
  import type { DeficitsExplorer } from './explorer.svelte.ts';

  let {
    explorer,
    view,
    showShortcut,
    elsewhere,
    onElsewhere,
  }: {
    explorer: DeficitsExplorer;
    view: View;
    /** Shows the `/` hint; false when single-key shortcuts are off. */
    showShortcut: boolean;
    /** The other tabs that find the same words (U1). */
    elsewhere: (query: string) => Elsewhere[];
    /** Carries the words to another tab. */
    onElsewhere: (mode: Explorer, query: string) => void | Promise<void>;
  } = $props();

  const clinical = $derived(explorer.deps.clinical);
  const uid = $props.id();
  const lang = $derived(view.lang);
  const text = $derived(t(lang, 'clinical'));
  const navigator = $derived(t(lang, 'navigator'));
  const query = $derived(view.clinicalQuery.trim());
  const groups = $derived(clinical.grouped(query, lang));
  const count = $derived(groups.reduce((sum, entry) => sum + entry.deficits.length, 0));
  const others = $derived(elsewhere(query));
  const near = $derived(groups.length === 0 ? clinical.nearest(query, lang) : null);

  /** Rows of the selected region's group before "Show all N". */
  const REGION_ROWS_SHOWN = 8;
  const regionId = $derived(view.selectedRegion?.id ?? null);
  // The selected region's deficits, each where the list below has it; a search shows the list alone.
  const atRegion = $derived.by(() => {
    if (!regionId || query) return [];
    const involving = new Set(deficitsForRegion(explorer, regionId));
    return groups.flatMap(({ deficits }) => deficits).filter(({ id }) => involving.has(id));
  });
  // Another region's group starts with its first rows again.
  let unfolded = $state(false);
  $effect.pre(() => {
    void regionId;
    unfolded = false;
  });
  const atRegionShown = $derived(unfolded ? atRegion : atRegion.slice(0, REGION_ROWS_SHOWN));
  let regionRows = $state<HTMLElement>();
  /** The command leaves once pressed, so focus goes to the first row it added. */
  async function showAllAtRegion() {
    unfolded = true;
    await tick();
    regionRows?.querySelectorAll<HTMLElement>('.row')[REGION_ROWS_SHOWN]?.focus();
  }

  // The count is said after typing pauses, for every settled query, a cleared one included, and
  // again when a different query settles on the same count (deviation x2-results-announcement).
  // A language change says nothing, so the sentence is read without tracking the language.
  const announcer = createDebouncedAnnouncer();
  $effect(() => () => announcer.dispose());
  let announcedQuery: string | null = null;
  $effect(() => {
    const settled = query;
    if (announcedQuery === null) {
      announcedQuery = settled;
      return;
    }
    if (settled === announcedQuery) return;
    announcedQuery = settled;
    announcer.reset();
    // The other tabs that match follow the count.
    announcer.say(
      untrack(() =>
        [text.results(count), ...others.map((other) => bridgeText(lang, other, settled))].join(
          '. ',
        ),
      ),
    );
  });

  let list = $state<HTMLElement>();
  $effect(() => {
    explorer.refs.list = list ?? null;
    return () => (explorer.refs.list = null);
  });
  $effect(() =>
    registerCurrentItem(
      () => list?.querySelector<HTMLElement>('.row[aria-current="true"]') ?? null,
    ),
  );
  $effect(() => {
    const field = explorer.refs.search;
    if (!list || !field) return;
    const nav = listNav(list, { field, rows: '.link-row, .row, .search-bridge, .show-all' });
    return () => nav.destroy();
  });
</script>

<div class="deficit-head">
  <h2 class="visually-hidden">{t(lang, 'workspace').modes.deficits}</h2>
  <DeficitSearch
    {explorer}
    query={view.clinicalQuery}
    label={text.searchLabel}
    clearLabel={navigator.clearSearch}
    {showShortcut}
    controls="{uid}-list"
    onquery={(value) => explorer.setQuery(value)}
  />
  <ScopeLine place="deficits" {lang} />
</div>
<div class="deficit-body scroll-fade">
  <div id="{uid}-list" role="group" aria-label={text.deficits} bind:this={list}>
    {#if explorer.clinicalLinks && !query}
      {@const links = explorer.clinicalLinks}
      <ul class="clinical-links">
        <li><LinkRow name={text.simulateLesion} onclick={links.simulateLesion} /></li>
        {#if links.showStrokeCases}
          <li><LinkRow name={t(lang, 'strokeCases').heading} onclick={links.showStrokeCases} /></li>
        {/if}
      </ul>
    {/if}
    {#if atRegion.length}
      <div class="group" role="group" aria-labelledby="{uid}-group-region" data-region-deficits>
        <h3 id="{uid}-group-region" class="group-heading">{text.atRegion}</h3>
        <ul class="rows" bind:this={regionRows}>
          {#each atRegionShown as deficit (deficit.id)}
            <li data-deficit={deficit.id}>
              <!-- Current only in its own group further down, where Back returns. -->
              <DrillRow
                name={deficit.name[lang]}
                secondary={deficit.domain[lang]}
                current={false}
                onclick={() => explorer.openDeficit(deficit.id)}
              />
            </li>
          {/each}
        </ul>
        {#if atRegionShown.length < atRegion.length}
          <ShowAll label={navigator.showAll(atRegion.length)} onclick={showAllAtRegion} />
        {/if}
      </div>
    {/if}
    {#each groups as { group, deficits } (group.id)}
      <div class="group" role="group" aria-labelledby="{uid}-group-{group.id}">
        <h3 id="{uid}-group-{group.id}" class="group-heading">{group.name[lang]}</h3>
        <ul class="rows">
          {#each deficits as deficit (deficit.id)}
            <li data-deficit={deficit.id}>
              <DrillRow
                name={deficit.name[lang]}
                secondary={deficit.domain[lang]}
                current={view.selectedDeficit === deficit.id}
                onclick={() => explorer.openDeficit(deficit.id)}
              />
            </li>
          {/each}
        </ul>
      </div>
    {/each}
    {#if groups.length === 0}
      <EmptyState title={navigator.noMatch(query)} message={text.noResults} />
      {#if near}
        <SearchBridge
          text={t(lang, 'functions').suggest(near)}
          onclick={() => {
            explorer.setQuery(near);
            explorer.refs.search?.focus();
          }}
        />
      {/if}
    {/if}
    {#each others as other (other.mode)}
      <SearchBridge
        text={bridgeText(lang, other, query)}
        onclick={() => onElsewhere(other.mode, query)}
      />
    {/each}
  </div>
  <!-- The collection's scope stands under the whole list; a search shows no scope. -->
  {#if !query}
    <p class="scope-note">
      {text.coverage.replace('{count}', String(clinical.search('', lang).length))}
    </p>
    <AboutData place="deficits" {lang} host="list" />
  {/if}
</div>

<style>
  @layer features {
    /* The search is the task's starting point: its controls share one rhythm (layout.css:122-130). */
    .deficit-head {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      flex: none;
      padding: var(--space-3) var(--panel-inset);
      border-bottom: 1px solid var(--border-subtle);
      background: var(--surface-base);
    }
    .group {
      isolation: isolate;
    }
    /* The tab's clinical tools, on the text column above the groups, as a region's related findings are. */
    .clinical-links {
      margin: 0;
      padding: var(--space-2) var(--panel-inset);
      list-style: none;
    }
    .group + .group {
      margin-top: var(--space-2);
    }
    /* Stuck 1px above the top, a caption's own rule slips under the list's edge (clinical.css:20-35). */
    .group-heading {
      position: sticky;
      top: -1px;
      z-index: 1;
      margin: 0;
      padding: var(--space-4) var(--panel-inset) var(--space-1);
      border-top: 1px solid var(--border-subtle);
      background: var(--surface-base);
      font-size: var(--text-caption);
      font-weight: 600;
      line-height: var(--lh-caption);
      color: var(--text-secondary);
    }
    .group:first-child > .group-heading {
      padding-top: var(--space-3);
      border-top: 0;
    }
    .rows {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    /* DrillRow has no selected look of its own (navigator.css:31). */
    /* Arrow navigation keeps the focused row below its sticky group heading (clinical.css:44). */
    .rows :global(.row) {
      scroll-margin-block-start: calc(var(--lh-caption) + var(--space-6));
    }
    .rows :global(.row[data-selected='true']) {
      background: var(--accent-wash);
      color: var(--accent);
      font-weight: 600;
    }
    .rows :global(.row[data-selected='true'] .secondary) {
      color: inherit;
      font-weight: 400;
    }
    @media (hover: hover) and (pointer: fine) {
      .rows :global(.row[data-selected='true']:hover) {
        background: var(--accent-wash);
      }
    }
    /* A list's scope: one tertiary line at its foot (clinical.css:50-60). */
    .scope-note {
      margin: 0;
      padding: var(--space-3) var(--panel-inset) var(--space-4);
      border-top: 1px solid var(--border-subtle);
      color: var(--text-tertiary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      font-variant-numeric: tabular-nums;
      text-wrap: pretty;
    }
  }
</style>
