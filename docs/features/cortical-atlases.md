# Cortical atlases

Five parcellations of the cortex, Destrieux, Desikan-Killiany, HCP-MMP1.0 (Human Connectome Project multimodal parcellation), Julich-Brain 3.1 and Schaefer 2018, are drawn on one brain's native pial surface, on solid ribbon wedges and on cut faces. Destrieux and Desikan-Killiany are the subject's own FreeSurfer annotations; the other three are group atlases carried from `fsaverage` to the subject by nearest vertex on registered spheres. Their boundaries are therefore projected estimates, not boundaries measured in this brain.

```{figure} figures/cortical-atlases-1.webp
:alt: Four lateral views of the same left hemisphere, each coloured by a different cortical atlas: Destrieux gyri and sulci, HCP-MMP areas, Julich-Brain areas with large beige unmapped patches, and Schaefer parcels in seven network colours.
:name: fig-cortical-atlases-1

**One native pial surface carries four atlases.** **a**, Destrieux (74 parcels per hemisphere). **b**, HCP-MMP1.0 (180 areas). **c**, Julich-Brain 3.1 (139 areas); beige is the unassigned gap-map cortex. **d**, Schaefer 2018 (200 parcels), in its published 7-network colours. CDMD (sub_013), left hemisphere, lateral view; identical camera and surface in every panel, internal anatomy hidden.
```

## Data

| Atlas | Input | Pinned by |
| :--- | :--- | :--- |
| Destrieux (`aparc.a2009s`) | Subject `label/{lh,rh}.aparc.a2009s.annot` and `mri/aparc.a2009s+aseg.mgz`, FreeSurfer 8.2 `recon-all` | sha256 in `data/sources.json`; `reconstruction.json` |
| Desikan-Killiany (`aparc`) | Subject `label/{lh,rh}.aparc.annot`, the same `recon-all` run (written before the Destrieux annotation; the run's report predates its copy, so `unreported_outputs` declares it) | sha256 in `data/sources.json` |
| HCP-MMP1.0 | `fsaverage` `label/{lh,rh}.HCPMMP1.annot`, figshare files 5528816 and 5528819 (DOI 10.6084/m9.figshare.3498446.v2) | sha256 and md5 in `data/sources.json` |
| Julich-Brain 3.1 | `fsaverage_surface/{lh,rh}.JulichBrainAtlas_3.1.label.gii`, EBRAINS bucket `d-f1fe19e8-99bd-44bc-9616-a52850680777` (DOI 10.25493/KNSN-XB4) | sha256 constants in `scripts/fetch_julich_brain.py` |
| Schaefer 2018 | `Schaefer2018_400Parcels_{7,17}Networks_order.annot`, CBIG `FreeSurfer5.3/fsaverage/label` | sha256 in `data/sources.json` |
| Registered spheres | `surf/{lh,rh}.sphere.reg` of `fsaverage` and of the subject | sha256 in `data/sources.json` |

CDMD's pial surfaces have 108,347 (left) and 108,379 (right) vertices and 216,690 and 216,754 triangles. Published region counts (`manifest.json`) are 148 Destrieux parcels, 68 Desikan-Killiany regions, 360 HCP-MMP areas, 278 Julich-Brain areas and 400 Schaefer parcels, plus non-region entries: 2 medial walls each for Destrieux, Desikan-Killiany, HCP-MMP and Schaefer, and 18 for Julich-Brain (per hemisphere, 7 gap maps and 2 medial masks). Desikan-Killiany leaves its medial wall outside every table entry (label −1, 8,162 left and 8,254 right vertices); the build and the cut labels read it as entry 0. Citations: Destrieux et al. (2010), Desikan et al. (2006), Glasser et al. (2016), Amunts et al. (2020), Schaefer et al. (2018) ([references](../reference/references.md#cortical-and-subcortical-atlases)).

## Method

### Julich-Brain as an annotation

`scripts/fetch_julich_brain.py` refuses a GIFTI file whose sha256 differs from its constant. The file must hold one integer key per `fsaverage` vertex. The label table is sorted by key, each key becomes its table index, and a key the table lacks stops the script. Colours are encoded as $R + 2^8 G + 2^{16} B$; two labels with one colour stop the script. The annotation is written to `data/fsaverage/label/<hemi>.JulichBrain3.1.annot` and read back; no label is changed.

### Projection through registered spheres

`transfer_annotation` (`scripts/prepare_subject.py`) projects `HCPMMP1`, `JulichBrain3.1` and `Schaefer2018_400Parcels_7Networks_order` for an anatomy that declares `project_hcp_from` (CDMD does). For each hemisphere:

1. `resample_surface_labels` builds a `cKDTree` on the `fsaverage` `sphere.reg` and gives each subject `sphere.reg` vertex the label of its nearest source vertex. No smoothing, no interpolation of label identifiers.
2. The set of labels must equal the source's: none lost, none invented.
3. The annotation is written with the source colours and names and read back unchanged.
4. 512 evenly spaced target vertices (`annotation_projection.verify_samples`) are re-derived by brute-force nearest neighbour.

Labels preserved per hemisphere: 181 for HCP-MMP (180 areas and the unlabelled entry), 148 for Julich-Brain (139 areas, 7 gap maps, 2 medial masks) and 201 for Schaefer (200 parcels and the medial wall). HCP-MMP's `fsaverage` source is itself the published Mills projection from `fs_LR`, so its labels are two registrations from HCP space.

### Barycentric partition of the pial surface

`build_cortex` (`brain_model/build.py`) reads the native pial surface, which must be closed and genus zero ($V - E + F = 2$). `partition_surface` (`brain_model/surfaces/geometry.py`) keeps every single-label triangle and divides each mixed-label triangle into six: its three edge midpoints and centroid are added, and each corner owns the two triangles (corner, next midpoint, centroid) and (corner, centroid, previous midpoint). New points are means of their source vertices; normals are normalised means. No original vertex moves, so each region owns exactly one third of every triangle at each of its vertices and the pial area is conserved.

Each region becomes one mesh with id `<atlas>:<hemisphere>:<source label>`. `cortical_region` marks `Unknown`, `unknown`, `???`, `Medial_wall`, `CorpusCallosumMask`, `BrainStemMask`, `Background+FreeSurfer_Defined_Medial_Wall` and every `GapMap-*` as `non-region`. Meshes carry `_SULC` (`sulc`), `_OPENNESS` (baked occlusion), `_T1` (trilinear `orig.mgz` at pial–white midpoints) and categorical fields (`_NETWORK`, `_TERRITORY`) carried by `partition_vertex_labels`, which takes the repeated value of a pair, else the lowest. Exported triangles, left and right: Destrieux 287,890 and 287,044; Desikan-Killiany 256,695 and 256,734; HCP-MMP 331,760 and 332,874; Julich-Brain 318,815 and 320,309; Schaefer 326,075 and 325,579.

### Schaefer names and colours

`seventeen_network_names` (`brain_model/layers/networks.py`) pairs each 7-network parcel with its 17-network parcel on `fsaverage` and fails unless the pairing is one to one. The 17-network names carry a location for 175 left and 170 right parcels; no 7-network visual or somatomotor parcel has one. `verify_palette` requires each parcel colour within 12 per channel (`networks.maximum_color_jitter`) of its published Yeo colour. On CDMD every parcel survives projection; the largest share of a parcel's vertices outside its largest connected patch is 1.6% (right hemisphere).

### Ribbon wedges

`export_ribbon_labels` (`brain_model/surfaces/ribbons.py`) writes `ribbon-<atlas>.labels`: one little-endian `uint16` region index per pial vertex, left then right. A triangle belongs to the label held by most of its vertices; a three-way tie goes to the lowest. Each parcel closes into a wedge of its pial patch, its reversed white patch and walls along the patch boundary. The build refuses any atlas with an open wedge edge.

### Cut-face labels

`export_tissue_labels` (`brain_model/labels/tissue_labels.py`) starts from `aparc.a2009s+aseg.mgz`; Destrieux cut labels are those source labels. For every other atlas, Desikan-Killiany included, `project_surface_atlas`:

1. takes voxels with a Destrieux cortical label (11101–11199 left, 12101–12199 right) and sets them to annotation entry 0 (unlabelled);
2. gives each such voxel inside `ribbon.mgz` cortex (label 3 left, 42 right) the annotation label of its nearest vertex among stacked pial and white vertices (`cKDTree`, index modulo the vertex count);
3. leaves every non-cortical voxel unchanged.

The volume is cropped to its label bounding box and written as `tissues-<atlas>.volume` (gzip, `uint16`, Fortran order). Parcels are placed at their ribbon voxels (`place_cortex`); a parcel with no ribbon voxel keeps its surface placement, the mid-ribbon point nearest its vertex centroid.

## Display

The **Atlas** menu chooses the surface atlas (URL key `atlas`: `destrieux`, `desikan`, `hcp-mmp`, `julich`, `schaefer`); the cut-face atlas is the key `cuts`. `cortex-<atlas>.glb` loads for the chosen atlas and others on demand. The first atlas built measures the shading-field ranges and later atlases are held to them, so one decode serves every file. Region names come from `web/src/lib/core/catalog/`. Julich-Brain areas group by lobe from their first location tag (e.g. `PostCG` → Central), as Destrieux groups; Desikan-Killiany regions take the lobe Destrieux lists the same gyrus under (`desikan-labels.ts`) and their French names from NextBrain's table, whose cortex has the same names. Desikan-Killiany is the atlas [disorder effects](disorder-effects.md) are reported on; it has no atlas comparison. Schaefer parcels show their 17-network name with CBIG's abbreviations spelled out. On a cut, `tissues-<atlas>.volume` is sampled on the GPU and `ribbon-wedges.ts` closes each parcel from `ribbon-<atlas>.labels`. Pairwise overlap is in [atlas comparison](atlas-comparison.md).

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| `validate_transforms`, `tests/test_transforms.py` | Projected annotations re-derived byte for byte | HCP-MMP, Julich-Brain, Schaefer: identical, both hemispheres |
| `prepare_subject.py` transfer checks | Label set preserved; 512 samples match brute-force nearest vertex | 181, 148, 201 labels per hemisphere |
| `tests/test_registration.py` | Categorical transfer without averaging; invalid spheres fail | passes |
| `tests/test_geometry.py`; `brain_model.validate` | Partition preserves area and vertex labels; exported area within relative $10^{-6}$ | largest parent-plane error $6.1 \times 10^{-15}$ mm |
| `tests/test_ribbons.py`; `brain_model.validate` | Every ribbon wedge closed (0 holes) | pinches: 80 Destrieux, 32 Desikan-Killiany, 170 HCP-MMP, 149 Julich-Brain, 231 Schaefer |
| `tests/test_tissue_labels.py`; `brain_model.validate` | Non-cortical voxels equal Destrieux; ribbon voxels equal nearest-vertex label | passes; 181,550 left and 179,697 right ribbon voxels; 47 and 69 cortical voxels outside the ribbon |
| `tests/test_networks.py` | 7- and 17-network orders pair one to one; palette within jitter | passes |
| `brain_model.validate` placements | Anchor inside own label | Desikan-Killiany 68 of 68; Julich-Brain 275 of 278; CA2 (left) and CA3 (both sides) placed on surface |

## Limitations

- HCP-MMP labels are two registrations from HCP space (`fs_LR` → `fsaverage` → subject); the mesh is native, the labels are a group estimate.
- Julich-Brain leaves 24.3% (left) and 24.2% (right) of the pial area in gap maps, cortex the atlas has not mapped; the largest is `GapMap-Temporal-to-Parietal` (9,870 mm² left, 11,823 mm² right).
- Schaefer parcels are a group resting-state estimate, not this brain's measured function.
- Projected cut labels are ribbon-restricted nearest-vertex projections of surface labels, not published volumetric atlases; they may not coincide with the surfaces at voxel scale.
- Cut labels rest on one individual's 1 mm segmentation, with no claim of subvoxel accuracy.
- Licences: Julich-Brain CC BY-NC-SA 4.0 (non-commercial, share-alike); HCP-MMP1.0 under the HCP data use terms; Schaefer MIT ([licences](../reference/references.md#licences)).

## Code availability

| | |
| :--- | :--- |
| Code | [`scripts/fetch_julich_brain.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/fetch_julich_brain.py), [`scripts/prepare_subject.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/prepare_subject.py), [`brain_model/surfaces/registration.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/surfaces/registration.py), [`brain_model/surfaces/geometry.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/surfaces/geometry.py), [`brain_model/build.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/build.py), [`brain_model/surfaces/ribbons.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/surfaces/ribbons.py), [`brain_model/labels/tissue_labels.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/labels/tissue_labels.py), [`brain_model/layers/networks.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/networks.py) |
| Configuration | [`config/model.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/model.yaml): `atlases`, `annotation_projection`, `networks`, `validation.relative_area_tolerance` |
| Tests | `tests/test_registration.py`, `tests/test_geometry.py`, `tests/test_ribbons.py`, `tests/test_tissue_labels.py`, `tests/test_networks.py`, `tests/test_transforms.py` |

```bash
uv run python scripts/fetch_julich_brain.py --record
uv run python scripts/prepare_subject.py --anatomy cdmd
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
```

Figure state (panel c): https://planumatlas.com/#anatomy=cdmd&atlas=julich&view=left&hemi=left&internal=0
