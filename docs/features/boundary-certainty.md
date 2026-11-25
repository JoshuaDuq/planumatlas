# Boundary certainty

Boundary certainty rates each boundary between two touching NextBrain labels in one hemisphere. The rating is the share of interface voxels where NextBrain's own posteriors nearly chose the other label of the pair. The posteriors were recorded from the NextBrain segmentation of one brain, `sub_013` of the MGH Connectome Diffusion Microstructure Dataset (CDMD; [internal anatomy](internal-anatomy.md)), on its 0.4 mm grid (Fig. 1a). The viewer draws the rating on the selected region's outline on a NextBrain cut and lists it in the region detail. The rating measures the model's competition between its own labels under one registration, not accuracy and not agreement with another segmentation.

```{figure} figures/boundary-certainty-1-light.webp
:alt: Four panels. a, a close coronal cut through the left thalamus in NextBrain colours, with one nucleus outlined partly by a solid line and partly by a dashed line. b, the same cut with the putamen outlined by a solid line all round. c, the Boundary certainty section of the first nucleus, listing its neighbours with a solid or dashed glyph, a bar and a percentage. d, a histogram of near-tie shares of all rated boundaries, most below one third.
:name: fig-boundary-certainty-1

**A boundary is rated firm or soft by the share of its interface voxels that were near ties.** **a**, [The magnocellular division of the left ventral anterior nucleus](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=nextbrain&cut=coronal&pos=-2&view=anterior&cortex=0&cam=-19,25,-53,-19,25,2&region=nextbrain:left:283) (`nextbrain:left:283`) selected on a NextBrain cut. Its outline is solid where the boundary with the neighbour is firm, dashed where it is soft and grey where the pair is unrated. **b**, [The left putamen](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=nextbrain&cut=coronal&pos=-2&view=anterior&cortex=0&cam=-19,25,-53,-19,25,2&region=nextbrain:left:79) (`nextbrain:left:79`) on the same cut, whose rated boundaries are all firm. Both panels show a coronal cut at surface RAS y = −2 mm with the cortex hidden, seen from the front with one camera. **c**, The **Boundary certainty** section of the nucleus in **a**, under **Research data**. A near tie holds on 34% of its rated boundary, and 6 of its 14 boundaries are soft. Each row gives the glyph of the rating, the neighbour and the near-tie share of that boundary. **d**, Near-tie shares of all rated pairs of `boundary-certainty.json` (n = 1,738), in bins of 1/30. A pair is soft at a share of 1/3 or more (dashed line; n = 329), and the median share is 0.194. Scale bars apply at the depth of the camera's target.
```

## Data

| Input | Content | Pinned by |
| :--- | :--- | :--- |
| NextBrain labels | `nextbrain-cdmd.mgz`, int32, 0.4 mm, surface RAS (right, anterior, superior) through `orig.mgz` | `data/sources.json` |
| Posteriors | `max_p`, `second_p`, `second_seg` per hemisphere, written beside `seg.<side>.nii.gz` by the patched NextBrain run | provenance in `data/sources.json` (`near_ties.posteriors`) |
| Near-tie volume | `nextbrain-cdmd-near-ties.mgz`, int32, on the label grid and affine: the runner-up label where the winner led by < 0.2; 0 elsewhere and where the runner-up is background. 1,061,305 voxels (7.5% of labelled voxels) on CDMD | `data/sources.json`, with `near_ties.margin` 0.2 |

## Method

### Posterior recording

NextBrain's `segment_fireants.py`, as FreeSurfer 8.2 ships it, computes each voxel's winning posterior (`max_p`) in its label loop and discards it. `scripts/freesurfer/run_patched.py` runs the script with source patches, each of which must match the source exactly once. The patches add the runner-up posterior `second_p` and the runner-up label `second_seg`, and write both with `max_p`. A label that takes a voxel moves the previous winner to second place, and a label that beats only the runner-up replaces it. The label update itself is unchanged, and the rerun reproduced the published labels byte for byte.

### Near ties on the label grid

`join_near_ties` (`scripts/segment_nextbrain.py`) processed each hemisphere in four steps:

1. The posteriors and labels were read, and each was required to lie on the grid of `seg.<side>`.
2. The hemisphere was refused if any runner-up posterior exceeded its winner's or a runner-up repeated its winner.
3. A voxel was marked as a near tie where it was labelled, its runner-up was not background, and $p_\text{winner} - p_\text{second} < 0.2$ (`nextbrain.near_tie_margin`).
4. The runner-up labels were placed on the joined grid by the same nearest-neighbour placement as the labels. A tie was kept only where the joined label was that hemisphere's own label, and right-hemisphere runner-ups took the +10,000 offset.

`verify_margin` fails the build when the recorded margin differs from the configured one.

### Boundary rating

`boundary_certainty.rate` works on the joined 0.4 mm grid. Two voxels touching across a face with different, non-background labels in the same hemisphere form an interface. Labels above 10,000 are right-hemisphere labels. Pairs across the midline are not rated, because each hemisphere was segmented separately. For a pair $(A, B)$, the interface $I_{AB}$ is the set of voxels of either label with a face neighbour in the other, each counted once. The near-tie share is

$$s_{AB} = \frac{\lvert \{ v \in I_{AB} : \text{runner-up}(v) \text{ is the other label of the pair} \} \rvert}{\lvert I_{AB} \rvert},$$

so a near tie against a third label does not count. A pair is rated when $\lvert I_{AB} \rvert \ge 50$ voxels (`minimum_interface_voxels`; 3.2 mm³; Fig. 1a,b). `export` writes `boundary-certainty.json` with `[region id, region id, interface voxels, near-tie voxels]` per rated pair. It fails if a rated label has no published region. The file is published only for a subject segmentation (`is_published`), since a warped atlas has no posteriors.

### CDMD

On CDMD, 1,738 same-hemisphere pairs were rated and 2,387 smaller pairs were not. The rated pairs hold 99.1% of interface voxels. The median near-tie share of a rated boundary is 0.194 (n = 1,738 pairs; Fig. 1d). The mean share weighted by interface is 0.261. In 329 of the rated pairs the share is at least 1/3, the viewer's threshold for a soft boundary. Of all near-tie voxels, 93.2% nearly went to a label that touches them across a face. Of labelled voxels, 1.8% have a winning posterior below 0.5, and 98.0% of those lie on a label boundary. The uncertain band is therefore about one voxel wide. The largest confusion is between the molecular and granular layers of the cerebellar cortex: 14,250 mm³ left and 14,817 mm³ right lie within the margin. The viewer shows CerebNet lobules there instead. The two winning-posterior shares and the cerebellar volumes were computed from the cached posteriors and the near-tie volume. They are not recorded by validation.

## Display

`web/src/lib/core/catalog/boundary-certainty.ts` checks the published file against the manifest regions: same atlas and hemisphere, whole-number counts with a positive interface and no more near ties than interface voxels, and no pair rated twice. It defines `SOFT_SHARE = 1/3`. `boundariesOf` lists a region's rated boundaries, largest interface first. A boundary is soft when $s \ge 1/3$ and firm otherwise.

The region detail of a NextBrain region with a rated boundary has a **Boundary certainty** section under **Research data** (Fig. 1c). Its first line gives the near-tie share over all the region's rated boundaries, weighted by interface, and the number of soft boundaries. The section then lists the eight largest boundaries and gives the rest as a count. Each row has a solid (firm) or dashed (soft) glyph, the neighbour's name, which selects the neighbour, and the share as a bar and a percentage.

A cut is labelled by NextBrain when **Internal anatomy** is set to **NextBrain** (`detail=nextbrain`), unless the colour is **Arterial territories**, **Striatal networks** or **Cerebellar functions**, or a paint is shown. On such a cut, `boundary-edges.ts` outlines the selected region in the fragment shader. A symmetric label-by-label texture holds 0 for an unrated pair and $1 + \operatorname{round}(254\,s)$ otherwise. The outline is solid black where firm, two-tone dashed where soft and grey where unrated, with a half-width of 1.5 screen pixels. Where the outline meets several neighbours within that width, it takes the highest share among them. A label too small to win any 0.8 mm cut block never meets another on a cut.

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| Published pairs against a recount per voxel and touching label (`validate`, independent of `rate`) | equal; none rated twice; none missing | equal for all 1,738 rated pairs |
| Pairs below 50 interface voxels | not rated | 2,387 |
| Share of interface voxels in rated pairs | reported | 99.1% |
| Median near-tie share of a rated boundary | reported | 0.194 (interface-weighted mean 0.261) |
| Near-tie voxels; share against a face neighbour | reported | 1,061,305; 93.2% |
| Near-tie volume | on the label grid; runner-up in the winner's hemisphere, never the winner; configured margin | holds |
| `tests/test_boundary_certainty.py`, `tests/test_segment_nextbrain.py` | interface counted once per side; near ties against a third label excluded; midline and minimum rules; refusal of off-grid or other-margin near-tie volumes and of ratings that differ from the recount | pass |
| `web/src/lib/core/catalog/boundary-certainty.test.ts` | boundaries listed largest first, soft from a third; a file naming another atlas, crossing the midline, repeating or miscounting a pair is refused | pass |

`validate` recounts the interfaces per voxel and touching label, not per pair, so the check does not reuse the counting of `rate`. The two share only the same-hemisphere test. The reported values are written to `validation.json` under `boundary_certainty`.

## Limitations

The rating is the model's own competition under one registration. Registration uncertainty is not included.

The rating is not accuracy and not agreement with aseg. The left amygdala, the Dice exception of [segmentation agreement](segmentation-agreement.md), has a median winning posterior of 0.976 on its hemisphere grid. A firm boundary can still be misplaced.

A per-region score would mostly encode thinness (boundary share), so only boundaries are rated. Pairs under 50 interface voxels and all pairs across the midline are unrated.

Only subject segmentations have posteriors. A warped atlas has none, so no rating is published for it.

## Code availability

Code
: [`scripts/freesurfer/run_patched.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/freesurfer/run_patched.py), [`scripts/segment_nextbrain.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/segment_nextbrain.py) (`join_near_ties`), [`brain_model/labels/boundary_certainty.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/labels/boundary_certainty.py), [`web/src/lib/core/catalog/boundary-certainty.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/catalog/boundary-certainty.ts), [`web/src/lib/engine/tissues/boundary-edges.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/engine/tissues/boundary-edges.ts)

Configuration
: [`config/model.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/model.yaml): `nextbrain.near_tie_margin` (0.2), `nextbrain.minimum_interface_voxels` (50), the anatomy's `nextbrain.near_ties`

Tests
: [`tests/test_boundary_certainty.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_boundary_certainty.py), `tests/test_segment_nextbrain.py`, `web/src/lib/core/catalog/boundary-certainty.test.ts`

```bash
# Rerun NextBrain with the posterior patch (FreeSurfer 8.2; only to regenerate)
uv run python scripts/segment_nextbrain.py --anatomy cdmd --record
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_boundary_certainty.py tests/test_segment_nextbrain.py
```

