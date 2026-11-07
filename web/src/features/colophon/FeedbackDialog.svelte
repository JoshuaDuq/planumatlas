<!--
  The feedback form on phones, where the status bar that opens it as a popover is hidden: the ⋯
  menu's Feedback item opens it as a dialog. The title takes initial focus, as in the other
  dialogs, so the phone keyboard rises only when the reader picks a field.
-->
<script lang="ts">
  import { t } from '../../lib/core/i18n/index.ts';
  import type { Language } from '../../lib/types/index.ts';
  import Dialog from '../../lib/ui/Dialog.svelte';
  import FeedbackForm, { FeedbackDraft } from './FeedbackForm.svelte';

  interface Props {
    open?: boolean;
    instant?: boolean;
    lang: Language;
    /** Takes focus on close when the opener is hidden (the settings menu's item): the ⋯ button. */
    fallbackFocus: () => HTMLElement | null;
  }

  let {
    open = $bindable(false),
    instant = $bindable(false),
    lang,
    fallbackFocus,
  }: Props = $props();

  const draft = new FeedbackDraft();
  const copy = $derived(t(lang, 'footer'));

  $effect(() => {
    if (open) draft.reopen();
  });
</script>

<Dialog bind:open bind:instant isolateKeys {fallbackFocus} closeLabel={copy.close}>
  {#snippet heading(id)}
    <!-- svelte-ignore a11y_autofocus -->
    <h2 {id} class="feedback-title" tabindex="-1" autofocus>{copy.feedback}</h2>
  {/snippet}
  <div class="feedback-body">
    <FeedbackForm {lang} {draft} />
  </div>
</Dialog>

<style>
  @layer features {
    .feedback-title {
      margin: 0;
    }
    .feedback-body {
      padding-top: var(--space-4);
    }
  }
</style>
