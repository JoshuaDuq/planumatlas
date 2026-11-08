# Planum methods

```{rst-class} hero-lede
How each feature of the Planum brain viewer is built, displayed and validated.
```

Planum renders one individual brain, MGH CDMD subject `sub_013`, reconstructed from its own T1-weighted scan with FreeSurfer 8.2, with tracts from the same person's diffusion scan. Cortical atlases, segmentations and group-level functional, vascular and clinical layers are registered onto this anatomy.

Each page below documents one feature in a fixed order: data, method, display, validation, limitations and code availability. Every parameter and measured value is taken from the repository's code, published files and tests. Planum is for research and education. It is not clinical anatomy.

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
:::

::::

Sources, citations and data licences are listed in [References](reference/references.md).

```{figure} ../.github/assets/readme/tracts.webp
:alt: Direction-coloured diffusion tract bundles inside a see-through cortex, with orientation, direction key and scale
:name: fig-index-1

**One subject's anatomy, with every layer registered onto it.** Tracts reconstructed from the subject's own diffusion scan, shown inside a see-through cortex.
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
