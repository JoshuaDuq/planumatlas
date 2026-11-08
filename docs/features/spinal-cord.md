# Spinal cord

The subject's own cervical cord is segmented from its T1 with the Spinal Cord Toolbox (SCT), and the PAM50 white-matter and grey-matter atlas is registered to it and drawn as solids from the medulla to C5. On CDMD sub_013 the cord carries 34 regions: 14 tracts and 3 grey-matter regions, each left and right. The outline and vertebral levels are this cord's; the regions inside it are the atlas's, because a 1 mm scan of a cord about 12 mm across does not resolve them.

```{figure} figures/spinal-cord-1.webp
:alt: Four panels. Top left, the brainstem, cerebellum and a long striped cervical cord seen from the front on a dark ground. Top right, a sagittal grey MRI with the cord coloured in five bands labelled C1 to C5, a white outline and a red outline along it, and a dashed line across C3. Bottom left, a cord cut across and seen from above, its cut face divided into blue, red and brown regions. Bottom right, the same cross-section on a blocky grey MRI, coloured by the same regions inside a white stepped outline.
:name: fig-spinal-cord-1

**The cord's outline and levels come from the subject's T1; its tracts and grey matter come from PAM50 at 0.5 mm.** **a**, Anterior view of the cord below the teaching-set brainstem and cerebellum, cortex hidden; ascending tracts blue, descending red, grey matter brown. **b**, Sagittal T1 at surface x = −4 mm (anterior left): SCT's vertebral levels C1–C5 (colour fill), SCT's cord segmentation (white outline) and the registered atlas's cord (red outline), which begins at C1; the dashed line marks z = −87 mm. **c**, The cord alone, cut axially at z = −87 mm (C3) and seen from above (anterior up, subject left on the left). **d**, The same plane sampled from the published volumes: PAM50's most probable region per 0.5 mm voxel over the 1 mm T1, with SCT's segmentation in white. CDMD sub_013; surface RAS millimetres. Scale bars: 20 mm (**a**), 10 mm (**b**), 2 mm (**c**, **d**).
```

## Data

| Input | Version and pin |
| :--- | :--- |
| `data/cdmd/input/sub_013_t1w.nii.gz`, CDMD sub_013's defaced 1 mm T1 (176 × 220 × 220), the scan FreeSurfer reconstructs | sha256 `16e91371…730b` (`config/model.yaml` `input_sha256`) |
| Spinal Cord Toolbox (SCT; De Leener et al. 2017), LGPL-3.0, at `~/sct_7.3` or `$SCT_DIR` | 7.3; `spinalcordtoolbox/version.txt` must read `7.3` |
| Contrast-agnostic cord model `model_seg_sc_contrast_agnostic_nnunet` (Bédard et al. 2025), release v3.0 | extracted-tree sha256 `603f00b7…020e` |
| PAM50 template (De Leener et al. 2018) and white-matter atlas (Lévy et al. 2015), release r20250730 | extracted-tree sha256 `4cc9cb64…1158` |

A tree hash is the sha256 over each file's relative path and sha256, sorted, skipping macOS AppleDouble files (`._name`). The run writes three volumes to `data/cdmd/spinal-cord/`, recorded with their inputs and procedure in `data/sources.json`: `pam50-regions.nii.gz` (PAM50 index + 1 per voxel on a 58 × 76 × 148 grid of 0.5 mm; 35,102 voxels, 4,388 mm³), `sct-cord.nii.gz` (SCT's segmentation) and `sct-levels.nii.gz` (its vertebral levels), the last two on the T1's 1 mm grid. Citations and licences are in [references](../reference/references.md#reference-datasets-and-tools); PAM50 is MIT as declared by its host, the SCT OSF project 6zbyf (© 2014 École Polytechnique, Université de Montréal), and its repository states no licence ([licences](../reference/references.md#licences)).

## Method

### Segmentation, levels and registration
`scripts/segment_spinal_cord.py` refuses an SCT other than 7.3 or a model or template whose tree hash differs, then runs in `data/cache/sct-cdmd`, skipping a step whose output exists:

1. `sct_deepseg spinalcord`: the cord segmentation.
2. `sct_label_vertebrae -c t1`: vertebral levels from the discs.
3. `sct_register_to_template -c t1 -ldisc <disc labels>`: PAM50 registered to the cord and its discs (`warp_template2anat`).
4. `sct_crop_image -dilate 8x8x2`: the T1 cropped to the cord's bounding box plus `crop_margin_voxels` [8, 8, 2] voxels.
5. `sct_resample -mm 0.5x0.5x0.5 -x linear`: the crop at `atlas_spacing_mm` = 0.5 mm, the template's spacing.
6. `sct_warp_template`: one probability map $p_k$ per PAM50 region, $k = 0, \dots, 35$, on that grid.

### Most probable region
Each map must lie on the grid (shape and affine). With $U = \{10, 11\}$ the unresolved regions (`unresolved.atlas`), a voxel's label is

$$\ell = \begin{cases} \arg\max_{k \notin U} p_k + 1 & \text{if } \sum_{k=0}^{35} p_k \ge 0.5 \\ 0 & \text{otherwise,} \end{cases}$$

with 0.5 = `minimum_cord_probability`. $U$ is PAM50's lateral reticulospinal tract, left and right. It counts toward the cord but takes no voxel: it never exceeds probability 0.43 in the template (as recorded in `config/model.yaml`), and on CDMD's grid it would lead in 0 left and 6 right of 35,102 cord voxels, which go to the runner-up. Hence 34, not 36, published regions. Each volume is written as `uint8` and read back label for label.

### Placement
Every volume is placed in surface RAS by `nextbrain.scanner_to_surface(config) @ affine`: the scanner affine through `orig.mgz`'s transform, as for the NextBrain volume, never the file's own surface header. `spinal_cord.load` refuses a region grid whose spacing differs from 0.5 mm (relative tolerance $10^{-4}$) or whose label set is not exactly every PAM50 index + 1 outside $U$. SCT's level codes 1–7 and 8–19 are named C1–C7 and T1–T12; CDMD's cord has C1–C5.

### Regions and meshes
The 17 entries of `spinal_cord.structures` each pair two PAM50 regions [left, right] by `atlas/info_label.txt` index, with an id, family, tissue, colour and English and French names and aliases; `label_table` refuses a list that does not name every resolved region once. Ascending tracts are blue, descending red, grey matter brown.

| Family | Structures (each left and right) |
| :--- | :--- |
| Dorsal columns | Gracile fasciculus, cuneate fasciculus |
| Lateral funiculus | Lateral corticospinal, ventral spinocerebellar and rubrospinal tracts; spinal lemniscus |
| Ventral funiculus | Spino-olivary, ventrolateral reticulospinal, lateral vestibulospinal, ventral reticulospinal, ventral corticospinal, tectospinal and medial reticulospinal tracts; medial longitudinal fasciculus |
| Grey matter | Ventral horn, intermediate zone, dorsal horn |

Each region is meshed by `build_structure_layer` as the aseg solids are ([internal anatomy](internal-anatomy.md#method)): marching cubes at level 0.5 on the 0.5 mm grid, then Taubin smoothing ($\lambda = 0.5$, $\nu = 0.53$, 16 iterations) with displacement clamped to 0.6 mm and halved near any voxel centre it carried across the surface until none is. The 34 meshes form `spinal-cord.glb`; every region record is `pam50:<side>:<id>`, `supplemental` and `mri_registered`, with a note that the cord is the subject's and its regions PAM50's and that it reaches C1–C5, where the scan ends.

### Medulla join
NextBrain labels no medulla below surface z = −32.0 mm on CDMD, whereas the atlas cord's highest voxel centre is at z = −44.0 mm. The teaching set's `caudal-medulla` unit is aseg's brainstem (label 16) below that floor, z = −48.0 to −32.0 mm (voxel centres), so the medulla overlaps the cord's top ([internal anatomy](internal-anatomy.md#method)). The NextBrain detail level keeps the gap.

## Display
The cord is a hidden layer: `spinal-cord.glb` is downloaded only when shown, by Display › **Show spinal cord**, the <kbd>S</kbd> key, or `cord=1` in the URL. The switch is absent for a subject that publishes no cord, and the key then reports that none is published. Cord regions are solids: they are sectioned by the cut plane, their caps painted grey for grey matter and white for tracts under tissue colouring and kept, as MRI-registered solids, under MRI colouring. They belong to the system **Spinal cord** (Moelle épinière), follow the hemisphere filter, and are searchable in English and French in every detail level.

## Validation
| Test | Criterion | Result |
| :--- | :--- | :--- |
| Registered atlas cord against SCT's segmentation, on the 1 mm slices the atlas covers (`cord_agreement`) | Dice ≥ 0.95 (`minimum_cord_dice`) | 0.967 over 65 slices (atlas 4,463 mm³, SCT 4,608 mm³) |
| A cord short of the Dice floor (floor set to 1.0) | Refused | passes |
| Every mesh re-voxelised on the region grid | No voxel centre crossed; closed | 0 misclassified centres and 0 boundary edges in all 34 |
| Display displacement | ≤ 0.6 mm | at most 0.322 mm |
| Published region set | Every resolved PAM50 index once; volume label = index + 1 | 34 |
| Anatomical arrangement (surface RAS centroids) | Gracile fasciculus behind ventral horn; lateral corticospinal tract farther from the midline than gracile; each left centroid left of its right | passes |
| Structure list missing one region | Refused | passes |
| `partner_of` | Each label's partner is the same region on the other side | passes |
| Unresolved region in `most_probable_regions` | Counts toward the cord, takes no voxel | passes |
| Caudal medulla meets the cord | Lowest aseg brainstem voxel below the cord's highest | −48.0 mm against −44.0 mm |
| Viewer (`spinal-cord.test.ts`) | One supplemental, MRI-registered system; searchable, selectable and isolatable in every detail level; hidden cord neither drawn nor selectable; caps grey or white; caps pickable from both sides of four planes under MRI colouring; reset cancels a pending show | passes |

## Limitations
- The tracts and grey matter are PAM50's, registered to this cord's outline, not observed in this person.
- Region borders are the atlas's, at 0.5 mm: each voxel takes its most probable region.
- The lateral reticulospinal tract is not published.
- Cervical only, C1–C5 on CDMD, where the scan ends; C5 is covered for 5 mm. No nerve roots.
- The atlas cord starts at C1, so the 5 mm of SCT's cord above it carries no regions.
- PAM50's MIT licence rests on its host project's declaration.

## Code availability

| | |
| :--- | :--- |
| Code | [`scripts/segment_spinal_cord.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/segment_spinal_cord.py), [`brain_model/layers/spinal_cord.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/spinal_cord.py), [`brain_model/build.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/build.py) (`build_structure_layer`), [`brain_model/surfaces/geometry.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/surfaces/geometry.py) |
| Configuration | [`config/model.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/model.yaml) `spinal_cord`, `structures.smoothing` |
| Tests | [`tests/test_spinal_cord.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_spinal_cord.py), `tests/test_learning.py`, `web/src/lib/engine/model/spinal-cord.test.ts` |

```bash
export SCT_DIR=~/sct_7.3
uv run python scripts/segment_spinal_cord.py --anatomy cdmd --record
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_spinal_cord.py
npm test --prefix web -- spinal-cord
```

Figure state (Fig. 1a): https://planumatlas.com/#anatomy=cdmd&cord=1&cortex=0&cam=-4,-62,-210,-4,-62,22,0,1,0; (Fig. 1c): https://planumatlas.com/#anatomy=cdmd&cord=1&cortex=0&system=Spinal%20cord&cut=axial&pos=-87&cam=-4,-63,24.5,-4,-87,24.5,0,0,-1. Panels **b** and **d** sample the three published volumes in surface RAS.
