# Dissection and display

The model is drawn from one set of published meshes under a viewer state: a colour mode, a hemisphere and cortex setting, a set of hidden regions, an isolated region and a Focus ghost. Only the cortical shading is computed at build time: sulcal depth, cortical openness and ribbon T1 are baked into every cortical vertex of the subject's pial surface and drive fold occlusion and tissue colour in the shader. The shading is illustrative; it is not a measured optical or histological property.

```{figure} figures/dissection-and-display-1.webp
:alt: Eight lateral views of the left hemisphere. Top row, the cortex in tissue colour, in T1 grey, in Destrieux region colours, in Yeo 7 network colours. Bottom row, arterial territory colours, the same hemisphere with the central region's parcels hidden to show white matter, the left hippocampal formation isolated, and the hippocampal formation in colour inside a grey see-through brain.
:name: fig-dissection-and-display-1

**Five colour modes and three dissection states on one hemisphere.** **a**–**e**, **Colour** set to Tissue (**a**), T1 MRI (**b**), Regions, Destrieux (**c**), Yeo 7 networks (**d**) and Arterial territories (**e**). **f**, Eight Destrieux parcels of the left central region hidden (precentral, postcentral and middle frontal gyri; central, precentral and postcentral sulci; middle frontal sulcus): the subject's own white surface is exposed. **g**, The left hippocampal formation (teaching set) isolated; the camera frames the region. **h**, The same region with Focus: the rest of the model is a grey ghost at opacity 0.15. Subject CDMD sub_013, left view, Destrieux atlas; **f**–**h** in Regions colour.
```

## Data

| Attribute | Written to | Storage | Meaning |
| :--- | :--- | :--- | :--- |
| `_SULC` | `cortex-<atlas>.glb` | `uint16`, normalised to one range per file | FreeSurfer `lh/rh.sulc`; positive in sulci |
| `_OPENNESS` | `cortex-<atlas>.glb` | `uint16`, normalised | Cosine-weighted share of the sky a pial vertex sees past its own hemisphere |
| `_T1` | `cortex-<atlas>.glb` | `uint16`, normalised | `orig.mgz` at the pial–white midpoint |
| `_NETWORK`, `_TERRITORY` | `cortex-<atlas>.glb` | `uint8` | Yeo 7 network (0 unassigned); arterial territory index |

Sources are the subject's `lh/rh.pial`, `lh/rh.white`, `lh/rh.sulc` and `mri/orig.mgz`. The ranges are recorded per atlas as `field_ranges`; on CDMD, `_SULC` −14.05 to 17.40, `_OPENNESS` $2.6 \times 10^{-5}$ to 1.0 and `_T1` 38.99 to 203.24. The first cortical atlas measures them and the others are encoded to the same span, so one decode serves all four files. Colour tables come from the [cortical atlases](cortical-atlases.md), [functional networks](functional-networks.md) and [arterial territories](arterial-territories.md) layers; nothing is written for the colour modes.

## Method

### Sulcal depth and ribbon T1

`lh/rh.sulc` is read unchanged. `orig.mgz` is sampled trilinearly (`map_coordinates`, order 1, no prefilter) at the midpoint of each corresponding pial and white vertex in tkregister RAS; a midpoint outside the grid fails the build. Both fields, and openness, are carried onto the atlas partition by `partition_vertex_field`, linear on the barycentric partition, so a field is continuous across parcel borders.

### Cortical openness

For each pial vertex with unit normal $\mathbf{n}$ (`cortical_openness`):

1. $N$ = `occlusion.direction_count` = 256 unit directions $\mathbf{d}_k$ on a Fibonacci lattice, so the field is deterministic.
2. Weights $w_k = \max(0, \mathbf{n} \cdot \mathbf{d}_k)$.
3. A ray from 0.01 mm along $\mathbf{n}$ is cast along each $\mathbf{d}_k$ with $w_k > 0$ against the hemisphere's own pial mesh (embreex, batches of 2,000,000 rays). A hit at distance $r_k$ has reach $\min(r_k / R, 1)$ with $R$ = `occlusion.radius_mm` = 10 mm; a miss has reach 1.
4. $O = \sum_k w_k\,\text{reach}_k \big/ \sum_k w_k$: 1 on a bare crown, near 0 deep in a fold.

The mesh must be outward-wound (positive volume) or the build fails.

### Encoding

`encode.py` quantises each field to `uint16` over its range, $x = v/65535\,(h - l) + l$; a value outside a supplied range is refused, not clamped. Positions are `float32`; normals are `int16` normalised under `KHR_mesh_quantization`, declared required so a reader without it fails.

The site serves the model layers with their positions and triangle indices under `EXT_meshopt_compression` (`web/build/meshopt-glb.ts`, at build time; `public/` keeps the files `encode.py` wrote). The encoding is lossless and keeps order: `ATTRIBUTES` for positions and `INDICES`, not `TRIANGLES`, which would rotate each triangle's corners. The decoded buffers are the published bytes, and a layer is about 28% smaller over gzip for a detail level, 7% for a cortical atlas. The atlas comparison geometry is served as published, since the app checks it against the SHA-256 its comparison file records.

### Tissue shading

In the cortical shader (`createAnatomicalMaterial`, `addFoldShading`):

$$\text{depth} = \operatorname{smoothstep}(-0.5, 1.8, \text{sulc}), \quad \text{shut} = 1 - \operatorname{smoothstep}(0.5, 0.95, O), \quad f = \operatorname{mix}(\text{shut}, \text{depth}, 0.25).$$

Direct diffuse light is scaled by $1 - 0.48 f$, indirect diffuse and specular by $1 - 0.78 f$ (`folds`). In Tissue colour only, the diffuse colour is scaled by $1 + 0.28\,(2I - 1)$ with $I = \operatorname{clamp}((T_1 - 85)/(180 - 85), 0, 1)$ (`intensity.surface_strength`); under a published palette the factor is 1. The tissue palette is cortex `#c4a897`, grey `#a68d80`, white `#e5dbc5`, fluid `#67777c`, unlabelled `#c4a897` (roughness 0.62, clearcoat 0.08, ior 1.38). A region takes its `tissue`; otherwise cortex is cortex, a name matching ventricle, vent or CSF is fluid, one matching white, `CC_` or callosum is white, and anything else is grey. Tone mapping is Khronos PBR Neutral.

### Visibility

`visibilityOf(region, settings)` decides whether each region is drawn, testing in order: no registered MRI under T1 colour (`no-mri`); a tissue region below cut resolution, on another cut atlas or with no cut; a structure of another detail level or a surface of another atlas; another internal system; the hemisphere; cortex hidden or at opacity 0; internal anatomy hidden; the medial wall while internal anatomy is shown; the spinal cord hidden; a hidden region (`removed`); and any region but the isolated one (`isolated`). Meshes and the Anatomy tree read the same answer.

### Dissection and exposed white matter

Dissection holds a validated set of hidden region ids, one history entry per hide, show or restore. When hidden cortical parcels of the shown atlas open a hemisphere, and the cortex is shown and not isolated, that hemisphere's native white surface from `tissue-envelopes.glb` is drawn in the tissue white (`exposedWhiteMatter`), so the exposed face is the subject's own grey–white boundary.

### Focus

Focus requires a selection and a published `see_through_opacity` (0.15). A region is ghosted unless it is the selection, one of its `constituent_regions` or a painted region (`ghosted`). A ghost is drawn in the luminance of its tissue colour, $0.2126R + 0.7152G + 0.0722B$, without hue. The cortex ghost takes $\min(0.15, \text{cortex opacity})$; deep ghosts take 0.15. Deep ghosts are sorted after other translucent surfaces, nearest first and writing depth, so each pixel takes one ghost layer; the cortex ghost comes last without depth write (`transparentOrder`). Cut faces are greyed by the same rule ([sections and cuts](sections-and-cuts.md#display)).

## Display

**Colour** chooses Tissue, T1 MRI, Regions, Yeo 7 networks, CAB-NP networks (switches the atlas to HCP-MMP) or Arterial territories (Fig. 1a–e); while a Functions or Deficits paint is shown, **Colour** reads Functions or Deficit. Over T1 MRI a paint is drawn on the scan, which stays wherever nothing is painted: a painted surface takes the scan's light, a painted cut face shows its paint unlit in the key's colours, and painted parcels feather only into each other. T1 MRI shows the [linked MRI](linked-mri.md) scan through the same window, with tone mapping off. A cut face is unlit, the grey of the plane it lies on, so it matches the linked MRI; a pointed-at or selected face is marked with the theme accent (`MRI_MARK`: lift 0.33, tint 1.8) because the scan owns luminance. A surface shows the tissue it bounds: the cortex its `_T1` (`orig.mgz` at the pial/white midpoint), any other surface the scan 1 mm inside itself (`SURFACE_DEPTH_MM`; on the surface itself, trilinear reads mix in the neighbour: 31 of 106 teaching-set structures read more than 10 from their interior median, the lateral ventricles 107 against 48, while 1 mm in all read within 7). Surfaces are lit by the stage's own diffuse light on white, clamped at 1. The stage reaches 1 where a surface faces it squarely (99th percentile 1.00–1.03 over four views), so a surface reads its scan grey there and darker elsewhere, never brighter; specular is left out, and a reader's map over the scan takes the same light. Published colours darker than OKLab lightness 0.45 are drawn lifted linearly into 0.30–0.45 with hue kept (`stageLegible`); exports keep the published value. Parcel borders fade into the neighbour over `FEATHER_RADIUS` = 1.5 mm on the stage only; picking keeps the exact border.

Where a structure crosses the cortex, some samples hold the same depth for both. Opaque surfaces draw in three.js order, except that the cortical atlas comes first, so the structure takes those samples, as its cut face does over the ribbon's, whichever layer finished loading first (`opaqueOrder`).

**Display** holds **Hemisphere**, **Cortex** with its opacity and **Cortex surface**, **Internal anatomy** and **Spinal cord** (keys <kbd>H</kbd>, <kbd>C</kbd>, <kbd>U</kbd>, <kbd>S</kbd>). **Cortex surface** moves the shown atlas's parcels onto the subject's pial, mid-thickness (halfway, vertex by vertex) or white surface from `tissue-envelopes.glb`. It is the same setting as the Overlay's ([overlays](overlays.md)): the pial while a cut is open, back to the pial on **Reset display** or **Start over**, and not written into the link. The eye beside each Anatomy row hides a region or group; **Isolate** (<kbd>I</kbd>) and **Focus** (<kbd>F</kbd>) act on the selection. A selection beneath fully opaque cortex is focused when framed. URL keys: `colors`, `hemi`, `cortex`, `opacity`, `internal`, `cord`, `hidden`, `isolate` and `focus`.

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| Positions (`validate.py`; `test_encode.py`) | Error < $2 \times 10^{-5}$ mm | $5.04 \times 10^{-6}$ mm |
| Normals (`validate.py`; `test_encode.py`) | Component error ≤ half an `int16` step | $1.53 \times 10^{-5}$ (bound $1.54 \times 10^{-5}$) |
| Sulcal depth (`validate.py`) | ≤ half a `uint16` step of the range | $2.40 \times 10^{-4}$ |
| Openness (`validate.py`) | Re-cast field within $10^{-3}$ for at least 99.5% of vertices | maximum error $7.66 \times 10^{-6}$; 0.0% outliers |
| Ribbon T1 (`validate.py`) | ≤ half a `uint16` step | $1.26 \times 10^{-3}$ |
| Shading fields (`test_shading.py`) | Partitioned fields continuous; openness 1 on a bare surface, falling with a nearer fold, unchanged by folds beyond $R$ | passes |
| Encoding (`test_encode.py`) | Shared ranges used; out-of-range values refused; quantised normals require the extension | passes |
| Viewer (`materials.test.ts`, `mri-material.test.ts`, `draw-order.test.ts`, `border-feather.test.ts`, `palette.test.ts`, `white-matter-surfaces.test.ts`, `dissection.test.ts`) | Shader terms, draw order, feathering, exposure and dissection history | passes |

The openness tolerance exists because the field is re-cast in `float32` on the validating machine: where the pial surface touches itself a ray origin can fall on either side of the contact. A vertex jitter of $3 \times 10^{-5}$ mm moved 0.16% of CDMD vertices past the tolerance; a 5% radius error moves 78% and one direction fewer 23% (`validation.openness` in `config/model.yaml`).

## Limitations

- T1 brightness, fold shading and tissue colours are illustrative, not measured albedo.
- The baked fields exist on the cortical meshes only.
- Openness counts occlusion by the vertex's own hemisphere only.
- The MRI and FreeSurfer labels are 1 mm; label boundaries are not anti-aliased.
- A parcel narrower than 3 mm never reaches full colour on the stage.
- Hidden regions do not change the linked MRI planes.

## Code availability

| | |
| :--- | :--- |
| Code | [`brain_model/surfaces/shading.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/surfaces/shading.py), [`brain_model/build.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/build.py) (`build_cortex_layer`), [`brain_model/gltf/encode.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/gltf/encode.py); [`web/src/lib/engine/render/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/lib/engine/render), [`web/src/lib/engine/model/brain-atlas.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/engine/model/brain-atlas.ts), [`web/src/lib/core/catalog/visibility.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/catalog/visibility.ts), [`web/src/lib/core/state/dissection.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/state/dissection.ts) |
| Configuration | [`config/model.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/model.yaml): `appearance` (`tissue`, `intensity`, `folds`, `occlusion`, `lighting`, `see_through_opacity`), `validation.openness` |
| Tests | `tests/test_shading.py`, `tests/test_encode.py`; `web/src/lib/engine/render/*.test.ts`, `web/src/lib/engine/tissues/palette.test.ts`, `web/src/lib/engine/tissues/white-matter-surfaces.test.ts`, `web/src/lib/core/state/dissection.test.ts` |

```bash
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_shading.py tests/test_encode.py
npm test --prefix web -- render tissues dissection
```

Figure state (Fig. 1h): https://planumatlas.com/#anatomy=cdmd&atlas=destrieux&colors=atlas&view=left&region=learning:left:hippocampus&focus=1
