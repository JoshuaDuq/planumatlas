<!--
  The datasheet (index.html:359-363, inspector.js:314-320): the metric by region kind, the centroid
  and the source label. A description list, not a table: it has one dimension. It is one closed row,
  "Measurements and source", whose summary gives the metric (2026-11-20 review: a reader new to the
  region reads what it is first); the row stays mounted from one region to the next, open or closed.
-->
<script lang="ts">
  import type { Language, Region } from '../../lib/types/index.ts';
  import { formatRas, quantity } from '../../lib/core/format.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import CopyValue from '../../lib/ui/CopyValue.svelte';
  import Disclosure from '../../lib/ui/Disclosure.svelte';
  import SourceLabel from './SourceLabel.svelte';

  let {
    region,
    lang,
    centroid,
  }: {
    region: Region & { atlas: string };
    lang: Language;
    /** RAS millimetres, or null where the model has no centroid. */
    centroid: readonly number[] | null;
  } = $props();

  const copy = $derived(t(lang, 'inspector'));
  // A structure or a cut region is measured by its volume; a cortical area by its surface.
  const byVolume = $derived(region.kind === 'structure' || region.kind === 'tissue-region');
  const metric = $derived(
    byVolume
      ? quantity(region.segmentation_volume_mm3, 'mm³', lang)
      : quantity(region.surface_area_mm2, 'mm²', lang),
  );
  const ABSENT = '—';
  let open = $state(false);
</script>

{#snippet value(text: string)}
  {#if text === ABSENT}{text}{:else}<CopyValue value={text} words={copy.copyValue} />{/if}
{/snippet}

<div class="evidence-section measurements">
  <Disclosure
    variant="section"
    summary={copy.measurements}
    value={metric === ABSENT ? null : metric}
    bind:open
  >
    <dl class="facts">
      <dt>{byVolume ? copy.volume : copy.surfaceArea}</dt>
      <dd class="fact-metric measure">{@render value(metric)}</dd>
      <dt>{copy.centroid}</dt>
      <dd class="measure">{@render value(centroid ? formatRas(centroid, lang) : ABSENT)}</dd>
      {#key `${region.id}:${lang}`}
        <SourceLabel {region} {lang} />
      {/key}
    </dl>
  </Disclosure>
</div>
