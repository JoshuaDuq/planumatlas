<!-- Fixture for the CopyValue tests: a value inside a sentence, and the page's announcer. Not shipped. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { attachAnnouncer } from './announcer.svelte.ts';
  import { aroundValue } from './clipboard.svelte.ts';
  import CopyValue from './CopyValue.svelte';

  let { value }: { value: string } = $props();
  let region: HTMLElement;
  onMount(() => attachAnnouncer(region));

  const [before, after] = aroundValue((point) => `Lands at ${point} on this brain`);
</script>

<div bind:this={region} id="announcer" class="visually-hidden"></div>
<p>
  {before}<CopyValue
    {value}
    words={{ copy: 'Copy', copied: 'Copied', failed: 'Could not copy' }}
  /><span class="after">{after}</span>
</p>
