# Functions

The **Functions** tab paints where studies of a cognitive function consistently report activation. Each of 70 curated functions is one Neurosynth version 7 abstract term, whose meta-analytic consistency map was averaged over every HCP-MMP1.0 (Human Connectome Project multimodal parcellation) area and over 19 FreeSurfer grey-matter structures. An area or structure belongs to a function when its mean $z$ reaches 3. A search offers 277 further terms derived the same way. The maps describe healthy-group activation literature, not this brain and not the effect of a lesion.

```{figure} figures/functions-1-light.webp
:alt: Three panels. a, a brain seen from the left with HCP-MMP areas painted in three blues for the language map, above a key of three z bands. b, the profile of the function, with its study count, a Linked MRI button and a list of areas ranked by z. c, the same view with areas painted in eleven function colours, above a key of the eleven functions.
:name: fig-functions-1

**A function is a consistency map averaged per area, thresholded at z = 3 and ranked.** **a**, [Language](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=hcp-mmp&detail=learning&view=left&tab=functions&function=language) (Neurosynth term "language", 1,101 studies) on HCP-MMP areas, seen from the left. The 95 areas with $z \ge 3$ are drawn in the three bands of the key, and tissue-coloured areas fall below 3. **b**, The profile, with the evidence line and its study count, **Linked MRI** and the strongest areas with their mean $z$ (area 44 left 19.7, IFSp left 19.4). The lesion checks and the caveats follow below the part shown. **c**, [**All functions**](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=hcp-mmp&detail=learning&view=left&tab=functions&function=all), in which each area takes the colour of its strongest overview function, measured as a share of each function's own cortical maximum. The cortex stays opaque although the paint includes deep structures, which the profile's **Show *n* deep structures** shows. CDMD `sub_013`, teaching-set internal anatomy. Scale bars apply at the depth of the camera's target.
```

## Data

| Input | Detail |
| :--- | :--- |
| Neurosynth database | Version 7, abstract terms (Yarkoni et al. 2011; [references](../reference/references.md#bibliography)). Fetched by `nimare.extract.fetch_neurosynth(version="7", source="abstract", vocab="terms")` into `data/cache/neurosynth`. The four files are recorded by sha256 under `derivation.files` of each score table. |
| Software | NiMARE 0.22.1, Nilearn 0.13.1, NumPy 2.4.6, SciPy 1.18.1 (curated table). The full term table used NumPy 2.4.2 and SciPy 1.18.1 on the Rorqual cluster. |
| Surfaces | CBIG's registration-fusion mapping (RF-ANTs) `{lh,rh}.avgMapping_allSub_RF_ANTs_MNI152_orig_to_fsaverage.mat` (Wu et al. 2018; MIT; commit `5bdb7f5`, pinned by sha256, cached in `data/cache/registration-fusion`); `data/fsaverage/label/{lh,rh}.HCPMMP1.annot` (180 areas per hemisphere) |
| Structures | SynthSeg's segmentation of TemplateFlow `MNI152NLin6Asym` (1 mm T1-weighted image pinned in `config/coordinate-spaces.yaml`), cached as `data/cache/neurosynth/mni152nlin6asym-synthseg.nii.gz` and recorded by sha256: 19 aseg labels (cerebellar cortex, thalamus, caudate, putamen, pallidum, hippocampus, amygdala, accumbens and ventral diencephalon on each side, plus the brainstem) |
| Curated scores | `data/neuropsych-domains/area-scores.json` (3.41 MB): 70 terms × 360 areas and 19 structures, and × the parcels of Destrieux, Julich-Brain and Schaefer |
| Term scores | `data/neurosynth-terms/term-scores.json` (10.2 MB): all 3,228 abstract terms, rounded to 4 decimals; `data/neurosynth-terms/atlas-term-scores.json` (1.98 MB): the 347 chosen terms × 278 Julich-Brain and 400 Schaefer parcels |
| Published (CDMD) | `neuropsych-domains.json` (1.09 MB, 78 kB gzipped); `neurosynth-terms.json` (1.97 MB, 157 kB gzipped), written only by anatomies that declare `neurosynth_terms` in `config/model.yaml` |

Licence: Open Database License (ODbL) 1.0; derived scores are shared under the same licence ([licence](../reference/references.md#open-database-license-neuropsych-domainsjson)).

## Method

### Term choice

`config/neuropsych-domains.yaml` lists 70 functions in six groups. Each function has one Neurosynth term, English and French names, an sRGB colour, an `overview` flag and optional `lesion_checks`. Eleven terms rest on fewer than 100 studies: smell and sustained attention (74), navigation (77), taste (80), interoception (81), verbal fluency (84), gestures (85), object recognition (86), moral reasoning (87), arithmetic (96) and speech perception (97). Every profile states its study count. Consciousness (74 studies) was derived and left out: its map reached two areas, right MT at $z$ 3.3 and the left fusiform face complex at 3.1, and no structure. Lesion checks are reported and are never used to tune a map.

### Consistency maps

`scripts/derive_domain_scores.py` processed each term in three steps:

1. It selected the studies whose abstract uses the term at a TF-IDF (term frequency–inverse document frequency) of at least 0.001 (`get_studies_by_label`). All other studies formed the comparison set.
2. It fitted NiMARE's `MKDAChi2(kernel__r=6)`, the multilevel kernel density analysis (MKDA) chi-square test with a 6 mm kernel.
3. It kept `z_desc-uniformity`, Neurosynth's uniformity (consistency) test.

Four terms were fitted in parallel (fork pool). The script stops if the database lacks a term.

### Area and structure means

NiMARE fits every map on FSL's MNI152 (TemplateFlow `MNI152NLin6Asym`, 2 mm). Areas and structures were both read in that template's own frame.

For the areas, `area_means` read the map through registration fusion, RF-ANTs (Wu et al. 2018). CBIG's published mapping, pinned to a commit and checked by checksum, gives each `fsaverage` vertex's MNI152 coordinate at mid-thickness, averaged over the ANTs registrations of 1,490 Brain Genomics Superstruct Project (GSP) subjects. The map was interpolated linearly at that coordinate, as CBIG's `CBIG_RF_projectVol2fsaverage_single` does, and averaged over the vertices of each HCP-MMP area (names ending `_ROI`; 360 in all). The authors recommend this mapping for projecting published MNI152 results to `fsaverage`.

For the structures, `structure_means` resampled the map (continuous interpolation) onto SynthSeg's segmentation of the 1 mm template and averaged it per aseg label. The segmentation used the recipe the coordinate spaces were scored with (`--parc --robust`, FreeSurfer 8.2). Carried onto CDMD, that recipe's reading of this template met CDMD's aseg at Dice 0.88–0.93 for the thalamus, caudate, putamen, pallidum, hippocampus and amygdala. The first run segments the template, and later runs read it from the cache.

Until 2026-11-09, areas were sampled between `fsaverage`'s white and pial surfaces and structures on `fsaverage`'s `aseg.mgz`. Both are in MNI305, which lies about 1.9 mm from MNI152 (FreeSurfer's `mni152.register.dat`), and nothing corrected for the difference.

### Membership and order

`neuropsych_domains.assign` adds a cortical HCP-MMP region or a sampled aseg structure to every function whose mean $z \ge 3$ (`threshold_z`). In the published file a region's functions are ordered by strength. Strength is $z / z_{\max}$, where $z_{\max}$ is the function's own cortical maximum. Raw $z$ grows with a term's study count, so it would hand every shared area to the largest literature. Structures are divided by the same cortical maximum, so adding them changes no area's order. The overview paint reads this order. The viewer's list of a region's functions is ordered by raw $z$ instead, an order chosen by the measurement reported under [Validation](#validation).

On CDMD, 278 of 360 areas and 16 of 19 structures reach at least one function. The left and right cerebellar cortex and the brainstem reach none. Language, for example, reaches 95 areas (Fig. 1a). A function's profile lists its areas and structures by mean $z$, highest first (Fig. 1b).

### Overview

Eleven functions carry `overview: true`: executive functions, working memory, long-term (episodic) memory, language, attention, visuospatial abilities, social cognition, visual perception, motor, auditory perception and emotion. In **All functions**, each area takes the overview function with the largest $z / z_{\max}$ (Fig. 1c). With these eleven, 120 of 360 areas reach none. With the first seven alone, 189 would. Other functions overlap these (reading within language) and are shown one at a time.

### Parcel means on other atlases

The same vertex values were also averaged over each parcel of Julich-Brain 3.1, Schaefer 2018 (400 parcels) and Destrieux on `fsaverage` (`atlas_scores` in the score table). A parcel's mean depends on its size, so each atlas was measured against the unparcellated map before its regions list functions. For each of the 11 overview functions, `scripts/measure_region_functions.py` computed the area-weighted Dice on the `fsaverage` pial surface between the atlas's parcels at mean $z \ge 3$ and the vertices whose own $z \ge 3$. The bar, fixed before the run, was a median Dice no more than 0.1 below HCP-MMP's, with every overview function reaching some parcel. Julich-Brain and Schaefer met it, and their regions list their own atlas's functions (`region_atlases`). Destrieux did not, and Desikan-Killiany was not measured, so their regions list functions by share instead.

### Shares on Destrieux and Desikan-Killiany

Destrieux and Desikan-Killiany regions (`share_atlases`) list functions without a parcel mean of their own. Each function or searched term is listed with the share of the region's `fsaverage` mid-thickness area that lies in HCP-MMP areas reaching it at $z \ge 3$, and with the $z$ averaged over that share (`share_regions` in `neuropsych-domains.json`, `shares` in `neurosynth-terms.json`). Shares under 5% (`share_floor`) are not listed, so a sliver of a neighbouring area names nothing. Shares saturate in small regions: Heschl's gyrus lies wholly in areas that auditory perception, music, speech perception and language all reach. The list is therefore ordered by share times $z$, which is the region's mean $z$ with areas below the threshold counted as zero. On each atlas's nearest parcel to the five cortical test regions (area 44, p9-46v, area 4, FFC and V1; measured 2026-11-23), share times $z$ put the expected function first in 8 of 10 and in the first three in all 10. Share then $z$ managed 6 of 10, and $z$ alone 5, missing the first three twice. The median region lists 16 functions on Destrieux and 19 on Desikan-Killiany; 11 Destrieux and 3 Desikan-Killiany regions list none. Only HCP-MMP scores that passed the bar are read, and nothing is painted from these lists: a function opened from one of these regions paints on HCP-MMP.

### Teaching units

Eight teaching-set units per side (16) are drawn with one aseg structure's score: caudate, putamen, external and internal pallidum (both from Pallidum), accumbens, thalamus, hippocampus and amygdala. `validate_learning` requires at least half of each unit's voxels (`minimum_share` = 0.5) to lie inside that structure on CDMD. The accumbens has the lowest shares (0.565 right, 0.601 left). All other units are at 0.843 or more. The ventral diencephalon is one FreeSurfer label over many nuclei, so no unit carries its score. NextBrain's finer nuclei are not scored.

### Lesion checks

Of the 70 functions, 44 name lesion associations from `data/neuropsychology.yaml`. For each Destrieux parcel an association maps, `lesion_checks` reports the share of the parcel's `fsaverage` vertices whose HCP-MMP area belongs to the function. The parcel name is checked against `fsaverage`'s `aparc.a2009s` annotation, and a mismatch fails the build. For an aseg structure, the check reports 1 or 0 for whether the function reaches it. For any other region it reports `null` (not measured). For example, language's `aphasia-comprehension` check colours 76.1% of the left middle temporal gyrus (`G_temporal_middle`).

### Colours

Colours distinguish functions and are not a published palette. Distances are OKLab $\Delta E$ (× 100), computed in normal vision and in protanopia and deuteranopia simulated after Machado et al. (2009) at severity 1. Unless a condition is named, each value below is the minimum over the three.

Any two overview functions differ by at least 11.3. Overview functions whose areas share an `fsaverage` edge differ by at least 11.6. That minimum is the pair emotion and auditory perception under simulated deuteranopia: on the current scores left areas PoI2 and Pir (emotion) border left PoI1 (auditory perception). Every other bordering pair differs by at least 14.1. Any function outside the overview differs from the cortex tissue colour (196, 168, 151) by at least 15.9 in normal vision and 8.2 under simulated deficiency.

A single function or term is drawn on one blue scale (`z_scale`): sRGB (150, 200, 240) from $z$ 3, (43, 131, 199) from 5 and (10, 62, 125) from 10. The bands are at least 21.6 apart and at least 11.8 from tissue.

### Term search

`scripts/derive_term_scores.py` repeated the map and averaging steps for all 3,228 abstract terms, reusing `derive_domain_scores.consistency_on_atlases`. It ran on 2026-11-09 as a Slurm array on the Rorqual cluster: 16 tasks of 48 CPUs, 13–15 min each (3 h limit), then a merge job with limits of 30 min and 8 GB. It ran again on 2026-11-11 to add each term's mean per Julich-Brain and Schaefer parcel (16 tasks, 13–17 min each). That run wrote into a fresh output folder, named as the submit script's fourth argument (`scripts/derive_term_scores_submit_rorqual.sh 16 48 4 <folder>`). Its HCP-MMP and structure table came out byte-identical to the first run's. The submit script reads the Slurm account and the cluster work directory from the environment variables `SLURM_ACCOUNT` and `NEUROSYNTH_TERMS_WORK`. The registration-fusion mapping and the template segmentation were copied to the cluster and are checked there by the same checksums. Each fork used one BLAS (Basic Linear Algebra Subprograms) thread with `FLEXIBLAS=OPENBLAS`, because FlexiBLAS's default AOCL backend segfaults in Nilearn's coordinate transform of a whole `fsaverage` surface. For the 70 curated terms, the table reproduces the curated scores within $5 \times 10^{-5}$, the rounding limit, with identical study counts and the same input checksums.

Most of the vocabulary is report, anatomy or method words, so `config/neurosynth-terms.yaml` is an explicit allow-list of 302 `functions` (70 of them curated) and 45 `populations` (clinical groups). Both lists must be sorted and unique, and no term may be in both. `neurosynth_terms.partition` publishes each chosen term with its kind, study count and regions at $z \ge 3$, highest first. A term the curated functions use, or whose map reaches nothing, is not offered. On CDMD, 232 functions and 45 populations are offered.

## Display

Choosing the **Functions** tab opens its list: **All functions** first, then the 70 curated functions under their groups. Where the selected region's atlas lists functions, that region's functions lead the list. Nothing is painted until a row is chosen. **All functions** lists the eleven overview functions in their colours, each opening its own map. The URL key `tab=functions` opens the tab as the link wrote it. The key `function` holds `all`, a curated id (e.g. `language`), `term:<term>` or `compare:<a>,<b>`.

A single function or term paints each area and structure in its $z$ band (`domainPaint`, `zBand`). A teaching unit takes its structure's colour. The structures are drawn on the teaching set unless FreeSurfer's segmentation is the internal anatomy shown. The cortex stays opaque, so each area's colour reads as its band. When the paint colours both areas and drawn deep structures, the profile's **Show *n* deep structures** button hides the cortex and frames the structures. **Show the cortex** brings the cortex back and frames the whole brain. Under the **T1 MRI** colour, which shows the registered T1-weighted magnetic resonance imaging (MRI) scan in greyscale, the paint is drawn over the scan. The scan shows wherever nothing is painted, and the key says so. The profile's **Linked MRI** opens the [linked MRI](linked-mri.md) at the strongest area, with the paint over the planes.

The profile labels the map "Activation evidence" with its term and study count, and lists the 12 strongest areas (`AREAS_SHOWN`), then the lesion checks (Fig. 1b). Notes at its end state that the map is neither this brain nor what damage would impair, and that consistency does not mean a region serves only that function, and give the method and sources. Searched and population terms carry their own caveats. A population term links to matching Deficits profiles.

Under the stage line of one function or searched term, **Paint areas from z ≥** raises the paint threshold from 3 in steps of 0.5, up to the strongest area's $z$ rounded down to a step. It changes the paint, the stage key (a band nothing then carries is outlined) and the stage line's count. The area list, the lesion checks and every region's list keep the published $z \ge 3$. A link carries the threshold as `zmin=`. The threshold does not go below 3: no fourth, lighter colour passes the scale's own checks (OKLab $\Delta E$ ≥ 11.8 from the tissue colour and ≥ 20 from the 3–5 band, under normal vision and simulated protanopia and deuteranopia). The overview and comparisons keep 3.

A profile ends with a link to its term's page on neurosynth.org (`https://neurosynth.org/analyses/terms/<term>/`), built from the Neurosynth term and never from the display name. The site's uniformity-test map is the one closest to Planum's. The site thresholds it at an expected false discovery rate (FDR) of 0.01, whereas Planum paints the unthresholded map averaged per area, so the two differ. The site uses the same 14,371 studies but offers 1,334 of the 3,228 terms. It answers HTTP 200 for a term it does not have, and only the page title says so. `scripts/check_neurosynth_pages.py`, run by hand, reads each title and writes the terms without a page to `neurosynth_org_missing` in `config/neurosynth-terms.yaml`. On 2026-11-10 these were 4 of the 70 curated terms (emotion, numerical, scenes, skill) and 11 of the 277 offered terms. Their profiles show no link. The build never calls the site.

With a region selected and the search empty, the list opens with **Reported here**: the curated functions the region reaches at $z \ge 3$, highest $z$ first. Eight are shown and the rest wait behind **Show all N**. A note follows that activation there does not make the region specific to them. For a Destrieux or Desikan-Killiany region the group gives each function's share under a **Share** column. The region sheet's **Neuropsychological functions** uses the same order and cap.

A curated function, or the overview, opened while Julich-Brain or Schaefer is the atlas paints that atlas's own areas from the same table, and the atlas stays the reader's. The profile then lists and counts that atlas's areas, and its lesion checks say they are measured on HCP-MMP. A searched term does the same from its own table there (`atlases` in `neurosynth-terms.json`: the parcels each offered term reaches at $z \ge 3$). On each atlas 6 terms reach no parcel and paint only the structures they reach. One of the six on Julich-Brain, intentions, reaches no structure either and paints nothing there. Comparisons have no table on those atlases and switch to HCP-MMP, as does every function on Destrieux or Desikan-Killiany.

Search lists at most 20 terms (`TERMS_SHOWN`): the exact term, then word starts, then any match, larger literatures first. A query matching nothing is offered the nearest name. **Compare** colours two functions' own and shared areas in three finding colours, the most that stay apart under simulated colour-vision deficiency. The region detail lists the functions a region reaches (**Neuropsychological functions**), then the searched terms it reaches under a fold (**Neurosynth terms**, clinical groups marked), in the same order; each row opens its map. The [lesion report](lesion-report.md) takes the areas and structures a function reaches as that function's territory. Lesion evidence is kept in a separate tab, [deficits](deficits.md).

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| `read_scores`; `test_every_area_is_scored_for_every_domain`, `test_structure_scores_must_name_every_sampled_structure`, `test_scores_derived_for_other_terms_are_rejected` | Every function scores all 360 areas and 19 structures, from the configured terms; every function reaches $z$ 3 somewhere | 70 of 70 pass |
| `test_an_area_takes_the_domains_it_reaches_strongest_share_of_peak_first`, `test_a_structure_takes_the_domains_it_reaches_measured_against_their_cortical_peak` | Membership at $z \ge 3$, ordered by share of cortical maximum | passes |
| `brain_model.validate` (`neuropsych_domains.validate`) | Published layer equals the layer rebuilt from sources | 278 areas, 16 structures, 16 teaching units |
| `brain_model.validate` (`neurosynth_terms.validate`); `tests/test_neurosynth_terms.py` | Term layer equals the rebuilt one; lists sorted, unique, disjoint | 232 functions, 45 populations |
| `validate_learning` (`domain_units`) | Each teaching unit ≥ 0.5 inside its structure | right accumbens 0.565, left 0.601; others 0.843–0.946 |
| `scripts/measure_region_functions.py`, order of a region's list | Expected function first in ≥ 5 of 7 test regions and in the first three in all 7; the right anterior ventral insula's eighth and ninth rows not tied | raw $z$ passes |
| `scripts/measure_region_functions.py`, atlas gate | Median Dice no more than 0.1 below HCP-MMP's; every overview function reaches a parcel | Schaefer and Julich-Brain pass; Destrieux fails |
| `test_lesion_checks_measure_cortical_parcels_and_mark_the_rest` | Parcel coverage measured; non-Destrieux regions `null` | passes |
| `test_deficits_sit_under_the_functions_groups_in_the_same_order_and_words` | Deficit groups match function groups | passes |
| `web/src/lib/core/catalog/neuropsych-domains.test.ts`, `web/src/features/functions/functions-view.test.ts` | Paint by band and overview, teaching units, comparison, term ranking, nearest name, profile content | passes |

Areas per function on CDMD run from 8 (intelligence, moral reasoning) to 140 (visual perception). Language reaches 95, motor 124 and attention 119.

Structures reached on CDMD include the accumbens by reward ($z$ 24.7 left, 24.6 right); the amygdala by emotion, fear and faces; the pallidum, putamen and thalamus by motor; and the hippocampus by long-term memory. The caudate reaches fewer functions on the template's own segmentation than it did at MNI305 coordinates. The left caudate no longer reaches motor, working memory, decision making or error monitoring, and the right caudate no longer reaches motor, attention or error monitoring. Sampled at MNI305 coordinates these seven scores read 3.1–4.4, and on the template's own segmentation they read 1.8–2.8. The right caudate still reaches decision making ($z$ 4.1). Recognition memory (148 studies) reaches 17 areas, among them the left hippocampal area H ($z$ 3.4) and presubiculum. Its entorhinal and perirhinal areas stay below $z$ 3.

The order of a region's list was chosen by a measurement whose criterion was fixed before it ran. The seven test regions and their expected functions were the left amygdala and fear, left area 44 and language, left hippocampus and episodic memory, left p9-46v and working memory, left area 4 and motor, left FFC and faces, and left V1 and visual. Raw $z$ put the expected function first in 5 and in the first three in all 7, with the right anterior ventral insula's eighth and ninth rows apart ($z$ 13.34 and 13.18). The association test put the FFC's faces fourth. Share of each function's cortical maximum put the expected function first in 2 and tied 19 of the insula's rows at 100% to the nearest percent.

The atlas gate compared each atlas's parcels with the unparcellated map. The table gives each atlas's median Dice over the 11 overview functions, then the number of its parcels that reach no function and the median and maximum number of functions a parcel reaches.

| Atlas | Median Dice | Parcels | Reaching none | Median reached | Maximum reached |
| :--- | ---: | ---: | ---: | ---: | ---: |
| HCP-MMP | 0.728 | 360 | 82 | 4 | 65 |
| Schaefer | 0.726 | 400 | 110 | 3 | 59 |
| Julich-Brain | 0.648 | 278 | 54 | 4 | 64 |
| Destrieux | 0.591 | 148 | 48 | 2 | 47 |

## Limitations

The maps describe the activation literature of healthy groups. They are not this brain, and they are not a prediction of what damage impairs.

Each function is one abstract term. A study counts when its abstract uses the term, whatever task it ran. Consistency $z$ grows with study count. Large literatures (attention, language, working memory) reach more areas, and areas engaged by most demanding tasks (anterior insula, intraparietal sulcus) reach several functions. Signal-dropout cortex (orbitofrontal, anterior temporal) reaches few functions.

Areas reach `fsaverage` by registration fusion. Each vertex is read where 1,490 people's registrations place it in MNI152 on average, so the mapping places group results, not any one person's folds. Areas narrower than the 6 mm kernel share their neighbours' values.

Neurosynth's peaks come from papers in several MNI templates. NiMARE converts the 16% of studies reporting Talairach with BrainMap's `tal2icbm_other`. The 13% that state no space are read as MNI.

Structure scores are weaker evidence than area scores: the 6 mm kernel is large beside small nuclei, and studies report fewer subcortical coordinates. Averaging over a whole structure dilutes the signal, and the cerebellum and brainstem reach no function. White matter, the ventral diencephalon's nuclei and NextBrain's nuclei are not scored. Lesion checks there are reported as not measured.

Searched terms were not checked against their names or against lesion studies. A population map shows where studies of that group report activation.

Scores are carried per area, never per vertex.

## Code availability

Code
: [`scripts/derive_domain_scores.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/derive_domain_scores.py), [`scripts/derive_term_scores.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/derive_term_scores.py), [`scripts/check_neurosynth_pages.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/check_neurosynth_pages.py), [`scripts/measure_region_functions.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/measure_region_functions.py), [`brain_model/layers/neuropsych_domains.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/neuropsych_domains.py), [`brain_model/layers/neurosynth_terms.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/neurosynth_terms.py), [`web/src/lib/core/catalog/neuropsych-domains.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/catalog/neuropsych-domains.ts), `web/src/features/functions/`

Configuration
: [`config/neuropsych-domains.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/neuropsych-domains.yaml), [`config/neurosynth-terms.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/neurosynth-terms.yaml)

Tests
: [`tests/test_neuropsych_domains.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_neuropsych_domains.py), [`tests/test_neurosynth_terms.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_neurosynth_terms.py), `web/src/lib/core/catalog/neuropsych-domains.test.ts`, `web/src/features/functions/`

```bash
# curated functions (needs the Neurosynth cache and fsaverage; the first run segments the template with FreeSurfer 8.2)
uv run --with nimare==0.22.1 --with nilearn==0.13.1 python scripts/derive_domain_scores.py
# whole vocabulary, on a Slurm cluster
bash scripts/derive_term_scores_submit_rorqual.sh <tasks> <cpus-per-task> <gb-per-cpu> <fresh output folder>
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_neuropsych_domains.py tests/test_neurosynth_terms.py
npm test --prefix web
```

