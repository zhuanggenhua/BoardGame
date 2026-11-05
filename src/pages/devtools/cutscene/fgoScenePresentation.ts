import { BackSide, OneFactor, Vector3, type Mesh, type RawShaderMaterial } from 'three';

// Display-only choices for the web preview, not recovered Unity parameters.
const additiveGain: Readonly<Record<string, number>> = {
  '100100_cutin_front': 0.65,
  '100100_beam_light': 0.65,
  '100100_enemy_beam': 0.65,
  '100100_final_ray': 0.65,
  '100100_st_kensen': 1,
  '100100_kensen_cutin': 1,
  '100100_charge_attach': 0.18,
  '100100_swode_front_attach': 0.18,
  '100100_impact': 0.15,
};
const rootOpacity: Readonly<Record<string, number>> = {
  '100100_kensen_cutin': 1,
  '100100_charge_attach': 0.18,
  '100100_swode_front_attach': 0.18,
  '100100_impact': 0.15,
};
const launchOpacity: Readonly<Record<string, number>> = {
  '100100_beam_light/beam_base_add_y': 0.09,
  '100100_beam_light/beam_base_add_blur': 0.04,
};
const beamShotStart = 11.608659744262695;
const beamShotEnd = 13.484013557434082;
const beamThickness = new Vector3(1, 1, 0.55);

export const applyCameraPresentation = (position: Vector3, time: number) => {
  if (time < beamShotStart || time >= beamShotEnd) return;
  position.x -= 3.65;
  position.y += 1.164;
  position.z -= 11.29554;
};

export const applyParticlePresentation = (material: RawShaderMaterial, path: string) => {
  if (path === '100100_final_ray/tutu_UV') material.side = BackSide;
  const root = path.split('/')[0];
  const additive = material.blendDst === OneFactor;
  const gain = path === '100100_beam_light/beam_base_add_w' ? 0.2 : additiveGain[root];
  const opacity = launchOpacity[path] ?? rootOpacity[root];
  if (additive ? gain === undefined : opacity === undefined) return;
  material.uniforms.uPresentationGain = { value: additive ? gain : 1 };
  material.uniforms.uPresentationOpacity = { value: additive ? 1 : opacity };
  material.fragmentShader = `uniform highp float uPresentationGain;
    uniform highp float uPresentationOpacity;\n${material.fragmentShader
    .replace(/\bvoid\s+main\s*\(\s*\)/, 'void sourceMain()')}
    void main() {
      sourceMain();
      SV_Target0.rgb *= uPresentationGain;
      SV_Target0.a *= uPresentationOpacity;
    }`;
};

// Called once after each source simulation step, before the renderer reads matrices.
export const updateParticlePresentation = (mesh: Mesh, path: string, time: number) => {
  const material = mesh.material as RawShaderMaterial;
  if (path.startsWith('100100_st_kensen/') && material.uniforms.uPresentationGain) {
    material.uniforms.uPresentationGain.value = time >= 9.07 && time < 11.68 ? 0.12 : 1;
  }
  if (path.startsWith('100100_kensen_cutin/') && material.uniforms.uPresentationGain) {
    const fade = Math.max(0, Math.min(1, (10.98 - time) / 0.13));
    material.uniforms.uPresentationGain.value = material.blendDst === OneFactor ? fade : 1;
    material.uniforms.uPresentationOpacity.value = material.blendDst === OneFactor ? 1 : fade;
  }
  if (path.startsWith('100100_enemy_para/')) mesh.scale.multiplyScalar(0.35);
  if (path === '100100_enemy_beam/beam_base') mesh.matrix.scale(beamThickness);
  mesh.updateMatrixWorld(true);
};
