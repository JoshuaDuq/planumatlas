<!-- Fixture for the Functions tests: the list, the profile and Restore as I1 composes them, with the live region and the region inspector's title that the panel hands focus to. Not shipped. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { attachAnnouncer } from '../../lib/ui/announcer.svelte.ts';
  import { FOCUS_TARGETS, registerFocusTarget } from '../../lib/ui/focus.ts';
  import FunctionList from './FunctionList.svelte';
  import FunctionProfile from './FunctionProfile.svelte';
  import FunctionRestore from './FunctionRestore.svelte';
  import type { World } from './functions-test-world.ts';

  let { world }: { world: World } = $props();

  let announcer: HTMLElement;
  let regionTitle: HTMLElement;
  onMount(() => attachAnnouncer(announcer));
  $effect(() => registerFocusTarget(FOCUS_TARGETS.regionTitle, () => regionTitle));
</script>

<div
  bind:this={announcer}
  role="status"
  aria-live="polite"
  class="visually-hidden"
  id="announcer"
></div>
<div class="bar"><FunctionRestore model={world.explorer} /></div>
<!-- The tabs beyond Deficits are the workspace's (ListView), tested with the whole panel. -->
<div class="list">
  <FunctionList
    model={world.explorer}
    elsewhere={(query) => {
      const count = query ? world.excursions.deficitsMatching(query, world.explorer.lang) : 0;
      return count ? [{ mode: 'deficits', count }] : [];
    }}
    onElsewhere={(_mode, query) => world.excursions.searchIn('deficits', query)}
  />
</div>
<div class="detail">
  <FunctionProfile model={world.explorer} />
  <h2 bind:this={regionTitle} tabindex="-1" id="selected-name">Region</h2>
</div>

<style>
  @layer features {
    .bar {
      display: flex;
      height: var(--tab-height);
    }
  }
</style>
