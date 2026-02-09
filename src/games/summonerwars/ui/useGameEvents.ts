/**
 * 召唤师战争 - 游戏事件流消费 Hook
 * 
 * 使用 EventStreamSystem 消费事件，驱动动画/特效/音效
 * 遵循 lastSeenEventId 模式，首次挂载跳过历史事件
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MatchState } from '../../../engine/types';
import type { SummonerWarsCore, PlayerId, CellCoord, UnitCard, StructureCard } from '../domain/types';
import { SW_EVENTS } from '../domain/types';
import { getEventStreamEntries } from '../../../engine/systems/EventStreamSystem';
import type { DestroyEffectData } from './DestroyEffect';
import type { DiceFace } from '../config/dice';

// ============================================================================
// 类型定义
// ============================================================================

/** 骰子结果状态 */
export interface DiceResultState {
  results: DiceFace[];
  attackType: 'melee' | 'ranged';
  hits: number;
  isOpponentAttack: boolean;
}

/** 待播放的攻击效果 */
export interface PendingAttack {
  attacker: CellCoord;
  target: CellCoord;
  attackType: 'melee' | 'ranged';
  hits: number;
  damages: Array<{ position: CellCoord; damage: number }>;
}

/** 死亡残影 */
export interface DeathGhost {
  id: string;
  position: CellCoord;
  card: UnitCard | StructureCard;
  owner: PlayerId;
  type: 'unit' | 'structure';
}

/** 技能模式状态 */
export interface AbilityModeState {
  abilityId: string;
  step: 'selectCard' | 'selectPosition' | 'selectUnit' | 'selectCards';
  sourceUnitId: string;
  selectedCardId?: string;
  selectedCardIds?: string[];
  selectedUnitId?: string;
  targetPosition?: CellCoord;
  context?: 'beforeAttack' | 'activated';
}

/** 灵魂转移模式状态 */
export interface SoulTransferModeState {
  sourceUnitId: string;
  sourcePosition: CellCoord;
  victimPosition: CellCoord;
}

/** 心灵捕获选择模式状态 */
export interface MindCaptureModeState {
  sourceUnitId: string;
  sourcePosition: CellCoord;
  targetPosition: CellCoord;
  targetUnitId: string;
  hits: number;
}

/** 攻击后技能模式状态（念力/高阶念力/读心传念） */
export interface AfterAttackAbilityModeState {
  abilityId: 'telekinesis' | 'high_telekinesis' | 'mind_transmission';
  sourceUnitId: string;
  sourcePosition: CellCoord;
}

// ============================================================================
// Hook 参数
// ============================================================================

interface UseGameEventsParams {
  G: MatchState<SummonerWarsCore>;
  core: SummonerWarsCore;
  myPlayerId: string;
  pushDestroyEffect: (data: Omit<DestroyEffectData, 'id'>) => void;
  pushBoardEffect: (data: { type: string; position: CellCoord; sourcePosition?: CellCoord; intensity?: string; damageAmount?: number; attackType?: 'melee' | 'ranged' }) => void;
  triggerShake: (intensity: string, type: string) => void;
}

// ============================================================================
// Hook 实现
// ============================================================================

export function useGameEvents({
  G, core, myPlayerId,
  pushDestroyEffect, pushBoardEffect, triggerShake,
}: UseGameEventsParams) {
  // 骰子结果状态
  const [diceResult, setDiceResult] = useState<DiceResultState | null>(null);

  // 死亡残影（攻击动画期间保留）
  const [deathGhosts, setDeathGhosts] = useState<DeathGhost[]>([]);

  // 技能模式
  const [abilityMode, setAbilityMode] = useState<AbilityModeState | null>(null);

  // 灵魂转移确认模式
  const [soulTransferMode, setSoulTransferMode] = useState<SoulTransferModeState | null>(null);

  // 心灵捕获选择模式
  const [mindCaptureMode, setMindCaptureMode] = useState<MindCaptureModeState | null>(null);

  // 攻击后技能模式（念力/高阶念力/读心传念）
  const [afterAttackAbilityMode, setAfterAttackAbilityMode] = useState<AfterAttackAbilityModeState | null>(null);

  // 待播放的攻击效果队列
  const pendingAttackRef = useRef<PendingAttack | null>(null);

  // 待延迟播放的摧毁效果
  const pendingDestroyRef = useRef<DestroyEffectData[]>([]);

  // 事件流诊断日志控制
  const eventStreamLogRef = useRef(0);
  const eventBatchLogRef = useRef(0);
  const pendingDestroyLogRef = useRef(0);
  const EVENT_STREAM_WARN = 180;
  const EVENT_STREAM_STEP = 10;
  const EVENT_BATCH_WARN = 20;
  const EVENT_BATCH_STEP = 10;
  const PENDING_DESTROY_WARN = 6;
  const PENDING_DESTROY_STEP = 4;

  // 追踪已处理的事件流 ID
  const lastSeenEventId = useRef<number>(-1);
  const isFirstMount = useRef(true);

  // 监听事件流
  useEffect(() => {
    const entries = getEventStreamEntries(G);

    if (entries.length >= EVENT_STREAM_WARN && entries.length >= eventStreamLogRef.current + EVENT_STREAM_STEP) {
      eventStreamLogRef.current = entries.length;
      console.warn(`[SW-EVENT] event=stream_backlog size=${entries.length} max=${EVENT_STREAM_WARN}`);
    }

    // 首次挂载：将指针推进到当前事件末尾，不回放历史特效
    if (isFirstMount.current) {
      isFirstMount.current = false;
      if (entries.length > 0) {
        lastSeenEventId.current = entries[entries.length - 1].id;
      }
      return;
    }

    const newEntries = lastSeenEventId.current < 0
      ? entries
      : entries.filter(e => e.id > lastSeenEventId.current);

    if (newEntries.length === 0) return;
    if (newEntries.length >= EVENT_BATCH_WARN && newEntries.length >= eventBatchLogRef.current + EVENT_BATCH_STEP) {
      eventBatchLogRef.current = newEntries.length;
      console.warn(`[SW-EVENT] event=batch size=${newEntries.length}`);
    }
    lastSeenEventId.current = newEntries[newEntries.length - 1].id;

    for (const entry of newEntries) {
      const event = entry.event;

      // 召唤事件 - 落场震动 + 全屏震动
      if (event.type === SW_EVENTS.UNIT_SUMMONED) {
        const p = event.payload as { position: CellCoord; card: { unitClass?: string } };
        const intensity = p.card?.unitClass === 'champion' ? 'strong' : 'normal';
        pushBoardEffect({ type: 'summon', position: p.position, intensity });
        triggerShake(intensity, 'impact');
      }

      // 攻击事件 - 显示骰子，效果队列化
      if (event.type === SW_EVENTS.UNIT_ATTACKED) {
        const p = event.payload as {
          attackType: 'melee' | 'ranged'; diceResults: DiceFace[]; hits: number;
          target: CellCoord; attacker: CellCoord;
        };
        const attackerUnit = core.board[p.attacker.row]?.[p.attacker.col]?.unit;
        const isOpponentAttack = attackerUnit ? attackerUnit.owner !== myPlayerId : false;

        if (pendingAttackRef.current) {
          console.warn('[SW-EVENT] event=attack_overlap note=pending_attack_exists');
        }

        pendingAttackRef.current = {
          attacker: p.attacker, target: p.target,
          attackType: p.attackType, hits: p.hits, damages: [],
        };

        setDiceResult({
          results: p.diceResults, attackType: p.attackType,
          hits: p.hits, isOpponentAttack,
        });
      }

      // 受伤事件 - 存入待播放队列或立即播放
      if (event.type === SW_EVENTS.UNIT_DAMAGED) {
        const p = event.payload as { position: CellCoord; damage: number };
        if (pendingAttackRef.current) {
          pendingAttackRef.current.damages.push({ position: p.position, damage: p.damage });
        } else {
          pushBoardEffect({
            type: 'damage', position: p.position,
            intensity: p.damage >= 3 ? 'strong' : 'normal', damageAmount: p.damage,
          });
        }
      }

      // 单位摧毁事件
      if (event.type === SW_EVENTS.UNIT_DESTROYED) {
        handleDestroyEvent(event.payload as Record<string, unknown>, 'unit');
      }

      // 建筑摧毁事件
      if (event.type === SW_EVENTS.STRUCTURE_DESTROYED) {
        handleDestroyEvent(event.payload as Record<string, unknown>, 'structure');
      }

      // 充能事件 - 充能动画反馈
      if (event.type === SW_EVENTS.UNIT_CHARGED) {
        const p = event.payload as { position: CellCoord; delta: number; sourceAbilityId?: string };
        if (p.delta > 0) {
          pushBoardEffect({ type: 'summon', position: p.position, intensity: 'normal' });
        }
      }

      // 感染触发
      if (event.type === SW_EVENTS.SUMMON_FROM_DISCARD_REQUESTED) {
        const p = event.payload as {
          playerId: string; cardType: string; position: CellCoord;
          sourceAbilityId: string; sourceUnitId?: string;
        };
        if (p.playerId === myPlayerId) {
          const player = core.players[myPlayerId as PlayerId];
          const hasValidCard = player?.discard.some(c => {
            if (p.cardType === 'plagueZombie') {
              return c.cardType === 'unit' && (c.id.includes('plague-zombie') || c.name.includes('疫病体'));
            }
            return false;
          });
          if (hasValidCard) {
            setAbilityMode({
              abilityId: 'infection', step: 'selectCard',
              sourceUnitId: p.sourceUnitId ?? '', targetPosition: p.position,
            });
          }
        }
      }

      // 灵魂转移请求
      if (event.type === SW_EVENTS.SOUL_TRANSFER_REQUESTED) {
        const p = event.payload as {
          sourceUnitId: string; sourcePosition: CellCoord;
          victimPosition: CellCoord; ownerId: string;
        };
        if (p.ownerId === myPlayerId) {
          setSoulTransferMode({
            sourceUnitId: p.sourceUnitId,
            sourcePosition: p.sourcePosition,
            victimPosition: p.victimPosition,
          });
        }
      }

      // 心灵捕获请求
      if (event.type === SW_EVENTS.MIND_CAPTURE_REQUESTED) {
        const p = event.payload as {
          sourceUnitId: string; sourcePosition: CellCoord;
          targetPosition: CellCoord; targetUnitId: string;
          ownerId: string; hits: number;
        };
        if (p.ownerId === myPlayerId) {
          setMindCaptureMode({
            sourceUnitId: p.sourceUnitId,
            sourcePosition: p.sourcePosition,
            targetPosition: p.targetPosition,
            targetUnitId: p.targetUnitId,
            hits: p.hits,
          });
        }
      }

      // 攻击后技能触发（念力/高阶念力/读心传念）
      if (event.type === SW_EVENTS.ABILITY_TRIGGERED) {
        const p = event.payload as {
          abilityId: string; sourceUnitId: string; sourcePosition: CellCoord;
        };
        if (['telekinesis', 'high_telekinesis', 'mind_transmission'].includes(p.abilityId)) {
          // 检查是否是我的单位
          const unit = core.board[p.sourcePosition.row]?.[p.sourcePosition.col]?.unit;
          if (unit && unit.owner === myPlayerId) {
            setAfterAttackAbilityMode({
              abilityId: p.abilityId as 'telekinesis' | 'high_telekinesis' | 'mind_transmission',
              sourceUnitId: p.sourceUnitId,
              sourcePosition: p.sourcePosition,
            });
          }
        }
      }
    }
  }, [G, core, myPlayerId, pushDestroyEffect, pushBoardEffect, triggerShake]);

  /** 处理摧毁事件（单位/建筑通用） */
  function handleDestroyEvent(payload: Record<string, unknown>, type: 'unit' | 'structure') {
    const position = payload.position as CellCoord;
    const cardName = payload.cardName as string;
    const cardId = payload.cardId as string | undefined;
    const owner = (payload.owner as PlayerId) ?? (myPlayerId as PlayerId);

    const destroyEffect: DestroyEffectData = { id: '', position, cardName, type };
    const pending = pendingAttackRef.current;
    const shouldDelay = pending
      && pending.target.row === position.row
      && pending.target.col === position.col;

    if (shouldDelay) {
      pendingDestroyRef.current.push(destroyEffect);
      if (pendingDestroyRef.current.length >= PENDING_DESTROY_WARN
        && pendingDestroyRef.current.length >= pendingDestroyLogRef.current + PENDING_DESTROY_STEP) {
        pendingDestroyLogRef.current = pendingDestroyRef.current.length;
        console.warn(`[SW-EVENT] event=pending_destroy_backlog size=${pendingDestroyRef.current.length}`);
      }
      if (cardId) {
        const discardedCard = core.players[owner]?.discard.find(c => c.id === cardId);
        if (discardedCard && (discardedCard.cardType === 'unit' || discardedCard.cardType === 'structure')) {
          setDeathGhosts(prev => ([
            ...prev,
            {
              id: `ghost-${cardId}-${Date.now()}`,
              position, card: discardedCard as UnitCard | StructureCard,
              owner, type,
            },
          ]));
        }
      }
    } else {
      pushDestroyEffect({ position, cardName, type });
    }
  }

  // 关闭骰子结果 → 播放攻击动画
  const handleCloseDiceResult = useCallback(() => {
    setDiceResult(null);
    return pendingAttackRef.current;
  }, []);

  // 清理待播放数据
  const clearPendingAttack = useCallback(() => {
    pendingAttackRef.current = null;
  }, []);

  // 播放延迟的摧毁特效
  const flushPendingDestroys = useCallback(() => {
    if (pendingDestroyRef.current.length > 0) {
      for (const effect of pendingDestroyRef.current) {
        pushDestroyEffect({ position: effect.position, cardName: effect.cardName, type: effect.type });
      }
      pendingDestroyRef.current = [];
      pendingDestroyLogRef.current = 0;
      setDeathGhosts([]);
    }
  }, [pushDestroyEffect]);

  return {
    diceResult,
    deathGhosts,
    abilityMode,
    setAbilityMode,
    soulTransferMode,
    setSoulTransferMode,
    mindCaptureMode,
    setMindCaptureMode,
    afterAttackAbilityMode,
    setAfterAttackAbilityMode,
    pendingAttackRef,
    handleCloseDiceResult,
    clearPendingAttack,
    flushPendingDestroys,
  };
}
