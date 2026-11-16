import type { SkinAnimation } from './fgoSceneData';
import { clipValues } from './fgoSceneMath';

const NORMAL_ATTACK = /^attack_(?:a|b|q)(?:\d+)?$/;
// 现有素材以 Unity 单位导出；超过这一升幅的动作为高跳，不适合缺少场景位移的普攻播放。
const MAX_GROUNDED_RISE = 0.7;

/** 根据素材中躯干高度轨道筛掉高跳，不依赖角色或动作名称名单。 */
export function groundedFgoAttacks(animations: SkinAnimation[]): SkinAnimation[] {
  return animations.filter(clip => {
    if (!NORMAL_ATTACK.test(clip.name)) return false;
    const anchor = ['n_full', 'joint_hip'].map(name => clip.bindings.find(binding =>
      binding.attribute === 'position' && binding.path.endsWith(`/${name}`),
    )).find(Boolean);
    if (!anchor) return false;
    const offset = anchor.scalarOffset + 1;
    const start = clipValues(clip, 0, false, true)[offset];
    if (!Number.isFinite(start)) return false;
    for (const frame of clip.frames) {
      if (frame.time < 0) continue;
      for (const [index, coefficients] of frame.keys) {
        if (index === offset && coefficients[3] - start > MAX_GROUNDED_RISE) return false;
      }
    }
    return true;
  });
}
