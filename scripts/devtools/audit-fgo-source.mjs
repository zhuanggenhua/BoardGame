import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = resolve('public/assets/dev/fgo-cutscene/np100100');
const files = ['np100100_scene.json', 'np100100_effects.json', 'np100100_builtin.json'];
const hashes = {};
const data = [];
for (const file of files) {
  const bytes = await readFile(resolve(base, file));
  hashes[file] = createHash('sha256').update(bytes).digest('hex');
  data.push(JSON.parse(bytes));
}
const [scene, effects, builtin] = data;
scene.nodes.push(...builtin.scene.nodes);
Object.assign(scene.particleModules, builtin.scene.particleModules);
Object.assign(scene.textureSamplers, builtin.scene.textureSamplers);
effects.roots.push(...builtin.effects.roots);
effects.uvScrolls.push(...builtin.effects.uvScrolls);
const systems = effects.roots.flatMap(root => root.particleSystems);
const nodes = new Map(scene.nodes.map(node => [node.id, node]));
const identityErrors = [];
const ids = new Set();
for (const system of systems) {
  if (!system.sourceId || ids.has(system.sourceId)) identityErrors.push(`Invalid/duplicate emitter ID: ${system.path}`);
  ids.add(system.sourceId);
  if (nodes.get(system.transformId)?.path !== system.path) identityErrors.push(`Transform mismatch: ${system.path}`);
  if (scene.particleModules[system.sourceId]?.path !== system.path) identityErrors.push(`Module mismatch: ${system.path}`);
}
const grouped = new Map();
for (const node of scene.nodes) {
  const group = grouped.get(node.path) ?? [];
  group.push({ id: node.id, parentId: node.parentId, position: node.transform.position });
  grouped.set(node.path, group);
}
const moduleCounts = {};
const missingLimits = [];
const subEmitters = [];
for (const [sourceId, modules] of Object.entries(scene.particleModules)) {
  for (const name of modules.enabledModules) moduleCounts[name] = (moduleCounts[name] ?? 0) + 1;
  const limit = modules.limitVelocity;
  if (limit.enabled && !(limit.dampen === 1 && !limit.separateAxes && limit.drag.state === 0 && limit.drag.scalar === 0)) {
    missingLimits.push({ sourceId, path: modules.path, dampen: limit.dampen });
  }
  for (const sub of modules.subEmitters) subEmitters.push({ parentId: sourceId, parent: modules.path, ...sub });
}
const actorColors = effects.timeline.filter(event => event.type === 'colorChange' && event.colorTarget === 4
  && /^chr_10010[01]\(Clone\)\/body_level_[23]$/.test(event.otherHierarchyPath ?? ''));
const shakes = effects.timeline.filter(event => event.type === 'shake');
const missingEvents = effects.timeline.filter(event => ['timeScale', 'targetAnimation'].includes(event.type)
  || (event.type === 'shake' && (event.isRelative || event.fixedUpdate))
  || (event.type === 'colorChange' && !actorColors.includes(event))
  || (event.type === 'displayChange' && event.displayTarget !== 0));
const unknownEffects = effects.timeline.filter(event => event.type === 'playEffect'
  && !effects.roots.some(root => root.name === event.target));
const birthLinks = [];
const unsupportedLinks = [];
for (const link of subEmitters.filter(link => link.sourceId)) {
  const parent = systems.find(system => system.sourceId === link.parentId)?.particle;
  const child = systems.find(system => system.sourceId === link.sourceId)?.particle;
  const supported = child && parent && link.type === 0 && link.properties === 0
    && child.simulationSpeed === parent.simulationSpeed && child.startDelay.state === 0 && child.startDelay.scalar === 0
    && !child.emission.bursts.length && child.emission.rateOverDistance.state === 0 && child.emission.rateOverDistance.scalar === 0;
  (supported ? birthLinks : unsupportedLinks).push(link);
}
const report = {
  acceptance: 'INCOMPLETE: identity checks are not visual parity acceptance',
  inputSha256: hashes,
  builtinAssetSource: builtin.source,
  playerSettings: { unityVersion: '2022.3.62f2', activeColorSpace: 0, colorSpace: 'Gamma', source: 'APK globalgamemanagers PlayerSettings' },
  webPresentation: {
    acceptanceTarget: 'User-approved web visual quality; no native pixel-parity claim',
    sourceAssetsModified: false,
    finalRayEnvelope: { path: '100100_final_ray/tutu_UV', side: 'BackSide',
      reason: 'Avoid the near-facing tube surface crossing the camera as a hard bright plane' },
    beamHighlights: '0.65 RGB gain on additive passes in cutin_front, beam_light, enemy_beam and final_ray; alpha-blended smoke and actor colors unchanged',
    closeupSwordGlow: '0.12 additive gain only during the portrait shot (9.07-11.68s)',
    launchGlow: 'White additive core gain 0.2; alpha-blended yellow and blur opacity 0.09/0.04; portrait sword overlay fades over 10.85-10.98s to avoid exposed quad edge',
    chargeGlow: '0.18 additive gain or alpha opacity on charge_attach/swode_front_attach, 0.15 on impact; original textures and blend modes retained',
    lateralBeam: 'Camera offset (-3.65, 1.164, -11.29554) in source shot 11.608659744-13.484013557s; beam mesh thickness 0.55; lens-flare size 0.35',
    opening: 'Original direct render path before beam effects',
  },
  identity: { emitterCount: systems.length, nodeCount: nodes.size, errors: identityErrors,
    repeatedNamesPreserved: Object.fromEntries([...grouped].filter(([, group]) => group.length > 1)) },
  cameras: scene.cameras,
  textureSamplers: scene.textureSamplers,
  enabledModuleCounts: moduleCounts,
  implementedPrewarm: systems.filter(system => system.particle.prewarm && system.particle.looping)
    .map(system => ({ sourceId: system.sourceId, path: system.path, duration: system.particle.duration })),
  implementedBirthSubEmitters: birthLinks,
  implementedActorColorEvents: actorColors,
  implementedUvScrollComponents: effects.uvScrolls,
  implementedCameraShakeEvents: shakes.filter(event => !event.isRelative && !event.fixedUpdate),
  implementedBillboardScreenSizeLimits: systems.filter(system => [0, 1, 2, 3].includes(system.renderer.renderMode))
    .map(system => ({ sourceId: system.sourceId, path: system.path, min: system.renderer.minParticleSize, max: system.renderer.maxParticleSize })),
  nativeMethodEvidence: {
    package: 'com.bilibili.fgo.vivo 2.129.0',
    uvScroll: { architecture: 'ARM64', address: '0x37f0d18', call: 'Material.SetTextureOffset at 0x540fe4c' },
    characterColor: { architecture: 'ARMv7', address: '0x26f0a50',
      color: 'baseColor.rgb*(1-t), alpha=1',
      addColor: 'baseAddColor.rgb*(1-t)+fadeColour.rgb*t, alpha=baseAddColor.a*(1-t)' },
    timeScale: { architecture: 'ARM64', address: '0x349490c',
      condition: 'BattleSequenceManager.isAuthTDAccelerate', operation: 'save/set/restore UnityEngine.Time.timeScale', implemented: false },
    cameraShake: { architecture: 'ARM64', regionXor: '0x14', fire: '0x349388c', process: '0x3493964', undo: '0x3493b40',
      x: 'Random.Range(0,horizontalSize) * sign(sinf(float(frameCount)*PI/1.4f))',
      y: 'Random.Range(0,verticalSize) * sign(sinf(float(frameCount)*PI))',
      signAtZero: 1, target: 'affectedObject.transform.parent.localPosition',
      reset: 'isRelative ? savedPosition : Vector3.zero',
      replayDifference: 'Native global RNG is replaced by a deterministic per-event stream at the simulation frame rate' },
    playEffect: { architecture: 'ARM64', fire: '0x348b040', process: '0x348b690',
      sampling: 'Default Animation/SimpleAnimation state time=0 on Fire; time=localEventTime on Process; enable, Sample, disable',
      legacyCalls: { getDefaultClip: '0x53f1cd4', sample: '0x53f1f20', setStateTime: '0x53f29f0', setStateEnabled: '0x53f28a4' },
      simpleAnimationAssembly: 'SimpleAnimationComponent.dll', simpleAnimationSample: '0x4fa90f4',
      uvScrollOnFire: '0x37f0d18' },
    localMeshComposition: { binary: 'libunity.so', architecture: 'ARM64',
      drawPath: '0x12ad6ac', matrixHelper: '0x12bc51c', compositionTail: '0x12bcb54-0x12bcc60',
      tailStorageShift: '-0x30000', tailRegionXor: '0x14',
      order: 'R_emitter * S_simulation * R_particle * S_size',
      implementedRenderMode: 4, implementedAlignment: 2,
      fixture: 'scripts/devtools/fixtures/fgo-native-mesh-matrices.json',
      proof: 'Unicorn execution of native composition tail for uniform, nonuniform and mirrored scales; not full particle-engine emulation' },
    billboardScreenSize: { binary: 'libunity.so', architecture: 'ARM64',
      parameterPreparation: '0x1079f2c', drawConsumer: '0x12c2688-0x12c28ac',
      stretchedDrawConsumer: '0x12c876c-0x12c8820 (before length/velocity stretching)',
      horizontalVerticalDrawConsumer: '0x12c9bac-0x12c9d08',
      cameraRecord: '0xe85060', farPlaneViewportWidth: '0xe65de0', farClipGetter: '0xe5ed5c (region XOR 0x14)',
      units: 'viewportWorldWidthAtParticleViewDepth / max(selectedSimulationScale.x,1e-5)',
      longest: 'max(particleSize.x,particleSize.y,1e-6)',
      scale: 'Clamp(longest,min*units,max*units)/longest; negative thresholds follow native comparison masks',
      simulationScale: { hierarchy: '0x1089088', local: '0x108861c', shape: '0x1088850' },
      implementedRenderModes: [0, 1, 2, 3],
      unverified: 'Native Hierarchy TRS scale helper versus Three matrix decomposition under shear or negative scale' },
  },
  particleScalingModes: Object.fromEntries([0, 1, 2].map(mode => [mode, systems.filter(system => system.particle.scalingMode === mode).length])),
  unimplemented: {
    softLimitsOrDrag: missingLimits,
    subEmitterLinks: unsupportedLinks,
    timeline: missingEvents,
    unresolvedEffects: unknownEffects,
  },
  nullSubEmitterReferences: subEmitters.filter(sub => !sub.sourceId),
  unverifiedEngineParity: [
    'Native particle RNG, simulation/prewarm step, force integration and hard-cap integration order',
    'Birth sub-emitter curve clock and within-step parent-trajectory interpolation against native Unity',
    'Transparent bounds sorting now uses root-bone/dynamic skinned bounds and rendered particle bounds; native particle bound inflation and sortingFudge metric remain unverified',
    'Camera runtime target mapping, shake frame cadence/global RNG and conditional global timeScale semantics',
    'Particle shape volume distribution and inverse Euler spawn/order remain unprobed in native Unity',
    'Stretched billboard basis and source pivot sign require further native-engine parity evidence',
    'Background selector/lighting and cut-in sprite alignment',
    'Framebuffer transfer function; original PlayerSettings Gamma color space is confirmed',
    'Two default-particle mip chains are regenerated from PNG; native lower mip texels are not exported',
    'Reference video time alignment; no frame-by-frame parity acceptance yet',
  ],
};
const out = resolve('test-results/fgo-source-audit.json');
await mkdir(resolve('test-results'), { recursive: true });
await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ out, identityErrors, moduleCounts,
  missing: { softLimitsOrDrag: missingLimits.length, subEmitterLinks: report.unimplemented.subEmitterLinks.length,
    events: missingEvents.length, effects: unknownEffects.map(event => event.target) },
  prewarmEnabled: report.implementedPrewarm.length, implementedBirthLinks: birthLinks.length }, null, 2));
if (identityErrors.length) process.exitCode = 1;
