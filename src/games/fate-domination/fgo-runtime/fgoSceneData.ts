import type {
  EffectMaterialData, TransformData, CurveData, CurveKeyData, CompressedAnimationData,
  EffectData as LegacyEffectData, EffectRootData as LegacyEffectRootData,
  ParticleSystemData as LegacyParticleSystemData, EffectMeshData as LegacyEffectMeshData,
  SkinData as LegacySkinData, SkinAnimation as LegacySkinAnimation,
} from './cutsceneDemoRuntime';

export type {
  CutsceneActorsData, TransformData, CurveData, CurveKeyData,
  ColorData, GradientData, EffectMaterialData, EffectTimelineEvent, CompressedAnimationData,
} from './cutsceneDemoRuntime';

export type Vec3 = [number, number, number];
export type SkinAnimation = Omit<LegacySkinAnimation, 'bindings'> & {
  bindings: Array<Omit<LegacySkinAnimation['bindings'][number], 'attribute'> & {
    attribute: 'position' | 'scale' | 'euler' | 'quaternion';
  }>;
};
export type SkinData = Omit<LegacySkinData, 'animations'> & { animations?: SkinAnimation[] };
export type SourceMeshId = number | string;
export type ParticleSystemData = Omit<LegacyParticleSystemData, 'renderer'> & {
  renderer: Omit<LegacyParticleSystemData['renderer'], 'meshPathIds'> & { meshPathIds: SourceMeshId[] };
};
export type EffectMeshData = Omit<LegacyEffectMeshData, 'pathId'> & { pathId: SourceMeshId };
export type EffectRootData = Omit<LegacyEffectRootData, 'particleSystems'> & { particleSystems: ParticleSystemData[] };
export type EffectData = Omit<LegacyEffectData, 'roots' | 'meshes'> & { roots: EffectRootData[]; meshes: EffectMeshData[] };
export type BuiltinEffectAssets = {
  effects: Pick<EffectData, 'roots' | 'meshes' | 'textures' | 'simpleAnimations' | 'uvScrolls'>;
  scene: Pick<SceneMetadata, 'nodes' | 'particleModules' | 'materials' | 'shaders' | 'textureSamplers'>;
};
export const withBuiltinEffects = (effects: EffectData, scene: SceneMetadata, builtin: BuiltinEffectAssets) => ({
  effects: { ...effects, roots: [...effects.roots, ...builtin.effects.roots],
    meshes: [...effects.meshes, ...builtin.effects.meshes], textures: [...effects.textures, ...builtin.effects.textures],
    simpleAnimations: [...(effects.simpleAnimations ?? []), ...(builtin.effects.simpleAnimations ?? [])],
    uvScrolls: [...(effects.uvScrolls ?? []), ...(builtin.effects.uvScrolls ?? [])] },
  scene: { ...scene, nodes: [...scene.nodes, ...builtin.scene.nodes],
    particleModules: { ...scene.particleModules, ...builtin.scene.particleModules },
    materials: { ...scene.materials, ...builtin.scene.materials },
    shaders: [...scene.shaders, ...builtin.scene.shaders],
    textureSamplers: { ...scene.textureSamplers, ...builtin.scene.textureSamplers } },
});
export type SourceMaterial = EffectMaterialData & { shaderName: string; renderQueue?: number };
export type SceneNode = { id: string; parentId: string | null; path: string; parent: string | null; transform: TransformData; active: boolean; layer: number };
export type MeshMaterial = {
  texture?: string;
  levels?: number[];
  material: SourceMaterial; transform: TransformData; active: boolean; layer: number;
  bounds: { center: Vec3; extents: Vec3; rootBone: string | null; updateWhenOffscreen: boolean };
};
export type ShaderStateValue = { val: number; name: string };
export type SourceShader = {
  name: string;
  defaults: Record<string, number>;
  variants: Array<{ blobIndex: number; keywords: string[]; code: string }>;
  passes: Array<{
    programs: number[];
    state: {
      zTest: ShaderStateValue; zWrite: ShaderStateValue; culling: ShaderStateValue;
      rtBlend0: Record<'srcBlend' | 'destBlend' | 'srcBlendAlpha' | 'destBlendAlpha' | 'blendOp' | 'blendOpAlpha' | 'colMask', ShaderStateValue>;
    };
  }>;
};
export type SceneTrack = {
  target: string; component: string; property: string; base: Vec3 | number;
  curves: Array<Array<CurveKeyData & { stepIn?: boolean; stepOut?: boolean }>>;
};
export type SceneMetadata = {
  textureSamplers: Record<string, {
    sourceId: string; name: string; filterMode: number; wrapU: number; wrapV: number;
    anisotropy: number; mipBias: number; mipCount: number;
  }>;
  nodes: SceneNode[];
  cameraNodes: SceneNode[];
  cameras: Array<{ path: string; depth: number; clearFlags: number; cullingMask: number; fieldOfView: number; near: number; far: number }>;
  particleModules: Record<string, {
    path: string;
    enabledModules: string[];
    force: { enabled: boolean; inWorldSpace: boolean; randomizePerFrame: boolean; x: CurveData; y: CurveData; z: CurveData };
    limitVelocity: { enabled: boolean; dampen: number; separateAxes: boolean; inWorldSpace: boolean;
      multiplyDragByParticleSize: boolean; multiplyDragByParticleVelocity: boolean;
      x: CurveData; y: CurveData; z: CurveData; magnitude: CurveData; drag: CurveData };
    subEmitters: Array<{ sourceId: string | null; path: string | null; type: number; properties: number; probability: number }>;
  }>;
  propertyTracks: SceneTrack[];
  targets: Record<string, string>;
  materials: Record<string, SourceMaterial>;
  shaders: SourceShader[];
  actorMaterials: Record<string, Record<string, MeshMaterial>>;
  servantMaterials: Record<string, MeshMaterial>;
  cutIn: {
    nodes: SceneNode[];
    clips: Array<CompressedAnimationData & {
      bindings: Array<{ attribute: number; typeId: number; scalarOffset: number }>;
    }>;
  };
  background90001: {
    nodes: SceneNode[];
    meshes: Record<string, {
      vertices: Vec3[]; uvs: [number, number][]; colors: Array<[number, number, number, number]>; indices: number[];
    }>;
    renderers: Array<{
      path: string; meshId: string; texture: string; material: string;
      color: { r: number; g: number; b: number; a: number };
      tintColor: { r: number; g: number; b: number; a: number } | null;
      textureOffset: [number, number]; scrollSpeed: number;
    }>;
  };
};
