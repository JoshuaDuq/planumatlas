<!--
  Feedback from anyone, with no account and no email app, opened from the status bar. Phones hide
  the status bar and offer the same form from the ⋯ menu as a dialog (FeedbackDialog).
-->
<script lang="ts">
  import { t } from '../../lib/core/i18n/index.ts';
  import type { Language } from '../../lib/types/index.ts';
  import Popover from '../../lib/ui/Popover.svelte';
  import FeedbackForm, { FeedbackDraft } from './FeedbackForm.svelte';

  let { lang }: { lang: Language } = $props();

  let open = $state(false);
  const draft = new FeedbackDraft();

  $effect(() => {
    if (open) draft.reopen();
  });
</script>

<Popover bind:open class="feedback-menu">
  {#snippet trigger({ props })}
    <!-- Bits adds aria-haspopup="dialog"; this panel is a disclosure of plain controls, not a dialog. -->
    <button {...props} aria-haspopup={undefined} type="button" class="colophon-action">
      {t(lang, 'footer').feedback}
    </button>
  {/snippet}
  {#snippet children()}
    <div class="feedback-panel">
      <FeedbackForm {lang} {draft} />
    </div>
  {/snippet}
</Popover>

<style>
  @layer features {
    .feedback-panel {
      width: min(20rem, calc(100vw - var(--space-6)));
      padding: var(--space-4);
    }
  }
</style>
