# Segmentation agreement

Segmentation agreement compares NextBrain with FreeSurfer's aseg for five structures per hemisphere: caudate, putamen, thalamus, hippocampus and amygdala. Both segmentations come from the same 1 mm T1 of CDMD `sub_013`. Each NextBrain union is voxelised onto aseg's 1 mm grid. Every voxel is then counted as labelled by both segmentations, by aseg only or by NextBrain only, and the counts are inked on the linked MRI (magnetic resonance image). Neither segmentation is the reference, and agreement is not accuracy.

```{figure} figures/segmentation-agreement-1.webp
:alt: Two zoomed coronal T1 sections. The left amygdala is white where both segmentations agree, with a broad magenta rim on its medial side labelled only by aseg. The left thalamus is mostly white, with an orange band below it labelled only by NextBrain. Below them, a dot plot gives three Dice values for each of ten structures.
:name: fig-segmentation-agreement-1

**On aseg's grid the remaining disagreement is the methods', not the voxel size.** **a**, Left amygdala, coronal plane at surface RAS (right-anterior-superior) y = 10 mm, x from −8 mm (medial, left edge) to −38 mm, z from −8 to 22 mm. Its anterior-medial part is labelled by aseg only (magenta). **b**, Left thalamus at y = −16 mm, x from 0 to −30 mm, z from 6 to 36 mm. Its inferior border is labelled by NextBrain only (orange). Inks are the viewer's: both (236, 236, 236), aseg only (235, 70, 210) and NextBrain only (255, 150, 30), over a darkened `brain.mgz` at 1 mm. The scale bar is 10 mm. **c**, Dice per structure. Blue: NextBrain against aseg on NextBrain's 0.4 mm grid (validation). Orange: the same comparison on aseg's 1 mm grid (`segmentation-agreement.json`). Green: NextBrain against its own 1 mm voxelisation carried back to 0.4 mm, the highest score a perfect 1 mm segmentation of the same boundary could reach there. The dashed line marks the 0.8 floor. All panels were rendered from the repository data, not from the viewer.
```

## Data

| Input | Content |
| :--- | :--- |
| aseg | `mri/aseg.mgz` of the FreeSurfer 8.2 reconstruction: 256³ voxels, 1 mm, surface RAS through its tkregister matrix |
| NextBrain | the subject's labels on their 0.4 mm grid in surface RAS (`nextbrain.load`; see [internal anatomy](internal-anatomy.md#method)) |
| Compared structures | `validation.segmentation_agreement.aseg_labels` (left / right): caudate 11 / 50, putamen 12 / 51, thalamus 10 / 49, hippocampus 17 / 53, amygdala 18 / 54. Each is paired with the teaching unit of the same name in `config/learning-anatomy.yaml`: caudate (NextBrain labels 48, 118, 393), putamen (79, 349), thalamus (53 labels), hippocampal formation (52) and amygdala with transition areas (14). Only labels present on a side contribute. |
| Published | `nextbrain-compared.volume` (uint8 on aseg's grid, cropped to 69 × 47 × 57 voxels from corner (96, 84, 97)) and `segmentation-agreement.json` |

## Method

### Score on NextBrain's grid

`validate_segmentation.segmentation_agreement` expands the five units into ten left and right unions and codes them with `combine_labels`. It carries aseg onto the 0.4 mm grid by nearest neighbour; the largest shift on CDMD is 0.693 mm. The score is Dice:

$$D = \frac{2\,\lvert N \cap A \rvert}{\lvert N \rvert + \lvert A \rvert}.$$

Each score must reach `minimum_dice` (0.8). An anatomy may lower the floor for one structure on one side in `segmentation_agreement_exceptions`, stating the measurements that justify it. An exception the score no longer needs, or one that names no score, is refused. CDMD's left amygdala has a floor of 0.77 (measured 0.772).

On this grid part of every disagreement is aseg's 1 mm staircase. NextBrain against its own 1 mm voxelisation scores only 0.927–0.958 (Fig. 1c). Of the 0.4 mm voxels where NextBrain and aseg disagree, 18–32% are voxels where aseg matches that 1 mm copy. These two figures were computed from the published volume and the source labels; validation does not record them.

### Voxelisation on aseg's grid

`segmentation_agreement.voxelise` finds, for each 0.4 mm voxel, the nearest aseg voxel along each axis (`axis_lookup`). The two grids must share axis directions and be unskewed beyond 0.01 voxel. A compared unit lying off aseg's grid stops the build. For each 1 mm cell, `size` counts all 0.4 mm voxels that fall in it, unlabelled ones included, and `hits` counts those of each unit. The cell takes the unit's code where $2 \cdot \text{hits} > \text{size}$, strictly over half. The result is a uint8 volume with codes 1–10 (caudate left, caudate right, …, amygdala right) and 0 elsewhere.

### Three-way counts

For each structure, `count` gives `both` (union ∩ aseg label), `aseg_only` and `nextbrain_only` in 1 mm³ voxels. Each record names the aseg region, the teaching union and the NextBrain labels present, and a named region that is not published stops the build. On CDMD (1 mm voxels; Dice $= 2b / (2b + a + n)$):

| Structure | Both | aseg only | NextBrain only | Dice, aseg grid | Dice, 0.4 mm grid |
| :--- | ---: | ---: | ---: | ---: | ---: |
| Caudate, left | 2,633 | 552 | 254 | 0.867 | 0.852 |
| Caudate, right | 2,786 | 562 | 188 | 0.881 | 0.864 |
| Putamen, left | 3,957 | 655 | 206 | 0.902 | 0.888 |
| Putamen, right | 3,999 | 582 | 233 | 0.908 | 0.892 |
| Thalamus, left | 5,809 | 538 | 779 | 0.898 | 0.890 |
| Thalamus, right | 5,866 | 360 | 978 | 0.898 | 0.885 |
| Hippocampus, left | 3,234 | 852 | 95 | 0.872 | 0.856 |
| Hippocampus, right | 3,372 | 673 | 92 | 0.898 | 0.878 |
| Amygdala, left | 1,107 | 461 | 125 | 0.791 | 0.772 |
| Amygdala, right | 1,224 | 292 | 141 | 0.850 | 0.830 |

On aseg's grid Dice is 0.008–0.020 above the 0.4 mm score, so most of the disagreement is the methods'. aseg labels more than NextBrain for every structure except the thalamus (Fig. 1b). The left amygdala disagrees at its anterior-medial boundary (Fig. 1a). On the 0.4 mm grid, 470 mm³ is called left amygdala by aseg only. Of that, NextBrain leaves 146 mm³ unlabelled and assigns the rest to entorhinal cortex (110 mm³), forebrain white matter (97 mm³), temporal pole (69 mm³), temporal claustrum (18 mm³) and optic tract (10 mm³). NextBrain's left amygdala (1,266 mm³) is smaller than aseg's (1,497 mm³) and than its own right (1,393 mm³). It was also the smaller estimate on the FreeSurfer 6.0 reconstruction (1,246 mm³, Dice 0.793). The exception was accepted on 2026-10-24.

## Display

`web/src/lib/core/catalog/segmentation-agreement.ts` checks the published file against the manifest regions. Codes must be unique and in 1–255. The aseg region must be the stated label, the union a teaching unit and every member a NextBrain region, all on the structure's side. Counts must be non-negative and not all zero. `comparedStructureOf` finds the structure that a selected aseg structure, teaching union or member NextBrain label belongs to. The **Segmentation agreement** section of the region detail then gives the three volumes with their ink swatches and the Dice (`agreementDice`). **Show on linked MRI** inks that structure on the [linked MRI](linked-mri.md) in place of the segmentation overlay, with the inks of Fig. 1a,b and a key that names the structure. Magenta and orange stay distinct under common colour-vision deficiencies and from the cyan crosshair (#4fb6e0). **Hide agreement** restores the overlay.

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| NextBrain vs aseg on the 0.4 mm grid (`validate`) | Dice ≥ 0.8, or a documented floor | 0.772–0.892; left amygdala 0.772 against its 0.77 floor |
| Compared volume re-voxelised point by point through the full affines (`revoxelise`, sharing no code with `voxelise`) | equal to the published volume | equal |
| `segmentation-agreement.json` counts against a recount on aseg | equal | equal |
| Dice on aseg's grid | reported | 0.791–0.908 (per structure in the [method](#method) table) |
| `tests/test_segmentation_agreement.py` | Dice arithmetic; every declared structure clears its floor and equals the published score; exception rules | pass |
| `tests/test_segmentation_agreement_map.py` | over-half rule; revoxelisation equals the build on any labels and axes; a unit off aseg's grid is refused; three-way counts | pass |
| `web/src/lib/core/catalog/segmentation-agreement.test.ts` | structure lookup; refusal of a wrong atlas, label, side or repeated code; Dice and voxel category | pass |

## Limitations

- Neither segmentation is the reference. Two segmentations of one scan agreeing is not accuracy.
- Agreement is separate from [boundary certainty](boundary-certainty.md). The left amygdala is the structure the two agree on least, yet NextBrain labels it confidently.
- Only five structures per side are compared.
- On the 0.4 mm grid, 18–32% of the disagreeing voxels would be coloured for voxel size alone. The map is therefore drawn on aseg's 1 mm grid; the validation score stays on the 0.4 mm grid.

## Code availability

| | |
| :--- | :--- |
| Code | [`brain_model/labels/segmentation_agreement.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/labels/segmentation_agreement.py), [`brain_model/validate_segmentation.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/validate_segmentation.py), [`brain_model/layers/learning.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/learning.py) (`combine_labels`, `expand_nextbrain`), [`web/src/lib/core/catalog/segmentation-agreement.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/catalog/segmentation-agreement.ts) |
| Configuration | [`config/model.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/model.yaml): `validation.segmentation_agreement` (`minimum_dice: 0.8`, `aseg_labels`), the anatomy's `segmentation_agreement_exceptions` |
| Tests | [`tests/test_segmentation_agreement.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_segmentation_agreement.py), [`tests/test_segmentation_agreement_map.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_segmentation_agreement_map.py), `web/src/lib/core/catalog/segmentation-agreement.test.ts` |

```bash
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_segmentation_agreement.py tests/test_segmentation_agreement_map.py
```

Viewer state of panel a (select the left amygdala, then **Show on linked MRI**): https://planumatlas.com/#anatomy=cdmd&detail=aseg&region=aseg:left:18&cut=coronal&pos=10&view=anterior&cortex=0
