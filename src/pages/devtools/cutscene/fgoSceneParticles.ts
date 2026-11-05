import * as THREE from 'three';
import type { EffectData, EffectRootData, EffectMeshData, ParticleSystemData, SceneMetadata, ColorData, SourceMeshId } from './fgoSceneData';
import { clipValues, gradient, sampleCurve, integrateCurve, setTransform, unityEuler, seededRandom, clamp } from './fgoSceneMath';
import { SourceMaterials, sourceGeometry } from './fgoSceneMaterials';
import { applyParticlePresentation, updateParticlePresentation } from './fgoScenePresentation';

type Particle = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.RawShaderMaterial>;
  born: number; life: number; random: number; row: number; color: ColorData;
  position: THREE.Vector3; velocity: THREE.Vector3; rotation: THREE.Vector3;
  size: THREE.Vector3; integratedAge: number;
  forceRandom: [number, number, number];
  rotationSign: number;
  subEmission: Array<{ emitter: SourceEmitter; remainder: number }>;
};
const forward = new THREE.Vector3(0, 0, 1);
const cameraBasis = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

class SourceEmitter {
  readonly data: ParticleSystemData;
  private readonly node: THREE.Object3D;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.Camera;
  private readonly factory: SourceMaterials;
  private readonly geometries: Map<SourceMeshId, THREE.BufferGeometry>;
  private readonly particles: Particle[] = [];
  private readonly random: () => number;
  private readonly forceRandom: () => number;
  private readonly subRandom: () => number;
  private readonly subEmitters: Array<{ emitter: SourceEmitter; probability: number }> = [];
  private drivenBy: SourceEmitter | null = null;
  private readonly modules: SceneMetadata['particleModules'][string];
  private remainder = 0;
  private previous = -1e-6;
  private warmed = false;
  private readonly scale = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();
  private readonly simulationToWorld = new THREE.Matrix4();
  private readonly worldToSimulation = new THREE.Matrix4();
  private readonly bounds = new THREE.Box3();
  private readonly particleBounds = new THREE.Box3();
  private readonly sortCenter = new THREE.Vector3();
  private readonly quad: THREE.BufferGeometry;
  private readonly materialSource;
  readonly uvOffset = new THREE.Vector2();

  constructor(
    data: ParticleSystemData, node: THREE.Object3D,
    scene: THREE.Scene, camera: THREE.Camera,
    metadata: SceneMetadata, factory: SourceMaterials,
    geometries: Map<SourceMeshId, THREE.BufferGeometry>,
  ) {
    this.data = data; this.node = node; this.scene = scene; this.camera = camera;
    this.factory = factory; this.geometries = geometries;
    this.random = seededRandom(`${data.path}:${data.particle.autoRandomSeed ? 'replay' : data.particle.randomSeed}`);
    this.forceRandom = seededRandom(`${data.path}:${data.particle.randomSeed}:force`);
    this.subRandom = seededRandom(`${data.sourceId}:${data.particle.randomSeed}:sub`);
    if (!data.sourceId || !metadata.particleModules[data.sourceId]) throw new Error(`Source particle ID unavailable: ${data.path}`);
    this.modules = metadata.particleModules[data.sourceId];
    this.quad = sourceGeometry([[-0.5, -0.5, 0], [0.5, -0.5, 0], [0.5, 0.5, 0], [-0.5, 0.5, 0]], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, 1, 2, 0, 2, 3]);
    const materialSource = Object.values(metadata.materials).find(m => m.name === data.renderer.materialName);
    if (!materialSource) throw new Error(`Source particle material unavailable: ${data.path}`);
    this.materialSource = materialSource;
  }

  connectSubEmitter(emitter: SourceEmitter, link: SceneMetadata['particleModules'][string]['subEmitters'][number]) {
    const child = emitter.data.particle;
    if (link.type !== 0 || link.properties !== 0 || child.simulationSpeed !== this.data.particle.simulationSpeed
      || child.startDelay.state !== 0 || child.startDelay.scalar !== 0 || child.emission.bursts.length
      || child.emission.rateOverDistance.state !== 0 || child.emission.rateOverDistance.scalar !== 0) {
      throw new Error(`Unsupported source sub-emitter configuration: ${emitter.data.path}`);
    }
    if (emitter.drivenBy) throw new Error(`Shared source sub-emitter clock unsupported: ${emitter.data.path}`);
    if (emitter === this) throw new Error(`Cyclic source sub-emitter: ${emitter.data.path}`);
    for (let ancestor = this.drivenBy; ancestor; ancestor = ancestor.drivenBy) {
      if (ancestor === emitter) throw new Error(`Cyclic source sub-emitter: ${emitter.data.path}`);
    }
    emitter.drivenBy = this;
    this.subEmitters.push({ emitter, probability: link.probability });
  }

  private shape(born: number) {
    const shape = this.data.particle.shape;
    const position = new THREE.Vector3(); const direction = forward.clone();
    if (shape.enabled) {
      let phase: number;
      if (!shape.arcMode) phase = this.random();
      else if (shape.arcMode === 1 && shape.arcSpeed?.state === 0) {
        const angle = born * shape.arcSpeed.scalar * 360;
        phase = ((angle % shape.arc) + shape.arc) % shape.arc / shape.arc;
      } else throw new Error(`Source particle arc mode unsupported: ${shape.arcMode} (${this.data.path})`);
      if (shape.arcSpread) phase = Math.floor(phase / shape.arcSpread) * shape.arcSpread;
      const azimuth = phase * shape.arc * Math.PI / 180;
      const inner = 1 - clamp(shape.radiusThickness ?? 1);
      const radialFraction = Math.sqrt(inner ** 2 + (1 - inner ** 2) * this.random());
      const radius = shape.radius * radialFraction;
      if (shape.type === 5) position.set(this.random() - 0.5, this.random() - 0.5, this.random() - 0.5);
      else if (shape.type === 4 || shape.type === 8) {
        const height = shape.type === 8 ? this.random() * shape.length : 0;
        const r = (shape.radius + height * Math.tan(shape.angle * Math.PI / 180)) * radialFraction;
        position.set(Math.cos(azimuth) * r, Math.sin(azimuth) * r, height);
        const angle = shape.angle * Math.PI / 180 * (shape.radius > 0 ? radius / shape.radius : 0);
        direction.set(Math.cos(azimuth) * Math.sin(angle), Math.sin(azimuth) * Math.sin(angle), Math.cos(angle));
      } else if (shape.type === 10) {
        position.set(Math.cos(azimuth) * radius, Math.sin(azimuth) * radius, 0);
        direction.copy(position).normalize();
      } else if (shape.type === 0 || shape.type === 2) {
        const z = shape.type === 2 ? this.random() : this.random() * 2 - 1;
        const r = Math.sqrt(1 - z * z);
        direction.set(r * Math.cos(azimuth), r * Math.sin(azimuth), z);
        position.copy(direction).multiplyScalar(shape.radius * Math.cbrt(inner ** 3 + (1 - inner ** 3) * this.random()));
      } else throw new Error(`Source particle shape unsupported: ${shape.type} (${this.data.path})`);
      const randomDirection = shape.randomDirectionAmount ?? 0;
      if (randomDirection > 0) {
        const z = this.random() * 2 - 1; const angle = this.random() * 2 * Math.PI;
        const r = Math.sqrt(1 - z * z);
        direction.lerp(new THREE.Vector3(r * Math.cos(angle), r * Math.sin(angle), z), randomDirection).normalize();
      }
      const q = unityEuler(shape.rotation);
      position.multiply(new THREE.Vector3().fromArray(shape.scale)).applyQuaternion(q).add(new THREE.Vector3().fromArray(shape.position));
      direction.applyQuaternion(q);
    }
    return { position, direction };
  }

  private updateSpace() {
    const data = this.data.particle;
    this.node.getWorldQuaternion(this.rotation);
    if (data.scalingMode === 0) this.node.getWorldScale(this.scale);
    else this.scale.copy(data.scalingMode === 2 ? new THREE.Vector3(1, 1, 1) : this.node.scale);
    this.simulationToWorld.compose(this.node.getWorldPosition(new THREE.Vector3()), this.rotation, this.scale);
    this.worldToSimulation.copy(this.simulationToWorld).invert();
  }

  private totalVelocity(particle: Particle, progress: number) {
    const data = this.data.particle;
    const velocity = particle.velocity.clone();
    if (data.velocity.enabled) {
      const extra = new THREE.Vector3(sampleCurve(data.velocity.x, progress, particle.random),
        sampleCurve(data.velocity.y, progress, particle.random), sampleCurve(data.velocity.z, progress, particle.random));
      const localSpace = data.moveWithTransform !== 1;
      if (data.velocity.inWorldSpace && localSpace) extra.applyQuaternion(this.rotation.clone().invert());
      else if (!data.velocity.inWorldSpace && !localSpace) extra.applyQuaternion(this.rotation);
      velocity.add(extra).multiplyScalar(sampleCurve(data.velocity.speedModifier, progress, particle.random, 1));
    }
    return velocity;
  }

  private billboardSizeFactor(size: THREE.Vector3, position: THREE.Vector3) {
    const { minParticleSize: min, maxParticleSize: max } = this.data.renderer;
    if (min === undefined || max === undefined) throw new Error(`Source billboard limits unavailable: ${this.data.path}`);
    const projection = this.camera.projectionMatrix.elements;
    let width = 2 / Math.abs(projection[0]);
    if (projection[15] === 0) width *= -position.clone().applyMatrix4(this.camera.matrixWorldInverse).z;
    const units = width / Math.max(this.scale.x, 1e-5);
    const lower = min * units; const upper = max * units;
    // libunity 0x12c27b8, 0x12c876c and 0x12c9c7c clamp unstretched XY size.
    // Native quad vertices use +/-1; our +/-0.5 quad already includes the half-size.
    const longest = Math.max(size.x, size.y, 1e-6);
    let bounded = lower >= 0 ? Math.max(longest, lower) : 0;
    if (upper >= 0) bounded = Math.min(bounded, upper);
    return bounded / longest;
  }

  private birth(born: number, progress: number, worldOrigin?: THREE.Vector3) {
    const data = this.data.particle;
    // Expired particles still need their final integration/sub-emission below,
    // but must not occupy slots at a later particle's birth time.
    const alive = this.particles.reduce((count, particle) => count + Number(particle.born + particle.life > born + 1e-9), 0);
    if (alive >= data.maxParticles || !this.data.renderer.texture) return;
    const random = this.random();
    const life = sampleCurve(data.startLifetime, progress, random);
    if (life <= 0) return;
    const shape = this.shape(born);
    const speed = sampleCurve(data.startSpeed, progress, this.random());
    const velocity = shape.direction.multiplyScalar(speed);
    this.updateSpace();
    const shapeToWorld = data.scalingMode === 2 ? this.node.matrixWorld : this.simulationToWorld;
    shape.position.applyMatrix4(shapeToWorld);
    if (worldOrigin) {
      // Shape offsets belong to the child, but its emission origin is the parent
      // particle, not the child's GameObject. Existing particles keep their own positions.
      shape.position.sub(this.node.getWorldPosition(new THREE.Vector3())).add(worldOrigin);
    }
    if (data.moveWithTransform !== 1) shape.position.applyMatrix4(this.worldToSimulation);
    if (data.moveWithTransform === 1) {
      velocity.multiply(this.scale).applyQuaternion(this.rotation);
    }
    const meshId = this.data.renderer.meshPathIds.find(id => this.geometries.has(id));
    const geometry = this.data.renderer.renderMode === 4 && meshId ? this.geometries.get(meshId)! : this.quad;
    const material = this.factory.create(this.materialSource, this.data.renderer.texture.file);
    applyParticlePresentation(material, this.data.path);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = this.data.path;
    mesh.layers.mask = this.node.layers.mask;
    mesh.renderOrder = this.data.renderer.sortingOrder;
    mesh.userData.sourceParticleSort = {
      renderer: this.node, fudge: this.data.renderer.sortingFudge,
      mode: this.data.renderer.sortMode ?? 0, born, center: this.sortCenter,
    };
    this.factory.bind(mesh);
    this.scene.add(mesh);
    const sizeX = sampleCurve(data.startSize, progress, this.random());
    const size = new THREE.Vector3(sizeX, data.size3D ? sampleCurve(data.startSizeY, progress, this.random()) : sizeX,
      data.size3D ? sampleCurve(data.startSizeZ, progress, this.random()) : sizeX);
    const rotation = new THREE.Vector3(
      data.rotation3D ? sampleCurve(data.startRotationX, progress, this.random()) : 0,
      data.rotation3D ? sampleCurve(data.startRotationY, progress, this.random()) : 0,
      sampleCurve(data.startRotation, progress, this.random()),
    );
    const flip = data.randomizeRotationDirection ?? 0;
    const rotationSign = flip >= 1 || (flip > 0 && this.random() < flip) ? -1 : 1;
    this.particles.push({ mesh, born, life, random, size, position: shape.position, velocity, rotation, rotationSign,
      subEmission: this.subEmitters.filter(link => link.probability >= 1 || (link.probability > 0 && this.subRandom() < link.probability))
        .map(link => ({ emitter: link.emitter, remainder: 0 })),
      forceRandom: [this.forceRandom(), this.forceRandom(), this.forceRandom()],
      color: gradient(data.startColor, progress, random), row: Math.floor(this.random() * Math.max(1, data.uv.tilesY)), integratedAge: 0 });
  }

  update(time: number) {
    if (this.drivenBy) return;
    const data = this.data.particle;
    const local = (time - sampleCurve(data.startDelay, 0)) * data.simulationSpeed;
    if (local < 0) return;
    const warmDuration = data.looping && data.prewarm ? data.duration : 0;
    if (!this.warmed) {
      this.warmed = true;
      // Prewarm at the attached emitter's initial transform, without advancing
      // the cutscene clock or its transform animation.
      if (warmDuration > 0) {
        this.simulate(0);
        for (let step = 1; step <= Math.ceil(warmDuration * 30); step += 1) {
          this.simulate(Math.min(step / 30, warmDuration));
        }
      }
    }
    this.simulate(local + warmDuration);
  }

  private simulate(local: number) {
    const data = this.data.particle;
    const duration = Math.max(data.duration, 1e-6);
    const dt = Math.max(0, local - Math.max(0, this.previous));
    const progress = data.looping ? ((local % duration) + duration) % duration / duration : clamp(local / duration);
    let active = true;
    for (let node: THREE.Object3D | null = this.node; node; node = node.parent) active &&= node.visible;
    if (local >= 0 && active && !this.drivenBy) {
      const births: Array<{ time: number; progress: number }> = [];
      const from = Math.max(0, this.previous);
      if (data.emission.enabled && (data.looping || from <= duration)) {
        const emissionDt = data.looping ? dt : Math.min(dt, Math.max(0, duration - from));
        const rate = Math.max(0, sampleCurve(data.emission.rateOverTime, progress));
        const total = this.remainder + rate * emissionDt;
        const count = Math.floor(total + 1e-9);
        for (let i = 0; i < count; i += 1) births.push({ time: from + (i + 1 - this.remainder) / Math.max(rate, 1e-6), progress });
        this.remainder = Math.max(0, total - count);
      }
      for (const burst of data.emission.enabled ? data.emission.bursts : []) {
        const firstLoop = data.looping ? Math.max(0, Math.floor(Math.max(0, this.previous) / duration)) : 0;
        const lastLoop = data.looping ? Math.floor(local / duration) : 0;
        for (let loop = firstLoop; loop <= lastLoop; loop += 1) {
          for (let cycle = 0; cycle < Math.max(1, burst.cycleCount); cycle += 1) {
            const at = loop * duration + burst.time + cycle * burst.repeatInterval;
            if (at <= this.previous || at > local || this.random() > burst.probability) continue;
            const count = Math.round(sampleCurve(burst.count, (at % duration) / duration, this.random()));
            for (let i = 0; i < count; i += 1) births.push({ time: at, progress: (at % duration) / duration });
          }
        }
      }
      births.sort((a, b) => a.time - b.time).forEach(birth => this.birth(birth.time, birth.progress));
    }
    this.updateSpace();
    this.bounds.makeEmpty();
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const particle = this.particles[i];
      particle.mesh.visible = active;
      const elapsedAge = Math.max(0, local - particle.born);
      const age = elapsedAge + 1e-9 >= particle.life ? particle.life : elapsedAge;
      const p = clamp(age / particle.life);
      const delta = age - particle.integratedAge;
      const fromPosition = particle.subEmission.length ? particle.position.clone() : null;
      const velocity = this.totalVelocity(particle, p);
      const gravity = new THREE.Vector3(0, -9.81 * sampleCurve(data.gravityModifier, p, particle.random), 0);
      if (data.moveWithTransform !== 1) gravity.applyQuaternion(this.rotation.clone().invert());
      const force = this.modules.force;
      if (force.enabled && delta > 0) {
        const samples = force.randomizePerFrame
          ? [this.forceRandom(), this.forceRandom(), this.forceRandom()] : particle.forceRandom;
        const midpoint = (particle.integratedAge + delta / 2) / particle.life;
        const acceleration = new THREE.Vector3(sampleCurve(force.x, midpoint, samples[0]),
          sampleCurve(force.y, midpoint, samples[1]), sampleCurve(force.z, midpoint, samples[2]));
        const localSpace = data.moveWithTransform !== 1;
        if (force.inWorldSpace && localSpace) acceleration.applyQuaternion(this.rotation.clone().invert());
        else if (!force.inWorldSpace && !localSpace) acceleration.applyQuaternion(this.rotation);
        gravity.add(acceleration);
      }
      const limit = this.modules.limitVelocity;
      // Only the source's unambiguous hard-cap case is handled here. Soft damping
      // and drag remain reported as unsupported until the native step rule is known.
      if (limit.enabled && limit.dampen === 1 && !limit.separateAxes
        && limit.drag.state === 0 && limit.drag.scalar === 0) {
        const nextVelocity = velocity.clone().addScaledVector(gravity, delta);
        const capped = nextVelocity.clone().clampLength(0, Math.max(0, sampleCurve(limit.magnitude, p, particle.random)));
        particle.velocity.addScaledVector(gravity, delta).add(capped.clone().sub(nextVelocity));
        velocity.copy(capped);
        particle.position.addScaledVector(capped, delta);
      } else {
        particle.position.addScaledVector(velocity, delta).addScaledVector(gravity, delta ** 2 / 2);
        particle.velocity.addScaledVector(gravity, delta);
      }
      if (active && fromPosition) {
        const toPosition = particle.position.clone();
        if (data.moveWithTransform !== 1) {
          fromPosition.applyMatrix4(this.simulationToWorld);
          toPosition.applyMatrix4(this.simulationToWorld);
        }
        for (const state of particle.subEmission) {
          state.remainder = state.emitter.emitAlongParent(particle.born, particle.integratedAge, age,
            fromPosition, toPosition, state.remainder);
        }
      }
      particle.integratedAge = age;
      if (age >= particle.life) { particle.mesh.removeFromParent(); this.factory.release(particle.mesh.material); this.particles.splice(i, 1); continue; }
      particle.mesh.position.copy(particle.position);
      if (data.moveWithTransform !== 1) particle.mesh.position.applyMatrix4(this.simulationToWorld);
      const alignment = this.data.renderer.renderAlignment;
      if (alignment === 2) particle.mesh.quaternion.copy(this.rotation);
      else if (alignment === 1) particle.mesh.quaternion.identity();
      else particle.mesh.quaternion.copy(this.camera.quaternion).multiply(cameraBasis);
      if (this.data.renderer.renderMode === 2) particle.mesh.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
      const alignmentRotation = particle.mesh.quaternion.clone();
      const angles = particle.rotation.clone();
      if (data.rotationOverLifetime.enabled) {
        angles.add(new THREE.Vector3(
          data.rotationOverLifetime.separateAxes ? integrateCurve(data.rotationOverLifetime.x, 0, p, particle.random) * particle.life : 0,
          data.rotationOverLifetime.separateAxes ? integrateCurve(data.rotationOverLifetime.y, 0, p, particle.random) * particle.life : 0,
          integrateCurve(data.rotationOverLifetime.curve, 0, p, particle.random) * particle.life,
        ));
      }
      angles.multiplyScalar(particle.rotationSign);
      // Unity Particle.rotation3D is the inverse Euler rotation, unlike Transform.eulerAngles.
      const particleRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(-angles.x, -angles.y, -angles.z, 'YXZ'));
      particle.mesh.quaternion.multiply(particleRotation);
      const size = particle.size.clone();
      if (data.sizeOverLifetime.enabled) size.multiply(new THREE.Vector3(
        sampleCurve(data.sizeOverLifetime.curve, p, particle.random),
        sampleCurve(data.sizeOverLifetime.separateAxes ? data.sizeOverLifetime.y : data.sizeOverLifetime.curve, p, particle.random),
        sampleCurve(data.sizeOverLifetime.separateAxes ? data.sizeOverLifetime.z : data.sizeOverLifetime.curve, p, particle.random),
      ));
      particle.mesh.scale.copy(size).multiply(this.scale);
      if ([0, 1, 2, 3].includes(this.data.renderer.renderMode)) {
        particle.mesh.scale.multiplyScalar(this.billboardSizeFactor(size, particle.mesh.position));
      }
      if (this.data.renderer.renderMode === 1) {
        const renderer = this.data.renderer;
        if (renderer.freeformStretching || renderer.cameraVelocityScale) {
          throw new Error(`Source stretching mode unsupported: ${this.data.path}`);
        }
        const worldVelocity = this.totalVelocity(particle, p);
        if (data.moveWithTransform !== 1) worldVelocity.multiply(this.scale).applyQuaternion(this.rotation);
        const up = worldVelocity.lengthSq() > 1e-12 ? worldVelocity.clone().normalize()
          : new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
        const view = particle.mesh.position.clone().sub(this.camera.getWorldPosition(new THREE.Vector3()));
        if (view.lengthSq() < 1e-12) view.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
        const right = new THREE.Vector3().crossVectors(up, view);
        if (right.lengthSq() < 1e-12) right.set(-1, 0, 0).applyQuaternion(this.camera.quaternion);
        right.normalize();
        const normal = new THREE.Vector3().crossVectors(right, up).normalize();
        particle.mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, normal));
        particle.mesh.scale.y = particle.mesh.scale.y * renderer.lengthScale + worldVelocity.length() * renderer.velocityScale;
      }
      const pivot = this.data.renderer.pivot;
      if (pivot?.some(value => value !== 0)) {
        const offset = new THREE.Vector3().fromArray(pivot).negate()
          .multiply(particle.mesh.scale).applyQuaternion(particle.mesh.quaternion);
        particle.mesh.position.add(offset);
      }
      const color = data.colorOverLifetime.enabled ? gradient(data.colorOverLifetime.gradient, p, particle.random) : { r: 1, g: 1, b: 1, a: 1 };
      particle.mesh.material.uniforms.uParticleColor.value.set(particle.color.r * color.r, particle.color.g * color.g, particle.color.b * color.b, particle.color.a * color.a);
      const uv = data.uv;
      const st = this.materialSource.mainTextureTransform;
      let sx = st?.scale[0] ?? 1; let sy = st?.scale[1] ?? 1;
      let ox = (st?.offset[0] ?? 0) + this.uvOffset.x; let oy = (st?.offset[1] ?? 0) + this.uvOffset.y;
      if (uv.enabled) {
        const cols = Math.max(1, uv.tilesX); const rows = Math.max(1, uv.tilesY);
        const count = uv.animationType === 1 ? cols : cols * rows;
        const frame = Math.floor((sampleCurve(uv.startFrame, 0, particle.random) + sampleCurve(uv.frameOverTime, p, particle.random) * uv.cycles) * count) % count;
        sx /= cols; sy /= rows;
        ox += (frame % cols) / cols; oy += (rows - 1 - (uv.animationType === 1 ? (uv.rowMode === 1 ? particle.row : uv.rowIndex) : Math.floor(frame / cols))) / rows;
      }
      particle.mesh.material.uniforms._MainTex_ST.value.set(sx, sy, ox, oy);
      if (this.data.renderer.renderMode === 4 && alignment === 2) {
        // libunity 0x12bcb54-0x12bcc34: R_emitter * S_simulation * R_particle * S_size.
        // Nonuniform simulation scale creates shear that cannot survive TRS decomposition.
        particle.mesh.matrixAutoUpdate = false;
        particle.mesh.matrix.makeRotationFromQuaternion(alignmentRotation).scale(this.scale)
          .multiply(new THREE.Matrix4().makeRotationFromQuaternion(particleRotation)).scale(size)
          .setPosition(particle.mesh.position);
      }
      particle.mesh.updateMatrixWorld(true);
      this.bounds.union(this.particleBounds.copy(particle.mesh.geometry.boundingBox!).applyMatrix4(particle.mesh.matrixWorld));
    }
    if (this.bounds.isEmpty()) this.node.getWorldPosition(this.sortCenter);
    else this.bounds.getCenter(this.sortCenter);
    this.previous = local;
    for (const link of this.subEmitters) link.emitter.simulate(local);
  }

  private emitAlongParent(parentBorn: number, fromAge: number, toAge: number,
    from: THREE.Vector3, to: THREE.Vector3, remainder: number) {
    const data = this.data.particle;
    if (!data.emission.enabled || toAge <= fromAge) return remainder;
    const duration = Math.max(data.duration, 1e-6);
    const end = data.looping ? toAge : Math.min(toAge, duration);
    let cursor = fromAge;
    // A birth sub-emitter emits throughout its parent particle's lifetime. Split
    // at loop boundaries so a curve never gets sampled across its discontinuity.
    while (cursor < end - 1e-10) {
      const cycle = Math.floor((cursor + 1e-10) / duration);
      const until = Math.min(end, (cycle + 1) * duration);
      const progress = ((cursor + until) / 2 - cycle * duration) / duration;
      const rate = Math.max(0, sampleCurve(data.emission.rateOverTime, progress));
      const total = remainder + rate * (until - cursor);
      const count = Math.floor(total + 1e-9);
      for (let i = 0; i < count; i += 1) {
        const at = Math.min(until, cursor + (i + 1 - remainder) / rate);
        const origin = from.clone().lerp(to, clamp((at - fromAge) / (toAge - fromAge)));
        this.birth(parentBorn + at, (at - cycle * duration) / duration, origin);
      }
      remainder = Math.max(0, total - count);
      cursor = until;
    }
    return remainder;
  }

  present(time: number) {
    for (const particle of this.particles) updateParticlePresentation(particle.mesh, this.data.path, time);
  }
  get count() { return this.particles.length; }
  sample() { return this.particles.slice(0, 3).map(particle => particle.mesh.position.toArray()); }
  destroy() { for (const p of this.particles) { p.mesh.removeFromParent(); this.factory.release(p.mesh.material); } this.particles.length = 0; this.quad.dispose(); }
}

export class SourceEffect {
  readonly root: THREE.Object3D;
  readonly data: EffectRootData;
  readonly start: number;
  private readonly nodes = new Map<string, THREE.Object3D>();
  private readonly emitters: SourceEmitter[];
  private readonly animations;
  private readonly uvEmitters = new Map<THREE.Object3D, SourceEmitter>();

  constructor(
    data: EffectRootData, start: number, parent: THREE.Object3D,
    metadata: SceneMetadata, effects: EffectData, scene: THREE.Scene, camera: THREE.Camera,
    factory: SourceMaterials, geometries: Map<SourceMeshId, THREE.BufferGeometry>,
  ) {
    this.data = data; this.start = start;
    const records = metadata.nodes.filter(n => n.path === data.name || n.path.startsWith(`${data.name}/`));
    for (const record of records) { const node = new THREE.Object3D(); node.name = record.path; setTransform(node, record.transform); node.visible = record.active; node.layers.set(record.layer); this.nodes.set(record.id, node); }
    for (const record of records) (record.parentId && this.nodes.get(record.parentId) || parent).add(this.nodes.get(record.id)!);
    const rootId = records.find(record => record.path === data.name)?.id;
    const root = rootId && this.nodes.get(rootId); if (!root) throw new Error(`Original effect hierarchy unavailable: ${data.name}`);
    this.root = root; this.root.visible = true;
    this.root.updateWorldMatrix(true, true);
    this.animations = (effects.simpleAnimations ?? []).filter(a => a.path === data.name || a.path.startsWith(`${data.name}/`));
    this.emitters = data.particleSystems.map(system => {
      const node = system.transformId && this.nodes.get(system.transformId);
      if (!node) throw new Error(`Original particle transform unavailable: ${system.path}`);
      return new SourceEmitter(system, node, scene, camera, metadata, factory, geometries);
    });
    for (const scroll of effects.uvScrolls ?? []) {
      if (!scroll.path.startsWith(`${data.name}/`)) continue;
      const node = scroll.transformId && this.nodes.get(scroll.transformId);
      const emitter = this.emitters.find(item => item.data.transformId === scroll.transformId);
      if (!node || !emitter) throw new Error(`Source UV renderer unavailable: ${scroll.path}`);
      emitter.uvOffset.fromArray(scroll.offset);
      this.uvEmitters.set(node, emitter);
    }
    const byId = new Map(this.emitters.map(emitter => [emitter.data.sourceId, emitter]));
    for (const emitter of this.emitters) {
      for (const link of metadata.particleModules[emitter.data.sourceId!].subEmitters) {
        if (!link.sourceId) continue;
        const child = byId.get(link.sourceId);
        if (!child) throw new Error(`Source sub-emitter unavailable: ${link.path}`);
        emitter.connectSubEmitter(child, link);
      }
    }
  }

  update(time: number) {
    const elapsed = time - this.start;
    for (const animation of this.animations) {
      const clip = animation.clips.find(c => c.name === animation.clipName) ?? animation.clips[0];
      if (!clip) continue;
      const values = clipValues(clip, elapsed, animation.wrapMode === 2 || animation.wrapMode === 4);
      for (const binding of clip.bindings) {
        const owner = animation.transformId && this.nodes.get(animation.transformId);
        const node = binding.path
          ? [...this.nodes.values()].find(candidate => candidate.name === `${animation.path}/${binding.path}`)
          : owner;
        if (!node) continue;
        if (binding.attribute === 'uvOffsetX' || binding.attribute === 'uvOffsetY') {
          const emitter = this.uvEmitters.get(node);
          // Unity clips can be shared by prefabs without the referenced component.
          if (!emitter) continue;
          const value = values[binding.scalarOffset];
          if (!Number.isFinite(value)) throw new Error(`Source UV binding unavailable: ${node.name}`);
          emitter.uvOffset.setComponent(binding.attribute === 'uvOffsetX' ? 0 : 1, value);
          continue;
        }
        if (binding.attribute === 'quaternion') {
          const rotation = values.slice(binding.scalarOffset, binding.scalarOffset + 4);
          if (rotation.length !== 4 || rotation.some(value => !Number.isFinite(value))) {
            throw new Error(`Source quaternion binding unavailable: ${node.name}`);
          }
          node.quaternion.fromArray(rotation).normalize();
          continue;
        }
        const xyz = values.slice(binding.scalarOffset, binding.scalarOffset + 3) as [number, number, number];
        if (xyz.length < 3 || xyz.some(v => !Number.isFinite(v))) continue;
        if (binding.attribute === 'position') node.position.fromArray(xyz);
        else if (binding.attribute === 'scale') node.scale.fromArray(xyz);
        else if (binding.attribute === 'euler') node.quaternion.copy(unityEuler(xyz));
      }
    }
    this.root.updateWorldMatrix(true, true);
    this.emitters.forEach(emitter => emitter.update(elapsed));
    this.emitters.forEach(emitter => emitter.present(time));
  }
  get count() { return this.emitters.reduce((sum, emitter) => sum + emitter.count, 0); }
  sample() { return this.emitters.flatMap(emitter => emitter.sample()).slice(0, 8); }
  destroy() { this.emitters.forEach(e => e.destroy()); this.root.removeFromParent(); }
}

export const particleGeometries = (meshes: EffectMeshData[]) => new Map(meshes.map(mesh => {
  // The legacy effect export mirrors X and reverses winding; scene nodes and actors
  // remain in Unity coordinates, with handedness handled by the camera projection.
  const vertices = mesh.vertices.map(([x, y, z]) => [-x, y, z]);
  const indices = mesh.indices.flatMap((_, i) => i % 3 === 0
    ? [mesh.indices[i + 2], mesh.indices[i + 1], mesh.indices[i]] : []);
  return [mesh.pathId, sourceGeometry(vertices, mesh.uvs, indices, mesh.colors)];
}));
