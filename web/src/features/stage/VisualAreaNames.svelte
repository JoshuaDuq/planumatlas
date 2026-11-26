<!--
  The visual areas' names on the visual field map's stage, each centred on its area in haloed type, larger
  areas first and a name left out where it would cover another (area-names.ts). The engine outlines the
  areas and says where each anchor stands and whether the cortex hides it. Pointer-transparent and hidden
  from assistive technology: the map's panel says what the outlines are, and a click reads the area.
-->
<script lang="ts">
  import type { Engine } from '../../lib/engine/api.ts';
  import type { Size } from '../../lib/types/index.ts';
  import { areaNameBoxes, areaNameKey } from './area-names.ts';
  import { labelBounds, watchChrome } from './stage-labels.ts';
  import './stage-vars.css';

  interface Props {
    engine: Pick<Engine, 'on'> & {
      camera: Pick<Engine['camera'], 'visibleRect'>;
      visualField: Pick<Engine['visualField'], 'areaNames'>;
    };
    /** The areas are outlined on the stage, so their names are drawn. */
    shown: boolean;
    /** Every named area, in the manifest's order. */
    names: readonly string[];
  }

  let { engine, shown, names }: Props = $props();

  const keys = $derived(
    (['left', 'right'] as const).flatMap((hemisphere) =>
      names.map((name) => ({ key: areaNameKey({ hemisphere, name }), name })),
    ),
  );
  const spans = new Map<string, HTMLElement>();
  let group: HTMLElement | undefined = $state();
  let sizes = new Map<string, Size>();
  let chrome: ReturnType<typeof watchChrome> | null = null;

  function measure() {
    sizes = new Map(
      [...spans].map(([key, span]) => {
        const box = span.getBoundingClientRect();
        return [key, { width: Math.ceil(box.width), height: Math.ceil(box.height) }];
      }),
    );
  }

  function place() {
    if (!chrome) return;
    const boxes = areaNameBoxes(
      engine.visualField.areaNames(),
      sizes,
      labelBounds(engine.camera.visibleRect),
      chrome.rects(),
    );
    for (const [key, span] of spans) {
      const box = boxes.get(key);
      // Hidden rather than removed, so a name left out keeps its measured size.
      span.style.visibility = box ? 'visible' : 'hidden';
      if (box) span.style.transform = `translate(${box.x}px, ${box.y}px)`;
    }
  }

  $effect(() => {
    if (!shown || !group) return;
    measure();
    chrome = watchChrome(group.parentElement!, place);
    place();
    // A late webfont or larger text changes a name's size.
    const observer = new ResizeObserver(() => {
      measure();
      place();
    });
    for (const span of spans.values()) observer.observe(span);
    const stops = [
      engine.on('camera', place),
      engine.on('viewport', chrome.stale),
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

{#if shown}
  <div class="area-names" aria-hidden="true" bind:this={group}>
    {#each keys as { key, name } (key)}
      <span
        class="area-name stage-label-text"
        data-name={key}
        {@attach (node) => {
          spans.set(key, node);
          return () => spans.delete(key);
        }}
      >
        {name}
      </span>
    {/each}
  </div>
{/if}

<style>
  @layer features {
    .area-names {
      position: absolute;
      inset: 0;
      z-index: 1;
      overflow: hidden;
      pointer-events: none;
    }
    .area-name {
      position: absolute;
      top: 0;
      left: 0;
      color: var(--overlay-ink);
      font-size: var(--text-stage);
      font-weight: 500;
      line-height: var(--lh-caption);
      white-space: nowrap;
      visibility: hidden;
    }
  }
</style>
