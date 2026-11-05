# Atlas comparison

For a region of one cortical atlas, the area it shares with each region of another, measured on the original pial surface and drawn as an outline on the model.

:::{list-table}
:widths: 22 78
:stub-columns: 1

* - Where in the viewer
  - The Anatomy tab's region detail for a Destrieux, HCP-MMP, Julich-Brain or Schaefer region: **Overlap with**, **Compare with**, and **Download CSV**.
* - Built by
  - [`brain_model/layers/comparison.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/comparison.py), [`brain_model/surfaces/geometry.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/surfaces/geometry.py) (`partition_surface`), [`brain_model/gltf/export.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/gltf/export.py)
* - Configuration
  - [`config/model.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/model.yaml): `atlas_comparison` (`enabled_anatomies: [cdmd]`, `atlases: [destrieux, hcp-mmp, julich, schaefer]`)
* - Source data
  - The subject's native `pial` surface and the four annotations of [Cortical atlases](cortical-atlases.md), pinned in `data/sources.json`
* - Checked by
  - [`tests/test_comparison.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_comparison.py); `web/src/lib/core/comparison/catalog.test.ts`, `web/src/lib/core/assets/comparison-assets.test.ts`, `web/src/features/inspector/AtlasComparison.svelte.test.ts`
:::

## What it does

The region detail of a Destrieux, HCP-MMP, Julich-Brain or Schaefer region lists the regions of another cortical atlas it shares pial surface with: the shared area in mm² and its share of the selected region's **whole** surface, with the unassigned remainder shown. **Compare with** chooses that atlas. Each pair is published as its own file and downloads the first time it is shown. Activating a row outlines that intersection on the model; a section turns outlines off. **Download CSV** exports every pair at full precision with checksums and citations, named after both atlases.

The two directions differ, because a share is the pair area over the selected region's whole pial area, unassigned cells included. CDMD's left precentral gyrus shares about 447.8 mm² with HCP-MMP area 4: 20.6% of the gyrus and 31.6% of area 4. Nothing is dropped or renormalised.

Julich-Brain's gap maps and medial masks, and Schaefer's medial wall, count as unassigned, so on CDMD 34 of the 148 Destrieux regions lie mostly in Julich-Brain's unassigned cortex. Overlap is spatial, not functional equivalence: it carries no measurement from one atlas's region to another's. For example, Julich-Brain's receptor fingerprints are not carried to HCP-MMP regions.

## Data

The comparison reads, for each hemisphere, `surf/<lh|rh>.pial` and `label/<lh|rh>.<annotation>.annot` of the two atlases from the subject's source directory. Before measuring, `verify_comparison_sources` requires each file's path and sha256 to equal an entry of the published manifest's provenance; the build fails otherwise. The per-region areas come from the published region identities: `source_region_index` requires `region.id == "<atlas>:<hemisphere>:<label>"`, kind `cortex` or `non-region` and unique labels, and `load_annotation` requires the annotation's labels, names, annotation values and vertex counts to equal the published regions'.

## How it was built

### 1. Select the pairs

`atlas_comparison.atlases` lists the four atlases; `export_comparisons` takes every unordered pair with `itertools.combinations`, six in all. `comparison_atlases` refuses an anatomy not in `enabled_anatomies`, a pair that is not two distinct configured atlases, or an atlas with no published cortical surface.

### 2. Measure joint cells in float64

`compare_surface(vertices, faces, annotations)` takes the pial vertices as float64 and an `(n_vertices, 2)` integer array of the two atlases' labels:

1. Triangle areas are $\tfrac12 \lVert (v_1 - v_0) \times (v_2 - v_0) \rVert$; any non-finite or zero-area triangle stops the build.
2. Each triangle gives one third of its area to each of its three corners (`bincount` of `areas / 3` over the face vertices), the vertex-cell convention the boundaries of [Cortical atlases](cortical-atlases.md) use.
3. Vertex areas are summed by the unique pair of labels (`np.unique(..., axis=0)`), giving the area of each joint label pair in mm².

Every pair keeps its unassigned cells: Julich-Brain's gap maps and medial masks, and Schaefer's medial wall, are regions of kind `non-region`, so each hemisphere's pair areas sum to its whole pial area.

### 3. Build the intersection meshes

The same call runs `partition_surface` on the joint code, so each joint cell becomes one mesh on the original pial tessellation, using the barycentric split of [Cortical atlases](cortical-atlases.md#3-partition-the-pial-surface-barycentrically). `export_hemisphere` adds a mesh `overlap:<hemisphere>:<labelA>:<labelB>` (white, mask only) for every pair with area, and records `{region_ids, area_mm2, mesh_id}`.

### 4. Write the files

`export_comparison` writes, for each pair, the geometry `atlas-overlaps[-<a>-<b>].glb` and the sidecar `atlas-comparison[-<a>-<b>].json`; the suffix is empty for the first pair, `destrieux` with `hcp-mmp`. The sidecar records `schema_version: 1`, `anatomy_id`, the two atlases, `surface: "pial"`, `method: "barycentric-vertex-cells"`, `units: "mm2"`, per-region `totals` (the sum of a region's pair areas, its full pial area), the pairs, the pial and annotation files with sha256 per hemisphere, the two cortical atlas assets with sha256 and citation, and the geometry file with sha256. `attach_comparisons` declares every pair in `manifest["atlas_comparisons"]` and the first pair under the older single-pair key `atlas_comparison`.

`python -m brain_model.layers.comparison --anatomy cdmd` (`publish_comparison`) attaches comparisons to an existing publication without rebuilding anatomy.

### CDMD

| Pair | Positive joint pairs |
| :--- | ---: |
| Destrieux × HCP-MMP | 1,202 |
| Destrieux × Julich-Brain | 1,056 |
| Destrieux × Schaefer | 1,221 |
| HCP-MMP × Julich-Brain | 1,537 |
| HCP-MMP × Schaefer | 1,767 |
| Julich-Brain × Schaefer | 1,556 |

Every pair file conserves both hemispheres to the same totals: about 85,619.412 mm² left and 85,458.887 mm² right.

## How the viewer uses it

- [`web/src/lib/core/comparison/catalog.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/comparison/catalog.ts) validates the sidecar against the manifest (schema, subject, atlas order, `pial`, `barycentric-vertex-cells`, `mm2`, checksums, per-region totals, unique mesh identities) and builds, for a selected region and partner atlas, rows of `areaMm2` and `fraction` of the region's total, with the remainder as the unassigned share. `comparisonPartners` lists which atlases the selected region's atlas is measured against.
- `web/src/features/inspector/AtlasComparison.svelte` shows the list, **Compare with**, and the CSV export (`<anatomy>-<region id>-<partner>-atlas-comparison.csv`).
- [`web/src/lib/engine/comparison/overlay.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/engine/comparison/overlay.ts) loads the pair's `atlas-overlaps*.glb` and keeps each mesh as a mask only (`colorWrite: false`, `depthWrite: false`, hidden); the outline pass draws the highlighted pair's mesh, so atlas colours and depth stay intact.

## Checks

`tests/test_comparison.py` checks the overlap calculation against explicit barycentric subdivision (unequal triangles use area and conserve unassigned cells; exact pair meshes have the same area as the common cells), refuses invalid surface state and inconsistent identity, checks real source marginals against published float32 surface areas, that exported geometry contains only the exact joint cells, and that three atlases publish pairwise comparisons with identical marginals.

| Check | CDMD |
| :--- | :--- |
| Both hemispheres conserved, every pair file | 85,619.412 mm² left, 85,458.887 mm² right |
| Largest discrepancy against the cortical meshes | $1.12 \times 10^{-4}$ mm², within the float32 bound |

These are numerical checks, not proof that projected boundaries are biologically exact.

## Limits

- Overlap is spatial. It is not functional equivalence and carries no measurement from one atlas's region to another's.
- The share depends on direction: it is over the selected region's whole pial area, so a region in unassigned cortex of the other atlas shows a large unassigned remainder.
- HCP-MMP, Julich-Brain and Schaefer are projected onto this brain; their boundaries are as exact as the projection ([Cortical atlases](cortical-atlases.md#limits)).
- Enabled for `cdmd` only; the pair loops need two published cortical surfaces.

## Reproduce

```bash
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.layers.comparison --anatomy cdmd
uv run pytest tests/test_comparison.py
```

## See also

- [Cortical atlases](cortical-atlases.md)
- [Receptor fingerprints](receptor-fingerprints.md)
- [Validation](../pipeline/validation.md)
