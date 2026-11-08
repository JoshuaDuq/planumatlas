# Striatal networks

Choi et al.'s (2012) seven-network map of the striatum assigns each striatal voxel of a 1,000-adult resting-state group to the Yeo et al. (2011) cortical network its connectivity most resembles. The map is registered from FSL's MNI152 template onto CDMD's caudate, putamen and nucleus accumbens and drawn in the Yeo 7 colours the [cortex](functional-networks.md) uses. Each voxel carries Choi's confidence. It is a group map, not this brain's measured function.

```{figure} figures/striatal-networks-1.webp
:alt: The same coronal cut through the CDMD striatum twice: left, striatal voxels in Yeo network colours among FreeSurfer label colours; right, the whole cut in Yeo network colours.
:name: fig-striatal-networks-1

**The striatum takes the cortical Yeo colours voxel by voxel.** **a**, Coronal cut 12 mm anterior (surface RAS y = 12 mm) through the caudate head, putamen and nucleus accumbens, viewed from the front (subject's right on the left); cut labels **Striatal networks** (`cuts=choi`), Colour **Regions**. Striatal voxels take their network's Yeo colour; the rest of the cut keeps its FreeSurfer (aparc.a2009s+aseg) colours. **b**, Same cut and camera under Colour **Yeo 7 networks** (`colors=network`): cortical parcels take their dominant network, the striatum keeps its own voxels. The caudate is frontoparietal control (orange) and default mode (red), the putamen mostly salience / ventral attention (violet), the accumbens limbic (pale green). Voxels filled from a neighbour or below confidence 0.5 are drawn paler.
```

## Data

| File | Role | sha256 (first 12) |
| :--- | :--- | :--- |
| `Choi2012_7Networks_MNI152_FreeSurferConformed1mm_LooseMask.nii.gz` | Atlas, loose mask | `4994c2b25810` |
| `Choi2012_7Networks_ColorLUT.txt` | Colour table | `f6e68af76dff` |
| `Choi2012_7NetworksConfidence_MNI152_FreeSurferConformed1mm_LooseMask.nii.gz` | Per-voxel confidence | `e2836fb5630c` |
| `tpl-MNI152NLin6Asym_res-01_T1w.nii.gz` (TemplateFlow) | Template T1 | `f675946c0a07` |
| `tpl-MNI152NLin6Asym_res-01_desc-brain_mask.nii.gz` (TemplateFlow) | Template brain mask | `6d540075dac0` |

The atlas files are read from the FreeSurfer 8.2 installation (`average/Choi_JNeurophysiol12_MNI152`), checked against the pinned sha256 and not redistributed separately; they are covered by the FreeSurfer Software License. The template is pinned as `config/coordinate-spaces.yaml` pins it and cached in `data/cache/striatal-networks/`. Atlas values 1–7 are Yeo's networks in published order. The loose mask reaches past the group striatum so that this brain's own striatum can cut it; the tight mask leaves about a third of the caudate out. Confidence is the fraction of a voxel's 25 most correlated cortical vertices that belong to its assigned network.

## Method

### Registration
`scripts/register_striatal_networks.py` checks the FreeSurfer build against `freesurfer_build` in `config/model.yaml`, the atlas files against their pins, and `check_lut` verifies that LUT rows 1–7 are `7Networks_<n>` in the Yeo colours of `brain_model/layers/networks.py`. It then:

1. masks the template T1 with its brain mask (moving image);
2. registers it to `mri/brain.mgz` with `mri_synthmorph register -m joint -j <threads>` (joint affine and deformable);
3. runs `mri_synthseg --robust` on the template T1 and resamples the segmentation onto the template grid, to score the registration;
4. resamples the atlas (stored on a FreeSurfer-conformed 256³ grid with a trailing singleton axis) and the confidence onto the template grid by world position (`resample_from_to`, order 0), checking that every atlas value's centroid moves by at most 0.5 mm;
5. carries atlas, confidence (as floats) and segmentation onto aseg's grid with `mri_synthmorph apply -m nearest`, checking the output grid.

SynthMorph runs on the CPU; its output is recorded by checksum, not expected to reproduce bit for bit.

### Acceptance
`striatal_networks.checks` scores six structures (left and right caudate, putamen, accumbens; aseg labels 11/50, 12/51, 26/58). The limits were fixed before the atlas was carried (2026-10-31), and `accept` refuses a registration that misses either:

- mean Dice of the carried template segmentation with aseg ≥ 0.8;
- fraction of every structure reached by the carried atlas (`structure_covered`) ≥ 0.75.

### Restriction and fill
`fill` keeps the carried atlas to the six aseg structures and fails on any value outside 1–7. A structure voxel the atlas does not reach takes the network of the nearest reached voxel of the same structure (Euclidean distance transform within the structure's bounding box). Values are sided: 1–7 left, 8–14 right (`value_of`). Nothing outside the striatum is labelled. Outputs: `mri/striatal-networks.mgz`, `striatal-networks-carried.mgz` (unfilled), `striatal-template-aseg.mgz` and `striatal-registration.json`.

### Confidence classes
`kept_confidence` keeps the carried confidence where the atlas reached the striatum and 0 elsewhere; every reached voxel must have confidence in (0, 1]. `confidence_classes` labels each striatal voxel 1 filled (confidence 0), 2 low (< `minimum_confidence` = 0.5: the network holds a plurality, not a majority, of the 25 vertices) or 3 confident (≥ 0.5). On CDMD 1% of the labelled striatum is low and 3% filled.

### Regions, shares and cut volume
1. `build_regions` makes one cut-only region per network and side the atlas reaches (`choi:<side>:<network>`, 14 on CDMD), in Yeo colour, with voxel count, volume, placement, its confidence-class shares and its share in the putamen (`quality_of_counts`).
2. `compose` counts the voxels of every aseg, teaching-set and NextBrain region in each network (`grid_counts`). A region takes shares only if at least half of it lies in the labelled striatum (`MINIMUM_INSIDE` = 0.5). Both sides are summed. Shares ≥ 1% (`MINIMUM_FRACTION`) are stored as `striatal_networks`, largest first; the share outside the atlas is stored as `striatal_networks_unassigned`.
3. `export_cut_atlas` starts from the aparc.a2009s+aseg labels, gives every striatal voxel its network label and writes `tissues-choi.volume` (unsigned 16-bit, cropped) and `tissues-choi-confidence.volume` (unsigned 8-bit classes `outside`, `filled`, `low`, `confident`). The atlas is registered as cut-only (`surface: false`, procedure `registered-template`).

| aseg structure | Largest shares (left / right) |
| :--- | :--- |
| Caudate | Frontoparietal control 48.9% / 57.3%; default mode 44.6% / 35.0% |
| Putamen | Salience / ventral attention 31.1% / 43.7%; control 24.2% / 22.8%; somatomotor 19.2% / 18.2% |
| Accumbens | Limbic 84.9% / 89.1% |

## Display

**Striatal networks** in the Section dock's cut labels (URL `cuts=choi`) reads `tissues-choi.volume`. `striatal-overlay.ts` also binds the Choi volume as a colour-only texture to the cut shader and to the caps of striatal structures. Under Colour **Yeo 7 networks**, a cut therefore colours the striatum voxel by voxel, whatever cut labels are chosen, while other regions take their dominant network; names, selection and visibility stay with the chosen labels. The overlay also runs for the Striatal networks cut labels under Colour **Regions**, and never under a paint (`wantsStriatal`). A voxel below confidence class 3 (`CONFIDENT`) is mixed toward grey by `UNCERTAIN_FADE` = 0.65. Where a teaching-set or NextBrain solid extends past aseg's striatum, the atlas has no voxel and the cap keeps its tissue colour. In the region detail, `NetworkSection.svelte` lists a region's striatal network shares ≥ 5%, the share outside the atlas when ≥ 0.5%, Choi's confidence classes, and, when ≥ 50% of the region is putamen, the putamen caveat.

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| Template striatum Dice with aseg, mean of 6 structures | ≥ 0.8 | 0.876 (0.778 right accumbens to 0.918 left putamen) |
| Structure reached by the carried atlas before filling | ≥ 75% each | 82.8% (right accumbens) to 98.7% (left putamen); caudate 95.4–96.0%; left accumbens 89.0% |
| `striatal_networks.validate` | Report re-measures; filled atlas, confidence file, published confidence hash, every region and share recompute | Exact |
| `test_the_checks_score_registration_and_coverage_and_a_shifted_template_fails` | A shifted template fails Dice; < 75% reached fails coverage | Passes |
| `test_fill_keeps_the_atlas_to_each_structure_and_fills_gaps_from_the_same_one` | Fill stays within a structure | Passes |
| `test_the_conformed_atlas_keeps_its_world_positions_on_the_template_grid` | Centroids kept within 0.5 mm | Passes |
| `test_a_lut_out_of_yeo_colours_is_refused` | LUT must match Yeo colours | Passes |
| `test_the_published_striatum_is_associative_with_a_motor_putamen` | Putamen somatomotor > 10% > caudate somatomotor; caudate control + default > 50%; visual < 5% everywhere; cortex takes no shares | Passes |
| `striatal-overlay.test.ts` | Only striatal labels are opaque in the overlay palette | Passes |

## Limitations

- A group map, not this brain's measured function; each voxel shows only its most similar network.
- Registration from a group template places network borders a few millimetres off.
- Up to 17% of a structure takes its network from the nearest reached voxel; the accumbens is 11% (left) and 17% (right) filled.
- Choi et al. are least confident around the dorsal putamen, where signal from the adjacent insula is only partly removed; a putamen's salience share may partly reflect the insula.
- Distributed with FreeSurfer under its software licence.

## Code availability

Code
: [`scripts/register_striatal_networks.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/register_striatal_networks.py) (registration), [`brain_model/layers/striatal_networks.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/striatal_networks.py) (checks, fill, confidence, regions, shares, cut volume), `web/src/lib/engine/tissues/striatal-overlay.ts`

Configuration
: [`config/striatal-networks.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/striatal-networks.yaml) (pins, acceptance limits, minimum confidence, network names); the `striatal_networks` layer in the anatomy's `layers` list in `config/model.yaml`

Tests
: [`tests/test_striatal_networks.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_striatal_networks.py), `web/src/lib/engine/tissues/striatal-overlay.test.ts`

```bash
# needs FreeSurfer 8.2 (SynthMorph and SynthSeg)
uv run python scripts/register_striatal_networks.py --anatomy cdmd --record
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_striatal_networks.py
```

Figure state (panel b): https://planumatlas.com/#anatomy=cdmd&atlas=destrieux&cuts=choi&colors=network&cut=coronal&pos=12&cam=0,14,-185,0,14,-12
