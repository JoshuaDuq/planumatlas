/**
 * The names the linked MRI gives its tissue labels (ui/chrome/sections.js:22-52). The orientation
 * letters it draws are the `orientation` area (sections.js:20 repeated it).
 */
export const en = {
  tissueNames: {
    Unknown: 'Unlabelled',
    '???': 'Unlabelled',
    'Left-Cerebral-White-Matter': 'Cerebral white matter',
    'Right-Cerebral-White-Matter': 'Cerebral white matter',
    'Left-Cerebral-Cortex': 'Left cerebral cortex',
    'Right-Cerebral-Cortex': 'Right cerebral cortex',
    CSF: 'Cerebrospinal fluid (CSF)',
    'Left-vessel': 'Cerebral vessel',
    'Right-vessel': 'Cerebral vessel',
    'WM-hypointensities': 'White matter hypointensities',
    ctx_lh_Medial_wall: 'Medial wall',
    ctx_rh_Medial_wall: 'Medial wall',
  },
};

export const fr: typeof en = {
  tissueNames: {
    Unknown: 'Non étiqueté',
    '???': 'Non étiqueté',
    'Left-Cerebral-White-Matter': 'Substance blanche cérébrale',
    'Right-Cerebral-White-Matter': 'Substance blanche cérébrale',
    'Left-Cerebral-Cortex': 'Cortex cérébral gauche',
    'Right-Cerebral-Cortex': 'Cortex cérébral droit',
    CSF: 'Liquide cérébro-spinal (LCS)',
    'Left-vessel': 'Vaisseau cérébral',
    'Right-vessel': 'Vaisseau cérébral',
    'WM-hypointensities': 'Hypointensités de la substance blanche',
    ctx_lh_Medial_wall: 'Paroi médiale',
    ctx_rh_Medial_wall: 'Paroi médiale',
  },
};
