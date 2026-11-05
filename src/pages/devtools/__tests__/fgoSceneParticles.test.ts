import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Euler, Mesh, PerspectiveCamera, Quaternion, Scene, Texture, Vector3 } from 'three';
import type { EffectData, EffectRootData, ParticleSystemData, SceneMetadata } from '../cutscene/fgoSceneData';
import { particleGeometries, SourceEffect } from '../cutscene/fgoSceneParticles';
import { SourceMaterials } from '../cutscene/fgoSceneMaterials';
import { clipValues } from '../cutscene/fgoSceneMath';

const effects = JSON.parse(readFileSync('public/assets/dev/fgo-cutscene/np100100/np100100_effects.json', 'utf8')) as EffectData;
const metadata = JSON.parse(readFileSync('public/assets/dev/fgo-cutscene/np100100/np100100_scene.json', 'utf8')) as SceneMetadata;
const nativeMeshMatrices = JSON.parse(readFileSync('scripts/devtools/fixtures/fgo-native-mesh-matrices.json', 'utf8')) as {
  cases: Array<{ name: string; particleAngle: number; emitterAngle: number; simulationScale: number[]; size: number[]; matrix: number[] }>;
};

const fixture = (data: EffectRootData, sceneMetadata = metadata) => {
  const scene = new Scene();
  const textures = new Map(effects.textures.map(record => [record.file, new Texture()]));
  const factory = new SourceMaterials(sceneMetadata, textures);
  const geometries = particleGeometries(effects.meshes);
  const omitted = new Set(effects.roots.find(root => root.name === data.name)!.particleSystems
    .filter(system => !data.particleSystems.some(included => included.sourceId === system.sourceId)).map(system => system.path));
  const selectedEffects = { ...effects, uvScrolls: effects.uvScrolls?.filter(scroll => !omitted.has(scroll.path)),
    simpleAnimations: effects.simpleAnimations?.filter(animation => !omitted.has(animation.path)) };
  const camera = new PerspectiveCamera();
  camera.position.z = 10;
  camera.updateMatrixWorld();
  const effect = new SourceEffect(data, 0, scene, sceneMetadata, selectedEffects, scene, camera, factory, geometries);
  return { effect, scene, camera, dispose: () => {
    effect.destroy(); factory.destroy(); geometries.forEach(geometry => geometry.dispose());
    textures.forEach(texture => texture.dispose());
  } };
};

const constant = (scalar: number) => ({ state: 0, scalar, minScalar: scalar, keys: [] });
const isolatedFixture = (configure: (system: ParticleSystemData) => void) => {
  const source = structuredClone(effects.roots.find(root => root.name === '100100_st_kensen')!);
  const system = source.particleSystems.find(system => system.path.endsWith('/aura_tutu'))!;
  source.particleSystems = [system];
  Object.assign(system.particle, { prewarm: false, looping: false, duration: 1, maxParticles: 128,
    startDelay: constant(0), simulationSpeed: 1, startLifetime: constant(2), startSpeed: constant(0),
    gravityModifier: constant(0), startRotationX: constant(0), startRotationY: constant(0),
    startRotation: constant(0), randomizeRotationDirection: 0 });
  system.particle.shape.enabled = false;
  system.particle.velocity.enabled = false;
  system.particle.rotationOverLifetime.enabled = false;
  system.particle.emission = { enabled: true, rateOverTime: constant(0), rateOverDistance: constant(0),
    bursts: [{ time: 0, cycleCount: 1, repeatInterval: 0, probability: 1, count: constant(1) }] };
  const sceneMetadata = structuredClone(metadata);
  sceneMetadata.particleModules[system.sourceId!].force.enabled = false;
  sceneMetadata.particleModules[system.sourceId!].limitVelocity.enabled = false;
  for (const node of sceneMetadata.nodes) if (node.path === source.name || node.path.startsWith(`${source.name}/`)) {
    node.transform = { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] };
  }
  configure(system);
  return fixture(source, sceneMetadata);
};

describe('FGO emission clock and direction', () => {
  it.each(nativeMeshMatrices.cases)('matches the APK mesh composition tail: $name', sample => {
    const instance = isolatedFixture(system => {
      system.renderer.renderMode = 4;
      system.renderer.renderAlignment = 2;
      system.renderer.pivot = [0, 0, 0];
      system.particle.scalingMode = 1;
      system.particle.size3D = true;
      system.particle.startSize = constant(sample.size[0]);
      system.particle.startSizeY = constant(sample.size[1]);
      system.particle.startSizeZ = constant(sample.size[2]);
      system.particle.sizeOverLifetime.enabled = false;
      system.particle.startRotation = constant(-sample.particleAngle);
    });
    try {
      const node = instance.scene.getObjectByName('100100_st_kensen/aura_tutu')!;
      node.scale.fromArray(sample.simulationScale);
      node.quaternion.setFromAxisAngle(new Vector3(0, 0, 1), sample.emitterAngle);
      instance.effect.update(0);
      const mesh = instance.scene.children.find(node => node instanceof Mesh)!;
      mesh.matrixWorld.elements.forEach((value, index) => expect(value).toBeCloseTo(sample.matrix[index], 4));
      const before = mesh.matrixWorld.toArray();
      instance.effect.update(0);
      expect(mesh.matrixWorld.toArray()).toEqual(before);
    } finally { instance.dispose(); }
  });

  it.each([0, 1, 2, 3, 4])('applies source screen-size limits to billboard modes, not meshes (mode %i)', mode => {
    const instance = isolatedFixture(system => {
      system.renderer.renderMode = mode;
      system.renderer.minParticleSize = 0;
      system.renderer.maxParticleSize = 0.25;
      system.renderer.lengthScale = 1;
      system.particle.size3D = true;
      system.particle.startSize = constant(100);
      system.particle.startSizeY = constant(1000);
      system.particle.startSizeZ = constant(10000);
      system.particle.sizeOverLifetime.enabled = false;
    });
    try {
      instance.effect.update(0);
      const mesh = instance.scene.children.find(node => node instanceof Mesh)!;
      const viewportWidth = 20 / instance.camera.projectionMatrix.elements[0];
      expect(mesh.scale.y).toBeCloseTo(mode === 4 ? 1000 : viewportWidth * 0.25, 6);
      expect(mesh.scale.x / mesh.scale.y).toBeCloseTo(0.1, 6);
      instance.camera.position.z = 20;
      instance.camera.updateMatrixWorld();
      instance.effect.update(0);
      expect(mesh.scale.y).toBeCloseTo(mode === 4 ? 1000 : viewportWidth * 0.5, 6);
      expect(mesh.position.length()).toBe(0);
    } finally { instance.dispose(); }
  });

  it('limits the unstretched XY size before applying the source billboard length multiplier', () => {
    const instance = isolatedFixture(system => {
      system.renderer.renderMode = 1;
      system.renderer.lengthScale = -10;
      system.renderer.velocityScale = 0;
      system.renderer.minParticleSize = 0;
      system.renderer.maxParticleSize = 0.25;
      system.particle.startSize = constant(100);
      system.particle.size3D = false;
      system.particle.sizeOverLifetime.enabled = false;
    });
    try {
      instance.effect.update(0);
      const mesh = instance.scene.children.find(node => node instanceof Mesh)!;
      const width = 20 / instance.camera.projectionMatrix.elements[0] * 0.25;
      expect(mesh.scale.x).toBeCloseTo(width, 6);
      expect(mesh.scale.y).toBeCloseTo(-10 * width, 6);
    } finally { instance.dispose(); }
  });

  it('keeps accelerated source beam geometry unchanged when the same frame is refreshed', () => {
    const source = structuredClone(effects.roots.find(root => root.name === '100100_enemy_beam')!);
    const system = source.particleSystems.find(system => system.path.endsWith('/kona_top'))!;
    source.particleSystems = [system];
    const instance = fixture(source);
    try {
      for (let frame = 0; frame <= 12; frame += 1) instance.effect.update(frame / 30);
      const particles = instance.scene.children.filter(node => node instanceof Mesh);
      expect(particles.length).toBeGreaterThan(0);
      const before = particles.map(mesh => ({ matrix: mesh.matrixWorld.toArray(),
        center: mesh.userData.sourceParticleSort.center.toArray() }));
      instance.effect.update(0.4);
      expect(particles.map(mesh => ({ matrix: mesh.matrixWorld.toArray(),
        center: mesh.userData.sourceParticleSort.center.toArray() }))).toEqual(before);
    } finally { instance.dispose(); }
  });

  it('stretches the billboard along world velocity and keeps pivot offsets out of simulation', () => {
    const instance = isolatedFixture(system => {
      system.renderer.renderMode = 1;
      system.renderer.lengthScale = 4;
      system.renderer.velocityScale = 0;
      system.renderer.pivot = [0, -0.75, 0];
      system.particle.startSize = constant(1);
      system.particle.size3D = false;
      system.particle.sizeOverLifetime.enabled = false;
      system.particle.startSpeed = constant(2);
    });
    try {
      instance.effect.update(0); instance.effect.update(0.5);
      const mesh = instance.scene.children.find(node => node instanceof Mesh)!;
      const longAxis = new Vector3(0, 1, 0).applyQuaternion(mesh.quaternion);
      expect(longAxis.z).toBeCloseTo(1, 6);
      expect(mesh.scale.x).toBeCloseTo(1, 6);
      expect(mesh.scale.y).toBeCloseTo(4, 6);
      expect(mesh.position.z).toBeCloseTo(4, 6);
      instance.effect.update(1);
      expect(mesh.position.z).toBeCloseTo(5, 6);
    } finally { instance.dispose(); }
  });

  it('retains the one-turn-per-second Loop arc instead of randomizing every birth', () => {
    const instance = isolatedFixture(system => {
      system.particle.shape = { ...system.particle.shape, enabled: true, type: 4, angle: 0,
        radius: 1, radiusThickness: 0, randomDirectionAmount: 0, arc: 360, arcMode: 1,
        arcSpread: 0, arcSpeed: constant(1), position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };
      system.particle.emission.bursts = [0, 0.25, 0.5].map(time => ({ time, cycleCount: 1,
        repeatInterval: 0, probability: 1, count: constant(1) }));
    });
    try {
      instance.effect.update(0); instance.effect.update(0.5);
      const particles = instance.scene.children.filter(node => node instanceof Mesh);
      expect(particles).toHaveLength(3);
      for (const [index, [x, y]] of [[1, 0], [0, 1], [-1, 0]].entries()) {
        expect(particles[index].position.x).toBeCloseTo(x, 6);
        expect(particles[index].position.y).toBeCloseTo(y, 6);
      }
    } finally { instance.dispose(); }
  });

  it('allows full-thickness cone-volume births near the axis at every height', () => {
    const instance = isolatedFixture(system => {
      system.particle.shape = { ...system.particle.shape, enabled: true, type: 8, angle: 45,
        radius: 1, radiusThickness: 1, length: 4, randomDirectionAmount: 0, arcMode: 0,
        position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };
      system.particle.emission.bursts[0].count = constant(128);
    });
    try {
      instance.effect.update(0);
      const points = instance.scene.children.filter(node => node instanceof Mesh).map(node => node.position);
      expect(points).toHaveLength(128);
      expect(points.some(point => point.z > 2 && Math.hypot(point.x, point.y) < (1 + point.z) / 2)).toBe(true);
      for (const point of points) expect(Math.hypot(point.x, point.y)).toBeLessThanOrEqual(1 + point.z + 1e-6);
    } finally { instance.dispose(); }
  });

  it.each([0, 1])('applies the source Flip Rotation fraction %i to angular motion', flip => {
    const instance = isolatedFixture(system => {
      system.particle.randomizeRotationDirection = flip;
      system.particle.rotationOverLifetime = { enabled: true, separateAxes: false,
        curve: constant(0.5), x: constant(0), y: constant(0) };
    });
    try {
      instance.effect.update(0); instance.effect.update(0.5);
      const mesh = instance.scene.children.find(node => node instanceof Mesh)!;
      const expected = new Quaternion().setFromEuler(new Euler(0, 0, flip ? 0.25 : -0.25, 'YXZ'));
      expect(mesh.quaternion.angleTo(expected)).toBeLessThan(1e-6);
    } finally { instance.dispose(); }
  });

  it('reuses expired capacity during prewarm and orders rate and burst births chronologically', () => {
    const instance = isolatedFixture(system => {
      Object.assign(system.particle, { maxParticles: 1, startLifetime: constant(0.1), prewarm: true, looping: true });
      system.particle.emission.rateOverTime = constant(10);
      system.particle.emission.bursts[0].time = 0.05;
    });
    try {
      instance.effect.update(0);
      expect(instance.effect.count).toBe(1);
      instance.effect.update(0.2);
      expect(instance.effect.count).toBe(1);
      const mesh = instance.scene.children.find(node => node instanceof Mesh)!;
      expect(mesh.userData.sourceParticleSort.born).toBeCloseTo(1.2, 6);
    } finally { instance.dispose(); }
  });
});

describe('FGO effect mesh adapter', () => {
  it.each([0, 4, 10])('keeps zero-thickness shape %i emission on its original outer surface', shapeType => {
    const source = structuredClone(effects.roots.find(root => root.name === '100100_st_kensen')!);
    const system = source.particleSystems.find(system => system.path.endsWith('/aura_tutu'))!;
    source.particleSystems = [system];
    const constant = (scalar: number) => ({ state: 0, scalar, minScalar: scalar, keys: [] });
    Object.assign(system.particle, { prewarm: false, looping: false, startDelay: constant(0),
      simulationSpeed: 1, startLifetime: constant(2), startSpeed: constant(0), gravityModifier: constant(0) });
    system.particle.shape = { ...system.particle.shape, enabled: true, type: shapeType, angle: 0,
      radius: 2, radiusThickness: 0, randomDirectionAmount: 0,
      position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };
    system.particle.emission = { enabled: true, rateOverTime: constant(0), rateOverDistance: constant(0),
      bursts: [{ time: 0, cycleCount: 1, repeatInterval: 0, probability: 1, count: constant(16) }] };
    const sceneMetadata = structuredClone(metadata);
    for (const node of sceneMetadata.nodes) if (node.path === source.name || node.path.startsWith(`${source.name}/`)) {
      node.transform = { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] };
    }
    const instance = fixture(source, sceneMetadata);
    try {
      instance.effect.update(0);
      const particles = instance.scene.children.filter(node => node instanceof Mesh);
      expect(particles).toHaveLength(16);
      for (const particle of particles) expect(particle.position.length()).toBeCloseTo(2, 6);
    } finally { instance.dispose(); }
  });

  it('renders inverse particle Euler angles after accumulating rotation on each axis', () => {
    const source = structuredClone(effects.roots.find(root => root.name === '100100_st_kensen')!);
    const system = source.particleSystems.find(system => system.path.endsWith('/aura_tutu'))!;
    source.particleSystems = [system];
    const constant = (scalar: number) => ({ state: 0, scalar, minScalar: scalar, keys: [] });
    Object.assign(system.particle, { prewarm: false, looping: false, startDelay: constant(0),
      simulationSpeed: 1, startLifetime: constant(2), rotation3D: true,
      startRotationX: constant(0.1), startRotationY: constant(0.2), startRotation: constant(0.3) });
    system.particle.rotationOverLifetime = { enabled: true, separateAxes: true,
      x: constant(0.4), y: constant(0.5), curve: constant(0.6) };
    system.particle.emission = { enabled: true, rateOverTime: constant(0), rateOverDistance: constant(0),
      bursts: [{ time: 0, cycleCount: 1, repeatInterval: 0, probability: 1, count: constant(1) }] };
    const sceneMetadata = structuredClone(metadata);
    for (const node of sceneMetadata.nodes) if (node.path === source.name || node.path.startsWith(`${source.name}/`)) {
      node.transform = { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] };
    }
    const instance = fixture(source, sceneMetadata);
    try {
      instance.effect.update(0); instance.effect.update(0.5);
      const mesh = instance.scene.children.find(node => node instanceof Mesh && node.name === system.path)!;
      const expected = new Quaternion().setFromEuler(new Euler(-0.3, -0.45, -0.6, 'YXZ'));
      expect(mesh.quaternion.angleTo(expected)).toBeLessThan(1e-6);
    } finally { instance.dispose(); }
  });

  it('plays the final ray shared clips even on nodes without a UVScroll component', () => {
    const instance = fixture(effects.roots.find(root => root.name === '100100_final_ray')!);
    try {
      for (let step = 0; step <= 30; step += 1) instance.effect.update(step / 30);
      expect(instance.effect.count).toBeGreaterThan(0);
      const mesh = instance.scene.children.find(node => node instanceof Mesh && node.name === '100100_final_ray/guru_UV') as Mesh;
      expect(mesh).toBeDefined();
      const animation = effects.simpleAnimations!.find(item => item.path === mesh.name)!;
      expect((mesh.material as import('three').RawShaderMaterial).uniforms._MainTex_ST.value.z)
        .toBeCloseTo(clipValues(animation.clips[0], 1)[0]);
    } finally { instance.dispose(); }
  });
  it('applies scalar UV tracks to their own particle material without shifting shared siblings', () => {
    const source = effects.roots.find(root => root.name === '100100_st_kensen')!;
    const instance = fixture(source);
    try {
      for (let step = 0; step <= 12; step += 1) instance.effect.update(step / 30);
      const animation = effects.simpleAnimations!.find(item => item.path === `${source.name}/kensen_add`)!;
      const clip = animation.clips[0];
      const expected = clipValues(clip, 0.4)[clip.bindings.find(b => b.attribute === 'uvOffsetX')!.scalarOffset];
      const animated = instance.scene.children.filter(node => node instanceof Mesh && node.name === animation.path) as Mesh[];
      expect(animated.length).toBeGreaterThan(0);
      for (const node of animated) expect((node.material as import('three').RawShaderMaterial).uniforms._MainTex_ST.value.z).toBeCloseTo(expected);
      const sibling = instance.scene.children.find(node => node instanceof Mesh && node.name === `${source.name}/aura_tutu`) as Mesh;
      expect(sibling).toBeDefined();
      // This sibling selects column 1 of its 8-column sheet and has no UVScroll.
      expect((sibling.material as import('three').RawShaderMaterial).uniforms._MainTex_ST.value.z).toBe(0.125);
    } finally { instance.dispose(); }
  });
  it('reverses only the legacy export conversion and provides a color for every vertex', () => {
    const geometries = particleGeometries(effects.meshes);
    for (const source of effects.meshes) {
      const geometry = geometries.get(source.pathId)!;
      const positions = geometry.getAttribute('in_POSITION0');
      const colors = geometry.getAttribute('in_COLOR0');
      expect(positions.count).toBe(source.vertices.length);
      expect(colors.count).toBe(positions.count);
      for (let i = 0; i < positions.count; i += 1) {
        expect(positions.getX(i)).toBeCloseTo(-source.vertices[i][0], 5);
        expect(positions.getY(i)).toBeCloseTo(source.vertices[i][1], 5);
        expect(positions.getZ(i)).toBeCloseTo(source.vertices[i][2], 5);
      }
      expect(Array.from(geometry.index!.array).slice(0, 3)).toEqual(source.indices.slice(0, 3).reverse());
      geometry.dispose();
    }
  });

  it('resolves every emitter and module by an exact source ID', () => {
    const systems = effects.roots.flatMap(root => root.particleSystems);
    expect(Object.keys(metadata.particleModules)).toHaveLength(systems.length);
    expect(new Set(systems.map(system => system.sourceId)).size).toBe(systems.length);
    expect(new Set(metadata.nodes.map(node => node.id)).size).toBe(metadata.nodes.length);
    for (const system of systems) {
      expect(system.sourceId).toMatch(/^-?\d+$/);
      expect(metadata.particleModules[system.sourceId!].path).toBe(system.path);
      const node = metadata.nodes.find(item => item.id === system.transformId);
      expect(node?.path).toBe(system.path);
      expect(node?.transform).toEqual(system.localTransform);
    }
  });

  it.each(['100100_charge_attach/moya_center', '100100_start_bg_cutin/middle_01'])(
    'preserves both same-named source nodes: %s', path => {
      const data = effects.roots.find(root => root.name === path.split('/')[0])!;
      const { effect, dispose } = fixture(data);
      try {
        const sourceNodes = metadata.nodes.filter(node => node.path === path);
        const runtimeNodes = effect.root.children.filter(node => node.name === path);
        expect(runtimeNodes).toHaveLength(2);
        expect(runtimeNodes.map(node => node.position.toArray())).toEqual(sourceNodes.map(node => node.transform.position));
        expect(runtimeNodes[0].position.equals(runtimeNodes[1].position)).toBe(false);
      } finally {
        dispose();
      }
    },
  );

  it('prewarms exactly one source duration and continues from that state', () => {
    const source = effects.roots.find(root => root.name === '100100_air_flow_cutin')!;
    const coldData = structuredClone(source);
    coldData.particleSystems.forEach(system => { system.particle.prewarm = false; });
    const warm = fixture(source); const cold = fixture(coldData);
    try {
      cold.effect.update(0);
      expect(cold.effect.count).toBe(0);
      for (let step = 1; step <= 30; step += 1) cold.effect.update(step / 30);
      warm.effect.update(0);
      expect(warm.effect.count).toBeGreaterThan(0);
      expect(warm.effect.count).toBe(cold.effect.count);
      expect(warm.effect.sample()).toEqual(cold.effect.sample());
      warm.effect.update(1 / 30);
      cold.effect.update(1 + 1 / 30);
      expect(warm.effect.sample()).toEqual(cold.effect.sample());
    } finally { warm.dispose(); cold.dispose(); }
  });

  it('does not emit authored bursts when the emission module is disabled', () => {
    const source = structuredClone(effects.roots.find(root => root.name === '100100_air_flow_cutin')!);
    for (const system of source.particleSystems) {
      system.particle.emission.enabled = false;
      system.particle.emission.bursts = [{ time: 0, cycleCount: 1, repeatInterval: 0, probability: 1,
        count: { state: 0, scalar: 10, minScalar: 10, keys: [] } }];
    }
    const instance = fixture(source);
    try {
      instance.effect.update(0);
      expect(instance.effect.count).toBe(0);
    } finally { instance.dispose(); }
  });

  it('caps forward acceleration without introducing backward displacement', () => {
    const source = structuredClone(effects.roots.find(root => root.name === '100100_st_kensen')!);
    source.particleSystems = [source.particleSystems.find(system => system.path.endsWith('/aura_tutu'))!];
    const system = source.particleSystems[0]; const particle = system.particle;
    const constant = (scalar: number) => ({ state: 0, scalar, minScalar: scalar, keys: [] });
    Object.assign(particle, { prewarm: false, looping: false, startDelay: constant(0), startSpeed: constant(10),
      startLifetime: constant(2), gravityModifier: constant(0), maxParticles: 1, simulationSpeed: 1 });
    particle.shape.enabled = false;
    particle.velocity.enabled = false;
    particle.emission = { enabled: true, rateOverTime: constant(0), rateOverDistance: constant(0),
      bursts: [{ time: 0, cycleCount: 1, repeatInterval: 0, probability: 1, count: constant(1) }] };
    const sceneMetadata = structuredClone(metadata);
    for (const node of sceneMetadata.nodes) {
      if (node.path === source.name || node.path.startsWith(`${source.name}/`)) {
        node.transform = { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] };
      }
    }
    const modules = sceneMetadata.particleModules[system.sourceId!];
    modules.force = { enabled: true, inWorldSpace: false, randomizePerFrame: false, x: constant(0), y: constant(0), z: constant(100) };
    modules.limitVelocity = { ...modules.limitVelocity, enabled: true, dampen: 1, separateAxes: false, magnitude: constant(1), drag: constant(0) };
    const instance = fixture(source, sceneMetadata);
    try {
      instance.effect.update(0);
      instance.effect.update(0.1);
      expect(instance.effect.sample()[0][2]).toBeCloseTo(0.1);
      instance.effect.update(0.2);
      expect(instance.effect.sample()[0][2]).toBeCloseTo(0.2);
    } finally { instance.dispose(); }
  });

  it.each([
    [0, 6, 0.6, 6], [1, 2, 0.2, 2], [2, 6, 0.1, 1],
  ])('uses scaling mode %i for spawn, movement and size independently', (mode, spawn, travel, size) => {
    const source = structuredClone(effects.roots.find(root => root.name === '100100_st_kensen')!);
    const system = source.particleSystems.find(system => system.path.endsWith('/aura_tutu'))!;
    source.particleSystems = [system];
    const constant = (scalar: number) => ({ state: 0, scalar, minScalar: scalar, keys: [] });
    Object.assign(system.particle, { scalingMode: mode, moveWithTransform: 0, prewarm: false, looping: false,
      simulationSpeed: 1, startDelay: constant(0), startSpeed: constant(1), startSize: constant(1),
      startLifetime: constant(2), gravityModifier: constant(0) });
    system.particle.shape = { ...system.particle.shape, enabled: true, type: 4, angle: 0, radius: 0,
      position: [0, 0, 1], rotation: [0, 0, 0], scale: [1, 1, 1] };
    system.particle.velocity.enabled = false;
    system.particle.sizeOverLifetime.enabled = false;
    system.particle.emission = { enabled: true, rateOverTime: constant(0), rateOverDistance: constant(0),
      bursts: [{ time: 0, cycleCount: 1, repeatInterval: 0, probability: 1, count: constant(1) }] };
    const sceneMetadata = structuredClone(metadata);
    const modules = sceneMetadata.particleModules[system.sourceId!];
    modules.force.enabled = false; modules.limitVelocity.enabled = false;
    for (const node of sceneMetadata.nodes) {
      if (node.path === source.name || node.path.startsWith(`${source.name}/`)) {
        const scale = node.path === source.name ? 3 : node.id === system.transformId ? 2 : 1;
        node.transform = { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [scale, scale, scale] };
      }
    }
    const instance = fixture(source, sceneMetadata);
    try {
      instance.effect.update(0);
      expect(instance.effect.sample()[0][2]).toBeCloseTo(spawn);
      instance.effect.update(0.1);
      expect(instance.effect.sample()[0][2]).toBeCloseTo(spawn + travel);
      const mesh = instance.scene.children.find(node => node instanceof Mesh && node.name === system.path)!;
      expect(mesh.scale.x).toBeCloseTo(size);
    } finally { instance.dispose(); }
  });
});

describe('FGO source birth sub-emitters', () => {
  const makeData = () => {
    const source = structuredClone(effects.roots.find(root => root.name === '100100_start_bg_pt')!);
    const parent = source.particleSystems.find(system => system.path.endsWith('/firefly_body_pt_01'))!;
    const child = source.particleSystems.find(system => system.path === `${parent.path}/firefly_Sub_pt`)!;
    source.particleSystems = [child, parent]; // Source record order must not determine who drives whom.
    const sceneMetadata = structuredClone(metadata);
    const constant = (scalar: number) => ({ state: 0, scalar, minScalar: scalar, keys: [] });
    for (const system of source.particleSystems) {
      Object.assign(system.particle, { prewarm: false, looping: false, duration: 1, simulationSpeed: 1,
        startDelay: constant(0), startSpeed: constant(system === parent ? 1 : 0),
        startLifetime: constant(system === parent ? 0.25 : 0.5), gravityModifier: constant(0) });
      system.particle.shape.enabled = false;
      system.particle.velocity.enabled = false;
      system.particle.emission = { enabled: true, rateOverTime: constant(system === parent ? 0 : 10),
        rateOverDistance: constant(0), bursts: system === parent
          ? [{ time: 0, cycleCount: 1, repeatInterval: 0, probability: 1, count: constant(1) }] : [] };
      sceneMetadata.particleModules[system.sourceId!].force.enabled = false;
      sceneMetadata.particleModules[system.sourceId!].limitVelocity.enabled = false;
    }
    for (const node of sceneMetadata.nodes) {
      if (node.path === source.name || node.path.startsWith(`${source.name}/`)) {
        node.transform = { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] };
      }
    }
    const childNode = sceneMetadata.nodes.find(node => node.id === child.transformId)!;
    childNode.transform.position = [8, 0, 0];
    return { source, parent, child, sceneMetadata };
  };
  const positions = (scene: Scene, path: string) => scene.children
    .filter(node => node instanceof Mesh && node.name === path).map(node => node.position.toArray());

  it('emits from moving parent particles and lets the trail outlive its parent', () => {
    const { source, child, sceneMetadata } = makeData();
    const instance = fixture(source, sceneMetadata);
    try {
      instance.effect.update(0);
      expect(positions(instance.scene, child.path)).toHaveLength(0);
      instance.effect.update(0.1);
      expect(positions(instance.scene, child.path)).toEqual([[0, 0, 0.1]]);
      instance.effect.update(0.2);
      expect(positions(instance.scene, child.path)).toEqual([[0, 0, 0.1], [0, 0, 0.2]]);
      instance.effect.update(0.3);
      expect(instance.effect.count).toBe(2); // Parent died at .25; its two children survive.
      expect(positions(instance.scene, child.path)).toEqual([[0, 0, 0.1], [0, 0, 0.2]]);
      instance.effect.update(0.8);
      expect(instance.effect.count).toBe(0);
    } finally { instance.dispose(); }
  });

  it('never starts the child independently when no parent particles are born', () => {
    const { source, parent, sceneMetadata } = makeData();
    parent.particle.emission.enabled = false;
    const instance = fixture(source, sceneMetadata);
    try {
      instance.effect.update(0); instance.effect.update(0.2);
      expect(instance.effect.count).toBe(0);
    } finally { instance.dispose(); }
  });

  it('honors a zero sub-emission probability without hiding the parent', () => {
    const { source, parent, child, sceneMetadata } = makeData();
    sceneMetadata.particleModules[parent.sourceId!].subEmitters[0].probability = 0;
    const instance = fixture(source, sceneMetadata);
    try {
      instance.effect.update(0); instance.effect.update(0.2);
      expect(instance.effect.count).toBe(1);
      expect(positions(instance.scene, child.path)).toHaveLength(0);
    } finally { instance.dispose(); }
  });

  it('prewarms the linked system once through the parent clock', () => {
    const { source, parent, child, sceneMetadata } = makeData();
    parent.particle.prewarm = true; parent.particle.looping = true;
    parent.particle.emission.bursts = [];
    parent.particle.emission.rateOverTime.scalar = 4;
    child.particle.prewarm = true; child.particle.looping = true;
    const coldData = structuredClone(source);
    coldData.particleSystems.forEach(system => { system.particle.prewarm = false; });
    const warm = fixture(source, sceneMetadata); const cold = fixture(coldData, sceneMetadata);
    try {
      for (let i = 0; i <= 30; i += 1) cold.effect.update(i / 30);
      warm.effect.update(0);
      expect(positions(warm.scene, child.path).length).toBeGreaterThan(0);
      expect(positions(warm.scene, child.path)).toEqual(positions(cold.scene, child.path));
      warm.effect.update(1 / 30); cold.effect.update(1 + 1 / 30);
      expect(positions(warm.scene, child.path)).toEqual(positions(cold.scene, child.path));
    } finally { warm.dispose(); cold.dispose(); }
  });
});
