# Functional connectivity

For a selected Julich-Brain area, the region sheet lists the areas whose resting functional magnetic resonance imaging (fMRI) signal correlates most with it, and can paint every area's correlation on the brain (Fig. 1a). The values are a group average of 200 healthy young adults of the Human Connectome Project (HCP; Domhof et al. 2021), measured on Julich-Brain's volumetric map in MNI152 space. Each subject's Pearson correlations were Fisher-z transformed, averaged and transformed back. A [network matrix](#network-matrix), a figure of its own, shows the same dataset's correlations between Schaefer's 200 parcels sorted by Yeo's seven networks (Fig. 2). Nothing is measured in this brain: an area takes the parcel of its name.

```{figure} figures/functional-connectivity-1-light.webp
:alt: Three panels. a, a brain seen from above with Julich-Brain areas painted in three violets by their correlation with left area 4a, which is outlined and unpainted, the darkest violet over both central regions. b, the Functional connectivity section of the area, listing its ten strongest correlations from 0.65 down to 0.46 with a note on the data. c, a histogram of the group correlation of all pairs of areas, with most pairs between 0 and 0.3 and the three steps of the scale marked.
:name: fig-functional-connectivity-1

**An area's group-average correlations are listed and painted, and most pairs of areas correlate weakly.** **a**, [The brain](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=julich&detail=learning&region=julich:left:48&view=superior&internal=0) from above with the Julich-Brain atlas and the internal anatomy hidden, after **Paint on the brain** in the **Functional connectivity** section of left Area 4a (`julich:left:48`, outlined and unpainted). Of the other 277 areas, 11 have $r \ge 0.45$, 46 have $r$ of 0.30–0.45, 111 have $r$ of 0.15–0.30 and 109 lie under the floor of 0.15 and keep their tissue colour. The strongest partner is the area's right homologue ($r$ = 0.65). **b**, The section, with the ten strongest correlations and the strip that names the painted area. **c**, Group $r$ of every pair of Julich-Brain areas (`functional-connectivity.json`; n = 38,503 pairs), in bins of 0.025, coloured by the step of the scale it falls in, with grey under the floor. Dashed lines are the step edges at 0.15, 0.30 and 0.45. The paint is not written to a link, so the link opens the selection and the section's button paints. Values are a group average of 200 people and are not measured in this brain. Scale bars apply at the depth of the camera's target.
```

## Data

| Input | Detail |
| :--- | :--- |
| Dataset | "Atlas based HCP connectomes" v1.2, EBRAINS ([doi:10.25493/3PMM-FPW](https://doi.org/10.25493/3PMM-FPW)), CC BY 4.0. The method paper is Domhof et al. 2021 (PMID 34746628). The data descriptor says HCP's open-access data use terms also apply. The cohort is 200 unrelated HCP S1200 adults aged 22–35 years |
| Matrices | Per subject, `EmpCorrFC_concatenated.csv`: the Pearson correlation coefficient ($r$) between parcel-mean blood-oxygen-level-dependent (BOLD) series of HCP's ICA-FIX resting data, four sessions concatenated, linearly detrended and z-scored, with no global signal regression. There is no group average in the dataset |
| Parcellations | The dataset holds 20, and two of them are Planum's atlases. `150-Destrieux.zip` is FreeSurfer's `destrieux.simple.2009-07-29.gcs` on its MNI subject, cortex only; its rows are the a2009s colour-table indices 1–75 on the left, then the right. `414-Julich-Brain.zip` holds the Julich-Brain 3.1 maximum-probability maps, subcortex included; its row names are in `0ImageProcessing/Link.txt`. Both archives are pinned by SHA-256 in `config/functional-connectivity.yaml`. There are none for HCP-MMP or Schaefer's 400 parcels |
| Network matrix | `200-Schaefer17Networks.zip` of the same dataset (236,535,556 bytes, SHA-256 pinned in `config/functional-connectivity.yaml`): per subject, `EmpCorrFC_concatenated.csv` over Schaefer's 200 parcels, built from the parcellation's FreeSurfer classifier on FreeSurfer's MNI subject, cortex only, dilated by 3 mm, on a 2 mm MNI152 grid (`0ImageProcessing/Modifications.sh`). The dataset has Schaefer's parcels at 100 and 200, in their 17-network versions only |
| Network labels | CBIG's centroid tables of the 200 parcels in their 7- and 17-network versions (`data/schaefer200/`, pinned in `data/sources.json`, MIT) |
| Gaps | Julich-Brain rows 17 (Area PirTB left), 180 and 387 (the ventral posterior medial nucleus, VPM, on both sides) are empty in every subject; the descriptor's "367" is a typo for 387. Area PirT right is empty in one subject (092), so its pairs average 199 subjects |

## Method

`scripts/derive_functional_connectivity.py` read each archive's 200 matrices. It Fisher-z transformed every subject's $r$, averaged each pair over the subjects that have it and transformed the mean back to $r$. A matrix that is not symmetric, a subject count other than 200, or a missing value outside an empty row stops the run. Each atlas was then checked against the validation written into the configuration file on 2026-11-11, before any group value was read. An atlas that fails a check is not written. For each atlas the script also measured the distribution of group $r$ and the share of each seed's ten strongest partners that border it on `fsaverage`, over the rows that are cortical areas of the atlas's `fsaverage` annotation and are not empty.

`brain_model/layers/functional_connectivity.py` matched each row to the atlas's region of the same name and hemisphere. Names were compared as the F-TRACT layer compares them, with case and the spacing after commas ignored: Planum spells right Area MFG5 "(MFG,IFG)". The layer published `functional-connectivity.json`, which holds per atlas the region ids and $r \times 100$, rounded, for each pair once (the upper triangle, row by row). All 278 Julich-Brain areas have a row. The other 136 rows (subcortex, gap maps, empty rows) have no area. The file is 109 kB, 36 kB gzipped.

### Network matrix

A network matrix sorted on Julich-Brain, the atlas the sheet's connectivity uses, was tried first (2026-11-24). Its areas were sorted by the Yeo network covering most of each and checked against a criterion fixed before any value was read: each network's Fisher-z mean correlation within itself, a parcel with itself left out, must exceed its mean with every other network. Four networks of seven met it. Salience / ventral attention (0.21 within, 0.22 with dorsal attention), frontoparietal control (0.22, 0.25) and limbic (0.04, 0.08) did not, and keeping only areas at least half or 70% in one network still left frontoparietal control and limbic short. That matrix was not built. Schaefer's parcels lie each in one Yeo network by construction, as published network matrices are drawn, so the matrix uses them.

The 7- and 17-network versions are the same parcels: each of the 200 17-network centroids matches exactly one 7-network centroid on the same side. Each parcel takes the 7-network name at its centroid, not one read off its 17-network name; 7 of the 16 "ContA" parcels are dorsal attention in the 7-network version. The archive names no rows, so the script numbers the left parcels 1–100 and the right 101–200, the tables' order. That order was checked before use: group $r$ falls with the distance between parcels' centroids (Spearman $\rho$ −0.230), more steeply than under every one of 1,000 random orders (−0.065 to 0.060). A failed check stops the derivation.

The group mean is taken as for the atlases above. Median $r$ is 0.233 (95th percentile 0.511), and 0.58% of the 19,900 pairs are negative. The layer publishes `network-connectivity.json` (70.6 kB, 20.9 kB gzipped), downloaded when the dialog first opens. It holds the parcels in display order (network by network in Yeo's order, left before right, each side in Schaefer's 7-network order), $r \times 100$ for each pair once, each pair of networks' mean to two decimals, the scale and the share of negative pairs.

## Display

The **Functional connectivity** section sits inside the sheet's **Research data** row for a Julich-Brain area (Fig. 1b). It is closed at first, and its closed line adds "resting fMRI". The section lists the ten strongest partners as bars with $r$. Each name carries its hemisphere and selects that area. For left Area 45 the first three partners are Area 44 left ($r$ = 0.58), Area IFS3 left (0.49) and Area 45 right (0.48).

In the **Anatomy** tab, **Paint on the brain** colours every area by its $r$ with the selected one. The selected area keeps its outline and no fill. A ruled strip in the section says whose connectivity the brain shows, with **Restore previous view**, which ends the paint. Another tab, another atlas or a masthead colour also ends or lifts it. The paint is not written to links.

The scale (`r_scale`) is one-sided. Without global signal regression nearly every pair correlates positively: 1.5% of Julich-Brain's cortical pairs are negative. The floor was set from the measured distribution before the colours were built. The median $r$ over Julich-Brain's 38,503 cortical pairs is 0.14 (95th percentile 0.42; Fig. 1c), so the floor is 0.15, the median rounded up to a multiple of 0.05. Half of all pairs therefore stay tissue-coloured, as the key says. The steps lie 0.15 apart: sRGB (217, 198, 254) from 0.15, (146, 116, 195) from 0.30 and (77, 47, 119) from 0.45. Violet keeps the scale apart from the functions' blue. Each step differs from the tissue colour by an OKLab $\Delta E$ (× 100) of at least 14.3 and from the other steps by at least 24.0, under normal vision and simulated protanopia and deuteranopia.

The **Colour** option **Yeo 7 networks** (group **Networks** in the masthead; URL parameter `colors=network`) ends its stage key with **Correlation matrix**, which opens the network matrix in a dialog (Fig. 2). It is the same on CDMD and the MNI template, and nothing in it is measured in either brain. The matrix has one cell a pair, the parcels in display order down and across, network strips in Yeo's colours along both axes and a line at each network's border. Its colour is matplotlib's magma (33 stops of its 256-colour table, within 1.25 of 255 of it everywhere) from 0 to 0.65, the pairs' 99th percentile out to the next 0.05, a rule fixed before any colour was drawn. Values below 0 take the darkest colour, 0.65 and above the lightest, and the diagonal, a parcel with itself, is grey. Pointing at a cell names both parcels (network, Schaefer's own name, side) and their $r$. A table beside it gives each pair of networks' mean correlation, its own block in bold, and is also the matrix's text alternative. Notes say which networks correlate more within themselves than with any other, why limbic does not, that the networks come from other people's scans than these correlations (so the blocks are not the networks finding themselves), and the share of positive pairs. **Save PNG** writes the figure: title, network names and strips, the matrix at 3 pixels a pair, the scale and the sources.

```{figure} figures/functional-connectivity-2-light.webp
:alt: The Correlation matrix dialog on a dark ground. On the left, a square matrix of Schaefer's 200 parcels in magma colours, dark for weak and pale yellow for strong correlation, with coloured strips for Yeo's seven networks along the top and left edges and bright square blocks along the diagonal; a scale from 0 to 0.65 below it. On the right, a seven-by-seven table of mean correlations between networks, the diagonal in bold, then notes, three source links and a Save PNG button.
:name: fig-functional-connectivity-2

**Resting correlations between Schaefer's 200 parcels form blocks along Yeo's seven networks.** The **Correlation matrix** dialog, opened from the stage key of [**Yeo 7 networks**](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&view=left&colors=network). Parcels run down and across network by network in Yeo's order, left hemisphere before right within each, with each network's strip in its stage colour and a line at each border. A cell is the group-mean $r$ of two parcels on magma from 0 to 0.65, and the diagonal, a parcel with itself, is grey. The table gives each pair of networks' Fisher-z mean, its own block in bold. Every network correlates more within itself than with any other except limbic, whose 0.12 is underlined (0.16 with default mode). Values are the group average of 200 healthy young adults (Domhof et al. 2021), and nothing is measured in this brain.
```

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| Destrieux, default-mode | Left `G_cingul-Post-ventral`: a medial prefrontal parcel, and the angular gyrus, in its ten strongest | **fails** |
| Destrieux, motor | Left precentral gyrus: right precentral in its three strongest | passes |
| Julich-Brain, default-mode | Left Area p32: PGa or PGp in its ten strongest | passes (both: 6th and 9th) |
| Julich-Brain, motor | Left Area 4a: right Area 4a in its three strongest | passes (first) |
| Neighbours | Median share of a seed's ten strongest partners that border it on `fsaverage` at most one half | 0.20 on both atlases |
| `brain_model.validate` (`functional_connectivity.validate`) | Published file equals the layer rebuilt from sources | 278 areas, each with a row; 136 rows without an area |
| `tests/test_functional_connectivity.py` | Fisher-z mean over the subjects that have a pair; gaps and missing subjects stop the run; checks pass only on the partners they name; name matching; asymmetric, ragged or failed tables refused; the published file equals the layer output and holds every Julich-Brain area | passes |
| `web/src/lib/core/catalog/functional-connectivity.test.ts` | Partners from either side of a pair; the paint's steps and floor; invalid tables refused; on CDMD left Area 4a's first partner is right Area 4a | passes |

The seed criteria and the neighbour limit were fixed before the run. Destrieux failed its default-mode check: the partners found for the left posterior-ventral cingulate gyrus were the precuneus, calcarine sulcus, parieto-occipital sulcus, right posterior-ventral cingulate, lingual and middle occipital gyri. Destrieux is not published. Its motor check passed, with the postcentral gyrus, the right precentral gyrus and the central sulcus as the three strongest partners of the left precentral gyrus.

Julich-Brain 3.1 maps no posterior cingulate area, so left Area p32 is the default-mode seed on that atlas.

The network matrix was checked against the criterion Julich-Brain failed, fixed again before any Schaefer value was read:

| Network | Parcels | Within | Strongest other | Criterion |
| :--- | ---: | ---: | :--- | :--- |
| Visual | 29 | 0.54 | 0.37 (dorsal attention) | met |
| Somatomotor | 35 | 0.49 | 0.36 (dorsal attention) | met |
| Dorsal attention | 26 | 0.46 | 0.37 (visual) | met |
| Salience / ventral attention | 22 | 0.41 | 0.35 (dorsal attention) | met |
| Limbic | 12 | 0.12 | 0.16 (default mode) | not met |
| Frontoparietal control | 30 | 0.34 | 0.28 (dorsal attention) | met |
| Default mode | 46 | 0.32 | 0.21 (frontoparietal control) | met |

Limbic parcels, in orbitofrontal cortex and the temporal pole where fMRI loses signal, correlate weakly with everything, themselves included. The matrix was published with that known, by the decision of 2026-11-24, and its note says which networks form no block, from the published file.

| Test | Criterion | Result |
| :--- | :--- | :--- |
| Labels (`test_functional_connectivity.py`) | A parcel takes the 7-network name at its centroid; no match, two matches or a change of side stops the run | passes |
| Row order | Rows in the parcels' order fall off with distance; shuffled rows do not; a derived file whose check failed is refused | passes; $\rho$ −0.230 against −0.065 to 0.060 |
| Publication | The published pairs are the derived pairs of the same parcels, network by network and left before right; the block means and the within-network flags are those of the derived $r$ | passes |
| `network-matrix.test.ts` | The published file is read whole and refused when altered; the block means recomputed from its own rounded pairs equal its table within 0.005 | passes |
| `NetworkMatrixDialog.svelte.test.ts` | One download over two openings; each cell drawn in its key colour and the diagonal grey; the pair under the pointer named with its $r$; the table and notes as published; a saved PNG; a failed download said; axe finds nothing | passes |

The neighbour test decides whether the lists skip bordering parcels. Above a median share of one half they would. The median is 0.20 on both atlases (quartiles 0.1–0.3 on Julich-Brain), so the lists keep bordering parcels.

## Limitations

The values are a group average of healthy young adults at rest. They do not describe this brain, and they do not describe a person with a lesion.

A correlation is not a connection: two areas can correlate through a third, or through shared noise.

The values depend on preprocessing. Without global signal regression nearly every pair is positive, so the floor separates the stronger half where zero would not.

An area takes the parcel of its name. The dataset placed Julich-Brain's volumetric map on a 2 mm MNI152 grid, whereas this surface carries the `fsaverage` map.

Destrieux failed its posterior cingulate check and is not published. Whether a different seed should be accepted is an open decision.

The network matrix is drawn on Schaefer's parcels, not on an atlas Planum draws, so a cell cannot be selected on the brain. Its colour scale starts at 0, not at −1, because nearly every pair is positive. Schaefer's parcels were dilated by 3 mm and resampled to 2 mm by the dataset's authors, so neighbouring parcels share some signal.

## Code availability

Code
: [`scripts/derive_functional_connectivity.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/derive_functional_connectivity.py), [`brain_model/layers/functional_connectivity.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/functional_connectivity.py), [`brain_model/layers/network_matrix.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/network_matrix.py), [`web/src/lib/core/catalog/functional-connectivity.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/catalog/functional-connectivity.ts), [`web/src/lib/core/catalog/network-matrix.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/catalog/network-matrix.ts), [`web/src/features/connectivity/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/features/connectivity)

Configuration
: [`config/functional-connectivity.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/functional-connectivity.yaml); derived table in [`data/functional-connectivity.json`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/functional-connectivity.json)

Tests
: [`tests/test_functional_connectivity.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_functional_connectivity.py), `web/src/lib/core/catalog/functional-connectivity.test.ts`, `web/src/lib/core/catalog/network-matrix.test.ts`, `web/src/features/connectivity/NetworkMatrixDialog.svelte.test.ts`, `web/src/features/stage/StageKeys.svelte.test.ts`, `brain_model.validate`

```bash
uv run python scripts/derive_functional_connectivity.py   # archives in data/cache/functional-connectivity
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_functional_connectivity.py
npm test --prefix web
```
