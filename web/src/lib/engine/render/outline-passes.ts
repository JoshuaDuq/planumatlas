import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  FrontSide,
  Group,
  Mesh,
  NearestFilter,
  Plane,
  Scene,
  UnsignedByteType,
  Vector2,
} from 'three';
import type {
  Object3D,
  PerspectiveCamera,
  ShaderMaterial,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { token } from './tokens.ts';
import { paintOutlineEdges, sameMeshSet } from './outline-edges.ts';
import { withOutlineOccluders } from './outline-occluders.ts';
import { outlineMaskScale } from './quality.ts';
import type { Outlined } from './scene.ts';

/**
 * How far past the cut the outline's depth keeps the anatomy, in world metres: the caps lie on the
 * plane itself, and clipped exactly there they would come and go with the float error.
 */
const CAP_DEPTH_SLACK_M = 1e-4;

/** OutlinePass with its mask and depth drawn at `maskScale` of the frame it is sized to. */
export class ScaledOutlinePass extends OutlinePass {
  maskScale = 1;
  /** The cut's planes (`Outlined.planes`), read as each frame draws: a cut moves them in place. */
  planes: readonly Plane[] = [];
  /** Hidden while the pass draws its depth and mask (`Outlined.leaveOut`). */
  leaveOut: readonly Object3D[] = [];

  override setSize(width: number, height: number): void {
    super.setSize(width * this.maskScale, height * this.maskScale);
  }
}

/** One outline: a wide light ring (the halo) and a fine light line (the core). */
export interface OutlinePasses {
  halo: ScaledOutlinePass;
  core: ScaledOutlinePass;
}

/** The scratch targets OutlinePass finds, blurs and adds edges through, after its mask is drawn. */
const EDGE_TARGETS = [
  'renderTargetMaskDownSampleBuffer',
  'renderTargetBlurBuffer1',
  'renderTargetEdgeBuffer1',
  'renderTargetBlurBuffer2',
  'renderTargetEdgeBuffer2',
] as const;

/** OutlinePass's own `downSampleRatio`: the edges are found at half the mask's size. */
const EDGE_DOWNSAMPLE = 2;

/**
 * Two passes tell a selection from a hover. The core is a fine line and the halo a wide ring around
 * it: a hovered region gets the line alone, a selected one both. The pass only adds light, so the
 * two cannot differ by a dark tone: until 2026-11-23 the core was meant to be a dark line inside
 * the halo, added near-black, which drew nothing, and hover and selection were one white ring.
 */
export function createOutlinePasses(scene: Scene, camera: PerspectiveCamera): OutlinePasses {
  const halo = new ScaledOutlinePass(new Vector2(1, 1), scene, camera);
  halo.edgeStrength = 6;
  halo.edgeThickness = 3;
  halo.edgeGlow = 0;
  halo.enabled = false;
  const core = new ScaledOutlinePass(new Vector2(1, 1), scene, camera);
  core.edgeStrength = 3;
  core.edgeThickness = 1;
  core.edgeGlow = 0;
  core.enabled = false;
  // The core draws after the halo has added its edges, so it finds and blurs its own through the
  // halo's scratch targets; a pass of its own exists only for a mask the halo cannot lend.
  for (const name of EDGE_TARGETS) {
    core[name].dispose();
    core[name] = halo[name];
  }
  // The surface is front-facing. Matching that side keeps the silhouette and
  // does not rasterize the back of every triangle into the outline depth.
  for (const pass of [halo, core]) {
    pass.depthMaterial.side = FrontSide;
    pass.prepareMaskMaterial.side = FrontSide;
    // The pass packs depth into four bytes, which its stock half-float target rounds: an error of
    // millimetres at this camera. Cortex lying on white matter was masked as hidden behind it, so
    // a selected gyrus got the hidden line along most of its border.
    const depth = pass.renderTargetDepthBuffer.texture;
    depth.type = UnsignedByteType;
    depth.minFilter = depth.magFilter = NearestFilter;
    clipMask(pass.prepareMaskMaterial);
  }
  for (const pass of [halo, core]) {
    const render = pass.render.bind(pass);
    pass.render = (...args) => {
      for (const [index, plane] of pass.planes.entries()) {
        const depth = pass.depthMaterial.clippingPlanes![index]!.copy(plane);
        depth.constant += CAP_DEPTH_SLACK_M;
      }
      const shown = pass.leaveOut.filter((object) => object.visible);
      for (const object of shown) object.visible = false;
      try {
        return withOutlineOccluders(pass, () => render(...args));
      } finally {
        for (const object of shown) object.visible = true;
      }
    };
  }
  const renderCore = core.render.bind(core);
  // A selection with no hover draws the ring and the line on one silhouette. The second pass
  // would render every mesh again for a mask the halo already built.
  core.render = function (
    this: OutlinePass,
    renderer,
    writeBuffer,
    readBuffer,
    deltaTime,
    maskActive,
  ) {
    if (this.enabled && halo.enabled && sameMeshSet(halo.selectedObjects, this.selectedObjects)) {
      paintOutlineEdges(
        this,
        halo.renderTargetMaskBuffer.texture,
        renderer,
        readBuffer,
        maskActive,
      );
      return;
    }
    renderCore(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
  };
  return { halo, core };
}

/**
 * Let OutlinePass's mask shader honour `clippingPlanes`: a ShaderMaterial is clipped only when it
 * asks to be and carries three's clipping chunks, which are empty while no plane is set.
 */
function clipMask(material: ShaderMaterial): void {
  material.clipping = true;
  material.vertexShader = material.vertexShader
    .replace('void main() {', '#include <clipping_planes_pars_vertex>\nvoid main() {')
    .replace(
      '#include <project_vertex>',
      '#include <project_vertex>\n#include <clipping_planes_vertex>',
    );
  material.fragmentShader = material.fragmentShader.replace(
    'void main() {',
    '#include <clipping_planes_pars_fragment>\nvoid main() {\n#include <clipping_planes_fragment>',
  );
  if (
    !material.vertexShader.includes('<clipping_planes_vertex>') ||
    !material.fragmentShader.includes('<clipping_planes_fragment>')
  )
    throw new Error('OutlinePass changed its mask shader; the cut can no longer clip it.');
}

/**
 * Selection gets the wide ring over the fine line; hover gets the fine line alone.
 *
 * On a cut the masks are clipped as the anatomy is, and the caps hide what lies behind them in the
 * depth, as on screen; a stencil cap is a quad as wide as the plane, so it is left out. The depth is
 * drawn from both sides: front faces alone let a selected gyrus's white-matter side show through the
 * cut, and it was ringed there.
 */
export function outline(
  passes: readonly OutlinePasses[],
  { selected = [], hovered = [], planes = [], leaveOut = [] }: Outlined,
) {
  const lined = [...new Set([...selected, ...hovered])];
  const depthSide = planes.length ? DoubleSide : FrontSide;
  for (const { halo, core } of passes) {
    halo.selectedObjects = [...selected];
    core.selectedObjects = lined;
    halo.enabled = selected.length > 0;
    core.enabled = lined.length > 0;
    for (const pass of [halo, core]) {
      pass.planes = planes;
      pass.leaveOut = leaveOut;
      pass.prepareMaskMaterial.clippingPlanes = [...planes];
      pass.depthMaterial.clippingPlanes = planes.map(() => new Plane());
      if (pass.depthMaterial.side !== depthSide) {
        pass.depthMaterial.side = depthSide;
        pass.depthMaterial.needsUpdate = true;
      }
    }
  }
}

/**
 * Fit one pipeline's outline to frames drawn at `pixelRatio`, before the composer sizes it: the mask
 * at `outlineMaskScale` of the frame, the edges still at half the frame, so the line keeps its width.
 */
export function scaleOutlines({ halo, core }: OutlinePasses, pixelRatio: number): void {
  const scale = outlineMaskScale(pixelRatio);
  for (const pass of [halo, core]) {
    pass.maskScale = scale;
    pass.downSampleRatio = EDGE_DOWNSAMPLE * scale;
  }
}

/** The outline colours from the theme's tokens. */
export function themeOutlines(passes: readonly OutlinePasses[]): void {
  for (const { halo, core } of passes) {
    for (const pass of [halo, core]) {
      pass.visibleEdgeColor.set(token('--scene-outline'));
      // The pass adds its edges times edgeStrength, which turned this slate into near-white lines
      // wherever the selection runs on behind other cortex. Divided, the hidden edge adds its token.
      pass.hiddenEdgeColor
        .set(token('--scene-outline-hidden'))
        .multiplyScalar(1 / pass.edgeStrength);
    }
  }
}

/**
 * Compile the outline programs before a pointer reaches a region, into `target`.
 *
 * The first hover otherwise pays for those shaders inside the frame that draws the ring. One
 * sample mesh is enough: every region shares them. The masks draw the scene's meshes in the
 * pass's materials, under its lights; the rest are full-screen quads, drawn alone. Only the halo
 * is warmed: the core's materials are the same code, so three.js gives them the same programs.
 */
export function warmOutlines(
  { halo }: OutlinePasses,
  root: Object3D,
  {
    renderer,
    target,
    scene,
    camera,
  }: {
    renderer: WebGLRenderer;
    target: WebGLRenderTarget;
    scene: Scene;
    camera: PerspectiveCamera;
  },
): Promise<void> {
  let sample: Mesh | null = null;
  root.traverse((object) => {
    if (!sample && object instanceof Mesh && object.visible) sample = object;
  });
  if (!sample) return Promise.resolve();
  const { geometry } = sample as Mesh;
  // A full-screen quad carries no normals, which would be in its programs' keys.
  const quad = new BufferGeometry()
    .setAttribute('position', new Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3))
    .setAttribute('uv', new Float32BufferAttribute([0, 2, 0, 0, 2, 0], 2));
  const masks = new Group().add(
    new Mesh(geometry, halo.depthMaterial),
    new Mesh(geometry, halo.prepareMaskMaterial),
  );
  const quads = new Group();
  for (const material of [
    halo.materialCopy,
    halo.edgeDetectionMaterial,
    halo.separableBlurMaterial1,
    halo.separableBlurMaterial2,
    halo.overlayMaterial,
  ]) {
    quads.add(new Mesh(quad, material));
  }
  const previous = renderer.getRenderTarget();
  renderer.setRenderTarget(target);
  try {
    return Promise.all([
      renderer.compileAsync(masks, camera, scene),
      renderer.compileAsync(quads, camera, new Scene()),
    ]).then(() => quad.dispose());
  } finally {
    renderer.setRenderTarget(previous);
  }
}
