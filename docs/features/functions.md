# Functions

The **Functions** tab paints the regions where studies of a cognitive function consistently report activation, built from Neurosynth version 7 consistency maps averaged per HCP-MMP area and per FreeSurfer grey-matter structure.

:::{list-table}
:widths: 22 78
:stub-columns: 1

* - Where in the viewer
  - **Functions** tab (70 curated functions, grouped under six headings, and a search over 277 further Neurosynth terms); the region inspector's **Neuropsychological functions** disclosure; the lesion report's **Functions** group ([lesion report](lesion-report.md)).
* - Built by
  - [`scripts/derive_domain_scores.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/derive_domain_scores.py), [`scripts/derive_term_scores.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/derive_term_scores.py), [`brain_model/layers/neuropsych_domains.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/neuropsych_domains.py), [`brain_model/layers/neurosynth_terms.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/neurosynth_terms.py)
* - Configuration
  - [`config/neuropsych-domains.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/neuropsych-domains.yaml), [`config/neurosynth-terms.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/neurosynth-terms.yaml)
* - Source data
  - Neurosynth database version 7, abstract terms (Yarkoni et al. 2011), maps computed with NiMARE 0.22.1; FreeSurfer's `fsaverage` surfaces, HCP-MMP annotation and `aseg.mgz`. Open Database License (ODbL) 1.0; derived area scores are shared under the same licence.
* - Checked by
  - [`tests/test_neuropsych_domains.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_neuropsych_domains.py), [`tests/test_neurosynth_terms.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_neurosynth_terms.py), `brain_model.validate` (per-area layers rebuilt from their sources must match exactly), `brain_model.validate_learning` (teaching-set units), the web tests in `web/src/lib/core/catalog/neuropsych-domains.test.ts` and `web/src/features/functions/`
:::

## What it does

The 70 curated functions are Neurosynth abstract terms chosen to name the domains a neuropsychological assessment measures. Each function is a map: every HCP-MMP area and every sampled grey-matter structure carries the mean consistency $z$ of the term, and belongs to the function when that mean reaches 3. Opening a function shows its study count, the areas and structures that reach the threshold, and any lesion associations used to check the map. **All functions** displays eleven assessment functions together. **Restore previous view** returns to the view before opening a profile, and choosing a colour in the masthead replaces the profile colours.

```{figure} ../../.github/assets/readme/functions.webp
:alt: The Neurosynth map for language on HCP-MMP areas, strongest in left inferior frontal and superior temporal cortex, with its ranked area list

**Language**: 96 HCP-MMP areas at z ≥ 3, from 1,101 studies, strongest first.
```

A map describes where studies using a term consistently report activation in healthy groups. It does not show that a region serves only that function, measure function in this subject, or predict the effect of a lesion. The overview combines several term maps.

Search also offers 277 further Neurosynth terms (232 functions, tasks, stimuli, states and behaviours, and 45 clinical groups), drawn with the same method. These maps have not been checked against their names or lesion studies. A clinical-group map shows reported activation in studies of that group, not where damage causes the condition.

The Functions and Deficits tabs are kept apart because activation evidence and lesion evidence must not share one ranked list. Both tabs use the same six groups, each search links to the other tab's matches, and a deficit profile lists the function maps its findings check; see [deficits](deficits.md).

## Data

| Input | Detail |
| :--- | :--- |
| Neurosynth database | Version 7, abstract terms; fetched with `nimare.extract.fetch_neurosynth(version="7", source="abstract", vocab="terms")` into `data/cache/neurosynth` |
| Pinned files | Four files recorded by SHA-256 in `data/neuropsych-domains/area-scores.json` under `derivation.files`: `data-neurosynth_version-7_coordinates.tsv.gz`, `…_metadata.tsv.gz`, `…_vocab-terms_source-abstract_type-tfidf_features.npz`, `…_vocab-terms_vocabulary.txt` |
| Software | `nimare` 0.22.1, `nilearn` 0.13.1, `numpy` 2.4.6 (curated table); the full term table was derived on Rorqual with `numpy` 2.4.2 |
| Surfaces | `data/fsaverage/surf/{lh,rh}.pial` and `.white`; `data/fsaverage/label/{lh,rh}.HCPMMP1.annot` (360 areas) |
| Structures | `data/fsaverage/mri/aseg.mgz`, resampled to by the map and averaged per label |
| Curated scores | `data/neuropsych-domains/area-scores.json` (1.07 MB), committed |
| Term scores | `data/neurosynth-terms/term-scores.json` (10 MB, 3,228 terms, 4 decimals), committed |
| Published | `public/models/cdmd/neuropsych-domains.json` (272 kB) and `public/models/cdmd/neurosynth-terms.json` (378 kB); only anatomies that declare `neurosynth_terms` in `config/model.yaml` publish the second (CDMD) |

## How it was built

### 1. Choose the terms

`config/neuropsych-domains.yaml` lists the domains. Each has an `id`, one Neurosynth `term`, a `group`, English and French names, an sRGB `color`, an `overview` flag and optional `lesion_checks` naming associations in `data/neuropsychology.yaml`. `read_definition` refuses a duplicate id, an unknown group, a colour that is not three bytes, a lesion check that names no published association, and a definition with no overview domain.

Most terms are used by at least 100 studies. Eleven clinically pertinent terms rest on 74 to 97 studies (sustained attention, smell, navigation, taste, interoception, verbal fluency, gestures, object recognition, moral reasoning, arithmetic and speech perception); their maps are weaker evidence, and every function profile names its study count. Consciousness (74 studies) was derived and left out: its map reached one area, MT, at $z$ 3.1, and no structure.

The terms were chosen in batches by hand, and a map is never tuned to a lesion result: the lesion check is reported, not used to alter the map. Terms left out of the first batches on purpose included those with too few studies at the time (visual search, verbal fluency, object recognition; the last two were added later with their 74 to 97 studies stated), ambiguous terms (sustained, awareness, body, sequence, learning), duplicates (stroop, mentalizing, updating) and states (anxiety, depression, stress), which are offered in the term search instead.

### 2. Compute each term's consistency map

`scripts/derive_domain_scores.py` runs, once per change to the curated terms, with the meta-analysis tools the build does not need:

```bash
uv run --with nimare==0.22.1 --with nilearn==0.13.1 python scripts/derive_domain_scores.py
```

For each term the script:

1. selects the studies whose abstract uses the term at a TF-IDF of at least 0.001 (`LABEL_THRESHOLD`; `dataset.get_studies_by_label("terms_abstract_tfidf__<term>", label_threshold=0.001)`) and takes every other study as the comparison set;
2. fits `nimare.meta.cbma.mkda.MKDAChi2(kernel__r=6)`: MKDA chi-square with a 6 mm kernel (`KERNEL_RADIUS_MM`);
3. reads the map `z_desc-uniformity`, Neurosynth's uniformity (consistency) test;
4. fits four terms at a time (`WORKERS = 4`, fork pool; four fit in 24 GB).

The script refuses to run if the database lacks a term.

### 3. Average the map per HCP-MMP area and per structure

- **Areas.** `area_means` samples the map with `nilearn.surface.vol_to_surf` between each `fsaverage` white and pial surface, and averages the texture over the vertices of each HCP-MMP area (names ending `_ROI`; 180 per hemisphere, 360 in all).
- **Structures.** `structure_means` resamples the map onto `fsaverage`'s `aseg.mgz` grid (`continuous` interpolation) and averages it per grey-matter label. The 19 labels are listed in `neuropsych_domains.STRUCTURES`: cerebellar cortex, thalamus, caudate, putamen, pallidum, hippocampus, amygdala, accumbens and ventral diencephalon on each side, and the brainstem. Each structure is scored as a whole, in the same MNI305 frame as the cortical areas, because `fsaverage`'s own segmentation is used.

The output records the database and file checksums, the study count per function, the selection rule, the map, the projection, the software versions, and each function's mean $z$ per area and per structure.

### 4. Assign areas and structures to functions

At build time `neuropsych_domains.partition` runs `assign`. An HCP-MMP cortical region, or a sampled aseg structure, belongs to every function whose mean $z$ reaches `threshold_z` = 3. Members are ordered by strength, which is $z$ as a share of the function's own cortical maximum, because consistency $z$ grows with a term's study count and raw $z$ would hand every shared area to the largest literature. Structures are measured against the same cortical maximum, so adding them changes no area's order. On CDMD this assigns 273 areas and 16 structures; 19 structures are sampled, and three reach no function.

### 5. The overview

Eleven functions carry `overview: true`: executive functions, working memory, long-term (episodic) memory, language, attention, visuospatial abilities, social cognition, visual perception, motor, auditory perception and emotion. In **All functions** each area takes the overview function whose $z$ there is the largest share of that function's own cortical maximum (`shownDomain` in the viewer takes the first overview member of the area). The other functions overlap them (reading within language) and are shown one at a time. The overview was widened from seven to eleven functions because 193 of 360 areas were otherwise grey; 125 areas remain grey (orbitofrontal, frontopolar and temporal-pole cortex, where fMRI signal drops out, dorsal prefrontal and medial parietal cortex).

### 6. The teaching set

The viewer draws the teaching set (the union-of-labels solids of [`config/learning-anatomy.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/learning-anatomy.yaml)) when a function is open, and draws FreeSurfer's `aseg` when that is the internal anatomy shown; NextBrain's finer nuclei are not scored, so opening a function switches NextBrain to the teaching set. `teaching_units` in the configuration names eight units, each drawn with the score of the `aseg` structure that holds most of it on the subject: caudate, putamen, external pallidum and internal pallidum (both from Pallidum), accumbens (Accumbens-area), thalamus (Thalamus-Proper), hippocampus and amygdala, on both sides (16 units). `validate_learning` requires at least `minimum_share` = 0.5 of each unit's voxels to lie inside that structure on CDMD; the least is the accumbens (0.57), the rest 0.84 or more. Aseg files the geniculate bodies, substantia nigra, hypothalamus and red nucleus under the ventral diencephalon, a single FreeSurfer label over many nuclei, so no unit carries that structure's score (reward, for example). NextBrain's nuclei were rejected as a scoring unit because a whole-structure score would fake nucleus precision.

### 7. Lesion checks

For each function that names `lesion_checks`, `lesion_checks()` reads the cited associations in `data/neuropsychology.yaml` and reports, for each Destrieux parcel they map, the share of that parcel's `fsaverage` vertices whose HCP-MMP area belongs to the function. For an aseg structure it reports 1 or 0 for whether the function reaches it; for any other mapped region it reports `null` (not measured). The cited parcel's name is checked against `fsaverage`'s `aparc.a2009s` annotation and a mismatch fails the build. For example, language's check for `aphasia-comprehension` covers 30.5% of the left middle temporal gyrus (`G_temporal_middle`). The check is reported in the function's profile and never used to tune a map. Forty-four functions carry at least one lesion check.

### 8. Colours

Colours distinguish functions; they are not a published palette. Overview functions whose areas share a border differ by an OKLab $\Delta E$ of at least 14, and any two by at least 11, under normal vision and simulated protanopia and deuteranopia (Machado 2009, severity 1). Every other function, shown alone, differs from the cortex's tissue colour by at least 15 in normal vision and 8 under simulated colour-vision deficiency.

A function or searched term shown alone is drawn on one blue scale (`z_scale`) so its areas keep the order of strength the profile lists and two maps can be compared:

| $z$ from | Colour (sRGB) |
| :--- | :--- |
| 3 | 150, 200, 240 |
| 5 | 43, 131, 199 |
| 10 | 10, 62, 125 |

Blue sits across the blue–yellow axis from the cortex's tan tissue, the axis protanopia and deuteranopia keep. In OKLab the bands differ from each other by a $\Delta E$ of at least 20 and from the tissue colour by at least 11.8, under normal vision and the simulated deficiencies. Rejected ramps: mixing toward tissue (the weakest band was only $\Delta E$ 4 from tissue) and per-hue lightness steps (the light band fell to $\Delta E$ 6 under protanopia for warm hues). The overview keeps the functions' own colours.

### 9. The term search

`scripts/derive_term_scores.py` repeats steps 2 and 3 for every Neurosynth version 7 abstract term (3,228). It reuses `derive_domain_scores.consistency`, so the curated terms reproduce to 5e-5 at four decimals. The work ran on the Rorqual cluster as a Slurm array (`scripts/derive_term_scores_submit_rorqual.sh <tasks> <CPUs per task> <GB per CPU>`, each task `--time=03:00:00`, then a merge job of 30 min and 8 GB). `run` fits one array task's share of the terms, writes one file per term (a rerun skips finished terms) and `merge` gathers them into `data/neurosynth-terms/term-scores.json`, one term per line: its z per area then per structure, rounded to four decimals, because the curated table's layout would take 60 MB for the whole vocabulary. On Rorqual, Alliance Python accepts no manylinux wheels, so compiled packages come from the Alliance wheelhouse; `FLEXIBLAS=OPENBLAS` with one BLAS thread per fork is required, or nilearn segfaults in its coordinate transform of a whole `fsaverage` surface (`scripts/derive_term_scores.sbatch`). With it, results matched the Mac-derived scores to the last printed digit.

About three-quarters of the vocabulary is report language, anatomy or method words ("accordingly", "angular gyrus", "voxel"), and NiMARE's stoplist removes none of them because the vocabulary was built with it already applied. The Cognitive Atlas was unreachable (502) when tried, and exact matching against it would have dropped "faces". `config/neurosynth-terms.yaml` therefore holds an explicit, reviewable allow-list: 302 `functions` (70 of them curated, so hidden under their curated name) and 45 `populations` (abuse, addiction, ADHD, alcohol, Alzheimer disease, aphasia, autism, bipolar disorder, dementia, depression, dyslexia, epilepsy, multiple sclerosis, OCD, Parkinson disease, PTSD, schizophrenia, stroke, smokers and similar). `neurosynth_terms.partition` publishes a chosen term with its kind, study count and the regions whose mean $z$ reaches the same threshold of 3, strongest first, by index into a shared region list. A term the curated functions use, or whose map reaches nothing, is not offered. Of the 347 chosen, 232 functions and 45 populations are published (277). The lists must be sorted and unique, and no term may be both. Change the offered terms in the YAML lists, never by adjusting thresholds.

The live neurosynth.org maps were not used: they are FDR-thresholded (no $|z|$ below 3.13), unlike the curated functions' unthresholded NiMARE maps.

## How the viewer uses it

- **Catalogue.** [`web/src/lib/core/catalog/neuropsych-domains.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/catalog/neuropsych-domains.ts) validates the published partition and the term search against the regions they name (`validateNeuropsychDomains`), ranks searched terms (`matchingTerms`: the term itself, then a word starting with the query, then any holding it; more studies first), and offers the nearest name for a misspelling (`nearestName`).
- **Paint.** `domainPaint` returns a model paint: for `ALL_DOMAINS` each area in its strongest overview function's colour, for one function or searched term each area in its `z_scale` band's colour (`zBand`), and each teaching unit in its structure's colour. Functions and Deficits paint the brain only while their tab is in front; a masthead colour or atlas choice lifts the paint.
- **Tab.** `web/src/features/functions/` holds the list (`FunctionList.svelte`), profile (`FunctionProfile.svelte`), restore control and the view model (`functions-view.ts`: a profile lists 12 areas before folding the rest under a disclosure, `AREAS_SHOWN`; at most 20 searched terms are listed, `TERMS_SHOWN`, until a narrower query).
- **Compare.** Compare mode picks two functions. A comparison is a function id of its own, `compare:<a>,<b>`, so it rides session, links (`function=`), Restore and paint with no new state. Curated functions and searched terms can be mixed. It is capped at two because one colour per function plus "both" makes three colours, and the finding colours document that only the first three stay apart from each other and from the tissue colour under simulated colour-vision deficiency (OKLab $\Delta E$ at least 12 and 19); a third function needs a different encoding. The profile lists shared areas with both $z$ values, then each map's own areas, with a caveat that consistency $z$ grows with study count (compare reach, not $z$). The list swatches were removed because they looked like unused checkboxes.
- **See through the cortex.** The notice offers one action when an opened function's strongest region, or some of a deficit's mapped regions, is a deep forebrain structure. It sets `appearance.see_through_opacity` to 0.15; at 0.3 the amygdala was still veiled for fear.
- **Region inspector.** `domainsOf` lists the functions a selected area or structure reaches, with $z$, through its scored source (`scoredSource` maps a teaching unit to its structure).
- **Lesion report.** A function's territory is its HCP-MMP areas and structures at $z \ge 3$ on the sides a lesion reaches. See [lesion report](lesion-report.md).

## Checks

| Check | Where | Measured on CDMD |
| :--- | :--- | :--- |
| Every area is scored for every function; every structure sampled is named; scores derive from the configured terms | `read_scores` | all 70 functions score all 360 areas and 19 structures |
| Every function reaches the threshold somewhere | `read_scores` | all 70 pass |
| Published layer equals the layer rebuilt from sources | `neuropsych_domains.validate` | 273 areas and 16 structures assigned; 16 teaching units |
| Term layer equals the rebuilt one | `neurosynth_terms.validate` | 232 functions and 45 populations |
| Teaching units lie in their structure | `validate_learning` | at least 0.5 required; accumbens 0.57, others 0.84 or more |
| Curated terms reproduce | derivation | the term table reproduces the 70 curated terms to 5e-5; re-derivation reproduced the original 11 functions bit for bit |
| Groups match the deficit groups in the same order and words | `test_deficits_sit_under_the_functions_groups_in_the_same_order_and_words` | pass |

Areas reached per function (CDMD) range from 6 (moral reasoning) and 7 (intelligence) to 139 (visual perception); language reaches 96, motor 116 and attention 112 (`validation.json`, `neuropsych_domains.areas_per_domain`). Recognition memory reaches 13 areas, its medial temporal cortex mostly below $z$ 3. Reward reaches the accumbens at $z$ 28.7; fear, faces and emotion reach the amygdala; motor reaches pallidum, putamen and thalamus; memory reaches the hippocampus. Cerebellum and brainstem reach nothing, because a whole-structure mean dilutes.

## Limits

- Healthy-group activation literature, not this brain and not a prediction of what damage impairs.
- Each function is one abstract term; a study counts when its abstract uses the term, whatever task it ran. Consistency $z$ grows with the number of such studies, so large literatures (attention, language, working memory) reach more areas than executive function or social cognition, and regions engaged by most demanding tasks (anterior insula, intraparietal sulcus) reach several functions.
- Signal-dropout regions (orbitofrontal, anterior temporal) reach few functions.
- Neurosynth's MNI152 maps are sampled on `fsaverage`'s MNI305, a few millimetres apart; whole-area averages absorb most, not all, of that.
- Subcortical scores are weaker evidence than cortical ones: the 6 mm kernel is large beside the smaller nuclei, the MNI305/MNI152 offset matters more there, and studies report fewer subcortical coordinates. White matter and NextBrain's finer nuclei are not scored, and a lesion check on them is reported as not measured.
- Searched terms are words chosen from Neurosynth's vocabulary; unlike the curated functions, no map was checked against what it names or against lesion studies. A population term gathers studies of that group, most comparing it with healthy people, so its map is not where damage causes the condition. A term with few studies reaches fewer areas, and every term names its study count.
- The scores are carried per area, never per vertex. Maps were rejected where they made a worse measure look better: NeuroQuery (its social-cognition map centred on face perception), Neurosynth association (specificity) maps (executive function nearly empty, as domain-general regions are not specific), and a lowered threshold of $z$ 1.96 (weaker evidence in the same colour).

## Reproduce

```bash
# Curated functions (about 70 maps; needs the Neurosynth cache and fsaverage)
uv run --with nimare==0.22.1 --with nilearn==0.13.1 python scripts/derive_domain_scores.py

# The whole vocabulary, on a Slurm cluster
bash scripts/derive_term_scores_submit_rorqual.sh <tasks> <cpus-per-task> <gb-per-cpu>

# Rebuild and validate the layers
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_neuropsych_domains.py tests/test_neurosynth_terms.py
npm test --prefix web
```

Edits to `config/*.yaml` need a dev-server restart. Change a term in the YAML, never a threshold.

## See also

- [Deficits](deficits.md): lesion evidence, kept apart from activation evidence.
- [Lesion report](lesion-report.md): which functions a placed lesion overlaps.
- [Cortical atlases](cortical-atlases.md): the HCP-MMP parcellation the scores are carried on.
- [Internal anatomy](internal-anatomy.md): the structures scored.
- [Hart (2016) review](../reference/hart-2016-review-2026-11-02.md): makes the distinction between activation consistency, specificity and lesion consequences visible on function profiles.
- [References and licensing](../reference/references.md), [Validation and limits](../pipeline/validation.md), [Building an anatomy](../pipeline/building.md).
