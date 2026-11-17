# Arousal nuclei

The Harvard Ascending Arousal Network Atlas 2.0 traces ten brainstem nuclei that sustain wakefulness: dorsal and median raphe, locus coeruleus, laterodorsal and pedunculotegmental nuclei, mesencephalic reticular formation, periaqueductal grey, parabrachial complex, pontis oralis and ventral tegmental area. Planum places them on CDMD and lists them under Brainstem, as **Arousal nuclei (Harvard atlas)**, only if they pass checks fixed before the run. Two ways of placing them were measured against the same checks.

**Status (2026-11-17): published from SegmentAAN, with one disclosed exception.** SegmentAAN places the three nuclei NextBrain also labels within 1.3 mm. The containment check, fixed before the runs against aseg's Brain-Stem alone, failed for both methods because aseg puts the ventral midbrain in VentralDC; it was redefined as Brain-Stem and VentralDC (decision 0013) and applied once to the unchanged outputs. SegmentAAN's periaqueductal grey still fell short, 90.7 % inside, with 9.0 % in the 4th-Ventricle label that covers the aqueduct it surrounds. After seeing that result, the maintainer accepted it under a named exception for that nucleus alone (90 %; decision 0014). Both changes were made after results were seen, which departs from Planum's standard of a bar fixed in advance; the periaqueductal grey's own region sheet states the exception and its measured share, and every result is kept below.

## Data

Harvard Ascending Arousal Network Atlas 2.0 (Edlow and Kinney 2023), Dryad [doi:10.5061/dryad.zw3r228d2](https://doi.org/10.5061/dryad.zw3r228d2), version 245119 (2023-07-18), CC0 1.0. Version 1.0: Edlow et al. 2012 ([doi:10.1097/NEN.0b013e3182588293](https://doi.org/10.1097/NEN.0b013e3182588293)); version 2.0's histology: Edlow et al. 2024 ([doi:10.1126/scitranslmed.adj4303](https://doi.org/10.1126/scitranslmed.adj4303)).

The masks were traced by hand in FSL's MNI152 at 1 mm from histology and ex-vivo MRI of other brains. Dryad serves its files only to a browser or to an API token, so the archive `doi_10_5061_dryad_zw3r228d2__v20230718.zip` (187,763,635 bytes, sha256 `289ffa726dfc…`) was downloaded by hand and unzipped into `data/cache/arousal-nuclei/`. `scripts/register_arousal_nuclei.py check` verifies each of the 18 files used against the SHA-256 Dryad's API lists, and prints the download instruction when one is missing; it never downloads. The API's full listing of the 25 files is kept beside them as `dryad-file-list.json`.

| File | Role |
| :--- | :--- |
| `AAN_Brainstem_MNI152_1mm_v2p0.nii` | All nuclei in one label volume (codes 7201–7204 midline, 7301–7306 left, 7401–7406 right) |
| `AAN_Brainstem_v2p0_Color_LUT_FreeSurfer.txt` | Codes, names and colours |
| `AAN_<nucleus>[_L/_R]_MNI152_1mm_v2p0.nii` | One binary mask per nucleus and side (16 used) |

Two faults in the release, both handled and checked:

- **PTg.** `AAN_PTg_L_MNI152_1mm_v2p0.nii` is byte for byte the bilateral `AAN_PTg_MNI152_1mm_v2p0.nii` (sha256 `0ded8461…`): it holds both sides, 184 voxels, of which the right file's 92 are the right nucleus. The left pedunculotegmental nucleus is the left file less the right one, 92 voxels, which equals the combined volume's Left-PTg (7306) exactly.
- **DR and PAG overlap.** Two voxels lie in both the dorsal raphe and the periaqueductal grey masks; the combined volume gives them to the PAG, and so does Planum.

The per-side masks, built this way, rebuild the release's combined volume voxel for voxel; the script stops if they do not. The release is stored as FSL stores MNI152, with x running right to left; it is resampled onto TemplateFlow's left-to-right copy of the same grid by world position, every nucleus keeping its voxel count and centroid.

## Method

### Template registration (SynthMorph)
`scripts/register_arousal_nuclei.py synthmorph`, modelled on the striatal networks' registration:

1. FSL's MNI152 (MNI152NLin6Asym, TemplateFlow, pinned as `config/striatal-networks.yaml` pins it), masked by its brain mask, is registered to CDMD's `mri/brain.mgz` with `mri_synthmorph register -m joint -j 8` (joint affine and deformable; Hoffmann et al. 2024, [doi:10.1162/imag_a_00197](https://doi.org/10.1162/imag_a_00197)).
2. The release's labels, on the template grid, are carried onto aseg's 1 mm grid with `mri_synthmorph apply -m nearest`.

It ran once, alone: 7.6 minutes on the CPU, peak resident memory 6.48 GB.

### FreeSurfer SegmentAAN
FreeSurfer 8.2's `SegmentAAN.sh` (Olchanyi et al. 2025, [doi:10.1002/hbm.70357](https://doi.org/10.1002/hbm.70357)) segments the same ten nuclei, with the same 16 sided labels, from this brain's own recon by Bayesian inference against a histology-derived probabilistic atlas, at 0.375 mm. It reads `norm.mgz`, `wmparc.mgz`, `aseg.mgz` and `talairach.xfm` from the full FreeSurfer 8.2 recon of CDMD (`data/cache/freesurfer-subjects/cdmd`), copied so that its outputs never land in the recon; its labels are mapped to the release's codes. FreeSurfer ships it as an x86_64 program compiled against the MATLAB Runtime R2019b (9.7), which a full MATLAB of another version cannot stand in for. Its segmentation of a CC0 subject may be published under the FreeSurfer Software License (Part B: use, derivative works and distribution allowed with the licence, attributions kept, no endorsement implied), which Planum already publishes beside the model.

It ran once, alone, on 2026-11-17: under 2 minutes of the coordinator's wall clock, peak resident memory 3.02 GB.

### Checks, fixed before the run (2026-11-16)
Measured by `arousal_nuclei.checks` on each method's nuclei before they are kept to the brainstem:

- **Placement.** Three nuclei are also labelled by this brain's own NextBrain segmentation, each side apart, so both sides are taken together: the carried dorsal raphe, ventral tegmental area and periaqueductal grey must each have a centroid within 3 mm of NextBrain's `dorsal_raphe_nucleus`, `ventral_tegmental_area` and `periaqueductal_gray_substance`. Dice is reported, on NextBrain's 0.4 mm grid.
- **Containment.** At least 95% of every one of the 16 sided nuclei must lie in aseg's Brain-Stem (label 16), sampled at each voxel centre. Revised on 2026-11-17, after both methods failed it and before it was applied again, to Brain-Stem and Left- and Right-VentralDC (labels 16, 28, 60): aseg labels the ventral midbrain, where the VTA lies, VentralDC (decision 0013, `web/docs/decisions/0013-arousal-nuclei-containment.md`). Ventricles stay outside.
- **Choice.** Among methods that pass both, the smaller mean centroid distance over the three wins; a difference under 0.25 mm goes to the higher mean Dice. If none passes, nothing is published.

A passing method's nuclei are then kept to aseg's Brain-Stem and VentralDC (`keep`; the grey loses the rim that lay in the aqueduct's label), meshed as the other structures are (marching cubes, bounded Taubin smoothing that moves no voxel centre across the surface) and published as the supplemental layer `aan` (`arousal-nuclei.glb`), each nucleus a selectable structure with its own cut label.

## Validation

| Check | Limit | SynthMorph | SegmentAAN |
| :--- | :--- | :--- | :--- |
| Dorsal raphe, centroid to NextBrain | ≤ 3 mm | **3.67 mm** (Dice 0.22) | 1.23 mm (Dice 0.25) |
| Periaqueductal grey, centroid to NextBrain | ≤ 3 mm | 1.29 mm (Dice 0.51) | 0.44 mm (Dice 0.72) |
| Ventral tegmental area, centroid to NextBrain | ≤ 3 mm | **5.00 mm** (Dice 0.03) | 1.20 mm (Dice 0.15) |
| Least share of a nucleus inside the brainstem | ≥ 95% | **28.9%** (VTA); PAG 82.7%, DR 96.8%, left PTg 98.4%, the other 12 100% | **3.0%** (VTA); right PTg 53.6%, left PTg 65.0%, PAG 89.6%, the other 12 at least 98.6% |
| Passes | | no | no |
| *Revised (decision 0013):* least share inside Brain-Stem and VentralDC | ≥ 95% | **82.7%** (PAG, 17.3% in 4th-Ventricle); DR 96.8% | **90.7%** (PAG, 9.0% in 4th-Ventricle); every other nucleus at least 98.8% |
| Passes, revised | | no | no |
| *With the periaqueductal grey's exception (decision 0014):* grey ≥ 90 %, every other nucleus ≥ 95 % | | no (centroids) | **yes: published** |

Where SynthMorph's placement falls short:

- **VTA.** 229 of its 322 carried voxels lie in aseg's left and right VentralDC, which aseg extends into the ventral midbrain; 93 lie in Brain-Stem. Its centroid lies 4.6 mm posterior and 1.9 mm inferior to NextBrain's, whose VTA is 182 mm³ to the Harvard mask's 322 mm³ (version 2.0 adds the parabrachial pigmented wings and the whole rostro-caudal extent).
- **PAG.** 51 of 294 voxels lie in the aqueduct, which aseg labels 4th-Ventricle.
- **DR.** The offset is almost wholly inferior (3.67 mm): the Harvard dorsal raphe (221 mm³ here) runs further caudally than NextBrain's (92 mm³).

SegmentAAN's centroids are the closer (mean 0.96 mm against 3.32 mm; mean Dice 0.37 against 0.26), but containment fails for a reason it shares with the registration: aseg labels most of the ventral midbrain, where the VTA and the pedunculotegmental nuclei lie, VentralDC, and the aqueduct inside the PAG 4th-Ventricle. The check was fixed before either run and is not changed after it; whether a containment check against aseg's Brain-Stem alone suits nuclei at the midbrain's ventral edge is a question for the maintainer, to be fixed before any new run.

The registered volumes are smaller than the template's (the DR 221 of 324 voxels, the VTA 322 of 488), as expected of a brain smaller than MNI152.

## Display

Once a method passes, each nucleus is a supplemental structure (`aan:<side>:<nucleus>`), drawn at every detail level and listed in the Anatomy tree under Brainstem below a caption row **Arousal nuclei (Harvard atlas)** (French **Noyaux de l’éveil (atlas de Harvard)**; ANAT-60), apart from NextBrain's namesakes. Its layer downloads the first time a nucleus is chosen, opened or linked, or a cut is made (STATE-71, CTRL-40, ATLAS-55), and each nucleus caps its own cut face. The Coma profile's tegmental finding, whose overlap covered the raphe, locus coeruleus, laterodorsal tegmental nucleus, pontis oralis and parabrachial nucleus, then maps to those nuclei. The lesson walking the ten (plan 1's WP9) does not exist yet.

## Limitations

- Masks drawn on a template from histology and ex-vivo MRI of other brains, placed here by registration (or by SegmentAAN's segmentation against a histological atlas). They are not this person's nuclei.
- The nuclei are a millimetre or two across: a mask marks about where a nucleus lies, not its outline in this person.
- Not probabilistic: each voxel is in a nucleus or not.
- NextBrain labels only three of the ten, and defines them differently; a low Dice against it is expected, and the other seven have no independent check on this brain.
- aseg's Brain-Stem excludes the ventral midbrain (VentralDC) and the aqueduct, so the first containment check could not be met by a VTA placed where the atlas draws it; the check was redefined after the runs (decision 0013).
- The periaqueductal grey lay 90.7 % inside the brainstem and VentralDC, below the 95 % the other nuclei met; most of the rest fell in aseg's label for the aqueduct it surrounds and was removed. It is published under an exception made after the checks were run (decision 0014).

## Code availability

Code
: [`scripts/register_arousal_nuclei.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/register_arousal_nuclei.py) (source check, both methods, choice), [`brain_model/layers/arousal_nuclei.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/arousal_nuclei.py) (checks, keep, regions, layer record, validation)

Configuration
: [`config/arousal-nuclei.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/arousal-nuclei.yaml) (pins, nuclei, checks, choice rule); the `arousal_nuclei` layer in the anatomy's `layers` list in `config/model.yaml` once a method passes

```bash
uv run python scripts/register_arousal_nuclei.py check
uv run python scripts/register_arousal_nuclei.py synthmorph      # FreeSurfer 8.2
uv run python scripts/register_arousal_nuclei.py segment-aan     # FreeSurfer 8.2 with MCRv97
uv run python scripts/register_arousal_nuclei.py publish --record
```
