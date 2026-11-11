<!--
  The selected region (ui/panels/inspector.js, index.html:340-414): its name and where it sits,
  the commands that act on it, its measurements, then the collapsed sections that qualify it.
  Without a selection it is one hint line. The sections keep legacy's order (decision 35 on #4):
  the comparison slot (R2), constituents, functional division, domains, networks, with NextBrain's
  boundary certainty and segmentation agreement after the comparison, all being about the labels'
  source, then the receptor
  densities measured in the area the region is named after and the stimulation responses of the
  label it takes (Lyu et al.) or of the Julich-Brain area it is (F-TRACT); the deficits
  and circuits the region takes part in (X2, X3) follow as slots of their own.
  - the name is the `region-title` focus target; the commands that hide the selection with it
    (Clear ×, Hide) hand focus on through S2's commands, not here;
  - Focus and Linked MRI stand in the row; Isolate and Hide wait behind More, on a line of their own
    (2026-11-11), and the research data's sections inside one closed row;
  - Isolate has no `aria-pressed`: its label says Isolate or Restore (APG toggle button);
  - Focus, Isolate and Hide carry a one-line tooltip, also their description (U6);
  - the actions are not rendered without a region, instead of hidden and disabled
    (deviations/r1-hidden-actions.md); summaries are plain text (deviations/r1-summary-headings.md).
  I1 mounts it inside the panel landmark, which carries `data-own-keys` (decision 7).
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type {
    ArterialTerritories,
    CerebellarFunctions,
    Explorer,
    StriatalNetworks,
    Language,
    Region,
    Rgb,
  } from '../../lib/types/index.ts';
  import type { RegionLabel } from '../../lib/core/catalog/labels.ts';
  import type { CabNpPartition } from '../../lib/core/catalog/networks.ts';
  import type { FunctionalRegions } from '../../lib/core/catalog/functional-regions.ts';
  import type { NeuropsychDomains } from '../../lib/core/catalog/neuropsych-domains.ts';
  import type { BoundaryCertainty } from '../../lib/core/catalog/boundary-certainty.ts';
  import type { SegmentationAgreement } from '../../lib/core/catalog/segmentation-agreement.ts';
  import type { ReceptorFingerprints } from '../../lib/core/catalog/receptor-fingerprints.ts';
  import type { StimulationResponses } from '../../lib/core/catalog/stimulation-responses.ts';
  import type { StimulationFtract } from '../../lib/core/catalog/stimulation-ftract.ts';
  import { ARIA_KEYSHORTCUTS } from '../../lib/controller/keymap.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import { inspectorEmptyChrome } from '../../lib/core/panels/inspector.ts';
  import { FOCUS_TARGETS, registerFocusTarget } from '../../lib/ui/focus.ts';
  import Disclosure from '../../lib/ui/Disclosure.svelte';
  import IconButton from '../../lib/ui/IconButton.svelte';
  import { isKeyboardActivation } from '../../lib/ui/instant.ts';
  import AgreementSection from './AgreementSection.svelte';
  import BoundarySection from './BoundarySection.svelte';
  import Constituents from './Constituents.svelte';
  import DomainSection from './DomainSection.svelte';
  import FunctionalSection from './FunctionalSection.svelte';
  import NetworkSection from './NetworkSection.svelte';
  import ReceptorSection from './ReceptorSection.svelte';
  import StimulationSection from './StimulationSection.svelte';
  import FtractSection from './FtractSection.svelte';
  import ConnectivitySection from './ConnectivitySection.svelte';
  import type { FunctionalConnectivity } from '../../lib/core/catalog/functional-connectivity.ts';
  import StrokeCasesSection from './StrokeCasesSection.svelte';
  import type { StrokeCasesStore } from '../../lib/state/stroke-cases.svelte.ts';
  import type { UserMapStore } from '../../lib/state/user-map.svelte.ts';
  import SupplySection from './SupplySection.svelte';
  import CerebellarFunctionsSection from './CerebellarFunctionsSection.svelte';
  import MapCourseSection from './MapCourseSection.svelte';
  import RegionFacts from './RegionFacts.svelte';
  import './inspector.css';

  interface Props {
    lang: Language;
    /** The selected region, or null for the empty hint. */
    region: Region | null;
    explorer: Explorer;
    cortexVisible: boolean;
    /** The selection is drawn alone in its colour, everything else ghosted. */
    focused: boolean;
    isolated: boolean;
    /** A lesson is open: true when the selection is its landmark (the headline above names it), false for any other region. */
    landmarkSelected?: boolean;
    /** A function or deficit profile sits above: the region is a smaller second subject. */
    underProfile?: boolean;
    catalog: {
      get: (id: string) => { region: Region; label: RegionLabel } | null;
      label: (id: string) => RegionLabel;
    };
    centroidOf: (id: string) => readonly number[] | null;
    /** The manifest's Yeo network colours. */
    networkColors?: Readonly<Record<string, Rgb>>;
    cabNp: CabNpPartition | null;
    functionalRegions: FunctionalRegions | null;
    domains: NeuropsychDomains | null;
    boundaryCertainty: BoundaryCertainty | null;
    segmentationAgreement: SegmentationAgreement | null;
    receptors: ReceptorFingerprints | null;
    /** Lyu et al.'s stimulation responses, by the authors' label a region takes. */
    stimulation: StimulationResponses | null;
    /** F-TRACT's stimulation responses, by the Julich-Brain area a region is. */
    ftract: StimulationFtract | null;
    /** Resting functional connectivity, by the Julich-Brain area a region is. */
    connectivity?: FunctionalConnectivity | null;
    /** The area whose connectivity the stage paints now, or null. */
    connectivityPainted?: string | null;
    /** Paints an area's connectivity; null where the stage cannot show it. */
    paintConnectivity?: ((id: string) => void) | null;
    restoreConnectivity?: () => void;
    /** The stroke cases on the stage and their cohort; none on an anatomy that publishes no cases. */
    strokeCases?: StrokeCasesStore | null;
    /** The reader's own map, whose series has a course in the region. */
    userMap?: UserMapStore | null;
    /** The manifest's arterial territories, for each region's typical supply. */
    territories?: ArterialTerritories | null;
    /** The manifest's functional cerebellar atlas, for each lobule's shares. */
    cerebellarFunctions?: CerebellarFunctions | null;
    /** The manifest's striatal network atlas, for its confidence threshold. */
    striatalNetworks?: StriatalNetworks | null;
    /** Takes no arguments: wires `toggleFocus()`, which frames with an animation (only the F key is immediate). */
    onfocus: () => void;
    /** Takes no arguments: I1 wires `isolateSelection`. */
    onisolate: () => void;
    /** S2's `hideSelection`: it hands focus on. */
    onhide: () => void;
    /** S2's `clearSelection`: it rescues focus. */
    onclear: () => void;
    /** A constituent structure: opens it, as S2's `openConstituent`. */
    onregion: (id: string) => void;
    /** A boundary's neighbour: selects it without moving the view. */
    onselect: (id: string) => void;
    /** S3's `openLinkedMri`; `instant` is true for a keyboard activation. */
    openLinkedMri: (options: { atRegion: true; instant: boolean }) => unknown;
    /** Shows a compared structure's agreement in the linked MRI, opened at the region. */
    showAgreement: (code: number, options: { instant: boolean }) => unknown;
    comparison?: Snippet;
    relatedDeficits?: Snippet;
    relatedCircuits?: Snippet;
  }

  let {
    lang,
    region,
    explorer,
    cortexVisible,
    focused,
    isolated,
    landmarkSelected,
    underProfile = false,
    catalog,
    centroidOf,
    networkColors,
    cabNp,
    functionalRegions,
    domains,
    boundaryCertainty,
    segmentationAgreement,
    receptors,
    stimulation,
    ftract,
    connectivity = null,
    connectivityPainted = null,
    paintConnectivity = null,
    restoreConnectivity = () => {},
    strokeCases = null,
    userMap = null,
    territories = null,
    cerebellarFunctions = null,
    striatalNetworks = null,
    onfocus,
    onisolate,
    onhide,
    onclear,
    onregion,
    onselect,
    openLinkedMri,
    showAgreement,
    comparison,
    relatedDeficits,
    relatedCircuits,
  }: Props = $props();

  let title = $state<HTMLElement>();
  $effect(() => registerFocusTarget(FOCUS_TARGETS.regionTitle, () => title ?? null));

  const uid = $props.id();
  const copy = $derived(t(lang, 'inspector'));
  // Isolate and Hide wait behind More; once shown they stay for the next regions, and Restore always shows.
  let moreOpen = $state(false);
  const dissecting = $derived(moreOpen || isolated);
  // The research data is one closed row; a section inside that opens itself (a linked stroke case, the
  // reader's map) opens it.
  let researchOpen = $state(false);
  function onResearchToggle(event: Event) {
    const details = event.target as HTMLDetailsElement;
    if (details.open && details.parentElement?.closest('details')) researchOpen = true;
  }
  const hints = $derived({
    focus: copy.focusHint,
    isolate: isolated ? copy.restoreHint : copy.isolateHint,
    hide: copy.hideHint,
  });
  const chrome = $derived(inspectorEmptyChrome({ selectedRegion: region, explorer }));
  const label = $derived(region ? catalog.label(region.id) : null);
  // A selected region always names its atlas; the facts and the source label read it.
  const atlasRegion = $derived.by(() => {
    if (region && !region.atlas) throw new Error(`Selected region has no atlas: ${region.id}`);
    return region as (Region & { atlas: string }) | null;
  });
</script>

<div
  class="region-detail"
  data-landmark-selected={landmarkSelected}
  data-under-profile={underProfile ? '' : undefined}
>
  {#if region && label && atlasRegion}
    <div class="selection-head">
      <h2 class="region-name" tabindex="-1" bind:this={title}>{label.name}</h2>
      <IconButton
        class="selection-clear"
        icon="close"
        label={copy.clearSelection}
        data-tooltip={copy.clearSelection}
        onclick={onclear}
      />
    </div>
    <dl class="selection-context">
      <dt class="visually-hidden">{copy.hemisphere}</dt>
      <dd>{t(lang, 'sides').capitalized[region.hemisphere] ?? region.hemisphere}</dd>
      <dt class="visually-hidden">{copy.group}</dt>
      <dd class="context-group">{label.group ?? '—'}</dd>
    </dl>
    {#if region.notes}<p class="selected-hint">{region.notes[lang]}</p>{/if}
    <div class="actions">
      <button
        type="button"
        data-active={focused}
        aria-pressed={focused}
        aria-keyshortcuts={ARIA_KEYSHORTCUTS.focusSelection}
        aria-describedby="{uid}-focus"
        data-tooltip={hints.focus}
        onclick={onfocus}
      >
        {copy.focus}
      </button>
      <button
        type="button"
        class="linked-mri"
        data-tooltip={t(lang, 'cuts').openMprTitle}
        onclick={(event) => openLinkedMri({ atRegion: true, instant: isKeyboardActivation(event) })}
      >
        {copy.linkedMri}
      </button>
      <button
        type="button"
        class="more-actions"
        aria-expanded={dissecting}
        aria-controls="{uid}-more"
        onclick={() => (moreOpen = !dissecting)}
      >
        {copy.moreActions}<span class="more-chevron" aria-hidden="true"></span>
      </button>
      <div id="{uid}-more" class="more-row" hidden={!dissecting}>
        <button
          type="button"
          data-active={isolated}
          aria-keyshortcuts={ARIA_KEYSHORTCUTS.isolate}
          aria-describedby="{uid}-isolate"
          data-tooltip={hints.isolate}
          onclick={() => {
            // Pressed here, the row stays once the isolation ends.
            moreOpen = true;
            onisolate();
          }}
        >
          {isolated ? copy.restore : copy.isolate}
        </button>
        <button
          type="button"
          aria-describedby="{uid}-hide"
          data-tooltip={hints.hide}
          onclick={onhide}
        >
          {t(lang, 'dissection').hideSelected}
        </button>
      </div>
      <!-- The tooltips' text as descriptions, there without a hover or before the tooltip shows. -->
      {#each Object.entries(hints) as [command, hint] (command)}
        <span id="{uid}-{command}" hidden>{hint}</span>
      {/each}
    </div>
    <RegionFacts region={atlasRegion} {lang} centroid={centroidOf(region.id)} />
  {:else}
    {#if !chrome.hideHint}
      <h2 class="selection-empty">{copy.noRegionSelected}</h2>
      <p class="selected-hint">{cortexVisible ? copy.hintCortex : copy.hintStructures}</p>
    {/if}
  {/if}
  <!-- Two indexes (supervisor review 2.2): what is known about the region, then the research data on it. -->
  <div class="region-index" data-index="about">
    <h3 class="index-caption">{copy.aboutIndex}</h3>
    <DomainSection {region} {lang} {domains} />
    <NetworkSection {region} {lang} colors={networkColors} {cabNp} striatal={striatalNetworks} />
    <SupplySection {region} {lang} {territories} />
    <Constituents {region} {lang} get={catalog.get} label={catalog.label} {onregion} />
    <FunctionalSection {region} {lang} {functionalRegions} />
    <CerebellarFunctionsSection {region} {lang} functions={cerebellarFunctions} />
  </div>
</div>
{@render relatedDeficits?.()}
{@render relatedCircuits?.()}
<div class="region-detail region-research">
  <!-- `toggle` does not bubble, so a section opening inside is heard on the way down. -->
  <div class="region-index" data-index="research" ontogglecapture={onResearchToggle}>
    <Disclosure variant="section" summary={copy.researchIndex} bind:open={researchOpen}>
      <BoundarySection
        {region}
        {lang}
        certainty={boundaryCertainty}
        label={catalog.label}
        {onselect}
      />
      <AgreementSection
        {region}
        {lang}
        agreement={segmentationAgreement}
        label={catalog.label}
        onshow={showAgreement}
      />
      {@render comparison?.()}
      <ReceptorSection {region} {lang} {receptors} />
      <StimulationSection {region} {lang} {stimulation} />
      <FtractSection {region} {lang} {ftract} />
      <ConnectivitySection
        {region}
        {lang}
        {connectivity}
        {catalog}
        painted={connectivityPainted}
        {onselect}
        onpaint={paintConnectivity}
        onrestore={restoreConnectivity}
      />
      {#if strokeCases?.available}
        <StrokeCasesSection {region} {lang} store={strokeCases} label={catalog.label} />
      {/if}
      {#if userMap}
        <MapCourseSection {region} {lang} map={userMap} label={catalog.label} />
      {/if}
    </Disclosure>
  </div>
</div>
