import { BufferAttribute, Matrix4, Mesh, Plane, Vector3 } from 'three';
import type {
  BufferGeometry,
  Color,
  DataTexture,
  IUniform,
  Material,
  MeshStandardMaterial,
} from 'three';
import type { Region } from '../../types/index.ts';
import { createAnatomicalMaterial, stageLegible } from '../render/materials.ts';
import type { SurfacePalettes, VisualFieldUniforms } from '../render/materials.ts';
import { checkTerritories, networkPalette, paletteTexture } from '../render/network-colors.ts';
import {
  FEATHER_ITEM_SIZE,
  addBorderFeather,
  createFeatherPalette,
} from '../render/border-feather.ts';
import { addMriSurfaceAppearance, createMriUniforms } from '../render/mri-material.ts';
import type { MriSurfaceSample, MriUniforms } from '../render/mri-material.ts';
import { addUserMapToSurface, createUserMapUniforms } from '../user-map/overlay.ts';
import type { UserMapUniforms } from '../user-map/overlay.ts';
import { addSurfaceMap, surfaceMapUniforms } from '../tissues/map-surface.ts';
import type { SurfaceMap, SurfaceMapUniforms } from '../tissues/map-surface.ts';
import type { WhiteMatterSurfaces } from '../tissues/white-matter-surfaces.ts';
import type { AtlasManifest } from './manifest.ts';
import type { AtlasMesh, Layer } from './layers.ts';
import { packVisualField } from './visual-field.ts';

/** The cortex carries its scan at mid-thickness (`_t1`); every other region reads it inside itself. */
const mriSample = (region: Region): MriSurfaceSample =>
  region.kind === 'cortex' || region.kind === 'non-region' ? 'mid-thickness' : 'inside';

/** The surfaces the cerebellar map is drawn on: the cerebellar cortex and lobules, which carry its shares. */
const drawsCerebellarMap = (region: Region) => Boolean(region.cerebellar_functions?.length);

/**
 * A copy that compiles to the same program. `clone` leaves the shader chain behind, and a physical
 * clone defines PHYSICAL, which the anatomical material's standard copy does not.
 */
function programCopy(material: Material): Material {
  const copy = material.clone();
  copy.defines = { ...material.defines };
  copy.onBeforeCompile = material.onBeforeCompile;
  copy.customProgramCacheKey = material.customProgramCacheKey;
  return copy;
}

/**
 * The materials every surface of the model draws with, the uniforms and palettes they share, and
 * the programs they compile ahead of the frame that first shows them.
 */
export class SurfaceMaterials {
  /** The visual-field map's uniforms, shared by every cortical material; null without retinotopy. */
  readonly visualField: VisualFieldUniforms | null;
  /** The reader's own map, shared by every cortical material and every cut face. */
  readonly userMap: UserMapUniforms = createUserMapUniforms();
  /** Each region mesh's own colour, legible on the stage, as atlas colour draws it. */
  readonly sourceColors = new WeakMap<Mesh, Color>();
  /** The scan every surface samples, once attached (`attachMri`). */
  mri: MriUniforms | null = null;
  /** The cerebellar map its surfaces draw, once attached (`attachCerebellarMap`). */
  cerebellarMap: SurfaceMap | null = null;
  private cerebellarUniforms: SurfaceMapUniforms | null = null;
  /** The network and territory colours each cortical vertex looks up by its index. */
  private readonly palettes: SurfacePalettes;
  private readonly manifest: AtlasManifest;
  private readonly regions: ReadonlyMap<string, Region>;

  constructor(manifest: AtlasManifest, regions: ReadonlyMap<string, Region>) {
    this.manifest = manifest;
    this.regions = regions;
    this.visualField = manifest.retinotopy
      ? {
          visualMix: { value: 0 },
          visualProbe: { value: new Vector3(0, 0, -1) },
          visualMeasured: { value: manifest.retinotopy.measured_eccentricity_deg },
          visualAreasMix: { value: 0 },
          visualAreaClass: {
            value: new Float32Array(
              Math.max(...manifest.retinotopy.visual_areas.areas.map(({ code }) => code)) + 1,
            ),
          },
        }
      : null;
    this.palettes = {
      network: manifest.networks ? networkPalette(manifest.networks) : null,
      territory: manifest.arterial_territories
        ? paletteTexture(manifest.arterial_territories.territories.map(({ color }) => color))
        : null,
      thickness: manifest.cortical_thickness ? { value: null } : null,
    };
  }

  /** The shared thickness palette, empty until the first atlas's thickness downloads; null unpublished. */
  get thicknessPalette(): IUniform<DataTexture | null> | null {
    return this.palettes.thickness;
  }

  /** A published region mesh in its anatomical material, which replaces the glTF one. */
  dress(
    mesh: Mesh<BufferGeometry, MeshStandardMaterial>,
    region: Region,
    cortical: boolean,
  ): AtlasMesh {
    if (this.manifest.arterial_territories) {
      checkTerritories(mesh.geometry, this.manifest.arterial_territories.territories);
    }
    // Every cortical atlas carries the predicted retinotopy on every vertex.
    if (cortical && this.visualField) packVisualField(mesh.geometry, region.id);
    const shown = mesh as unknown as AtlasMesh;
    shown.material = createAnatomicalMaterial(
      mesh,
      region,
      this.manifest.appearance,
      cortical ? this.visualField : null,
      this.userMap,
      this.palettes,
    );
    // Drawn before the structures it meets, whichever loaded first (`opaqueOrder`).
    if (cortical) shown.userData['cortical'] = true;
    if (this.mri) addMriSurfaceAppearance(shown.material, this.mri, mriSample(region));
    if (this.cerebellarUniforms && drawsCerebellarMap(region)) {
      addSurfaceMap(shown.material, this.cerebellarUniforms);
    }
    this.sourceColors.set(shown, stageLegible(shown.material.color.clone()));
    return shown;
  }

  /** Exposed white matter takes the reader's map and, once attached, the scan read inside it. */
  dressWhiteMatter(mesh: Mesh<BufferGeometry, Material>): void {
    addUserMapToSurface(mesh.material, this.userMap);
    if (this.mri) addMriSurfaceAppearance(mesh.material, this.mri, 'inside');
  }

  /**
   * A cortical atlas's border blend: each mesh drawn with none until the worker's feathers are in,
   * and the palette its parcels blend through.
   */
  addFeathers(meshes: readonly AtlasMesh[]): DataTexture {
    for (const mesh of meshes) {
      const count = mesh.geometry.getAttribute('position').count;
      const none = new Float32Array(count * FEATHER_ITEM_SIZE);
      mesh.geometry.setAttribute('_feather', new BufferAttribute(none, FEATHER_ITEM_SIZE));
    }
    const featherPalette = createFeatherPalette(meshes.length);
    for (const mesh of meshes) addBorderFeather(mesh.material, featherPalette);
    return featherPalette;
  }

  attachMri(
    anatomy: { mriUniforms: MriUniforms } | null,
    layers: Iterable<Layer>,
    whiteMatter: WhiteMatterSurfaces | null,
  ): void {
    if (!anatomy) throw new Error('MRI anatomy has not loaded.');
    if (this.mri === anatomy.mriUniforms) return;
    if (this.mri) throw new Error('MRI anatomy is already attached.');
    this.mri = anatomy.mriUniforms;
    // Envelopes that load later take it as they arrive.
    for (const mesh of whiteMatter?.meshes ?? []) {
      addMriSurfaceAppearance(mesh.material, this.mri, 'inside');
    }
    for (const layer of layers) {
      for (const mesh of layer.meshes) {
        addMriSurfaceAppearance(mesh.material, this.mri, this.sampleOf(mesh, whiteMatter));
      }
    }
  }

  attachCerebellarMap(map: SurfaceMap, layers: Iterable<Layer>): void {
    if (this.cerebellarMap === map) return;
    if (this.cerebellarMap) throw new Error('The cerebellar map is already attached.');
    this.cerebellarMap = map;
    this.cerebellarUniforms = surfaceMapUniforms(map);
    for (const layer of layers) {
      for (const mesh of layer.meshes) {
        if (drawsCerebellarMap(this.regions.get(mesh.userData['region_id'] as string)!)) {
          addSurfaceMap(mesh.material, this.cerebellarUniforms);
        }
      }
    }
  }

  /**
   * Detached meshes on the loaded geometry, in a copy of each kind of material as Focus draws it
   * (see-through) and, until a scan is attached, as the T1 MRI colour does: compiled ahead, neither
   * pays for its programs in the frame that first shows it. Never disposed: disposing a material
   * releases the programs it compiled.
   */
  programSamples(layers: Iterable<Layer>, whiteMatter: WhiteMatterSurfaces | null): Mesh[] {
    const scan = createMriUniforms({
      texture: null,
      worldToVoxel: new Matrix4(),
      volume: { shape: [1, 1, 1] },
    });
    return this.programKinds(layers, whiteMatter).flatMap((kind) => {
      const { geometry, material } = kind;
      const seeThrough = programCopy(material);
      seeThrough.transparent = true;
      const samples = [new Mesh(geometry, seeThrough)];
      if (!this.mri) {
        const scanned = programCopy(material);
        addMriSurfaceAppearance(scanned, scan, this.sampleOf(kind, whiteMatter));
        samples.push(new Mesh(geometry, scanned));
      }
      return samples;
    });
  }

  /**
   * Copies of each kind of material clipped as a cut draws it, opaque and see-through, compiled
   * ahead like `programSamples`: three compiles a see-through double-sided material as two passes.
   */
  cutProgramSamples(layers: Iterable<Layer>, whiteMatter: WhiteMatterSurfaces | null): Mesh[] {
    const planes = [new Plane()];
    return this.programKinds(layers, whiteMatter).flatMap(({ geometry, material }) =>
      [false, true].map((transparent) => {
        const clipped = programCopy(material);
        clipped.clippingPlanes = planes;
        clipped.transparent = transparent;
        return new Mesh(geometry, clipped);
      }),
    );
  }

  dispose(): void {
    this.palettes.network?.dispose();
    this.palettes.territory?.dispose();
    this.palettes.thickness?.value?.dispose();
  }

  /** Exposed white matter carries no region of its own; it reads the white matter inside it. */
  private sampleOf(mesh: Mesh, whiteMatter: WhiteMatterSurfaces | null): MriSurfaceSample {
    if (whiteMatter?.meshes.includes(mesh as never)) return 'inside';
    return mriSample(this.regions.get(mesh.userData['region_id'] as string)!);
  }

  /**
   * One loaded mesh per kind of material the surfaces draw with. White matter is a kind of its
   * own: its clearcoat is not in the key it shares with the structures.
   */
  private programKinds(
    layers: Iterable<Layer>,
    whiteMatter: WhiteMatterSurfaces | null,
  ): Mesh<BufferGeometry, Material>[] {
    const kinds = new Map<string, Mesh<BufferGeometry, Material>>();
    const sources: [string, Mesh<BufferGeometry, Material>[]][] = [
      ['layer', [...layers].flatMap((layer) => layer.meshes)],
      ['white-matter', whiteMatter?.meshes ?? []],
    ];
    for (const [source, meshes] of sources) {
      for (const mesh of meshes) {
        const { material } = mesh;
        const kind = [source, material.type, material.customProgramCacheKey(), material.side];
        kinds.set(kind.join('|'), mesh);
      }
    }
    return [...kinds.values()];
  }
}
