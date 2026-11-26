// The body map panel's wording, fetched with the panel (BUILD-15); its name is in `bodyMap`.
import type { BodyPart } from '../../../types/index.ts';

const area = (value: number) => `${Math.round(value).toLocaleString('en')} mm²`;
const aire = (value: number) => `${Math.round(value).toLocaleString('fr')} mm²`;
const span = (low: number, high: number, separator: string) => {
  const [a, b] = [Math.round(low * 100), Math.round(high * 100)];
  return a === b ? `${a}` : `${a}${separator}${b}`;
};

export const en = {
  intro:
    'Where moving the foot, the hand or the tongue raises activity most along the central strip, in 486 adults of the Human Connectome Project. Each hemisphere maps the opposite foot and hand, and both map the tongue.',
  part: 'Part shown',
  all: 'All',
  parts: { foot: 'Foot', hand: 'Hand', tongue: 'Tongue' } satisfies Record<BodyPart, string>,
  table: 'Area on the strip',
  partColumn: 'Part',
  side: (side: 'left' | 'right'): string =>
    side === 'left' ? 'Left hemisphere' : 'Right hemisphere',
  area,
  sides: 'The left hemisphere maps the right foot and hand, the right hemisphere the left.',
  limits: 'What the map leaves out',
  group: (people: number) =>
    `A group average of ${people} other adults, carried onto this brain through its folding: not what this brain does.`,
  floor: (d: number) =>
    `A vertex is coloured where one movement wins with at least a medium effect (Cohen’s d ≥ ${d}); the rest of the strip stays grey.`,
  strip: (low: number, high: number) =>
    `Only the central strip is drawn. Moving the foot also raises activity well beyond it, in the supplementary motor area, the cingulate cortex and the parietal lobe: ${span(low, high, '–')}% of the foot’s map at that effect lies off the strip.`,
  sensorimotor:
    'At the group maps’ 2 mm resolution motor and sensory cortex cannot be told apart: each patch spans both banks of the central sulcus.',
  five: 'Five movements only: the trunk, single fingers and the face beyond the tongue were not tested.',
  sources: 'Sources',
  dataset: 'HCP motor task, group maps (NeuroVault 457)',
  task: 'Barch et al. 2013, the HCP task battery',
  project: 'Van Essen et al. 2013, the Human Connectome Project',
  registration: 'Wu et al. 2018, MNI to surface registration',
};

export const fr: typeof en = {
  intro:
    'Là où bouger le pied, la main ou la langue augmente le plus l’activité le long de la bande centrale, chez 486 adultes du Human Connectome Project. Chaque hémisphère représente le pied et la main opposés, et tous deux la langue.',
  part: 'Partie affichée',
  all: 'Toutes',
  parts: { foot: 'Pied', hand: 'Main', tongue: 'Langue' },
  table: 'Aire sur la bande',
  partColumn: 'Partie',
  side: (side) => (side === 'left' ? 'Hémisphère gauche' : 'Hémisphère droit'),
  area: aire,
  sides:
    'L’hémisphère gauche représente le pied et la main droits, l’hémisphère droit les gauches.',
  limits: 'Ce que la carte laisse de côté',
  group: (people) =>
    `Une moyenne de groupe de ${people} autres adultes, portée sur ce cerveau par ses plissements : ce n’est pas ce que fait ce cerveau.`,
  floor: (d) =>
    `Un sommet est coloré là où un mouvement l’emporte avec un effet au moins moyen (d de Cohen ≥ ${String(d).replace('.', ',')}) ; le reste de la bande reste gris.`,
  strip: (low, high) =>
    `Seule la bande centrale est dessinée. Bouger le pied augmente aussi l’activité bien au-delà, dans l’aire motrice supplémentaire, le cortex cingulaire et le lobe pariétal : ${span(low, high, '–')} % de la carte du pied à cet effet se trouve hors de la bande.`,
  sensorimotor:
    'À la résolution de 2 mm des cartes de groupe, le cortex moteur et le cortex sensitif ne se distinguent pas : chaque plage couvre les deux berges du sillon central.',
  five: 'Cinq mouvements seulement : le tronc, les doigts un à un et le visage au-delà de la langue n’ont pas été testés.',
  sources: 'Sources',
  dataset: 'Tâche motrice du HCP, cartes de groupe (NeuroVault 457)',
  task: 'Barch et al. 2013, la batterie de tâches du HCP',
  project: 'Van Essen et al. 2013, le Human Connectome Project',
  registration: 'Wu et al. 2018, recalage du MNI vers la surface',
};
