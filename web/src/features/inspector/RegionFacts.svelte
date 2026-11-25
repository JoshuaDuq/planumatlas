<!--
  The datasheet (index.html:359-363, inspector.js:314-320): the metric by region kind, the centroid
  and the source label. A description list, not a table: it has one dimension. It is one closed row,
  "Measurements and source", whose summary gives the metric (2026-11-20 review: a reader new to the
  region reads what it is first); the row stays mounted from one region to the next, open or closed.
-->
<script lang="ts">
  import type { Language, Region } from '../../lib/types/index.ts';
  import { decimal, formatRas, quantity, withUnit } from '../../lib/core/format.ts';
  import type { RegionThicknessStore } from '../../lib/state/cortical-thickness.svelte.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import CopyValue from '../../lib/ui/CopyValue.svelte';
  import Disclosure from '../../lib/ui/Disclosure.svelte';
  import SourceLabel from './SourceLabel.svelte';

  let {
    region,
    lang,
    centroid,
    thickness = null,
  }: {
    region: Region & { atlas: string };
    lang: Language;
    /** RAS millimetres, or null where the model has no centroid. */
    centroid: readonly number[] | null;
    /** A cortical region's thickness, downloaded when the measurements first open; null for none. */
    thickness?: RegionThicknessStore | null;
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
  $effect(() => {
    if (open) thickness?.load();
  });
  const thicknessText = $derived.by(() => {
    const state = thickness?.state;
    if (state?.status !== 'ready') return state?.status === 'error' ? ABSENT : '…';
    const measured = state.data.get(region.id);
    return measured
      ? `${decimal(measured.mean, 2, lang)} ± ${withUnit(decimal(measured.sd, 2, lang), 'mm', lang)}`
      : ABSENT;
  });
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
      {#if thickness}
        <dt>{copy.meanThickness}</dt>
        <dd class="measure">
          {#if thicknessText === '…'}{thicknessText}{:else}{@render value(thicknessText)}{/if}
        </dd>
      {/if}
      <dt>{copy.centroid}</dt>
      <dd class="measure">{@render value(centroid ? formatRas(centroid, lang) : ABSENT)}</dd>
      {#key `${region.id}:${lang}`}
        <SourceLabel {region} {lang} />
      {/key}
    </dl>
  </Disclosure>
</div>
