# Linked MRI

The subject's own T1 scan shown as three orthogonal sections around one crosshair, with window and level, a segmentation overlay and a voxel readout, built from the lossless `mri.volume` and `aseg.volume` that the build writes from the FreeSurfer reconstruction.

```{figure} ../../.github/assets/readme/linked-mri.webp
:alt: Linked MRI: sagittal, coronal and axial T1 sections around a shared crosshair, with the voxel's label and the window and level controls

Linked MRI opened from the selected left hippocampal formation: the subject's T1 in three planes around its centroid, with the label under the crosshair.
```

:::{list-table}
:widths: 22 78
:stub-columns: 1

* - Where in the viewer
  - **Linked MRI** in a region's detail, in the section bar, or the <kbd>M</kbd> key; **Show on linked MRI** in a region's Segmentation agreement section
* - Built by
  - [`brain_model/labels/volumes.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/labels/volumes.py) (`export_volumes`, `display_window`), [`brain_model/validate_volumes.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/validate_volumes.py)
* - Viewer modules
  - [`web/src/lib/engine/slices/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/lib/engine/slices) (`volume.ts`, `sampling.ts`, `coordinates.ts`, `sections.ts`), [`web/src/features/sections/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/features/sections) (`MprDialog.svelte`, `mpr-dialog.svelte.ts`, `mpr-draw.ts`, `mpr-words.ts`)
* - Configuration
  - [`config/model.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/model.yaml): `sections.field_of_view_mm`, `sections.texture_size`
* - Source data
  - `mri/orig.mgz` and `mri/aseg.mgz` of the subject's FreeSurfer reconstruction (CDMD); for inked agreement, `nextbrain-compared.volume`
* - Checked by
  - `validate_volumes.py` steps 1 and 2 ([validation](../pipeline/validation.md)); `tests/test_volumes.py`; `web/src/lib/engine/slices/*.test.ts`, `web/src/features/sections/mpr-*.test.ts`
:::

## What it does

**Linked MRI** opens the subject's T1 in three orthogonal sections (sagittal, coronal, axial) around a shared crosshair. Clicking a picture places the crosshair there and selects the region the 3D brain draws at that point (the smallest shown structure, or cortical parcel through its ribbon solid, that contains it; nothing where none does), the mouse wheel moves the slice of the picture under it by 1 mm a notch, and each plane has its own position slider. The controls beneath the planes are a contrast **window** (width 10 to 256) and **level** (centre 0 to 255), a **Segmentation overlay** check box, a readout of the crosshair's position and what is under it, and **Save PNG** for each plane.

The slices always show the full original scan; dissection does not change them. Positions are FreeSurfer surface RAS millimetres. The planes are drawn as the stage faces the current cut, so a panel and the cut face agree: an axial or coronal panel carries a convention mark, neurological where the patient's left is on the screen's left and radiological where their right is, read off the letter at the panel's left edge.

On a desktop or tablet the planes dock in a column to the right of the live stage with no focus trap, so the anatomy a click selects stays in view; below 1280 px wide the column is narrower and its planes are stacked. On a phone, or over the full-screen stage, they open as a modal dialog, and a phone shows one plane at a time.

Shown from a region's **Segmentation agreement** section, the planes ink one structure instead of the segmentation overlay: white where both segmentations label it, magenta where only aseg does, orange where only NextBrain does. A key names the structure, the readout adds the crosshair voxel's category, and **Hide agreement** returns to the segmentation overlay. The comparison itself is built by [segmentation agreement](segmentation-agreement.md).

## Data

| File | Contents |
| :--- | :--- |
| `mri.volume` | `orig.mgz`, `uint8`, the whole $256^3$ grid at 1 mm (16,777,216 bytes on CDMD); not cropped |
| `aseg.volume` | `aseg.mgz` labels, `<u2`, gzipped, cropped to its non-zero voxels (135 × 141 × 152 on CDMD, 5,786,640 bytes) |
| `volumes.json` | `schema_version`, `coordinate_system` ("FreeSurfer surface RAS (tkregister), millimeters"), the two volume records, the `labels` table (`name`, `color` per label present), `display` and `limitations` |

Each volume record carries `shape`, `dtype`, `order: "F"`, `compression: "gzip"`, `byte_length`, `sha256` and `decoded_sha256`, `voxel_to_surface_ras_mm` and `voxel_spacing_mm`; the cropped record adds `source_shape` and `crop_corner_voxel`. The `display` block holds `field_of_view_mm` (256), `texture_size` (512) and the default window, which the build measures (below). On CDMD the window is centre 94, width 188.

The T1 is `orig.mgz`: conformed to $256^3$ at 1 mm but not intensity normalised, so white matter sits wherever the scanner left it, with no scale common to subjects.

## How it was built

1. **Load and check the grids.** `export_volumes` loads `mri/orig.mgz` and `mri/aseg.mgz` and calls `validate_same_grid`: equal shape, equal scanner affine, and equal tkregister transform (`get_vox2ras_tkr`). A pair that differs fails with an error naming which check broke. Only a conformed subject volume's own tkregister matrix is surface RAS.
2. **Encode the volumes.** The MRI is written whole by `encode_volume` as `uint8`; the segmentation by `encode_cropped_volume` as `<u2` cropped to its non-zero voxels, with the affine shifted by the crop corner. `encode_array` refuses a volume that is not finite and three-dimensional, falls outside the type's range, or changes under the cast, so encoding is lossless. The payload is Fortran order (x fastest) and gzipped with `compresslevel=9` and `mtime=0`, so the bytes are reproducible. `sha256` is of the file, `decoded_sha256` of the payload.
3. **Label table.** `labels` maps every segmentation value present to its FreeSurfer lookup-table name and colour (`read_color_table`).
4. **Measure the default window** (`display_window`). The signal is the T1 inside every non-zero aseg voxel. The ceiling is its 99.9th percentile, rounded up to an even integer, `high = 2 * ceil(p99.9 / 2)`, and the window is `window_center = high // 2`, `window_width = high`. The floor stays at zero so displayed grey is proportional to T1 signal: a raised floor would buy contrast by adding an offset, and surfaces and cut faces would no longer report the same tissue at the same grey. Only the ceiling is fitted, high enough to leave the bright tail intact. A single constant ceiling clipped half of a brighter subject's white matter to flat white (the function's docstring records white-matter medians of 221 in the since-retired SNAIL and 144 in CDMD), which is measured signal thrown away; the config therefore carries no window, and the viewer's sliders start from the published one. A segmentation that covers no voxels, or a ceiling of zero, fails.
5. **Write `volumes.json`** with the limitations below.

## How the viewer uses it

### Loading

`BrainSections.load` fetches `volumes.json`, then the T1 and `aseg.volume` together. The T1 is the same volume the T1 surface colour and the cut faces use, so it is downloaded once. `loadVolume` checks the compressed bytes against `sha256` and the decoded bytes against `byte_length` and `decoded_sha256`, throwing on any mismatch, then builds a `Volume` from the record: shape, Fortran order, a non-singular affine. `Volume` keeps the inverse affine, so any surface RAS point maps to a voxel index. The scan reaches the GPU as an `R8` 3D texture with linear filtering. The window of the loaded scan is applied to the T1 surface colouring too, so the contrast sliders affect both.

### Sampling

`renderSlice` (`slices/sampling.ts`) draws one plane as a $512 \times 512$ image (`texture_size`) over a 256 mm square (`field_of_view_mm`), one sample per pixel at its centre. For each pixel:

- the **T1** is `Volume.linear`, trilinear over the eight surrounding voxels (and 0 outside the grid), mapped through the window to grey: $\text{grey} = \operatorname{clamp}\bigl((T_1 - c + w/2)\,255/w,\ 0,\ 255\bigr)$ for level $c$ and width $w$;
- the **segmentation label** is `Volume.label`, the label whose trilinear weight over the eight voxels is largest (ANTs' genericLabel rule), never a label absent from those eight, exact at every voxel centre. This is the same rule as the cut faces' GPU sampler `LABEL_AT`, with the same corner order so ties break alike ([sections and cuts](sections-and-cuts.md#sampling-labels));
- with the overlay on, a labelled pixel is $0.55 \times \text{grey} + 0.45 \times \text{label colour}$; with an agreement shown it is the structure's category colour instead (white, magenta or orange: `AGREEMENT_COLORS` 236,236,236; 235,70,210; 255,150,30, chosen to stay apart under the common colour-vision deficiencies and from the crosshair's cyan). A structure only NextBrain labels can lie where aseg labels nothing; it is still drawn. The overlay is disabled while an agreement is shown.

The picture itself is drawn at full alpha, so the MRI keeps every source intensity, including voxels no label covers.

### Frames and the crosshair

`stagedFrame` (`slices/coordinates.ts`) builds each panel's frame: the plane's normal, the screen axes $u$ (right) and $v$ (up), and the letters at its four edges. The panel is seen from the side the stage faces the cut (the other side when reversed), with $u = v \times \text{towardEye}$. The convention line is read off the letter at the panel's left edge: L on the left is neurological, R on the left radiological; a sagittal panel shows none. The crosshair's position on a picture is `crosshairOnPlane`, and a click inverts it with `pointOnPlane`. Coordinates are limited to $\pm 128$ mm (`COORDINATE_LIMIT`; the section range also takes in the spinal cord's bounds where it is shown).

Only a plane's own slice is resampled when it changes (the frame, the overlay, the agreement and the window are its key); the crosshair moving within a plane is marked over the picture at screen resolution, in `#4fb6e0` with a dark ring (`#0e1116`) that keeps it off bright tissue, so it stays one pixel wide however small the panel. Slider, click and wheel moves are coalesced to one move per animation frame.

### Readout

`BrainSections.sample` returns, for the crosshair, the aseg label and its name, the aseg structure region, the T1 intensity, the point in RAS, the agreement category and `cutRegion`: the region the stage's current cut labels name at that point, read from the cut atlas's own grid once it has loaded. `readoutText` (`mpr-words.ts`) words the position, the region the cut labels name there (which leads), the segmentation structure and label number, and, where agreement is shown, the voxel's category; a sample with no name reads "unlabelled". The readout is said through a live region only after the crosshair has rested for 250 ms (`READOUT_QUIET_MS`), so a drag or a held key is not announced per step. A click, slider move or wheel notch also selects the aseg structure at the crosshair when that region is drawn (`selectPoint`).

### Saving

**Save PNG** (`annotatedCopy` in `mpr-draw.ts`) writes the 512 px slice with the crosshair, the edge letters, the side convention of an axial or coronal panel and the plane's offset in millimetres drawn into the bitmap. The file is named `<subject>-<plane>-<offset>mm.png`. On screen, those marks are overlaid rather than in the pixels.

## Checks

| Check | What it requires |
| :--- | :--- |
| Volumes round-trip | `mri.volume` and `aseg.volume` decode, match both checksums, and placed by their affines equal `orig.mgz` and `aseg.mgz` voxel for voxel |
| Grids register | Shape, scanner affine and tkregister transform equal before any volume is combined |
| Slice tests | `sampling.test.ts`, `volume.test.ts`, `coordinates.test.ts`, `sections.test.ts` in `web/src/lib/engine/slices/`; `mpr-draw.test.ts`, `mpr-words.test.ts`, `mpr-dialog.test.ts` in `web/src/features/sections/` |
| Label sampling | An integer-framebuffer check found 0 mismatches between the GPU sampler and `Volume.label` in 599,890 pixels away from exact ties |

## Limits

- One individual's 1 mm MRI and segmentation, not the viewer's anatomy: `volumes.json` states it in these words, and for an averaged template says "nobody's individual anatomy".
- Trilinear MRI interpolation does not increase source resolution.
- The segmentation is sampled with the heaviest-weight rule; cortical surface atlases are not extended into the volume. The overlay is aseg's labels, whatever atlas the stage shows.
- The scan is not intensity normalised, so the window is per subject, and grey levels do not compare across subjects.
- The window slider range (width 10 to 256, centre 0 to 255) covers the `uint8` intensities; a link's `mri=` window is accepted for a centre of 0 to 255 and a width of 1 to 256.
- Agreement is not accuracy: neither segmentation is the reference ([segmentation agreement](segmentation-agreement.md)).

## Reproduce

```bash
uv run python -m brain_model.labels.volumes     # writes mri.volume, aseg.volume, volumes.json
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_volumes.py
npm test --prefix web -- slices sections
```

`python -m brain_model.build --anatomy cdmd` runs the same step as part of a full build. The viewer's window and agreement state are shared by link (`mri=<centre>,<width>`, written only when the window differs from the published one); see [sharing and snapshots](sharing-and-snapshots.md).

## See also

- [Sections and cuts](sections-and-cuts.md): the stage's own cut, and the shared `LABEL_AT` label rule
- [Segmentation agreement](segmentation-agreement.md): the structures inked on the scan
- [Dissection and display](dissection-and-display.md): the T1 colour mode that uses the same scan and window
- [Validation](../pipeline/validation.md)
