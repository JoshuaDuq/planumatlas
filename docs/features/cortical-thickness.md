# Cortical thickness

The **Colour** option **Cortical thickness**, under **Morphometry**, colours the cortex by its own thickness, as FreeSurfer measured it on the T1-weighted (T1) magnetic resonance imaging (MRI) scan of sub_013 of the MGH Connectome Diffusion Microstructure Dataset (CDMD) (Fig. 1). A cortical region's **Measurements and source** gives its mean. It is one individual's measurement, not a population's, and it is published for CDMD alone.

```{figure} figures/cortical-thickness-1-light.webp
:alt: Two views of the left hemisphere of CDMD coloured by cortical thickness on viridis, dark blue for thin and yellow for thick cortex, above a key reading 1.0 to 4.0 mm. a, the lateral side. b, the medial side, where the unmeasured medial wall keeps its tissue colour.
:name: fig-cortical-thickness-1

**The cortex is coloured by its own thickness, vertex by vertex.** **a**, [The left hemisphere](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&view=left&hemi=left&internal=0&colors=thickness) from its lateral side, with **Colour** set to **Cortical thickness** and the internal anatomy hidden. The precentral gyrus is mid-range and the temporal pole is among the thickest cortex. **b**, [The same hemisphere](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&view=right&hemi=left&internal=0&colors=thickness) from its medial side. The banks of the calcarine sulcus are the thinnest cortex, and the medial wall, which FreeSurfer does not measure, keeps its tissue colour. The key spans the measured vertices' 1st to 99th percentiles, out to the half millimetre. Subject CDMD `sub_013`. Scale bars apply at the depth of the camera's target.
```

## Data

| Input | Detail |
| :--- | :--- |
| Thickness | `surf/lh.thickness`, `surf/rh.thickness` from the FreeSurfer 8.2 `recon-all` run the anatomy was reconstructed with (`reconstruction.json`): per pial vertex, the distance between the white and pial surfaces, capped at 5 mm; 108,347 and 108,379 vertices, of which 100,219 and 100,129 are measured, the medial wall 0 |
| Statistics | `stats/?h.aparc.stats` and `stats/?h.aparc.a2009s.stats` of the same run, FreeSurfer's own per-region means and standard deviations for Desikan-Killiany and Destrieux |

The six files were copied from that run's tree after its report was written; its surfaces and annotations are byte for byte the pinned ones, and `data/sources.json` pins the six.

| Published | Content |
| :--- | :--- |
| `thickness-<atlas>.field` | One byte per vertex of `cortex-<atlas>.glb`, region by region in the manifest's region order, each region's in its mesh's vertex order: 0 unmeasured, else the nearest of 255 levels over 0–5 mm (0.02 mm steps). Destrieux 358,511 bytes (293,650 gzipped), HCP-MMP 447,870, Julich-Brain 422,464, Schaefer 434,569, Desikan-Killiany 296,804 |
| `cortical-thickness.json` | Each cortical region's mean and standard deviation, in mm to three decimals |
| `manifest.json` › `cortical_thickness` | Files, encoding, the key's range and the validation below |

## Method

`brain_model/layers/cortical_thickness.py` partitions each hemisphere's pial surface by each atlas's annotation, as the cortex meshes are built. A vertex the partition adds on a parcel border takes the mean of the measured source vertices it is made from, so a parcel's rim along the unmeasured medial wall keeps its own thickness rather than one pulled toward 0. A region's mean and standard deviation are over its source vertices, unweighted, which is how FreeSurfer's tables give them (an area-weighted mean differs from them by up to 0.12 mm).

The key spans the measured vertices' 1st and 99th percentiles, out to the half millimetre: 1.0 to 4.0 mm on CDMD. Thickness is drawn on matplotlib's viridis from 0.2 to 1 (lightness L\* 32 to 91), so the thinnest cortex stays legible on the dark stage; beyond the key's ends the ramp holds its end colours.

In the viewer the file downloads only when the colour is chosen, about 0.3 MB gzipped for one atlas, and again for another atlas chosen while it is shown. The cortex already uses the 16 vertex attributes WebGL guarantees, so each mesh reads its bytes from a small texture by vertex index (`gl_VertexID`) rather than from an attribute.

## Display

The cortex takes its vertices' colours; the unmeasured medial wall (Fig. 1b), the deep structures, the cerebellum and the cut faces keep their tissue colours, since thickness is measured on the cortical surface alone. The stage key reads "Cortical thickness", "1.0 to 4.0 mm" and what the measure misses. A paint, or the grey of a Focus ghost, covers the colour as it covers any other. **Measurements and source** of a cortical region lists **Mean thickness**, for example the left precentral gyrus (Desikan-Killiany) 2.54 ± 0.51 mm. The URL parameter is `colors=thickness`.

On CDMD, the means and standard deviations per Desikan-Killiany region, as the measurements give them:

| Region | Left (mm) | Right (mm) |
| :--- | :--- | :--- |
| Pericalcarine (primary visual) | 1.63 ± 0.43 | 1.68 ± 0.48 |
| Postcentral (primary somatosensory) | 2.07 ± 0.53 | 2.06 ± 0.51 |
| Precentral (primary motor) | 2.54 ± 0.51 | 2.54 ± 0.53 |
| Entorhinal | 2.93 ± 0.91 | 2.95 ± 0.79 |
| Temporal pole | 3.58 ± 0.66 | 3.89 ± 0.50 |

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| FreeSurfer's own tables (`cortical_thickness.check_statistics`; `test_cortical_thickness.py`) | Every Desikan-Killiany and Destrieux region's mean and standard deviation equal `?h.aparc.stats` and `?h.aparc.a2009s.stats` to their three decimals | largest difference 0.0005 mm |
| Vertex order (`check_order`) | Sulcal depth measured the same way along each region's vertices is the published `_SULC` of its mesh, for every region of the five cortex files; the fields cover the files exactly | passes; a reordered measurement is refused |
| Rebuild (`validate`) | The published files and record are what the pinned files give now | passes |
| Encoding (`test_cortical_thickness.py`) | 0 stays unmeasured; every measured value within 0.0098 mm | passes |
| Engine (`cortical-thickness.test.ts`, engine contract) | Bytes reach the mesh of their region in the published order whatever the meshes' order; a mismatched mesh or count draws none of the file; the colour is refused before its file loads and follows an atlas switch | passes |

## Limitations

The values are one individual's estimate from a 1 mm T1. Thickness is measured where grey meets white matter on the scan, so heavily myelinated cortex, such as the primary motor cortex, reads thinner than histology finds it: the precentral gyrus is mid-range here, not among the thickest. The temporal pole and insula, where the scan's contrast is poor, are the least reliable, and the temporal pole's 3.6–3.9 mm may be an overestimate.

The colour is per vertex and unsmoothed, so it shows FreeSurfer's measurement noise as well as the thicker cortex of the gyral crowns and the thinner cortex of the fundi. The medial wall is not measured, and cut faces do not show thickness.

Thickness is not published for the Montreal Neurological Institute (MNI) template, whose reconstruction is of an averaged image and so is no one's thickness.

## Code availability

Code
: [`brain_model/layers/cortical_thickness.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/cortical_thickness.py), [`web/src/lib/engine/model/cortical-thickness.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/engine/model/cortical-thickness.ts), [`web/src/lib/core/catalog/cortical-thickness.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/catalog/cortical-thickness.ts)

Configuration
: [`config/model.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/model.yaml): `cortical_thickness` in an anatomy's `layers`

Tests
: `tests/test_cortical_thickness.py`, `web/src/lib/core/catalog/cortical-thickness.test.ts`, `web/src/lib/engine/model/cortical-thickness.test.ts`, `web/src/features/inspector/RegionFacts.svelte.test.ts`, the engine contract

```bash
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_cortical_thickness.py
npm test --prefix web -- cortical-thickness
```
