<!--
  The open lesson's whole route on the picture: each landmark's dot at its anchor in this brain and its
  number beside it in haloed type, stood off along a leader where crowded (stage-labels.ts). The sheet lists
  the names; each number's tooltip names its landmark. Each number opens its landmark, and the arrows walk
  them. No line joins the landmarks: a straight segment would misstate the path.
-->
<script lang="ts">
  import type { Engine, ScreenPoint, Size } from '../../lib/engine/api.ts';
  import { OWN_KEYS_ATTRIBUTE } from '../../lib/core/keyboard.ts';
  import { bindRoving } from '../../lib/ui/roving.ts';
  import { labelBounds, leaderEnd, placeLabels, watchChrome } from './stage-labels.ts';
  import type { Placement } from './stage-labels.ts';
  import './stage-vars.css';

  interface Props {
    engine: Pick<Engine, 'on'> & {
      camera: Pick<Engine['camera'], 'project' | 'visibleRect'>;
      model: Pick<Engine['model'], 'anchorOf'>;
    };
    /** The open lesson's landmarks in order while its whole route is shown; empty otherwise. */
    marks: readonly { region: string; label: string }[];
    /** The group's name. */
    label: string;
    onOpen: (index: number) => void;
  }

  let { engine, marks, label, onOpen }: Props = $props();

  /** A label's inline padding (stage-vars.css). */
  const PAD_PX = 4;
  /** The least a label's target is on either axis (WCAG 2.5.8). */
  const TARGET_PX = 24;

  const buttons: HTMLElement[] = [];
  let group: HTMLElement | undefined = $state();
  let sizes: Size[] = [];
  let chrome: ReturnType<typeof watchChrome> | null = null;

  /** Each label's size: its padded number, on a target of at least 24 px. */
  function measure(): Size[] {
    return buttons.slice(0, marks.length).map((button) => {
      const number = button.querySelector('.stage-label-number')!.getBoundingClientRect();
      return {
        width: Math.max(TARGET_PX, Math.ceil(2 * PAD_PX + number.width)),
        height: TARGET_PX,
      };
    });
  }

  /** A placement written into its label: the box, the dot on the anchor, the leader while it stands off. */
  function draw(button: HTMLElement, point: ScreenPoint | null, placement: Placement | null) {
    // Behind the camera: not drawn, and not reachable.
    button.style.display = placement ? '' : 'none';
    if (!placement || !point) return;
    const { box, leader } = placement;
    button.style.transform = `translate(${box.x}px, ${box.y}px)`;
    button.style.width = `${box.width}px`;
    button.style.height = `${box.height}px`;
    const dot = { x: point.x - box.x, y: point.y - box.y };
    button.querySelector<HTMLElement>('.stage-label-dot')!.style.translate =
      `${dot.x}px ${dot.y}px`;
    const end = leaderEnd(point, box);
    const length = Math.hypot(end.x - point.x, end.y - point.y);
    button.dataset.leader = String(leader && length > 4);
    if (leader && length > 4) {
      const line = button.querySelector<HTMLElement>('.stage-label-leader')!;
      line.style.width = `${length}px`;
      line.style.transform = `translate(${dot.x}px, ${dot.y}px) rotate(${Math.atan2(end.y - point.y, end.x - point.x)}rad)`;
    }
  }

  function place() {
    if (!group || !chrome) return;
    const points = engine.camera.project(
      marks.map(({ region }) => {
        const anchor = engine.model.anchorOf(region);
        if (!anchor) throw new Error(`Missing landmark anchor: ${region}`);
        return anchor;
      }),
    );
    const placements = placeLabels(
      points.map((point, index) => ({ point, sizes: [sizes[index]!] })),
      labelBounds(engine.camera.visibleRect),
      chrome.rects(),
    );
    placements.forEach((placement, index) => draw(buttons[index]!, points[index]!, placement));
  }

  // One Tab stop, the arrows walk the labels in order, as the gizmo's toolbar does.
  function rove(node: HTMLElement) {
    const roving = bindRoving(node);
    return () => roving.dispose();
  }

  $effect(() => {
    if (!marks.length || !group) return;
    sizes = measure();
    chrome = watchChrome(group.parentElement!, place);
    place();
    // A late webfont or larger text changes a label's size.
    const observer = new ResizeObserver(() => {
      sizes = measure();
      place();
    });
    for (const button of buttons.slice(0, marks.length)) {
      for (const text of button.querySelectorAll('.stage-label-text')) observer.observe(text);
    }
    const stops = [
      engine.on('camera', place),
      engine.on('viewport', chrome.stale),
      // A hint fading or a letter hidden changes no size; the camera at rest measures again.
      engine.on('cameraSettled', chrome.stale),
    ];
    return () => {
      observer.disconnect();
      chrome!.dispose();
      chrome = null;
      stops.forEach((stop) => stop());
    };
  });
</script>

{#if marks.length}
  <div
    class="route-marks"
    role="toolbar"
    aria-label={label}
    bind:this={group}
    {...{ [OWN_KEYS_ATTRIBUTE]: '' }}
    {@attach rove}
  >
    {#each marks as mark, index (mark.region)}
      <button
        type="button"
        class="route-mark stage-label"
        aria-label={mark.label}
        data-tooltip={mark.label}
        onclick={() => onOpen(index)}
        {@attach (node) => void (buttons[index] = node)}
      >
        <span class="stage-label-leader" aria-hidden="true"></span>
        <span class="stage-label-dot" aria-hidden="true"></span>
        <span class="stage-label-text stage-label-number" aria-hidden="true">{index + 1}</span>
      </button>
    {/each}
  </div>
{/if}

<style>
  @layer features {
    .route-marks {
      position: absolute;
      inset: 0;
      z-index: 1;
      pointer-events: none;
    }
    .route-mark {
      justify-content: center;
      border: 0;
      background: none;
      color: var(--overlay-ink);
      pointer-events: auto;
      cursor: pointer;
    }
    @media (hover: hover) and (pointer: fine) {
      .route-mark:hover {
        color: var(--overlay-accent);
        --label-dot: var(--overlay-accent);
      }
    }
  }
</style>
