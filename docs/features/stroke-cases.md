# Stroke cases

For a selected region, the viewer plots lesion volume against Western Aphasia Battery Aphasia Quotient (WAB-AQ) for every person in the Aphasia Recovery Cohort (ARC) whose lesion covers at least 5% of the region, and draws one or two chosen lesions on the brain. The 228 lesions are the authors' SPM12-normalised maps, carried onto CDMD through a SynthMorph registration of the cohort's mean brain. The cohort is selected for aphasia; no case is a prognosis.

```{figure} figures/stroke-cases-1.webp
:alt: Left, the Stroke cases section for the left subcentral gyrus and sulci, a scatter of lesion volume on a log axis against WAB-AQ with 94 grey dots and one blue and one pink dot, followed by the exceptions list and the two chosen cases. Right, a left lateral view of the brain at low cortex opacity with one lesion in blue, the other in pink and their overlap in green, the subcentral region outlined in white.
:name: fig-stroke-cases-1

**Two lesions of equal volume reaching one region, with opposite language outcomes.** **a**, **Stroke cases** for the left subcentral gyrus and sulci (`destrieux:left:4`), 90-day test window: 94 people reach the region; lesion volume (log axis) against WAB-AQ, dashed line at 93.8 (within normal limits). Blue, ARC M2295: Broca's aphasia, WAB-AQ 15.5, 110.0 cm³, 80% of the region. Pink, ARC M2272: no aphasia, WAB-AQ 93.9, 112.2 cm³, 26% of the region. They are the first of 30 **Similar size, different score** pairs (78 points apart). **b**, The two lesions on CDMD: M2295 alone (blue), M2272 alone (pink), shared voxels (green); left lateral view, cortex see-through, region outlined.
```

## Data

| Input | Detail |
| :--- | :--- |
| Cohort | ARC ([Gibson et al. 2024](../reference/references.md#group-data-and-templates)): 228 adults with chronic left-hemisphere stroke recruited for aphasia studies; OpenNeuro ds004884 v1.0.2, CC0 |
| Scores | `participants.tsv` at dataset commit `0885e59`, SHA-256 pinned: one WAB-R per person, its aphasia type and its day after stroke. Types: Broca 85, Anomic 61, None 31, Conduction 26, Global 14, Wernicke 7, Transcortical motor 3, not recorded 1 |
| Lesions | 228 binary maps on SPM12's 1 mm grid, drawn on each person's T2 and normalised by the authors (SPM12 unified segmentation with enantiomorphic healing); [AphasiaRecoveryCohortDemo](https://github.com/neurolabusc/AphasiaRecoveryCohortDemo) commit `1d24ad4`, BSD-2-Clause, each SHA-256 pinned in `config/stroke-cases-lesions.sha256`. File `wsub-<id>_ses-<T1 day>x<T2 day>_lesion.nii.gz` (or one day for both); the T2 day is the scan day |
| Mean brain | `T1_mean_228.nii.gz`, mean of the 228 healed, brain-extracted T1s on the same grid; it keeps the stroke side's ex vacuo ventricle |
| Target | CDMD `brain.mgz` and `aseg.mgz` (256³, 1 mm) |

## Method

### Registration

`scripts/register_stroke_cases.py` (FreeSurfer 8.2) registered the mean brain to `brain.mgz` with `mri_synthmorph register -m joint` (affine and deformable). The mean, not SPM12's template, was registered: it lies in the lesions' space, and its ex vacuo left ventricle matches CDMD better (left caudate Dice 0.85, against 0.66 through SPM12's template). SynthMorph ran on the CPU; its output is recorded by checksum, not expected to reproduce bit for bit.

### Lesion transfer

`stroke_cases.reader` samples each lesion through the forward displacement field: for each CDMD voxel, the moving point is its RAS plus the displacement, read by linear interpolation on the lesion's own grid. A voxel is kept where the interpolated mask is ≥ 0.5 (`keep_at`). On the first lesion the reader must agree with `mri_synthmorph apply` to Dice ≥ 0.999. Each lesion is stored as $(start, length)$ runs of Fortran-order voxel indices on `aseg`'s grid in `data/cdmd/stroke-lesions.npz`, with `aseg`'s `vox2ras-tkr`.

### Registration scoring

`mri_synthseg --parc --robust` segmented the mean brain; the segmentation, carried by `mri_synthmorph apply -m nearest`, was scored against CDMD's `aseg` (`coordinate_spaces.checks`), with a round trip of every brain point through the forward and inverse fields. Limits were fixed on 4 November 2026, before measurement (Validation).

### Regional shares

At build, `stroke_cases.partition` decodes each atlas's cut labels onto `aseg`'s grid and computes, for each case and region, the share of the region's cut voxels the lesion covers. A region present on several atlases' cuts must measure the same on each (checked before any share is dropped); several codes of one region are summed. Shares below 1% (`SHARE_FLOOR`) are dropped. A case *reaches* a region at ≥ 5% (`reaches_min`), the threshold the authors' demonstration repository applies. Volume is the authors' own, $n_\text{voxels} \times 1\ \text{mm}^3$ on SPM12's grid, because the carried volume is smaller (median ratio 0.66 over the 228 cases).

### Selection rules

- **Test window.** Gap $= |d_\text{test} - d_\text{scan}|$; windows 90 days (default), 365 days, any.
- **Pairs.** Volume ratio ≤ 1.25 and AQ difference ≥ 25; widest AQ gap first; each person in one pair only.
- **Exceptions.** Share ≥ 0.40 and AQ ≥ 76; at most 3, highest AQ first.
- **Severity bands** (Kertesz 2007): very severe 0, severe 26, moderate 51, mild 76, within normal limits 93.8.
- **Differences.** For two cases: the selected region, then regions of the same atlas or `aseg` that either lesion reaches, by absolute share difference; 6 rows.

## Display

`stroke-cases.json` loads on first selection; `stroke-cases.masks` (little-endian `uint32` runs) loads when a lesion is first drawn and is checked against its SHA-256 and the run offsets. The **Stroke cases** section shows the scatter (log volume, WAB-AQ 0–100, axis fixed per region across windows), **Much of it damaged, mild or no aphasia**, **Similar size, different score** and **Where they differ**. One lesion is drawn in the overlay ink colour; two are drawn as first-only, second-only and shared voxel sets in the comparison and shared colours. Each set is meshed by `surfaceOf`: binary field, separable kernel (0.06, 0.24, 0.4, 0.24, 0.06; σ ≈ 0.85 voxel) on each axis, then clamped to ≥ 0.55 inside and ≤ 0.45 outside the set, and marching cubes at 0.5. The clamp keeps a one-voxel sheet and a one-voxel gap. Solids are double-sided and clipped by the section planes; the cortex is held see-through while cases show. URL state: `cases=<id>[,<id>]`, at most two distinct ARC ids.

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| Hemisphere agreement (`acceptance`) | ≥ 0.98 | 0.998 |
| Subcortical Dice, minimum / median | ≥ 0.70 / ≥ 0.80 | 0.739 (left pallidum) / 0.868 |
| Cerebral cortex Dice | ≥ 0.65 | 0.721 |
| Round trip, median / p95 | ≤ 0.5 / ≤ 1.0 mm | 0.045 / 0.181 mm |
| Share of each lesion inside the brain (`aseg` ≠ 0), median | ≥ 0.90 | 0.973 (minimum 0.850) |
| Right-hemisphere share of lateralised lesion voxels, median | ≤ 0.02 | 0.0 (maximum 0.019) |
| Field reader against `mri_synthmorph apply` | Dice ≥ 0.999 | 1.0 |
| `stroke_cases.validate` | Shares and masks rebuilt from stored lesions equal the published files; acceptance re-applied | passes; 228 cases reach 606 regions |
| `tests/test_stroke_cases.py` | Definition and lesion list, malformed definitions, T2 dating, unrecorded type, Fortran-order runs, shares and floor, cross-cut consistency, reader on another grid, acceptance, placement | passes |

Subcortical Dice (left / right): thalamus 0.862 / 0.877, caudate 0.850 / 0.854, putamen 0.880 / 0.911, pallidum 0.739 / 0.880, hippocampus 0.845 / 0.862, amygdala 0.861 / 0.900, lateral ventricle 0.873 / 0.897. Front-end checks: `web/src/lib/core/catalog/stroke-cases.test.ts` (reach, pairs, exceptions, bands, differences, validation) and `web/src/lib/engine/lesion/stroke-cases.test.ts` (run decoding, pair partition, closed surface of a voxel cube, one-voxel sheet kept, one-voxel gap open).

## Limitations

- A selected chronic left-hemisphere aphasia cohort: lesions without aphasia are under-sampled.
- One WAB per person. The scan–test gap exceeds 90 days for 76 of 228 people (152 in the default window), 365 days for 55, and reaches 5,528 days (15.1 years); 47 were tested before their scan.
- WAB-AQ measures aphasia severity, not one region's function.
- Registration is scored on segmentation overlap and round trip, not on the lesions; the left pallidum (0.739) is the weakest structure.
- Lesions pass through two normalisations (the authors' to SPM12, then the mean brain to CDMD); a share is of cut voxels on this brain.

## Code availability

| | |
| :--- | :--- |
| Code | [`scripts/register_stroke_cases.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/register_stroke_cases.py), [`brain_model/layers/stroke_cases.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/stroke_cases.py), [`web/src/lib/core/catalog/stroke-cases.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/catalog/stroke-cases.ts), [`web/src/lib/engine/lesion/stroke-cases.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/engine/lesion/stroke-cases.ts) |
| Configuration | [`config/stroke-cases.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/stroke-cases.yaml), [`config/stroke-cases-lesions.sha256`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/stroke-cases-lesions.sha256) |
| Tests | [`tests/test_stroke_cases.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_stroke_cases.py), `brain_model.validate` |

```bash
# 228 downloads, then SynthMorph and SynthSeg on the CPU; needs FreeSurfer 8.2
uv run python scripts/register_stroke_cases.py --anatomy cdmd --record
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_stroke_cases.py
npm test --prefix web
```

Figure state (open **Stroke cases** for panel a): https://planumatlas.com/#anatomy=cdmd&atlas=destrieux&region=destrieux:left:4&cases=M2295,M2272
