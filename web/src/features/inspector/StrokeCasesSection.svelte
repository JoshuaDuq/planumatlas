<!--
  Stroke cases (Aphasia Recovery Cohort): the people whose lesion reaches this region, each a dot of
  lesion volume against language score. Two picked are drawn together on the brain, each one's own
  damage and the damage they share; the pairs offered are of similar size and widely different score.
  Only a region some case reaches has the section, or one selected while cases are shown, so they can
  always be cleared; it stays mounted so its choices survive a new selection. A closed table lists
  every dot, sortable, for picking without a pointer.
-->
<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';
  import { COARSE_POINTER_QUERY, type Language, type Region } from '../../lib/types/index.ts';
  import { COMPARE_COLORS } from '../../lib/core/catalog/neuropsych-domains.ts';
  import {
    band,
    differences,
    discordantPairs,
    exceptions,
    gapDays,
    reaching,
    shareOf,
    type StrokeCase,
  } from '../../lib/core/catalog/stroke-cases.ts';
  import { decimal, grouped, percent } from '../../lib/core/format.ts';
  import { reloadWithoutStoredModels } from '../../lib/core/assets/published-assets.ts';
  import { codeOf } from '../../lib/core/i18n/errors.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import type { StrokeCasesStore } from '../../lib/state/stroke-cases.svelte.ts';
  import ChoiceGroup from '../../lib/ui/ChoiceGroup.svelte';
  import Disclosure from '../../lib/ui/Disclosure.svelte';
  import { FOCUS_TARGETS, requestFocus, rescueFocus } from '../../lib/ui/focus.ts';
  import { iconGraphic } from '../../lib/ui/IconButton.svelte';

  let {
    region,
    lang,
    store,
    label,
  }: {
    region: Region | null;
    lang: Language;
    store: StrokeCasesStore;
    label: (id: string) => { name: string };
  } = $props();

  let open = $state(false);
  let window = $state<string>('0');

  // Asked from the Deficits list: the section opens on this region's cases, scrolled into view with
  // focus on its summary. Another region withdraws the ask; the same one redrawn does not.
  const regionId = $derived(region?.id);
  $effect(() => {
    void regionId;
    return () => untrack(() => store.revealed());
  });
  $effect(() => {
    if (!store.revealing || !section) return;
    untrack(() => {
      store.revealed();
      open = true;
      // The row that holds the research sections opens with it, or the summary could not take focus.
      const holder = section!.parentElement!.closest('details');
      if (holder) holder.open = true;
    });
    void tick().then(() => {
      section?.scrollIntoView({ block: 'start' });
      section?.querySelector<HTMLElement>('summary')?.focus();
    });
  });

  // The cohort is read once a region is selected; reading its state must not re-run this.
  $effect(() => {
    if (region) untrack(() => store.load());
  });

  const copy = $derived(t(lang, 'strokeCases'));
  // A failed download can be asked for again; bytes that no longer match the page need a reload;
  // anything else would fail the same way, so it offers nothing.
  const failedCode = $derived(
    store.cohort.status === 'error' ? codeOf(store.cohort.error) : undefined,
  );
  const failure = $derived.by(() => {
    const errors = t(lang, 'errors');
    if (failedCode === 'asset-updated') return { text: errors.updated, button: errors.reload };
    if (failedCode === 'asset-fetch') {
      return { text: `${copy.failed} ${errors.download}`, button: t(lang, 'viewport').retry };
    }
    return { text: copy.failed, button: null };
  });

  async function recover() {
    if (failedCode === 'asset-updated') {
      await reloadWithoutStoredModels();
      return;
    }
    store.retry();
    await tick();
    rescueFocus(FOCUS_TARGETS.regionTitle);
  }
  const data = $derived(store.cohort.status === 'ready' ? store.cohort.data : null);
  const windows = $derived(data ? [...data.test_windows, Infinity] : []);
  const maxGap = $derived(windows[Number(window)] ?? Infinity);
  const everyone = $derived(data && region ? reaching(data, region.id, Infinity) : []);
  const list = $derived(data && region ? reaching(data, region.id, maxGap) : []);
  const pairs = $derived(data ? discordantPairs(data, list) : []);
  const unusual = $derived(data && region ? exceptions(data, list, region.id) : []);
  // A chosen id was checked against the cohort when it was picked or linked.
  const byId = (id: string | undefined) => {
    if (!data || id === undefined) return null;
    const found = data.cases.find((entry) => entry.id === id);
    if (!found) throw new Error(`No stroke case ${id}.`);
    return found;
  };
  const a = $derived(byId(store.chosen[0]));
  const b = $derived(byId(store.chosen[1]));
  // Where the pair on show sits among the pairs offered now, or -1.
  const pairAt = $derived(
    a && b ? pairs.findIndex(([p, q]) => p.id === a.id && q.id === b.id) : -1,
  );
  const onPair = $derived(pairAt >= 0);
  const differ = $derived(data && region && a && b ? differences(data, a, b, region.id, 6) : []);

  const css = ([r, g, bl]: readonly number[]) => `rgb(${r} ${g} ${bl})`;
  const COLOR_A = css(COMPARE_COLORS[0]!);
  const COLOR_B = css(COMPARE_COLORS[1]!);
  const colourOf = (id: string) =>
    store.chosen[0] === id
      ? store.chosen.length === 2
        ? COLOR_A
        : 'var(--text-primary)'
      : store.chosen[1] === id
        ? COLOR_B
        : null;

  const share = (fraction: number) => percent(fraction, lang);
  const volume = (cm3: number) => decimal(cm3, 1, lang);
  const typeName = (entry: StrokeCase) => (entry.type ? copy.types[entry.type] : copy.unrecorded);
  const title = (entry: StrokeCase) => copy.title(typeName(entry), decimal(entry.aq, 1, lang));
  const windowOptions = $derived(
    windows.map((days, index) => ({
      value: String(index),
      label: Number.isFinite(days)
        ? days === 365
          ? copy.windows.year
          : copy.windows.days(days)
        : copy.windows.any,
    })),
  );
  const windowPhrase = $derived(
    Number.isFinite(maxGap)
      ? maxGap === 365
        ? copy.windowPhrase.year
        : copy.windowPhrase.days(maxGap)
      : copy.windowPhrase.any,
  );

  // The plot is one stop in the tab order: left and right walk its dots by lesion volume, up and down by score.
  let plot = $state<SVGSVGElement>();
  let focused = $state<string | null>(null);
  type Column = 'id' | 'volume' | 'aq';
  const ORDER: Record<Column, (p: StrokeCase, q: StrokeCase) => number> = {
    id: (p, q) => p.id.localeCompare(q.id, 'en', { numeric: true }),
    volume: (p, q) => p.volume_cm3 - q.volume_cm3 || p.aq - q.aq,
    aq: (p, q) => p.aq - q.aq || p.volume_cm3 - q.volume_cm3,
  };
  const byVolume = $derived([...list].sort(ORDER.volume));
  const byScore = $derived([...list].sort(ORDER.aq));
  const focusable = $derived(
    focused && list.some((entry) => entry.id === focused) ? focused : (byVolume[0]?.id ?? null),
  );
  // A dot and its row in the table are one choice: either picks the case and becomes the plot's stop.
  function pick(id: string) {
    focused = id;
    store.toggle(id);
  }
  function onDotKey(event: KeyboardEvent, id: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      store.toggle(id);
      return;
    }
    const order = event.key === 'ArrowUp' || event.key === 'ArrowDown' ? byScore : byVolume;
    const at = order.findIndex((entry) => entry.id === id);
    const next = {
      ArrowRight: at + 1,
      ArrowUp: at + 1,
      ArrowLeft: at - 1,
      ArrowDown: at - 1,
      Home: 0,
      End: order.length - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    focused = order[Math.max(0, Math.min(order.length - 1, next))]!.id;
    plot?.querySelector<SVGGElement>(`[data-case="${focused}"]`)?.focus();
  }

  // The table: every case of the plot, sorted by one column (the APG sortable table); by volume
  // first, the order of the dots from left to right.
  let tableOpen = $state(false);
  let sortKey = $state<Column>('volume');
  let ascending = $state(true);
  const COLUMNS: Column[] = ['id', 'volume', 'aq'];
  const rows = $derived([...list].sort((p, q) => (ascending ? 1 : -1) * ORDER[sortKey](p, q)));
  function sortBy(column: Column) {
    ascending = column === sortKey ? !ascending : true;
    sortKey = column;
  }

  function showPair(index: number) {
    const [p, q] = pairs[(index + pairs.length) % pairs.length]!;
    store.show([p.id, q.id]);
  }

  let section = $state<HTMLElement>();
  let nextPair = $state<HTMLButtonElement>();
  let pairNote = $state<HTMLElement>();

  /** Show a pair goes once the pair is on show, so focus moves to the next pair, else to the pair's note. */
  async function showFirstPair(event: MouseEvent) {
    const hadFocus = document.activeElement === event.currentTarget;
    showPair(0);
    await tick();
    if (hadFocus) (nextPair ?? pairNote)!.focus();
  }

  /** Clear goes with the cases, and the section with them where no case reaches the region. */
  async function clear(event: MouseEvent) {
    const hadFocus = document.activeElement === event.currentTarget;
    store.clear();
    await tick();
    if (!hadFocus) return;
    const next =
      plot?.querySelector<SVGElement>('[tabindex="0"]') ??
      section?.querySelector<HTMLElement>('.cases-choice [aria-checked="true"]');
    if (next) next.focus();
    else requestFocus(FOCUS_TARGETS.regionTitle);
  }

  // The plot: lesion volume on a log scale across, WAB-AQ up. It is drawn in CSS pixels at the
  // panel's width, so its labels are set at the caption size and each dot's target is in pixels.
  let width = $state(0);
  let frame = $state<HTMLElement>();
  // The caption size the labels are set in, read with the width: the margins grow with it.
  const em = $derived(width && frame ? parseFloat(getComputedStyle(frame).fontSize) : 0);
  const height = $derived(Math.round(width * 0.64));
  const M = $derived({ left: 3.5 * em, right: 8, top: 0.75 * em, bottom: 3 * em });
  const STOPS = [0.1, 0.3, 1, 3, 10, 30, 100, 300, 1000, 3000];
  const TENS = new Set([0.1, 1, 10, 100, 1000]);
  // The decades around the cases drawn, at least one wide.
  function axis(volumes: number[]): [number, number] {
    const lowest = [...STOPS].reverse().find((stop) => stop <= Math.min(...volumes));
    const highest = STOPS.find((stop) => stop >= Math.max(...volumes) && stop > (lowest ?? 0));
    if (lowest === undefined || highest === undefined)
      throw new RangeError(`Lesion volumes ${volumes} are off the plot's axis.`);
    return [lowest, highest];
  }
  // Fixed for the region, so changing the test window does not rescale it.
  const range = $derived(
    everyone.length ? axis(everyone.map((entry) => entry.volume_cm3)) : [1, 1000],
  );
  const low = $derived(range[0]);
  const high = $derived(range[1]);
  const ticks = $derived(STOPS.filter((stop) => stop >= low && stop <= high));
  const decade = $derived((width - M.left - M.right) / Math.log10(high / low));
  const x = (cm3: number) => M.left + Math.log10(cm3 / low) * decade;
  const tickText = (stop: number) => (stop < 1 ? decimal(stop, 1, lang) : grouped(stop));
  // A stop is named where its label stays inside the plot and clears those already named by half a
  // caption, the powers of ten from the top first and then the threes, so no two touch at any width
  // or text size. A figure is taken as 0.52 of a caption wide and any other character as 0.3, a
  // little more than the font's. Every stop keeps its grid line.
  const named = $derived.by(() => {
    const spans: [number, number][] = [];
    const kept = new Set<number>();
    const order = [...ticks].reverse().sort((p, q) => Number(TENS.has(q)) - Number(TENS.has(p)));
    for (const stop of order) {
      const size =
        [...tickText(stop)].reduce((sum, c) => sum + (/\d/.test(c) ? 0.52 : 0.3), 0) * em;
      const left = stop === low ? x(stop) : stop === high ? x(stop) - size : x(stop) - size / 2;
      const clear = spans.every(
        ([start, end]) => left + size + em / 2 <= start || left >= end + em / 2,
      );
      if (left >= 0 && left + size <= width && clear) {
        spans.push([left, left + size]);
        kept.add(stop);
      }
    }
    return ticks.filter((stop) => kept.has(stop));
  });
  const y = (aq: number) => M.top + (1 - aq / 100) * (height - M.top - M.bottom);
  const normal = $derived(data?.aq_bands.at(-1)!.min ?? 100);

  // Each dot's pointer target is the part of the plot nearer it than any other dot, out to 12px
  // (22px for a finger): a Voronoi cell clipped to a disc, so an isolated dot is a 24px target
  // (44px) and a press always takes the nearest dot. Circles of that size would overlap almost
  // everywhere and hand a press to whichever was drawn last: on the published cohort, in the
  // panel's 289px, 95% of the dots drawn have a neighbour within 24px and 58% within 8px (97% and
  // 67% at any test time). Where dots crowd a cell is smaller than 24px, and the table of cases is
  // the equivalent target (WCAG 2.5.8).
  const coarse = new MediaQuery(COARSE_POINTER_QUERY);
  const reach = $derived(coarse.current ? 22 : 12);
  const targets = $derived.by(() => {
    const points = list.map((entry): Point => [x(entry.volume_cm3), y(entry.aq)]);
    return points.map((_, index) => cell(points, index, reach));
  });

  type Point = readonly [number, number];
  const SIDES = 24;
  /** The points nearer `points[index]` than any other and within `reach` of it, as a path. */
  function cell(points: readonly Point[], index: number, reach: number): string {
    const [cx, cy] = points[index]!;
    // The polygon's sides touch the disc, so the whole disc is inside it.
    const corner = reach / Math.cos(Math.PI / SIDES);
    let polygon: Point[] = Array.from({ length: SIDES }, (_, k) => [
      cx + corner * Math.cos((2 * Math.PI * k) / SIDES),
      cy + corner * Math.sin((2 * Math.PI * k) / SIDES),
    ]);
    points.forEach(([qx, qy], other) => {
      if (other === index || Math.hypot(qx - cx, qy - cy) >= 2 * corner) return;
      // Negative on this dot's side of the bisector, zero on it; two dots at one place share it.
      const side = ([px, py]: Point) =>
        (qx - cx) * px + (qy - cy) * py - (qx * qx + qy * qy - cx * cx - cy * cy) / 2;
      polygon = clip(polygon, side);
    });
    return polygon.length
      ? `M${polygon.map(([px, py]) => `${px.toFixed(1)} ${py.toFixed(1)}`).join('L')}Z`
      : '';
  }
  /** Sutherland–Hodgman against one half-plane: what of the polygon has `side` ≤ 0. */
  function clip(polygon: readonly Point[], side: (point: Point) => number): Point[] {
    return polygon.flatMap((point, k) => {
      const next = polygon[(k + 1) % polygon.length]!;
      const [here, there] = [side(point), side(next)];
      const kept: Point[] = here <= 0 ? [point] : [];
      if ((here < 0 && there > 0) || (here > 0 && there < 0)) {
        const t = here / (here - there);
        kept.push([point[0] + t * (next[0] - point[0]), point[1] + t * (next[1] - point[1])]);
      }
      return kept;
    });
  }
</script>

{#snippet facts(entry: StrokeCase, color: string)}
  {@const gap = gapDays(entry)}
  <li class="case-row">
    <span class="case-dot" style:background={color}></span>
    <span class="case-name">
      <span class="case-title">{title(entry)}</span>
      <span class="case-meta">
        {copy.facts(
          volume(entry.volume_cm3),
          share(shareOf(entry, region!.id)),
          copy.bands[band(data!, entry.aq)],
        )}
      </span>
      <span class="case-meta">
        {copy.timing(Math.round(entry.scan_day / 30.44), gap, entry.test_day > entry.scan_day)} · {copy.caseId(
          entry.id,
        )}
      </span>
    </span>
  </li>
{/snippet}

{#if region && data && (everyone.length || a)}
  <div class="evidence-section stroke-cases" bind:this={section}>
    <Disclosure variant="section" summary={copy.heading} bind:open>
      <p class="detail-note">
        {#if list.length}
          {copy.lead(grouped(list.length), list.length, share(data.reaches_min), windowPhrase)}
        {:else}
          {copy.none(share(data.reaches_min))}
        {/if}
      </p>
      <ChoiceGroup
        class="cases-choice"
        label={copy.window}
        options={windowOptions}
        bind:value={window}
      />

      {#if list.length}
        <div class="case-frame" bind:this={frame} bind:clientWidth={width}>
          {#if em}
            <svg
              class="case-plot"
              {width}
              {height}
              role="group"
              aria-label={copy.plot}
              bind:this={plot}
            >
              {#each ticks as stop (stop)}
                <line class="grid" x1={x(stop)} x2={x(stop)} y1={M.top} y2={height - M.bottom} />
              {/each}
              {#each named as stop (stop)}
                <text
                  class="tick"
                  x={x(stop)}
                  y={height - M.bottom + 1.15 * em}
                  text-anchor={stop === high ? 'end' : stop === low ? 'start' : 'middle'}
                  >{tickText(stop)}</text
                >
              {/each}
              {#each [0, 50, 100] as aq (aq)}
                <line class="grid" x1={M.left} x2={width - M.right} y1={y(aq)} y2={y(aq)} />
                <text class="tick" x={M.left - 0.4 * em} y={y(aq)} dy="0.32em" text-anchor="end"
                  >{aq}</text
                >
              {/each}
              <line class="normal" x1={M.left} x2={width - M.right} y1={y(normal)} y2={y(normal)} />
              <text class="axis" x={width - M.right} y={y(normal) - 0.3 * em} text-anchor="end"
                >{copy.normal}</text
              >
              <text
                class="axis"
                x={(M.left + width - M.right) / 2}
                y={height - 0.4 * em}
                text-anchor="middle">{copy.volumeAxis}</text
              >
              <text
                class="axis"
                x={-(M.top + height - M.bottom) / 2}
                y={1.05 * em}
                transform="rotate(-90)"
                text-anchor="middle">{copy.scoreAxis}</text
              >
              {#if a && b && list.includes(a) && list.includes(b)}
                <line
                  class="link"
                  x1={x(a.volume_cm3)}
                  y1={y(a.aq)}
                  x2={x(b.volume_cm3)}
                  y2={y(b.aq)}
                />
              {/if}
              {#each list as entry, index (entry.id)}
                {@const color = colourOf(entry.id)}
                <g
                  class="case"
                  role="button"
                  data-case={entry.id}
                  tabindex={entry.id === focusable ? 0 : -1}
                  aria-pressed={color !== null}
                  aria-label={copy.dot(
                    title(entry),
                    volume(entry.volume_cm3),
                    share(shareOf(entry, region.id)),
                  )}
                  onclick={() => pick(entry.id)}
                  onkeydown={(event) => onDotKey(event, entry.id)}
                >
                  <path class="target" d={targets[index]} />
                  <circle
                    class="dot"
                    class:chosen={color !== null}
                    cx={x(entry.volume_cm3)}
                    cy={y(entry.aq)}
                    r={color ? 5 : 3.25}
                    style:fill={color ?? undefined}
                  />
                </g>
              {/each}
            </svg>
          {/if}
        </div>
        <p class="detail-note">{copy.plotHint}</p>
        <Disclosure summary={copy.table} bind:open={tableOpen}>
          <table class="case-table">
            <caption class="visually-hidden">{copy.tableCaption}</caption>
            <thead>
              <tr>
                {#each COLUMNS as column (column)}
                  <th
                    scope="col"
                    aria-sort={column === sortKey
                      ? ascending
                        ? 'ascending'
                        : 'descending'
                      : undefined}
                  >
                    <button type="button" onclick={() => sortBy(column)}
                      >{copy.columns[column]}<span class="sort-mark" aria-hidden="true"
                      ></span></button
                    >
                  </th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each rows as entry (entry.id)}
                {@const color = colourOf(entry.id)}
                <tr>
                  <th scope="row">
                    <button
                      type="button"
                      class="row-pick"
                      aria-pressed={color !== null}
                      onclick={() => pick(entry.id)}
                    >
                      <span
                        class="case-dot"
                        class:hollow={!color}
                        style:background={color ?? 'transparent'}
                      ></span>{copy.caseId(entry.id)}
                    </button>
                  </th>
                  <td>{volume(entry.volume_cm3)}</td>
                  <td>{decimal(entry.aq, 1, lang)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </Disclosure>

        {#if unusual.length}
          <p class="cases-sub">{copy.exceptions}</p>
          <ul class="case-picks">
            {#each unusual as entry (entry.id)}
              {@const color = colourOf(entry.id)}
              <li>
                <button
                  type="button"
                  class="case-pick"
                  aria-pressed={color !== null}
                  onclick={() => store.toggle(entry.id)}
                >
                  <span
                    class="case-dot"
                    class:hollow={!color}
                    style:background={color ?? 'transparent'}
                  ></span>
                  <span class="case-name">
                    <span class="case-pick-name">{title(entry)}</span>
                    <span class="case-meta">
                      {copy.exceptionMeta(
                        share(shareOf(entry, region.id)),
                        volume(entry.volume_cm3),
                      )}
                    </span>
                  </span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}

        {#if pairs.length && !onPair}
          <div class="pair-row">
            <span class="cases-sub">{copy.pairs}</span>
            <div class="actions">
              <button type="button" onclick={showFirstPair}>{copy.showPair}</button>
            </div>
          </div>
        {/if}
      {/if}

      {#if a}
        <ul class="case-list">
          {@render facts(a, b ? COLOR_A : 'var(--text-primary)')}
          {#if b}{@render facts(b, COLOR_B)}{/if}
        </ul>
        {#if onPair}
          <div class="pair-row">
            <span class="detail-note" tabindex="-1" bind:this={pairNote}>
              {copy.pairOf(
                pairAt + 1,
                pairs.length,
                percent(data.pairs.volume_ratio_max - 1, lang),
                decimal(b!.aq - a.aq, 0, lang),
              )}
            </span>
            {#if pairs.length > 1}
              <div class="actions">
                <button type="button" bind:this={nextPair} onclick={() => showPair(pairAt + 1)}
                  >{copy.nextPair}</button
                >
              </div>
            {/if}
          </div>
        {/if}
        {#if b}
          <p class="cases-sub">{copy.differ}</p>
          <ul class="differ-list">
            {#each differ as row, index (row.id)}
              <li class="differ-row">
                <span class="differ-name">
                  {label(row.id).name}{#if index === 0}<span class="differ-this"
                      >{` · ${copy.thisRegion}`}</span
                    >{/if}
                </span>
                {#each [[row.a, COLOR_A], [row.b, COLOR_B]] as [value, color] (color)}
                  <span class="differ-value">
                    <span class="twin"
                      ><span style:width={`${Number(value) * 100}%`} style:background={color}
                      ></span></span
                    >
                    <span class="measure">{share(Number(value))}</span>
                  </span>
                {/each}
              </li>
            {/each}
          </ul>
        {/if}
        <div class="actions">
          <button type="button" onclick={clear}>{copy.clear}</button>
        </div>
      {/if}

      {#if store.drawn.status === 'error'}
        <p class="detail-note" role="alert">{copy.drawFailed}</p>
      {/if}
      <p class="detail-note">{copy.note(data.cases.length)}</p>
      <div class="stroke-sources">
        <a href={data.source.doi} target="_blank" rel="noopener noreferrer"
          >{data.source.short}<span class="visually-hidden">{` ${t(lang, 'link').newTab}`}</span
          >{@render iconGraphic('external-link')}</a
        >
        <a href={data.source.dataset} target="_blank" rel="noopener noreferrer"
          >{copy.dataset}<span class="visually-hidden">{` ${t(lang, 'link').newTab}`}</span
          >{@render iconGraphic('external-link')}</a
        >
      </div>
    </Disclosure>
  </div>
{:else if region && store.available && store.cohort.status === 'error'}
  <p class="detail-note" role="alert">{failure.text}</p>
  {#if failure.button}
    <div class="actions">
      <button type="button" onclick={() => void recover()}>{failure.button}</button>
    </div>
  {/if}
{/if}

<style>
  @layer features {
    /* A failure is set apart in the danger ink every inline failure uses. */
    .detail-note[role='alert'] {
      color: var(--danger);
    }
    :global(.cases-choice) {
      margin-top: var(--space-2);
    }
    /* The labels are set at the caption size, which the margins are measured in. */
    .case-frame {
      margin-top: var(--space-3);
      font-size: var(--text-caption);
    }
    .case-plot {
      display: block;
    }
    .case-plot .grid {
      stroke: var(--border-subtle);
      stroke-width: 1;
    }
    .case-plot .normal {
      stroke: var(--text-secondary);
      stroke-dasharray: 3 3;
    }
    .case-plot .tick,
    .case-plot .axis {
      fill: var(--text-secondary);
      font-variant-numeric: tabular-nums;
    }
    .case-plot .case {
      cursor: pointer;
    }
    /* The ring is drawn on the dot, below, not around its target. */
    .case-plot .case:focus-visible {
      outline: none;
    }
    /* A dot's target is unpainted and takes the pointer; the dot leaves the pointer to it. */
    .case-plot .target {
      fill: none;
      pointer-events: fill;
    }
    .case-plot .dot {
      fill: var(--text-secondary);
      fill-opacity: 0.55;
      pointer-events: none;
    }
    @media (hover: hover) and (pointer: fine) {
      .case-plot .case:hover .dot:where(:not(.chosen)) {
        fill-opacity: 1;
        stroke: var(--text-primary);
        stroke-width: 1;
      }
      .case-pick:hover .case-pick-name {
        text-decoration: underline;
        text-underline-offset: 2px;
      }
    }
    .case-plot .dot.chosen {
      fill-opacity: 1;
      stroke: var(--surface-base);
      stroke-width: 1.5;
    }
    /* After `.chosen`, so a dot just picked from the keyboard keeps its focus ring. */
    .case-plot .case:focus-visible .dot {
      fill-opacity: 1;
      stroke: var(--accent);
      stroke-width: 2;
    }
    /* The table of cases: compact rows of the caption size, figures aligned on the right. */
    .case-table {
      width: 100%;
      margin-top: var(--space-1);
      border-collapse: collapse;
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      font-variant-numeric: tabular-nums;
    }
    .case-table th,
    .case-table td {
      padding: 0 0 0 var(--space-3);
      border-bottom: 1px solid var(--border-subtle);
      color: var(--text-primary);
      font-weight: 400;
      text-align: right;
    }
    .case-table th:first-child {
      padding-left: 0;
      text-align: left;
    }
    .case-table thead th {
      color: var(--text-secondary);
      font-weight: 600;
      vertical-align: bottom;
    }
    .case-table button {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      min-height: 24px;
      padding: 0;
      background: none;
      font-weight: inherit;
      text-align: inherit;
      cursor: pointer;
    }
    .case-table .row-pick {
      gap: var(--space-2);
      width: 100%;
    }
    .row-pick .case-dot {
      margin-top: 0;
    }
    /* The sorted column's chevron points the way its values grow; the others keep its room. */
    .sort-mark {
      flex: none;
      width: 6px;
      height: 6px;
      border-right: 1.5px solid currentColor;
      border-bottom: 1.5px solid currentColor;
      visibility: hidden;
    }
    th[aria-sort] .sort-mark {
      visibility: visible;
    }
    th[aria-sort='ascending'] .sort-mark {
      transform: translateY(1.5px) rotate(-135deg);
    }
    th[aria-sort='descending'] .sort-mark {
      transform: translateY(-1.5px) rotate(45deg);
    }
    @media (hover: hover) and (pointer: fine) {
      .case-table button:hover {
        color: var(--accent);
      }
    }
    @media (pointer: coarse) {
      .case-table button {
        min-height: 44px;
      }
    }
    .case-plot .link {
      stroke: var(--text-primary);
      stroke-dasharray: 2 2;
    }
    .cases-sub {
      display: block;
      margin: var(--space-4) 0 var(--space-1);
      font-size: var(--text-ui);
      font-weight: 500;
      color: var(--text-primary);
    }
    .pair-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
      margin-top: var(--space-3);
    }
    .pair-row .cases-sub,
    .pair-row .detail-note,
    .pair-row .actions {
      margin: 0;
    }
    .pair-row .actions {
      flex: none;
    }
    .pair-row .actions button {
      white-space: nowrap;
    }
    .case-list,
    .case-picks {
      margin: var(--space-3) 0 0;
      padding: 0;
      list-style: none;
    }
    .case-picks {
      margin-top: 0;
    }
    .case-row {
      display: grid;
      grid-template-columns: 10px minmax(0, 1fr);
      gap: var(--space-2);
      padding: var(--space-1) 0;
    }
    .case-dot {
      display: inline-block;
      flex: none;
      width: 10px;
      height: 10px;
      margin-top: 4px;
      border-radius: 50%;
    }
    .case-dot.hollow {
      box-shadow: inset 0 0 0 1px var(--text-secondary);
    }
    .case-name {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .case-title {
      font-size: var(--text-ui);
      line-height: var(--lh-ui);
      color: var(--text-primary);
    }
    .case-meta {
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      color: var(--text-secondary);
      font-variant-numeric: tabular-nums;
    }
    .case-pick {
      display: grid;
      grid-template-columns: 10px minmax(0, 1fr);
      align-items: start;
      gap: var(--space-2);
      width: 100%;
      min-height: var(--row-height);
      padding: 0;
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .case-pick {
      padding-block: var(--space-1);
    }
    .case-pick-name {
      font-size: var(--text-ui);
      color: var(--text-primary);
    }
    .differ-list {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .differ-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-1) var(--space-4);
      padding: var(--space-1) 0 var(--space-2);
    }
    .differ-name {
      grid-column: 1 / -1;
      font-size: var(--text-ui);
      line-height: var(--lh-ui);
      color: var(--text-primary);
    }
    .differ-this {
      color: var(--text-secondary);
    }
    .differ-value {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 2.75rem;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      color: var(--text-secondary);
      font-variant-numeric: tabular-nums;
    }
    .differ-value .measure {
      text-align: right;
    }
    .twin {
      height: 4px;
      overflow: hidden;
      border-radius: 2px;
      background: var(--border-subtle);
    }
    .twin > span {
      display: block;
      height: 100%;
    }
    .stroke-sources {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1) var(--space-3);
      padding-top: var(--space-2);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
    .stroke-sources a {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      min-height: 24px;
    }
  }

  @layer a11y {
    @media (forced-colors: active) {
      /* SVG keeps its own paint under forced colours: the plot takes the system's, and a chosen dot
         keeps its lesion's colour inside a ring. */
      .case-plot .grid {
        stroke: GrayText;
      }
      .case-plot .normal,
      .case-plot .link {
        stroke: CanvasText;
      }
      .case-plot .tick,
      .case-plot .axis,
      .case-plot .dot {
        fill: CanvasText;
      }
      .case-plot .dot.chosen {
        stroke: CanvasText;
        stroke-width: 2;
      }
      .case-plot .case:focus-visible .dot {
        stroke: Highlight;
      }
      /* The swatch's fill and inset edge are painted away: a pick's is a system edge, filled when pressed. */
      [aria-pressed] > .case-dot {
        border: 1px solid CanvasText;
      }
      [aria-pressed='true'] > .case-dot {
        border: 5px solid Highlight;
      }
    }
  }
</style>
