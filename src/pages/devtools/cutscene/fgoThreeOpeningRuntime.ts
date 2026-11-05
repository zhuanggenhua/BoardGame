import * as THREE from 'three';

const ASSET_ROOT = '/assets/dev/fgo-cutscene/np100100/';
const ACTOR_URL = `${ASSET_ROOT}saber_body_level_1_skin.json`;
const EFFECT_URL = `${ASSET_ROOT}np100100_effects.json`;
const OPENING_ANIMATIONS = ['wait02', 'treasureArms1_a'] as const;
// The exported skin faces +X; the sequence actor basis expects its forward axis on +Z.
const SKIN_LOCAL_FORWARD_OFFSET: Vec3 = [0, 90, 0];

type Vec3 = [number, number, number];
type Quat = [number, number, number, number];
type Matrix16 = [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];
type Transform = { position: Vec3; rotation: Quat; scale: Vec3 };
type NodeData = {
  index: number;
  path: string;
  name: string;
  parent: number;
  localPosition: Vec3;
  localRotation: Quat;
  localScale: Vec3;
};
type SkinData = {
  rootTransform: Transform;
  texture: string;
  mesh: MeshData;
  attachments: Array<{ kind: string; mesh: MeshData }>;
  skeleton: { nodes: NodeData[]; skinBones: Array<{ skinIndex: number; nodeIndex: number; bindPose: number[] }> };
  animations: AnimationData[];
};
type MeshData = {
  name: string;
  vertices: Vec3[];
  uvs: Array<[number, number]>;
  indices: number[];
  weights: Array<{ indices: [number, number, number, number]; weights: [number, number, number, number] }>;
};
type AnimationData = {
  name: string;
  duration: number;
  scalarCount: number;
  constants: Array<[number, number]>;
  frames: Array<{ time: number; keys: Array<[number, [number, number, number, number]]> }>;
  bindings: Array<{ scalarOffset: number; nodeIndex: number; attribute: 'position' | 'euler' | 'scale' }>;
};
type Key = { time: number; value: number; inSlope?: number; outSlope?: number };
type CameraData = {
  positionBase: Vec3;
  eulerAnglesBase: Vec3;
  parentEulerAngles: Vec3;
  projection: { fieldOfView: number; nearClip: number; farClip: number; aspect: number };
  position: [Key[], Key[], Key[]];
  eulerAnglesOffset: [Key[], Key[], Key[]];
};
type ActorTransformData = {
  positionBase: Vec3;
  localEulerAnglesBase: Vec3;
  position: [Key[], Key[], Key[]];
  localEulerAngles: [Key[], Key[], Key[]];
};
type TimelineEvent = {
  time: number;
  duration?: number;
  type: string;
  target: string;
  animationName?: string;
  startTime?: number;
  playbackSpeed?: number;
  stopTime?: number;
  enabled?: boolean;
  bgName?: string;
  fadeColour?: { r: number; g: number; b: number; a: number };
  fadeCurve?: Key[] | { m_Curve?: Key[] };
};
type EffectsData = { actorTransform: ActorTransformData; battleCamera: CameraData; timeline: TimelineEvent[] };
export type OpeningStatus = { time: number; playing: boolean; animation: string; camera: Vec3 };
export type OpeningRuntime = {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setSpeed: (speed: number) => void;
  destroy: () => void;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const radians = (value: number) => value * Math.PI / 180;

const sampleCurve = (keys: Key[], time: number, fallback: number) => {
  if (!keys.length) return fallback;
  if (time < keys[0].time) return fallback;
  for (let i = 1; i < keys.length; i += 1) {
    const a = keys[i - 1];
    const b = keys[i];
    if (time > b.time) continue;
    const span = Math.max(0.000001, b.time - a.time);
    const t = (time - a.time) / span;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * a.value
      + (t3 - 2 * t2 + t) * (a.outSlope ?? 0) * span
      + (-2 * t3 + 3 * t2) * b.value
      + (t3 - t2) * (b.inSlope ?? 0) * span;
  }
  return keys[keys.length - 1].value;
};

const sampleAnimation = (clip: AnimationData, time: number) => {
  const values = new Array<number | undefined>(clip.scalarCount);
  clip.constants.forEach(([index, value]) => { values[index] = value; });
  const frames = clip.frames.filter((frame) => Number.isFinite(frame.time) && frame.time >= 0);
  if (!frames.length) return values;
  const sampleTime = clamp(time, 0, Math.max(0, clip.duration - 0.0001));
  const latest = new Map<number, { time: number; coeffs: [number, number, number, number] }>();
  frames.forEach((frame) => {
    if (frame.time > sampleTime) return;
    frame.keys.forEach(([index, coeffs]) => latest.set(index, { time: frame.time, coeffs }));
  });
  if (!latest.size) frames[0].keys.forEach(([index, coeffs]) => latest.set(index, { time: frames[0].time, coeffs }));
  latest.forEach(({ time: frameTime, coeffs: [c0, c1, c2, c3] }, index) => {
    const delta = Math.max(0, sampleTime - frameTime);
    values[index] = ((c0 * delta + c1) * delta + c2) * delta + c3;
  });
  return values;
};

const makeBoneHierarchy = (data: SkinData, root: THREE.Group) => {
  const bones: THREE.Bone[] = [];
  data.skeleton.nodes.forEach((node) => {
    const bone = new THREE.Bone();
    bone.name = node.path || node.name;
    bone.position.fromArray(node.localPosition);
    bone.quaternion.fromArray(node.localRotation);
    bone.scale.fromArray(node.localScale);
    bones.push(bone);
    if (node.parent >= 0) bones[node.parent].add(bone);
    else root.add(bone);
  });
  return bones;
};

const makeSkinnedMesh = (
  data: SkinData,
  meshData: MeshData,
  bones: THREE.Bone[],
  texture: THREE.Texture,
) => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(meshData.vertices.flat(), 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(meshData.uvs.flatMap(([u, v]) => [u, 1 - v]), 2));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(meshData.weights.flatMap((weight) => weight.indices), 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(meshData.weights.flatMap((weight) => weight.weights), 4));
  geometry.setIndex(meshData.indices);
  geometry.computeVertexNormals();
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide,
    transparent: true,
    alphaTest: 0.02,
    toneMapped: false,
  });
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.name = meshData.name;
  const inverses = Array.from({ length: data.skeleton.skinBones.length }, () => new THREE.Matrix4());
  data.skeleton.skinBones.forEach((skinBone) => {
    const inverse = new THREE.Matrix4();
    inverse.set(...skinBone.bindPose as Matrix16);
    inverses[skinBone.skinIndex] = inverse;
  });
  const skinBones = data.skeleton.skinBones;
  const orderedBones = Array.from({ length: skinBones.length }, (_, skinIndex) => {
    const record = skinBones.find((item) => item.skinIndex === skinIndex);
    if (!record) throw new Error(`Missing skin bone ${skinIndex} for ${meshData.name}`);
    return bones[record.nodeIndex];
  });
  const skeleton = new THREE.Skeleton(orderedBones, inverses);
  mesh.bind(skeleton, new THREE.Matrix4());
  bones[0].add(mesh);
  return mesh;
};

const makeQuaternion = ([x, y, z]: Vec3) => {
  const euler = new THREE.Euler(radians(x), radians(y), radians(z), 'YXZ');
  return new THREE.Quaternion().setFromEuler(euler);
};

const setActorRoot = (root: THREE.Group, transform: Transform) => {
  root.position.fromArray(transform.position);
  root.quaternion.fromArray(transform.rotation);
  root.scale.fromArray(transform.scale);
};

export async function createOpeningRuntime(
  host: HTMLElement,
  onStatus: (status: OpeningStatus) => void,
  shouldAttach: () => boolean,
): Promise<OpeningRuntime> {
  const [actorResponse, effectResponse] = await Promise.all([fetch(ACTOR_URL), fetch(EFFECT_URL)]);
  if (!actorResponse.ok || !effectResponse.ok) throw new Error('Failed to load FGO opening export data');
  const actorData = await actorResponse.json() as SkinData;
  const effects = await effectResponse.json() as EffectsData;
  const maxTime = Math.max(0.001, effects.duration ?? 1);
  if (!shouldAttach()) return { play() {}, pause() {}, seek() {}, setSpeed() {}, destroy() {} };

  for (const name of OPENING_ANIMATIONS) {
    if (!actorData.animations.some((clip) => clip.name === name)) {
      throw new Error(`Opening animation missing from servant export: ${name}`);
    }
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.setClearColor(0x090b10, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.replaceChildren(renderer.domElement);
  const fadeOverlay = document.createElement('div');
  Object.assign(fadeOverlay.style, {
    position: 'absolute',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '1',
  });
  host.appendChild(fadeOverlay);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x090b10);
  const texture = await new THREE.TextureLoader().loadAsync(`${ASSET_ROOT}${actorData.texture}`);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  const actor = new THREE.Group();
  actor.name = 'Saber level 1';
  const actorTransform = effects.actorTransform;
  if (!actorTransform) throw new Error('Actor transform timeline missing from FGO sequence export');
  const actorRoot = new THREE.Group();
  setActorRoot(actorRoot, actorData.rootTransform);
  actor.add(actorRoot);
  const bones = makeBoneHierarchy(actorData, actorRoot);
  const body = makeSkinnedMesh(actorData, actorData.mesh, bones, texture);
  actorData.attachments
    .filter((attachment) => attachment.kind === 'skinnedMesh' && attachment.mesh.name === 'weapon_level_2_3')
    .forEach((attachment) => makeSkinnedMesh(actorData, attachment.mesh, bones, texture));
  body.skeleton.pose();
  actor.scale.setScalar(1);
  scene.add(actor);
  actor.visible = true;

  const cameraData = effects.battleCamera;
  const camera = new THREE.PerspectiveCamera(
    cameraData.projection.fieldOfView,
    host.clientWidth / Math.max(1, host.clientHeight),
    cameraData.projection.nearClip,
    cameraData.projection.farClip,
  );
  const updateCameraProjection = (width: number, height: number) => {
    const aspect = width / height;
    camera.aspect = aspect;
    camera.fov = aspect < 1
      ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(radians(cameraData.projection.fieldOfView) / 2) / aspect))
      : cameraData.projection.fieldOfView;
    camera.updateProjectionMatrix();
  };
  updateCameraProjection(host.clientWidth, host.clientHeight);
  const animationByName = new Map(actorData.animations.map((clip) => [clip.name, clip]));
  const eventByTime = [...effects.timeline]
    .filter((event) => event.time <= maxTime && ['animation', 'setEnabled', 'changeBg', 'fade'].includes(event.type))
    .sort((a, b) => a.time - b.time);
  const animationEvents = eventByTime.filter((event) => event.type === 'animation');
  const fadeEvents = eventByTime.filter((event) => event.type === 'fade');
  let time = 0;
  let playing = true;
  let speed = 1;
  let previous = performance.now();
  let animationName = 'wait02';
  let animationStart = 0.4;
  let animationSpeed = 1;
  let disposed = false;

  const resizeObserver = new ResizeObserver(() => {
    if (disposed) return;
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height);
    updateCameraProjection(width, height);
  });
  resizeObserver.observe(host);

  const updatePose = (nextTime: number) => {
    actorData.skeleton.nodes.forEach((node, index) => {
      const bone = bones[index];
      bone.position.fromArray(node.localPosition);
      bone.quaternion.fromArray(node.localRotation);
      bone.scale.fromArray(node.localScale);
    });
    const currentEvent = animationEvents.filter((event) => event.time <= nextTime).at(-1);
    animationName = currentEvent?.animationName ?? 'wait02';
    animationStart = currentEvent ? currentEvent.time + (currentEvent.startTime ?? 0) : 0.4;
    animationSpeed = currentEvent?.playbackSpeed ?? 1;
    const clip = animationByName.get(animationName);
    if (!clip) return;
    const values = sampleAnimation(clip, Math.max(0, nextTime - animationStart) * animationSpeed);
    clip.bindings.forEach((binding) => {
      const node = actorData.skeleton.nodes[binding.nodeIndex];
      const bone = bones[binding.nodeIndex];
      const x = values[binding.scalarOffset];
      const y = values[binding.scalarOffset + 1];
      const z = values[binding.scalarOffset + 2];
      if (x === undefined || y === undefined || z === undefined || !node || !bone) return;
      if (binding.attribute === 'position') {
        bone.position.set(Math.abs(x) > 10 ? x / 1000 : x, Math.abs(y) > 10 ? y / 1000 : y, Math.abs(z) > 10 ? z / 1000 : z);
      } else if (binding.attribute === 'scale') {
        bone.scale.set(x, y, z);
      } else {
        bone.quaternion.copy(makeQuaternion([x, y, z]));
      }
    });
    actor.updateMatrixWorld(true);
    actorData.skeleton.skinBones.forEach((bone) => {
      bones[bone.nodeIndex].updateWorldMatrix(true, false);
    });
  };

  const updateCamera = (at: number, actorCenter: THREE.Vector3) => {
    const worldPosition = cameraData.position.map((curve, index) => sampleCurve(curve, at, cameraData.positionBase[index])) as Vec3;
    const localEuler = cameraData.eulerAnglesOffset.map((curve, index) => (
      cameraData.eulerAnglesBase[index] + sampleCurve(curve, at, 0)
    )) as Vec3;
    const parent = makeQuaternion(cameraData.parentEulerAngles);
    camera.position.fromArray(worldPosition);
    camera.lookAt(actorCenter);
    const targetRotation = camera.quaternion.clone();
    // Align the camera's base pose to the actor while retaining animated rotation deltas.
    const baseRotation = parent.clone().multiply(makeQuaternion(cameraData.eulerAnglesBase));
    const alignment = targetRotation.multiply(baseRotation.invert());
    const worldRotation = parent.clone().multiply(makeQuaternion(localEuler));
    camera.quaternion.copy(alignment.multiply(worldRotation));
    camera.updateMatrixWorld(true);
  };

  const updateActorTransform = (at: number) => {
    actor.position.fromArray(actorTransform.position.map((curve, index) => (
      sampleCurve(curve, at, actorTransform.positionBase[index])
    )) as Vec3);
    const sequenceRotation = makeQuaternion(actorTransform.localEulerAngles.map((curve, index) => (
      sampleCurve(curve, at, actorTransform.localEulerAnglesBase[index])
    )) as Vec3);
    actor.quaternion.copy(sequenceRotation.multiply(makeQuaternion(SKIN_LOCAL_FORWARD_OFFSET)));
  };

  const seek = (nextTime: number) => {
    time = clamp(nextTime, 0, maxTime);
    const bgEvent = eventByTime.filter((event) => event.type === 'changeBg' && event.time <= time).at(-1);
    (scene.background as THREE.Color).set(bgEvent?.bgName === '50200' ? 0x151821 : 0x090b10);
    const fadeEvent = fadeEvents.filter((event) => event.time <= time).at(-1);
    const fadeDuration = Math.max(0.0001, fadeEvent?.duration ?? 0);
    const fadeProgress = fadeEvent ? (time - fadeEvent.time) / fadeDuration : 1;
    const fadeCurve = Array.isArray(fadeEvent?.fadeCurve)
      ? fadeEvent.fadeCurve
      : fadeEvent?.fadeCurve?.m_Curve ?? [];
    const fadeAlpha = fadeEvent && fadeProgress <= 1
      ? clamp(sampleCurve(fadeCurve, fadeProgress, 0), 0, 1)
      : 0;
    const fadeColour = fadeEvent?.fadeColour ?? { r: 1, g: 1, b: 1, a: 1 };
    fadeOverlay.style.backgroundColor = `rgb(${Math.round(fadeColour.r * 255)} ${Math.round(fadeColour.g * 255)} ${Math.round(fadeColour.b * 255)})`;
    fadeOverlay.style.opacity = String(fadeAlpha * fadeColour.a);
    updateActorTransform(time);
    updatePose(time);
    actor.updateMatrixWorld(true);
    const actorBounds = new THREE.Box3().setFromObject(actor);
    updateCamera(time, actorBounds.getCenter(new THREE.Vector3()));
    renderer.render(scene, camera);
    const bounds = actorBounds;
    const center = bounds.getCenter(new THREE.Vector3());
    const projectedCenter = center.clone().project(camera);
    const projectedCorners = [
      [bounds.min.x, bounds.min.y, bounds.min.z],
      [bounds.min.x, bounds.min.y, bounds.max.z],
      [bounds.min.x, bounds.max.y, bounds.min.z],
      [bounds.min.x, bounds.max.y, bounds.max.z],
      [bounds.max.x, bounds.min.y, bounds.min.z],
      [bounds.max.x, bounds.min.y, bounds.max.z],
      [bounds.max.x, bounds.max.y, bounds.min.z],
      [bounds.max.x, bounds.max.y, bounds.max.z],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z).project(camera));
    const screenBounds = {
      minX: Math.min(...projectedCorners.map((corner) => (corner.x + 1) * host.clientWidth / 2)),
      maxX: Math.max(...projectedCorners.map((corner) => (corner.x + 1) * host.clientWidth / 2)),
      minY: Math.min(...projectedCorners.map((corner) => (1 - corner.y) * host.clientHeight / 2)),
      maxY: Math.max(...projectedCorners.map((corner) => (1 - corner.y) * host.clientHeight / 2)),
    };
    (window as Window & { __FGO_THREE_DEBUG__?: unknown }).__FGO_THREE_DEBUG__ = {
      time,
      duration: maxTime,
      actorVisible: actor.visible,
      bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
      center: center.toArray(),
      projectedCenter: projectedCenter.toArray(),
      screenBounds,
      camera: { position: camera.position.toArray(), direction: camera.getWorldDirection(new THREE.Vector3()).toArray(), near: camera.near, far: camera.far, fov: camera.fov },
      meshes: actorData.attachments.map((attachment) => attachment.mesh.name),
    };
    onStatus({ time, playing, animation: animationName, camera: [camera.position.x, camera.position.y, camera.position.z] });
  };

  seek(0);
  const render = (now: number) => {
    if (disposed) return;
    const delta = Math.min(0.05, (now - previous) / 1000);
    previous = now;
    if (playing) {
      const next = time + delta * speed;
      if (next >= maxTime) {
        seek(maxTime);
        playing = false;
      } else {
        seek(next);
      }
    }
    requestAnimationFrame(render);
  };
  requestAnimationFrame(render);

  return {
    play() { playing = true; previous = performance.now(); onStatus({ time, playing, animation: animationName, camera: [camera.position.x, camera.position.y, camera.position.z] }); },
    pause() { playing = false; onStatus({ time, playing, animation: animationName, camera: [camera.position.x, camera.position.y, camera.position.z] }); },
    seek,
    setSpeed(nextSpeed) { speed = nextSpeed; },
    destroy() {
      disposed = true;
      resizeObserver.disconnect();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.replaceChildren();
    },
  };
}
