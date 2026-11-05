import * as THREE from 'three';
import type { SceneMetadata } from './fgoSceneData';
import { setTransform } from './fgoSceneMath';

export class SourceBackground {
  readonly root = new THREE.Group();
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.MeshBasicMaterial[] = [];
  private readonly scrolling: Array<{ uv: THREE.BufferAttribute; source: number[]; offset: number; speed: number }> = [];

  constructor(metadata: SceneMetadata, textures: Map<string, THREE.Texture>, scene: THREE.Scene) {
    const nodes = new Map<string, THREE.Object3D>();
    for (const record of metadata.background90001.nodes) {
      const node = new THREE.Group();
      node.name = record.path;
      setTransform(node, record.transform);
      node.visible = record.active;
      node.layers.set(record.layer);
      nodes.set(record.path, node);
    }
    for (const record of metadata.background90001.nodes) {
      (record.parent ? nodes.get(record.parent) : this.root)?.add(nodes.get(record.path)!);
    }
    for (const item of metadata.background90001.renderers) {
      const source = metadata.background90001.meshes[item.meshId];
      const texture = textures.get(item.texture);
      if (!source || !texture) throw new Error(`Original background asset unavailable: ${item.path}`);
      texture.wrapS = THREE.RepeatWrapping;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(source.vertices.flat(), 3));
      const sourceUv = source.uvs.flat();
      const uv = new THREE.Float32BufferAttribute(sourceUv, 2);
      geometry.setAttribute('uv', uv);
      if (source.colors.length) geometry.setAttribute('color', new THREE.Float32BufferAttribute(source.colors.flat(), 4));
      geometry.setIndex(source.indices);
      const material = new THREE.MeshBasicMaterial({
        map: texture, vertexColors: source.colors.length > 0, transparent: true,
        blending: item.material.startsWith('Add_') ? THREE.AdditiveBlending : THREE.NormalBlending,
        depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
        color: new THREE.Color(
          item.color.r * (item.tintColor?.r ?? 1),
          item.color.g * (item.tintColor?.g ?? 1),
          item.color.b * (item.tintColor?.b ?? 1),
        ),
        opacity: item.color.a * (item.tintColor?.a ?? 1),
      });
      this.scrolling.push({ uv, source: sourceUv, offset: item.textureOffset[0], speed: item.scrollSpeed });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = item.path;
      mesh.layers.mask = nodes.get(item.path)!.layers.mask;
      mesh.renderOrder = -100;
      mesh.frustumCulled = false;
      nodes.get(item.path)?.add(mesh);
      this.geometries.push(geometry); this.materials.push(material);
    }
    scene.add(this.root);
    this.root.visible = false;
  }

  show(name: string) { this.root.visible = name === '90001'; }
  update(time: number) {
    for (const item of this.scrolling) {
      const shift = item.offset + (item.speed * time) % 1;
      for (let i = 0; i < item.source.length; i += 2) item.uv.setX(i / 2, item.source[i] + shift);
      item.uv.needsUpdate = true;
    }
  }
  destroy() {
    this.geometries.forEach(geometry => geometry.dispose());
    this.materials.forEach(material => material.dispose());
    this.root.removeFromParent();
  }
}
