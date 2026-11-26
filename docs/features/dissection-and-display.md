# Dissection and display

The viewer draws the model from one set of published meshes under a display state: a colour mode, a hemisphere and cortex setting, a set of hidden regions, an isolated region and a Focus ghost. Only shading fields are computed at build time. Sulcal depth, cortical openness and ribbon T1 intensity, taken from the subject's FreeSurfer surfaces and T1-weighted magnetic resonance imaging (MRI) volume, are baked into every cortical vertex of the pial surface and drive fold occlusion and tissue colour in the shader. The shading is illustrative; it is not a measured optical or histological property.

```{figure} figures/dissection-and-display-1-light.webp
:alt: Eight views of the brain from the left. Top row, the cortex in tissue colour, in T1 grey, in Destrieux region colours and in Yeo 7 network colours. Bottom row, arterial territory colours, the same hemisphere with the central region's parcels hidden to show white matter, the left hippocampal formation isolated, and the hippocampal formation in colour inside a grey see-through brain.
:name: fig-dissection-and-display-1

**One brain takes five colourings and three dissection states.** **a**–**e**, **Colour** set to [**Tissue**](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&view=left&colors=tissue) (**a**), [**T1 MRI**](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&view=left&colors=mri) (**b**), [**Regions**](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&view=left) with the Destrieux atlas (**c**), [**Yeo 7 networks**](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&view=left&colors=network) (**d**) and [**Arterial territories**](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&view=left&colors=territory) (**e**). **f**, [Eight Destrieux parcels of the left central region hidden](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&view=left&hidden=destrieux:left:15,destrieux:left:28,destrieux:left:29,destrieux:left:45,destrieux:left:53,destrieux:left:67,destrieux:left:68,destrieux:left:69) (the precentral, postcentral and middle frontal gyri, the central sulcus, the two parts of the precentral sulcus, the postcentral sulcus and the middle frontal sulcus), which exposes the subject's own white surface. **g**, [The left hippocampal formation of the teaching set isolated](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&view=left&isolate=learning:left:hippocampus), with the camera framing the region. **h**, [The same region under **Focus**](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&view=left&region=learning:left:hippocampus&focus=1), with the rest of the model a grey ghost at opacity 0.15. All panels show CDMD `sub_013` from the left, and **f**–**h** are in **Regions** colour. Scale bars apply at the depth of the camera's target.
```

## Data

The shading fields were computed from four inputs in the subject's FreeSurfer 8.2 reconstruction.

| Input | Content | Used for |
| :--- | :--- | :--- |
| `lh/rh.pial` | Pial surface of each hemisphere | Vertex positions, openness, the outer point of each pial–white pair |
| `lh/rh.white` | White surface, vertex for vertex with the pial | The inner point of each pair, whose midpoint is sampled for `_T1` |
| `lh/rh.sulc` | Sulcal depth at each pial vertex | `_SULC` |
| `mri/orig.mgz` | T1 volume | `_T1` |

The build writes the fields into each cortical atlas file as vertex attributes.

| Attribute | Written to | Storage | Meaning |
| :--- | :--- | :--- | :--- |
| `_SULC` | `cortex-<atlas>.glb` | `uint16`, normalised to one range per file | FreeSurfer `lh/rh.sulc`; positive in sulci |
| `_OPENNESS` | `cortex-<atlas>.glb` | `uint16`, normalised | Cosine-weighted share of the sky a pial vertex sees past its own hemisphere |
| `_T1` | `cortex-<atlas>.glb` | `uint16`, normalised | `orig.mgz` at the pial–white midpoint |
| `_NETWORK`, `_TERRITORY` | `cortex-<atlas>.glb` | `uint8` | Yeo 7 network (0 unassigned); arterial territory index |

The ranges are recorded once in the manifest as `appearance.field_ranges`. On subject sub_013 of the MGH Connectome Diffusion Microstructure Dataset (CDMD), `_SULC` spans −14.05 to 17.40, `_OPENNESS` $2.6 \times 10^{-5}$ to 1.0 and `_T1` 38.99 to 203.24. The first cortical atlas measures them and the others are encoded to the same span, so one decode serves all five files. The 25 cerebellar lobule meshes of the teaching set (`learning.glb`) carry `_OPENNESS` as well, encoded to the same span ([internal anatomy](internal-anatomy.md)). Colour tables come from the [cortical atlases](cortical-atlases.md), [functional networks](functional-networks.md) and [arterial territories](arterial-territories.md) layers. Nothing is written for the colour modes (Fig. 1a–e).

## Method

### Sulcal depth and ribbon T1

`lh/rh.sulc` was read unchanged. `orig.mgz` was sampled trilinearly (SciPy 1.18.1, `map_coordinates`, order 1, no prefilter) at the midpoint of each corresponding pial and white vertex in tkregister RAS (right, anterior, superior), FreeSurfer's surface coordinates. A midpoint outside the grid fails the build. Both fields, and openness, were carried onto the atlas partition by `partition_vertex_field`, which is linear on the barycentric partition, so a field is continuous across parcel borders.

### Cortical openness

Openness was computed for each pial vertex with unit normal $\mathbf{n}$ (`cortical_openness`) in four steps.

1. $N$ = `occlusion.direction_count` = 256 unit directions $\mathbf{d}_k$ were placed on a Fibonacci lattice. The lattice is fixed, so the field is deterministic.
2. Each direction was given the weight $w_k = \max(0, \mathbf{n} \cdot \mathbf{d}_k)$.
3. A ray was cast from a point 0.01 mm along $\mathbf{n}$ in each direction $\mathbf{d}_k$ with $w_k > 0$, against the hemisphere's own pial mesh (trimesh 5.1.0 `RayMeshIntersector` on embreex 4.4.0.post1, in batches of 2,000,000 rays). A hit at distance $r_k$ has reach $\min(r_k / R, 1)$ with $R$ = `occlusion.radius_mm` = 10 mm. A miss has reach 1.
4. Openness is the weighted mean reach, $O = \sum_k w_k\,\text{reach}_k \big/ \sum_k w_k$. It is 1 on a bare crown and near 0 deep in a fold.

The mesh must be outward-wound (positive volume) or the build fails. The openness of the teaching set's cerebellar lobules was computed by the same function, with each ray blocked by all 25 lobule surfaces together (`joint_openness`).

### Encoding

`encode.py` quantised each field to `uint16` over its range. A stored value $v$ decodes as $x = v/65535\,(h - l) + l$, where $l$ and $h$ are the ends of the range. A value outside a supplied range is refused, not clamped. Positions are `float32`. Normals are `int16`, normalised under `KHR_mesh_quantization`, which is declared required so that a reader without it fails.

The site serves the model layers with their positions and triangle indices under `EXT_meshopt_compression` (`web/build/meshopt-glb.ts`, meshoptimizer 1.1.1, at build time). `public/` keeps the files `encode.py` wrote. The encoding is lossless and keeps order: it uses the `ATTRIBUTES` mode for positions and `INDICES` for triangles, not `TRIANGLES`, which would rotate each triangle's corners. The decoded buffers are the published bytes. A layer is about 28% smaller over gzip for a detail level and about 7% smaller for a cortical atlas. The atlas comparison geometry is served as published, since the app checks it against the SHA-256 its comparison file records.

### Tissue shading

The cortical shader (`createAnatomicalMaterial`, `addFoldShading`) derives a fold term $f$ from sulcal depth and openness $O$ (Fig. 1a):

$$\text{depth} = \operatorname{smoothstep}(-0.5, 1.8, \text{sulc}), \quad \text{shut} = 1 - \operatorname{smoothstep}(0.5, 0.95, O), \quad f = \operatorname{mix}(\text{shut}, \text{depth}, 0.25).$$

Direct diffuse light is scaled by $1 - 0.48 f$, and indirect diffuse and indirect specular light by $1 - 0.78 f$ (`folds`). In Tissue colour only, the diffuse colour is scaled by $1 + 0.28\,(2I - 1)$ with $I = \operatorname{clamp}((T_1 - 85)/(180 - 85), 0, 1)$ (`intensity.surface_strength`). Under a published palette the factor is 1.

The tissue palette is cortex `#c4a897`, grey `#a68d80`, white `#e5dbc5`, fluid `#67777c` and unlabelled `#c4a897` (roughness 0.62, clearcoat 0.08, index of refraction `ior` 1.38). A region takes the colour of its `tissue`. Without one, a surface that is no region of its atlas is unlabelled, cortex is cortex, a name matching ventricle, vent or CSF (cerebrospinal fluid) is fluid, one matching white, `CC_` or callosum is white, and anything else is grey. Tone mapping is Khronos PBR Neutral.

### Visibility

`visibilityOf(region, settings)` decides whether each region is drawn. It applies the following tests in order, and the first one that a region fails hides it.

1. Under T1 MRI colour, a region with no registered MRI is hidden (`no-mri`).
2. A tissue region is hidden when it lies below cut resolution, when the colouring (`other-colour`) or the detail level (`other-detail`) keeps it off the cut's labels, or when no cut is open.
3. A structure of another detail level is hidden, and so is a surface of another atlas.
4. A region of another internal system is hidden.
5. A region of a hemisphere that is not shown is hidden.
6. The cortex is hidden when it is switched off or at opacity 0.
7. A structure is hidden when internal anatomy is hidden.
8. The medial wall is hidden while internal anatomy is shown.
9. The spinal cord is hidden when it is switched off.
10. A region the reader has hidden stays hidden (`removed`).
11. While a region is isolated, every other region is hidden (`isolated`).

Meshes and the Anatomy tree read the same answer.

### Dissection and exposed white matter

Dissection holds a validated set of hidden region ids, with one history entry per hide, show or restore. When hidden cortical parcels of the shown atlas open a hemisphere, and the cortex is shown and no region is isolated, that hemisphere's native white surface from `tissue-envelopes.glb` is drawn in the tissue white (`exposedWhiteMatter`). The exposed face is therefore the subject's own grey–white boundary (Fig. 1f). An isolated region is drawn alone (Fig. 1g).

### Focus

Focus requires a selection and a published `see_through_opacity` (0.15). A region is ghosted unless it is the selection, one of its `constituent_regions` or a painted region (`ghosted`). A ghost is drawn in the luminance of its tissue colour, $0.2126R + 0.7152G + 0.0722B$, without hue (Fig. 1h). The cortex ghost takes the opacity $\min(0.15, \text{cortex opacity})$, and deep ghosts take 0.15. Deep ghosts are sorted after other translucent surfaces, nearest first and writing depth, so each pixel takes one ghost layer. The cortex ghost comes last, without depth write (`transparentOrder`). Cut faces are greyed by the same rule ([sections and cuts](sections-and-cuts.md#display)).

### Exploded view

Each structure is moved whole by a translation; no vertex moves within it. Each region of the shown detail level is one piece, with two exceptions. A region that is a part of a teaching unit (its `constituent_regions`) moves as that unit, so a structure a level draws in parts is not taken apart: the hippocampal formation's layers at the NextBrain level, the corpus callosum's five segments at the aseg level. The Brainstem and Cerebellum systems (`labelOf`) each move as one, the spinal cord with the brainstem. A piece moves by `DEEP_SPREAD` = 0.6 times the offset of its box centre from the centre of the deep anatomy's box. Every distance between piece centres therefore grows by 60%, and each piece keeps its direction from the centre (`deepShifts`).

Each pair of pieces is first tested at those offsets. Where a mesh of one would cross a mesh of the other, or the box of one would contain the other's, the two are joined and move by the offset of their joint box. A crossing is an intersection of the two surfaces, tested on the meshes' bounding-volume hierarchies (three-mesh-bvh 0.9.17). A join also joins the pieces' mirror images, the structures of the same name in the other hemisphere. A clearance narrower on one side therefore does not send a structure off alone while its counterpart stays put. A midline structure is its own mirror image, so a piece it joins on one side is joined to that piece's counterpart. A structure labelled on one side only has no mirror image and joins nothing across the midline. NextBrain labels a few such structures (on CDMD the left lateral habenular nucleus); read as midline, each joined the two sides' deep structures into one piece. Before this rule, the right amygdala and the left fornix of the Montreal Neurological Institute (MNI) template each moved off alone. Passes repeat until none is joined, so no piece crosses or contains another and none is moved off its own direction.

The shown atlas's hemispheres then move along the brain's own left–right axis. Each moves only far enough to stand `HEMISPHERE_GAP` = 3 mm clear of the spread anatomy's extent along that axis, and never inward (`hemisphereShifts`). An exposed white surface moves with its hemisphere. The layout is computed once for each atlas, detail level and loaded cord.

The axis runs from the left hemisphere's vertex centroid to the right's. The scan holds CDMD's head turned, so the axis is the scan's x rotated 2.6° in roll (the right side lower) and 1.9° in yaw (the right side further back). The head's rotation in its FreeSurfer MNI305 affine gives 2.6° and 2.4°. The named views, the opening view, the orbit and the orientation letters square to this axis, exploded or assembled, so left and right sit level. The scan's pitch is kept, as cuts and the linked MRI keep the scan's planes.

The layout is measured before the move starts, so its time is not taken off the move. The move rides the camera's critically damped spring (response 0.38 s), so the refit around it arrives with it. A reversal turns the pieces where they are, carrying their speed, and never takes them past where they are going. Under reduced motion the change lands with the next frame, under the camera's 160 ms dissolve. Seen within 45° of the left–right axis, the hemispheres would part toward and away from the reader. From such a view, turning the exploded view on turns the camera to the anterior view, and turning it off while that view is still held returns to the view before.

Whatever reads the anatomy reads it where it lies: cut sources, region lookup, an overlay's region course, the T1 scan and a reader's map on a surface (the shaders subtract the shift), and a clicked coordinate. Turning the view on closes an open cut first. A cut and the visual-field map put the brain back at once and cannot open on it exploded. A lesion, a stroke case, a lesion's streamlines, Tracts and a route put it back on the same spring. Lesion marks, stroke cases, streamlines and route marks are hidden while it is exploded.

### Names on the brain

`chooseNames` (`region-names.ts`) names, once the stage comes to rest, up to `MAX_NAMES` = 24 of the regions the reader sees. What shows is asked, not reckoned. A grid of rays over the anatomy's extent on the visible stage (`sightGrid`: square cells of at least 10 px, at most 2,000 of them) is cast from the camera, one through each cell's centre (`EngineModel.seenAt`), and each ray answers with the region whose surface or cut face it meets first. The rays are cast a frame's share at a time (5 ms), so the look never holds a frame, and a camera move or a display change abandons a look under way. A region's size on screen is $\sqrt{n}\,c$ px, with $n$ the cells that show it and $c$ a cell's side, so a region behind another counts for nothing and a cut face counts as it is seen. A surface names only what a click on it would select; a cut face names whatever it cuts.

Regions of at least `NAMED_SIZE_PX` = 40 px are taken largest first, so zooming in names smaller ones. A name already shown is taken before any new one and kept while it spans at least `KEPT_SIZE_PX` = 30 px. A small turn or zoom therefore renames nothing, and a part coming into view waits for room. The selection is named first wherever any of it shows, whatever its size; a selection too small for the grid is asked at its own anchor.

Each dot stands in the middle of the widest part of what shows: the cell deepest inside the region's cells, counted in steps from their rim, or a point between cells where several are as deep, if a ray there meets the same name. A kept name whose point is still in sight (`EngineModel.inSight`) stays at that point, unless the point is now on the rim of a patch at least three cells deep.

A name whose point falls off the visible stage is left out, and so is one whose dot would stand within `DOT_APART_PX` = 14 px of the dot of a name already chosen. A name is written once: of two that read the same, such as the two sides' frontal lobes or putamina, only the first in priority order is drawn. Under Lobes colour the lobes are named instead of their regions, each in the middle of what shows of all its regions, and the selection is named as itself. A lobe's name is drawn as text only, since the key lists the lobes. Each region's name is a button that selects it. Pointing at a name, or moving the keyboard onto it, marks its region on the stage as the pointer over the region does (`EngineModel.point`), and a region pointed at lights its name, leader and dot in the accent.

Between rests the camera carries the names, each in its column. A name changes column only once its own no longer holds it. One whose place moves more than 160 px fades out and in at the new place rather than crossing the stage. A jump of more than 24 px, up to that limit, glides with a time constant of 70 ms, and a smaller move is drawn at once. A few names a frame (at most `LOOK_MS` = 1 ms of rays) are asked whether their point is still in sight, so a name turned away or hidden behind other anatomy fades out rather than standing over the wrong region, and fades back when its point returns. A cut moved along its normal carries the names on its faces to where the plane now passes, each asked first. A cut turned, reversed or closed takes them down until the next rest. A name the rest drops fades out where it stood. Under reduced motion names come and go at once.

The names stand in columns beside the anatomy, as an atlas plate labels its figure, where the stage leaves at least `OPEN_COLUMN_PX` = 96 px, a short name's line, between the anatomy's extent (`EngineCamera.anatomyRect`, from a sample of the vertices framing fits) and the edge of the stage (`placeColumns`, `name-columns.ts`). A column once open is kept down to `KEEP_COLUMN_PX` = 72 px. A column's room ends at the nearest chrome standing beside the anatomy that leaves at least 144 px short of it, as an orientation letter at the stage's edge does, or that stands along half the anatomy's height, as an open dock menu does; other chrome takes rows out of the column. Each name is wrapped to its column (at most 14 em and three lines; a name that needs more has no place in that column), level with its dot where it can be, pushed apart in its dots' order where names crowd, and clear of the stage's chrome. Its leader meets the middle of its edge toward the anatomy. Two neighbours change places wherever that leaves fewer leaders in conflict, a conflict being a crossing or a leader passing within 9 px of another name's dot. A leader that still passes over another name's dot, as the farther of two level dots' leaders does, is steered clear: its name is moved up or down its column, over a few rounds, until the leader passes 9 px from that dot, unless that leaves more conflicts. A leader runs at most 60% of the anatomy's width, the selection's excepted.

When the stage comes to rest, a name starts in the column it stood in last, else on its dot's side, and moves to the other while that lowers the plate's cost. The cost counts how far each name is pushed off its dot's level, half how far its leader runs across, 24 px to switch columns and 48 px for each two leaders in conflict. A full column leaves out its lowest-priority names. Zoomed in until neither side has room for a column, each name stands level with its dot, with no leader (`placeBeside`): on its right where that is clear of the chrome and of the names and dots already placed, else on its left, the side it stood on last tried first. A name with neither side clear, or whose dot a name before it covers, is left out, dot and all. Names take the route landmarks' haloed type, dots and leaders.

No name is drawn while the brain is exploded, the tract reference is shown alone, a circuit lesson is open or the visual-field map is open. None is drawn either while Focus is on, while the Functions, Deficits or Tracts tab is in front, or while a paint other than the reader's highlights is on the stage (`namesDrawn`).

### Highlights

**Highlight**, under **More** in a region's sheet, marks the region in one of six colours, the deficits' finding colours in order: Blue, Raspberry, Green, Amber, Violet and Pink. A new region takes the colour the fewest hold, the first on a tie, so the first three take the three that stay apart under colour-vision deficiency. At most `MAX_HIGHLIGHTS` = 12 regions are highlighted, each once.

The highlights are a paint (`highlightPaint`): each region in its colour and every other in its tissue colour, keyed on the stage as **Your highlights**, whose note says they are the reader's own marks, not data. They are set aside while the tab in front shows evidence (an open function, deficit, lesson or map, or one of Anatomy's paints) or a reader's map is drawn, and return when it closes. A masthead colour chosen over them lifts them until a region is added or recoloured or the reader draws them again (`highlightStatus`). **Your highlights**, above the panel, lists each region with its side, a swatch that offers the six colours and a remove control. A region the layers on screen do not hold stays listed and says so. A link carries them as `mark` ([sharing](sharing-and-snapshots.md#link-encoding)).

## Display

**Colour** chooses Tissue, T1 MRI, Lobes, Regions, Yeo 7 networks, CAB-NP networks (which switches the atlas to HCP-MMP), Striatal networks, Cerebellar functions, Arterial territories, [Cortical thickness](cortical-thickness.md) (CDMD only) or [Sulcal depth](sulcal-depth.md) (Fig. 1a–e shows five of them). The subcortical maps and the territories also choose the labels a cut samples ([sections and cuts](sections-and-cuts.md#which-labels-a-cut-samples)). While a paint is shown, **Colour** reads its name: Functions, Deficit, Lesion, Your highlights, Connectivity, Disorder or Layer IV.

T1 MRI shows the [linked MRI](linked-mri.md) scan through the same window, with tone mapping off. A cut face is unlit and takes the grey of the plane it lies on, so it matches the linked MRI. A pointed-at or selected face is marked with the theme accent (`MRI_MARK`: lift 0.33, tint 1.8) because the scan owns luminance. A surface shows the tissue it bounds. The cortex shows its `_T1` (`orig.mgz` at the pial–white midpoint), and any other surface shows the scan 1 mm inside itself (`SURFACE_DEPTH_MM`). On the surface itself, trilinear reads mix in the neighbour: 31 of 106 teaching-set structures read more than 10 scan intensity units from their interior median, the lateral ventricles 107 against 48, while 1 mm in all read within 7.

Under T1 MRI, surfaces are lit by the stage's own diffuse light on white, clamped at 1. That light reaches 1 where a surface faces it squarely (99th percentile 1.00–1.03 over four views), so a surface reads its scan grey there and darker elsewhere, never brighter. Specular light is left out, and a reader's map over the scan takes the same light. A paint is drawn on the scan, which stays wherever nothing is painted. A painted surface takes the scan's light, a painted cut face shows its paint unlit in the key's colours, and painted parcels feather only into each other.

Published colours darker than OKLab lightness 0.45 are drawn lifted linearly into 0.30–0.45 with hue kept (`stageLegible`). Exports keep the published value. Parcel borders fade into the neighbour over `FEATHER_RADIUS` = 1.5 mm on the stage only, and picking keeps the exact border.

**Lobes** gives each cortical region the colour of the group the Anatomy list places it in, and keys the groups on the stage. For Destrieux the groups are Frontal, Central, Parietal, Occipital, Temporal, Lateral fissure, Insula, Cingulate and Limbic (`destrieux-labels.ts`). Desikan-Killiany has the same groups without Lateral fissure (`desikan-labels.ts`), and so has Julich-Brain, whose areas join those groups through the location in each name (`julich-labels.ts`). A group is a navigation aid, not a measured boundary. In Destrieux, Central holds the central sulcus and the paracentral and subcentral regions, and the precentral gyrus is listed under Frontal. In Desikan-Killiany, Central holds the precentral, postcentral and paracentral gyri. Regions in no group (deep structures, the medial wall, cortex Julich-Brain has not mapped) keep their tissue colour, as do cut labels that are not regions of the shown atlas. The nine colours are Paul Tol's ["muted" qualitative scheme](https://sronpersonalpages.nl/~pault/) and belong to the interface: no atlas publishes them (`LOBE_COLORS`, `web/src/lib/core/catalog/lobes.ts`).

HCP-MMP and Schaefer group their areas by network, so they offer no lobes. There the option says "Atlas becomes Destrieux" under its name, and choosing either atlas while Lobes is on returns the colour to Regions. A page opened without a link shows Destrieux in Regions, and **Start over** returns to Destrieux in Regions from any atlas. A link shows the colour it was written with, and one that names no colour (`colors`) means Regions.

Where a structure crosses the cortex, some samples hold the same depth for both. Opaque surfaces draw in three.js order, except that the cortical atlas comes first, so the structure takes those samples, as its cut face does over the ribbon's, whichever layer finished loading first (`opaqueOrder`).

**Display** holds **Hemisphere**, **Show cortex** with **Cortex opacity** and **Cortex surface**, **Show internal anatomy**, **Show spinal cord**, **Exploded view** and **Names on the brain** (keys <kbd>H</kbd>, <kbd>C</kbd>, <kbd>U</kbd>, <kbd>S</kbd>, <kbd>E</kbd>, <kbd>N</kbd>). The exploded view is absent, and <kbd>E</kbd> does nothing, while the visual-field map is open. Names on the brain is not counted as a change to the display. It is off by default, a page opened without a link included, and a link shows names only if it says so. On a phone the popover ends with the settings away from their defaults and **Reset display**, which a wider screen's status bar shows instead.

**Cortex surface** moves the shown atlas's parcels onto the subject's pial, mid-thickness (halfway, vertex by vertex) or white surface from `tissue-envelopes.glb`. It is the same setting as the Overlay's ([overlays](overlays.md)): the pial while a cut is open, back to the pial on **Reset display** or **Start over**, and not written into the link.

The eye beside each Anatomy row hides a region or group. **Focus** (<kbd>F</kbd>) and, under **More** in a region's sheet, **Isolate** (<kbd>I</kbd>), **Hide** and **Highlight** act on the selection. A cortical region chosen by name in the Anatomy list, with nothing isolated, is focused when framed, so it stands out from the atlas's colours. One clicked on the brain is not. A selection beneath fully opaque, shown cortex, with nothing isolated, is focused when framed (`beneathCortex`). Such a selection is a structure of the forebrain's deep systems, or one inside the brainstem or cerebellum (nuclei such as the arousal nuclei, red nucleus, substantia nigra and dentate, peduncles, white matter). The outer parts of the brainstem and cerebellum do not count: aseg's brainstem and cerebellar cortex, NextBrain's midbrain, pons and medulla, structures built on them, and CerebNet's lobules.

The link carries the display state under the keys `colors`, `hemi`, `cortex`, `opacity`, `internal`, `cord`, `explode`, `names`, `hidden`, `isolate`, `focus` and `mark`.

The model turns with a drag or, once the stage has focus (<kbd>Tab</kbd>), the arrow keys. <kbd>Shift</kbd> with the arrows, a right-drag or a drag with <kbd>Shift</kbd> moves it across the view, as a two-finger drag does on a touch screen. Scroll or pinch zooms toward the point under the pointer, and <kbd>+</kbd> and <kbd>−</kbd> zoom while the stage has focus. A double-click or double-tap centres the view on the point of the model under it, which the model then turns about. **Keyboard shortcuts** (<kbd>?</kbd>) lists these under Mouse and touch.

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| Positions (`validate.py`; `test_encode.py`) | Error ≤ $2 \times 10^{-5}$ mm | $5.04 \times 10^{-6}$ mm |
| Normals (`validate.py`; `test_encode.py`) | Component error ≤ half an `int16` step plus one `float32` step | $1.53 \times 10^{-5}$ (bound $1.54 \times 10^{-5}$) |
| Sulcal depth (`validate.py`) | Error ≤ half a `uint16` step of the range plus one `float32` step | $2.40 \times 10^{-4}$ (bound $2.42 \times 10^{-4}$) |
| Openness (`validate.py`) | Re-cast field within $10^{-3}$ for at least 99.5% of vertices | maximum error $7.66 \times 10^{-6}$; 0.0% outliers |
| Ribbon T1 (`validate.py`) | Error ≤ half a `uint16` step of the range plus one `float32` step | $1.26 \times 10^{-3}$ (bound $1.27 \times 10^{-3}$) |
| Shading fields (`test_shading.py`) | Partitioned fields continuous; openness 1 on a bare surface, falling with a nearer fold, unchanged by folds beyond $R$ | passes |
| Encoding (`test_encode.py`) | Shared ranges used; out-of-range values refused; quantised normals require the extension | passes |
| Viewer (`materials.test.ts`, `mri-material.test.ts`, `draw-order.test.ts`, `border-feather.test.ts`, `palette.test.ts`, `white-matter-surfaces.test.ts`, `dissection.test.ts`) | Shader terms, draw order, feathering, exposure and dissection history | passes |
| Exploded view (`explode.test.ts`) | Layout, motion and anatomical reads, listed below | passes |
| Focus when framed (`labels.test.ts`) | Deep structures and the insides of brainstem and cerebellum count as hidden by the cortex, their outer parts do not | passes |
| Names on the brain (`region-names.test.ts`, `name-columns.test.ts`, `stage-labels.test.ts`, `RegionNames.svelte.test.ts`) | Choice, placement and fading of names, listed below | passes |
| Highlights (`HighlightStrip.svelte.test.ts`, `stage-keys.test.ts`) | Strip names each region with its side and colour, recolours, removes, says when set aside or lifted; the key and the image caption say they are the reader's marks | passes |

The values are those of `validation.json` for CDMD and are the largest over the five cortical atlas files. The three encoding bounds are half a quantisation step plus the `float32` spacing at the field's largest magnitude (`normal_tolerance` and `field_tolerance` in `encode.py`).

The openness tolerance exists because the field is re-cast in `float32` on the validating machine: where the pial surface touches itself a ray origin can fall on either side of the contact. A vertex jitter of $3 \times 10^{-5}$ mm moved 0.16% of CDMD vertices past the tolerance. A 5% radius error moves 78%, and one direction fewer moves 23% (`validation.openness` in `config/model.yaml`).

The exploded-view tests assert that interlocking and enclosed regions are joined, not rearranged, and that their mirror images are joined alike. On both anatomies and at every level, the parts of a unit share one shift and the two thalami part. A structure on one side only joins nothing across the midline, and the first frame after a level's first layout draws the brain still assembled. The hemispheres slide along the brain's axis only far enough to clear the internal anatomy, and shapes are kept. A reversal turns the pieces where they are. Cut, lookup and pick read the anatomy, and the cord stays on the brainstem.

For the choice of names, the tests assert that regions seen at 40 px or more are taken largest first, at most 24, and that none hidden behind another is named. Names already shown are kept first, down to 30 px, at their points while in sight. Each dot stands in the middle of what shows. Each name is written once, and the selection is named first. Lobes are named under Lobes colour, and cut faces are named. Dots stand at least 14 px apart. For the placement, columns stand beside the anatomy, wrapped and in their dots' order, without leaders crossing or passing over a dot, and end short of chrome beside the anatomy. A name is moved across where that is cheaper but not mid-turn, and the lowest priority is left out. Zoomed in, a name stands level beside its dot and keeps its side. A name pointed at marks its region, and a region pointed at lights its name. For the fading, a hidden part or a closed cut fades its names at once. No name stands over the dock, an open menu, a key or the gizmo, and none is drawn while `namesDrawn` is false.

## Limitations

T1 brightness, fold shading and tissue colours are illustrative, not measured albedo. Sulcal depth and ribbon T1 exist on the cortical meshes only. Openness exists on the cortical meshes and on the teaching set's cerebellar lobules, and on no other structure. Cortical openness counts occlusion by the vertex's own hemisphere only.

The MRI and FreeSurfer labels are 1 mm; label boundaries are not anti-aliased. A parcel narrower than 3 mm never reaches full colour on the stage. Hidden regions change the linked MRI planes only under **Overlay** › **3D view**.

## Code availability

Code
: [`brain_model/surfaces/shading.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/surfaces/shading.py), [`brain_model/build.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/build.py) (`build_cortex`), [`brain_model/gltf/encode.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/gltf/encode.py); [`web/src/lib/engine/render/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/lib/engine/render), [`web/src/lib/engine/model/brain-atlas.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/engine/model/brain-atlas.ts), [`web/src/lib/core/catalog/visibility.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/catalog/visibility.ts), [`web/src/lib/core/state/dissection.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/state/dissection.ts), [`web/src/lib/engine/model/explode.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/engine/model/explode.ts), [`web/src/lib/engine/model/placement.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/engine/model/placement.ts), [`web/src/features/stage/region-names.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/features/stage/region-names.ts), [`web/src/features/highlights/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/features/highlights), `highlightPaint` and `highlightStatus` in [`web/src/lib/core/state/paint.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/state/paint.ts)

Configuration
: [`config/model.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/model.yaml): `appearance` (`tissue`, `intensity`, `folds`, `occlusion`, `lighting`, `see_through_opacity`), `validation.openness`

Tests
: `tests/test_shading.py`, `tests/test_encode.py`; `web/src/lib/engine/render/*.test.ts`, `web/src/lib/engine/tissues/palette.test.ts`, `web/src/lib/engine/tissues/white-matter-surfaces.test.ts`, `web/src/lib/core/state/dissection.test.ts`, `web/src/lib/engine/model/explode.test.ts`, `web/src/lib/core/catalog/labels.test.ts`, `web/src/features/stage/region-names.test.ts`, `web/src/features/stage/RegionNames.svelte.test.ts`, `web/src/features/stage/stage-keys.test.ts`, `web/src/features/highlights/HighlightStrip.svelte.test.ts`

```bash
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_shading.py tests/test_encode.py
npm test --prefix web -- render tissues dissection explode labels region-names stage-keys
npm run test:browser --prefix web -- src/features/stage/RegionNames.svelte.test.ts src/features/highlights/HighlightStrip.svelte.test.ts
```

