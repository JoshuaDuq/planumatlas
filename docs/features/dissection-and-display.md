# Dissection and display

The Display tool, the colour modes, hide and isolate, Focus, and the baked cortical shading that lets the model read as tissue: each is a viewer state over the same published meshes, and the shading fields are the only part computed at build time.

:::{list-table}
:widths: 22 78
:stub-columns: 1

* - Where in the viewer
  - **Display** in the stage dock (hemisphere, cortex and opacity, internal anatomy, spinal cord); **Colour** in the masthead; the eye beside each row of **Anatomy**, the dissection line at its foot, and **Focus**, **Isolate** and **Hide** in a region's detail
* - Built by
  - [`brain_model/surfaces/shading.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/surfaces/shading.py), [`brain_model/build.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/build.py) (`build_cortex_layer`), [`brain_model/gltf/encode.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/gltf/encode.py), [`brain_model/surfaces/geometry.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/surfaces/geometry.py) (`partition_vertex_field`)
* - Viewer modules
  - [`web/src/lib/engine/render/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/lib/engine/render) (`materials.ts`, `mri-material.ts`, `ghost-order.ts`, `border-feather.ts`, `scene.ts`), [`web/src/lib/engine/model/brain-atlas.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/engine/model/brain-atlas.ts), [`web/src/lib/engine/tissues/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/lib/engine/tissues) (`palette.ts`, `white-matter-surfaces.ts`), [`web/src/lib/core/catalog/visibility.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/catalog/visibility.ts), [`web/src/lib/core/state/dissection.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/state/dissection.ts), [`web/src/features/stage/DisplayPopover.svelte`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/features/stage/DisplayPopover.svelte)
* - Configuration
  - [`config/model.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/model.yaml): `appearance` (`tissue`, `intensity`, `folds`, `occlusion`, `lighting`, `see_through_opacity`), `validation.openness`
* - Source data
  - The subject's `lh/rh.pial`, `lh/rh.white`, `lh/rh.sulc` and `mri/orig.mgz`; the colour tables of the layers listed under Colour modes
* - Checked by
  - `tests/test_shading.py`, `tests/test_encode.py`; `validate.py` shading and encoding checks; `web/src/lib/engine/render/*.test.ts`, `web/src/lib/engine/tissues/palette.test.ts`, `web/src/lib/core/state/dissection.test.ts`
:::

## What it does

**Display** holds four controls: **Hemisphere** (both, left, right), **Cortex** (shown or hidden) with its **opacity** slider, **Internal anatomy** (shown or hidden) and **Spinal cord** (absent where the subject publishes none). The keys are <kbd>H</kbd> (cycle hemisphere), <kbd>C</kbd>, <kbd>U</kbd> and <kbd>S</kbd> (cortex, internal anatomy, spinal cord); the opacity row is removed, not greyed, while the cortex is hidden.

**Colour** in the masthead chooses how the surface is coloured:

| Colour | What the surface shows |
| :--- | :--- |
| Tissue | One tissue palette (cortex, grey, white, fluid), lit with the baked shading and a T1 brightness variation |
| T1 MRI | The subject's own T1 sampled at each point of the surface, through the Linked MRI window |
| Regions | The chosen atlas's published colours (`atlas`) |
| Yeo 7 networks | The seven Yeo networks per vertex |
| CAB-NP networks | CAB-NP's 12 networks per HCP-MMP area (choosing it switches the atlas to HCP-MMP) |
| Blood supply | Arterial territories per vertex (`territory`) |

While the Functions or Deficits tab paints the brain, Colour reads **Functions** or **Deficit**; choosing a colour there replaces the paint. Colour applies to the cut faces too (see [sections and cuts](sections-and-cuts.md#colour)).

**Dissection.** The eye beside a row hides that region or group; **L** and **R** act on each side. Hiding cortex exposes the subject's own white-matter surface. Hidden parts stay searchable, and selecting one reveals it. The line at the foot of Anatomy reads "N parts hidden · Undo · Restore all". Switching subject clears the dissection. **Isolate** shows one region alone.

**Focus** latches the selection in colour and draws the rest as a neutral grey ghost; it is a toggle, it ends when the selection clears, and it follows the next pick. A pick hidden beneath the opaque cortex focuses automatically. It travels in the link as `focus=1`. The same ghost draws the context of a circuit's whole route and of the Tracts tab.

## Data

The shading is carried in the cortical meshes themselves; nothing is written for the colour modes.

| Attribute | Written to | Storage | Meaning |
| :--- | :--- | :--- | :--- |
| `_SULC` | `cortex-<atlas>.glb` | `uint16` normalised, one range per file | FreeSurfer `lh/rh.sulc`, sulcal depth; positive marks sulci |
| `_OPENNESS` | `cortex-<atlas>.glb` | `uint16` normalised | Share of the sky a pial vertex sees past its own hemisphere's folds |
| `_T1` | `cortex-<atlas>.glb` | `uint16` normalised | Trilinear `orig.mgz` at the pial/white midpoint of the vertex |
| `_NETWORK`, `_TERRITORY` | `cortex-<atlas>.glb` | `uint8` | Yeo 1–7 (0 unassigned), arterial territory index |

The manifest records each field's range as `appearance.field_ranges` and describes the three shading fields under `surface_shading`. On CDMD the ranges are `_SULC` −14.05 to 17.40, `_OPENNESS` 2.6e-5 to 1.0 and `_T1` 38.99 to 203.24. One range per file means the same sulcal depth decodes identically on either side of a region boundary (`QUANTIZED_FIELDS` in `encode.py`); the first cortical atlas measures the ranges and the other atlases are held to the same span, so one decode serves them all. A value outside a supplied range is refused, not clamped. Positions are `float32` and normals `int16` normalised with `KHR_mesh_quantization`, listed as required so a reader without the extension fails instead of misreading integers ([architecture](../pipeline/architecture.md)).

## How it was built

The three fields are measured per vertex of each hemisphere's native pial surface in `build_cortex_layer`, then carried onto the atlas partition with `partition_vertex_field` (linear on the barycentric partition, so the field is continuous across region borders and a triangle's value at a cut point is the source's).

### 1. Sulcal depth (`_SULC`)

`read_morph_data` reads `lh.sulc` / `rh.sulc` unchanged.

### 2. Cortical openness (`_OPENNESS`, `shading.cortical_openness`)

A cosine-weighted share of the sky that a vertex sees past its own hemisphere's folds.

1. `sphere_directions` gives `direction_count` = 256 evenly spread unit directions (a Fibonacci lattice, so the field is deterministic).
2. For each vertex, only directions in the outward hemisphere of its normal count: the weight is $\max(0, \mathbf{n} \cdot \mathbf{d})$.
3. Each such ray starts 0.01 mm off the surface along the normal, so it cannot hit its own triangles, and is cast against the hemisphere's pial mesh with embreex (`RayMeshIntersector`, in batches of 2,000,000 rays). A ray that hits at distance $d$ counts as $\min(d / r, 1)$ open, with $r$ = `occlusion.radius_mm` = 10 mm; a ray that hits nothing counts as fully open.
4. The vertex's openness is the weighted sum of reach over the weights: 1 is a bare crown, and near walls occlude fully while folds beyond 10 mm do not at all.

The mesh must be outward-wound (positive volume) or the build fails. About 5 s a hemisphere. Because it is baked, the viewer pays no per-frame cost. It replaced a per-vertex concavity term that darkened every 1 mm dent and smudged the crowns.

### 3. Ribbon T1 (`_T1`, `shading.ribbon_intensity`)

`orig.mgz` is sampled trilinearly (`map_coordinates`, order 1, no prefilter) at the midpoint of corresponding pial and white vertices, in tkregister RAS. A midpoint outside the MRI grid, or a non-finite volume, fails. The value is illustrative brightness, not measured optical albedo.

### 4. Encoding

`encode.py` rewrites the fields as `uint16` against the shared per-file ranges ($\text{decoded} = v/65535 \cdot (\text{high} - \text{low}) + \text{low}$), with a tolerance of half a step plus a `float32` step, $(\text{high} - \text{low}) / (2 \times 65535)$.

## How the viewer uses it

### Tissue colour and shading (`render/materials.ts`)

The cortical material (`createAnatomicalMaterial`, `addFoldShading`) decodes the three fields in the vertex shader and then:

1. **Colour variation.** The diffuse colour is multiplied by $1 + s\,(2I - 1)$ with $I = \operatorname{clamp}((T_1 - 85)/(180 - 85),\,0,\,1)$ and $s$ = `intensity.surface_strength` = 0.28. This applies in Tissue colour only (and not to a ghost or a painted region); under a published palette the strength is set to 0, so the modulation never distorts the datum.
2. **Fold occlusion.** $\text{depth} = \operatorname{smoothstep}(-0.5, 1.8, \text{sulc})$, $\text{shut} = 1 - \operatorname{smoothstep}(0.5, 0.95, \text{openness})$ and $\text{fold} = \operatorname{mix}(\text{shut}, \text{depth}, 0.25)$, that is three parts openness to one part sulcal depth (`folds.low`, `high`, `openness_low`, `openness_high`). A linear mapping made the sulci shallower than the old concavity version. Direct diffuse light is scaled by $1 - 0.48\,\text{fold}$ and indirect diffuse and indirect specular by $1 - 0.78\,\text{fold}$ (`direct_strength`, `indirect_strength`).
3. **Network and territory mixes.** `networkMix` and `territoryMix` are 0 or 1; the fourth colour channel is zero off the networked surface, so the medial wall keeps its region colour.

The tissue palette (`appearance.tissue`) is `cortex #c4a897`, `gray #a68d80`, `white #e5dbc5`, `fluid #67777c`, `unlabelled #c4a897`, with roughness 0.62, clearcoat 0.08 (0 on a phone), clearcoat roughness 0.45, ior 1.38 and specular intensity 0.55. `tissueColor` takes a region's `tissue`, else `non-region` is unlabelled, `cortex` is cortex, a name matching ventricle, vent or CSF is fluid, a name matching white, `CC_` or callosum is white, and anything else grey. Display colours describe tissue classes, never a measured albedo. Lights are `environment` 0.3, `hemisphere` 0.28, `key` 1.8, `fill` 0.5 and `rim` 0.7; tone mapping is Khronos PBR Neutral, so a surface lit squarely shows its published colour where ACES shifted hues.

### Published colours on a dark stage (`stageLegible`)

Published atlas colours darker than OKLab lightness 0.45 are lifted linearly into the band 0.30 to 0.45 (`STAGE_LIGHTNESS = { floor: 0.3, knee: 0.45 }`), keeping order, hue and chroma; chroma gives way, never hue or the lifted lightness, if the lift leaves the gamut (a 16-step bisection). Lighter colours are untouched. The published value stays in the data and exports; only the stage draws the lifted one.

### T1 MRI colour (`render/mri-material.ts`)

`addMriAppearance` replaces the material's light: the T1 texture (the same `R8` volume Linked MRI uses; [Linked MRI](linked-mri.md)) is sampled at the fragment's world position, mapped through the window $(\text{signal} - c + w/2)/w$ clamped to 0 to 1, and decoded so the composer's sRGB output returns the same display byte the Linked MRI canvas writes. The floor stays at zero, so grey is proportional to T1 signal. Tone mapping is switched off in this mode (`setMriAppearance`). A selected or pointed-at face is marked with the theme accent rather than lifted toward white, because the scan owns luminance: the accent normalised to unit luma is mixed in at `tint` 1.8 and the brightness lifted by 0.33 (`MRI_MARK`), enough to survive greyscale and a colour-blind reader without a marked cortex passing for white matter. A region flagged `mri_registered: false` is hidden in this mode (`visibilityOf`, reason `no-mri`).

### Region borders (`render/border-feather.ts`)

A parcel border cut through triangle midpoints and centres zig-zags at the roughly 0.8 mm vertex spacing. Each parcel fades into the neighbour across the nearest shared vertex over `FEATHER_RADIUS` = 1.5 mm (50/50 on the border, linear to 0 at 1.5 mm along the surface); neighbour colours come from a per-layer palette texture rewritten on every update, with alpha 0 when hidden, so it follows every colour mode and leaves no fringe. A parcel narrower than twice the radius never reaches full colour. Picking and labels keep the exact border. About 60 to 80 ms per atlas load.

### Visibility (`core/catalog/visibility.ts`)

`visibilityOf(region, settings)` is the single answer to whether a region is drawn, and why not (a `HiddenReason` such as `other-atlas`, `other-detail`, `hemisphere`, `cortex-hidden`, `internal-hidden`, `removed` or `isolated`); the model applies it to meshes and the Anatomy tree uses the reason to explain an absence. Cortical patches and the medial surfaces live in a per-atlas layer; structures in a detail level, of which exactly one is drawn; a tissue region has no mesh and is drawn only where a cut samples its label volume. Gyral white matter follows the cortex controls. The medial wall closes the surface across the corpus callosum, ventricles and thalamus, so it is hidden while internal anatomy is shown; a Julich-Brain gap map is not treated as medial wall.

Entering internal anatomy hides the cortex, forces region colouring and switches the detail level; leaving gives those back (`core/state/internal-mode.ts`).

### Dissection (`core/state/dissection.ts`, `tissues/white-matter-surfaces.ts`)

Dissection keeps a validated set of hidden region ids with one history entry per action (hide, show, restore, undo). Hidden ids travel in the link as `hidden=`. When hidden cortical parcels of the shown atlas lay a hemisphere open, `exposedWhiteMatter` makes that hemisphere's native white surface (from `tissue-envelopes.glb`) visible, in the tissue white, so the exposed surface is the subject's own grey/white boundary; it follows the cortex opacity, the cut's clipping planes and the ghost. Isolating a region sets `isolatedRegion`: nothing else is visible, except that an isolated white-matter parcel keeps its hemisphere's white envelope up.

### Focus (`model/brain-atlas.ts`, `render/ghost-order.ts`)

`setFocused` requires a selection and a published `see_through_opacity` (0.15 in `config/model.yaml`: at 0.3 the painted amygdala of Fear was still veiled; it is near the 0.16 the Tracts overlay uses). `ghosted(regionId, state)` is false for the selection, its `constituent_regions` and any painted region; everything else is greyed by `ghostColor`: its tissue colour's luminance, $0.2126R + 0.7152G + 0.0722B$, with no hue, because a tissue-palette ghost would tint the selection seen through it and change the colour being read. The cortex ghost takes `min(see_through_opacity, cortex opacity)` under Focus; deep ghosts take the see-through opacity; what a ghost holds in colour is opaque. A route's or Tracts' grey cortex keeps the reader's opacity.

All-blending ghosts piled into a fog: 254 teaching-set and 440 NextBrain meshes. `transparentOrder` (installed with `renderer.setTransparentSort`) draws a deep ghost after every other translucent surface, nearest first and writing depth, so each pixel takes one layer; the cortex ghost comes last without depth write, so deep context still shows. Cut faces grey the same way (`PaletteState` carries `selectedRegion`), and the three repaint keys (sections visibility, palette, solid paint) include `focusedRegion`.

### Presentation costs

The stage keeps two pre-allocated render pipelines. A moving camera renders through the reduced one (`motionPixelRatio` of at most 1, within a 2,000,000-pixel budget, `motionRatio`), and about 150 ms after rest the frame is redrawn at full resolution, so still images are unchanged. The still pixel ratio is capped at 2 (1.5 on tablets and integrated GPUs, 1 on phones) and MSAA is 4 samples, 2 where fill-bound. The anatomy itself is never decimated. Selection is drawn by an outline pass over the render (a halo, edge thickness 3, and a core, thickness 1; edge strength 6), so no material is tinted and a region's atlas colour, the datum, is never altered.

## Checks

`validate.py` reads each cortical file back and compares it with its source:

| Check | Bound | CDMD |
| :--- | :--- | ---: |
| Position error (mm) | < 2e-5 | 5.04e-6 |
| Normal component error | ≤ 1.54e-5 | 1.53e-5 |
| Sulcal depth error (source units) | ≤ half a `uint16` step of the range | 2.40e-4 |
| Openness: maximum error | tolerance 1e-3 | 7.66e-6 |
| Openness: outlier share | at most 0.5% outside the tolerance | 0.0 |
| Ribbon T1 error (intensity units) | ≤ half a `uint16` step | 1.26e-3 |

The openness field is bit-repeatable on one machine but chaotic where the pial surface touches itself, because a ray origin can land on either side of the contact: jittering vertices by $10^{-5}$ mm flipped one to two per hemisphere by up to 0.9. CI validates on Linux x86, so an exact half-step check would fail there; `validation.openness` therefore allows a tolerance of $10^{-3}$ with at most 0.5% of vertices outside it. The jitter used 0.16% of that allowance, while a 5% radius error moves 78% of vertices and one fewer direction 23%. Embreex does not expose Embree's robust (watertight) flag.

Viewer behaviour is covered by `render/materials.test.ts`, `mri-material.test.ts`, `ghost-order.test.ts`, `border-feather.test.ts`, `tissues/palette.test.ts`, `tissues/white-matter-surfaces.test.ts` and `core/state/dissection.test.ts`.

## Limits

- **Shading is illustrative.** T1 relief and tissue colours are not measured optical or histological properties; `_T1` is a brightness, not an albedo.
- **Source resolution.** The MRI and FreeSurfer labels are 1 mm; hard edges remain one screen pixel wide at label boundaries, since there is no anti-aliasing across labels.
- **Accuracy over legibility.** The MRI contrast window keeps its floor at 0 so grey stays proportional to signal; trilinear sampling is kept instead of Catmull-Rom or Lanczos, whose kernels overshoot and invent ringing that is not in the scan; neither stretching contrast nor sharpening is applied silently.
- **Single-pass translucency was rejected.** `forceSinglePass` on the translucent double-sided cortex removes about 3 ms a frame of CPU churn but lights back faces differently and changes the picture (mean 12.8/255 over brain pixels, 29% above 16). A front-faces-only Focus cortex ghost would erase the Focus cost but changes the still picture too (mean 10.5/255, 28% above 16).
- **Focus cost** (Retina 2×, measured 2026-11-02 on a claustrum selection): moving-frame scene GPU about 10.6 ms with Focus against 7.6 ms without, nearly all of it the see-through grey cortex (148 meshes, 0.54 M triangles); the cortex ghost's back faces alone are about 4 ms.
- Hidden parts do not change the Linked MRI slices, which always show the full scan.
- The baked fold fields (`_SULC`, `_OPENNESS`, `_T1`) are written for the cortical meshes only.

## Reproduce

```bash
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_shading.py tests/test_encode.py
npm test --prefix web -- render tissues
```

Embreex is a build-time dependency of the openness field. After changing `appearance` in `config/model.yaml`, rebuild: the manifest carries the appearance block the viewer reads. The dev server must be restarted after editing a `data/*.yaml` file.

## See also

- [Sections and cuts](sections-and-cuts.md): the same colour rule on cut faces, and the Focus ghost on a cut
- [Linked MRI](linked-mri.md): the scan and window that T1 colour shares
- [Sharing and snapshots](sharing-and-snapshots.md): the link fields `hidden`, `isolate`, `focus`, `hemi`, `cortex`, `opacity`, `internal`, `cord`, `colors`
- [Cortical atlases](cortical-atlases.md), [Functional networks](functional-networks.md), [Arterial territories](arterial-territories.md): the colour tables
- [Architecture](../pipeline/architecture.md), [Validation](../pipeline/validation.md)
