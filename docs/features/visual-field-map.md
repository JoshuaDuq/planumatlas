# Visual field map

A dot placed in the visual field lights the cortex of V1, V2 and V3 predicted to represent it, and the area of that cortex is reported in mm². The prediction is the Benson anatomical template (v4.0), fitted to the group average of 181 Human Connectome Project (HCP) 7T retinotopy participants and carried from `fsaverage` onto CDMD through the registered spheres. It is a prediction from folding, not a measurement: no retinotopy was scanned in this brain. **Name the visual areas** outlines and names the 25 areas of a maximum-probability atlas (Wang et al. 2015), carried onto CDMD the same way; they name the cortex only, and no visual field position is predicted beyond V3.

```{figure} figures/visual-field-map-1.webp
:alt: Two rows. Each shows the visual-field disc with a dot 5 degrees from fixation, its caption and its predicted V1, V2 and V3 territory in square millimetres, beside the occipital lobes of both hemispheres seen from the midline, the right hemisphere on the left of the image and the left on the right, V1 to V3 in greys and the predicted response in red to yellow. Top, upper-right dot, a red-to-yellow patch below the calcarine sulcus of the left hemisphere; 38, 32 and 34 square millimetres. Bottom, lower-left dot, a patch above the calcarine sulcus of the right hemisphere; 85, 37 and 65 square millimetres.
:name: fig-visual-field-map-1

**Each quarter of the visual field is predicted in the opposite hemisphere and the opposite bank of the calcarine sulcus.** **a**, Dot at (4°, 3°), radius 1.5°, upper right: left hemisphere, ventral to the calcarine sulcus; predicted territory V1 38 mm², V2 32 mm², V3 34 mm². **b**, Dot at (−4°, −3°), radius 1.5°, lower left: right hemisphere, dorsal (cuneus); V1 85 mm², V2 37 mm², V3 65 mm². Disc: eccentricity on a log scale, dashed ring at the measured 8°. Stage: CDMD, Destrieux atlas, both hemispheres as the medial pair seen from the subject's right (right hemisphere on the image's left), cropped to the occipital lobes; V1, V2 and V3 in three greys, cortex outside V1–V3 near black, and the predicted response from 0.159 (red) to 1 (yellow). Territories agree with a recomputation from `retinotopy.json` to 0.5 mm².
```

## Data

| Input | Detail |
| :--- | :--- |
| Template | Benson template v4.0 ([Benson et al. 2014](../reference/references.md#group-data-and-templates)), fitted to the HCP 7T retinotopy group average of 181 participants ([Benson et al. 2018](../reference/references.md#group-data-and-templates)); [neuropythy](https://github.com/noahbenson/neuropythy) commit `a3d240f`, `neuropythy/lib/data/fsaverage/surf`; AGPL-3.0 |
| Files | Eight `?h.benson14_{angle,eccen,sigma,varea}.v4_0.mgz` (polar angle, eccentricity, population receptive field (pRF) size σ and visual area per `fsaverage` vertex), each pinned by SHA-256 |
| Areas | V1, V2 and V3 (`varea` codes 1, 2, 3); the template's nine other areas are left out as less certain |
| Named areas | Maximum-probability atlas of 25 topographic areas mapped in 53 people ([Wang et al. 2015](../reference/references.md#group-data-and-templates)), as the HCP 7T retinotopy dataset distributes it on `fsaverage`: `atlasmgz.zip` (113,908 bytes) from [OSF bw9ec](https://osf.io/bw9ec/), CC BY 4.0; `?h.Wang2015.mgz` extracted unchanged. The archive and both files are pinned by SHA-256, and `fetch_retinotopy.py` checks the archive's colour table against the configured codes |
| Area codes | 1 to 25: V1v, V1d, V2v, V2d, V3v, V3d, hV4, VO1, VO2, PHC1, PHC2, TO2, TO1, LO2, LO1, V3B, V3A, IPS0 to IPS5, SPL1, FEF. The medial wall is NaN in this copy, read as no area. The copy neuropythy distributes (`wang15_mplbl.v1_0`, not used) agrees with it at 99.3% of `fsaverage` vertices in each hemisphere |
| Eccentricity | Measured to 8° (the HCP stimulus); template extent 90°, extrapolated beyond 8° |
| Surfaces | `fsaverage` and CDMD `sphere.reg`; CDMD `white` and `pial` |

## Method

### Projection onto this brain

For each hemisphere, `project` (`brain_model/layers/retinotopy.py`):

1. Converts polar angle $\theta$ and eccentricity $e$ to visual-field position, $x = s\,e\sin\theta$, $y = e\cos\theta$, with $s = +1$ for the left hemisphere (right half-field) and $-1$ for the right. Interpolating $x, y$ avoids wrapping the angle; σ is carried alongside.
2. Normalises both spheres to unit radius and takes the three nearest template vertices of each target vertex (`cKDTree`).
3. Among the triangles incident to those vertices, takes the one the target direction lies most inside (`crossed_triangles`), with barycentric weights clipped at zero. A direction outside all candidates is an error.
4. Interpolates linearly, weighting only corners in V1–V3, so that a corner outside does not average in zero or a neighbouring area's larger pRF.
5. Takes the visual-area code from the nearest template vertex. A vertex in V1–V3 with no V1–V3 corner is an error.

### Field-sign check

`check_field_signs` refuses a projection unless at least 99% of V1 vertices lie in the hemisphere's opposite half-field, and V1 above the median height of V1 on the white surface maps the lower field on average while V1 below it maps the upper field.

### Vertex attributes

`retinotopy_fields` (`brain_model/build.py`) places $x$, $y$ and σ on every cortical region of each atlas. A vertex the atlas partition adds at a V1–V3 border averages only its V1–V3 corners. The fields are written to the cortex `.glb` files as `_FIELD_X`, `_FIELD_Y`, `_PRF_SIGMA` (16-bit, over x −87.6° to 89.3°, y −88.5° to 87.8°, σ 0° to 23.8°, recorded in `appearance.field_ranges`) and `_VISUAL_AREA`.

### Territory sidecar

`summarize` writes `retinotopy.json` (1.07 MB): for each hemisphere, the V1–V3 vertices with $x$, $y$ (to 0.001°), area code and `mm2`. `mm2` is the vertex's area on the midthickness surface (mean of white and pial), one third of each incident triangle's area, so vertex areas sum to the surface area. The territory of a dot of centre $(x_0, y_0)$ and radius $r$ is, per hemisphere and area,

$$T = \sum_{i:\,(x_i - x_0)^2 + (y_i - y_0)^2 \le r^2} \mathrm{mm2}_i .$$

The manifest's `retinotopy` record holds each area's total, the share of V1–V3 area beyond 8°, and the area-weighted Dice of each predicted area with HCP-MMP (`V1`, `V2`, `V3` ROIs), Julich-Brain 3.1 (hOc1; hOc2; hOc3v and hOc3d) and the named atlas (`wang`: V1v and V1d; V2v and V2d; V3v and V3d).

### Named visual areas

`project` gives each vertex the named area of its nearest template vertex on the registered sphere, as it gives the template's area code; no position is carried with it. Before anything is published, `check_visual_areas` refuses a hemisphere where an area reaches no vertex, or where the atlas's V1, V2 or V3 (each its ventral and dorsal halves) overlaps the predicted area below the Dice fixed before the first build: 0.7, 0.6 and 0.5, on midthickness area, in each hemisphere (`visual_areas.agreement` in the configuration).

`name_anchors` chooses where each area's name stands: in the area's largest connected piece, the vertices at least half as far from the piece's edge, along the midthickness mesh (Dijkstra over its edges), as its farthest vertex; of those, the one of least sulcal depth (`?h.sulc`), so the name sits inside the area on a crown the camera can see. The sidecar's `visual_areas` holds the codes and, per hemisphere and area, its midthickness area in mm² and its anchor on the pial and white surfaces in surface RAS millimetres. The code itself rides on every cortical vertex as `_WANG_AREA` (8-bit), placed on each atlas's partition by majority as `_VISUAL_AREA` is, and the record's `visual_areas` names it.

## Display

The map opens under **Circuits › Maps** and from the V1 landmark of the Visual pathway tour ([circuits](circuits.md)). The scene shows both hemispheres as a medial pair, uncut, opaque, with internal anatomy hidden, seen from the subject's right and framed with a 30 mm margin on each hemisphere's region of the current atlas holding most predicted V1 vertices within 8°.

- **Medial pair.** While the map is drawn, the right hemisphere's cortex (every cortical atlas) is rotated half a turn about the superior axis and set behind the left occipital pole, the poles 10 mm apart: both medial walls face the camera, the right hemisphere on the left of the stage and the left on the right, so each half of the field is drawn on its own side with fixation in the middle. A rotation, not a mirror, so neither hemisphere's handedness changes. Each side edge's orientation letter is that of the hemisphere drawn on that side (both read A from the map's view); the orbit is held within 45° of level so the top and bottom letters, S and I, hold for both. Closing the map puts the hemisphere back.
- **Following.** When the dot moves, the box of drawn cortex it drives past the threshold below is computed on the CPU (`predictedResponse`, the shader's model) and, once its centre leaves the middle third of the visible stage or it no longer fits, the camera pans onto it, keeping its heading and the reader's zoom.

- **Disc.** Radius $\rho = \ln(1 + e/0.25)/\ln(1 + 90/0.25)$, which puts 8° near 0.6 of the radius; rings at 1°, 2°, 4°, 16° and 32°, dashed ring at 8°, the annulus beyond it shaded. Arrow keys step 0.02 of the disc radius, 0.08 with Shift. **Dot radius** is logarithmic from 0.1° to 10°. A note appears when eccentricity plus radius exceeds 8°.
- **Hemisphere.** Left for $x > 0$, right for $x < 0$, none on the vertical meridian; the panel names it, and its Dice agreement.
- **Shader.** Each vertex at least half in V1–V3 is drawn in a grey for its area (linear 0.6, 0.27, 0.11), darkened ×0.65 beyond 8°, with the 8° line drawn at 0.85; cortex outside V1–V3 is 0.045. The dot is drawn as the activation the linear pRF model predicts (Dumoulin & Wandell 2008): the share $P(d)$ of a unit-volume Gaussian of width σ, its centre $d$ from the dot's, inside the dot of radius $r$, divided by $P(0) = 1 - e^{-r^2/2\sigma^2}$, its share when centred on the dot. $P(d)$ is integrated in the fragment shader, and for following in `predictedResponse`, by Simpson's rule (24 intervals, within 6σ of the pRF centre, with the exponentially scaled Bessel $I_0$); against SciPy's non-central χ² it is within 7 × 10⁻⁵ in float32 over σ 0.05–8° and $r$ 0.0001–90°. Responses from Φ(−1) = 0.159, what a large dot drives one σ beyond its edge, to 1 are coloured on FSL's red–yellow scale, the overlay tool's positive scale. Dividing by $P(0)$ assumes every vertex's strongest response is alike, so a small dot lights each area it reaches; the absolute amplitude a scan would show is not modelled.
- **Named areas.** The switch **Name the visual areas**, under the clicked cortex, is off at first and keeps its state as the map closes and opens. On, the shader draws each named area's border as a white line about two pixels wide, beneath the dot's response: each area is given one of four border classes, found once from the cortex's triangles so that no two areas that meet share one (`areaBorderClasses`), each vertex carries its class as one of four channels, and the line is drawn where the interpolated shares of the two leading classes (no area being a fifth) meet. The anchors are downloaded with the territories; each follows the surface the cortex is drawn on (pial, mid-thickness or white) and the medial pair, and has no name behind the camera, on a hidden hemisphere, or where the drawn surface meets the ray from the camera more than 1.5 mm before it (`engine/visual-areas.ts`). Names stand centred on their anchors in haloed type, larger areas first (`VisualAreaNames.svelte`, `area-names.ts`, the stage's `placeCentred`): a name that would leave the stage or cover the chrome or another name is left out, and comes back as the reader zooms in. A saved image draws the names where they stand, leaving out one its own caption, letters or keys would cover. The panel adds the atlas's Dice with the predicted V1, V2 and V3 on the dot's hemisphere, and a key entry for the borders. The dot's predicted cortex stays V1 to V3.
- **Reading.** A click on V1–V3 interpolates the triangle's V1–V3 corners with barycentric weights and makes that pRF the dot; a point less than half in V1–V3 has no reading. The reading also names the area of the named atlas at the point, switch on or off: the code holding the largest barycentric share of the triangle's corners, as the borders are drawn (`visualAreaAt`). A click on a named area outside V1–V3 gives its name alone ("Left LO1: the template predicts no visual field position here.").
- **URL state.** `map=visual-field&dot=x,y,r`, degrees from fixation (x right, y up), to 0.01°; accepted within 90° eccentricity and $0.01° \le r \le 90°$.

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| `test_definition_refuses_more_areas_unpinned_files_or_a_measured_span_beyond_the_template` | Eight pinned files, V1–V3 codes only, 8° inside 90° | passes |
| `test_projecting_fsaverage_onto_itself_returns_the_template_at_each_vertex` | Identity projection returns the template (tolerance 0.001°) | passes |
| `test_a_hemisphere_mapping_its_own_half_field_is_refused`, `test_upside_down_v1_is_refused` | Field-sign check refuses a wrong map | passes |
| `test_vertex_areas_sum_to_the_surface_area` | Vertex areas sum to surface area (relative 10⁻⁹) | passes |
| `test_the_sidecar_holds_exactly_the_published_areas_territory` | Sidecar `mm2` sums equal the recorded area totals (±1 mm²) | passes |
| `retinotopy.validate` | Sidecar and record equal a fresh projection | passes |
| `brain_model.validate` | Quantised vertex attributes against the projection, all four atlases | max error 0.0014° (x, y), 0.0002° (σ); area code exact |
| Manifest `retinotopy`, area on midthickness | V1 / V2 / V3 | left 2,235 / 2,230 / 1,745 mm²; right 2,570 / 2,389 / 1,929 mm² |
| Manifest, share of V1–V3 area beyond 8° | — | left 40.8%, right 44.1% |
| Manifest, Dice with HCP-MMP (left / right) | V1, V2, V3 | 0.90 / 0.89, 0.76 / 0.78, 0.78 / 0.72 |
| Manifest, Dice with Julich-Brain (left / right) | V1, V2, V3 | 0.68 / 0.72, 0.56 / 0.54, 0.57 / 0.46 |
| `check_visual_areas`: the named atlas's V1, V2, V3 against the predicted ones, fixed before the first build (left / right) | Dice ≥ 0.7, 0.6, 0.5 in each hemisphere | 0.720 / 0.720, 0.677 / 0.659, 0.567 / 0.596 (both hemispheres together 0.720, 0.668, 0.582): published |
| The same on `fsaverage` itself, for context (left / right) | — | 0.707 / 0.690, 0.683 / 0.623, 0.590 / 0.563 |
| Named areas on this brain, midthickness | Every area in each hemisphere | all 25 in each; from 795 mm² (right V1d) to 4.8 mm² (right IPS5); left TO2 6.8 mm²; the atlas's V1 1,424 mm² left and 1,558 mm² right |

Front-end checks: `web/src/lib/core/learning/visual-field.test.ts` (territory sums, sidecar refusal, hemisphere and polar angle, disc scale and its inverse, named areas' anchors larger first); `web/src/features/stage/stage-labels.test.ts` (`placeCentred`), `area-names.test.ts` and `VisualAreaNames.svelte.test.ts` (names centred on their anchors, left out when crowded or hidden); `web/src/features/circuits/VisualFieldMap.svelte.test.ts` (the switch, its agreement and source, the reading's area); `web/src/lib/state/visual-field-map.svelte.test.ts` (borders follow the switch while the map is open); `web/src/lib/engine/model/visual-field.test.ts` and `brain-atlas.test.ts` (border classes, borders on and off, the area at a click); the engine contract (names of both hemispheres while the map draws them); `web/src/features/snapshot/snapshot.drawing.svelte.test.ts` (names in the saved image). Python checks of the named areas: `test_visual_areas_whose_v1_misses_the_templates_are_refused`, `test_a_visual_area_that_reaches_no_vertex_is_refused`, `test_an_areas_name_stands_inside_it_at_its_most_gyral_interior_vertex`, and the identity projection, which also returns the atlas's labels.

## Limitations

- A group template applied to this brain's folding; no retinotopy was measured here, and V1 size varies about threefold between people.
- About 43% of predicted V1–V3 area lies beyond the measured 8°; every position and territory there is extrapolated.
- No visual field position is predicted beyond V3: the named areas outside V1–V3 name the cortex and nothing more.
- The 25 named areas are a maximum-probability map from 53 people; the small areas vary most between people. On this brain left TO2 covers 6.8 mm² and right IPS5 4.8 mm².
- The named atlas's V1 covers less of this brain than the predicted V1 (1,424 and 1,558 mm² against 2,235 and 2,570 mm²), so outlines and grey areas disagree, most of all far from fixation: the named V1 covers 90% (left) and 93% (right) of the predicted V1 within 8°, and 30% and 23% beyond. Its V1 passes the 0.7 check by 0.02 here, and would not on `fsaverage`'s right hemisphere (0.690).
- V2 and V3 agree less with atlas parcels than V1. The HCP-MMP agreement is not independent evidence.
- A territory is midthickness area whose predicted pRF centre lies inside the dot, not the cortex that would respond to it.

## Code availability

| | |
| :--- | :--- |
| Code | [`brain_model/layers/retinotopy.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/retinotopy.py), [`scripts/fetch_retinotopy.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/fetch_retinotopy.py), [`web/src/lib/core/learning/visual-field.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/learning/visual-field.ts), [`web/src/features/circuits/VisualFieldMap.svelte`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/features/circuits/VisualFieldMap.svelte), [`web/src/features/stage/VisualAreaNames.svelte`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/features/stage/VisualAreaNames.svelte), [`web/src/features/stage/area-names.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/features/stage/area-names.ts), [`web/src/lib/engine/visual-areas.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/engine/visual-areas.ts), [`web/src/lib/engine/model/visual-field.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/engine/model/visual-field.ts), [`web/src/lib/engine/render/materials.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/engine/render/materials.ts) |
| Configuration | [`config/retinotopy.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/retinotopy.yaml); `retinotopy` in the layers of [`config/model.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/model.yaml) |
| Tests | [`tests/test_retinotopy.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_retinotopy.py), `brain_model.validate` |

```bash
uv run python scripts/fetch_retinotopy.py        # add --record to register in data/sources.json
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_retinotopy.py
```

Figure state (panel a; panel b uses `dot=-4,-3,1.5`): https://planumatlas.com/#anatomy=cdmd&atlas=destrieux&tab=circuits&map=visual-field&view=right&internal=0&dot=4,3,1.5
