/**
 * 远程攻击遮挡规则测试
 *
 * 规则：远程攻击路径上的中间格子不能有任何卡牌（单位或建筑）。
 * 例外：友方护城墙（frost-parapet）允许友方远程攻击穿过。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type {
  SummonerWarsCore, PlayerId, BoardUnit, BoardStructure, BoardCell,
  UnitCard, StructureCard, CellCoord,
} from '../domain/types';
import {
  canAttack, canAttackEnhanced, isRangedPathClear,
  getValidAttackTargetsEnhanced,
  BOARD_ROWS, BOARD_COLS,
} from '../domain/helpers';
import { generateInstanceId } from '../domain/utils';

// ============================================================================
// 工具函数
// ============================================================================

function createMinimalState(): SummonerWarsCore {
  const emptyBoard: BoardCell[][] = Array.from({ length: BOARD_ROWS }, () =>
    Array.from({ length: BOARD_COLS }, () => ({}))
  );
  return {
    board: emptyBoard,
    players: {
      '0': { id: '0', magic: 5, hand: [], deck: [], discard: [], activeEvents: [], summonerId: 's0', moveCount: 0, attackCount: 0, hasAttackedEnemy: false },
      '1': { id: '1', magic: 5, hand: [], deck: [], discard: [], activeEvents: [], summonerId: 's1', moveCount: 0, attackCount: 0, hasAttackedEnemy: false },
    },
    phase: 'attack',
    currentPlayer: '0',
    turnNumber: 1,
    selectedFactions: { '0': 'frost', '1': 'necromancer' },
    readyPlayers: { '0': true, '1': true },
    hostPlayerId: '0',
    hostStarted: true,
    abilityUsageCount: {},
  };
}

function makeRangedUnit(id: string, faction = 'frost' as const): UnitCard {
  return {
    id, cardType: 'unit', name: '远程兵', unitClass: 'common',
    faction, strength: 2, life: 3, cost: 1,
    attackType: 'ranged', attackRange: 3, deckSymbols: [],
  };
}

function makeMeleeUnit(id: string, faction = 'frost' as const): UnitCard {
  return {
    id, cardType: 'unit', name: '近战兵', unitClass: 'common',
    faction, strength: 2, life: 3, cost: 1,
    attackType: 'melee', attackRange: 1, deckSymbols: [],
  };
}

function makeGate(id: string): StructureCard {
  return {
    id, cardType: 'structure', name: '城门', faction: 'frost',
    cost: 0, life: 5, isGate: true, deckSymbols: [],
  };
}

function makeParapet(id: string): StructureCard {
  return {
    id, cardType: 'structure', name: '护城墙', faction: 'frost',
    cost: 0, life: 5, isGate: false, deckSymbols: [],
  };
}

function placeUnit(state: SummonerWarsCore, pos: CellCoord, unit: Partial<BoardUnit> & { card: UnitCard; owner: PlayerId }) {
  const cardId = unit.cardId ?? unit.card.id;
  state.board[pos.row][pos.col].unit = {
    instanceId: unit.instanceId ?? generateInstanceId(cardId),
    cardId,
    card: unit.card, owner: unit.owner, position: pos,
    damage: unit.damage ?? 0, boosts: unit.boosts ?? 0,
    hasMoved: unit.hasMoved ?? false, hasAttacked: unit.hasAttacked ?? false,
  };
}

function placeStructure(state: SummonerWarsCore, pos: CellCoord, structure: Partial<BoardStructure> & { card: StructureCard; owner: PlayerId }) {
  state.board[pos.row][pos.col].structure = {
    cardId: structure.cardId ?? structure.card.id,
    card: structure.card, owner: structure.owner, position: pos,
    damage: structure.damage ?? 0,
  };
}

// ============================================================================
// 测试
// ============================================================================

describe('远程攻击遮挡规则', () => {
  let state: SummonerWarsCore;

  beforeEach(() => {
    state = createMinimalState();
  });

  // --------------------------------------------------------------------------
  // 基础遮挡
  // --------------------------------------------------------------------------

  it('无遮挡时远程攻击正常命中', () => {
    // 攻击者 (3,1) → 目标 (3,4)，中间无卡牌
    placeUnit(state, { row: 3, col: 1 }, { card: makeRangedUnit('archer'), owner: '0' });
    placeUnit(state, { row: 3, col: 4 }, { card: makeMeleeUnit('enemy'), owner: '1' });

    expect(canAttack(state, { row: 3, col: 1 }, { row: 3, col: 4 })).toBe(true);
    expect(canAttackEnhanced(state, { row: 3, col: 1 }, { row: 3, col: 4 })).toBe(true);
  });

  it('中间有敌方单位时远程攻击被遮挡', () => {
    // 攻击者 (3,1) → 目标 (3,4)，(3,2) 有敌方单位
    placeUnit(state, { row: 3, col: 1 }, { card: makeRangedUnit('archer'), owner: '0' });
    placeUnit(state, { row: 3, col: 2 }, { card: makeMeleeUnit('blocker'), owner: '1' });
    placeUnit(state, { row: 3, col: 4 }, { card: makeMeleeUnit('target'), owner: '1' });

    expect(canAttack(state, { row: 3, col: 1 }, { row: 3, col: 4 })).toBe(false);
    expect(canAttackEnhanced(state, { row: 3, col: 1 }, { row: 3, col: 4 })).toBe(false);
  });

  it('中间有友方单位时远程攻击被遮挡', () => {
    // 攻击者 (3,1) → 目标 (3,3)，(3,2) 有友方单位
    placeUnit(state, { row: 3, col: 1 }, { card: makeRangedUnit('archer'), owner: '0' });
    placeUnit(state, { row: 3, col: 2 }, { card: makeMeleeUnit('ally'), owner: '0' });
    placeUnit(state, { row: 3, col: 3 }, { card: makeMeleeUnit('target'), owner: '1' });

    expect(canAttack(state, { row: 3, col: 1 }, { row: 3, col: 3 })).toBe(false);
  });

  it('中间有建筑时远程攻击被遮挡', () => {
    // 攻击者 (3,1) → 目标 (3,3)，(3,2) 有建筑
    placeUnit(state, { row: 3, col: 1 }, { card: makeRangedUnit('archer'), owner: '0' });
    placeStructure(state, { row: 3, col: 2 }, { card: makeGate('gate'), owner: '1' });
    placeUnit(state, { row: 3, col: 3 }, { card: makeMeleeUnit('target'), owner: '1' });

    expect(canAttack(state, { row: 3, col: 1 }, { row: 3, col: 3 })).toBe(false);
  });

  it('纵向远程攻击也检查遮挡', () => {
    // 攻击者 (1,3) → 目标 (4,3)，(2,3) 有单位
    placeUnit(state, { row: 1, col: 3 }, { card: makeRangedUnit('archer'), owner: '0' });
    placeUnit(state, { row: 2, col: 3 }, { card: makeMeleeUnit('blocker'), owner: '1' });
    placeUnit(state, { row: 4, col: 3 }, { card: makeMeleeUnit('target'), owner: '1' });

    expect(canAttack(state, { row: 1, col: 3 }, { row: 4, col: 3 })).toBe(false);
  });

  it('相邻远程攻击无需遮挡检查（距离1无中间格）', () => {
    placeUnit(state, { row: 3, col: 2 }, { card: makeRangedUnit('archer'), owner: '0' });
    placeUnit(state, { row: 3, col: 3 }, { card: makeMeleeUnit('target'), owner: '1' });

    expect(canAttack(state, { row: 3, col: 2 }, { row: 3, col: 3 })).toBe(true);
  });

  it('距离2远程攻击中间有遮挡', () => {
    // (3,1) → (3,3)，(3,2) 有单位
    placeUnit(state, { row: 3, col: 1 }, { card: makeRangedUnit('archer'), owner: '0' });
    placeUnit(state, { row: 3, col: 2 }, { card: makeMeleeUnit('blocker'), owner: '0' });
    placeUnit(state, { row: 3, col: 3 }, { card: makeMeleeUnit('target'), owner: '1' });

    expect(canAttack(state, { row: 3, col: 1 }, { row: 3, col: 3 })).toBe(false);
  });

  it('近战攻击不受遮挡影响', () => {
    placeUnit(state, { row: 3, col: 2 }, { card: makeMeleeUnit('melee'), owner: '0' });
    placeUnit(state, { row: 3, col: 3 }, { card: makeMeleeUnit('target'), owner: '1' });

    expect(canAttack(state, { row: 3, col: 2 }, { row: 3, col: 3 })).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 护城墙穿透
  // --------------------------------------------------------------------------

  it('友方护城墙允许友方远程攻击穿过', () => {
    // 攻击者 (3,1) → 目标 (3,3)，(3,2) 有友方护城墙
    placeUnit(state, { row: 3, col: 1 }, { card: makeRangedUnit('archer'), owner: '0' });
    placeStructure(state, { row: 3, col: 2 }, {
      cardId: 'frost-parapet-0', card: makeParapet('frost-parapet'), owner: '0',
    });
    placeUnit(state, { row: 3, col: 3 }, { card: makeMeleeUnit('target'), owner: '1' });

    expect(canAttack(state, { row: 3, col: 1 }, { row: 3, col: 3 })).toBe(true);
    expect(canAttackEnhanced(state, { row: 3, col: 1 }, { row: 3, col: 3 })).toBe(true);
  });

  it('敌方护城墙不允许穿过', () => {
    placeUnit(state, { row: 3, col: 1 }, { card: makeRangedUnit('archer'), owner: '0' });
    placeStructure(state, { row: 3, col: 2 }, {
      cardId: 'frost-parapet-0', card: makeParapet('frost-parapet'), owner: '1',
    });
    placeUnit(state, { row: 3, col: 3 }, { card: makeMeleeUnit('target'), owner: '1' });

    expect(canAttack(state, { row: 3, col: 1 }, { row: 3, col: 3 })).toBe(false);
  });

  it('友方普通城门不允许穿过', () => {
    placeUnit(state, { row: 3, col: 1 }, { card: makeRangedUnit('archer'), owner: '0' });
    placeStructure(state, { row: 3, col: 2 }, {
      cardId: 'gate-0', card: makeGate('gate'), owner: '0',
    });
    placeUnit(state, { row: 3, col: 3 }, { card: makeMeleeUnit('target'), owner: '1' });

    expect(canAttack(state, { row: 3, col: 1 }, { row: 3, col: 3 })).toBe(false);
  });

  // --------------------------------------------------------------------------
  // getValidAttackTargetsEnhanced 集成
  // --------------------------------------------------------------------------

  it('getValidAttackTargetsEnhanced 排除被遮挡的目标', () => {
    // 攻击者 (3,1)，友方 (3,2)，敌方 (3,3) 和 (3,4)
    placeUnit(state, { row: 3, col: 1 }, { card: makeRangedUnit('archer'), owner: '0' });
    placeUnit(state, { row: 3, col: 2 }, { card: makeMeleeUnit('ally'), owner: '0' });
    placeUnit(state, { row: 3, col: 3 }, { card: makeMeleeUnit('enemy1'), owner: '1' });
    placeUnit(state, { row: 3, col: 4 }, { card: makeMeleeUnit('enemy2'), owner: '1' });

    const targets = getValidAttackTargetsEnhanced(state, { row: 3, col: 1 });
    // (3,3) 和 (3,4) 都被 (3,2) 遮挡
    expect(targets).toEqual([]);
  });

  it('getValidAttackTargetsEnhanced 包含未被遮挡的目标', () => {
    // 攻击者 (3,1)，敌方 (3,3)（无遮挡），敌方 (1,1)（纵向无遮挡）
    placeUnit(state, { row: 3, col: 1 }, { card: makeRangedUnit('archer'), owner: '0' });
    placeUnit(state, { row: 3, col: 3 }, { card: makeMeleeUnit('enemy1'), owner: '1' });
    placeUnit(state, { row: 1, col: 1 }, { card: makeMeleeUnit('enemy2'), owner: '1' });

    const targets = getValidAttackTargetsEnhanced(state, { row: 3, col: 1 });
    expect(targets).toContainEqual({ row: 3, col: 3 });
    expect(targets).toContainEqual({ row: 1, col: 1 });
  });

  // --------------------------------------------------------------------------
  // isRangedPathClear 单元测试
  // --------------------------------------------------------------------------

  it('isRangedPathClear 空路径返回 true', () => {
    expect(isRangedPathClear(state, { row: 3, col: 1 }, { row: 3, col: 3 }, '0')).toBe(true);
  });

  it('isRangedPathClear 有单位返回 false', () => {
    placeUnit(state, { row: 3, col: 2 }, { card: makeMeleeUnit('blocker'), owner: '1' });
    expect(isRangedPathClear(state, { row: 3, col: 1 }, { row: 3, col: 3 }, '0')).toBe(false);
  });

  it('isRangedPathClear 友方护城墙返回 true', () => {
    placeStructure(state, { row: 3, col: 2 }, {
      cardId: 'frost-parapet-0', card: makeParapet('frost-parapet'), owner: '0',
    });
    expect(isRangedPathClear(state, { row: 3, col: 1 }, { row: 3, col: 3 }, '0')).toBe(true);
  });
});
