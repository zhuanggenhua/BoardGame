import * as THREE from 'three';
import type { SceneMetadata } from './fgoSceneData';
import { clipValues } from './fgoSceneMath';

const PORTRAIT_PIXELS_PER_UNIT = 100;
const PORTRAIT_HEIGHT = 786;
const ATLAS_SIZE = 1024;
const FIGURE_RUNTIME_Y_OFFSET = 1.05;
// Registration against the unchanged pixels in the source expression atlas.
const FACE_RECT = { x: 384, y: 149, size: 256 };

const maskedMaterial = (color: THREE.Texture, mask: THREE.Texture, face: THREE.Texture, faceMask: THREE.Texture) => new THREE.RawShaderMaterial({
  glslVersion: THREE.GLSL3,
  uniforms: { colorMap: { value: color }, maskMap: { value: mask }, opacity: { value: 0 },
    faceMap: { value: face }, faceMaskMap: { value: faceMask },
    faceRect: { value: new THREE.Vector4(FACE_RECT.x / ATLAS_SIZE,
      1 - (FACE_RECT.y + FACE_RECT.size) / ATLAS_SIZE, FACE_RECT.size / ATLAS_SIZE, FACE_RECT.size / ATLAS_SIZE) },
    modelViewMatrix: { value: new THREE.Matrix4() }, projectionMatrix: { value: new THREE.Matrix4() } },
  vertexShader: `in vec3 position; in vec2 uv; uniform mat4 modelViewMatrix; uniform mat4 projectionMatrix;
    out vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `precision mediump float; uniform sampler2D colorMap; uniform sampler2D maskMap;
    uniform sampler2D faceMap; uniform sampler2D faceMaskMap; uniform vec4 faceRect;
    uniform float opacity; in vec2 vUv; out vec4 outColor;
    void main() { vec4 color = texture(colorMap, vUv); float alpha = texture(maskMap, vUv).r;
      vec2 faceUv = (vUv - faceRect.xy) / faceRect.zw;
      if (all(greaterThanEqual(faceUv, vec2(0.0))) && all(lessThan(faceUv, vec2(1.0)))) {
        color = texture(faceMap, faceUv); alpha = texture(faceMaskMap, faceUv).r;
      }
      alpha *= opacity;
      if (alpha <= 0.001) discard; outColor = vec4(color.rgb, alpha); }`,
  transparent: true,
  depthTest: false,
  depthWrite: false,
  side: THREE.DoubleSide,
  forceSinglePass: true,
  toneMapped: false,
});

export class SourceCutIn {
  readonly root = new THREE.Group();
  private readonly baseMaterial: THREE.RawShaderMaterial;
  private readonly baseGeometry: THREE.PlaneGeometry;
  private readonly clip;
  private started = Infinity;

  constructor(metadata: SceneMetadata, textures: Map<string, THREE.Texture>, parent: THREE.Object3D) {
    const clip = metadata.cutIn.clips.find(clip => clip.name === 'CutIn1');
    if (!clip) throw new Error('Original CutIn1 animation unavailable');
    this.clip = clip;
    const requireTexture = (file: string) => {
      const texture = textures.get(file);
      if (!texture) throw new Error(`Original cut-in texture unavailable: ${file}`);
      return texture;
    };
    this.baseMaterial = maskedMaterial(requireTexture('portrait_full.png'), requireTexture('portrait_alpha.png'),
      requireTexture('portrait_face.png'), requireTexture('portrait_face_alpha.png'));
    const width = ATLAS_SIZE / PORTRAIT_PIXELS_PER_UNIT;
    const height = PORTRAIT_HEIGHT / PORTRAIT_PIXELS_PER_UNIT;
    this.baseGeometry = new THREE.PlaneGeometry(width, height);
    const uv = this.baseGeometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i += 1) uv.setY(i, 1 - PORTRAIT_HEIGHT / ATLAS_SIZE + uv.getY(i) * PORTRAIT_HEIGHT / ATLAS_SIZE);
    uv.needsUpdate = true;
    const base = new THREE.Mesh(this.baseGeometry, this.baseMaterial);
    const sourceNode = metadata.cutIn.nodes.find(node => node.path.endsWith('/cutin'));
    if (!sourceNode) throw new Error('Original cut-in node unavailable');
    base.layers.set(sourceNode.layer);
    const bind = (mesh: THREE.Mesh<THREE.BufferGeometry, THREE.RawShaderMaterial>) => {
      mesh.frustumCulled = false;
      mesh.onBeforeRender = (_renderer, _scene, camera) => {
        mesh.material.uniforms.modelViewMatrix.value.multiplyMatrices(camera.matrixWorldInverse, mesh.matrixWorld);
        mesh.material.uniforms.projectionMatrix.value.copy(camera.projectionMatrix);
        mesh.material.uniformsNeedUpdate = true;
      };
    };
    bind(base);
    base.renderOrder = -10;
    this.root.add(base);
    this.root.visible = false;
    parent.add(this.root);
  }

  start(time: number) { this.started = time; }
  update(time: number) {
    const elapsed = time - this.started;
    this.root.visible = elapsed >= 0 && elapsed <= this.clip.duration;
    if (!this.root.visible) return;
    const values = clipValues(this.clip, elapsed);
    this.root.position.set(values[0] ?? 0, (values[1] ?? 0) + FIGURE_RUNTIME_Y_OFFSET, values[2] ?? 6.48);
    const opacity = THREE.MathUtils.clamp(values[3] ?? 0, 0, 1);
    this.baseMaterial.uniforms.opacity.value = opacity;
  }

  reset() { this.started = Infinity; this.root.visible = false; }
  destroy() {
    this.baseGeometry.dispose();
    this.baseMaterial.dispose(); this.root.removeFromParent();
  }
}
