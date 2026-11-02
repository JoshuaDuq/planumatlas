<!--
  The orientation gizmo, top right of the visible stage, after Blender's: each anatomical direction as the
  camera sees it frames its view, the centre the oblique one. Positions follow the per-frame `camera` event
  straight into the DOM. The chevrons are the single-pointer alternative to dragging (WCAG 2.5.7).
-->
<script lang="ts">
  import { t } from '../../lib/core/i18n/index.ts';
  import type { CameraView, Engine, OrbitTurn } from '../../lib/engine/api.ts';
  import { ORBIT_KEYS } from '../../lib/engine/render/keyboard-orbit.ts';
  import { projectAxes } from '../../lib/engine/render/orientation.ts';
  import type { Letter } from '../../lib/engine/render/orientation.ts';
  import type { StageLayout } from '../../lib/state/stage-layout.svelte.ts';
  import type { Language, ViewName } from '../../lib/types/index.ts';
  import IconButton from '../../lib/ui/IconButton.svelte';
  import { OWN_KEYS_ATTRIBUTE } from '../../lib/ui/keys.ts';
  import { bindRoving } from '../../lib/ui/roving.ts';
  import type { DockCommands } from './dock-commands.ts';

  interface Props {
    engine: Pick<Engine, 'on'> & {
      camera: Pick<Engine['camera'], 'view' | 'viewHeld' | 'orbitBy'>;
    };
    stage: Pick<StageLayout, 'retireHint' | 'registerGizmo'>;
    lang: Language;
    /** The anatomy is on screen (status `ready` or `switching`). */
    ready: boolean;
    /** The named view the session keeps. */
    viewName: string;
    commands: Pick<DockCommands, 'chooseView' | 'reset'>;
  }

  let { engine, stage, lang, ready, viewName, commands }: Props = $props();

  const VIEWS: Record<Letter, ViewName> = {
    R: 'right',
    L: 'left',
    S: 'superior',
    I: 'inferior',
    P: 'posterior',
    A: 'anterior',
  };
  const LETTERS = Object.keys(VIEWS) as Letter[];
  const PAIRS = [
    ['R', 'L'],
    ['S', 'I'],
    ['P', 'A'],
  ] as const;
  const TURNS = [
    { key: 'orbitLeft', side: 'left', turn: ORBIT_KEYS.ArrowLeft },
    { key: 'orbitRight', side: 'right', turn: ORBIT_KEYS.ArrowRight },
    { key: 'orbitUp', side: 'up', turn: ORBIT_KEYS.ArrowUp },
    { key: 'orbitDown', side: 'down', turn: ORBIT_KEYS.ArrowDown },
  ] as const;

  const copy = $derived(t(lang, 'viewport'));
  const names = $derived(t(lang, 'views'));
  const letters = $derived(t(lang, 'orientation'));

  // Whether the camera still sits on the named view; the engine says when it stops.
  let held = $state(false);
  $effect(() => {
    held = engine.camera.viewHeld;
    return engine.on('viewHeld', (event) => (held = event.held));
  });
  const heldName = $derived(held ? viewName : '');

  const buttons = {} as Record<Letter, HTMLElement>;
  // Each axis is drawn twice: the stage's dark halo under a faint line, so it reads over tissue too.
  const axes: Partial<Record<Letter, SVGLineElement[]>> = {};
  // A letter's target and how far its centre goes from the axes' origin, in pixels; they change with the
  // pointer and the device class, which change the gizmo's own box.
  let metrics = { target: 24, reach: 21 };

  // The basis last drawn, for a re-measure between camera events.
  let shown: CameraView['basis'];

  function place(basis: CameraView['basis']) {
    shown = basis;
    const drawn = projectAxes(basis);
    for (const { letter, x, y, depth } of drawn) {
      const style = buttons[letter].style;
      style.setProperty('--x', x.toFixed(3));
      style.setProperty('--y', y.toFixed(3));
      style.setProperty('--near', ((depth + 1) / 2).toFixed(3));
      // Toward the viewer draws, and takes the pointer, over the centre and over what points away.
      style.zIndex = String(Math.round((depth + 1) * 50));
      buttons[letter].dataset.facing = depth < 0 ? 'away' : 'toward';
      for (const line of axes[letter] ?? []) {
        line.setAttribute('x1', String(x));
        line.setAttribute('y1', String(y));
        line.setAttribute('x2', String(-x));
        line.setAttribute('y2', String(-y));
      }
    }
    // A letter pointing away whose centre lies under a facing letter's target, or the centre's, is behind
    // it: a press there would land in front anyway, so the one behind takes none (the keyboard reaches it).
    const toward = [{ x: 0, y: 0 }, ...drawn.filter(({ depth }) => depth >= 0)];
    for (const { letter, x, y, depth } of drawn) {
      buttons[letter].dataset.behind = String(
        depth < 0 &&
          toward.some(
            (other) => Math.hypot(other.x - x, other.y - y) * metrics.reach < metrics.target / 2,
          ),
      );
    }
  }

  function measure(node: HTMLElement) {
    stage.registerGizmo(node);
    const observer = new ResizeObserver(() => {
      const style = getComputedStyle(node);
      metrics = {
        target: parseFloat(style.getPropertyValue('--gizmo-letter-target')),
        reach: parseFloat(style.getPropertyValue('--gizmo-span')) / 2 - 9,
      };
      place(shown);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      stage.registerGizmo(null);
    };
  }

  $effect(() => {
    place(engine.camera.view.basis);
    return engine.on('camera', (camera) => place(camera.basis));
  });

  function rove(group: HTMLElement) {
    const roving = bindRoving(group);
    return () => roving.dispose();
  }

  function choose(view: ViewName) {
    stage.retireHint();
    commands.chooseView(view);
  }

  function turn(step: OrbitTurn) {
    stage.retireHint();
    engine.camera.orbitBy(step);
  }
</script>

<div
  class="orientation-gizmo"
  role="toolbar"
  aria-label={copy.viewAria}
  hidden={!ready}
  {...{ [OWN_KEYS_ATTRIBUTE]: '' }}
  {@attach rove}
  {@attach measure}
>
  <div class="gizmo-field">
    <svg class="gizmo-axes" viewBox="-1 -1 2 2" aria-hidden="true" focusable="false">
      {#each ['halo', 'ink'] as layer (layer)}
        {#each PAIRS as [letter] (letter)}
          <line
            class={layer}
            vector-effect="non-scaling-stroke"
            {@attach (node: SVGLineElement) => void (axes[letter] ??= []).push(node)}
          />
        {/each}
      {/each}
    </svg>
    <button
      type="button"
      class="gizmo-centre"
      aria-label={copy.namedView(names.oblique)}
      aria-pressed={heldName === 'oblique'}
      data-tooltip={copy.namedView(names.oblique)}
      onclick={() => choose('oblique')}
    ></button>
    {#each LETTERS as letter (letter)}
      <button
        type="button"
        class="gizmo-letter"
        aria-label={copy.namedView(names[VIEWS[letter]])}
        aria-pressed={heldName === VIEWS[letter]}
        data-letter={letter}
        data-tooltip={copy.namedView(names[VIEWS[letter]])}
        onclick={() => choose(VIEWS[letter])}
        {@attach (node) => void (buttons[letter] = node)}
      >
        <span aria-hidden="true">{letters[letter]}</span>
      </button>
    {/each}
  </div>
  <div role="group" aria-label={copy.orbitGroup}>
    {#each TURNS as { key, side, turn: step } (key)}
      <IconButton
        icon="chevron-right"
        class="gizmo-turn"
        label={copy[key]}
        data-side={side}
        data-tooltip={copy[key]}
        onclick={() => turn(step)}
      />
    {/each}
  </div>
  <IconButton
    icon="reset"
    class="gizmo-reset"
    label={t(lang, 'display').resetView}
    data-tooltip={t(lang, 'display').resetView}
    onclick={commands.reset}
  />
</div>

<style>
  @layer features {
    /*
     * No plate: the letters and axes are markings on the picture, held off tissue by the stage's halo. The
     * chevrons and Reset view keep a small glyph by the axes; on a coarse pointer only their hit area grows,
     * outward, never past the gutter.
     */
    .orientation-gizmo {
      --gizmo-span: 60px;
      --gizmo-letter-target: 24px;
      --gizmo-target: 24px;
      --gizmo-spill: min(var(--gizmo-target) - 24px, var(--stage-gutter));
      /* How far a letter's centre goes: its drawn circle (18 px) stays inside the span. */
      --gizmo-reach: calc(var(--gizmo-span) / 2 - 9px);
      --gizmo-ring: calc(var(--gizmo-span) / 2 + 3px);
      position: absolute;
      z-index: 2;
      top: calc(var(--vis-top) + var(--key-top) + var(--stage-gutter) - var(--gizmo-spill));
      right: calc(var(--vis-right) + var(--key-right) + var(--stage-gutter) - var(--gizmo-spill));
      width: calc(2 * (var(--gizmo-ring) + var(--gizmo-target)));
      height: calc(2 * (var(--gizmo-ring) + var(--gizmo-target)));
      pointer-events: none;
    }
    .orientation-gizmo[hidden] {
      display: none;
    }
    .orientation-gizmo :global(button) {
      pointer-events: auto;
    }
    @media (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      .orientation-gizmo {
        --gizmo-span: 56px;
      }
    }
    @media (pointer: coarse) {
      .orientation-gizmo {
        --gizmo-letter-target: 44px;
        --gizmo-target: 44px;
      }
    }
    .gizmo-field {
      position: absolute;
      top: 50%;
      left: 50%;
    }
    .gizmo-axes {
      position: absolute;
      top: calc(-1 * var(--gizmo-reach));
      left: calc(-1 * var(--gizmo-reach));
      width: calc(2 * var(--gizmo-reach));
      height: calc(2 * var(--gizmo-reach));
      overflow: visible;
    }
    .gizmo-axes .halo {
      stroke: var(--overlay-halo-core);
      stroke-width: 3;
    }
    .gizmo-axes .ink {
      stroke: var(--overlay-ink-faint);
      stroke-width: 1;
    }
    /* Unscaled targets; only the drawn circle shrinks with depth. The one drawn in front takes the press. */
    .gizmo-centre,
    .gizmo-letter {
      position: absolute;
      top: 0;
      left: 0;
      display: grid;
      place-items: center;
      width: var(--gizmo-letter-target);
      height: var(--gizmo-letter-target);
      margin: calc(var(--gizmo-letter-target) / -2);
      padding: 0;
      border: 0;
      border-radius: 50%;
      background: none;
      cursor: pointer;
    }
    .gizmo-letter[data-behind='true'] {
      pointer-events: none;
    }
    .gizmo-centre {
      z-index: 50;
    }
    .gizmo-centre::before {
      content: '';
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--overlay-ink-muted);
      box-shadow: 0 0 0 1.5px var(--overlay-halo-core);
    }
    .gizmo-letter {
      transform: translate(
        calc(var(--x, 0) * var(--gizmo-reach)),
        calc(var(--y, 0) * var(--gizmo-reach))
      );
      color: var(--overlay-ink);
      font-size: var(--text-caption);
      font-weight: 600;
      line-height: var(--lh-caption);
    }
    /* A drawn circle of 18 px; pointing away, smaller and dimmer. The held view's is the accent. */
    .gizmo-letter > span {
      display: grid;
      place-items: center;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background-color: var(--overlay-raised);
      box-shadow: inset 0 0 0 1px var(--overlay-halo-core);
      scale: calc(0.8 + 0.2 * var(--near, 1));
    }
    .gizmo-letter[data-facing='away'] {
      color: var(--overlay-ink-muted);
    }
    .gizmo-letter:global([data-facing='away']) > span {
      background-color: var(--overlay-track);
    }
    .gizmo-letter[aria-pressed='true'] {
      color: var(--overlay-halo-core);
    }
    .gizmo-letter[aria-pressed='true'] > span,
    .gizmo-centre[aria-pressed='true']::before {
      background-color: var(--overlay-accent);
    }
    @media (hover: hover) and (pointer: fine) {
      .gizmo-letter:hover:not([aria-pressed='true']) {
        color: var(--overlay-ink);
      }
      .gizmo-letter:hover:not([aria-pressed='true']) > span {
        background-color: var(--overlay-control-border);
      }
      .gizmo-centre:hover:not([aria-pressed='true'])::before {
        background: var(--overlay-ink);
      }
    }
    /* Over the letters' targets where they meet: a chevron's glyph is the chevron's to the ring. */
    .orientation-gizmo :global(.icon-button) {
      position: absolute;
      z-index: 101;
      width: var(--gizmo-target);
      height: var(--gizmo-target);
      min-width: 0;
      min-height: 0;
      color: var(--overlay-ink-muted);
    }
    /* Off the axes they may sit on tissue: the markings' halo keeps them readable. */
    .orientation-gizmo :global(.icon-button .control-icon) {
      filter: drop-shadow(0 0 1px var(--overlay-halo-core)) drop-shadow(0 0 2px var(--overlay-halo));
    }
    @media (hover: hover) and (pointer: fine) {
      .orientation-gizmo :global(.icon-button:hover) {
        background: none;
        color: var(--overlay-ink);
      }
    }
    .orientation-gizmo :global(.icon-button:focus-visible) {
      color: var(--overlay-ink);
    }
    /* Each chevron's target starts at the ring and grows outward; its glyph keeps to the ring. */
    .orientation-gizmo :global(.gizmo-turn[data-side='right']) {
      top: calc(50% - var(--gizmo-target) / 2);
      left: calc(50% + var(--gizmo-ring));
      justify-content: flex-start;
    }
    .orientation-gizmo :global(.gizmo-turn[data-side='left']) {
      top: calc(50% - var(--gizmo-target) / 2);
      right: calc(50% + var(--gizmo-ring));
      justify-content: flex-end;
    }
    .orientation-gizmo :global(.gizmo-turn[data-side='up']) {
      bottom: calc(50% + var(--gizmo-ring));
      left: calc(50% - var(--gizmo-target) / 2);
      align-items: flex-end;
    }
    .orientation-gizmo :global(.gizmo-turn[data-side='down']) {
      top: calc(50% + var(--gizmo-ring));
      left: calc(50% - var(--gizmo-target) / 2);
      align-items: flex-start;
    }
    .orientation-gizmo :global(.gizmo-turn[data-side='left'] .control-icon) {
      rotate: 180deg;
    }
    .orientation-gizmo :global(.gizmo-turn[data-side='up'] .control-icon) {
      rotate: -90deg;
    }
    .orientation-gizmo :global(.gizmo-turn[data-side='down'] .control-icon) {
      rotate: 90deg;
    }
    /* In the corner under the axes, its glyph toward them; on a short stage, clear of the right letter. */
    .orientation-gizmo :global(.gizmo-reset) {
      right: 0;
      bottom: 0;
      align-items: flex-start;
      justify-content: flex-start;
    }
    @media (max-height: 480px) and (orientation: landscape) {
      .orientation-gizmo :global(.gizmo-reset) {
        right: auto;
        left: 0;
        justify-content: flex-end;
      }
    }
  }

  @layer a11y {
    @media (forced-colors: active) {
      .gizmo-letter > span,
      .gizmo-centre::before {
        outline: 1px solid ButtonText;
        outline-offset: -1px;
      }
      .gizmo-axes line {
        stroke: CanvasText;
      }
      .gizmo-letter[aria-pressed='true'],
      .gizmo-centre[aria-pressed='true'] {
        outline: 2px solid Highlight;
        outline-offset: 1px;
      }
    }
  }
</style>
