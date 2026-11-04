<!--
  Stimulation responses (Lyu et al. 2025): for the authors' label this region takes, how often
  stimulating it evoked a response elsewhere, or stimulating elsewhere evoked one here, on the
  same or the opposite side. Each row is the other label, a bar for its response rate and the
  counts it rests on; a pair tested in too few people shows its counts without a rate. Only a
  region with a label has the section; it stays mounted so its choices survive a new selection.
-->
<script lang="ts">
  import type { Language, Region } from '../../lib/types/index.ts';
  import {
    labelById,
    labelsOf,
    responseRows,
    stimulationLabelName,
    stimulationLabelShort,
    untested,
    type Direction,
    type Side,
    type StimulationResponses,
  } from '../../lib/core/catalog/stimulation-responses.ts';
  import { grouped, percent } from '../../lib/core/format.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import ChoiceGroup from '../../lib/ui/ChoiceGroup.svelte';
  import Disclosure from '../../lib/ui/Disclosure.svelte';
  import { iconGraphic } from '../../lib/ui/IconButton.svelte';
  import Swatch from '../../lib/ui/Swatch.svelte';

  let {
    region,
    lang,
    stimulation,
  }: {
    region: Region | null;
    lang: Language;
    stimulation: StimulationResponses | null;
  } = $props();

  let open = $state(false);
  let site = $state<string | null>(null);
  let direction = $state<Direction>('from');
  let side = $state<Side>('same');

  const copy = $derived(t(lang, 'stimulation'));
  const entry = $derived(region ? labelsOf(stimulation, region.id) : null);
  // A kept site applies only while the region still offers it.
  const label = $derived(
    entry ? (site && entry.labels.includes(site) ? site : entry.labels[0]!) : null,
  );
  const rows = $derived(label ? responseRows(stimulation!, label, direction, side) : []);
  const missing = $derived(label ? untested(stimulation!, label, direction, side) : []);
  const name = (id: string) => stimulationLabelName(labelById(stimulation!, id), lang);
  const siteOptions = $derived(
    entry
      ? entry.labels.map((id) => {
          const site = labelById(stimulation!, id);
          return { value: id, label: stimulationLabelShort(site, lang), name: name(id) };
        })
      : [],
  );
  const directionOptions = $derived(
    (['from', 'to'] as const).map((value) => ({ value, label: copy[value] })),
  );
  const sideOptions = $derived(
    (['same', 'opposite'] as const).map((value) => ({ value, label: copy[value] })),
  );
</script>

{#if entry && label}
  <div class="evidence-section">
    <Disclosure variant="section" summary={copy.heading} bind:open>
      {#if entry.labels.length > 1}
        <ChoiceGroup
          class="stimulation-choice"
          label={copy.site}
          options={siteOptions}
          bind:value={() => label, (value) => (site = value)}
        />
      {/if}
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
      {#if rows.length}
        <ul class="network-list">
          {#each rows as row (row.label.id)}
            <li class="network-row stimulation-row">
              <span class="network-row-name">{stimulationLabelName(row.label, lang)}</span>
              {#if row.drawn}
                <Swatch kind="bar" share={row.rate} />
                <span class="network-share measure">{percent(row.rate, lang)}</span>
              {:else}
                <span></span>
                <span class="network-share measure">{copy.noRate}</span>
              {/if}
              <span class="functional-row-meta stimulation-counts">
                {copy.counts(
                  grouped(row.pair.responded),
                  grouped(row.pair.tested),
                  row.pair.subjects,
                )}
              </span>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="detail-note">{copy.none}</p>
      {/if}
      {#if missing.length}
        <p class="detail-note">
          {copy.untested(missing.map((other) => stimulationLabelName(other, lang)).join(', '))}
        </p>
      {/if}
      <p class="detail-note">
        {copy.note(
          stimulation!.subjects,
          stimulation!.min_subjects,
          grouped(stimulation!.excluded),
        )}
      </p>
      <p class="detail-note">
        {#if entry.basis === 'contacts'}
          {copy.basisContacts(
            name(label),
            percent(entry.share, lang),
            grouped(entry.channels),
            entry.subjects,
          )}
        {:else}
          {copy.basisName(entry.labels.map(name).join(', '))}
        {/if}
      </p>
      {#if entry.labels.length > 1}
        <p class="detail-note">{copy.thalamus}</p>
      {/if}
      <div class="stimulation-sources">
        <a href={stimulation!.source.doi} target="_blank" rel="noopener noreferrer"
          >{stimulation!.source.short}<span class="visually-hidden"
            >{` ${t(lang, 'link').newTab}`}</span
          >{@render iconGraphic('external-link')}</a
        >
        <a href={stimulation!.source.dataset} target="_blank" rel="noopener noreferrer"
          >{copy.dataset}<span class="visually-hidden">{` ${t(lang, 'link').newTab}`}</span
          >{@render iconGraphic('external-link')}</a
        >
      </div>
    </Disclosure>
  </div>
{/if}

<style>
  @layer features {
    :global(.stimulation-choice) {
      margin-top: var(--space-2);
    }
    .stimulation-sources {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1) var(--space-3);
      padding-top: var(--space-2);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
    .stimulation-sources a {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      min-height: 24px;
    }
  }
</style>
