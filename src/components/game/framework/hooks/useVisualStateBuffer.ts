/**
 * UI 引擎框架 - 视觉状态缓冲 Hook
 *
 * 解决的核心问题：引擎管线在一个 tick 内完成所有 reduce（状态已是最终值），
 * 但 UI 需要按动画节奏逐步展示状态变化。
 *
 * 工作原理（双缓冲/快照模式）：
 * 1. 动画开始前，对受影响的属性做快照（冻结为动画前的值）
 * 2. 动画期间，UI 组件优先读快照值 → 视觉状态不变
 * 3. 动画 impact 时，释放指定 key → UI 回退到 core 真实值，血条/数值在 impact 瞬间变化
 * 4. 动画结束时，清空所有快照 → 完全回归 core
 *
 * 典型用法（棋盘游戏攻击动画）：
 * ```ts
 * const buffer = useVisualStateBuffer();
 *
 * // UNIT_ATTACKED 事件到来时：冻结目标格的 damage 值
 * buffer.freeze('3-4', coreDamageBeforeAttack);
 *
 * // 动画 impact 时：释放，让血条变化
 * buffer.release(['3-4']);
 *
 * // 动画结束时：清空
 * buffer.clear();
 *
 * // UI 组件读取：
 * const visualDamage = buffer.get('3-4', unit.damage);
 * // 有快照 → 返回快照值；无快照 → 返回 core 真实值
 * ```
 *
 * 支持任意 string key，不限于格坐标。可用于：
 * - 棋盘单位 damage（key = "row-col"）
 * - 玩家 HP（key = "player-0-hp"）
 * - 资源值（key = "player-1-gold"）
 * - 任何需要在动画期间冻结的数值属性
 */

import { useState, useCallback, useRef } from 'react';

export interface UseVisualStateBufferReturn {
  /**
   * 冻结指定 key 的值。
   * 动画期间 UI 读到的将是这个冻结值而非 core 真实值。
   */
  freeze: (key: string, value: number) => void;

  /**
   * 批量冻结多个 key。
   */
  freezeBatch: (entries: Array<{ key: string; value: number }>) => void;

  /**
   * 释放指定 key（删除快照），UI 将回退到 core 真实值。
   * 通常在动画 impact 瞬间调用。
   */
  release: (keys: string[]) => void;

  /**
   * 清空所有快照，完全回归 core 状态。
   * 通常在动画序列结束时调用。
   */
  clear: () => void;

  /**
   * 读取指定 key 的视觉值。
   * 有快照 → 返回快照值；无快照 → 返回 fallback（core 真实值）。
   */
  get: (key: string, fallback: number) => number;

  /**
   * 当前快照 Map（只读，供需要批量传递给子组件的场景）。
   * 为 null 表示无活跃快照。
   */
  snapshot: ReadonlyMap<string, number> | null;

  /**
   * 是否有活跃快照（可用于条件渲染优化）。
   */
  isBuffering: boolean;
}

export function useVisualStateBuffer(): UseVisualStateBufferReturn {
  const [snapshot, setSnapshot] = useState<Map<string, number> | null>(null);
  // ref 镜像，供 get() 同步读取（避免闭包过期）
  const snapshotRef = useRef<Map<string, number> | null>(null);

  const freeze = useCallback((key: string, value: number) => {
    setSnapshot(prev => {
      const next = new Map(prev ?? []);
      next.set(key, value);
      snapshotRef.current = next;
      return next;
    });
  }, []);

  const freezeBatch = useCallback((entries: Array<{ key: string; value: number }>) => {
    if (entries.length === 0) return;
    setSnapshot(prev => {
      const next = new Map(prev ?? []);
      for (const { key, value } of entries) {
        next.set(key, value);
      }
      snapshotRef.current = next;
      return next;
    });
  }, []);

  const release = useCallback((keys: string[]) => {
    setSnapshot(prev => {
      if (!prev) return prev;
      const next = new Map(prev);
      for (const key of keys) {
        next.delete(key);
      }
      const result = next.size === 0 ? null : next;
      snapshotRef.current = result;
      return result;
    });
  }, []);

  const clear = useCallback(() => {
    snapshotRef.current = null;
    setSnapshot(null);
  }, []);

  const get = useCallback((key: string, fallback: number): number => {
    const val = snapshotRef.current?.get(key);
    return val !== undefined ? val : fallback;
  }, []);

  return {
    freeze,
    freezeBatch,
    release,
    clear,
    get,
    snapshot,
    isBuffering: snapshot !== null,
  };
}
