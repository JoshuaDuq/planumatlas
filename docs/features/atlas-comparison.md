# Atlas comparison

For a region of one cortical atlas, the viewer lists the pial area it shares with each region of another atlas, in mm² and as a share of the selected region's whole surface. Six atlas pairs are measured on CDMD's native pial tessellation by barycentric vertex cells, with unassigned cortex kept. Overlap is spatial correspondence only; it carries no measurement from one atlas's region to another's.

```{figure} figures/atlas-comparison-1.webp
:alt: Three lateral views of the left hemisphere and one panel of the region detail. The precentral gyrus is outlined on the Destrieux atlas, area 4 on HCP-MMP, and their shared surface on Destrieux; the panel lists area 4 at 447.8 square millimetres, 20.6 percent of the gyrus, then areas 6d, 55b and 6v.
:name: fig-atlas-comparison-1

**The surface shared by a Destrieux gyrus and an HCP-MMP area is measured and outlined.** **a**, Destrieux left precentral gyrus (`destrieux:left:29`, 2,170 mm²) selected. **b**, HCP-MMP left area 4 (`hcp-mmp:left:8`, 1,419 mm²) selected. **c**, Region detail of the gyrus, **Overlap with HCP-MMP**: area 4 shares 447.8 mm², 20.6% of the gyrus; 6d, 55b and 6v follow, with 6 more regions under the disclosure. **d**, The activated row outlines the gyrus ∩ area 4 cell on the model. CDMD, left hemisphere, lateral view, internal anatomy hidden; same camera in a, b and d.
```

## Data

For each hemisphere, the subject's `surf/<lh|rh>.pial` and the two atlases' `label/<lh|rh>.<annotation>.annot` ([cortical atlases](cortical-atlases.md#data)). `verify_comparison_sources` requires each file's path and sha256 to match the published manifest's provenance. Region identities come from `manifest.json`: `source_region_index` requires ids `<atlas>:<hemisphere>:<label>`, kind `cortex` or `non-region` and unique labels; `load_annotation` requires the annotation's names, annotation values and vertex counts to equal the published regions'.

## Method

### Pairs

`atlas_comparison.atlases` lists `destrieux`, `hcp-mmp`, `julich` and `schaefer`; `export_comparisons` takes every unordered pair (`itertools.combinations`), six in all. `comparison_atlases` refuses an anatomy not in `enabled_anatomies` (`[cdmd]`), a pair that is not two distinct configured atlases, and an atlas with no published surface.

### Joint vertex cells

`compare_surface` (`brain_model/layers/comparison.py`) takes the pial vertices in float64 and an $(n_\text{vertices}, 2)$ array of the two atlases' labels.

1. Triangle area $A_t = \tfrac12 \lVert (v_1 - v_0) \times (v_2 - v_0) \rVert$; a non-finite or zero area stops the build.
2. Vertex area $a_i = \sum_{t \ni i} A_t / 3$, the barycentric cell that [cortical atlases](cortical-atlases.md#method) assigns to each vertex's label.
3. For each label pair $(p, q)$, area $S_{pq} = \sum_{i:\,(\ell^A_i, \ell^B_i) = (p,q)} a_i$ in mm².

Non-region labels (medial walls, Julich-Brain gap maps and medial masks) are kept, so each hemisphere's $S_{pq}$ sum to its whole pial area. The share shown for region $p$ is $S_{pq} / \sum_{q'} S_{pq'}$, the denominator being $p$'s full pial area, unassigned cells included; nothing is renormalised. The two directions therefore differ: the precentral gyrus ∩ area 4 cell (447.8 mm²) is 20.6% of the gyrus and 31.6% of area 4.

### Intersection meshes and files

`partition_surface` runs on the joint label code, so each joint cell becomes one mesh on the original tessellation. `export_hemisphere` adds a mesh `overlap:<hemisphere>:<labelA>:<labelB>` for every pair with positive area. `export_comparison` writes `atlas-overlaps[-<a>-<b>].glb` and the sidecar `atlas-comparison[-<a>-<b>].json`; the suffix is empty for `destrieux`–`hcp-mmp`. The sidecar records `schema_version: 1`, `surface: "pial"`, `method: "barycentric-vertex-cells"`, `units: "mm2"`, per-region `totals`, the pairs, and sha256 of every source, atlas asset and geometry file. `attach_comparisons` declares all six in `manifest["atlas_comparisons"]`.

| Pair (CDMD) | Joint cells with area |
| :--- | ---: |
| Destrieux × HCP-MMP | 1,202 |
| Destrieux × Julich-Brain | 1,056 |
| Destrieux × Schaefer | 1,221 |
| HCP-MMP × Julich-Brain | 1,537 |
| HCP-MMP × Schaefer | 1,767 |
| Julich-Brain × Schaefer | 1,556 |

## Display

The region detail of a cortical region opens **Overlap with** *atlas*; **Compare with** chooses the partner, and each pair's files load the first time it is shown. `catalog.ts` validates the sidecar against the manifest (schema, anatomy, atlas order, surface, method, units, checksums, totals, unique mesh ids) and builds rows of area and share, with non-region area summed as **Unassigned**. The first 4 rows are listed and the rest sit under a disclosure. Activating a row outlines its mesh: `overlay.ts` keeps every overlap mesh hidden as a mask (`colorWrite: false`, `depthWrite: false`), and the outline pass draws the active one. A section hides the outline. **Download CSV** exports every row at full precision as `<anatomy>-<region id>-<partner>-atlas-comparison.csv`.

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| `test_unequal_triangles_use_area_and_conserve_unassigned_cells` | Overlap equals explicit barycentric subdivision; unassigned cells kept | passes |
| `test_exact_pair_meshes_have_the_same_area_as_the_common_cells` | Mesh area equals joint-cell area | passes |
| `test_invalid_surface_state_surfaces_an_error`, `test_export_rejects_inconsistent_identity` | Invalid surfaces, identities, anatomies or checksums refused | passes |
| `test_real_source_marginals_match_published_float32_surface_areas` | Per-region marginals equal published region areas within the float32 bound | largest difference $1.12 \times 10^{-4}$ mm² |
| `test_published_geometry_contains_only_the_exact_joint_cells` | Published geometry equals the joint cells | passes |
| `test_three_atlases_publish_pairwise_comparisons_with_identical_marginals` | Every pair keeps the same per-region totals | passes |
| Published sidecars (CDMD) | Each pair conserves each hemisphere's pial area | 85,619.412 mm² left, 85,458.887 mm² right, all six pairs |

Front-end checks: `web/src/lib/core/comparison/catalog.test.ts`, `web/src/lib/core/assets/comparison-assets.test.ts`, `web/src/features/inspector/AtlasComparison.svelte.test.ts`.

## Limitations

- Overlap is spatial, not functional equivalence; for example, Julich-Brain receptor fingerprints are not carried to overlapping HCP-MMP areas.
- Shares depend on direction and include unassigned cortex: 34 of the 148 Destrieux regions lie mostly in Julich-Brain's unassigned cortex on CDMD.
- HCP-MMP, Julich-Brain and Schaefer boundaries are projections onto this brain ([limitations](cortical-atlases.md#limitations)).
- Computed for `cdmd` only.
- The checks are numerical; they do not show that projected boundaries are biologically exact.

## Code availability

| | |
| :--- | :--- |
| Code | [`brain_model/layers/comparison.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/comparison.py), [`brain_model/surfaces/geometry.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/surfaces/geometry.py), [`web/src/lib/core/comparison/catalog.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/comparison/catalog.ts), [`web/src/lib/engine/comparison/overlay.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/engine/comparison/overlay.ts) |
| Configuration | [`config/model.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/model.yaml): `atlas_comparison` |
| Tests | [`tests/test_comparison.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_comparison.py) |

```bash
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.layers.comparison --anatomy cdmd
uv run pytest tests/test_comparison.py
```

Figure state (panel a; open **Overlap with HCP-MMP** and activate the area 4 row for c and d): https://planumatlas.com/#anatomy=cdmd&atlas=destrieux&view=left&hemi=left&internal=0&region=destrieux:left:29
