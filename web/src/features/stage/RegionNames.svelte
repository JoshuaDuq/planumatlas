<!--
  Names on the brain (Display › Names on the brain, N): the regions facing the reader that the camera
  shows large enough to label (region-names.ts), each in the route landmarks' haloed type with its dot.
  Where the stage has room beside the anatomy they stand there in columns, a leader to each dot, as an
  atlas plate labels its figure (name-columns.ts); zoomed in past that room they stand beside their dots
  (stage-labels.ts). A name with no clear place is left out. They are chosen when the stage comes to
  rest, keeping the names already shown where they still can be, and carried with the camera between:
  each keeps its column or its side of its dot, glides where its place jumps, and fades while its point
  is out of sight. A moved cut carries the names on its faces. Each region's name is a button that
  selects it, as a click on the region does. Under Lobes colour a lobe's name is drawn only: the key
  lists the lobes, and a lobe is no region to select.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import type { Engine, Rect, ScreenPoint, Size, Vec3 } from '../../lib/engine/api.ts';
  import { OWN_KEYS_ATTRIBUTE } from '../../lib/core/keyboard.ts';
  import { bindRoving } from '../../lib/ui/roving.ts';
  import { placeColumns, wrap } from './name-columns.ts';
  import type { Words } from './name-columns.ts';
  import { chooseNames, cutCosine } from './region-names.ts';
  import type { Named } from './region-names.ts';
  import { calloutEnd, labelBounds, leaderEnd, placeLabels, watchChrome } from './stage-labels.ts';
  import type { Side } from './stage-labels.ts';
  import './stage-vars.css';

  interface Props {
    engine: Pick<Engine, 'on'> & {
      model: Pick<Engine['model'], 'regions' | 'canSelect' | 'facing' | 'facingArea' | 'inSight'>;
      sections: Pick<Engine['sections'], 'active' | 'frame' | 'state' | 'capAnchors'>;
      camera: Pick<Engine['camera'], 'project' | 'visibleRect' | 'view' | 'anatomyRect'>;
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
  /** A name's widest line where it has room, in em: narrower than a landmark's 20, to fit a column. */
  const NAME_EM = 14;
  /** Room a wrapped line keeps beyond its measured width, for the browser's own rounding. */
  const WRAP_SLACK_PX = 2;
  /** How long the display must rest after a change before the names are chosen again: the camera's settle. */
  const REST_MS = 250;
  /** How long a dropped name stays to fade out: the names' exit (--popover-exit) and a frame to spare. */
  const LEAVE_MS = 160;
  /** The most a frame spends asking whether the names are still in sight; one is always asked. */
  const LOOK_MS = 1;
  /** A name whose place moves farther than this from one drawing to the next glides there instead. */
  const JUMP_PX = 24;
  /** The glide's time constant: a name is most of the way there after three of these. */
  const GLIDE_MS = 70;
  /** A name whose place moves farther than this, across the anatomy, fades out there and in at its new place. */
  const HOP_PX = 160;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  let names = $state.raw<Named[]>([]);
  /** Names the last choice dropped, fading out where they stood. */
  let leaving = $state.raw<Named[]>([]);
  let group: HTMLElement | undefined = $state();
  const nodes = new Map<string, HTMLElement>();
  /** Counts the names drawn: a new name's attachment runs after the effect that reads the names. */
  let attached = $state(0);
  /** Each name's words as drawn, measured once it is attached and again when its text changes size. */
  const words = new Map<string, Words & { em: number }>();
  let ruler: CanvasRenderingContext2D | null = null;
  /** The column each name stood in last, and the side of its dot it stood on last (`placeLabels`' slot). */
  const sides = new Map<string, Side>();
  const slots = new Map<string, number>();
  /** The columns open at the last drawing (`placeColumns`). */
  let open: Side[] = [];
  /** The camera or the display has moved since the names were last chosen: names keep their columns. */
  let moving = false;
  /** Where each name's box was drawn last, and the names gliding from there to a place they jumped to. */
  const drawnAt = new Map<string, Rect>();
  const gliding = new Set<string>();
  /** Names fading out before they appear at a place far from where they stood: when each began. */
  const hopping = new Map<string, number>();
  let glideFrame = 0;
  let drewAt = 0;
  /** Names whose point the last look found out of sight: they fade until it is back. */
  const unseen = new Set<string>();
  /** Where a moved cut has carried a face's name since it was chosen. */
  const carried = new Map<string, Vec3>();
  /** Counts the stage's moves; each name records the count it was last looked at. */
  let moves = 0;
  const lookedAt = new Map<string, number>();
  let looking = 0;
  let leave: ReturnType<typeof setTimeout> | undefined;
  /** The cut the names were chosen on; null without one. */
  let chosenCut: { normal: Vec3; offset: number; reverse: boolean } | null = null;
  let chrome: ReturnType<typeof watchChrome> | null = null;
  let roving: ReturnType<typeof bindRoving> | null = null;

  const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  function cutNow() {
    const { sections } = engine;
    if (!sections.active) return null;
    const { center, normal } = sections.frame;
    return { normal, offset: dot(center, normal), reverse: sections.state.reverse };
  }

  function choose() {
    moving = false;
    const { model, sections, camera } = engine;
    const scale = camera.view.scale;
    const cosine = sections.active
      ? cutCosine(camera.view.basis.back, sections.frame.normal, sections.state.reverse)
      : 0;
    chosenCut = cutNow();
    replace(
      scale
        ? chooseNames({
            regions: model.regions,
            drawn: [...model.regions.values()].filter(
              (region) =>
                (region.kind === 'cortex' || region.kind === 'structure') &&
                model.canSelect(region),
            ),
            scale: scale.pixels / scale.millimetres,
            selected,
            byLobe: lobes !== null,
            // From the side the cut keeps, the anatomy hides its faces.
            faces: cosine > 0 ? sections.capAnchors() : [],
            faceCosine: cosine,
            bounds: labelBounds(camera.visibleRect),
            kept: kept(),
            words: ({ region, lobe }) => (region ? nameOf(region).name : lobeLabel(lobe!)),
            facingArea: (ids) => model.facingArea(ids),
            facing: (ids) => model.facing(ids),
            project: (points) => camera.project(points),
          })
        : [],
    );
  }

  /** The names shown now for the next choice, each where it stands while that is in sight, looked at now if it was not since the last move. */
  function kept() {
    const stale = names.filter(({ key }) => lookedAt.get(key)! < moves);
    const seen = stale.length
      ? engine.model.inSight(
          stale.map(({ key, on, drawn }) => ({ id: on, point: carried.get(key) ?? drawn })),
        )
      : [];
    stale.forEach(({ key }, index) => {
      if (seen[index]) unseen.delete(key);
      else unseen.add(key);
    });
    return names.map(({ key, on, face, drawn }) => ({
      key,
      on,
      face,
      drawn: unseen.has(key) ? null : (carried.get(key) ?? drawn),
    }));
  }

  /** A new choice, every name of it just found in sight: the names it drops fade out where they stood. */
  function replace(next: Named[]) {
    const keys = new Set(next.map(({ key }) => key));
    leaving = [...leaving, ...names].filter(({ key }) => !keys.has(key));
    names = next;
    unseen.clear();
    carried.clear();
    lookedAt.clear();
    for (const { key } of next) lookedAt.set(key, moves);
    for (const key of slots.keys()) if (!keys.has(key)) slots.delete(key);
    for (const key of sides.keys()) if (!keys.has(key)) sides.delete(key);
    for (const key of drawnAt.keys()) if (!keys.has(key)) drawnAt.delete(key);
    for (const key of hopping.keys()) if (!keys.has(key)) hopping.delete(key);
    clearTimeout(leave);
    if (leaving.length) leave = setTimeout(() => (leaving = []), LEAVE_MS);
  }

  /** Each name's words, measured in the type it is drawn in. */
  function measure() {
    ruler ??= document.createElement('canvas').getContext('2d')!;
    for (const [key, node] of nodes) {
      const text = node.querySelector<HTMLElement>('.stage-label-text')!;
      const style = getComputedStyle(text);
      ruler.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const em = parseFloat(style.fontSize);
      const line = parseFloat(style.lineHeight);
      if (!Number.isFinite(line))
        throw new Error(`A stage name's line height is ${style.lineHeight}.`);
      words.set(key, {
        widths: text
          .textContent!.trim()
          .split(/\s+/)
          .map((word) => ruler!.measureText(word).width),
        space: ruler.measureText(' ').width,
        line,
        em,
      });
    }
  }

  /** A name's box with its words wrapped to lines no wider than `room` allows, nor than its widest line. */
  function sizeOf(key: string, room = Infinity): Size {
    const measured = words.get(key)!;
    const limit = Math.min(room - 2 * PAD_PX - WRAP_SLACK_PX, measured.em * NAME_EM);
    const { width, lines } = wrap(measured, limit);
    return {
      width: Math.ceil(width + WRAP_SLACK_PX + 2 * PAD_PX),
      height: Math.max(TARGET_PX, Math.ceil(lines * measured.line) + 6),
    };
  }

  /**
   * A placement written into its name: the box, the dot on its point, the leader while it stands off,
   * and the column it stands in. Without one the name fades out where it stood, inert meanwhile.
   */
  function draw(
    node: HTMLElement,
    point: ScreenPoint | null,
    placement: { box: Rect; leader: boolean; side?: Side } | null,
  ) {
    node.inert = !placement;
    node.dataset.placed = String(Boolean(placement));
    if (!placement || !point) return;
    const { box, leader, side } = placement;
    if (side) node.dataset.side = side;
    else delete node.dataset.side;
    node.style.transform = `translate(${box.x}px, ${box.y}px)`;
    node.style.width = `${box.width}px`;
    node.style.height = `${box.height}px`;
    // The words wrap where their box was sized for.
    node.querySelector<HTMLElement>('.stage-label-text')!.style.maxWidth =
      `${box.width - 2 * PAD_PX}px`;
    const dot = { x: point.x - box.x, y: point.y - box.y };
    node.querySelector<HTMLElement>('.stage-label-dot')!.style.translate = `${dot.x}px ${dot.y}px`;
    const end = side ? calloutEnd(box, side) : leaderEnd(point, box);
    const length = Math.hypot(end.x - point.x, end.y - point.y);
    node.dataset.leader = String(leader && length > 4);
    if (leader && length > 4) {
      const line = node.querySelector<HTMLElement>('.stage-label-leader')!;
      line.style.width = `${length}px`;
      line.style.transform = `translate(${dot.x}px, ${dot.y}px) rotate(${Math.atan2(end.y - point.y, end.x - point.x)}rad)`;
    }
  }

  /**
   * The box a name is drawn in on its way to `target`: there at once while it moves with the camera, eased
   * there from where it was drawn when its place jumps (a change of column, or of columns for dots), the
   * dot staying on its point. At once under reduced motion.
   */
  function glide(key: string, target: Rect, step: number): Rect {
    const from = drawnAt.get(key);
    const far = from && Math.hypot(target.x - from.x, target.y - from.y);
    if (!from || reducedMotion.matches || (!gliding.has(key) && far! <= JUMP_PX)) {
      gliding.delete(key);
      return target;
    }
    const share = 1 - Math.exp(-step / GLIDE_MS);
    const box = {
      ...target,
      x: from.x + (target.x - from.x) * share,
      y: from.y + (target.y - from.y) * share,
    };
    if (Math.hypot(target.x - box.x, target.y - box.y) < 0.5) {
      gliding.delete(key);
      return target;
    }
    gliding.add(key);
    return box;
  }

  /**
   * Where each name stands as the camera stands now: in a column beside the anatomy, wrapped to fit it,
   * where the stage has room for one; beside its dot, on the side it stood last where that is clear, where
   * it has none. A dot off the stage, under its chrome or out of sight is not named, nor a name no column
   * has room for.
   */
  function place() {
    if (!chrome) return;
    const now = performance.now();
    // A glide's first frame after a rest moves it a frame's way, not the rest's.
    const step = now - drewAt > 100 ? 16 : now - drewAt;
    drewAt = now;
    const bounds = labelBounds(engine.camera.visibleRect);
    const rects = chrome.rects();
    const covered = ({ x, y }: ScreenPoint) =>
      x < bounds.x ||
      y < bounds.y ||
      x > bounds.x + bounds.width ||
      y > bounds.y + bounds.height ||
      rects.some((r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height);
    // A name just chosen is placed once it is drawn and measured.
    const ready = names.filter(({ key }) => nodes.has(key) && words.has(key));
    const points = engine.camera
      .project(ready.map(({ key, drawn }) => carried.get(key) ?? drawn))
      .map((point, index) =>
        point && !covered(point) && !unseen.has(ready[index]!.key) ? point : null,
      );
    const anatomy = engine.camera.anatomyRect();
    const columns =
      anatomy &&
      placeColumns(
        ready.map(({ key }, index) => ({
          point: points[index]!,
          size: (width: number) => sizeOf(key, width),
          side: sides.get(key),
          always: key === selected,
        })),
        anatomy,
        bounds,
        rects,
        open,
        moving,
      );
    open = columns?.open ?? [];
    /** A placement drawn, gliding where its place jumped; none forgets where the name stood. */
    const drawPlaced = (
      key: string,
      point: ScreenPoint | null,
      placement: { box: Rect; leader: boolean; side?: Side } | null,
    ) => {
      if (!placement) {
        drawnAt.delete(key);
        gliding.delete(key);
        hopping.delete(key);
        draw(nodes.get(key)!, point, null);
        return;
      }
      const from = drawnAt.get(key);
      const far = from && Math.hypot(placement.box.x - from.x, placement.box.y - from.y) > HOP_PX;
      if ((far && !reducedMotion.matches) || hopping.has(key)) {
        if (!hopping.has(key)) hopping.set(key, now);
        if (now - hopping.get(key)! < LEAVE_MS) {
          draw(nodes.get(key)!, point, null);
          return;
        }
        // Faded out: it comes in where it now stands, with nothing to glide from.
        hopping.delete(key);
        drawnAt.delete(key);
        gliding.delete(key);
      }
      const box = glide(key, placement.box, step);
      drawnAt.set(key, box);
      draw(nodes.get(key)!, point, { ...placement, box });
    };
    if (columns) {
      ready.forEach(({ key }, index) => {
        const placed = columns.placed[index]!;
        if (placed) sides.set(key, placed.side);
        drawPlaced(key, points[index]!, placed && { ...placed, leader: true });
      });
    } else {
      const beside = placeLabels(
        ready.map(({ key }, index) => ({
          point: points[index]!,
          sizes: [sizeOf(key)],
          optional: true,
          slot: slots.get(key),
        })),
        bounds,
        rects,
      );
      ready.forEach(({ key }, index) => {
        const placement = beside[index]!;
        if (placement) slots.set(key, placement.slot);
        drawPlaced(key, points[index]!, placement);
      });
    }
    if (gliding.size || hopping.size) {
      glideFrame ||= requestAnimationFrame(() => {
        glideFrame = 0;
        place();
      });
    }
    for (const { key } of leaving) {
      const node = nodes.get(key);
      if (node) draw(node, null, null);
    }
    roving?.sync();
  }

  /** The stage moved: look again whether each name's point is in sight, a few a frame. */
  function moved() {
    moves += 1;
    looking ||= requestAnimationFrame(look);
  }

  /** The names looked at longest ago, as many as a frame's budget allows, then again next frame until each is current. */
  function look() {
    looking = 0;
    const due = names
      .filter(({ key }) => lookedAt.get(key)! < moves)
      .sort((a, b) => lookedAt.get(a.key)! - lookedAt.get(b.key)!);
    const start = performance.now();
    let changed = false;
    for (const { key, on, drawn } of due) {
      const [seen] = engine.model.inSight([{ id: on, point: carried.get(key) ?? drawn }]);
      lookedAt.set(key, moves);
      if (seen === unseen.has(key)) {
        changed = true;
        if (seen) unseen.delete(key);
        else unseen.add(key);
      }
      if (performance.now() - start >= LOOK_MS) break;
    }
    if (changed) place();
    if (names.some(({ key }) => lookedAt.get(key)! < moves)) looking = requestAnimationFrame(look);
  }

  /**
   * A cut moved along its normal carries the names on its faces to where the plane now passes, each looked
   * at first; a cut turned, reversed or closed takes them out of sight until the next choice.
   */
  function follow() {
    if (!chosenCut || !names.some(({ face }) => face)) return;
    const now = cutNow();
    const along =
      now !== null &&
      now.reverse === chosenCut.reverse &&
      dot(now.normal, chosenCut.normal) > 1 - 1e-9;
    for (const { key, face, drawn } of names) {
      if (!face) continue;
      if (!along) {
        // Not looked at again: a ray to where the face was can meet the region's own surface.
        unseen.add(key);
        lookedAt.set(key, Infinity);
        continue;
      }
      const from = carried.get(key) ?? drawn;
      const shift = now.offset - dot(from, now.normal);
      if (Math.abs(shift) < 1e-6) continue;
      carried.set(key, [
        from[0] + shift * now.normal[0],
        from[1] + shift * now.normal[1],
        from[2] + shift * now.normal[2],
      ]);
      lookedAt.set(key, -1);
    }
    place();
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
      engine.on('camera', () => {
        moving = true;
        place();
        moved();
      }),
      engine.on('viewport', chrome.stale),
      // An exploded view's pieces arrive after the camera, with no camera event: the names kept are
      // looked at again, not held where the pieces stood in flight.
      engine.on('cameraSettled', () => {
        clearTimeout(rest);
        chrome!.stale();
        moves += 1;
        choose();
      }),
      // A cut dragged or a part hidden: looked at as it happens, chosen once it has rested.
      engine.on('change', () => {
        clearTimeout(rest);
        rest = setTimeout(choose, REST_MS);
        moving = true;
        follow();
        moved();
      }),
    ];
    return () => {
      clearTimeout(rest);
      cancelAnimationFrame(looking);
      cancelAnimationFrame(glideFrame);
      [looking, glideFrame] = [0, 0];
      stops.forEach((stop) => stop());
      chrome!.dispose();
      chrome = null;
    };
  });

  // The switch, the selection and the colour choose at once.
  $effect(() => {
    void [selected, lobes];
    if (!shown) {
      clearTimeout(leave);
      names = [];
      leaving = [];
      slots.clear();
      sides.clear();
      drawnAt.clear();
      gliding.clear();
      hopping.clear();
      open = [];
      return;
    }
    untrack(choose);
  });

  // Drawn names are measured, and measured again when a late webfont or larger text changes them.
  $effect(() => {
    void [attached, names, leaving];
    if (!group) return;
    measure();
    place();
    const observer = new ResizeObserver(() => {
      measure();
      place();
    });
    for (const node of nodes.values()) observer.observe(node.querySelector('.stage-label-text')!);
    return () => observer.disconnect();
  });

  $effect(() => () => clearTimeout(leave));
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
    {#each [...names, ...leaving] as named (named.key)}
      {@const track = (node: HTMLElement) => {
        nodes.set(named.key, node);
        untrack(() => (attached += 1));
        return () => {
          nodes.delete(named.key);
          words.delete(named.key);
        };
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
      transition:
        opacity var(--popover-transition) var(--ease-ui),
        visibility 0s;
    }
    /*
     * Out of sight until placed, so a name first drawn at the corner does not flash there; one that loses
     * its place fades out where it stood.
     */
    .region-name:not([data-placed='true']) {
      opacity: 0;
      visibility: hidden;
      transition:
        opacity var(--popover-exit) var(--ease-ui),
        visibility 0s var(--popover-exit);
    }
    @media (prefers-reduced-motion: reduce) {
      .region-name,
      .region-name:not([data-placed='true']) {
        transition: none;
      }
    }
    /* The left column's names align on the anatomy's side, as its leaders arrive. */
    .region-name[data-side='left'] {
      justify-content: flex-end;
      text-align: right;
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
