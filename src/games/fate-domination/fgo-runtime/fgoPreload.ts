import * as THREE from 'three';
import { readFgoAsset, readFgoJson } from './fgoAssets';
import { applySourceSampler } from './fgoSceneMaterials';
import { withBuiltinEffects } from './fgoSceneData';
import type { FgoCharacterModel } from './fgoCharacterData';
import type { BuiltinEffectAssets, CutsceneActorsData, EffectData, SceneMetadata, SkinData } from './fgoSceneData';

export const FGO_SERVANTS: Record<string, string> = {
  'servant-saber': '100100',
  'servant-cu-chulainn': '300100',
  'servant-medusa': '400100',
};

export interface LoadedCharacter { data: FgoCharacterModel; textures: Map<string, THREE.Texture> }
export interface LoadedNoble {
  skin: SkinData; effects: EffectData; actors: CutsceneActorsData;
  scene: SceneMetadata; textures: Map<string, THREE.Texture>;
}

const characters = new Map<string, LoadedCharacter>();
const pending = new Map<string, { priority: 'high' | 'low'; controller: AbortController; load: Promise<void> }>();
let noble: LoadedNoble | undefined;
let noblePending: { priority: 'high' | 'low'; controller: AbortController; load: Promise<void> } | undefined;
let owners = 0;
let generation = 0;
let controller = new AbortController();

/** 预载数据属于对局；最后一个牌桌退出时取消请求并释放纹理。 */
export function retainFgoAssets(): () => void {
  owners += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    owners -= 1;
    if (owners > 0) return;
    generation += 1;
    controller.abort();
    controller = new AbortController();
    characters.forEach(item => item.textures.forEach(texture => texture.dispose()));
    characters.clear();
    noble?.textures.forEach(texture => texture.dispose());
    noble = undefined;
    pending.clear();
    noblePending = undefined;
  };
}

async function texture(path: string, priority: 'high' | 'low', signal: AbortSignal): Promise<THREE.Texture> {
  const response = await readFgoAsset(path, priority, signal);
  const objectUrl = URL.createObjectURL(await response.blob());
  try { return await new THREE.TextureLoader().loadAsync(objectUrl); }
  finally { URL.revokeObjectURL(objectUrl); }
}

export function preloadFgoCharacter(servantId: string, priority: 'high' | 'low' = 'low'): Promise<void> {
  const id = FGO_SERVANTS[servantId];
  if (!id || characters.has(id)) return Promise.resolve();
  const existing = pending.get(id);
  if (existing && (priority !== 'high' || existing.priority === 'high')) return existing.load;
  existing?.controller.abort();
  const currentGeneration = generation;
  const parentSignal = controller.signal;
  const request = new AbortController();
  const abort = () => request.abort();
  parentSignal.addEventListener('abort', abort, { once: true });
  const signal = request.signal;
  const load: Promise<void> = (async () => {
    const data = await readFgoJson<FgoCharacterModel>(`fgo-characters/${id}/model.json`, priority, signal);
    if (currentGeneration !== generation || signal.aborted) return;
    const files = new Set([data.skin.texture, ...Object.values(data.materials).map(item => item.texture).filter((file): file is string => Boolean(file))]);
    const textures = new Map<string, THREE.Texture>();
    try {
      for (const file of files) {
        const loaded = await texture(`fgo-characters/${file}`, priority, signal);
        if (data.textureSamplers[file]) applySourceSampler(loaded, data.textureSamplers[file]);
        textures.set(file, loaded);
      }
      if (currentGeneration === generation && !signal.aborted) characters.set(id, { data, textures });
      else textures.forEach(item => item.dispose());
    } catch (error) {
      textures.forEach(item => item.dispose());
      throw error;
    }
  })().finally(() => {
    parentSignal.removeEventListener('abort', abort);
    if (pending.get(id)?.load === load) pending.delete(id);
  });
  pending.set(id, { priority, controller: request, load });
  return load;
}

export function loadedFgoCharacter(servantId: string): LoadedCharacter | undefined {
  return characters.get(FGO_SERVANTS[servantId]);
}

export function preloadFgoNoble(priority: 'high' | 'low' = 'low'): Promise<void> {
  if (noble) return Promise.resolve();
  if (noblePending && (priority !== 'high' || noblePending.priority === 'high')) return noblePending.load;
  noblePending?.controller.abort();
  const root = 'fgo-cutscene/np100100/';
  const currentGeneration = generation;
  const parentSignal = controller.signal;
  const request = new AbortController();
  const abort = () => request.abort();
  parentSignal.addEventListener('abort', abort, { once: true });
  const signal = request.signal;
  const load: Promise<void> = (async () => {
    const [skin, sourceEffects, actors, sourceScene, builtin] = await Promise.all([
      readFgoJson<SkinData>(`${root}saber_body_level_1_skin.json`, priority, signal),
      readFgoJson<EffectData>(`${root}np100100_effects.json`, priority, signal),
      readFgoJson<CutsceneActorsData>(`${root}np100100_cutscene_actors.json`, priority, signal),
      readFgoJson<SceneMetadata>(`${root}np100100_scene.json`, priority, signal),
      readFgoJson<BuiltinEffectAssets>(`${root}np100100_builtin.json`, priority, signal),
    ]);
    if (currentGeneration !== generation || signal.aborted) return;
    const { effects, scene } = withBuiltinEffects(sourceEffects, sourceScene, builtin);
    const files = new Set([skin.texture, ...actors.actors.map(actor => actor.texture),
      ...effects.textures.map(item => item.file), 'compressed/portrait_full.webp', 'compressed/portrait_alpha.webp',
      'compressed/portrait_face.webp', 'compressed/portrait_face_alpha.webp',
      'compressed/bg_90001_back.webp', 'compressed/bg_90001_front.webp']);
    const textures = new Map<string, THREE.Texture>();
    try {
      for (const file of files) {
        const loaded = await texture(`${root}${file}`, priority, signal);
        loaded.name = file;
        loaded.generateMipmaps = true;
        if (scene.textureSamplers[file]) applySourceSampler(loaded, scene.textureSamplers[file]);
        textures.set(file, loaded);
      }
      if (currentGeneration === generation && !signal.aborted) noble = { skin, effects, actors, scene, textures };
      else textures.forEach(item => item.dispose());
    } catch (error) {
      textures.forEach(item => item.dispose());
      throw error;
    }
  })().finally(() => {
    parentSignal.removeEventListener('abort', abort);
    if (noblePending?.load === load) noblePending = undefined;
  });
  noblePending = { priority, controller: request, load };
  return load;
}

export function loadedFgoNoble(): LoadedNoble | undefined { return noble; }

export function cloneFgoTextures(textures: Map<string, THREE.Texture>): Map<string, THREE.Texture> {
  return new Map([...textures].map(([key, value]) => {
    const copy = value.clone();
    copy.needsUpdate = true;
    return [key, copy];
  }));
}
