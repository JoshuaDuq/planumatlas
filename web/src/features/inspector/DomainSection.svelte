<!--
  Neuropsychological functions (inspector.js:207-235): the curated functions a region lists, then the
  searched Neurosynth terms in a fold, each row opening its map. HCP-MMP areas, sampled structures and
  the listed atlases give each its z; Destrieux and Desikan-Killiany regions the share their HCP-MMP
  areas cover, with the z over that share. A scored region that lists neither a function nor a term
  has no section (2026-11-23: a row reading "0" answered nothing), and one with terms alone has no
  count. The component stays mounted so its open state survives from one selection to the next.
-->
<script lang="ts">
  import { tick } from 'svelte';
  import type { Language, Region } from '../../lib/types/index.ts';
  import { networkCss } from '../../lib/core/catalog/networks.ts';
  import {
    domainName,
    functionsAt,
    listedByShare,
    scoredRegion,
    termsAt,
    type NeuropsychDomains,
    type RegionFunction,
  } from '../../lib/core/catalog/neuropsych-domains.ts';
  import { decimal, percent } from '../../lib/core/format.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import Disclosure from '../../lib/ui/Disclosure.svelte';
  import ShowAll from '../../lib/ui/ShowAll.svelte';
  import { REGION_ROWS_SHOWN } from '../../lib/types/constants.ts';
  import LinkRow from '../../lib/ui/LinkRow.svelte';

  let {
    region,
    lang,
    domains,
    onfunction,
  }: {
    region: Region | null;
    lang: Language;
    domains: NeuropsychDomains | null;
    /** Opens a function's or term's map. */
    onfunction: (id: string) => void;
  } = $props();

  let open = $state(false);
  let termsOpen = $state(false);

  const copy = $derived(t(lang, 'domains'));
  const termsCopy = $derived(t(lang, 'functions'));
  const scored = $derived(domains !== null && region !== null && scoredRegion(domains, region));
  const byShare = $derived(scored && listedByShare(domains!, region!));
  const found = $derived(scored ? functionsAt(domains!, region!.id) : []);
  const terms = $derived(scored ? termsAt(domains!, region!) : []);
  let unfolded = $state(false);
  let termsUnfolded = $state(false);
  let rows = $state<HTMLElement>();
  let termRows = $state<HTMLElement>();
  $effect.pre(() => {
    void region?.id;
    unfolded = false;
    termsUnfolded = false;
  });
  const shown = $derived(unfolded ? found : found.slice(0, REGION_ROWS_SHOWN));
  const termsShown = $derived(termsUnfolded ? terms : terms.slice(0, REGION_ROWS_SHOWN));
  const z = (record: RegionFunction) => decimal(record.z, 1, lang);
  const termScore = (record: RegionFunction) =>
    record.share === undefined
      ? copy.termScore(z(record))
      : copy.termShareScore(percent(record.share, lang), z(record));
  const note = $derived.by(() => {
    if (!scored) return '';
    const sources = domains!.sources as Record<string, { short: string }>;
    const source = sources[domains!.scores_source as string]!.short;
    const atlas = region!.atlas as string;
    const atlasName = () => (t(lang, 'header').atlasShort as Record<string, string>)[atlas]!;
    const threshold = decimal(domains!.threshold_z, 0, lang);
    const none =
      !found.length &&
      (byShare ? copy.noneShare(percent(domains!.share_floor, lang)) : copy.none(threshold));
    const basis =
      atlas === domains!.atlas
        ? copy.note(source)
        : domains!.region_atlases.includes(atlas)
          ? copy.noteAtlas(atlasName(), source)
          : byShare
            ? copy.noteShare(atlasName(), source, threshold)
            : copy.noteStructure(source);
    const unit = region!.id in domains!.units && copy.noteUnit;
    return [none, basis, unit].filter(Boolean).join(' ');
  });

  /** "Show all" leaves as it adds the rest: the first row it added takes focus in its place. */
  async function showAll(list: HTMLElement | undefined, unfold: () => void) {
    unfold();
    await tick();
    list?.querySelectorAll('button')[REGION_ROWS_SHOWN]?.focus();
  }
</script>

{#if scored && (found.length || terms.length)}
  <div class="evidence-section">
    <Disclosure
      variant="section"
      summary={copy.heading}
      value={found.length ? String(found.length) : null}
      bind:open
    >
      {#if found.length}
        <ul class="function-links" bind:this={rows}>
          {#each shown as record (record.id)}
            <li>
              <LinkRow
                name={domainName(record, lang)}
                secondary={record.share === undefined
                  ? copy.score(record.term, z(record))
                  : copy.shareScore(record.term, percent(record.share, lang), z(record))}
                colour={networkCss(record.color)}
                onclick={() => onfunction(record.id)}
              />
            </li>
          {/each}
        </ul>
        {#if shown.length < found.length}
          <ShowAll
            label={t(lang, 'navigator').showAll(found.length)}
            inset={false}
            onclick={() => showAll(rows, () => (unfolded = true))}
          />
        {/if}
      {/if}
      {#if terms.length}
        <div class="terms">
          <Disclosure
            summary={termsCopy.termsHeading}
            value={String(terms.length)}
            bind:open={termsOpen}
          >
            <ul class="function-links" bind:this={termRows}>
              {#each termsShown as record (record.id)}
                <li>
                  <LinkRow
                    name={record.term}
                    nameLang={lang === 'en' ? undefined : 'en'}
                    secondary={record.kind === 'population'
                      ? copy.population(termScore(record))
                      : termScore(record)}
                    onclick={() => onfunction(record.id)}
                  />
                </li>
              {/each}
            </ul>
            {#if termsShown.length < terms.length}
              <ShowAll
                label={t(lang, 'navigator').showAll(terms.length)}
                inset={false}
                onclick={() => showAll(termRows, () => (termsUnfolded = true))}
              />
            {/if}
            <p class="detail-note">
              {termsCopy.termCaveat}{#if terms.some((record) => record.kind === 'population')}{' '}{termsCopy.populationCaveat}{/if}
            </p>
          </Disclosure>
        </div>
      {/if}
      <p class="detail-note">{note}</p>
    </Disclosure>
  </div>
{/if}

<style>
  @layer features {
    .function-links {
      margin: 0;
      padding: var(--space-1) 0 0;
      list-style: none;
    }
    .terms {
      margin-top: var(--space-2);
    }
  }
</style>
