// The named visual areas on the visual-field map: their borders on the cortex, and where each area's
// name stands on the stage, carried with the surface the cortex is drawn on and with the medial pair.
import { Raycaster, Vector3 } from 'three';
import type { Camera, Intersection } from 'three';
import type { VisualAreaAnchor } from '../core/learning/visual-field.ts';
import type { CortexSurface } from '../core/user-map/display.ts';
import type { Size, VisualAreaName } from '../types/index.ts';
import type { BrainAtlas } from './model/brain-atlas.ts';
import { rasToWorld } from './slices/coordinates.ts';

/** How far in front of an anchor the drawn surface may be met with the anchor still in sight: 1.5 mm. */
const IN_SIGHT_M = 0.0015;

export interface VisualAreasOptions {
  atlas: Pick<BrainAtlas, 'showVisualAreas' | 'medialPair' | 'layers' | 'settings'>;
  camera: Camera;
  hostSize: () => Size;
  /** The nearest drawn surface along a ray, a cut's faces among them. */
  intersect: (raycaster: Raycaster) => Pick<Intersection, 'distance'> | null;
  /** The surface the shown atlas's cortex is drawn on. */
  surface: () => CortexSurface;
  /** Every area's anchors, read once from the published sidecar. */
  anchors: () => Promise<readonly VisualAreaAnchor[]>;
  invalidate: () => void;
}

export function createVisualAreas(options: VisualAreasOptions) {
  const { atlas, camera } = options;
  let shown = false;
  let anchors: readonly VisualAreaAnchor[] | null = null;
  let request = 0;
  const raycaster = new Raycaster();
  const eye = new Vector3();

  /** Where an anchor is drawn now, or null on a hemisphere none of whose cortex is drawn. */
  function drawnAt({ hemisphere, pial, white }: VisualAreaAnchor, surface: CortexSurface) {
    const mesh = atlas.layers
      .get(atlas.settings.atlas)
      ?.meshes.find(
        (candidate) => candidate.visible && candidate.userData['hemisphere'] === hemisphere,
      );
    if (!mesh) return null;
    const depth = surface === 'pial' ? 0 : surface === 'mid' ? 0.5 : 1;
    const point = pial.map((value, axis) => value + depth * (white[axis]! - value)) as [
      number,
      number,
      number,
    ];
    mesh.updateWorldMatrix(true, false);
    return rasToWorld(point).applyMatrix4(mesh.matrixWorld);
  }

  return {
    /** See `EngineVisualField.showAreas`. */
    async show(on: boolean): Promise<void> {
      const ask = ++request;
      if (on) {
        const loaded = await options.anchors();
        if (ask !== request) return;
        anchors = loaded;
      }
      shown = on;
      atlas.showVisualAreas(on);
      options.invalidate();
    },

    /** See `EngineVisualField.areaNames`. */
    names(): VisualAreaName[] {
      if (!shown || !anchors || !atlas.medialPair) return [];
      camera.updateMatrixWorld();
      camera.getWorldPosition(eye);
      const { width, height } = options.hostSize();
      const surface = options.surface();
      return anchors.map((anchor) => {
        const { name, hemisphere } = anchor;
        const world = drawnAt(anchor, surface);
        const screen = world?.clone().project(camera);
        // Beyond the far side of normalized depth: behind the camera.
        if (!world || !screen || screen.z > 1) return { name, hemisphere, point: null };
        const reach = world.distanceTo(eye);
        raycaster.set(eye, world.sub(eye).normalize());
        const hit = options.intersect(raycaster);
        if (hit && hit.distance < reach - IN_SIGHT_M) return { name, hemisphere, point: null };
        return {
          name,
          hemisphere,
          point: { x: ((screen.x + 1) / 2) * width, y: ((1 - screen.y) / 2) * height },
        };
      });
    },
  };
}
