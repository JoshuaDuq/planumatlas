# Spinal cord

This brain's own cervical cord, segmented from its T1 with the Spinal Cord Toolbox, with the PAM50 atlas's 30 white-matter tracts and 6 grey-matter regions (34 published) registered to it and drawn as solids from the medulla to C5.

:::{list-table}
:widths: 22 78
:stub-columns: 1

* - Where in the viewer
  - Display › spinal cord (**S**); the Anatomy tab's spinal cord system; sections through the cord. An anatomy without a segmented cord publishes none, and Display says so.
* - Built by
  - [`scripts/segment_spinal_cord.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/segment_spinal_cord.py), [`brain_model/layers/spinal_cord.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/spinal_cord.py), [`brain_model/build.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/build.py) (`build_structure_layer`), [`brain_model/surfaces/geometry.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/surfaces/geometry.py)
* - Configuration
  - [`config/model.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/model.yaml): `spinal_cord` (grid spacing, crop margin, probability threshold, Dice floor, structures, families, unresolved region), `structures.smoothing`
* - Source data
  - Spinal Cord Toolbox 7.3 (LGPL-3.0) with its contrast-agnostic cord model; PAM50 template r20250730 and white-matter atlas (MIT, as declared by its host OSF project); CDMD's source T1
* - Checked by
  - Validation step 12 ([validation](../pipeline/validation.md)); [`tests/test_spinal_cord.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_spinal_cord.py), `web/src/lib/engine/model/spinal-cord.test.ts`
:::

## What it does

This brain's own cervical cord, from the medulla to where the scan ends. The Spinal Cord Toolbox 7.3 runs on the source T1: its contrast-agnostic model segments the cord, the vertebrae are labelled from the discs, and the PAM50 template is registered to the cord and its discs. PAM50's atlas of 30 white-matter tracts and 6 grey-matter regions, left and right, is warped onto a 0.5 mm grid around the cord, its own spacing; each voxel keeps its most probable region where the region probabilities sum to at least 0.5. Each region is meshed like the other solids, smoothed by at most 0.6 mm and never across a voxel centre.

The outline and the levels are this cord's. The tracts and grey matter inside it are the atlas's: a 1 mm scan of a cord about 12 mm across does not resolve them. There are no nerve roots, and nothing below the scan. On CDMD the vertebral levels are C1 to C5, and the 34 published regions are 14 tracts and 3 grey-matter regions, each on the left and the right.

## Data

| Input | Pinned by |
| :--- | :--- |
| `data/cdmd/input/sub_013_t1w.nii.gz`: CDMD `sub_013`'s defaced T1 (the same scan FreeSurfer reconstructs) | sha256 `16e91371…0c02`, recorded in `config/model.yaml` and `data/sources.json` |
| Spinal Cord Toolbox 7.3 (`~/sct_7.3`, or `$SCT_DIR`); needs Rosetta on Apple silicon | `spinalcordtoolbox/version.txt` must read `7.3` |
| Cord model `model_seg_sc_contrast_agnostic_nnunet`, release v3.0 (`model_contrast_agnostic_20250123.zip`) | tree sha256 `603f00b7…a020` |
| PAM50 `r20250730` (`PAM50-r20250730.zip`) | tree sha256 `4cc9cb64…1ea1158` |

The tree hash is a sha256 over each file's relative path and sha256, sorted, skipping macOS AppleDouble files (`._name`). The licence file `PAM50.txt` ships with the models. PAM50's repository states none; its host, the Spinal Cord Toolbox's OSF project (6zbyf), declares MIT (© 2014 École Polytechnique, Université de Montréal). SCT itself is LGPL-3.0. Citations: De Leener et al. (2018) for the template, Lévy et al. (2015) for the white-matter atlas, De Leener et al. (2017) for SCT, and Bédard et al. (2025) for the segmentation model; see [references](../reference/references.md). Attribution: PAM50 template (De Leener et al. 2018) and white-matter atlas (Lévy et al. 2015), registered with the Spinal Cord Toolbox.

## How it was built

`scripts/segment_spinal_cord.py` runs the steps below in the work directory `data/cache/sct-cdmd`, skipping a step whose output already exists. Each command's log is `<command>.log`. Settings come from `config/model.yaml` `spinal_cord`.

### 1. Segment the cord and label the vertebrae

1. `sct_deepseg spinalcord -i <T1> -o t1_cord.nii.gz`: SCT's contrast-agnostic cord segmentation.
2. `sct_label_vertebrae -i <T1> -s t1_cord.nii.gz -c t1`: vertebral levels from the discs, `levels/t1_cord_labeled.nii.gz` and its disc labels.

### 2. Register PAM50 to the cord

`sct_register_to_template -i <T1> -s t1_cord.nii.gz -c t1 -ldisc levels/t1_cord_labeled_discs.nii.gz`: the template is registered to the cord and its discs, giving `reg/warp_template2anat.nii.gz`.

### 3. Warp the atlas onto a grid around the cord

1. `sct_crop_image -m t1_cord.nii.gz -dilate 8x8x2`: the T1 cropped to the segmented cord's bounding box plus `crop_margin_voxels` `[8, 8, 2]` scan voxels (1 mm).
2. `sct_resample -mm 0.5x0.5x0.5 -x linear`: the crop resampled to `atlas_spacing_mm` of 0.5 mm, the template's own spacing (0.25 mm quadrupled the meshes for nothing).
3. `sct_warp_template -d <grid> -w <warp>`: PAM50 warped onto that grid, giving one probability map per atlas region (`atlas/PAM50_atlas_NN.nii.gz`, `NN` 00 to 35).

### 4. Take each voxel's most probable region

`most_probable_regions` stacks the 36 probability maps (each must be on the grid), and:

1. Marks a voxel as cord where the 36 probabilities sum to at least `minimum_cord_probability` (0.5).
2. Sets the probability of the unresolved regions (`atlas: [10, 11]`) to −1 so they never win.
3. Labels each cord voxel with `argmax + 1` (0 outside the cord) as a `uint8` NIfTI.

PAM50's lateral reticulospinal tract (atlas ids 10 and 11) never exceeds 0.43 probability anywhere in the template, and 16 voxels won there; it is no voxel's most probable region on CDMD's grid (0 left, 6 right). It still counts toward the cord, but takes no voxels: they go to the next most probable region. It is not published, which is why 34 and not 36 regions appear.

Three files are written beside the subject's MRI under `data/cdmd/spinal-cord/` and read back to confirm every label survived: `pam50-regions.nii.gz` (the most probable PAM50 region per voxel, as PAM50 index + 1 because the structure-finder needs 0 as background), `sct-cord.nii.gz` (SCT's cord segmentation, on the T1's grid) and `sct-levels.nii.gz` (the vertebral levels, on the T1's grid). They are recorded in `data/sources.json` with their inputs and the procedure.

### 5. Place the cord in the subject's frame

`spinal_cord.scanner_grid` places each volume in surface RAS through `nextbrain.scanner_to_surface(config) @ image.affine`, the same placement as the NextBrain volume: the scanner affine through `orig.mgz`'s transform, never the volume's own header. `spinal_cord.load` requires the region grid to be isotropic at `atlas_spacing_mm` within a tolerance of $10^{-4}$ relative, and the set of labels present to equal exactly the published labels (every PAM50 index + 1 but the unresolved ones), failing otherwise. On CDMD the grid's affine steps ±0.5 mm. `levels` names the vertebral levels SCT labelled (C1 to C7 and T1 to T12 as `1`–`7`, `8`–`19`).

### 6. Name and mesh the regions

The 17 structures in `config/model.yaml` `structures` each pair two PAM50 regions, `[left, right]` by their index in `atlas/info_label.txt`, with a source name, an id, a family, a tissue type, a colour and English and French names and aliases. `label_table` requires every resolved PAM50 region to be named once; `describer` writes each region record: id `pam50:<hemisphere>:<id>`, source label id (PAM50's own index), `volume_label` (the stored value), kind `structure`, `supplemental: true`, `mri_registered: true`, the tissue, the names, the family and its order, the aliases and the note below.

| Family | Structures (each left and right) |
| :--- | :--- |
| Dorsal columns | Gracile fasciculus, cuneate fasciculus |
| Lateral funiculus | Lateral corticospinal, ventral spinocerebellar, rubrospinal and spinal lemniscus tracts |
| Ventral funiculus | Spino-olivary, ventrolateral reticulospinal, lateral vestibulospinal, ventral reticulospinal, ventral corticospinal, tectospinal and medial reticulospinal tracts, medial longitudinal fasciculus |
| Grey matter | Ventral horn, intermediate zone, dorsal horn |

Ascending tracts are drawn blue, descending red and grey matter brown, with steps that separate neighbours that touch. The 34 regions are meshed by `build_structure_layer` exactly as the aseg solids are (marching cubes at 0.5, then Taubin smoothing for 16 iterations bounded to 0.6 mm, pulled back wherever it would cross a voxel centre; see [Internal anatomy](internal-anatomy.md#4-bounded-display-smoothing)), into `spinal-cord.glb`. `spinal_cord.layer` records the layer: label, citations, licence, attribution, vertebral levels and the bounding box of the atlas grid, which bounds every surface.

The cord's note, shown on every region, reads that this is the brain's own cord segmented from its T1 with the Spinal Cord Toolbox, that the tracts and grey matter are the PAM50 atlas registered to it because the 1 mm scan does not resolve them in this person, and that it reaches C1 to C5, where the scan ends.

### 7. The medulla join

NextBrain labels no medulla below surface z of about −32 to −34 mm, while PAM50 starts at C1 (about −43.7 mm). The teaching set therefore carries a `caudal-medulla` unit, aseg's brainstem below the higher side's lowest NextBrain medulla voxel, spanning about −48.5 to −31.4 mm, so the medulla meets the cord ([Internal anatomy](internal-anatomy.md#5-unions-for-the-teaching-set)). The NextBrain detail level keeps the gap. A previously used cord had sat 11–17 mm anterior of the real cord, on the vertebral bodies, and about 20% too wide; it was removed on 2026-10-27 for this segmentation, and its 18 mm overlap had hidden the gap.

## How the viewer uses it

- The cord is a hidden layer: `BrainAtlas` loads nothing of it until it is shown, with Display's **Spinal cord** switch or <kbd>S</kbd> (`setSpinalCordVisible`). The switch is absent, not disabled, when the subject publishes no cord, and the key says why.
- `spinal-cord.glb` is drawn as solid sources through `web/src/lib/engine/tissues/solid-assets.ts` and sectioned by `solid-sections.ts`, so a section through the cord shows its tracts and grey matter (`web/src/lib/engine/model/spinal-cord.test.ts` loads the published cord and checks it).
- Region names and system names (Spinal cord / Moelle épinière) and the family each region belongs to come from the manifest records above.

## Checks

| Check | Limit | CDMD |
| :--- | :--- | :--- |
| Registered atlas's cord against SCT's segmentation, on the slices the atlas covers | Dice ≥ 0.95 (`minimum_cord_dice`) | 0.967 over 65 slices (atlas 4,463 mm³; SCT 4,608 mm³) |
| Every PAM50 region re-voxelised from its mesh | No voxel centre crossed | `misclassified_voxel_centres` 0 for all 34; 0 boundary edges |
| Display displacement | ≤ 0.6 mm | at most 0.322 mm |
| Left regions lie left of their partners | Every pair | Holds (`partner_of`: PAM50 lists each left region before its right) |
| Region set | Every resolved PAM50 region once, none other | 34 |

`cord_agreement` compares the registered atlas's cord (any labelled voxel) with SCT's segmentation, point by point on the segmentation's grid; because the atlas starts at C1, only the slices it covers are compared. The tests refuse a cord short of the Dice floor, a structure list that misses a PAM50 region, check that each region is published once on each side and keeps the cord's anatomical arrangement, that a region's partner is the same region on the other side, and that an unresolved region counts toward the cord but takes no voxel.

## Limits

- **An atlas, not this cord's tracts.** The cord's outline and levels are this subject's, from the medulla to C5 where the scan ends; the tracts and grey matter inside it are PAM50's, registered to that outline, since a 1 mm scan of a cord about 12 mm across does not resolve them.
- **Region borders are the atlas's,** at its 0.5 mm spacing: a voxel takes the PAM50 region with the highest registered probability.
- **Lateral reticulospinal tract** is never any voxel's most probable region and is not published.
- **No nerve roots, and nothing below the scan.**
- **Cervical only.** C1 to C5 on CDMD; the scan, not the pipeline, sets the extent.
- **Licence.** PAM50 is MIT only by its host project's declaration; the repository itself states none.

## Reproduce

```bash
# Needs the Spinal Cord Toolbox 7.3 (its own installer; ~4 GB, Rosetta on Apple silicon)
export SCT_DIR=~/sct_7.3
uv run python scripts/segment_spinal_cord.py --anatomy cdmd --record

uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_spinal_cord.py
```

The segmentation takes about 10 minutes of CPU per brain. The work directory can sit on an external drive (CDMD's lives under `data/cache/sct-cdmd`).

## See also

- [Internal anatomy](internal-anatomy.md): the solids method and the caudal medulla
- [Tracts](tracts.md)
- [Validation](../pipeline/validation.md), [building](../pipeline/building.md)
- [References and licensing](../reference/references.md)
