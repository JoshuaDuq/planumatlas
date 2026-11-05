# Cortical atlases

Four parcellations of the cortex, Destrieux, HCP-MMP1.0, Julich-Brain and Schaefer, drawn on one brain's own pial surface and on its cut faces, built from the subject's annotation or from `fsaverage` annotations carried across registered spheres.

:::{list-table}
:widths: 22 78
:stub-columns: 1

* - Where in the viewer
  - The **Atlas** choice on the model, the Anatomy tab's region detail, and the cut labels of a section.
* - Built by
  - [`brain_model/surfaces/geometry.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/surfaces/geometry.py), [`brain_model/surfaces/registration.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/surfaces/registration.py), [`brain_model/surfaces/ribbons.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/surfaces/ribbons.py), [`brain_model/build.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/build.py) (`build_cortex`), [`brain_model/labels/tissue_labels.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/labels/tissue_labels.py), [`scripts/prepare_subject.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/prepare_subject.py), [`scripts/fetch_julich_brain.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/fetch_julich_brain.py), [`brain_model/layers/networks.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/networks.py)
* - Configuration
  - [`config/model.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/model.yaml): `atlases`, `annotation_projection`, `networks`
* - Source data
  - Subject `aparc.a2009s.annot` (FreeSurfer 8.2); HCP-MMP1.0 (Glasser et al. 2016, figshare 3498446 v2); Julich-Brain 3.1 (EBRAINS, CC BY-NC-SA 4.0); Schaefer 2018, 400 parcels, 7 and 17 networks (CBIG, MIT)
* - Checked by
  - Validation steps 3, 4 and 11 ([validation](../pipeline/validation.md)); `tests/test_geometry.py`, `tests/test_registration.py`, `tests/test_ribbons.py`, `tests/test_tissue_labels.py`
:::

## What it does

Every layer shares one spatial frame: the subject's FreeSurfer surface RAS. Each cortical atlas is published as a surface (`cortex-<atlas>.glb`), as a label per pial vertex that closes the cortical ribbon into solid wedges (`ribbon-<atlas>.labels`), and as a cut-face label volume (`tissues-<atlas>.volume`). Counts are for CDMD. Each subject's `manifest.json` is authoritative.

| Layer | Granularity | Source | Route to the subject |
| :--- | :--- | :--- | :--- |
| Destrieux (`aparc.a2009s`) | 148 parcels | Subject `.annot` | Native; no projection |
| HCP-MMP1.0 | 360 areas | `fs_LR` → `fsaverage` | Nearest vertex on registered spheres |
| Julich-Brain 3.1 | 278 areas | Colin27 → `fsaverage` | Nearest vertex on registered spheres |
| Schaefer 2018 | 400 parcels | `fsaverage` (1,489 participants) | Nearest vertex on registered spheres |

Per atlas, the manifest also counts the non-region entries (medial wall, unmapped cortex): Destrieux 150 meshes (148 parcels and 2 unlabelled medial walls), HCP-MMP 362 (360 and 2), Julich-Brain 296 (278 areas and 18 non-regions, which are 7 gap maps and 2 medial masks per hemisphere) and Schaefer 402 (400 and 2).

### Destrieux

74 sulcal and gyral regions per hemisphere, from the subject's own annotation, plus two unlabelled medial walls. A triangle spanning several labels is split into barycentric cells by edge midpoints and the face centroid. The split keeps all of the pial area and none of the surface moves.

### HCP-MMP1.0

180 multimodal areas per hemisphere (Glasser et al. 2016), published on `fs_LR`, projected to `fsaverage` by the Mills projection, then to the subject: each vertex takes the label of the nearest `fsaverage` vertex on the registered spheres. Validation repeats the transfer and requires the committed annotation byte for byte. The mesh is native; the labels are a group-atlas estimate two registrations from HCP space.

### Julich-Brain

139 cytoarchitectonic areas per hemisphere (Amunts et al. 2020), defined from the histology of postmortem brains: Brodmann-style areas such as 3a, 3b, 1 and 2, 44 and 45, and hOc1 (V1). EBRAINS publishes version 3.1's maximum-probability map on `fsaverage`, resampled there from the Colin27 surface; [`scripts/fetch_julich_brain.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/fetch_julich_brain.py) writes it unchanged as an annotation, and it reaches the subject like HCP-MMP1.0, by the nearest `fsaverage` vertex on the registered spheres. Each area joins the lobe its published location names, for example postcentral gyrus to Central, so its groups match Destrieux's.

About a quarter of each hemisphere (24% on CDMD) is in seven gap maps, cortex the atlas has not yet mapped, mostly prefrontal and temporo-parietal. They and the two medial masks are unassigned, like the medial wall. Cut faces take the label of the nearest pial or white vertex inside the ribbon, as for HCP-MMP. The atlas is CC BY-NC-SA 4.0: non-commercial, shared alike.

### Schaefer 2018

200 parcels per hemisphere from resting-state functional connectivity (Schaefer et al. 2018), estimated from 1,489 participants and published on `fsaverage`. They reach the subject like HCP-MMP1.0, by the nearest `fsaverage` vertex on the registered spheres; on CDMD every parcel survives the transfer, and no parcel leaves more than 1.6% of its area in a stray fragment.

Parcels keep their published 7-network colours and group by that Yeo network. The 17-network order divides the same 400 parcels, and its names say where 175 of each hemisphere's 200 lie, where the 7-network names locate no visual or somatomotor parcel; each parcel is named from it, with CBIG's abbreviation table spelled out, for example *Default mode A, dorsal prefrontal cortex 1*. The build pairs the two orders on `fsaverage` and fails unless every parcel pairs one to one. The parcels are a group estimate registered onto this brain, not its measured function. Licensed MIT.

## Data

| Atlas | Input | Pinned by |
| :--- | :--- | :--- |
| Destrieux | `label/{lh,rh}.aparc.a2009s.annot` and `mri/aparc.a2009s+aseg.mgz` of the subject's FreeSurfer 8.2 reconstruction | `data/sources.json` (sha256) and `reconstruction.json` |
| HCP-MMP1.0 | `data/fsaverage/label/{lh,rh}.HCPMMP1.annot`, figshare files 5528816 and 5528819, DOI 10.6084/m9.figshare.3498446.v2 | sha256 and md5 in `data/sources.json` |
| Julich-Brain 3.1 | `fsaverage_surface/{lh,rh}.JulichBrainAtlas_3.1.label.gii` in the EBRAINS bucket `d-f1fe19e8-99bd-44bc-9616-a52850680777`, and its CC BY-NC-SA licence PDF; DOI 10.25493/KNSN-XB4 | sha256 constants in `scripts/fetch_julich_brain.py` (lh `e4a854…afda4`, rh `88e442…a9ac`, licence `8ece6c…14bf`) |
| Schaefer 2018 | `Schaefer2018_400Parcels_7Networks_order.annot` and `…17Networks_order.annot`, CBIG `FreeSurfer5.3/fsaverage/label`; DOI 10.1093/cercor/bhx179 | sha256 in `data/sources.json`; MIT (ThomasYeoLab/CBIG) |
| Registered spheres | `surf/{lh,rh}.sphere.reg` of `fsaverage` and of the subject | `data/sources.json` |

The Destrieux atlas is the reference for 2009 sulcal and gyral parcels (Destrieux et al. 2010, DOI 10.1016/j.neuroimage.2010.06.010). The licence of HCP-MMP1.0 is redistributed with the models as `HCP-Data-Use-Terms.txt`, and Julich-Brain's as `Julich-Brain-CC-BY-NC-SA-4.0.pdf`, both under `public/models/licenses/`. See [references](../reference/references.md) for full citations.

## How it was built

### 1. Fetch Julich-Brain and write it as an annotation

`scripts/fetch_julich_brain.py` downloads each hemisphere's GIFTI label file to `data/cache/julich-brain`, refuses a file whose sha256 differs, and runs `as_annotation`:

1. The file must hold one integer key per `fsaverage` vertex (the vertex count is read from `fsaverage`'s `white` surface).
2. The atlas's own label table is sorted by key; each vertex's key becomes its table index. A key the table lacks stops the script.
3. The annotation colour column must be the RGB code (`R + 256 G + 65536 B`), not the label key, so two labels with one colour stop the script.
4. The result is written with `write_annot` to `data/fsaverage/label/<hemisphere>.JulichBrain3.1.annot` and read back: every vertex keeps its label and name.

No label is changed. With `--record` the files are registered in `data/sources.json` with licence CC BY-NC-SA 4.0.

### 2. Project the annotations to the subject through registered spheres

`scripts/prepare_subject.py` (`transfer_annotations`) transfers three annotations when an anatomy declares `project_hcp_from: fsaverage` (`cdmd` does): `HCPMMP1`, `JulichBrain3.1` and `Schaefer2018_400Parcels_7Networks_order`. For each hemisphere it:

1. Reads the source sphere (`fsaverage` `sphere.reg`), the target sphere (the subject's `sphere.reg`) and the source annotation.
2. Calls `resample_surface_labels(source_sphere, target_sphere, labels)`: a `cKDTree` of the source sphere, then the label of the nearest source vertex for each target vertex. Both spheres must be finite `(n, 3)` arrays and the labels one integer per source vertex.
3. Refuses a result whose set of labels differs from the source's (no label may be lost or invented).
4. Writes the annotation with the source colours and names unchanged and reads it back, requiring identical labels, colours and names.
5. Re-derives 512 evenly spaced target vertices (`annotation_projection.verify_samples`) against a brute-force nearest source vertex.
6. Writes a report (`hcp-registration.json`, `julich-registration.json`, `network-registration.json`) and records the output and its derivation in `data/sources.json`.

The transfer is categorical: nearest vertex only, no smoothing, no interpolation of label identifiers. On CDMD the target hemispheres have 108,347 (left) and 108,379 (right) vertices, and the labels preserved are 181 for HCP-MMP1.0 (180 areas and the unlabelled entry), 148 for Julich-Brain (139 areas, 7 gap maps, 2 medial masks) and 201 for Schaefer (200 parcels and the background).

### 3. Partition the pial surface barycentrically

`build_cortex` (in `brain_model/build.py`) reads the subject's native pial surface and the atlas annotation, then `partition_surface` in `brain_model/surfaces/geometry.py` splits only triangles whose three vertices carry different labels:

- A triangle with one label is kept as it is.
- A triangle with several labels is divided into six: three edge midpoints and the face centroid are added, and each corner receives two triangles (corner, next midpoint, centroid) and (corner, centroid, previous midpoint), owned by that corner vertex's label.
- New points are the mean of their source vertices; their normals are the normalised mean of source vertex normals.

Original vertices never move, so the pial area is conserved: validation requires the relative area error to stay within $10^{-6}$ (`validation.relative_area_tolerance`), and on CDMD the largest parent-plane error is about $5 \times 10^{-15}$ mm. A scalar or categorical per-vertex field is carried onto the new points by the same cells: `partition_vertex_field` averages scalars, and `partition_vertex_labels` takes the majority of integer values (`majority`: the repeated value of a pair, else the lowest).

Each region is written to `cortex-<atlas>.glb` with id `<atlas>:<hemisphere>:<source label>`. `cortical_region` marks `Unknown`, `unknown`, `???`, `Medial_wall`, `CorpusCallosumMask`, `BrainStemMask`, `Background+FreeSurfer_Defined_Medial_Wall` and every `GapMap-*` name as `non-region`. Each region mesh carries the vertex attributes `_SULC` (sulcal depth from `lh.sulc`/`rh.sulc`), `_OPENNESS` (baked occlusion), `_T1` (trilinear `orig.mgz` at the pial and white midpoints), `_NETWORK` (Yeo network) and, where declared, `_TERRITORY` and the visual-field fields. A cortical region is placed (`surface_placement`) at the mid-ribbon point `(pial + white) / 2` nearest the centroid of its vertices, until the cut volume's ribbon voxels replace the placement.

On CDMD the export has 287,890 and 287,044 triangles for Destrieux (left, right), 331,760 and 332,874 for HCP-MMP, 318,815 and 320,309 for Julich-Brain, and 326,075 and 325,579 for Schaefer, from 216,690 and 216,754 source triangles.

### 4. Name Schaefer's parcels

`networks.published_seventeen_network_names` reads the 7- and 17-network annotations from the projection source and `networks.seventeen_network_names` pairs them by their label columns. It fails unless every 7-network parcel pairs with exactly one 17-network parcel and none has a negative label. The atlas entry in `config/model.yaml` names the second annotation in `names_from`; each region records `source_17_network_name`. `networks.verify_palette` checks each parcel colour lies within `networks.maximum_color_jitter` (12 per channel) of its published Yeo colour (the widest observed jitter is 8).

### 5. Close the ribbon into solid wedges

`export_ribbon_labels` in `brain_model/surfaces/ribbons.py` writes `ribbon-<atlas>.labels`: one little-endian `uint16` per pial vertex (left hemisphere, then right), the index into the published region ids of that vertex's parcel. A triangle belongs to the parcel holding most of its vertices (`triangle_owners` uses `majority`; the lowest wins a three-way tie). The viewer closes each parcel into a wedge: its pial patch, its white patch reversed, and walls along the patch boundary. The build refuses an atlas whose wedges have open edges (`wedge_defects` `holes` must be 0).

### 6. Label the cut faces

`export_tissue_labels` in `brain_model/labels/tissue_labels.py` starts from the subject's `aparc.a2009s+aseg.mgz`. Destrieux's cut labels are those source labels, with lossless ID encoding. Every other cortical atlas uses `project_surface_atlas`:

1. Take voxels whose source label is a Destrieux cortical label (11101–11175 left, 12101–12175 right).
2. Set all of them to the annotation's unlabelled entry 0.
3. For the voxels also inside `ribbon.mgz`'s cortex (3 left, 42 right), look up the nearest vertex among the stacked pial and white vertices (`cKDTree`; index modulo the vertex count) and give the voxel that vertex's annotation label.
4. Leave every non-cortical voxel as in the source.

The result is cropped to the label bounding box and written as `tissues-<atlas>.volume` (gzip, `uint16`, Fortran order, with the affine, shape and both checksums). A cortical voxel outside the ribbon takes the unlabelled entry: on CDMD Julich-Brain has 47 left and 69 right. Each atlas's parcels are placed by their ribbon voxels (`place_cortex`); a parcel with no ribbon voxel keeps its surface placement (on CDMD `julich:left:23`, `julich:left:24` and `julich:right:24`).

## How the viewer uses it

- The model loads `cortex-<atlas>.glb` for the chosen atlas (the first frame needs one atlas) and the other atlases on demand; the shading attributes are measured once on the first atlas and the others are held to the same span, so one decode serves all.
- Regions are looked up by id in the manifest; names come from [`web/src/lib/core/catalog/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/lib/core/catalog): `destrieux-labels.ts`, `julich-labels.ts` (each Julich area's first location tag, for example `PostCG`, maps to a lobe so groups match Destrieux), `schaefer-labels.ts` (the 17-network name with CBIG's abbreviations spelled out) and `networks.ts`.
- On a cut, `web/src/lib/engine/tissues/` samples `tissues-<atlas>.volume` on the GPU (`label-sampling.ts`, `cap-labels.ts`); `ribbon-wedges.ts` builds the closed solid for each parcel from `ribbon-<atlas>.labels`.
- Overlap with another cortical atlas is in [Atlas comparison](atlas-comparison.md).

## Checks

| Check | Result on CDMD |
| :--- | :--- |
| Projected annotations re-derived byte for byte (step 11) | HCP-MMP, Julich-Brain and Schaefer: both hemispheres identical to the committed files |
| Annotation labels preserved by the transfer | 181 HCP-MMP, 148 Julich-Brain, 201 Schaefer, in each hemisphere |
| Projected cut labels (step 4) | Equal to Destrieux outside cortex; inside, every ribbon voxel holds the label of its nearest pial or white vertex |
| Cut atlases | Julich-Brain: 181,550 left and 179,697 right ribbon voxels; 47 and 69 cortical voxels outside the ribbon |
| Ribbon wedges | No holes in any atlas; pinches 80 (Destrieux), 170 (HCP-MMP), 149 (Julich-Brain), 231 (Schaefer) |
| Cortical area partition | Pial area conserved to relative $10^{-6}$ |
| Schaefer fragmentation | Every parcel survives; no parcel leaves more than 1.6% of its area in a stray fragment |

## Limits

- HCP-MMP is two registrations from HCP space (`fs_LR` to `fsaverage`, then `fsaverage` to this brain); the labels are a group-atlas estimate and the mesh is native.
- Julich-Brain was resampled from Colin27 to `fsaverage`, then to this brain, and leaves about a quarter of the cortex unassigned (24% on CDMD). Its gap maps and medial masks are not areas.
- Schaefer's parcels are a group resting-state estimate on `fsaverage`, one registration from this brain, not its measured function.
- HCP-MMP, Julich-Brain and Schaefer cut labels are derived, ribbon-restricted projections of surface labels, not published native volumetric atlases; native voxel boundaries and the high-resolution surfaces may not coincide exactly.
- Native 1 mm tissue labels come from one individual's own segmentation, with no claim of subvoxel accuracy.
- Julich-Brain is CC BY-NC-SA 4.0 (non-commercial, shared alike); HCP-MMP1.0 is redistributed only under the HCP data use terms; Schaefer is MIT.

## Reproduce

```bash
# Julich-Brain 3.1 onto fsaverage, then every projected annotation onto the subject
uv run python scripts/fetch_julich_brain.py --record
uv run python scripts/prepare_subject.py --anatomy cdmd

# Surfaces, ribbon labels and cut-label volumes
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
```

## See also

- [Atlas comparison](atlas-comparison.md): overlap between pairs of these atlases
- [Functional networks](functional-networks.md): Yeo 7 and CAB-NP on the same parcels
- [Functional divisions](functional-divisions.md): Glasser and Rolls groupings of HCP-MMP areas
- [Receptor fingerprints](receptor-fingerprints.md): Julich-Brain area names
- [Validation](../pipeline/validation.md) and [building](../pipeline/building.md)
- [References and licensing](../reference/references.md)
