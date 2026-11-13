<!--
  ENIGMA's case–control differences in a region: every disorder whose difference in this region's
  cortical thickness or volume survives its table's false discovery rate, largest first. A row paints
  its disorder on Desikan-Killiany, an excursion a ruled strip names and Restore ends. Only a region
  the tables report has the section; it stays mounted so its open state survives a new selection.
-->
<script lang="ts">
  import type { Language, Region } from '../../lib/types/index.ts';
  import {
    dColor,
    effectsOf,
    reportedRegion,
    type DisorderEffects,
  } from '../../lib/core/catalog/disorder-effects.ts';
  import { decimal, grouped, percent } from '../../lib/core/format.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import Disclosure from '../../lib/ui/Disclosure.svelte';
  import { iconGraphic } from '../../lib/ui/IconButton.svelte';
  import Swatch from '../../lib/ui/Swatch.svelte';

  let {
    region,
    lang,
    disorders,
    units,
    painted,
    onpaint,
    onrestore,
  }: {
    region: Region | null;
    lang: Language;
    disorders: DisorderEffects | null;
    /** Teaching-set unit to the aseg structure it stands in for (neuropsych-domains.json). */
    units: Readonly<Record<string, string>>;
    /** The disorder the stage paints now, or null. */
    painted: string | null;
    /** Paints a disorder; null where the stage cannot show it (another tab than Anatomy). */
    onpaint: ((id: string) => void) | null;
    onrestore: () => void;
  } = $props();

  let open = $state(false);

  const copy = $derived(t(lang, 'disorders'));
  const reported = $derived(region ? reportedRegion(disorders, region.id, units) : null);
  const effects = $derived(reported ? effectsOf(disorders!, reported) : []);
  const measure = $derived(reported?.startsWith('aseg:') ? 'volume' : 'thickness');
  const shown = $derived(disorders?.disorders.find((disorder) => disorder.id === painted) ?? null);
  const color = (d: number) => `rgb(${dColor(disorders!, d).join(' ')})`;
</script>

{#if reported}
  <div class="evidence-section">
    <Disclosure
      variant="section"
      summary={copy.heading}
      value={copy.headingValue(effects.length)}
      bind:open
    >
      <p class="network-map disorder-measure">{copy.measure[measure]}</p>
      {#if effects.length}
        <ul class="network-list" data-disorder-effects>
          {#each effects as { disorder, d } (disorder.id)}
            {@const name = disorder.name[lang]}
            {@const population = disorder.measures[measure].population?.[lang]}
            {@const direction = copy.direction[measure][d < 0 ? 'smaller' : 'larger']}
            {@const meta = [direction, population].filter(Boolean).join(' · ')}
            <li class="network-row disorder-row">
              <Swatch colour={color(d)} />
              {#if onpaint}
                <button
                  type="button"
                  class="network-row-name disorder-name"
                  aria-pressed={painted === disorder.id}
                  aria-label={copy.paint(name)}
                  onclick={() => onpaint(disorder.id)}
                  >{name} <span class="disorder-meta">{meta}</span></button
                >
              {:else}
                <span class="network-row-name"
                  >{name} <span class="disorder-meta">{meta}</span></span
                >
              {/if}
              <span class="network-share measure">{decimal(d, 2, lang)}</span>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="detail-note">{copy.none}</p>
      {/if}
      {#if shown}
        {@const cohort = shown.measures[measure]}
        <div class="disorder-status" role="status">
          <p>
            {copy.shown(shown.name[lang])}
            {#if cohort.patients !== null && cohort.controls !== null}
              {copy.cohort(grouped(cohort.patients), grouped(cohort.controls))}.
            {/if}
            <a
              href="https://pubmed.ncbi.nlm.nih.gov/{cohort.pmid}/"
              target="_blank"
              rel="noopener noreferrer"
              >{copy.paper}<span class="visually-hidden">{` ${t(lang, 'link').newTab}`}</span
              >{@render iconGraphic('external-link')}</a
            >
          </p>
          <button type="button" class="disorder-restore" onclick={onrestore}>
            {t(lang, 'clinical').restore}
          </button>
        </div>
      {/if}
      <p class="detail-note">{copy.note(percent(disorders!.false_discovery_rate, lang))}</p>
      <p class="detail-note">{copy.basis[measure]}</p>
      <div class="stimulation-sources">
        <a
          href="{disorders!.source.repository}/tree/{disorders!.source.commit}"
          target="_blank"
          rel="noopener noreferrer"
          >{copy.toolbox}<span class="visually-hidden">{` ${t(lang, 'link').newTab}`}</span
          >{@render iconGraphic('external-link')}</a
        >
      </div>
    </Disclosure>
  </div>
{/if}

<style>
  @layer features {
    /* A disorder's name is a quiet text command that paints it, as a connectivity partner's selects. */
    .disorder-name {
      all: unset;
      cursor: pointer;
      text-align: left;
      overflow-wrap: anywhere;
    }
    .disorder-name:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    .disorder-name[aria-pressed='true'] {
      color: var(--accent);
      font-weight: 500;
    }
    .disorder-meta {
      display: block;
      color: var(--text-secondary);
      font-size: var(--text-caption);
      font-weight: 400;
      line-height: var(--lh-caption);
    }
    /* The swatch, the name over its direction and population, d at the edge. */
    .disorder-row {
      grid-template-columns: 10px minmax(0, 1fr) 3rem;
    }
    /* Two even lines rather than "(Cohen's d)" alone on the second. */
    .disorder-measure {
      text-wrap: balance;
    }
    /* A ruled strip says what the stage shows, with the way back beside it. */
    .disorder-status {
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
    .disorder-status p {
      margin: 0;
      color: var(--text-secondary);
    }
    .disorder-restore {
      min-height: 32px;
      padding: 0;
      border: 0;
      background: none;
      color: var(--accent);
      font: inherit;
      cursor: pointer;
    }
    @media (hover: hover) and (pointer: fine) {
      .disorder-name:hover {
        color: var(--accent);
      }
      .disorder-restore:hover {
        color: var(--accent-hover);
        text-decoration: underline;
        text-underline-offset: 3px;
      }
    }
    @media (pointer: coarse) {
      .disorder-restore {
        min-height: 44px;
      }
    }
  }
</style>
