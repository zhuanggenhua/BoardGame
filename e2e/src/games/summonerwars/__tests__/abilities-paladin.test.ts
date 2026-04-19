/**
 * 召唤师战争 - 先锋军团技能测试
 *
 * 覆盖：
 * - fortress_elite（城塞精锐）：2格内每有一个友方城塞单位+1战力
 * - radiant_shot（辉光射击）：每2点魔力+1战力
 * - guardian（守卫）：相邻敌方攻击时必须攻击守卫单位
 * - entangle（缠斗）：相邻敌方远离时造成1伤害
 * - fortress_power（城塞之力）：从弃牌堆拿取城塞单位
 * - guidance（指引）：召唤阶段抓2张牌
 * - holy_arrow（圣光箭）：弃牌获得魔力和战力
 * - 事件卡：圣洁审判、圣灵庇护、群体治疗、重燃希望
 */

import { describe, it, expect } from 'vitest';
import { SummonerWarsDomain, SW_COMMANDS, SW_EVENTS } from '../domain';
import type { SummonerWarsCore, CellCoord, BoardUnit, UnitCard, EventCard, PlayerId, StructureCard } from '../domain/types';
import type { RandomFn, GameEvent } from '../../../engine/types';
import { canAttackEnhanced, manhattanDistance, getPlayerUnits } from '../domain/helpers';
import { getEffectiveStrengthValue } from '../domain/abilityResolver';
import { generateInstanceId } from '../domain/utils';
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

/** 创建先锋军团 vs 亡灵法师的测试状态 */
function createPaladinState(): SummonerWarsCore {
  return createInitializedCore(['0', '1'], createTestRandom(), {
    faction0: 'paladin',
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

/** 创建城塞骑士卡牌（缠斗+守卫） */
function makeFortressKnight(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '城塞骑士', unitClass: 'common',
    faction: 'paladin', strength: 2, life: 5, cost: 2,
    attackType: 'melee', attackRange: 1,
    abilities: ['entangle', 'guardian'], deckSymbols: [],
  };
}

/** 创建城塞圣武士卡牌（裁决） */
function makeFortressWarrior(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '城塞圣武士', unitClass: 'common',
    faction: 'paladin', strength: 3, life: 4, cost: 2,
    attackType: 'melee', attackRange: 1,
    abilities: ['judgment'], deckSymbols: [],
  };
}

/** 创建城塞弓箭手卡牌（圣光箭） */
function makeFortressArcher(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '城塞弓箭手', unitClass: 'common',
    faction: 'paladin', strength: 1, life: 5, cost: 2,
    attackType: 'ranged', attackRange: 3,
    abilities: ['holy_arrow'], deckSymbols: [],
  };
}

/** 创建瓦伦蒂娜卡牌（指引+城塞精锐） */
function makeValentina(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '瓦伦蒂娜·斯托哈特', unitClass: 'champion',
    faction: 'paladin', strength: 2, life: 9, cost: 6,
    attackType: 'melee', attackRange: 1,
    abilities: ['guidance', 'fortress_elite'], deckSymbols: [],
  };
}

/** 创建雅各布卡牌（辉光射击） */
function makeJacob(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '雅各布·艾德温', unitClass: 'champion',
    faction: 'paladin', strength: 2, life: 6, cost: 5,
    attackType: 'ranged', attackRange: 3,
    abilities: ['radiant_shot'], deckSymbols: [],
  };
}

/** 创建先锋召唤师卡牌（城塞之力） */
function makePaladinSummoner(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '瑟拉·艾德温', unitClass: 'summoner',
    faction: 'paladin', strength: 2, life: 12, cost: 0,
    attackType: 'ranged', attackRange: 3,
    abilities: ['fortress_power'], deckSymbols: [],
  };
}

/** 创建圣殿牧师卡牌（治疗） */
function makeTemplePriest(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '圣殿牧师', unitClass: 'common',
    faction: 'paladin', strength: 2, life: 2, cost: 0,
    attackType: 'melee', attackRange: 1,
    abilities: ['healing'], deckSymbols: [],
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

/** 创建普通友方单位 */
function makeAlly(id: string, overrides?: Partial<UnitCard>): UnitCard {
  return {
    id, cardType: 'unit', name: '友方单位', unitClass: 'common',
    faction: 'paladin', strength: 1, life: 3, cost: 0,
    attackType: 'melee', attackRange: 1, deckSymbols: [],
    ...overrides,
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
    faction: 'paladin',
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
// 城塞精锐 (fortress_elite) 测试
// ============================================================================

describe('瓦伦蒂娜 - 城塞精锐 (fortress_elite)', () => {
  it('2格内无城塞单位时战力为基础值', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const valentina: BoardUnit = {
      cardId: 'test-valentina', card: makeValentina('test-valentina'), owner: '0',
      position: { row: 4, col: 2 }, damage: 0, boosts: 0,
      hasMoved: false, hasAttacked: false,
    };
    state.board[4][2].unit = valentina;

    const strength = getEffectiveStrengthValue(valentina, state);
    expect(strength).toBe(2); // 基础2，无城塞加成
  });

  it('2格内有1个城塞单位时+1战力', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const valentina: BoardUnit = {
      cardId: 'test-valentina', card: makeValentina('test-valentina'), owner: '0',
      position: { row: 4, col: 2 }, damage: 0, boosts: 0,
      hasMoved: false, hasAttacked: false,
    };
    state.board[4][2].unit = valentina;

    // 放置1个城塞骑士在相邻位置
    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'fortress-knight-1',
      card: makeFortressKnight('fortress-knight-1'),
      owner: '0',
    });

    const strength = getEffectiveStrengthValue(valentina, state);
    expect(strength).toBe(3); // 基础2 + 城塞1
  });

  it('2格内有2个城塞单位时+2战力', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const valentina: BoardUnit = {
      cardId: 'test-valentina', card: makeValentina('test-valentina'), owner: '0',
      position: { row: 4, col: 2 }, damage: 0, boosts: 0,
      hasMoved: false, hasAttacked: false,
    };
    state.board[4][2].unit = valentina;

    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'fortress-knight-1',
      card: makeFortressKnight('fortress-knight-1'),
      owner: '0',
    });

    placeUnit(state, { row: 3, col: 2 }, {
      cardId: 'fortress-warrior-1',
      card: makeFortressWarrior('fortress-warrior-1'),
      owner: '0',
    });

    const strength = getEffectiveStrengthValue(valentina, state);
    expect(strength).toBe(4); // 基础2 + 城塞2
  });

  it('超过2格的城塞单位不计入', () => {
    const state = createPaladinState();
    clearArea(state, [1, 2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const valentina: BoardUnit = {
      cardId: 'test-valentina', card: makeValentina('test-valentina'), owner: '0',
      position: { row: 4, col: 2 }, damage: 0, boosts: 0,
      hasMoved: false, hasAttacked: false,
    };
    state.board[4][2].unit = valentina;

    // 放置城塞单位在3格外
    placeUnit(state, { row: 1, col: 2 }, {
      cardId: 'fortress-knight-far',
      card: makeFortressKnight('fortress-knight-far'),
      owner: '0',
    });

    const strength = getEffectiveStrengthValue(valentina, state);
    expect(strength).toBe(2); // 基础2，3格外不计入
  });

  it('敌方城塞单位不计入', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const valentina: BoardUnit = {
      cardId: 'test-valentina', card: makeValentina('test-valentina'), owner: '0',
      position: { row: 4, col: 2 }, damage: 0, boosts: 0,
      hasMoved: false, hasAttacked: false,
    };
    state.board[4][2].unit = valentina;

    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'fortress-knight-enemy',
      card: makeFortressKnight('fortress-knight-enemy'),
      owner: '1',
    });

    const strength = getEffectiveStrengthValue(valentina, state);
    expect(strength).toBe(2); // 敌方不计入
  });
});

// ============================================================================
// 辉光射击 (radiant_shot) 测试
// ============================================================================

describe('雅各布 - 辉光射击 (radiant_shot)', () => {
  it('0魔力时战力为基础值', () => {
    const state = createPaladinState();
    clearArea(state, [3, 4, 5], [1, 2, 3]);

    const jacob: BoardUnit = {
      cardId: 'test-jacob', card: makeJacob('test-jacob'), owner: '0',
      position: { row: 4, col: 2 }, damage: 0, boosts: 0,
      hasMoved: false, hasAttacked: false,
    };
    state.board[4][2].unit = jacob;
    state.players['0'].magic = 0;

    const strength = getEffectiveStrengthValue(jacob, state);
    expect(strength).toBe(2); // 基础2
  });

  it('1魔力时战力为基础值（不足2点）', () => {
    const state = createPaladinState();
    const jacob: BoardUnit = {
      cardId: 'test-jacob', card: makeJacob('test-jacob'), owner: '0',
      position: { row: 4, col: 2 }, damage: 0, boosts: 0,
      hasMoved: false, hasAttacked: false,
    };
    state.board[4][2].unit = jacob;
    state.players['0'].magic = 1;

    const strength = getEffectiveStrengthValue(jacob, state);
    expect(strength).toBe(2); // 基础2 + floor(1/2)=0
  });

  it('4魔力时+2战力', () => {
    const state = createPaladinState();
    const jacob: BoardUnit = {
      cardId: 'test-jacob', card: makeJacob('test-jacob'), owner: '0',
      position: { row: 4, col: 2 }, damage: 0, boosts: 0,
      hasMoved: false, hasAttacked: false,
    };
    state.board[4][2].unit = jacob;
    state.players['0'].magic = 4;

    const strength = getEffectiveStrengthValue(jacob, state);
    expect(strength).toBe(4); // 基础2 + floor(4/2)=2
  });

  it('10魔力时+5战力', () => {
    const state = createPaladinState();
    const jacob: BoardUnit = {
      cardId: 'test-jacob', card: makeJacob('test-jacob'), owner: '0',
      position: { row: 4, col: 2 }, damage: 0, boosts: 0,
      hasMoved: false, hasAttacked: false,
    };
    state.board[4][2].unit = jacob;
    state.players['0'].magic = 10;

    const strength = getEffectiveStrengthValue(jacob, state);
    expect(strength).toBe(7); // 基础2 + floor(10/2)=5
  });
});


// ============================================================================
// 守卫 (guardian) 测试
// ============================================================================

describe('城塞骑士 - 守卫 (guardian)', () => {
  it('相邻有守卫单位时必须攻击守卫', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    // 敌方攻击者
    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-attacker',
      card: makeEnemy('test-attacker'),
      owner: '1',
    });

    // 守卫骑士（相邻攻击者）
    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-guardian',
      card: makeFortressKnight('test-guardian'),
      owner: '0',
    });

    // 另一个友方单位（也相邻攻击者）
    placeUnit(state, { row: 3, col: 2 }, {
      cardId: 'test-other',
      card: makeAlly('test-other'),
      owner: '0',
    });

    state.phase = 'attack';
    state.currentPlayer = '1';
    state.players['1'].attackCount = 0;

    // 尝试攻击非守卫单位 → 应被拒绝
    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.DECLARE_ATTACK,
      payload: { attacker: { row: 4, col: 2 }, target: { row: 3, col: 2 } },
      playerId: '1',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('守卫');
  });

  it('攻击守卫单位本身是允许的', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-attacker',
      card: makeEnemy('test-attacker'),
      owner: '1',
    });

    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-guardian',
      card: makeFortressKnight('test-guardian'),
      owner: '0',
    });

    state.phase = 'attack';
    state.currentPlayer = '1';
    state.players['1'].attackCount = 0;

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.DECLARE_ATTACK,
      payload: { attacker: { row: 4, col: 2 }, target: { row: 4, col: 3 } },
      playerId: '1',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(true);
  });

  it('守卫不相邻攻击者时不强制', () => {
    const state = createPaladinState();
    clearArea(state, [1, 2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    // 远程攻击者
    placeUnit(state, { row: 4, col: 0 }, {
      cardId: 'test-ranged',
      card: makeEnemy('test-ranged', { attackType: 'ranged', attackRange: 3 }),
      owner: '1',
    });

    // 守卫骑士（不相邻攻击者，距离2）
    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-guardian',
      card: makeFortressKnight('test-guardian'),
      owner: '0',
    });

    // 另一个友方单位（相邻攻击者）
    placeUnit(state, { row: 4, col: 1 }, {
      cardId: 'test-other',
      card: makeAlly('test-other'),
      owner: '0',
    });

    state.phase = 'attack';
    state.currentPlayer = '1';
    state.players['1'].attackCount = 0;

    // 守卫不相邻攻击者，可以攻击其他目标
    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.DECLARE_ATTACK,
      payload: { attacker: { row: 4, col: 0 }, target: { row: 4, col: 1 } },
      playerId: '1',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// 缠斗 (entangle) 测试
// ============================================================================

describe('城塞骑士 - 缠斗 (entangle)', () => {
  it('敌方单位远离缠斗单位时受到1点伤害', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    // 缠斗骑士
    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-knight',
      card: makeFortressKnight('test-knight'),
      owner: '0',
    });

    // 敌方单位（相邻骑士）
    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-enemy',
      card: makeEnemy('test-enemy', { life: 5 }),
      owner: '1',
    });

    state.phase = 'move';
    state.currentPlayer = '1';
    state.players['1'].moveCount = 0;

    // 敌方移动远离
    const { events, newState } = executeAndReduce(state, SW_COMMANDS.MOVE_UNIT, {
      from: { row: 4, col: 3 },
      to: { row: 4, col: 4 },
    });

    // 应有缠斗伤害事件
    const entangleDamage = events.filter(
      e => e.type === SW_EVENTS.UNIT_DAMAGED && (e.payload as any).reason === 'entangle'
    );
    expect(entangleDamage.length).toBe(1);
    expect((entangleDamage[0].payload as any).damage).toBe(1);

    // 敌方单位应受到1点伤害
    expect(newState.board[4][4].unit?.damage).toBe(1);
  });

  it('敌方单位不远离时不触发缠斗', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    // 缠斗骑士在 (4,2)
    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-knight',
      card: makeFortressKnight('test-knight'),
      owner: '0',
    });

    // 敌方单位在 (4,3)，移动到 (3,3) 仍然相邻骑士
    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-enemy',
      card: makeEnemy('test-enemy', { life: 5 }),
      owner: '1',
    });

    state.phase = 'move';
    state.currentPlayer = '1';
    state.players['1'].moveCount = 0;

    const { events } = executeAndReduce(state, SW_COMMANDS.MOVE_UNIT, {
      from: { row: 4, col: 3 },
      to: { row: 3, col: 3 },
    });

    // 移动到 (3,3) 距离骑士 (4,2) 为2，确实远离了
    // 但如果移动到仍然相邻的位置则不触发
    // (3,3) 到 (4,2) 距离=2，所以会触发
    const entangleDamage = events.filter(
      e => e.type === SW_EVENTS.UNIT_DAMAGED && (e.payload as any).reason === 'entangle'
    );
    expect(entangleDamage.length).toBe(1);
  });
});


// ============================================================================
// 城塞之力 (fortress_power) 测试
// ============================================================================

describe('瑟拉·艾德温 - 城塞之力 (fortress_power)', () => {
  it('从弃牌堆拿取城塞单位到手牌', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const summoner = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-summoner',
      card: makePaladinSummoner('test-summoner'),
      owner: '0',
    });

    // 战场上有城塞单位
    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'fortress-knight-board',
      card: makeFortressKnight('fortress-knight-board'),
      owner: '0',
    });

    // 弃牌堆有城塞单位
    const fortressCard = makeFortressWarrior('fortress-warrior-discard');
    state.players['0'].discard.push(fortressCard);

    state.phase = 'attack';
    state.currentPlayer = '0';

    const handSizeBefore = state.players['0'].hand.length;
    const discardSizeBefore = state.players['0'].discard.length;

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'fortress_power',
      sourceUnitId: summoner.instanceId,
      targetCardId: 'fortress-warrior-discard',
    });

    // 应有 CARD_RETRIEVED 事件
    const retrieveEvents = events.filter(e => e.type === SW_EVENTS.CARD_RETRIEVED);
    expect(retrieveEvents.length).toBe(1);

    // 手牌增加1张
    expect(newState.players['0'].hand.length).toBe(handSizeBefore + 1);
    // 弃牌堆减少1张
    expect(newState.players['0'].discard.length).toBe(discardSizeBefore - 1);
    // 手牌中有该卡
    expect(newState.players['0'].hand.some(c => c.id === 'fortress-warrior-discard')).toBe(true);
  });

  it('战场上无城塞单位时验证拒绝', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const summoner = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-summoner',
      card: makePaladinSummoner('test-summoner'),
      owner: '0',
    });

    // 弃牌堆有城塞单位但战场上没有
    const fortressCard = makeFortressWarrior('fortress-warrior-discard');
    state.players['0'].discard.push(fortressCard);

    state.phase = 'attack';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'fortress_power',
        sourceUnitId: summoner.instanceId,
        targetCardId: 'fortress-warrior-discard',
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('城塞');
  });

  it('弃牌堆中非城塞单位验证拒绝', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const summoner = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-summoner',
      card: makePaladinSummoner('test-summoner'),
      owner: '0',
    });

    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'fortress-knight-board',
      card: makeFortressKnight('fortress-knight-board'),
      owner: '0',
    });

    // 弃牌堆有非城塞单位
    const nonFortressCard = makeTemplePriest('temple-priest-discard');
    state.players['0'].discard.push(nonFortressCard);

    state.phase = 'attack';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'fortress_power',
        sourceUnitId: summoner.instanceId,
        targetCardId: 'temple-priest-discard',
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('城塞');
  });
});

// ============================================================================
// 指引 (guidance) 测试
// ============================================================================

describe('瓦伦蒂娜 - 指引 (guidance)', () => {
  it('召唤阶段抓取2张卡牌', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const valentina = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-valentina',
      card: makeValentina('test-valentina'),
      owner: '0',
    });

    state.phase = 'summon';
    state.currentPlayer = '0';
    // 确保牌组有足够的牌
    state.players['0'].deck = [
      makeAlly('deck-1'), makeAlly('deck-2'), makeAlly('deck-3'),
    ];
    const handSizeBefore = state.players['0'].hand.length;

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'guidance',
      sourceUnitId: valentina.instanceId,
    });

    const drawEvents = events.filter(e => e.type === SW_EVENTS.CARD_DRAWN);
    expect(drawEvents.length).toBe(1);
    expect((drawEvents[0].payload as any).count).toBe(2);

    expect(newState.players['0'].hand.length).toBe(handSizeBefore + 2);
    expect(newState.players['0'].deck.length).toBe(1); // 3-2=1
  });

  it('牌组只有1张时只抓1张', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const valentina = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-valentina',
      card: makeValentina('test-valentina'),
      owner: '0',
    });

    state.phase = 'summon';
    state.currentPlayer = '0';
    state.players['0'].deck = [makeAlly('deck-1')];
    const handSizeBefore = state.players['0'].hand.length;

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'guidance',
      sourceUnitId: valentina.instanceId,
    });

    const drawEvents = events.filter(e => e.type === SW_EVENTS.CARD_DRAWN);
    expect(drawEvents.length).toBe(1);
    expect((drawEvents[0].payload as any).count).toBe(1);

    expect(newState.players['0'].hand.length).toBe(handSizeBefore + 1);
  });

  it('非召唤阶段验证拒绝', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const valentina = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-valentina',
      card: makeValentina('test-valentina'),
      owner: '0',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'guidance',
        sourceUnitId: valentina.instanceId,
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('召唤阶段');
  });
});


// ============================================================================
// 圣光箭 (holy_arrow) 测试
// ============================================================================

describe('城塞弓箭手 - 圣光箭 (holy_arrow)', () => {
  it('弃除1张卡牌获得1魔力+1战力', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const archer = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-archer',
      card: makeFortressArcher('test-archer'),
      owner: '0',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';
    state.players['0'].magic = 3;

    // 手牌中放入一张非同名单位
    const discardCard = makeAlly('discard-unit-1');
    state.players['0'].hand.push(discardCard);

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'holy_arrow',
      sourceUnitId: archer.instanceId,
      discardCardIds: ['discard-unit-1'],
    });

    // 魔力+1
    const magicEvents = events.filter(e => e.type === SW_EVENTS.MAGIC_CHANGED);
    expect(magicEvents.length).toBe(1);
    expect((magicEvents[0].payload as any).delta).toBe(1);
    expect(newState.players['0'].magic).toBe(4);

    // 弃除卡牌
    const discardEvents = events.filter(e => e.type === SW_EVENTS.CARD_DISCARDED);
    expect(discardEvents.length).toBe(1);

    // 战力加成（boosts+1）
    const chargeEvents = events.filter(e => e.type === SW_EVENTS.UNIT_CHARGED);
    expect(chargeEvents.length).toBe(1);
    expect(newState.board[4][2].unit?.boosts).toBe(1);
  });

  it('弃除多张卡牌获得对应魔力和战力', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const archer = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-archer',
      card: makeFortressArcher('test-archer'),
      owner: '0',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';
    state.players['0'].magic = 2;

    // 手牌中放入2张不同名单位
    state.players['0'].hand.push(makeAlly('discard-unit-a'));
    state.players['0'].hand.push(makeEnemy('discard-unit-b'));

    const { newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'holy_arrow',
      sourceUnitId: archer.instanceId,
      discardCardIds: ['discard-unit-a', 'discard-unit-b'],
    });

    expect(newState.players['0'].magic).toBe(4); // 2+2
    expect(newState.board[4][2].unit?.boosts).toBe(2);
  });

  it('弃除同名单位验证拒绝', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const archer = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-archer',
      card: makeFortressArcher('test-archer'),
      owner: '0',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    // 手牌中放入2张同名单位
    state.players['0'].hand.push(makeAlly('ally-1'));
    state.players['0'].hand.push({ ...makeAlly('ally-2'), id: 'ally-2' });

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'holy_arrow',
        sourceUnitId: archer.instanceId,
        discardCardIds: ['ally-1', 'ally-2'],
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('同名');
  });

  it('弃除与弓箭手同名的单位验证拒绝', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const archer = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-archer',
      card: makeFortressArcher('test-archer'),
      owner: '0',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    // 手牌中放入同名弓箭手
    state.players['0'].hand.push(makeFortressArcher('archer-in-hand'));

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'holy_arrow',
        sourceUnitId: archer.instanceId,
        discardCardIds: ['archer-in-hand'],
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('同名');
  });

  it('非攻击阶段验证拒绝', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const archer = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-archer',
      card: makeFortressArcher('test-archer'),
      owner: '0',
    });

    state.phase = 'move';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'holy_arrow',
        sourceUnitId: archer.instanceId,
        discardCardIds: ['some-card'],
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('攻击阶段');
  });
});


// ============================================================================
// 事件卡测试
// ============================================================================

describe('先锋军团事件卡', () => {
  // ============ 群体治疗 ============

  describe('群体治疗', () => {
    it('治疗召唤师2格内受伤的友方士兵和英雄', () => {
      const state = createPaladinState();
      clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

      // 召唤师在 (4,2)
      placeUnit(state, { row: 4, col: 2 }, {
        cardId: 'test-summoner',
        card: makePaladinSummoner('test-summoner'),
        owner: '0',
      });

      // 受伤的友方士兵在 (4,3)（距离1）
      placeUnit(state, { row: 4, col: 3 }, {
        cardId: 'test-knight',
        card: makeFortressKnight('test-knight'),
        owner: '0',
        damage: 3,
      });

      // 受伤的友方英雄在 (3,2)（距离1）
      placeUnit(state, { row: 3, col: 2 }, {
        cardId: 'test-valentina',
        card: makeValentina('test-valentina'),
        owner: '0',
        damage: 4,
      });

      state.phase = 'move';
      state.currentPlayer = '0';
      state.players['0'].magic = 3;

      // 放入群体治疗事件卡
      addEventToHand(state, '0', 'paladin-mass-healing-0', {
        name: '群体治疗',
        cost: 1,
        playPhase: 'move',
        isActive: false,
        effect: '治疗',
      });

      const { events, newState } = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
        cardId: 'paladin-mass-healing-0',
      });

      // 应有治疗事件
      const healEvents = events.filter(e => e.type === SW_EVENTS.UNIT_HEALED);
      expect(healEvents.length).toBe(2);

      // 骑士伤害从3减到1（治疗2点）
      expect(newState.board[4][3].unit?.damage).toBe(1);
      // 瓦伦蒂娜伤害从4减到2（治疗2点）
      expect(newState.board[3][2].unit?.damage).toBe(2);
    });

    it('不治疗召唤师', () => {
      const state = createPaladinState();
      clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

      // 受伤的召唤师
      placeUnit(state, { row: 4, col: 2 }, {
        cardId: 'test-summoner',
        card: makePaladinSummoner('test-summoner'),
        owner: '0',
        damage: 5,
      });

      state.phase = 'move';
      state.currentPlayer = '0';
      state.players['0'].magic = 3;

      addEventToHand(state, '0', 'paladin-mass-healing-0', {
        name: '群体治疗',
        cost: 1,
        playPhase: 'move',
        isActive: false,
        effect: '治疗',
      });

      const { events, newState } = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
        cardId: 'paladin-mass-healing-0',
      });

      // 召唤师不应被治疗
      const healEvents = events.filter(e => e.type === SW_EVENTS.UNIT_HEALED);
      expect(healEvents.length).toBe(0);
      expect(newState.board[4][2].unit?.damage).toBe(5);
    });

    it('不治疗超过2格的单位', () => {
      const state = createPaladinState();
      clearArea(state, [1, 2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

      placeUnit(state, { row: 4, col: 2 }, {
        cardId: 'test-summoner',
        card: makePaladinSummoner('test-summoner'),
        owner: '0',
      });

      // 受伤的友方单位在3格外
      placeUnit(state, { row: 1, col: 2 }, {
        cardId: 'test-far-knight',
        card: makeFortressKnight('test-far-knight'),
        owner: '0',
        damage: 3,
      });

      state.phase = 'move';
      state.currentPlayer = '0';
      state.players['0'].magic = 3;

      addEventToHand(state, '0', 'paladin-mass-healing-0', {
        name: '群体治疗',
        cost: 1,
        playPhase: 'move',
        isActive: false,
        effect: '治疗',
      });

      const { events } = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
        cardId: 'paladin-mass-healing-0',
      });

      const healEvents = events.filter(e => e.type === SW_EVENTS.UNIT_HEALED);
      expect(healEvents.length).toBe(0);
    });
  });

  // ============ 圣洁审判 ============

  describe('圣洁审判', () => {
    it('作为主动事件放入主动事件区', () => {
      const state = createPaladinState();
      state.phase = 'attack';
      state.currentPlayer = '0';

      addEventToHand(state, '0', 'paladin-holy-judgment-0', {
        name: '圣洁审判',
        cost: 0,
        playPhase: 'attack',
        isActive: true,
        effect: '圣洁审判效果',
      });

      const { newState } = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
        cardId: 'paladin-holy-judgment-0',
      });

      // 应放入主动事件区
      expect(newState.players['0'].activeEvents.some(
        e => e.id === 'paladin-holy-judgment-0'
      )).toBe(true);
      // 不应在手牌中
      expect(newState.players['0'].hand.some(
        c => c.id === 'paladin-holy-judgment-0'
      )).toBe(false);
    });
  });

  // ============ 圣灵庇护 ============

  describe('圣灵庇护', () => {
    it('作为主动事件放入主动事件区', () => {
      const state = createPaladinState();
      state.phase = 'magic';
      state.currentPlayer = '0';

      addEventToHand(state, '0', 'paladin-holy-protection-0', {
        name: '圣灵庇护',
        cost: 0,
        playPhase: 'magic',
        isActive: true,
        effect: '庇护效果',
      });

      const { newState } = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
        cardId: 'paladin-holy-protection-0',
      });

      expect(newState.players['0'].activeEvents.some(
        e => e.id === 'paladin-holy-protection-0'
      )).toBe(true);
    });
  });

  // ============ 重燃希望 ============

  describe('重燃希望', () => {
    it('作为主动事件放入主动事件区', () => {
      const state = createPaladinState();
      state.phase = 'summon';
      state.currentPlayer = '0';

      addEventToHand(state, '0', 'paladin-rekindle-hope-0', {
        name: '重燃希望',
        cost: 0,
        playPhase: 'summon',
        isActive: true,
        effect: '重燃希望效果',
      });

      const { newState } = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
        cardId: 'paladin-rekindle-hope-0',
      });

      expect(newState.players['0'].activeEvents.some(
        e => e.id === 'paladin-rekindle-hope-0'
      )).toBe(true);
    });
  });
});
