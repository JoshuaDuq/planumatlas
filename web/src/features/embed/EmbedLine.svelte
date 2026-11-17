<!--
  The one line under the stage of a frame in a course page (embed=1): what is on it (a region the reader
  picked, then the subject), that it is not clinical anatomy, which never gives way, Full screen where the
  frame allows it, and Open in Planum: the same view, not embedded, in a tab of its own. The link is
  rewritten whenever it may be followed, so it carries the view as it stands then.
-->
<script lang="ts">
  import { withEmbed } from '../../lib/core/embed.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import type { Language } from '../../lib/types/index.ts';
  import IconButton, { iconGraphic } from '../../lib/ui/IconButton.svelte';

  interface Props {
    lang: Language;
    /** The subject's name; empty until the anatomy index has named it. */
    subject: string;
    /** The selected region, with its side, or null. */
    selection: string | null;
    /**
     * The address of the view on screen, not embedded, written now unless a link is still being
     * applied. Asked only as the reader may follow the link, never to render it.
     */
    viewHref: () => string;
    /** The stage's full screen, where the frame allows it; null where it does not. */
    fullscreen: { active: boolean; ready: boolean; toggle: () => void } | null;
  }

  let { lang, subject, selection, viewHref, fullscreen }: Props = $props();

  const copy = $derived(t(lang, 'viewport'));
  const fullscreenLabel = $derived(fullscreen?.active ? copy.exitFullscreen : copy.fullscreen);

  let open: HTMLAnchorElement;
  // Rendered from the address as it stands, read and never written: the frame's own link is applied
  // after this line mounts, and the address bar keeps it until it has settled.
  const arrived = withEmbed(location.href, false);
  // Before it is followed by a click, a key, a middle click or the context menu.
  const refresh = () => {
    open.href = viewHref();
  };
</script>

<footer class="embed-line">
  <p class="embed-text">
    <span class="embed-subject">{selection ? `${selection} · ${subject}` : subject}</span>
    <span class="embed-statement">{t(lang, 'footer').statementAlone}</span>
  </p>
  {#if fullscreen}
    <IconButton
      icon="fullscreen"
      label={fullscreenLabel}
      data-tooltip={fullscreenLabel}
      disabled={!fullscreen.ready}
      onclick={fullscreen.toggle}
    />
  {/if}
  <a
    bind:this={open}
    class="embed-open"
    href={arrived}
    target="_blank"
    rel="noreferrer"
    onfocus={refresh}
    onpointerenter={refresh}
    onclick={refresh}
    oncontextmenu={refresh}
    ><span>{copy.openInPlanum}</span><span class="visually-hidden"
      >{` ${t(lang, 'link').newTab}`}</span
    >{@render iconGraphic('external-link')}</a
  >
</footer>

<style>
  @layer features {
    /* The status bar's line and ink (Colophon.svelte), across the whole frame. */
    .embed-line {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      min-width: 0;
      min-height: var(--footer-height);
      padding: 0 var(--stage-gutter);
      border-top: 1px solid var(--border-subtle);
      background: var(--surface-base);
      color: var(--text-secondary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      white-space: nowrap;
    }
    .embed-text {
      display: flex;
      flex: 1 1 0;
      align-items: center;
      gap: var(--space-3);
      min-width: 0;
      margin: 0;
    }
    /* What is shown gives way; the statement never does. */
    .embed-subject {
      flex: 0 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .embed-subject:empty {
      display: none;
    }
    .embed-statement {
      flex: none;
      padding-left: var(--space-3);
      border-left: 1px solid var(--border-subtle);
      font-weight: 500;
    }
    .embed-subject:empty + .embed-statement {
      padding-left: 0;
      border-left: 0;
    }
    .embed-open {
      display: inline-flex;
      flex: none;
      align-items: center;
      gap: var(--space-1);
      min-height: 24px;
      color: var(--accent);
      font-weight: 500;
      text-decoration: none;
    }
    @media (hover: hover) and (pointer: fine) {
      .embed-open:hover {
        color: var(--accent-hover);
        text-decoration: underline;
        text-underline-offset: 3px;
      }
    }
    @media (pointer: coarse) {
      .embed-open {
        align-self: stretch;
      }
    }
  }
  @layer a11y {
    @media (forced-colors: active) {
      .embed-open {
        color: LinkText;
      }
    }
  }
</style>
