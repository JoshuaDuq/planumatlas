# Boundary certainty

For each pair of touching NextBrain labels in one hemisphere, the share of their shared boundary where the model nearly chose the other label, drawn as the selected region's outline on a NextBrain cut and listed in the region detail.

:::{list-table}
:widths: 22 78
:stub-columns: 1

* - Where in the viewer
  - The selected NextBrain region's outline on a section with NextBrain cut labels (solid where firm, dashed where soft, grey where unrated), and the **Boundary certainty** section of the region detail.
* - Built by
  - [`scripts/freesurfer/run_patched.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/freesurfer/run_patched.py), [`scripts/segment_nextbrain.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/segment_nextbrain.py) (`join_near_ties`), [`brain_model/labels/boundary_certainty.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/labels/boundary_certainty.py)
* - Configuration
  - [`config/model.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/model.yaml): `nextbrain.near_tie_margin` (0.2), `nextbrain.minimum_interface_voxels` (50), `nextbrain.near_ties`
* - Source data
  - NextBrain's own posteriors for this brain (the labels of [Internal anatomy](internal-anatomy.md)), recorded as `data/nextbrain-cdmd/nextbrain-cdmd-near-ties.mgz`
* - Checked by
  - Validation step 13 ([validation](../pipeline/validation.md)); [`tests/test_boundary_certainty.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_boundary_certainty.py), `tests/test_segment_nextbrain.py`, `web/src/lib/core/catalog/boundary-certainty.test.ts`
:::

## What it does

NextBrain computes each voxel's winning posterior but does not write it. The build records it, with the runner-up label and posterior, leaving the labels unchanged. A voxel is a **near tie** where the winner leads the runner-up by less than 0.2. For each pair of touching labels in one hemisphere, the interface is the voxels of either label with a face neighbour in the other on the 0.4 mm grid; the pair's rating is the share of them where the two most probable labels were this pair and nearly tied. Pairs with fewer than 50 interface voxels are not rated, nor are pairs across the midline, whose boundary is the hemisphere join's.

A boundary is **soft** when a third or more of it is a near tie. The selected region's outline on a NextBrain cut and its **Boundary certainty** section draw the same rating. Near ties sit in a band about one voxel wide along boundaries, so a per-voxel map would show only edges; rating the boundary keeps that measurement and names the pair.

It is the model's competition between its own labels, conditional on one registration. It is not agreement with another segmentation: CDMD's left amygdala, NextBrain's largest disagreement with aseg, is a confident label (median winning posterior 0.975). A firm boundary can still be misplaced.

## Data

- **Posteriors.** NextBrain's `segment_fireants.py` keeps each voxel's winning posterior `max_p` in its label loop and discards it. A source patch applied at run time records, beside the label update (which is untouched), `second_p` and `second_seg`: when a label takes a voxel the previous winner moves to second, and a label whose posterior beats only the runner-up replaces it. The hemisphere-wise outputs are `max_p.<side>.nii.gz`, `second_p.<side>.nii.gz` and `second_seg.<side>.nii.gz` beside `seg.<side>.nii.gz`.
- **Near-tie volume.** `nextbrain-cdmd-near-ties.mgz`, int32 on the same 0.4 mm grid and affine as the NextBrain label volume: the runner-up label (right-hemisphere labels offset by 10,000) wherever the winner led by less than the margin, and 0 elsewhere and where the runner-up is background.
- **Pinned.** The near-tie volume is recorded in `data/sources.json` with its inputs and a `near_ties` record (margin, rule, the patch's origin, voxel count).

## How it was built

### 1. Record the posteriors

`scripts/freesurfer/run_patched.py` runs FreeSurfer's script as `__main__` with source patches, each required to match exactly once. The patch to `ERC_bayesian_segmentation/scripts/segment_fireants.py` adds `second_p` and `second_seg` arrays, updates them where a label's posterior beats the runner-up but not the winner, moves the previous winner to second where a label takes a voxel, and writes `max_p`, `second_p` and `second_seg` per hemisphere beside the label volume. It leaves the label update unchanged: rerunning reproduces the published labels byte for byte. The patches and workarounds for memory are described in [Internal anatomy](internal-anatomy.md#1-segment-nextbrain-on-this-brain).

### 2. Join the near ties onto the label grid

`join_near_ties` in `scripts/segment_nextbrain.py`, for each hemisphere:

1. Reads `max_p`, `second_p`, `second_seg` and `seg`, requiring each on the label volume's grid.
2. Refuses a hemisphere where any runner-up posterior exceeds its winner's or a runner-up repeats its winner.
3. Marks a voxel tied where it is labelled, its runner-up is not background, and `winner − second < near_tie_margin` (0.2).
4. Places the runner-up labels, and the hemisphere's own labels, on the joined grid by the same nearest-neighbour placement as the labels (`resample_nearest`), and keeps a tie only where the joined label is this hemisphere's own label at that voxel. The runner-up takes the right-hemisphere offset on the right.
5. Records the margin, the rule and the count of near-tie voxels.

`nextbrain.near_tie_margin` is a configuration constant; `verify_margin` fails the build if the recorded volume was made with another margin than the configured one.

### 3. Rate each boundary

`boundary_certainty.rate(labels, near_ties, minimum)` works on the joined 0.4 mm grid:

1. Densifies labels, and for each axis compares each voxel with its neighbour ahead. A pair is a face-neighbour pair of two different labels, neither background, in the same hemisphere (`same_hemisphere`: both above or both at or below 10,000). Pairs across the midline are not rated: each hemisphere is segmented separately, so their boundary is the join's.
2. Each pair is keyed by its two labels; the interface voxels are the voxels of either label touching the other, each counted once (the same voxel is not counted twice for the same pair).
3. For each interface voxel the runner-up is looked up: it counts as a near tie for this pair where its label is the other label of the pair (so a near tie against a label outside the pair is not this pair's).
4. A pair is rated where it has at least `minimum_interface_voxels` interface voxels (50, which is 3.2 mm³ at 0.4 mm). `export` writes `boundary-certainty.json` with, for each rated pair, `[region id, region id, interface voxels, near-tie voxels]`, and fails if a rated label has no published region.

The load step (`load`) first checks the near-tie volume against the labels it qualifies: same shape and affine as the label grid, no near tie on an unlabelled voxel, no runner-up equal to its own winner, and none across the midline. `metadata` records `near_tie_margin`, `minimum_interface_voxels`, `voxel_spacing_mm` and the method in the manifest's `boundary_certainty` entry; `boundary_certainty` is published only where NextBrain is a subject segmentation (`is_published`), since a warped atlas has no posteriors.

### CDMD

On CDMD, 1,061,305 voxels (7.5% of those labelled) are near ties, and 93.2% of them nearly went to a label that touches them across a face. 1,738 same-hemisphere pairs are rated, covering 99.1% of interface voxels; 2,387 smaller pairs are not. A rated boundary is nearly tied on a median 19% of its interface, 26% weighted by interface.

Measured when the design was chosen, on the published 0.4 mm grid: posteriors sum to 1 (0.1–99.9th percentiles within $2 \times 10^{-5}$); only 1.8% of brain voxels have `max_p` below 0.5, and 98% of those lie on a label boundary voxel, which is why the uncertain band is about one voxel wide, thinner than the 1 mm scan and the 0.8 mm cut blocks; per region, uncertainty tracks boundary share (Spearman 0.75), and per boundary voxel it spans 0.003 (dentate, red nucleus, periaqueductal grey) to 0.61 (hippocampal strata, small thalamic nuclei, amygdalohippocampal area); the largest confusion is cerebellar molecular against granular layer (about 29,000 mm³ with margin under 0.2), where Planum shows CerebNet's lobules instead.

## How the viewer uses it

- [`web/src/lib/core/catalog/boundary-certainty.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/catalog/boundary-certainty.ts) validates the published file against the manifest regions (the same atlas, the same hemisphere, positive voxel counts, no pair rated twice), defines `SOFT_SHARE = 1/3`, and gives `boundariesOf` (a region's rated boundaries, the largest interface first, `soft` where `near / voxels` is at least a third) and `overallShare` (the near-tie share weighted by interface).
- `web/src/features/inspector/BoundarySection.svelte` lists the eight largest boundaries (the rest as a count), each with a glyph (solid firm, dashed soft), the neighbour's name, which selects the neighbour without moving the camera, and the share as a bar and percent. A note gives the grid spacing and the margin.
- [`web/src/lib/engine/tissues/boundary-edges.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/engine/tissues/boundary-edges.ts) draws the outline on a cut in the shader. It builds a symmetric label-code by label-code `DataTexture` (`pairTexture`) holding 0 for an unrated pair and `1 + round(near / voxels × 254)` otherwise; the outline is solid where firm, dashed where the share reaches `SOFT_SHARE`, grey where unrated, at a half-width of 1.5 screen pixels. A label too thin to win any cut block has no code and never meets another on a cut.

## Checks

`validate` (validation step 13) recounts everything from the label volume and the near-tie volume, per voxel and the label it touches rather than per pair, so it does not share the rating's code:

| Check | Result on CDMD |
| :--- | :--- |
| Published pair counts equal a recount | Equal for all 1,738 rated pairs; none rated twice; none unpublished |
| Pairs below 50 interface voxels | 2,387, not rated |
| Share of interface voxels in rated pairs | 99.1% |
| Median near-tie share of a rated boundary | 19.4% (interface-weighted 26.1%) |
| Near ties | 1,061,305 voxels, 93.2% against a face neighbour |
| Near-tie volume | On the label grid; runner-up in the winner's own hemisphere and never the winner; made with the configured margin |
| Rerun with the recorded posteriors | Reproduces the published labels byte for byte |

`tests/test_boundary_certainty.py` covers the interface count (both sides once each), a near tie against a label outside the pair, the midline and minimum rules, the recount on any volume, refusal of a near-tie volume off the label grid or made with another margin or that could not come from one hemisphere's posteriors, and validation refusing a rating that differs from the recount.

## Limits

- **The model's own competition.** It rates how close NextBrain came to choosing the neighbouring label, given one registration; posteriors are conditional on one registration, not on registration uncertainty. It is not agreement with aseg and not accuracy: the left amygdala, the Dice exception (0.772), has a median winning posterior of 0.975, and a firm boundary can be misplaced.
- **Per-region scores encode thinness.** A per-region score mostly reflects boundary share, so only boundaries are shown.
- **Not rated.** Pairs under 50 interface voxels, and every pair across the midline.
- **Subject segmentations only.** A warped atlas has no posteriors.
- **Design alternatives dropped.** Grading every edge and showing soft edges only were rejected for the selected-outline design.

## Reproduce

```bash
# Rerun NextBrain with the posteriors patch (FreeSurfer 8.2; do not run beside other heavy jobs)
uv run python scripts/segment_nextbrain.py --anatomy cdmd --record

uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_boundary_certainty.py tests/test_segment_nextbrain.py
```

## See also

- [Internal anatomy](internal-anatomy.md): the NextBrain segmentation the posteriors come from
- [Segmentation agreement](segmentation-agreement.md): agreement with aseg, a separate question
- [Validation](../pipeline/validation.md)
