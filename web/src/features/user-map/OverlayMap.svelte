<!--
  One of the reader's maps in the Overlay popover: its summary, the threshold and top of its colour
  scale typed in the map's own units, its colours, and its folded settings. A statistical map is drawn
  once a threshold is typed, and the field takes focus when the map is ready to ask for it.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { UNSTATED } from '../../lib/core/coordinates/spaces.ts';
  import { formatRas, grouped, parseDecimal, percent, withUnit } from '../../lib/core/format.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import { readIn } from '../../lib/core/coordinates/spaces.ts';
  import { clusterCsv, peakLabel } from '../../lib/core/user-map/cluster-csv.ts';
  import {
    COLOUR_SCALE_IDS,
    CORTEX_SURFACES,
    STATISTICS,
    mapNumber,
    validDisplay,
    volumeParts,
  } from '../../lib/core/user-map/display.ts';
  import type { ColourScale, CortexSurface, Statistic } from '../../lib/core/user-map/display.ts';
  import type { MapLayer, UserMapState, UserMapStore } from '../../lib/state/user-map.svelte.ts';
  import type { CoordinateSpaces, Language } from '../../lib/types/index.ts';
  import Disclosure from '../../lib/ui/Disclosure.svelte';
  import RangeField from '../../lib/ui/RangeField.svelte';
  import { downloadText } from '../../lib/ui/download.ts';
  import Select from '../../lib/ui/Select.svelte';
  import Switch from '../../lib/ui/Switch.svelte';

  let {
    layer,
    ready,
    map,
    spaces,
    lang,
    onPlace,
    askThreshold,
  }: {
    layer: MapLayer;
    /** The layer's state, which holds a map. */
    ready: Extract<UserMapState, { status: 'ready' }>;
    map: UserMapStore;
    spaces: CoordinateSpaces;
    lang: Language;
    /** Place a peak (template mm) as a published coordinate and show its report. */
    onPlace: (mm: [number, number, number], space: string) => void;
    /** The file was just read: a map without a threshold asks for one by focusing its field. */
    askThreshold: boolean;
  } = $props();

  /** Peaks listed here; the CSV holds them all. */
  const LISTED = 20;

  const uid = $props.id();
  const spaceId = `overlay-space-${uid}`;
  const titleId = `overlay-title-${uid}`;
  const titleHintId = `overlay-title-hint-${uid}`;
  const statisticId = `overlay-statistic-${uid}`;
  const coloursId = `overlay-colours-${uid}`;
  const sizeId = `overlay-size-${uid}`;
  const sizeHintId = `overlay-size-hint-${uid}`;
  const sizeInvalidId = `overlay-size-invalid-${uid}`;
  const surfaceId = `overlay-surface-${uid}`;
  const surfaceHintId = `overlay-surface-hint-${uid}`;
  const thresholdId = `overlay-threshold-${uid}`;
  const maxId = `overlay-max-${uid}`;
  const hintId = `overlay-hint-${uid}`;
  const invalidId = `overlay-invalid-${uid}`;

  const copy = $derived(t(lang, 'overlay'));
  const options = $derived([
    ...spaces.spaces.map(({ id, label, description }) => ({
      value: id,
      label,
      title: description,
    })),
    { value: UNSTATED, label: t(lang, 'coordinate').unstated },
  ]);
  const statistics = $derived([
    { value: '', label: copy.value },
    ...STATISTICS.map((statistic) => ({ value: statistic, label: statistic })),
  ]);
  const surfaces = $derived(
    CORTEX_SURFACES.map((surface) => ({ value: surface, label: copy.surfaces[surface] })),
  );
  const scales = $derived(
    COLOUR_SCALE_IDS.map((scale) => ({ value: scale, label: copy.colourScales[scale] })),
  );
  // The other map, while both are loaded: this one covers it, or is covered by it.
  const other = $derived(
    map.listed.find((entry) => entry.slot !== layer.slot && entry.state.status === 'ready'),
  );

  let thresholdField = $state<HTMLInputElement>();
  // A number as the field shows it: none yet is an empty field.
  const shown = (value: number) => (Number.isFinite(value) ? mapNumber(value, lang) : '');
  // What the reader typed, kept as typed until it reads as a number.
  let thresholdText = $state(untrack(() => shown(layer.settings.threshold)));
  let maxText = $state(untrack(() => shown(layer.settings.max)));
  // A new map's defaults replace what was typed for the last one.
  $effect(() => {
    const { threshold, max } = layer.settings;
    untrack(() => {
      if (!Object.is(parseDecimal(thresholdText), threshold)) thresholdText = shown(threshold);
      if (!Object.is(parseDecimal(maxText), max)) maxText = shown(max);
    });
  });
  // A statistical map waits for its threshold: the field takes focus once the file is read.
  $effect(() => {
    if (askThreshold && !Number.isFinite(layer.settings.threshold)) {
      untrack(() => thresholdField?.focus());
    }
  });
  const typed = $derived({
    ...layer.settings,
    threshold: parseDecimal(thresholdText),
    max: parseDecimal(maxText),
  });
  // An empty threshold is not yet an error: the hint asks for one.
  const invalid = $derived(thresholdText.trim() !== '' && !validDisplay(typed));

  function apply() {
    layer.setSettings(typed);
  }

  // Typed as a number of voxels; applied once it reads as a whole number of them.
  let sizeText = $state(untrack(() => String(layer.minVoxels)));
  const sizeInvalid = $derived(!/^\s*\d+\s*$/.test(sizeText));
  function applySize() {
    if (!sizeInvalid) layer.setMinVoxels(Number(sizeText));
  }

  let settingsOpen = $state(false);
  const settingsLine = $derived(
    copy.settingsLine(
      options.find(({ value }) => value === layer.space)!.label,
      layer.statistic ?? copy.value,
      layer.minVoxels > 1 ? copy.captionMinVoxels(String(layer.minVoxels)) : copy.everyCluster,
      copy.surfaces[map.surface],
    ),
  );

  let clustersOpen = $state(false);
  const peaks = $derived(
    layer.clusters.status === 'ready'
      ? layer.clusters.data.flatMap((cluster) =>
          cluster.peaks.map((peak, index) => ({
            label: peakLabel(cluster, index).replace('-', '−'),
            ...peak,
            size: index ? null : cluster.sizeMm3,
          })),
        )
      : [],
  );
  const statisticValue = (value: number) =>
    `${layer.statistic ? `${layer.statistic} ` : ''}${mapNumber(value, lang)}`;

  function download() {
    if (layer.clusters.status !== 'ready') return;
    downloadText(
      clusterCsv(layer.clusters.data, {
        file: ready.name,
        template: readIn(spaces, layer.space).id,
        statistic: layer.statistic,
        threshold: layer.clusters.threshold,
      }),
      `planum-clusters-${layer.title.replace(/[^\w.-]+/g, '_')}.csv`,
      'text/csv;charset=utf-8',
    );
  }

  function summary(): string {
    const { shape, voxelMm, range, binary, cortexCovered, volumes, secondsPerVolume } =
      ready.summary;
    const voxel = withUnit(
      voxelMm.map((edge: number) => mapNumber(edge, lang)).join(' × '),
      'mm',
      lang,
    );
    const every =
      secondsPerVolume === null ? null : withUnit(mapNumber(secondsPerVolume, lang), 's', lang);
    return [
      copy.shape(shape.join(' × '), voxel),
      ...(volumes > 1 ? [copy.series(grouped(volumes), every)] : []),
      binary ? copy.mask : copy.range(mapNumber(range[0], lang), mapNumber(range[1], lang)),
      copy.reach(percent(cortexCovered, lang)),
    ].join(' · ');
  }
</script>

<p class="name">{ready.name}</p>
<p class="hint">{summary()}</p>
<div class="stage-field">
  <Switch label={copy.show} bind:checked={() => layer.shown, (shown) => layer.setShown(shown)} />
</div>
{#if other}
  <div class="order">
    {#if map.top === layer.slot}
      <p class="hint">{copy.covers(other.title)}</p>
    {:else}
      <p class="hint">{copy.coveredBy(other.title)}</p>
      <button
        type="button"
        class="stage-command stage-command-quiet"
        onclick={() => map.setTop(layer.slot)}
      >
        {copy.onTop}
      </button>
    {/if}
  </div>
{/if}
{#if ready.summary.volumes > 1}
  {@const series = ready.summary}
  <div class="stage-field">
    <RangeField
      label={copy.volume}
      value={layer.volume}
      min={0}
      max={series.volumes - 1}
      format={(volume) => copy.volumeOf(...volumeParts(series, volume, lang))}
      oninput={(volume) => layer.setVolume(volume)}
    />
    <button
      type="button"
      class="stage-command stage-command-quiet play"
      disabled={!layer.drawn}
      onclick={() => layer.setPlaying(!layer.playing)}
    >
      {layer.playing ? copy.pause : copy.play}
    </button>
    <p class="hint">{copy.volumeHint}</p>
  </div>
{/if}
<div class="scale">
  <div>
    <label class="stage-field-label" for={thresholdId}>{copy.threshold}</label>
    <input
      bind:this={thresholdField}
      id={thresholdId}
      type="text"
      inputmode="decimal"
      autocomplete="off"
      aria-invalid={invalid}
      aria-describedby={invalid ? `${invalidId} ${hintId}` : hintId}
      bind:value={thresholdText}
      oninput={apply}
    />
  </div>
  <div>
    <label class="stage-field-label" for={maxId}>{copy.max}</label>
    <input
      id={maxId}
      type="text"
      inputmode="decimal"
      autocomplete="off"
      aria-invalid={invalid}
      aria-describedby={invalid ? invalidId : undefined}
      bind:value={maxText}
      oninput={apply}
    />
  </div>
</div>
<p id={hintId} class="hint">{copy.thresholdHint}</p>
{#if invalid}<p id={invalidId} class="error" role="alert">{copy.invalid}</p>{/if}
<div class="stage-field">
  <RangeField
    label={copy.opacity}
    value={layer.settings.opacity}
    min={0.1}
    max={1}
    step={0.05}
    format={(value) => percent(value, lang)}
    oninput={(opacity) => layer.setSettings({ ...layer.settings, opacity })}
  />
</div>
<div class="stage-field">
  <label class="stage-field-label" for={coloursId}>{copy.colours}</label>
  <Select
    id={coloursId}
    options={scales}
    bind:value={
      () => layer.settings.colours,
      (colours) => layer.setSettings({ ...layer.settings, colours: colours as ColourScale })
    }
  />
</div>
<!-- Set once for a map, so folded; the closed line still says what each is. -->
<div class="stage-field">
  <Disclosure summary={copy.settings} bind:open={settingsOpen}>
    <div class="stage-field">
      <label class="stage-field-label" for={spaceId}>{copy.space}</label>
      <Select
        id={spaceId}
        {options}
        bind:value={() => layer.space, (space) => void layer.setSpace(space)}
      />
    </div>
    <div class="stage-field">
      <label class="stage-field-label" for={titleId}>{copy.title}</label>
      <input
        id={titleId}
        type="text"
        autocomplete="off"
        aria-describedby={titleHintId}
        value={layer.title}
        onchange={(event) => {
          layer.setTitle(event.currentTarget.value);
          event.currentTarget.value = layer.title;
        }}
      />
      <p id={titleHintId} class="hint">{copy.titleHint}</p>
    </div>
    <div class="stage-field">
      <label class="stage-field-label" for={statisticId}>{copy.statistic}</label>
      <Select
        id={statisticId}
        options={statistics}
        bind:value={
          () => layer.statistic ?? '',
          (value) => layer.setStatistic((value || null) as Statistic | null)
        }
      />
    </div>
    <div class="stage-field">
      <label class="stage-field-label" for={sizeId}>{copy.minVoxels}</label>
      <input
        id={sizeId}
        type="text"
        inputmode="numeric"
        autocomplete="off"
        aria-invalid={sizeInvalid}
        aria-describedby={sizeInvalid ? `${sizeInvalidId} ${sizeHintId}` : sizeHintId}
        bind:value={sizeText}
        oninput={applySize}
      />
      <p id={sizeHintId} class="hint">{copy.minVoxelsHint}</p>
      {#if sizeInvalid}
        <p id={sizeInvalidId} class="error" role="alert">{copy.minVoxelsInvalid}</p>
      {/if}
    </div>
    <div class="stage-field">
      <label class="stage-field-label" for={surfaceId}>{copy.surface}</label>
      <Select
        id={surfaceId}
        options={surfaces}
        describedby={surfaceHintId}
        bind:value={() => map.surface, (surface) => map.setSurface(surface as CortexSurface)}
      />
      <p id={surfaceHintId} class="hint">{copy.surfaceHint}</p>
    </div>
  </Disclosure>
  {#if !settingsOpen}<p class="hint settings-line">{settingsLine}</p>{/if}
</div>
{#if layer.clusters.status === 'ready'}
  <div class="stage-field">
    <Disclosure summary={copy.clusters(layer.clusters.data.length)} bind:open={clustersOpen}>
      <p class="hint">{copy.clustersHint}</p>
      {#if peaks.length}
        <ol class="peaks">
          {#each peaks.slice(0, LISTED) as peak (peak.label)}
            <li>
              <button type="button" class="peak" onclick={() => onPlace(peak.mm, layer.space)}>
                <span>
                  {copy.peak(peak.label, statisticValue(peak.value), formatRas(peak.mm, lang))}
                </span>
                {#if peak.size !== null}
                  <span class="size">{copy.clusterSize(grouped(Math.round(peak.size)))}</span>
                {/if}
              </button>
            </li>
          {/each}
        </ol>
        {#if peaks.length > LISTED}
          <p class="hint">{copy.morePeaks(peaks.length - LISTED)}</p>
        {/if}
        <button type="button" class="stage-command stage-command-quiet" onclick={download}>
          {copy.download}
        </button>
      {:else}
        <p class="hint">{copy.clustersNone}</p>
      {/if}
    </Disclosure>
  </div>
{:else if layer.clusters.status === 'loading'}
  <p class="hint" role="status">{copy.clustersLoading}</p>
{:else if layer.clusters.status === 'error'}
  <p class="error">{copy.clustersFailed}</p>
{/if}

<style>
  @layer features {
    .name {
      margin: 0;
      color: var(--overlay-ink);
      font-size: var(--text-ui);
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .hint,
    .error {
      margin: var(--space-2) 0 0;
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      color: var(--overlay-ink-muted);
    }
    /* Under the summary's words, past its chevron's slot and gap. */
    .settings-line {
      margin-top: 0;
      padding-left: calc(12px + var(--space-2));
    }
    .order {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-2);
    }
    .play {
      margin-top: var(--space-2);
    }
    .error {
      color: var(--danger);
      overflow-wrap: anywhere;
    }
    .scale {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-3);
      margin-top: var(--space-4);
    }
    /* Numbers typed in the map's units, so their digits line up. */
    input[type='text'] {
      box-sizing: border-box;
      width: 100%;
      height: var(--control-height);
      padding: 0 var(--space-3);
      border: 1px solid var(--border-control);
      border-radius: var(--radius-control);
      background: var(--surface-base);
      color: var(--text-primary);
      font-size: var(--text-ui);
      font-variant-numeric: tabular-nums;
    }
    input[aria-invalid='true'] {
      border-color: var(--danger);
    }
    @media (hover: hover) and (pointer: fine) {
      input[type='text']:hover:not(:focus) {
        border-color: var(--text-secondary);
      }
    }
    @media (pointer: coarse) {
      input[type='text'] {
        height: 44px;
      }
    }
    .peaks {
      margin: var(--space-2) 0;
      padding: 0;
      list-style: none;
    }
    .peak {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      width: 100%;
      min-height: var(--control-height);
      padding: var(--space-1) var(--space-2);
      border: 0;
      border-radius: var(--radius-control);
      background: none;
      color: var(--overlay-ink);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      font-variant-numeric: tabular-nums;
      text-align: left;
      cursor: pointer;
    }
    @media (hover: hover) and (pointer: fine) {
      .peak:hover {
        background: var(--overlay-plate-hover);
      }
    }
    @media (pointer: coarse) {
      .peak {
        min-height: 44px;
      }
    }
    .size {
      color: var(--overlay-ink-muted);
    }
  }
</style>
