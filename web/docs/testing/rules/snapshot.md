# Snapshot rules: the saved PNG and its markings

Scope: chunk G6 (#50), Save image: the visible stage as a PNG that documents itself, with the orientation
letters, scale bar and colour keys drawn on it, a caption naming the subject, labels, colouring and view or
section, and the not-clinical statement; its file name, download and announcement. Full screen, the other
half of G6, is STAGE-49 to STAGE-51 (`stage.md`). Legacy sources: `viewer/ui/chrome/snapshot.js`
(+ `snapshot.test.js`), `viewer/ui/chrome/viewport-chrome.js:642-697, 796-831`, `viewer/app.js:1450-1463`.
New code: `web/src/features/snapshot/` (`snapshot.ts`, `markings.ts`). Deviations: `g6-paint-row-labels.md`,
`g6-snapshot-blob.md`, `g6-snapshot-reentry.md`; decision 33 and comment 87 on #4 (the success announcement
and its strings, `viewport.snapshotSaved`). The engine's capture of the settled frame, cropped to the visible
rectangle, is FACADE-33 (`engine-e7.md`); the Save image button and its enabled state are the masthead's
(`masthead.md`). Layout numbers are CSS pixels of the cropped stage (`SNAPSHOT_LAYOUT`: gutter 16, line 16,
letter gap 12, scale gap 8); "mm" follows a narrow no-break space (U+202F).

## The caption

### SNAP-01 · The caption names the subject, then atlas, colouring and internal anatomy, then the view

- **Rule:** The first line is the subject, in bold. The second is the atlas, the colouring and the internal-anatomy level, named as the masthead names them and joined by " · ". The third is the view, when the camera holds a named view. Facts with no words are dropped, and a line with none goes.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/snapshot.js:15-42`; `snapshot.test.js:7-13`
- **Expected:** EN `{ subject: 'SNAIL subj_1', atlas: 'destrieux', surfaceColor: 'tissue', detail: 'learning', view: 'anterior' }` → `['SNAIL subj_1', 'Destrieux · Tissue · Teaching set', 'Anterior view']`, first run `strong`. `{ subject: 'S', atlas: null, surfaceColor: 'tissue', detail: null, view: null }` → `['S', 'Tissue']`. `{ subject: '', atlas: 'destrieux', surfaceColor: 'atlas', detail: 'nextbrain', view: 'left' }` → no subject line. French view: posterior → "Vue postérieure".
- **Covered by:** `src/features/snapshot/snapshot.test.ts` (R)

### SNAP-02 · The internal anatomy only where the masthead offers it, the view only while the camera holds it

- **Rule:** The internal-anatomy level is named only when the masthead offers a choice of levels. The view is named only while the camera still sits on it; once the reader has turned the model the caption names no view.
- **Kind:** behaviour
- **Level:** unit: the subject is plain data (today tested through `snapshotPlan` in the browser)
- **Source:** `viewer/ui/chrome/viewport-chrome.js:806-815`
- **Expected:** Anatomy "“CDMD sub_013”", HCP-MMP, atlas colouring, `learning` offered, `left` held → `[['CDMD sub_013'], ['HCP-MMP', 'Regions', 'Teaching set'], ['Left view']]`. Not held, not offered → `[['CDMD sub_013'], ['HCP-MMP', 'Regions']]`.
- **Covered by:** `src/features/snapshot/snapshot.svelte.test.ts` (R; could move down)

### SNAP-03 · A section replaces the view with the plane and its signed position

- **Rule:** While a plane is cut, the third line names the section and its signed position to one decimal, with its unit kept on it; an oblique section adds its tilt and signed azimuth in whole degrees. The figures are set in the interface face, not a monospace one.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/snapshot.js:29-37`; `snapshot.test.js:15-32`
- **Expected:** French coronal −12.34 → "Coupe coronale · −12,3 mm", no run with `mono`. Oblique 0, tilt 30, azimuth −45 → "Oblique section · 0.0 mm · Tilt 30° · Azimuth −45°". Axial +4 → `['Axial section', '+4.0 mm']`.
- **Covered by:** `src/features/snapshot/snapshot.test.ts` (R); `src/features/snapshot/snapshot.svelte.test.ts` (R)

### SNAP-04 · The tract reference is named alone

- **Rule:** While the tract reference is shown alone, its name, in bold, replaces the subject and the labels line, and no section is named. A held view is still named.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/snapshot.js:22-23`; `viewer/ui/chrome/viewport-chrome.js:805, 814`
- **Expected:** `{ reference: 'HCP tract reference', view: null }` → `['HCP tract reference']`. With an axial section and `left` held → `[['HCP tract reference'], ['Left view']]`.
- **Covered by:** `src/features/snapshot/snapshot.test.ts` (R); `src/features/snapshot/snapshot.svelte.test.ts` (R)

### SNAP-05 · Every colouring, view and plane has a fixed caption in both languages

- **Rule:** For each colouring, each named view or none, and each plane or none, in English and French, the caption is a known table of words; every plane's name appears in it.
- **Kind:** behaviour
- **Level:** unit (a table test)
- **Source:** `viewer/ui/chrome/snapshot.js:20-42`
- **Expected:** For `{ subject: 'CDMD sub_013', atlas: 'hcp-mmp', detail: 'learning' }` × `SURFACE_COLORS` × (`VIEW_NAMES` + none) × (none, sagittal 12.34, coronal −0.04, axial 5, oblique −7.5 tilt 30 azimuth −45): the words written out once from the i18n tables (e.g. network, no view, sagittal 12.34 → `['CDMD sub_013', 'HCP-MMP · Yeo 7 networks · Teaching set', 'Sagittal section · +12.3 mm']`; French "Coupe sagittale · +12,3 mm"); the strings "Sagittal", "Coronal", "Axial", "Oblique" all occur.
- **Covered by:** `src/features/snapshot/snapshot.test.ts` (R) (fixed tables of the words for every colouring, view and plane, in English and French)

## Laying out the markings

### SNAP-06 · A narrow image breaks a caption line between its facts, never inside one

- **Rule:** The facts of a line are packed greedily into lines no wider than the room; a fact wider than the room gets a line of its own, to be shortened there.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/snapshot.js:44-59`; `snapshot.test.js:44-51`
- **Expected:** `packFacts([90, 70, 120], 30, 400)` → `[[0, 1, 2]]`; room 200 → `[[0, 1], [2]]`; room 100 → `[[0], [1], [2]]`; `packFacts([300, 70], 30, 100)` → `[[0], [1]]`. Properties for the seeded sweep: fact order kept; a line exceeds the room only when it holds one fact.
- **Covered by:** `src/features/snapshot/snapshot.test.ts` (R) (fixed cases, and a seeded property test: order kept, a line exceeds the room only with one fact)

### SNAP-07 · A line too long for its room keeps its start and ends in an ellipsis

- **Rule:** A run that does not fit is cut to the longest start that, with "…", fits; if nothing fits, only "…" is drawn.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/snapshot.js:61-71, 119-136`; `snapshot.test.js:53-59`
- **Expected:** Measure 10 px per character: `ellipsize('Destrieux', 200)` → "Destrieux"; `('Destrieux · Tissue', 100)` → "Destrieux…" (≤ 100 px); `('Destrieux', 5)` → "…". Property: the result is the text, or a prefix with trailing spaces trimmed plus "…", and measures ≤ the width unless it is "…".
- **Covered by:** `src/features/snapshot/snapshot.test.ts` (R) (fixed cases, and a seeded property test: a trimmed prefix plus "…" that fits, or "…")

### SNAP-08 · The caption runs from the top left and stops short of the top letter

- **Rule:** The caption starts at the left gutter, its first line centred 24 px from the top, one line every 16 px; the first line is 13 px, the others 12 px, bold runs at weight 600. Its room ends 12 px before the top orientation letter (or at the right gutter when there is none), so the two never touch.
- **Kind:** behaviour
- **Level:** browser: canvas text measurement
- **Source:** `viewer/ui/chrome/snapshot.js:6-13, 203-230`
- **Expected:** 560×520 plan, top letter at x 280 → every caption run's right end ≤ 280 − ½ × letter width − 12; first baseline y 24, then 40, 56…; with a long subject ("A subject whose name is far too long for the room it has here") the first line ends in "…".
- **Covered by:** `src/features/snapshot/snapshot.drawing.svelte.test.ts` (R)

### SNAP-09 · The statement and the scale bar share the bottom line until they would meet

- **Rule:** The image always carries "Planum · Not clinical anatomy" at the bottom left. The scale bar sits at the bottom right on the same line while the statement, two gaps and the bar fit between the gutters; otherwise it rises one line and a gap.
- **Kind:** behaviour
- **Level:** unit for the positions; browser for the drawn statement
- **Source:** `viewer/ui/chrome/snapshot.js:73-85, 234-241`; `snapshot.test.js:61-68`; `viewport.snapshotStatement`
- **Expected:** `bottomLine({ 1120, 824, statementWidth: 190, scaleWidth: 110 })` → statement `{ x: 16, y: 800 }`, scale `{ x: 994, y: 800 }`. `(300, 600, 190, 110)` → scale y 552 (576 − 16 − 8), scale x + 110 = 284. Statement text "Planum · Not clinical anatomy" (French "Planum · Pas une anatomie clinique"), 12 px, at the statement spot. Property: the statement and the bar never overlap.
- **Covered by:** `src/features/snapshot/snapshot.test.ts` (R) (positions; a seeded property test: never overlap, shared line exactly when it fits); `src/features/snapshot/snapshot.drawing.svelte.test.ts` (R; the statement is drawn)

### SNAP-10 · The scale bar is drawn at its on-screen length

- **Rule:** The image's scale bar is a bracket exactly as many pixels wide as the bar on screen, open at the top with 6 px ends, its label 8 px after it in 13 px type, both with the markings' halo.
- **Kind:** scientific
- **Level:** browser: canvas pixels
- **Source:** `viewer/ui/chrome/snapshot.js:147-170`; `viewer/ui/chrome/viewport-chrome.js:692-696`
- **Expected:** On-screen bar `{ pixels: 100, label: '10 mm' }` → plan `scale` `{ pixels: 100, label: '10 mm' }`; on the image the bracket's foot spans 100 px (from `round(x) + 0.5` to that + 99) at `round(y + 3) − 0.5`; label starts at x + 108. No scale bar shown → `scale: null` and nothing drawn.
- **Covered by:** `src/features/snapshot/snapshot.svelte.test.ts` (R), `src/features/snapshot/snapshot.drawing.svelte.test.ts` (R)

### SNAP-11 · The letters are drawn where the reader sees them

- **Rule:** Each orientation letter is drawn at the centre of where it is on screen, in 13 px bold with the halo. Without a key band in the top strip the top letter moves up to the caption's line. Over a tall dock, where the screen hides the bottom letter, the image draws it centred one line above the statement. Before the anatomy is drawn there are no letters and no scale bar.
- **Kind:** behaviour
- **Level:** browser: measured positions
- **Source:** `viewer/ui/chrome/viewport-chrome.js:646-664`
- **Expected:** 1000×700 stage: letters in order top, right, bottom, left, each text = the camera's edge letter, x (and y except top) = the screen box centre (±1e-3); top y = 20. Dock 300×400 (tall) → bottom letter `{ x: 500, y: 652 }` (700 − 16 − 32). Status `loading` → `{ letters: [], scale: null }`.
- **Covered by:** `src/features/snapshot/snapshot.svelte.test.ts` (R), `src/features/snapshot/snapshot.drawing.svelte.test.ts` (R)

### SNAP-12 · Each colour key is redrawn with every row named beside its swatch

- **Rule:** Each shown key is redrawn as its plate, its swatches and its words: the title and every row's label beside its own swatch. The picked row is bold and the others regular; a colour not shown in this view stays hollow. A folded key draws its title row only. Rows scrolled out of a long key stay out. The paint key's note is not drawn (legacy, flagged on #4).
- **Kind:** behaviour
- **Level:** browser: measured text and computed style
- **Source:** `viewer/ui/chrome/snapshot.js:172-196`; `viewer/ui/chrome/viewport-chrome.js:665-691`; deviation `g6-paint-row-labels.md`
- **Expected:** Deficit "Aphasia" with Broca picked, Wernicke absent, Arcuate → texts `['Aphasia', 'Broca', 'Wernicke', 'Arcuate']`, each row's x = the left of its label on screen (±1e-3) and right of its swatch; weights `['600', '400', '400']`; swatches `['rgb(100, 120, 200)', 'rgba(0, 0, 0, 0)', 'rgb(160, 120, 200)']`; the note absent; plate box = the screen plate's size. Folded → `['Aphasia']`, no swatches. 40 rows on a 1100×420 stage, opened → fewer than 41 texts and 40 swatches, all with y inside the plate.
- **Covered by:** `src/features/snapshot/snapshot.svelte.test.ts` (R), `src/features/snapshot/snapshot.drawing.svelte.test.ts` (R)

### SNAP-13 · Only marks are added; the anatomy is not resampled

- **Rule:** The markings are drawn on the captured frame at its device-pixel ratio in the overlay ink, halo and halo core; the rendered anatomy under them is not filtered or resampled. The faces the marks use are loaded for their words before the frame is captured.
- **Kind:** scientific
- **Level:** browser: canvas pixels
- **Source:** `viewer/ui/chrome/snapshot.js:198-257`; `viewer/ui/chrome/viewport-chrome.js:816-830`
- **Expected:** A 560×520 plan at ratio 2 over a flat `#7a7f86` frame: more than 5000 pixels change, every changed pixel lies within the halo reach (8 px blur) of a drawn letter, caption run, key, statement or bar; pixels farther away keep `#7a7f86`. `document.fonts.load` is awaited for 400 12 px, 400 13 px, 600 13 px and each key font before `captureSnapshot`.
- **Covered by:** `src/features/snapshot/snapshot.drawing.svelte.test.ts` (R)

### SNAP-24 · Names on the brain are in the saved image where they stand

- **Rule:** Names on the brain (STAGE-76) are stage labels, so the snapshot measures each placed name as it measures a route landmark's label, its dot, its leader and its words line by line, and draws them into the image; a name left out on the stage is not drawn, and with names off there are none.
- **Kind:** behaviour
- **Level:** browser (component)
- **Source:** Planum improvement plan 2, WP21 (handoff F3: "included in the PNG"); `features/snapshot/markings.ts`
- **Expected:** Over the fake engine at 1000 × 700, names on → one label per placed name, in order, its words the name's, its dot at the drawn dot's centre (to 0.001 px), a leader exactly where the name stands off, font `500 14px`; names off → no labels.
- **Covered by:** `src/features/snapshot/region-names.svelte.test.ts` (R)

## Saving

### SNAP-14 · Save image downloads planum-<atlas>-<view>[-<plane>].png of the visible stage

- **Rule:** The download is a PNG of the visible stage (the canvas less what the sheet covers) at device pixels, named after the atlas shown, or "brain" with none.
- **Kind:** behaviour
- **Level:** browser: real canvas encode; e2e for the real engine and download
- **Source:** `viewer/app.js:1450-1463`; FACADE-33
- **Expected:** Host 1000×700, chrome insets `{ bottom: 100 }`, HCP-MMP → one link, `download` "planum-hcp-mmp-left.png" (view left), "planum-hcp-mmp-anterior-coronal.png" with an anterior coronal cut, blob type `image/png`, decoded 1000×600 at ratio 1. Atlas `null` → "planum-brain-left.png". Built site 1280×800, HCP-MMP, oblique → suggested file "planum-hcp-mmp-oblique.png", PNG signature, saved from the menu at 2×, width = stage width × 2 (±1; the size is the menu's since 2026-11-16, SNAP-20, its outline found on screen-sized buffers), 0 < height ≤ ceil(stage height × ratio).
- **Covered by:** `src/features/snapshot/snapshot.svelte.test.ts` (R)

### SNAP-15 · The image is handed over as a Blob URL, released 40 s after the click

- **Rule:** The PNG is encoded asynchronously into a Blob and downloaded through an object URL, which is released 40 s after the click, not before, so the browser can finish the file.
- **Kind:** behaviour
- **Level:** browser today (`toBlob`, `createObjectURL`); the timing is fake-timer logic
- **Source:** deviation `g6-snapshot-blob.md` (FileSaver.js revoke delay); legacy used a data URL
- **Expected:** After the save, the link's `href` fetches a blob of type `image/png`; `URL.revokeObjectURL` not called at +39 999 ms; called exactly once, with that `href`, at +40 000 ms.
- **Covered by:** `src/features/snapshot/snapshot.svelte.test.ts` (R, fake `setTimeout`)

### SNAP-16 · A saved image is announced

- **Rule:** When the download has started the page says so, naming the file, in the reader's language.
- **Kind:** accessibility
- **Level:** browser: the announcer's live region
- **Source:** decision 33 and comment 87 on #4 (`viewport.snapshotSaved`, WCAG 4.1.3)
- **Expected:** English "Image saved as planum-brain-left.png."; French "Image enregistrée : planum-hcp-mmp-left.png."; "planum-brain-left.png" with no atlas. Built site (next): `#announcer` text "Image saved as planum-hcp-mmp-oblique.png.".
- **Covered by:** `src/features/snapshot/snapshot.svelte.test.ts` (R)

### SNAP-17 · A second request while one is being made joins it

- **Rule:** Asking to save again while a save is in progress gives the same save: one capture, one file, one announcement. Once it has ended, a new request saves again.
- **Kind:** behaviour
- **Level:** unit (with a fake stage and encoder); browser today
- **Source:** deviation `g6-snapshot-reentry.md`
- **Expected:** Two calls in a row return the same promise; after it settles, one link "planum-brain-left.png" and the announcement "Image saved as planum-brain-left.png."; a third call afterwards → two links.
- **Covered by:** `src/features/snapshot/snapshot.svelte.test.ts` (R)

### SNAP-18 · A failure is the snapshot notice, and nothing is downloaded or said

- **Rule:** If measuring, capturing or encoding fails, the reader gets the scene commands' snapshot failure notice; no file is downloaded and nothing is announced. A snapshot asked before the stage has been laid out is such a failure.
- **Kind:** behaviour
- **Level:** unit (with a fake stage); browser today
- **Source:** `viewer/app.js:1460-1462`; `viewer/ui/chrome/viewport-chrome.js:803`
- **Expected:** `captureSnapshot` throws `Error('context lost')` → `fail('snapshot', error)` once, no link, announcer text "". No visible rectangle → `snapshotPlan` throws "The stage has not been laid out yet.".
- **Covered by:** `src/features/snapshot/snapshot.svelte.test.ts` (R, the capture failure); the not-laid-out case is uncovered

### SNAP-19 · Save image stays outside the stage

- **Rule:** The Save image control is not part of the stage host, so it is not reachable while the stage is full screen (legacy parity).
- **Kind:** behaviour
- **Level:** browser: region composition
- **Source:** decision 33 on #4
- **Expected:** The button "Save image (PNG)" is not a descendant of `#viewport`.
- **Covered by:** uncovered

### SNAP-20 · A save at 2× or 3× has that many image pixels per CSS pixel, its caption grown with it

- **Rule:** Save image's menu offers 2× and 3×: the engine draws one frame at that many image pixels per CSS pixel of the stage, whatever the screen's ratio, and the marks are drawn at the frame's ratio, so a larger image carries a caption as large against the anatomy as the screen's. Copy image puts the 2× PNG on the clipboard. A save that names no size keeps the screen's ratio, at least two.
- **Kind:** behaviour
- **Level:** unit (fake engine); browser (the drawn caption; the real engine's frame)
- **Source:** Planum improvement plan 2, WP25 (handoff F10)
- **Expected:** Fake engine, crop 100 × 80 at scale 3 → canvas 300 × 240, ratio 3. A 400 × 300 stage saved at 3× → a 1200 × 900 PNG, at 1× → 400 × 300; the caption's inked box in the image's top left is 2.85 to 3.15 times as tall and as wide at 3× as at 1×. Real engine, 1000 × 700 stage, crop 400 × 300 at scale 3 → canvas 1200 × 900, ratio 3, the screen's canvas unchanged, the brain drawn.
- **Covered by:** `src/lib/engine/contract.test.ts`; `src/features/snapshot/snapshot-size.svelte.test.ts`; `src/lib/engine/index.svelte.test.ts`

### SNAP-21 · A size the device cannot draw is refused with its reason

- **Rule:** A frame wider or taller than the device's `MAX_RENDERBUFFER_SIZE` or `MAX_TEXTURE_SIZE` is refused before anything is drawn, with an `EngineError` of code `snapshot-too-large` naming the size and the limit; the stage is left as it was. The save says why, as the `snapshotSize` notice, and downloads nothing; any other failure is still the `snapshot` notice.
- **Kind:** behaviour
- **Level:** unit (fake engine); browser (the notice; the real engine)
- **Source:** Planum improvement plan 2, WP25
- **Expected:** Fake engine, 1000 × 700 stage, limit 2048: scale 3 throws `snapshot-too-large`, "A 3000 × 2100 px frame is past this device’s 2048 px limit."; scale 2 gives a 2000-pixel-wide canvas. Saved through `saveSnapshot` → `fail('snapshotSize', error)` once, no link, no notice; EN text "Could not save the image at this size: it would be larger than this device can draw. Choose a smaller size or make the window smaller."; FR "Impossible d’enregistrer l’image à cette taille : …" (U+202F). A lost context → `fail('snapshot', error)`. Real engine with the limit read as 1024 → the same code, and the screen's canvas keeps its size.
- **Covered by:** `src/lib/engine/contract.test.ts`; `src/features/snapshot/snapshot-size.svelte.test.ts`; `src/lib/engine/index.svelte.test.ts`

### SNAP-22 · The caption names the highlights as the reader's marks

- **Rule:** While the reader's highlights are keyed on the stage, the saved image's caption ends with a line of its own: the key's title in bold, that they are the reader's own marks and not data, then each highlighted region the image draws, named as the key names it. Over the tract reference there is no such line.
- **Kind:** behaviour
- **Level:** unit
- **Source:** Planum improvement plan 2, WP22 (a saved image's caption says the same as the key)
- **Expected:** Key rows "Precentral gyrus, left" and "Cuneus, right" (not drawn) → `{ title: 'Your highlights', details: ['the reader’s own marks, not data', 'Precentral gyrus, left'] }`; French first detail "marques personnelles, pas des données"; no highlight key → null. Caption with a selection → last two lines "Selected: Cuneus, right" and "Your highlights · the reader’s own marks, not data · Precentral gyrus, left · Cuneus, right", the title alone bold; with a reference → the reference's line alone.
- **Covered by:** `src/features/stage/stage-keys.test.ts`; `src/features/snapshot/snapshot.test.ts`

### SNAP-23 · The visual areas' names are in the saved image where they stand

- **Rule:** The visual field map's area names drawn on the stage are measured with the other markings and drawn into the saved image centred where they stand, in their own ink and type with the markings' halo. A name hidden on the stage is not drawn, and one the image's own chrome (the caption, the letters, the statement, the scale bar, a key) would cover is left out, as the stage leaves a name out under its own chrome; it is never moved off its area.
- **Kind:** behaviour
- **Level:** browser (component, canvas calls recorded)
- **Source:** Planum improvement plan 2, WP32; `features/snapshot/markings.ts`, `snapshot.ts`
- **Expected:** On the 560 × 520 fixture, LO1 standing at (300, 300) and IPS5 hidden → `plan.names` is LO1 alone; LO1 drawn with `textAlign` center at its box's centre. LO1's mark moved onto the caption's first line (box at 20, 18) as V3A → no V3A drawn.
- **Covered by:** `src/features/snapshot/snapshot.drawing.svelte.test.ts` (R)
