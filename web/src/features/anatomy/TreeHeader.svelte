<!--
  The header over the tree (index.html:247-250): the browse scope beside it (A3's picker, as
  `children`), the one command that opens or closes every group (app.js:643-653), and the region
  table of the shown atlas and level as a CSV file.
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
  import { iconGraphic } from '../../lib/ui/IconButton.svelte';
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
    <button
      type="button"
      class="tree-download"
      aria-label={copy.downloadTable}
      data-tooltip={copy.downloadTable}
      onclick={downloadTable}
    >
      {@render iconGraphic('download')}
      <span aria-hidden="true">CSV</span>
    </button>
  </div>
</div>

<style>
  @layer features {
    .tree-download {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      min-height: var(--control-height);
      padding: 0 var(--space-2);
      border: 0;
      border-radius: var(--radius-control);
      background: transparent;
      color: var(--text-secondary);
      font-size: var(--text-caption);
      font-weight: 500;
      line-height: var(--lh-caption);
      cursor: pointer;
      transition:
        background-color var(--ui-transition) var(--ease-ui),
        color var(--ui-transition) var(--ease-ui),
        transform var(--press-transition) var(--ease-ui);
    }
    .tree-download:active:not(:focus-visible) {
      transform: scale(var(--press-scale));
    }
    @media (hover: hover) and (pointer: fine) {
      .tree-download:hover {
        background: var(--surface-hover);
        color: var(--text-primary);
      }
    }
    @media (pointer: coarse) {
      .tree-download {
        min-height: 44px;
      }
    }
  }
  @layer a11y {
    @media (prefers-reduced-motion: reduce) {
      .tree-download {
        transition-property: background-color, color;
      }
      .tree-download:active {
        transform: none;
      }
    }
  }
</style>
