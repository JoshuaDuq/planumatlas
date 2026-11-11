# Sharing and snapshots

The address bar holds the viewer's scene as a URL fragment that restores it field by field, and **Save image** writes the visible stage as an annotated PNG (Portable Network Graphics) file. Both are built in the browser from state the viewer already holds; neither needs a server. A link names ids of one published build and carries state, not data: what a later build renames or drops is refused and named, and the reader's own [overlay](overlays.md) is never written into it.

```{figure} figures/sharing-and-snapshots-1.webp
:alt: A saved PNG of a coronal section of a brain coloured by region on a black ground, with a three-line caption at the top left, orientation letters at the four edges, a 20 mm scale bar at the bottom right and the statement "Planum · Not clinical anatomy" at the bottom left.
:name: fig-sharing-and-snapshots-1

**The PNG that Save image writes, unretouched.** The viewer was opened at `#anatomy=cdmd&cut=coronal&pos=-20` in a 1,400 × 900 px window at a device pixel ratio of 1; its 1,040 × 820 CSS-pixel stage was saved at 2 pixels per CSS pixel, 2,080 × 1,640 px. The caption gives the subject; atlas, colouring and internal-anatomy level; plane and signed offset. The orientation letters, the 20 mm scale bar (exact at the camera target's depth) and the statement are drawn over the rendered frame. The section is seen from the front (right hemisphere on the image's left). The file was named `planum-destrieux-anterior-coronal.png`. Once the scene settled the address bar read `#anatomy=cdmd&atlas=destrieux&cuts=destrieux&detail=learning&view=anterior&cut=coronal&pos=-20&lang=en`: the link, which named no view, faced its cut, and the writer added the atlas, cut labels, level, the view now held and the language.
```

## Data
The viewer's own state; the ids a link may name are those the loaded anatomy publishes (`anatomies.json`, the anatomy's `manifest.json`, the function, deficit, circuit and tract catalogues).

## Method

### Link encoding
The state travels in the URL hash as `URLSearchParams` (`url-state.ts`). `encodeState` omits every field still at its default (`DEFAULTS`) and un-escapes `%3A` and `%2C`, so ids and coordinates stay readable. `decodeState` reads each parameter with its own typed reader; a parameter that is repeated or does not parse is left out and named in `rejected`, and the fields beside it still decode. A written link always names its subject (`anatomy`), its cortical atlas and its language.

| Parameter | State | Format and range |
| :--- | :--- | :--- |
| `anatomy` | Subject | Published anatomy id; absent, the published default. Region ids are shared between brains, so the subject travels with them |
| `atlas`, `cuts`, `system`, `detail` | Cortical atlas, cut labels, internal-anatomy system and level | Ids |
| `region`, `isolate` | Selected and isolated region | Region id |
| `hidden` | Hidden regions | Comma-separated ids, sorted; a repeated id is read once |
| `focus` | Focus | `1`/`0` |
| `view` | Named view | `oblique` (default), `left`, `right`, `anterior`, `posterior`, `superior`, `inferior` |
| `cam` | Exact camera | `px,py,pz,tx,ty,tz` (position, target) in mm to 0.1 mm, optionally three more numbers for the up vector to 0.001; each of the first six within ±100,000 mm |
| `cut` | Plane | `sagittal`, `coronal`, `axial`, `oblique` |
| `pos` | Offset along the plane normal | mm, written to 0.1 mm rounded toward zero (`towardZero`); read within ±512 mm |
| `rev`, `tilt`, `az` | Reversed side, tilt, azimuth | `1`/`0`; whole degrees 0 to 90; whole degrees −180 to 180 |
| `hemi` | Hemisphere | `both`, `left`, `right` |
| `cortex`, `internal`, `cord` | Cortex, internal anatomy, spinal cord shown | `1`/`0` |
| `opacity` | Cortex opacity | 0 to 1, written to 0.01 |
| `colors` | Surface colour | `tissue`, `mri`, `lobe`, `atlas` (the default of a link; a page opened without one shows `lobe`), `network`, `cab-np`, `territory`; the former flag `1`/`0` reads as `atlas`/`tissue` |
| `mri` | MRI window | `centre,width`, centre 0 to 255, width 1 to 256, written to 0.1; only when it differs from the published window |
| `tab` | Panel tab | `anatomy`, `functions`, `deficits`, `circuits`, `diffusion` (Tracts) |
| `function`, `deficit` | Open function or deficit | Id; written only from its own tab |
| `circuit`, `step`, `route` | Guided circuit, step, whole route on screen | Id; step counted from 1; `1`/`0` |
| `map`, `dot` | Visual field map and its dot | Id; `x,y,radius` in degrees from fixation, $\sqrt{x^2+y^2} \le 90$, radius 0.01 to 90, written to 0.01 |
| `tracts` | Bundles ticked on the Tracts tab | Comma-separated ids, empty for none; omitted while they are the initial set |
| `lang` | Language | `en`, `fr` |
| `lesion` | Placed [lesion](lesion-report.md) sphere | `x,y,z,r`: centre in surface RAS mm to 0.1 mm, each within ±512 mm; $3 \le r \le 30$ mm |
| `lesionmode`, `lesiontract` | Lesion colouring, drawn tract | `lesion` (default), `functions`, `deficits`; bundle id |
| `coord`, `space` | [Published coordinate](published-coordinates.md) and its template | The three numbers as entered, unrounded, each within ±512; space id |
| `cases` | [Stroke cases](stroke-cases.md) | One or two distinct cohort ids, e.g. `M2295,M2294` |

### Link writing
`createLinkWriter` writes 250 ms after a view change and once the camera settles (the engine's `cameraSettled`, itself 250 ms after a reader's move ends). `linkState` adds to the session view the plane (mode; the crosshair's offset $\mathbf{c}\cdot\mathbf{n}$ along the plane normal $\mathbf{n}$; reverse, tilt, azimuth), the exact camera (`orbitLink`, null while a named view is held or the tract reference is shown), the MRI window and the lesion and stroke-case stores. A coordinate's sphere is written as the coordinate, never as a lesion. A function, deficit or circuit is written only from its own tab, stroke cases only with a selected region, bundles only from the Tracts tab. The cortex opacity and colour that drawn streamlines, stroke cases, a painted structure or a whole route impose are written as the reader's own, so the link restores the reader's display. The write is `history.replaceState`, not a push.

Switching subject rewrites the hash and reloads the page: atlas, cut, view, panel and language are kept; selection, isolation, hidden regions, the exact camera and the MRI window are dropped, since they belong to the previous brain's parcels and intensities.

### Link restore
At start-up `decodeState` reads the hash; a subject the site does not publish is added to `rejected` and the default opens. `restore` then:

1. Takes a command token (`commands.begin`) and holds the writer, so the address bar keeps the link until the scene settles. A later command overtakes the restore, which then stops.
2. Checks each id against the loaded anatomy (`checkLink`): atlas, detail, cut atlas, view, colour, tab, selected, isolated and every hidden region, function, deficit, circuit and step, map, bundles. An unknown id is dropped and its parameter added to `rejected`.
3. Applies cross-field rules: `route` needs `circuit`; `map` is refused beside a `circuit`, and `dot` needs `map`; `cord` needs a published spinal cord; `coord` and `space` need each other and a published space, and a link with both a coordinate and a lesion drops all three; `focus` and `cases` need `region`; `tracts` needs `tab=diffusion`; `lesionmode` needs `lesion`, and `lesiontract` a bundle that lesion reaches.
4. Applies the scene field by field (`applyReaderState`); a failed step adds its fields to the not-applied list and the rest still applies. A link with a cut but no view faces its cut.
5. Restores the tab, lesson or map, function or deficit, then the lesion, or the coordinate mapped again through its template's field (keeping the link's own cut and camera), then the stroke cases.

`linkNotice` names what was not applied in the reader's language ("Not applied from this link: section position and language."), each parameter by its name in the `link.fields` table. Editing the hash on the same subject applies the new link as scene commands (`onHashChange`); another subject reloads the page.

### Image capture
`saveSnapshot` runs in order:

1. **Plan** (`snapshotPlan`). The crop is the visible stage's rectangle. The caption has one line per group of facts: the subject; the atlas, the colouring and the internal-anatomy level (the last only when the masthead offers more than one); then the section (plane and signed offset in mm, with tilt and azimuth for an oblique plane) or, while the camera holds one, the named view; then, with an [overlay](overlays.md#display), its title and scale. A tract reference shown alone replaces the first two lines with its label. `snapshotMarkings` measures the orientation letters, route-landmark labels with their dots and leaders, the scale bar and each colour key where the stage draws them, in CSS pixels; a key folded on screen is folded in the image.
2. **Fonts.** `snapshotFonts` loads the faces and words the marks will draw.
3. **Capture** (`captureSnapshot`). The settled pipeline is redrawn at $\max(\text{screen ratio}, 2)$ device pixels per CSS pixel (`SNAPSHOT_PIXEL_RATIO` = 2), read in the same task as the render, then returned to the screen's ratio. The screen ratio is capped for interaction at 1 on phones, 1.5 on coarse-pointer (touch) devices and on integrated graphics processors other than Apple silicon, and 2 otherwise, never above the device's. The selection outline's `downSampleRatio` is multiplied by the same factor, so the outline keeps its width relative to the anatomy.
4. **Annotate** (`annotateSnapshot`). Marks are drawn over the captured pixels, which are not resampled or filtered. Layout follows the stage (`SNAPSHOT_LAYOUT`: gutter 16 px, line 16 px, letter gap 12 px, scale gap 8 px), in CSS pixels scaled by the frame's ratio. The caption keeps left of the top orientation letter; its facts are joined by " · ", a narrow image breaks lines between facts, and a fact that still does not fit is ellipsised. The statement and the scale bar share the bottom line when both fit between the gutters; otherwise the scale bar moves one line up. Labels under the image's own marks are placed again around their dots.
5. **Save.** The canvas is encoded as a PNG and downloaded as `planum-<atlas>[-<view>][-<plane>].png` through an object URL revoked after 40 s. A second request while one is being made joins it. A failure raises the `snapshot` notice.

### Scale bar
With vertical field of view $\theta$, camera distance $d$ to its target and viewport height $h$ in pixels, one pixel spans

$$s = \frac{2\,d\,\tan(\theta/2)}{h}\ \text{mm}$$

at the target's depth. The bar is the largest length in {0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1,000} mm whose length $L/s$ lies within 60 to 150 px. A viewport or distance of zero (a hidden tab) gives no bar.

## Display
The link is the page URL; copying it shares the scene. **Save image** is in the masthead; the statement "Planum · Not clinical anatomy" ("Planum · Pas une anatomie clinique" in French) is drawn on every image, and a notice names the saved file. The Back button does not step through camera moves, since the link is replaced in place. The PNG is the visible stage only, not the side panel; [Linked MRI](linked-mri.md#display) saves its own planes.

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| `url-state.test.ts` | Round trip of every non-default field and a fixed link corpus; defaults omitted; repeated, unparsable and out-of-range fields named and left out; cut offset rounded toward zero; up vector only when it differs | passes |
| `url-state.test.ts`, STATE-13 | A decoded camera within an orbit limit up to `ORBIT_ROUNDING_MM` = $2\sqrt{3 \times 0.05^2}$ beyond it | accepted at 0.17 mm, refused at 0.18 mm |
| `link-check.test.ts` | Unknown ids and each cross-field rule above | passes |
| `link-writer.test.ts`, `links.test.ts` | Write after stillness, held during a restore; subject and language always written; subject switch reloads; coordinate written as entered, never as a lesion; failed fields named in link order | passes |
| `reader-state.test.ts` | Scene applied field by field; a failed layer, region, system or camera reported under its own field; a restore overtaken by a later command stops | passes |
| `snapshot.test.ts`, `snapshot.svelte.test.ts`, `snapshot.drawing.svelte.test.ts` | Caption facts and packing, ellipsis, bottom-line placement; file name; one file for two requests; URL revoked at 40 s; only marks added to the frame | passes |
| `index.svelte.test.ts`, `contract.test.ts` | Captured canvas sized to its crop at ≥ 2 pixels per CSS pixel; screen canvas unchanged | passes |
| `scale-bar.test.ts` | Frustum geometry; 1-2-5 lengths; bar within 60–150 px at every usable distance; no bar for a zero viewport | passes |

## Limitations
- A link names ids of one published build; a renamed or dropped region, atlas or layer is refused and named.
- The camera travels to 0.1 mm; a link written at an orbit limit reads back up to 0.17 mm beyond it.
- A link carries state, not data: a reader's overlay, a dissection's undo history and a lesion's measurements are not in it; the lesion is measured again and a coordinate mapped again on restore.
- The scale bar is exact only at the depth of the camera's target.
- The PNG is not clinical anatomy and states so.

## Code availability

| | |
| :--- | :--- |
| Code | [`web/src/lib/core/state/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/lib/core/state) (`url-state.ts`, `link-check.ts`, `link-writer.ts`, `reader-state.ts`), [`web/src/lib/controller/links.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/controller/links.ts), [`web/src/lib/state/link.svelte.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/state/link.svelte.ts), [`web/src/features/snapshot/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/features/snapshot) (`snapshot.ts`, `markings.ts`), `captureSnapshot` in [`web/src/lib/engine/render/scene.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/engine/render/scene.ts), [`web/src/lib/engine/render/scale-bar.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/engine/render/scale-bar.ts) |
| Configuration | None; `SNAPSHOT_PIXEL_RATIO` in `scene.ts`, `SNAPSHOT_LAYOUT` in `markings.ts`, `ORBIT_ROUNDING_MM` in `url-state.ts` |
| Tests | `web/src/lib/core/state/*.test.ts`, `web/src/lib/controller/links.test.ts`, `web/src/features/snapshot/*.test.ts`, `web/src/lib/engine/render/scale-bar.test.ts`, `web/src/lib/engine/index.svelte.test.ts`, `web/src/lib/engine/contract.test.ts` |

```bash
npm test --prefix web -- src/lib/core/state src/lib/controller/links.test.ts src/features/snapshot src/lib/engine/render/scale-bar.test.ts src/lib/engine/contract.test.ts
npm run test:browser --prefix web -- src/features/snapshot src/lib/engine/index.svelte.test.ts
```

Figure state: https://planumatlas.com/#anatomy=cdmd&cut=coronal&pos=-20, then **Save image**.
