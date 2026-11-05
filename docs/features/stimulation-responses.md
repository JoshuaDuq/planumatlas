# Stimulation responses

A region the authors' intracranial map labels opens how often single-pulse electrical stimulation there evoked a response at each other site, or stimulating another site evoked one here, counted from stereo-EEG recordings in 27 people with epilepsy (Lyu et al. 2025).

:::{list-table}
:widths: 22 78
:stub-columns: 1

* - Where in the viewer
  - The region inspector's **Stimulation responses** section (collapsed, after the receptor densities), for a region that takes one of the authors' labels (364 regions on CDMD).
* - Built by
  - [`scripts/fetch_stimulation_responses.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/fetch_stimulation_responses.py), [`brain_model/layers/stimulation_responses.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/stimulation_responses.py); the section is `web/src/features/inspector/StimulationSection.svelte`
* - Configuration
  - [`config/stimulation-responses.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/stimulation-responses.yaml); the fetched counts are committed in [`data/stimulation-responses.json`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/stimulation-responses.json)
* - Source data
  - Lyu, Stiger, Lusk, Buch and Parvizi (2025), *Nat Neurosci* 28:1797–1809, dataset Zenodo 16939708; CC BY 4.0; HCP's fs_LR-to-fsaverage sphere deformations
* - Checked by
  - [`tests/test_stimulation_responses.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_stimulation_responses.py), `brain_model.validate`, `web/src/lib/core/catalog/stimulation-responses.test.ts`, `web/src/features/inspector/inspector.svelte.test.ts` (INSP-43)
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

HCP-MMP, Julich-Brain and Schaefer regions show no section.

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
- F-TRACT v2112 was inspected for the same purpose and rejected: its counts exist only in pickled features, its "probability" is defined only where count is at least 5, and it is not a plain response rate (median 0.95, 38% exactly 1.0; 0.99 between hemispheres against 0.95 within, contradicting the published fall-off with distance); the Zenodo licence field is CC BY 4.0 but the readme says "research use only". Lyu et al.'s table separates tested-and-silent from excluded pairs, so rates and "not measured" are computable.

## Reproduce

```bash
# Read the pinned members of the Zenodo archive by range request (add --record to register the result)
uv run python scripts/fetch_stimulation_responses.py

uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_stimulation_responses.py
npm test --prefix web
```

## See also

- [Receptor fingerprints](receptor-fingerprints.md): the section above it in the inspector.
- [Cortical atlases](cortical-atlases.md): Destrieux, which the contacts are carried onto.
- [Internal anatomy](internal-anatomy.md): the structures labelled by name.
- [Published coordinates](published-coordinates.md): MNI frames and their offsets.
- [References and licensing](../reference/references.md), [Validation and limits](../pipeline/validation.md).
