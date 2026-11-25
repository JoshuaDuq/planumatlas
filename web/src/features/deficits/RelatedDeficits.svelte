<!--
  The region inspector's linked deficits (clinical.js:332-350): the deficits mapped on the selected
  region or on anatomy it shares (`involved`), under one counted disclosure.
-->
<script lang="ts">
  import { decimal } from '../../lib/core/format.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import { deficitsForRegion, relatedRegionVisible } from '../../lib/core/panels/clinical.ts';
  import type { View } from '../../lib/state/view.svelte.ts';
  import type { DeficitsExplorer } from './explorer.svelte.ts';
  import Disclosure from '../../lib/ui/Disclosure.svelte';
  import LinkRow from '../../lib/ui/LinkRow.svelte';

  let { explorer, view }: { explorer: DeficitsExplorer; view: View } = $props();

  const clinical = $derived(explorer.deps.clinical);
  const lang = $derived(view.lang);
  const deficits = $derived(
    view.selectedRegion ? deficitsForRegion(explorer, view.selectedRegion.id) : [],
  );
  const visible = $derived(relatedRegionVisible(view.selectedRegion, deficits.length));
</script>

<section class="related evidence-section" hidden={!visible}>
  {#if visible}
    <Disclosure
      variant="section"
      summary={t(lang, 'inspector').lead.deficits}
      value={decimal(deficits.length, 0, lang)}
    >
      <ul role="list">
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
    </Disclosure>
  {/if}
</section>

<style>
  @layer features {
    ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }
  }
</style>
