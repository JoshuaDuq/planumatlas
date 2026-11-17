# E4a deviation: a failed older cut-atlas request does not roll back a newer choice

Superseded 2026-11-17 by derived cut labels. The cut atlas is no longer chosen: the sections derive
it from the model's atlas, colouring and internal anatomy (`cutAtlasFor`), so `setCutAtlas`,
`loadedCutAtlas` and the rollback below are gone. Labels that fail stay named and are tried again
on the next change; a failure of labels the model no longer calls for is not reported (SLICE-21,
`sections.test.ts`: "labels an older choice was loading do not overwrite those the model calls for
now"). Kept as the record of the E4a fix.

Chunk E4a (#27). A fix under the parity policy. Pinned by `sections.test.ts` ("a failed older cut
atlas does not overwrite a newer choice").

- **Legacy** (`viewer/slices/sections.js`, `setCutAtlas`): on failure it restored `previous`
  unconditionally. With `setCutAtlas('hcp-mmp')` failing after `setCutAtlas('nextbrain')` had
  succeeded, `state.cutAtlas` went back to the first call's previous value, the cut drew
  `nextbrain`, and `status` was `error`: the control named an atlas the cut was not showing.
  The same unconditional restore also left a failed choice in the state when two failing choices
  overlapped: the newer call's `previous` was the older call's never-loaded atlas.
- **New**: the state is rolled back only when it still names the atlas that failed
  (`state.cutAtlas === atlas`), and it returns to the last cut atlas that finished loading
  (`loadedCutAtlas`, set when a load completes), falling back to the call's `previous` when none
  has. The failure is reported only for the latest request (`request === this.requestNumber`); a
  stale failure still rejects its own promise. A later `setMode` also bumps the request number,
  which is why the rollback is decided by the state, not the request. Tests cover the overlap
  with `setMode` and two failing choices, older failing first.
- **Standard**: the method's own contract (the control must not show an atlas that did not load),
  and the general rule that a superseded asynchronous request must not write state (latest-wins,
  as `setMode` already does).
