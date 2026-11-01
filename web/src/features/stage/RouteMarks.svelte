<!--
  The open lesson's whole route on the picture: each landmark's number at its anchor in this brain, the
  point the linked MRI centres on, so a number never sits outside its own structure. Haloed type like the
  orientation letters, not plates; each number opens its landmark. Positions follow the `camera` and
  `viewport` events straight into the DOM. No line joins them: a straight segment would misstate the path.
-->
<script lang="ts">
  import type { Engine } from '../../lib/engine/api.ts';

  interface Props {
    engine: Pick<Engine, 'on'> & {
      camera: Pick<Engine['camera'], 'project'>;
      model: Pick<Engine['model'], 'anchorOf'>;
    };
    /** The open lesson's landmarks in order while its whole route is shown; empty otherwise. */
    marks: readonly { region: string; label: string }[];
    /** The group's name. */
    label: string;
    onOpen: (index: number) => void;
  }

  let { engine, marks, label, onOpen }: Props = $props();

  const buttons: HTMLElement[] = [];

  function place() {
    const anchors = marks.map(({ region }) => {
      const anchor = engine.model.anchorOf(region);
      if (!anchor) throw new Error(`Missing landmark anchor: ${region}`);
      return anchor;
    });
    engine.camera.project(anchors).forEach((point, index) => {
      const button = buttons[index]!;
      // Behind the camera: not drawn, and not reachable.
      button.style.display = point ? '' : 'none';
      if (point) button.style.transform = `translate(${point.x}px, ${point.y}px)`;
    });
  }

  $effect(() => {
    if (!marks.length) return;
    place();
    const offCamera = engine.on('camera', place);
    const offViewport = engine.on('viewport', place);
    return () => {
      offCamera();
      offViewport();
    };
  });
</script>

{#if marks.length}
  <div class="route-marks" role="group" aria-label={label}>
    {#each marks as mark, index (mark.region)}
      <button
        type="button"
        class="route-mark"
        aria-label={mark.label}
        data-tooltip={mark.label}
        onclick={() => onOpen(index)}
        {@attach (node) => void (buttons[index] = node)}
      >
        <span aria-hidden="true">{index + 1}</span>
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
    /*
     * The button's lower left holds a dot on the anchor; the number stands just above and to the right
     * of it, so the dot, not the glyph, marks the point.
     */
    .route-mark {
      position: absolute;
      top: -20px;
      left: -4px;
      display: block;
      min-width: 24px;
      height: 24px;
      padding: 0 2px 0 9px;
      border: 0;
      background: none;
      color: var(--overlay-ink);
      -webkit-text-stroke: 3px var(--overlay-halo-core);
      paint-order: stroke fill;
      text-shadow:
        0 0 1px var(--overlay-halo-core),
        0 0 2px var(--overlay-halo-core),
        0 0 4px var(--overlay-halo-core),
        0 0 8px var(--overlay-halo);
      font-size: var(--text-stage);
      font-weight: 600;
      line-height: var(--lh-caption);
      text-align: left;
      pointer-events: auto;
      cursor: pointer;
    }
    .route-mark::before {
      content: '';
      position: absolute;
      bottom: 1.5px;
      left: 1.5px;
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--overlay-ink);
      box-shadow: 0 0 0 1.5px var(--overlay-halo-core);
    }
    @media (hover: hover) and (pointer: fine) {
      .route-mark:hover {
        color: var(--overlay-accent);
      }
      .route-mark:hover::before {
        background: var(--overlay-accent);
      }
    }
  }

  @layer a11y {
    @media (forced-colors: active) {
      .route-mark {
        color: CanvasText;
      }
      .route-mark::before {
        background: CanvasText;
      }
    }
  }
</style>
