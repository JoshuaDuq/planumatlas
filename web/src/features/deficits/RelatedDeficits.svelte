<!--
  The region inspector's Neuropsychology section (clinical.js:332-350), for R1's `relatedDeficits`
  slot: the deficits mapped on the selected region or on anatomy it shares (`involved`). Not titled
  when it has nothing to report. The section is labelled by its own heading, not a landmark (D6).
-->
<script lang="ts">
  import { t } from '../../lib/core/i18n/index.ts';
  import { deficitsForRegion, relatedRegionVisible } from '../../lib/core/panels/clinical.ts';
  import type { View } from '../../lib/state/view.svelte.ts';
  import type { DeficitsExplorer } from './explorer.svelte.ts';
  import LinkRow from '../../lib/ui/LinkRow.svelte';

  let { explorer, view }: { explorer: DeficitsExplorer; view: View } = $props();

  const clinical = $derived(explorer.deps.clinical);
  const lang = $derived(view.lang);
  const deficits = $derived(
    view.selectedRegion ? deficitsForRegion(explorer, view.selectedRegion.id) : [],
  );
  const visible = $derived(relatedRegionVisible(view.selectedRegion, deficits.length));
</script>

<section class="related" hidden={!visible}>
  {#if visible}
    <!-- The lead's own label, so the row above and this list say one thing. -->
    <h3>{t(lang, 'inspector').lead.deficits}</h3>
    <ul>
      {#each deficits as id (id)}
        {@const deficit = clinical.get(id)}
        <li>
          <LinkRow
            name={deficit.name[lang]}
            secondary={deficit.domain[lang]}
            onclick={() => explorer.openDeficit(id)}
          />
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  @layer features {
    /* clinical.css:291-296: the region's own body, then the same open section rhythm. */
    .related {
      margin-block: var(--space-6);
      padding-inline: var(--panel-inset);
    }
    /* The sheet's caption idiom (inspector.css `.index-caption`): 13px/600 over the rule that opens the list. */
    h3 {
      margin: 0 0 var(--space-1);
      padding-bottom: var(--space-1);
      border-bottom: 1px solid var(--border-subtle);
      color: var(--text-secondary);
      font-size: var(--text-caption);
      font-weight: 600;
      line-height: var(--lh-caption);
    }
    ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }
  }
</style>
