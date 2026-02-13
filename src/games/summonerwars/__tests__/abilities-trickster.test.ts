/**
 * 召唤师战争 - 欺心巫族技能测试
 *
 * 覆盖：
 * - evasion（迷魂）：相邻敌方攻击掷出✦时减伤1
 * - rebound（缠斗）：相邻敌方移动远离时造成1伤害
 * - flying（飞行）：额外移动1格 + 穿越
 * - swift（迅捷）：额外移动1格
 * - aerial_strike（浮空术）：光环给附近士兵飞行
 * - ranged（远射）：攻击范围4格
 * - stable（稳固）：免疫推拉
 * - mind_capture（心灵捕获）：致命攻击时可控制目标
 * - validate 增强版移动/攻击
 */

import { describe, it, expect, vi } from 'vitest';
import { SummonerWarsDomain, SW_COMMANDS, SW_EVENTS } from '../domain';
import type { SummonerWarsCore, CellCoord, BoardUnit, UnitCard, PlayerId } from '../domain/types';
import type { RandomFn, GameEvent } from '../../../engine/types';
import {
  canMoveToEnhanced, canAttackEnhanced,
  hasStableAbilityBase, getEvasionUnits, getEntangleUnits,
  getEffectiveAttackRangeBase, getStormAssaultReduction,
} from '../domain/helpers';
import { calculateEffectiveStrength } from '../domain/abilityResolver';
import { createInitializedCore } from './test-helpers';

// ============================================================================
// 辅助函数
// ============================================================================

function createTestRandom(): RandomFn {
  return {
    shuffle: <T>(arr: T[]) => arr,
    random: () => 0.5,
    d: (max: number) => Math.ceil(max / 2),
    range: (min: number, max: number) => Math.floor((min + max) / 2),
  };
}

const fixedTimestamp = 1000;

/** 创建欺心巫族 vs 亡灵法师的测试状态 */
function createTricksterState(): SummonerWarsCore {
  return createInitializedCore(['0', '1'], createTestRandom(), {
    faction0: 'trickster',
    faction1: 'necromancer',
  });
}


/** 在指定位置放置测试单位 */
function placeUnit(
  state: SummonerWarsCore,
  pos: CellCoord,
  overrides: Partial<BoardUnit> & { card: UnitCard; owner: PlayerId }
): BoardUnit {
  const unit: BoardUnit = {
    cardId: overrides.cardId ?? `test-${pos.row}-${pos.col}`,
    card: overrides.card,
    owner: overrides.owner,
    position: pos,
    damage: overrides.damage ?? 0,
    boosts: overrides.boosts ?? 0,
    hasMoved: overrides.hasMoved ?? false,
    hasAttacked: overrides.hasAttacked ?? false,
    attachedCards: overrides.attachedCards,
  };
  state.board[pos.row][pos.col].unit = unit;
  return unit;
}

/** 清空指定区域 */
function clearArea(state: SummonerWarsCore, rows: number[], cols: number[]) {
  for (const r of rows) {
    for (const c of cols) {
      state.board[r][c].unit = undefined;
      state.board[r][c].structure = undefined;
    }
  }
}

/** 创建掷术师卡牌（evasion + rebound） */
function makeTelekinetic(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '掷术师', unitClass: 'common',
    faction: 'trickster', strength: 1, life: 4, cost: 1,
    attackType: 'ranged', attackRange: 3,
    abilities: ['evasion', 'rebound'], deckSymbols: [],
  };
}

/** 创建清风弓箭手卡牌（swift + ranged） */
function makeWindArcher(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '清风弓箭手', unitClass: 'common',
    faction: 'trickster', strength: 4, life: 2, cost: 2,
    attackType: 'ranged', attackRange: 3,
    abilities: ['swift', 'ranged'], deckSymbols: [],
  };
}

/** 创建葛拉克卡牌（flying + aerial_strike） */
function makeGelak(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '葛拉克', unitClass: 'champion',
    faction: 'trickster', strength: 3, life: 8, cost: 6,
    attackType: 'ranged', attackRange: 3,
    abilities: ['flying', 'aerial_strike'], deckSymbols: [],
  };
}

/** 创建卡拉卡牌（high_telekinesis + stable） */
function makeKara(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '卡拉', unitClass: 'champion',
    faction: 'trickster', strength: 4, life: 8, cost: 7,
    attackType: 'ranged', attackRange: 3,
    abilities: ['high_telekinesis', 'stable'], deckSymbols: [],
  };
}

/** 创建泰珂露卡牌（mind_capture） */
function makeSummoner(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '泰珂露', unitClass: 'summoner',
    faction: 'trickster', strength: 3, life: 13, cost: 0,
    attackType: 'ranged', attackRange: 3,
    abilities: ['mind_capture'], deckSymbols: [],
  };
}

/** 创建普通敌方单位 */
function makeEnemy(id: string, overrides?: Partial<UnitCard>): UnitCard {
  return {
    id, cardType: 'unit', name: '敌方单位', unitClass: 'common',
    faction: 'goblin', strength: 2, life: 3, cost: 0,
    attackType: 'melee', attackRange: 1, deckSymbols: [],
    ...overrides,
  };
}

/** 创建友方士兵 */
function makeAllyCommon(id: string, overrides?: Partial<UnitCard>): UnitCard {
  return {
    id, cardType: 'unit', name: '友方士兵', unitClass: 'common',
    faction: 'trickster', strength: 2, life: 3, cost: 1,
    attackType: 'melee', attackRange: 1, deckSymbols: [],
    ...overrides,
  };
}

/** 执行命令并应用事件到状态 */
function executeAndReduce(
  state: SummonerWarsCore,
  commandType: string,
  payload: Record<string, unknown>,
  random?: RandomFn
): { newState: SummonerWarsCore; events: GameEvent[] } {
  const fullState = { core: state, sys: {} as any };
  const command = { type: commandType, payload, timestamp: fixedTimestamp, playerId: state.currentPlayer };
  const events = SummonerWarsDomain.execute(fullState, command, random ?? createTestRandom());
  let newState = state;
  for (const event of events) {
    newState = SummonerWarsDomain.reduce(newState, event);
  }
  return { newState, events };
}

// ============================================================================
// 迷魂 (evasion) 测试
// ============================================================================

describe('掷术师 - 迷魂 (evasion)', () => {
  it('敌方攻击掷出✦时，相邻掷术师减伤1点', () => {
    // random.random() 返回 5/6 ≈ 0.833 → index 5 → special (✦)
    const specialRandom: RandomFn = {
      ...createTestRandom(),
      random: () => 5 / 6,
    };
    const state = createTricksterState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

      // 敌方近战单位在 (4,2)
      placeUnit(state, { row: 4, col: 2 }, {
        cardId: 'test-enemy-attacker',
        card: makeEnemy('test-enemy-attacker', { strength: 3 }),
        owner: '1',
      });

      // 友方掷术师在 (4,3)，与敌方攻击者相邻
      placeUnit(state, { row: 4, col: 3 }, {
        cardId: 'test-telekinetic',
        card: makeTelekinetic('test-telekinetic'),
        owner: '0',
      });

      // 友方目标在 (4,1)，被敌方攻击
      placeUnit(state, { row: 4, col: 1 }, {
        cardId: 'test-target',
        card: makeAllyCommon('test-target', { life: 10 }),
        owner: '0',
      });

      state.phase = 'attack';
      state.currentPlayer = '1';
      state.players['1'].attackCount = 0;
      state.players['1'].hasAttackedEnemy = false;

      const { events } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
        attacker: { row: 4, col: 2 },
        target: { row: 4, col: 1 },
      }, specialRandom);

      // 应有 DAMAGE_REDUCED 事件
      const reduceEvents = events.filter(e => e.type === SW_EVENTS.DAMAGE_REDUCED);
      expect(reduceEvents.length).toBe(1);
      expect((reduceEvents[0].payload as any).sourceAbilityId).toBe('evasion');
  });

  it('敌方攻击未掷出✦时，不触发迷魂减伤', () => {
    // random.random() 返回 0 → index 0 → melee（无 special）
    const meleeRandom: RandomFn = {
      ...createTestRandom(),
      random: () => 0,
    };
    const state = createTricksterState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

      placeUnit(state, { row: 4, col: 2 }, {
        cardId: 'test-enemy-attacker',
        card: makeEnemy('test-enemy-attacker', { strength: 2 }),
        owner: '1',
      });

      placeUnit(state, { row: 4, col: 3 }, {
        cardId: 'test-telekinetic',
        card: makeTelekinetic('test-telekinetic'),
        owner: '0',
      });

      placeUnit(state, { row: 4, col: 1 }, {
        cardId: 'test-target',
        card: makeAllyCommon('test-target', { life: 10 }),
        owner: '0',
      });

      state.phase = 'attack';
      state.currentPlayer = '1';
      state.players['1'].attackCount = 0;
      state.players['1'].hasAttackedEnemy = false;

      const { events } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
        attacker: { row: 4, col: 2 },
        target: { row: 4, col: 1 },
      }, meleeRandom);

      const reduceEvents = events.filter(e => e.type === SW_EVENTS.DAMAGE_REDUCED);
      expect(reduceEvents.length).toBe(0);
  });

  it('getEvasionUnits 正确返回相邻敌方掷术师', () => {
    const state = createTricksterState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    // 攻击者在 (4,2)，owner='1'
    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-attacker',
      card: makeEnemy('test-attacker'),
      owner: '1',
    });

    // 掷术师在 (4,3)，owner='0'（敌方视角）
    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-telekinetic',
      card: makeTelekinetic('test-telekinetic'),
      owner: '0',
    });

    const evasionUnits = getEvasionUnits(state, { row: 4, col: 2 }, '1');
    expect(evasionUnits.length).toBe(1);
    expect(evasionUnits[0].cardId).toBe('test-telekinetic');
  });
});

// ============================================================================
// 缠斗 (rebound) 测试
// ============================================================================

describe('掷术师 - 缠斗 (rebound)', () => {
  it('敌方单位移动远离掷术师时受到1点伤害', () => {
    const state = createTricksterState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    // 友方掷术师在 (4,2)
    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-telekinetic',
      card: makeTelekinetic('test-telekinetic'),
      owner: '0',
    });

    // 敌方单位在 (4,3)，与掷术师相邻
    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-enemy-mover',
      card: makeEnemy('test-enemy-mover', { life: 5 }),
      owner: '1',
    });

    state.phase = 'move';
    state.currentPlayer = '1';
    state.players['1'].moveCount = 0;

    // 敌方移动远离：(4,3) → (4,4)
    const { events } = executeAndReduce(state, SW_COMMANDS.MOVE_UNIT, {
      from: { row: 4, col: 3 },
      to: { row: 4, col: 4 },
    });

    // 应有缠斗伤害事件
    const damageEvents = events.filter(
      e => e.type === SW_EVENTS.UNIT_DAMAGED && (e.payload as any).reason === 'entangle'
    );
    expect(damageEvents.length).toBe(1);
    expect((damageEvents[0].payload as any).damage).toBe(1);
    expect((damageEvents[0].payload as any).sourceUnitId).toBe('test-telekinetic');
  });

  it('敌方单位移动但未远离掷术师时不受伤害', () => {
    const state = createTricksterState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    // 友方掷术师在 (4,2)
    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-telekinetic',
      card: makeTelekinetic('test-telekinetic'),
      owner: '0',
    });

    // 敌方单位在 (4,3)
    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-enemy-mover',
      card: makeEnemy('test-enemy-mover', { life: 5 }),
      owner: '1',
    });

    state.phase = 'move';
    state.currentPlayer = '1';
    state.players['1'].moveCount = 0;

    // 敌方移动到 (3,3)，仍然与掷术师相邻（曼哈顿距离=1+1=2 > 1，但实际上 (3,3) 到 (4,2) 距离=2）
    // 实际上 (3,3) 到 (4,2) 距离 = |3-4| + |3-2| = 2 > 1，所以会触发
    // 改为移动到 (3,2)，距离 = |3-4| + |2-2| = 1，仍然相邻
    const { events } = executeAndReduce(state, SW_COMMANDS.MOVE_UNIT, {
      from: { row: 4, col: 3 },
      to: { row: 3, col: 2 },
    });

    const damageEvents = events.filter(
      e => e.type === SW_EVENTS.UNIT_DAMAGED && (e.payload as any).reason === 'entangle'
    );
    // 移动到 (3,2) 距离掷术师 (4,2) = 1，未远离
    expect(damageEvents.length).toBe(0);
  });

  it('getEntangleUnits 正确返回相邻友方掷术师', () => {
    const state = createTricksterState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-telekinetic',
      card: makeTelekinetic('test-telekinetic'),
      owner: '0',
    });

    // 敌方在 (4,3)，owner='1'
    const entangleUnits = getEntangleUnits(state, { row: 4, col: 3 }, '1');
    expect(entangleUnits.length).toBe(1);
    expect(entangleUnits[0].cardId).toBe('test-telekinetic');
  });
});

// ============================================================================
// 飞行 (flying) + 浮空术 (aerial_strike) 测试
// ============================================================================

describe('葛拉克 - 飞行 (flying)', () => {
  it('飞行单位可以移动3格（基础2+额外1）', () => {
    const state = createTricksterState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    // 葛拉克在 (4,2)
    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-gelak',
      card: makeGelak('test-gelak'),
      owner: '0',
    });

    // 验证可以移动到3格距离的位置
    expect(canMoveToEnhanced(state, { row: 4, col: 2 }, { row: 4, col: 5 })).toBe(true); // 距离3
    expect(canMoveToEnhanced(state, { row: 4, col: 2 }, { row: 1, col: 2 })).toBe(true); // 距离3
  });

  it('飞行单位可以穿越其他卡牌', () => {
    const state = createTricksterState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    // 葛拉克在 (4,1)
    placeUnit(state, { row: 4, col: 1 }, {
      cardId: 'test-gelak',
      card: makeGelak('test-gelak'),
      owner: '0',
    });

    // 中间有阻挡单位在 (4,2)
    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-blocker',
      card: makeEnemy('test-blocker'),
      owner: '1',
    });

    // 飞行可以穿越到 (4,3)
    expect(canMoveToEnhanced(state, { row: 4, col: 1 }, { row: 4, col: 3 })).toBe(true);
  });

  it('非飞行单位不能穿越其他卡牌', () => {
    const state = createTricksterState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    // 普通单位在 (4,1)
    placeUnit(state, { row: 4, col: 1 }, {
      cardId: 'test-normal',
      card: makeAllyCommon('test-normal'),
      owner: '0',
    });

    // 中间有阻挡单位在 (4,2)
    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-blocker',
      card: makeEnemy('test-blocker'),
      owner: '1',
    });

    // 普通单位不能穿越
    expect(canMoveToEnhanced(state, { row: 4, col: 1 }, { row: 4, col: 3 })).toBe(false);
  });
});

describe('葛拉克 - 浮空术 (aerial_strike)', () => {
  it('2格内友方士兵获得飞行（额外移动+穿越）', () => {
    const state = createTricksterState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    // 葛拉克在 (4,2)
    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-gelak',
      card: makeGelak('test-gelak'),
      owner: '0',
    });

    // 友方士兵在 (4,3)，距离葛拉克1格
    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-common',
      card: makeAllyCommon('test-common'),
      owner: '0',
    });

    // 士兵应该能移动3格（基础2+飞行1）
    expect(canMoveToEnhanced(state, { row: 4, col: 3 }, { row: 1, col: 3 })).toBe(true); // 距离3
  });

  it('超过2格的友方士兵不获得飞行', () => {
    const state = createTricksterState();
    clearArea(state, [1, 2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    // 葛拉克在 (4,2)
    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-gelak',
      card: makeGelak('test-gelak'),
      owner: '0',
    });

    // 友方士兵在 (1,2)，距离葛拉克3格（超出光环范围）
    placeUnit(state, { row: 1, col: 2 }, {
      cardId: 'test-far-common',
      card: makeAllyCommon('test-far-common'),
      owner: '0',
    });

    // 士兵不应该能移动3格
    expect(canMoveToEnhanced(state, { row: 1, col: 2 }, { row: 4, col: 2 })).toBe(false); // 距离3，无飞行
  });

  it('浮空术不影响冠军单位', () => {
    const state = createTricksterState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    // 葛拉克在 (4,2)
    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-gelak',
      card: makeGelak('test-gelak'),
      owner: '0',
    });

    // 友方冠军在 (4,3)
    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-champion',
      card: makeKara('test-champion'), // 冠军，非士兵
      owner: '0',
    });

    // 卡拉自身有 stable 但没有 flying/swift，基础移动2格
    // 浮空术只对 common 生效，冠军不受影响
    // 卡拉不应该能移动3格（除非自身有移动增强）
    expect(canMoveToEnhanced(state, { row: 4, col: 3 }, { row: 1, col: 3 })).toBe(false); // 距离3
  });
});

// ============================================================================
// 迅捷 (swift) 测试
// ============================================================================

describe('清风弓箭手 - 迅捷 (swift)', () => {
  it('迅捷单位可以移动3格（基础2+额外1）', () => {
    const state = createTricksterState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-archer',
      card: makeWindArcher('test-archer'),
      owner: '0',
    });

    // 可以移动3格
    expect(canMoveToEnhanced(state, { row: 4, col: 2 }, { row: 4, col: 5 })).toBe(true);
    expect(canMoveToEnhanced(state, { row: 4, col: 2 }, { row: 1, col: 2 })).toBe(true);
  });

  it('迅捷单位不能穿越其他卡牌（与飞行不同）', () => {
    const state = createTricksterState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    placeUnit(state, { row: 4, col: 1 }, {
      cardId: 'test-archer',
      card: makeWindArcher('test-archer'),
      owner: '0',
    });

    // 中间有阻挡
    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-blocker',
      card: makeEnemy('test-blocker'),
      owner: '1',
    });

    // 迅捷不能穿越（直线被阻挡）
    expect(canMoveToEnhanced(state, { row: 4, col: 1 }, { row: 4, col: 3 })).toBe(false);
  });
});

// ============================================================================
// 远射 (ranged) 测试
// ============================================================================

describe('清风弓箭手 - 远射 (ranged)', () => {
  it('远射单位攻击范围为4格', () => {
    const state = createTricksterState();
    clearArea(state, [1, 2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 1 }, {
      cardId: 'test-archer',
      card: makeWindArcher('test-archer'),
      owner: '0',
    });

    // 敌方在4格直线距离
    placeUnit(state, { row: 4, col: 5 }, {
      cardId: 'test-enemy',
      card: makeEnemy('test-enemy'),
      owner: '1',
    });

    expect(canAttackEnhanced(state, { row: 4, col: 1 }, { row: 4, col: 5 })).toBe(true);
  });

  it('远射单位不能攻击超过4格的目标', () => {
    const state = createTricksterState();
    clearArea(state, [0, 1, 2, 3, 4, 5, 6, 7], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 0, col: 0 }, {
      cardId: 'test-archer',
      card: makeWindArcher('test-archer'),
      owner: '0',
    });

    // 敌方在5格直线距离
    placeUnit(state, { row: 5, col: 0 }, {
      cardId: 'test-enemy',
      card: makeEnemy('test-enemy'),
      owner: '1',
    });

    expect(canAttackEnhanced(state, { row: 0, col: 0 }, { row: 5, col: 0 })).toBe(false);
  });

  it('getEffectiveAttackRange 对远射单位返回4', () => {
    const archer: BoardUnit = {
      cardId: 'test', card: makeWindArcher('test'), owner: '0',
      position: { row: 0, col: 0 }, damage: 0, boosts: 0,
      hasMoved: false, hasAttacked: false,
    };
    expect(getEffectiveAttackRangeBase(archer)).toBe(4);
  });

  it('getEffectiveAttackRange 对普通远程单位返回默认范围', () => {
    const normal: BoardUnit = {
      cardId: 'test', card: makeEnemy('test', { attackType: 'ranged', attackRange: 3 }),
      owner: '0', position: { row: 0, col: 0 }, damage: 0, boosts: 0,
      hasMoved: false, hasAttacked: false,
    };
    expect(getEffectiveAttackRangeBase(normal)).toBe(3);
  });
});

// ============================================================================
// 稳固 (stable) 测试
// ============================================================================

describe('卡拉 - 稳固 (stable)', () => {
  it('hasStableAbility 对有 stable 技能的单位返回 true', () => {
    const kara: BoardUnit = {
      cardId: 'test', card: makeKara('test'), owner: '0',
      position: { row: 0, col: 0 }, damage: 0, boosts: 0,
      hasMoved: false, hasAttacked: false,
    };
    expect(hasStableAbilityBase(kara)).toBe(true);
  });

  it('hasStableAbility 对无 stable 技能的单位返回 false', () => {
    const normal: BoardUnit = {
      cardId: 'test', card: makeEnemy('test'), owner: '0',
      position: { row: 0, col: 0 }, damage: 0, boosts: 0,
      hasMoved: false, hasAttacked: false,
    };
    expect(hasStableAbilityBase(normal)).toBe(false);
  });
});

// ============================================================================
// 心灵捕获 (mind_capture) 测试
// ============================================================================

describe('泰珂露 - 心灵捕获 (mind_capture)', () => {
  it('致命攻击时生成 MIND_CAPTURE_REQUESTED 事件', () => {
    // 所有骰子掷出 ranged（远程命中）
    // Math.random 返回 0.5 → index 3 → ranged
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    try {
      const state = createTricksterState();
      clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

      // 泰珂露在 (4,2)，strength=3
      placeUnit(state, { row: 4, col: 2 }, {
        cardId: 'test-summoner',
        card: makeSummoner('test-summoner'),
        owner: '0',
      });

      // 敌方单位在 (4,4)，life=2，距离2格（远程直线）
      placeUnit(state, { row: 4, col: 4 }, {
        cardId: 'test-enemy',
        card: makeEnemy('test-enemy', { life: 2 }),
        owner: '1',
      });

      state.phase = 'attack';
      state.currentPlayer = '0';
      state.players['0'].attackCount = 0;
      state.players['0'].hasAttackedEnemy = false;

      const { events } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
        attacker: { row: 4, col: 2 },
        target: { row: 4, col: 4 },
      });

      // 应有 MIND_CAPTURE_REQUESTED 事件
      const mcEvents = events.filter(e => e.type === SW_EVENTS.MIND_CAPTURE_REQUESTED);
      expect(mcEvents.length).toBe(1);
      expect((mcEvents[0].payload as any).sourceUnitId).toBe('test-summoner');
      expect((mcEvents[0].payload as any).targetUnitId).toBe('test-enemy');

      // 不应有 UNIT_DAMAGED 事件（心灵捕获时暂停伤害）
      const damageEvents = events.filter(
        e => e.type === SW_EVENTS.UNIT_DAMAGED && (e.payload as any).position?.row === 4 && (e.payload as any).position?.col === 4
      );
      expect(damageEvents.length).toBe(0);
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('非致命攻击时不触发心灵捕获', () => {
    // 掷出 ranged 命中
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    try {
      const state = createTricksterState();
      clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

      placeUnit(state, { row: 4, col: 2 }, {
        cardId: 'test-summoner',
        card: makeSummoner('test-summoner'),
        owner: '0',
      });

      // 敌方 life=10，不会被击杀
      placeUnit(state, { row: 4, col: 4 }, {
        cardId: 'test-tough-enemy',
        card: makeEnemy('test-tough-enemy', { life: 10 }),
        owner: '1',
      });

      state.phase = 'attack';
      state.currentPlayer = '0';
      state.players['0'].attackCount = 0;
      state.players['0'].hasAttackedEnemy = false;

      const { events } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
        attacker: { row: 4, col: 2 },
        target: { row: 4, col: 4 },
      });

      const mcEvents = events.filter(e => e.type === SW_EVENTS.MIND_CAPTURE_REQUESTED);
      expect(mcEvents.length).toBe(0);

      // 应正常造成伤害
      const damageEvents = events.filter(e => e.type === SW_EVENTS.UNIT_DAMAGED);
      expect(damageEvents.length).toBeGreaterThan(0);
    } finally {
      randomSpy.mockRestore();
    }
  });
});

// ============================================================================
// CONTROL_TRANSFERRED 事件测试
// ============================================================================

describe('控制权转移 (CONTROL_TRANSFERRED)', () => {
  it('reduce 正确处理控制权转移事件', () => {
    const state = createTricksterState();
    clearArea(state, [4], [2, 3]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-target',
      card: makeEnemy('test-target'),
      owner: '1',
    });

    // 手动应用 CONTROL_TRANSFERRED 事件
    const newState = SummonerWarsDomain.reduce(state, {
      type: SW_EVENTS.CONTROL_TRANSFERRED,
      payload: {
        targetPosition: { row: 4, col: 2 },
        newOwner: '0' as PlayerId,
      },
      timestamp: fixedTimestamp,
    });

    const unit = newState.board[4][2].unit;
    expect(unit).toBeDefined();
    expect(unit!.owner).toBe('0');
  });
});

// ============================================================================
// UNIT_PUSHED / UNIT_PULLED 事件测试
// ============================================================================

describe('推拉事件 (UNIT_PUSHED / UNIT_PULLED)', () => {
  it('reduce 正确处理推拉移动', () => {
    const state = createTricksterState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-pushed',
      card: makeEnemy('test-pushed'),
      owner: '1',
    });

    const newState = SummonerWarsDomain.reduce(state, {
      type: SW_EVENTS.UNIT_PUSHED,
      payload: {
        targetPosition: { row: 4, col: 2 },
        newPosition: { row: 4, col: 3 },
      },
      timestamp: fixedTimestamp,
    });

    expect(newState.board[4][2].unit).toBeUndefined();
    expect(newState.board[4][3].unit?.cardId).toBe('test-pushed');
  });

  it('推拉到被占据位置时不移动', () => {
    const state = createTricksterState();
    clearArea(state, [3, 4, 5], [1, 2, 3]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-pushed',
      card: makeEnemy('test-pushed'),
      owner: '1',
    });

    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-blocker',
      card: makeEnemy('test-blocker'),
      owner: '0',
    });

    // 没有 newPosition 时不移动
    const newState = SummonerWarsDomain.reduce(state, {
      type: SW_EVENTS.UNIT_PUSHED,
      payload: {
        targetPosition: { row: 4, col: 2 },
        // 无 newPosition
      },
      timestamp: fixedTimestamp,
    });

    expect(newState.board[4][2].unit?.cardId).toBe('test-pushed');
  });
});

// ============================================================================
// validate 增强版验证测试
// ============================================================================

describe('validate 增强版移动/攻击', () => {
  it('飞行单位移动3格通过验证', () => {
    const state = createTricksterState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-gelak',
      card: makeGelak('test-gelak'),
      owner: '0',
    });

    state.phase = 'move';
    state.currentPlayer = '0';
    state.players['0'].moveCount = 0;

    // 移动3格应该通过验证
    const { newState, events } = executeAndReduce(state, SW_COMMANDS.MOVE_UNIT, {
      from: { row: 4, col: 2 },
      to: { row: 4, col: 5 },
    });

    // 应有 UNIT_MOVED 事件
    const moveEvents = events.filter(e => e.type === SW_EVENTS.UNIT_MOVED);
    expect(moveEvents.length).toBe(1);
    expect(newState.board[4][5].unit?.cardId).toBe('test-gelak');
  });

  it('远射单位攻击4格目标通过验证', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    try {
      const state = createTricksterState();
      clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

      placeUnit(state, { row: 4, col: 1 }, {
        cardId: 'test-archer',
        card: makeWindArcher('test-archer'),
        owner: '0',
      });

      placeUnit(state, { row: 4, col: 5 }, {
        cardId: 'test-enemy',
        card: makeEnemy('test-enemy'),
        owner: '1',
      });

      state.phase = 'attack';
      state.currentPlayer = '0';
      state.players['0'].attackCount = 0;
      state.players['0'].hasAttackedEnemy = false;

      const { events } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
        attacker: { row: 4, col: 1 },
        target: { row: 4, col: 5 },
      });

      // 应有 UNIT_ATTACKED 事件
      const attackEvents = events.filter(e => e.type === SW_EVENTS.UNIT_ATTACKED);
      expect(attackEvents.length).toBe(1);
    } finally {
      randomSpy.mockRestore();
    }
  });
});

// ============================================================================
// 事件卡效果测试
// ============================================================================

/** 创建事件卡并放入手牌 */
function addEventToHand(
  state: SummonerWarsCore,
  playerId: PlayerId,
  eventId: string,
  overrides?: Partial<import('../domain/types').EventCard>
) {
  const eventCard: import('../domain/types').EventCard = {
    id: eventId,
    cardType: 'event',
    name: overrides?.name ?? '测试事件',
    cost: overrides?.cost ?? 0,
    playPhase: overrides?.playPhase ?? 'summon',
    effect: overrides?.effect ?? '测试效果',
    isActive: overrides?.isActive ?? false,
    deckSymbols: [],
    ...overrides,
    faction: overrides?.faction ?? 'trickster',
  };
  state.players[playerId].hand.push(eventCard);
  return eventCard;
}

describe('欺心巫族事件卡 - 心灵操控 (mind-control)', () => {
  it('获得召唤师2格内敌方士兵的控制权', () => {
    const state = createTricksterState();
    clearArea(state, [3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    // 友方召唤师在 (5,2)
    placeUnit(state, { row: 5, col: 2 }, {
      cardId: 'test-summoner',
      card: makeSummoner('test-summoner'),
      owner: '0',
    });
    state.players['0'].summonerId = 'test-summoner';

    // 敌方士兵在 (4,2)，距离召唤师1格
    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-enemy-common',
      card: makeEnemy('test-enemy-common'),
      owner: '1',
    });

    // 敌方冠军在 (3,2)，距离召唤师2格
    placeUnit(state, { row: 3, col: 2 }, {
      cardId: 'test-enemy-champion',
      card: makeEnemy('test-enemy-champion', { unitClass: 'champion' }),
      owner: '1',
    });

    state.phase = 'summon';
    state.currentPlayer = '0';

    addEventToHand(state, '0', 'trickster-mind-control', {
      name: '心灵操控',
      eventType: 'legendary',
      playPhase: 'summon',
    });

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
      cardId: 'trickster-mind-control',
      targets: [{ row: 4, col: 2 }, { row: 3, col: 2 }],
    });

    // 应有2个 CONTROL_TRANSFERRED 事件
    const ctEvents = events.filter(e => e.type === SW_EVENTS.CONTROL_TRANSFERRED);
    expect(ctEvents.length).toBe(2);

    // 两个单位都应该变为玩家0控制
    expect(newState.board[4][2].unit?.owner).toBe('0');
    expect(newState.board[3][2].unit?.owner).toBe('0');
  });

  it('不能控制敌方召唤师', () => {
    const state = createTricksterState();
    clearArea(state, [3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 5, col: 2 }, {
      cardId: 'test-summoner',
      card: makeSummoner('test-summoner'),
      owner: '0',
    });
    state.players['0'].summonerId = 'test-summoner';

    // 敌方召唤师在 (4,2)
    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-enemy-summoner',
      card: makeEnemy('test-enemy-summoner', { unitClass: 'summoner' }),
      owner: '1',
    });

    state.phase = 'summon';
    state.currentPlayer = '0';

    addEventToHand(state, '0', 'trickster-mind-control', {
      name: '心灵操控',
      playPhase: 'summon',
    });

    const { events } = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
      cardId: 'trickster-mind-control',
      targets: [{ row: 4, col: 2 }],
    });

    // 不应有控制权转移事件（召唤师不能被控制）
    const ctEvents = events.filter(e => e.type === SW_EVENTS.CONTROL_TRANSFERRED);
    expect(ctEvents.length).toBe(0);
  });

  it('超过2格的敌方单位不受影响', () => {
    const state = createTricksterState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 5, col: 2 }, {
      cardId: 'test-summoner',
      card: makeSummoner('test-summoner'),
      owner: '0',
    });
    state.players['0'].summonerId = 'test-summoner';

    // 敌方在 (2,2)，距离召唤师3格
    placeUnit(state, { row: 2, col: 2 }, {
      cardId: 'test-far-enemy',
      card: makeEnemy('test-far-enemy'),
      owner: '1',
    });

    state.phase = 'summon';
    state.currentPlayer = '0';

    addEventToHand(state, '0', 'trickster-mind-control', {
      name: '心灵操控',
      playPhase: 'summon',
    });

    const { events } = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
      cardId: 'trickster-mind-control',
      targets: [{ row: 2, col: 2 }],
    });

    const ctEvents = events.filter(e => e.type === SW_EVENTS.CONTROL_TRANSFERRED);
    expect(ctEvents.length).toBe(0);
  });
});

describe('欺心巫族事件卡 - 风暴侵袭 (storm-assault)', () => {
  it('主动事件区有风暴侵袭时，单位移动减少1格', () => {
    const state = createTricksterState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    // 放入主动事件区
    state.players['0'].activeEvents.push({
      id: 'trickster-storm-assault',
      cardType: 'event',
      name: '风暴侵袭',
      faction: 'trickster',
      cost: 0,
      playPhase: 'magic',
      effect: '持续：单位必须减少移动1个区格。',
      isActive: true,
      deckSymbols: [],
    });

    // 普通单位在 (4,2)，基础移动2格，风暴侵袭减1 → 只能移动1格
    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-normal',
      card: makeAllyCommon('test-normal'),
      owner: '0',
    });

    // 1格可以移动
    expect(canMoveToEnhanced(state, { row: 4, col: 2 }, { row: 4, col: 3 })).toBe(true);
    // 2格不能移动（被减少到1格）
    expect(canMoveToEnhanced(state, { row: 4, col: 2 }, { row: 4, col: 4 })).toBe(false);
  });

  it('getStormAssaultReduction 正确检测主动事件', () => {
    const state = createTricksterState();
    expect(getStormAssaultReduction(state)).toBe(0);

    state.players['0'].activeEvents.push({
      id: 'trickster-storm-assault-0',
      cardType: 'event',
      name: '风暴侵袭',
      faction: 'trickster',
      cost: 0,
      playPhase: 'magic',
      effect: '',
      isActive: true,
      deckSymbols: [],
    });

    expect(getStormAssaultReduction(state)).toBe(1);
  });

  it('飞行单位也受风暴侵袭影响（3格→2格）', () => {
    const state = createTricksterState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    state.players['0'].activeEvents.push({
      id: 'trickster-storm-assault',
      cardType: 'event',
      name: '风暴侵袭',
      faction: 'trickster',
      cost: 0,
      playPhase: 'magic',
      effect: '',
      isActive: true,
      deckSymbols: [],
    });

    // 飞行单位：基础2 + 飞行1 - 风暴1 = 2格
    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-gelak',
      card: makeGelak('test-gelak'),
      owner: '0',
    });

    // 2格可以
    expect(canMoveToEnhanced(state, { row: 4, col: 2 }, { row: 4, col: 4 })).toBe(true);
    // 3格不行
    expect(canMoveToEnhanced(state, { row: 4, col: 2 }, { row: 4, col: 5 })).toBe(false);
  });
});

describe('欺心巫族事件卡 - 震慑 (stun)', () => {
  it('推拉目标并对目标造成1伤害', () => {
    const state = createTricksterState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    // 召唤师在 (5,2)
    placeUnit(state, { row: 5, col: 2 }, {
      cardId: 'test-summoner',
      card: makeSummoner('test-summoner'),
      owner: '0',
    });
    state.players['0'].summonerId = 'test-summoner';

    // 敌方在 (3,2)，距离召唤师2格直线
    placeUnit(state, { row: 3, col: 2 }, {
      cardId: 'test-stun-target',
      card: makeEnemy('test-stun-target', { life: 5 }),
      owner: '1',
    });

    state.phase = 'move';
    state.currentPlayer = '0';

    addEventToHand(state, '0', 'trickster-stun', {
      name: '震慑',
      cost: 1,
      playPhase: 'move',
    });
    state.players['0'].magic = 5;

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
      cardId: 'trickster-stun',
      targets: [{ row: 3, col: 2 }],
      stunDirection: 'push',
      stunDistance: 2,
    });

    // 应有伤害事件（对目标1伤害）
    const stunDamage = events.filter(
      e => e.type === SW_EVENTS.UNIT_DAMAGED && (e.payload as any).reason === 'stun'
    );
    expect(stunDamage.length).toBe(1);
    expect((stunDamage[0].payload as any).damage).toBe(1);

    // 应有推拉事件
    const pushEvents = events.filter(e => e.type === SW_EVENTS.UNIT_PUSHED);
    expect(pushEvents.length).toBe(1);
  });

  it('穿过单位时对被穿过的单位造成1伤害', () => {
    const state = createTricksterState();
    clearArea(state, [1, 2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    // 召唤师在 (5,2)
    placeUnit(state, { row: 5, col: 2 }, {
      cardId: 'test-summoner',
      card: makeSummoner('test-summoner'),
      owner: '0',
    });
    state.players['0'].summonerId = 'test-summoner';

    // 目标在 (3,2)
    placeUnit(state, { row: 3, col: 2 }, {
      cardId: 'test-stun-target',
      card: makeEnemy('test-stun-target', { life: 5 }),
      owner: '1',
    });

    // 中间有单位在 (2,2)，会被穿过
    placeUnit(state, { row: 2, col: 2 }, {
      cardId: 'test-passthrough',
      card: makeEnemy('test-passthrough', { life: 5 }),
      owner: '1',
    });

    state.phase = 'move';
    state.currentPlayer = '0';

    addEventToHand(state, '0', 'trickster-stun', {
      name: '震慑',
      cost: 1,
      playPhase: 'move',
    });
    state.players['0'].magic = 5;

    const { events } = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
      cardId: 'trickster-stun',
      targets: [{ row: 3, col: 2 }],
      stunDirection: 'push', // 推离召唤师（向上）
      stunDistance: 2,
    });

    // 穿过伤害
    const passthroughDamage = events.filter(
      e => e.type === SW_EVENTS.UNIT_DAMAGED && (e.payload as any).reason === 'stun_passthrough'
    );
    expect(passthroughDamage.length).toBe(1);
    expect((passthroughDamage[0].payload as any).position.row).toBe(2);

    // 目标自身伤害
    const stunDamage = events.filter(
      e => e.type === SW_EVENTS.UNIT_DAMAGED && (e.payload as any).reason === 'stun'
    );
    expect(stunDamage.length).toBe(1);
  });
});

describe('欺心巫族事件卡 - 催眠引诱 (hypnotic-lure)', () => {
  it('拉目标向召唤师靠近1格', () => {
    const state = createTricksterState();
    clearArea(state, [3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    // 召唤师在 (5,2)
    placeUnit(state, { row: 5, col: 2 }, {
      cardId: 'test-summoner',
      card: makeSummoner('test-summoner'),
      owner: '0',
    });
    state.players['0'].summonerId = 'test-summoner';

    // 敌方在 (3,2)，距离召唤师2格
    placeUnit(state, { row: 3, col: 2 }, {
      cardId: 'test-lure-target',
      card: makeEnemy('test-lure-target', { life: 5 }),
      owner: '1',
    });

    state.phase = 'summon';
    state.currentPlayer = '0';

    addEventToHand(state, '0', 'trickster-hypnotic-lure', {
      name: '催眠引诱',
      playPhase: 'summon',
      isActive: true,
    });

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
      cardId: 'trickster-hypnotic-lure',
      targets: [{ row: 3, col: 2 }],
    });

    // 应有拉动事件
    const pullEvents = events.filter(e => e.type === SW_EVENTS.UNIT_PULLED);
    expect(pullEvents.length).toBe(1);

    // 目标应该被拉到 (4,2)（靠近召唤师1格）
    expect(newState.board[4][2].unit?.cardId).toBe('test-lure-target');
    expect(newState.board[3][2].unit).toBeUndefined();
  });

  it('催眠引诱标记目标单位ID到主动事件', () => {
    const state = createTricksterState();
    clearArea(state, [3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 5, col: 2 }, {
      cardId: 'test-summoner',
      card: makeSummoner('test-summoner'),
      owner: '0',
    });
    state.players['0'].summonerId = 'test-summoner';

    placeUnit(state, { row: 3, col: 2 }, {
      cardId: 'test-lure-target',
      card: makeEnemy('test-lure-target', { life: 5 }),
      owner: '1',
    });

    state.phase = 'summon';
    state.currentPlayer = '0';

    addEventToHand(state, '0', 'trickster-hypnotic-lure', {
      name: '催眠引诱',
      playPhase: 'summon',
      isActive: true,
    });

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
      cardId: 'trickster-hypnotic-lure',
      targets: [{ row: 3, col: 2 }],
    });

    // 应有标记事件
    const markEvents = events.filter(e => e.type === SW_EVENTS.HYPNOTIC_LURE_MARKED);
    expect(markEvents.length).toBe(1);

    // 主动事件区应有催眠引诱且标记了目标
    const lureEvent = newState.players['0'].activeEvents.find(
      e => e.id === 'trickster-hypnotic-lure'
    );
    expect(lureEvent).toBeDefined();
    expect(lureEvent!.targetUnitId).toBe('test-lure-target');
  });

  it('召唤师攻击被催眠目标时战力+1', () => {
    const state = createTricksterState();
    clearArea(state, [3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    // 召唤师在 (5,2)
    const summoner = placeUnit(state, { row: 5, col: 2 }, {
      cardId: 'test-summoner',
      card: makeSummoner('test-summoner'),
      owner: '0',
    });
    state.players['0'].summonerId = 'test-summoner';

    // 被催眠的目标在 (4,2)
    const luredUnit = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-lured',
      card: makeEnemy('test-lured', { life: 10 }),
      owner: '1',
    });

    // 主动事件区有催眠引诱，标记了目标
    state.players['0'].activeEvents.push({
      id: 'trickster-hypnotic-lure-0',
      cardType: 'event',
      name: '催眠引诱',
      faction: 'trickster',
      cost: 0,
      playPhase: 'summon',
      effect: '',
      isActive: true,
      deckSymbols: [],
      targetUnitId: 'test-lured',
    });

    // 计算战力：基础3 + 催眠引诱1 = 4
    const strength = calculateEffectiveStrength(summoner, state, luredUnit);
    expect(strength).toBe(4); // 3 + 1
  });

  it('召唤师攻击非催眠目标时战力不变', () => {
    const state = createTricksterState();
    clearArea(state, [3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const summoner = placeUnit(state, { row: 5, col: 2 }, {
      cardId: 'test-summoner',
      card: makeSummoner('test-summoner'),
      owner: '0',
    });
    state.players['0'].summonerId = 'test-summoner';

    const otherUnit = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-other',
      card: makeEnemy('test-other', { life: 10 }),
      owner: '1',
    });

    state.players['0'].activeEvents.push({
      id: 'trickster-hypnotic-lure-0',
      cardType: 'event',
      name: '催眠引诱',
      faction: 'trickster',
      cost: 0,
      playPhase: 'summon',
      effect: '',
      isActive: true,
      deckSymbols: [],
      targetUnitId: 'test-lured', // 不同的目标
    });

    const strength = calculateEffectiveStrength(summoner, state, otherUnit);
    expect(strength).toBe(3); // 基础战力，无加成
  });
});
