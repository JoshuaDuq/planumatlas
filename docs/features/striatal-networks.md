# Striatal networks

Choi et al.'s (2012) seven-network map of the striatum assigns each striatal voxel of a 1,000-adult resting-state group to the Yeo et al. (2011) cortical network its connectivity most resembles. The map is registered with SynthMorph from FSL's MNI152 template onto CDMD's caudate, putamen and nucleus accumbens and drawn on cut faces in the Yeo 7 colours the [cortex](functional-networks.md) uses (Fig. 1). Each voxel carries Choi's confidence. It is a group map, not this brain's measured function. The same steps register it onto the [MNI template](mni-template.md#registered-group-maps); the numbers on this page are CDMD's.

```{figure} figures/striatal-networks-1-light.webp
:alt: The same coronal cut through the CDMD striatum twice. a, striatal voxels in Yeo network colours and all other tissue in its neutral tissue colour. b, the whole cut in Yeo network colours. A key of the seven networks runs under both.
:name: fig-striatal-networks-1

**The striatum takes the cortical Yeo colours voxel by voxel.** **a**, [Coronal cut](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&colors=striatal&cam=0,14,-185,0,14,-12&cut=coronal&pos=12&view=anterior) 12 mm anterior (surface RAS y = 12 mm) through the caudate head, putamen and nucleus accumbens, seen from the front (the subject's right on the image's left), with **Colour** set to **Striatal networks**. Striatal voxels take their network's Yeo colour, and the rest of the cut keeps its tissue colour. **b**, [The same cut and camera](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&colors=network&cam=0,14,-185,0,14,-12&cut=coronal&pos=12&view=anterior) with **Colour** set to **Yeo 7 networks**. Cortical parcels take their dominant network, and the striatum keeps its own voxels. The caudate is frontoparietal control (orange) and default mode (red), the putamen mostly salience / ventral attention (violet) and the accumbens limbic (pale green). Voxels filled from a neighbour or below confidence 0.5 are drawn paler. The key gives the seven networks. Scale bars apply at the depth of the camera's target.
```

## Data

| File | Role | sha256 (first 12) |
| :--- | :--- | :--- |
| `Choi2012_7Networks_MNI152_FreeSurferConformed1mm_LooseMask.nii.gz` | Atlas, loose mask | `4994c2b25810` |
| `Choi2012_7Networks_ColorLUT.txt` | Colour table | `f6e68af76dff` |
| `Choi2012_7NetworksConfidence_MNI152_FreeSurferConformed1mm_LooseMask.nii.gz` | Per-voxel confidence | `e2836fb5630c` |
| `tpl-MNI152NLin6Asym_res-01_T1w.nii.gz` (TemplateFlow) | Template T1-weighted image (T1) | `f675946c0a07` |
| `tpl-MNI152NLin6Asym_res-01_desc-brain_mask.nii.gz` (TemplateFlow) | Template brain mask | `6d540075dac0` |

The atlas files were read from the FreeSurfer 8.2 installation (`average/Choi_JNeurophysiol12_MNI152`) and checked against the pinned sha256. They are not redistributed separately and are covered by the FreeSurfer Software License. The template is pinned as `config/coordinate-spaces.yaml` pins it and cached in `data/cache/striatal-networks/`. Atlas values 1–7 are Yeo's networks in published order. The loose mask reaches past the group striatum so that this brain's own striatum can cut it. The tight mask leaves about a third of the caudate out. Confidence is the fraction of a voxel's 25 most correlated cortical vertices that belong to its assigned network.

## Method

### Registration
`scripts/register_striatal_networks.py` first checked the FreeSurfer build against `freesurfer_build` in `config/model.yaml` and the atlas files against their pins. `check_lut` verified that rows 1–7 of the colour lookup table (LUT) are `7Networks_<n>` in the Yeo colours of `brain_model/layers/networks.py`. The registration then ran in five steps.

1. The template T1 was masked with its brain mask to give the moving image.
2. The moving image was registered to `mri/brain.mgz` with `mri_synthmorph register -m joint -j <threads>` (SynthMorph, FreeSurfer 8.2; joint affine and deformable).
3. `mri_synthseg --robust` segmented the template T1, and the segmentation was resampled onto the template grid. It serves to score the registration.
4. The atlas, which is stored on a FreeSurfer-conformed 256³ grid with a trailing singleton axis, and the confidence were resampled onto the template grid by world position (nibabel `resample_from_to`, order 0). Every atlas value's centroid was checked to move by at most 0.5 mm on each axis.
5. `mri_synthmorph apply -m nearest` carried the atlas, the confidence (as floats) and the segmentation onto the grid of aseg, FreeSurfer's subcortical segmentation of this brain. The output grid was checked against aseg's.

SynthMorph ran on the central processing unit (CPU). Its output is recorded by checksum and is not expected to reproduce bit for bit.

### Acceptance
`striatal_networks.checks` scored six structures: the left and right caudate, putamen and accumbens (aseg labels 11/50, 12/51, 26/58). Two limits were fixed before the atlas was carried (2026-10-31), and `accept` refuses a registration that misses either. The mean Dice of the carried template segmentation with aseg must be ≥ 0.8. The fraction of every structure reached by the carried atlas (`structure_covered`) must be ≥ 0.75.

### Restriction and fill
`fill` kept the carried atlas to the six aseg structures. It fails on any value other than 0 (no network) and 1–7. A structure voxel that the atlas did not reach took the network of the nearest reached voxel of the same structure (Euclidean distance transform within the structure's bounding box). Values are sided: 1–7 left, 8–14 right (`value_of`). Nothing outside the striatum is labelled. The script wrote `mri/striatal-networks.mgz`, `mri/striatal-networks-carried.mgz` (unfilled), `mri/striatal-template-aseg.mgz` and `striatal-registration.json`.

### Confidence classes
`kept_confidence` kept the carried confidence where the atlas reached the striatum and set it to 0 elsewhere, and the script wrote the result to `mri/striatal-networks-confidence.mgz`. Every reached voxel must have a confidence in (0, 1]. `confidence_classes` gives each striatal voxel one of three classes. Class 1, filled, has confidence 0. Class 2, low, has a confidence above 0 and < `minimum_confidence` = 0.5: the network holds a plurality, not a majority, of the 25 vertices. Class 3, confident, has a confidence ≥ 0.5. On CDMD 1% of the labelled striatum is low and 3% filled.

### Regions, shares and cut volume
1. `build_regions` made one cut-only region per network and side the atlas reaches (`choi:<side>:<network>`, 14 on CDMD), in its Yeo colour, with the voxel count, the volume, a placement, its confidence-class shares and its share in the putamen (`quality_of_counts`).
2. `compose` counted the voxels of every aseg, teaching-set and NextBrain region in each network (`grid_counts`). A region takes shares only if at least half of it lies in the labelled striatum (`MINIMUM_INSIDE` = 0.5). Both sides are summed. Shares ≥ 1% (`MINIMUM_FRACTION`) are stored as `striatal_networks`, largest first. The share outside the atlas is stored as `striatal_networks_unassigned`. A structure under 100 mm³ takes no shares ([registration landing](registration-landing.md#the-small-structure-rule)). It stores `striatal_networks_near` instead: the networks holding at least 1% of the striatal voxels within 3 mm of it, largest first. On CDMD this rule applies to three structures: both olfactory tubercles and the right posteroventral putamen.
3. `export_cut_atlas` started from the aparc.a2009s+aseg labels, gave every striatal voxel its network label and wrote `tissues-choi.volume` (unsigned 16-bit, cropped) and `tissues-choi-confidence.volume` (unsigned 8-bit classes `outside`, `filled`, `low`, `confident`). The atlas is registered as cut-only (`surface: false`, procedure `registered-template`).

On CDMD the largest shares of the aseg structures are these:

| aseg structure | Network | Left | Right |
| :--- | :--- | ---: | ---: |
| Caudate | Frontoparietal control | 48.9% | 57.3% |
| Caudate | Default mode | 44.6% | 35.0% |
| Putamen | Salience / ventral attention | 31.1% | 43.7% |
| Putamen | Frontoparietal control | 24.2% | 22.8% |
| Putamen | Somatomotor | 19.2% | 18.2% |
| Accumbens | Limbic | 84.9% | 89.1% |

## Display

The **Colour** option **Striatal networks** (group **Subcortical maps** in the masthead; URL parameter `colors=striatal`) labels a cut by `tissues-choi.volume` ([which labels a cut samples](sections-and-cuts.md#which-labels-a-cut-samples)). Striatal voxels are named and coloured by their network, and every other label keeps its tissue colour (Fig. 1a). The cortical ribbon keeps the surface atlas's parcels. The stage key says that the map is drawn on cut faces.

Chosen with no cut open, the colour opens an axial cut through the map's centre (its regions' centroids weighted by voxel count) and turns the view to face it (`mapCut` in `cut-labels.ts`). Through that centre an axial cut shows 10 of the 14 sided networks on CDMD, a coronal one 6. A cut already open stays where it is.

`striatal-overlay.ts` also binds the Choi volume as a colour-only texture to the cut shader and to the caps of striatal structures. Under the **Colour** option **Yeo 7 networks**, a cut keeps the surface atlas's labels and colours the striatum voxel by voxel, while other regions take their dominant network (Fig. 1b). Names, selection and visibility stay with those labels. The overlay runs under either colouring and never under a paint (`wantsStriatal`). A voxel below confidence class 3 (`CONFIDENT`) is mixed toward the grey of its own luminance by `UNCERTAIN_FADE` = 0.65. Where a teaching-set or NextBrain solid extends past aseg's striatum, the atlas has no voxel and the cap keeps its tissue colour.

In the region detail, `NetworkSection.svelte` (section **Functional networks**, subheading **Striatal networks (Choi et al. 2012)**) lists a region's striatal network shares ≥ 5%, the share outside the atlas when it is ≥ 0.5% and Choi's confidence classes. When ≥ 50% of the region is putamen, it adds the putamen caveat. For a structure under 100 mm³ it lists the networks in `striatal_networks_near` without bars or percentages and says whether a border between networks passes within 3 mm.

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| Template striatum Dice with aseg, mean of 6 structures | ≥ 0.8 | 0.876 |
| Structure reached by the carried atlas before filling | ≥ 75% each | 82.8–98.7% |
| `striatal_networks.validate` | Report re-measures; filled atlas, confidence file, published confidence hash, every region and share recompute | Exact |
| `test_the_checks_score_registration_and_coverage_and_a_shifted_template_fails` | A shifted template fails Dice; < 75% reached fails coverage | Passes |
| `test_fill_keeps_the_atlas_to_each_structure_and_fills_gaps_from_the_same_one` | Fill stays within a structure | Passes |
| `test_the_conformed_atlas_keeps_its_world_positions_on_the_template_grid` | Centroids kept within 0.5 mm | Passes |
| `test_a_lut_out_of_yeo_colours_is_refused` | LUT must match Yeo colours | Passes |
| `test_the_published_striatum_is_associative_with_a_motor_putamen` | Putamen somatomotor > 10% > caudate somatomotor; caudate control + default > 50%; visual < 5% everywhere; cortex takes no shares | Passes |
| `striatal-overlay.test.ts` | Only striatal labels are opaque in the overlay palette | Passes |
| `excursion.test.ts`, a colour only cuts show | With no cut open, the colour cuts axial within 0.05 mm of the volume's own centroid and faces it from above; an open cut and a surface colour open none | Passes |

The structure Dice ranges from 0.778 (right accumbens) to 0.918 (left putamen). Before filling, the carried atlas reached 82.8% of the right accumbens, 89.0% of the left accumbens, 95.4% (right) and 96.0% (left) of the caudate, and 98.7% of each putamen. These results are recorded in `data/cdmd/striatal-registration.json` and, re-measured, in `validation.json` under `striatal_networks.checks`.

## Limitations

The atlas is a group map, not this brain's measured function. Each voxel shows only its most similar network.

Registration from a group template places network borders a few millimetres off. Up to 17% of a structure takes its network from the nearest reached voxel. The accumbens is 11% (left) and 17% (right) filled.

Choi et al. are least confident around the dorsal putamen, where signal from the adjacent insula is only partly removed. A putamen's salience share may therefore partly reflect the insula.

The atlas is distributed with FreeSurfer under its software licence.

## Code availability

Code
: [`scripts/register_striatal_networks.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/register_striatal_networks.py) (registration), [`brain_model/layers/striatal_networks.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/striatal_networks.py) (checks, fill, confidence, regions, shares, cut volume), [`web/src/lib/engine/tissues/striatal-overlay.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/engine/tissues/striatal-overlay.ts), [`web/src/lib/core/catalog/cut-labels.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/catalog/cut-labels.ts) (`mapCut`), [`web/src/features/inspector/NetworkSection.svelte`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/features/inspector/NetworkSection.svelte)

Configuration
: [`config/striatal-networks.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/striatal-networks.yaml) (pins, acceptance limits, minimum confidence, network names); the `striatal_networks` layer in the anatomy's `layers` list in [`config/model.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/model.yaml)

Tests
: [`tests/test_striatal_networks.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_striatal_networks.py), [`web/src/lib/engine/tissues/striatal-overlay.test.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/engine/tissues/striatal-overlay.test.ts), [`web/src/lib/controller/excursion.test.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/controller/excursion.test.ts)

```bash
# needs FreeSurfer 8.2 (SynthMorph and SynthSeg)
uv run python scripts/register_striatal_networks.py --anatomy cdmd --record
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_striatal_networks.py
```

