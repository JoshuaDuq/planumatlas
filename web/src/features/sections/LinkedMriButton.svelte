<!--
  A profile's Linked MRI command: the region inspector's tonal button, told apart by its accent ink.
  `onopen` takes whether a key pressed it, so a key press opens without motion.
-->
<script lang="ts">
  import { t } from '../../lib/core/i18n/index.ts';
  import type { Language } from '../../lib/types/index.ts';
  import { isKeyboardActivation } from '../../lib/ui/instant.ts';

  let { lang, onopen }: { lang: Language; onopen: (options: { instant: boolean }) => unknown } =
    $props();
</script>

<button
  type="button"
  class="linked-mri"
  data-tooltip={t(lang, 'cuts').openMprTitle}
  onclick={(event) => onopen({ instant: isKeyboardActivation(event) })}
>
  {t(lang, 'inspector').linkedMri}
</button>

<style>
  @layer features {
    .linked-mri {
      min-height: var(--control-height);
      margin-top: var(--space-4);
      padding: var(--space-1) var(--space-3);
      border: 1px solid transparent;
      border-radius: var(--radius-control);
      background: var(--surface-tonal);
      color: var(--accent);
      font-size: var(--text-ui);
      font-weight: 500;
      line-height: var(--lh-ui);
      cursor: pointer;
      transition:
        background-color var(--ui-transition) var(--ease-ui),
        transform var(--press-transition) var(--ease-ui);
    }
    /* A pointer press answers; a key press does not animate. */
    .linked-mri:active:not(:focus-visible) {
      transform: scale(var(--press-scale));
    }
    @media (hover: hover) and (pointer: fine) {
      .linked-mri:hover {
        background: var(--surface-tonal-hover);
        color: var(--accent-hover);
      }
    }
    @media (pointer: coarse) {
      .linked-mri {
        min-height: 44px;
      }
    }
  }
</style>
