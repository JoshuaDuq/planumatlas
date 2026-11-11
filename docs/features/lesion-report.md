# Lesion report

A sphere of 3 to 30 mm radius placed on the brain or a cut face is measured in the browser against the subject's published 1 mm label volumes. The report gives the tissue and regions inside it, ranks the functions and deficit findings whose regions it overlaps, and counts the reconstructed streamlines that pass through it. It measures overlap on one brain; it predicts no deficit.

```{figure} figures/lesion-report-1.webp
:alt: Top left, lateral view of a grey left hemisphere with a dashed black ring and centre dot over the temporoparietal junction and white patches of cortex inside the ring. Bottom left, a coronal section coloured by region with the same ring over the left hemisphere. Right, the report panel listing the lesion's size, centre, three functions with bars and percentages, and three deficits.
:name: fig-lesion-report-1

**A 15 mm sphere at the left temporoparietal junction, its footprint and its report.** **a**, Left lateral view; the dashed ring marks the sphere's full extent, the dot its centre, and the cortex inside the radius is painted white. **b**, Coronal section at y = −25 mm through the centre, seen from the front (left hemisphere on the image's right); the cut faces carry the Destrieux labels the sphere is measured against. **c**, The report: 14.1 cm³ in the left hemisphere; the leading sensorimotor functions (Timing 9.5%, Interoception 8.8%, Action observation 7.9% of their left territories) and deficits whose cited regions it reaches (Somatosensory loss, up to 82% of a cited region). Subject CDMD sub_013; centre (−45, −25, +30) mm surface RAS; **Colour** Tissue in **a**, Regions in **b**; **On the brain** set to **Lesion only**.
```

## Data

The lesion publishes no file. It reads, from `public/models/<anatomy>/` and `public/diffusion/<subject>/`:

| Input | Used for |
| :--- | :--- |
| `tissues-<atlas>.volume` for the eight atlases in `tissue-labels.json` (Destrieux, HCP-MMP, Julich-Brain, Schaefer, NextBrain, arterial territories, Nettekoven cerebellar functions, Choi striatal networks) | Region volumes; each label's `region_id`, `name` and `kind` |
| `white-matter.volume` | FreeSurfer `wmparc` gyral white matter (within 5 mm of cortex) |
| `neuropsych-domains.json` | Each function's group and its territory: HCP-MMP areas and aseg structures with mean consistency z ≥ 3 (`threshold_z` in `config/neuropsych-domains.yaml`) |
| `data/neuropsychology.yaml` | Each deficit finding's laterality and cited regions (`mappings`) |
| `*.trk.gz`, `surface-space.json` | TractSeg streamlines (30 bundle files on CDMD) and the scanner-to-surface transform |
| Visible cortical meshes | The footprint |

Label grids are described in [sections and cuts](sections-and-cuts.md#data); bundles in [tracts](tracts.md).

## Method

### Voxel membership
A sphere is a centre $\mathbf{c}$ in surface RAS millimetres and a radius $r$; a non-positive or non-finite radius throws. The sphere's bounding box is taken in voxel indices through each volume's inverse affine and clamped to the grid. A voxel belongs to the sphere when its centre $\mathbf{v}$, mapped to RAS through the volume's affine, satisfies $\lVert \mathbf{v}-\mathbf{c}\rVert^2 \le r^2$. Counts are kept per stored label and converted to mm³ by $\lvert\det A\rvert$ of the voxel-to-RAS matrix $A$.

### Tissue and regions
Each Destrieux (`aparc.a2009s+aseg`) label is classed as cortex (by `kind`), outside (`Unknown`), white matter (`White-Matter`, `WM-hypointensities`, `CC_*`), fluid (`Ventricle`, `-Vent`, `CSF`) or deep grey (any other labelled structure); an unclassifiable label throws. For each atlas only the regions it owns are kept; aseg structures are read once from the Destrieux volume and `wmparc` from its own. Each region is reported as $\{V_\text{inside}, V_\text{whole}\}$, the whole being a count of every voxel of that label. A region's share is $V_\text{inside}/V_\text{whole}$.

### Functions
For function $f$, let $T_f$ be its territory restricted to the hemispheres the lesion reaches plus the midline. Its share is

$$s_f = \frac{\sum_{a \in T_f \cap L} V_\text{inside}(a)}{\sum_{a \in T_f} V_\text{whole}(a)},$$

where $L$ is the set of regions the lesion reaches. A territory area with no label-volume size throws. Functions are ranked by $s_f$; those under 1% (`SLIGHT_SHARE = 0.01`) are folded. Three functions lead each group.

### Deficit findings
A finding's share is the largest $V_\text{inside}/V_\text{whole}$ among its cited regions that the lesion reaches. A bilateral finding reached on one side only (midline regions excluded) is marked as such. A deficit takes the largest share of its findings; groups are ordered by their strongest function or deficit. Findings under 1% are folded.

### Arterial territories
A territory's share is of the lesion volume that falls in any territory, not of the territory: $V_\text{inside}(t)/\sum_{t'} V_\text{inside}(t')$.

### Streamlines
Bundles are chosen by side: left when $c_x - r < 0$, right when $c_x + r > 0$, plus the seven callosal segments (`callosum_1`–`callosum_7`; the whole-callosum file is skipped). The centre is moved into scanner RAS through `surface-space.json`. A streamline is counted once when any of its points satisfies $\lVert \mathbf{p}-\mathbf{c}\rVert \le r$; a segment passing through the sphere between two outside points is not counted. Bundles are downloaded, counted and released one at a time.

### Footprint
Every triangle of the visible cortical meshes whose centroid lies within $r$ is drawn with the surface's own normals in the overlay ink, with polygon offset −2. A dashed ring of 128 segments (dash $0.11\,r$, gap $0.077\,r$) and a centre dot, on halos of 2 px and 1.5 px CSS, mark the extent.

## Display
**Lesion**, under **Add** in the stage dock, places the sphere (radius slider 3–30 mm, initial 10 mm; `LESION_RADIUS`). The centre is rounded to 0.1 mm. The radius previews while dragged and is measured on release; a request overtaken by a later placement is dropped. The report is Anatomy's detail while no region is selected. **On the brain** paints the lesion alone, the leading functions' whole territories or the cited regions of the leading findings, in six colours by rank (`FINDING_COLORS`), each region taking the colour of the first item that claims it. **Anatomy measured** lists tissue volumes, cortical regions on Destrieux or HCP-MMP, deep structures, gyral white matter and arterial territories; shares are shown to whole percent above 10% and to 0.1% below. Activating a counted bundle draws only its crossing streamlines over a see-through cortex. A coordinate from [published coordinates](published-coordinates.md) uses the same sphere; placing either replaces the other. URL state: `lesion=<x>,<y>,<z>,<r>`, `lesionmode=lesion|functions|deficits`, `lesiontract=<bundle>` ([sharing and snapshots](sharing-and-snapshots.md)).

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| `published-data.test.ts`, tissue | 15 mm sphere at (−45, −25, 30) on CDMD equals an independent NumPy measurement of the same files | cortex 5,693, white 7,069, deep 0, fluid 1,127, outside 258 mm³ |
| `published-data.test.ts`, regions | Same sphere, $V_\text{inside}$ of $V_\text{whole}$ | `destrieux:left:41` 964 of 1,181 mm³; `destrieux:left:38` 9 of 5,293; `hcp-mmp:left:139` 732 of 851; `wmparc:left:3031` 2,167 of 6,520 |
| `published-data.test.ts`, streamlines | Same sphere against `af.left.trk.gz`, points through `scanner_ras_to_surface_ras` | 3,025 of 3,639 streamlines |
| `measure.test.ts` | Voxel centres within $r$, boundary included; flipped, scaled and shifted affine; sphere past the grid; non-positive radius refused; FreeSurfer tissue classes; streamline counted once, segment-only crossings excluded | passes |
| `functions.test.ts`, `findings.test.ts`, `report.test.ts`, `tracts.test.ts` | Side-restricted territory shares; unsized area refused; one-side bilateral findings; territory shares of the lesion; bundle choice across the midline | passes |
| `marking.test.ts`, `lesion.test.ts` | Centroid footprint in world space with turned normals; halo widths in CSS pixels; each atlas read from its own volume | passes |

The tissue total, 14,147 mm³, is within 0.1% of $\tfrac{4}{3}\pi\,15^3 = 14{,}137$ mm³; 964/1,181 = 81.6% of Destrieux left region 41 lies inside.

## Limitations
- A shape on one brain, measured against its labels; not a patient's lesion, and no prediction of deficit.
- Function territories are group activation-consistency maps in healthy people, not lesion–deficit maps ([functions](functions.md)).
- Deficit findings are group-level associations mapped onto a reference anatomy ([deficits](deficits.md)).
- A sphere ignores the vascular, white-matter and network shape of real lesions.
- Streamline counts are reconstructions from one diffusion scan, not axons and not a measure of disconnection; an anatomy without its own tracts shows none.
- Structures drawn only as meshes (fornix, mammillary nuclei) have no label volume and are not measured.
- Arterial territories are typical territories registered onto this brain ([arterial territories](arterial-territories.md)).
- Membership follows the label grid: 1 mm, or 0.8 mm for NextBrain.

## Code availability

| | |
| :--- | :--- |
| Code | [`web/src/lib/engine/lesion/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/lib/engine/lesion) (`lesion.ts`, `measure.ts`, `marking.ts`), [`web/src/lib/core/lesion/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/lib/core/lesion) (`functions.ts`, `findings.ts`, `report.ts`, `tracts.ts`), [`web/src/lib/state/lesion.svelte.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/state/lesion.svelte.ts), [`web/src/features/lesion/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/features/lesion) |
| Configuration | [`web/src/lib/types/constants.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/types/constants.ts) `LESION_RADIUS`; [`config/neuropsych-domains.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/neuropsych-domains.yaml) `threshold_z` |
| Tests | `web/src/lib/engine/lesion/*.test.ts`, `web/src/lib/core/lesion/*.test.ts`, `web/src/features/lesion/LesionReport.svelte.test.ts` |

```bash
npm test --prefix web -- lesion
```

`published-data.test.ts` reads `public/models/cdmd/` and `public/diffusion/cdmd-sub-013/`, which the CDMD build and tract packaging write.

Figure state (Fig. 1a): https://planumatlas.com/#anatomy=cdmd&colors=tissue&lesion=-45,-25,30,15; (Fig. 1b): https://planumatlas.com/#anatomy=cdmd&lesion=-45,-25,30,15&cut=coronal&pos=-25
