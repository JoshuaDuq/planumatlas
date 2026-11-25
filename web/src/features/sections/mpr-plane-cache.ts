import { untrack } from 'svelte';
import type {
  EngineSections,
  EngineTracts,
  MprPlane,
  MriDisplay,
  PlaneFrame,
  PlaneSlice,
  PlaneTracts,
  SectionsState,
  Vec3,
} from '../../lib/engine/api.ts';
import { blendFa, drawSlice, drawTracts, faLevels } from './mpr-draw.ts';
import type { Crop } from './mpr-draw.ts';

interface Made<T> {
  key: string;
  value: T;
}

function reuse<T>(made: Made<T> | undefined, key: string, make: () => T): Made<T> {
  return made?.key === key ? made : { key, value: make() };
}

/** What the planes are drawn from. Read inside an effect, each is a dependency of it. */
export interface PlanesView<Id extends string = MprPlane> {
  display: MriDisplay;
  /** The pictures shown; only they keep anything. */
  shown: readonly Id[];
  canvases: Partial<Record<Id, HTMLCanvasElement | null>>;
  frames: Record<Id, PlaneFrame>;
  /** The part of each sampled square a picture shows; the whole square without one. */
  crops?: Partial<Record<Id, Crop>>;
  sections: Pick<SectionsState, 'overlay' | 'agreement' | 'paint' | 'labels'>;
  /** Changes whenever how the reader's map is drawn does; undefined while none is. */
  mapKey: string | undefined;
  /** Changes whenever what the stage draws of this brain's tracts does; null when the planes draw none. */
  tractsKey: string | null;
  /** FA's opacity while it is shown, else null. */
  faOpacity: number | null;
}

/** What the cache reads only while it samples, so that a change to it alone draws nothing. */
export interface PlaneSources {
  engine: () => {
    sections: Pick<EngineSections, 'slice' | 'pixels'>;
    tracts: Pick<EngineTracts, 'onPlane'>;
  };
  fa: () => ((point: Vec3) => number) | null;
}

/**
 * The Linked MRI's per-plane sample cache (SECT-38). A plane is resampled only when its own slice
 * changes: the crosshair moving within it is marked over the picture, not drawn into it. Window,
 * Level and FA opacity draw it again from what it kept of its last drawing, each part by what it was
 * made from: the slice's samples, FA's levels and the tracts on it. The paint is named by its id and
 * the cut labels that draw it, so other cut labels sample the slice again. A plane nobody can see is
 * drawn when it is shown (sections.js:315-351), and a canvas that replaced another is drawn afresh.
 * Only the planes shown keep anything, and only while the MRI is open.
 */
export function createPlaneCache<Id extends string = MprPlane>({ engine, fa }: PlaneSources) {
  const drawn = new Map<Id, { canvas: HTMLCanvasElement; key: string }>();
  const kept = new Map<
    Id,
    {
      slice: Made<PlaneSlice>;
      fa: Made<Int16Array> | undefined;
      tracts: Made<PlaneTracts> | undefined;
    }
  >();
  return {
    /** The MRI closed: nothing is kept. */
    clear(): void {
      kept.clear();
    },

    /** Draw each plane shown whose picture has changed, from what it kept where it can. */
    draw({
      display,
      shown,
      canvases,
      frames,
      crops = {},
      sections,
      mapKey,
      tractsKey,
      faOpacity,
    }: PlanesView<Id>): void {
      const { overlay, agreement, paint, labels } = sections;
      for (const plane of kept.keys()) if (!shown.includes(plane)) kept.delete(plane);
      for (const plane of shown) {
        const canvas = canvases[plane]!;
        const frame = frames[plane];
        const crop = crops[plane];
        const place = JSON.stringify([frame.center, frame.u, frame.v]);
        // A crop samples only its own pixels, so what is kept is named by it too.
        const sampled = JSON.stringify([place, crop]);
        const slice = JSON.stringify([sampled, overlay, agreement, paint, labels, mapKey]);
        const onPlane = tractsKey === null ? null : JSON.stringify([place, tractsKey]);
        const key = JSON.stringify([
          slice,
          display.windowCenter,
          display.windowWidth,
          onPlane,
          faOpacity !== null && faOpacity,
        ]);
        const last = drawn.get(plane);
        if (last?.canvas === canvas && last.key === key) continue;
        drawn.set(plane, { canvas, key });
        untrack(() => {
          const live = engine();
          const held = kept.get(plane);
          const layers = {
            slice: reuse(held?.slice, slice, () => live.sections.slice(frame, crop)),
            fa:
              faOpacity !== null
                ? reuse(held?.fa, sampled, () =>
                    faLevels(frame, display.size, display.fieldOfView, fa()!, crop),
                  )
                : undefined,
            tracts: onPlane
              ? reuse(held?.tracts, onPlane, () => live.tracts.onPlane(frame))
              : undefined,
          };
          kept.set(plane, layers);
          const pixels = live.sections.pixels(layers.slice.value);
          if (layers.fa) blendFa(pixels, layers.fa.value, faOpacity!);
          if (layers.tracts) {
            drawTracts(pixels, display.size, display.fieldOfView, layers.tracts.value);
          }
          drawSlice(canvas, pixels, display.size, crop);
        });
      }
    },
  };
}
