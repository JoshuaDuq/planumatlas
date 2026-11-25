# Arousal nuclei

The Harvard Ascending Arousal Network Atlas 2.0 traces ten brainstem nuclei that sustain wakefulness: dorsal raphe (DR) and median raphe, locus coeruleus, laterodorsal and pedunculotegmental (PTg) nuclei, mesencephalic reticular formation, periaqueductal grey (PAG), parabrachial complex, pontis oralis and ventral tegmental area (VTA). Planum places them on sub_013 of the MGH Connectome Diffusion Microstructure Dataset (CDMD; Fig. 1) and on the [MNI template](mni-template.md#arousal-nuclei), and lists them under **Brainstem**, as **Arousal nuclei (Harvard atlas)**, only if they pass checks fixed before the run. Two ways of placing them were measured against the same checks: registration of the atlas's template to this brain with SynthMorph, and FreeSurfer 8.2's SegmentAAN, which segments the nuclei from this brain's own reconstruction. The published nuclei are SegmentAAN's (status of 2026-11-17), after the containment check was redefined and the periaqueductal grey was given an exception, both once the results had been seen. The masks derive from histology and ex-vivo magnetic resonance imaging (MRI) of other brains, so each marks about where a nucleus lies, not its outline in this person.

```{figure} figures/arousal-nuclei-1-light.webp
:alt: Two views of sixteen small coloured brainstem nuclei on black, with nothing around them. a, from the left, a magenta and a violet nucleus in front, a red sheet and a lilac mass behind them, and blue, yellow and turquoise columns below. b, from behind, the paired nuclei side by side about the midline, red sheets either side of a central lilac mass above turquoise, blue and yellow columns.
:name: fig-arousal-nuclei-1

**The ten arousal nuclei of the Harvard atlas are drawn alone, in the colours of the atlas's lookup table.** **a**, [The 16 sided regions of the ten nuclei](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&cortex=0&system=Brainstem&view=left&cam=-110,-5,12,0,-5,12&hidden=learning:caudal-medulla,learning:left:inferior-colliculus,learning:left:medulla,learning:left:midbrain,learning:left:pons,learning:left:red-nucleus,learning:left:vta,learning:right:inferior-colliculus,learning:right:medulla,learning:right:midbrain,learning:right:pons,learning:right:red-nucleus,learning:right:vta), seen from the left (anterior to the left). The cortex is hidden, the internal anatomy is limited to **Brainstem**, and the teaching set's brainstem territories and nuclei are hidden, because the arousal nuclei lie inside them. **b**, [The same nuclei](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&cortex=0&system=Brainstem&view=posterior&cam=0,-5,122,0,-5,12&hidden=learning:caudal-medulla,learning:left:inferior-colliculus,learning:left:medulla,learning:left:midbrain,learning:left:pons,learning:left:red-nucleus,learning:left:vta,learning:right:inferior-colliculus,learning:right:medulla,learning:right:midbrain,learning:right:pons,learning:right:red-nucleus,learning:right:vta), seen from behind, with the paired nuclei side by side. CDMD `sub_013`; the published nuclei are SegmentAAN's. Both panels share one scale. Scale bars apply at the depth of the camera's target.
```

## Data

| Input | Content | Version or pin | Licence |
| :--- | :--- | :--- | :--- |
| Harvard Ascending Arousal Network Atlas 2.0 (Edlow and Kinney 2023) | Ten nuclei, traced by hand in FSL's MNI152 at 1 mm from histology and ex-vivo MRI of other brains | Dryad [doi:10.5061/dryad.zw3r228d2](https://doi.org/10.5061/dryad.zw3r228d2), version 245119 (2023-07-18); each file used by SHA-256 in `config/arousal-nuclei.yaml` | CC0 1.0 |
| FSL's MNI152 (MNI152NLin6Asym), T1-weighted image and brain mask | The template the masks are drawn in; the moving image of the registration | TemplateFlow, by SHA-256, as `config/striatal-networks.yaml` pins it | |
| CDMD reconstruction | `mri/brain.mgz` and `mri/aseg.mgz` for the registration and the checks; the full reconstruction for SegmentAAN | FreeSurfer 8.2; `data/sources.json` | CC0 subject |
| NextBrain segmentation of CDMD | Three nuclei the placement check compares, on a 0.4 mm grid | `data/sources.json` | |

Version 1.0 of the atlas is described in Edlow et al. 2012 ([doi:10.1097/NEN.0b013e3182588293](https://doi.org/10.1097/NEN.0b013e3182588293)), and the histology of version 2.0 in Edlow et al. 2024 ([doi:10.1126/scitranslmed.adj4303](https://doi.org/10.1126/scitranslmed.adj4303)).

Dryad serves its files only to a browser or to an application programming interface (API) token, so the archive `doi_10_5061_dryad_zw3r228d2__v20230718.zip` (187,763,635 bytes, sha256 `289ffa726dfc…`) was downloaded by hand and unzipped into `data/cache/arousal-nuclei/`. `scripts/register_arousal_nuclei.py check` verifies each of the 18 files used against the SHA-256 Dryad's API lists, and prints the download instruction when one is missing. It never downloads. The API's full listing of the 25 files is kept beside them as `dryad-file-list.json`.

| File | Role |
| :--- | :--- |
| `AAN_Brainstem_MNI152_1mm_v2p0.nii` | All nuclei in one label volume (codes 7201–7204 midline, 7301–7306 left, 7401–7406 right) |
| `AAN_Brainstem_v2p0_Color_LUT_FreeSurfer.txt` | Codes, names and colours |
| `AAN_<nucleus>[_L/_R]_MNI152_1mm_v2p0.nii` | One binary mask per nucleus and side (16 used) |

The release has two faults, both handled and checked. The first is in the PTg files. `AAN_PTg_L_MNI152_1mm_v2p0.nii` is byte for byte the bilateral `AAN_PTg_MNI152_1mm_v2p0.nii` (sha256 `0ded8461…`). It holds both sides, 184 voxels, of which the right file's 92 are the right nucleus. The left pedunculotegmental nucleus was therefore taken as the left file less the right one, 92 voxels, which equals the combined volume's Left-PTg (7306) exactly. The second is an overlap of the DR and the PAG: two voxels lie in both masks. The combined volume gives them to the PAG, and so does Planum.

The per-side masks, built this way, rebuild the release's combined volume voxel for voxel, and the script stops if they do not. The release is stored as FSL stores MNI152, with x running right to left. It was resampled onto TemplateFlow's left-to-right copy of the same grid by world position, every nucleus keeping its voxel count and centroid.

## Method

### Template registration (SynthMorph)

`scripts/register_arousal_nuclei.py synthmorph`, modelled on the striatal networks' registration, ran two steps:

1. FSL's MNI152 (MNI152NLin6Asym, TemplateFlow, pinned as `config/striatal-networks.yaml` pins it), masked by its brain mask, was registered to CDMD's `mri/brain.mgz` with FreeSurfer 8.2's `mri_synthmorph register -m joint -j 8` (joint affine and deformable; Hoffmann et al. 2024, [doi:10.1162/imag_a_00197](https://doi.org/10.1162/imag_a_00197)).
2. The release's labels, on the template grid, were carried onto the 1 mm grid of FreeSurfer's automatic subcortical segmentation (aseg) with `mri_synthmorph apply -m nearest`.

It ran once, alone: 7.6 minutes on the central processing unit (CPU), peak resident memory 6.48 GB.

### FreeSurfer SegmentAAN

FreeSurfer 8.2's `SegmentAAN.sh` (Olchanyi et al. 2025, [doi:10.1002/hbm.70357](https://doi.org/10.1002/hbm.70357)) segments the same ten nuclei, with the same 16 sided labels, from this brain's own reconstruction by Bayesian inference against a histology-derived probabilistic atlas, at 0.375 mm. It reads `norm.mgz`, `wmparc.mgz`, `aseg.mgz` and `talairach.xfm` from the full FreeSurfer 8.2 reconstruction of CDMD (`data/cache/freesurfer-subjects/cdmd`). The reconstruction was copied so that SegmentAAN's outputs never land in it, and the labels were mapped to the release's codes. FreeSurfer ships SegmentAAN as an x86_64 program compiled against the MATLAB Runtime R2019b (9.7), which a full MATLAB of another version cannot stand in for. SegmentAAN's segmentation of a CC0 subject may be published under the FreeSurfer Software License (Part B: use, derivative works and distribution allowed with the licence, attributions kept, no endorsement implied), which Planum already publishes beside the model.

It ran once, alone, on 2026-11-17: 17.5 minutes, peak resident memory 3.02 GB.

### Checks, fixed before the run (2026-11-16)

`arousal_nuclei.checks` measured each method's nuclei before they were kept to the brainstem. Two checks and a choice rule were fixed on 2026-11-16.

The placement check uses the three nuclei that this brain's own NextBrain segmentation also labels. NextBrain labels each side apart, so both sides were taken together. The carried dorsal raphe, ventral tegmental area and periaqueductal grey must each have a centroid within 3 mm of NextBrain's `dorsal_raphe_nucleus`, `ventral_tegmental_area` and `periaqueductal_gray_substance`. Dice is reported, on NextBrain's 0.4 mm grid.

The containment check required at least 95% of every one of the 16 sided nuclei to lie in aseg's Brain-Stem (label 16), sampled at each voxel centre. It was revised on 2026-11-17, after both methods failed it and before it was applied again, to Brain-Stem and Left- and Right-VentralDC, aseg's ventral diencephalon (labels 16, 28, 60). aseg labels the ventral midbrain, where the VTA lies, VentralDC (decision 0013, `web/docs/decisions/0013-arousal-nuclei-containment.md`). Ventricles stay outside. A second change on the same day lowered the limit to 90% for the periaqueductal grey alone (decision 0014, `inside_envelope_exceptions` in `config/arousal-nuclei.yaml`).

The choice rule takes, among methods that pass both checks, the one with the smaller mean centroid distance over the three nuclei. A difference under 0.25 mm goes to the higher mean Dice. If none passes, nothing is published.

### Kept nuclei and meshes

A passing method's nuclei were then kept to aseg's Brain-Stem and VentralDC (`keep`). The periaqueductal grey lost the rim that lay in the aqueduct's label. The kept nuclei were meshed as the other structures are (marching cubes, then bounded Taubin smoothing that moves no voxel centre across the surface) and published as the supplemental layer `aan` (`arousal-nuclei.glb`), each nucleus a selectable structure.

## Display

Each nucleus is a supplemental structure (`aan:<side>:<nucleus>`), drawn at every detail level. The **Anatomy** tree lists the nuclei under **Brainstem**, below a caption row **Arousal nuclei (Harvard atlas)** (French **Noyaux de l’éveil (atlas de Harvard)**; ANAT-60), apart from NextBrain's namesakes. The layer downloads the first time a nucleus is chosen, opened or linked, or a cut is made (STATE-71, CTRL-40, ATLAS-55), and each nucleus caps its own cut face.

The Coma profile's tegmental finding, whose overlap covered the raphe, locus coeruleus, laterodorsal tegmental nucleus, pontis oralis and parabrachial nucleus, maps to the Harvard median raphe, locus coeruleus, laterodorsal tegmental nucleus, pontis oralis and parabrachial complex, and to NextBrain's dorsal raphe. A lesson walking the ten does not exist yet.

## Validation

| Test | Criterion | Result, SynthMorph | Result, SegmentAAN |
| :--- | :--- | :--- | :--- |
| Dorsal raphe, centroid to NextBrain | ≤ 3 mm | **3.67 mm** (Dice 0.22) | 1.23 mm (Dice 0.25) |
| Periaqueductal grey, centroid to NextBrain | ≤ 3 mm | 1.29 mm (Dice 0.51) | 0.44 mm (Dice 0.72) |
| Ventral tegmental area, centroid to NextBrain | ≤ 3 mm | **5.00 mm** (Dice 0.03) | 1.20 mm (Dice 0.15) |
| Least share of a nucleus inside the brainstem | ≥ 95% | **28.9%** (VTA); PAG 82.7%, DR 96.8%, left PTg 98.4%, the other 12 100% | **3.0%** (VTA); right PTg 53.6%, left PTg 65.0%, PAG 89.6%, the other 12 at least 98.6% |
| Passes | | no | no |
| *Revised (decision 0013):* least share inside Brain-Stem and VentralDC | ≥ 95% | **82.7%** (PAG, 17.3% in 4th-Ventricle); DR 96.8% | **90.7%** (PAG, 9.0% in 4th-Ventricle); every other nucleus at least 98.7% |
| Passes, revised | | no | no |
| Passes, *with the periaqueductal grey's exception (decision 0014)* | grey ≥ 90%, every other nucleus ≥ 95% | no (centroids; grey 82.7% < 90%) | yes: published |

Bold marks a failed criterion.

SynthMorph's placement fell short in three nuclei. Of the VTA's 322 carried voxels, 229 lie in aseg's left and right VentralDC, which aseg extends into the ventral midbrain, and 93 lie in Brain-Stem. Its centroid lies 4.6 mm posterior and 1.9 mm inferior to NextBrain's, whose VTA is 182 mm³ to the Harvard mask's 322 mm³ (version 2.0 adds the parabrachial pigmented wings and the whole rostro-caudal extent). Of the PAG's 294 voxels, 51 lie in the aqueduct, which aseg labels 4th-Ventricle. The DR's offset is almost wholly inferior (3.67 mm): the Harvard dorsal raphe (221 mm³ here) runs further caudally than NextBrain's (92 mm³).

SegmentAAN's centroids are the closer (mean over the three nuclei 0.96 mm against 3.32 mm; mean Dice 0.37 against 0.26). Its containment failed for a reason it shares with the registration: aseg labels most of the ventral midbrain, where the VTA and the pedunculotegmental nuclei lie, VentralDC, and the aqueduct inside the PAG 4th-Ventricle.

The registered volumes are smaller than the template's (the DR 221 of 324 voxels, the VTA 322 of 488), as expected of a brain smaller than MNI152.

### Outcome

As of 2026-11-17 the nuclei are published from SegmentAAN, with one disclosed exception. SegmentAAN places the three nuclei NextBrain also labels within 1.3 mm. The containment check, fixed before the runs against aseg's Brain-Stem alone, failed for both methods because aseg puts the ventral midbrain in VentralDC. It was redefined as Brain-Stem and VentralDC (decision 0013) and applied once to the unchanged outputs. SegmentAAN's periaqueductal grey still fell short, 90.7% inside, with 9.0% in the 4th-Ventricle label that covers the aqueduct it surrounds. After seeing that result, the maintainer accepted it under a named exception for that nucleus alone (90%; decision 0014).

Both changes were made after results were seen, which departs from Planum's standard of a bar fixed in advance. The periaqueductal grey's own region sheet states the exception and its measured share, and every result is kept in the table above.

`data/cdmd/arousal-registration.json` records both methods' checks, before and after decision 0013. `arousal_nuclei.validate` measures the published nuclei again at every validation: the recorded checks, the choice of method, the kept volume and the meshes must all recompute.

### On the MNI template

Both methods were measured on the MNI template against the same checks, with the same envelope and exception and no other ([MNI template](mni-template.md#arousal-nuclei)). SynthMorph failed again: the VTA's centroid lay 4.91 mm and the DR's 3.67 mm from NextBrain's, and the PAG lay 87.9% inside. SegmentAAN passed, with its three centroids within 1.56 mm of NextBrain's (mean 1.20 mm), the PAG 90.9% inside and every other nucleus at least 98.7%, so its nuclei are published there too. It ran with FreeSurfer's macOS build, because no Linux build of FreeSurfer 8.2 includes its program. `data/mni152/arousal-registration.json` records both methods.

## Limitations

The masks were drawn on a template from histology and ex-vivo MRI of other brains, and placed here by registration (or by SegmentAAN's segmentation against a histological atlas). They are not this person's nuclei. The nuclei are a millimetre or two across: a mask marks about where a nucleus lies, not its outline in this person. The masks are not probabilistic: each voxel is in a nucleus or not.

NextBrain labels only three of the ten, and defines them differently. A low Dice against it is expected, and the other seven have no independent check on this brain.

aseg's Brain-Stem excludes the ventral midbrain (VentralDC) and the aqueduct, so the first containment check could not be met by a VTA placed where the atlas draws it. The check was redefined after the runs (decision 0013).

The periaqueductal grey lay 90.7% inside the brainstem and VentralDC, below the 95% the other nuclei met. Most of the rest fell in aseg's label for the aqueduct it surrounds and was removed. It is published under an exception made after the checks were run (decision 0014).

## Code availability

Code
: [`scripts/register_arousal_nuclei.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/register_arousal_nuclei.py) (source check, both methods, choice), [`brain_model/layers/arousal_nuclei.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/arousal_nuclei.py) (checks, keep, regions, layer record, validation)

Configuration
: [`config/arousal-nuclei.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/arousal-nuclei.yaml) (pins, nuclei, checks, choice rule); the `arousal_nuclei` layer in the anatomy's `layers` list in `config/model.yaml`

Tests
: `web/src/features/anatomy/AnatomyTree.svelte.test.ts` and `web/src/lib/core/panels/navigator.test.ts` (ANAT-60), `web/src/lib/core/state/reader-state.test.ts` and `web/src/lib/core/state/scene-commands.test.ts` (STATE-71), `web/src/lib/controller/anatomy.svelte.test.ts` (CTRL-40)

```bash
uv run python scripts/register_arousal_nuclei.py check
uv run python scripts/register_arousal_nuclei.py synthmorph      # FreeSurfer 8.2
uv run python scripts/register_arousal_nuclei.py segment-aan     # FreeSurfer 8.2 with MCRv97
uv run python scripts/register_arousal_nuclei.py publish --record
```
