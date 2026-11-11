# Tracts

The **Tracts** tab draws 30 white-matter bundles reconstructed from the diffusion scan of MGH CDMD sub_013, the same subject whose T1 the anatomy is reconstructed from, so streamlines, MRI and surfaces share one scanner frame without registration. Seventeen bundles come from DIPY particle-filtering tractography segmented by RecoBundles; thirteen (SLF I–III and seven callosal segments) from TractSeg. Every streamline is trimmed back into the brain at its ends and resampled to 0.5 mm. Streamlines are reconstructions: their counts are not axon counts and their lengths do not measure connection strength.

```{figure} figures/tracts-1.webp
:alt: Four panels of coloured streamlines inside a translucent grey brain on a dark ground. Top left, side view with a green arched bundle over the hemisphere and a blue column descending into the brainstem. Top right, front view of the same two bundles, the blue column on the image's left and a fan of red and green streamlines on the right. Bottom left, top view with red streamlines crossing the midline and fanning blue and green into both hemispheres. Bottom right, side view of three stacked green arched bundles over the hemisphere.
:name: fig-tracts-1

**Bundles of one subject's own diffusion scan, drawn in its see-through reconstructed cortex.** **a**, **b**, The default selection, left arcuate fasciculus (RecoBundles, 3,639 streamlines, mean length 114.5 mm, range 58.5–179.3 mm) and right corticospinal tract (964 streamlines, mean 131.3 mm), from the left (**a**) and the front (**b**). **c**, TractSeg's callosal segments 1–7 (2,000 streamlines each), from above, anterior up. **d**, TractSeg's left SLF I, II and III, from the left. Colour is local direction: red left–right, green anterior–posterior, blue superior–inferior. CDMD sub_013; cortex opacity 0.16; minimum length 1 mm. Scale bars, 20 mm.
```

## Data

| Input | Content and pin |
| :--- | :--- |
| CDMD sub_013 (Tian et al. 2022; figshare collection 5315474, CC0 1.0) | T1 1 mm, 176 × 220 × 220, defaced, sha256 `16e91371…730b`, the reconstruction's own input. Diffusion 2 × 2.04 × 2.04 mm, 850 volumes, 16 non-zero shells at b = 50–17,800 s/mm², diffusion times Δ = 19 ms (b ≤ 6,000) and 49 ms; released brain mask, DWI-space `aparc+aseg` and bbregister matrix `sub_013_dwi2t1w.mat`. `tractseg_cdmd.py` pins the T1, DWI, gradients, Δ and mask by sha256 |
| FreeSurfer reconstruction of the same T1 (`data/cdmd/mri/`) | `aseg.mgz`, `ribbon.mgz` (sha256 recorded in `provenance.json`), `brain.mgz`, `orig.mgz` |
| DIPY 1.12.1 (Garyfallidis et al. 2014) and its HCP842 80-bundle atlas (Yeh et al. 2018; MNI ICBM 2009a, figshare 7375883, CC BY 4.0) | RecoBundles (Garyfallidis et al. 2018) |
| TractSeg 2.10 (Wasserthal et al. 2018; Apache-2.0) | Six pretrained weight files (Zenodo 3518348, 3518331, 3239216–3239222; CC BY 4.0) and `MNI_FA_template.nii.gz` (`3a047037…24bd`), each pinned by sha256 |
| MRtrix3 3.0.8 (Tournier et al. 2019; MPL-2.0) | macOS release, sha256 `91fb80ff…0c39`; `mrinfo -version` must match |

The 30 bundles are catalogued in `data/diffusion-cdmd.yaml` (`id`, file, English and French name, `class` association, projection or commissural; `segment` for the callosal segments; `initial: true` on the left arcuate and right corticospinal tract). Published under `public/diffusion/cdmd-sub-013/` (205 MB): 30 gzip TRK files (175 MB; 90,109 streamlines, 16.8 million points), the T1 copied byte for byte, `fa.nii.gz`, `brain-outline.glb`, `surface-space.json` and `provenance.json`. Citations: [references](../reference/references.md#reference-datasets-and-tools).

## Method

### Frames and tissue (`scripts/cdmd_pilot.py`)
The pilot follows DIPY's `reconst_mcsd`, `tracking_pft` and `bundle_extraction` examples in stages that each write under `<work>/derived/`. **Frames**: the bbregister matrix is read in FSL's convention against three references (identity, the T1, `orig.mgz`); sampling `aseg` at each DWI voxel through each candidate and comparing with the released DWI-space `aparc+aseg`, the T1 reference agrees at 99.997% (identity 76.1%, `orig.mgz` 3.1%) and is kept as `dwi_to_t1_world`. **Tissue**: white, grey and CSF partial volumes on the DWI grid from `aseg` classes sampled at 4³ points per DWI voxel; ventral DC (cerebral peduncle) counts as white matter and deep nuclei as grey matter, where CMC stopping lets streamlines end.

### Fibre orientations and tracking
1. **Shells.** One diffusion time so all shells share one response: the Δ = 19 ms volumes and b = 0, 434 volumes, b = 0–6,000 s/mm².
2. **Response.** `mask_for_response_msmt` on shells b < 1,200 (ROI radius 10; FA thresholds white 0.7, grey 0.3, CSF 0.15; MD thresholds grey 0.001, CSF 0.0032), each mask restricted to voxels whose dominant partial volume (≥ 0.5) is that tissue (416, 670 and 18 voxels).
3. **Fit.** MSMT-CSD (`MultiShellDeconvModel`, spherical-harmonic order 8) in the brain mask (168,573 voxels).
4. **Track.** Seeds at density 2 per axis (8 per voxel) in the 49,851 voxels with white-matter fraction ≥ 0.5: 398,808 seeds. `ParticleFilteringTracking` with a probabilistic direction getter on the fODFs (maximum angle 20°, `pmf_threshold` 0.1), CMC stopping from the partial volumes, step 0.2 mm, length 2–500 mm, back-tracking 2 mm, front-tracking 1 mm, 15 particles, at most 20 trials, random seed 1. The direction getter and stopping maps are built once before workers fork. 363,819 streamlines in 37 s (Rorqual, 64 CPUs), moved to T1 world coordinates.
5. **Recognise.** `whole_brain_slr` (affine, progressive, seed 1984) registers the HCP842 atlas to the tractogram. RecoBundles (`model_clust_thr` 0.1, MDF distances, SLR on) recognises AF, CST, C (cingulum), UF, IFOF, ILF, MdLF and SLF on each side, and the corpus callosum as the union of CC, CCMid, CC_ForcepsMajor and CC_ForcepsMinor (26,208, 10,771, 1,490 and 4,133 streamlines; 31,605 distinct). Every recognition restarts from the post-construction state of `default_rng(2001)`; with one shared stream the left and right SLF counts had been 862 and 224.

Reduction/pruning thresholds were chosen per bundle on the `validate` stage's five RNG seeds. Association bundles use 20/10: their left/right ratios follow the whole tractogram's (median gap 0.12 against 0.49 at 15/7 with refinement), their count varies less across seeds (coefficient of variation 5.6% against 8.9%), and their white-matter fractions stay within 0.07. The corticospinal tract keeps 15/7 followed by `refine(15, 6)`: it is balanced there (left/right 0.79 against the tractogram's 0.82), and 20/10 lowers its pericentral-to-brainstem share from 0.59 and 0.61 to 0.40 and 0.41. The whole callosum was not validated and keeps 15/7 with refinement.

### TractSeg bundles and FA (`scripts/tractseg_cdmd.py`)
TractSeg's `csd_msmt` recipe ("Use existing peaks") with MRtrix3, refusing any other version or checksum:

1. **Input.** b = 0 and the Δ = 19 ms shells with 700 ≤ b ≤ 3,600 (b = 800, 1,500, 2,400, 3,450): 242 volumes, nearest TractSeg's HCP training range (b = 1,000–3,000).
2. **Peaks.** `dwi2response dhollander`, `dwi2fod msmt_csd`, `sh2peaks`, in the diffusion brain mask.
3. **MNI alignment.** Tensor FA (`dwiextract -shells 0,800,1500`, `dwi2tensor`, `tensor2metric -fa`) is registered rigidly (`mrregister -type rigid`) to TractSeg's MNI FA template, replacing its FSL `flirt` preprocessing; FODs follow with `mrtransform -reorient_fod yes`. `check_alignment` requires ≥ 99% of template voxels with FA > 0.6 inside the scan and their mean scan FA ≥ 0.45: 0.505 as used (0.307 inverted, 0.366 untransformed).
4. **Segment and track.** `tract_segmentation`, `endings_segmentation` and `TOM`, then probabilistic TOM tracking of 2,000 streamlines per bundle for SLF I–III on each side and CC_1–CC_7 (NumPy seed 13; stochastic).
5. **Back to the T1.** Streamlines go through the inverse rigid transform and `dwi_to_t1_world`; FA is resampled trilinearly onto the T1 grid (0 outside the scan, clipped to 0–1). Mean FA is 0.62 in aseg's corpus callosum, 0.41 in cerebral white matter and 0.16 in the lateral ventricles.

HCP842 has one SLF per side and divides the callosum differently, so TractSeg's subdivisions are published beside the RecoBundles SLF and whole callosum.

### Trimming and resampling (`scripts/prepare_diffusion_cdmd.py`)
For each bundle the source TRK must match the T1 (dimensions; `voxel_to_rasmm` at absolute tolerance $10^{-5}$), with finite coordinates and no empty or zero-length streamline. Then:

1. **Trim.** The brain volume is $B = \{\text{ribbon} > 0\} \cup \{\text{aseg} \neq 0 \text{ and } \text{aseg} \notin \{3, 42, 24\}\}$ (volumetric cortex, which aseg extends past the pial surface, and extracerebral CSF excluded), sampled at the nearest voxel. Each streamline keeps the points from its first to its last point in $B$; interior excursions are kept, and a streamline with fewer than two points in $B$ is an error. CMC stopping acts on 2 mm tissue maps, so RecoBundles ends overshoot the pial surface.
2. **Resample.** Points are placed at equal arc length, $n = \max\!\big(2, \operatorname{round}(L/0.5) + 1\big)$ for polyline length $L$ (`resample_step_mm` = 0.5 mm), by linear interpolation; both ends are kept.
3. **Measure.** For every 25th streamline, the largest distance from a trimmed point to the resampled polyline; the step distribution; the length change. The streamline count must not change.
4. **Write.** The original header, gzip level 6 with `mtime` 0 (reproducible bytes), and `provenance.json` records source, resampled and published sha256, point counts, trimming and resampling records, three RAS samples and length summaries at minimum lengths 1, 100 and 200 mm.

| Bundle | Method | Streamlines | Trimmed | Largest trim (mm) | Largest deviation (mm) |
| :--- | :--- | ---: | ---: | ---: | ---: |
| Arcuate L / R | RecoBundles | 3,639 / 2,191 | 947 / 612 | 19.0 / 9.8 | 0.053 / 0.052 |
| Corticospinal L / R | RecoBundles | 731 / 964 | 305 / 398 | 11.6 / 19.0 | 0.054 / 0.052 |
| Cingulum L / R | RecoBundles | 2,167 / 1,744 | 603 / 451 | 31.6 / 19.2 | 0.054 / 0.055 |
| Uncinate L / R | RecoBundles | 911 / 895 | 486 / 377 | 20.8 / 13.2 | 0.052 / 0.052 |
| IFOF L / R | RecoBundles | 440 / 220 | 28 / 17 | 9.8 / 10.4 | 0.053 / 0.051 |
| ILF L / R | RecoBundles | 3,745 / 1,704 | 1,299 / 520 | 24.8 / 14.2 | 0.056 / 0.054 |
| MdLF L / R | RecoBundles | 3,178 / 2,212 | 1,522 / 1,154 | 24.8 / 16.6 | 0.052 / 0.051 |
| SLF L / R | RecoBundles | 4,285 / 3,478 | 2,148 / 1,472 | 17.4 / 16.2 | 0.056 / 0.053 |
| Corpus callosum | RecoBundles | 31,605 | 8,525 | 15.6 | 0.056 |
| SLF I, II, III L / R | TractSeg | 2,000 each | 7 / 8, 0 / 0, 0 / 0 | 7.2 / 4.6, 0, 0 | 0.070 to 0.102 |
| Callosal segments 1–7 | TractSeg | 2,000 each | 0, 12, 0, 126, 77, 34, 29 | 0, 5.4, 0, 8.6, 9.8, 10.9, 9.3 | 0.050 to 0.236 |

RecoBundles bundles lost an end run on 6% (left IFOF) to 53% (left uncinate) of their streamlines; TractSeg's on at most 6% (callosal segment 4). The left arcuate, for example, lost 14,155 of 2,121,029 points; resampled, it has 844,916 points at a median step of 0.495 mm (largest 0.502 mm), and its polylines are 0.96% shorter at the median (at most 1.08%), because 0.5 mm chords cut across the tracker's 0.2 mm zig-zag. Across all bundles the length changes by at most 2.16 mm, or 1.21% of a streamline. The T1 is copied after checking its sha256 against the reconstruction's pinned input; the FA map must lie on the T1 grid (shape and affine at $10^{-5}$).

### Scanner to surface (`scripts/prepare_diffusion_space.py`)
Streamlines stay in scanner RAS; the surfaces are in FreeSurfer surface RAS. The mapping is $M = \text{vox2ras-tkr}(\text{orig}) \cdot A_\text{orig}^{-1}$, for a conformed volume a translation by −`c_ras` ((−2.54, −2.62, +14.07) mm on CDMD). The script first requires the tract T1's sha256 to equal the reconstruction's pinned input, the FreeSurfer build stamp to match, and `recon-all`'s import to be exact (voxel values exact, affine error ≤ $10^{-5}$ mm). `surface-space.json` stores $M$ and three anchor voxels (origin, centre, far corner) in both frames. Nothing is registered or resampled.

### Brain outline (`scripts/prepare_diffusion_outline.py`)
For an anatomy without its own tracts, CDMD's tracts are shown inside an outline of `brain.mgz`: the largest connected component at intensity ≥ 1, Lewiner marching cubes at step 2 voxels, mapped from RAS millimetres to the viewer's (R, S, −A) metres without registration (25,461 vertices, 50,526 triangles). A mesh with non-positive volume (inward faces) is refused.

## Display
Bundles are listed by class (association 20, projection 2, commissural 8) with **L**/**R** toggles, **Whole** for the RecoBundles callosum and **1**–**7** for the TractSeg segments; a TRK is downloaded and decoded once (NiiVue `readTRK`), when first selected, and shared by the 3D view and the MRI navigator. `createNativeTractViewer` draws each bundle as three.js `LineSegments` on the decoded points in scanner RAS, under `RAS_MM_TO_WORLD` (millimetres to R, S, −A metres) and the group matrix from `surface-space.json`; `createReferenceTransform` refuses a bottom row other than 0 0 0 1 and any scale or reflection. Each point $i$ of a streamline is coloured by the unit central difference

$$\mathbf{c}_i = \frac{\lvert \mathbf{p}_{i+1} - \mathbf{p}_{i-1} \rvert}{\lVert \mathbf{p}_{i+1} - \mathbf{p}_{i-1} \rVert}$$

(neighbours clamped at the ends) as (R, G, B) = (|x|, |y|, |z|), stored as linear 16-bit values so the sRGB output shows the 8-bit display levels. Polyline lengths are float64 sums of segment lengths. **Minimum length (mm)** (1–250 mm, step 1) rewrites the line index to streamlines at least that long; **Drawn bundles** lists each shown bundle's count, mean and range. While the camera moves every third point is drawn (`MOTION_STRIDE` = 3). The cortex is see-through at `overlay_cortex_opacity` 0.16; **Show tracts with anatomy** keeps tracts on the Anatomy tab, only for their own anatomy. A Circuits landmark draws its whole bundle alone, faint (opacity 0.3, `GreaterDepth`) where a surface hides it; a [lesion](lesion-report.md#method) draws only the streamlines with a point inside its sphere. **Export lengths CSV** writes `planum-streamline-lengths.csv` (`bundle,total_streamlines,enabled_streamlines,minimum_length_mm,mean_length_mm,min_length_mm,max_length_mm`; English names; a leading `=`, `+`, `-` or `@` is prefixed with an apostrophe). **MRI with tracts** (<kbd>M</kbd>) opens NiiVue's multiplanar view of the T1 (grey, 0–525) and FA (viridis, 0–1, hidden until chosen) with the tracts as fibre meshes; voxel readouts are zero-based source voxels rebuilt from the scanner point. URL state: `tab=diffusion`, `tracts=<id,…>`.

## Validation
| Test | Criterion | Result |
| :--- | :--- | :--- |
| `resample` on a 400-point semicircle | Ends kept; median step within 0.01 mm of 0.5 mm; steps equal within $10^{-4}$ mm; deviation < 0.01 mm | passes |
| A line shorter than the step | Keeps its two ends | passes |
| `trim` | Drops only the end runs outside the brain; interior crossing kept; < 2 points inside refused | passes |
| Scanner-to-surface transform (`test_transforms.py`) | Translation equals −`c_ras` (atol $10^{-6}$); recorded matrix and anchors equal the recomputed ones (≤ $10^{-9}$ mm); a 0.001 mm anchor shift refused | 0 mm difference |
| Published maps (DIFF-13) | FA original bytes; T1 int16 display derivative (grid and affine equal to the source, every voxel within half a step) | passes |
| Published bundles (DIFF-14, DIFF-15, DIFF-06) | Decode in NiBabel's RAS+ space with matching streamline and point counts, RAS samples, float64 lengths at 1, 100 and 200 mm, and bounds | passes, 30 bundles |
| Catalogue | 30 distinct bundles | passes |
| Outline (DIFF-16) | Belongs to the tract reference; processing provenance present | passes |
| Lengths (DIFF-01 to DIFF-03) | Sum of segments on 25 seeded tracts; empty, partial-triple or broken-offset files refused; a streamline exactly at the minimum shown | passes |
| Rigid frames (DIFF-10, DIFF-11, DIFF-18) | Seeded rotations and translations keep distances; scaled, mirrored or non-affine frames refused; scanner and surface points inverse over 100 seeded frames | passes |
| MRI voxels (DIFF-28, DIFF-29) | Voxel and scanner point inverse on an oblique grid for 500 seeded voxels; half-voxel rounds up | passes |
| Direction colour | Displays as \|R\|, \|A\|, \|S\| after sRGB encoding; a point with no direction is black | passes |
| One decode per tract | Shared by 3D lines and MRI navigator; a failed download is retried | passes |

The pilot's go/no-go measures (`check` stage, `derived/check.json`), computed identically for CDMD and for the SNAIL tracts Planum first published: no cortex lies outside the diffusion grid and 0.0003% outside its brain mask; the smallest of the 17 bundles has 220 streamlines; the median fraction of points in white matter is 0.933 against SNAIL's 0.847. The corticospinal share of streamlines joining pericentral cortex to the brainstem (ends within 3 mm) is 0.63 left and 0.52 right, against SNAIL's 0.89 and 0.88.

### Tract profiles

Pressing a tract's name in the Tracts tab opens its profile: the streamline count of each side or segment in this tracking run, their lengths once drawn, and the cortical regions its streamlines end in. `brain_model/layers/tract_ends.py` (`config/tract-ends.yaml`) takes the first and last point of every streamline, in the scanner frame the tracts and `aparc.a2009s+aseg.mgz` share, and counts per Destrieux region of this brain the share of ends with a labelled voxel within 3 mm; an end near two regions counts for both, and regions under 5% are left out. On the committed files the left corticospinal tract's ends lie most on the precentral gyrus (18%), then the superior frontal and paracentral gyri; the left arcuate's on the middle temporal (27%) and middle frontal (19%) gyri; the left uncinate's on the temporal pole (34%). The output, `public/diffusion/cdmd-sub-013/tract-ends.json`, is recomputed and compared by `tests/test_tract_ends.py`.

## Limitations
- One individual, one diffusion scan at 2 mm; bundles are reconstructions, not observed axons.
- RecoBundles bundles follow HCP842's definitions, the registration and the thresholds; left and right counts differ (arcuate 3,639 and 2,191; IFOF 440 and 220) although the whole tractogram is near-symmetric (76,652 left and 71,484 right intrahemispheric streamlines).
- TractSeg's SLF I–III and callosal segments define bundles differently from RecoBundles' SLF and callosum and overlap them only partly.
- The corticospinal streamlines end near the caudal medulla, above the decussation.
- TractSeg's TOM tracking is stochastic; a rerun gives other streamlines.
- Trimming removes whole end runs outside the brain volume, up to 31.6 mm (left cingulum); interior sulcal crossings remain.
- On another anatomy CDMD's tracts are shown in CDMD's outline and are not placed on that anatomy.

## Code availability

| | |
| :--- | :--- |
| Code | [`scripts/cdmd_pilot.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/cdmd_pilot.py), [`scripts/tractseg_cdmd.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/tractseg_cdmd.py), [`scripts/prepare_diffusion_cdmd.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/prepare_diffusion_cdmd.py), [`scripts/prepare_diffusion_space.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/prepare_diffusion_space.py), [`scripts/prepare_diffusion_outline.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/prepare_diffusion_outline.py), [`brain_model/validate_transforms.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/validate_transforms.py), `web/src/lib/engine/diffusion/`, `web/src/features/tracts/`, `web/src/lib/core/tracts.ts` |
| Configuration | [`data/diffusion-cdmd.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/diffusion-cdmd.yaml); `tract_catalogs` in [`config/model.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/model.yaml); [`provenance.json`](https://github.com/JoshuaDuq/planumatlas/blob/main/public/diffusion/cdmd-sub-013/provenance.json) |
| Tests | [`tests/test_prepare_diffusion_cdmd.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_prepare_diffusion_cdmd.py), `tests/test_transforms.py`, `web/src/lib/engine/diffusion/*.test.ts` |

```bash
# DIPY stages: frames, tissue, response, fit, track, bundles (track and bundles ran on Rorqual)
uv run --with dipy==1.12.1 --with cvxpy --with joblib python scripts/cdmd_pilot.py frames
uv run python scripts/tractseg_cdmd.py /path/to/cdmd-pilot
uv run python scripts/prepare_diffusion_cdmd.py /path/to/cdmd-pilot
uv run python scripts/prepare_diffusion_space.py --anatomy cdmd
uv run python scripts/prepare_diffusion_outline.py --anatomy cdmd
uv run pytest tests/test_prepare_diffusion_cdmd.py tests/test_transforms.py
npm test --prefix web -- diffusion
```

Figure state (Fig. 1a): https://planumatlas.com/#anatomy=cdmd&tab=diffusion&view=left; (Fig. 1b): `view=anterior`; (Fig. 1c): https://planumatlas.com/#anatomy=cdmd&tab=diffusion&tracts=callosum-1,callosum-2,callosum-3,callosum-4,callosum-5,callosum-6,callosum-7&view=superior; (Fig. 1d): https://planumatlas.com/#anatomy=cdmd&tab=diffusion&tracts=slf1-left,slf2-left,slf3-left&view=left
