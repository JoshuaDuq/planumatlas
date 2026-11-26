import { BODY_PARTS } from '../../types/index.ts';
import type { BodyMap, BodyPart, Rgb } from '../../types/index.ts';
import { FINDING_COLORS } from '../clinical/catalog.ts';

/** Each part's colour in code order: the deficits' first three finding colours, drawn together there too. */
export const BODY_PART_COLORS: readonly Rgb[] = FINDING_COLORS.slice(0, BODY_PARTS.length);

/** The code a part is published with (`manifest.body_map.parts`). */
export const bodyPartCode = (part: BodyPart): number => BODY_PARTS.indexOf(part) + 1;

/** The manifest's parts must be the viewer's, coded 1 to 3 in its order. */
export function checkBodyMap(record: BodyMap): BodyMap {
  const parts = record.parts.map(({ code, id }) => `${code}:${id}`).join(',');
  const expected = BODY_PARTS.map((part) => `${bodyPartCode(part)}:${part}`).join(',');
  if (parts !== expected) throw new Error(`The body map's parts are ${parts}, not ${expected}.`);
  return record;
}
