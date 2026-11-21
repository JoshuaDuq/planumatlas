import type {
  ArterialTerritories,
  CerebellarFunctions,
  Language,
  LoadProgress,
  Rgb,
  SurfaceColor,
} from '../../types/index.ts';
import { LOBE_COLORS } from '../catalog/lobes.ts';
import { percent } from '../format.ts';
import { atlasSwitchLabel, t } from '../i18n/index.ts';

/** The Colour field's groups, in order; the last choices stand on their own. */
const COLOUR_GROUPS: readonly (readonly [string | null, readonly SurfaceColor[]])[] = [
  ['appearance', ['tissue', 'mri']],
  ['parcellation', ['lobe', 'atlas']],
  ['networks', ['network', 'cab-np']],
  ['subcortical', ['striatal', 'cerebellar']],
  ['vascular', ['territory']],
];

interface NamedEntry {
  display_name?: string;
  subject?: string;
  id?: string;
}

/** The published title without its quotation marks: "SNAIL subj_1", dataset and subject together. */
export function subjectName(entry: NamedEntry | null | undefined): string {
  const name = String(entry?.display_name ?? '')
    .replace(/[“”"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return name || entry?.subject || entry?.id || '';
}

export type SummaryPart = 'subject' | 'atlas' | 'colour' | 'detail';

/** What the masthead's summary names, part by part: subject, atlas, colouring, internal anatomy, or the tract reference alone. */
export function dataSummary({
  subject,
  atlas,
  colour,
  detail,
  reference,
}: {
  subject?: string | null;
  atlas?: string | null;
  colour?: string | null;
  detail?: string | null;
  reference?: string | null;
}): { part: SummaryPart; text: string }[] {
  if (reference) return [{ part: 'subject', text: reference }];
  const parts: [SummaryPart, string | null | undefined][] = [
    ['subject', subject],
    ['atlas', atlas],
    ['colour', colour],
    ['detail', detail],
  ];
  return parts.flatMap(([part, text]) => (text ? [{ part, text }] : []));
}

/** The Colour field's optgroups, offering only the colourings this build publishes. */
export function colourGroups({
  networks,
  cabNp,
  territories,
  striatal,
  cerebellar,
}: {
  networks?: unknown;
  cabNp?: unknown;
  territories?: unknown;
  striatal?: unknown;
  cerebellar?: unknown;
}): [string | null, SurfaceColor[]][] {
  const published: Partial<Record<SurfaceColor, boolean>> = {
    network: Boolean(networks),
    'cab-np': Boolean(cabNp),
    territory: Boolean(territories),
    striatal: Boolean(striatal),
    cerebellar: Boolean(cerebellar),
  };
  return COLOUR_GROUPS.map((entry): [string | null, SurfaceColor[]] => [
    entry[0],
    entry[1].filter((mode) => published[mode] ?? true),
  ]).filter(([, modes]) => modes.length);
}

/** A partition with named colours: Yeo's networks, and CAB-NP's. */
interface NamedColours {
  networks: readonly string[];
  colors: Readonly<Record<string, Rgb>>;
}

/** Where each colouring's palette comes from: what the stage key draws from (stage-keys.ts). */
export interface PaletteSources {
  networks?: NamedColours | null;
  cabNp?: NamedColours | null;
  territories?: Pick<ArterialTerritories, 'territories'> | null;
  cerebellar?: Pick<CerebellarFunctions, 'regions'> | null;
}

/**
 * A colouring's colours in its key's order, drawn beside its option; null for one with no palette of
 * its own (tissue, T1, an atlas's region colours). The striatal map's networks are Yeo's.
 */
export function colourPalette(mode: SurfaceColor, sources: PaletteSources): readonly Rgb[] | null {
  const named = (partition?: NamedColours | null) =>
    partition ? partition.networks.map((key) => partition.colors[key]!) : null;
  switch (mode) {
    case 'lobe':
      return Object.values(LOBE_COLORS);
    case 'network':
    case 'striatal':
      return named(sources.networks);
    case 'cab-np':
      return named(sources.cabNp);
    case 'territory':
      return sources.territories?.territories.map(({ color }) => color) ?? null;
    case 'cerebellar':
      return sources.cerebellar?.regions.map(({ color }) => color) ?? null;
    default:
      return null;
  }
}

/** What else a Colour option changes: the atlas it is defined on, when another is shown. */
export function colourAside(
  lang: Language,
  { atlas, required }: { atlas: string; required?: string | null },
): string | null {
  return required && required !== atlas
    ? t(lang, 'header').atlasBecomes(atlasSwitchLabel(required, lang))
    : null;
}

/** What else an Atlas option changes: the colouring it drops when the one shown is defined on another atlas. */
export function atlasAside(lang: Language, id: string, required?: string | null): string | null {
  return required && required !== id
    ? t(lang, 'header').colourBecomes(t(lang, 'display').surfaceColors.atlas)
    : null;
}

/** How far a download has come, or that it has started. */
export function loadingText(lang: Language, progress?: LoadProgress | null): string {
  const copy = t(lang, 'header');
  return progress?.total
    ? copy.loadingProgress(percent(progress.loaded / progress.total, lang))
    : copy.loading;
}

/** The status bar's statement, then what is loaded, named as the masthead names it; alone until something is. */
export function colophonParts(
  lang: Language,
  {
    anatomy,
    reference,
  }: { anatomy?: NamedEntry & { individual: boolean }; reference?: { label: string } } = {},
): { description: string; statement: string } {
  const copy = t(lang, 'footer');
  const description = reference
    ? copy.referenceColophon(reference.label)
    : anatomy
      ? copy.colophon(subjectName(anatomy), anatomy.individual)
      : '';
  return { description, statement: copy.statementAlone };
}
