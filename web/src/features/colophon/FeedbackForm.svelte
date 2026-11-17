<!--
  The feedback form itself: a name, a reply address, a message and Send, with the link to the view
  on screen. Its owner keeps the draft, so a panel closed and opened again still holds what was
  typed. A message that is only spaces, or an address the relay would refuse, is said at its field
  and nothing is sent (COLO-09). A send that fails says why (COLO-11), keeps the message and offers
  the address, which is itself the copy button. A sent message gives focus to the thanks that
  replaces the form (COLO-12).
-->
<script module lang="ts">
  import { untrack } from 'svelte';
  import { FEEDBACK_ADDRESS, FeedbackError, MAX_EMAIL, isEmail, sendFeedback } from './feedback.ts';

  export class FeedbackDraft {
    name = $state('');
    email = $state('');
    message = $state('');
    status = $state<'idle' | 'sending' | 'sent'>('idle');
    /** Why the last send failed, until the next one. */
    failure = $state<FeedbackError | null>(null);

    /** A panel opened again after a send is ready for another message; only opening resets it. */
    reopen() {
      untrack(() => {
        if (this.status === 'sent') this.status = 'idle';
      });
    }
  }
</script>

<script lang="ts">
  import { tick } from 'svelte';
  import { t } from '../../lib/core/i18n/index.ts';
  import type { Language } from '../../lib/types/index.ts';
  import { announce } from '../../lib/ui/announcer.svelte.ts';
  import CopyValue from '../../lib/ui/CopyValue.svelte';

  let { lang, draft }: { lang: Language; draft: FeedbackDraft } = $props();

  const uid = $props.id();
  const copy = $derived(t(lang, 'footer'));
  const emailId = `feedback-email-${uid}`;
  const messageId = `feedback-message-${uid}`;

  // Said at the field from Send until the field is edited.
  let emailInvalid = $state(false);
  let messageEmpty = $state(false);
  let said = $state<HTMLElement | null>(null);

  function failed(failure: FeedbackError): string {
    const words = copy.feedbackFailed;
    return failure.reason === 'rateLimited'
      ? words.rateLimited(failure.retryAfter)
      : words[failure.reason];
  }

  async function send(event: SubmitEvent) {
    event.preventDefault();
    if (draft.status === 'sending') return;
    const email = draft.email.trim();
    const message = draft.message.trim();
    emailInvalid = email !== '' && !isEmail(email);
    messageEmpty = message === '';
    if (emailInvalid || messageEmpty) {
      document.getElementById(emailInvalid ? emailId : messageId)!.focus();
      return;
    }
    draft.status = 'sending';
    draft.failure = null;
    try {
      await sendFeedback({
        name: draft.name.trim(),
        ...(email !== '' && { email }),
        message,
        view: location.href,
      });
    } catch (error) {
      draft.status = 'idle';
      if (!(error instanceof FeedbackError)) throw error;
      console.error(error);
      draft.failure = error;
      announce(`${failed(error)} ${FEEDBACK_ADDRESS}`);
      return;
    }
    draft.message = '';
    draft.status = 'sent';
    await tick();
    // Focus reads the thanks; a panel closed while sending has none to focus, so it is said.
    if (said) said.focus();
    else announce(copy.feedbackSent);
  }
</script>

{#if draft.status === 'sent'}
  <p bind:this={said} class="feedback feedback-said" tabindex="-1">{copy.feedbackSent}</p>
{:else}
  <!-- Checked here, at the fields, in the reader's language, not by the browser's bubbles. -->
  <form class="feedback" novalidate onsubmit={send}>
    <label for="feedback-name-{uid}">{copy.feedbackName}</label>
    <!-- The Worker's limits (workers/feedback). -->
    <input
      id="feedback-name-{uid}"
      type="text"
      autocomplete="name"
      maxlength="200"
      bind:value={draft.name}
    />
    <label for={emailId}>{copy.feedbackEmail}</label>
    <input
      id={emailId}
      type="email"
      autocomplete="email"
      maxlength={MAX_EMAIL}
      aria-invalid={emailInvalid}
      aria-describedby={emailInvalid
        ? `feedback-email-error-${uid} feedback-email-note-${uid}`
        : `feedback-email-note-${uid}`}
      bind:value={draft.email}
      oninput={() => (emailInvalid = false)}
    />
    <p id="feedback-email-note-{uid}" class="feedback-note">{copy.feedbackEmailNote}</p>
    {#if emailInvalid}
      <p id="feedback-email-error-{uid}" class="feedback-error">{copy.feedbackEmailInvalid}</p>
    {/if}
    <label for={messageId}>{copy.feedbackMessage}</label>
    <textarea
      id={messageId}
      rows="5"
      required
      maxlength="10000"
      aria-invalid={messageEmpty}
      aria-describedby={messageEmpty ? `feedback-message-error-${uid}` : undefined}
      bind:value={draft.message}
      oninput={() => (messageEmpty = false)}></textarea>
    {#if messageEmpty}
      <p id="feedback-message-error-{uid}" class="feedback-error">{copy.feedbackMessageEmpty}</p>
    {/if}
    <p class="feedback-note">{copy.feedbackNote}</p>
    {#if draft.failure}
      <!-- Said by the announcer, which says it again when the same failure repeats. -->
      <p class="feedback-failed">
        {failed(draft.failure)}
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
    .feedback :is(input, textarea)[aria-invalid='true'] {
      border-color: var(--danger);
    }
    .feedback-note,
    .feedback-error,
    .feedback-failed {
      margin: 0;
      color: var(--text-secondary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
    .feedback-error {
      color: var(--danger);
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
