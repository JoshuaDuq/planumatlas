# Receptor fingerprints

Densities of up to 17 neurotransmitter receptors, measured by autoradiography in post-mortem brains and shown in the region detail of the areas and structures they were measured in.

:::{list-table}
:widths: 22 78
:stub-columns: 1

* - Where in the viewer
  - The **Receptor densities** disclosure of the region detail for a region that has a fingerprint (30 Julich-Brain areas, putamen, globus pallidus, mediodorsal and anterior thalamic nuclei); a Dorsal | Ventral choice for Area 44 and hOc2.
* - Built by
  - [`scripts/fetch_receptor_fingerprints.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/scripts/fetch_receptor_fingerprints.py) (fetch), [`brain_model/layers/receptor_fingerprints.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/layers/receptor_fingerprints.py) (assignment by name, export, validation), called from [`brain_model/build.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/brain_model/build.py)
* - Configuration
  - [`config/receptor-fingerprints.yaml`](https://github.com/JoshuaDuq/planumatlas/blob/main/config/receptor-fingerprints.yaml)
* - Source data
  - 36 receptor datasets of Zilles and Palomero-Gallagher on EBRAINS (human receptors, bucket `p22717-hbp-d000045_receptors-human-<key>_pub`, `v1.0`); CC BY-NC-SA 4.0
* - Checked by
  - [`tests/test_receptor_fingerprints.py`](https://github.com/JoshuaDuq/planumatlas/blob/main/tests/test_receptor_fingerprints.py); the fetch's own checks; `receptor_fingerprints.validate` in the [validator](../pipeline/validation.md); `web/src/lib/core/learning/references.test.ts` for the DOIs and PMIDs
:::

## What it does

Densities of up to 17 neurotransmitter receptors, measured by quantitative in vitro autoradiography in two to six post-mortem brains (Zilles et al. 2015; Palomero-Gallagher and Zilles 2018) and published per area on EBRAINS. A fingerprint reaches a region only through the name of what it was measured in: 30 Julich-Brain areas (Area 44 and hOc2 in a dorsal and a ventral part), and the putamen, globus pallidus, mediodorsal and anterior thalamic nuclei on their aseg, NextBrain and teaching-set structures. Both hemispheres show the same pooled values.

Nothing is measured in the brain shown. The layer is carried per region, never per vertex or voxel.

## Data

**Sources.** The datasets are documented by Zilles et al. (2015), Cortex 63:79–89 ([doi:10.1016/j.cortex.2014.07.007](https://doi.org/10.1016/j.cortex.2014.07.007), PMID 25243991) and Palomero-Gallagher and Zilles (2018), Handb Clin Neurol 150:355–387 ([doi:10.1016/B978-0-444-63639-3.00024-4](https://doi.org/10.1016/B978-0-444-63639-3.00024-4), PMID 29496153); each dataset has its own EBRAINS DOI (`https://doi.org/10.25493/...`) in the YAML. Unit: fmol/mg. Licence: CC BY-NC-SA 4.0.

**Files.** For each of the 36 datasets, three files at `https://data-proxy.ebrains.eu/api/v1/buckets/p22717-hbp-d000045_receptors-human-<key>_pub/<file>?redirect=true`, each pinned by sha256 in the YAML:

- the fingerprint, `v1.0/<key>_fp_<date>.tsv` (columns `density (mean)`, `density (sd)`, `density (unit)`);
- `v1.0/subjects.tsv` (`subject (ID)`, `sex`, `age (value)`, `age (unit)`);
- `v1.0/tissue-samples.tsv` (`tissue sample (ID)`, `hemisphere`, `from subject (ID)`, `pathology`; some datasets use `tissue-samples_all.csv`, and the IFS and IFJ sets keep their files in a `v1.0/<key>_fp/` subfolder, as `subjects_all.csv` and `tissue-samples_all.csv`).

The files are cached in `data/cache/receptor-fingerprints/<key>/` and read into `data/receptor-fingerprints.json`.

**Datasets and where they go.** `measured_in` is the dataset's own name for what was sampled; `targets` name regions by atlas and source name (an aseg name is matched with its `Left-` or `Right-` prefix).

| Group | Datasets (keys) | Target regions |
| :--- | :--- | :--- |
| Julich-Brain areas, Zilles et al. 2015 | 3b, 44d and 44v, 45, 4p, 7A, FG1, FG2, PF, PFcm, PFm, PFop, PFt, PGa, PGp, TE1_0, TE2_1, hOc1 | `Area 3b (PostCG)`, `Area 44 (IFG)` (dorsal and ventral parts), `Area 45 (IFG)`, `Area 4p (PreCG)`, `Area 7A (SPL)`, `Area FG1 (FusG)`, `Area FG2 (FusG)`, `Area PF (IPL)`, `Area PFcm (IPL)`, `Area PFm (IPL)`, `Area PFop (IPL)`, `Area PFt (IPL)`, `Area PGa (IPL)`, `Area PGp (IPL)`, `Area Te 1.0 (HESCHL)`, `Area Te 2.1 (STG)`, `Area hOc1 (V1, 17, CalcS)` |
| Julich-Brain areas, visual and hippocampal | hOc2d and hOc2v, hOc3d, hOc3v, CA1, CA2, CA3, DG | `Area hOc2 (V2, 18)` (dorsal and ventral parts), `Area hOc3d (Cuneus)`, `Area hOc3v (LingG)`, `CA1 (Hippocampus)`, `CA2 (Hippocampus)`, `CA3 (Hippocampus)`, `DG (Hippocampus)` |
| Julich-Brain areas, Palomero-Gallagher and Zilles 2018 | ifs1 to ifs4, ifj1, ifj2 | `Area IFS1 (IFS)` to `Area IFS4 (IFS)`, `Area IFJ1 (IFS, PreCS)`, `Area IFJ2 (IFS, PreCS)` |
| Putamen | Pu | aseg `Putamen`; NextBrain `putamen` and `posteroventral_putamen`; the teaching set's `Putamen` |
| Globus pallidus | GP | aseg `Pallidum`; NextBrain's external and internal segments of the globus pallidus; the teaching set's external and internal Globus pallidus |
| Mediodorsal thalamic nucleus | ThMD | NextBrain's five divisions of MD (magnocellular, central part of the medial division, parvocellular, densocellular and multiform) |
| Anterior thalamic nucleus | ThA | NextBrain's anteroventral, anteromedial and anterodorsal nuclei of thalamus |

On CDMD the 36 datasets reach 94 regions: 60 Julich-Brain (30 areas in two hemispheres), 24 NextBrain, 6 teaching-set and 4 aseg. The Julich-Brain areas are the cortical atlas described in [Cortical atlases](cortical-atlases.md).

**Receptors.** 17 in all, in display order: glutamate (AMPA, kainate, NMDA, mGluR2/3), GABA (GABA<sub>A</sub>, GABA<sub>B</sub>, GABA<sub>A</sub>/BZ), acetylcholine (M<sub>1</sub>, M<sub>2</sub>, M<sub>3</sub>, α<sub>4</sub>β<sub>2</sub>), noradrenaline (α<sub>1</sub>, α<sub>2</sub>), serotonin (5-HT<sub>1A</sub>, 5-HT<sub>2</sub>), dopamine (D<sub>1</sub>) and adenosine (A<sub>1</sub>). A fingerprint measures 14 to 17 of them. `aliases` in the YAML list the other spellings the published files use (for example `mGluR2_3` and `mGlu2/3` for mGluR2/3).

**Donors.** Two to six post-mortem brains per fingerprint (donor IDs AR01 to AR07, from one pool), aged 61 to 79 years across all datasets, with the hemispheres sampled counted per dataset. The viewer shows each fingerprint's samples, donors and age range.

## How it was built

### 1. Fetch and read

`scripts/fetch_receptor_fingerprints.py` reads `config/receptor-fingerprints.yaml` (`read_definition` checks it first) and, for each dataset:

1. downloads the three files and refuses a checksum mismatch (the download is renamed into the cache only once complete);
2. reads each table, tolerating the IFS and IFJ sets, which quote some lines whole and separate others by spaces (`rows`), and fails if the expected columns are absent or a row has the wrong number of columns;
3. maps every receptor label to its id through the YAML's spellings, and fails on an unknown receptor, a unit other than fmol/mg, or a receptor listed twice. A blank SD is stored as no SD (`null`), not as zero;
4. reads the donors (ID, sex, age in years; fails on any age unit but years) and the samples (ID, hemisphere, donor), and fails if a sample is listed twice, a sample names no hemisphere, or the samples and subjects name different donors;
5. applies the withheld values (below).

It writes `data/receptor-fingerprints.json` (unit, and for each dataset its receptors' mean and SD, donors and samples), prints the dataset count, and with `--record` adds the file to `data/sources.json` with each origin's URL and sha256, the procedure, the citations and the licence. The definition's own checks (`read_definition`) refuse duplicate dataset keys, unknown keys in a dataset (a value cut at a comma in a flow mapping), a non-DOI, a dataset with no target, an unknown source, a part other than dorsal or ventral, duplicate receptor spellings, and two fingerprints on one region unless they are distinct parts.

### 2. Withheld values

A published value known to be wrong is withheld, with the evidence, and the fetch fails if the file no longer holds the same value, so the exception cannot outlive the error. Only an SD can be withheld. The one withheld value is Area ifs1's D1 SD, published as 863 fmol/mg: it equals the same file's A1 mean (863), while D1's SD is 27 to 44 fmol/mg in the five neighbouring IFS and IFJ areas measured in the same brains. It is stored as no SD and the viewer shows the reason (English and French). Separately, five parietal areas (PF, PFcm, PFop, PGa, PGp) publish no α<sub>2</sub> SD, and none is shown.

### 3. Assign by name

`receptor_fingerprints.assign` (run by the build over the anatomy's regions) looks up, for every target of every dataset and for each hemisphere, the single region of that atlas and hemisphere whose `source_name` equals the target name (with `Left-` or `Right-` added for aseg). It fails unless exactly one region is found, so a renamed area breaks the build rather than losing its fingerprint; an atlas the anatomy does not publish is skipped. Where an area was sampled in two parts (Area 44 and hOc2), the region takes both datasets, one per part. A structure the dataset names as a whole, such as the globus pallidus or the anterior thalamic nucleus, gives the same values to each of its subdivisions. Areas 9, 46 and 47 are also published but name no Julich-Brain area, so they are left out rather than placed in one.

### 4. Export

`export` writes `receptor-fingerprints.json` to the model directory: the unit, sources, transmitters and receptors (with display symbols, English and French names), the withheld values with reasons, each dataset's key, what it was measured in, part, DOI, citing sources, receptors, donors and per-hemisphere sample counts, and the region id to dataset keys assignment. It returns the manifest's `receptor_fingerprints` metadata (id, file, label, unit, licence, DOIs and method). `limitations` adds the statements below to the manifest.

## How the viewer uses it

- `web/src/lib/core/catalog/receptor-fingerprints.ts` validates the file against the regions it names (every DOI is a doi.org link, every mean positive, every SD absent or non-negative, withheld values have no SD and a reason, a region takes one fingerprint or exactly one dorsal and one ventral) and prepares the display.
- `web/src/features/inspector/ReceptorSection.svelte` shows a disclosure that stays mounted between selections. Rows are grouped by transmitter in the YAML's order; each row is the receptor's symbol, a bar and the mean ± SD. A region with two parts offers them as a Dorsal | Ventral choice.
- **Bars.** Each bar is the share of that receptor's highest mean among the 36 published fingerprints (`highestMeans`), so a cortical D1 bar is short beside the putamen's.
- **Notes.** Receptors the fingerprint did not measure are listed; receptors with no published SD are named; a withheld value is named with its published value and the reason. The note states the unit, the number of hemispheres sampled, the donors, their age range and the number of datasets, then what the fingerprint was measured in, and links the EBRAINS dataset and its sources.
- `web/src/lib/core/panels/provenance.ts` lists the layer's label, licence and citations in the provenance panel.

## Checks

`receptor_fingerprints.validate`, called by `brain_model.validate` with the other per-area layers (see the [validator](../pipeline/validation.md)), fails unless the manifest's metadata equals the rebuilt metadata and the published file equals the one rebuilt from `data/receptor-fingerprints.json` and the manifest's regions. It reports the number of datasets (36), the regions with a fingerprint (94 on CDMD) and any dataset reaching no region.

The tests check that every dataset reaches its regions in both hemispheres of CDMD with identical values on both sides (30 Julich-Brain areas, including Area 44, IFS1, CA1 and hOc3v); that an area sampled in parts takes both and aseg names carry their side; that an atlas the anatomy does not publish is skipped but a missing name fails; that two fingerprints on one region must be distinct parts; that the published fingerprints hold the EBRAINS values (for example 44v NMDA 1129 ± 382 and D1 69 ± 32; PF α<sub>2</sub> 837 with no SD; ifs1 D1 mean 78 with its SD withheld and A1 863 ± 435; the putamen's donors AR04 and AR05); that a withheld value fails the fetch once the source changes; that another unit or an unknown receptor is refused; that quoted and space-separated IFS lines read as their columns; that only an SD can be withheld; that a blank SD in a tab row is no SD and a repeated sample is refused; and that a value cut at a comma is refused rather than published.

## Limits

- Two to six brains, aged 61 to 79, and not this brain; densities are pooled over the sampled hemispheres, so both hemispheres show the same values.
- A fingerprint reaches a region only through the name of the area or structure measured. Areas 9, 46 and 47 are published but name no Julich-Brain area and are left out.
- A structure a dataset names as a whole gives the same values to each of its subdivisions.
- Ifs1's D1 SD is withheld, and five parietal areas publish no α<sub>2</sub> SD.
- Densities are in fmol/mg; bars compare a receptor across areas, not receptors with each other.
- Licensed CC BY-NC-SA 4.0: non-commercial, shared alike.

### Alternatives considered

Per-area probability maps on the cortical surface were rejected after measurement (EBRAINS survey, 2026-10-28). EBRAINS publishes the maps only as MNI152 and Colin27 volumes, and siibra has only the labelled `fsaverage` map. In a pilot (left hemisphere, RF-ANTs registration, Wu et al. 2018) the projected probability maps' argmax matched the published `fsaverage` maximum-probability map on 60.4% (MNI152) and 51.6% (Colin27) of vertices, with a median per-area Dice of 0.47. As a control, in the volume the argmax equalled the volumetric maximum-probability map on 90.7%, but that map carried by the same warp matched the published `fsaverage` map on only 48.8%, so EBRAINS's surface transfer is not registration fusion and projected probability maps would contradict the shipped parcellation. The probability maps are also smoothed with a 3 mm FWHM Gaussian, so their gradients are not purely inter-subject variability. Fingerprints are therefore carried by name only. BigBrain layer-wise cell densities (one brain) and the siibra connectivity matrices (Julich 2.9) were judged of low value, and the Julich deep-brain volumes are almost all already segmented on CDMD by NextBrain.

## Reproduce

```bash
# downloads the 108 pinned files into data/cache/receptor-fingerprints/ and writes data/receptor-fingerprints.json
uv run python scripts/fetch_receptor_fingerprints.py --record
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run pytest tests/test_receptor_fingerprints.py
```

## See also

- [Cortical atlases](cortical-atlases.md), for the Julich-Brain areas
- [Internal anatomy](internal-anatomy.md), for the NextBrain and teaching-set structures
- [References](../reference/references.md) (Zilles et al. 2015; Palomero-Gallagher and Zilles 2018) and the [building guide](../pipeline/building.md)
