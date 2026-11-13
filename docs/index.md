# Planum methods

```{rst-class} hero-lede
How each feature of the Planum brain viewer is built, displayed and validated.
```

Planum renders one individual brain, MGH CDMD subject `sub_013`, reconstructed from its own T1-weighted scan with FreeSurfer 8.2, with tracts from the same person's diffusion scan. Cortical atlases, segmentations and group-level functional, vascular and clinical layers are registered onto this anatomy.

Each page below documents one feature in a fixed order: data, method, display, validation, limitations and code availability. Every parameter and measured value is taken from the repository's code, published files and tests. Planum is for research and education. It is not clinical anatomy.

(why-one-brain)=
## Why one brain

Who
: MGH CDMD `sub_013` ([Tian et al., 2022](reference/references.md#reference-datasets-and-tools); CC0). The dataset does not publish each participant's age or sex, so only the cohort can be stated: 26 healthy adults aged 22 to 72, 17 women and 9 men, scanned with 300 mT/m gradients.

Why this person
: Among the 33 published FreeSurfer 6 reconstructions, `sub_013` has the fewest surface defect holes (14). Its field of view reaches the cervical cord, its diffusion scan has eight shells at each of two diffusion times, and its licence is public domain. Planum reconstructed it again from the same T1 with FreeSurfer 8.2 (8 holes before repair; [internal anatomy](features/internal-anatomy.md), [tracts](features/tracts.md)).

Why not an average
: A template's sulci are an average, which blurs where people differ, and its tracts come from other people's diffusion scans. Here the surface, the cuts, the MRI and the tracts are one person's.

What it costs
: Group data must be registered onto this brain. Surface atlases arrive through `fsaverage` sphere registration ([cortical atlases](features/cortical-atlases.md)). Group volumes arrive through SynthMorph: across the two MNI templates, deep grey matter and the lateral ventricles overlap at Dice 0.80–0.92 and cortex at 0.72–0.74. A single cortical parcel looked up from template space agrees with this brain's own parcellation for about 60% of cortex; a miss lies a median 2.2 mm away (90th percentile 5.9 mm). That is why Coordinate reports each region's share of a 5 mm sphere ([published coordinates](features/published-coordinates.md)).

Limit
: One person's folding is not typical everywhere.

(methods)=
## Methods by feature

::::{container} methods-directory

:::{container}
<h3 id="stage-and-tools">Stage and tools</h3>

- [Sections and cuts](features/sections-and-cuts.md)
- [Linked MRI](features/linked-mri.md)
- [Dissection and display](features/dissection-and-display.md)
- [Lesion report](features/lesion-report.md)
- [Published coordinates](features/published-coordinates.md)
- [Overlays](features/overlays.md)
- [Sharing and snapshots](features/sharing-and-snapshots.md)
:::

:::{container}
<h3 id="anatomy">Anatomy</h3>

- [Cortical atlases](features/cortical-atlases.md)
- [Atlas comparison](features/atlas-comparison.md)
- [Internal anatomy](features/internal-anatomy.md)
- [Boundary certainty](features/boundary-certainty.md)
- [Segmentation agreement](features/segmentation-agreement.md)
- [Spinal cord](features/spinal-cord.md)
- [Tracts](features/tracts.md)
:::

:::{container}
<h3 id="functional-and-vascular-layers">Functional and vascular layers</h3>

- [Functional networks](features/functional-networks.md)
- [Functional divisions](features/functional-divisions.md)
- [Cerebellar functions](features/cerebellar-functions.md)
- [Striatal networks](features/striatal-networks.md)
- [Arterial territories](features/arterial-territories.md)
- [Receptor fingerprints](features/receptor-fingerprints.md)
:::

:::{container}
<h3 id="evidence-and-tours">Evidence and tours</h3>

- [Functions](features/functions.md)
- [Deficits](features/deficits.md)
- [Circuits](features/circuits.md)
- [Visual field map](features/visual-field-map.md)
- [Stroke cases](features/stroke-cases.md)
- [Stimulation responses](features/stimulation-responses.md)
- [Functional connectivity](features/functional-connectivity.md)
- [Disorder effects](features/disorder-effects.md)
:::

::::

Sources, citations and data licences are listed in [References](reference/references.md).

```{figure} ../.github/assets/readme/overview-light.webp
:alt: Three panels. a, the brain seen from the front in an exploded view: the two hemispheres in Destrieux colours pulled apart sideways, with the deep structures in NextBrain colours spread between them and the brainstem below. b, the left arcuate fasciculus and corticospinal tract inside a translucent cortex, coloured by direction. c, the left hemisphere with language areas painted in three blues.
:name: fig-index-1

**One subject's anatomy, with every layer registered onto it.** **a**, Exploded view, seen from the front: Destrieux hemispheres and NextBrain deep structures spread by system, each moved whole and never reshaped ([dissection and display](features/dissection-and-display.md#exploded-view)). NextBrain gives the cerebellar nuclei a surface but not the cerebellar cortex. **b**, Left arcuate fasciculus and corticospinal tract from the subject's own diffusion scan, coloured by local direction inside a see-through cortex. **c**, Neurosynth language map on HCP-MMP areas (z ≥ 3).
```

## Common basis

Subject
: MGH Connectome Diffusion Microstructure Dataset (CDMD) `sub_013`; FreeSurfer 8.2 reconstruction of its T1 ([Tian et al., 2022](reference/references.md#reference-datasets-and-tools)).

Coordinate frame
: FreeSurfer surface RAS in millimetres ($+R$ right, $+A$ anterior, $+S$ superior), centred on the conformed 256³ volume. Every coordinate, cut position and crosshair in these pages uses this frame unless MNI152 is named.

Build
: An offline Python compiler (`brain_model`) turns the reconstruction and source atlases into meshes (glTF), gzipped categorical label volumes and JSON layers under `public/models/cdmd/`. A WebGL 2 viewer on Three.js (`web/`) renders them in the browser.

Validation
: The compiler writes its measurements to `validation.json`. Each page's Validation table lists the tests that check the feature and the values they measure.

```{toctree}
:hidden:
:caption: Stage and tools

features/sections-and-cuts
features/linked-mri
features/dissection-and-display
features/lesion-report
features/published-coordinates
features/overlays
features/sharing-and-snapshots
```

```{toctree}
:hidden:
:caption: Anatomy

features/cortical-atlases
features/atlas-comparison
features/internal-anatomy
features/boundary-certainty
features/segmentation-agreement
features/spinal-cord
features/tracts
```

```{toctree}
:hidden:
:caption: Functional and vascular layers

features/functional-networks
features/functional-divisions
features/cerebellar-functions
features/striatal-networks
features/arterial-territories
features/receptor-fingerprints
```

```{toctree}
:hidden:
:caption: Evidence and tours

features/functions
features/deficits
features/circuits
features/visual-field-map
features/stroke-cases
features/stimulation-responses
features/functional-connectivity
features/disorder-effects
```

```{toctree}
:hidden:
:caption: References

reference/references
```

```{toctree}
:hidden:
:caption: Project

Open the viewer <https://planumatlas.com/>
Source on GitHub <https://github.com/JoshuaDuq/planumatlas>
```
