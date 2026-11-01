# Circuit additions: 30 October 2026

Historical review. All four tours described here were withdrawn from the active Circuits catalogue on 31 October because they present functional/clinical landmarks rather than a specified anatomical circuit. Their source records and bilingual descriptions are preserved in `data/archived-circuit-tours.yaml`. The current catalogue has five pathway/loop-branch tours and 25 landmarks.

On 30 October, four tours added 12 landmarks to the previous 35 tours and 115 landmarks. That historical catalogue had 39 tours, 127 landmarks and 109 bibliography entries. No anatomy, numerical analysis or existing tour was changed.

## Selection and review scope

Selection favoured established sensory, motor and cognitive systems with both human patient evidence and complementary physiological or lesion evidence. The alternatives were a larger set based on single case reports, or entirely new anatomical pathways requiring structures the atlas does not resolve. Those were excluded from this addition.

The studies below are original research. Their PubMed abstracts were checked for the population, task, anatomical claim and limits used in these tours. For Stoodley, indexed PMC results and discussion also informed the naming and threshold qualifications. This is a targeted source check, **not a complete full-text review** of all eight papers, systematic evidence grading or independent specialist sign-off. Clinical extraction scopes in `data/neuropsychology.yaml` were not upgraded. The earlier [full-text review log](full-text-review.md) retains its separate scope.

| Tour | Deficit evidence | Complementary evidence | Mapping decision |
| --- | --- | --- | --- |
| Face perception | [Barton et al. (2002), Neurology](https://pubmed.ncbi.nlm.nih.gov/11781408/) | [Pitcher et al. (2007), Current Biology](https://pubmed.ncbi.nlm.nih.gov/17764942/); existing Haxby model reference | Right inferior occipital and fusiform anatomy. OFA stimulation is background evidence; only the fusiform landmark has the cited prosopagnosia lesion mapping. Neither functional area equals its whole anatomical parcel. |
| Cortical swallowing | [Galovic et al. (2013), Stroke](https://pubmed.ncbi.nlm.nih.gov/23887840/) | [Hamdy et al. (1999), Journal of Neurophysiology](https://pubmed.ncbi.nlm.nih.gov/10200226/) | Paired short insular gyri and inferior frontal opercula. The opercular result concerns combined injury; side comparisons do not prove symmetrical effects. No capsular or brainstem relay is substituted by an unrelated label. |
| Posterior cerebellum and cognition | [Schmahmann & Sherman (1998), Brain](https://pubmed.ncbi.nlm.nih.gov/9577385/); [Stoodley et al. (2016), NeuroImage: Clinical](https://pmc.ncbi.nlm.nih.gov/articles/PMC5079414/) | Existing Kelly–Strick macaque tracing reference | Left Crus I, right Crus I and right Crus II are selected cognitive landmarks. The left mental-rotation association is explicitly marked as a more lenient, uncorrected finding. No emotional function is assigned to a particular vermal lobule, and macaque tracing is not presented as connectivity measured in this human brain. |
| Recognizing objects by touch | [Hömke et al. (2009), Human Brain Mapping](https://pmc.ncbi.nlm.nih.gov/articles/PMC6870829/) | [Stoeckel et al. (2004), European Journal of Neuroscience](https://pubmed.ncbi.nlm.nih.gov/15009154/) | Left postcentral, superior parietal and intraparietal landmarks follow the clinical catalogue. The three-case texture/shape findings are qualified as small-sample evidence; the healthy imaging study supplies background. No universal left dominance or independent third relay is asserted. |

## What “supported” means here

The physiological and clinical literature supports studying these systems and their selected region–function relationships. It does not validate the displayed order as a causal chain, prove every highlighted voxel necessary or sufficient, or establish diagnostic or prognostic performance. Study sizes and qualifications are visible in English and French. Small samples, coarse atlas boundaries, selected tasks and incomplete lesion coverage remain material limits.

Four newly cited works were added to `data/reference-records.json` using the existing PubMed/Crossref retrieval functions. These functions check article identity and correction/retraction notices; the four new records returned no notices. The four other added bibliography entries already had identity records in the clinical catalogue. Existing records retain their earlier retrieval date.

Automated checks cover the exact atlas label and supported view for every landmark, bilingual fields, bibliography identity and clinical-source roles. Patient-evidence checks cover every new clinical landmark; a separate check requires the OFA stimulation source to remain background. At the time of addition, browser tests visited all 12 landmarks in both languages. After withdrawal, active-tour navigation tests cover the five retained tours; archive source and mapping checks remain. These checks validate the authored data and navigation, not the underlying biology or clinical accuracy.
