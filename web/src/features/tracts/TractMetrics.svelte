<!--
  A short preview of the drawn bundles, with the full list and measurements in a disclosure.
  Each bundle's measurements describe its checkbox while the bundle is drawn.
-->
<script lang="ts">
  import { grouped } from '../../lib/core/format.ts';
  import type { TractBundle as LoadedBundle } from '../../lib/engine/api.ts';
  import { bundleName, lengthSummary } from '../../lib/core/tracts.ts';
  import type { TractRow } from '../../lib/core/tracts.ts';
  import type { Language } from '../../lib/types/index.ts';
  import Disclosure from '../../lib/ui/Disclosure.svelte';

  const PREVIEW_LIMIT = 2;

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
      drawnMore: (count: number) => string;
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
  let open = $state(false);
</script>

{#if drawn.length}
  <div class="drawn" {hidden}>
    <Disclosure
      summary={text.drawnHeading}
      value={grouped(drawn.length)}
      variant="section"
      bind:open
    >
      {#each drawn as { bundle, metrics } (bundle.id)}
        <p class="meta">
          <span class="meta-name">{bundleName(bundle, lang)}</span>
          <span class="values" id="native-diffusion-bundle-{bundle.id}-meta">
            <span>{text.streamlines(metrics.shown, metrics.total)}</span>
            <span class="length">
              <span>{metrics.shown ? lengthSummary(metrics, text, lang) : text.noShown}</span>
            </span>
          </span>
        </p>
      {/each}
    </Disclosure>
    {#if !open}
      <ul class="preview" role="list">
        {#each drawn.slice(0, PREVIEW_LIMIT) as { bundle } (bundle.id)}
          <li>{bundleName(bundle, lang)}</li>
        {/each}
        {#if drawn.length > PREVIEW_LIMIT}
          <li class="more">{text.drawnMore(drawn.length - PREVIEW_LIMIT)}</li>
        {/if}
      </ul>
    {/if}
  </div>
{/if}

<style>
  @layer features {
    .drawn {
      margin-inline: var(--panel-inset);
      border-bottom: 1px solid var(--border-subtle);
    }
    .drawn > :global(.section) {
      margin-top: 0;
    }
    .preview {
      margin: 0;
      padding: 0 0 var(--space-2);
      list-style: none;
    }
    .more {
      color: var(--text-secondary);
    }
    .preview,
    .meta {
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      overflow-wrap: anywhere;
    }
    /* Each drawn bundle has its name above its measurements. */
    .meta {
      display: grid;
      padding-bottom: var(--space-2);
      color: var(--text-secondary);
      font-variant-numeric: tabular-nums;
    }
    .meta-name {
      color: var(--text-primary);
      font-weight: 500;
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
