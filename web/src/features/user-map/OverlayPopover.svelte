<!--
  The Overlay popover's body: the reader's own NIfTI maps, read on their machine and carried onto this
  brain by the template's registration. The template is chosen as the Coordinate tool's is. With two
  maps, a choice names the one shown below it; the map added last is drawn on top.
-->
<script lang="ts">
  import { tick } from 'svelte';
  import { UNSTATED } from '../../lib/core/coordinates/spaces.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import { mapFileReason } from '../../lib/core/user-map/map-file-error.ts';
  import type { UserMapStore } from '../../lib/state/user-map.svelte.ts';
  import type { CoordinateSpaces, Language } from '../../lib/types/index.ts';
  import ChoiceGroup from '../../lib/ui/ChoiceGroup.svelte';
  import Select from '../../lib/ui/Select.svelte';
  import MethodsLink from '../info/MethodsLink.svelte';
  import OverlayMap from './OverlayMap.svelte';

  let {
    map,
    spaces,
    lang,
    onPlace,
  }: {
    map: UserMapStore;
    spaces: CoordinateSpaces;
    lang: Language;
    /** Place a peak (template mm in `space`) as a published coordinate and show its report. */
    onPlace: (mm: [number, number, number], space: string) => void;
  } = $props();

  const uid = $props.id();
  const spaceId = `overlay-space-${uid}`;

  const copy = $derived(t(lang, 'overlay'));
  const options = $derived([
    ...spaces.spaces.map(({ id, label, description }) => ({
      value: id,
      label,
      title: description,
    })),
    { value: UNSTATED, label: t(lang, 'coordinate').unstated },
  ]);

  // The map shown below the choice: the one picked, else the one on top, else the first slot.
  let picked = $state<number | null>(null);
  const layer = $derived.by(() => {
    const listed = map.listed;
    return listed.find((entry) => entry.slot === picked) ?? listed[0] ?? map.maps[0]!;
  });
  const current = $derived(layer.state);
  // In slot order, so a choice keeps its place when the other map is drawn on top.
  const choices = $derived(
    map.maps
      .filter(({ state }) => state.status !== 'empty')
      .map(({ slot, state, title }) => ({
        value: String(slot),
        label: state.status === 'ready' ? title : state.status === 'empty' ? '' : state.name,
      })),
  );

  let input: HTMLInputElement;
  let chooseButton: HTMLButtonElement;
  // The file input reads into the map shown, or into a new slot on top.
  let adding = false;
  // The slot a file was last read into: its threshold field takes focus once it is ready.
  let readInto = $state<number | null>(null);

  function choose(add: boolean) {
    adding = add;
    input.click();
  }

  function read(file: File) {
    if (adding && map.free !== null) {
      picked = readInto = map.free;
      void map.add(file);
    } else {
      readInto = layer.slot;
      void layer.open(file);
    }
  }

  /** The button goes with the map, so focus moves to the one that chooses another. */
  async function remove(event: MouseEvent) {
    const hadFocus = document.activeElement === event.currentTarget;
    layer.remove();
    picked = null;
    await tick();
    if (hadFocus) chooseButton.focus();
  }
</script>

<div class="overlay" aria-busy={current.status === 'loading'}>
  {#if choices.length > 1}
    <ChoiceGroup
      class="map-choice stage-tabs"
      label={copy.maps}
      options={choices}
      bind:value={
        () => String(layer.slot),
        (slot) => {
          picked = Number(slot);
          readInto = null;
        }
      }
    />
  {/if}
  {#if current.status === 'ready'}
    {#key layer.slot}
      <OverlayMap
        {layer}
        ready={current}
        {map}
        {spaces}
        {lang}
        {onPlace}
        askThreshold={readInto === layer.slot}
      />
    {/key}
    <p class="hint">{copy.caveat}</p>
    {#if choices.length > 1}<p class="hint">{copy.hues}</p>{/if}
  {:else}
    {#if choices.length < 2}<p class="hint intro">{copy.intro}</p>{/if}
    <div class="stage-field">
      <label class="stage-field-label" for={spaceId}>{copy.space}</label>
      <Select
        id={spaceId}
        {options}
        bind:value={() => layer.space, (space) => void layer.setSpace(space)}
        disabled={current.status === 'loading'}
      />
    </div>
  {/if}
  {#if current.status === 'loading'}
    <p class="hint" role="status">{copy.reading(current.name)}</p>
  {:else if current.status === 'error'}
    <p class="error" role="alert">
      {copy.failed(current.name)}
      {mapFileReason(copy, t(lang, 'errors'), current.error)}
    </p>
  {/if}
  <input
    bind:this={input}
    class="visually-hidden"
    type="file"
    accept=".nii,.nii.gz,.gz"
    tabindex="-1"
    aria-hidden="true"
    onchange={(event) => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = '';
      if (file) read(file);
    }}
  />
  <div class="actions">
    <button
      bind:this={chooseButton}
      type="button"
      class="stage-command"
      disabled={current.status === 'loading'}
      onclick={() => choose(false)}
    >
      {current.status === 'ready' ? copy.another : copy.choose}
    </button>
    {#if current.status === 'ready' && map.free !== null}
      <button type="button" class="stage-command stage-command-quiet" onclick={() => choose(true)}>
        {copy.add}
      </button>
    {/if}
    {#if current.status === 'ready' || (current.status === 'error' && map.listed.length > 1)}
      <button type="button" class="stage-command stage-command-quiet" onclick={remove}>
        {copy.remove}
      </button>
    {/if}
  </div>
  <p class="stage-methods"><MethodsLink page="overlay" {lang} /></p>
</div>

<style>
  @layer features {
    .hint,
    .error {
      margin: var(--space-2) 0 0;
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      color: var(--overlay-ink-muted);
    }
    .intro {
      margin-top: 0;
    }
    /* As Add's own choice, in 13px; a map apiece, a long title cut short rather than run over. */
    .overlay :global(.map-choice) {
      display: flex;
      width: 100%;
      margin-bottom: var(--space-3);
    }
    .overlay :global(.map-choice [role='radio']) {
      flex: 1 1 0;
      min-width: 0;
      overflow: hidden;
      padding-inline: 6px;
      font-size: var(--text-caption);
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .error {
      color: var(--danger);
      overflow-wrap: anywhere;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: var(--space-2);
      margin-top: var(--space-3);
      padding-top: var(--space-3);
      border-top: 1px solid var(--overlay-border);
    }
  }
</style>
