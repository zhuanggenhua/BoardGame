/**
 * UI 引擎框架 - 视觉序列门控 Hook
 *
 * 类似 Unity 动画事件机制：用 beginSequence/endSequence 括住视觉序列（如攻击动画），
 * 期间通过 scheduleInteraction 调度的交互逻辑会自动延迟到序列结束后按序触发。
 *
 * 典型用法：
 * - 攻击事件 → beginSequence()
 * - 感染/灵魂转移等交互事件 → scheduleInteraction(() => setMode(...))
 * - 摧毁动画结束 → endSequence() → 自动排空队列，交互提示依次出现
 *
 * 支持嵌套序列（计数器），任何游戏可复用。
 */

import { useState, useCallback, useRef } from 'react';

export interface UseVisualSequenceGateReturn {
  /** 标记视觉序列开始（支持嵌套计数） */
  beginSequence: () => void;
  /** 标记视觉序列结束，计数归零时排空交互队列 */
  endSequence: () => void;
  /** 调度交互：序列进行中入队，否则立即执行 */
  scheduleInteraction: (fn: () => void) => void;
  /** 当前是否有活跃的视觉序列（响应式，可用于 UI 门控如延迟游戏结束） */
  isVisualBusy: boolean;
  /** 重置所有状态（撤销/回滚时） */
  reset: () => void;
}

/**
 * 视觉序列门控。
 *
 * beginSequence/endSequence 括住阻塞性动画序列（如攻击→伤害→摧毁），
 * 期间的 scheduleInteraction 回调自动入队，序列结束后按 FIFO 顺序执行。
 */
export function useVisualSequenceGate(): UseVisualSequenceGateReturn {
  const [isVisualBusy, setIsVisualBusy] = useState(false);

  // 嵌套计数器（ref，供同步判断）
  const sequenceDepthRef = useRef(0);
  // 交互回调 FIFO 队列
  const pendingInteractionsRef = useRef<Array<() => void>>([]);

  const beginSequence = useCallback(() => {
    sequenceDepthRef.current += 1;
    if (sequenceDepthRef.current === 1) {
      setIsVisualBusy(true);
    }
  }, []);

  const endSequence = useCallback(() => {
    sequenceDepthRef.current = Math.max(0, sequenceDepthRef.current - 1);
    if (sequenceDepthRef.current === 0) {
      // 排空交互队列
      const queue = pendingInteractionsRef.current;
      if (queue.length > 0) {
        pendingInteractionsRef.current = [];
        for (const fn of queue) {
          fn();
        }
      }
      setIsVisualBusy(false);
    }
  }, []);

  const scheduleInteraction = useCallback((fn: () => void) => {
    if (sequenceDepthRef.current > 0) {
      pendingInteractionsRef.current.push(fn);
    } else {
      fn();
    }
  }, []);

  const reset = useCallback(() => {
    sequenceDepthRef.current = 0;
    pendingInteractionsRef.current = [];
    setIsVisualBusy(false);
  }, []);

  return {
    beginSequence,
    endSequence,
    scheduleInteraction,
    isVisualBusy,
    reset,
  };
}
