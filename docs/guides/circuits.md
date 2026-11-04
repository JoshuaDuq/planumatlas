# Guided circuits and pathways

The **Circuits** tab contains five anatomical pathway and loop-branch tours, with 25 landmarks. Choose a tour and a landmark, or use the arrows in the location bar to step through it.

| Tour | Anatomical subject | Main qualification |
| --- | --- | --- |
| Visual pathway | Optic chiasm, optic tract, lateral geniculate nucleus and V1 | The retinal input, optic nerves and optic radiations are omitted. |
| Hippocampal–diencephalic pathway | Hippocampal formation, fornix, mammillary bodies, mammillothalamic tract and anteroventral thalamic nucleus | A selected branch within a wider memory network. The anteromedial and anterodorsal nuclei are drawn only on cut faces; this is not a complete or uniquely necessary serial Papez circuit. |
| Basal ganglia motor loops | Selected direct and indirect motor-loop components | The stepper visits branches, not one continuous linear route. Nigral, dopamine and hyperdirect components are omitted. |
| Cerebellar output and crossing | A dentate output branch crossing past the opposite red nucleus toward the thalamus and motor cortex | Input and return pathways are omitted. The whole thalamus stands in for its cerebellar-recipient territory. Nonhuman-primate tracing, human histology and human anatomical landmarks retain their separate evidence roles. |
| Corticospinal descent and crossing | Cortical origin, brainstem descent, medullary crossing and opposite spinal cord, with this brain’s tracked left corticospinal tract on the first three landmarks | The streamlines are diffusion-MRI estimates that stop near the caudal medulla, before the crossing. Broad brainstem landmarks do not isolate the fibres. |

```{figure} ../../.github/assets/readme/circuits.webp
:alt: The memory pathway on its first landmark, the left hippocampal formation, outlined among the structures around it

The hippocampal–diencephalic pathway on its first landmark, revealed and framed with its neighbours.
```

Each landmark opens its source atlas, reveals the relevant anatomy and frames it. **Focus** or **Return to landmark** restores that framing. **Linked MRI** centres the sections on the landmark centroid; a centroid can fall outside a curved structure. Region details link back to associated landmarks. A shared URL retains the tour and landmark when its ID is still published.

A landmark can also draw one of this brain’s own tracts, alone and coloured by local streamline direction. Stretches hidden behind or inside the anatomy are drawn faint rather than left out. The streamlines go away on any landmark without a tract, and when the tour ends.

The tours teach literature-supported anatomical relationships. Apart from the corticospinal streamlines, they do not measure connectivity in this individual. No tour reconstructs axons or establishes a necessary and sufficient lesion pattern for a deficit. Their notes identify the species, anatomical approximations and omitted components relevant to interpretation. Active lessons and mappings are in [`data/circuits.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/circuits.yaml).

Every tour’s Sources panel distinguishes **Deficit evidence** from **Circuit background**. A patient lesion study can support a region–deficit association without establishing the connections of the pathway taught. Sources retain their study-specific limits. Clinical accuracy has not been validated.

## Maps

Below the tours, **Maps** holds interactive maps that are not stepped through. It has one: the visual field map.

### Visual field map

```{figure} ../../.github/assets/readme/visual-field.webp
:alt: The visual field map in the Circuits tab: a dot 4.5 degrees from fixation in the upper right of the visual field disc, its predicted V1, V2 and V3 territory in square millimetres, and the left occipital cortex lit on the brain

A dot 4.5° from fixation, upper right, radius 1.5°. The panel gives the cortex predicted to represent it; the stage lights the same patch in the left occipital lobe.
```

Move a dot across the visual field and the stage lights the cortex predicted to represent it. Click V1, V2 or V3 on the brain and the panel reads back which part of the field that point is predicted to respond to.

- **The disc** is the visual field with fixation at the centre and eccentricity on a log scale, with rings at 1°, 2°, 4°, 16° and 32° and the edge at 90°. Drag the dot, or focus it and use the arrow keys; <kbd>Shift</kbd> steps further. The dashed ring marks 8°, where the template's data end; beyond it the template extrapolates, the disc shades that annulus, and a note appears whenever the dot reaches into it. **Dot radius** runs from 0.1° to 10°.
- **Hemisphere.** A dot off the vertical meridian is represented in the opposite hemisphere, shown from the midline; a dot on it reaches both.
- **Predicted territory** is the area in mm² of V1, V2 and V3 whose predicted receptive-field centre lies inside the dot, measured on the midthickness surface, per hemisphere. If no vertex qualifies, make the dot larger. The stage draws the same dot: the core where a centre lies inside it, a dimmer reach where the receptive field comes within one σ of it, and V1, V2 and V3 in three greys.
- **Clicked cortex** gives the predicted field position and receptive-field size at a point you click, or says the point lies outside V1–V3, where the template predicts nothing.
- **Sharing.** The view travels as `map=visual-field&dot=x,y,radius`, in degrees from fixation, x to the right and y up.

The map is a prediction, not a measurement. It is the Benson template (v4.0), fitted to the group average of 181 Human Connectome Project 7T participants and applied to this brain's folding, so no retinotopy was measured in this individual, and V1's size varies about threefold between people. Its V1 agrees with the HCP-MMP V1 at a Dice of 0.90 (left) and 0.89 (right), and with Julich-Brain's at 0.68 and 0.72; V2 and V3 agree less. Sources: [Benson et al. (2018)](https://doi.org/10.1167/18.13.23) for the data and [Benson et al. (2014)](https://doi.org/10.1371/journal.pcbi.1003538) for the method. The map names the Visual pathway tour it belongs to and opens it.

## Withdrawn tours

On 31 October 2026, 31 network/function and clinical landmark tours were removed from this category. Three more—auditory, somatosensory and reward/valuation—were withheld pending anatomical rework.

On 1 November 2026, the archived voluntary gaze control tour was deleted with the oculomotor-apraxia profile it was linked to, which coloured no atlas region. The other 33 withdrawn tours remain in the [source archive](https://github.com/JoshuaDuq/planumatlas/blob/main/data/archived-circuit-tours.yaml), with bilingual descriptions and citations. The archive is not loaded by the viewer. Their associated deficit evidence and functional maps remain in the existing **Deficits** and **Functions** sections. Archived citations and atlas labels remain subject to automated checks.

A link to a withdrawn circuit ID reports unsupported circuit/step parameters and retains the other valid scene fields. It does not open a different tour under the old ID.

The [29-tour evidence audit](../reference/circuit-evidence.md) and [full-text review log](../reference/full-text-review.md) retain their historical scope; their earlier counts do not describe the current active catalogue.
