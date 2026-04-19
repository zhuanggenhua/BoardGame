/**
 * FxRegistry — FX 渲染器注册表
 *
 * 职责：维护 cue → renderer 映射关系，支持通配符匹配。
 *
 * 设计参考：
 * - UE GameplayCueManager（tag → handler 映射）
 * - Unity 大厂 EffectManager（ScriptableObject 配置表）
 *
 * 通配符规则：
 * - 精确匹配优先级最高（'fx.combat.shockwave'）
 * - 通配符按层级深度降序（'fx.combat.*' > 'fx.*'）
 *
 * @example
 * ```ts
 * const registry = new FxRegistry();
 * registry.register('fx.summon', SummonRenderer, { timeoutMs: 3000 });
 * registry.register('fx.combat.*', GenericCombatRenderer);
 * registry.register('fx.combat.shockwave', ShockwaveRenderer); // 精确，高优先级
 *
 * registry.resolve('fx.combat.shockwave'); // → ShockwaveRenderer entry
 * registry.resolve('fx.combat.damage');    // → GenericCombatRenderer entry (通配符)
 * registry.resolve('fx.unknown');          // → null
 * ```
 */

import type { FxCue, FxRenderer, FxRendererOptions, FxRegistryEntry, FeedbackPack } from './types';

// ============================================================================
// 默认选项
// ============================================================================

const DEFAULT_OPTIONS: Required<FxRendererOptions> = {
  layer: 0,
  maxConcurrent: 0,
  debounceMs: 0,
  timeoutMs: 5000,
};

// ============================================================================
// Registry
// ============================================================================

export class FxRegistry {
  /** 精确匹配表 */
  private _exact = new Map<FxCue, FxRegistryEntry>();
  /** 通配符匹配表（按层级深度降序排列） */
  private _wildcards: Array<{ pattern: string; prefix: string; entry: FxRegistryEntry }> = [];

  /**
   * 注册渲染器
   *
   * @param cue - Cue 标识符，支持尾部通配符（如 'fx.combat.*'）
   * @param renderer - 渲染器组件
   * @param options - 可选配置
   * @param feedback - 反馈包（音效 + 震动），注册时声明，运行时自动触发
   */
  register(cue: FxCue, renderer: FxRenderer, options?: FxRendererOptions, feedback?: FeedbackPack): void {
    const entry: FxRegistryEntry = {
      cue,
      renderer,
      options: { ...DEFAULT_OPTIONS, ...options },
      feedback,
    };

    if (cue.endsWith('.*')) {
      const prefix = cue.slice(0, -1); // 'fx.combat.*' → 'fx.combat.'
      // 去重：如果已有相同 pattern 则替换
      this._wildcards = this._wildcards.filter(w => w.pattern !== cue);
      this._wildcards.push({ pattern: cue, prefix, entry });
      // 按 prefix 长度降序排列（更深的通配符优先）
      this._wildcards.sort((a, b) => b.prefix.length - a.prefix.length);
    } else {
      this._exact.set(cue, entry);
    }
  }

  /**
   * 解析 cue → 注册条目
   *
   * 优先级：精确匹配 > 通配符（深度优先）
   */
  resolve(cue: FxCue): FxRegistryEntry | null {
    // 1. 精确匹配
    const exact = this._exact.get(cue);
    if (exact) return exact;

    // 2. 通配符匹配（已按深度排序）
    for (const w of this._wildcards) {
      if (cue.startsWith(w.prefix)) return w.entry;
    }

    return null;
  }

  /** 检查 cue 是否已注册（精确或通配符） */
  has(cue: FxCue): boolean {
    return this.resolve(cue) !== null;
  }

  /** 获取所有已注册的精确 cue 列表（调试用） */
  get registeredCues(): FxCue[] {
    return [
      ...this._exact.keys(),
      ...this._wildcards.map(w => w.pattern),
    ];
  }
}
