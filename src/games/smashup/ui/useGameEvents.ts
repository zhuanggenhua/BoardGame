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
import type { SmashUpCore, LimitModifiedEvent, VpAwardedEvent } from '../domain/types';
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
  /** 玩家展示名，用于让 VP 获得动画明确显示归属 */
  playerNames?: Record<string, string>;
}

type ScreenPoint = { left: number; top: number };

type TriggeredFxPayload = {
  fromBaseIndex?: number;
  baseIndex?: number;
}

function resolveTriggeredFxPosition(
  event: { payload?: unknown },
  baseRefs: React.RefObject<Map<number, HTMLElement>>,
): ScreenPoint | undefined {
  const payload = (event.payload ?? {}) as TriggeredFxPayload;
  const baseIndex = payload.fromBaseIndex ?? payload.baseIndex;
  if (baseIndex === undefined) return undefined;

  const baseEl = baseRefs.current?.get(baseIndex);
  if (!baseEl) return undefined;

  const rect = baseEl.getBoundingClientRect();
  return {
    left: rect.left + rect.width / 2,
    top: rect.top + Math.max(rect.height * 0.28, 56),
  };
}

function resolveTriggeredFxActionKind(eventType: string): 'destroy' | 'buff' | 'score' | 'info' {
  switch (eventType) {
    case SU_EVENTS.MINION_DESTROYED:
      return 'destroy';
    case SU_EVENTS.POWER_COUNTER_ADDED:
    case SU_EVENTS.TEMP_POWER_ADDED:
      return 'buff';
    case SU_EVENTS.VP_AWARDED:
      return 'score';
    default:
      return 'info';
  }
}

function resolveTriggeredFxTone(eventType: string): 'danger' | 'buff' | 'score' | 'info' {
  const actionKind = resolveTriggeredFxActionKind(eventType);
  if (actionKind === 'destroy') return 'danger';
  if (actionKind === 'buff') return 'buff';
  if (actionKind === 'score') return 'score';
  return 'info';
}

function resolveTriggeredFxTargetDefId(
  G: MatchState<SmashUpCore>,
  event: { type: string; payload?: unknown },
): string | undefined {
  if (event.type === SU_EVENTS.MINION_DESTROYED) {
    return (event.payload as { minionDefId?: string })?.minionDefId;
  }

  if (event.type === SU_EVENTS.POWER_COUNTER_ADDED || event.type === SU_EVENTS.TEMP_POWER_ADDED) {
    const payload = event.payload as { baseIndex?: number; minionUid?: string };
    if (payload.baseIndex === undefined || !payload.minionUid) return undefined;
    return G.core.bases?.[payload.baseIndex]?.minions.find(minion => minion.uid === payload.minionUid)?.defId;
  }

  return undefined;
}

function isImmediateExtraPromptFamilyActive(
  G: MatchState<SmashUpCore>,
  playerId: string,
  limitType: 'minion' | 'action',
): boolean {
  const current = G.sys.interaction?.current;
  if (current?.playerId !== playerId) return false;
  const data = current?.data as { sourceId?: unknown } | undefined;
  const sourceId = data?.sourceId;
  if (typeof sourceId !== 'string') return false;

  const familyPrefix = limitType === 'minion'
    ? 'smashup_immediate_extra_minion'
    : 'smashup_immediate_extra_action';
  return sourceId === familyPrefix || sourceId.startsWith(`${familyPrefix}_`);
}

export function useGameEvents({
  G,
  myPlayerId,
  fxBus,
  baseRefs,
  playerNames,
}: UseGameEventsParams) {
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
  const TRIGGER_CARRIER_EVENTS = useMemo<ReadonlySet<string>>(() => new Set<string>([
    SU_EVENTS.MINION_DESTROYED,
    SU_EVENTS.CARDS_DISCARDED,
    SU_EVENTS.CARDS_MILLED,
    SU_EVENTS.ONGOING_DETACHED,
    SU_EVENTS.LIMIT_MODIFIED,
    SU_EVENTS.MINION_RETURNED,
    SU_EVENTS.MINION_MOVED,
    SU_EVENTS.POWER_COUNTER_ADDED,
    SU_EVENTS.POWER_COUNTER_REMOVED,
    SU_EVENTS.BREAKPOINT_MODIFIED,
    SU_EVENTS.VP_AWARDED,
    SU_EVENTS.TEMP_POWER_ADDED,  // 临时力量增益（如狼人 beforeScoring）
  ]), []);

  const resolvePlayerName = useCallback((playerId: string) => {
    return playerNames?.[playerId] ?? `P${Number(playerId) + 1}`;
  }, [playerNames]);

  // 消费事件流 → 推入 FX 系统
  useEffect(() => {
    const { entries: newEntries, didReset, didOptimisticRollback } = consumeNew();

    // Undo 回退 / reconnect-resync 乐观回滚：清空本地 feedback，避免旧 toast 残留或重播。
    // Undo 回退 / reconnect-resync 乐观回滚：清空本地反馈，避免旧 toast 残留或重播。
    if (didReset || didOptimisticRollback) {
      setFeedbacks([]);
      if (newEntries.length === 0) return;
    }

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
          const position = resolveTriggeredFxPosition(event, baseRefs);
          const actionKind = resolveTriggeredFxActionKind(event.type);
          const targetDefId = resolveTriggeredFxTargetDefId(G, event);
          fxBus.push(SU_FX.ABILITY_TRIGGERED, { space: 'screen' }, {
            sourceDefId: reason,
            position,
            targetDefId,
            actionKind,
            effectLabel: actionKind === 'destroy' ? '消灭' : undefined,
            highlightTone: resolveTriggeredFxTone(event.type),
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
          // 行动卡特写由 Board 中的 CardSpotlightQueue 消费同一事件流；
          // 这里不再推自动退场 FX，避免玩家没读清就关闭。
          break;
        }

        case SU_EVENTS.BASE_SCORED: {
          const p = event.payload as {
            baseIndex: number; baseDefId: string;
            rankings: Array<{ playerId: string; power: number; vp: number }>;
          };
          // VP 飞行 → FX
          // 正常播放（阶段切换检测会在独立 effect 中处理）
          fxBus.push(SU_FX.BASE_SCORED, { space: 'screen' }, {
            rankings: p.rankings.map(ranking => ({
              ...ranking,
              playerName: resolvePlayerName(ranking.playerId),
            })),
          });
          break;
        }

        case SU_EVENTS.VP_AWARDED: {
          const p = (event as VpAwardedEvent).payload;
          if (p.amount > 0) {
            fxBus.push(SU_FX.BASE_SCORED, { space: 'screen' }, {
              rankings: [{
                playerId: p.playerId,
                power: 0,
                vp: p.amount,
                playerName: resolvePlayerName(p.playerId),
              }],
            });
          }
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

        case SU_EVENTS.LIMIT_MODIFIED: {
          const payload = (event as LimitModifiedEvent).payload;
          const isUnrestricted =
            payload.restrictToBase === undefined &&
            payload.powerMax === undefined &&
            !payload.sameNameOnly &&
            payload.sameNameDefId === undefined;
          const isWaitingForOwnInteraction =
            G.sys.interaction?.current?.playerId === payload.playerId;
          const shouldSuppressDeferredGrantFeedback =
            isWaitingForOwnInteraction &&
            isImmediateExtraPromptFamilyActive(G, payload.playerId, payload.limitType);

          if (
            payload.delta > 0 &&
            payload.playerId === myPlayerId &&
            isUnrestricted &&
            !shouldSuppressDeferredGrantFeedback
          ) {
            setFeedbacks(prev => [...prev, {
              id: `fb-${uidCounter++}`,
              playerId: payload.playerId,
              messageKey: payload.limitType === 'minion'
                ? isWaitingForOwnInteraction
                  ? 'ui.extra_minion_granted_after_interaction'
                  : 'ui.extra_minion_granted'
                : isWaitingForOwnInteraction
                  ? 'ui.extra_action_granted_after_interaction'
                  : 'ui.extra_action_granted',
              messageParams: { count: payload.delta },
              tone: 'info',
            }]);
          }
          break;
        }
      }
    }
  }, [G, consumeNew, myPlayerId, fxBus, baseRefs, triggerDefIds, TRIGGER_CARRIER_EVENTS, resolvePlayerName]);

  // 清除已完成的反馈
  const removeFeedback = useCallback((id: string) => {
    setFeedbacks(prev => prev.filter(e => e.id !== id));
  }, []);

  return {
    feedbacks, removeFeedback,
  };
}
