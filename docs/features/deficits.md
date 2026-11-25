# Deficits

The **Deficits** tab maps 149 acquired adult deficits onto the atlas regions that published patient studies associate with them. Each profile holds one to six findings. Each finding cites its supporting studies and any qualifying ones, states its limitation and how the study's anatomy became atlas parcels, and is painted in its own colour. The catalogue is a curated selection of 472 PubMed-indexed studies, not a systematic review, and its parcels are atlas labels on one reference brain, not lesion volumes.

```{figure} figures/deficits-1-light.webp
:alt: Three panels. a, a brain seen from the right with an opaque beige cortex and gyri painted blue, magenta, green and amber, above a key of five findings. b, the same view with the cortex hidden, in which the caudate and putamen are painted violet among unpainted deep structures. c, the side panel showing the finding "Neglect after basal ganglia and thalamic lesions" with its regions, reported finding, interpretation, mapping note and the first of two publications.
:name: fig-deficits-1

**Hemispatial neglect has five findings, one colour each, and each finding carries its evidence.** **a**, [The profile](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&tab=deficits&deficit=neglect&view=right) on the brain seen from the right. The angular and supramarginal gyri are cited by two findings and take the colour of the first (blue). The cortex stays opaque, so the putamen and caudate of the fifth finding (violet) are out of sight. **b**, The same profile after **Show 2 deep structures**, which hides the cortex and frames the internal anatomy, with the putamen and caudate in violet. The other four findings have no region coloured in this view, and the key under the panel gives only the fifth. **c**, The evidence of the fifth finding, with its reported finding, its interpretation, its mapping note and the first of two publications, a lesion–symptom mapping study (Karnath et al. 2002). The profile reports 10 of 11 mapped regions coloured, because the pulvinar is a NextBrain nucleus and the teaching set is the internal anatomy drawn. Subject CDMD `sub_013`; Destrieux cortex and teaching-set structures. Scale bars apply at the depth of the camera's target.
```

## Data

| Input | Content |
| :--- | :--- |
| [`data/neuropsychology.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/neuropsychology.yaml), revision 2026-11-19 | 6 groups, 149 deficits, 271 findings (`associations`), 472 references |
| [`data/reference-records.json`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/reference-records.json), fetched 2026-11-16, with later additions | 788 identity records (758 PubMed articles, 10 Bookshelf chapters, 20 works recorded by digital object identifier (DOI) alone: 19 datasets and 1 article) for every work cited in the repository and the published manifests |
| `public/models/<anatomy>/manifest.json` | The region ids and source labels that mappings must resolve to |
| `public/models/<anatomy>/neuropsych-domains.json` | Teaching-set stand-ins for FreeSurfer structures (`units`); Functions maps that cite a finding (`lesion_checks`) |

The 472 references span 1978–2026: 176 case series, 175 lesion-mapping studies, 111 case reports and 10 meta-analyses. Extraction scope is `abstract` for 214 and `full-text` for 258. Six references carry a recorded published correction. The 271 findings hold 600 evidence entries (368 supporting, 232 qualifying), and 168 findings carry at least one qualifying entry. By laterality, 124 findings are bilateral, 77 left and 70 right.

Findings per profile: one (69 profiles), two (58), three (9), four (8), five (3: hemispatial neglect, working memory, sign language aphasia) and six (2: aphasia, limb apraxia). Profiles per group: sensorimotor 45, perception and visuospatial abilities 31, attention and executive functions 22, language, reading and number 20, social and emotional functions 19, memory 12. The 498 mappings point to 172 distinct regions: Destrieux parcels (289 mappings), FreeSurfer `aseg` structures (87), teaching-set structures (`learning:`, 79), NextBrain nuclei (34) and Harvard arousal nuclei (`aan:`, 9). Fifty-one findings have no mapping.

| Record | Fields |
| :--- | :--- |
| `groups` | `id`, `name`. Ids, order and wording equal the Functions groups |
| `deficits` | `id`, `group`, `name`, `domain`, `summary`, `aliases` (search terms) |
| `associations` | `id`, `deficit`, `title`, `network`, `laterality` (`left`, `right`, `bilateral`), `finding`, `limitation`, `mapping_note`, `mappings` (`region`, `source_name`; may be empty), `evidence` (`reference`, `role`: `supporting` or `qualifying`) |
| `references` | `id`, `title`, `authors`, `year`, `journal`, `doi`, `pmid`, `method`, `scope` (`abstract`, `full-text`), `population`, optional `corrections` (`doi`, `summary`) |

Every free-text field is given in English and French, except a reference's `title`, `authors` and `journal`, which are recorded once.

## Method

### Admission of a study

A reference enters the catalogue with a PubMed identifier (PMID) and a DOI and one of four patient designs: `lesion-mapping`, `meta-analysis`, `case-report` or `case-series`. Its `population` states who was studied. Its `scope` records whether the finding was extracted from the abstract or the full text. It does not record independent review. A finding needs at least one `supporting` reference. A `qualifying` reference opposes or narrows it (a failed replication, an overlapping cohort, a different task). A published erratum or correction is recorded on the reference with a bilingual summary of what changes. A work with a retraction or expression of concern is refused.

### Mapping to parcels

A mapping names a region id of the published manifest, `<atlas>:<hemisphere>:<code>`, and that region's source label. The `mapping_note` states how the study's anatomy became the parcels, including where a whole parcel stands for part of it. A `left` or `right` finding may map only regions of that hemisphere. A `bilateral` finding may map both, and the note distinguishes separate unilateral cases from bilateral injury. Findings whose anatomy has no parcel, or that rest on normative connectivity, uncorrected statistics, white matter or unresolved locations, keep their citations and an empty or reduced `mappings`. Connected network nodes are not painted as lesion sites. Every profile must have at least one finding that maps a region.

### Record validation

`validateClinicalData` runs on every load and throws, naming the record, when a check fails. Across the catalogue it refuses a missing revision date (`YYYY-MM-DD`), a duplicate or blank id, and a translated field that is missing or blank in `en` or `fr` or that carries any other key. For groups and deficits it refuses an unknown group, a group with no deficits, and aliases that are not lists of non-empty terms. For a reference it refuses a blank title, authors or journal, a DOI not matching `10.NNNN/…`, a non-numeric PMID, a year before 1800, an unknown method or scope, and a malformed correction. For a finding it refuses an unknown deficit or reference, an invalid laterality or role, no supporting evidence, an unknown or `non-region` mapped region, a `source_name` that differs from the region's (compared canonically), a hemisphere that contradicts the laterality, and a region mapped twice in one finding. A profile with no mapped region is refused.

### Citation identity

`scripts/fetch_references.py` collected every PMID, Bookshelf accession and DOI cited in `data/neuropsychology.yaml`, `data/circuits.yaml`, `data/archived-circuit-tours.yaml`, eight `config/*.yaml` source files, `docs/reference/references.md`, the tract catalogues (`data/diffusion-*.yaml`) and the citation fields of every published manifest. It fetched PubMed records with E-utilities `efetch` in batches of 100 (title, authors, journal-issue year, DOI, PubMed Central identifier (PMCID) and correction or retraction links) and Bookshelf chapters with `esearch`/`esummary`. A DOI missing from PubMed was taken from Crossref only when Crossref's title and first-author surname matched PubMed's. A DOI that only a manifest or a tract catalogue cites, and that no fetched PubMed record carries, was recorded alone from its registration agency, Crossref or DataCite. Each correction notice was resolved to one DOI through Crossref's `updates:` filter, else through a search by title and International Standard Serial Number (ISSN). Zero or several matches stop the run. Requests were spaced by 0.5 s (E-utilities) and 1.2 s (Crossref) and retried up to three times on HTTP 429, honouring `Retry-After`. Abstracts are not stored. The year is PubMed's `PubDate` year (the first year of a `MedlineDate` range), not the online-first year.

`references.test.ts` reads only the records file and makes no request. For each clinical reference, its DOI, title (ignoring case, accents and punctuation), author surnames, year and recorded corrections must equal the fetched record, so a real but wrong PMID fails.

### Search

Queries and texts are lower-cased and stripped of accents. A deficit matches when the query is a substring of its name, domain, an alias, or the title or network of one of its findings, in the interface language. A deficit whose name equals the query ranks first. The rest follow in alphabetical order. A query that matches nothing is offered the nearest deficit name or alias.

### Paint

For a profile with findings $a_1,\dots,a_n$ in authored order ($n \le 6$, else `findingPaint` throws), finding $a_k$ takes colour $C_k$ of `FINDING_COLORS` = (57, 135, 229), (213, 81, 129), (0, 131, 0), (201, 133, 0), (98, 80, 214), (232, 123, 164). Region $r$ takes $C_{\min\{k\,:\,r \in a_k\}}$, the colour of the first finding that cites it (Fig. 1a). A chosen finding paints only its own regions in its own colour. A FreeSurfer structure is also painted on its teaching-set stand-ins, so it shows whichever internal anatomy is drawn.

## Display

Opening a profile draws its mapped regions together. The cortical atlas is switched to the commonest atlas among them if the loaded one draws none, and the internal anatomy to the level that holds most of the structures. Cuts are turned off, isolation is cleared, both hemispheres are shown, the cortex is shown only if a cortical region is cited, and the regions are framed. The cortex stays opaque, so cortical colours read as the key gives them. The profile's meta line counts the mapped regions drawn and coloured in the current view.

When the paint colours both cortical regions and drawn deep structures, the profile's **Show *n* deep structures** button hides the cortex and frames the structures (Fig. 1b). **Show the cortex** brings it back and frames the whole brain. The stage key lists the findings in their colours, and choosing one shows it alone. A finding with no region coloured in the current view is outlined in the key (Fig. 1b). With **Colour** set to **T1 MRI** (T1-weighted magnetic resonance imaging), the findings are painted over the scan, which shows wherever nothing is painted, and the key says so. The profile's **Linked MRI** opens the [linked MRI](linked-mri.md) at the first finding's first region, or the chosen finding's, with the paint over the planes.

In normal vision the first three colours and the cortex colour (#c4a897) differ pairwise by OKLab $\Delta E \ge 19.8$. Under full-severity dichromacy simulation (Machado matrices) the smallest difference is 12.5 for protanopia and deuteranopia and 11.3 for tritanopia (blue against green). These values were computed for this page; no repository test checks them.

Each finding lists its regions as buttons, and its **Evidence** disclosure shows the network, the reported finding, its limitation, the mapping note and each publication (Fig. 1c). A publication shows its role, design, title (linked to doi.org), authors, year, journal, population, extraction scope, PubMed link and corrections. Titles, authors and journals stay in English. **Activation maps this evidence checks** lists the Functions maps whose `lesion_checks` cite one of the profile's findings, and each row opens its map ([functions](functions.md)). **Restore previous view** returns to the scene and tab from before the first profile opened.

A region's inspector lists the deficits mapped on it under **Linked deficits**. The [lesion report](lesion-report.md#method) ranks deficits by the share of cited regions a placed sphere reaches, and each [circuit](circuits.md) links to its deficit. URL state is `tab=deficits&deficit=<id>`. The chosen finding is not part of the link.

On the Montreal Neurological Institute (MNI) [template](mni-template.md) a profile is listed only if every finding's regions exist there, and the list's coverage line counts those that are not. Every profile is listed there, coma's brainstem arousal nuclei included.

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| `data.test.ts` CAT-50 | Revision 2026-11-19: 6 groups, 149 deficits, 472 references, 271 findings | passes |
| `data.test.ts` | On CDMD sub_013 every published deficit resolves its regions, source labels and evidence; every profile has a colour per finding | passes |
| `data.test.ts` | On the MNI template every profile resolves; a copy of the template without its arousal nuclei leaves out coma alone and, built as complete, is refused | passes |
| `data.test.ts`, `catalog.test.ts` CAT-49 | The six colours; a seventh finding throws; aphasia has the most findings (6) and paints 7 regions | passes |
| `catalog.test.ts` | Each finding takes the next colour, a shared region the first, and one finding can be shown alone | passes |
| `data.test.ts` | Named mapping limits hold (motor neglect, amusia, Holmes tremor, alien hand, coma) | passes |
| `validate.test.ts` CAT-44 | Each refusal under Record validation, and acceptance of boundary values | passes |
| `catalog.test.ts`, `data.test.ts` CAT-45, CAT-42 | Case- and accent-insensitive search with the named deficit first; "aphasai" → Aphasia, "amnesie" → Amnésie, "abc" → none | passes |
| `references.test.ts` | Each cited work matches its fetched record; no retraction or expression of concern; the records file holds exactly the cited works | passes |
| `tests/test_neuropsych_domains.py` | A Functions lesion check must name an existing finding; deficit groups equal the Functions groups in order and wording | passes |

Among the mapping limits that `data.test.ts` fixes by name, the parietal motor-neglect, amusia-network and Holmes-tremor-network findings paint no region. Alien hand paints the anterior callosal segments (`aseg:midline:254`, `255`) and not the posterior (`251`). The dorsolateral-pons coma finding paints only `learning:left:pons`.

## Limitations

The literature is selected, not systematically reviewed. Clinical accuracy has not been validated, and the catalogue is not diagnostic or prognostic. Of the 472 references, 214 were extracted from the abstract only. A single case does not show that the same lesion is required in everyone. Consortium, cohort and registry studies can share participants.

Group associations drawn on one reference brain do not predict an individual patient's deficit.

A parcel can be drawn whole where a study implicated part of it. Anatomy without a parcel, such as white matter, is left uncoloured. Only one internal-anatomy level is drawn at a time, so a structure mapped on another level stays undrawn (Fig. 1).

Beyond the third colour, finding colours are not guaranteed to stay distinguishable. The key names each finding.

## Code availability

Code
: [`web/src/lib/core/clinical/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/lib/core/clinical) (`validate.ts`, `catalog.ts`, `load.ts`), [`web/src/features/deficits/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/features/deficits), [`scripts/fetch_references.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/fetch_references.py)

Configuration
: [`data/neuropsychology.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/neuropsychology.yaml); [`config/neuropsych-domains.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/neuropsych-domains.yaml) (`lesion_checks`)

Tests
: `web/src/lib/core/clinical/*.test.ts`, `web/src/lib/core/learning/references.test.ts`, `web/src/features/deficits/*.test.ts`, [`tests/test_neuropsych_domains.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_neuropsych_domains.py)

```bash
uv run python scripts/fetch_references.py   # rewrites data/reference-records.json; needs network access
npm test --prefix web -- clinical references
npm run test:browser --prefix web -- deficits
uv run pytest tests/test_neuropsych_domains.py
```

