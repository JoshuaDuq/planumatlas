<!--
  Contact, beside the GitHub link: the maintainer's address, which is its own copy button, and a
  link that opens the reader's email app. Phones hide it; the ⋯ panel carries Contact instead.
-->
<script lang="ts">
  import { t } from '../../lib/core/i18n/index.ts';
  import { OWN_KEYS_ATTRIBUTE } from '../../lib/core/keyboard.ts';
  import { CONTACT_ADDRESS } from '../../lib/core/methods.ts';
  import type { Language } from '../../lib/types/index.ts';
  import CopyValue from '../../lib/ui/CopyValue.svelte';
  import IconButton from '../../lib/ui/IconButton.svelte';
  import Popover from '../../lib/ui/Popover.svelte';

  let { lang }: { lang: Language } = $props();

  const copy = $derived(t(lang, 'footer'));
</script>

<Popover class="contact-menu">
  {#snippet trigger({ props })}
    <!-- Bits adds aria-haspopup="dialog"; this is a disclosure, as Share is. -->
    <IconButton
      {...props}
      aria-haspopup={undefined}
      class="contact-button"
      icon="mail"
      label={copy.contact}
      data-tooltip={copy.contact}
      {...{ [OWN_KEYS_ATTRIBUTE]: '' }}
    />
  {/snippet}
  {#snippet children({ close })}
    <p class="contact-note">
      {copy.contactNote}
      <CopyValue value={CONTACT_ADDRESS} words={t(lang, 'inspector').copyValue} />
    </p>
    <a class="contact-write" href="mailto:{CONTACT_ADDRESS}" onclick={close}>{copy.contactWrite}</a>
  {/snippet}
</Popover>

<style>
  @layer features {
    :global(.popover.contact-menu) {
      display: grid;
      gap: var(--space-3);
      width: min(18rem, calc(100vw - var(--space-6)));
      padding: var(--space-4);
    }
    .contact-note {
      margin: 0;
      color: var(--text-secondary);
      font-size: var(--text-ui);
      line-height: var(--lh-ui);
      overflow-wrap: anywhere;
    }
    /* The panel's one command, filled as Feedback's Send is. */
    .contact-write {
      justify-self: start;
      display: inline-flex;
      align-items: center;
      min-height: var(--control-height);
      padding: 0 var(--space-4);
      border-radius: var(--radius-control);
      background: var(--primary-fill);
      color: var(--primary-ink);
      font-size: var(--text-ui);
      font-weight: 500;
      text-decoration: none;
      transition: background-color var(--ui-transition) var(--ease-ui);
    }
    @media (hover: hover) and (pointer: fine) {
      .contact-write:hover {
        background: var(--primary-fill-hover);
      }
    }
    @media (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      :global(.contact-button) {
        display: none;
      }
    }
  }
</style>
