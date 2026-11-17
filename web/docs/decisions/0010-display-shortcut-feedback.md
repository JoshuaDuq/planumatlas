# 0010 What a display shortcut says

Status: proposed (WP19 audit, finding AT-06). Needs the maintainer's choice.

- **Problem.** The single-key display shortcuts act on the model and say nothing: C (cortex), U (internal anatomy), S (spinal cord), H (hemisphere, cycling both, left, right), E (exploded view), N (names on the brain), and F (focus) when nothing else changes. Pressed on the canvas, a screen reader user hears nothing and cannot tell which hemisphere is now shown, or whether names went on or off (WCAG 4.1.3). Only a change that drops the selection is said (CTRL-06). The same settings pressed in the Display popover are toggle buttons whose `aria-pressed` the screen reader reads, so the pointer route is not affected. The orbit chevrons are silent by an earlier decision (STAGE-27), which this does not reopen: a turn is not a state the reader needs named.
- **Options.**
  1. _Say the new state after a key._ The keymap's display commands announce, through `#announcer`, the setting as it now stands: "Cortex hidden", "Left hemisphere shown", "Names on the brain on", in both languages; a press from the Display popover stays silent, since its button already says it.
  2. _Say it from both routes._ One sentence whatever the route; the popover's buttons would then be read twice (state and sentence).
  3. _Leave them silent_ and list the shortcuts' effect in the shortcuts dialog's note, pointing to the Display popover to check.
- **Recommendation.** Option 1. It follows decision 20 on #4 (changes the reader makes directly are announced, as the sheet's detents are) and adds no control. Strings go in `areas/display.ts`, reusing `sideShown` for H.
- **Rules to change when built:** KEY-14 and KEY-23 (each key's sentence), with unit cases in `keymap.test.ts` and one browser case on the live region.
