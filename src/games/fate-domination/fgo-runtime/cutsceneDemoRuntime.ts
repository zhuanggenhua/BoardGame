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
