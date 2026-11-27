# Planum methods

```{rst-class} hero-lede
How each feature of the Planum brain viewer is built, displayed and validated.
```

Planum is an atlas of the human brain in which cortical and deep parcellations, tractography and the published findings for each region are read on the same anatomy. That anatomy is one individual, MGH CDMD subject `sub_013`, reconstructed from its own T1-weighted scan with FreeSurfer 8.2, with tracts from the same person's diffusion scan. The MNI template can be chosen instead.

Each page below documents one feature in a fixed order: data, method, display, validation, limitations and code availability. Every parameter and measured value is taken from the repository's code, published files and tests. Planum is for research and education. It is not clinical anatomy.

```{figure} ../.github/assets/readme/overview-light.webp
:alt: Three panels. a, the brain seen from the front in an exploded view, the two hemispheres in Destrieux colours pulled apart sideways, with the deep structures in NextBrain colours parted between them, the corpus callosum on the midline, and the brainstem, cerebellum and cervical cord below. b, the left arcuate fasciculus and corticospinal tract inside a translucent cortex, coloured by direction. c, the left hemisphere with language areas painted in three blues, and a key of the three z bands under it.
:name: fig-index-1

**Every layer is registered onto one subject's anatomy.** **a**, [Exploded view](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=nextbrain&view=anterior&explode=1) of CDMD `sub_013`, seen from the front. The hemispheres carry Destrieux colours. NextBrain's deep structures part between them, most of each side as one piece. Every structure is moved whole, never reshaped or taken apart ([dissection and display](features/dissection-and-display.md#exploded-view)). The cerebellar lobules, corpus callosum and ventricles are the teaching set's, drawn on this level. **b**, [Left arcuate fasciculus and corticospinal tract](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&tab=diffusion&view=left&opacity=0.16&tracts=af-left,cst-left) from the subject's own diffusion scan, seen from the left inside a cortex at 16% opacity. Streamlines are coloured by local direction (red left–right, green anterior–posterior, blue superior–inferior). **c**, [Neurosynth map for language](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=hcp-mmp&detail=learning&view=left&tab=functions&function=language) on HCP-MMP areas, seen from the left. Areas are painted where the mean z is at least 3, in the three bands of the key. Scale bars apply at the depth of the camera's target.
```

(why-one-brain)=
## Why one brain

Who
: One of the 26 healthy adults of the MGH CDMD dataset ([Tian et al., 2022](reference/references.md#reference-datasets-and-tools); CC0), aged 22 to 72 (17 women, 9 men) and scanned with 300 mT/m gradients. The dataset does not give each participant's age or sex.

Why this person
: Of the dataset's 33 FreeSurfer 6 reconstructions (26 participants and seven rescans), this one has the fewest surface defect holes (14). The field of view reaches the cervical cord, the diffusion scan has eight shells at each of two diffusion times, and the data are in the public domain. Planum reconstructed it again from the same T1 with FreeSurfer 8.2 (8 holes before repair; [internal anatomy](features/internal-anatomy.md), [tracts](features/tracts.md)).

Why not an average
: A template's sulci are an average, which blurs where people differ, and its tracts come from other people's diffusion scans. In Planum the surface, cuts, MRI and tracts all come from one person (Fig. 1).

What it costs
: Group data must be registered onto this brain. Surface atlases arrive through `fsaverage` sphere registration ([cortical atlases](features/cortical-atlases.md)). Group volumes arrive through SynthMorph: across the two MNI templates, deep grey matter and the lateral ventricles overlap at Dice 0.80–0.92 and cortex at 0.72–0.74. A single cortical parcel looked up from template space agrees with this brain's own parcellation for about 60% of cortex; a miss lies a median 2.2 mm away (90th percentile 5.9 mm). Coordinate therefore reports each region's share of a 5 mm sphere ([published coordinates](features/published-coordinates.md)). Fine structures land a median 1.2 mm from this brain's own and overlap poorly below about 100 mm³, so a structure that small takes no shares from a registered map ([registration landing](features/registration-landing.md)).

The template
: The MNI template (ICBM 152 2009c, at 0.9 of its size) can be chosen as the brain instead. Coordinates and maps in its space are then placed with no registration, and its tracts are an averaged atlas's. Its folds are smoothed, and it has no spinal cord ([MNI template](features/mni-template.md)).

Limit
: One person's folding is not typical everywhere, and one brain does not show how much people differ.

(how-accurate)=
## How accurate it is

Each figure is measured on CDMD `sub_013`, except where the template is named, and comes from the validation of the page named beside it.

| What you read | What was measured | Page |
| :--- | :--- | :--- |
| A structure's drawn surface | Within 0.6 mm of its source labels; no voxel centre misclassified | [Internal anatomy](features/internal-anatomy.md) |
| HCP-MMP, Julich-Brain and Schaefer areas | Carried from `fsaverage` through registered spheres and re-derived byte for byte at each validation; Destrieux and Desikan-Killiany are the subject's own | [Cortical atlases](features/cortical-atlases.md) |
| A deep structure's outline | NextBrain and FreeSurfer's aseg agree at Dice 0.77–0.89 on the 0.4 mm grid | [Segmentation agreement](features/segmentation-agreement.md) |
| A coordinate from an MNI template | Deep grey matter and the lateral ventricles overlap at Dice 0.80–0.92 and cortex at 0.72–0.74 across the two templates; a point carried there and back returns within 0.06 mm (median) | [Published coordinates](features/published-coordinates.md) |
| A structure carried from the template | Its centre lands a median 1.2 mm from this brain's own (90th percentile 2.9 mm); a structure under 100 mm³ takes no values from registered maps | [Registration landing](features/registration-landing.md) |
| A cortical parcel looked up from template space | Agrees with this brain's own parcellation for about 60% of cortex, a miss lying a median 2.2 mm away, so Coordinate reports shares of a 5 mm sphere | [Published coordinates](features/published-coordinates.md) |
| Tracts | 95.1% of the streamline length of the subject's 17 RecoBundles bundles lies in its own white matter; 93.4% for the averaged atlas's 23 bundles on the template | [Tracts](features/tracts.md) |

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
- [Registration landing](features/registration-landing.md)
- [MNI template](features/mni-template.md)
- [Spinal cord](features/spinal-cord.md)
- [Arousal nuclei](features/arousal-nuclei.md)
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
- [Cortical layers](features/cortical-layers.md)
- [Cortical thickness](features/cortical-thickness.md)
- [Sulcal depth](features/sulcal-depth.md)
- [Body map](features/body-map.md)
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

## Common basis

Subject
: MGH Connectome Diffusion Microstructure Dataset (CDMD) `sub_013`; FreeSurfer 8.2 reconstruction of its T1 ([Tian et al., 2022](reference/references.md#reference-datasets-and-tools)).

Template
: MNI152NLin2009cAsym at 0.9 of its size, reconstructed and segmented as CDMD is ([MNI template](features/mni-template.md)). Pages describe CDMD unless they name the template.

Coordinate frame
: FreeSurfer surface RAS in millimetres ($+R$ right, $+A$ anterior, $+S$ superior), centred on the conformed 256³ volume. Every coordinate, cut position and crosshair in these pages uses this frame unless MNI152 is named.

Build
: An offline Python compiler (`brain_model`) turns the reconstruction and source atlases into meshes (glTF), gzipped categorical label volumes and JSON layers under `public/models/<anatomy>/` (`cdmd`, `mni152`). A WebGL 2 viewer on Three.js (`web/`) renders them in the browser.

Validation
: The compiler writes its measurements to `validation.json`. Each page's Validation table lists the tests that check the feature and the values they measure.

(code-availability)=
## Code availability

The viewer, the compiler, the published assets and these pages are in one repository, [JoshuaDuq/planumatlas](https://github.com/JoshuaDuq/planumatlas). The code is under the GNU AGPL 3.0 or later, and the data keep the terms of their origin ([References](reference/references.md#licences)). Each methods page ends with the code, configuration, tests and commands of its feature.

The pages are built by Sphinx from `docs/`, and any warning stops the build.

```bash
uv sync --locked --group docs
uv run sphinx-build -W -b html -d docs/_build/doctrees docs docs/_build/html
```

Every figure of these pages and of the README is regenerated by one script, [`scripts/figures.mjs`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/figures.mjs), from the figure definitions in [`scripts/figure-definitions.mjs`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/figure-definitions.mjs).

```bash
npm ci --prefix web
npx --prefix web playwright install chromium
npm run dev --prefix web          # in a second terminal: the viewer at http://127.0.0.1:5173/
node scripts/figures.mjs          # every figure; name figures to render only those
node scripts/figures.mjs --links  # each legend's live-view links against the captured states
```

Each anatomical panel is a capture of the viewer in headless Chromium: the stage, a plane of Linked MRI, a panel of the interface or a saved image. Captures are cropped and composed and are never recoloured. The script draws the panel letters, the scale bars, which it takes from the viewer's own, and the colour keys, which it reads from the stage's. A legend's link to a live view is the state the script captured, and the script stops if the viewer rewrites a state. Plots are drawn by [`scripts/figure_plots.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/figure_plots.py) from the published files alone, with Matplotlib 3.11.2 run through uv, and series colours come from the colour-blind-safe palette of Wong (2011; *Nature Methods* 8, 441, [doi:10.1038/nmeth.1618](https://doi.org/10.1038/nmeth.1618), PMID 21774112). Passing `https://planumatlas.com/` as the first argument renders from the live site instead of the working tree.

Figures follow Nature's specifications for research figures where they apply to a web page: 2,400 px for the 183 mm double-column width, lowercase bold panel letters at 8 pt, other text at 7 pt, scale bars and no magnifications. They depart from them in four ways. The typeface is Source Sans 3, the face of these pages' captions, not Helvetica or Arial. Figures are WebP rasters, not vector files. Each figure comes in a light and a dark version, with a transparent ground, to follow the theme. Panels of the interface keep the viewer's own type sizes, drawn at 1.9 figure pixels per CSS pixel.

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
features/registration-landing
features/mni-template
features/spinal-cord
features/arousal-nuclei
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
features/cortical-layers
features/cortical-thickness
features/sulcal-depth
features/body-map
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
