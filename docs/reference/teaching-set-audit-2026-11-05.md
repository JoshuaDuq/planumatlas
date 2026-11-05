# Teaching-set source and coverage audit — 2026-11-05

## Purpose and decisions

Review the explicit teaching unions against the frozen NextBrain lookup table, the existing aseg/CerebNet definitions, and the published source metadata. The first improvement is source fidelity and understandable coverage. The set remains 106 solids in eight systems. The audit does not establish histological ground truth in this individual.

### Corrected omissions

| Teaching unit | Restored base label | Exact source name | CDMD source voxels, left / right |
| --- | --- | --- | --- |
| Hypothalamus, excluding mammillary nuclei | 160 | `suprachiasmatic_nucleus` | 3 / 3 |
| Hippocampal formation | 569 | `stratum_oriens_of_caudal_ca2` | 4 / 3 |
| Thalamus | 512 | `suprageniculate_nucleus_of_thalamus` | 9 / 0 |

These source labels were unassigned to any teaching unit. Their names identify parts of existing unions, so they are restored to those unions rather than published as additional tiny solids. Right labels use the existing +10000 offset. An absent right suprageniculate label contributes no geometry or volume. Source voxels are approximately 0.064 mm³ each; these small additions do not imply that the 1 mm acquisition resolves these nuclei or layers.

No underlying segmentation, affine, smoothing bound, colour, system assignment or stable region ID changes. The thalamus now has 53 configured constituent labels; the hippocampal formation has 52. The actual constituent list contains only labels present on that side of this brain.

### More precise teaching text

Thirty configured units gain bilingual coverage notes through the existing inspector hint. They distinguish:

- a whole labelled structure from a partial label (accumbens core, dorsal medial geniculate nucleus, inferior colliculus central nucleus);
- a union from its constituents (substantia nigra compacta/reticulata, globose/emboliform nuclei, hippocampal formation including alveus, amygdala with transition areas);
- labelled tissue from individual fibre trajectories (fornix, optic chiasm, corpus callosum);
- a broad territory from a specific tract or crossing (midbrain, pons, medulla and the source-defined caudal medulla);
- anterior vermis incorporated into hemispheric CerebNet labels from the separately displayed posterior vermis;
- a ventricular fluid space from neural tissue.

The septal unit is named **Medial septal nucleus and diagonal band**, matching labels 103 and 111 without implying all septal nuclei. The basal forebrain union explicitly names the **basal nucleus of Meynert**, matching label 108 alongside substantia innominata (128). Existing IDs remain usable.

The medial geniculate qualification is deliberately about the teaching unit's label 504. It does not claim that the entire source atlas contains no other geniculate-related label.

## Evidence

1. `data/nextbrain-cdmd/nextbrain-lut.txt`: frozen names and IDs used by this subject's segmentation. This is the direct evidence for constituent membership; the displayed voxel counts were read from the published NextBrain records.
2. `config/learning-anatomy.yaml`: explicit teaching membership; `brain_model/labels/cerebellum.py` and `data/FreeSurferColorLUT.txt`: source conventions already used by the build.
3. [FreeSurfer's official NextBrain instructions](https://surfer.nmr.mgh.harvard.edu/fswiki/HistoAtlasSegmentation): segmentation outputs include the LUT; the default 0.4 mm output spacing reduces aliasing. It is not the acquired resolution.
4. [Casamitjana et al., 2025, *A probabilistic histological atlas of the human brain for MRI segmentation*](https://doi.org/10.1038/s41586-025-09708-2): establishes the probabilistic histological atlas and its MRI segmentation method. Whole-region agreement does not validate each subregion.
5. [NiBabel image documentation](https://nipy.org/nibabel/nibabel_images.html): image data, affine and metadata conventions checked before using the existing build and validation routines.

## Deliberate limits

An unassigned atlas label is not automatically an omission from an existing unit. No internal capsule subdivision, new thalamic functional territory, complete brainstem nucleus inventory, or inferred fibre route is introduced. Additional structures and an essentials/expanded presentation need a separate pedagogical selection, supported by their actual source coverage. The existing detailed NextBrain view remains available for finer exploration.

## Verification

Regression tests check the three recovered label names and unique membership, bilingual note validation, and note preservation during left/right expansion and region export. Browser tests check English/French notes and selection changes. The standard model build and scientific validation check source membership, voxel-derived volumes, mesh metadata, smoothing displacement and voxel-centre classification. The resulting manifest is compared with the pre-change manifest to bound numerical changes to the corrected unions and their derived compositions.

The rebuilt model retains all 2,040 region IDs and 106 teaching solids. Thirty note-bearing definitions expand to 51 displayed structures. A record-by-record comparison finds numerical changes only in left thalamus, both hypothalami and both hippocampal formations: respectively +9, +3/+3 and +4/+3 source voxels. Other region records change only in the new notes or the two clarified bilingual names. Derived arterial shares for those five units are recomputed. The existing whole-region stimulation-label inheritance also reaches the newly included thalamic/hippocampal constituents; this adds no nucleus-specific stimulation measurement. The segmentation comparison's constituent lists are refreshed.

The full CDMD validation passed after rebuilding. All 106 teaching surfaces have zero misclassified source voxel centres; their maximum measured displacement is 0.600000698 mm, within the 0.6 mm bound plus the existing export-coordinate tolerance. Source volumes remain unchanged. The production viewer build and all 78 inspector browser tests passed, including both translations and removal of stale notes when changing selection. These checks establish conversion fidelity, not independently measured anatomical or clinical accuracy.
