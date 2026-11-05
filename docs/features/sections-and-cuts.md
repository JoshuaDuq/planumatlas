# Sections and cuts

The Section tool slices the model with a sagittal, coronal, axial or oblique plane; each solid is capped where the plane meets it, and the cap is coloured from a published label volume. The cut is built from the published surfaces and integer label grids, so nothing is re-segmented in the browser.

```{figure} ../../.github/assets/readme/sections.webp
:alt: A coronal section through the left hippocampal formation, with each solid capped by its labels and the section bar below

A coronal cut at −20 mm with the left hippocampal formation selected. Each solid is capped, and the caps sample the label volume.
```

:::{list-table}
:widths: 22 78
:stub-columns: 1

* - Where in the viewer
  - **Section** in the stage dock (plane and cut labels); the section bar above the dock once a plane is chosen (position, tilt, azimuth, **Reverse side**, **Linked MRI**, × to return to the full brain)
* - Built by
  - [`brain_model/labels/tissue_labels.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/labels/tissue_labels.py), [`brain_model/labels/volumes.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/labels/volumes.py), [`brain_model/labels/white_matter.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/labels/white_matter.py), [`brain_model/labels/nextbrain.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/labels/nextbrain.py), [`brain_model/surfaces/solids.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/surfaces/solids.py), [`brain_model/surfaces/ribbons.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/surfaces/ribbons.py)
* - Configuration
  - [`config/model.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/model.yaml): `sections`, `nextbrain.cut_label_spacing_mm`, `nextbrain.minimum_mesh_volume_mm3`, `appearance.intensity`, `validation.coordinate_tolerance_mm`
* - Source data
  - The subject's FreeSurfer reconstruction (`aparc.a2009s+aseg.mgz`, `ribbon.mgz`, `wmparc.mgz`, `orig.mgz`, `lh/rh.pial`, `lh/rh.white`, annotations) and the subject's NextBrain segmentation; see [Atlases](../data/index.md)
* - Checked by
  - [`brain_model/validate_volumes.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/validate_volumes.py), `validate_solid_envelopes` and `validate_ribbon_labels`; `tests/test_tissue_labels.py`, `test_volumes.py`, `test_white_matter.py`, `test_solids.py`, `test_ribbons.py`, `test_nextbrain.py`; `web/src/lib/engine/tissues/*.test.ts`
:::

## What it does

A cut keeps the published surfaces and volumes; only the cap is built. A plane is chosen from **Full brain, Sagittal, Coronal, Axial** or **Oblique**. A slider and a millimetre field set the position along the plane's normal (0.5 mm steps); an oblique plane adds tilt (0 to 90°, 1° steps, default 30°) and azimuth (−180 to 180°, 1° steps, default 30°). **Reverse side** keeps the other half. Positions are FreeSurfer surface RAS millimetres: +R right, +A anterior, +S superior ([coordinate frames](../pipeline/architecture.md)).

**Cut labels** chooses which label volume the caps sample, independently of the cortical atlas: Destrieux, HCP-MMP, Julich-Brain or Schaefer cortex, NextBrain, and the cut atlases of the Blood supply, Cerebellar functions and Striatal networks layers. Cut faces take their colour from the Colour setting like the surfaces: tissue colour, T1, regions, networks or paint.

Where the plane meets a closed solid, the intersection polygon, holes included, is triangulated and drawn. The cap samples integer 3D textures on the GPU, so labels are never blended. The pointer and the selection lift the face under them toward white (hover 0.26, selection 0.45, in `HIGHLIGHT_LIFT`); the lift is toward white, never away, because the stage is dark.

## Data

Files written under `public/models/<anatomy>/` by the cut build:

| File | Contents |
| :--- | :--- |
| `tissues-destrieux.volume`, `tissues-hcp-mmp.volume`, `tissues-julich.volume`, `tissues-schaefer.volume` | One `uint16` label grid per surface atlas, gzipped, cropped to its non-zero voxels |
| `tissues-nextbrain.volume` | NextBrain labels at 0.8 mm blocks |
| `white-matter.volume` | `uint8` gyral white-matter parcels (`wmparc`), cut faces only |
| `tissue-labels.json` | Per atlas: file record, label table (`source_label_id`, `name`, `color`, `hemisphere`, `kind`, `region_id`), `label_method`; the `white_matter` record; `limitations` |
| `tissue-envelopes.glb` | Native `lh`/`rh` pial and white surfaces, vertices and triangles unchanged |
| `ribbon-<atlas>.labels` (`destrieux`, `hcp-mmp`, `julich`, `schaefer`) | `uint16` region index per vertex, both hemispheres concatenated, for the parcel solids |
| `mri.volume`, `aseg.volume`, `volumes.json` | The T1 and the segmentation; see [Linked MRI](linked-mri.md) |

The cut atlases of other layers (`tissues-arterial.volume`, `tissues-nettekoven.volume`, `tissues-choi.volume` with `tissues-choi-confidence.volume`) are written by those layers' builds; see [striatal networks](striatal-networks.md), [arterial territories](arterial-territories.md) and [cerebellar functions](cerebellar-functions.md). Volumes end in `.volume`, not `.gz`, so servers do not decode them in transit.

Each volume record carries `shape`, `dtype`, `order: "F"`, `compression: "gzip"`, `byte_length`, `sha256` (of the file), `decoded_sha256` (of the payload), `voxel_to_surface_ras_mm` (the 4×4 voxel-to-surface-RAS affine) and `voxel_spacing_mm`. A cropped volume also records `source_shape` and `crop_corner_voxel`.

## How it was built

### 1. Label volumes (`export_tissue_labels`)

1. `mri/aparc.a2009s+aseg.mgz` is loaded. Its distinct values become `uint16` codes (`np.unique` with inverse), so every FreeSurfer label survives losslessly. Each value is described by `describe_source_label`: hemisphere from the name prefix (`Left-`, `ctx_lh_`, `ctx-lh-`, and the right-hand equivalents; otherwise midline), `kind` cortex for values of 11100 and above, and the `region_id` of the manifest region it matches. A name that matches more than one region raises an error. FreeSurfer 6 annotations write `&` where the lookup table writes `_and_`; the match accounts for it.
2. **Destrieux** is the source volume's own parcellation, with no projection.
3. **Every other surface atlas** (HCP-MMP, Julich-Brain, Schaefer) is projected by `project_surface_atlas`: cortex outside the ribbon takes the annotation's entry 0, its unlabelled one (the build fails if entry 0 maps to a region). Each voxel inside `ribbon.mgz` (label 3 left, 42 right) takes the label of its nearest pial or white vertex, found with a `cKDTree` over the stacked pial and white vertices; the index is taken modulo the pial vertex count so either surface answers for the same vertex. The projection is restricted to published cortical voxels (values 11100 to 11199 left, 12100 to 12199 right) and to the native grey ribbon; other tissues are unchanged. The ribbon must share the source's grid (`validate_same_grid`: shape, scanner affine and the tkregister transform). A table entry no vertex of this brain carries has no region.
4. `place_cortex` places each cortical parcel by its voxels in the ribbon (the cortex a cut and the MRI show). A parcel no ribbon voxel carries keeps the placement its surface gave it, and is named in the build log.
5. `encode_cropped_volume` crops the grid to its non-zero voxels (`label_box`), offsets the affine by the crop corner and writes a gzipped payload (`compresslevel=9`, `mtime=0`, so the file is byte-reproducible) after `encode_array` has checked that the data is finite, in range and unchanged by the cast to `<u2`. Array order is Fortran (x fastest).

The source and published grids on CDMD (`tissue-labels.json` and `volumes.json`):

| Volume | Source grid | Published (crop corner) | GPU memory |
| :--- | :--- | :--- | ---: |
| `tissues-destrieux`, `-hcp-mmp`, `-julich`, `-schaefer`, and the Blood supply, Cerebellar functions and Striatal networks cut volumes | $256^3$ at 1 mm | $135 \times 141 \times 152$ from corner (62, 39, 43) | 5.52 MiB each |
| `tissues-nextbrain` | 0.4 mm | $163 \times 184 \times 162$ at 0.8 mm | 9.05 MiB |
| `aseg` | $256^3$ at 1 mm | $135 \times 141 \times 152$ | 5.52 MiB |
| `white-matter` (`uint8`) | $256^3$ at 1 mm | $122 \times 94 \times 141$ | 1.54 MiB |

Validation rebuilds the full grid from each crop and requires equality. The MRI is not cropped.

### 2. NextBrain cut blocks (`nextbrain.export_atlas`)

NextBrain is the one resampling. `cut_label_spacing_mm: 0.8` over the 0.4 mm source gives a block edge of `round(0.8 / 0.4) = 2` voxels (`block_size`; the grid must be isotropic). `block_majority` reduces each $2 \times 2 \times 2$ block to its most frequent label. A tie goes to the label rarer in the volume (labels are ranked by voxel count, then by index), because indices are names and a half-covered block matters more to a thin structure than to its neighbour; blocks overhanging the grid count the missing voxels as background. The cut grid's affine is the source affine times a block scale with offset $(\text{block} - 1)/2$, and `segmentation_lattice_mm: 0.8` snaps the joined grid's origin so that every block sits on one fixed lattice whatever the labelled extent. Surfaces and measurements keep 0.4 mm.

Structures of at least `minimum_mesh_volume_mm3: 10` are meshed; the rest are cut labels only. Fragments of at most 4.5 mm³ that win no block are absent from cuts but still searchable. The record lists `labels_absent_from_cut`, and `nextbrain_limitations` writes the number into `tissue-labels.json` (31 labels on CDMD).

### 3. Gyral white matter (`white_matter.export_volume`)

`wmparc.mgz` (FreeSurfer `mri_aparc2aseg --labelwm`) labels each white-matter voxel within 5 mm of cortex with its nearest Desikan gyrus. Parcels are the values from 3001 to 3999 (left) and 4001 to 4999 (right), the `wm-lh-*` and `wm-rh-*` blocks; unsegmented white matter (5001, 5002) is no parcel. Codes are `uint8` (`np.searchsorted` over the sorted present ids, plus one; 0 is background), cropped to the parcels' bounding box, and written once for every cut atlas (`applies_to`). A grid with more than 255 parcels, or a parcel with no published region, fails. Cut faces name the gyrus under the pointer; deeper white matter belongs to no region. CDMD has 68 parcels, 1,616,988 bytes decoded. The anatomy must declare `white_matter` in `config/model.yaml`; `config/model.yaml` notes that no `wmparc.mgz` is published for the template anatomy.

### 4. Closed solids

Three kinds of closed solid are capped, in three bands (`BANDS = { envelope: 0, ribbon: 1, structure: 2 }`). Where solids overlap, later bands cap over earlier ones, so a nucleus covers the ribbon reconstructed around it, whatever the load order; within a band larger enclosing solids draw first (`enclosingFirst`, by `segmentation_volume_mm3`) and each solid takes a tiered polygon offset so co-planar caps never z-fight.

- **Envelopes** (`solids.export_solid_envelopes`, `tissue-envelopes.glb`): the native `lh`/`rh` pial and white surfaces, vertices and triangles unchanged, converted to glTF. Each of the four meshes must be watertight, winding-consistent and positive in volume or the build fails. `validate_solid_envelopes` re-reads the file, checks the checksum and identical topology, and holds every vertex to `validation.coordinate_tolerance_mm` ($2 \times 10^{-5}$ mm) of the source.
- **Ribbon parcels** (`ribbons.export_ribbon_labels`, `ribbon-<atlas>.labels`): one region index per vertex, from the native annotation. A triangle belongs to the parcel holding most of its vertices (`majority`). The viewer closes the ribbon between the pial and white envelopes into one solid per parcel, so a parcel boundary is geometry rather than a sample of the 1 mm grid. The build fails if any wedge has an open edge (`wedge_defects`: wedges, holes, pinches); validation re-derives the indices and requires the same partition as the annotation.
- **Structures**: the meshes of the chosen internal-anatomy level and the spinal cord, drawn from the geometry the model already holds.

## How the viewer uses it

### Loading

The first cut downloads what the first frame did not need: the envelopes, `tissue-labels.json`, the white-matter volume and the cord (`TissueSections.loadAnatomy`), then the chosen atlas's label volume and ribbon labels (`TissueSections.load`). Every file is checked against its SHA-256 and decoded length by `loadVolume` (`slices/volume.ts`). The cap samples these as integer textures: labels `R16UI` and white matter `R8UI`, with nearest filtering; the T1 is `R8` with linear filtering.

### Ribbon wedges (`tissues/ribbon-wedges.ts`)

`buildRibbonWedges` forms, per parcel, its pial patch, its white patch reversed, and a quad wall along each patch boundary edge. A wall triangle must traverse its shared edge opposite to the patch that owns it; mirroring the two wall triangles makes the wedge winding-inconsistent, which the stencil counts as a hole rather than a solid. The triangle owner is the majority label, the lowest winning a tie, as the build does.

### Plane sections (`tissues/plane-section.ts`)

`sectionTriangles` intersects the plane with a closed mesh and returns the cap's triangles in world space, instead of rasterising every triangle of every solid. A mesh with a BVH is traversed by `shapecast`, so only triangles near the plane are visited.

1. Each edge that crosses the plane gets one intersection point, found by a hash on the endpoints rounded to $10^{-8}$; both triangles that share the edge find the same point.
2. A vertex lying exactly on the plane is nudged by a deterministic hash of its quantised position, by about $10^{-15}$, so the cut never sits on a vertex.
3. Segments are linked enter-to-exit into closed loops.
4. Loops are projected on the plane's two axes, and a loop's nesting depth counts the loops that contain a seed point just inside it. Even-depth loops are outer boundaries and odd-depth loops their holes, assigned to the nearest enclosing outer loop.
5. Each outer loop with its holes is triangulated with earcut.

A cut the sectioner will not vouch for falls back to the stencil cap, which already agrees with the mesh there. The reasons are `branch` (a non-manifold intersection), `open`, `cycle`, `seed` (no interior seed point found) and `earcut` (no triangles, or a deviation above $10^{-3}$).

### The stencil fallback (`tissues/solid-sections.ts`)

Back faces increment and front faces decrement a stencil clipped by the plane (`IncrementWrapStencilOp` and `DecrementWrapStencilOp`, Three.js's winding-count method); a plane-sized quad then draws wherever the count is not zero. An inside test reads both faces, because a zero-thickness ribbon (pial on white) puts two opposite faces in one place and a first-exit test alone would be fooled. A click on a stencil cap counts only inside the solid, and the hit carries the solid it landed in, so the anatomy the viewer drew there says what was clicked.

### Dragging

`SolidSections.build` runs the sectioner in a worker (`tissues/section-worker.ts`), which holds each solid's geometry and serialised BVH (copied once, ahead of the first drag, by `warm`) and cuts every listed solid by one plane per message. The page keeps the last complete cut on screen until the next one is finished, and the caps appear together with the moved plane. Where the platform has no `Worker`, the page cuts on its own thread; a worker that fails at run time rejects the pending builds instead of falling back silently. Stencilling the whole mesh (hundreds of parcel solids, twice) is what made exploring a cut drop frames.

### Sampling labels

`LABEL_AT` (`tissues/label-sampling.ts`) takes the label with the most trilinear weight over the eight voxels around a point (ANTs' genericLabel rule), visiting corners in the same order as `Volume.label` on the CPU so that ties break alike. It uses vector `equal` and `dot` votes rather than loops over local arrays, which ANGLE's Metal backend spills to memory and made a cut face six times slower. This removed the hard voxel squares of nearest-voxel sampling without inventing anatomy: a label never appears that was not among the eight neighbours, and the rule is exact at every voxel centre. An integer-framebuffer check found no mismatch between GPU and CPU in 599,890 pixels away from exact ties.

Where a region has a parcel solid, the cap is that solid's own geometry; the label volume is sampled for tissue not covered by a solid and for the cut-only atlases (`tissues/cap-labels.ts`, uniform `capSampleLabels`). A hidden label (palette alpha under 0.5) is discarded, so isolating a region discards the rest.

### Colour

Cut faces use the same colour rule as the surfaces, read from one function (`paintSolids`), so a parcel is one colour whether its face was sampled from the label volume or capped from geometry. In **Tissue** colour only, trilinear T1 intensity scales the lit face:

$$\text{colour} \times \bigl(1 + s\,(2I - 1)\bigr), \qquad I = \operatorname{clamp}\!\left(\frac{T_1 - 85}{180 - 85},\,0,\,1\right)$$

with $s$ = `intensity.cut_strength` = 0.5 and the window 85 to 180 from `appearance.intensity`. Under a published palette (atlas, network, territory, CAB-NP or paint colours) the variation is zero, so the datum is not distorted. Solid caps also take a relief term: the T1 gradient, in view space, tilts the normal by `solid_relief_mm` = 1.2 mm; no geometry is displaced. Structures whose mesh is not MRI-registered take no variation.

Other effects layered on the cut face: the Yeo 7 striatum and its confidence ([striatal networks](striatal-networks.md)); the selected NextBrain region's outline, drawn from the boundary-certainty table (`tissues/boundary-edges.ts`; [boundary certainty](boundary-certainty.md)); and the Focus ghost, which greys every cap except the selection and its constituent regions ([dissection and display](dissection-and-display.md)). Three repaint keys include `focusedRegion` (the sections visibility key, the palette key and the solid paint key); without it, a focus change while cut would not repaint.

### Section state

`BrainSections` (`slices/sections.ts`) holds `mode`, `cutAtlas`, `crosshair`, `reverse`, `tilt` and `azimuth`. `createFrame` (`slices/coordinates.ts`) gives each mode its basis: sagittal normal +R, coronal +A, axial +S; an oblique normal is $(\sin t \cos a,\ \sin t \sin a,\ \cos t)$ for tilt $t$ and azimuth $a$. The permitted offset range is the volume's coordinate bounds projected on the normal; for an oblique plane it also stops where the crosshair, the plane's foot on its normal, would leave the coordinate limit. `offsetThrough` clamps a centroid just outside the volume to a legal cut. The camera faces the cut (`faceCut`) and the clipping plane hides the removed half.

## Checks

| Check | What it requires |
| :--- | :--- |
| Volumes round-trip | Each `.volume` decodes, matches both checksums, and placed by its affine equals the source (`validate_volumes.py`) |
| Crops | The crop corner is a whole-voxel offset and the full grid rebuilt from the crop equals the source |
| Projected cut labels | HCP-MMP, Julich-Brain and Schaefer equal Destrieux outside cortex; inside, every ribbon voxel holds the label of its nearest pial or white vertex |
| NextBrain cut blocks | Every 0.8 mm block recounted label by label from the source |
| White matter | Parcel voxels equal `wmparc.mgz`; codes name the right regions; the volume serves the configured cut atlases |
| Envelopes | Identical topology; no vertex beyond $2 \times 10^{-5}$ mm; closed and outward |
| Ribbon labels | One label per vertex; the same partition as the annotation; no holes or pinches |
| Solids | No vertex beyond 0.6 mm of its source; re-voxelised by ray parity, `misclassified_voxel_centres` is 0 for every solid |

Browser-side tests are in `web/src/lib/engine/tissues/` (`plane-section.test.ts`, `solid-sections.test.ts`, `ribbon-wedges.test.ts`, `label-sampling.svelte.test.ts`, `white-matter.test.ts`, `gpu-sections.test.ts`).

## Limits

- **Cut faces are coarser** than NextBrain surfaces (0.8 mm blocks): thin structures are coarser on a cut than on their surfaces.
- **Non-manifold contacts.** On `cdmd`, 116 of 324 solids touch themselves across voxel corners; enclosed volumes stay definite, and such a cut falls back to the stencil cap.
- **HCP-MMP, Julich-Brain and Schaefer cut labels are projections** of surface labels, not published volumetric atlases, restricted to the native grey ribbon.
- **Native voxel boundaries and the high-resolution cortical surfaces may not coincide exactly**; the volume is 1 mm and the surfaces are not.
- **1 mm tissue labels** from one individual's own segmentation; no claim of subvoxel anatomical accuracy.
- **Hard edges remain** one screen pixel wide at label boundaries, since there is no anti-aliasing across labels.
- **Shading is illustrative.** T1 modulation and relief are not measured optical or histological properties.
- **FreeSurfer surface defects** before repair: 8 holes on `cdmd`.
- The Julich-Brain gap maps and the medial walls are unlabelled on a cut, as on the surface.

## Reproduce

```bash
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_tissue_labels.py tests/test_volumes.py tests/test_white_matter.py tests/test_solids.py tests/test_ribbons.py
npm test --prefix web -- tissues
```

`brain_model.labels.tissue_labels` can also be run as a module (`python -m brain_model.labels.tissue_labels`) after the manifest exists. The build does not remove files it no longer writes; remove obsolete files from the output directory before validating.

## See also

- [Linked MRI](linked-mri.md): the same cut's scan, and the `mri.volume` and `aseg.volume` files
- [Dissection and display](dissection-and-display.md): hiding, isolating and Focus on a cut
- [Boundary certainty](boundary-certainty.md) and [Segmentation agreement](segmentation-agreement.md)
- [Striatal networks](striatal-networks.md), [Arterial territories](arterial-territories.md), [Cerebellar functions](cerebellar-functions.md): cut-label atlases
- [Architecture](../pipeline/architecture.md), [Validation](../pipeline/validation.md)
