# Published coordinates

A coordinate from a paper, given in millimetres of a named MNI template, is carried onto CDMD by that template's registered warp and marked with a 5 mm sphere whose report gives the regions it overlaps, never one cortical parcel.

:::{list-table}
:widths: 22 78
:stub-columns: 1

* - Where in the viewer
  - **Coordinate** in the stage dock: a field for the numbers, a **Template** choice, **Place**; the report is Anatomy's detail
* - Built by
  - [`scripts/register_coordinate_spaces.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/register_coordinate_spaces.py), [`brain_model/layers/coordinate_spaces.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/coordinate_spaces.py); viewer: [`web/src/lib/core/coordinates/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/lib/core/coordinates) (`parse.ts`, `spaces.ts`, `field.ts`, `report.ts`), [`web/src/lib/controller/coordinates.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/controller/coordinates.ts), [`web/src/features/lesion/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/features/lesion) (`CoordinatePopover.svelte`, `CoordinateReport.svelte`)
* - Configuration
  - [`config/coordinate-spaces.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/coordinate-spaces.yaml)
* - Source data
  - MNI152NLin2009cAsym (TemplateFlow, MNI template licence), SPM12 tissue probability maps (SPM12 7771, GPL-2.0 or later, derived from IXI, CC BY-SA 3.0); MNI152NLin6Asym and MNI152Lin registered only for measurement; CDMD's `brain.mgz`, `aseg.mgz`, Schaefer annotations
* - Checked by
  - `coordinate_spaces.validate` in `brain_model/validate.py`; `tests/test_coordinate_spaces.py`; `web/src/lib/core/coordinates/*.test.ts`, including `published-data.test.ts` against `published-reference.json`
:::

## What it does

The **Coordinate** tool takes three numbers as a paper prints them, in a named template, and places a sphere of 5 mm radius where that template location falls on this brain. The same sphere is the Lesion tool's: placing either replaces the other, and a lesion a coordinate replaced can be put back until the sphere changes again.

- **Entry.** `parseCoordinate` accepts "-42, 22, 6", "(-42 22 6)", "[-42;22;6]", tab-separated and a true minus sign (−); it returns null unless the text holds exactly three numbers.
- **Template.** The choice is MNI152NLin2009cAsym, SPM12 (TPM), or **MNI, template not stated**. An unstated "MNI" reads as MNI152NLin2009cAsym; the report then shows how far the same numbers land if read as each other MNI152 template. Talairach and other spaces are not accepted.
- **Placing.** The point is carried by the template's field. A coordinate beyond the template's brain (its brain dilated by 4 mm) is refused with a message, not extrapolated. When placed, the cut crosshair goes to the sphere, the camera faces the cut it lies on or, with no cut, the side of the brain it lies in (the marking is drawn through the brain, so seen from the other side it would sit on the wrong hemisphere), and the report opens as Anatomy's detail.
- **Report.** What was entered and in which template, where it lands on this brain (surface RAS), the tissue at that point, and shares of the sphere in each region of each cortical atlas (largest first, under 1% folded away, and the share in none of them), Yeo 7 networks from Schaefer's parcels, deep grey (aseg) and arterial territories, then **Tracts passing within 5 mm** (streamlines with a point within the radius; passing near is not a connection to the coordinate). **Download CSV** exports what was entered, how it was placed, and every share of the sphere.
- **No functions.** A published coordinate is usually an activation peak; the report attaches no functions, deficits or clinical findings to it. A deep grey structure is named only when the landing point lies in it.

## Data

Written by the build under `public/models/<anatomy>/`, and the registration report under `data/<anatomy>/`:

| File | Contents |
| :--- | :--- |
| `coordinates-<space>.field` | Gzipped `int16` displacement field, template millimetres to surface RAS, for each published space (`mni152nlin2009casym`, `spm12`) |
| `manifest.json` → `coordinate_spaces` | `radius_mm`, each space's field record, its citation, licence and copyright, its registration checks, the `unstated` block (`reads_as`, the alternatives and their measured offsets), and the `method` text |
| `data/<anatomy>/coordinates/<space>-field.nii.gz` | The committed field as NIfTI, recorded by checksum in `data/sources.json` |
| `data/<anatomy>/coordinate-registration.json` | The registration report: per space `checks`, `grid_error_mm`, `field_sha256`; per alternative `checks` and `against` |

A field record carries `shape`, `components: 3`, `dtype: "<i2"`, `order: "F"`, `interleaved: true`, `compression: "gzip"`, `byte_length`, `sha256`, `decoded_sha256`, `node_to_template_mm` (a diagonal affine), `unit_mm: 0.01` and `outside: -32768`. On CDMD:

| Space | Grid (nodes) | Spacing | Decoded size |
| :--- | :--- | :--- | ---: |
| MNI152NLin2009cAsym | $103 \times 128 \times 110$ | 1.5 mm, origin (−76.5, −112.5, −76.5) | 8,701,440 bytes |
| SPM12 (TPM) | $100 \times 126 \times 112$ | 1.5 mm, origin (−73.5, −109.5, −76.5) | 8,467,200 bytes |

The published files are 3.29 MB and 3.22 MB gzipped. Displacements are stored in hundredths of a millimetre; a node outside the template's brain carries `−32768` in all three components. `encode_field` refuses a displacement beyond the `int16` range.

## How it was built

All steps are in `scripts/register_coordinate_spaces.py`, with the parameters in `config/coordinate-spaces.yaml`. The acceptance limits were set before any template was registered.

1. **Fetch and pin.** Each template's files are downloaded from TemplateFlow (or, for SPM12, from SPM's repository at a pinned commit) into `data/cache/coordinate-spaces/<id>/` and checked against the SHA-256 in the config; a mismatch exits. `read_definition` refuses an entry with a missing or stray key (such as a value cut at a comma in a flow mapping), a repeated id, or a file without a path and a 64-hex digest.
2. **Prepare the images.** For a T1 template the brain mask must be on the template's grid and affine; the template is the readable image, and the same image masked to the brain is the moving image. SPM12's unified segmentation normalises to its tissue probability maps, not a T1, so a T1-like image is built from the grey, white and fluid classes as $0.55\,g + 1.0\,w + 0.15\,f$ (`TISSUE_CONTRAST`), with the brain where the three classes sum to more than 0.5.
3. **Register.** `mri_synthmorph register -m joint` (FreeSurfer 8.2: joint affine and deformable, `-t` forward, `-T` inverse) registers the skull-stripped template to the anatomy's `brain.mgz`. The build checks the FreeSurfer build stamp against the anatomy's `freesurfer_build`. SynthMorph runs on the CPU here, so its output is recorded by checksum rather than expected to reproduce bit for bit.
4. **Read the template's own anatomy.** `mri_synthseg --parc --robust` labels the template (aseg labels plus the Desikan-Killiany cortex at 1000 and 2000), resampled nearest-neighbour onto the template's grid, then carried onto aseg's grid with `mri_synthmorph apply -m nearest`. The output must be on aseg's grid, or the script exits, since anything else would scramble the labels.
5. **Score the registration** (`coordinate_spaces.checks`): hemisphere agreement of lateralised tissue; Dice of 14 subcortical structures (thalamus, caudate, putamen, pallidum, hippocampus, amygdala and lateral ventricle, each side) between the carried reading and CDMD's aseg; cortex Dice; and the round trip, the distance of every template brain voxel after template → brain → template through the forward and inverse fields. An empty structure on either side raises an error, since it would score NaN and pass every limit.
6. **Write the field.** `grid_nodes` lays a grid at `grid_spacing_mm` = 1.5 mm over the template's brain bounding box plus `mask_margin_mm` = 4 mm, and marks a node valid when it lies within 4 mm (Euclidean, by k-d tree, so a brain touching its image's edge as SPM12's does still has every cell's far corner covered) of a brain voxel. The inverse warp is evaluated at each node, converted from scanner RAS to surface RAS (`aseg` tkregister times the inverse scanner affine), stored as displacement from the node in hundredths of a millimetre, and `outside` where not valid. The spacing is 1.5 mm because 2 mm reproduced SPM12's full field with a p95 error of 0.1008 mm, past the 0.1 mm limit (comment in `config/coordinate-spaces.yaml`).
7. **Measure the grid.** 20,000 points anywhere in the template's brain (random voxels jittered by ±0.5 voxel, seed 0) are mapped through `map_points` (trilinear between nodes, NaN where any of the eight nodes is outside) and compared with the full inverse warp; any unmapped brain point exits.
8. **Measure the alternatives.** MNI152NLin6Asym and MNI152Lin are registered and scored the same way, and the same numbers are read as each published template at the first published template's own cortex (voxels labelled cortex or DK cortex) and deep grey. For each, the cortex and subcortical offsets (median, p95, max) are measured, and for cortex the overlap of the 5 mm spheres' shares of this brain's Schaefer-400 parcels (2,000 sampled points, seed 0). These alternatives publish no field.
9. **Accept** (`coordinate_spaces.accept`) against the limits below, write `coordinate-registration.json`, and with `--record` register the fields and the report in `data/sources.json`.

`coordinate_spaces.export` then re-checks the report against the config, checks each field's checksum against the one measured, and writes `coordinates-<space>.field` as the `int16` payload with components moved to the front axis (so a node's three components are interleaved, x fastest) and gzipped with `compresslevel=9`, `mtime=0`. The manifest records each space's checks, and the `unstated` block holds each alternative's offsets against each published space.

## How the viewer uses it

- **Loading.** `createCoordinateSpaces` takes the manifest block and downloads each template's field once, the first time a coordinate in it is placed; `loadField` checks the compressed checksum, then the decoded length and checksum, decompresses, and builds a `Field`. A failed download is dropped from the cache so a retry downloads again. The constructor refuses a non-positive radius, repeated or `unstated` ids, an `unstated.reads_as` that is not published, and an alternative not measured against it.
- **Mapping.** `createField.map` converts the point to node units through the diagonal affine and returns null if the cell's base node is outside the grid, or if any of its eight nodes carries `outside`; otherwise it interpolates trilinearly and adds the displacement (times 0.01 mm) to the point. It is the same arithmetic, in the same corner order, as `map_points` in the build.
- **Placing.** `createCoordinatePlacement.place` maps the point, asks the lesion store to mark the sphere at its landing with `radius_mm` (5), sets the cut's crosshair there and frames the camera. Entered numbers travel in the link unrounded, as `coord=x,y,z` with `space=<id>` (each number within ±512); the landing is not stored but found again on restore, and a link whose coordinate cannot be mapped reports `coord` and `space` as not applied ([sharing and snapshots](sharing-and-snapshots.md)).
- **Measuring.** The sphere is measured as a lesion is, against the same label volumes ([lesion report](lesion-report.md)). `sphereShares` expresses each region's overlap as a share of the **sphere's** volume (not of the region), with the share no row covers reported as "In none of these regions"; `networkShares` gathers a cortical atlas's regions into the networks each is assigned to, weighted by each region's network fractions.

## Checks

The limits were set before any template was registered. Values on CDMD:

| Check | Limit | MNI152NLin2009cAsym | SPM12 (TPM) |
| :--- | :--- | :--- | :--- |
| Lateralised tissue on its own side | ≥ 98% | 99.8% | 99.8% |
| Deep grey and lateral ventricle Dice, each / median | ≥ 0.70 / ≥ 0.80 | 0.877–0.924 / 0.888 | 0.804–0.902 / 0.868 |
| Cerebral cortex Dice | ≥ 0.65 | 0.74 | 0.72 |
| Template → CDMD → template, median / p95 | ≤ 0.5 / ≤ 1 mm | 0.06 / 0.23 mm | 0.05 / 0.18 mm |
| Shipped grid against the full field, p95 | ≤ 0.1 mm | 0.057 mm | 0.004 mm |

SPM12's 1.5 mm grid falls on the maps' own voxels, which is why its grid error is only rounding. For a template that is not stated, each alternative must land near the first published reading:

| Check | Limit | MNI152NLin6Asym | MNI152Lin |
| :--- | :--- | :--- | :--- |
| Cortex offset from 2009cAsym, median / p95 | ≤ 2 / ≤ 5 mm | 1.56 / 3.20 mm | 1.70 / 3.19 mm |
| 5 mm sphere overlap of Schaefer parcels, median | ≥ 0.8 | 0.90 | 0.89 |
| Registration (hemisphere, cortex Dice) | as above | 99.8%, 0.74 | 99.8%, 0.71 |

Both alternatives also passed the registration limits. SPM12 read as 2009cAsym landed a median 2.35 mm away, past the 2 mm limit, so it is a space of its own rather than covered by "not stated". `coordinate_spaces.validate` re-runs `accept` on the committed report, requires the manifest's block to equal what the definition and report give, and decodes each published field to the committed NIfTI. In the viewer, the field decoder is compared with `map_points` on 44 points per space (including MNI (0, 0, 0), (−42, 22, 6), (38, −22, 56) and (−24, −4, −20)) and refusals at three points beyond each grid and two inside it but past the template's dilated brain, which agree to the reference's own rounding.

## Limits

- **Template not stated.** An unstated "MNI" reads as MNI152NLin2009cAsym. FSL's MNI152NLin6Asym and the MNI152Lin of SPM96 to SPM8 were registered the same way and passed every check. Read as either, the same numbers at 2009cAsym's cortex land a median 1.56 / 1.70 mm (p95 3.2 / 3.2 mm) from the 2009cAsym reading, and their 5 mm neighbourhoods share 0.90 / 0.89 of their Schaefer parcels; the report shows these offsets. SPM12 landed a median 2.35 mm away, past the 2 mm limit, so it is a space of its own. MNI152NLin6Asym's field is not published: TemplateFlow publishes no licence for it. Talairach and other spaces are refused.
- **Neighbourhood, not a parcel.** At 2009cAsym's cortex, 28% of points land outside CDMD's cortical ribbon. Where they land in it, a single Schaefer-400 parcel agreed between an MNI-space lookup and CDMD's own projection 61% of the time (network 83%), and a miss lay a median 2.2 mm (90%: 5.9 mm) from the parcel it named. The report therefore gives each region's share of the 5 mm sphere, never one cortical parcel; it names a deep grey structure only when the landing point lies in it.
- **No functions.** A published coordinate is usually an activation peak; the report attaches no functions, deficits or clinical findings to it.
- **A template location, not this person's.** A template location carried onto one brain, not where this person's own peak would be and not what this brain does there. Measured on CDMD only.
- **Fine nuclei not measured.** NextBrain's fine nuclei were not checked against the carried reading; aseg-level subcortical labels were.
- **Licences.** MNI152NLin2009cAsym is distributed under the MNI template licence; SPM12's maps under GPL-2.0 or later, derived from IXI data (CC BY-SA 3.0).
- Coordinates are limited to ±512 mm in a link, and refused beyond the template's brain dilated by 4 mm.

## Reproduce

```bash
# Registers the four templates (about 7 minutes and 7.5 GB each); needs FreeSurfer 8.2 and a licence
uv run python scripts/register_coordinate_spaces.py --anatomy cdmd
uv run python scripts/register_coordinate_spaces.py --anatomy cdmd --record   # also registers the files in data/sources.json

uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_coordinate_spaces.py
npm test --prefix web -- coordinates
```

The script takes `--freesurfer` (default `$FREESURFER_HOME` or `/Applications/freesurfer/8.2.0`) and `--threads` (default 8 or the CPU count). It refuses an anatomy that does not declare the `coordinate_spaces` layer, a FreeSurfer build that differs from the anatomy's `freesurfer_build`, and a non-whole-millimetre radius (the overlap measurement works on aseg's 1 mm grid).

## See also

- [Lesion report](lesion-report.md): the sphere's measurement, shared with a coordinate's report
- [Cortical atlases](cortical-atlases.md): the Schaefer parcels the neighbourhood is expressed in
- [Sharing and snapshots](sharing-and-snapshots.md): the `coord` and `space` link fields
- [Arterial territories](arterial-territories.md), [Striatal networks](striatal-networks.md), [Cerebellar functions](cerebellar-functions.md): the other SynthMorph registrations
- [Building](../pipeline/building.md), [Validation](../pipeline/validation.md)
