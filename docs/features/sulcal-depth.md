# Sulcal depth

The **Colour** option **Sulcal depth**, under **Morphometry**, colours the cortex by FreeSurfer's sulcal depth: blue on the gyral crowns, red in the sulci (Fig. 1). Every cortex already carries the depth, so the colour downloads nothing. It is shown on sub_013 of the MGH Connectome Diffusion Microstructure Dataset (CDMD) and on the Montreal Neurological Institute (MNI) template.

```{figure} figures/sulcal-depth-1-light.webp
:alt: Two lateral views of the left hemisphere of CDMD coloured by sulcal depth, blue on the crowns and red in the sulci, above a key reading −18 to +18 mm. a, the pial surface, almost all blue. b, the white surface, where the opened sulci show red floors.
:name: fig-sulcal-depth-1

**Sulcal depth is blue on the crowns and red in the sulci, which the white surface opens.** **a**, [The left hemisphere](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&view=left&hemi=left&internal=0&colors=sulc) from its lateral side on the pial surface, with **Colour** set to **Sulcal depth** and the internal anatomy hidden. What shows is mostly gyral crowns, so the brain reads blue. **b**, The same view after **Display** › **Cortex surface** › **White**, which a link does not carry. The sulci open and show their red floors, deepest in the insula. Subject CDMD `sub_013`; key centred on the hemisphere's mean depth. Scale bars apply at the depth of the camera's target.
```

## Data

| Input | Detail |
| :--- | :--- |
| Depth | `surf/lh.sulc`, `surf/rh.sulc` of each anatomy's FreeSurfer 8.2 reconstruction. FreeSurfer measures it as "the signed distance each points moves to get from the white to the inflated surface", outward positive ([B. Fischl, FreeSurfer list, 6 February 2024](https://mail.nmr.mgh.harvard.edu/archives/list/freesurfer@nmr.mgh.harvard.edu/message/TTBM7NHDAERVRINLE4WN5FRVZ3MCC32N/)), so sulci are positive and gyral crowns negative |

The values are millimetres around each hemisphere's mean: on both brains each hemisphere's mean is 0.000 and its standard deviation 5.4 to 5.5 mm.

The build already bakes the depth into every cortical vertex as `_SULC` for the fold shading, quantised over the span `manifest.json` › `appearance.field_ranges._SULC` records, and checks the decoded values against `?h.sulc` (`maximum_sulcal_depth_error` in the build's validation). Nothing new is published.

## Method

The key is centred on 0 and spans the published depths' larger end, out to the whole millimetre, so no vertex lies beyond it: ±18 mm on CDMD (−14.0 to 17.4 mm published) and ±17 mm on the template (−12.2 to 16.3 mm).

The ramp is Kenneth Moreland's cool–warm diverging map, matplotlib's `coolwarm`, all 33 of its control points (`web/src/lib/core/catalog/sulcal-depth.ts`), interpolated in sRGB as the key's gradient is. It was designed for signed values on shaded 3D surfaces: its ends are equally light (L\* 37.7), so neither sign reads as more, and its neutral centre (221, 221, 221; L\* 88.1) marks the hemisphere's mean. Fewer stops would miss the curve: nine stops differ from matplotlib's table by up to 13 of 255 per channel.

The fragment shader reads the depth the fold shading already decodes, so the colour adds no vertex attribute and no texture.

## Display

The whole cortical surface takes the colour, the medial wall too: FreeSurfer computes the depth on every vertex, and the picture is the same under every atlas. The deep structures, the cerebellum and the cut faces keep their tissue colours. A paint, or the grey of a Focus ghost, covers the colour as it covers any other. The stage key reads "Sulcal depth", "−18 to +18 mm" and what the depth is. The URL parameter is `colors=sulc`.

Seen on the pial surface the brain is mostly blue, since what shows of it is gyral crowns and the sulci are closed (Fig. 1a). **Display** › **Cortex surface** › **White** opens the sulci and shows their red floors (Fig. 1b).

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| Colour lookup (`network-colors.svelte.test.ts`, SULC-01) | In real WebGL, a surface at −18, −5.3, 0, 6.66 and 36 mm draws the key's colour for its depth: each frame equals, within 0.001, the same lit surface painted the key's colour with the depth colour off. Flipping the depth's sign or leaving out the sRGB conversion fails it | passes |
| Ramp (`sulcal-depth.test.ts`, SULC-03) | Neutral centre; lighter toward it from either end; ends L\* 35 to 42 | passes |
| Range (SULC-04) | CDMD's and the template's spans give ±18 and ±17 mm; no span, no key | passes |
| Key and Colour list (`stage-keys.test.ts`, `header.test.ts`, SULC-02) | "−18 to +18 mm" (French "−18 à +18 mm") with the 33 stops; a paint replaces it; the template offers sulcal depth without thickness | passes |

## Limitations

Sulcal depth is not a distance from the brain's outer surface or from the skull. It is how far each point moved to reach a smoothed (inflated) surface, measured around the hemisphere's mean, so a shallow sulcus in a deep fold can read deeper than a deep sulcus on a crown.

On the MNI template it is the depth of the averaged image's surface: it describes the shape drawn, not any person's sulci. The medial wall is not cortex, and its colour is the depth of the reconstructed surface where it crosses the corpus callosum and the brainstem. Cut faces do not show depth.

## Code availability

Code
: [`web/src/lib/core/catalog/sulcal-depth.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/catalog/sulcal-depth.ts), `SULC_FRAGMENT` in [`web/src/lib/engine/render/materials.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/engine/render/materials.ts)

Tests
: `web/src/lib/core/catalog/sulcal-depth.test.ts`, `web/src/lib/engine/render/network-colors.svelte.test.ts`, `web/src/features/stage/stage-keys.test.ts`, `web/src/lib/core/panels/header.test.ts`

```bash
npm test --prefix web -- sulcal-depth stage-keys header
npm run test:browser --prefix web -- network-colors
```
