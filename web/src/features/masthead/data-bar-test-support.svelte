<!-- Fixture for the data bar tests: the masthead around it, the live region and the tooltip. Not shipped. -->
<script lang="ts">
  import { onMount, type ComponentProps } from 'svelte';
  import type { ThemeChoice } from '../../lib/state/theme.svelte.ts';
  import type { Language } from '../../lib/types/index.ts';
  import { attachAnnouncer } from '../../lib/ui/announcer.svelte.ts';
  import Tooltip from '../../lib/ui/Tooltip.svelte';
  import DataBar from './DataBar.svelte';
  import Masthead from './Masthead.svelte';

  type Bar = Omit<
    ComponentProps<typeof DataBar>,
    | 'onAtlas'
    | 'onAtlasIntent'
    | 'onSurfaceColor'
    | 'onDetail'
    | 'onAnatomy'
    | 'onBorders'
    | 'onPanel'
    | 'settingsOpen'
  >;

  let {
    bar,
    calls = [],
    onCommand,
    panels = [],
  }: {
    bar: Bar;
    calls?: string[];
    onCommand?: (command: string) => unknown;
    /** Each right edge the open popover reported, and whether a key moved it. */
    panels?: [number | null, boolean][];
  } = $props();
  // What the command returns is what the bar waits on, as it waits on the app's own commands.
  const command = (name: string) => {
    calls.push(name);
    return onCommand?.(name);
  };

  let themeChoice = $state<ThemeChoice>('system');
  let singleKeys = $state(true);
  let settingsOpen = $state(false);
  let region: HTMLElement;

  onMount(() => attachAnnouncer(region));
  $effect(() => {
    document.documentElement.lang = bar.lang;
  });
</script>

<div
  bind:this={region}
  role="status"
  aria-live="polite"
  class="visually-hidden"
  id="announcer"
></div>
<Tooltip />
<Masthead
  lang={bar.lang}
  {themeChoice}
  {singleKeys}
  ready
  fullscreen={false}
  provenanceReady
  bind:settingsOpen
  onSkipToModel={() => {}}
  onLanguage={(next: Language) => calls.push(`lang:${next}`)}
  onTheme={(next) => (themeChoice = next)}
  onSingleKeys={(on) => (singleKeys = on)}
  onFullscreen={() => {}}
  onSnapshot={() => {}}
  currentLink={() => location.href}
  currentEmbedCode={() => ''}
  onProvenance={() => {}}
  onFeedback={() => {}}
  onGuide={() => {}}
  onShortcuts={() => {}}
  onStartOver={() => {}}
>
  {#snippet data()}
    <DataBar
      {...bar}
      bind:settingsOpen
      onAtlas={(id) => command(`atlas:${id}`)}
      onAtlasIntent={() => calls.push('atlas-intent')}
      onSurfaceColor={(colour) => command(`colour:${colour}`)}
      onDetail={(id) => command(`detail:${id}`)}
      onAnatomy={(id) => command(`anatomy:${id}`)}
      onBorders={(atlas) => command(`borders:${atlas}`)}
      onPanel={(right, immediate) => panels.push([right, immediate])}
    />
  {/snippet}
</Masthead>
<main id="viewport" tabindex="-1"><button type="button">Canvas</button></main>

<style>
  @layer components {
    :global(body) {
      background: var(--surface-base);
      color: var(--text-primary);
    }
    main button {
      min-height: 32px;
      border: 1px solid var(--border-control);
      background: var(--surface-tonal);
      color: var(--text-primary);
    }
  }
</style>
