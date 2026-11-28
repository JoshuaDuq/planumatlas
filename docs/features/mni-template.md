# MNI template

The **Subject** choice offers a second brain beside sub_013 of the MGH Connectome Diffusion Microstructure Dataset (CDMD): the ICBM 152 2009c nonlinear asymmetric template of the Montreal Neurological Institute (MNI; MNI152NLin2009cAsym), an average of 152 young adults' magnetic resonance imaging (MRI) scans (Fig. 1). Its header was scaled by 0.90, which brings it to the mean brain size of the CDMD adults, and it was reconstructed and segmented the way CDMD was. It carries the same five cortical atlases, FreeSurfer's automatic subcortical segmentation (aseg), NextBrain, the teaching set and CerebNet's 25 cerebellar lobules, and its **Tracts** tab draws 23 bundles of an averaged tract atlas. A coordinate or map in its own space is placed on it by that scale alone, with no registration. An average smooths the folds, blurs small structures and no longer shows the fissures of the cerebellar hemispheres, so its anatomy is nobody's, and it has no spinal cord.

```{figure} figures/mni-template-1-light.webp
:alt: Two rows of three panels on black. Top row, the individual brain: a brain coloured by Destrieux regions with deep, narrow folds, seen from the left; a coronal cut seen from the front with every structure capped in colour; the same plane on its T1-weighted MRI, with sharp grey and white matter. Bottom row, the MNI template in the same three views: a brain of about the same size with broader, smoother folds and a cerebellum divided into smooth coloured lobules; a coronal cut with the same structures capped; its MRI plane, smooth and blurred, with no skull or neck detail.
:name: fig-mni-template-1

**One person and an average are built by the same pipeline.** **a**–**c**, CDMD `sub_013`. **d**–**f**, The MNI template at 0.9 of its size. **a**, **d**, The brain from the left, coloured by Destrieux ([CDMD](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&view=left), [template](https://planumatlas.com/#anatomy=mni152&lang=en&atlas=destrieux&detail=learning&view=left)). **b**, **e**, Coronal cut through the centre of the left thalamus, seen from the front ([y = −12 mm on CDMD](https://planumatlas.com/#anatomy=cdmd&lang=en&atlas=destrieux&detail=learning&cut=coronal&pos=-12&view=anterior), [y = −1 mm on the template](https://planumatlas.com/#anatomy=mni152&lang=en&atlas=destrieux&detail=learning&cut=coronal&pos=-1&view=anterior), each in its own surface RAS). Every structure is capped in its teaching-set or Destrieux colour, and each cerebellum is drawn as its 25 CerebNet lobules. **c**, **f**, The same plane in **Linked MRI**, in the radiological convention, with each brain's own T1, CDMD's windowed 0–188 and the template's 0–256. Panels **a**, **b**, **d** and **e** share one scale, and their scale bars apply at the depth of the camera's target. The MRI planes are shown whole.
```

## Data

| Input | Content | Pinned by |
| :--- | :--- | :--- |
| TemplateFlow `tpl-MNI152NLin2009cAsym_res-01_T1w` ([Fonov et al.](../reference/references.md#group-data-and-templates); MNI template licence) | 1 mm T1-weighted (T1) volume, 193 × 229 × 193 voxels. Its header is scaled by 0.90 (voxels 0.9 mm, values unchanged) as `tpl-MNI152NLin2009cAsym_res-01_T1w_scale-0.90.nii.gz` | `input_sha256` `cdfcac3b…d48b` in `config/model.yaml` |
| FreeSurfer 8.2, Linux build `8.2.0-20260314-d932c45` | `recon-all` on the scaled T1 | `freesurfer_build` in `config/model.yaml`; `data/mni152/reconstruction.json`; its outputs in `data/sources.json` |
| Cortical atlases | Destrieux and Desikan-Killiany from `recon-all`'s own classifiers; HCP-MMP1.0, Julich-Brain 3.1 and Schaefer-400 carried from `fsaverage` through the registered spheres, as on CDMD ([cortical atlases](cortical-atlases.md)) | `data/sources.json`; `data/mni152/*-registration.json` |
| NextBrain | `nextbrain-mni152.mgz` and its near-tie volume, 0.4 mm, segmented as CDMD's ([internal anatomy](internal-anatomy.md)) | `data/sources.json` |
| Cerebellar lobules | CerebNet (FastSurfer v2.6.0) on the template's conformed `orig.mgz`, as on CDMD ([internal anatomy](internal-anatomy.md)) | `data/sources.json` |
| HCP1065 tract atlas (Yeh 2022; CC BY-SA 4.0) | 23 bundles placed on the template ({ref}`tracts <tracts-template>`) | `data/diffusion-mni152.yaml` |
| Arterial territory atlas (Liu et al. 2023) | Registered onto the template as onto CDMD ([arterial territories](arterial-territories.md)) | `data/sources.json`; `data/mni152/arterial-registration.json` |
| SPM12 tissue probability maps | Registered onto the template as onto CDMD ([published coordinates](published-coordinates.md)) | `data/sources.json`; `data/mni152/coordinate-registration.json` |
| Harvard Ascending Arousal Network Atlas 2.0 | Ten brainstem nuclei placed on the template by both of CDMD's methods ([arousal nuclei](arousal-nuclei.md)) | `config/arousal-nuclei.yaml`; `data/sources.json`; `data/mni152/arousal-registration.json` |

The build is published under `public/models/mni152/` (84 files, 276 MB) and `public/diffusion/mni152-hcp1065/` (23 gzip-compressed TrackVis (TRK) files, 139 MB, with `surface-space.json`, the brain outline and `provenance.json`). `public/models/anatomies.json` lists the template beside CDMD as `"individual": false`. Citations and licences are in [references](../reference/references.md#group-data-and-templates).

## Method

### Size

The template's brain is 1,548 cm³, against a mean of 1,133 cm³ over the 26 CDMD adults. Its header was scaled by 0.90, the cube root of their ratio (0.901) to two places, so that lengths, cut positions and scale bars on it read at adult size (Fig. 1a, d). Only the voxel size changed. Every voxel value is the template's.

### Reconstruction

`recon-all` (FreeSurfer 8.2) ran on the Rorqual cluster with 8 threads, with FreeSurfer's Linux build rather than the macOS install that CDMD's reconstruction pins. Its import of the scaled T1 was exact: the voxel values were unchanged and the affine error was 0.0 mm. Scanner RAS (right, anterior, superior) coordinates reach FreeSurfer's surface RAS by a translation of (−0.45, +15.75, −16.65) mm, the conformed volume's −`c_ras`.

### Layers

`config/model.yaml` declares the template's layers as `networks`, `nextbrain`, `cerebellar_lobules`, `white_matter`, `neurosynth_terms`, `arterial_territories`, `cerebellar_functions`, `coordinate_spaces`, `striatal_networks`, `arousal_nuclei` and `network_matrix`, and `brain_model.build` compiled them the way it compiles CDMD's. The five cortical atlases lie on the template's own surfaces, with their ribbon labels and cut-face volumes, and four of them are compared pair by pair on its pial surface ([atlas comparison](atlas-comparison.md)). Inside the surfaces are aseg (32 structures), NextBrain (347 meshed structures, the teaching set's caudal medulla, 25 cerebellar lobules, corpus callosum and four ventricles among them), the teaching set (106 units, CerebNet's 25 cerebellar lobules among them; Fig. 1b, e) and the 68 parcels of FreeSurfer's gyral white matter from the same `recon-all` run. Boundary certainty and segmentation agreement were computed on the template's own NextBrain run.

The build also carries the Yeo and CAB-NP networks, the functional divisions and the layers that reach a brain by area or structure name: the 70 Functions maps, the search of 277 further Neurosynth terms, receptor fingerprints, cortical layers, both stimulation-response datasets, functional connectivity and disorder effects. Three group maps were registered onto the template as onto CDMD: Choi's striatal networks, Nettekoven's functional cerebellar regions and Liu et al.'s arterial territories. So was SPM12's space, for **Coordinate** and **Overlay**. The ten arousal nuclei were placed by FreeSurfer's SegmentAAN, as on CDMD.

Three layers are built for CDMD only. The template's scan ends 1.8 mm below aseg's brainstem, so it holds no spinal cord to segment. The visual field map failed the check fixed before its first build: on the right hemisphere, Wang et al.'s V1 met the V1 projected from Benson et al.'s retinotopy at a Dice coefficient of 0.687, below the 0.7 required (CDMD 0.720; 0.690 on fsaverage itself, before any projection). Stroke cases failed the same way: the cohort's mean brain, registered onto the template, carried its left pallidum onto the template's at a Dice coefficient of 0.645, below the 0.70 required of every structure (CDMD 0.739).

### Cerebellar lobules

`scripts/segment_cerebellum.py` ran CerebNet on the template's conformed `orig.mgz` as it did on CDMD's ([internal anatomy](internal-anatomy.md)). The averaged T1 still shows the fissures of the vermis and the main white-matter branches, but not the folia or finer fissures of the hemispheres. The lobule borders there rest on those branches and on the shape CerebNet learned from individual brains.

Two checks were made. CerebNet's lobules together overlap aseg's cerebellar cortex with a Dice coefficient of 0.929 (CDMD: 0.918). The lobules of the spatially unbiased infratentorial template (SUIT; Diedrichsen et al. 2009), registered to the template's cerebellum by the steps that register them to CDMD's ([cerebellar functions](cerebellar-functions.md)), overlap CerebNet's with a mean Dice of 0.763 over 24 units, from 0.590 (left lobule X) to 0.845 (right crus II). On CDMD the same comparison gives 0.651, from 0.485 to 0.812. SUIT is itself a group average, so this shows that the template's borders lie where a group atlas places them, not that they follow fissures. The second check is the registration check of the template's [cerebellar functions](#registered-group-maps), recorded in `data/mni152/cerebellar-registration.json` and measured again by every validation.

### Its own coordinate space

The template is MNI152NLin2009cAsym itself, so `coordinate_spaces.native_space` publishes one affine and no field. A point $\mathbf{p}$ in template millimetres lands at

$$\mathbf{p}' = 0.9\,\mathbf{p} + (-0.45,\ +15.75,\ -16.65)\ \text{mm}$$

in surface RAS. A landing outside the bounding box of aseg's brain, widened by 4 mm (`mask_margin_mm`), is refused. The box runs from (−71, −87, −91) to (70, 89, 66) mm. An overlay is read through the inverse, $(\mathbf{p}' - \mathbf{t})/0.9$, on a 1 mm grid over the same box (`nativeInverse`). **Coordinate** and **Overlay** therefore rest on one affine, as on CDMD they rest on one field ([published coordinates](published-coordinates.md), [overlays](overlays.md)).

SPM12's space is not the template's, so it is registered as on CDMD. `scripts/register_coordinate_spaces.py` registered SPM12's tissue probability maps to the template's `brain.mgz` and published the inverse warp as a field on the same 1.5 mm grid (`coordinates-spm12.field`, 100 × 126 × 112 nodes). It met every limit CDMD's fields had to meet. Hemisphere agreement was 0.999 (CDMD 0.998). Subcortical Dice had a median of 0.856 (CDMD 0.868) and a minimum of 0.752 at the left pallidum (CDMD 0.804 at the left thalamus). Cortex Dice was 0.752 (CDMD 0.717). The round trip was 0.03 mm at the median and 0.10 mm at p95, and the grid error 0.004 mm at p95. An unstated MNI coordinate is still read as the template's own space, so no other template was measured against it.

### Tracts

The template has no diffusion scan. Its **Tracts** tab draws 23 bundles of the HCP1065 population-averaged atlas, which is in ICBM 2009a millimetres, an earlier version of the template's ICBM 2009c average in the same space. They were placed by the 0.9 scale with no registration. One streamline in four was kept, trimmed into the brain and resampled to 0.5 mm steps ({ref}`tracts <tracts-template>`).

### Registered group maps

`scripts/register_striatal_networks.py` and `scripts/register_cerebellar_functions.py` registered Choi's striatal networks (from FSL's MNI152NLin6Asym) and Nettekoven's functional cerebellar regions (from the SUIT template) onto the template by the steps that register them onto CDMD ([striatal networks](striatal-networks.md), [cerebellar functions](cerebellar-functions.md)). They ran on the Rorqual cluster with FreeSurfer 8.2's Linux build, the build the template was reconstructed with (Slurm job 27417424, 8 threads, 7 min 24 s). Both passed the limits CDMD's registrations had to meet.

For the striatal networks, the SynthSeg striatum of the source template (MNI152NLin6Asym), carried by the warp, met the aseg striatum of the template at a mean Dice of 0.841 (n = 6 structures; limit 0.8; CDMD 0.876), from 0.776 (right accumbens) to 0.883 (right caudate). The atlas reached at least 88.8% of each striatal structure (limit 75%; CDMD 82.8%), least the right accumbens.

For the cerebellar functions, SUIT's lobules, carried by the warp that carries the atlas, met CerebNet's at a mean Dice of 0.763 (limit 0.6; CDMD 0.651). Of the atlas's labels, 99.4% lay on their own side (limit 97%; CDMD 99.5%). The atlas covered 95.09% of aseg's cerebellar cortex (limit 95%; CDMD 98.5%), the narrowest margin of the five checks.

`scripts/register_arterial_territories.py`, `scripts/register_stroke_cases.py` and `scripts/register_coordinate_spaces.py` ran the same way (Slurm job 27585779, 8 threads, 11 min 27 s). For the arterial territories, the atlas's ventricles met aseg's at a Dice of 0.679 on the left and 0.705 on the right (limit 0.6; CDMD 0.682 and 0.735). Of the cerebellar cortex, 98.3% lay in the cerebellar territories (limit 95%; CDMD 97.3%), 1.1% of cerebral tissue was unassigned (limit 2%; CDMD 1.2%), and hemisphere agreement was 0.997 (limit 0.98; CDMD 0.996).

### Arousal nuclei

`scripts/register_arousal_nuclei.py` placed the ten nuclei by both of CDMD's methods and measured each against the checks fixed for CDMD, with the same envelope and the same exception for the periaqueductal grey ([arousal nuclei](arousal-nuclei.md)). The SynthMorph registration of FSL's MNI152 to the template ran on Rorqual with the Linux build (Slurm job 27620317, 2 min 27 s, peak 19.7 GB; an earlier run gave the same labels byte for byte). It failed as it had on CDMD. The centroid of the ventral tegmental area lay 4.91 mm from NextBrain's and that of the dorsal raphe 3.67 mm, beyond the 3 mm limit (CDMD 5.00 and 3.67 mm), and 87.9% of the periaqueductal grey lay inside the brainstem and ventral diencephalon, under its 90% exception (CDMD 82.7%).

SegmentAAN passed. Its centroids lay 1.10 mm (dorsal raphe), 0.94 mm (periaqueductal grey) and 1.56 mm (ventral tegmental area) from NextBrain's, a mean of 1.20 mm (CDMD 0.96 mm), at a mean Dice of 0.283 (CDMD 0.371). The periaqueductal grey lay 90.9% inside the envelope (CDMD 90.7%) and every other nucleus at least 98.7%. The selection rule chose it, and its nuclei were kept to aseg's Brain-Stem and VentralDC as on CDMD. No Linux build of FreeSurfer 8.2 can run SegmentAAN: its compiled program is an empty file in the CentOS7 package and in Rorqual's module, and FreeSurfer's 2026-06-25 patch to 8.2.0 does not supply it. It therefore ran with the macOS build of the same release (commit d932c45) on the template's Linux reconstruction (35.9 min, 2.2 GB peak).

### Role in registration landing

The same reconstruction's NextBrain volume is the reference that [registration landing](registration-landing.md) carries through CDMD's coordinate field. The template therefore has no landing record of its own, and the error with which a map registered onto it lands on fine structures is not measured. Its striatal networks and arterial territories give a structure under 100 mm³ no shares, as on CDMD, but do not name the networks or territories round it either (`small` is null in the manifest).

## Display

**Subject**, in the data popover under the masthead, lists both brains. Choosing one reloads the viewer on it (`anatomy=mni152`). The template's note reads "An average of 152 young adults at mean adult size, with an averaged atlas's tracts and no spinal cord". The template's files, tract catalog and wording load only when it is opened, so CDMD's first visit downloads none of them. **About this data** and **Provenance** say that the brain is an average, that its tracts come from other people and that its own space is placed without registration.

On the template, **Deficits** lists all 177 profiles. **Circuits** leaves out 4 of 43 tours, each with a landmark in the spinal cord, which the template lacks: corticospinal descent, the spinothalamic pathway, ventral spinocerebellar input and rubrospinal descent. Its coverage line says how many are on CDMD sub_013 only.

On this brain **Coordinate** and **Overlay** offer MNI152NLin2009cAsym, SPM12 (TPM), and MNI with no template stated, which is read as MNI152NLin2009cAsym. Nothing is downloaded to place the template's own space; SPM12's field is downloaded when first used. The coordinate report adds that the landing is a location on an average brain.

**Tracts** lists 18 association, 4 projection and 1 commissural bundle; the cerebellar peduncles drawn on CDMD failed their gate on this atlas ({ref}`tracts <tracts-template>`). It offers **MRI with tracts** with no fractional anisotropy (FA) layer and no tract profile. A [lesion](lesion-report.md#streamlines) counts streamlines in the 22 lateral bundles; the whole callosum is not counted.

**Linked MRI** shows the template's T1, windowed 0–256 (CDMD's 0–188; Fig. 1c, f). The visual field map is not offered on the template.

## Validation

| Test | Criterion | Result |
| :--- | :--- | :--- |
| `recon-all` import (`data/mni152/reconstruction.json`) | Scaled T1 imported exactly | voxel values exact; affine error 0.0 mm |
| `tests/test_coordinate_spaces.py`, the template's own space | The space has 0.9 on its diagonal and no field or registration; MNI (0, 0, 0) lands in an aseg structure within 5 mm of the midline; every aseg voxel lies inside the bounds | passes |
| `tests/test_coordinate_spaces.py`, the published spaces | The template's own space and a registered SPM12 field are published, and only SPM12 is registered; a scale other than the template's own is refused; MNI (0, 0, 0) in SPM12 lands within 5 mm of the template's own reading | passes |
| `spaces.test.ts` | A coordinate in the template's own space is placed by its scale alone, downloading nothing | passes |
| `inverse-field.test.ts` | The inverse reads a point back in template millimetres over its brain only | passes |
| `carry.test.ts` | A map in its own space lands where the scale puts it | passes |
| `catalog.test.ts`, `data.test.ts` | Exactly the 4 tours above are left out, each for a cord level the template lacks, and the rest resolve; asked to resolve every tour, the template is refused; every profile resolves, and a copy of the template without its subthalamic nuclei leaves out hemichorea alone | passes |
| `DataBar.svelte.test.ts`, `AnatomyExplorer.svelte.test.ts`, `provenance.test.ts` (PROV-26) | The subject note, the anatomy sheet and Provenance call the brain an average in both languages; its own space is not listed as a registered map | passes |
| `scripts/prepare_diffusion_mni152.py` | Share of the published streamline length in the template's white matter ≥ 0.90 | 0.934 |
| `validate_segmentation.cerebellar_agreement`: CerebNet lobules vs aseg cerebellar cortex (8, 47), 1 mm | Dice ≥ 0.85 | 0.929 |
| CerebNet lobules vs SUIT's lobules carried onto the template (`data/mni152/cerebellar-registration.json`) | Mean and lowest lobule Dice at least CDMD's (0.651, 0.485) | 0.763, 0.590 |
| `striatal_networks.accept` on the template (`data/mni152/striatal-registration.json`) | Mean striatum Dice ≥ 0.8; each structure ≥ 75% reached | 0.841; 88.8% |
| `cerebellar_functions.accept` on the template (`data/mni152/cerebellar-registration.json`) | Mean lobule Dice ≥ 0.6; cortex covered ≥ 95%; side agreement ≥ 97% | 0.763; 95.09%; 99.4% |
| `arterial_territories.accept` on the template (`data/mni152/arterial-registration.json`) | Ventricle Dice ≥ 0.6 each side; cerebellar cortex in cerebellar territories ≥ 95%; cerebral tissue unassigned ≤ 2%; hemisphere agreement ≥ 0.98 | 0.679, 0.705; 98.3%; 1.1%; 0.997 |
| `coordinate_spaces.accept` on the template, SPM12 (`data/mni152/coordinate-registration.json`) | As on CDMD: each subcortical Dice ≥ 0.70, median ≥ 0.80; cortex ≥ 0.65; hemispheres ≥ 0.98; round trip ≤ 0.5 mm median, ≤ 1.0 mm p95; grid error ≤ 0.1 mm p95 | 0.752, 0.856; 0.752; 0.999; 0.03, 0.10 mm; 0.004 mm |
| `stroke_cases.accept` on the template (not published) | As on CDMD: each subcortical Dice ≥ 0.70 | left pallidum 0.645: fails |
| `arousal_nuclei.failures` on the template (`data/mni152/arousal-registration.json`) | As on CDMD: three centroids ≤ 3 mm from NextBrain's; each nucleus ≥ 95% inside Brain-Stem and VentralDC, the periaqueductal grey ≥ 90% | SynthMorph 4.91 mm, 87.9%: fails; SegmentAAN 1.56 mm, 90.9%, others ≥ 98.7%: published |
| `brain_model.validate --anatomy mni152` | The checks CDMD passes; a teaching unit lies < 50% inside other sources unless declared at its measured share | passes, with two declared units: fornix 0.582, medial septal 0.574 |

Two of the template's teaching units lie mostly inside another source's structures: the fornix (58.2%, of which 56.2% in aseg's corpus callosum) and the medial septal unit (57.4%: 42.2% in the corpus callosum, 15.2% in the lateral ventricles). On CDMD the same units lie 16.5% and 15.8% inside other sources, and every other unit of the template lies at most 13.9% inside. The three middle segments of aseg's corpus callosum are 35–86% larger on the template than on CDMD (central segment 872 mm³ against 469 mm³), although the template is drawn at 0.90 of its size. `config/model.yaml` declares the two units with these shares (`learning.cross_source_overlap`). `check_overlaps` refuses an undeclared unit at or over 50%, a declared unit whose measured share differs from the declared one at three decimals or has fallen under 50%, and a declared name that is no drawn unit. With the two declared, every check runs and `validation.json` is published for the template.

## Limitations

The template is an average of 152 young adults, not a person. Its folds are smoothed and its small structures blurred; on its MRI the cortical ribbon is fainter than on a single scan. The 0.9 scale matches brain volume only. Shape and proportions are the template's.

FreeSurfer and NextBrain were built to segment one person's scan. On the template's blurred contrast their labels were not checked against any reference, and NextBrain's atlas prior places more of its boundaries. The validator's failed check above is one sign of this.

CerebNet was also built for one person's scan. In the template's cerebellar hemispheres its lobule borders do not follow fissures that can be seen, and they were checked only against aseg's outline and SUIT's group lobules. Left lobule X agrees least with SUIT (Dice 0.590).

The template was reconstructed with FreeSurfer's Linux build on a cluster, not the pinned macOS install CDMD's checks name. Its arousal nuclei were segmented with the macOS build, because no Linux build of FreeSurfer 8.2 includes SegmentAAN's program.

At the template's midline, aseg's corpus callosum is drawn over most of the fornix and of the medial septal unit. Averaging blurs the border between the callosum's body and the fornix beneath it, and which source is wrong there was not established. The three solids are drawn as their sources give them.

Only maps and coordinates in MNI152NLin2009cAsym are placed on the template. A map in another template, such as FSL's MNI152NLin6Asym, is read as MNI152NLin2009cAsym if opened as an unstated MNI map; on CDMD the two readings land a median 1.56 mm apart at the cortex.

The accuracy figures on the other pages were measured on CDMD. On the template only the checks in the validation table above have been measured. The functional cerebellar atlas covers 95.09% of the template's cerebellar cortex, 0.09 percentage points above its 95% limit; the rest carries no functional region.

The template's tracts are an average over 1,065 other people, not tracked in this brain ([tracts](tracts.md#limitations)).

## Code availability

Code
: [`scripts/reconstruct_subject.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/reconstruct_subject.py), [`scripts/prepare_subject.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/prepare_subject.py), [`scripts/segment_nextbrain.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/segment_nextbrain.py), [`scripts/segment_cerebellum.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/segment_cerebellum.py), [`scripts/register_striatal_networks.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/register_striatal_networks.py), [`scripts/register_cerebellar_functions.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/register_cerebellar_functions.py), [`scripts/register_arterial_territories.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/register_arterial_territories.py), [`scripts/register_coordinate_spaces.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/register_coordinate_spaces.py), [`scripts/register_arousal_nuclei.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/register_arousal_nuclei.py), [`brain_model/layers/coordinate_spaces.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/coordinate_spaces.py) (`native_space`), [`scripts/prepare_diffusion_mni152.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/prepare_diffusion_mni152.py); [`web/src/lib/core/coordinates/spaces.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/coordinates/spaces.ts) (`placeNative`), [`web/src/lib/core/user-map/inverse-field.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/user-map/inverse-field.ts) (`nativeInverse`), [`web/src/lib/core/i18n/areas/template.ts`](https://github.com/JoshuaDuq/planumatlas/blob/main/web/src/lib/core/i18n/areas/template.ts)

Configuration
: `anatomies.mni152` and `tract_catalogs` in [`config/model.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/model.yaml); [`data/diffusion-mni152.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/diffusion-mni152.yaml); [`public/models/anatomies.json`](https://github.com/JoshuaDuq/planumatlas/blob/main/public/models/anatomies.json)

Tests
: `tests/test_coordinate_spaces.py`, `tests/test_prepare_diffusion_mni152.py`; `web/src/lib/core/coordinates/spaces.test.ts`, `web/src/lib/core/user-map/{inverse-field,carry}.test.ts`, `web/src/lib/core/learning/catalog.test.ts`, `web/src/lib/core/clinical/data.test.ts`

```bash
# recon-all ran on Rorqual with FreeSurfer 8.2's Linux build (--freesurfer, --threads)
uv run python scripts/reconstruct_subject.py --anatomy mni152
uv run python scripts/prepare_subject.py --anatomy mni152
uv run python scripts/segment_nextbrain.py --anatomy mni152
uv run python scripts/segment_cerebellum.py --anatomy mni152 --record
# the registrations ran on Rorqual with FreeSurfer 8.2's Linux build (--freesurfer, --threads 8)
uv run python scripts/register_striatal_networks.py --anatomy mni152 --record
uv run python scripts/register_cerebellar_functions.py --anatomy mni152 --record
uv run python scripts/register_arterial_territories.py --anatomy mni152 --record
uv run python scripts/register_coordinate_spaces.py --anatomy mni152 --record
uv run python scripts/register_arousal_nuclei.py synthmorph --anatomy mni152
# SegmentAAN ran here with the macOS build and the MATLAB Runtime R2019b (--freesurfer)
uv run python scripts/register_arousal_nuclei.py segment-aan --anatomy mni152
uv run python scripts/register_arousal_nuclei.py publish --anatomy mni152 --record
uv run python -m brain_model.build --anatomy mni152
uv run python scripts/prepare_diffusion_mni152.py
uv run python scripts/prepare_diffusion_space.py --anatomy mni152
uv run python scripts/prepare_diffusion_outline.py --anatomy mni152
uv run python -m brain_model.validate --anatomy mni152
uv run pytest tests/test_coordinate_spaces.py tests/test_prepare_diffusion_mni152.py
npm test --prefix web -- coordinates user-map learning clinical
```

