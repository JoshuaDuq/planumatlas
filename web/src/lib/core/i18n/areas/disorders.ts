import type { KeyGround } from '../../../types/index.ts';
import type { DisorderMeasure } from '../../catalog/disorder-effects.ts';

const EN_AREAS: Record<KeyGround, string> = {
  tissue: 'Tissue-coloured regions',
  scan: 'Regions where the scan shows',
  grey: 'Grey regions',
};
const FR_AREAS: Record<KeyGround, string> = {
  tissue: 'Les régions couleur de tissu',
  scan: 'Les régions où l’examen apparaît',
  grey: 'Les régions grises',
};

// ENIGMA's case–control differences: the region sheet's section and the stage key.
export const en = {
  heading: 'In disorders',
  // The closed section's quiet value: how many disorders differ here.
  headingValue: (count: number) => (count === 1 ? '1 disorder' : `${count} disorders`),
  measure: {
    thickness: 'Cortical thickness, patients minus controls (Cohen’s\u00a0d)',
    volume: 'Volume, patients minus controls (Cohen’s\u00a0d)',
  } satisfies Record<DisorderMeasure, string>,
  direction: {
    thickness: { smaller: 'thinner', larger: 'thicker' },
    volume: { smaller: 'smaller', larger: 'larger' },
  } satisfies Record<DisorderMeasure, { smaller: string; larger: string }>,
  none: 'No disorder’s difference here survives its table’s false discovery rate.',
  // A row paints its disorder; said with the row's name.
  paint: (name: string) => `Paint ${name} on the brain`,
  shown: (name: string) => `On the brain: ${name}.`,
  cohort: (patients: string, controls: string) => `${patients} patients, ${controls} controls`,
  note: (rate: string) =>
    `Group differences from the ENIGMA consortium’s working groups, thousands of people scanned at many sites, adjusted for head size; only differences that survive each table’s ${rate} false discovery rate are listed. Most are small: patients and controls overlap almost entirely, so none says anything about one person.`,
  basis: {
    thickness:
      'Reported per Desikan-Killiany region, the atlas a painted disorder is shown on; not measured in this brain.',
    volume: 'Reported per FreeSurfer structure; not measured in this brain.',
  } satisfies Record<DisorderMeasure, string>,
  paper: 'Paper',
  toolbox: 'Data (ENIGMA Toolbox)',
  keyTitle: (name: string) => `${name}: patients minus controls`,
  // Numbers arrive formatted; a bound is kept on one line.
  step: {
    smallerStrong: (split: string) => `Thinner or smaller, d\u00a0≤\u00a0−${split}`,
    smaller: (split: string) => `Thinner or smaller, d\u00a0>\u00a0−${split}`,
    larger: (split: string) => `Thicker or larger, d\u00a0<\u00a0${split}`,
    largerStrong: (split: string) => `Thicker or larger, d\u00a0≥\u00a0${split}`,
  },
  keyNote: (rate: string, ground: KeyGround) =>
    `Cohen’s d where the difference survives a ${rate} false discovery rate. ${EN_AREAS[ground]} show none or are not reported.`,
};

export const fr: typeof en = {
  heading: 'Dans les troubles',
  headingValue: (count: number) => (count === 1 ? '1 trouble' : `${count} troubles`),
  measure: {
    thickness: 'Épaisseur corticale, patients moins témoins (d\u00a0de\u00a0Cohen)',
    volume: 'Volume, patients moins témoins (d\u00a0de\u00a0Cohen)',
  },
  direction: {
    thickness: { smaller: 'plus mince', larger: 'plus épais' },
    volume: { smaller: 'plus petit', larger: 'plus grand' },
  },
  none: 'Aucune différence d’un trouble ne survit ici au taux de fausses découvertes de son tableau.',
  paint: (name: string) => `Peindre ${name} sur le cerveau`,
  shown: (name: string) => `Sur le cerveau\u202f: ${name}.`,
  cohort: (patients: string, controls: string) => `${patients} patients, ${controls} témoins`,
  note: (rate: string) =>
    `Différences de groupe issues des groupes de travail du consortium ENIGMA, des milliers de personnes examinées dans de nombreux sites, ajustées pour la taille de la tête ; seules les différences qui survivent au taux de fausses découvertes de ${rate} de chaque tableau sont listées. La plupart sont faibles : patients et témoins se recouvrent presque entièrement, si bien qu’aucune ne dit quoi que ce soit d’une personne.`,
  basis: {
    thickness:
      'Rapportée par région de Desikan-Killiany, l’atlas sur lequel un trouble peint est montré ; non mesurée dans ce cerveau.',
    volume: 'Rapporté par structure FreeSurfer ; non mesuré dans ce cerveau.',
  },
  paper: 'Article',
  toolbox: 'Données (ENIGMA Toolbox)',
  keyTitle: (name: string) => `${name} : patients moins témoins`,
  step: {
    smallerStrong: (split: string) => `Plus mince ou plus petit, d\u00a0≤\u00a0−${split}`,
    smaller: (split: string) => `Plus mince ou plus petit, d\u00a0>\u00a0−${split}`,
    larger: (split: string) => `Plus épais ou plus grand, d\u00a0<\u00a0${split}`,
    largerStrong: (split: string) => `Plus épais ou plus grand, d\u00a0≥\u00a0${split}`,
  },
  keyNote: (rate: string, ground: KeyGround) =>
    `d de Cohen là où la différence survit à un taux de fausses découvertes de ${rate}. ${FR_AREAS[ground]} n’en montrent aucune ou ne sont pas rapportées.`,
};
