import { describe, expect, it } from 'vitest';
import { BackSide, DoubleSide, Mesh, OneFactor, OneMinusSrcAlphaFactor, RawShaderMaterial, Vector3, type BlendingDstFactor } from 'three';
import { applyCameraPresentation, applyParticlePresentation, updateParticlePresentation } from '../cutscene/fgoScenePresentation';

const source = 'out vec4 SV_Target0; void main() { SV_Target0 = vec4(1.0); return; }';
const fixture = (blendDst: BlendingDstFactor = OneFactor) => new RawShaderMaterial({ fragmentShader: source, side: DoubleSide, blendDst });

describe('FGO web particle presentation', () => {
  it('keeps the original final-ray mesh but excludes its near-facing surface', () => {
    const material = fixture();
    applyParticlePresentation(material, '100100_final_ray/tutu_UV');
    expect(material.side).toBe(BackSide);
    expect(material.uniforms.uPresentationGain.value).toBe(0.65);
    expect(material.fragmentShader).toContain('void sourceMain()');
    expect(material.fragmentShader).toContain('uniform highp float uPresentationGain;');
    expect(material.fragmentShader).toContain('sourceMain();');
    expect(material.fragmentShader).toContain('SV_Target0.rgb *= uPresentationGain');
    material.dispose();
  });

  it.each(['100100_beam_light/beam_base', '100100_enemy_beam/beam_base', '100100_cutin_front/glow'])(
    'limits only additive brightness without changing opacity or shader inputs: %s', path => {
      const material = fixture();
      applyParticlePresentation(material, path);
      expect(material.uniforms.uPresentationGain.value).toBe(0.65);
      expect(material.uniforms.uPresentationOpacity.value).toBe(1);
      expect(material.fragmentShader).toContain('SV_Target0 = vec4(1.0)');
      expect(material.side).toBe(DoubleSide);
      material.dispose();
    });

  it('preserves alpha-blended smoke, the opening and unrelated material programs', () => {
    for (const [path, blend] of [
      ['100100_final_ray/cloud', OneMinusSrcAlphaFactor], ['100100_sword_attach/aura', OneFactor],
    ] as const) {
      const material = fixture(blend);
      applyParticlePresentation(material, path);
      expect(material.fragmentShader).toBe(source);
      expect(material.uniforms).not.toHaveProperty('uPresentationGain');
      expect(material.side).toBe(DoubleSide);
      material.dispose();
    }
  });

  it('keeps the opening sword glow and reduces it only during the portrait shot', () => {
    const material = fixture();
    const mesh = new Mesh(undefined, material);
    applyParticlePresentation(material, '100100_st_kensen/aura_tutu');
    for (const [time, gain] of [[0.953, 1], [8.7, 1], [9.1, 0.12], [10.5, 0.12], [11.7, 1]]) {
      updateParticlePresentation(mesh, '100100_st_kensen/aura_tutu', time);
      expect(material.uniforms.uPresentationGain.value).toBe(gain);
    }
    material.dispose();
    mesh.geometry.dispose();
  });

  it('reframes only the lateral beam shot and preserves the source camera outside it', () => {
    for (const time of [0.953, 10.5, 11.6086, 13.4841, 16.5]) {
      const position = new Vector3(-4.35, 1.336, -52.70446);
      applyCameraPresentation(position, time);
      expect(position.toArray()).toEqual([-4.35, 1.336, -52.70446]);
    }
    const position = new Vector3(-4.35, 1.336, -52.70446);
    applyCameraPresentation(position, 12.5);
    expect(position.x).toBeCloseTo(-8);
    expect(position.y).toBeCloseTo(2.5);
    expect(position.z).toBeCloseTo(-64);
  });

  it('changes beam thickness without losing its native sheared matrix or translation', () => {
    const mesh = new Mesh();
    mesh.matrixAutoUpdate = false;
    mesh.matrix.set(2, 1, 3, 31, 0, 4, 5, 1.46, 0, 0, 6, -44.22, 0, 0, 0, 1);
    const source = mesh.matrix.clone();
    updateParticlePresentation(mesh, '100100_enemy_beam/beam_base', 12.5);
    expect(mesh.matrix.elements).toEqual(source.scale(new Vector3(1, 1, 0.55)).elements);
    expect(mesh.matrixWorld.elements.slice(12, 15)).toEqual([31, 1.46, -44.22]);
    mesh.geometry.dispose();
    mesh.material.dispose();
  });

  it('reduces lens-flare size without changing its world position', () => {
    const mesh = new Mesh();
    mesh.position.set(-1.58, 1.46, -49.77);
    mesh.scale.setScalar(20);
    updateParticlePresentation(mesh, '100100_enemy_para/niji', 12.5);
    expect(mesh.scale.toArray()).toEqual([7, 7, 7]);
    expect(mesh.position.toArray()).toEqual([-1.58, 1.46, -49.77]);
    mesh.geometry.dispose();
    mesh.material.dispose();
  });

  it('limits launch alpha-glow opacity without darkening its original texture color', () => {
    for (const [suffix, opacity] of [['y', 0.09], ['blur', 0.04]] as const) {
      const material = fixture(OneMinusSrcAlphaFactor);
      applyParticlePresentation(material, `100100_beam_light/beam_base_add_${suffix}`);
      expect(material.uniforms.uPresentationGain.value).toBe(1);
      expect(material.uniforms.uPresentationOpacity.value).toBe(opacity);
      expect(material.blendDst).toBe(OneMinusSrcAlphaFactor);
      material.dispose();
    }
  });

  it.each(['100100_charge_attach', '100100_swode_front_attach', '100100_impact'])(
    'retains charge textures and blend modes while lowering excessive overlay: %s', root => {
      const gain = root === '100100_impact' ? 0.15 : 0.18;
      for (const blend of [OneFactor, OneMinusSrcAlphaFactor]) {
        const material = fixture(blend);
        applyParticlePresentation(material, `${root}/glow`);
        expect(material.uniforms.uPresentationGain.value).toBe(blend === OneFactor ? gain : 1);
        expect(material.uniforms.uPresentationOpacity.value).toBe(blend === OneFactor ? 1 : gain);
        expect(material.blendDst).toBe(blend);
        expect(material.fragmentShader).toContain('SV_Target0 = vec4(1.0)');
        material.dispose();
      }
    },
  );

  it.each([OneFactor, OneMinusSrcAlphaFactor])('fades the portrait overlay before the pullback exposes its quad edge: %s', blend => {
    const material = fixture(blend);
    const mesh = new Mesh(undefined, material);
    const path = '100100_kensen_cutin/glow';
    applyParticlePresentation(material, path);
    for (const time of [10.5, 10.915, 11]) {
      updateParticlePresentation(mesh, path, time);
      const fade = Math.max(0, Math.min(1, (10.98 - time) / 0.13));
      expect(material.uniforms.uPresentationGain.value).toBe(blend === OneFactor ? fade : 1);
      expect(material.uniforms.uPresentationOpacity.value).toBe(blend === OneFactor ? 1 : fade);
    }
    mesh.geometry.dispose();
    material.dispose();
  });
});
