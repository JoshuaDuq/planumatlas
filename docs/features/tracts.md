# Tracts

The **Tracts** tab draws 30 white-matter bundles reconstructed from the diffusion magnetic resonance imaging (MRI) scan of sub_013 of the MGH Connectome Diffusion Microstructure Dataset (CDMD) (Fig. 1). The anatomy is reconstructed from the T1-weighted image (T1) of the same subject, so streamlines, MRI and surfaces share one scanner frame without registration. Seventeen bundles come from DIPY particle-filtering tractography segmented by RecoBundles and thirteen from TractSeg (the superior longitudinal fasciculus (SLF) I–III on each side and seven callosal segments); every streamline was trimmed back into the brain at its ends and resampled to 0.5 mm steps. On the [MNI template](mni-template.md), which has no diffusion scan, the tab draws 21 bundles of the HCP1065 population-averaged atlas instead (Fig. 2). Streamlines are reconstructions: their counts are not axon counts and their lengths do not measure connection strength.

```{figure} figures/tracts-1-light.webp
:alt: Four panels of coloured streamlines inside a translucent grey brain on black. a, side view with a green arched bundle over the hemisphere and a blue column descending into the brainstem. b, front view of the same two bundles, the blue column on the image's left and a fan of red and green streamlines on the right. c, top view with red streamlines crossing the midline and fanning blue and green into both hemispheres. d, side view of three stacked green arched bundles over the hemisphere.
:name: fig-tracts-1

**Bundles of one subject's own diffusion scan are drawn in its see-through reconstructed cortex.** **a**, **b**, The default selection, the left arcuate fasciculus (RecoBundles, 3,639 streamlines, mean length 114.5 mm, range 58.5–179.3 mm) and the right corticospinal tract (964 streamlines, mean 131.3 mm), [from the left](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&tab=diffusion&view=left&opacity=0.16) (**a**) and [from the front](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&tab=diffusion&view=anterior&opacity=0.16) (**b**). **c**, [TractSeg's callosal segments 1–7](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&tab=diffusion&view=superior&opacity=0.16&tracts=callosum-1,callosum-2,callosum-3,callosum-4,callosum-5,callosum-6,callosum-7) (2,000 streamlines each), from above, anterior up. **d**, [TractSeg's left SLF I, II and III](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&tab=diffusion&view=left&opacity=0.16&tracts=slf1-left,slf2-left,slf3-left), from the left. Colour is local direction (red left–right, green anterior–posterior, blue superior–inferior). CDMD `sub_013`; cortex opacity 0.16; minimum length 1 mm. All panels share one scale. Scale bars apply at the depth of the camera's target.
```

## Data

| Input | Content | Version or pin | Licence |
| :--- | :--- | :--- | :--- |
| CDMD sub_013 (Tian et al. 2022) | T1 at 1 mm, 176 × 220 × 220, defaced, the reconstruction's own input. Diffusion-weighted imaging (DWI) at 2 × 2.04 × 2.04 mm: 850 volumes, 16 non-zero shells at b = 50–17,800 s/mm², diffusion times Δ = 19 ms (b ≤ 6,000 s/mm²) and 49 ms. Released brain mask, DWI-space `aparc+aseg` and bbregister matrix `sub_013_dwi2t1w.mat` | figshare collection 5315474; T1 sha256 `16e91371…730b`; `tractseg_cdmd.py` pins the T1, DWI, gradients, Δ and mask by sha256 | CC0 1.0 |
| FreeSurfer reconstruction of the same T1 (`data/cdmd/mri/`) | `aseg.mgz`, `ribbon.mgz`, `brain.mgz`, `orig.mgz` | sha256 of `aseg.mgz` and `ribbon.mgz` recorded in `provenance.json` | |
| DIPY (Garyfallidis et al. 2014), RecoBundles (Garyfallidis et al. 2018) and DIPY's HCP842 80-bundle atlas (Yeh et al. 2018) | Fitting, tracking and bundle recognition; the atlas is in MNI ICBM 2009a space | DIPY 1.12.1; atlas figshare 7375883 | Atlas CC BY 4.0 |
| TractSeg (Wasserthal et al. 2018) | Six pretrained weight files and `MNI_FA_template.nii.gz` | TractSeg 2.10; weights Zenodo 3518348, 3518331, 3239216–3239222; template sha256 `3a047037…24bd`; each file pinned by sha256 | Apache-2.0; weights CC BY 4.0 |
| MRtrix3 (Tournier et al. 2019) | macOS release | 3.0.8; sha256 `91fb80ff…0c39`; `mrinfo -version` must match | MPL-2.0 |
| HCP1065 population-averaged tract atlas (Yeh 2022) | Streamlines of 1,065 Human Connectome Project (HCP) young adults in ICBM 2009a millimetres, the source of the template's 21 bundles | Archive pinned by sha256 in `data/diffusion-mni152.yaml` | CC BY-SA 4.0 |

The 30 bundles are catalogued in `data/diffusion-cdmd.yaml`. Each entry has an `id`, a file, an English and a French name and a `class` (association, projection or commissural). The callosal segments also have a `segment`, and `initial: true` marks the default selection, the left arcuate fasciculus and the right corticospinal tract (Fig. 1a,b). The files are published under `public/diffusion/cdmd-sub-013/` (195 MB): 30 gzip-compressed TrackVis streamline (TRK) files (175 MB; 90,109 streamlines, 16.8 million points), the T1 as an int16 display derivative (`sub_013_t1w.nii.gz`), `fa.nii.gz`, `brain-outline.glb` and `.json`, `surface-space.json`, `tract-ends.json` and `provenance.json`.

The template's 21 bundles are catalogued in `data/diffusion-mni152.yaml` and published under `public/diffusion/mni152-hcp1065/`: 21 gzip TRK files (139 MB; 63,111 streamlines, 13.8 million points), `brain-outline.glb` and `.json`, `surface-space.json` and `provenance.json`.

Citations are given in the [references](../reference/references.md#reference-datasets-and-tools).

## Method

### Frames and tissue (`scripts/cdmd_pilot.py`)

The pilot followed the `reconst_mcsd`, `tracking_pft` and `bundle_extraction` examples of DIPY 1.12.1, in stages that each write under `<work>/derived/`.

The `frames` stage chose the transform from the DWI grid to the T1. Three candidates were compared: the identity, and the released bbregister matrix read in FSL's convention against the T1 and against `orig.mgz`. `aseg` was sampled at each DWI voxel through each candidate and compared with the released DWI-space `aparc+aseg`, its cortical parcels collapsed to aseg's cortex. The T1 reference agreed at 99.997% (identity 76.1%, `orig.mgz` 3.1%) and was kept as `dwi_to_t1_world`.

The `tissue` stage computed white-matter, grey-matter and cerebrospinal fluid (CSF) partial volumes on the DWI grid from `aseg` classes sampled at 4³ points per DWI voxel. The ventral diencephalon, which carries the cerebral peduncle, counts as white matter. Deep nuclei count as grey matter, where stopping by the continuous map criterion (CMC) lets streamlines end.

### Fibre orientations and tracking

1. One diffusion time was used, so that all shells share one response: the Δ = 19 ms volumes and the b = 0 volumes, 434 volumes spanning b = 0–6,000 s/mm².
2. Tissue response functions were estimated with `mask_for_response_msmt` on the shells with b < 1,200 s/mm² (region-of-interest (ROI) radius 10 voxels; fractional anisotropy (FA) thresholds 0.7 for white matter, 0.3 for grey matter and 0.15 for CSF; mean diffusivity (MD) thresholds 0.001 mm²/s for grey matter and 0.0032 mm²/s for CSF). Each mask was restricted to the voxels whose dominant partial volume (≥ 0.5) is that tissue, which left 416 (white matter), 670 (grey matter) and 18 (CSF) voxels.
3. Multi-shell multi-tissue constrained spherical deconvolution (MSMT-CSD; `MultiShellDeconvModel`, spherical-harmonic order 8) was fitted in the brain mask (168,573 voxels).
4. Seeds were placed at density 2 per axis (8 per voxel) in the 49,851 voxels with white-matter fraction ≥ 0.5, which gave 398,808 seeds. `ParticleFilteringTracking` ran with a probabilistic direction getter on the fibre orientation distribution functions (fODFs; maximum angle 20°, `pmf_threshold` 0.1), CMC stopping from the partial volumes, step 0.2 mm, length 2–500 mm, back-tracking 2 mm, front-tracking 1 mm, 15 particles, at most 20 trials and random seed 1. The direction getter and stopping maps were built once before the workers forked. Tracking gave 363,819 streamlines in 37 s (the Rorqual cluster, 64 CPUs), which were moved to T1 world coordinates.
5. `whole_brain_slr` (affine, progressive, seed 1984) registered the HCP842 atlas to the tractogram by streamline-based linear registration (SLR). RecoBundles (`model_clust_thr` 0.1, minimum average direct-flip (MDF) distances, SLR on) recognised the arcuate fasciculus (atlas bundle AF), corticospinal tract (CST), cingulum (C), uncinate fasciculus (UF), inferior fronto-occipital fasciculus (IFOF), inferior longitudinal fasciculus (ILF), middle longitudinal fasciculus (MdLF) and SLF on each side. The corpus callosum is the union of the atlas bundles CC, CCMid, CC_ForcepsMajor and CC_ForcepsMinor (26,208, 10,771, 1,490 and 4,133 streamlines; 31,605 distinct). Every recognition restarted from the post-construction state of `default_rng(2001)`, so that no bundle's result depends on the bundles recognised before it. With one shared stream the left and right SLF counts had swung from 862 and 224 to 1,026 and 869.

The reduction and pruning thresholds of RecoBundles (`reduction_thr` and `pruning_thr`, MDF distances in millimetres) were chosen per bundle on the five random number generator (RNG) seeds of the `validate` stage. Association bundles use 20/10 (reduction 20, pruning 10). At that setting their left/right ratios follow the whole tractogram's (median gap 0.12, against 0.49 at 15/7 with refinement), their counts vary less across seeds (coefficient of variation 5.6% against 8.9%), and their white-matter fractions stay within 0.07 of those at 15/7 with refinement. The corticospinal tract keeps 15/7 followed by `refine(15, 6)`. It is balanced there (left/right 0.79 against the tractogram's 0.82), and 20/10 lowers its pericentral-to-brainstem share from 0.59 and 0.61 to 0.40 and 0.41. The whole callosum was not validated and keeps 15/7 with refinement.

### TractSeg bundles and FA (`scripts/tractseg_cdmd.py`)

TractSeg 2.10 was run by its `csd_msmt` recipe ("Use existing peaks") with MRtrix3 3.0.8. The script refuses any other version or checksum.

1. The input was the b = 0 volumes and the Δ = 19 ms shells with 700 ≤ b ≤ 3,600 s/mm² (b = 800, 1,500, 2,400 and 3,450 s/mm²): 242 volumes, nearest TractSeg's HCP training range (b = 1,000–3,000 s/mm²).
2. Response functions and fibre orientation distributions (FODs) were computed with `dwi2response dhollander` and `dwi2fod msmt_csd`, in the diffusion brain mask.
3. Tensor FA (`dwiextract -shells 0,800,1500`, `dwi2tensor`, `tensor2metric -fa`) was registered rigidly (`mrregister -type rigid`) to TractSeg's MNI FA template, which replaces the FSL `flirt` step of TractSeg's preprocessing. The FODs followed with `mrtransform -reorient_fod yes`, and `sh2peaks` took the peaks of the aligned FODs.
4. TractSeg wrote `tract_segmentation`, `endings_segmentation` and `TOM`, its tract orientation maps. Probabilistic TOM tracking then drew 2,000 streamlines per bundle for the callosal segments CC_1–CC_7 (Fig. 1c) and for SLF I–III on each side (Fig. 1d), with NumPy seed 13. The tracking is stochastic.
5. Before any bundle is written, `check_alignment` requires ≥ 99% of the template voxels with FA > 0.6 to lie inside the scan and their mean scan FA to be ≥ 0.45. The mean was 0.505 as used (0.307 inverted, 0.366 untransformed).
6. Streamlines were mapped back through the inverse rigid transform and `dwi_to_t1_world`. FA was resampled trilinearly onto the T1 grid (0 outside the scan, clipped to 0–1). Mean FA is 0.62 in aseg's corpus callosum, 0.41 in cerebral white matter and 0.16 in the lateral ventricles.

HCP842 has one SLF per side and divides the callosum differently, so TractSeg's subdivisions are published beside the RecoBundles SLF and whole callosum.

### Trimming and resampling (`scripts/prepare_diffusion_cdmd.py`)

For each bundle the source TRK must match the T1 (dimensions; `voxel_to_rasmm` at absolute tolerance $10^{-5}$), with finite coordinates and no empty or zero-length streamline. Each bundle was then trimmed, resampled, measured and written.

1. Each streamline was trimmed to the brain volume $B = \{\text{ribbon} > 0\} \cup \{\text{aseg} \neq 0 \text{ and } \text{aseg} \notin \{3, 42, 24\}\}$, sampled at the nearest voxel. The excluded labels are volumetric cortex, which aseg extends past the pial surface, and extracerebral CSF. Each streamline keeps the points from its first to its last point in $B$. Interior excursions are kept, and a streamline with fewer than two points in $B$ is an error. The trim is needed because CMC stopping acts on 2 mm tissue maps, so RecoBundles ends overshoot the pial surface.
2. Points were placed at equal arc length by linear interpolation, $n = \max\!\big(2, \operatorname{round}(L/0.5) + 1\big)$ for polyline length $L$ (`resample_step_mm` = 0.5 mm). Both ends are kept.
3. Three quantities were measured: for every 25th streamline, the largest distance from a trimmed point to the resampled polyline; the step distribution; and the length change. The streamline count must not change.
4. Each file was written with the original header at gzip level 6 with `mtime` 0, which makes its bytes reproducible. `provenance.json` records the source, resampled and published sha256, point counts, trimming and resampling records, three sample points in RAS (right, anterior, superior) millimetres and length summaries at minimum lengths 1, 100 and 200 mm.

The table gives, for each published bundle, the streamline count, the number of streamlines that lost an end run, the largest length removed from one streamline and the largest sampled distance from a trimmed point to the resampled polyline. The values are `streamlines`, `end_trimming.streamlines_trimmed`, `end_trimming.length_removed_mm_max` and `resampling.deviation_mm.max` of each entry of `files` in `provenance.json`.

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
| SLF I, II, III L / R | TractSeg | 2,000 each | 7 / 8, 0 / 0, 0 / 0 | 7.2 / 4.6, 0, 0 | 0.070–0.102 |
| Callosal segments 1–7 | TractSeg | 2,000 each | 0, 12, 0, 126, 77, 34, 29 | 0, 5.4, 0, 8.6, 9.8, 10.9, 9.3 | 0.050–0.236 |

RecoBundles bundles lost an end run on 6% (left IFOF) to 53% (left uncinate) of their streamlines, and TractSeg bundles on at most 6% (callosal segment 4). The left arcuate, for example, lost 14,155 of 2,121,029 points. Resampled, it has 844,916 points at a median step of 0.495 mm (largest 0.502 mm). Its polylines are 0.96% shorter at the median (at most 1.08%), because 0.5 mm chords cut across the tracker's 0.2 mm zig-zag. Across all bundles the length of a streamline changes by at most 2.16 mm (whole callosum) and by at most 1.21% (left SLF).

The T1's sha256 must equal the reconstruction's pinned input. The float64 source (68 MB raw) is published as int16 with NiBabel's `scl_slope`/`scl_inter` (slope 0.0081, intercept 259.17). Its header, grid and affine are otherwise unchanged, and every voxel is within half a step of its source value (largest error 0.0040). The FA map was copied and must lie on the T1 grid (shape and affine at $10^{-5}$).

### Scanner to surface (`scripts/prepare_diffusion_space.py`)

Streamlines stay in scanner RAS; the surfaces are in FreeSurfer surface RAS. The mapping is $M = \text{vox2ras-tkr}(\text{orig}) \cdot A_\text{orig}^{-1}$, which for a conformed volume is a translation by −`c_ras`: (−2.54, −2.62, +14.07) mm on CDMD. The script first requires the tract T1's sha256 to equal the reconstruction's pinned input, the FreeSurfer build stamp to match, and `recon-all`'s import to be exact (voxel values exact, affine error ≤ $10^{-5}$ mm). `surface-space.json` stores $M$ and three anchor voxels (origin, centre, far corner) in both frames. Nothing is registered or resampled.

### Brain outline (`scripts/prepare_diffusion_outline.py`)

For an anatomy without its own tracts, CDMD's tracts are shown inside an outline of `brain.mgz`, the reconstruction's skull-stripped brain. The outline is the largest connected component at intensity ≥ 1, meshed by Lewiner marching cubes at a step of 2 voxels and mapped from RAS millimetres to the viewer's (R, S, −A) metres without registration (25,461 vertices, 50,526 triangles). A mesh with non-positive volume (inward faces) is refused.

(tracts-template)=
### Averaged tracts on the MNI template (`scripts/prepare_diffusion_mni152.py`)

The MNI template has no diffusion scan, so its **Tracts** tab draws 21 bundles of the HCP1065 population-averaged atlas (Yeh 2022; CC BY-SA 4.0), built from 1,065 HCP young adults. They are the same bundles as CDMD's by id and name, with the SLF in its three parts, the corpus callosum whole, and the atlas's five cingulum parts joined per side (Fig. 2a–d). The atlas is in ICBM 2009a millimetres, the template's own space, so each point was multiplied by the template's scale of 0.9 and nothing was registered. Three things were done to the atlas, each recorded in `provenance.json`.

1. The voxel centres were restored. The atlas's TRK files write a voxel's centre at its index, where the TrackVis format puts it half a voxel further, so NiBabel reads them 0.5 mm off on each axis. Each point was moved by `voxel_centre_correction_mm`, (−0.5, −0.5, +0.5) mm in RAS. Against the atlas's own NIfTI volume of four bundles (AF_R, CST_L, UF_L and SLF1_L), the occupied voxels agree at Dice 0.75 as read and 0.96 with the half voxel restored. With the correction, the atlas's quantitative anisotropy (QA) template meets the template's white matter within 0.25 mm on every axis.
2. The streamlines were thinned. The atlas draws 252,405 streamlines over these bundles, four times CDMD's 64,109. Every fourth streamline of each atlas file was kept, by its position in the file (`keep_every` 4), which leaves 63,111 streamlines and keeps each bundle's share of the whole (the left arcuate has 8,539 and the right 839).
3. The streamlines were trimmed and resampled as for CDMD, except that a streamline with fewer than two points in the brain is left out and counted where the CDMD script stops with an error. End runs outside the template's brain were removed from 9,463 streamlines, no streamline was left out, and each was resampled to 0.5 mm steps.

Of the published length, 93.4% lies in the template's white matter, against 95.1% for CDMD's 17 RecoBundles bundles in CDMD's white matter by the same count. White matter is here the cerebral white matter of `ribbon.mgz` together with aseg's cerebellar white matter, brainstem, ventral diencephalon and corpus callosum. The script refuses to publish under 90%. By bundle the template's share ranges from 77.4% (right MdLF) to 99.0% (right corticospinal tract). No FA map and no tract profile is published for the template.

```{figure} figures/tracts-2-light.webp
:alt: Four panels of coloured streamlines inside a translucent grey template brain on black. a, side view with a green arched bundle over the left hemisphere and a blue column descending into the brainstem. b, front view with a thin blue column on the image's left and a fan of red and green streamlines on the right. c, top view with red streamlines crossing the midline and fanning blue and green into both hemispheres. d, side view of three stacked bundles over the hemisphere.
:name: fig-tracts-2

**The bundles of the HCP1065 averaged atlas are drawn on the MNI template as Fig. 1 draws CDMD's.** **a**, **b**, The default selection, the left arcuate fasciculus (8,539 streamlines, mean length 120.2 mm, range 58.7–162.3 mm) and the right corticospinal tract (600 streamlines, mean 118.6 mm), [from the left](https://planumatlas.com/#anatomy=mni152&lang=en&atlas=destrieux&detail=learning&tab=diffusion&view=left&opacity=0.16) (**a**) and [from the front](https://planumatlas.com/#anatomy=mni152&lang=en&atlas=destrieux&detail=learning&tab=diffusion&view=anterior&opacity=0.16) (**b**). **c**, [The whole corpus callosum](https://planumatlas.com/#anatomy=mni152&lang=en&atlas=destrieux&detail=learning&tab=diffusion&view=superior&opacity=0.16&tracts=cc-1) (8,050 streamlines), from above, anterior up. The atlas does not divide it into TractSeg's seven segments. **d**, [Left SLF I, II and III](https://planumatlas.com/#anatomy=mni152&lang=en&atlas=destrieux&detail=learning&tab=diffusion&view=left&opacity=0.16&tracts=slf1-left,slf2-left,slf3-left) (629, 3,172 and 660 streamlines), from the left. Colour is local direction, as in Fig. 1. MNI template at 0.9 of its size; cortex opacity 0.16; minimum length 1 mm. All panels share one scale. Scale bars apply at the depth of the camera's target.
```

## Display

The panel lists the bundles by class under **Association tracts**, **Projection tracts** and **Commissural tracts** (association 20, projection 2, commissural 8; on the template 18, 2 and 1). Each tract has **L**/**R** toggles, and the callosum has **Whole** for the RecoBundles callosum and **1**–**7** for the TractSeg segments. A TRK is downloaded once, when first selected, and decoded in a worker by Planum's `readTrk` (`tract-decode.ts`), whose float32 arithmetic reproduces NiiVue 0.69's `readTRK` bit for bit. The decode is shared by the 3D lines and Linked MRI. The lesion count reuses it when the **Tracts** tab has one; otherwise the worker decodes the file with the same `readTrk`.

`createNativeTractViewer` draws each bundle as three.js `LineSegments` on the decoded points in scanner RAS, under `RAS_MM_TO_WORLD` (millimetres to R, S, −A metres) and the group matrix from `surface-space.json`. `createReferenceTransform` refuses a bottom row other than 0 0 0 1 and any scale or reflection. Each point $i$ of a streamline is coloured by the unit central difference

$$\mathbf{c}_i = \frac{\lvert \mathbf{p}_{i+1} - \mathbf{p}_{i-1} \rvert}{\lVert \mathbf{p}_{i+1} - \mathbf{p}_{i-1} \rVert}$$

(neighbours clamped at the ends) as (R, G, B) = (|x|, |y|, |z|), stored as linear 16-bit values so the sRGB output shows the 8-bit display levels. Red therefore marks left–right, green anterior–posterior and blue superior–inferior directions (Fig. 1).

Polyline lengths are float64 sums of segment lengths. **Minimum length (mm)** (1–250 mm, step 1), under **Tract display**, rewrites the line index to streamlines at least that long. **Drawn bundles** lists each shown bundle's count, mean and range, and **Restore default tracts** draws the default selection again. While the camera moves every third point is drawn (`MOTION_STRIDE` = 3).

The cortex is see-through at `overlay_cortex_opacity` 0.16, which **Cortex opacity** changes (0–1, step 0.02); on another anatomy the slider is **Brain outline opacity**. **Keep tracts on other tabs** leaves the ticked bundles drawn over the see-through, grey-ghosted cortex on **Anatomy**, **Functions**, **Deficits** and **Circuits**, only for their own anatomy. Letting them go gives back the cortex opacity from before **Tracts** opened, and the exploded view hides them. A **Circuits** landmark draws its whole bundle alone, faint (opacity 0.3, `GreaterDepth`) where a surface hides it. A [lesion](lesion-report.md#method) draws only the streamlines with a point inside its sphere.

**Export lengths CSV** writes `planum-streamline-lengths.csv`, a comma-separated values (CSV) file with the columns `bundle,total_streamlines,enabled_streamlines,minimum_length_mm,mean_length_mm,min_length_mm,max_length_mm`. Its bundle names are English, and a leading `=`, `+`, `-` or `@` is prefixed with an apostrophe.

With a cut, each drawn bundle is also laid on the cut face, clipped to 2 mm either side of the plane ([sections and cuts](sections-and-cuts.md#display)). **MRI with tracts** (<kbd>M</kbd>), offered only on the tracts' own anatomy, opens [Linked MRI](linked-mri.md) with the drawn streamlines within 2 mm of each slice (`TRACT_SLAB_MM`), clipped to that slab, laid flat and in their direction colours. Where an FA map is published (CDMD only), Linked MRI adds an **FA opacity** layer (viridis over FA 0–1, default 0) whose value joins the readout.

The URL state is `tab=diffusion`, `tracts=<id,…>` and `keeptracts=1`; the last also lets `tracts` travel from another tab.

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| `resample` on a 400-point semicircle | Ends kept; median step within 0.01 mm of 0.5 mm; steps equal within $10^{-4}$ mm; deviation < 0.01 mm | passes |
| A line shorter than the step | Keeps its two ends | passes |
| `trim` | Drops only the end runs outside the brain; interior crossing kept; < 2 points inside refused | passes |
| Scanner-to-surface transform (`test_transforms.py`) | Translation equals −`c_ras` (atol $10^{-5}$); recorded matrix and anchors equal the recomputed ones (≤ $10^{-9}$ mm); a 0.001 mm anchor shift refused | 0 mm difference |
| Published maps (DIFF-13) | FA original bytes; T1 int16 display derivative (grid and affine equal to the source, every voxel within half a step) | passes |
| Published bundles (DIFF-14, DIFF-15, DIFF-06) | Decode in NiBabel's RAS+ space with matching streamline and point counts, RAS samples, float64 lengths at 1, 100 and 200 mm, and bounds | passes, 30 bundles |
| Catalogue | 30 distinct bundles | passes |
| Outline (DIFF-16) | Belongs to the tract reference; processing provenance present | passes |
| Lengths (DIFF-01 to DIFF-03) | Sum of segments on 25 seeded tracts; empty, partial-triple or broken-offset files refused; a streamline exactly at the minimum shown | passes |
| Rigid frames (DIFF-10, DIFF-11, DIFF-18) | Seeded rotations and translations keep distances; scaled, mirrored or non-affine frames refused; scanner and surface points inverse over 100 seeded frames | passes |
| Direction colour | Displays as \|R\|, \|A\|, \|S\| after sRGB encoding; a point with no direction is black | passes |
| One decode per tract (DIFF-05, DIFF-40) | Shared by 3D lines and Linked MRI, reused by the lesion count; a failed download is retried | passes |
| Template's voxel centres (`tests/test_prepare_diffusion_mni152.py`) | The correction is half a voxel along each voxel axis, in RAS | passes |
| Template's atlas files (same file) | A DSI Studio file is read where its voxel centres are; a correction of the wrong sign is refused | passes |
| Template's trimming (same file) | A streamline with fewer than two points in the brain is left out and counted | passes |
| Template's white matter (`prepare_diffusion_mni152.py`) | Share of the published streamline length in the template's white matter ≥ 0.90 | 0.934 |
| Tracts on a plane (`native-geometry.test.ts`; `native-viewer.svelte.test.ts`, DIFF-38) | A segment is cut where it leaves the 2 mm slab and laid flat on the plane in its direction colour; the cut face shows those segments over the cap and follows the cut | passes |

The bundle, catalogue and outline tests (DIFF-14 to DIFF-16) also run on the template's catalogue, with its 21 bundles.

The `check` stage of the pilot computed go/no-go measures (`derived/check.json`) identically for CDMD and for the tracts Planum first published, those of DIPY's SNAIL example subject, since retired. No cortex lies outside the diffusion grid, and 0.0003% lies outside its brain mask. The smallest of the 17 bundles has 220 streamlines. The median fraction of points in white matter is 0.933, against SNAIL's 0.847. The corticospinal share of streamlines joining pericentral cortex to the brainstem (ends within 3 mm) is 0.63 left and 0.52 right, against SNAIL's 0.89 and 0.88.

### Tract profiles

Pressing a tract's name in the **Tracts** tab draws the tract, beside any already drawn, and opens its profile. The profile gives the streamline count of each side or segment in this tracking run, their lengths once drawn, and the cortical regions its streamlines end in. `brain_model/layers/tract_ends.py` (`config/tract-ends.yaml`) takes the first and last point of every streamline, in the scanner frame the tracts and `aparc.a2009s+aseg.mgz` share. For each Destrieux region of this brain it counts the share of ends with a labelled voxel within 3 mm. An end near two regions counts for both, and regions under 5% are left out. On the committed files the left corticospinal tract's ends lie most on the precentral gyrus (18% of 1,462 ends), then the superior frontal and paracentral gyri. The left arcuate's lie most on the middle temporal (27%) and middle frontal (19%) gyri (7,278 ends), and the left uncinate's on the temporal pole (34% of 1,822 ends). The output, `public/diffusion/cdmd-sub-013/tract-ends.json`, is recomputed and compared by `tests/test_tract_ends.py`.

## Limitations

The tracts are those of one individual, from one diffusion scan at 2 mm. The bundles are reconstructions, not observed axons.

RecoBundles bundles follow HCP842's definitions, the registration and the thresholds. Their left and right counts differ (arcuate 3,639 and 2,191; IFOF 440 and 220) although the whole tractogram is near-symmetric (76,652 left and 71,484 right intrahemispheric streamlines). TractSeg's SLF I–III and callosal segments define bundles differently from RecoBundles' SLF and callosum and overlap them only partly. TractSeg's TOM tracking is stochastic, so a rerun gives other streamlines.

The corticospinal streamlines end near the caudal medulla, above the decussation. Trimming removes whole end runs outside the brain volume, up to 31.6 mm (left cingulum). Interior sulcal crossings remain.

On an anatomy with no tracts of its own, CDMD's are shown in CDMD's outline and are not placed on that anatomy. The MNI template has an averaged atlas's tracts instead ({ref}`averaged tracts on the MNI template <tracts-template>`), which are nobody's own pathways.

## Code availability

Code
: [`scripts/cdmd_pilot.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/cdmd_pilot.py), [`scripts/tractseg_cdmd.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/tractseg_cdmd.py), [`scripts/prepare_diffusion_cdmd.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/prepare_diffusion_cdmd.py), [`scripts/prepare_diffusion_space.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/prepare_diffusion_space.py), [`scripts/prepare_diffusion_outline.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/prepare_diffusion_outline.py), [`scripts/prepare_diffusion_mni152.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/prepare_diffusion_mni152.py), [`brain_model/validate_transforms.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/validate_transforms.py), `brain_model/layers/tract_ends.py`, `web/src/lib/engine/diffusion/`, `web/src/features/tracts/`, `web/src/lib/core/tracts.ts`

Configuration
: [`data/diffusion-cdmd.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/diffusion-cdmd.yaml), [`data/diffusion-mni152.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/diffusion-mni152.yaml); `tract_catalogs` in [`config/model.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/model.yaml); `config/tract-ends.yaml`; `provenance.json` of [CDMD](https://github.com/JoshuaDuq/planumatlas/blob/main/public/diffusion/cdmd-sub-013/provenance.json) and [the template](https://github.com/JoshuaDuq/planumatlas/blob/main/public/diffusion/mni152-hcp1065/provenance.json)

Tests
: [`tests/test_prepare_diffusion_cdmd.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_prepare_diffusion_cdmd.py), [`tests/test_prepare_diffusion_mni152.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_prepare_diffusion_mni152.py), `tests/test_transforms.py`, `tests/test_tract_ends.py`, `web/src/lib/engine/diffusion/*.test.ts`

```bash
# DIPY stages: frames, tissue, response, fit, track, bundles (track and bundles ran on Rorqual)
uv run --with dipy==1.12.1 --with cvxpy --with joblib python scripts/cdmd_pilot.py frames
uv run python scripts/tractseg_cdmd.py /path/to/cdmd-pilot
uv run python scripts/prepare_diffusion_cdmd.py /path/to/cdmd-pilot
uv run python scripts/prepare_diffusion_space.py --anatomy cdmd
uv run python scripts/prepare_diffusion_outline.py --anatomy cdmd
# The template's atlas tracts; the atlas archive is pinned by sha256 in data/diffusion-mni152.yaml
uv run python scripts/prepare_diffusion_mni152.py
uv run python scripts/prepare_diffusion_space.py --anatomy mni152
uv run python scripts/prepare_diffusion_outline.py --anatomy mni152
uv run pytest tests/test_prepare_diffusion_cdmd.py tests/test_prepare_diffusion_mni152.py tests/test_transforms.py
npm test --prefix web -- diffusion
npm run test:browser --prefix web -- native-viewer
```

