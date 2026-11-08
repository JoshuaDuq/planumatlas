# Functional networks

Two group resting-state network colourings of the cortex. Yeo's seven networks are carried per vertex from the Schaefer 2018 400-parcel annotation, so they cross the borders of every cortical atlas. The twelve networks of the Cole-Anticevic Brain-wide Network Partition (CAB-NP) are carried per area of HCP-MMP1.0 (Human Connectome Project multi-modal parcellation), so their borders are HCP-MMP's. Both reach this brain through surface registration; neither is its measured function.

```{figure} figures/functional-networks-1.webp
:alt: Four views of the left hemisphere of the CDMD brain. Top row, the lateral surface coloured by Yeo's seven networks and by CAB-NP's twelve networks; bottom row, the medial surface in the same two colourings.
:name: fig-functional-networks-1

**Yeo 7 is a per-vertex field that ignores area borders; CAB-NP colours whole HCP-MMP areas.** **a**, Yeo 7, lateral left hemisphere. **b**, CAB-NP, same view. **c**, Yeo 7, medial left hemisphere. **d**, CAB-NP, same view. Atlas HCP-MMP1.0 in all panels; Colour **Yeo 7 networks** (a, c) or **CAB-NP networks** (b, d); hemisphere left; internal anatomy hidden. Colours are the published network colours (Yeo et al. 2011; CAB-NP label key v1.1.6). In c and d the medial wall carries no network and keeps its region colour.
```

## Data

| Input | Source | Form in the repository | Licence |
| :--- | :--- | :--- | :--- |
| Yeo 7 | `lh/rh.Schaefer2018_400Parcels_7Networks_order.annot` and the matching 17-network annotations on `fsaverage` (163,842 vertices per hemisphere), ThomasYeoLab/CBIG | `data/fsaverage/label/`, pinned by URL and sha256 in `data/sources.json` | MIT |
| Yeo 7 on CDMD | The same annotations after registered-sphere transfer (108,347 left and 108,379 right vertices) | `data/cdmd/label/`, recorded in `data/sources.json` | MIT |
| CAB-NP v1.1.6 | `CortexSubcortex_ColeAnticevic_NetPartition_wSubcorGSR_parcels_LR_LabelKey.txt` and `LICENSE`, ColeLab/ColeAnticevicNetPartition commit `e4ea9fd` | `data/cab-np/`, pinned in `data/sources.json` | Non-commercial (Rutgers University and Yale University) |

Schaefer parcel names carry the Yeo network in their third underscore-separated field (`7Networks_LH_Default_pCunPCC_11`). Parcel colours are the published Yeo colours jittered per parcel. CAB-NP assigns each of HCP-MMP1.0's 180 areas per hemisphere to one of 12 networks (Ji et al. 2019); its subcortical assignments are not used.

## Method

### Transfer to the subject
`transfer_annotation` (`scripts/prepare_subject.py`) gives each CDMD vertex the label of the nearest `fsaverage` vertex in `sphere.reg` space, without smoothing. It fails if the set of labels changes, and it checks 512 evenly spaced vertices (`annotation_projection.verify_samples`) against a brute-force nearest-vertex search.

### Palette check
`read_networks` (`brain_model/build.py`) passes the subject annotation to `networks.verify_palette`. Every parcel colour must lie within `networks.maximum_color_jitter` = 12 per RGB channel of its network's published colour; otherwise the build fails. The widest jitter in both hemispheres, on `fsaverage` and on CDMD, is 8.

| Network | Key | Published RGB |
| :--- | :--- | :--- |
| Visual | `Vis` | 120, 18, 134 |
| Somatomotor | `SomMot` | 70, 130, 180 |
| Dorsal attention | `DorsAttn` | 0, 118, 14 |
| Salience / ventral attention | `SalVentAttn` | 196, 58, 250 |
| Limbic | `Limbic` | 220, 248, 164 |
| Frontoparietal control | `Cont` | 230, 148, 34 |
| Default mode | `Default` | 205, 62, 78 |

### Parcel to network index
`networks.network_of` reads the third name field and raises on an unknown network or a truncated name. `network_indices` maps each vertex to 1–7 in the order of the table above, and to 0 (`NONE`) for the medial wall and label −1. The index is the stored value and is part of the model's contract.

### Per-vertex field
`build_cortex` runs once per cortical atlas (Destrieux, HCP-MMP1.0, Julich-Brain, Schaefer). `partition_vertex_labels` (`brain_model/surfaces/geometry.py`) carries the integer index onto the partitioned mesh. Source vertices keep their value. A vertex added on a region border takes the majority of its edge's two ends or its face's three corners; a tie goes to the lower value. The field is never averaged. It is written to each glTF region as `_NETWORK` (`uint8`; 0 unassigned).

### Region composition
For each cortical region, `networks.composition` counts its source vertices per network, excludes unassigned vertices from the denominator and stores the shares, largest first, as `networks` in `manifest.json`. No minimum is applied at build. NextBrain cortical regions have no surface: `cortical_network_compositions` (`brain_model/labels/nextbrain.py`) gives each of their voxels the network of the nearest pial or white vertex (k-d tree over both surfaces) after the same palette check, and composes shares over voxels.

### CAB-NP assignment
1. `cab_np.read_label_key` keeps rows whose label ends in `-Ctx` and keys each by hemisphere and Glasser name (e.g. `left`, `L_V1_ROI`). It fails if a name is filed under the other hemisphere or assigned twice, if a network key has two names or colours, if either hemisphere has other than 180 areas, or if network keys do not run from 1 without gaps.
2. The twelve networks, in key order: Visual1, Visual2, Somatomotor, Cingulo-Opercular, Dorsal-Attention, Language, Frontoparietal, Auditory, Default, Posterior-Multimodal, Ventral-Multimodal, Orbito-Affective. Each keeps its key colour (Default 255, 0, 0).
3. `cab_np.assign` gives every published HCP-MMP cortical region the network of its area name and hemisphere, and fails on an area missing from either side. Hemispheres are assigned separately, so the 13 areas assigned differently on each side keep that difference (e.g. area 44: Language left, Frontoparietal right).
4. `cab_np.export` writes `cab-np.json` (360 area-to-network assignments) and copies the licence and label key unchanged to `public/models/licenses/CAB-NP.txt` and `CAB-NP-LabelKey.txt`, as the licence requires.

## Display

Both colourings are options of the masthead **Colour** field (URL `colors=network` or `colors=cab-np`). `attachNetworkColors` (`web/src/lib/engine/render/network-colors.ts`) converts `_NETWORK` to a four-channel per-vertex colour; the fourth channel is 1 only where a network exists. Colours, not indices, are interpolated across a triangle, so a Visual–Default border blends two colours instead of sweeping through five intermediate indices. The cortex material mixes the colour in by `networkMix`, set to 1 only under Yeo 7 on a region with no paint or ghost; the medial wall keeps its region colour.

CAB-NP is not a vertex field: `brain-atlas.ts` gives each HCP-MMP region its network's colour. Choosing it switches the atlas to HCP-MMP1.0 (`requiredAtlas`), and `setSurfaceColor('cab-np')` throws on any other atlas. `validateCabNp` rejects an assignment to an unknown region or network and a network without a colour or name.

A cut face samples one label per parcel. Under Yeo 7 a parcel is painted with its dominant network (`dominantNetwork`, largest share ≥ 5%); a parcel split between networks is one colour on the cut and several on the surface, and the cut status line says so. Regions without a network (nuclei, white matter, medial wall) keep their tissue colour. The striatum is coloured voxel by voxel instead ([striatal networks](striatal-networks.md#display)). The region detail (**Functional networks**) lists Yeo shares ≥ 5% (`MINIMUM_SHARE`), without renormalisation, with the counting basis (vertices or voxels); for an HCP-MMP area it adds its CAB-NP network.

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

- Group resting-state networks, not this brain's measured function.
- Yeo 7 reaches CDMD through one sphere registration from `fsaverage`; CAB-NP through the HCP-MMP projection.
- CAB-NP assigns whole areas, so it colours HCP-MMP areas only and its borders are HCP-MMP's.
- Shares count assigned vertices or voxels, not surface area.
- A cut face shows one network per parcel.
- CAB-NP is licensed for non-commercial use only; HCP-MMP terms pass to every recipient of `cab-np.json` ([references](../reference/references.md)).

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

Figure state (panel b): https://planumatlas.com/#anatomy=cdmd&atlas=hcp-mmp&colors=cab-np&view=left&hemi=left&internal=0
