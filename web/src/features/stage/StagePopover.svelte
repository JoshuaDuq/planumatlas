<!--
  One tool of the stage dock and the popover it opens (index.html:436-489, stage-tools.js). U5's non-modal
  `Popover` (stage variant) does the opening: one open at a time, Escape returns focus to the tool, it stays
  open through a press on the stage or a Tab out until its tool closes it, a keyboard open or close is instant. Its
  content has no role of its own, so the body is one `role="dialog"` named by `dialogLabelledby`
  (the trigger says `aria-haspopup="dialog"`).
  - The popover is placed by the dock (`style`), above it, on its start edge (place-popover.ts).
  - It closes when its tool goes (`hidden`: the tract reference has no sections or display settings) or the
    dock goes (`covered`: loading, or under the phone sheet). If focus was on the tool or inside the popover,
    it moves to a tool that is left instead of dropping to the page (deviation g2-focus-when-tool-hidden).
  The classes `stage-field-label`, `stage-field` and `stage-command` are for every popover body on the stage.
  - While a pointer holds a slider, the plate clears off the picture it adjusts (`data-scrubbing`): its ground,
    its edge and everything beside the slider's row fade out, the row keeps a strip of the plate, and all come
    back on release. The body hears `scrubbing`, so nothing it adds grows the plate under the thumb.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import Popover from '../../lib/ui/Popover.svelte';

  interface Props {
    open?: boolean;
    /** Which tool, as `data-tool` on its button: the guided tour points at it by this. */
    tool: 'section' | 'display' | 'place';
    /** What the tool's popover offers to choose between, as `data-offers`: the tour points at Add by what it holds. */
    offers?: string;
    /** The tool is not offered. */
    hidden: boolean;
    /** The dock is not on screen. */
    covered: boolean;
    /** The tool's accessible name, where its drawn text is not it. */
    ariaLabel?: string;
    class?: string;
    /** Left, width and maximum height from `placePopover`. */
    style: string;
    dialogLabelledby: string;
    /** Puts focus on a tool that is still there. */
    rescueFocus: () => void;
    /** What the tool draws; the chevron follows it. */
    name: Snippet;
    body: Snippet<[{ close: () => void; scrubbing: boolean }]>;
  }

  let {
    open = $bindable(false),
    tool,
    offers,
    hidden,
    covered,
    ariaLabel,
    class: className,
    style,
    dialogLabelledby,
    rescueFocus,
    name,
    body,
  }: Props = $props();

  let button = $state<HTMLElement | null>(null);
  let dialog = $state<HTMLElement | null>(null);
  let scrubbing = $state(false);

  // Before the page updates: the tool still has the focus it is about to lose.
  $effect.pre(() => {
    if (!hidden && !covered) return;
    const hadFocus = [button, dialog].some((node) => node?.contains(document.activeElement));
    open = false;
    if (hadFocus && !covered) rescueFocus();
  });

  /** A pointer pressed a slider: clear the plate off the picture until it lets go. Keys never do. */
  function scrub(press: PointerEvent) {
    const range = (press.target as Element).closest<HTMLInputElement>('input[type="range"]');
    if (!range || scrubbing || !press.isPrimary || press.button !== 0) return;
    const row = range.closest<HTMLElement>('.control-field')!;
    const plate = dialog!.closest<HTMLElement>('.popover')!;
    const beside: Element[] = [];
    for (let node: Element = row; node !== dialog; node = node.parentElement!) {
      beside.push(...[...node.parentElement!.children].filter((other) => other !== node));
    }
    // The plate fades as it does when it closes, and comes back the same way.
    const style = getComputedStyle(plate);
    const fade = {
      duration: parseFloat(style.getPropertyValue('--popover-exit')),
      easing: style.getPropertyValue('--ease-ui'),
      fill: 'forwards',
    } as const;
    const fades = [
      plate.animate({ backgroundColor: 'transparent', borderColor: 'transparent' }, fade),
      ...beside.map((element) => element.animate({ opacity: 0 }, fade)),
    ];
    scrubbing = true;
    row.toggleAttribute('data-held', true);
    plate.toggleAttribute('data-scrubbing', true);
    const release = (end: PointerEvent) => {
      if (end.pointerId !== press.pointerId) return;
      for (const type of ['pointerup', 'pointercancel'] as const) {
        removeEventListener(type, release, true);
      }
      range.removeEventListener('lostpointercapture', release);
      for (const back of fades) {
        back.reverse();
        back.addEventListener('finish', () => back.cancel(), { once: true });
      }
      scrubbing = false;
      row.removeAttribute('data-held');
      plate.removeAttribute('data-scrubbing');
    };
    for (const type of ['pointerup', 'pointercancel'] as const) {
      addEventListener(type, release, true);
    }
    range.addEventListener('lostpointercapture', release);
  }
</script>

<Popover variant="stage" bind:open class="stage-popover" {style}>
  {#snippet trigger({ props })}
    <button
      {...props}
      bind:this={button}
      type="button"
      class={['stage-tool', className]}
      data-tool={tool}
      data-offers={offers}
      {hidden}
      aria-label={ariaLabel}
    >
      {@render name()}
      <span class="stage-tool-chevron" aria-hidden="true"></span>
    </button>
  {/snippet}
  {#snippet children({ close })}
    <div
      role="dialog"
      aria-labelledby={dialogLabelledby}
      bind:this={dialog}
      onpointerdowncapture={scrub}
    >
      {@render body({ close, scrubbing })}
    </div>
  {/snippet}
</Popover>

<style>
  @layer features {
    /* Opened above the whole dock from its start edge; the dock keeps it inside the visible stage. */
    :global(.popover.stage-popover) {
      position: absolute;
      bottom: calc(100% + var(--space-2));
      left: 0;
      box-sizing: border-box;
      border-color: var(--stage-edge);
    }
    /* The popover's words start on the tools' words: the dock's inset and a tool's padding. */
    :global(.stage-field-label) {
      display: block;
      margin: 0 0 var(--space-2);
      font-size: var(--text-caption);
      font-weight: 500;
      line-height: var(--lh-caption);
      color: var(--overlay-ink-muted);
    }
    :global(.stage-field) {
      margin-top: var(--space-4);
    }
    /* A held slider's row keeps a strip of the plate, so its name and value stay legible over the picture. */
    :global(.popover.stage-popover [data-held]) {
      margin: calc(-1 * var(--space-1)) calc(-1 * var(--space-2));
      padding: var(--space-1) var(--space-2);
      border-radius: var(--radius-control);
      background: var(--overlay-plate);
    }
    /* Tonal by default (the overlay track); quiet commands drop the fill until hovered. */
    :global(.stage-command) {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      min-height: var(--control-height);
      padding: 0 var(--space-3);
      border: 0;
      border-radius: var(--radius-control);
      background: var(--surface-tonal);
      color: var(--text-primary);
      font-size: var(--text-stage);
      /* At 200 % text a long French name wraps instead of leaving the popover. */
      text-align: left;
      cursor: pointer;
      transition:
        background-color var(--ui-transition) var(--ease-ui),
        color var(--ui-transition) var(--ease-ui),
        transform var(--press-transition) var(--ease-ui);
    }
    :global(.stage-command:active:not(:disabled, [aria-disabled='true'], :focus-visible)) {
      transform: scale(var(--press-scale));
    }
    @media (hover: hover) and (pointer: fine) {
      :global(.stage-command:not(.stage-command-quiet):hover:not(:disabled)) {
        background: var(--surface-tonal-hover);
      }
    }
    @media (pointer: coarse) {
      :global(.stage-command) {
        min-height: 44px;
      }
    }
    :global(.stage-command-quiet) {
      background: none;
      color: var(--overlay-ink-muted);
    }
    @media (hover: hover) and (pointer: fine) {
      :global(.stage-command-quiet:hover:not(:disabled)) {
        background: var(--overlay-plate-hover);
        color: var(--overlay-ink);
      }
    }
  }

  @layer a11y {
    @media (prefers-reduced-motion: reduce) {
      :global(.stage-command) {
        transition-property: background-color, color;
      }
      :global(.stage-command:active) {
        transform: none;
      }
    }
    @media (prefers-contrast: more) {
      /* Tonal fills alone are too faint to find a button by (a11y.css:40). */
      :global(.stage-command) {
        border: 1px solid var(--border-control);
      }
    }
  }
</style>
