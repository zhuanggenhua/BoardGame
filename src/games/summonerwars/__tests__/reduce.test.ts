/**
 * 召唤师战争 - 状态归约器独立单元测试
 *
 * 覆盖 reduce.ts 中所有事件类型的状态变更逻辑，
 * 确保每种事件正确修改 core 状态。
 */

import { describe, it, expect } from 'vitest';
import { SummonerWarsDomain, SW_EVENTS } from '../domain';
import { SW_SELECTION_EVENTS } from '../domain/types';
import type { SummonerWarsCore, PlayerId, CellCoord, UnitCard, EventCard, StructureCard, BoardUnit } from '../domain/types';
import type { RandomFn, GameEvent } from '../../../engine/types';
import { createInitializedCore } from './test-helpers';
import { BOARD_ROWS, BOARD_COLS } from '../domain/helpers';

// ============================================================================
// 辅助
// ============================================================================

function createTestRandom(): RandomFn {
  return { shuffle: <T>(arr: T[]) => arr, random: () => 0.5, d: (max: number) => Math.ceil(max * 0.5) || 1, range: (min: number, max: number) => Math.floor(min + (max - min) * 0.5) };
}

function reduce(core: SummonerWarsCore, event: GameEvent): SummonerWarsCore {
  return SummonerWarsDomain.reduce(core, event);
}

function makeUnitCard(id: string, overrides?: Partial<UnitCard>): UnitCard {
  return {
    id, cardType: 'unit', name: `测试-${id}`, unitClass: 'common', faction: 'test',
    strength: 2, life: 3, cost: 1, attackType: 'melee', attackRange: 1,
    deckSymbols: [], ...overrides,
  };
}

function makeEventCard(id: string, overrides?: Partial<EventCard>): EventCard {
  return { id, cardType: 'event', name: `事件-${id}`, cost: 0, playPhase: 'any', effect: '测试', deckSymbols: [], ...overrides };
}

function placeUnit(core: SummonerWarsCore, pos: CellCoord, owner: PlayerId, card: UnitCard, extra?: Partial<BoardUnit>): BoardUnit {
  const u: BoardUnit = {
    cardId: card.id, card, owner, position: pos, damage: 0, boosts: 0,
    hasMoved: false, hasAttacked: false, ...extra,
  };
  core.board[pos.row][pos.col].unit = u;
  return u;
}

function clearCell(core: SummonerWarsCore, pos: CellCoord) {
  core.board[pos.row][pos.col].unit = undefined;
  core.board[pos.row][pos.col].structure = undefined;
}

// ============================================================================
// 单位事件
// ============================================================================

describe('UNIT_SUMMONED', () => {
  it('从手牌召唤单位到棋盘', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const card = makeUnitCard('summon-test');
    core.players['0'].hand.push(card);
    const pos: CellCoord = { row: 4, col: 4 };
    clearCell(core, pos);

    const result = reduce(core, {
      type: SW_EVENTS.UNIT_SUMMONED,
      payload: { playerId: '0', cardId: 'summon-test', position: pos, card },
      timestamp: 0,
    });

    expect(result.board[4][4].unit).toBeDefined();
    expect(result.board[4][4].unit!.cardId).toBe('summon-test');
    expect(result.board[4][4].unit!.owner).toBe('0');
    expect(result.players['0'].hand.find(c => c.id === 'summon-test')).toBeUndefined();
  });

  it('从弃牌堆召唤（fromDiscard）', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const card = makeUnitCard('discard-summon');
    core.players['0'].discard.push(card);
    const pos: CellCoord = { row: 4, col: 4 };
    clearCell(core, pos);

    const result = reduce(core, {
      type: SW_EVENTS.UNIT_SUMMONED,
      payload: { playerId: '0', cardId: 'discard-summon', position: pos, card, fromDiscard: true },
      timestamp: 0,
    });

    expect(result.board[4][4].unit).toBeDefined();
    expect(result.players['0'].discard.find(c => c.id === 'discard-summon')).toBeUndefined();
  });
});

describe('UNIT_MOVED', () => {
  it('移动单位并标记 hasMoved + 增加 moveCount', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const from: CellCoord = { row: 5, col: 3 };
    const to: CellCoord = { row: 4, col: 3 };
    clearCell(core, from);
    clearCell(core, to);
    const card = makeUnitCard('mover');
    placeUnit(core, from, '0', card);
    const prevMoveCount = core.players['0'].moveCount;

    const result = reduce(core, {
      type: SW_EVENTS.UNIT_MOVED,
      payload: { from, to },
      timestamp: 0,
    });

    expect(result.board[from.row][from.col].unit).toBeUndefined();
    expect(result.board[to.row][to.col].unit).toBeDefined();
    expect(result.board[to.row][to.col].unit!.hasMoved).toBe(true);
    expect(result.board[to.row][to.col].unit!.position).toEqual(to);
    expect(result.players['0'].moveCount).toBe(prevMoveCount + 1);
  });
});

describe('UNIT_ATTACKED', () => {
  it('标记 hasAttacked + 增加 attackCount + 标记 hasAttackedEnemy', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const pos: CellCoord = { row: 5, col: 3 };
    clearCell(core, pos);
    placeUnit(core, pos, '0', makeUnitCard('attacker'));

    const result = reduce(core, {
      type: SW_EVENTS.UNIT_ATTACKED,
      payload: { attacker: pos, target: { row: 4, col: 3 }, hits: 2 },
      timestamp: 0,
    });

    expect(result.board[pos.row][pos.col].unit!.hasAttacked).toBe(true);
    expect(result.board[pos.row][pos.col].unit!.healingMode).toBe(false);
    expect(result.players['0'].attackCount).toBe(1);
    expect(result.players['0'].hasAttackedEnemy).toBe(true);
  });
});

describe('UNIT_DAMAGED', () => {
  it('伤害不致死时增加 damage', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const pos: CellCoord = { row: 4, col: 4 };
    clearCell(core, pos);
    placeUnit(core, pos, '0', makeUnitCard('tank', { life: 5 }));

    const result = reduce(core, {
      type: SW_EVENTS.UNIT_DAMAGED,
      payload: { position: pos, damage: 2 },
      timestamp: 0,
    });

    expect(result.board[pos.row][pos.col].unit!.damage).toBe(2);
    expect(result.board[pos.row][pos.col].unit!.wasAttackedThisTurn).toBe(true);
  });

  it('致死伤害移除单位 + 卡牌进弃牌堆 + 对方获得魔力', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const pos: CellCoord = { row: 4, col: 4 };
    clearCell(core, pos);
    placeUnit(core, pos, '1', makeUnitCard('victim', { life: 3 }));
    const prevMagic0 = core.players['0'].magic;
    const prevDiscard1 = core.players['1'].discard.length;

    const result = reduce(core, {
      type: SW_EVENTS.UNIT_DAMAGED,
      payload: { position: pos, damage: 3 },
      timestamp: 0,
    });

    expect(result.board[pos.row][pos.col].unit).toBeUndefined();
    expect(result.players['1'].discard.length).toBe(prevDiscard1 + 1);
    expect(result.players['0'].magic).toBe(prevMagic0 + 1);
  });

  it('skipMagicReward 时不给对方魔力', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const pos: CellCoord = { row: 4, col: 4 };
    clearCell(core, pos);
    placeUnit(core, pos, '1', makeUnitCard('soulless-victim', { life: 1 }));
    const prevMagic0 = core.players['0'].magic;

    const result = reduce(core, {
      type: SW_EVENTS.UNIT_DAMAGED,
      payload: { position: pos, damage: 1, skipMagicReward: true },
      timestamp: 0,
    });

    expect(result.board[pos.row][pos.col].unit).toBeUndefined();
    expect(result.players['0'].magic).toBe(prevMagic0);
  });

  it('建筑致死伤害移除建筑', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const pos: CellCoord = { row: 4, col: 4 };
    clearCell(core, pos);
    core.board[pos.row][pos.col].structure = {
      cardId: 'struct-1', card: { id: 'struct-1', cardType: 'structure', name: '测试建筑', cost: 0, life: 2, deckSymbols: [] } as StructureCard,
      owner: '1', position: pos, damage: 0,
    };
    const prevMagic0 = core.players['0'].magic;

    const result = reduce(core, {
      type: SW_EVENTS.UNIT_DAMAGED,
      payload: { position: pos, damage: 2 },
      timestamp: 0,
    });

    expect(result.board[pos.row][pos.col].structure).toBeUndefined();
    expect(result.players['0'].magic).toBe(prevMagic0 + 1);
  });
});

describe('UNIT_HEALED', () => {
  it('减少伤害值（不低于0）', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const pos: CellCoord = { row: 4, col: 4 };
    clearCell(core, pos);
    placeUnit(core, pos, '0', makeUnitCard('wounded', { life: 5 }), { damage: 3 });

    const result = reduce(core, {
      type: SW_EVENTS.UNIT_HEALED,
      payload: { position: pos, amount: 2 },
      timestamp: 0,
    });
    expect(result.board[pos.row][pos.col].unit!.damage).toBe(1);

    // 过量治疗不低于0
    const result2 = reduce(core, {
      type: SW_EVENTS.UNIT_HEALED,
      payload: { position: pos, amount: 99 },
      timestamp: 0,
    });
    expect(result2.board[pos.row][pos.col].unit!.damage).toBe(0);
  });
});

describe('UNIT_CHARGED', () => {
  it('增加充能', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const pos: CellCoord = { row: 4, col: 4 };
    clearCell(core, pos);
    placeUnit(core, pos, '0', makeUnitCard('chargeable'), { boosts: 1 });

    const result = reduce(core, {
      type: SW_EVENTS.UNIT_CHARGED,
      payload: { position: pos, delta: 2 },
      timestamp: 0,
    });
    expect(result.board[pos.row][pos.col].unit!.boosts).toBe(3);
  });

  it('newValue 覆盖计算', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const pos: CellCoord = { row: 4, col: 4 };
    clearCell(core, pos);
    placeUnit(core, pos, '0', makeUnitCard('chargeable2'), { boosts: 5 });

    const result = reduce(core, {
      type: SW_EVENTS.UNIT_CHARGED,
      payload: { position: pos, delta: -2, newValue: 0 },
      timestamp: 0,
    });
    expect(result.board[pos.row][pos.col].unit!.boosts).toBe(0);
  });
});

describe('UNIT_DESTROYED', () => {
  it('移除单位并放入弃牌堆', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const pos: CellCoord = { row: 4, col: 4 };
    clearCell(core, pos);
    placeUnit(core, pos, '1', makeUnitCard('destroyed-unit'));
    const prevDiscard = core.players['1'].discard.length;

    const result = reduce(core, {
      type: SW_EVENTS.UNIT_DESTROYED,
      payload: { position: pos, cardId: 'destroyed-unit', cardName: '测试', owner: '1' },
      timestamp: 0,
    });

    expect(result.board[pos.row][pos.col].unit).toBeUndefined();
    expect(result.players['1'].discard.length).toBe(prevDiscard + 1);
  });
});

// ============================================================================
// 资源 / 卡牌 / 事件
// ============================================================================

describe('MAGIC_CHANGED', () => {
  it('增加魔力', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    core.players['0'].magic = 3;
    const result = reduce(core, {
      type: SW_EVENTS.MAGIC_CHANGED,
      payload: { playerId: '0', delta: 2 },
      timestamp: 0,
    });
    expect(result.players['0'].magic).toBe(5);
  });

  it('减少魔力（不低于0）', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    core.players['0'].magic = 1;
    const result = reduce(core, {
      type: SW_EVENTS.MAGIC_CHANGED,
      payload: { playerId: '0', delta: -5 },
      timestamp: 0,
    });
    expect(result.players['0'].magic).toBe(0);
  });
});

describe('CARD_DRAWN', () => {
  it('从牌组抽牌到手牌', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const prevHand = core.players['0'].hand.length;
    const prevDeck = core.players['0'].deck.length;

    const result = reduce(core, {
      type: SW_EVENTS.CARD_DRAWN,
      payload: { playerId: '0', count: 2 },
      timestamp: 0,
    });

    expect(result.players['0'].hand.length).toBe(prevHand + Math.min(2, prevDeck));
    expect(result.players['0'].deck.length).toBe(prevDeck - Math.min(2, prevDeck));
  });
});

describe('CARD_DISCARDED', () => {
  it('从手牌弃到弃牌堆', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const card = makeUnitCard('discard-me');
    core.players['0'].hand.push(card);
    const prevDiscard = core.players['0'].discard.length;

    const result = reduce(core, {
      type: SW_EVENTS.CARD_DISCARDED,
      payload: { playerId: '0', cardId: 'discard-me' },
      timestamp: 0,
    });

    expect(result.players['0'].hand.find(c => c.id === 'discard-me')).toBeUndefined();
    expect(result.players['0'].discard.length).toBe(prevDiscard + 1);
  });
});

describe('EVENT_PLAYED', () => {
  it('非主动事件进弃牌堆', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const card = makeEventCard('instant-event');
    core.players['0'].hand.push(card);

    const result = reduce(core, {
      type: SW_EVENTS.EVENT_PLAYED,
      payload: { playerId: '0', cardId: 'instant-event', card, isActive: false },
      timestamp: 0,
    });

    expect(result.players['0'].hand.find(c => c.id === 'instant-event')).toBeUndefined();
    expect(result.players['0'].discard.some(c => c.id === 'instant-event')).toBe(true);
    expect(result.players['0'].activeEvents.some(c => c.id === 'instant-event')).toBe(false);
  });

  it('主动事件进主动事件区', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const card = makeEventCard('active-event');
    core.players['0'].hand.push(card);

    const result = reduce(core, {
      type: SW_EVENTS.EVENT_PLAYED,
      payload: { playerId: '0', cardId: 'active-event', card, isActive: true },
      timestamp: 0,
    });

    expect(result.players['0'].activeEvents.some(c => c.id === 'active-event')).toBe(true);
    expect(result.players['0'].discard.some(c => c.id === 'active-event')).toBe(false);
  });

  it('附着事件不进弃牌堆也不进主动区', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const card = makeEventCard('attach-event');
    core.players['0'].hand.push(card);

    const result = reduce(core, {
      type: SW_EVENTS.EVENT_PLAYED,
      payload: { playerId: '0', cardId: 'attach-event', card, isActive: false, isAttachment: true },
      timestamp: 0,
    });

    expect(result.players['0'].hand.find(c => c.id === 'attach-event')).toBeUndefined();
    expect(result.players['0'].discard.some(c => c.id === 'attach-event')).toBe(false);
    expect(result.players['0'].activeEvents.some(c => c.id === 'attach-event')).toBe(false);
  });
});

describe('ACTIVE_EVENT_DISCARDED', () => {
  it('从主动事件区移到弃牌堆', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const card = makeEventCard('active-to-discard');
    core.players['0'].activeEvents.push(card);

    const result = reduce(core, {
      type: SW_EVENTS.ACTIVE_EVENT_DISCARDED,
      payload: { playerId: '0', cardId: 'active-to-discard' },
      timestamp: 0,
    });

    expect(result.players['0'].activeEvents.some(c => c.id === 'active-to-discard')).toBe(false);
    expect(result.players['0'].discard.some(c => c.id === 'active-to-discard')).toBe(true);
  });

  it('不存在的卡不修改状态', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const result = reduce(core, {
      type: SW_EVENTS.ACTIVE_EVENT_DISCARDED,
      payload: { playerId: '0', cardId: 'nonexistent' },
      timestamp: 0,
    });
    expect(result).toEqual(core);
  });
});

describe('CARD_RETRIEVED', () => {
  it('从弃牌堆拿回手牌', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const card = makeUnitCard('retrieve-me');
    core.players['0'].discard.push(card);

    const result = reduce(core, {
      type: SW_EVENTS.CARD_RETRIEVED,
      payload: { playerId: '0', cardId: 'retrieve-me' },
      timestamp: 0,
    });

    expect(result.players['0'].discard.find(c => c.id === 'retrieve-me')).toBeUndefined();
    expect(result.players['0'].hand.some(c => c.id === 'retrieve-me')).toBe(true);
  });
});

// ============================================================================
// 阶段 / 回合
// ============================================================================

describe('PHASE_CHANGED', () => {
  it('切换阶段并清除选中状态', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    core.selectedUnit = { row: 1, col: 1 };

    const result = reduce(core, {
      type: SW_EVENTS.PHASE_CHANGED,
      payload: { to: 'attack' },
      timestamp: 0,
    });

    expect(result.phase).toBe('attack');
    expect(result.selectedUnit).toBeUndefined();
  });
});

describe('TURN_CHANGED', () => {
  it('切换当前玩家 + 重置单位状态 + 重置计数器', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    core.currentPlayer = '0';
    core.players['0'].moveCount = 3;
    core.players['0'].attackCount = 2;
    core.players['0'].hasAttackedEnemy = true;
    // 标记一个单位为已移动/已攻击
    const pos: CellCoord = { row: 4, col: 4 };
    clearCell(core, pos);
    placeUnit(core, pos, '1', makeUnitCard('reset-test'), { hasMoved: true, hasAttacked: true });

    const result = reduce(core, {
      type: SW_EVENTS.TURN_CHANGED,
      payload: { from: '0', to: '1' },
      timestamp: 0,
    });

    expect(result.currentPlayer).toBe('1');
    expect(result.phase).toBe('summon');
    expect(result.players['1'].moveCount).toBe(0);
    expect(result.players['1'].attackCount).toBe(0);
    expect(result.players['1'].hasAttackedEnemy).toBe(false);
    // 所有单位重置
    expect(result.board[pos.row][pos.col].unit!.hasMoved).toBe(false);
    expect(result.board[pos.row][pos.col].unit!.hasAttacked).toBe(false);
  });
});

// ============================================================================
// 技能系统事件
// ============================================================================

describe('CONTROL_TRANSFERRED', () => {
  it('改变单位 owner', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const pos: CellCoord = { row: 4, col: 4 };
    clearCell(core, pos);
    placeUnit(core, pos, '1', makeUnitCard('transfer-target'));

    const result = reduce(core, {
      type: SW_EVENTS.CONTROL_TRANSFERRED,
      payload: { targetPosition: pos, newOwner: '0' },
      timestamp: 0,
    });

    expect(result.board[pos.row][pos.col].unit!.owner).toBe('0');
  });
});

describe('UNITS_SWAPPED', () => {
  it('交换两个单位位置', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const posA: CellCoord = { row: 4, col: 3 };
    const posB: CellCoord = { row: 4, col: 4 };
    clearCell(core, posA);
    clearCell(core, posB);
    placeUnit(core, posA, '0', makeUnitCard('unit-a'));
    placeUnit(core, posB, '0', makeUnitCard('unit-b'));

    const result = reduce(core, {
      type: SW_EVENTS.UNITS_SWAPPED,
      payload: { positionA: posA, positionB: posB },
      timestamp: 0,
    });

    expect(result.board[posA.row][posA.col].unit!.cardId).toBe('unit-b');
    expect(result.board[posB.row][posB.col].unit!.cardId).toBe('unit-a');
    expect(result.board[posA.row][posA.col].unit!.position).toEqual(posA);
    expect(result.board[posB.row][posB.col].unit!.position).toEqual(posB);
  });
});

describe('UNIT_PUSHED / UNIT_PULLED', () => {
  it('推拉移动单位到新位置', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const from: CellCoord = { row: 4, col: 3 };
    const to: CellCoord = { row: 4, col: 4 };
    clearCell(core, from);
    clearCell(core, to);
    placeUnit(core, from, '1', makeUnitCard('pushed'));

    const result = reduce(core, {
      type: SW_EVENTS.UNIT_PUSHED,
      payload: { targetPosition: from, newPosition: to },
      timestamp: 0,
    });

    expect(result.board[from.row][from.col].unit).toBeUndefined();
    expect(result.board[to.row][to.col].unit!.cardId).toBe('pushed');
  });

  it('无 newPosition 时不移动', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const pos: CellCoord = { row: 4, col: 3 };
    clearCell(core, pos);
    placeUnit(core, pos, '1', makeUnitCard('blocked'));

    const result = reduce(core, {
      type: SW_EVENTS.UNIT_PUSHED,
      payload: { targetPosition: pos },
      timestamp: 0,
    });

    expect(result.board[pos.row][pos.col].unit!.cardId).toBe('blocked');
  });
});

describe('HYPNOTIC_LURE_MARKED', () => {
  it('在主动事件上标记目标单位 ID', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const card = makeEventCard('lure-card');
    core.players['0'].activeEvents.push(card);

    const result = reduce(core, {
      type: SW_EVENTS.HYPNOTIC_LURE_MARKED,
      payload: { playerId: '0', cardId: 'lure-card', targetUnitId: 'target-123' },
      timestamp: 0,
    });

    const lure = result.players['0'].activeEvents.find(c => c.id === 'lure-card');
    expect(lure?.targetUnitId).toBe('target-123');
  });
});

describe('HEALING_MODE_SET', () => {
  it('标记单位为治疗模式', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const pos: CellCoord = { row: 4, col: 4 };
    clearCell(core, pos);
    placeUnit(core, pos, '0', makeUnitCard('healer'));

    const result = reduce(core, {
      type: SW_EVENTS.HEALING_MODE_SET,
      payload: { position: pos },
      timestamp: 0,
    });

    expect(result.board[pos.row][pos.col].unit!.healingMode).toBe(true);
  });
});

describe('STRUCTURE_HEALED', () => {
  it('减少建筑伤害', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const pos: CellCoord = { row: 4, col: 4 };
    clearCell(core, pos);
    core.board[pos.row][pos.col].structure = {
      cardId: 'struct-heal', card: { id: 'struct-heal', cardType: 'structure', name: '建筑', cost: 0, life: 5, deckSymbols: [] } as StructureCard,
      owner: '0', position: pos, damage: 3,
    };

    const result = reduce(core, {
      type: SW_EVENTS.STRUCTURE_HEALED,
      payload: { position: pos, amount: 2 },
      timestamp: 0,
    });

    expect(result.board[pos.row][pos.col].structure!.damage).toBe(1);
  });
});

describe('FUNERAL_PYRE_CHARGED', () => {
  it('增加充能（默认+1）', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const card = makeEventCard('fp-charge', { charges: 1 });
    core.players['0'].activeEvents.push(card);

    const result = reduce(core, {
      type: SW_EVENTS.FUNERAL_PYRE_CHARGED,
      payload: { playerId: '0', eventCardId: 'fp-charge' },
      timestamp: 0,
    });

    const fp = result.players['0'].activeEvents.find(c => c.id === 'fp-charge');
    expect(fp?.charges).toBe(2);
  });

  it('绝对充能值覆盖', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const card = makeEventCard('fp-abs', { charges: 5 });
    core.players['0'].activeEvents.push(card);

    const result = reduce(core, {
      type: SW_EVENTS.FUNERAL_PYRE_CHARGED,
      payload: { playerId: '0', eventCardId: 'fp-abs', charges: 0 },
      timestamp: 0,
    });

    const fp = result.players['0'].activeEvents.find(c => c.id === 'fp-abs');
    expect(fp?.charges).toBe(0);
  });
});

describe('EVENT_ATTACHED', () => {
  it('将事件卡附着到单位', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const pos: CellCoord = { row: 4, col: 4 };
    clearCell(core, pos);
    placeUnit(core, pos, '0', makeUnitCard('attach-target'));
    const eventCard = makeEventCard('attached-event');

    const result = reduce(core, {
      type: SW_EVENTS.EVENT_ATTACHED,
      payload: { playerId: '0', cardId: 'attached-event', card: eventCard, targetPosition: pos },
      timestamp: 0,
    });

    expect(result.board[pos.row][pos.col].unit!.attachedCards).toHaveLength(1);
    expect(result.board[pos.row][pos.col].unit!.attachedCards![0].id).toBe('attached-event');
  });
});

// ============================================================================
// 通知事件（不修改状态）
// ============================================================================

describe('通知事件不修改状态', () => {
  const notificationEvents = [
    SW_EVENTS.ABILITY_TRIGGERED,
    SW_EVENTS.STRENGTH_MODIFIED,
    SW_EVENTS.SUMMON_FROM_DISCARD_REQUESTED,
    SW_EVENTS.SOUL_TRANSFER_REQUESTED,
    SW_EVENTS.MIND_CAPTURE_REQUESTED,
    SW_EVENTS.EXTRA_ATTACK_GRANTED,
    SW_EVENTS.DAMAGE_REDUCED,
    SW_EVENTS.GRAB_FOLLOW_REQUESTED,
  ];

  it.each(notificationEvents)('%s 不修改状态', (eventType) => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const result = reduce(core, { type: eventType, payload: {}, timestamp: 0 });
    expect(result).toBe(core);
  });
});

// ============================================================================
// 阵营选择事件
// ============================================================================

describe('阵营选择事件', () => {
  it('FACTION_SELECTED 更新选择', () => {
    const core = SummonerWarsDomain.setup(['0', '1'], createTestRandom());
    const result = reduce(core, {
      type: SW_SELECTION_EVENTS.FACTION_SELECTED,
      payload: { playerId: '0', factionId: 'trickster' },
      timestamp: 0,
    });
    expect(result.selectedFactions['0']).toBe('trickster');
  });

  it('PLAYER_READY 更新准备状态', () => {
    const core = SummonerWarsDomain.setup(['0', '1'], createTestRandom());
    const result = reduce(core, {
      type: SW_SELECTION_EVENTS.PLAYER_READY,
      payload: { playerId: '1' },
      timestamp: 0,
    });
    expect(result.readyPlayers['1']).toBe(true);
  });

  it('HOST_STARTED 标记游戏开始', () => {
    const core = SummonerWarsDomain.setup(['0', '1'], createTestRandom());
    const result = reduce(core, {
      type: SW_SELECTION_EVENTS.HOST_STARTED,
      payload: {},
      timestamp: 0,
    });
    expect(result.hostStarted).toBe(true);
  });
});

describe('未知事件类型', () => {
  it('返回原状态', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const result = reduce(core, { type: 'unknown_event', payload: {}, timestamp: 0 });
    expect(result).toBe(core);
  });
});
