<!--
  The reader's series in this region: its mean at each volume, over the region's whole millimetres
  the map has a value at, before the threshold (a voxelwise threshold says nothing of a mean). The
  plot is one slider in the tab order: pointing or the arrows choose the volume drawn on the stage.
  Only a series has the section; it stays mounted so its open state survives a new selection.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { grouped } from '../../lib/core/format.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import type { MapCourse } from '../../lib/core/user-map/course.ts';
  import { mapNumber } from '../../lib/core/user-map/display.ts';
  import type { UserMapStore } from '../../lib/state/user-map.svelte.ts';
  import type { Language, Region } from '../../lib/types/index.ts';
  import Disclosure from '../../lib/ui/Disclosure.svelte';
  import { volumeParts } from '../user-map/key.ts';

  let {
    region,
    lang,
    map,
    label,
  }: {
    region: Region | null;
    lang: Language;
    map: UserMapStore;
    label: (id: string) => { name: string };
  } = $props();

  type CourseState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'ready'; data: MapCourse | null }
    | { status: 'error' };

  const HEIGHT = 128;
  const PAD = { top: 8, right: 8, bottom: 22, left: 44 };

  let open = $state(true);
  let course = $state.raw<CourseState>({ status: 'idle' });
  let request = 0;
  let width = $state(0);
  let hover = $state<number | null>(null);

  const copy = $derived(t(lang, 'overlay'));
  // A new object for each map read, so a map read again in another template is read again here.
  const series = $derived(
    map.state.status === 'ready' && map.state.summary.volumes > 1 ? map.state : null,
  );

  // The course is read again for another region or map only: the selection and the store are handed in
  // again whenever the session changes, as it does for each volume placed, and the plot must stay.
  const regionId = $derived(region?.id);

  $effect(() => {
    const id = regionId;
    const loaded = series;
    const ask = ++request;
    if (!id || !loaded) {
      course = { status: 'idle' };
      return;
    }
    course = { status: 'loading' };
    untrack(() => map.course(id)).then(
      (data) => {
        if (ask === request) course = { status: 'ready', data };
      },
      (error: Error) => {
        if (ask !== request || error.name === 'AbortError') return;
        console.error(error);
        course = { status: 'error' };
      },
    );
  });

  const data = $derived(course.status === 'ready' ? course.data : null);
  const means = $derived(data ? Array.from(data.means) : []);
  const valued = $derived(means.filter(Number.isFinite));
  const count = $derived(means.length);
  const volume = $derived(Math.min(map.volume, count - 1));

  // The axis holds zero, so a mean's sign reads at a glance.
  const low = $derived(Math.min(0, ...valued));
  const high = $derived.by(() => {
    const highest = Math.max(0, ...valued);
    return highest === low ? low + 1 : highest;
  });
  const plotWidth = $derived(Math.max(0, width - PAD.left - PAD.right));
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (index: number) => PAD.left + (count > 1 ? (index / (count - 1)) * plotWidth : 0);
  const y = (value: number) => PAD.top + ((high - value) / (high - low)) * plotHeight;
  // Zero, and each end far enough from it for its label.
  const ticks = $derived(
    [...new Set([high, 0, low])].filter((tick) => tick === 0 || Math.abs(y(tick) - y(0)) >= 14),
  );

  // Each run of volumes with a value is its own stroke; a volume without one breaks the line.
  const path = $derived(
    means
      .map((value, index) => {
        if (!Number.isFinite(value)) return '';
        const move = index === 0 || !Number.isFinite(means[index - 1]!) ? 'M' : 'L';
        return `${move}${x(index).toFixed(1)} ${y(value).toFixed(1)}`;
      })
      .join(''),
  );

  const at = (index: number) => {
    const [place, total, time] = volumeParts(series!.summary, index, lang);
    return time ?? `${place}/${total}`;
  };
  const value = (index: number) => {
    const mean = means[index]!;
    if (!Number.isFinite(mean)) return copy.courseNoValue;
    return `${map.statistic ? `${map.statistic} ` : ''}${mapNumber(mean, lang)}`;
  };
  const readout = (index: number) => copy.courseValue(at(index), value(index));
  const shown = $derived(hover ?? volume);

  function nearest(event: MouseEvent): number {
    const box = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
    const share = plotWidth ? (event.clientX - box.left - PAD.left) / plotWidth : 0;
    return Math.max(0, Math.min(count - 1, Math.round(share * (count - 1))));
  }

  const STEPS: Record<string, (current: number) => number> = {
    ArrowLeft: (current) => current - 1,
    ArrowDown: (current) => current - 1,
    ArrowRight: (current) => current + 1,
    ArrowUp: (current) => current + 1,
    Home: () => 0,
    End: () => count - 1,
  };
  function onkeydown(event: KeyboardEvent) {
    const step = STEPS[event.key];
    if (!step) return;
    event.preventDefault();
    map.setVolume(Math.max(0, Math.min(count - 1, step(volume))));
  }
</script>

{#if series && region}
  <div class="evidence-section">
    <Disclosure variant="section" summary={copy.course} bind:open>
      {#if course.status === 'loading'}
        <p class="detail-note" role="status">{copy.courseLoading}</p>
      {:else if course.status === 'error'}
        <p class="detail-note">{copy.courseFailed}</p>
      {:else if course.status === 'ready' && data === null}
        <p class="detail-note">{copy.courseNone}</p>
      {:else if data && !valued.length}
        <p class="detail-note">{copy.courseEmpty}</p>
      {:else if data}
        <p class="detail-note">{copy.courseIntro(map.title)}</p>
        <p class="readout" aria-hidden="true">{readout(shown)}</p>
        <div class="plot" bind:clientWidth={width}>
          {#if width}
            <svg
              {width}
              height={HEIGHT}
              role="slider"
              tabindex="0"
              aria-label={copy.courseLabel(map.title, label(region.id).name)}
              aria-valuemin={1}
              aria-valuemax={count}
              aria-valuenow={volume + 1}
              aria-valuetext={readout(volume)}
              {onkeydown}
              onpointermove={(event) => (hover = nearest(event))}
              onpointerleave={() => (hover = null)}
              onclick={(event) => map.setVolume(nearest(event))}
            >
              {#each ticks as tick (tick)}
                <line class="grid" x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} />
                <text class="tick" x={PAD.left - 6} y={y(tick)} text-anchor="end" dy="0.32em"
                  >{mapNumber(tick, lang)}</text
                >
              {/each}
              <text class="tick" x={x(0)} y={HEIGHT - 6} text-anchor="start">{at(0)}</text>
              <text class="tick" x={x(count - 1)} y={HEIGHT - 6} text-anchor="end"
                >{at(count - 1)}</text
              >
              {#if hover !== null && hover !== volume}
                <line
                  class="crosshair"
                  x1={x(hover)}
                  x2={x(hover)}
                  y1={PAD.top}
                  y2={PAD.top + plotHeight}
                />
              {/if}
              <line
                class="current"
                x1={x(volume)}
                x2={x(volume)}
                y1={PAD.top}
                y2={PAD.top + plotHeight}
              />
              <path class="course" d={path} />
              {#if Number.isFinite(means[volume]!)}
                <circle class="marker" cx={x(volume)} cy={y(means[volume]!)} r="4" />
              {/if}
            </svg>
          {/if}
        </div>
        <p class="detail-note">
          {copy.courseCounts(grouped(data.counts[volume]!), grouped(data.points))}
        </p>
        <Disclosure summary={copy.courseValues}>
          <table class="values">
            <thead>
              <tr>
                <th scope="col">{copy.volume}</th>
                {#if series.summary.secondsPerVolume !== null}<th scope="col">{copy.courseTime}</th
                  >{/if}
                <th scope="col">{copy.courseMean(map.statistic)}</th>
                <th scope="col">{copy.courseValued}</th>
              </tr>
            </thead>
            <tbody>
              {#each means as mean, index (index)}
                {@const [place, , time] = volumeParts(series.summary, index, lang)}
                <tr aria-current={index === volume ? 'true' : undefined}>
                  <td>{place}</td>
                  {#if time !== null}<td>{time}</td>{/if}
                  <td>{Number.isFinite(mean) ? mapNumber(mean, lang) : '—'}</td>
                  <td>{grouped(data.counts[index]!)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </Disclosure>
      {/if}
    </Disclosure>
  </div>
{/if}

<style>
  @layer features {
    .readout {
      margin: var(--space-2) 0 0;
      color: var(--text-primary);
      font-size: var(--text-caption);
      font-variant-numeric: tabular-nums;
    }
    .plot {
      margin-top: var(--space-1);
    }
    svg {
      display: block;
      cursor: pointer;
      touch-action: none;
    }
    svg:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
      border-radius: var(--radius-control);
    }
    .grid {
      stroke: var(--border-subtle);
      stroke-width: 1;
    }
    .tick {
      fill: var(--text-tertiary);
      font-size: var(--text-caption);
      font-variant-numeric: tabular-nums;
    }
    .crosshair {
      stroke: var(--text-tertiary);
      stroke-width: 1;
    }
    .current {
      stroke: var(--accent);
      stroke-width: 1;
    }
    .course {
      fill: none;
      stroke: var(--text-primary);
      stroke-width: 2;
      stroke-linejoin: round;
      stroke-linecap: round;
    }
    .marker {
      fill: var(--accent);
      stroke: var(--surface-base);
      stroke-width: 2;
    }
    .values {
      width: 100%;
      margin-top: var(--space-2);
      border-collapse: collapse;
      font-size: var(--text-caption);
      font-variant-numeric: tabular-nums;
    }
    .values th,
    .values td {
      padding: var(--space-1) var(--space-2);
      border-bottom: 1px solid var(--border-subtle);
      text-align: right;
    }
    .values th {
      color: var(--text-secondary);
      font-weight: 600;
    }
    .values tr[aria-current='true'] td {
      color: var(--text-primary);
      font-weight: 600;
    }
  }
</style>
