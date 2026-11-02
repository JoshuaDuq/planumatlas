import {
  Box3,
  BufferGeometry,
  CircleGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Line,
  LineDashedMaterial,
  Matrix3,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector2,
  Vector3,
} from 'three';
import type {
  Camera,
  Object3D,
  PerspectiveCamera,
  Plane,
  WebGLProgramParametersWithUniforms,
  WebGLRenderer,
} from 'three';
import { token } from '../render/tokens.ts';
import { rasToWorld } from '../slices/coordinates.ts';
import type { LesionSphere } from '../api.ts';

type SurfaceMesh = Pick<Mesh, 'geometry' | 'matrixWorld'>;

/**
 * Every triangle whose centroid lies within `radius` of `centre`, three points each, in world space,
 * with the surface's own normals so the paint shades as the cortex beneath it does.
 */
export function footprint(
  meshes: readonly SurfaceMesh[],
  centre: Vector3,
  radius: number,
): { positions: Float32Array; normals: Float32Array } {
  const positions: number[] = [];
  const normals: number[] = [];
  const corners = [new Vector3(), new Vector3(), new Vector3()];
  const turned = [new Vector3(), new Vector3(), new Vector3()];
  const centroid = new Vector3();
  const normalMatrix = new Matrix3();
  const r2 = radius * radius;
  const box = new Box3();
  for (const mesh of meshes) {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    if (
      box.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld).distanceToPoint(centre) >
      radius
    ) {
      continue;
    }
    const position = mesh.geometry.getAttribute('position');
    const normal = mesh.geometry.getAttribute('normal');
    const index = mesh.geometry.getIndex();
    const count = index ? index.count : position.count;
    normalMatrix.getNormalMatrix(mesh.matrixWorld);
    for (let t = 0; t + 2 < count; t += 3) {
      for (let k = 0; k < 3; k++) {
        const vertex = index ? index.getX(t + k) : t + k;
        corners[k]!.fromBufferAttribute(position, vertex).applyMatrix4(mesh.matrixWorld);
        if (normal)
          turned[k]!.fromBufferAttribute(normal, vertex).applyMatrix3(normalMatrix).normalize();
      }
      centroid.copy(corners[0]!).add(corners[1]!).add(corners[2]!).divideScalar(3);
      if (centroid.distanceToSquared(centre) > r2) continue;
      for (let k = 0; k < 3; k++) {
        positions.push(corners[k]!.x, corners[k]!.y, corners[k]!.z);
        if (normal) normals.push(turned[k]!.x, turned[k]!.y, turned[k]!.z);
      }
    }
  }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals) };
}

const RING_SEGMENTS = 128;
const DASH_FRACTION_OF_RADIUS = 0.11;
const DOT_RADIUS_M = 0.0009;
/** The dark band either side of the ring, and around the dot, in CSS pixels whatever the zoom. */
const RING_HALO_PX = 2;
const DOT_HALO_PX = 1.5;

/** Turn a stage marking to face the camera, as the orientation letters do. */
const facing = (object: Object3D) => (_: unknown, __: unknown, camera: Camera) =>
  object.quaternion.copy(camera.quaternion);

const scratch = new Vector3();

/** The world length one CSS pixel spans at `point`, on a stage `height` CSS pixels tall. */
export function cssPixelAt(camera: Camera, height: number, point: Vector3): number {
  if (!(camera as PerspectiveCamera).isPerspectiveCamera) {
    throw new Error('The lesion halo is measured for a perspective camera.');
  }
  const { fov } = camera as PerspectiveCamera;
  const eye = scratch.setFromMatrixPosition(camera.matrixWorld);
  return (2 * point.distanceTo(eye) * Math.tan(((fov / 2) * Math.PI) / 180)) / height;
}

/**
 * A band on a circle of `radius`, both edges at the circle: `side` (-1 inside, +1 outside) moves each
 * edge out by the half-width uniform, so the band keeps its width on screen as the camera zooms.
 */
function bandGeometry(radius: number): BufferGeometry {
  const positions: number[] = [];
  const sides: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= RING_SEGMENTS; i++) {
    const angle = (i / RING_SEGMENTS) * Math.PI * 2;
    const [x, y] = [Math.cos(angle) * radius, Math.sin(angle) * radius];
    positions.push(x, y, 0, x, y, 0);
    sides.push(-1, 1);
    if (i < RING_SEGMENTS) {
      const k = i * 2;
      index.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('side', new Float32BufferAttribute(sides, 1));
  geometry.setIndex(index);
  return geometry;
}

/**
 * The lesion on the stage: where it meets the drawn cortex, painted in the overlay ink, and a dashed
 * ring for its full extent, seen through the brain like the stage's other markings. The ring and the
 * centre dot sit on the overlay halo, as the orientation letters do, so a light cut face keeps them.
 */
export function createLesionMarking() {
  const group = new Group();
  group.name = 'Lesion';
  const ink = new Color();
  const paint = new MeshStandardMaterial({
    roughness: 0.6,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const ringMaterial = new LineDashedMaterial({ depthTest: false, transparent: true });
  const dotMaterial = new MeshBasicMaterial({ depthTest: false, transparent: true });
  const haloMaterial = new MeshBasicMaterial({ depthTest: false, transparent: true });
  const halfWidth = { value: 0 };
  haloMaterial.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.halfWidth = halfWidth;
    shader.vertexShader = `attribute float side;
uniform float halfWidth;
${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
transformed.xy += normalize(position.xy) * side * halfWidth;`,
    );
  };
  const dotHaloMaterial = new MeshBasicMaterial({ depthTest: false, transparent: true });
  const surface = new Mesh(new BufferGeometry(), paint);
  const ring = new Line(new BufferGeometry(), ringMaterial);
  const dot = new Mesh(new CircleGeometry(DOT_RADIUS_M, 24), dotMaterial);
  const ringHalo = new Mesh(new BufferGeometry(), haloMaterial);
  const dotHalo = new Mesh(new CircleGeometry(DOT_RADIUS_M, 24), dotHaloMaterial);
  ringHalo.renderOrder = dotHalo.renderOrder = 999;
  ring.renderOrder = dot.renderOrder = 1000;
  ring.onBeforeRender = facing(ring);
  dot.onBeforeRender = facing(dot);
  const size = new Vector2();
  const at = new Vector3();
  // Measured where the halo is drawn, so its width holds in CSS pixels at any zoom or resolution.
  const pixel = (renderer: WebGLRenderer, camera: Camera, object: Object3D) =>
    cssPixelAt(camera, renderer.getSize(size).y, at.setFromMatrixPosition(object.matrixWorld));
  ringHalo.onBeforeRender = (renderer, _, camera) => {
    ringHalo.quaternion.copy(camera.quaternion);
    halfWidth.value = RING_HALO_PX * pixel(renderer, camera, ringHalo);
  };
  dotHalo.onBeforeRender = (renderer, _, camera) => {
    dotHalo.quaternion.copy(camera.quaternion);
    dotHalo.scale.setScalar(1 + (DOT_HALO_PX * pixel(renderer, camera, dotHalo)) / DOT_RADIUS_M);
  };
  group.add(surface, ringHalo, dotHalo, ring, dot);
  group.visible = false;

  function applyTheme(): void {
    ink.set(token('--overlay-ink'));
    paint.color.copy(ink);
    ringMaterial.color.copy(ink);
    dotMaterial.color.copy(ink);
    const halo = new Color(token('--overlay-halo-core'));
    haloMaterial.color.copy(halo);
    dotHaloMaterial.color.copy(halo);
  }
  applyTheme();

  return {
    group,
    applyTheme,
    /** Draw `sphere` against the drawn cortex, clipped as the cortex is, its footprint at `opacity`; null removes it. */
    show(
      sphere: LesionSphere | null,
      cortex: readonly SurfaceMesh[],
      planes: readonly Plane[],
      opacity: number,
    ): void {
      surface.geometry.dispose();
      ring.geometry.dispose();
      ringHalo.geometry.dispose();
      if (!sphere) {
        surface.geometry = new BufferGeometry();
        ring.geometry = new BufferGeometry();
        ringHalo.geometry = new BufferGeometry();
        group.visible = false;
        return;
      }
      const centre = rasToWorld(sphere.centre);
      const radius = sphere.radius / 1000;
      const { positions, normals } = footprint(cortex, centre, radius);
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      if (normals.length) geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
      else geometry.computeVertexNormals();
      surface.geometry = geometry;
      paint.clippingPlanes = [...planes];
      paint.opacity = opacity;
      paint.transparent = opacity < 1;
      paint.depthWrite = opacity === 1;
      paint.needsUpdate = true;

      const points = Array.from({ length: RING_SEGMENTS + 1 }, (_, i) => {
        const angle = (i / RING_SEGMENTS) * Math.PI * 2;
        return new Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
      });
      ring.geometry = new BufferGeometry().setFromPoints(points);
      ringMaterial.dashSize = radius * DASH_FRACTION_OF_RADIUS;
      ringMaterial.gapSize = radius * DASH_FRACTION_OF_RADIUS * 0.7;
      ring.computeLineDistances();
      ringHalo.geometry = bandGeometry(radius);
      ring.position.copy(centre);
      ringHalo.position.copy(centre);
      dot.position.copy(centre);
      dotHalo.position.copy(centre);
      group.visible = true;
    },
    dispose(): void {
      surface.geometry.dispose();
      ring.geometry.dispose();
      ringHalo.geometry.dispose();
      dot.geometry.dispose();
      dotHalo.geometry.dispose();
      paint.dispose();
      ringMaterial.dispose();
      dotMaterial.dispose();
      haloMaterial.dispose();
      dotHaloMaterial.dispose();
    },
  };
}
