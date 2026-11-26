<!--
  Typical arterial supply: the share of the selected region in each arterial territory the
  registered Liu et al. (2023) atlas draws, by its pial vertices for a cortical area and its voxels
  otherwise. A structure too small for shares names the territories within the registration's
  landing error of it. A region the atlas does not reach has no section; it stays mounted so its
  open state survives from one selection to the next.
-->
<script lang="ts">
  import type { ArterialTerritories, Language, Region } from '../../lib/types/index.ts';
  import { networkCss } from '../../lib/core/catalog/networks.ts';
  import { decimal, grouped, percent, withUnit } from '../../lib/core/format.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import Disclosure from '../../lib/ui/Disclosure.svelte';
  import Swatch from '../../lib/ui/Swatch.svelte';

  let {
    region,
    lang,
    territories,
  }: {
    region: Region | null;
    lang: Language;
    territories: ArterialTerritories | null;
  } = $props();

  let open = $state(false);

  const copy = $derived(t(lang, 'territories'));
  const shares = $derived(territories ? (region?.territories ?? []) : []);
  const rest = $derived(region?.territory_unassigned ?? 0);
  const near = $derived(territories ? (region?.territories_near ?? []) : []);
  const radius = $derived(
    withUnit(decimal(territories?.small?.radius_mm ?? 0, 1, lang, { trim: true }), 'mm', lang),
  );

  function territory(id: string) {
    const found = territories!.territories.find((entry) => entry.id === id);
    if (!found) throw new Error(`No arterial territory ${id} is published.`);
    return found;
  }
</script>

{#if shares.length}
  <div class="evidence-section">
    <Disclosure variant="section" summary={copy.heading} bind:open>
      <ul class="network-list">
        {#each shares as share (share.territory)}
          {@const entry = territory(share.territory)}
          <li class="network-row">
            <Swatch colour={networkCss(entry.color)} />
            <span class="network-row-name">{lang === 'fr' ? entry.name_fr : entry.name}</span>
            <Swatch kind="bar" share={share.fraction} />
            <span class="network-share measure">{percent(share.fraction, lang)}</span>
          </li>
        {/each}
      </ul>
      <p class="detail-note">
        {copy.basis[region!.kind === 'cortex' ? 'vertices' : 'voxels']}
        {#if rest >= 0.005}{copy.unassigned(percent(rest, lang))}{/if}
      </p>
      <p class="detail-note">{copy.caveat}</p>
    </Disclosure>
  </div>
{:else if near.length}
  <div class="evidence-section">
    <Disclosure variant="section" summary={copy.heading} bind:open>
      <ul class="network-list">
        {#each near as id (id)}
          {@const entry = territory(id)}
          <li class="network-row">
            <Swatch colour={networkCss(entry.color)} />
            <span class="network-row-name unshared">
              {lang === 'fr' ? entry.name_fr : entry.name}
            </span>
          </li>
        {/each}
      </ul>
      <p class="detail-note">
        {near.length === 1 ? copy.within(radius) : copy.border(radius)}
        {copy.small(withUnit(grouped(territories!.small!.under_mm3), 'mm³', lang), radius)}
      </p>
      <p class="detail-note">{copy.caveat}</p>
    </Disclosure>
  </div>
{/if}
