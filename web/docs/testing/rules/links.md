# Links rules

Scope: chunk S4 (#35), the permalink in the running app: what the address bar carries and when
it is written, switching subject through the link, a link edited in place, restoring a link at
boot or on `hashchange`, the notice for what a link could not apply, and the scene reader
(`captureReaderState`, `applyReaderState`) other controllers use. Legacy sources:
`viewer/app.js:236-254` (writer), `636-650` (another subject), `1753-1780` (link state),
`1825` and `1658` (when it is written), `1992-2093` (known ids, `restoreLink`, `onHashChange`),
`2111-2132` (boot), `viewer/i18n/errors.js` (`linkNotice`). New code:
`web/src/lib/controller/links.ts`, `web/src/lib/state/link.svelte.ts` (the writer's timing),
`web/src/lib/core/i18n/errors.ts` (`linkNotice`). Decisions: link timing (comment 67 on #4),
decision 8 (link-edited language, scene reader), decision 30 (the camera's parts are E7's).
The link's text format and the pure steps a restore is made of are in `core-state.md`
(STATE-01 to STATE-41, STATE-63 to STATE-65); the camera as a link carries it in `engine-e7.md`
(FACADE-24 to FACADE-26); the boot sequence around the restore in `boot-and-assets.md`
(BOOT-05, BOOT-07 to BOOT-09, BOOT-14). The unit tests run `createLinks` over the fake engine
on the cdmd manifest; "the corpus" below was the fixed scenario table of the deleted `parity/S4.test.ts`; each rule is now a fixed case in `src/lib/controller/links.test.ts`.

## Writing the link

### LINK-01 · The address bar is replaced with the scene, never pushed

- **Rule:** The link is written with `history.replaceState`, so Back is not a camera undo stack. A scene that writes nothing leaves the bare page address, with its query string.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:242-246`
- **Expected:** default scene with hemisphere left on page `/neuroatlas/?x=1` → one `replaceState(null, '', '#anatomy=cdmd&…hemi=left&lang=en')`. An empty encoding → `replaceState(null, '', '/neuroatlas/?x=1')`. `pushState` is never called.
- **Covered by:** `src/lib/controller/links.test.ts` (R; the empty-encoding case is uncovered)

### LINK-02 · The link always names its brain and the reader's language

- **Rule:** Region ids are shared between brains, so the link always carries the anatomy on screen, and it carries the session language so a shared link opens in it.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1773-1780`
- **Expected:** any written link on cdmd starts `#anatomy=cdmd&` and ends `&lang=en` (or `lang=fr`).
- **Covered by:** `src/lib/controller/links.test.ts` (R)

### LINK-03 · The link carries the cut the sections hold, the lesson, the camera and the MRI window

- **Rule:** The plane is not session state but belongs in the link: when a sagittal, coronal, axial or oblique plane is cut, the link carries its mode, its position along the plane's normal, its side, tilt and azimuth; otherwise no cut fields. It carries the open lesson and its step (step 0 without a lesson), the camera from the engine's orbit link and the MRI window the sections report.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1753-1780`
- **Expected:** coronal at offset 12.34 → `{ cut: 'coronal', cutOffset: <sections.offset> }`, written `cut=coronal&pos=12.3`. Oblique, angles (40, -60), reversed → `{ cut: 'oblique', cutReverse: true, cutTilt: 40, cutAzimuth: -60 }`. `orbit` equals `camera.orbitLink()`; window (50, 60) → `mriWindow: { center: 50, width: 60 }`. Lesson `language` at step 2 → `circuit: 'language', circuitStep: 2`; none → `circuitStep: 0`.
- **Covered by:** `src/lib/controller/links.test.ts` (R)

### LINK-04 · Retired

Retired 2026-11-17 by derived cut labels. It required a scene captured before the model had its own cut atlas to take the one the sections held (`viewer/app.js:749-758`). A scene and a link no longer carry a cut atlas: the sections derive it from the atlas, colouring and internal anatomy (SLICE-21), and an old link's `cuts` is ignored (STATE-02).

### LINK-05 · The link follows the reader about 250 ms after the scene rests

- **Rule:** A change of view state writes the link 250 ms after the last change. A reader's camera move writes it when the engine reports the camera settled, which already comes 250 ms after the move ends, so the link lands about 250 ms after rest, not 500. A camera move after a view change writes once, at rest. Nothing is written while a restore holds the writer, or once the component is gone.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:243-254,1658,1825`; `viewer/state/link-writer.js:7`; decision on link timing (comment 67 on #4)
- **Expected:** fake timers: first write at +250 ms; two view changes then +249 ms → no new write, +1 ms → one. `cameraSettled` then +1 ms → one write. View change then `cameraSettled` → one write, none 250 ms later. Held, view change, +250 ms → no write; released and scheduled, +250 ms → one. Cleaned up, then changes and `cameraSettled`, +1000 ms → none.
- **Covered by:** `src/lib/state/stores.svelte.test.ts` (R, browser; could move down: the timing is pure once the effect is replaced by a call, see STATE-63 and STATE-64); `src/lib/core/state/link-writer.test.ts` (R, the writer itself)

### LINK-24 · An embedded page keeps embed=1 in the link it writes

- **Rule:** A page opened with `embed=1` writes `embed=1` at the end of every link it writes, so a frame the course page reloads (browsers restore a frame's last address) opens embedded again. Any other page writes no `embed`.
- **Kind:** behaviour
- **Level:** unit
- **Source:** Planum improvement plan 2, WP25
- **Expected:** links created with `embedded: true`, `write()` → one `replaceState` to `#anatomy=cdmd&…&embed=1`; without it → an address with no `embed`.
- **Covered by:** `src/lib/controller/links.test.ts` (R)

## Another subject

### LINK-06 · Choosing another subject reopens the page on its link

- **Rule:** Another brain is another set of files, so choosing it cancels a pending write, replaces the link with the reader's atlas, cut, view, panel and language on the new anatomy, and reloads. Selection, isolation, hidden parts, the exact camera and the MRI window belong to the old subject and are dropped. Choosing the subject on screen does nothing.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:636-650`
- **Expected:** on `snail` with hcp-mmp, view left, Deficits on aphasia, a region selected, a part hidden, fr, coronal at 12.34 and window (50, 60): `switchAnatomy('bert')` → calls `cancel`, `replace`, `reload` in that order; the replaced link decodes to `{ anatomy: 'bert', atlas: 'hcp-mmp', cut: 'coronal', detail: 'learning', cutOffset: 12.3, view: 'left', explorer: 'deficits', selectedDeficit: 'aphasia', lang: 'fr' }`. `switchAnatomy('cdmd')` on cdmd → no call. The link is replaced, not pushed (LINK-01), so Back does not return to the brain just left. In the app the Subject field appears only with two published subjects; the published index has one today.
- **Covered by:** `src/lib/controller/links.test.ts` (R; anatomy ids are opaque strings there)

## A link edited in place

### LINK-07 · A link edited for another brain reloads the page and applies nothing

- **Rule:** When the edited link names another brain than the one on screen (an omitted anatomy meaning the published default), the page reloads to open it; nothing is applied to the current scene.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:2082-2087`
- **Expected:** on cdmd, hash `#anatomy=other&hemi=left` → one reload, hemisphere still `both`. On a non-default subject, `#hemi=left` → one reload.
- **Covered by:** `src/lib/controller/links.test.ts` (R); the subject test itself: STATE-65

### LINK-08 · A link edited for the same brain is applied, and its language is followed, unless one is saved, and not saved

- **Rule:** The same brain takes an edited link as scene commands. A language in it becomes the session's and the page's (`<html lang>`, WCAG 3.1.1) only while the reader has saved none; a saved language wins (STORE-22), and the session keeps the language in effect (`followLanguage` returns it). A link's language is never saved as the reader's preference; a link without one leaves the language alone. What it could not apply is said in one notice.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:2082-2093`; decision 8 on #4; handoff U15 (plan 2 WP36)
- **Expected:** `#hemi=left&lang=fr&atlas=missing` → hemisphere left, session `fr`, notice matches `/atlas/i`. `#hemi=left` → `followLanguage` not called; `#lang=fr` → called once with `fr`. With the real language store: nothing stored, `#lang=fr` → `document.documentElement.lang` `fr`, session `fr`, `planum-lang` still unset; `planum-lang` stored as `en`, `#lang=fr` → `<html lang>` `en`, session `en`, `planum-lang` still `en`.
- **Covered by:** `src/lib/controller/links.test.ts` (R); `src/lib/controller/links.svelte.test.ts` (R, browser for `<html lang>` and `localStorage` through `createLanguage`'s `follow`; the store's own cases are STORE-22's)

### LINK-08a · An edited link that throws still ends its notice hold

- **Rule:** Applying an edited link holds notices until it settles (LINK-17). If applying it throws, the error still surfaces, but the hold ends first, so every later notice is said.
- **Kind:** behaviour
- **Level:** unit
- **Source:** state-machine audit 2026-11-09 (`onHashChange` released the hold only after a successful restore)
- **Expected:** a `forgetScenes` hook that throws `boom`, `#hemi=left` → `onHashChange()` rejects with `boom`; `notify({ text: 'Later.' })` → notice text `Later.`.
- **Covered by:** `src/lib/controller/links.test.ts` (R)

## Restoring a link

### LINK-09 · A link may name only what this build publishes

- **Rule:** A restore judges the link against what this anatomy and build publish (STATE-18): its atlases and detail levels, the seven views, the explorer tabs, the colourings it publishes (tissue, mri, lobe and atlas always; network, cab-np, territory, striatal and cerebellar only when published), the functions (all, each domain and each Neurosynth term), the deficits of the clinical catalogue, the circuits with their step counts, and the cord when published. A build without neuropsychological domains cannot restore links at all.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1992-2006`
- **Expected:** cdmd: `colors=tissue&function=language&tab=functions` passes; `colors=functional`, no longer a colouring → `colors` not applied. `function=term-a` passes when `term-a` is a published term. `deficit=bogus` → `deficit` not applied. Creating links with `model.domains` null throws "This build publishes no neuropsychological domains for the Functions tab."
- **Covered by:** `src/lib/controller/links.test.ts` (R)

### LINK-10 · The notice names first what did not read, then what this anatomy lacks, then what failed

- **Rule:** The fields a link could not apply are, in order: those that did not parse (STATE-06), those naming what this anatomy does not publish (LINK-09), then those whose step failed while applying (STATE-38). A failed step is reported under the fields of it the link named, or else its first field.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:2024,2033-2038`
- **Expected:** `atlas=missing&view=sideways&hemi=left` → `['atlas', 'view']`, hemisphere left. `pos=abc&tilt=999&opacity=2&mri=1,2,3` → those four parameters, in link-field order. A busy scene with a cut on, `hemi=left`, where turning the cut off throws → `['cut']`. `cut=coronal&pos=3&rev=1` where cutting throws → `['cut', 'rev', 'pos']` (the step's field order, filtered to those named).
- **Covered by:** `src/lib/controller/links.test.ts` (R)

### LINK-11 · A link names only the parts it holds; the rest of the scene goes to the defaults

- **Rule:** A restored link is a whole scene: fields it does not name take their defaults (STATE-35), so a link without a cut turns a cut off and one without isolation clears it. The atlas defaults to the manifest's first and the detail to the anatomy's default level; the cut atlas follows from them (SLICE-21).
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:2025-2031`
- **Expected:** cdmd, a busy scene (lesson open, region selected, coronal cut, window 50/60), `hemi=right` → atlas destrieux, detail `learning`, cut atlas destrieux, no cut, no selection, the published MRI window, hemisphere right. A link without `atlas` on an hcp-mmp scene → atlas destrieux, the manifest's first.
- **Covered by:** `src/lib/controller/links.test.ts` (R)

### LINK-12 · Without a view of its own, a link with a cut faces its cut

- **Rule:** A link that names a cut and no view frames the face of the cut, as choosing the cut does; a link with a view of its own, or without a cut, frames its named view.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:2026-2029`; `viewer/render/camera-views.js` (`viewForRestoredCut`)
- **Expected:** `cut=coronal&pos=-12.5&rev=1` → `camera.faceCut` is called and the session view becomes the view it reports; `cut=axial&view=left` → view left; `cut=axial&rev=1&view=superior` → view superior; `cut=oblique&tilt=40&az=-60&pos=3` → faces the oblique plane.
- **Covered by:** `src/lib/controller/links.test.ts` (R)

### LINK-13 · A link ends the Tracts excursion before applying its display, unless it opens Tracts

- **Rule:** When the Tracts excursion is open (the cortex made translucent for it), a link that does not open the Tracts tab first switches to its own tab (or Anatomy), which ends the excursion, before its display settings apply.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:2019-2023`
- **Expected:** Tracts open, `tab=anatomy` → `chooseExplorer('anatomy')` before any scene step, then again after; `tab=diffusion` → no early switch.
- **Covered by:** `src/lib/controller/links.test.ts` (R)

### LINK-14 · After the scene, the link opens its tab, function, deficit and lesson

- **Rule:** Once the scene is applied, the scenes kept to return to after an excursion or a lesson are forgotten (CTRL-37), the link's tab is chosen (Anatomy by default), its function and deficit are set (none when absent), and its lesson is started at its step, or any open lesson closed.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:2039-2050`
- **Expected:** `tab=functions&function=language` → explorer `functions`, function `language`, deficit null, lesson closed, both kept scenes null. `tab=circuits&circuit=language&step=2` → lesson `language` at step 1. `tab=circuits&circuit=bogus&step=9` → notApplied `['circuit', 'step']` (the notice names only the circuit, LINK-18), lesson closed. At boot the panels are mounted before the link is applied, so `#tab=functions&function=<id>` shows the detail with that function open.
- **Covered by:** `src/lib/controller/links.test.ts` (R); `src/app/boot.svelte.test.ts` (R, the boot half: a function link opens its detail)

### LINK-15 · A lesson linked without its landmark opens on it

- **Rule:** A link that opens a lesson on Circuits and names no region opens the step's landmark, as choosing that step does, after keeping the scene as it now stands to return to when the lesson is left. A landmark that fails reports `step`; one overtaken by a later command ends the restore. A link that names the landmark keeps nothing of the display a lesson open before it set: Reset display counts from the defaults, as on a fresh load of the link.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:2051-2063`; changed 2026-11-09 (audit: an earlier lesson's display outlived the link)
- **Expected:** `tab=circuits&circuit=language&step=2` → `rememberLessonScene` with a scene carrying a camera, then `openLandmark('destrieux:left:2')`. Landmark throws → notApplied ends with `step`. Landmark overtaken → `restore` returns null. With `region=destrieux:left:1` → no landmark opened. Lesson A on a step, then a link to lesson B's step with its region → `displayBaseline` equals `DEFAULT_DISPLAY`.
- **Covered by:** `src/lib/controller/links.test.ts` (R)

### LINK-16 · The panel opens on what the link names, without raising the sheet

- **Rule:** When the link opens a function on Functions, a deficit on Deficits or a lesson on Circuits, the workspace shows its detail without raising a phone's sheet over the link's camera. A link naming a function or deficit but no atlas was not written from a view of it, so the item is opened as choosing it opens it: its regions drawn, painted and framed.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:2064-2073`
- **Expected:** `tab=functions&function=language` → `showDetail`, then `openFunction('language')`. `tab=functions&function=language&atlas=destrieux` → `showDetail` only. `tab=deficits&deficit=aphasia&atlas=destrieux` → `showDetail` only; without the atlas → `openDeficit('aphasia')`. `tab=anatomy` → neither.
- **Covered by:** `src/lib/controller/links.test.ts` (R); the non-raising port: `src/app/boot.svelte.test.ts` (BOOT-09)

### LINK-17 · A restore holds the address bar and the notices until it settles, and an overtaken one says nothing

- **Rule:** While a link is restored, the address bar keeps the link and notices wait (STATE-32, STATE-64). When it ends the hold is released and the link written once. A restore overtaken by a later command returns null, says nothing of its own, and still releases its holds.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:2013-2018,2074-2079`
- **Expected:** `atlas=missing&view=sideways&hemi=left` → hold once, schedule once, `['atlas','view']`; a notice "Later." raised before `report` is not shown until `report`, then the shown text contains it. `hemi=left&cortex=0` where `setHemisphere` starts a new command → null, cortex still shown, release once, `report(null)` shows nothing.
- **Covered by:** `src/lib/controller/links.test.ts` (R, + I: the hold, schedule and release counts are spied calls)

### LINK-18 · The link notice names the fields in the reader's words, once each

- **Rule:** Stated once as I18N-20 (`core-i18n.md`); this entry only points there, so the rule is tested once.
- **Kind:** behaviour
- **Level:** see I18N-20
- **Source:** see I18N-20
- **Expected:** see I18N-20
- **Covered by:** see I18N-20

### LINK-19 · A restored hidden count is said once, if the announcer exists before the restore

- **Rule:** The view announcer must exist before the first restore: its first view only records the hidden count, so a link that hides parts changes it and the count is said once. Created after, the restored count is never said. The dissection bar itself does not announce the restored count.
- **Kind:** behaviour
- **Level:** browser — the announcer's live region is a DOM node
- **Source:** `viewer/app.js:2124-2130`; S1 contract on #4 (comment on `announceView`); deviation `a3-initial-count.md`
- **Expected:** announcer first, `restore(hidden=<first published region>)` → live region "1 part hidden". Announcer after → region empty, one part hidden. Whole app: boot with `#hidden=<region>` → the live region reads "1 part hidden".
- **Covered by:** `src/lib/controller/links.svelte.test.ts` (R); `src/app/boot.svelte.test.ts` (R, a boot with `#hidden=`)

### LINK-22 · A Tracts link carries its ticked bundles, and the Tracts panel draws them

- **Rule:** On the Tracts tab the link carries the ticked bundles as `tracts=`, in catalog order: left out while they are the catalog's initial ones (or the tab has not loaded), empty when none is ticked. Off the tab it carries none, and a link naming them off the tab has them rejected. A Tracts link hands its bundles (the initial ones when it names none) to the Tracts panel, which draws exactly those under its own busy and failure handling without holding the restore; the link keeps them until they are drawn.
- **Kind:** behaviour
- **Level:** unit
- **Source:** new (no legacy counterpart)
- **Expected:** after ticking `slf-left` and unticking `af-left` → `tracts: ['cst-right', 'slf-left']`; all unticked → `tracts: []`, written `tracts=`. `tab=diffusion&tracts=slf-left` → `showTracts(['slf-left'])`, the link still `['slf-left']` until it resolves; `tab=diffusion` → `showTracts(['af-left', 'cst-right'])`; `tab=functions&tracts=slf-left` → `['tracts']`. Boot on `#tab=diffusion&tracts=slf-left` → the port is called with `['slf-left']` and the address bar keeps it.
- **Covered by:** `src/lib/controller/links.test.ts` (R); `src/lib/core/state/url-state.test.ts`, `src/lib/core/state/link-check.test.ts` (R, the field); `src/features/tracts/TractsExplorer.svelte.test.ts` (R, browser: drawing, the download and its failure); `src/app/boot.svelte.test.ts` (R, browser)

### LINK-26 · A link carries names on the brain, and applying one sets them

- **Rule:** While names on the brain are on, the link writes `names=1`; off, it writes nothing. A link is a whole scene: one with `names=1` turns them on, one without turns them off, and an unreadable value is named in the notice.
- **Kind:** behaviour
- **Level:** unit
- **Source:** Planum improvement plan 2, WP21
- **Expected:** Default scene → no `names=`; `setNamesShown(true)` → the written link contains `&names=1`. Restoring `hemi=left&names=1` → `[]`, names on; `hemi=right` → `[]`, names off; `names=yes` → `['names']`.
- **Covered by:** `src/lib/controller/links.test.ts` (R)

## The scene reader

### LINK-20 · A captured scene is put back with its view and exact camera

- **Rule:** The scene reader other controllers use captures the scene as its link carries it plus the exact camera pose, and applying it puts back layers, display, cut, MRI window, the session's view and the exact pose. A target that asks to face the cut faces it when a cut is active, else frames its named view.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:749-779`; decision 8 on #4
- **Expected:** view left, captured, view right, applied → session view `left`. Hemisphere left, coronal, window 50/60, view left; captured → `{ hemisphere: 'left', cut: 'coronal', mriWindow: { center: 50, width: 60 } }`. After undoing each, apply → failures `[]`, hemisphere left, mode coronal, window 50/60, exactly one camera `restore` call.
- **Covered by:** `src/lib/controller/links.test.ts` (R; the one-`restore` count is I)

## End to end

### LINK-21 · A scene written to the address bar opens the same scene after a reload

- **Rule:** On the built site, the link the app writes as the reader works, opened again in a fresh page load, shows the same scene, and the address bar keeps that link once the restore settles.
- **Kind:** behaviour
- **Level:** e2e — the real address bar, `hashchange`, a page reload and the boot sequence of the built site
- **Source:** `viewer/app.js:2111-2132`
- **Expected:** choose a system, wait for the camera to be idle (link still 750 ms), read the hash, reload → status `ready`, the hash equals the one read, the system select shows the same option. A link with `hidden=<region>` opens with that part hidden, Undo disabled and Restore all enabled. Choosing "By system" option 1 writes `system=` and the checked option is that name; option 0 removes it. `#hidden=destrieux:left:38` → "1 part hidden", Undo disabled, axe clean on the bar; Restore all → the hash has no `hidden=`.
- **Covered by:** `e2e/journeys/scene.spec.ts` "LINK-21" (R: a system chosen by hand, and a scene with a region, a hidden part, a cut, a hemisphere, a colouring and a function, each reloaded to the same link); writing alone (no reload) is in the browser tests of the Dissection bar, the sections bar, the dock and the stage keys

### LINK-23 · A raised paint threshold travels as zmin

- **Rule:** The open single function's raised threshold is written as `zmin=` in half steps above 3 (supervisor review 3.2); the published 3 writes nothing, and a link without it opens at 3. Values below or at 3, off the half step, or above 100 are not applied. It is written only with the function it belongs to.
- **Kind:** data
- **Level:** unit
- **Expected:** `zmin=3.5` → `paintFrom` 3.5; `paintFrom: null` writes no `zmin`; 4.5 writes `zmin=4.5`; `2.5`, `3.25`, `x`, `-4`, `101` are rejected.
- **Covered by:** `src/lib/core/state/url-state.test.ts`

### LINK-25 · A link carries the reader's highlights, and applying one replaces them

- **Rule:** The written link names the reader's highlights (`mark=`) whenever there are any on the stage or set aside by evidence; highlights a masthead colour lifted are left out, so the link opens on the colour its writer saw, with no key for the lift. A link applied, at start or edited in place, is a whole scene: its highlights replace the reader's, and a link without any, or whose `mark` is not applied, clears them; `mark` is then named among the fields not applied.
- **Kind:** behaviour
- **Level:** unit
- **Source:** Planum improvement plan 2, WP22
- **Expected:** Highlights `destrieux:left:29` green, `aseg:left:17` blue → the written hash contains `mark=destrieux:left:29:green,aseg:left:17:blue`. Restoring `hemi=left&mark=aseg:left:17:violet` → `[]` and the set `[aseg:left:17 violet]`; then `hemi=right` → `[]` and none, `linkState().highlights` null. `mark=aseg:left:17:blue,destrieux:left:9999:pink` → `['mark']` and none. Lifted under Lobes → the hash has `colors=lobe` and no `mark=`, `linkState().highlights` null; set aside → written.
- **Covered by:** `src/lib/controller/links.test.ts`
