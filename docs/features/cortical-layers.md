# Cortical layers

For a selected cortical parcel, the region sheet shows how its thickness divides among the six cortical layers and, for twelve Julich-Brain areas, the density of cells in each layer. The layer thicknesses are those of BigBrain, one post-mortem brain, resampled to `fsaverage` and averaged over each atlas parcel as shares of the six layers' sum. The cell densities were counted in image patches of the same brain's sections. The shares reach the brain shown by registration and by parcel name and the densities by the name of their Julich-Brain area, so neither is measured in it. In the **Anatomy** tab, layer IV's share can be painted across the cortex: thick in sensory cortex, thin in motor cortex, the difference cytoarchitectonic areas were drawn on (Fig. 1a,b).

```{figure} figures/cortical-layers-1-light.webp
:alt: Four panels. a, the lateral surface of the left hemisphere painted in four steps from pale lilac to deep crimson by layer IV share, with area 4 outlined on the precentral gyrus. b, the medial surface in the same paint, with V1 outlined in the darkest step along the calcarine sulcus. c, the Layers section of Julich-Brain area hOc1, with a six-part bar, the share of each layer and the cells per layer. d, a histogram of layer IV share over the HCP-MMP parcels, in the same four colours, with area 4, area 3b and V1 marked.
:name: fig-cortical-layers-1

**Layer IV is thin in motor cortex and thick in primary sensory cortex, and the paint puts area 4, area 3b and V1 in different steps.** **a**, [Left hemisphere](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=hcp-mmp&detail=learning&view=left&hemi=left&internal=0&region=hcp-mmp:left:8) from its lateral side after **Paint layer IV across the cortex**, on HCP-MMP parcels, with area 4 (`hcp-mmp:left:8`) selected and outlined. **b**, [The medial side](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=hcp-mmp&detail=learning&view=right&hemi=left&internal=0&region=hcp-mmp:left:1) in the same paint, with V1 (`hcp-mmp:left:1`) selected and outlined. The keys give the four steps of the scale, from 0, 7, 9 and 12%. The paint is not written to a link, so each link opens the selection and the section's button paints. **c**, The **Layers (one histological brain)** section of Julich-Brain area hOc1 (V1), with the six shares of cortical thickness (layer IV 21.9%) and the cells per (0.1 mm)³ in each layer, as mean ± s.d. over 10 image patches. **d**, Layer IV share of every published HCP-MMP parcel (n = 352), in bins of 0.5%, coloured by the step it falls in. Dashed lines are the step edges, and the marks give left area 4, area 3b and V1. Shares are BigBrain's, carried by registration and by parcel name, and nothing is measured in this brain. Scale bars apply at the depth of the camera's target.
```

## Data

| Input | Source | Content | Pin | Licence |
| :--- | :--- | :--- | :--- | :--- |
| Layers | BigBrain's six layers (Wagstyl et al. 2020), resampled to `fsaverage` by BigBrainWarp (Paquola et al. 2021) | `tpl-fsaverage_hemi-{L,R}_den-164k_desc-layer{1…6}.shape.gii`: thickness per vertex of `fsaverage` (163,842 vertices per hemisphere), 0.69–0.72 MB each | SHA-256 of each file in `config/cortical-layers.yaml` | CC BY-NC-SA 4.0, carried over from BigBrain (see Terms) |
| Cells | EBRAINS "Layer-specific distributions of segmented cells" (Dickscheid, Bludau, Paquola, Schiffer, Upschulte, Amunts), twelve datasets, one per Julich-Brain area | Each patch's `segments.txt`, `layerinfo.txt` and pial line `0.json` | SHA-256 of each file in `config/cortical-layers.yaml` | CC BY-NC-SA 4.0 |

BigBrain is the brain of a man of 65, examined post mortem (Amunts et al. 2013, [10.1126/science.1235381](https://doi.org/10.1126/science.1235381), PMID 23788795). Its six layers were segmented by a neural network on its cell-stained 20 µm sections (Wagstyl et al. 2020, [10.1371/journal.pbio.3000678](https://doi.org/10.1371/journal.pbio.3000678), PMID 32243449). BigBrainWarp resampled the thickness of each layer to the vertices of `fsaverage` (Paquola et al. 2021, [10.7554/eLife.70119](https://doi.org/10.7554/eLife.70119), PMID 34431476). The twelve files come from the public share that BigBrainWarp's README and its `scripts/downloads.sh` name (`fz-juelich.sciebo.de/s/HoKucnh8zFpSbKF`, folder `spaces/tpl-fsaverage`, files dated 2025-06-13). They are copied unchanged into `data/fsaverage/surf/`.

The cell datasets hold image patches cut from BigBrain's sections at 1 µm. Their layers were drawn by hand and checked by a second expert, and cell bodies were segmented by a contour proposal network (Upschulte et al. 2022, [10.1016/j.media.2022.102371](https://doi.org/10.1016/j.media.2022.102371)). The patches are read from the public bucket `p22717-hbp-d000061_BB-CorticalCellDistribution_pub`, which needs no login. Each Julich-Brain area has its own dataset:

| Julich-Brain area | Dataset | Patches read |
| :--- | :--- | ---: |
| 4a | [10.25493/pv5q-sfr](https://doi.org/10.25493/pv5q-sfr) | 9 |
| 44 | [10.25493/the9-vqu](https://doi.org/10.25493/the9-vqu) | 10 |
| 7P | [10.25493/35k1-btx](https://doi.org/10.25493/35k1-btx) | 10 |
| FG1 | [10.25493/e1fy-2c4](https://doi.org/10.25493/e1fy-2c4) | 11 |
| FG3 | [10.25493/da0m-gm](https://doi.org/10.25493/da0m-gm) | 10 |
| FG4 | [10.25493/yvwp-9aq](https://doi.org/10.25493/yvwp-9aq) | 10 |
| Fp1 | [10.25493/yfg8-3r7](https://doi.org/10.25493/yfg8-3r7) | 11 |
| hOc1 | [10.25493/evpc-mvh](https://doi.org/10.25493/evpc-mvh) | 10 |
| hOc2 | [10.25493/tmfg-6fq](https://doi.org/10.25493/tmfg-6fq) | 5 |
| hOc3d | [10.25493/f781-v5j](https://doi.org/10.25493/f781-v5j) | 9 |
| hOc4d | [10.25493/zxqx-jkp](https://doi.org/10.25493/zxqx-jkp) | 11 |
| hOc5 | [10.25493/j4hz-14x](https://doi.org/10.25493/j4hz-14x) | 8 |

### Terms

The terms were read on 2026-11-16. BigBrain is CC BY-NC-SA 4.0 (`License.txt` at the root of the BigBrain FTP, `ftp.bigbrainproject.org/bigbrain-ftp/`). The BigBrainWarp share holds no licence file of its own. The BigBrainWarp paper's data statement says its data are "included in the BigBrainWarp repository", whose `LICENSE` is GPL-3.0 and covers its code. The paper itself is CC BY 4.0. No term found forbids redistribution, so BigBrain's terms carry over to the derived `fsaverage` files: non-commercial, shared alike. Each cell dataset ships `Licence-CC-BY-NC-SA.pdf` and its DataCite record states CC BY-NC-SA 4.0.

## Method

### Files and patches read

`scripts/fetch_cortical_layers.py` copied the twelve layer files and checked each SHA-256. It then read each pinned cell patch: the cells segmented in layers 1 to 6 and each layer's area in the section, as published in µm². Layer 0 lies above the pial line and layer 7 in white matter, and neither was counted. Eight patches whose layer lines did not pass quality control, marked `"QC ok": false` in all seven annotation files, were left out (six of hOc2, two of hOc5). The fetch fails once one of them is marked as passing. The other 114 of the 122 patches were read into `data/cortical-layer-cells.json`.

### Layer shares of a parcel

`brain_model/layers/cortical_layers.py` works on `fsaverage`, where both the layers and the published annotations of Planum's five cortical atlases (Destrieux, HCP-MMP1.0, Julich-Brain 3.1, Schaefer 400, Desikan-Killiany) lie. For each parcel $P$ it took the area-weighted mean thickness of each layer, with vertex areas $a_i$ on the mid-thickness surface, and divided it by the sum of the six:

$$s_\ell = \frac{\sum_{i \in P} a_i\, t_{i\ell}}{\sum_{k=1}^{6} \sum_{i \in P} a_i\, t_{ik}}$$

where $t_{i\ell}$ is the thickness of layer $\ell$ at vertex $i$. The result is each layer's share of the parcel's thickness, which is also its share of the parcel's volume. A vertex BigBrain masks carries zero in every layer and adds nothing to either sum. Shares are used in place of millimetres because a share does not depend on the shrinkage of the tissue as a whole, which BigBrain's thickness maps do not correct.

A parcel is published where the layers cover at least 50% of its area (`minimum_coverage`). It is carried to this brain's parcel of the same name in the same hemisphere. A parcel of this brain with no namesake on `fsaverage` stops the build. Shares are published in thousandths, rounded by largest remainder so that a parcel's six sum to 1000.

Cortex without six layers is left out by name, whatever the network assigned there: the hippocampal formation's allocortex (HCP-MMP H and PreS; Julich-Brain CA1–3, the dentate gyrus (DG), the subicular complex and the transsubiculum) and the olfactory piriform cortex (HCP-MMP Pir). The entorhinal cortex is kept. Destrieux, Desikan-Killiany and Schaefer name no such parcel.

### Cell density

Cell density in a layer is its cell count $n_\ell$ over the layer's volume in the patch. The volume is the layer's area in the section, $A_\ell$ in µm², times the 20 µm section thickness. The thickness is corrected by the linear shrinkage, the cube root of the datasets' volumetric factor 1.931:

$$\rho_\ell = \frac{n_\ell}{A_\ell \times 20\ \mu\mathrm{m} \times 1.931^{1/3}} \times 10^{6}$$

The datasets' own reports compute it this way, and siibra reproduces them. The unit is cells per (0.1 mm)³, 10⁶ µm³. The datasets' reports write it "0.1mm3", but a cube 0.1 mm on a side is what they compute (about 30 to 100 per layer, or 30,000 to 100,000 cells per mm³). The mean and standard deviation (SD, with $n - 1$ in the denominator) over an area's patches reach the Julich-Brain area of the same name, in both hemispheres, as [receptor fingerprints](receptor-fingerprints.md) do.

### Published file

`cortical-layers.json` holds the shares of 1,220 parcels and the twelve areas' densities. It is 57 kB, 15 kB gzipped.

## Display

**Layers (one histological brain)** sits in the region sheet's **About this region** index for a parcel with shares (Fig. 1c). It is closed at first, and its closed line gives layer IV's share. Opened, it shows a bar in six parts in proportion, layers I to VI, with layer IV in the colour of its paint step. Under the bar a table gives each layer's share to one decimal. For the twelve areas a third column gives cells per (0.1 mm)³ as mean ± SD, with the number of patches below. The note says it is one brain, placed by registration and by parcel name. Links lead to the paper, BigBrainWarp and the area's EBRAINS dataset. The file is downloaded when a cortical region is first shown.

In the **Anatomy** tab, **Paint layer IV across the cortex** colours every parcel of the shown atlas by its layer IV share on one sequential scale, with a key. As for a disorder's paint, a ruled strip in the section names the paint and holds **Restore previous view**, which ends it. Painting ends a connectivity or disorder paint and sets the reader's highlights aside until it ends. Another tab ends it.

The scale has four steps, from 0, 7, 9 and 12%, lilac to deep crimson: sRGB (231, 225, 239), (185, 120, 205), (165, 0, 95) and (80, 0, 28). It was chosen after the shares were measured (per published parcel, n = 1,220: median 8.0%, 90th percentile 10.3%; primary visual cortex, V1, 20–25%) so that area 4, area 3b and V1 fall in different steps (Fig. 1d). Its hue is one that the functions' blue, connectivity's violet and the disorders' blue and orange do not use. Each colour differs from the cortex, deep grey and ventricle tissue colours by an OKLab colour difference (ΔE) of at least 14.5 under normal vision, 12.7 under simulated protanopia and 7.8 under deuteranopia (against the ventricle, seen only on a cut), and from the others by at least 17.1 (Machado 2009, severity 1). Green ramps were measured and rejected: under deuteranopia a middle step fell within ΔE 4 of the cortex or deep grey. Published parcels per step: 332, 528, 314 and 46.

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| Sums | The six shares of every parcel sum to 1 | passes: 1,220 parcels, largest error 4.4 × 10⁻¹⁶ |
| Granular and agranular cortex | On HCP-MMP, in both hemispheres, layer IV's share is smaller in area 4 than in area 3b; if not, the layer is not published | passes: left 8.0% < 9.9%, right 7.2% < 11.7% |
| Primary visual cortex | On HCP-MMP, in both hemispheres, V1's layer IV share is in the highest quarter of areas; if not, the layer is not published | passes: left 20.6% (75th percentile 9.1%), right 24.5% (9.1%) |
| Reproduction | Parcel values reproduce from the pinned files | passes |
| `tests/test_cortical_layers.py` | Unpinned files, a falling scale, a patch pinned twice or also unverified refused; thousandths by largest remainder; the gate fails on a swapped area 4 and 3b or V1 below the top quarter, and on shares not summing to 1; excluded and thinly covered parcels left out; densities by the reports' formula; cells counted in layers 1–6 only | passes |

Every criterion was fixed before the run. Every published parcel's thousandths sum to 1000. V1's layer IV share lies above that of 99.4% of the 175 published HCP-MMP areas on the left, and of 99.4% of the 177 on the right.

Three checks stand behind the reproduction row. Two runs gave the same file. An independent per-vertex recomputation of every HCP-MMP parcel differed by at most 0.7 thousandths (rounding). `brain_model.validate` recomputes the file and the manifest record from the pinned files.

Published parcels by atlas:

| Atlas | Published | Parcels |
| :--- | ---: | ---: |
| Destrieux | 144 | 148 |
| HCP-MMP | 352 | 360 |
| Julich-Brain | 263 | 278 |
| Schaefer | 394 | 400 |
| Desikan-Killiany | 67 | 68 |

Sixteen parcels were left out for cover below 50%, BigBrain's medial-wall mask reaching further on the left. In Destrieux they are the left parahippocampal gyrus and subcallosal gyrus and the right posterior-ventral cingulate gyrus and pericallosal sulcus. In HCP-MMP they are left EC (entorhinal cortex) and PHA1, in Julich-Brain left EC, s24 and 25, in Schaefer six parcels (three in each hemisphere) and in Desikan-Killiany the left parahippocampal region. The other parcels left out are those excluded by name, 6 in HCP-MMP and 12 in Julich-Brain.

Example shares, in thousandths:

| Parcel | I | II | III | IV | V | VI |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| Julich-Brain left area 4a | 123 | 93 | 265 | 86 | 193 | 240 |
| Julich-Brain left hOc1 | 123 | 85 | 233 | 219 | 146 | 194 |
| Desikan-Killiany left precentral | 118 | 100 | 264 | 72 | 194 | 252 |
| Desikan-Killiany left postcentral | 124 | 104 | 260 | 86 | 189 | 237 |
| Desikan-Killiany left pericalcarine | 120 | 93 | 255 | 163 | 166 | 203 |

Mean cells per (0.1 mm)³ in layer IV: area 4a 50 (9 patches), area 44 65 (10), hOc1 98 (10), hOc2 100 (5).

## Limitations

The layers are those of one brain, a man of 65, examined post mortem. Its six layers were segmented by a neural network at 83% per-point accuracy (Wagstyl et al. 2020).

They are another brain's layers, shown at the matching place by registration (BigBrainWarp's `fsaverage` resampling) and by parcel name. Nothing is measured in this brain.

Cortex that has no six layers (hippocampus, olfactory cortex) is left out, as is a parcel BigBrain's layers cover on less than half its area.

Cell densities count every cell body the network detected, not neurons alone, in 5 to 11 patches per area of the same brain. They reach a region only by the name of its Julich-Brain area, and both hemispheres show the same values.

Use is non-commercial and share-alike: BigBrain and the cell datasets are CC BY-NC-SA 4.0.

## Code availability

Code
: [`scripts/fetch_cortical_layers.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/fetch_cortical_layers.py), [`brain_model/layers/cortical_layers.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/cortical_layers.py), [`web/src/lib/core/catalog/cortical-layers.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/catalog/cortical-layers.ts), [`web/src/features/inspector/LayersSection.svelte`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/features/inspector/LayersSection.svelte)

Configuration
: [`config/cortical-layers.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/cortical-layers.yaml); derived counts in [`data/cortical-layer-cells.json`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/cortical-layer-cells.json)

Tests
: [`tests/test_cortical_layers.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_cortical_layers.py), `brain_model.validate`, `web/src/lib/core/catalog/cortical-layers.test.ts`, `web/src/features/inspector/LayersSection.svelte.test.ts`

```bash
uv run python scripts/fetch_cortical_layers.py --record   # patches cached in data/cache/cortical-layers
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_cortical_layers.py
npm test --prefix web
```
