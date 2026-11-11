import { expect, test } from 'vitest';
import { tractCatalog } from './catalogs.ts';
import { tractEnds } from './ends.ts';

test('TRACT-52 · CDMD’s tract ends cover exactly its bundles; a catalog that differs is refused', () => {
  const catalog = tractCatalog('cdmd');
  const ends = tractEnds(catalog)!;
  expect(Object.keys(ends.bundles).sort()).toEqual(catalog.bundles.map((b) => b.id).sort());
  // Each streamline has two ends.
  for (const bundle of Object.values(ends.bundles)) expect(bundle.ends % 2).toBe(0);
  expect(() => tractEnds({ ...catalog, bundles: catalog.bundles.slice(1) })).toThrow(
    /do not match its bundles/,
  );
  expect(tractEnds({ id: 'elsewhere', bundles: [] })).toBeNull();
});
