<!--
  "Show all N": the quiet text command under a list that shows its first rows (DESIGN.md, Buttons).
  The caller unfolds the list and moves focus to the first row it adds, since the command leaves.
-->
<script lang="ts">
  let {
    label,
    onclick,
    inset = true,
  }: {
    label: string;
    onclick: () => void;
    /** Under a list whose rows run edge to edge on the panel inset; false on a text column already inset. */
    inset?: boolean;
  } = $props();
</script>

<button type="button" class="show-all" data-inset={inset} {onclick}>{label}</button>

<style>
  @layer components {
    /* Its words start on the rows' column; its ground reaches 8px past them, as the tree's command does. */
    .show-all {
      display: block;
      height: auto;
      min-height: var(--control-height);
      margin: var(--space-1) var(--panel-inset) 0 calc(var(--panel-inset) - var(--space-2));
      padding: 0 var(--space-2);
      border-radius: var(--radius-control);
      background: none;
      color: var(--text-secondary);
      font-size: var(--text-caption);
      font-weight: 400;
      line-height: var(--lh-caption);
      font-variant-numeric: tabular-nums;
      text-align: left;
      transition: background-color var(--ui-transition) var(--ease-ui);
    }
    .show-all[data-inset='false'] {
      margin-inline: calc(-1 * var(--space-2)) 0;
    }
    @media (hover: hover) and (pointer: fine) {
      .show-all:hover {
        background: var(--surface-hover);
        color: var(--text-primary);
      }
    }
    .show-all:active:not(:focus-visible) {
      background: var(--surface-pressed);
      color: var(--text-primary);
      transition-duration: 0s;
    }
  }
</style>
