# Disorder effects

For a selected Desikan-Killiany region or FreeSurfer deep structure, the region sheet lists the disorders whose patients differ from controls in that region's cortical thickness or volume, and can paint one disorder's differences on the brain. The values are the ENIGMA consortium's case–control effect sizes, as the ENIGMA Toolbox republishes them (Larivière et al. 2021): groups of hundreds to thousands of people scanned at many sites. Nothing is measured in this brain.

## Data

| Input | Detail |
| :--- | :--- |
| Source | ENIGMA Toolbox repository ([MICA-MNI/ENIGMA](https://github.com/MICA-MNI/ENIGMA)) at commit `b08974b`, `enigmatoolbox/datasets/summary_statistics`; BSD 3-Clause, whose licence ships as `public/models/licenses/ENIGMA-Toolbox-BSD-3-Clause.txt`. Toolbox paper PMID 34194050 |
| Tables | One case–control comparison per disorder and measure, each SHA-256 pinned in `config/disorder-effects.yaml`: cortical thickness on the 68 Desikan-Killiany regions and volume of 16 structures (accumbens, amygdala, caudate, hippocampus, pallidum, putamen, thalamus, lateral ventricle, each side) |
| Disorders | Schizophrenia (thickness PMID 29960671, volume 26033243); bipolar disorder (adults 28461699; bipolar I 26857596); major depressive disorder (adults 27137745; 26122586); obsessive-compulsive disorder (adults 29377733; adults 27609241); ADHD (all ages 31014101; 28219628); autism spectrum disorder (meta-analysis 29145754); 22q11.2 deletion syndrome (29895892; 32046535); left and right temporal lobe epilepsy with hippocampal sclerosis and genetic generalised epilepsy (29365066); Parkinson's disease (34288137). Every PMID was checked against PubMed by its DOI. Three carry errata: van Erp et al. 2016 ([10.1038/mp.2015.118](https://doi.org/10.1038/mp.2015.118)), Boedhoe et al. 2017 ([10.1176/appi.ajp.2016.17310correction](https://doi.org/10.1176/appi.ajp.2016.17310correction), [10.1176/appi.ajp.2017.1742correction](https://doi.org/10.1176/appi.ajp.2017.1742correction)) and Hoogman et al. 2017 ([10.1016/S2215-0366(17)30213-4](https://doi.org/10.1016/S2215-0366(17)30213-4)); which of them the toolbox's tables reflect is not stated |
| Effect size | Cohen's d, patients minus controls, adjusted for intracranial volume (`d_icv`); age, sex and site as each working group modelled them |
| Left out | The toolbox's surface-area tables (one measure keeps the section to one list), the anorexia, antisocial-behaviour, psychosis-risk and schizotypy tables (not documented by the toolbox page), and every subgroup comparison |

## Method

`scripts/fetch_disorder_effects.py` downloads each table at the pinned commit, checks its SHA-256 and reads every row with a d: its region, d rounded to three decimals, and the table's median patient and control counts where it gives them (some write `"1,465"`). A row is significant when its table's false discovery rate stays below 0.05: by the table's own FDR-corrected p where every row has one, otherwise by Benjamini–Hochberg over the table's uncorrected p, `"<0.001"` read as 0.001, which only makes the test more conservative. The SE and CI columns are not used: the OCD and Parkinson's tables give them in millimetres of thickness, not in units of d (Parkinson's left banks of the STS: d −0.104 with a CI of −0.040 to −0.012). A table with neither p on every row, an unknown structure or a region listed twice stops the run. The checks below, fixed in the config, run on the result; the file is written only when all pass.

`brain_model/layers/disorder_effects.py` carries each cortical row to the Desikan-Killiany region of its name and hemisphere and each subcortical row to the aseg structure the config names; a row with no region stops the build. It publishes `disorder-effects.json`: per disorder its names, each measure's paper, counts and population, and its significant differences only, with the 84 regions some table reports. The file is 16 kB, 3 kB gzipped.

## Display

**In disorders** (its closed line counts the disorders) opens closed inside the sheet's **Research data** row for a Desikan-Killiany region, an aseg structure, or a teaching-set unit, which reads the aseg structure it stands for. It lists every significant difference largest first: a swatch in the paint's colour, the disorder over a caption line giving the direction (thinner or thicker, smaller or larger) and the population where the table is narrower than the name, and d at the row's end. Example, left hippocampus: left temporal lobe epilepsy with hippocampal sclerosis −1.73, 22q11.2 deletion syndrome −0.79, schizophrenia −0.43, bipolar I disorder −0.20, and three more.

In Anatomy, a row paints its disorder: every significant difference on the brain, cortex on Desikan-Killiany, which the paint chooses as the reader's atlas. A ruled strip names the painted disorder with its cohort, its paper and **Restore previous view**, which ends the paint. Another tab, another atlas or a masthead colour also ends or lifts it; painting a disorder ends a connectivity paint and the reverse. The paint is not written to links. The lateral ventricles paint only where FreeSurfer's segmentation is shown: the teaching set has no unit for them.

The scale (`d_scale`) has two steps each way, split at Cohen's conventional small effect, 0.2. It was chosen after the significant |d| were measured (median 0.24, 90th percentile 0.47, maximum 1.91) and three steps each way were tried: no six colours stayed apart from the cortex, deep grey and ventricle tissue colours under dichromacy. Thinner or smaller: sRGB (105, 130, 245) below 0.2, (10, 25, 130) from it; thicker or larger: (252, 190, 25) and (175, 90, 0). Each differs from those three tissue colours by an OKLab ΔE of at least 13.0 and from the others by at least 28.2, under normal vision and simulated protanopia and deuteranopia (Machado 2009, severity 1).

## Validation

| Test | Criterion (fixed before the run) | Result |
| :--- | :--- | :--- |
| Left TLE with hippocampal sclerosis | Left hippocampus is the largest volume loss of the 16 structures (Whelan et al. 2018) | passes: d −1.73; right hippocampus −0.20; left thalamus next, −0.84 |
| Right TLE with hippocampal sclerosis | Right hippocampus is the largest volume loss | passes: d −1.91; left hippocampus −0.17; right thalamus −0.73 |
| Schizophrenia | Both hippocampi smaller, both lateral ventricles larger (van Erp et al. 2016) | passes: −0.43, −0.43; +0.35, +0.34 |
| FDR route | Where a table publishes both, Benjamini–Hochberg over its uncorrected p reproduces its own FDR decisions in at least 85% of rows | passes: 87.5% to 100%, median 100% |
| `tests/test_disorder_effects.py` | The table's FDR decides where present, Benjamini–Hochberg otherwise, with `"<0.001"` as its bound and thousands separators read; tables without p, unknown structures and repeated regions stop the run; a check fails when another structure loses more; definitions without both names, with a third colour, a repeated id or a quoted PMID are refused; every row reaches its region and only significant ones are published | passes |
| `web/src/lib/core/catalog/disorder-effects.test.ts` | Rows largest first, a teaching unit reading its structure's; colours by direction and the split; files naming a region no table reports, or a zero d, refused | passes |

Measured counts of significant regions (of 84): schizophrenia 78 (73 smaller), 22q11.2 deletion syndrome 69 (56 larger: its cortex is thicker), bipolar disorder 64, Parkinson's disease 62, left TLE 44, right TLE 36, autism 30, ADHD 16, major depression 15, genetic generalised epilepsy 11, OCD 6.

## Limitations

- Group differences between patients and controls scanned elsewhere, not this brain. Most are small: at d 0.2 the two groups overlap by about 92%, so no difference says anything about one person.
- Medication, illness duration, comorbidity and site differ between cohorts and are only partly adjusted for. ENIGMA's tables are cross-sectional: a difference is not a cause and not a progression.
- Significance is decided within each table; the eleven disorders were not corrected against one another.
- Several tables are narrower than their disorder's name (adults, bipolar I, a meta-analysis), as each row says. The subcortical tables of four disorders give no patient counts.
- Desikan-Killiany is reported per gyrus. A difference in a large region, the superior frontal gyrus, says nothing about where in it.

## Code availability

| | |
| :--- | :--- |
| Code | [`scripts/fetch_disorder_effects.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/fetch_disorder_effects.py), [`brain_model/layers/disorder_effects.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/disorder_effects.py), [`web/src/lib/core/catalog/disorder-effects.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/catalog/disorder-effects.ts) |
| Configuration | [`config/disorder-effects.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/disorder-effects.yaml); derived table in [`data/disorder-effects.json`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/disorder-effects.json) |
| Tests | [`tests/test_disorder_effects.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_disorder_effects.py), `brain_model.validate` |

```bash
uv run python scripts/fetch_disorder_effects.py --record   # tables cached in data/cache/disorder-effects
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_disorder_effects.py
npm test --prefix web
```
