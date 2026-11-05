import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Box3, Mesh, RawShaderMaterial, Texture, Vector3 } from 'three';
import type { CutsceneActorsData, SceneMetadata } from '../cutscene/fgoSceneData';
import { SourceActor } from '../cutscene/fgoSceneActor';
import { SourceMaterials } from '../cutscene/fgoSceneMaterials';
import type { FgoCharacterModel } from '../cutscene/fgoCharacterData';

const base = 'public/assets/dev/fgo-cutscene/np100100/';
const metadata = JSON.parse(readFileSync(`${base}np100100_scene.json`, 'utf8')) as SceneMetadata;
const actors = JSON.parse(readFileSync(`${base}np100100_cutscene_actors.json`, 'utf8')) as CutsceneActorsData;

describe('FGO native character color event', () => {
  it('does not frame the parked companion in the original multi-person spell clip', () => {
    const model = JSON.parse(readFileSync('public/assets/dev/fgo-characters/9947110/model.json', 'utf8')) as FgoCharacterModel;
    const textures = new Map(Object.values(model.materials).map(record => [record.texture!, new Texture()]));
    const factory = new SourceMaterials(model, textures);
    const actor = new SourceActor(model.skin, model.materials, factory, 90);
    try {
      actor.pose('spell', 0, 1, false);
      expect(actor.bounds().min.x).toBeLessThan(-8);
      expect(actor.bounds(true).min.x).toBeGreaterThan(-2);
      expect(actor.bounds(true).min.y).toBeGreaterThan(-1);
    } finally {
      actor.destroy(); factory.destroy(); textures.forEach(texture => texture.dispose());
    }
  });
  it('layers a two-bone eye clip over the idle pose and preserves all unrelated body parts', () => {
    const model = JSON.parse(readFileSync('public/assets/dev/fgo-characters/9947080/model.json', 'utf8')) as FgoCharacterModel;
    const textures = new Map(Object.values(model.materials).map(record => [record.texture!, new Texture()]));
    const factory = new SourceMaterials(model, textures);
    const actor = new SourceActor(model.skin, model.materials, factory, 90);
    try {
      actor.pose('wait', 0, 1, false);
      const idle = actor.bones.map(bone => bone.matrix.toArray());
      const affected = new Set(model.skin.animations!.find(clip => clip.name === 'eye_close')!.bindings.map(binding => binding.nodeIndex));
      actor.pose('eye_close', 0.01, 1, false, 'wait');
      actor.bones.forEach((bone, index) => {
        if (!affected.has(index)) expect(bone.matrix.toArray()).toEqual(idle[index]);
      });
    } finally {
      actor.destroy(); factory.destroy(); textures.forEach(texture => texture.dispose());
    }
  });
  it('excludes the original 0.001-scale parked limbs from gallery framing without changing geometry', () => {
    const model = JSON.parse(readFileSync('public/assets/dev/fgo-characters/9947440/model.json', 'utf8')) as FgoCharacterModel;
    const textures = new Map(Object.values(model.materials).map(record => [record.texture!, new Texture()]));
    const factory = new SourceMaterials(model, textures);
    const actor = new SourceActor(model.skin, model.materials, factory, 90);
    try {
      actor.pose('wait02', 0, 2);
      expect(actor.bounds().min.y).toBeLessThan(-20);
      const framed = actor.bounds(true);
      expect(framed.min.y).toBeGreaterThan(-2);
      expect(framed.getSize(new Vector3()).y).toBeLessThan(5);
      expect(actor.bounds().min.y).toBeLessThan(-20);
    } finally {
      actor.destroy(); factory.destroy(); textures.forEach(texture => texture.dispose());
    }
  });
  it('sorts both original actor passes using the current deformed skin bounds', () => {
    const data = actors.actors.find(actor => actor.name === 'chr_100101')!;
    const records = metadata.actorMaterials.chr_100101;
    const texture = new Texture();
    const factory = new SourceMaterials(metadata, new Map([[data.texture, texture]]));
    const actor = new SourceActor(data, records, factory);
    try {
      actor.root.position.set(7, 2, -3);
      actor.pose('treasureArms5_a', 0.5, 2);
      const views: Mesh[] = [];
      actor.root.traverse(object => { if (object instanceof Mesh) views.push(object); });
      const body = views.filter(view => view.name === 'body_level_2');
      expect(body).toHaveLength(2);
      expect(records.body_level_2.bounds.updateWhenOffscreen).toBe(true);
      const points = body[0].geometry.getAttribute('in_POSITION0');
      const bounds = new Box3();
      const point = new Vector3();
      for (let index = 0; index < points.count; index += 1) {
        bounds.expandByPoint(point.fromBufferAttribute(points, index));
      }
      const expected = bounds.getCenter(new Vector3()).applyMatrix4(body[0].matrixWorld);
      for (const view of body) expect(view.userData.sourceRendererSort.center.distanceTo(expected)).toBeLessThan(1e-6);
      expect(body[0].userData.sourceRendererSort.center).toBe(body[1].userData.sourceRendererSort.center);
      expect(expected.distanceTo(actor.root.position)).toBeGreaterThan(1);
      expect(actor.bounds().isEmpty()).toBe(false);
      expect(actor.bounds().containsPoint(expected)).toBe(true);
    } finally {
      actor.destroy(); factory.destroy(); texture.dispose();
    }
  });

  it('crossfades both original shader passes and restores the material without affecting another body level', () => {
    const data = actors.actors.find(actor => actor.name === 'chr_100101')!;
    const texture = new Texture();
    const factory = new SourceMaterials(metadata, new Map([[data.texture, texture]]));
    const actor = new SourceActor(data, metadata.actorMaterials.chr_100101, factory);
    const views: Mesh<import('three').BufferGeometry, RawShaderMaterial>[] = [];
    actor.root.traverse(object => {
      if (object instanceof Mesh && object.material instanceof RawShaderMaterial) views.push(object);
    });
    try {
      actor.setColorFade('body_level_2', { r: 1, g: 0.75, b: 0, a: 0.4 }, 0.2);
      const body = views.filter(view => view.name === 'body_level_2');
      expect(body).toHaveLength(2);
      for (const view of body) {
        expect(view.material.uniforms._Color.value.toArray()).toEqual([0.8, 0.8, 0.8, 1]);
        expect(view.material.uniforms._AddColor.value.x).toBeCloseTo(0.2);
        expect(view.material.uniforms._AddColor.value.y).toBeCloseTo(0.15);
        expect(view.material.uniforms._AddColor.value.z).toBe(0);
        expect(view.material.uniforms._AddColor.value.w).toBe(0);
      }
      for (const view of views.filter(view => view.name === 'body_level_3')) {
        expect(view.material.uniforms._Color.value.toArray()).toEqual([1, 1, 1, 1]);
        expect(view.material.uniforms._AddColor.value.toArray()).toEqual([0, 0, 0, 0]);
      }
      actor.setColorFade('body_level_2', { r: 1, g: 0.75, b: 0, a: 1 }, 0.2);
      for (const view of body) expect(view.material.uniforms._Color.value.x).toBe(0.8);
      actor.resetColors();
      for (const view of body) {
        expect(view.material.uniforms._Color.value.toArray()).toEqual([1, 1, 1, 1]);
        expect(view.material.uniforms._AddColor.value.toArray()).toEqual([0, 0, 0, 0]);
      }
    } finally {
      actor.destroy(); factory.destroy(); texture.dispose();
    }
  });
});
