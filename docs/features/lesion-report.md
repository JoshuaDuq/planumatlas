# Lesion report

A sphere of 3 to 30 mm placed on the brain or a cut face is measured, in the browser, against the subject's published label volumes, and the report ranks the functions, deficits, regions and tracts it overlaps. The report measures overlap only; it predicts no deficit.

```{figure} ../../.github/assets/readme/lesion.webp
:alt: A 10 mm lesion sphere on the left subcentral gyrus, with the report listing the sensorimotor functions and deficits it overlaps

A 10 mm sphere on the left subcentral gyrus. The report ranks the functions and deficits it overlaps; it measures overlap only.
```

:::{list-table}
:widths: 22 78
:stub-columns: 1

* - Where in the viewer
  - **Lesion** in the stage dock places the sphere; the report is Anatomy's detail while no region is selected (**Show the report**)
* - Built by
  - Viewer only; it reads the files the cut and the tract builds publish. [`web/src/lib/engine/lesion/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/lib/engine/lesion) (`lesion.ts`, `measure.ts`, `marking.ts`), [`web/src/lib/core/lesion/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/lib/core/lesion) (`functions.ts`, `findings.ts`, `report.ts`, `tracts.ts`), [`web/src/lib/state/lesion.svelte.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/state/lesion.svelte.ts), [`web/src/features/lesion/`](https://github.com/JoshuaDuq/planumatlas/tree/main/web/src/features/lesion) (`LesionPopover.svelte`, `LesionReport.svelte`, `SphereTracts.svelte`)
* - Configuration
  - [`web/src/lib/types/constants.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/types/constants.ts) `LESION_RADIUS` (min 3, max 30, initial 10 mm); [`config/neuropsych-domains.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/neuropsych-domains.yaml) `threshold_z: 3` for the territories
* - Source data
  - `tissue-labels.json` and its volumes, `white-matter.volume`, `neuropsych-domains.json`, the deficit findings in [`data/neuropsychology.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/neuropsychology.yaml), and CDMD's TractSeg bundles under `public/diffusion/`
* - Checked by
  - `web/src/lib/engine/lesion/published-data.test.ts` (against an independent NumPy measurement), `measure.test.ts`, `lesion.test.ts`, `marking.test.ts`; `web/src/lib/core/lesion/*.test.ts`; `LesionReport.svelte.test.ts`
:::

## What it does

**Lesion** places a sphere of 3 to 30 mm radius. Set **A click on the brain** to **Places the lesion**, then click the brain or a cut face to set the centre; the choice returns to selecting when the popover closes. Cut first to place it at depth. The radius redraws as the slider moves and is measured once released. The sphere's centre is written to tenths of a millimetre in surface RAS.

A placed lesion is Anatomy's detail. It opens on **What it reaches**, under the six groups the Functions and Deficits tabs share, strongest group first.

- **Functions** whose territories the lesion overlaps. A territory is a function's HCP-MMP areas and structures at z ≥ 3, on the sides the lesion reaches. Each function shows the share of its territory inside the lesion; bars are scaled to the largest share. Three functions lead each group, the rest folded under **more**.
- **Deficits** with a finding whose cited region the lesion reaches, with the largest share reached.

Each row opens its function or deficit. **On the brain** switches between the lesion alone, the territories of the leading functions, and the regions cited by the findings, one colour per item in rank order; the atlas follows the choice.

Below, **Findings in detail** lists each finding with its reached regions and mapping note, and marks a bilateral finding the lesion reaches on one side only. **Anatomy measured** gives the tissue volumes (cm³ inside) and each cortical region's share, on Destrieux or HCP-MMP; deep structures, gyral white matter (within 5 mm of cortex, named by the gyrus above) and arterial territories follow. **Tracts** downloads the bundles on the sides the sphere reaches, plus the seven callosal segments, and counts the streamlines with a point inside. Activate a counted bundle to draw only those streamlines, over a see-through cortex; the lesion's footprint becomes see-through with it. They follow the sphere as it moves or grows, and activating the bundle again, removing the lesion or leaving Anatomy gives the tracts and the cortex back. They are reconstructed streamlines with a point inside the sphere: not axons, and not a measure of disconnection.

Structures drawn only as meshes, such as the fornix, are not measured. The report states that it is a shape placed on this one brain, measured against its 1 mm labels, not a patient's lesion.

## Data

The lesion adds no published file. It reads:

| Input | Used for |
| :--- | :--- |
| `tissues-<atlas>.volume` for every atlas in `tissue-labels.json` (Destrieux, HCP-MMP, Julich-Brain, Schaefer, NextBrain, Blood supply, Cerebellar functions, Striatal networks) | Each atlas answers for its own regions; the label table gives each label's `region_id`, `name` and `kind` |
| `white-matter.volume` | Gyral white-matter parcels, `wmparc` regions |
| `neuropsych-domains.json` | Each function's group, and the areas and structures whose mean z reaches the threshold |
| The deficit findings (`data/neuropsychology.yaml`, loaded as `clinical.associations`) | Each finding's laterality and its cited regions (`mappings`) |
| `public/diffusion/cdmd-sub-013/*.trk.gz` and `surface-space.json` | Streamlines and the scanner-to-surface transform for the tract counts |
| The cortical meshes on the stage | The lesion's footprint |

Label volumes and their grids are described in [sections and cuts](sections-and-cuts.md#how-it-was-built); tracts in [tracts](tracts.md).

## How it was built

### 1. Measure the sphere (`engine/lesion/measure.ts`)

`LesionSphere` is a centre in surface RAS millimetres and a positive finite radius (a non-positive radius throws before anything is drawn or measured).

1. `voxelsInSphere` takes the sphere's bounding box in voxel indices (its eight corners through the volume's inverse affine), clamps it to the grid, and visits each voxel in it. A voxel counts when its **centre** lies within the radius, boundary included ($d^2 \le r^2$), computed in RAS through the volume's own affine, so a flipped, scaled or shifted grid is handled. It returns a count per stored label value.
2. `regionsInSphere` turns each count into mm³ with the voxel's volume (the absolute determinant of the voxel-to-RAS matrix) and pairs it with the region's whole size from `labelTotals` (a count of every voxel of each value, taken once per volume): `{ inside, whole }`. A label without a `region_id` is not a region.
3. `tissueInSphere` classes each label of the Destrieux volume (FreeSurfer's own `aparc.a2009s+aseg` labels) by `tissueClass`: cortex by `kind`; `Unknown` is outside; names matching `White-Matter`, `WM-hypointensities` or `CC_` are white matter; `Ventricle`, `-Vent` or `CSF` are fluid; any other labelled structure is deep grey; a label that fits none throws. The lesion's volume is the sum of those classes, and the centre's tissue and region come from `Volume.label` at the centre, the label the stage draws there.
4. `createLesion.measure` loads every atlas volume and the white-matter volume in parallel and keeps, from each, only the regions its atlas owns (the aseg regions are read once, from the Destrieux volume, which shares aseg's labels; `wmparc` from its own volume). A volume is downloaded once and cached; a failed download is not cached.

A request that a later placement overtakes is dropped, so only the placement that asked is answered.

### 2. Functions (`core/lesion/functions.ts`)

`functionReach` builds each function's territory from `neuropsych-domains.json`: the areas and structures whose mean z reached the published threshold (z ≥ 3, per area and per aseg structure), restricted to the sides the lesion reaches plus the midline, so a left lesion is weighed against the left territory, not against both. A function is listed when the lesion reaches at least one of its areas. Its share is the sum of the lesion's `inside` volume over the reached areas divided by the sum of the whole sizes of all its territory's areas (`regionSizes`); a territory area with no label volume size throws. `areas` counts the reached areas. Functions are sorted by share, and those under 1% (`SLIGHT_SHARE = 0.01`) fold away.

### 3. Deficits (`core/lesion/findings.ts`)

`rankFindings` takes each finding's `mappings` (cited regions) and keeps those the lesion reaches, each with its share `inside / whole`. A finding's share is the largest of those. A bilateral finding whose reached regions lie on one side only is marked `oneSide`. Findings sort by share; those under 1% fold away. A deficit stands for its findings at the largest share any reaches (`lesionProfile`), and groups sort by their strongest function or deficit. Nothing here is a prediction: the module states that overlap with a cited region is all it says.

### 4. Colouring the brain

`functionsPaint` and `findingsPaint` take the leading items in rank order in `FINDING_COLORS` (six colours: `57,135,229`, `213,81,129`, `0,131,0`, `201,133,0`, `98,80,214`, `232,123,164`), each region taking the colour of the first item that claims it; items past the palette are listed uncoloured. The paint is keyed to the sphere's centre and radius so a new placement repaints.

### 5. Regions and territories (`core/lesion/report.ts`)

`regionRows` lists one atlas's regions by share of the region inside the lesion; under 1% fold under "more under 1%". Percentages are whole numbers above 10% and to a tenth below, where small shares differ. `territoryRows` differs: a territory's share is of the **lesion volume that falls in some territory**, not of the territory, since which artery a lesion belongs to is the question; the territory volume in mm³ is shown ([arterial territories](arterial-territories.md)). `lesionSides` gives left, right or both from the sides of the labelled regions reached.

### 6. Tracts (`core/lesion/tracts.ts`, `engine/diffusion/tracts.ts`)

`lesionBundles` chooses the bundles: each side the sphere extends into ($x - r < 0$ is left, $x + r > 0$ is right, with RAS $+x$ right), then the callosal segments `callosum-1` to `callosum-7`; the whole-callosum file is left out, since the seven segments cover it at half its download. `crossing` downloads one bundle at a time, decodes it, counts and lets it go, so a lesion keeps no streamlines in memory; the sphere's centre is moved into the diffusion scanner's RAS through the scanner transform. `streamlinesCrossing` counts a streamline once when any of its points lies within the radius (`streamlineMembership`; a segment that crosses the sphere between two points outside it is not counted). The same membership selects the streamlines drawn when a bundle is activated.

### 7. The footprint (`engine/lesion/marking.ts`)

The sphere is drawn as the cortex it touches: `footprint` takes every triangle of the visible cortical meshes whose centroid lies within the radius, with the surface's own normals so it shades as the cortex beneath does, painted in the overlay ink with a polygon offset of −2, clipped by the cut's planes and following the cortex opacity while streamlines are drawn. A dashed ring of 128 segments (dash 0.11 of the radius, gap 0.7 of the dash) marks the full extent and a dot the centre, each on a dark halo (2 px for the ring, 1.5 px for the dot, in CSS pixels at any zoom), seen through the brain like the stage's other markings.

## How the viewer uses it

`createLesionStore` (`lesion.svelte.ts`) holds the sphere, the placement mode, the measurement (`measuring`, `ready`, `error`) and the tract count and view, each answered only for the placement that asked. `place` rounds the centre to tenths and measures; `previewRadius` moves the stage while the thumb moves and `commitRadius` measures; once the reader has asked for tracts, each later placement counts them too, and a bundle the lesion no longer crosses clears itself. A drawn bundle holds the cortex see-through (`cortex.hold`) and gives it back on release; the link carries the reader's own opacity, not the temporary one. The one sphere may instead mark a published coordinate at its own fixed radius; placing either replaces the other, and a lesion a coordinate replaced can be put back until the sphere changes again ([published coordinates](published-coordinates.md)).

The lesion travels in the link as `lesion=<right>,<anterior>,<superior>,<radius>`, with `lesionmode` (`lesion`, `functions` or `deficits`) and `lesiontract` (the drawn bundle, which must be one the lesion reaches); see [sharing and snapshots](sharing-and-snapshots.md).

## Checks

| Check | What it requires |
| :--- | :--- |
| Independent measurement | A 15 mm lesion at (−45, −25, 30) in CDMD measures as NumPy measures it from the same published files: tissue cortex 5,693, white 7,069, deep 0, fluid 1,127, outside 258 mm³; `destrieux:left:41` 964 of 1,181 mm³; `destrieux:left:38` 9 of 5,293 mm³; `hcp-mmp:left:139` 732 of 851 mm³; `wmparc:left:3031` 2,167 of 6,520 mm³ |
| Tract count | The same sphere crosses 3,025 of the 3,639 streamlines of CDMD's left arcuate (`af.left.trk.gz`), as NumPy counts every streamline point through `scanner_ras_to_surface_ras` |
| Sphere | Voxel centres within the radius, boundary included; a flipped, scaled and shifted affine; a sphere past the grid counts only the voxels inside it; a non-positive radius is refused |
| Tissue classes | FreeSurfer labels class as cortex, white matter, fluid, deep grey or outside the brain |
| Streamlines | Counted once when any point lies within the radius; segment-only crossings excluded; the count agrees with the selected tract view |
| Footprint | Triangles whose centroid lies within the radius, read through the world matrix, normals turned with the mesh; the ring and dot sit on a halo and face the camera in the frame that draws them |

A worked example from those figures: the 15 mm sphere holds 5,693 + 7,069 + 1,127 + 258 = 14,147 mm³ of label voxels (a sphere of that radius is about 14,137 mm³), of which 964 / 1,181 = 81.6% of left region 41 of the Destrieux atlas lies inside it.

## Limits

- A shape placed on this one brain, measured against its 1 mm labels; not a patient's lesion, and it predicts no deficit.
- Function territories are group activation maps in healthy people (Neurosynth consistency maps), not damage-to-deficit maps, and subcortical scores are weaker evidence than cortical ones; see [functions](functions.md).
- Deficit findings are group-level associations from selected literature mapped onto a reference anatomy; they do not predict an individual patient's deficit ([deficits](deficits.md)).
- A spherical footprint ignores the vascular, white-matter and network structure of a real lesion.
- Tract counts are reconstructed streamlines from this brain's diffusion scan, not axons; a crossing is not a measure of disconnection. An anatomy whose tracts belong to another subject publishes none of its own and shows "This anatomy publishes no tracts of its own."
- Structures drawn only as meshes, such as the fornix, have no label volume and are not measured.
- The arterial territories are typical territories registered onto this brain, not its own vessels.
- Membership is by voxel centre at the labels' own resolution (1 mm for the cortical atlases, 0.8 mm blocks for NextBrain), so a sphere's boundary follows that grid; shares under 1% are folded away.

## Reproduce

```bash
npm test --prefix web -- lesion
```

`published-data.test.ts` reads `public/models/cdmd/` and `public/diffusion/cdmd-sub-013/`, so the CDMD build and the tract packaging must be present ([building](../pipeline/building.md)). In the viewer, open a link such as `#lesion=-45,-25,30,15` to place the same sphere.

## See also

- [Published coordinates](published-coordinates.md): a coordinate's sphere replaces a lesion on the same stage
- [Sections and cuts](sections-and-cuts.md): the label volumes the measurement reads
- [Functions](functions.md), [Deficits](deficits.md), [Tracts](tracts.md), [Arterial territories](arterial-territories.md), [Stroke cases](stroke-cases.md)
- [Sharing and snapshots](sharing-and-snapshots.md)
