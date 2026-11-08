# Receptor fingerprints

Region details show the densities of up to 17 neurotransmitter receptors. Each density is a mean ± standard deviation (SD) measured by quantitative in vitro autoradiography in two to six post-mortem brains (Zilles and Palomero-Gallagher, EBRAINS). A fingerprint reaches a region only through the name of the area or structure it was measured in: 30 Julich-Brain areas, the putamen, the globus pallidus, and the mediodorsal and anterior thalamic nuclei. Nothing is measured in the brain shown, and both hemispheres carry the same pooled values.

```{figure} figures/receptor-fingerprints-1.webp
:alt: Left lateral views of a translucent grey brain with Area 44 outlined in the inferior frontal gyrus and, below, the putamen shown in orange; beside each, a panel of receptor densities with bars and mean ± SD values grouped by transmitter.
:name: fig-receptor-fingerprints-1

**A fingerprint is carried to a region by name and its bars compare one receptor across the 36 fingerprints.** **a**, Julich-Brain Area 44 (IFG), left hemisphere, selected under **Focus**. **b**, Its **Receptor densities** section with the ventral part chosen (dataset 44v: 9 hemispheres from 5 brains aged 72–79 years; NMDA 1,129 ± 382 fmol/mg, D<sub>1</sub> 69 ± 32 fmol/mg). **c**, The teaching-set putamen, left hemisphere, under **Focus**. **d**, Its fingerprint (dataset Pu: 3 hemispheres from 2 brains aged 72–77 years). D<sub>1</sub> is 252 fmol/mg, the highest D<sub>1</sub> mean published, so its bar is full, while the D<sub>1</sub> bar of Area 44v is 27% long. CDMD (sub_013), left lateral view; each bar is the region's mean as a share of that receptor's highest mean among the 36 fingerprints.
```

## Data

The 36 datasets were published on EBRAINS by Zilles, Palomero-Gallagher and colleagues (bucket `p22717-hbp-d000045_receptors-human-<key>_pub`, version `v1.0`). They are documented by Zilles et al. (2015) and Palomero-Gallagher and Zilles (2018); each dataset also has its own EBRAINS DOI ([receptor datasets](../reference/references.md#receptor-datasets)). Densities are in fmol/mg. Licence: CC BY-NC-SA 4.0.

Each dataset contributes three files pinned by sha256: the fingerprint (`<key>_fp_<date>.tsv`; `density (mean)`, `density (sd)`, `density (unit)`), the donors (`subjects.tsv`) and the tissue samples with their hemisphere (`tissue-samples.tsv`; `tissue-samples_all.csv` for hOc1; the IFS and IFJ files sit in `<key>_fp/` as `*_all.csv`).

| Group | Datasets | Target regions |
| :--- | :--- | :--- |
| Julich-Brain, Zilles et al. (2015) | 3b, 44d, 44v, 45, 4p, 7A, FG1, FG2, PF, PFcm, PFm, PFop, PFt, PGa, PGp, TE1_0, TE2_1, hOc1 | Area 44 takes 44d and 44v as dorsal and ventral parts; each other key names one area |
| Julich-Brain, visual and hippocampal | hOc2d, hOc2v, hOc3d, hOc3v, CA1, CA2, CA3, DG | Area hOc2 takes hOc2d and hOc2v as parts |
| Julich-Brain, Palomero-Gallagher and Zilles (2018) | ifs1–ifs4, ifj1, ifj2 | Areas IFS1–IFS4, IFJ1, IFJ2 |
| Putamen | Pu | aseg `Putamen`; NextBrain `putamen`, `posteroventral_putamen`; teaching-set putamen |
| Globus pallidus | GP | aseg `Pallidum`; NextBrain external and internal segments; teaching-set external and internal pallidum |
| Mediodorsal thalamic nucleus | ThMD | NextBrain's five divisions of MD |
| Anterior thalamic nucleus | ThA | NextBrain's anteroventral, anteromedial and anterodorsal nuclei |

The receptors are, in display order: glutamate (AMPA, kainate, NMDA, mGluR2/3), GABA (GABA<sub>A</sub>, GABA<sub>B</sub>, GABA<sub>A</sub>/BZ), acetylcholine (M<sub>1</sub>, M<sub>2</sub>, M<sub>3</sub>, α<sub>4</sub>β<sub>2</sub>), noradrenaline (α<sub>1</sub>, α<sub>2</sub>), serotonin (5-HT<sub>1A</sub>, 5-HT<sub>2</sub>), dopamine (D<sub>1</sub>) and adenosine (A<sub>1</sub>). A fingerprint holds 14 to 17 of them. All 36 hold the 14 others; GABA<sub>A</sub>/BZ is in 32, mGluR2/3 in 17 and A<sub>1</sub> in 6. The donors are AR01 to AR07, aged 61 to 79 years across datasets, with 2 to 6 donors and 3 to 9 sampled hemispheres per dataset.

## Method

### Fetch and parse

`scripts/fetch_receptor_fingerprints.py` reads `config/receptor-fingerprints.yaml` and processes each dataset in four steps:

1. It downloads the three files into `data/cache/receptor-fingerprints/<key>/`. A file is renamed into the cache only once complete. A sha256 mismatch stops the script.
2. It reads each table. Lines quoted whole or separated by spaces (the IFS and IFJ files) are split into their columns. Missing columns, or a row with the wrong number of columns, stop the script.
3. It maps every receptor label to its id through the configured spellings (`aliases`, e.g. `mGluR2_3` and `mGlu2/3`). An unknown receptor, a unit other than fmol/mg, or a receptor listed twice stops the script. A blank SD is stored as no SD (`null`), not as zero.
4. It reads the donors (id, sex, age) and the samples (id, hemisphere, donor). Ages must be in years. A repeated sample, a sample without a hemisphere, or samples and subjects naming different donors stop the script.

The result is `data/receptor-fingerprints.json`; `--record` registers it in `data/sources.json` with every origin URL and sha256. `read_definition` refuses duplicate dataset keys, a key outside the schema (a value cut at a comma in a YAML flow mapping), a part other than dorsal or ventral, and two fingerprints on one region unless they are distinct parts.

### Withheld values

A published value known to be wrong is withheld with its evidence. Only an SD can be withheld, and the fetch fails once the source no longer holds the withheld value. One value is withheld: the D<sub>1</sub> SD of ifs1, published as 863 fmol/mg. It equals the A<sub>1</sub> mean of the same file (863 fmol/mg). In the five neighbouring IFS and IFJ areas, measured in the same brains, the D<sub>1</sub> SD is 27–44 fmol/mg. Separately, PF, PFcm, PFop, PGa and PGp publish no α<sub>2</sub> SD.

### Assignment by name

For every target in each hemisphere, `receptor_fingerprints.assign` requires exactly one region of that atlas whose `source_name` equals the target name (aseg names with `Left-` or `Right-`); otherwise the build fails. A target atlas the anatomy does not publish is skipped. A structure named as a whole gives the same values to each subdivision. On CDMD, the 36 datasets reach 94 regions: 60 Julich-Brain (30 areas, two hemispheres), 24 NextBrain, 6 teaching-set and 4 aseg. Areas 9, 46 and 47 are published on EBRAINS but name no Julich-Brain area, so they are left out.

### Export

`export` writes `receptor-fingerprints.json`: the receptors, the withheld values with their reasons, each dataset (what was measured, part, DOI, sources, densities, donors, sampled hemispheres per side) and the region-to-dataset map. Fingerprints are carried per region, never per vertex or voxel.

## Display

The **Receptor densities** section of the region detail appears only for a region with a fingerprint. It stays mounted between selections. An area sampled in parts offers a **Dorsal** | **Ventral** choice. Rows are grouped by transmitter in display order. Each row shows the receptor symbol, a bar and the mean ± SD; a missing SD is drawn as "± —". A bar's length is the region's mean divided by the highest mean of that receptor among the 36 fingerprints (`highestMeans`). Bars therefore compare one receptor across regions, not receptors within a region (Fig. 1b,d).

Notes name unmeasured receptors, receptors without a published SD, any withheld SD with its published value and reason, the hemispheres, donors and age range, and what was measured, with links to the EBRAINS dataset and its sources. `validateReceptorFingerprints` refuses a loaded file with a non-doi.org DOI, a non-positive mean, a negative SD, a withheld value still present, or a region taking anything but one fingerprint or one dorsal and one ventral part.

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| `brain_model.validate` (`receptor_fingerprints.validate`) | Manifest metadata and published file equal those rebuilt from sources | 36 datasets; 94 regions with a fingerprint; no dataset reaching no region |
| `test_every_dataset_reaches_its_regions_in_both_hemispheres_of_cdmd` | Every dataset reaches a region; identical keys left and right | 30 Julich-Brain areas, including Area 44, IFS1, CA1 and hOc3v |
| `test_an_area_sampled_in_parts_takes_both_and_aseg_names_carry_their_side` | Area 44 takes 44d and 44v; aseg putamen and pallidum on both sides | passes |
| `test_an_atlas_the_anatomy_does_not_publish_is_skipped_but_a_missing_name_fails` | Absent atlas skipped; renamed CA2 fails | passes |
| `test_two_fingerprints_on_one_region_must_be_distinct_parts` | Two parts of one kind, or a lone part, refused | passes |
| `test_the_published_fingerprints_hold_the_ebrains_values` | Spot values equal EBRAINS | 44v NMDA 1,129 ± 382, D<sub>1</sub> 69 ± 32; PF α<sub>2</sub> 837, no SD; ifs1 D<sub>1</sub> 78, SD withheld; ifs1 A<sub>1</sub> 863 ± 435; Pu donors AR04, AR05 |
| `test_a_withheld_value_fails_the_fetch_once_the_source_changes`, `test_only_an_sd_can_be_withheld` | Withheld value pinned to its published value; only an SD | passes |
| Parsing tests (unit, unknown receptor, quoted and space-separated lines, blank SD, repeated sample, value cut at a comma) | Each malformed input refused or read correctly | passes |
| `web/src/lib/core/catalog/receptor-fingerprints.test.ts` | Bars as share of highest mean; CDMD catalogue validates; invalid assignments refused | passes |
| `web/src/lib/core/learning/references.test.ts` | Source DOIs and PMIDs match the fetched records | passes |

## Limitations

- Two to six brains aged 61 to 79 years, not the brain shown. Values are pooled over the sampled hemispheres, so both hemispheres show the same values.
- A fingerprint reaches a region only by name. Areas 9, 46 and 47 name no Julich-Brain area and are not shown.
- A structure measured as a whole (globus pallidus, mediodorsal and anterior thalamic nuclei) gives identical values to each subdivision.
- The ifs1 D<sub>1</sub> SD is withheld; five parietal areas publish no α<sub>2</sub> SD.
- Some receptors may have been measured in fewer hemispheres than the dataset lists.
- Bars compare a receptor across fingerprints, not receptors with each other.
- CC BY-NC-SA 4.0: non-commercial, share-alike ([licence](../reference/references.md#cc-by-nc-sa-40-receptor-fingerprints-f-tract)).

## Code availability

| | |
| :--- | :--- |
| Code | [`scripts/fetch_receptor_fingerprints.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/fetch_receptor_fingerprints.py), [`brain_model/layers/receptor_fingerprints.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/receptor_fingerprints.py), [`web/src/lib/core/catalog/receptor-fingerprints.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/catalog/receptor-fingerprints.ts), [`web/src/features/inspector/ReceptorSection.svelte`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/features/inspector/ReceptorSection.svelte) |
| Configuration | [`config/receptor-fingerprints.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/receptor-fingerprints.yaml) |
| Tests | [`tests/test_receptor_fingerprints.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_receptor_fingerprints.py), `web/src/lib/core/catalog/receptor-fingerprints.test.ts`, `web/src/lib/core/learning/references.test.ts` |

```bash
# downloads the 108 pinned files and writes data/receptor-fingerprints.json
uv run python scripts/fetch_receptor_fingerprints.py --record
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_receptor_fingerprints.py
```

Figure state (panels a, b): https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=julich&cuts=julich&region=julich:left:2&view=left&focus=1 (open **Receptor densities**, choose **Ventral**). Panels c, d: https://planumatlas.com/#anatomy=cdmd&lang=en&detail=learning&atlas=julich&cuts=julich&region=learning:left:putamen&view=left&focus=1
