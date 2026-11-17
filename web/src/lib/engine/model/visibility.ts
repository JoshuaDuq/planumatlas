import { SRGBColorSpace } from 'three';
import type { Plane } from 'three';
import { SURFACE_COLORS } from '../../types/index.ts';
import type { DisplaySettings, Region, SurfaceColor } from '../../types/index.ts';
import { groupsByLobe, lobeColor } from '../../core/catalog/lobes.ts';
import type { CabNpPartition } from '../../core/catalog/networks.ts';
import { visibilityOf } from '../../core/catalog/visibility.ts';
import { ghostColor, tissueColor } from '../render/materials.ts';
import type { AnatomicalUserData } from '../render/materials.ts';
import { majorityTerritoryColor } from '../render/network-colors.ts';
import { writeFeatherPalette } from '../render/border-feather.ts';
import { setPainted } from '../render/mri-material.ts';
import { GHOST } from '../render/draw-order.ts';
import { ghosted, ghosting } from '../tissues/palette.ts';
import type { WhiteMatterSurfaces } from '../tissues/white-matter-surfaces.ts';
import type { AtlasMesh, Layer } from './layers.ts';
import type { AtlasManifest } from './manifest.ts';
import type { SurfaceMaterials } from './surface-materials.ts';

const isSurfaceColor = (mode: string): mode is SurfaceColor =>
  (SURFACE_COLORS as readonly string[]).includes(mode);

/** Throws unless the surface can be coloured by `mode` with this model, atlas and scan. */
export function assertSurfaceColor(
  mode: string,
  {
    manifest,
    cabNp,
    atlas,
    scanned,
  }: {
    manifest: AtlasManifest;
    cabNp: CabNpPartition | null;
    atlas: string;
    scanned: boolean;
  },
): asserts mode is SurfaceColor {
  if (!isSurfaceColor(mode)) {
    throw new TypeError(`Unknown surface colour: ${mode}`);
  }
  if (mode === 'mri' && !scanned) {
    throw new Error('MRI must load before selecting MRI appearance.');
  }
  if (mode === 'network' && !manifest.networks) {
    throw new Error('This model carries no network layer.');
  }
  if (mode === 'territory' && !manifest.arterial_territories) {
    throw new Error('This model carries no arterial territories.');
  }
  if (mode === 'striatal' && !manifest.striatal_networks) {
    throw new Error('This model carries no striatal networks.');
  }
  if (mode === 'cerebellar' && !manifest.cerebellar_functions) {
    throw new Error('This model carries no cerebellar functional regions.');
  }
  if (mode === 'lobe' && !groupsByLobe(atlas)) {
    throw new Error(`${atlas} groups no regions by lobe; show a lobe atlas first.`);
  }
  if (mode === 'cab-np') {
    if (!cabNp) throw new Error('This model carries no CAB-NP partition.');
    if (atlas !== cabNp.atlas) {
      throw new Error(`CAB-NP colours ${cabNp.atlas} areas; show that atlas first.`);
    }
  }
}

/** The surface colour kept when `atlas` is shown: atlas colour where `mode` has nothing to colour. */
export function surfaceColorOn(
  atlas: string,
  mode: SurfaceColor,
  cabNp: CabNpPartition | null,
): SurfaceColor {
  // CAB-NP groups one atlas's areas; any other atlas has none to colour.
  if (mode === 'cab-np' && atlas !== cabNp!.atlas) return 'atlas';
  // An atlas grouped by network has no lobes to colour.
  if (mode === 'lobe' && !groupsByLobe(atlas)) return 'atlas';
  return mode;
}

/** The region meshes and exposed white matter drawn now. */
export function visibleMeshes(
  layers: ReadonlyMap<string, Layer>,
  whiteMatter: WhiteMatterSurfaces | null,
): AtlasMesh[] {
  const meshes: AtlasMesh[] = [...layers.values()]
    .filter((layer) => layer.scene.visible)
    .flatMap((layer) => layer.meshes.filter((mesh) => mesh.visible));
  if (whiteMatter) {
    meshes.push(...whiteMatter.meshes.filter((mesh) => mesh.visible));
  }
  return meshes;
}

/** What one drawing of the surfaces reads. */
export interface SurfaceView {
  settings: DisplaySettings;
  /** The selection, after a selection the settings no longer show has been dropped. */
  selectedRegion: Region | null;
  manifest: AtlasManifest;
  regions: ReadonlyMap<string, Region>;
  cabNp: CabNpPartition | null;
  clippingPlanes: Plane[];
  layers: ReadonlyMap<string, Layer>;
  whiteMatter: WhiteMatterSurfaces | null;
  materials: Pick<SurfaceMaterials, 'sourceColors' | 'mri'>;
}

/** The exposed white matter as the settings show it, and whether the scan colours the surface. */
export function drawWhiteMatterAndScan({
  settings,
  manifest,
  regions,
  clippingPlanes,
  whiteMatter,
  materials,
}: SurfaceView): void {
  // Focus sees through the cortex; a route's or Tracts' grey cortex keeps the reader's opacity.
  const focusOpacity = settings.focused ? manifest.appearance.see_through_opacity! : 1;
  whiteMatter?.update(
    { ...settings, cortexOpacity: Math.min(settings.cortexOpacity, focusOpacity) },
    regions,
    clippingPlanes,
    ghosting(settings),
  );
  // A tab's paint is drawn over the scan, which stays wherever nothing is painted.
  if (materials.mri) materials.mri.scanEnabled.value = settings.surfaceColor === 'mri';
}

/**
 * Show each layer the settings name, and draw each of its region meshes: shown or hidden, in its
 * paint, surface colour or tissue, ghosted or opaque, and clipped by the cut.
 */
export function drawLayers({
  settings,
  selectedRegion,
  manifest,
  regions,
  cabNp,
  clippingPlanes,
  layers,
  materials,
}: SurfaceView): void {
  const { appearance } = manifest;
  const ghostState = { ...settings, selectedRegion };
  const ghosts = ghosting(settings);
  const focusOpacity = settings.focused ? appearance.see_through_opacity! : 1;
  const { paint, surfaceColor } = settings;
  const mri = surfaceColor === 'mri';
  for (const [id, layer] of layers) {
    layer.scene.visible =
      id === settings.detail ||
      id === settings.atlas ||
      (manifest.supplemental_layers ?? []).some((entry) => entry.id === id);
    for (const mesh of layer.meshes) {
      const region = regions.get(mesh.userData['region_id'] as string)!;
      const cortex = region.kind === 'cortex' || region.kind === 'non-region';
      // A ghost is grey at the see-through opacity; what it holds in colour is opaque.
      const ghost = ghosted(region.id, ghostState);
      const cabNpNetwork = surfaceColor === 'cab-np' && !paint ? cabNp!.regions[region.id] : null;
      // The cortex carries its territories per vertex; a deep structure is drawn whole, as its cut is.
      const territory =
        surfaceColor === 'territory' && !paint && !cortex
          ? majorityTerritoryColor(region, manifest.arterial_territories!.territories)
          : null;
      // A lobe colours its regions whole; what lies in none (deep structures, the medial wall) keeps tissue.
      const lobe = surfaceColor === 'lobe' && !paint ? lobeColor(region) : null;
      mesh.visible = visibilityOf(region, settings).visible;
      const material = mesh.material;
      const userData = material.userData as AnatomicalUserData;
      if (cortex) {
        // Only tissue colour carries the T1 brightness it was tuned against;
        // under a published palette that modulation would distort the datum.
        userData.tissueVariation.value =
          surfaceColor === 'tissue' && !paint && !ghost ? appearance.intensity.surface_strength : 0;
        if (userData.networkMix) {
          userData.networkMix.value = surfaceColor === 'network' && !paint && !ghost ? 1 : 0;
        }
        if (userData.territoryMix) {
          userData.territoryMix.value = surfaceColor === 'territory' && !paint && !ghost ? 1 : 0;
        }
      }
      if (material.clippingPlanes !== clippingPlanes) {
        material.clippingPlanes = clippingPlanes;
        material.needsUpdate = true;
      }
      // Under network colour this shows only where no network reaches: the
      // medial wall keeps the tissue it always had.
      material.color.copy(materials.sourceColors.get(mesh)!);
      const painted = paint?.colors.get(region.id);
      setPainted(material, Boolean(painted));
      if (painted) {
        material.color.setRGB(painted[0] / 255, painted[1] / 255, painted[2] / 255, SRGBColorSpace);
      } else if (paint) {
        material.color.set(tissueColor(region, appearance.tissue));
      } else if (cabNpNetwork) {
        // Published sRGB, converted as the per-vertex network colours are.
        const [r, g, b] = cabNp!.colors[cabNpNetwork]!;
        material.color.setRGB(r / 255, g / 255, b / 255, SRGBColorSpace);
      } else if (territory) {
        material.color.setRGB(
          territory[0] / 255,
          territory[1] / 255,
          territory[2] / 255,
          SRGBColorSpace,
        );
      } else if (lobe) {
        material.color.setRGB(lobe[0] / 255, lobe[1] / 255, lobe[2] / 255, SRGBColorSpace);
      } else if (surfaceColor !== 'atlas' || region.kind === 'non-region') {
        material.color.set(tissueColor(region, appearance.tissue));
      }
      // Selection is drawn by the outline pass. Tinting the material would
      // alter a region's atlas colour, which is the datum being displayed.
      // A painted area is what the paint is about, so a see-through cortex leaves it opaque, and
      // the unpainted cortex around it gives the context. What a ghost holds is opaque for the same reason.
      if (ghost) {
        ghostColor(region, appearance.tissue, material.color);
        material.opacity = cortex
          ? Math.min(focusOpacity, settings.cortexOpacity)
          : appearance.see_through_opacity!;
      } else {
        material.opacity = cortex && !painted && !ghosts ? settings.cortexOpacity : 1;
      }
      mesh.userData['ghost'] = ghost ? (cortex ? GHOST.cortex : GHOST.deep) : GHOST.none;
      const transparent = material.opacity < 1;
      if (material.transparent !== transparent) {
        material.transparent = transparent;
        material.needsUpdate = true;
      }
      material.depthWrite = !transparent || mesh.userData['ghost'] === GHOST.deep;
    }
    // Under the scan only a painted parcel shows its colour, so only it is blended into.
    if (layer.featherPalette) {
      writeFeatherPalette(
        layer.featherPalette,
        layer.meshes,
        (mesh) => mesh.visible && (!mri || Boolean(paint?.colors.has(mesh.userData['region_id']))),
      );
    }
  }
}
