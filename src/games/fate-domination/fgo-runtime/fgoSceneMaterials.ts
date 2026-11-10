import * as THREE from 'three';
import type { RenderItem } from 'three/src/renderers/webgl/WebGLRenderLists.js';
import type { SceneMetadata, SourceMaterial, SourceShader, ShaderStateValue, ColorData } from './fgoSceneData';

const matrixColumns = (matrix: THREE.Matrix4) => Array.from({ length: 4 }, (_, i) => (
  new THREE.Vector4().fromArray(matrix.elements, i * 4)
));
const blendFactors: Record<number, THREE.BlendingSrcFactor | THREE.BlendingDstFactor> = {
  0: THREE.ZeroFactor, 1: THREE.OneFactor, 2: THREE.DstColorFactor,
  3: THREE.SrcColorFactor, 4: THREE.OneMinusDstColorFactor, 5: THREE.SrcAlphaFactor,
  6: THREE.OneMinusSrcColorFactor, 7: THREE.DstAlphaFactor, 8: THREE.OneMinusDstAlphaFactor,
  9: THREE.SrcAlphaSaturateFactor, 10: THREE.OneMinusSrcAlphaFactor,
};
const vec4 = (c: ColorData) => new THREE.Vector4(c.r, c.g, c.b, c.a);

type SourceRenderItem = Pick<RenderItem, 'id' | 'object' | 'groupOrder' | 'renderOrder'>;
export const sourceTransparentSort = (a: SourceRenderItem, b: SourceRenderItem, cameraPosition: THREE.Vector3) => {
  if (a.groupOrder !== b.groupOrder) return a.groupOrder - b.groupOrder;
  if (a.renderOrder !== b.renderOrder) return a.renderOrder - b.renderOrder;
  const queue = (object: THREE.Object3D) => object instanceof THREE.Mesh && !Array.isArray(object.material)
    ? object.material.userData.sourceRenderQueue ?? 3000 : 3000;
  const queueDifference = queue(a.object) - queue(b.object);
  if (queueDifference) return queueDifference;
  const pa = a.object.userData.sourceParticleSort;
  const pb = b.object.userData.sourceParticleSort;
  const ra = a.object.userData.sourceRendererSort;
  const rb = b.object.userData.sourceRendererSort;
  const distance = (node: THREE.Object3D) => {
    const e = node.matrixWorld.elements;
    return Math.hypot(e[12] - cameraPosition.x, e[13] - cameraPosition.y, e[14] - cameraPosition.z);
  };
  // A multipass material belongs to one renderer, not one global queue per pass.
  if (ra && rb && ra.renderer === rb.renderer) return ra.pass - rb.pass || a.id - b.id;
  if (pa && pb && pa.renderer === pb.renderer) {
    if (pa.mode === 1) return distance(b.object) - distance(a.object) || a.id - b.id;
    if (pa.mode === 2) return pb.born - pa.born || a.id - b.id;
    if (pa.mode === 3) return pa.born - pb.born || a.id - b.id;
    return a.id - b.id;
  }
  const ownerA = ra?.renderer ?? pa?.renderer ?? a.object;
  const ownerB = rb?.renderer ?? pb?.renderer ?? b.object;
  const centerA = ra?.center ?? pa?.center;
  const centerB = rb?.center ?? pb?.center;
  const da = (centerA ? centerA.distanceTo(cameraPosition) : distance(ownerA)) + (pa?.fudge ?? 0);
  const db = (centerB ? centerB.distanceTo(cameraPosition) : distance(ownerB)) + (pb?.fudge ?? 0);
  return db - da || ownerA.id - ownerB.id || a.id - b.id;
};

export const applySourceSampler = (texture: THREE.Texture, source: SceneMetadata['textureSamplers'][string]) => {
  const wrap = [THREE.RepeatWrapping, THREE.ClampToEdgeWrapping, THREE.MirroredRepeatWrapping];
  if (!wrap[source.wrapU] || !wrap[source.wrapV] || ![0, 1, 2].includes(source.filterMode) || source.mipBias !== 0) {
    throw new Error(`Unsupported source texture sampler: ${source.name}`);
  }
  texture.wrapS = wrap[source.wrapU]; texture.wrapT = wrap[source.wrapV];
  texture.magFilter = source.filterMode === 0 ? THREE.NearestFilter : THREE.LinearFilter;
  texture.generateMipmaps = source.mipCount > 1;
  texture.minFilter = !texture.generateMipmaps ? texture.magFilter
    : source.filterMode === 0 ? THREE.NearestMipmapNearestFilter
      : source.filterMode === 1 ? THREE.LinearMipmapNearestFilter : THREE.LinearMipmapLinearFilter;
  texture.anisotropy = Math.max(1, source.anisotropy);
  texture.needsUpdate = true;
};
const depthFunctions: Record<number, THREE.DepthModes> = {
  1: THREE.NeverDepth, 2: THREE.LessDepth, 3: THREE.EqualDepth, 4: THREE.LessEqualDepth,
  5: THREE.GreaterDepth, 6: THREE.NotEqualDepth, 7: THREE.GreaterEqualDepth, 8: THREE.AlwaysDepth,
};
const blendEquations = [THREE.AddEquation, THREE.SubtractEquation, THREE.ReverseSubtractEquation, THREE.MinEquation, THREE.MaxEquation];

export const sourcePassState = (shader: SourceShader, source: SourceMaterial, pass: number) => {
  const state = shader.passes[pass]?.state;
  if (!state) throw new Error(`Original shader pass unavailable: ${shader.name}/${pass}`);
  const value = (field: ShaderStateValue) => field.name.startsWith('_')
    ? source.floats?.[field.name] ?? shader.defaults[field.name] ?? field.val : field.val;
  const blend = state.rtBlend0;
  const mask = value(blend.colMask);
  if (mask !== 15 && mask !== 14 && mask !== 0) throw new Error(`Unsupported source color mask: ${mask}`);
  const cull = value(state.culling);
  const zTest = value(state.zTest);
  return {
    side: cull === 2 ? THREE.FrontSide : cull === 1 ? THREE.BackSide : THREE.DoubleSide,
    // Unity Cull Off is one draw, not Three's two draws for double-sided transparency.
    forceSinglePass: true,
    depthWrite: Boolean(value(state.zWrite)),
    depthTest: zTest !== 0,
    depthFunc: depthFunctions[zTest] ?? THREE.LessEqualDepth,
    colorWrite: mask !== 0,
    blending: THREE.CustomBlending,
    blendSrc: blendFactors[value(blend.srcBlend)] as THREE.BlendingSrcFactor,
    blendDst: blendFactors[value(blend.destBlend)] as THREE.BlendingDstFactor,
    blendSrcAlpha: (mask === 14 ? THREE.ZeroFactor : blendFactors[value(blend.srcBlendAlpha)]) as THREE.BlendingSrcFactor,
    blendDstAlpha: (mask === 14 ? THREE.OneFactor : blendFactors[value(blend.destBlendAlpha)]) as THREE.BlendingDstFactor,
    blendEquation: blendEquations[value(blend.blendOp)],
    blendEquationAlpha: mask === 14 ? THREE.AddEquation : blendEquations[value(blend.blendOpAlpha)],
  };
};
const shaderSection = (code: string, stage: 'VERTEX' | 'FRAGMENT') => {
  const start = code.indexOf(`#ifdef ${stage}`) + `#ifdef ${stage}`.length;
  const end = stage === 'VERTEX' ? code.indexOf('#ifdef FRAGMENT') : code.length;
  const section = code.slice(start, end);
  return section.slice(0, section.lastIndexOf('#endif'))
    .replace(/^#version[^\n]*\n/gm, '')
    .replace('#define UNITY_SUPPORTS_UNIFORM_LOCATION 1', '#define UNITY_SUPPORTS_UNIFORM_LOCATION 0');
};

export class SourceMaterials {
  private readonly owned = new Set<THREE.RawShaderMaterial>();
  private readonly metadata: Pick<SceneMetadata, 'shaders'>;
  private readonly textures: Map<string, THREE.Texture>;
  constructor(metadata: Pick<SceneMetadata, 'shaders'>, textures: Map<string, THREE.Texture>) {
    this.metadata = metadata; this.textures = textures;
  }

  passCount(source: SourceMaterial) {
    const shader = this.metadata.shaders.find(item => item.name === source.shaderName);
    if (!shader) throw new Error(`Original shader unavailable: ${source.shaderName}`);
    return shader.passes.length;
  }

  create(source: SourceMaterial, textureFile: string, pass = 0) {
    const shader = this.metadata.shaders.find(item => item.name === source.shaderName);
    if (!shader?.variants.length) throw new Error(`Original shader unavailable: ${source.shaderName}`);
    const keywords = source.keywords ?? [];
    const variants = shader.variants.filter(item => shader.passes[pass]?.programs.includes(item.blobIndex)
      && item.keywords.every(k => keywords.includes(k)));
    const variant = variants.sort((a, b) => b.keywords.length - a.keywords.length)[0];
    if (!variant) throw new Error(`Original shader variant unavailable: ${source.name}`);
    const texture = this.textures.get(textureFile);
    if (!texture) throw new Error(`Original texture unavailable: ${textureFile}`);
    const uniforms: Record<string, THREE.IUniform> = {
      _MainTex: { value: texture },
      _MainTex_ST: { value: new THREE.Vector4(1, 1, 0, 0) },
      uParticleColor: { value: new THREE.Vector4(1, 1, 1, 1) },
      hlslcc_mtx4x4unity_ObjectToWorld: { value: matrixColumns(new THREE.Matrix4()) },
      hlslcc_mtx4x4unity_MatrixVP: { value: matrixColumns(new THREE.Matrix4()) },
    };
    for (const [key, value] of Object.entries({ ...shader.defaults, ...source.floats })) uniforms[key] = { value };
    for (const [key, value] of Object.entries(source.colors ?? {})) uniforms[key] = { value: vec4(value) };
    const st = source.mainTextureTransform;
    if (st) uniforms._MainTex_ST.value.set(...st.scale, ...st.offset);
    let vertexShader = shaderSection(variant.code, 'VERTEX');
    const main = vertexShader.indexOf('void main()');
    vertexShader = `uniform vec4 uParticleColor;\n${vertexShader.slice(0, main)}${vertexShader.slice(main).replace(/\bin_COLOR0\b/g, '(in_COLOR0 * uParticleColor)')}`;
    const material = new THREE.RawShaderMaterial({
      name: source.name,
      glslVersion: THREE.GLSL3,
      vertexShader,
      fragmentShader: shaderSection(variant.code, 'FRAGMENT'),
      uniforms,
      transparent: true,
      ...sourcePassState(shader, source, pass),
      toneMapped: false,
    });
    material.userData.sourceRenderQueue = source.renderQueue ?? 3000;
    this.owned.add(material);
    return material;
  }

  bind(mesh: THREE.Mesh<THREE.BufferGeometry, THREE.RawShaderMaterial>) {
    mesh.frustumCulled = false;
    mesh.onBeforeRender = (_renderer, _scene, camera) => {
      const uniforms = mesh.material.uniforms;
      const vp = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      uniforms.hlslcc_mtx4x4unity_ObjectToWorld.value = matrixColumns(mesh.matrixWorld);
      uniforms.hlslcc_mtx4x4unity_MatrixVP.value = matrixColumns(vp);
      mesh.material.uniformsNeedUpdate = true;
    };
  }

  release(material: THREE.RawShaderMaterial) { this.owned.delete(material); material.dispose(); }
  destroy() { for (const material of this.owned) material.dispose(); this.owned.clear(); }
}

export const sourceGeometry = (
  vertices: number[][], uvs: number[][], indices: number[], colors?: number[][],
) => {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(vertices.flatMap(v => [v[0], v[1], v[2], 1]));
  geometry.setAttribute('in_POSITION0', new THREE.BufferAttribute(positions, 4));
  geometry.setAttribute('in_TEXCOORD0', new THREE.Float32BufferAttribute(uvs.flat(), 2));
  geometry.setAttribute('in_COLOR0', new THREE.Float32BufferAttribute(
    colors?.length ? colors.flat() : vertices.flatMap(() => [1, 1, 1, 1]), 4,
  ));
  geometry.setIndex(indices);
  geometry.boundingBox = new THREE.Box3();
  const point = new THREE.Vector3();
  for (const vertex of vertices) geometry.boundingBox.expandByPoint(point.fromArray(vertex));
  return geometry;
};
