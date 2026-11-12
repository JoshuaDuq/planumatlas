import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  GreaterDepth,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  Plane,
  Vector4,
} from 'three';
import type { Object3D, WebGLProgramParametersWithUniforms } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { readDiffusionAsset } from '../../core/assets/diffusion-assets.ts';
import type { TractBundle, TractCatalog } from '../../core/diffusion/catalogs.ts';
import { rasToWorld, worldToRas } from '../slices/coordinates.ts';
import { TRACT_SLAB_MM } from '../api.ts';
import type { LesionSphere, PlaneFrame, PlaneTracts } from '../api.ts';
import { streamlineMembership } from '../lesion/measure.ts';
import type { Ras } from '../slices/coordinates.ts';
import {
  MOTION_STRIDE,
  RAS_MM_TO_WORLD,
  createMotionGeometry,
  createTractGeometry,
  filterTractGeometry,
  segmentsNearPlane,
} from './native-geometry.ts';
import { createReferenceTransform } from './reference-space.ts';
import { summarizeLengths } from './streamlines.ts';
import type { LengthSummary } from './streamlines.ts';
import type { TractLoader } from './tract-file.ts';

/** One loaded bundle, with its length summary at the current minimum. */
export type TractSnapshot = LengthSummary & {
  id: string;
  catalogId: string;
  name: string;
  label: TractBundle['name'];
  file: string;
  visible: boolean;
};

/** How strongly a landmark's bundle shows where the anatomy in front of it hides it. */
const HIDDEN_OPACITY = 0.3;

/** How far the cut face's tracts sit off it, on the side cut away, so the cap does not hide them. */
const FACE_LIFT_MM = 0.5;

type TractLines = LineSegments<
  ReturnType<typeof createTractGeometry>['geometry'],
  LineBasicMaterial
>;

interface LoadedBundle {
  bundle: TractBundle;
  lines: TractLines;
  /** The same lines, drawn faint only where a surface in front hides them. */
  hidden: TractLines;
  /** The same lines near the cut, laid on its face. */
  face: TractLines;
  /** Every point, drawn at rest, and the coarser lines drawn while the camera moves. */
  still: BufferGeometry;
  moving: BufferGeometry;
  lengths: Float64Array;
  offsets: Uint32Array;
  /** Ordinary tract visibility, retained while the lesion or a landmark isolates a bundle. */
  visible: boolean;
}

/**
 * The one bundle drawn alone: the lesion's streamlines through its sphere, or a landmark's whole
 * bundle with its hidden stretches faint. It shows once `ready`.
 */
interface Isolated {
  id: string;
  ready: boolean;
  membership?: Uint8Array;
  whole: boolean;
}

interface ReferenceSpace {
  anatomy: string;
  scanner_ras_to_surface_ras: number[][];
}

type PlaneAxes = Pick<PlaneFrame, 'center' | 'normal' | 'u' | 'v'>;

function requireMinimum(value: number): void {
  if (!Number.isFinite(value) || value < 1) {
    throw new RangeError('Minimum streamline length must be at least 1 mm.');
  }
}

/** A bundle's streamlines, and where a landmark's run behind the anatomy, their faint remainder. */
function lineMaterials(clippingPlanes: Plane[]) {
  return {
    shown: new LineBasicMaterial({ vertexColors: true, toneMapped: false, clippingPlanes }),
    // Transparent, so it draws after every opaque surface it is tested against.
    hidden: new LineBasicMaterial({
      vertexColors: true,
      toneMapped: false,
      clippingPlanes,
      transparent: true,
      opacity: HIDDEN_OPACITY,
      depthFunc: GreaterDepth,
      depthWrite: false,
    }),
  };
}

/**
 * What the linked MRI draws of the bundles on a slice, laid on the 3D cut's face: the lines within
 * TRACT_SLAB_MM of the cut (`cut()`, world metres, kept side positive), flattened onto it.
 * The slab test runs on the real points; only the drawn position is moved onto the face.
 */
function cutFaceMaterial(cut: () => Plane) {
  const slab = [new Plane(), new Plane()];
  const plane = { value: new Vector4() };
  const material = new LineBasicMaterial({
    vertexColors: true,
    toneMapped: false,
    clippingPlanes: slab,
  });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.cutPlane = plane;
    shader.vertexShader = `uniform vec4 cutPlane;
${shader.vertexShader}`.replace(
      '#include <clipping_planes_vertex>',
      `#include <clipping_planes_vertex>
vec4 onFace = modelMatrix * vec4(transformed, 1.0);
onFace.xyz -= cutPlane.xyz * (dot(cutPlane.xyz, onFace.xyz) + cutPlane.w + ${FACE_LIFT_MM / 1000});
gl_Position = projectionMatrix * viewMatrix * onFace;`,
    );
  };
  // Before the renderer reads the clipping planes, so the face follows the cut as it moves.
  material.onBeforeRender = () => {
    const { normal, constant } = cut();
    const half = TRACT_SLAB_MM / 1000;
    slab[0]!.normal.copy(normal);
    slab[0]!.constant = constant + half;
    slab[1]!.normal.copy(normal).negate();
    slab[1]!.constant = half - constant;
    plane.value.set(normal.x, normal.y, normal.z, constant);
  };
  return material;
}

/**
 * One segment in each of the bundles' materials, uncut, for compiling their programs before the
 * Tracts tab first draws. Never disposed: disposing a material releases the programs it compiled.
 */
export function tractProgramSamples(): LineSegments[] {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(6), 3));
  geometry.setAttribute('color', new BufferAttribute(new Uint16Array(6), 3, true));
  const { shown, hidden } = lineMaterials([]);
  return [new LineSegments(geometry, shown), new LineSegments(geometry, hidden)];
}

/** `loadTract` is the cached decode of each tract file. */
export function createNativeTractViewer(
  catalog: TractCatalog,
  invalidate: () => void,
  loadTract: TractLoader,
) {
  const group = new Group();
  group.name = catalog.id;
  group.visible = false;
  const bundles = new Map<string, LoadedBundle>();
  const loading = new Map<string, Promise<void>>();
  let outline: Object3D | null = null;
  let minimum = 1;
  let inMotion = false;
  let disposed = false;
  let outlineVisible = true;
  let outlineOpacity = catalog.brain_outline.opacity;
  let clippingPlanes: Plane[] = [];
  const faceMaterial = cutFaceMaterial(() => clippingPlanes[0]!);
  let reference: Promise<void> | null = null;
  let isolateRequest = 0;
  let selected: Isolated | null = null;

  function loadReference(): Promise<void> {
    reference ??= readDiffusionAsset(catalog.reference_space).then(({ buffer }) => {
      const space = JSON.parse(new TextDecoder().decode(buffer)) as ReferenceSpace;
      if (space.anatomy !== catalog.anatomy) {
        throw new Error('The tract reference space belongs to a different anatomy.');
      }
      group.matrixAutoUpdate = false;
      group.matrix.copy(createReferenceTransform(space.scanner_ras_to_surface_ras));
      group.updateWorldMatrix(true, true, true);
    });
    reference.catch(() => (reference = null));
    return reference;
  }

  function refresh(entry: LoadedBundle): void {
    const mine = selected?.id === entry.bundle.id ? selected : null;
    const membership = mine?.membership;
    filterTractGeometry(entry.still, entry.offsets, entry.lengths, minimum, 1, membership);
    filterTractGeometry(
      entry.moving,
      entry.offsets,
      entry.lengths,
      minimum,
      MOTION_STRIDE,
      membership,
    );
    entry.lines.visible = selected ? Boolean(mine?.ready) : entry.visible;
    entry.hidden.visible = entry.lines.visible && Boolean(mine?.whole);
    entry.face.visible = entry.lines.visible && clippingPlanes.length > 0;
  }

  async function loadOutline(): Promise<void> {
    if (outline) return;
    const [asset] = await Promise.all([
      readDiffusionAsset(catalog.brain_outline.file),
      loadReference(),
    ]);
    const result = await new GLTFLoader().parseAsync(asset.buffer, '');
    if (disposed) throw new Error('Tract viewer disposed during outline loading.');
    outline = result.scene;
    outline.visible = outlineVisible;
    outline.traverse((mesh) => {
      if (!(mesh instanceof Mesh)) return;
      mesh.geometry.computeVertexNormals();
      (mesh.material as MeshStandardMaterial).dispose();
      mesh.material = new MeshStandardMaterial({
        color: 0xb3babf,
        roughness: 0.8,
        transparent: true,
        opacity: outlineOpacity,
        depthWrite: false,
      });
    });
    group.add(outline);
    group.updateWorldMatrix(true, true, true);
    invalidate();
  }

  async function addBundle(bundle: TractBundle): Promise<void> {
    const tract = await loadTract(bundle);
    if (disposed) throw new Error('Tract viewer disposed during bundle loading.');
    const { geometry, lengths } = createTractGeometry(
      tract.pts,
      tract.offsetPt0,
      tract.lengths,
      tract.colors,
    );
    filterTractGeometry(geometry, tract.offsetPt0, lengths, minimum);
    const moving = createMotionGeometry(geometry, tract.offsetPt0, lengths, minimum);
    const materials = lineMaterials(clippingPlanes);
    const lines = new LineSegments(inMotion ? moving : geometry, materials.shown);
    lines.name = bundle.id;
    lines.matrixAutoUpdate = false;
    lines.matrix.copy(RAS_MM_TO_WORLD);
    lines.matrixWorldNeedsUpdate = true;
    lines.visible = false;
    const hidden = new LineSegments(lines.geometry, materials.hidden);
    hidden.name = `${bundle.id}-hidden`;
    hidden.matrixAutoUpdate = false;
    hidden.matrix.copy(RAS_MM_TO_WORLD);
    hidden.matrixWorldNeedsUpdate = true;
    hidden.visible = false;
    const face = new LineSegments(lines.geometry, faceMaterial);
    face.name = `${bundle.id}-face`;
    face.matrixAutoUpdate = false;
    face.matrix.copy(RAS_MM_TO_WORLD);
    face.matrixWorldNeedsUpdate = true;
    face.visible = false;
    group.add(lines, hidden, face);
    bundles.set(bundle.id, {
      bundle,
      lines,
      hidden,
      face,
      still: geometry,
      moving,
      lengths,
      offsets: tract.offsetPt0,
      visible: false,
    });
    invalidate();
  }

  /** A bundle requested again while it downloads shares the one load, so it is added once. */
  function ensureBundle(bundle: TractBundle): Promise<void> {
    if (bundles.has(bundle.id)) return Promise.resolve();
    let pending = loading.get(bundle.id);
    if (!pending) {
      pending = addBundle(bundle).finally(() => loading.delete(bundle.id));
      loading.set(bundle.id, pending);
    }
    return pending;
  }

  async function loadBundle(bundle: TractBundle): Promise<void> {
    await ensureBundle(bundle);
    setVisible(bundle.id, true);
  }

  /** Hide every bundle but the one asked for, until it is downloaded and placed. */
  async function isolate(bundle: TractBundle, whole: boolean): Promise<LoadedBundle | null> {
    const ask = ++isolateRequest;
    selected = { id: bundle.id, ready: false, whole };
    for (const entry of bundles.values()) refresh(entry);
    invalidate();
    try {
      await Promise.all([loadReference(), ensureBundle(bundle)]);
    } catch (error) {
      // Nothing is isolated after all: the ordinary tracts come back.
      if (ask === isolateRequest) clearIsolated();
      throw error;
    }
    return ask === isolateRequest && !disposed ? bundles.get(bundle.id)! : null;
  }

  function clearIsolated(): void {
    isolateRequest++;
    selected = null;
    for (const entry of bundles.values()) refresh(entry);
    invalidate();
  }

  function setVisible(id: string, visible: boolean): void {
    const entry = bundles.get(id);
    if (!entry) throw new RangeError(`Unknown tract bundle: ${id}`);
    entry.visible = visible;
    refresh(entry);
    invalidate();
  }

  return {
    group,
    scannerToSurface(point: Ras) {
      return worldToRas(rasToWorld(point).applyMatrix4(group.matrix));
    },
    surfaceToScanner(point: Ras) {
      return worldToRas(rasToWorld(point).applyMatrix4(group.matrix.clone().invert()));
    },
    /** What `still` draws of each shown bundle, clipped to the slab about a surface-RAS plane. */
    onPlane({ center, normal, u, v }: PlaneAxes): PlaneTracts {
      const shown = group.visible
        ? [...bundles.values()].filter((entry) => entry.lines.visible)
        : [];
      if (shown.length === 0) return { ends: new Float32Array(0), colors: new Uint8Array(0) };
      // loadReference stops the matrix updating once it has placed the group.
      if (group.matrixAutoUpdate) {
        throw new Error('The tracts were drawn before their reference space loaded.');
      }
      // The plane in scanner RAS, where the points are: the transform is rigid, so its axes stay unit.
      const toScanner = group.matrix.clone().invert();
      const scanner = (point: readonly number[]) =>
        worldToRas(rasToWorld(point as Ras).applyMatrix4(toScanner));
      const origin = scanner(center);
      const [n, a, b] = [normal, u, v].map((axis) =>
        scanner(center.map((value, i) => value + axis[i]!)).map((value, i) => value - origin[i]!),
      ) as [number[], number[], number[]];
      const plane = { origin, normal: n, u: a, v: b };
      const pieces = shown.map(({ still }) =>
        segmentsNearPlane(
          still.getAttribute('position').array as Float32Array,
          (still.index!.array as Uint32Array).subarray(0, still.drawRange.count),
          plane,
        ),
      );
      const ends = new Float32Array(pieces.reduce((sum, piece) => sum + piece.ends.length, 0));
      const colors = new Uint8Array(pieces.reduce((sum, piece) => sum + piece.colors.length, 0));
      let at = 0;
      for (const piece of pieces) {
        ends.set(piece.ends, (4 * at) / 3);
        colors.set(piece.colors, at);
        at += piece.colors.length;
      }
      return { ends, colors };
    },
    get ready() {
      return Boolean(outline);
    },
    get anyVisible() {
      return [...bundles.values()].some((entry) => entry.lines.visible);
    },
    get bounds() {
      return new Box3().setFromObject(outline ?? group);
    },
    async load() {
      const initial = catalog.bundles.filter((bundle) => bundle.initial);
      // Downloaded and decoded together, then added in catalogue order after the outline, as before.
      await Promise.all([loadOutline(), ...initial.map(loadTract)]);
      for (const bundle of initial) await loadBundle(bundle);
    },
    loadBundle,
    async showLesionTract(bundle: TractBundle, sphere: LesionSphere): Promise<void> {
      const entry = await isolate(bundle, false);
      if (!entry) return;
      const centre = worldToRas(
        rasToWorld(sphere.centre).applyMatrix4(group.matrix.clone().invert()),
      );
      selected = {
        id: bundle.id,
        ready: true,
        membership: streamlineMembership(
          entry.still.getAttribute('position').array as Float32Array,
          entry.offsets,
          { centre, radius: sphere.radius },
        ),
        whole: false,
      };
      refresh(entry);
      invalidate();
    },
    clearLesionTract: clearIsolated,
    /** A landmark's bundle, every streamline of it at the current minimum. */
    async showLandmarkTract(bundle: TractBundle): Promise<void> {
      const entry = await isolate(bundle, true);
      if (!entry) return;
      selected = { id: bundle.id, ready: true, whole: true };
      refresh(entry);
      invalidate();
    },
    /** Only a landmark's bundle is taken away; the lesion's stays. */
    clearLandmarkTract(): void {
      if (selected?.whole) clearIsolated();
    },
    hasBundle(id: string) {
      return bundles.has(id);
    },
    setVisible,
    setOutlineVisible(value: boolean) {
      outlineVisible = value;
      if (outline) outline.visible = value;
      invalidate();
    },
    setClippingPlanes(planes: Plane[]) {
      if (planes === clippingPlanes) return;
      clippingPlanes = planes;
      for (const entry of bundles.values()) {
        for (const { material } of [entry.lines, entry.hidden]) {
          material.clippingPlanes = planes;
          material.needsUpdate = true;
        }
        entry.face.visible = entry.lines.visible && planes.length > 0;
      }
      invalidate();
    },
    setOpacity(value: number) {
      if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new RangeError('Brain opacity must be between 0 and 1.');
      }
      outlineOpacity = value;
      outline?.traverse((mesh) => {
        if (mesh instanceof Mesh) (mesh.material as MeshStandardMaterial).opacity = value;
      });
      invalidate();
    },
    setMinimum(value: number) {
      // Checked up front, so an empty or part-filtered set never keeps a value that loading rejects.
      requireMinimum(value);
      minimum = value;
      for (const entry of bundles.values()) refresh(entry);
      invalidate();
    },
    /** Draw the coarser lines while the camera moves; the scene redraws at rest with every point. */
    setMotion(moving: boolean) {
      inMotion = moving;
      for (const entry of bundles.values()) {
        entry.lines.geometry =
          entry.hidden.geometry =
          entry.face.geometry =
            moving ? entry.moving : entry.still;
      }
    },
    snapshot(): TractSnapshot[] {
      return [...bundles.values()].map(({ bundle, visible, lengths }) => ({
        id: bundle.id,
        catalogId: bundle.id,
        name: bundle.name.en!,
        label: bundle.name,
        file: bundle.file.split('/').at(-1)!,
        visible,
        ...summarizeLengths(lengths, minimum),
      }));
    },
    dispose() {
      disposed = true;
      isolateRequest++;
      group.traverse((object) => {
        if (object instanceof Mesh || object instanceof LineSegments) {
          object.geometry.dispose();
          (object.material as { dispose(): void }).dispose();
        }
      });
      for (const { lines, still, moving } of bundles.values()) {
        (lines.geometry === still ? moving : still).dispose();
      }
      group.removeFromParent();
      bundles.clear();
    },
  };
}

export type NativeTractViewer = ReturnType<typeof createNativeTractViewer>;
