import type { VisualAreaAnchor, VisualFieldTerritories } from '../../core/learning/visual-field.ts';
import type { EngineVisualField, ScreenPoint, Vec3, VisualFieldDot } from '../api.ts';

export interface FakeVisualField extends EngineVisualField {
  /** What the stage draws, and whether a click reads the cortex. */
  readonly shown: { dot: VisualFieldDot | null } | null;
  readonly probing: boolean;
  /** Every dot the stage was asked to follow, in order. */
  readonly followed: readonly VisualFieldDot[];
  /** The named areas' borders are drawn. */
  readonly areasShown: boolean;
}

/** The map with no cortex: it keeps the real validation; tests raise `visualFieldPoint` themselves. */
export function createFakeVisualField(
  available: boolean,
  territories: VisualFieldTerritories | undefined,
  centralRegion: (hemisphere: 'left' | 'right') => string,
  /** The map pairs the hemispheres while it is drawn. */
  pair: (paired: boolean) => void,
  /** The named areas' anchors, which the fake projects where they lie: no pair, nothing hides them. */
  anchors: readonly VisualAreaAnchor[] | undefined,
  project: (points: readonly Vec3[]) => (ScreenPoint | null)[],
): FakeVisualField {
  let shown: FakeVisualField['shown'] = null;
  let probing = false;
  let areasShown = false;
  const followed: VisualFieldDot[] = [];
  return {
    available,
    get shown() {
      return shown;
    },
    get probing() {
      return probing;
    },
    get areasShown() {
      return areasShown;
    },
    followed,
    async showAreas(on) {
      if (!available) throw new Error('This anatomy publishes no retinotopy.');
      if (on && !anchors) throw new Error('This fake publishes no visual-area anchors.');
      areasShown = on;
    },
    areaNames() {
      if (!areasShown || !shown) return [];
      const points = project(anchors!.map(({ pial }) => pial));
      return anchors!.map(({ name, hemisphere }, index) => ({
        name,
        hemisphere,
        point: points[index]!,
      }));
    },
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
