import { Box3, Matrix4, Quaternion, Vector3 } from 'three';
import type { Mesh } from 'three';
import type { Region } from '../../types/index.ts';
import { labelOf } from '../../core/catalog/labels.ts';
import { CAMERA_RESPONSE, noOvershoot, springAt, springSettled } from '../../core/spring.ts';
import { prefersReducedMotion } from '../render/camera-motion.ts';
import type { WhiteMatterSurfaces } from '../tissues/white-matter-surfaces.ts';
import {
  anatomicalMatrixWorld,
  deepShifts,
  hemisphereShifts,
  leftRightAxis,
  restBox,
  shiftMesh,
} from './explode.ts';
import type { Layer } from './layers.ts';
import type { AtlasManifest } from './manifest.ts';

// The space left between the medial pair's occipital poles.
const MEDIAL_PAIR_GAP_M = 0.01;
// The explode has arrived within this share of its way, about 0.01 mm of a hemisphere's shift.
const EXPLODE_ARRIVED = 1e-4;

/** The explode on its way: a spring from `from` to `to`, started at `started` (a `performance.now()`). */
interface ExplodeMotion {
  started: number;
  from: number;
  to: number;
  /** The starting rate, in whole moves per second. */
  velocity: number;
  /** Under reduced motion it arrives with the next frame, with no way between. */
  jump: boolean;
}

/** What placement reads of the model: its layers and which of them are shown. */
export interface PlacementSource {
  readonly manifest: AtlasManifest;
  readonly regions: ReadonlyMap<string, Region>;
  readonly layers: ReadonlyMap<string, Layer>;
  readonly whiteMatterSurfaces: WhiteMatterSurfaces | null;
  /** The cortical atlas shown now. */
  atlas(): string;
  /** The detail level shown now. */
  detail(): string;
}

/**
 * Where each surface is drawn: the exploded view, pulled apart and put back on the camera's spring,
 * and, while the visual-field map is drawn, the right hemisphere's cortex turned to face the left's way.
 */
export class Placement {
  /** Whether the anatomy is pulled apart, or on its way there. */
  exploded = false;
  /** How far apart the anatomy is drawn now: 0 assembled, 1 exploded. */
  private shown = 0;
  private motion: ExplodeMotion | null = null;
  private shiftCache: { key: string; shifts: Map<Mesh, Vector3> } | null = null;
  private frame: Quaternion | null = null;
  private medialPairOn = false;
  private pairPlacement: Matrix4 | null = null;
  private readonly source: PlacementSource;

  constructor(source: PlacementSource) {
    this.source = source;
  }

  /**
   * Both medial walls in sight at once: the right hemisphere's cortex turned half a turn about the
   * superior axis, set behind the left's occipital pole, the poles 10 mm apart. A rotation, never a
   * mirror, so each hemisphere keeps its own handedness.
   */
  get medialPair(): boolean {
    return this.medialPairOn;
  }

  /** Turn the medial pair on or off; on, it shows the anatomy where it lies, so it assembles it. */
  setMedialPair(on: boolean): void {
    this.pairPlacement ??= this.medialPairPlacement();
    this.medialPairOn = on;
    if (on) this.assemble();
  }

  /**
   * Pull the anatomy apart, or put it back together, on the camera's spring; with the next frame under
   * reduced motion. A change of mind turns the pieces where they are.
   */
  explode(exploded: boolean): void {
    this.exploded = exploded;
    // Laid out before the move starts: measured after, its time would be taken off the way.
    if (exploded) this.shifts();
    this.move(exploded ? 1 : 0);
  }

  /** Move the explode on to `now`, a frame's `performance.now()`; true when the anatomy moved. */
  step(now: number): boolean {
    if (!this.motion) return false;
    const { value, arrived } = this.at(now);
    this.shown = value;
    if (arrived) this.motion = null;
    this.place();
    return true;
  }

  /** Put the anatomy back where it lies at once, for a view drawn there. */
  assemble(): void {
    this.exploded = false;
    this.shown = 0;
    this.motion = null;
  }

  /** The shifts name the meshes they move; a layer loaded again has new ones. */
  forgetShifts(): void {
    this.shiftCache = null;
  }

  /**
   * The rotation taking world x onto the brain's own left–right axis (`leftRightAxis`): the scan's roll
   * and yaw, not its pitch. Named views, the orbit and the orientation letters are squared to it, and the
   * exploded view lays out along it. Every cortical atlas tiles one pial surface, so the first measured
   * serves for all.
   */
  get anatomicalFrame(): Quaternion {
    if (!this.frame) {
      const cortex = this.source.layers.get(this.source.atlas())!.meshes;
      const side = (hemisphere: string) =>
        cortex.filter((mesh) => mesh.userData['hemisphere'] === hemisphere);
      this.frame = new Quaternion().setFromUnitVectors(
        new Vector3(1, 0, 0),
        leftRightAxis(side('left'), side('right')),
      );
    }
    return this.frame;
  }

  /** Where `mesh` is drawn once the explode has arrived: framing fits that, not a frame in flight. */
  settledMatrixWorld(mesh: Mesh, target: Matrix4): Matrix4 {
    anatomicalMatrixWorld(mesh, target);
    const shift = this.exploded ? this.shifts().get(mesh) : undefined;
    if (shift) {
      target.elements[12] += shift.x;
      target.elements[13] += shift.y;
      target.elements[14] += shift.z;
    }
    return target;
  }

  /**
   * Draw every mesh where it is now: the explode shifts each piece its share of the way, and the
   * medial pair turns the right cortex.
   */
  place(): void {
    const { manifest, layers, whiteMatterSurfaces } = this.source;
    const shifts = this.shown > 0 ? this.shifts() : null;
    const shift = new Vector3();
    const shiftNow = (mesh: Mesh) => {
      const full = shifts?.get(mesh);
      if (full) shift.copy(full).multiplyScalar(this.shown);
      else shift.set(0, 0, 0);
      shiftMesh(mesh, shift);
    };
    for (const [id, layer] of layers) {
      const corticalLayer = manifest.atlases.some((atlas) => atlas.id === id);
      for (const mesh of layer.meshes) {
        shiftNow(mesh);
        if (this.medialPairOn && corticalLayer && mesh.userData['hemisphere'] === 'right') {
          mesh.matrix.premultiply(this.pairPlacement!);
        }
      }
    }
    for (const mesh of whiteMatterSurfaces?.meshes ?? []) shiftNow(mesh);
  }

  /** The explode at `now`: how far apart, how fast in shares per second, and whether it has arrived. */
  private at(now: number): { value: number; rate: number; arrived: boolean } {
    const motion = this.motion;
    if (!motion) return { value: this.shown, rate: 0, arrived: true };
    if (motion.jump) return { value: motion.to, rate: 0, arrived: true };
    const span = motion.to - motion.from;
    const spring = springAt((now - motion.started) / 1000, CAMERA_RESPONSE, motion.velocity);
    if (springSettled(spring, Math.abs(span), EXPLODE_ARRIVED)) {
      return { value: motion.to, rate: 0, arrived: true };
    }
    return {
      value: motion.from + span * spring.value,
      rate: span * spring.velocity,
      arrived: false,
    };
  }

  /**
   * Head for `to` from where the anatomy is drawn now. The camera's response, so a refit begun with it
   * arrives with it; a move under way hands on its speed toward `to`, never past it. Under reduced
   * motion the anatomy changes with the next frame, after a dissolve has copied the one on screen.
   */
  private move(to: number): void {
    const now = performance.now();
    const { value, rate } = this.at(now);
    const jump = prefersReducedMotion();
    this.shown = value;
    this.motion =
      value === to
        ? null
        : {
            started: now,
            from: value,
            to,
            velocity: jump ? 0 : noOvershoot(rate / (to - value), CAMERA_RESPONSE),
            jump,
          };
  }

  private medialPairPlacement(): Matrix4 {
    const { manifest, regions, layers } = this.source;
    const box = new Box3();
    for (const atlas of manifest.atlases) {
      for (const mesh of layers.get(atlas.id)?.meshes ?? []) {
        if (regions.get(mesh.userData['region_id'] as string)!.hemisphere !== 'left') continue;
        box.expandByObject(mesh);
      }
    }
    if (box.isEmpty()) throw new Error('No left cortex is loaded to pair the hemispheres on.');
    const behind = 2 * box.max.z + MEDIAL_PAIR_GAP_M;
    return new Matrix4().makeRotationY(Math.PI).setPosition(0, 0, behind);
  }

  /**
   * Internal pieces expand radially, with interlocking regions kept together. The cord stays on
   * the brainstem, and the hemispheres open just clear of the resulting internal layout.
   */
  private shifts(): Map<Mesh, Vector3> {
    const { manifest, regions, layers, whiteMatterSurfaces } = this.source;
    const atlasId = this.source.atlas();
    const detailId = this.source.detail();
    const cords = (manifest.supplemental_layers ?? [])
      .map((entry) => layers.get(entry.id))
      .filter((layer) => layer !== undefined);
    const key = [atlasId, detailId, cords.length, Boolean(whiteMatterSurfaces)].join();
    if (this.shiftCache?.key === key) return this.shiftCache.shifts;
    const cortex = layers.get(atlasId)!.meshes;
    const halves = { left: new Box3(), right: new Box3() };
    const sideOf = (mesh: Mesh) => {
      const side = mesh.userData['hemisphere'];
      if (side !== 'left' && side !== 'right') {
        throw new Error(`A cortical surface lies on no hemisphere: ${mesh.name}`);
      }
      return side as 'left' | 'right';
    };
    for (const mesh of cortex) halves[sideOf(mesh)].union(restBox(mesh));
    // A structure drawn in parts moves whole: each part travels as the unit that holds it.
    const wholes = new Map<string, Region>();
    for (const unit of regions.values()) {
      for (const part of unit.constituent_regions ?? []) wholes.set(part, unit);
    }
    const groups = new Map<string, Mesh[]>();
    // A lateral structure's group under its side-free name and side, to find its mirror image.
    const sided = new Map<string, string>();
    for (const mesh of layers.get(detailId)!.meshes) {
      const part = regions.get(mesh.userData['region_id'] as string)!;
      const region = wholes.get(part.id) ?? part;
      const label = labelOf(region, 'en');
      if (!label) throw new Error(`No anatomical system holds ${region.id}.`);
      const name =
        label.group === 'Brainstem' || label.group === 'Cerebellum' ? label.group : region.id;
      const group = groups.get(name) ?? [];
      group.push(mesh);
      groups.set(name, group);
      if (name !== region.id || (region.hemisphere !== 'left' && region.hemisphere !== 'right')) {
        continue;
      }
      const key = `${label.name}|${region.hemisphere}`;
      const held = sided.get(key);
      if (held && held !== name) {
        throw new Error(`Two ${region.hemisphere} structures are ${label.name}.`);
      }
      sided.set(key, name);
    }
    const names = [...groups.keys()];
    // A structure only one side has is no midline structure: it has no mirror image.
    const mirrorOf = (name: string) => {
      const region = regions.get(name);
      if (region?.hemisphere !== 'left' && region?.hemisphere !== 'right') return name;
      const other = region.hemisphere === 'left' ? 'right' : 'left';
      return sided.get(`${labelOf(region, 'en')!.name}|${other}`) ?? null;
    };
    if (cords.length) {
      const brainstem = groups.get('Brainstem');
      if (!brainstem) throw new Error(`The ${detailId} level has no brainstem to hold the cord.`);
      for (const layer of cords) brainstem.push(...layer.meshes);
    }
    const shifts = deepShifts(
      [...groups.values()],
      names.map((name) => {
        const mirror = mirrorOf(name);
        return mirror === null ? null : names.indexOf(mirror);
      }),
    );
    const deep = new Box3();
    for (const [mesh, shift] of shifts) deep.union(restBox(mesh).translate(shift));
    const across = new Vector3(1, 0, 0).applyQuaternion(this.anatomicalFrame);
    const sideways = hemisphereShifts(halves.left, halves.right, deep, across);
    for (const mesh of [...cortex, ...(whiteMatterSurfaces?.meshes ?? [])]) {
      shifts.set(mesh, sideways[sideOf(mesh)]);
    }
    this.shiftCache = { key, shifts };
    return shifts;
  }
}
