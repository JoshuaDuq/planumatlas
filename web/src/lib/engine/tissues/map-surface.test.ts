import assert from 'node:assert/strict';
import { test } from 'vitest';
import { Mesh, MeshPhysicalMaterial, PlaneGeometry, Raycaster, Vector3 } from 'three';
import type { BufferGeometry, Intersection, Material } from 'three';
import { shiftMesh } from '../model/explode.ts';
import { showSurfaceMapRegions, surfaceMapRegionAt } from './map-surface.ts';
import { D2, LABELS, M3, surfaceMap } from './map-surface-test-support.ts';

const plane = (turned = false) => {
  const mesh = new Mesh(new PlaneGeometry(0.0005, 0.0005), new MeshPhysicalMaterial());
  if (turned) mesh.rotation.y = Math.PI;
  mesh.updateMatrixWorld(true);
  return mesh;
};

/** Where a ray along z from the side the plane faces meets it, at world (x, 0). */
function hit(mesh: Mesh, x = 0): Intersection<Mesh<BufferGeometry, Material>> {
  const facing = mesh.rotation.y ? -1 : 1;
  const ray = new Raycaster(new Vector3(x, 0, 0.01 * facing), new Vector3(0, 0, -facing));
  const [first] = ray.intersectObject(mesh);
  assert.ok(first?.barycoord, 'the plane is hit');
  return first as Intersection<Mesh<BufferGeometry, Material>>;
}

const id = (code: number) => LABELS[code]!.region_id;

test('a hit names the map region 1 mm inside the surface, by its normal, not the label at its boundary', () => {
  const map = surfaceMap(M3, D2);
  assert.equal(surfaceMapRegionAt(hit(plane()), map), id(M3));
  // Turned round, the surface's inside is the other slab, whichever side the ray comes from.
  assert.equal(surfaceMapRegionAt(hit(plane(true)), map), id(D2));
});

test('a hit where the map labels no region of its own names none', () => {
  assert.equal(surfaceMapRegionAt(hit(plane()), surfaceMap(1, M3)), null);
  assert.equal(surfaceMapRegionAt(hit(plane()), surfaceMap(0, M3)), null);
});

test('an exploded surface is read where the anatomy has it, not where it is drawn', () => {
  const mesh = plane();
  // 2 mm right puts the drawn plane off the 2 mm-wide grid.
  shiftMesh(mesh, new Vector3(0.002, 0, 0));
  mesh.updateMatrixWorld(true);
  assert.equal(surfaceMapRegionAt(hit(mesh, 0.002), surfaceMap(M3, D2)), id(M3));
});

test('a map region taken off the stage is drawn in no colour of its own, and only a change re-uploads the palette', () => {
  const map = surfaceMap(M3, D2);
  const alpha = () =>
    [...(map.palette.image.data as Float32Array)].filter((_, index) => index % 4 === 3);
  const version = map.palette.version;
  showSurfaceMapRegions(map, (regionId) => regionId !== id(M3));
  assert.deepEqual(alpha(), [0, 0, 0, 1]);
  assert.equal(map.palette.version, version + 1);
  showSurfaceMapRegions(map, (regionId) => regionId !== id(M3));
  assert.equal(map.palette.version, version + 1);
  showSurfaceMapRegions(map, () => true);
  assert.deepEqual(alpha(), [0, 0, 1, 1]);
});
