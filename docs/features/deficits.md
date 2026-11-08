# Deficits

The **Deficits** tab maps 131 acquired adult deficits onto the atlas regions that published patient studies associate with them. Each profile holds one to six findings; each finding cites supporting and qualifying studies, states its limitation and how the study's anatomy became atlas parcels, and is painted in its own colour. The catalogue is a curated selection of 339 PubMed-indexed studies, not a systematic review, and its parcels are atlas labels on one reference brain, not lesion volumes.

```{figure} figures/deficits-1.webp
:alt: Three panels. a, a right hemisphere seen from the side and slightly behind, with a see-through grey cortex; gyri are painted blue, magenta, green and amber, and violet deep structures show through; a key at top right lists five findings. b, the same view with an opaque beige cortex and only the angular, middle temporal and middle occipital gyri painted amber. c, the side panel showing the finding "Neglect after basal ganglia and thalamic lesions" with its regions, reported finding, interpretation, mapping note and the first of two publications.
:name: fig-deficits-1

**Hemispatial neglect: five findings, one colour each, and the evidence behind one of them.** **a**, All five findings. The angular and supramarginal gyri are cited by two findings and take the colour of the first (blue). The putamen and caudate (violet) are deep, so the cortex is held see-through and unpainted cortex is drawn grey. **b**, One finding chosen in the key ("Neglect of one side of each object"). The angular gyrus now takes that finding's amber, and with no deep structure painted the cortex is opaque again. **c**, The evidence of the fifth finding: one supporting lesion-mapping study (Karnath et al. 2002) and one qualifying study, with the finding, its limitation and its mapping note. The profile reports 10 of 11 mapped regions coloured, because the pulvinar is a NextBrain nucleus and the teaching set is the internal anatomy drawn. Subject CDMD sub_013; Destrieux cortex and teaching-set structures; right hemisphere; camera as framed on opening.
```

## Data

| Input | Content |
| :--- | :--- |
| [`data/neuropsychology.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/neuropsychology.yaml), revision 2026-11-07 | 6 groups, 131 deficits, 218 findings (`associations`), 339 references |
| [`data/reference-records.json`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/reference-records.json), fetched 2026-11-07 | 425 identity records (420 PubMed articles, 5 Bookshelf chapters) for every work cited in the repository |
| `public/models/<anatomy>/manifest.json` | The region ids and source labels that mappings must resolve to |
| `public/models/<anatomy>/neuropsych-domains.json` | Teaching-set stand-ins for FreeSurfer structures (`units`); Functions maps that cite a finding (`lesion_checks`) |

The 339 references span 1978–2026: 143 case series, 139 lesion-mapping studies, 48 case reports and 9 meta-analyses. Extraction scope is `abstract` for 252 and `full-text` for 87; six carry a recorded published correction. The 218 findings hold 439 evidence entries (312 supporting, 127 qualifying). Laterality: 107 bilateral, 63 left, 48 right. Findings per profile: one (64 profiles), two (58), three (4), four (1), five (2: hemispatial neglect, working memory) and six (2: aphasia, limb apraxia). Profiles per group: sensorimotor 42, perception and visuospatial abilities 24, attention and executive functions 21, social and emotional functions 17, language, reading and number 16, memory 11. The 447 mappings point to 162 distinct regions: Destrieux parcels (268 mappings), teaching-set structures (`learning:`, 83), FreeSurfer `aseg` structures (67) and NextBrain nuclei (29). Twenty-four findings have no mapping.

| Record | Fields |
| :--- | :--- |
| `groups` | `id`, `name`. Ids, order and wording equal the Functions groups |
| `deficits` | `id`, `group`, `name`, `domain`, `summary`, `aliases` (search terms) |
| `associations` | `id`, `deficit`, `title`, `network`, `laterality` (`left`, `right`, `bilateral`), `finding`, `limitation`, `mapping_note`, `mappings` (`region`, `source_name`; may be empty), `evidence` (`reference`, `role`: `supporting` or `qualifying`) |
| `references` | `id`, `title`, `authors`, `year`, `journal`, `doi`, `pmid`, `method`, `scope` (`abstract`, `full-text`), `population`, optional `corrections` (`doi`, `summary`) |

Every free-text field is given in English and French.

## Method

### Admission of a study
A reference enters the catalogue with a PMID and a DOI and one of four patient designs: `lesion-mapping`, `meta-analysis`, `case-report` or `case-series`. Its `population` states who was studied. Its `scope` records whether the finding was extracted from the abstract or the full text; it does not record independent review. A finding needs at least one `supporting` reference. A `qualifying` reference opposes or narrows it (a failed replication, an overlapping cohort, a different task). A published erratum or correction is recorded on the reference with a bilingual summary of what changes. A work with a retraction or expression of concern is refused.

### Mapping to parcels
A mapping names a region id of the published manifest, `<atlas>:<hemisphere>:<code>`, and that region's source label. The `mapping_note` states how the study's anatomy became the parcels, including where a whole parcel stands for part of it. A `left` or `right` finding may map only regions of that hemisphere; `bilateral` may map both, and the note distinguishes separate unilateral cases from bilateral injury. Findings whose anatomy has no parcel, or that rest on normative connectivity, uncorrected statistics, white matter or unresolved locations, keep their citations and an empty or reduced `mappings`; connected network nodes are not painted as lesion sites. Every profile must have at least one finding that maps a region.

### Record validation
`validateClinicalData` runs on every load and throws, naming the record, on: a missing revision date (`YYYY-MM-DD`); a duplicate or blank id; a translated field missing or blank in `en` or `fr`, or with any other key; an unknown group, or a group with no deficits; aliases that are not lists of non-empty terms; a DOI not matching `10.NNNN/…`; a non-numeric PMID; a year before 1800; an unknown method or scope; a malformed correction; an unknown deficit or reference; an invalid laterality or role; no supporting evidence; an unknown or `non-region` mapped region; a `source_name` that differs from the region's, compared canonically; a hemisphere that contradicts the laterality; a region mapped twice in one finding; a profile with no mapped region.

### Citation identity
`scripts/fetch_references.py` collects every PMID, Bookshelf accession and DOI cited in `data/neuropsychology.yaml`, `data/circuits.yaml`, `data/archived-circuit-tours.yaml`, eight `config/*.yaml` source files and `docs/reference/references.md`. It fetches PubMed records with E-utilities `efetch` in batches of 100 (title, authors, journal-issue year, DOI, PMCID and correction or retraction links) and Bookshelf chapters with `esearch`/`esummary`. A DOI missing from PubMed is taken from Crossref only when Crossref's title and first-author surname match PubMed's. Each correction notice is resolved to one DOI through Crossref's `updates:` filter, else a title and ISSN search; zero or several matches stop the run. Requests are spaced by 0.5 s (E-utilities) and 1.2 s (Crossref) and retried up to three times on HTTP 429, honouring `Retry-After`. Abstracts are not stored. The year is PubMed's `PubDate` year (the first year of a `MedlineDate` range), not the online-first year.

`references.test.ts` reads only the records file. For each clinical reference, its DOI, title (ignoring case, accents and punctuation), author surnames, year and recorded corrections must equal the fetched record, so a real but wrong PMID fails.

### Search
Queries and texts are lower-cased and stripped of accents. A deficit matches when the query is a substring of its name, domain, an alias, or the title or network of one of its findings, in the interface language. A deficit whose name equals the query ranks first; the rest follow in alphabetical order. A query that matches nothing is offered the nearest deficit name or alias.

### Paint
For a profile with findings $a_1,\dots,a_n$ in authored order ($n \le 6$, else `findingPaint` throws), finding $a_k$ takes colour $C_k$ of `FINDING_COLORS` = (57, 135, 229), (213, 81, 129), (0, 131, 0), (201, 133, 0), (98, 80, 214), (232, 123, 164). Region $r$ takes $C_{\min\{k\,:\,r \in a_k\}}$, the colour of the first finding that cites it (Fig. 1a). A chosen finding paints only its own regions in its own colour (Fig. 1b). A FreeSurfer structure is also painted on its teaching-set stand-ins, so it shows whichever internal anatomy is drawn.

## Display
Opening a profile draws its mapped regions together: the cortical atlas is switched to the commonest atlas among them if the loaded one draws none, and the internal anatomy to the level that holds most of the structures. Cuts are turned off, isolation is cleared, both hemispheres are shown, the cortex is shown only if a cortical region is cited, and the regions are framed. While a painted structure is visible beneath a visible cortex, the cortex is held at the manifest's see-through opacity (0.15 for CDMD) and unpainted regions are drawn grey. The stage key lists the findings in their colours; choosing one shows it alone. In normal vision the first three colours and the cortex colour (#c4a897) differ pairwise by OKLab $\Delta E \ge 19.8$. Under full-severity dichromacy simulation (Machado matrices) the smallest difference is 12.5 for protanopia and deuteranopia and 11.3 for tritanopia (blue against green). These values were computed for this page; no repository test checks them. The profile's meta line counts the mapped regions drawn and coloured in the current view.

Each finding lists its regions as buttons, and its **Evidence** disclosure shows the network, the reported finding, its limitation, the mapping note and each publication. A publication shows its role, design, title (linked to doi.org), authors, year, journal, population, extraction scope, PubMed link and corrections. Titles, authors and journals stay in English. **Checked maps** opens the Functions maps whose `lesion_checks` cite one of the profile's findings ([functions](functions.md)). **Restore previous view** returns to the scene and tab from before the first profile opened. A region's inspector lists the deficits mapped on it. The [lesion report](lesion-report.md#method) ranks deficits by the share of cited regions a placed sphere reaches, and each [circuit](circuits.md) links to its deficit. URL state: `tab=deficits&deficit=<id>`; the chosen finding is not part of the link.

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| `data.test.ts` CAT-50 | Revision 2026-11-07: 6 groups, 131 deficits, 339 references, 218 findings | passes |
| `data.test.ts` | Every published deficit resolves its regions, source labels and evidence on each published anatomy; every profile has a colour per finding | passes |
| `data.test.ts`, `catalog.test.ts` CAT-49 | The six colours; a seventh finding throws; aphasia has the most findings (6) and paints 7 regions | passes |
| `catalog.test.ts` | Each finding takes the next colour, a shared region the first, and one finding can be shown alone | passes |
| `data.test.ts` | Named mapping limits hold: the parietal motor-neglect, amusia-network and Holmes-tremor-network findings paint no region; alien hand paints anterior callosal segments (`aseg:midline:254`, `255`) and not the posterior (`251`); the dorsolateral-pons coma finding paints only `learning:left:pons` | passes |
| `validate.test.ts` CAT-44 | Each refusal under Record validation, and acceptance of boundary values | passes |
| `catalog.test.ts`, `data.test.ts` CAT-45, CAT-42 | Case- and accent-insensitive search with the named deficit first; "aphasai" → Aphasia, "amnesie" → Amnésie, "abc" → none | passes |
| `references.test.ts` | Each cited work matches its fetched record; no retraction or expression of concern; the records file holds exactly the cited works | passes |
| `tests/test_neuropsych_domains.py` | A Functions lesion check must name an existing finding; deficit groups equal the Functions groups in order and wording | passes |

## Limitations
- The literature is selected, not systematically reviewed; clinical accuracy has not been validated and the catalogue is not diagnostic or prognostic.
- 252 of 339 references were extracted from the abstract only.
- A single case does not show that the same lesion is required in everyone.
- Group associations drawn on one reference brain do not predict an individual patient's deficit.
- A parcel can be drawn whole where a study implicated part of it; anatomy without a parcel, such as white matter, is left uncoloured.
- Only one internal-anatomy level is drawn at a time, so a structure mapped on another level stays undrawn (Fig. 1).
- Consortium, cohort and registry studies can share participants.
- Beyond the third colour, finding colours are not guaranteed to stay distinguishable; the key names each finding.

## Code availability

| | |
| :--- | :--- |
| Code | [`web/src/lib/core/clinical/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/lib/core/clinical) (`validate.ts`, `catalog.ts`, `load.ts`), [`web/src/features/deficits/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/features/deficits), [`web/src/lib/state/paint-see-through.svelte.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/state/paint-see-through.svelte.ts), [`scripts/fetch_references.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/fetch_references.py) |
| Configuration | [`data/neuropsychology.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/neuropsychology.yaml); [`config/neuropsych-domains.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/neuropsych-domains.yaml) (`lesion_checks`) |
| Tests | `web/src/lib/core/clinical/*.test.ts`, `web/src/lib/core/learning/references.test.ts`, `web/src/features/deficits/*.test.ts`, [`tests/test_neuropsych_domains.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_neuropsych_domains.py) |

```bash
uv run python scripts/fetch_references.py   # rewrites data/reference-records.json; needs network access
npm test --prefix web -- clinical references
npm run test:browser --prefix web -- deficits
uv run pytest tests/test_neuropsych_domains.py
```

Figure state (Fig. 1a, c): https://planumatlas.com/#anatomy=cdmd&tab=deficits&deficit=neglect. Fig. 1b: the same, with "Neglect of one side of each object" chosen in the key.
