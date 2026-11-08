# Internal anatomy

Planum draws the deep anatomy of one brain, MGH CDMD `sub_013`, at three exclusive levels of detail. The teaching set has 106 solids, each an explicit union of source labels. FreeSurfer's aseg has 32 structures. The brain's own NextBrain histological segmentation has 514 labels, of which 292 are meshed. Every solid is smoothed by at most 0.6 mm and leaves every source voxel centre on its own side. Cut faces read the NextBrain labels and FreeSurfer's 68 gyral white-matter parcels. Every segmentation is a model estimate from one 1 mm T1 (T1-weighted MRI).

```{figure} figures/internal-anatomy-1.webp
:alt: Four coronal sections of the same brain at the same position, viewed from the front. Each is coloured with subcortical labels over a grey T1 image. The first shows a few large teaching units, the second FreeSurfer's coarse 1 mm structures, and the last two NextBrain's many fine nuclei and layers at 0.4 mm and at 0.8 mm.
:name: fig-internal-anatomy-1

**The three levels label the same tissue at different granularity, from different sources.** **a**, Teaching set: the unions of NextBrain, aseg and CerebNet labels that are meshed into the 106 solids (46 units cross this plane). **b**, FreeSurfer aseg, 1 mm (21 of the 32 published structures). **c**, NextBrain on its 0.4 mm source grid (170 labels, white matter and cortex included). **d**, The same labels reduced to 0.8 mm cut blocks, as a cut face samples them (142 labels). Coronal plane at surface RAS (right-anterior-superior) y = −2.0 mm, x from −46 to 46 mm, z from −14 to 50 mm, viewed from the front (R, subject right). The background is `brain.mgz`. Colours are the teaching colours in **a** and the source lookup-table colours in **b**–**d**. The source volumes were sampled by nearest neighbour; the figure was rendered from the repository data, not from the viewer. The scale bar is 10 mm.
```

## Data

| Input | Source | Pinned by |
| :--- | :--- | :--- |
| T1 | MGH CDMD `sub_013` (figshare collection 5315474, file 30790102; CC0), defaced before release | `input_sha256: 16e91371…0c02` in `config/model.yaml` |
| Reconstruction (`orig`, `brain`, `aseg`, `wmparc`, `ribbon`) | FreeSurfer 8.2 (`freesurfer-macOS-darwin_arm64-8.2.0-20260314-d932c45`), `scripts/reconstruct_subject.py` | `data/sources.json`, `reconstruction.json` |
| NextBrain labels | [NextBrain](../reference/references.md#cortical-and-subcortical-atlases) (Casamitjana et al. 2025) `atlas_simplified.zip`, run through SuperSynth (`SuperSynth_August_2025.pth`) | zip sha256 `8ea7c5aa…8f19`, extracted tree `20d9c58f…35e2`, model `7f759267…fd1d` |
| Cerebellar lobules | [CerebNet](../reference/references.md#reference-datasets-and-tools), FastSurfer v2.6.0 (commit `1dc02473…6f21`; Apache-2.0) | commit and six checkpoint sha256 values in `scripts/segment_cerebellum.py` |

CDMD was chosen from the 33 published FreeSurfer 6 reconstructions for the fewest surface defect holes (14). It was reconstructed again with FreeSurfer 8.2 from the same T1. With the FreeSurfer 6 aseg, NextBrain's left amygdala met aseg at Dice 0.793, below the 0.8 floor. The FreeSurfer 8.2 reconstruction has 8 defect holes before repair (3 left, 5 right; `stats/aseg.stats`).

## Method

### NextBrain segmentation

`scripts/segment_nextbrain.py` ran FreeSurfer 8.2 on the CPU (10 threads). It first checked the FreeSurfer build stamp and the sha256 of the SuperSynth model and the atlas tree. It then cut `orig.mgz` to the bounding box of `brain.mgz > 0`, plus 20 voxels. SuperSynth (`--mode invivo --test_time_flipping`) segmented the crop and gave an MNI152 deformation. NextBrain's Bayesian segmentation (`segment_fireants.py --mode invivo`) ran once per hemisphere.

The two hemispheres were joined on one isotropic 0.4 mm grid in surface RAS by nearest neighbour. The grid origin snaps to a 0.8 mm lattice, so every 2-voxel cut block lies on one fixed lattice. The largest label shift was 0.30 mm (left) and 0.17 mm (right). Right-hemisphere labels are offset by 10,000. A voxel claimed by both hemispheres goes to the right where SuperSynth's MNI *x* at its centre is ≥ 0, FreeSurfer's hemisphere rule; on CDMD no voxel was claimed twice. The joined volume (`nextbrain-cdmd.mgz`, int32) was read back label for label.

Three runtime workarounds under `scripts/freesurfer/` change no computed value. A sliced `conv3d` avoids a CPU im2col buffer of about 90 GB and matches torch's `conv3d` to a relative 10⁻⁵. Earlier memory release in SuperSynth changes only when memory is freed. A stand-in replaces the missing OpenCV import and raises if used. The patched run also records the posteriors used by [boundary certainty](boundary-certainty.md#method) and reproduces the published labels byte for byte.

### Placement

`nextbrain.load` places the volume through `orig.mgz`'s own transform, `scanner_to_surface = orig.vox2ras_tkr · orig.affine⁻¹`. It never uses the volume's own header, whose tkregister matrix is surface RAS only for the conformed 256³ grid. The loader refuses non-integer values and labels absent from the lookup table (LUT). It also requires ≥ 0.9 of 20,000 random labelled voxels (seed 0) to fall inside aseg's labelled volume. On CDMD the share is 0.985; a volume placed by its own header scores 0.58.

### Meshing and bounded smoothing

Each structure is cropped to its box and padded by one voxel. `skimage.measure.marching_cubes` runs at level 0.5 and the vertices are mapped to surface RAS. `smooth_display` (`brain_model/surfaces/geometry.py`) then makes the display surface:

1. Apply a Taubin filter ($\lambda = 0.5$, $\nu = 0.53$, 16 iterations) to a copy.
2. Clamp each vertex's displacement to 0.6 mm.
3. Find voxel centres the surface has crossed. Rays run along the first voxel axis, offset $(1.3, 2.7) \times 10^{-4}$ voxel from the lattice, and the crossing parity is compared with the source mask.
4. Halve the displacement of every vertex within 1.75 voxel of a crossed centre. Up to 12 halvings are made; the build fails if a centre is still crossed.

Reported volumes are voxel counts × voxel volume, never mesh volumes. aseg publishes the 32 labels in `structures.labels`; this aseg has no choroid-plexus (31, 63) or optic-chiasm (85) label. NextBrain meshes each label of ≥ 10 mm³ that is not bulk tissue. Bulk tissue is any name containing `ctx-`, `white_matter` or `_of_pva`. That leaves 292 of 514 labels as solids and 222 as cut labels only.

### Teaching-set unions

`brain_model/layers/learning.py` builds the units declared in `config/learning-anatomy.yaml` from three sources, each on its own grid:

| Source | Units defined | Published on CDMD | Grid |
| :--- | ---: | ---: | :--- |
| NextBrain | 38 (37 per side, plus a midline optic chiasm) | 75 | 0.4 mm |
| aseg | 8 (ventricles, choroid plexus, corpus callosum, caudal medulla) | 6 (no choroid plexus) | 1 mm |
| CerebNet | 25 (SUIT lobules I–IV, V, VI, crus I, crus II, VIIb, VIIIa, VIIIb, IX and X per side; vermis VI–X) | 25 | 1 mm |

The units belong to eight systems. `combine_labels` refuses a label assigned to two units. A NextBrain label absent from the LUT stops the build. CerebNet replaces aseg's two cerebellar-cortex units. Aseg's cerebellar white matter is left out because the deep nuclei lie inside it. The thalamus lists 53 NextBrain labels and the hippocampal formation 52. Each side keeps only the labels present in its volume; the right suprageniculate nucleus (512) is absent, for example. Thirty definitions carry English and French coverage notes, and a malformed note stops the build. The notes cover partial units such as the accumbens core (label 101) and the dorsal medial geniculate nucleus (label 504; 22.2 mm³ left, 21.2 mm³ right).

**Caudal medulla.** NextBrain labels no medulla below its lowest medullary voxel. The scan and aseg continue down to the cord. `nextbrain_floors` takes the lowest voxel centre of the `medulla` unit (labels 662, 654, 765) on each side and keeps the higher one: z = −32.0 mm on CDMD. `below_floors` clears aseg's brainstem (16) at and above that z. The remainder (1,925 mm³; voxel centres z = −48 to −32 mm) is the `caudal-medulla` unit. The NextBrain level keeps the gap.

### Cerebellar lobules

`scripts/segment_cerebellum.py` ran FastSurfer (`--seg_only --no_hypothal --no_cc --no_biasfield --device cpu --threads 4`) on the conformed `orig.mgz`. The lobules were written as int16 to `mri/cerebellum.CerebNet.mgz`, because `orig.mgz`'s uchar type would clip ids above 255. `cerebellum.load` accepts only the 25 lobule ids (601–631) and cerebellar white matter (7, 46).

CerebNet's labels fill the fissures, so the lobule surfaces are drawn with fluid voxels opened. A lobule voxel is fluid when its `brain.mgz` intensity is below the midpoint of the lobules' median and the CSF (24) median. It is opened only when face-connected through such voxels to unlabelled fluid. On CDMD the medians are 76 and 22, the threshold is 49, and 3,906 of 92,376 lobule voxels (4.2%) are opened. Volumes and placements stay on the unopened labels. Lobule shading uses openness cast from each vertex against all 25 lobule surfaces together (256 rays, 10 mm radius).

### Gyral white matter

`white_matter.py` keeps `wmparc.mgz` labels 3001–3999 and 4001–4999: white matter within 5 mm of cortex, labelled with the nearest Desikan gyrus by `mri_aparc2aseg --labelwm`. Unsegmented white matter (5001, 5002) is excluded. The 68 parcels are coded uint8 and cropped into `white-matter.volume`. They have no surface.

### Cut labels

`nextbrain.export_atlas` reduces the 0.4 mm labels to 2 × 2 × 2 blocks of 0.8 mm (Fig. 1c,d). Each block takes its most frequent label. A tie goes to the label rarer in the whole volume, then to the smaller index. Missing voxels past the grid edge count as background. On CDMD 31 labels win no block (each ≤ 5.2 mm³); these carry `cut_atlases: []` and remain searchable. Surfaces and measurements use the source grid. `tissue-envelopes.glb` holds the native pial and white surfaces of both hemispheres, unchanged and required to be closed and outward-facing.

## Display

**Show internal anatomy** (key **U**) hides the cortex and loads one level: **Teaching set** (`learning.glb`), **FreeSurfer aseg** (`structures.glb`) or **NextBrain** (`nextbrain.glb`), URL key `detail=learning|aseg|nextbrain`. The Anatomy tab groups teaching units by system (`system`). A unit's `constituent_regions` lead to its NextBrain labels. A cut (`cut`, `pos` in surface RAS mm) intersects each closed solid. `solid-sections.ts` triangulates the section with earcut in a worker; a non-manifold section falls back to a winding-stencil cap. A cut face shows the labels of the cut atlas (`cuts=nextbrain`). `label-sampling.ts` gives each point the label of greatest trilinear weight over the eight surrounding voxels. Gyral white matter lights the parcel under the pointer from the same sampling. Hiding the cortex exposes the subject's white surface from `tissue-envelopes.glb`.

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| Display displacement, every solid (`validate`) | ≤ 0.6 mm | max 0.600 mm: aseg (32), NextBrain (292), teaching set (106) |
| Misclassified voxel centres, every solid | 0 | 0 |
| Teaching-set source volumes | unchanged by display | unchanged |
| Cut blocks recounted from the source grid | every block its majority; ties to the rarer label | holds; 110,382 tied blocks; 96.4% of source voxels match their cut label |
| Placement anchors inside their own label | every region | NextBrain 514, teaching set 106, aseg 32, wmparc 68 |
| Teaching unit mostly inside another source | < 0.5 | max 0.241 (stria terminalis); fornix 0.165, septal 0.158, fastigial 0.155 |
| NextBrain vs aseg, Dice on the 0.4 mm grid | ≥ 0.8, or a documented floor | 0.772–0.892; left amygdala 0.772 against its 0.77 floor ([segmentation agreement](segmentation-agreement.md)) |
| CerebNet lobules vs aseg cerebellar cortex (8, 47), 1 mm | Dice ≥ 0.85 | 0.918 |
| Cerebellar fissures recomputed; lobule openness recast | equal; outlier share ≤ 0.005 | equal; outlier share 1.3 × 10⁻⁴ |
| Gyral white matter | parcel voxels identical to `wmparc.mgz` | 68 parcels, identical |
| Native envelopes | topology identical; closed | max coordinate error 3.7 × 10⁻⁶ mm |
| Unit tests | `test_learning`, `test_geometry`, `test_structures`, `test_nextbrain`, `test_segment_nextbrain`, `test_cerebellum`, `test_white_matter`, `test_solids` | pass |

## Limitations

- One individual; folds, sizes and asymmetries are not normative.
- The scan is 1 mm. NextBrain's 0.4 mm grid is estimated from it, and where structures share T1 contrast, the atlas prior places the boundary.
- NextBrain and CerebNet are model estimates. Agreement with aseg bounds their difference, not their accuracy. The claustrum is fragmented.
- CerebNet lobules are published for CDMD only. SUIT folds vermis I–V into lobules I–IV and V, so the anterior vermis cannot be shown alone. A fissure with no voxel more than half fluid stays filled.
- Cut faces are coarser than surfaces (0.8 mm blocks), and 31 small labels appear on no cut.
- 116 of the 324 aseg and NextBrain solids touch themselves across voxel corners (non-manifold edges); their enclosed volume stays definite.
- The 0.6 mm smoothing is a display bound and adds no resolution.
- The medial geniculate unit is the dorsal division only (label 504).
- Every published `validation.json` records `clinical_accuracy_validated: false`.

## Code availability

| | |
| :--- | :--- |
| Code | [`scripts/segment_nextbrain.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/segment_nextbrain.py), [`scripts/segment_cerebellum.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/segment_cerebellum.py), `scripts/freesurfer/`, [`brain_model/labels/nextbrain.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/labels/nextbrain.py), [`brain_model/labels/cerebellum.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/labels/cerebellum.py), [`brain_model/labels/white_matter.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/labels/white_matter.py), [`brain_model/labels/placement.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/labels/placement.py), [`brain_model/layers/learning.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/learning.py), [`brain_model/surfaces/geometry.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/surfaces/geometry.py), [`brain_model/surfaces/solids.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/surfaces/solids.py), [`brain_model/build.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/build.py) |
| Configuration | [`config/learning-anatomy.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/learning-anatomy.yaml); [`config/model.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/model.yaml): `structures`, `nextbrain`, `validation` |
| Tests | `tests/test_learning.py`, `tests/test_geometry.py`, `tests/test_structures.py`, `tests/test_nextbrain.py`, `tests/test_segment_nextbrain.py`, `tests/test_cerebellum.py`, `tests/test_white_matter.py`, `tests/test_solids.py` |

```bash
# Sources (only to regenerate; CDMD's are committed; needs FreeSurfer 8.2)
uv run python scripts/segment_nextbrain.py --anatomy cdmd --record
uv run python scripts/segment_cerebellum.py --anatomy cdmd --record
# Meshes, cut volumes, validation
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_learning.py tests/test_geometry.py tests/test_structures.py tests/test_nextbrain.py tests/test_cerebellum.py tests/test_white_matter.py tests/test_solids.py
```

Viewer state of the figure plane: https://planumatlas.com/#anatomy=cdmd&detail=learning&cut=coronal&pos=-2&view=anterior&cortex=0
