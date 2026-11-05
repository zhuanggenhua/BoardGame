import * as THREE from 'three';
import type { SkinData, MeshMaterial, ColorData } from './fgoSceneData';
import { clamp, clipValues, setTransform, unityEuler } from './fgoSceneMath';
import { SourceMaterials, sourceGeometry } from './fgoSceneMaterials';

export class SourceActor {
  private readonly data: SkinData;
  readonly root = new THREE.Group();
  readonly bones: THREE.Object3D[];
  private readonly model = new THREE.Group();
  private readonly meshes: Array<{
    name: string; geometry: THREE.BufferGeometry; data: SkinData['mesh']; views: THREE.Mesh<THREE.BufferGeometry, THREE.RawShaderMaterial>[];
    baseColor: THREE.Vector4; baseAddColor: THREE.Vector4;
    boundsCenter: THREE.Vector3; localBoundsCenter: THREE.Vector3; boundsAnchor: THREE.Object3D;
    dynamicBounds: THREE.Box3 | null;
    levels?: number[]; defaultVisible: boolean;
  }>;
  private readonly skinMatrices: THREE.Matrix4[];
  private readonly inverseModel = new THREE.Matrix4();
  private readonly source = new THREE.Vector3();
  private readonly posed = new THREE.Vector3();
  private readonly weighted = new THREE.Vector3();

  constructor(data: SkinData, materials: Record<string, MeshMaterial>, factory: SourceMaterials, modelYaw = 0) {
    this.data = data;
    this.root.name = data.source;
    this.model.quaternion.copy(unityEuler([0, modelYaw, 0]));
    this.root.add(this.model);
    this.bones = data.skeleton.nodes.map(node => {
      const bone = new THREE.Object3D();
      bone.name = node.path ?? node.name;
      bone.position.fromArray(node.localPosition); bone.quaternion.fromArray(node.localRotation); bone.scale.fromArray(node.localScale);
      return bone;
    });
    data.skeleton.nodes.forEach((node, i) => {
      (node.parent >= 0 ? this.bones[node.parent] : this.model).add(this.bones[i]);
    });
    this.skinMatrices = data.skeleton.skinBones.map(() => new THREE.Matrix4());
    this.meshes = [data.mesh, ...(data.attachments ?? []).map(a => a.mesh)].map(mesh => {
      const record = materials[mesh.name];
      if (!record) throw new Error(`Original material not exported: ${mesh.name}`);
      const geometry = sourceGeometry(mesh.vertices, mesh.uvs, mesh.indices);
      const views = Array.from({ length: factory.passCount(record.material) }, (_, pass) => {
        const view = new THREE.Mesh(geometry, factory.create(record.material, record.texture ?? data.texture, pass));
        view.name = mesh.name;
        view.layers.set(record.layer);
        setTransform(view, record.transform);
        view.visible = record.active;
        factory.bind(view);
        this.model.add(view);
        return view;
      });
      const boundsCenter = new THREE.Vector3();
      const localBoundsCenter = new THREE.Vector3().fromArray(record.bounds.center);
      const boundsAnchor = record.bounds.rootBone ? this.node(record.bounds.rootBone) : views[0];
      if (!boundsAnchor) throw new Error(`Original skin bounds root unavailable: ${record.bounds.rootBone}`);
      views.forEach((view, pass) => { view.userData.sourceRendererSort = { renderer: views[0], center: boundsCenter, pass }; });
      return { name: mesh.name, geometry, data: mesh, views,
        levels: record.levels, defaultVisible: record.active,
        boundsCenter, localBoundsCenter, boundsAnchor,
        dynamicBounds: record.bounds.updateWhenOffscreen ? new THREE.Box3() : null,
        baseColor: views[0].material.uniforms._Color?.value.clone() ?? new THREE.Vector4(1, 1, 1, 1),
        baseAddColor: views[0].material.uniforms._AddColor?.value.clone() ?? new THREE.Vector4() };
    });
  }

  setColorFade(name: string, color: ColorData, amount: number) {
    const mesh = this.meshes.find(mesh => mesh.name === name);
    if (!mesh) throw new Error(`Original actor color target unavailable: ${name}`);
    const t = clamp(amount);
    // APK 2.129.0 ARMv7: USFGOChrColorChangeEvent.SetMaterialColors, RVA 0x26f0a50.
    for (const view of mesh.views) {
      const uniforms = view.material.uniforms;
      if (!uniforms._Color || !uniforms._AddColor) throw new Error(`Original actor color uniforms unavailable: ${name}`);
      uniforms._Color.value.set(mesh.baseColor.x * (1 - t), mesh.baseColor.y * (1 - t), mesh.baseColor.z * (1 - t), 1);
      uniforms._AddColor.value.copy(mesh.baseAddColor).multiplyScalar(1 - t)
        .add(new THREE.Vector4(color.r * t, color.g * t, color.b * t, 0));
    }
  }

  resetColors() {
    for (const mesh of this.meshes) for (const view of mesh.views) {
      view.material.uniforms._Color?.value.copy(mesh.baseColor);
      view.material.uniforms._AddColor?.value.copy(mesh.baseAddColor);
    }
  }

  pose(animation: string, time: number, evolution = 1, loop = animation.startsWith('wait'), baseAnimation?: string) {
    for (const node of this.data.skeleton.nodes) {
      const bone = this.bones[node.index];
      bone.position.fromArray(node.localPosition); bone.quaternion.fromArray(node.localRotation); bone.scale.fromArray(node.localScale);
    }
    const samples = baseAnimation ? [{ name: baseAnimation, time: 0, loop: false }, { name: animation, time, loop }]
      : [{ name: animation, time, loop }];
    for (const sample of samples) {
      const clip = this.data.animations?.find(item => item.name === sample.name);
      if (!clip) throw new Error(`Original actor animation unavailable: ${sample.name}`);
      const values = clipValues(clip, sample.time, sample.loop, true);
      for (const binding of clip.bindings) {
        const bone = this.bones[binding.nodeIndex];
        const xyz = values.slice(binding.scalarOffset, binding.scalarOffset + 3) as [number, number, number];
        if (!bone || xyz.length < 3 || xyz.some(v => !Number.isFinite(v))) continue;
        if (binding.attribute === 'position') bone.position.fromArray(xyz);
        else if (binding.attribute === 'scale') bone.scale.fromArray(xyz);
        else if (binding.attribute === 'quaternion') bone.quaternion.fromArray(values.slice(binding.scalarOffset, binding.scalarOffset + 4)).normalize();
        else bone.quaternion.copy(unityEuler(xyz));
      }
    }
    this.root.updateMatrixWorld(true);
    this.inverseModel.copy(this.model.matrixWorld).invert();
    for (const record of this.data.skeleton.skinBones) {
      this.skinMatrices[record.skinIndex].multiplyMatrices(this.inverseModel, this.bones[record.nodeIndex].matrixWorld)
        .multiply(new THREE.Matrix4().set(...record.bindPose));
    }
    for (const mesh of this.meshes) {
      mesh.dynamicBounds?.makeEmpty();
      if (mesh.levels) {
        const visible = mesh.levels.length ? mesh.levels.includes(evolution) : mesh.defaultVisible;
        mesh.views.forEach(v => { v.visible = visible; });
      } else if (mesh.name.startsWith('body_level_')) {
        const visible = mesh.name === `body_level_${evolution < 0 ? 2 : evolution}`;
        mesh.views.forEach(v => { v.visible = visible; });
      }
      const positions = mesh.geometry.getAttribute('in_POSITION0') as THREE.BufferAttribute;
      for (let i = 0; i < mesh.data.vertices.length; i += 1) {
        this.source.fromArray(mesh.data.vertices[i]); this.posed.set(0, 0, 0);
        const weight = mesh.data.weights[i];
        for (let j = 0; j < 4; j += 1) {
          if (weight.weights[j] <= 0) continue;
          this.weighted.copy(this.source).applyMatrix4(this.skinMatrices[weight.indices[j]]);
          this.posed.addScaledVector(this.weighted, weight.weights[j]);
        }
        positions.setXYZ(i, this.posed.x, this.posed.y, this.posed.z);
        mesh.dynamicBounds?.expandByPoint(this.posed);
      }
      positions.needsUpdate = true;
      if (mesh.dynamicBounds) mesh.dynamicBounds.getCenter(mesh.boundsCenter).applyMatrix4(mesh.views[0].matrixWorld);
      else mesh.boundsCenter.copy(mesh.localBoundsCenter).applyMatrix4(mesh.boundsAnchor.matrixWorld);
    }
  }

  node(name: string) { return this.bones.find(b => b.name === name || b.name.endsWith(`/${name}`)); }
  setMeshVisible(name: string, visible: boolean) {
    const mesh = this.meshes.find(mesh => mesh.name === name);
    if (!mesh) throw new Error(`Original animation renderer unavailable: ${name}`);
    mesh.views.forEach(view => { view.visible = visible; });
  }
  bounds(visibleTrianglesOnly = false) {
    const bounds = new THREE.Box3();
    const collapsedBones = visibleTrianglesOnly
      ? this.skinMatrices.map(matrix => matrix.getMaxScaleOnAxis() <= 0.001001) : [];
    this.root.updateMatrixWorld(true);
    for (const mesh of this.meshes) {
      if (!mesh.views[0].visible) continue;
      const local = new THREE.Box3();
      const positions = mesh.geometry.getAttribute('in_POSITION0');
      const indices = mesh.geometry.index!;
      const point = new THREE.Vector3();
      if (visibleTrianglesOnly) {
        const collapsedVertices = mesh.data.weights.map(weight => weight.weights.every((value, index) =>
          value <= 0 || collapsedBones[weight.indices[index]]));
        const a = new THREE.Vector3(); const b = new THREE.Vector3(); const c = new THREE.Vector3();
        const ab = new THREE.Vector3(); const ac = new THREE.Vector3();
        const restA = new THREE.Vector3(); const restB = new THREE.Vector3(); const restC = new THREE.Vector3();
        for (let i = 0; i < indices.count; i += 3) {
          if ([0, 1, 2].every(offset => collapsedVertices[indices.getX(i + offset)])) continue;
          a.fromBufferAttribute(positions, indices.getX(i));
          b.fromBufferAttribute(positions, indices.getX(i + 1));
          c.fromBufferAttribute(positions, indices.getX(i + 2));
          // Original clips park spare body/face parts off-stage at 0.001 scale.
          // Their area remains nonzero in float32; compare deformation to the
          // original triangle rather than an absolute world-space epsilon.
          const areaSquared = ab.subVectors(b, a).cross(ac.subVectors(c, a)).lengthSq();
          restA.fromArray(mesh.data.vertices[indices.getX(i)]);
          restB.fromArray(mesh.data.vertices[indices.getX(i + 1)]);
          restC.fromArray(mesh.data.vertices[indices.getX(i + 2)]);
          const restAreaSquared = ab.subVectors(restB, restA).cross(ac.subVectors(restC, restA)).lengthSq();
          if (areaSquared <= Math.max(Number.EPSILON, restAreaSquared * 1e-10)) continue;
          local.expandByPoint(a).expandByPoint(b).expandByPoint(c);
        }
      } else {
        for (let i = 0; i < indices.count; i += 1) local.expandByPoint(point.fromBufferAttribute(positions, indices.getX(i)));
      }
      bounds.union(local.clone().applyMatrix4(mesh.views[0].matrixWorld));
    }
    return bounds;
  }
  projectedBounds(camera: THREE.Camera) {
    const point = new THREE.Vector3();
    const result: Record<string, { visible: boolean; min: number[]; max: number[]; behind: number }> = {};
    this.root.updateMatrixWorld(true);
    for (const mesh of this.meshes) {
      const view = mesh.views[0];
      const attribute = mesh.geometry.getAttribute('in_POSITION0');
      const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity];
      let behind = 0;
      for (let i = 0; i < attribute.count; i += 1) {
        point.set(attribute.getX(i) * (view.material.uniforms._xscale?.value ?? 1), attribute.getY(i), attribute.getZ(i));
        point.applyMatrix4(view.matrixWorld).project(camera);
        if (point.z < -1 || point.z > 1) behind += 1;
        for (let axis = 0; axis < 3; axis += 1) {
          min[axis] = Math.min(min[axis], point.getComponent(axis));
          max[axis] = Math.max(max[axis], point.getComponent(axis));
        }
      }
      result[mesh.name] = { visible: view.visible && this.root.visible, min, max, behind };
    }
    return result;
  }
  destroy() { this.meshes.forEach(mesh => mesh.geometry.dispose()); this.root.removeFromParent(); }
}
