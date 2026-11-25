# Stimulation responses

For a selected region, the viewer lists how often single-pulse electrical stimulation at one site evoked a response at another, as response rates with their pair and subject counts. For Destrieux parcels and deep structures, the rates come from stereo-electroencephalography (SEEG) in 27 people with epilepsy (Lyu et al. 2025), pooled by the authors' 26 anatomical labels. For Julich-Brain areas they come from F-TRACT's atlas of 613 people, which also gives the delay to the peak of the response. These peak delays are plotted against the distance between the stimulated and the recorded area in this brain. Nothing else is measured in this brain: a region takes a label or an area name, and the rates and delays are the cohorts'.

```{figure} figures/stimulation-responses-1-light.webp
:alt: Two panels. a, the Stimulation responses section with Stimulated here and Same side chosen, listing recording labels with a bar, a percentage, and pair and people counts, from Middle thalamus at 75 percent to Orbitofrontal cortex at 51 percent. b, a brain seen from the left, coloured by Destrieux region, with the triangular part of the inferior frontal gyrus outlined in white.
:name: fig-stimulation-responses-1

**A cortical parcel takes the authors' label of the contacts inside it and shows that label's response rates.** **a**, The **Stimulation responses** section with **Stimulated here** and **Same side** chosen, for the triangular part of the left inferior frontal gyrus (`destrieux:left:14`), which takes "Lateral frontal cortex" from 92% of its 92 cortical channels in 21 people. Each row gives a recording label and its rate, the responding pairs over the tested pairs, then the pairs and the people. The first eight rows are shown, from Middle thalamus at 75% (167 of 223 pairs, 12 people). **b**, [The parcel](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&view=left&region=destrieux:left:14) (outlined) on CDMD `sub_013` with the Destrieux atlas, seen from the left. Scale bars apply at the depth of the camera's target.
```

## Data

| Input | Content | Version or pin | Licence |
| :--- | :--- | :--- | :--- |
| Lyu et al. | `DATA/metaTable.csv`: 275,336 stimulation–recording bipolar channel pairs from 27 subjects, with each channel's hand-assigned label (`JP_label_out`, `JP_label_in`), Montreal Neurological Institute (MNI) 305 x coordinate (`MNIout_coord_1`, `MNIin_coord_1`) and response class `umapAct` | [Lyu et al. 2025](../reference/references.md#group-data-and-templates), Zenodo 16939708; SHA-256 `fa9ce3fd…` | CC BY 4.0 |
| Electrodes | `DATA/workbench/subjects/<subject>/elec_FSLR_vIndex_wbComm_<subject>.csv`: each channel's fs_LR 32k vertex | Same Zenodo record; 27 files, SHA-256 pinned | CC BY 4.0 |
| Spheres | Human Connectome Project (HCP) `fs_LR-deformed_to-fsaverage.{L,R}.sphere.32k_fs_LR.surf.gii`; `fsaverage` `sphere.reg` and `aparc.a2009s` | HCPpipelines commit `0aef592a`; both spheres SHA-256 pinned | |
| Labels | 26: 18 cortical (frontal pole, lateral frontal, orbitofrontal, medial frontal, anterior cingulate, midcingulate, sensorimotor, insula, posteromedial, superior and inferior parietal, occipital, superior, middle and inferior temporal, temporal pole, fusiform, parahippocampal) and 8 deep or border (insula–lateral frontal border, hippocampus, amygdala, basal ganglia, claustrum, anterior, middle and posterior thalamus) | `config/stimulation-responses.yaml` | |
| F-TRACT | Julich-Brain 3.0 matrices over 314 areas (157 per hemisphere; rows stimulated, columns recorded): `probability`, `N_stimulations` (pairs) and `N_implantations`, from 625 implantations in 613 people | F-TRACT_P_01_v2307 ([Trebaul et al. 2018; Jedynak et al.](../reference/references.md#group-data-and-templates)), EBRAINS; each matrix SHA-256 pinned | CC BY-NC-SA 4.0 |
| F-TRACT peak delay | `peak_delay__median` and `peak_delay__mad`, in ms | Same release and folder; SHA-256 `c8710c81…` and `36bd9d06…` | CC BY-NC-SA 4.0 |

The Zenodo archive is read by HTTP range requests (8 MiB blocks), so only the table and the 27 electrode files are fetched.

In Lyu et al.'s table, `umapAct` classes each pair: 1 responded (76,899), 0 no response (163,420), `NaN` excluded as artefact or bad channel (35,017). Two of the label ids, CLT and FP, are not spelled out in the paper. Their contacts lie at the claustrum (MNI305 x ±32–38 mm, z ≈ 0 mm) and the frontal pole (y ≈ 70 mm).

In F-TRACT, a stimulation–recording pair responded when its absolute z-scored signal crossed 5 within 50 ms. A probability is published only from 10 such pairs. Of the ordered area pairs, 29.7% have one: median 0.043, 35% exactly 0, 0.09% exactly 1. The median is 0.063 within a hemisphere and 0 across.

The data descriptor defines the peak delay as the time from stimulation to the maximum of the first peak above threshold. Each published value is a median over the area pair's responding stimulation–recording pairs, with its median absolute deviation (MAD), and is published only from 10 responses. Responses later than 50 ms are ignored as presumably indirect. A peak delay is published for 7,542 ordered area pairs (7.6%): 5.0–49.2 ms, median 26.0 ms, median MAD 7.8 ms. Onset delay is not read, because the descriptor defines it as the threshold crossing in one place and as the last minimum before the peak in another.

## Method

### Pair counts (Lyu et al.)

`read_table` (`scripts/fetch_stimulation_responses.py`) gave each channel a label and a side, `lh` if its MNI305 x < 0, else `rh`. This sign agreed with the L/R prefix of 99% of the channels carrying one (measured on 3 November 2026). A channel labelled or placed two ways, an unknown label or an unknown class stops the fetch. Excluded pairs were counted apart. Each remaining pair was added to the counts of its stimulated label, recorded label and side (`same` or `opposite`): tested pairs, responding pairs and the set of subjects. The result is 1,243 label pairs by side (632 same, 611 opposite) over 240,319 tested pairs. The rate of a pair is

$$\text{rate} = \frac{\text{responded}}{\text{tested}},$$

drawn only when tested in ≥ 3 subjects (`rates.min_subjects`).

### Labels onto regions

Cortical labels reach Destrieux parcels through the contacts. Each cortical-label channel's fs_LR 32k vertex was taken on the HCP sphere scaled to `fsaverage`'s mean radius, matched to the nearest `fsaverage` vertex (`cKDTree`) and to its Destrieux parcel. Channels were counted by parcel name, the two hemispheres together, and 73 parcels received channels. A parcel takes its majority label only with ≥ 10 channels, from ≥ 3 subjects, with ≥ 0.6 carrying that label. These thresholds were set on 3 November 2026 before any parcel was assigned. Of the 73, 42 parcels qualify, and left and right parcels take the same label (84 regions).

Deep labels reach structures by name, in FreeSurfer's subcortical segmentation (`aseg`) and in Planum's teaching set:

| Label | Regions |
| :--- | :--- |
| Hippocampus | `aseg` Hippocampus; the teaching set's hippocampal formation |
| Amygdala | `aseg` Amygdala; the teaching set's amygdala and transition areas |
| Basal ganglia | `aseg` Caudate, Putamen, Pallidum; the teaching set's caudate, putamen and both pallidal segments (accumbens excluded) |
| Claustrum | the teaching set's claustrum |
| Anterior, middle and posterior thalamus | `aseg` Thalamus-Proper; the teaching set's thalamus |

A teaching-set unit passes its labels to its NextBrain constituents. By name, 283 regions take a label.

A region given two different labels, or a target naming a cortical label, is an error. Desikan-Killiany, HCP-MMP, Schaefer and Julich-Brain regions take no Lyu label.

### F-TRACT areas onto Julich-Brain

`scripts/fetch_stimulation_ftract.py` stops if counts are not whole, if pairs and implantations disagree on whether a pair was tested, or if a probability is published below 10 pairs or missing above it. It kept every pair tested at least once (48,717). `stimulation_ftract.assign` matched each F-TRACT area to the Julich-Brain 3.1 region of the same name and hemisphere, ignoring case and spacing around commas, plus three listed renames: Entorhinal Cortex → Area EC, HC-Transsubiculum → TrS, Area TPJ (STG/SMG) → Area TPJ (STG, SMG). Two areas matching one region, or a rename matching none, stops the build. In all, 252 regions (126 per hemisphere) match. Unmatched per hemisphere are twelve areas that 3.1 carved from 3.0's gap maps (6r1, 6v1–6v3, FG5, MFG4, MFG5, OTS1, Op10, SFG2–SFG4) and the subicular complex. F-TRACT's 3.0 area Subiculum is left without a region, because no source was found that states 3.1's subicular complex to be the same map. Pairs with at least one matched end are published (47,931). A rate is drawn where the pair was recorded in ≥ 3 implantations. That threshold was set on 4 November 2026, before any area's rows were read.

### F-TRACT peak delays

`read_delays` (`scripts/fetch_stimulation_ftract.py`) kept every published delay with its MAD. It stops if one lacks the other, if a delay lies outside (0, 50] ms, or if a delay sits on a pair with fewer than 10 responses. Responses are probability × pairs, and the probability is written to three decimals, so the count is known to ±0.0005 × pairs. `stimulation_ftract.partition` publishes a delay only for a pair whose rate is drawn (≥ 3 implantations; 62 of 7,542 fall below) and that has a matched end: 7,248. A delay between two different matched areas carries the distance between their centroids in subject `sub_013` of the MGH Connectome Diffusion Microstructure Dataset (CDMD), in surface RAS (right, anterior, superior) coordinates, rounded to 0.1 mm (4,840 delays, 2.6–99.9 mm). A delay within an area, or with an end that has no region, carries no distance (2,408).

## Display

**Stimulation responses** appears for a region with a Lyu label (Fig. 1a,b). **Direction** (**Stimulated here** | **Recorded here**) and **Hemisphere** (**Same side** | **Opposite side**) select the rows. A thalamic structure also offers **Thalamic site**, which selects one of the three positional sites. `responseRows` sorts drawn rates highest first, then pairs tested in fewer than 3 subjects ("no rate") by number tested. `untested` names labels never paired, which the section lists after "Not tested:". Each row shows rate, bar, responding and tested pairs, and subjects. Both hemispheres show the same values. In the parcel of Fig. 1a, the Frontal pole row reads "no rate" (39 of 45 pairs, 1 subject).

For a Julich-Brain area, **Stimulation responses** shows F-TRACT's rates instead (`ftractRows`). Drawn rates run highest first, ties by more pairs. The first 10 rows are shown and the rest sit behind "N more areas". The area's own row reads "Within this area". Each hemisphere keeps its own values. For left Area 45 with **Stimulated here** and **Same side**, the first rows are Within this area 84% (37 pairs, 6 implantations), then Area Op9 83% (53 pairs, 18 implantations). That choice has 81 drawn rates, 41 areas too thinly tested and 35 never tested.

A drawn row with a published delay ends "· peak N ms" (whole ms). Under the rows, **Peak delay by distance** plots those rows that have a distance, with centroid distance across and peak delay up. The scale is the same for every area and choice. Distance runs 0–100 mm, the longest distance of any delay rounded up to a multiple of 20 mm, and delay runs 0–50 ms, the response window. A line counts the delays not plotted for want of a distance. A closed **Delays and distances** table lists every row with a delay (area, distance, peak, MAD), nearest first. It is the plot's text alternative. Where no drawn row on the side has a delay, a note says F-TRACT gives one only from 10 responses. For left Area 45 with **Stimulated here** and **Same side**, Within this area peaks at 13 ms and Area Op9 at 18 ms. Of the 16 rows with a delay, 9 are plotted, from Area 44 (13.5 mm, 23 ms) to Area Op5 (30.4 mm, 26 ms).

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| `test_a_parcel_takes_a_label_only_past_every_threshold` | Channels, subjects and share thresholds all required | passes |
| `test_cdmd_regions_take_the_measured_and_named_labels_in_both_hemispheres` | Both hemispheres labelled alike | passes |
| `test_a_region_given_two_different_labels_is_refused`, `test_a_definition_that_would_misassign_is_refused`, `test_counts_that_cannot_be_are_refused` | Inconsistent definitions or counts refused | passes |
| `test_the_table_counts_responses_by_side_and_keeps_excluded_pairs_out`, `test_a_table_that_contradicts_itself_stops_the_fetch` | Table parsing | passes |
| `test_the_published_file_is_the_layer_output` (Lyu), `stimulation_responses.validate` | Published file equals the rebuild | 1,243 pairs; 367 regions with a label (84 by contacts, 283 by name); FP, MFC, MCC, INSULA/LFC and FG reach no region |
| Published Lyu counts | Responding / tested, by side | same 42.7%, opposite 15.5%; total 76,899 of 240,319 |
| `test_julich_areas_take_the_ftract_area_of_their_name_in_their_own_hemisphere` | Area 45, Te 1.0, IFJ1 and EC match in both hemispheres; gap maps, the subthalamic nucleus (STN) and subiculum do not | passes |
| `test_pairs_that_cannot_be_are_refused`, `test_matrices_that_contradict_the_descriptor_stop_the_fetch`, `test_the_fetch_keeps_every_tested_pair_with_its_probability_only_from_the_minimum`, `test_a_rename_that_reaches_no_region_is_refused` | F-TRACT fetch and matching | passes |
| `test_the_response_rate_falls_with_distance_between_matched_areas` | Median drawn rate > 0.3 at 0–20 mm and < 0.05 beyond 60 mm between CDMD centroids | 0.48 and 0 |
| `test_the_published_file_is_the_layer_output` (F-TRACT), `stimulation_ftract.validate` | Published file equals the rebuild | 47,931 pairs, 26,070 drawn rates, 252 regions, median drawn rate 0.05 |
| `test_farther_areas_answer_later`, `stimulation_ftract.check_delays` | Across delays between two different matched areas, peak delay rises with centroid distance (`scipy.stats.spearmanr`, ρ > 0, p < 0.001); median delay within a hemisphere below that across | ρ 0.245, p 5.6 × 10⁻⁶⁷ (4,840 delays); within 25.9 ms (4,741), across 27.4 ms (99) |
| `test_delays_that_fall_with_distance_stop_validation` | The check refuses delays reversed against distance, and delays slower within a hemisphere than across | passes |
| `test_the_fetch_keeps_every_peak_delay_with_its_deviation_even_at_a_rounded_tenth_response`, `test_delays_that_contradict_the_descriptor_stop_the_fetch`, `test_delays_that_cannot_be_are_refused`, `test_a_delay_is_published_only_where_its_rate_is_drawn_with_the_centroid_distance_in_this_brain` | Delay fetch, checks and publication | passes |

Between the two distance bands of the rate test, the median drawn rate is 0.14 at 20–40 mm and 0.03 at 40–60 mm. Over the drawn rates between two different matched areas, the rate falls with centroid distance (Spearman ρ −0.67, 20,132 ordered pairs). Among the same rates, the two directions of an area pair are correlated (Spearman ρ 0.71, 9,300 area pairs drawn in both directions).

The delay check was fixed on 16 November 2026, before delays were compared with distance, and either part failing stops validation. The rise of delay with distance is what the atlas's authors report for modelled axonal delays ([Lemaréchal et al. 2022](../reference/references.md#group-data-and-templates)). The median peak delay by centroid distance is 24.9 ms at 0–20 mm (1,677 delays), 26.8 ms at 20–40 mm (2,430), 28.7 ms at 40–60 mm (634), 31.6 ms at 60–80 mm (87) and 32.7 ms beyond 80 mm (12).

The front-end checks are in `web/src/lib/core/catalog/stimulation-responses.test.ts`, `web/src/lib/core/catalog/stimulation-ftract.test.ts`, `web/src/features/inspector/inspector.svelte.test.ts` ("stimulation responses" and "F-TRACT stimulation responses"), `web/src/features/inspector/FtractSection.svelte.test.ts` (peak delays and their plot).

## Limitations

The rates come from counts of channel pairs in people with focal epilepsy, not from measurements in this brain. A person with many channels weighs more than one with few, hence the subject or implantation count beside every rate.

Lyu labels are 26 coarse, hand-assigned regions. A Destrieux parcel takes one only through fs_LR 32k → `fsaverage` registration and the three thresholds. The thalamus takes positional sites, not nuclei.

"No rate" means too few subjects or implantations. "Not tested" means never tried. Neither means no response.

A Julich-Brain area takes the F-TRACT area of the same name, not of the same place. F-TRACT assigned contacts with Julich-Brain 3.0's volumetric map in MNI152, whereas this surface carries the 3.1 `fsaverage` map.

F-TRACT counts only responses within 50 ms. Of its other features only the peak delay is shown, not amplitude, onset delay or the modelled axonal delay. F-TRACT v2112 was rejected because its rates rose across hemispheres.

Peak delays come from people with focal epilepsy. Each is a median across the responding stimulation–recording pairs of every implantation that tested the pair, not one person's delay.

A response may arrive through more than one synapse, and the peak includes the time the recorded area takes to respond, so a delay is not a conduction time along one fibre. The authors' modelled axonal delays are shorter (median 10.2 ms in people over 15, Lemaréchal et al. 2022).

Distances are between the two areas' centroids in this brain, not between the contacts, and not along the fibres. Only 99 delays cross the hemispheres.

Onset delay is not shown. The data descriptor defines it two ways, which should be settled with the authors first.

## Code availability

Code
: [`scripts/fetch_stimulation_responses.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/fetch_stimulation_responses.py), [`brain_model/layers/stimulation_responses.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/stimulation_responses.py), [`scripts/fetch_stimulation_ftract.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/fetch_stimulation_ftract.py), [`brain_model/layers/stimulation_ftract.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/stimulation_ftract.py), [`web/src/lib/core/catalog/stimulation-responses.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/catalog/stimulation-responses.ts), [`web/src/lib/core/catalog/stimulation-ftract.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/catalog/stimulation-ftract.ts)

Configuration
: [`config/stimulation-responses.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/stimulation-responses.yaml), [`config/stimulation-ftract.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/stimulation-ftract.yaml)

Fetched counts
: [`data/stimulation-responses.json`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/stimulation-responses.json), [`data/stimulation-ftract.json`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/stimulation-ftract.json)

Tests
: [`tests/test_stimulation_responses.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_stimulation_responses.py), [`tests/test_stimulation_ftract.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_stimulation_ftract.py), `brain_model.validate`

```bash
uv run python scripts/fetch_stimulation_responses.py   # add --record to register the result
uv run python scripts/fetch_stimulation_ftract.py      # add --record to register the result
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_stimulation_responses.py tests/test_stimulation_ftract.py
npm test --prefix web
```

