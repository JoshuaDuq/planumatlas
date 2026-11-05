# Visual field map

Move a dot across the visual field and the stage lights the cortex predicted to represent it; the prediction is the Benson template (v4.0), fitted to the group average of 181 Human Connectome Project 7T participants and carried onto this brain's folding.

:::{list-table}
:widths: 22 78
:stub-columns: 1

* - Where in the viewer
  - **Circuits › Maps** (below the guided tours); opened also from the V1 landmark of the Visual pathway tour ([circuits](circuits.md)); shared as `map=visual-field&dot=x,y,radius`.
* - Built by
  - [`brain_model/layers/retinotopy.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/retinotopy.py), [`scripts/fetch_retinotopy.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/fetch_retinotopy.py); the viewer in [`web/src/features/circuits/VisualFieldMap.svelte`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/features/circuits/VisualFieldMap.svelte)
* - Configuration
  - [`config/retinotopy.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/retinotopy.yaml); `retinotopy` in the layers list of [`config/model.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/model.yaml)
* - Source data
  - Benson template v4.0 from [neuropythy](https://github.com/noahbenson/neuropythy) at commit `a3d240f` (AGPL-3.0), published on `fsaverage`; HCP 7T retinotopy dataset (Benson et al. 2018, PMID 30593068); method of Benson et al. 2014 (PMID 24676149)
* - Checked by
  - [`tests/test_retinotopy.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_retinotopy.py), `brain_model.validate` (re-derives the projection), `web/src/lib/core/learning/visual-field.test.ts`
:::

## What it does

```{figure} ../../.github/assets/readme/visual-field.webp
:alt: The visual field map in the Circuits tab: a dot 4.5 degrees from fixation in the upper right of the visual field disc, its predicted V1, V2 and V3 territory in square millimetres, and the left occipital cortex lit on the brain, seen from the midline

A dot 4.5° from fixation, upper right, radius 1.5°. The panel gives the cortex predicted to represent it; the stage, seen from the midline with the right hemisphere and internal anatomy hidden, lights the same patch of the left occipital cortex.
```

Move a dot across the visual field and the stage lights the cortex predicted to represent it. Click V1, V2 or V3 on the brain and the panel reads back which part of the field that point is predicted to respond to.

- **The disc** is the visual field with fixation at the centre and eccentricity on a log scale, with rings at 1°, 2°, 4°, 16° and 32° and the edge at 90°. Drag the dot, or focus it and use the arrow keys; <kbd>Shift</kbd> steps further. The dashed ring marks 8°, where the template's data end; beyond it the template extrapolates, the disc shades that annulus, and a note appears whenever the dot reaches into it. **Dot radius** runs from 0.1° to 10°.
- **Hemisphere.** A dot off the vertical meridian is represented in the opposite hemisphere, shown from the midline; a dot on it reaches both.
- **Predicted territory** is the area in mm² of V1, V2 and V3 whose predicted receptive-field centre lies inside the dot, measured on the midthickness surface, per hemisphere. If no vertex qualifies, make the dot larger. The stage draws the same dot: the core where a centre lies inside it, a dimmer reach where the receptive field comes within one σ of it, and V1, V2 and V3 in three greys.
- **Clicked cortex** gives the predicted field position and receptive-field size at a point you click, or says the point lies outside V1–V3, where the template predicts nothing.
- **Sharing.** The view travels as `map=visual-field&dot=x,y,radius`, in degrees from fixation, x to the right and y up.

The map is a prediction, not a measurement. No retinotopy was measured in this individual, and V1's size varies about threefold between people. The map names the Visual pathway tour it belongs to and opens it. Sources: [Benson et al. (2018)](https://doi.org/10.1167/18.13.23) for the data and [Benson et al. (2014)](https://doi.org/10.1371/journal.pcbi.1003538) for the method.

## Data

The template is eight files from neuropythy's `neuropythy/lib/data/fsaverage/surf`, pinned by SHA-256 in `config/retinotopy.yaml`: for each hemisphere `?h.benson14_angle.v4_0.mgz`, `_eccen`, `_sigma` and `_varea` (polar angle, eccentricity, pRF size and visual area, one value per `fsaverage` vertex). `scripts/fetch_retinotopy.py` downloads them from the pinned commit into `data/fsaverage/surf/`, checks each checksum and, with `--record`, registers them in `data/sources.json` with the neuropythy licence (AGPL-3.0, which covers the files it distributes).

| Setting | Value |
| :--- | :--- |
| Areas published | V1, V2 and V3 (template `varea` codes 1, 2, 3); the template predicts nine more areas, left out as less certain |
| Measured eccentricity | 8°: the HCP stimulus reached 8° |
| Template extent | 90°; beyond 8° the template extrapolates |

The template was fitted to the group average of 181 HCP 7T retinotopy participants; the anatomical prediction method is Benson et al. (2014), which corrects distortion in flattened representations of the cortical surface so that V1–V3 organisation can be predicted from anatomy.

## How it was built

`brain_model.layers.retinotopy` runs during the build for any anatomy that declares the `retinotopy` layer (CDMD).

### 1. Carry the template onto this brain

`project(config, definition, prefix)` for each hemisphere:

1. Reads `fsaverage`'s registered sphere (`sphere.reg` from the HCP source directory) and this brain's `sphere.reg`, and the four template maps.
2. Converts the template's polar angle and eccentricity to Cartesian visual-field position, $x = \pm e \sin\theta$ and $y = e \cos\theta$, with the sign $+1$ for the left hemisphere (it represents the right half-field) and $-1$ for the right. Interpolating as $x, y$ means the polar angle never wraps. pRF size (`sigma`) is carried alongside.
3. Takes the three nearest template vertices of each target vertex on the unit sphere (`cKDTree`), finds the template triangle the target direction crosses by searching the triangles around those vertices (`crossed_triangles`; the triangle the direction lies most inside, barycentric weights clipped at zero; a direction outside all of them is an error), and interpolates linearly within it. A search of incident triangles replaces ray casting because Embree rays miss exact vertex hits.
4. Weights only the corners that lie in V1–V3: a corner outside would average in zero, or a neighbouring area's larger pRF.
5. Takes the visual-area code from the nearest template vertex. A vertex in V1–V3 with no mapped corner is an error.

As neuropythy does, the area code is nearest-vertex and the position linearly interpolated.

### 2. Check the field signs

`check_field_signs` refuses a projection that does not show the known organisation: at least 99% of V1 vertices must lie in the opposite half-field of their hemisphere, and dorsal V1 (vertices above the median height of V1's white surface) must map the lower field while ventral V1 maps the upper field.

### 3. Put it on the atlas partition

`brain_model.build.retinotopy_fields` places the projected position, pRF size and area on every cortical region's vertices for each cortical atlas. A vertex the partition adds between V1–V3 and the rest of the cortex averages only its V1–V3 corners, since the others carry no position and averaging their zeros in would pull it towards fixation; the viewer weights each vertex the same way. The fields are written to the cortex `.glb` files as vertex attributes `_FIELD_X`, `_FIELD_Y`, `_PRF_SIGMA` (quantised to 16 bits over the ranges recorded in the manifest's `appearance.field_ranges`: x −87.6 to 89.3°, y −88.5 to 87.8°, σ 0 to 23.8°) and `_VISUAL_AREA` (8 bits). About 2.7 MB is added to each cortex file.

### 4. The territory sidecar

`summarize` writes `retinotopy.json` (about 1.05 MB): for each hemisphere, only the vertices in V1–V3, with their position `x`, `y` (rounded to three decimals), `area` and `mm2`. `mm2` is each vertex's share of area on the midthickness surface, the mean of the white and pial positions, with a third of each incident triangle's area per vertex so that the vertex areas sum to the surface's. The viewer sums these to give territories without rereading the surfaces.

### 5. Record the measurements

The manifest's `retinotopy` section records, per hemisphere, the area of V1, V2 and V3 in mm², the share of the predicted area lying beyond 8° (`extrapolated_share`), and the area-weighted Dice of each predicted area with the parcels named for it in HCP-MMP (`V1`, `V2`, `V3` ROIs) and Julich-Brain 3.1 (hOc1 for V1, hOc2 for V2, hOc3v and hOc3d for V3).

## How the viewer uses it

- **State.** The map is a lesson-like state, `lesson.map = 'visual-field'`, held with the dot (`lesson.dot`), so the link carries it: `web/src/lib/state/visual-field-map.svelte.ts` (`START_DOT` = 2°, 2°, radius 1°), `web/src/features/circuits/visual-field-explorer.svelte.ts`. The link's dot is $x,y,r$ in degrees to a hundredth, within the field's 90° and a radius from 0.01° to 90° (a clicked receptive field can set a radius outside the size control's range). Opening the map from a link holds no earlier scene to return to.
- **Scene.** `showMapSide` (`web/src/lib/controller/lesson.ts`) shows one hemisphere alone, seen from the midline where V1 lies, uncut and opaque, with nothing selected and the internal anatomy hidden, framed on V1 and the V2 and V3 around it with a 30 mm margin (`MAP_CONTEXT_MM`). The region framed is `visualFieldRegion`: the current atlas's region of that hemisphere that holds the most predicted V1 vertices within the measured 8° (near the occipital pole), where the map is measured rather than extrapolated.
- **Disc.** `web/src/lib/core/learning/visual-field.ts`: the radial scale is logarithmic, $r = \ln(1 + e/0.25) / \ln(1 + e_{max}/0.25)$ with $e_{max}$ = 90°, as cortical magnification roughly is, which puts the measured 8° near three fifths of the radius. `hemisphereFor` decides the hemisphere (left for $x > 0$, null on the meridian), `polar` and `quadrant` describe a point. Dot radius is a logarithmic slider from 0.1° to 10°; arrow keys step 0.02 of the disc's unit radius and Shift 0.08, so a press moves finely near fixation and coarsely in the periphery.
- **Territory.** `territoryOf` sums `mm2` over the vertices whose predicted centre lies within the dot's radius, per hemisphere and area.
- **Shader.** `web/src/lib/engine/render/materials.ts` decodes the vertex attributes (`fieldDecode`) and, when `visualMix` is on, paints each vertex that is at least half in V1–V3 in a grey for its area (V1 0.6, V2 0.27, V3 0.11 linear), darkens it beyond the measured eccentricity (×0.65), draws the 8° line (0.85, blended at 0.7) and the dot: the core where the pRF centre lies inside the dot's radius, and a fainter reach (0.45) where the centre lies within the dot radius plus σ. Cortex outside V1–V3 is drawn almost black (0.045).
- **Reading the cortex.** `visualFieldAt` reads the template where a ray meets a cortical mesh, interpolating only the triangle's V1–V3 corners with barycentric weights; a point less than half in V1–V3 has no reading. Clicking makes the clicked receptive field the dot.

## Checks

| Check | Where | Measured on CDMD |
| :--- | :--- | :--- |
| The template names only the eight pinned files, V1–V3 codes, and a measured span inside the template's | `read_definition`, `test_retinotopy.py` | pass |
| Projecting `fsaverage` onto itself returns the template at each vertex | `test_retinotopy.py` | pass |
| A hemisphere mapping its own half-field, or upside-down V1, is refused | `check_field_signs`, tests | pass |
| Vertex areas sum to the surface area | `test_retinotopy.py` | pass |
| The sidecar holds exactly the published areas' territory | `test_retinotopy.py` | pass |
| The published sidecar and record equal this brain's projection; the quantised vertex attributes match it | `retinotopy.validate`, `brain_model.validate` | field error about 0.0013° |
| Visual area carried on every cortex region equals the projection | `brain_model.validate` | pass |
| Agreement of the predicted V1 with HCP-MMP V1 (area-weighted Dice) | manifest `retinotopy` | left 0.90, right 0.89 |
| Agreement of the predicted V1 with Julich-Brain's hOc1 | manifest | left 0.68, right 0.72 |
| V2 with HCP-MMP / Julich-Brain | manifest | left 0.76 / 0.56, right 0.78 / 0.54 |
| V3 with HCP-MMP / Julich-Brain | manifest | left 0.78 / 0.57, right 0.72 / 0.46 |

Area on the midthickness surface: left V1 2,235 mm², V2 2,230 mm², V3 1,745 mm²; right V1 2,570 mm², V2 2,389 mm², V3 1,929 mm². The share of predicted V1–V3 area beyond the measured 8° is 40.8% on the left and 44.1% on the right. The HCP-MMP V1 agreement is not independent evidence.

## Limits

- A prediction from this brain's folding by a group template, not a measurement: no retinotopy was scanned in this individual, and V1's size varies about threefold between people (PMID 35853720). Only about a third of V1 is visible on the pial surface, even medially.
- The HCP stimulus reached 8°; about 43% of predicted V1–V3 area lies beyond it and is extrapolated, as is every position and territory shown there. The disc shades that range.
- Only V1, V2 and V3 are published.
- V2 and V3 agree less with the atlases' parcels than V1 does.
- Territories are areas of the midthickness surface whose predicted receptive-field centre lies inside the dot, not the cortex that responds to the dot.
- As of 4 November 2026 the phone layout of the map has not been checked.

## Reproduce

```bash
# Download and verify the eight template files (add --record to register them in data/sources.json)
uv run python scripts/fetch_retinotopy.py

# Build and validate; the retinotopy layer is declared by cdmd
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_retinotopy.py
```

## See also

- [Circuits](circuits.md): the Visual pathway tour whose V1 landmark offers the map.
- [Cortical atlases](cortical-atlases.md): HCP-MMP and Julich-Brain, against which the predicted areas are compared.
- [Published coordinates](published-coordinates.md) and [functions](functions.md): other measures carried onto this brain through registered spheres or templates.
- [References and licensing](../reference/references.md), [Validation and limits](../pipeline/validation.md).
