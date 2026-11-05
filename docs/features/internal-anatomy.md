# Internal anatomy

Three exclusive levels of subcortical and deep anatomy, drawn as smoothed solids and as cut labels: a teaching set of 106 solids, FreeSurfer's aseg structures, and this brain's own NextBrain histological segmentation, with CerebNet's cerebellar lobules and FreeSurfer's gyral white matter.

:::{list-table}
:widths: 22 78
:stub-columns: 1

* - Where in the viewer
  - Display › internal anatomy (**U**); the Anatomy tab's systems and regions; the cut labels of a section.
* - Built by
  - [`brain_model/layers/learning.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/learning.py), [`brain_model/labels/nextbrain.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/labels/nextbrain.py), [`brain_model/labels/cerebellum.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/labels/cerebellum.py), [`brain_model/labels/white_matter.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/labels/white_matter.py), [`brain_model/labels/placement.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/labels/placement.py), [`brain_model/surfaces/geometry.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/surfaces/geometry.py), [`brain_model/surfaces/solids.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/surfaces/solids.py), [`brain_model/build.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/build.py), [`scripts/segment_nextbrain.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/segment_nextbrain.py), [`scripts/segment_cerebellum.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/segment_cerebellum.py), `scripts/freesurfer/`
* - Configuration
  - [`config/learning-anatomy.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/learning-anatomy.yaml), [`config/model.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/model.yaml) (`structures`, `nextbrain`, `validation`)
* - Source data
  - FreeSurfer 8.2 `aseg.mgz` and `wmparc.mgz` of CDMD `sub_013` (CC0); NextBrain atlas (Casamitjana et al. 2025) run with SuperSynth; FastSurfer v2.6.0 CerebNet (Apache-2.0)
* - Checked by
  - Validation steps 5, 6, 10 and 12 ([validation](../pipeline/validation.md)); `tests/test_learning.py`, `tests/test_geometry.py`, `tests/test_structures.py`, `tests/test_nextbrain.py`, `tests/test_segment_nextbrain.py`, `tests/test_cerebellum.py`, `tests/test_white_matter.py`, `tests/test_solids.py`
:::

## What it does

| Layer | Granularity | Source | Route to the subject |
| :--- | :--- | :--- | :--- |
| Teaching set | 106 solids | NextBrain, aseg and CerebNet unions | Bounded smoothing |
| FreeSurfer aseg | 32 structures | `aseg.mgz` | Marching cubes, bounded smoothing |
| NextBrain | 514 labels, 292 meshed | Subject segmentation at 0.4 mm | Native |
| Gyral white matter | 68 parcels | `wmparc.mgz` | Native; cut faces only |

Counts are for CDMD. Three exclusive levels:

- **Teaching set.** Eight systems (basal ganglia, diencephalon, limbic, brainstem, basal forebrain, cerebellum, ventricles, white-matter pathways), each unit an explicit union of source labels in [`config/learning-anatomy.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/learning-anatomy.yaml). Midline units stay whole. NextBrain labels no medulla below its lowest medullary voxels, though the scan does, so the caudal medulla is aseg's brainstem below the higher of the two sides' lowest voxel: it carries the medulla down to meet the cord. The cerebellar cortex is FastSurfer CerebNet's 25 SUIT lobules (vermis VI–X midline; vermis I–V lies in lobules I–IV and V) where an anatomy declares them, and one aseg unit per side otherwise.
- **FreeSurfer aseg.** Marching cubes at 0.5 on the 1 mm `aseg.mgz`.
- **NextBrain.** This brain's own NextBrain segmentation (FreeSurfer 8.2, `invivo` mode), each hemisphere joined onto one 0.4 mm grid in surface RAS, moving no label more than 0.25 mm. Midline voxels both sides claim follow SuperSynth's MNI $x$, as FreeSurfer splits hemispheres. The volume is placed through `orig.mgz`'s transform, never its own header. Structures of at least 10 mm³ are meshed; the rest are cut labels. Cut faces sample 0.8 mm blocks, so fragments of ≤ 4.5 mm³ that win no block are absent from cuts but still searchable.

Every display surface uses a Taubin filter bounded to 0.6 mm of the raw surface, pulled back wherever it would cross a voxel centre, so each source voxel stays on its side. Reported volumes come from voxels, not meshes.

`gyral white matter` is FreeSurfer's `wmparc`: each white-matter voxel within 5 mm of cortex carries its nearest Desikan gyrus. Cut faces name the gyrus under the pointer; deeper white matter belongs to no region.

An anatomy is a set of assets declared in `config/model.yaml`. `cdmd` is the published default; `fsaverage` is a template, not an individual, whose NextBrain source has no stated licence and is not published, and which publishes only the `networks` and `nextbrain` layers.

## Data

| Input | Source | Pinned by |
| :--- | :--- | :--- |
| Reconstruction | MGH CDMD `sub_013` T1 (figshare collection 5315474, file 30790102), reconstructed with FreeSurfer 8.2 by `scripts/reconstruct_subject.py` | `input_sha256: 16e91371…0c02`, `reconstruction.json` |
| `aseg.mgz`, `orig.mgz`, `brain.mgz`, `ribbon.mgz`, `wmparc.mgz` | The 8.2 reconstruction | `data/sources.json`, checked against `reconstruction.json` |
| SuperSynth | `SuperSynth_August_2025.pth` from the FreeSurfer distribution | sha256 `7f759267…fd1fbd` (`SUPERSYNTH` in the script) |
| NextBrain atlas | `atlas_simplified.zip` (Iglesias et al. 2023 distribution), extracted | zip sha256 `8ea7c5aa…8f19`, extracted-tree sha256 `20d9c58f…3235e2` (`ATLAS`) |
| FastSurfer | v2.6.0, commit `1dc024735371f65bc4b94a272cf596be6ddf4f21` | commit, and six checkpoint sha256 values in `segment_cerebellum.py` |
| FreeSurfer build | `freesurfer-macOS-darwin_arm64-8.2.0-20260314-d932c45` | `config/model.yaml` `freesurfer_build`; build stamp checked |

CDMD's source T1 was defaced before release: facial features were obscured, while the brain was not altered. It was chosen from the 33 published FreeSurfer 6 reconstructions for the fewest surface defect holes (14), and reconstructed again here with FreeSurfer 8.2 from the T1 the published run imported, because with that run's aseg NextBrain's left amygdala met it at Dice 0.793, below the floor. Surface defect holes before repair: 8 on CDMD (3 left, 5 right, from `stats/aseg.stats`). The NextBrain atlas is distributed with FreeSurfer; the NextBrain paper names no separate licence. The individual anatomy is not normative, and segmentations are estimates.

## How it was built

### 1. Segment NextBrain on this brain

`scripts/segment_nextbrain.py` (FreeSurfer 8.2 on the CPU; roughly 20 minutes per brain, and, with SuperSynth's output reused, about 16 minutes for both hemispheres) runs these steps, skipping any whose output is already in the work directory `data/cache/nextbrain-seg-<anatomy>`:

1. **Verify the runtime.** The FreeSurfer build stamp must equal `freesurfer_build`; the SuperSynth model and the extracted atlas tree must match their sha256.
2. **Crop the input.** `crop_input` cuts `orig.mgz` to the bounding box of `brain.mgz > 0` plus 20 voxels (`CROP_MARGIN_VOXELS`), values untouched, and saves it as `input.mgz` with a shifted affine; an existing crop is refused unless identical.
3. **SuperSynth** (`inference.py --mode invivo --device cpu --test_time_flipping`) segments the crop and writes the MNI deformation and affine used later to split the midline.
4. **NextBrain's Bayesian segmentation** (`segment_fireants.py --mode invivo --device cpu`) runs once per hemisphere (`--side left`, `--side right`) with the atlas directory, writing `seg.<side>.nii.gz` and, through the patch below, `max_p`, `second_p` and `second_seg`.
5. **Join the hemispheres** (`join_hemispheres`). The joined grid is isotropic 0.4 mm (`segmentation_spacing_mm`) in the subject's surface RAS. `joined_grid` finds the corners of both hemispheres' labelled boxes, sets the origin to one voxel below their minimum, rounded down to the 0.8 mm lattice (`segmentation_lattice_mm`), and extends one voxel past their maximum. The lattice must be a whole number of cut blocks of 2 voxels; `grid_spacing` fails otherwise, which puts every cut block on one fixed lattice whatever the labelled extent. Each hemisphere is resampled by nearest neighbour (`resample_nearest`; grids must share axis directions and be unskewed beyond 0.01 voxel); the maximum shift of any label is reported (no more than 0.25 mm).
6. **Offset the right hemisphere.** Left labels keep their published indices; right-hemisphere indices are offset by 10,000 (`nextbrain.HEMISPHERE_OFFSET`), as the LUT writes them. Where both sides label a voxel, `right_of_midline` takes SuperSynth's MNI $x$ at the voxel centre (trilinear on the deformation field plus the affine) and gives the voxel to the right side where it is not negative, the rule FreeSurfer splits hemispheres by.
7. **Write** `nextbrain-cdmd.mgz` (int32, read back and compared label for label), `nextbrain-lut.txt` (both hemispheres from FreeSurfer's per-hemisphere LUT, names prefixed `Left-` or `Right-`) and `nextbrain-cdmd-near-ties.mgz` (see [Boundary certainty](boundary-certainty.md)). The volume's affine is `inv(scanner_to_surface) @ grid`, so it is stored in scanner space.
8. **Read back** through the build's own loader, which asserts integrality, LUT coverage and placement.

With `--record`, the files are registered in `data/sources.json` with their inputs, the crop, the join, the near-tie parameters, the CPU thread count and the runtime workarounds.

The runtime workarounds (`scripts/freesurfer/`, recorded as provenance in `WORKAROUNDS`) change no computed value:

- `conv3d_slices.py` replaces CPU `conv3d`, which on FreeSurfer 8.2's arm64 torch 2.1.2 (no oneDNN) builds an im2col buffer 27 times the input, about 90 GB for SuperSynth. A stride-1 3D convolution is a sum over kernel depth of 2D convolutions of shifted slices, computed a block of slices at a time; only a convolution whose im2col buffer would reach 1 GiB is sliced, so NextBrain's bias field fit keeps the exact zeros it takes logs of. `check_conv3d_slices.py` matches torch's own conv3d to a relative 1e-5.
- SuperSynth's `inference.py` drops its first-pass network outputs before the flipped pass, and the flipped outputs once averaged in; only when memory is freed changes.
- A stand-in module satisfies `ERC_bayesian_segmentation`'s module-level `import cv2`, which FreeSurfer 8.2's macOS Python lacks; it raises if any attribute is used.

`run_patched.py` also records each voxel's winning posterior, runner-up label and runner-up posterior from NextBrain's label loop, beside the label update it leaves unchanged. The rerun reproduces the published labels byte for byte.

### 2. Place the NextBrain volume

`nextbrain.load` places the volume through `orig.mgz`: `scanner_to_surface = orig.header.get_vox2ras_tkr() @ inv(orig.affine)`, and the grid affine is `scanner_to_surface @ image.affine`. An MGH header's own tkregister matrix is centred on that volume, so it is surface RAS only for the conformed 256³ grid; a volume placed by its own header scores 0.58 in the check below. The loader refuses labels absent from the LUT and non-integer values, and `share_inside_aseg` takes 20,000 random labelled voxels (`registration_samples`, seed 0) and requires at least 0.9 (`minimum_share_inside_aseg`) to fall inside aseg's labelled volume. Measured: 0.98 for a subject segmentation, 0.93 for the MNI warps the scheme replaced.

### 3. Mesh the aseg and NextBrain structures

`build_structure_layer` in `brain_model/build.py` meshes each structure in turn:

1. `extract_structure` crops the label's box with one voxel of margin, pads by one, runs `skimage.measure.marching_cubes` at level 0.5 (step 1, no degenerate triangles, gradient direction ascent), maps vertices through the voxel-to-surface affine, and reverses the faces where the affine's determinant is negative so they face outward.
2. `smooth_display` smooths (below).
3. `add_region` writes the mesh to the glTF scene with the id, colour and metadata.
4. The manifest records voxel count, voxel size, vertex and triangle counts, area (measured on the float32 vertices the GLB stores), `segmentation_volume_mm3` (voxel count times voxel volume), the maximum display displacement, and the placement (`centroid_ras_mm`, and `anchor_ras_mm`: the voxel centre of the region's own label nearest its centroid, ties to the first in array order, so a crosshair lands inside a curved region).

aseg publishes the 32 labels in `config/model.yaml` `structures.labels` into `structures.glb`; this FreeSurfer 8.2 aseg has no choroid-plexus (31/63) or optic-chiasm (85) labels. NextBrain publishes into `nextbrain.glb` each label of at least `minimum_mesh_volume_mm3: 10` that is not bulk tissue (`is_bulk` excludes any name containing `ctx-`, `white_matter` or `_of_pva`: white matter and the cerebellar cortical layers are vast, convoluted and enclose everything else, and the cortical parcels are already surfaces in the cortical atlases). 292 of NextBrain's 514 labels are meshed; the other 222 are cut labels.

### 4. Bounded display smoothing

`smooth_display` (`brain_model/surfaces/geometry.py`; settings `structures.smoothing` and `learning-anatomy.yaml` `smoothing`, both 16 iterations and 0.6 mm) turns the marching-cubes surface into a display surface across which no voxel centre moves:

1. Apply `trimesh.smoothing.filter_taubin` with $\lambda = 0.5$, $\nu = 0.53$ for 16 iterations to a copy.
2. Clamp each vertex's displacement to 0.6 mm.
3. Find the voxel centres the smoothed surface has put on the wrong side, with `misclassified_voxels`: a ray along the first voxel axis, a hair off the lattice (offsets $1.3 \times 10^{-4}$ and $2.7 \times 10^{-4}$ voxels, because marching-cubes vertices and edges sit on integer and half-integer coordinates), counts crossings per voxel row and compares the parity of each centre with the source mask.
4. Halve the displacement of every vertex within 1.75 voxel of a crossed centre (the farthest vertex of a cube touching a centre is 1.5 voxel away), repeat up to 12 times, and on the last pass set it to zero (the source surface). If any centre is still crossed the build fails.
5. Refuse a result with non-finite vertices or non-positive volume.

A raw marching-cubes surface at 0.5 misplaces no centre by construction; the smoothing is therefore smooth wherever the voxels allow and exact where they do not. For a crop, `label_boxes` and `box_affine` give the same results as the whole volume at the cost of the box. Reported volumes come from voxels, not meshes.

### 5. Unions for the teaching set

`brain_model/layers/learning.py` assembles the teaching set from three sources:

1. **NextBrain units** (38 in `config/learning-anatomy.yaml` `nextbrain`). Each lists published base (left) NextBrain labels; `expand_nextbrain` makes a left unit (the labels) and a right unit (the labels plus 10,000), or one midline unit holding both copies where `hemisphere: midline` (the optic chiasm only: halved, each side was 0 to 2 voxels). A label absent from the LUT stops the build.
2. **aseg units** (8 on CDMD), the ventricles, choroid plexus, corpus callosum and the caudal medulla. The aseg cerebellar cortex units are replaced where CerebNet is declared. Cerebellar white matter stays out: the deep nuclei sit inside that label.
3. **CerebNet units** (25), one per SUIT lobule or side: lobules I–IV, V, VI, crus I, crus II, VIIb, VIIIa, VIIIb, IX and X per side, and midline vermis VI, VII, VIII, IX and X.

`combine_labels` builds an integer lookup table from the groups; a label may belong to only one unit, a repeated or non-positive label is an error, and the result is one integer volume per source. Each source keeps its own grid: NextBrain at 0.4 mm, aseg and CerebNet at 1 mm. For each unit present in its volume the build places it, meshes it as above and writes `learning.glb`. On CDMD 108 units are defined and 106 published: aseg has no choroid plexus.

Each region records its source atlas, the source label ids present, the NextBrain `constituent_regions` (the published NextBrain regions it unions; CerebNet publishes none), the English and French names and system, a teaching colour (distinct display colours, not the source LUT), the voxel count and volume, and the display displacement.

**Caudal medulla.** NextBrain's lowest medullary voxel lies near surface z of −32 to −34 mm, while the scan, aseg and the cord (which starts at C1) reach lower. `nextbrain_floors` finds, for the `medulla` unit (labels 662, 654 and 765), the lowest voxel centre in surface z on each side and takes the higher of the two (so neither side has a gap above the aseg unit). `below_floors` then clears aseg's brainstem (label 16) at and above that z, and the remainder is the `caudal-medulla` unit, spanning about −48.5 to −31.4 mm on CDMD. The NextBrain level keeps the gap.

### 6. CerebNet lobules

`scripts/segment_cerebellum.py` runs FastSurfer's segmentation stream on `orig.mgz`: `run_fastsurfer.sh --seg_only --no_hypothal --no_cc --no_biasfield --device cpu --threads 4 --py data/cache/fastsurfer-venv/bin/python`. FastSurferVINN runs because CerebNet crops the cerebellum from its segmentation; the surfaces, hypothalamus and corpus callosum modules do not. FastSurfer v2.6.0 is checked by commit and its six checkpoints (`aparc_vinn_{axial,coronal,sagittal}_v2.0.0.pkl`, `CerebNet_{axial,coronal,sagittal}_v1.0.0.pkl`) by sha256. `orig.mgz` is already conformed, so FastSurfer keeps its grid; `lobules_on_orig` refuses an output not on `orig.mgz`'s grid and non-integer labels, and `cerebellum.save` rewrites it with the conformed header and `int16` data type (the `uchar` header of `orig.mgz` would clip the 600s ids to 255) to `mri/cerebellum.CerebNet.mgz`. A run takes about 8 minutes on the CPU.

FastSurfer writes `Cbm_*` ids 601–631 (630 and 631, vermis VII and VIII, are newer than the repository's FreeSurfer table) and cerebellar white matter as aseg's 7 and 46. `cerebellum.load` refuses any other label. SUIT folds vermis I–V into lobules I–IV and V, so the anterior vermis cannot be drawn alone.

### 7. Gyral white matter

`brain_model/labels/white_matter.py` reads `mri/wmparc.mgz` on the aseg grid and keeps labels 3001–3999 (left) and 4001–4999 (right), FreeSurfer's `wm-lh-*` and `wm-rh-*` blocks; unsegmented white matter (5001 and 5002) lies outside both. The 68 parcels are codes `uint8` (1 to 68, `searchsorted` over the sorted ids) cropped to the parcels' bounding box and written as `white-matter.volume`, with the parcel list, `applies_to` (every cortical atlas) and the label method (`mri_aparc2aseg --labelwm`: white matter within 5 mm of cortex carries the nearest Desikan cortical label, no label is changed). Each parcel is a `tissue-region` with cut atlases, placement and volume; it has no surface.

### 8. Cut labels and the native envelopes

`export_tissue_labels` writes the NextBrain cut volume `tissues-nextbrain.volume` (`nextbrain.export_atlas`):

1. `cut_grid` reduces the 0.4 mm labels to 2×2×2 blocks of 0.8 mm (`cut_label_spacing_mm`, block = round(0.8 / 0.4)). Each block takes its most frequent label (`block_majority`); a tie goes to the label rarer in the whole volume, then to the smaller index (rarity rather than index, because indices are names and a half-covered block matters more to a thin structure than to its neighbour). Blocks past the grid edge count the missing voxels as background.
2. Labels are coded `uint16` (dense, by sorted label), cropped to the label box, gzip-compressed, with the label table (id, name, colour, hemisphere, region id) and the list of source labels that win no block (`labels_absent_from_cut`).
3. Regions with no block carry `cut_atlases: []`.

Surfaces and region measurements use the source grid; only cut faces use the blocks. On CDMD 31 labels are too small to win any block, and 96.4% of source voxels match their cut label. `brain_model/surfaces/solids.py` publishes `tissue-envelopes.glb`: the native `lh`/`rh` pial and white surfaces, vertices and triangles unchanged, each required to be watertight, winding-consistent and outward-facing (the viewer needs them for exposed white matter and cuts).

## How the viewer uses it

- `learning.glb`, `structures.glb` and `nextbrain.glb` load when internal anatomy is first shown; the NextBrain volume and the other label volumes load with the first cut. The Anatomy tab groups units by `system_names`, and a unit's `constituent_regions` lead to its NextBrain labels.
- Solids are drawn through `web/src/lib/engine/tissues/solid-assets.ts` and `solid-material.ts`; a cut intersects each closed solid and triangulates the section polygon in `solid-sections.ts`, with `earcut`, in a worker while dragging; a non-manifold intersection falls back to a winding-stencil cap.
- Cut faces sample the label volume on the GPU with the label of most trilinear weight over the eight voxels around the point (`label-sampling.ts`), written without loops over local arrays because ANGLE's Metal backend spills those to memory and made a cut face six times slower.
- Gyral white matter (`white-matter.ts`, `white-matter-surfaces.ts`) lights the pointed-at or chosen parcel from the same sampled label.
- Hiding cortex exposes the subject's own white-matter surface from `tissue-envelopes.glb`.

## Checks

| Check | Limit | CDMD |
| :--- | :--- | :--- |
| Display displacement of every solid | ≤ 0.6 mm | aseg 0.600 (32 solids); NextBrain 0.600 (292); teaching set 0.600 (106) |
| `misclassified_voxel_centres`, every solid | 0 | 0 |
| Cut blocks recounted from source (step 6) | every block is its majority; ties to the rarer label | holds; 110,382 tied blocks; 96.4% of source voxels match their cut label |
| NextBrain placement inside aseg | ≥ 0.9 | measured 0.98 for a subject segmentation |
| Unit mostly inside another source | < 0.5 | at most 0.241 (stria terminalis); fornix 0.165, septal 0.158, fastigial 0.155 |
| NextBrain against aseg, five structures | Dice ≥ 0.8 | 0.772–0.892; left amygdala 0.772 under a documented 0.77 floor |
| CerebNet lobules against aseg's cerebellar cortex | Dice ≥ 0.85 | 0.918 |
| Gyral white matter | parcel voxels identical to `wmparc.mgz` | 68 parcels; identical |
| Native envelopes | topology identical to source; closed | maximum coordinate error $3.7 \times 10^{-6}$ mm |

NextBrain against aseg (Dice on NextBrain's 0.4 mm grid, aseg carried across by nearest neighbour, which shifts no voxel more than 0.693 mm): caudate 0.852 / 0.864 (left / right), putamen 0.888 / 0.892, thalamus 0.890 / 0.885, hippocampus 0.856 / 0.878, amygdala 0.772 / 0.830. The left amygdala exception (accepted 2026-10-24, `segmentation_agreement_exceptions` in `config/model.yaml`) is the smaller estimate on both reconstructions of this scan (1,246 mm³ on FreeSurfer 6.0 at Dice 0.793; 1,266 mm³ on 8.2 against aseg's 1,497 mm³; its own right is 1,393 mm³); the right agrees at 0.83. The disagreement is the anterior-medial boundary, not a misplaced structure: of the 470 mm³ only aseg calls left amygdala, NextBrain leaves 146 mm³ unlabelled and gives the rest to entorhinal cortex (110), forebrain white matter (97), temporal pole (69), temporal claustrum (18) and optic tract (10). An exception the score no longer needs is refused. See [Segmentation agreement](segmentation-agreement.md) for the grid-matched comparison.

## Limits

- **One individual.** Folds, depths and asymmetries belong to that person and are not normative.
- **1 mm scan.** The MRI and FreeSurfer labels are 1 mm. NextBrain's 0.4 mm grid is estimated from that same scan; where structures share T1 contrast, the atlas prior places the boundary. Cortical layers and fibres are not resolved.
- **NextBrain is a model estimate.** Agreement bounds how far two segmentations differ, not how far either is from the anatomy. The claustrum is still fragmented.
- **Cerebellar lobules are a model estimate.** CerebNet's lobules together score Dice 0.918 against aseg's cerebellar cortex. A full field of view does not guarantee success: check any new anatomy's CerebNet output against aseg before declaring the layer; the lobules are published on CDMD only.
- **Cut faces are coarser** than NextBrain surfaces (0.8 mm blocks): thin structures are coarser on a cut than on their surfaces, and 31 labels too small to win any block appear on no cut.
- **Non-manifold contacts.** On CDMD, 116 of 324 solids touch themselves across voxel corners; enclosed volumes stay definite.
- **FreeSurfer surface defects** before repair: 8 holes on CDMD.
- **Shading is illustrative.** T1 relief and tissue colours are not measured optical or histological properties.
- **Smoothing adds no resolution.** The 0.6 mm bound is a display bound; measurements remain source-voxel counts.
- **NextBrain's medial geniculate** is only the dorsal division (label 504, about 11 mm³), so the unit is named so.
- **Conversion fidelity, not clinical accuracy.** Every published `validation.json` records `clinical_accuracy_validated: false`.

## Reproduce

```bash
# Sources (only to regenerate; CDMD's are committed)
uv run python scripts/segment_nextbrain.py --anatomy cdmd --record
uv run python scripts/segment_cerebellum.py --anatomy cdmd --record

# Meshes, cut volumes, validation
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_learning.py tests/test_geometry.py tests/test_nextbrain.py tests/test_white_matter.py
```

`segment_nextbrain.py` needs FreeSurfer 8.2 (`--freesurfer`, default `/Applications/freesurfer/8.2.0`) and defaults to `min(10, cpu_count)` threads. On a 24 GB machine do not run it beside other heavy jobs: SuperSynth peaks at about 9–11 GB and the NextBrain Bayesian stage at about 15 GB, and swap on a nearly full disk fills quickly.

## See also

- [Boundary certainty](boundary-certainty.md) and [Segmentation agreement](segmentation-agreement.md): what the NextBrain posteriors and the aseg comparison say
- [Spinal cord](spinal-cord.md): the cord the caudal medulla joins
- [Cortical atlases](cortical-atlases.md)
- [Cerebellar functions](cerebellar-functions.md) and [Striatal networks](striatal-networks.md): registered group atlases carried onto these structures
- [Validation](../pipeline/validation.md), [building](../pipeline/building.md), [architecture](../pipeline/architecture.md)
- [References and licensing](../reference/references.md)
