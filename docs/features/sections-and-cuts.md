# Sections and cuts

The Section tool cuts the model with a sagittal, coronal, axial or oblique plane and caps every closed solid where the plane meets it. Each cap is coloured from a published integer label volume, chosen independently of the surface atlas. Nothing is re-segmented in the browser: the caps are the subject's own pial, white and structure surfaces, and the labels are the subject's 1 mm FreeSurfer grid or 0.8 mm NextBrain blocks. HCP-MMP, Julich-Brain and Schaefer cut labels are projections of surface labels into the grey-matter ribbon, not volumetric atlases.

```{figure} figures/sections-and-cuts-1.webp
:alt: Six cut views of one brain. Top row, sagittal, coronal, axial and oblique cuts with Destrieux-coloured cortical ribbon, white matter and coloured deep structures. Bottom row, the same coronal cut coloured by NextBrain labels and by arterial territories.
:name: fig-sections-and-cuts-1

**One plane, four orientations and three cut-label volumes.** **a**, Sagittal cut at x = −26 mm. **b**, Coronal cut at y = −20 mm. **c**, Axial cut at z = +8 mm. **d**, Oblique cut, tilt 30°, azimuth 30°, through the origin. **e**, The coronal cut of **b** with NextBrain cut labels. **f**, The same cut with Arterial territories cut labels. Subject CDMD sub_013; positions in FreeSurfer surface RAS (right, anterior, superior); **Colour** set to Regions; **a**–**d** sample the Destrieux label volume; the camera faces the cut, the positive half-space removed.
```

## Data

Files read from `public/models/<anatomy>/`; grids are those of CDMD.

| File | Contents | Published grid |
| :--- | :--- | :--- |
| `tissues-destrieux.volume` | `aparc.a2009s+aseg.mgz`, 185 labels, `<u2` | $135 \times 141 \times 152$ at 1 mm, crop corner (62, 39, 43) of $256^3$ |
| `tissues-hcp-mmp.volume`, `-julich.volume`, `-schaefer.volume` | Ribbon projections; 547, 483 and 587 labels | as Destrieux |
| `tissues-nextbrain.volume` | NextBrain 0.4 mm labels in $2^3$ blocks; 484 labels | $161 \times 183 \times 161$ at 0.8 mm (9.05 MiB decoded) |
| `tissues-arterial.volume`, `-nettekoven.volume`, `-choi.volume` | Cut atlases of the [arterial territories](arterial-territories.md), [cerebellar functions](cerebellar-functions.md) and [striatal networks](striatal-networks.md) layers | as Destrieux |
| `white-matter.volume` | FreeSurfer `wmparc` gyral white matter, 68 parcels, `uint8` | $122 \times 94 \times 141$ at 1 mm |
| `tissue-envelopes.glb` | Native `lh`/`rh` pial and white surfaces, vertices and triangles unchanged | — |
| `ribbon-<atlas>.labels` | One `<u2` region index per pial vertex, 216,726 vertices | — |
| `tissue-labels.json` | Per volume: `shape`, `dtype`, `order: "F"`, gzip, `byte_length`, `sha256`, `decoded_sha256`, `voxel_to_surface_ras_mm`, `voxel_spacing_mm`, `source_shape`, `crop_corner_voxel`, label table, `label_method`; `limitations` | — |

Sources are the subject's FreeSurfer 8.2 reconstruction (`aparc.a2009s+aseg.mgz`, `ribbon.mgz`, `wmparc.mgz`, `lh/rh.pial`, `lh/rh.white`, annotations) and its NextBrain segmentation ([Destrieux, FreeSurfer and NextBrain citations](../reference/references.md#cortical-and-subcortical-atlases)).

## Method

### Label volumes

1. The distinct values of `aparc.a2009s+aseg.mgz` were re-coded as `uint16` indices (`np.unique` with inverse), so every FreeSurfer label survives. Each value takes a hemisphere from its name prefix (`Left-`, `ctx_lh_`, `ctx-lh-` and right-hand equivalents; otherwise midline) and is cortex when ≥ 11100.
2. Destrieux is this volume unchanged.
3. HCP-MMP, Julich-Brain and Schaefer were projected (`project_surface_atlas`). Cortical voxels (11101–11199 left, 12101–12199 right) first take the annotation's unlabelled entry 0. Each such voxel inside `ribbon.mgz` (label 3 left, 42 right) then takes the label of its nearest pial or white vertex (`cKDTree` over both surfaces; index modulo the pial vertex count). Other tissue is unchanged. `ribbon.mgz` must share the source grid: shape, scanner affine and tkregister matrix (`validate_same_grid`).
4. Each grid was cropped to its non-zero bounding box, the affine offset by the crop corner, and written in Fortran order with gzip (`compresslevel=9`, `mtime=0`). `encode_array` refuses non-finite data, out-of-range values and any change under the cast.

### NextBrain cut blocks

The block edge is `round(cut_label_spacing_mm / 0.4 mm)` = `round(0.8 / 0.4)` = 2 source voxels; the grid must be isotropic. Each $2 \times 2 \times 2$ block takes its most frequent label (`block_majority`). A tie goes to the label with fewer voxels in the whole volume, then to the smaller index; blocks overhanging the grid count missing voxels as background. The block affine is the source affine times $\operatorname{diag}(2, 2, 2, 1)$ with offset $(2 - 1)/2$ voxel. Labels that win no block (31 on CDMD) are listed in `labels_absent_from_cut` and appear on no cut. Structures of at least `minimum_mesh_volume_mm3` = 10 mm³ are also meshed; surfaces and measurements keep the 0.4 mm grid.

### Gyral white matter

`wmparc.mgz` values 3001–3999 (left) and 4001–4999 (right) are parcels; unsegmented white matter (5001, 5002) is not. Codes are `uint8` (`np.searchsorted` over the present ids, plus one; 0 is background), so more than 255 parcels, or a parcel with no published region, fails the build. The volume serves the four surface-atlas cuts (`applies_to`).

### Closed solids

Three kinds of closed solid are capped, in bands ranked envelope (0), ribbon (1), structure (2), so a nucleus caps over the ribbon around it. Within a band, smaller solids (`segmentation_volume_mm3`) rank above larger ones. All caps lie on the plane with one polygon offset, so depth cannot order them: caps draw from the highest ranked down, and each draws only where the stencil's top bit says no cap has drawn yet, then sets it (`claimPixels`). The lower seven bits count a stencil cap's windings. Ordering by tiered offsets one depth unit apart let the cap below show through in lines along long thin triangles, since rounding at the depth the brain is seen reaches several units.

- **Envelopes.** The four native surfaces, each required to be watertight, winding-consistent and of positive volume.
- **Ribbon parcels.** Per parcel, the pial patch, the reversed white patch and a wall along each patch boundary edge (`buildRibbonWedges`). A triangle belongs to the parcel holding most of its vertices; a three-way tie goes to the lowest label, as in the build.
- **Structures.** The meshes of the shown internal-anatomy level and the spinal cord.

### Plane section

`sectionTriangles` intersects the plane with each solid, visiting only triangles near the plane through its bounding volume hierarchy (`shapecast`):

1. Each crossing edge gets one intersection point, keyed on its endpoints rounded to $10^{-8}$, so both triangles sharing the edge find the same point.
2. A vertex exactly on the plane is displaced by a deterministic hash of its quantised position, far below a mesh edge.
3. Segments are linked into closed loops. Loops are projected onto the plane axes; a loop's nesting depth, counted from a seed point just inside it, makes even-depth loops outer boundaries and odd-depth loops holes of the nearest enclosing outer loop.
4. Each outer loop with its holes is triangulated by earcut.

A section is refused, and the solid is capped by the stencil method instead, for a non-manifold intersection (`branch`), an open loop (`open`, `cycle`), no seed point (`seed`), or an earcut result with no triangles or a deviation above $10^{-3}$ (`earcut`). The stencil method increments on back faces and decrements on front faces clipped by the plane, then fills a plane quad where the count is non-zero. While a plane is dragged, sections are built in a worker that holds each solid's geometry and serialised hierarchy; the last complete cut stays on screen until the next is ready.

### Label sampling

A cap point takes the label with the largest summed trilinear weight over its eight surrounding voxels (`LABEL_AT`, the ANTs genericLabel rule), visiting corners in the same order as the CPU `Volume.label`, so ties break identically. The result is exact at voxel centres and never a label absent from the eight neighbours. Where a region has a parcel solid, the cap is that solid's geometry; atlases with no parcel solids (NextBrain and the layer cut atlases) colour the envelope and structure caps from the label volume beneath them (`tissues/cap-labels.ts`), code 0 keeping the cap's own colour.

### Plane geometry

Positions are FreeSurfer surface RAS millimetres. Normals are +R (sagittal), +A (coronal) and +S (axial); an oblique normal is

$$\mathbf{n} = (\sin t \cos a,\ \sin t \sin a,\ \cos t)$$

for tilt $t \in [0°, 90°]$ and azimuth $a \in [-180°, 180°]$. The offset range is the coordinate box, ±128 mm on each axis and widened to the spinal cord's bounds while the cord is shown, projected on $\mathbf{n}$; for an oblique plane it stops where the plane's foot on its normal would leave that box. The clipping plane removes the half-space $\mathbf{n} \cdot \mathbf{x} > d$, or the other half when reversed.

## Display

**Section** chooses **Full brain**, **Sagittal**, **Coronal**, **Axial** or **Oblique** and the cut labels. The section bar sets the offset (0.5 mm steps), and for an oblique plane tilt and azimuth (1° steps, default 30° each); **Reverse side** keeps the other half. The camera turns to face the cut.

Caps follow **Colour** as the surfaces do (`paintSolids`). In Tissue colour only, the T1 modulates the lit face:

$$c' = c\,\bigl(1 + s\,(2I - 1)\bigr), \qquad I = \operatorname{clamp}\!\left(\frac{T_1 - 85}{180 - 85},\,0,\,1\right),$$

with $s$ = `intensity.cut_strength` = 0.5; under a published palette (atlas, network, territory, CAB-NP or paint colours) $s = 0$. Solid caps also tilt their shading normal along the in-plane T1 gradient by `solid_relief_mm` = 1.2 mm; no geometry moves. The face under the pointer is lifted toward white by 0.26, the selection by 0.45 (`HIGHLIGHT_LIFT`). Label textures are `R16UI` (`R8UI` for white matter) with nearest filtering; a hidden label is discarded from the cap. Focus greys every cap except the selection and its constituents ([dissection and display](dissection-and-display.md)).

URL keys: `cut` (`sagittal`, `coronal`, `axial`, `oblique`), `pos` (mm, to 0.1), `rev`, `tilt`, `az` and `cuts` (cut atlas).

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| Volume round trip (`validate_volumes.py`; `test_volumes.py`) | Each volume decodes, matches both checksums, and placed by its affine equals its source; the crop rebuilds the full grid | passes |
| Destrieux cut labels (`test_tissue_labels.py`) | Identical to `aparc.a2009s+aseg.mgz` | passes; 185 labels |
| Projected cut labels (`test_tissue_labels.py`) | Non-cortical voxels equal Destrieux; every ribbon voxel holds its nearest-vertex label | passes; 181,550 left and 179,697 right ribbon voxels; 47 and 69 cortical voxels outside the ribbon |
| NextBrain blocks (`test_nextbrain.py`) | Every block recounted label by label is its majority; ties go to the rarer label | passes; 110,382 tied blocks; 96.4% of source voxels equal their block's label |
| White matter (`test_white_matter.py`) | Parcel voxels equal `wmparc.mgz` | passes; 68 parcels |
| Envelopes (`test_solids.py`) | Identical topology; vertex error ≤ $2 \times 10^{-5}$ mm; closed and outward | $3.7 \times 10^{-6}$ mm |
| Ribbon labels (`test_ribbons.py`) | Same partition as the annotation; no open wedge edge | 0 holes; 80, 170, 149 and 231 pinch edges (Destrieux, HCP-MMP, Julich-Brain, Schaefer) |
| Structure solids (`validate.py`) | Displacement ≤ 0.6 mm; no voxel centre on the wrong side | 0.60 mm maximum; 0 misclassified centres in 430 solids (aseg, NextBrain, teaching set) |
| Sectioner (`plane-section.test.ts`) | Box section has the square's area; holes kept; non-manifold cut reported | passes |
| Worker (`solid-sections.test.ts`) | Worker caps equal main-thread caps; a failure rejects every build | passes |
| GPU labels (`label-sampling.svelte.test.ts`, `gpu-sections.test.ts`) | `labelAt` equals `Volume.label`; GPU world-to-voxel equals CPU within $10^{-12}$ | passes |
| Planes (`coordinates.test.ts`, `sections.test.ts`) | Oblique frame orthonormal; every reachable oblique offset is a legal cut | passes |

## Limitations

- Cut labels are 1 mm (0.8 mm for NextBrain); thin structures are coarser on a cut than on their surfaces.
- 31 NextBrain labels win no block and appear on no cut.
- HCP-MMP, Julich-Brain and Schaefer cut labels are ribbon-restricted projections of surface labels.
- Voxel boundaries and the cortical surfaces need not coincide.
- 116 of 324 structure solids on CDMD touch themselves across voxel corners; their cuts can fall back to the stencil cap.
- FreeSurfer reported 8 surface defect holes (3 left, 5 right) before repair.
- Label boundaries are not anti-aliased.
- T1 modulation and relief are illustrative, not optical or histological properties.
- Julich-Brain gap maps and the medial wall are unlabelled on a cut.

## Code availability

| | |
| :--- | :--- |
| Code | [`brain_model/labels/tissue_labels.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/labels/tissue_labels.py), [`volumes.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/labels/volumes.py), [`white_matter.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/labels/white_matter.py), [`nextbrain.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/labels/nextbrain.py); [`brain_model/surfaces/solids.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/surfaces/solids.py), [`ribbons.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/surfaces/ribbons.py); [`web/src/lib/engine/tissues/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/lib/engine/tissues), [`web/src/lib/engine/slices/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/lib/engine/slices) |
| Configuration | [`config/model.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/model.yaml): `nextbrain.cut_label_spacing_mm`, `nextbrain.minimum_mesh_volume_mm3`, `nextbrain.segmentation_lattice_mm`, `appearance.intensity`, `validation.coordinate_tolerance_mm` |
| Tests | `tests/test_tissue_labels.py`, `test_volumes.py`, `test_white_matter.py`, `test_solids.py`, `test_ribbons.py`, `test_nextbrain.py`; `web/src/lib/engine/tissues/*.test.ts`, `web/src/lib/engine/slices/*.test.ts` |

```bash
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_tissue_labels.py tests/test_volumes.py tests/test_white_matter.py tests/test_solids.py tests/test_ribbons.py tests/test_nextbrain.py
npm test --prefix web -- tissues slices
npm run test:browser --prefix web -- label-sampling
```

Figure state (Fig. 1b): https://planumatlas.com/#anatomy=cdmd&atlas=destrieux&colors=atlas&cut=coronal&pos=-20
