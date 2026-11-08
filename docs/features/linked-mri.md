# Linked MRI

Linked MRI shows the subject's own T1-weighted scan in three orthogonal planes around one crosshair shared with the 3D cut. The planes are resampled in the browser from the lossless `orig.mgz` and `aseg.mgz` grids of the FreeSurfer reconstruction, with a contrast window measured per subject and an optional segmentation overlay. Nothing is normalised or sharpened, so grey is proportional to T1 signal; the scan is 1 mm and not intensity-normalised across subjects.

```{figure} figures/linked-mri-1.webp
:alt: Two copies of the linked MRI column: sagittal, coronal and axial T1 planes, each crossed by a cyan crosshair, with the readout, Window and Level sliders and the Segmentation overlay box; in the second copy the box is ticked and grey matter, white matter, ventricles, brainstem and cerebellum are tinted in their FreeSurfer colours.
:name: fig-linked-mri-1

**Three planes resampled around one crosshair, without and with the segmentation overlay.** **a**, Linked MRI opened with <kbd>M</kbd> on a coronal cut at y = −10 mm: sagittal (seen from the right), coronal (from the front, radiological) and axial (from above, neurological) planes through the crosshair at (0, −10, 0) mm surface RAS, which the readout names Brainstem (aseg label 16); published window (level 94, width 188). **b**, The same planes with **Segmentation overlay**: each labelled pixel is $0.55 \times$ grey $+ 0.45 \times$ its FreeSurfer label colour, unlabelled pixels keep their grey. Subject CDMD sub_013; 256 mm field of view sampled at 512 × 512 pixels per plane.
```

## Data

| File | Contents |
| :--- | :--- |
| `mri.volume` | `orig.mgz`, `uint8`, the full $256^3$ grid at 1 mm (16,777,216 bytes decoded); not cropped |
| `aseg.volume` | `aseg.mgz` labels, `<u2`, cropped to $135 \times 141 \times 152$ from corner (62, 39, 43) (5,786,640 bytes decoded) |
| `volumes.json` | `coordinate_system` ("FreeSurfer surface RAS (tkregister), millimeters"), both volume records, the 39 labels present (`name`, `color`), `display` and `limitations` |

Each volume record carries `shape`, `dtype`, `order: "F"`, `compression: "gzip"`, `byte_length`, `sha256` (file), `decoded_sha256` (payload), `voxel_to_surface_ras_mm` and `voxel_spacing_mm`; the cropped record adds `source_shape` and `crop_corner_voxel`. `display` holds `field_of_view_mm` = 256, `texture_size` = 512 and the measured window, level 94 and width 188 on CDMD. The T1 is `orig.mgz`, conformed to $256^3$ at 1 mm but not intensity-normalised.

## Method

### Volume export

1. `export_volumes` loaded `mri/orig.mgz` and `mri/aseg.mgz` and required equal shape, scanner affine and tkregister matrix (`validate_same_grid`); only a conformed volume's own tkregister matrix is surface RAS.
2. The T1 was written whole as `uint8`; the segmentation as `<u2`, cropped to its non-zero voxels with the affine shifted by the crop corner. `encode_array` refuses non-finite data, out-of-range values and any change under the cast. Payloads are Fortran order (x fastest), gzipped with `compresslevel=9` and `mtime=0`, so the bytes are reproducible.
3. Each label present was named and coloured from the FreeSurfer lookup table.

### Default window

The window is measured from the T1 inside every non-zero aseg voxel (`display_window`):

$$h = 2\left\lceil P_{99.9}/2 \right\rceil, \qquad \text{level} = h/2, \qquad \text{width} = h,$$

so the window runs from 0 to an even ceiling $h$. The floor stays at 0 so displayed grey is proportional to T1 signal and surfaces, cut faces and planes show the same tissue at the same grey. The window is per subject because `orig.mgz` carries no common scale: white-matter medians were 144 in CDMD and 221 in the since-retired SNAIL subject. An empty segmentation or $h \le 0$ fails the build.

### Plane resampling

`renderSlice` draws one plane as a $512 \times 512$ image over a 256 mm square, one sample at each pixel centre $\mathbf{p}$:

- **T1.** `Volume.linear`, trilinear over the eight surrounding voxels and 0 outside the grid, mapped through level $c$ and width $w$:
  $$g = \operatorname{clamp}\bigl((T_1(\mathbf{p}) - c + w/2)\,255/w,\ 0,\ 255\bigr).$$
- **Label.** `Volume.label`, the label with the largest summed trilinear weight over the eight voxels (the ANTs genericLabel rule): exact at voxel centres and never a label absent from the eight. It is the CPU twin of the cut faces' `LABEL_AT` ([sections and cuts](sections-and-cuts.md#method)).
- **Overlay.** A labelled pixel is $0.55\,g + 0.45\,\text{colour}$. With a [segmentation agreement](segmentation-agreement.md) shown, one structure is inked instead by category: both segmentations (236, 236, 236), aseg only (235, 70, 210), NextBrain only (255, 150, 30).

Every pixel is then drawn opaque, so voxels no label covers keep their T1 grey.

### Plane frames

Each plane is seen from the side the stage faces the cut (the other side when reversed), with screen-right $\mathbf{u} = \mathbf{v} \times \mathbf{e}$ for screen-up $\mathbf{v}$ and direction to the eye $\mathbf{e}$ (`stagedFrame`). Edge letters follow from $\mathbf{u}$ and $\mathbf{v}$; an axial or coronal panel is labelled neurological when L is at its left edge and radiological when R is. A click inverts the frame to a point (`pointOnPlane`); the crosshair is clamped to ±128 mm.

## Display

**Linked MRI** opens from a region's detail, a function's or deficit's profile, the section bar or the <kbd>M</kbd> key. A function's opens at the anchor of its strongest area, a deficit's at its first finding's first region (the chosen finding's, if one is); the overview of all functions opens where the crosshair is. The crosshair is the cut's: a click on a plane moves the crosshair there, cuts the 3D brain on that plane through the point and selects the smallest shown solid that contains it (`regionAt`); a click on the 3D brain moves the crosshair to the picked surface point. The wheel moves a plane 1 mm a notch; each plane has a 1 mm position slider. **Window** (width 10–256) and **Level** (0–255) apply to the planes and to T1 surface colour alike. The crosshair is drawn at screen resolution in `#4fb6e0` over a `#0e1116` ring; only a plane whose frame, overlay, agreement, paint or window changed is resampled. While a Functions or Deficits paint is shown, each voxel whose label on the cut atlas's own grid is painted takes that colour, opaque over the scan, as the cut faces show it; that grid downloads the first time a paint needs it. The readout gives the RAS position, the region the current cut labels name, the aseg structure and label number, and is announced after 250 ms at rest. **Save PNG** writes the 512-pixel plane with crosshair, edge letters, convention and offset as `<subject>-<plane>-<offset>mm.png`.

On a desktop or tablet the planes dock beside the stage (column 240 px to the width that leaves the stage 360 px; 24 px per arrow key); on a phone or a full-screen stage they open as a modal dialog. URL key: `mri=<level>,<width>`, written only when the window differs from the published one and accepted for level 0–255 and width 1–256.

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| Round trip (`validate_volumes.py`; `test_volumes.py::test_actual_source_round_trip`) | Both volumes decode, match both checksums, and placed by their affines equal `orig.mgz` and `aseg.mgz` voxel for voxel | passes |
| Grid registration (`test_volumes.py`) | A differing shape, scanner affine or tkregister matrix fails before writing | passes |
| Window ceiling (`test_volumes.py`) | Fewer than 0.5% of segmented T1 voxels at or above the ceiling | passes |
| Window floor (`test_volumes.py`) | $\text{level} - \text{width}/2 = 0$ | passes |
| Per-subject window (`test_volumes.py`) | CDMD and `fsaverage` windows differ | passes |
| Sampling (`sampling.test.ts`, `volume.test.ts`) | Grey is the windowed T1 clamped to 0–255; overlay blends 0.55/0.45; labels never invented; voxel centres keep their label | passes |
| GPU–CPU labels (`label-sampling.svelte.test.ts`) | `labelAt` names the label `Volume.label` names | passes |
| Paint (`sampling.test.ts`, `sections.test.ts`) | A painted label is drawn in its colour over the scan; the label grid loads only once the planes have, and a failed load is reported once | passes |
| Frames and clicks (`coordinates.test.ts`, `mpr-draw.test.ts`) | A click's point marks the crosshair at that click; the coronal panel faced from the front puts the subject's right on the left | passes |

## Limitations

- One individual's 1 mm MRI and segmentation, not the viewer's anatomy.
- Trilinear interpolation does not increase source resolution.
- The scan is not intensity-normalised; grey levels do not compare across subjects.
- The overlay is aseg, whatever atlas the stage shows; cortical surface atlases are not extended into the volume. A paint is drawn by the cut atlas's own label grid instead.
- `volumes.json` describes the segmentation as sampled by nearest neighbour; the viewer samples it by largest trilinear weight.
- Hidden or isolated regions do not change the planes.
- Agreement is not accuracy: neither segmentation is the reference.

## Code availability

| | |
| :--- | :--- |
| Code | [`brain_model/labels/volumes.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/labels/volumes.py), [`brain_model/validate_volumes.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/validate_volumes.py); [`web/src/lib/engine/slices/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/lib/engine/slices), [`web/src/features/sections/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/features/sections) |
| Configuration | [`config/model.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/model.yaml): `sections.field_of_view_mm`, `sections.texture_size` (the window is measured, not configured) |
| Tests | `tests/test_volumes.py`; `web/src/lib/engine/slices/*.test.ts`, `web/src/features/sections/mpr-*.test.ts`, `web/src/lib/engine/tissues/label-sampling.svelte.test.ts` |

```bash
uv run python -m brain_model.labels.volumes
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_volumes.py
npm test --prefix web -- slices sections
```

Figure state (Fig. 1a, then <kbd>M</kbd>): https://planumatlas.com/#anatomy=cdmd&atlas=destrieux&colors=atlas&cut=coronal&pos=-10
