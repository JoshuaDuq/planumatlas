# Registration landing

Group maps reach this brain through a volume registration. Registration landing measures how well that registration places fine structures, and sets a rule for what a small structure may take from a registered map. The MNI152NLin2009cAsym template was reconstructed and segmented exactly like this brain; each of its own NextBrain structures is carried through the published coordinate field and compared with this brain's structure of the same label. The result is published in **Provenance** under **Registered group maps**, beside each registered map's own registration check.

## Data

| Input | Content | Pinned by |
| :--- | :--- | :--- |
| Template reconstruction | TemplateFlow `tpl-MNI152NLin2009cAsym_res-01_T1w`, header scaled by 0.90 to the mean brain volume of the 26 CDMD people (1,133 cm³; the template's is 1,548 cm³), reconstructed with FreeSurfer 8.2 as anatomy `mni152` | `config/model.yaml`, `data/sources.json` |
| Template structures | `nextbrain-mni152.mgz`: NextBrain on that reconstruction, 0.4 mm, same procedure as this brain's ([internal anatomy](internal-anatomy.md)) | `data/sources.json` |
| Registration | `data/cdmd/coordinates/mni152nlin2009casym-field.nii.gz`, the field the viewer ships ([published coordinates](published-coordinates.md)) | `field_sha256` in the record |
| This brain's structures | `nextbrain-cdmd.mgz` | `nextbrain_sha256` in the record |

The template anatomy is a measuring instrument only. It is not built into the viewer.

## Method

### Carrying the template's structures

`landing.carry` takes every labelled voxel of the template's NextBrain volume. Its position in template millimetres is its scanner position divided by 0.90 (the header scale). `coordinate_spaces.map_points` maps it through the published field to this brain's surface RAS, trilinear between the field's 1.5 mm nodes, and the voxel's label is painted on this brain's NextBrain grid at the nearest voxel. A voxel the field does not cover is counted and left out.

### Scoring

For each label present in both brains, `landing.score` gives:

- **Dice** between the painted structure and this brain's own, on the 0.4 mm grid;
- **centre miss**, the distance between the mean landing point of the template's voxels and the centroid of this brain's structure.

`landing.summarise` reports the median and 90th percentile of the centre miss, the median Dice, and the median Dice in five classes of the structure's volume on this brain (under 20, 100, 500 and 2,000 mm³, and above).

### What the score bounds

The two structures come from two separate NextBrain runs, so the score includes their disagreement as well as registration error. It is an upper bound on registration error, not an estimate of it.

### The small-structure rule

A structure under 100 mm³ (`SMALL_MM3`) takes no voxel shares from a registered map. Below that volume the median Dice is under 0.4: most of the structure's own voxels hold whatever the map says beside it, not on it.

Such a structure names what the map holds round it instead. `landing.neighbourhood_counts` takes the map's 1 mm voxels within the landing radius of the structure (Euclidean distance from the voxels the structure occupies), and `landing.near` lists every value holding at least 1% of the labelled neighbourhood, largest first. The landing radius is the 90th percentile of the centre miss, rounded up to 0.1 mm. One name means the map agrees everywhere within that distance; several mean a border passes that close, and the map cannot say on which side the structure lies.

The rule applies to [arterial territories](arterial-territories.md) (`territories_near`) and [striatal networks](striatal-networks.md) (`striatal_networks_near`). [Stroke cases](stroke-cases.md) and [published coordinates](published-coordinates.md) report only FreeSurfer's deep structures and cortical parcels, all above the floor. `landing.validate` fails the build if any structure under the floor carries `territories`, `striatal_networks` or `cerebellar_functions`.

The floor and the radius were set after the measurement was seen, from its own classes; they are not a prediction that was then tested.

### A change must beat the record

`scripts/measure_landing.py --record` refuses to replace the record with a result whose 90th-percentile centre miss is larger or whose median Dice is lower. A different registration, or a different person, is adopted only if it lands at least as well by this measurement. The record names the field and both segmentations by checksum, so a changed input has to be measured again.

## Display

**Provenance › Registered group maps** (`registeredMaps`, `web/src/lib/core/panels/provenance.ts`) leads with the benchmark: the number of structures, the median and 90th-percentile centre miss, the median Dice by volume class, and the rule. Each registered map follows with the check its own registration was scored by.

In a region's sheet, a small structure's **Typical arterial supply** (`SupplySection.svelte`) and striatal networks (`NetworkSection.svelte`) list names without bars or percentages, and say whether one value surrounds the structure or a border passes within the radius. Under the arterial colour, a small structure drawn whole takes a territory's colour only when one territory surrounds it (`majorityTerritoryColor`).

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| `scripts/measure_landing.py` on CDMD | reported | 510 structures in both brains; centre miss median 1.16 mm, 90th percentile 2.93 mm; median Dice 0.37; landing radius 3.0 mm |
| Median Dice by volume | reported | under 20 mm³ 0.12 (191 structures); 20–100 mm³ 0.36 (130); 100–500 mm³ 0.53 (83); 500–2,000 mm³ 0.67 (40); above 0.64 (66, held down by cortical parcels and cerebellar layers carried as volumes) |
| `landing.validate` | record's summary recomputes from its rows; no structure under 100 mm³ carries registered shares | holds |
| Small structures named | reported | 345 by arterial territory (82 by one territory, 263 by two to five); 3 by striatal network |
| `tests/test_landing.py` | a structure carried onto itself scores 1 and a shifted one its overlap; uncovered voxels are counted, not painted; classes by volume, an empty class refused; a wider miss or lower overlap is worse; a neighbourhood stops at its radius; slivers under 1% and unlabelled tissue are not named; a small structure with shares fails validation | pass |
| `web/src/lib/core/panels/provenance.test.ts` (`PROV-25`) | the row's text from the published numbers, in both languages | pass |

## Limitations

- The benchmark measures one registration (MNI152NLin2009cAsym, SynthMorph). The arterial atlas, the striatal atlas, the cerebellar atlas and the stroke lesions each use their own SynthMorph registration from another template; none of those templates has fine structures of its own to carry, so their landing on fine structures is not measured. The radius is applied to them as the same method's measured error, and each map's own check is published beside it.
- Dice punishes a small structure for a miss that a large one absorbs: a 1.2 mm miss is most of a 20 mm³ structure's width. The classes describe overlap, not a different registration quality by size.
- A name without shares is weaker than shares, on purpose. It does not say how much of the structure a territory supplies.
- The landing radius covers nine structures in ten. One in ten lands further off than the neighbourhood that was read.
- Cortical parcels carried as volumes overlap at 0.4–0.6; cortical layers reach this brain through surface registration instead ([cortical atlases](cortical-atlases.md)), which this benchmark does not measure.

## Code availability

Source
: [`brain_model/layers/landing.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/landing.py) (carry, score, summary, neighbourhood, rule), [`scripts/measure_landing.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/measure_landing.py) (record), [`web/src/lib/core/panels/provenance.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/panels/provenance.ts) (display)

Reproduce
: ```bash
  uv run python scripts/measure_landing.py            # prints the result beside the record
  uv run python scripts/measure_landing.py --record   # writes data/cdmd/coordinate-landing.json
  uv run pytest tests/test_landing.py
  ```
