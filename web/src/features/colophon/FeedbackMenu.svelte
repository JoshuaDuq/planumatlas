<!--
  Feedback from anyone, with no account and no email app: a name and a message, sent from inside
  Planum with the link to the view on screen. A send that fails keeps what was typed and offers the
  address, which is itself the copy button.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { t } from '../../lib/core/i18n/index.ts';
  import type { Language } from '../../lib/types/index.ts';
  import { announce } from '../../lib/ui/announcer.svelte.ts';
  import CopyValue from '../../lib/ui/CopyValue.svelte';
  import Popover from '../../lib/ui/Popover.svelte';
  import { FEEDBACK_ADDRESS, sendFeedback } from './feedback.ts';

  let { lang }: { lang: Language } = $props();

  const uid = $props.id();
  let open = $state(false);
  let name = $state('');
  let message = $state('');
  let status = $state<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const copy = $derived(t(lang, 'footer'));

  // A panel opened again after a send is ready for another message; only opening resets it.
  $effect(() => {
    if (!open) return;
    untrack(() => {
      if (status === 'sent') status = 'idle';
    });
  });

  async function send(event: SubmitEvent) {
    event.preventDefault();
    if (status === 'sending') return;
    status = 'sending';
    try {
      await sendFeedback(
        { name: name.trim(), message: message.trim(), view: location.href },
        copy.feedbackSubject,
      );
      message = '';
      status = 'sent';
      announce(copy.feedbackSent);
    } catch (error) {
      console.error(error);
      status = 'failed';
      announce(`${copy.feedbackFailed} ${FEEDBACK_ADDRESS}`);
    }
  }
</script>

<Popover bind:open class="feedback-menu">
  {#snippet trigger({ props })}
    <!-- Bits adds aria-haspopup="dialog"; this panel is a disclosure of plain controls, not a dialog. -->
    <button {...props} aria-haspopup={undefined} type="button" class="colophon-action">
      {copy.feedback}
    </button>
  {/snippet}
  {#snippet children()}
    {#if status === 'sent'}
      <p class="feedback feedback-said">{copy.feedbackSent}</p>
    {:else}
      <form class="feedback" onsubmit={send}>
        <label for="feedback-name-{uid}">{copy.feedbackName}</label>
        <input id="feedback-name-{uid}" type="text" autocomplete="name" bind:value={name} />
        <label for="feedback-message-{uid}">{copy.feedbackMessage}</label>
        <textarea id="feedback-message-{uid}" rows="5" required bind:value={message}></textarea>
        {#if status === 'failed'}
          <p class="feedback-failed" role="alert">
            {copy.feedbackFailed}
            <CopyValue value={FEEDBACK_ADDRESS} words={t(lang, 'inspector').copyValue} />
          </p>
        {/if}
        <button
          type="submit"
          class="feedback-send"
          aria-disabled={status === 'sending' || undefined}
        >
          {status === 'sending' ? copy.feedbackSending : copy.feedbackSend}
        </button>
      </form>
    {/if}
  {/snippet}
</Popover>

<style>
  @layer features {
    .feedback {
      display: grid;
      gap: var(--space-2);
      width: min(20rem, calc(100vw - var(--space-6)));
      margin: 0;
      padding: var(--space-4);
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
    .feedback-failed {
      margin: 0;
      color: var(--text-secondary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      overflow-wrap: anywhere;
    }
    /* The one command, filled as the panel's primary action. */
    .feedback-send {
      justify-self: start;
      min-height: var(--control-height);
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
