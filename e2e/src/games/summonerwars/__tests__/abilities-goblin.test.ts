/**
 * 召唤师战争 - 洞穴地精技能测试
 *
 * 覆盖：
 * - immobile（禁足）：不能移动
 * - climb（攀爬）：额外移动1格 + 穿过建筑
 * - charge（冲锋）：1-4格直线移动，3+格时+1战力
 * - ferocity（凶残）：可作为额外攻击单位（超过3次限制）
 * - vanish（神出鬼没）：与0费友方交换位置
 * - blood_rune（鲜血符文）：自伤1或花1魔力充能
 * - power_boost（力量强化）：复用亡灵法师定义
 * - magic_addiction（魔力成瘾）：回合结束花1魔力或自毁
 * - feed_beast（喂养巨食兽）：攻击阶段结束未击杀则吃友方或自毁
 * - 事件卡：群情激愤、潜行、不屈不挠、成群结队
 */

import { describe, it, expect, vi } from 'vitest';
import { SummonerWarsDomain, SW_COMMANDS, SW_EVENTS } from '../domain';
import type { SummonerWarsCore, CellCoord, BoardUnit, UnitCard, EventCard, PlayerId } from '../domain/types';
import type { RandomFn, GameEvent } from '../../../engine/types';
import { generateInstanceId } from '../domain/utils';
import {
  canMoveToEnhanced, canAttackEnhanced,
  isImmobileBase, hasChargeAbilityBase, hasFerocityAbilityBase,
  getValidMoveTargetsEnhanced,
} from '../domain/helpers';
import { getEffectiveStrengthValue } from '../domain/abilityResolver';
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

/** 创建洞穴地精 vs 亡灵法师的测试状态 */
function createGoblinState(): SummonerWarsCore {
  return createInitializedCore(['0', '1'], createTestRandom(), {
    faction0: 'goblin',
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

/** 创建攀爬手卡牌 */
function makeClimber(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '部落攀爬手', unitClass: 'common',
    faction: 'goblin', strength: 1, life: 3, cost: 0,
    attackType: 'melee', attackRange: 1,
    abilities: ['climb'], deckSymbols: [],
  };
}

/** 创建野兽骑手卡牌（冲锋） */
function makeBeastRider(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '野兽骑手', unitClass: 'common',
    faction: 'goblin', strength: 3, life: 3, cost: 2,
    attackType: 'melee', attackRange: 1,
    abilities: ['charge'], deckSymbols: [],
  };
}

/** 创建投石手卡牌（凶残） */
function makeSlinger(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '部落投石手', unitClass: 'common',
    faction: 'goblin', strength: 2, life: 1, cost: 0,
    attackType: 'ranged', attackRange: 3,
    abilities: ['ferocity'], deckSymbols: [],
  };
}

/** 创建抓附手卡牌（禁足+抓附） */
function makeGrabber(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '部落抓附手', unitClass: 'common',
    faction: 'goblin', strength: 2, life: 2, cost: 0,
    attackType: 'melee', attackRange: 1,
    abilities: ['immobile', 'grab'], deckSymbols: [],
  };
}

/** 创建布拉夫卡牌（鲜血符文+力量强化） */
function makeBlarf(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '布拉夫', unitClass: 'champion',
    faction: 'goblin', strength: 0, life: 6, cost: 0,
    attackType: 'melee', attackRange: 1,
    abilities: ['blood_rune', 'power_boost'], deckSymbols: [],
  };
}

/** 创建史米革卡牌（魔力成瘾+凶残） */
function makeSmirg(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '史米革', unitClass: 'champion',
    faction: 'goblin', strength: 2, life: 4, cost: 0,
    attackType: 'ranged', attackRange: 3,
    abilities: ['magic_addiction', 'ferocity'], deckSymbols: [],
  };
}

/** 创建巨食兽卡牌 */
function makeGlutton(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '巨食兽', unitClass: 'champion',
    faction: 'goblin', strength: 5, life: 9, cost: 6,
    attackType: 'melee', attackRange: 1,
    abilities: ['feed_beast'], deckSymbols: [],
  };
}

/** 创建思尼克斯卡牌（神出鬼没） */
function makeGoblinSummoner(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '思尼克斯', unitClass: 'summoner',
    faction: 'goblin', strength: 2, life: 11, cost: 0,
    attackType: 'melee', attackRange: 1,
    abilities: ['vanish'], deckSymbols: [],
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

/** 创建0费友方单位 */
function makeZeroCostAlly(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '0费友方', unitClass: 'common',
    faction: 'goblin', strength: 1, life: 2, cost: 0,
    attackType: 'melee', attackRange: 1, deckSymbols: [],
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
    faction: 'goblin',
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
// 禁足 (immobile) 测试
// ============================================================================

describe('部落抓附手 - 禁足 (immobile)', () => {
  it('isImmobile 对有 immobile 技能的单位返回 true', () => {
    const grabber: BoardUnit = {
      cardId: 'test', card: makeGrabber('test'), owner: '0',
      position: { row: 0, col: 0 }, damage: 0, boosts: 0,
      hasMoved: false, hasAttacked: false,
    };
    expect(isImmobileBase(grabber)).toBe(true);
  });

  it('isImmobile 对无 immobile 技能的单位返回 false', () => {
    const rider: BoardUnit = {
      cardId: 'test', card: makeBeastRider('test'), owner: '0',
      position: { row: 0, col: 0 }, damage: 0, boosts: 0,
      hasMoved: false, hasAttacked: false,
    };
    expect(isImmobileBase(rider)).toBe(false);
  });

  it('禁足单位无法移动（getValidMoveTargetsEnhanced 返回空）', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-grabber',
      card: makeGrabber('test-grabber'),
      owner: '0',
    });

    const targets = getValidMoveTargetsEnhanced(state, { row: 4, col: 2 });
    expect(targets.length).toBe(0);
  });

  it('禁足单位移动命令被验证拒绝', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-grabber',
      card: makeGrabber('test-grabber'),
      owner: '0',
    });

    state.phase = 'move';
    state.currentPlayer = '0';
    state.players['0'].moveCount = 0;

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.MOVE_UNIT,
      payload: { from: { row: 4, col: 2 }, to: { row: 4, col: 3 } },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('禁足');
  });
});

// ============================================================================
// 攀爬 (climb) 测试
// ============================================================================

describe('部落攀爬手 - 攀爬 (climb)', () => {
  it('攀爬单位可以移动3格（基础2+额外1）', () => {
    const state = createGoblinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-climber',
      card: makeClimber('test-climber'),
      owner: '0',
    });

    expect(canMoveToEnhanced(state, { row: 4, col: 2 }, { row: 4, col: 5 })).toBe(true); // 距离3
    expect(canMoveToEnhanced(state, { row: 4, col: 2 }, { row: 1, col: 2 })).toBe(true); // 距离3
  });

  it('攀爬单位可以穿过建筑', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    placeUnit(state, { row: 4, col: 1 }, {
      cardId: 'test-climber',
      card: makeClimber('test-climber'),
      owner: '0',
    });

    // 中间有建筑在 (4,2)
    state.board[4][2].structure = {
      cardId: 'test-wall', card: {
        id: 'test-wall', cardType: 'structure', name: '城墙',
        faction: 'necromancer', cost: 0, life: 5, deckSymbols: [],
      }, owner: '1', position: { row: 4, col: 2 }, damage: 0,
    };

    // 攀爬可以穿过建筑到 (4,3)
    expect(canMoveToEnhanced(state, { row: 4, col: 1 }, { row: 4, col: 3 })).toBe(true);
  });

  it('攀爬单位不能穿过其他单位', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    placeUnit(state, { row: 4, col: 1 }, {
      cardId: 'test-climber',
      card: makeClimber('test-climber'),
      owner: '0',
    });

    // 中间有敌方单位在 (4,2)
    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-blocker',
      card: makeEnemy('test-blocker'),
      owner: '1',
    });

    // 攀爬不能穿过单位（直线被阻挡）
    expect(canMoveToEnhanced(state, { row: 4, col: 1 }, { row: 4, col: 3 })).toBe(false);
  });
});

// ============================================================================
// 冲锋 (charge) 测试
// ============================================================================

describe('野兽骑手 - 冲锋 (charge)', () => {
  it('hasChargeAbility 对有 charge 技能的单位返回 true', () => {
    const rider: BoardUnit = {
      cardId: 'test', card: makeBeastRider('test'), owner: '0',
      position: { row: 0, col: 0 }, damage: 0, boosts: 0,
      hasMoved: false, hasAttacked: false,
    };
    expect(hasChargeAbilityBase(rider)).toBe(true);
  });

  it('冲锋单位可以直线移动1-4格', () => {
    const state = createGoblinState();
    clearArea(state, [1, 2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 1 }, {
      cardId: 'test-rider',
      card: makeBeastRider('test-rider'),
      owner: '0',
    });

    // 直线1格
    expect(canMoveToEnhanced(state, { row: 4, col: 1 }, { row: 4, col: 2 })).toBe(true);
    // 直线2格
    expect(canMoveToEnhanced(state, { row: 4, col: 1 }, { row: 4, col: 3 })).toBe(true);
    // 直线3格
    expect(canMoveToEnhanced(state, { row: 4, col: 1 }, { row: 4, col: 4 })).toBe(true);
    // 直线4格
    expect(canMoveToEnhanced(state, { row: 4, col: 1 }, { row: 4, col: 5 })).toBe(true);
    // 直线5格 - 超出范围
    expect(canMoveToEnhanced(state, { row: 4, col: 1 }, { row: 4, col: 6 })).toBe(false);
  });

  it('冲锋路径被阻挡时无法通过', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 1 }, {
      cardId: 'test-rider',
      card: makeBeastRider('test-rider'),
      owner: '0',
    });

    // 中间有阻挡
    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-blocker',
      card: makeEnemy('test-blocker'),
      owner: '1',
    });

    // 冲锋到阻挡后面不行
    expect(canMoveToEnhanced(state, { row: 4, col: 1 }, { row: 4, col: 4 })).toBe(false);
    // 冲锋到阻挡前面可以
    expect(canMoveToEnhanced(state, { row: 4, col: 1 }, { row: 4, col: 2 })).toBe(true);
  });

  it('冲锋3+格时获得+1战力（boosts）', () => {
    const state = createGoblinState();
    clearArea(state, [2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 1 }, {
      cardId: 'test-rider',
      card: makeBeastRider('test-rider'),
      owner: '0',
    });

    state.phase = 'move';
    state.currentPlayer = '0';
    state.players['0'].moveCount = 0;

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.MOVE_UNIT, {
      from: { row: 4, col: 1 },
      to: { row: 4, col: 4 }, // 直线3格
    });

    // 应有 UNIT_CHARGED 事件
    const chargeEvents = events.filter(e => e.type === SW_EVENTS.UNIT_CHARGED);
    expect(chargeEvents.length).toBe(1);
    expect((chargeEvents[0].payload as any).delta).toBe(1);

    // 单位 boosts 应为1
    const movedUnit = newState.board[4][4].unit;
    expect(movedUnit?.boosts).toBe(1);
  });

  it('冲锋2格时不获得战力加成', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [0, 1, 2, 3, 4]);

    placeUnit(state, { row: 4, col: 1 }, {
      cardId: 'test-rider',
      card: makeBeastRider('test-rider'),
      owner: '0',
    });

    state.phase = 'move';
    state.currentPlayer = '0';
    state.players['0'].moveCount = 0;

    const { events } = executeAndReduce(state, SW_COMMANDS.MOVE_UNIT, {
      from: { row: 4, col: 1 },
      to: { row: 4, col: 3 }, // 直线2格
    });

    const chargeEvents = events.filter(e => e.type === SW_EVENTS.UNIT_CHARGED);
    expect(chargeEvents.length).toBe(0);
  });

  it('冲锋加成反映在 calculateEffectiveStrength 中', () => {
    const state = createGoblinState();
    const rider: BoardUnit = {
      cardId: 'test-rider', card: makeBeastRider('test-rider'), owner: '0',
      position: { row: 4, col: 4 }, damage: 0, boosts: 1, // 已冲锋
      hasMoved: true, hasAttacked: false,
    };
    state.board[4][4].unit = rider;

    const strength = getEffectiveStrengthValue(rider, state);
    expect(strength).toBe(4); // 基础3 + 冲锋1
  });
});


// ============================================================================
// 凶残 (ferocity) 测试
// ============================================================================

describe('部落投石手 - 凶残 (ferocity)', () => {
  it('hasFerocityAbility 对有 ferocity 技能的单位返回 true', () => {
    const slinger: BoardUnit = {
      cardId: 'test', card: makeSlinger('test'), owner: '0',
      position: { row: 0, col: 0 }, damage: 0, boosts: 0,
      hasMoved: false, hasAttacked: false,
    };
    expect(hasFerocityAbilityBase(slinger)).toBe(true);
  });

  it('凶残单位可以在攻击次数用完后仍然攻击', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-slinger',
      card: makeSlinger('test-slinger'),
      owner: '0',
    });

    placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'test-enemy',
      card: makeEnemy('test-enemy', { life: 10 }),
      owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';
    state.players['0'].attackCount = 3; // 已用完3次攻击
    state.players['0'].hasAttackedEnemy = true;

    // 验证凶残单位仍可攻击
    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.DECLARE_ATTACK,
      payload: { attacker: { row: 4, col: 2 }, target: { row: 4, col: 4 } },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(true);
  });

  it('非凶残单位在攻击次数用完后不能攻击', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-rider',
      card: makeBeastRider('test-rider'), // 无凶残
      owner: '0',
    });

    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-enemy',
      card: makeEnemy('test-enemy'),
      owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';
    state.players['0'].attackCount = 3;
    state.players['0'].hasAttackedEnemy = true;

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.DECLARE_ATTACK,
      payload: { attacker: { row: 4, col: 2 }, target: { row: 4, col: 3 } },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
  });

});

// ============================================================================
// 神出鬼没 (vanish) 测试
// ============================================================================

describe('思尼克斯 - 神出鬼没 (vanish)', () => {
  it('与0费友方单位交换位置', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    const summoner = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-summoner',
      card: makeGoblinSummoner('test-summoner'),
      owner: '0',
    });

    placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'test-ally',
      card: makeZeroCostAlly('test-ally'),
      owner: '0',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'vanish',
      sourceUnitId: summoner.instanceId,
      targetPosition: { row: 4, col: 4 },
    });

    // 应有 UNITS_SWAPPED 事件
    const swapEvents = events.filter(e => e.type === SW_EVENTS.UNITS_SWAPPED);
    expect(swapEvents.length).toBe(1);

    // 位置应交换
    expect(newState.board[4][2].unit?.cardId).toBe('test-ally');
    expect(newState.board[4][4].unit?.cardId).toBe('test-summoner');
  });

  it('不能与非0费单位交换（验证拒绝）', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    const summoner = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-summoner',
      card: makeGoblinSummoner('test-summoner'),
      owner: '0',
    });

    placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'test-expensive',
      card: { ...makeZeroCostAlly('test-expensive'), cost: 3 },
      owner: '0',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'vanish',
        sourceUnitId: summoner.instanceId,
        targetPosition: { row: 4, col: 4 },
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('0');
  });

  it('不能与敌方单位交换（验证拒绝）', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    const summoner = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-summoner',
      card: makeGoblinSummoner('test-summoner'),
      owner: '0',
    });

    placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'test-enemy-zero',
      card: makeEnemy('test-enemy-zero', { cost: 0 }),
      owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'vanish',
        sourceUnitId: summoner.instanceId,
        targetPosition: { row: 4, col: 4 },
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('友方');
  });

  it('同 cardId 的不同实例也可交换（按 instanceId 判定自身）', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    const summoner = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'shared-card',
      card: makeGoblinSummoner('shared-source-card'),
      owner: '0',
    });

    const ally = placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'shared-card',
      card: makeZeroCostAlly('shared-target-card'),
      owner: '0',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const validateResult = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'vanish',
        sourceUnitId: summoner.instanceId,
        targetPosition: { row: 4, col: 4 },
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(validateResult.valid).toBe(true);

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'vanish',
      sourceUnitId: summoner.instanceId,
      targetPosition: { row: 4, col: 4 },
    });

    const swapEvents = events.filter(e => e.type === SW_EVENTS.UNITS_SWAPPED);
    expect(swapEvents.length).toBe(1);
    expect(newState.board[4][2].unit?.instanceId).toBe(ally.instanceId);
    expect(newState.board[4][4].unit?.instanceId).toBe(summoner.instanceId);
  });
});

// ============================================================================
// 鲜血符文 (blood_rune) 测试
// ============================================================================

describe('布拉夫 - 鲜血符文 (blood_rune)', () => {
  it('选择自伤：对自身造成1点伤害', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [1, 2, 3]);

    const blarf = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-blarf',
      card: makeBlarf('test-blarf'),
      owner: '0',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'blood_rune',
      sourceUnitId: blarf.instanceId,
      choice: 'damage',
    });

    const damageEvents = events.filter(
      e => e.type === SW_EVENTS.UNIT_DAMAGED && (e.payload as any).reason === 'blood_rune'
    );
    expect(damageEvents.length).toBe(1);
    expect(newState.board[4][2].unit?.damage).toBe(1);
  });

  it('选择充能：花1魔力，boosts+1', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [1, 2, 3]);

    const blarf = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-blarf',
      card: makeBlarf('test-blarf'),
      owner: '0',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';
    state.players['0'].magic = 5;

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'blood_rune',
      sourceUnitId: blarf.instanceId,
      choice: 'charge',
    });

    const magicEvents = events.filter(e => e.type === SW_EVENTS.MAGIC_CHANGED);
    expect(magicEvents.length).toBe(1);
    expect((magicEvents[0].payload as any).delta).toBe(-1);

    const chargeEvents = events.filter(e => e.type === SW_EVENTS.UNIT_CHARGED);
    expect(chargeEvents.length).toBe(1);

    expect(newState.players['0'].magic).toBe(4);
    expect(newState.board[4][2].unit?.boosts).toBe(1);
  });

  it('魔力不足时不能选择充能（验证拒绝）', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [1, 2, 3]);

    const blarf = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-blarf',
      card: makeBlarf('test-blarf'),
      owner: '0',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';
    state.players['0'].magic = 0;

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'blood_rune',
        sourceUnitId: blarf.instanceId,
        choice: 'charge',
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('魔力');
  });
});


// ============================================================================
// 力量强化 (power_boost) 测试
// ============================================================================

describe('布拉夫 - 力量强化 (power_boost)', () => {
  it('每点充能+1战力', () => {
    const state = createGoblinState();
    const blarf: BoardUnit = {
      cardId: 'test-blarf', card: makeBlarf('test-blarf'), owner: '0',
      position: { row: 4, col: 2 }, damage: 0, boosts: 3,
      hasMoved: false, hasAttacked: false,
    };
    state.board[4][2].unit = blarf;

    const strength = getEffectiveStrengthValue(blarf, state);
    expect(strength).toBe(3); // 基础0 + 充能3
  });

  it('充能加成最多+5', () => {
    const state = createGoblinState();
    const blarf: BoardUnit = {
      cardId: 'test-blarf', card: makeBlarf('test-blarf'), owner: '0',
      position: { row: 4, col: 2 }, damage: 0, boosts: 8,
      hasMoved: false, hasAttacked: false,
    };
    state.board[4][2].unit = blarf;

    const strength = getEffectiveStrengthValue(blarf, state);
    expect(strength).toBe(5); // 基础0 + 最多5
  });

  it('无充能时战力为基础值', () => {
    const state = createGoblinState();
    const blarf: BoardUnit = {
      cardId: 'test-blarf', card: makeBlarf('test-blarf'), owner: '0',
      position: { row: 4, col: 2 }, damage: 0, boosts: 0,
      hasMoved: false, hasAttacked: false,
    };
    state.board[4][2].unit = blarf;

    const strength = getEffectiveStrengthValue(blarf, state);
    expect(strength).toBe(0); // 基础0 + 充能0
  });
});

// ============================================================================
// 魔力成瘾 (magic_addiction) 测试
// ============================================================================

describe('史米革 - 魔力成瘾 (magic_addiction)', () => {
  it('有魔力时扣除1点魔力', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [1, 2, 3]);

    const smirg = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-smirg',
      card: makeSmirg('test-smirg'),
      owner: '0',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';
    state.players['0'].magic = 3;

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'magic_addiction',
      sourceUnitId: smirg.instanceId,
    });

    const magicEvents = events.filter(e => e.type === SW_EVENTS.MAGIC_CHANGED);
    expect(magicEvents.length).toBe(1);
    expect((magicEvents[0].payload as any).delta).toBe(-1);
    expect(newState.players['0'].magic).toBe(2);

    // 不应自毁
    const destroyEvents = events.filter(e => e.type === SW_EVENTS.UNIT_DESTROYED);
    expect(destroyEvents.length).toBe(0);
  });

  it('无魔力时自毁', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [1, 2, 3]);

    const smirg = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-smirg',
      card: makeSmirg('test-smirg'),
      owner: '0',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';
    state.players['0'].magic = 0;

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'magic_addiction',
      sourceUnitId: smirg.instanceId,
    });

    const destroyEvents = events.filter(
      e => e.type === SW_EVENTS.UNIT_DESTROYED && (e.payload as any).reason === 'magic_addiction'
    );
    expect(destroyEvents.length).toBe(1);
    expect(newState.board[4][2].unit).toBeUndefined();
  });
});

// ============================================================================
// 喂养巨食兽 (feed_beast) 测试
// ============================================================================

describe('巨食兽 - 喂养巨食兽 (feed_beast)', () => {
  it('选择移除相邻友方单位', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    const glutton = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-glutton',
      card: makeGlutton('test-glutton'),
      owner: '0',
    });

    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-food',
      card: makeZeroCostAlly('test-food'),
      owner: '0',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'feed_beast',
      sourceUnitId: glutton.instanceId,
      choice: 'destroy_adjacent',
      targetPosition: { row: 4, col: 3 },
    });

    const destroyEvents = events.filter(
      e => e.type === SW_EVENTS.UNIT_DESTROYED && (e.payload as any).reason === 'feed_beast'
    );
    expect(destroyEvents.length).toBe(1);
    expect((destroyEvents[0].payload as any).cardId).toBe('test-food');
    expect(newState.board[4][3].unit).toBeUndefined();
    // 巨食兽仍在
    expect(newState.board[4][2].unit?.cardId).toBe('test-glutton');
  });

  it('选择自毁', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [1, 2, 3]);

    const glutton = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-glutton',
      card: makeGlutton('test-glutton'),
      owner: '0',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'feed_beast',
      sourceUnitId: glutton.instanceId,
      choice: 'self_destroy',
    });

    const destroyEvents = events.filter(
      e => e.type === SW_EVENTS.UNIT_DESTROYED && (e.payload as any).reason === 'feed_beast_self'
    );
    expect(destroyEvents.length).toBe(1);
    expect(newState.board[4][2].unit).toBeUndefined();
  });

  it('不能选择非相邻友方单位（验证拒绝）', () => {
    const state = createGoblinState();
    clearArea(state, [2, 3, 4, 5], [1, 2, 3, 4]);

    const glutton = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-glutton',
      card: makeGlutton('test-glutton'),
      owner: '0',
    });

    placeUnit(state, { row: 2, col: 2 }, {
      cardId: 'test-far-ally',
      card: makeZeroCostAlly('test-far-ally'),
      owner: '0',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'feed_beast',
        sourceUnitId: glutton.instanceId,
        choice: 'destroy_adjacent',
        targetPosition: { row: 2, col: 2 },
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('相邻');
  });

  it('不能选择敌方单位（验证拒绝）', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    const glutton = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-glutton',
      card: makeGlutton('test-glutton'),
      owner: '0',
    });

    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-enemy-adj',
      card: makeEnemy('test-enemy-adj'),
      owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'feed_beast',
        sourceUnitId: glutton.instanceId,
        choice: 'destroy_adjacent',
        targetPosition: { row: 4, col: 3 },
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('友方');
  });

  it('缺少 choice 时验证拒绝（契约 required）', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    const glutton = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-glutton',
      card: makeGlutton('test-glutton'),
      owner: '0',
    });

    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-food',
      card: makeZeroCostAlly('test-food'),
      owner: '0',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'feed_beast',
        sourceUnitId: glutton.instanceId,
        targetPosition: { row: 4, col: 3 },
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('必须选择');
  });

  it('同 cardId 的相邻友方可被吞噬（按 instanceId 判定自身）', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    const glutton = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'shared-glutton-card',
      card: makeGlutton('glutton-source-card'),
      owner: '0',
    });

    const food = placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'shared-glutton-card',
      card: makeZeroCostAlly('glutton-target-card'),
      owner: '0',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const validateResult = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'feed_beast',
        sourceUnitId: glutton.instanceId,
        choice: 'destroy_adjacent',
        targetPosition: { row: 4, col: 3 },
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(validateResult.valid).toBe(true);

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'feed_beast',
      sourceUnitId: glutton.instanceId,
      choice: 'destroy_adjacent',
      targetPosition: { row: 4, col: 3 },
    });

    const destroyEvents = events.filter(
      e => e.type === SW_EVENTS.UNIT_DESTROYED && (e.payload as any).reason === 'feed_beast'
    );
    expect(destroyEvents.length).toBe(1);
    expect((destroyEvents[0].payload as any).instanceId).toBe(food.instanceId);
    expect(newState.board[4][3].unit).toBeUndefined();
  });

  it('不能在非攻击阶段使用（验证拒绝）', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [1, 2, 3]);

    const glutton = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-glutton',
      card: makeGlutton('test-glutton'),
      owner: '0',
    });

    state.phase = 'move';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'feed_beast',
        sourceUnitId: glutton.instanceId,
        choice: 'self_destroy',
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
  });

  it('本回合已击杀时不能发动（验证拒绝）', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [1, 2, 3]);

    const glutton = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-glutton',
      card: makeGlutton('test-glutton'),
      owner: '0',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';
    state.unitKillCountThisTurn = {
      [glutton.instanceId]: 1,
    };

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'feed_beast',
        sourceUnitId: glutton.instanceId,
        choice: 'self_destroy',
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('已消灭单位');
  });
});


// ============================================================================
// 事件卡 - 群情激愤 (goblin-frenzy) 测试
// ============================================================================

describe('洞穴地精事件卡 - 群情激愤', () => {
  it('所有0费友方单位获得额外攻击', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    // 0费友方单位
    const zero1 = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-zero-1',
      card: makeZeroCostAlly('test-zero-1'),
      owner: '0',
    });

    const zero2 = placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'test-zero-2',
      card: makeClimber('test-zero-2'),
      owner: '0',
    });

    // 非0费友方单位（不应获得额外攻击）
    const costly = placeUnit(state, { row: 5, col: 2 }, {
      cardId: 'test-costly',
      card: makeBeastRider('test-costly'), // cost=2
      owner: '0',
    });

    state.phase = 'magic';
    state.currentPlayer = '0';
    state.players['0'].magic = 5;

    addEventToHand(state, '0', 'goblin-frenzy', {
      name: '群情激愤',
      eventType: 'legendary',
      playPhase: 'magic',
      cost: 1,
    });

    const { events } = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
      cardId: 'goblin-frenzy',
    });

    const extraAttackEvents = events.filter(e => e.type === SW_EVENTS.EXTRA_ATTACK_GRANTED);
    // 应有2个0费单位获得额外攻击
    expect(extraAttackEvents.length).toBe(2);
    const grantedIds = extraAttackEvents.map(e => (e.payload as any).targetUnitId);
    expect(grantedIds).toContain(zero1.instanceId);
    expect(grantedIds).toContain(zero2.instanceId);
    // 非0费单位不应获得
    expect(grantedIds).not.toContain(costly.instanceId);
  });

  it('召唤师（0费但非士兵）不获得额外攻击', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5, 6], [0, 1, 2, 3, 4, 5]);

    // 召唤师 cost=0 但 unitClass=summoner
    const summoner = placeUnit(state, { row: 5, col: 2 }, {
      cardId: 'test-summoner',
      card: makeGoblinSummoner('test-summoner'),
      owner: '0',
    });

    // 0费士兵
    const zero = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-zero',
      card: makeZeroCostAlly('test-zero'),
      owner: '0',
    });

    state.phase = 'magic';
    state.currentPlayer = '0';
    state.players['0'].magic = 5;

    addEventToHand(state, '0', 'goblin-frenzy', {
      name: '群情激愤',
      eventType: 'legendary',
      playPhase: 'magic',
      cost: 1,
    });

    const { events } = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
      cardId: 'goblin-frenzy',
    });

    const extraAttackEvents = events.filter(e => e.type === SW_EVENTS.EXTRA_ATTACK_GRANTED);
    const grantedIds = extraAttackEvents.map(e => (e.payload as any).targetUnitId);
    expect(grantedIds).not.toContain(summoner.instanceId);
    expect(grantedIds).toContain(zero.instanceId);
  });
});

// ============================================================================
// 事件卡 - 潜行 (goblin-sneak) 测试
// ============================================================================

describe('洞穴地精事件卡 - 潜行', () => {
  it('推拉0费友方单位1格', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-zero-sneak',
      card: makeZeroCostAlly('test-zero-sneak'),
      owner: '0',
    });

    state.phase = 'move';
    state.currentPlayer = '0';

    addEventToHand(state, '0', 'goblin-sneak', {
      name: '潜行',
      eventType: 'common',
      playPhase: 'move',
      cost: 0,
    });

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
      cardId: 'goblin-sneak',
      sneakDirections: [
        { position: { row: 4, col: 2 }, newPosition: { row: 4, col: 3 } },
      ],
    });

    const pushEvents = events.filter(e => e.type === SW_EVENTS.UNIT_PUSHED);
    expect(pushEvents.length).toBe(1);
    expect(newState.board[4][3].unit?.cardId).toBe('test-zero-sneak');
  });

  it('可以同时推拉多个0费单位', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [0, 1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 1 }, {
      cardId: 'test-sneak-a',
      card: makeZeroCostAlly('test-sneak-a'),
      owner: '0',
    });

    placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'test-sneak-b',
      card: makeClimber('test-sneak-b'), // cost=0
      owner: '0',
    });

    state.phase = 'move';
    state.currentPlayer = '0';

    addEventToHand(state, '0', 'goblin-sneak', {
      name: '潜行',
      eventType: 'common',
      playPhase: 'move',
      cost: 0,
    });

    const { events } = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
      cardId: 'goblin-sneak',
      sneakDirections: [
        { position: { row: 4, col: 1 }, newPosition: { row: 4, col: 2 } },
        { position: { row: 4, col: 4 }, newPosition: { row: 4, col: 5 } },
      ],
    });

    const pushEvents = events.filter(e => e.type === SW_EVENTS.UNIT_PUSHED);
    expect(pushEvents.length).toBe(2);
  });
});

// ============================================================================
// 事件卡 - 成群结队 (goblin-swarm) 围攻战力加成测试
// ============================================================================

describe('洞穴地精事件卡 - 成群结队（围攻加成）', () => {
  it('友方单位攻击时每有一个友方相邻目标+1战力', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    // 攻击者
    const attacker: BoardUnit = {
      instanceId: generateInstanceId('test-attacker'),
      cardId: 'test-attacker', card: makeZeroCostAlly('test-attacker'), owner: '0',
      position: { row: 4, col: 2 }, damage: 0, boosts: 0,
      hasMoved: false, hasAttacked: false,
    };
    state.board[4][2].unit = attacker;

    // 目标
    const target: BoardUnit = {
      instanceId: generateInstanceId('test-target'),
      cardId: 'test-target', card: makeEnemy('test-target'), owner: '1',
      position: { row: 4, col: 3 }, damage: 0, boosts: 0,
      hasMoved: false, hasAttacked: false,
    };
    state.board[4][3].unit = target;

    // 友方单位与目标相邻（(3,3) 和 (5,3)）
    const ally1: BoardUnit = {
      instanceId: generateInstanceId('test-ally-1'),
      cardId: 'test-ally-1', card: makeZeroCostAlly('test-ally-1'), owner: '0',
      position: { row: 3, col: 3 }, damage: 0, boosts: 0,
      hasMoved: false, hasAttacked: false,
    };
    state.board[3][3].unit = ally1;

    const ally2: BoardUnit = {
      instanceId: generateInstanceId('test-ally-2'),
      cardId: 'test-ally-2', card: makeZeroCostAlly('test-ally-2'), owner: '0',
      position: { row: 5, col: 3 }, damage: 0, boosts: 0,
      hasMoved: false, hasAttacked: false,
    };
    state.board[5][3].unit = ally2;

    // 激活成群结队
    state.players['0'].activeEvents.push({
      id: 'goblin-swarm-0',
      cardType: 'event',
      name: '成群结队',
      faction: 'goblin',
      cost: 0,
      playPhase: 'attack',
      effect: '',
      isActive: true,
      deckSymbols: [],
    } as EventCard);

    const strength = getEffectiveStrengthValue(attacker, state, target);
    // 基础1 + 2个友方相邻目标 = 3
    expect(strength).toBe(3);
  });

  it('无成群结队时不获得围攻加成', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    const attacker: BoardUnit = {
      instanceId: generateInstanceId('test-attacker'),
      cardId: 'test-attacker', card: makeZeroCostAlly('test-attacker'), owner: '0',
      position: { row: 4, col: 2 }, damage: 0, boosts: 0,
      hasMoved: false, hasAttacked: false,
    };
    state.board[4][2].unit = attacker;

    const target: BoardUnit = {
      instanceId: generateInstanceId('test-target'),
      cardId: 'test-target', card: makeEnemy('test-target'), owner: '1',
      position: { row: 4, col: 3 }, damage: 0, boosts: 0,
      hasMoved: false, hasAttacked: false,
    };
    state.board[4][3].unit = target;

    // 友方相邻目标
    state.board[3][3] = { ...state.board[3][3], unit: {
      instanceId: generateInstanceId('test-ally'),
      cardId: 'test-ally', card: makeZeroCostAlly('test-ally'), owner: '0',
      position: { row: 3, col: 3 }, damage: 0, boosts: 0,
      hasMoved: false, hasAttacked: false,
    }};

    // 无成群结队事件
    const strength = getEffectiveStrengthValue(attacker, state, target);
    expect(strength).toBe(1); // 仅基础战力
  });
});


// ============================================================================
// 抓附 (grab) 测试
// ============================================================================

describe('部落抓附手 - 抓附 (grab)', () => {
  it('友方单位从抓附手相邻位置移动后触发 GRAB_FOLLOW_REQUESTED', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    // 抓附手在 (4,2)
    const grabber = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-grabber',
      card: makeGrabber('test-grabber'),
      owner: '0',
    });

    // 友方单位在 (4,3)，与抓附手相邻
    const mover = placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-mover',
      card: makeZeroCostAlly('test-mover'),
      owner: '0',
    });

    state.phase = 'move';
    state.currentPlayer = '0';
    state.players['0'].moveCount = 0;

    const { events } = executeAndReduce(state, SW_COMMANDS.MOVE_UNIT, {
      from: { row: 4, col: 3 },
      to: { row: 4, col: 4 },
    });

    const grabEvents = events.filter(e => e.type === SW_EVENTS.GRAB_FOLLOW_REQUESTED);
    expect(grabEvents.length).toBe(1);
    expect((grabEvents[0].payload as any).grabberUnitId).toBe(grabber.instanceId);
    expect((grabEvents[0].payload as any).movedUnitId).toBe(mover.instanceId);
  });

  it('非相邻友方单位移动不触发抓附', () => {
    const state = createGoblinState();
    clearArea(state, [2, 3, 4, 5], [1, 2, 3, 4]);

    // 抓附手在 (4,2)
    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-grabber',
      card: makeGrabber('test-grabber'),
      owner: '0',
    });

    // 友方单位在 (2,2)，距离抓附手2格（非相邻）
    placeUnit(state, { row: 2, col: 2 }, {
      cardId: 'test-far-mover',
      card: makeZeroCostAlly('test-far-mover'),
      owner: '0',
    });

    state.phase = 'move';
    state.currentPlayer = '0';
    state.players['0'].moveCount = 0;

    const { events } = executeAndReduce(state, SW_COMMANDS.MOVE_UNIT, {
      from: { row: 2, col: 2 },
      to: { row: 2, col: 3 },
    });

    const grabEvents = events.filter(e => e.type === SW_EVENTS.GRAB_FOLLOW_REQUESTED);
    expect(grabEvents.length).toBe(0);
  });

  it('抓附跟随：将抓附手移动到目标位置', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    // 抓附手在 (4,2)
    const grabber = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-grabber',
      card: makeGrabber('test-grabber'),
      owner: '0',
    });

    state.phase = 'move';
    state.currentPlayer = '0';

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'grab',
      sourceUnitId: grabber.instanceId,
      targetPosition: { row: 4, col: 3 },
    });

    const moveEvents = events.filter(
      e => e.type === SW_EVENTS.UNIT_MOVED && (e.payload as any).reason === 'grab'
    );
    expect(moveEvents.length).toBe(1);
    expect(newState.board[4][2].unit).toBeUndefined();
    expect(newState.board[4][3].unit?.cardId).toBe('test-grabber');
  });

  it('抓附跟随到被占据位置被拒绝', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [1, 2, 3]);

    const grabber = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-grabber',
      card: makeGrabber('test-grabber'),
      owner: '0',
    });

    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-blocker',
      card: makeEnemy('test-blocker'),
      owner: '1',
    });

    state.phase = 'move';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'grab',
        sourceUnitId: grabber.instanceId,
        targetPosition: { row: 4, col: 3 },
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('空');
  });
});

// ============================================================================
// 不屈不挠 (goblin-relentless) 测试
// ============================================================================

describe('洞穴地精事件卡 - 不屈不挠', () => {
  it('友方士兵被消灭时返回手牌而非弃牌堆', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    // 友方士兵
    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-common',
      card: makeZeroCostAlly('test-common'),
      owner: '0',
    });

    // 激活不屈不挠
    state.players['0'].activeEvents.push({
      id: 'goblin-relentless-0',
      cardType: 'event',
      name: '不屈不挠',
      faction: 'goblin',
      cost: 1,
      playPhase: 'magic',
      effect: '',
      isActive: true,
      deckSymbols: [],
    } as EventCard);

    const handSizeBefore = state.players['0'].hand.length;
    const discardSizeBefore = state.players['0'].discard.length;

    // 手动应用 UNIT_DESTROYED 事件
    const newState = SummonerWarsDomain.reduce(state, {
      type: SW_EVENTS.UNIT_DESTROYED,
      payload: {
        position: { row: 4, col: 2 },
        cardId: 'test-common',
        cardName: '0费友方',
        owner: '0' as PlayerId,
      },
      timestamp: fixedTimestamp,
    });

    // 单位应从棋盘移除
    expect(newState.board[4][2].unit).toBeUndefined();
    // 应返回手牌
    expect(newState.players['0'].hand.length).toBe(handSizeBefore + 1);
    // 不应进入弃牌堆
    expect(newState.players['0'].discard.length).toBe(discardSizeBefore);
  });

  it('冠军被消灭时不触发不屈不挠（仅士兵）', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [1, 2, 3]);

    // 友方冠军
    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-champion',
      card: makeBlarf('test-champion'),
      owner: '0',
    });

    state.players['0'].activeEvents.push({
      id: 'goblin-relentless-0',
      cardType: 'event',
      name: '不屈不挠',
      faction: 'goblin',
      cost: 1,
      playPhase: 'magic',
      effect: '',
      isActive: true,
      deckSymbols: [],
    } as EventCard);

    const handSizeBefore = state.players['0'].hand.length;

    const newState = SummonerWarsDomain.reduce(state, {
      type: SW_EVENTS.UNIT_DESTROYED,
      payload: {
        position: { row: 4, col: 2 },
        cardId: 'test-champion',
        cardName: '布拉夫',
        owner: '0' as PlayerId,
      },
      timestamp: fixedTimestamp,
    });

    // 冠军不应返回手牌
    expect(newState.players['0'].hand.length).toBe(handSizeBefore);
    // 应进入弃牌堆
    expect(newState.players['0'].discard.some(c => c.name === '布拉夫')).toBe(true);
  });

  it('自毁原因（feed_beast/magic_addiction）不触发不屈不挠', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [1, 2, 3]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-common-self',
      card: makeZeroCostAlly('test-common-self'),
      owner: '0',
    });

    state.players['0'].activeEvents.push({
      id: 'goblin-relentless-0',
      cardType: 'event',
      name: '不屈不挠',
      faction: 'goblin',
      cost: 1,
      playPhase: 'magic',
      effect: '',
      isActive: true,
      deckSymbols: [],
    } as EventCard);

    const handSizeBefore = state.players['0'].hand.length;

    const newState = SummonerWarsDomain.reduce(state, {
      type: SW_EVENTS.UNIT_DESTROYED,
      payload: {
        position: { row: 4, col: 2 },
        cardId: 'test-common-self',
        cardName: '0费友方',
        owner: '0' as PlayerId,
        reason: 'feed_beast',
      },
      timestamp: fixedTimestamp,
    });

    // 自毁不应返回手牌
    expect(newState.players['0'].hand.length).toBe(handSizeBefore);
    // 应进入弃牌堆
    expect(newState.players['0'].discard.length).toBeGreaterThan(0);
  });

  it('无不屈不挠时士兵被消灭进入弃牌堆', () => {
    const state = createGoblinState();
    clearArea(state, [3, 4, 5], [1, 2, 3]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-common-normal',
      card: makeZeroCostAlly('test-common-normal'),
      owner: '0',
    });

    // 无不屈不挠事件
    const handSizeBefore = state.players['0'].hand.length;

    const newState = SummonerWarsDomain.reduce(state, {
      type: SW_EVENTS.UNIT_DESTROYED,
      payload: {
        position: { row: 4, col: 2 },
        cardId: 'test-common-normal',
        cardName: '0费友方',
        owner: '0' as PlayerId,
      },
      timestamp: fixedTimestamp,
    });

    // 不应返回手牌
    expect(newState.players['0'].hand.length).toBe(handSizeBefore);
    // 应进入弃牌堆
    expect(newState.players['0'].discard.length).toBeGreaterThan(0);
  });
});
