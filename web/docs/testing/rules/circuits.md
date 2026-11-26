# Circuits (guided lessons) rules

Scope: chunk X3 (#58), the Circuits tab: the list of guided circuits, the lesson's landmark profile, the stepper in the location bar, the landmark sequence and the four notes, the related circuits under a selected region, the busy and failure states, the step announcement and the lesson's Linked MRI entry point. Legacy sources: `viewer/ui/panels/circuits.js`, `index.html:309-312,335,341-342,423`; `viewer/learning/*` for the lesson model. New code: `web/src/features/circuits/` (`circuits-view.ts` is the view-model, `circuits-explorer.svelte.ts` the state and commands, `neighbour-keys.ts` the arrow keys; `CircuitList`, `CircuitProfile`, `CircuitStatus`, `CircuitStepper`, `CircuitNotes`, `RelatedCircuits` draw them). Deviations: `x3-busy-keeps-focus.md`, `x3-current-circuit.md`, `x3-disclosure-state.md`, `x3-label-in-name.md`, `x3-list-structure.md`, `x3-no-landmarks.md`, `x3-status-always-mounted.md`, `x3-step-announcement.md`; decisions 9, 13, 37 and 40 on #4.

The lesson commands are in `controller.md` and are not repeated here: opening a lesson and framing its landmark (LESSON-01 to LESSON-03), a related lesson (LESSON-04), stepping (LESSON-05), the landmark in front (LESSON-06), uncovering and sides (LESSON-07), leaving (LESSON-08) and the lesson's Linked MRI (LESSON-09, LESSON-10). The circuit catalogue (`data/circuits.yaml`: landmarks, covering regions, references, validation) is in `core-catalogs.md`; `stepProgress`, `stepperTargets`, `involved` and the busy runner are in `core-panels.md`; a link that carries `circuit=` and `step=` is in `links.md`. The published catalogue (revised 2026-10-24) has 9 circuits with 39 landmarks: `vision` 4, `memory` 5, `motor` 6, `hearing` 3, `touch` 3, `language` 4, `attention` 3, `cerebellar` 5, `praxis` 6. Copy quoted is the English interface text (`web/src/lib/core/i18n/areas/circuits.ts`).

## The list

### CIRC-01 · The list offers every guided circuit with its landmark count, and the scope sums the landmarks

- **Rule:** The list shows each circuit as a row with its name and its number of landmarks; the count's noun is read, not shown. Under the list a note counts the circuits and their landmarks, the landmarks counted as the rows count them (the sum of every circuit's steps).
- **Kind:** data
- **Level:** unit (view-model: `landmarkTotal`)
- **Source:** `viewer/ui/panels/circuits.js:150-165`
- **Expected:** `landmarkTotal` of three circuits with 3, 2 and 1 steps → 6; of none → 0. On the published catalogue the note reads "9 guided circuits · 39 landmarks" (FR "9 parcours guidés · 39 repères"); rows named "Visual pathway , 4 landmarks" (FR "Voie visuelle , 4 repères") and "Memory landmarks , 5 landmarks".
- **Covered by:** `src/features/circuits/circuits-view.test.ts` (R); `src/features/circuits/circuits.svelte.test.ts` (R; the totals re-derived from the catalogue)

### CIRC-02 · The list is a labelled group of a real list, and a row's name contains what it shows

- **Rule:** The list is a `role="group"` named "Guided learning" over a `ul` of `li` buttons. The count column and the chevron are hidden from assistive technology. The visible words of a row are contained, in order, in its accessible name.
- **Kind:** accessibility
- **Level:** browser — DOM semantics and accessible names
- **Source:** `viewer/ui/panels/circuits.js:150-161,328`; deviation `x3-list-structure.md`; WCAG 2.2 SC 2.5.3
- **Expected:** `getByRole('group', {name: 'Guided learning', exact: true})` with 9 `ul > li > button`; `.group-count` and `.chevron` `aria-hidden="true"`; for every row the normalised name contains the normalised visible text.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R)

### CIRC-03 · The list is shown only on the Circuits tab

- **Rule:** The list is hidden while another tab is in front.
- **Kind:** behaviour
- **Level:** browser — visibility
- **Source:** `viewer/ui/panels/circuits.js:323`
- **Expected:** explorer `anatomy` → `.browser` not visible.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R)

### CIRC-04 · The arrow keys walk the rows without wrapping; every row stays a Tab stop

- **Rule:** ArrowDown and ArrowUp move to the next or previous row and stop at the ends. Keys with Alt, Ctrl, Meta or Shift are left to the browser. Every row is a Tab stop. The `/` key (KEY-09) puts focus on the first circuit.
- **Kind:** behaviour
- **Level:** browser — key dispatch and focus
- **Source:** `viewer/ui/panels/circuits.js:304-314,345`; deviation `u6-list-nav-modifier-keys.md`; decision 37 on #4
- **Expected:** row 0, Tab → row 1; ArrowUp → row 0; ArrowUp → row 0; ArrowDown × 2 → row 2; last row, ArrowDown → still the last. Shift+ArrowDown → focus unchanged; Alt+ArrowDown → not prevented. `focusFirst()` → row 0 focused.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R)

## Opening a lesson

### CIRC-05 · Opening a circuit marks its row current and puts its first landmark's title in focus

- **Rule:** Pressing a circuit opens its lesson (LESSON-01). The row becomes the one `aria-current="true"` row (it opens a lesson, it does not toggle, so no `aria-pressed`) and the workspace's current item. The profile shows the circuit's name as a visually hidden `h2`, the landmark's name as an `h3` that takes focus, its role and explanation, and the stepper shows "Landmark 1 of N".
- **Kind:** behaviour
- **Level:** browser — focus
- **Source:** `viewer/ui/panels/circuits.js:167-196,281-289,330-335`; deviation `x3-current-circuit.md`; decision 40 on #4
- **Expected:** `vision` → `[data-circuit=vision]` `aria-current="true"`, no `aria-pressed`, the only current row; `currentItem()` that row; title `h3[data-circuit-title]` `tabindex=-1`, focused, "Optic chiasm"; hidden `h2` "Visual pathway"; `.circuit-role` = step 0's role; progress "Landmark 1 of 4" (FR "Repère 1 sur 4"). Then `memory` → `vision` not current, "Landmark 1 of 5".
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R)

### CIRC-06 · A landmark on its own region names its side and group; elsewhere the profile offers the way back

- **Rule:** While the selected region is the current landmark's, the profile names its hemisphere and its group under the title. Once the reader selects another region, the side and group leave and the profile says "You are exploring another region." with a "Return to landmark" button, which opens the current step again (not the first), selects its region and puts focus on the title.
- **Kind:** behaviour
- **Level:** unit (view-model: `landmarkSelected`) for the condition; browser for the focus
- **Source:** `viewer/ui/panels/circuits.js:102-110,185-195`
- **Expected:** `vision` open → `landmarkSelected` true; `.circuit-context` with 2 `dt` (visually hidden "Hemisphere", "Lobe / System") and a non-empty group `dd`; no Return. Next, then select another structure → `landmarkSelected` false, no context, the note text; Return (Enter) → step still 1, selected region = step 1's region, no Return, focus on the title.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R)

## The stepper

### CIRC-07 · The stepper is Previous, the place and Next; an end control leaves rather than greys out

- **Rule:** The stepper is a group named "Landmarks" holding "Previous landmark", the place in the lesson ("n of N", read as "Landmark n of N") and "Next landmark", each control with the same tooltip. At an end the control that has nowhere to go is hidden. A fixed three-column grid keeps the place still.
- **Kind:** behaviour
- **Level:** browser — names and `hidden` (the targets are `stepperTargets`, unit in `core-panels.md`)
- **Source:** `viewer/ui/panels/circuits.js:74-100`
- **Expected:** `vision` step 0 → `.circuit-stepper` `role="group"`, `aria-label` "Landmarks"; Previous hidden; Next shown, `aria-label` and `data-tooltip` "Next landmark"; Previous `aria-label` "Previous landmark".
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R)

### CIRC-08 · Next and Previous keep focus, and the view follows the landmark

- **Rule:** After Next or Previous the pressed control keeps focus so it can be pressed again; when it has left (an end), focus goes to the other one. The profile is back at its top and the landmark's region is selected.
- **Kind:** behaviour
- **Level:** browser — focus and scroll
- **Source:** `viewer/ui/panels/circuits.js:281-289`
- **Expected:** `hearing`, Next (Enter) → title step 1, focus on Next, "Landmark 2 of 3"; Enter → step 2, Next hidden, focus on Previous; Enter → step 1, focus on Previous. Profile scrolled to 40 px, Next → `scrollTop` 0, selected region = step 1's region.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R)

### CIRC-09 · A busy stepper control has no hover fill

- **Rule:** While a run is in flight, hovering a stepper control does not draw its hover background.
- **Kind:** accessibility
- **Level:** browser — computed CSS
- **Source:** deviation `x3-busy-keeps-focus.md`
- **Expected:** Next held, hover Next → `background-color: rgba(0, 0, 0, 0)`.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R)

## The landmark sequence and the notes

### CIRC-10 · The sequence lists every landmark in order and marks the current and the seen ones

- **Rule:** Below the landmark's data, a "Landmarks" heading labels an ordered list (`role="list"`) with one button per landmark: its number and name. The current landmark is `aria-current="step"`; a landmark already seen carries a visually hidden ", seen"; seen, current and ahead differ in shape as well as in ink.
- **Kind:** accessibility
- **Level:** browser — roles and accessible names (the progress states are `stepProgress`, unit in `core-panels.md`)
- **Source:** `viewer/ui/panels/circuits.js:47-72,198-205`; deviation `x3-list-structure.md`
- **Expected:** `hearing` → `ol[role=list]` labelled by `.landmarks-heading`; progress `current, upcoming, upcoming`; only row 0 `aria-current="step"`; row 0 number "1". Next → `visited, current, upcoming`; row 0 text ends ", seen"; row 1 has no "seen"; row 0 no `aria-current`.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R)

### CIRC-11 · A landmark row opens that landmark with its title in focus; the arrows walk the sequence

- **Rule:** Pressing a landmark in the sequence opens that step (LESSON-05) and puts focus on the title. ArrowDown and ArrowUp walk the sequence's buttons only and stop at its ends.
- **Kind:** behaviour
- **Level:** browser — focus and key dispatch
- **Source:** `viewer/ui/panels/circuits.js:281-302,304-314`
- **Expected:** `hearing`, row 2, Enter → step 2, focus on the title, title = step 2's name. Row 0, ArrowDown → row 1; ArrowDown × 2 → row 2; row 0, ArrowUp → row 0.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R)

### CIRC-12 · Four notes follow the sequence, with one command to the circuit's deficit

- **Rule:** After the sequence come four disclosures: "Connections and scope" (the circuit's summary, route, scope and the schematic caveat), "What this atlas shows" (the step's mapping and the MRI note), "Clinical context" (the circuit's clinical text, "Open deficit evidence" and the reference-anatomy note) and "Sources". The only command among them is "Open deficit evidence", which opens the circuit's deficit through the Deficits tab's entry point.
- **Kind:** behaviour
- **Level:** browser — the press (the content is catalogue data)
- **Source:** `viewer/ui/panels/circuits.js:198-226,294`
- **Expected:** `hearing` → summaries in order "Connections and scope", "What this atlas shows", "Clinical context", "Sources"; buttons outside the sequence: "Open deficit evidence" only; pressing it → the Deficits entry point called once with `word-deafness`. Schematic note "Schematic relationships · not measured connectivity or tractography".
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R)

### CIRC-13 · Sources link out in a new tab, and say so, with the date the content was checked

- **Rule:** Each of the circuit's references is a link to its URL in a new tab with `rel="noreferrer"`, followed by its citation; the note ends with "Content checked: <date>". The link says in words that it opens a new tab (decision 17's shared text, `link.newTab`).
- **Kind:** accessibility
- **Level:** browser — link attributes
- **Source:** `viewer/ui/panels/circuits.js:207-218`; decision 17 on #4; X3's request 5 on #4 (comment 71); deviation `x3-new-tab-cue.md`
- **Expected:** `hearing`, Sources open → the links' `href`s are the circuit's reference URLs in order, each `target="_blank"`, `rel="noreferrer"`; "Content checked: 2026-10-24". Each link contains the visually hidden "(opens in a new tab)" (FR "(s’ouvre dans un nouvel onglet)").
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R: links and date). The spoken new-tab cue landed in #136 (deviation `x3-new-tab-cue.md`) and is R-covered there ("each source link says it opens a new tab, in its name and with the icon").

### CIRC-14 · A note the reader opened stays open as the lesson moves on

- **Rule:** The notes' open state is the reader's: it is kept while the lesson moves between landmarks and starts closed again with the next lesson.
- **Kind:** behaviour
- **Level:** browser — `<details>` state across renders
- **Source:** `viewer/ui/panels/circuits.js:198-226`; deviation `x3-disclosure-state.md`; decision 40 (bug 7) on #4
- **Expected:** `hearing`, open Sources → open; Next → still open; open `vision` → closed.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R)

## Related circuits

### CIRC-15 · Outside the Circuits tab, a landmark's region lists the lessons that pass through it

- **Rule:** Outside the Circuits tab, when the selected region is, holds or lies in a landmark, the region inspector lists "In guided circuits": one row per landmark, in catalogue order, each with the circuit's name and the landmark's place. A row is named by its visible words followed by a hidden ", Landmark". A region in no circuit, or the Circuits tab in front, shows no list. The heading labels the list and it is not a landmark.
- **Kind:** behaviour
- **Level:** unit (view-model: `relatedLandmarks`) for the rows; browser for names
- **Source:** `viewer/ui/panels/circuits.js:229-257`; deviations `x3-label-in-name.md`, `x3-list-structure.md`, `x3-no-landmarks.md`
- **Expected:** `relatedLandmarks` with regions {thalamus} over circuits (chiasm, thalamus, cortex), (hippocampus, thalamus), (cochlear-nucleus) → [vision 1, memory 1]; {hippocampus, chiasm, unrelated} → [vision 0, memory 0]; {cerebellum} or {} → []. On the app: `vision` open, Anatomy tab → a button named "Visual pathway 1 of 4 , Landmark" under `h3` "In guided circuits", its name starting with its visible words; on the Circuits tab → no `.related`; a structure in no circuit → no `.related`.
- **Covered by:** `src/features/circuits/circuits-view.test.ts` (R); `src/features/circuits/circuits.svelte.test.ts` (R)

### CIRC-16 · A related row opens that lesson at its own landmark, in the Circuits tab

- **Rule:** Pressing a related row opens the lesson on that landmark in the Circuits tab (LESSON-04), not on its first one, and puts focus on the title.
- **Kind:** behaviour
- **Level:** browser — focus
- **Source:** `viewer/ui/panels/circuits.js:295-296`
- **Expected:** select `memory`'s last landmark on Anatomy, press its row → lesson `{circuit: 'memory', step: 4}`, title = step 4's name. From `learning:midline:optic-chiasm` → explorer `circuits`, title "Optic chiasm", focused.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R)

## Runs in flight

### CIRC-17 · While a run is in flight every control stays focusable, says so and refuses

- **Rule:** While a landmark or the lesson's MRI opens, every control of the tab (rows, stepper, sequence, Return, the deficit command, related rows) carries `aria-disabled="true"`, stays focusable and is not natively disabled; a second run is refused. Focus stays on the control pressed. The profile and the notes are `aria-busy`. The status line says "Opening landmark…" and empties when the run ends.
- **Kind:** accessibility
- **Level:** browser — focus; the refusal is unit (the busy runner)
- **Source:** `viewer/ui/panels/circuits.js:137-148,259-279,293`; deviation `x3-busy-keeps-focus.md`; decision 40 (bug 2) on #4
- **Expected:** `hearing`, Next held → status "Opening landmark…", `busy` true; every visible button (more than 6) `aria-disabled="true"`, `disabled` false; focus on Next; Enter, a sequence row, a circuit row and the deficit command → one step opened, no deficit opened; `.circuit-profile` `aria-busy="true"`. Released → `busy` false, status '', step 1. During `openMri` → the related row `aria-disabled="true"`, then none.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R)

### CIRC-18 · An opening overtaken by a newer scene command ends quietly

- **Rule:** If a newer scene command overtakes the opening (LESSON-03), the tab neither starts a lesson nor moves focus, does not throw, and is no longer busy.
- **Kind:** behaviour
- **Level:** unit (the explorer)
- **Source:** `viewer/ui/panels/circuits.js:281-289`
- **Expected:** `openCircuit('vision')` held, `begin()`, release → resolves `true`; lesson circuit null; `busy` false.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R; could move down)

### CIRC-19 · A failure is said on the status line, in view, and focus stays where it was

- **Rule:** When a run fails, the status line says what could not be done in the reader's words and in the error style, is scrolled into view on the Circuits tab, the error is logged and passed to the reload offer (CTRL-36), and focus stays on the control pressed. The lesson stays on its step. The next run clears the failure.
- **Kind:** behaviour
- **Level:** unit (the explorer's `status` and `failed`) for the wording; browser for the scroll and focus
- **Source:** `viewer/ui/panels/circuits.js:142-147,269-278`
- **Expected:** a plain failure → "Could not show this landmark."; `{code: 'asset-updated'}` → `errors.updated` ("A file on the server no longer matches this page; Planum has probably been updated. Reload to continue."), `data-error="true"`, notice action `reload`, focus on Next, step 0; next run → step 1, status '', `data-error="false"`. The status line below a 120 px panel's fold is scrolled to within it. The MRI failure → "Could not open the linked MRI.".
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R)

### CIRC-20 · The status line is in the page before it speaks, and a language switch does not repeat it

- **Rule:** The `role="status"` line is always mounted on the tab, empty and taking no room at rest; only its text changes. A language switch replaces the element, so the sentence in force is not announced again.
- **Kind:** accessibility
- **Level:** browser — element identity and layout
- **Source:** `viewer/ui/panels/circuits.js:146`; deviation `x3-status-always-mounted.md`; decisions 37 and 40 (bug 3) on #4
- **Expected:** at rest → `role="status"`, text '', not `hidden`, height 0. After a failure, language `fr` → the old element disconnected, the new one reads "Impossible d’afficher ce repère." (the French `operations.landmark`).
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R)

### CIRC-21 · A landmark opened on the region already selected is announced

- **Rule:** After a landmark opens, if the selected region is the one selected before (Return, or the current row of the sequence), the page announcer says the landmark's place and name. When the region changes, the selection sentence is enough and the tab says nothing more.
- **Kind:** accessibility
- **Level:** unit (the explorer's `announceStep`) for the sentence; browser for the announcer
- **Source:** deviation `x3-step-announcement.md`; decision 40 (bug 5) on #4
- **Expected:** `hearing` step 0, press sequence row 0 → "Landmark 1 of 3: Left inferior colliculus central nucleus" (FR "Repère 1 sur 3: <French name>"). Sequence row 1 → announcer ''.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R)

### CIRC-22 · The lesson's Linked MRI runs under the tab's busy run

- **Rule:** The tab's `openMri` is the controller's `panels.openMri` (decision 9): the landmark's Linked MRI opens the lesson's prepared plane (LESSON-09) with the tab's progress and failure text; while it runs the controls refuse and a second MRI run is refused.
- **Kind:** behaviour
- **Level:** unit (the explorer) for the refusal and wording; browser for the status line
- **Source:** `viewer/ui/panels/circuits.js:343-344`; decision 9 on #4
- **Expected:** `hearing`, `openLinkedMri({atRegion: true})` → `openPreparedPlane` called once with step 0's plane; `busy` false after. Held → status "Opening landmark…", Next `aria-disabled="true"`, a second `openMri()` → `false`; released → `true`, status ''. Rejects → `false`, status "Could not open the linked MRI.", `data-error="true"`.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R)

## Language and accessibility checks

### CIRC-23 · The lesson profile and the related list are not landmarks

- **Rule:** The profile and the related section are plain blocks under their headings; the panel's `<aside>` is the one landmark.
- **Kind:** accessibility
- **Level:** browser — roles
- **Source:** `index.html:341,423`; `viewer/ui/panels/circuits.js:167-257`; deviation `x3-no-landmarks.md`; decision 13 on #4
- **Expected:** no `section` or `[role=region]` inside `.circuit-profile` or `.related`; `getByRole('region')` count 0 with a lesson open.
- **Covered by:** uncovered (only indirectly by axe's landmark rules in CIRC-24)

### CIRC-24 · axe finds nothing in the list, a lesson, another region, a run or a failure

- **Rule:** The list, an open lesson with Sources open, the reader on another region, a run in flight and a failure have no axe violations, in both languages and themes and at 1280 and 390 px, and with more contrast.
- **Kind:** accessibility
- **Level:** browser — axe
- **Source:** decision record #58
- **Expected:** `expectAxeClean()` → no violations in each state.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R; the full theme × width matrix in each of 5 states × 2 languages, see the audit's slow tests)

### CIRC-25 · In forced colours the open circuit, the progress shapes and the focus ring stay visible

- **Rule:** With forced colours, the open circuit's row has a solid outline, the step numbers keep their colours, seen and ahead differ by fill, and a control reached by keyboard has a solid focus ring.
- **Kind:** accessibility
- **Level:** browser — computed CSS
- **Source:** decision record #58
- **Expected:** `hearing` step 1, `forced-colors: active` → the `hearing` row `outline-style: solid`; every `.circuit-step-number` `forced-color-adjust: none`; seen and ahead backgrounds differ; Tab from Previous → Next focused, `outline-style: solid`.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R)

### CIRC-26 · With a coarse pointer every target is 44 px

- **Rule:** With a coarse pointer, circuit rows, related rows, sequence rows, note summaries, the deficit command, Return and the stepper controls are at least 44 px tall, and the stepper controls at least 44 px wide.
- **Kind:** accessibility
- **Level:** browser — layout
- **Source:** WCAG 2.2 SC 2.5.5; decision record #58
- **Expected:** touch emulation at 390 × 844 → `.circuit-choice`, `.circuit-link`, `.circuit-step`, `summary`, `.command`, `.circuit-return button`, `.circuit-stepper .icon-button` height ≥ 44; Next width ≥ 44.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R)

### CIRC-27 · At 200 % text with WCAG 1.4.12 spacing nothing is clipped or overflows

- **Rule:** At 200 % text with the 1.4.12 spacing in a 320 px viewport, in French on the longest lesson with its notes open, no visible button, summary, heading, paragraph or description overflows sideways, no control clips its text, the page does not scroll sideways, and the stepper's place stays inside its grid. At a phone width with a lesson open the page does not scroll sideways. Each landmark's number stays inside its ring, which grows with the text (20 px at default text).
- **Kind:** accessibility
- **Level:** browser — layout
- **Source:** WCAG 2.2 SC 1.4.4, 1.4.10, 1.4.12
- **Expected:** `cerebellar`, French, three notes open, another region selected → every visible `button, summary, h2, h3, p, dd` `scrollWidth ≤ clientWidth + 1`; `button, summary` `scrollHeight ≤ clientHeight + 1`; root and `.circuit-stepper` `scrollWidth ≤ clientWidth + 1`. 390 px, `cerebellar`, French → page `scrollWidth − clientWidth = 0`.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R)

### CIRC-28 · The visual field map opens at its top with its title in focus

- **Rule:** Opening the map from its row or from a landmark brings the detail to its top and focuses the map's title once the map is drawn, as a lesson's landmark does (CIRC-05): the detail is shared, so it may stand where another profile left it, and the list's handoff would otherwise leave focus on Back. A link that opens the map on load moves no focus.
- **Kind:** behaviour
- **Level:** browser (component)
- **Source:** the 2026-11-12 interface review (Stroke cases scrolled 636 px, then the map opened 636 px down, past its title)
- **Expected:** `vision` at its map landmark, detail scrolled to 40 px, "Explore the visual field map" → `lesson.map` `visual-field`, focus on `#visual-field-title`, detail `scrollTop` 0.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R)

### CIRC-29 · The map's switch names the visual areas, off at first

- **Rule:** After the clicked cortex, a switch "Name the visual areas" outlines and names on the stage the 25 areas of the Wang et al. (2015) atlas. It is off at first, as names on the brain are, and keeps its state as the map closes and opens; the stage outlines the areas exactly while the map is open with the switch on, and says they are named only once their anchors are read and the switch has not been turned back meanwhile. Its note always says what the areas are and that no visual field position is predicted beyond V3. On, the panel adds the atlas's Dice with the predicted V1, V2 and V3 on the dot's hemisphere and a key entry for the borders. The atlas is cited among the sources, opening in a new tab. The clicked cortex's reading names the area there: after a V1–V3 reading, "Named area: V2v."; outside V1–V3, the area alone; outside every area, that it is outside them all.
- **Kind:** behaviour
- **Level:** browser (component); unit (store)
- **Source:** plan 2 WP32; `docs/features/visual-field-map.md` (Display)
- **Expected:** a small retinotopy record, dot upper right → switch `aria-checked="false"`, the note shown, no "Borders of the named visual areas". Click → store `areasNamed` true, "In the left hemisphere, the atlas’s V1, V2 and V3 overlap the predicted ones at Dice 0.72, 0.68 and 0.57." (FR "… avec un Dice de 0,72, 0,68 et 0,57."), the key entry; axe clean. Link "Visual areas (Wang et al. 2015) (opens in a new tab)" → `https://doi.org/10.1093/cercor/bhu277`, `target="_blank"`. Store: false at first; true after `nameAreas(true)` and `forgetReading()`. Map closed with the switch on → no `showAreas`; opened → `showAreas(true)`, `areasShown` false until the download resolves, then true; closed → `showAreas(false)`, `areasShown` false at once; on then off before the download → `areasShown` stays false. Reading V2 with area V2v → ends "The dot now shows it. Named area: V2v."; no reading, LO1 → "Left LO1: the template predicts no visual field position here."; neither → "That point is outside V1–V3 and every named visual area."; `forgetReading()` forgets the area.
- **Covered by:** `src/features/circuits/VisualFieldMap.svelte.test.ts` (R); `src/lib/state/visual-field-map.svelte.test.ts` (R)

### CIRC-30 · A circuit's diagram shows its landmarks as numbered boxes and the sign of each projection

- **Rule:** A lesson whose circuit has a diagram (CAT-70) shows it between the landmark list and the notes, headed "Excitation and inhibition" (French "Excitation et inhibition"). Each landmark is a box with its ringed number from the sequence and its short label, all boxes one size, no word split; its tooltip is the landmark's full name. A box opens its landmark as its row does and is marked current while that landmark is open, but unlike a row it stays where it stands in the panel and keeps focus, also when the notes are drawn again for the landmark (the box that took its place, found by its id `circuit-box-<landmark>`). Each projection is one segment in the track between its two boxes, ended at its target by an arrowhead where it excites and a bar where it inhibits, marked + or − beside the line, in a colour of its own (`--sign-excitatory`, `--sign-inhibitory`): the sign is never told by colour alone. The projections are read out as a list of sentences, and a legend names the two marks. The diagram's component is a chunk of its own, fetched when a circuit that has one first opens and kept after (BUILD-15). A circuit without a diagram shows none.
- **Kind:** behaviour; accessibility
- **Level:** browser (component; the detail view over the fake engine)
- **Source:** the reader comment of 2026-11-26; the user's review of the same day (a pressed box sent the panel back to its top); WCAG 2.2 SC 1.4.1, 1.4.10
- **Expected:** `motor`, whole route → boxes "1 Motor cortex", "2 Putamen", "3 GPi", "4 Thalamus", "5 GPe", "6 Subthalamic nucleus"; sentences "Motor cortex to Putamen: excitatory" … "Subthalamic nucleus to GPi: excitatory" (French "Cortex moteur vers Putamen : excitatrice" …, narrow no-break space before the colon); edges `excitatory down`, `inhibitory down`, `inhibitory down`, `inhibitory right`, `inhibitory down`, `excitatory left`; two end-mark paths and two computed colours, one per sign; axe clean. At 1280 and 390 px in French: the two sideways segments lie between their boxes' facing edges and the first downward one between its boxes' rows, each at least 24 px long; no box's text overflows; the page does not scroll sideways. No box is current on the route; a click on the fifth → step 4, that box alone `aria-current="step"`. Detail 320 px high, a box centred, pressed → that landmark, focus on the box, its top within 1 px of where it stood, the detail still scrolled; from the route and from a landmark; a row of the sequence still brings the detail to its top. In the app at 1280 × 520: the pressed box leaves the page with the route's notes, and the box under its id stands within 1 px of where it stood, in focus. After the diagram has shown, `vision` → no figure.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R); `src/features/workspace/DetailView.svelte.test.ts` (R)

### CIRC-31 · The maps come first in the Circuits list

- **Rule:** The list opens on its **Maps** group (the visual field map and the body map, each where the anatomy publishes it), then the guided circuits: below 45 circuits a reader would not find the maps. Arrow keys walk the maps on into the circuits without wrapping, and `/` still focuses the first circuit.
- **Kind:** behaviour
- **Level:** browser (component)
- **Source:** the user's review of 2026-11-26 (readers would not know the maps were at the bottom)
- **Expected:** the first row `data-map="visual-field"`, then every `data-circuit` row in order; from the map, Tab and ArrowDown → the first circuit; ArrowUp at the map → the map; the last circuit, ArrowDown → the last circuit; `focusFirst()` → the first circuit.
- **Covered by:** `src/features/circuits/circuits.svelte.test.ts` (R)

## Body map

### BODY-01 · An atlas's body map lies on its own cortex's vertices, codes 0 to 3, all of it or none

- **Rule:** `body-map-<atlas>.field` is laid on the loaded cortex as a thickness file is (THICK-03): region by region in the published order, one texel per vertex read by vertex index, through the mesh's own body-map slot. A code above 3, too few or too many bytes, or a cortex built without the slot refuse the file, and then no mesh carries any of it.
- **Kind:** behaviour
- **Level:** unit
- **Source:** the user's request of 2026-11-26
- **Expected:** Regions (a:left:1 ×3, a:right:1 ×2) and codes 1 2 3 0 2 → [1, 2, 3] and [0, 2], both ready; codes with a 4, four codes, or meshes without the slot → refused, none ready.
- **Covered by:** `src/lib/engine/model/body-map.test.ts` (R)

### BODY-02 · The published parts are foot, hand and tongue, coded 1 to 3

- **Rule:** The manifest's `body_map.parts` must be exactly foot 1, hand 2, tongue 3; anything else refuses the map. The parts take the deficits' first three finding colours.
- **Kind:** data
- **Level:** unit
- **Source:** this change
- **Expected:** colours (57, 135, 229), (213, 81, 129), (0, 131, 0); swapped codes, a missing part or another part → "The body map's parts are …".
- **Covered by:** `src/lib/core/learning/body-map.test.ts` (R)

### BODY-03 · The stage draws the body map exactly while it is open in front, on the part picked

- **Rule:** The map is drawn while Circuits is in front with the body map open, on the part the reader picked (every part at first, kept as the map closes and opens), and lifted otherwise. A view change that leaves both alone draws nothing again. A failed download is a notice, "Could not show the body map."; an anatomy without the map draws nothing.
- **Kind:** behaviour
- **Level:** unit (store, in the browser project)
- **Source:** this change
- **Expected:** open → `all`; hand chosen → `hand`; Anatomy in front → null; Circuits again → `hand`; the visual field map → null; a rejected download → one failure, "HTTP 503".
- **Covered by:** `src/lib/state/body-map.svelte.test.ts` (R); `src/lib/core/i18n/errors.test.ts` (R)

### BODY-04 · The body map opens in place of a lesson without a dot

- **Rule:** Only the visual field map has a dot: the body map opens without one and refuses one, and the visual field map needs one. A link opens `map=body-map` where the anatomy publishes it and drops a `dot` beside it.
- **Kind:** behaviour
- **Level:** unit
- **Source:** this change
- **Expected:** `openMap('body-map', dot)` → "has no dot"; `openMap('visual-field')` → "needs a dot"; `openMap('body-map')` after a lesson → `{ circuit: null, step: 0, visited: [], route: false, map: 'body-map' }`; `moveDot` → "No visual-field map is open". `#tab=circuits&map=body-map&dot=2,1,1` → `dot` rejected; without the map published → `map` rejected.
- **Covered by:** `src/lib/core/learning/session.test.ts` (R); `src/lib/core/state/link-check.test.ts` (R)

### BODY-05 · The cortex draws each part in its colour where it wins and grey off the map

- **Rule:** With the map on, a vertex coded 1–3 takes its part's colour and every other vertex the greyed cortex colour, lit as tissue is; with one part picked, the others' vertices go grey too. Off, the cortex keeps its own colour whatever its codes. The colour passes in premultiplied form through the varying thickness also uses, so thickness draws as it did, and the cortex as CDMD dresses it still links within 13 vertex attributes (SHADER-36).
- **Kind:** behaviour
- **Level:** browser (real WebGL)
- **Source:** this change
- **Expected:** each part's frame within 1e-3 of the same quad painted that colour; code 0 within 1e-3 of the grey; foot with the hand picked → grey; map off → tissue; thickness with and without the body-map channel within 1e-6, and more than 0.05 from tissue.
- **Covered by:** `src/lib/engine/render/body-map.svelte.test.ts` (R); `src/lib/engine/render/shader-programs.svelte.test.ts` (R)

### BODY-06 · The panel names the part shown, gives each part's area and says what the map leaves out

- **Rule:** The open map's panel offers All, Foot, Hand and Tongue as one radio group, All at first. Its table, which is also the key, gives each part's area on the strip per hemisphere with its colour. Its limits quote the record: the group's size, the floor's Cohen's d, the share of the foot's map off the strip as a range over the hemispheres, the motor and sensory banks not told apart, and the five movements. Its sources open in a new tab, the HCP data first. Nothing is drawn while another map or a lesson is open.
- **Kind:** behaviour; accessibility
- **Level:** browser (component)
- **Source:** this change
- **Expected:** rows Foot 1,350 mm², Hand 1,594 mm², Tongue 2,068 mm²; "64–73% of the foot’s map at that effect lies off the strip"; French "1 350 mm²" (narrow no-break space, then a no-break space) and "d de Cohen ≥ 0,5"; links NeuroVault 457, Barch, Van Essen, Wu; axe clean.
- **Covered by:** `src/features/circuits/BodyMap.svelte.test.ts` (R)

### BODY-07 · The open body map cites its papers, with the HCP acknowledgement

- **Rule:** While the body map is open, **References for this view** lists its task, project and registration papers under "Body map", and the HCP acknowledgement goes with the list.
- **Kind:** behaviour
- **Level:** unit
- **Source:** the HCP Open Access Data Use Terms
- **Expected:** `bodyMap barch`, `bodyMap vanessen`, `bodyMap wu`; `hcp` true, false with the map closed.
- **Covered by:** `src/lib/core/panels/citations.test.ts` (R)

### BODY-08 · The published map passes its gate on both brains, or is not built

- **Rule:** On each hemisphere of each brain: the parts' median heights run foot > hand > tongue and their distances from the midline the reverse; each part's largest connected piece holds at least 80% of its area; the foot wins most of the paracentral lobule's assigned area and the tongue most of the subcentral region's; each part covers at least 100 mm². The build refuses a brain that fails, and validation rebuilds the files byte for byte.
- **Kind:** data
- **Level:** pipeline
- **Source:** the gate of 2026-11-26 (`data/cache/hcp-motor/gate-strip-2026-11-26/gate.json`)
- **Expected:** CDMD left foot / hand / tongue heights 71.7 / 64.5 / 47.8 mm, pieces 0.969 / 0.990 / 1.0, paracentral 1.0 foot, subcentral 0.913 tongue; each criterion refuses a crafted failing hemisphere.
- **Covered by:** `tests/test_body_map.py` (S, R)

### BODY-09 · The body map opens in tissue colour, so a cut through it shows no other colouring

- **Rule:** Opening the body map holds the scene it found, then sets both hemispheres, no cut, an opaque cortex, the internal anatomy hidden, nothing selected, the view from above and the colour **Tissue**: a cut opened over the map then shows tissue on its faces, not an atlas's colours. Opened from the visual field map, it ends that map's medial pair. Leaving it puts the held scene back, colour included.
- **Kind:** behaviour
- **Level:** unit (controller)
- **Source:** the user's review of 2026-11-26 (a coronal cut over the map showed Destrieux colours on the cut gyri)
- **Expected:** from an axial cut, 0.3 opacity and atlas colour → `map: 'body-map'`, colour `tissue`, hemisphere both, opacity 1, internal hidden, nothing selected, cut off, view `superior`; one capture; leaving → that capture applied; from the visual field map → its medial pair ended.
- **Covered by:** `src/lib/controller/lesson.test.ts` (R)

