# 0011 The side sheet on a narrow landscape screen

Status: proposed (WP19 audit, finding AT-07). Needs the maintainer's choice.

- **Problem.** Under `(max-height: 480px) and (orientation: landscape)` the sheet grows across the screen (`SIDEWAYS_DETENTS`: peek 216 px or the tab row, half 0.5, full 0.62 of the width). The tab row is about 370 px, so on a screen under about 600 CSS px wide the three rests collapse into one: at 568 × 320 (a small phone turned sideways) peek, half and full are all 370 px, the stage keeps under 200 px, and the handle, named "Expand panel", changes nothing when pressed. At 400 % zoom on a 1280 × 1024 screen (320 × 256 CSS px, the WCAG 1.4.10 reflow case) the rail is the whole width: the stage, the dock and the gizmo sit under it and cannot be uncovered. At 200 % zoom on a 1366 × 768 laptop (683 × 384) the stage keeps about 310 px. Affects WCAG 1.4.10 (reflow) and 4.1.2 (a control whose name promises a change it does not make).
- **Options.**
  1. _Upright below a width._ Use the bottom sheet whenever the side rail would leave the stage less than half the width (in practice, landscape under about 740 px). The upright sheet already works at 320 px wide; a 256 px tall screen then gets its peek (the grip) and half rests over a short stage.
  2. _A rail that can fold._ Let the side rail's peek be the grip alone, as the upright peek is, with the tabs hidden at peek (decision 0006's peek semantics, sideways), so the handle always uncovers the stage.
  3. _Tabs that scroll._ Cap the rail's peek at a share of the width and let the tab row scroll sideways inside it.
- **Recommendation.** Option 1: no new state, and the narrow-landscape case falls back to the layout the 390 px journeys already test. Whatever is chosen, the handle must never cycle rests of equal size: a press that cannot change the sheet should not be offered.
- **Rules to change when built:** SHEET-29 (320 px) gains the 320 × 256 and 568 × 320 cases; the handle's name rule (decision 0006) gains "never offered when the rests coincide".
