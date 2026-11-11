# Region inspector and atlas comparison rules

Scope: chunks R1 (#54, the region inspector: the empty hint, the selected region's name, context, commands and datasheet, the constituents, functional division, domains and networks sections) and R2 (#55, the overlap of a cortical region with the other cortical atlas: its rows, figures, outline toggles, CSV and sources). The comparison catalog itself (row order, unassigned aggregation, conservation, the CSV's columns and precision) is C3's and is in `core-catalogs.md`; the source-label and empty-chrome view-models (`lib/core/panels/inspector.ts`) are C5's and are in `core-panels.md`; the overlap outline drawn on the model is `engine-e5.md`'s. Legacy sources: `viewer/ui/panels/inspector.js`, `viewer/ui/panels/constituents.js`, `viewer/ui/panels/atlas-comparison.js`, `viewer/ui/panels/comparison-format.js`, `viewer/comparison/*`, `viewer/styles/detail.css`. New code: `web/src/features/inspector/`, `web/src/lib/core/comparison-format.ts`. Decisions 35 and 39 on #4. Deviations: `r1-coarse-summaries.md`, `r1-constituent-side.md`, `r1-hidden-actions.md`, `r1-summary-headings.md`, `r2-aria-disabled-rows.md`, `r2-forced-colours.md`, `r2-new-tab-cue.md`, `r2-retry-focus.md`, `r2-status-live.md`, `r2-summary-heading.md`. Copy quoted below is the English interface text; French is given where a test pins it. Data values come from the published CDMD files (`public/models/cdmd/manifest.json`, `atlas-comparison.json`, `cab-np.json`, `functional-regions.json`, `neuropsych-domains.json`); areas are in mm² on the subject's pial surface, shares are of the source region's whole pial area, and a shown figure is the data at one decimal (`toFixed`, so |shown − data| ≤ 0.05) unless said otherwise.

## Empty state

### INSP-01 · With nothing selected, the Anatomy panel is a hint

- **Rule:** Without a selection, the Anatomy explorer's inspector shows a level-2 title and one hint line, which depends on whether the cortex is drawn. It shows no commands, facts or sections. Outside the Anatomy explorer it shows nothing.
- **Kind:** behaviour
- **Level:** unit (view-model: `inspectorEmptyChrome`, the hint choice)
- **Source:** `viewer/ui/panels/inspector.js:13-22`, `265-305`; deviations `r1-hidden-actions.md`, `r1-summary-headings.md`
- **Expected:** h2 "No region selected" and "Select a region on the model or in the anatomy list."; cortex hidden → "Cortex is hidden — internal structures are selectable."; no `button`, `dl` or `details`. Explorer `functions` → empty text. French h2 "Aucune région sélectionnée".
- **Covered by:** `src/features/inspector/inspector.svelte.test.ts` (R); `src/lib/core/panels/inspector.test.ts` (R)

## The selected region

### INSP-02 · The selected region is named with its side and group

- **Rule:** A selected region's name is a level-2 heading that can take focus by request (the `region-title` focus target), beside a "Clear selection" button. Under it, the hemisphere (capitalised side word) and the group (the catalog's group, or "—") follow the reader's language and leave with the selection. A region with notes shows them in the reader's language as the hint.
- **Kind:** behaviour
- **Level:** browser — heading, focus target
- **Source:** `viewer/ui/panels/inspector.js:283-312`; decision 35 on #4
- **Expected:** `hcp-mmp:left:1` → h2 "V1"; context terms "Hemisphere", "Lobe / System"; side "Left" (French "Gauche"); `requestFocus('region-title')` → true, focus on the h2 with `tabindex="-1"`. `learning:left:thalamus` → "Left", then French "Gauche" and a different group text; region cleared → no context and no facts. `pam50:left:gracile-fasciculus` → its notes as the hint
- **Covered by:** `src/features/inspector/inspector.svelte.test.ts` (R, but the group value is only checked non-empty and the notes only for length > 0: W for those parts)

### INSP-03 · Focus and Linked MRI act on the selection; More opens Isolate and Hide

- **Rule:** A selected region offers Focus, Linked MRI and More; without a selection they are not rendered. More is a quiet disclosure button (`aria-expanded`, `aria-controls`): pressed, it shows Isolate (Restore while isolated) and Hide on a line of their own, which stays shown for the regions selected next; while a region is isolated the line shows whatever More says, so Restore is always in reach, and Isolate pressed there keeps it shown once the isolation ends (parsimony round 2026-11-11; it was four commands in one row). Isolate has no pressed state: its label says what it will do, and it is drawn as active while isolated. Focus and Isolate announce their shortcuts. Focus, Isolate (or Restore) and Hide each say in one line what they do, as their tooltip and as a description that is there without a hover (`aria-describedby` to a hidden copy, so the tooltip shown on keyboard focus does not say it twice); a native `title` is not used, as it is hover-only. Linked MRI is named by its text, with "Open linked MRI slices" as its tooltip, and opens at the region at once from the keyboard and with an animation from a pointer. Focus, Hide and Clear call their commands.
- **Kind:** behaviour
- **Level:** browser — keyboard vs pointer activation, focus kept on Isolate
- **Source:** `viewer/ui/panels/inspector.js:104-109`, `278-290`, `328-331`; deviation `r1-hidden-actions.md`; conductor decision on #115 (Linked MRI name); review item U6 (the one-line descriptions)
- **Expected:** Buttons in the DOM "Focus", "Linked MRI", "More", "Isolate", "Hide" (French "Cibler", "IRM liée", "Plus", "Isoler", "Masquer"); More `aria-expanded="false"` with its line not drawn and out of the Tab order, then "true" with it drawn; clicks on Focus, Hide, Clear → `focus`, `hide`, `clear`. Isolate: `data-active="false"`, no `aria-pressed`; click → `isolate`; isolated → text "Restore", `data-active="true"`, no `aria-pressed`, focus still on it. Linked MRI: click → `{atRegion: true, instant: false}`, Enter → `{atRegion: true, instant: true}`; no `aria-keyshortcuts`, no `aria-label`, `data-tooltip` "Open linked MRI slices". Published data: Isolate → "Restore" (`data-active="true"`) → Isolate. Descriptions and tooltips (from `anatomy.svelte.ts`: Focus frames the selection in its colour with the rest a see-through ghost, Isolate hides every other region and frames it, Restore clears the isolation and frames the whole brain, Hide removes it and hands focus to the dissection's Undo): Focus "Frame this region in its colour, with the rest see-through grey"; Isolate "Show this region alone, framed"; Restore "Show the rest of the brain again, framed whole"; Hide "Remove this region from view; Undo brings it back"; French Hide "Retirer cette région de la vue NNBSP; Annuler la rétablit". Tab onto Focus → the tooltip shows its line and the accessible description is still that line once.
- **Covered by:** `src/features/inspector/inspector.svelte.test.ts` (R)

### INSP-04 · Clearing or hiding the selection keeps focus on the page

- **Rule:** Clear × and Hide remove the selection, and with it the commands; focus moves to a visible control instead of the page. The hand-off is S2's (`controller.md`, CTRL-04); Hide hands focus to the dissection bar's Undo (ANAT-54).
- **Kind:** behaviour
- **Level:** browser — the composed panel region with the fake engine
- **Source:** `viewer/ui/panels/inspector.js:92-102`; deviations `r1-hidden-actions.md`, `s2-hide-focus-fallback.md`
- **Expected:** `#atlas=hcp-mmp&region=hcp-mmp:left:1`: Clear selection → Isolate hidden, hash without `region=`, `document.activeElement` visible and not `body`. Hide → Isolate hidden, focus visible and not `body`.
- **Covered by:** `src/app/regions/PanelsRegion.svelte.test.ts:123` (R, Hide hands focus to Undo across panels); `src/lib/controller/anatomy.svelte.test.ts` (R, the commands); `src/features/inspector/inspector.svelte.test.ts` (W, only that the handlers are called). The Clear half in the composed panel is uncovered

### INSP-05 · The datasheet gives the measurement by kind, the centroid and the source

- **Rule:** The datasheet lists the measurement, the centroid and the source label. A structure or a cut region is measured by its segmentation volume, a cortical area by its surface area, each at four significant figures with grouped digits and the unit held to the number. The centroid is in RAS millimetres, each axis signed at one decimal, with a true minus; a region without a centroid shows a dash.
- **Kind:** scientific
- **Level:** unit (view-model: metric choice by kind; `quantity` and `formatRas` are C1's, `core-i18n.md`)
- **Source:** `viewer/ui/panels/inspector.js:314-320`
- **Expected:** `hcp-mmp:left:1` (manifest `surface_area_mm2` 2783.08) → terms "Surface area", "Centroid (RAS)", "Source label"; metric "2 783 mm²". `aseg:left:8` (manifest `segmentation_volume_mm3` 49 786) → "Volume", "49 790 mm³"; no centroid → "—". Centroid [−12.34, 56.78, −9] → "−12.3, +56.8, −9.0 mm"; French starts "−12,3".
- **Covered by:** `src/features/inspector/inspector.svelte.test.ts` (R, and S for the 49 790 mm³ volume; V1's area figure is uncovered)

### INSP-06 · The source label names the source atlas and its label ids

- **Rule:** The source label row gives the source atlas and its label ids. One or two ids sit beside the atlas name; more than two stack under the label. A reference with no id shows only the atlas, stacked. Past eight ids the row counts them and a native disclosure holds the full list.
- **Kind:** data
- **Level:** unit (view-model: `sourceLabel`, `core-panels.md`)
- **Source:** `viewer/ui/panels/inspector.js:24-42`, `237-262`
- **Expected:** `hcp-mmp:left:1` (`source_label_id` 1) → "… · 1", `.code` "1", not stacked. `learning:left:caudate` (3 `source_label_ids`) → stacked; a region with no id stacks too (`core-panels.md`). `learning:left:thalamus` (52 `source_label_ids`) → summary ending "52 labels" (French "52 étiquettes") and the 52 ids joined by ", ". The boundary: 8 ids listed, 9 counted.
- **Covered by:** `src/lib/core/panels/inspector.test.ts` (R, with the 8/9 boundary); `src/features/inspector/inspector.svelte.test.ts` (R)

### INSP-07 · An open source list stays open until the region or the language changes

- **Rule:** The long source list's disclosure keeps its open state through display changes (isolation, cortex), and closes when the region or the language changes.
- **Kind:** behaviour
- **Level:** browser — native details state across renders
- **Source:** `viewer/ui/panels/inspector.js:237-239`
- **Expected:** Thalamus, open, then isolated and cortex hidden → still open; French → closed; open, then `learning:right:thalamus` → closed.
- **Covered by:** `src/features/inspector/inspector.svelte.test.ts` (R)

### INSP-08 · The sections keep the legacy order

- **Rule:** The DOM follows the screen: name, context, commands, facts; then the comparison slot, constituents, functional division, domains and networks, inside the panel body; the deficits and circuits the region takes part in follow outside it.
- **Kind:** behaviour
- **Level:** browser — DOM order
- **Source:** `viewer/index.html:340-414`; decision 35 on #4; WCAG 2.2 SC 1.3.2
- **Expected:** `hcp-mmp:left:1`: `h2`, `dl.selection-context`, `.actions`, `dl.facts` in that order; `[data-slot=comparison]` precedes "Functional division"; `[data-slot=deficits]` outside `.region-detail`; `[data-slot=circuits]` after it.
- **Covered by:** `src/features/inspector/inspector.svelte.test.ts` (R)

### INSP-09 · The evidence sections are collapsed disclosures that keep their state

- **Rule:** Functional division, Neuropsychological functions and Functional networks are disclosures, collapsed by default, whose summaries are plain text (no heading inside, no `h3` anywhere). Enter and Space toggle them. Each keeps its open state from one selection to the next.
- **Kind:** accessibility
- **Level:** browser — native details and keyboard
- **Source:** `viewer/index.html:366`, `397-407`; deviation `r1-summary-headings.md`
- **Expected:** `hcp-mmp:left:50` → summaries "Functional division", "Neuropsychological functions", "Functional networks", all closed, no heading in a summary, no `h3`. Tab from Clear walks "", Focus, Isolate, Hide, Linked MRI, then the three summaries; Enter opens Functional networks, Space closes it. Open networks on V1, select `learning:left:innominata`, then `hcp-mmp:left:50` → still open. French "Division fonctionnelle", "Fonctions neuropsychologiques". Published data: the three closed, legacy has an `h3` in each summary, next none.
- **Covered by:** `src/features/inspector/inspector.svelte.test.ts` (R)

### INSP-10 · Networks give the region's Yeo shares and its CAB-NP network

- **Rule:** Functional networks lists the region's Yeo 7 network shares of at least 5 %, in published order, each with a swatch, a decorative bar and a whole percentage, then the note for how the shares were counted (vertices or voxels). An HCP-MMP area assigned by CAB-NP adds its one network at 100 % with its note. The caveat closes the section. A region with neither has no section.
- **Kind:** scientific
- **Level:** unit (view-model: `networksOf`, `percent`)
- **Source:** `viewer/ui/panels/inspector.js:111-160`
- **Expected:** `hcp-mmp:left:50` (manifest shares DorsAttn 0.9342, Vis 0.0632, Cont 0.0026; `cab-np.json` "Dorsal-Attention") → "Dorsal attention 93%", "Visual 6%" (Cont below 5 % not listed), then CAB-NP "Dorsal attention 100%"; captions "Yeo 7 networks", "CAB-NP networks"; note "Shares of assigned source vertices; unassigned vertices excluded. Shares below 5% hidden without rescaling."; caveat "Group resting-state networks, not measured function in this brain." Bars are `aria-hidden`. `hcp-mmp:left:1` → "Visual 100%" and CAB-NP "Primary visual 100%".
- **Covered by:** `src/features/inspector/inspector.svelte.test.ts` (W: checks only a "%" suffix, a final "100 %" and the captions; the shares from the data are uncovered)

### INSP-11 · Functional division gives the area's section and named region

- **Rule:** Only an HCP-MMP area with a published section has this section. It lists the named region when a source names one, then the section, each with its name in the reader's language and a line "kind · source · HCP‑MMP areas: …". The note says when no source names a finer region, adds the published disagreement for a contested area, and ends with the general note.
- **Kind:** data
- **Level:** unit (view-model: `functionalRegionOf`, the rows and note)
- **Source:** `viewer/ui/panels/inspector.js:162-204`
- **Expected:** `hcp-mmp:left:1` → two rows, "Primary visual cortex (V1)" with "Named region · Glasser et al. (2016) · HCP‑MMP areas: V1", then "Primary visual cortex (V1)" with "Section 1 · Glasser et al. (2016) · HCP‑MMP areas: V1". The area `L_23c_ROI` (contested 7 vs 18) → the note contains "Glasser's Table 1 gives section 7 as this area's primary section; the supplement's section text lists it under section 18." `learning:left:innominata` → no section.
- **Covered by:** `src/features/inspector/inspector.svelte.test.ts` (R, but row 2 is matched by a regex)

### INSP-12 · Domains list the functions an area reaches, in published strength order

- **Rule:** An HCP-MMP cortical area, a structure the domains sample, or a teaching unit carrying one's score has a Neuropsychological functions section. It lists each function that reaches the published threshold in the published order, which is strongest first by the z as a share of that function's own cortical maximum (not by raw z), each with its term and z at one decimal. A scored region that reaches none says so. The note names the source and differs for an area and a structure; a teaching unit lists its structure's functions and adds that it takes that structure's score.
- **Kind:** scientific
- **Level:** unit (view-model: `scoredRegion`, `domainsOf`, the note)
- **Source:** `viewer/ui/panels/inspector.js:206-235`; `brain_model/layers/neuropsych_domains.py:114-131` (the order)
- **Expected:** `hcp-mmp:left:1` → one row "Visual perception" with "“visual” · z 3.3", note containing "this whole HCP-MMP area" and "Neurosynth (Yarkoni et al. 2011)". `hcp-mmp:left:50` → first rows "Familiarity" z 4.4, "Colour perception" z 7.3, "Mental rotation" z 4.8 (published order; "Visual perception", the largest raw z at 14.8, is fifth). `aseg:left:8` → no row, "No function reaches z 3 here." and a note containing "over this whole structure". `learning:left:amygdala` → the rows of `aseg:left:18`, first "Facial emotion recognition" z 13.2, and a note containing "over this whole structure" and "This teaching-set unit takes the score".
- **Covered by:** `src/features/inspector/inspector.svelte.test.ts` (W: one regex on V1's single row, so the order is uncovered)

### INSP-13 · A region outside every partition has no evidence sections

- **Rule:** A region with no Yeo shares, no CAB-NP network, no functional section and no domain score shows none of the three sections.
- **Kind:** behaviour
- **Level:** unit (view-model)
- **Source:** `viewer/ui/panels/inspector.js:146`, `188`, `209`
- **Expected:** `learning:left:innominata` → no "Functional…" and no "Neuropsychological…" summary.
- **Covered by:** `src/features/inspector/inspector.svelte.test.ts` (R)

## Constituents

### INSP-14 · A learning unit traces back to its constituent regions

- **Rule:** A region made of other regions has a "Constituent regions" disclosure with their count. A structure part is a button that opens it; a part shown only on cuts is text. Each part names the set that holds it ("Cut only" for a cut-only part), and the note follows the list. A part the catalog does not know is an error that names it.
- **Kind:** data
- **Level:** browser — buttons that open a region (the list is a pure view-model)
- **Source:** `viewer/ui/panels/constituents.js:10-56`
- **Expected:** `learning:left:innominata` → summary "Constituent regions 2"; at least one text part containing "Cut only"; a button part → call `region:<its id>`; note "Union of source regions. Surface smoothed for readability; volume measured from source voxels. Small regions without a surface remain available on cuts." A constituent `ghost` the catalog lacks → throws "Missing learning constituent: ghost". Published data: `learning:midline:optic-chiasm` → summary contains "2"; its first part's button opens another region (the h2 no longer reads "Optic chiasm").
- **Covered by:** `src/features/inspector/inspector.svelte.test.ts` (R)

### INSP-15 · Parts on both sides each say their side

- **Rule:** When the parts span both hemispheres, each part's name ends with its side word for a screen reader, in the button and in the text alike, and a side letter is drawn but hidden from assistive technology. Parts of one side show and say no side. Names follow a language switch.
- **Kind:** accessibility
- **Level:** browser — accessible names with hidden text
- **Source:** `viewer/ui/panels/constituents.js:35-51`; deviation `r1-constituent-side.md`
- **Expected:** `learning:midline:optic-chiasm` (parts `nextbrain:left:161`, `nextbrain:right:10161`) → buttons "Optic chiasm, left" and "…, right", glyphs "L", "R" with `aria-hidden="true"`; French "Chiasma optique, gauche". `learning:left:innominata` (both left) → no glyph, no hidden side text.
- **Covered by:** `src/features/inspector/inspector.svelte.test.ts` (R)

## Inspector presentation

### INSP-16 · The inspector yields to a lesson or a profile above it

- **Rule:** When the selection is the open lesson's landmark, its name and context are hidden (the lesson's headline names it). Any other region under a lesson, or under a function or deficit profile, is a ruled, smaller second subject. On a phone the inspector has no Clear button of its own. When related deficits or circuits follow, the body drops its bottom padding.
- **Kind:** behaviour
- **Level:** browser — computed style and viewport
- **Source:** `viewer/styles/detail.css:1-127`; `viewer/styles/phone.css` (selection clear)
- **Expected:** `landmarkSelected: true` → `.selection-head` and `.selection-context` `display: none`; `false` → context `flex`, top border `1px`, name `16px`. Under a profile with no region → top border `0px`; with V1 → `1px`, name `16px`; profile off → `0px`. At 390 × 844 `.selection-clear` `display: none`, at 1280 not. With slots → `padding-bottom: 0px`; without → not `0px`.
- **Covered by:** `src/features/inspector/inspector.svelte.test.ts` (R)

### INSP-17 · Inspector targets and reflow

- **Rule:** Every button and summary is at least 24 px tall on a fine pointer and 44 px on a coarse pointer, summaries included. At 200 % text with WCAG 1.4.12 spacing, in English and French, at 1280 and 320 px, no line spills, buttons enclose their text and the page does not scroll sideways. A very long name wraps.
- **Kind:** accessibility
- **Level:** browser — geometry
- **Source:** `viewer/styles/detail.css:115`, `260-262`; deviation `r1-coarse-summaries.md`; WCAG 2.2 SC 1.4.4, 1.4.10, 1.4.12, 2.5.8
- **Expected:** `learning:midline:optic-chiasm` and `hcp-mmp:left:50` with every disclosure open: more than five targets, each ≥ 24 fine and ≥ 44 coarse (1180 × 820 touch). `hcp-mmp:left:50` at 200 %: no element with `scrollWidth > clientWidth + 1`, `.actions button` `scrollHeight ≤ clientHeight`, document `scrollWidth ≤ clientWidth`. 200 × "W" at 320 px → `.region-detail` `scrollWidth ≤ clientWidth`.
- **Covered by:** `src/features/inspector/inspector.svelte.test.ts` (R)

### INSP-18 · Commands keep an edge in increased contrast and forced colours

- **Rule:** Under increased contrast the commands get a visible border and Restore keeps its accent edge. Under forced colours Restore keeps an outline and a border. Under reduced motion the disclosure chevrons turn at once.
- **Kind:** accessibility
- **Level:** browser — media emulation
- **Source:** `viewer/styles/a11y.css`; `viewer/styles/detail.css`
- **Expected:** First command border `rgba(0, 0, 0, 0)` normally, another colour under `prefers-contrast: more`. Isolated: Restore border is the `--accent` colour, also under `more`. `forced-colors: active`: Restore `outline-style: solid`, border not transparent. `prefers-reduced-motion: reduce`: `.constituents > summary::after` `transition-duration: 0s`.
- **Covered by:** `src/features/inspector/inspector.svelte.test.ts` (R)

### INSP-19 · The inspector has no axe violations

- **Rule:** The empty state, a selected region with every section open, and the long source list pass axe in English and French.
- **Kind:** accessibility
- **Level:** browser — axe
- **Source:** WCAG 2.2 AA
- **Expected:** `expectAxeClean()` clean for `learning:midline:optic-chiasm` and `hcp-mmp:left:50` in en and fr, for no region and for `learning:left:thalamus`; `app.expectAccessible('inspector')` on V1.
- **Covered by:** `src/features/inspector/inspector.svelte.test.ts` (R)

## Atlas comparison

### INSP-20 · The comparison is offered for a cortical region of a manifest that declares one

- **Rule:** The overlap section shows only while the selected region is cortex and the manifest declares an atlas comparison. Otherwise it is hidden, not removed, so its open state survives.
- **Kind:** behaviour
- **Level:** unit (view-model: the `shown` predicate)
- **Source:** `viewer/ui/panels/atlas-comparison.js:192-196`; decision 39 on #4
- **Expected:** `hcp-mmp:left:1` → shown; `aseg:left:8`, no region, or no `atlas_comparison` in the manifest → `hidden`. Published data, `learning:midline:optic-chiasm` → hidden.
- **Covered by:** `src/features/inspector/AtlasComparison.svelte.test.ts` (R, could move down)

### INSP-21 · The section is named for the other atlas

- **Rule:** The section's summary is the plain text "Overlap with {other atlas}", the manifest's other cortical atlas, in the reader's language. It holds no heading.
- **Kind:** behaviour
- **Level:** unit (view-model: the heading)
- **Source:** `viewer/ui/panels/atlas-comparison.js:117-120`; `viewer/index.html:366`; deviation `r2-summary-heading.md`
- **Expected:** `hcp-mmp:left:1` → "Overlap with Destrieux"; `destrieux:left:16` in French → "Recouvrement avec HCP-MMP"; the summary has no child elements.
- **Covered by:** `src/features/inspector/AtlasComparison.svelte.test.ts` (R, could move down)

### INSP-22 · The comparison loads once, the first time the section is shown

- **Rule:** The comparison file is requested the first time the section is shown, while it is still closed, and not again when it is hidden and shown, nor for another region. A hidden section loads nothing. Retry loads again.
- **Kind:** behaviour
- **Level:** unit (view-model: load phase; the request count is observable with a stubbed fetch)
- **Source:** `viewer/ui/panels/atlas-comparison.js:161-178`, `205`
- **Expected:** V1 → 1 request with the panel closed; then `destrieux:left:16`, `aseg:left:8`, V1 → still 1. `aseg:left:8` first → 0. After a failure and Retry → 2. Published data: 1 request to `atlas-comparison.json` while closed.
- **Covered by:** `src/features/inspector/AtlasComparison.svelte.test.ts` (R)

### INSP-23 · The status line says loading and loaded, and is never held back

- **Rule:** The section's status line is on the page from the first paint, empty, and the same node later says "Loading atlas comparison…", then "Atlas comparison loaded." (visually hidden, dropped at the next change). `aria-busy` is on the content while loading or fetching an outline, never on an ancestor of the status line. A language switch replaces the node rather than rewriting it, so it is not said again.
- **Kind:** accessibility
- **Level:** browser — live region node identity and attributes
- **Source:** `viewer/ui/panels/atlas-comparison.js:121-124`; deviation `r2-status-live.md`; decisions 37 and 39 on #4
- **Expected:** `aseg:left:8` → status "" ; V1, open → the same node reads "Loading atlas comparison…", no `[aria-busy]` ancestor, an `[aria-busy=true]` inside; after the load → no `[aria-busy=true]`, "Atlas comparison loaded." with `visually-hidden`. French while loading → a new node "Chargement de la comparaison des atlas…", the old node never mutated.
- **Covered by:** `src/features/inspector/AtlasComparison.svelte.test.ts` (R)

### INSP-24 · A failed load says why, offers Retry, and keeps focus in the section

- **Rule:** A failed download or a checksum mismatch is said in the status line, with a Retry button. Retry moves focus to the section's summary before it goes and loads again; the rows appear once it works. A failed load stays when the region changes.
- **Kind:** behaviour
- **Level:** browser — real focus
- **Source:** `viewer/ui/panels/atlas-comparison.js:121-125`, `172-180`; deviation `r2-retry-focus.md`
- **Expected:** HTTP 503 → "Could not load the atlas comparison. A file could not be downloaded. Check the connection and try again." and "Retry comparison"; Retry (focused) → focus on the summary, rows appear, 2 requests, focus still on the summary, no Retry. 503 then `destrieux:left:16` → error and Retry stay. Bytes with `"schema_version": 2` in French → "Planum a été mis à jour. Rechargez la page pour continuer." and "Réessayer la comparaison". Published data, aborted route → "Could not load the atlas comparison.", Retry → summary focused on next, 4 rows.
- **Covered by:** `src/features/inspector/AtlasComparison.svelte.test.ts` (R)

### INSP-25 · The rows are the region's overlaps from the data, largest first

- **Rule:** Each row is a region of the other atlas that the selected region overlaps on the pial surface: its name, the overlap area in mm² and the overlap as a share of the selected region's whole pial area, in the catalog's order (largest area first). The area of the region that falls on no labelled region of the other atlas is the Unassigned row. A sentence says what the shares divide.
- **Kind:** scientific
- **Level:** unit (catalog plus figures; the catalog is C3's, `core-catalogs.md`)
- **Source:** `viewer/ui/panels/atlas-comparison.js:129-140`; `viewer/comparison/catalog.js`
- **Expected:** `hcp-mmp:left:1` (pial total 2783.08 mm²) → 5 rows; the first is `destrieux:left:43` at "956.4" mm² and "34.4" % (data 956.376, 34.36 %); Unassigned "0.0", "0.0". `destrieux:left:16` → 23 rows. `hcp-mmp:left:119` (total 366.20) → Unassigned "72.0 mm²", "19.7 %" (data 71.984, 19.66 %). Denominator "Shares of this region’s full pial surface."; column heads "Region", "Area (mm²)", "Share (%)" (`aria-hidden`).
- **Covered by:** `src/features/inspector/AtlasComparison.svelte.test.ts` (S); `src/lib/core/comparison/catalog.test.ts` (S, the catalog). The denominator sentence is asserted only by the e2e spec, so it has no running next-app test.

### INSP-26 · Four rows show, the rest behind a counted disclosure

- **Rule:** The first four rows are listed; any more sit behind a disclosure that says how many, singular or plural.
- **Kind:** behaviour
- **Level:** unit (view-model)
- **Source:** `viewer/ui/panels/atlas-comparison.js:133-137`
- **Expected:** `destrieux:left:16` → 4 rows in the first list, disclosure "19 more overlapping regions", 23 rows in all. `hcp-mmp:left:1` → "1 more overlapping region"; French "1 autre région en recouvrement".
- **Covered by:** `src/features/inspector/AtlasComparison.svelte.test.ts` (R, could move down)

### INSP-27 · Overlap figures show one decimal, and a positive overlap never shows as zero

- **Rule:** Area and share figures are bare numbers at one decimal in the reader's notation (the column heads carry the units). A share is the fraction times 100. A positive figure below 0.1 shows as "<0.1", never "0.0".
- **Kind:** scientific
- **Level:** unit
- **Source:** `viewer/ui/panels/comparison-format.js:1-15`
- **Expected:** Area: 0 → "0.0"; −0 → "0.0"; 0.0003, 0.05, 0.0500001, 0.08 and 0.0999999 → "<0.1"; `Number.MIN_VALUE` → "<0.1"; 0.1 → "0.1"; 0.95 → "0.9"; 1 → "1.0"; 99.95 → "100.0"; 100 → "100.0"; −1 → "−1.0" (U+2212); 25.36 French → "25,4". Share: 0 → "0.0"; 0.000001 → "<0.1" (French "<0,1"); 0.0008 → "<0.1"; 0.001 → "0.1"; 0.1536 → "15.4" (French "15,4"); `Number.MIN_VALUE / 100` (= 0) → "0.0". Published data: `destrieux:left:4`'s last overlap (0.069 mm², 0.0066 %) → "<0.1" and "<0.1".
- **Covered by:** `src/lib/core/comparison-format.test.ts` (R, including the edge values); `src/features/inspector/AtlasComparison.svelte.test.ts` (S, the 0.069 mm² row)

### INSP-28 · A row is a toggle named with its region, area and share

- **Rule:** Each row is a toggle button whose accessible name carries the region's name, the area with its unit and the share with its unit; the visible name is part of it. The Unassigned row is text whose figures carry their units for a screen reader.
- **Kind:** accessibility
- **Level:** unit (view-model: the name; `withUnit` is C1's)
- **Source:** `viewer/ui/panels/atlas-comparison.js:16-21`, `90-108`, `138-140`; decision 39 on #4
- **Expected:** `hcp-mmp:left:1` first row: `aria-pressed="false"`, name matching "Highlight overlap with <name>, 956.4 mm², 34.4% of this region" containing its `.comparison-name` text, cells "956.4", "34.4"; French "Tracer le recouvrement avec <name>, 956,4 mm², 34,4 % de cette région". `hcp-mmp:left:119` Unassigned children "Unassigned", "72.0 mm²", "19.7 %" with hidden "mm²", "%"; French "Non assigné". `comparison-format.test.ts`: "Highlight overlap with Area 44, 25.4 mm², 15.4% of this region".
- **Covered by:** `src/features/inspector/AtlasComparison.svelte.test.ts` (R); `src/lib/core/comparison-format.test.ts` (R)

### INSP-29 · Pressing a row outlines that overlap on the model

- **Rule:** Pressing a row asks the engine to outline its overlap from the comparison's overlap geometry; the row reads pressed only once the outline is drawn, and the status says the outline is loading meanwhile. Only one row is pressed: another takes the outline over; pressing the pressed row clears it. The latest press wins whatever order the outlines arrive in. A failed outline is said and leaves the row unpressed; an outline the engine did not apply leaves it unpressed silently. A new region or another press drops an outline error.
- **Kind:** behaviour
- **Level:** unit (view-model over C5's latest runner and the engine port; today browser with a fake engine)
- **Source:** `viewer/ui/panels/atlas-comparison.js:65-88`
- **Expected:** V1, press row 1 → `aria-pressed="true"`, engine highlighted `overlap:…`, request geometry `{file: 'atlas-overlaps.glb', sha256: '169fadf83680c282fd64fd778e462d9dc38be8dcb5e6f95dc55f5a5dabda7801'}`; again → unpressed, nothing highlighted. Row 2 → row 2 pressed, row 1 not. Pending outline → status "Loading overlap outline…", unpressed, `[aria-busy=true]`; settled → pressed, status "". Press 1 then 2, settle 2 then 1 → pressed states `false, true, false, false, false`. Rejected → "Could not load the overlap outline.", unpressed. Not applied → status "", unpressed. Published data: press 1 → pressed; 2 → 2 pressed, 1 not; 2 again → unpressed.
- **Covered by:** `src/features/inspector/AtlasComparison.svelte.test.ts` (R)

### INSP-30 · The outline goes when its context goes

- **Rule:** Closing the section clears the outline, and opening it again does not bring it back; an outline that arrives after the section closed never applies. Another region, no region, losing the ability to draw outlines, or the section leaving the page clears it.
- **Kind:** behaviour
- **Level:** unit (view-model; today browser)
- **Source:** `viewer/ui/panels/atlas-comparison.js:183-185`, `197-203`, `208-210`
- **Expected:** Pressed, close → `highlighted` null; open → unpressed. Close before the outline settles → `clear` called; settle; open → unpressed, status "". Region `destrieux:left:16` or none → `highlighted` null. Unmount → `clear` called. Published data: press row 1, close and reopen → unpressed.
- **Covered by:** `src/features/inspector/AtlasComparison.svelte.test.ts` (R)

### INSP-31 · Without outlines, rows stay focusable and say why

- **Rule:** While a cut is drawn or the tract reference is shown, rows are `aria-disabled`, stay in the Tab order, are described by the view note, and do nothing when pressed; the figures stay. Losing outlines keeps focus on the focused row. The note and description go when outlines come back.
- **Kind:** accessibility
- **Level:** browser — focus and `aria-describedby`
- **Source:** `viewer/ui/panels/atlas-comparison.js:101`, `141-142`; deviation `r2-aria-disabled-rows.md`; decision 39 on #4
- **Expected:** `outlineAvailable: false` → the first four rows `aria-disabled="true"`, not `disabled`, described by "Turn off sections to outline overlaps. Measurements use the full region, including hidden parts."; Tab from the summary → row 1; a click → no `highlight` call, unpressed. Back to true → no "Turn off sections", no `aria-describedby`, no `aria-disabled`. Pressed row 2 focused, outlines lost → nothing highlighted, unpressed, focus on row 2. Published data `cut=sagittal` → rows disabled, the note visible; Tab from the summary → row 1 focused on next (legacy: not focused).
- **Covered by:** `src/features/inspector/AtlasComparison.svelte.test.ts` (R)

### INSP-32 · A language switch keeps focus and the press on the same row

- **Rule:** Switching language renames the section and its rows in place: a focused row keeps focus and a pressed row stays pressed.
- **Kind:** behaviour
- **Level:** browser — real focus across a re-render
- **Source:** `viewer/ui/panels/atlas-comparison.js:116`, `154-158`
- **Expected:** Row 3 focused, French → same element focused, name starts "Tracer le recouvrement avec ", summary "Recouvrement avec Destrieux". Row 1 pressed and focused, French → still focused, `aria-pressed="true"`.
- **Covered by:** `src/features/inspector/AtlasComparison.svelte.test.ts` (R)

### INSP-33 · Download CSV saves every overlap, named for the subject and the region

- **Rule:** "Download CSV" saves the comparison of the selected region as a CSV named `{anatomy}-{region id with ':' as '-'}-atlas-comparison.csv`, with region names in the reader's language, and says it was saved. The CSV's columns and precision are the catalog's (`core-catalogs.md`).
- **Kind:** data
- **Level:** browser — the saved file through an anchor click and the page announcer (the name and content are pure)
- **Source:** `viewer/ui/panels/atlas-comparison.js:23-30`, `181-182`; deviation `r2-status-live.md`; decision 33 on #4
- **Expected:** `destrieux:left:16` → "cdmd-destrieux-left-16-atlas-comparison.csv", ends with CRLF, 1 + 23 lines, header starting `schema_version,anatomy_id,subject,`, line 2 contains `,destrieux:left:16,` and "Superior frontal gyrus"; French contains "Gyrus frontal supérieur" and not the English name. Announcer "Atlas comparison CSV downloaded." / "Fichier CSV de la comparaison des atlas téléchargé." Published data: V1 → "cdmd-hcp-mmp-left-1-atlas-comparison.csv"; French button "Télécharger CSV".
- **Covered by:** `src/features/inspector/AtlasComparison.svelte.test.ts` (R); `src/lib/core/comparison/catalog.test.ts` (R, the CSV)

### INSP-34 · The method names its sources, which open in a new tab and say so

- **Rule:** "Method and sources" holds the method text and a link to each atlas of the comparison, to its citation, opening in a new tab with `noopener noreferrer` and a hidden "(opens in a new tab)".
- **Kind:** behaviour
- **Level:** browser — link attributes and accessible names
- **Source:** `viewer/ui/panels/atlas-comparison.js:144-153`; deviation `r2-new-tab-cue.md`; decision 17 on #4
- **Expected:** Links ["Destrieux (opens in a new tab)", `https://doi.org/10.1016/j.neuroimage.2010.06.010`, `_blank`, `noopener noreferrer`] and ["HCP-MMP (opens in a new tab)", `https://doi.org/10.1038/nature18933`, `_blank`, `noopener noreferrer`].
- **Covered by:** `src/features/inspector/AtlasComparison.svelte.test.ts` (R)

### INSP-35 · The section, its list and its method stay open across regions

- **Rule:** The section, the "more" list and the method keep their open state from one region to the next, also through a region that hides the section.
- **Kind:** behaviour
- **Level:** browser — native details state across renders
- **Source:** `viewer/ui/panels/atlas-comparison.js:117`, `137`; decision 39 on #4
- **Expected:** `destrieux:left:16`, all three open → `destrieux:right:16` → the list and method open; `aseg:left:8` then `destrieux:left:16` → all three open.
- **Covered by:** `src/features/inspector/AtlasComparison.svelte.test.ts` (R)

### INSP-36 · Comparison targets and reflow

- **Rule:** Every button and summary in the section is at least 24 px tall on a fine pointer and 44 px on a coarse one; the source links are at least 24 px. At 200 % text with text spacing, in English and French, at 1280 and 320 px, nothing spills, buttons enclose their text and the page does not scroll sideways.
- **Kind:** accessibility
- **Level:** browser — geometry
- **Source:** WCAG 2.2 SC 1.4.4, 1.4.10, 1.4.12, 2.5.8
- **Expected:** `destrieux:left:16`, all open: more than 25 targets, each ≥ 24; buttons and summaries ≥ 44 under touch at 1180 × 820. 200 % with spacing: no `p`, `summary`, `button` or `a` with `scrollWidth > clientWidth + 1`.
- **Covered by:** `src/features/inspector/AtlasComparison.svelte.test.ts` (R; the case "inline disclosures keep legacy weight and height" pins a 32 px height and weight 400 "as legacy": I, replace it with this rule or drop it)

### INSP-37 · A pressed row and the Unassigned rule survive forced colours

- **Rule:** Under forced colours a pressed row has a 4 px system-colour edge on its inline start and the rule above Unassigned is a solid border; under increased contrast a pressed row has a 4 px accent edge. Normal rendering has no edge.
- **Kind:** accessibility
- **Level:** browser — media emulation
- **Source:** `viewer/styles/detail.css:165-168`, `181-188`; deviation `r2-forced-colours.md`
- **Expected:** `hcp-mmp:left:119`, row 1 pressed: `border-inline-start-width` `0px`; `forced-colors: active` → `4px` and `.unassigned::before` `border-top-style: solid`; `prefers-contrast: more` → `4px`.
- **Covered by:** `src/features/inspector/AtlasComparison.svelte.test.ts` (R)

### INSP-38 · The comparison has no axe violations

- **Rule:** With everything open, with a row pressed, with outlines unavailable, and in the failure state, the section passes axe in English and French.
- **Kind:** accessibility
- **Level:** browser — axe
- **Source:** WCAG 2.2 AA
- **Expected:** `expectAxeClean()` clean for `destrieux:left:16` (en, fr, all open), `hcp-mmp:left:119` pressed and then unavailable, and the 503 failure. `app.expectAccessible('atlas-comparison')` with the more list open (published data).
- **Covered by:** `src/features/inspector/AtlasComparison.svelte.test.ts` (R)

### INSP-39 · A NextBrain region lists how often each of its boundaries nearly tied

- **Rule:** A region with rated boundaries in `boundary-certainty.json` has a collapsed Boundary certainty section after the comparison slot. Its line gives the interface-weighted near-tie share and how many boundaries are soft (a third or more). Up to eight neighbours follow, largest interface first, each with a solid or dashed glyph matching the cut-face outline, its name with "soft" or "firm" for a reader, a decorative bar and a whole percentage; the rest are counted. The note gives the published voxel spacing and margin. A neighbour's name selects it without moving the camera. A region with no rated boundary has no section.
- **Kind:** scientific
- **Level:** unit (`boundariesOf`, `overallShare`, `validateBoundaryCertainty`) and browser
- **Source:** design round 2026-10-27, option C
- **Expected:** `nextbrain:right:10394` (14 rated, 3 soft) → eight rows in the published order, "6 smaller boundaries not listed.", "in 0.4 mm voxels", "within 0.2 of each other"; activating the first row calls `onselect` with its neighbour. `hcp-mmp:left:1` → no section. French "Certitude des limites", "en voxels de 0,4 mm". Axe clean with the section open.
- **Covered by:** `src/lib/core/catalog/boundary-certainty.test.ts`, `src/features/inspector/inspector.svelte.test.ts` (R)

### INSP-40 · The selected NextBrain region is outlined on a NextBrain cut by the same rating

- **Rule:** With NextBrain cut labels and a NextBrain region selected, the cut draws the region's boundaries with its neighbours: solid where the boundary is firm, two-tone dashes where it is soft, grey where the pair is unrated. Nothing is outlined without a selection, on another cut atlas, or against unlabelled tissue.
- **Kind:** scientific
- **Level:** unit (`pairTexture`) and render
- **Source:** design round 2026-10-27, option C
- **Expected:** the pair table is symmetric, 0 for an unrated pair and 1 + share × 254 otherwise; a label with no cut code leaves no entry.
- **Covered by:** `src/lib/engine/tissues/boundary-edges.test.ts` (W: the shader's ink is checked by render capture, not by a test)

### INSP-41 · A region named after a measured area shows its receptor fingerprint

- **Rule:** A region with a fingerprint in `receptor-fingerprints.json` has a collapsed Receptor densities section after the comparison slot. Measured receptors are grouped by transmitter in display order, each with its symbol (subscripts set), a decorative bar (share of that receptor's highest published mean) and its mean ± SD; a missing SD shows a dash and is named to a reader. Receptors not measured are listed once. A withheld SD gives its published value and reason; an unpublished one says so. The note gives the unit, hemispheres, brains and their ages, and the fingerprint count; the next line names what was measured and that it is carried by name. The EBRAINS dataset and any documenting paper are links. An area sampled in two parts offers Dorsal | Ventral. A region without a fingerprint has no section.
- **Kind:** scientific
- **Level:** unit (`fingerprintsOf`, `fingerprintGroups`, `unmeasured`, `validateReceptorFingerprints`) and browser
- **Source:** EBRAINS Knowledge Graph survey, 2026-10-28
- **Expected:** `julich:left:2` dorsal → groups Glutamate … Dopamine, "NMDA 964 ± 95", "Not measured: mGluR2/3, A1.", "autoradiography of 4 hemispheres from 3 post-mortem brains aged 72–77", links to 10.25493/yqcr-1dq and Zilles et al. (2015); Ventral → "NMDA 1129 ± 382", "mGluR2/3 3545 ± 913". `julich:left:75` → "D1 78 ± —, no SD" and the withheld reason; `julich:left:65` → "No SD published for α2.". `aseg:left:12` → 2 brains, no part choice. `julich:left:3` and `hcp-mmp:left:1` → no section. French "Densités de récepteurs", "Dorsale". Axe clean with the section open.
- **Covered by:** `src/lib/core/catalog/receptor-fingerprints.test.ts`, `src/features/inspector/inspector.svelte.test.ts` (R)

### INSP-42 · A region the territory atlas reaches lists its typical arterial supply

- **Rule:** A region with territory shares in the manifest has a collapsed Typical arterial supply section after the networks. Each territory it reaches by 1% or more is a row with its colour, its name in the reader's language, a decorative bar and a whole percentage, largest first. The note says the shares are of the region's pial vertices for a cortical area and of its voxels otherwise, and gives the unassigned remainder when it is at least half a percent; the caveat says these are typical territories, not this brain's vessels. A territory itself, and a region the atlas does not reach, have no section.
- **Kind:** scientific
- **Level:** browser
- **Source:** arterial territories phase 1, 2026-10-28
- **Expected:** `aseg:left:12` → first row "Lateral lenticulostriate 87%", "Share of this region’s voxels in each territory.", "not this brain’s own vessels"; `julich:left:2` → "Share of this region’s pial vertices in each territory.", first row "Middle cerebral artery, frontal …%"; `arterial:left:aca` and `pam50:left:gracile-fasciculus` → no section; French "Vascularisation artérielle typique", "Lenticulo-striées latérales 87 %". Axe clean with the section open. A V1 Tab walk reaches it ninth, after Functional networks.
- **Covered by:** `src/features/inspector/inspector.svelte.test.ts` (R)

### INSP-43 · A region that takes one of Lyu et al.'s labels shows its stimulation responses

- **Rule:** A region with an entry in `stimulation-responses.json` has a collapsed Stimulation responses section after the receptor densities. Direction (Stimulated here | Recorded here) and Hemisphere (Same side | Opposite side) choose the pairs; a thalamic structure also offers the three positional sites. Each row names the other label, then its rate, then its responded and tested pairs and the people tested on a full-width line; a pair tested in at least the published minimum of people has a decorative bar and a whole-percent rate and comes first, highest first, and the rest say "no rate" and follow by pairs tested. Labels never tested on that side are listed once. The note gives the cohort, the minimum, the excluded pairs and that nothing is measured in this brain; the next line says how the region took its label (the share of its cortical channels, or by name), and a thalamic structure says the sites are positions, not nuclei. The paper and the Zenodo dataset are links. A region without a label has no section.
- **Kind:** scientific
- **Level:** unit (`responseRows`, `untested`, `labelsOf`, `validateStimulationResponses`) and browser
- **Source:** stimulation-response feature, 2026-11-03 (Lyu et al. 2025; F-TRACT v2112 rejected, its probability field undocumented)
- **Expected:** `destrieux:left:14` → first row "Middle thalamus 75% 167 of 223 pairs · 12 people", "Frontal pole no rate 39 of 45 pairs · 1 person", "Takes the authors’ label Lateral frontal cortex: 92% of the 92 cortical channels from 21 people", links to 10.1038/s41593-025-02009-x and 10.5281/zenodo.16939708; Recorded here, Opposite side → "Medial frontal cortex 37% 109 of 293 pairs · 7 people". `learning:left:thalamus`, Posterior thalamus → "Posterior thalamus 88% 67 of 76 pairs · 18 people", "Not tested: Insula–lateral frontal border.". `destrieux:left:41` and `hcp-mmp:left:1` → no section. French "Réponses à la stimulation", "Thalamus moyen 75 % 167 paires sur 223 · 12 personnes". The published counts total 76 899 responding of 240 319 tested pairs. Axe clean with the section open.
- **Covered by:** `src/lib/core/catalog/stimulation-responses.test.ts`, `src/features/inspector/inspector.svelte.test.ts` (R)

### INSP-44 · A Julich-Brain area F-TRACT has shows F-TRACT's stimulation responses

- **Rule:** A Julich-Brain region with an F-TRACT area in `stimulation-ftract.json` has a collapsed Stimulation responses section after the receptor densities. Direction and Hemisphere choose the other areas, the hemisphere being the region's own or the other one. Rates drawn from F-TRACT's probability where the pair was recorded in at least the published minimum of implantations come first, highest first, the more tested first among equals; each row names the other area (its Julich-Brain 3.1 name where it matched one, the area's own row "Within this area"), a decorative bar, a whole-percent rate, and its pairs and implantations. The first 10 are in view and the rest behind a collapsed "N more areas". One line counts the areas on that side too thinly tested for a rate and those never tested. The note gives the response criterion, the cohort and both minima and that nothing is measured in this brain; the next line names the F-TRACT area matched by name and that F-TRACT placed contacts in MNI152. The EBRAINS dataset and the method paper are links. A Julich-Brain area F-TRACT lacks, and a region of another atlas, have no F-TRACT section.
- **Kind:** scientific
- **Level:** unit (`ftractRows`, `ftractParcelOf`, `ftractParcelName`, `validateStimulationFtract`) and browser
- **Source:** F-TRACT feature, 2026-11-04 (v2307 on EBRAINS: CC BY-NC-SA, probability defined, counts published)
- **Expected:** `julich:left:1` → "Within this area 84% 37 pairs · 6 implantations", "Area Op9 (Frontal Operculum) 83% 53 pairs · 18 implantations", 81 rows with "71 more areas" collapsed, "Too few pairs or implantations for a rate: 41 areas. Never tested: 35 areas.", "Matched by name to F-TRACT’s Julich-Brain 3.0 area Area 45 (IFG).", links to 10.25493/JYVR-WJ7 and 10.1016/j.neuroimage.2018.07.039; Recorded here, Opposite side → "Area Fo3 (OFC) 8% 13 pairs · 6 implantations" with no "more" disclosure. `julich:left:117` (Area 6v1) and `hcp-mmp:left:1` → no section; `destrieux:left:14` → Lyu et al.'s section alone. French "Aire Op9 (Frontal Operculum) 83 % 53 paires · 18 implantations". Axe clean with the section open.
- **Covered by:** `src/lib/core/catalog/stimulation-ftract.test.ts`, `src/features/inspector/inspector.svelte.test.ts` (R)

### INSP-45 · A stroke cohort that failed says why, and offers Retry or Reload where either can help

- **Rule:** The cohort that failed to load says so in danger ink, with its cause: a failed download adds what to check and offers Retry, which asks for the cohort again (a new region alone does not) and leaves focus on the region's title; bytes that no longer match their published checksum (`asset-updated`, the engine's own check included) say so, as `errors.updated`, and offer Reload; any other failure (validation) says only that the cohort could not be loaded and offers nothing, since it would fail again.
- **Kind:** behaviour
- **Level:** browser
- **Source:** the 2026-11-09 review (U9, observed in the B1 run: "The cohort could not be loaded." with no cause and no retry)
- **Expected:** `asset-fetch` → "The cohort could not be loaded. A file could not be downloaded. Check the connection and try again." in `--danger`, "Retry" by Enter → the store's `retry()` once, focus on the region title. `asset-updated`, French → "Un fichier du serveur ne correspond plus à cette page ; Planum a probablement été mis à jour. Rechargez la page pour continuer." (U+202F), button "Recharger". `Error('Invalid stroke cases')` → "The cohort could not be loaded.", no `.actions`. Store: `retry()` before a failure throws `/has not failed/`; after one, `load()` again fetches nothing, `retry()` fetches and lands `ready`. Real engine: `stroke-cases.json` one byte longer → `cases()` rejects with `code: 'asset-updated'`.
- **Covered by:** `src/features/inspector/StrokeCasesSection.svelte.test.ts` (R); `src/lib/state/stroke-cases.svelte.test.ts` (R); `src/lib/engine/index.svelte.test.ts` (R)

### INSP-47 · The region sheet has About this region, then one closed Research data row

- **Rule:** Nothing is removed. About this region keeps its 13px/600 caption in the tree's caption idiom over its disclosures; Research data is one closed disclosure row holding its sections, set in 12px (parsimony round 2026-11-11; it was a second caption with its sections open to view). The row opens itself when a section inside opens itself or is asked for (a linked stroke case, the Deficits list's Stroke cases, the reader's map), and is not drawn when the region has no research section. **About this region** (« À propos de cette région »): Neuropsychological functions, Functional networks, Typical arterial supply, Constituent regions, Functional division, Cerebellar functions; then the related deficits and circuits. **Research data** (« Données de recherche »): Boundary certainty, Segmentation agreement, Atlas overlap, Receptor densities, the two stimulation sections, Stroke cases, Map over time. Every disclosure stays closed by default. A closed summary carries its headline value where it is in hand without a fetch: the number of functions, the largest network share (else CAB-NP's network), the number of receptors; atlas overlap and stroke cases load on open, so theirs stay bare. A caption with no section under it for the selected region is not drawn; the research index closes the detail and keeps its bottom inset (supervisor review 2.2).
- **Kind:** behaviour
- **Level:** browser
- **Expected:** `hcp-mmp:left:50` → caption "About this region" and a closed row "Research data"; About lists "Neuropsychological functions, 32", "Functional networks, Dorsal attention 93%", "Typical arterial supply", "Functional division"; the Research data row holds Atlas overlap; all closed. Left lateral ventricle → About not drawn. Tab order: the About summaries, then the Research data row; its sections take Tab stops once it is open. With no region selected the row is in the page and not drawn.
- **Covered by:** `src/features/inspector/inspector.svelte.test.ts` (R)

### INSP-48 · A Julich-Brain area's connectivity partners run strongest first

- **Rule:** The published table holds each pair of areas once (upper triangle, r × 100); an area's partners are every other area of its table, read from either side of the pair, strongest first. A region without a row (another atlas, or Destrieux, whose table failed its validation) has none.
- **Kind:** data
- **Level:** unit
- **Expected:** `partnersOf(t, 'julich:right:1')` → left 1 (0.60), right 2 (0.45), left 2 (0.35); on CDMD, left Area 4a's first partner is right Area 4a, and each area has 277.
- **Covered by:** `src/lib/core/catalog/functional-connectivity.test.ts`; `tests/test_functional_connectivity.py`

### INSP-49 · A connectivity paint shows a lifted paint again and ends with its tab

- **Rule:** Asking to paint an area's connectivity puts back a paint the reader lifted; clearing it leaves the reader's lift alone. Another tab ends it; choosing Anatomy again does not.
- **Kind:** state
- **Level:** unit
- **Expected:** `setConnectivitySeed(id)` → `paintLifted` false; `setExplorer('functions')` → seed null.
- **Covered by:** `src/lib/core/state/session.test.ts`

### INSP-50 · The connectivity section lists ten partners; a name selects it; Paint asks for this area

- **Rule:** A Julich-Brain area's sheet has a closed "Functional connectivity" section in Research data, its closed line adding "resting fMRI" as the quiet value (the group of 200 adults is in its note): its ten strongest partners as bars with r in the reader's notation, each name with its hemisphere and selecting that area; the note (group average, a correlation is not a connection, no global signal regression), the basis and the dataset and paper links. In Anatomy a tonal "Paint on the brain" asks for this area's paint.
- **Kind:** behaviour
- **Level:** browser (component)
- **Expected:** Area 45 left → "Area 44 (IFG) · left 0.58" first; clicking it selects `julich:left:2`; Paint asks for `julich:left:1`; axe clean.
- **Covered by:** `src/features/inspector/inspector.svelte.test.ts`

### INSP-51 · While the stage shows an area's connectivity a ruled strip names it with Restore

- **Rule:** The section says which area's connectivity the stage shows, in a ruled status strip with "Restore previous view", which ends the paint. The area painted offers no Paint; another area does, and another tab offers none.
- **Kind:** behaviour
- **Level:** browser (component)
- **Expected:** "The brain shows resting connectivity with Area 45 (IFG) · left." + Restore → restore asked; Area 44 shows Paint; in Functions none.
- **Covered by:** `src/features/inspector/inspector.svelte.test.ts`
