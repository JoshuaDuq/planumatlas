# Arterial territories

The typical territories of the cerebral arteries (Liu et al. 2023), registered onto this brain and shown as a cortex colouring, a cut-label atlas, a supply list in the region detail and a territory table in the lesion report.

:::{list-table}
:widths: 22 78
:stub-columns: 1

* - Where in the viewer
  - **Blood supply** in the masthead's Colour field; **Arterial territories** in the Section dock's cut labels; the **Typical arterial supply** disclosure of the region detail; the territory rows of the lesion report.
* - Built by
  - [`scripts/register_arterial_territories.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/register_arterial_territories.py) (registration), [`brain_model/layers/arterial_territories.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/arterial_territories.py) (regions, per-vertex field, shares, cut volume, checks), called from [`brain_model/build.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/build.py)
* - Configuration
  - [`config/arterial-territories.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/arterial-territories.yaml); the `arterial_territories` layer in the anatomy's `layers` list in `config/model.yaml`
* - Source data
  - Liu et al. (2023) Arterial Atlas and its JHU single-subject template b0, from Chin-Fu-Liu/Acute-stroke_Detection_Segmentation at commit `159df3a`; CC BY-SA 4.0
* - Checked by
  - [`tests/test_arterial_territories.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_arterial_territories.py); the registration's own acceptance limits; `arterial_territories.validate` and the `_TERRITORY` field check in the [validator](../pipeline/validation.md); `web/src/lib/engine/render/network-colors.test.ts`
:::

## What it does

Typical territories of the cerebral arteries (Liu et al. 2023): where acute infarcts of each artery fell in 1,298 stroke patients, traced on diffusion MRI and drawn on the JHU single-subject template.

- **Colour.** The Blood supply colouring paints the cortex per vertex, each taking the territory at the midpoint of its pial and white positions. A cut with the arterial cut labels shows each voxel's territory and recolours nothing else; any other cut labels show a region in the territory holding a majority of it, and in tissue colour without one.
- **Supply.** Each region carries its territory shares and, counted separately, the share in no territory: of its pial vertices for a cortical area, of its voxels otherwise, and for a teaching-set unit of its source labels' voxels on the grid the teaching set builds from (clipped where a unit stops at a NextBrain floor). Shares under 1% are left out of the list but not counted as unassigned. Ventricles, CSF and choroid plexus take no shares. The inspector lists them; a lesion reports the share of its territory-labelled volume in each territory.
- **Two levels.** Fifteen branches per hemisphere, each under one of four major arteries: anterior, middle and posterior cerebral, and vertebro-basilar. The atlas places the anterior choroidal and thalamoperforating territory under the posterior circulation, and Planum keeps it there.

They are typical territories, not this brain's own vessels: CDMD has no angiography.

## Data

All from [Chin-Fu-Liu/Acute-stroke_Detection_Segmentation](https://github.com/Chin-Fu-Liu/Acute-stroke_Detection_Segmentation) at commit `159df3a34a769f804d22790752013d4e5ed04944`, pinned by sha256 in `config/arterial-territories.yaml` (the fetch fails on a mismatch) and cached in `data/cache/arterial-territories/`:

| Role | File | sha256 (first 12) |
| :--- | :--- | :--- |
| Atlas | `data/template/ArterialAtlas_padding.nii.gz` | `365944739786` |
| Label table | `data/template/ArterialAtlasLables.txt` | `480ffc17764e` |
| Template b0 | `data/template/JHU_SS_b0_ss_padding.nii.gz` | `445c077024e4` |

Paper: Sci Data 10:74, [doi:10.1038/s41597-022-01923-0](https://doi.org/10.1038/s41597-022-01923-0), PMID 36739282. NITRC, which holds the MNI152 version and the probability maps, needs a login and is not used.

**Licence.** The atlas's label file names CC BY-SA 4.0 but links the CC BY legal code; Planum takes the stricter reading, CC BY-SA 4.0 (the repository's code is GPL-3.0). The arterial territory files derived for each brain stay under CC BY-SA 4.0, with Liu et al. (2023) credited and the changes stated (registration of the atlas's template to the subject, nearest-neighbour transfer, and per-vertex and per-region territories drawn from it). The rest of each cortex mesh keeps its own source's terms.

**Branches.** Values are 1 to 30, plus the two lateral ventricle labels 31 and 32, which are used to check the registration and never published. The atlas numbers each branch's left side odd and its right side the next even value; the build checks that by position, and `read_definition` refuses a branch that is not an odd left value and the next even right value, and values that do not cover 1 to 32 once each.

| Branch (id) | Values (L, R) | Major artery |
| :--- | :--- | :--- |
| Anterior cerebral artery (`aca`) | 1, 2 | ACA |
| Medial lenticulostriate (`medial-lenticulostriate`) | 3, 4 | ACA |
| Lateral lenticulostriate (`lateral-lenticulostriate`) | 5, 6 | MCA |
| Middle cerebral artery, frontal (`mca-frontal`) | 7, 8 | MCA |
| Middle cerebral artery, parietal (`mca-parietal`) | 9, 10 | MCA |
| Middle cerebral artery, temporal (`mca-temporal`) | 11, 12 | MCA |
| Middle cerebral artery, occipital (`mca-occipital`) | 13, 14 | MCA |
| Middle cerebral artery, insular (`mca-insular`) | 15, 16 | MCA |
| Posterior cerebral artery, temporal (`pca-temporal`) | 17, 18 | PCA |
| Posterior cerebral artery, occipital (`pca-occipital`) | 19, 20 | PCA |
| Posterior choroidal and thalamoperforating (`posterior-choroidal-thalamoperforating`) | 21, 22 | PCA |
| Anterior choroidal and thalamoperforating (`anterior-choroidal-thalamoperforating`) | 23, 24 | PCA |
| Basilar (`basilar`) | 25, 26 | Vertebro-basilar |
| Superior cerebellar (`superior-cerebellar`) | 27, 28 | Vertebro-basilar |
| Inferior cerebellar (`inferior-cerebellar`) | 29, 30 | Vertebro-basilar |

Colours keep each major artery in one hue family (blues for ACA, greens for MCA, oranges for PCA, purples for vertebro-basilar), lighter for deep branches. English and French names are in the YAML.

**Label table traps.** The published table repeats three left codes for right branches and swaps the PCA sides at level two. The volume itself numbers each branch's left side odd and its right side even, which the script checks by position, so names and levels come from the label values, not the codes.

**Header trap.** The repository's header does not place the template in MNI space: it lies about 18 mm forward and 19 mm low. Pulled back through CDMD's own MNI field, the atlas gave a ventricle Dice of 0.07. This is why the template is registered image to image rather than through CDMD's MNI field.

## How it was built

### 1. Register the template

`scripts/register_arterial_territories.py` checks the FreeSurfer build against `freesurfer_build` in `config/model.yaml`, fetches the three files by checksum, and runs `check_atlas_sides`: every odd value's centroid must lie left of the template's midline and every even value's right. Then SynthMorph (FreeSurfer 8.2):

1. `mri_synthmorph register -m joint -j <threads> -t warp.nii.gz <template b0> mri/brain.mgz`, joint affine and deformable, from the skull-stripped b0 to the anatomy's skull-stripped T1;
2. `mri_synthmorph apply -m nearest warp.nii.gz <atlas> atlas.nii.gz`, carrying the atlas by nearest neighbour, which keeps its values integer.

The script checks that the output is on aseg's grid, rounds to int16 and writes `mri/arterial-territories.mgz`, checking that writing changed no value, then `arterial-registration.json` with the method, the source pins, the checks and the limits. It runs on the CPU in about 8 minutes and 6.5 GB, and its output is recorded by checksum rather than expected to reproduce bit for bit. `--record` adds the files to `data/sources.json`.

### 2. Accept or refuse

`arterial_territories.checks` scores the registered atlas against this brain's own segmentation, and `accept` raises, and the script exits, if a limit fails. The atlas's ventricle label is a coarse mask that spills into periventricular white matter, so its Dice is a floor rather than a target. A hand-fitted three-parameter shift scored 0.70 and 0.74 but covered the cerebellum and cortex worse, and was not used.

### 3. Cortical vertices

In `build_cortex`, `territory_index` loads the atlas on aseg's grid as a 1-based territory index (0 for none; ventricles and background carry none), and `vertex_indices` gives each pial vertex the index at the voxel nearest the midpoint of its pial and white positions (it fails if a sample falls outside the grid). `partition_vertex_labels` carries it onto the partitioned mesh by majority, as for the Yeo networks (see [Functional networks](functional-networks.md#how-it-was-built)), and it is written to the glTF as `_TERRITORY` (`uint8`; 0 none). A cortical region's shares are counted over its source vertices; the medial wall and unmapped cortex are not regions and carry none.

### 4. Regions, shares and the cut volume

1. **Regions.** `build_regions` makes one cut-only region (`kind` `tissue-region`) per branch and hemisphere, 30 in all, ids `arterial:<side>:<branch>`, with the branch's colour, its major artery as the system name, voxel count, volume and placement. It fails if a branch has no voxel.
2. **Shares.** `compose` counts, for every label of aseg, wmparc, NextBrain and CerebNet on its own grid (`grid_counts`, 2,000,000 voxels at a time), how many voxels fall in each territory, mapping each voxel through both grids' matrices to the nearest territory voxel. A volumetric region takes the shares of its voxels; a teaching-set unit takes those of its source labels' voxels on the grid the teaching set builds from, which the build passes as `unit_grids` (the teaching set clips some aseg units below a NextBrain floor, so its caudal medulla has its own shares). Fluid spaces (aseg's CSF, ventricle, choroid plexus and vessel labels 4, 5, 14, 15, 24, 30, 31, 43, 44, 62, 63 and 72, and teaching-set units wholly of them) take none. Shares of at least 1% (`MINIMUM_FRACTION`) are kept, largest first, as `territories`; the share in no territory is kept separately as `territory_unassigned`, counted rather than inferred, so the slivers left out are not mistaken for unassigned tissue. Cortical areas take theirs from step 3.
3. **Cut volume.** `export_cut_atlas` gives every parenchyma voxel the atlas reaches its branch's label over aparc+aseg's labels, writes `tissues-arterial.volume` (unsigned 16-bit, cropped), and leaves CSF, ventricles, choroid plexus and vessel with their FreeSurfer labels. The atlas is registered as a cut-only atlas (`surface: false`, procedure `registered-template`).
4. **Metadata and limitations.** `metadata` writes the label, DOI, licence, attribute `_TERRITORY`, the four major arteries, the branches, the registration checks and the method; `limitations` states the typical-territory, case-count and border statements below.

## How the viewer uses it

- **Cortex.** `attachTerritoryColors` (`web/src/lib/engine/render/network-colors.ts`) reads the `_territory` attribute, refuses an index above the number of published territories, and writes `_territoryColor`; the cortex material mixes it in by `territoryMix`, set to 1 only under Blood supply with no paint or ghost.
- **Deep structures.** A region drawn whole takes the colour of the territory holding at least half of it (`majorityTerritoryColor`), and its tissue colour without one.
- **Cut faces.** `palette.ts` `territoryColor`: with the arterial cut labels chosen, each voxel keeps its own territory colour and nothing else is recoloured; a voxel the atlas leaves out, or a fluid space, shows its tissue colour. With other cut labels, a region is painted by the territory holding most of it, only where one holds a majority; the status line says so (`territoryByRegion`).
- **Key.** `stage-keys.ts` lists each territory with its swatch while Blood supply colours the brain.
- **Region detail.** `SupplySection.svelte` lists a region's territory shares with swatch and bar (vertices for cortex, voxels otherwise), the share in no territory when it is at least 0.5%, and the caveat. A region the atlas does not reach has no section.
- **Lesion report.** `territoryRows` (`web/src/lib/core/lesion/report.ts`) lists the territories a lesion lies in, largest first, each row's share being of the lesion volume that falls in some territory rather than of the territory; under 1% folds away.

## Checks

Written to `arterial-registration.json` at build, and re-measured by `arterial_territories.validate`, which also recomputes every region and the share of every volumetric region.

| Check | Limit | CDMD |
| :--- | :--- | :--- |
| Lateral ventricle Dice, left / right | ≥ 0.6 | 0.68 / 0.74 |
| Cerebellar cortex in the cerebellar territories | ≥ 95% | 97.3% |
| Cerebral cortex and white matter in no territory | ≤ 2% | 1.2% |
| Lateralised tissue in a territory of its own side | ≥ 98% | 99.6% |

The ventricle Dice compares aseg's lateral ventricles (labels 4 and 43) with the atlas's labels 31 and 32. The cerebellar check reads aseg's cerebellar cortex (labels 8 and 47) against the superior and inferior cerebellar branches. The unassigned check reads aseg's cerebral cortex and white matter (labels 2, 3, 41, 42), counting the ventricle labels as unassigned. The side check compares aseg's left structures (2, 3, 8, 10 to 13, 17, 18) and right structures (41, 42, 47, 49 to 54) with the parity of the territory value.

The tests check that a branch must be an odd left value and the next even right one; that ventricles and background carry no index; that the checks score this brain and a shifted atlas fails acceptance; that grid counts follow each grid into the territory volume; that the unassigned share is counted rather than inferred; that the published deep structures fall in their textbook territories (putamen in the lateral lenticulostriate, thalamus in the posterior choroidal and thalamoperforating, hippocampus (aseg label 17) in the anterior choroidal and thalamoperforating, a cerebellar hemisphere more than 95% in the cerebellar arteries, fluid spaces with none, and the teaching set's caudal medulla with shares of its own); that every territory region is on its own side and in the cut labels; and that a name cut at a comma in the YAML is refused rather than published.

## Limits

- Typical territories, not this brain's vessels: collateral flow and variants such as a fetal posterior communicating artery move real territories by centimetres.
- The ACA rests on 29 cases, and the medial lenticulostriate and anterior thalamoperforating territories on anatomical knowledge rather than lesions.
- Territory borders are where one territory's lesions give way to another's, not watershed zones; border-zone probabilities are not published here.
- The atlas places the anterior choroidal and thalamoperforating territory under the posterior circulation, and Planum keeps it there.
- Shares under 1% are left out of the list but not counted as unassigned.
- Licensed CC BY-SA 4.0.

### Alternatives considered

- **Registering through CDMD's MNI field.** The repository's header is not MNI (see Data), and the route gave a ventricle Dice of 0.07.
- **A hand-fitted three-parameter shift** scored 0.70 and 0.74 on the ventricles but covered the cerebellum and cortex worse; not shipped.
- **Warped group vessel atlases** (Mouches 2019, VENAT) were rejected. They fail as the tract atlases do: vessels a few millimetres wide lie in sulci, so registration error puts them in parenchyma.
- **Border zones** from the NITRC probability maps would need a download that requires a login; not done.

## Reproduce

```bash
# needs FreeSurfer 8.2 (SynthMorph); about 8 minutes and 6.5 GB on the CPU
uv run python scripts/register_arterial_territories.py --anatomy cdmd --record
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_arterial_territories.py
```

Rerun the registration only after a reconstruction changes.

## See also

- [Lesion report](lesion-report.md), which reports the territories a lesion lies in
- [Functional networks](functional-networks.md), whose per-vertex field this one follows
- [Cerebellar functions](cerebellar-functions.md) and [Striatal networks](striatal-networks.md), built by the same registration pattern
- [References](../reference/references.md) (Liu et al. 2023) and the [building guide](../pipeline/building.md)
