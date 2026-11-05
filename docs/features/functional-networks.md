# Functional networks

Two resting-state network colourings of the cortex: Yeo's seven networks, carried per vertex from Schaefer 2018, and the twelve networks of CAB-NP, carried per HCP-MMP area.

:::{list-table}
:widths: 22 78
:stub-columns: 1

* - Where in the viewer
  - Colour field of the masthead (**Yeo 7 networks**, **CAB-NP networks**); the **Functional networks** disclosure of the region detail; the stage key; cut faces.
* - Built by
  - [`brain_model/layers/networks.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/networks.py), [`brain_model/layers/cab_np.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/cab_np.py), `read_networks` and `build_cortex` in [`brain_model/build.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/build.py), `cortical_network_compositions` in [`brain_model/labels/nextbrain.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/labels/nextbrain.py), `transfer_annotation` in [`scripts/prepare_subject.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/prepare_subject.py)
* - Configuration
  - `networks.maximum_color_jitter` and the `schaefer` entry of `atlases` in [`config/model.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/model.yaml); the `networks` layer in each anatomy's `layers` list
* - Source data
  - Yeo 7: Schaefer et al. (2018) 400-parcel, 7-network annotations on `fsaverage` (ThomasYeoLab/CBIG; MIT), colours from Yeo et al. (2011). CAB-NP: label key v1.1.6 from ColeLab/ColeAnticevicNetPartition at commit `e4ea9fd` (Ji et al. 2019; Rutgers and Yale non-commercial licence)
* - Checked by
  - [`tests/test_networks.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_networks.py), [`tests/test_cab_np.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_cab_np.py); `validate_atlas` and `cab_np.validate` in `brain_model/validate.py`; `web/src/lib/core/catalog/networks.test.ts`, `web/src/lib/engine/render/network-colors.test.ts`
:::

## What it does

- **Yeo 7.** Visual, somatomotor, dorsal and ventral attention, limbic, frontoparietal, default. Every cortical vertex of every cortical atlas takes the network of the Schaefer parcel it lies in, so the colouring crosses atlas borders. Region shares count assigned vertices (or, for NextBrain cortex, voxels); shares under 5% are hidden without rescaling.
- **CAB-NP** v1.1.6. Each HCP-MMP area takes one of 12 networks by its Glasser name, per hemisphere; the 13 areas assigned differently on each side keep that difference. Because CAB-NP assigns whole areas, its colour borders are HCP-MMP's, and choosing it switches the atlas to HCP-MMP.

Both are group resting-state networks reaching this brain through registration, not its measured function. The striatum has its own network layer, drawn in the same Yeo colours: see [Striatal networks](striatal-networks.md).

## Data

| Layer | Source | Form in the repository | Licence |
| :--- | :--- | :--- | :--- |
| Yeo 7 | `lh/rh.Schaefer2018_400Parcels_7Networks_order.annot` on `fsaverage`, and the matching 17-network annotations | `data/fsaverage/label/`, pinned in `data/sources.json` by URL and checksum | MIT |
| Yeo 7 on the subject | The same annotations after the registered-sphere transfer | `data/<anatomy>/label/` (for example `data/cdmd/label/lh.Schaefer2018_400Parcels_7Networks_order.annot`) | MIT |
| CAB-NP | `CortexSubcortex_ColeAnticevic_NetPartition_wSubcorGSR_parcels_LR_LabelKey.txt` and `LICENSE`, commit `e4ea9fd` | `data/cab-np/`, pinned in `data/sources.json` | Non-commercial (Rutgers University and Yale University) |

Schaefer 2018 is the published 400-parcel parcellation of 1,489 participants; the parcel names carry the Yeo network in their third underscore-separated field. Its colours are the published Yeo colours jittered per parcel so that parcels stay distinguishable. CAB-NP is a partition of HCP-MMP1.0's 180 areas per hemisphere (and of the subcortex, which Planum does not use: see [Alternatives considered](#alternatives-considered)).

## How it was built

### Yeo 7

1. **Transfer to the subject.** `transfer_annotation` in `scripts/prepare_subject.py` moves the Schaefer annotation from `fsaverage` to the subject by the forward nearest source vertex in `sphere.reg` space, without smoothing, and checks 512 evenly spaced vertices of each annotation (`annotation_projection.verify_samples`) against a brute-force nearest vertex. It fails if label coverage changes. The same step produces the other projected annotations; see [Cortical atlases](cortical-atlases.md).
2. **Palette check.** `read_networks` reads the subject's annotation and calls `networks.verify_palette`. Each parcel's colour must lie within `networks.maximum_color_jitter` (12 per channel; the widest observed is 8) of its network's published colour in `networks.COLORS`:

   | Network | Key | Published RGB |
   | :--- | :--- | :--- |
   | Visual | `Vis` | 120, 18, 134 |
   | Somatomotor | `SomMot` | 70, 130, 180 |
   | Dorsal attention | `DorsAttn` | 0, 118, 14 |
   | Salience / ventral attention | `SalVentAttn` | 196, 58, 250 |
   | Limbic | `Limbic` | 220, 248, 164 |
   | Frontoparietal control | `Cont` | 230, 148, 34 |
   | Default mode | `Default` | 205, 62, 78 |

   A parcel further away fails the build instead of shipping.
3. **Parcel to network.** `networks.network_of` reads the third field of a name such as `7Networks_LH_Default_pCunPCC_11` and raises on an unknown network or a truncated name; the medial-wall background has no network. `network_indices` turns each vertex's parcel label into an index into `NETWORKS` = `[Vis, SomMot, DorsAttn, SalVentAttn, Limbic, Cont, Default]`, 1 to 7, with 0 (`NONE`) for the medial wall and for the label `-1`. The order is part of the model's contract, since the index is what the vertex field stores.
4. **Per-vertex field on the atlas mesh.** `build_cortex` runs once for each cortical atlas. `partition_vertex_labels` (`brain_model/surfaces/geometry.py`) carries the indices onto the partitioned mesh: original vertices keep their value, and each vertex the partition adds on a region border (an edge midpoint, a face centre) takes the majority of the values at its edge's ends or its face's corners, a tie going to the lower value. The field is categorical and is never averaged; it is required to be integer. It is written to the glTF as `_NETWORK` (`uint8` in the file; 1 to 7, 0 unassigned).
5. **Region composition.** For each cortical region, `networks.composition` counts the source vertices of the region in each network, leaves unassigned vertices out of the denominator, and returns the shares largest first (`{"network", "fraction"}`); no minimum is applied in the build. These are shares of source vertices, not of surface area, and are stored as `networks` in `manifest.json`.
6. **NextBrain cortex.** NextBrain's cortical regions are cut-only tissue labels with no surface. `cortical_network_compositions` in `brain_model/labels/nextbrain.py` gives each of their voxels the network of the nearest pial or white vertex of the subject (a KD-tree over both surfaces' vertices), after the same palette check, and takes shares over those voxels, so a NextBrain cortical region has the same kind of composition as a surface parcel.
7. **Metadata.** `networks.metadata()` writes the layer's id (`yeo7`), network order, colours, citations (Yeo et al. 2011, Schaefer et al. 2018), the attribute (`_NETWORK`) and the method and composition statements to the manifest.

### CAB-NP

1. **Read the label key.** `cab_np.read_label_key` keeps the rows whose label ends in `-Ctx`, maps each to `(hemisphere, Glasser name)` (for example `left`, `L_V1_ROI`) and its network, and fails if a name is filed under the other hemisphere, is assigned twice, has a network key with two names or colours, if either hemisphere has other than 180 areas, or if the network keys do not run from 1 without gaps. The twelve networks, in key order, are Visual1, Visual2, Somatomotor, Cingulo-Opercular, Dorsal-Attention, Language, Frontoparietal, Auditory, Default, Posterior-Multimodal, Ventral-Multimodal and Orbito-Affective; each carries the colour in the key (Default is 255, 0, 0).
2. **Assign by name.** `cab_np.assign` gives every HCP-MMP cortical region of the anatomy the network of its published area name and hemisphere. It fails if CAB-NP does not assign an area the anatomy publishes, or assigns areas the anatomy does not publish. The hemispheres are assigned separately, so the 13 areas that CAB-NP puts in a different network on each side keep that difference (for example area 44 is Language on the left and Frontoparietal on the right).
3. **Export.** `cab_np.export` writes `cab-np.json` (id, atlas `hcp-mmp`, network names, colours, region id to network) to the model directory, and copies the licence and the label key unchanged to `public/models/licenses/CAB-NP.txt` and `CAB-NP-LabelKey.txt`, since the licence permits redistribution only with its terms and the original files. The assignments are per area, never per vertex.

## How the viewer uses it

- **Yeo 7 on the surface.** `attachNetworkColors` in `web/src/lib/engine/render/network-colors.ts` reads the `_network` attribute and writes `_networkColor`, four floats per vertex: the palette colour, and a fourth channel that is 1 where the vertex has a network. The index itself is not interpolated: a triangle spanning Visual (1) and Default (7) would sweep through five networks it never touches, whereas a colour blends only the two that meet there. The material in `lib/engine/render/materials.ts` mixes `vNetworkColor.rgb` into the diffuse colour by `networkMix * vNetworkColor.a`; the medial wall keeps its region colour. `brain-atlas.ts` sets `networkMix` to 1 only under Yeo 7 and with no paint or ghost on the region, and applies the T1 shading only under tissue colour.
- **CAB-NP on the surface.** Not a per-vertex field: `brain-atlas.ts` gives each HCP-MMP region the published colour of its area's network. `setSurfaceColor('cab-np')` throws unless the model carries the partition and HCP-MMP is the shown atlas. `validateCabNp` (`lib/core/catalog/networks.ts`) checks that every assignment names a region of that atlas and a listed network, that every network has a colour and an English and French name. While CAB-NP colours the atlas, the region list groups areas under their network.
- **Cut faces.** A cut is sampled from a label volume with one code per parcel, so its Yeo colour is the colour of the network holding most of the parcel (`dominantNetwork`, shares of 5% or more); a parcel split between networks reads as one colour on the cut and as several on the surface, and the cut status line says so. Regions in no network (nuclei, white matter, the medial wall) keep their tissue colour. Under CAB-NP, a cut coloured by HCP-MMP labels shows each area's network; other cut labels have none. The striatum is the exception under Yeo 7: see [Striatal networks](striatal-networks.md#how-the-viewer-uses-it).
- **Key and hover.** `stage-keys.ts` lists each network with its swatch; `hover-text.ts` names the network under the pointer.
- **Region detail.** `NetworkSection.svelte` lists a region's Yeo shares (`networksOf`, minimum share `MINIMUM_SHARE` = 0.05, never renormalised, so the shown shares need not total 100%), with a note on the counting basis (`networkBasis`: vertices for the four cortical atlases, voxels for NextBrain cortex). For an HCP-MMP area it adds the one CAB-NP network, as a share of 100%.

## Checks

| Check | Where | Limit |
| :--- | :--- | :--- |
| Every parcel's colour near its published network colour | `verify_palette`, at build and in the NextBrain step | within `maximum_color_jitter` (12) |
| Parcel names read as exactly one network | `network_of` | raises on unknown or truncated names |
| 17-network names pair the 7-network parcels one to one | `seventeen_network_names` | fails otherwise |
| Published `_NETWORK` field equals the one rebuilt from the annotation | `validate_atlas` | exact |
| Published composition equals the one rebuilt | `validate_atlas` | exact |
| CAB-NP assignments rebuilt from the label key equal the published file; every area assigned; licence and key copied byte for byte | `cab_np.validate`, step 7 of the [validator](../pipeline/validation.md) | exact |

Tests cover the name parsing, the unknown-network and truncated-name errors, label-to-index mapping with the medial wall, composition ordering and thresholds without renormalisation, the categorical majority rule with a two-vertex tie going to the lower value, the palette jitter, and the CAB-NP key rules (180 areas per hemisphere, 13 hemispheric differences, duplicate and misfiled areas rejected).

## Limits

- Group resting-state networks, not this brain's measured function. Yeo reaches it through one registration from `fsaverage`; CAB-NP through the HCP-MMP projection, which is two registrations from HCP space.
- CAB-NP assigns each HCP-MMP area whole to one network, so its colour borders are HCP-MMP's borders, and it colours that atlas's areas only.
- Network shares count assigned vertices or voxels, not surface area; unassigned samples are excluded.
- CAB-NP is licensed for non-commercial use only (Rutgers University and Yale University); commercial use needs a licence from the universities. HCP-MMP terms also pass to every recipient of `cab-np.json` (see the [references](../reference/references.md)).

### Alternatives considered

The CAB-NP subcortex was not adopted for the striatum, pallidum or thalamus; its measured disagreement with Choi et al. (2012) is under [Striatal networks](striatal-networks.md#alternatives-considered).

## Reproduce

```bash
uv sync --locked
# project the published annotations (Schaefer 7- and 17-network sets included) from fsaverage to the anatomy
uv run python scripts/prepare_subject.py --anatomy cdmd
# build the models; cab-np.json and the _NETWORK fields are written here
uv run python -m brain_model.build --anatomy cdmd
# check them
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_networks.py tests/test_cab_np.py
```

## See also

- [Striatal networks](striatal-networks.md), the same seven networks inside the caudate, putamen and accumbens
- [Cortical atlases](cortical-atlases.md), for Schaefer 2018 and HCP-MMP1.0
- [Functional divisions](functional-divisions.md), the other per-area grouping of HCP-MMP
- [Validation](../pipeline/validation.md) and the [references](../reference/references.md)
