# Overlays

A reader's own NIfTI-1 map in an MNI template, one volume or a series of them, is read in the browser, carried onto CDMD sub_013 through the inverse of that template's published [coordinate](published-coordinates.md) field, and drawn on the cortex, the deep surfaces and every cut face with a two-sided colour scale. A cluster table is computed on the file's own grid as nilearn's `get_clusters_table` computes it. A series is drawn one volume at a time, chosen with a slider or played, and a selected region's mean at each volume is plotted. The file never leaves the reader's computer, and the result is a template map on one person's folds, not that person's data.

```{figure} figures/overlays-1.webp
:alt: Top left, lateral view of a grey left hemisphere with a red-to-yellow patch on the inferior frontal gyrus, a small red patch on the posterior temporal cortex and a blue patch on the parietal cortex. Bottom left, a coronal section seen from the front with a large red-to-yellow region on the left frontal cut face. Right, the Overlay popover with the file summary, template, threshold 3.1, colours up to 7, and three clusters with their peaks.
:name: fig-overlays-1

**A synthetic z map in MNI152NLin2009cAsym carried onto this brain.** **a**, Left lateral view, pial surface; each vertex shows the mean of 10 samples between its pial and white positions. **b**, Coronal section at y = +23.4 mm surface RAS, seen from the front (left hemisphere on the image's right); the cut face shows the 1 mm resampled volume, so the frontal cluster appears whole, including the white matter the cortical sampling does not reach. **c**, The **Overlay** popover: grid, value range (−5.5 to 7) and cortical reach; **Threshold** 3.1, **Colours up to** 7 (the default, $\max\lvert v
vert$ = 6.995 rounded up to three significant digits), opacity 100%; and the cluster table in template millimetres: peaks z = 7 at (−46, 22, 4), 6.55 at (−48, −60, −8) and −5.5 at (−34, −70, 40), 7,456, 7,048 and 6,288 mm³, as nilearn 0.12.1 `get_clusters_table` gives for the same file. Red–yellow codes z from 3.1 to 7, blue–cyan from −3.1 to −7. The map is $97 \times 115 \times 97$ voxels of 2 mm: Gaussian blobs ($\sigma$ = 10 mm) of z = +7 at (−42, 22, 6), +6 at (−48, −60, −8) and −6 at (−38, −68, 42) MNI, over smoothed Gaussian noise (seed 0), written with `NIFTI_INTENT_ZSCORE` by nibabel. Subject CDMD sub_013; **Colour** Tissue.
```

## Data

| Input | Source | Use |
| :--- | :--- | :--- |
| The reader's NIfTI-1 file (`.nii`, `.nii.gz`): one volume of ≤ $32 \times 2^{20}$ voxels, or a series along the fourth axis of ≤ $64 \times 2^{20}$ values | Reader's computer | The map |
| `coordinates-<space>.field` | [Published coordinates](published-coordinates.md#data): MNI152NLin2009cAsym and SPM12 (TPM), 1.5 mm | Template → surface RAS registration, inverted here |
| `tissue-envelopes.glb` | Native `lh`/`rh` pial and white surfaces | Cortical sampling |
| `ribbon-<atlas>.labels`, `cortex-<atlas>.glb` | Four cortical atlases ([cortical atlases](cortical-atlases.md)) | Values on the parcel meshes |

## Method

### Reading
The reader places a file where nibabel does: the sform when `sform_code` ≠ 0, else the qform (`get_best_affine`), with nibabel's quaternion threshold, qfac and pixdim fixes on load; `scl_slope` and `scl_inter` are applied as `get_fdata` applies them; non-finite values become NaN. A file is refused, with its reason, if it is not single-file NIfTI-1, has more than one value along any axis past the fourth, has a single slice on any axis, has neither sform nor qform, exceeds $32 \times 2^{20}$ voxels a volume or $64 \times 2^{20}$ values across its volumes, holds no finite value or only zeros, or reaches neither cortex nor the 1 mm grid in any volume. A series' spacing is nibabel's `get_zooms()[3]` in seconds when `xyzt_units` gives the time axis a unit (s, ms or µs) and the spacing is positive; otherwise its volumes are only numbered. `toffset` is ignored, as nibabel ignores it.

### Field inversion
The published field $F$ maps template mm to surface RAS. For each node $\mathbf{q}$ of a surface RAS grid at the field's 1.5 mm spacing, Newton's method, started from an affine fit of $F$, solves $F(\mathbf{p}) = \mathbf{q}$ to 0.001 mm (at most 20 iterations). A node whose solution needs a field node outside the template's dilated brain has none. Overlay and coordinate placement therefore share one registration.

### Sampling
The map is read by trilinear interpolation between voxel centres over the voxels with a value; a zero or NaN voxel has none. A point carries $(\sum w_i v_i, \sum w_i)$ over its eight voxels with a value and shows $\sum w_i v_i / \sum w_i$ where $\sum w_i \ge \tfrac{1}{2}$, as the parcel meshes below do. The edge of a masked or thresholded map therefore lies halfway between voxel centres with rounded corners, and its colours come from its own voxels; a map with a value everywhere reads as plain trilinear interpolation. A point beyond the outermost centres has no value. Where every voxel has a value this matches nilearn; nilearn instead gives no value next to a NaN and reads zeros as values.
1. **Cortex.** Each native vertex takes the mean of 10 samples evenly spaced from its pial to its white position, samples without a value excluded, as nilearn `vol_to_surf(…, inner_mesh=…)` does.
2. **Volume.** The pair is resampled onto a 1 mm surface RAS grid with centres on whole millimetres and interpolated again, sum and share alike, by the cut faces, deep structures and Linked MRI, so the edge stays where the first reading put it.
3. **Parcel meshes.** Atlas meshes add edge midpoints and triangle centres where a triangle's corners differ in label. Each added vertex carries $(\sum v_i, w)$: the sum over native parents with a missing value as 0, and $w$ the share of parents with a value; the fragment shows $\sum v_i / w$ where $w \ge \tfrac{1}{2}$. Parent order is rebuilt from the envelopes and ribbon labels and every vertex is checked against its position to $10^{-6}$ m.

### Colour scale
With threshold $\tau \ge 0$ and top $m > \tau$, a value $v$ is drawn when $\lvert v\rvert > \tau$, with

$$\text{colour}(v) = \mathbf{c}_0 + \min\!\left(1, \frac{\lvert v\rvert - \tau}{m - \tau}\right)(\mathbf{c}_1 - \mathbf{c}_0),$$

where $(\mathbf{c}_0, \mathbf{c}_1)$ is red (1, 0, 0) to yellow (1, 1, 0) for $v > 0$ and blue (0, 0, 1) to cyan (0, 1, 1) for $v < 0$ (FSL Red-Yellow, Blue-Lightblue). A statistical map has no default $\tau$; $m$ defaults to $\max\lvert v\rvert$ rounded up to three significant digits. A map whose finite values are all 0 or 1 is a mask, drawn at $\tau = 0.5$, $m = 1$. The statistic (z, t, F, r) is taken from the intent code, else an SPM `SPM{T_[df]}` description, else FSL or SPM output names (`zstat1`, `tstat1`, `zfstat1`, `fstat1`, `spmT_0001`, `spmF_0001`).

### Clusters
The table follows nilearn 0.12.1 two-sided `get_clusters_table` on the file's grid, so its coordinates are template mm: voxels with $\lvert v\rvert > \tau$ compared in float32; face connectivity; positive clusters first, each sign numbered from 1 by its most extreme peak; local maxima over 26 neighbours, a plateau counted once; at most three sub-peaks, each more than 8 mm from the last kept; size = voxels × voxel volume, truncated. A minimum cluster size $k$ (nilearn `cluster_threshold`, in the file's voxels) zeroes smaller clusters as `threshold_img(…, cluster_threshold=k, two_sided=True)` does, and the trimmed map is carried again so surface, cuts and table agree.

### Series
A series' range, mask test and default top are taken over every volume, so every volume is drawn at one threshold and one colour scale; rescaling each volume would make a weak one look as strong as the peak. Its cortical reach is that of the voxels with a value in any volume. One volume is carried at a time, as a single map is, and the cluster table and minimum cluster size apply to it. A volume asked for while another is being carried is carried only if it is still the newest once that one is done. Playing steps through the volumes in order and loops, at most 4 volumes a second, each once the last is placed; no cluster table is computed while it plays. A newly placed volume is reached from the one drawn before by linear interpolation: the (sum, share) pairs of both, on the 1 mm grid and at each cortical vertex, are mixed before the quotient, threshold and colour, over as long as the last step took (at least 250 ms; 250 ms for a step on its own). Only the frames in between are interpolated; a paused or chosen volume is drawn as carried, and under reduced motion each volume replaces the last at once. The Linked MRI shows the carried volumes only.

**Region course.** For a selected region, the whole-millimetre surface RAS points inside its closed solid (a structure's mesh, or a cortical parcel's ribbon solid in the shown atlas) are found by the winding count along rows in x, set 0.0013 and 0.0007 mm off the whole millimetre in y and z so no row runs along a marching-cubes lattice edge. Each point is read through the inverse field as a cut face reads the 1 mm grid at that centre. A volume's mean is over the points with a value there, before the threshold, which is voxelwise and says nothing of a mean; a volume where no point has a value has no mean.

## Display
**Overlay** in the stage dock (absent on stages narrower than 480 px) offers **Template** (MNI152NLin2009cAsym, SPM12 (TPM), or MNI not stated, read as MNI152NLin2009cAsym), **Title**, **Statistic**, **Threshold**, **Colours up to**, **Minimum cluster size**, **Opacity** (10–100%), **Cortex surface** (pial, mid-thickness or white; the pial while a cut is open; also in **Display**, where it applies without a map) and **Clusters and peaks**. Once a map is open, the controls adjusted while looking come first: **Show on the brain**, then for a series **Volume** (a slider named by the volume's place and time) and **Play**/**Pause**, then **Threshold**, **Colours up to** and **Opacity**. Template, Title, Statistic, Minimum cluster size and Cortex surface fold under **Map settings**, whose closed line names each one's current value. The map is drawn only once a threshold is given. Values are compared with $\tau$ per fragment. The volume is an RG32F texture (sum, share) read with `texelFetch` and interpolated in the shader. Cut faces are unlit so their colours equal the key's; cortex and deep surfaces are lit. While a map is shown an atlas colouring changes to Tissue and is restored afterwards; T1 MRI colouring is kept. Choosing a peak places it as a published coordinate. **Download CSV** writes every peak at full precision. **Save image** adds the key and a caption line: title, template, `|z| > τ, colours to m`, opacity below 100%, minimum cluster size ≥ 2 and a non-pial surface ([sharing and snapshots](sharing-and-snapshots.md)). For a series the key's title adds the volume's time (its place when the header gives no spacing) and the caption adds `volume k of n at t s`. A selected region's sheet adds **Map over time**: the course against time with the drawn volume marked, the count of the region's points with a value, and a table of values. The plot is one slider: a click, the arrows, Home and End choose the volume drawn. The map is not written into the link.

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| `nifti.test.ts` | 9 fixtures written by nibabel 5.4.2 (all eight stored types, both byte orders, scaling, sform over qform, qform-only with qfac −1, nibabel's header fixes) and each refusal | passes |
| `sampling.test.ts`, `vol_to_surf` | 40 vertices on an oblique volume, against nilearn 0.12.1 | equal within $10^{-4}$ |
| `sampling.test.ts`, edges | A map against zero or NaN voxels: edge halfway between centres, colour from its own voxels, corners rounded; the 1 mm volume puts a straight edge in the same place | passes |
| `inverse-field.test.ts`, solved nodes | The published field carries each solved node back within 0.002 mm | passes; 352,704 nodes (MNI152NLin2009cAsym), 392,346 (SPM12) |
| `inverse-field.test.ts`, brain points | 20,000 random points read through the inverse and forward fields | p95 ≤ 0.1 mm, max < 1 mm |
| `sampling.test.ts`, coverage | A 2 mm map of ones over the whole template reaches > 99.5% of cortical vertices | 99.85% left, 99.98% right (MNI152NLin2009cAsym) |
| `sampling.test.ts`, blobs | 4 mm Gaussian blobs at (−42, 22, 6), (38, −22, 56), (−24, −4, −20) peak on the 1 mm grid within 0.9 mm of the Coordinate tool's landing | passes |
| `partition.test.ts` | Every parcel vertex of the four published atlases where the native pial and ribbon labels put it | passes |
| `clusters.test.ts` | 12 tables on 5 maps from nilearn 0.12.1 (sub-peak distances, NaN holes, edge- and corner-only contacts, bridges equal to the threshold, plateaus, ties, oblique and anisotropic grids, up to 73 clusters, two with `cluster_threshold`) | equal; peak coordinates within $10^{-9}$ mm |
| `display.test.ts`, `key.test.ts`, `user-map.svelte.test.ts` | Threshold masking, saturating scales, three-digit default top, statistic detection, caption and key; table follows the drawn threshold | passes |
| `nifti.test.ts`, series | Volumes in the file's order; spacing from `xyzt_units` (s, ms), none without a time unit or a positive spacing; axes past the fourth and series over $64 \times 2^{20}$ values refused | passes |
| `carry.test.ts`, series | Range over every volume; the volume asked for is carried; reach over any volume; an empty first volume is shown, a series refused only when no volume reaches the brain | passes |
| `course.test.ts` | A map linear in template x gives the mean of the points' template x; a point reads what the cut faces draw at that centre of the 1 mm grid; points without a value are left out | within $10^{-4}$ and $10^{-5}$ |
| `region-points.test.ts` | A 10 mm sphere (64 × 48 segments) holds every whole millimetre within 9.95 mm of its centre and none beyond 10 mm; overlapping solids give each point once | passes |
| `user-map.test.ts`, `user-map.svelte.test.ts`, `MapCourseSection.svelte.test.ts` | A volume is carried once per volume and extent; volumes passed over while one is carried are not carried; the volume is kept across templates; playing steps, loops and lists no clusters until paused; a new volume holds the last one drawn and blends from it on the grid and the cortex, but not for a new extent of the same volume or under reduced motion; the course plot names each mean and draws the volume chosen | passes |

A synthetic 12-volume series in MNI152NLin2009cAsym (2 mm, TR 2 s; canonical-shaped responses of σ = 6 mm at (−8, −92, 2) peaking at 6 s and at (−38, −24, 58) peaking at 10 s) gives a left calcarine sulcus course peaking at 4–6 s and draws the precentral response at 10 s. In headless Chrome on an Apple M5 a volume is carried in 276 ms (median of 17), so playing reaches 3.4 volumes a second; dragging the slider through 12 volumes carries 3 of them and draws the last 0.43 s after the drag ends.

Node counts and coverage are the values those tests assert against, measured on the published CDMD fields; SPM12 coverage is 99.98% left and 99.996% right.

## Limitations
- A template map carried by a registration of the template to CDMD sub_013: its place on these folds, not this person's activity or anatomy.
- Template space only. A native-space or Talairach map lands in the wrong place, and no NIfTI header states which MNI template a map is in.
- Interpolation is trilinear: a label atlas with more than two values is blended between labels.
- Deep surfaces are sampled where they lie, mixing a structure with its surroundings; cut faces show the volume itself.
- A series holds at most $64 \times 2^{20}$ values, about 60 volumes at 2 mm. A preprocessed BOLD run is usually larger, and is in scanner units rather than activation: it needs a model first.
- Playing is bounded by carrying a volume, about 3–4 volumes a second; clusters are listed only while paused.
- The frames between two volumes are linear interpolations, not data. Between volumes that are not correlated (single-trial estimates, for example), values partly cancel at the midpoint, so less of the map passes the threshold there: between two consecutive single-trial beta maps, the stage showed 6–8% as many coloured pixels at the midpoint as at either end.
- The region course is the mean of the map's values in the region, not a statistic of the region. A structure's points come from its mesh at whole millimetres, so a solid thinner than 1 mm may have none; an all-zero volume has no value, not a mean of 0.
- Not carried in a link; the saved image keeps it.
- Minimum cluster size is in the file's voxels, so the same $k$ is more tissue in a 2 mm map than in a 1 mm map. Cluster volumes come from the sform's column lengths, not pixdim.
- Refusal reasons come from the reader in English after a translated lead.

## Code availability

| | |
| :--- | :--- |
| Code | [`web/src/lib/core/user-map/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/lib/core/user-map) (`nifti.ts`, `inverse-field.ts`, `sampling.ts`, `partition.ts`, `carry.ts`, `course.ts`, `display.ts`, `clusters.ts`), [`web/src/lib/engine/user-map/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/lib/engine/user-map), [`web/src/lib/state/user-map.svelte.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/state/user-map.svelte.ts), [`web/src/features/user-map/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/features/user-map), [`web/src/features/inspector/MapCourseSection.svelte`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/features/inspector/MapCourseSection.svelte) |
| Configuration | None; `DEPTH_SAMPLES` (10) and `VOLUME_SPACING_MM` (1) in `sampling.ts`, `MAX_VOXELS` and `MAX_VALUES` in `nifti.ts`, `VOLUMES_PER_SECOND` (4) in `display.ts`, colour scales in `display.ts` |
| Tests | `web/src/lib/core/user-map/*.test.ts`, `web/src/lib/engine/user-map/*.test.ts`, `web/src/lib/state/user-map.svelte.test.ts`, `web/src/features/user-map/*.test.ts`; fixtures from `fixtures/make-fixtures.py` (nibabel), `make-vol-to-surf.py` and `make-clusters.py` (nilearn 0.12.1) |

```bash
cd web && npx vitest run --project unit src/lib/core/user-map src/features/user-map src/lib/engine/slices src/lib/engine/user-map
cd web && npx vitest run --project browser src/lib/state/user-map.svelte.test.ts src/features/user-map src/features/inspector/MapCourseSection.svelte.test.ts
uv run --no-project --with nilearn==0.12.1 python -I web/src/lib/core/user-map/fixtures/make-clusters.py
```

The figure's map is not part of the repository. It was generated with nibabel 5.4.2 and SciPy 1.18.1: the three blobs above summed with `scipy.ndimage.gaussian_filter` noise ($\sigma$ = 2 voxels, `mode="wrap"`, `numpy.random.default_rng(0)`) scaled to s.d. 0.6, saved as `zstat1.nii.gz` with sform and qform code 4. Figure state (Fig. 1a, c): https://planumatlas.com/#anatomy=cdmd&view=left; (Fig. 1b): https://planumatlas.com/#anatomy=cdmd&cut=coronal&pos=23.4; then **Overlay** → the file, **Template** MNI152NLin2009cAsym, **Threshold** 3.1.
