# Stimulation responses

A region the authors' intracranial map labels opens how often single-pulse electrical stimulation there evoked a response at each other site, or stimulating another site evoked one here, counted from stereo-EEG recordings in 27 people with epilepsy (Lyu et al. 2025). A Julich-Brain area opens the same question at the resolution of its cytoarchitectonic areas, from F-TRACT's atlas of 613 people ([F-TRACT for Julich-Brain areas](#f-tract-for-julich-brain-areas)).

:::{list-table}
:widths: 22 78
:stub-columns: 1

* - Where in the viewer
  - The region inspector's **Stimulation responses** section (collapsed, after the receptor densities), for a region that takes one of the authors' labels (364 regions on CDMD), or for a Julich-Brain area F-TRACT has (252 regions)
* - Built by
  - [`scripts/fetch_stimulation_responses.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/fetch_stimulation_responses.py), [`brain_model/layers/stimulation_responses.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/stimulation_responses.py); the section is `web/src/features/inspector/StimulationSection.svelte`. F-TRACT: [`scripts/fetch_stimulation_ftract.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/fetch_stimulation_ftract.py), [`brain_model/layers/stimulation_ftract.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/stimulation_ftract.py), `web/src/features/inspector/FtractSection.svelte`
* - Configuration
  - [`config/stimulation-responses.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/stimulation-responses.yaml); the fetched counts are committed in [`data/stimulation-responses.json`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/stimulation-responses.json). F-TRACT: [`config/stimulation-ftract.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/stimulation-ftract.yaml), [`data/stimulation-ftract.json`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/stimulation-ftract.json)
* - Source data
  - Lyu, Stiger, Lusk, Buch and Parvizi (2025), *Nat Neurosci* 28:1797–1809, dataset Zenodo 16939708; CC BY 4.0; HCP's fs_LR-to-fsaverage sphere deformations. F-TRACT parcellation-based atlas F-TRACT_P_01_v2307 (Jedynak et al., EBRAINS, [10.25493/JYVR-WJ7](https://doi.org/10.25493/JYVR-WJ7)); CC BY-NC-SA 4.0; method Trebaul et al. (2018), *NeuroImage* 181:414–429
* - Checked by
  - [`tests/test_stimulation_responses.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_stimulation_responses.py), `brain_model.validate`, `web/src/lib/core/catalog/stimulation-responses.test.ts`, `web/src/features/inspector/inspector.svelte.test.ts` (INSP-43); F-TRACT: [`tests/test_stimulation_ftract.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_stimulation_ftract.py), `web/src/lib/core/catalog/stimulation-ftract.test.ts`, INSP-44
:::

## What it does

```{figure} ../../.github/assets/readme/stimulation.webp
:alt: Stimulation-response rates for the left hippocampal formation, a bar and percentage for each other site, with pair and subject counts

The left hippocampal formation's stimulation responses: how often a pulse here evoked activity at each other site, stimulated on the same side.
```

A region the authors' intracranial map labels opens **Stimulation responses**: from single-pulse stereo-EEG stimulation in people with epilepsy, how often stimulating this site evoked a response at another, or stimulating another evoked one here. Choose the **direction** (stimulated here or recorded here) and **hemisphere** (same or opposite side); a thalamic region offers a **site**, since the authors group thalamic contacts by position, not nucleus, so every thalamic structure shows all three sites. Each row bars the response rate with the pairs it rests on and the people tested; a pair tested in too few people shows its counts with no rate, and an untested label is named separately.

This is pooled evidence from implanted electrodes in a different population, not a measurement in this brain; both hemispheres show the same values. Sources: [Lyu et al. (2025)](https://doi.org/10.1038/s41593-025-02009-x) and its [Zenodo dataset](https://doi.org/10.5281/zenodo.16939708).

## Data

The authors publish every stimulation–recording channel pair they examined in `DATA/metaTable.csv` (275,335 rows, 27 subjects, about 128 MB inside a 19 GB `DATA.zip`), with the authors' anatomical labels, MNI coordinates (MNI305, the iElVis frame, not MNI152) and whether the pair responded. Each subject's bipolar channels come with their fs_LR 32k vertex in `DATA/workbench/subjects/<subject>/elec_FSLR_vIndex_wbComm_<subject>.csv`.

| Field | Meaning |
| :--- | :--- |
| `JP_label_out`, `JP_label_in` | The authors' anatomical label of the stimulated and the recording channel: 26 labels assigned by hand on each person's own T1 scan |
| `MNIout_coord_1`, `MNIin_coord_1` | MNI305 x of the two channels; the sign gives the side |
| `umapAct` | The authors' response class: `1` responded (76,899), `0` tested with no response (163,420), `NaN` excluded as artefact or bad channel (35,017) |

The authors' 26 labels, in display order, are in `config/stimulation-responses.yaml`: frontal pole, lateral frontal, orbitofrontal, medial frontal, anterior cingulate, midcingulate, sensorimotor, insula, insula–lateral frontal border, posteromedial, superior and inferior parietal, occipital, superior, middle and inferior temporal gyri, temporal pole, fusiform, parahippocampal, hippocampus, amygdala, basal ganglia, claustrum, and anterior, middle and posterior thalamus. CLT and FP are not spelled out in the paper; their contacts lie at the claustrum (MNI305 x ±32–38, z about 0 mm) and the frontal pole (y about 70 mm). Of these, 18 are cortical labels that contacts assign to parcels; the other eight (the insula–lateral frontal border, hippocampus, amygdala, basal ganglia, claustrum and the three thalamic sites) are deep or border labels.

The archive is read by HTTP range requests (`RangeFile`, 8 MB blocks, so `zipfile` can seek in the remote file); only `metaTable.csv` and the 27 electrode files are fetched, each pinned by SHA-256 (the table `fa9ce3fd…`). The HCP spheres `fs_LR-deformed_to-fsaverage.{L,R}.sphere.32k_fs_LR.surf.gii` are pinned at HCPpipelines commit `0aef592a…`.

## How it was built

`uv run python scripts/fetch_stimulation_responses.py [--record]` reads the pinned files into `data/stimulation-responses.json`; the build reads that file.

### 1. Count the pairs

`read_table` reads `metaTable.csv` row by row. For every channel it records the label and the side (`lh` if the MNI x is negative, else `rh`; the sign agreed with the L/R prefix of 99% of the channels that carry one, measured 3 November 2026); a channel labelled or placed two ways stops the fetch. A pair with class `NaN` is counted as excluded, and any other class is an error. A pair whose two labels are not among the 26 stops the fetch. Each remaining pair is added to the count for (stimulated label, recorded label, side), where the side is `same` if both channels are in one hemisphere and `opposite` otherwise: tested pairs, responding pairs and the set of people. The result is 1,243 label pairs by side (632 same, 611 opposite) over 240,319 tested pairs, with 35,017 excluded.

### 2. Carry cortical channels to Destrieux parcels

For each cortical-label channel, `destrieux` takes its fs_LR 32k vertex, scales the fs_LR sphere to the radius of `fsaverage`'s `sphere.reg` (the two differ in radius, so the nearest neighbour is taken on one), finds the nearest `fsaverage` vertex (`cKDTree`) and the Destrieux parcel (`aparc.a2009s`) of that vertex. Per parcel it counts the channels of each label and the number of people. The 73 parcels that contacts reach are written to the data file.

### 3. Assign labels to regions

`stimulation_responses.assign` gives each region its labels and how it came by them:

- **By contacts (Destrieux).** A parcel takes the label most of its cortical channels carry only if all three thresholds are met, which were set before any parcel was assigned (3 November 2026): at least `min_channels` = 10 channels, from at least `min_subjects` = 3 people, with at least `min_share` = 0.6 of them carrying that label. 42 of the 73 parcels are assigned; the left and right parcel take the same label (84 regions on CDMD). Frontal pole (FP), midcingulate (MCC), medial frontal (MFC) and fusiform (FG) win no parcel.
- **By name (deep structures).** The `targets` list ties a label to named regions: hippocampus to `aseg` Hippocampus and the teaching set's hippocampal formation; amygdala to `aseg` Amygdala and the teaching set's amygdala and transition areas; basal ganglia to `aseg` caudate, putamen and pallidum and the teaching set's caudate, putamen and both pallidal segments (read as the authors describe it, putamen and pallidum, with the caudate; the accumbens is left out); claustrum to the teaching set's claustrum; and anterior, middle and posterior thalamus to `aseg` Thalamus-Proper and the teaching set's thalamus, so every thalamic structure shows all three sites. An `aseg` name is matched with its hemisphere prefix, and a teaching unit passes its labels to its NextBrain constituents. 280 regions take labels this way. Insula–lateral frontal border, a non-cortical label, reaches no region.
- A region may not take two different labels; a Destrieux parcel named twice, or a target naming a cortical label, is an error.

HCP-MMP and Schaefer regions take no label, and neither do Julich-Brain areas, which show F-TRACT's rates instead.

### 4. Publish

`public/models/cdmd/stimulation-responses.json` carries the cohort size, the excluded count, the minimum number of people for a rate (3), the labels (bilingual, with short names for the thalamic sites), the pairs and each region's labels and basis.

## How the viewer uses it

- **Catalogue.** `web/src/lib/core/catalog/stimulation-responses.ts`: `validateStimulationResponses` checks the file; `labelsOf` gives a region's labels; `responseRows(data, label, direction, side)` returns the other end of every tested pair from or to the label on one side, with `rate = responded / tested` and `drawn = people ≥ min_subjects`. Rates drawn from enough people come first, highest first; the rest follow by how often they were tested. `untested` lists the labels never tested with the label in that direction and side.
- **Section.** After the receptor densities, the section has two controls: Direction (Stimulated here | Recorded here) and Hemisphere (Same side | Opposite side); a thalamic structure also offers the three positional sites. Each row names the other label, then its rate and bar (decorative, a whole-percent rate), then responded and tested pairs and the people tested; a pair tested in fewer than the minimum number of people says "no rate". The note gives the cohort, the minimum, the excluded pairs and that nothing is measured in this brain; the next line says how the region took its label (the share of its cortical channels, or by name), and a thalamic structure says the sites are positions, not nuclei. The paper and the Zenodo dataset are links. In French: "Réponses à la stimulation".
- **Example.** The left Destrieux parcel `destrieux:left:14` takes "Lateral frontal cortex" from 92% of its 92 cortical channels from 21 people. Its first row reads Middle thalamus 75% (167 of 223 pairs, 12 people), and the Frontal pole row reads "no rate" (39 of 45 pairs, 1 person).
- **Totals.** The published counts total 76,899 responding of 240,319 tested pairs.

## Checks

| Check | Where | Result |
| :--- | :--- | :--- |
| Source, archive hashes, label ids and assignment thresholds are well formed | `read_definition` | refuses a missing hash, a duplicated label, a threshold that would misassign, a target naming a cortical label or a region named by two targets |
| Counts are possible | `read_data` | refuses a repeated pair, an unknown label or side, responded above tested, or people above the cohort |
| Table contradicts itself | `read_table` | stops the fetch on a channel labelled or placed two ways, an unknown label or an unknown response class |
| A parcel takes a label only past every threshold | `test_a_parcel_takes_a_label_only_past_every_threshold` | pass |
| CDMD regions take the measured and named labels in both hemispheres | `test_cdmd_regions_take_the_measured_and_named_labels_in_both_hemispheres` | pass |
| A region given two labels is refused | test | pass |
| The published file is the layer output | `validate`, `test_the_published_file_is_the_layer_output` | rebuilt from sources equals published: 1,243 pairs, 364 regions with a label; labels reaching no region: FP, MFC, MCC, INSULA/LFC, FG |
| Sanity of the source | measured when inspected | response rate falls with distance (86% under 20 mm, 12% beyond 80 mm); same hemisphere 43%, opposite 16% |

## Limits

- Counts of stereo-EEG channel pairs from 27 people with focal epilepsy, pooled by the authors' anatomical labels and by side. They are not measured in this brain, both hemispheres show the same values, and a person with many channels weighs more than one with few; hence the people count beside every rate and a minimum of three people before a rate is drawn.
- A Destrieux parcel takes an author label only with at least 10 cortical channels from 3 people through fs_LR 32k to `fsaverage` surface registration and 60% of them carrying that label; other parcels, and the HCP-MMP, Julich-Brain and Schaefer atlases, show none. Deep structures take labels by name, and the thalamus takes the authors' three positional sites, not nuclei.
- Labels were assigned by hand on each person's own T1; 26 labels are coarse. Timing columns in the source are template-correlation peaks, not onset latencies, and are not used.
- "No rate" means too few people, "not tested" means the pair was never tried; neither is "no response".
- F-TRACT v2112 (Zenodo) was inspected for the same purpose and rejected: its counts exist only in pickled features, its "probability" is defined only where count is at least 5, and it is not a plain response rate (median 0.95, 38% exactly 1.0; 0.99 between hemispheres against 0.95 within, contradicting the published fall-off with distance); the Zenodo licence field is CC BY 4.0 but the readme says "research use only". Version v2307 on EBRAINS resolves each point and is used for Julich-Brain areas ([below](#f-tract-for-julich-brain-areas)).

## F-TRACT for Julich-Brain areas

F-TRACT aggregates single-pulse stimulation in 625 stereo-EEG implantations of 613 people with focal epilepsy over 23 parcellations (data descriptor, F-TRACT_P_01_v2307). Its Julich-Brain 3.0 matrices give, for every ordered pair of 314 areas (157 per hemisphere, rows stimulated, columns recorded), the **probability** that a pair responded, the **stimulation–recording pairs** it rests on (`N_stimulations`) and the **implantations** they come from (`N_implantations`). A pair responded when the absolute z-scored signal crossed 5 within 50 ms; the probability is responding pairs over all, published only from 10 pairs. Every file header states CC BY-NC-SA 4.0, the licence of Julich-Brain itself.

### Why v2307 and not v2112

Measured on 4 November 2026 on the Julich-Brain matrix: 29.5% of pairs have a probability, the median is 0.042, 35% are exactly 0 and 0.07% exactly 1; the ipsilateral median is 0.062 against 0.0 contralateral. On CDMD's Julich-Brain centroids, among drawn rates (at least 3 implantations), the median falls from 0.48 under 20 mm to 0.14 at 20–40 mm, 0.03 at 40–60 mm and 0 beyond 60 mm (Spearman ρ −0.67 with distance), and a pair's two directions agree (ρ 0.71). The counts are published beside the probability, so a pair never tested (no pairs) is told from one tested too thinly.

### Build

1. `scripts/fetch_stimulation_ftract.py` downloads the area list and the three matrices from the EBRAINS bucket, each pinned by SHA-256, and stops if counts are not whole, if a pair has pairs but no implantation (or the reverse), or if a probability is published below 10 pairs or missing above it. It writes every pair tested at least once (48,717) to `data/stimulation-ftract.json`; F-TRACT's `Area_45_(IFG)_L` becomes `Area 45 (IFG)` in the left hemisphere.
2. `stimulation_ftract.assign` matches each F-TRACT area to the Julich-Brain region of the same name and hemisphere, ignoring case and the space after a comma (3.0's `Area TE 1.0 (HESCHL)` and `Area IFJ1 (IFS,PreCS)` are 3.1's `Area Te 1.0 (HESCHL)` and `Area IFJ1 (IFS, PreCS)`). Three areas 3.1 renamed are listed in the configuration: Entorhinal Cortex → Area EC, HC-Transsubiculum → TrS, and Area TPJ (STG/SMG) → Area TPJ (STG, SMG). Two parcels matching one region, or a rename matching none, stop the build.
3. On CDMD 252 regions (126 per hemisphere) take an area. Thirteen Julich-Brain 3.1 areas per hemisphere take none: twelve that 3.1 carved out of 3.0's gap maps (6r1, 6v1–6v3, FG5, MFG4, MFG5, OTS1, Op10, SFG2–SFG4) and the subicular complex, which 3.0 publishes as "Subiculum" with nothing found stating the maps are the same. F-TRACT's gap maps and deep areas (amygdala and basal-forebrain nuclei, the subthalamic nucleus, the cerebellar nuclei and others) open no section but appear as the other end of a row.
4. `public/models/cdmd/stimulation-ftract.json` carries the cohort, the two minima, the areas (F-TRACT's name, the region it matched and that region's 3.1 name) and every pair with at least one matched end (47,931), written compactly.

### In the viewer

`web/src/lib/core/catalog/stimulation-ftract.ts` validates the file and `ftractRows(data, parcel, direction, side)` returns the other areas on the chosen side: a rate is drawn from F-TRACT's probability where the pair was recorded in at least 3 implantations (the minimum of people Lyu et al.'s rates need, set before any area's rows were read), highest first and the more tested first among equals; the rest are counted as too thin, and the areas left on that side as never tested. `FtractSection.svelte` shows the first 10 rates and the rest behind "N more areas", each with its pairs and implantations; the area's own row reads "Within this area" (contacts elsewhere in the same area). Each hemisphere keeps its own values. Example: left Area 45, Stimulated here, Same side, reads first "Within this area 84%, 37 pairs · 6 implantations", then "Area Op9 (Frontal Operculum) 83%, 53 pairs · 18 implantations", 81 drawn rates, 41 areas too thin and 35 never tested.

### Checks

| Check | Where | Result |
| :--- | :--- | :--- |
| Files, cohort, minimum and renames are well formed | `read_definition` | refuses a missing hash, people above implantations, or two renames to one name |
| Pairs are possible | `read_data`, `validateStimulationFtract` | refuse a repeated pair, an unknown area, implantations above pairs or the cohort, or a probability the 10-pair minimum contradicts |
| Matching | `test_julich_areas_take_the_ftract_area_of_their_name_in_their_own_hemisphere` | Area 45, Te 1.0, IFJ1 and EC match in both hemispheres; gap maps, the STN and the subiculum do not |
| Fall-off with distance | `test_the_response_rate_falls_with_distance_between_matched_areas` | median above 0.3 under 20 mm, below 0.05 beyond 60 mm |
| The published file is the layer output | `validate`, `test_the_published_file_is_the_layer_output` | 47,931 pairs, 26,070 drawn rates, 252 regions matched, median drawn rate 0.05 |

### Limits

- Rates of stimulation–recording pairs pooled over 613 people with focal epilepsy, not measured in this brain; heavily implanted people weigh more, hence the implantations beside every rate. Responses are those within 50 ms; later responses are not counted.
- A Julich-Brain area takes the F-TRACT area of the same **name**, not of the same place: F-TRACT assigned contacts with Julich-Brain 3.0's volumetric map in MNI152, while this surface carries the 3.1 `fsaverage` map projected onto CDMD. The two transfers disagree on about half the cortex (EBRAINS survey, 2026-10-28, a left-hemisphere pilot: the volumetric map carried to `fsaverage` by RF-ANTs matched the published `fsaverage` map on 48.8%).
- F-TRACT's response features beyond the probability (amplitude, latencies, delays, speeds) are published but not shown.

## Reproduce

```bash
# Read the pinned members of the Zenodo archive by range request (add --record to register the result)
uv run python scripts/fetch_stimulation_responses.py
# F-TRACT's Julich-Brain matrices from EBRAINS (add --record to register the result)
uv run python scripts/fetch_stimulation_ftract.py

uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_stimulation_responses.py tests/test_stimulation_ftract.py
npm test --prefix web
```

## See also

- [Receptor fingerprints](receptor-fingerprints.md): the section above it in the inspector.
- [Cortical atlases](cortical-atlases.md): Destrieux, which the contacts are carried onto.
- [Internal anatomy](internal-anatomy.md): the structures labelled by name.
- [Published coordinates](published-coordinates.md): MNI frames and their offsets.
- [References and licensing](../reference/references.md), [Validation and limits](../pipeline/validation.md).
