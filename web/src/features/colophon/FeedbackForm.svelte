<!--
  The feedback form itself: a name, a message and Send, with the link to the view on screen. Its
  owner keeps the draft, so a panel closed and opened again still holds what was typed. A send that
  fails keeps the message and offers the address, which is itself the copy button.
-->
<script module lang="ts">
  import { untrack } from 'svelte';
  import { FEEDBACK_ADDRESS, sendFeedback } from './feedback.ts';

  export class FeedbackDraft {
    name = $state('');
    message = $state('');
    status = $state<'idle' | 'sending' | 'sent' | 'failed'>('idle');

    /** A panel opened again after a send is ready for another message; only opening resets it. */
    reopen() {
      untrack(() => {
        if (this.status === 'sent') this.status = 'idle';
      });
    }
  }
</script>

<script lang="ts">
  import { t } from '../../lib/core/i18n/index.ts';
  import type { Language } from '../../lib/types/index.ts';
  import { announce } from '../../lib/ui/announcer.svelte.ts';
  import CopyValue from '../../lib/ui/CopyValue.svelte';

  let { lang, draft }: { lang: Language; draft: FeedbackDraft } = $props();

  const uid = $props.id();
  const copy = $derived(t(lang, 'footer'));

  async function send(event: SubmitEvent) {
    event.preventDefault();
    if (draft.status === 'sending') return;
    draft.status = 'sending';
    try {
      await sendFeedback({
        name: draft.name.trim(),
        message: draft.message.trim(),
        view: location.href,
      });
      draft.message = '';
      draft.status = 'sent';
      announce(copy.feedbackSent);
    } catch (error) {
      console.error(error);
      draft.status = 'failed';
      announce(`${copy.feedbackFailed} ${FEEDBACK_ADDRESS}`);
    }
  }
</script>

{#if draft.status === 'sent'}
  <p class="feedback feedback-said">{copy.feedbackSent}</p>
{:else}
  <form class="feedback" onsubmit={send}>
    <label for="feedback-name-{uid}">{copy.feedbackName}</label>
    <input id="feedback-name-{uid}" type="text" autocomplete="name" bind:value={draft.name} />
    <label for="feedback-message-{uid}">{copy.feedbackMessage}</label>
    <textarea id="feedback-message-{uid}" rows="5" required bind:value={draft.message}></textarea>
    <p class="feedback-note">{copy.feedbackNote}</p>
    {#if draft.status === 'failed'}
      <p class="feedback-failed" role="alert">
        {copy.feedbackFailed}
        <CopyValue value={FEEDBACK_ADDRESS} words={t(lang, 'inspector').copyValue} />
      </p>
    {/if}
    <button
      type="submit"
      class="feedback-send"
      aria-disabled={draft.status === 'sending' || undefined}
    >
      {draft.status === 'sending' ? copy.feedbackSending : copy.feedbackSend}
    </button>
  </form>
{/if}

<style>
  @layer features {
    .feedback {
      display: grid;
      gap: var(--space-2);
      margin: 0;
      font-size: var(--text-ui);
      line-height: var(--lh-ui);
      white-space: normal;
    }
    .feedback label {
      color: var(--text-secondary);
      font-size: var(--text-caption);
      font-weight: 600;
      line-height: var(--lh-caption);
    }
    /* The search field's look: navigation ground at rest, base ground and a teal edge while focused. */
    .feedback :is(input, textarea) {
      width: 100%;
      min-height: var(--control-height);
      margin: 0 0 var(--space-1);
      padding: var(--space-1) var(--space-2);
      border: 1px solid var(--border-control);
      border-radius: var(--radius-control);
      background: var(--surface-navigation);
      color: var(--text-primary);
      font: inherit;
      transition: border-color var(--ui-transition) var(--ease-ui);
    }
    .feedback textarea {
      resize: vertical;
    }
    .feedback :is(input, textarea):focus {
      border-color: var(--accent);
      background: var(--surface-base);
    }
    .feedback-note,
    .feedback-failed {
      margin: 0;
      color: var(--text-secondary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
    .feedback-failed {
      overflow-wrap: anywhere;
    }
    /* The one command, filled as the panel's primary action. */
    .feedback-send {
      justify-self: start;
      min-height: var(--control-height);
      margin-top: var(--space-1);
      padding: 0 var(--space-4);
      border: 0;
      border-radius: var(--radius-control);
      background: var(--primary-fill);
      color: var(--primary-ink);
      font-weight: 500;
      cursor: pointer;
      transition: background-color var(--ui-transition) var(--ease-ui);
    }
    .feedback-send[aria-disabled] {
      cursor: progress;
    }
    @media (hover: hover) and (pointer: fine) {
      .feedback-send:hover {
        background: var(--primary-fill-hover);
      }
      .feedback :is(input, textarea):hover:not(:focus) {
        border-color: var(--text-secondary);
      }
    }
  }
</style>
