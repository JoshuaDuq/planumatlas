# Sharing and snapshots

The address bar records the viewer's scene as a fragment that restores it field by field, and **Save image** writes the stage as a PNG that documents itself: neither needs a server, and both are built in the viewer from the state it already holds.

:::{list-table}
:widths: 22 78
:stub-columns: 1

* - Where in the viewer
  - The page URL (copy it to share a view); **Save image** in the masthead
* - Built by
  - Viewer only; no build step. [`web/src/lib/core/state/url-state.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/state/url-state.ts), [`link-check.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/state/link-check.ts), [`link-writer.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/state/link-writer.ts), [`web/src/lib/controller/links.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/controller/links.ts), [`web/src/lib/state/link.svelte.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/state/link.svelte.ts), [`web/src/features/snapshot/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/features/snapshot) (`snapshot.ts`, `markings.ts`), `captureSnapshot` in [`web/src/lib/engine/render/scene.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/engine/render/scene.ts)
* - Configuration
  - None; `SNAPSHOT_PIXEL_RATIO` and `SNAPSHOT_LAYOUT` are constants in the modules above
* - Source data
  - The viewer's own state; the published anatomy for the ids a link may name
* - Checked by
  - `url-state.test.ts`, `link-check.test.ts`, `link-writer.test.ts`, `reader-state.test.ts` in `web/src/lib/core/state/`; `snapshot.test.ts`, `snapshot.svelte.test.ts`, `snapshot.drawing.svelte.test.ts` in `web/src/features/snapshot/`; `scale-bar.test.ts`
:::

## What it does

**Sharing.** The address bar records the current view, including selection, display settings, camera and section. Copy the URL to share it. It carries a placed lesion, its colouring and the tract drawn through it, a placed published coordinate, chosen stroke cases, the open circuit and step, and the language. If a setting cannot be applied to the selected subject, a notice explains what was omitted.

**Save image.** The masthead's **Save image** writes the visible stage as a PNG with its orientation letters, route-landmark labels, scale bar, colour keys, a caption naming subject, labels, colouring and view or section, and the statement "Planum · Not clinical anatomy" (French: "Planum · Pas une anatomie clinique"). The file is named `planum-<atlas>[-<view>][-<plane>].png`, using the atlas, the view while the camera holds it, and the cut's plane; a notice then names the file.

## How it was built

### The link format (`url-state.ts`)

The state travels in the URL hash, as `URLSearchParams`. `encodeState` omits any field still at its default (`DEFAULTS`), and un-escapes colons and commas so ids and coordinates stay readable. `decodeState` reads field by field with a typed reader for each parameter; a parameter that is repeated, or does not parse, is not guessed at: it is left out of the state and named in `rejected`.

| Parameter | State | Format |
| :--- | :--- | :--- |
| `anatomy` | Subject | Id of a published anatomy; without it a link opens the published default. Region ids are shared between brains, so a link without it would open the right region on whichever brain loaded |
| `atlas`, `cuts`, `system`, `detail` | Cortical atlas, cut labels, internal-anatomy system, internal-anatomy level | Ids |
| `region`, `isolate` | Selected and isolated region | Region id |
| `focus` | Focus | `1` or `0` |
| `hidden` | Hidden regions | Comma-separated ids, sorted |
| `view` | Named view | Name |
| `cam` | Exact camera | `px,py,pz,tx,ty,tz` (position then target) or with a unit up vector as three more numbers; millimetres, written to tenths, the up vector to thousandths; each of the first six within ±100,000 |
| `cut` | Plane | `sagittal`, `coronal`, `axial` or `oblique` |
| `pos` | Position along the normal | Millimetres, written to tenths and rounded toward zero (`towardZero`), so the written value lies inside the plane's range whenever the exact one did; read within ±512 mm |
| `rev`, `tilt`, `az` | Reversed side, tilt, azimuth | `1`/`0`; whole degrees 0 to 90; whole degrees −180 to 180 |
| `hemi` | Hemisphere | `both`, `left`, `right` |
| `cortex`, `internal`, `cord` | Cortex, internal anatomy, spinal cord shown | `1`/`0` |
| `opacity` | Cortex opacity | 0 to 1, to hundredths |
| `colors` | Surface colour | One of `tissue`, `mri`, `atlas`, `network`, `cab-np`, `territory` (the older flag `colors=1` still reads as `atlas` and `0` as `tissue`; nothing writes them) |
| `mri` | Linked MRI window | `centre,width`, centre 0 to 255, width 1 to 256, written only when it differs from the window the build published |
| `tab` | Panel tab | One of the explorers |
| `function`, `deficit` | Open function or deficit | Id; written only from its own tab |
| `circuit`, `step` | Guided circuit and step | Id; the step counted from one, as the stepper shows it |
| `map`, `dot` | Circuit map and its dot | Id; `x,y,radius` in degrees from fixation inside 90°, radius from 0.01 to 90 |
| `lang` | Language | `en` or `fr` |
| `lesion` | Placed sphere | `right,anterior,superior,radius`: centre in the volume's range to tenths, radius within the slider's range |
| `lesionmode`, `lesiontract` | Lesion colouring, drawn tract | Mode name; bundle id |
| `coord`, `space` | Published coordinate and its template | The three numbers as entered, unrounded, each within ±512; space id |
| `cases` | Stroke cases | One or two distinct cohort ids such as `M2295,M2294` |

### Writing (`link-writer.ts`, `link.svelte.ts`, `controller/links.ts`)

`createLinkWriter` debounces: it writes 250 ms after a view change, and when the camera settles (`cameraSettled` fires 250 ms after a reader's move ends). `linkState()` assembles the scene's state, adding the plane (`cutState()`: mode, the crosshair's offset along the plane's normal, reverse, tilt, azimuth), the exact camera (`orbitLink()`), the MRI window (`mriWindowLink()`, null at the published window) and the lesion and stroke-case stores. A coordinate's sphere travels as the coordinate, not as a lesion. Stroke cases are written only with a selected region, since their sheet belongs to it. The see-through cortex that drawn streamlines or stroke cases asked for, and the colour they replaced, are written as the reader's own, so the link restores the display, not the temporary state. The write is `history.replaceState`, not a push: the Back button is not a camera undo stack. The camera is omitted (`orbitLink` returns null) while a held named view or the tract reference is on screen.

Switching subject re-enters through the URL: the reader keeps atlas, cut, view, panel and language; selection, dissection, the exact camera and the MRI window belong to the old subject's parcels and intensities and are dropped, and the page reloads.

### Reading (`link-check.ts`, `controller/links.ts`)

At startup `decodeState` reads the hash and `loadAnatomies` resolves the subject; a subject the site does not publish is named as `anatomy` in the rejected list and the default opens. `restore` then:

1. Takes a command token (`commands.begin`) and holds the writer, so the address bar keeps the link while the scene settles, not the half-built scene its downloads leave on screen. A later command overtakes the restore, which then returns without reporting.
2. Judges the decoded state against what the loaded anatomy publishes (`checkLink`): atlas, detail, cut atlas, view, colour, tab, selected and isolated region, every hidden region, function, deficit, circuit, circuit step, circuit map. A field naming anything else is dropped and its parameter added to `rejected`.
3. Applies cross-field rules: a spinal cord needs a published cord; a coordinate needs a published space and the coordinate and a lesion are the one sphere (a link with both drops both coordinate fields and the lesion); Focus needs a selection; stroke cases need a selected region; a lesion colouring and a drawn tract need a lesion, and the tract must be one the lesion reaches; a circuit map and a circuit are exclusive and the map's dot needs the map.
4. Applies the reader state field by field (`applyReaderState`); a step that fails names its link fields, which are added to the not-applied list. A link without its own view faces its cut, as choosing the cut does.
5. Restores the explorer, the lesson or map, the function or deficit, the lesion (or maps the coordinate through the registered space and places the sphere), and the stroke cases.

`linkNotice` words what was not applied in the reader's language, for example "Not applied from this link: section position and language."; a parameter without a name in the `link.fields` table is listed by its parameter. Editing the hash in place applies the new link as scene commands on the same brain (`onHashChange`); another brain reloads the page.

### Save image

`saveSnapshot` runs, in order:

1. **Plan** (`snapshotPlan`). The visible stage's rectangle is the crop. The caption (`snapshotCaption`) is a list of lines of facts: subject; then atlas, colour and internal anatomy (the last only when the masthead offers more than one level); then the section (plane, offset in millimetres, and for an oblique plane tilt and azimuth) or, while the camera holds one, the named view. A tract reference shown alone replaces the first two lines with its label. `snapshotMarkings` measures where the orientation letters, route landmarks' labels with their dots and leaders, the scale bar and each colour-key plate are drawn on the stage, in CSS pixels of the crop; a colour key that is folded on screen is folded in the image, and rows scrolled out of a long list stay out of it.
2. **Fonts.** `snapshotFonts` loads exactly the faces and words the markings will draw.
3. **Capture** (`captureSnapshot` in `scene.ts`). The settled pipeline is redrawn at `SNAPSHOT_PIXEL_RATIO` = 2 when the screen's ratio is lower (phones 1, tablets 1.5, standard monitors 1), then restored: a 1080 × 820 stage at a device pixel ratio of 1 exports 2160 × 1640. The screen's ratio cap exists for drag performance, and one saved frame does not need it. To keep the selection outline as wide for the anatomy as on screen, the outline passes' `downSampleRatio` is multiplied by the scale; scaling `edgeThickness` instead looks thinner and fainter, because three.js's separable blur has a fixed 4-tap kernel and a larger radius only spreads the same taps. The canvas is read in the same task as the render, since the drawing buffer is not preserved past it.
4. **Annotate** (`annotateSnapshot`). Only marks are drawn, over the captured pixels, which are not resampled or filtered. The stage's own layout (gutter 16 px, line 16 px, letter gap 12 px, scale gap 8 px) places everything in CSS pixels, scaled by the frame's ratio. Chrome is laid out first and the route labels are settled clear of it. The caption keeps to the left of the top orientation letter; its facts are joined by " · " and a narrow image breaks a line between facts, ellipsising a fact that still does not fit. The statement and the scale bar share the bottom line when both fit between the gutters, else the scale bar goes one line up.
5. **Save.** The canvas becomes a PNG blob, downloaded through an object URL that is revoked after 40 seconds (some browsers lose the file if it is revoked sooner). A second request while one is being made joins it. A failure is the scene commands' `snapshot` notice.

The scale bar is a measurement, not a decoration: `scaleBar` takes the camera's field of view, its distance to the target and the viewport height, converts a pixel to millimetres at the focused depth, and picks the largest length from a 1-2-5 sequence (0.1 mm to 1,000 mm) whose bar is 60 to 150 pixels wide. A hidden tab, which measures zero, reports nothing instead of a false length.

## Checks

| Check | What it requires |
| :--- | :--- |
| Round trip | `encodeState` then `decodeState` returns the state; defaults are omitted (`url-state.test.ts`) |
| Rejection | A repeated or unparsable parameter, and an id the anatomy does not publish, is named in `rejected` and not applied (`url-state.test.ts`, `link-check.test.ts`) |
| Writer | A write waits for stillness and is held while a link applies (`link-writer.test.ts`) |
| Snapshot | Caption, packing, ellipsis, bottom-line placement and drawing (`snapshot.test.ts`, `snapshot.svelte.test.ts`, `snapshot.drawing.svelte.test.ts`); the capture's canvas is sized to its crop (`contract.test.ts`) |
| Resolution | Verified by exporting at 1× in headless Chrome and comparing crops of the outline |

## Limits

- A link names ids of one published build. A region, atlas or layer that a later build renames or drops is rejected and named, and the rest of the link still applies.
- The camera is exact to a tenth of a millimetre; a link written under one orbit limit is accepted within a rounding allowance (`ORBIT_ROUNDING_MM`).
- A link carries state, not data: the lesion's measurements, a dissection's history (undo) and loaded volumes are rebuilt from the published files.
- Fields without a name in the notice table (`coord`, `space`, `cases`, `map`, `dot`) are listed by their parameter name.
- The PNG is the visible stage, not the panel or the Linked MRI; Linked MRI saves its own planes ([Linked MRI](linked-mri.md#saving)).
- The caption states that the image is not clinical anatomy; the scale bar is exact only at the depth the camera is focused on.

## Reproduce

```bash
npm test --prefix web -- state snapshot
npm run build --prefix web
```

To follow a link from the shell, open `https://planumatlas.com/#hemi=left&cut=coronal&pos=-20` (any parameter above). The address bar of a running viewer is the authority on what it writes.

## See also

- [Sections and cuts](sections-and-cuts.md): the plane parameters
- [Linked MRI](linked-mri.md): the `mri` window
- [Dissection and display](dissection-and-display.md): `hidden`, `isolate`, `focus`, `hemi`, `cortex`, `opacity`, `internal`, `cord`, `colors`
- [Lesion report](lesion-report.md) and [Published coordinates](published-coordinates.md): `lesion`, `lesionmode`, `lesiontract`, `coord`, `space`
- [Stroke cases](stroke-cases.md), [Circuits](circuits.md), [Visual field map](visual-field-map.md): `cases`, `circuit`, `step`, `map`, `dot`
- [Architecture](../pipeline/architecture.md): asset versioning, which a link does not carry
