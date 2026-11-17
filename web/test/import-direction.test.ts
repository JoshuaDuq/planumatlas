import { readdirSync, readFileSync } from 'node:fs';
import { posix, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// The layers of web/src, lowest first. A module imports only from a lower tier, never from another
// layer of its own tier:
//
//   lib/types, styles            plain data types; the global stylesheets
//   lib/core                     logic over those types, without Svelte state or the engine
//   lib/ui, lib/engine, boot     interface primitives; the three.js engine; the boot scripts
//   lib/state                    stores over the engine and the session
//   lib/controller               commands across the stores and the engine
//   features/info                the pieces every tab and stage tool mounts
//   features/*                   one folder per tab, tool or dialog
//   app                          the shell that builds the world and mounts the features
//   main.ts, service-worker.ts   entry points
//
// Tests and their support files are exempt: they reach any layer to build fixtures. Imports from
// outside src (build/, public/, data/) are not layered here.
const TIERS: readonly (readonly string[])[] = [
  ['lib/types', 'styles'],
  ['lib/core'],
  ['lib/ui', 'lib/engine', 'boot'],
  ['lib/state'],
  ['lib/controller'],
  ['features/info'],
  ['features/*'],
  ['app'],
  ['main.ts', 'service-worker.ts'],
];

interface Allowance {
  /** Path prefixes, from src, of the importing files. */
  from: readonly string[];
  /** Path prefixes, from src, of the files they may import. */
  to: readonly string[];
  why: string;
}

const ALLOWANCES: readonly Allowance[] = [
  {
    from: ['lib/core/state/ports.ts'],
    to: ['lib/engine/api.ts'],
    why: "The ports are Picks of the engine's EngineModel and EngineSections, whose members carry core's published-data types, so those interfaces cannot sit in lib/types.",
  },
  {
    from: ['features/workspace/'],
    to: ['features/'],
    why: "The workspace is the panel that mounts every tab's list and detail.",
  },
  {
    from: ['features/workspace/'],
    to: ['app/application.svelte.ts'],
    why: 'Its list and detail views read the world and the ports the app builds (World, App, getApp).',
  },
  {
    from: ['features/deficits/', 'features/functions/'],
    to: ['features/sections/DeepToggle.svelte', 'features/sections/LinkedMriButton.svelte'],
    why: "A deficit's or function's profile mounts the sections' Linked MRI button and its deep-structures toggle.",
  },
  {
    from: ['features/lesion/'],
    to: ['features/inspector/inspector.css'],
    why: "The lesion and coordinate reports are laid out on the region inspector's stylesheet.",
  },
  {
    from: ['features/snapshot/'],
    to: ['features/stage/stage-keys.ts', 'features/stage/stage-labels.ts'],
    why: "The saved image redraws the stage's colour keys and labels with the stage's own placement.",
  },
  {
    from: ['features/user-map/key.ts'],
    to: ['features/stage/stage-keys.ts', 'features/snapshot/snapshot.ts'],
    why: "The reader's map gives its key and caption to the stage keys and the snapshot in their shapes.",
  },
];

const TEST_CODE = /\.test\.ts$|test-support|-test-|-fixture\.svelte$|^lib\/engine\/fake(\.ts$|\/)/;
const IMPORT =
  /\b(?:import|export)\s+(?:type\s+)?(?:[^'"`;]*?\s+from\s+)?['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

function layerOf(path: string): string {
  const [top, next] = path.split('/');
  return top === 'lib' || top === 'features' ? `${top}/${next}` : top!;
}

function tierOf(layer: string): number {
  const tier = TIERS.findIndex(
    (layers) =>
      layers.includes(layer) || (layers.includes('features/*') && layer.startsWith('features/')),
  );
  if (tier < 0) throw new Error(`${layer} has no tier`);
  return tier;
}

const matches = (prefixes: readonly string[], path: string) =>
  prefixes.some((prefix) => path.startsWith(prefix));

const allowanceFor = (from: string, to: string) =>
  ALLOWANCES.find((allowance) => matches(allowance.from, from) && matches(allowance.to, to));

function downward(from: string, to: string): boolean {
  const [fromLayer, toLayer] = [layerOf(from), layerOf(to)];
  return fromLayer === toLayer || tierOf(toLayer) < tierOf(fromLayer);
}

const srcRoot = new URL('../src/', import.meta.url);

/** Every import between two files of src, from the code that ships. */
function sourceImports(): { from: string; to: string }[] {
  return readdirSync(srcRoot, { recursive: true })
    .map((path) => String(path).split(sep).join('/'))
    .filter((path) => /\.(ts|js|svelte)$/.test(path) && !TEST_CODE.test(path))
    .flatMap((from) =>
      [...readFileSync(new URL(from, srcRoot), 'utf8').matchAll(IMPORT)]
        .map((match) => (match[1] ?? match[2])!)
        .filter((specifier) => specifier.startsWith('.'))
        .map((specifier) => ({
          from,
          to: posix.normalize(posix.join(posix.dirname(from), specifier.replace(/\?.*$/, ''))),
        }))
        .filter(({ to }) => !to.startsWith('../')),
    );
}

describe('import direction', () => {
  const imports = sourceImports();

  it('finds the imports it checks', () => {
    expect(imports).toContainEqual({ from: 'main.ts', to: 'app/App.svelte' });
    expect(imports).toContainEqual({
      from: 'lib/controller/lesson.ts',
      to: 'lib/state/display-state.ts',
    });
  });

  it('imports only from a lower layer, but for the named allowances', () => {
    const upward = imports
      .filter(({ from, to }) => !downward(from, to) && !allowanceFor(from, to))
      .map(({ from, to }) => `${from} -> ${to}`);
    expect(upward).toEqual([]);
  });

  it('keeps no allowance that nothing uses', () => {
    const used = new Set(
      imports
        .filter(({ from, to }) => !downward(from, to))
        .map(({ from, to }) => allowanceFor(from, to)),
    );
    expect(ALLOWANCES.filter((allowance) => !used.has(allowance)).map(({ why }) => why)).toEqual(
      [],
    );
  });

  it('refuses the inversions the layering replaced', () => {
    const inversions = [
      ['lib/controller/lesson.ts', 'features/colophon/display-state.ts'],
      ['lib/core/state/reader-state.ts', 'lib/engine/api.ts'],
      ['lib/core/keyboard.ts', 'lib/ui/keys.ts'],
      ['lib/state/view.svelte.ts', 'lib/controller/speech.ts'],
      ['features/stage/Dock.svelte', 'features/colophon/display-state.ts'],
      ['features/inspector/DomainSection.svelte', 'features/functions/functions-view.ts'],
      ['features/inspector/MapCourseSection.svelte', 'features/user-map/key.ts'],
      ['features/lesion/CoordinateReport.svelte', 'features/tracts/download.ts'],
      ['features/info/AboutData.svelte', 'features/deficits/MethodsLink.svelte'],
    ] as const;
    for (const [from, to] of inversions) {
      expect(downward(from, to) || allowanceFor(from, to) !== undefined, `${from} -> ${to}`).toBe(
        false,
      );
    }
  });
});
