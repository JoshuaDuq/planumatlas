# Arterial territories

Planum shows the typical territories of the cerebral arteries (Liu et al. 2023) on its individual brain, subject `sub_013` of the Connectome Diffusion Microstructure Dataset (CDMD). The atlas was drawn from where acute infarcts of each artery fell in 1,298 stroke patients, on the Johns Hopkins University (JHU) single-subject template, and was registered onto CDMD with SynthMorph. The territories are shown as a per-vertex cortex colouring, a cut-label atlas, a supply list for every region and a territory table in the [lesion report](lesion-report.md). They are typical territories; no vessel of this brain was imaged. The same registration places them on the [MNI template](mni-template.md#registered-group-maps).

```{figure} figures/arterial-territories-1-light.webp
:alt: The left hemisphere of the CDMD brain coloured by arterial territory, seen from its lateral and medial sides, and an axial and a coronal cut through the deep grey matter coloured by arterial territory, above a key of the fifteen territories.
:name: fig-arterial-territories-1

**Fifteen branch territories per hemisphere colour the cortex and the deep grey matter.** **a**, [Lateral surface](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&view=left&hemi=left&internal=0&colors=territory) of the left hemisphere. **b**, [Medial surface](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&view=right&hemi=left&internal=0&colors=territory) of the left hemisphere. In **a** and **b**, **Colour** is set to **Arterial territories** and the internal anatomy is hidden. **c**, [Axial cut](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&colors=territory&cut=axial&pos=24&view=superior) at surface RAS z = 24 mm, seen from above, anterior up. **d**, [Coronal cut](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&colors=territory&cut=coronal&pos=-12&view=anterior) at surface RAS y = −12 mm through the thalamus, seen from the front (the subject's right on the image's left). In **c** and **d** the cut is labelled by territory voxel by voxel under the same colour. The key gives the territories. Blues are the anterior cerebral artery (ACA), greens the middle cerebral artery (MCA), oranges the posterior cerebral artery (PCA) and purples the vertebro-basilar system, with lighter shades for deep branches. Ventricles and cerebrospinal fluid keep their FreeSurfer colours. Scale bars apply at the depth of the camera's target.
```

## Data

All files are from Chin-Fu-Liu/Acute-stroke_Detection_Segmentation at commit `159df3a34a769f804d22790752013d4e5ed04944`. They are pinned by sha256 in `config/arterial-territories.yaml` and cached in `data/cache/arterial-territories/`.

| Role | File | sha256 (first 12) |
| :--- | :--- | :--- |
| Atlas | `data/template/ArterialAtlas_padding.nii.gz` | `365944739786` |
| Label table | `data/template/ArterialAtlasLables.txt` | `480ffc17764e` |
| Template b0 | `data/template/JHU_SS_b0_ss_padding.nii.gz` | `445c077024e4` |

The atlas and the template are 192 × 224 × 192 voxels of 1 mm. The template is the skull-stripped b0 image of the JHU single-subject template, the volume acquired without diffusion weighting. Values 1–30 code 15 branches, each with an odd value on the left and the next even value on the right. Values 31 and 32 are the lateral ventricles, which are used only to score the registration. The atlas is published in Sci Data 10:74, [doi:10.1038/s41597-022-01923-0](https://doi.org/10.1038/s41597-022-01923-0).

The atlas's second level groups the branches under four major arteries: the anterior cerebral artery (ACA), the middle cerebral artery (MCA), the posterior cerebral artery (PCA) and the vertebro-basilar arteries.

| Branch (`id`) | Values (L, R) | Major artery |
| :--- | ---: | :--- |
| Anterior cerebral artery (`aca`) | 1, 2 | ACA |
| Medial lenticulostriate (`medial-lenticulostriate`) | 3, 4 | ACA |
| Lateral lenticulostriate (`lateral-lenticulostriate`) | 5, 6 | MCA |
| MCA frontal, parietal, temporal, occipital, insular (`mca-*`) | 7–16 | MCA |
| PCA temporal, occipital (`pca-*`) | 17–20 | PCA |
| Posterior choroidal and thalamoperforating (`posterior-choroidal-thalamoperforating`) | 21, 22 | PCA |
| Anterior choroidal and thalamoperforating (`anterior-choroidal-thalamoperforating`) | 23, 24 | PCA |
| Basilar, superior cerebellar, inferior cerebellar (`basilar`, `superior-cerebellar`, `inferior-cerebellar`) | 25–30 | Vertebro-basilar |

The atlas places the anterior choroidal and thalamoperforating territory under the posterior circulation. Planum keeps it there.

The label table miscodes several rows. The right parietal, temporal, occipital and insular MCA rows (values 10, 12, 14, 16) repeat the left codes (`MCAPL`, `MCATL`, `MCAOL`, `MCAIL`). At level two the temporal PCA rows are swapped (left `PCAR`, right `PCAL`), and the left ventricle is coded `LVR`. Names, sides and levels are therefore taken from the values and the YAML, not the codes.

The template's header does not place it in Montreal Neurological Institute (MNI) space. Its brain centroid lies about 17 mm anterior and 20 mm inferior of the MNI152NLin6Asym brain-mask centroid. The template was therefore registered image to image, not through CDMD's MNI field.

The label file names CC BY-SA 4.0 but links the CC BY legal code. Planum takes the stricter reading, CC BY-SA 4.0. Files derived for each brain stay under it, with the changes stated ([references](../reference/references.md)).

## Method

### Registration

`scripts/register_arterial_territories.py` checked its inputs before it registered anything. It compared the FreeSurfer build against the one the anatomy was reconstructed with (`freesurfer_build` in `config/model.yaml`, or the anatomy's own). `read_definition` refused a branch that was not an odd left value with the next even right value, and values that did not cover 1–32 once each. The script then fetched the three files by checksum, and `check_atlas_sides` required every odd value's centroid to lie left of the template midline and every even value's right. SynthMorph (FreeSurfer 8.2) then ran in two steps.

1. `mri_synthmorph register -m joint -j <threads> -t warp.nii.gz <template b0> mri/brain.mgz` registered the skull-stripped b0 to the skull-stripped T1-weighted image, with a joint affine and deformable transform.
2. `mri_synthmorph apply -m nearest warp.nii.gz <atlas> atlas.nii.gz` carried the atlas across by nearest neighbour.

The output grid was checked against the grid of `aseg`, FreeSurfer's segmentation of this brain. The values were rounded to `int16` and written to `mri/arterial-territories.mgz`, and the file was read back to verify that no value had changed. The checks, the acceptance limits, the pins and the FreeSurfer build went to `arterial-registration.json`. SynthMorph ran on the central processing unit (CPU). Its output is recorded by checksum, not expected to reproduce bit for bit.

### Acceptance

`arterial_territories.checks` scored the registered atlas against `aseg`, and `accept` stopped the script if any of four limits failed.

- The Dice coefficient between each lateral ventricle of `aseg` (labels 4 and 43) and the atlas's ventricle label (31 and 32) had to be ≥ 0.6 per side. The atlas's ventricle label spills into periventricular white matter, so the threshold is a lower bound.
- The share of `aseg` cerebellar cortex (labels 8 and 47) in the superior or inferior cerebellar territories had to be ≥ 95%.
- The share of `aseg` cerebral cortex and white matter (labels 2, 3, 41 and 42) in no territory, counting the ventricle labels as none, had to be ≤ 2%.
- Among the lateralised tissue that lies in a territory (left labels 2, 3, 8, 10–13, 17 and 18; right labels 41, 42, 47 and 49–54), the share in a territory of its own side, judged by the parity of the value, had to be ≥ 98%.

### Cortical vertices

`territory_index` mapped the atlas on the `aseg` grid to a 1-based territory index, with 0 for background and ventricles. `vertex_indices` gave each cortical vertex the index of the voxel nearest the midpoint of its pial and white positions. It fails if a sample leaves the grid. `partition_vertex_labels` carried the index onto the partitioned mesh by majority, as for [Yeo 7](functional-networks.md#method). The index is written as the vertex attribute `_TERRITORY` (`uint8`; 0 none). A cortical region's shares count its source vertices. The medial wall and unmapped cortex carry none.

### Volumetric shares

`compose` counted, for every label of `aseg`, `wmparc`, NextBrain and CerebNet on its own grid, the voxels falling in each territory. For this, `grid_counts` mapped each voxel through both grids' matrices to the nearest territory voxel, 2,000,000 voxels at a time. A teaching-set unit was counted on the grid the teaching set builds from (`unit_grids`), so a unit clipped below a NextBrain floor, such as the caudal medulla, has shares of its own. Fluid spaces take none: these are `aseg` labels 4, 5, 14, 15, 24, 30, 31, 43, 44, 62, 63 and 72, and teaching-set units made only of them. Shares ≥ 1% (`MINIMUM_FRACTION`) are stored as `territories`, largest first. The share in no territory is counted, not inferred, and stored as `territory_unassigned`.

A structure under 100 mm³ takes no shares ([registration landing](registration-landing.md#the-small-structure-rule)). It stores `territories_near` instead: the territories holding at least 1% of the labelled atlas voxels within 3 mm of it, largest first. On CDMD 345 structures are named this way (318 NextBrain, 27 teaching-set units). Of these, 82 are named by one territory and 263 by two to five, where a border passes within 3 mm. For each of the 67 one-territory structures that had shares before the rule, the name is the territory that held its largest share. The MNI template has no landing record, so there a structure under 100 mm³ takes no shares and names no territory.

### Regions and cut volume

`build_regions` made one cut-only region per branch and side, 30 in all (`arterial:<side>:<branch>`). Each region carries its colour, its major artery as system name, its voxel count, its volume and its placement. The function fails if a branch has no voxel. `export_cut_atlas` gave every parenchyma voxel that the atlas reaches its branch label, over the `aparc.a2009s+aseg` labels, and wrote `tissues-arterial.volume` (unsigned 16-bit, cropped). Cerebrospinal fluid, ventricles, choroid plexus and vessel keep their FreeSurfer labels.

## Display

Colour **Arterial territories** (group **Blood supply** in the masthead; URL `colors=territory`) paints the cortex per vertex (Fig. 1a,b). `paletteTexture` (`network-colors.ts`) holds one colour per published territory, and each vertex's colour is looked up by its `_TERRITORY` index. `checkTerritories` throws on an index beyond the published territories. The material mixes the colour in by `territoryMix`, which is 1 only with no paint or ghost.

A deep structure drawn whole takes the territory holding ≥ 50% of it (`majorityTerritoryColor`), otherwise its tissue colour. A structure under 100 mm³ takes a territory's colour only when that territory alone lies within 3 mm.

A cut under this colour samples `tissues-arterial.volume` ([which labels a cut samples](sections-and-cuts.md#which-labels-a-cut-samples)). Each voxel shows its own territory, structure caps included, and nothing else is recoloured (Fig. 1c,d). The stage's surfaces keep painting per vertex. Only a build without the arterial volume paints a cut region by its majority territory, as the status line then says.

`SupplySection.svelte` (**Typical arterial supply**) lists a region's shares, of vertices for cortex and of voxels otherwise, and the unassigned share when it is ≥ 0.5%. For a structure under 100 mm³ it lists the names in `territories_near` without bars or percentages and says whether a border passes within 3 mm. In the lesion report, `territoryRows` (`web/src/lib/core/lesion/report.ts`) gives each territory's share of the lesion volume that lies in any territory. Rows under 1% fold away.

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
| `test_the_published_deep_structures_fall_in_their_textbook_territories` | Deep structures in their textbook territories; fluid spaces in none | Passes |
| `test_every_territory_region_is_on_its_own_side_and_in_the_cut_labels` | 30 regions, each on its side | Passes |
| `network-colors.test.ts` | Territory index past the palette fails | Passes |

The first four rows are the acceptance checks, as measured on CDMD and recorded in `arterial-registration.json`. `arterial_territories.validate` reports 1,612 regions with shares and 345 small structures named (`arterial_territories` in `validation.json`).

`test_the_published_deep_structures_fall_in_their_textbook_territories` reads the published manifest. It requires the largest territory of the putamen to be the lateral lenticulostriate, that of the thalamus the posterior choroidal and thalamoperforating, and that of the hippocampus the anterior choroidal and thalamoperforating. It requires > 95% of the left cerebellar cortex to lie in the cerebellar arteries' territories, and the fluid spaces to carry no share. It also requires the teaching set's caudal medulla to have shares of its own that reach no thalamoperforating territory. On CDMD the largest territory holds 86.8% of the left putamen, 94.3% of the left thalamus and 56.7% of the left hippocampus, and the cerebellar arteries hold 97.9% of the left cerebellar cortex.

## Limitations

The territories are typical, not this brain's vessels. Collateral flow and variants such as a fetal posterior communicating artery move real territories by centimetres.

The ACA territory rests on 29 cases. The medial lenticulostriate and anterior thalamoperforating territories rest on anatomical knowledge rather than lesions.

Borders are where one territory's lesions give way to another's, not watershed zones. Border-zone probabilities are not published.

Shares under 1% are omitted from the list but not counted as unassigned.

The files derived from the atlas stay under CC BY-SA 4.0.

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

