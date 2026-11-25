/** The figures of the README and the methods site, as data for scripts/figures.mjs.
 *
 * A figure is { name, to, columns, aspect, grid, sameScale, panels }. `to` is 'readme' or 'docs'; a methods
 * figure is named <page>-<n>. Panels fill rows of `columns` cells of `aspect` (width over height), or sit
 * where `grid` puts them. A panel is one of:
 *   { state }                  the stage at that link, cropped to its content
 *   { state, mri }             that plane of Linked MRI, whole
 *   { state, shot: selector }  a panel of the interface, whole, in each theme if `themed`
 *   { plot }                   a plot of scripts/figure_plots.py
 * with `steps` a reader would take first, `keys` to draw the stage's colour key under the panel, `crop` as
 * fractions of the capture, and `link: false` for a state that another panel's legend link already gives.
 * `state` is exactly what the legend links: the script refuses a state the viewer rewrites.
 */

const base = { anatomy: 'cdmd', lang: 'en', atlas: 'destrieux', detail: 'learning' };
const nextbrain = { ...base, detail: 'nextbrain' };
const template = { ...base, anatomy: 'mni152' };
const stage = (state, extra) => ({ state: { ...base, ...state }, ...extra });
const surface = (state, extra) => stage({ view: 'left', ...state }, extra);
// One hemisphere alone, from its lateral side unless `view` says otherwise.
const lateral = (state, extra) => surface({ hemi: 'left', internal: '0', ...state }, extra);
const cut = (plane, pos, view, state, extra) => stage({ ...state, cut: plane, pos, view }, extra);
const tracts = (view, ids, state) => stage({ ...state, tab: 'diffusion', view, opacity: '0.16', tracts: ids });
const mri = (plane, pos, view, state, extra) => ({ ...cut(plane, pos, view, state), mri: plane, ...extra });

// A panel of the interface for the state another panel links: the region detail or a profile, in each theme.
const panel = (view, steps = [], extra) => ({ ...view, steps, shot: '#inspector .detail-body', themed: true, link: false, ...extra });
// A section of the region detail under Research data, opened as a reader opens it.
const research = (title) => [['css', '#inspector summary:has-text("Research data")'], ['css', `#inspector summary:has-text("${title}")`]];
const section = (title) => `#inspector .evidence-section:has(summary:has-text("${title}"))`;
// Two stage panels beside one tall panel of the interface, in a grid of five columns.
const SIDE = [[0, 0, 3, 1], [0, 1, 3, 1], [3, 0, 2, 2]];
const lesion = '-45,-25,30,15';
const coordinate = { coord: '-42,22,6', space: 'mni152nlin2009casym' };
// A NextBrain cut through the left thalamus, the camera close on it.
const thalamus = { detail: 'nextbrain', cut: 'coronal', pos: '-2', view: 'anterior', cortex: '0', cam: '-19,25,-53,-19,25,2' };
// The agreement of the two segmentations of one aseg structure, inked on the coronal plane of Linked MRI.
const agreement = (label, pos, crop) => ({
  ...cut('coronal', pos, 'anterior', { detail: 'aseg', region: `aseg:left:${label}`, cortex: '0' }),
  steps: [...research('Segmentation agreement'), ['click', 'button', 'Show on linked MRI']], mri: 'coronal', crop, enlarge: 16,
});
const layerPaint = [['css', '#inspector summary:has-text("Layers (one histological brain)")'], ['click', 'button', 'Paint layer IV across the cortex']];
const hippocampus = { atlas: 'desikan', detail: 'aseg', region: 'aseg:left:17' };
const disorder = [...research('In disorders'), ['css', '#inspector .evidence-section :is(button, tr, li):has-text("Schizophrenia")']];
const connectivity = [...research('Functional connectivity'), ['click', 'button', 'Paint on the brain']];
const HIDE_TOOLBAR = ['style', '.stage-toolbar>.popover-host>button{visibility:hidden!important}'];
const VIEW_3D = ['css', '.mpr-dock .mpr-overlay [role="radio"]:has-text("3D view")'];
const putamen = { region: 'learning:left:putamen' };

/** Maps opened in the Overlay tool. A map with a url is downloaded; the other is written by figure_plots.py. */
export const MAPS = {
  // HCP motor task, right hand minus the average of all movements: group z, 486 people (NeuroVault image 3161).
  'hcp-motor': { url: 'https://neurovault.org/media/images/457/tfMRI_MOTOR_RH-AVG_zstat1.nii.gz' },
  // Three Gaussian blobs over smoothed noise in MNI152NLin2009cAsym, whose peaks and clusters are known.
  synthetic: { file: 'zstat1.nii.gz' },
};

// The Overlay tool is one of Add's choices. HCP volumes are in FSL's MNI152, which the tool offers only as
// an unstated MNI template.
const openMap = (map, space, threshold, max) => [
  ['click', 'button', 'Add'], ['click', 'radio', 'Overlay'],
  ['select', '.overlay select', space], ['file', '.overlay input[type=file]', map],
  ['fill', '.overlay input[id^="overlay-threshold"]', threshold],
  ...(max ? [['fill', '.overlay input[id^="overlay-max"]', max]] : []),
  ['blur', '.overlay input[id^="overlay-threshold"]'], ['attached', '#stage-keys li'],
];
const synthetic = openMap('synthetic', 'mni152nlin2009casym', '3.1');
const hcp = (state, extra, after = [['press', 'Escape']]) => stage({ colors: 'mri', ...state }, {
  map: 'hcp-motor', steps: [...openMap('hcp-motor', 'unstated', '10', '25'), ...after], link: false, ...extra,
});

export const FIGURES = [
  {
    name: 'overview', to: 'readme', also: ['docs/index.md'], aspect: 1.36, grid: [[0, 0, 2, 2], [2, 0, 1, 1], [2, 1, 1, 1]],
    panels: [
      stage({ ...nextbrain, view: 'anterior', explode: '1' }),
      tracts('left', 'af-left,cst-left'),
      surface({ atlas: 'hcp-mmp', tab: 'functions', function: 'language' }, { keys: true }),
    ],
  },
  {
    name: 'cortex', to: 'readme', columns: 3, aspect: 1.3, sameScale: true,
    panels: [
      surface({}),
      surface({ atlas: 'hcp-mmp' }),
      surface({ atlas: 'julich' }),
      surface({ atlas: 'schaefer' }),
      surface({ atlas: 'hcp-mmp', colors: 'cab-np' }),
      surface({ colors: 'territory' }),
    ],
  },
  {
    name: 'sections', to: 'readme', columns: 3, aspect: 1, sameScale: true,
    panels: [
      cut('sagittal', '-20', 'right'),
      cut('coronal', '-20', 'anterior'),
      cut('axial', '12', 'superior'),
      mri('sagittal', '-20', 'right', {}, { link: false }),
      mri('coronal', '-20', 'anterior', {}, { link: false }),
      mri('axial', '12', 'superior', {}, { link: false }),
    ],
  },
  {
    name: 'tracts', to: 'readme', columns: 3, aspect: 1, sameScale: true,
    panels: [
      tracts('left', 'slf1-left,slf2-left,slf3-left'),
      tracts('anterior', 'cst-left,cst-right'),
      tracts('superior', 'callosum-1,callosum-2,callosum-3,callosum-4,callosum-5,callosum-6,callosum-7'),
    ],
  },
  {
    name: 'evidence', to: 'readme', columns: 3, aspect: 1.05,
    panels: [
      stage({ atlas: 'hcp-mmp', tab: 'functions', function: 'spatial-attention', view: 'right' }, { keys: true }),
      stage({ tab: 'deficits', deficit: 'neglect', view: 'right' }, { keys: true }),
      stage({ region: 'destrieux:left:4', cases: 'M2295,M2272' }, { keys: true }),
    ],
  },
  {
    name: 'overlay', to: 'readme', aspect: 1.15,
    grid: [[0, 0, 1, 1], [1, 0, 1, 1], [0, 1, 1, 1], [1, 1, 1, 1], [2, 0, 1, 2]],
    panels: [
      hcp({ view: 'left' }, { keys: true }),
      hcp({ cut: 'sagittal', pos: '18', view: 'right' }),
      hcp({ cut: 'coronal', pos: '-22', view: 'anterior' }),
      hcp({ cut: 'coronal', pos: '-22', view: 'anterior' }, { mri: 'coronal', steps: [...openMap('hcp-motor', 'unstated', '10', '25'), ['press', 'Escape'], ['click', 'button', 'Linked MRI']] }),
      hcp({ view: 'left' }, { shot: '.overlay .stage-field:has(.peaks)', pad: 10 }, [['match', '^Clusters and peaks'], ['shown', '.overlay .peaks'], HIDE_TOOLBAR]),
    ],
  },
  {
    name: 'template', to: 'readme', columns: 3, aspect: 1.3, sameScale: true,
    panels: [
      surface({}),
      surface({ anatomy: 'mni152' }),
      { state: { ...template, tab: 'diffusion', view: 'left', opacity: '0.16', tracts: 'af-left,cst-left' } },
    ],
  },

  // The methods pages.
  {
    name: 'sections-and-cuts-1', to: 'docs', columns: 3, aspect: 1.15, sameScale: true,
    panels: [
      cut('sagittal', '-26', 'right'),
      cut('coronal', '-20', 'anterior'),
      cut('axial', '8', 'superior'),
      stage({ cut: 'oblique' }),
      cut('coronal', '-20', 'anterior', { detail: 'nextbrain' }),
      cut('coronal', '-20', 'anterior', { colors: 'territory' }),
    ],
  },
  {
    name: 'cortical-atlases-1', to: 'docs', columns: 6, aspect: 0.63, sameScale: true,
    grid: [[0, 0, 2, 1], [2, 0, 2, 1], [4, 0, 2, 1], [1, 1, 2, 1], [3, 1, 2, 1]],
    panels: ['destrieux', 'desikan', 'hcp-mmp', 'julich', 'schaefer'].map((atlas) => lateral({ atlas })),
  },
  {
    name: 'functional-networks-1', to: 'docs', columns: 2, aspect: 1.45, sameScale: true,
    panels: [
      lateral({ atlas: 'hcp-mmp', colors: 'network' }, { keys: true }),
      lateral({ atlas: 'hcp-mmp', colors: 'cab-np' }, { keys: true }),
      lateral({ atlas: 'hcp-mmp', colors: 'network', view: 'right' }),
      lateral({ atlas: 'hcp-mmp', colors: 'cab-np', view: 'right' }),
    ],
  },
  {
    name: 'tracts-1', to: 'docs', columns: 2, aspect: 1.35, sameScale: true,
    panels: [
      stage({ tab: 'diffusion', view: 'left', opacity: '0.16' }),
      stage({ tab: 'diffusion', view: 'anterior', opacity: '0.16' }),
      tracts('superior', 'callosum-1,callosum-2,callosum-3,callosum-4,callosum-5,callosum-6,callosum-7'),
      tracts('left', 'slf1-left,slf2-left,slf3-left'),
    ],
  },
  {
    name: 'tracts-2', to: 'docs', columns: 2, aspect: 1.35, sameScale: true,
    panels: [
      stage({ anatomy: 'mni152', tab: 'diffusion', view: 'left', opacity: '0.16' }),
      stage({ anatomy: 'mni152', tab: 'diffusion', view: 'anterior', opacity: '0.16' }),
      tracts('superior', 'cc-1', { anatomy: 'mni152' }),
      tracts('left', 'slf1-left,slf2-left,slf3-left', { anatomy: 'mni152' }),
    ],
  },
  {
    name: 'arterial-territories-1', to: 'docs', columns: 2, aspect: 1.45, key: 0,
    panels: [
      lateral({ colors: 'territory' }, { keys: true }),
      lateral({ colors: 'territory', view: 'right' }),
      cut('axial', '24', 'superior', { colors: 'territory' }),
      cut('coronal', '-12', 'anterior', { colors: 'territory' }),
    ],
  },
  {
    name: 'dissection-and-display-1', to: 'docs', columns: 4, aspect: 1.25,
    panels: [
      surface({ colors: 'tissue' }),
      surface({ colors: 'mri' }),
      surface({}),
      surface({ colors: 'network' }),
      surface({ colors: 'territory' }),
      surface({ hidden: [15, 28, 29, 45, 53, 67, 68, 69].map((index) => `destrieux:left:${index}`).join(',') }),
      surface({ isolate: 'learning:left:hippocampus' }),
      surface({ region: 'learning:left:hippocampus', focus: '1' }),
    ],
  },
  {
    name: 'circuits-1', to: 'docs', columns: 3, aspect: 1.1,
    panels: [
      stage({ region: 'learning:lobule-v-left', view: 'posterior', cam: '-22.5,-3.8,175.6,-17.8,-3.9,31.5', hemi: 'left', cortex: '0', tab: 'circuits', circuit: 'cerebellar' }),
      stage({
        hidden: 'learning:crus-i-left,learning:crus-ii-left,learning:lobule-ix-left,learning:lobule-v-left,learning:lobule-vi-left,learning:lobule-viib-left,learning:lobule-viiia-left,learning:lobule-viiib-left,learning:lobule-x-left,learning:lobules-i-iv-left',
        region: 'learning:left:dentate', focus: '1', view: 'posterior', cam: '-22.8,-15.3,189.6,-17.8,-15.5,34.6', hemi: 'left', cortex: '0', tab: 'circuits', circuit: 'cerebellar', step: '2',
      }),
      stage({
        hidden: 'learning:right:midbrain,learning:right:vta', region: 'learning:right:red-nucleus', focus: '1', view: 'left',
        cam: '-149.6,17.5,2.6,3.2,10.6,7.6', hemi: 'right', cortex: '0', tab: 'circuits', circuit: 'cerebellar', step: '4',
      }),
    ],
  },
  {
    name: 'mni-template-1', to: 'docs', columns: 3, aspect: 1.15, sameScale: true,
    panels: [
      surface({}),
      cut('coronal', '-12', 'anterior'),
      mri('coronal', '-12', 'anterior', {}, { link: false }),
      surface({ anatomy: 'mni152' }),
      cut('coronal', '-1', 'anterior', { anatomy: 'mni152' }),
      mri('coronal', '-1', 'anterior', { anatomy: 'mni152' }, { link: false }),
    ],
  },
  {
    name: 'cerebellar-functions-1', to: 'docs', columns: 2, aspect: 1.3,
    panels: [
      cut('sagittal', '-25', 'right', { colors: 'cerebellar', cam: '110,-30,45,-25,-30,45' }),
      cut('axial', '-28', 'superior', { colors: 'cerebellar', cam: '0,110,45,0,-28,45,0,0,-1' }),
    ],
  },
  {
    name: 'striatal-networks-1', to: 'docs', columns: 2, aspect: 1.3, key: 1,
    panels: [
      cut('coronal', '12', 'anterior', { colors: 'striatal', cam: '0,14,-185,0,14,-12' }),
      cut('coronal', '12', 'anterior', { colors: 'network', cam: '0,14,-185,0,14,-12' }, { keys: true }),
    ],
  },
  {
    name: 'internal-anatomy-1', to: 'docs', columns: 3, aspect: 1.2, sameScale: true,
    panels: ['learning', 'aseg', 'nextbrain'].map((detail) => cut('coronal', '-2', 'anterior', { detail, cortex: '0', cam: '0,18,-170,0,18,2' })),
  },
  {
    name: 'lesion-report-1', to: 'docs', columns: 3, aspect: 0.98,
    grid: [[0, 0, 1, 1], [1, 0, 1, 1], [2, 0, 1, 2], [0, 1, 1, 1], [1, 1, 1, 1]],
    panels: [
      surface({ colors: 'tissue', lesion }),
      cut('coronal', '-25', 'anterior', { lesion }),
      panel(surface({ colors: 'tissue', lesion })),
      surface({ colors: 'tissue', lesion }, { steps: [['click', 'radio', 'Functions']], keys: true, link: false }),
      surface({ colors: 'tissue', lesion }, { steps: [['click', 'radio', 'Deficits']], keys: true, link: false }),
    ],
  },
  {
    name: 'published-coordinates-1', to: 'docs', columns: 5, aspect: 0.572, grid: SIDE,
    panels: [
      stage(coordinate),
      cut('coronal', '23.4', 'anterior', coordinate),
      panel(stage(coordinate), [], { rows: [0, 775] }),
    ],
  },
  {
    name: 'deficits-1', to: 'docs', columns: 5, aspect: 0.572, grid: SIDE,
    panels: [
      stage({ tab: 'deficits', deficit: 'neglect', view: 'right' }, { keys: true }),
      stage({ tab: 'deficits', deficit: 'neglect', view: 'right' }, { steps: [['click', 'button', 'Show 2 deep structures']], keys: true, link: false }),
      panel(stage({ tab: 'deficits', deficit: 'neglect', view: 'right' }), [['css', '#inspector summary:has-text("Neglect after basal ganglia")']], {
        shot: 'xpath=//*[@id="inspector"]//summary[contains(., "Neglect after basal ganglia")]/ancestor::details[1]/..', rows: [0, 926],
      }),
    ],
  },
  {
    name: 'functions-1', to: 'docs', columns: 5, aspect: 0.572, grid: [[0, 0, 3, 1], [3, 0, 2, 2], [0, 1, 3, 1]],
    panels: [
      surface({ atlas: 'hcp-mmp', tab: 'functions', function: 'language' }, { keys: true }),
      panel(surface({ atlas: 'hcp-mmp', tab: 'functions', function: 'language' }), [], { rows: [0, 879] }),
      surface({ atlas: 'hcp-mmp', tab: 'functions', function: 'all' }, { keys: true }),
    ],
  },
  {
    name: 'stimulation-responses-1', to: 'docs', columns: 5, aspect: 0.44, grid: [[0, 0, 2, 1], [2, 0, 3, 1]],
    panels: [
      panel(surface({ region: 'destrieux:left:14' }), research('Stimulation responses'), { shot: section('Stimulation responses'), rows: [0, 528] }),
      surface({ region: 'destrieux:left:14' }),
    ],
  },
  {
    name: 'stroke-cases-1', to: 'docs', columns: 5, aspect: 0.56, grid: [[0, 0, 2, 1], [2, 0, 3, 1]],
    panels: [
      panel(surface({ region: 'destrieux:left:4', cases: 'M2295,M2272' }), research('Stroke cases'), { shot: section('Stroke cases'), rows: [0, 412] }),
      surface({ region: 'destrieux:left:4', cases: 'M2295,M2272' }, { keys: true }),
    ],
  },
  {
    name: 'receptor-fingerprints-1', to: 'docs', columns: 7, aspect: 0.4, grid: [[0, 0, 3, 1], [3, 0, 2, 2], [0, 1, 3, 1], [5, 0, 2, 2]],
    panels: [
      surface({ atlas: 'julich', region: 'julich:left:2', focus: '1' }),
      panel(surface({ atlas: 'julich', region: 'julich:left:2', focus: '1' }), [...research('Receptor densities'), ['click', 'radio', 'Ventral']], { shot: section('Receptor densities'), rows: [0, 850] }),
      surface({ atlas: 'julich', region: 'learning:left:putamen', focus: '1' }),
      panel(surface({ atlas: 'julich', region: 'learning:left:putamen', focus: '1' }), research('Receptor densities'), { shot: section('Receptor densities'), rows: [0, 782] }),
    ],
  },
  {
    name: 'atlas-comparison-1', to: 'docs', columns: 2, aspect: 1.45,
    panels: [
      lateral({ region: 'destrieux:left:29' }),
      lateral({ atlas: 'hcp-mmp', region: 'hcp-mmp:left:8' }),
      panel(lateral({ region: 'destrieux:left:29' }), research('Overlap with HCP-MMP'), { shot: section('Overlap with HCP-MMP') }),
      lateral({ region: 'destrieux:left:29' }, { steps: [...research('Overlap with HCP-MMP'), ['css', '#inspector .comparison :is(button, tr, li):has-text("447")']], link: false }),
    ],
  },
  {
    name: 'linked-mri-1', to: 'docs', columns: 2, aspect: 0.652,
    panels: [[], [['css', '.mpr-dock .mpr-overlay [role="radio"]:has-text("Segmentation")']]].map((steps, index) => ({
      ...cut('coronal', '-10', 'anterior'), steps: [['click', 'button', 'Linked MRI'], ...steps],
      shot: '.mpr-dock', contain: true, scale: 3, viewport: [1900, 1000], link: index === 0,
    })),
  },
  {
    // The eleven axial sections and one plane under the 3D view's colours, the left putamen selected.
    name: 'linked-mri-2', to: 'docs', columns: 2, aspect: 1.16,
    panels: [
      { ...cut('coronal', '-10', 'anterior', putamen), steps: [['click', 'button', 'Linked MRI'], ['click', 'radio', 'Serial sections'], VIEW_3D], shot: '.mpr-dock .series', viewport: [1600, 1000] },
      mri('coronal', '-10', 'anterior', putamen, { steps: [['click', 'button', 'Linked MRI'], VIEW_3D], link: false, crop: [0.27, 0.11, 0.73, 0.57], enlarge: 8 }),
    ],
  },
  {
    name: 'boundary-certainty-1', to: 'docs', columns: 2, aspect: 1.34,
    panels: [
      stage({ ...thalamus, region: 'nextbrain:left:283' }),
      stage({ ...thalamus, region: 'nextbrain:left:79' }),
      panel(stage({ ...thalamus, region: 'nextbrain:left:283' }), research('Boundary certainty'), { shot: section('Boundary certainty') }),
      { plot: 'boundary-shares' },
    ],
  },
  {
    name: 'segmentation-agreement-1', to: 'docs', columns: 3, aspect: 1,
    panels: [
      agreement('18', '10', [0.531, 0.414, 0.648, 0.531]),
      agreement('10', '-16', [0.485, 0.335, 0.625, 0.475]),
      { plot: 'segmentation-dice' },
    ],
  },
  {
    name: 'registration-landing-1', to: 'docs', columns: 2, aspect: 1.45,
    panels: [{ plot: 'landing' }, { plot: 'template-dice' }],
  },
  {
    name: 'cortical-layers-1', to: 'docs', columns: 2, aspect: 1.45,
    panels: [
      lateral({ atlas: 'hcp-mmp', region: 'hcp-mmp:left:8' }, { steps: layerPaint, keys: true }),
      lateral({ atlas: 'hcp-mmp', region: 'hcp-mmp:left:1', view: 'right' }, { steps: layerPaint, keys: true }),
      panel(lateral({ atlas: 'julich', region: 'julich:left:8' }), [layerPaint[0]], { shot: section('Layers (one histological brain)') }),
      { plot: 'layer-iv' },
    ],
  },
  {
    name: 'cortical-thickness-1', to: 'docs', columns: 2, aspect: 1.45, sameScale: true, key: 0,
    panels: [lateral({ colors: 'thickness' }, { keys: true }), lateral({ colors: 'thickness', view: 'right' })],
  },
  {
    // The cortex surface is not written to a link, so the white surface is chosen as a reader chooses it.
    name: 'sulcal-depth-1', to: 'docs', columns: 2, aspect: 1.45, sameScale: true, key: 0,
    panels: [
      lateral({ colors: 'sulc' }, { keys: true }),
      lateral({ colors: 'sulc' }, {
        steps: [['click', 'button', 'Display'], ['select', 'select[id^="display-surface"]', 'white'], ['press', 'Escape']], link: false,
      }),
    ],
  },
  {
    name: 'disorder-effects-1', to: 'docs', columns: 5, aspect: 0.572, grid: SIDE, key: 0,
    panels: [
      surface({ ...hippocampus }, { steps: disorder, keys: true }),
      surface({ ...hippocampus, cortex: '0' }, { steps: disorder }),
      panel(surface({ ...hippocampus }), disorder, { shot: section('In disorders') }),
    ],
  },
  { name: 'disorder-effects-2', to: 'docs', columns: 1, aspect: 2.9, panels: [{ plot: 'disorder-effects' }] },
  {
    name: 'functional-connectivity-1', to: 'docs', columns: 5, aspect: 0.6, grid: [[0, 0, 3, 1], [3, 0, 2, 2], [0, 1, 3, 1]],
    panels: [
      stage({ atlas: 'julich', region: 'julich:left:48', view: 'superior', internal: '0' }, { steps: connectivity, keys: true }),
      panel(stage({ atlas: 'julich', region: 'julich:left:48', view: 'superior', internal: '0' }), connectivity, { shot: section('Functional connectivity') }),
      { plot: 'connectivity-r' },
    ],
  },
  {
    // The matrix opens from the Yeo networks' key, which every capture hides, so the key is shown for the click.
    name: 'functional-connectivity-2', to: 'docs', columns: 1, aspect: 2400 / 1560,
    panels: [surface({ colors: 'network' }, {
      shot: 'dialog[open]', viewport: [1600, 1000],
      steps: [['style', '#stage-keys{display:flex!important}'], ['click', 'button', 'Correlation matrix'], ['shown', '.matrix-table']],
    })],
  },
  {
    name: 'functional-divisions-1', to: 'docs', columns: 5, aspect: 0.532, grid: [[0, 0, 3, 1], [3, 0, 2, 1], [0, 1, 5, 1]],
    panels: [
      lateral({ atlas: 'hcp-mmp', region: 'hcp-mmp:left:38', view: 'right' }),
      panel(lateral({ atlas: 'hcp-mmp', region: 'hcp-mmp:left:38', view: 'right' }), [['css', '#inspector summary:has-text("Functional division")']], { shot: section('Functional division') }),
      { plot: 'division-matrix' },
    ],
  },
  {
    name: 'spinal-cord-1', to: 'docs', columns: 2, aspect: 1.3,
    panels: [
      stage({ cord: '1', cortex: '0', cam: '-4,-62,-210,-4,-62,22,0,1,0' }),
      stage({ cord: '1', cut: 'sagittal', pos: '-4', view: 'right', cam: '150,-62,22,-4,-62,22' }),
      stage({ cord: '1', cortex: '0', system: 'Spinal cord', cut: 'axial', pos: '-87', cam: '-4,-63,24.5,-4,-87,24.5,0,0,-1' }),
      stage({ cord: '1', cortex: '0', system: 'Spinal cord', cut: 'axial', pos: '-87', cam: '-4,-63,24.5,-4,-87,24.5,0,0,-1', colors: 'mri' }),
    ],
  },
  {
    name: 'visual-field-map-1', to: 'docs', columns: 5, aspect: 0.44, grid: [[0, 0, 2, 1], [2, 0, 3, 1], [0, 1, 2, 1], [2, 1, 3, 1]],
    panels: ['4,3,1.5', '-4,-3,1.5'].flatMap((dot) => {
      const field = stage({ tab: 'circuits', map: 'visual-field', view: 'right', internal: '0', dot });
      return [panel(field, [], { shot: '#inspector .visual-field', rows: [182, 778], zoom: 1.72 }), field];
    }),
  },
  {
    name: 'overlays-1', to: 'docs', columns: 5, aspect: 0.572, grid: SIDE,
    panels: [
      surface({}, { map: 'synthetic', steps: [...synthetic, ['press', 'Escape']], keys: true }),
      cut('coronal', '23.4', 'anterior', {}, { map: 'synthetic', steps: [...synthetic, ['press', 'Escape']] }),
      surface({}, {
        map: 'synthetic', link: false, shot: '.overlay', pad: 10,
        steps: [...synthetic, ['css', '.overlay summary:has-text("Clusters and peaks")'], ['shown', '.overlay .peaks'], HIDE_TOOLBAR],
      }),
    ],
  },
  {
    // A 1,200 px stage saved at 2x is the figure's own 2,400 px, so the saved image is shown pixel for pixel.
    name: 'sharing-and-snapshots-1', to: 'docs', columns: 1, aspect: 2400 / 1640,
    panels: [{
      ...cut('coronal', '-20', 'anterior'), shot: 'download', viewport: [1560, 900], scale: 1,
      steps: [['click', 'button', 'Save image (PNG)']], download: ['click', 'button', 'Save at 2×'], file: 'planum-destrieux-anterior-coronal.png',
    }],
  },
  {
    name: 'arousal-nuclei-1', to: 'docs', columns: 2, aspect: 1.3, sameScale: true,
    panels: [['left', '-110,-5,12,0,-5,12'], ['posterior', '0,-5,122,0,-5,12']].map(([view, cam]) => stage({
      cortex: '0', system: 'Brainstem', view, cam,
      hidden: ['caudal-medulla', ...['left', 'right'].flatMap((side) => ['inferior-colliculus', 'medulla', 'midbrain', 'pons', 'red-nucleus', 'vta'].map((name) => `${side}:${name}`))].map((id) => `learning:${id}`).join(','),
    })),
  },
];
