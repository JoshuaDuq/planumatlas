# MNI template

The **Subject** choice offers a second brain beside CDMD sub_013: the ICBM 152 2009c nonlinear asymmetric template (MNI152NLin2009cAsym), an average of 152 young adults' MRI. Its header was scaled by 0.90, which brings it to the mean brain size of the CDMD adults. It was reconstructed and segmented the way CDMD was and carries the same five cortical atlases, FreeSurfer's aseg, NextBrain and the teaching set. A coordinate or map in its own space is placed on it by that scale alone, with no registration, and its **Tracts** tab draws 21 bundles of an averaged tract atlas. An average smooths the folds and blurs small structures, so its anatomy is nobody's, and it has no spinal cord or arousal nuclei. Its cerebellar cortex is divided into CerebNet's 25 lobules as CDMD's is, although the average no longer shows the fissures of its hemispheres.

```{figure} figures/mni-template-1.webp
:alt: Two rows of three panels on black. Top row, the individual brain: a left hemisphere coloured by Destrieux regions with deep, narrow folds; a coronal cut seen from the front with every structure capped in colour; the same plane on its T1-weighted MRI, sharp grey and white matter. Bottom row, the MNI template in the same three views: a left hemisphere of about the same size with broader, smoother folds and a cerebellum divided into smooth coloured lobules; a coronal cut with the same structures capped; its MRI plane, smooth and blurred, with no skull or neck detail.
:name: fig-mni-template-1

**One person and an average, built by the same pipeline.** **a**–**c**, CDMD sub_013. **d**–**f**, The MNI template at 0.9 of its size. **a**, **d**, Left hemisphere from the left, coloured by Destrieux. **b**, **e**, Coronal cut through the centre of the left thalamus (y = −12 mm on CDMD and −1 mm on the template, each in its own surface RAS), seen from the front; every structure is capped in its teaching-set or Destrieux colour. Each cerebellum is drawn as its 25 CerebNet lobules. **c**, **f**, The same plane in **Linked MRI**: each brain's own T1, CDMD's windowed 0–188 and the template's 0–256. Panels a, b, d and e share one scale; the MRI planes are shown whole.
```

## Data

| Input | Content | Pinned by |
| :--- | :--- | :--- |
| TemplateFlow `tpl-MNI152NLin2009cAsym_res-01_T1w` ([Fonov et al.](../reference/references.md#group-data-and-templates); MNI template licence) | 1 mm T1, 193 × 229 × 193 voxels. Its header is scaled by 0.90 (voxels 0.9 mm, values unchanged) as `tpl-MNI152NLin2009cAsym_res-01_T1w_scale-0.90.nii.gz` | `input_sha256` `cdfcac3b…d48b` in `config/model.yaml` |
| FreeSurfer 8.2, Linux build `8.2.0-20260314-d932c45` | `recon-all` on the scaled T1 | `freesurfer_build` in `config/model.yaml`; `data/mni152/reconstruction.json` |
| Cortical atlases | Destrieux and Desikan-Killiany from `recon-all`'s own classifiers; HCP-MMP1.0, Julich-Brain 3.1 and Schaefer-400 carried from `fsaverage` through the registered spheres, as on CDMD ([cortical atlases](cortical-atlases.md)) | `data/sources.json`; `data/mni152/*-registration.json` |
| NextBrain | `nextbrain-mni152.mgz` and its near-tie volume, 0.4 mm, segmented as CDMD's ([internal anatomy](internal-anatomy.md)) | `data/sources.json` |
| Cerebellar lobules | CerebNet (FastSurfer v2.6.0) on the template's conformed `orig.mgz`, as on CDMD ([internal anatomy](internal-anatomy.md)) | `data/sources.json` |
| HCP1065 tract atlas (Yeh 2022; CC BY-SA 4.0) | 21 bundles placed on the template ({ref}`tracts <tracts-template>`) | `data/diffusion-mni152.yaml` |

Published under `public/models/mni152/` (37 files, 156 MB) and `public/diffusion/mni152-hcp1065/` (21 gzip TRK files, 136 MB, with `surface-space.json`, the brain outline and `provenance.json`). `public/models/anatomies.json` lists the template beside CDMD as `"individual": false`. Citations and licences: [references](../reference/references.md#group-data-and-templates).

## Method

### Size
The template's brain is 1,548 cm³, against a mean of 1,133 cm³ over the 26 CDMD adults. Its header was scaled by 0.90, the cube root of their ratio (0.901) to two places, so that lengths, cut positions and scale bars on it read at adult size. Only the voxel size changed; every voxel value is the template's.

### Reconstruction
`recon-all` (FreeSurfer 8.2) ran on the Rorqual cluster with 8 threads, with FreeSurfer's Linux build rather than the macOS install CDMD's reconstruction pins. Its import of the scaled T1 is exact: voxel values unchanged and an affine error of 0.0 mm. Scanner RAS reaches surface RAS by a translation of (−0.45, +15.75, −16.65) mm, the conformed volume's −`c_ras`.

### Layers
`config/model.yaml` declares the template's layers as `networks`, `nextbrain`, `cerebellar_lobules`, `cerebellar_functions`, `coordinate_spaces` and `striatal_networks`, and `brain_model.build` compiles them the way it compiles CDMD's:

- the five cortical atlases on the template's own surfaces, with their ribbon labels and cut-face volumes;
- aseg (32 structures), NextBrain (317 meshed structures) and the teaching set (106 units, CerebNet's 25 cerebellar lobules among them);
- boundary certainty and segmentation agreement, computed on the template's own NextBrain run;
- Yeo and CAB-NP networks, functional divisions and the layers that reach a brain by area or structure name: the 70 Functions maps, receptor fingerprints, cortical layers, both stimulation-response datasets, functional connectivity and disorder effects;
- two group maps registered onto the template as onto CDMD: Choi's striatal networks and Nettekoven's functional cerebellar regions.

Some layers are built for CDMD only: the spinal cord, the arousal nuclei, gyral white matter, arterial territories, stroke cases, atlas comparison, the visual field map, the search of 277 further Neurosynth terms and the SPM12 coordinate space.

### Cerebellar lobules
`scripts/segment_cerebellum.py` ran CerebNet on the template's conformed `orig.mgz` as it did on CDMD's ([internal anatomy](internal-anatomy.md)). The averaged T1 still shows the fissures of the vermis and the main white-matter branches, but not the folia or finer fissures of the hemispheres. The lobule borders there rest on those branches and on the shape CerebNet learned from individual brains.

Two checks were made. CerebNet's lobules together overlap aseg's cerebellar cortex with a Dice of 0.929 (CDMD: 0.918). SUIT's lobules (Diedrichsen et al. 2009), registered to the template's cerebellum by the steps that register them to CDMD's ([cerebellar functions](cerebellar-functions.md)), overlap CerebNet's with a mean Dice of 0.763 over 24 units, from 0.590 (left lobule X) to 0.845. On CDMD the same comparison gives 0.651, from 0.485 to 0.812. SUIT is itself a group average, so this shows that the template's borders lie where a group atlas places them, not that they follow fissures. The second check is the registration check of the template's [cerebellar functions](#registered-group-maps), recorded in `data/mni152/cerebellar-registration.json` and measured again by every validation.

### Its own coordinate space
The template is MNI152NLin2009cAsym itself, so `coordinate_spaces.native_space` publishes one affine and no field. A point $\mathbf{p}$ in template millimetres lands at

$$\mathbf{p}' = 0.9\,\mathbf{p} + (-0.45,\ +15.75,\ -16.65)\ \text{mm}$$

in surface RAS. A landing outside aseg's brain, widened by 4 mm (`mask_margin_mm`), is refused: the box runs from (−71, −87, −91) to (70, 89, 66) mm. An overlay is read through the inverse, $(\mathbf{p}' - \mathbf{t})/0.9$, on a 1 mm grid over the same box (`nativeInverse`). Coordinate and Overlay therefore rest on one affine, as on CDMD they rest on one field ([published coordinates](published-coordinates.md), [overlays](overlays.md)).

### Tracts
The template has no diffusion scan. Its **Tracts** tab draws 21 bundles of the HCP1065 population-averaged atlas, which is in ICBM 2009a millimetres, the template's own space. They are placed by the 0.9 scale with no registration, one streamline in four kept, trimmed into the brain and resampled to 0.5 mm ({ref}`tracts <tracts-template>`).

### Registered group maps
`scripts/register_striatal_networks.py` and `scripts/register_cerebellar_functions.py` registered Choi's striatal networks (from FSL's MNI152NLin6Asym) and Nettekoven's functional cerebellar regions (from the SUIT template) onto the template by the steps that register them onto CDMD ([striatal networks](striatal-networks.md), [cerebellar functions](cerebellar-functions.md)). They ran on the Rorqual cluster with FreeSurfer 8.2's Linux build, the build the template was reconstructed with (Slurm job 27417424, 8 threads, 7 min 24 s). Both passed the limits CDMD's registrations had to meet:

- striatal networks: the template's own SynthSeg striatum, carried by the warp, meets aseg's at a mean Dice of 0.841 (limit 0.8; CDMD 0.876), from 0.776 (right accumbens) to 0.883 (right caudate); the atlas reaches at least 88.8% of each striatal structure (limit 75%; CDMD 82.8%), least the right accumbens;
- cerebellar functions: SUIT's lobules, carried by the same warp, meet CerebNet's at a mean Dice of 0.763 (limit 0.6; CDMD 0.651); 99.4% of the atlas's labels lie on their own side (limit 97%; CDMD 99.5%); the atlas covers 95.09% of aseg's cerebellar cortex (limit 95%; CDMD 98.5%), the narrowest margin of the six checks.

### Role in registration landing
The same reconstruction's NextBrain volume is the reference that [registration landing](registration-landing.md) carries through CDMD's coordinate field. The template therefore has no landing record of its own, and the error with which a map registered onto it lands on fine structures is not measured. Its striatal networks give a structure under 100 mm³ no shares, as on CDMD, but do not name the networks round it either (`small` is null in the manifest).

## Display
**Subject**, in the data popover under the masthead, lists both brains; choosing one reloads the viewer on it (`anatomy=mni152`). Its note reads "An average of 152 young adults at mean adult size, with an averaged atlas's tracts and no spinal cord". The template's files, tract catalog and wording load only when it is opened, so CDMD's first visit downloads none of them. **About this data** and **Provenance** say that the brain is an average, that its tracts come from other people and that its own space is placed without registration.

What changes on the template:

- **Deficits** leaves out 1 of 149 profiles, coma, which maps brainstem arousal nuclei the template lacks. **Circuits** leaves out 4 of 45 tours, each with a landmark in the spinal cord, which the template lacks: corticospinal descent, the spinothalamic pathway, ventral spinocerebellar input and rubrospinal descent. Each list's coverage line says how many are on CDMD sub_013 only.
- **Coordinate** and **Overlay** offer MNI152NLin2009cAsym, and MNI with no template stated, which is read as MNI152NLin2009cAsym. Nothing is downloaded to place them. The coordinate report adds that the landing is a location on an average brain.
- **Tracts** lists 18 association, 2 projection and 1 commissural bundle. It offers **MRI with tracts** with no FA layer and no tract profile. A [lesion](lesion-report.md#streamlines) counts streamlines in the 20 lateral bundles; the whole callosum is not counted.
- **Linked MRI** shows the template's T1, windowed 0–256 (CDMD's 0–188).
- The visual field map is not offered.

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| `recon-all` import (`data/mni152/reconstruction.json`) | Scaled T1 imported exactly | voxel values exact; affine error 0.0 mm |
| `tests/test_coordinate_spaces.py`, two template tests | The space has 0.9 on its diagonal and no field or registration; MNI (0, 0, 0) lands in an aseg structure within 5 mm of the midline; every aseg voxel lies inside the bounds; a scale other than the template's own is refused | passes |
| `spaces.test.ts`, `inverse-field.test.ts`, `carry.test.ts` | A coordinate in the template's own space is placed by its scale alone, downloading nothing; the inverse reads a point back in template millimetres over its brain only; a map in its own space lands where the scale puts it | passes |
| `catalog.test.ts`, `data.test.ts` | Exactly the 4 tours and 1 profile above are left out, each for a cord level or arousal nucleus the template lacks, and the rest resolve; asked to resolve everything, the template is refused | passes |
| `DataBar.svelte.test.ts`, `AnatomyExplorer.svelte.test.ts`, `provenance.test.ts` (PROV-26) | The subject note, the anatomy sheet and Provenance call the brain an average in both languages; its own space is not listed as a registered map | passes |
| `scripts/prepare_diffusion_mni152.py` | Share of the published streamline length in the template's white matter ≥ 0.90 | 0.934 |
| `validate_segmentation.cerebellar_agreement`: CerebNet lobules vs aseg cerebellar cortex (8, 47), 1 mm | Dice ≥ 0.85 | 0.929 |
| CerebNet lobules vs SUIT's lobules carried onto the template (`data/mni152/cerebellar-registration.json`) | Mean and lowest lobule Dice at least CDMD's (0.651, 0.485) | 0.763, 0.590 |
| `striatal_networks.accept` on the template (`data/mni152/striatal-registration.json`) | Mean striatum Dice ≥ 0.8; each structure ≥ 75% reached | 0.841; 88.8% |
| `cerebellar_functions.accept` on the template (`data/mni152/cerebellar-registration.json`) | Mean lobule Dice ≥ 0.6; cortex covered ≥ 95%; side agreement ≥ 97% | 0.763; 95.09%; 99.4% |
| `brain_model.validate --anatomy mni152` | The checks CDMD passes | fails one check: the teaching set's medial septal unit lies 57.4% inside other sources, against a limit of 50%. Validation stops there, so later checks do not run, and no `validation.json` is published for the template |

The septal unit sits on the template's blurred midline, where it overlaps aseg's corpus callosum and ventricle.

## Limitations
- An average of 152 young adults, not a person. Its folds are smoothed and its small structures blurred; on its MRI the cortical ribbon is fainter than on a single scan.
- The 0.9 scale matches brain volume only. Shape and proportions are the template's.
- FreeSurfer and NextBrain were built to segment one person's scan. On the template's blurred contrast their labels were not checked against any reference, and NextBrain's atlas prior places more of its boundaries. The validator's failed check above is one sign of this.
- CerebNet was also built for one person's scan. In the template's cerebellar hemispheres its lobule borders do not follow fissures that can be seen, and they were checked only against aseg's outline and SUIT's group lobules. Left lobule X agrees least with SUIT (Dice 0.590).
- The template was reconstructed with FreeSurfer's Linux build on a cluster, not the pinned macOS install CDMD's checks name.
- Only maps and coordinates in MNI152NLin2009cAsym are placed on it. A map in another template, such as FSL's MNI152NLin6Asym, is read as MNI152NLin2009cAsym if opened as an unstated MNI map; on CDMD the two readings land a median 1.56 mm apart at the cortex.
- The accuracy figures on the other pages were measured on CDMD. On the template only the tracts' white-matter share, the lobule agreement and the two group maps' registration checks above have been measured.
- The functional cerebellar atlas covers 95.09% of the template's cerebellar cortex, just over its 95% limit; the rest carries no functional region.
- Its tracts are an average over 1,065 other people, not tracked in this brain ([tracts](tracts.md#limitations)).

## Code availability

| | |
| :--- | :--- |
| Code | [`scripts/reconstruct_subject.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/reconstruct_subject.py), [`scripts/prepare_subject.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/prepare_subject.py), [`scripts/segment_nextbrain.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/segment_nextbrain.py), [`scripts/segment_cerebellum.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/segment_cerebellum.py), [`scripts/register_striatal_networks.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/register_striatal_networks.py), [`scripts/register_cerebellar_functions.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/register_cerebellar_functions.py), [`brain_model/layers/coordinate_spaces.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/coordinate_spaces.py) (`native_space`), [`scripts/prepare_diffusion_mni152.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/prepare_diffusion_mni152.py); [`web/src/lib/core/coordinates/spaces.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/coordinates/spaces.ts) (`placeNative`), [`web/src/lib/core/user-map/inverse-field.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/user-map/inverse-field.ts) (`nativeInverse`), [`web/src/lib/core/i18n/areas/template.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/i18n/areas/template.ts) |
| Configuration | `anatomies.mni152` and `tract_catalogs` in [`config/model.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/model.yaml); [`data/diffusion-mni152.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/diffusion-mni152.yaml); [`public/models/anatomies.json`](https://github.com/JoshuaDuq/planumatlas/blob/main/public/models/anatomies.json) |
| Tests | `tests/test_coordinate_spaces.py`, `tests/test_prepare_diffusion_mni152.py`; `web/src/lib/core/coordinates/spaces.test.ts`, `web/src/lib/core/user-map/{inverse-field,carry}.test.ts`, `web/src/lib/core/learning/catalog.test.ts`, `web/src/lib/core/clinical/data.test.ts` |

```bash
# recon-all ran on Rorqual with FreeSurfer 8.2's Linux build (--freesurfer, --threads)
uv run python scripts/reconstruct_subject.py --anatomy mni152
uv run python scripts/prepare_subject.py --anatomy mni152
uv run python scripts/segment_nextbrain.py --anatomy mni152
uv run python scripts/segment_cerebellum.py --anatomy mni152 --record
# both registrations ran on Rorqual with FreeSurfer 8.2's Linux build (--freesurfer, --threads 8)
uv run python scripts/register_striatal_networks.py --anatomy mni152 --record
uv run python scripts/register_cerebellar_functions.py --anatomy mni152 --record
uv run python -m brain_model.build --anatomy mni152
uv run python scripts/prepare_diffusion_mni152.py
uv run python scripts/prepare_diffusion_space.py --anatomy mni152
uv run python scripts/prepare_diffusion_outline.py --anatomy mni152
uv run python -m brain_model.validate --anatomy mni152
uv run pytest tests/test_coordinate_spaces.py tests/test_prepare_diffusion_mni152.py
npm test --prefix web -- coordinates user-map learning clinical
```

Figure state (Fig. 1a): https://planumatlas.com/#anatomy=cdmd&atlas=destrieux&detail=learning&view=left; (Fig. 1b, then **Linked MRI** for c): https://planumatlas.com/#anatomy=cdmd&atlas=destrieux&detail=learning&cut=coronal&pos=-12&view=anterior; (Fig. 1d–f): the same with `anatomy=mni152` and, for e and f, `pos=-1`.
