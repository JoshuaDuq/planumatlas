# Published coordinates

A coordinate reported in a named Montreal Neurological Institute (MNI) template is carried onto CDMD sub_013 through that template's registration and marked with a 5 mm sphere. The report gives each region's share of the sphere, never a single cortical parcel, because a single-parcel lookup from template space agreed with this brain's own parcellation for only about 60% of template cortex. The landing is a template location on one brain, not that person's activation.

```{figure} figures/published-coordinates-1.webp
:alt: Top left, an oblique view of the left side of a brain coloured by Destrieux regions with a small dashed ring and centre dot on the inferior frontal gyrus. Bottom left, a coronal section seen from the front with the same ring on the left hemisphere's cut face. Right, the report panel listing the entered coordinate, its landing, and the share of the sphere in each Destrieux region.
:name: fig-published-coordinates-1

**MNI152NLin2009cAsym (−42, 22, 6) placed on this brain.** **a**, The default oblique view (from the left, above and in front); the ring marks the 5 mm sphere and the dot its centre, on the triangular part of the left inferior frontal gyrus. **b**, Coronal section at y = +23.4 mm through the landing, seen from the front (left hemisphere on the image's right); the cut faces carry the Destrieux labels the sphere is measured against. **c**, The report: landing (−33.4, +23.4, +38.2) mm surface RAS, in cortex; Destrieux shares of the sphere: triangular part of the inferior frontal gyrus 37% (192 mm³), opercular part 21% (110 mm³), vertical ramus of the anterior lateral fissure 6.3% (33 mm³), in none of these regions 36%. Subject CDMD sub_013; **Atlas** Destrieux; **Colour** Regions.
```

## Data

| Input | Version / source | Use |
| :--- | :--- | :--- |
| MNI152NLin2009cAsym T1 and brain mask, 1 mm | TemplateFlow, SHA-256 pinned in `config/coordinate-spaces.yaml` ([Fonov et al.](../reference/references.md#group-data-and-templates)) | Published space |
| SPM12 tissue probability maps (`tpm/TPM.nii`), 1.5 mm | SPM12 r7771, pinned commit ([Ashburner and Friston 2005](../reference/references.md#group-data-and-templates)) | Published space |
| MNI152NLin6Asym, MNI152Lin, 1 mm | TemplateFlow, pinned | Measured only, no field published |
| CDMD `brain.mgz`, `aseg.mgz`, Schaefer-400 7-network annotations | FreeSurfer 8.2 reconstruction | Registration target and scoring |

The build writes, per published space, `public/models/<anatomy>/coordinates-<space>.field` (gzipped `int16` displacements, hundredths of a millimetre, `−32768` outside the brain), the committed NIfTI `data/<anatomy>/coordinates/<space>-field.nii.gz`, and `data/<anatomy>/coordinate-registration.json`; `manifest.json` → `coordinate_spaces` carries `radius_mm`, each field record, checks, citation, licence and the measured offsets of the alternatives.

| Space | Field grid (nodes) | Spacing, origin (template mm) | Decoded / gzipped |
| :--- | :--- | :--- | ---: |
| MNI152NLin2009cAsym | $103 \times 128 \times 110$ | 1.5 mm, (−76.5, −112.5, −76.5) | 8,701,440 B / 3.29 MB |
| SPM12 (TPM) | $100 \times 126 \times 112$ | 1.5 mm, (−73.5, −109.5, −76.5) | 8,467,200 B / 3.22 MB |

## Method

### Template images
Each template's files were downloaded and checked against their SHA-256. For a T1 template the brain-masked T1 is the moving image. SPM12 normalises to tissue probability maps, not a T1, so a T1-like image was built as $0.55\,g + 1.0\,w + 0.15\,f$ from the grey, white and fluid classes, with brain where $g + w + f > 0.5$.

### Registration
`mri_synthmorph register -m joint` (FreeSurfer 8.2; joint affine and deformable, forward and inverse warps) registered each skull-stripped template to CDMD `brain.mgz`. The FreeSurfer build stamp must equal the anatomy's `freesurfer_build`. SynthMorph ran on the CPU; its outputs are recorded by checksum.

### Scoring
`mri_synthseg --parc --robust` labelled each template; the labels were carried onto aseg's grid with `mri_synthmorph apply -m nearest`. Against CDMD's aseg the build measured: hemisphere agreement of lateralised tissue; Dice of 14 structures (thalamus, caudate, putamen, pallidum, hippocampus, amygdala, lateral ventricle, each side); cortex Dice; and the template → brain → template round-trip distance of every template brain voxel. An empty structure raises an error rather than scoring NaN. Acceptance limits were fixed in the configuration before any template was registered.

### Field sampling
Nodes were laid on a 1.5 mm grid over the template's brain bounding box plus 4 mm; a node is valid within 4 mm (Euclidean, k-d tree) of a brain voxel. The inverse warp was evaluated at each valid node, converted from scanner to surface RAS, and stored as a displacement in units of 0.01 mm. A 2 mm grid reproduced SPM12's full field with p95 error 0.1008 mm, above the 0.1 mm limit. Grid error was measured on 20,000 brain points (random voxels jittered ±0.5 voxel, seed 0) against the full warp.

### Unstated template
MNI152NLin6Asym and MNI152Lin were registered and scored the same way. The same numbers read in each were compared with the MNI152NLin2009cAsym reading at that template's cortex and deep grey (offset median, p95, max) and by the overlap of 5 mm spheres' Schaefer-400 parcel shares (2,000 points, seed 0). An unstated "MNI" reads as MNI152NLin2009cAsym.

### Placement
A point $\mathbf{p}$ in template mm is mapped to node units through the diagonal node affine. It is refused when its cell lies off the grid or any of its eight nodes is `outside`; otherwise

$$\mathbf{p}' = \mathbf{p} + 0.01\,\text{mm}\sum_{n=1}^{8} w_n\,\mathbf{d}_n,$$

with trilinear weights $w_n$ and stored displacements $\mathbf{d}_n$, in the same corner order as the build's `map_points`. The landing is marked by the [lesion](lesion-report.md) sphere at $r = 5$ mm and measured against the same label volumes. Each region's share is of the sphere's volume; the remainder is reported as "In none of these regions". Network shares gather Schaefer parcels into Yeo 7 networks.

## Display
**Coordinate** in the stage dock takes three numbers in any common print form ("−42, 22, 6", "(−42 22 6)", "[−42;22;6]", tab-separated; true minus signs accepted) and a **Template**: MNI152NLin2009cAsym, SPM12 (TPM), or **MNI, template not stated**. Talairach is not accepted. A field is downloaded once, verified by compressed and decoded SHA-256, on first use. On placement the cut crosshair moves to the landing; the camera faces the active cut, or the lateral view of the landing's hemisphere when $\lvert x\rvert \ge 5$ mm. The report gives the entry, landing (surface RAS), tissue at the landing, shares in each cortical atlas, Yeo 7 networks, deep grey (aseg) and arterial territories, and streamlines with a point within 5 mm. A deep-grey structure is named only when the landing lies in it. No function, deficit or clinical finding is attached. **Download CSV** exports the entry, placement and every share. Placing a coordinate replaces a lesion, which can be restored until the sphere changes. URL state: `coord=<x>,<y>,<z>` as entered (each within ±512) and `space=<id>`; the landing is recomputed on restore, and the link's own cut and camera are kept ([sharing and snapshots](sharing-and-snapshots.md)).

## Validation

| Test | Criterion | MNI152NLin2009cAsym | SPM12 (TPM) |
| :--- | :--- | :--- | :--- |
| Lateralised tissue on its own side | ≥ 98% | 99.8% | 99.8% |
| Deep grey and lateral ventricle Dice, range / median | each ≥ 0.70 / median ≥ 0.80 | 0.877–0.924 / 0.888 | 0.804–0.902 / 0.868 |
| Cerebral cortex Dice | ≥ 0.65 | 0.74 | 0.72 |
| Round trip, median / p95 | ≤ 0.5 / ≤ 1 mm | 0.06 / 0.23 mm | 0.05 / 0.18 mm |
| Published grid against full warp, p95 | ≤ 0.1 mm | 0.057 mm | 0.004 mm |

SPM12's 1.5 mm nodes coincide with the TPM voxel lattice, so its grid error is rounding only.

| Test | Criterion | MNI152NLin6Asym | MNI152Lin |
| :--- | :--- | :--- | :--- |
| Cortex offset from 2009cAsym reading, median / p95 | ≤ 2 / ≤ 5 mm | 1.56 / 3.20 mm | 1.70 / 3.19 mm |
| 5 mm sphere Schaefer-parcel overlap, median | ≥ 0.8 | 0.90 | 0.89 |
| Hemisphere agreement, cortex Dice | as above | 99.8%, 0.74 | 99.8%, 0.71 |

SPM12 read as MNI152NLin2009cAsym landed a median 2.35 mm away, above the 2 mm limit, so it is a separate space. `coordinate_spaces.validate` (run by `brain_model.validate`) re-applies the limits to the committed report and decodes each published field to the committed NIfTI.

| Test | Criterion | Result |
| :--- | :--- | :--- |
| `published-data.test.ts` | Viewer mapping equals `map_points` on 44 points per space, including (0, 0, 0), (−42, 22, 6), (38, −22, 56), (−24, −4, −20); refuses 3 points off each grid and 2 beyond the dilated brain | agrees within $10^{-6}$ mm |
| `tests/test_coordinate_spaces.py` | Misparsed or repeated space refused; mirrored template fails the checks; drifting round trip fails; empty structure refused; distant alternative not covered; `int16` overflow refused; grid margin past the image edge | passes |
| `parse.test.ts`, `field.test.ts`, `spaces.test.ts`, `report.test.ts` | Print forms parsed, anything but three numbers refused; one `outside` component refuses; checksums before and after inflation; shares of the sphere | passes |

## Limitations
- An unstated "MNI" is read as MNI152NLin2009cAsym; read as MNI152NLin6Asym or MNI152Lin the same numbers land a median 1.56 or 1.70 mm away at the cortex.
- MNI152NLin6Asym's field is not published: TemplateFlow publishes no licence for it.
- Where a single Schaefer parcel from an MNI-space lookup disagreed with this brain's projection, the miss lay a median 2.2 mm (90th percentile 5.9 mm) from the parcel named.
- A template location carried onto one brain; not where this person's peak would be and not what this brain does there. Measured on CDMD only.
- NextBrain fine nuclei were not checked against the carried reading; aseg-level structures were.
- Coordinates beyond the template's brain dilated by 4 mm are refused, not extrapolated.
- Licences: MNI template licence; SPM12 GPL-2.0 or later, maps derived from IXI (CC BY-SA 3.0) ([licences](../reference/references.md#mni-template-licence-and-gpl-20-published-coordinates)).

## Code availability

| | |
| :--- | :--- |
| Code | [`scripts/register_coordinate_spaces.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/register_coordinate_spaces.py), [`brain_model/layers/coordinate_spaces.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/coordinate_spaces.py); [`web/src/lib/core/coordinates/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/lib/core/coordinates), [`web/src/lib/controller/coordinates.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/controller/coordinates.ts), [`web/src/features/lesion/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/features/lesion) (`CoordinatePopover.svelte`, `CoordinateReport.svelte`) |
| Configuration | [`config/coordinate-spaces.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/coordinate-spaces.yaml): `radius_mm`, `grid_spacing_mm`, `mask_margin_mm`, `acceptance` |
| Tests | `tests/test_coordinate_spaces.py`; `coordinate_spaces.validate` in `brain_model/validate.py`; `web/src/lib/core/coordinates/*.test.ts` |

```bash
# Registers four templates; needs FreeSurfer 8.2 and a licence (--freesurfer, --threads)
uv run python scripts/register_coordinate_spaces.py --anatomy cdmd --record
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_coordinate_spaces.py
npm test --prefix web -- coordinates
```

Figure state (Fig. 1a, c): https://planumatlas.com/#anatomy=cdmd&coord=-42,22,6&space=mni152nlin2009casym; (Fig. 1b): https://planumatlas.com/#anatomy=cdmd&coord=-42,22,6&space=mni152nlin2009casym&cut=coronal&pos=23.4
