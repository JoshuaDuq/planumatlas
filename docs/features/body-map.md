# Body map

**Circuits** › **Maps** › **Body map** colours the central strip of both hemispheres by the movement that raises activity most there: the opposite foot, the opposite hand or the tongue (Fig. 1). The maps are the Human Connectome Project (HCP) motor task's group averages of 486 adults, carried onto each brain through the registration of its folding, so the map is a group's and not this brain's own. It is published for sub_013 of the MGH Connectome Diffusion Microstructure Dataset (CDMD) and for the Montreal Neurological Institute (MNI) template.

```{figure} figures/body-map-1-light.webp
:alt: Three panels. a, both hemispheres of CDMD from above, grey, with the central strip coloured blue for the foot beside the midline, raspberry for the hand lateral to it and green for the tongue at the lateral edges. b, the left hemisphere from its lateral side, with the foot at the top of the strip, the hand below it and the tongue lowest, above the Sylvian fissure. c, the map's panel, with the parts to choose, each part's area on the strip in each hemisphere beside its colour, and what the map leaves out.
:name: fig-body-map-1

**The foot, the hand and the tongue lie in order along the central strip, from the midline to the Sylvian fissure.** **a**, [Both hemispheres from above](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&tab=circuits&map=body-map&internal=0&colors=tissue&view=superior), as the map opens. Each vertex of the strip takes the movement whose group map is highest there, among the opposite foot, the opposite hand and the tongue, where that effect is at least medium (Cohen's d ≥ 0.5). The foot lies beside the midline, the hand lateral to it and the tongue at the lateral edges. **b**, [The left hemisphere from its lateral side](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&tab=circuits&map=body-map&internal=0&colors=tissue&view=left), which maps the right foot and hand: the foot reaches over the vertex, the hand lies below it, and the tongue lowest, above the Sylvian fissure. **c**, The map's panel. Its table is the map's key: each part's area on the strip, measured on the mid-thickness surface, is 1,350, 1,594 and 2,068 mm² in the left hemisphere and 1,250, 1,666 and 1,984 mm² in the right. CDMD `sub_013`, Destrieux atlas. Scale bars apply at the depth of the camera's target.
```

## Data

| Input | Detail |
| :--- | :--- |
| Group maps | HCP WU-Minn motor task ([Barch et al. 2013](../reference/references.md#group-data-and-templates); [Van Essen et al. 2013](../reference/references.md#group-data-and-templates)), group z maps of 486 people from [NeuroVault collection 457](https://neurovault.org/collections/457/): images 3155 (left foot), 3157 (left hand), 3159 (right foot), 3161 (right hand) and 3163 (tongue), each the movement minus the average of the movements, on FSL's MNI152 at 2 mm; each pinned by SHA-256 in `config/body-map.yaml`; HCP Open Access Data Use Terms |
| Registration | Registration fusion from MNI152 to `fsaverage` (RF-ANTs, [Wu et al. 2018](../reference/references.md#group-data-and-templates)), the mapping the function scores use |
| Strip | Each brain's own Destrieux labels `G_precentral`, `S_central`, `G_postcentral`, `G_and_S_paracentral` and `G_and_S_subcentral`, inside `?h.cortex.label` |

`scripts/fetch_body_map.py` downloads the five maps, checks them and carries each hemisphere's three candidate maps to `fsaverage` (`data/fsaverage/surf/?h.tfMRI_MOTOR_*-AVG_zstat1.mgz`, pinned in `data/sources.json`), so a build reads no file from outside the repository.

| Published | Content |
| :--- | :--- |
| `body-map-<atlas>.field` | One byte per vertex of `cortex-<atlas>.glb`, region by region in the manifest's region order, each region's in its mesh's vertex order: 0 none, 1 foot, 2 hand, 3 tongue. CDMD: Destrieux 358,511 bytes, HCP-MMP 447,870, Julich-Brain 422,464, Schaefer 434,569, Desikan-Killiany 296,804; the template 337,167 to 507,207 |
| `manifest.json` › `body_map` | The files, the parts and their codes, the floor, each hemisphere's areas and off-strip shares, and the validation below |

## Method

`brain_model/layers/body_map.py` reads each map at every `fsaverage` vertex's MNI152 coordinate, linearly interpolated, and gives each vertex of the brain the values of its nearest `fsaverage` vertex on the registered spheres. On the strip, a vertex takes the movement whose z is largest among the opposite foot, the opposite hand and the tongue, where that z reaches 11.02, a medium effect (Cohen's d 0.5) over 486 people; every other vertex is 0. A vertex that the parcel borders add takes the part that carries the most weight among the source vertices it is made from, and 0 on a tie. Areas are measured on the mid-thickness surface.

In the viewer the shown atlas's file downloads when the map first opens, under 10 kB compressed for one atlas, and again for another atlas chosen while it is open. Each mesh reads its bytes from a small texture by vertex index (`gl_VertexID`), as cortical thickness does, so the map adds no vertex attribute to the cortex.

## Display

The cortex is grey, and the strip takes the parts' colours: blue for the foot, raspberry for the hand and green for the tongue, the first three of the deficits' finding colours. The panel offers every part or one alone, and its table, which is also the map's key, gives each part's area on the strip in each hemisphere. The map opens from above on both hemispheres, uncut and opaque, with the internal anatomy hidden, nothing selected and **Colour** set to **Tissue**; leaving it restores the earlier view, colour included. The URL parameter is `map=body-map`.

## Validation

A first gate, set before any map was downloaded, held the whole maps to the bar that an earlier attempt with Individual Brain Charting maps had failed: at least half of each map's area above z 3.1 on the strip. Side, peak position and order passed on both brains, and the share failed. With 486 people, z 3.1 is a very small effect, and each map covered 25,000 to 43,000 mm² of cortex. Even at z 10, only 24 to 33% of the foot's map lay on the strip, because moving the foot also engages the supplementary motor area, the cingulate cortex and the parietal lobe. A second gate, set before the strip map was computed, tests the map drawn here, and the build refuses a brain that fails it (`body_map.measure`).

| Criterion | Bar | CDMD left / right | Template left / right |
| :--- | :--- | :--- | :--- |
| Order: median height foot > hand > tongue; median distance from the midline the reverse | ordered | 71.7 > 64.5 > 47.8 mm / 71.3 > 57.4 > 37.6 mm | 48.7 > 36.0 > 10.8 mm / 50.4 > 35.5 > 9.2 mm |
| Contiguity: each part's largest connected piece, as a share of its area | ≥ 0.80 | 0.97–1.00 / 0.99–1.00 | 0.97–1.00 / 0.99–1.00 |
| Landmarks: the paracentral lobule won by the foot, the subcentral region by the tongue | largest share | 100%, 91% / 100%, 95% | 100%, 93% / 100%, 97% |
| Size: each part's area | ≥ 100 mm² | 1,350–2,068 mm² / 1,250–1,984 mm² | 1,627–2,395 mm² / 1,474–2,236 mm² |

About 80% of each strip is assigned. The rest lies between the parts, where the trunk, the arm and the face would be; the task tests none of them.

## Limitations

The map is a group average of 486 other adults, carried onto each brain through the registration of its folding: it is not what this brain does, and the variation of the strip between people is averaged out. Only the central strip is drawn. At the floor, 64 to 74% of the foot's map lies off the strip, 11 to 19% of the hand's and 23 to 26% of the tongue's, and the panel says so. At the group maps' 2 mm resolution the motor and sensory banks of the central sulcus are not told apart, and 40 to 48% of each hand patch lies on the postcentral gyrus. Five movements were tested, so the trunk, single fingers and the face beyond the tongue are not mapped. The map is drawn on the cortical surface only: a cut shows tissue on its faces.

## Code availability

Code
: [`brain_model/layers/body_map.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/body_map.py), [`scripts/fetch_body_map.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/fetch_body_map.py), [`web/src/lib/engine/model/body-map.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/engine/model/body-map.ts), [`web/src/features/circuits/BodyMap.svelte`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/features/circuits/BodyMap.svelte)

Configuration
: [`config/body-map.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/body-map.yaml); `body_map` in an anatomy's `layers` in [`config/model.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/model.yaml)

Tests
: `tests/test_body_map.py`, `web/src/lib/core/learning/body-map.test.ts`, `web/src/lib/engine/model/body-map.test.ts`, `web/src/lib/engine/render/body-map.svelte.test.ts`, `web/src/lib/state/body-map.svelte.test.ts`, `web/src/lib/controller/lesson.test.ts`, `web/src/features/circuits/BodyMap.svelte.test.ts`

```bash
uv run python scripts/fetch_body_map.py
uv run python -m brain_model.build --anatomy cdmd --only body_map
uv run pytest tests/test_body_map.py
npm test --prefix web -- body-map
```
