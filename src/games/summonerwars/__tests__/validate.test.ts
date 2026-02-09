/**
 * 召唤师战争 - 命令验证器独立单元测试
 *
 * 覆盖 validate.ts 中所有命令类型的正向/反向分支，
 * 补强已有 ability 测试中未直接覆盖的验证路径。
 */

import { describe, it, expect } from 'vitest';
import { SummonerWarsDomain, SW_COMMANDS } from '../domain';
import type { SummonerWarsCore, PlayerId, CellCoord, UnitCard, EventCard, StructureCard, BoardUnit } from '../domain/types';
import type { RandomFn } from '../../../engine/types';
import { createInitialSystemState } from '../../../engine/pipeline';
import { createInitializedCore } from './test-helpers';
import { BOARD_ROWS, BOARD_COLS } from '../domain/helpers';

// ============================================================================
// 辅助
// ============================================================================

function createTestRandom(): RandomFn {
  return { shuffle: <T>(arr: T[]) => arr, random: () => 0.5, d: (max: number) => Math.ceil(max * 0.5) || 1, range: (min: number, max: number) => Math.floor(min + (max - min) * 0.5) };
}

function validate(core: SummonerWarsCore, type: string, payload: Record<string, unknown>, playerId?: string) {
  const sys = createInitialSystemState(['0', '1'], []);
  return SummonerWarsDomain.validate({ core, sys }, { type, payload, playerId });
}

function makeUnitCard(id: string, overrides?: Partial<UnitCard>): UnitCard {
  return {
    id, cardType: 'unit', name: `测试单位-${id}`, unitClass: 'common', faction: 'test',
    strength: 2, life: 3, cost: 1, attackType: 'melee', attackRange: 1,
    deckSymbols: [], ...overrides,
  };
}

function makeEventCard(id: string, overrides?: Partial<EventCard>): EventCard {
  return {
    id, cardType: 'event', name: `测试事件-${id}`, cost: 0, playPhase: 'any',
    effect: '测试', deckSymbols: [], ...overrides,
  };
}

function makeStructureCard(id: string, overrides?: Partial<StructureCard>): StructureCard {
  return {
    id, cardType: 'structure' as const, name: `测试建筑-${id}`, cost: 0, life: 5,
    deckSymbols: [], ...overrides,
  } as StructureCard;
}

function placeUnit(core: SummonerWarsCore, pos: CellCoord, unit: Partial<BoardUnit> & { card: UnitCard; owner: PlayerId }): BoardUnit {
  const boardUnit: BoardUnit = {
    cardId: unit.cardId ?? `unit-${pos.row}-${pos.col}`,
    card: unit.card,
    owner: unit.owner,
    position: pos,
    damage: unit.damage ?? 0,
    boosts: unit.boosts ?? 0,
    hasMoved: unit.hasMoved ?? false,
    hasAttacked: unit.hasAttacked ?? false,
  };
  core.board[pos.row][pos.col].unit = boardUnit;
  return boardUnit;
}

function placeStructure(core: SummonerWarsCore, pos: CellCoord, owner: PlayerId, card?: StructureCard) {
  const c = card ?? makeStructureCard(`struct-${pos.row}-${pos.col}`);
  core.board[pos.row][pos.col].structure = {
    cardId: c.id, card: c, owner, position: pos, damage: 0,
  };
}

function clearArea(core: SummonerWarsCore, rows: number[], cols: number[]) {
  for (const r of rows) for (const c of cols) {
    if (core.board[r]?.[c]) { core.board[r][c].unit = undefined; core.board[r][c].structure = undefined; }
  }
}

// ============================================================================
// 阵营选择命令
// ============================================================================

describe('SELECT_FACTION 验证', () => {
  it('有效阵营通过', () => {
    const core = SummonerWarsDomain.setup(['0', '1'], createTestRandom());
    expect(validate(core, SW_COMMANDS.SELECT_FACTION, { factionId: 'necromancer' }).valid).toBe(true);
  });

  it('无效阵营拒绝', () => {
    const core = SummonerWarsDomain.setup(['0', '1'], createTestRandom());
    const r = validate(core, SW_COMMANDS.SELECT_FACTION, { factionId: 'invalid' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('无效的阵营');
  });

  it('游戏已开始时拒绝', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const r = validate(core, SW_COMMANDS.SELECT_FACTION, { factionId: 'necromancer' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('游戏已开始');
  });
});

describe('PLAYER_READY 验证', () => {
  it('已选阵营可准备', () => {
    const core = SummonerWarsDomain.setup(['0', '1'], createTestRandom());
    core.selectedFactions['1'] = 'trickster';
    expect(validate(core, SW_COMMANDS.PLAYER_READY, {}, '1').valid).toBe(true);
  });

  it('未选阵营拒绝', () => {
    const core = SummonerWarsDomain.setup(['0', '1'], createTestRandom());
    const r = validate(core, SW_COMMANDS.PLAYER_READY, {}, '1');
    expect(r.valid).toBe(false);
    expect(r.error).toContain('必须先选择阵营');
  });

  it('游戏已开始拒绝', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const r = validate(core, SW_COMMANDS.PLAYER_READY, {}, '1');
    expect(r.valid).toBe(false);
  });
});

describe('HOST_START_GAME 验证', () => {
  it('条件满足时通过', () => {
    const core = SummonerWarsDomain.setup(['0', '1'], createTestRandom());
    core.selectedFactions['0'] = 'necromancer';
    core.selectedFactions['1'] = 'trickster';
    core.readyPlayers['1'] = true;
    expect(validate(core, SW_COMMANDS.HOST_START_GAME, {}, '0').valid).toBe(true);
  });

  it('非房主拒绝', () => {
    const core = SummonerWarsDomain.setup(['0', '1'], createTestRandom());
    core.selectedFactions['0'] = 'necromancer';
    core.selectedFactions['1'] = 'trickster';
    core.readyPlayers['1'] = true;
    const r = validate(core, SW_COMMANDS.HOST_START_GAME, {}, '1');
    expect(r.valid).toBe(false);
    expect(r.error).toContain('房主');
  });

  it('房主未选阵营拒绝', () => {
    const core = SummonerWarsDomain.setup(['0', '1'], createTestRandom());
    core.selectedFactions['1'] = 'trickster';
    core.readyPlayers['1'] = true;
    const r = validate(core, SW_COMMANDS.HOST_START_GAME, {}, '0');
    expect(r.valid).toBe(false);
    expect(r.error).toContain('房主必须先选择阵营');
  });

  it('对手未准备拒绝', () => {
    const core = SummonerWarsDomain.setup(['0', '1'], createTestRandom());
    core.selectedFactions['0'] = 'necromancer';
    core.selectedFactions['1'] = 'trickster';
    // readyPlayers['1'] 仍为 false
    const r = validate(core, SW_COMMANDS.HOST_START_GAME, {}, '0');
    expect(r.valid).toBe(false);
    expect(r.error).toContain('等待所有玩家准备');
  });
});

// ============================================================================
// 游戏进行命令
// ============================================================================

describe('SUMMON_UNIT 验证', () => {
  it('非召唤阶段拒绝', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    core.phase = 'attack';
    const card = makeUnitCard('test-summon', { cost: 0 });
    core.players['0'].hand.push(card);
    const r = validate(core, SW_COMMANDS.SUMMON_UNIT, { cardId: 'test-summon', position: { row: 6, col: 3 } });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('不是召唤阶段');
  });

  it('手牌中无该卡拒绝', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    core.phase = 'summon';
    const r = validate(core, SW_COMMANDS.SUMMON_UNIT, { cardId: 'nonexistent', position: { row: 6, col: 3 } });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('无效的单位卡牌');
  });

  it('魔力不足拒绝', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    core.phase = 'summon';
    const card = makeUnitCard('expensive', { cost: 99 });
    core.players['0'].hand.push(card);
    core.players['0'].magic = 0;
    const r = validate(core, SW_COMMANDS.SUMMON_UNIT, { cardId: 'expensive', position: { row: 6, col: 3 } });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('魔力不足');
  });
});

describe('BUILD_STRUCTURE 验证', () => {
  it('非建造阶段拒绝', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    core.phase = 'attack';
    const card = makeStructureCard('test-struct');
    core.players['0'].hand.push(card as any);
    const r = validate(core, SW_COMMANDS.BUILD_STRUCTURE, { cardId: 'test-struct', position: { row: 7, col: 3 } });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('不是建造阶段');
  });

  it('非建筑卡拒绝', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    core.phase = 'build';
    const card = makeUnitCard('not-struct');
    core.players['0'].hand.push(card);
    const r = validate(core, SW_COMMANDS.BUILD_STRUCTURE, { cardId: 'not-struct', position: { row: 7, col: 3 } });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('无效的建筑卡牌');
  });
});

describe('MOVE_UNIT 验证', () => {
  it('非移动阶段拒绝', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    core.phase = 'attack';
    const r = validate(core, SW_COMMANDS.MOVE_UNIT, { from: { row: 6, col: 3 }, to: { row: 5, col: 3 } });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('不是移动阶段');
  });

  it('移动次数用完拒绝', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    core.phase = 'move';
    core.players['0'].moveCount = 3;
    const r = validate(core, SW_COMMANDS.MOVE_UNIT, { from: { row: 6, col: 3 }, to: { row: 5, col: 3 } });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('移动次数已用完');
  });

  it('移动非己方单位拒绝', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    core.phase = 'move';
    clearArea(core, [4, 5], [3]);
    placeUnit(core, { row: 5, col: 3 }, { card: makeUnitCard('enemy'), owner: '1' });
    const r = validate(core, SW_COMMANDS.MOVE_UNIT, { from: { row: 5, col: 3 }, to: { row: 4, col: 3 } });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('无法移动该单位');
  });

  it('已移动单位拒绝', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    core.phase = 'move';
    clearArea(core, [4, 5], [3]);
    placeUnit(core, { row: 5, col: 3 }, { card: makeUnitCard('moved'), owner: '0', hasMoved: true });
    const r = validate(core, SW_COMMANDS.MOVE_UNIT, { from: { row: 5, col: 3 }, to: { row: 4, col: 3 } });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('已移动');
  });

  it('禁足单位拒绝', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    core.phase = 'move';
    clearArea(core, [4, 5], [3]);
    placeUnit(core, { row: 5, col: 3 }, { card: makeUnitCard('immob', { abilities: ['immobile'] }), owner: '0' });
    const r = validate(core, SW_COMMANDS.MOVE_UNIT, { from: { row: 5, col: 3 }, to: { row: 4, col: 3 } });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('禁足');
  });
});

describe('DECLARE_ATTACK 验证', () => {
  it('非攻击阶段拒绝', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    core.phase = 'move';
    const r = validate(core, SW_COMMANDS.DECLARE_ATTACK, { attacker: { row: 6, col: 3 }, target: { row: 5, col: 3 } });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('不是攻击阶段');
  });

  it('已攻击单位拒绝', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    core.phase = 'attack';
    clearArea(core, [4, 5], [3]);
    placeUnit(core, { row: 5, col: 3 }, { card: makeUnitCard('atk'), owner: '0', hasAttacked: true });
    placeUnit(core, { row: 4, col: 3 }, { card: makeUnitCard('tgt'), owner: '1' });
    const r = validate(core, SW_COMMANDS.DECLARE_ATTACK, { attacker: { row: 5, col: 3 }, target: { row: 4, col: 3 } });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('已攻击');
  });

  it('攻击次数用完且非凶残拒绝', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    core.phase = 'attack';
    core.players['0'].attackCount = 3;
    clearArea(core, [4, 5], [3]);
    placeUnit(core, { row: 5, col: 3 }, { card: makeUnitCard('atk'), owner: '0' });
    placeUnit(core, { row: 4, col: 3 }, { card: makeUnitCard('tgt'), owner: '1' });
    const r = validate(core, SW_COMMANDS.DECLARE_ATTACK, { attacker: { row: 5, col: 3 }, target: { row: 4, col: 3 } });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('攻击次数已用完');
  });

  it('凶残单位攻击次数用完仍可攻击', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    core.phase = 'attack';
    core.players['0'].attackCount = 3;
    clearArea(core, [4, 5], [3]);
    placeUnit(core, { row: 5, col: 3 }, { card: makeUnitCard('ferocious', { abilities: ['ferocity'] }), owner: '0' });
    placeUnit(core, { row: 4, col: 3 }, { card: makeUnitCard('tgt'), owner: '1' });
    const r = validate(core, SW_COMMANDS.DECLARE_ATTACK, { attacker: { row: 5, col: 3 }, target: { row: 4, col: 3 } });
    expect(r.valid).toBe(true);
  });

  it('beforeAttack 中无效技能拒绝', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    core.phase = 'attack';
    clearArea(core, [4, 5], [3]);
    placeUnit(core, { row: 5, col: 3 }, { card: makeUnitCard('atk'), owner: '0' });
    placeUnit(core, { row: 4, col: 3 }, { card: makeUnitCard('tgt'), owner: '1' });
    const r = validate(core, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: { row: 5, col: 3 }, target: { row: 4, col: 3 },
      beforeAttack: { abilityId: 'nonexistent' },
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('没有此技能');
  });

  it('beforeAttack 未知技能类型拒绝', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    core.phase = 'attack';
    clearArea(core, [4, 5], [3]);
    placeUnit(core, { row: 5, col: 3 }, { card: makeUnitCard('atk', { abilities: ['unknown_ability'] }), owner: '0' });
    placeUnit(core, { row: 4, col: 3 }, { card: makeUnitCard('tgt'), owner: '1' });
    const r = validate(core, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: { row: 5, col: 3 }, target: { row: 4, col: 3 },
      beforeAttack: { abilityId: 'unknown_ability' },
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('无效的攻击前技能');
  });
});

describe('PLAY_EVENT 验证', () => {
  it('手牌中无该事件卡拒绝', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    core.phase = 'attack';
    const r = validate(core, SW_COMMANDS.PLAY_EVENT, { cardId: 'nonexistent' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('无效的事件卡');
  });

  it('魔力不足拒绝', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    core.phase = 'attack';
    const card = makeEventCard('expensive-event', { cost: 99, playPhase: 'any' });
    core.players['0'].hand.push(card);
    core.players['0'].magic = 0;
    const r = validate(core, SW_COMMANDS.PLAY_EVENT, { cardId: 'expensive-event' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('魔力不足');
  });

  it('阶段不匹配拒绝', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    core.phase = 'move';
    const card = makeEventCard('attack-only', { cost: 0, playPhase: 'attack' });
    core.players['0'].hand.push(card);
    const r = validate(core, SW_COMMANDS.PLAY_EVENT, { cardId: 'attack-only' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('只能在');
  });

  it('playPhase=any 任意阶段通过', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    core.phase = 'move';
    const card = makeEventCard('any-phase', { cost: 0, playPhase: 'any' });
    core.players['0'].hand.push(card);
    const r = validate(core, SW_COMMANDS.PLAY_EVENT, { cardId: 'any-phase' });
    expect(r.valid).toBe(true);
  });
});

describe('BLOOD_SUMMON_STEP 验证', () => {
  it('非召唤阶段拒绝', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    core.phase = 'attack';
    const r = validate(core, SW_COMMANDS.BLOOD_SUMMON_STEP, {
      targetUnitPosition: { row: 6, col: 3 }, summonCardId: 'x', summonPosition: { row: 5, col: 3 },
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('召唤阶段');
  });

  it('目标非友方单位拒绝', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    core.phase = 'summon';
    clearArea(core, [4, 5], [3]);
    placeUnit(core, { row: 5, col: 3 }, { card: makeUnitCard('enemy'), owner: '1' });
    const card = makeUnitCard('bs-card', { cost: 1 });
    core.players['0'].hand.push(card);
    const r = validate(core, SW_COMMANDS.BLOOD_SUMMON_STEP, {
      targetUnitPosition: { row: 5, col: 3 }, summonCardId: 'bs-card', summonPosition: { row: 4, col: 3 },
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('友方单位');
  });

  it('费用>2拒绝', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    core.phase = 'summon';
    clearArea(core, [4, 5], [3]);
    placeUnit(core, { row: 5, col: 3 }, { card: makeUnitCard('ally'), owner: '0' });
    const card = makeUnitCard('expensive-bs', { cost: 3 });
    core.players['0'].hand.push(card);
    const r = validate(core, SW_COMMANDS.BLOOD_SUMMON_STEP, {
      targetUnitPosition: { row: 5, col: 3 }, summonCardId: 'expensive-bs', summonPosition: { row: 4, col: 3 },
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('费用≤2');
  });

  it('非相邻位置拒绝', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    core.phase = 'summon';
    clearArea(core, [3, 4, 5], [3]);
    placeUnit(core, { row: 5, col: 3 }, { card: makeUnitCard('ally'), owner: '0' });
    const card = makeUnitCard('bs-card2', { cost: 1 });
    core.players['0'].hand.push(card);
    const r = validate(core, SW_COMMANDS.BLOOD_SUMMON_STEP, {
      targetUnitPosition: { row: 5, col: 3 }, summonCardId: 'bs-card2', summonPosition: { row: 3, col: 3 },
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('相邻');
  });

  it('放置位置非空拒绝', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    core.phase = 'summon';
    clearArea(core, [4, 5], [3]);
    placeUnit(core, { row: 5, col: 3 }, { card: makeUnitCard('ally2'), owner: '0' });
    placeUnit(core, { row: 4, col: 3 }, { card: makeUnitCard('blocker'), owner: '0' });
    const card = makeUnitCard('bs-card3', { cost: 1 });
    core.players['0'].hand.push(card);
    const r = validate(core, SW_COMMANDS.BLOOD_SUMMON_STEP, {
      targetUnitPosition: { row: 5, col: 3 }, summonCardId: 'bs-card3', summonPosition: { row: 4, col: 3 },
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('为空');
  });
});

describe('END_PHASE 验证', () => {
  it('始终通过', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    expect(validate(core, SW_COMMANDS.END_PHASE, {}).valid).toBe(true);
  });
});

describe('FUNERAL_PYRE_HEAL 验证', () => {
  it('主动事件区无该卡拒绝', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const r = validate(core, SW_COMMANDS.FUNERAL_PYRE_HEAL, { cardId: 'nonexistent' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('主动事件区没有该卡牌');
  });

  it('skip=true 直接通过', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const fpCard = makeEventCard('necro-funeral-pyre', { charges: 2 });
    core.players['0'].activeEvents.push(fpCard);
    const r = validate(core, SW_COMMANDS.FUNERAL_PYRE_HEAL, { cardId: 'necro-funeral-pyre', skip: true });
    expect(r.valid).toBe(true);
  });

  it('无充能拒绝', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const fpCard = makeEventCard('necro-funeral-pyre', { charges: 0 });
    core.players['0'].activeEvents.push(fpCard);
    const r = validate(core, SW_COMMANDS.FUNERAL_PYRE_HEAL, {
      cardId: 'necro-funeral-pyre', targetPosition: { row: 5, col: 3 },
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('没有充能');
  });

  it('目标无单位拒绝', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const fpCard = makeEventCard('necro-funeral-pyre', { charges: 2 });
    core.players['0'].activeEvents.push(fpCard);
    clearArea(core, [4], [4]);
    const r = validate(core, SW_COMMANDS.FUNERAL_PYRE_HEAL, {
      cardId: 'necro-funeral-pyre', targetPosition: { row: 4, col: 4 },
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('没有单位');
  });

  it('目标无伤害拒绝', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const fpCard = makeEventCard('necro-funeral-pyre', { charges: 2 });
    core.players['0'].activeEvents.push(fpCard);
    clearArea(core, [4], [4]);
    placeUnit(core, { row: 4, col: 4 }, { card: makeUnitCard('healthy'), owner: '0', damage: 0 });
    const r = validate(core, SW_COMMANDS.FUNERAL_PYRE_HEAL, {
      cardId: 'necro-funeral-pyre', targetPosition: { row: 4, col: 4 },
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('没有伤害');
  });
});

describe('未知命令类型', () => {
  it('默认通过', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    expect(validate(core, 'unknown_command', {}).valid).toBe(true);
  });
});

// ============================================================================
// ACTIVATE_ABILITY 通用验证
// ============================================================================

describe('ACTIVATE_ABILITY 通用验证', () => {
  it('源单位不存在拒绝', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    const r = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'revive_undead', sourceUnitId: 'nonexistent',
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('未找到');
  });

  it('非己方单位拒绝', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    clearArea(core, [4], [4]);
    placeUnit(core, { row: 4, col: 4 }, {
      cardId: 'enemy-unit', card: makeUnitCard('enemy-unit', { abilities: ['revive_undead'] }), owner: '1',
    });
    const r = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'revive_undead', sourceUnitId: 'enemy-unit',
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('只能发动自己');
  });

  it('单位无该技能拒绝', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    clearArea(core, [4], [4]);
    placeUnit(core, { row: 4, col: 4 }, {
      cardId: 'no-ability', card: makeUnitCard('no-ability', { abilities: [] }), owner: '0',
    });
    const r = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'revive_undead', sourceUnitId: 'no-ability',
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('没有此技能');
  });

  it('未知技能 ID 拒绝', () => {
    const core = createInitializedCore(['0', '1'], createTestRandom());
    clearArea(core, [4], [4]);
    placeUnit(core, { row: 4, col: 4 }, {
      cardId: 'has-unknown', card: makeUnitCard('has-unknown', { abilities: ['totally_unknown_skill'] }), owner: '0',
    });
    const r = validate(core, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'totally_unknown_skill', sourceUnitId: 'has-unknown',
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('未知的技能');
  });
});
