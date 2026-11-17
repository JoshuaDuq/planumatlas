import assert from 'node:assert/strict';
import { test } from 'vitest';
import { regionTableCsv, regionTableFilename, type RegionTableScope } from './region-table.ts';
import { asRegion } from './test-support.ts';

const area = asRegion({
  id: 'destrieux:left:1',
  label: 'G and S frontomargin · left',
  source_name: 'G_and_S_frontomargin',
  atlas: 'destrieux',
  hemisphere: 'left',
  kind: 'cortex',
  surface_area_mm2: 898.744924840933,
  centroid_ras_mm: [-18.193548387096776, 53.51404786680541, 39.37669094693028],
  anchor_ras_mm: [-18, 54, 39],
  networks: [
    { network: 'Limbic', fraction: 0.5298988040478381 },
    { network: 'Default', fraction: 0.42686292548298066 },
  ],
  territories: [{ territory: 'mca-frontal', fraction: 0.9981600735970562 }],
});
const unit = asRegion({
  id: 'learning:left:caudate',
  label: 'Caudate nucleus · left',
  source_name: 'Caudate nucleus',
  atlas: 'learning',
  hemisphere: 'left',
  kind: 'structure',
  display_names: { en: 'Caudate nucleus, "head"', fr: 'Noyau caudé' },
  system_names: { en: 'Basal ganglia', fr: 'Ganglions de la base' },
  segmentation_volume_mm3: 2967.8721326742184,
  surface_area_mm2: 1923.1364464385833,
  centroid_ras_mm: [-11.152585180665051, 10.826940992121797, 33.895656734724895],
  anchor_ras_mm: [-11.200000703334808, 10.8000029027462, 34.000001937150955],
});
const cord = asRegion({
  id: 'pam50:left:gracile-fasciculus',
  label: 'Gracile fasciculus · left',
  source_name: 'left fasciculus gracilis',
  atlas: 'pam50',
  hemisphere: 'left',
  kind: 'structure',
  supplemental: true,
  display_names: { en: 'Gracile fasciculus', fr: 'Faisceau gracile' },
  system_names: { en: 'Spinal cord', fr: 'Moelle épinière' },
  segmentation_volume_mm3: 12.5,
  centroid_ras_mm: [-1, -40, -60],
  anchor_ras_mm: [-1, -40, -60],
});
const left = [
  asRegion({ id: 'destrieux:left:-1', kind: 'non-region', atlas: 'destrieux' }),
  asRegion({ id: 'hcp-mmp:left:1', kind: 'cortex', atlas: 'hcp-mmp' }),
  asRegion({ id: 'aseg:left:11', kind: 'structure', atlas: 'aseg' }),
  asRegion({ id: 'arterial:left:1', kind: 'tissue-region', atlas: 'arterial' }),
];
const scope: RegionTableScope = {
  anatomy: 'cdmd',
  atlas: 'destrieux',
  detail: 'learning',
  regions: [...left, area, unit, cord],
};

/** RFC 4180 records: quoted cells may hold commas and doubled quotes. */
function records(csv: string) {
  const cells = (line: string) =>
    [...line.matchAll(/(?:^|,)(?:"((?:[^"]|"")*)"|([^",]*))/g)].map(([, quoted, plain]) =>
      quoted === undefined ? plain : quoted.replaceAll('""', '"'),
    );
  return csv.trimEnd().split('\r\n').map(cells);
}

test('the region table names its columns once, in a fixed order', () => {
  assert.deepEqual(records(regionTableCsv(scope))[0], [
    'id',
    'atlas',
    'name_en',
    'name_fr',
    'hemisphere',
    'group_en',
    'group_fr',
    'source_label',
    'surface_area_mm2',
    'volume_mm3',
    'centroid_surface_ras_x_mm',
    'centroid_surface_ras_y_mm',
    'centroid_surface_ras_z_mm',
    'anchor_surface_ras_x_mm',
    'anchor_surface_ras_y_mm',
    'anchor_surface_ras_z_mm',
    'largest_network',
    'largest_network_share',
    'largest_territory',
    'largest_territory_share',
  ]);
});

test('the shown atlas’s areas and the level’s structures are its rows; nothing else is', () => {
  const ids = records(regionTableCsv(scope))
    .slice(1)
    .map(([id]) => id);
  assert.deepEqual(ids, [area.id, unit.id, cord.id]);
});

test('an area’s row carries its measurements at full precision and its largest shares', () => {
  assert.equal(
    regionTableCsv(scope).split('\r\n')[1],
    [
      'destrieux:left:1',
      'destrieux',
      'Frontomarginal gyrus and sulcus',
      'Gyrus et sillon fronto-marginaux',
      'left',
      'Frontal',
      'Frontal',
      'G_and_S_frontomargin',
      '898.744924840933',
      '',
      '-18.193548387096776',
      '53.51404786680541',
      '39.37669094693028',
      '-18',
      '54',
      '39',
      'Limbic',
      '0.5298988040478381',
      'mca-frontal',
      '0.9981600735970562',
    ].join(','),
  );
});

test('a structure gives its volume, not its mesh area, and leaves unmeasured shares empty', () => {
  const [header, , row] = records(regionTableCsv(scope));
  const named = Object.fromEntries(header.map((key, index) => [key, row[index]]));
  assert.equal(named['volume_mm3'], '2967.8721326742184');
  assert.equal(named['surface_area_mm2'], '');
  assert.equal(named['largest_network'], '');
  assert.equal(named['largest_territory_share'], '');
});

test('a cell holding a comma or a quote is quoted, its quotes doubled', () => {
  const line = regionTableCsv(scope).split('\r\n')[2];
  assert.ok(line.startsWith('learning:left:caudate,learning,"Caudate nucleus, ""head""",'), line);
  assert.equal(records(regionTableCsv(scope))[2][2], 'Caudate nucleus, "head"');
});

test('a region without its centroid fails rather than writing an empty cell', () => {
  assert.throws(
    () =>
      regionTableCsv({ ...scope, regions: [asRegion({ ...area, centroid_ras_mm: undefined })] }),
    /destrieux:left:1 has no centroid/,
  );
});

test('the file is named by brain, atlas and level', () => {
  assert.equal(regionTableFilename(scope), 'planum-regions-cdmd-destrieux-learning.csv');
});
