# Receptor fingerprints

Region details show the densities of up to 17 neurotransmitter receptors. Each density is a mean ± standard deviation (SD) measured by quantitative in vitro autoradiography in two to six post-mortem brains (Zilles and Palomero-Gallagher, EBRAINS). A fingerprint reaches a region only through the name of the area or structure it was measured in: 30 Julich-Brain areas, the putamen, the globus pallidus, and the mediodorsal and anterior thalamic nuclei. Nothing is measured in the brain shown, and both hemispheres carry the same pooled values.

```{figure} figures/receptor-fingerprints-1-light.webp
:alt: Four panels. a, a translucent grey brain seen from the left with Area 44 outlined in the inferior frontal gyrus. b, the Receptor densities section of that area, with a bar and a mean ± SD for each of sixteen receptors, grouped by transmitter. c, the same brain with the putamen in orange. d, the Receptor densities section of the putamen, with fifteen receptors.
:name: fig-receptor-fingerprints-1

**A fingerprint is carried to a region by name, and its bars compare one receptor across the 36 fingerprints.** **a**, [Julich-Brain Area 44 (IFG)](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=julich&detail=learning&view=left&region=julich:left:2&focus=1) of the left hemisphere, selected under **Focus** and seen from the left. **b**, Its **Receptor densities** section with the ventral part chosen (dataset 44v: 9 hemispheres from 5 brains aged 72–79 years; NMDA 1,129 ± 382 fmol/mg, D<sub>1</sub> 69 ± 32 fmol/mg). **c**, [The teaching-set putamen](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=julich&detail=learning&view=left&region=learning:left:putamen&focus=1) of the left hemisphere, under **Focus**. **d**, Its fingerprint (dataset Pu: 3 hemispheres from 2 brains aged 72–77 years). D<sub>1</sub> is 252 fmol/mg, the highest D<sub>1</sub> mean published, so its bar is full, while the D<sub>1</sub> bar of Area 44v is 27% long. Values are mean ± s.d. Each bar is the region's mean as a share of that receptor's highest mean among the 36 fingerprints. CDMD `sub_013`. Scale bars apply at the depth of the camera's target.
```

## Data

The 36 datasets were published on EBRAINS by Zilles, Palomero-Gallagher and colleagues (bucket `p22717-hbp-d000045_receptors-human-<key>_pub`). Thirty-two are read at version `v1.0` and the four hippocampal datasets (CA1, CA2, CA3 and DG) at `v2.0`. Zilles et al. (2015) document 18 of the datasets and Palomero-Gallagher and Zilles (2018) document six. The configuration names no paper for the other 12 (no `documented_by`). Each dataset also has its own EBRAINS DOI ([receptor datasets](../reference/references.md#receptor-datasets)). Densities are in fmol/mg. The datasets are under CC BY-NC-SA 4.0.

Each dataset contributes three files, each pinned by its SHA-256 checksum. The fingerprint (`<key>_fp_<date>.tsv`) holds `density (mean)`, `density (sd)` and `density (unit)` for each receptor. The donors file (`subjects.tsv`) holds each donor's id, sex and age. The tissue-samples file (`tissue-samples.tsv`) holds each sample with its hemisphere and donor. For hOc1 the donors and samples are `subjects_all.csv` and `tissue-samples_all.csv`. For the six datasets of the inferior frontal sulcus (IFS) and inferior frontal junction (IFJ), the three files sit in `<key>_fp/` as `<key>_fp.tsv`, `subjects_all.csv` and `tissue-samples_all.csv`.

The configuration names each dataset's target regions by atlas and source name: Julich-Brain areas, structures of FreeSurfer's subcortical segmentation (aseg), NextBrain labels and units of Planum's teaching set.

| Group | Datasets | Target regions |
| :--- | :--- | :--- |
| Julich-Brain, Zilles et al. (2015) | 3b, 44d, 44v, 45, 4p, 7A, FG1, FG2, PF, PFcm, PFm, PFop, PFt, PGa, PGp, TE1_0, TE2_1, hOc1 | Area 44 takes 44d and 44v as dorsal and ventral parts; each other key names one area |
| Julich-Brain, visual and hippocampal | hOc2d, hOc2v, hOc3d, hOc3v, CA1, CA2, CA3, DG | Area hOc2 takes hOc2d and hOc2v as parts; each other key names one area |
| Julich-Brain, Palomero-Gallagher and Zilles (2018) | ifs1–ifs4, ifj1, ifj2 | Areas IFS1–IFS4, IFJ1, IFJ2 |
| Putamen | Pu | aseg `Putamen`; NextBrain `putamen`, `posteroventral_putamen`; teaching-set putamen |
| Globus pallidus | GP | aseg `Pallidum`; NextBrain external and internal segments; teaching-set external and internal pallidum |
| Mediodorsal thalamic nucleus | ThMD | NextBrain's five divisions of the mediodorsal nucleus (MD) |
| Anterior thalamic nucleus | ThA | NextBrain's anteroventral, anteromedial and anterodorsal nuclei |

The receptors are, in display order: glutamate (AMPA, kainate, NMDA, mGluR2/3), GABA (GABA<sub>A</sub>, GABA<sub>B</sub>, GABA<sub>A</sub>/BZ), acetylcholine (M<sub>1</sub>, M<sub>2</sub>, M<sub>3</sub>, α<sub>4</sub>β<sub>2</sub>), noradrenaline (α<sub>1</sub>, α<sub>2</sub>), serotonin (5-HT<sub>1A</sub>, 5-HT<sub>2</sub>), dopamine (D<sub>1</sub>) and adenosine (A<sub>1</sub>). AMPA is α-amino-3-hydroxy-5-methyl-4-isoxazolepropionic acid and NMDA is N-methyl-D-aspartate. GABA is γ-aminobutyric acid, mGluR a metabotropic glutamate receptor, BZ the benzodiazepine binding site of the GABA<sub>A</sub> receptor and 5-HT 5-hydroxytryptamine (serotonin). M<sub>1</sub> to M<sub>3</sub> are muscarinic and α<sub>4</sub>β<sub>2</sub> is nicotinic. A fingerprint holds 14 to 17 of the receptors. GABA<sub>A</sub>/BZ is in 32 fingerprints, mGluR2/3 in 17 and A<sub>1</sub> in 6. The other 14 receptors are in all 36. The donors are AR01 to AR07, aged 61 to 79 years across datasets, with 2 to 6 donors and 3 to 9 sampled hemispheres per dataset.

## Method

### Fetch and parse

`scripts/fetch_receptor_fingerprints.py` read `config/receptor-fingerprints.yaml` and processed each dataset in four steps:

1. The three files were downloaded into `data/cache/receptor-fingerprints/<key>/`. A file is renamed into the cache only once complete. A SHA-256 mismatch stops the script.
2. Each table was read. Lines quoted whole or separated by spaces (the IFS and IFJ files) were split into their columns. Missing columns, or a row with the wrong number of columns, stop the script.
3. Every receptor label was mapped to its id through the configured spellings (`aliases`, for example `mGluR2_3` and `mGlu2/3`). An unknown receptor, a unit other than fmol/mg, or a receptor listed twice stops the script. A blank SD was stored as no SD (`null`), not as zero.
4. The donors (id, sex, age) and the samples (id, hemisphere, donor) were read. Ages must be in years. A repeated sample, a sample without a hemisphere, or samples and subjects naming different donors stop the script.

The result is `data/receptor-fingerprints.json`. With `--record`, the script registers that file in `data/sources.json` with every origin URL and SHA-256. `read_definition` refuses duplicate dataset keys, a key outside the schema (a value cut at a comma in a YAML flow mapping), a part other than dorsal or ventral, a region that takes one part alone, and two fingerprints on one region unless they are distinct parts.

### Withheld values

A published value known to be wrong is withheld with its evidence. Only an SD can be withheld, and the fetch fails once the source no longer holds the withheld value. One value is withheld: the D<sub>1</sub> SD of ifs1, published as 863 fmol/mg. It equals the A<sub>1</sub> mean of the same file (863 fmol/mg). In the five neighbouring IFS and IFJ areas, measured in the same brains, the D<sub>1</sub> SD is 27–44 fmol/mg. Separately, PF, PFcm, PFop, PGa and PGp publish no α<sub>2</sub> SD.

### Assignment by name

For every target in each hemisphere, `receptor_fingerprints.assign` requires exactly one region of that atlas whose `source_name` equals the target name (aseg names with `Left-` or `Right-`). Any other count fails the build. A target atlas the anatomy does not publish is skipped. A structure named as a whole gives the same values to each subdivision. Area 44 takes both of its parts, 44d and 44v (Fig. 1a,b), and the putamen dataset reaches the teaching-set putamen among its targets (Fig. 1c,d). On subject `sub_013` of the MGH Connectome Diffusion Microstructure Dataset (CDMD), the 36 datasets reach 94 regions: 60 Julich-Brain (30 areas, two hemispheres), 24 NextBrain, 6 teaching-set and 4 aseg. Areas 9, 46 and 47 are published on EBRAINS but name no Julich-Brain area, so they are left out.

### Export

`export` writes the published `public/models/<anatomy>/receptor-fingerprints.json`: the receptors, the withheld values with their reasons, each dataset (what was measured, part, DOI, sources, densities, donors, sampled hemispheres per side) and the region-to-dataset map. Fingerprints are carried per region, never per vertex or voxel.

## Display

The **Receptor densities** section of the region detail appears only for a region with a fingerprint. It stays mounted between selections, so its open state and the chosen part carry over. An area sampled in parts offers a **Sampled part** choice, **Dorsal** | **Ventral**. Rows are grouped by transmitter in display order. Each row shows the receptor symbol, a bar and the mean ± SD. A missing SD is drawn as "± —". A bar's length is the region's mean divided by the highest mean of that receptor among the 36 fingerprints (`highestMeans`). Bars therefore compare one receptor across regions, not receptors within a region (Fig. 1b,d).

Notes under the rows name unmeasured receptors, receptors without a published SD, any withheld SD with its published value and reason, the hemispheres, donors and age range, and what was measured. Links lead to the EBRAINS dataset and its sources. `validateReceptorFingerprints` refuses a loaded file with a non-doi.org DOI, a non-positive mean, a negative SD, a withheld value still present, or a region taking anything but one fingerprint or one dorsal and one ventral part.

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| `brain_model.validate` (`receptor_fingerprints.validate`) | Manifest metadata and published file equal those rebuilt from sources | 36 datasets; 94 regions with a fingerprint; no dataset reaching no region |
| `test_every_dataset_reaches_its_regions_in_both_hemispheres_of_cdmd` | Every dataset reaches a region; identical keys left and right | 30 Julich-Brain areas, including Area 44, IFS1, CA1 and hOc3v |
| `test_an_area_sampled_in_parts_takes_both_and_aseg_names_carry_their_side` | Area 44 takes 44d and 44v; aseg putamen and pallidum on both sides | passes |
| `test_an_atlas_the_anatomy_does_not_publish_is_skipped_but_a_missing_name_fails` | Absent atlas skipped; renamed CA2 fails | passes |
| `test_two_fingerprints_on_one_region_must_be_distinct_parts` | Two parts of one kind, or a lone part, refused | passes |
| `test_the_published_fingerprints_hold_the_ebrains_values` | Spot values equal EBRAINS | passes; values below |
| `test_a_withheld_value_fails_the_fetch_once_the_source_changes`, `test_only_an_sd_can_be_withheld` | Withheld value pinned to its published value; only an SD | passes |
| Parsing tests (unit, unknown receptor, quoted and space-separated lines, blank SD, repeated sample, value cut at a comma) | Each malformed input refused or read correctly | passes |
| `web/src/lib/core/catalog/receptor-fingerprints.test.ts` | Bars as share of highest mean; CDMD catalogue validates; invalid assignments refused | passes |
| `web/src/lib/core/learning/references.test.ts` | Source DOIs and PMIDs match the fetched records | passes |

The spot values held against EBRAINS are, in fmol/mg: 44v NMDA 1,129 ± 382 and D<sub>1</sub> 69 ± 32; PF α<sub>2</sub> 837, no SD; ifs1 D<sub>1</sub> 78, SD withheld; ifs1 A<sub>1</sub> 863 ± 435. The same test checks that the Pu donors are AR04 and AR05.

## Limitations

Each fingerprint comes from two to six brains aged 61 to 79 years, not from the brain shown. Values are pooled over the sampled hemispheres, so both hemispheres show the same values.

A fingerprint reaches a region only by name. Areas 9, 46 and 47 name no Julich-Brain area and are not shown. A structure measured as a whole (globus pallidus, mediodorsal and anterior thalamic nuclei) gives identical values to each subdivision.

The ifs1 D<sub>1</sub> SD is withheld. Five parietal areas publish no α<sub>2</sub> SD. Some receptors may have been measured in fewer hemispheres than the dataset lists.

Bars compare a receptor across fingerprints, not receptors with each other.

The data are under CC BY-NC-SA 4.0: non-commercial, share-alike ([licence](../reference/references.md#cc-by-nc-sa-40-receptor-fingerprints-f-tract-cortical-layers)).

## Code availability

Code
: [`scripts/fetch_receptor_fingerprints.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/fetch_receptor_fingerprints.py), [`brain_model/layers/receptor_fingerprints.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/receptor_fingerprints.py), [`web/src/lib/core/catalog/receptor-fingerprints.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/catalog/receptor-fingerprints.ts), [`web/src/features/inspector/ReceptorSection.svelte`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/features/inspector/ReceptorSection.svelte)

Configuration
: [`config/receptor-fingerprints.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/receptor-fingerprints.yaml)

Tests
: [`tests/test_receptor_fingerprints.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_receptor_fingerprints.py), `web/src/lib/core/catalog/receptor-fingerprints.test.ts`, `web/src/lib/core/learning/references.test.ts`

```bash
# downloads the 108 pinned files and writes data/receptor-fingerprints.json
uv run python scripts/fetch_receptor_fingerprints.py --record
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_receptor_fingerprints.py
```

