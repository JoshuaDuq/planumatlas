# Disorder effects

For a selected Desikan-Killiany region or FreeSurfer deep structure, the region sheet lists the disorders whose patients differ from controls in that region's cortical thickness or volume, and can paint one disorder's differences on the brain (Fig. 1a,b). The values are the ENIGMA consortium's case–control effect sizes, as the ENIGMA Toolbox republishes them (Larivière et al. 2021): groups of hundreds to thousands of people scanned at many sites. A difference is listed only where it survives a false discovery rate (FDR) of 5% within its own table. Nothing is measured in this brain.

```{figure} figures/disorder-effects-1-light.webp
:alt: Three panels. a, a brain seen from the left with nearly the whole cortex painted dark blue. b, the same view with the cortex hidden, in which the hippocampus is dark blue, the lateral ventricle and pallidum amber and the putamen pale amber. c, the In disorders section of the left hippocampus, listing seven disorders with their effect sizes and a note on the data. A key of the four steps runs under the panels.
:name: fig-disorder-effects-1

**One disorder's case–control differences are painted on the regions they were reported for.** **a**, [The brain](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=desikan&detail=aseg&view=left&region=aseg:left:17) from the left with the Desikan-Killiany atlas and aseg structures, after the Schizophrenia row of **In disorders** was activated for the left hippocampus. Schizophrenia has a significant difference in 78 of the 84 regions, and the cortex is thinner in 66 of them (dark blue for $d \le -0.2$, n = 61; paler blue, n = 5). **b**, [The same](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=desikan&detail=aseg&view=left&region=aseg:left:17&cortex=0) with the cortex hidden. The hippocampus (outlined) is smaller (dark blue), the lateral ventricle is larger (amber), and the left pallidum and putamen are larger by less than 0.2 (paler amber). **c**, The **In disorders** section of the left hippocampus, with the seven disorders that differ there, their Cohen's $d$ for volume, patients minus controls, and the strip that names the painted disorder. The key gives the four steps, split at $\lvert d \rvert = 0.2$. The paint is not written to a link, so each link opens the selection and the row paints. Values are the ENIGMA consortium's, and nothing is measured in this brain. Scale bars apply at the depth of the camera's target.
```

## Data

| Input | Detail |
| :--- | :--- |
| Source | ENIGMA Toolbox repository ([MICA-MNI/ENIGMA](https://github.com/MICA-MNI/ENIGMA)) at commit `b08974b`, `enigmatoolbox/datasets/summary_statistics`; BSD 3-Clause, whose licence ships as `public/models/licenses/ENIGMA-Toolbox-BSD-3-Clause.txt`. Toolbox paper: PubMed identifier (PMID) 34194050 |
| Tables | One case–control comparison per disorder and measure, each SHA-256 pinned in `config/disorder-effects.yaml`: cortical thickness on the 68 Desikan-Killiany regions and volume of 16 structures (accumbens, amygdala, caudate, hippocampus, pallidum, putamen, thalamus, lateral ventricle, each side). The attention-deficit/hyperactivity disorder (ADHD) volume table reports 14 of the 16 and has no lateral ventricle |
| Disorders | Schizophrenia (thickness PMID 29960671, volume 26033243); bipolar disorder (adults 28461699; bipolar I 26857596); major depressive disorder (adults 27137745; 26122586); obsessive-compulsive disorder, OCD (adults 29377733; adults 27609241); ADHD (all ages 31014101; 28219628); autism spectrum disorder (meta-analysis 29145754); 22q11.2 deletion syndrome (29895892; 32046535); left and right temporal lobe epilepsy (TLE) with hippocampal sclerosis and genetic generalised epilepsy (29365066); Parkinson's disease (34288137). Every PMID was checked against PubMed by its digital object identifier (DOI). Three carry errata: van Erp et al. 2016 ([10.1038/mp.2015.118](https://doi.org/10.1038/mp.2015.118)), Boedhoe et al. 2017 ([10.1176/appi.ajp.2016.17310correction](https://doi.org/10.1176/appi.ajp.2016.17310correction), [10.1176/appi.ajp.2017.1742correction](https://doi.org/10.1176/appi.ajp.2017.1742correction)) and Hoogman et al. 2017 ([10.1016/S2215-0366(17)30213-4](https://doi.org/10.1016/S2215-0366(17)30213-4)); which of them the toolbox's tables reflect is not stated |
| Effect size | Cohen's d, patients minus controls, adjusted for intracranial volume (`d_icv`); age, sex and site as each working group modelled them |
| Left out | The toolbox's surface-area tables (one measure keeps the section to one list), the anorexia, antisocial-behaviour, psychosis-risk and schizotypy tables (not documented by the toolbox page), and every subgroup comparison |

## Method

`scripts/fetch_disorder_effects.py` downloaded each table at the pinned commit, checked its SHA-256 and read every row that carries a d. From each row it kept the region and d, rounded to three decimals. From each table it kept the median patient and control counts where the table gives them, reading a thousands separator as part of the count (some tables write `"1,465"`).

A row was called significant where its table's FDR stayed below 0.05. Where every row of a table has an FDR-corrected p, that p decided (15 of the 22 tables). Otherwise the Benjamini–Hochberg procedure was run over the table's uncorrected p (7 tables; SciPy 1.18.1, `scipy.stats.false_discovery_control`, method `bh`). A p written `"<0.001"` was read as 0.001, which only makes the test more conservative. The standard error (SE) and confidence interval (CI) columns were not used, because the OCD and Parkinson's disease tables give them in millimetres of thickness, not in units of d (Parkinson's disease, left banks of the superior temporal sulcus: d −0.104 with a CI of −0.040 to −0.012).

A table with neither p on every row, an unknown structure or a region listed twice stops the run. The checks fixed in the config, listed under Validation, ran on the result. The derived table `data/disorder-effects.json` was written only once all had passed. The script also copied the ENIGMA Toolbox repository's licence, after checking its SHA-256, to the published licences.

At build, `brain_model/layers/disorder_effects.py` carried each cortical row to the Desikan-Killiany region of its name and hemisphere, and each subcortical row to the structure of FreeSurfer's `aseg` segmentation that the config names. A row with no region stops the build. The module published `disorder-effects.json`. For each disorder the file holds its names, each measure's paper, counts and population, and its significant differences only. It also lists the 84 regions that some table reports. The file is 16 kB, 3 kB gzipped.

## Display

**In disorders** sits inside the sheet's **Research data** row and starts closed (Fig. 1c). It appears only for a region that some table reports: a Desikan-Killiany region, one of the 16 `aseg` structures, or a teaching-set unit, which reads the `aseg` structure it stands for. Its closed line counts the disorders. Opened, it lists every significant difference largest first. Each row has a swatch in the paint's colour, the disorder over a caption line, and d at the row's end. The caption gives the direction (thinner or thicker, smaller or larger) and the population where the table is narrower than the name. For the left hippocampus the list reads: left temporal lobe epilepsy with hippocampal sclerosis −1.73, 22q11.2 deletion syndrome −0.79, schizophrenia −0.43, bipolar I disorder −0.20, and three more.

In **Anatomy**, a row paints its disorder: every significant difference is coloured on the brain. The cortex is painted on Desikan-Killiany, which the paint chooses as the reader's atlas. A ruled strip names the painted disorder with its cohort, its paper and **Restore previous view**, which ends the paint. The cohort is left out where the table lacks either its patient count or its control count. Another tab or another atlas also ends the paint, and a masthead colour lifts it. Painting a disorder ends a connectivity paint and the reverse. The paint is not written to links. The lateral ventricles paint only where FreeSurfer's segmentation is shown: the teaching set has no unit for them.

The scale (`d_scale`) has two steps each way, split at Cohen's conventional small effect, 0.2. It was chosen after the significant |d| were measured (median 0.24, 90th percentile 0.47, maximum 1.91; n = 431 differences; Fig. 2) and three steps each way were tried. No six colours stayed apart from the cortex, deep grey and ventricle tissue colours under dichromacy. Thinner or smaller differences take sRGB (105, 130, 245) where |d| is below 0.2 and (10, 25, 130) where it is 0.2 or more. Thicker or larger differences take (252, 190, 25) and (175, 90, 0) on the same split. Each differs from those three tissue colours by an OKLab ΔE of at least 13.0 and from the others by at least 28.2, under normal vision and simulated protanopia and deuteranopia (Machado 2009, severity 1).

```{figure} figures/disorder-effects-2-light.webp
:alt: A dot plot with one row per disorder and Cohen's d on the horizontal axis. Most dots lie between minus 0.6 and 0, schizophrenia and the epilepsies reach further left, and 22q11.2 deletion syndrome spreads to both sides. Dots are coloured in two blues below zero and two ambers above.
:name: fig-disorder-effects-2

**Most published differences are below 0.5 in magnitude, and every disorder but one shows mostly thinner cortex or smaller structures.** Every significant case–control difference of `disorder-effects.json` (n = 431, Cohen's $d$, patients minus controls), by disorder, with the number of differences beside each row. Of the 431, 346 are negative and 91% have $\lvert d \rvert < 0.5$ (median $\lvert d \rvert$ 0.24). In 22q11.2 deletion syndrome 56 of 69 are positive. Each dot is one Desikan-Killiany region or aseg structure. Colours are the viewer's four steps, and the dashed lines mark $d = \pm 0.2$, where the steps divide. Differences that did not survive a false discovery rate of 5% within their own table are not published and are not drawn.
```

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| Left TLE with hippocampal sclerosis | Left hippocampus is the largest volume loss of the 16 structures (Whelan et al. 2018) | passes: d −1.73; right hippocampus −0.20; left thalamus next, −0.84 |
| Right TLE with hippocampal sclerosis | Right hippocampus is the largest volume loss | passes: d −1.91; left hippocampus −0.17; right thalamus −0.73 |
| Schizophrenia | Both hippocampi smaller, both lateral ventricles larger (van Erp et al. 2016) | passes: −0.43, −0.43; +0.35, +0.34 |
| FDR route | Where a table publishes both, Benjamini–Hochberg over its uncorrected p reproduces its own FDR decisions in at least 85% of rows | passes: 87.5–100%, median 100% (n = 13 tables) |
| `tests/test_disorder_effects.py` | The reading, significance and refusal rules under Method hold on constructed tables and on the published file | passes |
| `web/src/lib/core/catalog/disorder-effects.test.ts` | Rows largest first, a teaching unit reading its structure's; colours by direction and the split; files naming a region no table reports, or a zero d, refused | passes |
| `web/src/features/inspector/inspector.svelte.test.ts` INSP-54 | The left hippocampus lists 7 disorders largest first in a section that starts closed; a row paints its disorder; the strip gives the paper and **Restore previous view**; another tab offers no paint | passes |
| `brain_model.validate` | The published file equals the assignment recomputed from the manifest's regions; the shipped licence has its pinned SHA-256 | passes |

The first four criteria were fixed in `config/disorder-effects.yaml` (`validation`) before the derivation was written, and the derivation stops when one fails. The two epilepsy values had been measured on these tables on 2026-11-12, before anything was built.

`tests/test_disorder_effects.py` checks each rule on its own. The table's FDR decides where present and Benjamini–Hochberg otherwise, with `"<0.001"` as its bound and thousands separators read. Tables without p, unknown structures and repeated regions stop the run. A check fails when another structure loses more. Definitions without both names, with a third colour, a repeated id or a quoted PMID are refused, as is derived data with a failed check. Every row reaches its region, a row without one stops the build, and only significant rows are published.

Of the 84 reported regions, those with a significant difference number 78 in schizophrenia (73 smaller), 69 in 22q11.2 deletion syndrome (56 larger, 50 of them cortical regions that are thicker), 64 in bipolar disorder, 62 in Parkinson's disease, 44 in left TLE, 36 in right TLE, 30 in autism, 16 in ADHD, 15 in major depression, 11 in genetic generalised epilepsy and 6 in OCD. `brain_model.validate` writes each disorder's count, with how many of its differences are smaller and how many larger, to `validation.json` (`disorder_effects`).

## Limitations

The values are group differences between patients and controls scanned elsewhere, not measurements of this brain. Most are small: at d 0.2 the two groups overlap by about 92%, so no difference says anything about one person.

Medication, illness duration, comorbidity and site differ between cohorts and are only partly adjusted for. ENIGMA's tables are cross-sectional: a difference is not a cause and not a progression.

Significance is decided within each table. The eleven disorders were not corrected against one another.

Several tables are narrower than their disorder's name. Each row of the list names the population of an adult table or of the bipolar I table. The autism tables are a meta-analysis, which the rows do not say. Three tables give no patient count: the subcortical tables of schizophrenia and bipolar I disorder and the cortical table of 22q11.2 deletion syndrome. Of these three, the schizophrenia and 22q11.2 tables give no control count either.

Desikan-Killiany is reported per gyrus. A difference in a large region, such as the superior frontal gyrus, says nothing about where in it.

## Code availability

Code
: [`scripts/fetch_disorder_effects.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/fetch_disorder_effects.py), [`brain_model/layers/disorder_effects.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/disorder_effects.py), [`web/src/lib/core/catalog/disorder-effects.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/catalog/disorder-effects.ts)

Configuration
: [`config/disorder-effects.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/disorder-effects.yaml); derived table in [`data/disorder-effects.json`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/disorder-effects.json)

Tests
: [`tests/test_disorder_effects.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_disorder_effects.py), `web/src/lib/core/catalog/disorder-effects.test.ts`, `web/src/features/inspector/inspector.svelte.test.ts`, `brain_model.validate`

```bash
uv run python scripts/fetch_disorder_effects.py --record   # tables cached in data/cache/disorder-effects
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_disorder_effects.py
npm test --prefix web
```
