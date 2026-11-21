# Changelog

Notable changes to Planum, as a reader of [planumatlas.com](https://planumatlas.com/) would notice them.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Planum has no numbered
releases yet: the live site is deployed from `main`.

## [Unreleased]

### Added

- **Names on the brain** (Display) names the regions facing the reader, largest first, in columns beside
  the brain with a leader to each, as an atlas plate does; zooming in names smaller ones. Names hold
  still as the view turns or zooms and as a cut moves, fade where their region goes out of sight, and
  each is written once.
- **Highlight** marks a region in a colour of the reader's own; the stage keys them as **Your highlights**.
- **References for this view**: the sources behind what is shown, copied as text or downloaded as .bib or
  .ris; the region table of the whole atlas downloads as CSV.
- **Copy embed code** puts a view in a course page, with **Open in Planum**; images save at 2× or 3× and
  can be copied.
- Cortical layers from one histological brain (BigBrain) in a region's sheet, and **Layer IV** as a colour.
- The brainstem arousal nuclei of the Harvard Ascending Arousal Network Atlas 2.0, placed on this brain.
  The periaqueductal grey is published under an exception the region's sheet states.
- Stimulation responses (F-TRACT): **Peak delay by distance**, with a table of delays and distances.
- Visual field map: **Name the visual areas** outlines and names the 25 areas of Wang et al. (2015).
- Shift and an arrow key pan the model, and the shortcuts dialog lists what a mouse or finger does on
  it.
- Stroke cases: a sortable **Table of cases** under the plot; each dot takes a press anywhere nearer it
  than any other dot, and the plot's labels grow with the reader's text size.
- The feedback form takes an optional reply address and says why a send failed.
- Colour **Striatal networks** and **Cerebellar functions** (group **Subcortical maps**): each draws its
  map voxel by voxel on cut faces, everything else in tissue colour, with a key.
- **Circuits** has 45 tours and 124 landmarks, up from five tours and 25: 35 new pathway tours across
  sensory, motor, cerebellar, hippocampal, limbic, association and commissural systems, and the touch,
  pontine motor, colour, navigation and valuation tours back from the archive, each re-checked against
  its sources.
- **Deficits** has 149 profiles, 271 findings and 472 references, up from 131, 218 and 339, among them
  palinacousis, prosopometamorphopsia, utilization behaviour, musical alexia and receptive aprosodia.

### Changed

- A deep structure under 100 mm³ no longer shows percentage shares of arterial territories or striatal
  networks. It names the territories or networks within 3 mm of it, and says when a border passes that
  close: registered group maps land fine structures a median 1.2 mm off, too coarse to share out one
  that small. **Provenance** lists every registered map with what was measured of its registration.
- Deficit findings were re-read against their sources, 59 references now from the full text rather than
  the abstract. Findings whose lesions lie in white matter or cannot be placed on a labelled structure
  (such as amnesia after fornix or diencephalic injury) no longer colour a region.
- The visual tour's optic tract and lateral geniculate nucleus are NextBrain's own labels, and the memory
  tour's stops are NextBrain's except the mammillary nuclei.
- Planum opens on Destrieux in its **Regions** colours, not **Lobes**, and **Start over** returns to
  Destrieux in Regions from any atlas. Lobes stays one choice under **Colour**; a link keeps the colour
  it was written with.
- A cut shows what the brain shows: its labels follow **Atlas**, **Colour** and **Internal anatomy**
  instead of a **Cut labels** choice of their own, which is gone, with its `cuts` link key. Switching the
  atlas relabels an open cut; NextBrain puts its labels on the cut inside the atlas's cortex; the arterial
  territories, striatal networks and cerebellar functions come with their colour. A region only those put
  on a cut is found by search and revealed by changing that control.
- Linked MRI: a Window, Level or FA opacity change redraws from what each plane already sampled, about ten
  times faster.
- Lesion report: a lesion's tracts are counted in a worker, four bundles at once; a lesion moved nearby is
  counted again without downloading anything.
- Atlases, detail levels and tracts no longer shown are released, so a long session holds much less
  memory. One shown again is downloaded again.
- Moving the view no longer walks every region again for the region list, the lobe key, the system picker
  or a search.

### Fixed

- Picking a nucleus inside the brainstem or cerebellum (an arousal nucleus, the red nucleus, the substantia
  nigra, the dentate) opens it focused, as a deep forebrain structure opens; before, it was framed behind
  the opaque temporal lobe and nothing of it showed.
- **Copy as text**, **Download .bib** and **Download .ris** in Provenance take the app's button style
  instead of the browser's grey default.
- With a function painted, changing the atlas now repaints the stage, the cut and the Linked MRI; before,
  the previous atlas's colours stayed until the page was loaded again.
- A cut no longer keeps the previous atlas's labels after the atlas changes, which left the cut face, the
  Anatomy list and selection on different atlases.

### Security

- The site sends a Content-Security-Policy, and the methods pages serve MathJax themselves instead of from
  a CDN.
- The Overlay refuses map files over about 528 MiB and stops inflating a `.nii.gz` past the size its
  header states.

[Unreleased]: https://github.com/JoshuaDuq/planumatlas/commits/main
- On the NextBrain detail level the spinal cord now meets the medulla. NextBrain labels no medulla in
  the 12 mm above the cord, and the cord stood apart from the brainstem, as in the rubrospinal tour;
  that stretch is now drawn from FreeSurfer's brainstem label, as the teaching set already drew it.
- A circuit's whole route is headed by the circuit's name, which the location bar truncates, instead of
  "The whole route".
