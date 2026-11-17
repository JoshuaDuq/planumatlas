# 0012 The tour's hands-on cards and the keyboard

Status: proposed (WP19 audit, finding AT-08). Needs the maintainer's choice.

- **Problem.** Two cards of the guided tour ask the reader to try something, under "Try it": Turn the brain ("Drag to turn it. Scroll or pinch to zoom…") and Open a region ("Click or tap any region of the brain."). Neither says how to do it from a keyboard, and the second cannot be done from one: it waits for a pick on the canvas (`onPick`), which no key makes; choosing a region in the tree or the search does not count. While the card holds focus its arrows step the cards (ArrowRight is Next), so the arrows that would turn the model step on instead. Next always moves on and the tour then selects a region itself, so nothing is blocked (WCAG 2.1.1 is met through Next), but the keyboard reader is asked to do what they cannot. Screen-reader users hear "Try it" (a polite live line) and the pointer instructions.
- **Options.**
  1. _Keyboard words, and the list counts._ Turn the brain adds "or, with the brain focused, the arrow keys"; Open a region adds "or choose one in the list", and a selection from the tree or the search completes the card as a pick does.
  2. _Words only._ Add the keyboard sentence to both cards; a selection from the list still does not count, and Next remains the way on.
  3. _Leave as is._ The tour is optional and Next works.
- **Recommendation.** Option 1. It keeps the cards' hands-on intent for every reader. The tour's copy is in `areas/guide.ts` (both languages) and the pick hook in `features/guide/tour.ts`.
- **Rules to change when built:** GUIDE (the stops' copy and what completes "Open a region").
