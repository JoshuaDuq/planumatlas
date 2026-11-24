import type {
  DisplaySettings,
  Hemisphere,
  Manifest,
  ModelState,
  Paint,
  Region,
  SurfaceColor,
} from '../../types/index.ts';
import { HEMISPHERES, SURFACE_COLORS } from '../../types/index.ts';
import type {
  CabNpData,
  DomainsData,
  EngineCamera,
  EngineModel,
  FunctionalRegionsData,
  OnProgress,
  SegmentationAgreementData,
  SpinalCordLoad,
  Vec3,
} from '../api.ts';
import { belongsToDetail, visibilityOf } from '../../core/catalog/visibility.ts';
import { labelOf } from '../../core/catalog/labels.ts';
import { groupsByLobe } from '../../core/catalog/lobes.ts';
import { coded, sameSet } from './support.ts';

type FakeFile = { atlas: string; [field: string]: unknown };

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

type Cut = { normal: Vec3; offset: number; reverse: boolean };

/** Positive while the camera, looking along `back`, sees the cut's open side; a reversed cut keeps the other. */
function openSide(back: Vec3, { normal, reverse }: Cut): number {
  // World x, y, z are RAS right, superior and posterior.
  const toward = back[0] * normal[0] - back[2] * normal[1] + back[1] * normal[2];
  return reverse ? -toward : toward;
}

export interface FakeModelOptions {
  manifest: Manifest;
  cabNp?: FakeFile;
  functionalRegions?: FakeFile;
  domains?: FakeFile;
  segmentationAgreement?: SegmentationAgreementData;
  /** Called after every state change, as the real model's `change` event (brain-atlas.js:602). */
  changed: () => void;
  /** The camera `seenAt` looks through, made after the model. */
  camera: () => Pick<EngineCamera, 'view' | 'project'>;
  /** The cut `seenAt` sees faces on, in RAS: its normal, its offset along it, and whether it keeps the other side; null without one. */
  cut: () => Cut | null;
  /** Called when `point` marks a region, as the real engine's `hover` event. */
  pointed: (region: Region | null) => void;
}

/** The model plus the hooks the fake sections drive; the real model's sections call the same methods. */
export interface FakeModel extends EngineModel {
  /** brain-atlas.js:789 (the colour check) and :833 (the scan or map attached by `sections.setSurfaceColor`). */
  applySurfaceColor(mode: SurfaceColor): void;
  /** brain-atlas.js:466. */
  setCutState(cut: { atlas: string; active: boolean }): void;
  /** The visual-field map pairs the hemispheres, or lets them go (`BrainAtlas.showVisualField`). */
  setMedialPair(paired: boolean): void;
  /** Mark a layer downloaded (what `loadLayer` does, brain-atlas.js:364). */
  loadLayer(id: string): void;
  attachMri(): void;
  /** The map the cerebellar surfaces draw (`BrainAtlas.setCerebellarMap`). */
  attachCerebellarMap(): void;
  dispose(): void;
}

interface Dissected {
  hidden: ReadonlySet<string>;
  selectedId: string | null;
  isolatedId: string | null;
}

/**
 * A centroid coordinate off the midline axes, in tenths of a millimetre like the real model's, and the
 * same for the same key. A section through a region then has a non-zero offset on every plane, which
 * the panel's clamp (`offsetThrough`) needs to be tested against.
 */
function spread(key: string, span: number): number {
  let hash = 0;
  for (const character of key) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return Math.round(((hash % 1201) / 600 - 1) * span * 10) / 10;
}

/**
 * In-memory stand-in for `BrainAtlas`. Visibility is C2's `visibilityOf` itself, so a selection is accepted or
 * refused for the reasons the real model gives. A region's geometry counts as downloaded when its atlas layer
 * is. Every download resolves at once.
 */
export function createFakeModel({
  manifest,
  cabNp,
  functionalRegions,
  domains,
  segmentationAgreement,
  changed,
  camera,
  cut,
  pointed,
}: FakeModelOptions): FakeModel {
  const regions = new Map(manifest.regions.map((region) => [region.id, region]));
  const levels = manifest.detail_levels;
  const defaultDetail = (levels.find((level) => level.id === 'learning') ?? levels[0]!).id;
  const layers = new Set<string>();
  /** The region `point` marks. */
  let marked: string | null = null;
  const dissection = { hidden: new Set<string>(), history: [] as Dissected[] };
  let envelopes = false;
  let spinalCord: SpinalCordLoad = 'unloaded';
  let mri = false;
  let cerebellarMapped = false;
  let disposed = false;
  let selectedId: string | null = null;

  const values = {
    atlas: manifest.atlases[0]!.id,
    detail: defaultDetail,
    internalSystem: null as string | null,
    internalConstituents: new Set<string>(),
    cutAtlas: null as string | null,
    cutActive: false,
    hemisphere: 'both' as Hemisphere,
    cortexVisible: true,
    cortexOpacity: 1,
    exploded: false,
    internalVisible: true,
    spinalCordVisible: false,
    surfaceColor: 'atlas' as SurfaceColor,
    paint: null as Paint | null,
    isolatedRegion: null as string | null,
    focused: false,
    ghostedAround: null as ReadonlySet<string> | null,
  };
  layers.add(values.atlas);
  layers.add(values.detail);
  // What the real model keeps of each kind besides the one shown (brain-atlas.ts `release`, ATLAS-10).
  const previous = { atlas: null as string | null, detail: null as string | null };
  const release = (kind: readonly { id: string }[], kept: readonly (string | null)[]) => {
    for (const { id } of kind) if (!kept.includes(id)) layers.delete(id);
  };

  let spinalCordRequest = 0;
  let medialPair = false;
  const unknownLayer = (message: string) => coded(message, 'unknown-layer');
  const settings = (): DisplaySettings => ({
    ...values,
    internalConstituents: new Set(values.internalConstituents),
    hiddenRegions: new Set(dissection.hidden),
    dissectionCanUndo: dissection.history.length > 0,
  });

  const hidden = (region: Region) => !visibilityOf(region, settings()).visible;

  const canSelect = (region: Region) =>
    !(region.supplemental && !layers.has(region.atlas ?? '')) && !hidden(region);

  /** A selection the new settings no longer show is dropped, as `update` does (brain-atlas.js:519). */
  function update() {
    const region = selectedId ? regions.get(selectedId) : undefined;
    if (region && !canSelect(region)) {
      selectedId = null;
      values.focused = false;
    }
    changed();
  }

  const requireBoolean = (value: unknown, what: string) => {
    if (typeof value !== 'boolean') throw new TypeError(`${what} must be boolean.`);
  };

  const requireRegions = (ids: readonly string[]) => {
    for (const id of ids) if (!regions.has(id)) throw new Error(`Unknown region: ${id}`);
  };

  /** brain-atlas.js dissection: one history entry per action, no-ops add none (state/dissection.js:15). */
  function replaceHidden(next: Set<string>) {
    if (sameSet(next, dissection.hidden)) return false;
    dissection.history.push({
      hidden: dissection.hidden,
      selectedId,
      isolatedId: values.isolatedRegion,
    });
    dissection.hidden = next;
    return true;
  }

  function select(id: string | null) {
    if (id !== null) {
      const region = regions.get(id);
      if (!region) throw new Error(`Unknown region: ${id}`);
      if (region.kind === 'non-region') throw new Error(`Cannot select a non-region: ${id}`);
      if (!canSelect(region)) throw new Error(`Region is not visible: ${id}`);
    }
    selectedId = id;
    if (id === null) values.focused = false;
    update();
  }

  /** A placement spread by side and id, as a published one is fixed per region. */
  function centroid(id: string | null): Vec3 | null {
    const region = id ? regions.get(id) : undefined;
    if (!region || region.kind === 'non-region') return null;
    const side = region.hemisphere === 'left' ? -1 : region.hemisphere === 'right' ? 1 : 0;
    return [side * 30, spread(region.id, 60), spread(`${region.id}:z`, 40)];
  }

  const model: FakeModel = {
    manifest,
    regions,
    // A test supplies only the fields it reads; the contract types the whole published file.
    cabNp: (cabNp ?? null) as unknown as CabNpData | null,
    functionalRegions: (functionalRegions ?? null) as unknown as FunctionalRegionsData | null,
    domains: (domains ?? null) as unknown as DomainsData | null,
    boundaryCertainty: null,
    segmentationAgreement: segmentationAgreement ?? null,
    receptors: null,
    stimulation: null,
    ftract: null,
    connectivity: null,
    disorders: null,
    defaultDetail,
    get settings() {
      return settings();
    },
    get state(): ModelState {
      return {
        ...settings(),
        selectedRegion: (selectedId && regions.get(selectedId)) || null,
        visibleMeshCount: [...regions.values()].filter(
          (region) => region.kind !== 'tissue-region' && layerLoaded(region) && !hidden(region),
        ).length,
      };
    },
    get disposed() {
      return disposed;
    },
    hasLayer: (id) => layers.has(id),
    get envelopesLoaded() {
      return envelopes;
    },
    get spinalCordLoad() {
      return spinalCord;
    },
    isRegionDrawn(id) {
      const region = regions.get(id);
      return Boolean(
        region && region.kind !== 'tissue-region' && layerLoaded(region) && !hidden(region),
      );
    },
    centroidOf: centroid,
    // A millimetre off the centroid, so a test can tell which of the two a command used.
    anchorOf(id) {
      const point = centroid(id);
      return point && [point[0], point[1] + 1, point[2]];
    },
    canSelect,
    // Nothing is drawn to meet a ray. A drawn region whose anchor lies on the camera's side of the brain's
    // centre shows as a disc round its anchor, a quarter of its surface in area, a convex body's mean; a
    // cut seen from its open side shows, in front of those, a face for each drawn region whose anchor lies
    // within 10 mm of the plane: that slice of a 10 mm ball, round the anchor moved onto the plane. A point
    // is seen as the nearest of the discs that hold it: on a surface where the point itself lies on the
    // disc, so it projects back to where it was asked, as a ray's hit does; on a face at the disc's centre,
    // which is on the plane.
    seenAt(points) {
      const { view, project } = camera();
      if (!view.scale) return points.map(() => null);
      const scale = view.scale.pixels / view.scale.millimetres;
      const back = view.basis.back;
      const plane = cut();
      const toward = plane ? openSide(back, plane) : 0;
      const discs: { id: string; face: boolean; drawn: Vec3; radius: number }[] = [];
      for (const region of regions.values()) {
        if (region.kind !== 'cortex' && region.kind !== 'structure') continue;
        if (!model.isRegionDrawn(region.id)) continue;
        const anchor = model.anchorOf(region.id)!;
        if (plane && toward > 0) {
          const distance = dot(anchor, plane.normal) - plane.offset;
          if (Math.abs(distance) < 10) {
            discs.push({
              id: region.id,
              face: true,
              drawn: [
                anchor[0] - distance * plane.normal[0],
                anchor[1] - distance * plane.normal[1],
                anchor[2] - distance * plane.normal[2],
              ],
              radius: Math.sqrt(100 - distance * distance) * scale,
            });
          }
        }
        if (dot(anchor, back) <= 0) continue;
        if (region.surface_area_mm2 === undefined) {
          throw new Error(`The manifest gives no surface area for ${region.id}.`);
        }
        discs.push({
          id: region.id,
          face: false,
          drawn: anchor,
          radius: Math.sqrt(region.surface_area_mm2 / 4 / Math.PI) * scale,
        });
      }
      const centres = project(discs.map(({ drawn }) => drawn));
      return points.map(({ x, y }) => {
        let [best, least] = [-1, Infinity];
        discs.forEach((disc, index) => {
          const centre = centres[index];
          if (!centre) return;
          const off = Math.hypot(centre.x - x, centre.y - y);
          if (off > disc.radius) return;
          // A face stands in front of every surface.
          const rank = off + (disc.face ? 0 : 1e6);
          if (rank < least) [best, least] = [index, rank];
        });
        if (best < 0) return null;
        const { id, face, drawn } = discs[best]!;
        if (face) return { id, face, drawn };
        const centre = centres[best]!;
        const [across, up] = [(x - centre.x) / scale, (centre.y - y) / scale];
        const { right, up: top } = view.basis;
        return {
          id,
          face,
          drawn: [
            drawn[0] + across * right[0] + up * top[0],
            drawn[1] + across * right[1] + up * top[1],
            drawn[2] + across * right[2] + up * top[2],
          ],
        };
      });
    },
    // As the real engine: a region no click could select is not marked, and only a change is reported.
    point(id) {
      const region = id === null ? null : regions.get(id);
      if (region === undefined) throw new Error(`Unknown region: ${id}`);
      const next = region && canSelect(region) ? region : null;
      if ((next?.id ?? null) === marked) return;
      marked = next?.id ?? null;
      pointed(next);
    },
    // As `seenAt`: a drawn region's point is in sight on the camera's side of the brain's centre, or on
    // the cut's plane while the reader sees its open side.
    inSight(targets) {
      const back = camera().view.basis.back;
      const plane = cut();
      return targets.map(({ id, point }) => {
        if (!regions.has(id)) throw new Error(`Unknown region: ${id}`);
        if (!model.isRegionDrawn(id)) return false;
        const onFace =
          plane !== null &&
          openSide(back, plane) > 0 &&
          Math.abs(dot(point, plane.normal) - plane.offset) < 1e-6;
        return onFace || dot(point, back) > 0;
      });
    },

    select,
    setInternalSystem(system) {
      if (
        system !== null &&
        !manifest.regions.some(
          (r) =>
            r.kind === 'structure' &&
            belongsToDetail(r, values.detail) &&
            labelOf(r, 'en')?.group === system,
        )
      ) {
        throw new Error(`Unknown internal anatomy system: ${system}`);
      }
      values.internalSystem = system;
      values.internalConstituents = new Set(
        manifest.regions
          .filter((r) => r.atlas === 'learning' && r.system_names?.en === system)
          .flatMap((r) => r.constituent_regions ?? []),
      );
      values.isolatedRegion = null;
      update();
    },
    setHemisphere(hemisphere) {
      if (!HEMISPHERES.includes(hemisphere)) throw new Error(`Invalid hemisphere: ${hemisphere}`);
      values.hemisphere = hemisphere;
      values.isolatedRegion = null;
      update();
    },
    setCortexVisible(visible) {
      requireBoolean(visible, 'Cortex visibility');
      values.cortexVisible = visible;
      values.isolatedRegion = null;
      update();
    },
    setCortexOpacity(opacity) {
      if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
        throw new RangeError('Cortex opacity must be between 0 and 1.');
      }
      values.cortexOpacity = opacity;
      update();
    },
    setExploded(exploded) {
      if (typeof exploded !== 'boolean') throw new TypeError('The exploded view must be boolean.');
      if (exploded && values.cutActive) {
        throw new Error('A cut shows the anatomy where it lies; close it before exploding.');
      }
      if (exploded && medialPair) {
        throw new Error('The visual-field map pairs the hemispheres; close it before exploding.');
      }
      values.exploded = exploded;
      update();
    },
    setInternalVisible(visible) {
      requireBoolean(visible, 'Internal anatomy visibility');
      values.internalVisible = visible;
      values.isolatedRegion = null;
      update();
    },
    async setSpinalCordVisible(visible, onProgress?: OnProgress) {
      requireBoolean(visible, 'Spinal cord visibility');
      if (disposed) throw new Error('BrainAtlas has been disposed.');
      const request = ++spinalCordRequest;
      if (visible) {
        await model.ensureSpinalCord(onProgress);
        if (request !== spinalCordRequest) return;
      }
      values.spinalCordVisible = visible;
      values.isolatedRegion = null;
      update();
    },
    setSurfaceColor(mode) {
      model.applySurfaceColor(mode);
    },
    setPaint(paint) {
      if (paint !== null && (typeof paint.id !== 'string' || !(paint.colors instanceof Map))) {
        throw new TypeError('A paint needs an id and a Map of region colours.');
      }
      if ((paint?.id ?? null) === (values.paint?.id ?? null)) return;
      values.paint = paint;
      update();
    },
    isolate() {
      if (!selectedId) throw new Error('Select a region before isolating.');
      values.isolatedRegion = selectedId;
      update();
    },
    clearIsolation() {
      values.isolatedRegion = null;
      update();
    },
    setFocused(focused) {
      requireBoolean(focused, 'Focus');
      if (focused && !selectedId) throw new Error('Select a region before focusing.');
      values.focused = focused;
      update();
    },
    ghostAround(ids) {
      if (ids !== null) requireRegions(ids);
      values.ghostedAround =
        ids && new Set(ids.flatMap((id) => [id, ...(regions.get(id)!.constituent_regions ?? [])]));
      update();
    },
    hideRegions(ids) {
      requireRegions(ids);
      if (!replaceHidden(new Set([...dissection.hidden, ...ids]))) return;
      if (values.isolatedRegion && dissection.hidden.has(values.isolatedRegion))
        values.isolatedRegion = null;
      update();
    },
    showRegions(ids) {
      requireRegions(ids);
      const shown = new Set(ids);
      if (replaceHidden(new Set([...dissection.hidden].filter((id) => !shown.has(id))))) update();
    },
    restoreHiddenRegions() {
      if (replaceHidden(new Set())) update();
    },
    undoDissection() {
      const previous = dissection.history.pop();
      if (!previous) return;
      dissection.hidden = new Set(previous.hidden);
      values.isolatedRegion = null;
      const isolated = previous.isolatedId ? regions.get(previous.isolatedId) : undefined;
      if (isolated && canSelect(isolated)) values.isolatedRegion = isolated.id;
      const selected = previous.selectedId ? regions.get(previous.selectedId) : undefined;
      select(selected && canSelect(selected) ? selected.id : null);
    },
    loadHiddenRegions(ids) {
      requireRegions(ids);
      dissection.hidden = new Set(ids);
      dissection.history = [];
      if (values.isolatedRegion && dissection.hidden.has(values.isolatedRegion)) {
        values.isolatedRegion = null;
      }
      update();
    },
    reset() {
      spinalCordRequest++;
      dissection.hidden = new Set();
      dissection.history = [];
      values.internalSystem = null;
      values.internalConstituents = new Set();
      values.hemisphere = 'both';
      values.cortexVisible = true;
      values.cortexOpacity = 1;
      values.exploded = false;
      values.internalVisible = true;
      values.spinalCordVisible = false;
      values.surfaceColor = 'atlas';
      values.isolatedRegion = null;
      values.ghostedAround = null;
      select(null);
    },

    async setAtlas(id) {
      if (!manifest.atlases.some((atlas) => atlas.id === id))
        throw unknownLayer(`Unknown atlas: ${id}`);
      layers.add(id);
      if (id !== values.atlas) previous.atlas = values.atlas;
      values.atlas = id;
      release(manifest.atlases, [id, previous.atlas]);
      if (values.surfaceColor === 'cab-np' && id !== cabNp?.atlas) values.surfaceColor = 'atlas';
      if (values.surfaceColor === 'lobe' && !groupsByLobe(id)) values.surfaceColor = 'atlas';
      values.isolatedRegion = null;
      select(null);
    },
    async setDetail(id) {
      if (!levels.some((level) => level.id === id))
        throw unknownLayer(`Unknown detail level: ${id}`);
      layers.add(id);
      if (id !== values.detail) previous.detail = values.detail;
      values.detail = id;
      release(levels, [id, previous.detail]);
      values.internalSystem = null;
      values.internalConstituents = new Set();
      values.isolatedRegion = null;
      update();
    },
    async ensureEnvelopes() {
      envelopes = true;
    },
    async ensureSpinalCord() {
      if (!(manifest.supplemental_layers ?? []).some((layer) => layer.id === 'pam50')) {
        throw new Error('This anatomy does not publish a spinal cord.');
      }
      layers.add('pam50');
      spinalCord = 'ready';
      update();
    },
    async ensureSupplementalLayer(id) {
      if (!(manifest.supplemental_layers ?? []).some((layer) => layer.id === id)) {
        throw unknownLayer(`This anatomy publishes no supplemental layer ${id}.`);
      }
      layers.add(id);
      if (id === 'pam50') spinalCord = 'ready';
      update();
    },
    async prefetchLayer(id) {
      if (
        !manifest.atlases.some((atlas) => atlas.id === id) &&
        !levels.some((level) => level.id === id)
      ) {
        throw unknownLayer(`Unknown layer: ${id}`);
      }
      layers.add(id);
    },

    applySurfaceColor(mode) {
      if (!SURFACE_COLORS.includes(mode)) throw new TypeError(`Unknown surface colour: ${mode}`);
      if (mode === 'mri' && !mri) throw new Error('MRI must load before selecting MRI appearance.');
      if (mode === 'network' && !manifest.networks)
        throw new Error('This model carries no network layer.');
      if (mode === 'territory' && !manifest.arterial_territories)
        throw new Error('This model carries no arterial territories.');
      if (mode === 'striatal' && !manifest.striatal_networks)
        throw new Error('This model carries no striatal networks.');
      if (mode === 'cerebellar' && !manifest.cerebellar_functions)
        throw new Error('This model carries no cerebellar functional regions.');
      if (mode === 'cerebellar' && !cerebellarMapped)
        throw new Error('The cerebellar map must load before the cerebellar surfaces draw it.');
      if (mode === 'lobe' && !groupsByLobe(values.atlas)) {
        throw new Error(`${values.atlas} groups no regions by lobe; show a lobe atlas first.`);
      }
      if (mode === 'cab-np') {
        if (!cabNp) throw new Error('This model carries no CAB-NP partition.');
        if (values.atlas !== cabNp.atlas) {
          throw new Error(`CAB-NP colours ${cabNp.atlas} areas; show that atlas first.`);
        }
      }
      values.surfaceColor = mode;
      update();
    },
    setCutState({ atlas, active }) {
      if (atlas === values.cutAtlas && active === values.cutActive) return;
      values.cutAtlas = atlas;
      values.cutActive = active;
      if (active) values.exploded = false;
      update();
    },
    setMedialPair(paired) {
      if (paired === medialPair) return;
      medialPair = paired;
      if (paired) values.exploded = false;
      update();
    },
    loadLayer(id) {
      layers.add(id);
    },
    attachMri() {
      mri = true;
    },
    attachCerebellarMap() {
      cerebellarMapped = true;
    },
    dispose() {
      disposed = true;
    },
  };

  /** A region's geometry is downloaded: its atlas or detail layer is in. */
  function layerLoaded(region: Region): boolean {
    return layers.has(region.atlas ?? '');
  }

  return model;
}
