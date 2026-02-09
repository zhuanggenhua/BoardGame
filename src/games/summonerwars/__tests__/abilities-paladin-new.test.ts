/**
 * 召唤师战争 - 先锋军团新技能测试
 *
 * 覆盖本次新增的6个功能：
 * - judgment（裁决）：攻击后按❤️数量抓牌
 * - divine_shield（神圣护盾）：3格内友方城塞被攻击时投骰减伤
 * - healing（治疗）：弃牌将攻击转为治疗
 * - 圣洁审判事件：充能机制、友方士兵+1战力、充能消耗与衰减
 * - 圣灵庇护事件：召唤师3格内友方士兵首次被攻击伤害上限1
 * - 重燃希望事件：任意阶段召唤、召唤师相邻召唤
 */

import { describe, it, expect } from 'vitest';
import { SummonerWarsDomain, SW_COMMANDS, SW_EVENTS } from '../domain';
import type { SummonerWarsCore, CellCoord, BoardUnit, UnitCard, EventCard, PlayerId } from '../domain/types';
import type { RandomFn, GameEvent } from '../../../engine/types';
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

/**
 * 创建可控骰子结果的随机函数
 * values 数组中每个值映射到骰面：
 *   0.0~0.49 → melee (索引0-2)
 *   0.5~0.82 → ranged (索引3-4)
 *   0.83~1.0 → special (索引5)
 */
function createControlledRandom(values: number[]): RandomFn {
  let idx = 0;
  return {
    shuffle: <T>(arr: T[]) => arr,
    random: () => values[idx++] ?? 0.5,
    d: (max: number) => Math.ceil(max / 2),
    range: (min: number, max: number) => Math.floor((min + max) / 2),
  };
}

function createPaladinState(): SummonerWarsCore {
  return createInitializedCore(['0', '1'], createTestRandom(), {
    faction0: 'paladin',
    faction1: 'necromancer',
  });
}

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
    healingMode: overrides.healingMode,
    wasAttackedThisTurn: overrides.wasAttackedThisTurn,
  };
  state.board[pos.row][pos.col].unit = unit;
  return unit;
}

function clearArea(state: SummonerWarsCore, rows: number[], cols: number[]) {
  for (const r of rows) {
    for (const c of cols) {
      state.board[r][c].unit = undefined;
      state.board[r][c].structure = undefined;
    }
  }
}

function makeFortressWarrior(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '城塞圣武士', unitClass: 'common',
    faction: '先锋军团', strength: 3, life: 4, cost: 2,
    attackType: 'melee', attackRange: 1,
    abilities: ['judgment'], deckSymbols: [],
  };
}

function makeFortressKnight(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '城塞骑士', unitClass: 'common',
    faction: '先锋军团', strength: 2, life: 5, cost: 2,
    attackType: 'melee', attackRange: 1,
    abilities: ['entangle', 'guardian'], deckSymbols: [],
  };
}

function makeCorin(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '科琳·布莱顿', unitClass: 'champion',
    faction: '先锋军团', strength: 3, life: 8, cost: 6,
    attackType: 'melee', attackRange: 1,
    abilities: ['divine_shield'], deckSymbols: [],
  };
}

function makeTemplePriest(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '圣殿牧师', unitClass: 'common',
    faction: '先锋军团', strength: 2, life: 2, cost: 0,
    attackType: 'melee', attackRange: 1,
    abilities: ['healing'], deckSymbols: [],
  };
}

function makePaladinSummoner(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '瑟拉·艾德温', unitClass: 'summoner',
    faction: '先锋军团', strength: 2, life: 12, cost: 0,
    attackType: 'ranged', attackRange: 3,
    abilities: ['fortress_power'], deckSymbols: [],
  };
}

function makeEnemy(id: string, overrides?: Partial<UnitCard>): UnitCard {
  return {
    id, cardType: 'unit', name: '敌方单位', unitClass: 'common',
    faction: '测试', strength: 2, life: 5, cost: 0,
    attackType: 'melee', attackRange: 1, deckSymbols: [],
    ...overrides,
  };
}

function makeAlly(id: string, overrides?: Partial<UnitCard>): UnitCard {
  return {
    id, cardType: 'unit', name: '友方单位', unitClass: 'common',
    faction: '先锋军团', strength: 1, life: 3, cost: 0,
    attackType: 'melee', attackRange: 1, deckSymbols: [],
    ...overrides,
  };
}

function executeAndReduce(
  state: SummonerWarsCore,
  commandType: string,
  payload: Record<string, unknown>,
  random?: RandomFn
): { newState: SummonerWarsCore; events: GameEvent[] } {
  const fullState = { core: state, sys: {} as any };
  const command = { type: commandType, payload, timestamp: Date.now(), playerId: state.currentPlayer };
  const events = SummonerWarsDomain.execute(fullState, command, random ?? createTestRandom());
  let newState = state;
  for (const event of events) {
    newState = SummonerWarsDomain.reduce(newState, event);
  }
  return { newState, events };
}

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
// 裁决 (judgment) 测试
// ============================================================================

describe('城塞圣武士 - 裁决 (judgment)', () => {
  it('攻击后按 melee（❤️）数量抓牌', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    // 城塞圣武士（裁决）在 (4,2)
    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-warrior',
      card: makeFortressWarrior('test-warrior'),
      owner: '0',
    });

    // 敌方单位在 (4,3)
    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-enemy',
      card: makeEnemy('test-enemy', { life: 10 }),
      owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';
    state.players['0'].attackCount = 0;
    // 确保牌组有足够的牌
    state.players['0'].deck = [makeAlly('deck-1'), makeAlly('deck-2'), makeAlly('deck-3')];
    const handSizeBefore = state.players['0'].hand.length;

    // 使用全 melee 骰子（0.0 → melee）
    // 城塞圣武士战力3，投3个骰子，全部 melee
    const allMeleeRandom = createControlledRandom([0.0, 0.0, 0.0]);

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: { row: 4, col: 2 },
      target: { row: 4, col: 3 },
    }, allMeleeRandom);

    // 应有 afterAttack 触发的 judgment 抓牌事件
    const drawEvents = events.filter(e =>
      e.type === SW_EVENTS.CARD_DRAWN
      && (e.payload as any).sourceAbilityId === 'judgment'
    );
    expect(drawEvents.length).toBe(1);
    expect((drawEvents[0].payload as any).count).toBe(3); // 3个 melee

    // 手牌应增加3张
    expect(newState.players['0'].hand.length).toBe(handSizeBefore + 3);
  });

  it('无 melee 结果时不抓牌', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-warrior',
      card: makeFortressWarrior('test-warrior'),
      owner: '0',
    });

    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-enemy',
      card: makeEnemy('test-enemy', { life: 10 }),
      owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';
    state.players['0'].attackCount = 0;
    state.players['0'].deck = [makeAlly('deck-1'), makeAlly('deck-2')];
    const handSizeBefore = state.players['0'].hand.length;

    // 全部 ranged 骰子（0.6 → ranged）
    const allRangedRandom = createControlledRandom([0.6, 0.6, 0.6]);

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: { row: 4, col: 2 },
      target: { row: 4, col: 3 },
    }, allRangedRandom);

    // 不应有 judgment 抓牌事件
    const drawEvents = events.filter(e =>
      e.type === SW_EVENTS.CARD_DRAWN
      && (e.payload as any).sourceAbilityId === 'judgment'
    );
    expect(drawEvents.length).toBe(0);
    expect(newState.players['0'].hand.length).toBe(handSizeBefore);
  });

  it('部分 melee 结果时按实际数量抓牌', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-warrior',
      card: makeFortressWarrior('test-warrior'),
      owner: '0',
    });

    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-enemy',
      card: makeEnemy('test-enemy', { life: 10 }),
      owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';
    state.players['0'].attackCount = 0;
    state.players['0'].deck = [makeAlly('deck-1'), makeAlly('deck-2'), makeAlly('deck-3')];
    const handSizeBefore = state.players['0'].hand.length;

    // 2个 melee + 1个 ranged
    const mixedRandom = createControlledRandom([0.0, 0.0, 0.6]);

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: { row: 4, col: 2 },
      target: { row: 4, col: 3 },
    }, mixedRandom);

    const drawEvents = events.filter(e =>
      e.type === SW_EVENTS.CARD_DRAWN
      && (e.payload as any).sourceAbilityId === 'judgment'
    );
    expect(drawEvents.length).toBe(1);
    expect((drawEvents[0].payload as any).count).toBe(2);
    expect(newState.players['0'].hand.length).toBe(handSizeBefore + 2);
  });
});


// ============================================================================
// 神圣护盾 (divine_shield) 测试
// ============================================================================

describe('科琳 - 神圣护盾 (divine_shield)', () => {
  it('3格内友方城塞单位被攻击时投骰减伤', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    // 科琳（神圣护盾）在 (4,2)
    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-corin',
      card: makeCorin('test-corin'),
      owner: '0',
    });

    // 城塞骑士（被攻击目标）在 (4,3)，距离科琳1格
    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-fortress-knight',
      card: makeFortressKnight('test-fortress-knight'),
      owner: '0',
    });

    // 敌方攻击者在 (4,4)
    placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'test-attacker',
      card: makeEnemy('test-attacker', { strength: 4 }),
      owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '1';
    state.players['1'].attackCount = 0;

    // 攻击者投4个骰子全 melee（命中4），护盾投2个骰子全 melee（减2，最少1）
    // 骰子顺序：攻击者4个 + 护盾2个 = 6个随机值
    const shieldRandom = createControlledRandom([0.0, 0.0, 0.0, 0.0, 0.0, 0.0]);

    const { events } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: { row: 4, col: 4 },
      target: { row: 4, col: 3 },
    }, shieldRandom);

    // 应有 DAMAGE_REDUCED 事件
    const reduceEvents = events.filter(e =>
      e.type === SW_EVENTS.DAMAGE_REDUCED
      && (e.payload as any).sourceAbilityId === 'divine_shield'
    );
    expect(reduceEvents.length).toBe(1);

    // 原始命中4，护盾减2但最少保留1，所以减少到 max(4-2, 1) = 2
    // 但实际逻辑是 reduction = min(shieldMelee, hits-1) = min(2, 3) = 2
    // 最终 hits = 4 - 2 = 2
    const attacked = events.find(e => e.type === SW_EVENTS.UNIT_ATTACKED);
    expect(attacked).toBeDefined();
    // hits 在 UNIT_ATTACKED payload 中
    expect((attacked!.payload as any).hits).toBe(2);
  });

  it('科琳超过3格时不触发护盾', () => {
    const state = createPaladinState();
    clearArea(state, [1, 2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    // 科琳在 (1,0)，距离目标 (4,3) = 6格
    placeUnit(state, { row: 1, col: 0 }, {
      cardId: 'test-corin',
      card: makeCorin('test-corin'),
      owner: '0',
    });

    // 城塞骑士在 (4,3)
    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-fortress-knight',
      card: makeFortressKnight('test-fortress-knight'),
      owner: '0',
    });

    // 敌方攻击者在 (4,4)
    placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'test-attacker',
      card: makeEnemy('test-attacker', { strength: 3 }),
      owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '1';
    state.players['1'].attackCount = 0;

    const allMelee = createControlledRandom([0.0, 0.0, 0.0]);

    const { events } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: { row: 4, col: 4 },
      target: { row: 4, col: 3 },
    }, allMelee);

    // 不应有 divine_shield 减伤事件
    const reduceEvents = events.filter(e =>
      e.type === SW_EVENTS.DAMAGE_REDUCED
      && (e.payload as any).sourceAbilityId === 'divine_shield'
    );
    expect(reduceEvents.length).toBe(0);
  });

  it('非城塞单位被攻击时不触发护盾', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    // 科琳在 (4,2)
    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-corin',
      card: makeCorin('test-corin'),
      owner: '0',
    });

    // 非城塞友方单位在 (4,3)
    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-ally',
      card: makeAlly('test-ally', { life: 5 }),
      owner: '0',
    });

    // 敌方攻击者在 (4,4)
    placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'test-attacker',
      card: makeEnemy('test-attacker', { strength: 3 }),
      owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '1';
    state.players['1'].attackCount = 0;

    const allMelee = createControlledRandom([0.0, 0.0, 0.0]);

    const { events } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: { row: 4, col: 4 },
      target: { row: 4, col: 3 },
    }, allMelee);

    const reduceEvents = events.filter(e =>
      e.type === SW_EVENTS.DAMAGE_REDUCED
      && (e.payload as any).sourceAbilityId === 'divine_shield'
    );
    expect(reduceEvents.length).toBe(0);
  });

  it('护盾骰子无 melee 时不减伤', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-corin',
      card: makeCorin('test-corin'),
      owner: '0',
    });

    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-fortress-knight',
      card: makeFortressKnight('test-fortress-knight'),
      owner: '0',
    });

    placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'test-attacker',
      card: makeEnemy('test-attacker', { strength: 3 }),
      owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '1';
    state.players['1'].attackCount = 0;

    // 攻击者3个 melee，护盾2个 ranged
    const shieldNoMelee = createControlledRandom([0.0, 0.0, 0.0, 0.6, 0.6]);

    const { events } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: { row: 4, col: 4 },
      target: { row: 4, col: 3 },
    }, shieldNoMelee);

    const reduceEvents = events.filter(e =>
      e.type === SW_EVENTS.DAMAGE_REDUCED
      && (e.payload as any).sourceAbilityId === 'divine_shield'
    );
    expect(reduceEvents.length).toBe(0);

    // 命中数应保持3
    const attacked = events.find(e => e.type === SW_EVENTS.UNIT_ATTACKED);
    expect((attacked!.payload as any).hits).toBe(3);
  });
});


// ============================================================================
// 治疗 (healing) 测试
// ============================================================================

describe('圣殿牧师 - 治疗 (healing)', () => {
  it('弃牌后进入治疗模式', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-priest',
      card: makeTemplePriest('test-priest'),
      owner: '0',
    });

    // 友方受伤单位在 (4,3)
    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-ally',
      card: makeAlly('test-ally', { life: 5 }),
      owner: '0',
      damage: 3,
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    // 手牌中放入一张卡牌用于弃除
    const discardCard = makeAlly('discard-card');
    state.players['0'].hand.push(discardCard);

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'healing',
      sourceUnitId: 'test-priest',
      targetCardId: 'discard-card',
      targetPosition: { row: 4, col: 3 },
    });

    // 应有弃牌事件
    const discardEvents = events.filter(e => e.type === SW_EVENTS.CARD_DISCARDED);
    expect(discardEvents.length).toBe(1);

    // 应有治疗模式设置事件
    const healModeEvents = events.filter(e => e.type === SW_EVENTS.HEALING_MODE_SET);
    expect(healModeEvents.length).toBe(1);

    // 牧师应进入治疗模式
    expect(newState.board[4][2].unit?.healingMode).toBe(true);
  });

  it('DECLARE_ATTACK 携带 beforeAttack 时弃牌并触发治疗攻击', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-priest',
      card: makeTemplePriest('test-priest'),
      owner: '0',
    });

    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-ally',
      card: makeAlly('test-ally', { life: 5 }),
      owner: '0',
      damage: 3,
    });

    state.phase = 'attack';
    state.currentPlayer = '0';
    state.players['0'].attackCount = 0;

    state.players['0'].hand.push(makeAlly('discard-card'));

    const allMelee = createControlledRandom([0.0, 0.0]);

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: { row: 4, col: 2 },
      target: { row: 4, col: 3 },
      beforeAttack: {
        abilityId: 'healing',
        targetCardId: 'discard-card',
      },
    }, allMelee);

    const discardEvents = events.filter(e => e.type === SW_EVENTS.CARD_DISCARDED);
    expect(discardEvents.length).toBe(1);

    const healModeEvents = events.filter(e => e.type === SW_EVENTS.HEALING_MODE_SET);
    expect(healModeEvents.length).toBe(1);

    const healEvents = events.filter(e =>
      e.type === SW_EVENTS.UNIT_HEALED
      && (e.payload as any).sourceAbilityId === 'healing'
    );
    expect(healEvents.length).toBe(1);
    expect((healEvents[0].payload as any).amount).toBe(2);

    expect(newState.players['0'].hand.find(c => c.id === 'discard-card')).toBeUndefined();
    expect(newState.board[4][3].unit?.damage).toBe(1);
  });

  it('治疗模式下攻击友方单位转为治疗', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    // 牧师已进入治疗模式
    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-priest',
      card: makeTemplePriest('test-priest'),
      owner: '0',
      healingMode: true,
    });

    // 友方受伤单位在 (4,3)
    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-ally',
      card: makeAlly('test-ally', { life: 5 }),
      owner: '0',
      damage: 3,
    });

    state.phase = 'attack';
    state.currentPlayer = '0';
    state.players['0'].attackCount = 0;

    // 牧师战力2，投2个骰子全 melee
    const allMelee = createControlledRandom([0.0, 0.0]);

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: { row: 4, col: 2 },
      target: { row: 4, col: 3 },
    }, allMelee);

    // 应有治疗事件
    const healEvents = events.filter(e =>
      e.type === SW_EVENTS.UNIT_HEALED
      && (e.payload as any).sourceAbilityId === 'healing'
    );
    expect(healEvents.length).toBe(1);
    expect((healEvents[0].payload as any).amount).toBe(2); // 2个 melee

    // 友方单位伤害应减少
    expect(newState.board[4][3].unit?.damage).toBe(1); // 3 - 2 = 1
  });

  it('治疗模式下不应造成伤害', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-priest',
      card: makeTemplePriest('test-priest'),
      owner: '0',
      healingMode: true,
    });

    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-ally',
      card: makeAlly('test-ally', { life: 5 }),
      owner: '0',
      damage: 1,
    });

    state.phase = 'attack';
    state.currentPlayer = '0';
    state.players['0'].attackCount = 0;

    const allMelee = createControlledRandom([0.0, 0.0]);

    const { events } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: { row: 4, col: 2 },
      target: { row: 4, col: 3 },
    }, allMelee);

    // 不应有 UNIT_DAMAGED 事件（治疗模式不造成伤害）
    const damageEvents = events.filter(e =>
      e.type === SW_EVENTS.UNIT_DAMAGED
      && (e.payload as any).position?.row === 4
      && (e.payload as any).position?.col === 3
    );
    expect(damageEvents.length).toBe(0);
  });

  it('攻击后清除治疗模式', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-priest',
      card: makeTemplePriest('test-priest'),
      owner: '0',
      healingMode: true,
    });

    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-ally',
      card: makeAlly('test-ally', { life: 5 }),
      owner: '0',
      damage: 2,
    });

    state.phase = 'attack';
    state.currentPlayer = '0';
    state.players['0'].attackCount = 0;

    const allMelee = createControlledRandom([0.0, 0.0]);

    const { newState } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: { row: 4, col: 2 },
      target: { row: 4, col: 3 },
    }, allMelee);

    // 攻击后治疗模式应被清除（UNIT_ATTACKED reducer 清除）
    expect(newState.board[4][2].unit?.healingMode).toBeFalsy();
  });

  it('治疗模式验证：只能攻击友方士兵或英雄', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-priest',
      card: makeTemplePriest('test-priest'),
      owner: '0',
      healingMode: true,
    });

    // 敌方单位在 (4,3)
    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-enemy',
      card: makeEnemy('test-enemy'),
      owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';
    state.players['0'].attackCount = 0;

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.DECLARE_ATTACK,
      payload: { attacker: { row: 4, col: 2 }, target: { row: 4, col: 3 } },
      playerId: '0',
      timestamp: Date.now(),
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('友方');
  });
});


// ============================================================================
// 圣洁审判事件卡测试
// ============================================================================

describe('圣洁审判事件卡', () => {
  it('打出时设置2点充能', () => {
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

    const holyJudgment = newState.players['0'].activeEvents.find(
      e => e.id === 'paladin-holy-judgment-0'
    );
    expect(holyJudgment).toBeDefined();
    expect(holyJudgment!.charges).toBe(2);
  });

  it('有充能时友方士兵+1战力', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    // 友方士兵
    const ally = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-common',
      card: makeAlly('test-common'),
      owner: '0',
    });

    // 放入圣洁审判到主动事件区（有充能）
    state.players['0'].activeEvents.push({
      id: 'paladin-holy-judgment-0',
      cardType: 'event',
      name: '圣洁审判',
      cost: 0,
      playPhase: 'attack',
      effect: '圣洁审判效果',
      isActive: true,
      charges: 2,
      deckSymbols: [],
    });

    const strength = calculateEffectiveStrength(ally, state);
    expect(strength).toBe(2); // 基础1 + 圣洁审判1
  });

  it('无充能时友方士兵不加战力', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const ally = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-common',
      card: makeAlly('test-common'),
      owner: '0',
    });

    // 圣洁审判充能为0
    state.players['0'].activeEvents.push({
      id: 'paladin-holy-judgment-0',
      cardType: 'event',
      name: '圣洁审判',
      cost: 0,
      playPhase: 'attack',
      effect: '圣洁审判效果',
      isActive: true,
      charges: 0,
      deckSymbols: [],
    });

    const strength = calculateEffectiveStrength(ally, state);
    expect(strength).toBe(1); // 基础1，无加成
  });

  it('冠军单位不受圣洁审判加成', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const champion = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-champion',
      card: makeCorin('test-champion'),
      owner: '0',
    });

    state.players['0'].activeEvents.push({
      id: 'paladin-holy-judgment-0',
      cardType: 'event',
      name: '圣洁审判',
      cost: 0,
      playPhase: 'attack',
      effect: '圣洁审判效果',
      isActive: true,
      charges: 2,
      deckSymbols: [],
    });

    const strength = calculateEffectiveStrength(champion, state);
    expect(strength).toBe(3); // 基础3，冠军不受加成
  });

  it('友方单位被消灭时移除1充能', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    // 友方单位（将被消灭）
    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-victim',
      card: makeAlly('test-victim', { life: 1 }),
      owner: '0',
      damage: 0,
    });

    // 圣洁审判有2充能
    state.players['0'].activeEvents.push({
      id: 'paladin-holy-judgment-0',
      cardType: 'event',
      name: '圣洁审判',
      cost: 0,
      playPhase: 'attack',
      effect: '圣洁审判效果',
      isActive: true,
      charges: 2,
      deckSymbols: [],
    });

    // 通过 UNIT_DESTROYED 事件触发充能减少
    const destroyEvent: GameEvent = {
      type: SW_EVENTS.UNIT_DESTROYED,
      payload: {
        position: { row: 4, col: 3 },
        cardId: 'test-victim',
        cardName: '友方单位',
        owner: '0' as PlayerId,
      },
      timestamp: Date.now(),
    };

    const newState = SummonerWarsDomain.reduce(state, destroyEvent);

    const holyJudgment = newState.players['0'].activeEvents.find(
      e => e.id === 'paladin-holy-judgment-0'
    );
    expect(holyJudgment).toBeDefined();
    expect(holyJudgment!.charges).toBe(1); // 2 - 1 = 1
  });

  it('充能归零时自动弃置', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-victim',
      card: makeAlly('test-victim', { life: 1 }),
      owner: '0',
      damage: 0,
    });

    // 圣洁审判只有1充能
    state.players['0'].activeEvents.push({
      id: 'paladin-holy-judgment-0',
      cardType: 'event',
      name: '圣洁审判',
      cost: 0,
      playPhase: 'attack',
      effect: '圣洁审判效果',
      isActive: true,
      charges: 1,
      deckSymbols: [],
    });

    const destroyEvent: GameEvent = {
      type: SW_EVENTS.UNIT_DESTROYED,
      payload: {
        position: { row: 4, col: 3 },
        cardId: 'test-victim',
        cardName: '友方单位',
        owner: '0' as PlayerId,
      },
      timestamp: Date.now(),
    };

    const newState = SummonerWarsDomain.reduce(state, destroyEvent);

    // 圣洁审判应从主动事件区移除
    const holyJudgment = newState.players['0'].activeEvents.find(
      e => e.id === 'paladin-holy-judgment-0'
    );
    expect(holyJudgment).toBeUndefined();

    // 应进入弃牌堆
    const inDiscard = newState.players['0'].discard.some(
      c => c.id === 'paladin-holy-judgment-0'
    );
    expect(inDiscard).toBe(true);
  });

  it('回合开始消耗充能归零时自动弃置', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    // 圣洁审判只有1充能
    state.players['0'].activeEvents.push({
      id: 'paladin-holy-judgment-0',
      cardType: 'event',
      name: '圣洁审判',
      cost: 0,
      playPhase: 'attack',
      effect: '圣洁审判效果',
      isActive: true,
      charges: 1,
      deckSymbols: [],
    });

    const chargeEvent: GameEvent = {
      type: SW_EVENTS.FUNERAL_PYRE_CHARGED,
      payload: {
        playerId: '0' as PlayerId,
        eventCardId: 'paladin-holy-judgment-0',
        charges: 0,
      },
      timestamp: Date.now(),
    };

    const newState = SummonerWarsDomain.reduce(state, chargeEvent);

    const holyJudgment = newState.players['0'].activeEvents.find(
      e => e.id === 'paladin-holy-judgment-0'
    );
    expect(holyJudgment).toBeUndefined();

    const inDiscard = newState.players['0'].discard.some(
      c => c.id === 'paladin-holy-judgment-0'
    );
    expect(inDiscard).toBe(true);
  });
});


// ============================================================================
// 圣灵庇护事件卡测试
// ============================================================================

describe('圣灵庇护事件卡', () => {
  it('召唤师3格内友方士兵首次被攻击伤害上限1', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    // 召唤师在 (4,2)
    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-summoner',
      card: makePaladinSummoner('test-summoner'),
      owner: '0',
    });

    // 友方士兵在 (4,3)，距离召唤师1格
    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-common',
      card: makeAlly('test-common', { life: 5 }),
      owner: '0',
    });

    // 敌方攻击者在 (4,4)
    placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'test-attacker',
      card: makeEnemy('test-attacker', { strength: 4 }),
      owner: '1',
    });

    // 放入圣灵庇护到主动事件区
    state.players['0'].activeEvents.push({
      id: 'paladin-holy-protection-0',
      cardType: 'event',
      name: '圣灵庇护',
      cost: 0,
      playPhase: 'magic',
      effect: '庇护效果',
      isActive: true,
      deckSymbols: [],
    });

    state.phase = 'attack';
    state.currentPlayer = '1';
    state.players['1'].attackCount = 0;

    // 攻击者投4个骰子全 melee（命中4）
    const allMelee = createControlledRandom([0.0, 0.0, 0.0, 0.0]);

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: { row: 4, col: 4 },
      target: { row: 4, col: 3 },
    }, allMelee);

    // 应有 DAMAGE_REDUCED 事件
    const reduceEvents = events.filter(e =>
      e.type === SW_EVENTS.DAMAGE_REDUCED
      && (e.payload as any).sourceAbilityId === 'holy_protection'
    );
    expect(reduceEvents.length).toBe(1);

    // 伤害应被限制为1
    expect(newState.board[4][3].unit?.damage).toBe(1);
  });

  it('已被攻击过的单位不再受庇护', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-summoner',
      card: makePaladinSummoner('test-summoner'),
      owner: '0',
    });

    // 友方士兵已被攻击过
    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-common',
      card: makeAlly('test-common', { life: 5 }),
      owner: '0',
      wasAttackedThisTurn: true,
      damage: 1,
    });

    placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'test-attacker',
      card: makeEnemy('test-attacker', { strength: 3 }),
      owner: '1',
    });

    state.players['0'].activeEvents.push({
      id: 'paladin-holy-protection-0',
      cardType: 'event',
      name: '圣灵庇护',
      cost: 0,
      playPhase: 'magic',
      effect: '庇护效果',
      isActive: true,
      deckSymbols: [],
    });

    state.phase = 'attack';
    state.currentPlayer = '1';
    state.players['1'].attackCount = 0;

    const allMelee = createControlledRandom([0.0, 0.0, 0.0]);

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: { row: 4, col: 4 },
      target: { row: 4, col: 3 },
    }, allMelee);

    // 不应有庇护减伤
    const reduceEvents = events.filter(e =>
      e.type === SW_EVENTS.DAMAGE_REDUCED
      && (e.payload as any).sourceAbilityId === 'holy_protection'
    );
    expect(reduceEvents.length).toBe(0);

    // 伤害应为完整3点
    expect(newState.board[4][3].unit?.damage).toBe(4); // 1 + 3
  });

  it('超过召唤师3格的士兵不受庇护', () => {
    const state = createPaladinState();
    clearArea(state, [1, 2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    // 召唤师在 (1,0)
    placeUnit(state, { row: 1, col: 0 }, {
      cardId: 'test-summoner',
      card: makePaladinSummoner('test-summoner'),
      owner: '0',
    });

    // 友方士兵在 (4,3)，距离召唤师6格
    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-common',
      card: makeAlly('test-common', { life: 5 }),
      owner: '0',
    });

    placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'test-attacker',
      card: makeEnemy('test-attacker', { strength: 3 }),
      owner: '1',
    });

    state.players['0'].activeEvents.push({
      id: 'paladin-holy-protection-0',
      cardType: 'event',
      name: '圣灵庇护',
      cost: 0,
      playPhase: 'magic',
      effect: '庇护效果',
      isActive: true,
      deckSymbols: [],
    });

    state.phase = 'attack';
    state.currentPlayer = '1';
    state.players['1'].attackCount = 0;

    const allMelee = createControlledRandom([0.0, 0.0, 0.0]);

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: { row: 4, col: 4 },
      target: { row: 4, col: 3 },
    }, allMelee);

    const reduceEvents = events.filter(e =>
      e.type === SW_EVENTS.DAMAGE_REDUCED
      && (e.payload as any).sourceAbilityId === 'holy_protection'
    );
    expect(reduceEvents.length).toBe(0);

    // 伤害应为完整3点
    expect(newState.board[4][3].unit?.damage).toBe(3);
  });

  it('冠军单位不受庇护', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-summoner',
      card: makePaladinSummoner('test-summoner'),
      owner: '0',
    });

    // 冠军单位在 (4,3)
    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-champion',
      card: makeCorin('test-champion'),
      owner: '0',
    });

    placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'test-attacker',
      card: makeEnemy('test-attacker', { strength: 3 }),
      owner: '1',
    });

    state.players['0'].activeEvents.push({
      id: 'paladin-holy-protection-0',
      cardType: 'event',
      name: '圣灵庇护',
      cost: 0,
      playPhase: 'magic',
      effect: '庇护效果',
      isActive: true,
      deckSymbols: [],
    });

    state.phase = 'attack';
    state.currentPlayer = '1';
    state.players['1'].attackCount = 0;

    const allMelee = createControlledRandom([0.0, 0.0, 0.0]);

    const { events } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: { row: 4, col: 4 },
      target: { row: 4, col: 3 },
    }, allMelee);

    // 冠军不受庇护
    const reduceEvents = events.filter(e =>
      e.type === SW_EVENTS.DAMAGE_REDUCED
      && (e.payload as any).sourceAbilityId === 'holy_protection'
    );
    expect(reduceEvents.length).toBe(0);
  });

  it('回合开始时清除 wasAttackedThisTurn', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-common',
      card: makeAlly('test-common', { life: 5 }),
      owner: '0',
      wasAttackedThisTurn: true,
    });

    // TURN_CHANGED 应清除 wasAttackedThisTurn
    const turnEvent: GameEvent = {
      type: SW_EVENTS.TURN_CHANGED,
      payload: { from: '1' as PlayerId, to: '0' as PlayerId },
      timestamp: Date.now(),
    };

    const newState = SummonerWarsDomain.reduce(state, turnEvent);
    expect(newState.board[4][3].unit?.wasAttackedThisTurn).toBeFalsy();
  });
});


// ============================================================================
// 重燃希望事件卡测试
// ============================================================================

describe('重燃希望事件卡', () => {
  it('允许在非召唤阶段召唤单位', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    // 召唤师在 (4,2)
    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-summoner',
      card: makePaladinSummoner('test-summoner'),
      owner: '0',
    });

    // 城门在 (4,3)
    state.board[4][3].structure = {
      cardId: 'test-gate',
      card: {
        id: 'test-gate', cardType: 'structure', name: '城门',
        cost: 0, life: 10, isGate: true, deckSymbols: [],
      },
      owner: '0' as PlayerId,
      position: { row: 4, col: 3 },
      damage: 0,
    };

    // 放入重燃希望到主动事件区
    state.players['0'].activeEvents.push({
      id: 'paladin-rekindle-hope-0',
      cardType: 'event',
      name: '重燃希望',
      cost: 0,
      playPhase: 'summon',
      effect: '重燃希望效果',
      isActive: true,
      deckSymbols: [],
    });

    // 手牌中放入一个单位
    const unitCard = makeAlly('summon-unit');
    state.players['0'].hand.push(unitCard);

    // 在攻击阶段尝试召唤
    state.phase = 'attack';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.SUMMON_UNIT,
      payload: { cardId: 'summon-unit', position: { row: 4, col: 4 } },
      playerId: '0',
      timestamp: Date.now(),
    });
    // 城门相邻位置 (4,4) 应该有效
    expect(result.valid).toBe(true);
  });

  it('允许召唤到召唤师相邻位置', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    // 召唤师在 (4,2)
    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-summoner',
      card: makePaladinSummoner('test-summoner'),
      owner: '0',
    });

    // 放入重燃希望
    state.players['0'].activeEvents.push({
      id: 'paladin-rekindle-hope-0',
      cardType: 'event',
      name: '重燃希望',
      cost: 0,
      playPhase: 'summon',
      effect: '重燃希望效果',
      isActive: true,
      deckSymbols: [],
    });

    const unitCard = makeAlly('summon-unit');
    state.players['0'].hand.push(unitCard);

    state.phase = 'summon';
    state.currentPlayer = '0';

    // 召唤师相邻位置 (3,2) 应该有效（即使没有城门）
    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.SUMMON_UNIT,
      payload: { cardId: 'summon-unit', position: { row: 3, col: 2 } },
      playerId: '0',
      timestamp: Date.now(),
    });
    expect(result.valid).toBe(true);
  });

  it('无重燃希望时非召唤阶段不能召唤', () => {
    const state = createPaladinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-summoner',
      card: makePaladinSummoner('test-summoner'),
      owner: '0',
    });

    state.board[4][3].structure = {
      cardId: 'test-gate',
      card: {
        id: 'test-gate', cardType: 'structure', name: '城门',
        cost: 0, life: 10, isGate: true, deckSymbols: [],
      },
      owner: '0' as PlayerId,
      position: { row: 4, col: 3 },
      damage: 0,
    };

    const unitCard = makeAlly('summon-unit');
    state.players['0'].hand.push(unitCard);

    state.phase = 'attack';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.SUMMON_UNIT,
      payload: { cardId: 'summon-unit', position: { row: 4, col: 4 } },
      playerId: '0',
      timestamp: Date.now(),
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('召唤阶段');
  });
});
