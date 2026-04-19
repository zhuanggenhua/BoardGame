/**
 * 召唤师战争 - 高级技能测试
 * 
 * 测试 soulless、soul_transfer、殉葬火堆、复活死灵、火祀召唤、吸取生命、感染
 */

import { describe, it, expect, vi } from 'vitest';
import { SummonerWarsDomain, SW_COMMANDS, SW_EVENTS } from '../domain';
import type { SummonerWarsCore, CellCoord, BoardUnit, UnitCard, EventCard, PlayerId } from '../domain/types';
import type { RandomFn, GameEvent } from '../../../engine/types';
import { BOARD_ROWS, BOARD_COLS } from '../domain/helpers';
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

function createTestState(): SummonerWarsCore {
  return createInitializedCore(['0', '1'], createTestRandom());
}

function getUnitAt(state: SummonerWarsCore, pos: CellCoord): BoardUnit | undefined {
  return state.board[pos.row]?.[pos.col]?.unit;
}

function findUnitPosition(state: SummonerWarsCore, predicate: (unit: BoardUnit) => boolean): CellCoord | null {
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const unit = state.board[row]?.[col]?.unit;
      if (unit && predicate(unit)) return { row, col };
    }
  }
  return null;
}

/** 在指定位置放置测试单位 */
function placeUnit(state: SummonerWarsCore, pos: CellCoord, overrides: Partial<BoardUnit> & { card: UnitCard; owner: PlayerId }): BoardUnit {
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

/** 创建疫病体卡牌 */
function makePlagueZombie(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '亡灵疫病体', unitClass: 'common',
    faction: 'necromancer', strength: 2, life: 3, cost: 1,
    attackType: 'melee', attackRange: 1,
    abilities: ['soulless', 'infection'], deckSymbols: [],
  };
}

/** 创建亡灵弓箭手卡牌 */
function makeUndeadArcher(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '亡灵弓箭手', unitClass: 'common',
    faction: 'necromancer', strength: 3, life: 2, cost: 2,
    attackType: 'ranged', attackRange: 3,
    abilities: ['soul_transfer'], deckSymbols: [],
  };
}

/** 创建普通敌方单位 */
function makeEnemy(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '敌方单位', unitClass: 'common',
    faction: 'goblin', strength: 1, life: 1, cost: 0,
    attackType: 'melee', attackRange: 1, deckSymbols: [],
  };
}

/** 执行命令并应用事件到状态 */
function executeAndReduce(state: SummonerWarsCore, commandType: string, payload: Record<string, unknown>, random?: RandomFn): {
  newState: SummonerWarsCore;
  events: GameEvent[];
} {
  const fullState = { core: state, sys: {} as any };
  const command = { type: commandType, payload, timestamp: fixedTimestamp, playerId: state.currentPlayer };
  const events = SummonerWarsDomain.execute(fullState, command, random ?? createTestRandom());
  let newState = state;
  for (const event of events) {
    newState = SummonerWarsDomain.reduce(newState, event);
  }
  return { newState, events };
}

// ============================================================================
// soulless（无魂）测试
// ============================================================================

describe('亡灵疫病体 - 无魂 (soulless)', () => {
  it('疫病体攻击消灭敌方时，不获得魔力', () => {
    // 骰子必定掷出近战命中（index 0 = melee）
    const meleeRandom: RandomFn = { ...createTestRandom(), random: () => 0 };
    const state = createTestState();
      // 清空棋盘中间区域
      state.board[4][2].unit = undefined;
      state.board[4][3].unit = undefined;

      // 放置疫病体（玩家0）
      const zombie = placeUnit(state, { row: 4, col: 2 }, {
        cardId: 'test-zombie',
        card: makePlagueZombie('test-zombie'),
        owner: '0',
      });

      // 放置1生命敌方单位（玩家1）在相邻位置
      placeUnit(state, { row: 4, col: 3 }, {
        cardId: 'test-enemy',
        card: makeEnemy('test-enemy'),
        owner: '1',
      });

      // 设置攻击阶段
      state.phase = 'attack';
      state.currentPlayer = '0';
      state.players['0'].attackCount = 0;
      state.players['0'].hasAttackedEnemy = false;

      const magicBefore = state.players['0'].magic;

      // 执行攻击
      const { newState, events } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
        attacker: { row: 4, col: 2 },
        target: { row: 4, col: 3 },
      }, meleeRandom);

      // 检查是否有 UNIT_DAMAGED 事件带 skipMagicReward
      const damageEvents = events.filter(e => e.type === SW_EVENTS.UNIT_DAMAGED);
      const hasSkipFlag = damageEvents.some(e => (e.payload as any).skipMagicReward === true);
      expect(hasSkipFlag).toBe(true);

      // 魔力不应增加（soulless 效果）
      expect(newState.players['0'].magic).toBe(magicBefore);
  });

  it('普通单位攻击消灭敌方时，正常获得魔力', () => {
    // 骰子必定掷出近战命中
    const meleeRandom: RandomFn = { ...createTestRandom(), random: () => 0 };
    const state = createTestState();
      state.board[4][2].unit = undefined;
      state.board[4][3].unit = undefined;

      // 放置普通单位（无 soulless）
      placeUnit(state, { row: 4, col: 2 }, {
        cardId: 'test-normal',
        card: { ...makeEnemy('test-normal'), strength: 3, life: 5, abilities: [] },
        owner: '0',
      });

      placeUnit(state, { row: 4, col: 3 }, {
        cardId: 'test-enemy',
        card: makeEnemy('test-enemy'),
        owner: '1',
      });

      state.phase = 'attack';
      state.currentPlayer = '0';
      state.players['0'].attackCount = 0;
      state.players['0'].hasAttackedEnemy = false;

      const magicBefore = state.players['0'].magic;

      const { newState, events } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
        attacker: { row: 4, col: 2 },
        target: { row: 4, col: 3 },
      }, meleeRandom);

      // 普通单位不带 skipMagicReward
      const damageEvents = events.filter(e => e.type === SW_EVENTS.UNIT_DAMAGED);
      const hasSkipFlag = damageEvents.some(e => (e.payload as any).skipMagicReward === true);
      expect(hasSkipFlag).toBe(false);
  });
});

// ============================================================================
// soul_transfer（灵魂转移）测试
// ============================================================================

describe('亡灵弓箭手 - 灵魂转移 (soul_transfer)', () => {
  it('弓箭手击杀3格内单位时触发灵魂转移请求', () => {
    // random 0.6 → ranged 命中（index 3 or 4）
    const rangedRandom: RandomFn = { ...createTestRandom(), random: () => 0.6 };
    const state = createTestState();
      for (let r = 3; r <= 5; r++) {
        for (let c = 1; c <= 4; c++) {
          state.board[r][c].unit = undefined;
          state.board[r][c].structure = undefined;
        }
      }

      // 弓箭手在 (4,2)
      const archer = placeUnit(state, { row: 4, col: 2 }, {
        cardId: 'test-archer',
        card: makeUndeadArcher('test-archer'),
        owner: '0',
      });

      // 敌方在 (4,4) — 距离弓箭手 |4-4|+|2-4| = 2 ≤ 3
      placeUnit(state, { row: 4, col: 4 }, {
        cardId: 'test-near-enemy',
        card: makeEnemy('test-near-enemy'),
        owner: '1',
      });

      state.phase = 'attack';
      state.currentPlayer = '0';
      state.players['0'].attackCount = 0;
      state.players['0'].hasAttackedEnemy = false;

      const { events } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
        attacker: { row: 4, col: 2 },
        target: { row: 4, col: 4 },
      }, rangedRandom);

      const soulTransferEvents = events.filter(e => e.type === SW_EVENTS.SOUL_TRANSFER_REQUESTED);
      expect(soulTransferEvents.length).toBe(1);
      expect((soulTransferEvents[0].payload as any).sourceUnitId).toBe(archer.instanceId);
  });

  it('弓箭手未击杀时不触发灵魂转移请求', () => {
    const meleeRandom: RandomFn = { ...createTestRandom(), random: () => 0 };
    const state = createTestState();
      for (let r = 3; r <= 5; r++) {
        for (let c = 1; c <= 4; c++) {
          state.board[r][c].unit = undefined;
          state.board[r][c].structure = undefined;
        }
      }

      placeUnit(state, { row: 4, col: 2 }, {
        cardId: 'test-archer',
        card: makeUndeadArcher('test-archer'),
        owner: '0',
      });

      // 敌方生命提高，避免被击杀
      placeUnit(state, { row: 4, col: 4 }, {
        cardId: 'test-tough-enemy',
        card: { ...makeEnemy('test-tough-enemy'), life: 6 },
        owner: '1',
      });

      state.phase = 'attack';
      state.currentPlayer = '0';
      state.players['0'].attackCount = 0;
      state.players['0'].hasAttackedEnemy = false;

      const { events } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
        attacker: { row: 4, col: 2 },
        target: { row: 4, col: 4 },
      }, meleeRandom);

      const soulTransferEvents = events.filter(e => e.type === SW_EVENTS.SOUL_TRANSFER_REQUESTED);
      expect(soulTransferEvents.length).toBe(0);
  });

  it('非击杀者不应触发灵魂转移请求（即使弓箭手在范围内）', () => {
    const meleeRandom: RandomFn = { ...createTestRandom(), random: () => 0 };
    const state = createTestState();
      for (let r = 3; r <= 5; r++) {
        for (let c = 1; c <= 4; c++) {
          state.board[r][c].unit = undefined;
          state.board[r][c].structure = undefined;
        }
      }

      placeUnit(state, { row: 4, col: 2 }, {
        cardId: 'test-archer',
        card: makeUndeadArcher('test-archer'),
        owner: '0',
      });

      placeUnit(state, { row: 4, col: 3 }, {
        cardId: 'test-attacker',
        card: { ...makeEnemy('test-attacker'), strength: 5, life: 5 },
        owner: '0',
      });

      placeUnit(state, { row: 4, col: 4 }, {
        cardId: 'test-near-enemy',
        card: makeEnemy('test-near-enemy'),
        owner: '1',
      });

      state.phase = 'attack';
      state.currentPlayer = '0';
      state.players['0'].attackCount = 0;
      state.players['0'].hasAttackedEnemy = false;

      const { events } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
        attacker: { row: 4, col: 3 },
        target: { row: 4, col: 4 },
      }, meleeRandom);

      const soulTransferEvents = events.filter(e => e.type === SW_EVENTS.SOUL_TRANSFER_REQUESTED);
      expect(soulTransferEvents.length).toBe(0);
  });

  it('ACTIVATE_ABILITY soul_transfer 应移动弓箭手到目标位置', () => {
    const state = createTestState();
    for (let r = 3; r <= 5; r++) {
      for (let c = 1; c <= 4; c++) {
        state.board[r][c].unit = undefined;
        state.board[r][c].structure = undefined;
      }
    }

    const archer = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-archer',
      card: makeUndeadArcher('test-archer'),
      owner: '0',
    });

    state.currentPlayer = '0';

    const { newState, events } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'soul_transfer',
      sourceUnitId: archer.instanceId,
      targetPosition: { row: 4, col: 4 },
    });

    // 弓箭手应该移动到 (4,4)
    expect(newState.board[4][2].unit).toBeUndefined();
    expect(newState.board[4][4].unit?.cardId).toBe('test-archer');
  });
});

// ============================================================================
// 殉葬火堆测试
// ============================================================================

describe('殉葬火堆 (funeral_pyre)', () => {
  it('单位被消灭时，主动区的殉葬火堆应获得充能', () => {
    const state = createTestState();
    // 给玩家0添加殉葬火堆到主动事件区
    state.players['0'].activeEvents.push({
      id: 'necro-funeral-pyre-test',
      cardType: 'event',
      name: '殉葬火堆',
      eventType: 'legendary',
      faction: 'necromancer',
      cost: 1,
      playPhase: 'summon',
      effect: '持续效果',
      isActive: true,
      charges: 0,
      deckSymbols: [],
    });

    // 清空测试区域
    state.board[4][2].unit = undefined;
    state.board[4][3].unit = undefined;

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-attacker',
      card: { ...makeEnemy('test-attacker'), strength: 5, life: 5 },
      owner: '0',
    });

    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-enemy',
      card: makeEnemy('test-enemy'),
      owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';
    state.players['0'].attackCount = 0;
    state.players['0'].hasAttackedEnemy = false;

    const { newState, events } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: { row: 4, col: 2 },
      target: { row: 4, col: 3 },
    }, { ...createTestRandom(), random: () => 0 });

    // 检查殉葬火堆充能事件
    const chargeEvents = events.filter(e => e.type === SW_EVENTS.FUNERAL_PYRE_CHARGED);
    expect(chargeEvents.length).toBeGreaterThan(0);

    // 检查状态中殉葬火堆的充能
    const pyre = newState.players['0'].activeEvents.find(e => e.id === 'necro-funeral-pyre-test');
    expect(pyre).toBeDefined();
    expect(pyre!.charges).toBeGreaterThan(0);
  });

  it('FUNERAL_PYRE_HEAL 应治疗目标单位并弃置殉葬火堆', () => {
    const state = createTestState();
    // 添加有3点充能的殉葬火堆
    state.players['0'].activeEvents.push({
      id: 'necro-funeral-pyre-test',
      cardType: 'event',
      name: '殉葬火堆',
      eventType: 'legendary',
      faction: 'necromancer',
      cost: 1,
      playPhase: 'summon',
      effect: '持续效果',
      isActive: true,
      charges: 3,
      deckSymbols: [],
    });

    // 放置受伤单位
    state.board[4][3].unit = undefined;
    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-wounded',
      card: { ...makeEnemy('test-wounded'), life: 8 },
      owner: '0',
      damage: 5,
    });

    state.currentPlayer = '0';

    const { newState } = executeAndReduce(state, SW_COMMANDS.FUNERAL_PYRE_HEAL, {
      cardId: 'necro-funeral-pyre-test',
      targetPosition: { row: 4, col: 3 },
    });

    // 单位应被治疗3点（5-3=2伤害）
    const unit = newState.board[4][3].unit;
    expect(unit).toBeDefined();
    expect(unit!.damage).toBe(2);

    // 殉葬火堆应从主动事件区移除
    expect(newState.players['0'].activeEvents.find(e => e.id === 'necro-funeral-pyre-test')).toBeUndefined();
    // 应在弃牌堆
    expect(newState.players['0'].discard.some(c => c.id === 'necro-funeral-pyre-test')).toBe(true);
  });

  it('FUNERAL_PYRE_HEAL skip 应直接弃置不治疗', () => {
    const state = createTestState();
    state.players['0'].activeEvents.push({
      id: 'necro-funeral-pyre-test',
      cardType: 'event',
      name: '殉葬火堆',
      eventType: 'legendary',
      faction: 'necromancer',
      cost: 1,
      playPhase: 'summon',
      effect: '持续效果',
      isActive: true,
      charges: 3,
      deckSymbols: [],
    });

    state.currentPlayer = '0';

    const { newState } = executeAndReduce(state, SW_COMMANDS.FUNERAL_PYRE_HEAL, {
      cardId: 'necro-funeral-pyre-test',
      skip: true,
    });

    // 殉葬火堆应从主动事件区移除
    expect(newState.players['0'].activeEvents.find(e => e.id === 'necro-funeral-pyre-test')).toBeUndefined();
  });
});

// ============================================================================
// 复活死灵测试
// ============================================================================

describe('召唤师 - 复活死灵 (revive_undead)', () => {
  it('应从弃牌堆召唤亡灵单位到召唤师相邻位置', () => {
    const state = createTestState();
    const summonerPos = findUnitPosition(state, u => u.owner === '0' && u.card.unitClass === 'summoner');
    expect(summonerPos).not.toBeNull();

    const summoner = getUnitAt(state, summonerPos!)!;
    const summonerLife = summoner.card.life;

    // 添加亡灵单位到弃牌堆
    const discardCard = makePlagueZombie('necro-discard-zombie');
    state.players['0'].discard.push(discardCard);

    // 找一个召唤师相邻的空位
    const adj = [
      { row: summonerPos!.row - 1, col: summonerPos!.col },
      { row: summonerPos!.row + 1, col: summonerPos!.col },
      { row: summonerPos!.row, col: summonerPos!.col - 1 },
      { row: summonerPos!.row, col: summonerPos!.col + 1 },
    ].filter(p => p.row >= 0 && p.row < BOARD_ROWS && p.col >= 0 && p.col < BOARD_COLS);

    let targetPos: CellCoord | null = null;
    for (const p of adj) {
      if (!state.board[p.row][p.col].unit && !state.board[p.row][p.col].structure) {
        targetPos = p;
        break;
      }
    }
    // 如果没有空位，清一个
    if (!targetPos) {
      targetPos = adj[0];
      state.board[targetPos.row][targetPos.col].unit = undefined;
      state.board[targetPos.row][targetPos.col].structure = undefined;
    }

    state.phase = 'summon';
    state.currentPlayer = '0';

    const { newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'revive_undead',
      sourceUnitId: summoner.instanceId,
      targetCardId: discardCard.id,
      targetPosition: targetPos,
    });

    // 召唤师应受到2点伤害
    const newSummoner = getUnitAt(newState, summonerPos!);
    expect(newSummoner).toBeDefined();
    expect(newSummoner!.damage).toBe(2);

    // 目标位置应有亡灵单位
    const summonedUnit = getUnitAt(newState, targetPos!);
    expect(summonedUnit).toBeDefined();
    expect(summonedUnit!.card.name).toBe('亡灵疫病体');

    // 弃牌堆应移除该卡
    expect(newState.players['0'].discard.find(c => c.id === discardCard.id)).toBeUndefined();
  });
});

// ============================================================================
// 火祀召唤测试
// ============================================================================

describe('伊路特-巴尔 - 火祀召唤 (fire_sacrifice_summon)', () => {
  it('召唤时消灭友方单位，放置到牺牲品位置', () => {
    const state = createTestState();
    // 清空测试区域
    state.board[4][2].unit = undefined;
    state.board[4][3].unit = undefined;

    // 将伊路特-巴尔放入手牌
    const elutBarCard: UnitCard = {
      id: 'test-elut-bar', cardType: 'unit', name: '伊路特-巴尔',
      unitClass: 'champion', faction: 'necromancer', strength: 6, life: 6,
      cost: 6, attackType: 'melee', attackRange: 1,
      abilities: ['fire_sacrifice_summon'], deckSymbols: [],
    };
    state.players['0'].hand.push(elutBarCard);
    state.players['0'].magic = 10;

    // 放置友方牺牲品
    const victim = placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-victim',
      card: makeEnemy('test-victim'),
      owner: '0',
    });

    state.currentPlayer = '0';
    state.phase = 'summon';

    const { newState } = executeAndReduce(state, SW_COMMANDS.SUMMON_UNIT, {
      cardId: 'test-elut-bar',
      position: { row: 4, col: 3 },
      sacrificeUnitId: victim.instanceId,
    });

    // 伊路特-巴尔应在牺牲品位置 (4,3)
    expect(newState.board[4][3].unit?.cardId).toBe('test-elut-bar');
    // 牺牲品已被消灭
    expect(newState.board[4][3].unit?.card.name).toBe('伊路特-巴尔');
  });
});

// ============================================================================
// 吸取生命测试
// ============================================================================

describe('德拉戈斯 - 吸取生命 (life_drain)', () => {
  it('应消灭友方单位（special 标记算近战命中效果在 DECLARE_ATTACK 路径生效）', () => {
    const state = createTestState();
    state.board[4][2].unit = undefined;
    state.board[4][3].unit = undefined;

    // 放置德拉戈斯
    const dragos = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-dragos',
      card: {
        id: 'test-dragos', cardType: 'unit', name: '德拉戈斯',
        unitClass: 'champion', faction: 'necromancer', strength: 4, life: 8,
        cost: 6, attackType: 'melee', attackRange: 1,
        abilities: ['life_drain'], deckSymbols: [],
      },
      owner: '0',
    });

    // 放置友方牺牲品（2格内）
    const sacrifice = placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-sacrifice',
      card: makeEnemy('test-sacrifice'),
      owner: '0',
    });

    state.currentPlayer = '0';
    state.phase = 'attack';

    const { newState, events } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'life_drain',
      sourceUnitId: dragos.instanceId,
      targetUnitId: sacrifice.cardId,
    });

    // 牺牲品应被消灭
    expect(newState.board[4][3].unit).toBeUndefined();

    // 不再产生 STRENGTH_MODIFIED 事件（效果改为 special 算近战命中，在 DECLARE_ATTACK 路径处理）
    const strengthEvents = events.filter(e => e.type === SW_EVENTS.STRENGTH_MODIFIED);
    expect(strengthEvents.length).toBe(0);
  });
});

// ============================================================================
// 感染测试
// ============================================================================

describe('亡灵疫病体 - 感染 (infection)', () => {
  it('ACTIVATE_ABILITY infection 应从弃牌堆召唤疫病体到指定位置', () => {
    const state = createTestState();
    state.board[4][3].unit = undefined;

    // 添加疫病体到弃牌堆
    const discardZombie = makePlagueZombie('necro-plague-zombie-discard');
    state.players['0'].discard.push(discardZombie);

    // 放置疫病体攻击者（用于 sourceUnitId）
    state.board[4][2].unit = undefined;
    const zombieAttacker = placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-zombie-attacker',
      card: makePlagueZombie('test-zombie-attacker'),
      owner: '0',
    });

    state.currentPlayer = '0';

    const { newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'infection',
      sourceUnitId: zombieAttacker.instanceId,
      targetCardId: discardZombie.id,
      targetPosition: { row: 4, col: 3 },
    });

    // 目标位置应有疫病体
    const unit = newState.board[4][3].unit;
    expect(unit).toBeDefined();
    expect(unit!.card.name).toBe('亡灵疫病体');

    // 弃牌堆应移除该卡
    expect(newState.players['0'].discard.find(c => c.id === discardZombie.id)).toBeUndefined();
  });
});
