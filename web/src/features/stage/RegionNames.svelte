<!--
  Names on the brain (Display › Names on the brain, N): the regions facing the reader that the camera
  shows large enough to label (region-names.ts), each in the route landmarks' haloed type with its dot
  and, where crowded, its leader (stage-labels.ts); a name with no clear place is left out. They are
  chosen when the stage comes to rest and carried with the camera between. Each region's name is a
  button that selects it, as a click on the region does. Under Lobes colour a lobe's name is drawn
  only: the key lists the lobes, and a lobe is no region to select.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import type { Engine, ScreenPoint, Size } from '../../lib/engine/api.ts';
  import { OWN_KEYS_ATTRIBUTE } from '../../lib/core/keyboard.ts';
  import { bindRoving } from '../../lib/ui/roving.ts';
  import { chooseNames, cutCosine } from './region-names.ts';
  import type { Named } from './region-names.ts';
  import { labelBounds, leaderEnd, placeLabels, watchChrome } from './stage-labels.ts';
  import type { Placement } from './stage-labels.ts';
  import './stage-vars.css';

  interface Props {
    engine: Pick<Engine, 'on'> & {
      model: Pick<Engine['model'], 'regions' | 'canSelect' | 'facing'>;
      sections: Pick<Engine['sections'], 'active' | 'frame' | 'state' | 'capAnchors'>;
      camera: Pick<Engine['camera'], 'project' | 'visibleRect' | 'view'>;
    };
    /** The names are drawn (`namesDrawn`). */
    shown: boolean;
    /** Named whenever it faces the reader. */
    selected: string | null;
    /** Under Lobes colour, the lobes the key lists; null under any other colour. */
    lobes: readonly { id: string; label: string }[] | null;
    /** A region's name as the list gives it, and its accessible name, which adds its side. */
    nameOf: (id: string) => { name: string; label: string };
    /** The group's name. */
    label: string;
    onSelect: (id: string) => void;
  }

  let { engine, shown, selected, lobes, nameOf, label, onSelect }: Props = $props();

  /** A label's inline padding (stage-vars.css). */
  const PAD_PX = 4;
  /** The least a name's target is on either axis (WCAG 2.5.8). */
  const TARGET_PX = 24;
  /** How long the display must rest after a change before the names are chosen again: the camera's settle. */
  const REST_MS = 250;

  let names = $state.raw<Named[]>([]);
  let group: HTMLElement | undefined = $state();
  const nodes = new Map<string, HTMLElement>();
  /** Counts the names drawn: a new name's attachment runs after the effect that reads the names. */
  let attached = $state(0);
  const sizes = new Map<string, Size>();
  let chrome: ReturnType<typeof watchChrome> | null = null;
  let roving: ReturnType<typeof bindRoving> | null = null;

  function choose() {
    const { model, sections, camera } = engine;
    const scale = camera.view.scale;
    if (!scale) {
      names = [];
      return;
    }
    const cosine = sections.active
      ? cutCosine(camera.view.basis.back, sections.frame.normal, sections.state.reverse)
      : 0;
    names = chooseNames({
      regions: model.regions,
      drawn: [...model.regions.values()].filter(
        (region) =>
          (region.kind === 'cortex' || region.kind === 'structure') && model.canSelect(region),
      ),
      scale: scale.pixels / scale.millimetres,
      selected,
      byLobe: lobes !== null,
      // From the side the cut keeps, the anatomy hides its faces.
      faces: cosine > 0 ? sections.capAnchors() : [],
      faceCosine: cosine,
      bounds: labelBounds(camera.visibleRect),
      facing: (ids) => model.facing(ids),
      project: (points) => camera.project(points),
    });
  }

  /** Each name's size, its text measured where it is drawn; a name out of sight keeps its last. */
  function measure() {
    for (const [key, node] of nodes) {
      const text = node.querySelector('.stage-label-text')!.getBoundingClientRect();
      if (!text.width) continue;
      sizes.set(key, {
        width: Math.ceil(2 * PAD_PX + text.width),
        height: Math.max(TARGET_PX, Math.ceil(text.height) + 6),
      });
    }
  }

  /** A placement written into its name: the box, the dot on its point, the leader while it stands off. */
  function draw(node: HTMLElement, point: ScreenPoint | null, placement: Placement | null) {
    node.hidden = !placement;
    node.dataset.placed = String(Boolean(placement));
    if (!placement || !point) return;
    const { box, leader } = placement;
    node.style.transform = `translate(${box.x}px, ${box.y}px)`;
    node.style.width = `${box.width}px`;
    node.style.height = `${box.height}px`;
    const dot = { x: point.x - box.x, y: point.y - box.y };
    node.querySelector<HTMLElement>('.stage-label-dot')!.style.translate = `${dot.x}px ${dot.y}px`;
    const end = leaderEnd(point, box);
    const length = Math.hypot(end.x - point.x, end.y - point.y);
    node.dataset.leader = String(leader && length > 4);
    if (leader && length > 4) {
      const line = node.querySelector<HTMLElement>('.stage-label-leader')!;
      line.style.width = `${length}px`;
      line.style.transform = `translate(${dot.x}px, ${dot.y}px) rotate(${Math.atan2(end.y - point.y, end.x - point.x)}rad)`;
    }
  }

  /** Where each name stands as the camera stands now; a dot off the stage or under its chrome is not named. */
  function place() {
    if (!chrome) return;
    const bounds = labelBounds(engine.camera.visibleRect);
    const rects = chrome.rects();
    const covered = ({ x, y }: ScreenPoint) =>
      x < bounds.x ||
      y < bounds.y ||
      x > bounds.x + bounds.width ||
      y > bounds.y + bounds.height ||
      rects.some((r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height);
    // A name just chosen is placed once it is drawn and measured.
    const ready = names.filter(({ key }) => nodes.has(key) && sizes.has(key));
    const points = engine.camera
      .project(ready.map(({ drawn }) => drawn))
      .map((point) => (point && !covered(point) ? point : null));
    const placements = placeLabels(
      ready.map(({ key }, index) => ({
        point: points[index]!,
        sizes: [sizes.get(key)!],
        optional: true,
      })),
      bounds,
      rects,
    );
    ready.forEach(({ key }, index) => draw(nodes.get(key)!, points[index]!, placements[index]!));
    roving?.sync();
  }

  function lobeLabel(lobe: string): string {
    const row = lobes?.find(({ id }) => id === lobe);
    if (!row) throw new Error(`The key lists no lobe ${lobe}.`);
    return row.label;
  }

  // One Tab stop, the arrows walk the names, as the route's toolbar does.
  function rove(node: HTMLElement) {
    roving = bindRoving(node);
    return () => {
      roving!.dispose();
      roving = null;
    };
  }

  // The stage's events: the camera carries the names, its rest and a rested change choose them again.
  $effect(() => {
    if (!shown || !group) return;
    chrome = watchChrome(group.parentElement!, place);
    let rest: ReturnType<typeof setTimeout> | undefined;
    const stops = [
      engine.on('camera', place),
      engine.on('viewport', chrome.stale),
      engine.on('cameraSettled', () => {
        clearTimeout(rest);
        chrome!.stale();
        choose();
      }),
      // A cut dragged or a part hidden: chosen once it has rested, not on every frame of it.
      engine.on('change', () => {
        clearTimeout(rest);
        rest = setTimeout(choose, REST_MS);
      }),
    ];
    return () => {
      clearTimeout(rest);
      stops.forEach((stop) => stop());
      chrome!.dispose();
      chrome = null;
    };
  });

  // The switch, the selection and the colour choose at once.
  $effect(() => {
    void [selected, lobes];
    if (!shown) {
      names = [];
      return;
    }
    untrack(choose);
  });

  // Drawn names are measured, and measured again when a late webfont or larger text changes them.
  $effect(() => {
    void attached;
    if (!names.length || !group) return;
    measure();
    place();
    const observer = new ResizeObserver(() => {
      measure();
      place();
    });
    for (const node of nodes.values()) observer.observe(node.querySelector('.stage-label-text')!);
    return () => observer.disconnect();
  });
</script>

{#if shown}
  <div
    class="region-names"
    role="toolbar"
    aria-label={label}
    bind:this={group}
    {...{ [OWN_KEYS_ATTRIBUTE]: '' }}
    {@attach rove}
  >
    {#each names as named (named.key)}
      {@const track = (node: HTMLElement) => {
        nodes.set(named.key, node);
        untrack(() => (attached += 1));
        return () => nodes.delete(named.key);
      }}
      {#if named.region}
        {@const region = named.region}
        {@const words = nameOf(region)}
        <button
          type="button"
          class="region-name stage-label"
          aria-label={words.label}
          onclick={() => onSelect(region)}
          {@attach track}
        >
          <span class="stage-label-leader" aria-hidden="true"></span>
          <span class="stage-label-dot" aria-hidden="true"></span>
          <span class="stage-label-text stage-label-name" aria-hidden="true">{words.name}</span>
        </button>
      {:else}
        <span class="region-name stage-label lobe-name" aria-hidden="true" {@attach track}>
          <span class="stage-label-leader"></span>
          <span class="stage-label-dot"></span>
          <span class="stage-label-text stage-label-name">{lobeLabel(named.lobe!)}</span>
        </span>
      {/if}
    {/each}
  </div>
{/if}

<style>
  @layer features {
    .region-names {
      position: absolute;
      inset: 0;
      z-index: 1;
      pointer-events: none;
    }
    .region-name {
      border: 0;
      background: none;
      color: var(--overlay-ink);
    }
    /* Out of sight until placed: a name first drawn at the corner would flash there. */
    .region-name:not([data-placed='true']) {
      visibility: hidden;
    }
    .region-name[hidden] {
      display: none;
    }
    button.region-name {
      pointer-events: auto;
      cursor: pointer;
    }
    @media (hover: hover) and (pointer: fine) {
      button.region-name:hover {
        color: var(--overlay-accent);
        --label-dot: var(--overlay-accent);
      }
    }
  }
</style>
