# Circuits

The **Circuits** tab steps through 45 anatomical pathway and loop-branch tours, 124 landmarks in all. Each landmark is a labelled region of this brain's atlases; opening it loads that atlas, uncovers the region and frames it from an authored view with 12 mm of surrounding anatomy. Every tour cites circuit background separately from the patient studies behind its linked deficit. Apart from the corticospinal streamlines, the tours teach literature-described connections and measure nothing in this individual.

```{figure} figures/circuits-1.webp
:alt: Three panels of coloured cerebellar and brainstem structures on a dark background. a, the left cerebellar hemisphere from behind with its lobules in different colours and lobule V outlined in white. b, the same view with the left hemispheric lobules removed: the dentate nucleus in lilac, outlined in white, and everything else a translucent grey. c, the right brainstem, thalamus and corpus callosum seen from the midline in translucent grey, with the small red nucleus in red, outlined in white, below the thalamus.
:name: fig-circuits-1

**Three landmarks of the cerebellar output tour, each framed with its neighbours.** **a**, Landmark 1, left lobule V (outlined), posterior view. This anatomy publishes cerebellar lobules, so the landmark resolves to its lobule V form. **b**, Landmark 2, left dentate nucleus, same view. Its ten covering regions, the left hemispheric lobules and crura, are hidden, and it opens focused: the landmark in its colour, the rest a grey ghost. **c**, Landmark 4, right red nucleus, seen from the left (the midline face of the right hemisphere). The right midbrain territory and ventral tegmental area are hidden, and it opens focused as **b** does. Returning to landmark 1 shows both sets again. Subject CDMD sub_013; teaching-set internal anatomy; each landmark's side shown alone; region bounds plus 12 mm, filling 80% of the view.
```

## Data

[`data/circuits.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/circuits.yaml), revision 2026-11-21, holds the tours, a 262-entry bibliography and the framing margin, `context_margin_mm: 12`.

| Tour | Route | Landmarks | Linked deficit | Deficit evidence |
| :--- | :--- | ---: | :--- | :--- |
| `vision` | Optic chiasm → left optic tract → left dorsal lateral geniculate nucleus → left V1 | 4 | `hemianopia` | Zhang et al. 2006; Chen et al. 2025; Lugtmeijer et al. 2025 |
| `memory` | Left caudal subiculum → fornix → mammillary body → mammillothalamic tract → anteroventral thalamic nucleus | 5 | `amnesia` | Zola-Morgan et al. 1986; Aggleton et al. 2000; Harding et al. 2000; Danet et al. 2015; Vidal et al. 2025 |
| `motor` | Direct branch · left primary motor cortex → putamen → GPi → motor thalamus (VApc) → frontal motor areas. Indirect branch · left putamen → GPe → subthalamic nucleus → GPi. | 6 | `parkinsonism` | Fearnley & Lees 1991; Bhatia & Marsden 1994; Holm et al. 2025 |
| `cerebellar` | Left cerebellar cortex → left dentate nucleus → left superior cerebellar peduncle → midbrain crossing, then right red nucleus waypoint → right motor thalamus → right primary motor cortex. | 6 | `ataxia` | Schoch et al. 2006; Alalousi & Bonnan 2024 |
| `corticospinal` | Left primary motor cortex → left midbrain → pyramidal decussation in the caudal medulla → right lateral corticospinal tract | 4 | `hemiparesis` | Frenkel-Toledo et al. 2022; Kim et al. 2006 |
| `touch` | Left ventral posterolateral thalamic nucleus → area 3b → parietal opercular area OP1 → area OP4 | 4 | `somatosensory` | Meyer et al. 2016; Preusser et al. 2015; Taskin et al. 2006; Rullmann, Preusser & Pleger 2019 |
| `spinothalamic` | Left dorsal horn → right spinal lemniscus after the spinal crossing → right ventral posterior inferior thalamic nucleus → right parietal opercular area OP1 (proposed continuation) | 4 | `central-pain` | Karoam et al. 2025; Kim et al. 2007 |
| `pontine-motor` | Left primary motor cortex → left pontine nuclei → right ventral pons after the crossing → right cerebellar lobule V | 4 | `ataxic-hemiparesis` | Moulin et al. 1995; Marx et al. 2008 |
| `nigrostriatal` | Left substantia nigra pars compacta → left putamen (dorsolateral postcommissural territory) | 2 | `parkinsonism` | Fearnley & Lees 1991; Kordower et al. 2013 |
| `vestibular` | Left inferior cerebellar peduncle (juxtarestiform body) → left side of the cerebellar nodulus (vermis X) | 2 | `cerebellar-vertigo` | Moon et al. 2009; Lee et al. 2023 |
| `ventral-spinocerebellar` | Right cervical ventral spinocerebellar tract after the spinal crossing → right superior cerebellar peduncle → left lateral anterior vermis after an inferred cerebellar recrossing | 3 | `ataxia` | Schoch et al. 2006; Gheihman, Yomtoob & Viswanathan 2023 |
| `entorhinal-ca1` | Left entorhinal cortex → through the left caudal subiculum → left caudal CA1 (stratum lacunosum-moleculare landmark) | 3 | `amnesia` | Zola-Morgan et al. 1986; Rempel-Clower et al. 1996 |
| `stria-terminalis` | Left amygdala → left stria terminalis → left bed nucleus of the stria terminalis | 3 | `emotion-recognition` | Schmolck & Squire 2001; Hayakawa et al. 2010; Tippett et al. 2018 |
| `motion-mt-mst` | Right V1 → right MT (V5) → right MST | 3 | `akinetopsia` | Zihl et al. 1991; Heutink et al. 2019; Otsuka-Hirota et al. 2014; Prabhakar et al. 2025; Lugtmeijer et al. 2025 |
| `colour` | Right V1 → right V2 → right V4 | 3 | `achromatopsia` | Bouvier & Engel 2006; Munk et al. 2023 |
| `transcallosal-sma` | Left caudal supplementary motor area → corpus callosum (midline crossing) → right caudal supplementary motor area | 3 | `callosal-apraxia` | Rothi, Heilman & Watson 1985; Lausberg et al. 2003 |
| `piriform-orbitofrontal` | Right piriform cortex → right posterior orbitofrontal cortex | 2 | `olfactory-recognition` | Jones-Gotman & Zatorre 1993; Dahmani et al. 2018; Doty et al. 2018 |
| `schaffer-collaterals` | Left rostral CA3 (stratum pyramidale) → left rostral CA1 (stratum radiatum) | 2 | `amnesia` | Zola-Morgan et al. 1986; Rempel-Clower et al. 1996; Miller et al. 2020 |
| `navigation` | Right posterior parahippocampal cortex → right retrosplenial area 30 → right presubiculum | 3 | `topographical-disorientation` | Takahashi et al. 1997; Blondiaux et al. 2024; Hashimoto, Komori & Abe 2015 |
| `slf3-opercular` | Left supramarginal gyrus → left inferior frontal area 44 via SLF III | 2 | `apraxia` | Metaireau et al. 2024; Dressing et al. 2021 |
| `gustatory-insulo-orbitofrontal` | In the macaque, anterior insular and frontal opercular taste region → middle and posterior thirds of the caudolateral orbitofrontal taste region | 2 | `taste-impairment` | Pritchard, Macaluso & Eslinger 1999; Stevenson, Miller & McGrillen 2013; Stevenson & Miller 2013 |
| `uncinate-temporopolar` | In macaques, orbitofrontal area 11 → uncinate fasciculus around the limen of the insula → temporopolar proisocortex | 2 | `cognitive-estimation` | Pflugshaupt et al. 2020; Cipolotti et al. 2018 |
| `arcuate-dorsal-frontotemporal` | In macaques, rostral area 8Ad → caudal superior temporal gyrus via the arcuate fasciculus | 2 | `aphasia` | Na et al. 2022; Xing et al. 2016; Fridriksson et al. 2010; Kim et al. 2002 |
| `basal-amygdala-mediodorsal` | Right basal nucleus of the amygdala → right magnocellular mediodorsal thalamic nucleus | 2 | `emotion-recognition` | Schmolck & Squire 2001; Tippett et al. 2018 |
| `frontal-aslant-opercular` | Left inferior frontal area 44 → left pre-supplementary motor region (direction traced in a rhesus macaque) | 2 | `speech-apraxia` | Hillis et al. 2004; Zhong et al. 2022 |
| `motor-hyperdirect` | Left primary motor cortex → dorsolateral portion of the left subthalamic nucleus | 2 | `hemichorea` | Lee & Marsden 1994; Kim et al. 2008 |
| `anterior-commissure-temporal` | Right rostral auditory association cortex (TA) → right anterior commissure → left anterior commissure (across the midline) → left rostral auditory association cortex (TA) | 4 | `cognitive-estimation` | Pflugshaupt et al. 2020 |
| `thalamocingulate-posterior` | Right anteroventral thalamic nucleus → right ventral posterior cingulate cortex | 2 | `amnesia` | Harding et al. 2000; Grulich, Lösken & Müri 2025 |
| `vertical-occipital-v3a-v4` | Dorsal V3A → peripheral upper-field sector of ventral V4 (macaque projection shown with left-sided landmarks in the human atlas) | 2 | `alexia` | Leff et al. 2006; Sabsevitz et al. 2025 |
| `slf2-dorsal-frontoparietal` | Caudal area 8Ad → area Opt via the superior longitudinal fasciculus II (macaque projection shown with right-sided landmarks in the human atlas) | 2 | `neglect` | Chechlacz et al. 2012; Thiebaut de Schotten et al. 2014 |
| `inferior-pulvinar-mt` | Medial subdivision of the inferior pulvinar → visual area MT (macaque projection shown with right-sided landmarks in the human atlas) | 2 | `akinetopsia` | Zihl et al. 1991 |
| `rubrospinal-crossed` | Right red nucleus → left upper cervical rubrospinal tract after the midbrain crossing | 2 | `holmes-tremor` | Raina et al. 2016; Nieuwhof et al. 2020; Genc et al. 2017 |
| `mediodorsal-prefrontal` | Left parvocellular mediodorsal thalamic nucleus → middle portion of left dorsal area 46 | 2 | `working-memory` | Barbey, Koenigs & Grafman 2013; Bellebaum et al. 2005; Geier et al. 2026 |
| `dorsal-spinocerebellar` | Restiform body of the right inferior cerebellar peduncle → right part of the anterior cerebellar vermis | 2 | `ataxia` | Schoch et al. 2006; Marx et al. 2008; Naoi et al. 2025 |
| `mdlf-parietotemporal` | Caudal inferior parietal lobule (PG–Opt injection region) → area TPO in the upper bank of the superior temporal sulcus via the middle longitudinal fasciculus (ipsilateral projection traced in a rhesus macaque) | 2 | `aphasia` | Dronkers et al. 2004 |
| `septohippocampal-ca1-oriens` | Medial septal nucleus → CA1 stratum oriens (macaque projection illustrated with right-sided landmarks in the human atlas) | 2 | `amnesia` | Abe et al. 1998; Mugikura et al. 2014 |
| `valuation` | Left area 25 → left accumbens core → left ventral pallidum → left ventral tegmental area | 4 | `decision-making` | Gläscher et al. 2012; Fellows & Farah 2005 |
| `associative-frontocaudate` | Rostral part of left prefrontal area 46 → central and medial parts of the left caudate head | 2 | `working-memory` | Barbey, Koenigs & Grafman 2013; Baier et al. 2010 |
| `dorsal-cingulum-anterior-posterior` | Pregenual anterior cingulate cortex → posterior cingulate cortex via the dorsal cingulum (macaque projection shown with left-sided human atlas landmarks) | 2 | `akinetic-mutism` | Németh, Hegedüs & Molnár 1988; Zhang et al. 2024 |
| `olivocerebellar-flocculus` | Left inferior cerebellar peduncle (restiform region) → left cerebellar flocculus | 2 | `room-tilt-illusion` | Charles et al. 1992 |
| `basal-amygdala-area25` | Left basal nucleus of the amygdala → left subgenual area 25 | 2 | `decision-making` | Gläscher et al. 2012 |
| `dentate-thalamo-putamen` | Left dentate nucleus → crossing to the right thalamus → right putamen | 3 | `dystonia` | Bhatia & Marsden 1994; Krystkowiak et al. 1998 |
| `ca1-subiculum` | Ventral CA1 pyramidal layer → alveus → ipsilateral ventral subiculum (rat projection illustrated with left-sided human atlas landmarks) | 3 | `amnesia` | Zola-Morgan et al. 1986; Rempel-Clower et al. 1996 |
| `dorsal-geniculate-mt` | Dorsal lateral geniculate nucleus → visual area MT (macaque projection shown with right-sided human atlas landmarks) | 2 | `akinetopsia` | Zihl et al. 1991; Prabhakar et al. 2025 |
| `subthalamic-crus-ii` | Left subthalamic nucleus → posterior right Crus II (after crossing) | 2 | `cerebellar-cognitive` | Schmahmann & Sherman 1998; Chirino-Pérez et al. 2022 |

Each route is the tour's own `route` text. The bibliography has 252 PubMed articles (144 with a PMC full text), 9 chapters of Purves et al., *Neuroscience*, 2nd edition, and one StatPearls chapter (NCBI Bookshelf). The corticospinal tour's first three landmarks draw `cst-left`, the left corticospinal bundle tracked in this subject's diffusion MRI ([tracts](tracts.md)). Withdrawn tours are kept, with their 69 references, in [`data/archived-circuit-tours.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/archived-circuit-tours.yaml) (28 tours, 86 landmarks; `hearing` withheld pending anatomical rework). The viewer does not load the archive.

## Method

### Tour content
A tour is a specified anatomical pathway or loop branch whose stops are labelled regions of the atlases the viewer carries. Each tour states its `route`, its `scope` (what is omitted) and its `clinical` text (what the patient sources show and do not show), in English and French. Each landmark states its `role`, `explanation` and `mapping`; the mapping says how the atlas label approximates the structure. For example, the whole thalamus stands for its cerebellar-recipient territory, the anteroventral nucleus is drawn while the anteromedial and anterodorsal nuclei appear only on cut faces, and projections known from monkey tracing are labelled as such. `references` lists every cited work, and `clinical_references` marks the subset that is deficit evidence. The remainder is circuit background.

### Landmark fields
Each landmark names a `region` id and its exact `source_name`, a camera `view` and a Linked MRI `plane`. Optional fields are `covering_regions` (structures hidden to expose it), `tract` (one of the anatomy's bundles, drawn whole), `map` (`visual-field`, offered at V1; [visual field map](visual-field-map.md)) and `alternatives`. Views across the 124 landmarks: right 30, left 29, anterior 29, inferior 16, posterior 16, superior 4. Planes: coronal 77, axial 34, sagittal 13.

### Resolution on an anatomy
A landmark with `alternatives` has one form per way an anatomy can be divided; each alternative overrides the base fields. Exactly one form must have its `region` and all `covering_regions` present in the manifest; zero or two throw with the count and region. On CDMD the cerebellar cortex landmark resolves to lobule V (`learning:lobule-v-left`), and the dentate to its form covering ten left lobules and crura (Fig. 1a, b). A landmark's `restores` is every region another landmark of the tour covers but it does not, so arriving at it uncovers what earlier steps hid.

### Catalogue validation
`createCircuitCatalog` throws, naming the record, on: an empty or non-positive margin; a duplicate id; a non-HTTPS reference URL; a reference with neither a numeric PMID nor an `NBK` accession; a malformed PMCID or correction DOI; a translation missing in `en` or `fr` or with another key; an unknown deficit; a tour with no references; `clinical_references` empty, repeated or not among the tour's references; an unknown region, covering region, view, plane, tract bundle or map; a source label that differs from the region's; a landmark that is not `cortex` or `structure`; a covering region that is not a different structure in the landmark's atlas and hemisphere. A separate test requires each tour's deficit evidence to include a PMID that the [deficit catalogue](deficits.md#method) records as supporting evidence for that deficit. Every identifier is checked against its fetched PubMed or Bookshelf record (URL form, PMCID, title, first author, year, book, corrections) as described under [deficits](deficits.md#method).

### Framing
`frameLandmark` takes the bounding box of the landmark's meshes and expands it by `context_margin_mm` (12 mm) on every side. If the box's bounding sphere is still under 50 mm in radius, the box is grown evenly until it reaches 50 mm. The camera is placed along the authored view direction with that view's up vector, and the box fills 80% of the view (`FRAME_FILL`). A region with no drawn geometry is refused rather than framed.

## Display
A tour opens on its whole route, headed by the circuit's name (the location bar truncates it), then the route sentence and what the numbers mark. Nothing is selected, the cut is off, both hemispheres are shown and the cortex is see-through (0.15). The internal anatomy holding most of the deep landmarks is revealed (a teaching-set union of NextBrain labels, such as the midline optic chiasm, is drawn as those labels), the spinal cord is shown if a landmark lies in it, the view is oblique, and a numbered mark sits at each landmark's anchor: the number alone, the landmark's name in its tooltip and accessible name, as the landmark list names them all. **Next** and **Previous** in the location bar, or a row of the landmark list, open a landmark. Opening a landmark loads its atlas and layer and selects it. It shows the regions the landmark restores, hides its covering regions and shows only its hemisphere (both for a midline region). Focus is turned on for a structure the opaque picture hides (a deep forebrain structure, or a nucleus, peduncle or white matter inside the brainstem or cerebellum, not their outer parts), and the landmark is framed (Fig. 1). **Focus** or **Return to landmark** repeats the framing. On a landmark with a `tract`, its bundle is drawn alone; the stretches that anatomy in front hides are drawn at 0.3 opacity with a greater-than depth test. The bundle is removed on any step without one, on the route, and when the tab or tour is left ([tracts](tracts.md)). **Linked MRI** places the crosshair at the landmark's anchor (its own voxel nearest its centroid), turns the overlay on and opens the authored plane ([linked MRI](linked-mri.md)).

The notes hold four disclosures: **Connections and scope**, **What this atlas shows**, **Clinical context** (with **Open deficit evidence**, which opens the linked deficit) and **Sources**. Sources labels each reference **Deficit evidence** or **Circuit background** and gives the revision date. Outside the Circuits tab, a region's inspector lists the landmarks on it and opens the tour there. Leaving a tour restores the scene from before it. URL state: `tab=circuits&circuit=<id>&step=<n>` (1-based) or `&route=1`. A link to an unknown or withdrawn tour or step reports those parameters as unsupported and applies the rest of the scene.

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| `catalog.test.ts` CAT-53 | Revision 2026-11-21, margin 12 mm, 262 references; the 45 tours in order, each with its landmark count and deficit | passes |
| `catalog.test.ts` | The 45 tours resolve, 124 landmarks with exact source labels, on every published anatomy | passes |
| `catalog.test.ts` | Cerebellar output: left, left, left, right, right, right; lobule V and 10 left covering lobules where lobules are published; red nucleus covers right midbrain and VTA | passes |
| `catalog.test.ts` CAT-52 | Zero or two resolving forms throw with count and region; landmarks 1, 3, 5, 6 restore both covering sets, 2 and 4 the other's | passes |
| `catalog.test.ts` | Corticospinal tracts `cst-left, cst-left, cst-left, null`; an unknown bundle, or an anatomy without `cst-left`, throws | passes |
| `catalog.test.ts` | Covering regions must be other structures in the landmark's atlas and hemisphere | passes |
| `catalog.test.ts` CAT-51, CAT-54 | Each catalogue refusal; a 0.5 mm margin is accepted; unknown circuit, landmark or reference throws by name | passes |
| `catalog.test.ts` | Clinical references are declared and distinct; every active and archived tour cites supporting evidence for its deficit | passes |
| `catalog.test.ts` | 28 archived tours (210 landmarks with the active ones) resolve but cannot be opened as active circuits | passes |
| `references.test.ts` | Active and archived circuit references name the works their identifiers resolve to | passes |
| `lesson.test.ts` | Route first; the visual route draws NextBrain with its chiasm; every whole route draws its deep landmarks but the pontine motor tour's lobule V; deep landmark opens focused; ungeometried landmark refused; Linked MRI opens the prepared plane | passes |

## Limitations
- The tours teach anatomy described in the literature; only the corticospinal streamlines come from this brain.
- The streamlines are diffusion-MRI estimates. They stop near the caudal medulla, before the crossing, and do not isolate fibres within the broad brainstem landmarks.
- Atlas labels approximate the structures: a teaching union can be broader than the structure, and a whole nucleus can stand for one territory.
- Some projections are known from tracing in nonhuman primates, cats, rabbits or rodents.
- Each tour's `scope` names what it omits: the visual tour, for example, omits the retina, optic nerves and optic radiations, and the memory tour is one branch, not a complete or necessary Papez circuit.
- A route draws one internal anatomy at a time. The pontine motor tour's pontine nuclei are NextBrain's alone and its lobule V the teaching set's alone, so its whole route draws no lobule V; the lobule appears when that landmark is opened. Its pontine nuclei are not widened to the teaching set's pontine territory, 6.7 times their volume, to draw it.
- A deficit study supports a region–deficit association, not the pathway's connections; clinical accuracy has not been validated.

## Code availability

| | |
| :--- | :--- |
| Code | [`web/src/lib/core/learning/catalog.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/learning/catalog.ts), [`web/src/lib/controller/lesson.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/controller/lesson.ts), [`web/src/lib/controller/navigation/learning.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/controller/navigation/learning.ts), [`web/src/lib/engine/framing.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/engine/framing.ts), [`web/src/features/circuits/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/features/circuits) |
| Configuration | [`data/circuits.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/circuits.yaml); [`data/archived-circuit-tours.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/archived-circuit-tours.yaml) |
| Tests | `web/src/lib/core/learning/*.test.ts`, `web/src/lib/controller/lesson.test.ts`, `web/src/features/circuits/*.test.ts` |

```bash
npm test --prefix web -- learning lesson
npm run test:browser --prefix web -- circuits
```

Figure state: https://planumatlas.com/#anatomy=cdmd&tab=circuits&circuit=cerebellar&step=1 (Fig. 1a), `step=2` (b), `step=4` (c).
