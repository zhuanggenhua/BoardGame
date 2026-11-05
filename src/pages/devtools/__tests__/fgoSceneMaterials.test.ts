import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { SceneMetadata } from '../cutscene/fgoSceneData';
import { applySourceSampler, sourceGeometry, sourcePassState, sourceTransparentSort } from '../cutscene/fgoSceneMaterials';

const metadata = JSON.parse(readFileSync('public/assets/dev/fgo-cutscene/np100100/np100100_scene.json', 'utf8')) as SceneMetadata;

describe('original FGO shader pass state', () => {
  it('sorts a skinned renderer by its bounds center rather than the character root', () => {
    const solid = new THREE.Object3D(); const edge = new THREE.Object3D(); const effect = new THREE.Object3D();
    solid.position.z = 20; edge.position.z = 20; effect.position.z = 5;
    const center = new THREE.Vector3(0, 0, 1);
    solid.userData.sourceRendererSort = { renderer: solid, center, pass: 0 };
    edge.userData.sourceRendererSort = { renderer: solid, center, pass: 1 };
    const items = [solid, effect, edge].map(object => {
      object.updateMatrixWorld();
      return { object, id: object.id, groupOrder: 0, renderOrder: 0 };
    });
    items.sort((a, b) => sourceTransparentSort(a, b, new THREE.Vector3()));
    expect(items.map(item => item.object)).toEqual([effect, solid, edge]);
  });

  it('orders an explicit source render queue before renderer distance', () => {
    const early = new THREE.Mesh(undefined, new THREE.RawShaderMaterial());
    const late = new THREE.Mesh(undefined, new THREE.RawShaderMaterial());
    early.material.userData.sourceRenderQueue = 3000;
    late.material.userData.sourceRenderQueue = 3001;
    early.position.z = 1; late.position.z = 100;
    const items = [late, early].map(object => {
      object.updateMatrixWorld();
      return { object, id: object.id, groupOrder: 0, renderOrder: 0 };
    });
    items.sort((a, b) => sourceTransparentSort(a, b, new THREE.Vector3()));
    expect(items.map(item => item.object)).toEqual([early, late]);
    early.material.dispose(); late.material.dispose();
    early.geometry.dispose(); late.geometry.dispose();
  });

  it('keeps the original single-level actor atlas without synthesized mip bleeding', () => {
    const texture = new THREE.Texture();
    applySourceSampler(texture, metadata.textureSamplers['servant_100100_atlas.png']);
    expect(texture.generateMipmaps).toBe(false);
    expect(texture.minFilter).toBe(THREE.LinearFilter);
    expect(texture.magFilter).toBe(THREE.LinearFilter);
    expect(texture.wrapS).toBe(THREE.ClampToEdgeWrapping);
    expect(texture.wrapT).toBe(THREE.ClampToEdgeWrapping);
    expect(texture.anisotropy).toBe(6);
    texture.dispose();
  });

  it('retains repeat sampling on both source effect atlases instead of clamping UVs', () => {
    const atlases = Object.values(metadata.textureSamplers).filter(s => /^100100_tex0[12]$/.test(s.name));
    expect(atlases).toHaveLength(2);
    for (const source of atlases) {
      const texture = new THREE.Texture();
      applySourceSampler(texture, source);
      expect(texture.generateMipmaps).toBe(false);
      expect(texture.wrapS).toBe(THREE.RepeatWrapping);
      expect(texture.wrapT).toBe(THREE.RepeatWrapping);
      texture.dispose();
    }
  });

  it('keeps actor passes adjacent behind a nearer effect, including equal-depth renderer ties', () => {
    for (const effectDepth of [5, 10]) {
      const solid = new THREE.Object3D();
      const effect = new THREE.Object3D();
      const edge = new THREE.Object3D();
      solid.position.z = 10; edge.position.z = 10; effect.position.z = effectDepth;
      solid.userData.sourceRendererSort = { renderer: solid, pass: 0 };
      edge.userData.sourceRendererSort = { renderer: solid, pass: 1 };
      effect.userData.sourceParticleSort = { renderer: effect, fudge: 0, mode: 0, born: 0 };
      const items = [edge, effect, solid].map(object => {
        object.updateMatrixWorld();
        return { object, id: object.id, groupOrder: 0, renderOrder: 0 };
      });
      items.sort((a, b) => sourceTransparentSort(a, b, new THREE.Vector3()));
      expect(items.map(item => item.object)).toEqual([solid, edge, effect]);
    }
  });

  it('preserves source particle age sorting inside a renderer group', () => {
    const renderer = new THREE.Object3D();
    const older = new THREE.Object3D(); const newer = new THREE.Object3D();
    older.userData.sourceParticleSort = { renderer, mode: 2, fudge: 0, born: 1 };
    newer.userData.sourceParticleSort = { renderer, mode: 2, fudge: 0, born: 2 };
    const items = [older, newer].map(object => ({ object, id: object.id, groupOrder: 0, renderOrder: 0 }));
    items.sort((a, b) => sourceTransparentSort(a, b, new THREE.Vector3()));
    expect(items.map(item => item.object)).toEqual([newer, older]);
  });

  it('uses bilinear rather than trilinear mip filtering for the source default particle texture', () => {
    const source = Object.values(metadata.textureSamplers).find(s => s.name === 'Default-Particle')!;
    const texture = new THREE.Texture();
    applySourceSampler(texture, source);
    expect(texture.generateMipmaps).toBe(true);
    expect(texture.minFilter).toBe(THREE.LinearMipmapNearestFilter);
    texture.dispose();
  });

  it('uses opaque white for meshes without a vertex-color stream, including exported empty arrays', () => {
    const geometry = sourceGeometry([[0, 0, 0], [1, 0, 0], [0, 1, 0]], [[0, 0], [1, 0], [0, 1]], [0, 1, 2], []);
    expect(Array.from(geometry.getAttribute('in_COLOR0').array)).toEqual(Array(12).fill(1));
    geometry.dispose();
  });

  it('writes actor depth only in the solid pass despite a null material zWrite field', () => {
    const source = metadata.servantMaterials.body_level_1.material;
    const shader = metadata.shaders.find(s => s.name === source.shaderName)!;
    expect(source.zWrite).toBeNull();
    expect(sourcePassState(shader, source, 0)).toMatchObject({ depthWrite: true, depthFunc: THREE.LessEqualDepth, forceSinglePass: true });
    expect(sourcePassState(shader, source, 1).depthWrite).toBe(false);
  });

  it('resolves material-bound additive blending and depth test from source pass properties', () => {
    const source = Object.values(metadata.materials).find(m => m.name === '100100_tex001_add')!;
    const shader = metadata.shaders.find(s => s.name === source.shaderName)!;
    expect(sourcePassState(shader, source, 0)).toMatchObject({
      blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor,
      depthWrite: false, depthTest: true, depthFunc: THREE.LessEqualDepth,
    });
  });

  it('uses constant premultiplied blending and preserves alpha for an RGB-only pass', () => {
    const shader = metadata.shaders.find(s => s.name.endsWith('Alpha Blended Premultiply'))!;
    const source = metadata.servantMaterials.body_level_1.material;
    expect(sourcePassState(shader, source, 0)).toMatchObject({
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
      depthWrite: false,
    });
  });
});
