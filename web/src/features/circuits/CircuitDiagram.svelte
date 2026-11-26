<!--
  A circuit's flat diagram (data/circuits.yaml `diagram`): its landmarks as numbered boxes on a grid and
  the sign of each projection between them. Connected landmarks sit in neighbouring cells (CAT-70), so
  each connection is one straight segment in the track between two boxes. Sign is told three ways: the
  end mark (an arrowhead excites, a bar inhibits), a + or − beside the line, and colour; the projections
  are also read out as a list of sentences. A box carries its landmark's number from the sequence and
  opens it, staying where it stands (CIRC-30); its tooltip gives the landmark's full name.
-->
<script lang="ts">
  import { tick } from 'svelte';
  import { t } from '../../lib/core/i18n/index.ts';
  import type { Circuit } from '../../lib/core/learning/catalog.ts';
  import type { Language } from '../../lib/types/index.ts';

  let {
    circuit,
    lang,
    current,
    busy,
    onopen,
  }: {
    circuit: Circuit;
    lang: Language;
    /** The open landmark's index, or null on the whole route. */
    current: number | null;
    busy: boolean;
    /** Opens a landmark, leaving the panel's place and focus to the box; false when it did not open. */
    onopen: (index: number) => Promise<boolean>;
  } = $props();

  /**
   * A pressed box stays where it stood and keeps focus, though what is above it changes height and the
   * notes may be drawn again for the new landmark: then the box under the same id takes its place.
   */
  async function open(index: number, pressed: HTMLElement) {
    const top = pressed.getBoundingClientRect().top;
    if (!(await onopen(index))) return;
    await tick();
    const box = pressed.isConnected ? pressed : document.getElementById(pressed.id);
    if (!box) return;
    let shift = box.getBoundingClientRect().top - top;
    for (let parent = box.parentElement; parent && shift; parent = parent.parentElement) {
      if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) {
        const before = parent.scrollTop;
        parent.scrollTop += shift;
        shift -= parent.scrollTop - before;
      }
    }
    box.focus({ preventScroll: true });
  }

  const SIGN_MARK = { excitatory: '+', inhibitory: '−' } as const;

  const uid = $props.id();
  const copy = $derived(t(lang, 'circuits'));
  const diagram = $derived(circuit.diagram!);
  const nodes = $derived(
    diagram.nodes.map((node) => ({
      ...node,
      index: circuit.steps.findIndex((step) => step.id === node.step),
    })),
  );
  const edges = $derived.by(() => {
    const cells = new Map(diagram.nodes.map((node) => [node.step, node]));
    return diagram.edges.map((edge) => {
      const from = cells.get(edge.from)!;
      const to = cells.get(edge.to)!;
      const vertical = from.column === to.column;
      return {
        ...edge,
        direction: vertical
          ? to.row > from.row
            ? 'down'
            : 'up'
          : to.column > from.column
            ? 'right'
            : 'left',
        // Boxes take the odd tracks; a connection takes the even track between its two boxes.
        column: vertical ? 2 * from.column - 1 : 2 * Math.min(from.column, to.column),
        row: vertical ? 2 * Math.min(from.row, to.row) : 2 * from.row - 1,
        text: copy.projection[edge.sign](from.label[lang], to.label[lang]),
      };
    });
  });
  // Equal tracks no narrower than their longest word: every box is one size and no word is split.
  const tracks = (count: number) =>
    Array.from({ length: count }, () => 'minmax(min-content, 1fr)').join(' var(--edge-track) ');
  const columns = $derived(Math.max(...diagram.nodes.map((node) => node.column)));
  const rows = $derived(Math.max(...diagram.nodes.map((node) => node.row)));
</script>

{#snippet end(sign: string)}
  <svg class="edge-end" viewBox="0 0 12 12" aria-hidden="true">
    {#if sign === 'excitatory'}
      <path d="M1 1.5H11L6 11Z" />
    {:else}
      <path d="M5 0H7V7.5H12V10.5H0V7.5H5Z" />
    {/if}
  </svg>
{/snippet}

<figure class="signs" aria-labelledby="{uid}-signs">
  <h3 id="{uid}-signs" class="signs-heading">{copy.signs}</h3>
  <div
    class="grid"
    style:grid-template-columns={tracks(columns)}
    style:grid-template-rows={tracks(rows)}
  >
    {#each nodes as node (node.step)}
      <button
        type="button"
        id="circuit-box-{node.step}"
        class="node"
        style:grid-column={2 * node.column - 1}
        style:grid-row={2 * node.row - 1}
        data-selected={String(node.index === current)}
        data-tooltip={circuit.steps[node.index]!.name[lang]}
        aria-current={node.index === current ? 'step' : undefined}
        aria-disabled={busy ? 'true' : undefined}
        onclick={(event) => open(node.index, event.currentTarget)}
      >
        <span class="node-number">{node.index + 1}</span>
        <span class="node-name">{node.label[lang]}</span>
      </button>
    {/each}
    {#each edges as edge (`${edge.from}-${edge.to}`)}
      <span
        class="edge"
        data-sign={edge.sign}
        data-direction={edge.direction}
        style:grid-column={edge.column}
        style:grid-row={edge.row}
        aria-hidden="true"
      >
        <span class="edge-line"></span>{@render end(edge.sign)}
        <span class="edge-sign">{SIGN_MARK[edge.sign]}</span>
      </span>
    {/each}
  </div>
  <ul class="visually-hidden">
    {#each edges as edge (`${edge.from}-${edge.to}`)}
      <li>{edge.text}</li>
    {/each}
  </ul>
  <ul class="legend" aria-hidden="true">
    {#each ['excitatory', 'inhibitory'] as const as sign (sign)}
      <li>
        <span class="edge" data-sign={sign} data-direction="right">
          <span class="edge-line"></span>{@render end(sign)}
        </span>
        <span class="legend-sign" data-sign={sign}>{SIGN_MARK[sign]}</span>
        {copy.sign[sign]}
      </li>
    {/each}
  </ul>
  <p class="signs-note">{copy.signsNote}</p>
</figure>

<style>
  @layer features {
    .signs {
      --edge-track: max(32px, 2rem);
      margin: 0;
      padding-inline: var(--panel-inset);
    }
    .signs-heading {
      padding-block: var(--space-5) var(--space-3);
      font-size: var(--text-ui);
      font-weight: 600;
      line-height: var(--lh-ui);
    }
    .grid {
      display: grid;
    }
    /* A box reads as its row in the sequence: the same ringed number, then the name. */
    .node {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-height: max(40px, 2.5rem);
      height: auto;
      margin: 0;
      padding: var(--space-1) var(--space-2);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-control);
      background: var(--surface-tonal);
      color: var(--text-primary);
      font-size: var(--text-ui);
      font-weight: 500;
      line-height: var(--lh-ui);
      text-align: left;
      white-space: normal;
      cursor: pointer;
    }
    .node[data-selected='true'] {
      border-color: var(--accent);
      background: var(--accent-wash);
      color: var(--accent);
      font-weight: 600;
    }
    .node[aria-disabled='true'] {
      cursor: default;
    }
    .node-number {
      flex: none;
      display: grid;
      place-content: center;
      width: max(20px, 1.25rem);
      height: max(20px, 1.25rem);
      border: 1px solid var(--border-control);
      border-radius: 50%;
      color: var(--text-secondary);
      font-size: var(--text-caption);
      font-weight: 500;
      line-height: var(--lh-caption);
      font-variant-numeric: tabular-nums;
    }
    .node[data-selected='true'] .node-number {
      border-color: currentColor;
      color: inherit;
      font-weight: 600;
    }
    .node-name {
      overflow-wrap: break-word;
      text-wrap: balance;
    }
    /* A connection: a line through its track, ended at the target by an arrowhead or a bar. */
    .edge {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 3px;
      color: var(--sign-excitatory);
    }
    .edge[data-sign='inhibitory'] {
      color: var(--sign-inhibitory);
    }
    .edge[data-direction='down'] {
      flex-direction: column;
    }
    .edge[data-direction='up'] {
      flex-direction: column-reverse;
    }
    .edge[data-direction='left'] {
      flex-direction: row-reverse;
    }
    /* Borders, not a background: forced colours keep them. */
    .edge-line {
      flex: 1;
      border: 0 solid currentColor;
      border-left-width: 2px;
    }
    .edge:is([data-direction='left'], [data-direction='right']) .edge-line {
      border-left-width: 0;
      border-top-width: 2px;
    }
    .edge-end {
      flex: none;
      width: 12px;
      height: 12px;
      fill: currentColor;
    }
    .edge[data-direction='up'] .edge-end {
      rotate: 180deg;
    }
    .edge[data-direction='right'] .edge-end {
      rotate: -90deg;
    }
    .edge[data-direction='left'] .edge-end {
      rotate: 90deg;
    }
    /* The sign stands beside a vertical line and above a horizontal one, clear of the end mark. */
    .edge-sign,
    .legend-sign {
      font-size: var(--text-ui);
      font-weight: 700;
      line-height: var(--lh-ui);
    }
    .edge-sign {
      position: absolute;
      top: 50%;
      left: calc(50% + 10px);
      translate: 0 -50%;
    }
    .edge:is([data-direction='left'], [data-direction='right']) .edge-sign {
      top: auto;
      bottom: calc(50% + 6px);
      left: 50%;
      translate: -50% 0;
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1) var(--space-5);
      margin: var(--space-4) 0 0;
      padding: 0;
      list-style: none;
      color: var(--text-secondary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
    .legend li {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    .legend .edge {
      width: var(--edge-track);
      padding: 0;
    }
    .legend-sign {
      color: var(--sign-excitatory);
    }
    .legend-sign[data-sign='inhibitory'] {
      color: var(--sign-inhibitory);
    }
    .signs-note {
      margin-top: var(--space-2);
      color: var(--text-secondary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
    @media (hover: hover) and (pointer: fine) {
      .node:hover:not([data-selected='true'], [aria-disabled='true']) {
        background: var(--surface-tonal-hover);
      }
    }
    @media (pointer: coarse) {
      .node {
        min-height: 44px;
      }
    }
  }
  @layer a11y {
    @media (forced-colors: active) {
      .node {
        border-color: ButtonText;
      }
      .node-number {
        border-color: currentColor;
      }
      .node[data-selected='true'] {
        outline: 2px solid Highlight;
        outline-offset: -2px;
      }
    }
  }
</style>
