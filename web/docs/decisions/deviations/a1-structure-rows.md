# One row per structure, with a key for each side

Chunk: A1
Status: new behaviour, Joshua's decision (2026-11-09): keys only, with no eye on a structure's row.

## Legacy behaviour

The tree listed each region as its own level-2 row: a structure with a left and a right region was two rows of one name, each ending in its side's letter and its visibility eye (`viewer/ui/panels/navigator.js:265-388`). Frontal showed 38 rows for 19 structures.

## New behaviour

Within a group, the regions of one name share a row (`structureRows`). The row's cells after the name are Mid, L and R, and each holds a key for the side the structure has there: a button named "{name}, {side}" that selects that side's region and is pressed (`aria-pressed`) while that region is the selection. A press on the row itself selects the side the selection is already on, else left, right, then midline, taking a drawn side before a hidden one. A side that is not on screen keeps its key, struck on no ground and named with its reason; a press reveals it first. A name that one side repeats keeps a row per region.

A structure's row has no eye. One side is hidden with V on its key, with Hide in the region's detail, or with its group's eye for the whole side; a hidden side is shown again from its key. Group rows keep their eyes, whose letters stand over the key columns.

Search results are unchanged, one option per region: a combobox option holds one action, so it cannot offer two sides.

## Standard cited

WAI-ARIA APG Treegrid pattern (one control per cell; Right and Left move between cells). APG Button, toggle button (`aria-pressed` for the chosen side). WCAG 2.2 SC 2.5.8 (24 px targets, 44 px on coarse pointers), SC 4.1.2.
