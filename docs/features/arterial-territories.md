# Arterial territories

The typical territories of the cerebral arteries (Liu et al. 2023), drawn from where acute infarcts of each artery fell in 1,298 stroke patients on the Johns Hopkins University (JHU) single-subject template, are registered onto CDMD. They are shown as a per-vertex cortex colouring, a cut-label atlas, a supply list for every region and a territory table in the [lesion report](lesion-report.md). They are typical territories, not this brain's own: no vessel of CDMD was imaged.

```{figure} figures/arterial-territories-1.webp
:alt: The left hemisphere of the CDMD brain coloured by arterial territory in lateral and medial views, and two cut faces through the deep grey matter with the Arterial territories cut labels.
:name: fig-arterial-territories-1

**Fifteen branch territories per hemisphere, on the cortex and through the deep grey matter.** **a**, Lateral left hemisphere. **b**, Medial left hemisphere. a, b: Colour **Arterial territories** (`colors=territory`), internal anatomy hidden. **c**, Axial cut at surface RAS z = 24 mm, viewed from above, anterior up. **d**, Coronal cut at surface RAS y = −12 mm through the thalamus, viewed from the front (subject's right on the left). c, d: cut labels **Arterial territories** (`cuts=arterial`). Hue families: blues, anterior cerebral artery (ACA); greens, middle cerebral artery (MCA); oranges, posterior cerebral artery (PCA); purples, vertebro-basilar; lighter shades for deep branches. Ventricles and cerebrospinal fluid keep their FreeSurfer colours.
```

## Data

All files are from Chin-Fu-Liu/Acute-stroke_Detection_Segmentation at commit `159df3a34a769f804d22790752013d4e5ed04944`, pinned by sha256 in `config/arterial-territories.yaml` and cached in `data/cache/arterial-territories/`.

| Role | File | sha256 (first 12) |
| :--- | :--- | :--- |
| Atlas | `data/template/ArterialAtlas_padding.nii.gz` | `365944739786` |
| Label table | `data/template/ArterialAtlasLables.txt` | `480ffc17764e` |
| Template b0 | `data/template/JHU_SS_b0_ss_padding.nii.gz` | `445c077024e4` |

Atlas and template are 192 × 224 × 192 voxels of 1 mm. Values 1–30 are 15 branches, left odd and right the next even value; 31 and 32 are the lateral ventricles, used only to score the registration. Paper: Sci Data 10:74, [doi:10.1038/s41597-022-01923-0](https://doi.org/10.1038/s41597-022-01923-0).

| Branch (`id`) | Values (L, R) | Major artery |
| :--- | :--- | :--- |
| Anterior cerebral artery (`aca`) | 1, 2 | ACA |
| Medial lenticulostriate (`medial-lenticulostriate`) | 3, 4 | ACA |
| Lateral lenticulostriate (`lateral-lenticulostriate`) | 5, 6 | MCA |
| MCA frontal, parietal, temporal, occipital, insular (`mca-*`) | 7–16 | MCA |
| PCA temporal, occipital (`pca-*`) | 17–20 | PCA |
| Posterior choroidal and thalamoperforating | 21, 22 | PCA |
| Anterior choroidal and thalamoperforating | 23, 24 | PCA |
| Basilar, superior cerebellar, inferior cerebellar | 25–30 | Vertebro-basilar |

The atlas places the anterior choroidal and thalamoperforating territory under the posterior circulation; Planum keeps it there.

Two traps in the source:

- **Label table.** The right parietal, temporal, occipital and insular MCA rows (values 10, 12, 14, 16) repeat the left codes (`MCAPL`, `MCATL`, `MCAOL`, `MCAIL`); at level two the temporal PCA rows are swapped (left `PCAR`, right `PCAL`), and the left ventricle is coded `LVR`. Names, sides and levels are therefore taken from the values and the YAML, not the codes.
- **Header.** The template's header does not place it in MNI space: its brain centroid lies about 17 mm anterior and 20 mm inferior of the MNI152NLin6Asym brain-mask centroid. The template is therefore registered image to image, not through CDMD's MNI field.

Licence: the label file names CC BY-SA 4.0 but links the CC BY legal code; Planum takes the stricter reading, CC BY-SA 4.0. Files derived for each brain stay under it, with the changes stated ([references](../reference/references.md)).

## Method

### Registration
`scripts/register_arterial_territories.py` checks the FreeSurfer build against `freesurfer_build` in `config/model.yaml`, fetches the three files by checksum, and `check_atlas_sides` requires every odd value's centroid to lie left of the template midline and every even value's right. `read_definition` refuses a branch that is not an odd left value with the next even right value, and values that do not cover 1–32 once each. SynthMorph (FreeSurfer 8.2) then runs:

1. `mri_synthmorph register -m joint -j <threads> -t warp.nii.gz <template b0> mri/brain.mgz`: skull-stripped b0 to skull-stripped T1, joint affine and deformable;
2. `mri_synthmorph apply -m nearest warp.nii.gz <atlas> atlas.nii.gz`.

The output grid is checked against aseg's, values are rounded to int16 and written to `mri/arterial-territories.mgz` (verified unchanged on reading), and the checks and pins go to `arterial-registration.json`. SynthMorph runs on the CPU; the output is recorded by checksum, not expected to reproduce bit for bit.

### Acceptance
`arterial_territories.checks` scores the registered atlas against aseg; `accept` stops the script if any limit fails.

- Lateral ventricle Dice, aseg 4 and 43 against atlas 31 and 32: ≥ 0.6 per side. The atlas's ventricle label spills into periventricular white matter, so this is a floor, not a target.
- aseg cerebellar cortex (8, 47) in the superior or inferior cerebellar territories: ≥ 95%.
- aseg cerebral cortex and white matter (2, 3, 41, 42) in no territory, counting ventricle labels as none: ≤ 2%.
- Lateralised tissue (left 2, 3, 8, 10–13, 17, 18; right 41, 42, 47, 49–54) in a territory of its own side, by value parity: ≥ 98%.

### Cortical vertices
`territory_index` maps the atlas on aseg's grid to a 1-based territory index (0 for background and ventricles). `vertex_indices` gives each cortical vertex the index of the voxel nearest the midpoint of its pial and white positions, and fails if a sample leaves the grid. `partition_vertex_labels` carries the index onto the partitioned mesh by majority, as for [Yeo 7](functional-networks.md#method), and it is written as `_TERRITORY` (`uint8`; 0 none). A cortical region's shares count its source vertices; the medial wall and unmapped cortex carry none.

### Volumetric shares
`compose` counts, for every label of aseg, wmparc, NextBrain and CerebNet on its own grid, the voxels falling in each territory (`grid_counts`: each voxel mapped through both grids' matrices to the nearest territory voxel, 2,000,000 voxels at a time). A teaching-set unit is counted on the grid the teaching set builds from (`unit_grids`), so a unit clipped below a NextBrain floor, such as the caudal medulla, has shares of its own. Fluid spaces (aseg 4, 5, 14, 15, 24, 30, 31, 43, 44, 62, 63, 72, and teaching-set units made only of them) take none. Shares ≥ 1% (`MINIMUM_FRACTION`) are stored as `territories`, largest first; the share in no territory is counted, not inferred, as `territory_unassigned`.

### Regions and cut volume
`build_regions` makes one cut-only region per branch and side, 30 in all (`arterial:<side>:<branch>`), with colour, major artery as system name, voxel count, volume and placement; it fails if a branch has no voxel. `export_cut_atlas` gives every parenchyma voxel the atlas reaches its branch label over the aparc.a2009s+aseg labels and writes `tissues-arterial.volume` (unsigned 16-bit, cropped); cerebrospinal fluid, ventricles, choroid plexus and vessel keep their FreeSurfer labels.

## Display

Colour **Arterial territories** (group **Blood supply** in the masthead; URL `colors=territory`) paints the cortex per vertex: `attachTerritoryColors` (`network-colors.ts`) converts `_TERRITORY` to colours and throws on an index beyond the published territories; the material mixes it in by `territoryMix`, 1 only with no paint or ghost. A deep structure drawn whole takes the territory holding ≥ 50% of it (`majorityTerritoryColor`), otherwise its tissue colour. On a cut with the **Arterial territories** cut labels (`cuts=arterial`) each voxel shows its own territory and nothing else is recoloured; with other cut labels a region is painted by its majority territory only, as the status line says. `SupplySection.svelte` (**Typical arterial supply**) lists a region's shares (vertices for cortex, voxels otherwise) and the unassigned share when ≥ 0.5%. `territoryRows` (`web/src/lib/core/lesion/report.ts`) gives each territory's share of the lesion volume that lies in any territory; rows under 1% fold away.

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| Lateral ventricle Dice, left / right | ≥ 0.6 | 0.68 / 0.74 |
| Cerebellar cortex in the cerebellar territories | ≥ 95% | 97.3% |
| Cerebral cortex and white matter in no territory | ≤ 2% | 1.2% |
| Lateralised tissue in a territory of its own side | ≥ 98% | 99.6% |
| `arterial_territories.validate`; `_TERRITORY` check in `validate_atlas` | Report re-measures; every region, vertex field and share recomputes | Exact |
| `test_a_branch_must_be_an_odd_left_value_and_the_next_even_right_one` | Definition refused otherwise | Passes |
| `test_the_checks_score_this_brain_and_a_shifted_atlas_fails_acceptance` | A shifted atlas fails acceptance | Passes |
| `test_a_composition_counts_the_unassigned_share_rather_than_inferring_it` | Unassigned share counted | Passes |
| `test_the_published_deep_structures_fall_in_their_textbook_territories` | Largest territory: putamen lateral lenticulostriate; thalamus posterior choroidal and thalamoperforating; hippocampus anterior choroidal and thalamoperforating; left cerebellar cortex > 95% cerebellar arteries; fluid spaces none | Passes (left putamen 86.8%, left thalamus 94.3%, left hippocampus 56.7%, left cerebellar cortex 97.9%) |
| `test_every_territory_region_is_on_its_own_side_and_in_the_cut_labels` | 30 regions, each on its side | Passes |
| `network-colors.test.ts` | Territory index past the palette fails | Passes |

## Limitations

- Typical territories, not this brain's vessels: collateral flow and variants such as a fetal posterior communicating artery move real territories by centimetres.
- The ACA territory rests on 29 cases; the medial lenticulostriate and anterior thalamoperforating territories rest on anatomical knowledge rather than lesions.
- Borders are where one territory's lesions give way to another's, not watershed zones; border-zone probabilities are not published.
- Shares under 1% are omitted from the list but not counted as unassigned.
- CC BY-SA 4.0.

## Code availability

Code
: [`scripts/register_arterial_territories.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/register_arterial_territories.py) (registration), [`brain_model/layers/arterial_territories.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/arterial_territories.py) (checks, vertex field, shares, regions, cut volume), called from [`brain_model/build.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/build.py)

Configuration
: [`config/arterial-territories.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/arterial-territories.yaml) (pins, acceptance limits, branches, colours); the `arterial_territories` layer in the anatomy's `layers` list in `config/model.yaml`

Tests
: [`tests/test_arterial_territories.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_arterial_territories.py), `web/src/lib/engine/render/network-colors.test.ts`

```bash
# needs FreeSurfer 8.2 (SynthMorph); rerun only after a reconstruction changes
uv run python scripts/register_arterial_territories.py --anatomy cdmd --record
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_arterial_territories.py
```

Figure state (panel a): https://planumatlas.com/#anatomy=cdmd&atlas=destrieux&colors=territory&view=left&hemi=left&internal=0
