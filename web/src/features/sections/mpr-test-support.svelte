<!-- Fixture for the Linked MRI tests: the app's grid (layout.css) with a panel, the stage and a footer around it, an opener that loads the scan then shows the MRI (S3's openLinkedMri), and a fallback stop. Not shipped. -->
<script lang="ts">
  import type { FakeEngine } from '../../lib/engine/fake.ts';
  import type { EngineSync } from '../../lib/state/engine-sync.svelte.ts';
  import type { Language, ManifestAnatomy } from '../../lib/types/index.ts';
  import '../../styles/index.css';
  import '../../app/layout.css';
  import { isKeyboardActivation } from '../../lib/ui/instant.ts';
  import MprDialog from './MprDialog.svelte';
  import type { MprDialogController } from './mpr-dialog.svelte.ts';

  let {
    engine,
    engineState,
    mpr,
    live,
    anatomy,
    agreementName = null,
    regionName = (id: string) => `name of ${id}`,
    tracts = null,
  }: {
    engine: FakeEngine;
    engineState: EngineSync;
    mpr: MprDialogController;
    /** Reactive, so a test can change the language. */
    live: { lang: Language };
    anatomy: Pick<ManifestAnatomy, 'subject' | 'individual'>;
    agreementName?: string | null;
    regionName?: (id: string) => string;
    tracts?: { key: string } | null;
  } = $props();

  let more: HTMLButtonElement;
  let view: MprDialog;

  /** The keymap's `mprOpen` question. */
  export const holdsKeys = () => view.holdsKeys();
</script>

<div id="app">
  <header>
    <button
      type="button"
      onclick={async (event) => {
        const instant = isKeyboardActivation(event);
        await engine.sections.load();
        mpr.show({ instant });
      }}>Linked MRI</button
    >
  </header>
  <div id="workspace-panel">
    <button type="button" bind:this={more}>More</button>
  </div>
  <main id="viewport">
    <button
      type="button"
      onclick={() => void document.getElementById('viewport')!.requestFullscreen()}
      >Full screen</button
    >
  </main>
  <MprDialog
    bind:this={view}
    {mpr}
    {engine}
    {engineState}
    lang={live.lang}
    {anatomy}
    {agreementName}
    {regionName}
    {tracts}
    fallbackFocus={() => more}
  />
  <footer></footer>
</div>

<style>
  @layer features {
    /* The fixture's own stand-ins, legible in both themes. */
    button {
      background: var(--surface-base);
      color: var(--text-primary);
      min-height: 24px;
    }
  }
</style>
