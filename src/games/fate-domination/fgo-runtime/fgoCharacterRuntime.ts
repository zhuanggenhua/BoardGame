import * as THREE from 'three';
import { SourceActor } from './fgoSceneActor';
import { SourceMaterials, sourceTransparentSort } from './fgoSceneMaterials';
import { clipValues } from './fgoSceneMath';
import { cloneFgoTextures, type LoadedCharacter } from './fgoPreload';
import { groundedFgoAttacks } from './fgoAttackSelection';

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

type BattleScreenPoint = { x: number; y: number };
export type FgoBattleEffect =
  | { kind: 'strike'; shape: 'slash' | 'thrust'; turnId: number; from: BattleScreenPoint; to: BattleScreenPoint; untilImpact: number }
  | { kind: 'impact'; turnId: number; at: BattleScreenPoint; flip: boolean };

type Actor = FgoBattleActorInput & {
  actor: SourceActor;
  materials: SourceMaterials;
  textures: Map<string, THREE.Texture>;
  animation: string;
  duration: number;
  impact: number;
  homeX: number;
  homeY: number;
  laneX: number;
  travel: number;
};
type BattleTurn = { attacker: Actor; target: Actor; animation: string; start: number; duration: number; impactAt: number; returnAt: number; travel: number; lanes: Map<Actor, number> };

const MODEL_HEIGHT = 2.4;
const VIEW_HEIGHT = 3.6;
const FADE_IN_SECONDS = 0.2;
const FADE_OUT_SECONDS = 0.35;
const RETURN_SECONDS = 0.3;
const STRIKE_LEAD_SECONDS = 0.16;
const ATTACK_IMPACT: Record<string, number> = {
  'servant-saber': 0.65,
  'servant-cu-chulainn': 0.43,
  'servant-medusa': 0.65,
};

/** 攻击动作结束前保持接近目标；动作和受击都结束后再平滑回位。 */
export function fgoAttackMovement(time: number, impactAt: number, returnAt: number): number {
  if (time < impactAt) return impactAt > 0 ? Math.max(0, time / impactAt) : 1;
  if (time < returnAt) return 1;
  return Math.max(0, 1 - (time - returnAt) / RETURN_SECONDS);
}

/** 在同一镜头和坐标空间播放来源动作，角色与对手才能真实接触。 */
export function createFgoBattleRuntime(
  host: HTMLElement,
  inputs: FgoBattleActorInput[],
  laneCount: number,
  onComplete: () => void,
  onEffect?: (effect: FgoBattleEffect) => void,
): FgoBattleRuntimeHandle | null {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 2000);
  // 与参考工程保持同一相机坐标变换；朝向只在角色根节点调整。
  camera.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.setTransparentSort((a, b) => sourceTransparentSort(a, b, camera.position));
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;opacity:0';
  host.replaceChildren(renderer.domElement);

  const actors: Actor[] = [];
  let frame = 0;
  let observer: ResizeObserver | undefined;
  let destroyed = false;
  let complete = false;
  let elapsed = -FADE_IN_SECONDS;
  let lastTick = 0;
  let duration = 0;
  let lastStrike: BattleTurn | undefined;
  let lastImpact: BattleTurn | undefined;

  const projectBody = (item: Actor): BattleScreenPoint | undefined => {
    const bounds = item.actor.bounds(true, true);
    if (bounds.isEmpty()) return;
    const point = bounds.getCenter(new THREE.Vector3()).project(camera);
    return { x: (point.x + 1) * 50, y: (1 - point.y) * 50 };
  };

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

  const pose = (item: Actor, time: number, animation = item.animation, loop = false) => {
    const clip = item.loaded.data.skin.animations!.find(candidate => candidate.name === animation)!;
    const sampleTime = loop ? time : Math.min(time, clip.duration);
    item.actor.pose(animation, sampleTime, 1, loop);
    const tracks = item.loaded.data.visibility[animation];
    if (tracks?.length) {
      const values = clipValues(clip, sampleTime, loop, true);
      for (const track of tracks) item.actor.setMeshVisible(track.mesh, values[track.scalarOffset] > 0.5);
    }
  };

  try {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    const span = Math.max(2.4, Math.min(4.5, width / height * VIEW_HEIGHT * 0.5));
    for (const input of inputs) {
      // Extra 是完整连段，不适合作为对单个对手的一次普通攻击。
      const attacks = groundedFgoAttacks(input.loaded.data.skin.animations ?? []);
      const animation = input.role === 'attack' ? attacks[0]?.name : 'damage_01';
      const clip = input.loaded.data.skin.animations?.find(candidate => candidate.name === animation);
      if (!clip || !animation) continue;
      if (!input.loaded.data.skin.animations?.some(candidate => candidate.name === 'wait')) {
        console.warn(`Fate 角色缺少待机动作：${input.servantId}`);
        continue;
      }
      const textures = cloneFgoTextures(input.loaded.textures);
      const materials = new SourceMaterials(input.loaded.data, textures);
      let actor: SourceActor | undefined;
      try {
        actor = new SourceActor(input.loaded.data.skin, input.loaded.data.materials, materials, 90);
        actor.root.rotation.y = input.facing === 'left' ? Math.PI : 0;
        scene.add(actor.root);
        const item: Actor = { ...input, actor, materials, textures, animation, duration: clip.duration, impact: ATTACK_IMPACT[input.servantId] ?? 0.65, homeX: 0, homeY: 0, laneX: 0, travel: 0 };
        actors.push(item);
        pose(item, 0, 'wait');
        const original = actor.bounds(true);
        const modelHeight = original.max.y - original.min.y;
        if (!Number.isFinite(modelHeight) || modelHeight <= 0) throw new Error(`角色模型尺寸无效：${input.playerId}`);
        actor.root.scale.setScalar(MODEL_HEIGHT / modelHeight);
        pose(item, 0, 'wait');
        const fitted = actor.bounds(true);
        const center = fitted.getCenter(new THREE.Vector3());
        const laneX = laneCount <= 1 ? 0 : -span / 2 + span * input.lane / (laneCount - 1);
        item.laneX = laneX;
        actor.root.position.set(laneX - center.x, -fitted.min.y, 0);
        item.homeX = actor.root.position.x;
        item.homeY = actor.root.position.y;
        pose(item, 0, 'wait');
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
    const targets = actors.filter(actor => actor.role === 'damage');
    const turns: BattleTurn[] = [];
    const lastAnimation = new Map<string, string>();

    // 所有角色共用画布；每次仅让当前对手受击，其他角色继续待机。
    for (const attacker of attackers) {
      for (const target of targets) {
      // 当前目标站在接敌位，其他对手保留在后方；交接在回位阶段完成。
      const slots = targets.map(item => item.laneX).sort((a, b) => attacker.facing === 'right' ? a - b : b - a);
      const orderedTargets = [target, ...targets.filter(item => item !== target)];
      const lanes = new Map(orderedTargets.map((item, index) => [item, slots[index]]));
      const clips = groundedFgoAttacks(attacker.loaded.data.skin.animations!);
      const remaining = clips.filter(clip => clip.name !== lastAnimation.get(attacker.playerId));
      const choices = remaining.length ? remaining : clips;
      const clip = choices[Math.floor(Math.random() * choices.length)];
      if (!clip) continue;
      lastAnimation.set(attacker.playerId, clip.name);
      const impactAt = clip.duration * attacker.impact;
      pose(attacker, impactAt, clip.name);
      const attackBounds = attacker.actor.bounds(true, true);
      target.actor.root.position.x = target.homeX + lanes.get(target)! - target.laneX;
      pose(target, 0, 'wait');
      const targetBounds = target.actor.bounds(true, true);
      target.actor.root.position.x = target.homeX;
      const gap = attacker.facing === 'right'
        ? targetBounds.min.x - attackBounds.max.x
        : targetBounds.max.x - attackBounds.min.x;
      const distance = Math.abs(target.homeX + lanes.get(target)! - target.laneX - attacker.homeX) * 0.8;
      const travel = attacker.facing === 'right'
        ? Math.max(0, Math.min(distance, gap))
        : Math.min(0, Math.max(-distance, gap));
      const returnAt = Math.max(clip.duration, impactAt + target.duration);
      const turnDuration = returnAt + RETURN_SECONDS;
      turns.push({ attacker, target, animation: clip.name, start: duration, duration: turnDuration, impactAt, returnAt, travel, lanes });
      duration += turnDuration;
      pose(attacker, 0, 'wait');
      }
    }
    if (!turns.length) { dispose(); return null; }

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
        // 帧间隔过长时保留动作过程，避免卡顿后直接跳过受击。
        if (lastTick) elapsed += Math.min((timestamp - lastTick) / 1000, 0.1);
        lastTick = timestamp;
        const playTime = Math.max(0, elapsed);
        const opacity = elapsed < 0 ? (elapsed + FADE_IN_SECONDS) / FADE_IN_SECONDS
          : elapsed > duration ? Math.max(0, 1 - (elapsed - duration) / FADE_OUT_SECONDS) : 1;
        renderer.domElement.style.opacity = String(opacity);
        const turn = turns.find(item => playTime >= item.start && playTime < item.start + item.duration);
        // 最后一击结束后仍沿用最终队形，直到整个画布淡出。
        const formation = turn ?? (elapsed >= duration ? turns[turns.length - 1] : undefined);
        const next = turn ? turns[turns.indexOf(turn) + 1] : undefined;
        if (turn && host.dataset.fgoTarget !== turn.target.playerId) {
          host.dataset.fgoAnimation = turn.animation;
          host.dataset.fgoDuration = String(turn.duration);
          host.dataset.fgoTarget = turn.target.playerId;
        }
        else if (!turn && host.dataset.fgoTarget) delete host.dataset.fgoTarget;
        for (const item of actors) {
          item.actor.root.position.x = item.homeX;
          item.actor.root.position.y = item.homeY;
          if (formation && item.role === 'damage') {
            const from = formation.lanes.get(item) ?? item.laneX;
            const to = next?.lanes.get(item) ?? from;
            const blend = turn ? Math.max(0, Math.min(1, (playTime - turn.start - turn.returnAt) / RETURN_SECONDS)) : 0;
            item.actor.root.position.x += from + (to - from) * blend - item.laneX;
          }
          if (turn && item === turn.attacker) {
            const time = Math.max(0, playTime - turn.start);
            const clip = item.loaded.data.skin.animations!.find(candidate => candidate.name === turn.animation)!;
            const movement = fgoAttackMovement(time, turn.impactAt, turn.returnAt);
            item.actor.root.position.x = item.homeX + turn.travel * movement;
            if (time < clip.duration) pose(item, time, turn.animation);
            else pose(item, playTime, 'wait', true);
            // 按身体网格适配高跳；长武器不能阻止角色留在画面中。
            const bounds = item.actor.bounds(true, true);
            if (Number.isFinite(bounds.min.y) && Number.isFinite(bounds.max.y)) {
              const overflow = Math.max(0, bounds.max.y - VIEW_HEIGHT * 0.95);
              item.actor.root.position.y -= Math.min(overflow, Math.max(0, bounds.min.y));
            }
          } else if (turn && item === turn.target && playTime - turn.start >= turn.impactAt
            && playTime - turn.start < turn.impactAt + item.duration) {
            pose(item, playTime - turn.start - turn.impactAt);
          } else pose(item, playTime, 'wait', true);
        }
        const targetPositions = targets.map(item => [item.playerId, item.actor.root.position.x] as const);
        if (turn === turns[turns.length - 1]) host.dataset.fgoLastFormation = JSON.stringify(targetPositions);
        if (!turn && elapsed >= duration && !host.dataset.fgoFadeFormation) host.dataset.fgoFadeFormation = JSON.stringify(targetPositions);
        if (turn && onEffect) {
          const untilImpact = turn.start + turn.impactAt - playTime;
          if (turn !== lastStrike && untilImpact <= STRIKE_LEAD_SECONDS && untilImpact > 0) {
            lastStrike = turn;
            const from = projectBody(turn.attacker);
            const to = projectBody(turn.target);
            const shape = turn.attacker.servantId === 'servant-cu-chulainn' && turn.animation === 'attack_q' ? 'thrust' : 'slash';
            if (from && to) onEffect({ kind: 'strike', shape, turnId: turn.start, from, to, untilImpact });
          }
          if (turn !== lastImpact && untilImpact <= 0) {
            lastImpact = turn;
            const from = projectBody(turn.attacker);
            const at = projectBody(turn.target);
            if (at) onEffect({ kind: 'impact', turnId: turn.start, at, flip: !!from && at.x < from.x });
          }
        }
        renderer.render(scene, camera);
        if (elapsed >= duration + FADE_OUT_SECONDS) {
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
