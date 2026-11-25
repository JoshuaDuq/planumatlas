# Published coordinates

A coordinate reported in a named Montreal Neurological Institute (MNI) template is carried onto one brain, subject sub_013 of the MGH Connectome Diffusion Microstructure Dataset (CDMD), through that template's registration and marked with a sphere of 5 mm radius (Fig. 1a). Each template was registered to this brain with SynthMorph (FreeSurfer 8.2), and the inverse warp is published as a displacement field on a 1.5 mm grid. The report gives each region's share of the sphere, never a single cortical parcel, because a single-parcel lookup from template space agreed with this brain's own parcellation for only about 60% of template cortex. The landing is a template location on one brain, not that person's activation. On the [MNI template](mni-template.md), which is MNI152NLin2009cAsym itself, a coordinate in that space is placed by the template's scale alone, with no field.

```{figure} figures/published-coordinates-1-light.webp
:alt: Three panels. a, an oblique view of the left side of a brain coloured by Destrieux regions with a small dashed ring and centre dot on the inferior frontal gyrus. b, a coronal cut seen from the front with the same ring on the left hemisphere's cut face. c, the report panel listing the entered coordinate, its landing, and the share of the sphere in each Destrieux region.
:name: fig-published-coordinates-1

**The coordinate (−42, 22, 6) of MNI152NLin2009cAsym is placed on this brain and reported as shares of a sphere.** **a**, [The coordinate](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&coord=-42,22,6&space=mni152nlin2009casym) in the default oblique view, from the left, above and in front. The ring marks the sphere of 5 mm radius and the dot its centre, on the triangular part of the left inferior frontal gyrus. **b**, [Coronal cut at y = 23.4 mm](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&coord=-42,22,6&space=mni152nlin2009casym&cut=coronal&pos=23.4&view=anterior) through the landing, seen from the front (the left hemisphere on the image's right). The cut faces carry the Destrieux labels the sphere is measured against. **c**, The report. The coordinate lands at (−33.4, +23.4, +38.2) mm surface RAS, in cortex. The Destrieux shares of the sphere are 37% for the triangular part of the inferior frontal gyrus (192 mm³), 21% for the opercular part (110 mm³), 6.3% for the vertical ramus of the anterior lateral fissure (33 mm³) and 36% in none of these regions. Subject CDMD `sub_013`; **Atlas** Destrieux; **Colour** **Regions**. Scale bars apply at the depth of the camera's target.
```

## Data

| Input | Version / source | Use |
| :--- | :--- | :--- |
| MNI152NLin2009cAsym T1-weighted image (T1) and brain mask, 1 mm | TemplateFlow, SHA-256 pinned in `config/coordinate-spaces.yaml` ([Fonov et al.](../reference/references.md#group-data-and-templates)) | Published space |
| SPM12 tissue probability maps (TPM; `tpm/TPM.nii`), 1.5 mm | SPM12 r7771, pinned commit ([Ashburner and Friston 2005](../reference/references.md#group-data-and-templates)) | Published space |
| MNI152NLin6Asym, MNI152Lin, 1 mm | TemplateFlow, pinned | Measured only, no field published |
| CDMD `brain.mgz`, `aseg.mgz` (FreeSurfer's automatic segmentation volume, aseg), Schaefer-400 7-network annotations | FreeSurfer 8.2 reconstruction | Registration target and scoring |

The registration script writes each published space's field as the NIfTI `data/<anatomy>/coordinates/<space>-field.nii.gz` and the measurements of all four templates as one report, `data/<anatomy>/coordinate-registration.json`; both are committed. The build writes the field the viewer reads, `public/models/<anatomy>/coordinates-<space>.field`. That file holds gzipped `int16` displacements in hundredths of a millimetre, with `−32768` at nodes outside the brain. In `manifest.json`, `coordinate_spaces` carries `radius_mm`, each field record, the checks, the citation and licence of each space, and the measured offsets of the alternatives.

| Space | Field grid (nodes) | Spacing, origin (template mm) | Decoded (bytes) / gzipped |
| :--- | :--- | :--- | ---: |
| MNI152NLin2009cAsym | $103 \times 128 \times 110$ | 1.5 mm, (−76.5, −112.5, −76.5) | 8,701,440 / 3.29 MB |
| SPM12 (TPM) | $100 \times 126 \times 112$ | 1.5 mm, (−73.5, −109.5, −76.5) | 8,467,200 / 3.22 MB |

## Method

### Template images

Each template's files were downloaded and checked against their SHA-256 checksums. For a T1 template, the brain-masked T1 was the moving image. SPM12 normalises to tissue probability maps, not to a T1, so a T1-like image was built as $0.55\,g + 1.0\,w + 0.15\,f$ from the grey ($g$), white ($w$) and fluid ($f$) classes, with brain where $g + w + f > 0.5$.

### Registration

`mri_synthmorph register -m joint` (FreeSurfer 8.2; joint affine and deformable registration, with forward and inverse warps) registered each skull-stripped template to CDMD `brain.mgz`. The script stops unless the FreeSurfer build stamp equals the anatomy's `freesurfer_build`. SynthMorph ran on the central processing unit (CPU). Its outputs are recorded by checksum and are not expected to reproduce bit for bit.

### Scoring

`mri_synthseg --parc --robust` labelled each template, and `mri_synthmorph apply -m nearest` carried the labels onto aseg's grid. The script then measured four quantities, the first three against CDMD's aseg. Hemisphere agreement is the share of lateralised tissue that lies on its own side. Dice was computed for 14 structures: thalamus, caudate, putamen, pallidum, hippocampus, amygdala and lateral ventricle on each side. Cortex Dice compares the carried cortex with aseg's. The round-trip distance, template → brain → template, was taken at every template brain voxel. An empty structure raises an error rather than scoring not-a-number (NaN), which would pass every limit. The acceptance limits were fixed in the configuration before any template was registered.

### Field sampling

Nodes were laid on a 1.5 mm grid over the template's brain bounding box plus 4 mm. A node is valid within 4 mm (Euclidean, k-d tree) of a brain voxel. The inverse warp was evaluated at the nodes, converted from scanner coordinates to surface RAS (right, anterior, superior), and stored at each valid node as a displacement in units of 0.01 mm. Grid error was measured on 20,000 brain points (random voxels jittered by ±0.5 voxel, seed 0) against the full warp. A 2 mm grid reproduced SPM12's full field with a 95th-percentile (p95) error of 0.1008 mm, above the 0.1 mm limit.

### Unstated template

MNI152NLin6Asym and MNI152Lin were registered and scored the same way. The same numbers read in each were compared with the MNI152NLin2009cAsym reading at that template's cortex and deep grey (offset median, p95, max). At 2,000 points sampled from that cortex (seed 0), the two readings were also compared by the overlap of the Schaefer-400 parcel shares of their 5 mm spheres. The parcels are this brain's own, given to each ribbon voxel from the nearest pial or white-surface vertex. The report records the same comparison against the SPM12 reading, to which no limit is applied. An unstated "MNI" reads as MNI152NLin2009cAsym.

### Placement

A point $\mathbf{p}$ in template millimetres is mapped to node units through the diagonal node affine. It is refused when its cell lies off the grid or any of its eight nodes is `outside`; otherwise

$$\mathbf{p}' = \mathbf{p} + 0.01\,\text{mm}\sum_{n=1}^{8} w_n\,\mathbf{d}_n,$$

with trilinear weights $w_n$ and stored displacements $\mathbf{d}_n$, in the same corner order as the build's `map_points`. The landing is marked by the [lesion](lesion-report.md) sphere at $r = 5$ mm and measured against the same label volumes. Each region's share is of the sphere's volume, and the remainder is reported as "In none of these regions". Network shares gather Schaefer parcels into Yeo 7 networks.

### On the MNI template

The template publishes one affine in place of a field (`coordinate_spaces.native_space`): a point $\mathbf{p}$ in MNI152NLin2009cAsym millimetres lands at $0.9\,\mathbf{p} + (-0.45,\ +15.75,\ -16.65)$ mm in the template's surface RAS (`placeNative`). A landing outside aseg's brain widened by 4 mm, the box from (−71, −87, −91) to (70, 89, 66) mm, is refused. A point in SPM12's space goes through a field registered onto the template as onto CDMD ([MNI template](mni-template.md#its-own-coordinate-space)). The sphere and its shares are then measured on the template's own label volumes.

## Display

**Coordinate**, under **Add** in the stage dock, takes three numbers and a **Template**. The numbers are read in any common print form: "−42, 22, 6", "(−42 22 6)", "[−42;22;6]" or tab-separated, with true minus signs accepted. The templates offered are MNI152NLin2009cAsym, SPM12 (TPM) and **MNI, template not stated**. Talairach is not accepted. On the MNI template only MNI152NLin2009cAsym and **MNI, template not stated** are offered, nothing is downloaded, and the report states that the landing is a location on an average brain.

A field is downloaded once, on first use, and verified by its compressed and decoded SHA-256 checksums. On placement the cut crosshair moves to the landing. The active cut is moved through it or, with none, a coronal cut opens there, and the camera faces the cut (Fig. 1b). Most landings lie in sulci, the insula, the medial wall or beneath the cortex, which the outside of the brain does not show.

The report gives the entry, the landing in surface RAS, the tissue at the landing, and the sphere's shares in each cortical atlas, the Yeo 7 networks, deep grey (aseg) and arterial territories (Fig. 1c). After **Count *n* bundles** is pressed, it adds the streamlines with a point within 5 mm of the landing, counted in the bundles on the sides the sphere reaches. A deep-grey structure is named only when the landing lies in it. For an unstated template the report names the template the coordinate was read as and lists each alternative's measured cortical offset (median and 95th percentile). No function, deficit or clinical finding is attached. **Download CSV** exports the entry, the placement and every share as comma-separated values (CSV).

Placing a coordinate replaces a lesion, which can be restored until the sphere changes. A shared link stores `coord=<x>,<y>,<z>` as entered (each value within ±512) and `space=<id>`. The landing is recomputed on restore, and the link's own cut and camera are kept ([sharing and snapshots](sharing-and-snapshots.md)).

## Validation

| Test | Criterion | MNI152NLin2009cAsym | SPM12 (TPM) |
| :--- | :--- | ---: | ---: |
| Lateralised tissue on its own side | ≥ 98% | 99.8% | 99.8% |
| Deep grey and lateral ventricle Dice, range / median | each ≥ 0.70 / median ≥ 0.80 | 0.877–0.924 / 0.888 | 0.804–0.902 / 0.868 |
| Cerebral cortex Dice | ≥ 0.65 | 0.74 | 0.72 |
| Round trip, median / p95 | ≤ 0.5 / ≤ 1 mm | 0.06 / 0.23 mm | 0.05 / 0.18 mm |
| Published grid against full warp, p95 | ≤ 0.1 mm | 0.057 mm | 0.004 mm |

SPM12's 1.5 mm nodes coincide with the TPM voxel lattice, so its grid error is rounding only.

| Test | Criterion | MNI152NLin6Asym | MNI152Lin |
| :--- | :--- | ---: | ---: |
| Cortex offset from 2009cAsym reading, median / p95 | ≤ 2 / ≤ 5 mm | 1.56 / 3.20 mm | 1.70 / 3.19 mm |
| 5 mm sphere Schaefer-parcel overlap, median | ≥ 0.8 | 0.90 | 0.89 |
| Hemisphere agreement, cortex Dice | as above | 99.8%, 0.74 | 99.8%, 0.71 |

SPM12 read as MNI152NLin2009cAsym landed a median 2.35 mm away, above the 2 mm limit, so it is a separate space. `coordinate_spaces.validate` (run by `brain_model.validate`) re-applies the limits to the committed report and decodes each published field to the committed NIfTI.

| Test | Criterion | Result |
| :--- | :--- | :--- |
| `published-data.test.ts` | Viewer mapping equals `map_points` on 44 points per space | agrees within $10^{-6}$ mm |
| `published-data.test.ts` | Points off the grid or beyond the dilated brain are refused | passes |
| `tests/test_coordinate_spaces.py` | Malformed definitions, failed checks and unsafe fields are refused | passes |
| `tests/test_coordinate_spaces.py`, template; `spaces.test.ts`, template | The MNI template is placed by its scale alone | passes |
| `parse.test.ts`, `field.test.ts`, `spaces.test.ts`, `report.test.ts` | Parsing, refusal, checksums and shares | passes |

The points of `published-data.test.ts` include (0, 0, 0), (−42, 22, 6), (38, −22, 56) and (−24, −4, −20). The viewer refuses 3 points off each grid and 2 beyond the dilated brain.

`tests/test_coordinate_spaces.py` covers the build side. A misparsed or repeated space is refused. A mirrored template fails the checks, and so does a drifting round trip. An empty structure is refused, a distant alternative is not covered by an unstated "MNI", and an `int16` overflow is refused. The grid keeps its margin past the image edge.

For the MNI template, the same file and `spaces.test.ts` check five things. The template's space has 0.9 on its diagonal and no field. MNI (0, 0, 0) lands in an aseg structure within 5 mm of the midline. Every aseg voxel lies inside the bounds. A scale other than the template's own is refused. A coordinate is placed by the scale alone, downloading nothing.

The remaining viewer tests check that the print forms are parsed and anything but three numbers is refused, that one `outside` component refuses a point, that checksums are verified before and after inflation, and that the shares are shares of the sphere.

## Limitations

An unstated "MNI" is read as MNI152NLin2009cAsym. Read as MNI152NLin6Asym or MNI152Lin, the same numbers land a median 1.56 or 1.70 mm away at the cortex.

MNI152NLin6Asym's field is not published, because TemplateFlow publishes no licence for it.

Where a single Schaefer parcel from an MNI-space lookup disagreed with this brain's projection, the miss lay a median 2.2 mm (90th percentile 5.9 mm) from the parcel named.

The landing is a template location carried onto one brain. It is not where this person's peak would be and not what this brain does there. The registrations were measured on CDMD only.

On the MNI template the landing is exact up to the scale, but it lies on an average brain. The template's smoothed folds are nobody's, and coordinates in any other template are not placed on it.

NextBrain fine nuclei were not checked against the carried reading; aseg-level structures were. A separate benchmark carries the template's own NextBrain structures through the MNI152NLin2009cAsym field ([registration landing](registration-landing.md)). The SPM12 field has no such measurement.

Coordinates beyond the template's brain dilated by 4 mm are refused, not extrapolated.

The licences differ by space. MNI152NLin2009cAsym is under the MNI template licence. SPM12 is under GPL-2.0 or later, and its maps derive from IXI (CC BY-SA 3.0) ([licences](../reference/references.md#mni-template-licence-and-gpl-20-published-coordinates)).

## Code availability

Code
: [`scripts/register_coordinate_spaces.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/register_coordinate_spaces.py), [`brain_model/layers/coordinate_spaces.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/coordinate_spaces.py); [`web/src/lib/core/coordinates/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/lib/core/coordinates), [`web/src/lib/controller/coordinates.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/controller/coordinates.ts), [`web/src/features/lesion/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/features/lesion) (`CoordinatePopover.svelte`, `CoordinateReport.svelte`)

Configuration
: [`config/coordinate-spaces.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/coordinate-spaces.yaml): `radius_mm`, `grid_spacing_mm`, `mask_margin_mm`, `acceptance`

Tests
: `tests/test_coordinate_spaces.py`; `coordinate_spaces.validate`, run by `brain_model/validate.py`; `web/src/lib/core/coordinates/*.test.ts`

```bash
# Registers four templates; needs FreeSurfer 8.2 and a licence (--freesurfer, --threads)
uv run python scripts/register_coordinate_spaces.py --anatomy cdmd --record
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_coordinate_spaces.py
npm test --prefix web -- coordinates
```

