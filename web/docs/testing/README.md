# Testing: audit and business-rule catalogue

Part of #4. Since the user's decision of 2026-10-26 (comment on #4), parity is proven by business rules, not
by legacy code equivalence: a test states what the app must do for the reader, or a scientific or data
result, and checks it against fixed values without importing `viewer/`. This folder holds what the
conversion needs.

- `rules/<area>.md`: 35 catalogues, 1,492 entries (1,466 rules, 22 that point to the one place a
  duplicated rule is stated, and 4 retired or rewritten entries that name their successor). Each rule has an ID, the rule, its kind, the **cheapest level that proves it**,
  its legacy source, fixed expected values and the tests that cover it today, with their class.
- `audit.md`: every test file in one table, the rule IDs hiding in each legacy-comparison file, the slow
  tests ranked by seconds saved, and the findings outside the classification (bugs, changes from legacy with
  no deviation record, decisions needed).

> **Status (2026-10-26):** the conversion below is done. K8 to K16 replaced all 27 legacy-comparison files with rule tests and deleted them, and K16 removed `web/parity/`. The counts, order and slow-test figures record the audit as it was taken, as `audit.md` does.

Citations such as `app.js:221-229` or `viewer/app.js:406-446`, in code comments and the catalogues' **Source:**
fields, point to the deleted legacy viewer as tag `legacy-viewer-final` (7c6202b8) holds it; read one with
`git show legacy-viewer-final:viewer/app.js`.

## Before pushing

`.githooks/pre-push` runs the fast part of CI's web-check from `web/`: the format check, lint and the unit
project. Enable it once per clone with `git config core.hooksPath .githooks`. The browser project,
`npm run check` and `npm run check:ts7` stay with CI or a manual run.

The unit project runs with `isolate: false`: a worker runs its files one after another in one realm and
module cache. `unstubGlobals` and `restoreMocks` undo stubs and spies before each test, so stub in
`beforeEach` or the test, never at the top of a file or in `beforeAll` alone. A file that calls `vi.mock`
starts with `vi.hoisted(() => vi.resetModules())` and resets again in `afterAll`, so its mocks reach the
modules it imports and no later file gets modules built on them. A test-support module registers no hooks
when imported: only the first file to import it would get them.

## Counts

Test files (237: 161 unit and 52 browser Vitest files, 24 Playwright specs), by main class:

| Class                       | Files                                                                |
| --------------------------- | -------------------------------------------------------------------- |
| R business rule             | 192 (120 unit, 48 browser, 24 e2e)                                   |
| S scientific or data result | 8                                                                    |
| D legacy comparison         | 27 (25 of the 26 `parity/*.test.ts`, both `*.parity.svelte.test.ts`) |
| I implementation-pinning    | 1                                                                    |
| W weak or tautological      | 1                                                                    |
| H hygiene                   | 8                                                                    |

Rules by cheapest level (over the 1,302 rules, pointers left out): 826 unit, 469 browser, 7 e2e. About 55
rules are covered only by differential tests and 48 by no test at all; they need rule tests before the differential files can go. Many R files also carry
small I or W parts (call-order spies, re-derived expectations); `audit.md` names them.

## Conversion order

Each step converts the differential checks into rule tests against fixed values (the rule IDs per file are
in `audit.md`), then deletes the file.

1. **Nearly covered already** (small, quick deletions): `parity/R2`, `T1`, `G6`, `f1`, `S1`, `u1`, `U2`.
   Their rules are mostly R-covered in unit files; add the few edge values listed, then delete.
2. **Core data** (largest unit-time win: `C3` alone is 34 s): `parity/C3`, `C2`, `C1` (one reviewed
   snapshot of both string tables), `C4`, `C5`.
3. **State and controller**: `parity/S2`, `S3`, `S4`, `S5a` (a table of fixed key outcomes), and the D
   parts of `parity/F3` (then move its rule cases out of `parity/`).
4. **Engine**: `parity/E4b` (43.6 s, the slowest unit file), `E1`, `E5`, `E7`, `E4a`, `f2` (as contract-suite
   cases, so the fake and the real engine meet them alike), `E6`, `E3`, `E2` (needs one browser test that
   compiles each distinct program once), then `lighting.parity.svelte.test.ts` and
   `snapshot.parity.svelte.test.ts` (the only proof the image carries "Planum · Not clinical anatomy").

In parallel, the speed fixes (no conversion needed): the engine contract (below), then the browser files'
axe matrices, real timers and animation waits.

## What to delete

- The 27 legacy-comparison files, each once its rules have rule tests (above).
- `src/lib/ui/kit-spike.svelte.test.ts` (a U0 spike over a docs-only fixture; reword decision records 0001
  and 0005, which cite it).
- Inside kept files: the call-order and spy assertions marked I, the W cases (or fix them), the engine
  contract's "names the per-frame events" on the real engine, and the e2e cases that repeat a browser test
  (most of each spec; see each spec's row).

## Slow tests

`src/lib/engine/index.svelte.test.ts` took 390 s of the browser suite in CI and made one shard last 408 s
while the others took 48 to 67 s: it runs the 49-case engine contract with a fresh real engine per case,
parsing about 35 MB of GLB on software WebGL. Only 19 cases need the real engine. Booting once per
`describe` saves about 160 to 185 s; splitting the suite into four files so shards balance cuts the CI wall
time by about 260 s; running the contract in the unit project with the fake renderer that `index.test.ts`
already uses (after writing a fetch-to-disk shim for the volumes, tracts and overlap file, and keeping one
browser cut case for the worker path) leaves 25 to 30 s in the browser. After it: `parity/E4b` 43.6 s, `parity/C3` 34.3 s, the sheet
21.2 s, functions 19.9 s, `parity/F3` 16.6 s, the data bar 11.5 s (55 fixed 150 ms sleeps) and the overlays
9.8 s. Most browser time comes from five patterns: axe theme × width × language matrices, real debounce and
tooltip timers, CSS transitions, viewport churn and real data parsed per case.

## End-to-end journeys

`web/e2e/journeys/` runs a few journeys against the built Svelte preview on its real engine, served as Pages
serves it (`e2e/serve-site.mjs`): tests.yml's `web-e2e` job, about 5 minutes, on a manual run (Actions → Tests →
Run workflow) and nightly at 03:17 UTC. It is not a gate: pull requests, pushes and the deploy never run it. K19
deleted the 25 specs of `e2e/parity/` and the `legacy` project; the rules they held are proved by the
browser tests cited in the catalogues, or by these journeys. A journey is not the level that proves each rule
it touches; those rules keep their own unit or browser test.

1. **Boot** (`boot.spec.ts`): cold start to ready, each prefetched file requested once at its version
   (ASSET-15, ASSET-21), a second visit served by the service worker (SW-10), the WebGL failure screen, a
   failed start that keeps the link until Retry, the head script before the app.
2. **Permalink round trip** (`scene.spec.ts`, LINK-21): a system chosen by hand, and a scene with a region,
   a hidden part, a cut with position and reverse, a hemisphere, a colouring and level, a function and a tab,
   each reloaded to the same link.
3. **Pick and inspect on the real model** (`scene.spec.ts`): hover names the region, a click selects it, Hide
   hands focus to Undo, and Undo brings the part back.
4. **Find a region** (`scene.spec.ts`): search, Enter, `region=` in the link, Back, the tree row selected;
   an eye press says "Hidden: …. 1 part hidden".
5. **Explorers** (`explorers.spec.ts`): open a function and Restore; open a deficit's mapped region; step a
   circuit with Next.
6. **Data bar** (`chrome.spec.ts`): a colouring that needs another atlas switches it; Escape in the phone
   popover keeps the selection; the comparison CSV downloads under its file name.
7. **Phone** (`phone.spec.ts`): the sheet tells the stage what it covers and a resize keeps tab focus; the
   page-wide focus walk; 320 px (SHEET-29).
8. **Snapshot and full screen** (`chrome.spec.ts`): a real PNG from the real WebGL stage, and real full
   screen in and out. The settings menu and single-key shortcuts after a reload (SHORT-13) are there too.
9. **Tracts** (`tracts.spec.ts`): the first opening downloads and draws, the lengths CSV downloads, and MRI
   with tracts opens the Linked MRI, whose FA downloads and joins the readout (SECT-35).
10. **Accessibility** (`accessibility.spec.ts`, BUILD-10): axe on the composed app, light and dark, at 1280 px
    and 390 px.
11. **Phone smoke in WebKit** (`phone-smoke.spec.ts`, BUILD-18): boot, a tap that picks, a cut moved by its
    typed position, and the sheet's handle, in Playwright's `webkit-iphone` project (an iPhone 13). The
    other journeys are the `chromium` project's; each project has its own runner in `web-e2e`.

Two things K19 found while writing them are settled in K20: the phone's selection strip is named by its visible
words (`deviations/k20-strip-label-in-name.md`), so the accessibility journey runs axe with a selection at both
widths; and the phone journey checks that the stage's `--vis-bottom` returns to 0 after a phone to desktop resize.
That check waits up to 30 s: on the runners' software WebGL a window resize reaches the page only after a slow
frame, and a polling probe slows it further (about 10 s measured), so the default 5 s poll timed out although the
inset did clear.

**WebKit is unconfirmed.** `src/app/webgl-check.ts` refuses a browser without WebGL 2 and
`EXT_color_buffer_float`, and WebKit takes no launch flag for its GL path, unlike Chromium's SwiftShader
switches. Linux WebKit from Playwright's image has not yet been run against it, since e2e is not run
locally: the first nightly run is the confirmation. The smoke's boot test asks for both first and names what is
missing, rather than waiting out the 90 s ready timeout on the failure screen.

The live site is checked after each deploy (BUILD-19, deploy.yml's `live-check`): the page must name the
entry script and manifest version the deploy built, and the manifest must be served at that version.

## UI tests read a frozen manifest

The browser tests of the interface read `web/test/fixtures/cdmd-manifest.json`, a cut of the published CDMD
manifest taken at `a73f75b0`, not `public/models/cdmd/manifest.json`, so a data rebuild cannot change what
they see (handoff I3). The cut keeps every region and section the app reads, with the published values, and
drops what only the real engine or nothing reads (CAT-68 lists them); do not feed it to the real engine. It is
never regenerated: a test that needs a new section adds it there by hand, and its expectations are the fixed
values written in the test. The published values those tests name are held once, against the published
manifest, in `test/published-manifest.test.ts` (CAT-68). Tests of the real engine and of published data
(`engine/index.svelte.test.ts`, `prefetch.svelte.test.ts`, `AtlasComparison.svelte.test.ts`, whose file is
checked against the manifest's SHA-256, and the unit tests) still read the published files.
