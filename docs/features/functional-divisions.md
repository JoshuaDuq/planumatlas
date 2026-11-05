# Functional divisions

Published groupings of HCP-MMP1.0 areas at two levels, Glasser's 22 cortical sections and 21 named regions, listed in the region detail and the Functions tab; they are not a surface colour.

:::{list-table}
:widths: 22 78
:stub-columns: 1

* - Where in the viewer
  - **Functional division** disclosure of the region detail for an HCP-MMP area; the division named beside each area in the Functions tab. No colouring of the brain, no cut labels.
* - Built by
  - [`brain_model/layers/functional_regions.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/functional_regions.py); `export` and `limitations` called from [`brain_model/build.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/build.py)
* - Configuration
  - [`config/functional-regions.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/functional-regions.yaml)
* - Source data
  - Glasser et al. (2016), Neuroanatomical Supplementary Results, Table 1 and section texts; Rolls et al. (2022), Cerebral Cortex; Rolls et al. (2023), Human Brain Mapping. Transcribed as area lists; no image or volume is read
* - Checked by
  - [`tests/test_functional_regions.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_functional_regions.py); `functional_regions.validate` in the [validator](../pipeline/validation.md); `web/src/lib/core/catalog/functional-regions.test.ts`; `web/src/lib/core/learning/references.test.ts` for the DOIs and PMIDs
:::

## What it does

Two levels of published HCP-MMP groupings, kept apart because they cross. Glasser's 22 sections (2016, supplementary Table 1) partition the cortex. 21 named regions are those a source defines as area lists: eleven from Glasser (V1, MT, fusiform face complex, M1, S1, SII, SMA, FEF, PEF, Broca's area, A1), six from Rolls et al. 2022 (orbitofrontal, subgenual and anterior cingulate, area 10 and vmPFC) and four from Rolls et al. 2023 (midcingulate and posterior cingulate). Names no source defines as area lists, such as dmPFC or TPJ, are not drawn.

They are not a surface colour: the region detail names an HCP-MMP area's section and named region, and the Functions tab names the division each area it lists belongs to.

## Data

Nothing is read from an image, surface or volume. Every region is a list of Glasser et al. (2016) area names transcribed into `config/functional-regions.yaml` from its source, with the page it came from noted in the file (Glasser: Neuroanatomical Supplementary Results pp. 19–36 and 73 and Table 1; Rolls, Cereb Cortex: Methods p. 333 and Fig. 1; Rolls, Hum Brain Mapp: Methods 2.3, Fig. 1 and the headings of sections 3.2–3.5). The file also holds each source's citation, DOI and PMID:

| Key | Source | DOI | PMID |
| :--- | :--- | :--- | :--- |
| `glasser-2016` | Glasser et al. (2016), Nature 536:171–178 | 10.1038/nature18933 | 27437579 |
| `rolls-2022-ofc` | Rolls, Deco, Huang and Feng (2022), Cereb Cortex 33:330–356 | 10.1093/cercor/bhac070 | 35233615 |
| `rolls-2023-pcc` | Rolls, Wirth, Deco, Huang and Feng (2023), Hum Brain Mapp 44:629–655 | 10.1002/hbm.26089 | 36178249 |

The DOIs and PMIDs were fetched and checked against the published records, not recalled; `web/src/lib/core/learning/references.test.ts` checks them against the fetched records. Colours are not a published palette: they distinguish display units, and were chosen so that regions sharing a surface edge differ by an OKLab ΔE of at least 15 under normal vision and under simulated protanopia and deuteranopia. Each region carries an English and a French name and short name.

The 22 sections, as printed in Table 1 (sentence case), and their areas:

| No. | Section | HCP-MMP areas |
| ---: | :--- | :--- |
| 1 | Primary visual cortex (V1) | V1 |
| 2 | Early visual cortex | V2, V3, V4 |
| 3 | Dorsal stream visual cortex | V3A, V3B, V6, V6A, V7, IPS1 |
| 4 | Ventral stream visual cortex | V8, VVC, PIT, FFC, VMV1, VMV2, VMV3 |
| 5 | MT+ complex and neighboring visual areas | V3CD, LO1, LO2, LO3, V4t, FST, MT, MST, PH |
| 6 | Somatosensory and motor cortex | 4, 3a, 3b, 1, 2 |
| 7 | Paracentral lobular and mid cingulate cortex | 24dd, 24dv, 6mp, 6ma, SCEF, 5m, 5L, 5mv, 23c |
| 8 | Premotor cortex | 55b, 6d, 6a, FEF, 6v, 6r, PEF |
| 9 | Posterior opercular cortex | 43, FOP1, OP4, OP1, OP2-3 |
| 10 | Early auditory cortex | A1, LBelt, MBelt, PBelt, RI, 52, PFcm |
| 11 | Auditory association cortex | A4, A5, STSdp, STSda, STSvp, STSva, STGa, TA2 |
| 12 | Insular and frontal opercular cortex | PI, Ig, PoI1, PoI2, FOP2, FOP3, MI, AVI, AAIC, Pir, FOP4, FOP5 |
| 13 | Medial temporal cortex | H, PreS, EC, PeEc, PHA1, PHA2, PHA3, TF |
| 14 | Lateral temporal cortex | PHT, TE1p, TE1m, TE1a, TE2p, TE2a, TGv, TGd |
| 15 | Temporo-parieto-occipital junction | TPOJ1, TPOJ2, TPOJ3, STV, PSL |
| 16 | Superior parietal cortex | LIPv, LIPd, VIP, AIP, MIP, 7PC, 7AL, 7Am, 7PL, 7Pm |
| 17 | Inferior parietal cortex | PGp, PGs, PGi, PFm, PF, PFt, PFop, IP0, IP1, IP2 |
| 18 | Posterior cingulate cortex | DVT, ProS, POS1, POS2, RSC, v23ab, d23ab, 31pv, 31pd, 31a, 23d, PCV, 7m |
| 19 | Anterior cingulate and medial prefrontal cortex | 33pr, p24pr, a24pr, p24, a24, p32pr, a32pr, d32, p32, s32, 8BM, 9m, 10v, 10r, 25, pOFC |
| 20 | Orbital and polar frontal cortex | 47s, 47m, 11l, 13l, a10p, p10p, 10pp, 10d, OFC |
| 21 | Inferior frontal cortex | 44, 45, IFJp, IFJa, IFSp, IFSa, 47l, p47r, a47r |
| 22 | Dorsolateral prefrontal cortex | 8C, 8Av, i6-8, s6-8, SFL, 8BL, 9p, 9a, 8Ad, p9-46v, a9-46v, 46, 9-46d |

The 21 named regions, with the areas each lists:

| Region (id) | Source | HCP-MMP areas |
| :--- | :--- | :--- |
| Primary visual cortex, V1 (`v1`) | Glasser | V1 |
| Middle temporal area, MT (`mt`) | Glasser | MT |
| Fusiform face complex, FFC (`ffc`) | Glasser | FFC |
| Primary motor cortex, M1 (`m1`) | Glasser | 4 |
| Primary somatosensory cortex, S1 (`s1`) | Glasser | 3a, 3b, 1, 2 |
| Secondary somatosensory cortex, SII (`s2`) | Glasser | OP1 |
| Supplementary motor area, SMA (`sma`) | Glasser | 6mp, 6ma, SCEF |
| Frontal eye fields, FEF (`fef`) | Glasser | FEF |
| Premotor eye field, PEF (`pef`) | Glasser | PEF |
| Broca's area (`broca`) | Glasser | 44, 45 |
| Primary auditory cortex, A1 (`a1`) | Glasser | A1 |
| Lateral orbitofrontal cortex (`lateral-ofc`) | Rolls 2022 | 47s, 47l, a47r, p47r, 47m |
| Medial orbitofrontal cortex (`medial-ofc`) | Rolls 2022 | 11l, 13l, OFC, pOFC |
| Subgenual cingulate cortex (`subgenual-cingulate`) | Rolls 2022 | 25 |
| Pregenual anterior cingulate cortex (`pregenual-acc`) | Rolls 2022 | s32, a24, p24, p32, d32 |
| Area 10 and related ventromedial prefrontal regions (`area-10`) | Rolls 2022 | 10v, 10r, 10d, 9m |
| Supracallosal anterior cingulate cortex (`supracallosal-acc`) | Rolls 2022 | a32pr, a24pr, 33pr, p32pr, p24pr |
| Midcingulate cortex (`midcingulate`) | Rolls 2023 | 23c, 24dd, 24dv |
| Postero-ventral posterior cingulate division, group 1 (`pcc-1`) | Rolls 2023 | 31pd, 31pv, 7m, d23ab, v23ab |
| Antero-dorsal posterior cingulate division, group 2 (`pcc-2`) | Rolls 2023 | RSC, 31a, 23d, PCV, POS2, POS1 |
| Dorsal visual transitional area and ProS, group 3 (`pcc-3`) | Rolls 2023 | DVT, ProS |

Named regions do not repartition the sections: Rolls's groups cross them, which is why the two levels are separate. dmPFC, a dorsolateral prefrontal cortex narrower than Glasser's section 22, the temporoparietal junction and the intraparietal sulcus have no named region in any of the three sources and are shown only within their sections.

### Contested areas

Six areas (23c, 52, PFcm, TF, a47r, pOFC) sit in one section in Table 1 and another in the section texts of Glasser's supplement. Planum follows Table 1's bold (primary) column, as HCPex v1.1 does, and shows the alternative in the region detail. MNE's `fetch_hcp_mmp_parcellation(combine=True)` follows the section texts.

| Area | Section in Table 1 (used) | Section in the section text |
| :--- | ---: | ---: |
| 23c | 7 | 18 |
| 52 | 10 | 12 |
| PFcm | 10 | 9 |
| TF | 13 | 14 |
| a47r | 21 | 20 |
| pOFC | 19 | 20 |

## How it was built

1. **Read and check the definition.** `functional_regions.read_definition` reads `config/functional-regions.yaml` and fails unless:
   - the levels are exactly `named` and `sections`, and the sections are numbered 1 to 22 in order;
   - each region has an id, name, French name, short name, French short name, source and areas, a source listed under `sources`, a colour of three integers 0 to 255, and area names that are strings (an area written as a bare number and read as an integer is rejected; numeric names are quoted in the file);
   - no area is in two regions of a level, and region ids are unique;
   - the sections hold exactly 180 areas, one per HCP-MMP area of a hemisphere, and no named area lies outside every section;
   - each contested record agrees with the listing (its `section` is where the area is listed) and names a different section as the text's;
   - each source has a short name, citation, `https://doi.org/` DOI and integer PMID.
2. **Assign by area name.** `functional_regions.assign` reads each published HCP-MMP cortical region's `source_name` as `L_<area>_ROI` or `R_<area>_ROI` (it fails if the side contradicts the region's hemisphere), then gives the region its section and, where a source names one, its named region. The anatomy must publish every one of the 180 areas on each side.
3. **Export.** `export` writes `functional-regions.json` (sources, contested records, both levels and their regions, and region id to region id at each level) beside the manifest and returns the manifest's `functional_regions` metadata (id, file, atlas `hcp-mmp`, label, DOIs of the sources, and the method statement). Assignment is per area, never per vertex.
4. **Limitations.** `functional_regions.limitations` states into the manifest that the divisions are published groupings reaching this brain through the HCP-MMP projection, that their borders are HCP-MMP's, and the six contested areas.

## How the viewer uses it

- `web/src/lib/core/catalog/functional-regions.ts` validates the published partition (both levels present; every region has names, French names, a three-value colour, a known source and areas; every assignment names a region of the HCP-MMP atlas) and offers `functionalRegionOf(partition, level, regionId)` and `functionalName`.
- `web/src/features/inspector/FunctionalSection.svelte` shows, for an HCP-MMP area, one row for its named region (where a source names one) and one for its section, each with a swatch, the source's short name and the list of areas in the grouping. A note says when no source names a finer region, states the Table 1 versus section-text placement for a contested area, and says the groupings are published groupings of whole HCP-MMP areas reaching this brain through its HCP-MMP projection and not measured function.
- `web/src/features/functions/functions-view.ts` names, for each area the Functions tab lists, its named region or, failing that, its section.
- `web/src/lib/core/panels/provenance.ts` lists the layer's label and the citations in the provenance panel.
- The division is not drawn on the brain. The colour mode that once drew it was removed on 2026-10-28 because it clashed by name with the Functions tab and was a coarser HCP-MMP parcellation presented as a colouring; the data and the inspector row stay.

## Checks

| Check | Limit |
| :--- | :--- |
| Sections partition the areas CAB-NP publishes | all 180 per hemisphere |
| Contested areas take Table 1's primary section, and the alternatives equal the section text's | exact |
| Named regions keep the published area lists | exact |
| `functional_regions.validate`: published file equals the one rebuilt from the manifest's regions; areas assigned | 360 areas in sections, 114 in named regions (57 per hemisphere) |
| Regions that share a surface edge, on CDMD's and `fsaverage`'s HCP-MMP surfaces, differ in colour under normal, protan and deutan vision (Machado et al. 2009 simulation, severity 1) | OKLab ΔE ≥ 15, at both levels |

The tests also reject an area in two sections or two named regions, an area left out of every section, a named area that is not an HCP-MMP area, an area read as an integer, sections out of order, a source without a PMID, a contested record that disagrees with the listing, an area named for the other hemisphere and an anatomy that misses an area.

## Limits

- Published groupings of HCP-MMP1.0 areas: the 22 sections of Glasser et al. (2016) and named regions from Glasser et al. (2016) and Rolls et al. (2022, 2023). They reach this brain through the HCP-MMP projection and are not measured in it.
- A division's borders are HCP-MMP's area borders. No border is drawn for a name no source defines as a set of HCP-MMP areas.
- Glasser's supplement contradicts itself on six areas; the sections follow Table 1's primary column and the alternative is published beside each.

### Alternatives considered

- A Carlén (2017) Fig. 1 style glass brain with named regions drawn on it was built, then removed with the colour mode (see above); none of Carlén's borders were ever used.
- A named dorsolateral prefrontal cortex narrower than section 22, dmPFC, TPJ and IPS were not added: no source lists them as HCP-MMP areas. If a drawn dlPFC is wanted again, it would need a cited paper that lists it as HCP-MMP areas, fetched and verified first, and be added as a grouped HCP-MMP atlas rather than a colour mode.

## Reproduce

Editing `config/functional-regions.yaml` is the whole of the data step; the YAML is read at build time, and a dev server must be restarted to pick up an edit.

```bash
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_functional_regions.py
```

## See also

- [Functional networks](functional-networks.md), the other per-area grouping of HCP-MMP
- [Cortical atlases](cortical-atlases.md), for HCP-MMP1.0
- [Functions](functions.md), where each area's division is named
- [References](../reference/references.md) (Glasser et al. 2016; Rolls et al. 2022, 2023)
