import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Mesh, PerspectiveCamera, Quaternion, Scene, Texture } from 'three';
import type { BuiltinEffectAssets, EffectData, SceneMetadata } from '../cutscene/fgoSceneData';
import { withBuiltinEffects } from '../cutscene/fgoSceneData';
import { clipValues } from '../cutscene/fgoSceneMath';
import { SourceMaterials } from '../cutscene/fgoSceneMaterials';
import { particleGeometries, SourceEffect } from '../cutscene/fgoSceneParticles';

const base = 'public/assets/dev/fgo-cutscene/np100100/';
const source = JSON.parse(readFileSync(`${base}np100100_effects.json`, 'utf8')) as EffectData;
const metadata = JSON.parse(readFileSync(`${base}np100100_scene.json`, 'utf8')) as SceneMetadata;
const builtin = JSON.parse(readFileSync(`${base}np100100_builtin.json`, 'utf8')) as BuiltinEffectAssets;
const merged = withBuiltinEffects(source, metadata, builtin);

describe('FGO APK built-in opening effect', () => {
  it('preserves all four scalar channels in original quaternion clips', () => {
    for (const name of ['start_cross', 'start_halo01', 'start_halo02']) {
      const clip = builtin.effects.simpleAnimations!.flatMap(animation => animation.clips).find(item => item.name === name)!;
      expect(clip.bindings).toHaveLength(1);
      expect(clip.bindings[0]).toMatchObject({ attribute: 'quaternion', componentCount: 4, scalarOffset: 0 });
      expect(clip.scalarCount).toBe(4);
      expect(clipValues(clip, 0.1).every(Number.isFinite)).toBe(true);
    }
  });

  it('uses file-qualified mesh references and applies source rotations on the live hierarchy', () => {
    const scene = new Scene();
    const textures = new Map(merged.effects.textures.map(item => [item.file, new Texture()]));
    const factory = new SourceMaterials(merged.scene, textures);
    expect(Object.values(builtin.scene.materials).map(material => material.renderQueue)).toEqual([3001]);
    const geometries = particleGeometries(merged.effects.meshes);
    const root = merged.effects.roots.find(item => item.name === 'Start_nf')!;
    const effect = new SourceEffect(root, 0, scene, merged.scene, merged.effects, scene, new PerspectiveCamera(), factory, geometries);
    try {
      for (const system of root.particleSystems) {
        for (const id of system.renderer.meshPathIds) {
          expect(id).toMatch(/^apk:[^:]+:\d+$/);
          expect(geometries.has(id)).toBe(true);
        }
      }
      const rotations = builtin.effects.simpleAnimations!.filter(animation => animation.clips[0].bindings.some(binding => binding.attribute === 'quaternion'));
      expect(rotations).toHaveLength(3);
      for (const time of [0.1, 0.3, 0.6]) {
        effect.update(time);
        if (time === 0.1) {
          const particles = scene.children.filter(node => node instanceof Mesh) as Mesh[];
          expect(particles.length).toBeGreaterThan(0);
          for (const particle of particles) {
            expect((particle.material as import('three').RawShaderMaterial).userData.sourceRenderQueue).toBe(3001);
          }
        }
        for (const animation of rotations) {
          const clip = animation.clips[0];
          const binding = clip.bindings[0];
          const node = effect.root.getObjectByName(animation.path)!;
          const expected = new Quaternion().fromArray(clipValues(clip, time).slice(binding.scalarOffset, binding.scalarOffset + 4)).normalize();
          expect(node.quaternion.angleTo(expected)).toBeLessThan(1e-6);
        }
      }
    } finally {
      effect.destroy(); factory.destroy(); geometries.forEach(geometry => geometry.dispose());
      textures.forEach(texture => texture.dispose());
    }
  });
});
