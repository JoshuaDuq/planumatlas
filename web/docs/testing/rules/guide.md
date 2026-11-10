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
