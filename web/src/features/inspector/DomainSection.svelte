<!--
  Neuropsychological domains (inspector.js:207-235): the domains an HCP-MMP area or a sampled
  structure reaches the threshold for, strongest first, each with its z. A scored region that
  reaches none says so. The section stays mounted so its open state survives from one selection
  to the next.
-->
<script lang="ts">
  import { tick } from 'svelte';
  import type { Language, Region } from '../../lib/types/index.ts';
  import { networkCss } from '../../lib/core/catalog/networks.ts';
  import {
    domainName,
    functionsAt,
    scoredRegion,
    type NeuropsychDomains,
  } from '../../lib/core/catalog/neuropsych-domains.ts';
  import { decimal } from '../../lib/core/format.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import Disclosure from '../../lib/ui/Disclosure.svelte';
  import ShowAll from '../../lib/ui/ShowAll.svelte';
  import Swatch from '../../lib/ui/Swatch.svelte';
  import { REGION_ROWS_SHOWN } from '../functions/functions-view.ts';

  let {
    region,
    lang,
    domains,
  }: { region: Region | null; lang: Language; domains: NeuropsychDomains | null } = $props();

  let open = $state(false);

  const copy = $derived(t(lang, 'domains'));
  const scored = $derived(domains !== null && region !== null && scoredRegion(domains, region));
  // Highest z first and the first eight, as the Functions list shows them (supervisor review 1.1).
  const found = $derived(scored ? functionsAt(domains!, region!.id) : []);
  let unfolded = $state(false);
  let rows = $state<HTMLElement>();
  $effect.pre(() => {
    void region?.id;
    unfolded = false;
  });
  const shown = $derived(unfolded ? found : found.slice(0, REGION_ROWS_SHOWN));
  const note = $derived.by(() => {
    if (!scored) return '';
    const sources = domains!.sources as Record<string, { short: string }>;
    const source = sources[domains!.scores_source as string]!.short;
    const atlas = region!.atlas as string;
    const basis =
      atlas === domains!.atlas
        ? copy.note
        : domains!.region_atlases.includes(atlas)
          ? (from: string) =>
              copy.noteAtlas((t(lang, 'header').atlasShort as Record<string, string>)[atlas]!, from)
          : copy.noteStructure;
    const unit = region!.id in domains!.units && copy.noteUnit;
    return [!found.length && copy.none(decimal(domains!.threshold_z, 0, lang)), basis(source), unit]
      .filter(Boolean)
      .join(' ');
  });
</script>

{#if scored}
  <div class="evidence-section">
    <Disclosure variant="section" summary={copy.heading} value={String(found.length)} bind:open>
      <!-- "Show all" leaves as it adds the rest: the list takes focus in its place. -->
      <ul class="network-list" tabindex="-1" bind:this={rows}>
        {#each shown as record (record.id)}
          <li class="network-row functional-row">
            <Swatch colour={networkCss(record.color)} />
            <span class="network-row-name">
              <span>{domainName(record, lang)}</span>
              <span class="functional-row-meta"
                >{copy.score(record.term, decimal(record.z, 1, lang))}</span
              >
            </span>
          </li>
        {/each}
      </ul>
      {#if shown.length < found.length}
        <ShowAll
          label={t(lang, 'navigator').showAll(found.length)}
          inset={false}
          onclick={async () => {
            unfolded = true;
            await tick();
            rows?.focus();
          }}
        />
      {/if}
      <p class="detail-note">{note}</p>
    </Disclosure>
  </div>
{/if}
