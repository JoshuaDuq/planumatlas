# Cortical layers

For a selected cortical parcel, the region sheet shows how its thickness divides among the six cortical layers, and for twelve Julich-Brain areas the density of cells in each layer. Both come from one post-mortem brain, BigBrain, not from the brain shown. In Anatomy, layer IV's share can be painted across the cortex: thick in sensory cortex, thin in motor cortex, the difference cytoarchitectonic areas were drawn on.

## Data

| Input | Detail |
| :--- | :--- |
| Layers | BigBrain's six layers, segmented by a neural network on its cell-stained 20 µm sections (Wagstyl et al. 2020, [10.1371/journal.pbio.3000678](https://doi.org/10.1371/journal.pbio.3000678), PMID 32243449), as thickness per vertex of `fsaverage` (163,842 vertices per hemisphere), resampled there by BigBrainWarp (Paquola et al. 2021, [10.7554/eLife.70119](https://doi.org/10.7554/eLife.70119), PMID 34431476): `tpl-fsaverage_hemi-{L,R}_den-164k_desc-layer{1…6}.shape.gii`, 0.69–0.72 MB each, from the public share its README and `scripts/downloads.sh` name (`fz-juelich.sciebo.de/s/HoKucnh8zFpSbKF`, folder `spaces/tpl-fsaverage`, files dated 2025-06-13). Each file's SHA-256 is pinned in `config/cortical-layers.yaml`; they are copied unchanged into `data/fsaverage/surf/` |
| BigBrain | A man of 65, examined post mortem (Amunts et al. 2013, [10.1126/science.1235381](https://doi.org/10.1126/science.1235381), PMID 23788795) |
| Cells | EBRAINS "Layer-specific distributions of segmented cells" (Dickscheid, Bludau, Paquola, Schiffer, Upschulte, Amunts), twelve datasets, one per Julich-Brain area: 4a ([10.25493/pv5q-sfr](https://doi.org/10.25493/pv5q-sfr)), 44 ([10.25493/the9-vqu](https://doi.org/10.25493/the9-vqu)), 7P ([10.25493/35k1-btx](https://doi.org/10.25493/35k1-btx)), FG1 ([10.25493/e1fy-2c4](https://doi.org/10.25493/e1fy-2c4)), FG3 ([10.25493/da0m-gm](https://doi.org/10.25493/da0m-gm)), FG4 ([10.25493/yvwp-9aq](https://doi.org/10.25493/yvwp-9aq)), Fp1 ([10.25493/yfg8-3r7](https://doi.org/10.25493/yfg8-3r7)), hOc1 ([10.25493/evpc-mvh](https://doi.org/10.25493/evpc-mvh)), hOc2 ([10.25493/tmfg-6fq](https://doi.org/10.25493/tmfg-6fq)), hOc3d ([10.25493/f781-v5j](https://doi.org/10.25493/f781-v5j)), hOc4d ([10.25493/zxqx-jkp](https://doi.org/10.25493/zxqx-jkp)), hOc5 ([10.25493/j4hz-14x](https://doi.org/10.25493/j4hz-14x)). Image patches cut from BigBrain's sections at 1 µm, layers drawn by hand and checked by a second expert, cell bodies segmented by a contour proposal network (Upschulte et al. 2022, [10.1016/j.media.2022.102371](https://doi.org/10.1016/j.media.2022.102371)). Read from the public bucket `p22717-hbp-d000061_BB-CorticalCellDistribution_pub`, no login; each patch's `segments.txt`, `layerinfo.txt` and pial line `0.json` pinned by SHA-256 |

### Terms

Read on 2026-11-16. BigBrain is CC BY-NC-SA 4.0 (`License.txt` at the root of the BigBrain FTP, `ftp.bigbrainproject.org/bigbrain-ftp/`). The BigBrainWarp share holds no licence file of its own. The BigBrainWarp paper's data statement says its data are "included in the BigBrainWarp repository", whose `LICENSE` is GPL-3.0 and covers its code; the paper itself is CC BY 4.0. No term found forbids redistribution, so BigBrain's terms carry over to the derived `fsaverage` files: non-commercial, shared alike. Each cell dataset ships `Licence-CC-BY-NC-SA.pdf` and its DataCite record states CC BY-NC-SA 4.0.

## Method

`scripts/fetch_cortical_layers.py` copies the twelve layer files and checks each SHA-256, then reads each pinned cell patch: the cells it segmented in layers 1 to 6 (0 lies above the pial line and 7 in white matter) and each layer's area in the section, as published in µm². Eight patches whose layer lines are marked `"QC ok": false` in all seven annotation files are left out (six of hOc2, two of hOc5); the fetch fails once one of them is marked as passing. 114 of the 122 patches are read into `data/cortical-layer-cells.json`.

`brain_model/layers/cortical_layers.py` works on `fsaverage`, where both the layers and the published annotations of Planum's five cortical atlases (Destrieux, HCP-MMP1.0, Julich-Brain 3.1, Schaefer 400, Desikan-Killiany) lie. For each parcel it takes the area-weighted mean thickness of each layer, with vertex areas on the mid-thickness surface, and divides it by the sum of the six: each layer's share of the parcel's thickness, which is also its share of the parcel's volume. A vertex BigBrain masks carries zero in every layer and adds nothing to either sum. Shares, not millimetres: a share does not depend on the tissue's overall shrinkage, which BigBrain's thickness maps do not correct. A parcel is published where the layers cover at least 50% of its area, and is carried to this brain's parcel of the same name in the same hemisphere; a parcel of this brain with no namesake on `fsaverage` stops the build. Shares are published in thousandths, rounded by largest remainder so a parcel's six sum to 1000.

Cortex without six layers is left out by name, whatever the network assigned there: the hippocampal formation's allocortex (HCP-MMP H and PreS; Julich-Brain CA1–3, DG, the subicular complex and the transsubiculum) and the olfactory piriform cortex (HCP-MMP Pir). The entorhinal cortex is kept. Destrieux, Desikan-Killiany and Schaefer name no such parcel.

Cell density in a layer is its cell count over the layer's volume in the patch: its area in the section times the 20 µm section thickness, the thickness corrected by the linear shrinkage, the cube root of the datasets' volumetric factor 1.931, as the datasets' own reports compute it and siibra reproduces them. The unit is cells per (0.1 mm)³, 10⁶ µm³; the datasets' reports write it "0.1mm3", but a cube 0.1 mm on a side is what they compute (about 30 to 100 per layer, or 30,000 to 100,000 cells per mm³). The mean and SD over an area's patches reach the Julich-Brain area of the same name, in both hemispheres, as receptor fingerprints do.

`cortical-layers.json` holds the shares of 1,220 parcels and the twelve areas' densities: 57 kB, 15 kB gzipped.

## Display

**Layers (one histological brain)** sits in the region sheet's About index for a parcel with shares, closed, its closed line giving layer IV's share. Opened, a bar in six parts in proportion shows layers I to VI, layer IV in the colour of its paint step, over a table of each layer's share to one decimal; for the twelve areas a third column gives cells per (0.1 mm)³ as mean ± SD, with the number of patches below. The note says it is one brain, placed by registration and by parcel name; links lead to the paper, BigBrainWarp and the area's EBRAINS dataset. The file is downloaded when a cortical region is first shown.

In Anatomy, **Paint layer IV across the cortex** colours every parcel of the shown atlas by its layer IV share on one sequential scale, with a key. A ruled strip in the section names it with **Restore previous view**, which ends it, as a disorder's paint does. Painting ends a connectivity or disorder paint and sets the reader's highlights aside until it ends; another tab ends it.

The scale has four steps, from 0, 7, 9 and 12%, lilac to deep crimson: sRGB (231, 225, 239), (185, 120, 205), (165, 0, 95) and (80, 0, 28). It was chosen after the shares were measured (per published parcel: median 8.0%, 90th percentile 10.3%, V1 20–25%) so that area 4, area 3b and V1 fall in different steps, in a hue the functions' blue, connectivity's violet and the disorders' blue and orange do not use. Each colour differs from the cortex, deep grey and ventricle tissue colours by an OKLab ΔE of at least 14.5 under normal vision, 12.7 under simulated protanopia and 7.8 under deuteranopia (against the ventricle, seen only on a cut), and from the others by at least 17.1 (Machado 2009, severity 1). Green ramps were measured and rejected: under deuteranopia a middle step fell within ΔE 4 of the cortex or deep grey. Published parcels per step: 332, 528, 314 and 46.

## Validation

| Test | Criterion (fixed before the run) | Result |
| :--- | :--- | :--- |
| Sums | The six shares of every parcel sum to 1 | passes: 1,220 parcels, largest error 4.4 × 10⁻¹⁶; every published parcel's thousandths sum to 1000 |
| Granular and agranular cortex | On HCP-MMP, in both hemispheres, layer IV's share is smaller in area 4 than in area 3b; if not, the layer is not published | passes: left 8.0% < 9.9%, right 7.2% < 11.7% |
| Primary visual cortex | On HCP-MMP, in both hemispheres, V1's layer IV share is in the highest quarter of areas; if not, the layer is not published | passes: left 20.6% (75th percentile 9.1%; above 99.4% of 175 areas), right 24.5% (9.1%; 99.4% of 177) |
| Reproduction | Parcel values reproduce from the pinned files | passes: two runs give the same file; an independent per-vertex recomputation of every HCP-MMP parcel differs by at most 0.7 thousandths (rounding); `brain_model.validate` recomputes the file and the manifest record from the pinned files |
| `tests/test_cortical_layers.py` | Unpinned files, a falling scale, a patch pinned twice or also unverified refused; thousandths by largest remainder; the gate fails on a swapped area 4 and 3b or V1 below the top quarter, and on shares not summing to 1; excluded and thinly covered parcels left out; densities by the reports' formula; cells counted in layers 1–6 only | passes |

Published parcels by atlas: Destrieux 144 of 148, HCP-MMP 352 of 360, Julich-Brain 263 of 278, Schaefer 394 of 400, Desikan-Killiany 67 of 68. Left out for cover below 50%, BigBrain's medial-wall mask reaching further on the left: Destrieux left parahippocampal gyrus and subcallosal gyrus, right posterior-ventral cingulate gyrus and pericallosal sulcus; HCP-MMP left EC and PHA1; Julich-Brain left EC, s24 and 25; Schaefer six parcels; Desikan-Killiany left parahippocampal.

Examples (I to VI, in thousandths): Julich-Brain left area 4a 123, 93, 265, 86, 193, 240; left hOc1 123, 85, 233, 219, 146, 194; Desikan-Killiany left precentral 118, 100, 264, 72, 194, 252, postcentral 124, 104, 260, 86, 189, 237, pericalcarine 120, 93, 255, 163, 166, 203. Cells per (0.1 mm)³ in layer IV: area 4a 50 (9 patches), area 44 65 (10), hOc1 98 (10), hOc2 100 (5).

## Limitations

- One brain, a man of 65, examined post mortem. Its six layers were segmented by a neural network at 83% per-point accuracy (Wagstyl et al. 2020).
- Another brain's layers, shown at the matching place by registration (BigBrainWarp's `fsaverage` resampling) and by parcel name; nothing is measured in this brain.
- Cortex that has no six layers (hippocampus, olfactory cortex) is left out, as is a parcel BigBrain's layers cover on less than half its area.
- Cell densities count every cell body the network detected, not neurons alone, in 5 to 11 patches per area of the same brain, and reach a region only by the name of its Julich-Brain area; both hemispheres show the same values.
- Non-commercial, share-alike: BigBrain and the cell datasets are CC BY-NC-SA 4.0.

## Code availability

| | |
| :--- | :--- |
| Code | [`scripts/fetch_cortical_layers.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/fetch_cortical_layers.py), [`brain_model/layers/cortical_layers.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/cortical_layers.py), [`web/src/lib/core/catalog/cortical-layers.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/catalog/cortical-layers.ts), [`web/src/features/inspector/LayersSection.svelte`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/features/inspector/LayersSection.svelte) |
| Configuration | [`config/cortical-layers.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/cortical-layers.yaml); derived counts in [`data/cortical-layer-cells.json`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/cortical-layer-cells.json) |
| Tests | [`tests/test_cortical_layers.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_cortical_layers.py), `brain_model.validate` |

```bash
uv run python scripts/fetch_cortical_layers.py --record   # patches cached in data/cache/cortical-layers
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_cortical_layers.py
npm test --prefix web
```
