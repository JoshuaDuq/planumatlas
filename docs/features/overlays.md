# Overlays

A reader's own statistical map or mask in a Montreal Neurological Institute (MNI) template, stored as one NIfTI-1 (Neuroimaging Informatics Technology Initiative) volume or a series of them, is read in the browser and drawn on CDMD sub_013: on the cortex, the deep surfaces and every cut face, with a two-sided colour scale. The map is carried through the inverse of that template's published [coordinate](published-coordinates.md) field; on the [MNI template](mni-template.md) a map in MNI152NLin2009cAsym is read through the template's own scale instead of a field. A cluster table is computed on the file's own grid as nilearn's `get_clusters_table` computes it. A series is drawn one volume at a time, chosen with a slider or played, and a selected region's mean at each volume is plotted. The file never leaves the reader's computer, and the result is a template map on one person's folds, not that person's data.

```{figure} figures/overlays-1-light.webp
:alt: Three panels. a, a grey brain seen from the left with a red-to-yellow patch on the inferior frontal gyrus, a small red patch on the posterior temporal cortex and a blue patch on the parietal cortex, above a key of the two colour ramps. b, a coronal cut seen from the front with a large red-to-yellow region on the left frontal cut face. c, the Overlay tool with the file summary, threshold 3.1, colours up to 6.9, and three clusters with their peaks and volumes.
:name: fig-overlays-1

**A synthetic z map in MNI152NLin2009cAsym is carried onto this brain.** **a**, [The brain from the left](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&view=left), on the pial surface. Each vertex shows the mean of 10 samples between its pial and white positions. **b**, [Coronal cut at y = 23.4 mm](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&cut=coronal&pos=23.4&view=anterior) surface RAS, seen from the front (the left hemisphere on the image's right). The cut face shows the 1 mm resampled volume, so the frontal cluster appears whole, including the white matter the cortical sampling does not reach. **c**, The **Overlay** tool of **Add**, with **Clusters and peaks** open. It gives the grid, the value range (−5.47 to 6.9) and the cortical reach, a **Threshold** of 3.1, **Colours up to** 6.9 (the default, $\max\lvert v \rvert$ = 6.897 rounded up to three significant digits) and an opacity of 100%. The cluster table is in template millimetres, with peaks of z = 6.9 at (−46, 22, 6), 6.46 at (−48, −60, −8) and −5.47 at (−34, −70, 40) and volumes of 7,728, 6,912 and 6,240 mm³, as nilearn 0.12.1 `get_clusters_table` gives for the same file. Red–yellow codes z from 3.1 to 6.9 and blue–cyan from −3.1 to −6.9, as in the key. The map is $97 \times 115 \times 97$ voxels of 2 mm: Gaussian blobs ($\sigma$ = 10 mm) of z = +7 at (−42, 22, 6), +6 at (−48, −60, −8) and −6 at (−38, −68, 42) MNI, over Gaussian noise smoothed with $\sigma$ = 4 mm (periodic edges) and scaled to s.d. 0.5 (NumPy `default_rng(0)`), written with `NIFTI_INTENT_ZSCORE` by nibabel. The map is not part of a link, so each link opens the view and the file is then opened in the tool with **Template** MNI152NLin2009cAsym. Subject CDMD `sub_013`; **Colour** changes to **Tissue** while the map is shown. Scale bars apply at the depth of the camera's target.
```

## Data

| Input | Source | Use |
| :--- | :--- | :--- |
| The reader's NIfTI-1 file (`.nii`, `.nii.gz`): one volume of ≤ $32 \times 2^{20}$ voxels, or a series along the fourth axis of ≤ $64 \times 2^{20}$ values | Reader's computer | The map |
| `coordinates-<space>.field` | [Published coordinates](published-coordinates.md#data): MNI152NLin2009cAsym and SPM12 (TPM, tissue probability maps), 1.5 mm | Template → surface RAS (right, anterior, superior) registration, inverted here |
| `tissue-envelopes.glb` | Native `lh`/`rh` pial and white surfaces | Cortical sampling |
| `ribbon-<atlas>.labels`, `cortex-<atlas>.glb` | Five cortical atlases ([cortical atlases](cortical-atlases.md)) | Values on the parcel meshes |

## Method

### Reading

The file is placed where nibabel places it. The affine is the header's sform when `sform_code` ≠ 0 and its qform otherwise (`get_best_affine`), with nibabel's quaternion threshold and the `qfac` and `pixdim` fixes it makes on load. `scl_slope` and `scl_inter` are applied as `get_fdata` applies them, and non-finite values become NaN (not a number).

A file is refused, with its reason, if it is not single-file NIfTI-1 or has neither sform nor qform. So is a file with more than one value along any axis past the fourth, or a single slice on any axis. A file is refused for its size when a volume exceeds $32 \times 2^{20}$ voxels, when its volumes together exceed $64 \times 2^{20}$ values, or when it is larger than 553,648,480 bytes. That byte limit is the sum of the 352 bytes before the earliest data, 16 MiB of header extensions and $64 \times 2^{20}$ float64 values, and a larger file is refused before it is read. A `.nii.gz` is checked from its first 348 inflated bytes and inflated no further than the length that header states; a file that inflates past it is refused. A map that holds no finite value or only zeros, or that reaches neither cortex nor the 1 mm grid in any volume, is refused. A file is also refused when its data are stored in a type other than the eight read (signed and unsigned 8-, 16- and 32-bit integers, float32 and float64), start inside the header, are cut short or scale beyond the float32 range, or when its affine is not finite or is singular.

A series' spacing is nibabel's `get_zooms()[3]` in seconds when `xyzt_units` gives the time axis a unit (s, ms or µs) and the spacing is positive; otherwise its volumes are only numbered. `toffset` is ignored, as nibabel ignores it.

### Field inversion

The published field $F$ maps template millimetres to surface RAS. For each node $\mathbf{q}$ of a surface RAS grid at the field's 1.5 mm spacing, Newton's method, started from an affine fit of $F$, solves $F(\mathbf{p}) = \mathbf{q}$ to 0.001 mm in at most 20 iterations. A node whose solution needs a field node outside the template's dilated brain has none. Overlay and coordinate placement therefore share one registration.

### On the MNI template

The template's space is an affine, $\mathbf{q} = 0.9\,\mathbf{p} + \mathbf{t}$ with $\mathbf{t} = (-0.45, +15.75, -16.65)$ mm, so its inverse is exact. Each node of a 1 mm surface RAS grid over aseg's brain widened by 4 mm reads the map at $(\mathbf{q} - \mathbf{t})/0.9$, and a node outside that box has none (`nativeInverse`). No field is downloaded or solved. A map in SPM12's space goes through the template's own SPM12 field, inverted as on CDMD ([MNI template](mni-template.md#its-own-coordinate-space)). Sampling, colour, clusters and series then proceed as below.

### Sampling

The map is read by trilinear interpolation between voxel centres over the voxels with a value. A zero or NaN voxel has none. A point carries $(\sum w_i v_i, \sum w_i)$ over those of its eight surrounding voxels that have a value and shows $\sum w_i v_i / \sum w_i$ where $\sum w_i \ge \tfrac{1}{2}$, as the parcel meshes below do. The edge of a masked or thresholded map therefore lies halfway between voxel centres with rounded corners, and its colours come from its own voxels. A map with a value everywhere reads as plain trilinear interpolation. A point beyond the outermost centres has no value. Where every voxel has a value this matches nilearn. Elsewhere nilearn gives no value next to a NaN and reads zeros as values.

On the cortex, each native vertex takes the mean of 10 samples evenly spaced from its pial to its white position, samples without a value excluded, as nilearn `vol_to_surf(…, inner_mesh=…)` does (Fig. 1a).

For the volume, the (sum, share) pair is resampled onto a 1 mm surface RAS grid with centres on whole millimetres. The cut faces, the deep structures and the linked magnetic resonance imaging (MRI) sections ([Linked MRI](linked-mri.md)) interpolate it again, sum and share alike, so the edge stays where the first reading put it (Fig. 1b).

The parcel meshes of an atlas add edge midpoints and triangle centres where a triangle's corners differ in label. Each parcel vertex carries $(\bar{v}, w)$: $\bar{v}$ is the mean over its native parents with a missing value counted as 0, and $w$ is the share of parents with a value. The fragment shows $\bar{v} / w$ where $w \ge \tfrac{1}{2}$. Parent order is rebuilt from the envelopes and ribbon labels, and every vertex is checked against its position to $10^{-6}$ m.

### Colour scale

With threshold $\tau \ge 0$ and top $m > \tau$, a value $v$ is drawn when $\lvert v\rvert > \tau$, with

$$\text{colour}(v) = \mathbf{c}_0 + \min\!\left(1, \frac{\lvert v\rvert - \tau}{m - \tau}\right)(\mathbf{c}_1 - \mathbf{c}_0),$$

where $(\mathbf{c}_0, \mathbf{c}_1)$ is red (1, 0, 0) to yellow (1, 1, 0) for $v > 0$ and blue (0, 0, 1) to cyan (0, 1, 1) for $v < 0$ (FSL Red-Yellow, Blue-Lightblue). The second scale runs from green (0, 0.6, 0) to (0, 1, 0) for $v > 0$ and from magenta (0.6, 0, 0.6) to (1, 0, 1) for $v < 0$. A statistical map has no default $\tau$. Its $m$ defaults to $\max\lvert v\rvert$ rounded up to three significant digits. A map whose finite values are all 0 or 1 is a mask, drawn at $\tau = 0.5$, $m = 1$. The statistic (z, t, F, r) is taken from the intent code, else an SPM `SPM{T_[df]}` description, else FSL or SPM output names (`zstat1`, `tstat1`, `zfstat1`, `fstat1`, `spmT_0001`, `spmF_0001`).

Every view mixes a map in linear light. With sRGB colour $\mathbf{c}$ and opacity $\alpha$ over sRGB $\mathbf{b}$, a pixel is $f\big((1-\alpha)\,f^{-1}(\mathbf{b}) + \alpha\,f^{-1}(\mathbf{c})\big)$, where $f$ is the sRGB transfer function, and a second map is mixed over the result in the same way. The Linked MRI mixes from its pixel's bytes and rounds once, and gives the bytes a cut face draws: at 0.8 in both maps ($\tau$ = 0.5, $m$ = 1), green at 50% over red–yellow is (188, 187, 0) in both (`sampling.test.ts`, `overlay.svelte.test.ts`). Mixing sRGB bytes, as matplotlib does, draws a see-through map darker: red–yellow at 0.8 and 50% over grey 128 is (205, 141, 92) in linear light and (192, 140, 64) in sRGB bytes, and the two differ by up to 73 levels at 25% over black. At full opacity the two rules agree.

### Against a function

While one function or term is painted in **Functions** and a map is drawn, the two are compared point by point. The function's areas take one colour (the comparison's first, blue), and the map is drawn as its positive values $v > \tau$ only: in a second colour (pink) off the painted areas and in a third (green) on them, at the map's opacity. Negative values are left out because the paint is evidence of activation. The surfaces compare each vertex's value, and the cut faces and Linked MRI the 1 mm grid, with the paint of the region the point lies in. The three colours are the comparison's, which stay apart under colour-blind vision.

The function's profile gives two shares of cortical surface: $A_\text{both}/A_\text{map}$, the share of the map's cortex above $\tau$ that lies in painted areas, and $A_\text{both}/A_\text{function}$, the share of the painted areas' cortex the map covers. Each native vertex takes a third of the area of each triangle it is a corner of, on the mid-thickness surface (the mean of pial and white). A vertex counts for the map where its depth-mean value exceeds $\tau$ (the value its parcel vertex draws), and for the function where its ribbon label is a painted cortical area of the shown atlas. The medial wall and deep structures are not counted. The shares describe overlap on this brain; they are not a statistical test.

### Two maps

Two maps can be drawn at once, each read from its own file in its own template, with its own threshold, top, opacity, colour scale, title, statistic and minimum cluster size. The map added second is drawn over the first, and either can be put on top. Where both pass their thresholds, the top map's colour is mixed over the other's at its opacity. A top map at full opacity hides the other there, and below full opacity the result is a colour in neither key. Elsewhere each map is drawn alone. The cortex, the deep surfaces, the cut faces and the Linked MRI stack the two in the same order, and the Linked MRI's readout gives both values.

A map read beside another takes the colour scale the other is not drawn in. Over 21 samples of each sign's ramp, every colour of the second scale lies at least 0.193 OKLab ΔE from every colour of the first in normal vision. Under simulated colour-vision deficiency at full severity, the green ramp meets red–yellow (closest ΔE 0.000 protan, 0.012 deutan) and the magenta ramp meets blue–cyan (0.000, 0.015); under tritan vision the closest pair is green against blue–cyan (0.036). Of 13 candidate ramps measured, none kept apart from both of the first scale's ramps under protan and deutan vision: greens and yellows meet red–yellow, and blues, purples and magentas meet blue–cyan.

Only one of the two maps can be a series; a second series is refused while the other map is one. Each map has its own cluster table. A function is compared with a map only while that map is drawn alone ([Against a function](#against-a-function)).

The cortex carries both maps' (sum, share) pairs in one `vec4` attribute per vertex, so the cortex program keeps 13 of the 16 vertex attributes WebGL 2 guarantees. Each map has its own `RG32F` volume. One held volume serves the series' interpolation, so a cut face samples at most 13 textures.

### Clusters

The table follows nilearn 0.12.1 two-sided `get_clusters_table` on the file's grid, so its coordinates are template millimetres (Fig. 1c). Voxels with $\lvert v\rvert > \tau$, compared in float32, are joined by face connectivity. Positive clusters come first, and each sign is numbered from 1 by its most extreme peak. Peaks are local maxima over 26 neighbours, a plateau counted once. A cluster lists at most three sub-peaks, each more than 8 mm from the last kept. A cluster's size is its voxels × the voxel volume, truncated to whole mm³.

A minimum cluster size $k$ (nilearn `cluster_threshold`, in the file's voxels) zeroes smaller clusters as `threshold_img(…, cluster_threshold=k, two_sided=True)` does, and the trimmed map is carried again so surface, cuts and table agree.

### Series

A series' range, mask test and default top are taken over every volume, so every volume is drawn at one threshold and one colour scale. Rescaling each volume would make a weak one look as strong as the peak. Its cortical reach is that of the voxels with a value in any volume. One volume is carried at a time, as a single map is, and the cluster table and minimum cluster size apply to it. A volume asked for while another is being carried is carried only if it is still the newest once that one is done.

Playing steps through the volumes in order and loops, at most 4 volumes a second, and each step waits until the volume before it is placed. No cluster table is computed while it plays. A newly placed volume is reached from the one drawn before by linear interpolation: the (sum, share) pairs of both, on the 1 mm grid and at each cortical vertex, are mixed before the quotient, threshold and colour. The interpolation lasts as long as the last step took, and at least 250 ms. A step on its own, 500 ms or more after the last, takes 250 ms. Only the frames in between are interpolated. A paused or chosen volume is drawn as carried, and under reduced motion each volume replaces the last at once. The Linked MRI shows the carried volumes only.

### Region course

For a selected region, the whole-millimetre surface RAS points inside its closed solid are found by the winding count along rows in x. The solid is a structure's mesh, or a cortical parcel's ribbon solid in the shown atlas. The rows are set 0.0013 and 0.0007 mm off the whole millimetre in y and z, so no row runs along a marching-cubes lattice edge. Each point is read through the inverse field as a cut face reads the 1 mm grid at that centre. A volume's mean is over the points with a value there, before the threshold, which is voxelwise and says nothing of a mean. A volume where no point has a value has no mean.

## Display

**Overlay**, under **Add** in the stage dock, is not offered on stages narrower than 480 px. It offers **Template**, **Title**, **Statistic**, **Threshold**, **Colours up to**, **Minimum cluster size, voxels**, **Opacity** (10–100%), **Cortex surface** and **Clusters and peaks** (Fig. 1c). **Template** is MNI152NLin2009cAsym, SPM12 (TPM), or **MNI, template not stated**, which is read as MNI152NLin2009cAsym. On the MNI template it is MNI152NLin2009cAsym or **MNI, template not stated** only. **Cortex surface** is pial, mid-thickness or white. While a cut is open the pial is drawn, whichever is chosen. The control is also in **Display**, where it applies without a map.

Once a map is open, the controls adjusted while looking come first: **Show on the brain**, then for a series **Volume** (a slider named by the volume's place and time) and **Play**/**Pause**, then **Threshold**, **Colours up to**, **Opacity** and **Colours** (red–yellow and blue–light blue, or green and magenta). **Template**, **Title**, **Statistic**, **Minimum cluster size, voxels** and **Cortex surface** fold under **Map settings**, whose closed line names the template, the statistic, the minimum cluster size and the surface.

**Add another map…** reads a second file, in the first map's template, and draws it on top. With two maps open, **Maps** names each by its title, in the order they were read, and chooses the one the controls below it set; it stays in view while a slider is dragged. Each map says which map it covers, or is covered by, where both pass their thresholds, and the one underneath offers **Draw on top**. Under the caveat, a note says the two colour scales differ in hue. **Remove** removes the chosen map.

A statistical map is drawn only once a threshold is given; a mask is drawn at once, at its default of 0.5. Values are compared with $\tau$ per fragment. The volume is an `RG32F` texture (sum, share) read with `texelFetch` and interpolated in the shader. Cut faces are unlit so their colours equal the key's; cortex and deep surfaces are lit. While a map is shown, a **Colour** other than Tissue or T1 MRI changes to Tissue and is restored afterwards, unless the reader has chosen another meanwhile. Against a painted function the map's key gives way to one key of three rows (function, map above $\tau$, both), and the profile says the two shares.

Choosing a peak places it as a published coordinate. The popover lists the first 20 peaks, and **Download CSV** writes every peak at full precision to a comma-separated values (CSV) file. **Save image (PNG)** adds the key and a caption line: title, the file's name when the title is not the file's, template, `|z| > τ, colours to m`, opacity below 100%, minimum cluster size ≥ 2 and a non-pial surface ([sharing and snapshots](sharing-and-snapshots.md)). For a series the key's title adds the volume's time (its place when the header gives no spacing) and the caption adds `volume k of n at t s`. With two maps drawn, each has its own key and caption line, the top map's first, and the top map's caption says which map it is drawn over.

A selected region's sheet adds **Map over time**: the course against time with the drawn volume marked, the count of the region's points with a value, and a table of values. The plot is one slider: a click, the arrows, Home and End choose the volume drawn. The map is not written into the link.

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| `nifti.test.ts` | 9 fixtures written by nibabel 5.4.2 read as nibabel reads them, and each refusal | passes |
| `sampling.test.ts`, `vol_to_surf` | 40 vertices on an oblique volume, against nilearn 0.12.1 | equal within $10^{-4}$ |
| `sampling.test.ts`, edges | A map's edge against zero or NaN voxels, read directly and through the 1 mm volume | passes |
| `inverse-field.test.ts`, solved nodes | The published field carries each solved node back within 0.002 mm | passes; 352,704 nodes (MNI152NLin2009cAsym), 392,346 (SPM12) |
| `inverse-field.test.ts`, brain points | 20,000 random points read through the inverse and forward fields | 95th percentile ≤ 0.1 mm, maximum < 1 mm |
| `inverse-field.test.ts`, `carry.test.ts`, template | The template's own space is read back and a map placed in it, with no field | passes |
| `sampling.test.ts`, coverage | A 2 mm map of ones over the whole template reaches > 99.5% of cortical vertices | 99.85% left, 99.98% right (MNI152NLin2009cAsym) |
| `sampling.test.ts`, blobs | Gaussian blobs of σ = 4 mm at (−42, 22, 6), (38, −22, 56), (−24, −4, −20) peak on the 1 mm grid within 0.9 mm of **Coordinate**'s landing | passes |
| `partition.test.ts` | Every parcel vertex of the five published atlases where the native pial and ribbon labels put it | passes |
| `clusters.test.ts` | 12 tables on 5 maps from nilearn 0.12.1 | equal; peak coordinates within $10^{-9}$ mm |
| `display.test.ts`, `key.test.ts`, `user-map.svelte.test.ts` | Threshold masking, saturating scales, three-digit default top, statistic detection, caption and key; table follows the drawn threshold | passes |
| `nifti.test.ts`, series | Volume order, spacing and size limits of a series | passes |
| `carry.test.ts`, series | Range, carried volume and reach of a series | passes |
| `course.test.ts` | The mean over a region of a map linear in template x; a point's value against the value the cut faces draw | within $10^{-4}$ and $10^{-5}$ |
| `region-points.test.ts` | A 10 mm sphere (64 × 48 segments) holds every whole millimetre within 9.95 mm of its centre and none beyond 10 mm; overlapping solids give each point once | passes |
| `overlap.test.ts`, `display.test.ts`, `overlay.svelte.test.ts`, `map-overlap.svelte.test.ts` | Vertex areas, overlap areas, the comparison's colours on a cut face, and the shares measured again after each change | passes |
| `user-map.test.ts`, `user-map.svelte.test.ts`, `MapCourseSection.svelte.test.ts` | Carrying, playing and blending of a series; the course plot | passes |
| `display.test.ts`, `user-map-worker.test.ts`, `user-map.test.ts`, `sampling.test.ts`, `overlay.svelte.test.ts`, `user-map.svelte.test.ts`, `OverlayPopover.svelte.test.ts`, `key.test.ts` | Two maps: the scales' separation, each slot's own file and half of the cortex's values, stacking order on cut faces and the Linked MRI, a series moving under the other map's change, adding, ordering, a second series refused, keys and captions | passes |
| `shader-programs.svelte.test.ts` | Every patched program links under WebGL; the cortex uses at most 13 vertex attributes | passes |

The NIfTI fixtures cover all eight stored types, both byte orders, scaling, sform over qform, a qform-only file with qfac −1 and nibabel's header fixes. For a series, the volumes are read in the file's order. The spacing is read from `xyzt_units` (s, ms), and there is none without a time unit or a positive spacing. Axes past the fourth and series over $64 \times 2^{20}$ values are refused.

In the edge tests a map against zero or NaN voxels has its edge halfway between centres, its colour from its own voxels and its corners rounded, and the 1 mm volume puts a straight edge in the same place. In the template tests the template's inverse reads a point back in template millimetres over its brain only, and a map in its own space lands where the scale puts it, with no field.

The cluster tables cover sub-peak distances, NaN holes, edge- and corner-only contacts, bridges equal to the threshold, plateaus, ties, oblique and anisotropic grids, and up to 73 clusters; two use `cluster_threshold`.

For a carried series the range is taken over every volume, the volume asked for is carried and the reach is taken over any volume. An empty first volume is shown, and a series is refused only when no volume reaches the brain. In `course.test.ts` a map linear in template x gives the mean of the points' template x, a point reads what the cut faces draw at that centre of the 1 mm grid, and points without a value are left out.

The comparison tests check vertex areas on a rectangle's corners and a unit cube's total of 6. The map, function and both areas are counted over cortical parcels only, for positive values above $\tau$. A cut face draws exactly the map's or both's colour, keeps the paint's hue beneath and greys off it. The shares are measured again per paint, extent and threshold, and a late answer for an earlier one is dropped.

In the series tests a volume is carried once per volume and extent, and volumes passed over while one is carried are not carried. The volume is kept across templates. Playing steps, loops and lists no clusters until paused. A new volume holds the last one drawn and blends from it on the grid and the cortex, but not for a new extent of the same volume or under reduced motion. The course plot names each mean and draws the volume chosen.

A synthetic 12-volume series in MNI152NLin2009cAsym (2 mm, repetition time (TR) 2 s) held canonical-shaped responses of σ = 6 mm at (−8, −92, 2) peaking at 6 s and at (−38, −24, 58) peaking at 10 s. It gave a left calcarine sulcus course peaking at 4–6 s and drew the precentral response at 10 s. In headless Chrome on an Apple M5 a volume was carried in 276 ms (median, n = 17), so playing reached 3.4 volumes a second. Dragging the slider through 12 volumes carried 3 of them and drew the last 0.43 s after the drag ended.

A synthetic z-map in MNI152 held blobs of σ = 6 mm: z 8 at (−50, 18, 8), z 7 at (40, −22, 58) and z −6 at (−44, −60, 24). Against Language at $\tau = 3$ it drew both colours on the left inferior frontal gyrus, the map's colour on the right precentral gyrus, and nothing at the negative blob, on the surface, a coronal cut and the Linked MRI. The profile gave 65% of its cortex above 3 in Language's areas, covering 1% of them.

The node counts and the coverage were measured on the published CDMD fields with the functions those tests call. The tests assert the criteria in the table and, for the solved nodes, that they fill more than $10^{6}$ mm³ of this brain. SPM12 coverage is 99.98% left and 99.996% right.

## Limitations

The overlay is a template map carried by a registration of the template to this brain. It shows where the map falls on these folds and says nothing about this person's activity or anatomy.

Only template space is supported. A native-space or Talairach map lands in the wrong place, and no NIfTI header states which MNI template a map is in. On the MNI template only MNI152NLin2009cAsym is placed correctly; a map in FSL's MNI152 opened as an unstated MNI map is read as MNI152NLin2009cAsym.

Interpolation is trilinear, so a label atlas with more than two values is blended between labels. Deep surfaces are sampled where they lie, which mixes a structure with its surroundings; cut faces show the volume itself.

A series holds at most $64 \times 2^{20}$ values, about 60 volumes at 2 mm. A preprocessed blood-oxygen-level-dependent (BOLD) run is usually larger, and is in scanner units rather than activation: it needs a model first. Playing is bounded by carrying a volume, about 3–4 volumes a second, and clusters are listed only while paused.

The frames between two volumes are linear interpolations, not data. Between volumes that are not correlated (single-trial estimates, for example), values partly cancel at the midpoint, so less of the map passes the threshold there. Between two consecutive single-trial beta maps, the stage showed 6–8% as many coloured pixels at the midpoint as at either end.

The region course is the mean of the map's values in the region, not a statistic of the region. A structure's points come from its mesh at whole millimetres, so a solid thinner than 1 mm may have none. An all-zero volume has no value, not a mean of 0.

With two maps, the top one covers the other where both pass their thresholds, so their overlap is hidden unless the top one is made see-through, and then it is drawn in mixed colours that neither key gives. The two colour scales differ in hue, which protan and deutan vision lose, and tritan vision brings the green close to blue–cyan: for such readers the maps are told apart by their keys and by switching one off, not by colour. Only one map can be a series.

Against a function, overlap is a picture of coincidence on this brain: the function's z grows with study count, its areas are whole atlas areas, and the map's place depends on the template registration. The shares count cortex only.

Linked MRI images of a see-through map saved before 26 November 2026 mixed sRGB bytes, so the map is darker in them than on the 3D views; at full opacity they are unchanged.

The map is not carried in a link; the saved image keeps it.

Minimum cluster size is in the file's voxels, so the same $k$ is more tissue in a 2 mm map than in a 1 mm map. Cluster volumes come from the column lengths of the affine that places the file (the sform, or the qform when the file has no sform), not from pixdim.

A refusal is worded from its reason's code in the viewer's language, English or French. The English reason goes to the browser's console, and a failure without a coded reason is reported as unexpected, with its detail in the console only.

## Code availability

Code
: [`web/src/lib/core/user-map/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/lib/core/user-map) (`nifti.ts`, `inverse-field.ts`, `sampling.ts`, `partition.ts`, `carry.ts`, `course.ts`, `display.ts`, `clusters.ts`, `overlap.ts`, `cluster-csv.ts`, `map-file-error.ts`), [`web/src/lib/engine/user-map/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/lib/engine/user-map), [`web/src/lib/state/user-map.svelte.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/state/user-map.svelte.ts), [`web/src/lib/state/map-overlap.svelte.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/state/map-overlap.svelte.ts), [`web/src/features/user-map/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/features/user-map), [`web/src/features/inspector/MapCourseSection.svelte`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/features/inspector/MapCourseSection.svelte)

Configuration
: None. The constants are `DEPTH_SAMPLES` (10) and `VOLUME_SPACING_MM` (1) in `sampling.ts`, `MAX_VOXELS`, `MAX_VALUES` and `MAX_FILE_BYTES` in `nifti.ts`, and `MAP_SLOTS` (2), `VOLUMES_PER_SECOND` (4) and the colour scales in `display.ts`.

Tests
: `web/src/lib/core/user-map/*.test.ts`, `web/src/lib/engine/user-map/*.test.ts`, `web/src/lib/state/user-map.svelte.test.ts`, `web/src/lib/state/map-overlap.svelte.test.ts`, `web/src/features/user-map/*.test.ts`, `web/src/features/inspector/MapCourseSection.svelte.test.ts`. The fixtures come from `fixtures/make-fixtures.py` (nibabel), `make-vol-to-surf.py` and `make-clusters.py` (nilearn 0.12.1).

```bash
cd web && npx vitest run --project unit src/lib/core/user-map src/features/user-map src/lib/engine/slices src/lib/engine/user-map
cd web && npx vitest run --project browser src/lib/state/user-map.svelte.test.ts src/features/user-map src/features/inspector/MapCourseSection.svelte.test.ts
uv run --no-project --with nilearn==0.12.1 python -I web/src/lib/core/user-map/fixtures/make-clusters.py
```

The figure's map is not part of the repository. [`scripts/figure_plots.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/figure_plots.py) writes it when the figure is rendered, with nibabel 5.4.2 and SciPy 1.18.1: the three blobs above summed with `scipy.ndimage.gaussian_filter` noise ($\sigma$ = 2 voxels, `mode="wrap"`, `numpy.random.default_rng(0)`) scaled to s.d. 0.5, saved as `zstat1.nii.gz` with sform and qform code 4.
