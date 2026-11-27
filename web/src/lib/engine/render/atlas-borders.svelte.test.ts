import { expect, test } from 'vitest';
import {
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  FloatType,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  Vector2,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';
import type { BufferGeometry, Material } from 'three';
import type { Region } from '../../types/index.ts';
import { addAtlasBorders, attachBorders, bordersRegionAt } from '../model/atlas-borders.ts';
import type { BordersUniforms } from '../model/atlas-borders.ts';
import { createAnatomicalMaterial } from './materials.ts';
import type { AnatomicalUserData } from './materials.ts';
import { appearance } from './test-support.ts';

// Real WebGL: the bytes are read in the vertex stage by gl_VertexID and the line is found from screen-space
// derivatives, so only a drawn frame shows where it lies and how wide it is.
const SHADER_COMPILE_TIMEOUT_MS = 60_000;
const SIZE = 64;
const HALF = 0.005;
// Class 1, class 2 and no area as the published bits (`atlas_borders.partition_masks`), each with the
// label plus one of the region it stands for here: b:left:0, b:left:1 and the non-region b:left:-1.
const [ONE, TWO, NONE] = [0b10, 0b100, 0b1];
const LABEL = new Map([
  [ONE, 1],
  [TWO, 2],
  [NONE, 0],
  [ONE | TWO, 1],
]);
const REGIONS = [
  { id: 'a:left:1', atlas: 'a', hemisphere: 'left', kind: 'cortex', vertex_count: 10 },
  { id: 'b:left:0', atlas: 'b', hemisphere: 'left', kind: 'cortex' },
  { id: 'b:left:1', atlas: 'b', hemisphere: 'left', kind: 'cortex' },
  { id: 'b:left:-1', atlas: 'b', hemisphere: 'left', kind: 'non-region' },
] as Region[];

/** A flat strip of four columns of quads: five columns of vertices, two rows. */
function strip(): BufferGeometry {
  const geometry = new PlaneGeometry(2 * HALF, 2 * HALF, 4, 1);
  const count = geometry.getAttribute('position').count;
  for (const name of ['_sulc', '_openness', '_t1']) {
    geometry.setAttribute(name, new Float32BufferAttribute(new Float32Array(count).fill(0.5), 1));
  }
  return geometry;
}

/** The strip as the shown cortex, each vertex column given its class and label; `on` draws the borders. */
function surface(geometry: BufferGeometry, columns: readonly number[], on = true) {
  const material = createAnatomicalMaterial(
    new Mesh(
      geometry,
      new MeshStandardMaterial({ color: '#8a7f78', roughness: 0.6, side: DoubleSide }),
    ),
    REGIONS[0]!,
    appearance,
  );
  (material.userData as AnatomicalUserData).tissueVariation.value = 0;
  addAtlasBorders(material);
  const mesh = new Mesh(geometry, material);
  mesh.userData['region_id'] = 'a:left:1';
  // PlaneGeometry numbers its vertices row by row, left to right.
  const classes = [...columns, ...columns];
  const field = Uint8Array.from([...classes, ...classes.map((code) => LABEL.get(code)!)]);
  attachBorders({ meshes: [mesh as never] }, field, REGIONS, 'a', 'b');
  (material.userData['borders'] as BordersUniforms).bordersMix.value = on ? 1 : 0;
  return mesh;
}

const camera = (span: number) => {
  const view = new OrthographicCamera(-HALF, -HALF + span, span / 2, -span / 2, 0.001, 1);
  view.position.z = 0.1;
  return view;
};

/** The frame's luminance per pixel, the camera spanning `span` of the strip from its left edge. */
function draw(mesh: Mesh<BufferGeometry, Material>, span = 2 * HALF) {
  const renderer = new WebGLRenderer({ canvas: document.createElement('canvas') });
  const scene = new Scene();
  scene.add(mesh);
  const light = new DirectionalLight(0xffffff, Math.PI);
  light.position.set(0.3, 0.4, 1);
  scene.add(light);
  const target = new WebGLRenderTarget(SIZE, SIZE, { type: FloatType });
  renderer.setRenderTarget(target);
  renderer.render(scene, camera(span));
  const pixels = new Float32Array(SIZE * SIZE * 4);
  renderer.readRenderTargetPixels(target, 0, 0, SIZE, SIZE, pixels);
  target.dispose();
  renderer.dispose();
  // dispose() keeps the context; a live one counts against the browser's cap (scene.ts).
  renderer.forceContextLoss();
  return Float32Array.from(
    { length: SIZE * SIZE },
    (_, at) =>
      0.2126 * pixels[4 * at]! + 0.7152 * pixels[4 * at + 1]! + 0.0722 * pixels[4 * at + 2]!,
  );
}

/** What the pointer at the middle of pixel column `x` of the middle row is named in the other atlas. */
function nameAt(mesh: Mesh, x: number): string | null {
  const ray = new Raycaster();
  ray.setFromCamera(new Vector2(((x + 0.5) / SIZE) * 2 - 1, 1 / SIZE), camera(2 * HALF));
  const [hit] = ray.intersectObject(mesh);
  return bordersRegionAt(hit!, new Map(REGIONS.map((region) => [region.id, region])))?.id ?? null;
}

/** The columns of the middle row where `drawn` differs from `plain`. */
function changed(drawn: Float32Array, plain: Float32Array): number[] {
  const row = SIZE / 2;
  return Array.from({ length: SIZE }, (_, x) => x).filter(
    (x) => Math.abs(drawn[row * SIZE + x]! - plain[row * SIZE + x]!) > 0.02,
  );
}

test(
  'BORDER-06 the line lies where two classes meet, midway between their vertices, light cased in dark, as wide on screen at any zoom',
  { timeout: SHADER_COMPILE_TIMEOUT_MS },
  () => {
    const geometry = strip();
    const columns = [ONE, ONE, TWO, TWO, TWO];
    const plain = draw(surface(geometry, columns, false));
    const drawn = draw(surface(geometry, columns));
    // The border is halfway from the second vertex column to the third: x = -1.25 mm, pixel 24 of 64.
    const line = changed(drawn, plain);
    expect(line.length).toBeGreaterThanOrEqual(3);
    expect(line.length).toBeLessThanOrEqual(6);
    expect(line.at(-1)! - line[0]! + 1).toBe(line.length);
    expect((line[0]! + line.at(-1)! + 1) / 2).toBeCloseTo(24, 0);
    // A light core in a dark casing: lighter and darker than the fill it crosses.
    const row = (SIZE / 2) * SIZE;
    const fill = plain[row + 24]!;
    const shades = line.map((x) => drawn[row + x]!);
    expect(Math.max(...shades)).toBeGreaterThan(fill + 0.05);
    expect(Math.min(...shades)).toBeLessThan(fill - 0.05);
    // Twice as close, the border is at pixel 48 and the line as many pixels wide.
    const near = changed(
      draw(surface(geometry, columns), HALF),
      draw(surface(geometry, columns, false), HALF),
    );
    expect((near[0]! + near.at(-1)! + 1) / 2).toBeCloseTo(48, 0);
    expect(Math.abs(near.length - line.length)).toBeLessThanOrEqual(1);
    geometry.dispose();
  },
);

test(
  'BORDER-09 the pointer is named by the other atlas where the line says: one region each side of it, through a vertex holding both',
  { timeout: SHADER_COMPILE_TIMEOUT_MS },
  () => {
    const geometry = strip();
    // A vertex column holding both classes, as the shown atlas adds at a source edge's midpoint.
    for (const [columns, centre] of [
      [[ONE, ONE, TWO, TWO, TWO], 24],
      [[ONE, ONE, ONE | TWO, TWO, TWO], 32],
    ] as const) {
      const mesh = surface(geometry, columns);
      const line = changed(draw(mesh), draw(surface(geometry, columns, false)));
      expect((line[0]! + line.at(-1)! + 1) / 2).toBeCloseTo(centre, 0);
      // The name changes at the line's centre, between the two pixels either side of it.
      expect(
        [line[0]! - 1, centre - 1, centre, line.at(-1)! + 1].map((x) => nameAt(mesh, x)),
      ).toEqual(['b:left:0', 'b:left:0', 'b:left:1', 'b:left:1']);
    }
    geometry.dispose();
  },
);

test(
  'BORDER-06 an area meeting no area is a border, named so, two non-regions are none, and nothing is drawn while off or not loaded',
  { timeout: SHADER_COMPILE_TIMEOUT_MS },
  () => {
    const geometry = strip();
    const plain = draw(surface(geometry, [ONE, ONE, TWO, TWO, TWO], false));
    const unlabelled = surface(geometry, [ONE, ONE, NONE, NONE, NONE]);
    expect(changed(draw(unlabelled), plain).length).toBeGreaterThanOrEqual(3);
    // Past the line the pointer is over the other atlas's non-region, which the chip calls unlabelled.
    expect([nameAt(unlabelled, 20), nameAt(unlabelled, 28)]).toEqual(['b:left:0', 'b:left:-1']);
    expect(changed(draw(surface(geometry, [NONE, NONE, NONE, NONE, NONE])), plain)).toEqual([]);
    const unloaded = surface(geometry, [ONE, ONE, TWO, TWO, TWO]);
    (unloaded.material.userData['borders'] as BordersUniforms).bordersReady.value = false;
    expect(changed(draw(unloaded), plain)).toEqual([]);
    geometry.dispose();
  },
);
