# Overlays

A researcher's own NIfTI map in an MNI template is read in the browser, carried onto this brain by that template's published registration, and drawn on the cortex, the deep structures and every cut face with a colour scale. Save image writes the key and a caption naming the file, the template and the scale. The file never leaves the reader's computer.

:::{list-table}
:widths: 22 78
:stub-columns: 1

* - Where in the viewer
  - **Overlay** in the stage dock: a **Template** choice, **Choose a NIfTI file…**, **Title**, **Statistic**, **Threshold**, **Colours up to**, **Minimum cluster size**, **Opacity**, **Cortex surface**, **Show on the brain**, **Clusters and peaks**, **Remove**. The key appears at the stage's top right; the linked MRI draws the map on its planes and gives its value under the crosshair. Not written into a link, because the file is the reader's.
* - Built by
  - Viewer only; no build step. [`web/src/lib/core/user-map/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/lib/core/user-map) (`nifti.ts`, `inverse-field.ts`, `sampling.ts`, `partition.ts`, `carry.ts`, `display.ts`), [`web/src/lib/engine/user-map/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/lib/engine/user-map) (`user-map-worker.ts`, `user-map.ts`, `overlay.ts`), [`web/src/lib/state/user-map.svelte.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/state/user-map.svelte.ts), [`web/src/features/user-map/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/features/user-map)
* - Configuration
  - None. `DEPTH_SAMPLES` (10) and `VOLUME_SPACING_MM` (1) are in `sampling.ts`; the colour scales are in `display.ts`.
* - Source data
  - The reader's file. The published template fields and their registration ([Published coordinates](published-coordinates.md)); the native pial and white envelopes and each atlas's ribbon labels ([Cortical atlases](cortical-atlases.md)).
* - Checked by
  - `nifti.test.ts` against nibabel 5.4.2, `sampling.test.ts` against nilearn 0.12.1, `inverse-field.test.ts`, `partition.test.ts`, `carry.test.ts`, `display.test.ts` in `web/src/lib/core/user-map/`; `user-map.svelte.test.ts` in `web/src/lib/state/`; `key.test.ts` in `web/src/features/user-map/`
:::

## What it does

**Overlay** takes a single-volume NIfTI-1 file (`.nii` or `.nii.gz`): a statistical map, a lesion or ROI mask, any map in an MNI template. The reader names the template as for a published coordinate: MNI152NLin2009cAsym (fMRIPrep's default), SPM12's tissue probability maps, or MNI not stated, read as MNI152NLin2009cAsym. The popover then gives the grid, its voxel size, the range of its values and the share of this brain's cortex it reaches.

- **Threshold.** Values whose magnitude is above it are drawn; those within ±threshold are not. A statistical map is not drawn until a threshold is typed, and the field takes focus when the map is ready: which threshold is right is the analysis's call, and drawing every value but zero, nilearn's default, shows mostly noise. 0 draws every value but zero. A map whose finite values are all 0 or 1 is a mask and is drawn at once at 0.5, where interpolation puts its edge.
- **Title and statistic.** The key and the saved image name the map by its title, which starts as the file's name without its extension. The statistic (z, t, F or r) names the key's numbers and the caption's threshold. It starts as the file says: its NIfTI intent code, else SPM's `SPM{T_[df]}` description, else FSL's and SPM's own output names (`zstat1`, `tstat1`, `zfstat1`, `fstat1`, `spmT_0001`, `spmF_0001`). Otherwise the key gives plain values.
- **Colours up to.** Positive values run from red at the threshold to yellow at this value, and negative values from blue to light blue (FSL's Red-Yellow and Blue-Lightblue). Beyond it a value keeps the end colour. It starts at the largest magnitude in the file, rounded up to three significant digits so the key's number is the scale's.
- **Minimum cluster size.** nilearn's `cluster_threshold`, in the map's own voxels: a cluster beyond ±threshold with fewer voxels (face-connected, each sign apart) is neither drawn nor listed. The map is carried again without them, so the cortex, the cut faces, the linked MRI and the table always agree. The caption gives the size when it is 2 or more.
- **Opacity.** From 10% to 100%: below full, the map's colours are mixed with the grey beneath, on the cortex, the cut faces and the linked MRI alike. The key keeps the full colours, and the caption gives the opacity.
- **While the map is shown,** the cortex is one grey with its fold shading and T1 texture, and the cut faces and deep surfaces are their tissue's own lightness in grey. An atlas colouring changes to Tissue for as long as the map is shown and is given back after, as for stroke cases. T1 MRI colouring is kept, and the map is drawn over the scan.
- **Another template** reads the same file again and keeps the threshold and scale. **Remove** forgets the file.
- **Cortex surface.** Pial, mid-thickness or white: this brain's own surfaces, which share their vertices, so the parcels keep their atlas, shading and picking and every vertex its value. Deeper surfaces open the sulci, where most cortical signal lies hidden on the pial. While a cut is open the pial is drawn, because a cut face spans pial to white and must meet the surface it cuts. The caption names a surface other than the pial.
- **Clusters and peaks.** The map as drawn, tabulated as nilearn's `get_clusters_table` does it, in the map's own template millimetres: each cluster's peak and its sub-peaks, the value and the cluster's size. The table follows the threshold. Choosing a peak places it with the Coordinate tool, so its report gives the regions within 5 mm on this brain. **Download CSV** writes every peak at full precision with the file, template, statistic and threshold.
- **Linked MRI.** While the map is shown, the three planes draw it over the scan and the segmentation, from the same 1 mm grid the cut faces read, and the readout adds its value under the crosshair (`Faces > Houses: z = 7.55`). **Save PNG** keeps it.
- **Save image** adds the key and a caption line: the title, the file when the title is not its name, the template it was carried from (or "MNI, template not stated, read as MNI152NLin2009cAsym"), `|z| > threshold, colours to max` (or `|value|` without a statistic), and the opacity when it is below 100%.

A file is refused, with the reason, if it is not single-file NIfTI-1, holds more than one volume, has neither sform nor qform, is larger than 32 Mi voxels, holds no finite value or only zeros, or does not reach the brain at all.

## How a map is carried onto this brain

All of it runs in a worker, on the reader's machine. A 2 mm map loads in about 0.6 s, including the inversion.

### 1. Read the file (`nifti.ts`)

A NIfTI-1 reader that places a file where nibabel and nilearn do: the sform when `sform_code` is not 0, else the qform (`get_best_affine`), with nibabel's quaternion threshold, qfac and pixdim fixes, and `scl_slope`/`scl_inter` applied as `get_fdata` applies them. It does not use `nifti-reader-js` (bundled with NiiVue), which prefers the qform when `qform_code > sform_code` and would place such a file elsewhere. Non-finite values become NaN.

### 2. Invert the template's field (`inverse-field.ts`)

The published field carries template millimetres onto this brain, as a coordinate from a paper is placed. Pulling an image across needs the other direction. Each node of a surface RAS grid as fine as the field's (1.5 mm) is solved for the template point the field carries onto it, by Newton's method from an affine fit of the field, to 0.001 mm. A node whose solution lies beyond the template's dilated brain has none, as a coordinate there is refused. The overlay and a placed coordinate therefore rest on the same registration. The field itself is not changed.

### 3. Sample the map

The map is read by trilinear interpolation between its voxel centres. A point beyond the outermost centres, or with a NaN among its eight voxels, has no value.

- **Cortex** (`sampleCortex`): each native vertex takes the mean of 10 samples from its pial to its white position, the samples without a value left out, as nilearn's `vol_to_surf` does with `inner_mesh`. A vertex none of whose samples has a value has none.
- **Cut faces** (`resample`): the map on a 1 mm grid of this brain, its centres on whole millimetres as the segmentation's are.

### 4. Give each parcel mesh its values (`partition.ts`)

The atlas meshes split the native surface where a triangle's corners disagree, adding edge midpoints and triangle centres (`partition_surface`). Each added vertex takes the mean of its native corners, as `_SULC` and `_T1` do. Corners without a value count as 0 and the share of corners with one is kept, and the fragment divides one by the other where that share is at least ½. The viewer repeats the build's vertex order from the envelopes and the atlas's ribbon labels and checks every vertex's position against them to 1 µm, so a mismatch is an error rather than a misplaced value. Switching atlas recomputes it.

## How the viewer draws it

- **Cortex** (`materials.ts`): the per-vertex value arrives as an attribute, `_user_map`. It is compared with the threshold per fragment, so a boundary follows the interpolated value rather than the triangles, and it is lit as tissue is.
- **Cut faces** (`addUserMapToCap`): the 1 mm volume is an R32F texture read with `texelFetch` and interpolated in the shader, so the face shows the same values the cortex read. No-data voxels are stored as −3×10³⁸, because a fast-math compile cannot be trusted to keep a NaN. A cut face is a section of the map, so it is drawn unlit and its colours are exactly the key's.
- **Deep structures, the cerebellum and the exposed white surface** (`addUserMapToSurface`): read from the same volume where the surface lies, and lit.
- **Under T1 MRI colouring**, the scan replaces the surfaces' colour, so the map is drawn again after it, unlit as the scan is.
- **Linked MRI** (`renderSlice`): each pixel of a plane reads the 1 mm grid trilinear (`gridSampler`), as the cut faces' shader does, and mixes the map's colour over the scan by the opacity.
- **Other surfaces** (`moveParcels` in `user-map.ts`): a parcel vertex on the mid-thickness (halfway to white) or white surface is the mean of its native parents there, as it is on the pial; its normal is the mean of the native normals there, made unit length. Each parcel's bounds and picking tree are refitted, so a click lands on the surface drawn. The parents are found once from the published pial positions.
- **A minimum cluster size** (`withoutSmallClusters`) zeroes the voxels of the clusters smaller than it, as nilearn's `threshold_img(…, cluster_threshold=k, two_sided=True)` does, and leaves every other voxel, beneath the threshold too, so the map interpolates as before. The worker keeps the file's map and carries the trimmed copy through the cached inverted field again; the table drops the same clusters before ranking them.
- **The cluster table** (`clusters.ts`) is computed in the worker on the file's own grid, so its coordinates are the template's and do not pass through the registration. It follows nilearn 0.12.1's two-sided `get_clusters_table`: a voxel counts where `|value| >` the threshold (compared in float32, as numpy compares a float32 map); clusters join through faces only; positive clusters come first, each sign numbered from 1 by its most extreme peak, so a negative cluster is labelled with its sign (−1, −1a); local maxima over 26 neighbours, a plateau counted once at its centre; at most three sub-peaks, each more than 8 mm from the last one kept (nilearn's rule, so a sub-peak can lie nearer the main peak); size as voxels × the voxel volume, truncated. It takes about 7 ms for a 2 mm map at z > 3.1 and 23 ms at 1 mm.
- **The key** has one row per sign the map reaches beyond its threshold, each with its colour scale. The paint key a Functions or Deficits tab shows is withdrawn while the map is shown, because the map covers the paint.

## Checks

| Check | Measured |
| :--- | :--- |
| Reader against nibabel | 9 fixtures covering all 8 data types, both byte orders, scaling, sform over qform, qform-only with qfac −1 and nibabel’s header fixes, and each refusal |
| Cortex sampling against nilearn `vol_to_surf` | 40 vertices on an oblique volume with NaN voxels and lines leaving it: equal within float32 rounding (10⁻⁴) |
| Inversion, at every solved node | the published field carries it back to within 0.002 mm; 352,704 nodes (MNI152NLin2009cAsym), 392,346 (SPM12) |
| Inversion at this brain's cortex (10 depths, every 7th vertex) | round trip median 0.03 mm, p95 0.11 mm, max 0.40 mm (MNI152NLin2009cAsym); 0.03, 0.10, 0.34 mm (SPM12) |
| A map over the whole template | reaches 99.85% (left) and 99.98% (right) of cortical vertices (MNI152NLin2009cAsym); 99.98% and 99.996% (SPM12) |
| A 4 mm blob around MNI (−42, 22, 6), (38, −22, 56) and (−24, −4, −20) | peaks on the 1 mm grid within 0.9 mm (the nearest voxel centre) of where the Coordinate tool places the coordinate |
| Parcel meshes | every vertex of all four atlases where the native surface and ribbon labels put it |
| Minimum cluster size against nilearn | `get_clusters_table(…, cluster_threshold=k)` and the voxels `threshold_img` keeps, equal on smooth noise with k set to one cluster's own size (kept) and on spikes at k = 2 |
| Cluster table against nilearn `get_clusters_table` | 10 tables on 5 maps (sub-peaks nearer and farther than 8 mm, NaN holes, edge- and corner-only contacts, bridges equal to the threshold, plateaus, ties, oblique and anisotropic grids, up to 73 clusters): equal, coordinates to 10⁻⁹ mm; and every row of realistic 2 mm and 1 mm maps, up to 743 rows |

## Limits

- **It is a template map on one person's brain.** The map is carried by a registration of the template to CDMD sub_013. Where it lands on these folds is that registration's reading, not this person's activity or anatomy. For a published figure, say so: the caption names the subject and the template.
- **Template space only.** A map in a subject's native space, or in Talairach, will land in the wrong place, and nothing in a NIfTI header says which MNI template a map is in. The reader chooses, and "not stated" reads as MNI152NLin2009cAsym. FSL's MNI152NLin6Asym lands a median 1.6 mm from it at the cortex ([Published coordinates](published-coordinates.md)).
- **Linear interpolation only.** A label atlas with more than two values is blended between labels and should not be drawn this way. A mask is read at 0.5.
- **The deep surfaces are read where they lie.** A structure's surface is its boundary, so its value mixes the structure with what surrounds it. The cortex avoids this by sampling between its pial and white surfaces. The cut faces show the volume itself.
- **One volume.** A 4D file is refused, not split. Save the volume to show as its own file.
- **Not in a link.** A link opens without the map; the image keeps it.
- **Not on a narrow stage.** On a stage under 480 px wide, a phone's, the dock keeps its other four tools on one row; a tablet or a wider window has Overlay.
- **Refusal messages** come from the reader in English, after a translated lead.
- **The cluster size is in the file's voxels**, as nilearn's is, so the same number means more tissue in a 2 mm map than in a 1 mm one. Where more than 16 peaks or clusters tie exactly, it keeps scipy's label order, where numpy's sort leaves it to the machine; a file whose pixdim disagrees with its sform has its cluster volumes from the sform.

## Reproduce

```bash
cd web && npx vitest run --project unit src/lib/core/user-map src/features/user-map src/lib/engine/slices
```

```bash
cd web && npx vitest run --project browser src/lib/state/user-map.svelte.test.ts
```

The fixtures are written by `web/src/lib/core/user-map/fixtures/make-fixtures.py` (nibabel), and `make-vol-to-surf.py` and `make-clusters.py` (nilearn 0.12.1, run with `uv run --no-project --with nilearn==0.12.1`).

## See also

- [Published coordinates](published-coordinates.md): the template fields the overlay inverts.
- [Cortical atlases](cortical-atlases.md): the native surfaces and the partition each atlas mesh is cut from.
- [Sections and cuts](sections-and-cuts.md): the cut faces the volume is drawn on.
- [Sharing and snapshots](sharing-and-snapshots.md): Save image, its key and caption.
