<!--
  The count and lengths of each drawn bundle, after the list rather than under its row, so turning a
  bundle on or off never moves the keys below it. Each line is the description its key points to,
  rendered only while the bundle is drawn (deviations/t1-metrics-only-while-drawn.md); the name is
  shown for the eye and left out of the description, which the key's own name already gives.
-->
<script lang="ts">
  import type { TractBundle as LoadedBundle } from '../../lib/engine/api.ts';
  import { bundleName, lengthSummary } from '../../lib/core/tracts.ts';
  import type { TractRow } from '../../lib/core/tracts.ts';
  import type { Language } from '../../lib/types/index.ts';

  let {
    rows,
    lang,
    loaded,
    text,
    hidden,
  }: {
    /** Every row in the list's order, whether or not the search keeps it. */
    rows: readonly TractRow[];
    lang: Language;
    loaded: ReadonlyMap<string, LoadedBundle>;
    text: {
      drawnHeading: string;
      streamlines: (shown: number, total: number) => string;
      mean: string;
      range: string;
      noShown: string;
    };
    /** Out of sight while a search narrows the rows; the keys' descriptions still resolve. */
    hidden: boolean;
  } = $props();

  const drawn = $derived(
    rows
      .flatMap((row) => row.members)
      .flatMap(({ bundle }) => {
        const metrics = loaded.get(bundle.id);
        return metrics?.visible ? [{ bundle, metrics }] : [];
      }),
  );
</script>

{#if drawn.length}
  <div class="drawn" role="group" aria-labelledby="native-tract-drawn-heading" {hidden}>
    <h4 class="drawn-heading" id="native-tract-drawn-heading">{text.drawnHeading}</h4>
    {#each drawn as { bundle, metrics } (bundle.id)}
      <p class="meta" id="native-diffusion-bundle-{bundle.id}-meta">
        <span class="meta-name" aria-hidden="true">{bundleName(bundle, lang)}</span>
        <span class="values">
          <span class="count">{text.streamlines(metrics.shown, metrics.total)}</span>
          <span class="length"
            ><span>{metrics.shown ? lengthSummary(metrics, text, lang) : text.noShown}</span></span
          >
        </span>
      </p>
    {/each}
  </div>
{/if}

<style>
  @layer features {
    .drawn {
      padding-bottom: var(--space-2);
    }
    /* One drawn bundle: its name, then the values on the line below, at the list's inset. */
    .meta {
      display: grid;
      padding: var(--space-1) var(--panel-inset);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      color: var(--text-secondary);
      font-variant-numeric: tabular-nums;
    }
    .meta-name {
      color: var(--text-primary);
      font-weight: 500;
      overflow-wrap: anywhere;
    }
    .values {
      display: flex;
      flex-wrap: wrap;
      column-gap: var(--space-2);
      overflow-x: clip;
    }
    .values > * {
      min-width: 0;
    }
    .length {
      display: contents;
    }
    .length > span {
      position: relative;
      white-space: normal;
    }
    /* The dot is centred in the gap, so one that would start a wrapped line falls outside the clip. */
    .length > span::before {
      content: '·';
      content: '·' / '';
      position: absolute;
      left: -5.5px;
      color: var(--text-tertiary);
    }
  }
</style>
