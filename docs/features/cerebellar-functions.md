# Cerebellar functions

The 32-region functional map of Nettekoven et al. (2024), carried onto this brain's cerebellar cortex as a cut-label atlas, with each cerebellar lobule's share in every region listed in the region detail.

:::{list-table}
:widths: 22 78
:stub-columns: 1

* - Where in the viewer
  - **Cerebellar functions** in the Section dock's cut labels (region colours on cut faces); the **Functional regions (group atlas)** disclosure of the region detail for a cerebellar lobule, and for a region chosen on a cut.
* - Built by
  - [`scripts/register_cerebellar_functions.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/register_cerebellar_functions.py) (registration), [`brain_model/layers/cerebellar_functions.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/cerebellar_functions.py) (regions, shares, cut volume, checks), called from [`brain_model/build.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/build.py)
* - Configuration
  - [`config/cerebellar-functions.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/cerebellar-functions.yaml); the `cerebellar_functions` layer in the anatomy's `layers` list in `config/model.yaml`
* - Source data
  - Nettekoven et al. (2024) `NettekovenSym32` atlas, SUIT template and SUIT lobules (Diedrichsen et al. 2009), from DiedrichsenLab/cerebellar_atlases at commit `6857dfa`; CC BY-NC 3.0
* - Checked by
  - [`tests/test_cerebellar_functions.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_cerebellar_functions.py); the registration's own acceptance limits; `cerebellar_functions.validate` in the [validator](../pipeline/validation.md)
:::

## What it does

The symmetric 32-region map of Nettekoven et al. (2024): a group atlas fused from seven task-based fMRI datasets, with 16 regions per hemisphere in four domains, motor, action, multiple demand, and social, linguistic and spatial. The Cerebellar functions cut labels give each cerebellar cortex voxel its region in the atlas's own colours, which group regions by functional similarity; other tissue keeps its FreeSurfer label. Each cerebellar lobule, and aseg's cerebellar cortex, lists its share in each region.

It is a group map placed on this brain, not this brain's measured function. CerebNet's native lobules are a separate layer: see [Internal anatomy](internal-anatomy.md).

## Data

All from [DiedrichsenLab/cerebellar_atlases](https://github.com/DiedrichsenLab/cerebellar_atlases) at commit `6857dfa732de6dd60c94da2f84d0b15ccf316618`, each file pinned by sha256 in `config/cerebellar-functions.yaml` (the fetch fails on a mismatch) and downloaded to `data/cache/cerebellar-atlases/`:

| Role | File | sha256 (first 12) |
| :--- | :--- | :--- |
| SUIT template | `tpl-SUIT/tpl-SUIT_T1w.nii` | `9c84dd5d2dc3` |
| Functional atlas | `Nettekoven_2024/atl-NettekovenSym32_space-SUIT_dseg.nii` | `82f06b102bafac7b3ba7` |
| Atlas colour table | `Nettekoven_2024/atl-NettekovenSym32.lut` | `33a723b32cb8` |
| SUIT lobules (Diedrichsen et al. 2009), carried only to score the registration; not published | `Diedrichsen_2009/atl-Anatom_space-SUIT_dseg.nii` | `cd9485752b10` |
| SUIT lobule names | `Diedrichsen_2009/atl-Anatom.tsv` | `dc682c847972` |

Licence: CC BY-NC 3.0 Unported. `tpl-SUIT/LICENSE` covers the SUIT template "and atlases", and the atlas's own page names the same licence. The files derived for each brain credit Nettekoven et al. (2024) and Diedrichsen (2006) and state the changes: registration to the subject and restriction to its cerebellar cortex. Paper: Nat Commun 15:8376, [doi:10.1038/s41467-024-52371-w](https://doi.org/10.1038/s41467-024-52371-w), PMID 39333089.

The atlas values are 1 to 16 for the regions on the left and 17 to 32 for the same regions on the right (`value_of`). The 16 regions, in the atlas's order, with the domain and the description the viewer shows (what the paper found; the names keep only what holds on both sides):

| Region | Domain | Description shown |
| :--- | :--- | :--- |
| M1 · oculomotor | Motor | The oculomotor vermis, most active for saccades, and also during reading, film watching and visual search |
| M2 · tongue | Motor | A lateral part most active for tongue movements and a vermal part active for several body movements |
| M3 · hand | Motor | Selectively active for movements of the hand on its own side |
| M4 · lower body | Motor | Most active for movements of the lower body, such as foot flexion and contraction of the gluteal muscles |
| A1 · action | Action | Active when actions are observed, and especially for tasks that require spatial simulation, such as mental rotation |
| A2 · action | Action | A classic action-observation region, with little response to tasks that neither show nor perform an action |
| A3 · action | Action | Active when actions are observed and also when movements are imagined |
| D1 · multiple demand | Multiple demand | Active for executive control, such as updating, shifting and inhibition; the most medial part of Crus I and II |
| D2 · multiple demand | Multiple demand | Active for executive control; the innermost layer of the demand regions, repeated in lobule IX |
| D3 · multiple demand | Multiple demand | Active for executive control; the outermost layer of the demand regions, with vermal parts in lobules IV and IX |
| D4 · multiple demand | Multiple demand | The smallest region, functionally closest to D1; the most lateral of the demand regions |
| S1 · social, linguistic, spatial | Social, linguistic and spatial | The most medial of these regions, in the depth of the horizontal fissure; on the right, most active for language, such as verb generation |
| S2 · social, linguistic, spatial | Social, linguistic and spatial | Most active for social processing, such as a theory-of-mind task on the right and an animated film on the left; active at rest |
| S3 · social, linguistic, spatial | Social, linguistic and spatial | Overlaps S2 and S4 so much that it can be told apart from them only in an individual's own data; active at rest |
| S4 · social, linguistic, spatial | Social, linguistic and spatial | The most lateral tips of Crus I and II; most active for imagination and self-projection, such as imagining walking through a familiar home |
| S5 · social, linguistic, spatial | Social, linguistic and spatial | Active for imagination, spatial working memory and action observation, between this domain and the action regions |

Names keep the code with what holds on both sides of a symmetric atlas (M1 oculomotor, M2 tongue, M3 hand, M4 lower body, and the domain for the rest). What the paper found on one side only, such as right S1's language responses, stays in the description. English and French names and descriptions are in the YAML; the colours are the atlas's own, and the build script checks each against the `.lut` file (a region's code, side letter and colour rounded from the LUT's 0 to 1 values).

## How it was built

### 1. Fetch and check the sources

`fetch` in the registration script downloads each file from `raw.githubusercontent.com` at the pinned commit, verifies its checksum, and `check_tables` verifies that the definition's region order, names and colours are the atlas's own and that SUIT's lobule table lists the 28 lobules in the order `SUIT_LOBULES` reads them (I_IV and V for left and right; VI to X for left, vermis and right).

### 2. Register the SUIT template

SynthMorph (FreeSurfer 8.2, checked against `freesurfer_build` in `config/model.yaml`) registers the template to the subject:

- **Fixed image.** `mri/brain.mgz`, kept to aseg's infratentorial compartment as SUIT normalisation does: aseg labels 7, 8, 15, 16, 46 and 47 (cerebellar white matter and cortex on both sides, fourth ventricle, brainstem), dilated by 4 voxels (`MARGIN`) so that the template's edges meet tissue and fluid as they do in the template.
- **Command.** `mri_synthmorph register -m joint -j <threads> -t warp.nii.gz <SUIT template> <fixed>`, joint affine and deformable. It runs on the CPU, takes about 5 minutes and 6.5 GB, and its output is recorded by checksum rather than expected to reproduce bit for bit.

### 3. Carry both atlases

- **Header trap.** SUIT stores its label images LAS beside its RAS template on the same box, and SynthMorph's `apply` reads an image on the template's voxel grid: read directly, the hemispheres swap (2.5% of labels on their own side). `on_template_grid` resamples each label image onto the template's grid by world position (`resample_from_to`, order 0) first and checks that every label's centroid keeps its world position within 0.5 mm.
- **Apply.** `mri_synthmorph apply -m nearest` carries the functional atlas and the SUIT lobules onto aseg's grid; the script checks that the output is on aseg's grid.
- **Restrict.** The functional atlas is kept to aseg's cerebellar cortex (labels 8 and 47, `CEREBELLAR_CORTEX`); everything else is set to 0. SUIT's lobules are kept whole, to be scored.
- **Write.** `mri/cerebellar-functions.mgz` and `mri/cerebellar-lobules-suit.mgz` (int16, on aseg's grid) under the anatomy's source directory, and `cerebellar-registration.json` with the method, the source pins, the measured checks and the acceptance limits. `--record` adds the files to `data/sources.json` with their checksums, procedure, citation and licence.

### 4. Accept or refuse

`cerebellar_functions.checks` scores the registration against this brain's own segmentation; `accept` raises, and the script exits, if a limit fails. The limits were written before the atlas was carried; they reject a failed registration, not a millimetre's drift.

### 5. Build regions, shares and the cut volume

1. **Regions.** `build_regions` makes one cut-only region (`kind` `tissue-region`) per functional region and hemisphere, 32 in all, ids `nettekoven:<side>:<region>`, with the atlas's colour, its domain as the system name, the voxel count, the volume in mm³ and the placement fields `brain_model.labels.placement.placements` computes for it. It fails if a region has no voxel. It also checks the volume's values are 0 to 32, that it reaches nowhere beyond the cerebellar cortex, and that it lies on aseg's grid.
2. **Shares.** `compose` counts the voxels of each cerebellar region in each atlas region: aseg's cerebellar cortex on aseg's own grid, and each teaching-set lobule on the CerebNet labels it is a union of (`grid_counts`, shared with [Arterial territories](arterial-territories.md)). The share of each region at least 1% (`MINIMUM_FRACTION`) is kept, largest first, as `cerebellar_functions`; the share in no region is kept separately as `cerebellar_functions_unassigned`. Shares under 1% are left out of the list but not counted as unassigned.
3. **Cut volume.** `export_cut_atlas` copies aparc+aseg's labels and gives every cerebellar cortex voxel the atlas reaches its region's label (one label per region and side, with the atlas colour), then writes `tissues-nettekoven.volume` as an unsigned 16-bit cropped volume with the label table and method statement. The atlas is registered in the manifest as a cut-only atlas (`surface: false`, procedure `registered-template`).
4. **Metadata and limitations.** `metadata` writes the label, DOI, licence, domains, region definitions, registration checks and the method statement into the manifest's `cerebellar_functions` entry; `limitations` adds the group-map and registration statements.

## How the viewer uses it

- `web/src/features/sections/section-text.ts` names the cut atlas as group functional cerebellar regions registered onto this brain; `web/src/lib/core/i18n/areas/atlases.ts` titles it "Functional cerebellar atlas (Nettekoven et al. 2024)".
- A cut face reads the `tissues-nettekoven.volume` labels like any cut-label atlas; see [Sections and cuts](sections-and-cuts.md). S3 and S4 are nearly as pale as FreeSurfer's cerebellar white matter.
- `web/src/features/inspector/CerebellarFunctionsSection.svelte` shows, for a lobule, a row for each region it reaches (swatch, name, domain, share bar and percentage; the side is added for a vermal lobule that reaches both sides' regions), then the share in none if at least 0.5%, then a note on how shares are counted. For a region chosen on a cut it shows the domain and the paper's description instead. The caveat is shown in both cases. A region the atlas does not reach has no section.
- Left lobule V is about half M3, the region for movements of the hand on its own side.

## Checks

Written to `cerebellar-registration.json` at build, and re-measured by `cerebellar_functions.validate`, which also recomputes every region and every share.

| Check | Limit | CDMD |
| :--- | :--- | :--- |
| Lobule Dice with CerebNet, mean of 24 shared units | ≥ 0.6 | 0.65 (0.49 to 0.81) |
| Cerebellar cortex the atlas reaches | ≥ 95% | 98.5% |
| Labelled cortex on its own side | ≥ 97% | 99.5% |

The 24 shared units are the ten hemispheric lobules on each side (I–IV, V, VI, Crus I, Crus II, VIIb, VIIIa, VIIIb, IX, X; 20 units) and four vermal units (VII, VIII, IX, X), matching SUIT's values to CerebNet's `Cbm_*` values (`lobule_units`). The vermal VII unit is the union of SUIT's vermal Crus I, Crus II and VIIb; VIII is VIIIa and VIIIb. By unit, Dice runs from 0.49 (left I–IV, left V and left X) to 0.81 (vermal VIII); the highest hemispheric units are left and right IX (0.76 and 0.78) and right Crus II (0.74).

The tests check the definition (a stray key or missing region is refused), that values name each region on its side, that the shared lobule units match SUIT to CerebNet, that the checks score agreement and a mirrored atlas fails acceptance, that a mirrored label header keeps its world positions on the template grid, that the published atlas keeps to the cortex with 32 regions each on its own side and a side agreement of at least 0.97, and that the published lobule shares show the motor and cognitive halves of the cerebellum (lobule V mostly motor; Crus I mostly demand and social, linguistic and spatial; a left lobule more than 80% in the left regions).

## Limits

- A group map, not this brain's measured function; the authors show that an individual's own localizer data place functional borders better.
- Registration from a group template places lobule borders a few millimetres off: SUIT's own lobules, carried by the same warp, meet this brain's CerebNet lobules at a mean Dice of 0.65. A region's border on a cut is approximate; a lobule's shares, summed over its whole volume, are steadier.
- Regions are named for what holds on both sides; the paper's lateralised or tendency findings stay in each region's description.
- Licensed CC BY-NC 3.0: non-commercial use.

### Alternatives considered

The MNI2009cSym route (the atlas in MNI space rather than on the SUIT template) was measured and was no better: lobule Dice 0.64 and coverage 93.9%, against 0.65 and 98.5% by the SUIT template.

## Reproduce

```bash
# needs FreeSurfer 8.2 (SynthMorph); about 5 minutes and 6.5 GB on the CPU
uv run python scripts/register_cerebellar_functions.py --anatomy cdmd --record
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_cerebellar_functions.py
```

## See also

- [Internal anatomy](internal-anatomy.md), for CerebNet's lobules, which the registration is scored against
- [Sections and cuts](sections-and-cuts.md)
- [Striatal networks](striatal-networks.md) and [Arterial territories](arterial-territories.md), built by the same registration pattern
- [References](../reference/references.md) (Nettekoven et al. 2024; Diedrichsen et al. 2009) and the [building guide](../pipeline/building.md)
