# Deficits

The **Deficits** tab colours the atlas regions that published lesion studies associate with 121 acquired adult deficits, one colour per finding, from a hand-curated catalogue in `data/neuropsychology.yaml` whose every citation is checked against PubMed.

:::{list-table}
:widths: 22 78
:stub-columns: 1

* - Where in the viewer
  - **Deficits** tab (search by name, synonym or function; profile with findings, evidence and region list); the region inspector's **Neuropsychology** section; the lesion report's **Deficits** group ([lesion report](lesion-report.md)); each Circuits landmark's deficit link ([circuits](circuits.md)).
* - Built by
  - Authored in [`data/neuropsychology.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/neuropsychology.yaml); read at build time by [`web/src/lib/core/clinical/`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/clinical/catalog.ts); references verified by [`scripts/fetch_references.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/fetch_references.py) into [`data/reference-records.json`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/reference-records.json)
* - Configuration
  - [`config/neuropsych-domains.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/neuropsych-domains.yaml) (`lesion_checks` link functions to findings)
* - Source data
  - Peer-reviewed primary studies in PubMed (306 references); NCBI E-utilities and Crossref for identity records
* - Checked by
  - `web/src/lib/core/clinical/validate.ts` and its tests (`validate.test.ts`, `data.test.ts`, `catalog.test.ts`), `web/src/lib/core/learning/references.test.ts`, [`tests/test_neuropsych_domains.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_neuropsych_domains.py)
:::

## What it does

The 121 profiles describe acquired adult deficits and selected associations with brain regions. Search by name, synonym or function. A profile identifies the evidence, population and limitations for each finding, and links to its regions and relevant function maps. Regions are coloured by finding; the key indicates findings that cannot be coloured in the current view. **Restore previous view** returns to the view before opening a profile, and choosing a colour in the masthead replaces the profile colours.

```{figure} ../../.github/assets/readme/deficits.webp
:alt: Hemispatial neglect on the right hemisphere, each finding in its own colour, with the associations and evidence in the panel

**Hemispatial neglect** on the right hemisphere: one colour per finding, each with its regions and evidence.
```

When the consulted sources identify only a broad anatomical location, a finding may have no specific atlas parcel selected. Its mapping note explains the limit; the publications remain available. Every profile has at least one finding that colours a region, and the catalogue check refuses one that does not. A map showing both hemispheres can represent separate unilateral cases; the mapping note distinguishes this from bilateral injury.

The literature is selected, not a systematic review. A single case cannot establish that the same lesion pattern is required in everyone. Network studies may identify connected regions that were not directly injured. Group-level associations mapped onto a reference anatomy do not predict an individual patient's deficit.

## Data

`data/neuropsychology.yaml` is the single source. At the revision of 2026-11-02 it holds six groups, 121 deficits, 193 findings (called associations in the file) and 306 references.

### Schema

| Record | Fields |
| :--- | :--- |
| `groups` | `id`, `name` (`en`, `fr`). The six groups are the same as the Functions tab's, in the same order and words (a test asserts this) |
| `deficits` | `id`, `name`, `domain`, `group`, `summary`, `aliases` (each in `en` and `fr`; aliases are lists of search terms) |
| `associations` | `id`, `deficit`, `title`, `network`, `laterality` (`left`, `right` or `bilateral`), `finding`, `limitation`, `mapping_note` (each in `en` and `fr`), `mappings` (a list of `region` and `source_name`, possibly empty) and `evidence` (a list of `reference` and `role`, `supporting` or `qualifying`) |
| `references` | `id`, `title`, `authors`, `year`, `journal`, `doi`, `pmid`, `method` (`lesion-mapping`, `meta-analysis`, `case-report`, `case-series`), `scope` (`abstract` or `full-text`), `population` (`en`, `fr`) and optional `corrections` (each a `doi` and a bilingual `summary`) |

`scope` says what was read when the finding was extracted: 241 references are abstract-scope and 65 full-text. It describes the extraction source, not independent specialist approval or numerical reproduction. Methods: 137 case series, 121 lesion-mapping studies, 40 case reports and 8 meta-analyses. The 193 findings carry 386 evidence entries, 279 supporting and 107 qualifying; four references have a published correction recorded. Findings per profile: 64 profiles have one, 50 two, four three, one five, and aphasia and limb apraxia six each (the most the six finding colours allow). Profiles per group: sensorimotor 42, perception 22, attention and executive functions 19, language reading and number 16, memory 11, social and emotional functions 11.

### What a finding states

- **Finding** is what the study associated; **limitation** is what it does not establish (task specificity, population, chronic or acute, sample overlap, correction status).
- **Network** names the system in plain words and groups findings in the profile.
- **Mapping note** says how the study's anatomy became the parcels, including when the whole parcel is drawn as a guide to a portion of it.
- **Qualifying** evidence opposes or narrows a finding (a failed replication, a later study of the same cohort, a different task); every finding needs at least one **supporting** reference.
- **Laterality** is the side of the lesion evidence. A `left` or `right` finding may map only regions of that hemisphere; `bilateral` may map both.

### Mapping to atlas parcels

A mapping's `region` is a region id of the published manifest, `<atlas>:<hemisphere>:<code>`, and `source_name` is that region's source label. The 420 mappings in the catalogue point to Destrieux parcels (252), teaching-set structures (`learning:`, 83), FreeSurfer `aseg` structures (58) and NextBrain nuclei (27). Sixteen findings have no mapping: their sources locate the deficit only broadly, and the finding is retained, with its citations, uncoloured. Normative-connectivity, uncorrected, white-matter and anatomically unresolved findings are kept out of the paint, and connected-network nodes are not coloured as lesion sites. The wording is deliberate: a parcel is an atlas label mapped onto this brain, not the study's lesion volume.

## How it was built

1. **Selection.** A profile needs human patient evidence from peer-reviewed primary research, a deficit distinct from the existing profiles, and complementary publications that support or qualify the association. Healthy-activation findings alone, an isolated single case and a review as sole source do not qualify. Each review document records its own inclusion decisions (see [Evidence reviews](#evidence-reviews)).
2. **Verify every reference before writing it.** A reference is never written from memory: on 22 September 2026 two PMIDs recalled from memory pointed at unrelated papers. The record is fetched with the NCBI E-utilities (`efetch.fcgi?db=pubmed&id=<pmid>&retmode=xml`, `esearch` for a query, about 0.5 s between calls or responses come back empty; the PubMed web pages sit behind a cookie wall). Findings are quoted only from the fetched abstract, and `scope` stays `abstract` unless the full text was read. PubMed Central full text was obtained through `elink dbfrom=pubmed db=pmc` then `efetch db=pmc`; it returns an article body for some publishers only (older J Neurosci copies are page scans), and those records keep `abstract` scope.
3. **Write the profile.** Bilingual (English and French) text, aliases, findings with their limitations and mapping notes, supporting and qualifying evidence, and mappings only to the landmarks the sources justify.
4. **Record corrections.** A published erratum, correction or retraction is recorded on the reference with a bilingual summary of what changes. A retracted source is excluded; one such source was excluded in the reading and mood review.
5. **Regenerate the identity records.** `uv run python scripts/fetch_references.py` rewrites `data/reference-records.json`. For a few new PMIDs, import `pubmed_articles` and `article_record` from the script and merge those records rather than refetching all of them.
6. **Run the checks** (below).

### Citation verification

`scripts/fetch_references.py` collects every PMID, Bookshelf accession and DOI cited in `data/neuropsychology.yaml`, `data/circuits.yaml`, `data/archived-circuit-tours.yaml`, `config/{functional-regions,neuropsych-domains,receptor-fingerprints,arterial-territories,cerebellar-functions,striatal-networks,stimulation-responses}.yaml` and `docs/reference/references.md` (a DOI there without a PMID is refused). It then fetches:

- **PubMed** (`efetch`, 100 PMIDs per request): title, authors, journal, volume, issue, pages, PMCID, DOI, and PubMed's links to errata, corrected-and-republished notices, retractions and expressions of concern.
- **Bookshelf** (`esearch`/`esummary`): the title, book, editors, year and publisher of each NBK chapter.
- **Crossref**: a DOI that PubMed lacks (accepted only if Crossref's title and first-author surname match PubMed's), and the DOI of each correction notice (`filter=updates:<doi>`; a title and ISSN search when Crossref has no update link, which must resolve to exactly one DOI).

Requests are paced (0.5 s for E-utilities, 1.2 s for Crossref) and retried up to three times on HTTP 429 (honouring `Retry-After`). Abstracts are not stored. The year is PubMed's journal-issue year (`PubDate`, or the first year of a `MedlineDate` range), not the online-first year; for a Bookshelf chapter, the book's year. The file holds 386 records (381 PubMed articles and five Bookshelf chapters) fetched on 2026-11-02.

`web/src/lib/core/learning/references.test.ts` reads only that file, with no network, and asserts:

- each clinical reference's DOI, title (ignoring case, accents and punctuation), author surnames, issue year and recorded corrections equal its fetched record;
- the circuit references (active and archived), the functional-region, domain and receptor sources, the arterial-territory, cerebellar, striatal and stimulation-response sources and the bibliography in `docs/reference/references.md` name the work their PMID and DOI identify;
- no cited work has a retraction or expression-of-concern notice (a notice of that kind requires scientific review before inclusion);
- sources outside the clinical catalogue have no unrecorded correction;
- the records file holds exactly the cited works, no more.

Run it with `npm test --prefix web`. A real but wrong PMID fails, which the catalogue validator alone would not catch: it checks only the format of a PMID.

## How the viewer uses it

- **Loading.** `web/src/lib/core/clinical/load.ts` imports the YAML at build time; nothing reads YAML in the browser. `createClinicalCatalog` indexes deficits, findings and references by region, builds a bilingual search index and returns `forDeficit`, `forRegion`, `mappedRegions`, `paint`, `search`, `grouped` and `nearest`.
- **Search.** Query and text are normalised (case and accents ignored). The index holds each deficit's name, domain, aliases and each finding's title and network, in the interface language; a deficit whose name equals the query ranks first, then by name. A query that matches nothing offers the nearest name or alias.
- **Colour.** `findingPaint` gives each finding a colour in citation order from six (`FINDING_COLORS`: blue 57,135,229; magenta 213,81,129; green 0,131,0; amber 201,133,0; violet 98,80,214; pink 232,123,164) and paints each mapped region in the colour of the first finding that cites it, or only the regions of a chosen finding. The first three colours stay apart from one another and from the cortex's tissue colour under every pair, in normal vision and simulated colour-vision deficiency (OKLab $\Delta E$ at least 12 and 19); past three no order can keep every pair apart, so the key names each finding and shows one alone when chosen. A profile with more than six findings throws.
- **Teaching-set stand-ins.** A cited FreeSurfer structure is drawn as its teaching-set units when the teaching set is the internal anatomy shown (`standIns`, `drawnAs`; the units come from `neuropsych-domains.json`), and as itself when `aseg` is shown.
- **Components.** `web/src/features/deficits/`: `DeficitList.svelte`, `DeficitSearch.svelte`, `DeficitProfile.svelte`, `Association.svelte` (title, colour, regions, evidence behind a disclosure), `Publication.svelte` (role, method, paper, authors, population, source inspected and each published correction; titles, authors and journals stay in English whatever the interface says), `RelatedDeficits.svelte` (the inspector section) and `explorer.svelte.ts` (state and commands). `profile-meta.ts` counts the regions shown against the regions mapped under the current display.
- **Bridges to Functions.** A profile lists the activation maps its associations check (from `lesion_checks` in `neuropsych-domains.json`), and each tab links to the other's matches.
- **See through the cortex.** Deficits mapped only to deep regions already hide the cortex on open; mixed ones (neglect, emotion recognition, dysarthria, constructional impairment) get the offer to set the see-through opacity (0.15).
- **Lesion report.** A deficit with a finding whose cited region a placed lesion reaches is listed with the largest share reached ([lesion report](lesion-report.md)).

## Checks

| Check | Where | What it refuses |
| :--- | :--- | :--- |
| Dates, ids | `validateClinicalData` | missing revision date (`YYYY-MM-DD`), duplicate or blank ids |
| Bilingual text | `localized` | any translated field missing in `en` or `fr`, or text outside those keys (an unquoted comma in a YAML flow map splits the text into a stray key) |
| Deficits | `validateDeficit` | unknown group; aliases that are not lists of non-empty terms; a group with no deficits |
| References | `validateReference` | a DOI that is not `10.NNNN/…`, a non-numeric PMID, a year before 1800, an unknown method, a scope other than `abstract` or `full-text`, a malformed correction |
| Findings | `validateAssociation` | unknown deficit or reference; an invalid laterality or role; no supporting evidence; an unknown or `non-region` mapped region; a `source_name` that disagrees with the region (compared canonically, since two reconstructions spell some parcel names differently); a hemisphere that does not match the laterality; a duplicate region within a finding |
| Coverage | `validateClinicalData` | a profile in which no finding maps a region |
| Colours | `findingPaint` | more findings than colours; an unknown chosen finding |
| Published content | `data.test.ts` | fixed counts (6 groups, 121 deficits, 306 references, 193 associations at revision 2026-11-02), exact deficit ids, region resolution on each published anatomy, and the specific mapping limits of reviewed findings (for example, that the callosal alien-hand finding colours anterior subdivisions and leaves the posterior callosum uncoloured, that the amusia connectivity finding stays uncoloured, and that deep praxis lesions stay uncoloured) |
| References | `references.test.ts` | see Citation verification |
| Function bridge | `lesion_checks` (Python) | a function that cites an association that does not exist |

## Limits

- The literature is selected, not a systematic review; clinical accuracy has not been validated and the catalogue is not a diagnostic or prognostic tool.
- A single case cannot establish that the same lesion pattern is required in everyone. Network studies may identify connected regions that were not directly injured.
- Group-level associations on a reference anatomy do not predict an individual patient's deficit.
- Extraction scope: 241 of the 306 references were read at abstract level. They remain a review backlog; the [full-text review](../reference/full-text-review.md) checked eight articles against every finding that cites them. The [circuit evidence audit](../reference/circuit-evidence.md) records clinical-source provenance for its historical set of tours; the audit and software checks do not establish patient-level validity.
- A parcel is an anatomical guide: the whole parcel can be drawn where a study implicated a portion of it, and a deficit's profile can omit anatomy that has no parcel (white-matter tracts, for example).
- Sample overlap: consortium, cohort and registry findings can share participants; the reviews flag this where known.

## Reproduce

```bash
# Check identities of every cited work (writes data/reference-records.json; needs network access)
uv run python scripts/fetch_references.py

# Catalogue and citation checks
npm test --prefix web
uv run pytest tests/test_neuropsych_domains.py

# Build and validate with the catalogue
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
```

Edits to `data/*.yaml` need a dev-server restart. Quote flow-map values that contain commas.

## Evidence reviews

Each pass that changed the catalogue has a review in `docs/reference/`; the reviews are kept as historical records. They list the sources considered, the inclusion decisions, what was left out and why, and which regions were coloured.

- The [31 October additions review](../reference/deficit-additions-2026-10-31.md) documents ten profiles added in two passes, including timing, gesture recognition, sustained attention and astasia.
- The [1 November additions review](../reference/deficit-additions-2026-11-01.md) documents two passes covering visual verticality, source memory, micrographia, hypersomnia and two distinct eye-movement deficits. It retains negative findings and task-specific results, and leaves insufficiently resolved anatomy and normative-connectivity findings uncoloured.
- The [reading, perception and mood review](../reference/deficit-additions-2026-11-01-reading-perception-mood.md) adds phonological reading and depressive symptoms. It distinguishes corrected lesion results from disconnection findings and failed replication, and records an excluded retracted source.
- The [actions and motion review](../reference/deficit-additions-2026-11-01-actions-and-motion.md) adds surface alexia, personal neglect and auditory-motion perception. It keeps regularization errors distinct from general reading accuracy and separates cortical landmarks from exploratory network or anatomically unresolved findings.
- The [eye-movement review](../reference/deficit-additions-2026-11-01-eye-movements.md) adds horizontal and vertical gaze palsies and gaze-evoked nystagmus. It distinguishes gaze range from gaze holding, with broad brainstem landmarks and explicit limits on unresolved tract, nuclear and cerebellar anatomy.
- The [visual recognition and awareness review](../reference/deficit-additions-2026-11-01-visual-awareness.md) adds language self-appraisal and mirror-image discrimination. It distinguishes overlapping tasks, differing awareness measures and selective case findings, with explicit extraction scopes and mapping limits.
- The [facial movement, cough and bladder review](../reference/deficit-additions-2026-11-01-facial-cough-bladder.md) adds emotional facial paresis and post-stroke urinary retention. It distinguishes motor dissociations and competing bladder mechanisms, retaining broad brainstem landmarks only for the selected direct lesion findings.
- The [reading, writing and remote-memory review](../reference/deficit-additions-2026-11-01-reading-writing-memory.md): all five of its profiles were removed on 1 November 2026 (see below); the review remains as a historical record.
- The [memory, fluency, fear learning and moral judgement review](../reference/deficit-additions-2026-11-01-memory-fluency-moral.md) adds material-specific memory, semantic memory, verbal fluency, fear conditioning and moral judgement. It keeps registry overlap, semantic-dementia comparisons and response-dependent conditioning results explicit, and colours only the reviewed landmarks.
- The [reward learning, reasoning, multitasking, grasping and vertigo review](../reference/deficit-additions-2026-11-01-reward-reasoning-vertigo.md) adds reversal learning, fluid intelligence, multitasking, pathological grasping and vertigo from cerebellar stroke. It records a published correction, keeps uncorrected and white-matter results out of the paint, and notes where two series disagree on the critical structure.
- The [line orientation, grammar, medullary sensory loss and smoking review](../reference/deficit-additions-2026-11-01-orientation-grammar-medulla-smoking.md) adds line-orientation judgement, agrammatism and paragrammatism, crossed sensory loss and disrupted smoking addiction. It flags consortium and registry overlap and keeps a null prospective study beside the positive smoking findings.
- The [cardiac autonomic dysfunction, hiccups and motor adaptation review](../reference/deficit-additions-2026-11-01-cardiac-hiccups-adaptation.md) adds cardiac changes after insular stroke, persistent hiccups and impaired motor adaptation. It keeps conflicting left and right cardiac findings apart and records four topics screened but not imported.
- The [sign language aphasia, post-stroke cognitive impairment and restless legs review](../reference/deficit-additions-2026-11-01-sign-cognition-restless-legs.md) adds these three profiles. It records a published correction to the pooled cognitive study and explains why two contradictory fairness studies were not imported.
- The [transient global amnesia, pure sensory stroke and ataxic hemiparesis review](../reference/deficit-additions-2026-11-01-amnesia-sensory-ataxic.md) adds these three profiles. It treats transient hippocampal lesions as markers rather than causes and states where the commonest lesion site has no atlas parcel.
- The [supplementary motor area, recognition memory and action naming review](../reference/deficit-additions-2026-11-01-sma-recognition-verbs.md) adds supplementary motor area syndrome, recollection and familiarity deficits, and impaired action naming. It keeps the dispute over recollection and familiarity explicit with the opposing study as qualifying evidence.
- The [praxis review](../reference/deficit-additions-2026-11-02-praxis.md) adds pantomime, real tool use and deep lesions to limb apraxia, and a callosal apraxia profile. It keeps the competing frontal and parietotemporal pantomime findings apart and leaves the deep-lesion finding uncoloured because its white matter has no parcel.
- The [Hart (2016) review](../reference/hart-2016-review-2026-11-02.md) compared the Functions and Deficits wording against a textbook, a targeted comparison and not a systematic review; it corrected the aphasia, memory and praxis introductions, removed two aliases from homonymous hemianopia, and made the distinction between activation consistency, specificity and lesion consequences visible on function profiles.
- The [full-text review log](../reference/full-text-review.md) records eight articles read in full against every finding and circuit that cites them.

On 1 November 2026, the 26 profiles whose findings coloured no atlas region were removed rather than given unsupported locations: autotopagnosia, oculomotor apraxia, and 24 profiles from the reviews above, including all five from the reading, writing and remote-memory review. Each review page lists its removed profiles. Their 60 references cited by no remaining finding were dropped from the catalogue and the citation cache, and the catalogue check now refuses a profile that colours no region.

## See also

- [Functions](functions.md): activation evidence, kept apart from lesion evidence; the lesion checks link the two.
- [Circuits](circuits.md): each tour links to the deficit its landmarks illustrate and separates deficit evidence from circuit background.
- [Lesion report](lesion-report.md): the deficits a placed lesion overlaps.
- [Stroke cases](stroke-cases.md): real lesions and language scores in the aphasia cohort.
- [Cortical atlases](cortical-atlases.md) and [internal anatomy](internal-anatomy.md): the parcels the findings map to.
- [References and licensing](../reference/references.md), [Validation and limits](../pipeline/validation.md).
