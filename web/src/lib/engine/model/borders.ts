import type { Region } from '../../types/index.ts';
import { fetchAsset } from '../../core/assets/asset-cache.ts';
import { loadOtherAnatomyFiles } from '../../core/assets/published-assets.ts';
import type { SurfaceHit } from '../render/picking.ts';
import type { Layer } from './layers.ts';
import type { AtlasManifest } from './manifest.ts';
import type { SurfaceMaterials } from './surface-materials.ts';

/** What the borders read of the model that draws them. */
export interface BordersModel {
  manifest: AtlasManifest;
  regions: ReadonlyMap<string, Region>;
  layers: ReadonlyMap<string, Layer>;
  materials: Pick<SurfaceMaterials, 'attachBorders'>;
  /** The atlas shown. */
  atlas(): string;
  update(): void;
}

/**
 * Another atlas's borders over the shown cortex: the atlas drawn, the one last asked for, and which atlas's
 * bytes each loaded cortex carries. Their code (`atlas-borders.ts`) and bytes download on first use.
 */
export class Borders {
  /** The atlas whose borders are drawn; null for none. */
  shown: string | null = null;
  private wanted: string | null = null;
  private base: string | URL | null = null;
  private readonly carried = new WeakMap<Layer, string>();
  private request = 0;
  private code: typeof import('./atlas-borders.ts') | null = null;
  private readonly model: BordersModel;

  constructor(model: BordersModel) {
    this.model = model;
  }

  /** Draw `overlay`'s borders, or none; never the shown atlas's own. A later call overtakes one downloading. */
  async set(overlay: string | null, base: string | URL): Promise<void> {
    if (overlay === this.model.atlas()) throw new Error(`The ${overlay} cortex is shown.`);
    const request = ++this.request;
    this.wanted = overlay;
    this.base = base;
    if (overlay !== null) await this.ensure(this.model.atlas(), overlay);
    if (request !== this.request) return;
    this.shown = overlay;
    this.model.update();
  }

  /**
   * Bring the borders to `atlas` before it shows, those asked for meanwhile too; on the atlas they outline
   * they are dropped. False once `current` no longer holds.
   */
  async follow(atlas: string, current: () => boolean): Promise<boolean> {
    while (this.wanted !== null && this.wanted !== atlas) {
      const wanted = this.wanted;
      await this.ensure(atlas, wanted);
      if (!current()) return false;
      if (this.wanted === wanted) break;
    }
    if (this.wanted === atlas) this.clear();
    return true;
  }

  clear(): void {
    this.request += 1;
    this.wanted = this.shown = null;
  }

  /** The drawn atlas's region where a ray met the shown cortex (`bordersRegionAt`); null without borders. */
  regionAt(hit: SurfaceHit): Region | null {
    return this.shown && this.code ? this.code.bordersRegionAt(hit, this.model.regions) : null;
  }

  private async ensure(atlas: string, overlay: string): Promise<void> {
    const { manifest, layers } = this.model;
    const record = manifest.atlas_borders?.files[atlas]?.[overlay];
    if (!record) throw new Error(`No ${overlay} borders are published for the ${atlas} cortex.`);
    const layer = layers.get(atlas);
    if (!layer) throw new Error(`The ${atlas} cortex has not loaded.`);
    if (this.carried.get(layer) === overlay) return;
    const url = new URL(record.file, new URL(this.base!, globalThis.location?.href));
    await loadOtherAnatomyFiles();
    const [buffer, code] = await Promise.all([fetchAsset(url), import('./atlas-borders.ts')]);
    this.code = code;
    // A layer released while they downloaded is not drawn; borders asked for since are another atlas's.
    if (layers.get(atlas) !== layer || this.wanted !== overlay) return;
    this.model.materials.attachBorders(code.addAtlasBorders, layers.values());
    code.attachBorders(layer, new Uint8Array(buffer), manifest.regions, atlas, overlay);
    this.carried.set(layer, overlay);
  }
}
