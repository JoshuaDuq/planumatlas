# Atlas comparison

For a region of one cortical atlas, the viewer lists the pial area it shares with each region of another atlas, in mm² and as a share of the selected region's whole surface (Fig. 1). Six atlas pairs are measured on the native pial tessellation of one brain, `sub_013` of the MGH Connectome Diffusion Microstructure Dataset (CDMD), by barycentric vertex cells, with unassigned cortex kept. Overlap is spatial correspondence only. It carries no measurement from one atlas's region to another's.

```{figure} figures/atlas-comparison-1-light.webp
:alt: Three views of the left hemisphere from its lateral side and one panel of the region detail. The precentral gyrus is outlined on the Destrieux atlas, area 4 on HCP-MMP, and their shared surface on Destrieux. The panel lists area 4 at 447.8 square millimetres, 20.6 percent of the gyrus, then areas 6d, 55b and 6v.
:name: fig-atlas-comparison-1

**The surface shared by a Destrieux gyrus and an HCP-MMP area is measured and outlined.** **a**, [Destrieux left precentral gyrus](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&view=left&hemi=left&internal=0&region=destrieux:left:29) (`destrieux:left:29`, 2,170 mm²) selected. **b**, [HCP-MMP left area 4](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=hcp-mmp&detail=learning&view=left&hemi=left&internal=0&region=hcp-mmp:left:8) (`hcp-mmp:left:8`, 1,419 mm²) selected. **c**, The **Overlap with HCP-MMP** section of the gyrus's region detail, under **Research data**. Area 4 shares 447.8 mm², 20.6% of the gyrus, and areas 6d, 55b and 6v follow, with 6 more regions under the disclosure. **d**, The view of **a** after the area 4 row was activated, which outlines the cell shared by the gyrus and area 4 on the model. CDMD `sub_013`, left hemisphere from its lateral side, internal anatomy hidden; **a**, **b** and **d** share one camera and one scale. Scale bars apply at the depth of the camera's target.
```

## Data

The comparison reads the subject's own surface files and the published manifest. Each input is checked before use, and a failed check stops the export.

| Input | Content | Check before use |
| :--- | :--- | :--- |
| `surf/lh.pial`, `surf/rh.pial` | The subject's pial surface, one file per hemisphere | `verify_comparison_sources` requires the file's path and SHA-256 checksum to match the published manifest's provenance |
| `label/lh.<annotation>.annot`, `label/rh.<annotation>.annot` of the two atlases ([cortical atlases](cortical-atlases.md#data)) | One label per pial vertex | The same provenance check. `load_annotation` also requires the annotation's names, annotation values and vertex counts to equal the published regions' |
| `manifest.json` | Region identities | `source_region_index` requires ids `<atlas>:<hemisphere>:<label>`, kind `cortex` or `non-region` and unique labels |

## Method

### Pairs

`atlas_comparison.atlases` lists `destrieux`, `hcp-mmp`, `julich` and `schaefer`. `export_comparisons` takes every unordered pair (`itertools.combinations`), six in all. `comparison_atlases` refuses an anatomy not in `enabled_anatomies` (`[cdmd]`), a pair that is not two distinct configured atlases, and an atlas with no published surface.

### Joint vertex cells

`compare_surface` (`brain_model/layers/comparison.py`) took the pial vertices in float64 and an $(n_\text{vertices}, 2)$ array of the two atlases' labels, and measured the joint cells in three steps.

1. Each triangle's area was computed as $A_t = \tfrac12 \lVert (v_1 - v_0) \times (v_2 - v_0) \rVert$. A non-finite or zero area stops the build.
2. Each vertex received the area $a_i = \sum_{t \ni i} A_t / 3$, the barycentric cell that [cortical atlases](cortical-atlases.md#method) assigns to each vertex's label.
3. For each label pair $(p, q)$, the vertex areas were summed to $S_{pq} = \sum_{i:\,(\ell^A_i, \ell^B_i) = (p,q)} a_i$, in mm².

Non-region labels (medial walls, Julich-Brain gap maps and medial masks) were kept, so each hemisphere's $S_{pq}$ sum to its whole pial area. The share shown for region $p$ is $S_{pq} / \sum_{q'} S_{pq'}$. The denominator is $p$'s full pial area, unassigned cells included, and nothing is renormalised. The two directions therefore differ. The cell shared by the left precentral gyrus (Fig. 1a) and area 4 (Fig. 1b) measures 447.8 mm², which is 20.6% of the gyrus and 31.6% of area 4.

### Intersection meshes and files

`partition_surface` ran on the joint label code, so each joint cell became one mesh on the original tessellation. A triangle whose vertices carry different joint labels was split at its edge midpoints and its centroid, the boundaries of the vertex cells. `export_hemisphere` added a mesh `overlap:<hemisphere>:<labelA>:<labelB>` for every pair with positive area. `export_comparison` wrote the geometry file `atlas-overlaps[-<a>-<b>].glb` and the sidecar `atlas-comparison[-<a>-<b>].json`. The suffix is empty for `destrieux`–`hcp-mmp`. The sidecar records `schema_version: 1`, `surface: "pial"`, `method: "barycentric-vertex-cells"`, `units: "mm2"`, per-region `totals`, the pairs, and the SHA-256 checksum of every source, atlas asset and geometry file. `attach_comparisons` declares all six in `manifest["atlas_comparisons"]`. The number of joint cells with positive area differs from pair to pair.

| Pair (CDMD) | Joint cells with area |
| :--- | ---: |
| Destrieux × HCP-MMP | 1,202 |
| Destrieux × Julich-Brain | 1,056 |
| Destrieux × Schaefer | 1,221 |
| HCP-MMP × Julich-Brain | 1,537 |
| HCP-MMP × Schaefer | 1,767 |
| Julich-Brain × Schaefer | 1,556 |

## Display

The region detail of a cortical region opens **Overlap with** *atlas* (Fig. 1c), and **Compare with** chooses the partner. A Desikan-Killiany region has no such section, because no configured pair includes that atlas. Each pair's sidecar loads the first time the pair is shown. Its geometry file loads the first time a row is activated. `catalog.ts` validates the sidecar against the manifest (schema, anatomy, atlas order, surface, method, units, checksums, totals, unique mesh ids) and builds rows of area and share, with non-region area summed as **Unassigned**. The first 4 rows are listed and the rest sit under a disclosure.

Activating a row outlines its mesh (Fig. 1d). `overlay.ts` keeps every overlap mesh hidden as a mask (`colorWrite: false`, `depthWrite: false`), and the outline pass draws the active one. A section through the model hides the outline. **Download CSV** exports every row at full precision as a comma-separated values (CSV) file, `<anatomy>-<region id>-<partner>-atlas-comparison.csv`, with the colons of the region id written as hyphens.

## Borders overlay

A second view of the same cells: while one cortical atlas is shown in its colours, another atlas's region borders can be drawn over it as lines, and the pointer names the region in both atlases. Every ordered pair of the five atlases is published, Desikan-Killiany included, for `cdmd` and `mni152`, whose cortex files come from the same build.

### Method

`atlas_borders` (`brain_model/layers/atlas_borders.py`) gives each atlas's areas a border class from 1 to 4 per hemisphere so that no two areas sharing a pial edge take the same class. `four_classes` classes the areas in reverse smallest-last order and, where an area meets all four classes, swaps two classes along a Kempe chain that reaches none of its other neighbours; a map it cannot class stops the build. Every area of all 20 hemisphere maps was classed (all planar; the right HCP-MMP map defeated an earlier backtracking search). Non-region labels (medial walls, Julich-Brain gap maps and medial masks) share class 0, so no border lies between two of them, and a border between an area and one of them is drawn.

Each vertex of a shown atlas's cortex file carries two bytes. The first holds classes: bit 0 for class 0 and bits 1 to 4 for classes 1 to 4, set for the classes of the source pial vertices the vertex is made from. A source vertex has its own class. A vertex `partition_surface` adds at a source edge's midpoint or a source triangle's centre has those of the edge's ends or the triangle's corners (`partition_vertex_field` on one indicator per class). The second is the other atlas's label plus one, so the annotation's -1 is 0: a source vertex's own, an added vertex's the majority of its corners' (`partition_vertex_labels`). A byte holds it because no hemisphere of any atlas has more than 201 labels (Schaefer, non-region included; HCP-MMP 181, Julich-Brain 148, Destrieux 75, Desikan-Killiany 35), and `label_bytes` stops the build for a label past 254. The classes could not be derived from the labels in the viewer, as the named visual areas' are: an added vertex needs every class of the vertices it is made from, which one label does not carry. Each plane is written in the published regions' order, each region's vertices in its mesh's order, as cortical thickness is. One file per ordered pair, `borders-<shown>-<other>.field`, holds the classes and then the labels: 593,608 to 895,740 bytes per file on CDMD (15,681,744 bytes, 3,098,414 gzipped, for the 20 files) and 674,334 to 1,014,414 on the MNI template (17,827,616 bytes; 3,378,392 gzipped). `manifest["atlas_borders"]` lists each file with its vertex count.

The viewer gives each class set at a vertex an equal share and interpolates the four class shares across each triangle. It draws the line where the two largest shares meet, a fixed number of pixels either side: their gap over the sum of the two shares' screen-space slopes. The line therefore crosses every source edge at its midpoint, where the comparison's vertex cells meet. Inside a source triangle the shown atlas splits, the added midpoints and centre carry the cells' boundary, so the line follows it exactly. Inside one the shown atlas leaves whole and whose corners hold two classes, two against one, the line runs straight between the two edge midpoints, while the cells meet at the centre. It is then a sixth of the lone corner's altitude from the cells' boundary at most: 0.13 mm at the median and 0.29 mm at the 99th percentile for Destrieux with HCP-MMP's borders on CDMD, 0.77 mm at most over every pair on CDMD (`largest_chord_offset_mm`) and 0.90 mm on the MNI template.

A point is named by the same shares: the class with the largest share of its triangle's corners there, and the label of the nearest corner that holds that class alone. Every triangle has such a corner for the class that wins inside it, a source corner, so the name changes exactly where the line is drawn.

### Display

Each atlas's row in the masthead's **Atlas** list, the shown one aside, has a **Borders** toggle that draws its borders over the shown atlas; one other atlas at a time. The shown atlas's bytes for it download on its first showing. A change of atlas brings them for the new atlas, and showing the atlas whose borders are drawn drops them. The stage key names the atlas (**HCP-MMP borders**, **Limites de HCP-MMP**) over a swatch of the line, and Save image draws that key. A link carries `borders=<atlas>`. A link naming the shown atlas, an atlas with no file for the shown one, or an unknown atlas is not applied, and the notice says so.

While borders are drawn, the chip under the pointer names the point in both atlases, each with its own names: "Destrieux: Precentral gyrus · HCP-MMP: 4 · Left" (French "Destrieux : Gyrus précentral · HCP-MMP : 4 · Gauche"). Over the other atlas's medial wall or a Julich-Brain gap map it says "Unlabelled" for that atlas, as every unlabelled point is called. A click still selects the shown atlas's region only.

The line is a light core in a dark casing, lit as a white surface would be, so it reads on light and dark atlas colours alike. It is drawn after everything else the cortex shows: every colouring, a tab's paint, the T1 scan, the reader's maps and the visual field and body maps. A cut face draws none. A Focus ghost draws none either, and opacity, a hidden hemisphere or cortex and the exploded view act on the lines as on the cortex under them. The cortex reads the classes through a texture by vertex index, so it gains no vertex attribute: it still links with 13 of WebGL 2's 16, with 9 texture units in use. The cortical materials take the line's shader on the first showing, with its code; a reader who never draws borders keeps the cortex program as it was.

### Checks

| Test | Criterion | Result |
| :--- | :--- | :--- |
| `test_no_two_areas_that_meet_share_a_class_and_every_non_region_is_class_zero` | Every pial edge between two areas joins two classes, for each atlas and hemisphere | passes |
| `test_a_vertex_the_shown_atlas_adds_carries_the_classes_of_the_corners_it_is_made_from` | A split triangle's midpoints and centre carry their corners' classes | passes |
| `test_the_drawn_and_named_hcp_mmp_regions_on_destrieux_are_the_comparison_cells_but_for_the_chord` | Each Destrieux region's area in each HCP-MMP region, drawn and named from the published bytes as the viewer reads them, equals the comparison's cells moved by $A_t / 12$ for each two-against-one triangle Destrieux leaves whole | 1,202 cells; largest difference $1.6 \times 10^{-11}$ mm²; 1.17 mm² without the chord |
| `test_each_vertex_names_the_other_atlas_by_its_label_plus_one_and_a_label_past_a_byte_stops_the_build` | Labels -1 to 254 fit a byte; 255 and -2 stop the build | passes |
| `test_the_published_borders_are_the_pinned_files_and_one_changed_byte_is_refused` | `validate` rebuilds every file byte for byte, on the cortex files' vertex order (`check_order`) | passes; one flipped bit refused |
| `web/src/lib/engine/render/atlas-borders.svelte.test.ts` | Real WebGL: the line is centred midway between two vertices of different classes, lighter and darker than the fill, as many pixels wide at twice the zoom; none between two non-regions, none while off or unloaded. The name changes between the two pixels either side of the line's centre, through a vertex holding both classes too, and past an area's border onto a non-region names the non-region | passes |

### Limits

The lines inherit every limit of the atlases they outline: HCP-MMP, Julich-Brain and Schaefer borders are projections onto this brain ([limitations](cortical-atlases.md#limitations)). Two atlases rarely share a border edge for edge: 5% to 13% of one atlas's border edges on CDMD are also another's, so borders that follow the same sulcus usually run beside each other rather than on top. Four classes are enough to tell areas apart, not to name them: the line says that an area ends, and the region detail says which.

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

The marginal test recomputes the default pair, Destrieux and HCP-MMP, from the subject's source files. Its bound is the area error that rounding the published vertices to float32 can cause, summed over each region's triangles, plus $10^{-10}$ of the region's area. The largest difference can be read from the published files: it is the largest gap between a region's `totals` entry in `atlas-comparison.json` and its `surface_area_mm2` in `manifest.json`. No other sidecar exceeds it.

The front end is checked by `web/src/lib/core/comparison/catalog.test.ts`, `web/src/lib/core/assets/comparison-assets.test.ts` and `web/src/features/inspector/AtlasComparison.svelte.test.ts`.

## Limitations

Overlap is spatial, not functional equivalence. For example, Julich-Brain receptor fingerprints are not carried to overlapping HCP-MMP areas.

Shares depend on direction and include unassigned cortex. On CDMD, 34 of the 148 Destrieux regions lie mostly in Julich-Brain's unassigned cortex.

HCP-MMP, Julich-Brain and Schaefer boundaries are projections onto this brain ([limitations](cortical-atlases.md#limitations)).

The comparison is computed for `cdmd` only.

The checks are numerical. They do not show that projected boundaries are biologically exact.

## Code availability

Code
: [`brain_model/layers/comparison.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/comparison.py), [`brain_model/layers/atlas_borders.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/atlas_borders.py), [`brain_model/surfaces/geometry.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/surfaces/geometry.py), [`web/src/lib/core/comparison/catalog.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/comparison/catalog.ts), [`web/src/lib/engine/comparison/overlay.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/engine/comparison/overlay.ts), [`web/src/lib/engine/render/materials.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/engine/render/materials.ts)

Configuration
: [`config/model.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/model.yaml), `atlas_comparison`, and `atlas_borders` among each anatomy's `layers`

Tests
: [`tests/test_comparison.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_comparison.py), [`tests/test_atlas_borders.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_atlas_borders.py)

```bash
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.layers.comparison --anatomy cdmd
uv run python -m brain_model.build --anatomy cdmd --only atlas_borders
uv run pytest tests/test_comparison.py tests/test_atlas_borders.py
```

