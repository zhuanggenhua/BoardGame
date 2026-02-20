/**
 * 大杀四方 - 游戏事件流消费 Hook
 *
 * 使用 EventStreamSystem 消费事件，驱动 FX 特效系统
 * 遵循 lastSeenEventId 模式，首次挂载跳过历史事件
 *
 * 视觉特效（力量浮字/行动卡展示/VP飞行/基地占领/触发器动画）通过 fxBus.push() 触发，
 * 非视觉反馈（能力反馈 toast）保留本地状态管理。
 *
 * 触发器动画检测（Approach A）：
 * 不依赖领域层发射 ABILITY_TRIGGERED 事件，而是在 UI 层检测事件的 reason 字段
 * 是否匹配已注册的触发器 sourceDefId，自动推入 FX 动画。
 * 这样保持领域层纯净，无需修改任何测试。
 */

import { useCallback, useEffect, useState, useMemo } from 'react';
import type { MatchState } from '../../../engine/types';
import type { SmashUpCore } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import type { AbilityFeedbackEvent } from '../domain/types';
import { getEventStreamEntries } from '../../../engine/systems/EventStreamSystem';
import { useEventStreamCursor } from '../../../engine/hooks';
import type { FxBus } from '../../../engine/fx';
import { SU_FX } from './fxSetup';
import { getRegisteredOngoingEffectIds } from '../domain/ongoingEffects';

// ============================================================================
// 类型（保留供外部引用）
// ============================================================================

/** 能力反馈提示数据 */
export interface AbilityFeedbackEffect {
  id: string;
  playerId: string;
  messageKey: string;
  messageParams?: Record<string, string | number>;
  tone: 'info' | 'warning';
}

// ============================================================================
// Hook
// ============================================================================

interface UseGameEventsParams {
  G: MatchState<SmashUpCore>;
  myPlayerId: string;
  /** FX 事件总线 */
  fxBus: FxBus;
  /** 基地 DOM 引用（用于定位力量浮字） */
  baseRefs: React.RefObject<Map<number, HTMLElement>>;
}

export function useGameEvents({ G, fxBus, baseRefs }: UseGameEventsParams) {
  const entries = getEventStreamEntries(G);
  const { consumeNew } = useEventStreamCursor({ entries });

  // 非视觉反馈（toast）保留本地状态
  const [feedbacks, setFeedbacks] = useState<AbilityFeedbackEffect[]>([]);

  // 缓存已注册的触发器 sourceDefId 集合（用于检测触发器动画）
  const triggerDefIds = useMemo(() => {
    const { triggerIds } = getRegisteredOngoingEffectIds();
    return new Set(triggerIds.keys());
  }, []);

  // 携带 reason 字段的事件类型集合（这些事件可能由触发器产生）
  const TRIGGER_CARRIER_EVENTS = useMemo(() => new Set([
    SU_EVENTS.MINION_DESTROYED,
    SU_EVENTS.CARDS_DISCARDED,
    SU_EVENTS.ONGOING_DETACHED,
    SU_EVENTS.LIMIT_MODIFIED,
    SU_EVENTS.MINION_RETURNED,
    SU_EVENTS.MINION_MOVED,
    SU_EVENTS.POWER_COUNTER_ADDED,
    SU_EVENTS.POWER_COUNTER_REMOVED,
    SU_EVENTS.BREAKPOINT_MODIFIED,
    SU_EVENTS.VP_AWARDED,
  ]), []);

  // 消费事件流 → 推入 FX 系统
  useEffect(() => {
    const { entries: newEntries } = consumeNew();

    if (newEntries.length === 0) return;

    // 去重：同一批事件中同一个 triggerDefId 只触发一次动画
    const triggeredThisBatch = new Set<string>();
    let uidCounter = Date.now();

    for (const entry of newEntries) {
      const event = entry.event;

      // 触发器动画检测：检查事件 reason 是否匹配已注册的触发器
      if (TRIGGER_CARRIER_EVENTS.has(event.type)) {
        const reason = (event.payload as { reason?: string })?.reason;
        if (reason && triggerDefIds.has(reason) && !triggeredThisBatch.has(reason)) {
          triggeredThisBatch.add(reason);
          // 尝试从事件中提取基地索引用于定位动画
          const baseIndex = (event.payload as { fromBaseIndex?: number; baseIndex?: number })?.fromBaseIndex
            ?? (event.payload as { baseIndex?: number })?.baseIndex;
          const baseEl = baseIndex !== undefined ? baseRefs.current?.get(baseIndex) : undefined;
          let position: { left: number; top: number } | undefined;
          if (baseEl) {
            const rect = baseEl.getBoundingClientRect();
            position = { left: rect.left + rect.width / 2, top: rect.top };
          }
          fxBus.push(SU_FX.ABILITY_TRIGGERED, { space: 'screen' }, {
            sourceDefId: reason,
            position,
          });
        }
      }

      switch (event.type) {
        case SU_EVENTS.MINION_PLAYED: {
          const p = event.payload as {
            playerId: string; cardUid: string; defId: string;
            baseIndex: number; power: number;
          };
          // 力量变化浮字 → FX
          const baseEl = baseRefs.current?.get(p.baseIndex);
          if (baseEl) {
            const rect = baseEl.getBoundingClientRect();
            fxBus.push(SU_FX.POWER_CHANGE, { space: 'screen' }, {
              delta: p.power,
              position: { left: rect.right + 8, top: rect.top - 10 },
            });
          }
          break;
        }

        case SU_EVENTS.ACTION_PLAYED: {
          // 行动卡展示已迁移到 CardSpotlightQueue（点击关闭），不再走 FX 系统
          break;
        }

        case SU_EVENTS.BASE_SCORED: {
          const p = event.payload as {
            baseIndex: number; baseDefId: string;
            rankings: Array<{ playerId: string; power: number; vp: number }>;
          };
          // VP 飞行 → FX
          fxBus.push(SU_FX.BASE_SCORED, { space: 'screen' }, {
            rankings: p.rankings,
          });
          break;
        }

        case SU_EVENTS.ABILITY_FEEDBACK: {
          const p = (event as AbilityFeedbackEvent).payload;
          setFeedbacks(prev => [...prev, {
            id: `fb-${uidCounter++}`,
            playerId: p.playerId,
            messageKey: p.messageKey,
            messageParams: p.messageParams,
            tone: p.tone ?? 'info',
          }]);
          break;
        }
      }
    }
  }, [G, consumeNew, fxBus, baseRefs, triggerDefIds, TRIGGER_CARRIER_EVENTS]);

  // 清除已完成的反馈
  const removeFeedback = useCallback((id: string) => {
    setFeedbacks(prev => prev.filter(e => e.id !== id));
  }, []);

  return {
    feedbacks, removeFeedback,
  };
}
