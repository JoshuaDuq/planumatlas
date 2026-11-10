<!--
  The workspace's list view (index.html:227-322): each mode's list, one always-mounted instance each,
  the one not in front hidden (decision 0007). Anatomy is the tree with the system picker and the
  dissection bar at its foot; the other lists scroll under their own search. Each search also offers
  the other tabs that find the same words, and carries the words to the one chosen (U1).
-->
<script lang="ts">
  import { flushSync } from 'svelte';
  import type { App, World } from '../../app/application.svelte.ts';
  import { tractCatalog } from '../../lib/core/diffusion/catalogs.ts';
  import { circuitsMatching, elsewhere } from '../../lib/core/elsewhere.ts';
  import { tractRows, tractsMatching } from '../../lib/core/tracts.ts';
  import { sharedGroupNames } from '../../lib/core/panels/navigator.ts';
  import { atlasSwitchLabel } from '../../lib/core/i18n/index.ts';
  import { isKeyboardActivation } from '../../lib/ui/instant.ts';
  import { insideInternal } from '../../lib/core/state/internal-mode.ts';
  import type { Explorer } from '../../lib/types/index.ts';
  import AnatomyExplorer from '../anatomy/AnatomyExplorer.svelte';
  import DissectionBar from '../anatomy/DissectionBar.svelte';
  import SystemPicker from '../anatomy/SystemPicker.svelte';
  import CircuitList from '../circuits/CircuitList.svelte';
  import type { CircuitExplorer } from '../circuits/circuits-explorer.svelte.ts';
  import DeficitList from '../deficits/DeficitList.svelte';
  import type { DeficitsExplorer } from '../deficits/explorer.svelte.ts';
  import FunctionList from '../functions/FunctionList.svelte';
  import type { FunctionExplorer } from '../functions/functions-explorer.svelte.ts';
  import TractsExplorer from '../tracts/TractsExplorer.svelte';

  let {
    app,
    world,
    functions,
    deficits,
    circuits,
  }: {
    app: App;
    world: World;
    functions: FunctionExplorer;
    deficits: DeficitsExplorer;
    circuits: CircuitExplorer;
  } = $props();

  const { engine, session, view, catalog, regions, anatomy, excursions, speech } = $derived(world);
  const current = $derived(view.current);
  const manifest = $derived(engine.model.manifest);
  const bundles = $derived(tractRows(tractCatalog(current.anatomy).bundles));
  // The tree takes a set of its own: the session's is read-only.
  const expanded = $derived(new Set(session.state.expanded));

  let tree = $state<AnatomyExplorer>();
  let tracts = $state<TractsExplorer>();

  /** An eye press: the part it hid or showed is said with the count it changes (decision 36, K3). */
  function eye(change: (ids: readonly string[]) => void) {
    return (ids: readonly string[], said?: string) => {
      if (said === undefined) throw new Error('An eye press says which part it changed.');
      change(ids);
      speech.part(said);
    };
  }

  /**
   * The navigator's "switch cut atlas" (app.js:564). The cut panel reports a failure of the atlas it
   * still shows; one overtaken by closing the cut is reported nowhere else, so it is reported here.
   */
  async function chooseCutAtlas(id: string) {
    try {
      await excursions.setCutAtlas(id);
      world.commands.succeeded('layer', atlasSwitchLabel(id, current.lang));
    } catch (error) {
      world.commands.fail(
        'layer',
        error,
        atlasSwitchLabel(id, current.lang),
        () => void chooseCutAtlas(id),
      );
    }
  }

  /** What the other tabs find for the words searched in `from`, counted as each would list them. */
  function othersOf(from: Explorer) {
    return (query: string) => {
      const words = query.trim();
      if (!words) return [];
      const { lang } = current;
      return elsewhere(from, {
        // The regions named, not the on-screen regions a hidden match is drawn within.
        anatomy: () =>
          regions.search(words, current, Infinity).rows.filter((row) => !row.via).length,
        functions: () => excursions.functionsMatching(words, lang),
        deficits: () => excursions.deficitsMatching(words, lang),
        circuits: () => circuitsMatching(world.circuits.all, words, lang).length,
        diffusion: () =>
          tractsMatching(bundles, words, lang).reduce((sum, row) => sum + row.members.length, 0),
      });
    };
  }

  /**
   * Carries the words to another tab and puts focus in its search. Circuits has no search: the one
   * circuit they name opens, and several leave its list in front.
   */
  async function carry(mode: Explorer, query: string) {
    const words = query.trim();
    if (mode === 'functions' || mode === 'deficits') {
      await excursions.searchIn(mode, words);
    } else {
      if (mode === 'anatomy') session.setQuery(words);
      if (mode === 'diffusion') tracts!.search(words);
      await excursions.chooseMode(mode);
    }
    // A later tab choice overtook this one.
    if (view.current.explorer !== mode) return;
    const named =
      mode === 'circuits' ? circuitsMatching(world.circuits.all, words, current.lang) : [];
    if (named.length === 1) {
      await circuits.openCircuit(named[0]!.id);
      return;
    }
    // The list was hidden a moment ago: its field is focusable once the page shows it.
    flushSync();
    focusSearch(mode);
  }

  /** The `/` key: the search of the list in front, or its first row where it has none. */
  export function focusSearch(mode: Explorer) {
    if (mode === 'functions') functions.focusSearch();
    else if (mode === 'deficits') deficits.focusSearch();
    else if (mode === 'circuits') circuits.focusFirst();
    else if (mode === 'diffusion') tracts!.focusSearch();
    else tree!.focusSearch();
  }

  /** Draw a link's tract bundles on the Tracts tab. */
  export function showTracts(ids: readonly string[]) {
    return tracts!.showTracts(ids);
  }

  /** Up and Down from outside the tree walk its rows. */
  export function walkTree(step: 1 | -1) {
    tree!.moveFocus(step);
  }
</script>

<div class="mode" hidden={current.explorer !== 'anatomy'}>
  <AnatomyExplorer
    bind:this={tree}
    lang={current.lang}
    bind:query={() => current.query, (query) => session.setQuery(query)}
    search={(query) => regions.search(query, current)}
    groups={catalog.groups}
    hiddenRegions={current.hiddenRegions}
    {expanded}
    onExpandedChange={(expanded) => session.setExpanded(expanded)}
    selectedId={current.selectedRegion?.id ?? null}
    atlases={manifest.atlases}
    atlas={current.atlas}
    cutAtlases={manifest.cut_atlases ?? []}
    cutAtlas={current.cutAtlas ?? ''}
    inside={insideInternal(current)}
    switching={current.status === 'switching'}
    onScope={() => void anatomy.toggleInternalAnatomy()}
    onSelect={(id) => anatomy.selectRegion(id, { frame: true })}
    onReveal={(reason, id) => void anatomy.revealRegion(reason, id)}
    onHide={eye(anatomy.hideRegions)}
    onShow={eye(anatomy.showRegions)}
    onAtlas={(id) => excursions.chooseAtlas(id)}
    onCutAtlas={chooseCutAtlas}
    elsewhere={othersOf('anatomy')}
    onElsewhere={(mode) => carry(mode, current.query)}
  >
    {#snippet systemPicker()}
      <SystemPicker
        lang={current.lang}
        detail={current.detail}
        regions={manifest.regions}
        shared={sharedGroupNames(regions.groups({ ...current, internalSystem: null }))}
        value={current.internalSystem}
        switching={current.status === 'switching'}
        onChoose={anatomy.chooseInternalSystem}
      />
    {/snippet}
  </AnatomyExplorer>
  <DissectionBar
    lang={current.lang}
    hiddenCount={current.hiddenRegions.size}
    canUndo={current.dissectionCanUndo}
    onUndo={anatomy.undoDissection}
    onRestore={anatomy.restoreHiddenRegions}
  />
</div>

<div class="mode functions" hidden={current.explorer !== 'functions'}>
  <FunctionList
    model={functions}
    elsewhere={othersOf('functions')}
    onElsewhere={(mode, query) => carry(mode, query)}
  />
</div>

<div class="mode deficits" hidden={current.explorer !== 'deficits'}>
  <DeficitList
    explorer={deficits}
    view={current}
    showShortcut={app.keyPreference.enabled}
    elsewhere={othersOf('deficits')}
    onElsewhere={(mode, query) => carry(mode, query)}
  />
</div>

<div class="mode circuits" hidden={current.explorer !== 'circuits'}>
  <CircuitList model={circuits} />
</div>

<div class="mode" hidden={current.explorer !== 'diffusion'}>
  <TractsExplorer
    bind:this={tracts}
    {engine}
    anatomy={current.anatomy}
    lang={current.lang}
    active={current.explorer === 'diffusion'}
    cortexOpacity={current.cortexOpacity}
    onCortexOpacity={anatomy.setCortexOpacity}
    bind:minimum={app.tractsMinimum}
    onOpenMri={(event) => app.ports.openDiffusionMri({ instant: isKeyboardActivation(event) })}
    elsewhere={othersOf('diffusion')}
    onElsewhere={(mode, query) => carry(mode, query)}
  />
</div>

<style>
  @layer features {
    /* Each list fills the panel under the tabs; its head stays put and its body scrolls. */
    .mode {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 0;
    }
    /* The scrolling bodies of the lists that have no scroller of their own (layout.css:140-149). */
    .functions > :global(.browser),
    .deficits > :global(.deficit-body),
    .circuits > :global(.browser) {
      /* Keep absolutely positioned accessibility text inside its scrolling panel. */
      position: relative;
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
      /* A classic scrollbar arriving with a little overflow would narrow every row; the gutter is held instead. */
      scrollbar-gutter: stable;
    }
    .deficits > :global(.deficit-head) {
      flex: none;
    }
    .functions > :global(.head) {
      flex: none;
    }
    /* A head draws the rule under its search once its list has scrolled 8px (elements.css). */
    @supports (animation-timeline: scroll()) {
      .functions,
      .deficits {
        timeline-scope: --list-scroll;
      }
      .functions > :global(.browser),
      .deficits > :global(.deficit-body) {
        scroll-timeline: --list-scroll block;
      }
      .functions > :global(.head),
      .deficits > :global(.deficit-head) {
        border-bottom-color: transparent;
        animation: scroll-rule linear both;
        animation-timeline: --list-scroll;
        animation-range: 0 8px;
      }
    }

    /* The phone sheet: H6's #navigator carries the home-indicator padding, so there is one rule (phone.css:226-231). */
    @media (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      .functions > :global(.browser),
      .deficits > :global(.deficit-body),
      .circuits > :global(.browser) {
        -webkit-overflow-scrolling: touch;
      }
    }
  }
</style>
