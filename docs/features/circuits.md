# Circuits

The **Circuits** tab steps through five guided pathway and loop-branch tours, 25 landmarks in all, each opening its source atlas, revealing the anatomy and framing it, with literature sources split into deficit evidence and circuit background.

:::{list-table}
:widths: 22 78
:stub-columns: 1

* - Where in the viewer
  - **Circuits** tab: **Guided circuits** (the tours) and **Maps** ([visual field map](visual-field-map.md)); the stepper in the location bar; the region inspector's associated landmarks.
* - Built by
  - Authored in [`data/circuits.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/circuits.yaml) and validated at load by [`web/src/lib/core/learning/catalog.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/learning/catalog.ts); framed by [`web/src/lib/engine/framing.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/engine/framing.ts); run by [`web/src/lib/controller/lesson.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/controller/lesson.ts)
* - Configuration
  - `data/circuits.yaml` (`context_margin_mm: 12`); withdrawn tours in [`data/archived-circuit-tours.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/archived-circuit-tours.yaml)
* - Source data
  - 23 bibliography entries (19 PubMed articles, four NCBI Bookshelf chapters); the anatomy's own atlases and, on three landmarks, its own diffusion tract ([tracts](tracts.md))
* - Checked by
  - `web/src/lib/core/learning/catalog.test.ts`, `references.test.ts`, `session.test.ts`, `web/src/lib/controller/lesson.test.ts`, `web/src/features/circuits/*.test.ts`
:::

## What it does

The Circuits tab contains five anatomical pathway and loop-branch tours, with 25 landmarks. Choose a tour and a landmark, or use the arrows in the location bar to step through it.

| Tour | Anatomical subject | Main qualification |
| --- | --- | --- |
| Visual pathway | Optic chiasm, optic tract, lateral geniculate nucleus and V1 | The retinal input, optic nerves and optic radiations are omitted. |
| Hippocampal–diencephalic pathway | Hippocampal formation, fornix, mammillary bodies, mammillothalamic tract and anteroventral thalamic nucleus | A selected branch within a wider memory network. The anteromedial and anterodorsal nuclei are drawn only on cut faces; this is not a complete or uniquely necessary serial Papez circuit. |
| Basal ganglia motor loops | Selected direct and indirect motor-loop components | The stepper visits branches, not one continuous linear route. Nigral, dopamine and hyperdirect components are omitted. |
| Cerebellar output and crossing | A dentate output branch crossing past the opposite red nucleus toward the thalamus and motor cortex | Input and return pathways are omitted. The whole thalamus stands in for its cerebellar-recipient territory. Nonhuman-primate tracing, human histology and human anatomical landmarks retain their separate evidence roles. |
| Corticospinal descent and crossing | Cortical origin, brainstem descent, medullary crossing and opposite spinal cord, with this brain's tracked left corticospinal tract on the first three landmarks | The streamlines are diffusion-MRI estimates that stop near the caudal medulla, before the crossing. Broad brainstem landmarks do not isolate the fibres. |

```{figure} ../../.github/assets/readme/circuits.webp
:alt: The memory pathway on its first landmark, the left hippocampal formation, outlined among the structures around it

The hippocampal–diencephalic pathway on its first landmark, revealed and framed with its neighbours.
```

Each landmark opens its source atlas, reveals the relevant anatomy and frames it. **Focus** or **Return to landmark** restores that framing. **Linked MRI** centres the sections on the landmark (see below). Region details link back to associated landmarks. A shared URL retains the tour and landmark when its ID is still published.

A landmark can also draw one of this brain's own tracts, alone and coloured by local streamline direction. Stretches hidden behind or inside the anatomy are drawn faint rather than left out. The streamlines go away on any landmark without a tract, and when the tour ends.

The tours teach literature-supported anatomical relationships. Apart from the corticospinal streamlines, they do not measure connectivity in this individual. No tour reconstructs axons or establishes a necessary and sufficient lesion pattern for a deficit. Their notes identify the species, anatomical approximations and omitted components relevant to interpretation.

Every tour's Sources panel distinguishes **Deficit evidence** from **Circuit background**. A patient lesion study can support a region–deficit association without establishing the connections of the pathway taught. Sources retain their study-specific limits. Clinical accuracy has not been validated.

## Data

`data/circuits.yaml` (revision `2026-10-31`) holds the shared bibliography and the tours.

| Tour id | Landmarks (step ids, regions) | Linked deficit | Deficit-evidence references |
| :--- | :--- | :--- | :--- |
| `vision` | `chiasm` (`learning:midline:optic-chiasm`), `tract` (`learning:left:optic-tract`), `lgn` (`learning:left:lateral-geniculate`), `v1` (`hcp-mmp:left:1`) | `hemianopia` | `clinical-zhang-2006` |
| `memory` | `hippocampus`, `fornix`, `mammillary`, `mammillothalamic` (all `learning:left:*`), `thalamus` (`nextbrain:left:220`, anteroventral nucleus) | `amnesia` | Zola-Morgan 1986, Aggleton 2000, Harding 2000 |
| `motor` | `cortex` (`destrieux:left:29`, precentral gyrus), `putamen`, `gpi`, `thalamus`, `gpe`, `stn` (`learning:left:*`) | `parkinsonism` | Fearnley and Lees 1991, Bhatia and Marsden 1994 |
| `cerebellar` | `cortex` (`learning:cerebellar-cortex-left`), `dentate`, `superior-peduncle`, `red-nucleus` (right), `thalamus` (right), `motor-cortex` (`hcp-mmp:right:8`) | `ataxia` | Schoch 2006 |
| `corticospinal` | `motor-cortex` (`hcp-mmp:left:8`), `midbrain` (`learning:left:midbrain`), `crossing` (`learning:caudal-medulla`), `spinal-tract` (`pam50:right:lateral-corticospinal-tract`) | `hemiparesis` | Frenkel-Toledo 2022 (`motor-weakness`) |

Counts: four, five, six, six and four landmarks (25). The cerebellar tour's route is left cerebellar cortex, left dentate, left superior peduncle, midbrain crossing past the right red nucleus, right motor thalamus, right motor cortex.

### Tour fields

Each tour has `id`, `name`, `summary`, `route`, `scope` (what is and is not in the tour) and `clinical` (the clinical sources' content and limits), all in `en` and `fr`; a `deficit` that must be a published profile of the [deficit catalogue](deficits.md); `references` (the bibliography ids it cites); `clinical_references` (the subset that is deficit evidence, which must be distinct and all cited by the tour); and `steps`.

### Landmark fields

| Field | Meaning |
| :--- | :--- |
| `id`, `region`, `source_name` | A region id of the published manifest and that region's source label. The kind must be `cortex` or `structure`; a `source_name` mismatch fails |
| `name`, `role`, `explanation`, `mapping` | Bilingual text; `mapping` says how the atlas label stands for the anatomy and where it falls short |
| `view` | One of the camera's presets: `oblique`, `left`, `right`, `anterior`, `posterior`, `superior`, `inferior`. The tours use anterior (9 landmarks), left (6), posterior (4), inferior (3), right (2) and superior (1) |
| `plane` | `axial`, `coronal` or `sagittal`: the Linked MRI plane for this landmark (13 coronal, 9 axial, 3 sagittal) |
| `tract` | One of the anatomy's own tract bundle ids, drawn whole while the landmark is open. Only the corticospinal tour sets it, `cst-left` on `motor-cortex`, `midbrain` and `crossing`; an anatomy without that bundle (for example another subject's) fails validation |
| `map` | An interactive map the landmark offers; one is set, `visual-field` on the visual tour's V1 landmark |
| `covering_regions` | Structures in the same atlas and hemisphere that this landmark hides to expose it (the cerebellar tour's dentate hides the left cerebellar cortex; the right red nucleus hides the right midbrain and VTA) |
| `alternatives` | Forms of the landmark for anatomies divided differently, each overriding the base fields: the cerebellar cortex whole, or lobule V (`learning:lobule-v-left`) in an anatomy with cerebellar lobules; the dentate's own form lists the ten left hemispheric lobules and crura it covers instead |

`resolveStep` picks exactly one form per anatomy: the form whose regions (`region` and `covering_regions`) all exist. Zero or two forms is an error that names the count and the region. A landmark's `restores` is every region some other landmark of the tour covers but this one does not, so arriving at the landmark uncovers them again; returning to the lobule V landmark restores the hidden lobules, and the vermis stays in place.

### Bibliography

`references` entries have `id`, `title`, `citation`, `url`, an identifier (a `pmid`, or an `nbk` Bookshelf accession; four are Bookshelf chapters from Purves et al., *Neuroscience*, 2nd edition), an optional `pmcid` and optional `corrections`. The loader refuses a non-HTTPS URL, a missing PMID or NBK, a malformed PMCID or correction DOI, and a correction without both language summaries. `references.test.ts` checks each identifier against the fetched record (see [deficits](deficits.md#citation-verification)): its URL form, title, first author, year, book and corrections.

## How it was built

1. **Choose a pathway, not a function.** A tour is kept only if it is a specified anatomical pathway or loop branch with landmarks that are real, labelled structures of the atlases the viewer carries. On 30 October 2026 the catalogue held 39 tours; [the classification audit](https://github.com/JoshuaDuq/planumatlas/blob/main/docs/reference/circuit-classification-audit-2026-10-30.md) recommended five as qualified pathway or loop-branch tours, moved or redesigned the others and found three needing a more specific anatomical representation. The recommendations were applied on 31 October (see Withdrawn tours).
2. **Pick landmarks from the atlases that draw them.** Each landmark names a region id (`learning:`, `nextbrain:`, `destrieux:`, `hcp-mmp:` or `pam50:`) and its source label, so the tour opens the atlas that draws that structure.
3. **Separate evidence by role.** `references` hold the anatomical background; `clinical_references` hold the patient studies that support the linked deficit. A test requires every tour to cite supporting evidence for its deficit that is already recorded as supporting in the clinical catalogue, and distinct clinical references; this verifies provenance, not the strength of the association.
4. **Write the qualifications.** `scope` states what the tour leaves out; each landmark's `mapping` states how its atlas label approximates the structure (for example, the thalamus standing for the cerebellar-recipient territory, or the putamen shown whole); species (nonhuman-primate tracing) is named where the evidence is not human.
5. **Add the tract where one exists.** The corticospinal tour's `tract: cst-left` uses the left corticospinal bundle from the subject's own diffusion data; the streamlines stop near the caudal medulla, before the crossing.
6. **Author both languages.** Every translated field must have English and French and nothing else.

## How the viewer uses it

- **Catalogue.** `createCircuitCatalog` takes the authored data, the manifest's regions, the published deficit ids and the anatomy's tract ids; it throws (naming the circuit, landmark or reference) on an unknown circuit, landmark, reference, clinical target, region, source label, view, plane, tract, map or covering region, and on a margin that is not a positive number of millimetres. A covering region must be a different structure in the landmark's atlas and hemisphere.
- **Opening a landmark.** `createLessons` (`web/src/lib/controller/lesson.ts`) first remembers the scene it found, so that leaving the tour puts it back. `openLandmark` opens the region (`commands.openRegion`), then `showCircuitLandmark` shows the regions it restores, hides its covering regions and sets the hemisphere to the landmark's side (both for a midline region), then focuses a deep landmark (`beneathCortex`) as a hidden pick would, and frames it.
- **Framing.** `camera.frameLandmark(region, view, contextMarginMm)` (`web/src/lib/engine/framing.ts`) takes the bounds of the region's meshes, expands them by the context margin, 12 mm (`context_margin_mm`), and plans a camera at the authored view's direction, with the view's up vector. If the region has no geometry `frameLandmark` returns false and the lesson throws that the landmark geometry is unavailable. **Focus** or **Return to landmark** repeats it.
- **The whole route.** The route view shows the tour at once: nothing selected, no cut, both hemispheres, the cortex see-through (`appearance.see_through_opacity`), the internal anatomy that draws the landmarks revealed, the spinal cord shown if a landmark is in it, an oblique view, and a numbered mark at each landmark's anchor in this brain.
- **Linked MRI.** `prepareCircuitMri` places the crosshair at the landmark's anchor (`model.anchorOf`: the region's own voxel nearest its centroid, so a landmark that curves round its centroid is still hit), turns the overlay on, and opens the plane the landmark names. Under a lesson, a landmark's Linked MRI opens the prepared plane ahead of the plain one.
- **Tract.** `syncLessonTract` (`web/src/lib/state/engine-sync.svelte.ts`) draws the open landmark's tract while the Circuits tab shows it, and takes it away however the lesson ends: a step without one, another tab, an excursion or a link. `showLandmarkTract` (`web/src/lib/engine/diffusion/native-viewer.ts`) isolates the bundle, uses the tract's direction colouring and draws the stretches that the anatomy in front hides at 0.3 opacity with a depth test of greater-than, so they are faint rather than left out (see [tracts](tracts.md#how-the-viewer-draws-streamlines)). A failed download is said once, and coming back to the landmark tries again.
- **Sources panel.** `CircuitNotes.svelte` lists each reference, labelled **Deficit evidence** if it is in `clinical_references` and **Circuit background** otherwise, with its published corrections.
- **State and links.** The open tour and landmark ride the session and the link; a link to an unknown circuit or step reports unsupported parameters and keeps the other scene fields.

## Checks

| Check | Where | Expected |
| :--- | :--- | :--- |
| Five tours, 23 references, revision and margin | `CAT-53` | revision `2026-10-31`, margin 12 mm, tours with 4, 5, 6, 6, 4 landmarks and their deficits |
| Landmarks resolve to the exact source labels on every published anatomy | `catalog.test.ts` | pass |
| Withdrawn tours cannot be opened as active circuits | `catalog.test.ts` | pass |
| A landmark's tract is one of the anatomy's own bundles; corticospinal draws it down to the crossing | `catalog.test.ts` | `cst-left, cst-left, cst-left, null`; an anatomy whose tracts are another subject's draws none |
| Cerebellar output crosses to the right red nucleus and thalamus after the left peduncle | `catalog.test.ts` | pass |
| Covering geometry is a different structure in the landmark's atlas and hemisphere | `catalog.test.ts` | pass |
| Zero or two resolving forms fail with the count and the region; published cerebellar landmarks restore what landmarks 2 and 4 cover, except their own | `CAT-52` | pass |
| A margin of 0.5 mm is accepted; zero or a non-number fails | `CAT-51` | pass |
| Every tour directly cites supporting evidence for its linked deficit; clinical source roles are declared and distinct | `catalog.test.ts` | pass |
| An unknown circuit, landmark or reference fails by name | `CAT-54` | pass |
| Reference identifiers resolve to the works they name; no retraction or expression of concern | `references.test.ts` | pass |
| Archived tours stay source-checkable | `catalog.test.ts` | their citations and atlas labels remain subject to automated checks, though the viewer never loads the archive |

## Limits

- The tours are literature-supported anatomical teaching, not individual connectivity. Apart from the corticospinal streamlines, nothing is measured in this brain.
- Atlas labels are approximations: a teaching union can be broader than the structure (the hippocampal formation); a nucleus can stand for a territory (the whole thalamus for the cerebellar-recipient part); some projections are described from animal tracing; the anteromedial and anterodorsal thalamic nuclei are labelled but drawn only on cut faces.
- The corticospinal streamlines are diffusion-MRI estimates, stop near the caudal medulla and do not isolate the fibres of the broad brainstem landmarks.
- A deficit study supports a region–deficit association, not the pathway's connections. Clinical accuracy has not been validated.
- The visual tour omits the retina, optic nerves and optic radiations. The motor-loop tour omits nigral output, dopamine modulation, hyperdirect and nonmotor loops. The memory tour is a selected branch, not a complete or uniquely necessary Papez circuit.

## Withdrawn tours

On 31 October 2026, 31 network/function and clinical landmark tours were removed from this category. Three more (auditory, somatosensory and reward/valuation) were withheld pending anatomical rework.

On 1 November 2026, the archived voluntary gaze control tour was deleted with the oculomotor-apraxia profile it was linked to, which coloured no atlas region. The other 33 withdrawn tours remain in the [source archive](https://github.com/JoshuaDuq/planumatlas/blob/main/data/archived-circuit-tours.yaml), with bilingual descriptions and citations. The archive is not loaded by the viewer. Their associated deficit evidence and functional maps remain in the existing **Deficits** and **Functions** sections. Archived citations and atlas labels remain subject to automated checks.

A link to a withdrawn circuit ID reports unsupported circuit/step parameters and retains the other valid scene fields. It does not open a different tour under the old ID.

The [29-tour evidence audit](../reference/circuit-evidence.md) and [full-text review log](../reference/full-text-review.md) retain their historical scope; their earlier counts do not describe the current active catalogue. The [30 October additions review](https://github.com/JoshuaDuq/planumatlas/blob/main/docs/reference/circuit-additions-2026-10-30.md) is also historical: its four tours were withdrawn on 31 October.

## Reproduce

```bash
# Tours are authored in data/circuits.yaml; the catalogue and references are checked by the web tests
npm test --prefix web

# Re-verify every cited work (writes data/reference-records.json; needs network access)
uv run python scripts/fetch_references.py

# Validate that every landmark region exists in the published anatomy
uv run python -m brain_model.validate --anatomy cdmd
```

Edits to `data/*.yaml` need a dev-server restart.

## See also

- [Tracts](tracts.md): the corticospinal bundle the tour draws.
- [Visual field map](visual-field-map.md): the map the visual tour's V1 landmark offers.
- [Deficits](deficits.md): the clinical evidence each tour links to.
- [Linked MRI](linked-mri.md): the section view each landmark opens.
- [Internal anatomy](internal-anatomy.md), [cortical atlases](cortical-atlases.md) and [spinal cord](spinal-cord.md): the atlases the landmarks come from.
- [Evidence audit](../reference/circuit-evidence.md), [full-text review](../reference/full-text-review.md), [classification audit](https://github.com/JoshuaDuq/planumatlas/blob/main/docs/reference/circuit-classification-audit-2026-10-30.md), [References and licensing](../reference/references.md).
