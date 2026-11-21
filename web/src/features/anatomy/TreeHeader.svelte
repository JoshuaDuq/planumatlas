<!--
  The header over the tree (index.html:247-250): the browse scope beside it (A3's picker, as
  `children`), the one command that opens or closes every group (app.js:643-653), and the region
  table of the shown atlas and level as a CSV file (WP24).
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { CatalogGroup } from '../../lib/core/catalog/catalog.ts';
  import {
    regionTableCsv,
    regionTableFilename,
    type RegionTableScope,
  } from '../../lib/core/catalog/region-table.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import type { Language } from '../../lib/types/index.ts';
  import { announce } from '../../lib/ui/announcer.svelte.ts';
  import IconButton from '../../lib/ui/IconButton.svelte';
  import { downloadText } from '../../lib/ui/download.ts';

  interface Props {
    lang: Language;
    groups: readonly Pick<CatalogGroup, 'key'>[];
    /** Keys of the open groups, as the tree holds them. */
    expanded: ReadonlySet<string>;
    onExpandedChange: (expanded: Set<string>) => void;
    /** Read at the press, so a view change does not touch the header. */
    table: () => RegionTableScope;
    children?: Snippet;
  }

  let { lang, groups, expanded, onExpandedChange, table, children }: Props = $props();

  const copy = $derived(t(lang, 'navigator'));
  const allExpanded = $derived(groups.length > 0 && groups.every(({ key }) => expanded.has(key)));

  function downloadTable() {
    const scope = table();
    downloadText(regionTableCsv(scope), regionTableFilename(scope), 'text/csv;charset=utf-8');
    announce(copy.tableDownloaded);
  }
</script>

<div class="tree-header">
  {@render children?.()}
  <!-- The two commands wrap as one, so the download never stands alone under the scope. -->
  <div class="tree-commands">
    <button
      type="button"
      class="tree-toggle-all"
      onclick={() =>
        onExpandedChange(allExpanded ? new Set() : new Set(groups.map(({ key }) => key)))}
    >
      {allExpanded ? copy.collapseAll : copy.expandAll}
    </button>
    <IconButton
      class="tree-download"
      icon="download"
      label={copy.downloadTable}
      data-tooltip={copy.downloadTable}
      onclick={downloadTable}
    />
  </div>
</div>
