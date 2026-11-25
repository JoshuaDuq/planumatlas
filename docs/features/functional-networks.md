# Functional networks

The cortex can be coloured by two published partitions into group resting-state networks. Yeo's seven networks are carried per vertex from the Schaefer 2018 400-parcel annotation, so they cross the borders of every cortical atlas. The twelve networks of the Cole-Anticevic Brain-wide Network Partition (CAB-NP) are carried per area of HCP-MMP1.0 (Human Connectome Project multi-modal parcellation), so their borders are HCP-MMP's. Both reach this brain, sub_013 of the MGH Connectome Diffusion Microstructure Dataset (CDMD), through surface registration. Neither is its measured function.

```{figure} figures/functional-networks-1-light.webp
:alt: Four views of the left hemisphere of the CDMD brain. Top row, the lateral surface coloured by Yeo's seven networks and by CAB-NP's twelve networks, each above its key. Bottom row, the medial surface in the same two colourings.
:name: fig-functional-networks-1

**Yeo 7 is a per-vertex field that ignores area borders, and CAB-NP colours whole HCP-MMP areas.** **a**, [Yeo 7](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=hcp-mmp&detail=learning&view=left&hemi=left&internal=0&colors=network) on the lateral surface of the left hemisphere. **b**, [CAB-NP](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=hcp-mmp&detail=learning&view=left&hemi=left&internal=0&colors=cab-np) in the same view. **c**, [Yeo 7](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=hcp-mmp&detail=learning&view=right&hemi=left&internal=0&colors=network) on the medial surface. **d**, [CAB-NP](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=hcp-mmp&detail=learning&view=right&hemi=left&internal=0&colors=cab-np) in the same view. All panels use the HCP-MMP1.0 atlas, with **Colour** set to **Yeo 7 networks** (**a**, **c**) or **CAB-NP networks** (**b**, **d**), the left hemisphere alone and the internal anatomy hidden. Colours are the published network colours (Yeo et al. 2011; CAB-NP label key v1.1.6), as in the keys. In **c** and **d** the medial wall carries no network and shows its tissue colour. All panels share one scale. Scale bars apply at the depth of the camera's target.
```

## Data

| Input | Source | Form in the repository | Licence |
| :--- | :--- | :--- | :--- |
| Yeo 7 | `lh/rh.Schaefer2018_400Parcels_7Networks_order.annot` and the matching 17-network annotations on `fsaverage` (163,842 vertices per hemisphere), ThomasYeoLab/CBIG | `data/fsaverage/label/`, pinned by URL and sha256 in `data/sources.json` | MIT |
| Yeo 7 on CDMD | The 7-network annotations after registered-sphere transfer (108,347 left and 108,379 right vertices) | `data/cdmd/label/`, recorded in `data/sources.json` | MIT |
| CAB-NP v1.1.6 | `CortexSubcortex_ColeAnticevic_NetPartition_wSubcorGSR_parcels_LR_LabelKey.txt` and `LICENSE`, ColeLab/ColeAnticevicNetPartition commit `e4ea9fd` | `data/cab-np/`, pinned in `data/sources.json` | Non-commercial (Rutgers University and Yale University) |

Schaefer parcel names carry the Yeo network in their third underscore-separated field (`7Networks_LH_Default_pCunPCC_11`). Parcel colours are the published Yeo colours jittered per parcel. CAB-NP assigns each of HCP-MMP1.0's 180 areas per hemisphere to one of 12 networks (Ji et al. 2019). Its subcortical assignments are not used.

## Method

### Transfer to the subject
`transfer_annotation` (`scripts/prepare_subject.py`) gave each CDMD vertex the label of the nearest `fsaverage` vertex in `sphere.reg` space, without smoothing. It fails if the set of labels changes. In each hemisphere it checked 512 evenly spaced vertices (`annotation_projection.verify_samples`) against a brute-force nearest-vertex search. All 201 labels of each hemisphere, the 200 parcels and the medial wall, reached CDMD (`labels_preserved` in `data/cdmd/network-registration.json`).

### Palette check
`read_networks` (`brain_model/build.py`) passed the subject annotation to `networks.verify_palette`. Every parcel colour must lie within `networks.maximum_color_jitter` = 12 per red, green and blue (RGB) channel of its network's published colour. The build fails otherwise. The widest jitter in both hemispheres, on `fsaverage` and on CDMD, is 8.

| Network | Key | Published RGB |
| :--- | :--- | ---: |
| Visual | `Vis` | 120, 18, 134 |
| Somatomotor | `SomMot` | 70, 130, 180 |
| Dorsal attention | `DorsAttn` | 0, 118, 14 |
| Salience / ventral attention | `SalVentAttn` | 196, 58, 250 |
| Limbic | `Limbic` | 220, 248, 164 |
| Frontoparietal control | `Cont` | 230, 148, 34 |
| Default mode | `Default` | 205, 62, 78 |

### Parcel to network index
`networks.network_of` read each parcel's network from the third name field. It raises on an unknown network or a truncated name. `network_indices` mapped each vertex to 1–7 in the order of the table above, and to 0 (`NONE`) for the medial wall and label −1. The index is the stored value and is part of the model's contract.

### Per-vertex field
`build_cortex` ran once per cortical atlas (Destrieux, Desikan-Killiany, HCP-MMP1.0, Julich-Brain, Schaefer). `partition_vertex_labels` (`brain_model/surfaces/geometry.py`) carried the integer index onto the partitioned mesh. Source vertices kept their value. A vertex added on a region border took the majority of its edge's two ends or its face's three corners. A tie went to the lower value. The field was never averaged. It was written to each glTF region as `_NETWORK` (`uint8`; 0 unassigned). The source vertices carry the same index under every atlas, so the network borders do not follow the area borders (Fig. 1a).

### Region composition
For each cortical region, `networks.composition` counted its source vertices per network, excluded unassigned vertices from the denominator and stored the shares, largest first, as `networks` in `manifest.json`. No minimum was applied at build. NextBrain cortical regions have no surface. `cortical_network_compositions` (`brain_model/labels/nextbrain.py`) gave each of their voxels the network of the nearest pial or white vertex (k-d tree over both surfaces) after the same palette check, and composed shares over voxels.

### CAB-NP assignment
1. `cab_np.read_label_key` kept the rows whose label ends in `-Ctx` and keyed each by hemisphere and Glasser name (e.g. `left`, `L_V1_ROI`). It fails if a name is filed under the other hemisphere or assigned twice, if a network key has two names or colours, if either hemisphere has other than 180 areas, or if network keys do not run from 1 without gaps. The key holds twelve networks, in key order: Visual1, Visual2, Somatomotor, Cingulo-Opercular, Dorsal-Attention, Language, Frontoparietal, Auditory, Default, Posterior-Multimodal, Ventral-Multimodal, Orbito-Affective. Each keeps its key colour (Default 255, 0, 0).
2. `cab_np.assign` gave every published HCP-MMP cortical region the network of its area name and hemisphere. It fails on an area missing from either side. Hemispheres were assigned separately, so the 13 areas assigned differently on each side keep that difference (e.g. area 44: Language left, Frontoparietal right).
3. `cab_np.export` wrote `cab-np.json` (360 area-to-network assignments) and copied the licence and label key unchanged to `public/models/licenses/CAB-NP.txt` and `CAB-NP-LabelKey.txt`, as the licence requires.

Each area takes one network, so every network border lies on an HCP-MMP area border (Fig. 1b).

## Display

Both colourings are options of the masthead's **Colour** list: **Yeo 7 networks** (URL `colors=network`) and **CAB-NP networks** (`colors=cab-np`).

Yeo 7 is drawn from the per-vertex field. `networkPalette` (`web/src/lib/engine/render/network-colors.ts`) builds a palette texture with one four-channel texel per `_NETWORK` index, and the vertex stage of the cortex material (`web/src/lib/engine/render/materials.ts`) looks up each vertex's colour by its index. The fourth channel is 1 only where a network exists: texel 0 and every texel past the palette hold four zeros. Colours, not indices, are interpolated across a triangle, so a Visual–Default border blends two colours instead of sweeping through five intermediate indices. The cortex material mixes the colour in by `networkMix`, set to 1 only under Yeo 7 while no paint is drawn and the region is not a ghost. A vertex in no network, as on the medial wall, shows the tissue colour of its region (Fig. 1c).

CAB-NP is not a vertex field. `drawLayers` (`web/src/lib/engine/model/visibility.ts`) gives each HCP-MMP region its network's colour, and the medial wall, which has no area, keeps its tissue colour (Fig. 1d). Choosing the colouring switches the atlas to HCP-MMP1.0 (`requiredAtlas`), and `setSurfaceColor('cab-np')` throws on any other atlas. `validateCabNp` rejects an assignment to an unknown region or network and a network without a colour or name.

A cut face samples one label per parcel. Under Yeo 7 a parcel is painted with its dominant network (`dominantNetwork`, largest share ≥ 5%). A parcel split between networks is therefore one colour on the cut and several on the surface, and the cut status line says so. Regions without a network (nuclei, white matter, medial wall) keep their tissue colour. The striatum is coloured voxel by voxel instead ([striatal networks](striatal-networks.md#display)).

The region detail (**Functional networks**) lists Yeo shares ≥ 5% (`MINIMUM_SHARE`), without renormalisation, with the counting basis (vertices or voxels). For an HCP-MMP area it adds its CAB-NP network.

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| `verify_palette`, at build and in the NextBrain step | Every parcel colour within 12 per channel of its network colour | Widest jitter 8 |
| `test_the_published_palette_sits_within_the_configured_jitter` | As above, on the published annotations | Passes |
| `network_of` tests | Unknown network or truncated name raises | Passes |
| `test_a_two_vertex_tie_goes_to_the_lower_value_and_a_majority_wins` | Categorical field carried by majority, never averaged | Passes |
| `test_small_shares_can_be_dropped_without_renormalising` | Shares not rescaled | Passes |
| `test_the_published_orders_pair_every_parcel` | 7- and 17-network orders pair the 400 parcels one to one | Passes |
| `validate_atlas` (`brain_model/validate.py`) | Published `_NETWORK` field and compositions equal the rebuilt ones | Exact |
| `test_the_published_key_assigns_every_area_in_each_hemisphere_once` | 180 areas per hemisphere | Passes |
| `test_the_published_hemispheric_differences_are_kept` | Areas assigned differently per hemisphere | 13 |
| `cab_np.validate` | Rebuilt assignments equal `cab-np.json`; licence and key byte-identical | Exact; 360 areas assigned |
| `networks.test.ts`, `network-colors.test.ts` | Display threshold without rescaling; index past the palette draws no network; CAB-NP network without colour rejected | Passes |

## Limitations

Both colourings show group resting-state networks, not this brain's measured function. Yeo's networks describe the resting-state functional connectivity of 1,000 subjects (Yeo et al. 2011), and CAB-NP's that of Human Connectome Project participants (Ji et al. 2019). Yeo 7 reaches CDMD through one sphere registration from `fsaverage`. CAB-NP reaches it through the HCP-MMP projection.

CAB-NP assigns whole areas, so it colours HCP-MMP areas only and its borders are HCP-MMP's.

Shares count assigned vertices or voxels, not surface area. A cut face shows one network per parcel.

CAB-NP is licensed for non-commercial use only. HCP-MMP terms pass to every recipient of `cab-np.json` ([references](../reference/references.md)).

## Code availability

Code
: [`brain_model/layers/networks.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/networks.py), [`brain_model/layers/cab_np.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/cab_np.py), `read_networks` and `build_cortex` in [`brain_model/build.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/build.py), `cortical_network_compositions` in [`brain_model/labels/nextbrain.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/labels/nextbrain.py), `transfer_annotation` in [`scripts/prepare_subject.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/prepare_subject.py)

Configuration
: `networks.maximum_color_jitter`, `annotation_projection.verify_samples` and the `schaefer` atlas entry in [`config/model.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/model.yaml)

Tests
: [`tests/test_networks.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_networks.py), [`tests/test_cab_np.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_cab_np.py), `web/src/lib/core/catalog/networks.test.ts`, `web/src/lib/engine/render/network-colors.test.ts`

```bash
uv sync --locked
uv run python scripts/prepare_subject.py --anatomy cdmd   # project the annotations from fsaverage
uv run python -m brain_model.build --anatomy cdmd         # writes _NETWORK and cab-np.json
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_networks.py tests/test_cab_np.py
```

