# Using the viewer

The masthead selects the subject and display layers. The panel holds searchable content; the stage contains the model and its view, section and display controls. On phones the panel is a draggable sheet. This page is a tour of the interface; each feature's own page under [Features](../features/index.md) explains how it was built.

## First steps

1. Open the [viewer](https://planumatlas.com/) and search for a region in the **Anatomy** tab. Select a result or select it on the model to see its details.
2. Choose **Section** below the model and select a plane. Move the slider to explore the cut ([Sections and cuts](../features/sections-and-cuts.md)).
3. Open **Linked MRI** from the section bar to compare the model with the subject's scan ([Linked MRI](../features/linked-mri.md)).
4. Copy the page URL to share the view, or use **Save image** to export the stage ([Sharing and snapshots](../features/sharing-and-snapshots.md)).

## Masthead

| Field | Choices |
| :--- | :--- |
| Subject | MGH CDMD (and `fsaverage` when built locally) |
| Atlas | Destrieux (74 regions per hemisphere), HCP-MMP (180 areas per hemisphere) or Julich-Brain (139 cytoarchitectonic areas per hemisphere; about a quarter of the cortex not yet mapped); see [Cortical atlases](../features/cortical-atlases.md) |
| Colour | Tissue, T1 MRI, Regions, Yeo 7 networks, CAB-NP networks; see [Dissection and display](../features/dissection-and-display.md) and [Functional networks](../features/functional-networks.md) |
| Internal anatomy | Teaching set, FreeSurfer aseg, NextBrain; see [Internal anatomy](../features/internal-anatomy.md) |

CAB-NP colours HCP-MMP areas only, so choosing it switches the atlas; the option says so before you choose it. While the Functions or Deficits tab paints the brain, Colour reads **Functions** or **Deficit**; choosing a colour there replaces the paint.

When the fields do not fit, they collapse into one summary button that opens the same fields. **⋯** holds Language, Theme, Single-key shortcuts and the keyboard shortcut list. **Save image** writes the stage as a PNG.

## Panel

Five tabs, each starting as a searchable list. Opening an item shows its detail under one location bar; **‹** returns to the list where you left it, and so does <kbd>Esc</kbd>.

| Tab | Holds | Feature pages |
| :--- | :--- | :--- |
| Anatomy | Regions, systems and the region detail | [Dissection and display](../features/dissection-and-display.md), [Atlas comparison](../features/atlas-comparison.md), [Lesion report](../features/lesion-report.md) |
| Functions | 70 Neurosynth functions | [Functions](../features/functions.md) |
| Deficits | 121 acquired-deficit profiles | [Deficits](../features/deficits.md) |
| Circuits | Five guided tours and the visual field map | [Circuits](../features/circuits.md), [Visual field map](../features/visual-field-map.md) |
| Tracts | 30 diffusion bundles | [Tracts](../features/tracts.md) |

### Region detail

Select a region in the list or on the model to open its detail: hemisphere, lobe or system, surface area or volume, centroid in RAS millimetres and the source label; **Focus**, **Isolate**, **Hide** and **Linked MRI**; and the sections below, each shown only where the region has data.

| Section | Shown for | Page |
| :--- | :--- | :--- |
| Overlap with | A cortical region | [Atlas comparison](../features/atlas-comparison.md) |
| Functional regions (group atlas) | A cerebellar lobule | [Cerebellar functions](../features/cerebellar-functions.md) |
| Boundary certainty | A NextBrain region | [Boundary certainty](../features/boundary-certainty.md) |
| Segmentation agreement | Caudate, putamen, thalamus, hippocampus, amygdala | [Segmentation agreement](../features/segmentation-agreement.md) |
| Stroke cases | A region a real stroke reached | [Stroke cases](../features/stroke-cases.md) |
| Stimulation responses | A region Lyu et al.'s map labels, or a Julich-Brain area F-TRACT has | [Stimulation responses](../features/stimulation-responses.md) |
| Functional division | An HCP-MMP area | [Functional divisions](../features/functional-divisions.md) |
| Neuropsychological functions | HCP-MMP areas and grey-matter structures | [Functions](../features/functions.md) |
| Functional networks | Cortex, and caudate, putamen and accumbens | [Functional networks](../features/functional-networks.md), [Striatal networks](../features/striatal-networks.md) |
| Blood supply | Regions with territory shares | [Arterial territories](../features/arterial-territories.md) |
| Receptor fingerprint | Areas and structures with measured densities | [Receptor fingerprints](../features/receptor-fingerprints.md) |

The eye beside a row hides that region or group; **L** and **R** act on each side. Hidden parts stay searchable, and selecting one reveals it. The line at the foot of Anatomy reads "N parts hidden · Undo · Restore all".

## Stage

The orientation gizmo at the top right shows the six anatomical directions as the camera sees them. Click a letter for that view (L for the left view, S from above), its centre for the oblique view; the chevrons around it turn the model one step, and the arrow under it is **Reset view**.

The dock at the bottom left holds four tools.

| Tool | Does | Page |
| :--- | :--- | :--- |
| Section | Chooses the cutting plane and the cut labels | [Sections and cuts](../features/sections-and-cuts.md) |
| Lesion | Places a sphere (3–30 mm radius) and reports what it reaches | [Lesion report](../features/lesion-report.md) |
| Coordinate | Places a published MNI coordinate with a 5 mm sphere | [Published coordinates](../features/published-coordinates.md) |
| Display | Hemisphere, cortex and its opacity, internal anatomy and spinal cord | [Dissection and display](../features/dissection-and-display.md), [Spinal cord](../features/spinal-cord.md) |

A cut adds the section bar above the dock: a slider and a millimetre field for the position, tilt and azimuth for an oblique plane, **Reverse side**, **Linked MRI**, and × to return to the full brain. Positions are surface RAS millimetres: +R right, +A anterior, +S superior.

## Status bar

"Not clinical anatomy", a description of the subject, the visible region count and **Provenance**, which lists the subject, reconstruction, atlases, published files and sources.

## Keyboard

Press <kbd>?</kbd> in the viewer for the live list. Single-key shortcuts can be turned off under **⋯**.

| Keys | Action |
| :--- | :--- |
| <kbd>/</kbd> | Focus the search field |
| <kbd>←</kbd> <kbd>→</kbd> | On the tabs: move between tabs |
| <kbd>↑</kbd> <kbd>↓</kbd>, <kbd>Home</kbd> <kbd>End</kbd> | Move through results or the tree |
| <kbd>→</kbd> <kbd>←</kbd> | In the tree: open or close a group, or reach a row's eye |
| <kbd>Enter</kbd> | Select the focused region |
| <kbd>V</kbd> | Hide or show the focused tree row |
| <kbd>Esc</kbd> | Back to the list; elsewhere clear the search, then the selection |
| <kbd>Tab</kbd> | Move focus to the model |
| Arrows, <kbd>+</kbd> <kbd>−</kbd> | Turn and zoom the focused model |
| <kbd>1</kbd>–<kbd>6</kbd>, <kbd>0</kbd> | Left, right, anterior, posterior, superior, inferior; oblique |
| <kbd>F</kbd>, <kbd>I</kbd> | Focus, isolate the selected region |
| <kbd>C</kbd>, <kbd>U</kbd>, <kbd>S</kbd> | Show or hide cortex, internal anatomy, spinal cord |
| <kbd>H</kbd> | Cycle hemisphere: both, left, right |
| <kbd>M</kbd> | Open or close the linked MRI |
