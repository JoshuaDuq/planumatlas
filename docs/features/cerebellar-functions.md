# Cerebellar functions

The symmetric 32-region functional atlas of the cerebellum (Nettekoven et al. 2024), fused from seven task-based functional MRI (fMRI) datasets on the spatially unbiased infratentorial template (SUIT), is registered onto CDMD's cerebellar cortex. It is published as a cut-label atlas, and each cerebellar lobule lists its share in every functional region. It is a group map placed on this brain, not this brain's measured function.

```{figure} figures/cerebellar-functions-1.webp
:alt: A sagittal and an axial cut face through the CDMD cerebellum with the Cerebellar functions cut labels; cerebellar cortex voxels are coloured by functional region, other tissue by its FreeSurfer label.
:name: fig-cerebellar-functions-1

**The registered atlas labels only this brain's cerebellar cortex, region by region, mirrored across the midline.** **a**, Sagittal cut 25 mm left of the midline (surface RAS x = −25 mm), viewed from the right, anterior to the right. **b**, Axial cut at surface RAS z = −28 mm, viewed from above, anterior up, left on the left. Cut labels **Cerebellar functions** (`cuts=nettekoven`), camera zoomed onto the cerebellum. Each cerebellar cortex voxel takes the colour of its functional region (atlas colours from `atl-NettekovenSym32.lut`); white matter, brainstem and cerebrum keep their FreeSurfer label colours, and smooth shaded surfaces are internal-anatomy solids exposed by the cut.
```

## Data

All files are from DiedrichsenLab/cerebellar_atlases at commit `6857dfa732de6dd60c94da2f84d0b15ccf316618`, pinned by sha256 in `config/cerebellar-functions.yaml` and cached in `data/cache/cerebellar-atlases/`.

| Role | File | sha256 (first 12) |
| :--- | :--- | :--- |
| SUIT template | `tpl-SUIT/tpl-SUIT_T1w.nii` | `9c84dd5d2dc3` |
| Functional atlas | `Nettekoven_2024/atl-NettekovenSym32_space-SUIT_dseg.nii` | `82f06b102baf` |
| Atlas colour table | `Nettekoven_2024/atl-NettekovenSym32.lut` | `33a723b32cb8` |
| SUIT lobules (Diedrichsen et al. 2009), used only to score the registration | `Diedrichsen_2009/atl-Anatom_space-SUIT_dseg.nii` | `cd9485752b10` |
| SUIT lobule names | `Diedrichsen_2009/atl-Anatom.tsv` | `dc682c847972` |

Atlas values 1–16 are the regions on the left and 17–32 the same regions on the right (`value_of`). The 16 regions fall into the paper's four domains:

| Domain | Regions |
| :--- | :--- |
| Motor | M1 oculomotor, M2 tongue, M3 hand, M4 lower body |
| Action | A1, A2, A3 |
| Multiple demand | D1, D2, D3, D4 |
| Social, linguistic and spatial | S1, S2, S3, S4, S5 |

Names keep only what holds on both sides of the symmetric atlas; one-sided findings (e.g. right S1's response to verb generation) are in each region's description. English and French names and descriptions are in the YAML. Licence: CC BY-NC 3.0 Unported; paper: Nat Commun 15:8376, [doi:10.1038/s41467-024-52371-w](https://doi.org/10.1038/s41467-024-52371-w).

## Method

### Source checks
`fetch` (`scripts/register_cerebellar_functions.py`) downloads each file at the pinned commit and verifies its checksum. `check_tables` verifies each region's LUT row: value, code with side letter, and colour (LUT values in 0–1 × 255, rounded) must equal the definition. It also verifies that `atl-Anatom.tsv` lists the 28 SUIT lobules in the order `SUIT_LOBULES` reads them.

### Registration
SynthMorph (FreeSurfer 8.2, checked against `freesurfer_build` in `config/model.yaml`) registers the SUIT template to the subject.

1. Fixed image: `mri/brain.mgz` kept to aseg's infratentorial compartment (labels 7, 8, 15, 16, 46, 47: cerebellar white matter and cortex, fourth ventricle, brainstem), dilated by 4 voxels (`MARGIN`).
2. `mri_synthmorph register -m joint -j <threads> -t warp.nii.gz <SUIT template> <fixed>`: joint affine and deformable, on the CPU. The output is recorded by checksum, not expected to reproduce bit for bit.

### Atlas transfer
1. SUIT stores its label images left–anterior–superior (LAS) beside its right–anterior–superior (RAS) template on the same grid; read on the template's voxel grid, the hemispheres would swap. `on_template_grid` therefore resamples each label image onto the template grid by world position (`resample_from_to`, order 0) and checks that every label's centroid moves by at most 0.5 mm.
2. `mri_synthmorph apply -m nearest` carries the functional atlas and the SUIT lobules onto aseg's grid; the output grid is checked.
3. The functional atlas is kept to aseg's cerebellar cortex (labels 8 and 47); all other voxels are set to 0. SUIT lobules are kept whole for scoring.
4. Outputs: `mri/cerebellar-functions.mgz` and `mri/cerebellar-lobules-suit.mgz` (int16, aseg grid) and `cerebellar-registration.json` (method, pins, checks, limits). `--record` adds them to `data/sources.json`.

### Acceptance
`cerebellar_functions.checks` scores the registration against this brain's own segmentation; `accept` stops the script if any limit fails. The limits were fixed before the atlas was carried.

- Mean lobule Dice of SUIT's carried lobules with FastSurfer CerebNet's lobules over 24 shared units (`lobule_units`) ≥ 0.6. The units are ten hemispheric lobules per side (I–IV, V, VI, Crus I, Crus II, VIIb, VIIIa, VIIIb, IX, X) and four vermal units: VII (SUIT's vermal Crus I, Crus II and VIIb), VIII (VIIIa and VIIIb), IX and X.
- Fraction of aseg's cerebellar cortex the atlas labels ≥ 0.95.
- Fraction of labelled cortex on its own side (left values ≤ 16 in left cortex, right values > 16 in right cortex) ≥ 0.97.

### Regions, shares and cut volume
1. `build_regions` makes one cut-only region (`kind: tissue-region`) per functional region and side, 32 in all (`nettekoven:<side>:<region>`), with atlas colour, domain as system name, voxel count, volume in mm³ and placement. It fails if a region has no voxel, if values fall outside 0–32 or if the volume reaches beyond the cerebellar cortex.
2. `compose` counts each region's voxels in each functional region: aseg's cerebellar cortex on aseg's grid, each teaching-set lobule over its CerebNet labels (`grid_counts`). Shares ≥ 1% (`MINIMUM_FRACTION`) are stored, largest first, as `cerebellar_functions`; the share in no region is counted separately as `cerebellar_functions_unassigned`.
3. `export_cut_atlas` starts from the aparc.a2009s+aseg labels, gives every cerebellar cortex voxel the atlas labels its region's label, and writes `tissues-nettekoven.volume` (unsigned 16-bit, cropped). The atlas is registered as cut-only (`surface: false`, procedure `registered-template`).

## Display

**Cerebellar functions** in the Section dock's cut labels (URL `cuts=nettekoven`) draws the region colours on cut faces; other tissue keeps its FreeSurfer label. S3 (216, 255, 199) and S4 (255, 255, 211) are close in colour to FreeSurfer's cerebellar white matter. `CerebellarFunctionsSection.svelte` (**Functional regions (group atlas)** in the region detail) lists, for a lobule, each region it reaches with swatch, domain, share bar and percentage; the side is added when a vermal lobule reaches both sides. The share in no region is shown when ≥ 0.5%. For a functional region chosen on a cut, it shows the domain and the paper's description. Example: left lobule V is 49.4% M3 (hand), 21.3% M2 and 11.1% A2.

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| Lobule Dice with CerebNet, mean of 24 units | ≥ 0.6 | 0.65 (0.49 for left I–IV, left V and left X; 0.81 for vermal VIII) |
| Cerebellar cortex labelled by the atlas | ≥ 95% | 98.5% |
| Labelled cortex on its own side | ≥ 97% | 99.5% |
| `cerebellar_functions.validate` | Committed volume re-measures as its report; every region and share recomputes | Exact |
| `test_the_shared_lobule_units_match_suit_to_cerebnet` | 24 units; vermal VII = SUIT values 9, 12, 15 → CerebNet 630 | Passes |
| `test_the_checks_score_agreement_and_a_mirrored_atlas_fails_acceptance` | Mirrored atlas: Dice 0 for left I–IV, side agreement < 0.5 | Passes |
| `test_a_mirrored_label_header_keeps_its_world_positions_on_the_template_grid` | LAS label image keeps its world positions | Passes |
| `test_the_published_atlas_keeps_to_the_cortex_and_its_regions_to_their_side` | 32 regions, each on its side and in the cut labels | Passes |
| `test_the_published_lobules_show_the_motor_and_cognitive_halves_of_the_cerebellum` | Left lobule V > 50% motor; left Crus I > 70% demand plus social; left lobule V > 80% in left regions | Passes |

Hemispheric Dice is highest for right IX (0.78), left IX (0.76) and right Crus II (0.74).

## Limitations

- A group map, not this brain's measured function; the authors show that an individual's own localizer data place functional borders better.
- Registration from a group template places lobule borders a few millimetres off (mean lobule Dice 0.65); a region's border on a cut is approximate, a lobule's summed shares are steadier.
- Regions are named only for what holds on both sides; lateralised findings stay in the descriptions.
- Shares under 1% are omitted from the list but not counted as unassigned.
- CC BY-NC 3.0: non-commercial use only.

## Code availability

Code
: [`scripts/register_cerebellar_functions.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/register_cerebellar_functions.py) (registration), [`brain_model/layers/cerebellar_functions.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/cerebellar_functions.py) (checks, regions, shares, cut volume), called from [`brain_model/build.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/build.py)

Configuration
: [`config/cerebellar-functions.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/cerebellar-functions.yaml) (pins, acceptance limits, domains, regions); the `cerebellar_functions` layer in the anatomy's `layers` list in `config/model.yaml`

Tests
: [`tests/test_cerebellar_functions.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_cerebellar_functions.py)

```bash
# needs FreeSurfer 8.2 (SynthMorph)
uv run python scripts/register_cerebellar_functions.py --anatomy cdmd --record
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_cerebellar_functions.py
```

Figure state (panel b): https://planumatlas.com/#anatomy=cdmd&atlas=destrieux&cuts=nettekoven&cut=axial&pos=-28&cam=0,110,45,0,-28,45,0,0,-1
