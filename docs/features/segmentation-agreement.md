# Segmentation agreement

For the caudate, putamen, thalamus, hippocampus and amygdala, the voxels that NextBrain and FreeSurfer's aseg both label, only aseg labels, or only NextBrain labels, counted and inked on the linked MRI on aseg's 1 mm grid.

:::{list-table}
:widths: 22 78
:stub-columns: 1

* - Where in the viewer
  - The **Segmentation agreement** section of the region detail (aseg structure, NextBrain's union, or a NextBrain label in it) and **Show on linked MRI**, which inks the voxels on the scan.
* - Built by
  - [`brain_model/labels/segmentation_agreement.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/labels/segmentation_agreement.py), [`brain_model/validate_segmentation.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/validate_segmentation.py), [`brain_model/layers/learning.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/learning.py) (`combine_labels`, `expand_nextbrain`)
* - Configuration
  - [`config/model.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/model.yaml): `validation.segmentation_agreement` (`minimum_dice: 0.8`, `aseg_labels`), the anatomy's `segmentation_agreement_exceptions`
* - Source data
  - The subject's `aseg.mgz` and its own NextBrain segmentation ([Internal anatomy](internal-anatomy.md))
* - Checked by
  - Validation steps 10 and 14 ([validation](../pipeline/validation.md)); [`tests/test_segmentation_agreement.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_segmentation_agreement.py), [`tests/test_segmentation_agreement_map.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_segmentation_agreement_map.py), `web/src/lib/core/catalog/segmentation-agreement.test.ts`
:::

## What it does

Validation scores NextBrain against aseg on NextBrain's 0.4 mm grid, where part of every disagreement is aseg's 1 mm staircase: on CDMD, NextBrain's own 1 mm copy scores only 0.93–0.96 against NextBrain, and 18–33% of the voxels where the two disagree are ones where aseg matches that copy. To show the disagreement rather than the grid, the build voxelises each compared NextBrain union (caudate, putamen, thalamus, hippocampal formation, and amygdala with its transition areas, on each side) onto aseg's grid: a 1 mm voxel belongs to a union when over half of the 0.4 mm voxels that fall in it do. Each voxel of a structure is then labelled by both segmentations, by aseg only or by NextBrain only.

On CDMD the 1 mm Dice is 0.79–0.91, only 0.01–0.02 above the 0.4 mm scores, so the disagreement is mostly the methods'. aseg labels more than NextBrain for every compared structure except the thalamus; the left amygdala has 461 mm³ that only aseg labels against 125 mm³ that only NextBrain does.

The **Segmentation agreement** section, on the aseg structure, NextBrain's union or any NextBrain label in it, gives the three volumes and their Dice, and **Show on linked MRI** inks them on the scan. Neither segmentation is the reference, and agreement is not accuracy. It is also separate from [boundary certainty](boundary-certainty.md): the left amygdala is a confident NextBrain label (median winning posterior 0.975) and the structure the two agree on least.

## Data

- `mri/aseg.mgz` of the subject's FreeSurfer 8.2 reconstruction: the 1 mm reference grid (256³, spacing 1 mm), through its tkregister affine.
- The NextBrain label volume on its 0.4 mm grid in surface RAS (`nextbrain.load`).
- Compared structures, from `validation.segmentation_agreement.aseg_labels` (left / right): caudate 11 / 50, putamen 12 / 51, thalamus 10 / 49, hippocampus 17 / 53, amygdala 18 / 54. Each is paired with the teaching-set unit of the same name (`learning-anatomy.yaml`): caudate (NextBrain labels 48, 118, 393), putamen (79, 349), thalamus (53 defined labels), hippocampal formation (52) and amygdala with transition areas (14). Only source labels present in the subject contribute voxels.
- Published files: `nextbrain-compared.volume` (uint8, on aseg's grid, cropped to the compared voxels: 69 × 47 × 57 voxels from corner (96, 84, 97) of the 256³ grid on CDMD) and `segmentation-agreement.json`.

## How it was built

### 1. Score on NextBrain's grid (validation)

`validate_segmentation.segmentation_agreement`:

1. `compared_groups` expands the five learning units into left and right unions in a fixed order.
2. `combine_labels` turns the NextBrain volume into a unit-code volume.
3. aseg is carried onto NextBrain's 0.4 mm grid by nearest neighbour (`resample_nearest`; the largest shift is 0.693 mm on CDMD), so the score compares two segmentations, not two grids.
4. Dice of each unit with its aseg label, per side, must reach `minimum_dice` (0.8). An anatomy may lower one floor for one structure on one side in `segmentation_agreement_exceptions`, with the measurements that justify it; an exception the score no longer needs, or naming no score, is refused. CDMD's left amygdala has a 0.77 floor (measured 0.772).

On CDMD (Dice, left / right): caudate 0.852 / 0.864, putamen 0.888 / 0.892, thalamus 0.890 / 0.885, hippocampus 0.856 / 0.878, amygdala 0.772 / 0.830. Agreement bounds how far two segmentations differ; it does not say how far either is from the anatomy.

### 2. Voxelise each union onto aseg's grid

`voxelise(units, grid, image)`:

1. `axis_lookup` finds, for each 0.4 mm voxel, the nearest aseg voxel per axis (the grids must share axis directions and be unskewed beyond 0.01 voxel); a 0.4 mm voxel off aseg's grid takes cell −1, and a compared unit lying off the grid stops the build.
2. `size` counts the 0.4 mm voxels in each aseg cell (all of them, unlabelled included).
3. For each unit code, `hits` counts that unit's 0.4 mm voxels per cell, and the cell takes the code where `2 × hits > size`, strictly over half. A tie at exactly half changes the 0.93–0.96 floor by less than 0.001.
4. The result is a `uint8` volume on aseg's grid: unit code 1 to 10 (caudate left, caudate right, putamen left, …, amygdala right), 0 elsewhere.

`encode_cropped_array` writes it as `nextbrain-compared.volume` (gzip, Fortran order, with the affine, shape, crop corner and both checksums).

### 3. Count the three categories

`structures` records, per compared structure, the unit code, structure, hemisphere, aseg label, the three region ids it gathers (the aseg structure, the learning union, the NextBrain labels present) and `count(...)`:

- `both`: voxels in the NextBrain union and the aseg label,
- `aseg_only`: aseg label voxels outside the union,
- `nextbrain_only`: union voxels outside the aseg label.

These go to `segmentation-agreement.json` with `voxel_volume_mm3` (1.0). A named region that is not published stops the build. The manifest's `segmentation_agreement` entry carries the id, file, `reference_atlas: aseg`, `compared_atlas: nextbrain`, the method text and the volume record.

### CDMD counts (1 mm voxels)

| Structure | Both | aseg only | NextBrain only | Dice (aseg grid) |
| :--- | ---: | ---: | ---: | ---: |
| Caudate, left | 2,633 | 552 | 254 | 0.867 |
| Caudate, right | 2,786 | 562 | 188 | 0.881 |
| Putamen, left | 3,957 | 655 | 206 | 0.902 |
| Putamen, right | 3,999 | 582 | 233 | 0.908 |
| Thalamus, left | 5,809 | 538 | 779 | 0.898 |
| Thalamus, right | 5,866 | 360 | 978 | 0.898 |
| Hippocampus, left | 3,234 | 852 | 95 | 0.872 |
| Hippocampus, right | 3,372 | 673 | 92 | 0.898 |
| Amygdala, left | 1,107 | 461 | 125 | 0.791 |
| Amygdala, right | 1,224 | 292 | 141 | 0.850 |

Each Dice is $2\,\text{both} / (2\,\text{both} + \text{aseg only} + \text{NextBrain only})$.

## How the viewer uses it

- [`web/src/lib/core/catalog/segmentation-agreement.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/catalog/segmentation-agreement.ts) validates the published file against the manifest regions (a code from 1 to 255, unique; the aseg region is an aseg label with the stated id; the union is a learning unit; every NextBrain id is a NextBrain region; all on the structure's side; counts non-negative integers, not all zero), finds the structure a selected region is or belongs to (`comparedStructureOf`), computes Dice (`agreementDice`) and classifies a voxel (`categoryAt`) from its aseg label and its compared code.
- `web/src/features/inspector/AgreementSection.svelte` shows the three volumes with their ink swatches and the Dice, and the **Show on linked MRI** button.
- The linked MRI (`web/src/features/sections/MprDialog.svelte`) inks one structure instead of the overlay: white (236, 236, 236) where both segmentations label it, magenta (235, 70, 210) where only aseg does, orange (255, 150, 30) where only NextBrain does. The magenta and orange stay apart under the common colour-vision deficiencies and from the cyan crosshair (#4fb6e0); blue was dropped for that reason. A key names the structure, the readout adds the crosshair voxel's category, and **Hide agreement** returns to the segmentation overlay.

## Checks

| Check | Limit | CDMD |
| :--- | :--- | :--- |
| NextBrain against aseg on the 0.4 mm grid (step 10) | Dice ≥ 0.8, or a documented floor | 0.772–0.892; left amygdala 0.772 against its 0.77 floor |
| Compared volume re-voxelised point by point through the full affines rather than per axis (step 14) | Equal to the published volume | Equal |
| `segmentation-agreement.json` counts against a recount on aseg | Equal | Equal |
| Dice on aseg's grid | Reported | 0.867 / 0.881 (caudate), 0.902 / 0.908 (putamen), 0.898 / 0.898 (thalamus), 0.872 / 0.898 (hippocampus), 0.791 / 0.850 (amygdala); each 0.01–0.02 above its 0.4 mm score |
| NextBrain's own 1 mm copy against NextBrain on the 0.4 mm grid | Floor, not a limit | 0.93–0.96, the most a perfect 1 mm segmentation of the same boundary could reach there |

The validator's `revoxelise` places every 0.4 mm voxel through the full affine product, then counts per cell, so it shares no code with `voxelise`. The tests cover the over-half rule, the revoxelisation on any labels and axes, a unit off aseg's grid being refused, and the three-way counts. Validation names the module `agreement_map` where it imports it, because `validate_segmentation` already has a function of the same name.

## Limits

- Neither segmentation is the reference, and agreement between two segmentations of one scan is not accuracy.
- It is separate from [boundary certainty](boundary-certainty.md): the left amygdala is a confident NextBrain label and the structure the two agree on least. Its disagreement is the anterior-medial boundary: of the 470 mm³ only aseg calls left amygdala on the 0.4 mm grid, NextBrain leaves 146 mm³ unlabelled and gives the rest to entorhinal cortex, forebrain white matter and temporal pole, among others ([Internal anatomy](internal-anatomy.md#checks)).
- Five structures per side only.
- A 0.4 mm three-category map would colour about a quarter of its rim for voxel size alone, which is why the display is on aseg's 1 mm grid; the published validation Dice is not changed to get it.

## Reproduce

```bash
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_segmentation_agreement.py tests/test_segmentation_agreement_map.py
```

## See also

- [Internal anatomy](internal-anatomy.md)
- [Boundary certainty](boundary-certainty.md)
- [Linked MRI](linked-mri.md)
- [Validation](../pipeline/validation.md)
