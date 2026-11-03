<script lang="ts">
  import { tractCatalog } from '../../lib/core/diffusion/catalogs.ts';
  import { isIndependentTractReference } from '../../lib/core/diffusion/presentation.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import type { Language } from '../../lib/types/index.ts';
  import Colophon from '../../features/colophon/Colophon.svelte';
  import { displayChanges } from '../../features/colophon/display-state.ts';
  import { regionCountText } from '../../features/colophon/region-count.ts';
  import { getApp } from '../application.svelte.ts';

  let {
    lang,
    choosing,
    onProvenance,
  }: {
    lang: Language;
    /** A data bar field holds a choice still downloading (the masthead region's). */
    choosing: boolean;
    /** The masthead region's `openProvenance`, which owns the dialog. */
    onProvenance: (event: MouseEvent) => void;
  } = $props();

  const world = $derived(getApp().world);

  // The engine is not reactive: its tract events re-read how many bundles are drawn.
  let drawnBundles = $state(0);
  $effect(() => {
    if (!world) return;
    const { engine } = world;
    const read = () => {
      drawnBundles = engine.tracts.snapshot().filter((bundle) => bundle.visible).length;
    };
    const offs = [engine.on('tractsReady', read), engine.on('tractsVisibility', read)];
    read();
    return () => offs.forEach((off) => off());
  });
</script>

{#if world}
  {@const current = world.view.current}
  {@const tractReference = isIndependentTractReference(current)}
  {@const tracts = current.explorer === 'diffusion'}
  <Colophon
    lang={current.lang}
    anatomy={world.engine.model.manifest.anatomy}
    reference={tractReference
      ? { label: tractCatalog(current.referenceAnatomy).name[current.lang] }
      : undefined}
    regionCount={regionCountText(current.lang, {
      tracts: tracts
        ? t(current.lang, 'diffusion').bundlesDrawn(
            drawnBundles,
            tractCatalog(current.referenceAnatomy).bundles.length,
          )
        : null,
      status: current.status,
      progress: current.progress,
      visibleCount: world.catalog.visibleCount,
      choosing,
    })}
    displayChanges={tractReference ? [] : displayChanges(current, world.excursions.displayBaseline)}
    onresetdisplay={world.anatomy.resetDisplay}
    onprovenance={onProvenance}
  />
{:else}
  <!-- Before the engine the bar states what this is and nothing about what is loaded. -->
  <Colophon {lang} regionCount="" />
{/if}
