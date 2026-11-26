import { describe, expect, test } from 'vitest';
import type { BodyMap } from '../../types/index.ts';
import { BODY_PART_COLORS, bodyPartCode, checkBodyMap } from './body-map.ts';

const record = (parts: BodyMap['parts']) => ({ parts }) as BodyMap;

describe('BODY-02 the published parts are foot, hand and tongue, coded 1 to 3', () => {
  test('codes and colours', () => {
    expect([bodyPartCode('foot'), bodyPartCode('hand'), bodyPartCode('tongue')]).toEqual([1, 2, 3]);
    // The deficits' first three finding colours: blue, raspberry, green.
    expect(BODY_PART_COLORS).toEqual([
      [57, 135, 229],
      [213, 81, 129],
      [0, 131, 0],
    ]);
  });

  test('accepts the three parts in code order', () => {
    const parts = [
      { code: 1, id: 'foot' },
      { code: 2, id: 'hand' },
      { code: 3, id: 'tongue' },
    ] as const;
    expect(checkBodyMap(record([...parts])).parts).toHaveLength(3);
  });

  test.each([
    [
      'swapped codes',
      [
        { code: 2, id: 'foot' },
        { code: 1, id: 'hand' },
        { code: 3, id: 'tongue' },
      ],
    ],
    [
      'a part missing',
      [
        { code: 1, id: 'foot' },
        { code: 2, id: 'hand' },
      ],
    ],
    [
      'another part',
      [
        { code: 1, id: 'foot' },
        { code: 2, id: 'hand' },
        { code: 3, id: 'face' },
      ],
    ],
  ])('refuses %s', (_, parts) => {
    expect(() => checkBodyMap(record(parts as BodyMap['parts']))).toThrow(/body map's parts/);
  });
});
