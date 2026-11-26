# Circuits

The **Circuits** tab steps through 45 anatomical pathway and loop-branch tours, 124 landmarks in all. Each landmark is a labelled region of this brain's atlases. Opening it loads that atlas, uncovers the region and frames it from an authored view with 12 mm of surrounding anatomy. Every tour cites circuit background separately from the patient studies behind its linked deficit. Apart from the corticospinal streamlines, the tours teach literature-described connections and measure nothing in this individual.

```{figure} figures/circuits-1-light.webp
:alt: Three panels of coloured cerebellar and brainstem structures on black. a, the left cerebellar hemisphere from behind with its lobules in different colours and lobule V outlined in white. b, the same view with the left hemispheric lobules removed, the dentate nucleus in lilac, outlined in white, and everything else a translucent grey. c, the right brainstem, thalamus and corpus callosum seen from the midline in translucent grey, with the small red nucleus in red, outlined in white, below the thalamus.
:name: fig-circuits-1

**Three landmarks of the cerebellar output tour are each framed with their neighbours.** **a**, [Landmark 1](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&region=learning:lobule-v-left&view=posterior&cam=-22.5,-3.8,175.6,-17.8,-3.9,31.5&hemi=left&cortex=0&tab=circuits&circuit=cerebellar), left lobule V (outlined), seen from behind. This anatomy publishes cerebellar lobules, so the landmark resolves to its lobule V form. **b**, [Landmark 2](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&hidden=learning:crus-i-left,learning:crus-ii-left,learning:lobule-ix-left,learning:lobule-v-left,learning:lobule-vi-left,learning:lobule-viib-left,learning:lobule-viiia-left,learning:lobule-viiib-left,learning:lobule-x-left,learning:lobules-i-iv-left&region=learning:left:dentate&focus=1&view=posterior&cam=-22.8,-15.3,189.6,-17.8,-15.5,34.6&hemi=left&cortex=0&tab=circuits&circuit=cerebellar&step=2), the left dentate nucleus, in the same view. Its ten covering regions, the left hemispheric lobules and crura, are hidden, and it opens focused, with the landmark in its colour and the rest a grey ghost. **c**, [Landmark 4](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&hidden=learning:right:midbrain,learning:right:vta&region=learning:right:red-nucleus&focus=1&view=left&cam=-149.6,17.5,2.6,3.2,10.6,7.6&hemi=right&cortex=0&tab=circuits&circuit=cerebellar&step=4), the right red nucleus, seen from the left (the midline face of the right hemisphere). The right midbrain territory and ventral tegmental area are hidden, and it opens focused as **b** does. Returning to landmark 1 shows both sets again. Subject CDMD `sub_013`; teaching-set internal anatomy; each landmark's side shown alone; the camera frames the region's bounds plus 12 mm in 80% of the view. Scale bars apply at the depth of the camera's target.
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

Each route is the tour's own `route` text. In it, GPi and GPe are the internal and external segments of the globus pallidus, VApc is the parvocellular division of the ventral anterior thalamic nucleus, and SLF is the superior longitudinal fasciculus. The bibliography has 252 PubMed articles, 144 of them with a full text in PubMed Central (PMC). Its other ten entries are book chapters on the National Center for Biotechnology Information (NCBI) Bookshelf: 9 chapters of Purves et al., *Neuroscience*, 2nd edition, and one StatPearls chapter. The corticospinal tour's first three landmarks draw `cst-left`, the left corticospinal bundle tracked in this subject's diffusion magnetic resonance imaging (MRI) ([tracts](tracts.md)). Withdrawn tours are kept, with their 69 references, in [`data/archived-circuit-tours.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/archived-circuit-tours.yaml) (28 tours, 86 landmarks; `hearing` withheld pending anatomical rework). The viewer does not load the archive.

## Method

### Tour content

A tour is a specified anatomical pathway or loop branch whose stops are labelled regions of the atlases the viewer carries. Each tour states its `route`, its `scope` (what is omitted) and its `clinical` text (what the patient sources show and do not show), in English and French. Each landmark states its `role`, `explanation` and `mapping`. The mapping says how the atlas label approximates the structure. For example, the whole thalamus stands for its cerebellar-recipient territory, the anteroventral nucleus is drawn while the anteromedial and anterodorsal nuclei appear only on cut faces, and projections known from monkey tracing are labelled as such. `references` lists every cited work, and `clinical_references` marks the subset that is deficit evidence. The remainder is circuit background. A tour may carry a `diagram`: its landmarks placed on a grid (`nodes`, each with a `column`, a `row` and a short `label`) and the sign of each projection between them (`edges`, each `excitatory` or `inhibitory`). The basal ganglia motor loops carry one, with the six signs their landmarks' explanations state.

### Landmark fields

Each landmark names a `region` id and its exact `source_name`, a camera `view` and a Linked MRI `plane`. Optional fields are `covering_regions` (structures hidden to expose it), `tract` (one of the anatomy's bundles, drawn whole), `map` (`visual-field`, offered at V1; [visual field map](visual-field-map.md)) and `alternatives`. Across the 124 landmarks the authored views are right (30), left (29), anterior (29), inferior (16), posterior (16) and superior (4). The planes are coronal (77), axial (34) and sagittal (13).

### Resolution on an anatomy

A landmark with `alternatives` has one form per way an anatomy can be divided, and each alternative overrides the base fields. Exactly one form must have its `region` and all its `covering_regions` present in the manifest. Two resolving forms throw an error that gives the count and the region, on any anatomy. No resolving form throws the same error on the default anatomy, CDMD sub_013. On another anatomy a landmark with no resolving form leaves its tour out of the list. On CDMD the cerebellar cortex landmark resolves to lobule V (`learning:lobule-v-left`), and the dentate to its form covering ten left lobules and crura (Fig. 1a, b). A landmark's `restores` is every region that another landmark of the tour covers and the landmark itself does not, so arriving at the landmark uncovers what earlier steps hid.

### Catalogue validation

`createCircuitCatalog` throws an error on each fault below, and every error but the margin's names the offending record or value. For the catalogue as a whole, the faults are an empty or non-positive margin, a duplicate id, and a translation missing in `en` or `fr` or with another key. For a reference, they are a non-HTTPS reference URL, a reference with neither a numeric PubMed identifier (PMID) nor an `NBK` accession, and a malformed PMC identifier (PMCID) or correction digital object identifier (DOI). For a tour, they are an unknown deficit, a tour with no references, and `clinical_references` that are empty, repeated or not among the tour's references. For a landmark, they are an unknown region, covering region, view, plane, tract bundle or map, a source label that differs from the region's, a landmark that is not `cortex` or `structure`, and a covering region that is not a different structure in the landmark's atlas and hemisphere. For a diagram, they are an empty node or edge list, a node that is not a landmark of the tour, a repeated node, a column or row that is not a positive integer, two nodes in one cell, a label missing a language, an edge to an unknown node, an unknown sign, an edge between cells that are not neighbours, and two edges between one pair of nodes. On an anatomy other than the default, a tour with an unknown deficit, region, covering region or tract bundle, or with a source label that differs, is left out of the list, and no error is thrown.

A separate test requires each tour's deficit evidence to include a PMID that the [deficit catalogue](deficits.md#method) records as supporting evidence for that deficit. Every identifier is checked against its fetched PubMed or Bookshelf record (URL form, PMCID, title, first author, year, book, corrections) as described under [deficits](deficits.md#method).

### Framing

`frameLandmark` takes the bounding box of the landmark's meshes and expands it by `context_margin_mm` (12 mm) on every side. If the box's bounding sphere is still under 50 mm in radius, the box is grown evenly until it reaches 50 mm. The camera is placed along the authored view direction with that view's up vector, and the box fills 80% of the view (`FRAME_FILL`). A region with no drawn geometry is refused rather than framed.

## Display

A tour opens on its whole route. The panel is headed by the circuit's name, which the location bar truncates, followed by the route sentence and a note on what the numbers mark. Nothing is selected, the cut is off, both hemispheres are shown and the cortex is see-through (opacity 0.15). The internal anatomy holding most of the deep landmarks is revealed, and a teaching-set union of NextBrain labels, such as the midline optic chiasm, is drawn as those labels. The spinal cord is shown if a landmark lies in it, and the view is oblique. A numbered mark sits at each landmark's anchor. The mark shows the number alone, because the landmark list names every landmark. Its tooltip and accessible name carry the landmark's name.

**Next landmark** and **Previous landmark** in the location bar, or a row of the landmark list, open a landmark. At the first landmark the previous control reads **Whole route** and returns to the route. Opening a landmark loads its atlas and layer and selects it. It shows the regions the landmark restores, hides its covering regions and shows only its hemisphere (both for a midline region). Focus is turned on for a structure the opaque picture hides: a deep forebrain structure, or a nucleus, peduncle or white matter inside the brainstem or cerebellum, not their outer parts (Fig. 1b, c). The landmark is then framed (Fig. 1). **Focus** or **Return to landmark** repeats the framing.

On a landmark with a `tract`, its bundle is drawn alone. The stretches that anatomy in front hides are drawn at 0.3 opacity with a greater-than depth test. The bundle is removed on any step without one, on the route, and when the tab or tour is left ([tracts](tracts.md)). **Linked MRI** places the crosshair at the landmark's anchor (its own voxel nearest its centroid), turns the overlay on and opens the authored plane ([linked MRI](linked-mri.md)).

A tour with a `diagram` shows it under the landmark list as **Excitation and inhibition**: each landmark is a box carrying its number from the list, and each projection is one straight segment between neighbouring boxes. A projection that excites ends in an arrowhead and is marked +; one that inhibits ends in a bar and is marked −, in a second colour. A box opens its landmark and stays where it stands in the panel, and its tooltip gives the landmark's full name. The projections are also listed as sentences for a screen reader. The boxes are not positions and the lines are not fibre paths.

The notes hold four disclosures: **Connections and scope**, **What this atlas shows**, **Clinical context** (with **Open deficit evidence**, which opens the linked deficit) and **Sources**. **What this atlas shows** belongs to an open landmark and is absent on the whole route. **Sources** labels each reference **Deficit evidence** or **Circuit background** and gives the revision date. Outside the **Circuits** tab, a region's inspector lists the tour landmarks on that region, and a row opens its tour at that landmark in the **Circuits** tab. Leaving a tour restores the scene from before it. The URL carries the state as `tab=circuits&circuit=<id>&step=<n>` (1-based) or `&route=1`. A link to an unknown or withdrawn tour or step reports those parameters as unsupported and applies the rest of the scene.

On the [Montreal Neurological Institute (MNI) template](mni-template.md) a tour is listed only if every landmark, tract and linked deficit exists there. Four have a landmark in the spinal cord, which the template lacks (corticospinal descent, the spinothalamic pathway, ventral spinocerebellar input and rubrospinal descent). These stay on CDMD sub_013, and the list's coverage line says how many. A landmark's tract is the template's averaged-atlas bundle of the same id.

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| `catalog.test.ts` CAT-53 | Revision 2026-11-26, margin 12 mm, 262 references; the 45 tours in order, each with its landmark count and deficit | passes |
| `catalog.test.ts` | The 45 tours resolve, 124 landmarks with exact source labels, on the default anatomy (CDMD) | passes |
| `catalog.test.ts` | Cerebellar output: landmark hemispheres left, left, left, right, right, right; lobule V and 10 left covering lobules where lobules are published; red nucleus covers right midbrain and ventral tegmental area | passes |
| `catalog.test.ts` CAT-52 | Zero or two resolving forms throw with count and region; landmarks 1, 3, 5, 6 restore both covering sets, 2 and 4 the other's | passes |
| `catalog.test.ts` | Corticospinal tracts `cst-left, cst-left, cst-left, null`; an unknown bundle, or an anatomy without `cst-left`, throws | passes |
| `catalog.test.ts` | Covering regions must be other structures in the landmark's atlas and hemisphere | passes |
| `catalog.test.ts` CAT-70 | The basal ganglia diagram holds its six landmarks and six signed projections; each malformed diagram throws by name | passes |
| `circuits.svelte.test.ts` CIRC-30 | The diagram numbers its landmarks, reads each projection with its sign in English and French, tells sign by end mark and colour, keeps each segment between its two boxes at 1280 and 390 px, and a box opens its landmark without moving in the panel | passes |
| `catalog.test.ts` CAT-51, CAT-54 | Each catalogue refusal; a 0.5 mm margin is accepted; unknown circuit, landmark or reference throws by name | passes |
| `catalog.test.ts` | Clinical references are declared and distinct; every active and archived tour cites supporting evidence for its deficit | passes |
| `catalog.test.ts` | 28 archived tours (210 landmarks with the active ones) resolve but cannot be opened as active circuits | passes |
| `catalog.test.ts` | On the MNI template the four tours with a spinal cord landmark are left out and the other 41 resolve; loaded as a default anatomy the template is refused | passes |
| `references.test.ts` | Active and archived circuit references name the works their identifiers resolve to | passes |
| `lesson.test.ts` | Route first; the visual route draws NextBrain with its chiasm; every whole route draws its deep landmarks; deep landmark opens focused; ungeometried landmark refused; Linked MRI opens the prepared plane | passes |

## Limitations

The tours teach anatomy described in the literature. Only the corticospinal streamlines come from this brain.

The streamlines are diffusion-MRI estimates. They stop near the caudal medulla, before the crossing, and do not isolate fibres within the broad brainstem landmarks.

Atlas labels approximate the structures. A teaching union can be broader than the structure, and a whole nucleus can stand for one territory.

Some projections are known from tracing in nonhuman primates, cats, rabbits or rodents.

Each tour's `scope` names what it omits. The visual tour, for example, omits the retina, optic nerves and optic radiations, and the memory tour is one branch, not a complete or necessary Papez circuit.

A route draws one internal anatomy at a time. The pontine motor tour's pontine nuclei are NextBrain's alone, so its whole route is drawn on the NextBrain level, which draws the teaching set's lobule V too ([internal anatomy](internal-anatomy.md)). Its pontine nuclei are not widened to the teaching set's pontine territory, 6.7 times their volume.

A deficit study supports a region–deficit association, not the pathway's connections. Clinical accuracy has not been validated.

## Code availability

Code
: [`web/src/lib/core/learning/catalog.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/learning/catalog.ts), [`web/src/lib/controller/lesson.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/controller/lesson.ts), [`web/src/lib/controller/navigation/learning.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/controller/navigation/learning.ts), [`web/src/lib/engine/framing.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/engine/framing.ts), [`web/src/features/circuits/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/features/circuits)

Configuration
: [`data/circuits.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/circuits.yaml), [`data/archived-circuit-tours.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/archived-circuit-tours.yaml)

Tests
: `web/src/lib/core/learning/*.test.ts`, `web/src/lib/controller/lesson.test.ts`, `web/src/features/circuits/*.test.ts`

```bash
npm test --prefix web -- learning lesson
npm run test:browser --prefix web -- circuits
```

