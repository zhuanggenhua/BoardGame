/**
 * 召唤师战争 - 极地矮人技能测试
 *
 * 覆盖：
 * - frost_bolt（冰霜飞弹）：相邻每有一个友方建筑+1战力
 * - greater_frost_bolt（高阶冰霜飞弹）：2格内每有一个友方建筑+1战力
 * - slow（缓慢）：减少移动1格
 * - living_gate / mobile_structure（活体传送门/活体结构）：视为建筑和传送门
 * - structure_shift（结构变换）：移动后推拉3格内友方建筑1格
 * - ice_shards（寒冰碎屑）：消耗充能对建筑相邻敌方造成1伤
 * - imposing（威势）：攻击后充能
 * - 事件卡：寒冰冲撞、冰川位移、寒冰修补
 */

import { describe, it, expect } from 'vitest';
import { SummonerWarsDomain, SW_COMMANDS, SW_EVENTS } from '../domain';
import type {
  SummonerWarsCore, CellCoord, BoardUnit, UnitCard, EventCard,
  PlayerId, StructureCard, BoardStructure,
} from '../domain/types';
import type { RandomFn, GameEvent } from '../../../engine/types';
import { canMoveToEnhanced, getStructureAt, getUnitAt } from '../domain/helpers';
import { getEffectiveStrengthValue } from '../domain/abilityResolver';
import { createInitializedCore, generateInstanceId } from './test-helpers';

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

/** 创建极地矮人 vs 亡灵法师的测试状态 */
function createFrostState(): SummonerWarsCore {
  return createInitializedCore(['0', '1'], createTestRandom(), {
    faction0: 'frost',
    faction1: 'necromancer',
  });
}

/** 在指定位置放置测试单位 */
function placeUnit(
  state: SummonerWarsCore,
  pos: CellCoord,
  overrides: Partial<BoardUnit> & { card: UnitCard; owner: PlayerId }
): BoardUnit {
  const cardId = overrides.cardId ?? `test-${pos.row}-${pos.col}`;
  const unit: BoardUnit = {
    instanceId: overrides.instanceId ?? generateInstanceId(cardId),
    cardId,
    card: overrides.card,
    owner: overrides.owner,
    position: pos,
    damage: overrides.damage ?? 0,
    boosts: overrides.boosts ?? 0,
    hasMoved: overrides.hasMoved ?? false,
    hasAttacked: overrides.hasAttacked ?? false,
  };
  state.board[pos.row][pos.col].unit = unit;
  return unit;
}

/** 在指定位置放置建筑 */
function placeStructure(
  state: SummonerWarsCore,
  pos: CellCoord,
  overrides: Partial<BoardStructure> & { card: StructureCard; owner: PlayerId }
): BoardStructure {
  const structure: BoardStructure = {
    cardId: overrides.cardId ?? `struct-${pos.row}-${pos.col}`,
    card: overrides.card,
    owner: overrides.owner,
    position: pos,
    damage: overrides.damage ?? 0,
  };
  state.board[pos.row][pos.col].structure = structure;
  return structure;
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

/** 创建冰霜法师卡牌 */
function makeFrostMage(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '冰霜法师', unitClass: 'common',
    faction: 'frost', strength: 1, life: 4, cost: 1,
    attackType: 'ranged', attackRange: 3,
    abilities: ['frost_bolt'], deckSymbols: [],
  };
}

/** 创建纳蒂亚娜卡牌（高阶冰霜飞弹） */
function makeNatiana(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '纳蒂亚娜', unitClass: 'champion',
    faction: 'frost', strength: 2, life: 7, cost: 6,
    attackType: 'ranged', attackRange: 3,
    abilities: ['greater_frost_bolt'], deckSymbols: [],
  };
}

/** 创建寒冰魔像卡牌（活体传送门+活体结构+缓慢） */
function makeIceGolem(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '寒冰魔像', unitClass: 'common',
    faction: 'frost', strength: 2, life: 5, cost: 2,
    attackType: 'melee', attackRange: 1,
    abilities: ['living_gate', 'mobile_structure', 'slow'], deckSymbols: [],
  };
}

/** 创建极地矮人召唤师卡牌（结构变换） */
function makeFrostSummoner(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '丝瓦拉', unitClass: 'summoner',
    faction: 'frost', strength: 3, life: 12, cost: 0,
    attackType: 'ranged', attackRange: 3,
    abilities: ['structure_shift'], deckSymbols: [],
  };
}

/** 创建贾穆德卡牌（威势+寒冰碎屑） */
function makeJarmund(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '贾穆德', unitClass: 'champion',
    faction: 'frost', strength: 3, life: 7, cost: 5,
    attackType: 'ranged', attackRange: 3,
    abilities: ['imposing', 'ice_shards'], deckSymbols: [],
  };
}

/** 创建霜刃卫卡牌（冰霜战斧） */
function makeFrostAxeBearer(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '霜刃卫', unitClass: 'champion',
    faction: 'frost', strength: 2, life: 5, cost: 3,
    attackType: 'melee', attackRange: 1,
    abilities: ['frost_axe'], deckSymbols: [],
  };
}

/** 创建熊骑兵卡牌（践踏） */
function makeBearCavalry(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '熊骑兵', unitClass: 'common',
    faction: 'frost', strength: 3, life: 5, cost: 3,
    attackType: 'melee', attackRange: 1,
    abilities: ['trample'], deckSymbols: [],
  };
}

/** 创建普通敌方单位 */
function makeEnemy(id: string, overrides?: Partial<UnitCard>): UnitCard {
  return {
    id, cardType: 'unit', name: '敌方单位', unitClass: 'common',
    faction: 'necromancer', strength: 2, life: 3, cost: 0,
    attackType: 'melee', attackRange: 1, deckSymbols: [],
    ...overrides,
  };
}

/** 创建传送门建筑 */
function makePortal(id: string): StructureCard {
  return {
    id, cardType: 'structure', name: '传送门',
    faction: 'frost', cost: 0, life: 5, isGate: true, deckSymbols: [],
  };
}

/** 创建护城墙建筑 */
function makeParapet(id: string): StructureCard {
  return {
    id, cardType: 'structure', name: '护城墙',
    faction: 'frost', cost: 0, life: 5, isGate: false, deckSymbols: [],
  };
}

/** 执行命令并应用事件到状态 */
function executeAndReduce(
  state: SummonerWarsCore,
  commandType: string,
  payload: Record<string, unknown>
): { newState: SummonerWarsCore; events: GameEvent[] } {
  const fullState = { core: state, sys: {} as any };
  const command = { type: commandType, payload, timestamp: fixedTimestamp, playerId: state.currentPlayer };
  const events = SummonerWarsDomain.execute(fullState, command, createTestRandom());
  let newState = state;
  for (const event of events) {
    newState = SummonerWarsDomain.reduce(newState, event);
  }
  return { newState, events };
}

/** 创建事件卡并放入手牌 */
function addEventToHand(
  state: SummonerWarsCore,
  playerId: PlayerId,
  eventId: string,
  overrides?: Partial<EventCard>
) {
  const eventCard: EventCard = {
    id: eventId,
    cardType: 'event',
    name: overrides?.name ?? '测试事件',
    faction: 'frost',
    cost: overrides?.cost ?? 0,
    playPhase: overrides?.playPhase ?? 'summon',
    effect: overrides?.effect ?? '测试效果',
    isActive: overrides?.isActive ?? false,
    deckSymbols: [],
    ...overrides,
  };
  state.players[playerId].hand.push(eventCard);
  return eventCard;
}


// ============================================================================
// 冰霜飞弹 (frost_bolt) 测试
// ============================================================================

describe('冰霜法师 - 冰霜飞弹 (frost_bolt)', () => {
  it('相邻无友方建筑时战力为基础值', () => {
    const state = createFrostState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const mage = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-mage', card: makeFrostMage('test-mage'), owner: '0',
    });

    const strength = getEffectiveStrengthValue(mage, state);
    expect(strength).toBe(1); // 基础1，无建筑加成
  });

  it('相邻有1个友方建筑时+1战力', () => {
    const state = createFrostState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const mage = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-mage', card: makeFrostMage('test-mage'), owner: '0',
    });

    placeStructure(state, { row: 4, col: 3 }, {
      cardId: 'portal-1', card: makePortal('portal-1'), owner: '0',
    });

    const strength = getEffectiveStrengthValue(mage, state);
    expect(strength).toBe(2); // 基础1 + 建筑1
  });

  it('相邻有2个友方建筑时+2战力', () => {
    const state = createFrostState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const mage = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-mage', card: makeFrostMage('test-mage'), owner: '0',
    });

    placeStructure(state, { row: 4, col: 3 }, {
      cardId: 'portal-1', card: makePortal('portal-1'), owner: '0',
    });
    placeStructure(state, { row: 3, col: 2 }, {
      cardId: 'parapet-1', card: makeParapet('parapet-1'), owner: '0',
    });

    const strength = getEffectiveStrengthValue(mage, state);
    expect(strength).toBe(3); // 基础1 + 建筑2
  });

  it('非相邻友方建筑不计入', () => {
    const state = createFrostState();
    clearArea(state, [1, 2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const mage = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-mage', card: makeFrostMage('test-mage'), owner: '0',
    });

    // 距离2的建筑
    placeStructure(state, { row: 2, col: 2 }, {
      cardId: 'portal-far', card: makePortal('portal-far'), owner: '0',
    });

    const strength = getEffectiveStrengthValue(mage, state);
    expect(strength).toBe(1); // 基础1，非相邻不计入
  });

  it('敌方建筑不计入', () => {
    const state = createFrostState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const mage = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-mage', card: makeFrostMage('test-mage'), owner: '0',
    });

    placeStructure(state, { row: 4, col: 3 }, {
      cardId: 'enemy-portal', card: makePortal('enemy-portal'), owner: '1',
    });

    const strength = getEffectiveStrengthValue(mage, state);
    expect(strength).toBe(1); // 敌方不计入
  });

  it('相邻友方活体结构（寒冰魔像）也计入', () => {
    const state = createFrostState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const mage = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-mage', card: makeFrostMage('test-mage'), owner: '0',
    });

    // 寒冰魔像（活体结构）
    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'golem-1', card: makeIceGolem('golem-1'), owner: '0',
    });

    const strength = getEffectiveStrengthValue(mage, state);
    expect(strength).toBe(2); // 基础1 + 活体结构1
  });
});

// ============================================================================
// 高阶冰霜飞弹 (greater_frost_bolt) 测试
// ============================================================================

describe('纳蒂亚娜 - 高阶冰霜飞弹 (greater_frost_bolt)', () => {
  it('2格内无友方建筑时战力为基础值', () => {
    const state = createFrostState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const natiana = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-natiana', card: makeNatiana('test-natiana'), owner: '0',
    });

    const strength = getEffectiveStrengthValue(natiana, state);
    expect(strength).toBe(2); // 基础2
  });

  it('2格内有1个友方建筑时+1战力', () => {
    const state = createFrostState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const natiana = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-natiana', card: makeNatiana('test-natiana'), owner: '0',
    });

    placeStructure(state, { row: 3, col: 2 }, {
      cardId: 'portal-1', card: makePortal('portal-1'), owner: '0',
    });

    const strength = getEffectiveStrengthValue(natiana, state);
    expect(strength).toBe(3); // 基础2 + 建筑1
  });

  it('2格内有2个友方建筑时+2战力', () => {
    const state = createFrostState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const natiana = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-natiana', card: makeNatiana('test-natiana'), owner: '0',
    });

    placeStructure(state, { row: 3, col: 2 }, {
      cardId: 'portal-1', card: makePortal('portal-1'), owner: '0',
    });
    placeStructure(state, { row: 4, col: 4 }, {
      cardId: 'parapet-1', card: makeParapet('parapet-1'), owner: '0',
    });

    const strength = getEffectiveStrengthValue(natiana, state);
    expect(strength).toBe(4); // 基础2 + 建筑2
  });

  it('超过2格的友方建筑不计入', () => {
    const state = createFrostState();
    clearArea(state, [1, 2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const natiana = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-natiana', card: makeNatiana('test-natiana'), owner: '0',
    });

    // 距离3的建筑
    placeStructure(state, { row: 1, col: 2 }, {
      cardId: 'portal-far', card: makePortal('portal-far'), owner: '0',
    });

    const strength = getEffectiveStrengthValue(natiana, state);
    expect(strength).toBe(2); // 基础2，3格外不计入
  });

  it('2格内友方活体结构也计入', () => {
    const state = createFrostState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const natiana = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-natiana', card: makeNatiana('test-natiana'), owner: '0',
    });

    placeUnit(state, { row: 3, col: 2 }, {
      cardId: 'golem-1', card: makeIceGolem('golem-1'), owner: '0',
    });

    const strength = getEffectiveStrengthValue(natiana, state);
    expect(strength).toBe(3); // 基础2 + 活体结构1
  });
});


// ============================================================================
// 缓慢 (slow) 测试
// ============================================================================

describe('寒冰魔像 - 缓慢 (slow)', () => {
  it('缓慢单位只能移动1格', () => {
    const state = createFrostState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-golem', card: makeIceGolem('test-golem'), owner: '0',
    });

    // 1格移动应该可以
    expect(canMoveToEnhanced(state, { row: 4, col: 2 }, { row: 4, col: 3 })).toBe(true);
    // 2格移动应该不行（基础2 - 缓慢1 = 1格）
    expect(canMoveToEnhanced(state, { row: 4, col: 2 }, { row: 4, col: 4 })).toBe(false);
  });

  it('缓慢单位可以移动到相邻空格', () => {
    const state = createFrostState();
    clearArea(state, [3, 4, 5], [1, 2, 3]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-golem', card: makeIceGolem('test-golem'), owner: '0',
    });

    // 上下左右1格都可以
    expect(canMoveToEnhanced(state, { row: 4, col: 2 }, { row: 3, col: 2 })).toBe(true);
    expect(canMoveToEnhanced(state, { row: 4, col: 2 }, { row: 4, col: 1 })).toBe(true);
    expect(canMoveToEnhanced(state, { row: 4, col: 2 }, { row: 4, col: 3 })).toBe(true);
  });
});

// ============================================================================
// 结构变换 (structure_shift) 测试
// ============================================================================

describe('丝瓦拉 - 结构变换 (structure_shift)', () => {
  it('推拉3格内友方建筑1格', () => {
    const state = createFrostState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const summoner = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-summoner', card: makeFrostSummoner('test-summoner'), owner: '0',
    });

    placeStructure(state, { row: 4, col: 4 }, {
      cardId: 'portal-1', card: makePortal('portal-1'), owner: '0',
    });

    state.phase = 'move';
    state.currentPlayer = '0';

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'structure_shift',
      sourceUnitId: summoner.instanceId,
      targetPosition: { row: 4, col: 4 },
      newPosition: { row: 4, col: 5 },
    });

    // 建筑应该被推到新位置
    const pushEvents = events.filter(e => e.type === SW_EVENTS.UNIT_PUSHED);
    expect(pushEvents.length).toBe(1);
    expect(newState.board[4][4].structure).toBeUndefined();
    expect(newState.board[4][5].structure).toBeDefined();
    expect(newState.board[4][5].structure?.cardId).toBe('portal-1');
  });

  it('超过3格的建筑验证拒绝', () => {
    const state = createFrostState();
    clearArea(state, [1, 2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const summoner = placeUnit(state, { row: 4, col: 0 }, {
      cardId: 'test-summoner', card: makeFrostSummoner('test-summoner'), owner: '0',
    });

    placeStructure(state, { row: 4, col: 4 }, {
      cardId: 'portal-far', card: makePortal('portal-far'), owner: '0',
    });

    state.phase = 'move';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'structure_shift',
        sourceUnitId: summoner.instanceId,
        targetPosition: { row: 4, col: 4 },
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('3格');
  });

  it('非移动阶段验证拒绝', () => {
    const state = createFrostState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const summoner = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-summoner', card: makeFrostSummoner('test-summoner'), owner: '0',
    });

    placeStructure(state, { row: 4, col: 3 }, {
      cardId: 'portal-1', card: makePortal('portal-1'), owner: '0',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'structure_shift',
        sourceUnitId: summoner.instanceId,
        targetPosition: { row: 4, col: 3 },
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('移动阶段');
  });

  it('敌方建筑验证拒绝', () => {
    const state = createFrostState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const summoner = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-summoner', card: makeFrostSummoner('test-summoner'), owner: '0',
    });

    placeStructure(state, { row: 4, col: 3 }, {
      cardId: 'enemy-portal', card: makePortal('enemy-portal'), owner: '1',
    });

    state.phase = 'move';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'structure_shift',
        sourceUnitId: summoner.instanceId,
        targetPosition: { row: 4, col: 3 },
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('友方建筑');
  });
});


// ============================================================================
// 冰霜战斧 (frost_axe) 测试
// ============================================================================

describe('霜刃卫 - 冰霜战斧 (frost_axe)', () => {
  it('同 cardId 的不同实例可作为附加目标（按 instanceId 判定自身）', () => {
    const state = createFrostState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const source = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'shared-frost-card', card: makeFrostAxeBearer('shared-frost-source'), owner: '0', boosts: 2,
    });

    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'shared-frost-card', card: makeBearCavalry('shared-frost-target'), owner: '0',
    });

    state.phase = 'move';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const validateResult = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'frost_axe',
        sourceUnitId: source.instanceId,
        choice: 'attach',
        targetPosition: { row: 4, col: 3 },
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(validateResult.valid).toBe(true);

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'frost_axe',
      sourceUnitId: source.instanceId,
      choice: 'attach',
      targetPosition: { row: 4, col: 3 },
    });

    const attachEvents = events.filter(e => e.type === SW_EVENTS.UNIT_ATTACHED);
    expect(attachEvents.length).toBe(1);
    expect(newState.board[4][2].unit).toBeUndefined();
    expect(newState.board[4][3].unit?.attachedUnits?.some(u => u.cardId === source.instanceId)).toBe(true);
  });
});


// ============================================================================
// 寒冰碎屑 (ice_shards) 测试
// ============================================================================

describe('贾穆德 - 寒冰碎屑 (ice_shards)', () => {
  it('消耗充能对建筑相邻敌方造成1伤', () => {
    const state = createFrostState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    // 贾穆德有1点充能
    const jarmund = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-jarmund', card: makeJarmund('test-jarmund'), owner: '0',
      boosts: 1,
    });

    // 友方建筑
    placeStructure(state, { row: 3, col: 3 }, {
      cardId: 'portal-1', card: makePortal('portal-1'), owner: '0',
    });

    // 建筑相邻的敌方单位
    placeUnit(state, { row: 3, col: 4 }, {
      cardId: 'enemy-1', card: makeEnemy('enemy-1'), owner: '1',
    });
    placeUnit(state, { row: 2, col: 3 }, {
      cardId: 'enemy-2', card: makeEnemy('enemy-2'), owner: '1',
    });

    state.phase = 'build';
    state.currentPlayer = '0';

    const { newState, events } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'ice_shards',
      sourceUnitId: jarmund.instanceId,
    });

    // 充能应该被消耗
    expect(newState.board[4][2].unit?.boosts).toBe(0);
    // 两个敌方单位各受1伤
    const damageEvents = events.filter(e => e.type === SW_EVENTS.UNIT_DAMAGED);
    expect(damageEvents.length).toBe(2);
    expect(newState.board[3][4].unit?.damage).toBe(1);
    expect(newState.board[2][3].unit?.damage).toBe(1);
  });

  it('没有充能时验证拒绝', () => {
    const state = createFrostState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const jarmund = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-jarmund', card: makeJarmund('test-jarmund'), owner: '0',
      boosts: 0,
    });

    state.phase = 'build';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: { abilityId: 'ice_shards', sourceUnitId: jarmund.instanceId },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('充能');
  });

  it('友方单位不受伤害', () => {
    const state = createFrostState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const jarmund = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-jarmund', card: makeJarmund('test-jarmund'), owner: '0',
      boosts: 1,
    });

    placeStructure(state, { row: 3, col: 3 }, {
      cardId: 'portal-1', card: makePortal('portal-1'), owner: '0',
    });

    // 建筑相邻的友方单位（不应受伤）
    placeUnit(state, { row: 3, col: 4 }, {
      cardId: 'ally-1', card: makeFrostMage('ally-1'), owner: '0',
    });

    state.phase = 'build';
    state.currentPlayer = '0';

    const { newState, events } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'ice_shards',
      sourceUnitId: jarmund.instanceId,
    });

    // 友方单位不受伤
    const damageEvents = events.filter(e => e.type === SW_EVENTS.UNIT_DAMAGED);
    expect(damageEvents.length).toBe(0);
    expect(newState.board[3][4].unit?.damage).toBe(0);
  });

  it('活体结构（寒冰魔像）相邻的敌方也受伤', () => {
    const state = createFrostState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const jarmund = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-jarmund', card: makeJarmund('test-jarmund'), owner: '0',
      boosts: 1,
    });

    // 友方活体结构（寒冰魔像）
    placeUnit(state, { row: 3, col: 3 }, {
      cardId: 'golem-1', card: makeIceGolem('golem-1'), owner: '0',
    });

    // 魔像相邻的敌方单位
    placeUnit(state, { row: 3, col: 4 }, {
      cardId: 'enemy-1', card: makeEnemy('enemy-1'), owner: '1',
    });

    state.phase = 'build';
    state.currentPlayer = '0';

    const { newState, events } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'ice_shards',
      sourceUnitId: jarmund.instanceId,
    });

    const damageEvents = events.filter(e => e.type === SW_EVENTS.UNIT_DAMAGED);
    expect(damageEvents.length).toBe(1);
    expect(newState.board[3][4].unit?.damage).toBe(1);
  });

  it('同一敌方单位相邻多个建筑只受1次伤害', () => {
    const state = createFrostState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const jarmund = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-jarmund', card: makeJarmund('test-jarmund'), owner: '0',
      boosts: 1,
    });

    // 两个友方建筑
    placeStructure(state, { row: 3, col: 3 }, {
      cardId: 'portal-1', card: makePortal('portal-1'), owner: '0',
    });
    placeStructure(state, { row: 3, col: 5 }, {
      cardId: 'portal-2', card: makePortal('portal-2'), owner: '0',
    });

    // 敌方单位同时相邻两个建筑
    placeUnit(state, { row: 3, col: 4 }, {
      cardId: 'enemy-1', card: makeEnemy('enemy-1'), owner: '1',
    });

    state.phase = 'build';
    state.currentPlayer = '0';

    const { newState, events } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'ice_shards',
      sourceUnitId: jarmund.instanceId,
    });

    // 去重：只受1次伤害
    const damageEvents = events.filter(e => e.type === SW_EVENTS.UNIT_DAMAGED);
    expect(damageEvents.length).toBe(1);
    expect(newState.board[3][4].unit?.damage).toBe(1);
  });
});

// ============================================================================
// 威势 (imposing) 测试
// ============================================================================

describe('贾穆德 - 威势 (imposing)', () => {
  it('攻击后获得充能', () => {
    const state = createFrostState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-jarmund', card: makeJarmund('test-jarmund'), owner: '0',
      boosts: 0,
    });

    // 射程内的敌方单位
    placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'enemy-1', card: makeEnemy('enemy-1'), owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const { events } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: { row: 4, col: 2 },
      target: { row: 4, col: 4 },
    });

    // 应该触发 imposing 技能
    const abilityEvents = events.filter(e =>
      e.type === SW_EVENTS.ABILITY_TRIGGERED
      && (e.payload as Record<string, unknown>).abilityId === 'imposing'
    );
    expect(abilityEvents.length).toBe(1);

    // 应该有充能事件
    const chargeEvents = events.filter(e => e.type === SW_EVENTS.UNIT_CHARGED);
    expect(chargeEvents.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// 事件卡测试
// ============================================================================

describe('极地矮人事件卡', () => {
  describe('寒冰修补 (frost-ice-repair)', () => {
    it('每个友方建筑移除2点伤害', () => {
      const state = createFrostState();
      clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

      // 两个受伤的友方建筑
      placeStructure(state, { row: 3, col: 2 }, {
        cardId: 'portal-1', card: makePortal('portal-1'), owner: '0',
        damage: 3,
      });
      placeStructure(state, { row: 5, col: 4 }, {
        cardId: 'parapet-1', card: makeParapet('parapet-1'), owner: '0',
        damage: 1,
      });

      // 敌方建筑（不应被治疗）
      placeStructure(state, { row: 6, col: 3 }, {
        cardId: 'enemy-struct', card: makePortal('enemy-struct'), owner: '1',
        damage: 4,
      });

      state.phase = 'move';
      state.currentPlayer = '0';

      addEventToHand(state, '0', 'frost-ice-repair-0', {
        name: '寒冰修补',
        playPhase: 'move',
        effect: '从每个友方建筑上移除2点伤害。',
      });

      const { newState, events } = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
        cardId: 'frost-ice-repair-0',
      });

      const healEvents = events.filter(e => e.type === SW_EVENTS.STRUCTURE_HEALED);
      expect(healEvents.length).toBe(2); // 两个友方建筑

      // portal-1: 3伤 - 2 = 1伤
      expect(newState.board[3][2].structure?.damage).toBe(1);
      // parapet-1: 1伤 - 2 = 0伤（不会低于0）
      expect(newState.board[5][4].structure?.damage).toBe(0);
      // 敌方建筑不受影响
      expect(newState.board[6][3].structure?.damage).toBe(4);
    });
  });

  describe('冰川位移 (frost-glacial-shift)', () => {
    it('推拉召唤师3格内友方建筑1-2格', () => {
      const state = createFrostState();
      clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

      // 放置召唤师
      placeUnit(state, { row: 4, col: 2 }, {
        cardId: 'test-summoner', card: makeFrostSummoner('test-summoner'), owner: '0',
      });

      // 友方建筑（3格内）
      placeStructure(state, { row: 4, col: 4 }, {
        cardId: 'portal-1', card: makePortal('portal-1'), owner: '0',
      });

      state.phase = 'build';
      state.currentPlayer = '0';

      addEventToHand(state, '0', 'frost-glacial-shift-0', {
        name: '冰川位移',
        playPhase: 'build',
        effect: '指定你的召唤师3个区格以内至多三个友方建筑为目标。将每个目标推拉1至2个区格。',
      });

      const { newState, events } = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
        cardId: 'frost-glacial-shift-0',
        shiftDirections: [
          { position: { row: 4, col: 4 }, newPosition: { row: 4, col: 5 } },
        ],
      });

      const pushEvents = events.filter(e => e.type === SW_EVENTS.UNIT_PUSHED);
      expect(pushEvents.length).toBe(1);
      expect(newState.board[4][4].structure).toBeUndefined();
      expect(newState.board[4][5].structure).toBeDefined();
      expect(newState.board[4][5].structure?.cardId).toBe('portal-1');
    });
  });

  describe('寒冰冲撞 (frost-ice-ram)', () => {
    it('作为主动事件放入主动区域', () => {
      const state = createFrostState();
      state.phase = 'summon';
      state.currentPlayer = '0';

      addEventToHand(state, '0', 'frost-ice-ram-0', {
        name: '寒冰冲撞',
        playPhase: 'summon',
        effect: '持续：在一个友方建筑移动或被推拉之后，你可以指定其相邻的一个单位为目标。对目标造成1点伤害。你可以将目标推拉1个区格。',
        isActive: true,
      });

      const { newState, events } = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
        cardId: 'frost-ice-ram-0',
      });

      const eventPlayedEvents = events.filter(e => e.type === SW_EVENTS.EVENT_PLAYED);
      expect(eventPlayedEvents.length).toBe(1);
      expect((eventPlayedEvents[0].payload as Record<string, unknown>).isActive).toBe(true);

      // 应该在主动事件区
      expect(newState.players['0'].activeEvents.some(e => e.id === 'frost-ice-ram-0')).toBe(true);
      // 不应在手牌中
      expect(newState.players['0'].hand.some(c => c.id === 'frost-ice-ram-0')).toBe(false);
    });
  });
});

// ============================================================================
// v2 审查补充测试：跨机制交叉场景
// ============================================================================

describe('冲锋 × 缓慢 交互 (CI-2)', () => {
  it('冲锋路径不受缓慢影响（1-4格直线）', () => {
    const state = createFrostState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    // 创建同时拥有 charge 和 slow 的测试单位
    const chargeSlowUnit: UnitCard = {
      id: 'charge-slow-unit', cardType: 'unit', name: '冲锋缓慢测试',
      unitClass: 'common', faction: 'frost', strength: 3, life: 5, cost: 2,
      attackType: 'melee', attackRange: 1,
      abilities: ['charge', 'slow'], deckSymbols: [],
    };

    placeUnit(state, { row: 4, col: 1 }, {
      cardId: 'cs-unit', card: chargeSlowUnit, owner: '0',
    });

    // 放置敌方单位作为冲锋目标（直线4格）
    placeUnit(state, { row: 4, col: 5 }, {
      cardId: 'enemy-target', card: makeEnemy('enemy-target'), owner: '1',
    });

    // 冲锋路径（直线4格）应该可以 — 冲锋独立于正常移动
    expect(canMoveToEnhanced(state, { row: 4, col: 1 }, { row: 4, col: 4 })).toBe(true);
    // 冲锋路径（直线3格）也可以
    expect(canMoveToEnhanced(state, { row: 4, col: 1 }, { row: 4, col: 3 })).toBe(true);
  });

  it('正常移动受缓慢影响（非直线路径时体现）', () => {
    const state = createFrostState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const chargeSlowUnit: UnitCard = {
      id: 'charge-slow-unit', cardType: 'unit', name: '冲锋缓慢测试',
      unitClass: 'common', faction: 'frost', strength: 3, life: 5, cost: 2,
      attackType: 'melee', attackRange: 1,
      abilities: ['charge', 'slow'], deckSymbols: [],
    };

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'cs-unit', card: chargeSlowUnit, owner: '0',
    });

    // 直线2格可以（冲锋路径允许）
    expect(canMoveToEnhanced(state, { row: 4, col: 2 }, { row: 4, col: 4 })).toBe(true);
    // 对角2格不行（非直线，走正常移动路径，被缓慢减到1格）
    expect(canMoveToEnhanced(state, { row: 4, col: 2 }, { row: 3, col: 3 })).toBe(false);
    // 正常移动1格可以
    expect(canMoveToEnhanced(state, { row: 4, col: 2 }, { row: 4, col: 3 })).toBe(true);
  });
});

describe('结构变换 × 活体结构 交互 (CI-3)', () => {
  it('结构变换可以推拉友方活体结构单位（寒冰魔像）', () => {
    const state = createFrostState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    // 丝瓦拉（结构变换）— 显式设置 instanceId 以匹配 sourceUnitId
    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-summoner', instanceId: 'test-summoner',
      card: makeFrostSummoner('test-summoner'), owner: '0',
    });

    // 寒冰魔像（活体结构）在3格内
    placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'test-golem', instanceId: 'test-golem',
      card: makeIceGolem('test-golem'), owner: '0',
    });

    state.phase = 'move';
    state.currentPlayer = '0';

    const { events } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'structure_shift',
      sourceUnitId: 'test-summoner',
      targetPosition: { row: 4, col: 4 },
      newPosition: { row: 4, col: 5 },
    });

    // 应该产生 UNIT_PUSHED 事件
    const pushEvents = events.filter(e => e.type === SW_EVENTS.UNIT_PUSHED);
    expect(pushEvents.length).toBe(1);
    expect((pushEvents[0].payload as Record<string, unknown>).targetPosition).toEqual({ row: 4, col: 4 });
    expect((pushEvents[0].payload as Record<string, unknown>).newPosition).toEqual({ row: 4, col: 5 });
  });

  it('结构变换不能推拉敌方活体结构单位', () => {
    const state = createFrostState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-summoner', instanceId: 'test-summoner',
      card: makeFrostSummoner('test-summoner'), owner: '0',
    });

    // 敌方寒冰魔像
    placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'enemy-golem', instanceId: 'enemy-golem',
      card: makeIceGolem('enemy-golem'), owner: '1',
    });

    state.phase = 'move';
    state.currentPlayer = '0';

    const { events } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'structure_shift',
      sourceUnitId: 'test-summoner',
      targetPosition: { row: 4, col: 4 },
      newPosition: { row: 4, col: 5 },
    });

    // 不应该产生 UNIT_PUSHED 事件（敌方建筑不可推拉）
    const pushEvents = events.filter(e => e.type === SW_EVENTS.UNIT_PUSHED);
    expect(pushEvents.length).toBe(0);
  });
});

// ============================================================================
// v2 审查补充测试：CI-1 践踏致死触发 onDeath
// ============================================================================

describe('践踏致死 × 献祭 交互 (CI-1)', () => {
  it('践踏致死应触发 onDeath 能力（献祭对相邻敌方造成1伤害）', () => {
    const state = createFrostState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    // 玩家0 的熊骑兵（践踏）在 (4,0)
    const bearCard = makeBearCavalry('bear-1');
    placeUnit(state, { row: 4, col: 0 }, {
      cardId: 'bear-1', card: bearCard, owner: '0',
    });

    // 玩家1 的地狱火教徒（献祭：onDeath 对相邻敌方造成1伤害）在 (4,1)，生命1
    const cultistCard: UnitCard = {
      id: 'cultist-1', cardType: 'unit', name: '地狱火教徒',
      unitClass: 'common', faction: 'necromancer',
      strength: 1, life: 1, cost: 1,
      attackType: 'melee', attackRange: 1,
      abilities: ['sacrifice'], deckSymbols: [],
    };
    placeUnit(state, { row: 4, col: 1 }, {
      cardId: 'cultist-1', card: cultistCard, owner: '1',
    });

    // 玩家1 的另一个单位在 (4,2)（献祭不应伤害友方）
    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'ally-1', card: makeEnemy('ally-1', { life: 5 }), owner: '1',
    });

    state.phase = 'move';
    state.currentPlayer = '0';

    // 熊骑兵从 (4,0) 移动到 (4,2) — 穿过 (4,1) 的地狱火教徒
    // 但 (4,2) 有单位，所以不能移动到那里。改为移动到空格。
    // 重新布局：熊骑兵 (4,0)，教徒 (4,1)，目标空格 (4,2)，旁观者 (3,1)
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 0 }, {
      cardId: 'bear-1', card: bearCard, owner: '0',
    });
    placeUnit(state, { row: 4, col: 1 }, {
      cardId: 'cultist-1', card: cultistCard, owner: '1',
    });
    // 旁观者在 (3,1)，与教徒相邻，是玩家0的单位（教徒的敌方）
    const bystander: UnitCard = {
      id: 'bystander', cardType: 'unit', name: '旁观者',
      unitClass: 'common', faction: 'frost',
      strength: 1, life: 5, cost: 1,
      attackType: 'melee', attackRange: 1,
      abilities: [], deckSymbols: [],
    };
    placeUnit(state, { row: 3, col: 1 }, {
      cardId: 'bystander', card: bystander, owner: '0',
    });

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.MOVE_UNIT, {
      from: { row: 4, col: 0 },
      to: { row: 4, col: 2 },
    });

    // 1. 应该有践踏伤害事件
    const trampleDamage = events.filter(e =>
      e.type === SW_EVENTS.UNIT_DAMAGED
      && (e.payload as Record<string, unknown>).reason === 'trample'
    );
    expect(trampleDamage.length).toBe(1);

    // 2. 教徒应该被消灭（生命1，受到1伤害）
    const destroyed = events.filter(e =>
      e.type === SW_EVENTS.UNIT_DESTROYED
      && (e.payload as Record<string, unknown>).cardId === 'cultist-1'
    );
    expect(destroyed.length).toBe(1);

    // 3. 献祭应该触发 — 对相邻敌方（旁观者在 (3,1)）造成1伤害
    const sacrificeDamage = events.filter(e =>
      e.type === SW_EVENTS.UNIT_DAMAGED
      && (e.payload as Record<string, unknown>).reason !== 'trample'
      && (e.payload as Record<string, unknown>).position !== undefined
      && ((e.payload as Record<string, unknown>).position as CellCoord).row === 3
      && ((e.payload as Record<string, unknown>).position as CellCoord).col === 1
    );
    expect(sacrificeDamage.length).toBeGreaterThanOrEqual(1);

    // 4. 旁观者应该受到1伤害
    const bystanderUnit = newState.board[3][1].unit;
    expect(bystanderUnit).toBeDefined();
    expect(bystanderUnit!.damage).toBe(1);
  });
});
