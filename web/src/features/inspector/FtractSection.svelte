<!--
  Stimulation responses for a Julich-Brain area (F-TRACT v2307): how often stimulating it evoked a
  response in each other area, or stimulating another evoked one here, on the same or the opposite
  side, and when the response peaked. Drawn rates come first, highest first, the first few shown and
  the rest behind a disclosure; areas too thinly tested or never tested are counted. The rows with a
  delay are then plotted by the distance between the two areas' centroids in this brain, with a
  closed table of the same values. Only a region that takes an F-TRACT area has the section; it
  stays mounted so its choices survive a new selection.
-->
<script lang="ts">
  import type { Language, Region } from '../../lib/types/index.ts';
  import {
    ftractFarthest,
    ftractParcelName,
    ftractParcelOf,
    ftractRows,
    type FtractRow,
    type StimulationFtract,
  } from '../../lib/core/catalog/stimulation-ftract.ts';
  import type { Direction, Side } from '../../lib/core/catalog/stimulation-responses.ts';
  import { decimal, grouped, percent, withUnit } from '../../lib/core/format.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import ChoiceGroup from '../../lib/ui/ChoiceGroup.svelte';
  import Disclosure from '../../lib/ui/Disclosure.svelte';
  import { iconGraphic } from '../../lib/ui/IconButton.svelte';
  import Swatch from '../../lib/ui/Swatch.svelte';

  let {
    region,
    lang,
    ftract,
  }: {
    region: Region | null;
    lang: Language;
    ftract: StimulationFtract | null;
  } = $props();

  const FIRST_ROWS = 10;

  let open = $state(false);
  let moreOpen = $state(false);
  let direction = $state<Direction>('from');
  let side = $state<Side>('same');

  const copy = $derived(t(lang, 'stimulation'));
  const parcel = $derived(region ? ftractParcelOf(ftract, region.id) : null);
  const rows = $derived(parcel === null ? null : ftractRows(ftract!, parcel, direction, side));
  const directionOptions = $derived(
    (['from', 'to'] as const).map((value) => ({ value, label: copy[value] })),
  );
  const sideOptions = $derived(
    (['same', 'opposite'] as const).map((value) => ({ value, label: copy[value] })),
  );
  const nameOf = (entry: FtractRow) =>
    entry.parcel === parcel ? copy.within : ftractParcelName(ftract!.parcels[entry.parcel]!, lang);
  const meta = (entry: FtractRow) => {
    const counts = copy.ftractCounts(grouped(entry.tested), entry.implantations);
    if (!entry.delay) return counts;
    return `${counts} · ${copy.ftractPeak(withUnit(decimal(entry.delay.peak, 0, lang), 'ms', lang))}`;
  };

  // The rows with a peak delay, nearest first; one with no distance here ends the table.
  let tableOpen = $state(false);
  const COLUMNS = ['area', 'distance', 'peak', 'mad'] as const;
  const timed = $derived(
    (rows?.drawn ?? [])
      .filter((entry) => entry.delay)
      .sort(
        (p, q) =>
          (p.delay!.distance ?? Infinity) - (q.delay!.distance ?? Infinity) || p.parcel - q.parcel,
      ),
  );
  const placed = $derived(timed.filter((entry) => entry.delay!.distance !== null));

  // The plot: centroid distance across, peak delay up, on one scale for every area and choice: to
  // the farthest delay of any area in 20 mm steps, and up to F-TRACT's response window. It is drawn
  // in CSS pixels at the panel's width, its labels at the caption size the margins are measured in.
  let width = $state(0);
  let frame = $state<HTMLElement>();
  const em = $derived(width && frame ? parseFloat(getComputedStyle(frame).fontSize) : 0);
  const height = $derived(Math.round(width * 0.56));
  const M = $derived({ left: 3.5 * em, right: 8, top: 0.75 * em, bottom: 3 * em });
  const reach = $derived(ftract ? Math.ceil(ftractFarthest(ftract) / 20) * 20 : 0);
  const scale = $derived((width - M.left - M.right) / reach);
  // A distance is named every 20 mm, or every 40 where 20 would crowd the labels.
  const step = $derived(20 * scale >= 2.5 * em ? 20 : 40);
  const distanceTicks = $derived(
    Array.from({ length: Math.floor(reach / step) + 1 }, (_, k) => k * step),
  );
  const responseWindow = $derived(ftract?.window_ms ?? 0);
  const delayTicks = $derived([0, responseWindow / 2, responseWindow]);
  const x = (mm: number) => M.left + mm * scale;
  const y = (ms: number) => M.top + (1 - ms / responseWindow) * (height - M.top - M.bottom);
</script>

{#snippet row(entry: FtractRow)}
  <li class="network-row stimulation-row">
    <span class="network-row-name">{nameOf(entry)}</span>
    <Swatch kind="bar" share={entry.rate} />
    <span class="network-share measure">{percent(entry.rate, lang)}</span>
    <span class="functional-row-meta stimulation-counts">
      {meta(entry)}
    </span>
  </li>
{/snippet}

{#if parcel !== null && rows}
  <div class="evidence-section">
    <Disclosure variant="section" summary={copy.heading} bind:open>
      <ChoiceGroup
        class="stimulation-choice"
        label={copy.direction}
        options={directionOptions}
        bind:value={direction}
      />
      <ChoiceGroup
        class="stimulation-choice"
        label={copy.side}
        options={sideOptions}
        bind:value={side}
      />
      {#if rows.drawn.length}
        <ul class="network-list">
          {#each rows.drawn.slice(0, FIRST_ROWS) as entry (entry.parcel)}
            {@render row(entry)}
          {/each}
        </ul>
        {#if rows.drawn.length > FIRST_ROWS}
          <Disclosure summary={copy.more(rows.drawn.length - FIRST_ROWS)} bind:open={moreOpen}>
            <ul class="network-list">
              {#each rows.drawn.slice(FIRST_ROWS) as entry (entry.parcel)}
                {@render row(entry)}
              {/each}
            </ul>
          </Disclosure>
        {/if}
      {:else}
        <p class="detail-note">{copy.none}</p>
      {/if}
      <p class="detail-note">{copy.ftractRest(rows.tooFew, rows.untested)}</p>
      {#if timed.length}
        <p class="delay-sub">{copy.delayHeading}</p>
        {#if placed.length}
          <div class="delay-frame" bind:this={frame} bind:clientWidth={width}>
            {#if em}
              <svg
                class="delay-plot"
                {width}
                {height}
                role="img"
                aria-label={copy.delayPlot(placed.length)}
              >
                {#each distanceTicks as mm (mm)}
                  <line class="grid" x1={x(mm)} x2={x(mm)} y1={M.top} y2={height - M.bottom} />
                  <text
                    class="tick"
                    x={x(mm)}
                    y={height - M.bottom + 1.15 * em}
                    text-anchor={mm === reach ? 'end' : 'middle'}
                  >
                    {mm}
                  </text>
                {/each}
                {#each delayTicks as ms (ms)}
                  <line class="grid" x1={M.left} x2={width - M.right} y1={y(ms)} y2={y(ms)} />
                  <text class="tick" x={M.left - 0.4 * em} y={y(ms)} dy="0.32em" text-anchor="end">
                    {decimal(ms, 0, lang)}
                  </text>
                {/each}
                <text
                  class="axis"
                  x={(M.left + width - M.right) / 2}
                  y={height - 0.4 * em}
                  text-anchor="middle"
                >
                  {copy.distanceAxis}
                </text>
                <text
                  class="axis"
                  x={-(M.top + height - M.bottom) / 2}
                  y={1.05 * em}
                  transform="rotate(-90)"
                  text-anchor="middle"
                >
                  {copy.delayAxis}
                </text>
                {#each placed as entry (entry.parcel)}
                  <circle
                    class="dot"
                    cx={x(entry.delay!.distance!)}
                    cy={y(entry.delay!.peak)}
                    r="3.25"
                  />
                {/each}
              </svg>
            {/if}
          </div>
        {/if}
        {#if timed.length > placed.length}
          <p class="detail-note">{copy.delayUnplotted(timed.length - placed.length)}</p>
        {/if}
        <Disclosure summary={copy.delayTable} bind:open={tableOpen}>
          <table class="delay-table">
            <caption class="visually-hidden">{copy.delayTableCaption}</caption>
            <thead>
              <tr>
                {#each COLUMNS as column (column)}
                  <th scope="col">{copy.delayColumns[column]}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each timed as entry (entry.parcel)}
                <tr>
                  <th scope="row">{nameOf(entry)}</th>
                  <td>{decimal(entry.delay!.distance, 0, lang)}</td>
                  <td>{decimal(entry.delay!.peak, 0, lang)}</td>
                  <td>{decimal(entry.delay!.mad, 0, lang)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </Disclosure>
        <p class="detail-note">{copy.delayNote(ftract!.min_responses)}</p>
      {:else if rows.drawn.length}
        <p class="detail-note">{copy.noDelays(ftract!.min_responses)}</p>
      {/if}
      <p class="detail-note">
        {copy.ftractNote(ftract!.people, ftract!.min_pairs, ftract!.min_implantations)}
      </p>
      <p class="detail-note">{copy.ftractBasis(ftract!.parcels[parcel]!.name)}</p>
      <div class="stimulation-sources">
        <a href={ftract!.source.dataset} target="_blank" rel="noopener noreferrer">
          {copy.ftractDataset}<span class="visually-hidden">
            {` ${t(lang, 'link').newTab}`}
          </span>{@render iconGraphic('external-link')}
        </a>
        <a href={ftract!.source.doi} target="_blank" rel="noopener noreferrer">
          {copy.ftractMethod}<span class="visually-hidden">
            {` ${t(lang, 'link').newTab}`}
          </span>{@render iconGraphic('external-link')}
        </a>
      </div>
    </Disclosure>
  </div>
{/if}

<style>
  @layer features {
    .delay-sub {
      margin: var(--space-4) 0 var(--space-1);
      font-size: var(--text-ui);
      font-weight: 500;
      color: var(--text-primary);
    }
    /* The labels are set at the caption size, which the margins are measured in. */
    .delay-frame {
      font-size: var(--text-caption);
    }
    .delay-plot {
      display: block;
    }
    .delay-plot .grid {
      stroke: var(--border-subtle);
      stroke-width: 1;
    }
    .delay-plot .tick,
    .delay-plot .axis {
      fill: var(--text-secondary);
      font-variant-numeric: tabular-nums;
    }
    .delay-plot .dot {
      fill: var(--text-secondary);
      fill-opacity: 0.55;
    }
    .delay-table {
      width: 100%;
      margin-top: var(--space-1);
      border-collapse: collapse;
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      font-variant-numeric: tabular-nums;
    }
    .delay-table th,
    .delay-table td {
      padding: 0 0 0 var(--space-3);
      border-bottom: 1px solid var(--border-subtle);
      color: var(--text-primary);
      font-weight: 400;
      text-align: right;
    }
    .delay-table th:first-child {
      padding-left: 0;
      text-align: left;
    }
    .delay-table thead th {
      color: var(--text-secondary);
      font-weight: 600;
      vertical-align: bottom;
    }
  }

  @layer a11y {
    @media (forced-colors: active) {
      /* SVG keeps its own paint under forced colours: the plot takes the system's. */
      .delay-plot .grid {
        stroke: GrayText;
      }
      .delay-plot .tick,
      .delay-plot .axis,
      .delay-plot .dot {
        fill: CanvasText;
      }
    }
  }
</style>
