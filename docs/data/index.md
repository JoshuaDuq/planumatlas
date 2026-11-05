# Data and layers

Every layer shares one spatial frame: FreeSurfer surface RAS of the subject ([Architecture](../pipeline/architecture.md#coordinate-frames)). Counts are for CDMD; each anatomy's `manifest.json` is authoritative. Each layer's page under [Features](../features/index.md) gives its processing steps.

## Anatomies

An anatomy is a set of assets declared in [`config/model.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/model.yaml). The viewer lists published anatomies in `public/models/anatomies.json`.

| ID | Source | Availability |
| :--- | :--- | :--- |
| `cdmd` | MGH CDMD `sub_013`, reconstructed from its T1 with FreeSurfer 8.2 | Published default |
| `fsaverage` | FreeSurfer group template | Local builds only |

CDMD's source T1 was defaced before release: facial features were obscured, while the brain was not altered. Its tracts come from the same subject's diffusion scan. Its teaching set includes CerebNet cerebellar lobules and its own cervical cord, with PAM50's tracts and grey matter registered to it; see [Spinal cord](../features/spinal-cord.md). The individual anatomy is not normative, and segmentations are estimates; see [Validation and limits](../pipeline/validation.md).

`fsaverage` is a template, not an individual. Its NextBrain source has no stated licence and is not published. See [References and licensing](../reference/references.md) for data terms.

## Layers

| Layer | Granularity | Source | Route to the subject | Page |
| :--- | :--- | :--- | :--- | :--- |
| Destrieux (`aparc.a2009s`) | 148 parcels | Subject `.annot` | Native; no projection | [Cortical atlases](../features/cortical-atlases.md) |
| HCP-MMP1.0 | 360 areas | `fs_LR` → `fsaverage` | Nearest vertex on registered spheres | [Cortical atlases](../features/cortical-atlases.md) |
| Julich-Brain 3.1 | 278 areas | Colin27 → `fsaverage` | Nearest vertex on registered spheres | [Cortical atlases](../features/cortical-atlases.md) |
| Schaefer 2018 | 400 parcels | `fsaverage` (1,489 participants) | Nearest vertex on registered spheres | [Cortical atlases](../features/cortical-atlases.md) |
| Teaching set | 106 solids | NextBrain, aseg and CerebNet unions | Bounded smoothing | [Internal anatomy](../features/internal-anatomy.md) |
| FreeSurfer aseg | 32 structures | `aseg.mgz` | Marching cubes, bounded smoothing | [Internal anatomy](../features/internal-anatomy.md) |
| NextBrain | 514 labels, 292 meshed | Subject segmentation at 0.4 mm | Native | [Internal anatomy](../features/internal-anatomy.md) |
| Gyral white matter | 68 parcels | `wmparc.mgz` | Native; cut faces only | [Internal anatomy](../features/internal-anatomy.md) |
| Spinal cord | 34 regions | PAM50 (Spinal Cord Toolbox) | Registered to this brain's segmented cord | [Spinal cord](../features/spinal-cord.md) |
| Yeo 7 | 7 networks | Schaefer 2018 on `fsaverage` | Per vertex, registered spheres | [Functional networks](../features/functional-networks.md) |
| CAB-NP | 12 networks | Ji et al. 2019 | One network per HCP-MMP area | [Functional networks](../features/functional-networks.md) |
| Functional divisions | 22 sections, 21 named regions | Glasser 2016; Rolls 2022, 2023 | Per HCP-MMP area | [Functional divisions](../features/functional-divisions.md) |
| Neuropsychological functions | 70 functions | Neurosynth 7 | Per HCP-MMP area and aseg structure | [Functions](../features/functions.md) |
| Receptor fingerprints | 36 fingerprints, 94 regions | Zilles and Palomero-Gallagher, EBRAINS | By the name of the area or structure measured | [Receptor fingerprints](../features/receptor-fingerprints.md) |
| Arterial territories | 15 branches per hemisphere | Liu et al. 2023 (1,298 stroke patients) | Template registered with SynthMorph; nearest neighbour | [Arterial territories](../features/arterial-territories.md) |
| Functional cerebellar regions | 16 regions per hemisphere, 4 domains | Nettekoven et al. 2024 (seven task fMRI datasets) | SUIT template registered with SynthMorph; kept to the cerebellar cortex | [Cerebellar functions](../features/cerebellar-functions.md) |
| Striatal networks | 7 networks per hemisphere | Choi et al. 2012 (1,000 adults, resting state) | MNI152 template registered with SynthMorph; kept to the striatum | [Striatal networks](../features/striatal-networks.md) |
| Diffusion tracts | 30 bundles | The subject's own diffusion scan (DIPY, TractSeg) | Native to the subject's T1 | [Tracts](../features/tracts.md) |

## Reading the layers

- **Group atlases are estimates here.** HCP-MMP, Julich-Brain, Schaefer, Yeo, CAB-NP, the cerebellar and striatal atlases and the arterial territories describe groups. They reach this brain through registration; they are not its measured function or anatomy.
- **Layers keep their licences.** Per-area layers are published as separate files so each stays under its own terms; see [References and licensing](../reference/references.md#licences).
- **Source files are checksummed.** The pipeline reads every source through `brain_model.sources`, which checks its SHA-256 against [`data/sources.json`](https://github.com/JoshuaDuq/planumatlas/blob/main/data/sources.json) first.
