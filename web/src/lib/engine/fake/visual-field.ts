import type { VisualFieldTerritories } from '../../core/learning/visual-field.ts';
import type { EngineVisualField, VisualFieldDot } from '../api.ts';

export interface FakeVisualField extends EngineVisualField {
  /** What the stage draws, and whether a click reads the cortex. */
  readonly shown: { dot: VisualFieldDot | null } | null;
  readonly probing: boolean;
  /** Every dot the stage was asked to follow, in order. */
  readonly followed: readonly VisualFieldDot[];
}

/** The map with no cortex: it keeps the real validation; tests raise `visualFieldPoint` themselves. */
export function createFakeVisualField(
  available: boolean,
  territories: VisualFieldTerritories | undefined,
  centralRegion: (hemisphere: 'left' | 'right') => string,
  /** The map pairs the hemispheres while it is drawn. */
  pair: (paired: boolean) => void,
): FakeVisualField {
  let shown: FakeVisualField['shown'] = null;
  let probing = false;
  const followed: VisualFieldDot[] = [];
  return {
    available,
    get shown() {
      return shown;
    },
    get probing() {
      return probing;
    },
    followed,
    show(map) {
      if (!available) throw new Error('This anatomy publishes no retinotopy.');
      const dot = map?.dot;
      if (dot && !([dot.x, dot.y].every(Number.isFinite) && dot.radius >= 0)) {
        throw new RangeError('A visual-field dot needs a finite centre and a radius ≥ 0.');
      }
      shown = map;
      pair(map !== null);
    },
    follow(dot) {
      if (!available) throw new Error('This anatomy publishes no retinotopy.');
      followed.push(dot);
    },
    setProbing(next) {
      probing = next;
    },
    centralRegion,
    async territories() {
      if (!territories) throw new Error('This fake publishes no retinotopy territories.');
      return territories;
    },
  };
}
