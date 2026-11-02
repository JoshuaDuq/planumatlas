<!--
  How to use Planum: the gestures, the three homes (stage, top bar, panel) and the medial-view recipe,
  opened from the settings menu. Native modal Dialog: trap, Escape, inert page and focus return are
  U5's; the title takes initial focus, as the shortcuts sheet's does.
-->
<script lang="ts">
  import type { Language } from '../../lib/types/index.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import Dialog from '../../lib/ui/Dialog.svelte';

  interface Props {
    open?: boolean;
    instant?: boolean;
    lang: Language;
    /** Takes focus on close: the menu item that opened it has gone with the menu. */
    fallbackFocus: () => HTMLElement | null;
  }

  let {
    open = $bindable(false),
    instant = $bindable(false),
    lang,
    fallbackFocus,
  }: Props = $props();

  const copy = $derived(t(lang, 'guide'));
</script>

<Dialog bind:open bind:instant {fallbackFocus} closeLabel={copy.close}>
  {#snippet heading(id)}
    <!-- svelte-ignore a11y_autofocus -->
    <h2 {id} class="guide-title" tabindex="-1" autofocus>{copy.title}</h2>
  {/snippet}
  <p class="guide-lead">{copy.lead}</p>
  {#each copy.sections as [title, paragraphs] (title)}
    <div class="guide-section">
      <h3 class="guide-heading">{title}</h3>
      {#each paragraphs as paragraph (paragraph)}
        <p>{paragraph}</p>
      {/each}
    </div>
  {/each}
  <p class="guide-note">{copy.keys}</p>
</Dialog>

<style>
  @layer features {
    .guide-title {
      margin: 0;
    }
    /* Prose holds a reading measure; the headings' rules still span the dialog. */
    .guide-lead,
    .guide-section p,
    .guide-note {
      max-width: 68ch;
    }
    .guide-lead {
      margin: var(--space-4) 0 0;
      color: var(--text-secondary);
      font-size: var(--text-ui);
      line-height: var(--lh-ui);
      text-wrap: pretty;
    }
    /* The shortcuts sheet's group headings: a caption over a rule. */
    .guide-heading {
      margin: 0;
      padding: var(--space-6) 0 var(--space-2);
      border-bottom: 1px solid var(--border-subtle);
      font-size: var(--text-caption);
      font-weight: 600;
      line-height: var(--lh-caption);
      color: var(--text-secondary);
    }
    .guide-section p {
      margin: var(--space-2) 0 0;
      font-size: var(--text-ui);
      line-height: var(--lh-ui);
      text-wrap: pretty;
    }
    .guide-note {
      margin: var(--space-6) 0 0;
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      color: var(--text-secondary);
    }
  }
</style>
