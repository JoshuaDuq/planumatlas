import type { StrokeCases } from '../../core/catalog/stroke-cases.ts';
import type { EngineStrokeCases } from '../api.ts';

export interface FakeStrokeCases extends EngineStrokeCases {
  /** The ids the stage draws. */
  readonly shown: readonly string[];
}

/** The cohort without solids: `show` checks what the real engine would and records the ids. */
export function createFakeStrokeCases(data: StrokeCases | undefined): FakeStrokeCases {
  let shown: readonly string[] = [];
  return {
    available: data !== undefined,
    get shown() {
      return shown;
    },
    async cases() {
      if (!data) throw new Error('This anatomy publishes no stroke cases.');
      return data;
    },
    async show(ids) {
      if (ids.length && !data) throw new Error('This anatomy publishes no stroke cases.');
      if (ids.length > 2) throw new RangeError('At most two stroke cases are drawn at once.');
      for (const id of ids) {
        if (!data!.cases.some((entry) => entry.id === id)) throw new Error(`No stroke case ${id}.`);
      }
      shown = [...ids];
    },
  };
}
