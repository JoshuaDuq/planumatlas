<!--
  Resting functional connectivity for a Julich-Brain area (plan 4.1): its ten strongest partners in the
  group mean of 200 HCP young adults, each name selecting that area. "Paint on the brain" colours every
  partner on the stage from this area, an excursion a ruled strip names and Restore ends. Only a region
  with a row has the section; it stays mounted so its open state survives a new selection.
-->
<script lang="ts">
  import type { Language, Region } from '../../lib/types/index.ts';
  import type { RegionLabel } from '../../lib/core/catalog/labels.ts';
  import {
    hasConnectivity,
    partnersOf,
    type FunctionalConnectivity,
  } from '../../lib/core/catalog/functional-connectivity.ts';
  import { decimal } from '../../lib/core/format.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import Disclosure from '../../lib/ui/Disclosure.svelte';
  import { iconGraphic } from '../../lib/ui/IconButton.svelte';
  import Swatch from '../../lib/ui/Swatch.svelte';

  let {
    region,
    lang,
    connectivity,
    catalog,
    painted,
    onselect,
    onpaint,
    onrestore,
  }: {
    region: Region | null;
    lang: Language;
    connectivity: FunctionalConnectivity | null;
    catalog: { get: (id: string) => { region: Region; label: RegionLabel } | null };
    /** The area whose connectivity the stage shows now, or null. */
    painted: string | null;
    onselect: (id: string) => void;
    /** Paints from an area; null where the stage cannot show it (another tab than Anatomy). */
    onpaint: ((id: string) => void) | null;
    onrestore: () => void;
  } = $props();

  const SHOWN = 10;
  let open = $state(false);

  const copy = $derived(t(lang, 'connectivity'));
  // Partners lie on both sides, so each name carries its hemisphere.
  const name = (id: string) => {
    const { region: area, label } = catalog.get(id)!;
    return `${label.name} · ${t(lang, 'sides').words[area.hemisphere]}`;
  };
  const seed = $derived(region && hasConnectivity(connectivity, region.id) ? region.id : null);
  const partners = $derived(seed ? partnersOf(connectivity!, seed).slice(0, SHOWN) : []);
</script>

{#if seed}
  <div class="evidence-section">
    <Disclosure variant="section" summary={copy.heading} value={copy.headingValue} bind:open>
      <p class="network-map">{copy.strongest}</p>
      <ul class="network-list" data-connectivity-partners>
        {#each partners as partner (partner.region)}
          <li class="network-row connectivity-row">
            <button
              type="button"
              class="network-row-name connectivity-partner"
              onclick={() => onselect(partner.region)}>{name(partner.region)}</button
            >
            <Swatch kind="bar" share={Math.max(partner.r, 0)} />
            <span class="network-share measure">{decimal(partner.r, 2, lang)}</span>
          </li>
        {/each}
      </ul>
      {#if painted}
        <div class="connectivity-status" role="status">
          <p>{copy.shown(name(painted))}</p>
          <button type="button" class="connectivity-restore" onclick={onrestore}>
            {t(lang, 'clinical').restore}
          </button>
        </div>
      {/if}
      {#if onpaint && painted !== seed}
        <button type="button" class="connectivity-paint" onclick={() => onpaint(seed)}>
          {copy.paint}
        </button>
      {/if}
      <p class="detail-note">{copy.note(connectivity!.people, connectivity!.ages)}</p>
      <p class="detail-note">{copy.basis}</p>
      <div class="stimulation-sources">
        <a href={connectivity!.source.dataset} target="_blank" rel="noopener noreferrer"
          >{copy.dataset}<span class="visually-hidden">{` ${t(lang, 'link').newTab}`}</span
          >{@render iconGraphic('external-link')}</a
        >
        <a
          href="https://pubmed.ncbi.nlm.nih.gov/{connectivity!.source.pmid}/"
          target="_blank"
          rel="noopener noreferrer"
          >{copy.paper}<span class="visually-hidden">{` ${t(lang, 'link').newTab}`}</span
          >{@render iconGraphic('external-link')}</a
        >
      </div>
    </Disclosure>
  </div>
{/if}

<style>
  @layer features {
    /* A partner's name is a quiet text command, as a boundary neighbour's is. */
    .connectivity-partner {
      all: unset;
      cursor: pointer;
      text-align: left;
      overflow-wrap: anywhere;
    }
    .connectivity-partner:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    /* The tonal command of the sheet, as the Linked MRI's. */
    .connectivity-paint {
      min-height: var(--control-height);
      margin-top: var(--space-3);
      padding: var(--space-1) var(--space-3);
      border: 1px solid transparent;
      border-radius: var(--radius-control);
      background: var(--surface-tonal);
      color: var(--accent);
      font-size: var(--text-ui);
      font-weight: 500;
      line-height: var(--lh-ui);
      cursor: pointer;
      transition:
        background-color var(--ui-transition) var(--ease-ui),
        transform var(--press-transition) var(--ease-ui);
    }
    .connectivity-paint:active:not(:focus-visible) {
      transform: scale(var(--press-scale));
    }
    /* A ruled strip says what the stage shows, with the way back beside it. */
    .connectivity-status {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-1) var(--space-3);
      margin-top: var(--space-3);
      padding: var(--space-2) 0;
      border-block: 1px solid var(--border-subtle);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
    .connectivity-status p {
      margin: 0;
      color: var(--text-secondary);
    }
    .connectivity-restore {
      min-height: 32px;
      padding: 0;
      border: 0;
      background: none;
      color: var(--accent);
      font: inherit;
      cursor: pointer;
    }
    @media (hover: hover) and (pointer: fine) {
      .connectivity-partner:hover {
        color: var(--accent);
      }
      .connectivity-paint:hover {
        background: var(--surface-tonal-hover);
        color: var(--accent-hover);
      }
      .connectivity-restore:hover {
        color: var(--accent-hover);
        text-decoration: underline;
        text-underline-offset: 3px;
      }
    }
    @media (pointer: coarse) {
      .connectivity-paint,
      .connectivity-restore {
        min-height: 44px;
      }
    }
  }
</style>
