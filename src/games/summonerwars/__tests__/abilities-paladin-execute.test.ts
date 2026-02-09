/**
 * 召唤师战争 - 先锋军团 execute 流程补充测试
 *
 * 覆盖 abilities-paladin.test.ts 中缺失的：
 * - holy_arrow（圣光箭）：弃除手牌获得魔力+战力
 * - guidance 牌组为空边界
 */

import { describe, it, expect } from 'vitest';
import { SummonerWarsDomain, SW_COMMANDS, SW_EVENTS } from '../domain';
import type { SummonerWarsCore, CellCoord, BoardUnit, UnitCard, PlayerId } from '../domain/types';
import type { RandomFn, GameEvent } from '../../../engine/types';
import { createInitializedCore } from './test-helpers';

function createTestRandom(): RandomFn {
  return {
    shuffle: <T>(arr: T[]) => arr,
    random: () => 0.5,
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

function makeJacob(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '雅各布', unitClass: 'champion',
    faction: '先锋军团', strength: 2, life: 7, cost: 5,
    attackType: 'ranged', attackRange: 3,
    abilities: ['holy_arrow', 'radiant_shot'], deckSymbols: [],
  };
}

function makeValentina(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '瓦伦蒂娜', unitClass: 'summoner',
    faction: '先锋军团', strength: 2, life: 14, cost: 0,
    attackType: 'melee', attackRange: 1,
    abilities: ['fortress_elite', 'guidance'], deckSymbols: [],
  };
}

function makeAllyUnit(id: string, name: string): UnitCard {
  return {
    id, cardType: 'unit', name, unitClass: 'common',
    faction: '先锋军团', strength: 1, life: 3, cost: 1,
    attackType: 'melee', attackRange: 1, deckSymbols: [],
  };
}

function makeEnemy(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '敌方单位', unitClass: 'common',
    faction: '测试', strength: 2, life: 3, cost: 0,
    attackType: 'melee', attackRange: 1, deckSymbols: [],
  };
}

function executeAndReduce(
  state: SummonerWarsCore,
  commandType: string,
  payload: Record<string, unknown>
): { newState: SummonerWarsCore; events: GameEvent[] } {
  const fullState = { core: state, sys: {} as any };
  const command = { type: commandType, payload, timestamp: Date.now(), playerId: state.currentPlayer };
  const events = SummonerWarsDomain.execute(fullState, command, createTestRandom());
  let newState = state;
  for (const event of events) {
    newState = SummonerWarsDomain.reduce(newState, event);
  }
  return { newState, events };
}

// ============================================================================
// 圣光箭 (holy_arrow) execute 流程测试
// ============================================================================

describe('雅各布 - 圣光箭 (holy_arrow) execute 流程', () => {
  it('弃除2张手牌获得2魔力+2战力', () => {
    const state = createPaladinState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-jacob',
      card: makeJacob('test-jacob'),
      owner: '0',
    });

    // 手牌中放入2张不同名单位
    state.players['0'].hand.push(makeAllyUnit('discard-1', '城塞骑士'));
    state.players['0'].hand.push(makeAllyUnit('discard-2', '城塞战士'));

    state.phase = 'attack';
    state.currentPlayer = '0';
    const magicBefore = state.players['0'].magic;

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'holy_arrow',
      sourceUnitId: 'test-jacob',
      discardCardIds: ['discard-1', 'discard-2'],
    });

    // 应有魔力增加事件
    const magicEvents = events.filter(e => e.type === SW_EVENTS.MAGIC_CHANGED);
    expect(magicEvents.length).toBe(1);
    expect((magicEvents[0].payload as any).delta).toBe(2);

    // 应有弃牌事件
    const discardEvents = events.filter(e => e.type === SW_EVENTS.CARD_DISCARDED);
    expect(discardEvents.length).toBe(2);

    // 应有充能事件（战力加成）
    const chargeEvents = events.filter(e => e.type === SW_EVENTS.UNIT_CHARGED);
    expect(chargeEvents.length).toBe(1);
    expect((chargeEvents[0].payload as any).delta).toBe(2);

    // 魔力增加2
    expect(newState.players['0'].magic).toBe(magicBefore + 2);

    // 雅各布 boosts 增加2
    expect(newState.board[4][2].unit?.boosts).toBe(2);
  });

  it('DECLARE_ATTACK 携带 beforeAttack 时触发弃牌并提升战力', () => {
    const state = createPaladinState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-jacob',
      card: makeJacob('test-jacob'),
      owner: '0',
    });

    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-enemy',
      card: makeEnemy('test-enemy'),
      owner: '1',
    });

    state.players['0'].hand.push(makeAllyUnit('discard-1', '城塞骑士'));
    state.players['0'].hand.push(makeAllyUnit('discard-2', '城塞战士'));

    state.phase = 'attack';
    state.currentPlayer = '0';
    state.players['0'].attackCount = 0;
    const magicBefore = state.players['0'].magic;

    const { events } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: { row: 4, col: 2 },
      target: { row: 4, col: 3 },
      beforeAttack: {
        abilityId: 'holy_arrow',
        discardCardIds: ['discard-1', 'discard-2'],
      },
    });

    const magicEvents = events.filter(e => e.type === SW_EVENTS.MAGIC_CHANGED);
    expect(magicEvents.length).toBe(1);
    expect((magicEvents[0].payload as any).delta).toBe(2);
    expect((magicEvents[0].payload as any).playerId).toBe('0');

    const discardEvents = events.filter(e => e.type === SW_EVENTS.CARD_DISCARDED);
    expect(discardEvents.length).toBe(2);

    const chargeEvents = events.filter(e => e.type === SW_EVENTS.UNIT_CHARGED);
    expect(chargeEvents.length).toBe(1);
    expect((chargeEvents[0].payload as any).delta).toBe(2);

    const attackedEvent = events.find(e => e.type === SW_EVENTS.UNIT_ATTACKED);
    expect(attackedEvent).toBeDefined();
    // base 2 + beforeAttack bonus 2 + 弃牌充能 2
    expect((attackedEvent!.payload as any).diceCount).toBe(6);

    const magicAfter = magicBefore + 2;
    const magicEvent = magicEvents[0];
    expect((magicEvent.payload as any).delta).toBe(magicAfter - magicBefore);
  });

  it('不能弃除同名单位（验证拒绝）', () => {
    const state = createPaladinState();
    clearArea(state, [3, 4, 5], [1, 2, 3]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-jacob',
      card: makeJacob('test-jacob'),
      owner: '0',
    });

    // 手牌中放入与雅各布同名的单位
    state.players['0'].hand.push(makeAllyUnit('discard-same', '雅各布'));

    state.phase = 'attack';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'holy_arrow',
        sourceUnitId: 'test-jacob',
        discardCardIds: ['discard-same'],
      },
      playerId: '0',
      timestamp: Date.now(),
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('同名');
  });

  it('空弃牌列表时验证拒绝', () => {
    const state = createPaladinState();
    clearArea(state, [3, 4, 5], [1, 2, 3]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-jacob',
      card: makeJacob('test-jacob'),
      owner: '0',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'holy_arrow',
        sourceUnitId: 'test-jacob',
        discardCardIds: [],
      },
      playerId: '0',
      timestamp: Date.now(),
    });
    expect(result.valid).toBe(false);
  });
});

// ============================================================================
// 指引 (guidance) 边界测试
// ============================================================================

describe('瓦伦蒂娜 - 指引 (guidance) 边界测试', () => {
  it('牌组为空时验证拒绝', () => {
    const state = createPaladinState();
    clearArea(state, [3, 4, 5], [1, 2, 3]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-valentina',
      card: makeValentina('test-valentina'),
      owner: '0',
    });

    state.phase = 'summon';
    state.currentPlayer = '0';
    state.players['0'].deck = []; // 清空牌组

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'guidance',
        sourceUnitId: 'test-valentina',
      },
      playerId: '0',
      timestamp: Date.now(),
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('空');
  });

  it('非召唤阶段时验证拒绝', () => {
    const state = createPaladinState();
    clearArea(state, [3, 4, 5], [1, 2, 3]);

    placeUnit(state, { row: 4, col: 2 }, {
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
        sourceUnitId: 'test-valentina',
      },
      playerId: '0',
      timestamp: Date.now(),
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('召唤阶段');
  });
});
