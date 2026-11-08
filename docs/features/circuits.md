# Circuits

The **Circuits** tab steps through five anatomical pathway and loop-branch tours, 25 landmarks in all. Each landmark is a labelled region of this brain's atlases; opening it loads that atlas, uncovers the region and frames it from an authored view with 12 mm of surrounding anatomy. Every tour cites circuit background separately from the patient studies behind its linked deficit. Apart from the corticospinal streamlines, the tours teach literature-described connections and measure nothing in this individual.

```{figure} figures/circuits-1.webp
:alt: Three panels of coloured cerebellar and brainstem structures on a dark background. a, the left cerebellar hemisphere from behind with its lobules in different colours and lobule V outlined in white. b, the same view with the left hemispheric lobules removed, exposing the dentate nucleus outlined in white beside the brainstem. c, the right brainstem and thalamus seen from the midline, with the small red nucleus outlined in white below the thalamus.
:name: fig-circuits-1

**Three landmarks of the cerebellar output tour, each framed with its neighbours.** **a**, Landmark 1, left lobule V (outlined), posterior view. This anatomy publishes cerebellar lobules, so the landmark resolves to its lobule V form. **b**, Landmark 2, left dentate nucleus, same view. Its ten covering regions, the left hemispheric lobules and crura, are hidden. **c**, Landmark 4, right red nucleus, seen from the left (the midline face of the right hemisphere). The right midbrain territory and ventral tegmental area are hidden. Returning to landmark 1 shows both sets again. Subject CDMD sub_013; teaching-set internal anatomy; each landmark's side shown alone; region bounds plus 12 mm, filling 80% of the view.
```

## Data

[`data/circuits.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/circuits.yaml), revision 2026-10-31, holds the tours, a 23-entry bibliography and the framing margin, `context_margin_mm: 12`.

| Tour | Landmarks (region on CDMD) | Linked deficit | Deficit evidence |
| :--- | :--- | :--- | :--- |
| `vision` | optic chiasm (midline), optic tract, lateral geniculate nucleus (`learning:`), V1 (`hcp-mmp:left:1`); left | `hemianopia` | Zhang et al. 2006 |
| `memory` | hippocampal formation, fornix, mammillary nuclei, mammillothalamic tract (`learning:`), anteroventral thalamic nucleus (`nextbrain:left:220`); left | `amnesia` | Zola-Morgan et al. 1986; Aggleton et al. 2000; Harding et al. 2000 |
| `motor` | precentral gyrus (`destrieux:left:29`), putamen, internal pallidum, thalamus, external pallidum, subthalamic nucleus (`learning:`); left | `parkinsonism` | Fearnley & Lees 1991; Bhatia & Marsden 1994 |
| `cerebellar` | lobule V, dentate nucleus, superior cerebellar peduncle (left); red nucleus, thalamus (right, `learning:`); area 4 (`hcp-mmp:right:8`) | `ataxia` | Schoch et al. 2006 |
| `corticospinal` | area 4 (`hcp-mmp:left:8`), midbrain territory (left), caudal medulla (midline) (`learning:`), lateral corticospinal tract (`pam50:right:…`) | `hemiparesis` | Frenkel-Toledo et al. 2022 |

The bibliography has 19 PubMed articles (10 with a PMC full text) and 4 chapters of Purves et al., *Neuroscience*, 2nd edition (NCBI Bookshelf). The corticospinal tour's first three landmarks draw `cst-left`, the left corticospinal bundle tracked in this subject's diffusion MRI ([tracts](tracts.md)). Withdrawn tours are kept, with their 86 references, in [`data/archived-circuit-tours.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/archived-circuit-tours.yaml) (33 tours, 100 landmarks; `hearing`, `touch` and `valuation` withheld pending anatomical rework). The viewer does not load the archive.

## Method

### Tour content
A tour is a specified anatomical pathway or loop branch whose stops are labelled regions of the atlases the viewer carries. Each tour states its `route`, its `scope` (what is omitted) and its `clinical` text (what the patient sources show and do not show), in English and French. Each landmark states its `role`, `explanation` and `mapping`; the mapping says how the atlas label approximates the structure. For example, the whole thalamus stands for its cerebellar-recipient territory, the anteroventral nucleus is drawn while the anteromedial and anterodorsal nuclei appear only on cut faces, and projections known from monkey tracing are labelled as such. `references` lists every cited work, and `clinical_references` marks the subset that is deficit evidence. The remainder is circuit background.

### Landmark fields
Each landmark names a `region` id and its exact `source_name`, a camera `view` and a Linked MRI `plane`. Optional fields are `covering_regions` (structures hidden to expose it), `tract` (one of the anatomy's bundles, drawn whole), `map` (`visual-field`, offered at V1; [visual field map](visual-field-map.md)) and `alternatives`. Views across the 25 landmarks: anterior 9, left 6, posterior 4, inferior 3, right 2, superior 1. Planes: coronal 13, axial 9, sagittal 3.

### Resolution on an anatomy
A landmark with `alternatives` has one form per way an anatomy can be divided; each alternative overrides the base fields. Exactly one form must have its `region` and all `covering_regions` present in the manifest; zero or two throw with the count and region. On CDMD the cerebellar cortex landmark resolves to lobule V (`learning:lobule-v-left`), and the dentate to its form covering ten left lobules and crura (Fig. 1a, b). A landmark's `restores` is every region another landmark of the tour covers but it does not, so arriving at it uncovers what earlier steps hid.

### Catalogue validation
`createCircuitCatalog` throws, naming the record, on: an empty or non-positive margin; a duplicate id; a non-HTTPS reference URL; a reference with neither a numeric PMID nor an `NBK` accession; a malformed PMCID or correction DOI; a translation missing in `en` or `fr` or with another key; an unknown deficit; a tour with no references; `clinical_references` empty, repeated or not among the tour's references; an unknown region, covering region, view, plane, tract bundle or map; a source label that differs from the region's; a landmark that is not `cortex` or `structure`; a covering region that is not a different structure in the landmark's atlas and hemisphere. A separate test requires each tour's deficit evidence to include a PMID that the [deficit catalogue](deficits.md#method) records as supporting evidence for that deficit. Every identifier is checked against its fetched PubMed or Bookshelf record (URL form, PMCID, title, first author, year, book, corrections) as described under [deficits](deficits.md#method).

### Framing
`frameLandmark` takes the bounding box of the landmark's meshes and expands it by `context_margin_mm` (12 mm) on every side. If the box's bounding sphere is still under 50 mm in radius, the box is grown evenly until it reaches 50 mm. The camera is placed along the authored view direction with that view's up vector, and the box fills 80% of the view (`FRAME_FILL`). A region with no drawn geometry is refused rather than framed.

## Display
A tour opens on its whole route. Nothing is selected, the cut is off, both hemispheres are shown and the cortex is see-through (0.15). The internal anatomy holding the deep landmarks is revealed, the spinal cord is shown if a landmark lies in it, the view is oblique, and a numbered mark sits at each landmark's anchor. **Next** and **Previous** in the location bar, or a row of the landmark list, open a landmark. Opening a landmark loads its atlas and layer and selects it. It shows the regions the landmark restores, hides its covering regions and shows only its hemisphere (both for a midline region). Focus is turned on for a forebrain structure under the cortex, and the landmark is framed (Fig. 1). **Focus** or **Return to landmark** repeats the framing. On a landmark with a `tract`, its bundle is drawn alone; the stretches that anatomy in front hides are drawn at 0.3 opacity with a greater-than depth test. The bundle is removed on any step without one, on the route, and when the tab or tour is left ([tracts](tracts.md)). **Linked MRI** places the crosshair at the landmark's anchor (its own voxel nearest its centroid), turns the overlay on and opens the authored plane ([linked MRI](linked-mri.md)).

The notes hold four disclosures: **Connections and scope**, **What this atlas shows**, **Clinical context** (with **Open deficit evidence**, which opens the linked deficit) and **Sources**. Sources labels each reference **Deficit evidence** or **Circuit background** and gives the revision date. Outside the Circuits tab, a region's inspector lists the landmarks on it and opens the tour there. Leaving a tour restores the scene from before it. URL state: `tab=circuits&circuit=<id>&step=<n>` (1-based) or `&route=1`. A link to an unknown or withdrawn tour or step reports those parameters as unsupported and applies the rest of the scene.

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| `catalog.test.ts` CAT-53 | Revision 2026-10-31, margin 12 mm, 23 references; tours `vision` 4, `memory` 5, `motor` 6, `cerebellar` 6, `corticospinal` 4 landmarks with their deficits | passes |
| `catalog.test.ts` | Only the five tours resolve, 25 landmarks with exact source labels, on every published anatomy | passes |
| `catalog.test.ts` | Cerebellar output: left, left, left, right, right, right; lobule V and 10 left covering lobules where lobules are published; red nucleus covers right midbrain and VTA | passes |
| `catalog.test.ts` CAT-52 | Zero or two resolving forms throw with count and region; landmarks 1, 3, 5, 6 restore both covering sets, 2 and 4 the other's | passes |
| `catalog.test.ts` | Corticospinal tracts `cst-left, cst-left, cst-left, null`; an unknown bundle, or an anatomy without `cst-left`, throws | passes |
| `catalog.test.ts` | Covering regions must be other structures in the landmark's atlas and hemisphere | passes |
| `catalog.test.ts` CAT-51, CAT-54 | Each catalogue refusal; a 0.5 mm margin is accepted; unknown circuit, landmark or reference throws by name | passes |
| `catalog.test.ts` | Clinical references are declared and distinct; every active and archived tour cites supporting evidence for its deficit | passes |
| `catalog.test.ts` | 33 archived tours (125 landmarks with the active ones) resolve but cannot be opened as active circuits | passes |
| `references.test.ts` | Active and archived circuit references name the works their identifiers resolve to | passes |
| `lesson.test.ts` | Route first; deep landmark opens focused; ungeometried landmark refused; Linked MRI opens the prepared plane | passes |

## Limitations
- The tours teach anatomy described in the literature; only the corticospinal streamlines come from this brain.
- The streamlines are diffusion-MRI estimates. They stop near the caudal medulla, before the crossing, and do not isolate fibres within the broad brainstem landmarks.
- Atlas labels approximate the structures: a teaching union can be broader than the structure, and a whole nucleus can stand for one territory.
- Some projections are known from nonhuman-primate tracing.
- The visual tour omits the retina, optic nerves and optic radiations. The motor-loop tour omits nigral output, dopamine, hyperdirect and nonmotor loops. The memory tour is one branch, not a complete or necessary Papez circuit. The cerebellar tour omits inputs and return pathways.
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
