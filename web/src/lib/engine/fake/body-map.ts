import { BODY_PARTS } from '../../types/index.ts';
import type { BodyMap, BodyPart } from '../../types/index.ts';
import { checkBodyMap } from '../../core/learning/body-map.ts';
import type { EngineBodyMap } from '../api.ts';

export interface FakeBodyMap extends EngineBodyMap {
  /** The part the stage draws, every part, or null. */
  readonly shown: BodyPart | 'all' | null;
}

/** The map with no cortex: `show` checks what the real engine would and records the part. */
export function createFakeBodyMap(record: BodyMap | undefined): FakeBodyMap {
  let shown: BodyPart | 'all' | null = null;
  return {
    available: record !== undefined,
    get shown() {
      return shown;
    },
    async show(part) {
      if (!record) throw new Error('This anatomy publishes no body map.');
      checkBodyMap(record);
      if (part !== null && part !== 'all' && !BODY_PARTS.includes(part)) {
        throw new RangeError(`No body part ${String(part)}.`);
      }
      shown = part;
    },
  };
}
