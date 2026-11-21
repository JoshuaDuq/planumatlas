# Assistive-technology audit (WP19)

Planum improvement plan 2, WP19, run on 2026-11-17 against `main` at `1c397b8b` with the plan's whole
implementation run in the working tree (names on the brain, highlights, embedding, larger saved images,
references for the view, the region table, cortical layers, F-TRACT peak delays, visual areas, the phone
sheet that no longer rises on a pick at peek). Findings are numbered AT-01 to AT-11 and recorded against
WCAG 2.2 AA. Severity: **High**, a task cannot be done by some readers; **Medium**, it can, but
information is missing or the way is unexpected; **Low**, friction or noise.

## What was tested, and how

- **Browser.** Chromium 156 (Playwright 1.64.1), headless, launched with `--use-angle=metal --enable-gpu
--ignore-gpu-blocklist` so the stage renders, against the Vite dev server. Throwaway scripts, not kept in
  the repository.
- **Keyboard alone.** Every journey below was driven with Tab, Shift+Tab, the arrows, Home/End,
  Page Up/Down, Enter, Space and Escape only (one exception, said where it applies: a `<select>`'s value
  was set by script, since a headless macOS select opens a native popup on the arrows). After each key the
  focused element was described (role, name, box, outline) and the live regions read.
- **What assistive technology receives.** The accessibility tree through CDP
  (`Accessibility.getFullAXTree`, and `getPartialAXTree` for single names): roles, names, states and order.
  `#announcer` was recorded by a `MutationObserver`, and so was every other `role=status`, `role=alert`
  and `aria-live` element, since several panels have their own.
- **Widths.** 1280 × 800 and 390 × 844 for every journey; the embed at 800 × 500 and 390 × 600.
- **Zoom and reflow.** Browser zoom was emulated by CSS viewport size: 200 % of 1280 × 800 is
  640 × 400; 400 % of 1280 × 1024 is 320 × 256, the WCAG 1.4.10 case. Also 568 × 320 (a small phone
  turned sideways), 320 × 300, 390 × 300 and 320 × 360 to find where AT-01 starts. Each checked for
  horizontal scroll, controls outside the viewport and a full Tab walk.
- **Forced colours** (`forcedColors: 'active'`, dark scheme): the region sheet, the highlight strip and
  key, names on the brain, the gizmo, the Section popover and the focus ring on the canvas and on a name.
- **Reduced motion** (`reducedMotion: 'reduce'`): the phone sheet moved by a pointer press reached its
  rest in the first 40 ms frame (390 px, peek to half), where without it the spring took about 240 ms. The
  camera's dissolve under reduced motion was read in the code (`camera-motion.ts`) and its existing rules,
  not measured.

## What was not tested

- **The screen-reader matrix.** No screen reader was run: NVDA with Firefox and with Chrome on Windows,
  VoiceOver with Safari on macOS and on iOS, and TalkBack with Chrome on Android all still need a person.
  The accessibility tree shows what each is given, not what each says, when, or in browse mode. What to
  listen for first:
  - the Anatomy treegrid (decision 0002 asks for it): row and cell reading, `aria-selected`, the eye cells;
  - the canvas's `role=application` and leaving it in browse mode;
  - two polite regions speaking together: `#announcer` and the Linked MRI's own region when the crosshair
    lands on a region that is then selected (AT-10), and a restore from a link, which says
    "Selected: …" and then "Anatomy loaded." in quick succession;
  - the tour's cards, which are non-modal dialogs that keep Tab inside on the first card only;
  - the phone sheet (decision 0006) with VoiceOver and TalkBack gestures, including a double tap on the
    canvas, which picks whatever is at the canvas's centre and, at peek, leaves the sheet down;
  - names on the brain and route marks as toolbars of buttons over the canvas.
- **Real devices and settings.** Touch, a real Windows contrast theme (only Chromium's emulation), real
  browser zoom (emulated by viewport size, which gives the same CSS pixels but not the same device pixel
  ratio), speech input, switch access.
- **Study mode** (plan 1's WP8) is not built, so its session is not audited; the plan repeats one journey
  after it ships.

## Journeys

| Journey                             | 1280 × 800                                                                                                                                                                                                                                                                                                                                                                                 | 390 × 844                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| 1. Start → tree → sheet → function  | Passes. Tab reaches the treegrid in 12 stops; Down, Right, Enter select a region; focus goes to Back to Anatomy; "Selected: Paracentral lobule and sulcus, left". Functions: tab, Enter, Tab to a function, Enter → focus on its heading, "Atlas and cut labels set to HCP-MMP. Out of sight from this view: …"; Escape returns to the row; a second Escape says "Previous view restored." | Passes. The handle "Expand panel" (said "Panel half open"), then the same tree and selection; Escape back to the row. |
| 2. Open a section and move it       | Passes. Section opens a non-modal dialog with focus on Full brain; a plane closes it and focus returns to Section. The slider says "+1.0 mm" per step; the cut's status line is said once the slider is left. Close returns focus to Section.                                                                                                                                              | Passes. More section controls folds Reverse side and Linked MRI.                                                      |
| 3. Linked MRI crosshair with arrows | Passes. M or the button opens the docked region with focus on Close; each plane's slider is the keyboard route (the canvases are `role=img`); the readout ("−55.0, −16.0, +7.0 mm — Cerebrospinal fluid (CSF) (label 24)") is said after each step; M closes it. Noise: AT-04, AT-10.                                                                                                      | Passes. The modal dialog with a plane radio group; the same readout.                                                  |
| 4. Place a coordinate               | Passes. Add opens with focus on its first radio; Coordinate, then the field. The lesion beside it cannot be placed from the keyboard: AT-05.                                                                                                                                                                                                                                               | Passes (Overlay is not offered on phones).                                                                            |
| 5. Save an image                    | Passes. Save image is a menu disclosure (focus stays on the trigger, Tab enters); Save at 2× downloads and says "Image saved as planum-destrieux-oblique.png."; focus returns to the trigger.                                                                                                                                                                                              | Passes.                                                                                                               |
| 6. Names on the brain               | Passes with AT-06: N shows the names but nothing is said. The names are one toolbar "Names on the brain" with one Tab stop and the arrows; each region name is a button whose name contains its visible words ("Crus I, left"); lobe names are `aria-hidden`, the Lobes key lists them.                                                                                                    | As desktop.                                                                                                           |
| 7. Highlights                       | Passes with AT-09 (phone). More, Tab to Highlight, Enter: "Highlighted in blue: Middle temporal gyrus, left."; the strip is a group "Your highlights" with a colour menu and a remove per region; removing says "Highlight removed: …" and moves focus to the next remove, then to the tab.                                                                                                | Focus stays on Highlight, but the strip pushes it below the visible sheet: AT-09.                                     |
| 8. References dialog                | Passes. Provenance opens a modal dialog with focus on its heading; "References for this view" is a region with its own heading, Copy as text and the two downloads; Escape returns focus to the opener.                                                                                                                                                                                    | Passes, from More settings.                                                                                           |
| 9. Embed link                       | Was AT-02, now passes: the poster's one control names the download ("Load the 3D brain (about 20 MB)"), Open in Planum says it opens a new tab, and after Load focus reaches the canvas, whose arrows turn the model.                                                                                                                                                                      | As desktop.                                                                                                           |

## The plan's first questions

- **Is the tree and the sheet a complete alternative to the canvas?** For finding, selecting and reading
  a region, yes: every selectable region is a treegrid row (and found by search), its sheet holds what the
  hover chip says (name, side; the network and function words are in Functional networks and the
  function's area list), and Focus, Isolate, Hide, Highlight, Linked MRI and the copies are buttons. Two
  canvas actions have no keyboard route: placing a lesion (AT-05) and the tour's "Open a region" (AT-08).
  Double-click to centre has a near equivalent in Focus (F), and the pan in Shift with the arrows.
- **What `#announcer` says.** A pick: "Selected: <name>, <side>" (on the first pick of a session the
  comparison section also says "Loading atlas comparison…" and "Atlas comparison loaded.", AT-11). An
  atlas change: "<atlas>: Loading…", "Anatomy loaded.", and since AT-03's fix "Selection cleared —
  <name> is no longer shown." when it dropped the selection. A restore: "Previous view restored."; a link
  restored at start: the selection, then "Anatomy loaded.". Display shortcuts: nothing (AT-06).
- **Hover names.** The hover chip is `aria-hidden` and follows the pointer only. Its keyboard equivalent
  is the tree and the sheet, and since WP21 the names on the brain, which are keyboard-reachable buttons.
  Adequate; no finding.
- **Focus on opening and closing.** Stage popovers move focus to the pressed control and Escape returns
  it to the trigger; menus leave it on the trigger (APG disclosure); dialogs take it to their heading or
  Close and return it to the opener. The tour's first card takes focus on Start tour; closing it gives
  focus to More settings, where the tour is restarted. The phone sheet keeps focus on its handle across
  detents, and the panel's focus moves to the handle before the sheet hides it (decision 0006).
- **Route marks and stage keys.** A circuit's marks are one toolbar "Whole route", buttons named
  "Landmark 1: Optic chiasm" (visible "1", its name in the tooltip); a colour key is a button with
  `aria-expanded` opening its rows. Both are reachable and named.

## Findings

| ID                                                                          | WCAG 2.2            | Severity | Status                      |
| --------------------------------------------------------------------------- | ------------------- | -------- | --------------------------- |
| AT-01 Short stage: the camera fits at an infinite distance                  | 1.4.10, 1.3.1       | High     | Fixed (STAGE-82)            |
| AT-02 Focus after an embed's Load stays off the canvas                      | 2.4.3               | Medium   | Fixed (BOOT-36)             |
| AT-03 A layer choice drops the selection without saying so                  | 4.1.3               | Medium   | Fixed (CTRL-41)             |
| AT-04 The cut's status line speaks for downloads the reader did not ask for | 4.1.3               | Low      | Open                        |
| AT-05 A lesion is placed only by a pointer                                  | 2.1.1               | High     | Decision 0009               |
| AT-06 Display shortcuts change the model silently                           | 4.1.3               | Medium   | Decision 0010               |
| AT-07 The side sheet on a narrow landscape screen covers the stage          | 1.4.10, 4.1.2       | High     | Decision 0011               |
| AT-08 The tour's hands-on cards ask for a pointer                           | 2.1.1 (met by Next) | Low      | Decision 0012               |
| AT-09 Highlight pushes the focused button below a phone's sheet             | 2.4.11              | Low      | Open                        |
| AT-10 Two polite regions speak at once on a Linked MRI step                 | 4.1.3               | Low      | Open, needs a screen reader |
| AT-11 The first pick of a session says three things                         | 4.1.3               | Low      | Open                        |

Eleven findings: 3 High, 3 Medium, 5 Low. Fixed: 3 (AT-01 High; AT-02 and AT-03 Medium), each with a
browser or unit test that fails without it and a rule. Decision records: 4 (0009 to 0012; two High, one
Medium, one Low). Open without a record: 4, all Low.

### AT-01 · Short stage: the camera fits at an infinite distance — High, fixed

- **Steps.** Open the page at 320 × 256 (400 % zoom of 1280 × 1024), or any phone layout 300 px tall or
  less (320 × 300, 390 × 300); resize to 1280 × 800; press 0, or Tab to the canvas and press ArrowLeft.
- **Expected.** The gizmo, the edge letters and the camera behave as at any size; the link takes the moved
  camera.
- **Actual.** The console filled with `<line> attribute x1: Expected length, "NaN"`; the gizmo drew no
  letters or axes; the edge letters read R and L on all four edges of the opening view; after growing
  the window the camera still wrote no `cam=` to the link. The layout's `clearGizmo` chose the corner
  option whose share was 0 (the bands' were negative), with scale 0, and the camera's fit divided by it.
- **Fix.** A room where no option keeps any picture frames as it would without the gizmo
  (`stage-layout.svelte.ts`). Test: `stage-layout.svelte.test.ts`, STAGE-82, which fails without the fix
  (scale 0 and a framing unlike the bare one). Checked live at 320 × 256, 320 × 300 and 390 × 300: numeric
  axes, no console error, ArrowLeft writes `cam=`.

### AT-02 · Focus after an embed's Load stays off the canvas — Medium, fixed

- **Steps.** Open `#region=destrieux:left:38&embed=1`, Tab to Load the 3D brain, Enter, wait for ready,
  press ArrowLeft. Likewise on a plain page, press Skip to model while the anatomy loads.
- **Expected.** The arrows turn the model, as the poster's comment intends ("the stage keeps focus for the
  keys").
- **Actual.** Focus was on `main#viewport`, which takes it while there is no canvas; the keymap turns the
  model only from the canvas, so the arrows did nothing until a Tab reached it.
- **Fix.** Once the start is over, focus still on the stage host passes to the canvas; focus anywhere else
  stays (`boot.ts`). Tests: `boot.svelte.test.ts`, BOOT-36 (both halves).

### AT-03 · A layer choice drops the selection without saying so — Medium, fixed

- **Steps.** Select Middle temporal gyrus (Destrieux); open Atlas and display settings; choose HCP-MMP.
- **Expected.** As for every display change that drops the selection (CTRL-06): "Selection cleared —
  Middle temporal gyrus is no longer shown."
- **Actual.** "HCP-MMP: Loading…", "Anatomy loaded."; the region's sheet disappeared silently. The same
  for an Internal anatomy choice that drops a structure, and a colour that switches the atlas.
- **Fix.** The three masthead fields run through `anatomy.chooseLayer`, which notifies as `display` does
  (`anatomy.svelte.ts`, `MastheadRegion.svelte`). Test: `anatomy.svelte.test.ts`, CTRL-41.

### AT-04 · The cut's status line speaks for downloads the reader did not ask for — Low, open

- **Steps.** With no cut, open the Linked MRI (M), or run the tour past its Cut through it card.
- **Expected.** Nothing from the cut's line, which has nothing to report.
- **Actual.** Its `role=status` says "Preparing anatomy…" then "Full brain · no cut" while the MRI
  prepares the tissue, competing with the region or dialog that just took focus. `sectionSentences` says
  "Preparing" whenever the sections are loading, whoever asked. Not fixed within the budget: the right
  condition (a cut the reader asked for) needs the engine's loading reason, not only its status.

### AT-05 · A lesion is placed only by a pointer — High, decision 0009

- **Steps.** Add › Lesion; try to place it with the keyboard.
- **Expected.** A keyboard way to place and move the sphere.
- **Actual.** "Click the brain or a cut face to place its centre." No key places it; Coordinate places a
  fixed sphere at an MNI coordinate, not the reader's lesion at their radius. Needs a design choice:
  `web/docs/decisions/0009-keyboard-lesion-placement.md`.

### AT-06 · Display shortcuts change the model silently — Medium, decision 0010

- **Steps.** Tab to the canvas; press H three times, then C, U, S, E, N.
- **Expected.** Each says the state it leaves ("Left hemisphere shown", "Names on the brain on").
- **Actual.** Nothing is said, except when a change drops the selection. The Display popover's buttons
  carry `aria-pressed`, so the pointer route is fine. Needs a design choice:
  `web/docs/decisions/0010-display-shortcut-feedback.md`.

### AT-07 · The side sheet on a narrow landscape screen covers the stage — High, decision 0011

- **Steps.** 568 × 320, or 320 × 256 (400 % zoom); Tab to Expand panel; press Enter.
- **Expected.** The sheet moves and the stage can be uncovered; at 320 px wide the content reflows.
- **Actual.** The sideways rests collapse into one (about 370 px wide): the handle, "Expand panel",
  changes nothing; at 320 × 256 the rail is the whole width and the stage, dock and gizmo lie under it.
  Needs a design choice: `web/docs/decisions/0011-side-sheet-on-narrow-landscape.md`.

### AT-08 · The tour's hands-on cards ask for a pointer — Low, decision 0012

- **Steps.** Start the tour; on Open a region, try it from the keyboard.
- **Expected.** A keyboard way, or the card saying how.
- **Actual.** "Click or tap any region of the brain." waits for a canvas pick; a selection from the tree
  does not count, and the card's own arrows step the cards. Next always moves on.
  `web/docs/decisions/0012-tour-hands-on-steps-keyboard.md`.

### AT-09 · Highlight pushes the focused button below a phone's sheet — Low, open

- **Steps.** 390 × 844, sheet at half, a region's sheet; More, Tab to Highlight, Enter.
- **Expected.** The focused button stays in view.
- **Actual.** The new strip above the panel moves Highlight from y 784 to 867, below the 844 px viewport;
  focus is kept but not visible until the next Tab scrolls. On desktop it moves too but stays in view.
  WCAG 2.4.11 asks this of a component receiving focus, so this is at its edge; fix by keeping the active
  element in view when the strip first appears (`HighlightStrip.svelte`).

### AT-10 · Two polite regions speak at once on a Linked MRI step — Low, open

- **Steps.** Linked MRI on a selected region; Page Up on the sagittal slider until the crosshair enters
  the hippocampus.
- **Actual.** The MRI's region says the readout and `#announcer` says "Selected: Hippocampal formation,
  left" in the same moment. Whether one is cut off depends on the screen reader; to check in the
  screen-reader pass before changing anything.

### AT-11 · The first pick of a session says three things — Low, open

- **Steps.** Load the page, click a region.
- **Actual.** "Loading atlas comparison…", "Selected: …", "Atlas comparison loaded." (the comparison
  section's own status, once per session). The selection sentence can be crowded out on a screen reader
  that does not queue polite messages. To weigh in the screen-reader pass.

## Also checked, no finding

- The canvas's focus ring (the stage's accent around it) is visible, and in forced colours; so is the
  ring on a name on the brain.
- At 640 × 400 (200 %) the phone layout puts the sheet beside the stage, every control is reachable and
  nothing scrolls sideways; at 320 px wide in portrait the page reflows (SHEET-29).
- Target sizes: the gizmo's letters and chevrons are 24 × 24 px on a fine pointer (WCAG 2.5.8 minimum);
  at 390 px the masthead, sheet and dock controls measured 44 px tall.
- ArrowDown on the phone sheet's handle at half walks the tree (the page's tree shortcut), and at peek
  does nothing; decision 0006 says arrows do nothing on the handle, which holds at peek.
- The phone's Display button carries ", settings changed" in its name when its mark shows.
