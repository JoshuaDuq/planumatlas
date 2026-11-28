<!--
  One side of a structure's row: a lettered key that selects that side's region, as a tract's key
  draws its bundle. A side that is not on screen is struck, and a press reveals it first.
-->
<script lang="ts">
  import type { CatalogRow } from '../../lib/core/catalog/catalog.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import { reasonText } from '../../lib/core/panels/navigator.ts';
  import { selectionName } from '../../lib/core/workspace.ts';
  import type { Language } from '../../lib/types/index.ts';

  interface Props {
    lang: Language;
    row: CatalogRow;
    selected: boolean;
    onpress: (row: CatalogRow) => void;
  }

  let { lang, row, selected, onpress }: Props = $props();

  const side = $derived(row.region.hemisphere);
  const sides = $derived(t(lang, 'sides'));
  // The glyph the key shows leads the side word, so its name holds its visible text (WCAG 2.5.3).
  const label = $derived(
    row.visible
      ? selectionName({
          label: row.label.name,
          side: sides.glyphs[side],
          sideWord: sides.words[side],
        })
      : t(lang, 'navigator').rowHiddenAria(
          `${row.label.name} ${sides.glyphs[side]}`,
          sides.words[side],
          reasonText(row.reason!, row.region, lang),
        ),
  );
</script>

<button
  type="button"
  class="side-key"
  data-side={side}
  data-region={row.region.id}
  data-state={row.visible ? 'shown' : 'hidden'}
  aria-pressed={selected}
  aria-label={label}
  data-tooltip={row.visible ? undefined : label}
  onclick={() => onpress(row)}
>
  <span aria-hidden="true">{sides.glyphs[side]}</span>
</button>
