import type { VisualFieldDot } from '../../engine/api.ts';
import type { CircuitCatalog } from './catalog.ts';

export interface CircuitSessionState {
  circuit: string | null;
  step: number;
  visited: number[];
  /** The whole route is shown, every landmark at once, ahead of the steps. */
  route: boolean;
  /** An interactive map is open in place of a lesson, with the dot it shows; both absent otherwise. */
  map?: CircuitMap;
  dot?: VisualFieldDot;
}

/** The interactive maps the Circuits tab offers beside its lessons. */
export const CIRCUIT_MAPS = ['visual-field'] as const;
export type CircuitMap = (typeof CIRCUIT_MAPS)[number];

function checkedDot(dot: VisualFieldDot): VisualFieldDot {
  if (!([dot.x, dot.y].every(Number.isFinite) && dot.radius > 0)) {
    throw new RangeError('A visual-field dot needs a finite centre and a positive radius.');
  }
  return { ...dot };
}

/** Learning progress is independent of free anatomical exploration. `visited` lists the landmarks seen, in order. */
export function createCircuitSession(catalog: Pick<CircuitCatalog, 'get'>) {
  let state: CircuitSessionState = { circuit: null, step: 0, visited: [], route: false };
  return {
    snapshot: (): CircuitSessionState => ({ ...state, visited: [...state.visited] }),
    start(id: string) {
      catalog.get(id);
      state = { circuit: id, step: 0, visited: [0], route: false };
    },
    close() {
      state = { circuit: null, step: 0, visited: [], route: false };
    },
    /** A map opens in place of any lesson, showing `dot`. */
    openMap(map: CircuitMap, dot: VisualFieldDot) {
      if (!CIRCUIT_MAPS.includes(map)) throw new RangeError(`Unknown circuit map: ${map}`);
      state = { circuit: null, step: 0, visited: [], route: false, map, dot: checkedDot(dot) };
    },
    /** The open map's dot moves or changes size. */
    moveDot(dot: VisualFieldDot) {
      if (!state.map) throw new Error('No map is open to move the dot of.');
      state = { ...state, dot: checkedDot(dot) };
    },
    go(step: number) {
      const circuit = catalog.get(state.circuit!);
      if (!Number.isInteger(step) || step < 0 || step >= circuit.steps.length) {
        throw new RangeError(`Invalid landmark index: ${step}`);
      }
      state = {
        ...state,
        step,
        visited: state.visited.includes(step) ? state.visited : [...state.visited, step],
        route: false,
      };
    },
    /** The route in front of the open lesson's steps; the step it leaves is kept for the way back in. */
    showRoute() {
      if (!state.circuit) throw new Error('No lesson is open to show the route of.');
      state = { ...state, route: true };
    },
  };
}
