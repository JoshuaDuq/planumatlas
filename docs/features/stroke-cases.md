# Stroke cases

For a selected region, the viewer plots lesion volume against Western Aphasia Battery Aphasia Quotient (WAB-AQ) for every person in the Aphasia Recovery Cohort (ARC) whose lesion covers at least 5% of the region, and draws one or two chosen lesions on the brain. The 228 lesions are the cohort authors' SPM12-normalised maps. They were carried onto Planum's individual brain, a subject of the Connectome Diffusion Microstructure Dataset (CDMD), through a SynthMorph registration of the cohort's mean brain. The cohort is selected for aphasia; no case is a prognosis.

```{figure} figures/stroke-cases-1-light.webp
:alt: Two panels. a, the Stroke cases section for the left subcentral gyrus and sulci, with a scatter of lesion volume on a log axis against WAB-AQ, 94 grey dots and one blue and one pink dot. b, a brain seen from the left at low cortex opacity with one lesion in blue, the other in pink and their overlap in green, the subcentral region outlined in white, above a key of the three colours.
:name: fig-stroke-cases-1

**Two lesions of equal volume reach one region with opposite language outcomes.** **a**, The **Stroke cases** section of the left subcentral gyrus and sulci (`destrieux:left:4`) for the 90-day test window, in which the strokes of 94 people reach the region. Each dot is one person, by lesion volume (log axis) and WAB-AQ, and the dashed line marks 93.8 (within normal limits). Blue is ARC M2295 (Broca's aphasia, WAB-AQ 15.5, 110.0 cm³, 80% of the region) and pink is ARC M2272 (no aphasia, WAB-AQ 93.9, 112.2 cm³, 26% of the region). They are the first of 30 pairs under **Similar size, different score** (78 points apart). **b**, [The two lesions](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&view=left&region=destrieux:left:4&cases=M2295,M2272) on CDMD `sub_013` in the default oblique view from the left, inside a see-through cortex with the region outlined. The key gives M2295 alone (blue), M2272 alone (pink) and the voxels both share (green). Scale bars apply at the depth of the camera's target.
```

## Data

| Input | Content | Source, pin and licence |
| :--- | :--- | :--- |
| Cohort | ARC ([Gibson et al. 2024](../reference/references.md#group-data-and-templates)): 228 adults with chronic left-hemisphere stroke recruited for aphasia studies | OpenNeuro ds004884 v1.0.2, CC0 |
| Scores | One Western Aphasia Battery–Revised (WAB-R) score per person, with its aphasia type and its day after stroke | `participants.tsv` at dataset commit `0885e59`, SHA-256 pinned |
| Lesions | 228 binary maps on SPM12's 1 mm grid, drawn on each person's T2-weighted image and normalised by the authors (SPM12 unified segmentation with enantiomorphic healing) | [AphasiaRecoveryCohortDemo](https://github.com/neurolabusc/AphasiaRecoveryCohortDemo) commit `1d24ad4`, BSD-2-Clause, each SHA-256 pinned in `config/stroke-cases-lesions.sha256` |
| Mean brain | `T1_mean_228.nii.gz`, mean of the 228 healed, brain-extracted T1-weighted images on the same grid; it keeps the stroke side's ex vacuo ventricle | Same repository and commit as the lesions, SHA-256 pinned in `config/stroke-cases.yaml` |
| Target | CDMD `brain.mgz` and `aseg.mgz`, FreeSurfer's skull-stripped T1-weighted image and segmentation of this brain (256 × 256 × 256 voxels, 1 mm) | `data/cdmd/mri/` |

The recorded aphasia types are Broca (n = 85), Anomic (61), None (31), Conduction (26), Global (14), Wernicke (7) and Transcortical motor (3), with the type not recorded for 1 person.

A lesion file is named `wsub-<id>_ses-<T1 day>x<T2 day>_lesion.nii.gz`, or carries one day for both scans. The lesion was drawn on the T2-weighted image, so the T2 day is the scan day.

## Method

### Registration

`scripts/register_stroke_cases.py` (FreeSurfer 8.2) registered the mean brain to `brain.mgz` with `mri_synthmorph register -m joint` (affine and deformable). The mean, not SPM12's template, was registered. It lies in the lesions' space, and it keeps the ex vacuo left ventricle that SPM12's template lacks. Registered directly, the mean reached a left caudate Dice coefficient of 0.85, against 0.66 through SPM12's template. SynthMorph ran on the central processing unit (CPU). Its output is recorded by checksum, not expected to reproduce bit for bit.

### Lesion transfer

`stroke_cases.reader` sampled each lesion through the forward displacement field. For each CDMD voxel, the moving point is its RAS (right, anterior, superior) coordinate plus the displacement. The lesion was read at that point by linear interpolation on its own grid. A voxel was kept where the interpolated mask was ≥ 0.5 (`keep_at`). On the first lesion the reader had to agree with `mri_synthmorph apply -m linear` to Dice ≥ 0.999. Each lesion is stored as $(start, length)$ runs of Fortran-order voxel indices on `aseg`'s grid in `data/cdmd/stroke-lesions.npz`, with `aseg`'s `vox2ras-tkr`.

### Registration scoring

`mri_synthseg --parc --robust` segmented the mean brain. The segmentation was carried by `mri_synthmorph apply -m nearest` and scored against CDMD's `aseg` (`coordinate_spaces.checks`). Every brain point of the mean was also sent on a round trip through the forward and inverse fields. The acceptance limits were fixed on 4 November 2026, before measurement (Validation). The script stores the lesions only if every limit passes (`stroke_cases.accept`).

### Regional shares

At build, `stroke_cases.partition` decoded each surface atlas's cut labels onto `aseg`'s grid. For each case and region, it computed the share of the region's cut voxels the lesion covers. A region present on several atlases' cuts must measure the same on each, which is checked before any share is dropped. Several codes of one region are summed. Shares below 1% (`SHARE_FLOOR`) are dropped. A case *reaches* a region at ≥ 5% (`reaches_min`), the threshold the authors' demonstration repository applies. Lesion volume is the authors' own, $n_\text{voxels} \times 1\ \text{mm}^3$ on SPM12's grid, because the carried volume is smaller (median ratio of carried to authors' volume 0.66 over the 228 cases).

### Selection rules

The test window bounds the gap in days between test and scan, $|d_\text{test} - d_\text{scan}|$. The windows are 90 days (default), 365 days and any gap. Pairs and exceptions are drawn from the cases that reach the region inside the window.

A pair is two cases with a volume ratio ≤ 1.25 and a WAB-AQ difference ≥ 25. Pairs are listed widest WAB-AQ gap first, and each person appears in one pair only.

An exception is a case with a share ≥ 0.40 of the region and a WAB-AQ ≥ 76. At most 3 are shown, highest WAB-AQ first.

The severity bands (Kertesz 2007) start at WAB-AQ 0 for very severe, 26 for severe, 51 for moderate, 76 for mild and 93.8 for within normal limits.

The differences between two cases are listed in at most 6 rows. The selected region comes first, then the regions of the same atlas or `aseg` that either lesion reaches, by absolute share difference.

## Display

`stroke-cases.json` loads on the first selection of a region. **Stroke cases** in the **Deficits** list opens the selected region's section. With nothing selected, it selects the region shown that the most lesions reach and says so. `stroke-cases.masks` (little-endian `uint32` runs) loads when a lesion is first drawn and is checked against its SHA-256 and the run offsets.

The **Stroke cases** section shows the scatter, **Much of it damaged, mild or no aphasia**, **Similar size, different score** and **Where they differ** (Fig. 1a). The scatter plots lesion volume on a log axis against WAB-AQ on a 0–100 axis. The volume axis is fixed per region across windows. The test window is chosen under **Tested within**. Each dot takes a press anywhere nearer it than any other dot, out to 12 px (22 px with a coarse pointer). The plot's labels are set at the caption size, so they grow with the reader's text size. A closed **Table of cases** under the plot lists every case in it, sortable by **Case**, **Lesion volume, cm³** and **WAB-AQ**. A row and its dot are one choice, with the same press, pressed state and colour.

One lesion is drawn in the overlay ink colour. Two are drawn as first-only, second-only and shared voxel sets in the comparison and shared colours (Fig. 1b). Each set is meshed by `surfaceOf`. The binary field is smoothed with a separable kernel (0.06, 0.24, 0.4, 0.24, 0.06; σ ≈ 0.98 voxel) on each axis, then clamped to ≥ 0.55 inside and ≤ 0.45 outside the set, and marching cubes extracts the surface at 0.5. The clamp keeps a one-voxel sheet and a one-voxel gap. Solids are double-sided and clipped by the section planes. The cortex is held see-through and in its tissue colour while cases show. URL state is `cases=<id>[,<id>]`, at most two distinct ARC ids.

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| Hemisphere agreement | ≥ 0.98 | 0.998 |
| Subcortical Dice, minimum / median | ≥ 0.70 / ≥ 0.80 | 0.739 (left pallidum) / 0.868 |
| Cerebral cortex Dice | ≥ 0.65 | 0.721 |
| Round trip, median / 95th percentile | ≤ 0.5 / ≤ 1.0 mm | 0.045 / 0.181 mm |
| Share of each lesion inside the brain (`aseg` ≠ 0), median | ≥ 0.90 | 0.973 (minimum 0.850) |
| Right-hemisphere share of lateralised lesion voxels, median | ≤ 0.02 | 0.0 (maximum 0.019) |
| Field reader against `mri_synthmorph apply` | Dice ≥ 0.999 | 1.0 |
| `stroke_cases.validate` | Shares and masks rebuilt from stored lesions equal the published files; acceptance re-applied | Passes; 228 cases reach 642 regions |
| `tests/test_stroke_cases.py` | Definition, lesion files, shares, reader, acceptance and placement behave as specified | Passes |

The first six rows are the `acceptance` limits of `config/stroke-cases.yaml`, as measured on CDMD. Subcortical Dice (left / right) is thalamus 0.862 / 0.877, caudate 0.850 / 0.854, putamen 0.880 / 0.911, pallidum 0.739 / 0.880, hippocampus 0.845 / 0.862, amygdala 0.861 / 0.900 and lateral ventricle 0.873 / 0.897.

`tests/test_stroke_cases.py` covers the definition and lesion list, malformed definitions, T2 dating, an unrecorded type, Fortran-order runs, shares and floor, cross-cut consistency, the reader on another grid, acceptance and placement.

The front end has three test files. `web/src/lib/core/catalog/stroke-cases.test.ts` covers reach, the most-reached region, pairs, exceptions, bands, differences and validation. `web/src/lib/engine/lesion/stroke-cases.test.ts` covers run decoding, pair partition, the closed surface of a voxel cube, a one-voxel sheet kept and a one-voxel gap open. `web/src/features/inspector/StrokeCasesSection.svelte.test.ts` covers focus handoffs, download failures, press targets, label size and the table of cases.

## Limitations

The cohort is selected: adults with chronic left-hemisphere stroke, recruited for aphasia studies. Lesions without aphasia are under-sampled.

Each person has one WAB-R score. The scan–test gap exceeds 90 days for 76 of 228 people (152 in the default window) and 365 days for 55. It reaches 5,528 days (15.1 years), and 47 people were tested before their scan.

WAB-AQ measures aphasia severity, not one region's function.

Registration is scored on segmentation overlap and round trip, not on the lesions. The left pallidum (Dice 0.739) is the weakest structure.

Lesions pass through two normalisations: the authors' to SPM12, then the mean brain to CDMD. A share is of cut voxels on this brain.

## Code availability

Code
: [`scripts/register_stroke_cases.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/register_stroke_cases.py), [`brain_model/layers/stroke_cases.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/stroke_cases.py), [`web/src/lib/core/catalog/stroke-cases.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/catalog/stroke-cases.ts), [`web/src/lib/engine/lesion/stroke-cases.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/engine/lesion/stroke-cases.ts)

Configuration
: [`config/stroke-cases.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/stroke-cases.yaml), [`config/stroke-cases-lesions.sha256`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/stroke-cases-lesions.sha256)

Tests
: [`tests/test_stroke_cases.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_stroke_cases.py), `brain_model.validate`, `web/src/lib/core/catalog/stroke-cases.test.ts`, `web/src/lib/engine/lesion/stroke-cases.test.ts`, `web/src/features/inspector/StrokeCasesSection.svelte.test.ts`

```bash
# 228 downloads, then SynthMorph and SynthSeg on the CPU; needs FreeSurfer 8.2
uv run python scripts/register_stroke_cases.py --anatomy cdmd --record
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_stroke_cases.py
npm test --prefix web
```

