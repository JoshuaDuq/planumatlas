import { grouped } from '../../format.ts';
import type { Behind } from '../../panels/citations.ts';

export const en = {
  referenceColophon: (name: string) => `${name} · reference data`,
  colophon: (name: string, individual: boolean) =>
    `${name} · ${individual ? 'one individual’s MRI reconstruction' : 'averaged reference template'}`,
  statementAlone: 'Not clinical anatomy',
  visibleRegions: (n: number) => `${n} visible ${n === 1 ? 'region' : 'regions'}`,
  provenance: 'Provenance',
  feedback: 'Feedback',
  feedbackName: 'Your name (optional)',
  feedbackEmail: 'Your email (optional)',
  feedbackEmailNote: 'Sent only to Planum’s maintainer, with your message, for a reply.',
  feedbackEmailInvalid: 'Enter one address, such as name@example.org, or leave this empty.',
  feedbackMessage: 'Your feedback',
  feedbackMessageEmpty: 'Write your feedback before sending.',
  feedbackNote: 'Sent with the link to the view on screen.',
  feedbackSend: 'Send',
  feedbackSending: 'Sending…',
  feedbackSent: 'Thank you, your feedback was sent.',
  // Each is followed by the address, which is its own copy button (FeedbackForm).
  feedbackFailed: {
    invalid: 'The feedback server refused this message. You can send it by email to',
    tooLarge:
      'The message is too long for the feedback server. Shorten it and try again, or write to',
    rateLimited: (seconds: number | null) =>
      `Too many messages were sent from this connection. Try again ${seconds === null ? 'later' : `in ${grouped(seconds)} ${seconds === 1 ? 'second' : 'seconds'}`}, or write to`,
    relay: 'The feedback server could not pass the message on. Try again later, or write to',
    timeout:
      'The feedback server did not answer in time, so the message may not have arrived. Check the connection and try again, or write to',
    offline:
      'This device is offline, so nothing was sent. Try again once it is connected, or write to',
    network:
      'The feedback server could not be reached. Check the connection and try again, or write to',
  },
  close: 'Close',
  subject: 'Subject',
  kind: (individual: boolean): string =>
    individual ? 'One individual’s MRI reconstruction' : 'Averaged reference template',
  // Follows the kind of an individual's reconstruction in the provenance sheet.
  oneBrain:
    'Its surface, cuts, MRI and tracts are one person’s, not an average; atlases and group maps are registered onto it, so their borders here are estimates.',
  oneBrainLink: 'Why one brain',
  sourceData: 'Source data',
  reconstruction: 'Reconstruction',
  atlases: 'Cortical atlases',
  projectedFrom: (template: string) => `Projected from ${template}`,
  networks: 'Functional networks',
  functional: 'Functional divisions',
  receptors: 'Receptor fingerprints',
  corticalLayers: 'Cortical layers (BigBrain)',
  stimulation: 'Stimulation responses',
  stimulationFtract: 'Stimulation responses (F-TRACT)',
  functionalConnectivity: 'Functional connectivity (HCP)',
  disorderEffects: 'Brain differences in disorders (ENIGMA)',
  strokeCases: 'Stroke cases',
  // Every group map carried onto this brain by a volume registration, with what was measured of it.
  registered: 'Registered group maps',
  landing: (space: string) => `Fine structures through registration (${space})`,
  landingNote: (structures: string, median: string, p90: string) =>
    `The template’s own ${structures} fine structures, carried by the published registration, land a median ${median} from this brain’s own, nine in ten within ${p90}. An upper bound: it includes the disagreement between two segmentations.`,
  landingOverlap: (classes: readonly string[]) =>
    `Median overlap (Dice) by the structure’s volume: ${classes.join(', ')}.`,
  landingClass: (dice: string, under: string | null) =>
    under === null ? `${dice} above` : `${dice} under ${under}`,
  landingRule: (floor: string, radius: string) =>
    `A structure under ${floor} takes no shares from a registered map: it names what lies within ${radius} of it.`,
  registeredChecks: {
    ventricles: (left: string, right: string) =>
      `Overlap (Dice) of the atlas’s ventricles with this brain’s: ${left} left, ${right} right.`,
    lobules: (mean: string) =>
      `Overlap (Dice) of the template’s lobules with this brain’s: ${mean} on average.`,
    striatum: (mean: string) =>
      `Overlap (Dice) of the template’s striatum with this brain’s: ${mean} on average.`,
    deep: (median: string, cortex: string) =>
      `Overlap (Dice) of the template’s structures with this brain’s: deep structures ${median} (median), cortex ${cortex}.`,
  },
  domains: 'Neuropsychological domains',
  supplemental: 'Supplemental layers',
  files: 'Published files',
  sourceFiles: (n: number, checksummed: boolean) =>
    `${n} source ${n === 1 ? 'file' : 'files'}${checksummed ? `, ${n === 1 ? 'with a' : 'each with a'} SHA-256 checksum` : ''}`,
  index: 'Index of the published anatomies',
  tractReference: 'Tract reference',
  sources: 'Sources',
  // The works behind what is on screen, each under what it is behind.
  references: 'References for this view',
  referencesLoading: 'Loading the references…',
  referencesFailed: 'The references could not be loaded.',
  referencesRetry: 'Retry',
  behind: {
    planum: 'Planum',
    subject: 'Subject',
    atlas: 'Atlas',
    colouring: 'Colouring',
    internal: 'Internal anatomy',
    spinalCord: 'Spinal cord',
    function: 'Function',
    deficit: 'Deficit',
    tracts: 'Tracts',
    strokeCases: 'Stroke cases',
    visualField: 'Visual field map',
    bodyMap: 'Body map',
  } satisfies Record<Behind, string>,
  acknowledgement: 'Acknowledgement',
  copyReferences: 'Copy as text',
  referencesCopied: 'References copied',
  referencesCopyFailed: 'Could not copy the references',
  downloadBibtex: 'Download .bib',
  downloadRis: 'Download .ris',
  bibtexDownloaded: 'BibTeX file downloaded.',
  risDownloaded: 'RIS file downloaded.',
  intendedUse:
    'For research and education. Planum is not a medical device and must not be used for diagnosis, treatment or any other clinical decision.',
};

export const fr: typeof en = {
  referenceColophon: (name: string) => `${name} · données de référence`,
  colophon: (name: string, individual: boolean) =>
    `${name} · ${individual ? 'reconstruction IRM d’un individu' : 'gabarit de référence moyenné'}`,
  statementAlone: 'Pas une anatomie clinique',
  visibleRegions: (n: number) => `${n} ${n === 1 ? 'région visible' : 'régions visibles'}`,
  provenance: 'Provenance',
  feedback: 'Commentaires',
  feedbackName: 'Votre nom (facultatif)',
  feedbackEmail: 'Votre courriel (facultatif)',
  feedbackEmailNote:
    'Transmis uniquement au responsable de Planum, avec votre message, pour vous répondre.',
  feedbackEmailInvalid:
    'Saisissez une seule adresse, comme nom@example.org, ou laissez ce champ vide.',
  feedbackMessage: 'Vos commentaires',
  feedbackMessageEmpty: 'Écrivez vos commentaires avant d’envoyer.',
  feedbackNote: 'Envoyés avec le lien de la vue à l’écran.',
  feedbackSend: 'Envoyer',
  feedbackSending: 'Envoi…',
  feedbackSent: 'Merci, vos commentaires ont été envoyés.',
  feedbackFailed: {
    invalid: 'Le serveur de commentaires a refusé ce message. Vous pouvez l’envoyer par courriel à',
    tooLarge:
      'Le message est trop long pour le serveur de commentaires. Raccourcissez-le et réessayez, ou écrivez à',
    rateLimited: (seconds: number | null) =>
      `Trop de messages ont été envoyés depuis cette connexion. Réessayez ${seconds === null ? 'plus tard' : `dans ${grouped(seconds)} ${seconds < 2 ? 'seconde' : 'secondes'}`}, ou écrivez à`,
    relay:
      'Le serveur de commentaires n’a pas pu transmettre le message. Réessayez plus tard, ou écrivez à',
    timeout:
      'Le serveur de commentaires n’a pas répondu à temps\u202f; le message n’est peut-être pas arrivé. Vérifiez la connexion et réessayez, ou écrivez à',
    offline:
      'Cet appareil est hors ligne\u202f; rien n’a été envoyé. Réessayez une fois la connexion rétablie, ou écrivez à',
    network:
      'Le serveur de commentaires est injoignable. Vérifiez la connexion et réessayez, ou écrivez à',
  },
  close: 'Fermer',
  subject: 'Sujet',
  kind: (individual: boolean): string =>
    individual ? 'Reconstruction IRM d’un individu' : 'Gabarit de référence moyenné',
  oneBrain:
    'Sa surface, ses coupes, son IRM et ses faisceaux sont ceux d’une seule personne, et non une moyenne\u202f; les atlas et les cartes de groupe y sont recalés, si bien que leurs limites sont ici des estimations.',
  oneBrainLink: 'Pourquoi un seul cerveau (en anglais)',
  sourceData: 'Données sources',
  reconstruction: 'Reconstruction',
  atlases: 'Atlas corticaux',
  projectedFrom: (template: string) => `Projeté depuis ${template}`,
  networks: 'Réseaux fonctionnels',
  functional: 'Divisions fonctionnelles',
  receptors: 'Empreintes de récepteurs',
  corticalLayers: 'Couches corticales (BigBrain)',
  stimulation: 'Réponses à la stimulation',
  stimulationFtract: 'Réponses à la stimulation (F-TRACT)',
  functionalConnectivity: 'Connectivité fonctionnelle (HCP)',
  disorderEffects: 'Différences cérébrales dans les troubles (ENIGMA)',
  strokeCases: 'Cas d’AVC',
  registered: 'Cartes de groupe recalées',
  landing: (space: string) => `Structures fines à travers le recalage (${space})`,
  landingNote: (structures: string, median: string, p90: string) =>
    `Les ${structures} structures fines du gabarit, portées par le recalage publié, tombent à une distance médiane de ${median} de celles de ce cerveau, neuf sur dix à moins de ${p90}. Une borne supérieure\u202f: elle comprend le désaccord entre deux segmentations.`,
  landingOverlap: (classes: readonly string[]) =>
    `Recouvrement médian (Dice) selon le volume de la structure\u202f: ${classes.join(', ')}.`,
  landingClass: (dice: string, under: string | null) =>
    under === null ? `${dice} au-delà` : `${dice} sous ${under}`,
  landingRule: (floor: string, radius: string) =>
    `Une structure de moins de ${floor} ne reçoit aucune part d’une carte recalée\u202f: elle nomme ce qui se trouve à moins de ${radius} d’elle.`,
  registeredChecks: {
    ventricles: (left: string, right: string) =>
      `Recouvrement (Dice) des ventricules de l’atlas avec ceux de ce cerveau\u202f: ${left} à gauche, ${right} à droite.`,
    lobules: (mean: string) =>
      `Recouvrement (Dice) des lobules du gabarit avec ceux de ce cerveau\u202f: ${mean} en moyenne.`,
    striatum: (mean: string) =>
      `Recouvrement (Dice) du striatum du gabarit avec celui de ce cerveau\u202f: ${mean} en moyenne.`,
    deep: (median: string, cortex: string) =>
      `Recouvrement (Dice) des structures du gabarit avec celles de ce cerveau\u202f: structures profondes ${median} (médiane), cortex ${cortex}.`,
  },
  domains: 'Domaines neuropsychologiques',
  supplemental: 'Couches complémentaires',
  files: 'Fichiers publiés',
  sourceFiles: (n: number, checksummed: boolean) =>
    `${n} ${n > 1 ? 'fichiers sources' : 'fichier source'}${checksummed ? `, ${n > 1 ? 'chacun avec' : 'avec'} une somme SHA-256` : ''}`,
  index: 'Index des anatomies publiées',
  tractReference: 'Référence des faisceaux',
  sources: 'Sources',
  references: 'Références de cette vue',
  referencesLoading: 'Chargement des références…',
  referencesFailed: 'Les références n’ont pas pu être chargées.',
  referencesRetry: 'Réessayer',
  behind: {
    planum: 'Planum',
    subject: 'Sujet',
    atlas: 'Atlas',
    colouring: 'Coloration',
    internal: 'Anatomie interne',
    spinalCord: 'Moelle épinière',
    function: 'Fonction',
    deficit: 'Déficit',
    tracts: 'Faisceaux',
    strokeCases: 'Cas d’AVC',
    visualField: 'Carte du champ visuel',
    bodyMap: 'Carte du corps',
  },
  acknowledgement: 'Remerciements',
  copyReferences: 'Copier en texte',
  referencesCopied: 'Références copiées',
  referencesCopyFailed: 'Impossible de copier les références',
  downloadBibtex: 'Télécharger le .bib',
  downloadRis: 'Télécharger le .ris',
  bibtexDownloaded: 'Fichier BibTeX téléchargé.',
  risDownloaded: 'Fichier RIS téléchargé.',
  intendedUse:
    'Pour la recherche et l’enseignement. Planum n’est pas un dispositif médical et ne doit pas servir au diagnostic, au traitement ni à aucune autre décision clinique.',
};
