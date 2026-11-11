import * as THREE from 'three';
import type { CutsceneRuntimeHandle, CutsceneRuntimeStatus } from './cutsceneDemoRuntime';
import type { CutsceneActorsData, EffectData, EffectTimelineEvent, SceneMetadata, SceneTrack, SkinData, Vec3 } from './fgoSceneData';
import { cloneFgoTextures, type LoadedNoble } from './fgoPreload';
import { clamp, keyCurve, setTransform, unityEuler } from './fgoSceneMath';
import { SourceActor } from './fgoSceneActor';
import { SourceCutIn } from './fgoSceneCutIn';
import { SourceBackground } from './fgoSceneBackground';
import { SourceMaterials, sourceTransparentSort } from './fgoSceneMaterials';
import { particleGeometries, SourceEffect } from './fgoSceneParticles';
import { cameraShakeOffset } from './fgoSceneCameraShake';
import { applyCameraPresentation } from './fgoScenePresentation';

const Y_HALF_TURN = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
const STEP = 1 / 30;

type RuntimeOptions = {
  autoplay?: boolean;
  speed?: number;
  shouldAttach?: () => boolean;
  onStatus?: (status: CutsceneRuntimeStatus) => void;
};
type ActorState = { animation: string; start: number; offset: number; speed: number; evolution: number; visible: boolean };
type Attachment = { parent: string; node: string; position: Vec3; rotation: Vec3; scale: Vec3 };

const vec = (value: { x?: number; y?: number; z?: number } | undefined, fallback: Vec3): Vec3 => [
  value?.x ?? fallback[0], value?.y ?? fallback[1], value?.z ?? fallback[2],
];
const trackValue = (track: SceneTrack | undefined, time: number, fallback: Vec3): Vec3 => track?.curves.length === 3
  ? track.curves.map((curve, i) => keyCurve(curve, time, fallback[i])) as Vec3 : fallback;

class SourceSceneRuntime implements CutsceneRuntimeHandle {
  private readonly host: HTMLElement;
  private readonly data: EffectData;
  private readonly metadata: SceneMetadata;
  private readonly options: RuntimeOptions;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 2000);
  private readonly cameraSpace = new THREE.Group();
  private readonly renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  private readonly materials: SourceMaterials;
  private readonly hero: SourceActor;
  private readonly cutIn: SourceCutIn;
  private readonly backgroundScene: SourceBackground;
  private readonly actors = new Map<string, SourceActor>();
  private readonly states = new Map<string, ActorState>();
  private readonly effects = new Map<string, SourceEffect>();
  private readonly attachments = new Map<string, Attachment>();
  private readonly geometries;
  private readonly events: EffectTimelineEvent[];
  private readonly fadeOverlay: HTMLDivElement;
  private readonly resizeObserver: ResizeObserver;
  private readonly textureFiles: Map<string, THREE.Texture>;
  private eventIndex = 0;
  private simStep = 0;
  private current = 0;
  private speed: number;
  private playing: boolean;
  private destroyed = false;
  private frame = 0;
  private lastTick = 0;
  private statusTick = -1;
  private background = '50200';
  private readonly fired: string[] = [];

  constructor(
    host: HTMLElement,
    skin: SkinData,
    data: EffectData,
    actorData: CutsceneActorsData,
    metadata: SceneMetadata,
    textures: Map<string, THREE.Texture>,
    options: RuntimeOptions,
  ) {
    this.host = host; this.data = data; this.metadata = metadata; this.options = options;
    this.textureFiles = textures;
    this.speed = options.speed ?? 1;
    this.playing = options.autoplay ?? false;
    this.events = [...data.timeline].sort((a, b) => a.time - b.time);
    this.materials = new SourceMaterials(metadata, textures);
    this.geometries = particleGeometries(data.meshes);
    this.renderer.autoClear = false;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setTransparentSort((a, b) => sourceTransparentSort(a, b, this.camera.position));
    this.scene.add(this.cameraSpace);
    this.backgroundScene = new SourceBackground(metadata, textures, this.scene);
    this.cutIn = new SourceCutIn(metadata, textures, this.cameraSpace);
    this.hero = new SourceActor(skin, metadata.servantMaterials, this.materials, 90);
    this.scene.add(this.hero.root);
    for (const actor of actorData.actors) {
      const instance = new SourceActor(actor, metadata.actorMaterials[actor.name], this.materials);
      if (actor.rootTransform) setTransform(instance.root, actor.rootTransform);
      instance.root.visible = false;
      this.actors.set(actor.name, instance);
      this.scene.add(instance.root);
    }
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
    this.fadeOverlay = document.createElement('div');
    this.fadeOverlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;background:white;opacity:0';
    host.replaceChildren(this.renderer.domElement, this.fadeOverlay);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    this.reset();
    this.advance(0);
    this.render();
    this.frame = requestAnimationFrame(this.tick);
    (window as Window & { __FGO_SOURCE_SCENE__?: unknown }).__FGO_SOURCE_SCENE__ = {
      seek: (time: number) => this.seek(time),
      advanceTo: (time: number) => {
        if (time < this.current) this.seek(time);
        else { this.moveTo(clamp(time, 0, this.data.duration)); this.render(); }
      },
      isolateParticles: (pattern: string) => {
        const include = new RegExp(pattern);
        for (const object of this.scene.children) {
          if (object.userData.sourceParticleSort) object.visible &&= include.test(object.name);
        }
        this.render();
      },
      snapshot: () => ({ time: this.current, background: this.background,
        camera: this.camera.position.toArray(), heroVisible: this.hero.root.visible,
        heroMeshes: this.hero.projectedBounds(this.camera),
        actors: [...this.actors].map(([name, actor]) => ({ name, visible: actor.root.visible, meshes: actor.projectedBounds(this.camera) })),
        effects: [...this.effects].map(([name, effect]) => ({ name, particles: effect.count,
          root: effect.root.getWorldPosition(new THREE.Vector3()).toArray(), sample: effect.sample() })),
      }),
    };
  }

  private resize() {
    const width = Math.max(1, this.host.clientWidth); const height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
  }

  private reset() {
    for (const effect of this.effects.values()) effect.destroy();
    this.effects.clear(); this.attachments.clear(); this.states.clear(); this.fired.length = 0;
    this.eventIndex = 0; this.current = 0; this.background = '50200';
    this.simStep = 0;
    this.backgroundScene.show(this.background);
    this.cutIn.reset();
    this.hero.resetColors();
    this.actors.forEach(actor => actor.resetColors());
    this.states.set('Actor', { animation: 'wait02', start: 0, offset: 0.4, speed: 1, evolution: 1, visible: true });
    for (const name of this.actors.keys()) {
      this.states.set(name, { animation: 'treasureArms4_a', start: 0, offset: 0, speed: 1, evolution: 2, visible: false });
    }
  }

  private parentEffect(name: string, effect: SourceEffect) {
    const attachment = this.attachments.get(name);
    if (attachment) {
      const actor = attachment.parent === 'Actor' ? this.hero : this.actors.get(attachment.parent);
      const bone = actor?.node(attachment.node);
      if (bone) {
        bone.add(effect.root);
        effect.root.position.fromArray(attachment.position);
        effect.root.quaternion.copy(unityEuler(attachment.rotation));
        effect.root.scale.fromArray(attachment.scale);
        return;
      }
    }
    const cameraRelative = this.metadata.targets[name]?.startsWith('/CutIns/');
    (cameraRelative ? this.cameraSpace : this.scene).add(effect.root);
  }

  private event(event: EffectTimelineEvent) {
    const state = this.states.get(event.target);
    if (event.type === 'animation' && state && event.animationName) {
      state.animation = event.animationName;
      state.start = event.time;
      state.offset = event.startTime ?? 0;
      state.speed = event.playbackSpeed ?? 1;
      state.visible = true;
    } else if (event.type === 'modelEvolution' && state) {
      if (event.evolutionLevel !== undefined && event.evolutionLevel >= 1) state.evolution = event.evolutionLevel;
    } else if (event.type === 'displayChange' && event.displayTarget === 0) {
      this.states.get('Actor')!.visible = Boolean(event.displayEnabled);
    } else if (event.type === 'setEnabled') {
      if (state) state.visible = Boolean(event.enabled);
      if (!event.enabled && this.effects.has(event.target)) {
        this.effects.get(event.target)!.destroy(); this.effects.delete(event.target);
      }
    } else if (event.type === 'attach') {
      const attachment: Attachment = {
        parent: event.parentObjectName || 'Actor', node: event.nodeName ?? '',
        position: vec(event.tposition, [0, 0, 0]), rotation: vec(event.trotation, [0, 0, 0]),
        scale: vec(event.tscale, [1, 1, 1]),
      };
      this.attachments.set(event.target, attachment);
      const active = this.effects.get(event.target);
      if (active) this.parentEffect(event.target, active);
    } else if (event.type === 'playEffect') {
      const root = this.data.roots.find(item => item.name === event.target);
      if (root) {
        this.effects.get(event.target)?.destroy();
        const effect = new SourceEffect(root, event.time, this.scene, this.metadata, this.data,
          this.scene, this.camera, this.materials, this.geometries);
        this.effects.set(event.target, effect);
        this.parentEffect(event.target, effect);
      }
    } else if (event.type === 'changeBg' && event.bgName) {
      this.background = event.bgName;
      this.backgroundScene.show(this.background);
    } else if (event.type === 'standardCutIn') {
      this.cutIn.start(event.time);
    }
    if (!['setEnabled', 'colorChange', 'timeScale'].includes(event.type)) {
      this.fired.push(`${event.time.toFixed(3)} ${event.type} ${event.target}`);
    }
  }

  private animateActors(time: number) {
    const actorPosition = this.metadata.propertyTracks.find(t => t.target === 'Actor' && t.property === 'position');
    const actorEuler = this.metadata.propertyTracks.find(t => t.target === 'Actor' && t.property === 'localEulerAngles');
    this.hero.root.position.fromArray(trackValue(actorPosition, time, [10.8, 0, -45.7]));
    this.hero.root.quaternion.copy(unityEuler(trackValue(actorEuler, time, [0, 180, 0])));
    for (const [name, actor] of [['Actor', this.hero] as const, ...this.actors.entries()]) {
      const state = this.states.get(name)!;
      actor.root.visible = state.visible;
      actor.pose(state.animation, state.offset + Math.max(0, time - state.start) * state.speed, state.evolution);
    }
    const colors = new Map<string, EffectTimelineEvent>();
    for (const event of this.events) {
      if (event.time > time) break;
      if (event.type === 'colorChange' && event.colorTarget === 4 && event.otherHierarchyPath) {
        colors.set(event.otherHierarchyPath, event);
      }
    }
    for (const [path, event] of colors) {
      const target = /^([^/]+)\(Clone\)\/([^/]+)$/.exec(path);
      const actor = target && this.actors.get(target[1]);
      if (!target || !actor || !event.fadeColour) throw new Error(`Original color event target unavailable: ${path}`);
      const keys = Array.isArray(event.fadeCurve) ? event.fadeCurve : event.fadeCurve?.m_Curve ?? [];
      actor.setColorFade(target[2], event.fadeColour, keyCurve(keys, clamp(time - event.time, 0, event.duration)));
    }
  }

  private animateCamera(time: number) {
    const position = this.metadata.propertyTracks.find(t => t.target === 'BattleCamera' && t.property === 'position');
    const angles = this.metadata.propertyTracks.find(t => t.target === 'BattleCamera' && t.property === 'eulerAngles');
    const near = this.metadata.propertyTracks.find(t => t.target === 'BattleCamera' && t.property === 'nearClipPlane');
    this.camera.position.fromArray(trackValue(position, time, [10.71, 1.1, -50]));
    applyCameraPresentation(this.camera.position, time);
    const [shakeX, shakeY] = cameraShakeOffset(this.events, time, 1 / STEP);
    this.camera.position.x += shakeX; this.camera.position.y += shakeY;
    const euler = trackValue(angles, time, [0, 0, 0]);
    this.camera.quaternion.copy(unityEuler(euler)).multiply(Y_HALF_TURN);
    this.cameraSpace.position.copy(this.camera.position);
    this.cameraSpace.quaternion.copy(unityEuler(euler));
    this.camera.near = near?.curves[0] ? keyCurve(near.curves[0], time, 0.1) : 0.1;
    this.camera.updateProjectionMatrix();
    this.camera.projectionMatrix.elements[0] *= -1;
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
    this.camera.updateMatrixWorld(true);
    this.cameraSpace.updateMatrixWorld(true);
  }

  private advance(time: number) {
    this.current = time;
    while (this.eventIndex < this.events.length && this.events[this.eventIndex].time <= time + 1e-6) {
      this.event(this.events[this.eventIndex++]);
    }
    this.animateCamera(time);
    this.animateActors(time);
    this.backgroundScene.update(time);
    for (const effect of this.effects.values()) effect.update(time);
    this.cutIn.update(time);
    this.status();
  }

  private displayAt(time: number) {
    while (this.eventIndex < this.events.length && this.events[this.eventIndex].time <= time + 1e-6) {
      this.event(this.events[this.eventIndex++]);
    }
    this.current = time;
    this.animateCamera(time);
    this.animateActors(time);
    this.backgroundScene.update(time);
    this.cutIn.update(time);
    const fade = this.events.filter(event => event.type === 'fade' && event.time <= time).at(-1);
    if (fade) {
      const keys = Array.isArray(fade.fadeCurve) ? fade.fadeCurve : fade.fadeCurve?.m_Curve ?? [];
      const local = clamp(time - fade.time, 0, fade.duration);
      this.fadeOverlay.style.opacity = `${clamp(keyCurve(keys, local, 0))}`;
      if (fade.fadeColour) {
        const color = fade.fadeColour;
        this.fadeOverlay.style.backgroundColor = `rgb(${Math.round(color.r * 255)} ${Math.round(color.g * 255)} ${Math.round(color.b * 255)})`;
      }
    }
    this.status();
  }

  private status(force = false) {
    const tick = Math.floor(this.current * 20);
    if (tick === this.statusTick && !force) return;
    this.statusTick = tick;
    this.options.onStatus?.({ time: this.current, duration: this.data.duration,
      phase: this.states.get('Actor')?.animation ?? '宝具', firedEvents: [...this.fired], isPlaying: this.playing });
  }

  private render() {
    const near = this.camera.near;
    this.renderer.clear(true, true, true);
    for (const pass of this.metadata.cameras) {
      if (!pass.cullingMask) continue;
      this.camera.layers.mask = pass.cullingMask;
      this.camera.fov = pass.fieldOfView;
      this.camera.near = pass.depth === 0 ? near : pass.near;
      this.camera.far = pass.far;
      this.camera.updateProjectionMatrix();
      this.camera.projectionMatrix.elements[0] *= -1;
      this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
      // Unity Depth clears only depth; front-layer effects cannot be occluded by actors.
      if (pass.clearFlags === 3) this.renderer.clearDepth();
      this.renderer.render(this.scene, this.camera);
    }
    const back = this.metadata.cameras[0];
    this.camera.layers.mask = back.cullingMask;
    this.camera.near = near; this.camera.far = back.far; this.camera.fov = back.fieldOfView;
    this.camera.updateProjectionMatrix();
    this.camera.projectionMatrix.elements[0] *= -1;
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
  }
  private tick = (timestamp: number) => {
    if (this.destroyed) return;
    if (this.playing) {
      if (this.lastTick) {
        const next = clamp(this.current + Math.min((timestamp - this.lastTick) / 1000, 0.25) * this.speed, 0, this.data.duration);
        this.moveTo(next);
        if (next >= this.data.duration) this.pause();
        this.render();
      }
      this.lastTick = timestamp;
    }
    this.frame = requestAnimationFrame(this.tick);
  };

  play() { this.playing = true; this.lastTick = 0; this.status(true); }
  pause() { this.playing = false; this.lastTick = 0; this.status(true); }
  replay() { this.seek(0); }
  setSpeed(speed: number) { this.speed = speed; }
  private moveTo(time: number) {
    while ((this.simStep + 1) * STEP <= time + 1e-6) this.advance(++this.simStep * STEP);
    this.displayAt(time);
  }
  seek(time: number) {
    const target = clamp(time, 0, this.data.duration);
    this.reset();
    this.advance(0);
    this.moveTo(target);
    this.render(); this.lastTick = 0; this.status(true);
  }
  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.frame); this.resizeObserver.disconnect();
    for (const effect of this.effects.values()) effect.destroy();
    this.effects.clear(); this.hero.destroy(); this.actors.forEach(actor => actor.destroy());
    this.cutIn.destroy();
    this.backgroundScene.destroy();
    this.geometries.forEach(geometry => geometry.dispose());
    this.materials.destroy(); this.textureFiles.forEach(texture => texture.dispose());
    this.renderer.dispose(); this.renderer.domElement.remove();
    this.fadeOverlay.remove();
    delete (window as Window & { __FGO_SOURCE_SCENE__?: unknown }).__FGO_SOURCE_SCENE__;
  }
}

export function createFgoSceneRuntime(host: HTMLElement, loaded: LoadedNoble, options: RuntimeOptions = {}): CutsceneRuntimeHandle {
  const { skin, effects, actors, scene } = loaded;
  if (options.shouldAttach && !options.shouldAttach()) return { play() {}, pause() {}, replay() {}, seek() {}, setSpeed() {}, destroy() {} };
  const textures = cloneFgoTextures(loaded.textures);
  if (options.shouldAttach && !options.shouldAttach()) {
    textures.forEach(texture => texture.dispose());
    return { play() {}, pause() {}, replay() {}, seek() {}, setSpeed() {}, destroy() {} };
  }
  return new SourceSceneRuntime(host, skin, effects, actors, scene, textures, options);
}
