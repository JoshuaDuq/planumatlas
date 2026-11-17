# 0009 Placing a lesion without a pointer

Status: proposed (WP19 audit, finding AT-05). Needs the maintainer's choice.

- **Problem.** Add › Lesion places and moves the sphere only by a click on the brain or a cut face ("A click on the brain: Places the lesion"). Nothing on the keyboard reaches it, so the lesion, its radius and its report are pointer-only (WCAG 2.1.1, level A). Coordinate is not a substitute: it places a fixed sphere at a published MNI coordinate, not the reader's lesion at a size they choose. A `lesion=` link places one, but that is not a control.
- **Options.**
  1. _Place at the selection._ A button in the Lesion popover, shown while a region is selected: "Place at <region>'s centre". The selection is reachable by keyboard (the tree, search, the names on the brain), and every region publishes a centroid. Then the radius slider and the report work as they do now. Smallest change; the centre is a region's, not any point.
  2. _A typed centre._ A field in the Lesion popover taking three numbers in this brain's surface RAS millimetres, as Coordinate takes MNI ones. Any point; asks the reader to know the subject's space.
  3. _Enter on the focused canvas._ While Places the lesion is chosen, Enter places the sphere on the surface under the stage's centre, which the arrows turn and Shift with the arrows moves. No new control, but invisible until announced, and the centre of the stage is not marked.
- **Recommendation.** Option 1, with the button's result said through the announcer as a click's is. It keeps the popover's one choice and needs no new coordinate space.
- **Rule to add when built:** a STAGE entry under "The Lesion popover", with a browser test that places a lesion from the keyboard alone.
