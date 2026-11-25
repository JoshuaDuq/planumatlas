<!--
  The Circuits tab's list (viewer/ui/panels/circuits.js:150-165, 328-335, index.html:309-312): the
  guided circuits as rows, each opening a lesson, and the list's scope. A list of buttons;
  every row is a Tab stop, and ArrowDown and ArrowUp walk the rows.
  - the open circuit is `aria-current="true"`: a row opens a lesson, it does not toggle
    (deviations/x3-current-circuit.md);
  - the labelled list is a real group of `ul` (deviations/x3-list-structure.md);
  - while a run is in flight a row stays focusable and refuses (deviations/x3-busy-keeps-focus.md).
-->
<script lang="ts">
  import { t, templateCopy } from '../../lib/core/i18n/index.ts';
  import { registerCurrentItem } from '../../lib/core/workspace.ts';
  import type { CircuitExplorer } from './circuits-explorer.svelte.ts';
  import { landmarkTotal } from './circuits-view.ts';
  import { neighbourKeys } from './neighbour-keys.ts';
  import AboutData from '../info/AboutData.svelte';

  let { model }: { model: CircuitExplorer } = $props();
  const map = $derived(model.map);

  const uid = $props.id();
  const copy = $derived(t(model.lang, 'circuits'));
  const maps = $derived(t(model.lang, 'visualField'));
  let listElement = $state<HTMLElement | null>(null);

  $effect(() => {
    if (listElement) return model.attachList(listElement);
  });
  $effect(() => {
    if (listElement) return neighbourKeys(listElement);
  });
  $effect(() =>
    registerCurrentItem(
      () => listElement?.querySelector<HTMLElement>('[aria-current="true"]') ?? null,
    ),
  );
</script>

<div class="browser scroll-fade" hidden={!model.exploring}>
  <h2 class="visually-hidden">{t(model.lang, 'workspace').modes.circuits}</h2>
  <div role="group" aria-label={copy.heading} bind:this={listElement}>
    <div class="group" role="group" aria-labelledby="{uid}-guided">
      <h3 id="{uid}-guided" class="group-heading group-heading-counts">
        <span>{maps.guided}</span>
        <span class="column-head" aria-hidden="true">{copy.landmarks}</span>
      </h3>
      <ul class="rows" role="list">
        {#each model.circuits as circuit (circuit.id)}
          {@const current = circuit.id === model.lesson.circuit}
          <li>
            <button
              type="button"
              class="circuit-choice"
              data-circuit={circuit.id}
              aria-current={current ? 'true' : undefined}
              aria-disabled={model.busy ? 'true' : undefined}
              data-selected={String(current)}
              onclick={() => model.openCircuit(circuit.id)}
            >
              <span class="text guided-text">
                <span class="row-name">{circuit.name[model.lang]}</span>
                <span class="route">{circuit.route[model.lang]}</span>
              </span>
              <span class="group-count" aria-hidden="true">{circuit.steps.length}</span>
              <span class="visually-hidden">, {copy.landmarkCount(circuit.steps.length)}</span>
              <span class="chevron" aria-hidden="true"></span>
            </button>
          </li>
        {/each}
      </ul>
    </div>
    {#if map.available}
      <div class="group" role="group" aria-labelledby="{uid}-maps">
        <h3 id="{uid}-maps" class="group-heading">{maps.maps}</h3>
        <ul class="rows" role="list">
          <li>
            <button
              type="button"
              class="circuit-choice"
              data-map="visual-field"
              aria-current={map.open ? 'true' : undefined}
              aria-disabled={model.busy ? 'true' : undefined}
              data-selected={String(map.open)}
              onclick={() => void model.openMap()}
            >
              <span class="text">
                <span class="row-name">{maps.name}</span>
                <span class="route">{maps.summary}</span>
              </span>
              <span class="chevron" aria-hidden="true"></span>
            </button>
          </li>
        </ul>
      </div>
    {/if}
  </div>
  <p class="scope-note">
    {copy.coverage(model.circuits.length, landmarkTotal(model.circuits))}{map.available
      ? ` · ${maps.mapCount(1)}`
      : ''}{model.unavailable
      ? ` · ${templateCopy(model.lang).circuitsElsewhere(model.unavailable)}`
      : ''}
  </p>
  <AboutData place="circuits" lang={model.lang} host="list" />
</div>

<style>
  @layer features {
    .rows {
      margin: 0;
      padding: 0 0 var(--space-2);
      list-style: none;
    }
    .group-heading {
      margin: 0;
      padding: var(--space-4) var(--panel-inset) var(--space-1);
      border-top: 1px solid var(--border-subtle);
      color: var(--text-secondary);
      font-size: var(--text-caption);
      font-weight: 600;
      line-height: var(--lh-caption);
    }
    .group-heading-counts {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-3);
      padding-inline-end: calc(var(--panel-inset) + var(--space-5));
    }
    .column-head {
      flex: none;
      color: var(--text-tertiary);
      font-weight: 400;
      white-space: nowrap;
    }
    .group:first-child > .group-heading {
      padding-top: var(--space-3);
      border-top: 0;
    }
    .circuit-choice {
      position: relative;
      display: flex;
      align-items: center;
      gap: var(--space-2);
      width: 100%;
      min-height: var(--row-height);
      height: auto;
      margin: 0;
      padding: var(--space-2) var(--panel-inset);
      border: 0;
      border-radius: 0;
      background: transparent;
      color: var(--text-primary);
      font-size: var(--text-ui);
      font-weight: 400;
      line-height: var(--lh-ui);
      text-align: left;
      transition: background-color var(--ui-transition) var(--ease-ui);
    }
    .circuit-choice:focus-visible {
      outline-offset: -2px;
    }
    .circuit-choice[data-selected='true'] {
      background: var(--accent-wash);
      color: var(--accent);
      font-weight: 600;
    }
    .circuit-choice[aria-disabled='true'] {
      color: var(--text-tertiary);
      cursor: default;
    }
    /* The route under the name says what the lesson walks through before it is opened. */
    .text {
      display: grid;
      flex: 1;
      min-width: 0;
    }
    .row-name {
      overflow-wrap: anywhere;
      text-wrap: pretty;
      font-weight: 500;
    }
    .route {
      color: var(--text-secondary);
      font-size: var(--text-caption);
      font-weight: 400;
      line-height: var(--lh-caption);
      text-wrap: pretty;
    }
    /* The full route appears at the start of the lesson. */
    .guided-text .route {
      display: -webkit-box;
      overflow: hidden;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      text-wrap: wrap;
    }
    .circuit-choice[data-selected='true'] .row-name {
      font-weight: 600;
    }
    .circuit-choice[data-selected='true'] .route {
      color: inherit;
    }
    /* Counts stay on the same edge as their column heading, including on hover and focus. */
    .group-count {
      flex: none;
      align-self: flex-start;
      min-width: 2ch;
      margin-top: calc((var(--lh-ui) - var(--lh-caption)) / 2);
      margin-left: auto;
      color: var(--text-tertiary);
      font-size: var(--text-caption);
      font-weight: 400;
      line-height: var(--lh-caption);
      font-variant-numeric: tabular-nums;
      text-align: right;
      white-space: nowrap;
    }
    .circuit-choice[data-selected='true'] .group-count {
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
    .circuit-choice[aria-current='true'] .chevron {
      color: inherit;
    }
    /* Keep the chevron's gutter even when it is quiet, so it never takes the count's place. */
    @media (hover: hover) and (pointer: fine) {
      .chevron {
        opacity: 0;
      }
      .circuit-choice:hover:not([data-selected='true'], [aria-disabled='true']) {
        background: var(--surface-hover);
      }
      .circuit-choice:hover .chevron {
        opacity: 1;
        transition: opacity var(--ui-transition) var(--ease-ui);
      }
      .circuit-choice:focus-visible .chevron,
      .circuit-choice[aria-current='true'] .chevron {
        opacity: 1;
      }
    }
    /* After the hover rule, which shares its weight: a pointer press tints the row at once. */
    .circuit-choice:active:not([data-selected='true'], [aria-disabled='true'], :focus-visible) {
      background: var(--surface-pressed);
      transition-duration: 0s;
    }
    @media (pointer: coarse) {
      .circuit-choice {
        min-height: 44px;
      }
    }
    /* A list's scope: one tertiary line at its foot. */
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
      .circuit-choice[data-selected='true'] {
        outline: 2px solid Highlight;
        outline-offset: -2px;
      }
    }
  }
</style>
