// Apart from header.ts, which the data popover's lazy lists import: the lobes' palette would bring the
// catalogue's labels into their graph, and the bundler would then split those out of the entry.
import type {
  ArterialTerritories,
  CerebellarFunctions,
  Rgb,
  SurfaceColor,
} from '../../types/index.ts';
import { LOBE_COLORS } from '../catalog/lobes.ts';

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
