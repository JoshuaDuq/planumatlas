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

### GUIDE-03 · A first visit runs six stops after the welcome; its last card starts the full tour

- **Rule:** The tour a first visit starts by itself (`ports.startGuide(true)`) is the welcome card, then six stops: the brain, a region's detail (the panel, opened on the left precentral gyrus), the tabs ("Five ways in"), Functions, Section, and the dock as a whole ("Tools on the picture", saying what Add brings onto the brain: a lesion, a published coordinate, the reader's own map). Its last card offers "See everything (N stops)" on a line of its own under its words (« Tout voir (N étapes) »), N the full tour's stops this layout can show; it starts the full tour over the same reader's view, which comes back only when that tour ends. ⋯ › How to use Planum runs every stop. The welcome stays first: it holds the language choice, Skip tour and the not-clinical statement (supervisor review 2.3; ruling recorded in the run's ledger).
- **Kind:** behaviour
- **Level:** browser; unit for boot's call
- **Expected:** titles "How to use Planum", "The brain", "A region’s detail", "Five ways in", "Functions", "Section", "Tools on the picture"; the last card's `.guide-everything` reads "See everything (16 stops)", under the card's words and outside its footer, whose count, Back and Done share one line; pressing it shows "How to use Planum" at "1 of 16" with no close counted; closing then restores the reader's hash. Boot on a plain first visit → `startGuide(true)`.
- **Covered by:** `src/features/guide/guide.svelte.test.ts`, `src/app/boot.svelte.test.ts` (R)

### GUIDE-04 · The Lesion, Coordinate and Overlay stops point at Add, and only at a choice it offers

- **Rule:** Lesion, Coordinate and Overlay are Add's choice (STAGE-65), so their stops point at the Add tool, each through what it says it offers (`.stage-tool[data-tool="place"][data-offers~="…"]`). A stage whose Add offers no Overlay (a phone's) or no Coordinate has no stop for it, and the count follows. The opening picture's lobes stay through the tour (`colors=lobe` is kept in the tour's home view); a stop on an atlas without lobes shows that atlas's regions, and any other colour of the reader's gives way to the stops' own.
- **Kind:** behaviour
- **Level:** browser
- **Source:** `web/src/features/guide/tour.ts`; parsimony round 2026-11-11
- **Expected:** full dock → the Lesion, Coordinate and Overlay cards each point at "Add"; a 390 px phone → Lesion and Coordinate point at "Add" and there is no Overlay card. Fixture with `data-offers="lesion coordinate"` → "1 of 15", a Coordinate card, no Overlay card.
- **Covered by:** `src/features/guide/guide.svelte.test.ts` (R, with "GUIDE-04 · the opening lobes stay…"); `src/features/stage/Dock.svelte.test.ts` (R, "the guided tour's dock stops…")

### GUIDE-05 · A card is first seen at its seat

- **Rule:** A new card stays hidden (`data-entering`) until the tour has moved it to its seat (in the stage, over the dock, under the tabs or clear of the panels), and takes that first seat without the slide a mid-stop move eases through; Next takes focus once it is shown. A card never shows where driver.js rendered it and then slides across.
- **Kind:** behaviour
- **Level:** browser
- **Source:** `web/src/features/guide/tour.ts`, `tour.css`; live-site review 2026-11-11
- **Expected:** Next from the welcome → the brain card's `visibility` is `hidden`; then `visible` with its right edge already 8 px inside the stage's, and focus on Next.
- **Covered by:** `src/features/guide/guide.svelte.test.ts` (R, "a new card is hidden until it takes its seat…")
