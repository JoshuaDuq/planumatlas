import assert from 'node:assert/strict';
import { test } from 'vitest';
import { MeshBasicMaterial } from 'three';
import type { WebGLProgramParametersWithUniforms, WebGLRenderer } from 'three';
import { addStriatalOverlay, createStriatalUniforms } from './striatal-overlay.ts';
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
