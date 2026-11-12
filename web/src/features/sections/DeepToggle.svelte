<!--
  A function's or deficit's structures beneath its opaque cortex, shown by hiding the cortex and
  framing them; pressed again, the cortex comes back. Styled as the Linked MRI button beside it.
-->
<script lang="ts">
  import { t } from '../../lib/core/i18n/index.ts';
  import type { Language } from '../../lib/types/index.ts';

  let {
    lang,
    beneath,
    ontoggle,
  }: {
    lang: Language;
    beneath: { count: number; hidden: boolean };
    ontoggle: (hidden: boolean) => unknown;
  } = $props();

  const copy = $derived(t(lang, 'inspector'));
</script>

<button
  type="button"
  class="deep-toggle"
  aria-pressed={beneath.hidden}
  onclick={() => ontoggle(!beneath.hidden)}
>
  {beneath.hidden ? copy.showCortex : copy.showDeep(beneath.count)}
</button>

<style>
  @layer features {
    .deep-toggle {
      min-height: var(--control-height);
      margin-top: var(--space-4);
      margin-left: var(--space-2);
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
    .deep-toggle:active:not(:focus-visible) {
      transform: scale(var(--press-scale));
    }
    @media (hover: hover) and (pointer: fine) {
      .deep-toggle:hover {
        background: var(--surface-tonal-hover);
        color: var(--accent-hover);
      }
    }
    @media (pointer: coarse) {
      .deep-toggle {
        min-height: 44px;
      }
    }
  }
</style>
