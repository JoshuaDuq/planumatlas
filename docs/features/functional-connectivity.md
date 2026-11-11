# Functional connectivity

For a selected Julich-Brain area, the region sheet lists the areas whose resting fMRI signal correlates most with it, and can paint every area's correlation on the brain. The values are a group average of 200 healthy young adults (Domhof et al. 2021), measured on Julich-Brain's volumetric map in MNI152 space. Nothing is measured in this brain: an area takes the parcel of its name.

## Data

| Input | Detail |
| :--- | :--- |
| Dataset | "Atlas based HCP connectomes" v1.2, EBRAINS ([doi:10.25493/3PMM-FPW](https://doi.org/10.25493/3PMM-FPW)), CC BY 4.0; method paper Domhof et al. 2021 (PMID 34746628). The data descriptor says HCP's open-access data use terms also apply. 200 unrelated HCP S1200 adults aged 22–35 |
| Matrices | Per subject, `EmpCorrFC_concatenated.csv`: the Pearson r between parcel-mean BOLD series of HCP's ICA-FIX resting data, four sessions concatenated, linearly detrended and z-scored, with no global signal regression. There is no group average in the dataset |
| Parcellations | 20 in the dataset; two are Planum's atlases. `150-Destrieux.zip` (FreeSurfer's `destrieux.simple.2009-07-29.gcs` on its MNI subject, cortex only; rows are the a2009s colour-table indices 1–75 on the left, then the right) and `414-Julich-Brain.zip` (Julich-Brain 3.1 maximum-probability maps, subcortex included; row names in `0ImageProcessing/Link.txt`). Both SHA-256 pinned in `config/functional-connectivity.yaml`. There are none for HCP-MMP or Schaefer's 400 parcels |
| Gaps | Julich rows 17 (Area PirTB left), 180 and 387 (VPM, both sides) are empty in every subject; the descriptor's "367" is a typo for 387. Area PirT right is empty in one subject (092), so its pairs average 199 |

## Method

`scripts/derive_functional_connectivity.py` reads each archive's 200 matrices, Fisher-z transforms every subject's r, averages each pair over the subjects that have it and transforms back. A matrix that is not symmetric, a subject count other than 200, or a missing value outside an empty row stops the run. Each atlas is then checked against the validation written into the config on 2026-11-11, before any group value was read; an atlas failing a check is not written.

`brain_model/layers/functional_connectivity.py` matches each row to the atlas's region of the same name and hemisphere, comparing names as the F-TRACT layer does (spacing after commas and case ignored: Planum spells right Area MFG5 "(MFG,IFG)"). It publishes `functional-connectivity.json`: per atlas the region ids and r × 100, rounded, for each pair once (the upper triangle, row by row). All 278 Julich-Brain areas have a row; 136 rows (subcortex, gap maps, empty) have no area. The file is 109 kB, 36 kB gzipped.

## Display

**Functional connectivity** (its closed line adds "resting fMRI") opens closed inside the sheet's **Research data** row for a Julich-Brain area. It lists the ten strongest partners as bars with r, each name with its hemisphere and selecting that area. Example: left Area 45: Area 44 left 0.58, Area IFS3 left 0.49, Area 45 right 0.48.

In Anatomy, **Paint on the brain** colours every area by its r with the selected one; the selected area keeps its outline and no fill. A ruled strip in the section says whose connectivity the brain shows, with **Restore previous view**, which ends the paint. Another tab, another atlas or a masthead colour also ends or lifts it. The paint is not written to links.

The scale (`r_scale`) is one-sided: without global signal regression nearly every pair correlates positively (1.5% of Julich-Brain's cortical pairs are negative). Its floor was set from the measured distribution before the colours were built: the median r over Julich-Brain's 38,503 cortical pairs is 0.14 (95th percentile 0.42), so the floor is 0.15 and half of all pairs stay tissue-coloured, as the key says. Steps every 0.15: sRGB (217, 198, 254) from 0.15, (146, 116, 195) from 0.30, (77, 47, 119) from 0.45. Violet keeps it apart from the functions' blue; each step differs from the tissue colour by an OKLab ΔE of at least 14.3 and from the others by at least 24.0, under normal vision and simulated protanopia and deuteranopia.

## Validation

| Test | Criterion (fixed before the run) | Result |
| :--- | :--- | :--- |
| Destrieux, default-mode | Left `G_cingul-Post-ventral`: a medial prefrontal parcel, and the angular gyrus, in its ten strongest | **fails**: precuneus, calcarine sulcus, parieto-occipital sulcus, right posterior-ventral cingulate, lingual and middle occipital gyri. Destrieux is not published |
| Destrieux, motor | Left precentral gyrus: right precentral in its three strongest | passes (postcentral, right precentral, central sulcus) |
| Julich-Brain, default-mode | Julich-Brain 3.1 maps no posterior cingulate area, so left Area p32: PGa or PGp in its ten strongest | passes (both: 6th and 9th) |
| Julich-Brain, motor | Left Area 4a: right Area 4a in its three strongest | passes (first) |
| Neighbours | Median share of a seed's ten strongest partners that border it on `fsaverage`; above one half, lists would skip bordering parcels | 0.20 on both atlases (quartiles 0.1–0.3 on Julich-Brain): lists keep them |
| `tests/test_functional_connectivity.py` | Fisher-z mean over the subjects that have a pair; gaps and missing subjects stop the run; checks pass only on the partners they name; name matching; asymmetric, ragged or failed tables refused; the published file equals the layer output and holds every Julich-Brain area | passes |
| `web/src/lib/core/catalog/functional-connectivity.test.ts` | Partners from either side of a pair; the paint's steps and floor; invalid tables refused; on CDMD left Area 4a's first partner is right Area 4a | passes |

## Limitations

- A group average of healthy young adults at rest, not this brain, and not a person with a lesion.
- A correlation is not a connection: two areas can correlate through a third, or through shared noise.
- Values depend on preprocessing. Without global signal regression nearly every pair is positive, so the floor, not zero, separates the stronger half.
- An area takes the parcel of its name: the dataset placed Julich-Brain's volumetric map on a 2 mm MNI152 grid, whereas this surface carries the `fsaverage` map.
- Destrieux failed its posterior cingulate check and is not published; whether a different seed should be accepted is an open decision.

## Code availability

| | |
| :--- | :--- |
| Code | [`scripts/derive_functional_connectivity.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/derive_functional_connectivity.py), [`brain_model/layers/functional_connectivity.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/functional_connectivity.py), [`web/src/lib/core/catalog/functional-connectivity.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/catalog/functional-connectivity.ts) |
| Configuration | [`config/functional-connectivity.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/functional-connectivity.yaml); derived table in [`data/functional-connectivity.json`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/functional-connectivity.json) |
| Tests | [`tests/test_functional_connectivity.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_functional_connectivity.py), `brain_model.validate` |

```bash
uv run python scripts/derive_functional_connectivity.py   # archives in data/cache/functional-connectivity
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_functional_connectivity.py
npm test --prefix web
```
