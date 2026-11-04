const degrees = (value: number) =>
  `${Number.isInteger(value) || value >= 10 ? value.toFixed(0) : value.toFixed(1)}°`;
const degrés = (value: number) => degrees(value).replace('.', ',');
const area = (value: number) => `${value < 10 ? value.toFixed(1) : Math.round(value)} mm²`;
const aire = (value: number) => area(value).replace('.', ',');

type Vertical = 'upper' | 'lower' | null;
type Horizontal = 'left' | 'right' | null;

export const en = {
  guided: 'Guided circuits',
  maps: 'Maps',
  name: 'Visual field map',
  summary: 'Visual field ↔ V1, V2, V3, predicted',
  mapCount: (count: number) => `${count} ${count === 1 ? 'map' : 'maps'}`,
  intro:
    'Move the dot across the visual field to see the cortex predicted to represent it. Click V1, V2 or V3 on the brain to see which part of the field it is predicted to respond to.',
  disc: 'Visual field, fixation at the centre, eccentricity on a log scale',
  dot: 'Dot',
  dotRole: 'two-dimensional slider',
  dotKeys: 'Arrow keys move the dot; with Shift, further.',
  size: 'Dot radius',
  ring: (value: number) => degrees(value),
  measuredRing: (value: number) => `${degrees(value)}, edge of the measured field`,
  place: (eccentricity: number, vertical: Vertical, horizontal: Horizontal) => {
    if (eccentricity === 0) return 'At fixation';
    const where =
      vertical && horizontal
        ? `${vertical} ${horizontal}`
        : vertical
          ? `${vertical} vertical meridian`
          : `${horizontal} horizontal meridian`;
    return `${degrees(eccentricity)} from fixation, ${where}`;
  },
  radius: (value: number) => `radius ${degrees(value)}`,
  hemisphere: (side: 'left' | 'right' | null) =>
    side
      ? `Represented in the ${side} hemisphere, shown from the midline.`
      : 'On the vertical meridian: both hemispheres represent it.',
  territory: 'Predicted territory',
  territoryNote:
    'Cortex whose predicted receptive-field centre lies inside the dot, measured on the midthickness surface.',
  territoryArea: (value: number) => area(value),
  sideHeading: (side: 'left' | 'right'): string => (side === 'left' ? 'Left' : 'Right'),
  noTerritory: 'No vertex’s predicted centre lies inside the dot; make it larger.',
  extrapolated: (measured: number) =>
    `Part of the dot lies beyond ${degrees(measured)}, past the HCP stimulus: the template extrapolates there.`,
  legendCore: 'Receptive-field centre inside the dot',
  legendReach: 'Receptive field within one σ of the dot',
  legendLine: (measured: number) => `${degrees(measured)}: edge of the measured field`,
  legendAreas: 'V1, V2, V3 from lightest to darkest',
  reading: 'Clicked cortex',
  readingValue: (name: string, side: 'left' | 'right', place: string, sigma: number) =>
    `${side === 'left' ? 'Left' : 'Right'} ${name}: ${place.charAt(0).toLowerCase()}${place.slice(1)}, receptive field σ ${degrees(sigma)}. The dot now shows it.`,
  readingNone: 'That point is outside V1–V3, where the template predicts nothing.',
  clickHint: 'Click V1, V2 or V3 on the brain to read it.',
  loading: 'Loading the territories…',
  loadFailed: 'The territories could not be loaded.',
  provenance:
    'Predicted from this brain’s folding by the Benson template (v4.0), fitted to the group average of 181 HCP participants. No retinotopy was measured in this brain, and V1’s size varies about threefold between people.',
  agreement: (side: 'left' | 'right', hcp: number, julich: number) =>
    `In the ${side} hemisphere, predicted V1 overlaps HCP-MMP’s V1 at Dice ${hcp.toFixed(2)} and Julich-Brain’s hOc1 at ${julich.toFixed(2)}. HCP-MMP was drawn from HCP data too, so the first agreement is not independent.`,
  sources: 'Sources',
  dataset: 'HCP 7T retinotopy (Benson et al. 2018)',
  method: 'Template method (Benson et al. 2014)',
};

export const fr: typeof en = {
  guided: 'Parcours guidés',
  maps: 'Cartes',
  name: 'Carte du champ visuel',
  summary: 'Champ visuel ↔ V1, V2, V3, prédits',
  mapCount: (count: number) => `${count} ${count > 1 ? 'cartes' : 'carte'}`,
  intro:
    'Déplacez le point dans le champ visuel pour voir le cortex prédit pour le représenter. Cliquez sur V1, V2 ou V3 sur le cerveau pour voir à quelle partie du champ il répondrait.',
  disc: 'Champ visuel, fixation au centre, excentricité en échelle logarithmique',
  dot: 'Point',
  dotRole: 'curseur à deux dimensions',
  dotKeys: 'Les flèches déplacent le point\u202f; avec Maj, plus loin.',
  size: 'Rayon du point',
  ring: (value: number) => degrés(value),
  measuredRing: (value: number) => `${degrés(value)}, limite du champ mesuré`,
  place: (eccentricity: number, vertical: Vertical, horizontal: Horizontal) => {
    if (eccentricity === 0) return 'Au point de fixation';
    const haut = vertical === 'upper' ? 'supérieur' : 'inférieur';
    const côté = horizontal === 'left' ? 'gauche' : 'droit';
    const where =
      vertical && horizontal
        ? `quadrant ${haut} ${côté}`
        : vertical
          ? `méridien vertical ${haut}`
          : `méridien horizontal ${côté}`;
    return `${degrés(eccentricity)} de la fixation, ${where}`;
  },
  radius: (value: number) => `rayon ${degrés(value)}`,
  hemisphere: (side: 'left' | 'right' | null) =>
    side
      ? `Représenté dans l’hémisphère ${side === 'left' ? 'gauche' : 'droit'}, vu depuis la ligne médiane.`
      : 'Sur le méridien vertical\u202f: les deux hémisphères le représentent.',
  territory: 'Territoire prédit',
  territoryNote:
    'Cortex dont le centre prédit du champ récepteur se trouve dans le point, mesuré sur la surface médiane du cortex.',
  territoryArea: (value: number) => aire(value),
  sideHeading: (side: 'left' | 'right') => (side === 'left' ? 'Gauche' : 'Droit'),
  noTerritory: 'Aucun centre prédit ne se trouve dans le point\u202f; agrandissez-le.',
  extrapolated: (measured: number) =>
    `Une partie du point dépasse ${degrés(measured)}, au-delà du stimulus du HCP\u202f: le gabarit y extrapole.`,
  legendCore: 'Centre du champ récepteur dans le point',
  legendReach: 'Champ récepteur à moins d’un σ du point',
  legendLine: (measured: number) => `${degrés(measured)}\u202f: limite du champ mesuré`,
  legendAreas: 'V1, V2, V3, du plus clair au plus sombre',
  reading: 'Cortex cliqué',
  readingValue: (name: string, side: 'left' | 'right', place: string, sigma: number) =>
    `${name} ${side === 'left' ? 'gauche' : 'droit'}\u202f: ${place.charAt(0).toLowerCase()}${place.slice(1)}, champ récepteur σ ${degrés(sigma)}. Le point le montre maintenant.`,
  readingNone: 'Ce point est hors de V1–V3, où le gabarit ne prédit rien.',
  clickHint: 'Cliquez sur V1, V2 ou V3 sur le cerveau pour le lire.',
  loading: 'Chargement des territoires…',
  loadFailed: 'Les territoires n’ont pas pu être chargés.',
  provenance:
    'Prédit à partir des plissements de ce cerveau par le gabarit de Benson (v4.0), ajusté sur la moyenne de 181 participants du HCP. Aucune rétinotopie n’a été mesurée dans ce cerveau, et la taille de V1 varie d’environ un facteur trois d’une personne à l’autre.',
  agreement: (side: 'left' | 'right', hcp: number, julich: number) =>
    `Dans l’hémisphère ${side === 'left' ? 'gauche' : 'droit'}, V1 prédit recouvre le V1 de HCP-MMP avec un Dice de ${hcp.toFixed(2).replace('.', ',')} et l’hOc1 de Julich-Brain avec ${julich.toFixed(2).replace('.', ',')}. HCP-MMP provient lui aussi des données du HCP\u202f: le premier accord n’est pas indépendant.`,
  sources: 'Sources',
  dataset: 'Rétinotopie 7T du HCP (Benson et al. 2018)',
  method: 'Méthode du gabarit (Benson et al. 2014)',
};
