# Registration landing

Group maps reach this brain, subject `sub_013` of the MGH Connectome Diffusion Microstructure Dataset (CDMD), through a volume registration. Registration landing measures how well that registration places fine structures, and sets a rule for what a small structure may take from a registered map. The MNI152NLin2009cAsym template was reconstructed and segmented exactly like this brain, and each of its own NextBrain structures was carried through the published coordinate field and compared with this brain's structure of the same label. The score is an upper bound on registration error, because it also holds the disagreement between two segmentation runs, and it measures one registration only. The result is published in **Provenance** under **Registered group maps**, beside each registered map's own registration check.

```{figure} figures/registration-landing-1-light.webp
:alt: Two plots. a, five bars of median Dice by the volume of the structure, rising from 0.12 for structures under 20 cubic millimetres to about 0.65 for the largest, the two smallest classes in orange. b, a dot plot of Dice for fourteen large deep structures and the cortex, carried from two MNI templates, with all deep structures between 0.80 and 0.92 and cortex near 0.72.
:name: fig-registration-landing-1

**A registered map places large structures well and fine structures poorly.** **a**, Median Dice of the template's own NextBrain structures, carried through the published MNI152NLin2009cAsym field, against this brain's structures of the same label, by the volume of the structure on this brain (`validation.json`, `landing.by_volume`; n = 510 structures, with the number in each class above its bar). Orange marks the classes under 100 mm³, in which a structure takes no shares from a registered map. **b**, Dice of fourteen aseg structures and of the cortex carried from each of the two MNI templates against this brain's own (`validation.json`, `coordinate_spaces`). Circles are MNI152NLin2009cAsym and squares SPM12, and a line joins the two values of a structure. The score in **a** is an upper bound on registration error, because it also holds the disagreement between two segmentation runs.
```

## Data

| Input | Content | Pinned by |
| :--- | :--- | :--- |
| Template reconstruction | TemplateFlow `tpl-MNI152NLin2009cAsym_res-01_T1w`, header scaled by 0.90 to the mean brain volume of the 26 CDMD people (1,133 cm³; the template's is 1,548 cm³), reconstructed with FreeSurfer 8.2 as anatomy `mni152` | `config/model.yaml`, `data/sources.json` |
| Template structures | `nextbrain-mni152.mgz`: NextBrain on that reconstruction, 0.4 mm, same procedure as this brain's ([internal anatomy](internal-anatomy.md)) | `data/sources.json` |
| Registration | `data/cdmd/coordinates/mni152nlin2009casym-field.nii.gz`, the field the viewer ships ([published coordinates](published-coordinates.md)) | `field_sha256` in the record |
| This brain's structures | `nextbrain-cdmd.mgz` | `nextbrain_sha256` in the record |

The same reconstruction is published as a second brain, the [MNI template](mni-template.md). The benchmark reads its NextBrain volume, not the published meshes. As the benchmark's reference, the template has no landing record of its own: its striatal networks give a structure under the 100 mm³ floor no shares and name nothing round it.

The record is `data/cdmd/coordinate-landing.json`. It holds one row per structure and the summary of those rows. The summary and the rule are published as `landing` in `manifest.json` and in `validation.json`.

## Method

### Carrying the template's structures

`landing.carry` takes every labelled voxel of the template's NextBrain volume. Each voxel's position in template millimetres is its scanner position divided by 0.90 (the header scale). `coordinate_spaces.map_points` maps that position through the published field to this brain's surface RAS (right, anterior, superior), trilinear between the field's 1.5 mm nodes. The voxel's label is then painted on this brain's NextBrain grid at the nearest voxel. A voxel the field does not cover is counted and left out.

### Scoring

For each label present in both brains, `landing.score` gives two measures. The first is the Dice coefficient between the painted structure and this brain's own, on the 0.4 mm grid. The second is the centre miss, the distance between the mean landing point of the template's voxels and the centroid of this brain's structure.

`landing.summarise` reports the median and 90th percentile of the centre miss, the median Dice, and the median Dice in five classes of the structure's volume on this brain (under 20, 100, 500 and 2,000 mm³, and above).

### What the score bounds

The two structures come from two separate NextBrain runs, so the score includes their disagreement as well as registration error. It is an upper bound on registration error, not an estimate of it.

### The small-structure rule

A structure under 100 mm³ (`SMALL_MM3`) takes no voxel shares from a registered map. Below that volume the median Dice is under 0.4 (Fig. 1a): most of the structure's own voxels hold whatever the map says beside it, not on it. Large structures land far better. Across the two MNI templates, deep grey matter and the lateral ventricles overlap this brain's own at Dice 0.80–0.92 and cortex at 0.72–0.74 (Fig. 1b; [published coordinates](published-coordinates.md)).

Such a structure names what the map holds round it instead. `landing.neighbourhood_counts` takes the map's 1 mm voxels within the landing radius of the structure (Euclidean distance from the voxels the structure occupies), and `landing.near` lists every value holding at least 1% of the labelled neighbourhood, largest first. The landing radius is the 90th percentile of the centre miss, rounded up to 0.1 mm. One name means the map agrees everywhere within that distance. Several mean that a border passes that close, and the map cannot say on which side the structure lies.

The rule applies to [arterial territories](arterial-territories.md) (`territories_near`) and [striatal networks](striatal-networks.md) (`striatal_networks_near`). [Stroke cases](stroke-cases.md) and [published coordinates](published-coordinates.md) report only FreeSurfer's deep structures and cortical parcels, all above the floor. `landing.validate`, run by `brain_model.validate`, fails if any structure under the floor carries `territories`, `striatal_networks` or `cerebellar_functions`.

The floor and the radius were set after the measurement was seen, from its own classes. They are not a prediction that was then tested.

### A change must beat the record

`scripts/measure_landing.py --record` refuses to replace the record with a result whose 90th-percentile centre miss is larger or whose median Dice is lower. A different registration, or a different person, is adopted only if it lands at least as well by this measurement. The record names the field and both segmentations by checksum, so a changed input has to be measured again.

### A refinement that was tested and not adopted

Because both brains hold the same NextBrain structures, a second registration can be driven by them. One was tested on 2026-11-21. After the registered field, a residual ANTs SyN registration (antspyx 0.6.3) was run on this brain's 0.4 mm NextBrain grid. Its metric was MeanSquares on three label-contrast images, in which each label has the same random intensity in both brains, with 100 × 70 × 40 iterations. A registration cannot be scored on the labels that drove it. Every structure under 2,000 mm³ was therefore hidden from one of two extra fits, its voxels given to the nearest visible label in both images, and scored by that fit.

| Measure | Registered field | With the refinement |
| :--- | ---: | ---: |
| Hidden structures, median Dice: under 20 / 20–100 / 100–500 / 500–2,000 mm³ (442 structures) | 0.12 / 0.36 / 0.54 / 0.69 | 0.30 / 0.54 / 0.71 / 0.76 |
| Hidden structures, centre miss: median / 90th percentile | 1.07 / 2.71 mm | 0.70 / 2.29 mm |
| FreeSurfer's deep structures, median Dice (independent of NextBrain) | 0.881 | 0.884 |
| FreeSurfer's cerebral cortex, Dice | 0.687 | 0.752 |
| Left amygdala against FreeSurfer, Dice | 0.863 | 0.819 |
| This brain's cortical points the template's cortex does not reach (198,492 mid-thickness vertices) | 23.5% | 15.1% |
| Same Schaefer-400 parcel as this brain's own, over all points / where reached | 51.9% / 67.8% | 57.6% / 67.8% |

The refinement lands structures and the cortical ribbon better, and names cortical areas no better once a point is in the cortex. It was not adopted, because the field it gives is not safe to publish on the 1.5 mm node grid the viewer reads. One grid cell folds (Jacobian determinant −0.08) and 160 cells are squeezed below 0.1, whereas the registered field's lowest determinant is 0.121 and none of its cells folds. The viewer's own inversion of the field, which [overlays](overlays.md) depend on, does not converge at 23 nodes. Smoothing the residual to the grid (Gaussian σ of 0.75 mm, then 1.5 mm) removes the fold but leaves the lowest determinant at 0.079 and 0.093, under the floor of 0.1 set before the smoothed fields were measured.

The gain is real but comes with deformation too sharp for a coordinate field. These measurements were made with scripts that are not in the repository and are not recorded by validation.

## Display

**Provenance** › **Registered group maps** (`registeredMaps`, `web/src/lib/core/panels/provenance.ts`) leads with the benchmark: the number of structures, the median and 90th-percentile centre miss, the median Dice by volume class, and the rule. Each registered map follows with the check its own registration was scored by.

In a region's sheet, a small structure's **Typical arterial supply** (`SupplySection.svelte`) and striatal networks (`NetworkSection.svelte`) list names without bars or percentages, and say whether one value surrounds the structure or a border passes within the radius. Under the arterial colour, a small structure drawn whole takes a territory's colour only when one territory surrounds it (`majorityTerritoryColor`).

## Validation

| Test | Criterion | Result |
| :--- | :--- | ---: |
| `scripts/measure_landing.py` on CDMD, structures in both brains | reported | 510 structures |
| Centre miss, median / 90th percentile | reported | 1.16 / 2.93 mm |
| Median Dice, all structures | reported | 0.37 |
| Landing radius | 90th-percentile centre miss, rounded up to 0.1 mm | 3.0 mm |
| Template voxels the field does not cover | reported | 742 |
| Median Dice, under 20 mm³ (191 structures) | reported | 0.12 |
| Median Dice, 20–100 mm³ (130 structures) | reported | 0.36 |
| Median Dice, 100–500 mm³ (83 structures) | reported | 0.53 |
| Median Dice, 500–2,000 mm³ (40 structures) | reported | 0.67 |
| Median Dice, 2,000 mm³ and above (66 structures) | reported | 0.64 |
| `landing.validate` | The record's summary recomputes from its rows; no structure under 100 mm³ carries registered shares | holds |
| Small structures named by arterial territory | reported | 345 (82 by one territory, 263 by two to five) |
| Small structures named by striatal network | reported | 3 |
| `tests/test_landing.py` | Carrying, scoring, summary, record, neighbourhood and rule | pass |
| `web/src/lib/core/panels/provenance.test.ts` (`PROV-25`) | The row's text from the published numbers, in both languages | pass |

The class of 2,000 mm³ and above is held down by cortical parcels and cerebellar layers carried as volumes.

`tests/test_landing.py` checks each step. A structure carried onto itself scores 1 and a shifted one its overlap. Uncovered voxels are counted, not painted. The summary groups overlap by volume and refuses an empty class. A wider miss or a lower overlap is worse than the record, and an equal result is not. A neighbourhood stops at its radius. Slivers under 1% and unlabelled tissue are not named. A small structure with shares fails validation.

## Limitations

The benchmark measures one registration (MNI152NLin2009cAsym, SynthMorph). The arterial atlas, the striatal atlas, the cerebellar atlas and the stroke lesions each use their own SynthMorph registration from another template. None of those templates has fine structures of its own to carry, so their landing on fine structures is not measured. The radius is applied to them as the same method's measured error, and each map's own check is published beside it.

Dice punishes a small structure for a miss that a large one absorbs: a 1.2 mm miss is most of the radius of a 20 mm³ sphere (1.7 mm). The classes describe overlap, not a different registration quality by size.

A name without shares is weaker than shares, on purpose. It does not say how much of the structure a territory supplies.

The landing radius covers nine structures in ten. One in ten lands further off than the neighbourhood that was read.

Cortical parcels carried as volumes overlap at a Dice of 0.32–0.79 (median 0.62, 68 parcels). Cortical layers reach this brain through surface registration instead ([cortical atlases](cortical-atlases.md)), which this benchmark does not measure.

## Code availability

Code
: [`brain_model/layers/landing.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/landing.py) (carry, score, summary, neighbourhood, rule), [`scripts/measure_landing.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/measure_landing.py) (record), [`web/src/lib/core/panels/provenance.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/panels/provenance.ts) (display)

Configuration
: [`config/model.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/model.yaml), `template_space` of anatomy `mni152`; `SMALL_MM3`, `VOLUME_CLASSES_MM3` and `MINIMUM_FRACTION` in `brain_model/layers/landing.py`

Tests
: [`tests/test_landing.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_landing.py), [`web/src/lib/core/panels/provenance.test.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/panels/provenance.test.ts) (`PROV-25`)

```bash
uv run python scripts/measure_landing.py            # prints the result beside the record
uv run python scripts/measure_landing.py --record   # writes data/cdmd/coordinate-landing.json
uv run pytest tests/test_landing.py
```
