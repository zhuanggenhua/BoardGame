/**
 * 召唤师战争 - 技能系统测试
 * 
 * 测试亡灵法师阵营的技能效果
 */

import { describe, it, expect } from 'vitest';
import { SummonerWarsDomain, SW_EVENTS } from '../domain';
import type { SummonerWarsCore, CellCoord, BoardUnit } from '../domain/types';
import type { RandomFn } from '../../../engine/types';
import { 
  getEffectiveStrengthValue, 
  evaluateCondition,
  getUnitBaseAbilities,
  resolveEffect,
  triggerAllUnitsAbilities,
} from '../domain/abilityResolver';
import type { AbilityContext } from '../domain/abilityResolver';
import { abilityRegistry } from '../domain/abilities';
import { BOARD_ROWS, BOARD_COLS } from '../domain/helpers';
import { createInitializedCore } from './test-helpers';

// ============================================================================
// 辅助函数
// ============================================================================

/** 创建测试用的随机数生成器 */
function createTestRandom(): RandomFn {
  return {
    shuffle: <T>(arr: T[]) => arr,
    random: () => 0.5,
    d: (max: number) => Math.ceil(max / 2),
    range: (min: number, max: number) => Math.floor((min + max) / 2),
  };
}

const fixedTimestamp = 1000;

/** 创建测试用的游戏状态 */
function createTestState(): SummonerWarsCore {
  return createInitializedCore(['0', '1'], createTestRandom());
}

/** 查找单位位置 */
function findUnitPosition(state: SummonerWarsCore, predicate: (unit: BoardUnit) => boolean): CellCoord | null {
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const unit = state.board[row]?.[col]?.unit;
      if (unit && predicate(unit)) {
        return { row, col };
      }
    }
  }
  return null;
}

/** 获取指定位置的单位 */
function getUnitAt(state: SummonerWarsCore, pos: CellCoord): BoardUnit | undefined {
  return state.board[pos.row]?.[pos.col]?.unit;
}

// ============================================================================
// 技能注册表测试
// ============================================================================

describe('技能注册表', () => {
  it('应该注册所有亡灵法师技能', () => {
    const abilities = abilityRegistry.getAll();
    expect(abilities.length).toBeGreaterThan(0);
    
    // 检查关键技能是否存在
    expect(abilityRegistry.get('revive_undead')).toBeDefined();
    expect(abilityRegistry.get('fire_sacrifice_summon')).toBeDefined();
    expect(abilityRegistry.get('life_drain')).toBeDefined();
    expect(abilityRegistry.get('rage')).toBeDefined();
    expect(abilityRegistry.get('blood_rage')).toBeDefined();
    expect(abilityRegistry.get('power_boost')).toBeDefined();
    expect(abilityRegistry.get('sacrifice')).toBeDefined();
    expect(abilityRegistry.get('soulless')).toBeDefined();
    expect(abilityRegistry.get('infection')).toBeDefined();
    expect(abilityRegistry.get('soul_transfer')).toBeDefined();
  });

  it('应该能按触发时机过滤技能', () => {
    const onKillAbilities = abilityRegistry.getByTrigger('onKill');
    expect(onKillAbilities.some(a => a.id === 'soulless')).toBe(true);
    expect(onKillAbilities.some(a => a.id === 'infection')).toBe(true);
    
    const onDeathAbilities = abilityRegistry.getByTrigger('onDeath');
    expect(onDeathAbilities.some(a => a.id === 'sacrifice')).toBe(true);
  });
});

// ============================================================================
// 古尔-达斯 - 暴怒测试
// ============================================================================

describe('古尔-达斯 - 暴怒', () => {
  it('无伤害时战力不变', () => {
    const state = createTestState();
    
    // 找到玩家0的召唤师（基础战力2）
    const summonerPos = findUnitPosition(state, u => u.owner === '0' && u.card.unitClass === 'summoner');
    expect(summonerPos).not.toBeNull();
    
    const summoner = getUnitAt(state, summonerPos!);
    expect(summoner).toBeDefined();
    expect(summoner!.damage).toBe(0);
    
    // 召唤师没有暴怒技能，战力应该不变
    const effectiveStrength = getEffectiveStrengthValue(summoner!, state);
    expect(effectiveStrength).toBe(summoner!.card.strength);
  });

  it('有伤害时战力增加（模拟古尔-达斯）', () => {
    const state = createTestState();
    
    // 创建一个带有暴怒技能的单位
    const testUnit: BoardUnit = {
      cardId: 'test-gul-das',
      card: {
        id: 'test-gul-das',
        cardType: 'unit',
        name: '古尔-达斯',
        unitClass: 'champion',
        faction: 'necromancer',
        strength: 2,
        life: 8,
        cost: 6,
        attackType: 'melee',
        attackRange: 1,
        abilities: ['rage'],
        deckSymbols: [],
      },
      owner: '0',
      position: { row: 4, col: 3 },
      damage: 3, // 3点伤害
      boosts: 0,
      hasMoved: false,
      hasAttacked: false,
    };
    
    // 放置到棋盘
    state.board[4][3].unit = testUnit;
    
    // 计算有效战力：基础2 + 伤害3 = 5
    const effectiveStrength = getEffectiveStrengthValue(testUnit, state);
    expect(effectiveStrength).toBe(5);
  });
});

// ============================================================================
// 亡灵战士 - 血腥狂怒 + 力量强化测试
// ============================================================================

describe('亡灵战士 - 血腥狂怒 + 力量强化', () => {
  it('无充能时战力不变', () => {
    const state = createTestState();
    
    // 创建亡灵战士
    const warrior: BoardUnit = {
      cardId: 'test-warrior',
      card: {
        id: 'test-warrior',
        cardType: 'unit',
        name: '亡灵战士',
        unitClass: 'common',
        faction: 'necromancer',
        strength: 2,
        life: 4,
        cost: 2,
        attackType: 'melee',
        attackRange: 1,
        abilities: ['blood_rage', 'power_boost'],
        deckSymbols: [],
      },
      owner: '0',
      position: { row: 4, col: 3 },
      damage: 0,
      boosts: 0,
      hasMoved: false,
      hasAttacked: false,
    };
    
    state.board[4][3].unit = warrior;
    
    const effectiveStrength = getEffectiveStrengthValue(warrior, state);
    expect(effectiveStrength).toBe(2); // 基础战力
  });

  it('有充能时战力增加（最多+5）', () => {
    const state = createTestState();
    
    // 创建亡灵战士
    const warrior: BoardUnit = {
      cardId: 'test-warrior',
      card: {
        id: 'test-warrior',
        cardType: 'unit',
        name: '亡灵战士',
        unitClass: 'common',
        faction: 'necromancer',
        strength: 2,
        life: 4,
        cost: 2,
        attackType: 'melee',
        attackRange: 1,
        abilities: ['blood_rage', 'power_boost'],
        deckSymbols: [],
      },
      owner: '0',
      position: { row: 4, col: 3 },
      damage: 0,
      boosts: 3, // 3点充能
      hasMoved: false,
      hasAttacked: false,
    };
    
    state.board[4][3].unit = warrior;
    
    // 战力 = 基础2 + 充能3 = 5
    const effectiveStrength = getEffectiveStrengthValue(warrior, state);
    expect(effectiveStrength).toBe(5);
  });

  it('充能超过5时战力最多+5', () => {
    const state = createTestState();
    
    const warrior: BoardUnit = {
      cardId: 'test-warrior',
      card: {
        id: 'test-warrior',
        cardType: 'unit',
        name: '亡灵战士',
        unitClass: 'common',
        faction: 'necromancer',
        strength: 2,
        life: 4,
        cost: 2,
        attackType: 'melee',
        attackRange: 1,
        abilities: ['blood_rage', 'power_boost'],
        deckSymbols: [],
      },
      owner: '0',
      position: { row: 4, col: 3 },
      damage: 0,
      boosts: 8, // 8点充能
      hasMoved: false,
      hasAttacked: false,
    };
    
    state.board[4][3].unit = warrior;
    
    // 战力 = 基础2 + min(充能8, 5) = 7
    const effectiveStrength = getEffectiveStrengthValue(warrior, state);
    expect(effectiveStrength).toBe(7);
  });
});

// ============================================================================
// 条件评估测试
// ============================================================================

describe('条件评估', () => {
  it('always 条件始终为真', () => {
    const state = createTestState();
    const summonerPos = findUnitPosition(state, u => u.owner === '0' && u.card.unitClass === 'summoner')!;
    const summoner = getUnitAt(state, summonerPos)!;
    
    const ctx: AbilityContext = {
      state,
      sourceUnit: summoner,
      sourcePosition: summonerPos,
      ownerId: '0',
      timestamp: fixedTimestamp,
    };
    
    expect(evaluateCondition({ type: 'always' }, ctx)).toBe(true);
  });

  it('hasCharge 条件检查充能', () => {
    const state = createTestState();
    const summonerPos = findUnitPosition(state, u => u.owner === '0' && u.card.unitClass === 'summoner')!;
    const summoner = getUnitAt(state, summonerPos)!;
    
    const ctx: AbilityContext = {
      state,
      sourceUnit: summoner,
      sourcePosition: summonerPos,
      ownerId: '0',
      timestamp: fixedTimestamp,
    };
    
    // 无充能
    expect(evaluateCondition({ type: 'hasCharge', target: 'self', minStacks: 1 }, ctx)).toBe(false);
    
    // 添加充能
    summoner.boosts = 2;
    expect(evaluateCondition({ type: 'hasCharge', target: 'self', minStacks: 1 }, ctx)).toBe(true);
    expect(evaluateCondition({ type: 'hasCharge', target: 'self', minStacks: 3 }, ctx)).toBe(false);
  });
});

// ============================================================================
// 单位技能获取测试
// ============================================================================

describe('单位技能获取', () => {
  it('应该正确获取单位的技能定义', () => {
    // 创建带技能的单位（不需要完整游戏状态）
    const warrior: BoardUnit = {
      cardId: 'test-warrior',
      card: {
        id: 'test-warrior',
        cardType: 'unit',
        name: '亡灵战士',
        unitClass: 'common',
        faction: 'necromancer',
        strength: 2,
        life: 4,
        cost: 2,
        attackType: 'melee',
        attackRange: 1,
        abilities: ['blood_rage', 'power_boost'],
        deckSymbols: [],
      },
      owner: '0',
      position: { row: 4, col: 3 },
      damage: 0,
      boosts: 0,
      hasMoved: false,
      hasAttacked: false,
    };
    
    const abilities = getUnitBaseAbilities(warrior);
    expect(abilities.length).toBe(2);
    expect(abilities.some(a => a.id === 'blood_rage')).toBe(true);
    expect(abilities.some(a => a.id === 'power_boost')).toBe(true);
  });

  it('无技能单位返回空数组', () => {
    const unit: BoardUnit = {
      cardId: 'test-unit',
      card: {
        id: 'test-unit',
        cardType: 'unit',
        name: '测试单位',
        unitClass: 'common',
        faction: 'goblin',
        strength: 1,
        life: 1,
        cost: 0,
        attackType: 'melee',
        attackRange: 1,
        deckSymbols: [],
      },
      owner: '0',
      position: { row: 0, col: 0 },
      damage: 0,
      boosts: 0,
      hasMoved: false,
      hasAttacked: false,
    };
    
    const abilities = getUnitBaseAbilities(unit);
    expect(abilities.length).toBe(0);
  });
});

// ============================================================================
// 技能触发测试
// ============================================================================

describe('技能触发', () => {
  it('地狱火教徒 - 献祭：被消灭时对相邻敌方造成伤害', () => {
    const state = createTestState();
    
    // 创建地狱火教徒
    const cultist: BoardUnit = {
      cardId: 'test-cultist',
      card: {
        id: 'test-cultist',
        cardType: 'unit',
        name: '地狱火教徒',
        unitClass: 'common',
        faction: 'necromancer',
        strength: 1,
        life: 1,
        cost: 0,
        attackType: 'melee',
        attackRange: 1,
        abilities: ['sacrifice'],
        deckSymbols: [],
      },
      owner: '0',
      position: { row: 4, col: 3 },
      damage: 0,
      boosts: 0,
      hasMoved: false,
      hasAttacked: false,
    };
    
    // 放置地狱火教徒
    state.board[4][3].unit = cultist;
    
    // 创建相邻的敌方单位
    const enemy: BoardUnit = {
      cardId: 'test-enemy',
      card: {
        id: 'test-enemy',
        cardType: 'unit',
        name: '敌方单位',
        unitClass: 'common',
        faction: 'goblin',
        strength: 1,
        life: 3,
        cost: 0,
        attackType: 'melee',
        attackRange: 1,
        deckSymbols: [],
      },
      owner: '1',
      position: { row: 4, col: 4 },
      damage: 0,
      boosts: 0,
      hasMoved: false,
      hasAttacked: false,
    };
    state.board[4][4].unit = enemy;
    
    // 获取献祭技能
    const sacrificeAbility = abilityRegistry.get('sacrifice');
    expect(sacrificeAbility).toBeDefined();
    expect(sacrificeAbility!.trigger).toBe('onDeath');
    expect(sacrificeAbility!.effects.length).toBe(1);
    expect(sacrificeAbility!.effects[0].type).toBe('damage');
  });

  it('亡灵疫病体 - 无魂：消灭敌方时不获得魔力', () => {
    const soullessAbility = abilityRegistry.get('soulless');
    expect(soullessAbility).toBeDefined();
    expect(soullessAbility!.trigger).toBe('onKill');
    expect(soullessAbility!.effects.some(e => e.type === 'preventMagicGain')).toBe(true);
  });

  it('亡灵弓箭手 - 灵魂转移：3格内单位被消灭时可替换位置', () => {
    const soulTransferAbility = abilityRegistry.get('soul_transfer');
    expect(soulTransferAbility).toBeDefined();
    expect(soulTransferAbility!.trigger).toBe('onKill');
    expect(soulTransferAbility!.condition).toBeDefined();
    expect(soulTransferAbility!.condition!.type).toBe('isInRange');
  });
});

// ============================================================================
// 效果解析测试
// ============================================================================

describe('效果解析', () => {
  it('伤害效果应该生成正确的事件', () => {
    const state = createTestState();
    const summonerPos = findUnitPosition(state, u => u.owner === '0' && u.card.unitClass === 'summoner')!;
    const summoner = getUnitAt(state, summonerPos)!;
    
    const ctx: AbilityContext = {
      state,
      sourceUnit: summoner,
      sourcePosition: summonerPos,
      ownerId: '0',
      timestamp: fixedTimestamp,
    };
    
    const damageEffect = { type: 'damage' as const, target: 'self' as const, value: 2 };
    const events = resolveEffect(damageEffect, ctx, 'test-ability');
    
    expect(events.length).toBe(1);
    expect(events[0].type).toBe('sw:unit_damaged');
    const damagePayload = events[0].payload as { damage: number };
    expect(damagePayload.damage).toBe(2);
  });

  it('充能效果应该生成正确的事件', () => {
    const state = createTestState();
    const summonerPos = findUnitPosition(state, u => u.owner === '0' && u.card.unitClass === 'summoner')!;
    const summoner = getUnitAt(state, summonerPos)!;
    
    const ctx: AbilityContext = {
      state,
      sourceUnit: summoner,
      sourcePosition: summonerPos,
      ownerId: '0',
      timestamp: fixedTimestamp,
    };
    
    const chargeEffect = { type: 'addCharge' as const, target: 'self' as const, value: 3 };
    const events = resolveEffect(chargeEffect, ctx, 'test-ability');
    
    expect(events.length).toBe(1);
    expect(events[0].type).toBe('sw:unit_charged');
    const chargePayload = events[0].payload as { delta: number };
    expect(chargePayload.delta).toBe(3);
  });

  it('感染：召唤弃牌事件应携带 sourceUnitId 且使用 victim 位置', () => {
    const state = createTestState();
    const summonerPos = findUnitPosition(state, u => u.owner === '0' && u.card.unitClass === 'summoner')!;
    const summoner = getUnitAt(state, summonerPos)!;
    const victimPos: CellCoord = { row: 3, col: 3 };

    const ctx: AbilityContext = {
      state,
      sourceUnit: summoner,
      sourcePosition: summonerPos,
      ownerId: '0',
      victimPosition: victimPos,
      timestamp: fixedTimestamp,
    };

    const effect = { type: 'summonFromDiscard' as const, cardType: 'plagueZombie' as const, position: 'victim' as const };
    const events = resolveEffect(effect, ctx, 'infection');

    expect(events.length).toBe(1);
    expect(events[0].type).toBe(SW_EVENTS.SUMMON_FROM_DISCARD_REQUESTED);
    const summonPayload = events[0].payload as { position: CellCoord; sourceUnitId?: string };
    expect(summonPayload.position).toEqual(victimPos);
    expect(summonPayload.sourceUnitId).toBe(summoner.instanceId);
  });
});

// ============================================================================
// 组合技能测试
// ============================================================================

describe('组合技能', () => {
  it('暴怒 + 力量强化组合：伤害和充能都增加战力', () => {
    const state = createTestState();
    
    // 创建同时拥有暴怒和力量强化的单位
    const hybridUnit: BoardUnit = {
      cardId: 'test-hybrid',
      card: {
        id: 'test-hybrid',
        cardType: 'unit',
        name: '混合测试单位',
        unitClass: 'champion',
        faction: 'necromancer',
        strength: 2,
        life: 8,
        cost: 6,
        attackType: 'melee',
        attackRange: 1,
        abilities: ['rage', 'power_boost'],
        deckSymbols: [],
      },
      owner: '0',
      position: { row: 4, col: 3 },
      damage: 3,  // 3点伤害 → 暴怒+3
      boosts: 2,  // 2点充能 → 力量强化+2
      hasMoved: false,
      hasAttacked: false,
    };
    
    state.board[4][3].unit = hybridUnit;
    
    // 计算有效战力：基础2 + 暴怒3 + 力量强化2 = 7
    const effectiveStrength = getEffectiveStrengthValue(hybridUnit, state);
    expect(effectiveStrength).toBe(7);
  });

  it('力量强化上限测试：充能超过5时仍然只+5', () => {
    const state = createTestState();
    
    const warrior: BoardUnit = {
      cardId: 'test-warrior',
      card: {
        id: 'test-warrior',
        cardType: 'unit',
        name: '亡灵战士',
        unitClass: 'common',
        faction: 'necromancer',
        strength: 2,
        life: 4,
        cost: 2,
        attackType: 'melee',
        attackRange: 1,
        abilities: ['power_boost'],
        deckSymbols: [],
      },
      owner: '0',
      position: { row: 4, col: 3 },
      damage: 0,
      boosts: 10, // 10点充能，但最多+5
      hasMoved: false,
      hasAttacked: false,
    };
    
    state.board[4][3].unit = warrior;
    
    // 战力 = 基础2 + min(10, 5) = 7
    const effectiveStrength = getEffectiveStrengthValue(warrior, state);
    expect(effectiveStrength).toBe(7);
  });
});

// ============================================================================
// 回合结束技能触发测试
// ============================================================================

describe('回合结束技能触发', () => {
  it('血腥狂怒衰减：回合结束时移除2点充能', () => {
    const state = createTestState();
    
    // 创建有充能的亡灵战士
    const warrior: BoardUnit = {
      cardId: 'test-warrior',
      card: {
        id: 'test-warrior',
        cardType: 'unit',
        name: '亡灵战士',
        unitClass: 'common',
        faction: 'necromancer',
        strength: 2,
        life: 4,
        cost: 2,
        attackType: 'melee',
        attackRange: 1,
        abilities: ['blood_rage', 'power_boost', 'blood_rage_decay'],
        deckSymbols: [],
      },
      owner: '0',
      position: { row: 4, col: 3 },
      damage: 0,
      boosts: 5, // 5点充能
      hasMoved: false,
      hasAttacked: false,
    };
    
    state.board[4][3].unit = warrior;
    
    // 触发回合结束技能
    const events = triggerAllUnitsAbilities('onTurnEnd', state, '0');
    
    // 应该生成充能减少事件
    const chargeEvents = events.filter((e) => e.type === 'sw:unit_charged');
    expect(chargeEvents.length).toBeGreaterThan(0);
    
    // 检查充能减少值
    const chargeEvent = chargeEvents.find((e) => (e.payload as { delta: number }).delta === -2);
    expect(chargeEvent).toBeDefined();
  });

  it('血腥狂怒衰减：无充能时不触发', () => {
    const state = createTestState();
    
    // 创建无充能的亡灵战士
    const warrior: BoardUnit = {
      cardId: 'test-warrior',
      card: {
        id: 'test-warrior',
        cardType: 'unit',
        name: '亡灵战士',
        unitClass: 'common',
        faction: 'necromancer',
        strength: 2,
        life: 4,
        cost: 2,
        attackType: 'melee',
        attackRange: 1,
        abilities: ['blood_rage', 'power_boost', 'blood_rage_decay'],
        deckSymbols: [],
      },
      owner: '0',
      position: { row: 4, col: 3 },
      damage: 0,
      boosts: 0, // 无充能
      hasMoved: false,
      hasAttacked: false,
    };
    
    state.board[4][3].unit = warrior;
    
    // 触发回合结束技能
    const events = triggerAllUnitsAbilities('onTurnEnd', state, '0');
    
    // 不应该生成充能减少事件（条件不满足）
    const chargeEvents = events.filter((e) => e.type === 'sw:unit_charged');
    expect(chargeEvents.length).toBe(0);
  });
});
