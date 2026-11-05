<!--
  Stimulation responses for a Julich-Brain area (F-TRACT v2307): how often stimulating it evoked a
  response in each other area, or stimulating another evoked one here, on the same or the opposite
  side. Drawn rates come first, highest first, the first few shown and the rest behind a disclosure;
  areas too thinly tested or never tested are counted. Only a region that takes an F-TRACT area has
  the section; it stays mounted so its choices survive a new selection.
-->
<script lang="ts">
  import type { Language, Region } from '../../lib/types/index.ts';
  import {
    ftractParcelName,
    ftractParcelOf,
    ftractRows,
    type FtractRow,
    type StimulationFtract,
  } from '../../lib/core/catalog/stimulation-ftract.ts';
  import type { Direction, Side } from '../../lib/core/catalog/stimulation-responses.ts';
  import { grouped, percent } from '../../lib/core/format.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import ChoiceGroup from '../../lib/ui/ChoiceGroup.svelte';
  import Disclosure from '../../lib/ui/Disclosure.svelte';
  import { iconGraphic } from '../../lib/ui/IconButton.svelte';
  import Swatch from '../../lib/ui/Swatch.svelte';

  let {
    region,
    lang,
    ftract,
  }: {
    region: Region | null;
    lang: Language;
    ftract: StimulationFtract | null;
  } = $props();

  const FIRST_ROWS = 10;

  let open = $state(false);
  let moreOpen = $state(false);
  let direction = $state<Direction>('from');
  let side = $state<Side>('same');

  const copy = $derived(t(lang, 'stimulation'));
  const parcel = $derived(region ? ftractParcelOf(ftract, region.id) : null);
  const rows = $derived(parcel === null ? null : ftractRows(ftract!, parcel, direction, side));
  const directionOptions = $derived(
    (['from', 'to'] as const).map((value) => ({ value, label: copy[value] })),
  );
  const sideOptions = $derived(
    (['same', 'opposite'] as const).map((value) => ({ value, label: copy[value] })),
  );
</script>

{#snippet row(entry: FtractRow)}
  <li class="network-row stimulation-row">
    <span class="network-row-name"
      >{entry.parcel === parcel
        ? copy.within
        : ftractParcelName(ftract!.parcels[entry.parcel]!, lang)}</span
    >
    <Swatch kind="bar" share={entry.rate} />
    <span class="network-share measure">{percent(entry.rate, lang)}</span>
    <span class="functional-row-meta stimulation-counts">
      {copy.ftractCounts(grouped(entry.tested), entry.implantations)}
    </span>
  </li>
{/snippet}

{#if parcel !== null && rows}
  <div class="evidence-section">
    <Disclosure variant="section" summary={copy.heading} bind:open>
      <ChoiceGroup
        class="stimulation-choice"
        label={copy.direction}
        options={directionOptions}
        bind:value={direction}
      />
      <ChoiceGroup
        class="stimulation-choice"
        label={copy.side}
        options={sideOptions}
        bind:value={side}
      />
      {#if rows.drawn.length}
        <ul class="network-list">
          {#each rows.drawn.slice(0, FIRST_ROWS) as entry (entry.parcel)}
            {@render row(entry)}
          {/each}
        </ul>
        {#if rows.drawn.length > FIRST_ROWS}
          <Disclosure summary={copy.more(rows.drawn.length - FIRST_ROWS)} bind:open={moreOpen}>
            <ul class="network-list">
              {#each rows.drawn.slice(FIRST_ROWS) as entry (entry.parcel)}
                {@render row(entry)}
              {/each}
            </ul>
          </Disclosure>
        {/if}
      {:else}
        <p class="detail-note">{copy.none}</p>
      {/if}
      <p class="detail-note">{copy.ftractRest(rows.tooFew, rows.untested)}</p>
      <p class="detail-note">
        {copy.ftractNote(ftract!.people, ftract!.min_pairs, ftract!.min_implantations)}
      </p>
      <p class="detail-note">{copy.ftractBasis(ftract!.parcels[parcel]!.name)}</p>
      <div class="stimulation-sources">
        <a href={ftract!.source.dataset} target="_blank" rel="noopener noreferrer"
          >{copy.ftractDataset}<span class="visually-hidden">{` ${t(lang, 'link').newTab}`}</span
          >{@render iconGraphic('external-link')}</a
        >
        <a href={ftract!.source.doi} target="_blank" rel="noopener noreferrer"
          >{copy.ftractMethod}<span class="visually-hidden">{` ${t(lang, 'link').newTab}`}</span
          >{@render iconGraphic('external-link')}</a
        >
      </div>
    </Disclosure>
  </div>
{/if}
