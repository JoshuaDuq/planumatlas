# Functions

The **Functions** tab paints where studies of a cognitive function consistently report activation. Each of 70 curated functions is one Neurosynth version 7 abstract term. Its meta-analytic consistency map is averaged over every HCP-MMP1.0 (Human Connectome Project multimodal parcellation) area and over 19 FreeSurfer grey-matter structures. An area or structure belongs to a function when its mean $z$ reaches 3. A search offers 277 further terms derived the same way. The maps describe healthy-group activation literature, not this brain and not the effect of a lesion.

```{figure} figures/functions-1.webp
:alt: Left lateral view of a brain with HCP-MMP areas painted in three blues for the language map, beside a list of areas ranked by z, and below a second view with areas painted in eleven function colours.
:name: fig-functions-1

**A function is a consistency map averaged per area, thresholded at z = 3 and ranked.** **a**, Language (Neurosynth term "language", 1,101 studies) on HCP-MMP areas: 96 areas reach $z \ge 3$, drawn in three bands ($z$ 3–5, 5–10, ≥ 10). Tissue-coloured areas fall below 3. **b**, The profile: the evidence line with the study count, the caveats, the 12 strongest areas with their mean $z$ (IFSp left 20.3, 44 left 18.3), and the lesion check (aphasia, left `G_temporal_middle` 31% coloured). **c**, **All functions**: each area in the colour of its strongest overview function, measured as a share of each function's own cortical maximum. The cortex is translucent because the paint includes deep structures. CDMD (sub_013), left lateral view, teaching-set internal anatomy.
```

## Data

| Input | Detail |
| :--- | :--- |
| Neurosynth database | Version 7, abstract terms (Yarkoni et al. 2011; [references](../reference/references.md#bibliography)). Fetched by `nimare.extract.fetch_neurosynth(version="7", source="abstract", vocab="terms")` into `data/cache/neurosynth`. The four files are recorded by sha256 under `derivation.files` of each score table. |
| Software | NiMARE 0.22.1, Nilearn 0.13.1, NumPy 2.4.6 (curated table). The full term table used NumPy 2.4.2 on the Rorqual cluster. |
| Surfaces | `data/fsaverage/surf/{lh,rh}.{white,pial}`; `data/fsaverage/label/{lh,rh}.HCPMMP1.annot` (180 areas per hemisphere) |
| Structures | `data/fsaverage/mri/aseg.mgz`: 19 labels (cerebellar cortex, thalamus, caudate, putamen, pallidum, hippocampus, amygdala, accumbens and ventral diencephalon on each side, plus the brainstem) |
| Curated scores | `data/neuropsych-domains/area-scores.json` (1.07 MB): 70 terms × 360 areas and 19 structures |
| Term scores | `data/neurosynth-terms/term-scores.json` (10.2 MB): all 3,228 abstract terms, rounded to 4 decimals |
| Published (CDMD) | `neuropsych-domains.json` (272 kB); `neurosynth-terms.json` (378 kB), written only by anatomies that declare `neurosynth_terms` in `config/model.yaml` |

Licence: Open Database License (ODbL) 1.0; derived scores are shared under the same licence ([licence](../reference/references.md#open-database-license-neuropsych-domainsjson)).

## Method

### Term choice

`config/neuropsych-domains.yaml` lists 70 functions in six groups. Each function has one Neurosynth term, English and French names, an sRGB colour, an `overview` flag and optional `lesion_checks`. Eleven terms rest on fewer than 100 studies: smell and sustained attention (74), navigation (77), taste (80), interoception (81), verbal fluency (84), gestures (85), object recognition (86), moral reasoning (87), arithmetic (96) and speech perception (97). Every profile states its study count. Consciousness (74 studies) was derived and left out: its map reached one area, right MT, at $z$ 3.1, and no structure. Lesion checks are reported and are never used to tune a map.

### Consistency maps

`scripts/derive_domain_scores.py` processes each term in three steps:

1. It selects the studies whose abstract uses the term at a TF-IDF (term frequency–inverse document frequency) of at least 0.001 (`get_studies_by_label`). All other studies form the comparison set.
2. It fits `MKDAChi2(kernel__r=6)`, the multilevel kernel density analysis (MKDA) chi-square test with a 6 mm kernel.
3. It keeps `z_desc-uniformity`, Neurosynth's uniformity (consistency) test.

Four terms are fitted in parallel (fork pool). The script stops if the database lacks a term.

### Area and structure means

- **Areas.** `area_means` samples the map with `nilearn.surface.vol_to_surf` between each `fsaverage` white and pial surface. It averages the texture over the vertices of each HCP-MMP area (names ending `_ROI`; 360 in all).
- **Structures.** `structure_means` resamples the map onto the `fsaverage` `aseg.mgz` grid (continuous interpolation) and averages it per label. Areas and structures are thus sampled in the same MNI305 frame.

### Membership and order

`neuropsych_domains.assign` adds a cortical HCP-MMP region or a sampled aseg structure to every function whose mean $z \ge 3$ (`threshold_z`). A region's functions are ordered by strength. Strength is $z / z_{\max}$, where $z_{\max}$ is the function's own cortical maximum. Raw $z$ grows with a term's study count, so it would hand every shared area to the largest literature. Structures are divided by the same cortical maximum, so adding them changes no area's order. On CDMD, 273 of 360 areas and 16 of 19 structures reach at least one function. The left and right cerebellar cortex and the brainstem reach none. A function's profile lists its areas and structures by mean $z$, highest first.

### Overview

Eleven functions carry `overview: true`: executive functions, working memory, long-term (episodic) memory, language, attention, visuospatial abilities, social cognition, visual perception, motor, auditory perception and emotion. In **All functions**, each area takes the overview function with the largest $z / z_{\max}$ (Fig. 1c). With these eleven, 125 of 360 areas reach none; with the first seven alone, 193 would. Other functions overlap these (reading within language) and are shown one at a time.

### Teaching units

Eight teaching-set units per side (16) are drawn with one aseg structure's score: caudate, putamen, external and internal pallidum (both from Pallidum), accumbens, thalamus, hippocampus and amygdala. `validate_learning` requires at least half of each unit's voxels (`minimum_share` = 0.5) to lie inside that structure on CDMD. The accumbens has the lowest shares (0.565 right, 0.601 left); all other units are at 0.843 or more. The ventral diencephalon is one FreeSurfer label over many nuclei, so no unit carries its score. NextBrain's finer nuclei are not scored.

### Lesion checks

44 functions name lesion associations from `data/neuropsychology.yaml`. For each Destrieux parcel an association maps, `lesion_checks` reports the share of the parcel's `fsaverage` vertices whose HCP-MMP area belongs to the function. The parcel name is checked against `fsaverage`'s `aparc.a2009s` annotation, and a mismatch fails the build. For an aseg structure, the check reports 1 or 0 for whether the function reaches it. For any other region it reports `null` (not measured). Example: language's `aphasia-comprehension` check colours 30.5% of the left middle temporal gyrus (`G_temporal_middle`).

### Colours

Colours distinguish functions and are not a published palette. Distances are OKLab $\Delta E$ (× 100), computed in normal vision and in protanopia and deuteranopia simulated after Machado et al. (2009) at severity 1. The minimum distances are:

- 14.1 between overview functions whose areas share an `fsaverage` edge;
- 11.3 between any two overview functions;
- 15.9 (normal vision) and 8.2 (simulated deficiency) between any other function and the cortex tissue colour (196, 168, 151).

A single function or term is drawn on one blue scale (`z_scale`): sRGB (150, 200, 240) from $z$ 3, (43, 131, 199) from 5 and (10, 62, 125) from 10. The bands are at least 21.6 apart and at least 11.8 from tissue.

### Term search

`scripts/derive_term_scores.py` repeats the map and averaging steps for all 3,228 abstract terms, reusing `derive_domain_scores.consistency`. It ran as a Slurm array on Rorqual (3 h per task, then a 30 min, 8 GB merge). Each fork used one BLAS thread with `FLEXIBLAS=OPENBLAS`, because FlexiBLAS's default AOCL backend segfaults in Nilearn's coordinate transform of a whole `fsaverage` surface. For the 70 curated terms, the table reproduces the curated scores within $5 \times 10^{-5}$, the rounding limit, with identical study counts.

Most of the vocabulary is report, anatomy or method words, so `config/neurosynth-terms.yaml` is an explicit allow-list of 302 `functions` (70 of them curated) and 45 `populations` (clinical groups). Both lists must be sorted and unique, and no term may be in both. `neurosynth_terms.partition` publishes each chosen term with its kind, study count and regions at $z \ge 3$, highest first. A term the curated functions use, or whose map reaches nothing, is not offered. On CDMD, 232 functions and 45 populations are offered.

## Display

The URL key `tab=functions` opens the tab. The key `function` holds `all`, a curated id (e.g. `language`), `term:<term>` or `compare:<a>,<b>`. A single function or term paints each area and structure in its $z$ band (`domainPaint`, `zBand`). A teaching unit takes its structure's colour. The structures are drawn on the teaching set unless FreeSurfer's segmentation is the internal anatomy shown. When the paint includes a visible deep structure, the cortex is held at the see-through opacity (`appearance.see_through_opacity` = 0.15), and unpainted regions are ghosted (Fig. 1c).

The profile labels the map "Activation evidence" with its term and study count, states that it is neither this brain nor what damage would impair and that consistency does not mean a region serves only that function, lists the 12 strongest areas (`AREAS_SHOWN`), then the lesion checks (Fig. 1b). Searched and population terms carry their own caveats; a population term links to matching Deficits profiles.

Search lists at most 20 terms (`TERMS_SHOWN`): exact term, then word starts, then any match, larger literatures first; a query matching nothing is offered the nearest name. **Compare** colours two functions' own and shared areas in three finding colours, the most that stay apart under simulated colour-vision deficiency. The region detail lists the functions a region reaches (**Neuropsychological functions**); the [lesion report](lesion-report.md) uses the same territories. Lesion evidence is kept in a separate tab, [deficits](deficits.md).

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| `read_scores`; `test_every_area_is_scored_for_every_domain`, `test_structure_scores_must_name_every_sampled_structure`, `test_scores_derived_for_other_terms_are_rejected` | Every function scores all 360 areas and 19 structures, from the configured terms; every function reaches $z$ 3 somewhere | 70 of 70 pass |
| `test_an_area_takes_the_domains_it_reaches_strongest_share_of_peak_first`, `test_a_structure_takes_the_domains_it_reaches_measured_against_their_cortical_peak` | Membership at $z \ge 3$, ordered by share of cortical maximum | passes |
| `brain_model.validate` (`neuropsych_domains.validate`) | Published layer equals the layer rebuilt from sources | 273 areas, 16 structures, 16 teaching units; areas per function from 6 (moral reasoning) and 7 (intelligence) to 139 (visual perception); language 96, motor 116, attention 112 |
| `brain_model.validate` (`neurosynth_terms.validate`); `tests/test_neurosynth_terms.py` | Term layer equals the rebuilt one; lists sorted, unique, disjoint | 232 functions, 45 populations |
| `validate_learning` (`domain_units`) | Each teaching unit ≥ 0.5 inside its structure | right accumbens 0.565, left 0.601; others 0.843–0.946 |
| `test_lesion_checks_measure_cortical_parcels_and_mark_the_rest` | Parcel coverage measured; non-Destrieux regions `null` | passes |
| `test_deficits_sit_under_the_functions_groups_in_the_same_order_and_words` | Deficit groups match function groups | passes |
| `web/src/lib/core/catalog/neuropsych-domains.test.ts`, `web/src/features/functions/functions-view.test.ts` | Paint by band and overview, teaching units, comparison, term ranking, nearest name, profile content | passes |

Structures reached on CDMD include the accumbens by reward ($z$ 27.3 left, 28.7 right); the amygdala by emotion, fear and faces; the pallidum, putamen and thalamus by motor; and the hippocampus by long-term memory. Recognition memory (148 studies) reaches 13 areas; its hippocampal, entorhinal and perirhinal areas stay below $z$ 3.

## Limitations

- Healthy-group activation literature: not this brain, and not a prediction of what damage impairs.
- Each function is one abstract term; a study counts when its abstract uses the term, whatever task it ran.
- Consistency $z$ grows with study count. Large literatures (attention, language, working memory) reach more areas, and areas engaged by most demanding tasks (anterior insula, intraparietal sulcus) reach several functions.
- Signal-dropout cortex (orbitofrontal, anterior temporal) reaches few functions.
- Neurosynth's MNI152 maps are sampled in `fsaverage`'s MNI305 space, a few millimetres apart. Whole-area means absorb most, not all, of the offset.
- Structure scores are weaker evidence than area scores: the 6 mm kernel is large beside small nuclei, the space offset matters more there, and studies report fewer subcortical coordinates. Whole-structure means dilute: the cerebellum and brainstem reach no function.
- White matter, the ventral diencephalon's nuclei and NextBrain's nuclei are not scored; lesion checks there are reported as not measured.
- Searched terms were not checked against their names or against lesion studies. A population map shows where studies of that group report activation.
- Scores are carried per area, never per vertex.

## Code availability

| | |
| :--- | :--- |
| Code | [`scripts/derive_domain_scores.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/derive_domain_scores.py), [`scripts/derive_term_scores.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/derive_term_scores.py), [`brain_model/layers/neuropsych_domains.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/neuropsych_domains.py), [`brain_model/layers/neurosynth_terms.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/neurosynth_terms.py), [`web/src/lib/core/catalog/neuropsych-domains.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/catalog/neuropsych-domains.ts), `web/src/features/functions/` |
| Configuration | [`config/neuropsych-domains.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/neuropsych-domains.yaml), [`config/neurosynth-terms.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/neurosynth-terms.yaml) |
| Tests | [`tests/test_neuropsych_domains.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_neuropsych_domains.py), [`tests/test_neurosynth_terms.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_neurosynth_terms.py), `web/src/lib/core/catalog/neuropsych-domains.test.ts`, `web/src/features/functions/` |

```bash
# curated functions (needs the Neurosynth cache and fsaverage)
uv run --with nimare==0.22.1 --with nilearn==0.13.1 python scripts/derive_domain_scores.py
# whole vocabulary, on a Slurm cluster
bash scripts/derive_term_scores_submit_rorqual.sh <tasks> <cpus-per-task> <gb-per-cpu>
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_neuropsych_domains.py tests/test_neurosynth_terms.py
npm test --prefix web
```

Figure state (panels a, b): https://planumatlas.com/#anatomy=cdmd&lang=en&detail=learning&atlas=hcp-mmp&cuts=hcp-mmp&tab=functions&function=language&view=left. Panel c: the same with `function=all`.
