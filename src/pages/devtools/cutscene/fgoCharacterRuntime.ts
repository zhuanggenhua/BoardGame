import * as THREE from 'three';
import type { CutsceneRuntimeHandle, CutsceneRuntimeStatus } from './cutsceneDemoRuntime';
import { SourceActor } from './fgoSceneActor';
import { applySourceSampler, SourceMaterials, sourceTransparentSort } from './fgoSceneMaterials';
import { clipValues } from './fgoSceneMath';
import { FGO_CHARACTER_ASSETS, type FgoCharacterEntry, type FgoCharacterModel } from './fgoCharacterData';

export type FgoCharacterRuntimeHandle = CutsceneRuntimeHandle & {
  setAnimation: (name: string) => void;
  setEvolution: (level: number) => void;
  setLoop: (loop: boolean) => void;
  rotate: (angle: number) => void;
  resetView: () => void;
};
type Options = {
  animation: string;
  evolution: number;
  speed: number;
  loop: boolean;
  shouldAttach: () => boolean;
  onStatus: (status: CutsceneRuntimeStatus) => void;
};

class CharacterRuntime implements FgoCharacterRuntimeHandle {
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true });
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(35, 16 / 9, 0.01, 2000);
  private readonly actor: SourceActor;
  private readonly materials: SourceMaterials;
  private readonly resizeObserver: ResizeObserver;
  private animation: string;
  private evolution: number;
  private speed: number;
  private loop: boolean;
  private playing = true;
  private time = 0;
  private frame = 0;
  private lastTick = 0;
  private lastStatus = -1;
  private readonly framing = new THREE.Box3();
  private readonly host: HTMLElement;
  private readonly entry: FgoCharacterEntry;
  private readonly data: FgoCharacterModel;
  private readonly textures: Map<string, THREE.Texture>;
  private readonly options: Options;

  constructor(host: HTMLElement, entry: FgoCharacterEntry,
    data: FgoCharacterModel, textures: Map<string, THREE.Texture>, options: Options) {
    this.host = host; this.entry = entry; this.data = data; this.textures = textures; this.options = options;
    this.animation = options.animation; this.evolution = options.evolution;
    this.speed = options.speed; this.loop = options.loop;
    this.materials = new SourceMaterials(data, textures);
    this.actor = new SourceActor(data.skin, data.materials, this.materials, 90);
    this.actor.root.rotation.y = Math.PI;
    this.scene.add(this.actor.root);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x09090b);
    this.renderer.setTransparentSort((a, b) => sourceTransparentSort(a, b, this.camera.position));
    this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
    host.replaceChildren(this.renderer.domElement);
    this.camera.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    this.measure();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    this.draw();
    this.frame = requestAnimationFrame(this.tick);
    window.__FGO_CHARACTER__ = {
      id: entry.id,
      seek: time => this.seek(time),
      snapshot: () => {
        const bounds = this.actor.bounds();
        return { id: entry.id, animation: this.animation, time: this.time,
          duration: this.duration, evolution: this.evolution, playing: this.playing,
          bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
          canvas: [this.renderer.domElement.width, this.renderer.domElement.height] };
      },
    };
  }

  private get clip() {
    const clip = this.data.skin.animations?.find(clip => clip.name === this.animation);
    if (!clip) throw new Error(`Original animation unavailable: ${this.entry.id}/${this.animation}`);
    return clip;
  }
  private get duration() { return this.clip.duration; }
  private pose(time: number) {
    const baseAnimation = this.animation.startsWith('eye_')
      ? ['wait02', 'wait'].find(name => this.data.skin.animations?.some(clip => clip.name === name)) : undefined;
    this.actor.pose(this.animation, time, this.evolution, false, baseAnimation);
    const tracks = this.data.visibility[this.animation];
    if (tracks?.length) {
      const values = clipValues(this.clip, time, false, true);
      for (const track of tracks) this.actor.setMeshVisible(track.mesh, values[track.scalarOffset] > 0.5);
    }
  }
  private measure() {
    this.framing.makeEmpty();
    for (let step = 0; step <= 6; step += 1) {
      this.pose(this.duration * step / 6);
      this.framing.union(this.actor.bounds(true));
    }
    if (this.framing.isEmpty()) throw new Error(`No visible source geometry: ${this.entry.id}/${this.animation}`);
    this.pose(this.time);
  }
  private resize() {
    const width = Math.max(1, this.host.clientWidth); const height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.fitCamera(); this.draw();
  }
  private fitCamera() {
    const size = this.framing.getSize(new THREE.Vector3());
    const center = this.framing.getCenter(new THREE.Vector3());
    const tangent = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const distance = Math.max(size.y, size.x / this.camera.aspect, 0.1) / (2 * tangent) * 1.18;
    this.camera.position.set(center.x, center.y, this.framing.min.z - distance);
    this.camera.updateProjectionMatrix();
    this.camera.projectionMatrix.elements[0] *= -1;
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
    this.camera.updateMatrixWorld(true);
  }
  private status(force = false) {
    const tick = Math.floor(this.time * 20);
    if (!force && tick === this.lastStatus) return;
    this.lastStatus = tick;
    this.options.onStatus({ time: this.time, duration: this.duration, phase: this.animation,
      firedEvents: [], isPlaying: this.playing });
  }
  private draw() {
    this.pose(this.time);
    this.renderer.render(this.scene, this.camera);
    this.status();
  }
  private tick = (timestamp: number) => {
    if (this.playing && this.lastTick) {
      const next = this.time + Math.min((timestamp - this.lastTick) / 1000, 0.1) * this.speed;
      this.time = this.loop ? next % this.duration : Math.min(next, this.duration);
      if (!this.loop && this.time >= this.duration) this.pause();
      this.draw();
    }
    this.lastTick = this.playing ? timestamp : 0;
    this.frame = requestAnimationFrame(this.tick);
  };
  play() { this.playing = true; this.lastTick = 0; this.status(true); }
  pause() { this.playing = false; this.lastTick = 0; this.status(true); }
  replay() { this.seek(0); }
  seek(time: number) { this.time = Math.max(0, Math.min(time, this.duration)); this.draw(); this.status(true); }
  setSpeed(speed: number) { this.speed = speed; }
  setLoop(loop: boolean) { this.loop = loop; }
  setAnimation(name: string) {
    this.animation = name; this.time = 0; this.lastTick = 0;
    this.measure(); this.fitCamera(); this.draw(); this.status(true);
  }
  setEvolution(level: number) {
    this.evolution = level; this.measure(); this.fitCamera(); this.draw(); this.status(true);
  }
  rotate(angle: number) {
    this.actor.root.rotation.y += THREE.MathUtils.degToRad(angle);
    this.measure(); this.fitCamera(); this.draw();
  }
  resetView() { this.actor.root.rotation.y = Math.PI; this.measure(); this.fitCamera(); this.draw(); }
  destroy() {
    cancelAnimationFrame(this.frame); this.resizeObserver.disconnect();
    this.actor.destroy(); this.materials.destroy(); this.textures.forEach(texture => texture.dispose());
    this.renderer.dispose(); this.renderer.domElement.remove();
    if (window.__FGO_CHARACTER__?.id === this.entry.id) delete window.__FGO_CHARACTER__;
  }
}

declare global {
  interface Window {
    __FGO_CHARACTER__?: {
      id: string;
      seek: (time: number) => void;
      snapshot: () => { id: string; animation: string; time: number; duration: number; evolution: number;
        playing: boolean; bounds: unknown; canvas: number[] };
    };
  }
}

export async function createFgoCharacterRuntime(host: HTMLElement, entry: FgoCharacterEntry, options: Options) {
  const response = await fetch(`${FGO_CHARACTER_ASSETS}${entry.asset}`);
  if (!response.ok) throw new Error(`角色 ${entry.id}: HTTP ${response.status}`);
  const data = await response.json() as FgoCharacterModel;
  const files = new Set([data.skin.texture, ...Object.values(data.materials).map(record => record.texture!)]);
  const loader = new THREE.TextureLoader();
  const textures = new Map<string, THREE.Texture>();
  try {
    for (const file of files) {
      if (!options.shouldAttach()) break;
      const texture = await loader.loadAsync(`${FGO_CHARACTER_ASSETS}${file}`);
      textures.set(file, texture);
      if (data.textureSamplers[file]) applySourceSampler(texture, data.textureSamplers[file]);
    }
    if (!options.shouldAttach()) {
      textures.forEach(texture => texture.dispose());
      return null;
    }
    return new CharacterRuntime(host, entry, data, textures, options);
  } catch (error) {
    textures.forEach(texture => texture.dispose());
    throw error;
  }
}
