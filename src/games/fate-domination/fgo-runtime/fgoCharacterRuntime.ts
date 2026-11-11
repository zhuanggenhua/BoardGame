import * as THREE from 'three';
import { SourceActor } from './fgoSceneActor';
import { SourceMaterials, sourceTransparentSort } from './fgoSceneMaterials';
import { clipValues } from './fgoSceneMath';
import { cloneFgoTextures, type LoadedCharacter } from './fgoPreload';

export type FgoBattleActorInput = {
  playerId: string;
  servantId: string;
  role: 'attack' | 'damage';
  lane: number;
  targetLane: number;
  facing: 'left' | 'right';
  loaded: LoadedCharacter;
};

export type FgoBattleRuntimeHandle = { destroy: () => void };

type Actor = FgoBattleActorInput & {
  actor: SourceActor;
  materials: SourceMaterials;
  textures: Map<string, THREE.Texture>;
  animation: string;
  duration: number;
  impact: number;
  homeX: number;
  travel: number;
};

const MODEL_HEIGHT = 2.4;
const VIEW_HEIGHT = 3.6;
const ATTACK_ANIMATIONS: Record<string, { name: string; impact: number }> = {
  'servant-saber': { name: 'attack_b', impact: 0.65 },
  'servant-cu-chulainn': { name: 'attack_q', impact: 0.43 },
  'servant-medusa': { name: 'attack_q', impact: 0.65 },
};

/** 在同一镜头和坐标空间播放来源动作，角色与对手才能真实接触。 */
export function createFgoBattleRuntime(
  host: HTMLElement,
  inputs: FgoBattleActorInput[],
  laneCount: number,
  onComplete: () => void,
): FgoBattleRuntimeHandle | null {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 2000);
  // 与参考工程保持同一相机坐标变换；朝向只在角色根节点调整。
  camera.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.setTransparentSort((a, b) => sourceTransparentSort(a, b, camera.position));
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
  host.replaceChildren(renderer.domElement);

  const actors: Actor[] = [];
  let frame = 0;
  let observer: ResizeObserver | undefined;
  let destroyed = false;
  let complete = false;
  let elapsed = 0;
  let lastTick = 0;
  let impactAt = 0;
  let duration = 0;

  const dispose = () => {
    if (destroyed) return;
    destroyed = true;
    cancelAnimationFrame(frame);
    observer?.disconnect();
    for (const item of actors) {
      item.actor.destroy();
      item.materials.destroy();
      item.textures.forEach(texture => texture.dispose());
    }
    renderer.dispose();
    renderer.domElement.remove();
  };

  const pose = (item: Actor, time: number) => {
    item.actor.pose(item.animation, Math.min(time, item.duration), 1, false);
    const tracks = item.loaded.data.visibility[item.animation];
    if (tracks?.length) {
      const clip = item.loaded.data.skin.animations!.find(candidate => candidate.name === item.animation)!;
      const values = clipValues(clip, Math.min(time, item.duration), false, true);
      for (const track of tracks) item.actor.setMeshVisible(track.mesh, values[track.scalarOffset] > 0.5);
    }
  };

  try {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    const span = Math.max(2.4, Math.min(3.2, width / height * VIEW_HEIGHT * 0.4));
    for (const input of inputs) {
      const attack = ATTACK_ANIMATIONS[input.servantId];
      const animation = input.role === 'attack' ? attack?.name : 'damage_01';
      const clip = input.loaded.data.skin.animations?.find(candidate => candidate.name === animation);
      if (!clip || !animation) continue;
      const textures = cloneFgoTextures(input.loaded.textures);
      const materials = new SourceMaterials(input.loaded.data, textures);
      let actor: SourceActor | undefined;
      try {
        actor = new SourceActor(input.loaded.data.skin, input.loaded.data.materials, materials, 90);
        actor.root.rotation.y = input.facing === 'left' ? Math.PI : 0;
        scene.add(actor.root);
        const item: Actor = { ...input, actor, materials, textures, animation, duration: clip.duration, impact: attack?.impact ?? 0, homeX: 0, travel: 0 };
        actors.push(item);
        pose(item, 0);
        const original = actor.bounds(true);
        const modelHeight = original.max.y - original.min.y;
        if (!Number.isFinite(modelHeight) || modelHeight <= 0) throw new Error(`角色模型尺寸无效：${input.playerId}`);
        actor.root.scale.setScalar(MODEL_HEIGHT / modelHeight);
        pose(item, 0);
        const fitted = actor.bounds(true);
        const center = fitted.getCenter(new THREE.Vector3());
        const laneX = laneCount <= 1 ? 0 : -span / 2 + span * input.lane / (laneCount - 1);
        actor.root.position.set(laneX - center.x, -fitted.min.y, 0);
        item.homeX = actor.root.position.x;
        pose(item, 0);
      } catch (error) {
        if (actor) { scene.remove(actor.root); actor.destroy(); }
        const index = actors.findIndex(item => item.actor === actor);
        if (index >= 0) actors.splice(index, 1);
        materials.destroy(); textures.forEach(texture => texture.dispose());
        console.warn('Fate 角色演出无法播放', error);
      }
    }
    if (!actors.length) { dispose(); return null; }

    const attackers = actors.filter(actor => actor.role === 'attack');
    impactAt = attackers.length ? Math.min(...attackers.map(actor => actor.duration * actor.impact)) : 0;
    duration = Math.max(...actors.map(actor => actor.role === 'attack' ? actor.duration : impactAt + actor.duration));

    // 用双方模型在命中帧的包围盒确定接触距离，而不是各自在独立画布中播放。
    for (const attacker of attackers) {
      const target = actors.find(candidate => candidate.lane === attacker.targetLane && candidate.role === 'damage');
      if (!target) continue;
      pose(attacker, attacker.duration * attacker.impact);
      const attackBounds = attacker.actor.bounds(true);
      pose(target, 0);
      const targetBounds = target.actor.bounds(true);
      const gap = attacker.facing === 'right'
        ? targetBounds.min.x - attackBounds.max.x
        : targetBounds.max.x - attackBounds.min.x;
      const distance = Math.abs(target.homeX - attacker.homeX) * 0.8;
      attacker.travel = attacker.facing === 'right'
        ? Math.max(0, Math.min(distance, gap))
        : Math.min(0, Math.max(-distance, gap));
      pose(attacker, 0);
    }

    const resize = () => {
      const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const distance = VIEW_HEIGHT / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
      camera.position.set(0, VIEW_HEIGHT / 2, -distance);
      camera.updateProjectionMatrix();
      camera.projectionMatrix.elements[0] *= -1;
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      camera.updateMatrixWorld(true);
      renderer.render(scene, camera);
    };
    observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    const tick = (timestamp: number) => {
      if (destroyed) return;
      try {
        if (lastTick) elapsed += Math.min((timestamp - lastTick) / 1000, 0.1);
        lastTick = timestamp;
        for (const item of actors) {
          const time = item.role === 'attack' ? elapsed : Math.max(0, elapsed - impactAt);
          if (item.role === 'attack') {
            const progress = Math.min(1, elapsed / item.duration);
            const movement = progress < item.impact ? progress / item.impact : Math.max(0, (1 - progress) / (1 - item.impact));
            item.actor.root.position.x = item.homeX + item.travel * movement;
          }
          pose(item, time);
        }
        // 跳跃时让镜头临时容纳整套动作，落地后恢复地区内的大比例。
        const jumping = actors.filter(item => item.role === 'attack' && item.servantId === 'servant-medusa');
        if (jumping.length) {
          const maxY = Math.max(MODEL_HEIGHT, ...jumping.map(item => item.actor.bounds(true).max.y));
          const viewHeight = Math.max(VIEW_HEIGHT, maxY * 1.08);
          camera.position.y = viewHeight / 2;
          camera.position.z = -viewHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
          camera.updateMatrixWorld(true);
        }
        renderer.render(scene, camera);
        if (elapsed >= duration) {
          if (!complete) { complete = true; onComplete(); }
          return;
        }
        frame = requestAnimationFrame(tick);
      } catch (error) {
        console.warn('Fate 战斗演出失败', error);
        if (!complete) { complete = true; onComplete(); }
      }
    };
    frame = requestAnimationFrame(tick);
    return { destroy: dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
