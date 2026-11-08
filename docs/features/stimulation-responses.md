# Stimulation responses

For a selected region, the viewer lists how often single-pulse electrical stimulation at one site evoked a response at another, as response rates with their pair and subject counts. Rates come from stereo-electroencephalography (SEEG) in 27 people with epilepsy (Lyu et al. 2025), pooled by the authors' 26 anatomical labels, and, for Julich-Brain areas, from F-TRACT's atlas of 613 people. Nothing is measured in this brain: a region takes a label or an area name, and the rates are the cohort's.

```{figure} figures/stimulation-responses-1.webp
:alt: Left, the Stimulation responses section with Stimulated here and Same side chosen, listing other labels with a bar, a percentage, and pair and people counts, from Middle thalamus 75 percent down to Temporal pole 20 percent. Right, a left lateral view of the brain coloured by Destrieux region with the triangular part of the inferior frontal gyrus outlined in white.
:name: fig-stimulation-responses-1

**A cortical parcel takes the authors' label of the contacts inside it and shows that label's response rates.** **a**, **Stimulation responses**, **Stimulated here**, **Same side**, for the left inferior frontal gyrus, triangular part (`destrieux:left:14`), which takes "Lateral frontal cortex" from 92% of its 92 cortical channels in 21 people. Rows: recording label, rate = responding / tested pairs, then pairs and people; first row Middle thalamus 75% (167 of 223 pairs, 12 people). **b**, The parcel on CDMD, Destrieux atlas, left lateral view.
```

## Data

| Input | Detail |
| :--- | :--- |
| Lyu et al. | [Lyu et al. 2025](../reference/references.md#group-data-and-templates), Zenodo 16939708, CC BY 4.0. `DATA/metaTable.csv` (SHA-256 `fa9ce3fd…`): 275,336 stimulation–recording bipolar channel pairs from 27 subjects, with each channel's hand-assigned label (`JP_label_out`, `JP_label_in`), MNI305 x (`MNIout_coord_1`, `MNIin_coord_1`) and response class `umapAct`: 1 responded (76,899), 0 no response (163,420), `NaN` excluded as artefact or bad channel (35,017) |
| Electrodes | `DATA/workbench/subjects/<subject>/elec_FSLR_vIndex_wbComm_<subject>.csv`: each channel's fs_LR 32k vertex; 27 files, SHA-256 pinned |
| Spheres | HCP `fs_LR-deformed_to-fsaverage.{L,R}.sphere.32k_fs_LR.surf.gii`, HCPpipelines commit `0aef592a`; `fsaverage` `sphere.reg` and `aparc.a2009s` |
| Labels | 26 (`config/stimulation-responses.yaml`): 18 cortical (frontal pole, lateral frontal, orbitofrontal, medial frontal, anterior cingulate, midcingulate, sensorimotor, insula, posteromedial, superior and inferior parietal, occipital, superior, middle and inferior temporal, temporal pole, fusiform, parahippocampal) and 8 deep or border (insula–lateral frontal border, hippocampus, amygdala, basal ganglia, claustrum, anterior, middle and posterior thalamus). CLT and FP are not spelled out in the paper; their contacts lie at the claustrum (MNI305 x ±32–38 mm, z ≈ 0 mm) and the frontal pole (y ≈ 70 mm) |
| F-TRACT | F-TRACT_P_01_v2307 ([Trebaul et al. 2018; Jedynak et al.](../reference/references.md#group-data-and-templates)), EBRAINS, CC BY-NC-SA 4.0: 625 implantations in 613 people. Julich-Brain 3.0 matrices over 314 areas (157 per hemisphere; rows stimulated, columns recorded): `probability`, `N_stimulations` (pairs) and `N_implantations`, each SHA-256 pinned. A pair responded when its absolute z-scored signal crossed 5 within 50 ms; a probability is published only from 10 pairs. 29.7% of ordered area pairs have one; median 0.043, 35% exactly 0, 0.09% exactly 1; median 0.063 within a hemisphere, 0 across |

The Zenodo archive is read by HTTP range requests (8 MiB blocks), so only the table and the 27 electrode files are fetched.

## Method

### Pair counts (Lyu et al.)

`read_table` (`scripts/fetch_stimulation_responses.py`) gives each channel a label and a side, `lh` if its MNI305 x < 0, else `rh`; this sign agreed with the L/R prefix of 99% of the channels carrying one. A channel labelled or placed two ways, an unknown label or an unknown class stops the fetch. Excluded pairs are counted apart. Each remaining pair adds to (stimulated label, recorded label, side), side `same` or `opposite`: tested pairs, responding pairs, set of subjects. Result: 1,243 label pairs by side (632 same, 611 opposite) over 240,319 tested pairs. The rate of a pair is

$$\text{rate} = \frac{\text{responded}}{\text{tested}},$$

drawn only when tested in ≥ 3 subjects (`rates.min_subjects`).

### Labels onto regions

- **By contacts (Destrieux).** Each cortical-label channel's fs_LR 32k vertex is taken on the HCP sphere scaled to `fsaverage`'s mean radius, matched to the nearest `fsaverage` vertex (`cKDTree`) and to its Destrieux parcel; 73 parcels receive channels. A parcel takes its majority label only with ≥ 10 channels, from ≥ 3 subjects, with ≥ 0.6 carrying that label; these thresholds were set on 3 November 2026 before any parcel was assigned. 42 parcels qualify; left and right parcels take the same label (84 regions).
- **By name (deep structures).** Hippocampus → `aseg` Hippocampus and the teaching set's hippocampal formation; amygdala → `aseg` Amygdala and amygdala and transition areas; basal ganglia → `aseg` Caudate, Putamen, Pallidum and the teaching set's caudate, putamen and both pallidal segments (accumbens excluded); claustrum → the teaching set's claustrum; the three thalamic sites → `aseg` Thalamus-Proper and the teaching set's thalamus. A teaching-set unit passes its labels to its NextBrain constituents: 283 regions.
- A region given two different labels, or a target naming a cortical label, is an error. HCP-MMP, Schaefer and Julich-Brain regions take no Lyu label.

### F-TRACT areas onto Julich-Brain

`scripts/fetch_stimulation_ftract.py` stops if counts are not whole, if pairs and implantations disagree on whether a pair was tested, or if a probability is published below 10 pairs or missing above it. It keeps every pair tested at least once (48,717). `stimulation_ftract.assign` matches each F-TRACT area to the Julich-Brain 3.1 region of the same name and hemisphere, ignoring case and spacing around commas, plus three listed renames: Entorhinal Cortex → Area EC, HC-Transsubiculum → TrS, Area TPJ (STG/SMG) → Area TPJ (STG, SMG). Two areas matching one region, or a rename matching none, stops the build. 252 regions (126 per hemisphere) match. Unmatched per hemisphere: twelve areas 3.1 carved from 3.0's gap maps (6r1, 6v1–6v3, FG5, MFG4, MFG5, OTS1, Op10, SFG2–SFG4) and the subicular complex. Pairs with at least one matched end are published (47,931). A rate is drawn where the pair was recorded in ≥ 3 implantations (set on 4 November 2026, before any area's rows were read).

## Display

**Stimulation responses** opens for a region with a Lyu label. **Direction** (**Stimulated here** | **Recorded here**) and **Hemisphere** (**Same side** | **Opposite side**) select the rows; a thalamic structure also selects one of the three positional sites. `responseRows` sorts drawn rates highest first, then pairs tested in fewer than 3 subjects ("no rate") by number tested; `untested` names labels never paired. Each row shows rate, bar, responding and tested pairs, and subjects. Both hemispheres show the same values. Example (Fig. 1a): the same parcel's Frontal pole row reads "no rate" (39 of 45 pairs, 1 subject).

A Julich-Brain area opens the F-TRACT section instead (`ftractRows`): drawn rates highest first, ties by more pairs; the first 10 rows are shown and the rest behind "N more areas"; the area's own row reads "Within this area". Each hemisphere keeps its own values. Example: left Area 45, **Stimulated here**, **Same side**: Within this area 84% (37 pairs, 6 implantations), then Area Op9 83% (53 pairs, 18 implantations); 81 drawn rates, 41 areas too thinly tested, 35 never tested.

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| `test_a_parcel_takes_a_label_only_past_every_threshold` | Channels, subjects and share thresholds all required | passes |
| `test_cdmd_regions_take_the_measured_and_named_labels_in_both_hemispheres` | Both hemispheres labelled alike | passes |
| `test_a_region_given_two_different_labels_is_refused`, `test_a_definition_that_would_misassign_is_refused`, `test_counts_that_cannot_be_are_refused` | Inconsistent definitions or counts refused | passes |
| `test_the_table_counts_responses_by_side_and_keeps_excluded_pairs_out`, `test_a_table_that_contradicts_itself_stops_the_fetch` | Table parsing | passes |
| `test_the_published_file_is_the_layer_output` (Lyu), `stimulation_responses.validate` | Published file equals the rebuild | 1,243 pairs; 367 regions with a label (84 by contacts, 283 by name); FP, MFC, MCC, INSULA/LFC and FG reach no region |
| Published Lyu counts | Responding / tested, by side | same 42.7%, opposite 15.5%; total 76,899 of 240,319 |
| `test_julich_areas_take_the_ftract_area_of_their_name_in_their_own_hemisphere` | Area 45, Te 1.0, IFJ1 and EC match in both hemispheres; gap maps, STN and subiculum do not | passes |
| `test_pairs_that_cannot_be_are_refused`, `test_matrices_that_contradict_the_descriptor_stop_the_fetch`, `test_the_fetch_keeps_every_tested_pair_with_its_probability_only_from_the_minimum`, `test_a_rename_that_reaches_no_region_is_refused` | F-TRACT fetch and matching | passes |
| `test_the_response_rate_falls_with_distance_between_matched_areas` | Median drawn rate > 0.3 at 0–20 mm and < 0.05 beyond 60 mm between CDMD centroids | 0.48 and 0; 20–40 mm 0.14, 40–60 mm 0.03; Spearman ρ −0.67 (20,132 pairs); two directions of a pair ρ 0.71 |
| `test_the_published_file_is_the_layer_output` (F-TRACT), `stimulation_ftract.validate` | Published file equals the rebuild | 47,931 pairs, 26,070 drawn rates, 252 regions, median drawn rate 0.05 |

Front-end checks: `web/src/lib/core/catalog/stimulation-responses.test.ts`, `web/src/lib/core/catalog/stimulation-ftract.test.ts`, `web/src/features/inspector/inspector.svelte.test.ts` ("stimulation responses" and "F-TRACT stimulation responses").

## Limitations

- Counts of channel pairs from people with focal epilepsy, not measurements in this brain; a person with many channels weighs more than one with few, hence the subject or implantation count beside every rate.
- Lyu labels are 26 coarse, hand-assigned regions; a Destrieux parcel takes one only through fs_LR 32k → `fsaverage` registration and the three thresholds; the thalamus takes positional sites, not nuclei.
- "No rate" means too few subjects or implantations; "not tested" means never tried; neither means no response.
- A Julich-Brain area takes the F-TRACT area of the same name, not place: F-TRACT assigned contacts with Julich-Brain 3.0's volumetric map in MNI152, whereas this surface carries the 3.1 `fsaverage` map.
- F-TRACT counts only responses within 50 ms; its other features (amplitude, latency) are not shown. F-TRACT v2112 was rejected because its rates rose across hemispheres.

## Code availability

| | |
| :--- | :--- |
| Code | [`scripts/fetch_stimulation_responses.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/fetch_stimulation_responses.py), [`brain_model/layers/stimulation_responses.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/stimulation_responses.py), [`scripts/fetch_stimulation_ftract.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/fetch_stimulation_ftract.py), [`brain_model/layers/stimulation_ftract.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/stimulation_ftract.py), [`web/src/lib/core/catalog/stimulation-responses.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/catalog/stimulation-responses.ts), [`web/src/lib/core/catalog/stimulation-ftract.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/catalog/stimulation-ftract.ts) |
| Configuration | [`config/stimulation-responses.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/stimulation-responses.yaml), [`config/stimulation-ftract.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/stimulation-ftract.yaml); fetched counts in [`data/stimulation-responses.json`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/stimulation-responses.json), [`data/stimulation-ftract.json`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/stimulation-ftract.json) |
| Tests | [`tests/test_stimulation_responses.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_stimulation_responses.py), [`tests/test_stimulation_ftract.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_stimulation_ftract.py), `brain_model.validate` |

```bash
uv run python scripts/fetch_stimulation_responses.py   # add --record to register the result
uv run python scripts/fetch_stimulation_ftract.py      # add --record to register the result
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_stimulation_responses.py tests/test_stimulation_ftract.py
npm test --prefix web
```

Figure state (open **Stimulation responses** for panel a): https://planumatlas.com/#anatomy=cdmd&atlas=destrieux&region=destrieux:left:14
