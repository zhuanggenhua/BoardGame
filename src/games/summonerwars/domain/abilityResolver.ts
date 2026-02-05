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
import { BOARD_ROWS, BOARD_COLS, getUnitAt, manhattanDistance } from './helpers';

// ============================================================================
// 效果解析上下文
// ============================================================================

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
  /** 时间戳 */
  timestamp: number;
}

// ============================================================================
// 目标解析
// ============================================================================

/**
 * 解析目标引用，返回单位列表
 */
export function resolveTargetUnits(
  ref: TargetRef,
  ctx: AbilityContext
): UnitInstance[] {
  const { state, sourceUnit, targetUnit, victimUnit, killerUnit, ownerId } = ctx;

  if (ref === 'self') {
    return [sourceUnit];
  }
  if (ref === 'attacker') {
    return sourceUnit ? [sourceUnit] : [];
  }
  if (ref === 'target') {
    return targetUnit ? [targetUnit] : [];
  }
  if (ref === 'victim') {
    return victimUnit ? [victimUnit] : [];
  }
  if (ref === 'killer') {
    return killerUnit ? [killerUnit] : [];
  }
  if (ref === 'adjacentEnemies') {
    return getAdjacentUnits(state, ctx.sourcePosition, ownerId, 'enemy');
  }
  if (ref === 'adjacentAllies') {
    return getAdjacentUnits(state, ctx.sourcePosition, ownerId, 'ally');
  }
  if (ref === 'allAllies') {
    return getAllUnits(state, ownerId, 'ally');
  }
  if (ref === 'allEnemies') {
    return getAllUnits(state, ownerId, 'enemy');
  }
  if (typeof ref === 'object' && 'position' in ref) {
    const unit = getUnitAt(state, ref.position);
    return unit ? [unit] : [];
  }
  if (typeof ref === 'object' && 'unitId' in ref) {
    // 从选择的目标中查找
    if (ref.unitId === 'selectedAlly' && ctx.selectedTargets?.units) {
      return ctx.selectedTargets.units;
    }
    // 按 ID 查找
    const unit = findUnitById(state, ref.unitId);
    return unit ? [unit] : [];
  }

  return [];
}

/**
 * 解析目标位置
 */
export function resolveTargetPosition(
  ref: TargetRef | 'victimPosition' | CellCoord,
  ctx: AbilityContext
): CellCoord | undefined {
  if (ref === 'victimPosition') {
    return ctx.victimPosition;
  }
  if (ref === 'self') {
    return ctx.sourcePosition;
  }
  if (ref === 'target') {
    return ctx.targetPosition;
  }
  // 直接传入的 CellCoord（有 row 和 col 但没有 position 属性）
  if (typeof ref === 'object' && 'row' in ref && 'col' in ref && !('position' in ref) && !('unitId' in ref)) {
    return ref as CellCoord;
  }
  if (typeof ref === 'object' && 'position' in ref) {
    return (ref as { position: CellCoord }).position;
  }
  return undefined;
}

/**
 * 获取相邻单位
 */
function getAdjacentUnits(
  state: SummonerWarsCore,
  position: CellCoord,
  ownerId: PlayerId,
  filter: 'ally' | 'enemy' | 'all'
): UnitInstance[] {
  const units: UnitInstance[] = [];
  const directions = [
    { row: -1, col: 0 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
  ];

  for (const dir of directions) {
    const newRow = position.row + dir.row;
    const newCol = position.col + dir.col;
    if (newRow >= 0 && newRow < BOARD_ROWS && newCol >= 0 && newCol < BOARD_COLS) {
      const unit = state.board[newRow]?.[newCol]?.unit;
      if (unit) {
        if (filter === 'all') {
          units.push(unit);
        } else if (filter === 'ally' && unit.owner === ownerId) {
          units.push(unit);
        } else if (filter === 'enemy' && unit.owner !== ownerId) {
          units.push(unit);
        }
      }
    }
  }

  return units;
}

/**
 * 获取所有单位
 */
function getAllUnits(
  state: SummonerWarsCore,
  ownerId: PlayerId,
  filter: 'ally' | 'enemy' | 'all'
): UnitInstance[] {
  const units: UnitInstance[] = [];

  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const unit = state.board[row]?.[col]?.unit;
      if (unit) {
        if (filter === 'all') {
          units.push(unit);
        } else if (filter === 'ally' && unit.owner === ownerId) {
          units.push(unit);
        } else if (filter === 'enemy' && unit.owner !== ownerId) {
          units.push(unit);
        }
      }
    }
  }

  return units;
}

/**
 * 按 ID 查找单位
 */
function findUnitById(state: SummonerWarsCore, unitId: string): UnitInstance | undefined {
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const unit = state.board[row]?.[col]?.unit;
      if (unit && unit.cardId === unitId) {
        return unit;
      }
    }
  }
  return undefined;
}

// ============================================================================
// 表达式计算
// ============================================================================

/**
 * 计算表达式值
 */
export function evaluateExpression(expr: Expression, ctx: AbilityContext): number {
  if (typeof expr === 'number') {
    return expr;
  }

  switch (expr.type) {
    case 'attribute': {
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
    case 'multiply':
      return evaluateExpression(expr.left, ctx) * evaluateExpression(expr.right, ctx);
    case 'add':
      return evaluateExpression(expr.left, ctx) + evaluateExpression(expr.right, ctx);
    default:
      return 0;
  }
}

// ============================================================================
// 条件评估
// ============================================================================

/**
 * 评估条件
 */
export function evaluateCondition(
  condition: AbilityCondition,
  ctx: AbilityContext
): boolean {
  switch (condition.type) {
    case 'always':
      return true;

    case 'hasCharge': {
      const units = resolveTargetUnits(condition.target, ctx);
      const minStacks = condition.minStacks ?? 1;
      return units.some(u => (u.boosts ?? 0) >= minStacks);
    }

    case 'isUnitType': {
      const units = resolveTargetUnits(condition.target, ctx);
      return units.some(u => {
        if (condition.unitType === 'undead') {
          // 检查是否是亡灵单位（通过卡牌 ID 或名称判断）
          return u.card.id.includes('undead') || 
                 u.card.name.includes('亡灵') ||
                 u.card.faction === '堕落王国';
        }
        return u.card.unitClass === condition.unitType;
      });
    }

    case 'isInRange': {
      const units = resolveTargetUnits(condition.target, ctx);
      return units.some(u => {
        const dist = manhattanDistance(ctx.sourcePosition, u.position);
        return dist <= condition.range;
      });
    }

    case 'isOwner': {
      const units = resolveTargetUnits(condition.target, ctx);
      const expectedOwner = condition.owner === 'self' ? ctx.ownerId : getOpponentId(ctx.ownerId);
      return units.some(u => u.owner === expectedOwner);
    }

    case 'hasCardInDiscard': {
      const player = ctx.state.players[ctx.ownerId];
      return player.discard.some(card => {
        if (condition.cardType === 'undead') {
          return card.cardType === 'unit' && 
                 (card.id.includes('undead') || card.name?.includes('亡灵'));
        }
        if (condition.cardType === 'plagueZombie') {
          return card.id.includes('plague-zombie') || card.name?.includes('疫病体');
        }
        return card.cardType === condition.cardType;
      });
    }

    case 'and':
      return condition.conditions.every(c => evaluateCondition(c, ctx));

    case 'or':
      return condition.conditions.some(c => evaluateCondition(c, ctx));

    case 'not':
      return !evaluateCondition(condition.condition, ctx);

    default:
      return false;
  }
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
            cardName: target.card.name,
            owner: target.owner,
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
            unitId: target.cardId,
            sourceAbilityId: abilityId,
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
      events.push({
        type: SW_EVENTS.ABILITY_TRIGGERED,
        payload: {
          abilityId: 'soulless',
          effectType: 'preventMagicGain',
          sourceUnitId: ctx.sourceUnit.cardId,
        },
        timestamp,
      });
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
          },
          timestamp,
        });
      }
      break;
    }

    case 'custom': {
      events.push({
        type: SW_EVENTS.ABILITY_TRIGGERED,
        payload: {
          abilityId: effect.actionId,
          params: effect.params,
          sourceUnitId: ctx.sourceUnit.cardId,
        },
        timestamp,
      });
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
  
  // 先触发技能激活事件
  events.push({
    type: SW_EVENTS.ABILITY_TRIGGERED,
    payload: {
      abilityId: ability.id,
      abilityName: ability.name,
      sourceUnitId: ctx.sourceUnit.cardId,
      sourcePosition: ctx.sourcePosition,
    },
    timestamp: ctx.timestamp,
  });

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
 * 获取单位的所有技能
 */
export function getUnitAbilities(unit: UnitInstance): AbilityDef[] {
  const abilityIds = unit.card.abilities ?? [];
  return abilityIds
    .map(id => abilityRegistry.get(id))
    .filter((def): def is AbilityDef => def !== undefined);
}

/**
 * 触发指定时机的技能
 */
export function triggerAbilities(
  trigger: AbilityTrigger,
  ctx: AbilityContext
): GameEvent[] {
  const abilities = getUnitAbilities(ctx.sourceUnit);
  const matchingAbilities = abilities.filter(a => a.trigger === trigger);
  
  const events: GameEvent[] = [];
  for (const ability of matchingAbilities) {
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
  const timestamp = Date.now();

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
 * 计算单位的有效战力（考虑技能加成）
 */
export function calculateEffectiveStrength(
  unit: UnitInstance,
  state: SummonerWarsCore
): number {
  let strength = unit.card.strength;
  const abilities = getUnitAbilities(unit);

  for (const ability of abilities) {
    if (ability.trigger === 'onDamageCalculation' || ability.trigger === 'passive') {
      const ctx: AbilityContext = {
        state,
        sourceUnit: unit,
        sourcePosition: unit.position,
        ownerId: unit.owner,
        timestamp: Date.now(),
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
          
          // 力量强化最多+5
          if (ability.id === 'power_boost') {
            strength += Math.min(value, 5);
          } else {
            strength += value;
          }
        }
      }
    }
  }

  return Math.max(0, strength);
}
