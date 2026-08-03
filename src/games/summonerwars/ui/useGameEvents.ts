/**
 * 召唤师战争 - 游戏事件流消费 Hook
 * 
 * 使用 EventStreamSystem 消费事件，驱动动画/特效/音效
 * 使用视觉事件消费策略管理游标（攻击动画是必播序列，不能用时间戳过滤丢弃）
 */

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { MatchState, EventStreamEntry } from '../../../engine/types';
import type { SummonerWarsCore, PlayerId, CellCoord, UnitCard, StructureCard } from '../domain/types';
import { SW_EVENTS } from '../domain/types';
import { getEventStreamEntries } from '../../../engine/systems/EventStreamSystem';
import type { DestroyEffectData } from './DestroyEffect';
import type { DiceFaceResult } from '../config/dice';
import { normalizeDiceResults } from '../config/dice';
import { getDestroySpriteConfig } from './spriteHelpers';
import type { FxBus } from '../../../engine/fx';
import { SW_FX } from './fxSetup';
import type { AbilityActivationContext, AbilityActivationStep } from '../domain/abilities';
import { playSound } from '../../../lib/audio/useGameAudio';
import { resolveDamageSoundKey, resolveDestroySoundKey } from '../audio.config';
import type { UseVisualSequenceGateReturn } from '../../../components/game/framework/hooks/useVisualSequenceGate';
import { useVisualStateBuffer } from '../../../components/game/framework/hooks/useVisualStateBuffer';
import { useVisualEventStream } from '../../../components/game/framework/hooks/useVisualEventStream';
import { swAttackDebugLog } from './attackDebug';
import { isTestEnvironment } from '../../../engine/testing/environment';

const isCellCoord = (value: unknown): value is CellCoord => {
  if (!value || typeof value !== 'object') return false;
  const coord = value as { row?: unknown; col?: unknown };
  return typeof coord.row === 'number' && typeof coord.col === 'number';
};

// ============================================================================
// 类型定义
// ============================================================================

/** 骰子结果状态 */
export interface DiceResultState {
  results: DiceFaceResult[];
  attackType: 'melee' | 'ranged';
  hits: number;
  attackEventId: number;
  isOpponentAttack: boolean;
  /** 本次攻击被减少的命中数（迷魂/神圣护盾等） */
  damageReduced?: number;
}

/** 待播放的攻击效果 */
export interface PendingAttack {
  attacker: CellCoord;
  target: CellCoord;
  attackType: 'melee' | 'ranged';
  hits: number;
  attackEventId: number;
  diceResults: DiceFaceResult[];
  diceCount: number;
  isOpponentAttack: boolean;
  damageReduced?: number;
  damages: Array<{ position: CellCoord; damage: number; eventId: number }>;
  pendingDestroys: PendingDestroyQueueItem[];
}

type PendingDestroyQueueItem = DestroyEffectData & {
  isGate?: boolean;
  destroyEventId: number;
  soundKey?: string;
};

/** 临时可视缓存（死亡动画前保留本体） */
export interface DyingEntity {
  id: string;
  position: CellCoord;
  owner: PlayerId;
  type: 'unit' | 'structure';
  atlasId: string;
  frameIndex: number;
}

/** 技能模式状态 */
export interface AbilityModeState {
  abilityId: string;
  step: AbilityActivationStep;
  sourceUnitId: string;
  selectedCardId?: string;
  selectedCardIds?: string[];
  selectableCardIds?: string[];
  selectedUnitId?: string;
  targetPosition?: CellCoord;
  context?: AbilityActivationContext;
  systemStep?: string;
  systemChoiceOptions?: Array<{
    id: string;
    label?: string;
    labelKey?: string;
  }>;
  /** 寒冰冲撞：建筑新位置 */
  structurePosition?: CellCoord;
  /** 被动触发：记住攻击目标（用于确认后自动发送攻击命令） */
  pendingAttackTarget?: CellCoord;
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

/** 抓附跟随模式状态 */
export interface GrabFollowModeState {
  grabberUnitId: string;
  grabberPosition: CellCoord;
  movedUnitId: string;
  movedTo: CellCoord;
}

/** 攻击后技能模式状态（念力/高阶念力/读心传念） */
export interface AfterAttackAbilityModeState {
  abilityId: 'telekinesis' | 'high_telekinesis' | 'mind_transmission';
  sourceUnitId: string;
  sourcePosition: CellCoord;
}



// ============================================================================
// 遗留工具函数（仅供测试引用，运行时已由 useEventStreamCursor 替代）
// ============================================================================

interface EventStreamDelta {
  newEntries: EventStreamEntry[];
  nextLastSeenId: number;
  shouldReset: boolean;
}

export function computeEventStreamDelta(
  entries: EventStreamEntry[],
  lastSeenEventId: number
): EventStreamDelta {
  if (entries.length === 0) {
    return {
      newEntries: [],
      nextLastSeenId: lastSeenEventId > -1 ? -1 : lastSeenEventId,
      shouldReset: lastSeenEventId > -1,
    };
  }

  const lastEntryId = entries[entries.length - 1].id;
  if (lastSeenEventId > -1 && lastEntryId < lastSeenEventId) {
    return {
      newEntries: entries,
      nextLastSeenId: lastEntryId,
      shouldReset: true,
    };
  }

  const newEntries = lastSeenEventId < 0
    ? entries
    : entries.filter(entry => entry.id > lastSeenEventId);

  return {
    newEntries,
    nextLastSeenId: newEntries.length > 0
      ? newEntries[newEntries.length - 1].id
      : lastSeenEventId,
    shouldReset: false,
  };
}

export function shouldConsumeChargeEvent(consumedEventIds: Set<number>, eventId: number): boolean {
  if (consumedEventIds.has(eventId)) return false;
  consumedEventIds.add(eventId);
  return true;
}

// ============================================================================
// Hook 参数
// ============================================================================

interface UseGameEventsParams {
  G: MatchState<SummonerWarsCore>;
  core: SummonerWarsCore;
  myPlayerId: string;
  currentPhase: string;
  pushDestroyEffect: (data: Omit<DestroyEffectData, 'id'>) => void;
  fxBus: FxBus;
  /** 掷骰结果展示时的音效回调 */
  onDiceRollSound?: (diceCount: number) => void;
  /** 视觉序列门控（框架层 hook 实例） */
  gate: UseVisualSequenceGateReturn;
}

// ============================================================================
// Hook 实现
// ============================================================================

export function useGameEvents({
  G, core, myPlayerId, currentPhase,
  pushDestroyEffect, fxBus, onDiceRollSound, gate,
}: UseGameEventsParams) {
  const useSafeDestroyFallback = isTestEnvironment() || (typeof navigator !== 'undefined' && navigator.webdriver);
  // 骰子结果状态
  const [diceResult, setDiceResult] = useState<DiceResultState | null>(null);

  // 临时本体缓存（攻击动画期间保留）
  const [dyingEntities, setDyingEntities] = useState<DyingEntity[]>([]);

  // 视觉伤害缓冲：攻击动画期间冻结受影响格子的 damage 值，
  // 避免 core 已 reduce 但动画未播完导致血条提前变化
  // 使用框架层 useVisualStateBuffer 替代内联 Map 实现
  const damageBuffer = useVisualStateBuffer();

  // 待播放的攻击效果队列
  const pendingAttackRef = useRef<PendingAttack | null>(null);
  const pendingAttackQueueRef = useRef<PendingAttack[]>([]);
  const bufferedAttackRef = useRef<PendingAttack | null>(null);
  const completedAttackRef = useRef<PendingAttack | null>(null);
  const closedAttackEventIdRef = useRef<number | null>(null);
  // 防止同一 eventStream 事件在重连/回滚场景下被重复消费导致攻击动画重复播放
  const processedAttackEventIdsRef = useRef<Set<number>>(new Set());
  // 防止同一充能事件在重连/回滚场景下重复播放充能旋涡
  const processedChargeEventIdsRef = useRef<Set<number>>(new Set());

  // ============================================================================
  // 回调函数稳定化（避免 useLayoutEffect 因回调引用变化而重复执行）
  // ============================================================================
  const pushDestroyEffectRef = useRef(pushDestroyEffect);
  pushDestroyEffectRef.current = pushDestroyEffect;
  const fxBusRef = useRef(fxBus);
  fxBusRef.current = fxBus;
  const onDiceRollSoundRef = useRef(onDiceRollSound);
  onDiceRollSoundRef.current = onDiceRollSound;
  const coreRef = useRef(core);
  coreRef.current = core;
  // gate 回调稳定化
  const gateRef = useRef(gate);
  gateRef.current = gate;

  // 事件流诊断日志控制
  const eventStreamLogRef = useRef(0);
  const eventBatchLogRef = useRef(0);
  const EVENT_STREAM_WARN = 180;
  const EVENT_STREAM_STEP = 10;
  const EVENT_BATCH_WARN = 20;
  const EVENT_BATCH_STEP = 10;

  // 必播序列游标：攻击/伤害动画按 EventStream id 消费，不能用事件 timestamp 判定是否丢弃。
  const entries = getEventStreamEntries(G);
  const { consumeNew } = useVisualEventStream({
    entries,
    strategy: 'requiredSequence',
  });
  const activeSwInteractionType = (() => {
    const currentInteraction = G.sys.interaction?.current as {
      kind?: string;
      playerId?: string;
      data?: { sw?: { type?: string } };
    } | undefined;
    if (!currentInteraction || currentInteraction.kind !== 'simple-choice' || currentInteraction.playerId !== myPlayerId) {
      return null;
    }
    const sw = currentInteraction.data?.sw;
    return sw && typeof sw === 'object' && typeof sw.type === 'string' ? sw.type : null;
  })();

  const freezeAttackSnapshot = useCallback((attack: PendingAttack) => {
    const board = coreRef.current.board;
    const totalDamageByCell = new Map<string, { position: CellCoord; total: number }>();
    for (const dmg of attack.damages) {
      const key = `${dmg.position.row}-${dmg.position.col}`;
      const existing = totalDamageByCell.get(key);
      if (existing) {
        existing.total += dmg.damage;
      } else {
        totalDamageByCell.set(key, { position: dmg.position, total: dmg.damage });
      }
    }

    if (totalDamageByCell.size === 0) {
      const targetCell = board[attack.target.row]?.[attack.target.col];
      if (targetCell?.unit) {
        damageBuffer.freeze(`${attack.target.row}-${attack.target.col}`, targetCell.unit.damage);
      } else if (targetCell?.structure) {
        damageBuffer.freeze(`${attack.target.row}-${attack.target.col}`, targetCell.structure.damage);
      }
      return;
    }

    for (const [key, payload] of totalDamageByCell) {
      const cell = board[payload.position.row]?.[payload.position.col];
      const coreDamage = cell?.unit?.damage ?? cell?.structure?.damage;
      if (typeof coreDamage === 'number') {
        damageBuffer.freeze(key, Math.max(0, coreDamage - payload.total));
      }
    }
  }, [damageBuffer]);

  const activateAttack = useCallback((attack: PendingAttack) => {
    pendingAttackRef.current = attack;
    closedAttackEventIdRef.current = null;
    freezeAttackSnapshot(attack);
    setDiceResult({
      results: attack.diceResults,
      attackType: attack.attackType,
      hits: attack.hits,
      attackEventId: attack.attackEventId,
      isOpponentAttack: attack.isOpponentAttack,
      damageReduced: attack.damageReduced,
    });
    onDiceRollSoundRef.current?.(attack.diceCount);
  }, [freezeAttackSnapshot]);

  const activateNextAttackFromQueue = useCallback(() => {
    if (pendingAttackRef.current) return;
    const nextAttack = pendingAttackQueueRef.current.shift();
    if (!nextAttack) return;
    if (!bufferedAttackRef.current) {
      bufferedAttackRef.current = nextAttack;
    }
    swAttackDebugLog('queued_attack_activated', {
      attackEventId: nextAttack.attackEventId,
      remainingQueuedAttacks: pendingAttackQueueRef.current.length,
      damageCount: nextAttack.damages.length,
      destroyCount: nextAttack.pendingDestroys.length,
    });
    activateAttack(nextAttack);
  }, [activateAttack]);

  // 监听事件流
  useLayoutEffect(() => {
    if (entries.length >= EVENT_STREAM_WARN && entries.length >= eventStreamLogRef.current + EVENT_STREAM_STEP) {
      eventStreamLogRef.current = entries.length;
      console.warn(`[SW-EVENT] event=stream_backlog size=${entries.length} max=${EVENT_STREAM_WARN}`);
    }

    const { entries: newEntries, didReset, didOptimisticRollback } = consumeNew();

    if (didReset || didOptimisticRollback) {
      const queuedDestroyCount = pendingAttackQueueRef.current.reduce((count, attack) => count + attack.pendingDestroys.length, 0);
      swAttackDebugLog('event_stream_reset_or_rollback', {
        didReset,
        didOptimisticRollback,
        hadPendingAttack: !!pendingAttackRef.current,
        pendingAttackEventId: pendingAttackRef.current?.attackEventId,
        queuedAttackCount: pendingAttackQueueRef.current.length,
        pendingDestroyCount: (pendingAttackRef.current?.pendingDestroys.length ?? 0)
          + (completedAttackRef.current?.pendingDestroys.length ?? 0)
          + queuedDestroyCount,
      });
      pendingAttackRef.current = null;
      pendingAttackQueueRef.current = [];
      bufferedAttackRef.current = null;
      completedAttackRef.current = null;
      closedAttackEventIdRef.current = null;
      setDiceResult(null);
      setDyingEntities([]);
      damageBuffer.clear();
      gateRef.current.reset();
      if (didReset) {
        processedAttackEventIdsRef.current.clear();
      }
    }

    if (newEntries.length === 0) return;
    if (newEntries.length >= EVENT_BATCH_WARN && newEntries.length >= eventBatchLogRef.current + EVENT_BATCH_STEP) {
      eventBatchLogRef.current = newEntries.length;
      console.warn(`[SW-EVENT] event=batch size=${newEntries.length}`);
    }

    // 位移动画延迟：位移事件（推拉/移动）后的伤害特效需等移动动画完成
    // spring(stiffness:300, damping:30) 约 250ms 到达稳态
    const MOVE_ANIM_DELAY = 250;
    let hasPendingMove = false;

    for (const entry of newEntries) {
      const event = entry.event;

      // 追踪位移事件（推拉/移动），后续伤害特效需延迟
      if (event.type === SW_EVENTS.UNIT_PUSHED
        || event.type === SW_EVENTS.UNIT_PULLED
        || event.type === SW_EVENTS.UNIT_MOVED) {
        hasPendingMove = true;
      }

      // 召唤事件 - 光柱特效（震动由 FeedbackPack on-impact 自动触发）
      if (event.type === SW_EVENTS.UNIT_SUMMONED) {
        const p = event.payload as { position: CellCoord; card: { unitClass?: string } };
        // 英雄（summoner）和冠军（champion）都使用金色强特效
        const intensity = (p.card?.unitClass === 'champion' || p.card?.unitClass === 'summoner') ? 'strong' : 'normal';
        fxBusRef.current.push(SW_FX.SUMMON, { cell: p.position, intensity });
      }

      // 攻击事件 - 显示骰子，效果队列化，开启视觉序列门控
      if (event.type === SW_EVENTS.UNIT_ATTACKED) {
        if (processedAttackEventIdsRef.current.has(entry.id)) {
          swAttackDebugLog('unit_attacked_skip_duplicate', {
            eventId: entry.id,
            attacker: (event.payload as { attacker?: CellCoord }).attacker,
            target: (event.payload as { target?: CellCoord }).target,
          });
          continue;
        }
        const previousPendingAttackEventId = pendingAttackRef.current?.attackEventId;
        processedAttackEventIdsRef.current.add(entry.id);
        // Set 仅保留最近窗口，避免长局内存持续增长
        if (processedAttackEventIdsRef.current.size > 800) {
          const [oldestId] = processedAttackEventIdsRef.current;
          if (oldestId !== undefined) {
            processedAttackEventIdsRef.current.delete(oldestId);
          }
        }
        const p = event.payload as {
          attackType?: 'melee' | 'ranged'; diceResults?: DiceFaceResult[]; hits?: number; diceCount?: number;
          target?: CellCoord; attacker?: CellCoord;
        };
        if (!isCellCoord(p.attacker) || !isCellCoord(p.target) || !p.attackType || typeof p.hits !== 'number') {
          console.warn('[SW-EVENT] UNIT_ATTACKED payload 异常，跳过骰子与攻击动画', { payload: event.payload });
          swAttackDebugLog('unit_attacked_invalid_payload', {
            eventId: entry.id,
            payload: event.payload as Record<string, unknown>,
          });
          continue;
        }
        const normalizedDiceResults = normalizeDiceResults(p.diceResults);
        const diceCount = p.diceCount
          ?? normalizedDiceResults?.length
          ?? (Array.isArray(p.diceResults) ? p.diceResults.length : undefined)
          ?? 1;

        const diceResultsForUi = normalizedDiceResults
          ?? Array.from({ length: diceCount }, () => ({ faceIndex: 8, marks: ['melee'] as const }));

        if (!normalizedDiceResults) {
          console.warn('[SW-EVENT] UNIT_ATTACKED diceResults 不是有效格式，使用兜底骰面继续流程', {
            diceResults: p.diceResults,
            diceCount,
          });
          swAttackDebugLog('unit_attacked_use_fallback_dice', {
            eventId: entry.id,
            diceCount,
            rawDiceResults: p.diceResults as unknown,
          });
        }
        const attackerUnit = core.board[p.attacker.row]?.[p.attacker.col]?.unit;
        const isOpponentAttack = attackerUnit ? attackerUnit.owner !== myPlayerId : false;

        // 收集同批次的减伤事件（DAMAGE_REDUCED 在 UNIT_ATTACKED 之前发射）
        const damageReduced = newEntries
          .filter(e => e.event.type === SW_EVENTS.DAMAGE_REDUCED)
          .reduce((sum, e) => sum + ((e.event.payload as { value?: number }).value ?? 0), 0);

        const attack: PendingAttack = {
          attacker: p.attacker,
          target: p.target,
          attackType: p.attackType,
          hits: p.hits,
          attackEventId: entry.id,
          diceResults: diceResultsForUi,
          diceCount,
          isOpponentAttack,
          damageReduced: damageReduced > 0 ? damageReduced : undefined,
          damages: [],
          pendingDestroys: [],
        };

        gateRef.current.beginSequence();
        bufferedAttackRef.current = attack;

        if (pendingAttackRef.current) {
          pendingAttackQueueRef.current.push(attack);
          swAttackDebugLog('unit_attacked_queued', {
            eventId: entry.id,
            previousPendingAttackEventId,
            queuedAttackCount: pendingAttackQueueRef.current.length,
            attackType: p.attackType,
            hits: p.hits,
            diceCount,
            attacker: p.attacker,
            target: p.target,
            isOpponentAttack,
          });
        } else {
          swAttackDebugLog('unit_attacked_consumed', {
            eventId: entry.id,
            previousPendingAttackEventId,
            queuedAttackCount: pendingAttackQueueRef.current.length,
            attackType: p.attackType,
            hits: p.hits,
            diceCount,
            attacker: p.attacker,
            target: p.target,
            isOpponentAttack,
          });
          activateAttack(attack);
        }
      }

      // 受伤事件 - 存入待播放队列或立即播放
      if (event.type === SW_EVENTS.UNIT_DAMAGED) {
        const p = event.payload as { position: CellCoord; damage: number };
        const bufferedAttack = bufferedAttackRef.current;
        if (bufferedAttack) {
          bufferedAttack.damages.push({ position: p.position, damage: p.damage, eventId: entry.id });
          swAttackDebugLog('unit_damaged_buffered_for_attack', {
            attackEventId: bufferedAttack.attackEventId,
            damageEventId: entry.id,
            position: p.position,
            damage: p.damage,
            bufferedDamageCount: bufferedAttack.damages.length,
          });
          if (bufferedAttack === pendingAttackRef.current) {
            // 快照中回退伤害：core 已 reduce 了这笔伤害，但视觉上应保持攻击前的值
            // 直到动画 impact 时才释放
            const cellKey = `${p.position.row}-${p.position.col}`;
            const currentVisual = damageBuffer.get(cellKey, -1);
            if (currentVisual !== -1) {
              // 已有快照：保持攻击前的值（即 core.damage - 本次伤害）
              damageBuffer.freeze(cellKey, currentVisual - p.damage);
            } else {
              // 溅射等非主目标：快照为 core 当前值减去本次伤害
              const cell = core.board[p.position.row]?.[p.position.col];
              const coreDamage = cell?.unit?.damage ?? cell?.structure?.damage ?? 0;
              damageBuffer.freeze(cellKey, coreDamage - p.damage);
            }
          }
        } else {
          // 非攻击伤害：如果前面有位移事件，延迟播放特效等移动动画完成
          const soundKey = resolveDamageSoundKey(p.damage);
          const fxCtx = {
            cell: p.position,
            intensity: (p.damage >= 3 ? 'strong' : 'normal') as 'strong' | 'normal',
          };
          const fxParams = { damageAmount: p.damage, soundKey };
          if (hasPendingMove) {
            setTimeout(() => {
              fxBusRef.current.push(SW_FX.COMBAT_DAMAGE, fxCtx, fxParams);
            }, MOVE_ANIM_DELAY);
          } else {
            fxBusRef.current.push(SW_FX.COMBAT_DAMAGE, fxCtx, fxParams);
          }
        }
      }

      // 单位摧毁事件
      if (event.type === SW_EVENTS.UNIT_DESTROYED) {
        handleDestroyEvent(event.payload as Record<string, unknown>, 'unit', entry.id);
      }

      // 建筑摧毁事件
      if (event.type === SW_EVENTS.STRUCTURE_DESTROYED) {
        handleDestroyEvent(event.payload as Record<string, unknown>, 'structure', entry.id);
      }

      // 充能事件 - 旋涡动画反馈（位移后可能触发充能，需等移动动画完成）
      if (event.type === SW_EVENTS.UNIT_CHARGED) {
        const p = event.payload as { position: CellCoord; delta: number; sourceAbilityId?: string };
        if (!shouldConsumeChargeEvent(processedChargeEventIdsRef.current, entry.id)) {
          continue;
        }
        if (p.delta > 0) {
          if (hasPendingMove) {
            setTimeout(() => {
              fxBusRef.current.push(SW_FX.CHARGE_VORTEX, { cell: p.position, intensity: 'normal' });
            }, MOVE_ANIM_DELAY);
          } else {
            fxBusRef.current.push(SW_FX.CHARGE_VORTEX, { cell: p.position, intensity: 'normal' });
          }
        }
      }

      // 攻击后技能触发（念力/高阶念力/读心传念）
      if (event.type === SW_EVENTS.ABILITY_TRIGGERED) {
        const p = event.payload as {
          abilityId: string; actionId?: string; sourceUnitId: string; sourcePosition: CellCoord; interactionResolved?: boolean;
        };
        if (p.interactionResolved) {
          continue;
        }
        // 指引：召唤阶段开始时自动抓牌（已在 abilityResolver 中直接处理，无需 UI 交互）
      }
    }
  // 依赖数组不包含回调函数，回调通过 ref 访问，避免因回调引用变化导致 effect 重复执行
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [G, activeSwInteractionType, core, myPlayerId, consumeNew, activateAttack]);

  /** 查找被摧毁的卡牌（弃牌堆/手牌兜底） */
  const resolveDestroyedCard = (owner: PlayerId, cardId?: string) => {
    if (!cardId) return undefined;
    const player = core.players[owner];
    if (!player) return undefined;
    return (
      player.discard.find(c => c.id === cardId)
      ?? player.hand.find(c => c.id === cardId)
    );
  };

  /** 处理摧毁事件（单位/建筑通用） */
  function handleDestroyEvent(payload: Record<string, unknown>, type: 'unit' | 'structure', _entryId: number) {
    const position = payload.position as CellCoord;
    const cardName = payload.cardName as string;
    const cardId = payload.cardId as string | undefined;
    const owner = (payload.owner as PlayerId) ?? (myPlayerId as PlayerId);
    const destroyedCard = resolveDestroyedCard(owner, cardId);

    // 检测是否为传送门（用于音效区分）
    const isGate = type === 'structure' && destroyedCard?.cardType === 'structure' && !!(destroyedCard as StructureCard).isGate;

    // 查找弃牌堆中的卡牌，获取精灵图信息用于碎裂特效
    let atlasId: string | undefined;
    let frameIndex: number | undefined;
    if (!useSafeDestroyFallback && destroyedCard && (destroyedCard.cardType === 'unit' || destroyedCard.cardType === 'structure')) {
      const sprite = getDestroySpriteConfig(destroyedCard as UnitCard | StructureCard);
      atlasId = sprite.atlasId;
      frameIndex = sprite.frameIndex;
    }

    const destroyEffect: DestroyEffectData = { id: '', position, cardName, type, atlasId, frameIndex };
    const pending = bufferedAttackRef.current ?? pendingAttackRef.current;
    // 延迟条件：攻击目标位置 或 任何受伤位置（含溅射/反击等）
    const shouldDelay = pending && (
      (pending.target.row === position.row && pending.target.col === position.col)
      || pending.damages.some(d => d.position.row === position.row && d.position.col === position.col)
    );

    // 解析摧毁音效 key
    const destroySoundKey = resolveDestroySoundKey(type, isGate);

    if (shouldDelay && pending) {
      pending.pendingDestroys.push({ ...destroyEffect, isGate, destroyEventId: 0, soundKey: destroySoundKey });
      if (!useSafeDestroyFallback && atlasId !== undefined && frameIndex !== undefined) {
        setDyingEntities(prev => ([
          ...prev,
          {
            id: `dying-${cardId ?? 'unknown'}-${Date.now()}`,
            position,
            owner,
            type,
            atlasId,
            frameIndex,
          },
        ]));
      }
    } else {
      pushDestroyEffectRef.current({ position, cardName, type, atlasId, frameIndex });
      playSound(destroySoundKey);
    }
  }

  // 关闭骰子结果 → 播放攻击动画
  const handleCloseDiceResult = () => {
    const pending = pendingAttackRef.current;
    if (!pending) {
      swAttackDebugLog('dice_overlay_close_requested_without_pending_attack', {});
      setDiceResult(null);
      return null;
    }
    if (closedAttackEventIdRef.current === pending.attackEventId) {
      swAttackDebugLog('dice_overlay_close_duplicate_ignored', {
        pendingAttackEventId: pending.attackEventId,
      });
      return null;
    }
    closedAttackEventIdRef.current = pending.attackEventId;
    swAttackDebugLog('dice_overlay_close_requested', {
      pendingAttackEventId: pending.attackEventId,
      pendingAttackType: pending.attackType,
      pendingAttackHits: pending.hits,
      pendingDamageCount: pending.damages.length,
    });
    setDiceResult(null);
    return pending;
  };

  // 清理待播放数据
  const clearPendingAttack = useCallback(() => {
    const currentAttack = pendingAttackRef.current;
    swAttackDebugLog('pending_attack_cleared', {
      pendingAttackEventId: currentAttack?.attackEventId,
      pendingDamageCount: currentAttack?.damages.length ?? 0,
      pendingDestroyCount: currentAttack?.pendingDestroys.length ?? 0,
    });
    completedAttackRef.current = currentAttack;
    pendingAttackRef.current = null;
    if (bufferedAttackRef.current === currentAttack) {
      bufferedAttackRef.current = null;
    }
  }, []);

  // 播放延迟的摧毁特效（含音效）+ 结束视觉序列门控
  const flushPendingDestroys = useCallback(() => {
    const completedAttack = completedAttackRef.current;
    swAttackDebugLog('flush_pending_destroys', {
      pendingDestroyCount: completedAttack?.pendingDestroys.length ?? 0,
      completedAttackEventId: completedAttack?.attackEventId,
      queuedAttackCount: pendingAttackQueueRef.current.length,
    });
    if (completedAttack && completedAttack.pendingDestroys.length > 0) {
      for (const effect of completedAttack.pendingDestroys) {
        pushDestroyEffectRef.current({
          position: effect.position, cardName: effect.cardName, type: effect.type,
          atlasId: effect.atlasId, frameIndex: effect.frameIndex,
        });
        if (effect.soundKey) {
          playSound(effect.soundKey);
        }
      }
    }
    completedAttackRef.current = null;
    setDyingEntities([]);
    // 释放视觉快照，回归 core 真实值
    damageBuffer.clear();
    // 结束视觉序列，排空交互队列（感染/灵魂转移/念力等延迟到此刻触发）
    gateRef.current.endSequence();
    activateNextAttackFromQueue();
  }, [activateNextAttackFromQueue, damageBuffer]);

  // 释放视觉快照中指定格子的伤害（动画 impact 时调用）
  // 删除快照 key，让 UI 回退到 core 真实值，血条在 impact 瞬间变化
  const releaseDamageSnapshot = useCallback((positions: CellCoord[]) => {
    damageBuffer.release(positions.map(pos => `${pos.row}-${pos.col}`));
  }, [damageBuffer]);

  return {
    diceResult,
    dyingEntities,
    damageBuffer,
    isVisualBusy: gate.isVisualBusy,
    pendingAttackRef,
    handleCloseDiceResult,
    clearPendingAttack,
    flushPendingDestroys,
    releaseDamageSnapshot,
  };
}
