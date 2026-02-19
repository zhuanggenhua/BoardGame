/**
 * UI 引擎框架 - 自动跳过阶段 Hook
 *
 * 当游戏阶段无可用操作且无活跃交互时，延迟后自动推进阶段。
 * 游戏层注入判定逻辑，框架统一处理守卫、延迟和 cleanup。
 *
 * 撤回保护（框架内置）：当检测到 undo 快照数减少（即发生了撤回恢复），
 * 永久抑制自动跳过，直到玩家主动执行了新命令（快照数重新增加）。
 * 所有游戏必须传入 undoSnapshotCount，确保撤回保护全局生效。
 */

import { useEffect, useRef } from 'react';

export interface UseAutoSkipPhaseConfig {
  /** 是否为当前玩家回合 */
  isMyTurn: boolean;
  /** 游戏是否结束 */
  isGameOver: boolean;
  /** 当前阶段是否有可用操作（游戏层提供） */
  hasAvailableActions: boolean;
  /** 是否存在活跃的交互模式（多步骤事件、技能选择等） */
  hasActiveInteraction: boolean;
  /** 推进阶段的回调 */
  advancePhase: () => void;
  /** 自动跳过前的延迟（毫秒），默认 300 */
  delay?: number;
  /** 额外的全局禁用判定（如 hostStarted 等游戏特定条件） */
  enabled?: boolean;
  /**
   * 当前 undo 快照数量（通过 getUndoSnapshotCount(G.sys?.undo) 获取）。
   * 框架层通过监测此值减少来检测撤回恢复，永久抑制自动跳过，
   * 直到快照数重新增加（玩家执行了新命令）。
   * 所有游戏必传，确保撤回保护全局生效。
   */
  undoSnapshotCount: number;
}

/**
 * 自动跳过无操作阶段。
 *
 * 当以下条件全部满足时，延迟后调用 advancePhase：
 * 1. enabled !== false（默认启用）
 * 2. 是当前玩家回合
 * 3. 游戏未结束
 * 4. 无活跃交互模式
 * 5. hasAvailableActions 为 false
 * 6. 未处于撤回恢复抑制状态
 */
export function useAutoSkipPhase({
  isMyTurn,
  isGameOver,
  hasAvailableActions,
  hasActiveInteraction,
  advancePhase,
  delay = 300,
  enabled = true,
  undoSnapshotCount,
}: UseAutoSkipPhaseConfig): void {
  // 撤回恢复检测：快照数减少 → 永久抑制，直到快照数重新增加
  const prevSnapshotCountRef = useRef(undoSnapshotCount);
  const suppressedRef = useRef(false);

  useEffect(() => {
    const prev = prevSnapshotCountRef.current;
    prevSnapshotCountRef.current = undoSnapshotCount;

    if (undoSnapshotCount < prev) {
      // 快照数减少 = 撤回恢复，进入抑制状态
      suppressedRef.current = true;
    } else if (undoSnapshotCount > prev && suppressedRef.current) {
      // 快照数增加 = 玩家执行了新命令，解除抑制
      suppressedRef.current = false;
    }
  }, [undoSnapshotCount]);

  useEffect(() => {
    if (!enabled) return;
    if (!isMyTurn || isGameOver) return;
    if (hasActiveInteraction) return;
    if (hasAvailableActions) return;
    if (suppressedRef.current) return;

    const timer = setTimeout(advancePhase, delay);
    return () => clearTimeout(timer);
  }, [enabled, isMyTurn, isGameOver, hasActiveInteraction, hasAvailableActions, advancePhase, delay]);
}
