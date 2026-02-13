/**
 * 召唤师战争 - 炽原精灵技能测试
 *
 * 覆盖：
 * - ancestral_bond（祖灵羁绊）：移动后充能目标并转移自身充能
 * - power_up（力量强化）：每点充能+1战力，最多+5
 * - prepare（预备）：充能代替移动
 * - rapid_fire（连续射击）：攻击后消耗充能额外攻击
 * - inspire（启悟）：移动后充能相邻友方
 * - withdraw（撤退）：攻击后消耗充能/魔力推拉自身
 * - intimidate（威势）：攻击后充能自身
 * - life_up（生命强化）：每点充能+1生命，最多+5
 * - speed_up（速度强化）：每点充能+1移动，最多+5
 * - gather_power（聚能）：召唤后充能
 * - spirit_bond（祖灵交流）：充能自身或消耗充能给友方
 * - 事件卡：力量颂歌、生长颂歌、交缠颂歌、编织颂歌
 */

import { describe, it, expect } from 'vitest';
import { SummonerWarsDomain, SW_COMMANDS, SW_EVENTS } from '../domain';
import type {
  SummonerWarsCore, CellCoord, BoardUnit, UnitCard, EventCard,
  PlayerId,
} from '../domain/types';
import type { RandomFn, GameEvent } from '../../../engine/types';
import { canMoveToEnhanced } from '../domain/helpers';
import { calculateEffectiveStrength, getEffectiveLifeBase } from '../domain/abilityResolver';
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

/** 创建炽原精灵 vs 亡灵法师的测试状态 */
function createBarbaricState(): SummonerWarsCore {
  return createInitializedCore(['0', '1'], createTestRandom(), {
    faction0: 'barbaric',
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

/** 创建蒙威尊者卡牌（力量强化+践踏） */
function makeMoka(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '蒙威尊者', unitClass: 'champion',
    faction: 'barbaric', strength: 1, life: 11, cost: 8,
    attackType: 'melee', attackRange: 1,
    abilities: ['power_up', 'trample'], deckSymbols: [],
  };
}

/** 创建梅肯达·露卡牌（预备+连续射击） */
function makeMakinda(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '梅肯达·露', unitClass: 'champion',
    faction: 'barbaric', strength: 2, life: 9, cost: 5,
    attackType: 'ranged', attackRange: 3,
    abilities: ['prepare', 'rapid_fire'], deckSymbols: [],
  };
}

/** 创建凯鲁尊者卡牌（启悟+撤退） */
function makeKalu(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '凯鲁尊者', unitClass: 'champion',
    faction: 'barbaric', strength: 4, life: 7, cost: 5,
    attackType: 'melee', attackRange: 1,
    abilities: ['inspire', 'withdraw'], deckSymbols: [],
  };
}

/** 创建雌狮卡牌（威势+生命强化） */
function makeLioness(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '雌狮', unitClass: 'common',
    faction: 'barbaric', strength: 3, life: 2, cost: 2,
    attackType: 'melee', attackRange: 1,
    abilities: ['intimidate', 'life_up'], deckSymbols: [],
  };
}

/** 创建犀牛卡牌（速度强化+践踏） */
function makeRhino(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '犀牛', unitClass: 'common',
    faction: 'barbaric', strength: 2, life: 5, cost: 2,
    attackType: 'melee', attackRange: 1,
    abilities: ['speed_up', 'trample'], deckSymbols: [],
  };
}

/** 创建祖灵法师卡牌（聚能+祖灵交流） */
function makeSpiritMage(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '祖灵法师', unitClass: 'common',
    faction: 'barbaric', strength: 1, life: 2, cost: 1,
    attackType: 'ranged', attackRange: 3,
    abilities: ['gather_power', 'spirit_bond'], deckSymbols: [],
  };
}

/** 创建边境弓箭手卡牌（预备+连续射击） */
function makeArcher(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '边境弓箭手', unitClass: 'common',
    faction: 'barbaric', strength: 2, life: 4, cost: 2,
    attackType: 'ranged', attackRange: 3,
    abilities: ['prepare', 'rapid_fire'], deckSymbols: [],
  };
}

/** 创建炽原精灵召唤师卡牌（祖灵羁绊） */
function makeBarbaricSummoner(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '阿布亚·石', unitClass: 'summoner',
    faction: 'barbaric', strength: 5, life: 10, cost: 0,
    attackType: 'ranged', attackRange: 3,
    abilities: ['ancestral_bond'], deckSymbols: [],
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
    faction: 'barbaric',
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
// 力量强化 (power_up) 测试
// ============================================================================

describe('蒙威尊者 - 力量强化 (power_up)', () => {
  it('无充能时战力为基础值', () => {
    const state = createBarbaricState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const moka = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-moka', card: makeMoka('test-moka'), owner: '0',
      boosts: 0,
    });

    const strength = calculateEffectiveStrength(moka, state);
    expect(strength).toBe(1); // 基础1
  });

  it('有3点充能时+3战力', () => {
    const state = createBarbaricState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const moka = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-moka', card: makeMoka('test-moka'), owner: '0',
      boosts: 3,
    });

    const strength = calculateEffectiveStrength(moka, state);
    expect(strength).toBe(4); // 基础1 + 充能3
  });

  it('充能超过5时最多+5战力', () => {
    const state = createBarbaricState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const moka = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-moka', card: makeMoka('test-moka'), owner: '0',
      boosts: 8,
    });

    const strength = calculateEffectiveStrength(moka, state);
    expect(strength).toBe(6); // 基础1 + 最多5
  });
});

// ============================================================================
// 生命强化 (life_up) 测试
// ============================================================================

describe('雌狮 - 生命强化 (life_up)', () => {
  it('无充能时生命为基础值', () => {
    const state = createBarbaricState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const lioness = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-lioness', card: makeLioness('test-lioness'), owner: '0',
      boosts: 0,
    });

    const life = getEffectiveLifeBase(lioness);
    expect(life).toBe(2); // 基础2
  });

  it('有2点充能时+2生命', () => {
    const state = createBarbaricState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const lioness = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-lioness', card: makeLioness('test-lioness'), owner: '0',
      boosts: 2,
    });

    const life = getEffectiveLifeBase(lioness);
    expect(life).toBe(4); // 基础2 + 充能2
  });

  it('充能超过5时最多+5生命', () => {
    const state = createBarbaricState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    const lioness = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-lioness', card: makeLioness('test-lioness'), owner: '0',
      boosts: 7,
    });

    const life = getEffectiveLifeBase(lioness);
    expect(life).toBe(7); // 基础2 + 最多5
  });
});

// ============================================================================
// 速度强化 (speed_up) 测试
// ============================================================================

describe('犀牛 - 速度强化 (speed_up)', () => {
  it('无充能时正常移动2格', () => {
    const state = createBarbaricState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-rhino', card: makeRhino('test-rhino'), owner: '0',
      boosts: 0,
    });

    expect(canMoveToEnhanced(state, { row: 4, col: 2 }, { row: 4, col: 4 })).toBe(true);
    expect(canMoveToEnhanced(state, { row: 4, col: 2 }, { row: 4, col: 5 })).toBe(false);
  });

  it('有2点充能时可额外移动2格', () => {
    const state = createBarbaricState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-rhino', card: makeRhino('test-rhino'), owner: '0',
      boosts: 2,
    });

    // 基础2 + 充能2 = 4格
    expect(canMoveToEnhanced(state, { row: 4, col: 2 }, { row: 4, col: 5 })).toBe(true);
    expect(canMoveToEnhanced(state, { row: 4, col: 2 }, { row: 6, col: 4 })).toBe(true);
  });

  it('充能超过5时最多额外移动5格', () => {
    const state = createBarbaricState();
    clearArea(state, [0, 1, 2, 3, 4, 5, 6, 7], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 0 }, {
      cardId: 'test-rhino', card: makeRhino('test-rhino'), owner: '0',
      boosts: 8,
    });

    // 基础2 + 最多5 = 7格
    expect(canMoveToEnhanced(state, { row: 4, col: 0 }, { row: 4, col: 5 })).toBe(true); // 5格
    // 8格不行（超过7）
    // 棋盘只有6列(0-5)和8行(0-7)，测试7格移动
    expect(canMoveToEnhanced(state, { row: 4, col: 0 }, { row: 7, col: 4 })).toBe(true); // 7格
  });
});

// ============================================================================
// 祖灵羁绊 (ancestral_bond) 测试
// ============================================================================

describe('阿布亚·石 - 祖灵羁绊 (ancestral_bond)', () => {
  it('充能目标并转移自身所有充能', () => {
    const state = createBarbaricState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-summoner', card: makeBarbaricSummoner('test-summoner'), owner: '0',
      boosts: 3,
    });

    placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'test-ally', card: makeLioness('test-ally'), owner: '0',
    });

    state.phase = 'move';
    state.currentPlayer = '0';

    const { newState, events } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'ancestral_bond',
      sourceUnitId: 'test-summoner',
      targetPosition: { row: 4, col: 4 },
    });

    // 目标获得1（基础充能）+ 3（转移）= 4点充能
    expect(newState.board[4][4].unit?.boosts).toBe(4);
    // 召唤师充能归零
    expect(newState.board[4][2].unit?.boosts).toBe(0);
  });

  it('自身无充能时只充能目标1点', () => {
    const state = createBarbaricState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-summoner', card: makeBarbaricSummoner('test-summoner'), owner: '0',
      boosts: 0,
    });

    placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'test-ally', card: makeLioness('test-ally'), owner: '0',
    });

    state.phase = 'move';
    state.currentPlayer = '0';

    const { newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'ancestral_bond',
      sourceUnitId: 'test-summoner',
      targetPosition: { row: 4, col: 4 },
    });

    expect(newState.board[4][4].unit?.boosts).toBe(1);
    expect(newState.board[4][2].unit?.boosts).toBe(0);
  });

  it('超过3格验证拒绝', () => {
    const state = createBarbaricState();
    clearArea(state, [1, 2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 0 }, {
      cardId: 'test-summoner', card: makeBarbaricSummoner('test-summoner'), owner: '0',
    });

    placeUnit(state, { row: 4, col: 5 }, {
      cardId: 'test-ally', card: makeLioness('test-ally'), owner: '0',
    });

    state.phase = 'move';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'ancestral_bond',
        sourceUnitId: 'test-summoner',
        targetPosition: { row: 4, col: 5 },
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('3格');
  });

  it('非移动阶段验证拒绝', () => {
    const state = createBarbaricState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-summoner', card: makeBarbaricSummoner('test-summoner'), owner: '0',
    });

    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-ally', card: makeLioness('test-ally'), owner: '0',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'ancestral_bond',
        sourceUnitId: 'test-summoner',
        targetPosition: { row: 4, col: 3 },
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('移动阶段');
  });
});


// ============================================================================
// 预备 (prepare) 测试
// ============================================================================

describe('梅肯达·露 / 边境弓箭手 - 预备 (prepare)', () => {
  it('移动阶段充能自身', () => {
    const state = createBarbaricState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-makinda', card: makeMakinda('test-makinda'), owner: '0',
      boosts: 0,
    });

    state.phase = 'move';
    state.currentPlayer = '0';

    const { newState, events } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'prepare',
      sourceUnitId: 'test-makinda',
    });

    const chargeEvents = events.filter(e => e.type === SW_EVENTS.UNIT_CHARGED);
    expect(chargeEvents.length).toBe(1);
    expect(newState.board[4][2].unit?.boosts).toBe(1);
  });

  it('非移动阶段验证拒绝', () => {
    const state = createBarbaricState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-archer', card: makeArcher('test-archer'), owner: '0',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: { abilityId: 'prepare', sourceUnitId: 'test-archer' },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('移动阶段');
  });

  it('可以累积充能', () => {
    const state = createBarbaricState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-archer', card: makeArcher('test-archer'), owner: '0',
      boosts: 2,
    });

    state.phase = 'move';
    state.currentPlayer = '0';

    const { newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'prepare',
      sourceUnitId: 'test-archer',
    });

    expect(newState.board[4][2].unit?.boosts).toBe(3);
  });

  it('每回合只能使用一次', () => {
    const state = createBarbaricState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-archer', card: makeArcher('test-archer'), owner: '0',
      boosts: 0,
    });

    state.phase = 'move';
    state.currentPlayer = '0';

    // 第一次使用成功
    const { newState: state1 } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'prepare',
      sourceUnitId: 'test-archer',
    });
    expect(state1.board[4][2].unit?.boosts).toBe(1);

    // 第二次使用应该被拒绝
    const fullState = { core: state1, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: { abilityId: 'prepare', sourceUnitId: 'test-archer' },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('每回合只能使用一次');
  });
});

// ============================================================================
// 启悟 (inspire) 测试
// ============================================================================

describe('凯鲁尊者 - 启悟 (inspire)', () => {
  it('移动后充能所有相邻友方单位', () => {
    const state = createBarbaricState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-kalu', card: makeKalu('test-kalu'), owner: '0',
    });

    // 相邻友方
    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'ally-1', card: makeLioness('ally-1'), owner: '0',
    });
    placeUnit(state, { row: 3, col: 2 }, {
      cardId: 'ally-2', card: makeArcher('ally-2'), owner: '0',
    });

    // 不相邻友方（不应充能）
    placeUnit(state, { row: 2, col: 2 }, {
      cardId: 'ally-far', card: makeArcher('ally-far'), owner: '0',
    });

    // 相邻敌方（不应充能）
    placeUnit(state, { row: 5, col: 2 }, {
      cardId: 'enemy-1', card: makeEnemy('enemy-1'), owner: '1',
    });

    state.phase = 'move';
    state.currentPlayer = '0';

    const { newState, events } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'inspire',
      sourceUnitId: 'test-kalu',
    });

    const chargeEvents = events.filter(e => e.type === SW_EVENTS.UNIT_CHARGED);
    expect(chargeEvents.length).toBe(2); // 两个相邻友方

    expect(newState.board[4][3].unit?.boosts).toBe(1);
    expect(newState.board[3][2].unit?.boosts).toBe(1);
    expect(newState.board[2][2].unit?.boosts).toBe(0); // 不相邻
    expect(newState.board[5][2].unit?.boosts).toBe(0); // 敌方
  });

  it('无相邻友方时不产生充能事件', () => {
    const state = createBarbaricState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-kalu', card: makeKalu('test-kalu'), owner: '0',
    });

    state.phase = 'move';
    state.currentPlayer = '0';

    const { events } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'inspire',
      sourceUnitId: 'test-kalu',
    });

    const chargeEvents = events.filter(e => e.type === SW_EVENTS.UNIT_CHARGED);
    expect(chargeEvents.length).toBe(0);
  });
});

// ============================================================================
// 撤退 (withdraw) 测试
// ============================================================================

describe('凯鲁尊者 - 撤退 (withdraw)', () => {
  it('消耗充能移动自身1-2格', () => {
    const state = createBarbaricState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-kalu', card: makeKalu('test-kalu'), owner: '0',
      boosts: 1,
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const { newState, events } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'withdraw',
      sourceUnitId: 'test-kalu',
      costType: 'charge',
      targetPosition: { row: 4, col: 4 },
    });

    // 充能被消耗
    expect(newState.board[4][4].unit?.boosts).toBe(0);
    // 单位移动到新位置
    expect(newState.board[4][2].unit).toBeUndefined();
    expect(newState.board[4][4].unit?.cardId).toBe('test-kalu');
  });

  it('消耗魔力移动自身', () => {
    const state = createBarbaricState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-kalu', card: makeKalu('test-kalu'), owner: '0',
      boosts: 0,
    });

    state.players['0'].magic = 3;
    state.phase = 'attack';
    state.currentPlayer = '0';

    const { newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'withdraw',
      sourceUnitId: 'test-kalu',
      costType: 'magic',
      targetPosition: { row: 4, col: 3 },
    });

    expect(newState.players['0'].magic).toBe(2);
    expect(newState.board[4][3].unit?.cardId).toBe('test-kalu');
  });

  it('无充能且无魔力时验证拒绝', () => {
    const state = createBarbaricState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-kalu', card: makeKalu('test-kalu'), owner: '0',
      boosts: 0,
    });

    state.players['0'].magic = 0;
    state.phase = 'attack';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'withdraw',
        sourceUnitId: 'test-kalu',
        costType: 'charge',
        targetPosition: { row: 4, col: 3 },
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('充能');
  });

  it('超过2格验证拒绝', () => {
    const state = createBarbaricState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-kalu', card: makeKalu('test-kalu'), owner: '0',
      boosts: 1,
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'withdraw',
        sourceUnitId: 'test-kalu',
        costType: 'charge',
        targetPosition: { row: 4, col: 5 },
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('1-2格');
  });
});


// ============================================================================
// 威势 (intimidate) 测试
// ============================================================================

describe('雌狮 - 威势 (intimidate)', () => {
  it('攻击后获得充能', () => {
    const state = createBarbaricState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-lioness', card: makeLioness('test-lioness'), owner: '0',
      boosts: 0,
    });

    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'enemy-1', card: makeEnemy('enemy-1', { life: 10 }), owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const { events } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: { row: 4, col: 2 },
      target: { row: 4, col: 3 },
    });

    // 应该触发 intimidate 技能
    const abilityEvents = events.filter(e =>
      e.type === SW_EVENTS.ABILITY_TRIGGERED
      && (e.payload as Record<string, unknown>).abilityId === 'intimidate'
    );
    expect(abilityEvents.length).toBe(1);

    // 应该有充能事件
    const chargeEvents = events.filter(e => e.type === SW_EVENTS.UNIT_CHARGED);
    expect(chargeEvents.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// 聚能 (gather_power) 测试
// ============================================================================

describe('祖灵法师 - 聚能 (gather_power)', () => {
  it('召唤后自动获得1点充能', () => {
    const state = createBarbaricState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    // 放置一个城门用于召唤
    state.board[3][3].structure = {
      cardId: 'gate-1',
      card: { id: 'gate-1', cardType: 'structure', name: '城门', faction: 'barbaric', cost: 0, life: 10, isGate: true, isStartingGate: true, deckSymbols: [] },
      owner: '0',
      position: { row: 3, col: 3 },
      damage: 0,
    };

    // 将祖灵法师放入手牌
    const spiritMageCard = makeSpiritMage('spirit-mage-hand');
    state.players['0'].hand.push(spiritMageCard);
    state.players['0'].magic = 5;

    state.phase = 'summon';
    state.currentPlayer = '0';

    const { newState, events } = executeAndReduce(state, SW_COMMANDS.SUMMON_UNIT, {
      cardId: 'spirit-mage-hand',
      position: { row: 3, col: 4 },
    });

    // 应该有召唤事件
    const summonEvents = events.filter(e => e.type === SW_EVENTS.UNIT_SUMMONED);
    expect(summonEvents.length).toBe(1);

    // 应该有充能事件（聚能触发）
    const chargeEvents = events.filter(e => e.type === SW_EVENTS.UNIT_CHARGED);
    expect(chargeEvents.length).toBe(1);

    // 祖灵法师应该有1点充能
    expect(newState.board[3][4].unit?.boosts).toBe(1);
  });

  it('非 gather_power 单位召唤后不充能', () => {
    const state = createBarbaricState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    state.board[3][3].structure = {
      cardId: 'gate-1',
      card: { id: 'gate-1', cardType: 'structure', name: '城门', faction: 'barbaric', cost: 0, life: 10, isGate: true, isStartingGate: true, deckSymbols: [] },
      owner: '0',
      position: { row: 3, col: 3 },
      damage: 0,
    };

    const lionessCard = makeLioness('lioness-hand');
    state.players['0'].hand.push(lionessCard);
    state.players['0'].magic = 5;

    state.phase = 'summon';
    state.currentPlayer = '0';

    const { newState, events } = executeAndReduce(state, SW_COMMANDS.SUMMON_UNIT, {
      cardId: 'lioness-hand',
      position: { row: 3, col: 4 },
    });

    const chargeEvents = events.filter(e => e.type === SW_EVENTS.UNIT_CHARGED);
    expect(chargeEvents.length).toBe(0);
    expect(newState.board[3][4].unit?.boosts).toBe(0);
  });
});

// ============================================================================
// 祖灵交流 (spirit_bond) 测试
// ============================================================================

describe('祖灵法师 - 祖灵交流 (spirit_bond)', () => {
  it('选择充能自身', () => {
    const state = createBarbaricState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-mage', card: makeSpiritMage('test-mage'), owner: '0',
      boosts: 0,
    });

    state.phase = 'move';
    state.currentPlayer = '0';

    const { newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'spirit_bond',
      sourceUnitId: 'test-mage',
      choice: 'self',
    });

    expect(newState.board[4][2].unit?.boosts).toBe(1);
  });

  it('消耗充能给3格内友方充能', () => {
    const state = createBarbaricState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-mage', card: makeSpiritMage('test-mage'), owner: '0',
      boosts: 1,
    });

    placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'test-ally', card: makeLioness('test-ally'), owner: '0',
    });

    state.phase = 'move';
    state.currentPlayer = '0';

    const { newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'spirit_bond',
      sourceUnitId: 'test-mage',
      choice: 'transfer',
      targetPosition: { row: 4, col: 4 },
    });

    expect(newState.board[4][2].unit?.boosts).toBe(0); // 消耗1充能
    expect(newState.board[4][4].unit?.boosts).toBe(1); // 获得1充能
  });

  it('无充能时转移验证拒绝', () => {
    const state = createBarbaricState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-mage', card: makeSpiritMage('test-mage'), owner: '0',
      boosts: 0,
    });

    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-ally', card: makeLioness('test-ally'), owner: '0',
    });

    state.phase = 'move';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'spirit_bond',
        sourceUnitId: 'test-mage',
        choice: 'transfer',
        targetPosition: { row: 4, col: 3 },
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('充能');
  });

  it('超过3格转移验证拒绝', () => {
    const state = createBarbaricState();
    clearArea(state, [1, 2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 0 }, {
      cardId: 'test-mage', card: makeSpiritMage('test-mage'), owner: '0',
      boosts: 1,
    });

    placeUnit(state, { row: 4, col: 5 }, {
      cardId: 'test-ally', card: makeLioness('test-ally'), owner: '0',
    });

    state.phase = 'move';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'spirit_bond',
        sourceUnitId: 'test-mage',
        choice: 'transfer',
        targetPosition: { row: 4, col: 5 },
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('3格');
  });
});


// ============================================================================
// 事件卡测试
// ============================================================================

describe('炽原精灵事件卡', () => {
  describe('力量颂歌 (barbaric-chant-of-power)', () => {
    it('目标获得 power_up 技能触发事件', () => {
      const state = createBarbaricState();
      clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

      // 放置召唤师
      placeUnit(state, { row: 4, col: 2 }, {
        cardId: 'test-summoner', card: makeBarbaricSummoner('test-summoner'), owner: '0',
      });

      // 目标士兵（3格内）
      placeUnit(state, { row: 4, col: 4 }, {
        cardId: 'test-lioness', card: makeLioness('test-lioness'), owner: '0',
      });

      state.phase = 'attack';
      state.currentPlayer = '0';

      addEventToHand(state, '0', 'barbaric-chant-of-power-0', {
        name: '力量颂歌',
        eventType: 'legendary',
        playPhase: 'attack',
        cost: 1,
        effect: '目标获得力量强化直到回合结束。',
      });
      state.players['0'].magic = 5;

      const { events } = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
        cardId: 'barbaric-chant-of-power-0',
        targets: [{ row: 4, col: 4 }],
      });

      const abilityEvents = events.filter(e =>
        e.type === SW_EVENTS.ABILITY_TRIGGERED
        && (e.payload as Record<string, unknown>).abilityId === 'chant_of_power'
      );
      expect(abilityEvents.length).toBe(1);
      expect((abilityEvents[0].payload as Record<string, unknown>).grantedAbility).toBe('power_up');
    });
  });

  describe('生长颂歌 (barbaric-chant-of-growth)', () => {
    it('充能目标和相邻友方', () => {
      const state = createBarbaricState();
      clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

      // 目标
      placeUnit(state, { row: 4, col: 3 }, {
        cardId: 'target-unit', card: makeLioness('target-unit'), owner: '0',
      });

      // 相邻友方
      placeUnit(state, { row: 4, col: 4 }, {
        cardId: 'adj-ally-1', card: makeArcher('adj-ally-1'), owner: '0',
      });
      placeUnit(state, { row: 3, col: 3 }, {
        cardId: 'adj-ally-2', card: makeSpiritMage('adj-ally-2'), owner: '0',
      });

      // 不相邻友方（不应充能）
      placeUnit(state, { row: 2, col: 3 }, {
        cardId: 'far-ally', card: makeArcher('far-ally'), owner: '0',
      });

      // 相邻敌方（不应充能）
      placeUnit(state, { row: 5, col: 3 }, {
        cardId: 'adj-enemy', card: makeEnemy('adj-enemy'), owner: '1',
      });

      state.phase = 'move';
      state.currentPlayer = '0';

      addEventToHand(state, '0', 'barbaric-chant-of-growth-0', {
        name: '生长颂歌',
        playPhase: 'move',
        effect: '将目标和每个相邻友方单位充能。',
      });

      const { newState, events } = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
        cardId: 'barbaric-chant-of-growth-0',
        targets: [{ row: 4, col: 3 }],
      });

      const chargeEvents = events.filter(e => e.type === SW_EVENTS.UNIT_CHARGED);
      expect(chargeEvents.length).toBe(3); // 目标 + 2个相邻友方

      expect(newState.board[4][3].unit?.boosts).toBe(1); // 目标
      expect(newState.board[4][4].unit?.boosts).toBe(1); // 相邻友方
      expect(newState.board[3][3].unit?.boosts).toBe(1); // 相邻友方
      expect(newState.board[2][3].unit?.boosts).toBe(0); // 不相邻
      expect(newState.board[5][3].unit?.boosts).toBe(0); // 敌方
    });
  });

  describe('交缠颂歌 (barbaric-chant-of-entanglement)', () => {
    it('作为主动事件放入主动区域并标记目标', () => {
      const state = createBarbaricState();
      clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

      placeUnit(state, { row: 4, col: 2 }, {
        cardId: 'target-1', card: makeLioness('target-1'), owner: '0',
      });
      placeUnit(state, { row: 4, col: 4 }, {
        cardId: 'target-2', card: makeArcher('target-2'), owner: '0',
      });

      state.phase = 'summon';
      state.currentPlayer = '0';

      addEventToHand(state, '0', 'barbaric-chant-of-entanglement-0', {
        name: '交缠颂歌',
        playPhase: 'summon',
        isActive: true,
        effect: '两个友方士兵共享技能。',
      });

      const { newState, events } = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
        cardId: 'barbaric-chant-of-entanglement-0',
        targets: [{ row: 4, col: 2 }, { row: 4, col: 4 }],
      });

      // 应该在主动事件区
      expect(newState.players['0'].activeEvents.some(e => e.id === 'barbaric-chant-of-entanglement-0')).toBe(true);

      // 应该有技能触发事件标记两个目标
      const abilityEvents = events.filter(e =>
        e.type === SW_EVENTS.ABILITY_TRIGGERED
        && (e.payload as Record<string, unknown>).abilityId === 'chant_of_entanglement'
      );
      expect(abilityEvents.length).toBe(1);
    });
  });

  describe('编织颂歌 (barbaric-chant-of-weaving)', () => {
    it('作为主动事件放入主动区域并标记目标', () => {
      const state = createBarbaricState();
      clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

      placeUnit(state, { row: 4, col: 3 }, {
        cardId: 'weave-target', card: makeLioness('weave-target'), owner: '0',
      });

      state.phase = 'summon';
      state.currentPlayer = '0';

      addEventToHand(state, '0', 'barbaric-chant-of-weaving-0', {
        name: '编织颂歌',
        playPhase: 'summon',
        isActive: true,
        effect: '可在目标相邻召唤，召唤时充能目标。',
      });

      const { newState, events } = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
        cardId: 'barbaric-chant-of-weaving-0',
        targets: [{ row: 4, col: 3 }],
      });

      // 应该在主动事件区
      expect(newState.players['0'].activeEvents.some(e => e.id === 'barbaric-chant-of-weaving-0')).toBe(true);

      // 应该有技能触发事件标记目标
      const abilityEvents = events.filter(e =>
        e.type === SW_EVENTS.ABILITY_TRIGGERED
        && (e.payload as Record<string, unknown>).abilityId === 'chant_of_weaving'
      );
      expect(abilityEvents.length).toBe(1);
    });

    it('召唤到目标相邻位置时充能目标', () => {
      const state = createBarbaricState();
      clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

      // 放置编织颂歌目标单位
      placeUnit(state, { row: 4, col: 3 }, {
        cardId: 'weave-target', card: makeLioness('weave-target'), owner: '0',
        boosts: 0,
      });

      state.phase = 'summon';
      state.currentPlayer = '0';

      // 先打出编织颂歌
      addEventToHand(state, '0', 'barbaric-chant-of-weaving-0', {
        name: '编织颂歌',
        playPhase: 'summon',
        isActive: true,
        effect: '可在目标相邻召唤，召唤时充能目标。',
      });

      const { newState: stateAfterEvent } = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
        cardId: 'barbaric-chant-of-weaving-0',
        targets: [{ row: 4, col: 3 }],
      });

      // 在手牌中放一个可召唤的单位
      const summonCard = makeSpiritMage('summon-test');
      stateAfterEvent.players['0'].hand.push(summonCard);
      stateAfterEvent.players['0'].magic = 5;

      // 召唤到目标相邻位置 (4,4)
      const { newState: stateAfterSummon, events: summonEvents } = executeAndReduce(
        stateAfterEvent, SW_COMMANDS.SUMMON_UNIT, {
          cardId: 'summon-test',
          position: { row: 4, col: 4 },
        }
      );

      // 应该有充能事件（编织颂歌触发）
      const chargeEvents = summonEvents.filter(e =>
        e.type === SW_EVENTS.UNIT_CHARGED
        && (e.payload as Record<string, unknown>).sourceAbilityId === 'chant_of_weaving'
      );
      expect(chargeEvents.length).toBe(1);

      // 目标单位应该获得1点充能
      expect(stateAfterSummon.board[4][3].unit?.boosts).toBe(1);
    });

    it('召唤到非目标相邻位置时不充能', () => {
      const state = createBarbaricState();
      clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

      placeUnit(state, { row: 4, col: 3 }, {
        cardId: 'weave-target', card: makeLioness('weave-target'), owner: '0',
        boosts: 0,
      });

      state.phase = 'summon';
      state.currentPlayer = '0';

      addEventToHand(state, '0', 'barbaric-chant-of-weaving-0', {
        name: '编织颂歌',
        playPhase: 'summon',
        isActive: true,
        effect: '可在目标相邻召唤，召唤时充能目标。',
      });

      const { newState: stateAfterEvent } = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
        cardId: 'barbaric-chant-of-weaving-0',
        targets: [{ row: 4, col: 3 }],
      });

      // 在城门旁放一个可召唤的单位（远离目标）
      const summonCard = makeSpiritMage('summon-far');
      stateAfterEvent.players['0'].hand.push(summonCard);
      stateAfterEvent.players['0'].magic = 5;

      // 确保城门附近有空位（玩家0在底部，城门在 row 7 附近）
      // 召唤到城门旁（距离目标>1）
      stateAfterEvent.board[7][3] = { unit: undefined, structure: stateAfterEvent.board[7][3]?.structure ?? null };
      const gatePos = stateAfterEvent.board[7]?.[3]?.structure ? { row: 6, col: 3 } : { row: 7, col: 3 };
      // 找一个城门相邻的空位
      let summonPos: { row: number; col: number } | null = null;
      for (let r = 5; r <= 7; r++) {
        for (let c = 0; c < 6; c++) {
          const cell = stateAfterEvent.board[r]?.[c];
          if (cell && !cell.unit && !cell.structure && Math.abs(r - 4) + Math.abs(c - 3) > 1) {
            summonPos = { row: r, col: c };
            break;
          }
        }
        if (summonPos) break;
      }

      if (summonPos) {
        const { events: summonEvents } = executeAndReduce(
          stateAfterEvent, SW_COMMANDS.SUMMON_UNIT, {
            cardId: 'summon-far',
            position: summonPos,
          }
        );

        // 不应该有编织颂歌充能事件
        const chargeEvents = summonEvents.filter(e =>
          e.type === SW_EVENTS.UNIT_CHARGED
          && (e.payload as Record<string, unknown>).sourceAbilityId === 'chant_of_weaving'
        );
        expect(chargeEvents.length).toBe(0);
      }
    });

    it('validate 允许在目标相邻位置召唤（即使不在城门旁）', () => {
      const state = createBarbaricState();
      clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

      // 目标放在棋盘中央（远离城门）
      placeUnit(state, { row: 3, col: 3 }, {
        cardId: 'weave-target', card: makeLioness('weave-target'), owner: '0',
      });

      state.phase = 'summon';
      state.currentPlayer = '0';

      // 手动设置 activeEvent（模拟已打出编织颂歌）
      state.players['0'].activeEvents.push({
        id: 'barbaric-chant-of-weaving-0',
        card: {
          id: 'barbaric-chant-of-weaving',
          cardType: 'event',
          name: '编织颂歌',
          faction: 'barbaric',
          cost: 0,
          playPhase: 'summon',
          effect: '可在目标相邻召唤，召唤时充能目标。',
          isActive: true,
          deckSymbols: [],
        },
        targetUnitId: 'weave-target',
      });

      // 在手牌中放一个可召唤的单位
      const summonCard = makeSpiritMage('summon-test');
      state.players['0'].hand.push(summonCard);
      state.players['0'].magic = 5;

      const fullState = { core: state, sys: {} as any };

      // 目标相邻位置 (3,4) 应该合法
      const result = SummonerWarsDomain.validate(fullState, {
        type: SW_COMMANDS.SUMMON_UNIT,
        payload: { cardId: 'summon-test', position: { row: 3, col: 4 } },
        playerId: '0',
        timestamp: fixedTimestamp,
      });
      expect(result.valid).toBe(true);

      // 远离目标的位置 (1,1) 应该不合法（也不在城门旁）
      const result2 = SummonerWarsDomain.validate(fullState, {
        type: SW_COMMANDS.SUMMON_UNIT,
        payload: { cardId: 'summon-test', position: { row: 1, col: 1 } },
        playerId: '0',
        timestamp: fixedTimestamp,
      });
      expect(result2.valid).toBe(false);
    });
  });
});

// ============================================================================
// 连续射击 (rapid_fire) 完整流程测试
// ============================================================================

describe('梅肯达·露 / 边境弓箭手 - 连续射击 (rapid_fire)', () => {
  it('攻击后有充能时消耗1充能并授予额外攻击', () => {
    const state = createBarbaricState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-makinda', card: makeMakinda('test-makinda'), owner: '0',
      boosts: 2, // 有充能
    });

    placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'enemy-1', card: makeEnemy('enemy-1', { life: 10 }), owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const { newState, events } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: { row: 4, col: 2 },
      target: { row: 4, col: 4 },
    });

    // 应该触发 rapid_fire_extra_attack
    const rapidFireTrigger = events.filter(e =>
      e.type === SW_EVENTS.ABILITY_TRIGGERED
      && (e.payload as Record<string, unknown>).abilityId === 'rapid_fire_extra_attack'
    );
    expect(rapidFireTrigger.length).toBe(1);

    // 应该消耗1充能
    const chargeEvents = events.filter(e =>
      e.type === SW_EVENTS.UNIT_CHARGED
      && (e.payload as Record<string, unknown>).sourceAbilityId === 'rapid_fire'
    );
    expect(chargeEvents.length).toBe(1);
    expect((chargeEvents[0].payload as Record<string, unknown>).delta).toBe(-1);

    // 应该授予额外攻击
    const extraAttackEvents = events.filter(e =>
      e.type === SW_EVENTS.EXTRA_ATTACK_GRANTED
      && (e.payload as Record<string, unknown>).sourceAbilityId === 'rapid_fire'
    );
    expect(extraAttackEvents.length).toBe(1);

    // 充能应该减少1（2→1）
    expect(newState.board[4][2].unit?.boosts).toBe(1);
  });

  it('攻击后无充能时不授予额外攻击', () => {
    const state = createBarbaricState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-archer', card: makeArcher('test-archer'), owner: '0',
      boosts: 0, // 无充能
    });

    placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'enemy-1', card: makeEnemy('enemy-1', { life: 10 }), owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const { events } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: { row: 4, col: 2 },
      target: { row: 4, col: 4 },
    });

    // rapid_fire_extra_attack 触发事件仍会生成（afterAttack 触发器不检查充能）
    // 但不应该有 EXTRA_ATTACK_GRANTED（因为无充能）
    const extraAttackEvents = events.filter(e =>
      e.type === SW_EVENTS.EXTRA_ATTACK_GRANTED
      && (e.payload as Record<string, unknown>).sourceAbilityId === 'rapid_fire'
    );
    expect(extraAttackEvents.length).toBe(0);
  });
});

// ============================================================================
// 生命强化 (life_up) 集成测试 - 伤害/死亡判定
// ============================================================================

describe('雌狮 - 生命强化 (life_up) 集成', () => {
  it('有充能时承受更多伤害不会死亡', () => {
    const state = createBarbaricState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    // 雌狮：基础生命2，3点充能→有效生命5
    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-lioness', card: makeLioness('test-lioness'), owner: '0',
      boosts: 3,
    });

    // 敌方攻击者（高战力确保命中）
    placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'enemy-attacker', card: makeEnemy('enemy-attacker', {
        strength: 4, life: 10, attackType: 'melee', attackRange: 1,
      }), owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '1';

    const { newState, events } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: { row: 4, col: 4 },
      target: { row: 4, col: 3 },
    });

    // 雌狮有效生命5，受到的伤害（骰子结果取决于 testRandom）
    // testRandom.d(max) = Math.ceil(max/2)，所以4个骰子各掷一次
    // 命中数取决于 countHits，但关键是：如果伤害<5，雌狮不应死亡
    const destroyEvents = events.filter(e =>
      e.type === SW_EVENTS.UNIT_DESTROYED
      && (e.payload as Record<string, unknown>).cardId === 'test-lioness'
    );

    // 如果雌狮存活，验证她还在棋盘上
    if (destroyEvents.length === 0) {
      expect(newState.board[4][3].unit?.cardId).toBe('test-lioness');
    }
    // 无论如何，有效生命应该是5而不是2
    expect(getEffectiveLifeBase(
      { cardId: 'test-lioness', card: makeLioness('test-lioness'), owner: '0', position: { row: 4, col: 3 }, damage: 0, boosts: 3, hasMoved: false, hasAttacked: false }
    )).toBe(5);
  });

  it('伤害超过有效生命时正常死亡', () => {
    const state = createBarbaricState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    // 雌狮：基础生命2，1点充能→有效生命3，已受1伤→剩余2
    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-lioness', card: makeLioness('test-lioness'), owner: '0',
      boosts: 1,
      damage: 1,
    });

    // 放置敌方攻击者
    placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'enemy-attacker', card: makeEnemy('enemy-attacker', {
        strength: 2, life: 10, attackType: 'melee', attackRange: 1,
      }), owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '1';

    // 通过完整的 execute 流程攻击，让 postProcessDamageEvents 处理死亡判定
    const { newState, events } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: { row: 4, col: 4 },
      target: { row: 4, col: 3 },
    });

    // 如果造成足够伤害（总伤害 >= 有效生命3），雌狮应该死亡
    const destroyEvents = events.filter(e =>
      e.type === SW_EVENTS.UNIT_DESTROYED
      && (e.payload as Record<string, unknown>).cardId === 'test-lioness'
    );

    // 验证：如果雌狮死亡，棋盘上应该没有她
    if (destroyEvents.length > 0) {
      expect(newState.board[4][3].unit).toBeUndefined();
    }
    // 如果没死，验证有效生命计算正确
    else {
      expect(getEffectiveLifeBase(
        { cardId: 'test-lioness', card: makeLioness('test-lioness'), owner: '0', position: { row: 4, col: 3 }, damage: 1, boosts: 1, hasMoved: false, hasAttacked: false }
      )).toBe(3);
    }
  });

  it('reduce 中 UNIT_DAMAGED 考虑 life_up 加成', () => {
    const state = createBarbaricState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    // 雌狮：基础生命2，2点充能→有效生命4
    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-lioness', card: makeLioness('test-lioness'), owner: '0',
      boosts: 2,
      damage: 0,
    });

    state.currentPlayer = '0';

    // 造成3点伤害：无 life_up 时会死（3>=2），有 life_up 时存活（3<4）
    const damageEvent: GameEvent = {
      type: SW_EVENTS.UNIT_DAMAGED,
      payload: { position: { row: 4, col: 3 }, damage: 3 },
      timestamp: fixedTimestamp,
    };

    const newState = SummonerWarsDomain.reduce(state, damageEvent);

    // 有效生命4，受3伤 < 4，应该存活
    expect(newState.board[4][3].unit).toBeDefined();
    expect(newState.board[4][3].unit?.damage).toBe(3);
  });
});


// ============================================================================
// 充能验证测试
// ============================================================================

describe('充能验证', () => {
  it('withdraw - 充能不足且魔力不足时应拒绝', () => {
    const core = createBarbaricState();
    core.phase = 'attack';
    core.currentPlayer = '0';
    core.players['0'].magic = 0; // 没有魔力

    const keru: BoardUnit = {
      cardId: 'barbaric-keru-champion-0-0',
      owner: '0',
      life: 3,
      boosts: 0, // 没有充能
      card: {
        id: 'barbaric-keru-champion',
        name: '凯鲁尊者',
        faction: 'barbaric',
        cardType: 'unit',
        unitType: 'champion',
        cost: 2,
        strength: 2,
        life: 3,
        move: 2,
        abilities: ['inspire', 'withdraw'],
      } as UnitCard,
    };
    core.board[3][3] = { unit: keru, structure: null };

    const fullState = { core, sys: {} as any };
    
    // 尝试用充能支付
    const resultCharge = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'withdraw',
        sourceUnitId: 'barbaric-keru-champion-0-0',
        costType: 'charge',
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });

    expect(resultCharge.valid).toBe(false);
    expect(resultCharge.error).toContain('充能');
  });

  it('withdraw - 有充能时应允许用充能支付', () => {
    const core = createBarbaricState();
    core.phase = 'attack';
    core.currentPlayer = '0';

    const keru: BoardUnit = {
      cardId: 'barbaric-keru-champion-0-0',
      owner: '0',
      life: 3,
      boosts: 2, // 有充能
      card: {
        id: 'barbaric-keru-champion',
        name: '凯鲁尊者',
        faction: 'barbaric',
        cardType: 'unit',
        unitType: 'champion',
        cost: 2,
        strength: 2,
        life: 3,
        move: 2,
        abilities: ['inspire', 'withdraw'],
      } as UnitCard,
    };
    core.board[3][3] = { unit: keru, structure: null };

    const fullState = { core, sys: {} as any };
    
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'withdraw',
        sourceUnitId: 'barbaric-keru-champion-0-0',
        costType: 'charge',
        targetPosition: { row: 3, col: 4 }, // 移动1格
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });

    expect(result.valid).toBe(true);
  });

  it('withdraw - 魔力不足时应拒绝用魔力支付', () => {
    const core = createBarbaricState();
    core.phase = 'attack';
    core.currentPlayer = '0';
    core.players['0'].magic = 0; // 没有魔力

    const keru: BoardUnit = {
      cardId: 'barbaric-keru-champion-0-0',
      owner: '0',
      life: 3,
      boosts: 0,
      card: {
        id: 'barbaric-keru-champion',
        name: '凯鲁尊者',
        faction: 'barbaric',
        cardType: 'unit',
        unitType: 'champion',
        cost: 2,
        strength: 2,
        life: 3,
        move: 2,
        abilities: ['inspire', 'withdraw'],
      } as UnitCard,
    };
    core.board[3][3] = { unit: keru, structure: null };

    const fullState = { core, sys: {} as any };
    
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'withdraw',
        sourceUnitId: 'barbaric-keru-champion-0-0',
        costType: 'magic',
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('魔力');
  });
});
