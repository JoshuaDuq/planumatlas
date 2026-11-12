# Functions

The **Functions** tab paints where studies of a cognitive function consistently report activation. Each of 70 curated functions is one Neurosynth version 7 abstract term. Its meta-analytic consistency map is averaged over every HCP-MMP1.0 (Human Connectome Project multimodal parcellation) area and over 19 FreeSurfer grey-matter structures. An area or structure belongs to a function when its mean $z$ reaches 3. A search offers 277 further terms derived the same way. The maps describe healthy-group activation literature, not this brain and not the effect of a lesion.

```{figure} figures/functions-1.webp
:alt: Left lateral view of a brain with HCP-MMP areas painted in three blues for the language map, beside a list of areas ranked by z, and below a second view with areas painted in eleven function colours.
:name: fig-functions-1

**A function is a consistency map averaged per area, thresholded at z = 3 and ranked.** **a**, Language (Neurosynth term "language", 1,101 studies) on HCP-MMP areas: 95 areas reach $z \ge 3$, drawn in three bands ($z$ 3–5, 5–10, ≥ 10). Tissue-coloured areas fall below 3. **b**, The profile: the evidence line with the study count, the caveats, the 12 strongest areas with their mean $z$ (44 left 19.7, IFSp left 19.4), and the first lesion check (aphasia, left `G_temporal_middle` 76% coloured). **c**, **All functions**: each area in the colour of its strongest overview function, measured as a share of each function's own cortical maximum. The cortex is translucent because the paint includes deep structures. CDMD (sub_013), left lateral view, teaching-set internal anatomy.
```

## Data

| Input | Detail |
| :--- | :--- |
| Neurosynth database | Version 7, abstract terms (Yarkoni et al. 2011; [references](../reference/references.md#bibliography)). Fetched by `nimare.extract.fetch_neurosynth(version="7", source="abstract", vocab="terms")` into `data/cache/neurosynth`. The four files are recorded by sha256 under `derivation.files` of each score table. |
| Software | NiMARE 0.22.1, Nilearn 0.13.1, NumPy 2.4.6, SciPy 1.18.1 (curated table). The full term table used NumPy 2.4.2 and SciPy 1.18.1 on the Rorqual cluster. |
| Surfaces | CBIG's RF-ANTs mapping `{lh,rh}.avgMapping_allSub_RF_ANTs_MNI152_orig_to_fsaverage.mat` (Wu et al. 2018; MIT; commit `5bdb7f5`, pinned by sha256, cached in `data/cache/registration-fusion`); `data/fsaverage/label/{lh,rh}.HCPMMP1.annot` (180 areas per hemisphere) |
| Structures | SynthSeg's segmentation of TemplateFlow `MNI152NLin6Asym` (1 mm T1 pinned in `config/coordinate-spaces.yaml`), cached as `data/cache/neurosynth/mni152nlin6asym-synthseg.nii.gz` and recorded by sha256: 19 aseg labels (cerebellar cortex, thalamus, caudate, putamen, pallidum, hippocampus, amygdala, accumbens and ventral diencephalon on each side, plus the brainstem) |
| Curated scores | `data/neuropsych-domains/area-scores.json` (3.41 MB): 70 terms × 360 areas and 19 structures, and × the parcels of Destrieux, Julich-Brain and Schaefer |
| Term scores | `data/neurosynth-terms/term-scores.json` (10.2 MB): all 3,228 abstract terms, rounded to 4 decimals; `data/neurosynth-terms/atlas-term-scores.json` (1.98 MB): the 347 chosen terms × 278 Julich-Brain and 400 Schaefer parcels |
| Published (CDMD) | `neuropsych-domains.json` (679 kB, 51 kB gzipped); `neurosynth-terms.json` (1.14 MB, 95 kB gzipped), written only by anatomies that declare `neurosynth_terms` in `config/model.yaml` |

Licence: Open Database License (ODbL) 1.0; derived scores are shared under the same licence ([licence](../reference/references.md#open-database-license-neuropsych-domainsjson)).

## Method

### Term choice

`config/neuropsych-domains.yaml` lists 70 functions in six groups. Each function has one Neurosynth term, English and French names, an sRGB colour, an `overview` flag and optional `lesion_checks`. Eleven terms rest on fewer than 100 studies: smell and sustained attention (74), navigation (77), taste (80), interoception (81), verbal fluency (84), gestures (85), object recognition (86), moral reasoning (87), arithmetic (96) and speech perception (97). Every profile states its study count. Consciousness (74 studies) was derived and left out: its map reached two areas, right MT at $z$ 3.3 and the left fusiform face complex at 3.1, and no structure. Lesion checks are reported and are never used to tune a map.

### Consistency maps

`scripts/derive_domain_scores.py` processes each term in three steps:

1. It selects the studies whose abstract uses the term at a TF-IDF (term frequency–inverse document frequency) of at least 0.001 (`get_studies_by_label`). All other studies form the comparison set.
2. It fits `MKDAChi2(kernel__r=6)`, the multilevel kernel density analysis (MKDA) chi-square test with a 6 mm kernel.
3. It keeps `z_desc-uniformity`, Neurosynth's uniformity (consistency) test.

Four terms are fitted in parallel (fork pool). The script stops if the database lacks a term.

### Area and structure means

NiMARE fits every map on FSL's MNI152 (TemplateFlow `MNI152NLin6Asym`, 2 mm). Areas and structures are both read in that template's own frame.

- **Areas.** `area_means` reads the map through registration fusion, RF-ANTs (Wu et al. 2018). CBIG's published mapping, pinned to a commit and checked by checksum, gives each `fsaverage` vertex's MNI152 coordinate at mid-thickness, averaged over 1,490 GSP subjects' ANTs registrations. The map is interpolated linearly at that coordinate, as CBIG's `CBIG_RF_projectVol2fsaverage_single` does, and averaged over the vertices of each HCP-MMP area (names ending `_ROI`; 360 in all). The authors recommend this mapping for projecting published MNI152 results to `fsaverage`.
- **Structures.** `structure_means` resamples the map (continuous interpolation) onto SynthSeg's segmentation of the 1 mm template and averages it per aseg label. The segmentation uses the recipe the coordinate spaces were scored with (`--parc --robust`, FreeSurfer 8.2). Carried onto CDMD, that recipe's reading of this template met CDMD's aseg at Dice 0.88–0.93 for the thalamus, caudate, putamen, pallidum, hippocampus and amygdala. The first run segments the template; later runs read it from the cache.

Until 2026-11-09, areas were sampled between `fsaverage`'s white and pial surfaces and structures on `fsaverage`'s `aseg.mgz`. Both are in MNI305, which lies about 1.9 mm from MNI152 (FreeSurfer's `mni152.register.dat`), and nothing corrected for the difference.

### Membership and order

`neuropsych_domains.assign` adds a cortical HCP-MMP region or a sampled aseg structure to every function whose mean $z \ge 3$ (`threshold_z`). A region's functions are ordered by strength. Strength is $z / z_{\max}$, where $z_{\max}$ is the function's own cortical maximum. Raw $z$ grows with a term's study count, so it would hand every shared area to the largest literature. Structures are divided by the same cortical maximum, so adding them changes no area's order. On CDMD, 278 of 360 areas and 16 of 19 structures reach at least one function. The left and right cerebellar cortex and the brainstem reach none. A function's profile lists its areas and structures by mean $z$, highest first.

### Overview

Eleven functions carry `overview: true`: executive functions, working memory, long-term (episodic) memory, language, attention, visuospatial abilities, social cognition, visual perception, motor, auditory perception and emotion. In **All functions**, each area takes the overview function with the largest $z / z_{\max}$ (Fig. 1c). With these eleven, 120 of 360 areas reach none; with the first seven alone, 189 would. Other functions overlap these (reading within language) and are shown one at a time.

### Teaching units

Eight teaching-set units per side (16) are drawn with one aseg structure's score: caudate, putamen, external and internal pallidum (both from Pallidum), accumbens, thalamus, hippocampus and amygdala. `validate_learning` requires at least half of each unit's voxels (`minimum_share` = 0.5) to lie inside that structure on CDMD. The accumbens has the lowest shares (0.565 right, 0.601 left); all other units are at 0.843 or more. The ventral diencephalon is one FreeSurfer label over many nuclei, so no unit carries its score. NextBrain's finer nuclei are not scored.

### Lesion checks

44 functions name lesion associations from `data/neuropsychology.yaml`. For each Destrieux parcel an association maps, `lesion_checks` reports the share of the parcel's `fsaverage` vertices whose HCP-MMP area belongs to the function. The parcel name is checked against `fsaverage`'s `aparc.a2009s` annotation, and a mismatch fails the build. For an aseg structure, the check reports 1 or 0 for whether the function reaches it. For any other region it reports `null` (not measured). Example: language's `aphasia-comprehension` check colours 76.1% of the left middle temporal gyrus (`G_temporal_middle`).

### Colours

Colours distinguish functions and are not a published palette. Distances are OKLab $\Delta E$ (× 100), computed in normal vision and in protanopia and deuteranopia simulated after Machado et al. (2009) at severity 1. The minimum distances are:

- 14.1 between overview functions whose areas share an `fsaverage` edge;
- 11.3 between any two overview functions;
- 15.9 (normal vision) and 8.2 (simulated deficiency) between any other function and the cortex tissue colour (196, 168, 151).

A single function or term is drawn on one blue scale (`z_scale`): sRGB (150, 200, 240) from $z$ 3, (43, 131, 199) from 5 and (10, 62, 125) from 10. The bands are at least 21.6 apart and at least 11.8 from tissue.

### Term search

`scripts/derive_term_scores.py` repeats the map and averaging steps for all 3,228 abstract terms, reusing `derive_domain_scores.consistency`. It ran on 2026-11-09 as a Slurm array on Rorqual: 16 tasks of 48 CPUs, 13–15 min each (3 h limit), then a 30 min, 8 GB merge. It ran again on 2026-11-11 to add each term's mean per Julich-Brain and Schaefer parcel (16 tasks, 13–17 min each), into a fresh output folder named as the submit script's fourth argument (`scripts/derive_term_scores_submit_rorqual.sh 16 48 4 <folder>`); the HCP-MMP and structure table came out byte-identical. The registration-fusion mapping and the template segmentation were copied to the cluster and are checked there by the same checksums. Each fork used one BLAS thread with `FLEXIBLAS=OPENBLAS`, because FlexiBLAS's default AOCL backend segfaults in Nilearn's coordinate transform of a whole `fsaverage` surface. For the 70 curated terms, the table reproduces the curated scores within $5 \times 10^{-5}$, the rounding limit, with identical study counts and the same input checksums.

Most of the vocabulary is report, anatomy or method words, so `config/neurosynth-terms.yaml` is an explicit allow-list of 302 `functions` (70 of them curated) and 45 `populations` (clinical groups). Both lists must be sorted and unique, and no term may be in both. `neurosynth_terms.partition` publishes each chosen term with its kind, study count and regions at $z \ge 3$, highest first. A term the curated functions use, or whose map reaches nothing, is not offered. On CDMD, 232 functions and 45 populations are offered.

## Display

The URL key `tab=functions` opens the tab. The key `function` holds `all`, a curated id (e.g. `language`), `term:<term>` or `compare:<a>,<b>`. A single function or term paints each area and structure in its $z$ band (`domainPaint`, `zBand`). A teaching unit takes its structure's colour. The structures are drawn on the teaching set unless FreeSurfer's segmentation is the internal anatomy shown. The cortex stays opaque, so each area's colour reads as its band. When the paint colours both areas and drawn deep structures, the profile's **Show *n* deep structures** button hides the cortex and frames the structures; **Show the cortex** brings it back and frames the whole brain. Under T1 MRI colour the paint is drawn over the scan, which shows wherever nothing is painted, and the key says so. The profile's **Linked MRI** opens the [linked MRI](linked-mri.md) at the strongest area, with the paint over the planes.

The profile labels the map "Activation evidence" with its term and study count, states that it is neither this brain nor what damage would impair and that consistency does not mean a region serves only that function, lists the 12 strongest areas (`AREAS_SHOWN`), then the lesion checks (Fig. 1b). Searched and population terms carry their own caveats; a population term links to matching Deficits profiles.

Under the stage line of one function or searched term, **Paint areas from z ≥** raises the paint threshold from 3 in steps of 0.5, up to the strongest area's $z$. It changes the paint, the stage key (a band nothing then carries is outlined) and the stage line's count; the area list, the lesion checks and every region's list keep the published $z \ge 3$. A link carries it as `zmin=`. It does not go below 3: no fourth, lighter colour passes the scale's own checks (OKLab ΔE ≥ 11.8 from the tissue colour and ≥ 20 from the 3–5 band, under normal vision and simulated protanopia and deuteranopia). The overview and comparisons keep 3.

A profile ends with a link to its term's page on neurosynth.org (`https://neurosynth.org/analyses/terms/<term>/`), built from the Neurosynth term and never from the display name. The site's uniformity-test map is the one closest to Planum's: the site thresholds it at an expected FDR of 0.01, whereas Planum paints the unthresholded map averaged per area, so the two differ. The site uses the same 14,371 studies but offers 1,334 of the 3,228 terms, and it answers HTTP 200 for a term it does not have; only the page title says so. `scripts/check_neurosynth_pages.py`, run by hand, reads each title and writes the terms without a page to `neurosynth_org_missing` in `config/neurosynth-terms.yaml`. On 2026-11-10 these were 4 of the 70 curated terms (emotion, numerical, scenes, skill) and 11 of the 277 offered terms. Their profiles show no link. The build never calls the site.

With a region selected and the search empty, the list opens with **Reported here**: the curated functions the region reaches at $z \ge 3$, highest $z$ first, eight shown and the rest behind **Show all N**, then a note that activation there does not make the region specific to them. The region sheet's **Neuropsychological functions** uses the same order and cap. The order was chosen by a measurement fixed before it ran: across seven test regions (left amygdala and fear, left area 44 and language, left hippocampus and episodic memory, left p9-46v and working memory, left area 4 and motor, left FFC and faces, left V1 and visual), raw $z$ put the expected function first in 5 and in the first three in all 7, with the right anterior ventral insula's eighth and ninth rows apart ($z$ 13.34 and 13.18); the association test put the FFC's faces fourth, and share of each function's cortical maximum put the expected function first in 2 and tied 19 rows at 100%.

A curated function, or the overview, opened while Julich-Brain or Schaefer is the atlas paints that atlas's own areas from the same table, and the atlas stays the reader's; the profile then lists and counts that atlas's areas, and its lesion checks say they are measured on HCP-MMP. A searched term does the same from its own table there (`atlases` in `neurosynth-terms.json`: the parcels each offered term reaches at $z \ge 3$; 6 terms reach none on each atlas and paint only structures). Comparisons have no table on those atlases and switch to HCP-MMP as before, as does every function on Destrieux.

The same vertex values are also averaged over each parcel of Julich-Brain 3.1, Schaefer 2018 (400 parcels) and Destrieux on `fsaverage` (`atlas_scores` in the score table). A parcel's mean depends on its size, so each atlas was measured against the unparcellated map before its regions list functions: for each of the 11 overview functions, the area-weighted Dice on the `fsaverage` pial surface between the atlas's parcels at mean $z \ge 3$ and the vertices whose own $z \ge 3$. The bar, fixed before the run, was a median within 0.1 of HCP-MMP's, with every overview function reaching some parcel. Medians: HCP-MMP 0.728, Schaefer 0.726, Julich-Brain 0.648, Destrieux 0.591. Julich-Brain and Schaefer regions list their own atlas's functions (`region_atlases`); Destrieux regions list none. Functions reached per parcel (none / median / maximum): HCP-MMP 82 / 4 / 65 of 360, Schaefer 110 / 3 / 59 of 400, Julich-Brain 54 / 4 / 64 of 278, Destrieux 48 / 2 / 47 of 148.

Search lists at most 20 terms (`TERMS_SHOWN`): exact term, then word starts, then any match, larger literatures first; a query matching nothing is offered the nearest name. **Compare** colours two functions' own and shared areas in three finding colours, the most that stay apart under simulated colour-vision deficiency. The region detail lists the functions a region reaches (**Neuropsychological functions**); the [lesion report](lesion-report.md) uses the same territories. Lesion evidence is kept in a separate tab, [deficits](deficits.md).

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| `read_scores`; `test_every_area_is_scored_for_every_domain`, `test_structure_scores_must_name_every_sampled_structure`, `test_scores_derived_for_other_terms_are_rejected` | Every function scores all 360 areas and 19 structures, from the configured terms; every function reaches $z$ 3 somewhere | 70 of 70 pass |
| `test_an_area_takes_the_domains_it_reaches_strongest_share_of_peak_first`, `test_a_structure_takes_the_domains_it_reaches_measured_against_their_cortical_peak` | Membership at $z \ge 3$, ordered by share of cortical maximum | passes |
| `brain_model.validate` (`neuropsych_domains.validate`) | Published layer equals the layer rebuilt from sources | 278 areas, 16 structures, 16 teaching units; areas per function from 8 (intelligence, moral reasoning) to 140 (visual perception); language 95, motor 124, attention 119 |
| `brain_model.validate` (`neurosynth_terms.validate`); `tests/test_neurosynth_terms.py` | Term layer equals the rebuilt one; lists sorted, unique, disjoint | 232 functions, 45 populations |
| `validate_learning` (`domain_units`) | Each teaching unit ≥ 0.5 inside its structure | right accumbens 0.565, left 0.601; others 0.843–0.946 |
| `test_lesion_checks_measure_cortical_parcels_and_mark_the_rest` | Parcel coverage measured; non-Destrieux regions `null` | passes |
| `test_deficits_sit_under_the_functions_groups_in_the_same_order_and_words` | Deficit groups match function groups | passes |
| `web/src/lib/core/catalog/neuropsych-domains.test.ts`, `web/src/features/functions/functions-view.test.ts` | Paint by band and overview, teaching units, comparison, term ranking, nearest name, profile content | passes |

Structures reached on CDMD include the accumbens by reward ($z$ 24.7 left, 24.6 right); the amygdala by emotion, fear and faces; the pallidum, putamen and thalamus by motor; and the hippocampus by long-term memory. The caudate no longer reaches motor, working memory, attention, decision making or error monitoring: sampled at MNI305 coordinates it read 3.1–4.4, on the template's own segmentation 1.8–2.8. Recognition memory (148 studies) reaches 17 areas, among them the left hippocampal area H ($z$ 3.4) and presubiculum; its entorhinal and perirhinal areas stay below $z$ 3.

## Limitations

- Healthy-group activation literature: not this brain, and not a prediction of what damage impairs.
- Each function is one abstract term; a study counts when its abstract uses the term, whatever task it ran.
- Consistency $z$ grows with study count. Large literatures (attention, language, working memory) reach more areas, and areas engaged by most demanding tasks (anterior insula, intraparietal sulcus) reach several functions.
- Signal-dropout cortex (orbitofrontal, anterior temporal) reaches few functions.
- Areas reach `fsaverage` by registration fusion: each vertex is read where 1,490 people's registrations place it in MNI152 on average, so it places group results, not any one person's folds. Areas narrower than the 6 mm kernel share their neighbours' values.
- Neurosynth's peaks come from papers in several MNI templates. NiMARE converts the 16% of studies reporting Talairach with BrainMap's `tal2icbm_other`; the 13% that state no space are read as MNI.
- Structure scores are weaker evidence than area scores: the 6 mm kernel is large beside small nuclei, and studies report fewer subcortical coordinates. Whole-structure means dilute: the cerebellum and brainstem reach no function.
- White matter, the ventral diencephalon's nuclei and NextBrain's nuclei are not scored; lesion checks there are reported as not measured.
- Searched terms were not checked against their names or against lesion studies. A population map shows where studies of that group report activation.
- Scores are carried per area, never per vertex.

## Code availability

| | |
| :--- | :--- |
| Code | [`scripts/derive_domain_scores.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/derive_domain_scores.py), [`scripts/derive_term_scores.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/derive_term_scores.py), [`scripts/check_neurosynth_pages.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/check_neurosynth_pages.py), [`scripts/measure_region_functions.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/measure_region_functions.py), [`brain_model/layers/neuropsych_domains.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/neuropsych_domains.py), [`brain_model/layers/neurosynth_terms.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/neurosynth_terms.py), [`web/src/lib/core/catalog/neuropsych-domains.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/catalog/neuropsych-domains.ts), `web/src/features/functions/` |
| Configuration | [`config/neuropsych-domains.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/neuropsych-domains.yaml), [`config/neurosynth-terms.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/neurosynth-terms.yaml) |
| Tests | [`tests/test_neuropsych_domains.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_neuropsych_domains.py), [`tests/test_neurosynth_terms.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_neurosynth_terms.py), `web/src/lib/core/catalog/neuropsych-domains.test.ts`, `web/src/features/functions/` |

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

Figure state (panels a, b): https://planumatlas.com/#anatomy=cdmd&lang=en&detail=learning&atlas=hcp-mmp&cuts=hcp-mmp&tab=functions&function=language&view=left. Panel c: the same with `function=all`.
