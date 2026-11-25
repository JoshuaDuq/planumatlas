# Lesion report

A sphere of 3 to 30 mm radius placed on the brain or a cut face is measured in the browser against the subject's published label volumes (1 mm grid; 0.8 mm for NextBrain). The report gives the tissue and regions inside it, ranks the functions and deficit findings whose regions it overlaps, and, when asked, counts the reconstructed streamlines that pass through it. It measures overlap on one brain; it predicts no deficit.

```{figure} figures/lesion-report-1-light.webp
:alt: Five panels. a, a tissue-coloured brain seen from the left with a dashed ring and centre dot over the temporoparietal junction and white patches of cortex inside the ring. b, a coronal cut coloured by region with the same ring over the left hemisphere. c, the report panel listing the lesion's size, centre, three functions with bars and percentages, and three deficits. d, the view of a with gyri painted in six colours and a key of six functions. e, the same with a key of six deficit findings.
:name: fig-lesion-report-1

**A 15 mm sphere at the left temporoparietal junction is drawn, measured and reported.** **a**, [The lesion](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&view=left&colors=tissue&lesion=-45,-25,30,15) on the brain seen from the left, under **Colour** **Tissue**. The dashed ring marks the sphere's full extent and the dot its centre, and the cortex inside the radius is painted white. **b**, [Coronal cut at y = −25 mm](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&lesion=-45,-25,30,15&cut=coronal&pos=-25&view=anterior) through the centre, seen from the front (the left hemisphere on the image's right). The cut faces carry the Destrieux labels the sphere is measured against. **c**, The report of the lesion in **a**. It gives 14.1 cm³ in the left hemisphere, the leading sensorimotor functions (Timing 9.5%, Interoception 8.8% and Action observation 7.9% of their left territories) and the deficits whose cited regions the sphere reaches (Somatosensory loss, with up to 82% of a cited region inside). **d**, The view of **a** with **On the brain** set to **Functions**, which paints the whole territories of the leading functions. **e**, The same with **On the brain** set to **Deficits**, which paints the cited regions of the leading findings. In **d** and **e** each region takes the colour of the first item of the key that claims it. Subject CDMD `sub_013`; centre (−45, −25, +30) mm surface RAS. Scale bars apply at the depth of the camera's target.
```

## Data

The lesion publishes no file. It reads, from `public/models/<anatomy>/` and `public/diffusion/<subject>/`:

| Input | Used for |
| :--- | :--- |
| `tissues-<atlas>.volume` for the nine atlases in `tissue-labels.json` (Destrieux, HCP-MMP, Julich-Brain, Schaefer, Desikan-Killiany, NextBrain, arterial territories, Nettekoven cerebellar functions, Choi striatal networks) | Region volumes; each label's `region_id`, `name` and `kind` |
| `white-matter.volume` | FreeSurfer `wmparc` gyral white matter (within 5 mm of cortex) |
| `neuropsych-domains.json` | Each function's group and its territory: HCP-MMP areas and aseg structures with mean consistency z ≥ 3 (`threshold_z` in `config/neuropsych-domains.yaml`) |
| `data/neuropsychology.yaml` | Each deficit finding's laterality and cited regions (`mappings`) |
| `*.trk.gz`, `surface-space.json` | RecoBundles and TractSeg streamlines (30 bundle files on CDMD, 29 counted), or, on the [MNI template](mni-template.md) (Montreal Neurological Institute), the HCP1065 atlas's (21, 20 counted), and the scanner-to-surface transform |
| Visible cortical meshes | The footprint |

Label grids are described in [sections and cuts](sections-and-cuts.md#data), and bundles in [tracts](tracts.md). The nine atlases of the first row are CDMD's. The MNI template publishes eight of the nine atlases, without the arterial territories, and no `white-matter.volume`.

## Method

### Voxel membership

A sphere is a centre $\mathbf{c}$ in surface RAS (right, anterior, superior) millimetres and a radius $r$ (Fig. 1a). A non-positive or non-finite radius raises an error. The sphere's bounding box is taken in voxel indices through each volume's inverse affine and clamped to the grid. A voxel belongs to the sphere when its centre $\mathbf{v}$, mapped to RAS through the volume's affine, satisfies $\lVert \mathbf{v}-\mathbf{c}\rVert^2 \le r^2$. Counts are kept per stored label and converted to mm³ by $\lvert\det A\rvert$ of the voxel-to-RAS matrix $A$.

### Tissue and regions

Each Destrieux (`aparc.a2009s+aseg`) label is classed as cortex (by `kind`), outside (`Unknown`), white matter (`White-Matter`, `WM-hypointensities`, `CC_*`), fluid (`Ventricle`, `-Vent`, `CSF`) or deep grey (any other labelled structure). An unclassifiable label raises an error. For each atlas only the regions it owns are kept (Fig. 1b). The aseg structures are read once from the Destrieux volume, and `wmparc` from its own. Each region is reported as $\{V_\text{inside}, V_\text{whole}\}$, the whole being a count of every voxel of that label. A region's share is $V_\text{inside}/V_\text{whole}$.

### Functions

For function $f$, let $T_f$ be its territory restricted to the hemispheres the lesion reaches plus the midline. Its share is

$$s_f = \frac{\sum_{a \in T_f \cap L} V_\text{inside}(a)}{\sum_{a \in T_f} V_\text{whole}(a)},$$

where $L$ is the set of regions the lesion reaches. A territory area with no label-volume size raises an error. Functions are ranked by $s_f$, and those under 1% (`SLIGHT_SHARE = 0.01`) are given only as a count. Three functions lead each group (Fig. 1c).

### Deficit findings

A finding's share is the largest $V_\text{inside}/V_\text{whole}$ among its cited regions that the lesion reaches. A bilateral finding reached on one side only (midline regions excluded) is marked as such. A deficit takes the largest share of its findings. Groups are ordered by their strongest function or deficit. Findings under 1% are folded into a collapsed list.

### Arterial territories

A territory's share is of the lesion volume that falls in any territory, not of the territory: $V_\text{inside}(t)/\sum_{t'} V_\text{inside}(t')$.

### Streamlines

Bundles are chosen by side: left when $c_x - r < 0$, right when $c_x + r > 0$, plus the seven callosal segments (bundles `callosum-1` to `callosum-7`, files `callosum_1.trk.gz` to `callosum_7.trk.gz`). The whole-callosum file is skipped. The MNI template's atlas has no callosal segments, so there only its 20 lateral bundles are counted and the callosum is not.

The centre is moved into scanner RAS through `surface-space.json`. A streamline is counted once when any of its points satisfies $\lVert \mathbf{p}-\mathbf{c}\rVert \le r$. A segment passing through the sphere between two outside points is not counted.

Bundles are counted in a worker, four downloading at a time. The worker keeps which 2 mm cells each counted bundle has a point in, and a bundle with no such cell within $r$ is counted as crossing none without its points being read. The worker also keeps the decoded points of the bundles within 5 mm of the lesion, 64 MiB at most, so a lesion placed again nearby downloads and decodes nothing. A bundle the Tracts tab has decoded is not downloaded again.

### Footprint

Every triangle of the visible cortical meshes whose centroid lies within $r$ is drawn with the surface's own normals in the overlay ink, with polygon offset −2 (Fig. 1a). A dashed ring of 128 segments (dash $0.11\,r$, gap $0.077\,r$) and a centre dot mark the extent. The ring and the dot sit on halos of 2 px and 1.5 px, measured in CSS (Cascading Style Sheets) pixels.

## Display

**Lesion**, under **Add** in the stage dock, places the sphere (**Radius** slider 3–30 mm, initial 10 mm; `LESION_RADIUS`). The centre is rounded to 0.1 mm. The radius previews while dragged and is measured on release. A request overtaken by a later placement is dropped. The report is Anatomy's detail while no region is selected, and the Deficits tab's while no deficit is open there, so a lesion simulated from Deficits is read there.

**On the brain** paints the lesion alone, the leading functions' whole territories or the cited regions of the leading findings, in six colours by rank (`FINDING_COLORS`), each region taking the colour of the first item that claims it (Fig. 1d,e). **Anatomy measured** lists tissue volumes, cortical regions on each cortical atlas (the one on screen first), deep structures, gyral white matter and arterial territories. Shares of 10% or more are shown to whole percent, and smaller shares to 0.1%.

Streamlines are counted only after **Count *n* bundles** is pressed, where the *n* bundles are those on the sides the sphere reaches. The note under the button reads "Downloads each bundle’s streamlines: tens of megabytes." The lesion is then counted again wherever it is placed, until it is removed, and a link with `lesiontract` counts on restore. Activating a counted bundle draws only its crossing streamlines over a see-through cortex.

A coordinate from [published coordinates](published-coordinates.md) uses the same sphere; placing either replaces the other. The link carries the lesion as `lesion=<x>,<y>,<z>,<r>`, `lesionmode=lesion|functions|deficits` and `lesiontract=<bundle>` ([sharing and snapshots](sharing-and-snapshots.md)).

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| `published-data.test.ts`, tissue | 15 mm sphere at (−45, −25, 30) on CDMD equals an independent NumPy measurement of the same files | cortex 5,693, white 7,069, deep 0, fluid 1,127, outside 258 mm³ |
| `published-data.test.ts`, regions | Same sphere, $V_\text{inside}$ of $V_\text{whole}$ | `destrieux:left:41` 964 of 1,181 mm³; `destrieux:left:38` 9 of 5,293; `hcp-mmp:left:139` 732 of 851; `wmparc:left:3031` 2,167 of 6,520 |
| `published-data.test.ts`, streamlines | Same sphere against `af.left.trk.gz`, points through `scanner_ras_to_surface_ras` | 3,025 of 3,639 streamlines |
| `measure.test.ts` | Voxel centres within $r$, boundary included; flipped, scaled and shifted affine; sphere past the grid; non-positive radius refused; FreeSurfer tissue classes; streamline counted once, segment-only crossings excluded | passes |
| `functions.test.ts`, `findings.test.ts`, `report.test.ts`, `tracts.test.ts` | Side-restricted territory shares; unsized area refused; one-side bilateral findings; territory shares of the lesion; bundle choice across the midline | passes |
| `marking.test.ts`, `lesion.test.ts` | Centroid footprint in world space with turned normals; halo widths in CSS pixels; each atlas read from its own volume | passes |

The tissue classes sum to 14,147 mm³, within 0.1% of the sphere's volume, $\tfrac{4}{3}\pi\,15^3 = 14{,}137$ mm³. Of Destrieux left region 41, 964/1,181 = 81.6% lies inside.

## Limitations

The lesion is a shape on one brain, measured against its labels. It is not a patient's lesion, and it predicts no deficit. A sphere ignores the vascular, white-matter and network shape of real lesions. Membership follows the label grid: 1 mm, or 0.8 mm for NextBrain. Structures drawn only as meshes (fornix, mammillary nuclei) have no label volume and are not measured.

Function territories are group activation-consistency maps in healthy people, not lesion–deficit maps ([functions](functions.md)). Deficit findings are group-level associations mapped onto a reference anatomy ([deficits](deficits.md)). Arterial territories are typical territories registered onto this brain ([arterial territories](arterial-territories.md)).

Streamline counts are reconstructions from one diffusion scan, not axons and not a measure of disconnection. An anatomy without its own tracts shows none. On the MNI template they are an averaged atlas's streamlines from 1,065 other people, and no callosal streamline is counted.

## Code availability

Code
: [`web/src/lib/engine/lesion/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/lib/engine/lesion) (`lesion.ts`, `measure.ts`, `marking.ts`), [`web/src/lib/core/lesion/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/lib/core/lesion) (`functions.ts`, `findings.ts`, `report.ts`, `tracts.ts`), [`web/src/lib/state/lesion.svelte.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/state/lesion.svelte.ts), [`web/src/features/lesion/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/features/lesion)

Configuration
: [`web/src/lib/types/constants.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/types/constants.ts) `LESION_RADIUS`; [`config/neuropsych-domains.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/neuropsych-domains.yaml) `threshold_z`

Tests
: `web/src/lib/engine/lesion/*.test.ts`, `web/src/lib/core/lesion/*.test.ts`, `web/src/features/lesion/LesionReport.svelte.test.ts`

```bash
npm test --prefix web -- lesion
```

`published-data.test.ts` reads `public/models/cdmd/` and `public/diffusion/cdmd-sub-013/`, which the CDMD build and tract packaging write.

