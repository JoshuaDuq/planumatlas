<!--
  Stroke cases (Aphasia Recovery Cohort): the people whose lesion reaches this region, each a dot of
  lesion volume against language score. Two picked are drawn together on the brain, each one's own
  damage and the damage they share; the pairs offered are of similar size and widely different score.
  Only a region some case reaches has the section, or one selected while cases are shown, so they can
  always be cleared; it stays mounted so its choices survive a new selection.
-->
<script lang="ts">
  import { tick, untrack } from 'svelte';
  import type { Language, Region } from '../../lib/types/index.ts';
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
  const byVolume = $derived([...list].sort((p, q) => p.volume_cm3 - q.volume_cm3 || p.aq - q.aq));
  const byScore = $derived([...list].sort((p, q) => p.aq - q.aq || p.volume_cm3 - q.volume_cm3));
  const focusable = $derived(
    focused && list.some((entry) => entry.id === focused) ? focused : (byVolume[0]?.id ?? null),
  );
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
    plot?.querySelector<SVGCircleElement>(`[data-case="${focused}"]`)?.focus();
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

  // The plot: lesion volume on a log scale across, WAB-AQ up.
  const W = 288;
  const H = 184;
  const M = { left: 30, right: 8, top: 10, bottom: 26 };
  const STOPS = [0.1, 0.3, 1, 3, 10, 30, 100, 300, 1000, 3000];
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
  const x = (cm3: number) =>
    M.left +
    ((Math.log10(cm3) - Math.log10(low)) / (Math.log10(high) - Math.log10(low))) *
      (W - M.left - M.right);
  const y = (aq: number) => M.top + (1 - aq / 100) * (H - M.top - M.bottom);
  const normal = $derived(data?.aq_bands.at(-1)!.min ?? 100);
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
        <svg
          class="case-plot"
          viewBox="0 0 {W} {H}"
          role="group"
          aria-label={copy.plot}
          bind:this={plot}
        >
          {#each ticks as stop (stop)}
            <line class="grid" x1={x(stop)} x2={x(stop)} y1={M.top} y2={H - M.bottom} />
            <text
              class="tick"
              x={x(stop)}
              y={H - M.bottom + 12}
              text-anchor={stop === high ? 'end' : stop === low ? 'start' : 'middle'}
              >{stop < 1 ? decimal(stop, 1, lang) : grouped(stop)}</text
            >
          {/each}
          {#each [0, 50, 100] as aq (aq)}
            <line class="grid" x1={M.left} x2={W - M.right} y1={y(aq)} y2={y(aq)} />
            <text class="tick" x={M.left - 5} y={y(aq) + 3} text-anchor="end">{aq}</text>
          {/each}
          <line class="normal" x1={M.left} x2={W - M.right} y1={y(normal)} y2={y(normal)} />
          <text class="axis" x={W - M.right} y={y(normal) - 4} text-anchor="end">{copy.normal}</text
          >
          <text class="axis" x={(M.left + W - M.right) / 2} y={H - 2} text-anchor="middle"
            >{copy.volumeAxis}</text
          >
          <text
            class="axis"
            x={-(M.top + H - M.bottom) / 2}
            y="9"
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
          {#each list as entry (entry.id)}
            {@const color = colourOf(entry.id)}
            <circle
              class="dot"
              class:chosen={color !== null}
              cx={x(entry.volume_cm3)}
              cy={y(entry.aq)}
              r={color ? 5 : 3.25}
              style:fill={color ?? undefined}
              role="button"
              data-case={entry.id}
              tabindex={entry.id === focusable ? 0 : -1}
              aria-pressed={color !== null}
              aria-label={copy.dot(
                title(entry),
                volume(entry.volume_cm3),
                share(shareOf(entry, region.id)),
              )}
              onclick={() => {
                focused = entry.id;
                store.toggle(entry.id);
              }}
              onkeydown={(event) => onDotKey(event, entry.id)}
            ></circle>
          {/each}
        </svg>
        <p class="detail-note">{copy.plotHint}</p>

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
    .case-plot {
      display: block;
      width: 100%;
      height: auto;
      margin-top: var(--space-3);
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
      font-size: 9px;
      font-variant-numeric: tabular-nums;
    }
    .case-plot .dot {
      fill: var(--text-secondary);
      fill-opacity: 0.55;
      cursor: pointer;
    }
    .case-plot .dot:focus-visible {
      fill-opacity: 1;
      outline: none;
      stroke: var(--text-primary);
      stroke-width: 1;
    }
    @media (hover: hover) and (pointer: fine) {
      .case-plot .dot:hover {
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
    .case-plot .dot:focus-visible {
      stroke: var(--accent);
      stroke-width: 2;
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
</style>
