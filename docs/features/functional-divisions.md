# Functional divisions

Each HCP-MMP1.0 (Human Connectome Project multimodal parcellation) area is assigned, by name, to published groupings at two levels: one of Glasser's 22 cortical sections, and, where a source lists it, one of 21 named regions from Glasser et al. (2016) and Rolls et al. (2022, 2023). The levels are kept apart because Rolls's groups cross Glasser's sections. The groupings reach this brain only through its HCP-MMP projection; they are named in the region detail and the Functions tab, not drawn on the surface.

```{figure} figures/functional-divisions-1.webp
:alt: Two medial views of the left hemisphere, the first coloured by Glasser's sections, the second by named regions with unnamed areas in grey, and the region detail of area 23c listing its named region, midcingulate cortex, and its section, section 7.
:name: fig-functional-divisions-1

**Named regions cross Glasser's sections.** **a**, The 22 sections; orange is section 19 (anterior cingulate and medial prefrontal), blue section 20 (orbital and polar frontal), lilac section 18 (posterior cingulate), magenta section 7 (paracentral lobular and mid cingulate). **b**, The 21 named regions; grey areas have none. Section 19 is divided among supracallosal ACC (anterior cingulate cortex; purple), pregenual ACC (brown) and area 10 (green), which also takes 10d from section 20. **c**, Region detail of area 23c, its header and then its **Functional division** section (the dashed rule marks the sections left out between them): named region midcingulate cortex (Rolls 2023), section 7, and its contested section-text placement. a and b are rendered offline from `functional-regions.json` on CDMD's left pial surface, each triangle coloured by the area holding most of its vertices, with the published colours; c is the viewer.
```

## Data

No image, surface or volume is read. Every region is a list of HCP-MMP area names transcribed into `config/functional-regions.yaml`, with its source page noted in the file: Glasser et al. (2016) Neuroanatomical Supplementary Results, pp. 19–36 and 73 and Table 1; Rolls et al. (2022) Methods, p. 333 and Fig. 1; Rolls et al. (2023) Methods 2.3, Fig. 1 and the headings of sections 3.2–3.5.

| Key | Source | DOI | PMID |
| :--- | :--- | :--- | :--- |
| `glasser-2016` | Glasser et al. (2016), Nature 536:171–178 | 10.1038/nature18933 | 27437579 |
| `rolls-2022-ofc` | Rolls, Deco, Huang and Feng (2022), Cereb Cortex 33:330–356 | 10.1093/cercor/bhac070 | 35233615 |
| `rolls-2023-pcc` | Rolls, Wirth, Deco, Huang and Feng (2023), Hum Brain Mapp 44:629–655 | 10.1002/hbm.26089 | 36178249 |

The 22 sections, as printed in Table 1 (sentence case), with each area in its bold (primary) section:

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

The 21 named regions, 57 areas per hemisphere:

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

Six areas sit in one section in Table 1 and another in the section texts of Glasser's supplement. Planum follows Table 1's primary column, as HCPex v1.1 does; MNE's `fetch_hcp_mmp_parcellation(combine=True)` follows the section texts.

| Area | Section in Table 1 (used) | Section in the section text |
| :--- | ---: | ---: |
| 23c | 7 | 18 |
| 52 | 10 | 12 |
| PFcm | 10 | 9 |
| TF | 13 | 14 |
| a47r | 21 | 20 |
| pOFC | 19 | 20 |

## Method

### Definition checks

`read_definition` (`brain_model/layers/functional_regions.py`) fails unless:

1. the levels are exactly `named` and `sections`, and sections are numbered 1–22 in order;
2. every region has an id, English and French name and short name, a listed source, a colour of three integers in 0–255, and area names that are strings (numeric names are quoted in the YAML);
3. no area is in two regions of one level, and region ids are unique;
4. the sections hold exactly 180 areas, and every named area lies in a section;
5. each contested record's `section` is where the area is listed, and its `text_section` is another section;
6. each source has a short name, citation, `https://doi.org/` DOI and integer PMID.

Colours are not a published palette. They were chosen so that regions sharing a surface edge differ by an OKLab ΔE of at least 15 under normal vision and simulated protanopia and deuteranopia.

### Assignment by area name

`assign` reads each published HCP-MMP cortical region's `source_name` as `L_<area>_ROI` or `R_<area>_ROI`, fails if the side contradicts the region's hemisphere, and gives the region its section and, where listed, its named region. The anatomy must publish all 180 areas on each side. Assignment is per area, never per vertex. `export` writes `functional-regions.json` (sources, contested records, both levels, and region id → division id at each level) and the manifest's `functional_regions` record; `limitations` adds the statements below to the manifest.

## Display

The region detail of an HCP-MMP area has a **Functional division** disclosure (`FunctionalSection.svelte`): one row for the named region, where a source lists one, and one for the section, each with its colour swatch, source and member areas (Fig. 1c). A note gives the Table 1 and section-text placements of a contested area and says the groupings are not measured function. The Functions tab names each listed area's named region, else its section (`functions-view.ts`). The provenance panel lists the layer and its DOIs. No surface colour mode or cut label draws the divisions: the surface colour modes are `tissue`, `mri`, `atlas`, `network`, `cab-np` and `territory`.

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| `test_the_sections_partition_the_areas_cab_np_publishes` | Sections hold exactly the HCP-MMP area names | 180 per hemisphere |
| `test_contested_areas_take_table_1s_primary_section` | Six contested areas in Table 1's section; alternatives equal the section text's | exact |
| `test_named_regions_keep_the_published_area_lists` | Area lists as published | exact |
| Rejection tests (`test_an_area_in_two_sections_is_rejected` and 9 others) | Duplicated, missing, non-HCP or integer-typed areas, misordered sections, missing PMID, contradictory contested record, wrong hemisphere, missing area all fail | passes |
| `test_export_publishes_both_levels_and_their_sources`; `functional_regions.validate` | Published file equals the rebuild from the manifest's regions | 360 areas in sections, 114 in named regions |
| `test_regions_that_share_a_surface_edge_differ_in_colour_for_dichromats_too` | Edge-sharing regions on CDMD and `fsaverage`, normal, protan and deutan vision (Machado et al. 2009, severity 1) | OKLab ΔE ≥ 15, both levels |
| `web/src/lib/core/learning/references.test.ts` | DOIs and PMIDs name the cited works (fetched records) | passes |

## Limitations

- Published groupings of whole HCP-MMP1.0 areas, reaching this brain through its HCP-MMP projection ([cortical atlases](cortical-atlases.md#limitations)); not measured in it.
- A division's borders are HCP-MMP area borders.
- No source lists dorsomedial prefrontal cortex, a dorsolateral prefrontal cortex narrower than section 22, the temporoparietal junction or the intraparietal sulcus as HCP-MMP areas; they have no named region.
- Glasser's supplement places six areas in two sections; the sections follow Table 1.

## Code availability

| | |
| :--- | :--- |
| Code | [`brain_model/layers/functional_regions.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/functional_regions.py), [`web/src/lib/core/catalog/functional-regions.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/catalog/functional-regions.ts), [`web/src/features/inspector/FunctionalSection.svelte`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/features/inspector/FunctionalSection.svelte) |
| Configuration | [`config/functional-regions.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/functional-regions.yaml) |
| Tests | [`tests/test_functional_regions.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_functional_regions.py), `web/src/lib/core/catalog/functional-regions.test.ts`, `web/src/lib/core/learning/references.test.ts` |

```bash
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_functional_regions.py
```

Figure state (panel c; open **Functional division**): https://planumatlas.com/#anatomy=cdmd&atlas=hcp-mmp&view=left&hemi=left&internal=0&region=hcp-mmp:left:38
