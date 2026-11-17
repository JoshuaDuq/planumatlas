import { readdirSync, readFileSync } from 'node:fs';
import { sep } from 'node:path';
import { expect, it } from 'vitest';

// A ceiling, as BUILD-15's are: split a unit that reaches it rather than raise it (handoff I9).
const MAX_LINES = 1100;
// Tests, their support and the fake engine, as BUILD-17 counts test code.
const TEST_CODE = /\.test\.ts$|test-support|-test-|-suite\.ts$|^fake(\.ts$|\/)/;

it('no engine source file is longer than the line ceiling', () => {
  const engine = new URL('../src/lib/engine/', import.meta.url);
  const counted = readdirSync(engine, { recursive: true })
    .map((path) => String(path).split(sep).join('/'))
    .filter((path) => /\.(ts|svelte)$/.test(path) && !TEST_CODE.test(path))
    .map((path) => ({
      path,
      lines: readFileSync(new URL(path, engine), 'utf8').trimEnd().split('\n').length,
    }));
  // The walk reaches the units the ceiling was set for.
  expect(counted.map(({ path }) => path)).toEqual(
    expect.arrayContaining(['model/brain-atlas.ts', 'render/scene.ts']),
  );
  expect(counted.filter(({ lines }) => lines > MAX_LINES)).toEqual([]);
});
