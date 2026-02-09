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
  /** 本次攻击的骰子结果（afterAttack 时可用） */
  diceResults?: import('../config/dice').DiceFace[];
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
  if (ref === 'victim') {
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
            sourceUnitId: ctx.sourceUnit.cardId,
          },
          timestamp,
        });
      }
      break;
    }

    case 'custom': {
      if (effect.actionId === 'soul_transfer_request') {
        // 灵魂转移请求：由 UI 确认后执行
        events.push({
          type: SW_EVENTS.SOUL_TRANSFER_REQUESTED,
          payload: {
            sourceUnitId: ctx.sourceUnit.cardId,
            sourcePosition: ctx.sourcePosition,
            victimPosition: ctx.victimPosition,
            ownerId: ctx.ownerId,
          },
          timestamp,
        });
      } else if (effect.actionId === 'mind_capture_check') {
        // 心灵捕获检查：由攻击流程在 execute.ts 中处理
        events.push({
          type: SW_EVENTS.MIND_CAPTURE_REQUESTED,
          payload: {
            sourceUnitId: ctx.sourceUnit.cardId,
            sourcePosition: ctx.sourcePosition,
            targetPosition: ctx.targetPosition,
            ownerId: ctx.ownerId,
          },
          timestamp,
        });
      } else if (effect.actionId === 'judgment_draw') {
        // 裁决：攻击后按 melee（❤️）数量抓牌
        const meleeCount = (ctx.diceResults ?? []).filter(r => r === 'melee').length;
        if (meleeCount > 0) {
          events.push({
            type: SW_EVENTS.CARD_DRAWN,
            payload: { playerId: ctx.ownerId, count: meleeCount, sourceAbilityId: 'judgment' },
            timestamp,
          });
        }
      } else if (effect.actionId === 'divine_shield_check') {
        // 神圣护盾：被动效果，在攻击流程中由 execute.ts 处理
        // 此处不做任何事，仅作为占位
      } else if (effect.actionId === 'healing_convert') {
        // 治疗：beforeAttack 效果，在 DECLARE_ATTACK 中处理
        // 此处不做任何事，仅作为占位
      } else {
        events.push({
          type: SW_EVENTS.ABILITY_TRIGGERED,
          payload: {
            abilityId: effect.actionId,
            params: effect.params,
            sourceUnitId: ctx.sourceUnit.cardId,
          },
          timestamp,
        });
      }
      break;
    }

    case 'pushPull': {
      const targets = resolveTargetUnits(effect.target, ctx);
      for (const target of targets) {
        // 检查目标是否有稳固（stable）技能
        const targetAbilities = target.card.abilities ?? [];
        if (targetAbilities.includes('stable')) {
          // 稳固免疫推拉，不生成事件
          continue;
        }
        const eventType = effect.direction === 'pull' ? SW_EVENTS.UNIT_PULLED : SW_EVENTS.UNIT_PUSHED;
        events.push({
          type: eventType,
          payload: {
            targetPosition: target.position,
            targetUnitId: target.cardId,
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
      events.push({
        type: SW_EVENTS.ABILITY_TRIGGERED,
        payload: {
          abilityId,
          effectType: 'extraMove',
          value: effect.value,
          canPassThrough: effect.canPassThrough,
          sourceUnitId: ctx.sourceUnit.cardId,
        },
        timestamp,
      });
      break;
    }

    case 'takeControl': {
      const targets = resolveTargetUnits(effect.target, ctx);
      for (const target of targets) {
        events.push({
          type: SW_EVENTS.CONTROL_TRANSFERRED,
          payload: {
            targetPosition: target.position,
            targetUnitId: target.cardId,
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
          sourceUnitId: ctx.sourceUnit.cardId,
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
            targetUnitId: target.cardId,
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
  state: SummonerWarsCore,
  targetUnit?: UnitInstance
): number {
  let strength = unit.card.strength;
  const abilities = getUnitAbilities(unit);

  // 附加事件卡加成（如狱火铸剑 +2）
  if (unit.attachedCards) {
    for (const attached of unit.attachedCards) {
      const baseId = attached.id.replace(/-\d+-\d+$/, '').replace(/-\d+$/, '');
      if (baseId === 'necro-hellfire-blade') {
        strength += 2;
      }
    }
  }

  // 催眠引诱加成：召唤师攻击被催眠的目标时+1战力
  if (targetUnit && unit.card.unitClass === 'summoner') {
    const player = state.players[unit.owner];
    for (const ev of player.activeEvents) {
      const baseId = ev.id.replace(/-\d+-\d+$/, '').replace(/-\d+$/, '');
      if (baseId === 'trickster-hypnotic-lure' && ev.targetUnitId === targetUnit.cardId) {
        strength += 1;
      }
    }
  }

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
          if (ability.id === 'power_boost' || ability.id === 'power_up') {
            strength += Math.min(value, 5);
          } else {
            strength += value;
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
      const baseId = ev.id.replace(/-\d+-\d+$/, '').replace(/-\d+$/, '');
      return baseId === 'goblin-swarm';
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
        if (adjUnit && adjUnit.owner === unit.owner && adjUnit.cardId !== unit.cardId) {
          adjacentAllies++;
        }
      }
      strength += adjacentAllies;
    }
  }

  // 冲锋加成：野兽骑手冲锋3+格时+1战力（通过 boosts 标记）
  if ((unit.card.abilities ?? []).includes('charge') && unit.boosts > 0) {
    strength += unit.boosts;
  }

  // 城塞精锐：2格内每有一个友方城塞单位+1战力
  if ((unit.card.abilities ?? []).includes('fortress_elite')) {
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        const other = state.board[row]?.[col]?.unit;
        if (other && other.owner === unit.owner && other.cardId !== unit.cardId
          && other.card.id.includes('fortress')
          && manhattanDistance(unit.position, { row, col }) <= 2) {
          strength += 1;
        }
      }
    }
  }

  // 辉光射击：每2点魔力+1战力
  if ((unit.card.abilities ?? []).includes('radiant_shot')) {
    const playerMagic = state.players[unit.owner]?.magic ?? 0;
    strength += Math.floor(playerMagic / 2);
  }

  // 冰霜飞弹：相邻每有一个友方建筑+1战力
  if ((unit.card.abilities ?? []).includes('frost_bolt')) {
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
        strength += 1;
      } else if (adjCell?.unit && adjCell.unit.owner === unit.owner
        && (adjCell.unit.card.abilities ?? []).includes('mobile_structure')) {
        strength += 1;
      }
    }
  }

  // 高阶冰霜飞弹：2格内每有一个友方建筑+1战力
  if ((unit.card.abilities ?? []).includes('greater_frost_bolt')) {
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        const dist = manhattanDistance(unit.position, { row, col });
        if (dist === 0 || dist > 2) continue;
        const cell = state.board[row]?.[col];
        if (cell?.structure && cell.structure.owner === unit.owner) {
          strength += 1;
        } else if (cell?.unit && cell.unit.owner === unit.owner
          && (cell.unit.card.abilities ?? []).includes('mobile_structure')) {
          strength += 1;
        }
      }
    }
  }

  // 圣洁审判：友方主动事件区有 paladin-holy-judgment 时，友方士兵+1战力
  if (unit.card.unitClass === 'common') {
    const player = state.players[unit.owner];
    const hasHolyJudgment = player.activeEvents.some(ev => {
      const baseId = ev.id.replace(/-\d+-\d+$/, '').replace(/-\d+$/, '');
      return baseId === 'paladin-holy-judgment' && (ev.charges ?? 0) > 0;
    });
    if (hasHolyJudgment) {
      strength += 1;
    }
  }

  return Math.max(0, strength);
}

/**
 * 检查单位是否有附加的狱火铸剑（诅咒效果）
 */
export function hasHellfireBlade(unit: UnitInstance): boolean {
  if (!unit.attachedCards) return false;
  return unit.attachedCards.some(c => {
    const baseId = c.id.replace(/-\d+-\d+$/, '').replace(/-\d+$/, '');
    return baseId === 'necro-hellfire-blade';
  });
}

/**
 * 计算单位的有效生命值（考虑 life_up 等技能加成）
 */
export function getEffectiveLife(unit: UnitInstance): number {
  let life = unit.card.life;
  const abilities = getUnitAbilities(unit);

  for (const ability of abilities) {
    if (ability.trigger === 'passive') {
      for (const effect of ability.effects) {
        if (effect.type === 'modifyLife') {
          const value = typeof effect.value === 'number'
            ? effect.value
            : (unit.boosts ?? 0); // 充能值
          // 生命强化最多+5
          life += Math.min(value, 5);
        }
      }
    }
  }

  // 力量颂歌临时赋予的 power_up 不影响生命
  return life;
}
