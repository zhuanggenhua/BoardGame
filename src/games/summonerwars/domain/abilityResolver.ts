/**
 * 召唤师战争 - 技能效果解析器
 * 
 * 将技能效果（AbilityEffect）转换为游戏事件（GameEvent）
 */

import type { GameEvent } from '../../../engine/types';
import type { 
  SummonerWarsCore, 
  PlayerId, 
  CellCoord, 
  UnitInstance,
  BoardStructure,
  AbilityTriggeredPayload,
} from './types';
import { SW_EVENTS } from './types';
import type { 
  AbilityDef, 
  AbilityEffect, 
  AbilityCondition, 
  TargetRef, 
  Expression,
  AbilityTrigger,
} from './abilities';
import { abilityRegistry } from './abilities';
import { BOARD_ROWS, BOARD_COLS, manhattanDistance, getPlayerUnits } from './helpers';
import { swCustomActionRegistry } from './customActionHandlers';
import { resolveTargetUnits, resolveTargetPosition } from './abilityTargets';
import {
  createConditionHandlerRegistry,
  evaluateCondition as evaluatePrimitiveCondition,
  evaluateExpression as evaluatePrimitiveExpression,
  lit,
  registerConditionHandler,
  type ConditionContext as PrimitiveConditionContext,
  type ConditionNode as PrimitiveConditionNode,
  type ExpressionNode as PrimitiveExpressionNode,
} from '../../../engine/primitives';
import { getBaseCardId, isUndeadCard, isPlagueZombieCard, isFortressUnit, CARD_IDS } from './ids';
import { buildUsageKey } from './utils';

// ============================================================================
// 效果解析上下文
// ============================================================================

/**
 * 创建类型安全的 ABILITY_TRIGGERED 事件
 * 
 * 所有 ABILITY_TRIGGERED 事件必须通过此函数创建，
 * 确保 payload 包含 sourcePosition（UI 层依赖此字段定位单位）。
 */
function createAbilityTriggeredEvent(
  payload: AbilityTriggeredPayload,
  timestamp: number,
): GameEvent {
  return {
    type: SW_EVENTS.ABILITY_TRIGGERED,
    payload,
    timestamp,
  };
}

/**
 * 效果解析上下文
 */
export interface AbilityContext {
  /** 游戏状态 */
  state: SummonerWarsCore;
  /** 技能拥有者（单位） */
  sourceUnit: UnitInstance;
  /** 技能拥有者位置 */
  sourcePosition: CellCoord;
  /** 技能拥有者的玩家 ID */
  ownerId: PlayerId;
  /** 攻击目标（如果是攻击相关触发） */
  targetUnit?: UnitInstance;
  /** 攻击目标位置 */
  targetPosition?: CellCoord;
  /** 被消灭的单位（如果是死亡相关触发） */
  victimUnit?: UnitInstance;
  /** 被消灭单位的位置 */
  victimPosition?: CellCoord;
  /** 击杀者（如果是击杀相关触发） */
  killerUnit?: UnitInstance;
  /** 玩家选择的目标（如果需要选择） */
  selectedTargets?: {
    units?: UnitInstance[];
    positions?: CellCoord[];
    cardIds?: string[];
  };
  /** 本次攻击的骰子结果（afterAttack 时可用） */
  diceResults?: import('../config/dice').DiceFaceResult[];
  /** 时间戳 */
  timestamp: number;
}

// 目标解析（已提取到 abilityTargets.ts）
export { resolveTargetUnits, resolveTargetPosition } from './abilityTargets';

// ============================================================================
// 表达式计算（复用 engine/primitives）
// ============================================================================

function resolveAttributeExpressionValue(
  expr: Extract<Expression, { type: 'attribute' }>,
  ctx: AbilityContext,
): number {
  const units = resolveTargetUnits(expr.target, ctx);
  if (units.length === 0) return 0;
  const unit = units[0];
  switch (expr.attr) {
    case 'damage':
      return unit.damage;
    case 'life':
      return unit.card.life;
    case 'strength':
      return unit.card.strength;
    case 'charge':
      return unit.boosts ?? 0;
    default:
      return 0;
  }
}

function toPrimitiveExpressionNode(expr: Expression, ctx: AbilityContext): PrimitiveExpressionNode {
  if (typeof expr === 'number') {
    return lit(expr);
  }

  switch (expr.type) {
    case 'attribute':
      // 将 domain-specific attribute 读取预先求值为 literal，
      // 其余算术结构交给 primitives/expression 处理。
      return lit(resolveAttributeExpressionValue(expr, ctx));

    case 'multiply':
      return {
        type: 'mul',
        left: toPrimitiveExpressionNode(expr.left, ctx),
        right: toPrimitiveExpressionNode(expr.right, ctx),
      };

    case 'add':
      return {
        type: 'add',
        left: toPrimitiveExpressionNode(expr.left, ctx),
        right: toPrimitiveExpressionNode(expr.right, ctx),
      };

    default:
      return lit(0);
  }
}

/**
 * 计算表达式值
 */
export function evaluateExpression(expr: Expression, ctx: AbilityContext): number {
  // 当前 SW Expression 不包含 var 引用，因此 ctx 可为空。
  return evaluatePrimitiveExpression(toPrimitiveExpressionNode(expr, ctx), {});
}

// ============================================================================
// 条件评估（复用 engine/primitives）
// ============================================================================

const swConditionRegistry = createConditionHandlerRegistry();

registerConditionHandler(swConditionRegistry, 'hasCharge', (params, ctx) => {
  const abilityCtx = (ctx as any).abilityCtx as AbilityContext | undefined;
  if (!abilityCtx) return false;
  const { target, minStacks } = (params ?? {}) as any;
  const units = resolveTargetUnits(target, abilityCtx);
  const min = typeof minStacks === 'number' ? minStacks : 1;
  return units.some(u => (u.boosts ?? 0) >= min);
});

registerConditionHandler(swConditionRegistry, 'isUnitType', (params, ctx) => {
  const abilityCtx = (ctx as any).abilityCtx as AbilityContext | undefined;
  if (!abilityCtx) return false;
  const { target, unitType } = (params ?? {}) as any;
  const units = resolveTargetUnits(target, abilityCtx);
  return units.some(u => {
    if (unitType === 'undead') {
      return isUndeadCard(u.card);
    }
    return u.card.unitClass === unitType;
  });
});

registerConditionHandler(swConditionRegistry, 'isInRange', (params, ctx) => {
  const abilityCtx = (ctx as any).abilityCtx as AbilityContext | undefined;
  if (!abilityCtx) return false;
  const { target, range } = (params ?? {}) as any;
  const units = resolveTargetUnits(target, abilityCtx);
  const r = typeof range === 'number' ? range : 0;
  return units.some(u => manhattanDistance(abilityCtx.sourcePosition, u.position) <= r);
});

registerConditionHandler(swConditionRegistry, 'isOwner', (params, ctx) => {
  const abilityCtx = (ctx as any).abilityCtx as AbilityContext | undefined;
  if (!abilityCtx) return false;
  const { target, owner } = (params ?? {}) as any;
  const expectedOwner = owner === 'self' ? abilityCtx.ownerId : getOpponentId(abilityCtx.ownerId);
  const units = resolveTargetUnits(target, abilityCtx);
  return units.some(u => u.owner === expectedOwner);
});

registerConditionHandler(swConditionRegistry, 'hasCardInDiscard', (params, ctx) => {
  const abilityCtx = (ctx as any).abilityCtx as AbilityContext | undefined;
  if (!abilityCtx) return false;
  const { cardType } = (params ?? {}) as any;
  const player = abilityCtx.state.players[abilityCtx.ownerId];
  return player.discard.some(card => {
    if (cardType === 'undead') {
      return isUndeadCard(card);
    }
    if (cardType === 'plagueZombie') {
      return isPlagueZombieCard(card);
    }
    return card.cardType === cardType;
  });
});

function toPrimitiveConditionNode(condition: AbilityCondition): PrimitiveConditionNode {
  switch (condition.type) {
    case 'always':
      return { type: 'always' };

    case 'and':
      return { type: 'and', conditions: condition.conditions.map(toPrimitiveConditionNode) };

    case 'or':
      return { type: 'or', conditions: condition.conditions.map(toPrimitiveConditionNode) };

    case 'not':
      return { type: 'not', condition: toPrimitiveConditionNode(condition.condition) };

    default:
      // 其余条件为 domain-specific，交给自定义 handler
      return { type: 'custom', handler: condition.type, params: condition as any };
  }
}

/**
 * 评估条件
 */
export function evaluateCondition(condition: AbilityCondition, ctx: AbilityContext): boolean {
  const primCtx: PrimitiveConditionContext = { abilityCtx: ctx };
  return evaluatePrimitiveCondition(toPrimitiveConditionNode(condition), primCtx, swConditionRegistry);
}

function getOpponentId(playerId: PlayerId): PlayerId {
  return playerId === '0' ? '1' : '0';
}

// ============================================================================
// 效果解析
// ============================================================================

/**
 * 解析单个效果，生成事件
 */
export function resolveEffect(
  effect: AbilityEffect,
  ctx: AbilityContext,
  abilityId: string
): GameEvent[] {
  const events: GameEvent[] = [];
  const { timestamp } = ctx;

  switch (effect.type) {
    case 'damage': {
      const targets = resolveTargetUnits(effect.target, ctx);
      const value = typeof effect.value === 'number' 
        ? effect.value 
        : evaluateExpression(effect.value, ctx);
      
      for (const target of targets) {
        events.push({
          type: SW_EVENTS.UNIT_DAMAGED,
          payload: {
            position: target.position,
            damage: value,
            sourceAbilityId: abilityId,
            sourcePlayerId: ctx.ownerId,
          },
          timestamp,
        });
      }
      break;
    }

    case 'heal': {
      const targets = resolveTargetUnits(effect.target, ctx);
      const value = typeof effect.value === 'number'
        ? effect.value
        : evaluateExpression(effect.value, ctx);

      for (const target of targets) {
        events.push({
          type: SW_EVENTS.UNIT_HEALED,
          payload: {
            position: target.position,
            amount: value,
            sourceAbilityId: abilityId,
          },
          timestamp,
        });
      }
      break;
    }

    case 'addCharge': {
      const targets = resolveTargetUnits(effect.target, ctx);
      for (const target of targets) {
        events.push({
          type: SW_EVENTS.UNIT_CHARGED,
          payload: {
            position: target.position,
            delta: effect.value,
            sourceAbilityId: abilityId,
          },
          timestamp,
        });
      }
      break;
    }

    case 'removeCharge': {
      const targets = resolveTargetUnits(effect.target, ctx);
      for (const target of targets) {
        events.push({
          type: SW_EVENTS.UNIT_CHARGED,
          payload: {
            position: target.position,
            delta: -effect.value,
            sourceAbilityId: abilityId,
          },
          timestamp,
        });
      }
      break;
    }

    case 'setCharge': {
      const targets = resolveTargetUnits(effect.target, ctx);
      for (const target of targets) {
        const currentCharge = target.boosts ?? 0;
        const delta = effect.value - currentCharge;
        events.push({
          type: SW_EVENTS.UNIT_CHARGED,
          payload: {
            position: target.position,
            delta,
            newValue: effect.value,
            sourceAbilityId: abilityId,
          },
          timestamp,
        });
      }
      break;
    }

    case 'destroyUnit': {
      const targets = resolveTargetUnits(effect.target, ctx);
      for (const target of targets) {
        events.push({
          type: SW_EVENTS.UNIT_DESTROYED,
          payload: {
            position: target.position,
            cardId: target.cardId,
            instanceId: target.instanceId,
            cardName: target.card.name,
            owner: target.owner,
            killerPlayerId: ctx.ownerId,
            killerUnitId: ctx.sourceUnit.instanceId,
            sourceAbilityId: abilityId,
          },
          timestamp,
        });
      }
      break;
    }

    case 'moveUnit': {
      const targets = resolveTargetUnits(effect.target, ctx);
      const toPosition = resolveTargetPosition(effect.to, ctx);
      
      if (toPosition && targets.length > 0) {
        const target = targets[0];
        events.push({
          type: SW_EVENTS.UNIT_MOVED,
          payload: {
            from: target.position,
            to: toPosition,
            unitId: target.instanceId,
            sourceAbilityId: abilityId,
            path: [target.position, toPosition], // 技能移动通常是单格或传送
          },
          timestamp,
        });
      }
      break;
    }

    case 'modifyMagic': {
      const playerId = effect.target === 'owner' ? ctx.ownerId : getOpponentId(ctx.ownerId);
      events.push({
        type: SW_EVENTS.MAGIC_CHANGED,
        payload: {
          playerId,
          delta: effect.value,
          sourceAbilityId: abilityId,
        },
        timestamp,
      });
      break;
    }

    case 'preventMagicGain': {
      // 这个效果需要在伤害结算时检查，设置一个标记
      events.push(createAbilityTriggeredEvent({
        abilityId: 'soulless',
        effectType: 'preventMagicGain',
        sourceUnitId: ctx.sourceUnit.instanceId,
        sourcePosition: ctx.sourcePosition,
      }, timestamp));
      break;
    }

    case 'doubleStrength': {
      const targets = resolveTargetUnits(effect.target, ctx);
      for (const target of targets) {
        events.push({
          type: SW_EVENTS.STRENGTH_MODIFIED,
          payload: {
            position: target.position,
            multiplier: 2,
            sourceAbilityId: abilityId,
          },
          timestamp,
        });
      }
      break;
    }

    case 'summonFromDiscard': {
      const position = resolveTargetPosition(effect.position, ctx);
      if (position) {
        events.push({
          type: SW_EVENTS.SUMMON_FROM_DISCARD_REQUESTED,
          payload: {
            playerId: ctx.ownerId,
            cardType: effect.cardType,
            position,
            sourceAbilityId: abilityId,
            sourceUnitId: ctx.sourceUnit.instanceId,
          },
          timestamp,
        });
      }
      break;
    }

    case 'custom': {
      const handler = swCustomActionRegistry.get(effect.actionId);
      if (handler) {
        // 已注册的 handler（soul_transfer、mind_capture、judgment_draw 等）
        events.push(...handler({ ctx, params: effect.params, abilityId, timestamp }));
      } else {
        // 未注册的 actionId → 通用 ABILITY_TRIGGERED 事件（由 execute.ts/reduce.ts 消费）
        events.push(createAbilityTriggeredEvent({
          abilityId: effect.actionId,
          params: effect.params,
          sourceUnitId: ctx.sourceUnit.instanceId,
          sourcePosition: ctx.sourcePosition,
        }, timestamp));
      }
      break;
    }

    case 'pushPull': {
      const targets = resolveTargetUnits(effect.target, ctx);
      for (const target of targets) {
        // 检查目标是否有稳固（stable）技能（含交缠颂歌共享）
        const targetAbilityIds = getUnitAbilities(target, ctx.state);
        if (targetAbilityIds.some((ability) => ability.id === 'stable')) {
          // 稳固免疫推拉，不生成事件
          continue;
        }
        const eventType = effect.direction === 'pull' ? SW_EVENTS.UNIT_PULLED : SW_EVENTS.UNIT_PUSHED;
        events.push({
          type: eventType,
          payload: {
            targetPosition: target.position,
            targetUnitId: target.instanceId,
            distance: effect.distance,
            direction: effect.direction,
            sourcePosition: ctx.sourcePosition,
            sourceAbilityId: abilityId,
          },
          timestamp,
        });
      }
      break;
    }

    case 'extraMove': {
      // 移动增强效果：在移动验证时由 helpers 检查，此处仅记录触发
      events.push(createAbilityTriggeredEvent({
        abilityId,
        effectType: 'extraMove',
        value: effect.value,
        canPassThrough: effect.canPassThrough,
        sourceUnitId: ctx.sourceUnit.instanceId,
        sourcePosition: ctx.sourcePosition,
      }, timestamp));
      break;
    }

    case 'takeControl': {
      const targets = resolveTargetUnits(effect.target, ctx);
      for (const target of targets) {
        events.push({
          type: SW_EVENTS.CONTROL_TRANSFERRED,
          payload: {
            targetPosition: target.position,
            targetUnitId: target.instanceId,
            newOwner: ctx.ownerId,
            duration: effect.duration ?? 'permanent',
            sourceAbilityId: abilityId,
          },
          timestamp,
        });
      }
      break;
    }

    case 'reduceDamage': {
      events.push({
        type: SW_EVENTS.DAMAGE_REDUCED,
        payload: {
          sourceUnitId: ctx.sourceUnit.instanceId,
          sourcePosition: ctx.sourcePosition,
          value: effect.value,
          condition: effect.condition,
          sourceAbilityId: abilityId,
        },
        timestamp,
      });
      break;
    }

    case 'grantExtraAttack': {
      const targets = resolveTargetUnits(effect.target, ctx);
      for (const target of targets) {
        events.push({
          type: SW_EVENTS.EXTRA_ATTACK_GRANTED,
          payload: {
            targetPosition: target.position,
            targetUnitId: target.instanceId,
            sourceAbilityId: abilityId,
          },
          timestamp,
        });
      }
      break;
    }
  }

  return events;
}

/**
 * 解析技能的所有效果
 */
export function resolveAbilityEffects(
  ability: AbilityDef,
  ctx: AbilityContext
): GameEvent[] {
  // 检查条件
  if (ability.condition && !evaluateCondition(ability.condition, ctx)) {
    return [];
  }

  // 解析所有效果
  const events: GameEvent[] = [];
  
  // 先触发技能激活事件（自动触发的通知事件，不消耗 usageCount）
  // usageCount 的消耗由 executeActivateAbility 中的 ABILITY_TRIGGERED 事件负责
  events.push(createAbilityTriggeredEvent({
    abilityId: ability.id,
    abilityName: ability.name,
    sourceUnitId: ctx.sourceUnit.instanceId,
    sourcePosition: ctx.sourcePosition,
    skipUsageCount: true,
  }, ctx.timestamp));

  // 解析效果
  for (const effect of ability.effects) {
    events.push(...resolveEffect(effect, ctx, ability.id));
  }

  return events;
}

// ============================================================================
// 触发器处理
// ============================================================================

/**
 * 获取单位自身技能定义（base + temp），不含状态依赖的共享技能
 */
export function getUnitBaseAbilities(unit: UnitInstance): AbilityDef[] {
  const baseIds = unit.card.abilities ?? [];
  const tempIds = unit.tempAbilities ?? [];
  const abilityIds = tempIds.length > 0 ? [...baseIds, ...tempIds] : [...baseIds];
  return abilityIds
    .map(id => abilityRegistry.get(id))
    .filter((def): def is AbilityDef => def !== undefined);
}

/**
 * 获取单位在当前游戏状态下的所有技能定义（含交缠颂歌共享技能）
 * state 必传，确保交缠颂歌等状态依赖逻辑始终生效
 */
export function getUnitAbilities(unit: UnitInstance, state: SummonerWarsCore): AbilityDef[] {
  const baseIds = unit.card.abilities ?? [];
  const tempIds = unit.tempAbilities ?? [];
  const abilityIds = tempIds.length > 0 ? [...baseIds, ...tempIds] : [...baseIds];

  // 交缠颂歌：检查主动事件区是否有交缠颂歌标记了本单位
  for (const pid of ['0', '1'] as PlayerId[]) {
    const player = state.players[pid];
    if (!player) continue;
    for (const ev of player.activeEvents) {
      if (getBaseCardId(ev.id) !== CARD_IDS.BARBARIC_CHANT_OF_ENTANGLEMENT) continue;
      if (!ev.entanglementTargets) continue;
      const [t1, t2] = ev.entanglementTargets;
      let partnerBaseAbilities: string[] | undefined;
      if (t1 === unit.instanceId) {
        const partner = findUnitByInstanceIdOnBoard(state, t2);
        if (partner) {
          // 规则定义：基础能力 = 单位卡上印刷的能力，不含 tempAbilities
          partnerBaseAbilities = [...(partner.card.abilities ?? [])];
        }
      } else if (t2 === unit.instanceId) {
        const partner = findUnitByInstanceIdOnBoard(state, t1);
        if (partner) {
          partnerBaseAbilities = [...(partner.card.abilities ?? [])];
        }
      }
      if (partnerBaseAbilities) {
        for (const a of partnerBaseAbilities) {
          if (!abilityIds.includes(a)) abilityIds.push(a);
        }
      }
    }
  }

  return abilityIds
    .map(id => abilityRegistry.get(id))
    .filter((def): def is AbilityDef => def !== undefined);
}

/** 按 instanceId 在棋盘上查找单位 */
function findUnitByInstanceIdOnBoard(state: SummonerWarsCore, instanceId: string): UnitInstance | undefined {
  for (let row = 0; row < state.board.length; row++) {
    for (let col = 0; col < (state.board[row]?.length ?? 0); col++) {
      const unit = state.board[row]?.[col]?.unit;
      if (unit && unit.instanceId === instanceId) return unit;
    }
  }
  return undefined;
}

/**
 * 触发指定时机的技能
 */
export function triggerAbilities(
  trigger: AbilityTrigger,
  ctx: AbilityContext
): GameEvent[] {
  const abilities = getUnitAbilities(ctx.sourceUnit, ctx.state);
  const matchingAbilities = abilities.filter(a => a.trigger === trigger);
  
  const events: GameEvent[] = [];
  for (const ability of matchingAbilities) {
    // 检查使用次数限制（usesPerTurn）
    if (ability.usesPerTurn !== undefined) {
      const usageKey = buildUsageKey(ctx.sourceUnit.instanceId, ability.id);
      const usageCount = ctx.state.abilityUsageCount[usageKey] ?? 0;
      if (usageCount >= ability.usesPerTurn) {
        // 已达到使用次数上限，跳过
        continue;
      }
    }
    
    events.push(...resolveAbilityEffects(ability, ctx));
  }
  
  return events;
}

/**
 * 触发所有单位的指定时机技能
 */
export function triggerAllUnitsAbilities(
  trigger: AbilityTrigger,
  state: SummonerWarsCore,
  playerId: PlayerId,
  additionalCtx?: Partial<AbilityContext>
): GameEvent[] {
  const events: GameEvent[] = [];
  const timestamp = typeof additionalCtx?.timestamp === 'number' ? additionalCtx.timestamp : 0;

  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const unit = state.board[row]?.[col]?.unit;
      if (unit && unit.owner === playerId) {
        const ctx: AbilityContext = {
          state,
          sourceUnit: unit,
          sourcePosition: { row, col },
          ownerId: playerId,
          timestamp,
          ...additionalCtx,
        };
        events.push(...triggerAbilities(trigger, ctx));
      }
    }
  }

  return events;
}

/**
 * 战力计算结果（含 breakdown 明细）
 */
export interface StrengthResult {
  /** 基础战力（卡牌面板值） */
  baseStrength: number;
  /** 最终战力（含所有 buff，下限 0） */
  finalStrength: number;
  /** 各 buff 修正明细 */
  modifiers: Array<{
    /** buff 来源 ID（能力 ID / 事件卡 ID） */
    source: string;
    /** buff 显示名称 */
    sourceName: string;
    /** 贡献值 */
    value: number;
  }>;
}

/**
 * 计算单位的有效战力（考虑技能加成），返回含 breakdown 的完整结果
 */
export function calculateEffectiveStrength(
  unit: UnitInstance,
  state: SummonerWarsCore,
  targetUnit?: UnitInstance
): StrengthResult {
  const baseStrength = unit.card.strength;
  let strength = baseStrength;
  const modifiers: StrengthResult['modifiers'] = [];
  const abilities = getUnitAbilities(unit, state);
  const abilityIds = new Set(abilities.map(a => a.id));

  // 附加事件卡加成（如狱火铸剑 +2）
  if (unit.attachedCards) {
    for (const attached of unit.attachedCards) {
      if (getBaseCardId(attached.id) === CARD_IDS.NECRO_HELLFIRE_BLADE) {
        strength += 2;
        modifiers.push({ source: CARD_IDS.NECRO_HELLFIRE_BLADE, sourceName: '狱火铸剑', value: 2 });
      }
    }
  }

  // 催眠引诱加成：召唤师攻击被催眠的目标时+1战力
  if (targetUnit && unit.card.unitClass === 'summoner') {
    const player = state.players[unit.owner];
    for (const ev of player.activeEvents) {
      if (getBaseCardId(ev.id) === CARD_IDS.TRICKSTER_HYPNOTIC_LURE && ev.targetUnitId === targetUnit.instanceId) {
        strength += 1;
        modifiers.push({ source: CARD_IDS.TRICKSTER_HYPNOTIC_LURE, sourceName: '催眠引诱', value: 1 });
      }
    }
  }

  for (const ability of abilities) {
    if (ability.trigger === 'onDamageCalculation' || ability.trigger === 'passive') {
      const timestamp = 0;
      const ctx: AbilityContext = {
        state,
        sourceUnit: unit,
        sourcePosition: unit.position,
        ownerId: unit.owner,
        timestamp,
      };

      // 检查条件
      if (ability.condition && !evaluateCondition(ability.condition, ctx)) {
        continue;
      }

      // 应用效果
      for (const effect of ability.effects) {
        if (effect.type === 'modifyStrength') {
          const value = typeof effect.value === 'number'
            ? effect.value
            : evaluateExpression(effect.value, ctx);
          // 数据驱动上限：由 AbilityDef 的 maxBonus 字段控制
          const capped = effect.maxBonus != null ? Math.min(value, effect.maxBonus) : value;
          if (capped !== 0) {
            strength += capped;
            modifiers.push({
              source: ability.id,
              sourceName: ability.name ?? ability.id,
              value: capped,
            });
          }
        }
      }
    }
  }

  // 成群结队（围攻）加成：任一玩家主动事件区有 goblin-swarm 时，
  // 友方单位攻击时每有一个其它友方单位和目标相邻，+1战力
  if (targetUnit) {
    const player = state.players[unit.owner];
    const hasSwarm = player.activeEvents.some(ev => {
      return getBaseCardId(ev.id) === CARD_IDS.GOBLIN_SWARM;
    });
    if (hasSwarm) {
      // 计算与目标相邻的其它友方单位数量
      const targetPos = targetUnit.position;
      const dirs = [
        { row: -1, col: 0 }, { row: 1, col: 0 },
        { row: 0, col: -1 }, { row: 0, col: 1 },
      ];
      let adjacentAllies = 0;
      for (const d of dirs) {
        const adjPos = { row: targetPos.row + d.row, col: targetPos.col + d.col };
        if (adjPos.row < 0 || adjPos.row >= state.board.length) continue;
        if (adjPos.col < 0 || adjPos.col >= (state.board[0]?.length ?? 0)) continue;
        const adjUnit = state.board[adjPos.row]?.[adjPos.col]?.unit;
        if (adjUnit && adjUnit.owner === unit.owner && adjUnit.instanceId !== unit.instanceId) {
          adjacentAllies++;
        }
      }
      if (adjacentAllies > 0) {
        strength += adjacentAllies;
        modifiers.push({ source: CARD_IDS.GOBLIN_SWARM, sourceName: '成群结队', value: adjacentAllies });
      }
    }
  }

  // 冲锋加成：野兽骑手冲锋3+格时+1战力（通过 boosts 标记）
  if (abilityIds.has('charge') && unit.boosts > 0) {
    strength += unit.boosts;
    modifiers.push({ source: 'charge', sourceName: '冲锋', value: unit.boosts });
  }

  // 城塞精锐：2格内每有一个友方城塞单位+1战力
  if (abilityIds.has('fortress_elite')) {
    let eliteBonus = 0;
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        const other = state.board[row]?.[col]?.unit;
        if (other && other.owner === unit.owner && other.instanceId !== unit.instanceId
          && isFortressUnit(other.card)
          && manhattanDistance(unit.position, { row, col }) <= 2) {
          eliteBonus += 1;
        }
      }
    }
    if (eliteBonus > 0) {
      strength += eliteBonus;
      modifiers.push({ source: 'fortress_elite', sourceName: '城塞精锐', value: eliteBonus });
    }
  }

  // 辉光射击：每2点魔力+1战力
  if (abilityIds.has('radiant_shot')) {
    const playerMagic = state.players[unit.owner]?.magic ?? 0;
    const radiantBonus = Math.floor(playerMagic / 2);
    if (radiantBonus > 0) {
      strength += radiantBonus;
      modifiers.push({ source: 'radiant_shot', sourceName: '辉光射击', value: radiantBonus });
    }
  }

  // 冰霜飞弹：相邻每有一个友方建筑+1战力
  if (abilityIds.has('frost_bolt')) {
    let frostBonus = 0;
    const dirs = [
      { row: -1, col: 0 }, { row: 1, col: 0 },
      { row: 0, col: -1 }, { row: 0, col: 1 },
    ];
    for (const d of dirs) {
      const adjPos = { row: unit.position.row + d.row, col: unit.position.col + d.col };
      if (adjPos.row < 0 || adjPos.row >= BOARD_ROWS || adjPos.col < 0 || adjPos.col >= BOARD_COLS) continue;
      const adjCell = state.board[adjPos.row]?.[adjPos.col];
      // 友方建筑 或 友方活体结构单位（寒冰魔像）
      if (adjCell?.structure && adjCell.structure.owner === unit.owner) {
        frostBonus += 1;
      } else if (adjCell?.unit && adjCell.unit.owner === unit.owner
        && getUnitAbilities(adjCell.unit, state).map(a => a.id).includes('mobile_structure')) {
        frostBonus += 1;
      }
    }
    if (frostBonus > 0) {
      strength += frostBonus;
      modifiers.push({ source: 'frost_bolt', sourceName: '冰霜飞弹', value: frostBonus });
    }
  }

  // 高阶冰霜飞弹：2格内每有一个友方建筑+1战力
  if (abilityIds.has('greater_frost_bolt')) {
    let greaterFrostBonus = 0;
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        const dist = manhattanDistance(unit.position, { row, col });
        if (dist === 0 || dist > 2) continue;
        const cell = state.board[row]?.[col];
        if (cell?.structure && cell.structure.owner === unit.owner) {
          greaterFrostBonus += 1;
        } else if (cell?.unit && cell.unit.owner === unit.owner
          && getUnitAbilities(cell.unit, state).map(a => a.id).includes('mobile_structure')) {
          greaterFrostBonus += 1;
        }
      }
    }
    if (greaterFrostBonus > 0) {
      strength += greaterFrostBonus;
      modifiers.push({ source: 'greater_frost_bolt', sourceName: '高阶冰霜飞弹', value: greaterFrostBonus });
    }
  }

  // 圣洁审判：友方主动事件区有 paladin-holy-judgment 时，友方士兵+1战力
  if (unit.card.unitClass === 'common') {
    const player = state.players[unit.owner];
    const hasHolyJudgment = player.activeEvents.some(ev => {
      return getBaseCardId(ev.id) === CARD_IDS.PALADIN_HOLY_JUDGMENT && (ev.charges ?? 0) > 0;
    });
    if (hasHolyJudgment) {
      strength += 1;
      modifiers.push({ source: CARD_IDS.PALADIN_HOLY_JUDGMENT, sourceName: '圣洁审判', value: 1 });
    }
  }

  return {
    baseStrength,
    finalStrength: Math.max(0, strength),
    modifiers,
  };
}

/**
 * 获取单位有效战力数值（向后兼容便捷函数）
 * 仅需数值时使用此函数，需要 breakdown 明细时使用 calculateEffectiveStrength
 */
export function getEffectiveStrengthValue(
  unit: UnitInstance,
  state: SummonerWarsCore,
  targetUnit?: UnitInstance
): number {
  return calculateEffectiveStrength(unit, state, targetUnit).finalStrength;
}

/**
 * 计算单位的战力增幅量（用于 UI 显示）
 * 返回有效战力与基础战力的差值及加成来源，排除已有蓝点指示器展示的冲锋加成
 */
export function getStrengthBoostForDisplay(
  unit: UnitInstance,
  state: SummonerWarsCore
): { delta: number; sources: string[] } {
  const sources: string[] = [];
  let totalBonus = 0;
  
  const abilities = getUnitAbilities(unit, state);
  const abilityIds = new Set(abilities.map(a => a.id));
  
  // 附加事件卡加成（如狱火铸剑 +2）
  if (unit.attachedCards) {
    for (const attached of unit.attachedCards) {
      if (getBaseCardId(attached.id) === CARD_IDS.NECRO_HELLFIRE_BLADE) {
        totalBonus += 2;
        sources.push('狱火铸剑 +2');
      }
    }
  }
  
  // 成群结队（围攻）加成
  const player = state.players[unit.owner];
  const hasSwarm = player.activeEvents.some(ev => 
    getBaseCardId(ev.id) === CARD_IDS.GOBLIN_SWARM
  );
  if (hasSwarm) {
    // 计算相邻友方单位数量（需要攻击目标才能计算，这里只能显示潜在加成）
    // 由于 UI 显示时没有攻击目标，我们显示"成群结队（攻击时生效）"
    sources.push('成群结队（攻击时生效）');
  }
  
  // 城塞精锐：2格内每有一个友方城塞单位+1战力
  if (abilityIds.has('fortress_elite')) {
    let eliteBonus = 0;
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        const other = state.board[row]?.[col]?.unit;
        if (other && other.owner === unit.owner && other.instanceId !== unit.instanceId
          && isFortressUnit(other.card)
          && manhattanDistance(unit.position, { row, col }) <= 2) {
          eliteBonus += 1;
        }
      }
    }
    if (eliteBonus > 0) {
      totalBonus += eliteBonus;
      sources.push(`城塞精锐 +${eliteBonus}`);
    }
  }
  
  // 辉光射击：每2点魔力+1战力
  if (abilityIds.has('radiant_shot')) {
    const playerMagic = state.players[unit.owner]?.magic ?? 0;
    const radiantBonus = Math.floor(playerMagic / 2);
    if (radiantBonus > 0) {
      totalBonus += radiantBonus;
      sources.push(`辉光射击 +${radiantBonus}`);
    }
  }
  
  // 冰霜飞弹：相邻每有一个友方建筑+1战力
  if (abilityIds.has('frost_bolt')) {
    let frostBonus = 0;
    const dirs = [
      { row: -1, col: 0 }, { row: 1, col: 0 },
      { row: 0, col: -1 }, { row: 0, col: 1 },
    ];
    for (const d of dirs) {
      const adjPos = { row: unit.position.row + d.row, col: unit.position.col + d.col };
      if (adjPos.row < 0 || adjPos.row >= BOARD_ROWS || adjPos.col < 0 || adjPos.col >= BOARD_COLS) continue;
      const adjCell = state.board[adjPos.row]?.[adjPos.col];
      if (adjCell?.structure && adjCell.structure.owner === unit.owner) {
        frostBonus += 1;
      } else if (adjCell?.unit && adjCell.unit.owner === unit.owner
        && getUnitAbilities(adjCell.unit, state).map(a => a.id).includes('mobile_structure')) {
        frostBonus += 1;
      }
    }
    if (frostBonus > 0) {
      totalBonus += frostBonus;
      sources.push(`冰霜飞弹 +${frostBonus}`);
    }
  }
  
  // 高阶冰霜飞弹：2格内每有一个友方建筑+1战力
  if (abilityIds.has('greater_frost_bolt')) {
    let greaterFrostBonus = 0;
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        const dist = manhattanDistance(unit.position, { row, col });
        if (dist === 0 || dist > 2) continue;
        const cell = state.board[row]?.[col];
        if (cell?.structure && cell.structure.owner === unit.owner) {
          greaterFrostBonus += 1;
        } else if (cell?.unit && cell.unit.owner === unit.owner
          && getUnitAbilities(cell.unit, state).map(a => a.id).includes('mobile_structure')) {
          greaterFrostBonus += 1;
        }
      }
    }
    if (greaterFrostBonus > 0) {
      totalBonus += greaterFrostBonus;
      sources.push(`高阶冰霜飞弹 +${greaterFrostBonus}`);
    }
  }
  
  // 圣洁审判：友方主动事件区有 paladin-holy-judgment 时，友方士兵+1战力
  if (unit.card.unitClass === 'common') {
    const hasHolyJudgment = player.activeEvents.some(ev => {
      return getBaseCardId(ev.id) === CARD_IDS.PALADIN_HOLY_JUDGMENT && (ev.charges ?? 0) > 0;
    });
    if (hasHolyJudgment) {
      totalBonus += 1;
      sources.push('圣洁审判 +1');
    }
  }
  
  // 冲锋加成已由蓝点指示器展示，不在这里显示
  // （冲锋加成在 calculateEffectiveStrength 中计算，但 UI 用蓝点显示）
  
  return { delta: totalBonus, sources };
}

/**
 * 检查单位是否有附加的狱火铸剑（诅咒效果）
 */
export function hasHellfireBlade(unit: UnitInstance): boolean {
  if (!unit.attachedCards) return false;
  return unit.attachedCards.some(c => {
    return getBaseCardId(c.id) === CARD_IDS.NECRO_HELLFIRE_BLADE;
  });
}

/**
 * 计算单位的有效生命值（考虑 life_up 等技能加成）
 * state 必传版本，用于规则判定
 */
export function getEffectiveLife(unit: UnitInstance, state: SummonerWarsCore): number {
  let life = unit.card.life;
  const abilities = getUnitAbilities(unit, state);

  for (const ability of abilities) {
    if (ability.trigger === 'passive') {
      for (const effect of ability.effects) {
        if (effect.type === 'modifyLife') {
          const value = typeof effect.value === 'number'
            ? effect.value
            : (unit.boosts ?? 0); // 充能值
          // 数据驱动上限：由 AbilityDef 的 maxBonus 字段控制
          const capped = effect.maxBonus != null ? Math.min(value, effect.maxBonus) : value;
          life += capped;
        }
      }
    }
  }

  // mobile_structure 单位视为建筑，受 auraStructureLife 光环加成（如 cold_snap）
  if (abilities.some(a => a.id === 'mobile_structure')) {
    const friendlyUnits = getPlayerUnits(state, unit.owner);
    for (const ally of friendlyUnits) {
      if (ally.instanceId === unit.instanceId) continue; // 跳过自身
      const allyAbilities = getUnitAbilities(ally, state);
      for (const ability of allyAbilities) {
        if (ability.trigger !== 'passive') continue;
        for (const effect of ability.effects) {
          if (effect.type === 'auraStructureLife') {
            const dist = manhattanDistance(ally.position, unit.position);
            if (dist <= effect.range) {
              life += effect.value;
            }
          }
        }
      }
    }
  }

  // 力量颂歌临时赋予的 power_up 不影响生命
  return life;
}

/**
 * 计算单位自身的有效生命值（不含状态依赖共享，用于测试）
 */
export function getEffectiveLifeBase(unit: UnitInstance): number {
  let life = unit.card.life;
  const abilities = getUnitBaseAbilities(unit);

  for (const ability of abilities) {
    if (ability.trigger === 'passive') {
      for (const effect of ability.effects) {
        if (effect.type === 'modifyLife') {
          const value = typeof effect.value === 'number'
            ? effect.value
            : (unit.boosts ?? 0);
          // 数据驱动上限：由 AbilityDef 的 maxBonus 字段控制
          const capped = effect.maxBonus != null ? Math.min(value, effect.maxBonus) : value;
          life += capped;
        }
      }
    }
  }

  return life;
}

/**
 * 计算建筑的有效生命值（考虑 cold_snap 等光环加成）
 * 遍历场上友方单位的被动技能，检查 auraStructureLife 效果
 */
export function getEffectiveStructureLife(state: SummonerWarsCore, structure: BoardStructure): number {
  let life = structure.card.life;
  const friendlyUnits = getPlayerUnits(state, structure.owner);

  for (const unit of friendlyUnits) {
    const abilities = getUnitAbilities(unit, state);
    for (const ability of abilities) {
      if (ability.trigger !== 'passive') continue;
      for (const effect of ability.effects) {
        if (effect.type === 'auraStructureLife') {
          const dist = manhattanDistance(unit.position, structure.position);
          if (dist <= effect.range) {
            life += effect.value;
          }
        }
      }
    }
  }

  return life;
}
