<!--
  What a frame in a course page (embed=1) shows until the reader asks for the brain: the site's still
  picture (`public/preview.png`, its sharing image) and one control that names what it downloads. Nothing
  of the anatomy is fetched before it is pressed (app/boot.ts). Lit by the stage, as its controls are.
-->
<script lang="ts">
  import { ASSET_BASE } from '../../../build/site.ts';
  import { OPENING_DOWNLOAD_MB } from '../../lib/core/embed.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import type { Language } from '../../lib/types/index.ts';

  let { lang, onLoad }: { lang: Language; onLoad: () => void } = $props();

  const copy = $derived(t(lang, 'viewport'));
</script>

<div class="embed-poster">
  <img src="{ASSET_BASE}preview.png" alt={copy.posterAlt} width="1200" height="630" />
  <button type="button" onclick={onLoad}>{copy.loadBrain(OPENING_DOWNLOAD_MB)}</button>
</div>

<style>
  @layer features {
    .embed-poster {
      position: absolute;
      inset: 0;
      z-index: 3;
      display: grid;
      place-items: end center;
      padding: var(--space-8) var(--stage-gutter);
      background: var(--scene-background);
    }
    /* The whole brain in any frame: the picture's own dark ground meets the stage's. */
    img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    button {
      position: relative;
      min-height: var(--control-height);
      max-width: 100%;
      padding: var(--space-1) var(--space-3);
      border: 1px solid var(--stage-edge);
      border-radius: var(--radius-control);
      background: var(--overlay-plate);
      color: var(--overlay-ink);
      font-size: var(--text-stage);
      cursor: pointer;
      transition:
        background-color var(--ui-transition) var(--ease-ui),
        transform var(--press-transition) var(--ease-ui);
    }
    button:active:not(:focus-visible) {
      transform: scale(var(--press-scale));
    }
    @media (hover: hover) and (pointer: fine) {
      button:hover {
        background: var(--overlay-plate-hover);
      }
    }
    @media (pointer: coarse) {
      button {
        min-height: 44px;
      }
    }
  }
  @layer a11y {
    @media (prefers-reduced-motion: reduce) {
      button {
        transition-property: background-color;
      }
      button:active:not(:focus-visible) {
        transform: none;
      }
    }
    @media (forced-colors: active) {
      button {
        border-color: ButtonText;
      }
    }
  }
</style>
