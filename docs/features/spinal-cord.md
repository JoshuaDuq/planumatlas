# Spinal cord

The subject's own cervical cord is segmented from its T1-weighted (T1) magnetic resonance imaging (MRI) scan with the Spinal Cord Toolbox (SCT), and the PAM50 white-matter and grey-matter atlas is registered to it and drawn as solids from the medulla to the fifth cervical vertebral level, C5 (Fig. 1a). On sub_013 of the MGH Connectome Diffusion Microstructure Dataset (CDMD) the cord carries 34 regions: 14 tracts and 3 grey-matter regions, each left and right. The outline and vertebral levels are this cord's (Fig. 1b). The regions inside it are the atlas's, because a 1 mm scan of a cord about 12 mm across does not resolve them: each voxel of a 0.5 mm grid round the cord takes its most probable atlas region (Fig. 1c).

```{figure} figures/spinal-cord-1-light.webp
:alt: Four panels on black. a, the brainstem, cerebellum and a long striped cervical cord seen from the front. b, a sagittal cut through the lower cerebellum, the brainstem and the length of the cord, whose tracts run as blue, brown and red bands. c, the cord cut across and seen from above, its cut face divided into blue, red and brown regions. d, the same cut face in the light grey of the T1 scan.
:name: fig-spinal-cord-1

**The cord's tracts and grey matter, registered from PAM50 at 0.5 mm, are drawn as solids below the brainstem.** **a**, [The cord](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&cord=1&cortex=0&cam=-4,-62,-210,-4,-62,22,0,1,0) below the teaching-set brainstem and cerebellum, seen from the front with the cortex hidden. Ascending tracts are blue, descending tracts red and grey matter brown. **b**, [Sagittal cut](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&cord=1&cut=sagittal&pos=-4&view=right&cam=150,-62,22,-4,-62,22) at x = −4 mm, seen from the right, through the lower cerebellum, the brainstem and the cord, which reaches C1–C5, where the scan ends. **c**, [The cord alone, cut axially](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&cord=1&cortex=0&system=Spinal+cord&cut=axial&pos=-87&cam=-4,-63,24.5,-4,-87,24.5,0,0,-1) at z = −87 mm (C3) and seen from above (anterior up, the subject's left on the image's left). Each region is PAM50's most probable region per 0.5 mm voxel. **d**, [The same cut](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&cord=1&cortex=0&system=Spinal+cord&cut=axial&pos=-87&cam=-4,-63,24.5,-4,-87,24.5,0,0,-1&colors=mri) with **Colour** set to **T1 MRI**, under which the caps take the scan's grey. CDMD `sub_013`; surface RAS millimetres. Scale bars apply at the depth of the camera's target.
```

## Data

| Input | Version and pin |
| :--- | :--- |
| `data/cdmd/input/sub_013_t1w.nii.gz`, CDMD sub_013's defaced 1 mm T1 (176 × 220 × 220), the scan FreeSurfer reconstructs | sha256 `16e91371…730b` (`config/model.yaml` `input_sha256`) |
| Spinal Cord Toolbox (SCT; De Leener et al. 2017), LGPL-3.0, at `~/sct_7.3` or `$SCT_DIR` | 7.3; `spinalcordtoolbox/version.txt` must read `7.3` |
| Contrast-agnostic cord model `model_seg_sc_contrast_agnostic_nnunet` (Bédard et al. 2025), release v3.0 | extracted-tree sha256 `603f00b7…020e` |
| PAM50 template (De Leener et al. 2018) and white-matter atlas (Lévy et al. 2015), release r20250730 | extracted-tree sha256 `4cc9cb64…1158` |

A tree hash is the sha256 over each file's relative path and sha256, sorted, skipping macOS AppleDouble files (`._name`).

The run wrote three volumes to `data/cdmd/spinal-cord/`, recorded with their inputs and procedure in `data/sources.json`. `pam50-regions.nii.gz` holds the PAM50 index + 1 per voxel on a 58 × 76 × 148 grid of 0.5 mm (35,102 labelled voxels, 4,388 mm³). `sct-cord.nii.gz` holds SCT's segmentation and `sct-levels.nii.gz` its vertebral levels, both on the T1's 1 mm grid.

Citations and licences are in [references](../reference/references.md#reference-datasets-and-tools). PAM50 is MIT as declared by its host, the SCT project 6zbyf on the Open Science Framework (OSF) (© 2014 École Polytechnique, Université de Montréal). Its repository states no licence ([licences](../reference/references.md#licences)).

## Method

### Segmentation, levels and registration

`scripts/segment_spinal_cord.py` refuses an SCT other than 7.3 or a model or template whose tree hash differs. It ran in `data/cache/sct-cdmd`, skipping any step whose output existed:

1. `sct_deepseg spinalcord` segmented the cord on the T1.
2. `sct_label_vertebrae -c t1` labelled the vertebral levels from the discs.
3. `sct_register_to_template -c t1 -ldisc <disc labels>` registered PAM50 to the cord and its discs and wrote the warp `warp_template2anat`.
4. `sct_crop_image -dilate 8x8x2` cropped the T1 to the cord's bounding box plus `crop_margin_voxels` [8, 8, 2] voxels.
5. `sct_resample -mm 0.5x0.5x0.5 -x linear` resampled the crop to `atlas_spacing_mm` = 0.5 mm, the template's spacing.
6. `sct_warp_template` wrote one probability map $p_k$ per PAM50 region, $k = 0, \dots, 35$, on that grid.

### Most probable region

Each map must lie on the grid (shape and affine). With $U = \{10, 11\}$ the unresolved regions (`unresolved.atlas`), a voxel's label is

$$\ell = \begin{cases} \arg\max_{k \notin U} p_k + 1 & \text{if } \sum_{k=0}^{35} p_k \ge 0.5 \\ 0 & \text{otherwise,} \end{cases}$$

with 0.5 = `minimum_cord_probability` (Fig. 1c). $U$ is PAM50's lateral reticulospinal tract, left and right. It counts toward the cord but takes no voxel, because it never exceeds probability 0.43 in the template (as recorded in `config/model.yaml`). On CDMD's grid it would lead in 0 left and 6 right of 35,102 cord voxels, which go to the runner-up. The published regions therefore number 34, not 36. Each volume is written as `uint8` and read back label for label.

### Placement

Every volume is placed in surface RAS (right, anterior, superior) by `nextbrain.scanner_to_surface(config) @ affine`: the scanner affine through `orig.mgz`'s transform, as for the NextBrain volume, never the file's own surface header. `spinal_cord.load` refuses a region grid whose spacing differs from 0.5 mm (relative tolerance $10^{-4}$) or whose label set is not exactly every PAM50 index + 1 outside $U$. SCT's level codes 1–7 and 8–19 are named C1–C7 (cervical) and T1–T12 (thoracic). CDMD's cord has C1–C5 (Fig. 1a,b).

### Regions and meshes

The 17 entries of `spinal_cord.structures` each pair two PAM50 regions [left, right] by `atlas/info_label.txt` index, with an id, family, tissue, colour and English and French names and aliases. `label_table` refuses a list that does not name every resolved region once. Ascending tracts are blue, descending red, grey matter brown (Fig. 1a).

| Family | Structures (each left and right) |
| :--- | :--- |
| Dorsal columns | Gracile fasciculus, cuneate fasciculus |
| Lateral funiculus | Lateral corticospinal, ventral spinocerebellar and rubrospinal tracts; spinal lemniscus |
| Ventral funiculus | Spino-olivary, ventrolateral reticulospinal, lateral vestibulospinal, ventral reticulospinal, ventral corticospinal, tectospinal and medial reticulospinal tracts; medial longitudinal fasciculus |
| Grey matter | Ventral horn, intermediate zone, dorsal horn |

Each region is meshed by `build_structure_layer` as the solids of FreeSurfer's automatic subcortical segmentation (aseg) are ([internal anatomy](internal-anatomy.md#method)): marching cubes at level 0.5 on the 0.5 mm grid, then Taubin smoothing ($\lambda = 0.5$, $\nu = 0.53$, 16 iterations). Displacement is clamped to 0.6 mm, then halved near every voxel centre that the smoothing carried across the surface, repeatedly, until no centre is crossed. The 34 meshes form `spinal-cord.glb`. Every region record has the id `pam50:<side>:<id>` and is `supplemental` and `mri_registered`. Its note says that the cord is the subject's and its regions PAM50's, and that it reaches C1–C5, where the scan ends.

### Medulla join

On CDMD the higher of the two sides of NextBrain's medulla ends at surface z = −32.0 mm (its lowest voxel centre), whereas the atlas cord's highest voxel centre is at z = −44.0 mm. The teaching set's `caudal-medulla` unit is aseg's brainstem (label 16) below that floor, z = −48.0 to −32.0 mm (voxel centres), so the medulla overlaps the cord's top ([internal anatomy](internal-anatomy.md#method)). The NextBrain detail level draws the same unit below its own medulla, so the cord is attached at every level. On NextBrain alone it would stand 10 mm below the brainstem.

## Display

The cord is a hidden layer: `spinal-cord.glb` is downloaded only when shown, by **Display** › **Show spinal cord**, the <kbd>S</kbd> key, or `cord=1` in the URL. The switch is absent for a subject that publishes no cord, and the key then reports that none is published. Cord regions are solids, so the cut plane sections them (Fig. 1c). Under **Colour** › **Tissue** their caps are painted grey for grey matter and white for tracts. Under **T1 MRI** they are kept, as MRI-registered solids, and take the scan's grey (Fig. 1d). Cord regions belong to the system **Spinal cord** (Moelle épinière), follow the hemisphere filter, and are searchable in English and French in every detail level.

The viewer draws no boundary between vertebral levels. The layer record lists the levels by name (`vertebral_levels`), and each region's note gives the cord's reach. **Linked MRI** shows the T1 through the cord without cord labels: its **Overlay** › **Segmentation** is aseg's, which has no label for the cord.

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| Registered atlas cord against SCT's segmentation, on the 1 mm slices the atlas covers (`cord_agreement`) | Dice ≥ 0.95 (`minimum_cord_dice`) | 0.967 over 65 slices (atlas 4,463 mm³, SCT 4,608 mm³) |
| A cord short of the Dice floor (floor set to 1.0) | Refused | passes |
| Every mesh re-voxelised on the region grid | No voxel centre crossed; closed | 0 misclassified centres and 0 boundary edges in all 34 |
| Display displacement | ≤ 0.6 mm | at most 0.322 mm |
| Published region set | Every resolved PAM50 index once; volume label = index + 1 | 34 regions |
| Anatomical arrangement (surface RAS centroids) | Gracile fasciculus behind ventral horn; lateral corticospinal tract farther from the midline than gracile; left centroid left of the right for each of these three structures | passes |
| Structure list missing one region | Refused | passes |
| `partner_of` | Each label's partner is the same region on the other side | passes |
| Unresolved region in `most_probable_regions` | Counts toward the cord, takes no voxel | passes |
| Caudal medulla meets the cord (`tests/test_learning.py`) | Lowest aseg brainstem voxel below the cord's highest | −48.0 mm against −44.0 mm |
| Brainstem reaches the cord (`spinal-cord.test.ts`) | At every detail level, the lowest drawn Brainstem mesh lies below the cord's highest | passes; NextBrain without the caudal medulla ends 10.0 mm above |
| Layer record (`spinal-cord.test.ts`) | One supplemental, MRI-registered system | passes |
| Search and selection (`spinal-cord.test.ts`) | A cord tract is searchable, selectable and isolatable in every detail level | passes |
| Hemisphere filter (`spinal-cord.test.ts`) | Each side of the cord follows it | passes |
| Hidden cord (`spinal-cord.test.ts`) | Neither drawn nor selectable | passes |
| Caps under tissue colouring (`spinal-cord.test.ts`) | Grey for grey matter, white for a tract | passes |
| Caps under MRI colouring (`spinal-cord.test.ts`) | Kept, and pickable from both sides of four planes | passes |
| Reset (`spinal-cord.test.ts`, ATLAS-40) | Cancels a pending show | passes |

## Limitations

The tracts and grey matter are PAM50's, registered to this cord's outline, not observed in this person. Region borders are the atlas's, at 0.5 mm: each voxel takes its most probable region. The lateral reticulospinal tract is not published.

The cord is cervical only, C1–C5 on CDMD, where the scan ends. C5 is covered for 5 mm. The cord has no nerve roots. The atlas cord starts at C1, so the 5 mm of SCT's cord above it carries no regions.

PAM50's MIT licence rests on its host project's declaration.

## Code availability

Code
: [`scripts/segment_spinal_cord.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/segment_spinal_cord.py), [`brain_model/layers/spinal_cord.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/spinal_cord.py), [`brain_model/build.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/build.py) (`build_structure_layer`), [`brain_model/surfaces/geometry.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/surfaces/geometry.py)

Configuration
: [`config/model.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/model.yaml) `spinal_cord`, `structures.smoothing`

Tests
: [`tests/test_spinal_cord.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_spinal_cord.py), `tests/test_learning.py`, `web/src/lib/engine/model/spinal-cord.test.ts`

```bash
export SCT_DIR=~/sct_7.3
uv run python scripts/segment_spinal_cord.py --anatomy cdmd --record
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_spinal_cord.py
npm test --prefix web -- spinal-cord
```

