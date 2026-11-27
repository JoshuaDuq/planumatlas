import type { Language } from '../../types/index.ts';

type Names = Record<Language, string[]>;

const PRIMARY_VISUAL: Names = {
  en: ['primary visual cortex', 'striate cortex'],
  fr: ['cortex visuel primaire', 'cortex strié'],
};
const PRIMARY_MOTOR: Names = {
  en: ['primary motor cortex', 'M1'],
  fr: ['cortex moteur primaire', 'M1'],
};
const PRIMARY_SOMATOSENSORY: Names = {
  en: ['primary somatosensory cortex', 'S1'],
  fr: ['cortex somatosensoriel primaire', 'cortex somesthésique primaire', 'S1'],
};
const PRIMARY_AUDITORY: Names = {
  en: ['primary auditory cortex', 'A1'],
  fr: ['cortex auditif primaire', 'A1'],
};
const BROCA: Names = { en: ["Broca's area"], fr: ['aire de Broca'] };

const brodmann = (area: number): Names => ({
  en: [`Brodmann area ${area}`, `Brodmann ${area}`, `BA ${area}`, `BA${area}`],
  fr: [`aire de Brodmann ${area}`, `Brodmann ${area}`, `BA ${area}`, `BA${area}`],
});

/**
 * Classical names of the areas HCP-MMP and Julich-Brain each draw as one of their own: the
 * primary sensory and motor areas and Broca's areas 44 and 45, keyed by HCP-MMP code and by
 * Julich-Brain name. Search aliases only; gyral atlases get none, a gyrus not being an area.
 */
const CLASSICAL_NAMES: Record<'hcp-mmp' | 'julich', Record<string, Names[]>> = {
  'hcp-mmp': {
    V1: [PRIMARY_VISUAL, brodmann(17)],
    '4': [PRIMARY_MOTOR, brodmann(4)],
    '3a': [PRIMARY_SOMATOSENSORY, brodmann(3)],
    '3b': [PRIMARY_SOMATOSENSORY, brodmann(3)],
    '1': [PRIMARY_SOMATOSENSORY, brodmann(1)],
    '2': [PRIMARY_SOMATOSENSORY, brodmann(2)],
    A1: [PRIMARY_AUDITORY],
    '44': [BROCA, brodmann(44)],
    '45': [BROCA, brodmann(45)],
  },
  julich: {
    'Area hOc1 (V1, 17, CalcS)': [PRIMARY_VISUAL, brodmann(17)],
    'Area 4a (PreCG)': [PRIMARY_MOTOR, brodmann(4)],
    'Area 4p (PreCG)': [PRIMARY_MOTOR, brodmann(4)],
    'Area 3a (PostCG)': [PRIMARY_SOMATOSENSORY, brodmann(3)],
    'Area 3b (PostCG)': [PRIMARY_SOMATOSENSORY, brodmann(3)],
    'Area 1 (PostCG)': [PRIMARY_SOMATOSENSORY, brodmann(1)],
    'Area 2 (PostCS)': [PRIMARY_SOMATOSENSORY, brodmann(2)],
    'Area Te 1.0 (HESCHL)': [PRIMARY_AUDITORY],
    'Area Te 1.1 (HESCHL)': [PRIMARY_AUDITORY],
    'Area Te 1.2 (HESCHL)': [PRIMARY_AUDITORY],
    'Area 44 (IFG)': [BROCA, brodmann(44)],
    'Area 45 (IFG)': [BROCA, brodmann(45)],
  },
};

/** The classical names an HCP-MMP code or Julich-Brain name answers to, none for any other. */
export const classicalNames = (atlas: 'hcp-mmp' | 'julich', key: string, lang: Language) =>
  (CLASSICAL_NAMES[atlas][key] ?? []).flatMap((names) => names[lang]);
