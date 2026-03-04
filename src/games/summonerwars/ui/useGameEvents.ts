/**
 * 召唤师战争 - 游戏事件流消费 Hook
 * 
 * 使用 EventStreamSystem 消费事件，驱动动画/特效/音效
 * 使用引擎层 useEventStreamCursor 管理游标（自动处理首次挂载跳过 + Undo 重置）
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MatchState, EventStreamEntry } from '../../../engine/types';
import type { SummonerWarsCore, PlayerId, CellCoord, UnitCard, StructureCard } from '../domain/types';
import { SW_EVENTS } from '../domain/types';
import { getEventStreamEntries } from '../../../engine/systems/EventStreamSystem';
import type { DestroyEffectData } from './DestroyEffect';
import type { DiceFaceResult } from '../config/dice';
import { getDestroySpriteConfig } from './spriteHelpers';
import type { FxBus } from '../../../engine/fx';
import { SW_FX } from './fxSetup';
import type { AbilityActivationContext, AbilityActivationStep } from '../domain/abilities';
import { playSound } from '../../../lib/audio/useGameAudio';
import { resolveDamageSoundKey, resolveDestroySoundKey } from '../audio.config';
import type { UseVisualSequenceGateReturn } from '../../../components/game/framework/hooks/useVisualSequenceGate';
import { useVisualStateBuffer } from '../../../components/game/framework/hooks/useVisualStateBuffer';
import type { UseVisualStateBufferReturn } from '../../../components/game/framework/hooks/useVisualStateBuffer';
import { isPlagueZombieCard } from '../domain/ids';
import type { RapidFireModeState, WithdrawModeState } from './modeTypes';
import { useEventStreamCursor } from '../../../engine/hooks';

// ============================================================================
// 类型定义
// ============================================================================

/** 骰子结果状态 */
export interface DiceResultState {
  results: DiceFaceResult[];
  attackType: 'melee' | 'ranged';
  hits: number;
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
  damages: Array<{ position: CellCoord; damage: number; eventId: number }>;
}

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
  selectedUnitId?: string;
  targetPosition?: CellCoord;
  context?: AbilityActivationContext;
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
  // 骰子结果状态
  const [diceResult, setDiceResult] = useState<DiceResultState | null>(null);

  // 临时本体缓存（攻击动画期间保留）
  const [dyingEntities, setDyingEntities] = useState<DyingEntity[]>([]);

  // 视觉伤害缓冲：攻击动画期间冻结受影响格子的 damage 值，
  // 避免 core 已 reduce 但动画未播完导致血条提前变化
  // 使用框架层 useVisualStateBuffer 替代内联 Map 实现
  const damageBuffer = useVisualStateBuffer();

  // 技能模式
  const [abilityMode, setAbilityMode] = useState<AbilityModeState | null>(null);

  // 灵魂转移确认模式
  const [soulTransferMode, setSoulTransferMode] = useState<SoulTransferModeState | null>(null);

  // 心灵捕获选择模式
  const [mindCaptureMode, setMindCaptureMode] = useState<MindCaptureModeState | null>(null);

  // 攻击后技能模式（念力/高阶念力/读心传念）
  const [afterAttackAbilityMode, setAfterAttackAbilityMode] = useState<AfterAttackAbilityModeState | null>(null);

  // 抓附跟随确认模式
  const [grabFollowMode, setGrabFollowMode] = useState<GrabFollowModeState | null>(null);

  // 连续射击确认模式
  const [rapidFireMode, setRapidFireMode] = useState<RapidFireModeState | null>(null);

  // 撤退触发状态（afterAttack 自动触发，由 Board.tsx 桥接到 useEventCardModes.setWithdrawMode）
  const [withdrawTrigger, setWithdrawTrigger] = useState<WithdrawModeState | null>(null);

  // 阶段切换时清理技能模式
  useEffect(() => {
    // 移动后技能（ancestral_bond, spirit_bond, structure_shift, frost_axe）只在移动阶段有效
    if (abilityMode && currentPhase !== 'move') {
      const movePhaseAbilities = ['ancestral_bond', 'spirit_bond', 'structure_shift', 'frost_axe'];
      if (movePhaseAbilities.includes(abilityMode.abilityId)) {
        setAbilityMode(null);
      }
    }
    // 召唤阶段技能（revive_undead）只在召唤阶段有效
    if (abilityMode && currentPhase !== 'summon') {
      if (abilityMode.abilityId === 'revive_undead') {
        setAbilityMode(null);
      }
    }
  }, [currentPhase, abilityMode]);

  // 待播放的攻击效果队列
  const pendingAttackRef = useRef<PendingAttack | null>(null);

  // 待延迟播放的摧毁效果（含音效 key）
  const pendingDestroyRef = useRef<(DestroyEffectData & { isGate?: boolean; destroyEventId: number; soundKey?: string })[]>([]);

  // ============================================================================
  // 回调函数稳定化（避免 useLayoutEffect 因回调引用变化而重复执行）
  // ============================================================================
  const pushDestroyEffectRef = useRef(pushDestroyEffect);
  pushDestroyEffectRef.current = pushDestroyEffect;
  const fxBusRef = useRef(fxBus);
  fxBusRef.current = fxBus;
  const onDiceRollSoundRef = useRef(onDiceRollSound);
  onDiceRollSoundRef.current = onDiceRollSound;
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

  // 通用游标（同步处理首次挂载跳过 + Undo 重置）
  const entries = getEventStreamEntries(G);
  const { consumeNew } = useEventStreamCursor({ entries });

  // ============================================================================
  // 刷新恢复：首次挂载时扫描 EventStream 历史，恢复未完成的交互型阶段技能
  // ============================================================================
  // 问题：useEventStreamCursor 首次调用跳过所有历史事件（防止重播动画），
  // 但阶段开始/结束触发的交互型技能（幻化、鲜血符文、寒冰碎屑、喟养巨食兽）
  // 需要玩家交互，跳过后 UI 不会进入选择模式，技能"丢失"。
  // 解决：首次挂载时反向扫描历史，找到最后一个未处理的交互型技能事件并恢复。
  const hasRecoveredRef = useRef(false);
  useEffect(() => {
    if (hasRecoveredRef.current) return;
    hasRecoveredRef.current = true;
    if (entries.length === 0) return;

    // 可恢复的阶段技能映射：eventStream 中的 abilityId → UI 恢复配置
    // 只包含阶段开始/结束触发的交互型技能，不包含攻击后/移动后技能
    const RECOVERABLE_PHASE_ABILITIES: Record<string, {
      phases: string[];  // 该技能有效的阶段
      uiAbilityId: string;  // setAbilityMode 的 abilityId
      step: string;
    }> = {
      'illusion_copy': { phases: ['move'], uiAbilityId: 'illusion', step: 'selectUnit' },
      'blood_rune_choice': { phases: ['attack'], uiAbilityId: 'blood_rune', step: 'selectUnit' },
      'ice_shards_damage': { phases: ['build'], uiAbilityId: 'ice_shards', step: 'selectUnit' },
      'feed_beast_check': { phases: ['attack'], uiAbilityId: 'feed_beast', step: 'selectUnit' },
    };

    // 反向扫描：找最后一个可恢复的 ABILITY_TRIGGERED 事件
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      if (entry.event.type !== SW_EVENTS.ABILITY_TRIGGERED) continue;
      const p = entry.event.payload as {
        abilityId?: string; actionId?: string; sourceUnitId?: string; sourcePosition?: CellCoord;
      };
      const recoveryKey = p.actionId ?? p.abilityId;
      if (!recoveryKey || !RECOVERABLE_PHASE_ABILITIES[recoveryKey]) continue;

      const config = RECOVERABLE_PHASE_ABILITIES[recoveryKey];

      // 检查当前阶段是否匹配
      if (!config.phases.includes(currentPhase)) break;

      // 检查后续是否已有 ACTIVATE_ABILITY 处理（说明技能已完成）
      const hasBeenHandled = entries.slice(i + 1).some(e => {
        if (e.event.type !== SW_EVENTS.ABILITY_TRIGGERED) return false;
        const ep = e.event.payload as { abilityId?: string; skipUsageCount?: boolean };
        // ACTIVATE_ABILITY 执行后会产生不带 skipUsageCount 的 ABILITY_TRIGGERED
        return ep.abilityId === config.uiAbilityId && !ep.skipUsageCount;
      });
      if (hasBeenHandled) break;

      // 检查源单位是否仍在场上且属于当前玩家
      if (!p.sourcePosition) break;
      const unit = core.board[p.sourcePosition.row]?.[p.sourcePosition.col]?.unit;
      if (!unit || unit.owner !== myPlayerId) break;

      // 恢复 UI 模式
      setAbilityMode({
        abilityId: config.uiAbilityId,
        step: config.step as AbilityActivationStep,
        sourceUnitId: p.sourceUnitId ?? '',
      });
      break;
    }
  // 仅首次挂载执行，依赖项为初始值
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 监听事件流
  useLayoutEffect(() => {
    if (entries.length >= EVENT_STREAM_WARN && entries.length >= eventStreamLogRef.current + EVENT_STREAM_STEP) {
      eventStreamLogRef.current = entries.length;
      console.warn(`[SW-EVENT] event=stream_backlog size=${entries.length} max=${EVENT_STREAM_WARN}`);
    }

    const { entries: newEntries, didReset } = consumeNew();

    if (didReset) {
      pendingAttackRef.current = null;
      pendingDestroyRef.current = [];
      setDiceResult(null);
      setDyingEntities([]);
      damageBuffer.clear();
      // 撤回导致 EventStream 回退时，清理所有 UI 交互状态
      // 防止撤回后残留的技能按钮仍可点击（如锻造师 frost_axe 充能）
      setAbilityMode(null);
      setSoulTransferMode(null);
      setMindCaptureMode(null);
      setAfterAttackAbilityMode(null);
      setRapidFireMode(null);
      setWithdrawTrigger(null);
      setGrabFollowMode(null);
      gateRef.current.reset();
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
        const p = event.payload as {
          attackType: 'melee' | 'ranged'; diceResults: DiceFaceResult[]; hits: number; diceCount?: number;
          target: CellCoord; attacker: CellCoord;
        };
        const attackerUnit = core.board[p.attacker.row]?.[p.attacker.col]?.unit;
        const isOpponentAttack = attackerUnit ? attackerUnit.owner !== myPlayerId : false;

        gateRef.current.beginSequence();
        pendingAttackRef.current = {
          attacker: p.attacker, target: p.target,
          attackType: p.attackType, hits: p.hits, attackEventId: entry.id, damages: [],
        };

        // 快照目标格及周围格子的当前 damage 值（core 此时已 reduce，需要回退到攻击前的值）
        // 攻击前的 damage = 当前 damage - 即将到来的伤害（伤害事件紧随攻击事件）
        // 但此刻伤害事件尚未被本 hook 处理，所以我们先快照当前值，
        // 后续 UNIT_DAMAGED 事件到来时再从快照中减去对应伤害
        const targetCell = core.board[p.target.row]?.[p.target.col];
        if (targetCell?.unit) {
          damageBuffer.freeze(`${p.target.row}-${p.target.col}`, targetCell.unit.damage);
        } else if (targetCell?.structure) {
          damageBuffer.freeze(`${p.target.row}-${p.target.col}`, targetCell.structure.damage);
        }

        onDiceRollSoundRef.current?.(p.diceCount ?? p.diceResults?.length ?? 1);

        // 收集同批次的减伤事件（DAMAGE_REDUCED 在 UNIT_ATTACKED 之前发射）
        const damageReduced = newEntries
          .filter(e => e.event.type === SW_EVENTS.DAMAGE_REDUCED)
          .reduce((sum, e) => sum + ((e.event.payload as { value?: number }).value ?? 0), 0);

        setDiceResult({
          results: p.diceResults, attackType: p.attackType,
          hits: p.hits, isOpponentAttack,
          damageReduced: damageReduced > 0 ? damageReduced : undefined,
        });
      }

      // 受伤事件 - 存入待播放队列或立即播放
      if (event.type === SW_EVENTS.UNIT_DAMAGED) {
        const p = event.payload as { position: CellCoord; damage: number };
        if (pendingAttackRef.current) {
          pendingAttackRef.current.damages.push({ position: p.position, damage: p.damage, eventId: entry.id });
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

      // 感染触发（交互类：通过 gate 调度，攻击动画期间延迟）
      if (event.type === SW_EVENTS.SUMMON_FROM_DISCARD_REQUESTED) {
        const p = event.payload as {
          playerId: string; cardType: string; position: CellCoord;
          sourceAbilityId: string; sourceUnitId?: string;
        };
        if (p.playerId === myPlayerId) {
          const player = core.players[myPlayerId as PlayerId];
          const hasValidCard = player?.discard.some(c => {
            if (p.cardType === 'plagueZombie') {
              return c.cardType === 'unit' && isPlagueZombieCard(c);
            }
            return false;
          });
          if (hasValidCard) {
            const captured = { sourceUnitId: p.sourceUnitId ?? '', targetPosition: p.position };
            gateRef.current.scheduleInteraction(() => {
              setAbilityMode({
                abilityId: 'infection', step: 'selectCard',
                sourceUnitId: captured.sourceUnitId, targetPosition: captured.targetPosition,
              });
            });
          }
        }
      }

      // 抓附跟随请求（交互类：通过 gate 调度）
      if (event.type === SW_EVENTS.GRAB_FOLLOW_REQUESTED) {
        const p = event.payload as {
          grabberUnitId: string; grabberPosition: CellCoord;
          movedUnitId: string; movedTo: CellCoord;
        };
        // 检查抓附手是否是我的单位
        const grabberUnit = core.board[p.grabberPosition.row]?.[p.grabberPosition.col]?.unit;
        if (grabberUnit && grabberUnit.owner === myPlayerId) {
          const captured = {
            grabberUnitId: p.grabberUnitId,
            grabberPosition: p.grabberPosition,
            movedUnitId: p.movedUnitId,
            movedTo: p.movedTo,
          };
          gateRef.current.scheduleInteraction(() => {
            setGrabFollowMode(captured);
          });
        }
      }

      // 灵魂转移请求（交互类：通过 gate 调度）
      if (event.type === SW_EVENTS.SOUL_TRANSFER_REQUESTED) {
        const p = event.payload as {
          sourceUnitId: string; sourcePosition: CellCoord;
          victimPosition: CellCoord; ownerId: string;
        };
        if (p.ownerId === myPlayerId) {
          const captured = { sourceUnitId: p.sourceUnitId, sourcePosition: p.sourcePosition, victimPosition: p.victimPosition };
          gateRef.current.scheduleInteraction(() => {
            setSoulTransferMode(captured);
          });
        }
      }

      // 心灵捕获请求（交互类：通过 gate 调度）
      if (event.type === SW_EVENTS.MIND_CAPTURE_REQUESTED) {
        const p = event.payload as {
          sourceUnitId: string; sourcePosition: CellCoord;
          targetPosition: CellCoord; targetUnitId: string;
          ownerId: string; hits: number;
        };
        if (p.ownerId === myPlayerId) {
          const captured = {
            sourceUnitId: p.sourceUnitId, sourcePosition: p.sourcePosition,
            targetPosition: p.targetPosition, targetUnitId: p.targetUnitId, hits: p.hits,
          };
          gateRef.current.scheduleInteraction(() => {
            setMindCaptureMode(captured);
          });
        }
      }

      // 攻击后技能触发（念力/高阶念力/读心传念）
      if (event.type === SW_EVENTS.ABILITY_TRIGGERED) {
        const p = event.payload as {
          abilityId: string; actionId?: string; sourceUnitId: string; sourcePosition: CellCoord;
        };
        // custom action else 分支产生的事件用 actionId 匹配（abilityId 为父技能 ID，用于 ActionLog 国际化）
        const matchId = p.actionId ?? p.abilityId;
        if (['telekinesis', 'high_telekinesis', 'mind_transmission'].includes(p.abilityId)) {
          // 检查是否是我的单位
          const unit = core.board[p.sourcePosition.row]?.[p.sourcePosition.col]?.unit;
          if (unit && unit.owner === myPlayerId) {
            const captured = {
              abilityId: p.abilityId as 'telekinesis' | 'high_telekinesis' | 'mind_transmission',
              sourceUnitId: p.sourceUnitId,
              sourcePosition: p.sourcePosition,
            };
            gateRef.current.scheduleInteraction(() => {
              setAfterAttackAbilityMode(captured);
            });
          }
        }
        // 连续射击：攻击后可选消耗充能进行额外攻击
        if (matchId === 'rapid_fire_extra_attack') {
          const unit = core.board[p.sourcePosition.row]?.[p.sourcePosition.col]?.unit;
          if (unit && unit.owner === myPlayerId && (unit.boosts ?? 0) >= 1) {
            const captured = {
              sourceUnitId: p.sourceUnitId,
              sourcePosition: p.sourcePosition,
            };
            gateRef.current.scheduleInteraction(() => {
              setRapidFireMode(captured);
            });
          }
        }
        // 撤退：攻击后可选消耗充能/魔力推拉自身1-2格
        if (matchId === 'withdraw') {
          const unit = core.board[p.sourcePosition.row]?.[p.sourcePosition.col]?.unit;
          if (unit && unit.owner === myPlayerId) {
            const hasCharge = (unit.boosts ?? 0) >= 1;
            const hasMagic = core.players[myPlayerId as '0' | '1']?.magic >= 1;
            if (hasCharge || hasMagic) {
              const captured = { sourceUnitId: p.sourceUnitId };
              gateRef.current.scheduleInteraction(() => {
                setWithdrawTrigger({ sourceUnitId: captured.sourceUnitId, step: 'selectCost' });
              });
            }
          }
        }
        // 幻化：移动阶段开始时自动进入目标选择模式
        if (matchId === 'illusion_copy') {
          const unit = core.board[p.sourcePosition?.row]?.[p.sourcePosition?.col]?.unit;
          if (unit && unit.owner === myPlayerId) {
            const captured = { sourceUnitId: p.sourceUnitId };
            gateRef.current.scheduleInteraction(() => {
              setAbilityMode({
                abilityId: 'illusion',
                step: 'selectUnit',
                sourceUnitId: captured.sourceUnitId,
              });
            });
          }
        }
        // 指引：召唤阶段开始时自动抓牌（已在 abilityResolver 中直接处理，无需 UI 交互）
        // 鲜血符文：攻击阶段开始时进入选择模式
        if (matchId === 'blood_rune_choice') {
          const unit = core.board[p.sourcePosition?.row]?.[p.sourcePosition?.col]?.unit;
          if (unit && unit.owner === myPlayerId) {
            const captured = { sourceUnitId: p.sourceUnitId };
            gateRef.current.scheduleInteraction(() => {
              setAbilityMode({
                abilityId: 'blood_rune',
                step: 'selectUnit', // 复用 selectUnit 步骤表示等待选择
                sourceUnitId: captured.sourceUnitId,
              });
            });
          }
        }
        // 寒冰碎屑：建造阶段结束时进入确认模式
        if (matchId === 'ice_shards_damage') {
          const unit = core.board[p.sourcePosition?.row]?.[p.sourcePosition?.col]?.unit;
          if (unit && unit.owner === myPlayerId) {
            const captured = { sourceUnitId: p.sourceUnitId };
            gateRef.current.scheduleInteraction(() => {
              setAbilityMode({
                abilityId: 'ice_shards',
                step: 'selectUnit', // 复用表示等待确认
                sourceUnitId: captured.sourceUnitId,
              });
            });
          }
        }
        // 喟养巨食兽：攻击阶段结束时进入选择模式
        if (matchId === 'feed_beast_check') {
          const unit = core.board[p.sourcePosition?.row]?.[p.sourcePosition?.col]?.unit;
          if (unit && unit.owner === myPlayerId) {
            const captured = { sourceUnitId: p.sourceUnitId };
            gateRef.current.scheduleInteraction(() => {
              setAbilityMode({
                abilityId: 'feed_beast',
                step: 'selectUnit', // 选择相邻友方单位或自毁
                sourceUnitId: captured.sourceUnitId,
              });
            });
          }
        }
        // ================================================================
        // afterMove 技能触发：移动后自动进入技能选择模式
        // ================================================================
        // 祖灵交流：充能自身或转移给3格内友方
        if (matchId === 'afterMove:spirit_bond') {
          const unit = core.board[p.sourcePosition?.row]?.[p.sourcePosition?.col]?.unit;
          if (unit && unit.owner === myPlayerId) {
            const captured = { sourceUnitId: p.sourceUnitId };
            gateRef.current.scheduleInteraction(() => {
              setAbilityMode({
                abilityId: 'spirit_bond',
                step: 'selectUnit',
                sourceUnitId: captured.sourceUnitId,
              });
            });
          }
        }
        // 祖灵羁绊：充能+转移给3格内友方（可选）
        if (matchId === 'afterMove:ancestral_bond') {
          const unit = core.board[p.sourcePosition?.row]?.[p.sourcePosition?.col]?.unit;
          if (unit && unit.owner === myPlayerId) {
            const captured = { sourceUnitId: p.sourceUnitId };
            gateRef.current.scheduleInteraction(() => {
              setAbilityMode({
                abilityId: 'ancestral_bond',
                step: 'selectUnit',
                sourceUnitId: captured.sourceUnitId,
              });
            });
          }
        }
        // 结构变换：推拉3格内友方建筑（可选）
        if (matchId === 'afterMove:structure_shift') {
          const unit = core.board[p.sourcePosition?.row]?.[p.sourcePosition?.col]?.unit;
          if (unit && unit.owner === myPlayerId) {
            const captured = { sourceUnitId: p.sourceUnitId };
            gateRef.current.scheduleInteraction(() => {
              setAbilityMode({
                abilityId: 'structure_shift',
                step: 'selectUnit',
                sourceUnitId: captured.sourceUnitId,
              });
            });
          }
        }
        // 冰霜战斧：充能或消耗充能附加（可选）
        if (matchId === 'afterMove:frost_axe') {
          const unit = core.board[p.sourcePosition?.row]?.[p.sourcePosition?.col]?.unit;
          if (unit && unit.owner === myPlayerId) {
            const captured = { sourceUnitId: p.sourceUnitId };
            gateRef.current.scheduleInteraction(() => {
              setAbilityMode({
                abilityId: 'frost_axe',
                step: 'selectUnit',
                sourceUnitId: captured.sourceUnitId,
              });
            });
          }
        }
        // 寒冰冲撞：建筑移动/推拉后选择相邻单位
        if (matchId === 'ice_ram_trigger') {
          const iceRamOwner = (event.payload as Record<string, unknown>).iceRamOwner as string;
          const structurePosition = (event.payload as Record<string, unknown>).structurePosition as CellCoord;
          if (iceRamOwner === myPlayerId && structurePosition) {
            const captured = { structurePosition };
            gateRef.current.scheduleInteraction(() => {
              setAbilityMode({
                abilityId: 'ice_ram',
                step: 'selectUnit',
                sourceUnitId: 'ice_ram',
                structurePosition: captured.structurePosition,
              });
            });
          }
        }
      }
    }
  // 依赖数组不包含回调函数，回调通过 ref 访问，避免因回调引用变化导致 effect 重复执行
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [G, core, myPlayerId, consumeNew]);

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
    if (destroyedCard && (destroyedCard.cardType === 'unit' || destroyedCard.cardType === 'structure')) {
      const sprite = getDestroySpriteConfig(destroyedCard as UnitCard | StructureCard);
      atlasId = sprite.atlasId;
      frameIndex = sprite.frameIndex;
    }

    const destroyEffect: DestroyEffectData = { id: '', position, cardName, type, atlasId, frameIndex };
    const pending = pendingAttackRef.current;
    // 延迟条件：攻击目标位置 或 任何受伤位置（含溅射/反击等）
    const shouldDelay = pending && (
      (pending.target.row === position.row && pending.target.col === position.col)
      || pending.damages.some(d => d.position.row === position.row && d.position.col === position.col)
    );

    // 解析摧毁音效 key
    const destroySoundKey = resolveDestroySoundKey(type, isGate);

    if (shouldDelay) {
      pendingDestroyRef.current.push({ ...destroyEffect, isGate, destroyEventId: 0, soundKey: destroySoundKey });
      if (atlasId !== undefined && frameIndex !== undefined) {
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
  const handleCloseDiceResult = useCallback(() => {
    setDiceResult(null);
    return pendingAttackRef.current;
  }, []);

  // 清理待播放数据
  const clearPendingAttack = useCallback(() => {
    pendingAttackRef.current = null;
  }, []);

  // 播放延迟的摧毁特效（含音效）+ 结束视觉序列门控
  const flushPendingDestroys = useCallback(() => {
    if (pendingDestroyRef.current.length > 0) {
      for (const effect of pendingDestroyRef.current) {
        pushDestroyEffectRef.current({
          position: effect.position, cardName: effect.cardName, type: effect.type,
          atlasId: effect.atlasId, frameIndex: effect.frameIndex,
        });
        if (effect.soundKey) {
          playSound(effect.soundKey);
        }
      }
      pendingDestroyRef.current = [];
      setDyingEntities([]);
    }
    // 释放视觉快照，回归 core 真实值
    damageBuffer.clear();
    // 结束视觉序列，排空交互队列（感染/灵魂转移/念力等延迟到此刻触发）
    gateRef.current.endSequence();
  }, []);

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
    abilityMode,
    setAbilityMode,
    soulTransferMode,
    setSoulTransferMode,
    mindCaptureMode,
    setMindCaptureMode,
    afterAttackAbilityMode,
    setAfterAttackAbilityMode,
    rapidFireMode,
    setRapidFireMode,
    grabFollowMode,
    setGrabFollowMode,
    withdrawTrigger,
    setWithdrawTrigger,
    pendingAttackRef,
    handleCloseDiceResult,
    clearPendingAttack,
    flushPendingDestroys,
    releaseDamageSnapshot,
  };
}
