/**
 * 召唤师战争 - 亡灵法师 execute 流程测试
 *
 * 覆盖 abilities.test.ts 中缺失的 execute/reduce 集成测试：
 * - revive_undead（复活死灵）：自伤2 + 从弃牌堆召唤
 * - fire_sacrifice_summon（火祭召唤）：消灭友方 + 移动到其位置
 * - life_drain（吸取生命）：消灭友方 + 双倍战力
 * - infection（感染）：从弃牌堆召唤疫病体
 * - soul_transfer（灵魂转移）：移动到空格
 * - soulless（无魂）：击杀时不给对方魔力
 * - blood_rage onUnitDestroyed：单位被消灭时充能
 */

import { describe, it, expect, vi } from 'vitest';
import { SummonerWarsDomain, SW_COMMANDS, SW_EVENTS } from '../domain';
import type { SummonerWarsCore, CellCoord, BoardUnit, UnitCard, PlayerId } from '../domain/types';
import type { RandomFn, GameEvent } from '../../../engine/types';
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

function createNecroState(): SummonerWarsCore {
  return createInitializedCore(['0', '1'], createTestRandom(), {
    faction0: 'necromancer',
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
    attachedCards: overrides.attachedCards,
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

function makeSummoner(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '古尔-达斯', unitClass: 'summoner',
    faction: 'necromancer', strength: 2, life: 13, cost: 0,
    attackType: 'melee', attackRange: 1,
    abilities: ['revive_undead', 'rage'], deckSymbols: [],
  };
}

function makeUndeadWarrior(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '亡灵战士', unitClass: 'common',
    faction: 'necromancer', strength: 2, life: 4, cost: 2,
    attackType: 'melee', attackRange: 1,
    abilities: ['blood_rage', 'power_boost', 'blood_rage_decay'], deckSymbols: [],
  };
}

function makePlagueZombie(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '疫病体', unitClass: 'common',
    faction: 'necromancer', strength: 1, life: 1, cost: 0,
    attackType: 'melee', attackRange: 1,
    abilities: ['soulless', 'infection'], deckSymbols: [],
  };
}

function makeCultist(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '地狱火教徒', unitClass: 'common',
    faction: 'necromancer', strength: 1, life: 1, cost: 0,
    attackType: 'melee', attackRange: 1,
    abilities: ['sacrifice'], deckSymbols: [],
  };
}

function makeFireSacrifice(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '火祭召唤师', unitClass: 'champion',
    faction: 'necromancer', strength: 3, life: 7, cost: 5,
    attackType: 'melee', attackRange: 1,
    abilities: ['fire_sacrifice_summon'], deckSymbols: [],
  };
}

function makeLifeDrainer(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '吸取者', unitClass: 'champion',
    faction: 'necromancer', strength: 2, life: 8, cost: 6,
    attackType: 'melee', attackRange: 1,
    abilities: ['life_drain'], deckSymbols: [],
  };
}

function makeSoulArcher(id: string): UnitCard {
  return {
    id, cardType: 'unit', name: '亡灵弓箭手', unitClass: 'common',
    faction: 'necromancer', strength: 1, life: 3, cost: 1,
    attackType: 'ranged', attackRange: 3,
    abilities: ['soul_transfer'], deckSymbols: [],
  };
}

function makeEnemy(id: string, overrides?: Partial<UnitCard>): UnitCard {
  return {
    id, cardType: 'unit', name: '敌方单位', unitClass: 'common',
    faction: 'goblin', strength: 2, life: 3, cost: 0,
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
  const command = { type: commandType, payload, timestamp: fixedTimestamp, playerId: state.currentPlayer };
  const events = SummonerWarsDomain.execute(fullState, command, random ?? createTestRandom());
  let newState = state;
  for (const event of events) {
    newState = SummonerWarsDomain.reduce(newState, event);
  }
  return { newState, events };
}

// ============================================================================
// 复活死灵 (revive_undead) execute 流程测试
// ============================================================================

describe('古尔-达斯 - 复活死灵 (revive_undead) execute 流程', () => {
  it('自伤2点 + 从弃牌堆召唤亡灵到相邻位置', () => {
    const state = createNecroState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-summoner',
      card: makeSummoner('test-summoner'),
      owner: '0',
    });

    // 弃牌堆放入亡灵战士
    const discardCard = makeUndeadWarrior('undead-warrior-discard');
    state.players['0'].discard.push(discardCard);

    state.phase = 'summon';
    state.currentPlayer = '0';

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'revive_undead',
      sourceUnitId: 'test-summoner',
      targetCardId: 'undead-warrior-discard',
      targetPosition: { row: 4, col: 3 },
    });

    // 应有自伤事件
    const selfDamage = events.filter(
      e => e.type === SW_EVENTS.UNIT_DAMAGED && (e.payload as any).reason === 'revive_undead'
    );
    expect(selfDamage.length).toBe(1);
    expect((selfDamage[0].payload as any).damage).toBe(2);

    // 应有召唤事件
    const summonEvents = events.filter(e => e.type === SW_EVENTS.UNIT_SUMMONED);
    expect(summonEvents.length).toBe(1);
    expect((summonEvents[0].payload as any).fromDiscard).toBe(true);

    // 召唤师受到2点伤害
    expect(newState.board[4][2].unit?.damage).toBe(2);

    // 亡灵战士出现在 (4,3)
    expect(newState.board[4][3].unit?.cardId).toBe('undead-warrior-discard');

    // 弃牌堆中该卡被移除
    expect(newState.players['0'].discard.find(c => c.id === 'undead-warrior-discard')).toBeUndefined();
  });

  it('弃牌堆无亡灵单位时验证拒绝', () => {
    const state = createNecroState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-summoner',
      card: makeSummoner('test-summoner'),
      owner: '0',
    });

    state.phase = 'summon';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'revive_undead',
        sourceUnitId: 'test-summoner',
        targetCardId: 'nonexistent',
        targetPosition: { row: 4, col: 3 },
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
  });
});


// ============================================================================
// 火祭召唤 (fire_sacrifice_summon) execute 流程测试
// ============================================================================

describe('火祭召唤 (fire_sacrifice_summon) execute 流程', () => {
  it('消灭友方单位 + 移动到其位置', () => {
    const state = createNecroState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-fire-sacrifice',
      card: makeFireSacrifice('test-fire-sacrifice'),
      owner: '0',
    });

    placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'test-victim',
      card: makeCultist('test-victim'),
      owner: '0',
    });

    state.phase = 'summon';
    state.currentPlayer = '0';

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'fire_sacrifice_summon',
      sourceUnitId: 'test-fire-sacrifice',
      targetUnitId: 'test-victim',
    });

    // 应有消灭事件
    const destroyEvents = events.filter(
      e => e.type === SW_EVENTS.UNIT_DESTROYED && (e.payload as any).cardId === 'test-victim'
    );
    expect(destroyEvents.length).toBe(1);

    // 应有移动事件（火祭者移动到被消灭单位位置）
    const moveEvents = events.filter(
      e => e.type === SW_EVENTS.UNIT_MOVED && (e.payload as any).reason === 'fire_sacrifice_summon'
    );
    expect(moveEvents.length).toBe(1);

    // 火祭者应在 (4,4)
    expect(newState.board[4][4].unit?.cardId).toBe('test-fire-sacrifice');
    // 原位置应为空
    expect(newState.board[4][2].unit).toBeUndefined();
    // 被消灭单位不在棋盘上
    expect(newState.board[4][4].unit?.card.name).toBe('火祭召唤师');
  });
});

// ============================================================================
// 吸取生命 (life_drain) execute 流程测试
// ============================================================================

describe('吸取生命 (life_drain) execute 流程', () => {
  it('消灭友方单位 + 获得双倍战力', () => {
    const state = createNecroState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-drainer',
      card: makeLifeDrainer('test-drainer'),
      owner: '0',
    });

    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-victim',
      card: makeCultist('test-victim'),
      owner: '0',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'life_drain',
      sourceUnitId: 'test-drainer',
      targetUnitId: 'test-victim',
    });

    // 应有消灭事件
    const destroyEvents = events.filter(
      e => e.type === SW_EVENTS.UNIT_DESTROYED && (e.payload as any).cardId === 'test-victim'
    );
    expect(destroyEvents.length).toBe(1);

    // 应有战力翻倍事件
    const strengthEvents = events.filter(e => e.type === SW_EVENTS.STRENGTH_MODIFIED);
    expect(strengthEvents.length).toBe(1);
    expect((strengthEvents[0].payload as any).multiplier).toBe(2);
  });

  it('DECLARE_ATTACK 携带 beforeAttack 时触发牺牲并翻倍战力', () => {
    const state = createNecroState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4, 5]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-drainer',
      card: makeLifeDrainer('test-drainer'),
      owner: '0',
    });

    placeUnit(state, { row: 4, col: 4 }, {
      cardId: 'test-victim',
      card: makeCultist('test-victim'),
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

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
      attacker: { row: 4, col: 2 },
      target: { row: 4, col: 3 },
      beforeAttack: {
        abilityId: 'life_drain',
        targetUnitId: 'test-victim',
      },
    });

    const destroyEvents = events.filter(
      e => e.type === SW_EVENTS.UNIT_DESTROYED && (e.payload as any).cardId === 'test-victim'
    );
    expect(destroyEvents.length).toBe(1);

    const strengthEvents = events.filter(
      e => e.type === SW_EVENTS.STRENGTH_MODIFIED && (e.payload as any).sourceAbilityId === 'life_drain'
    );
    expect(strengthEvents.length).toBe(1);
    expect((strengthEvents[0].payload as any).multiplier).toBe(2);

    const attackedEvent = events.find(e => e.type === SW_EVENTS.UNIT_ATTACKED);
    expect(attackedEvent).toBeDefined();
    expect((attackedEvent!.payload as any).diceCount).toBe(4);

    expect(newState.board[4][4].unit).toBeUndefined();
  });

  it('目标超过2格时验证拒绝', () => {
    const state = createNecroState();
    clearArea(state, [1, 2, 3, 4, 5], [1, 2, 3, 4]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-drainer',
      card: makeLifeDrainer('test-drainer'),
      owner: '0',
    });

    // 距离3格（4→1），超过2格限制
    placeUnit(state, { row: 1, col: 2 }, {
      cardId: 'test-far-victim',
      card: makeCultist('test-far-victim'),
      owner: '0',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'life_drain',
        sourceUnitId: 'test-drainer',
        targetUnitId: 'test-far-victim',
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('2格');
  });
});

// ============================================================================
// 感染 (infection) execute 流程测试
// ============================================================================

describe('感染 (infection) execute 流程', () => {
  it('从弃牌堆召唤疫病体到指定位置', () => {
    const state = createNecroState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-plague',
      card: makePlagueZombie('test-plague'),
      owner: '0',
    });

    // 弃牌堆放入疫病体
    const discardZombie = makePlagueZombie('plague-zombie-discard');
    state.players['0'].discard.push(discardZombie);

    state.phase = 'attack';
    state.currentPlayer = '0';

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'infection',
      sourceUnitId: 'test-plague',
      targetCardId: 'plague-zombie-discard',
      targetPosition: { row: 4, col: 3 },
    });

    // 应有召唤事件
    const summonEvents = events.filter(e => e.type === SW_EVENTS.UNIT_SUMMONED);
    expect(summonEvents.length).toBe(1);
    expect((summonEvents[0].payload as any).fromDiscard).toBe(true);

    // 疫病体出现在 (4,3)
    expect(newState.board[4][3].unit?.cardId).toBe('plague-zombie-discard');
  });

  it('弃牌堆无疫病体时验证拒绝', () => {
    const state = createNecroState();
    clearArea(state, [3, 4, 5], [1, 2, 3]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-plague',
      card: makePlagueZombie('test-plague'),
      owner: '0',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'infection',
        sourceUnitId: 'test-plague',
        targetCardId: 'nonexistent',
        targetPosition: { row: 4, col: 3 },
      },
      playerId: '0',
      timestamp: fixedTimestamp,
    });
    expect(result.valid).toBe(false);
  });
});

// ============================================================================
// 灵魂转移 (soul_transfer) execute 流程测试
// ============================================================================

describe('灵魂转移 (soul_transfer) execute 流程', () => {
  it('移动到指定空格', () => {
    const state = createNecroState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-archer',
      card: makeSoulArcher('test-archer'),
      owner: '0',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const { events, newState } = executeAndReduce(state, SW_COMMANDS.ACTIVATE_ABILITY, {
      abilityId: 'soul_transfer',
      sourceUnitId: 'test-archer',
      targetPosition: { row: 4, col: 4 },
    });

    // 应有移动事件
    const moveEvents = events.filter(
      e => e.type === SW_EVENTS.UNIT_MOVED && (e.payload as any).reason === 'soul_transfer'
    );
    expect(moveEvents.length).toBe(1);

    // 弓箭手应在 (4,4)
    expect(newState.board[4][4].unit?.cardId).toBe('test-archer');
    expect(newState.board[4][2].unit).toBeUndefined();
  });

  it('目标位置被占据时验证拒绝', () => {
    const state = createNecroState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

    placeUnit(state, { row: 4, col: 2 }, {
      cardId: 'test-archer',
      card: makeSoulArcher('test-archer'),
      owner: '0',
    });

    placeUnit(state, { row: 4, col: 3 }, {
      cardId: 'test-blocker',
      card: makeEnemy('test-blocker'),
      owner: '1',
    });

    state.phase = 'attack';
    state.currentPlayer = '0';

    const fullState = { core: state, sys: {} as any };
    const result = SummonerWarsDomain.validate(fullState, {
      type: SW_COMMANDS.ACTIVATE_ABILITY,
      payload: {
        abilityId: 'soul_transfer',
        sourceUnitId: 'test-archer',
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
// 无魂 (soulless) 集成测试
// ============================================================================

describe('疫病体 - 无魂 (soulless) 集成测试', () => {
  it('疫病体击杀敌方时对方不获得魔力', () => {
    // 所有骰子掷出 melee（近战命中）
    const meleeRandom: RandomFn = { ...createTestRandom(), random: () => 0 };
    const state = createNecroState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

      placeUnit(state, { row: 4, col: 2 }, {
        cardId: 'test-plague',
        card: makePlagueZombie('test-plague'),
        owner: '0',
      });

      // 敌方 life=1，会被击杀
      placeUnit(state, { row: 4, col: 3 }, {
        cardId: 'test-enemy',
        card: makeEnemy('test-enemy', { life: 1 }),
        owner: '1',
      });

      state.phase = 'attack';
      state.currentPlayer = '0';
      state.players['0'].attackCount = 0;
      state.players['0'].hasAttackedEnemy = false;
      const magicBefore = state.players['0'].magic;

      const { events, newState } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
        attacker: { row: 4, col: 2 },
        target: { row: 4, col: 3 },
      }, meleeRandom);

      // 应有 UNIT_DAMAGED 事件且带 skipMagicReward
      const damageEvents = events.filter(e => e.type === SW_EVENTS.UNIT_DAMAGED);
      expect(damageEvents.length).toBeGreaterThan(0);
      const mainDamage = damageEvents.find(
        e => (e.payload as any).position?.row === 4 && (e.payload as any).position?.col === 3
      );
      expect(mainDamage).toBeDefined();
      expect((mainDamage!.payload as any).skipMagicReward).toBe(true);

      // 验证 reduce 后状态：玩家0不应获得额外魔力（skipMagicReward=true）
      // 疫病体(owner=0)攻击敌方(owner=1)，击杀后 attackingPlayer=0 不获得魔力
      expect(newState.players['0'].magic).toBe(magicBefore);
  });
});

// ============================================================================
// 血腥狂怒 onUnitDestroyed 充能测试
// ============================================================================

describe('亡灵战士 - 血腥狂怒 onUnitDestroyed 充能', () => {
  it('任意单位被消灭时亡灵战士获得充能', () => {
    // 所有骰子掷出 melee（近战命中）
    const meleeRandom: RandomFn = { ...createTestRandom(), random: () => 0 };
    const state = createNecroState();
    clearArea(state, [3, 4, 5], [1, 2, 3, 4]);

      // 友方攻击者（非亡灵战士）
      placeUnit(state, { row: 4, col: 2 }, {
        cardId: 'test-attacker',
        card: makeEnemy('test-attacker', { strength: 5, faction: 'necromancer' }),
        owner: '0',
      });

      // 敌方 life=1，会被击杀
      placeUnit(state, { row: 4, col: 3 }, {
        cardId: 'test-enemy',
        card: makeEnemy('test-enemy', { life: 1 }),
        owner: '1',
      });

      // 亡灵战士在旁边
      placeUnit(state, { row: 3, col: 2 }, {
        cardId: 'test-warrior',
        card: makeUndeadWarrior('test-warrior'),
        owner: '0',
        boosts: 0,
      });

      state.phase = 'attack';
      state.currentPlayer = '0';
      state.players['0'].attackCount = 0;
      state.players['0'].hasAttackedEnemy = false;

      const { events, newState } = executeAndReduce(state, SW_COMMANDS.DECLARE_ATTACK, {
        attacker: { row: 4, col: 2 },
        target: { row: 4, col: 3 },
      }, meleeRandom);

      // 应有 UNIT_DESTROYED 事件
      const destroyEvents = events.filter(e => e.type === SW_EVENTS.UNIT_DESTROYED);
      expect(destroyEvents.length).toBeGreaterThan(0);

      // 亡灵战士应获得充能（blood_rage onUnitDestroyed）
      const chargeEvents = events.filter(
        e => e.type === SW_EVENTS.UNIT_CHARGED
          && (e.payload as any).position?.row === 3
          && (e.payload as any).position?.col === 2
      );
      expect(chargeEvents.length).toBeGreaterThan(0);

      // 验证 reduce 后状态：亡灵战士的 boosts 应增加
      const warrior = newState.board[3][2].unit;
      expect(warrior).toBeDefined();
      expect(warrior!.boosts).toBeGreaterThan(0);
  });
});
