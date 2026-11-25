# Sharing and snapshots

The address bar holds the viewer's scene as a uniform resource locator (URL) fragment that restores it field by field, and **Save image (PNG)** writes the visible stage as an annotated Portable Network Graphics (PNG) file (Fig. 1). Both are built in the browser from state the viewer already holds, and neither needs a server. A link names ids of one published build and carries state, not data. What a later build renames or drops is refused and named, and the reader's own [overlay](overlays.md) is never written into a link.

```{figure} figures/sharing-and-snapshots-1-light.webp
:alt: A saved PNG of a coronal section of a brain coloured by region on a black ground, with a three-line caption at the top left, orientation letters at the four edges, a 20 mm scale bar at the bottom right and the statement "Planum · Not clinical anatomy" at the bottom left.
:name: fig-sharing-and-snapshots-1

**Save image (PNG) writes the stage with its caption, orientation letters, scale bar and statement.** The viewer was opened at [a coronal cut at y = −20 mm](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&cut=coronal&pos=-20&view=anterior) in a 1,560 × 900 px window at a device pixel ratio of 1. Its 1,200 × 820 CSS-pixel stage was saved by **Save image (PNG)** › **Save at 2×**, at 2 pixels per CSS pixel, as a file of 2,400 × 1,640 px named `planum-destrieux-anterior-coronal.png`. The figure is that file at its own size. The caption gives the subject, then the atlas, colouring and internal-anatomy level, then the plane and its signed offset. The orientation letters, the 20 mm scale bar (exact at the camera target's depth) and the statement are drawn over the rendered frame. The section is seen from the front (the right hemisphere on the image's left). A link that names only the subject, the cut and its position opens the same view: it faces its cut, and the link writer then adds the atlas, the level, the view and the language, which the link above carries.
```

## Data

Links and images are built from the viewer's own state. The ids a link may name are those the loaded anatomy publishes.

| Source | Ids a link may name |
| :--- | :--- |
| `anatomies.json` | The published subjects and the default one |
| The anatomy's `manifest.json` | Cortical atlases, internal-anatomy levels and regions, and the colourings, visual field map, spinal cord and coordinate templates this anatomy publishes |
| The function, deficit, circuit and tract catalogues | Functions, deficits, circuits with their steps, and tract bundles |

## Method

### Link encoding

The state travels in the URL hash as `URLSearchParams` (`url-state.ts`). `encodeState` omits every field still at its default (`DEFAULTS`) and un-escapes `%3A` and `%2C`, so ids and coordinates stay readable. `decodeState` reads each parameter with its own typed reader. A parameter that is repeated or does not parse is left out and named in `rejected`, and the fields beside it still decode.

A written link always names its subject (`anatomy`), its cortical atlas, its internal-anatomy level and its language (Fig. 1). Region ids are shared between brains, so the subject travels with them. The cortical atlas and the internal-anatomy system and level (`atlas`, `system`, `detail`), with `colors`, decide a cut's labels. An older link's `cuts` parameter is ignored.

| Parameter | State | Format and range |
| :--- | :--- | :--- |
| `anatomy` | Subject | Published anatomy id; absent, the published default |
| `atlas`, `system`, `detail` | Cortical atlas, internal-anatomy system and level | Ids |
| `region`, `isolate` | Selected and isolated region | Region id |
| `hidden` | Hidden regions | Comma-separated ids, sorted; a repeated id is read once |
| `focus` | Focus | `1`/`0` |
| `view` | Named view | `oblique` (default), `left`, `right`, `anterior`, `posterior`, `superior`, `inferior` |
| `cam` | Exact camera | `px,py,pz,tx,ty,tz` (position, target) in mm to 0.1 mm, optionally three more numbers for the up vector to 0.001; each of the first six within ±100,000 mm |
| `cut` | Plane | `sagittal`, `coronal`, `axial`, `oblique` |
| `pos` | Offset along the plane normal | mm, written to 0.1 mm rounded toward zero (`towardZero`); read within ±512 mm |
| `rev`, `tilt`, `az` | Reversed side, tilt, azimuth | `1`/`0`; whole degrees 0–90; whole degrees −180 to 180 |
| `hemi` | Hemisphere | `both`, `left`, `right` |
| `cortex`, `internal`, `cord`, `explode`, `names` | Cortex, internal anatomy, spinal cord shown; [exploded view](dissection-and-display.md#exploded-view); [names on the brain](dissection-and-display.md#names-on-the-brain) | `1`/`0` |
| `opacity` | Cortex opacity | 0–1, written to 0.01 |
| `colors` | Surface colour | `tissue`, `mri`, `lobe`, `atlas` (the default), `network`, `cab-np`, `territory`, `striatal`, `cerebellar`; the former flag `1`/`0` reads as `atlas`/`tissue` |
| `mark` | The reader's [highlights](dissection-and-display.md#highlights) | `region:colour,…` in the order added, colour `blue`, `raspberry`, `green`, `amber`, `violet` or `pink`; at most 12, each region once |
| `mri` | Magnetic resonance imaging (MRI) window | `centre,width`, centre 0–255, width 1–256, written to 0.1; only when it differs from the published window |
| `tab` | Panel tab | `anatomy`, `functions`, `deficits`, `circuits`, `diffusion` (Tracts) |
| `function`, `deficit` | Open function or deficit | Id; written only from its own tab |
| `zmin` | The open function's **Paint areas from z ≥** | Above the published 3, up to 100, in half steps; written only with `function` |
| `circuit`, `step`, `route` | Guided circuit, step, whole route on screen | Id; step counted from 1; `1`/`0` |
| `map`, `dot` | Visual field map and its dot | Id; `x,y,radius` in degrees from fixation, $\sqrt{x^2+y^2} \le 90$, radius 0.01–90, written to 0.01 |
| `tracts` | Bundles ticked on the Tracts tab | Comma-separated ids, empty for none; omitted while they are the initial set |
| `keeptracts` | **Keep tracts on other tabs** | `1`/`0` |
| `lang` | Language | `en`, `fr` |
| `lesion` | Placed [lesion](lesion-report.md) sphere | `x,y,z,r`: centre in surface RAS (right, anterior, superior) mm to 0.1 mm, each within ±512 mm; $3 \le r \le 30$ mm |
| `lesionmode`, `lesiontract` | Lesion colouring, drawn tract | `lesion` (default), `functions`, `deficits`; bundle id |
| `coord`, `space` | [Published coordinate](published-coordinates.md) and its template | The three numbers as entered, unrounded, each within ±512 mm; space id |
| `cases` | [Stroke cases](stroke-cases.md) | One or two distinct cohort ids, e.g. `M2295,M2294` |
| `embed` | The page is a frame in a course page ([Embedding](#embedding-in-a-course-page)) | `1`/`0`, written last and only while embedded |

### Link writing

`createLinkWriter` writes the link 250 ms after a view change and once the camera settles. The engine reports `cameraSettled` 250 ms after a reader's move ends. `linkState` adds to the session view the plane (mode; the crosshair's offset $\mathbf{c}\cdot\mathbf{n}$ along the plane normal $\mathbf{n}$; reverse, tilt, azimuth), the exact camera (`orbitLink`, null while a named view is held or the tract reference is shown), the MRI window and the lesion and stroke-case stores. A coordinate's sphere is written as the coordinate, never as a lesion.

Some fields are written only where they apply. A function (with its `zmin`), deficit or circuit is written only from its own tab. Stroke cases are written only with a selected region. Bundles are written only from the Tracts tab or while **Keep tracts on other tabs** draws them elsewhere. Highlights are not written while a masthead colour has lifted them. The cortex opacity and colour that drawn streamlines, stroke cases, a painted structure or a whole route impose are written as the reader's own, so the link restores the reader's display. The write is `history.replaceState`, not a push.

Switching subject rewrites the hash and reloads the page. Atlas, cut, view, panel and language are kept. Selection, isolation, hidden regions, the exact camera and the MRI window are dropped, since they belong to the previous brain's parcels and intensities.

### Link restore

At start-up `decodeState` reads the hash. A subject the site does not publish is added to `rejected` and the default opens. `restore` then runs five steps.

1. It takes a command token (`commands.begin`) and holds the writer, so the address bar keeps the link until the scene settles. A later command overtakes the restore, which then stops.
2. It checks each id against the loaded anatomy (`checkLink`): atlas, detail, view, colour, tab, selected, isolated and every hidden region, function, deficit, circuit and step, map, bundles and every highlighted region. An unknown id is dropped and its parameter added to `rejected`. A selected, isolated or highlighted id that names a `non-region` label is refused in the same way. One unknown highlighted region drops the whole `mark`.
3. It applies the cross-field rules. `route` needs `circuit`. `map` is refused beside a `circuit`, and `dot` needs `map`. `cord` needs a published spinal cord. `coord` and `space` need each other and a published space, and a link with both a coordinate and a lesion drops all three. `focus` and `cases` need `region`. `tracts` needs `tab=diffusion` or `keeptracts=1`. `lesionmode` needs `lesion`, and `lesiontract` a bundle that lesion reaches.
4. It applies the scene field by field (`applyReaderState`). A failed step adds its fields to the not-applied list and the rest still applies. A link with a cut but no view faces its cut.
5. It restores the tab, lesson or map, function or deficit, then the lesion, or the coordinate mapped again through its template's field (keeping the link's own cut and camera), then the stroke cases.

`linkNotice` names what was not applied in the reader's language ("Not applied from this link: section position and language."), each parameter by its name in the `link.fields` table. Editing the hash on the same subject applies the new link as scene commands (`onHashChange`). A hash that names another subject reloads the page.

### Image capture

`saveSnapshot` runs five steps in order.

1. The image is planned (`snapshotPlan`). The crop is the visible stage's rectangle. The caption has one line per group of facts (Fig. 1). The first line names the subject. The second gives the atlas, the colouring and the internal-anatomy level, the last only when the masthead offers more than one. The third gives the section (plane and signed offset in mm, with tilt and azimuth for an oblique plane) or, while the camera holds one, the named view. A selection adds "Selected: " and the region named with its side. An [overlay](overlays.md#display) adds its title and scale. [Highlights](dissection-and-display.md#highlights) on the stage add **Your highlights**, "the reader’s own marks, not data" and the regions the key names. A tract reference shown alone replaces the first two lines with its label and drops the section, the selection, the overlay and the highlights. `snapshotMarkings` measures the orientation letters, the stage's labels with their dots and leaders (route landmarks and [names on the brain](dissection-and-display.md#names-on-the-brain)), the visual-field map's area names, the scale bar and each colour key where the stage draws them, in Cascading Style Sheets (CSS) pixels. A key folded on screen is folded in the image.
2. `snapshotFonts` loads the faces and words the marks will draw.
3. The frame is captured (`captureSnapshot`). The settled pipeline is redrawn at the size chosen in the menu of **Save image (PNG)**, 2 or 3 image pixels per CSS pixel whatever the screen's ratio. Without a size the ratio is $\max(\text{screen ratio}, 2)$ (`SNAPSHOT_PIXEL_RATIO` = 2). The frame is read in the same task as the render, and the pipeline then returns to the screen's ratio. A frame wider or taller than the device's `MAX_RENDERBUFFER_SIZE` or `MAX_TEXTURE_SIZE`, or one the browser would draw smaller than asked, is refused before anything is read, with the code `snapshot-too-large` and a message naming the size and the limit. The screen keeps its ratio. The screen ratio is capped for interaction at 1 on phones, 1.5 on coarse-pointer (touch) devices and on integrated graphics processing units (GPUs) other than Apple silicon, and 2 otherwise, never above the device's. The selection outline's `downSampleRatio` is multiplied by the image's ratio over the screen's, so the outline keeps its width relative to the anatomy.
4. The marks are drawn (`annotateSnapshot`) over the captured pixels, which are not resampled or filtered. Layout follows the stage (`SNAPSHOT_LAYOUT`: gutter 16 px, line 16 px, letter gap 12 px, scale gap 8 px), in CSS pixels scaled by the frame's ratio. The caption keeps left of the top orientation letter. Its facts are joined by " · ", a narrow image breaks lines between facts, and a fact that still does not fit is ellipsised. The statement and the scale bar share the bottom line when both fit between the gutters. Otherwise the scale bar moves one line up. Labels under the image's own marks are placed again around their dots.
5. The canvas is encoded as a PNG and downloaded as `planum-<atlas>[-<view>][-<plane>].png` through an object URL revoked after 40 s. A second request while one is being made joins it. A failure raises the `snapshot` notice. A refused size raises `snapshotSize`, which says the image would be larger than this device can draw and to choose a smaller size or window.

**Copy image** puts the 2× PNG on the clipboard instead. The clipboard is asked inside the press with the image still being drawn (a `ClipboardItem` holding a promise), since Safari refuses a write begun once the press is over. **Copy image** is offered only where the browser has `ClipboardItem`.

### Embedding in a course page

A link with `embed=1` opens a page laid out for an `<iframe>`. The page shows the stage alone, at any width, and one line under it. The line names the subject (and a region the reader picked) and holds the statement "Not clinical anatomy", **Full screen** where the frame allows it, and **Open in Planum**, the same view without `embed` in a new tab. There is no masthead, panel, status bar or guided tour. The panels' ports do nothing, so a pick or a link restore cannot fail for want of them. The reader can turn and zoom, read a name by hover or by a tap (the line names the picked region), and move a section the link opened, on the dock's plate without its tools. A colour key the link carries (paint, highlights) stays on the stage. The highlight strip, which lives in the panel, does not.

Nothing of the anatomy loads uninvited. The head prefetch script returns at once for `embed=1`, and the start reads only `anatomies.json` (400 bytes, to name the subject) before it waits for **Load the 3D brain (about 20 MB)** over the site's still picture, `public/preview.png` (its sharing image, 1,200 × 630 px, 511 kB). A cut the link did not open is not prefetched. While embedded, every link the page writes ends in `embed=1`, so a frame the course page reloads stays one.

The size on the button is what the opening view transfers. It was measured on 2026-11-16 over the manifest, the eleven data files it names, the Destrieux cortex and the teaching set, as planumatlas.com served them gzip-compressed (the `Content-Length` of each response). The sum is 21,382,421 bytes, which the page writes as 20 MB because it counts $2^{20}$ bytes to the MB, as its download progress does. The same files are 32.2 MB decompressed as served (the model layers meshopt-compressed) and 39.2 MB in `public/models/`. A link naming another atlas or internal anatomy transfers about 12 MB (Desikan-Killiany with aseg) to 30 MB (HCP-MMP with NextBrain). The button names the opening view's size whatever the link, since the manifest that says which files a link needs is part of what it would download.

**Share this view** in the masthead offers **Copy embed code**. The code is one `<iframe>` of the view on screen with `embed=1`, `loading="lazy"`, `allow="fullscreen"`, `width="800" height="600"`, `style="border: 0; max-width: 100%"` and a title naming the view ("Planum · subject · atlas · section or held view"). Clickjacking protection would need a `frame-ancestors` policy, which only a response header can set, and the site's policy is a meta tag. Embedding is allowed.

### Scale bar

With vertical field of view $\theta$, camera distance $d$ to its target and viewport height $h$ in pixels, one pixel spans

$$s = \frac{2\,d\,\tan(\theta/2)}{h}\ \text{mm}$$

at the target's depth. The bar is the largest length $L$ in {0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1,000} mm whose drawn length $L/s$ lies within 60–150 px (20 mm in Fig. 1). A viewport or distance of zero (a hidden tab) gives no bar.

## Display

The link is the page URL. Copying it (**Share this view** › **Copy link to this view**) shares the scene, and **Copy embed code** gives the frame for a course page. **Save image (PNG)** is in the masthead and opens a menu of **Save at 2×**, **Save at 3×** and **Copy image**. The statement "Planum · Not clinical anatomy" ("Planum · Pas une anatomie clinique" in French) is drawn on every image, and a notice names the saved file. The Back button does not step through camera moves, since the link is replaced in place. The PNG is the visible stage only, not the side panel. [Linked MRI](linked-mri.md#display) saves its own planes. The **Provenance** sheet's **References for this view** lists the works behind the view on screen, to **Copy as text**, **Download .bib** or **Download .ris** ([acknowledgements](../reference/references.md#acknowledgements)).

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| `url-state.test.ts` | Round trip of every non-default field and a fixed link corpus; defaults omitted; repeated, unparsable and out-of-range fields named and left out; cut offset rounded toward zero; up vector only when it differs | passes |
| `url-state.test.ts`, STATE-13 | A decoded camera within an orbit limit up to `ORBIT_ROUNDING_MM` = $2\sqrt{3 \times 0.05^2}$ mm beyond it | accepted at 0.17 mm, refused at 0.18 mm |
| `link-check.test.ts` | Unknown ids and each cross-field rule above | passes |
| `link-writer.test.ts`, `links.test.ts` | Write after stillness, held during a restore; subject and language always written; subject switch reloads; coordinate written as entered, never as a lesion; failed fields named in link order | passes |
| `reader-state.test.ts` | Scene applied field by field; a failed layer, region, system or camera reported under its own field; a restore overtaken by a later command stops | passes |
| `snapshot.test.ts`, `snapshot.svelte.test.ts`, `snapshot.drawing.svelte.test.ts` (in `features/snapshot/`) | Caption facts and packing, ellipsis, bottom-line placement; file name; one file for two requests; URL revoked at 40 s; only marks added to the frame | passes |
| `engine/snapshot.svelte.test.ts`, `contract.test.ts` | Captured canvas sized to its crop at ≥ 2 pixels per CSS pixel; screen canvas unchanged | passes |
| `engine/snapshot.svelte.test.ts`, `contract.test.ts`, `snapshot-size.svelte.test.ts` (SNAP-20, SNAP-21) | A 3× frame of a 400 × 300 stage is 1,200 × 900 px with the brain drawn, its caption 2.85–3.15 times as tall and wide as at 1×; a frame past the limit read as 1,024 px is refused with its size and the limit, and the stage keeps its ratio | added 2026-11-16 |
| `embed.test.ts`, `embed.svelte.test.ts`, `prefetch.test.ts` (SHELL-19 to SHELL-21, BOOT-35, ASSET-23) | An embedded link fetches no `models/` file and creates no engine before the click; **Open in Planum** carries the view without `embed`; the embed code's attributes; the frame's layout at 1,280 and 390 px | added 2026-11-16 |
| `scale-bar.test.ts` | Frustum geometry; 1-2-5 lengths; bar within 60–150 px at every usable distance; no bar for a zero viewport | passes |

## Limitations

A link names ids of one published build. A renamed or dropped region, atlas or layer is refused and named.

The camera travels to 0.1 mm. A link written at an orbit limit reads back up to 0.17 mm beyond it.

A link carries state, not data. A reader's overlay, a dissection's undo history and a lesion's measurements are not in it. The lesion is measured again and a coordinate mapped again on restore.

The scale bar is exact only at the depth of the camera's target.

The download size an embedded frame names is the opening view's. A link naming a larger atlas or NextBrain transfers up to about 30 MB. The size was measured once and is not recomputed by the build.

An embedded frame shows no panel. What a link would open there (a function's profile, a lesion's report, the Tracts tab's bundles) is not shown, and a notice is spoken but not drawn. The still picture is the site's sharing image, not the linked view.

A size the device cannot render is refused rather than tiled. A 3× image of a large stage can pass a small mobile GPU's limit.

The PNG is not clinical anatomy and states so.

## Code availability

Code
: [`web/src/lib/core/state/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/lib/core/state) (`url-state.ts`, `link-check.ts`, `link-writer.ts`, `reader-state.ts`), [`web/src/lib/controller/links.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/controller/links.ts), [`web/src/lib/state/link.svelte.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/state/link.svelte.ts), [`web/src/features/snapshot/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/features/snapshot) (`snapshot.ts`, `markings.ts`), `captureSnapshot` in [`web/src/lib/engine/render/renderer.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/engine/render/renderer.ts), [`web/src/lib/engine/render/scale-bar.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/engine/render/scale-bar.ts)
: Embedding: [`web/src/lib/core/embed.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/embed.ts), [`web/src/features/embed/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/features/embed), [`web/src/boot/prefetch.js`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/boot/prefetch.js), [`web/src/app/boot.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/app/boot.ts)

Configuration
: None. The constants are `SNAPSHOT_PIXEL_RATIO` in `renderer.ts`, `SNAPSHOT_LAYOUT` in `markings.ts`, `ORBIT_ROUNDING_MM` in `url-state.ts` and `OPENING_DOWNLOAD_MB` in `embed.ts`.

Tests
: `web/src/lib/core/state/*.test.ts`, `web/src/lib/controller/links.test.ts`, `web/src/features/snapshot/*.test.ts`, `web/src/lib/engine/render/scale-bar.test.ts`, `web/src/lib/engine/snapshot.svelte.test.ts`, `web/src/lib/engine/contract.test.ts`, `web/src/lib/core/embed.test.ts`, `web/src/app/embed.svelte.test.ts`, `web/src/boot/prefetch.test.ts`

```bash
npm test --prefix web -- src/lib/core/state src/lib/controller/links.test.ts src/features/snapshot src/lib/engine/render/scale-bar.test.ts src/lib/engine/contract.test.ts src/lib/core/embed.test.ts src/boot/prefetch.test.ts
npm run test:browser --prefix web -- src/features/snapshot src/lib/engine/snapshot.svelte.test.ts src/app/embed.svelte.test.ts
```

