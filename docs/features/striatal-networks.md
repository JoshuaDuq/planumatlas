# Striatal networks

Choi et al.'s (2012) seven resting-state networks drawn in the caudate, putamen and accumbens in the same colours Yeo 7 gives the cortex, registered onto this brain from FSL's MNI152 template.

:::{list-table}
:widths: 22 78
:stub-columns: 1

* - Where in the viewer
  - **Striatal networks** in the Section dock's cut labels; Yeo 7 colouring on any cut and on the caps of the striatal structures; the **Functional networks** disclosure of the region detail for the caudate, putamen and accumbens.
* - Built by
  - [`scripts/register_striatal_networks.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/register_striatal_networks.py) (registration), [`brain_model/layers/striatal_networks.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/striatal_networks.py) (regions, shares, cut volume, checks), called from [`brain_model/build.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/build.py)
* - Configuration
  - [`config/striatal-networks.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/striatal-networks.yaml); the `striatal_networks` layer in the anatomy's `layers` list in `config/model.yaml`
* - Source data
  - Choi et al. (2012) 7-network atlas, loose mask and confidence, as FreeSurfer 8.2 ships them in `average/Choi_JNeurophysiol12_MNI152` (FreeSurfer Software License); FSL's MNI152 template (`MNI152NLin6Asym`) from TemplateFlow
* - Checked by
  - [`tests/test_striatal_networks.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_striatal_networks.py); acceptance limits in the YAML; `striatal_networks.validate` in the [validator](../pipeline/validation.md); `web/src/lib/engine/tissues/striatal-overlay.test.ts`
:::

## What it does

Choi et al. (2012) assigned each striatal voxel of a 1,000-adult resting-state group to the Yeo et al. (2011) cortical network whose connectivity it most resembles. Its seven networks are the ones, in the same colours, that [Yeo 7](functional-networks.md) gives the cortex, so the network colouring carries into the caudate, putamen and accumbens. The Striatal networks cut labels give each caudate, putamen and accumbens voxel its network in Yeo's colours; other tissue keeps its FreeSurfer label.

It is a group map, not this brain's measured function; each voxel shows only the network its connectivity most resembles.

## Data

| File | Role | sha256 (first 12) |
| :--- | :--- | :--- |
| `Choi2012_7Networks_MNI152_FreeSurferConformed1mm_LooseMask.nii.gz` | The atlas, loose mask | `4994c2b25810` |
| `Choi2012_7Networks_ColorLUT.txt` | Colour table | `f6e68af76dff` |
| `Choi2012_7NetworksConfidence_MNI152_FreeSurferConformed1mm_LooseMask.nii.gz` | Each voxel's confidence | `e2836fb5630c` |
| `tpl-MNI152NLin6Asym_res-01_T1w.nii.gz` (TemplateFlow) | The template the atlas is drawn in | `f675946c0a07` |
| `tpl-MNI152NLin6Asym_res-01_desc-brain_mask.nii.gz` (TemplateFlow) | Its brain mask | `6d540075dac0` |

The atlas files are read from the FreeSurfer installation's `average/Choi_JNeurophysiol12_MNI152`, checked against the pinned checksum, and are not redistributed separately. The template is FSL's MNI152 (`MNI152NLin6Asym`), pinned as `config/coordinate-spaces.yaml` pins it and cached under `data/cache/striatal-networks/`. Distributed with FreeSurfer, whose software licence covers the data it ships; the paper and its wiki page name no separate licence.

The atlas stores values 1 to 7, Yeo's seven networks in their published order and colours. `check_lut` verifies each LUT row against `brain_model.layers.networks` (`7Networks_<n>` and the Yeo colour). On the subject, values are sided: 1 to 7 on the left and 8 to 14 on the right (`value_of`).

**Loose and tight mask.** The authors publish a loose mask, which reaches past the group's striatum, and a tight one, which their figures show. The tight mask reaches only 64% of CDMD's caudate and 54–56% of its accumbens, so the loose mask is the one cut to this brain's own striatum.

**Confidence.** Choi et al. give each voxel a confidence: the fraction of its 25 most correlated cortical vertices that belong to its network, and recommend reading the parcellation with it.

## How it was built

### 1. Register the template

`scripts/register_striatal_networks.py` checks the FreeSurfer build against `freesurfer_build` in `config/model.yaml`, checks the atlas files and the LUT, fetches the template files by checksum, then:

1. masks the template's T1 with its brain mask (the skull-stripped template, as the moving image);
2. registers it to the anatomy's `mri/brain.mgz` with `mri_synthmorph register -m joint -j <threads>`, joint affine and deformable;
3. runs `mri_synthseg --robust` on the template's T1 and resamples its segmentation onto the template's grid; this reading, carried by the same warp, scores the registration;
4. puts the atlas and the confidence on the template's grid by world position (`resample_from_to`, order 0). The atlas is stored on a FreeSurfer-conformed 256³ grid of the same template with a trailing singleton axis, so it is reshaped first; for the atlas the script checks that every value's centroid keeps its world position within 0.5 mm;
5. carries the atlas, the confidence and the segmentation to aseg's grid with `mri_synthmorph apply -m nearest` (the confidence is carried as floats, not rounded), checking that the output is on aseg's grid.

The run takes about 3 minutes and 7.5 GB on the CPU. SynthMorph's output is recorded by checksum rather than expected to reproduce bit for bit.

### 2. Accept or refuse

`striatal_networks.checks` scores the registration against this brain's aseg for six structures (left and right caudate, putamen, accumbens): the Dice of the template's SynthSeg structure against aseg's, and the fraction of aseg's structure the carried atlas reaches (`structure_covered`). The limits were fixed before the atlas was carried (2026-10-31) and `accept` refuses a registration that misses either:

- the mean template-striatum Dice with aseg is at least 0.8;
- no striatal structure may be less than 75% reached by the atlas itself, rather than filled from a neighbouring voxel.

### 3. Keep to the striatum and fill

`fill` keeps the carried atlas to aseg's caudate, putamen and accumbens (labels 11 and 50, 12 and 51, 26 and 58), sided by the aseg label's hemisphere, and fails if the carried atlas holds a value beyond 1 to 7. A voxel of a structure the atlas does not reach takes the network of the nearest voxel it reaches in the same structure (Euclidean distance transform, within the structure's bounding box). Nothing outside the striatum is labelled. The result is `mri/striatal-networks.mgz`; the unfilled carried atlas is kept as `striatal-networks-carried.mgz`, the carried template segmentation as `striatal-template-aseg.mgz`, and the checks and pins as `striatal-registration.json`.

### 4. Confidence

`kept_confidence` keeps the carried confidence where the atlas reached the striatum and 0 elsewhere; a reached voxel must carry a confidence in (0, 1]. `confidence_classes` gives each labelled striatal voxel a class: 1 filled (the atlas did not reach it), 2 low (below `minimum_confidence`, 0.5: the network holds a plurality, not a majority, of the 25 vertices) and 3 confident (0.5 or more). On CDMD 1% of the labelled striatum is low and 3% filled, most of it in the accumbens (11–17% filled). The written file is `striatal-networks-confidence.mgz`.

### 5. Build regions, shares and the cut volume

1. **Regions.** `build_regions` makes one cut-only region (`kind` `tissue-region`) per network and hemisphere the atlas reaches, ids `choi:<side>:<network>`, in Yeo's colour, with voxel count, volume in mm³, placement, the network as its whole composition (the region is that network's striatal territory) and the region's confidence-class shares and its share in the putamen (`quality_of_counts`).
2. **Shares.** `compose` counts the voxels of aseg's caudate, putamen and accumbens, the teaching set's, and each NextBrain region in each network (`grid_counts`, shared with [Arterial territories](arterial-territories.md)). A region takes shares only if at least half of it lies in the labelled striatum (`MINIMUM_INSIDE` = 0.5); both sides are added together. Shares are by voxels, largest first; shares under 1% (`MINIMUM_FRACTION`) are left out of the list, and the share outside the atlas is kept separately as `striatal_networks_unassigned`. The region's labelled voxels' confidence classes and their share in the putamen are stored with it. On CDMD the caudate is mostly frontoparietal control and default mode, the accumbens 85–89% limbic, and the putamen salience, control and somatomotor (17–19%), as Choi et al. found: the somatomotor network couples to the putamen, not the caudate.
3. **Cut volume.** `export_cut_atlas` gives every striatal voxel its network's label (one per network and side, in Yeo's colour) over aparc+aseg's labels and writes `tissues-choi.volume` (unsigned 16-bit, cropped), plus `tissues-choi-confidence.volume`, an unsigned 8-bit volume of the classes (`outside`, `filled`, `low`, `confident`). The atlas is registered as a cut-only atlas (`surface: false`, procedure `registered-template`).
4. **Metadata and limitations.** `metadata` writes the label, DOI, licence, network names, minimum confidence, registration checks and method into the manifest; `limitations` states the measured coverage, the low-confidence and filled shares of this brain, and the putamen caveat.

## How the viewer uses it

- **Cut labels.** The Striatal networks cut atlas reads `tissues-choi.volume` like any cut-label atlas (see [Sections and cuts](sections-and-cuts.md)); a voxel Choi et al. are not confident of, or that the atlas only filled, is drawn paler.
- **Yeo 7 colouring on any cut.** `web/src/lib/engine/tissues/striatal-overlay.ts` (`STRIATAL_ATLAS = 'choi'`) adds the Choi volume as a second, colour-only texture to the cut shader and to the caps of striatal structures. Under Yeo 7, a cut colours other labels by the network holding most of each region, but the striatum by its own voxels, whichever cut labels are chosen: the cut and the striatal structures' caps read this volume for colour only, while names, selection and visibility stay with the chosen labels. A voxel below the minimum confidence, or filled, is faded toward its own grey (`UNCERTAIN_FADE` = 0.65; `CONFIDENT` = class 3). Where a smoothed teaching-set or NextBrain solid reaches past aseg's striatum, the atlas has no voxel and the cap keeps its tissue colour. The overlay also runs for the Choi cut labels under atlas colours.
- **Region detail.** `web/src/features/inspector/NetworkSection.svelte` lists, for a region carrying `striatal_networks`, its share in each Yeo network's striatal territory (`striatalNetworksOf`, minimum share 5%), the share outside the atlas when it is at least 0.5%, Choi's confidence (confident, low and filled shares, with the 0.5 threshold) and, for a region mostly in the putamen (share 0.5 or more), the putamen caveat. For a Choi region it says the share is that network's striatal territory whole.
- **Status line.** `section-text.ts` says the striatum is coloured by its own voxels under Yeo 7.

## Checks

Written to `striatal-registration.json` at build, and re-measured by `striatal_networks.validate`, which also recomputes the filled atlas, the confidence file, the published confidence volume's hash and every region and share.

| Check | Limit | CDMD |
| :--- | :--- | :--- |
| Template striatum Dice with aseg, mean of 6 structures | ≥ 0.8 | 0.876 (0.778 to 0.918) |
| Each structure the atlas reaches before filling | ≥ 75% | 82.8% (right accumbens) to 98.7% |

By structure the Dice runs from 0.778 (right accumbens) to 0.918 (left putamen), and the structure the atlas reaches from 82.8% (right accumbens) to 98.7% (left putamen); the caudate is 95.4–96.0% and the left accumbens 89.0%.

The tests check the definition (a stray key or networks out of Yeo's order are refused), that values are sided and shares join both sides, that `fill` keeps the atlas to each structure and fills from the same one, that confidence classes mark filled, low and confident voxels and count the putamen, that the checks score registration and coverage and a shifted template fails, that the conformed atlas keeps its world positions on the template grid, that a LUT out of Yeo's colours is refused, that the published atlas keeps to the striatum with regions on their sides, and that the published striatum is associative with a motor putamen.

## Limits

- A group map, not this brain's measured function; each voxel shows only the network its connectivity most resembles.
- The data were 3 mm voxels smoothed at 6 mm, so network borders within the striatum are uncertain by several millimetres before registration adds its own.
- Up to 17% of a structure (the right accumbens) takes its network from the nearest voxel the atlas reached; the accumbens is 11–17% filled.
- **Putamen.** Choi et al. are least confident around the dorsal putamen, where signal bleeding from the adjacent insula is only partly removed by their regression of nearby cortex. The inspector says so for any region mostly in the putamen, whose salience share may partly reflect the insula.
- Distributed with FreeSurfer under its software licence.

### Alternatives considered

- **Tian et al. (2020), rejected.** The Melbourne Subcortex Atlas divides the striatum, pallidum, thalamus, hippocampus and amygdala into named parcels, but it is drawn on a 2 mm group mask. Even on its own template its caudate is 61% of the anatomical caudate's volume and only 31% of its right accumbens lies inside the anatomical one. On CDMD its scale III parcels reach only 47–56% of the caudate and 46–64% of the accumbens; its personalised probability maps (921 participants) reach 55–65% and 46–64%. Filling up to half a structure would invent labels, so it fails the same 75% limit. Its thalamus passes (78–88%) and could be a layer of its own. At 7 T it reaches 64–66% of the caudate and 36–37% of the accumbens, as short as the 3 T atlas.
- **The CAB-NP subcortex (Ji et al. 2019), rejected.** It reaches 86–96% of CDMD's striatum, pallidum and thalamus, but its striatum is 54% cingulo-opercular, the network of the adjacent anterior insula, with no somatomotor putamen and 4% primary visual. Choi et al. regressed nearby cortical signal to limit such bleed; Ji et al. did not outside the cerebellum. Translated to Yeo through CDMD's cortex, it agrees with Choi on 43% of striatal voxels (κ 0.26; within each structure κ 0.09). In the thalamus, checked against NextBrain's nuclei with expectations fixed first, the lateral geniculate is visual and VPM somatomotor, but the medial geniculate splits auditory and visual and rostral VPL leans visual.
- **Hwang et al. (2017) thalamus (NeuroVault 4738, nine networks), rejected.** It reaches 73–77% of CDMD's thalamus and leaves most of both geniculates unlabelled; the labelled medial geniculate is medial occipital rather than temporal, and right rostral VPL is cingulo-opercular. VPM is somatomotor (93%).
- **Li et al. (2025, bioRxiv), not yet available.** Fifteen subcortical subnetworks from 1,000 HCP adults, to be released on acceptance; it uses its own network scheme.

## Reproduce

```bash
# needs FreeSurfer 8.2 (SynthMorph and SynthSeg); about 3 minutes and 7.5 GB on the CPU
uv run python scripts/register_striatal_networks.py --anatomy cdmd --record
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_striatal_networks.py
```

## See also

- [Functional networks](functional-networks.md), the Yeo 7 colouring this layer extends into the striatum, and CAB-NP
- [Sections and cuts](sections-and-cuts.md)
- [Cerebellar functions](cerebellar-functions.md) and [Arterial territories](arterial-territories.md), built by the same registration pattern
- [References](../reference/references.md) (Choi et al. 2012; Yeo et al. 2011; Ji et al. 2019) and the [building guide](../pipeline/building.md)
