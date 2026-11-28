<!--
  One association (clinical.js:128-190): its title and the colour its regions take on the brain, its
  mapped regions always in reach, and its evidence behind a disclosure (APG Disclosure on the native
  <details>). `sideOnRow` is false when the profile states the one side all its associations share.
  The summary reads "Evidence" and, to a screen reader, which association (deviation
  x2-evidence-summary-name), so the page does not list the same name once per association.
-->
<script lang="ts">
  import type { createCatalog } from '../../lib/core/catalog/catalog.ts';
  import { networkCss } from '../../lib/core/catalog/networks.ts';
  import type { ClinicalCatalog } from '../../lib/core/clinical/catalog.ts';
  import type { ClinicalAssociation } from '../../lib/core/clinical/types.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import { sideStated } from '../../lib/core/panels/clinical.ts';
  import type { Language, Rgb } from '../../lib/types/index.ts';
  import Swatch from '../../lib/ui/Swatch.svelte';
  import Publication from './Publication.svelte';

  let {
    association,
    lang,
    color,
    sideOnRow,
    open = $bindable(false),
    opening,
    pressed,
    clinical,
    anatomy,
    onselect,
    onregion,
  }: {
    association: ClinicalAssociation;
    lang: Language;
    color: Rgb;
    sideOnRow: boolean;
    open?: boolean;
    /** A deficit is opening: region buttons stay focusable, say they are unavailable and do nothing. */
    opening: boolean;
    pressed: boolean;
    clinical: ClinicalCatalog;
    anatomy: Pick<ReturnType<typeof createCatalog>, 'get'>;
    onselect?: () => void;
    onregion: (id: string, trigger: HTMLButtonElement) => void;
  } = $props();

  const text = $derived(t(lang, 'clinical'));
  const sides = $derived(t(lang, 'sides').capitalized);
  const entries = $derived.by(() => {
    // The catalog rebuilds its labels when the language changes, so entries read earlier are stale.
    void lang;
    return association.mappings.map(({ region }) => {
      const entry = anatomy.get(region);
      if (!entry) throw new Error(`Unknown region: ${region}`);
      return { id: region, entry };
    });
  });
  const stated = $derived(
    sideStated(
      association.laterality,
      entries.map(({ entry }) => entry.region.hemisphere),
    ),
  );
</script>

{#snippet titleContent()}
  <!-- The colour this finding's regions take on the brain, as the stage key shows it. -->
  <span class="mark"><Swatch colour={networkCss(color)} /></span>
  <span class="name">{association.title[lang]}</span>
  <!-- The short side reads on screen; a screen reader hears the full one even when the profile states it. -->
  {#if sideOnRow}
    <span class="side" aria-hidden="true">{text.lateralityShort[association.laterality]}</span>
  {/if}
  <span class="visually-hidden">{` · ${text.laterality[association.laterality]}`}</span>
{/snippet}

<article class="association" data-association={association.id}>
  <h4 class="title">
    {#if onselect}
      <button
        type="button"
        class="title-content finding-pick"
        aria-pressed={pressed}
        aria-disabled={opening || undefined}
        onclick={() => !opening && onselect()}
      >
        {@render titleContent()}
      </button>
    {:else}
      <span class="title-content">{@render titleContent()}</span>
    {/if}
  </h4>

  <div class="regions">
    {#each entries as { id, entry } (id)}
      {@const full = `${entry.label.name} · ${sides[entry.region.hemisphere]}`}
      <button
        type="button"
        class="region"
        data-clinical-region={id}
        aria-label="{text.openRegion}: {full}"
        aria-disabled={opening ? 'true' : undefined}
        onclick={(event) => onregion(id, event.currentTarget)}
      >
        {stated ? entry.label.name : full}
      </button>
    {/each}
    {#if !association.mappings.length}<p class="note">{text.mappingEmpty}</p>{/if}
  </div>

  <details class="evidence" bind:open>
    <summary>
      {text.findings}<span class="visually-hidden">{`, ${association.title[lang]}`}</span>
    </summary>
    <div class="body">
      <p class="note">{association.network[lang]}</p>
      <h5>{text.studyFinding}</h5>
      <p>{association.finding[lang]}</p>
      <h5>{text.limits}</h5>
      <p>{association.limitation[lang]}</p>
      <h5>{text.mapping}</h5>
      <p class="note">{association.mapping_note[lang]}</p>
      <h5>{text.evidence} · {association.evidence.length}</h5>
      {#each association.evidence as item (item.reference)}
        <Publication reference={clinical.reference(item.reference)} role={item.role} {lang} />
      {/each}
    </div>
  </details>
</article>

<style>
  @layer features {
    .association {
      padding: var(--space-4) 0;
    }
    .association + :global(.association),
    :global(.findings-heading) + .association {
      border-top: 1px solid var(--border-subtle);
    }
    p {
      margin: 0;
    }
    .title {
      margin: 0;
      font-size: var(--text-ui);
      font-weight: 600;
      line-height: var(--lh-ui);
      text-wrap: pretty;
    }
    .title-content {
      display: flex;
      align-items: baseline;
      gap: var(--space-2);
    }
    .finding-pick {
      min-height: var(--control-height);
      padding: var(--space-1) var(--space-2);
      margin-inline: calc(-1 * var(--space-2));
      width: calc(100% + 2 * var(--space-2));
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-control);
      background: none;
      color: inherit;
      font: inherit;
      text-align: start;
      cursor: pointer;
    }
    .finding-pick[aria-pressed='true'] {
      border-color: var(--accent);
      background: var(--accent-wash);
      color: var(--accent);
    }
    .finding-pick[aria-disabled='true'] {
      cursor: default;
    }
    .mark {
      flex: none;
      align-self: flex-start;
      margin: calc((var(--lh-ui) - 10px) / 2) 1px 0;
    }
    .mark :global(.network-swatch) {
      margin-top: 0;
    }
    .name {
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .side {
      flex: none;
      color: var(--text-tertiary);
      font-size: var(--text-caption);
      font-weight: 400;
      line-height: var(--lh-caption);
    }
    .regions,
    .body {
      padding-left: calc(var(--indent) - var(--panel-inset));
    }
    .regions {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      margin-top: var(--space-1);
    }
    .region {
      max-width: 100%;
      height: auto;
      min-height: var(--row-height);
      padding: var(--space-1) 0;
      border: 0;
      border-radius: 0;
      background: none;
      color: var(--accent);
      text-align: left;
      white-space: normal;
      overflow-wrap: anywhere;
      font-weight: 400;
      line-height: var(--lh-ui);
      cursor: pointer;
    }
    .region[aria-disabled='true'] {
      color: var(--text-tertiary);
      cursor: default;
    }
    .region:focus-visible {
      outline-offset: 0;
    }
    .regions > .note {
      padding: var(--space-1) 0;
    }
    .note {
      color: var(--text-secondary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
    summary {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-height: 32px;
      list-style: none;
      cursor: pointer;
      font-size: var(--text-ui);
      font-weight: 400;
      line-height: var(--lh-ui);
      color: var(--text-secondary);
    }
    summary::-webkit-details-marker {
      display: none;
    }
    /* The one chevron, as U4's Disclosure draws it. */
    summary::before {
      content: '';
      flex: none;
      width: 6px;
      height: 6px;
      margin: 0 3px;
      color: var(--text-tertiary);
      border-right: 1.5px solid currentColor;
      border-bottom: 1.5px solid currentColor;
      transform: rotate(var(--chevron-turn, 0deg)) translateX(-1.6px) rotate(-45deg);
      transition: transform var(--ui-transition) var(--ease-ui);
    }
    details[open] > summary {
      --chevron-turn: 90deg;
    }
    summary:focus-visible {
      outline-offset: -2px;
    }
    .body {
      padding-bottom: var(--space-2);
    }
    h5 {
      margin: var(--space-4) 0 var(--space-1);
      color: var(--text-secondary);
      font-size: var(--text-caption);
      font-weight: 600;
      line-height: var(--lh-caption);
    }
    h5 + :global(.publication) {
      margin-top: var(--space-2);
    }
    @media (hover: hover) and (pointer: fine) {
      .finding-pick:hover:not([aria-disabled='true'], [aria-pressed='true']) {
        background: var(--surface-hover);
      }
      .region:hover:not([aria-disabled='true']) {
        color: var(--accent-hover);
        text-decoration: underline;
        text-underline-offset: 3px;
      }
      summary:hover {
        color: var(--accent);
      }
    }
    /* WCAG 2.5.8: touch gets 44px targets. */
    @media (pointer: coarse) {
      .region,
      summary {
        min-height: 44px;
      }
    }
  }
  @layer a11y {
    @media (prefers-reduced-motion: reduce) {
      summary::before {
        transition: none;
      }
    }
    @media (forced-colors: active) {
      .finding-pick[aria-pressed='true'] {
        outline: 1px solid Highlight;
        outline-offset: -1px;
      }
    }
  }
</style>
