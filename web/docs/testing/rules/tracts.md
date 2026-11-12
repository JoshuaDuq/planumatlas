# Tracts explorer and MRI navigator rules

Scope: chunks T1 (#59), the Tracts panel (the tract list and its keys, the search, loading and failure, the display settings, the lengths CSV, the notes and the MRI command), and T2 (#60), the "MRI with tracts" dialog around NiiVue (opening and lifetime, the canvas keys, the voxel form, contrast, the crosshair in both directions, failure). Reading the published tract files, the length filter, streamline geometry, the reference space and the NiiVue wrapper's voxel conversion are the engine's, in `engine-e6.md` (DIFF-); this catalogue does not repeat them. The tract catalog data and its validation are in `core-catalogs.md` (CAT-); the translated sentences (streamline counts, error wording, the MRI readout) in `core-i18n.md` (I18N-); the global `/` and `M` in `controller.md` (KEY-09, KEY-02, KEY-12). Legacy sources: `viewer/diffusion/controls.js` (and `controls.test.js`), `viewer/diffusion/native-ui.js` (and `native-ui.test.js`), `viewer/diffusion/navigation-ui.js`, `viewer/diffusion/translations.js`, `viewer/index.html:630-677`, `viewer/styles/dialogs.css:205-251`. New code: `web/src/lib/core/tracts.ts`, `web/src/features/tracts/{TractsExplorer,TractRow,MriNavigator}.svelte`, `web/src/features/tracts/download.ts`. Deviations: `t1-*.md` (filter-announcement, focus-after-load, list-heading-name, metrics-only-while-drawn, minimum-length-config, new-tab-cue, pending-check, restore-export-announced, retry-label, search-folds-accents, status-and-alert), `t2-*.md` (canvas-application, coarse-targets, context-lost, focus-not-obscured, hint, key-modifiers, location-fail-fast, readout-not-live, retry-focus, shortcut-toggle, slider-output, status-and-alert, voxel-group), `e7-navigator-source-voxel.md`. Decisions 29 and 42 on #4 (T1), decision 41 and comment 76 on #4 (T2), comment 64 on #4 (the navigator reports source voxels). Published data: `data/diffusion-cdmd.yaml` (catalog `cdmd-sub-013`, anatomy `cdmd`, 30 bundles, initial `af-left` and `cst-right`, T1 map range 0–525). Browser cases run against the fake engine (F2), whose streamline counts and lengths are made up (4 streamlines, mean 50.0, range 20–80; an 8 × 9 × 10 scan with 2 mm voxels). Copy quoted is the English interface text; "mm" is preceded by a narrow no-break space (U+202F).

## The tract list

### TRACT-01 · A tract's left and right files share one row, left first; numbered segments share a row named without the number

- **Rule:** Bundles whose id ends in `-left`/`-right` pair into one row, left before right, named by what their names share before " · side". Bundles whose id ends in a number share one row named without the trailing number. A bundle with neither, a row mixing sides and segments, and members whose names disagree are errors.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/diffusion/controls.js:18-46`; `viewer/diffusion/controls.test.js:13-34`
- **Expected:** `af-right` "Arcuate fasciculus · right" + `af-left` "… · left" → one sided row, parts `['left', 'right']`, name "Arcuate fasciculus". `cc-1`, `cc-2` "Corpus callosum · source segment 1/2" → unsided, parts `['1', '2']`, EN "Corpus callosum · source segment", FR "Corps calleux · segment source". `fornix` → throws "neither a side nor a segment"; `x-left` "One · left" + `x-right` "Other · right" → name throws /disagree/; `x-left` + `x-1` → throws "mixes sides and segments".
- **Covered by:** `src/lib/core/tracts.test.ts` (R)

### TRACT-02 · The published CDMD collection reads as 13 tracts in both languages

- **Rule:** The 30 published bundles form 13 rows: 11 sided tracts, the whole corpus callosum, and the seven TractSeg callosal segments; every row has a name in English and French. The list shows them in catalog order with the two initial bundles drawn.
- **Kind:** data
- **Level:** unit
- **Source:** `data/diffusion-cdmd.yaml`; `config/model.yaml` (`tract_catalogs`); `viewer/diffusion/controls.test.js:36-46`
- **Expected:** For each catalog in `config/model.yaml`: members summed = bundles; `cdmd-sub-013` → 13 rows; `TRACT_CATALOGS[0].bundles.length` = 30; every `tractRowName(row, 'en' | 'fr')` non-empty. Row names include "Arcuate fasciculus", "Corticospinal tract", "Cingulum", "Corpus callosum · whole", "Corpus callosum · TractSeg segment". Initial: `af-left`, `cst-right`.
- **Covered by:** `src/lib/core/tracts.test.ts` (R) (S, 13 rows per catalog; the 30-bundle names); `src/features/tracts/TractsExplorer.svelte.test.ts` (R, 13 groups, 30 keys in catalog order)

### TRACT-03 · Each tract is a group of keys, each key a checkbox named in full

- **Rule:** Each row is a group named by the tract. Each side or segment is a native checkbox named by the full bundle name, with the same tooltip, showing only a letter (the side glyph) or the segment number.
- **Kind:** accessibility
- **Level:** browser — ARIA in the DOM
- **Source:** `viewer/diffusion/controls.js:48-104`
- **Expected:** 13 `section [role=group]`; checkbox names = the 30 English bundle names in order; group "Arcuate fasciculus" with checkbox "Arcuate fasciculus · left" [checked] then "Arcuate fasciculus · right"; the left key's tooltip "Arcuate fasciculus · left" and visible text "L".
- **Covered by:** `src/features/tracts/TractsExplorer.svelte.test.ts` (R)

### TRACT-04 · Opening the Tracts tab the first time loads the dataset; the engine follows the tab after that

- **Rule:** The panel loads nothing until the Tracts tab is open. The first opening loads the reference dataset and draws the catalog's initial bundles. Every later opening and closing reaches the engine, also while the first load is still running. The panel is hidden while its tab is not in front.
- **Kind:** behaviour
- **Level:** browser — the component's effects with the fake engine (pure enough to move into a view-model unit test)
- **Source:** `viewer/diffusion/native-ui.js:78-120`
- **Expected:** `active: true` → `setActive` called with `[true]` once; Arcuate fasciculus · left and Corticospinal tract · right checked, Arcuate fasciculus · right not. `active: false` → no `setActive`, `.tracts` hidden. Open, close, open during the first load → `setActive` `[true, false, true]`.
- **Covered by:** `src/features/tracts/TractsExplorer.svelte.test.ts` (R)

### TRACT-05 · A key's count and lengths describe it only while its bundle is drawn

- **Rule:** While a bundle is drawn, its key is described by its side letter, the streamline count ("{n} streamlines", or "{shown} of {total} streamlines" after the length filter) and the length summary, or "No streamlines meet this length filter." when none is kept. An undrawn key has no description at all.
- **Kind:** accessibility
- **Level:** browser — `aria-describedby` and DOM presence
- **Source:** `viewer/diffusion/controls.js:89-110`; deviation `t1-metrics-only-while-drawn.md`
- **Expected:** Fake engine: af-left described "L", "4 streamlines", "mean 50.0 mm (range 20.0–80.0)"; af-right has no `aria-describedby` and no `#native-diffusion-bundle-af-right-meta`. After a 40 mm minimum: "3 of 4 streamlines". Unchecking af-left removes the description. In the app: af-left description matches `/streamlines.*mean .* mm \(range/`, and is "" once unchecked (legacy keeps it).
- **Covered by:** `src/features/tracts/TractsExplorer.svelte.test.ts` (R; "No streamlines meet this length filter." is uncovered); the count wording is I18N-

### TRACT-06 · Lengths read as a paper writes them, in the reader's notation

- **Rule:** A drawn bundle's lengths read "mean M mm (range A–B)", each to one decimal, with a decimal comma in French.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/diffusion/controls.js:112-116`; `viewer/diffusion/controls.test.js:48-54`
- **Expected:** `{mean 142.25, min 75, max 239.46}` → EN "mean 142.3 mm (range 75.0–239.5)", FR "moyenne 142,3 mm (étendue 75,0–239,5)". `{mean 0.05, min 0, max 1000}` → EN "mean 0.1 mm (range 0.0–1000.0)", FR "moyenne 0,1 mm (étendue 0,0–1000,0)".
- **Covered by:** `src/lib/core/tracts.test.ts` (R)

### TRACT-07 · A key draws or hides a loaded bundle, and downloads one not yet loaded at its first check

- **Rule:** Checking or unchecking a key whose bundle is loaded draws or hides it at once. Checking a key whose bundle is not loaded downloads it: meanwhile the key stays checked and its row is marked busy; when it arrives, "Loaded: {name}" is said; if the download fails the key unchecks and the alert says why. A download that finishes after the panel is gone says nothing.
- **Kind:** behaviour
- **Level:** browser — keyboard and the fake engine's timing
- **Source:** `viewer/diffusion/native-ui.js:100-118,176-195`; deviations `t1-pending-check.md`, `t1-restore-export-announced.md`
- **Expected:** Space on af-left → af-left not visible, no description; Space again → checked. Cingulum · left (not loaded) → engine has `cg-left`, checked, announcer "Loaded: Cingulum · left". Held download: checked, fieldset disabled, group "Cingulum" `aria-busy="true"`; rejected with `asset-fetch` → alert contains "could not be downloaded", unchecked, no `aria-busy`. Unmount before the download resolves → announcer "".
- **Covered by:** `src/features/tracts/TractsExplorer.svelte.test.ts` (R)

## The search

### TRACT-08 · The search keeps a tract when its name or any member's name contains the query, ignoring case and accents

- **Rule:** As the reader types (no Enter), rows are kept when the folded query is a substring of the folded row name or any member name in the interface language. Folding lower-cases and removes accents, so "arque" finds "Arqué". English text is never matched in French.
- **Kind:** behaviour
- **Level:** unit (view-model); the row hiding is checked in the browser
- **Source:** `viewer/diffusion/native-ui.js:122-136`; `viewer/diffusion/controls.js:107-108`; deviation `t1-search-folds-accents.md`; decision 42 on #4
- **Expected:** `foldForSearch('Arqué', 'fr')` = "arque"; the FR search text of the arcuate row contains "arque" and "gauche", the EN text does not contain "gauche". On the catalog: "cingul" → 1 row (Cingulum); "" → 13 rows; FR "ARQUE" → 1 row; FR "gauche" → 11 rows.
- **Covered by:** `src/lib/core/tracts.test.ts` (R); `src/features/tracts/TractsExplorer.svelte.test.ts` (R)

### TRACT-09 · The list heading counts the bundles kept; with none, an empty state replaces it

- **Rule:** The heading above the list reads "Tract bundles" and the number of bundles kept, named "Tract bundles, N" with a hidden comma so it reads as one phrase. When nothing matches, the heading goes and the empty state says "No match for “{query}”" with the hint "Try another tract name."
- **Kind:** accessibility
- **Level:** browser — heading name; the count is a view-model value
- **Source:** `viewer/diffusion/native-ui.js:122-136`; deviation `t1-list-heading-name.md`
- **Expected:** Empty query → heading text "Tract bundles, 30"; "arcuate" → "Tract bundles, 2"; "zzz" → "No match for “zzz”" and "Try another tract name." visible, no `h4`.
- **Covered by:** `src/features/tracts/TractsExplorer.svelte.test.ts` (R)

### TRACT-10 · The result is said once typing pauses

- **Rule:** 500 ms after typing pauses, the page says the number of bundles kept, or the empty state with its hint. A language switch says nothing; a panel unmounted while a count is pending says nothing.
- **Kind:** accessibility
- **Level:** browser — the page's live region (fake timers make it instant)
- **Source:** deviation `t1-filter-announcement.md`
- **Expected:** "arcuate" → nothing at once, then "2 tract bundles"; "zzz" → "No match for “zzz”. Try another tract name."; "cing" → "2 tract bundles"; FR counts "1 faisceau", "12 faisceaux". Unmount within 500 ms → "". Language switch → "".
- **Covered by:** `src/features/tracts/TractsExplorer.svelte.test.ts` (R; the first case waits on the real 500 ms debounce); the count sentence is in `src/lib/core/i18n/i18n.test.ts` (I18N-)

### TRACT-11 · Escape and the clear button empty the search and keep focus in it

- **Rule:** With text in the field, Escape clears it, keeps focus there and is consumed; on an empty field Escape is left to the page's cascade. A "Clear search" button shows only while there is text, and clears and refocuses the field (Enter and Space press it). An empty field shows the `/` keycap, hidden from assistive technology; `/` focuses the field (KEY-09).
- **Kind:** behaviour
- **Level:** browser — keyboard and focus
- **Source:** `viewer/diffusion/native-ui.js:13-24,213-228`
- **Expected:** Type "cing", Escape → value "", focus in the field, the keydown `defaultPrevented`; Escape again → not prevented. "cing" → "Clear search" present; click → value "", focus in the field, button gone. `.head kbd` text "/", `aria-hidden="true"`. `focusSearch()` → focus in the field.
- **Covered by:** `src/features/tracts/TractsExplorer.svelte.test.ts` (R)

## Loading and failure

### TRACT-12 · While the dataset loads the controls are off and a polite status says so

- **Rule:** Until the reference dataset is ready, everything below the search is disabled, while the search stays usable. A polite status says "Loading reference dataset…", then "Reference dataset ready.", and is never rewritten with the same words.
- **Kind:** accessibility
- **Level:** browser — live region and disabled state
- **Source:** `viewer/diffusion/native-ui.js:32-34,138-152`; deviation `t1-status-and-alert.md`
- **Expected:** Held load → status contains "Loading reference dataset…", fieldset disabled, search enabled. Ready, then two ArrowRight on the minimum slider → no write to the status, no `role=alert`.
- **Covered by:** `src/features/tracts/TractsExplorer.svelte.test.ts` (R)

### TRACT-13 · A failed load raises a separate alert and offers Try again, or Reload after an update

- **Rule:** A failure mounts a separate alert with the failure's sentence and empties the status; the controls stay disabled. "Try again" (FR "Réessayer") repeats the failed load, and the alert goes when it starts. When the site was updated, the only help is a page reload, so the button is "Reload" (FR "Recharger").
- **Kind:** behaviour
- **Level:** browser — live regions and the fake engine
- **Source:** `viewer/diffusion/native-ui.js:138-152,176-195`; deviations `t1-status-and-alert.md`, `t1-retry-label.md`
- **Expected:** First `setActive` rejects `asset-fetch` → alert contains "could not be downloaded", status "", fieldset disabled. "Try again" → no alert, status "Reference dataset ready.", fieldset enabled. `asset-updated` → alert contains "Planum has probably been updated", button "Reload", no "Try again".
- **Covered by:** `src/features/tracts/TractsExplorer.svelte.test.ts` (R); the sentences per error code are I18N-

### TRACT-14 · After a load, focus that fell to the page goes back where it was, else to Try again, else to the search

- **Rule:** A load disables the controls and may remove the button pressed. If focus fell to the page or onto a disabled control, it returns to the remembered element when it can take focus, else to Try again when a failure shows it, else to the search field. Any other re-render moves nothing.
- **Kind:** behaviour
- **Level:** browser — focus
- **Source:** deviation `t1-focus-after-load.md`
- **Expected:** "Try again" pressed and the retry succeeds → focus on the search field. Retry fails again → focus on "Try again". Focus on Cingulum · left while its download disables it → focus back on it, checked.
- **Covered by:** `src/features/tracts/TractsExplorer.svelte.test.ts` (R)

## Display settings and export

### TRACT-15 · The closed settings still say what they hold: opacity and the length filter

- **Rule:** The "Tract display" disclosure is closed by default; its summary reads the opacity and the minimum length, following the minimum slider as it moves. Open, the controls speak for themselves.
- **Kind:** behaviour
- **Level:** unit — the readout; the disclosure in the browser
- **Source:** `viewer/diffusion/controls.js:118-121`; `viewer/diffusion/native-ui.js:228-238`
- **Expected:** `settingsReadout(0.16, 1, 'en')` = "16% · ≥1 mm"; `(1, 40, 'fr')` = "100 % · ≥40 mm"; `(0, 250, 'en')` = "0% · ≥250 mm"; `(0, 250, 'fr')` = "0 % · ≥250 mm". Closed by default, summary "16% · ≥1 mm" (FR "16 % · ≥1 mm"); opened → the readout is hidden.
- **Covered by:** `src/lib/core/tracts.test.ts` (R); `src/features/tracts/TractsExplorer.svelte.test.ts` (R)

### TRACT-16 · The opacity slider sets the cortex on the tracts' own anatomy, and the reference outline elsewhere

- **Rule:** On the tracts' own anatomy the slider is "Cortex opacity" and sets the page's cortex opacity; there a checkbox "Keep tracts on other tabs" keeps the ticked bundles drawn after Tracts is left. On another anatomy the slider is "Brain outline opacity" and sets the reference brain outline; there is no keep checkbox and a note says the tracts come from a different subject. Sliders are named by their label alone and carry their value as text.
- **Kind:** behaviour
- **Level:** browser — slider keys and engine calls
- **Source:** `viewer/diffusion/native-ui.js:228-233`; deviation `u4-slider-readout-not-in-name.md`
- **Expected:** Own anatomy, ArrowRight from 0.16 → `onCortexOpacity(0.18)`, no `setOutlineOpacity`; Home → 0, End → 1. `aria-valuetext` "16%" and "1 mm"; two `output[aria-hidden=true]`. Other anatomy: no overlay checkbox, "Brain outline opacity" "16%", ArrowLeft → `setOutlineOpacity(0.14)`, text "uses a different subject" visible. Overlay checkbox click → `setOverlay(true)`, again → `setOverlay(false)`.
- **Covered by:** `src/features/tracts/TractsExplorer.svelte.test.ts` (R)

### TRACT-17 · The minimum length runs from 1 to 250 mm in 1 mm steps; dragging previews, letting go applies

- **Rule:** The minimum-length slider spans 1–250 mm by 1 mm. While dragged it updates its value text and the summary only; on release (or each key press) it applies the filter. What the filter keeps is the engine's rule (DIFF-).
- **Kind:** behaviour
- **Level:** browser — `input` versus `change`
- **Source:** `viewer/diffusion/native-ui.js:55,234-239`; deviation `t1-minimum-length-config.md`; decision 42 on #4
- **Expected:** `MINIMUM_LENGTH` = `{min 1, max 250, step 1}`. `input` at 40 → `aria-valuetext` "40 mm", no `setMinimum`; `change` → `setMinimum` `[[40]]`, then "3 of 4 streamlines". End → 250; PageDown → < 250; Home → 1; PageUp → > 1, each applied. In the app: ArrowRight from 1 → "2 mm".
- **Covered by:** `src/features/tracts/TractsExplorer.svelte.test.ts` (R)

### TRACT-18 · Restore returns the drawn tracts to the catalog's initial bundles, and says so

- **Rule:** "Restore default tracts" sets every loaded bundle's visibility back to the catalog's initial set and nothing else, says "Default tracts restored.", and keeps focus on the button.
- **Kind:** behaviour
- **Level:** browser — focus and the announcer
- **Source:** `viewer/diffusion/native-ui.js:240-245`; deviation `t1-restore-export-announced.md`; decision 42 on #4 (Restore resets only tract visibility)
- **Expected:** Uncheck af-left, check af-right → drawn `['af-right', 'cst-right']`; Restore → `['af-left', 'cst-right']`, focus on Restore, announcer "Default tracts restored.".
- **Covered by:** `src/features/tracts/TractsExplorer.svelte.test.ts` (R)

### TRACT-19 · The lengths CSV has one quoted, formula-safe row per loaded bundle, in English, with LF line ends

- **Rule:** Export downloads `planum-streamline-lengths.csv` (`text/csv;charset=utf-8`): a fixed header, then one row per loaded bundle with its English name quoted (inner quotes doubled, a leading `= + - @` prefixed by `'`), total streamlines, streamlines shown (0 when hidden), the applied minimum, and mean, min and max (blank when none shown). Lines end with `\n`, the file ends with one, and there is no byte-order mark. The export says "Lengths CSV exported.". The values are the engine's (DIFF-).
- **Kind:** data
- **Level:** unit — the builder; e2e for the real download
- **Source:** `viewer/diffusion/controls.js:123-135`; decisions 29 and 42 on #4
- **Expected:** Header `bundle,total_streamlines,enabled_streamlines,minimum_length_mm,mean_length_mm,min_length_mm,max_length_mm`. At minimum 40: `"Arcuate · left",1234,1000,40,142.25,75,239.5`; `"'=SUM(A1)",…`; `"'+x"`, `"'-x"`, `"'@x"`; hidden `"He said ""hi"", left",1234,0,40,,,`; at 250 with shown 0 → `"Arcuate · left",1234,0,250,,,`; no `\r`; not starting with U+FEFF. In the app at minimum 1 the first row is af-left, `"Arcuate fasciculus · left",3639,3639,1,…` (3,639 streamlines per DIFF-).
- **Covered by:** `src/lib/core/tracts.test.ts` (R) (the builder, the file name and MIME type, one row per catalog bundle); `src/features/tracts/TractsExplorer.svelte.test.ts` (R, the file name, a `blob:` link and the announcement)

## Notes and the MRI command

### TRACT-20 · The notes say where the tracts come from, and their links say they open a new tab

- **Rule:** "About this data" opens on the notes: the tracts are in their own T1 reference brain; on the tracts' own anatomy, the linked MRI uses the same scan; on another anatomy, the brain outline is MRI-derived and its provenance is linked. The tracts' methods page is linked last, marked `hreflang="en"`. Each link's name ends with "(opens in a new tab)" and it opens in a new tab.
- **Kind:** behaviour
- **Level:** browser — link names
- **Source:** `viewer/diffusion/native-ui.js:60-76`; deviation `t1-new-tab-cue.md`
- **Expected:** Own anatomy: "Tracts in their own T1 reference brain." visible; link "Dataset source · CC0 (opens in a new tab)" with `target=_blank`; link "Method and limits (opens in a new tab)" to `/docs/features/tracts.html`; no "Brain outline method" link; "The linked MRI uses the same scan" visible. Other anatomy: "MRI-derived brain outline" and link "Brain outline method and provenance" visible; no linked-MRI note.
- **Covered by:** `src/features/tracts/TractsExplorer.svelte.test.ts` (R)

### TRACT-21 · The dock holds one command, "MRI with tracts"

- **Rule:** The foot of the panel holds only the "MRI with tracts" button (FR "IRM avec faisceaux"), which opens the navigator by click, Enter or Space.
- **Kind:** behaviour
- **Level:** browser — keyboard activation
- **Source:** `viewer/diffusion/native-ui.js:70-76`
- **Expected:** `.dock` holds one button and no `.nii` file name; click → `onOpenMri` once; Enter then Space → twice.
- **Covered by:** `src/features/tracts/TractsExplorer.svelte.test.ts` (R)

### TRACT-22 · Keyboard order and a language switch keep the reader's place

- **Rule:** In the open settings, Tab walks the overlay checkbox, Cortex opacity, Minimum length, Restore, Export, then About. Enter and Space open and close each disclosure and keep focus on its summary. A language switch keeps the search text, the open sections and the focused key, and says nothing.
- **Kind:** behaviour
- **Level:** browser — sequential focus
- **Source:** decision 42 on #4 (the Tab stops are kept as legacy)
- **Expected:** Tab order from the settings summary: "Keep tracts on other tabs", "Cortex opacity", "Minimum length (mm)", "Restore default tracts", "Export lengths CSV", "About this data". Two summaries, each Enter → open, Space → closed, focus on it. "cing" typed, focus on Cingulum · left, switch to French → value "cing", settings open, focus on "Cingulum · gauche", announcer "".
- **Covered by:** `src/features/tracts/TractsExplorer.svelte.test.ts` (R)

### TRACT-23 · Keys and controls are large enough for the pointer in use

- **Rule:** With a fine pointer, keys, the dock button and summaries are at least 24 px and the sliders 24 px. With touch, the keys, the clear button, the summaries, the sliders and the quiet buttons are at least 44 px, the overlay checkbox 20 px. On a short landscape window the keycap hides, the clear button is 36 px and the search text 16 px.
- **Kind:** accessibility
- **Level:** browser — layout under emulated pointers
- **Source:** WCAG 2.5.8; `viewer/styles` (tracts panel)
- **Expected:** Fine: every key ≥ 24 × 24, `.dock button` and `summary` height ≥ 24, every range height 24. Touch: listed heights ≥ 44, `.check input` 20. 740 × 400: `.search-shortcut` `display: none`, search font 16px, clear 36 × 36.
- **Covered by:** `src/features/tracts/TractsExplorer.svelte.test.ts` (R)

### TRACT-24 · The panel reflows without clipping, and a focused key is never under the dock

- **Rule:** At 320 px nothing scrolls sideways and no name is cut off; the WCAG 1.4.12 spacing clips nothing. On a phone the list scrolls between a pinned head and dock, and every Tab stop lands between them, at least 24 px clear of the dock after a scroll.
- **Kind:** accessibility
- **Level:** browser — layout and focus scroll
- **Source:** WCAG 1.4.10, 1.4.12, 2.4.11
- **Expected:** 320 × 700: document `scrollWidth ≤ 320`; `.body` and every `.name`, `.meta`, `.values` `scrollWidth ≤ clientWidth + 1`. 390 × 700: list scrolls; 30 Tab stops each between the head's bottom and the dock's top (±0.5), and ≥ 24 px above the dock when the list scrolled.
- **Covered by:** `src/features/tracts/TractsExplorer.svelte.test.ts` (R)

### TRACT-25 · Forced colours, more contrast and reduced motion keep the keys and chevrons readable

- **Rule:** In forced colours a drawn key and an undrawn key differ in fill; with more contrast a key's edge is the control-edge colour; with reduced motion the disclosure chevron does not turn.
- **Kind:** accessibility
- **Level:** browser — CSS computed style
- **Source:** `viewer/styles/a11y.css:8-14`
- **Expected:** `forced-colors: active` → af-left background ≠ af-right background. `prefers-contrast: more` → af-right `border-top-color` = the computed `--border-control`. `prefers-reduced-motion: reduce` → summary `::after` `transition-duration: 0s`.
- **Covered by:** `src/features/tracts/TractsExplorer.svelte.test.ts` (W, the forced-colours case checks only that the two fills differ, not Highlight and Canvas)

### TRACT-26 · axe finds nothing in the Tracts panel

- **Rule:** With the settings and the notes open, the panel has no axe violation in light and dark, at desktop and phone width, in English and French, and in the assembled app.
- **Kind:** accessibility
- **Level:** browser — axe
- **Source:** WCAG 2.2 AA
- **Expected:** `expectAxeClean()` with no violations in English (both themes, 1280 and 390 px) and one run in French (light, 1280 px); `expectAccessible('tracts')` in the app.
- **Covered by:** `src/features/tracts/TractsExplorer.svelte.test.ts` (R)

## The MRI navigator (retired)

TRACT-27 to TRACT-49 described the NiiVue "MRI with tracts" dialog, removed on 2026-11-12. Its button now
opens the Linked MRI, which draws the tracts and FA: SECT-34 to SECT-36.

## A tract's profile (supervisor review 4.3)

### TRACT-50 · A tract's name opens its profile under "‹ Tracts", data first and the method last

- **Rule:** In the Tracts tab of an anatomy with its own tracts, a row's name is a drill button (chevron on hover, focus and touch, as other mode lists show it); its L/R or segment keys keep toggling what is drawn. Pressing the name lets go of any selected region, opens the detail under the workspace's "‹ Tracts" location bar and moves focus to the profile's 24px name. The profile reads: the name; per side or segment, its streamline count "in this tracking run" (half its ends), with its lengths once drawn; "Where its streamlines end": the Destrieux regions of this brain holding at least 5% of the ends within 3 mm, largest first; "MRI with tracts"; then how the ends were counted, saying a streamline count does not measure connection strength. No related-deficits row until `data/neuropsychology.yaml` gains a curated `tracts:` field. Back returns to the list with the row marked current.
- **Kind:** behaviour
- **Level:** browser (composed app over the fake engine)
- **Expected:** corticospinal tract → focus on "Corticospinal tract"; runs "Left: 731 streamlines in this tracking run", "Right: … streamlines in this tracking run"; first end "Precentral gyrus"-named `destrieux:left:29` at 18%; the profile's last three children are the ends, the primary command, the note; Back → list shown, the name `aria-current="true"`.
- **Covered by:** `src/app/regions/PanelsRegion.svelte.test.ts` (R)

### TRACT-51 · A region picked on the stage takes the detail from the profile

- **Rule:** The profile shows only while no region is selected; a stage pick shows that region's detail instead.
- **Kind:** behaviour
- **Level:** browser
- **Expected:** profile of the arcuate open, pick `destrieux:left:30` → no `.tract-profile`, the region's heading shown.
- **Covered by:** `src/app/regions/PanelsRegion.svelte.test.ts` (R)

### TRACT-52 · The published ends cover exactly the catalog's bundles and are the layer run again

- **Rule:** `public/diffusion/cdmd-sub-013/tract-ends.json` (`brain_model/layers/tract_ends.py`, `config/tract-ends.yaml`) holds every bundle of the catalog and no other; each count of ends is even; recomputing it from the committed streamlines and `data/cdmd/mri/aparc.a2009s+aseg.mgz` gives the same file; the left corticospinal tract ends most on the precentral gyrus.
- **Kind:** data
- **Level:** unit; pytest
- **Expected:** `tractEnds(cdmd)` keys = bundle ids; a catalog missing one → throws "do not match its bundles"; `tests/test_tract_ends.py` passes (ball of 123 voxels at 3 mm, shares over all ends, edge refused, published = recomputed).
- **Covered by:** `src/lib/core/diffusion/ends.test.ts`; `tests/test_tract_ends.py`

### TRACT-53 · A tick ends a standing notice

- **Rule:** Ticking or clearing a bundle's key is the reader's next action, so the list tells the page (`onTick`) and a standing notice ("Previous view restored.") goes, as a display change ends one.
- **Kind:** behaviour
- **Level:** browser
- **Source:** `web/src/features/tracts/TractsExplorer.svelte`; `web/src/features/workspace/ListView.svelte`; live-site review 2026-11-11
- **Expected:** Space on "Cingulum · left" twice → checked then cleared, `onTick` called twice.
- **Covered by:** `src/features/tracts/TractsExplorer.svelte.test.ts` (R, "each tick or clear is told…")
