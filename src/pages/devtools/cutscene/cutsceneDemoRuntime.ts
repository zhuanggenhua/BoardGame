import {
  Application,
  Assets,
  colorBit,
  colorBitGl,
  compileHighShaderGlProgram,
  compileHighShaderGpuProgram,
  Container,
  Graphics,
  localUniformBit,
  localUniformBitGl,
  Mesh,
  MeshGeometry,
  Rectangle,
  roundPixelsBit,
  roundPixelsBitGl,
  Shader,
  Sprite,
  Text,
  textureBit,
  textureBitGl,
  Texture,
  type Ticker,
} from 'pixi.js';

const DESIGN_WIDTH = 1280;
const DESIGN_HEIGHT = 720;
const ASSET_ROOT = '/assets/dev/fgo-cutscene/np100100/';
const SKIN_DATA_URL = `${ASSET_ROOT}saber_body_level_1_skin.json`;
const EFFECT_DATA_URL = `${ASSET_ROOT}np100100_effects.json`;
const CUTSCENE_ACTORS_DATA_URL = `${ASSET_ROOT}np100100_cutscene_actors.json`;
const UNITY_TO_STAGE_SCALE = 135;
const SHOW_DEBUG_SKELETON = false;
// JSON numbers round Unity's 64-bit path IDs; match the rounded value emitted
// by the exported effect data instead of comparing against the original ID.
const FGO_NOBLE_BASE_SHADER_PATH_ID = Number('1844811793956388600');

const baseAssetFiles = {
  fieldBg: 'field_bg.png',
  bg50200: 'bg_50200.png',
  bg90001Back: 'bg_90001_back.png',
  bg90001Front: 'bg_90001_front.png',
  portraitFace: 'portrait_face_keyed.png',
  servantAtlas: 'servant_100100_atlas.png',
  weaponSprite: 'sword.png',
  swordGlow: 'sword_glow.png',
  beamCore: 'beam_core.png',
  goldLine: 'gold_line.png',
  goldBurst: 'gold_burst.png',
  rainbowRing: 'rainbow_ring.png',
  smokeRibbon: 'smoke_ribbon.png',
  stormCloud: 'storm_cloud.png',
  groundSmoke: 'ground_smoke.png',
  whiteGlow: 'white_glow.png',
} as const;

type BaseAssetKey = keyof typeof baseAssetFiles;
type TextureMap = Partial<Record<BaseAssetKey | string, Texture>>;

const requireTexture = (textures: TextureMap, key: BaseAssetKey | string) => {
  const texture = textures[key];
  if (!texture) {
    throw new Error(`Missing texture asset: ${key}`);
  }
  return texture;
};

type Vec3 = [number, number, number];
type Quat = [number, number, number, number];
type Mat4 = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];
type UnityVec3Object = {
  x?: number;
  y?: number;
  z?: number;
};

type SkinNode = {
  index: number;
  pathId: number;
  path?: string;
  pathHash?: number;
  name: string;
  parent: number;
  isSkinBone: boolean;
  skinBoneIndex: number;
  localPosition: Vec3;
  localRotation: Quat;
  localScale: Vec3;
};

type SkinBone = {
  skinIndex: number;
  nodeIndex: number;
  pathId: number;
  name: string;
  bindPose: Mat4;
};

type SkinMeshData = {
  name: string;
  vertexCount: number;
  vertices: Vec3[];
  uvs: [number, number][];
  indices: number[];
  weights: Array<{
    indices: [number, number, number, number];
    weights: [number, number, number, number];
  }>;
};

type AnimationAttribute = 'position' | 'euler' | 'scale';

type AnimationBinding = {
  bindingIndex: number;
  scalarOffset: number;
  nodeIndex: number;
  pathHash: number;
  path: string;
  attribute: AnimationAttribute;
};

type AnimationFrame = {
  time: number;
  keys: Array<[number, [number, number, number, number]]>;
};

type SkinAnimation = {
  name: string;
  duration: number;
  sampleRate: number;
  scalarCount: number;
  streamedCurveCount?: number;
  bindings: AnimationBinding[];
  constants: Array<[number, number]>;
  frames: AnimationFrame[];
};

type CompressedAnimationData = {
  name: string;
  duration: number;
  sampleRate: number;
  scalarCount: number;
  constants: Array<[number, number]>;
  frames: AnimationFrame[];
};

type SkinData = {
  source: string;
  texture: string;
  rootTransform?: TransformData;
  mesh: SkinMeshData;
  attachments?: Array<{
    kind: 'skinnedMesh';
    source: string;
    smrPathId: number;
    meshPathId: number;
    texture: string;
    mesh: SkinMeshData;
  }>;
  skeleton: {
    rootPathId: number;
    nodes: SkinNode[];
    skinBones: SkinBone[];
  };
  animations?: SkinAnimation[];
};

type CutsceneActorData = SkinData & {
  name: string;
};

type CutsceneActorsData = {
  sourceBundle: string;
  texture: string;
  actors: CutsceneActorData[];
};

type TransformData = {
  position: Vec3;
  rotation: Quat;
  scale: Vec3;
};

type CurveData = {
  state: number;
  scalar: number;
  minScalar: number;
  keys: CurveKeyData[];
  minKeys?: CurveKeyData[];
};

type CurveKeyData = {
  time: number;
  value: number;
  inSlope?: number;
  outSlope?: number;
};

type ColorData = {
  r: number;
  g: number;
  b: number;
  a: number;
};

type GradientData = {
  state: number;
  maxColor: ColorData;
  minColor: ColorData;
  keys: Array<{ time: number; color: ColorData }>;
  alphaKeys: Array<{ time: number; alpha: number }>;
  minKeys?: Array<{ time: number; color: ColorData }>;
  minAlphaKeys?: Array<{ time: number; alpha: number }>;
  mode?: number;
  minMode?: number;
};

type EffectTextureData = {
  pathId: number;
  name: string;
  file: string;
  width: number;
  height: number;
};

type EffectMaterialData = {
  pathId: number;
  name: string;
  shaderPathId?: number;
  keywords?: string[];
  texturePathId: number;
  texture: EffectTextureData | null;
  blend: string;
  blendSrc?: number;
  blendDst?: number;
  mode?: number;
  cullMode?: number;
  zWrite?: number;
  zTestMode?: number;
  useMultiplyVertexColor?: boolean;
  tintColor?: ColorData;
  color?: ColorData;
  mainTextureTransform?: {
    scale: [number, number];
    offset: [number, number];
  };
  floats?: Record<string, number>;
  colors?: Record<string, ColorData>;
};

type EffectMeshData = {
  pathId: number;
  name: string;
  vertices: Vec3[];
  uvs: [number, number][];
  colors?: Array<[number, number, number, number]>;
  indices: number[];
  bounds: {
    min: Vec3;
    max: Vec3;
  };
};

type ParticleSystemData = {
  name: string;
  sourceId?: string;
  transformId?: string;
  pathId: number;
  rendererPathId: number;
  path: string;
  localTransform: TransformData;
  worldTransform: TransformData;
  renderer: {
    renderMode: number;
    renderAlignment: number;
    sortMode?: number;
    sortingOrder: number;
    sortingFudge: number;
    lengthScale: number;
    velocityScale: number;
    cameraVelocityScale?: number;
    freeformStretching?: boolean;
    rotateWithStretchDirection?: boolean;
    minParticleSize?: number;
    maxParticleSize?: number;
    normalDirection?: number;
    pivot?: Vec3;
    meshDistribution?: number;
    meshWeighting?: number[];
    meshPathIds: number[];
    materialPathId: number;
    materialName: string;
    blend: string;
    blendSrc?: number;
    blendDst?: number;
    material?: EffectMaterialData;
    texture: EffectTextureData | null;
  };
  particle: {
    duration: number;
    looping: boolean;
    playOnAwake: boolean;
    prewarm: boolean;
    simulationSpeed: number;
    scalingMode?: number;
    randomSeed?: number;
    autoRandomSeed?: boolean;
    moveWithTransform?: number;
    moveWithCustomTransformPathId?: number;
    startDelay: CurveData;
    maxParticles: number;
    size3D?: boolean;
    rotation3D?: boolean;
    randomizeRotationDirection?: number;
    startLifetime: CurveData;
    startSpeed: CurveData;
    startSize: CurveData;
    startSizeY?: CurveData;
    startSizeZ?: CurveData;
    startRotation: CurveData;
    startRotationX?: CurveData;
    startRotationY?: CurveData;
    startColor: GradientData;
    gravityModifier: CurveData;
    emission: {
      enabled: boolean;
      rateOverTime: CurveData;
      rateOverDistance: CurveData;
      bursts: Array<{
        time: number;
        cycleCount: number;
        repeatInterval: number;
        probability: number;
        count: CurveData;
      }>;
    };
    shape: {
      enabled: boolean;
      type: number;
      angle: number;
      radius: number;
      radiusThickness?: number;
      randomDirectionAmount?: number;
      arc: number;
      arcMode?: number;
      arcSpread?: number;
      arcSpeed?: CurveData;
      length: number;
      position: Vec3;
      rotation: Vec3;
      scale: Vec3;
    };
    velocity: {
      enabled: boolean;
      inWorldSpace: boolean;
      x: CurveData;
      y: CurveData;
      z: CurveData;
      radial: CurveData;
      speedModifier: CurveData;
    };
    sizeOverLifetime: {
      enabled: boolean;
      separateAxes: boolean;
      curve: CurveData;
      y: CurveData;
      z: CurveData;
    };
    rotationOverLifetime: {
      enabled: boolean;
      separateAxes: boolean;
      curve: CurveData;
      x: CurveData;
      y: CurveData;
    };
    colorOverLifetime: {
      enabled: boolean;
      gradient: GradientData;
    };
    uv: {
      enabled: boolean;
      tilesX: number;
      tilesY: number;
      fps: number;
      cycles: number;
      mode: number;
      animationType: number;
      rowMode: number;
      rowIndex: number;
      startFrame: CurveData;
      frameOverTime: CurveData;
    };
  };
};

type EffectRootData = {
  name: string;
  transformPathId: number;
  gameObjectPathId: number;
  localTransform: TransformData;
  worldTransform: TransformData;
  particleSystems: ParticleSystemData[];
};

type EffectAnimationAttribute = AnimationAttribute | 'quaternion' | 'uvOffsetX' | 'uvOffsetY';

type EffectAnimationBinding = {
  bindingIndex: number;
  scalarOffset: number;
  componentCount: number;
  pathHash: number;
  path?: string;
  attribute: EffectAnimationAttribute;
  typeId: number;
  scriptPathId: number;
};

type EffectAnimationData = CompressedAnimationData & {
  pathId: number;
  streamedCurveCount?: number;
  bindings: EffectAnimationBinding[];
};

type EffectSimpleAnimationData = {
  pathId: number;
  transformId?: string;
  path: string;
  transformPathId: number;
  gameObjectPathId: number;
  playAutomatically: boolean;
  wrapMode: number;
  clipPathId: number;
  clipName: string;
  states: Array<{
    name: string;
    clipPathId: number;
    clipName: string;
  }>;
  clips: EffectAnimationData[];
};

type EffectUvScrollData = {
  pathId: number;
  path: string;
  transformPathId: number;
  transformId?: string;
  gameObjectPathId: number;
  offset: [number, number];
};

type EffectTimelineEvent = {
  time: number;
  duration: number;
  scriptName: string;
  type: string;
  target: string;
  sequencePath: string;
  enabled?: boolean;
  animationName?: string;
  animationTarget?: number;
  playbackSpeed?: number;
  startTime?: number;
  stopTime?: number;
  horizontalShakeSize?: number;
  verticalShakeSize?: number;
  isRelative?: boolean;
  fixedUpdate?: boolean;
  svtId?: number;
  faceType?: number;
  cutInType?: number;
  fadeColour?: ColorData;
  fadeCurve?: CurveKeyData[] | { m_Curve?: CurveKeyData[] };
  bgName?: string;
  targetTimeScale?: number;
  displayTarget?: number;
  displayEnabled?: boolean;
  evolutionLevel?: number;
  otherHierarchyPath?: string;
  colorTarget?: number;
  parentObjectName?: string;
  nodeName?: string;
  tposition?: UnityVec3Object;
  trotation?: UnityVec3Object;
  tscale?: UnityVec3Object;
};

type EffectData = {
  sourceBundle: string;
  sequenceBundle: string;
  duration: number;
  textures: EffectTextureData[];
  meshes: EffectMeshData[];
  battleCamera?: {
    duration: number;
    position: [CurveKeyData[], CurveKeyData[], CurveKeyData[]];
    eulerAnglesOffset: [CurveKeyData[], CurveKeyData[], CurveKeyData[]];
    positionBase: Vec3;
    eulerAnglesBase: Vec3;
    parentEulerAngles: Vec3;
    projection?: {
      fieldOfView: number;
      orthographic: boolean;
      nearClip: number;
      farClip: number;
      aspect: number;
      activeCamera?: string;
    };
    source?: string;
  };
  simpleAnimations?: EffectSimpleAnimationData[];
  uvScrolls?: EffectUvScrollData[];
  roots: EffectRootData[];
  timeline: EffectTimelineEvent[];
  usedEffectRoots: string[];
};

export type {
  SkinData, SkinAnimation, CutsceneActorsData, TransformData, CurveData, CurveKeyData,
  ColorData, GradientData, EffectData, EffectRootData, ParticleSystemData,
  EffectMeshData, EffectMaterialData, EffectTimelineEvent, CompressedAnimationData,
};

type RootPlacement = {
  x: number;
  y: number;
  scale: number;
  alpha: number;
  rotation?: number;
  offsetScaleX?: number;
  offsetScaleY?: number;
  meshScaleX?: number;
  rootScaleCorrection?: Vec3;
  cameraRotation?: Quat;
  perspective?: {
    cameraPosition: Vec3;
    cameraInverseRotation: Quat;
    rootWorldPosition: Vec3;
    rootView: Vec3;
    focalLength: number;
    internalScaleX: number;
    internalScaleY: number;
    key: string;
  };
};

type RootAttachment = {
  target: string;
  parentObjectName: string;
  nodeName: string;
  tposition: Vec3;
  trotation: Vec3;
  tscale: Vec3;
};

type ShakeState = {
  startTime: number;
  duration: number;
  power: number;
};

type FadeState = {
  startTime: number;
  duration: number;
  fromAlpha: number;
  toAlpha: number;
  curve?: CurveKeyData[];
};

type CutInState = {
  startTime: number;
  duration: number;
};

type RuntimeParticle = {
  view: Sprite | Mesh;
  vx: number;
  vy: number;
  velocityX: number;
  velocityY: number;
  gravityX: number;
  gravityY: number;
  originX: number;
  originY: number;
  age: number;
  life: number;
  baseScaleX: number;
  baseScaleY: number;
  baseAlpha: number;
  baseColor: ColorData;
  angularVelocity: number;
  frames: Texture[];
  quadTexture?: Texture;
  meshData?: EffectMeshData;
  rawSize?: Vec3;
  meshSizeAxes?: Vec3;
  meshRenderTransform?: TransformData;
  meshParticleRotation?: Quat;
  uv: ParticleSystemData['particle']['uv'];
  uvRandom: number;
  velocityOverLifetime: ParticleSystemData['particle']['velocity'];
  sizeOverLifetime: ParticleSystemData['particle']['sizeOverLifetime'];
  colorOverLifetime: ParticleSystemData['particle']['colorOverLifetime'];
  renderMode: number;
  renderAlignment: number;
  rendererLengthScale: number;
  rendererVelocityScale: number;
  pivot: Vec3;
  baseRotation: number;
  rotationOffset: number;
  velocityAligned: boolean;
  useTransformAxisRotation: boolean;
  transformAxisRotation: number;
  usesFgoNobleBaseShader: boolean;
  isWeaponSprite: boolean;
  weaponRotation: number;
};

type EffectNodeRuntimeState = {
  path: string;
  parentPath?: string;
  baseLocalTransform: TransformData;
  baseWorldTransform: TransformData;
  baseUvOffset: [number, number];
  localTransform: TransformData;
  worldTransform: TransformData;
  uvOffset: [number, number];
};

type CutsceneActorRuntime = {
  container: Container;
  actor: SkinnedMeshActor;
  currentAnim: string;
  animStartTime: number;
  animDuration: number;
  playbackSpeed: number;
  activeUntil: number;
  evolutionLevel: number;
  colorChanges: Array<{
    startTime: number;
    duration: number;
    meshName?: string;
    color: ColorData;
    curve: Array<{ time: number; value: number }>;
  }>;
};

export type CutsceneRuntimeStatus = {
  time: number;
  duration: number;
  phase: string;
  firedEvents: string[];
  isPlaying: boolean;
};

export type CutsceneRuntimeHandle = {
  play: () => void;
  pause: () => void;
  replay: () => void;
  seek: (time: number) => void;
  setSpeed: (speed: number) => void;
  destroy: () => void;
};

export type StageActorTransform = {
  x: number;
  y: number;
  scale: number;
  rotation?: number;
};

type RuntimeOptions = {
  speed?: number;
  autoplay?: boolean;
  shouldAttach?: () => boolean;
  onStatus?: (status: CutsceneRuntimeStatus) => void;
  effectsOnly?: boolean;
  getHeroTransform?: () => StageActorTransform | undefined;
  renderActors?: (time: number) => boolean;
  renderBackground?: (time: number) => boolean;
};

const readDebugNameFilter = (paramName: string): string[] => {
  if (typeof window === 'undefined') return [];
  const params = new URLSearchParams(window.location.search);
  return params.getAll(paramName)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);
};

const readDebugFlag = (paramName: string) => {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get(paramName) === '1';
};

const debugNameAllowed = (filters: string[], value: string) => (
  filters.length === 0 || filters.some((filter) => (
    value === filter
    || value.endsWith(`/${filter}`)
    || (filter.includes('/') && value.includes(filter))
  ))
);

type CutsceneDebugWindow = Window & {
  __FGO_CUTSCENE_DEBUG__?: {
     seek?: (time: number) => void;
     time: number;
     backgroundName?: string;
     backgroundStats?: {
       backVisible: boolean;
       frontVisible: boolean;
       backAlpha: number;
       frontAlpha: number;
       backTexture?: { width: number; height: number };
       frontTexture?: { width: number; height: number };
     };
     currentAnim: string;
    animStartTime: number;
    animDuration: number;
    lastAnimEvent: string;
    heroVisible: boolean;
    heroMeshStats?: Array<{
      name: string;
      vertexCount: number;
      triangleCount: number;
      visible: boolean;
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
      centerX: number;
      centerY: number;
      textureWidth?: number;
      textureHeight?: number;
      extremeVertices?: Array<{
        index: number;
        x: number;
        y: number;
        source: Vec3;
        influences: Array<{ bone: string; weight: number; localPosition: Vec3; localScale: Vec3 }>;
      }>;
    }>;
    heroNodeStats?: Array<{
      name: string;
      x: number;
      y: number;
      rotation: number;
    }>;
    cutsceneActors: Array<{
      name: string;
      visible: boolean;
      animation: string;
    }>;
    activeEffectRoots: string[];
    activeEffectStats?: Array<{
      root: string;
      emitters: Array<{
        name: string;
        path?: string;
        count: number;
        meshName?: string;
        textureFile?: string;
        bounds?: { minX: number; maxX: number; minY: number; maxY: number };
        localTime?: number;
        lastLocalTime?: number;
        textureLoaded?: boolean;
        emitAttempts?: number;
        emittedParticles?: number;
        skippedReason?: string;
        particles: Array<{
          x: number;
          y: number;
          scaleX: number;
          scaleY: number;
          width: number;
          height: number;
          alpha: number;
          tint: number;
          mesh: boolean;
        }>;
      }>;
    }>;
  };
};

const eventLabel = (event: EffectTimelineEvent) => {
  if (event.type === 'playEffect') return `${event.scriptName}:${event.target}`;
  if (event.type === 'setEnabled') return `${event.scriptName}:${event.target}=${event.enabled ? 1 : 0}`;
  if (event.type === 'animation' || event.type === 'targetAnimation') return `${event.scriptName}:${event.animationName ?? ''}`;
  if (event.type === 'modelEvolution') return `${event.scriptName}:${event.evolutionLevel ?? -1}`;
  if (event.type === 'standardCutIn') return `${event.scriptName}:svt=${event.svtId ?? ''}/face=${event.faceType ?? ''}`;
  if (event.type === 'colorChange') return `${event.scriptName}:${event.otherHierarchyPath ?? ''}`;
  if (event.type === 'displayChange') return `${event.scriptName}:${event.displayTarget ?? 0}=${event.displayEnabled ? 1 : 0}`;
  if (event.type === 'shake') return `${event.scriptName}:${event.duration.toFixed(2)}s`;
  if (event.type === 'attach') return `${event.scriptName}:${event.target}->${event.nodeName ?? ''}`;
  if (event.type === 'changeBg') return `${event.scriptName}:${event.bgName ?? ''}`;
  if (event.type === 'timeScale') return `${event.scriptName}:${event.targetTimeScale ?? 1}x`;
  return `${event.scriptName}:${event.target}`;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const lerp = (from: number, to: number, progress: number) => from + (to - from) * progress;
const easeOutCubic = (value: number) => 1 - Math.pow(1 - clamp(value, 0, 1), 3);

const cloneVec3 = (value: Vec3): Vec3 => [value[0], value[1], value[2]];
const cloneQuat = (value: Quat): Quat => [value[0], value[1], value[2], value[3]];
const cloneTransform = (value: TransformData): TransformData => ({
  position: cloneVec3(value.position),
  rotation: cloneQuat(value.rotation),
  scale: cloneVec3(value.scale),
});

const addVec3 = (left: Vec3, right: Vec3): Vec3 => [
  left[0] + right[0],
  left[1] + right[1],
  left[2] + right[2],
];

const subtractVec3 = (left: Vec3, right: Vec3): Vec3 => [
  left[0] - right[0],
  left[1] - right[1],
  left[2] - right[2],
];

const multiplyVec3 = (left: Vec3, right: Vec3): Vec3 => [
  left[0] * right[0],
  left[1] * right[1],
  left[2] * right[2],
];

const makeSprite = (texture: Texture, anchorX = 0.5, anchorY = 0.5) => {
  const sprite = new Sprite(texture);
  sprite.anchor.set(anchorX, anchorY);
  return sprite;
};

const IDENTITY_MAT4: Mat4 = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
];

const mat4Multiply = (a: Mat4, b: Mat4): Mat4 => ([
  a[0] * b[0] + a[1] * b[4] + a[2] * b[8] + a[3] * b[12],
  a[0] * b[1] + a[1] * b[5] + a[2] * b[9] + a[3] * b[13],
  a[0] * b[2] + a[1] * b[6] + a[2] * b[10] + a[3] * b[14],
  a[0] * b[3] + a[1] * b[7] + a[2] * b[11] + a[3] * b[15],
  a[4] * b[0] + a[5] * b[4] + a[6] * b[8] + a[7] * b[12],
  a[4] * b[1] + a[5] * b[5] + a[6] * b[9] + a[7] * b[13],
  a[4] * b[2] + a[5] * b[6] + a[6] * b[10] + a[7] * b[14],
  a[4] * b[3] + a[5] * b[7] + a[6] * b[11] + a[7] * b[15],
  a[8] * b[0] + a[9] * b[4] + a[10] * b[8] + a[11] * b[12],
  a[8] * b[1] + a[9] * b[5] + a[10] * b[9] + a[11] * b[13],
  a[8] * b[2] + a[9] * b[6] + a[10] * b[10] + a[11] * b[14],
  a[8] * b[3] + a[9] * b[7] + a[10] * b[11] + a[11] * b[15],
  a[12] * b[0] + a[13] * b[4] + a[14] * b[8] + a[15] * b[12],
  a[12] * b[1] + a[13] * b[5] + a[14] * b[9] + a[15] * b[13],
  a[12] * b[2] + a[13] * b[6] + a[14] * b[10] + a[15] * b[14],
  a[12] * b[3] + a[13] * b[7] + a[14] * b[11] + a[15] * b[15],
]);

const transformPoint = (m: Mat4, point: Vec3): Vec3 => {
  const [x, y, z] = point;
  return [
    m[0] * x + m[1] * y + m[2] * z + m[3],
    m[4] * x + m[5] * y + m[6] * z + m[7],
    m[8] * x + m[9] * y + m[10] * z + m[11],
  ];
};

const quatMultiply = (a: Quat, b: Quat): Quat => {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
};

const quatRotate = (rotation: Quat, point: Vec3): Vec3 => {
  const rotated = quatMultiply(
    quatMultiply(rotation, [point[0], point[1], point[2], 0]),
    [-rotation[0], -rotation[1], -rotation[2], rotation[3]],
  );
  return [rotated[0], rotated[1], rotated[2]];
};

const axisAngleQuat = (axis: 'x' | 'y' | 'z', angle: number): Quat => {
  const half = angle / 2;
  const s = Math.sin(half);
  if (axis === 'x') return [s, 0, 0, Math.cos(half)];
  if (axis === 'y') return [0, s, 0, Math.cos(half)];
  return [0, 0, s, Math.cos(half)];
};

const normalizeQuat = (quat: Quat): Quat => {
  const length = Math.hypot(quat[0], quat[1], quat[2], quat[3]);
  if (length <= 0.000001) return [0, 0, 0, 1];
  return [quat[0] / length, quat[1] / length, quat[2] / length, quat[3] / length];
};

const quatFromUnityEulerDegrees = ([x, y, z]: Vec3): Quat => {
  const qx = axisAngleQuat('x', x * Math.PI / 180);
  const qy = axisAngleQuat('y', y * Math.PI / 180);
  const qz = axisAngleQuat('z', z * Math.PI / 180);
  return normalizeQuat(quatMultiply(quatMultiply(qy, qx), qz));
};

const quatFromUnityEulerRadians = ([x, y, z]: Vec3): Quat => {
  const qx = axisAngleQuat('x', x);
  const qy = axisAngleQuat('y', y);
  const qz = axisAngleQuat('z', z);
  return normalizeQuat(quatMultiply(quatMultiply(qy, qx), qz));
};

const composeTransform = (parent: TransformData, local: TransformData): TransformData => ({
  position: addVec3(
    parent.position,
    quatRotate(parent.rotation, multiplyVec3(local.position, parent.scale)),
  ),
  rotation: normalizeQuat(quatMultiply(parent.rotation, local.rotation)),
  scale: multiplyVec3(parent.scale, local.scale),
});

const parentEffectPath = (path: string) => {
  const index = path.lastIndexOf('/');
  return index >= 0 ? path.slice(0, index) : undefined;
};

const isEffectPathUnderRoot = (path: string, rootName: string) => path === rootName || path.startsWith(`${rootName}/`);

const readScalarTriplet = (values: Array<number | undefined>, offset: number): Vec3 | null => {
  const x = values[offset];
  const y = values[offset + 1];
  const z = values[offset + 2];
  if (x === undefined || y === undefined || z === undefined) return null;
  return [x, y, z];
};

const normalizeClipPosition = (position: Vec3): Vec3 => {
  return position.map((value) => (
    Math.abs(value) > 10 ? value / 1000 : value
  )) as Vec3;
};

const normalizeEffectClipPosition = (position: Vec3): Vec3 => (
  position.map((value) => (
    Math.abs(value) > 50 ? value / 1000 : value
  )) as Vec3
);

const sampleAnimationScalars = (clip: CompressedAnimationData, localTime: number, loop: boolean) => {
  const values = new Array<number | undefined>(clip.scalarCount);
  clip.constants.forEach(([index, value]) => {
    values[index] = value;
  });

  const frames = clip.frames.filter((frame) => Number.isFinite(frame.time) && frame.time >= 0);
  if (!frames.length) return values;

  const duration = Math.max(clip.duration, 1 / Math.max(clip.sampleRate, 1));
  let sampleTime = localTime;
  if (loop) {
    sampleTime %= duration;
    if (sampleTime < 0) sampleTime += duration;
  } else {
    sampleTime = clamp(sampleTime, 0, Math.max(0, duration - 0.0001));
  }

  const coeffsByScalar = new Map<number, { frameTime: number; coeffs: [number, number, number, number] }>();
  frames.forEach((frame) => {
    if (frame.time > sampleTime) return;
    frame.keys.forEach(([index, coeffs]) => {
      coeffsByScalar.set(index, { frameTime: frame.time, coeffs });
    });
  });

  if (!coeffsByScalar.size) {
    frames[0].keys.forEach(([index, coeffs]) => {
      coeffsByScalar.set(index, { frameTime: frames[0].time, coeffs });
    });
  }

  coeffsByScalar.forEach(({ frameTime, coeffs: [c0, c1, c2, c3] }, index) => {
    const delta = Math.max(0, sampleTime - frameTime);
    values[index] = ((c0 * delta + c1) * delta + c2) * delta + c3;
  });
  return values;
};

const makeLocalMatrix = (position: Vec3, rotation: Quat, scale: Vec3): Mat4 => {
  const [x, y, z, w] = rotation;
  const xx = x * x;
  const yy = y * y;
  const zz = z * z;
  const xy = x * y;
  const xz = x * z;
  const yz = y * z;
  const wx = w * x;
  const wy = w * y;
  const wz = w * z;

  return [
    (1 - 2 * (yy + zz)) * scale[0],
    (2 * (xy - wz)) * scale[1],
    (2 * (xz + wy)) * scale[2],
    position[0],
    (2 * (xy + wz)) * scale[0],
    (1 - 2 * (xx + zz)) * scale[1],
    (2 * (yz - wx)) * scale[2],
    position[1],
    (2 * (xz - wy)) * scale[0],
    (2 * (yz + wx)) * scale[1],
    (1 - 2 * (xx + yy)) * scale[2],
    position[2],
    0,
    0,
    0,
    1,
  ];
};

const projectUnityPoint = (point: Vec3, scale = UNITY_TO_STAGE_SCALE) => ({
  x: -point[2] * scale,
  y: -point[1] * scale,
});

const quatZRotation = (rotation: Quat) => 2 * Math.atan2(rotation[2], rotation[3]);

const unityVec3ObjectToVec3 = (value: UnityVec3Object | undefined, fallback: Vec3 = [0, 0, 0]): Vec3 => [
  Number.isFinite(value?.x) ? Number(value?.x) : fallback[0],
  Number.isFinite(value?.y) ? Number(value?.y) : fallback[1],
  Number.isFinite(value?.z) ? Number(value?.z) : fallback[2],
];

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const makeRng = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const WHITE_COLOR: ColorData = { r: 1, g: 1, b: 1, a: 1 };

const sampleKeyCurve = (
  keys: CurveKeyData[] | undefined,
  progress: number,
  fallback: number,
) => {
  if (!keys?.length) return fallback;
  const t = clamp(progress, 0, 1);
  if (t <= keys[0].time) return keys[0].value;
  for (let i = 1; i < keys.length; i += 1) {
    const previous = keys[i - 1];
    const next = keys[i];
    if (t <= next.time) {
      const amount = (t - previous.time) / Math.max(0.0001, next.time - previous.time);
      const previousSlope = previous.outSlope;
      const nextSlope = next.inSlope;
      if (
        Number.isFinite(previousSlope)
        && Number.isFinite(nextSlope)
        && Math.abs(previousSlope ?? 0) < 100_000
        && Math.abs(nextSlope ?? 0) < 100_000
      ) {
        const span = Math.max(0.0001, next.time - previous.time);
        const t2 = amount * amount;
        const t3 = t2 * amount;
        return (
          (2 * t3 - 3 * t2 + 1) * previous.value
          + (t3 - 2 * t2 + amount) * (previousSlope ?? 0) * span
          + (-2 * t3 + 3 * t2) * next.value
          + (t3 - t2) * (nextSlope ?? 0) * span
        );
      }
      return lerp(previous.value, next.value, amount);
    }
  }
  return keys[keys.length - 1].value;
};

const curveScalarAt = (
  curve: CurveData | undefined,
  progress: number,
  fallback = 0,
  rng?: () => number,
) => {
  if (!curve) return fallback;
  const maxConstant = Number.isFinite(curve.scalar) ? curve.scalar : fallback;
  const minConstant = Number.isFinite(curve.minScalar) ? curve.minScalar : maxConstant;
  if (curve.state === 0) return maxConstant;
  if (curve.state === 2) {
    return rng ? lerp(minConstant, maxConstant, rng()) : maxConstant;
  }

  const maxValue = curve.keys?.length
    ? sampleKeyCurve(curve.keys, progress, 1) * maxConstant
    : maxConstant;
  if (curve.state === 1) return maxValue;

  const minValue = curve.minKeys?.length
    ? sampleKeyCurve(curve.minKeys, progress, 1) * minConstant
    : minConstant;
  if (curve.state === 3) {
    return rng ? lerp(minValue, maxValue, rng()) : maxValue;
  }
  return maxValue;
};

const curveScalar = (curve: CurveData | undefined, fallback = 0, rng?: () => number) => (
  curveScalarAt(curve, 1, fallback, rng)
);

const burstCountScalarAt = (
  curve: CurveData | undefined,
  progress: number,
  fallback = 0,
  rng?: () => number,
) => curveScalarAt(curve, progress, fallback, rng);

const burstCountScalar = (curve: CurveData | undefined, fallback = 0, rng?: () => number) => (
  curveScalar(curve, fallback, rng)
);

const sampleCurve = (curve: CurveData | undefined, progress: number, fallback = 1) => {
  if (!curve) return fallback;
  return curveScalarAt(curve, progress, fallback);
};

const lerpColor = (left: ColorData, right: ColorData, amount: number): ColorData => ({
  r: lerp(left.r, right.r, amount),
  g: lerp(left.g, right.g, amount),
  b: lerp(left.b, right.b, amount),
  a: lerp(left.a, right.a, amount),
});

const sampleGradientColor = (gradient: GradientData | undefined, progress: number, fallback: ColorData): ColorData => {
  if (!gradient) return fallback;
  if (!gradient.keys?.length) return gradient.maxColor ?? fallback;
  const t = clamp(progress, 0, 1);
  let color = gradient.keys[gradient.keys.length - 1].color;
  for (let i = 1; i < gradient.keys.length; i += 1) {
    const previous = gradient.keys[i - 1];
    const next = gradient.keys[i];
    if (t <= next.time) {
      const amount = (t - previous.time) / Math.max(0.0001, next.time - previous.time);
      color = {
        r: lerp(previous.color.r, next.color.r, amount),
        g: lerp(previous.color.g, next.color.g, amount),
        b: lerp(previous.color.b, next.color.b, amount),
        a: lerp(previous.color.a, next.color.a, amount),
      };
      break;
    }
  }
  if (gradient.alphaKeys?.length) {
    color = {
      ...color,
      a: sampleKeyCurve(
        gradient.alphaKeys.map((item) => ({ time: item.time, value: item.alpha })),
        t,
        color.a,
      ),
    };
  }
  return color;
};

const sampleStartColor = (
  gradient: GradientData | undefined,
  systemProgress: number,
  rng: () => number,
): ColorData => {
  if (!gradient) return WHITE_COLOR;
  if (gradient.state === 1) return sampleGradientColor(gradient, systemProgress, gradient.maxColor ?? WHITE_COLOR);
  if (gradient.state === 2) return lerpColor(gradient.minColor ?? WHITE_COLOR, gradient.maxColor ?? WHITE_COLOR, rng());
  if (gradient.state === 3) {
    return lerpColor(
      gradient.minColor ?? WHITE_COLOR,
      sampleGradientColor(gradient, systemProgress, gradient.maxColor ?? WHITE_COLOR),
      rng(),
    );
  }
  return gradient.maxColor ?? WHITE_COLOR;
};

const colorToTint = (color: ColorData) => Math.max(1, (
  (clamp(Math.round(color.r * 255), 0, 255) << 16)
  | (clamp(Math.round(color.g * 255), 0, 255) << 8)
  | clamp(Math.round(color.b * 255), 0, 255)
));

const multiplyColor = (left: ColorData, right: ColorData): ColorData => ({
  r: left.r * right.r,
  g: left.g * right.g,
  b: left.b * right.b,
  a: left.a * right.a,
});

const resolveMaterialColor = (renderer: ParticleSystemData['renderer']): ColorData => {
  const material = renderer.material;
  let color = material?.color ?? WHITE_COLOR;
  if (material?.tintColor) {
    if (material.shaderPathId === FGO_NOBLE_BASE_SHADER_PATH_ID) {
      // The exported FGO base materials use _TintColor as an alpha control.
      // Multiplying RGB here halves the authored gold/white colors.
      color = {
        r: color.r,
        g: color.g,
        b: color.b,
        a: color.a * material.tintColor.a,
      };
    } else {
      color = multiplyColor(color, material.tintColor);
    }
  }
  return color;
};

const resolveParticleBlendMode = (renderer: ParticleSystemData['renderer']) => {
  const blendSrc = renderer.blendSrc ?? renderer.material?.blendSrc;
  const blendDst = renderer.blendDst ?? renderer.material?.blendDst;
  if (blendSrc === 5 && blendDst === 1) return 'add';
  if (blendSrc === 5 && blendDst === 10) return 'normal';
  if (renderer.blend === 'multiply') return 'multiply';
  if (renderer.blend === 'add') return 'add';
  return 'normal';
};

const resolveUnityStraightAlphaBlendMode = (renderer: ParticleSystemData['renderer']) => {
  const blendSrc = renderer.blendSrc ?? renderer.material?.blendSrc;
  const blendDst = renderer.blendDst ?? renderer.material?.blendDst;
  // Pixi uploads PNG textures with premultiplied RGB by default. Unity's
  // SrcAlpha/One and SrcAlpha/OneMinusSrcAlpha materials therefore map to
  // Pixi's premultiplied blend modes; using the *_npm variants multiplies
  // texture alpha a second time and makes the real FGO layers go dark.
  if (blendSrc === 5 && blendDst === 1) return 'add';
  if (blendSrc === 5 && blendDst === 10) return 'normal';
  return resolveParticleBlendMode(renderer);
};

const fgoNobleBaseMode = (renderer: ParticleSystemData['renderer']) => {
  if (renderer.material?.shaderPathId !== FGO_NOBLE_BASE_SHADER_PATH_ID) return undefined;
  const mode = renderer.material.mode;
  return mode === 0 || mode === 1 ? mode : undefined;
};

const usesFgoNobleBaseShader = (renderer: ParticleSystemData['renderer']) => (
  fgoNobleBaseMode(renderer) !== undefined
);

type FgoNobleShaderVariant = 'plain' | 'default' | 'multiply';

const fgoNobleShaderVariant = (
  renderer: ParticleSystemData['renderer'],
): FgoNobleShaderVariant => {
  const keywords = renderer.material?.keywords ?? [];
  if (keywords.includes('_USE_MULTIPLY')) return 'multiply';
  if (keywords.includes('_USE_MULTIPLY_VERTEX_COLOR')) return 'default';
  return 'plain';
};

const fgoNobleOneValue = (renderer: ParticleSystemData['renderer']) => (
  renderer.material?.floats?._oneValue ?? 1
);

const particleZIndex = (renderer: ParticleSystemData['renderer']) => (
  renderer.sortingOrder * 1_000_000 + Math.round(renderer.sortingFudge ?? 0)
);

const rootZIndex = (root: EffectRootData) => Math.max(
  0,
  ...root.particleSystems.map((system) => particleZIndex(system.renderer)),
);

const perspectiveOffset = (
  offset: Vec3,
  placement: RootPlacement,
  originWorldPosition?: Vec3,
) => {
  const perspective = placement.perspective;
  if (!perspective) return null;
  // ParticleSystemRenderer alignment keeps these layers camera-facing in
  // Unity. Project the authored local layer offset directly instead of
  // sending it through the camera depth plane a second time.
  void originWorldPosition;
  return {
    x: offset[0] * perspective.internalScaleX,
    y: -offset[1] * perspective.internalScaleY,
  };
};

const projectEffectOffset = (_rootName: string, offset: Vec3, placement: RootPlacement) => {
  const projected = perspectiveOffset(offset, placement);
  if (projected) return projected;

  const offsetScaleX = placement.offsetScaleX ?? placement.scale;
  const offsetScaleY = placement.offsetScaleY ?? placement.scale;
  if (placement.cameraRotation) {
    const viewOffset = quatRotate(
      [
        -placement.cameraRotation[0],
        -placement.cameraRotation[1],
        -placement.cameraRotation[2],
        placement.cameraRotation[3],
      ],
      offset,
    );
    return {
      x: viewOffset[0] * offsetScaleX,
      y: -viewOffset[1] * offsetScaleY,
    };
  }
  return {
    x: offset[0] * offsetScaleX,
    y: -offset[1] * offsetScaleY,
  };
};

type EffectMeshHorizontalAxis = 0 | 2;

const resolveEffectMeshHorizontalAxis = (
  rootName: string,
  mesh: EffectMeshData,
  transform: TransformData,
  sizeAxes: Vec3,
): EffectMeshHorizontalAxis => {
  let xExtent = 0;
  let zExtent = 0;
  mesh.vertices.forEach((vertex) => {
    const transformed = quatRotate(transform.rotation, [
      vertex[0] * transform.scale[0] * sizeAxes[0],
      vertex[1] * transform.scale[1] * sizeAxes[1],
      vertex[2] * transform.scale[2] * sizeAxes[2],
    ]);
    xExtent = Math.max(xExtent, Math.abs(transformed[0]));
    zExtent = Math.max(zExtent, Math.abs(transformed[2]));
  });

  // The extracted sword plane is already camera-facing through Unity Z.
  // Enemy beam meshes, however, are authored along Unity X and collapse
  // if the stage projection only reads Z.
  if (rootName.includes('final_ray')) {
    // The final-ray base meshes are authored as X/Y/Z volumes whose
    // visible slant comes from the transformed local Y/Z depth. Project
    // their Unity Z axis horizontally instead of flattening them to X.
    if (mesh.name.includes('base')) return 2;
    return 0;
  }
  if (rootName.includes('swode_front')) return 2;
  if (rootName.includes('enemy_beam')) return 0;
  return xExtent > zExtent * 1.15 ? 0 : 2;
};

const projectEffectMeshOffset = (
  rootName: string,
  offset: Vec3,
  placement: RootPlacement,
  horizontalAxis: EffectMeshHorizontalAxis,
  originWorldPosition?: Vec3,
) => {
  if (rootName.includes('enemy_beam') && horizontalAxis === 0) {
    // The authored enemy beam plane lives in Unity X-Z, with Y collapsed.
    // After the authored Unity rotation, its screen vertical is transformed Y.
    if (placement.perspective) {
      void originWorldPosition;
      return {
        x: offset[0] * placement.perspective.internalScaleX,
        y: -offset[1] * placement.perspective.internalScaleY,
      };
    }
    const meshScaleX = placement.meshScaleX ?? placement.scale;
    const meshScaleY = placement.offsetScaleY ?? placement.scale;
    return {
      x: offset[0] * meshScaleX,
      y: -offset[1] * meshScaleY,
    };
  }
  if (placement.perspective) {
    // Mesh particles use the same authored layer projection as billboards.
    // Do not apply camera rotation/depth to individual vertices.
    void originWorldPosition;
    return {
      x: offset[horizontalAxis] * placement.perspective.internalScaleX,
      y: -offset[1] * placement.perspective.internalScaleY,
    };
  }
  const projected = perspectiveOffset(offset, placement, originWorldPosition);
  if (projected) return projected;

  const meshScaleX = placement.meshScaleX ?? placement.scale;
  const offsetScaleY = placement.offsetScaleY ?? placement.scale;
  if (placement.cameraRotation) {
    const viewOffset = quatRotate(
      [
        -placement.cameraRotation[0],
        -placement.cameraRotation[1],
        -placement.cameraRotation[2],
        placement.cameraRotation[3],
      ],
      offset,
    );
    return {
      x: viewOffset[0] * meshScaleX,
      y: -viewOffset[1] * offsetScaleY,
    };
  }
  return {
    x: -offset[horizontalAxis] * meshScaleX,
    y: -offset[1] * offsetScaleY,
  };
};

const sceneRootPlacement = (root: EffectRootData): RootPlacement => {
  const [worldX, worldY] = root.worldTransform.position;
  // Battle-space roots are authored in the same Unity world as the sequence.
  // The runtime fallback keeps the historical fixed projection for old exports.
  const isBattleSpaceRoot = !(
    root.name.includes('cutin')
    || root.name.includes('black')
    || root.name.includes('start_bg')
  );
  const battleOriginX = isBattleSpaceRoot ? 77.86 : 0;
  const battleOriginY = isBattleSpaceRoot ? 0 : 0;
  return {
    x: DESIGN_WIDTH / 2 + (worldX - battleOriginX) * 3.35,
    y: 606 - (worldY - battleOriginY) * 44,
    scale: 44,
    alpha: 1,
    offsetScaleX: 3.35,
    offsetScaleY: 44,
    meshScaleX: 44,
  };
};

const inferRootPlacement = (root: EffectRootData): RootPlacement => {
  const rootName = root.name;
  if (rootName.includes('cutin') || rootName.includes('black')) return { x: 640, y: 340, scale: 54, alpha: 1 };
  if (rootName.includes('start_bg')) return { x: 640, y: 348, scale: 48, alpha: 0.9 };
  return sceneRootPlacement(root);
};

const resolveAttachmentNodeIdentifiers = (nodeName: string) => {
  if (nodeName === 'en_noble01') {
    return [
      'joint_all_Base/joint_all/joint_weapon_all/joint_sword/en_noble01',
      nodeName,
    ];
  }
  return [nodeName];
};

const effectTextureFileKey = (file: string) => `effect:${file}`;
const effectTextureKey = (texture: EffectTextureData) => effectTextureFileKey(texture.file);

const resolveUvFrameIndex = (
  uv: ParticleSystemData['particle']['uv'],
  progress: number,
  frameCount: number,
  random = 1,
) => {
  if (!uv.enabled || frameCount <= 1) return 0;
  const fixedRng = () => random;
  const startFrame = curveScalarAt(uv.startFrame, 0, 0, fixedRng);
  const frameProgress = curveScalarAt(uv.frameOverTime, progress, progress, fixedRng);
  const frameIndex = Math.floor(startFrame + frameProgress * frameCount * uv.cycles);
  return ((frameIndex % frameCount) + frameCount) % frameCount;
};

const makeTextureFrames = (
  baseTexture: Texture,
  uv: ParticleSystemData['particle']['uv'],
  cache: Map<string, Texture[]>,
  textureFile: string,
) => {
  const tilesX = Math.max(1, uv.enabled ? uv.tilesX : 1);
  const tilesY = Math.max(1, uv.enabled ? uv.tilesY : 1);
  const cacheKey = `${textureFile}:${tilesX}x${tilesY}:${uv.rowMode}:${uv.animationType}:${uv.rowIndex}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const source = baseTexture.source;
  const frameWidth = Math.max(1, Math.floor(baseTexture.width / tilesX));
  const frameHeight = Math.max(1, Math.floor(baseTexture.height / tilesY));
  const frames: Texture[] = [];
  // Unity uses animationType=1 for Single Row. rowMode=1 is a row-selection
  // mode used by Single Row; it does not turn Whole Sheet into one row.
  const isSingleRow = uv.enabled && uv.animationType === 1;
  if (isSingleRow) {
    const row = clamp(uv.rowIndex, 0, tilesY - 1);
    for (let x = 0; x < tilesX; x += 1) {
      frames.push(new Texture({
        source,
        frame: new Rectangle(x * frameWidth, row * frameHeight, frameWidth, frameHeight),
      }));
    }
  } else {
    for (let rowFromTop = 0; rowFromTop < tilesY; rowFromTop += 1) {
      const y = rowFromTop;
      for (let x = 0; x < tilesX; x += 1) {
        frames.push(new Texture({
          source,
          frame: new Rectangle(x * frameWidth, y * frameHeight, frameWidth, frameHeight),
        }));
      }
    }
  }
  cache.set(cacheKey, frames);
  return frames;
};

const resolveUvTile = (uv: ParticleSystemData['particle']['uv'], frameIndex: number) => {
  const tilesX = Math.max(1, uv.enabled ? uv.tilesX : 1);
  const tilesY = Math.max(1, uv.enabled ? uv.tilesY : 1);
  if (!uv.enabled) return { tilesX, tilesY, tileX: 0, tileY: 0 };
  if (uv.animationType === 1) {
    return {
      tilesX,
      tilesY,
      tileX: frameIndex % tilesX,
      tileY: clamp(uv.rowIndex, 0, tilesY - 1),
    };
  }
  const rowFromTop = Math.floor(frameIndex / tilesX) % tilesY;
  return {
    tilesX,
    tilesY,
    tileX: frameIndex % tilesX,
    tileY: rowFromTop,
  };
};

const fgoNobleBaseLocalColorBitGl = {
  name: 'fgo-noble-base-local-color',
  vertex: {
    header: (
      /* glsl */
      `
        uniform mat3 uTransformMatrix;
        uniform vec4 uColor;
        uniform float uRound;
        in vec4 aColor;
      `
    ),
    main: (
      /* glsl */
      `
        vec4 objectColor = uColor;
        vColor *= objectColor * vec4(aColor.rgb * aColor.a, aColor.a);
        modelMatrix = uTransformMatrix;
      `
    ),
    end: (
      /* glsl */
      `
        if (uRound == 1.) {
          gl_Position.xy = roundPixels(gl_Position.xy, uResolution);
        }
      `
    ),
  },
};

const fgoNobleBaseBitGl = {
  name: 'fgo-noble-base',
  fragment: {
    header: (
      /* glsl */
      `
        uniform float uFgoOneValue;
        uniform float uFgoVariant;
      `
    ),
    end: (
      /* glsl */
      `
        vec4 texColor = outColor;
        vec4 vertexColor = vColor;
        if (uFgoVariant < 0.5) {
          texColor.a *= uFgoOneValue;
          finalColor = texColor;
        } else if (uFgoVariant < 1.5) {
          vertexColor.rgb *= 1.0;
          texColor *= vertexColor;
          texColor.a *= uFgoOneValue;
          finalColor = texColor;
        } else {
          float sourceAlpha = texColor.a * vertexColor.a;
          vec4 multiplyColor = vec4(1.0) + sourceAlpha * (texColor * vertexColor - vec4(1.0));
          multiplyColor.a *= uFgoOneValue;
          finalColor = multiplyColor;
        }
      `
    ),
  },
};

const fgoNobleBaseGlProgram = compileHighShaderGlProgram({
  name: 'fgo-noble-base',
  bits: [
    fgoNobleBaseLocalColorBitGl,
    textureBitGl,
    roundPixelsBitGl,
    fgoNobleBaseBitGl,
  ],
});

const fgoNobleBaseShadersByTexture = new Map<string, Shader>();

const getFgoNobleBaseShader = (
  texture: Texture,
  oneValue: number,
  variant: FgoNobleShaderVariant,
) => {
  const normalizedOneValue = Number.isFinite(oneValue) ? oneValue : 1;
  const normalizedVariant = variant === 'multiply' ? 2 : variant === 'default' ? 1 : 0;
  const cacheKey = `${texture.uid}:${normalizedOneValue.toFixed(4)}:${normalizedVariant}`;
  const cached = fgoNobleBaseShadersByTexture.get(cacheKey);
  if (cached) return cached;

  texture.textureMatrix.update();
  const shader = new Shader({
    glProgram: fgoNobleBaseGlProgram,
    resources: {
      uTexture: texture.source,
      uSampler: texture.source.style,
      textureUniforms: {
        uTextureMatrix: { type: 'mat3x3<f32>', value: texture.textureMatrix.mapCoord },
      },
      fgoNobleUniforms: {
        uFgoOneValue: { type: 'f32', value: normalizedOneValue },
        uFgoVariant: { type: 'f32', value: normalizedVariant },
      },
    },
  });
  fgoNobleBaseShadersByTexture.set(cacheKey, shader);
  return shader;
};

const effectMeshGlProgram = compileHighShaderGlProgram({
  name: 'fgo-effect-mesh',
  bits: [
    localUniformBitGl,
    colorBitGl,
    textureBitGl,
    roundPixelsBitGl,
  ],
});

const effectMeshGpuProgram = compileHighShaderGpuProgram({
  name: 'fgo-effect-mesh',
  bits: [
    localUniformBit,
    colorBit,
    textureBit,
    roundPixelsBit,
  ],
});

const effectMeshShadersByTexture = new Map<number, Shader>();

const getEffectMeshShader = (texture: Texture) => {
  const cached = effectMeshShadersByTexture.get(texture.uid);
  if (cached) return cached;

  texture.textureMatrix.update();
  const shader = new Shader({
    glProgram: effectMeshGlProgram,
    gpuProgram: effectMeshGpuProgram,
    resources: {
      uTexture: texture.source,
      uSampler: texture.source.style,
      textureUniforms: {
        uTextureMatrix: { type: 'mat3x3<f32>', value: texture.textureMatrix.mapCoord },
      },
    },
  });
  effectMeshShadersByTexture.set(texture.uid, shader);
  return shader;
};

const makeEffectMeshVertexColors = (mesh: EffectMeshData) => {
  const colors = new Float32Array(mesh.vertices.length * 4);
  mesh.vertices.forEach((_vertex, index) => {
    const color = mesh.colors?.[index] ?? [1, 1, 1, 1];
    colors[index * 4] = color[0];
    colors[index * 4 + 1] = color[1];
    colors[index * 4 + 2] = color[2];
    colors[index * 4 + 3] = color[3];
  });
  return colors;
};

const makeEffectMeshGeometry = (
  rootName: string,
  mesh: EffectMeshData,
  uv: ParticleSystemData['particle']['uv'],
  frameIndex: number,
  cache: Map<string, MeshGeometry>,
  transform: TransformData,
  sizeAxes: Vec3 = [1, 1, 1],
  uvOffset: [number, number] = [0, 0],
  particleRotation: Quat = [0, 0, 0, 1],
  placement: RootPlacement = { x: 0, y: 0, scale: 1, alpha: 1 },
) => {
  const transformKey = `${transform.rotation.join(',')}:${transform.scale.join(',')}`;
  const sizeKey = `${sizeAxes[0].toFixed(4)},${sizeAxes[1].toFixed(4)},${sizeAxes[2].toFixed(4)}`;
  const uvOffsetKey = `${uvOffset[0].toFixed(4)},${uvOffset[1].toFixed(4)}`;
  const particleRotationKey = particleRotation.map((value) => value.toFixed(5)).join(',');
  const meshProjectionKey = [
    placement.meshScaleX ?? placement.scale,
    placement.offsetScaleY ?? placement.scale,
    placement.perspective?.key ?? 'ortho',
    transform.position.map((value) => value.toFixed(4)).join(','),
  ].join(':');
  const cacheKey = `${rootName}:${mesh.pathId}:${uv.enabled ? `${uv.tilesX}x${uv.tilesY}:${uv.animationType}:${uv.rowIndex}:${frameIndex}` : 'full'}:${transformKey}:${sizeKey}:${uvOffsetKey}:${particleRotationKey}:${meshProjectionKey}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const tile = resolveUvTile(uv, frameIndex);
  const positions = new Float32Array(mesh.vertices.length * 2);
  const uvs = new Float32Array(mesh.vertices.length * 2);
  const horizontalAxis = resolveEffectMeshHorizontalAxis(rootName, mesh, transform, sizeAxes);
  mesh.vertices.forEach((vertex, index) => {
    const particleLocal = quatRotate(particleRotation, [
      vertex[0] * transform.scale[0] * sizeAxes[0],
      vertex[1] * transform.scale[1] * sizeAxes[1],
      vertex[2] * transform.scale[2] * sizeAxes[2],
    ]);
    const transformed = quatRotate(transform.rotation, particleLocal);
    const projected = projectEffectMeshOffset(
      rootName,
      transformed,
      placement,
      horizontalAxis,
      transform.position,
    );
    positions[index * 2] = projected.x;
    positions[index * 2 + 1] = projected.y;
  });
  mesh.uvs.forEach(([u, v], index) => {
    const shiftedU = u + uvOffset[0];
    // The exported FGO mesh UVs already match the atlas orientation used by
    // Pixi's texture source. Flipping V here sends cloud meshes into the
    // atlas's full-width dark strip and produces opaque rectangular caps.
    const pixiV = mesh.name === '_100100_beam'
      ? 1 - v + uvOffset[1]
      : v + uvOffset[1];
    uvs[index * 2] = (shiftedU + tile.tileX) / tile.tilesX;
    uvs[index * 2 + 1] = (pixiV + tile.tileY) / tile.tilesY;
  });

  const geometry = new MeshGeometry({
    positions,
    uvs,
    indices: new Uint32Array(mesh.indices),
    shrinkBuffersToFit: true,
  });
  geometry.addAttribute('aColor', {
    buffer: makeEffectMeshVertexColors(mesh),
    format: 'float32x4',
    stride: 4 * 4,
    offset: 0,
  });
  cache.set(cacheKey, geometry);
  return geometry;
};

const makeParticleQuadGeometry = (
  texture: Texture,
  uv: ParticleSystemData['particle']['uv'],
  frameIndex: number,
  cache: Map<string, MeshGeometry>,
  uvOffset: [number, number] = [0, 0],
) => {
  const tilesX = Math.max(1, uv.enabled ? uv.tilesX : 1);
  const tilesY = Math.max(1, uv.enabled ? uv.tilesY : 1);
  const frameWidth = Math.max(1, Math.floor(texture.width / tilesX));
  const frameHeight = Math.max(1, Math.floor(texture.height / tilesY));
  const uvOffsetKey = `${uvOffset[0].toFixed(4)},${uvOffset[1].toFixed(4)}`;
  const cacheKey = `quad:${texture.uid}:${uv.enabled ? `${tilesX}x${tilesY}:${uv.rowMode}:${uv.animationType}:${uv.rowIndex}:${frameIndex}` : 'full'}:${uvOffsetKey}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const tile = resolveUvTile(uv, frameIndex);
  const u0 = (tile.tileX + uvOffset[0]) / tile.tilesX;
  const v0 = 1 - (tile.tileY + 1 + uvOffset[1]) / tile.tilesY;
  const u1 = (tile.tileX + 1 + uvOffset[0]) / tile.tilesX;
  const v1 = 1 - (tile.tileY + uvOffset[1]) / tile.tilesY;
  const halfWidth = frameWidth / 2;
  const halfHeight = frameHeight / 2;
  const geometry = new MeshGeometry({
    positions: new Float32Array([
      -halfWidth, -halfHeight,
      halfWidth, -halfHeight,
      halfWidth, halfHeight,
      -halfWidth, halfHeight,
    ]),
    uvs: new Float32Array([
      u0, v0,
      u1, v0,
      u1, v1,
      u0, v1,
    ]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    shrinkBuffersToFit: true,
  });
  geometry.addAttribute('aColor', {
    buffer: new Float32Array([
      1, 1, 1, 1,
      1, 1, 1, 1,
      1, 1, 1, 1,
      1, 1, 1, 1,
    ]),
    format: 'float32x4',
    stride: 4 * 4,
    offset: 0,
  });
  cache.set(cacheKey, geometry);
  return geometry;
};

const makeFrameQuadGeometry = (
  frame: Texture,
  cache: Map<string, MeshGeometry>,
) => {
  const cacheKey = `frame-quad:${frame.uid}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const halfWidth = frame.width / 2;
  const halfHeight = frame.height / 2;
  const geometry = new MeshGeometry({
    positions: new Float32Array([
      -halfWidth, -halfHeight,
      halfWidth, -halfHeight,
      halfWidth, halfHeight,
      -halfWidth, halfHeight,
    ]),
    uvs: new Float32Array([
      0, 0,
      1, 0,
      1, 1,
      0, 1,
    ]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    shrinkBuffersToFit: true,
  });
  geometry.addAttribute('aColor', {
    buffer: new Float32Array([
      1, 1, 1, 1,
      1, 1, 1, 1,
      1, 1, 1, 1,
      1, 1, 1, 1,
    ]),
    format: 'float32x4',
    stride: 4 * 4,
    offset: 0,
  });
  cache.set(cacheKey, geometry);
  return geometry;
};

const meshScaleFactor = (rootName: string, particleName: string, meshName: string) => {
  if (rootName.includes('final_ray')) {
    // Keep the authored layer hierarchy, then convert its historical
    // orthographic calibration into the current perspective scale below.
    if (meshName.includes('tubu')) return 0.38;
    if (meshName.includes('guruguru')) return 0.82;
    if (meshName.includes('plane')) return 0.18;
    if (meshName.includes('base')) return 0.22;
    if (meshName.includes('ring')) return 0.22;
    if (meshName.includes('cloud')) return 0.10;
    if (particleName.includes('guru') || particleName.includes('tutu')) return 0.45;
  }
  if (rootName.includes('swode_front')) return 2.2;
  if (particleName.includes('guru') || particleName.includes('tutu')) return 0.9;
  if (meshName.includes('rey_line')) return 0.75;
  if (meshName.includes('aura') || meshName.includes('aula') || meshName.includes('rot')) return 0.8;
  if (rootName.includes('beam_light') && meshName.includes('beam')) return 0.08;
  if (meshName.includes('beam') || meshName.includes('kensen')) return 0.22;
  if (meshName.includes('ring') || meshName.includes('cloud')) return 0.1;
  if (meshName.includes('diamond')) return 0.04;
  if (meshName.includes('plane')) return rootName.includes('cutin') || rootName.includes('black') ? 0.18 : 0.55;
  return 0.18;
};

const projectedEffectMeshExtent = (
  rootName: string,
  mesh: EffectMeshData,
  transform: TransformData,
  sizeAxes: Vec3 = [1, 1, 1],
  placement: RootPlacement = { x: 0, y: 0, scale: 1, alpha: 1 },
) => {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const horizontalAxis = resolveEffectMeshHorizontalAxis(rootName, mesh, transform, sizeAxes);
  mesh.vertices.forEach((vertex) => {
    const transformed = quatRotate(transform.rotation, [
      vertex[0] * transform.scale[0] * sizeAxes[0],
      vertex[1] * transform.scale[1] * sizeAxes[1],
      vertex[2] * transform.scale[2] * sizeAxes[2],
    ]);
    const point = projectEffectMeshOffset(
      rootName,
      transformed,
      placement,
      horizontalAxis,
      transform.position,
    );
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  });
  return Math.max(maxX - minX, maxY - minY, 0);
};

const maxParticlePixels = (renderer: ParticleSystemData['renderer']) => {
  const maxParticleSize = renderer.maxParticleSize ?? 0;
  if (maxParticleSize > 0 && maxParticleSize <= 1) {
    return DESIGN_HEIGHT * maxParticleSize;
  }
  return Number.POSITIVE_INFINITY;
};

const sampleParticleStartSize = (
  particle: ParticleSystemData['particle'],
  systemProgress: number,
  rng: () => number,
): Vec3 => {
  const sizeX = curveScalarAt(particle.startSize, systemProgress, 1, rng);
  if (!particle.size3D) return [sizeX, sizeX, sizeX];
  return [
    sizeX,
    curveScalarAt(particle.startSizeY, systemProgress, sizeX, rng),
    curveScalarAt(particle.startSizeZ, systemProgress, sizeX, rng),
  ];
};

const meshParticleSizeAxes = (
  rootName: string,
  particleName: string,
  meshName: string,
  particle: ParticleSystemData['particle'],
  rawSize: Vec3,
): Vec3 => {
  const factor = meshScaleFactor(rootName, particleName, meshName);
  if (rootName.includes('final_ray') && meshName.includes('base') && particle.size3D) {
    // Base meshes use their authored local Y/Z volume for the long ray.
    // Narrow the screen width without shortening the visible beam.
    return [
      Math.abs(rawSize[0]) * factor,
      Math.abs(rawSize[1]) * factor,
      Math.abs(rawSize[2]) * (particleName === 'base_r' ? factor : 0.5),
    ];
  }
  if (
    rootName.includes('final_ray')
    && meshName.includes('tubu')
    && particleName.includes('tutu')
    && !particle.size3D
  ) {
    // The authored tutu mesh carries the long vertical ring stack. Keep
    // that depth while tightening its screen width.
    return [
      Math.abs(rawSize[0]) * 0.45,
      Math.abs(rawSize[1]) * 0.58,
      Math.abs(rawSize[2]) * 0.45,
    ];
  }
  if (!particle.size3D) {
    const uniformSize = Math.abs(rawSize[0]) * factor;
    return [uniformSize, uniformSize, uniformSize];
  }
  return [
    Math.abs(rawSize[0]) * factor,
    Math.abs(rawSize[1]) * factor,
    Math.abs(rawSize[2]) * factor,
  ];
};

const sampleParticleStartRotationZ = (
  particle: ParticleSystemData['particle'],
  systemProgress: number,
  rng: () => number,
): number => curveScalarAt(particle.startRotation, systemProgress, 0, rng);

const sampleParticleAngularVelocityZ = (
  particle: ParticleSystemData['particle'],
  rng: () => number,
): number => {
  if (!particle.rotationOverLifetime.enabled) return 0;
  const direction = rng() < (particle.randomizeRotationDirection ?? 0)
    ? (rng() < 0.5 ? -1 : 1)
    : 1;
  return curveScalarAt(particle.rotationOverLifetime.curve, 0, 0, rng) * direction;
};

const sampleParticleDirection = (
  shape: ParticleSystemData['particle']['shape'],
  rng: () => number,
): Vec3 => {
  // Unity emits cone/mesh-style effect particles along the local +Z axis.
  // The exported FGO effects use that axis as depth, so it must not become
  // arbitrary 2D screen motion in the Pixi projection.
  if (shape.type === 0) {
    const z = rng() * 2 - 1;
    const radius = Math.sqrt(Math.max(0, 1 - z * z));
    const angle = rng() * Math.PI * 2;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius, z];
  }

  if (shape.type === 1) {
    const z = rng();
    const radius = Math.sqrt(Math.max(0, 1 - z * z));
    const angle = rng() * Math.PI * 2;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius, z];
  }

  if (shape.type === 2 || shape.type === 5) {
    const halfAngle = Math.max(0, shape.angle) * Math.PI / 180;
    const minCos = Math.cos(halfAngle);
    const cosTheta = lerp(minCos, 1, rng());
    const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
    const angle = rng() * Math.PI * 2;
    return [Math.cos(angle) * sinTheta, Math.sin(angle) * sinTheta, cosTheta];
  }

  return [0, 0, 1];
};

const sampleParticleSizeOverLifetimeScale = (
  sizeOverLifetime: ParticleSystemData['particle']['sizeOverLifetime'],
  progress: number,
) => {
  if (!sizeOverLifetime.enabled) return { x: 1, y: 1 };
  const scaleX = sampleCurve(sizeOverLifetime.curve, progress, 1);
  if (!sizeOverLifetime.separateAxes) return { x: scaleX, y: scaleX };
  return {
    x: scaleX,
    y: sampleCurve(sizeOverLifetime.y, progress, scaleX),
  };
};

const meshParticleScale = (
  rootName: string,
  mesh: EffectMeshData,
  renderer: ParticleSystemData['renderer'],
  placement: RootPlacement,
  transform: TransformData,
  sizeAxes: Vec3,
) => {
  // Mesh geometry is already projected into stage pixels. The view scale is
  // reserved for particle-size caps, not another stage-space conversion.
  const scaleX = 1;
  const scaleY = 1;

  const maxPixels = maxParticlePixels(renderer);
  if (!Number.isFinite(maxPixels)) return { x: scaleX, y: scaleY };

  const extent = projectedEffectMeshExtent(rootName, mesh, transform, sizeAxes, placement);
  if (extent <= 0) return { x: scaleX, y: scaleY };
  const maxScale = maxPixels / extent;
  return {
    x: Math.min(scaleX, maxScale),
    y: Math.min(scaleY, maxScale),
  };
};

const transformAxisScale = (scale: Vec3, axis: 0 | 1 | 2) => {
  const value = scale[axis] || 1;
  const sign = value < 0 ? -1 : 1;
  return sign * clamp(Math.abs(value), 0.08, 60);
};

const spriteParticleSize = (rawSize: number, placement: RootPlacement) => {
  if (rawSize >= 20) {
    return clamp(rawSize * placement.scale * 0.025, 6, 420);
  }
  return clamp(rawSize * placement.scale * 0.42, 2, 260);
};

const resolveParticleViewRotation = (
  renderMode: number,
  renderAlignment: number,
  startRotationZ: number,
  placementRotation: number,
  transformRotation: number,
  velocity: { x: number; y: number },
) => {
  const motionRotation = Math.hypot(velocity.x, velocity.y) > 0.0001
    ? Math.atan2(velocity.y, velocity.x)
    : transformRotation;

  if (renderMode === 1 || renderAlignment === 4) {
    // Stretch and velocity-aligned particles use their projected motion axis.
    // Local/world alignment still contributes the authored transform rotation.
    const alignedRotation = renderAlignment === 1 || renderAlignment === 2
      ? transformRotation
      : motionRotation;
    return placementRotation + alignedRotation + startRotationZ;
  }

  if (renderAlignment === 1 || renderAlignment === 2 || renderAlignment === 3) {
    return placementRotation + transformRotation + startRotationZ;
  }

  // View-aligned billboards ignore the particle's 3D tilt and keep only the
  // authored screen-space rotation.
  return placementRotation + startRotationZ;
};

class SkinnedMeshActor extends Container {
  private readonly data: SkinData;
  private readonly skinnedMeshes: Array<{
    meshData: SkinMeshData;
    geometry: MeshGeometry;
    view: Mesh;
    positions: Float32Array;
  }>;
  private readonly localPositions: Vec3[];
  private readonly localRotations: Quat[];
  private readonly localScales: Vec3[];
  private readonly worldMatrices: Mat4[];
  private readonly skinMatrices: Mat4[];
  private readonly animationsByName = new Map<string, SkinAnimation>();
  private readonly nodesByPath = new Map<string, SkinNode>();
  private readonly nodesByName = new Map<string, SkinNode[]>();
  private readonly skeletonDebug = new Graphics();
  private readonly debugLabel = new Text({
    text: 'Unity SkinnedMeshRenderer + AnimationClip',
    style: {
      fill: 0x8df7ff,
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: 15,
      fontWeight: '800',
    },
  });

  constructor(data: SkinData, texture: Texture) {
    super();
    this.data = data;
    const meshDataItems = [
      data.mesh,
      ...(data.attachments ?? [])
        .filter((attachment) => attachment.kind === 'skinnedMesh')
        .map((attachment) => attachment.mesh),
    ];
    this.skinnedMeshes = meshDataItems.map((meshData) => {
      const positions = new Float32Array(meshData.vertexCount * 2);
      const uvs = new Float32Array(meshData.vertexCount * 2);
      meshData.uvs.forEach(([u, v], index) => {
        uvs[index * 2] = u;
        uvs[index * 2 + 1] = 1 - v;
      });
      const geometry = new MeshGeometry({
        positions,
        uvs,
        indices: new Uint32Array(meshData.indices),
        shrinkBuffersToFit: true,
      });
      const mesh = new Mesh({ geometry, texture });
      this.addChild(mesh);
      return { meshData, geometry, view: mesh, positions };
    });
    this.localPositions = data.skeleton.nodes.map((node) => [...node.localPosition] as Vec3);
    this.localRotations = data.skeleton.nodes.map((node) => [...node.localRotation] as Quat);
    this.localScales = data.skeleton.nodes.map((node) => [...node.localScale] as Vec3);
    this.worldMatrices = data.skeleton.nodes.map(() => [...IDENTITY_MAT4] as Mat4);
    this.skinMatrices = data.skeleton.skinBones.map(() => [...IDENTITY_MAT4] as Mat4);
    data.skeleton.nodes.forEach((node) => {
      if (node.path) this.nodesByPath.set(node.path, node);
      const existing = this.nodesByName.get(node.name) ?? [];
      existing.push(node);
      this.nodesByName.set(node.name, existing);
    });

    (data.animations ?? []).forEach((animation) => {
      this.animationsByName.set(animation.name, animation);
    });

    this.debugLabel.x = 8;
    this.debugLabel.y = -482;
    this.skeletonDebug.visible = SHOW_DEBUG_SKELETON;
    this.debugLabel.visible = SHOW_DEBUG_SKELETON;
    this.addChild(this.skeletonDebug, this.debugLabel);
    this.updatePose(0, 'wait02');
  }

  setMeshTint(meshName: string | undefined, tint: number) {
    const normalizedName = meshName?.split('/').pop();
    this.skinnedMeshes.forEach(({ meshData, view }) => {
      if (normalizedName && meshData.name !== normalizedName) return;
      view.tint = tint;
    });
  }

  setModelEvolution(level: number) {
    const selectedName = level === 3 ? 'body_level_3' : 'body_level_2';
    const hasEvolutionMeshes = this.skinnedMeshes.some(({ meshData }) => (
      meshData.name === 'body_level_2' || meshData.name === 'body_level_3'
    ));
    if (!hasEvolutionMeshes) return;
    this.skinnedMeshes.forEach(({ meshData, view }) => {
      if (meshData.name === 'body_level_2' || meshData.name === 'body_level_3') {
        view.visible = meshData.name === selectedName;
      }
    });
  }

  hasAnimation(name: string) {
    return this.animationsByName.has(name);
  }

  animationDuration(name: string) {
    return this.animationsByName.get(name)?.duration ?? 1;
  }

  projectNode(identifier: string, offset: Vec3 = [0, 0, 0]) {
    const node = this.resolveNode(identifier);
    if (!node) return null;
    const matrix = this.worldMatrices[node.index];
    if (!matrix) return null;

    const origin = transformPoint(matrix, offset);
    const alongLocalY = transformPoint(matrix, [offset[0], offset[1] + 0.35, offset[2]]);
    const point = projectUnityPoint(origin);
    const direction = projectUnityPoint(alongLocalY);
    return {
      x: point.x,
      y: point.y,
      rotation: Math.atan2(direction.y - point.y, direction.x - point.x),
    };
  }

  debugMeshSnapshot(texture: Texture) {
    return this.skinnedMeshes.map(({ meshData, view, positions }) => {
      let minX = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      for (let index = 0; index < positions.length; index += 2) {
        const x = positions[index];
        const y = positions[index + 1];
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      const extremes = new Set<number>();
      for (const target of [minX, maxX, minY, maxY]) {
        for (let index = 0; index < meshData.vertexCount; index += 1) {
          if (positions[index * 2] === target || positions[index * 2 + 1] === target) {
            extremes.add(index);
            break;
          }
        }
      }
      return {
        name: meshData.name,
        vertexCount: meshData.vertexCount,
        triangleCount: Math.floor(meshData.indices.length / 3),
        visible: view.visible,
        minX,
        maxX,
        minY,
        maxY,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2,
        textureWidth: texture.width,
        textureHeight: texture.height,
        extremeVertices: [...extremes].map((index) => ({
          index,
          x: positions[index * 2],
          y: positions[index * 2 + 1],
          source: meshData.vertices[index],
          influences: meshData.weights[index].indices.flatMap((skinIndex, slot) => {
            const weight = meshData.weights[index].weights[slot];
            if (weight <= 0) return [];
            const skinBone = this.data.skeleton.skinBones[skinIndex];
            const node = this.data.skeleton.nodes[skinBone.nodeIndex];
            return [{ bone: node.name, weight, localPosition: this.localPositions[node.index], localScale: this.localScales[node.index] }];
          }),
        })),
      };
    });
  }

  updatePose(time: number, animationName: string) {
    this.resetLocalPose();
    this.applyAnimationClip(animationName, time);
    this.rebuildWorldMatrices();
    this.rebuildSkinnedVertices();
    if (SHOW_DEBUG_SKELETON) this.drawSkeleton();
  }

  private resolveNode(identifier: string) {
    const exact = this.nodesByPath.get(identifier);
    if (exact) return exact;

    for (const [path, node] of this.nodesByPath) {
      if (path.endsWith(`/${identifier}`)) return node;
    }

    const named = this.nodesByName.get(identifier);
    return named?.length === 1 ? named[0] : null;
  }

  private resetLocalPose() {
    this.data.skeleton.nodes.forEach((node, index) => {
      this.localPositions[index] = [...node.localPosition] as Vec3;
      this.localRotations[index] = [...node.localRotation] as Quat;
      this.localScales[index] = [...node.localScale] as Vec3;
    });
  }

  private applyAnimationClip(animationName: string, localTime: number) {
    const clip = this.animationsByName.get(animationName);
    if (!clip) return false;

    const duration = Math.max(clip.duration, 1 / Math.max(clip.sampleRate, 1));
    const wrappedTime = clip.name === 'wait02'
      ? ((localTime % duration) + duration) % duration
      : clamp(localTime, 0, duration);
    // Alternate character rigs switch scale and compensating offsets on adjacent authored frames.
    const frameTime = clip.frames.reduce((latest, frame) => (
      frame.time >= 0 && frame.time <= wrappedTime + 0.00001 && frame.time > latest
        ? frame.time
        : latest
    ), 0);
    const values = sampleAnimationScalars(clip, frameTime, false);
    clip.bindings.forEach((binding) => {
      const triplet = readScalarTriplet(values, binding.scalarOffset);
      if (!triplet) return;
      if (binding.nodeIndex < 0 || binding.nodeIndex >= this.data.skeleton.nodes.length) return;

      if (binding.attribute === 'position') {
        this.localPositions[binding.nodeIndex] = normalizeClipPosition(triplet);
      } else if (binding.attribute === 'scale') {
        this.localScales[binding.nodeIndex] = triplet;
      } else {
        this.localRotations[binding.nodeIndex] = quatFromUnityEulerDegrees(triplet);
      }
    });
    return true;
  }

  private rebuildWorldMatrices() {
    this.data.skeleton.nodes.forEach((node, index) => {
      const local = makeLocalMatrix(this.localPositions[index], this.localRotations[index], this.localScales[index]);
      this.worldMatrices[index] = node.parent >= 0
        ? mat4Multiply(this.worldMatrices[node.parent], local)
        : local;
    });

    this.data.skeleton.skinBones.forEach((skinBone) => {
      this.skinMatrices[skinBone.skinIndex] = mat4Multiply(
        this.worldMatrices[skinBone.nodeIndex],
        skinBone.bindPose,
      );
    });
  }

  private rebuildSkinnedVertices() {
    this.skinnedMeshes.forEach(({ meshData, geometry, positions }) => {
      meshData.vertices.forEach((vertex, vertexIndex) => {
        const weight = meshData.weights[vertexIndex];
        let x = 0;
        let y = 0;
        let z = 0;
        for (let i = 0; i < 4; i += 1) {
          const amount = weight.weights[i];
          if (amount <= 0) continue;
          const skinMatrix = this.skinMatrices[weight.indices[i]];
          if (!skinMatrix) continue;
          const posed = transformPoint(skinMatrix, vertex);
          x += posed[0] * amount;
          y += posed[1] * amount;
          z += posed[2] * amount;
        }
        const projected = projectUnityPoint([x, y, z]);
        positions[vertexIndex * 2] = projected.x;
        positions[vertexIndex * 2 + 1] = projected.y;
      });
      geometry.positions = positions;
      geometry.getBuffer('aPosition').update();
    });
  }

  private isSkeletonDebugNodeVisible(nodeIndex: number) {
    let currentIndex = nodeIndex;
    while (currentIndex >= 0) {
      const scale = this.localScales[currentIndex];
      if (Math.max(Math.abs(scale[0]), Math.abs(scale[1]), Math.abs(scale[2])) < 0.02) {
        return false;
      }
      currentIndex = this.data.skeleton.nodes[currentIndex].parent;
    }
    return true;
  }

  private drawSkeleton() {
    this.skeletonDebug.clear();
    this.skeletonDebug.circle(0, 0, 3).fill({ color: 0xff315f, alpha: 0.85 });
    this.data.skeleton.nodes.forEach((node) => {
      if (!node.isSkinBone) return;
      if (!this.isSkeletonDebugNodeVisible(node.index)) return;
      const point = projectUnityPoint(transformPoint(this.worldMatrices[node.index], [0, 0, 0]));
      const parentNode = node.parent >= 0 ? this.data.skeleton.nodes[node.parent] : null;
      if (parentNode?.isSkinBone && this.isSkeletonDebugNodeVisible(parentNode.index)) {
        const parent = projectUnityPoint(transformPoint(this.worldMatrices[node.parent], [0, 0, 0]));
        const distance = Math.hypot(point.x - parent.x, point.y - parent.y);
        if (distance < 160) {
          this.skeletonDebug.moveTo(parent.x, parent.y).lineTo(point.x, point.y)
            .stroke({ color: 0x41e8ff, width: 1.4, alpha: 0.32 });
        }
      }
      this.skeletonDebug.circle(point.x, point.y, 2.2).fill({ color: 0xfff08a, alpha: 0.5 });
    });
  }
}

class RealParticleEmitter {
  private readonly data: ParticleSystemData;
  private readonly root: EffectRootData;
  private readonly placementProvider: () => RootPlacement;
  private readonly textures: TextureMap;
  private readonly frameCache: Map<string, Texture[]>;
  private readonly meshes: Map<number, EffectMeshData>;
  private readonly geometryCache: Map<string, MeshGeometry>;
  private readonly nodeStateProvider: (path: string) => EffectNodeRuntimeState | undefined;
  private readonly rng: () => number;
  private readonly particles: RuntimeParticle[] = [];
  private emitRemainder = 0;
  private lastLocalTime = -0.000001;
  private debugLocalTime = 0;
  private emitAttempts = 0;
  private emittedParticles = 0;
  private skippedReason = '';
  private prewarmed = false;

  constructor(
    data: ParticleSystemData,
    root: EffectRootData,
    placementProvider: () => RootPlacement,
    textures: TextureMap,
    frameCache: Map<string, Texture[]>,
    meshes: Map<number, EffectMeshData>,
    geometryCache: Map<string, MeshGeometry>,
    nodeStateProvider: (path: string) => EffectNodeRuntimeState | undefined,
  ) {
    this.data = data;
    this.root = root;
    this.placementProvider = placementProvider;
    this.textures = textures;
    this.frameCache = frameCache;
    this.meshes = meshes;
    this.geometryCache = geometryCache;
    this.nodeStateProvider = nodeStateProvider;
    const fallbackSeed = hashString(`${root.name}:${data.path}:${data.pathId}`);
    const seed = data.particle.autoRandomSeed ? fallbackSeed : (data.particle.randomSeed ?? fallbackSeed);
    this.rng = makeRng(seed);
  }

  destroy() {
    this.particles.splice(0).forEach((particle) => particle.view.destroy());
  }

  update(container: Container, globalLocalTime: number, deltaSeconds: number) {
    const particleData = this.data.particle;
    const startDelay = Math.max(0, curveScalar(particleData.startDelay, 0));
    const localTime = Math.max(0, (globalLocalTime - startDelay) * particleData.simulationSpeed);
    const duration = Math.max(0.05, particleData.duration || 0.05);
    const systemProgress = particleData.looping
      ? ((localTime % duration) + duration) % duration / duration
      : clamp(localTime / duration, 0, 1);
    this.debugLocalTime = localTime;
    const hasBurstEmission = particleData.emission.bursts.some((burst) => burstCountScalar(burst.count, 0) > 0);
    const canEmit = particleData.emission.enabled || hasBurstEmission;
    if (globalLocalTime < startDelay || !canEmit) {
      if (globalLocalTime >= startDelay && !canEmit) this.skippedReason = 'emission disabled';
      this.updateParticles(deltaSeconds);
      return;
    }

    if (!this.prewarmed && particleData.prewarm && particleData.looping) {
      this.prewarm(container, duration);
    }

    this.emitBursts(container, localTime, duration);
    if (particleData.emission.enabled && (particleData.looping || localTime <= duration)) {
      this.emitRate(container, deltaSeconds, systemProgress);
    }
    this.lastLocalTime = localTime;
    this.updateParticles(deltaSeconds * particleData.simulationSpeed);
  }

  get activeParticleCount() {
    return this.particles.length;
  }

  debugSnapshot() {
    const meshId = this.data.renderer.meshPathIds.find((id) => id && this.meshes.has(id));
    const meshData = meshId ? this.meshes.get(meshId) : undefined;
    const bounds = this.particles.reduce<{ minX: number; maxX: number; minY: number; maxY: number } | undefined>(
      (current, particle) => {
        const { x, y } = particle.view;
        if (!current) return { minX: x, maxX: x, minY: y, maxY: y };
        current.minX = Math.min(current.minX, x);
        current.maxX = Math.max(current.maxX, x);
        current.minY = Math.min(current.minY, y);
        current.maxY = Math.max(current.maxY, y);
        return current;
      },
      undefined,
    );
    return {
      name: this.data.name,
      path: this.data.path,
      count: this.particles.length,
      meshName: meshData?.name,
      textureFile: this.data.renderer.texture?.file,
      bounds,
      localTime: this.debugLocalTime,
      lastLocalTime: this.lastLocalTime,
        textureLoaded: Boolean(this.data.renderer.texture && this.textures[effectTextureKey(this.data.renderer.texture)]),
        usesWeaponSprite: this.root.name.includes('swode_front_attach')
          && this.data.path.endsWith('/swode')
          && Boolean(this.textures.weaponSprite),
        scalingMode: this.data.particle.scalingMode,
      randomSeed: this.data.particle.randomSeed,
      autoRandomSeed: this.data.particle.autoRandomSeed,
      emitAttempts: this.emitAttempts,
      emittedParticles: this.emittedParticles,
      skippedReason: this.skippedReason || undefined,
      particles: this.particles.slice(0, 8).map((particle) => ({
        x: particle.view.x,
        y: particle.view.y,
        vx: particle.vx,
        vy: particle.vy,
        age: particle.age,
        life: particle.life,
        scaleX: particle.view.scale.x,
        scaleY: particle.view.scale.y,
        width: particle.view.width,
        height: particle.view.height,
        alpha: particle.view.alpha,
        tint: particle.view.tint,
        mesh: particle.view instanceof Mesh,
        fgoNobleBaseShader: particle.usesFgoNobleBaseShader,
        fgoNobleBaseMultiply: particle.usesFgoNobleBaseShader,
        rawSize: particle.rawSize,
        meshSizeAxes: particle.meshSizeAxes,
        renderScale: particle.meshRenderTransform?.scale,
        textureWidth: particle.quadTexture?.width,
        textureHeight: particle.quadTexture?.height,
        frameWidth: particle.frames[0]?.width,
        frameHeight: particle.frames[0]?.height,
        baseScaleX: particle.baseScaleX,
        baseScaleY: particle.baseScaleY,
      })),
    };
  }

  private get placement() {
    return this.placementProvider();
  }

  private get rootWorldTransform() {
    return this.nodeStateProvider(this.root.name)?.worldTransform ?? this.root.worldTransform;
  }

  private get currentLocalTransform() {
    return this.nodeStateProvider(this.data.path)?.localTransform ?? this.data.localTransform;
  }

  private get currentWorldTransform() {
    return this.nodeStateProvider(this.data.path)?.worldTransform ?? this.data.worldTransform;
  }

  private get currentUvOffset() {
    return this.nodeStateProvider(this.data.path)?.uvOffset ?? ([0, 0] as [number, number]);
  }

  private resolveParticleRenderTransform(): TransformData {
    const worldTransform = this.currentWorldTransform;
    const localTransform = this.currentLocalTransform;
    const rootScaleCorrection = this.placement.rootScaleCorrection ?? [1, 1, 1];
    const scalingMode = this.data.particle.scalingMode ?? 1;
    if (scalingMode === 0) {
      return {
        ...worldTransform,
        scale: multiplyVec3(worldTransform.scale, rootScaleCorrection),
      };
    }
    if (scalingMode === 2) {
      return {
        ...worldTransform,
        scale: [1, 1, 1],
      };
    }
    return {
      ...worldTransform,
      scale: localTransform.scale,
    };
  }

  private emitBursts(container: Container, localTime: number, duration: number) {
    this.data.particle.emission.bursts.forEach((burst, burstIndex) => {
      const cycles = Math.max(1, burst.cycleCount || 1);
      const repeat = Math.max(0.0001, burst.repeatInterval || duration);
      const loopCount = this.data.particle.looping ? Math.floor(localTime / duration) : 0;
      for (let loop = 0; loop <= loopCount; loop += 1) {
        const loopStart = this.data.particle.looping ? loop * duration : 0;
        for (let cycle = 0; cycle < cycles; cycle += 1) {
          const fireTime = loopStart + burst.time + repeat * cycle;
          if (!this.data.particle.looping && fireTime > duration) continue;
          if (fireTime <= this.lastLocalTime || fireTime > localTime) continue;
          if (this.rng() > burst.probability) continue;
          const systemProgress = clamp((fireTime - loopStart) / duration, 0, 1);
          const count = Math.round(clamp(burstCountScalarAt(burst.count, systemProgress, 1, this.rng), 0, 80));
          this.emit(container, count, burstIndex, systemProgress);
        }
      }
    });
  }

  private emitRate(container: Container, deltaSeconds: number, systemProgress: number) {
    const rate = clamp(curveScalarAt(this.data.particle.emission.rateOverTime, systemProgress, 0), 0, 240);
    if (rate <= 0) return;
    this.emitRemainder += rate * deltaSeconds;
    const count = Math.min(24, Math.floor(this.emitRemainder));
    if (count <= 0) return;
    this.emitRemainder -= count;
    this.emit(container, count, Math.floor(this.lastLocalTime * 30), systemProgress);
  }

  private emit(container: Container, count: number, salt: number, systemProgress: number) {
    this.emitAttempts += 1;
    if (count <= 0) return;
    const textureMeta = this.data.renderer.texture;
    if (!textureMeta) {
      this.skippedReason = 'missing texture metadata';
      return;
    }
    const texture = this.textures[effectTextureKey(textureMeta)];
    if (!texture) {
      this.skippedReason = `texture not loaded: ${textureMeta.file}`;
      return;
    }
    const frames = makeTextureFrames(texture, this.data.particle.uv, this.frameCache, textureMeta.file);
    const maxParticles = clamp(this.data.particle.maxParticles, 1, 260);
    const available = Math.max(0, maxParticles - this.particles.length);
    const emitCount = Math.min(count, available);
    for (let i = 0; i < emitCount; i += 1) {
      this.createParticle(container, texture, frames, salt + i, systemProgress);
    }
    this.emittedParticles += emitCount;
  }

  private prewarm(container: Container, duration: number) {
    const step = 1 / 120;
    this.lastLocalTime = -0.000001;
    this.emitRemainder = 0;

    for (let simulated = 0; simulated < duration; simulated += step) {
      const next = Math.min(duration, simulated + step);
      const delta = next - simulated;
      const progress = this.data.particle.looping
        ? ((next % duration) + duration) % duration / duration
        : clamp(next / duration, 0, 1);
      this.emitBursts(container, next, duration);
      if (this.data.particle.emission.enabled) {
        this.emitRate(container, delta, progress);
      }
      this.lastLocalTime = next;
      this.updateParticles(delta * this.data.particle.simulationSpeed);
    }

    // The real system starts a fresh visible cycle after prewarm.
    this.lastLocalTime = -0.000001;
    this.emitRemainder = 0;
    this.prewarmed = true;
  }

  private createParticle(
    container: Container,
    texture: Texture,
    frames: Texture[],
    salt: number,
    systemProgress: number,
  ) {
    const uvRandom = this.rng();
    const frameIndex = resolveUvFrameIndex(this.data.particle.uv, 0, frames.length, uvRandom);
    const frame = frames[frameIndex] ?? frames[0];
    if (!frame) return;

    const placement = this.placement;
    const position = this.resolveEmitterPosition(placement);
    this.applyShapeOffset(position, placement);

    const isFgoNobleBaseMaterial = usesFgoNobleBaseShader(this.data.renderer);
    const useFgoNobleBaseShaderForView = isFgoNobleBaseMaterial;
    const sampledStartColor = sampleStartColor(this.data.particle.startColor, systemProgress, this.rng);
    const startColor = multiplyColor(
      sampledStartColor,
      resolveMaterialColor(this.data.renderer),
    );
    const life = clamp(curveScalarAt(this.data.particle.startLifetime, systemProgress, 1, this.rng), 0.05, 12);
    const rawSize = sampleParticleStartSize(this.data.particle, systemProgress, this.rng);
    const speed = curveScalarAt(this.data.particle.startSpeed, systemProgress, 0, this.rng);
    const velocity = this.resolveInitialVelocity(speed, placement);
    const renderMode = this.data.renderer.renderMode;
    const renderAlignment = this.data.renderer.renderAlignment;
    const rendererLengthScale = Math.abs(this.data.renderer.lengthScale || 1);
    const rendererVelocityScale = Math.abs(this.data.renderer.velocityScale || 0);
    const pivot = this.data.renderer.pivot ?? [0, 0, 0];
    const useTransformAxisRotation = renderMode === 1 && Math.abs(speed) < 0.5;
    const particleRenderTransform = this.resolveParticleRenderTransform();
    const transformAxisRotation = this.resolveTransformAxisRotation(
      particleRenderTransform,
      placement,
    );
    const startRotationZ = sampleParticleStartRotationZ(this.data.particle, systemProgress, this.rng);
    const angularVelocity = sampleParticleAngularVelocityZ(this.data.particle, this.rng);
    const placementRotation = placement.rotation ?? 0;
    const transformRotation = quatZRotation(particleRenderTransform.rotation);
    const baseRotation = resolveParticleViewRotation(
      renderMode,
      renderAlignment,
      startRotationZ,
      placementRotation,
      transformRotation,
      velocity,
    );
    const velocityAligned = renderMode === 1
      && renderAlignment !== 1
      && renderAlignment !== 2
      && !useTransformAxisRotation;
    const rotationOffset = velocityAligned
      ? placementRotation + startRotationZ
      : baseRotation;

    let view: Sprite | Mesh;
    let baseScaleX: number;
    let baseScaleY: number;
    let quadTexture: Texture | undefined;
    let meshSizeAxes: Vec3 | undefined;
    let meshRenderTransform: TransformData | undefined;
    let meshParticleRotation: Quat | undefined;

    const meshId = this.data.renderer.meshPathIds.find((id) => id && this.meshes.has(id));
    const meshData = meshId ? this.meshes.get(meshId) : undefined;
    const blendMode = useFgoNobleBaseShaderForView
      ? resolveUnityStraightAlphaBlendMode(this.data.renderer)
      : resolveParticleBlendMode(this.data.renderer);
    const useWeaponSprite = (
      this.root.name.includes('swode_front_attach')
      && this.data.path.endsWith('/swode')
      && Boolean(this.textures.weaponSprite)
    );
    const viewPosition = useWeaponSprite
      ? { x: placement.x, y: placement.y }
      : position;
    const viewRotation = meshData && this.data.particle.rotation3D
      ? baseRotation - startRotationZ
      : baseRotation;

    if (useWeaponSprite) {
      const sprite = makeSprite(this.textures.weaponSprite!, 0.5, 0.2);
      view = sprite;
      baseScaleX = 0.52;
      baseScaleY = 0.52;
      quadTexture = this.textures.weaponSprite;
    } else if (meshData) {
      const frameIndex = resolveUvFrameIndex(this.data.particle.uv, 0, frames.length, uvRandom);
      const renderTransform = this.resolveParticleRenderTransform();
      const sizeAxes = meshParticleSizeAxes(
        this.root.name,
        this.data.name,
        meshData.name,
        this.data.particle,
        rawSize,
      );
      meshParticleRotation = this.data.particle.rotation3D
        ? quatFromUnityEulerRadians([
          curveScalarAt(this.data.particle.startRotationX, systemProgress, 0, this.rng),
          curveScalarAt(this.data.particle.startRotationY, systemProgress, 0, this.rng),
          startRotationZ,
        ])
        : [0, 0, 0, 1];
      const geometry = makeEffectMeshGeometry(
        this.root.name,
        meshData,
        this.data.particle.uv,
        frameIndex,
        this.geometryCache,
        renderTransform,
        sizeAxes,
        this.currentUvOffset,
        meshParticleRotation,
        placement,
      );
      const mesh = new Mesh({
        geometry,
        texture,
        shader: useFgoNobleBaseShaderForView
          ? getFgoNobleBaseShader(
            texture,
            fgoNobleOneValue(this.data.renderer),
            fgoNobleShaderVariant(this.data.renderer),
          )
          : getEffectMeshShader(texture),
      });
      const scale = meshParticleScale(
        this.root.name,
        meshData,
        this.data.renderer,
        placement,
        renderTransform,
        sizeAxes,
      );
      baseScaleX = scale.x;
      baseScaleY = scale.y;
      view = mesh;
      meshSizeAxes = sizeAxes;
      meshRenderTransform = renderTransform;
    } else if (useFgoNobleBaseShaderForView) {
      const frameIndex = resolveUvFrameIndex(this.data.particle.uv, 0, frames.length, uvRandom);
      const selectedFrame = frames[frameIndex] ?? frame;
      const geometry = makeFrameQuadGeometry(selectedFrame, this.geometryCache);
      const mesh = new Mesh({
        geometry,
        texture: selectedFrame,
        shader: getFgoNobleBaseShader(
          selectedFrame,
          fgoNobleOneValue(this.data.renderer),
          fgoNobleShaderVariant(this.data.renderer),
        ),
      });
      const size = spriteParticleSize(rawSize[0], placement);
      const scale = size / Math.max(1, Math.max(frame.width, frame.height));
      const localScale = this.currentLocalTransform.scale;
      const velocityStretch = 1 + (
        Math.hypot(velocity.x, velocity.y) * rendererVelocityScale / Math.max(size, 1)
      );
      const stretch = renderMode === 1
        ? clamp(Math.max(rendererLengthScale, Math.abs(localScale[2] || 1)) * velocityStretch, 1, 24)
        : 1;
      mesh.pivot.set(
        frame.width * clamp(pivot[0], -1, 2),
        frame.height * clamp(pivot[1], -1, 2),
      );
      baseScaleX = scale * stretch * transformAxisScale(localScale, 0);
      baseScaleY = scale * transformAxisScale(localScale, 1);
      view = mesh;
      quadTexture = texture;
    } else {
      const sprite = makeSprite(frame);
      const size = spriteParticleSize(rawSize[0], placement);
      const scale = size / Math.max(1, Math.max(frame.width, frame.height));
      const localScale = this.currentLocalTransform.scale;
      const velocityStretch = 1 + (
        Math.hypot(velocity.x, velocity.y) * rendererVelocityScale / Math.max(size, 1)
      );
      const stretch = renderMode === 1
        ? clamp(Math.max(rendererLengthScale, Math.abs(localScale[2] || 1)) * velocityStretch, 1, 24)
        : 1;
      sprite.anchor.set(
        clamp(0.5 - pivot[0], -1, 2),
        clamp(0.5 - pivot[1], -1, 2),
      );
      baseScaleX = scale * stretch * transformAxisScale(localScale, 0);
      baseScaleY = scale * transformAxisScale(localScale, 1);
      view = sprite;
    }

    view.x = viewPosition.x;
    view.y = viewPosition.y;
    const weaponRotation = placement.rotation ?? 0;
    view.rotation = useWeaponSprite
      ? weaponRotation
      : viewRotation;
    view.scale.set(baseScaleX, baseScaleY);
    view.alpha = useWeaponSprite ? 1 : clamp(startColor.a, 0, 1) * placement.alpha;
    view.tint = useWeaponSprite ? 0xffffff : colorToTint(startColor);
    view.blendMode = useWeaponSprite ? 'normal' : blendMode;
    view.zIndex = particleZIndex(this.data.renderer);
    container.addChild(view);

    this.particles.push({
      view,
      vx: velocity.x,
      vy: velocity.y,
      velocityX: velocity.x,
      velocityY: velocity.y,
      gravityX: 0,
      gravityY: 0,
      originX: viewPosition.x,
      originY: viewPosition.y,
      age: 0,
      life,
      baseScaleX,
      baseScaleY,
      baseAlpha: view.alpha,
      baseColor: startColor,
      angularVelocity,
      frames,
      quadTexture,
      meshData,
      rawSize,
      meshSizeAxes,
      meshRenderTransform,
      meshParticleRotation,
      uv: this.data.particle.uv,
      uvRandom,
      velocityOverLifetime: this.data.particle.velocity,
      sizeOverLifetime: this.data.particle.sizeOverLifetime,
      colorOverLifetime: this.data.particle.colorOverLifetime,
      renderMode,
      renderAlignment,
      rendererLengthScale,
      rendererVelocityScale,
      pivot,
      baseRotation: viewRotation,
      rotationOffset,
      velocityAligned,
      useTransformAxisRotation,
      transformAxisRotation,
      usesFgoNobleBaseShader: useFgoNobleBaseShaderForView,
      isWeaponSprite: useWeaponSprite,
      weaponRotation,
    });
  }

  private resolveEmitterPosition(placement: RootPlacement) {
    const staticRootPosition = this.root.worldTransform.position;
    const currentRootPosition = this.rootWorldTransform.position;
    const worldPosition = this.currentWorldTransform.position;
    const relative = multiplyVec3(addVec3(
      subtractVec3(worldPosition, currentRootPosition),
      subtractVec3(currentRootPosition, staticRootPosition),
    ), placement.rootScaleCorrection ?? [1, 1, 1]);
    const offset = projectEffectOffset(this.root.name, relative, placement);
    return {
      x: placement.x + offset.x,
      y: placement.y + offset.y,
    };
  }

  private applyShapeOffset(position: { x: number; y: number }, placement: RootPlacement) {
    const shape = this.data.particle.shape;
    if (!shape.enabled) return;

    let localOffset: Vec3 = [0, 0, 0];
    if (shape.type === 5 || shape.type === 8 || shape.type === 15 || shape.type === 16) {
      const xSize = Math.max(Math.abs(shape.scale[0]), shape.radius * 2, 0.0001);
      const ySize = Math.max(Math.abs(shape.scale[1]), shape.radius * 2, 0.0001);
      const zSize = Math.max(Math.abs(shape.scale[2]), shape.length, shape.radius * 2, 0.0001);
      localOffset = [
        (this.rng() - 0.5) * xSize,
        (this.rng() - 0.5) * ySize,
        (this.rng() - 0.5) * zSize,
      ];
    } else if (shape.radius > 0) {
      const angle = this.rng() * Math.PI * 2;
      const radius = Math.sqrt(this.rng()) * shape.radius;
      localOffset = [
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        (this.rng() - 0.5) * Math.max(shape.length, 0),
      ];
    }

    const local: Vec3 = [
      shape.position[0] + localOffset[0],
      shape.position[1] + localOffset[1],
      shape.position[2] + localOffset[2],
    ];
    const shapedLocal = quatRotate(
      quatFromUnityEulerDegrees(shape.rotation),
      local,
    );
    const currentWorldTransform = this.currentWorldTransform;
    const worldOffset = quatRotate(currentWorldTransform.rotation, [
      shapedLocal[0] * currentWorldTransform.scale[0] * (placement.rootScaleCorrection?.[0] ?? 1),
      shapedLocal[1] * currentWorldTransform.scale[1] * (placement.rootScaleCorrection?.[1] ?? 1),
      shapedLocal[2] * currentWorldTransform.scale[2] * (placement.rootScaleCorrection?.[2] ?? 1),
    ]);
    const offset = projectEffectOffset(this.root.name, worldOffset, placement);
    position.x += offset.x;
    position.y += offset.y;
  }

  private resolveInitialVelocity(speed: number, placement: RootPlacement) {
    const shape = this.data.particle.shape;
    if (!Number.isFinite(speed) || Math.abs(speed) < 0.000001) {
      return { x: 0, y: 0 };
    }

    // Unity still emits along the particle system's local +Z when the
    // Shape module is disabled; startSpeed is not equivalent to zero motion.
    const shapeDirection = shape.enabled
      ? sampleParticleDirection(shape, this.rng)
      : [0, 0, 1] as Vec3;
    const shapedDirection = quatRotate(
      quatFromUnityEulerDegrees(shape.rotation),
      shapeDirection,
    );
    const worldDirection = quatRotate(this.currentWorldTransform.rotation, shapedDirection);
    const meshId = this.data.renderer.meshPathIds.find((id) => id && this.meshes.has(id));
    const meshData = meshId ? this.meshes.get(meshId) : undefined;
    const projected = meshData
      ? projectEffectMeshOffset(
        this.root.name,
        worldDirection,
        placement,
        resolveEffectMeshHorizontalAxis(
          this.root.name,
          meshData,
          this.resolveParticleRenderTransform(),
          [1, 1, 1],
        ),
      )
      : projectEffectOffset(this.root.name, worldDirection, placement);
    const authoredVelocityScale = (
      meshData && this.root.name.includes('beam_light')
        ? meshScaleFactor(this.root.name, this.data.name, meshData.name)
        : 1
    );
    return {
      x: projected.x * speed * authoredVelocityScale,
      y: projected.y * speed * authoredVelocityScale,
    };
  }

  private resolveTransformAxisRotation(transform: TransformData, placement: RootPlacement) {
    const projected = projectEffectOffset(
      this.root.name,
      quatRotate(transform.rotation, [0, 0, 1]),
      placement,
    );
    if (Math.hypot(projected.x, projected.y) <= 0.000001) return 0;
    return Math.atan2(projected.y, projected.x);
  }

  private resolveLifetimeVelocity(particle: RuntimeParticle, progress: number, placement: RootPlacement) {
    const velocity = particle.velocityOverLifetime;
    if (!velocity.enabled) return { x: 0, y: 0 };

    const velocityVector: Vec3 = [
      curveScalarAt(velocity.x, progress, 0),
      curveScalarAt(velocity.y, progress, 0),
      curveScalarAt(velocity.z, progress, 0),
    ];
    const currentWorldTransform = this.currentWorldTransform;
    const worldVelocity = velocity.inWorldSpace
      ? velocityVector
      : quatRotate(currentWorldTransform.rotation, multiplyVec3(
        velocityVector,
        multiplyVec3(currentWorldTransform.scale, placement.rootScaleCorrection ?? [1, 1, 1]),
      ));
    const projected = projectEffectOffset(this.root.name, worldVelocity, placement);

    const radial = curveScalarAt(velocity.radial, progress, 0);
    if (radial !== 0) {
      const dx = particle.view.x - particle.originX;
      const dy = particle.view.y - particle.originY;
      const distance = Math.hypot(dx, dy) || 1;
      projected.x += (dx / distance) * radial * (placement.offsetScaleX ?? placement.scale);
      projected.y += (dy / distance) * radial * (placement.offsetScaleY ?? placement.scale);
    }

    const modifier = curveScalarAt(velocity.speedModifier, progress, 1);
    return {
      x: projected.x * modifier,
      y: projected.y * modifier,
    };
  }

  private updateParticles(deltaSeconds: number) {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const particle = this.particles[i];
      particle.age += deltaSeconds;
      const progress = particle.age / particle.life;
      if (progress >= 1) {
        particle.view.destroy();
        this.particles.splice(i, 1);
        continue;
      }

      const lifetimeVelocity = this.resolveLifetimeVelocity(particle, progress, this.placement);
      const gravityModifier = curveScalarAt(
        this.data.particle.gravityModifier,
        progress,
        0,
      );
      if (gravityModifier !== 0) {
        const gravity = projectEffectOffset(
          this.root.name,
          [0, -9.81 * gravityModifier * deltaSeconds, 0],
          this.placement,
        );
        particle.velocityX += gravity.x;
        particle.velocityY += gravity.y;
      }
      const frameVx = particle.velocityX + lifetimeVelocity.x;
      const frameVy = particle.velocityY + lifetimeVelocity.y;
      particle.view.x += frameVx * deltaSeconds;
      particle.view.y += frameVy * deltaSeconds;
      if (particle.isWeaponSprite) {
        particle.view.rotation = particle.weaponRotation;
        particle.view.scale.set(particle.baseScaleX, particle.baseScaleY);
        particle.view.alpha = 1;
        particle.view.tint = 0xffffff;
        continue;
      }
      if (particle.renderMode === 1) {
        particle.view.rotation = particle.velocityAligned
          ? Math.atan2(frameVy, frameVx) + particle.rotationOffset
          : particle.baseRotation;
      } else {
        particle.view.rotation += particle.angularVelocity * deltaSeconds;
      }

      const sizeScale = sampleParticleSizeOverLifetimeScale(particle.sizeOverLifetime, progress);
      const velocityStretch = particle.renderMode === 1
        ? 1 + (
          Math.hypot(frameVx, frameVy)
          * particle.rendererVelocityScale
          / Math.max(1, Math.max(particle.view.width, particle.view.height))
        )
        : 1;
      particle.view.scale.set(
        particle.baseScaleX * sizeScale.x * clamp(velocityStretch, 1, 24),
        particle.baseScaleY * sizeScale.y,
      );

      const lifetimeColor = particle.colorOverLifetime.enabled
        ? sampleGradientColor(particle.colorOverLifetime.gradient, progress, WHITE_COLOR)
        : WHITE_COLOR;
      particle.view.tint = colorToTint({
        r: particle.baseColor.r * lifetimeColor.r,
        g: particle.baseColor.g * lifetimeColor.g,
        b: particle.baseColor.b * lifetimeColor.b,
        a: particle.baseColor.a * lifetimeColor.a,
      });
      particle.view.alpha = particle.baseAlpha * lifetimeColor.a;
      if (particle.meshData && particle.view instanceof Mesh) {
        const frameIndex = particle.uv.enabled && particle.frames.length > 1
          ? resolveUvFrameIndex(particle.uv, progress, particle.frames.length, particle.uvRandom)
          : 0;
        particle.view.geometry = makeEffectMeshGeometry(
          this.root.name,
          particle.meshData,
          particle.uv,
          frameIndex,
          this.geometryCache,
          this.resolveParticleRenderTransform(),
          particle.meshSizeAxes ?? [1, 1, 1],
          this.currentUvOffset,
          particle.meshParticleRotation,
          this.placement,
        );
      } else if (
        particle.usesFgoNobleBaseShader
        && particle.view instanceof Mesh
        && particle.quadTexture
        && particle.uv.enabled
        && particle.frames.length > 1
      ) {
        const frameIndex = resolveUvFrameIndex(particle.uv, progress, particle.frames.length, particle.uvRandom);
        const frame = particle.frames[frameIndex] ?? particle.frames[0];
        if (frame) {
          particle.view.texture = frame;
          particle.view.shader = getFgoNobleBaseShader(
            frame,
            fgoNobleOneValue(this.data.renderer),
            fgoNobleShaderVariant(this.data.renderer),
          );
          particle.view.geometry = makeFrameQuadGeometry(frame, this.geometryCache);
        }
      } else if (particle.uv.enabled && particle.frames.length > 1) {
        const frameIndex = resolveUvFrameIndex(particle.uv, progress, particle.frames.length, particle.uvRandom);
        if (particle.view instanceof Sprite) {
          particle.view.texture = particle.frames[frameIndex];
        }
      }
    }
  }
}

class RealParticleEffect extends Container {
  private readonly root: EffectRootData;
  private readonly emitters: RealParticleEmitter[];
  private readonly placementProvider: () => RootPlacement;
  private readonly simpleAnimations: EffectSimpleAnimationData[];
  private readonly nodeStatesByPath = new Map<string, EffectNodeRuntimeState>();
  private readonly startTime: number;
  private readonly maxDuration: number;
  private manuallyStopped = false;

  constructor(
    root: EffectRootData,
    textures: TextureMap,
    frameCache: Map<string, Texture[]>,
    meshes: Map<number, EffectMeshData>,
    geometryCache: Map<string, MeshGeometry>,
    simpleAnimations: EffectSimpleAnimationData[],
    uvScrolls: EffectUvScrollData[],
    placementProvider: () => RootPlacement,
    startTime: number,
    emitterFilters: string[] = [],
  ) {
    super();
    this.root = root;
    this.placementProvider = placementProvider;
    this.simpleAnimations = simpleAnimations.filter((animation) => (
      animation.playAutomatically && isEffectPathUnderRoot(animation.path, root.name)
    ));
    this.startTime = startTime;
    this.sortableChildren = true;
    this.zIndex = rootZIndex(root);
    this.buildNodeStates(uvScrolls);
    this.applySimpleAnimations(0);
    const placement = this.placementProvider();
    this.alpha = placement.alpha;
    const particleSystems = root.particleSystems.filter((system) => {
      // This same-name final-ray system is the Unity root controller's
      // Burst/UV helper. It has no authored mesh and projects as a full-screen
      // gray quad in 2D; the child systems contain the visible ray assets.
      if (root.name === '100100_final_ray' && system.name === root.name) return false;
      return debugNameAllowed(emitterFilters, system.name) || debugNameAllowed(emitterFilters, system.path);
    });
    this.emitters = particleSystems.map((system) => (
      new RealParticleEmitter(
        system,
        root,
        this.placementProvider,
        textures,
        frameCache,
        meshes,
        geometryCache,
        (path) => this.nodeStatesByPath.get(path),
      )
    ));
    this.maxDuration = Math.max(
      ...particleSystems.map((system) => (
        (system.particle.looping ? 30 : system.particle.duration)
        + curveScalar(system.particle.startLifetime, 1)
        + curveScalar(system.particle.startDelay, 0)
      )),
      1,
    );
  }

  private buildNodeStates(uvScrolls: EffectUvScrollData[]) {
    const uvScrollByPath = new Map(uvScrolls.map((scroll) => [scroll.path, scroll.offset] as const));
    this.addNodeState(this.root.name, this.root.localTransform, this.root.worldTransform, uvScrollByPath);
    this.root.particleSystems.forEach((system) => {
      this.addNodeState(system.path, system.localTransform, system.worldTransform, uvScrollByPath);
    });
  }

  private addNodeState(
    path: string,
    localTransform: TransformData,
    worldTransform: TransformData,
    uvScrollByPath: Map<string, [number, number]>,
  ) {
    if (this.nodeStatesByPath.has(path)) return;
    const baseUvOffset = uvScrollByPath.get(path) ?? [0, 0];
    this.nodeStatesByPath.set(path, {
      path,
      parentPath: path === this.root.name ? undefined : parentEffectPath(path),
      baseLocalTransform: cloneTransform(localTransform),
      baseWorldTransform: cloneTransform(worldTransform),
      baseUvOffset: [baseUvOffset[0], baseUvOffset[1]],
      localTransform: cloneTransform(localTransform),
      worldTransform: cloneTransform(worldTransform),
      uvOffset: [baseUvOffset[0], baseUvOffset[1]],
    });
  }

  private resetNodeStates() {
    this.nodeStatesByPath.forEach((state) => {
      state.localTransform = cloneTransform(state.baseLocalTransform);
      state.worldTransform = cloneTransform(state.baseWorldTransform);
      state.uvOffset = [state.baseUvOffset[0], state.baseUvOffset[1]];
    });
  }

  private applySimpleAnimations(localTime: number) {
    this.resetNodeStates();
    this.simpleAnimations.forEach((animation) => {
      const clip = this.resolveSimpleAnimationClip(animation);
      if (!clip) return;
      const values = sampleAnimationScalars(clip, localTime, this.shouldLoopSimpleAnimation(animation));
      clip.bindings.forEach((binding) => {
        const targetPath = [
          binding.path,
          binding.path ? `${animation.path}/${binding.path}` : undefined,
          binding.pathHash === 0 ? animation.path : undefined,
        ].find((candidate) => candidate && this.nodeStatesByPath.has(candidate));
        if (!targetPath) return;
        const state = this.nodeStatesByPath.get(targetPath);
        if (!state) return;

        if (binding.attribute === 'uvOffsetX' || binding.attribute === 'uvOffsetY') {
          const value = values[binding.scalarOffset];
          if (typeof value !== 'number' || !Number.isFinite(value)) return;
          state.uvOffset[binding.attribute === 'uvOffsetX' ? 0 : 1] = value;
          return;
        }

        const triplet = readScalarTriplet(values, binding.scalarOffset);
        if (!triplet) return;
        if (binding.attribute === 'position') {
          state.localTransform.position = normalizeEffectClipPosition(triplet);
        } else if (binding.attribute === 'scale') {
          state.localTransform.scale = triplet;
        } else {
          state.localTransform.rotation = quatFromUnityEulerDegrees(triplet);
        }
      });
    });
    this.rebuildNodeWorldTransforms();
  }

  private resolveSimpleAnimationClip(animation: EffectSimpleAnimationData) {
    return animation.clips.find((clip) => clip.pathId === animation.clipPathId || clip.name === animation.clipName)
      ?? animation.clips[0];
  }

  private shouldLoopSimpleAnimation(animation: EffectSimpleAnimationData) {
    return animation.wrapMode === 2 || animation.wrapMode === 4;
  }

  private rebuildNodeWorldTransforms() {
    [...this.nodeStatesByPath.values()]
      .sort((left, right) => left.path.split('/').length - right.path.split('/').length)
      .forEach((state) => {
        const parentState = state.parentPath ? this.nodeStatesByPath.get(state.parentPath) : undefined;
        if (state.path === this.root.name) {
          state.worldTransform = cloneTransform(state.localTransform);
        } else if (parentState) {
          state.worldTransform = composeTransform(parentState.worldTransform, state.localTransform);
        } else {
          state.worldTransform = cloneTransform(state.baseWorldTransform);
        }
      });
  }

  stop() {
    this.manuallyStopped = true;
    this.emitters.forEach((emitter) => emitter.destroy());
    this.destroy({ children: true });
  }

  update(globalTime: number, deltaSeconds: number) {
    if (this.manuallyStopped || this.destroyed) return false;
    const localTime = Math.max(0, globalTime - this.startTime);
    this.applySimpleAnimations(localTime);
    this.alpha = this.placementProvider().alpha;
    this.emitters.forEach((emitter) => emitter.update(this, localTime, deltaSeconds));
    const liveParticles = this.emitters.reduce((sum, emitter) => sum + emitter.activeParticleCount, 0);
    if (localTime > this.maxDuration && liveParticles <= 0) {
      this.stop();
      return false;
    }
    return true;
  }

  debugSnapshot() {
    return this.emitters.map((emitter) => emitter.debugSnapshot());
  }
}

class PixiCutsceneRuntime implements CutsceneRuntimeHandle {
  private readonly app: Application;
  private readonly host: HTMLElement;
  private readonly options: RuntimeOptions;
  private readonly textures: TextureMap;
  private readonly root = new Container();
  private readonly scene = new Container();
  private readonly bgLayer = new Container();
  private readonly actorLayer = new Container();
  private readonly effectLayer = new Container();
  private readonly rawEffectLayer = new Container();
  private readonly overlayLayer = new Container();
  private readonly cutInLayer = new Container();
  private readonly hero = new Container();
  private readonly flash = new Graphics();
  private readonly darkVeil = new Graphics();
  private cutInPortrait!: Sprite;
  private background50200!: Sprite;
  private backgroundField!: Sprite;
  private background90001Back!: Sprite;
  private background90001Front!: Sprite;
  private rawSwordGlow!: Sprite;
  private rawBeamCore!: Sprite;
  private rawFinalRayLine!: Sprite;
  private rawFinalRing!: Sprite;
  private rawSmokeRibbon!: Sprite;
  private rawFinalRay!: Sprite;
  private rawGoldBurst!: Sprite;
  private rawStormCloud!: Sprite;
  private rawGroundSmoke!: Sprite;
  private rawWhiteGlow!: Sprite;

  private readonly skinData: SkinData;
  private readonly effectData: EffectData;
  private readonly effectRootsByName = new Map<string, EffectRootData>();
  private readonly effectMeshesByPathId = new Map<number, EffectMeshData>();
  private readonly frameCache = new Map<string, Texture[]>();
  private readonly geometryCache = new Map<string, MeshGeometry>();
  private readonly activeEffects = new Map<string, RealParticleEffect[]>();
  private readonly rootAttachments = new Map<string, RootAttachment>();
  private readonly cutsceneActorsData: CutsceneActorsData;
  private readonly cutsceneActors = new Map<string, CutsceneActorRuntime>();
  private readonly debugRootFilters = readDebugNameFilter('fgoRoot');
  private readonly debugEmitterFilters = readDebugNameFilter('fgoEmitter');
  private heroActor!: SkinnedMeshActor;
  private readonly firedEventKeys = new Set<number>();
  private readonly firedEventLabels: string[] = [];

  private isDestroyed = false;
  private isPlaying = true;
  private speed = 1;
  private timelineScale = 1;
  private heroDisplayEnabled = true;
  private time = 0;
  private pendingPlaybackTime = 0;
  private currentAnim = 'wait02';
  private animStartTime = 0;
  private animDuration = 1;
  private lastAnimEvent = 'none';
  private backgroundName = '50200';
  private cutIn: CutInState | null = null;
  private shake: ShakeState | null = null;
  private flashDisplay: FadeState | null = null;
  private fadeDisplay: FadeState | null = { startTime: 0, duration: 1, fromAlpha: 1, toAlpha: 0 };

  constructor(
    app: Application,
    host: HTMLElement,
    textures: TextureMap,
    skinData: SkinData,
    effectData: EffectData,
    cutsceneActorsData: CutsceneActorsData,
    options: RuntimeOptions,
  ) {
    this.app = app;
    this.host = host;
    this.textures = textures;
    this.skinData = skinData;
    this.effectData = effectData;
    this.cutsceneActorsData = cutsceneActorsData;
    this.options = options;
    this.speed = options.speed ?? 1;
    this.isPlaying = options.autoplay ?? true;
    this.effectData.roots.forEach((root) => this.effectRootsByName.set(root.name, root));
    this.effectData.meshes.forEach((mesh) => this.effectMeshesByPathId.set(mesh.pathId, mesh));

    this.app.stage.addChild(this.root);
    this.root.addChild(this.scene, this.overlayLayer);
    this.scene.addChild(this.bgLayer, this.actorLayer, this.effectLayer, this.rawEffectLayer);
    this.actorLayer.addChild(this.hero);
    this.effectLayer.sortableChildren = true;
    this.rawEffectLayer.sortableChildren = true;
    this.overlayLayer.addChild(this.cutInLayer, this.darkVeil, this.flash);

    this.buildStage();
    this.buildRawAssetEffects();
    if (this.options.effectsOnly) {
      this.bgLayer.visible = false;
      this.actorLayer.visible = false;
    }
    this.resize();
    this.fireDueEvents();
    this.app.ticker.add(this.tick);
    this.reportStatus();
  }

  play = () => {
    this.isPlaying = true;
    this.reportStatus();
  };

  pause = () => {
    this.isPlaying = false;
    this.reportStatus();
  };

  replay = () => {
    this.resetPlaybackState();
    this.isPlaying = true;
    this.fireDueEvents();
    this.reportStatus();
  };

  seek = (time: number) => {
    const targetTime = clamp(time, 0, this.effectData.duration);
    this.resetPlaybackState();
    this.isPlaying = false;
    this.fireDueEvents();

    this.advanceTo(targetTime);
    this.reportStatus();
  };

  private advanceTo(targetTime: number) {
    while (this.time < targetTime) {
      const nextGridTime = (Math.floor(this.time * 120 + 1e-8) + 1) / 120;
      const nextEvent = this.effectData.timeline.find((event, index) => (
        !this.firedEventKeys.has(index) && event.time > this.time
      ));
      const nextTime = Math.min(targetTime, nextGridTime, nextEvent?.time ?? Infinity);
      const deltaSeconds = nextTime - this.time;
      this.time = nextTime;
      this.fireDueEvents();
      this.updateCamera();
      this.updateBackground();
      this.updateHero();
      this.updateCutsceneActors();
      this.updateRealEffects(deltaSeconds);
      this.updateOverlay();
    }
  }

  private resetPlaybackState() {
    this.time = 0;
    this.pendingPlaybackTime = 0;
    this.firedEventKeys.clear();
    this.firedEventLabels.length = 0;
    this.currentAnim = 'wait02';
    this.timelineScale = 1;
    this.heroDisplayEnabled = true;
    this.animStartTime = 0;
    this.animDuration = this.heroActor.animationDuration('wait02');
    this.rootAttachments.clear();
    this.resetCutsceneActors();
    this.shake = null;
    this.flashDisplay = null;
    this.fadeDisplay = { startTime: 0, duration: 1, fromAlpha: 1, toAlpha: 0 };
    this.setBackground('50200');
    this.cutIn = null;
    this.cutInPortrait.visible = false;
    this.clearTransientEffects();
  };

  setSpeed = (speed: number) => {
    this.speed = clamp(speed, 0.25, 2);
    this.reportStatus();
  };

  destroy = () => {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    const canvas = this.app.canvas;
    this.app.ticker.remove(this.tick);
    this.clearTransientEffects();
    this.app.destroy({ removeView: true }, { children: true });
    if (canvas.parentElement === this.host) {
      canvas.remove();
    }
  };

  private readonly tick = (ticker: Ticker) => {
    if (this.isDestroyed) return;
    this.resize();
    const deltaSeconds = ticker.deltaMS / 1000;
    if (this.isPlaying) {
      this.pendingPlaybackTime += deltaSeconds * this.speed * this.timelineScale;
      // Consume wall time on a fixed grid shared with seeking. Paused frames
      // must not emit or age particles.
      while (this.pendingPlaybackTime >= 1 / 120 && this.isPlaying) {
        this.pendingPlaybackTime -= 1 / 120;
        const nextGridTime = (Math.floor(this.time * 120 + 1e-8) + 1) / 120;
        this.advanceTo(Math.min(this.effectData.duration, nextGridTime));
        if (this.time >= this.effectData.duration) this.isPlaying = false;
      }
    }

    this.updateCamera();
    this.updateBackground();
    this.updateHero();
    this.updateCutsceneActors();
    this.updateOverlay();
    this.reportStatus();
  };

  private buildStage() {
    this.buildBackground();
    this.buildHero();
    this.buildCutsceneActors();
    this.buildCutIn();
  }

  private buildRawAssetEffects() {
    this.rawSwordGlow = makeSprite(requireTexture(this.textures, 'swordGlow'), 0.5, 0.08);
    this.rawSwordGlow.position.set(674, 135);
    this.rawSwordGlow.rotation = -Math.PI / 2;
    this.rawSwordGlow.scale.set(1.15);
    this.rawSwordGlow.tint = 0xffefb2;
    this.rawSwordGlow.blendMode = 'add';
    this.rawSwordGlow.zIndex = 19;

    this.rawBeamCore = makeSprite(requireTexture(this.textures, 'beamCore'));
    this.rawBeamCore.position.set(640, 280);
    this.rawBeamCore.scale.set(3.02, 0.76);
    this.rawBeamCore.tint = 0x8cecff;
    this.rawBeamCore.blendMode = 'add';
    this.rawBeamCore.zIndex = 20;

    this.rawFinalRay = makeSprite(requireTexture(this.textures, 'beamCore'));
    this.rawFinalRay.position.set(365, 420);
    this.rawFinalRay.rotation = Math.PI / 2;
    this.rawFinalRay.scale.set(1.22, 1.84);
    this.rawFinalRay.tint = 0xfff1bd;
    this.rawFinalRay.blendMode = 'add';
    this.rawFinalRay.zIndex = 50;

    this.rawFinalRayLine = makeSprite(requireTexture(this.textures, 'goldLine'));
    this.rawFinalRayLine.position.set(365, 420);
    this.rawFinalRayLine.rotation = Math.PI / 2;
    this.rawFinalRayLine.scale.set(2.2, 2.0);
    this.rawFinalRayLine.tint = 0xffffdf;
    this.rawFinalRayLine.blendMode = 'add';
    this.rawFinalRayLine.zIndex = 51;

    this.rawFinalRing = makeSprite(requireTexture(this.textures, 'rainbowRing'));
    this.rawFinalRing.position.set(365, 625);
    this.rawFinalRing.scale.set(1.85);
    this.rawFinalRing.tint = 0xffe5a4;
    this.rawFinalRing.blendMode = 'add';
    this.rawFinalRing.zIndex = 52;

    this.rawSmokeRibbon = makeSprite(requireTexture(this.textures, 'smokeRibbon'));
    this.rawSmokeRibbon.position.set(640, 600);
    this.rawSmokeRibbon.scale.set(1.25, 1.65);
    this.rawSmokeRibbon.alpha = 0;
    this.rawSmokeRibbon.zIndex = 42;

    this.rawWhiteGlow = makeSprite(requireTexture(this.textures, 'whiteGlow'));
    this.rawWhiteGlow.position.set(365, 425);
    this.rawWhiteGlow.scale.set(3.2, 5.4);
    this.rawWhiteGlow.tint = 0xfff6cf;
    this.rawWhiteGlow.blendMode = 'add';
    this.rawWhiteGlow.zIndex = 49;

    this.rawStormCloud = makeSprite(requireTexture(this.textures, 'stormCloud'));
    this.rawStormCloud.position.set(640, 120);
    this.rawStormCloud.scale.set(1.25, 1.35);
    this.rawStormCloud.zIndex = 40;

    this.rawGroundSmoke = makeSprite(requireTexture(this.textures, 'groundSmoke'));
    this.rawGroundSmoke.position.set(640, 650);
    this.rawGroundSmoke.scale.set(1.25, 1.4);
    this.rawGroundSmoke.tint = 0xffffff;
    this.rawGroundSmoke.zIndex = 41;

    this.rawGoldBurst = makeSprite(requireTexture(this.textures, 'goldBurst'), 0.5, 0.82);
    this.rawGoldBurst.position.set(365, 625);
    this.rawGoldBurst.scale.set(2.7);
    this.rawGoldBurst.tint = 0xffe59b;
    this.rawGoldBurst.blendMode = 'add';
    this.rawGoldBurst.zIndex = 60;

    this.rawEffectLayer.addChild(
      this.rawSwordGlow,
      this.rawStormCloud,
      this.rawGroundSmoke,
      this.rawSmokeRibbon,
      this.rawBeamCore,
      this.rawWhiteGlow,
      this.rawFinalRay,
      this.rawFinalRayLine,
      this.rawFinalRing,
      this.rawGoldBurst,
    );
    this.updateRawAssetEffects();
  }

  private resize() {
    const scale = Math.min(this.app.screen.width / DESIGN_WIDTH, this.app.screen.height / DESIGN_HEIGHT);
    this.root.scale.set(scale);
    this.root.x = (this.app.screen.width - DESIGN_WIDTH * scale) / 2;
    this.root.y = (this.app.screen.height - DESIGN_HEIGHT * scale) / 2;
  }

  private buildBackground() {
    if (readDebugFlag('fgoHideBackground')) return;
    this.background50200 = makeSprite(requireTexture(this.textures, 'bg50200'), 0, 0);
    this.background50200.width = DESIGN_WIDTH;
    this.background50200.height = DESIGN_HEIGHT;

    this.backgroundField = makeSprite(requireTexture(this.textures, 'fieldBg'));
    this.backgroundField.position.set(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2);
    this.backgroundField.scale.set(
      Math.max(
        DESIGN_WIDTH / this.backgroundField.texture.width,
        DESIGN_HEIGHT / this.backgroundField.texture.height,
      ),
    );

    this.background90001Back = makeSprite(requireTexture(this.textures, 'bg90001Back'));
    this.background90001Back.position.set(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2);
    this.background90001Back.scale.set(
      Math.max(
        DESIGN_WIDTH / this.background90001Back.texture.width,
        DESIGN_HEIGHT / this.background90001Back.texture.height,
      ),
    );
    this.background90001Back.alpha = 1;

    this.background90001Front = makeSprite(requireTexture(this.textures, 'bg90001Front'));
    this.background90001Front.position.set(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2);
    this.background90001Front.scale.set(
      Math.max(
        DESIGN_WIDTH / this.background90001Front.texture.width,
        DESIGN_HEIGHT / this.background90001Front.texture.height,
      ),
    );
    this.background90001Front.alpha = 0.9;
    this.background90001Front.blendMode = 'add';

    this.bgLayer.addChild(
      this.background50200,
      this.backgroundField,
      this.background90001Back,
      this.background90001Front,
    );
    this.setBackground('50200');
  }

  private setBackground(bgName: string) {
    const normalized = bgName === '90001' ? '90001' : '50200';
    // The reference cutscene keeps the scrolling battle backdrop through
    // the charge, beam, and final-ray sequence; the authored 50200 event at
    // 2.776s is a transient engine reset that should not hide it here.
    if (normalized === '50200' && this.time >= 1.641481637954712 && this.time < 17) {
      this.backgroundName = '90001';
      this.background50200.visible = false;
      this.backgroundField.visible = true;
      this.background90001Back.visible = false;
      this.background90001Front.visible = false;
      return;
    }
    this.backgroundName = normalized;
    const isScrolling = normalized === '90001';
    this.background50200.visible = !isScrolling;
    this.backgroundField.visible = isScrolling;
    this.background90001Back.visible = false;
    this.background90001Front.visible = false;
  }

  private updateBackground() {
    if (!this.background90001Back || !this.background90001Front) return;
    this.bgLayer.visible = this.options.effectsOnly
      ? false
      : this.options.renderBackground?.(this.time) ?? true;
    this.background90001Back.x = DESIGN_WIDTH / 2 + Math.sin(this.time * 0.12) * 4;
    this.background90001Front.x = DESIGN_WIDTH / 2 + Math.sin(this.time * 0.2) * 8;
  }

  private buildHero() {
    this.hero.x = 420;
    this.hero.y = 606;
    this.hero.scale.set(0.88);
    this.heroActor = new SkinnedMeshActor(this.skinData, requireTexture(this.textures, 'servantAtlas'));
    this.hero.addChild(this.heroActor);
  }

  private buildCutsceneActors() {
    this.cutsceneActorsData.actors.forEach((actorData) => {
      const container = new Container();
      container.visible = false;
      container.x = 640;
      container.y = 606;
      container.scale.set(0.88);

      const actor = new SkinnedMeshActor(
        actorData,
        requireTexture(this.textures, effectTextureFileKey(actorData.texture)),
      );
      actor.setModelEvolution(-1);
      container.addChild(actor);
      this.actorLayer.addChild(container);
      this.cutsceneActors.set(actorData.name, {
        container,
        actor,
        currentAnim: 'treasureArms4_a',
        animStartTime: 0,
        animDuration: actor.animationDuration('treasureArms4_a'),
        playbackSpeed: 1,
        activeUntil: 0,
        evolutionLevel: -1,
        colorChanges: [],
      });
    });
  }

  private buildCutIn() {
    this.cutInPortrait = makeSprite(requireTexture(this.textures, 'portraitFace'));
    this.cutInPortrait.position.set(DESIGN_WIDTH + 180, 235);
    this.cutInPortrait.scale.set(2.5);
    this.cutInPortrait.alpha = 0;
    this.cutInPortrait.visible = false;
    this.cutInLayer.addChild(this.cutInPortrait);
  }

  private fireDueEvents() {
    this.effectData.timeline.forEach((event, index) => {
      if (this.firedEventKeys.has(index) || event.time > this.time) return;
      this.firedEventKeys.add(index);
      this.firedEventLabels.unshift(`${event.time.toFixed(3)} ${eventLabel(event)}`);
      this.firedEventLabels.splice(10);
      this.applyEvent(event);
    });
  }

  private applyEvent(event: EffectTimelineEvent) {
    if (event.type === 'changeBg') {
      this.setBackground(event.bgName ?? '50200');
      return;
    }

    if (event.type === 'timeScale') {
      this.timelineScale = Math.max(0.001, event.targetTimeScale ?? 1);
      return;
    }

    if (event.type === 'modelEvolution') {
      const level = event.evolutionLevel ?? -1;
      this.cutsceneActors.forEach((actorState) => {
        actorState.evolutionLevel = level;
        actorState.actor.setModelEvolution(level);
      });
      return;
    }

    if (event.type === 'displayChange') {
      this.applyCharacterDisplayChange(event.displayTarget ?? 0, Boolean(event.displayEnabled));
      return;
    }

    if (event.type === 'animation') {
      const animationName = event.animationName;
      const cutsceneActor = this.cutsceneActors.get(event.target);
      if (cutsceneActor && animationName) {
        this.playCutsceneActorAnimation(cutsceneActor, animationName, event);
        return;
      }

      if (animationName && this.heroActor.hasAnimation(animationName)) {
        this.currentAnim = animationName;
        this.animStartTime = this.time + (event.startTime ?? 0);
        this.animDuration = this.heroActor.animationDuration(animationName) / Math.max(0.001, event.playbackSpeed ?? 1);
        this.lastAnimEvent = animationName;
      } else if (animationName) {
        this.lastAnimEvent = `${animationName} (missing local clip)`;
      }
      return;
    }

    if (event.type === 'targetAnimation') {
      const targetActor = event.animationTarget === 6
        ? this.cutsceneActors.get('chr_100101')
        : undefined;
      if (targetActor && event.animationName) {
        this.playCutsceneActorAnimation(targetActor, event.animationName, event);
      }
      return;
    }

    if (event.type === 'playEffect') {
      this.spawnRealEffect(event.target);
      return;
    }

    if (event.type === 'setEnabled') {
      const cutsceneActor = this.cutsceneActors.get(event.target);
      if (cutsceneActor) {
        // From the hit phase onward, chr_100101 is the battle target proxy.
        // Unity disables the staging object while the battle actor remains on
        // screen, so keep the extracted target visible for the web replay.
        if (event.target === 'chr_100101' && !event.enabled && event.time >= 11.6) {
          return;
        }
        cutsceneActor.container.visible = Boolean(event.enabled);
        if (!event.enabled) cutsceneActor.activeUntil = 0;
        return;
      }

      if (event.enabled) {
        this.spawnRealEffect(event.target);
      } else {
        this.stopEffects(event.target);
      }
      return;
    }

    if (event.type === 'colorChange') {
      this.applyColorChangeEvent(event);
      return;
    }

    if (event.type === 'attach') {
      if (event.target && event.nodeName) {
        this.rootAttachments.set(event.target, {
          target: event.target,
          parentObjectName: event.parentObjectName ?? '',
          nodeName: event.nodeName,
          tposition: unityVec3ObjectToVec3(event.tposition),
          trotation: unityVec3ObjectToVec3(event.trotation),
          tscale: unityVec3ObjectToVec3(event.tscale, [1, 1, 1]),
        });
      }
      return;
    }

    if (event.type === 'fade') {
      const fadeCurve = Array.isArray(event.fadeCurve)
        ? event.fadeCurve
        : event.fadeCurve?.m_Curve;
      this.fadeDisplay = {
        startTime: this.time,
        duration: Math.max(0.05, event.duration || 0.05),
        fromAlpha: 1,
        toAlpha: 0,
        curve: fadeCurve,
      };
      return;
    }

    if (event.type === 'shake') {
      const size = Math.max(event.horizontalShakeSize ?? 0, event.verticalShakeSize ?? 0);
      this.shake = { startTime: this.time, duration: Math.max(0.05, event.duration), power: clamp(size * 120, 2, 40) };
      return;
    }

    if (event.type === 'standardCutIn') {
      this.flashDisplay = { startTime: this.time, duration: 0.12, fromAlpha: 0.35, toAlpha: 0 };
      this.cutIn = { startTime: this.time, duration: 0.72 };
    }
  }

  private spawnRealEffect(rootName: string) {
    if (!debugNameAllowed(this.debugRootFilters, rootName)) return;
    const root = this.effectRootsByName.get(rootName);
    if (!root) return;
    this.stopEffects(rootName);
    const simpleAnimations = (this.effectData.simpleAnimations ?? [])
      .filter((animation) => isEffectPathUnderRoot(animation.path, rootName));
    const uvScrolls = (this.effectData.uvScrolls ?? [])
      .filter((scroll) => isEffectPathUnderRoot(scroll.path, rootName));
    const effect = new RealParticleEffect(
      root,
      this.textures,
      this.frameCache,
      this.effectMeshesByPathId,
      this.geometryCache,
      simpleAnimations,
      uvScrolls,
      () => this.resolveEffectPlacement(rootName),
      this.time,
      this.debugEmitterFilters,
    );
    this.effectLayer.addChild(effect);
    this.activeEffects.set(rootName, [effect]);
  }

  private playCutsceneActorAnimation(actorState: CutsceneActorRuntime, animationName: string, event: EffectTimelineEvent) {
    if (!actorState.actor.hasAnimation(animationName)) {
      this.lastAnimEvent = `${event.target}:${animationName} (missing local clip)`;
      return;
    }

    const playbackSpeed = Math.max(0.001, event.playbackSpeed ?? 1);
    actorState.currentAnim = animationName;
    actorState.animStartTime = this.time + (event.startTime ?? 0);
    actorState.animDuration = actorState.actor.animationDuration(animationName) / playbackSpeed;
    actorState.playbackSpeed = playbackSpeed;
    actorState.activeUntil = this.time + Math.max(0.05, (event.stopTime && event.stopTime > 0)
      ? event.stopTime / playbackSpeed
      : actorState.animDuration);
    // chr_100101 receives its battle-target animation before the target is
    // revealed by the sequence. Keep the staging mesh hidden until the
    // original display-change event at 11.59s.
    if (!(event.target === 'chr_100101' && this.time < 11.59)) {
      actorState.container.visible = true;
    }
    this.lastAnimEvent = `${event.target}:${animationName}`;
  }

  private resolveEffectPlacement(rootName: string): RootPlacement {
    const root = this.effectRootsByName.get(rootName);
    if (!root) {
      return { x: 640, y: 360, scale: 44, alpha: 1 };
    }
    const base = this.resolveRootPlacement(root);
    const attachment = this.rootAttachments.get(rootName);
    if (!attachment) return base;

    const attachedPoint = this.resolveAttachedActorPoint(attachment);
    if (!attachedPoint) return base;

    return {
      ...base,
      x: attachedPoint.x,
      y: attachedPoint.y,
      rotation: attachedPoint.rotation,
      rootScaleCorrection: [
        Math.abs(root.worldTransform.scale[0]) > 0.00001
          ? 1 / root.worldTransform.scale[0]
          : 1,
        Math.abs(root.worldTransform.scale[1]) > 0.00001
          ? 1 / root.worldTransform.scale[1]
          : 1,
        Math.abs(root.worldTransform.scale[2]) > 0.00001
          ? 1 / root.worldTransform.scale[2]
          : 1,
      ],
    };
  }

  private resolveRootPlacement(root: EffectRootData): RootPlacement {
    const fallback = inferRootPlacement(root);
    if (
      root.name.includes('cutin')
      || root.name.includes('black')
      || root.name.includes('start_bg')
    ) {
      return fallback;
    }

    if (root.name === '100100_final_ray') {
      return sceneRootPlacement(root);
    }

    return fallback;
  }

  private resolveAttachedActorPoint(attachment: RootAttachment) {
    const owner = this.resolveAttachmentOwner(attachment.parentObjectName);
    const attachmentRotation = quatFromUnityEulerDegrees(attachment.trotation);
    const attachmentOffset = quatRotate(
      attachmentRotation,
      attachment.tposition,
    );
    const point = resolveAttachmentNodeIdentifiers(attachment.nodeName)
      .map((identifier) => owner.actor.projectNode(identifier, attachmentOffset))
      .find((candidate) => candidate !== null);
    if (!point) return null;

    return {
      x: owner.container.x + point.x * owner.container.scale.x,
      y: owner.container.y + point.y * owner.container.scale.y,
      rotation: owner.container.rotation + point.rotation + quatZRotation(attachmentRotation),
    };
  }

  private resolveAttachmentOwner(parentObjectName: string) {
    const cutsceneActor = parentObjectName ? this.cutsceneActors.get(parentObjectName) : undefined;
    if (cutsceneActor) {
      return { actor: cutsceneActor.actor, container: cutsceneActor.container };
    }
    return { actor: this.heroActor, container: this.hero };
  }

  private applyColorChangeEvent(event: EffectTimelineEvent) {
    const meshName = event.otherHierarchyPath?.split('/').pop();
    const color = event.fadeColour ?? WHITE_COLOR;
    const curve = event.fadeCurve ?? [
      { time: 0, value: 0 },
      { time: Math.max(0.001, event.duration), value: 0 },
    ];
    this.cutsceneActors.forEach((actorState, actorName) => {
      if (!event.otherHierarchyPath?.includes(actorName)) return;
      actorState.colorChanges.push({
        startTime: this.time,
        duration: Math.max(0.001, event.duration),
        meshName,
        color,
        curve,
      });
    });
  }

  private stopEffects(rootName: string) {
    const active = this.activeEffects.get(rootName);
    if (!active) return;
    active.forEach((effect) => effect.stop());
    this.activeEffects.delete(rootName);
  }

  private updateCamera() {
    let shakeX = 0;
    let shakeY = 0;
    if (this.shake) {
      const progress = (this.time - this.shake.startTime) / this.shake.duration;
      if (progress >= 1) {
        this.shake = null;
      } else {
        const power = this.shake.power * (1 - progress);
        shakeX = Math.sin(this.time * 78) * power;
        shakeY = Math.cos(this.time * 91) * power * 0.7;
      }
    }

    this.scene.scale.set(1);
    this.scene.x = shakeX;
    this.scene.y = shakeY;
  }

  private updateHero() {
    const localTime = Math.max(0, this.time - this.animStartTime);
    const externalTransform = this.options.getHeroTransform?.();
    this.hero.x = externalTransform?.x ?? 420;
    this.hero.y = externalTransform?.y ?? 606;
    this.hero.rotation = externalTransform?.rotation ?? 0;
    this.hero.scale.set(externalTransform?.scale ?? 0.88);
    this.hero.alpha = 1;
    this.actorLayer.visible = this.options.effectsOnly
      ? false
      : this.options.renderActors?.(this.time) ?? true;
    this.hero.visible = this.actorLayer.visible && this.heroDisplayEnabled && !this.hasVisibleCutsceneActor();
    this.heroActor.updatePose(localTime, this.currentAnim);
  }

  private updateCutsceneActors() {
    this.cutsceneActors.forEach((actorState) => {
      const externalTransform = this.options.getHeroTransform?.();
      if (externalTransform) {
        actorState.container.x = externalTransform.x;
        actorState.container.y = externalTransform.y;
        actorState.container.rotation = externalTransform.rotation ?? 0;
        actorState.container.scale.set(externalTransform.scale);
      } else {
        actorState.container.x = 640;
        actorState.container.y = 606;
        actorState.container.rotation = 0;
        actorState.container.scale.set(0.88);
      }
      if (actorState.container.visible && actorState.activeUntil > 0 && this.time > actorState.activeUntil) {
        actorState.container.visible = false;
      }
      if (!actorState.container.visible) return;
      const localTime = Math.max(0, this.time - actorState.animStartTime) * actorState.playbackSpeed;
      actorState.actor.updatePose(localTime, actorState.currentAnim);
      this.applyActorColorChanges(actorState);
    });
  }

  private applyActorColorChanges(actorState: CutsceneActorRuntime) {
    actorState.actor.setMeshTint(undefined, 0xffffff);
    actorState.colorChanges.forEach((change) => {
      const elapsed = this.time - change.startTime;
      if (elapsed < 0) return;
      const progress = clamp(elapsed / change.duration, 0, 1);
      const strength = sampleKeyCurve(
        change.curve.map((key) => ({
          time: key.time / Math.max(change.duration, 0.001),
          value: key.value,
        })),
        progress,
        0,
      );
      actorState.actor.setMeshTint(
        change.meshName,
        colorToTint(lerpColor(WHITE_COLOR, change.color, strength)),
      );
    });
  }

  private hasVisibleCutsceneActor() {
    for (const actorState of this.cutsceneActors.values()) {
      if (actorState.container.visible) return true;
    }
    return false;
  }

  private applyCharacterDisplayChange(target: number, enabled: boolean) {
    if (target === 0) {
      this.heroDisplayEnabled = enabled;
      return;
    }

    const actorName = target === 1 ? 'chr_100100' : target === 2 ? 'chr_100101' : undefined;
    if (!actorName) return;
    const actorState = this.cutsceneActors.get(actorName);
    if (!actorState) return;
    actorState.container.visible = enabled;
    actorState.activeUntil = enabled ? Number.POSITIVE_INFINITY : 0;
  }

  private resetCutsceneActors() {
    this.cutsceneActors.forEach((actorState) => {
      actorState.container.visible = false;
      actorState.currentAnim = 'treasureArms4_a';
      actorState.animStartTime = 0;
      actorState.animDuration = actorState.actor.animationDuration('treasureArms4_a');
      actorState.playbackSpeed = 1;
      actorState.activeUntil = 0;
      actorState.evolutionLevel = -1;
      actorState.colorChanges = [];
      actorState.actor.setMeshTint(undefined, 0xffffff);
      actorState.actor.setModelEvolution(-1);
      actorState.actor.updatePose(0, actorState.currentAnim);
    });
    this.hero.visible = true;
  }

  private updateRealEffects(deltaSeconds: number) {
    this.activeEffects.forEach((effects, rootName) => {
      for (let i = effects.length - 1; i >= 0; i -= 1) {
        const effect = effects[i];
        if (!effect.update(this.time, deltaSeconds)) {
          effects.splice(i, 1);
        }
      }
      if (!effects.length) this.activeEffects.delete(rootName);
    });
    this.updateRawAssetEffects();
  }

  private updateRawAssetEffects() {
    this.rawEffectLayer.visible = false;
    return;

    const swordProgress = clamp((this.time - 9.07) / 0.1, 0, 1);
    const swordFadeOut = clamp((10.16 - this.time) / 0.12, 0, 1);
    this.rawSwordGlow.visible = this.time >= 9.07 && this.time < 10.16;
    this.rawSwordGlow.alpha = easeOutCubic(swordProgress) * easeOutCubic(swordFadeOut) * 0.45;

    const beamProgress = clamp((this.time - 11.68) / 0.12, 0, 1);
    const beamFadeOut = clamp((13.484 - this.time) / 0.14, 0, 1);
    this.rawBeamCore.visible = this.time >= 11.68 && this.time < 13.484;
    this.rawBeamCore.alpha = easeOutCubic(beamProgress) * easeOutCubic(beamFadeOut) * 0.68;

    const rayProgress = clamp((this.time - 13.484) / 0.14, 0, 1);
    const rayFadeOut = clamp((17 - this.time) / 0.25, 0, 1);
    const rayAlpha = easeOutCubic(rayProgress) * easeOutCubic(rayFadeOut);
    this.rawFinalRay.visible = this.time >= 13.484 && this.time < 17;
    this.rawFinalRay.alpha = rayAlpha * 0.82;
    this.rawFinalRayLine.visible = this.rawFinalRay.visible;
    this.rawFinalRayLine.alpha = rayAlpha * 0.7;
    this.rawFinalRing.visible = this.rawFinalRay.visible;
    this.rawFinalRing.alpha = rayAlpha * 0.18;
    this.rawWhiteGlow.visible = false;
    this.rawWhiteGlow.alpha = 0;
    this.rawStormCloud.visible = this.rawFinalRay.visible;
    this.rawStormCloud.alpha = rayAlpha * 0.55;
    this.rawGroundSmoke.visible = this.rawFinalRay.visible;
    this.rawGroundSmoke.alpha = rayAlpha * 0.38;
    this.rawSmokeRibbon.visible = this.rawFinalRay.visible;
    this.rawSmokeRibbon.alpha = rayAlpha * 0.2;

    const burstProgress = clamp((this.time - 13.484) / 0.18, 0, 1);
    const burstFadeOut = clamp((14.7 - this.time) / 0.35, 0, 1);
    this.rawGoldBurst.visible = this.time >= 13.484 && this.time < 14.7;
    this.rawGoldBurst.alpha = easeOutCubic(burstProgress) * easeOutCubic(burstFadeOut) * 0.84;
    const pulse = 1 + Math.sin(Math.min(1, burstProgress) * Math.PI) * 0.18;
    this.rawGoldBurst.scale.set(2.7 * pulse);
  }

  private updateOverlay() {
    this.updateCutIn();
    this.flash.visible = false;
    if (this.flashDisplay) {
      const progress = (this.time - this.flashDisplay.startTime) / this.flashDisplay.duration;
      if (progress >= 1) {
        this.flashDisplay = null;
      } else {
        const alpha = lerp(this.flashDisplay.fromAlpha, this.flashDisplay.toAlpha, easeOutCubic(progress));
        this.flash.visible = true;
        this.flash.clear()
          .rect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT)
          .fill({ color: 0xffffff, alpha });
      }
    }

    this.darkVeil.clear();
    if (this.fadeDisplay) {
      const progress = (this.time - this.fadeDisplay.startTime) / this.fadeDisplay.duration;
      if (progress >= 1) {
        this.fadeDisplay = null;
      } else {
        const authoredValue = this.fadeDisplay.curve
          ? sampleKeyCurve(
            this.fadeDisplay.curve,
            progress,
            this.fadeDisplay.fromAlpha,
          )
          : lerp(this.fadeDisplay.fromAlpha, this.fadeDisplay.toAlpha, easeOutCubic(progress));
        const alpha = this.fadeDisplay.curve
          ? authoredValue
          : lerp(this.fadeDisplay.fromAlpha, this.fadeDisplay.toAlpha, authoredValue);
        this.darkVeil.rect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT)
          .fill({ color: 0xffffff, alpha });
      }
    }

  }

  private updateCutIn() {
    if (!this.cutIn || !this.cutInPortrait) return;
    const progress = (this.time - this.cutIn.startTime) / this.cutIn.duration;
    if (progress >= 1) {
      this.cutIn = null;
      this.cutInPortrait.visible = false;
      return;
    }

    const intro = easeOutCubic(progress / 0.2);
    const outro = easeOutCubic((progress - 0.56) / 0.44);
    this.cutInPortrait.visible = true;
    this.cutInPortrait.x = lerp(DESIGN_WIDTH + 180, 1010, intro);
    this.cutInPortrait.y = 235;
    this.cutInPortrait.alpha = clamp((1 - outro) * Math.min(1, progress / 0.08), 0, 1);
  }

  private clearTransientEffects() {
    this.activeEffects.forEach((effects) => {
      effects.forEach((effect) => effect.stop());
    });
    this.activeEffects.clear();
    this.effectLayer.removeChildren();
  }

  private resolvePhase() {
    if (this.time < 0.58) return 'target lock';
    if (this.time < 1.9) return 'cut-in';
    if (this.time < 4.64) return 'charge';
    if (this.time < 9.07) return 'release';
    if (this.time < 11.68) return 'duel';
    if (this.time < 13.48) return 'beam';
    if (this.time < 17.0) return 'final ray';
    return 'settle';
  }

  private reportStatus() {
    const includeWeaponDebug = readDebugFlag('fgoWeaponDebug');
    (window as CutsceneDebugWindow).__FGO_CUTSCENE_DEBUG__ = {
      seek: this.seek,
      time: this.time,
      backgroundName: this.backgroundName,
      backgroundStats: {
        backVisible: Boolean(this.background90001Back?.visible),
        frontVisible: Boolean(this.background90001Front?.visible),
        backAlpha: this.background90001Back?.alpha ?? 0,
        frontAlpha: this.background90001Front?.alpha ?? 0,
        backTexture: this.background90001Back
          ? { width: this.background90001Back.texture.width, height: this.background90001Back.texture.height }
          : undefined,
        frontTexture: this.background90001Front
          ? { width: this.background90001Front.texture.width, height: this.background90001Front.texture.height }
          : undefined,
      },
      currentAnim: this.currentAnim,
      animStartTime: this.animStartTime,
      animDuration: this.animDuration,
      lastAnimEvent: this.lastAnimEvent,
      heroVisible: this.hero.visible,
      heroMeshStats: includeWeaponDebug
        ? this.heroActor.debugMeshSnapshot(requireTexture(this.textures, 'servantAtlas'))
        : undefined,
      heroNodeStats: includeWeaponDebug
        ? ['joint_sword', 'joint_sword_EX'].flatMap((name) => {
          const point = this.heroActor.projectNode(name);
          return point ? [{ name, x: point.x, y: point.y, rotation: point.rotation }] : [];
        })
        : undefined,
      cutsceneActors: [...this.cutsceneActors.entries()].map(([name, actorState]) => ({
        name,
        visible: actorState.container.visible,
        animation: actorState.currentAnim,
      })),
      activeEffectRoots: [...this.activeEffects.keys()],
      activeEffectStats: [...this.activeEffects.entries()].map(([root, effects]) => ({
        root,
        emitters: effects.flatMap((effect) => effect.debugSnapshot()),
      })),
      rawAssetStats: {
        layerVisible: this.rawEffectLayer.visible,
        beam: {
          visible: this.rawBeamCore.visible,
          alpha: this.rawBeamCore.alpha,
          x: this.rawBeamCore.x,
          y: this.rawBeamCore.y,
          width: this.rawBeamCore.width,
          height: this.rawBeamCore.height,
        },
        finalRay: {
          visible: this.rawFinalRay.visible,
          alpha: this.rawFinalRay.alpha,
          x: this.rawFinalRay.x,
          y: this.rawFinalRay.y,
          width: this.rawFinalRay.width,
          height: this.rawFinalRay.height,
        },
      },
    };
    this.options.onStatus?.({
      time: this.time,
      duration: this.effectData.duration,
      phase: this.resolvePhase(),
      firedEvents: [...this.firedEventLabels],
      isPlaying: this.isPlaying,
    });
  }
}

async function loadEffectData(): Promise<EffectData> {
  const response = await fetch(EFFECT_DATA_URL);
  if (!response.ok) {
    throw new Error(`Failed to load effect data: ${response.status}`);
  }
  return await response.json() as EffectData;
}

async function loadCutsceneActorsData(): Promise<CutsceneActorsData> {
  const response = await fetch(CUTSCENE_ACTORS_DATA_URL);
  if (!response.ok) {
    throw new Error(`Failed to load cutscene actor data: ${response.status}`);
  }
  return await response.json() as CutsceneActorsData;
}

async function loadTextures(effectData: EffectData, cutsceneActorsData: CutsceneActorsData): Promise<TextureMap> {
  const effectTextureFiles = new Map<string, string>();
  effectData.textures.forEach((texture) => {
    effectTextureFiles.set(effectTextureFileKey(texture.file), texture.file);
  });
  cutsceneActorsData.actors.forEach((actor) => {
    effectTextureFiles.set(effectTextureFileKey(actor.texture), actor.texture);
  });

  const entries = await Promise.all([
  ...Object.entries(baseAssetFiles).map(async ([key, file]) => (
      [key, await Assets.load<Texture>(`${ASSET_ROOT}${file}`)] as const
    )),
    ...[...effectTextureFiles.entries()].map(async ([key, file]) => {
      const texture = await Assets.load<Texture>(`${ASSET_ROOT}${file}`);
      texture.source.addressMode = 'repeat';
      return [key, texture] as const;
    }),
  ]);
  return Object.fromEntries(entries) as TextureMap;
}

async function loadSkinData(): Promise<SkinData> {
  const response = await fetch(SKIN_DATA_URL);
  if (!response.ok) {
    throw new Error(`Failed to load skeleton data: ${response.status}`);
  }
  return await response.json() as SkinData;
}

const emptyRuntime: CutsceneRuntimeHandle = {
  play: () => undefined,
  pause: () => undefined,
  replay: () => undefined,
  seek: () => undefined,
  setSpeed: () => undefined,
  destroy: () => undefined,
};

export async function createCutsceneDemoRuntime(
  host: HTMLElement,
  options: RuntimeOptions = {},
): Promise<CutsceneRuntimeHandle> {
  const app = new Application();
  await app.init({
    antialias: true,
    autoDensity: true,
    backgroundAlpha: 0,
    preference: 'webgl',
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    resizeTo: host,
  });

  if (options.shouldAttach && !options.shouldAttach()) {
    app.destroy({ removeView: true }, { children: true });
    return emptyRuntime;
  }

  const [skinData, effectData, cutsceneActorsData] = await Promise.all([
    loadSkinData(),
    loadEffectData(),
    loadCutsceneActorsData(),
  ]);
  const textures = await loadTextures(effectData, cutsceneActorsData);
  if (options.shouldAttach && !options.shouldAttach()) {
    app.destroy({ removeView: true }, { children: true });
    return emptyRuntime;
  }

  app.canvas.style.width = '100%';
  app.canvas.style.height = '100%';
  app.canvas.style.display = 'block';
  host.replaceChildren(app.canvas);

  return new PixiCutsceneRuntime(app, host, textures, skinData, effectData, cutsceneActorsData, options);
}
