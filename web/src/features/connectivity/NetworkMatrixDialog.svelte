<!--
  The network matrix: the group-mean resting correlation between Schaefer's 200 parcels, sorted by Yeo's
  seven networks, with each pair of networks' mean beside it. A figure of its own, the same on every
  brain; opened from the Yeo networks' stage key. Its file and this chunk load when it first opens.
-->
<script lang="ts">
  import type { Language, Rgb } from '../../lib/types/index.ts';
  import { fetchAsset } from '../../lib/core/assets/asset-cache.ts';
  import {
    MAGMA,
    networkSpans,
    pairR,
    readNetworkMatrix,
    type NetworkMatrix,
  } from '../../lib/core/catalog/network-matrix.ts';
  import { networkCss, networkName } from '../../lib/core/catalog/networks.ts';
  import { decimal, withUnit } from '../../lib/core/format.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import * as words from '../../lib/core/i18n/areas/networkMatrix.ts';
  import { announce } from '../../lib/ui/announcer.svelte.ts';
  import Dialog from '../../lib/ui/Dialog.svelte';
  import { iconGraphic } from '../../lib/ui/IconButton.svelte';
  import { cellAt, matrixPixels, matrixSheet } from './network-matrix-draw.ts';

  let {
    open = $bindable(false),
    instant = $bindable(false),
    lang,
    url,
    networks,
    fallbackFocus,
  }: {
    open?: boolean;
    instant?: boolean;
    lang: Language;
    url: URL;
    /** Yeo's networks as the brain names and colours them. */
    networks: { networks: readonly string[]; colors: Readonly<Record<string, Rgb>> };
    fallbackFocus: () => HTMLElement | null;
  } = $props();

  const copy = $derived(lang === 'fr' ? words.fr : words.en);
  let matrix = $state.raw<NetworkMatrix | null>(null);
  let failed = $state(false);
  let requested = false;
  let canvas = $state<HTMLCanvasElement>();
  let pointed = $state<[number, number] | null>(null);

  $effect(() => {
    if (!open || requested) return;
    requested = true;
    fetchAsset(url)
      .then((buffer) =>
        readNetworkMatrix(JSON.parse(new TextDecoder().decode(buffer)), networks.networks),
      )
      .then(
        (data) => (matrix = data),
        (error: unknown) => {
          failed = true;
          console.error(error);
        },
      );
  });
  $effect(() => {
    if (!canvas || !matrix) return;
    canvas.width = canvas.height = matrix.parcels.length;
    canvas.getContext('2d')!.putImageData(matrixPixels(matrix), 0, 0);
  });

  const spans = $derived(matrix ? networkSpans(matrix) : []);
  const name = (network: string) => networkName(network, lang);
  const parcel = (index: number) => {
    const { network, name: own, hemisphere } = matrix!.parcels[index]!;
    return copy.parcel(name(network), own, t(lang, 'sides').words[hemisphere]);
  };
  const readout = $derived.by(() => {
    if (!matrix || !pointed) return copy.prompt;
    const [row, column] = pointed;
    const r = pairR(matrix, row, column);
    return r === null ? parcel(row) : copy.cell(parcel(row), parcel(column), decimal(r, 2, lang));
  });
  const apart = $derived(
    matrix ? matrix.networks.filter((_, index) => !matrix!.within_exceeds[index]) : [],
  );
  const positive = $derived(matrix ? 1 - matrix.negative_share : 0);
  const n = $derived(matrix?.parcels.length ?? 0);

  function point(event: PointerEvent) {
    pointed = cellAt(canvas!.getBoundingClientRect(), event.clientX, event.clientY, n);
  }

  function save() {
    const link = document.createElement('a');
    link.download = 'network-matrix.png';
    link.href = matrixSheet({
      matrix: matrix!,
      colours: networks.colors,
      names: name,
      title: copy.sheetTitle,
      scale: copy.scale,
      footer: `${matrix!.source.short}, ${matrix!.people} HCP · ${matrix!.parcellation.short}`,
    }).toDataURL('image/png');
    link.click();
    announce(copy.saved);
  }
</script>

<Dialog
  bind:open
  bind:instant
  variant="imaging"
  isolateKeys
  closeLabel={copy.close}
  {fallbackFocus}
>
  {#snippet heading(id)}<h2 {id} class="matrix-title">{copy.title}</h2>{/snippet}
  {#if failed}
    <p class="matrix-status" role="alert">{copy.failed}</p>
  {:else if !matrix}
    <p class="matrix-status" role="status">{copy.loading}</p>
  {:else}
    <p class="matrix-about">{copy.about(matrix.people, matrix.ages)}</p>
    <div class="matrix-body">
      <div class="matrix-figure">
        <div class="matrix-grid">
          <div class="strip strip-top" aria-hidden="true">
            {#each spans as span (span.start)}
              <span
                style:flex-grow={span.count}
                style:background={networkCss(networks.colors[span.network]!)}
              ></span>
            {/each}
          </div>
          <div class="strip strip-left" aria-hidden="true">
            {#each spans as span (span.start)}
              <span
                style:flex-grow={span.count}
                style:background={networkCss(networks.colors[span.network]!)}
              ></span>
            {/each}
          </div>
          <div class="matrix-plot">
            <!-- A picture of data is an image (ARIA 1.2 img; HTML-AAM allows it on canvas). -->
            <!-- svelte-ignore a11y_no_interactive_element_to_noninteractive_role -->
            <canvas
              bind:this={canvas}
              role="img"
              aria-label={copy.figure(n)}
              onpointermove={point}
              onpointerleave={() => (pointed = null)}
            ></canvas>
            <svg
              class="matrix-borders"
              viewBox="0 0 {n} {n}"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {#each spans.slice(1) as span (span.start)}
                <line x1={span.start} y1="0" x2={span.start} y2={n} />
                <line x1="0" y1={span.start} x2={n} y2={span.start} />
              {/each}
            </svg>
          </div>
        </div>
        <p class="matrix-readout">{readout}</p>
        <div class="matrix-scale">
          <span class="matrix-scale-name">{copy.scale}</span>
          <span
            class="matrix-ramp"
            aria-hidden="true"
            style:background="linear-gradient(to right, {MAGMA.map(networkCss).join(', ')})"
          ></span>
          <span class="matrix-scale-ends"
            ><span>{decimal(matrix.scale[0], 0, lang)}</span><span
              >{decimal(matrix.scale[1], 2, lang)}</span
            ></span
          >
          <p class="matrix-note">{copy.scaleEnds(decimal(matrix.scale[1], 2, lang))}</p>
        </div>
      </div>

      <div class="matrix-side">
        <div class="matrix-table-scroll">
          <table class="matrix-table">
            <caption>{copy.table}</caption>
            <thead>
              <tr>
                <td></td>
                {#each matrix.networks as network (network)}
                  <!-- The row's swatch heads its column: the colour is the network's, its name for screen readers. -->
                  <th scope="col" title={name(network)}>
                    <span
                      class="matrix-swatch"
                      aria-hidden="true"
                      style:background={networkCss(networks.colors[network]!)}
                    ></span><span class="visually-hidden">{name(network)}</span>
                  </th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each matrix.networks as network, row (network)}
                <tr data-apart={!matrix.within_exceeds[row] || undefined}>
                  <th scope="row">
                    <span
                      class="matrix-swatch"
                      aria-hidden="true"
                      style:background={networkCss(networks.colors[network]!)}
                    ></span>{name(network)}
                  </th>
                  {#each matrix.blocks[row]! as mean, column (column)}
                    <td class:within={row === column}>{decimal(mean, 2, lang)}</td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <p class="matrix-note">{copy.tableNote}</p>
        <p>{copy.blocks(apart.map(name))}</p>
        {#if apart.includes('Limbic')}<p>{copy.limbic}</p>{/if}
        <p>{copy.independent}</p>
        <p>{copy.positive(withUnit(decimal(positive * 100, 1, lang), '%', lang))}</p>
        <div class="matrix-links">
          <a href={matrix.source.dataset} target="_blank" rel="noopener noreferrer"
            >{copy.dataset}<span class="visually-hidden">{` ${t(lang, 'link').newTab}`}</span
            >{@render iconGraphic('external-link')}</a
          >
          <a
            href="https://pubmed.ncbi.nlm.nih.gov/{matrix.source.pmid}/"
            target="_blank"
            rel="noopener noreferrer"
            >{copy.paper}<span class="visually-hidden">{` ${t(lang, 'link').newTab}`}</span
            >{@render iconGraphic('external-link')}</a
          >
          <a href={matrix.parcellation.doi} target="_blank" rel="noopener noreferrer"
            >{copy.parcels}<span class="visually-hidden">{` ${t(lang, 'link').newTab}`}</span
            >{@render iconGraphic('external-link')}</a
          >
        </div>
        <button type="button" class="matrix-save" onclick={save}>{copy.save}</button>
      </div>
    </div>
  {/if}
</Dialog>

<style>
  @layer features {
    .matrix-title {
      margin: 0;
      font-size: var(--text-title);
      line-height: var(--lh-title);
    }
    .matrix-about,
    .matrix-status {
      margin: var(--space-2) 0 var(--space-4);
      max-width: 72ch;
      color: var(--text-secondary);
      font-size: var(--text-ui);
      line-height: var(--lh-ui);
    }
    .matrix-body {
      display: grid;
      grid-template-columns: minmax(280px, 540px) minmax(360px, 1fr);
      gap: var(--space-6);
      align-items: start;
    }
    @media (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      .matrix-body {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    /* The strips stand off the matrix by a hairline, each network's span as long as its parcels. */
    .matrix-grid {
      display: grid;
      grid-template-columns: 10px minmax(0, 1fr);
      grid-template-rows: 10px auto;
      gap: 3px;
    }
    .strip {
      display: flex;
    }
    .strip-top {
      grid-column: 2;
    }
    .strip-left {
      grid-row: 2;
      flex-direction: column;
    }
    .strip span {
      flex-basis: 0;
    }
    .matrix-plot {
      position: relative;
      grid-row: 2;
      grid-column: 2;
      aspect-ratio: 1;
    }
    .matrix-plot canvas,
    .matrix-borders {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }
    .matrix-plot canvas {
      image-rendering: pixelated;
      cursor: crosshair;
    }
    .matrix-borders {
      pointer-events: none;
    }
    .matrix-borders line {
      stroke: rgb(255 255 255 / 0.7);
      stroke-width: 1px;
      vector-effect: non-scaling-stroke;
    }
    .matrix-readout {
      min-height: calc(2 * var(--lh-caption) * 1em);
      margin: var(--space-2) 0 0 13px;
      color: var(--text-primary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      font-variant-numeric: tabular-nums;
    }
    .matrix-scale {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: var(--space-1) var(--space-3);
      align-items: center;
      margin: var(--space-3) 0 0 13px;
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
    .matrix-ramp {
      height: 10px;
      border-radius: 2px;
    }
    .matrix-scale-ends {
      display: flex;
      grid-column: 2;
      justify-content: space-between;
      color: var(--text-secondary);
      font-variant-numeric: tabular-nums;
    }
    .matrix-scale .matrix-note {
      grid-column: 1 / -1;
    }
    .matrix-side {
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
    .matrix-side p {
      margin: var(--space-2) 0 0;
      color: var(--text-secondary);
      text-wrap: pretty;
    }
    .matrix-note {
      color: var(--text-secondary);
    }
    .matrix-table {
      border-collapse: collapse;
      font-variant-numeric: tabular-nums;
    }
    .matrix-table caption {
      margin-bottom: var(--space-2);
      color: var(--text-primary);
      font-weight: 600;
      text-align: left;
    }
    /* Never cut: a table wider than its column scrolls on its own. */
    .matrix-table-scroll {
      overflow-x: auto;
    }
    .matrix-table th,
    .matrix-table td {
      padding: 2px 4px;
      text-align: right;
      white-space: nowrap;
    }
    .matrix-table thead th {
      font-weight: 500;
      color: var(--text-secondary);
    }
    .matrix-table thead .matrix-swatch {
      margin-right: 0;
    }
    .matrix-table tbody th {
      min-width: 8em;
      font-weight: 500;
      text-align: left;
      white-space: normal;
    }
    .matrix-table td.within {
      color: var(--text-primary);
      font-weight: 700;
    }
    .matrix-table tr[data-apart] td.within {
      text-decoration: underline dotted;
    }
    .matrix-swatch {
      display: inline-block;
      width: 10px;
      height: 10px;
      margin-right: var(--space-2);
      border-radius: 2px;
      vertical-align: baseline;
    }
    .matrix-links {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1) var(--space-4);
      margin-top: var(--space-3);
    }
    .matrix-links a {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      color: var(--accent);
    }
    .matrix-save {
      min-height: var(--control-height);
      margin-top: var(--space-4);
      padding: var(--space-1) var(--space-3);
      border: 1px solid transparent;
      border-radius: var(--radius-control);
      background: var(--surface-tonal);
      color: var(--accent);
      font-size: var(--text-ui);
      font-weight: 500;
      cursor: pointer;
    }
    @media (hover: hover) and (pointer: fine) {
      .matrix-save:hover {
        background: var(--surface-tonal-hover);
        color: var(--accent-hover);
      }
    }
  }
</style>
