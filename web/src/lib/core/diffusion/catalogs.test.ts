import assert from 'node:assert/strict';
import { afterAll, test, vi } from 'vitest';
import { readRepoYaml } from '../../../../test/repo.ts';
import { anatomies } from '../catalog/test-support.ts';
import { TRACT_CATALOGS, loadTractCatalog, ownTractIds, tractCatalog } from './catalogs.ts';
import type { TractCatalog } from './catalogs.ts';

// Loading a catalog adds it to the module's list, and the unit files share one module cache
// (isolate: false): this file reads the module afresh and leaves none built on it to the next.
vi.hoisted(() => vi.resetModules());
afterAll(() => {
  vi.resetModules();
});

const { tract_catalogs: paths } = readRepoYaml<{ tract_catalogs: string[] }>('config/model.yaml');
const catalogs = paths.map((path) => readRepoYaml<TractCatalog>(path));

// The legacy test read catalogs.js as text to compare its imports with config/model.yaml;
// the behavioural equivalent is that the catalogs it serves are exactly the files named there.
test('the viewer holds the default anatomy’s catalog, and each other one once its brain is opened', async () => {
  // First visit: CDMD's alone, so the template's 23 bundles stay off the entry (BUILD-15).
  assert.deepEqual(TRACT_CATALOGS, [catalogs[0]]);
  assert.equal(tractCatalog('mni152'), TRACT_CATALOGS[0]);
  assert.deepEqual(ownTractIds('mni152'), []);
  // An anatomy without a catalog of its own adds nothing.
  await loadTractCatalog('fsaverage');
  await loadTractCatalog('toString');
  assert.equal(TRACT_CATALOGS.length, 1);
  for (const { anatomy } of catalogs) await loadTractCatalog(anatomy);
  assert.deepEqual(TRACT_CATALOGS, catalogs);
  // Opened twice, a brain's catalog is still listed once.
  await loadTractCatalog('mni152');
  assert.equal(TRACT_CATALOGS.length, catalogs.length);
  assert.equal(tractCatalog('mni152').id, 'mni152-hcp1065');
  assert.equal(ownTractIds('mni152').length, 23);
});

test('each catalog belongs to one published anatomy and carries the same dataset copy', () => {
  const owners = catalogs.map((catalog) => catalog.anatomy);
  assert.equal(new Set(owners).size, owners.length);
  for (const anatomy of owners) {
    assert.ok(
      anatomies.anatomies.some((entry) => entry.id === anatomy),
      anatomy,
    );
  }
  const keys = Object.keys(catalogs[0].text.en).sort();
  for (const catalog of catalogs) {
    for (const lang of ['en', 'fr'] as const) {
      assert.deepEqual(Object.keys(catalog.text[lang]).sort(), keys, `${catalog.id} ${lang}`);
    }
  }
});

test('an anatomy with tracts of its own gets them, any other the CDMD reference', () => {
  assert.equal(tractCatalog('cdmd'), TRACT_CATALOGS[0]);
  assert.equal(tractCatalog('aomic'), TRACT_CATALOGS[0]);
});

test('CAT-61 · the CDMD tract catalog: its subject, maps, 35 bundles with two initial, overlay and copy keys', () => {
  const [cdmd] = TRACT_CATALOGS;
  assert.deepEqual(paths, ['data/diffusion-cdmd.yaml', 'data/diffusion-mni152.yaml']);
  assert.equal(cdmd.id, 'cdmd-sub-013');
  assert.equal(cdmd.anatomy, 'cdmd');
  assert.equal(cdmd.reference_space, 'cdmd-sub-013/surface-space.json');
  assert.deepEqual(
    cdmd.maps.map((map) => map.id),
    ['t1', 'fa'],
  );
  assert.equal(cdmd.bundles.length, 35);
  assert.deepEqual(
    cdmd.bundles.filter((bundle) => bundle.initial).map((bundle) => bundle.id),
    ['af-left', 'cst-right'],
  );
  assert.equal(cdmd.overlay_cortex_opacity, 0.16);
  assert.equal(cdmd.resample_step_mm, 0.5);
  for (const lang of ['en', 'fr'] as const) {
    assert.deepEqual(Object.keys(cdmd.text[lang]).sort(), [
      'dataset',
      'files',
      'otherAnatomy',
      'reference',
      'source',
    ]);
  }
});

test('CAT-61 · an unlisted, empty or inherited-property anatomy name gets the CDMD catalog', () => {
  for (const anatomy of ['cdmd', 'aomic', '', 'toString']) {
    assert.equal(tractCatalog(anatomy), TRACT_CATALOGS[0], anatomy);
  }
});

test('the template’s catalog is an averaged atlas whose bundles are CDMD’s by id, name and class', () => {
  const [cdmd, template] = catalogs as [TractCatalog, TractCatalog];
  assert.equal(template.id, 'mni152-hcp1065');
  assert.equal(template.anatomy, 'mni152');
  assert.equal(template.license, 'CC-BY-SA-4.0');
  assert.equal(template.reference_space, 'mni152-hcp1065/surface-space.json');
  // No T1 or FA of its own: the engine's `hasFa` is read from this.
  assert.deepEqual(template.maps, []);
  assert.equal(template.atlas!.keep_every, 4);
  assert.deepEqual(template.atlas!.voxel_centre_correction_mm, [-0.5, -0.5, 0.5]);
  assert.equal(template.bundles.length, 23);
  assert.deepEqual(
    template.bundles.filter((bundle) => bundle.initial).map((bundle) => bundle.id),
    cdmd.bundles.filter((bundle) => bundle.initial).map((bundle) => bundle.id),
  );
  // A link or a circuit that names a bundle means the same pathway on either brain.
  for (const { id, name, class: fibres, sources } of template.bundles) {
    const own = cdmd.bundles.find((bundle) => bundle.id === id);
    assert.ok(own, id);
    assert.deepEqual(name, own.name, id);
    assert.equal(fibres, own.class, id);
    assert.ok(sources!.length > 0, id);
  }
  // Each atlas file goes to one bundle: no streamline is published twice.
  const files = template.bundles.flatMap((bundle) => bundle.sources!);
  assert.equal(new Set(files).size, files.length);
});

test('TRACT-55 · the bundles that passed the 2026-11-27 gate: peduncles and radiations on CDMD, radiations alone on the template', () => {
  const [cdmd, template] = catalogs as [TractCatalog, TractCatalog];
  const gated = (catalog: TractCatalog) =>
    catalog.bundles
      .filter((bundle) => /^(mcp|icp|atr|ac|fx|fornix)(-|$)/.test(bundle.id))
      .map((bundle) => [bundle.id, bundle.class, bundle.sources]);
  assert.deepEqual(gated(cdmd), [
    ['mcp', 'cerebellar', undefined],
    ['icp-left', 'cerebellar', undefined],
    ['icp-right', 'cerebellar', undefined],
    ['atr-left', 'projection', undefined],
    ['atr-right', 'projection', undefined],
  ]);
  // HCP1065's peduncles failed the gate on the template; its radiations passed.
  assert.deepEqual(gated(template), [
    ['atr-left', 'projection', ['projection/TR_A_L']],
    ['atr-right', 'projection', ['projection/TR_A_R']],
  ]);
});
