# Functions and deficits

The **Functions** and **Deficits** tabs colour related regions and show a key. Select a profile for its evidence and region list; **Restore previous view** returns to the view before opening a profile. Choosing a colour in the masthead replaces the profile colours.

## Functions

The 70 curated functions are based on Neurosynth terms. **All functions** displays eleven assessment functions together; opening one shows its study count, regions with mean z ≥ 3 and any lesion associations used to check the map. Individual maps use a blue scale for z 3–5, 5–10 and ≥ 10. Deep structures can be exposed with **See through the cortex**. They are scored on FreeSurfer's whole structures and drawn on the teaching set, or on FreeSurfer aseg when that is the internal anatomy shown; NextBrain's finer nuclei are not scored, so opening a function switches NextBrain to the teaching set.

```{figure} ../../.github/assets/readme/functions.webp
:alt: The Neurosynth map for language on HCP-MMP areas, strongest in left inferior frontal and superior temporal cortex, with its ranked area list

**Language**: 96 HCP-MMP areas at z ≥ 3, from 1,101 studies, strongest first.
```

A map describes where studies using a term consistently report activation in healthy groups. It does not show that a region serves only that function, measure function in this subject, or predict the effect of a lesion. The overview combines several term maps. See [the method and limitations](../concepts/atlases.md#neuropsychological-functions).

Search also offers selected Neurosynth terms and clinical groups. These maps use the same method but have not been checked against their names or lesion studies. A clinical-group map shows reported activation in studies of that group, not where damage causes the condition. The offered terms are in [`config/neurosynth-terms.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/neurosynth-terms.yaml).

## Deficits

The 121 profiles describe acquired adult deficits and selected associations with brain regions. Search by name, synonym or function. A profile identifies the evidence, population and limitations for each finding, and links to its regions and relevant function maps. Regions are coloured by finding; the key indicates findings that cannot be coloured in the current view.

```{figure} ../../.github/assets/readme/deficits.webp
:alt: Hemispatial neglect on the right hemisphere, each finding in its own colour, with the associations and evidence in the panel

**Hemispatial neglect** on the right hemisphere: one colour per finding, each with its regions and evidence.
```

When the consulted sources identify only a broad anatomical location, a finding may have no specific atlas parcel selected. Its mapping note explains the limit; the publications remain available. Every profile has at least one finding that colours a region, and the catalogue check refuses one that does not. A map showing both hemispheres can represent separate unilateral cases; the mapping note distinguishes this from bilateral injury.

The literature is selected, not a systematic review. A single case cannot establish that the same lesion pattern is required in everyone. Network studies may identify connected regions that were not directly injured. Group-level associations mapped onto a reference anatomy do not predict an individual patient's deficit. Content and citations are in [`data/neuropsychology.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/neuropsychology.yaml).

The [31 October additions review](../reference/deficit-additions-2026-10-31.md) documents ten profiles added in two passes, including timing, gesture recognition, sustained attention and astasia.

The [1 November additions review](../reference/deficit-additions-2026-11-01.md) documents two passes covering visual verticality, source memory, micrographia, hypersomnia and two distinct eye-movement deficits. It retains negative findings and task-specific results, and leaves insufficiently resolved anatomy and normative-connectivity findings uncoloured.

The [further 1 November review](../reference/deficit-additions-2026-11-01-reading-perception-mood.md) adds phonological reading and depressive symptoms. It distinguishes corrected lesion results from disconnection findings and failed replication, and records an excluded retracted source.

The [actions and motion review](../reference/deficit-additions-2026-11-01-actions-and-motion.md) adds surface alexia, personal neglect and auditory-motion perception. It keeps regularization errors distinct from general reading accuracy and separates cortical landmarks from exploratory network or anatomically unresolved findings.

The [eye-movement review](../reference/deficit-additions-2026-11-01-eye-movements.md) adds horizontal and vertical gaze palsies and gaze-evoked nystagmus. It distinguishes gaze range from gaze holding, with broad brainstem landmarks and explicit limits on unresolved tract, nuclear and cerebellar anatomy.

The [visual recognition and awareness review](../reference/deficit-additions-2026-11-01-visual-awareness.md) adds language self-appraisal and mirror-image discrimination. It distinguishes overlapping tasks, differing awareness measures and selective case findings, with explicit extraction scopes and mapping limits.

The [facial movement, cough and bladder review](../reference/deficit-additions-2026-11-01-facial-cough-bladder.md) adds emotional facial paresis and post-stroke urinary retention. It distinguishes motor dissociations and competing bladder mechanisms, retaining broad brainstem landmarks only for the selected direct lesion findings.

On 1 November 2026, the 26 profiles whose findings coloured no atlas region were removed rather than given unsupported locations: autotopagnosia, oculomotor apraxia, and 24 profiles from the reviews above, including all five from the [reading, writing and remote-memory review](../reference/deficit-additions-2026-11-01-reading-writing-memory.md). Each review page lists its removed profiles; their evidence review remains there as a historical record. Their 60 references cited by no remaining finding were dropped from the catalogue and the citation cache.

The [memory, fluency, fear learning and moral judgement review](../reference/deficit-additions-2026-11-01-memory-fluency-moral.md) adds material-specific memory, semantic memory, verbal fluency, fear conditioning and moral judgement. It keeps registry overlap, semantic-dementia comparisons and response-dependent conditioning results explicit, and colours only the reviewed landmarks.

The [reward learning, reasoning, multitasking, grasping and vertigo review](../reference/deficit-additions-2026-11-01-reward-reasoning-vertigo.md) adds reversal learning, fluid intelligence, multitasking, pathological grasping and vertigo from cerebellar stroke. It records a published correction, keeps uncorrected and white-matter results out of the paint, and notes where two series disagree on the critical structure.

The [line orientation, grammar, medullary sensory loss and smoking review](../reference/deficit-additions-2026-11-01-orientation-grammar-medulla-smoking.md) adds line-orientation judgement, agrammatism and paragrammatism, crossed sensory loss and disrupted smoking addiction. It flags consortium and registry overlap and keeps a null prospective study beside the positive smoking findings.

The [cardiac autonomic dysfunction, hiccups and motor adaptation review](../reference/deficit-additions-2026-11-01-cardiac-hiccups-adaptation.md) adds cardiac changes after insular stroke, persistent hiccups and impaired motor adaptation. It keeps conflicting left and right cardiac findings apart and records four topics screened but not imported.

The [sign language aphasia, post-stroke cognitive impairment and restless legs review](../reference/deficit-additions-2026-11-01-sign-cognition-restless-legs.md) adds these three profiles. It records a published correction to the pooled cognitive study and explains why two contradictory fairness studies were not imported.

The [transient global amnesia, pure sensory stroke and ataxic hemiparesis review](../reference/deficit-additions-2026-11-01-amnesia-sensory-ataxic.md) adds these three profiles. It treats transient hippocampal lesions as markers rather than causes and states where the commonest lesion site has no atlas parcel.

The [supplementary motor area, recognition memory and action naming review](../reference/deficit-additions-2026-11-01-sma-recognition-verbs.md) adds supplementary motor area syndrome, recollection and familiarity deficits, and impaired action naming. It keeps the dispute over recollection and familiarity explicit with the opposing study as qualifying evidence.

The [praxis review](../reference/deficit-additions-2026-11-02-praxis.md) adds pantomime, real tool use and deep lesions to limb apraxia, and a callosal apraxia profile. It keeps the competing frontal and parietotemporal pantomime findings apart and leaves the deep-lesion finding uncoloured because its white matter has no parcel.
