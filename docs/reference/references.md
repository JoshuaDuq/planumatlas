# References and licensing

## Bibliography

Every paper here, and in the clinical and circuit data, is checked by its PMID and DOI against the PubMed, Bookshelf and Crossref records that `scripts/fetch_references.py` writes to `data/reference-records.json`; dataset DOIs are not. Years are PubMed's journal-issue year.

### Cortical and subcortical atlases

- **Destrieux cortical parcellation (`aparc.a2009s`).**
  Destrieux, C., Fischl, B., Dale, A., & Halgren, E. (2010). Automatic parcellation of human cortical gyri and sulci using standard anatomical nomenclature. *NeuroImage*, 53(1), 1–15. [doi:10.1016/j.neuroimage.2010.06.010](https://doi.org/10.1016/j.neuroimage.2010.06.010). PMID 20547229.
- **Desikan-Killiany cortical parcellation (`aparc`).**
  Desikan, R. S., Ségonne, F., Fischl, B., Quinn, B. T., Dickerson, B. C., Blacker, D., … Albert, M. S., & Killiany, R. J. (2006). An automated labeling system for subdividing the human cerebral cortex on MRI scans into gyral based regions of interest. *NeuroImage*, 31(3), 968–980. [doi:10.1016/j.neuroimage.2006.01.021](https://doi.org/10.1016/j.neuroimage.2006.01.021). PMID 16530430.
- **HCP-MMP1.0 multimodal cortical parcellation.**
  Glasser, M. F., Coalson, T. S., Robinson, E. C., Hacker, C. D., Harwell, J., Yacoub, E., Ugurbil, K., Andersson, J., Beckmann, C. F., Jenkinson, M., Smith, S. M., & Van Essen, D. C. (2016). A multi-modal parcellation of human cerebral cortex. *Nature*, 536(7615), 171–178. [doi:10.1038/nature18933](https://doi.org/10.1038/nature18933). PMID 27437579.
- **Yeo 7 resting-state functional networks.**
  Yeo, B. T. T., Krienen, F. M., Sepulcre, J., Sabuncu, M. R., Lashkari, D., Hollinshead, M., Roffman, J. L., Smoller, J. W., Zöllei, L., Polimeni, J. R., Fischl, B., Liu, H., & Buckner, R. L. (2011). The organization of the human cerebral cortex estimated by intrinsic functional connectivity. *Journal of Neurophysiology*, 106(3), 1125–1165. [doi:10.1152/jn.00338.2011](https://doi.org/10.1152/jn.00338.2011). PMID 21653723.
- **Striatal networks.**
  Choi, E. Y., Yeo, B. T. T., & Buckner, R. L. (2012). The organization of the human striatum estimated by intrinsic functional connectivity. *Journal of Neurophysiology*, 108(8), 2242–2263. [doi:10.1152/jn.00270.2012](https://doi.org/10.1152/jn.00270.2012). PMID 22832566. The 7-network loose-mask volume FreeSurfer 8.2 ships in `average/Choi_JNeurophysiol12_MNI152`.
- **Cole-Anticevic Brain-wide Network Partition (CAB-NP).**
  Ji, J. L., Spronk, M., Kulkarni, K., Repovš, G., Anticevic, A., & Cole, M. W. (2019). Mapping the human brain's cortical-subcortical functional network organization. *NeuroImage*, 185, 35–57. [doi:10.1016/j.neuroimage.2018.10.006](https://doi.org/10.1016/j.neuroimage.2018.10.006). PMID 30291974. Label key v1.1.6 from [ColeLab/ColeAnticevicNetPartition](https://github.com/ColeLab/ColeAnticevicNetPartition) at commit `e4ea9fd`.
- **Orbitofrontal, ventromedial prefrontal and anterior cingulate groupings of HCP-MMP areas.**
  Rolls, E. T., Deco, G., Huang, C.-C., & Feng, J. (2022). The human orbitofrontal cortex, vmPFC, and anterior cingulate cortex effective connectome: emotion, memory, and action. *Cerebral Cortex*, 33(2), 330–356. [doi:10.1093/cercor/bhac070](https://doi.org/10.1093/cercor/bhac070). PMID 35233615.
- **Posterior and midcingulate groupings of HCP-MMP areas.**
  Rolls, E. T., Wirth, S., Deco, G., Huang, C.-C., & Feng, J. (2023). The human posterior cingulate, retrosplenial, and medial parietal cortex effective connectome, and implications for memory and navigation. *Human Brain Mapping*, 44(2), 629–655. [doi:10.1002/hbm.26089](https://doi.org/10.1002/hbm.26089). PMID 36178249.
- **Neurosynth meta-analytic database (neuropsychological domains).**
  Yarkoni, T., Poldrack, R. A., Nichols, T. E., Van Essen, D. C., & Wager, T. D. (2011). Large-scale automated synthesis of human functional neuroimaging data. *Nature Methods*, 8(8), 665–670. [doi:10.1038/nmeth.1635](https://doi.org/10.1038/nmeth.1635). PMID 21706013. Database version 7, with consistency maps computed by NiMARE 0.22.1.
- **Schaefer multi-scale parcellation.**
  Schaefer, A., Kong, R., Gordon, E. M., Laumann, T. O., Zuo, X. N., Holmes, A. J., Eickhoff, S. B., & Yeo, B. T. T. (2018). Local-global parcellation of the human cerebral cortex from intrinsic functional connectivity MRI. *Cerebral Cortex*, 28(9), 3095–3114. [doi:10.1093/cercor/bhx179](https://doi.org/10.1093/cercor/bhx179). PMID 28981612.
- **FreeSurfer automated segmentation (`aseg`, `wmparc`).**
  Fischl, B., Salat, D. H., Busa, E., Albert, M., Dieterich, M., Haselgrove, C., van der Kouwe, A., Killiany, R., Kennedy, D., Klaveness, S., Montillo, A., Makris, N., Rosen, B., & Dale, A. M. (2002). Whole brain segmentation: automated labeling of neuroanatomical structures in the human brain. *Neuron*, 33(3), 341–355. [doi:10.1016/S0896-6273(02)00569-X](https://doi.org/10.1016/S0896-6273(02)00569-X). PMID 11832223.

  Fischl, B., van der Kouwe, A., Destrieux, C., Halgren, E., Ségonne, F., Salat, D. H., Busa, E., Seidman, L. J., Goldstein, J., Kennedy, D., Caviness, V., Makris, N., Rosen, B., & Dale, A. M. (2004). Automatically parcellating the human cerebral cortex. *Cerebral Cortex*, 14(1), 11–22. [doi:10.1093/cercor/bhg087](https://doi.org/10.1093/cercor/bhg087). PMID 14654453.
- **NextBrain probabilistic histological atlas.**
  Casamitjana, A., Mancini, M., Robinson, E., Peter, L., Annunziata, R., Althonayan, J., … Jaunmuktane, Z., & Iglesias, J. E. (2025). A probabilistic histological atlas of the human brain for MRI segmentation. *Nature*, 648(8094), 678–685. [doi:10.1038/s41586-025-09708-2](https://doi.org/10.1038/s41586-025-09708-2). PMID 41193801. Each brain's labels are its own segmentation with the atlas, produced by `scripts/segment_nextbrain.py` through FreeSurfer 8.2's SuperSynth and `mri_histo_atlas_segment_fireants`.

### Reference datasets and tools

- **MGH Connectome Diffusion Microstructure Dataset (CDMD).**
  Tian, Q., Fan, Q., Witzel, T., Polackal, M. N., Ohringer, N. A., Ngamsombat, C., Russo, A. W., Machado, N., Brewer, K., Wang, F., Setsompop, K., Polimeni, J. R., Keil, B., Wald, L. L., Rosen, B. R., Klawiter, E. C., Nummenmaa, A., & Huang, S. Y. (2022). Comprehensive diffusion MRI dataset for in vivo human brain microstructure mapping using 300 mT/m gradients. *Scientific Data*, 9(1), 7. [doi:10.1038/s41597-021-01092-6](https://doi.org/10.1038/s41597-021-01092-6). PMID 35042861. Figshare collection [10.6084/m9.figshare.c.5315474.v1](https://doi.org/10.6084/m9.figshare.c.5315474.v1).
- **DIPY.**
  Garyfallidis, E., Brett, M., Amirbekian, B., Rokem, A., van der Walt, S., Descoteaux, M., Nimmo-Smith, I., & Dipy Contributors (2014). Dipy, a library for the analysis of diffusion MRI data. *Frontiers in Neuroinformatics*, 8, 8. [doi:10.3389/fninf.2014.00008](https://doi.org/10.3389/fninf.2014.00008). PMID 24600385. CDMD's tracts are fitted, tracked and recognised with DIPY 1.12.1.
- **RecoBundles.**
  Garyfallidis, E., Côté, M.-A., Rheault, F., Sidhu, J., Hau, J., Petit, L., Fortin, D., Cunanne, S., & Descoteaux, M. (2018). Recognition of white matter bundles using local and global streamline-based registration and clustering. *NeuroImage*, 170, 283–295. [doi:10.1016/j.neuroimage.2017.07.015](https://doi.org/10.1016/j.neuroimage.2017.07.015). PMID 28712994.
- **HCP842 bundle atlas.**
  Yeh, F.-C., Panesar, S., Fernandes, D., Meola, A., Yoshino, M., Fernandez-Miranda, J. C., Vettel, J. M., & Verstynen, T. (2018). Population-averaged atlas of the macroscale human structural connectome and its network topology. *NeuroImage*, 178, 57–68. [doi:10.1016/j.neuroimage.2018.05.027](https://doi.org/10.1016/j.neuroimage.2018.05.027). PMID 29758339. Its RecoBundles curation ([figshare 7375883](https://doi.org/10.6084/m9.figshare.7375883.v2), CC BY 4.0) serves only as the recognition model; none of its streamlines are published.
- **TractSeg.**
  Wasserthal, J., Neher, P., & Maier-Hein, K. H. (2018). TractSeg - Fast and accurate white matter tract segmentation. *NeuroImage*, 183, 239–253. [doi:10.1016/j.neuroimage.2018.07.070](https://doi.org/10.1016/j.neuroimage.2018.07.070). PMID 30086412. CDMD's SLF I–III and seven callosal segments are TractSeg 2.10's (Apache-2.0), with its pretrained weights (CC BY 4.0, Zenodo).
- **MRtrix3.**
  Tournier, J.-D., Smith, R., Raffelt, D., Tabbara, R., Dhollander, T., Pietsch, M., Christiaens, D., Jeurissen, B., Yeh, C.-H., & Connelly, A. (2019). MRtrix3: A fast, flexible and open software framework for medical image processing and visualisation. *NeuroImage*, 202, 116137. [doi:10.1016/j.neuroimage.2019.116137](https://doi.org/10.1016/j.neuroimage.2019.116137). PMID 31473352. Version 3.0.8 (MPL-2.0) fits the CSD peaks TractSeg reads, aligns them to its template and fits CDMD's tensor FA.
- **CerebNet.**
  Faber, J., Kügler, D., Bahrami, E., Heinz, L.-S., Timmann, D., Ernst, T. M., … Diedrichsen, J., & Reuter, M. (2022). CerebNet: A fast and reliable deep-learning pipeline for detailed cerebellum sub-segmentation. *NeuroImage*, 264, 119703. [doi:10.1016/j.neuroimage.2022.119703](https://doi.org/10.1016/j.neuroimage.2022.119703). PMID 36349595. CDMD's cerebellar lobules are FastSurfer v2.6.0's CerebNet segmentation (Apache-2.0) of its own T1.
- **Arterial territories.**
  Liu, C.-F., Hsu, J., Xu, X., Kim, G., Sheppard, S. M., Meier, E. L., Miller, M. I., Hillis, A. E., & Faria, A. V. (2023). Digital 3D Brain MRI Arterial Territories Atlas. *Scientific Data*, 10(1), 74. [doi:10.1038/s41597-022-01923-0](https://doi.org/10.1038/s41597-022-01923-0). PMID 36739282. The atlas and its template b0, from the authors' [repository](https://github.com/Chin-Fu-Liu/Acute-stroke_Detection_Segmentation) at commit `159df3a`.
- **SUIT cerebellar template.**
  Diedrichsen, J. (2006). A spatially unbiased atlas template of the human cerebellum. *NeuroImage*, 33(1), 127–138. [doi:10.1016/j.neuroimage.2006.05.056](https://doi.org/10.1016/j.neuroimage.2006.05.056). PMID 16904911. The template registered to each brain for the functional cerebellar atlas.
- **SUIT cerebellar lobules.**
  Diedrichsen, J., Balsters, J. H., Flavell, J., Cussans, E., & Ramnani, N. (2009). A probabilistic MR atlas of the human cerebellum. *NeuroImage*, 46(1), 39–46. [doi:10.1016/j.neuroimage.2009.01.045](https://doi.org/10.1016/j.neuroimage.2009.01.045). PMID 19457380. Carried by the same registration only to score it against CerebNet; not published.
- **Functional cerebellar atlas.**
  Nettekoven, C., Zhi, D., Shahshahani, L., Pinho, A. L., Saadon-Grosman, N., Buckner, R. L., & Diedrichsen, J. (2024). A hierarchical atlas of the human cerebellum for functional precision mapping. *Nature Communications*, 15, 8376. [doi:10.1038/s41467-024-52371-w](https://doi.org/10.1038/s41467-024-52371-w). PMID 39333089. The symmetric 32-region map, from the Diedrichsen lab's [cerebellar atlas collection](https://github.com/DiedrichsenLab/cerebellar_atlases) at commit `6857dfa`.
- **Julich-Brain.**
  Amunts, K., Mohlberg, H., Bludau, S., & Zilles, K. (2020). Julich-Brain: A 3D probabilistic atlas of the human brain's cytoarchitecture. *Science*, 369(6506), 988–992. [doi:10.1126/science.abb4588](https://doi.org/10.1126/science.abb4588). PMID 32732281. The maps are version 3.1 (Amunts, Mohlberg, Bludau, Caspers, Lewis, Eickhoff & Pieperhoff, EBRAINS, [doi:10.25493/KNSN-XB4](https://doi.org/10.25493/KNSN-XB4)), on `fsaverage`.
- **Spinal Cord Toolbox.**
  De Leener, B., Lévy, S., Dupont, S. M., Fonov, V. S., Stikov, N., Collins, D. L., Callot, V., & Cohen-Adad, J. (2017). SCT: Spinal Cord Toolbox, an open-source software for processing spinal cord MRI data. *NeuroImage*, 145, 24–43. [doi:10.1016/j.neuroimage.2016.10.009](https://doi.org/10.1016/j.neuroimage.2016.10.009). PMID 27720818. Version 7.3 (LGPL-3.0) segments CDMD's cord, labels its vertebrae and registers PAM50 to it.
- **Contrast-agnostic cord segmentation.**
  Bédard, S., Karthik, E. N., Tsagkas, C., Pravatà, E., Granziera, C., Smith, A., Weber II, K. A., & Cohen-Adad, J. (2025). Towards contrast-agnostic soft segmentation of the spinal cord. *Medical Image Analysis*, 101, 103473. [doi:10.1016/j.media.2025.103473](https://doi.org/10.1016/j.media.2025.103473). PMID 39874684.
- **PAM50.**
  De Leener, B., Fonov, V. S., Collins, D. L., Callot, V., Stikov, N., & Cohen-Adad, J. (2018). PAM50: Unbiased multimodal template of the brainstem and spinal cord aligned with the ICBM152 space. *NeuroImage*, 165, 170–179. [doi:10.1016/j.neuroimage.2017.10.041](https://doi.org/10.1016/j.neuroimage.2017.10.041). PMID 29061527.
- **PAM50 white-matter atlas.**
  Lévy, S., Benhamou, M., Naaman, C., Rainville, P., Callot, V., & Cohen-Adad, J. (2015). White matter atlas of the human spinal cord with estimation of partial volume effect. *NeuroImage*, 119, 262–271. [doi:10.1016/j.neuroimage.2015.06.040](https://doi.org/10.1016/j.neuroimage.2015.06.040). PMID 26099457.

### Group data and templates

Nothing here was measured in the brain shown. Each source reaches it by an area's name, through the registered spheres, or by registering a template to it.

- **Receptor fingerprints.**
  Zilles, K., Bacha-Trams, M., Palomero-Gallagher, N., Amunts, K., & Friederici, A. D. (2015). Common molecular basis of the sentence comprehension network revealed by neurotransmitter receptor fingerprints. *Cortex*, 63, 79–89. [doi:10.1016/j.cortex.2014.07.007](https://doi.org/10.1016/j.cortex.2014.07.007). PMID 25243991.

  Palomero-Gallagher, N., & Zilles, K. (2018). Cyto- and receptor architectonic mapping of the human brain. *Handbook of Clinical Neurology*, 150, 355–387. [doi:10.1016/B978-0-444-63639-3.00024-4](https://doi.org/10.1016/B978-0-444-63639-3.00024-4). PMID 29496153. Each of the 36 datasets has its own EBRAINS DOI, listed under [Receptor datasets](#receptor-datasets).
- **F-TRACT stimulation responses.**
  Trebaul, L., Deman, P., Tuyisenge, V., Jedynak, M., Hugues, E., Rudrauf, D., … Kahane, P., & David, O. (2018). Probabilistic functional tractography of the human cortex revisited. *NeuroImage*, 181, 414–429. [doi:10.1016/j.neuroimage.2018.07.039](https://doi.org/10.1016/j.neuroimage.2018.07.039). PMID 30025851. The data are the parcellation-based atlas F-TRACT_P_01_v2307 (Jedynak, Boyer, Lemaréchal, Trebaul, Tadel, … & F-TRACT Consortium, 2023, EBRAINS, [10.25493/JYVR-WJ7](https://doi.org/10.25493/JYVR-WJ7)), on Julich-Brain 3.0's areas.
- **Thalamocortical stimulation responses.**
  Lyu, D., Stiger, J. R., Lusk, Z., Buch, V., & Parvizi, J. (2025). Mapping human thalamocortical connectivity with electrical stimulation and recording. *Nature Neuroscience*, 28(8), 1797–1809. [doi:10.1038/s41593-025-02009-x](https://doi.org/10.1038/s41593-025-02009-x). PMID 40664975. The data are the authors' Zenodo record ([10.5281/zenodo.16939708](https://doi.org/10.5281/zenodo.16939708)); contacts reach Destrieux areas through HCP's `fs_LR`-to-`fsaverage` sphere deformations.
- **Visual field map.**
  Benson, N. C., Jamison, K. W., Arcaro, M. J., Vu, A. T., Glasser, M. F., Coalson, T. S., Van Essen, D. C., Yacoub, E., Ugurbil, K., Winawer, J., & Kay, K. (2018). The Human Connectome Project 7 Tesla retinotopy dataset: Description and population receptive field analysis. *Journal of Vision*, 18(13), 23. [doi:10.1167/18.13.23](https://doi.org/10.1167/18.13.23). PMID 30593068.

  Benson, N. C., Butt, O. H., Brainard, D. H., & Aguirre, G. K. (2014). Correction of distortion in flattened representations of the cortical surface allows prediction of V1–V3 functional organization from anatomy. *PLoS Computational Biology*, 10(3), e1003538. [doi:10.1371/journal.pcbi.1003538](https://doi.org/10.1371/journal.pcbi.1003538). PMID 24676149. The template is version 4.0, fitted to the HCP 7T group average, from [neuropythy](https://github.com/noahbenson/neuropythy) at commit `a3d240f`.
- **Aphasia Recovery Cohort.**
  Gibson, M., Newman-Norlund, R., Bonilha, L., Fridriksson, J., Hickok, G., Hillis, A. E., den Ouden, D. B., & Rorden, C. (2024). The Aphasia Recovery Cohort, an open-source chronic stroke repository. *Scientific Data*, 11(1), 981. [doi:10.1038/s41597-024-03819-7](https://doi.org/10.1038/s41597-024-03819-7). PMID 39251640. The dataset is OpenNeuro ds004884 v1.0.2 ([10.18112/openneuro.ds004884.v1.0.2](https://doi.org/10.18112/openneuro.ds004884.v1.0.2)); the normalised lesions and the cohort's mean T1 come from the authors' [demonstration repository](https://github.com/neurolabusc/AphasiaRecoveryCohortDemo) at commit `1d24ad4`.
- **Disorder effects (ENIGMA).**
  Larivière, S., Paquola, C., Park, B. Y., Royer, J., Wang, Y., Benkarim, O., … Thompson, P. M., & Bernhardt, B. C. (2021). The ENIGMA Toolbox: multiscale neural contextualization of multisite neuroimaging datasets. *Nature Methods*, 18(7), 698–700. [doi:10.1038/s41592-021-01186-4](https://doi.org/10.1038/s41592-021-01186-4). PMID 34194050. The tables are the toolbox repository's ([MICA-MNI/ENIGMA](https://github.com/MICA-MNI/ENIGMA)) at commit `b08974b`; each working group's paper, with its PMID and the errata three of them carry, is listed on the [disorder effects](../features/disorder-effects.md#data) page.
- **MNI152NLin2009cAsym template.**
  Fonov, V., Evans, A. C., Botteron, K., Almli, C. R., McKinstry, R. C., Collins, D. L., & Brain Development Cooperative Group (2011). Unbiased average age-appropriate atlases for pediatric studies. *NeuroImage*, 54(1), 313–327. [doi:10.1016/j.neuroimage.2010.07.033](https://doi.org/10.1016/j.neuroimage.2010.07.033). PMID 20656036. The 2009c template was first described in an abstract with no PMID: Fonov, Evans, McKinstry, Almli & Collins (2009), *NeuroImage*, 47, S102 ([10.1016/S1053-8119(09)70884-5](https://doi.org/10.1016/S1053-8119(09)70884-5)). The file is TemplateFlow's.
- **SPM12 tissue probability maps.**
  Ashburner, J., & Friston, K. J. (2005). Unified segmentation. *NeuroImage*, 26(3), 839–851. [doi:10.1016/j.neuroimage.2005.02.018](https://doi.org/10.1016/j.neuroimage.2005.02.018). PMID 15955494. The maps are SPM12's `TPM.nii` (version 7771), built from the [IXI dataset](https://brain-development.org/ixi-dataset/).

### Receptor datasets

Each fingerprint is its own EBRAINS dataset of receptor densities measured by Zilles, Palomero-Gallagher and colleagues. Cite the ones you show by their DOIs.

| Measured in | DOI |
| :--- | :--- |
| Area 3b (PostCG) | [10.25493/tzby-96w](https://doi.org/10.25493/tzby-96w) |
| Area 4p (PreCG) | [10.25493/j5jr-yh0](https://doi.org/10.25493/j5jr-yh0) |
| Area 7A (SPL) | [10.25493/dqj7-kc8](https://doi.org/10.25493/dqj7-kc8) |
| Dorsal part of Area 44 (IFG) | [10.25493/yqcr-1dq](https://doi.org/10.25493/yqcr-1dq) |
| Ventral part of Area 44 (IFG) | [10.25493/p82m-pvm](https://doi.org/10.25493/p82m-pvm) |
| Area 45 (IFG) | [10.25493/qfsy-ywc](https://doi.org/10.25493/qfsy-ywc) |
| Area ifs1 (IFS) | [10.25493/shg2-7rs](https://doi.org/10.25493/shg2-7rs) |
| Area ifs2 (IFS) | [10.25493/14m7-qjr](https://doi.org/10.25493/14m7-qjr) |
| Area ifs3 (IFS) | [10.25493/z5jn-j28](https://doi.org/10.25493/z5jn-j28) |
| Area ifs4 (IFS) | [10.25493/yf9r-j87](https://doi.org/10.25493/yf9r-j87) |
| Area ifj1 (IFS, PreCS) | [10.25493/js85-vqd](https://doi.org/10.25493/js85-vqd) |
| Area ifj2 (IFS, PreCS) | [10.25493/vn1a-q2r](https://doi.org/10.25493/vn1a-q2r) |
| Area FG1 (FusG) | [10.25493/qn6k-chn](https://doi.org/10.25493/qn6k-chn) |
| Area FG2 (FusG) | [10.25493/vfcw-hxz](https://doi.org/10.25493/vfcw-hxz) |
| Area PF (IPL) | [10.25493/vsfy-eyf](https://doi.org/10.25493/vsfy-eyf) |
| Area PFcm (IPL) | [10.25493/5qdp-arh](https://doi.org/10.25493/5qdp-arh) |
| Area PFm (IPL) | [10.25493/fs3t-2r8](https://doi.org/10.25493/fs3t-2r8) |
| Area PFop (IPL) | [10.25493/9g1p-02s](https://doi.org/10.25493/9g1p-02s) |
| Area PFt (IPL) | [10.25493/e7pm-fdc](https://doi.org/10.25493/e7pm-fdc) |
| Area PGa (IPL) | [10.25493/62w8-ryf](https://doi.org/10.25493/62w8-ryf) |
| Area PGp (IPL) | [10.25493/x71t-hz](https://doi.org/10.25493/x71t-hz) |
| Area TE 1.0 (HESCHL) | [10.25493/ahx0-9pu](https://doi.org/10.25493/ahx0-9pu) |
| Area TE 2.1 (STG) | [10.25493/c279-428](https://doi.org/10.25493/c279-428) |
| Area hOc1 (V1, 17, CalcS) | [10.25493/p8sd-jmh](https://doi.org/10.25493/p8sd-jmh) |
| Dorsal part of Area hOc2 (V2, 18) | [10.25493/zj7e-kxz](https://doi.org/10.25493/zj7e-kxz) |
| Ventral part of Area hOc2 (V2, 18) | [10.25493/2e5c-pvm](https://doi.org/10.25493/2e5c-pvm) |
| Dorsal part of Area hOc3 (Cuneus) | [10.25493/4etw-9xb](https://doi.org/10.25493/4etw-9xb) |
| Ventral part of Area hOc3 (LingG) | [10.25493/tbmx-bz9](https://doi.org/10.25493/tbmx-bz9) |
| CA1 (Hippocampus) | [10.25493/y7yv-6q6](https://doi.org/10.25493/y7yv-6q6) |
| CA2 (Hippocampus) | [10.25493/4f4s-w5a](https://doi.org/10.25493/4f4s-w5a) |
| CA3 (Hippocampus) | [10.25493/xfhr-x41](https://doi.org/10.25493/xfhr-x41) |
| DG (Hippocampus) | [10.25493/m8pk-c82](https://doi.org/10.25493/m8pk-c82) |
| Putamen | [10.25493/4gz1-shh](https://doi.org/10.25493/4gz1-shh) |
| Globus pallidus | [10.25493/tprg-5vh](https://doi.org/10.25493/tprg-5vh) |
| Mediodorsal thalamic nucleus | [10.25493/gky8-nzr](https://doi.org/10.25493/gky8-nzr) |
| Anterior thalamic nucleus | [10.25493/kktt-1tk](https://doi.org/10.25493/kktt-1tk) |

## Licences

| Files | Source | Licence |
| :--- | :--- | :--- |
| `fsaverage` assets (built locally, not published) | FreeSurfer distribution | FreeSurfer Software License |
| `cdmd` assets and tracts | MGH CDMD, figshare | CC0 1.0 |
| `cdmd` SLF I–III and callosal segments | TractSeg pretrained weights | CC BY 4.0 (attribution) |
| HCP-MMP-derived files | Human Connectome Project | WU-Minn HCP Open Access Data Use Terms |
| `cab-np.json` | CAB-NP (Rutgers, Yale) | Non-commercial |
| `cortex-julich.glb`, `ribbon-julich.labels`, `tissues-julich.volume` | Julich-Brain 3.1 (EBRAINS) | CC BY-NC-SA 4.0 |
| `tissues-arterial.volume`, the cortex meshes' `_TERRITORY` attribute, arterial regions and territory shares in `manifest.json` | Liu et al. 2023 | CC BY-SA 4.0 |
| `tissues-nettekoven.volume`, cerebellar functional regions and shares in `manifest.json` | Nettekoven et al. 2024 on the SUIT template (Diedrichsen lab) | CC BY-NC 3.0 |
| `tissues-choi.volume`, striatal network regions and shares in `manifest.json` | Choi et al. 2012, distributed with FreeSurfer 8.2 | FreeSurfer Software License |
| `cortex-schaefer.glb`, `ribbon-schaefer.labels`, `tissues-schaefer.volume` | Schaefer 2018 (ThomasYeoLab/CBIG) | MIT |
| `neuropsych-domains.json`, area scores | Neurosynth | ODbL 1.0 |
| `receptor-fingerprints.json` | Zilles and Palomero-Gallagher receptor datasets (EBRAINS) | CC BY-NC-SA 4.0 |
| `stimulation-ftract.json` | F-TRACT_P_01_v2307 (EBRAINS) | CC BY-NC-SA 4.0 |
| `stimulation-responses.json` | Lyu et al. 2025 (Zenodo) | CC BY 4.0 |
| `disorder-effects.json` | ENIGMA working groups' summary statistics, as the ENIGMA Toolbox republishes them | BSD-3-Clause |
| `retinotopy.json` | Benson template v4.0 (neuropythy) | AGPL-3.0 |
| `stroke-cases.json`, `stroke-cases.masks` | Aphasia Recovery Cohort (OpenNeuro) and its authors' normalised lesions | CC0 1.0; BSD-2-Clause |
| `coordinates-mni152nlin2009casym.field` | MNI152NLin2009cAsym (McConnell Brain Imaging Centre, via TemplateFlow) | MNI template licence |
| `coordinates-spm12.field` | SPM12 tissue probability maps, built from IXI | GPL-2.0-or-later; IXI under CC BY-SA 3.0 |
| NextBrain-derived files | FreeSurfer 8.2 | None named beyond FreeSurfer's |
| `spinal-cord.glb` | PAM50 (Spinal Cord Toolbox) on CDMD's cord | MIT |
| Viewer and pipeline code | This repository | AGPL-3.0-or-later ([`LICENSE`](https://github.com/JoshuaDuq/planumatlas/blob/main/LICENSE), [`NOTICE`](https://github.com/JoshuaDuq/planumatlas/blob/main/NOTICE)) |

The AGPL covers code only, not data. Anyone who runs a modified version for others, including as a website, must offer them its source. Code committed before 29 October 2026 was published under the MIT License, and copies obtained under it keep those terms.

### FreeSurfer Software License (`fsaverage`)

These are modified versions of FreeSurfer data: converted, resampled and re-encoded, not the original files. They are distributed under Part B of the FreeSurfer Software License Agreement (Version 1.0, February 2011), reproduced as it requires:

> All or portions of this licensed product (such portions are the "Software") have been obtained under license from The General Hospital Corporation and are subject to the following terms and conditions:
>
> License from MGH with Right to Sublicense ("Software License")
>
> As used in this Software License, "you" means the individual downloading and/or using, reproducing, modifying, displaying and/or distributing the Software and the institution or entity which employs or is otherwise affiliated with such individual in connection therewith. The General Hospital Corporation, Boston MA, USA ("MGH") hereby grants you, with right to sublicense, with respect to MGH's rights in the software, and data, if any, which is the subject of this Software License (collectively, the "Software"), a royalty-free, non-exclusive license to use, reproduce, make derivative works of, display and distribute the Software, provided that: (a) you accept and adhere to all of the terms and conditions of this Software License; (b) in connection with any copy of or sublicense of all or any portion of the Software, all of the terms and conditions in this Software License shall appear in and shall apply to such copy and such sublicense, including without limitation all source and executable forms and on any user documentation, prefaced with the following words: "All or portions of this licensed product (such portions are the "Software") have been obtained under license from The General Hospital Corporation and are subject to the following terms and conditions:" (c) you preserve and maintain all applicable attributions, copyright notices and licenses included in or applicable to the Software; (d) modified versions of the Software must be clearly identified and marked as such, and must not be misrepresented as being the original Software; and (e) you consider making, but are under no obligation to make, the source code of any of your modifications to the Software freely available to others on an open source basis. The license granted in this Software License includes without limitation the right to (i) incorporate the Software into proprietary programs (subject to any restrictions applicable to such programs), (ii) add your own copyright statement to your modifications of the Software, and (iii) provide additional or different license terms and conditions in your sublicenses of modifications of the Software; provided that in each case your use, reproduction or distribution of such modifications otherwise complies with the conditions stated in this Software License. This Software License does not grant any rights with respect to third party software, except those rights that MGH has been authorized by a third party to grant to you, and accordingly you are solely responsible for (i) obtaining any permissions from third parties that you need to use, reproduce, make derivative works of, display and distribute the Software, and (ii) informing your sublicensees, including without limitation your end-users, of their obligations to secure any such required permissions. The Software has been designed for research purposes only and has not been reviewed or approved by the Food and Drug Administration or by any other agency. YOU ACKNOWLEDGE AND AGREE THAT CLINICAL APPLICATIONS ARE NEITHER RECOMMENDED NOR ADVISED. Any commercialization of the Software is at the sole risk of the party or parties engaged in such commercialization. You further agree to use, reproduce, make derivative works of, display and distribute the Software in compliance with all applicable governmental laws, regulations and orders, including without limitation those relating to export and import control. The Software is provided "AS IS" and neither MGH nor any contributor to the software (each a "Contributor") shall have any obligation to provide maintenance, support, updates, enhancements or modifications thereto. MGH AND ALL CONTRIBUTORS SPECIFICALLY DISCLAIM ALL EXPRESS AND IMPLIED WARRANTIES OF ANY KIND INCLUDING, BUT NOT LIMITED TO, ANY WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL MGH OR ANY CONTRIBUTOR BE LIABLE TO ANY PARTY FOR DIRECT, INDIRECT, SPECIAL, INCIDENTAL, EXEMPLARY OR CONSEQUENTIAL DAMAGES HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY ARISING IN ANY WAY RELATED TO THE SOFTWARE, EVEN IF MGH OR ANY CONTRIBUTOR HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. TO THE MAXIMUM EXTENT NOT PROHIBITED BY LAW OR REGULATION, YOU FURTHER ASSUME ALL LIABILITY FOR YOUR USE, REPRODUCTION, MAKING OF DERIVATIVE WORKS, DISPLAY, LICENSE OR DISTRIBUTION OF THE SOFTWARE AND AGREE TO INDEMNIFY AND HOLD HARMLESS MGH AND ALL CONTRIBUTORS FROM AND AGAINST ANY AND ALL CLAIMS, SUITS, ACTIONS, DEMANDS AND JUDGMENTS ARISING THEREFROM. None of the names, logos or trademarks of MGH or any of MGH's affiliates or any of the Contributors, or any funding agency, may be used to endorse or promote products produced in whole or in part by operation of the Software or derived from or based on the Software without specific prior written permission from the applicable party. Any use, reproduction or distribution of the Software which is not in accordance with this Software License shall automatically revoke all rights granted to you under this Software License and render Paragraphs 1 and 2 of this Software License null and void. This Software License does not grant any rights in or to any intellectual property owned by MGH or any Contributor except those rights expressly granted hereunder.

The complete agreement is in [`public/models/licenses/FreeSurfer.html`](https://github.com/JoshuaDuq/planumatlas/blob/main/public/models/licenses/FreeSurfer.html).

### CC0 1.0 (CDMD)

CDMD is dedicated to the public domain. Its T1 in `public/diffusion/cdmd-sub-013/` is the file its reconstruction imported, byte for byte; its 30 TRK bundles were tracked here from its own diffusion data (17 by RecoBundles, 13 by TractSeg) had their ends trimmed back inside the brain and were resampled to 0.5 mm steps, and its FA map is the tensor FA of that diffusion data resampled onto the T1, as `provenance.json` records.

### NextBrain

The atlas and SuperSynth model come from FreeSurfer's distribution server; the segmentation tool ships in FreeSurfer 8.2. The NextBrain paper names no separate licence, so Planum claims none beyond FreeSurfer's. The earlier MNI-warped NextBrain source published no licence; the unpublished `fsaverage` still uses it, so that volume is not redistributed.

### HCP Open Access Data Use Terms

`cortex-hcp-mmp.glb`, `ribbon-hcp-mmp.labels`, `tissues-hcp-mmp.volume`, `functional-regions.json` and `cab-np.json` derive from HCP-MMP1.0. The terms pass to every recipient, require an acknowledgement in the wording given under [Acknowledgements](#acknowledgements) and forbid identifying or contacting participants. Full terms: [`HCP-Data-Use-Terms.txt`](https://github.com/JoshuaDuq/planumatlas/blob/main/public/models/licenses/HCP-Data-Use-Terms.txt).

### CAB-NP licence

Non-commercial only. Redistribution is allowed without permission when no financial return is made, the conditions pass on, and the original files are included. Each `cab-np.json` therefore holds only the assignments, apart from the meshes, beside the unmodified [licence](https://github.com/JoshuaDuq/planumatlas/blob/main/public/models/licenses/CAB-NP.txt) and [label key](https://github.com/JoshuaDuq/planumatlas/blob/main/public/models/licenses/CAB-NP-LabelKey.txt). Commercial use needs a licence from the universities.

### CC BY-NC-SA 4.0 (Julich-Brain)

Non-commercial, and shared alike: the Julich-Brain files derived for each brain stay under CC BY-NC-SA 4.0, with the dataset and Amunts et al. (2020) credited and the changes stated (projection to the subject; gap maps and medial masks left unassigned). Full terms: [`Julich-Brain-CC-BY-NC-SA-4.0.pdf`](https://github.com/JoshuaDuq/planumatlas/blob/main/public/models/licenses/Julich-Brain-CC-BY-NC-SA-4.0.pdf).

### CC BY-SA 4.0 (arterial territories)

Attribution, and shared alike: the arterial territory files derived for each brain stay under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), with Liu et al. (2023) credited and the changes stated (registration of the atlas's template to the subject, nearest-neighbour transfer, and per-vertex and per-region territories drawn from it). The atlas's label file names CC BY-SA 4.0 but links the CC BY legal code; Planum takes the stricter reading. The rest of each cortex mesh keeps its own source's terms.

### CC BY-NC 3.0 (functional cerebellar atlas)

Non-commercial, with attribution: the SUIT template and the atlases distributed with it, the Nettekoven et al. (2024) map included, are under [CC BY-NC 3.0 Unported](https://creativecommons.org/licenses/by-nc/3.0/) ([licence file](https://github.com/DiedrichsenLab/cerebellar_atlases/blob/6857dfa732de6dd60c94da2f84d0b15ccf316618/tpl-SUIT/LICENSE)). The files derived for each brain credit Nettekoven et al. (2024) and Diedrichsen (2006) and state the changes: registration to the subject and restriction to its cerebellar cortex.

### Open Database License (`neuropsych-domains.json`)

Derived from Neurosynth under [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) and shared under it. Public use must attribute Neurosynth (Yarkoni et al. 2011); derived databases must stay ODbL.

### MIT (`spinal-cord.glb`)

PAM50 and its white-matter atlas are distributed through the Spinal Cord Toolbox's OSF project, which declares the MIT licence; the PAM50 repository itself names none. Keep the copyright notice with the cord. Full terms: [`PAM50.txt`](https://github.com/JoshuaDuq/planumatlas/blob/main/public/models/licenses/PAM50.txt).

### CC BY-NC-SA 4.0 (receptor fingerprints, F-TRACT)

Non-commercial, and shared alike, as for Julich-Brain. `receptor-fingerprints.json` credits each dataset by its DOI ([Receptor datasets](#receptor-datasets)) and states the change: each fingerprint is given to the region of this brain that shares its area's or structure's name. `stimulation-ftract.json` credits F-TRACT_P_01_v2307 and Trebaul et al. (2018) and states the changes: Julich-Brain 3.0 areas matched to 3.1 by name, and rates drawn only from pairs recorded in at least three implantations.

### CC BY 4.0 (stimulation responses)

Attribution: `stimulation-responses.json` credits Lyu et al. (2025) and its Zenodo record and states the changes: the authors' per-pair classifications pooled into response rates for each pair of their labels, by side, and contacts assigned to Destrieux areas through HCP's sphere deformations. TractSeg's pretrained weights, behind the SLF I–III and callosal segments, are under the same licence and credited in the bibliography.

### AGPL-3.0 (visual field map)

neuropythy distributes the Benson template under the [GNU AGPL 3.0](https://www.gnu.org/licenses/agpl-3.0.html), and `retinotopy.json`, derived from it, stays under that licence, which is also Planum's code licence. Its source is the commit named in the bibliography. The change: the template carried from `fsaverage` onto this brain through the registered spheres, V1–V3 only.

### CC0 1.0 and BSD-2-Clause (stroke cases)

The Aphasia Recovery Cohort is dedicated to the public domain. The normalised lesion maps and the cohort's mean T1 come from Chris Rorden's demonstration repository under the BSD-2-Clause licence, whose notice ships as [`ARC-normalised-lesions-BSD-2-Clause.txt`](https://github.com/JoshuaDuq/planumatlas/blob/main/public/models/licenses/ARC-normalised-lesions-BSD-2-Clause.txt). The change: each lesion carried onto this brain through a registration of that mean T1, and counted on its regions.

### BSD-3-Clause (disorder effects)

The ENIGMA Toolbox repository distributes its summary statistics under the BSD 3-Clause licence, whose notice ships as [`ENIGMA-Toolbox-BSD-3-Clause.txt`](https://github.com/JoshuaDuq/planumatlas/blob/main/public/models/licenses/ENIGMA-Toolbox-BSD-3-Clause.txt). The change: each table's rows carried to this brain's regions by name, and only those that survive the table's false discovery rate kept.

### MNI template licence and GPL-2.0 (published coordinates)

Each coordinate field is derived from a registration of its template to this brain, and both templates' copyright notices travel in `manifest.json`. MNI152NLin2009cAsym is distributed under this notice:

> Copyright (C) 1993–2004 Louis Collins, McConnell Brain Imaging Centre, Montreal Neurological Institute, McGill University.
>
> Permission to use, copy, modify, and distribute this software and its documentation for any purpose and without fee is hereby granted, provided that the above copyright notice appear in all copies. The authors and McGill University make no representations about the suitability of this software for any purpose. It is provided “as is” without express or implied warranty. The authors are not responsible for any data loss, equipment damage, property loss, or injury to subjects or patients resulting from the use or misuse of this software package.

SPM12's tissue probability maps are part of SPM12 (version 7771), Copyright (C) 1991,1994-2020 Wellcome Centre for Human Neuroimaging, under the [GNU GPL 2.0 or later](https://www.gnu.org/licenses/old-licenses/gpl-2.0.html). They are built from the IXI dataset, which is under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).

## Acknowledgements

A paper, poster or talk that shows Planum's views cites Planum ([`CITATION.cff`](https://github.com/JoshuaDuq/planumatlas/blob/main/CITATION.cff)) and, from the bibliography, the sources behind the views it shows. Datasets are cited by their DOIs as well as their papers: CDMD, Julich-Brain 3.1, the [receptor datasets](#receptor-datasets), F-TRACT, Lyu et al.'s Zenodo record and the Aphasia Recovery Cohort.

**Human Connectome Project.** The HCP terms require an acknowledgement, in this wording, for HCP-MMP and everything derived from it: the HCP-MMP atlas, the functional divisions and the CAB-NP networks. It is also the right credit for the visual field map, which is fitted to HCP 7T data.

> Data were provided [in part] by the Human Connectome Project, WU-Minn Consortium (Principal Investigators: David Van Essen and Kamil Ugurbil; 1U54MH091657) funded by the 16 NIH Institutes and Centers that support the NIH Blueprint for Neuroscience Research; and by the McDonnell Center for Systems Neuroscience at Washington University.

**Computing.** CDMD's RecoBundles tracts and the Neurosynth term scores were computed on Rorqual. Publications about Planum itself therefore carry the [Alliance's acknowledgement](https://alliancecan.ca/en/services/advanced-research-computing/acknowledging-alliance):

> This research was enabled in part by support provided by Calcul Québec (calculquebec.ca) and the Digital Research Alliance of Canada (alliancecan.ca).

## Intended use

Research and education only. Planum is not a medical device, has not been reviewed by any regulator, and must not be used for diagnosis, treatment or any clinical decision.
