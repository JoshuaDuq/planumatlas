<!--
  BigBrain's cortical layers at a cortical parcel: a bar in six parts, I to VI, with each
  layer's share of the thickness, and where the parcel is a Julich-Brain area with cell counts, the cells
  per (0.1 mm)³ by layer and the number of patches. In Anatomy a tonal command paints layer IV's share
  across the cortex, an excursion a ruled strip names and Restore ends, as a disorder's paint is. The
  file is downloaded when a cortical region is first shown; a parcel without shares has no section.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import type { Language, Region } from '../../lib/types/index.ts';
  import {
    cellsOf,
    LAYER_IV,
    LAYERS,
    layerIvStep,
    sharesOf,
  } from '../../lib/core/catalog/cortical-layers.ts';
  import { decimal, withUnit } from '../../lib/core/format.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import type { CorticalLayersStore } from '../../lib/state/cortical-layers.svelte.ts';
  import Disclosure from '../../lib/ui/Disclosure.svelte';
  import { iconGraphic } from '../../lib/ui/IconButton.svelte';

  let {
    region,
    lang,
    layers,
    painted,
    onpaint,
    onrestore,
  }: {
    region: Region | null;
    lang: Language;
    /** The anatomy's published layers; null where it publishes none. */
    layers: CorticalLayersStore | null;
    /** The stage paints layer IV's share now. */
    painted: boolean;
    /** Paints layer IV's share; null where the stage cannot show it (another tab than Anatomy). */
    onpaint: (() => void) | null;
    onrestore: () => void;
  } = $props();

  let open = $state(false);

  const copy = $derived(t(lang, 'layers'));
  const cortical = $derived(region?.kind === 'cortex');
  // Read nothing of the store here: the download's own state must not run this again.
  $effect(() => {
    const store = layers;
    if (cortical && store) untrack(() => store.load());
  });
  const data = $derived(layers?.data ?? null);
  const shares = $derived(region && data ? sharesOf(data, region.id) : null);
  const cells = $derived(region && data ? cellsOf(data, region.id) : null);
  const failed = $derived(cortical && layers?.state.status === 'error');
  const share = (fraction: number) => withUnit(decimal(fraction * 100, 1, lang), '%', lang);
  const ivColor = $derived(
    data && shares
      ? `rgb(${data.layer_iv_scale[layerIvStep(data, shares[LAYER_IV]!)]!.color.join(' ')})`
      : null,
  );
  const sources = $derived(
    data
      ? [
          { href: data.source.paper, label: copy.paper },
          { href: data.source.collection, label: copy.collection },
          ...(cells ? [{ href: cells.doi, label: copy.cellData }] : []),
        ]
      : [],
  );
</script>

{#if shares || failed}
  <div class="evidence-section">
    <Disclosure
      variant="section"
      summary={copy.heading}
      value={shares ? copy.headingValue(share(shares[LAYER_IV]!)) : null}
      bind:open
    >
      {#if shares && data}
        <div class="layers-bar" aria-hidden="true">
          {#each LAYERS as layer, index (layer)}
            <span class="layers-part" style:flex-grow={shares[index]}>
              <span
                class="layers-fill"
                class:layers-iv={index === LAYER_IV}
                style:--layers-iv={index === LAYER_IV ? ivColor : null}
              ></span>
              <span class="layers-numeral">{layer}</span>
            </span>
          {/each}
        </div>
        <table class="layers-table" data-cortical-layers>
          <caption class="visually-hidden">{copy.tableCaption}</caption>
          <thead>
            <tr>
              <th scope="col">{copy.columns.layer}</th>
              <th scope="col">{copy.columns.share}</th>
              {#if cells}<th scope="col">{copy.columns.cells}</th>{/if}
            </tr>
          </thead>
          <tbody>
            {#each LAYERS as layer, index (layer)}
              <tr>
                <th scope="row">{layer}</th>
                <td>{share(shares[index]!)}</td>
                {#if cells}
                  <td>
                    {decimal(cells.mean[index], 0, lang)} ± {decimal(cells.sd[index], 0, lang)}
                  </td>
                {/if}
              </tr>
            {/each}
          </tbody>
        </table>
        {#if cells}<p class="detail-note">{copy.patches(cells.patches, cells.area)}</p>{/if}
        {#if painted}
          <div class="layers-status" role="status">
            <p>{copy.shown}</p>
            <button type="button" class="layers-restore" onclick={onrestore}>
              {t(lang, 'clinical').restore}
            </button>
          </div>
        {:else if onpaint}
          <button type="button" class="layers-paint" onclick={onpaint}>{copy.paint}</button>
        {/if}
        <p class="detail-note">{copy.note}</p>
        <p class="detail-note">{copy.basis}</p>
        <div class="stimulation-sources">
          {#each sources as { href, label } (href)}
            <a {href} target="_blank" rel="noopener noreferrer">
              {label}<span class="visually-hidden">
                {` ${t(lang, 'link').newTab}`}
              </span>{@render iconGraphic('external-link')}
            </a>
          {/each}
        </div>
      {:else}
        <p class="detail-note">{copy.failed}</p>
        <button type="button" class="layers-paint" onclick={() => layers!.retry()}>
          {copy.retry}
        </button>
      {/if}
    </Disclosure>
  </div>
{/if}

<style>
  @layer features {
    /* Six parts in proportion, layer IV in its paint step's colour, the numerals under them. */
    .layers-bar {
      display: flex;
      gap: 1px;
      margin-top: var(--space-2);
    }
    .layers-part {
      display: flex;
      flex-direction: column;
      min-width: 0;
      flex-basis: 0;
    }
    .layers-fill {
      height: 12px;
      background: var(--surface-pressed);
    }
    .layers-part:nth-child(even) .layers-fill {
      background: var(--border-control);
    }
    .layers-part .layers-fill.layers-iv {
      background: var(--layers-iv);
    }
    .layers-numeral {
      overflow: hidden;
      color: var(--text-secondary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      text-align: center;
      text-overflow: clip;
      white-space: nowrap;
    }
    .layers-table {
      width: 100%;
      margin-top: var(--space-2);
      border-collapse: collapse;
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      font-variant-numeric: tabular-nums;
    }
    .layers-table th,
    .layers-table td {
      padding: 0 0 0 var(--space-3);
      border-bottom: 1px solid var(--border-subtle);
      color: var(--text-primary);
      font-weight: 400;
      text-align: right;
    }
    .layers-table th:first-child {
      padding-left: 0;
      text-align: left;
    }
    .layers-table thead th {
      color: var(--text-secondary);
      font-weight: 600;
      vertical-align: bottom;
    }
    /* The tonal command of the sheet, as connectivity's Paint. */
    .layers-paint {
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
    .layers-paint:active:not(:focus-visible) {
      transform: scale(var(--press-scale));
    }
    /* A ruled strip says what the stage shows, with the way back beside it. */
    .layers-status {
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
    .layers-status p {
      margin: 0;
      color: var(--text-secondary);
    }
    .layers-restore {
      min-height: 32px;
      padding: 0;
      border: 0;
      background: none;
      color: var(--accent);
      font: inherit;
      cursor: pointer;
    }
    @media (hover: hover) and (pointer: fine) {
      .layers-paint:hover {
        background: var(--surface-tonal-hover);
        color: var(--accent-hover);
      }
      .layers-restore:hover {
        color: var(--accent-hover);
        text-decoration: underline;
        text-underline-offset: 3px;
      }
    }
    @media (pointer: coarse) {
      .layers-paint,
      .layers-restore {
        min-height: 44px;
      }
    }
  }

  @layer a11y {
    @media (forced-colors: active) {
      /* Layer IV's colour is data; the other parts are outlined as one ground. */
      .layers-fill {
        forced-color-adjust: none;
        outline: 1px solid CanvasText;
      }
      .layers-fill:not(.layers-iv) {
        background: Canvas;
      }
    }
  }
</style>
