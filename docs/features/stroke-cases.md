# Stroke cases

A region that some stroke in the Aphasia Recovery Cohort reached opens a scatter of lesion volume against Western Aphasia Battery score, and draws a chosen person's own lesion on the brain; the 228 lesions come from the cohort's authors and are carried onto this brain by a SynthMorph registration.

:::{list-table}
:widths: 22 78
:stub-columns: 1

* - Where in the viewer
  - The region inspector's **Stroke cases** section, for any region a lesion reached (606 regions on CDMD); the lesions are drawn on the stage; shared as `cases=<id>[,<id>]`.
* - Built by
  - [`scripts/register_stroke_cases.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/register_stroke_cases.py), [`brain_model/layers/stroke_cases.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/stroke_cases.py); drawn by [`web/src/lib/engine/lesion/stroke-cases.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/engine/lesion/stroke-cases.ts)
* - Configuration
  - [`config/stroke-cases.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/stroke-cases.yaml), [`config/stroke-cases-lesions.sha256`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/stroke-cases-lesions.sha256) (228 lesion checksums)
* - Source data
  - Aphasia Recovery Cohort (ARC), OpenNeuro ds004884 v1.0.2 (CC0); the authors' normalised lesion maps from [neurolabusc/AphasiaRecoveryCohortDemo](https://github.com/neurolabusc/AphasiaRecoveryCohortDemo) (BSD-2-Clause, Chris Rorden); Gibson et al. (2024)
* - Checked by
  - [`tests/test_stroke_cases.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_stroke_cases.py), the registration's acceptance limits in `config/stroke-cases.yaml`, `brain_model.validate`, `web/src/lib/core/catalog/stroke-cases.test.ts`, `web/src/lib/engine/lesion/stroke-cases.test.ts`
:::

## What it does

```{figure} ../../.github/assets/readme/stroke-cases.webp
:alt: Two Aphasia Recovery Cohort lesions compared on the left subcentral gyrus and sulci, one with severe Broca's aphasia and one with no aphasia, drawn in overlapping colours with their WAB-AQ scores

A pair chosen for the left subcentral gyrus and sulci: similar lesion size, very different language outcome. Each person's own lesion is drawn; the third colour is where they overlap.
```

A region some stroke in the Aphasia Recovery Cohort reached opens **Stroke cases**: a scatter of lesion volume (log scale) against WAB Aphasia Quotient, one dot per person whose lesion reaches a minimum share of the region, filtered to a test window (90 days, a year, or any time) from their scan. Picking a dot, or two, draws that person's own lesion on the brain; two lesions draw in separate colours plus a third for their overlap, with the regions where their damage most differs listed by share. **Much of it damaged, mild or no aphasia** calls out exceptions to the expected volume–score relationship. **Similar size, different score** steps through pairs matched for lesion volume but far apart in outcome.

The cohort is real strokes in real people; it does not say what a lesion placed on this brain would do, and WAB-AQ measures aphasia severity, not this region's function alone. Nothing here is a prognosis for anyone. Sources: [Gibson et al. (2024)](https://doi.org/10.1038/s41597-024-03819-7) and the [OpenNeuro dataset](https://doi.org/10.18112/openneuro.ds004884.v1.0.2).

## Data

| Input | Detail |
| :--- | :--- |
| Cohort | 228 adults with chronic left-hemisphere stroke recruited for aphasia studies. Each lesion was drawn on the person's own T2 and normalised to SPM12's tissue probability maps by its authors (SPM12 unified segmentation with enantiomorphic healing, `clinical_mrnormseg12`) |
| Scores | OpenNeuro ds004884 v1.0.2 `participants.tsv`, pinned at repository commit `0885e59…` and SHA-256 `37a8e845…` (full values in the configuration): one Western Aphasia Battery (WAB-R) per person, with its type and the days after the stroke it was given |
| Lesions | 228 binary maps on SPM12's 1 mm grid from `neurolabusc/AphasiaRecoveryCohortDemo` at commit `1d24ad4…`, each pinned by SHA-256 in `config/stroke-cases-lesions.sha256`. The file name `wsub-M2001_ses-1253x1076_lesion.nii.gz` carries the person (`M2001`) and the session as `ses-<T1 day>x<T2 day>`, or one day for both; the lesion was drawn on the T2, so the second day is its scan day |
| Mean brain | `T1_mean_228.nii.gz` (SHA-256 `4d7f3467…`), the mean of the 228 healed T1s the lesions were normalised with, on the same grid. It is brain-extracted, and the cohort's mean keeps its stroke side's ex vacuo ventricle, which SPM12's own template does not |
| Cache | `data/cache/stroke-cases/` (each download verified before use) |

Released T1s are enantiomorphically healed and skull-stripped, so they cannot show the lesion. `participants.tsv` holds one WAB per person and no sessions file; the gap between the scan the lesion was drawn on and the test is therefore a recorded field of each case.

## How it was built

`scripts/register_stroke_cases.py --anatomy cdmd [--record]` (FreeSurfer 8.2; SynthMorph runs on the CPU and its output is recorded by checksum rather than expected to reproduce bit for bit).

### 1. Pin and read the inputs

The participants table, the mean T1 and each lesion are downloaded and verified by SHA-256. `read_lesions` refuses a lesion that is not on the mean T1's grid or is not binary. `facts_of` reads each case from its file name and its participants row: `id`, `aq` (WAB-AQ, 0–100), `type` (one of Global, Broca, TranscorticalMotor, Wernicke, Conduction, Anomic, None; one person's was not recorded, as `n/a`, and keeps the score with a null type), `scan_day` (the T2 day) and `test_day`. `volume_cm3` is the authors' own lesion volume on SPM12's grid.

### 2. Register the mean brain to this brain

SynthMorph registers the cohort's mean healed T1 to the anatomy's `brain.mgz`, joint affine and deformable (`mri_synthmorph register -m joint`). The mean itself is registered, not SPM12's template: it lies in the lesions' space, and its ex vacuo left ventricle matches this brain's better (left caudate Dice 0.85, against 0.66 through SPM12's template).

### 3. Read every lesion through the forward field

`stroke_cases.reader` reads each lesion through SynthMorph's forward displacement field directly, in world coordinates: the fixed voxel's RAS plus the displacement is the moving RAS to sample, linearly. `mri_synthmorph apply` resamples correctly only an image on the registration's moving grid: lesions on ARC's 1 mm grid through a 1.5 mm template registration landed about 40 mm off (Dice 0). The reader agrees with `apply` to Dice 1.0 where the grids coincide, and the script refuses to continue if it is below 0.999 on the first lesion. A lesion voxel is kept where the interpolated mask reaches `keep_at` = 0.5, as the authors binarised their own.

### 4. Score the registration

`mri_synthseg --parc --robust` reads the mean brain's anatomy; carried across by `mri_synthmorph apply -m nearest`, it is scored against this brain's `aseg` with `coordinate_spaces.checks`, along with a round trip of every brain point through the forward and inverse fields. The limits were set before the registration was measured (4 November 2026).

### 5. Store the lesions

Each lesion becomes runs of `(start, length)` over the Fortran-ordered voxel indices of `aseg.mgz`'s grid (`runs_of`), saved with the case ids, offsets, grid shape and `voxel_to_surface` (aseg's `vox2ras-tkr`) in `data/cdmd/stroke-lesions.npz`. `data/stroke-cases.json` holds the cases' facts. With `--record` the files are added to `data/sources.json`.

### 6. Count what each lesion reaches

At build, `stroke_cases.partition` (`brain_model.layers.stroke_cases`):

1. Decodes each surface atlas's cut labels onto `aseg`'s grid (`region_grids`).
2. For every region and every case, `shares` takes the share of the region's cut voxels the lesion covers. A region on several atlases' cuts (a deep structure) must measure the same on each, zero included; this is checked before small shares are dropped, and a region a cut labels several ways sums them.
3. Drops shares below `SHARE_FLOOR` = 1%.
4. Writes `stroke-cases.json` (each case with its shares by region id and its run offsets) and `stroke-cases.masks`: all runs in one little-endian `uint32` buffer, with its SHA-256, shape, `F` order and voxel-to-surface-RAS matrix recorded in the JSON.

A case *reaches* a region when its lesion covers at least `reaches_min` = 5% of the region's voxels on the cut, the 5% sufficient-affection threshold the authors' demonstration repository applies to its regional analysis.

## How the viewer uses it

- **Loading.** The cohort (`stroke-cases.json`) is read once a region is selected (`stroke-cases.svelte.ts`); the masks are downloaded when a lesion is first drawn, checked against the published SHA-256 and against the last case's run offsets (`web/src/lib/engine/index.ts`). `validateStrokeCases` checks the cohort against itself and the regions it names.
- **Section.** `StrokeCasesSection.svelte` lists the cases that reach the region within the chosen test window, with `reaching(data, region, maxGap)`, where the gap is the absolute difference between the test day and the scan day. The windows are 90 days, 365 days and any time (`test_windows`, then infinity). The plot has lesion volume on a log axis across, WAB-AQ up, with the axis fixed for the region so that changing the window does not rescale it; it is one tab stop navigated with the arrow keys.
- **Pairs.** `discordantPairs` pairs cases whose lesion volumes differ by a ratio of at most 1.25 and whose WAB-AQ differ by at least 25, widest gap first and each person in one pair only. **Much of it damaged, mild or no aphasia** (`exceptions`) lists up to three cases with at least 40% of the region lesioned and AQ at least 76, highest score first. `band` places an AQ in the WAB-R severity bands (Kertesz 2007): very severe from 0, severe from 26, moderate from 51, mild from 76 and within normal limits from 93.8.
- **Comparison.** `differences` lists where two lesions differ most: the selected region first, then the regions of its own atlas and the deep structures either lesion reaches, by how far their shares differ.
- **Stage.** `createStrokeCaseSolids` draws one lesion in the overlay ink colour, or two as the first alone, the second alone and the shared voxels, in the two comparison colours and the shared colour. `surfaceOf` builds each solid from its voxel set: a separable Gaussian of $\sigma \approx 0.85$ voxel (kernel 0.06, 0.24, 0.4, 0.24, 0.06) applied along each axis, then kept voxel-safe, so that every voxel of the set stays above the surface's level and every other voxel below it (bounds 0.55 and 0.45 around the 0.5 level); the surface is marching cubes at 0.5, transformed to surface RAS through the stored matrix. Smoothing never moves the surface across a voxel centre, so a sheet one voxel thin survives, drawn thinner than it is, and a one-voxel gap stays open. A 0.75/0.25 pair moved every flat boundary onto the voxel faces and drew a staircase. The solid is double-sided so a cut shows the inside as lesion, and it is clipped by the section planes as the cortex is. At most two cases are drawn at once.
- **Display.** Tracts and stroke cases share one counted see-through-cortex hold (`cortex-hold.svelte.ts`): the display is held only when cases first appear and is given back only while it is still at the see-through tissue opacity; cases clear when the region is deselected.

## Checks

The limits were fixed before the registration was measured.

| Check | Limit | CDMD |
| :--- | :--- | :--- |
| Lateralised tissue on its own side | ≥ 0.98 | 0.998 |
| Deep grey and ventricle Dice, each / median | ≥ 0.70 / ≥ 0.80 | 0.739 (left pallidum, lowest) to 0.911 |
| Cerebral cortex Dice | ≥ 0.65 | 0.721 |
| Round trip, median / p95 | ≤ 0.5 / ≤ 1.0 mm | 0.045 / 0.181 mm |
| Median share of a lesion inside the brain (aseg not 0) | ≥ 0.90 | 0.973 (minimum 0.850) |
| Median right-hemisphere share of lateralised lesion voxels | ≤ 0.02 | 0.0 (maximum 0.019) |
| Field reader against `mri_synthmorph apply` | Dice ≥ 0.999 | 1.0 |

Subcortical Dice values in the report: thalamus 0.862 left and 0.877 right; caudate 0.850 and 0.854; putamen 0.880 and 0.911; pallidum 0.739 and 0.880; hippocampus 0.845 and 0.862; amygdala 0.861 and 0.900; lateral ventricle 0.873 and 0.897. Placement counts inside-brain as `aseg` not 0, because `coordinate_spaces.sides` misses white-matter hypointensities and CSF (the median fell to 0.87 with it).

`stroke_cases.validate` rebuilds the shares and the masks from the stored lesions and the cut labels and requires them to equal the published files, and re-applies the acceptance limits to the stored report. It counts 228 cases reaching 606 regions. The registration through the cohort's mean brain and through SPM12's template agree on lesion composition (median 0.98, 10th percentile 0.97); the lesion volume carried onto this brain is about 0.64 of the volume in SPM12's space, which is why the viewer shows the authors' volume.

Python tests (`test_stroke_cases.py`) cover the definition and lesion list, malformed definitions, dating a lesion by its T2, unrecorded WAB type, the round trip of runs in Fortran order, shares and the floor, cross-cut consistency, the reader on another grid, acceptance, and placement.

## Limits

- A selected chronic left-hemisphere aphasia cohort: people with a lesion in a region but no aphasia are under-sampled, and no case predicts anyone's recovery.
- One WAB score per person, often given months or years from the scan the lesion was drawn on. The gap exceeds 90 days for 76 of the 228 people (152 usable at the default window), exceeds a year for 55, and reaches about 15 years; 47 people were tested before their scan. The viewer shows the gap and filters on it.
- Lesions were normalised by their authors to SPM12's template and carried onto this brain through a registration of the cohort's mean brain; a region's share is its cut voxels a lesion covers.
- WAB-AQ measures aphasia severity, not one region's function.
- Registration quality is checked against segmentation (Dice) and round trip, not against the lesions themselves. The left pallidum (0.739) is the weakest structure.
- Meshing a pair can take up to about 320 ms on the main thread for the largest pair.

## Reproduce

```bash
# Register and read the lesions (about 228 downloads, then SynthMorph and SynthSeg on the CPU; needs FreeSurfer 8.2)
uv run python scripts/register_stroke_cases.py --anatomy cdmd --record

# Build, validate and test
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_stroke_cases.py
npm test --prefix web
```

Vite indexes `public/` at start, so a new published file needs a dev-server restart.

## See also

- [Lesion report](lesion-report.md): the sphere-based measure of what a placed lesion overlaps.
- [Deficits](deficits.md): the lesion-evidence catalogue; the cohort's aphasia scores are not part of it.
- [Published coordinates](published-coordinates.md): the same SynthMorph registration approach for MNI templates.
- [Cortical atlases](cortical-atlases.md) and [internal anatomy](internal-anatomy.md): the cut labels the shares are counted on.
- [References and licensing](../reference/references.md), [Validation and limits](../pipeline/validation.md).
