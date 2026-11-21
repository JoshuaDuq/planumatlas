<!--
  A native <select> (the platform's own listbox: keyboard, typeahead and mobile pickers come with
  it). Where the browser supports `appearance: base-select` the closed control and the list are
  styled and the chevron is the picker icon; elsewhere the control is drawn with the same chevron
  as two gradient strokes.
-->
<script lang="ts" module>
  export interface SelectOption {
    value: string;
    label: string;
    title?: string;
  }

  export interface SelectOptionGroup {
    label?: string;
    options: readonly SelectOption[];
  }
</script>

<script lang="ts">
  let {
    id,
    label,
    describedby,
    class: className,
    options = [],
    groups,
    hiddenOption,
    value = $bindable(),
    select = $bindable(),
    disabled = false,
    onchange,
    onpointerenter,
    onfocus,
  }: {
    /** Lets a visible `<label for={id}>` name the select and focus it on click. */
    id?: string;
    /** The accessible name; leave it out when a visible `<label for>` names the select. */
    label?: string;
    /** The id of the note that describes the select. */
    describedby?: string;
    class?: string;
    options?: readonly SelectOption[];
    /** Grouped options (`<optgroup>` when `label` is set, plain options otherwise). */
    groups?: readonly SelectOptionGroup[];
    /** A hidden value shown only while externally active (e.g. a tab paint over Colour). */
    hiddenOption?: SelectOption;
    value?: string;
    /** Underlying element reference for focus rescue or imperative synchronization. */
    select?: HTMLSelectElement;
    disabled?: boolean;
    onchange?: (value: string) => void;
    onpointerenter?: () => void;
    onfocus?: () => void;
  } = $props();
</script>

<select
  bind:this={select}
  {id}
  class={className}
  aria-label={label}
  aria-describedby={describedby}
  {disabled}
  bind:value
  onchange={(event) => onchange?.(event.currentTarget.value)}
  {onpointerenter}
  {onfocus}
>
  {#if hiddenOption}
    <option value={hiddenOption.value} hidden>{hiddenOption.label}</option>
  {/if}
  {#if groups}
    {#each groups as group (group.label ?? group.options[0]?.value)}
      {#if group.label}
        <optgroup label={group.label}>
          {#each group.options as option (option.value)}
            <option value={option.value} title={option.title}>{option.label}</option>
          {/each}
        </optgroup>
      {:else}
        {#each group.options as option (option.value)}
          <option value={option.value} title={option.title}>{option.label}</option>
        {/each}
      {/if}
    {/each}
  {:else}
    {#each options as option (option.value)}
      <option value={option.value} title={option.title}>{option.label}</option>
    {/each}
  {/if}
</select>

<style>
  @layer components {
    select {
      /* The caret's ink ends this far inside the control, as far as the value starts from the other edge. */
      --caret-end: var(--space-3);
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: var(--control-height);
      padding: 0 calc(var(--caret-end) + var(--space-5)) 0 var(--space-3);
      border: 1px solid var(--border-control);
      border-radius: var(--radius-control);
      background-color: var(--surface-base);
      color: var(--text-primary);
      box-shadow: none;
      font-size: var(--text-ui);
      line-height: var(--lh-ui);
      cursor: pointer;
      background-image:
        linear-gradient(
          45deg,
          transparent calc(50% - 0.9px),
          var(--text-secondary) calc(50% - 0.9px) calc(50% + 0.6px),
          transparent calc(50% + 0.6px)
        ),
        linear-gradient(
          -45deg,
          transparent calc(50% - 0.9px),
          var(--text-secondary) calc(50% - 0.9px) calc(50% + 0.6px),
          transparent calc(50% + 0.6px)
        );
      background-position:
        calc(100% - var(--caret-end) - 5px) calc(50% + 1px),
        calc(100% - var(--caret-end)) calc(50% + 1px);
      background-size:
        5px 5px,
        5px 5px;
      background-repeat: no-repeat;
    }
    select:disabled {
      color: var(--text-tertiary);
      cursor: default;
      border-color: var(--border-subtle);
      background-color: var(--surface-sunken);
    }
    @supports (appearance: base-select) {
      select,
      select::picker(select) {
        appearance: base-select;
      }
      select {
        align-items: center;
        background-image: none;
        padding-right: var(--space-3);
      }
      select::picker-icon {
        content: '';
        width: 6px;
        height: 6px;
        margin: 0 3px 0 auto;
        border-right: 1.5px solid var(--text-secondary);
        border-bottom: 1.5px solid var(--text-secondary);
        transform: translateY(-2px) rotate(45deg);
        transition: transform var(--ui-transition) var(--ease-ui);
      }
      select:open::picker-icon {
        transform: translateY(2px) rotate(225deg);
      }
      select::picker(select) {
        border: 1px solid var(--border-control);
        border-radius: var(--radius-control);
        background: var(--surface-base);
        padding: var(--space-1);
      }
      optgroup {
        color: var(--text-secondary);
        font-size: var(--text-caption);
      }
      option {
        min-height: var(--control-height);
        padding: 0 var(--space-3);
        color: var(--text-primary);
        font-size: var(--text-ui);
      }
      option:checked {
        background: var(--surface-tonal);
      }
    }
    @media (hover: hover) and (pointer: fine) {
      select:hover:not(:disabled) {
        border-color: var(--text-secondary);
      }
      option:hover {
        background: var(--surface-tonal);
      }
    }
    @media (pointer: coarse), (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      select {
        height: auto;
        min-height: 44px;
        font-size: var(--text-title);
      }
    }
  }
  @layer a11y {
    @media (prefers-reduced-motion: reduce) {
      select::picker-icon {
        transition: none;
      }
    }
    @media (prefers-contrast: more) {
      select:disabled {
        border-color: var(--border-control);
      }
    }
    @media (forced-colors: active) {
      select {
        border-color: CanvasText;
      }
      select:focus-visible {
        outline: 2px solid Highlight;
      }
    }
  }
</style>
