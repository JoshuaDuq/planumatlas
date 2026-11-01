import assert from 'node:assert/strict';
import { test } from 'vitest';
import { Color, MeshBasicMaterial, SRGBColorSpace } from 'three';
import type { WebGLProgramParametersWithUniforms, WebGLRenderer } from 'three';
import {
  addStriatalOverlay,
  createStriatalUniforms,
  striatalPaletteData,
} from './striatal-overlay.ts';
import type { Label } from './palette.ts';

const label = (region_id: string | null, color: [number, number, number]): Label => ({
  source_label_id: 0,
  name: region_id ?? 'background',
  color,
  hemisphere: 'left',
  kind: 'tissue',
  region_id,
});

test('only striatal network labels are opaque, in the linear colour the cut palette uses', () => {
  const data = striatalPaletteData([
    label(null, [0, 0, 0]),
    label('aseg:left:11', [122, 186, 220]),
    label('choi:left:Cont', [230, 148, 34]),
  ]);
  assert.deepEqual([data[3], data[7]], [0, 0]);
  const linear = new Color().setRGB(230 / 255, 148 / 255, 34 / 255, SRGBColorSpace);
  assert.ok(Math.abs(data[8]! - linear.r) < 1e-6);
  assert.ok(Math.abs(data[9]! - linear.g) < 1e-6);
  assert.ok(Math.abs(data[10]! - linear.b) < 1e-6);
  assert.equal(data[11], 1);
});

test('a cap reads the shared uniforms and its own switch, after its base colour and before its lighting', () => {
  const material = new MeshBasicMaterial();
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\n  diffuseColor.rgb *= variation;',
    );
  };
  const uniforms = createStriatalUniforms();
  addStriatalOverlay(material, uniforms);
  const shader = {
    uniforms: {},
    fragmentShader: 'void main() {\n#include <color_fragment>\n}',
  } as unknown as WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader, {} as WebGLRenderer);
  assert.equal(shader.uniforms.striatalEnabled, uniforms.striatalEnabled);
  assert.equal(shader.uniforms.striatalHere, material.userData.striatalHere);
  const overlay = shader.fragmentShader.indexOf('if (striatalHere)');
  assert.ok(overlay > shader.fragmentShader.indexOf('#include <color_fragment>'));
  assert.ok(overlay < shader.fragmentShader.indexOf('diffuseColor.rgb *= variation'));
  assert.match(material.customProgramCacheKey(), /striatal/);
});
