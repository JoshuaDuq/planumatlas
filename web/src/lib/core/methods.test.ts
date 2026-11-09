import { existsSync } from 'node:fs';
import { expect, test } from 'vitest';
import { METHODS_PAGES, methodsHref } from './methods.ts';

const docs = new URL('../../../../docs/', import.meta.url);

test('every page a tool links to is a methods page in docs/features', () => {
  const missing = Object.values(METHODS_PAGES).filter(
    (page) => !existsSync(new URL(`features/${page}.md`, docs)),
  );
  expect(missing).toEqual([]);
  expect(existsSync(new URL('index.md', docs))).toBe(true);
});

test('the links are same-site paths to the built pages', () => {
  expect(methodsHref()).toBe('/docs/');
  expect(methodsHref('tracts')).toBe('/docs/features/tracts.html');
  expect(methodsHref('section')).toBe('/docs/features/sections-and-cuts.html');
});
