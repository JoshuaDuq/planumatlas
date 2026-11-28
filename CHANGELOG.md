# Changelog

Notable changes to Planum, as a reader of [planumatlas.com](https://planumatlas.com/) would notice them.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The live site is
deployed from `main`, so it can run ahead of the latest numbered release.

## [Unreleased]

## [0.1.3] - 2026-11-27

Archived at [doi:10.5281/zenodo.24616739](https://doi.org/10.5281/zenodo.24616739).

### Added

- **Circuits** › **Maps** offers a **Body map**: the central strip of both hemispheres coloured by where
  moving the foot, the hand or the tongue raises activity most, from the Human Connectome Project's group
  maps of 486 adults. A choice shows one part alone, and a table gives each part's area per hemisphere.
  It is a group average placed on this brain by its folding, drawn on the strip alone: most of the foot's
  activity lies elsewhere, and the panel says so. Opens with `map=body-map`, on CDMD and the MNI template.
- The **Basal ganglia motor loops** circuit shows **Excitation and inhibition**, a flat diagram of its six
  landmarks and the sign of each projection between them: an arrowhead and a + where a projection excites,
  a bar and a − where it inhibits. A box opens its landmark and stays where it stands in the panel. The
  diagram is a schematic: its lines are not fibre paths.
- A grouped structure whose parts make up most of a system offers **Parts** on its sheet. The thalamus
  shows its nuclei alone at the NextBrain level, listed by name. The hypothalamus, hippocampus, amygdala,
  septal nuclei, subthalamic nucleus, lateral ventricles and corpus callosum offer the same.
- The guided tour stops at the top bar's **Atlas**, **Colour** and **Internal anatomy** lists, beside
  **Subject**. Each stop opens the lists, points at one and makes a choice in it, so the change shows on the
  brain: HCP-MMP for the atlas, one colour per lobe, and FreeSurfer aseg inside the left hemisphere. A first
  visit's tour includes the Internal anatomy stop. These replace the stop that only named the top bar.
- **Tracts** on CDMD draws the middle and inferior cerebellar peduncles, under a new **Cerebellar tracts**
  class, and the anterior thalamic radiations, under **Projection tracts**, all tracked by TractSeg in the
  subject's own scan. The MNI template draws the HCP1065 atlas's anterior thalamic radiations. Each passed
  a test of where its streamlines end and run, set before it was tracked; the template's peduncles, and the
  anterior commissure and fornix on both brains, did not and are not drawn. A lesion report counts them in
  its **Tracts** section, the middle peduncle, which crosses the midline, for a lesion on either side.
- Five guided circuits draw these tracts at the landmarks they run through: the middle cerebellar peduncle
  at the pontine motor tour's right pons, the inferior cerebellar peduncle at the vestibular, dorsal
  spinocerebellar and olivocerebellar tours' peduncle, and the left anterior thalamic radiation at both
  mediodorsal–prefrontal landmarks. **What this atlas shows** names the drawn bundle and its dataset, as
  **Tracts** names it. On the MNI template, which has no peduncles, the line says these streamlines are
  on CDMD sub_013 only, and the mediodorsal–prefrontal landmarks draw HCP1065's radiation.
- Each other cortical atlas in the top bar's **Atlas** list has a **Borders** toggle that draws its area
  borders as lines over the shown atlas's cortex. The stage key becomes an **Atlas comparison** naming
  both atlases, with **Remove borders**, and the hover chip names the point in both. Opens with
  `borders=<atlas>`, on CDMD and the MNI template.
- The **Overlay** draws a second map over the first, each with its own file, threshold, colour scale and
  opacity. The second scale is green for positive values and magenta for negative. **Draw on top** swaps
  them, and the cortex, cut faces, deep surfaces and Linked MRI stack them alike.
- Search finds HCP-MMP and Julich-Brain areas by their classical names, in English and French: primary
  visual, motor, somatosensory and auditory cortex, V1, M1, S1, A1, Broca's area and Brodmann areas 1–4,
  17, 44 and 45. Every HCP-MMP code also answers to "area <code>".
- **Circuits** has a search over circuit titles, routes and landmark names.
- Tooltips show a control's keyboard shortcut, and the **Display** popover shows each box's key at the end
  of its row, while single-key shortcuts are on.
- A **Contact** button beside the GitHub link gives the maintainer's address; phones find it in the
  settings panel.
- A region opened from a function's or deficit's list that other structures hide from view gets a notice
  with **Focus region**, which focuses it in place and keeps the map and its profile open.

### Changed

- The **Circuits** list opens on its **Maps**, above the guided circuits: below 45 circuits they went
  unnoticed.
- The touch circuit is named **Dorsal column–medial lemniscus pathway**. Its landmarks are unchanged: it
  still begins at the thalamus, where the lemniscus ends.
- **NextBrain** draws the cerebellum, the corpus callosum and the ventricles. It showed the cerebellar
  nuclei with nothing around them and left the medial wall empty, because NextBrain meshes neither its
  cerebellar cortex nor the white matter holding its callosum, and labels no ventricles. It now draws the
  **Teaching set**'s cerebellar lobules (aseg's cerebellar cortex on a brain without lobules), corpus
  callosum, lateral ventricles and third and fourth ventricles, and **Cerebellar functions** colours the
  lobules there as on the other levels. The pontine motor tour's whole route shows its lobule V.
- The **Internal anatomy** list marks the **Teaching set** **(Default)**, as the **Atlas** and **Colour**
  lists mark theirs.
- A lesion report's **Tracts** section folds the bundles the lesion misses under one line that counts
  them, such as "32 bundles not reached", where it listed every name in a paragraph.
- A guided circuit is no longer left out of a brain that lacks one of its landmarks' tracts: that landmark
  draws none, and its notes say which brain has them. The corticospinal landmarks name their streamlines
  in that generated line instead of a written sentence.
- A first visit no longer starts the guided tour by itself: the stage offers **Take the tour** instead.
- The **Internal anatomy** list reads **NextBrain (more precise)** and **FreeSurfer aseg (less precise)**.
- On a cut, the structures the cut face shows are named before the gyri around them: Destrieux at coronal
  0 mm names 14 structures on the face, up from 4, and NextBrain 13, up from 3.
- A function, a searched term or the overview painted on Julich-Brain says that its gap maps, a quarter of
  the cortex, are not areas, so no function scores them.
- **Tracts**' **Drawn bundles** preview names the first two bundles and counts the rest.
- The Linked MRI's three-plane layout is named **Orthogonal views**, and a guided circuit's button
  **Start route**.
- A saved image no longer carries the "Not clinical anatomy" line.
- The site counts page views with Cloudflare Web Analytics, one per page load.

### Fixed

- The guided tour's **Settings** stop ringed **Save image** instead of the **⋯** button.
- The guided tour's **Subject** card lay over the **Internal anatomy** list. A card about one of the top
  bar's lists now sits in the stage's far corner, and the lists stay open from one of these stops to the
  next.
- The exploded view at the NextBrain level moved nearly the whole forebrain as one block, and cut
  structures such as the hippocampus into pieces that drifted apart. A structure drawn in parts now moves
  whole, at every level: the hippocampal formation with its layers, the thalamus with its nuclei, the
  corpus callosum with its segments. A structure labelled on one side only no longer holds the two sides
  together, so the left and right deep structures part as they do at the teaching level.
- The first exploded view of a level jumped part of the way open: its layout was measured after the
  move had started. It is now measured first.
- On some Android phones the cortex was not drawn while the deep structures were: its shader used every
  vertex attribute WebGL 2 guarantees. It now uses 13 of 16.
- With all CDMD bundles drawn and the Linked MRI open, each step of the cut slider blocked the page for
  about 330 ms. A step now takes about 22 ms, and the stage draws the slide at its motion resolution.
- A map below full opacity drew darker on the Linked MRI than on the cut faces and cortex: the Linked MRI
  now mixes it in linear light, as they do.
- A name carried onto a cut face while the slider moved could point at another region the face showed
  there, such as the pallidum's name on white matter. It now fades.
- Holding a slider in the **Add** popover hid its **Lesion** and **Stroke** tabs.
- The gizmo's **Reset view** button drew over tooltips.
- The MNI template's validation stopped at two units lying under aseg's corpus callosum, so its report
  was not published. Both are declared with their measured overlap and the report is published.

## [0.1.2] - 2026-11-25

Archived at [doi:10.5281/zenodo.24538436](https://doi.org/10.5281/zenodo.24538436).

### Added

- On the **MNI template**: gyral white matter, the search of 277 further Neurosynth terms, atlas comparison,
  the arterial territories (Liu et al. 2023) and the brainstem arousal nuclei, and **Coordinate** and
  **Overlay** read coordinates and maps in SPM12's space. Each met the checks its CDMD sub_013 counterpart
  met, fixed in advance. The arousal nuclei were placed by SegmentAAN, as on CDMD, so coma, the one deficit
  profile the template lacked, is listed there too. The visual field map and the stroke cases failed those
  checks on the template and stay on CDMD sub_013, with the spinal cord.
- **Colour › Morphometry** offers **Cortical thickness**, FreeSurfer's measure on CDMD sub_013, and
  **Sulcal depth**, on both brains. A region's **Measurements and source** gives its mean thickness.
- The Yeo networks key opens a **Correlation matrix**: resting-state correlations between Schaefer's 200
  parcels, sorted by Yeo's seven networks, with each pair of networks' mean. Six of the seven networks
  correlate more within themselves than with any other; limbic does not, and the dialog says so.
- **Linked MRI** offers **Serial sections**: eleven evenly spaced sections across the brain beside a
  localizer, saved as one sheet. Its **Overlay** can show the 3D view's colours on the scan, the selected
  region is outlined there, and the crosshair can be hidden.
- Every cortical region lists the Neurosynth functions and terms whose maps reach it, each opening its map.
  A Destrieux or Desikan-Killiany region lists them by how much of it lies in the HCP-MMP areas they reach.
- A masthead button links the GitHub repository.

### Changed

- **Names on the brain** now names what is actually seen: a region hidden behind another is no longer
  named, each dot stands in the middle of the part that shows, and a cut names its faces as they are seen.
  Pointing at a name marks its region on the brain, and pointing at a region lights its name. Names no
  longer run under an open Display or Section menu, and zoomed in each stands level beside its dot.
- **Cerebellar functions** now colours the outside of the cerebellum too, point by point from the map 1 mm
  beneath the surface, as well as the cut faces. Pointing at the cerebellum names the functional region there,
  and a click selects it, with or without a cut.
- A region's summary is set as labelled rows. A region with no listed function has no Neuropsychological
  functions row, where it read "0", and its deficits list is headed **Linked deficits**.
- Leaving **Functions** or **Deficits** for another tab puts the previous view back without a notice;
  **Restore previous view** still says so. The data popover's lists mark each default.
- The data popover stands its lists two by two, so all four fit a laptop window. On a phone, an opened tool
  brings the sheet down, the settings menu takes the screen's width, the orientation gizmo's reset sits in
  its left corner and, upright, the gizmo shares its row with the stage key. A phone on its side keeps a
  tool's plate beside the brain when the brain keeps room.
- The page draws the workspace's frame before the app's script loads, so a first visit no longer opens on a
  blank page.
- The methods pages are rewritten in one order (Data, Method, Display, Validation, Limitations, Code
  availability), and every figure is redrawn in light and dark.

### Fixed

- A selected region's ring ran along only part of its border; it now goes all the way round, and a hovered
  region gets a fine line.
- A translucent cortex no longer speckles where a far fold blended over a near one, and a selected region's
  outline no longer traces the part a cut has removed.
- Names on the brain are chosen again once an exploded view's pieces arrive, and keep moving on slow frames.
- NextBrain's labels now also cite Puonti et al. (2026), the fast segmentation that produced them, beside
  Casamitjana et al. (2025), in the reference list and on the methods pages.
- The internal anatomy methods page no longer says the sliced `conv3d` workaround changes no computed value. It
  changes SuperSynth's convolutions by rounding, and its effect on the labels was not measured.

## [0.1.1] - 2026-11-22

Archived at [doi:10.5281/zenodo.24449724](https://doi.org/10.5281/zenodo.24449724).

### Added

- On the **MNI template**, Colour offers **Striatal networks** (Choi et al. 2012) and **Cerebellar functions**
  (Nettekoven et al. 2024), registered onto the template by the steps that register them onto CDMD sub_013 and
  held to the same limits.
- On the **MNI template**, **Tracts** draws 21 bundles of the HCP1065 population-averaged atlas (Yeh 2022),
  placed by the template's scale with no registration, in 3D and on **Linked MRI**. Before, it showed CDMD's
  tracts in CDMD's outline. No FA map or tract profile is published for the template.
- On the **MNI template**, the cerebellum is divided into CerebNet's 25 lobules, as on CDMD sub_013, so 148 of
  149 deficit profiles and 41 of 45 circuits are listed there (before: 141 and 35). The averaged scan no longer
  shows the fissures of the cerebellar hemispheres, so the lobule borders there are CerebNet's placement,
  checked against SUIT's lobules.
- The methods pages describe the MNI template on a page of its own, with a figure comparing it with CDMD
  sub_013, and Tracts adds a figure of the template's bundles. The README has a section on the template.
- The guided tour has a stop on **Subject**, where the reader chooses between CDMD sub_013 and the MNI template.

### Changed

- **Functions** opens on its list again, not on **All functions**; nothing is painted until a function is chosen.
- Choosing **Striatal networks** or **Cerebellar functions** with no cut open opens one through the map, axial
  through the striatum and coronal through the cerebellum, turned to face the reader. Before, the brain looked
  unchanged until a cut was made.

### Fixed

- On the MNI template, the guided tour's lesion stop placed its lesion outside the brain. It is now centred on
  the precentral gyrus of whichever brain is open.

## [0.1.0] - 2026-11-21

The first numbered release, archived at [doi:10.5281/zenodo.24428326](https://doi.org/10.5281/zenodo.24428326).

### Added

- **Subject** (in the data popover under the masthead) offers the **MNI template** (ICBM 152 2009c) beside
  CDMD sub_013, at the mean adult brain size. Coordinates and maps in MNI152NLin2009cAsym land on it
  directly, with no registration. It has no tracts, cerebellar lobules or spinal cord of its own, so the
  8 deficit profiles and 10 circuits that need them stay on CDMD, and each tab says how many.
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
- The settings menu (⋯) links the source code on GitHub, after **Methods**.
- Colour **Striatal networks** and **Cerebellar functions** (group **Subcortical maps**): each draws its
  map voxel by voxel on cut faces, everything else in tissue colour, with a key.
- **Circuits** has 45 tours and 124 landmarks, up from five tours and 25: 35 new pathway tours across
  sensory, motor, cerebellar, hippocampal, limbic, association and commissural systems, and the touch,
  pontine motor, colour, navigation and valuation tours back from the archive, each re-checked against
  its sources.
- **Deficits** has 149 profiles, 271 findings and 472 references, up from 131, 218 and 339, among them
  palinacousis, prosopometamorphopsia, utilization behaviour, musical alexia and receptive aprosodia.

### Changed

- The data control under the masthead reads as one line, "Subject Individual Atlas Destrieux Colour
  Regions", and opens each choice as a list in which one press chooses and the popover stays open. Each
  atlas and level says what it is in a few words, and a colouring with colours of its own shows them. On
  a wider screen the open popover takes a band off the stage's left, so the brain stays framed beside it.
- A deep structure under 100 mm³ no longer shows percentage shares of arterial territories or striatal
  networks. It names the territories or networks within 3 mm of it, and says when a border passes that
  close: registered group maps land fine structures a median 1.2 mm off, too coarse to share out one
  that small. **Provenance** lists every registered map with what was measured of its registration.
- Deficit findings were re-read against their sources, 59 references now from the full text rather than
  the abstract. Findings whose lesions lie in white matter or cannot be placed on a labelled structure
  (such as amnesia after fornix or diencephalic injury) no longer colour a region.
- The visual tour's optic tract and lateral geniculate nucleus are NextBrain's own labels, and the memory
  tour's stops are NextBrain's except the mammillary nuclei.
- A circuit's whole route marks each landmark on the brain with its number alone: the landmark list names
  them, and a number's tooltip names its landmark.
- The brain sits level: named views, the opening view, turning the model and the orientation letters
  even out the head's slight sideways lean in the scanner (2.6° of roll, 1.9° of yaw), as the exploded
  view already did. Front to back it stays as scanned, and cuts and Linked MRI keep the scan's planes.
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
- A region's sheet opens with one plain line: its main network, its leading functions and its linked
  deficits. Area, centroid and source fold under **Measurements and source**, and the search above the
  sheet is an icon in its location bar.
- **Functions** opens on **All functions**, its 11 domains as the list, when no function, search or region
  is open.
- On a phone the sheet at rest offers the tab's search, with "Not clinical anatomy" under it; a tap opens
  the list full with the field ready. The orientation gizmo's turn arrows show only while it is touched.
- Anatomy search lists each structure once, with the tree's L and R keys (a press on a key picks that
  side). Matches in another structure set follow under **Also in …** instead of each saying "In
  FreeSurfer aseg".
- A cortical region chosen by name in the Anatomy list is focused, so it stands out from the atlas's
  colours.
- **Stroke cases** in Deficits, with nothing selected, opens on the region shown that the most lesions in
  the cohort reach, and says so.
- A lesion simulated from Deficits shows its report there instead of switching to Anatomy.
- **Add** in the stage dock says in its tooltip what it adds.
- Just wider than a phone (an upright tablet at 820 px), **Linked MRI** opens over the page, as on a phone,
  instead of squeezing the stage to about 260 px beside it.

### Fixed

- In the exploded view both sides of the brain part alike: a structure that had to stay joined to its
  neighbour on one side no longer leaves its counterpart on the other side to fly off alone, as the right
  amygdala and the left fornix did on the MNI template.
- On the NextBrain detail level the spinal cord now meets the medulla. NextBrain labels no medulla in
  the 12 mm above the cord, and the cord stood apart from the brainstem, as in the rubrospinal tour;
  that stretch is now drawn from FreeSurfer's brainstem label, as the teaching set already drew it.
- A circuit's whole route is headed by the circuit's name, which the location bar truncates, instead of
  "The whole route".
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

[Unreleased]: https://github.com/JoshuaDuq/planumatlas/compare/v0.1.3...main
[0.1.3]: https://github.com/JoshuaDuq/planumatlas/releases/tag/v0.1.3
[0.1.2]: https://github.com/JoshuaDuq/planumatlas/releases/tag/v0.1.2
[0.1.1]: https://github.com/JoshuaDuq/planumatlas/releases/tag/v0.1.1
[0.1.0]: https://github.com/JoshuaDuq/planumatlas/releases/tag/v0.1.0
