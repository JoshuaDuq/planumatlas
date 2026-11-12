# Guided tour rules

Scope: the guided tour ("How to use Planum"), a driver.js tour over the live interface: when it starts by itself and how the reader leaves it. Opening it from the settings menu is the masthead's (`Masthead.svelte.test.ts`); its stops, the views they open and where the cards sit are pinned in `guide.svelte.test.ts`. New code: `web/src/features/guide/` (`first-launch.ts` is what boot asks, `tour.ts` the tour). Copy quoted is the English interface text. Review item U6.

## Starting

### GUIDE-01 · The tour starts by itself once, on a plain first visit where it can remember being seen

- **Rule:** On boot the tour starts by itself only when "seen" is not stored under `planum.guide` and the link names nothing but the home view (`anatomy`, `atlas`, `cuts`, `detail`, `lang`): a shared link opens a view the reader came to see. Starting the tour, by hand or by itself, stores "seen". Where site data is blocked (`localStorage` cannot be reached), "seen" cannot be kept, so the tour would open on every visit: it does not start by itself, and the settings menu still opens it. Remembering "seen" in memory instead would change nothing, as each visit is a new page.
- **Kind:** behaviour
- **Level:** browser
- **Source:** `web/src/features/guide/first-launch.ts`; `web/src/app/boot.ts` (`firstLaunch(arrived)`); review item U6
- **Expected:** `firstLaunch('#anatomy=cdmd&atlas=destrieux&detail=learning')` and `firstLaunch('')` → true; with `region=…&view=left` → false; with storage `null` → false; after the tour starts → false.
- **Covered by:** `src/features/guide/guide.svelte.test.ts` (R); `src/app/boot.svelte.test.ts` (R, boot starts it on a first plain visit only)

## Leaving

### GUIDE-02 · The first card offers Skip tour beside Next, which ends the tour as closing does

- **Rule:** The first card's footer has a "Skip tour" button (French "Passer la visite") before Next, drawn as the tour's other unfilled footer buttons; later cards have none, as Back takes its place and the close button stays on every card. Skip ends the tour as the close button and Escape do: the reader's view comes back, focus returns the way the press came (pointer or keyboard), and the tour does not start by itself again. Focus opens on Next, so Shift+Tab reaches Skip.
- **Kind:** behaviour
- **Level:** browser
- **Source:** `web/src/features/guide/tour.ts` (`skipButton`); review item U6
- **Expected:** Card 1: `.guide-skip` text "Skip tour"; click → one close, `{pointer: true}`, the reader's hash back, no card, `firstLaunch(HOME)` false. French: from Next, Shift+Tab → "Passer la visite", Enter → closed with `{pointer: false}`. Card 2: no `.guide-skip`.
- **Covered by:** `src/features/guide/guide.svelte.test.ts` (R)

### GUIDE-03 · A first visit runs six stops after the welcome; its last card offers the rest

- **Rule:** The tour a first visit starts by itself (`ports.startGuide(true)`) is the welcome card, then six stops: Turn the brain and Open a region (GUIDE-06, GUIDE-07), the region in detail, Section, Functions (without the Linked MRI, so the painted brain stays large, its card in the stage's band), and "Over to you", which points at the tabs and says what each is for. Its Next reads "Start exploring" (« Explorer »). Its last card offers "See the rest (N stops)" on a line of its own under its words (« Voir la suite (N étapes) »), N the full tour's stops this layout can show that the first visit left out; it runs those stops, from "Look from any side" at "1 of N", over the same reader's view, which comes back only when they end. ⋯ › How to use Planum runs every stop. The welcome stays first: it holds the language choice, Skip tour beside "Start tour" (« Commencer »), and the not-clinical statement (supervisor review 2.3; ruling recorded in the run's ledger).
- **Kind:** behaviour
- **Level:** browser; unit for boot's call
- **Expected:** titles "Welcome to Planum", "Turn the brain", "Open a region", "The region in detail", "Cut through it", "Map a function", "Over to you"; the last card's `.guide-rest` reads "See the rest (12 stops)", under the card's words and outside its footer, whose count, Back and "Start exploring" share one line; pressing it shows "Look from any side" at "1 of 12", no first-visit title among its 12, no close counted; closing then restores the reader's hash. The first visit's "Map a function" opens no MRI and reserves the stage's right band. Boot on a plain first visit → `startGuide(true)`.
- **Covered by:** `src/features/guide/guide.svelte.test.ts`, `src/app/boot.svelte.test.ts` (R)

### GUIDE-04 · The Lesion, Coordinate and Overlay stops point at Add, and only at a choice it offers

- **Rule:** Lesion, Coordinate and Overlay are Add's choice (STAGE-65), so their stops point at the Add tool, each through what it says it offers (`.stage-tool[data-tool="place"][data-offers~="…"]`). A stage whose Add offers no Overlay (a phone's) or no Coordinate has no stop for it, and the count follows. The opening picture's lobes stay through the tour (`colors=lobe` is kept in the tour's home view); a stop on an atlas without lobes shows that atlas's regions, and any other colour of the reader's gives way to the stops' own.
- **Kind:** behaviour
- **Level:** browser
- **Source:** `web/src/features/guide/tour.ts`; parsimony round 2026-11-11
- **Expected:** full dock → "Place a lesion", "Find a coordinate" and "Bring your own map" each point at "Add"; a 390 px phone → the first two point at "Add" and there is no "Bring your own map" card. Fixture with `data-offers="lesion coordinate"` → "1 of 17", a "Find a coordinate" card, no "Bring your own map" card.
- **Covered by:** `src/features/guide/guide.svelte.test.ts` (R, with "GUIDE-04 · the opening lobes stay…"); `src/features/stage/Dock.svelte.test.ts` (R, "the guided tour's dock stops…")

### GUIDE-05 · A card is first seen at its seat

- **Rule:** A new card stays hidden (`data-entering`) until the tour has moved it to its seat (in the stage, over the dock, under the tabs or clear of the panels), and takes that first seat without the slide a mid-stop move eases through; Next takes focus once it is shown. A card never shows where driver.js rendered it and then slides across.
- **Kind:** behaviour
- **Level:** browser
- **Source:** `web/src/features/guide/tour.ts`, `tour.css`; live-site review 2026-11-11
- **Expected:** Next from the welcome → the Turn the brain card's `visibility` is `hidden`; then `visible` with its right edge already 8 px inside the stage's, and focus on Next.
- **Covered by:** `src/features/guide/guide.svelte.test.ts` (R, "a new card is hidden until it takes its seat…")

## The reader's hands

### GUIDE-06 · Turn the brain waits for the reader to turn it, says Done, then moves on

- **Rule:** The Turn the brain card carries "Try it" (« Essayez ») above its title and waits. A drag on the stage's canvas that moves more than 12 px, a wheel over it, or a camera key released on it (arrows, +, =, −) turns the brain: the line says "Done" (« Fait ») with a tick, and 700 ms later the tour moves on. A click, a press that moves less, or a drag on anything else is no turn; Next always moves on. Every stop leaves the page live and undimmed, the welcome too, so the reader can turn the brain while a card is up. Open a region keeps the reader's camera and selection: a stop whose view the page already shows (the same link parameters, in any order) dispatches no `hashchange`, so nothing is restored over the camera.
- **Kind:** behaviour
- **Level:** browser
- **Source:** `web/src/features/guide/tour.ts` (`turning`, `tried`, `sameLink`); guided tour rebuild 2026-11-11
- **Expected:** Clicks and a 6 px press → no `data-done`; a 40 px drag → `data-done`, "Done", then "Open a region" with the reader's `cam=` link unchanged and no new `hashchange`. A wheel and an ArrowLeft keyup on the canvas each mark the card done. Every stop: `data-guide-showing` on the root and no `driver-active` on the body.
- **Covered by:** `src/features/guide/guide.svelte.test.ts` (R)

### GUIDE-07 · Open a region waits for a pick, and the detail is the reader's own region

- **Rule:** The Open a region card waits, as Turn the brain does, for the engine's `pick` (a click or tap on a region of the brain; `onPick`), then moves on to The region in detail, which points at the panel (`#workspace-panel`; a phone's `#sheet`). That stop shows the region the reader last clicked during the tour, under their own camera; a reader who clicked none sees the left precentral gyrus from the home view. A pick on another card does not move it on.
- **Kind:** behaviour
- **Level:** browser
- **Source:** `web/src/features/guide/tour.ts` (`onPick`, `readersRegion`); `web/src/app/regions/MastheadRegion.svelte`
- **Expected:** A pick on Turn the brain → not done; Next past Open a region → `…&region=destrieux:left:7`. A pick on Open a region with the reader's link `…&region=destrieux:left:5&cam=1,2,3,4,5,6` → "Done", then The region in detail on the panel, that link unchanged and no new `hashchange`. In the app shell, an engine `pick` of `destrieux:left:30` moves the first visit's tour to The region in detail with that region in the link.
- **Covered by:** `src/features/guide/guide.svelte.test.ts` (R); `src/app/regions/ShellRegions.svelte.test.ts` (R)

### GUIDE-08 · A phone's sheet rises for the region's detail and comes down after it

- **Rule:** On a phone, The region in detail raises the sheet (`sheet.raise`, as a selection does) and its card sits at the stage's top, clear of the detail. The next stop, or closing the tour, lowers the sheet the tour or a pick raised (`sheet.lower`, SHEET-22a), so the later stops have the stage back. Once picked, Open a region's card stays where it is and gives back its band above the dock, so the rising sheet does not carry it over the anatomy. A desktop's panel is beside the stage: nothing is raised or lowered.
- **Kind:** behaviour
- **Level:** browser
- **Source:** `web/src/features/guide/tour.ts` (`raisesSheet`, `lowerSheet`, `stageTop`); guided tour rebuild 2026-11-11
- **Expected:** 390 px: The region in detail points at `#sheet`, sheet calls `['raise']`; Next → `['raise', 'lower']`; close → no further call. A pick then a close → one more `lower`. 1280 px → no sheet calls.
- **Covered by:** `src/features/guide/guide.svelte.test.ts` (R)
