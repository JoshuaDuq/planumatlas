<!--
  Functional networks (inspector.js:139-160): the region's Yeo shares with a bar and a percentage,
  the CAB-NP network that assigns the whole HCP-MMP area, and a striatal structure's shares in each
  network's striatal territory (Choi et al. 2012). Nothing selected leaves the section out: a chart
  of the whole cortex is not a selection. The section stays mounted so its open state survives from
  one selection to the next.
-->
<script lang="ts">
  import type { Language, Region, Rgb, StriatalNetworks } from '../../lib/types/index.ts';
  import {
    cabNpName,
    networkBasis,
    networkCss,
    networkName,
    networksOf,
    striatalNetworksOf,
  } from '../../lib/core/catalog/networks.ts';
  import type { CabNpPartition } from '../../lib/core/catalog/networks.ts';
  import { decimal, percent } from '../../lib/core/format.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import Disclosure from '../../lib/ui/Disclosure.svelte';
  import Swatch from '../../lib/ui/Swatch.svelte';

  let {
    region,
    lang,
    colors,
    cabNp,
    striatal: atlas = null,
  }: {
    region: Region | null;
    lang: Language;
    /** The manifest's Yeo network colours; read only for a region that has shares. */
    colors: Readonly<Record<string, Rgb>> | undefined;
    cabNp: CabNpPartition | null;
    /** The manifest's striatal network atlas, for its confidence threshold. */
    striatal?: StriatalNetworks | null;
  } = $props();

  let open = $state(false);

  const copy = $derived(t(lang, 'networks'));
  const shares = $derived(networksOf(region));
  // CAB-NP assigns a whole HCP-MMP area, so its one network is the area's entire share.
  const assigned = $derived(region ? (cabNp?.regions[region.id] ?? null) : null);
  const striatal = $derived(striatalNetworksOf(region));
  const outside = $derived(region?.striatal_networks_unassigned ?? 0);
  // The closed summary's hint: the largest share the region has, else CAB-NP's one network.
  const headline = $derived.by(() => {
    const top = [...shares, ...striatal].reduce<(typeof shares)[number] | null>(
      (best, share) => (best && best.fraction >= share.fraction ? best : share),
      null,
    );
    if (top) return `${networkName(top.network, lang)} ${percent(top.fraction, lang)}`;
    return assigned ? cabNpName(assigned, lang) : null;
  });

  function yeoColour(network: string): string {
    const rgb = colors?.[network];
    if (!rgb) throw new Error(`No colour published for network ${network}.`);
    return networkCss(rgb);
  }
</script>

<!-- Choi's confidence in this region's voxels, and the authors' warning where it is mostly putamen. -->
{#snippet confidenceNotes()}
  {@const graded = region!.striatal_networks_confidence}
  {#if graded && atlas}
    <p class="detail-note">
      {copy.confidence(
        percent(graded.confident, lang),
        percent(graded.low, lang),
        percent(graded.filled, lang),
      )}
      {copy.confidenceNote(decimal(atlas.minimum_confidence, 2, lang, { trim: true }))}
    </p>
  {/if}
  {#if (region!.striatal_networks_putamen ?? 0) >= 0.5}
    <p class="detail-note">{copy.putamenCaveat}</p>
  {/if}
{/snippet}

{#if shares.length || assigned || striatal.length}
  <div class="evidence-section">
    <Disclosure variant="section" summary={copy.heading} value={headline} bind:open>
      {#if shares.length}
        <p class="network-map">{copy.yeo}</p>
        <ul class="network-list">
          {#each shares as share (share.network)}
            <li class="network-row">
              <Swatch colour={yeoColour(share.network)} />
              <span class="network-row-name">{networkName(share.network, lang)}</span>
              <Swatch kind="bar" share={share.fraction} />
              <span class="network-share measure">{percent(share.fraction, lang)}</span>
            </li>
          {/each}
        </ul>
        {@const basis = networkBasis(region!)}
        {#if basis === 'territory'}
          <p class="detail-note">{copy.territory}</p>
          {@render confidenceNotes()}
          <p class="detail-note">{copy.striatalCaveat}</p>
        {:else}
          <p class="detail-note">{copy.notes[basis]}</p>
        {/if}
      {/if}
      {#if assigned}
        <p class="network-map">{copy.cabNp}</p>
        <ul class="network-list">
          <li class="network-row">
            <Swatch colour={networkCss(cabNp!.colors[assigned])} />
            <span class="network-row-name">{cabNpName(assigned, lang)}</span>
            <Swatch kind="bar" share={1} />
            <span class="network-share measure">{percent(1, lang)}</span>
          </li>
        </ul>
        <p class="detail-note">{copy.cabNpNote}</p>
      {/if}
      {#if striatal.length}
        <p class="network-map">{copy.striatal}</p>
        <ul class="network-list">
          {#each striatal as share (share.network)}
            <li class="network-row">
              <Swatch colour={yeoColour(share.network)} />
              <span class="network-row-name">{networkName(share.network, lang)}</span>
              <Swatch kind="bar" share={share.fraction} />
              <span class="network-share measure">{percent(share.fraction, lang)}</span>
            </li>
          {/each}
        </ul>
        <p class="detail-note">
          {copy.striatalNote}
          {#if outside >= 0.005}{copy.striatalUnassigned(percent(outside, lang))}{/if}
        </p>
        {@render confidenceNotes()}
        <p class="detail-note">{copy.striatalCaveat}</p>
      {/if}
      <p class="detail-note">{copy.caveat}</p>
    </Disclosure>
  </div>
{/if}
