import type { Mesh, Object3D, Plane } from 'three';
import type { ModelState, Region } from '../types/index.ts';
import type { HoverEvent } from './api.ts';
import type { Emit } from './framing.ts';
import type { EngineScene } from './render/scene.ts';
import type { Highlight } from './tissues/gpu-sections.ts';

/** What the pointer is over, and where (app.js:1700). */
interface Hovered {
  region: Region;
  position: { x: number; y: number } | null;
}

/** What presentation reads of the model. */
export interface PresentationModel {
  readonly state: ModelState;
  readonly visibleMeshes: readonly Mesh[];
  /** The cut's planes, which the anatomy is clipped by; none without a cut. */
  readonly clippingPlanes: readonly Plane[];
  canSelect(region: Region): boolean;
}

export interface PresentationOptions {
  scene: Pick<EngineScene, 'setOutlined' | 'invalidate'>;
  model: PresentationModel;
  sections: {
    readonly active: boolean;
    /** Caps as wide as the plane, which the outline's depth leaves out. */
    readonly stencilCaps: readonly Object3D[];
    setHighlight(highlight: Highlight): void;
  };
  overlay: { readonly outlined: readonly Object3D[] };
  /** The tract reference is shown: nothing is outlined or lit. */
  referenceActive: () => boolean;
  emit: Emit;
}

export interface Presentation {
  /** The pointer came over a region, moved on it, or left (app.js:1798-1806). */
  hover(region: Region | null, position: { x: number; y: number } | null): void;
  /** Forget what the pointer was over (app.js:1434). */
  clearHover(): void;
  /** Mark what the pointer is on and the selection: a surface outlines, and a cut face also lights. */
  outline(): void;
}

/**
 * What is marked on the stage: the pointer's region and the selection, outlined on the surface and,
 * on a cut, lit on the face as well (app.js:1718-1751). Kept out of the state loop: hover answers once per frame of a pointer move.
 */
export function createPresentation({
  scene,
  model,
  sections,
  overlay,
  referenceActive,
  emit,
}: PresentationOptions): Presentation {
  let hovered: Hovered | null = null;

  const publishHover = () =>
    emit('hover', {
      region: hovered?.region ?? null,
      position: hovered?.position ?? null,
    } satisfies HoverEvent);

  /** Mark what the pointer is on — a cut face lights — and name it. */
  function highlight() {
    if (hovered && !model.canSelect(hovered.region)) hovered = null;
    sections.setHighlight({
      hovered: hovered?.region.id,
      selected: model.state.selectedRegion?.id,
    });
    publishHover();
    scene.invalidate();
  }

  function outline() {
    if (referenceActive()) {
      scene.setOutlined();
      return;
    }
    highlight();
    const meshes = model.visibleMeshes;
    const meshFor = (id: string | undefined): Object3D[] => {
      const mesh = id && meshes.find((candidate) => candidate.userData['region_id'] === id);
      return mesh ? [mesh] : [];
    };
    const selected = meshFor(model.state.selectedRegion?.id);
    const overlap = overlay.outlined;
    // An open deficit's regions are painted, not outlined; the outline is the selection's alone.
    scene.setOutlined({
      selected: overlap.length ? overlap : selected,
      hovered: meshFor(hovered?.region.id),
      ...(sections.active && { planes: model.clippingPlanes, leaveOut: sections.stencilCaps }),
    });
  }

  return {
    hover(region, position) {
      const regionChanged = region?.id !== hovered?.region.id;
      hovered = region ? { region, position } : null;
      if (regionChanged) {
        outline();
      } else if (position) {
        publishHover();
      }
    },
    clearHover() {
      hovered = null;
      publishHover();
    },
    outline,
  };
}
