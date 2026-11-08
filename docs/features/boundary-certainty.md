# Boundary certainty

Boundary certainty rates each boundary between two touching NextBrain labels in one hemisphere. The rating is the share of interface voxels where NextBrain's own posteriors nearly chose the other label of the pair. The posteriors are recorded from this brain's segmentation ([internal anatomy](internal-anatomy.md)) on its 0.4 mm grid. The viewer draws the rating on the selected region's outline on a NextBrain cut and lists it in the region detail. It measures the model's competition between its own labels under one registration, not accuracy and not agreement with another segmentation.

```{figure} figures/boundary-certainty-1.webp
:alt: Three zoomed coronal views of the left deep grey matter with NextBrain labels. The first shows the labels, the second marks near-tie voxels in orange along label boundaries, and the third draws every boundary black, orange or grey by its rating. A histogram of the ratings of all rated boundaries completes the figure.
:name: fig-boundary-certainty-1

**Near ties form a band about one voxel wide along label boundaries, so the rating is made per boundary rather than per voxel.** **a**, NextBrain labels on the 0.4 mm grid over the T1. **b**, Near-tie voxels (orange), where the winning posterior led the runner-up by less than 0.2. **c**, In-plane label boundaries drawn by the rating of their pair: firm (black, near-tie share < 1/3), soft (orange, ≥ 1/3) or unrated (grey, fewer than 50 interface voxels). **d**, Near-tie shares of all 1,738 rated pairs; 329 are soft (dashed line at 1/3), and the median is 0.194. In **a**–**c** the coronal plane is at surface RAS (right-anterior-superior) y = −2.0 mm, left hemisphere, x from −40 mm (lateral, right edge) to −2 mm (medial, left edge), z from 0 to 36 mm. The panels were rendered from `nextbrain-cdmd.mgz`, `nextbrain-cdmd-near-ties.mgz` and `boundary-certainty.json` by nearest-neighbour sampling, not from the viewer. The scale bar is 10 mm.
```

## Data

| Input | Content | Pinned by |
| :--- | :--- | :--- |
| NextBrain labels | `nextbrain-cdmd.mgz`, int32, 0.4 mm, surface RAS through `orig.mgz` | `data/sources.json` |
| Posteriors | `max_p`, `second_p`, `second_seg` per hemisphere, written beside `seg.<side>.nii.gz` by the patched NextBrain run | provenance in `data/sources.json` (`near_ties.posteriors`) |
| Near-tie volume | `nextbrain-cdmd-near-ties.mgz`, int32, on the label grid and affine: the runner-up label where the winner led by < 0.2; 0 elsewhere and where the runner-up is background. 1,061,305 voxels (7.5% of labelled voxels) on CDMD | `data/sources.json`, with `near_ties.margin` 0.2 |

## Method

### Posterior recording

NextBrain's `segment_fireants.py` computes each voxel's winning posterior in its label loop and discards it. `scripts/freesurfer/run_patched.py` runs the script with source patches, each of which must match the source exactly once. The patch adds `second_p` and `second_seg`. A label that takes a voxel moves the previous winner to second place, and a label that beats only the runner-up replaces it. The label update itself is unchanged, and the rerun reproduces the published labels byte for byte.

### Near ties on the label grid

`join_near_ties` (`scripts/segment_nextbrain.py`) does the following for each hemisphere:

1. Read the posteriors and labels, requiring each on `seg.<side>`'s grid.
2. Refuse the hemisphere if any runner-up posterior exceeds its winner's or a runner-up repeats its winner.
3. Mark a voxel tied where it is labelled, its runner-up is not background, and $p_\text{winner} - p_\text{second} < 0.2$ (`nextbrain.near_tie_margin`).
4. Place the runner-up labels on the joined grid by the same nearest-neighbour placement as the labels. Keep a tie only where the joined label is that hemisphere's own label; right-hemisphere runner-ups take the +10,000 offset.

`verify_margin` fails the build when the recorded margin differs from the configured one.

### Boundary rating

`boundary_certainty.rate` works on the joined 0.4 mm grid. Two voxels touching across a face with different, non-background labels in the same hemisphere form an interface. Labels ≥ 10,000 are right; pairs across the midline are not rated, because each hemisphere was segmented separately. For a pair $(A, B)$, the interface $I_{AB}$ is the set of voxels of either label with a face neighbour in the other, each counted once. The near-tie share is

$$s_{AB} = \frac{\lvert \{ v \in I_{AB} : \text{runner-up}(v) \text{ is the other label of the pair} \} \rvert}{\lvert I_{AB} \rvert},$$

so a near tie against a third label does not count. A pair is rated when $\lvert I_{AB} \rvert \ge 50$ voxels (`minimum_interface_voxels`; 3.2 mm³). `export` writes `boundary-certainty.json` with `[region id, region id, interface voxels, near-tie voxels]` per rated pair. It fails if a rated label has no published region. The file is published only for a subject segmentation (`is_published`), since a warped atlas has no posteriors.

### CDMD

On CDMD, 1,738 same-hemisphere pairs are rated and 2,387 smaller pairs are not; the rated pairs hold 99.1% of interface voxels. The median near-tie share of a rated boundary is 0.194, and 0.261 weighted by interface (Fig. 1d). Of all near-tie voxels, 93.2% nearly went to a label that touches them across a face. 1.8% of labelled voxels have a winning posterior below 0.5, and 98.0% of those lie on a label boundary; the uncertain band is therefore about one voxel wide (Fig. 1b). The largest confusion is between the molecular and granular layers of the cerebellar cortex: 14,250 mm³ left and 14,817 mm³ right lie within the margin. The viewer shows CerebNet lobules there instead. The last three measurements were computed from the cached posteriors and near-tie volume; they are not recorded by validation.

## Display

`web/src/lib/core/catalog/boundary-certainty.ts` checks the published file against the manifest regions: same atlas and hemisphere, positive counts, and no pair rated twice. It defines `SOFT_SHARE = 1/3`. `boundariesOf` lists a region's rated boundaries, largest interface first; a boundary is soft when $s \ge 1/3$. The **Boundary certainty** section of the region detail lists the eight largest boundaries and gives the rest as a count. Each row has a solid (firm) or dashed (soft) glyph, the neighbour's name, which selects the neighbour, and the share as a bar and a percentage.

On a cut with NextBrain cut labels (`cuts=nextbrain`), `boundary-edges.ts` outlines the selected region in the fragment shader. A symmetric label-by-label texture holds 0 for an unrated pair and $1 + \operatorname{round}(254\,s)$ otherwise. The outline is solid black where firm, two-tone dashed where soft and grey where unrated, with a half-width of 1.5 screen pixels. A label too small to win any 0.8 mm cut block never meets another on a cut.

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| Published pairs against a recount per voxel and touching label (`validate`, independent of `rate`) | equal; none rated twice; none missing | equal for all 1,738 rated pairs |
| Pairs below 50 interface voxels | not rated | 2,387 |
| Share of interface voxels in rated pairs | reported | 99.1% |
| Median near-tie share of a rated boundary | reported | 0.194 (interface-weighted 0.261) |
| Near-tie voxels; share against a face neighbour | reported | 1,061,305; 93.2% |
| Near-tie volume | on the label grid; runner-up in the winner's hemisphere, never the winner; configured margin | holds |
| `tests/test_boundary_certainty.py`, `tests/test_segment_nextbrain.py` | interface counted once per side; near ties against a third label excluded; midline and minimum rules; refusal of off-grid or other-margin near-tie volumes and of ratings that differ from the recount | pass |
| `web/src/lib/core/catalog/boundary-certainty.test.ts` | boundaries listed largest first, soft from a third; a file naming another atlas, crossing the midline, repeating or miscounting a pair is refused | pass |

## Limitations

- The rating is the model's own competition under one registration. Registration uncertainty is not included.
- It is not accuracy and not agreement with aseg. The left amygdala, the Dice exception of [segmentation agreement](segmentation-agreement.md), has a median winning posterior of 0.976 on its hemisphere grid. A firm boundary can still be misplaced.
- A per-region score would mostly encode thinness (boundary share), so only boundaries are rated.
- Pairs under 50 interface voxels and all pairs across the midline are unrated.
- Only subject segmentations have posteriors; a warped atlas has none.

## Code availability

| | |
| :--- | :--- |
| Code | [`scripts/freesurfer/run_patched.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/freesurfer/run_patched.py), [`scripts/segment_nextbrain.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/segment_nextbrain.py) (`join_near_ties`), [`brain_model/labels/boundary_certainty.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/labels/boundary_certainty.py), [`web/src/lib/core/catalog/boundary-certainty.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/catalog/boundary-certainty.ts), [`web/src/lib/engine/tissues/boundary-edges.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/engine/tissues/boundary-edges.ts) |
| Configuration | [`config/model.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/model.yaml): `nextbrain.near_tie_margin` (0.2), `nextbrain.minimum_interface_voxels` (50), the anatomy's `nextbrain.near_ties` |
| Tests | [`tests/test_boundary_certainty.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_boundary_certainty.py), `tests/test_segment_nextbrain.py`, `web/src/lib/core/catalog/boundary-certainty.test.ts` |

```bash
# Rerun NextBrain with the posterior patch (FreeSurfer 8.2; only to regenerate)
uv run python scripts/segment_nextbrain.py --anatomy cdmd --record
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_boundary_certainty.py tests/test_segment_nextbrain.py
```

Viewer state of the figure plane: https://planumatlas.com/#anatomy=cdmd&detail=nextbrain&cuts=nextbrain&cut=coronal&pos=-2&view=anterior&cortex=0
