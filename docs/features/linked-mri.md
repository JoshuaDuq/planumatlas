# Linked MRI

Linked MRI shows the subject's own T1-weighted (T1) magnetic resonance imaging (MRI) scan in three orthogonal planes around one crosshair shared with the 3D cut (Fig. 1a). The planes, or eleven serial sections of one of them, are resampled in the browser from the lossless `orig.mgz` and `aseg.mgz` grids of the FreeSurfer reconstruction, with a contrast window measured per subject and an optional segmentation overlay (Fig. 1b). Nothing is normalised or sharpened, so grey is proportional to T1 signal. The scan is on a 1 mm grid and is not intensity-normalised across subjects. On the [MNI template](mni-template.md) the planes show the template's own T1, an average of 152 people's scans.

```{figure} figures/linked-mri-1-light.webp
:alt: Two copies of the Linked MRI sections panel. Each holds, below the Three planes and Serial sections choice, a sagittal, a coronal and an axial T1 plane crossed by a cyan crosshair, the position sliders, the readout, the Window, Level and FA opacity sliders, the Overlay choice and the Crosshair switch. In the second copy Overlay is set to Segmentation and grey matter, white matter, ventricles, brainstem and cerebellum are tinted in their FreeSurfer colours.
:name: fig-linked-mri-1

**Three planes are resampled around one crosshair, without and with the segmentation overlay.** **a**, **Linked MRI** opened on a [coronal cut at y = −10 mm](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&cut=coronal&pos=-10&view=anterior), showing **Three planes**. The sagittal plane is seen from the right, the coronal plane from the front in the radiological convention and the axial plane from above in the neurological convention. The crosshair is at (0, −10, 0) mm surface RAS, which the readout names Brainstem (aseg label 16), under the published window (level 94, width 188). **b**, The same planes with **Overlay** set to **Segmentation**. Each labelled pixel is $0.55 \times$ grey $+ 0.45 \times$ its FreeSurfer label colour, and unlabelled pixels keep their grey. Subject CDMD `sub_013`. Each plane spans a 256 mm field of view sampled at 512 × 512 pixels.
```

## Data

| File | Contents |
| :--- | :--- |
| `mri.volume` | `orig.mgz`, `uint8`, the full $256^3$ grid at 1 mm (16,777,216 bytes decoded); not cropped |
| `aseg.volume` | `aseg.mgz` labels, `<u2`, cropped to $135 \times 141 \times 152$ from corner (62, 39, 43) (5,786,640 bytes decoded) |
| `volumes.json` | `coordinate_system` ("FreeSurfer surface RAS (tkregister), millimeters"), both volume records, the 39 labels present (`name`, `color`), `display` and `limitations` |
| `fa.nii.gz` ([tracts](tracts.md#data); MGH Connectome Diffusion Microstructure Dataset (CDMD) only) | Fractional anisotropy (FA) on the diffusion T1's grid, placed in surface RAS (right, anterior, superior) by `surface-space.json`; downloaded the first time **FA opacity** leaves 0 |

Each volume record carries `shape`, `dtype`, `order: "F"`, `compression: "gzip"`, `byte_length`, `sha256` (file), `decoded_sha256` (payload), `voxel_to_surface_ras_mm` and `voxel_spacing_mm`. The cropped record adds `source_shape` and `crop_corner_voxel`. `display` holds `field_of_view_mm` = 256, `texture_size` = 512 and the measured window (`window_center`, `window_width`), level 94 and width 188 on CDMD. The T1 is `orig.mgz`, conformed to $256^3$ at 1 mm but not intensity-normalised.

## Method

### Volume export

1. `export_volumes` loaded `mri/orig.mgz` and `mri/aseg.mgz` and required equal shape, scanner affine and tkregister matrix (`validate_same_grid`), because only a conformed volume's own tkregister matrix is surface RAS.
2. The T1 was written whole as `uint8`. The segmentation was written as `<u2`, cropped to its non-zero voxels, with the affine shifted by the crop corner. `encode_array` refuses non-finite data, out-of-range values and any change under the cast. Payloads are in Fortran order (x fastest) and gzipped with `compresslevel=9` and `mtime=0`, so the bytes are reproducible.
3. Each label present was named and coloured from the FreeSurfer lookup table.

### Default window

The window was measured from the T1 inside every non-zero voxel of FreeSurfer's subcortical segmentation, aseg (`display_window`). With $P_{99.9}$ the 99.9th percentile of that signal,

$$h = 2\left\lceil P_{99.9}/2 \right\rceil, \qquad \text{level} = h/2, \qquad \text{width} = h,$$

so the window runs from 0 to an even ceiling $h$. The floor stays at 0 so that displayed grey is proportional to T1 signal, and so that surfaces, cut faces and planes show the same tissue at the same grey. The window is per subject because `orig.mgz` carries no common scale: white-matter medians were 144 in CDMD and 221 in the subject Planum published before it (DIPY's SNAIL example dataset, since retired). On the published files $h$ is 188 for CDMD and 256 for the MNI template, whose averaged T1 reaches the top of `orig.mgz`'s 8-bit range. An empty segmentation or $h \le 0$ fails the build.

### Plane resampling

`sampleSlice` samples one plane as a $512 \times 512$ image over a 256 mm square, one sample at each pixel centre $\mathbf{p}$, and keeps all that the window does not change. `windowSlice` draws those samples through the window without reading a volume again.

The T1 is read by `Volume.linear`, trilinear over the eight surrounding voxels and 0 outside the grid. The value is kept as a double and mapped through level $c$ and width $w$:

$$g = \operatorname{clamp}\bigl((T_1(\mathbf{p}) - c + w/2)\,255/w,\ 0,\ 255\bigr).$$

The label is read by `Volume.label`, which returns the label with the largest summed trilinear weight over the eight voxels (the ANTs genericLabel rule). The result is exact at voxel centres and never a label absent from the eight. `Volume.label` is the central processing unit (CPU) twin of `LABEL_AT`, which labels the cut faces on the graphics processing unit (GPU) ([sections and cuts](sections-and-cuts.md#method)).

**Overlay** mixes one colouring into the grey. Under **Segmentation**, a labelled pixel is $0.55\,g + 0.45\,\text{colour}$ with its FreeSurfer label colour (Fig. 1b). Under **3D view**, the colour is the one its label on the cut atlas's grid takes on the 3D cut faces now (`TissueSections.labelColours`: the cut's own palette, converted from linear to sRGB bytes), so the colouring, hidden regions and Focus show as on the stage (Fig. 2). A label whose face is not drawn keeps its grey, and under T1 MRI colour, whose cut faces show the scan, nothing is mixed in. With a [segmentation agreement](segmentation-agreement.md) shown, one structure is inked instead by category: both segmentations (236, 236, 236), aseg only (235, 70, 210), NextBrain only (255, 150, 30).

A pixel whose label on the cut atlas's grid is painted takes the paint's colour, whatever the window. The selected region's pixels are tinted $0.55\,g + 0.45 \times$ (127, 208, 204), the dark stage's accent, over any other tint, and the pixels on either side of its edge (a pixel whose 4-neighbour differs) are drawn in that colour, two pixels wide, over a paint or a map (Fig. 2b). A shown agreement is the exception: it inks the selected structure itself, and an outline would cover the pixels that one segmentation alone labels at its edge, so the selection is not drawn while it is shown. The selection is drawn by the cut atlas's grid when that grid labels the region, else by the surface atlas's, else by the first published cut grid that labels it or the regions it gathers (`constituent_regions`). A teaching-set structure is therefore drawn by NextBrain's grid, as its 3D solid is made from NextBrain's labels. A grid the cut has not loaded is downloaded for the planes alone. The reader's [overlay](overlays.md) maps are drawn over the result at their opacities, as the cut faces draw them: in linear light, from the pixel's sRGB bytes, rounded once ([colour scale](overlays.md#colour-scale)).

On the tracts' own anatomy two further layers follow. FA, where a map is published (CDMD only; viridis over 0–1, sampled at each pixel centre), is blended over the pixels at **FA opacity**. The drawn tracts within 2 mm of the plane (`TRACT_SLAB_MM`), clipped to that slab and laid flat on it, are then drawn one pixel wide in their direction colours ([tracts](tracts.md#display)). Every pixel is drawn opaque, so voxels that no label covers keep their T1 grey.

### Plane frames

Each plane is seen from the side from which the stage faces that cut (the other side when the cut is reversed). Screen-right is $\mathbf{u} = \mathbf{v} \times \mathbf{e}$ for screen-up $\mathbf{v}$ and direction to the eye $\mathbf{e}$ (`stagedFrame`). Edge letters follow from $\mathbf{u}$ and $\mathbf{v}$. An axial or coronal panel is labelled neurological when L is at its left edge and radiological when R is. A click inverts the frame to a point (`pointOnPlane`), and the crosshair is clamped to ±128 mm.

### Serial sections

A series is eleven sections of one plane (Fig. 2a), a whole number of millimetres apart and centred on the box the segmentation labels, so that they span it as eleven equal parts would (`seriesPositions`). On CDMD the box is $-68.5 \ldots 66.5$, $-85.5 \ldots 66.5$ and $-51.5 \ldots 89.5$ mm, as nibabel measures it on `aseg.mgz`, and the series are axial $-46$ to $+84$ mm (13 mm apart), coronal $-79$ to $+61$ mm (14 mm) and sagittal $-61$ to $+59$ mm (12 mm). Every section is cropped to the box and 4 mm about it, so all share one scale (286 × 320 pixels for an axial section), and only that crop is sampled. The localizer is the crossing sagittal plane through the box's centre (the coronal plane for a sagittal series), widened about the box to the sections' shape. The sections draw what the planes draw: overlay, paint, map, selection, FA and the tracts, the tracts taken for all eleven in one pass over the streamlines (`onPlanes`). The localizer draws the scan, overlay, paint, map and selection. On the published scan a whole series is drawn again in about 100 ms (150 ms with the two default bundles, 0.8 s with all 30 then published) on an Apple M-series laptop; a new window, level or FA opacity reads nothing again.

```{figure} figures/linked-mri-2-light.webp
:alt: Two panels. a, the Serial sections view of Linked MRI on a dark ground, headed Axial from above, 11 sections, 13 mm apart, a sagittal localizer crossed by eleven lines, then eleven axial sections from −46 to +84 mm, four to a row, the cortex and deep structures tinted in the colours of the 3D cut faces. b, an enlarged coronal plane in the same colours, with the left putamen, on the image's right, tinted pale teal and outlined in teal beside the pink right putamen.
:name: fig-linked-mri-2

**A series of sections and the 3D view's colours show the anatomy on the scan, selection included.** **a**, **View** › **Serial sections** for [the left putamen selected on a coronal cut](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&region=learning:left:putamen&cut=coronal&pos=-10&view=anterior), with **Overlay** set to **3D view**. The localizer is the sagittal plane through the centre of the labelled box (x = −1 mm), with a line at each section. The eleven axial sections run from −46 to +84 mm, 13 mm apart, each cropped to the box and 4 mm about it. Each labelled pixel mixes 0.55 of its grey with 0.45 of the colour its label takes on the 3D cut faces, Destrieux's in the cortex and the teaching set's below it, and in the +19 mm section the selected left putamen is tinted and outlined in the accent. **b**, The coronal plane at y = −10 mm of **Three planes** under the same overlay, enlarged to the brain and seen from the front in the radiological convention. The selected left putamen, on the image's right, is tinted 0.55 grey to 0.45 (127, 208, 204) and outlined two pixels wide across its edge, while the right putamen keeps its teaching-set colour. The overlay and the view are not written to a link, so the link opens the selection and the cut. Subject CDMD `sub_013`.
```

## Display

**Linked MRI** opens from a region's detail, a function's or deficit's profile, the section bar, the Tracts tab's **MRI with tracts** or the <kbd>M</kbd> key. From a function's profile it opens at the anchor of the function's strongest area. From a deficit's profile it opens at its first finding's first region (the chosen finding's, if one is). The overview of all functions opens it where the crosshair is.

The crosshair is the cut's. A click on a plane moves the crosshair there, cuts the 3D brain on that plane through the point and selects the smallest shown solid that contains it (`regionAt`). A click on the 3D brain moves the crosshair to the picked surface point. The wheel moves a plane 1 mm a notch. Each plane has a 1 mm position slider, whose arrow keys move the crosshair 1 mm. The crosshair is drawn at screen resolution in `#4fb6e0` over a `#0e1116` ring.

**Window** (width 10–256) and **Level** (0–255) apply to the planes and to T1 surface colour alike. Only a plane whose frame, overlay, agreement, paint, map or tracts changed is resampled. **Window**, **Level** and **FA opacity** redraw each plane from the samples it kept (`mpr-plane-cache.ts`). **Overlay** chooses what is mixed into the scan, one at a time: **None**, **Segmentation** (aseg's label colours) or **3D view** (the 3D cut faces' colours). The selected region, chosen on the 3D brain, in a list or on a plane, is tinted and outlined on every plane, and a new selection samples the planes again. **Crosshair**, a switch that is on by default, shows the crosshair on the planes, on the serial sections and in what **Save PNG** writes; switched off, the crosshair still moves, cuts and reads out. **Reset display** returns **Window** and **Level** to the published window, sets **Overlay** to **None** and **FA opacity** to 0, and switches **Crosshair** back on.

While the model shows any paint, each voxel whose label on the cut atlas's own grid is painted takes the paint's colour, opaque over the scan, as the cut faces show it. That grid is the surface atlas's, which a paint keeps on the cut, and it downloads the first time a paint needs it.

The readout gives the RAS position, the region the current cut labels name, the aseg structure and label number, the agreement category while one is shown, the reader's map value where it has one, and FA while it is shown. It is announced to assistive technology once the crosshair has rested for 250 ms. With a segmentation agreement shown, a legend names the structure (`Agreement: <structure>`) and its three categories, **Overlay** holds its choice, and **Hide agreement** returns to the segmentation.

On the tracts' own anatomy the planes draw the tracts the stage draws and offer **FA opacity** (0–100%, step 5%, default 0). FA downloads the first time the opacity leaves 0, and a note says what the tracts and FA are. **Save PNG** writes the 512-pixel plane with crosshair, edge letters, convention and offset as `<subject>-<plane>-<offset>mm.png`.

**View** › **Serial sections** replaces the three planes with a series of the plane chosen (axial by default), drawn as a mosaic after the localizer. The localizer has a line at each section; the section holding the crosshair draws it and lights its line, as does a section under the pointer. A click on a section places the crosshair at that point, cuts the stage on its plane and selects what is there. **Save PNG** writes the twelve pictures four to a row at their own resolution, with their positions, the first section's edge letters and convention, and a footer naming the subject, plane and spacing, as `<subject>-<plane>-series.png`.

On a desktop or tablet the planes dock beside the stage. The column runs from 240 px to the width that leaves the stage 360 px, changes by 24 px per arrow key, and returns to the default width on a double click on its edge. On a phone or a full-screen stage, or where the narrowest dock would leave the stage under 360 px, the planes open as a modal dialog. The URL key is `mri=<level>,<width>`, written only when the window differs from the published one and accepted for level 0–255 and width 1–256.

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| Round trip (`validate_volumes.py`; `test_volumes.py::test_actual_source_round_trip`) | Both volumes decode, match both checksums, and placed by their affines equal `orig.mgz` and `aseg.mgz` voxel for voxel | passes |
| Grid registration (`test_volumes.py`) | A differing shape, scanner affine or tkregister matrix fails before writing | passes |
| Window ceiling (`test_volumes.py`) | Fewer than 0.5% of segmented T1 voxels at or above the ceiling | passes |
| Window floor (`test_volumes.py`) | $\text{level} - \text{width}/2 = 0$ | passes |
| Per-subject window (`test_volumes.py`) | CDMD and `fsaverage` windows differ | passes |
| Sampling (`sampling.test.ts`, `volume.test.ts`) | Grey is the windowed T1 clamped to 0–255; overlay blends 0.55/0.45; labels never invented; voxel centres keep their label; the reader's map is drawn by its opacity where it passes its threshold, mixed in linear light to the bytes a cut face draws | passes |
| GPU–CPU labels (`label-sampling.svelte.test.ts`) | `labelAt` names the label `Volume.label` names | passes |
| Kept samples (`sampling.test.ts`, `MprDialog.svelte.test.ts`; SLICE-41, SECT-38) | A new window draws the pixels sampling through it draws; **Window**, **Level** and **FA opacity** redraw each plane without reading a volume, FA or the tracts again | passes |
| Tracts and FA (`MprDialog.svelte.test.ts`, `native-geometry.test.ts`) | Segments are cut where they leave the 2 mm slab and laid flat on the plane; FA downloads once its opacity leaves zero and joins the readout; another subject's tracts are not drawn and FA is not offered; **Reset display** returns FA opacity to zero | passes |
| Paint (`sampling.test.ts`, `sections.test.ts`) | A painted label is drawn in its colour over the scan; the label grid loads only once the planes have, and a failed load is reported once | passes |
| Frames and clicks (`coordinates.test.ts`, `mpr-draw.test.ts`) | A click's point marks the crosshair at that click; the coronal panel faced from the front puts the subject's right on the left | passes |
| Labelled box (`volume.test.ts`; SECT-39) | The box `Volume.labelledBox` measures on the published `aseg.volume` equals nibabel's on `aseg.mgz`, to the voxels' outer faces | passes |
| Serial sections (`mpr-series.test.ts`, `MprSeries.svelte.test.ts`; SECT-40–45) | Positions, spacing and crops as above; the localizer is widened, not cut; a click finds the point under it and refuses one past the scanned square; **Save PNG** writes the sheet of twelve | passes |
| Cropped sampling (`sampling.test.ts`; SECT-41) | A crop reads the volumes only at its own pixels and draws there the bytes of the whole slice | passes |
| Tracts in one pass (`native-geometry.test.ts`, engine contract; SECT-44) | Parallel planes taken together keep, each, the pieces the plane alone keeps; planes that are not parallel are refused | passes |
| 3D view colours (`gpu-sections.test.ts`, `sampling.test.ts`, engine contract; SECT-46) | A label's colour comes back as its published sRGB bytes, none for a hidden region; mixed 0.55/0.45 into the grey; the overlay and the colours exclude each other | passes |
| Selection (`sampling.test.ts`, `sections.test.ts`, `MprDialog.svelte.test.ts`; SECT-47) | Tinted 0.55/0.45 and outlined two pixels wide across its edge; drawn by the cut's grid when it holds the region, else by the grid holding the regions it gathers; not drawn over a shown agreement, whose pixels stay as they are | passes |

The window ceiling and floor tests run on CDMD and on the MNI template.

## Limitations

The planes show one individual's 1 mm MRI and segmentation, not the reader's own anatomy. On the MNI template they show an averaged 1 mm MRI and its segmentation, which are nobody's individual anatomy. Trilinear interpolation does not increase source resolution. The scan is not intensity-normalised; grey levels do not compare across subjects.

**Overlay** › **Segmentation** is aseg, whatever atlas the stage shows; cortical surface atlases are not extended into the volume. **3D view**, a paint and the selection are drawn by the cut atlas's own label grid instead. The selection is drawn at the cut grid's resolution, and a region that no published cut grid labels, such as a tract or a surface-only map, is not drawn on the planes. `volumes.json` describes the segmentation as sampled by nearest neighbour; the viewer samples it by largest trilinear weight. Hidden or isolated regions change the planes only through **Overlay** › **3D view**.

A serial section is not the stage's cut: it lies at its own position on the plane's axis, and the cut follows it only when the section is clicked.

Agreement is not accuracy: neither segmentation is the reference.

## Code availability

Code
: [`brain_model/labels/volumes.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/labels/volumes.py), [`brain_model/validate_volumes.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/validate_volumes.py), [`web/src/lib/engine/slices/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/lib/engine/slices), [`web/src/features/sections/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/features/sections)

Configuration
: [`config/model.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/model.yaml): `sections.field_of_view_mm`, `sections.texture_size` (the window is measured, not configured)

Tests
: `tests/test_volumes.py`, `web/src/lib/engine/slices/*.test.ts`, `web/src/features/sections/mpr-*.test.ts`, `web/src/features/sections/MprDialog.svelte.test.ts`, `web/src/features/sections/MprSeries.svelte.test.ts`, `web/src/lib/engine/tissues/gpu-sections.test.ts`, `web/src/lib/engine/diffusion/native-geometry.test.ts`, `web/src/lib/engine/tissues/label-sampling.svelte.test.ts`

```bash
uv run python -m brain_model.labels.volumes
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_volumes.py
npm test --prefix web -- slices sections native-geometry
npm run test:browser --prefix web -- MprDialog label-sampling
```

