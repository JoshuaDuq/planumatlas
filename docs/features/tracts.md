# Tracts

The **Tracts** tab shows 30 white-matter bundles reconstructed from CDMD sub_013's own diffusion scan, drawn as streamlines coloured by local direction inside the same subject's reconstructed T1 anatomy.

:::{list-table}
:widths: 22 78
:stub-columns: 1

* - Where in the viewer
  - **Tracts** tab (bundle list, minimum-length filter, **MRI with tracts**, **Export lengths CSV**); **Show tracts with anatomy**; a lesion's **Tracts** list ([lesion report](lesion-report.md)); a Circuits landmark's tract ([circuits](circuits.md)).
* - Built by
  - [`scripts/cdmd_pilot.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/cdmd_pilot.py) (17 RecoBundles bundles), [`scripts/tractseg_cdmd.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/tractseg_cdmd.py) (13 TractSeg bundles and FA), [`scripts/prepare_diffusion_cdmd.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/prepare_diffusion_cdmd.py) (trim, resample, package), [`scripts/prepare_diffusion_space.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/prepare_diffusion_space.py) (scanner-to-surface transform), [`scripts/prepare_diffusion_outline.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/prepare_diffusion_outline.py) (brain outline)
* - Configuration
  - [`data/diffusion-cdmd.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/diffusion-cdmd.yaml); `tract_catalogs` in [`config/model.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/model.yaml); outputs under `public/diffusion/cdmd-sub-013/`, with [`provenance.json`](https://github.com/JoshuaDuq/planumatlas/blob/main/public/diffusion/cdmd-sub-013/provenance.json)
* - Source data
  - MGH Connectome Diffusion Microstructure Dataset (CDMD) sub_013, figshare collection 5315474 (CC0 1.0); DIPY 1.12.1 and its HCP842 bundle atlas (CC BY 4.0); TractSeg 2.10 (Apache-2.0) with pretrained weights (CC BY 4.0, Zenodo); MRtrix3 3.0.8 (MPL-2.0)
* - Checked by
  - [`tests/test_prepare_diffusion_cdmd.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_prepare_diffusion_cdmd.py), `brain_model/validate_transforms.py`, `web/src/lib/engine/diffusion/*.test.ts`
:::

## What it does

The **Tracts** tab displays bundles reconstructed from diffusion MRI. CDMD has 30 bundles derived from the same subject's diffusion scan and displayed with its reconstructed T1 anatomy.

### Explore the bundles

Select a side (L or R), or a numbered callosal segment, to load a bundle. A subset is visible initially (the left arcuate and the right corticospinal tract). Use **Restore default tracts** to return to that selection. The **Section** and **Display** controls work with the tracts; cortex opacity is shared between the Tracts tab and Display. Tracts remain visible when you return to Anatomy until you switch off **Show tracts with anatomy**.

```{figure} ../../.github/assets/readme/tracts.webp
:alt: The default tract bundles inside a see-through cortex, coloured by local direction, with streamline counts and lengths in the panel

The default bundles, coloured by local direction, with each loaded side's streamline count and length range.
```

Streamline colour represents local direction:

| Colour | Direction |
| :--- | :--- |
| Red | Left–right |
| Green | Anterior–posterior |
| Blue | Inferior–superior |

Each row reports a streamline count, mean length and range. Use the minimum-length slider to filter the display; **Export lengths CSV** exports loaded bundles with the active threshold. The CSV uses English bundle names regardless of interface language. Hidden bundles and bundles with no streamlines above the threshold have zero enabled streamlines and blank length statistics. Streamline counts are not axon counts, and polyline lengths are not measures of connection strength. A placed lesion's report can draw one bundle's streamlines through the lesion; see [lesion report](lesion-report.md).

### Compare with MRI

Choose **MRI with tracts** or press <kbd>M</kbd> to see the tract reference's T1 and FA images with linked slices and a crosshair. Click or scroll on a slice, or use the arrow keys and Page Up/Down, to move through voxels. The voxel inputs are zero-based. When the tracts belong to the displayed anatomy, the crosshair also positions the cutting plane.

For an anatomy without its own tracts, such as a local `fsaverage` build, the viewer shows CDMD's tracts separately within an outline derived from CDMD's T1. It does not place those tracts on the other anatomy.

## Data

### Subject and scan

The source is MGH CDMD sub_013 (Tian et al. 2022): a 1 mm T1 (176 × 220 × 220, `sub_013_t1w.nii.gz`, SHA-256 `16e91371…`, defaced, not skull-stripped) and a 2 mm diffusion scan of 850 volumes in 16 shells up to b = 17,800 s/mm² at two diffusion times. The same T1 is the input of the subject's FreeSurfer reconstruction (the CDMD anatomy), so the tracts, MRI and surfaces share one scanner frame. The released coregistration (`sub_013_dwi2t1w.mat`, FSL convention) relates the diffusion scan to the T1. Both scripts read the inputs from one work directory, `/Volumes/KINGSTON/neuroatlas/cdmd-pilot` locally or `CDMD_PILOT_WORK` on a cluster; `tractseg_cdmd.py` checks each input against a pinned SHA-256.

### Published files

All under `public/diffusion/cdmd-sub-013/` (205 MB):

| File | Content |
| :--- | :--- |
| `<bundle>.trk.gz` (30) | One TRK streamline file per bundle, gzip level 6, 175 MB in all: 90,109 streamlines and 16.8 million points |
| `sub_013_t1w.nii.gz` | The reconstruction's imported T1, byte for byte (map `t1`, grey, range 0–525; the scan's maximum is 523.8) |
| `fa.nii.gz` | Tensor FA resampled onto the T1 grid (map `fa`, viridis, range 0–1, opacity 0 until chosen) |
| `brain-outline.glb`, `brain-outline.json` | A display outline of the skull-stripped brain and its provenance |
| `surface-space.json` | The scanner-RAS to surface-RAS transform |
| `provenance.json` | Every checksum, transform, method and geometry check |

### The catalogue

`data/diffusion-cdmd.yaml` lists the 30 bundles, each with `id`, `file`, bilingual `name`, `class` (`association`, `projection` or `commissural`, the order the list shows) and, for the callosal segments, a `segment` name. Two carry `initial: true`.

| Method | Bundles |
| :--- | :--- |
| RecoBundles (17) | Arcuate fasciculus (`af`), corticospinal tract (`cst`), cingulum (`cg`), uncinate (`uf`), inferior fronto-occipital (`ifof`), inferior longitudinal (`ilf`), middle longitudinal (`mdlf`) and superior longitudinal (`slf`) fasciculi, each left and right; the whole corpus callosum (`cc-1`) |
| TractSeg (13) | SLF I, II and III (`slf1`, `slf2`, `slf3`) left and right; callosal segments `callosum-1` to `callosum-7`: rostrum, genu, rostral body (premotor), anterior midbody (primary motor), posterior midbody (primary somatosensory), isthmus and splenium |

DIPY's HCP842 atlas has one SLF per side and divides the callosum differently, so the TractSeg subdivisions are kept beside the RecoBundles SLF and callosum.

## How it was built

### 1. Frames, tissue and tracking in DIPY (`scripts/cdmd_pilot.py`)

The script runs as numbered stages that each write under `<work>/derived/`, so a later stage never recomputes an earlier one: `frames`, `tissue`, `response`, `fit`, `track`, `bundles`, with `check`, `cst`, `asymmetry`, `recognition` and `validate` for go/no-go measures. It follows DIPY 1.12.1's `reconst_mcsd`, `tracking_pft` and `bundle_extraction` examples (`uv run --with dipy==1.12.1 --with cvxpy --with joblib python scripts/cdmd_pilot.py STAGE`).

1. **`frames`.** The diffusion-to-T1 world transform is the released bbregister matrix taken in FSL's convention with the T1 as reference. Candidates (identity, FSL with `sub_013_t1w.nii.gz`, FSL with `orig.mgz`) are scored by label agreement with the released DWI-space `aparc+aseg`; the FSL/T1 choice reproduces it at 99.997%. The T1 and `orig.mgz` must share one world frame (intensity correlation recorded).
2. **`tissue`.** White, grey and CSF partial volumes on the diffusion grid from FreeSurfer's `aseg`, sampled at 4³ points per diffusion voxel (`SUPERSAMPLE = 4`). Ventral DC carries the cerebral peduncle, so it is white matter; deep nuclei are grey matter, where the CMC criterion lets tracts end.
3. **Shells.** One diffusion time, so every shell shares one response: Δ = 19 ms (b = 50–6000; Δ = 49 ms reaches 17,800), the Δ = 19 ms volumes plus b = 0 (434 volumes, b up to 6000).
4. **`response`.** Multi-shell multi-tissue response functions from the shells below b = 1200, by `mask_for_response_msmt` (ROI radius 10, thresholds: white-matter FA 0.7, grey-matter FA 0.3 and MD 0.001, CSF FA 0.15 and MD 0.0032), restricted to voxels whose dominant tissue is the class.
5. **`fit`.** MSMT-CSD (`MultiShellDeconvModel`, spherical harmonic order 8) on the brain mask, giving white-matter fODFs and volume fractions.
6. **`track`.** Seeds are the voxels with white-matter volume fraction at least 0.5, two per voxel (398,808 seeds). Particle filtering tractography (`ParticleFilteringTracking`) with a probabilistic direction getter from the fODFs (maximum angle 20°, `pmf_threshold` 0.1), CMC stopping from the partial volumes, `step_size` 0.2 mm, minimum length 2 mm, maximum 500 mm, back-tracking 2 mm, forward 1 mm, 15 particles, at most 20 trials, random seed 1. The direction getter and stopping maps are built once before the workers fork, because rebuilding the whole-volume PMF (about 2.2 GB) in each worker was killed by the memory limit. The streamlines are moved to T1 world coordinates: 363,819 streamlines (Rorqual, 64 CPUs, 37 s). PFT results differ between ARM and x86 processors.
7. **`bundles`.** `whole_brain_slr` (affine, progressive; seed 1984) registers DIPY's HCP842 80-bundle atlas (MNI ICBM 2009a; figshare 7375883) to the tractogram. RecoBundles (`model_clust_thr` 0.1, MDF distances, SLR on) recognises each bundle from its atlas models: AF_L/R, CST_L/R, C_L/R, UF_L/R, IFOF_L/R, ILF_L/R, MdLF_L/R, SLF_L/R, and the callosum as the union of CC, CCMid, CC_ForcepsMajor and CC_ForcepsMinor. Every recognition starts from the same RNG state, the post-construction state of `default_rng(2001)`, so no bundle's result depends on the bundles recognised before it; with one shared stream the left and right SLF counts swung from 862 and 224 to 1,026 and 869.

The reduction/pruning thresholds are per bundle, chosen on the `validate` stage's five RNG seeds: the association bundles use 20/10 (their left/right ratios follow the whole tractogram's, median gap 0.12 against 0.49, and their count variation across seeds is 5.6% against 8.9%, with white-matter fractions within 0.07), the corticospinal tract keeps 15/7 followed by `refine(15, 6)` (it is already balanced, and 20/10 lowers its pericentral-to-brainstem share from 0.59 and 0.61 to 0.40 and 0.41), and the whole callosum was not validated and keeps the first run's 15/7 with refinement.

### 2. TractSeg bundles and FA (`scripts/tractseg_cdmd.py`)

[`scripts/tractseg_cdmd.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/tractseg_cdmd.py) follows TractSeg's `csd_msmt` recipe ("Use existing peaks") with MRtrix3 3.0.8:

- **Pinned runtime.** MRtrix3 3.0.8 (macOS arm64 release, SHA-256 `91fb80ff…`), TractSeg 2.10, the six pretrained weight files (CC BY 4.0, Zenodo records 3518348, 3518331 and 3239216–3239222, each by SHA-256 in the script) and TractSeg's `MNI_FA_template.nii.gz` (SHA-256 `3a047037…`). The script refuses to run on another version or checksum, and refuses a work directory whose inputs differ from the pinned ones.
- **Input:** 242 volumes: the b = 0 volumes and the Δ = 19 ms shells with b between 700 and 3600 (b = 800, 1500, 2400, 3450), the range nearest TractSeg's HCP training data (b = 1000–3000).
- **Peaks:** `dwi2response dhollander`, `dwi2fod msmt_csd` and `sh2peaks`, within the diffusion brain mask.
- **FA and alignment:** tensor FA (`dwiextract -shells 0,800,1500`, `dwi2tensor`, `tensor2metric -fa`). TractSeg expects MNI orientation, which its `--preprocess` does with FSL `flirt`; here a rigid `mrregister` aligns the tensor FA to TractSeg's MNI FA template, and the FODs are carried across with `mrtransform -reorient_fod yes`. A check rejects the transform unless template white matter lands on scan white matter: voxels of the template with FA above 0.6 must land inside the scan (at least 99%) on a mean diffusion FA of at least 0.45. The mean FA there is 0.505 as used, against 0.307 for the inverse and 0.366 without a transform.
- **Segmentation and tracking:** TractSeg's `tract_segmentation`, `endings_segmentation` and `TOM` outputs, then probabilistic TOM tracking of 2,000 streamlines per bundle for SLF I–III on each side and CC_1–CC_7 (NumPy seed 13). It is stochastic, so individual streamlines differ on rerun. TractSeg's `Tracking` passes worker state through module globals that reach workers only under the fork start method, so it runs through a wrapper that selects it.
- **Back to CDMD's frame:** the inverse rigid transform and the recorded diffusion-to-T1 transform (`dwi_to_t1_world`) map the streamlines to the T1's frame; the FA map is resampled trilinearly onto the T1 grid the same way (zero outside the scan, clipped to 0–1). Mean FA is 0.62 in aseg's corpus callosum, 0.42 in cerebral white matter and 0.16 in the ventricles.
- **OpenMP.** torch, DIPY and scikit-learn each bundle `libomp` 5.0; DIPY's and scikit-learn's are symlinks to torch's so one runtime loads (`KMP_DUPLICATE_LIB_OK` is not used). TractSeg ignores `weights_dir`, so the weights are symlinked into `~/.tractseg`.

The union of TractSeg's SLF I–III overlaps the RecoBundles SLF at Dice 0.46 left and 0.53 right; its callosal segments overlap the RecoBundles whole callosum at 0.67. The methods define bundles differently, so these values are comparisons between reconstructions, not accuracy against ground truth.

### 3. Trim, resample and package (`scripts/prepare_diffusion_cdmd.py`)

```bash
uv run python scripts/prepare_diffusion_cdmd.py /path/to/cdmd-pilot
```

For each of the 30 bundles:

1. **Validate the source TRK** against the T1: dimensions and `voxel_to_rasmm` agree at absolute tolerance 1e-5, all coordinates are finite, no streamline is empty or of zero length.
2. **Trim the ends.** DIPY's CMC criterion works on diffusion-resolution tissue maps, so RecoBundles ends can run up to about 5 mm past the pial surface into CSF. Each streamline loses the run of points outside the reconstruction's brain volume at each end (`trim`): voxels where `ribbon.mgz` is positive, or `aseg` is not 0 and not one of 3, 42 (volumetric cortex, which `aseg` extends past the surfaces) or 24 (extracerebral CSF); nearest voxel. Interior crossings of sulci are kept by design, and a streamline with fewer than two points inside the brain is an error. The checksums of `ribbon.mgz` and `aseg.mgz` are recorded.
3. **Resample to 0.5 mm** along each streamline's own arc length by linear interpolation (`resample`, step `resample_step_mm` in the catalogue, the step of the DIPY SNAIL tracts the viewer first published); the tracking steps are integration settings, not measurements. A streamline shorter than the step keeps its two ends.
4. **Measure the change.** Every 25th streamline's largest distance from an original point to the resampled polyline (`deviation`), the step distribution, and the length change. The streamline count must not change.
5. **Write** the TRK with the original header, compress it (gzip level 6, `mtime` 0, so the bytes are reproducible), and record `source_sha256`, `resampled_sha256` (what the published file decompresses to), `published_sha256`, point counts, the trimming and resampling records, the streamline and point counts, three RAS samples and the length summary at 1, 100 and 200 mm.

The T1 is copied byte for byte from the pilot's source (checked against the reconstruction's pinned input checksum), and the FA map must lie on the T1's grid (shape and affine at 1e-5).

Measured on the published files, for example the left arcuate: 3,639 streamlines, 947 trimmed (26%), 14,155 of 2,121,029 points removed, at most 19.0 mm from one streamline; after resampling 844,916 points at a median step of 0.495 mm (largest 0.502 mm), at most 0.053 mm from the trimmed points, and the polylines 0.96% shorter at the median (at most 1.1%), because 0.5 mm chords cut across the tracker's 0.2 mm zig-zag. Across all bundles the polyline length changes by at most 2.2 mm, or 1.2% of a streamline.

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

Up to half a RecoBundles bundle's streamlines (the left SLF: 50%) overshot the brain; TractSeg's ends are clean. The largest trim of a single streamline (31.6 mm in the left cingulum) exceeds the 5 mm overshoot noted when trimming was introduced: the script removes every end run outside the brain volume, whatever its length.

### 4. The transform to the surface frame (`scripts/prepare_diffusion_space.py`)

The reconstruction's surfaces are in FreeSurfer's surface RAS, the tracts in scanner RAS. `prepare_diffusion_space.py` records the exact mapping: `orig.mgz`'s `vox2ras-tkr` times the inverse of its scanner affine, which for a conformed volume is a pure translation by −`c_ras`. It first checks that the tract reference T1's checksum equals the reconstruction's pinned input and that `recon-all` imported it exactly (voxel values exact, affine error at most 1e-5 mm). It writes `surface-space.json` with the matrix and three anchor voxels (the origin, the centre and the far corner) in both frames. There is no anatomical registration and no streamline resampling.

### 5. The brain outline (`scripts/prepare_diffusion_outline.py`)

For an anatomy with no tracts of its own the viewer shows CDMD's tracts inside an outline, since the T1 keeps the skull. The outline is the reconstruction's skull-stripped `brain.mgz` (`data/cdmd/mri/brain.mgz`): the largest connected component above intensity 1, meshed by Lewiner marching cubes at `step_size` 2 voxels, in the scanner frame, converted to the viewer's R/S/−A metres with no registration, and written as `brain-outline.glb` (opacity 0.16). The script refuses a mesh with inward-facing triangles. The provenance records the source checksum, the vertex and triangle counts and that it is "not a pial or labeled cortical reconstruction; limited to the source field of view".

## How the viewer uses it

`web/src/lib/engine/diffusion/` (engine) and `web/src/features/tracts/` (interface).

### Loading and decoding

`createTractLoader` (`tract-file.ts`) downloads and decodes each TRK once, with NiiVue's `NVMeshLoaders.readTRK`, and computes every streamline's polyline length in float64 (`streamlineLengths`, `streamlines.ts`: the sum of segment lengths, never the end-to-end distance; an empty file, a partial triple, broken offsets or a non-finite coordinate is an error). The same decoded points feed the 3D lines and the MRI navigator, so there is one copy; a failed load is dropped and retried. A TRK is fetched only when its bundle is selected.

### How the viewer draws streamlines

`createNativeTractViewer` (`native-viewer.ts`) builds, per bundle, three.js `LineSegments` over the decoded points themselves, in scanner RAS millimetres, with one matrix (`RAS_MM_TO_WORLD`, millimetres to the viewer's R/S/−A metres) and the group matrix `createReferenceTransform` builds from `surface-space.json` (`reference-space.ts`, which refuses a transform whose bottom row is not 0 0 0 1 and a scale or reflection). The scanner-to-surface mapping is therefore exact and nothing is resampled in the browser.

- **Colour by direction.** `directionColors` (`native-geometry.ts`) colours each point by the absolute components of the unit vector between its neighbours (the point before and after, within the streamline), red for left–right, green for anterior–posterior and blue for inferior–superior (as NiiVue's local colouring). The 8-bit display levels are stored as their linear values (16-bit, normalised), because three.js reads vertex colours as linear and encodes them to sRGB on output.
- **Minimum-length filter.** `filterTractGeometry` rewrites the line index so that only streamlines at least the minimum long are drawn (draw range reset; 1 to 250 mm in 1 mm steps, `MINIMUM_LENGTH`).
- **Motion.** While the camera moves each bundle draws every third point (`MOTION_STRIDE = 3`, 1.5 mm chords of the 0.5 mm streamlines, measured within 0.3 mm of them on CDMD) from the same buffers (`createMotionGeometry`); still frames draw every point.
- **Hidden stretches.** A second material (`GreaterDepth`, opacity 0.3, transparent, no depth write) draws a landmark's whole bundle faint only where a surface in front hides it, so stretches inside or behind the anatomy are drawn faint rather than left out. Section clipping planes are shared with the cortex.
- **One bundle alone.** `isolate` hides every other bundle while a lesion's selection or a landmark's whole bundle is shown. The lesion path counts streamlines with at least one point inside the sphere (`streamlineMembership`) and draws only those; the Circuits path draws every streamline of one bundle at the current minimum.
- **Programs.** `tractProgramSamples` compiles the line materials before the Tracts tab first draws.
- **Outline.** The `brain-outline.glb` loads with the viewer in a translucent grey material (`0xb3babf`, opacity 0.16 by default).
- **State.** `tracts.ts` assembles the catalogue, `own` (a lesion's crossing for an anatomy's own tracts) and `setOverlay` (**Show tracts with anatomy**, refused on an anatomy that is not the tracts' own); `defaultOpacity` is the catalogue's `overlay_cortex_opacity` (0.16); lesion and landmark isolation emit `tractsVisibility`. Tracts and stroke cases share one counted see-through-cortex hold.
- **Export.** `buildLengthsCsv` (`web/src/lib/core/tracts.ts`) writes `planum-streamline-lengths.csv` with the header `bundle,total_streamlines,enabled_streamlines,minimum_length_mm,mean_length_mm,min_length_mm,max_length_mm`, English names, quoted; a leading `=`, `+`, `-` or `@` is prefixed with an apostrophe so a spreadsheet does not run it as a formula, and a hidden bundle counts as zero shown with blank metrics.

### MRI with tracts

`createMriNavigationViewer` (`navigation-viewer.ts`) uses NiiVue's multiplanar grid with a 3D render. It loads the catalogue's maps (T1 greyscale 0–525; FA viridis 0–1 at zero opacity until chosen), validates each (`validateVolume`: three-dimensional, scalar, millimetre units, a valid affine) and requires them to share one grid. Tracts are NiiVue fibre meshes (`fiberColor` "Local", radius 0, no dither, decimation stride 1, `fiberLength` the minimum) built from the shared decode, with the float64 lengths kept. NiiVue reports its own RAS-reordered voxel, which mirrors this scan's source grid, so the voxel readout is rebuilt from the scanner point (`scannerVoxel`, `sourceVoxelPoint`: zero-based source voxels inside the grid, the nearest voxel to a point). The dialog is `MriNavigator.svelte`; the canvas owns the arrow keys and Page Up/Down; <kbd>M</kbd> follows the single-key shortcut preference.

## Checks

| Check | Where | Result |
| :--- | :--- | :--- |
| Resampling keeps the ends and spaces points at the step; a line shorter than the step keeps its two ends; trimming drops only the runs outside the brain at each end | `tests/test_prepare_diffusion_cdmd.py` | pass |
| Map shape and affine agree with every TRK header at 1e-5 | `prepare_diffusion_cdmd.py` | enforced when packaging |
| Template white matter lands on scan white matter | `check_alignment` | mean FA 0.505 (floor 0.45) |
| The scanner-to-surface transform equals `orig.mgz`'s own, recomputed; its anchors agree | `brain_model/validate_transforms.py` | error ≤ 1e-9 mm required; rejects scale and reflection |
| Maps keep their original NIfTI bytes and grid | `published-data.test.ts` (DIFF-13) | pass |
| Each bundle decodes in NiBabel's RAS+ space with matching points, streamline counts, sampled coordinates, and float64 lengths at 1, 100 and 200 mm | `published-data.test.ts` (DIFF-14, DIFF-15) | pass |
| The outline belongs to the tract reference and carries its processing provenance | `published-data.test.ts` (DIFF-16) | pass |
| Lengths are the sum of segments; thresholds and malformed files are refused | `streamlines.test.ts` (DIFF-01 to 03) | pass |
| A transform that is not rigid and orientation-preserving is refused; a seeded rotation and translation keeps distances | `reference-space.test.ts` (DIFF-10, DIFF-11) | pass |
| One download and decode per tract, shared by the 3D lines and the MRI navigator; a failed download is retried | `tract-file.test.ts` | pass |
| The catalogue names 30 distinct bundles | `published-data.test.ts` | pass |

Pilot go/no-go measures were set before the results (`check` stage): the frame matches; no cortex is outside the diffusion scan; all 17 bundle groups contain at least 50 streamlines; and the fraction of points in white matter exceeds the earlier SNAIL tracts' on every bundle (median 0.933 against 0.847, though CMC stopping favours this measure). The corticospinal pericentral-to-brainstem share failed against SNAIL (0.59 and 0.62 against 0.89 and 0.88); the diagnosis was that the HCP842 atlas defines the corticospinal tract more broadly (the model itself, carried into sub_013, is 0.69 and 0.61 pericentral) and that only 1–2% of upper ends lie more than 3 mm from cortex, so the tracking did not fail.

## Limits

- Reconstructions from diffusion data, not direct observations of individual axons. Streamline counts are not axon counts, and polyline lengths are not measures of connection strength.
- One individual, one scan (2 mm voxels).
- RecoBundles definitions follow the HCP842 atlas and depend on the registration and thresholds; the left/right counts differ (arcuate 3,639 and 2,191, IFOF 440 and 220), but the tracking itself is near-symmetric (76,652 against 71,484 intrahemispheric streamlines): the imbalance is RecoBundles', and for the ILF and IFOF follows the atlas models' own size asymmetry.
- The corticospinal streamlines stop near the caudal medulla, before the crossing.
- TractSeg's probabilistic tracking is stochastic: a rerun gives different streamlines. PFT tracking differs between ARM and x86 processors.
- The TractSeg and RecoBundles segmentations overlap only partly (SLF Dice 0.46 left and 0.53 right; callosum 0.67), because the methods define bundles differently.
- Trimming drops whole end runs outside the brain volume, so a streamline can lose tens of millimetres at an end; interior sulcal crossings are kept.
- An anatomy without its own tracts shows CDMD's tracts separately in an outline and does not place them on the other anatomy.

## Reproduce

```bash
# DIPY stages (tracking and recognition were run on a cluster; see the stage list in the script)
uv run --with dipy==1.12.1 --with cvxpy --with joblib python scripts/cdmd_pilot.py frames
# ... tissue, response, fit, track, bundles

# TractSeg's SLF I-III, callosal segments and FA (MRtrix3 3.0.8 and TractSeg 2.10 in data/cache)
uv run python scripts/tractseg_cdmd.py /path/to/cdmd-pilot

# Trim, resample, package, and write the transform and outline
uv run python scripts/prepare_diffusion_cdmd.py /path/to/cdmd-pilot
uv run python scripts/prepare_diffusion_space.py --anatomy cdmd
uv run python scripts/prepare_diffusion_outline.py --anatomy cdmd

# Checks
uv run pytest tests/test_prepare_diffusion_cdmd.py
uv run python -m brain_model.validate --anatomy cdmd
npm test --prefix web
```

Prerequisites are described in [Building an anatomy](../pipeline/building.md#regenerating-sources). Packaging rewrites the TRK files, so a running Vite dev server may need a restart.

## See also

- [Circuits](circuits.md): the corticospinal tour draws `cst-left` on three landmarks.
- [Lesion report](lesion-report.md): counts the streamlines with a point inside a placed sphere.
- [Linked MRI](linked-mri.md) and [sections and cuts](sections-and-cuts.md): the cutting plane the tracts follow.
- [Spinal cord](spinal-cord.md): where the corticospinal tract continues.
- [References and licensing](../reference/references.md), [Validation and limits](../pipeline/validation.md#tracts).
