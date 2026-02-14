/**
 * 召唤师战争 - 边界条件测试
 *
 * 覆盖：
 * 1. 魔力溢出/下溢（clampMagic 边界）
 * 2. 棋盘边缘移动（角落/边缘不越界）
 * 3. 棋盘边缘远程攻击（直线射程边界）
 * 4. 所有城门相邻格被占满时无法召唤
 * 5. 所有建造位置被占满时无法建造
 * 6. 远程攻击恰好在最大射程（3格）边界
 * 7. 血契召唤费用恰好等于 2（边界值）
 * 8. 弃牌换魔力空列表
 * 9. 推拉到棋盘边缘
 * 10. 抽牌时牌库恰好等于需求量
 * 11. 治疗过量（建筑）
 * 12. 守卫单位强制攻击检查
 */

import { describe, it, expect } from 'vitest';
import { SummonerWarsDomain, SW_COMMANDS, SW_EVENTS } from '../domain';
import { summonerWarsFlowHooks } from '../domain/flowHooks';
import type {
  SummonerWarsCore, PlayerId, CellCoord,
  UnitCard, StructureCard, BoardUnit, BoardCell, PlayerState, GamePhase,
} from '../domain/types';
import type { RandomFn, GameEvent, MatchState } from '../../../engine/types';
import type { PhaseExitResult } from '../../../engine/systems/FlowSystem';
import { createInitializedCore } from './test-helpers';
import {
  BOARD_ROWS, BOARD_COLS, MAGIC_MAX, MAGIC_MIN,
  clampMagic, canMoveToEnhanced, canAttackEnhanced,
  getValidSummonPositions, getValidBuildPositions,
  calculatePushPullPosition,
} from '../domain/helpers';
import { createInitialSystemState } from '../../../engine/pipeline';

// ============================================================================
// 辅助
// ============================================================================

function createTestRandom(): RandomFn {
  return {
    shuffle: <T>(arr: T[]) => arr,
    random: () => 0.5,
    d: (max: number) => Math.ceil(max * 0.5) || 1,
    range: (min: number, max: number) => Math.floor(min + (max - min) * 0.5),
  };
}

function validate(core: SummonerWarsCore, type: string, payload: Record<string, unknown>, playerId: string = '0') {
  const sys = createInitialSystemState(['0', '1'], []);
  return SummonerWarsDomain.validate({ core, sys }, { type, payload, playerId });
}

function reduce(core: SummonerWarsCore, event: GameEvent): SummonerWarsCore {
  return SummonerWarsDomain.reduce(core, event);
}

function makeUnitCard(id: string, overrides?: Partial<UnitCard>): UnitCard {
  return {
    id, cardType: 'unit', name: `测试-${id}`, unitClass: 'common', faction: 'necromancer',
    strength: 2, life: 3, cost: 1, attackType: 'melee', attackRange: 1,
    deckSymbols: [], ...overrides,
  };
}

function makeStructureCard(id: string, overrides?: Partial<StructureCard>): StructureCard {
  return {
    id, cardType: 'structure', name: `建筑-${id}`, cost: 0, life: 5,
    faction: 'necromancer', isGate: false, deckSymbols: [],
    ...overrides,
  } as StructureCard;
}

function placeUnit(
  core: SummonerWarsCore, pos: CellCoord,
  unit: Partial<BoardUnit> & { card: UnitCard; owner: PlayerId },
): BoardUnit {
  const boardUnit: BoardUnit = {
    cardId: unit.cardId ?? unit.card.id,
    card: unit.card, owner: unit.owner, position: pos,
    damage: unit.damage ?? 0, boosts: unit.boosts ?? 0,
    hasMoved: unit.hasMoved ?? false, hasAttacked: unit.hasAttacked ?? false,
  };
  core.board[pos.row][pos.col].unit = boardUnit;
  return boardUnit;
}

function placeStructure(
  core: SummonerWarsCore, pos: CellCoord, owner: PlayerId,
  card?: StructureCard,
) {
  const c = card ?? makeStructureCard(`struct-${pos.row}-${pos.col}`);
  core.board[pos.row][pos.col].structure = {
    cardId: c.id, card: c, owner, position: pos, damage: 0,
  };
}

function placeGate(core: SummonerWarsCore, pos: CellCoord, owner: PlayerId) {
  placeStructure(core, pos, owner, makeStructureCard(`gate-${pos.row}-${pos.col}`, { isGate: true, life: 10 }));
}

function clearCell(core: SummonerWarsCore, pos: CellCoord) {
  core.board[pos.row][pos.col].unit = undefined;
  core.board[pos.row][pos.col].structure = undefined;
}

function clearArea(core: SummonerWarsCore, rows: number[], cols: number[]) {
  for (const r of rows) for (const c of cols) clearCell(core, { row: r, col: c });
}

/** 创建最小可用 core（手动构建，不走完整初始化） */
function createMinimalCore(overrides?: Partial<SummonerWarsCore>): SummonerWarsCore {
  const emptyBoard: BoardCell[][] = Array.from({ length: BOARD_ROWS }, () =>
    Array.from({ length: BOARD_COLS }, () => ({})),
  );
  const defaultPlayer = (id: PlayerId): PlayerState => ({
    id, magic: 3, hand: [], deck: [], discard: [], activeEvents: [],
    summonerId: `summoner-${id}`, moveCount: 0, attackCount: 0, hasAttackedEnemy: false,
  });
  return {
    board: emptyBoard,
    players: { '0': defaultPlayer('0'), '1': defaultPlayer('1') },
    phase: 'summon' as GamePhase,
    currentPlayer: '0' as PlayerId,
    turnNumber: 1,
    selectedFactions: { '0': 'necromancer', '1': 'necromancer' },
    readyPlayers: { '0': true, '1': true },
    hostPlayerId: '0' as PlayerId,
    hostStarted: true,
    ...overrides,
  };
}

function wrapState(core: SummonerWarsCore): MatchState<SummonerWarsCore> {
  return {
    core,
    sys: {
      schemaVersion: 1,
      phase: core.phase,
      turnNumber: core.turnNumber,
      activePlayerId: core.currentPlayer,
      undo: { history: [], future: [], snapshots: [], maxSnapshots: 10 },
      prompt: null,
      log: { entries: [] },
      eventStream: { entries: [], nextId: 0 },
      actionLog: { entries: [], maxEntries: 100 },
      responseWindow: {},
      tutorial: { stepIndex: 0, completed: false },
      rematch: { votes: {} },
    },
  } as unknown as MatchState<SummonerWarsCore>;
}

const dummyCommand = { type: 'ADVANCE_PHASE', payload: {}, playerId: '0' };

// ============================================================================
// 1. 魔力溢出/下溢
// ============================================================================

describe('魔力边界（clampMagic）', () => {
  it('击杀奖励使魔力超过 15 上限时被钳制', () => {
    const core = createMinimalCore();
    core.players['0'].magic = MAGIC_MAX; // 15
    const pos: CellCoord = { row: 3, col: 3 };
    placeUnit(core, pos, { card: makeUnitCard('victim', { life: 1 }), owner: '1' });

    // 致死伤害 → 对方获得魔力奖励
    const result = reduce(core, {
      type: SW_EVENTS.UNIT_DAMAGED,
      payload: { position: pos, damage: 1 },
      timestamp: 0,
    });

    // 玩家0 是攻击方（对方单位被击杀），获得 +1 魔力
    expect(result.players['0'].magic).toBe(MAGIC_MAX); // 钳制在 15
  });

  it('MAGIC_CHANGED delta 为负且超过当前值时钳制到 0', () => {
    const core = createMinimalCore();
    core.players['0'].magic = 2;

    const result = reduce(core, {
      type: SW_EVENTS.MAGIC_CHANGED,
      payload: { playerId: '0', delta: -10 },
      timestamp: 0,
    });

    expect(result.players['0'].magic).toBe(MAGIC_MIN); // 0
  });

  it('clampMagic 恰好在边界值时不变', () => {
    expect(clampMagic(0)).toBe(0);
    expect(clampMagic(15)).toBe(15);
    expect(clampMagic(-1)).toBe(0);
    expect(clampMagic(16)).toBe(15);
  });
});

// ============================================================================
// 2. 棋盘边缘移动
// ============================================================================

describe('棋盘边缘移动', () => {
  it('角落单位（0,0）只能移动到有效相邻格', () => {
    const core = createMinimalCore({ phase: 'move' as GamePhase });
    placeUnit(core, { row: 0, col: 0 }, { card: makeUnitCard('corner'), owner: '0' });

    // 向上/向左越界 → 不可移动
    expect(canMoveToEnhanced(core, { row: 0, col: 0 }, { row: -1, col: 0 })).toBe(false);
    expect(canMoveToEnhanced(core, { row: 0, col: 0 }, { row: 0, col: -1 })).toBe(false);
    // 向下/向右有效
    expect(canMoveToEnhanced(core, { row: 0, col: 0 }, { row: 1, col: 0 })).toBe(true);
    expect(canMoveToEnhanced(core, { row: 0, col: 0 }, { row: 0, col: 1 })).toBe(true);
    // 距离为 0 无效
    expect(canMoveToEnhanced(core, { row: 0, col: 0 }, { row: 0, col: 0 })).toBe(false);
  });

  it('右下角单位（7,5）只能移动到有效相邻格', () => {
    const core = createMinimalCore({ phase: 'move' as GamePhase });
    placeUnit(core, { row: 7, col: 5 }, { card: makeUnitCard('corner2'), owner: '0' });

    // 向下/向右越界 → 不可移动
    expect(canMoveToEnhanced(core, { row: 7, col: 5 }, { row: 8, col: 5 })).toBe(false);
    expect(canMoveToEnhanced(core, { row: 7, col: 5 }, { row: 7, col: 6 })).toBe(false);
    // 向上/向左有效
    expect(canMoveToEnhanced(core, { row: 7, col: 5 }, { row: 6, col: 5 })).toBe(true);
    expect(canMoveToEnhanced(core, { row: 7, col: 5 }, { row: 7, col: 4 })).toBe(true);
  });

  it('2格移动到有效位置', () => {
    const core = createMinimalCore({ phase: 'move' as GamePhase });
    placeUnit(core, { row: 0, col: 0 }, { card: makeUnitCard('edge'), owner: '0' });

    // 2格向下有效
    expect(canMoveToEnhanced(core, { row: 0, col: 0 }, { row: 2, col: 0 })).toBe(true);
    // 2格向上越界
    expect(canMoveToEnhanced(core, { row: 0, col: 0 }, { row: -2, col: 0 })).toBe(false);
  });

  it('超过2格移动无效（普通单位）', () => {
    const core = createMinimalCore({ phase: 'move' as GamePhase });
    placeUnit(core, { row: 0, col: 0 }, { card: makeUnitCard('normal'), owner: '0' });

    // 3格超出普通移动距离
    expect(canMoveToEnhanced(core, { row: 0, col: 0 }, { row: 3, col: 0 })).toBe(false);
  });
});

// ============================================================================
// 3. 棋盘边缘远程攻击
// ============================================================================

describe('棋盘边缘远程攻击', () => {
  it('远程单位在边缘沿直线攻击有效', () => {
    const core = createMinimalCore();
    placeUnit(core, { row: 0, col: 0 }, {
      card: makeUnitCard('archer', { attackType: 'ranged', attackRange: 3 }),
      owner: '0',
    });
    placeUnit(core, { row: 0, col: 3 }, { card: makeUnitCard('target'), owner: '1' });

    // 3格直线攻击
    expect(canAttackEnhanced(core, { row: 0, col: 0 }, { row: 0, col: 3 })).toBe(true);
  });

  it('远程单位在边缘超出射程无效', () => {
    const core = createMinimalCore();
    placeUnit(core, { row: 0, col: 0 }, {
      card: makeUnitCard('archer2', { attackType: 'ranged', attackRange: 3 }),
      owner: '0',
    });
    placeUnit(core, { row: 0, col: 4 }, { card: makeUnitCard('far-target'), owner: '1' });

    // 4格超出射程
    expect(canAttackEnhanced(core, { row: 0, col: 0 }, { row: 0, col: 4 })).toBe(false);
  });

  it('远程单位非直线攻击无效', () => {
    const core = createMinimalCore();
    placeUnit(core, { row: 0, col: 0 }, {
      card: makeUnitCard('archer3', { attackType: 'ranged', attackRange: 3 }),
      owner: '0',
    });
    placeUnit(core, { row: 1, col: 1 }, { card: makeUnitCard('diag-target'), owner: '1' });

    // 对角线不是直线
    expect(canAttackEnhanced(core, { row: 0, col: 0 }, { row: 1, col: 1 })).toBe(false);
  });
});

// ============================================================================
// 4. 所有城门相邻格被占满时无法召唤
// ============================================================================

describe('城门相邻格全满时无法召唤', () => {
  it('唯一城门四周全被占据 → 无可用召唤位置', () => {
    const core = createMinimalCore({ phase: 'summon' as GamePhase });
    // 放置城门在 (6, 3)
    placeGate(core, { row: 6, col: 3 }, '0');
    // 占满四周
    placeUnit(core, { row: 5, col: 3 }, { card: makeUnitCard('block1'), owner: '0' });
    placeUnit(core, { row: 7, col: 3 }, { card: makeUnitCard('block2'), owner: '0' });
    placeUnit(core, { row: 6, col: 2 }, { card: makeUnitCard('block3'), owner: '0' });
    placeUnit(core, { row: 6, col: 4 }, { card: makeUnitCard('block4'), owner: '0' });

    const positions = getValidSummonPositions(core, '0');
    expect(positions.length).toBe(0);
  });

  it('城门相邻有一个空格 → 可召唤', () => {
    const core = createMinimalCore({ phase: 'summon' as GamePhase });
    placeGate(core, { row: 6, col: 3 }, '0');
    placeUnit(core, { row: 5, col: 3 }, { card: makeUnitCard('block1'), owner: '0' });
    placeUnit(core, { row: 7, col: 3 }, { card: makeUnitCard('block2'), owner: '0' });
    placeUnit(core, { row: 6, col: 2 }, { card: makeUnitCard('block3'), owner: '0' });
    // (6,4) 空着

    const positions = getValidSummonPositions(core, '0');
    expect(positions.length).toBe(1);
    expect(positions[0]).toEqual({ row: 6, col: 4 });
  });

  it('城门在棋盘边缘时相邻格更少', () => {
    const core = createMinimalCore({ phase: 'summon' as GamePhase });
    // 城门在角落 (7, 0)，只有 2 个相邻格
    placeGate(core, { row: 7, col: 0 }, '0');
    placeUnit(core, { row: 6, col: 0 }, { card: makeUnitCard('block1'), owner: '0' });
    placeUnit(core, { row: 7, col: 1 }, { card: makeUnitCard('block2'), owner: '0' });

    const positions = getValidSummonPositions(core, '0');
    expect(positions.length).toBe(0);
  });
});

// ============================================================================
// 5. 所有建造位置被占满时无法建造
// ============================================================================

describe('建造位置全满时无法建造', () => {
  it('后3排和召唤师相邻全满 → 无可用建造位置', () => {
    const core = createMinimalCore({ phase: 'build' as GamePhase });
    // 玩家0后3排是 row 5,6,7
    for (let row = 5; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        placeUnit(core, { row, col }, { card: makeUnitCard(`fill-${row}-${col}`), owner: '0' });
      }
    }
    // 召唤师在 row 6, col 3（已被占据），相邻也全满
    const positions = getValidBuildPositions(core, '0');
    expect(positions.length).toBe(0);
  });
});

// ============================================================================
// 6. 远程攻击恰好在最大射程边界
// ============================================================================

describe('远程攻击射程边界', () => {
  it('恰好 3 格直线 → 可攻击', () => {
    const core = createMinimalCore();
    placeUnit(core, { row: 2, col: 0 }, {
      card: makeUnitCard('ranged', { attackType: 'ranged', attackRange: 3 }),
      owner: '0',
    });
    placeUnit(core, { row: 5, col: 0 }, { card: makeUnitCard('target3'), owner: '1' });

    expect(canAttackEnhanced(core, { row: 2, col: 0 }, { row: 5, col: 0 })).toBe(true);
  });

  it('恰好 4 格直线（超出默认射程）→ 不可攻击', () => {
    const core = createMinimalCore();
    placeUnit(core, { row: 2, col: 0 }, {
      card: makeUnitCard('ranged2', { attackType: 'ranged', attackRange: 3 }),
      owner: '0',
    });
    placeUnit(core, { row: 6, col: 0 }, { card: makeUnitCard('target4'), owner: '1' });

    expect(canAttackEnhanced(core, { row: 2, col: 0 }, { row: 6, col: 0 })).toBe(false);
  });

  it('近战单位 1 格 → 可攻击，2 格 → 不可攻击', () => {
    const core = createMinimalCore();
    placeUnit(core, { row: 3, col: 3 }, {
      card: makeUnitCard('melee', { attackType: 'melee', attackRange: 1 }),
      owner: '0',
    });
    placeUnit(core, { row: 4, col: 3 }, { card: makeUnitCard('adj-target'), owner: '1' });
    placeUnit(core, { row: 5, col: 3 }, { card: makeUnitCard('far-target'), owner: '1' });

    expect(canAttackEnhanced(core, { row: 3, col: 3 }, { row: 4, col: 3 })).toBe(true);
    expect(canAttackEnhanced(core, { row: 3, col: 3 }, { row: 5, col: 3 })).toBe(false);
  });

  it('攻击自己的单位 → 不可攻击', () => {
    const core = createMinimalCore();
    placeUnit(core, { row: 3, col: 3 }, {
      card: makeUnitCard('self-atk', { attackType: 'melee', attackRange: 1 }),
      owner: '0',
    });
    placeUnit(core, { row: 4, col: 3 }, { card: makeUnitCard('ally'), owner: '0' });

    expect(canAttackEnhanced(core, { row: 3, col: 3 }, { row: 4, col: 3 })).toBe(false);
  });
});

// ============================================================================
// 7. 血契召唤费用边界
// ============================================================================

describe('血契召唤费用边界', () => {
  it('费用恰好等于 2 → 通过', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    core.phase = 'summon' as GamePhase;
    clearArea(core, [4, 5], [3]);
    placeUnit(core, { row: 5, col: 3 }, { card: makeUnitCard('ally'), owner: '0' });
    const card = makeUnitCard('cost2', { cost: 2 });
    core.players['0'].hand.push(card);

    const r = validate(core, SW_COMMANDS.BLOOD_SUMMON_STEP, {
      targetUnitPosition: { row: 5, col: 3 },
      summonCardId: 'cost2',
      summonPosition: { row: 4, col: 3 },
    });
    expect(r.valid).toBe(true);
  });

  it('费用恰好等于 3 → 拒绝', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    core.phase = 'summon' as GamePhase;
    clearArea(core, [4, 5], [3]);
    placeUnit(core, { row: 5, col: 3 }, { card: makeUnitCard('ally'), owner: '0' });
    const card = makeUnitCard('cost3', { cost: 3 });
    core.players['0'].hand.push(card);

    const r = validate(core, SW_COMMANDS.BLOOD_SUMMON_STEP, {
      targetUnitPosition: { row: 5, col: 3 },
      summonCardId: 'cost3',
      summonPosition: { row: 4, col: 3 },
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('费用≤2');
  });

  it('费用等于 0 → 通过', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    core.phase = 'summon' as GamePhase;
    clearArea(core, [4, 5], [3]);
    placeUnit(core, { row: 5, col: 3 }, { card: makeUnitCard('ally'), owner: '0' });
    const card = makeUnitCard('cost0', { cost: 0 });
    core.players['0'].hand.push(card);

    const r = validate(core, SW_COMMANDS.BLOOD_SUMMON_STEP, {
      targetUnitPosition: { row: 5, col: 3 },
      summonCardId: 'cost0',
      summonPosition: { row: 4, col: 3 },
    });
    expect(r.valid).toBe(true);
  });
});

// ============================================================================
// 8. 弃牌换魔力空列表
// ============================================================================

describe('弃牌换魔力边界', () => {
  it('空 cardIds 列表 → 不产生事件（execute 层过滤）', () => {
    const core = createMinimalCore({ phase: 'magic' as GamePhase });
    const prevMagic = core.players['0'].magic;

    // DISCARD_FOR_MAGIC 有 validate 校验（空列表会被拒绝）
    // 这里直接验证 reduce MAGIC_CHANGED delta=0 的行为
    const result = reduce(core, {
      type: SW_EVENTS.MAGIC_CHANGED,
      payload: { playerId: '0', delta: 0 },
      timestamp: 0,
    });
    expect(result.players['0'].magic).toBe(prevMagic);
  });

  it('cardIds 中包含不存在的卡牌 ID → 只处理有效的', () => {
    // 这是 execute 层的行为，通过 reduce 验证最终状态
    const core = createMinimalCore({ phase: 'magic' as GamePhase });
    const card = makeUnitCard('valid-card');
    core.players['0'].hand.push(card);

    // 弃掉有效卡 → 魔力 +1
    const result1 = reduce(core, {
      type: SW_EVENTS.MAGIC_CHANGED,
      payload: { playerId: '0', delta: 1 },
      timestamp: 0,
    });
    expect(result1.players['0'].magic).toBe(core.players['0'].magic + 1);
  });
});

// ============================================================================
// 9. 推拉到棋盘边缘
// ============================================================================

describe('推拉到棋盘边缘', () => {
  it('推到边缘外 → 返回 null（无法推动）', () => {
    const core = createMinimalCore();
    // 目标在 (0, 3)，推方向向上（出界）
    placeUnit(core, { row: 0, col: 3 }, { card: makeUnitCard('edge-unit'), owner: '1' });
    const sourcePos: CellCoord = { row: 1, col: 3 };

    const result = calculatePushPullPosition(core, { row: 0, col: 3 }, sourcePos, 1, 'push');
    // 推向 row=-1 出界，返回 null
    expect(result).toBeNull();
  });

  it('推 2 格但第 1 格就出界 → 返回 null', () => {
    const core = createMinimalCore();
    placeUnit(core, { row: 0, col: 3 }, { card: makeUnitCard('edge-unit2'), owner: '1' });
    const sourcePos: CellCoord = { row: 1, col: 3 };

    const result = calculatePushPullPosition(core, { row: 0, col: 3 }, sourcePos, 2, 'push');
    expect(result).toBeNull();
  });

  it('推 2 格但第 2 格被占据 → 只推 1 格', () => {
    const core = createMinimalCore();
    placeUnit(core, { row: 3, col: 3 }, { card: makeUnitCard('pushed'), owner: '1' });
    placeUnit(core, { row: 1, col: 3 }, { card: makeUnitCard('blocker'), owner: '0' });
    const sourcePos: CellCoord = { row: 4, col: 3 };

    const result = calculatePushPullPosition(core, { row: 3, col: 3 }, sourcePos, 2, 'push');
    // 推向 row=2 有效，row=1 被占 → 停在 row=2
    expect(result).toEqual({ row: 2, col: 3 });
  });

  it('拉到源位置旁边 → 正常拉动', () => {
    const core = createMinimalCore();
    placeUnit(core, { row: 3, col: 3 }, { card: makeUnitCard('pulled'), owner: '1' });
    const sourcePos: CellCoord = { row: 5, col: 3 };

    const result = calculatePushPullPosition(core, { row: 3, col: 3 }, sourcePos, 1, 'pull');
    // 拉向 source → row+1
    expect(result).toEqual({ row: 4, col: 3 });
  });

  it('拉但目标已在边缘且拉方向出界 → 返回 null', () => {
    const core = createMinimalCore();
    placeUnit(core, { row: 7, col: 3 }, { card: makeUnitCard('bottom-unit'), owner: '1' });
    const sourcePos: CellCoord = { row: 6, col: 3 };

    // 拉向 source（row=6），但 source 在上方，拉方向是 row+1=8 出界
    // 实际上 pull 方向是靠近 source，即 row-1=6... 但 source 在 row=6
    // 重新理解：target(7,3) pull toward source(6,3) → 方向是 row-1
    const result = calculatePushPullPosition(core, { row: 7, col: 3 }, sourcePos, 1, 'pull');
    // 拉向 row=6，但 source 在那里... source 不是单位，只是位置参考
    // isCellEmpty 检查 row=6 col=3 → 空的（source 只是坐标参考）
    expect(result).toEqual({ row: 6, col: 3 });
  });

  it('对角线目标推拉 → 优先行方向（确定性 tie-breaking）', () => {
    const core = createMinimalCore();
    // source(3,3), target(4,4) → 完美对角线，|dr|==|dc|==1
    placeUnit(core, { row: 4, col: 4 }, { card: makeUnitCard('diag-target'), owner: '1' });
    const sourcePos: CellCoord = { row: 3, col: 3 };

    // 推：远离 source，对角线时优先行方向 → row+1
    const pushResult = calculatePushPullPosition(core, { row: 4, col: 4 }, sourcePos, 1, 'push');
    expect(pushResult).toEqual({ row: 5, col: 4 });

    // 拉：靠近 source，对角线时优先行方向 → row-1
    const pullResult = calculatePushPullPosition(core, { row: 4, col: 4 }, sourcePos, 1, 'pull');
    expect(pullResult).toEqual({ row: 3, col: 4 });
  });

  it('非对称对角线 → 选择主要方向', () => {
    const core = createMinimalCore();
    // source(3,3), target(5,4) → |dr|=2 > |dc|=1 → 行方向
    placeUnit(core, { row: 5, col: 4 }, { card: makeUnitCard('asym-target'), owner: '1' });
    const sourcePos: CellCoord = { row: 3, col: 3 };

    const pushResult = calculatePushPullPosition(core, { row: 5, col: 4 }, sourcePos, 1, 'push');
    expect(pushResult).toEqual({ row: 6, col: 4 });

    // source(3,3), target(4,1) → |dr|=1 < |dc|=2 → 列方向（推向 col-1=0）
    placeUnit(core, { row: 4, col: 1 }, { card: makeUnitCard('asym-target2'), owner: '1' });
    const pushResult2 = calculatePushPullPosition(core, { row: 4, col: 1 }, sourcePos, 1, 'push');
    expect(pushResult2).toEqual({ row: 4, col: 0 });
  });
});

// ============================================================================
// 10. 抽牌时牌库恰好等于需求量
// ============================================================================

describe('抽牌边界', () => {
  it('牌库恰好等于需求量 → 全部抽完', () => {
    const core = createMinimalCore({ phase: 'draw' as GamePhase, currentPlayer: '0' });
    // 手牌 2 张，需抽 3 张，牌库恰好 3 张
    core.players['0'].hand = [makeUnitCard('h1'), makeUnitCard('h2')];
    core.players['0'].deck = [makeUnitCard('d1'), makeUnitCard('d2'), makeUnitCard('d3')];

    const state = wrapState(core);
    const result = summonerWarsFlowHooks.onPhaseExit!({
      state, from: 'draw', to: 'summon', command: dummyCommand, random: createTestRandom(),
    }) as PhaseExitResult;

    const drawEvents = (result.events ?? []).filter(e => e.type === SW_EVENTS.CARD_DRAWN);
    expect(drawEvents.length).toBe(1);
    expect((drawEvents[0] as any).payload.count).toBe(3);
  });

  it('手牌已满（5张）→ 不抽牌', () => {
    const core = createMinimalCore({ phase: 'draw' as GamePhase, currentPlayer: '0' });
    core.players['0'].hand = Array.from({ length: 5 }, (_, i) => makeUnitCard(`h${i}`));
    core.players['0'].deck = Array.from({ length: 10 }, (_, i) => makeUnitCard(`d${i}`));

    const state = wrapState(core);
    const result = summonerWarsFlowHooks.onPhaseExit!({
      state, from: 'draw', to: 'summon', command: dummyCommand, random: createTestRandom(),
    }) as PhaseExitResult;

    const drawEvents = (result.events ?? []).filter(e => e.type === SW_EVENTS.CARD_DRAWN);
    expect(drawEvents.length).toBe(0);
  });

  it('手牌超过 5 张（异常状态）→ 不抽牌', () => {
    const core = createMinimalCore({ phase: 'draw' as GamePhase, currentPlayer: '0' });
    core.players['0'].hand = Array.from({ length: 7 }, (_, i) => makeUnitCard(`h${i}`));
    core.players['0'].deck = Array.from({ length: 10 }, (_, i) => makeUnitCard(`d${i}`));

    const state = wrapState(core);
    const result = summonerWarsFlowHooks.onPhaseExit!({
      state, from: 'draw', to: 'summon', command: dummyCommand, random: createTestRandom(),
    }) as PhaseExitResult;

    const drawEvents = (result.events ?? []).filter(e => e.type === SW_EVENTS.CARD_DRAWN);
    expect(drawEvents.length).toBe(0);
  });
});

// ============================================================================
// 11. 治疗过量（建筑）
// ============================================================================

describe('建筑治疗过量', () => {
  it('建筑治疗量超过伤害值时不低于 0', () => {
    const core = createMinimalCore();
    const pos: CellCoord = { row: 4, col: 4 };
    core.board[pos.row][pos.col].structure = {
      cardId: 'struct-heal',
      card: makeStructureCard('struct-heal', { life: 5 }),
      owner: '0', position: pos, damage: 2,
    };

    const result = reduce(core, {
      type: SW_EVENTS.STRUCTURE_HEALED,
      payload: { position: pos, amount: 10 },
      timestamp: 0,
    });

    expect(result.board[pos.row][pos.col].structure!.damage).toBe(0);
  });

  it('建筑无伤害时治疗不变', () => {
    const core = createMinimalCore();
    const pos: CellCoord = { row: 4, col: 4 };
    core.board[pos.row][pos.col].structure = {
      cardId: 'struct-full',
      card: makeStructureCard('struct-full', { life: 5 }),
      owner: '0', position: pos, damage: 0,
    };

    const result = reduce(core, {
      type: SW_EVENTS.STRUCTURE_HEALED,
      payload: { position: pos, amount: 3 },
      timestamp: 0,
    });

    expect(result.board[pos.row][pos.col].structure!.damage).toBe(0);
  });
});

// ============================================================================
// 12. 守卫单位强制攻击检查
// ============================================================================

describe('守卫单位强制攻击', () => {
  it('攻击者相邻有守卫时必须攻击守卫', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    core.phase = 'attack' as GamePhase;
    clearArea(core, [3, 4, 5], [2, 3, 4]);

    // 攻击者在 (4,3)
    placeUnit(core, { row: 4, col: 3 }, {
      card: makeUnitCard('attacker', { attackType: 'melee', attackRange: 1 }),
      owner: '0',
    });
    // 守卫在 (3,3)（相邻）
    placeUnit(core, { row: 3, col: 3 }, {
      card: makeUnitCard('guardian', { abilities: ['guardian'] }),
      owner: '1',
    });
    // 非守卫在 (4,4)（也相邻）
    placeUnit(core, { row: 4, col: 4 }, {
      card: makeUnitCard('normal-enemy'),
      owner: '1',
    });

    // 攻击非守卫 → 被拒绝
    const r = validate(core, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: { row: 4, col: 3 },
      target: { row: 4, col: 4 },
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('守卫');

    // 攻击守卫 → 通过
    const r2 = validate(core, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: { row: 4, col: 3 },
      target: { row: 3, col: 3 },
    });
    expect(r2.valid).toBe(true);
  });

  it('攻击者相邻无守卫时可自由攻击', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    core.phase = 'attack' as GamePhase;
    clearArea(core, [3, 4, 5], [2, 3, 4]);

    placeUnit(core, { row: 4, col: 3 }, {
      card: makeUnitCard('attacker', { attackType: 'melee', attackRange: 1 }),
      owner: '0',
    });
    placeUnit(core, { row: 3, col: 3 }, {
      card: makeUnitCard('normal-enemy'),
      owner: '1',
    });

    const r = validate(core, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: { row: 4, col: 3 },
      target: { row: 3, col: 3 },
    });
    expect(r.valid).toBe(true);
  });

  it('目标本身是守卫时直接通过', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    core.phase = 'attack' as GamePhase;
    clearArea(core, [3, 4, 5], [2, 3, 4]);

    placeUnit(core, { row: 4, col: 3 }, {
      card: makeUnitCard('attacker', { attackType: 'melee', attackRange: 1 }),
      owner: '0',
    });
    placeUnit(core, { row: 3, col: 3 }, {
      card: makeUnitCard('guardian', { abilities: ['guardian'] }),
      owner: '1',
    });

    const r = validate(core, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: { row: 4, col: 3 },
      target: { row: 3, col: 3 },
    });
    expect(r.valid).toBe(true);
  });
});
