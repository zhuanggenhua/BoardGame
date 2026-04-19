/**
 * 召唤师战争 - 神圣护盾测试
 * 
 * 测试科琳的神圣护盾技能：3格内友方城塞单位被攻击时投2骰减伤
 */

import { describe, it, expect } from 'vitest';
import { executeCommand } from '../domain/execute';
import { SW_COMMANDS, SW_EVENTS } from '../domain/types';
import type { SummonerWarsCore, UnitCard } from '../domain/types';
import type { MatchState } from '../../../engine/types';
import { CARD_IDS } from '../domain/ids';
import { placeTestUnit, createInitializedCore } from './test-helpers';
import type { RandomFn } from '../../../engine/types';

function createPaladinState(): MatchState<SummonerWarsCore> {
  const testRandom: RandomFn = {
    shuffle: <T>(arr: T[]) => arr,
    random: () => 0.5,
    d: (max: number) => Math.ceil(max / 2),
    range: (min: number, max: number) => Math.floor((min + max) / 2),
  };
  
  const core = createInitializedCore(['0', '1'], testRandom, {
    faction0: 'goblin',
    faction1: 'paladin',
  });

  return {
    core,
    sys: {
      gameover: null,
      undo: { snapshots: [], currentIndex: -1 },
      eventStream: { entries: [], nextId: 0 },
      interaction: { queue: [] },
      responseWindow: { isOpen: false, allowedCommands: [], responseAdvanceEvents: [] },
      tutorial: null,
    },
  };
}

function initializeBoard(state: MatchState<SummonerWarsCore>) {
  // 棋盘是 8 行 × 6 列
  for (let row = 0; row < 8; row++) {
    if (!state.core.board[row]) state.core.board[row] = [];
    for (let col = 0; col < 6; col++) {
      state.core.board[row][col] = { unit: null, structure: null };
    }
  }
}

describe('神圣护盾 (divine_shield)', () => {
  it('科琳3格内友方城塞单位被攻击时触发护盾', () => {
    const state = createPaladinState();
    initializeBoard(state);

    // 放置科琳（拥有 divine_shield）在 [4][2]
    const colleenCard: UnitCard = {
      id: CARD_IDS.PALADIN_COLLEEN,
      name: '科琳',
      faction: 'paladin',
      cardType: 'unit',
      unitClass: 'champion',
      cost: 0,
      strength: 2,
      life: 18,
      move: 2,
      attackType: 'melee',
      attackRange: 1,
      abilities: ['divine_shield'],
      deckSymbols: [],
      spriteIndex: 0,
    };
    const colleen = placeTestUnit(state.core, { row: 4, col: 2 }, {
      card: colleenCard,
      owner: '1',
    });

    // 放置友方城塞单位在 [4][4]（距离科琳 2 格）
    const fortressGuardCard: UnitCard = {
      id: CARD_IDS.PALADIN_FORTRESS_GUARD,
      name: '城塞守卫',
      faction: 'paladin',
      cardType: 'unit',
      unitClass: 'common',
      cost: 1,
      strength: 1,
      life: 4,
      move: 1,
      attackType: 'melee',
      attackRange: 1,
      isFortress: true,
      deckSymbols: [],
      spriteIndex: 0,
    };
    placeTestUnit(state.core, { row: 4, col: 4 }, {
      card: fortressGuardCard,
      owner: '1',
    });

    // 放置攻击者在 [3][4]（相邻城塞守卫）
    const attackerCard: UnitCard = {
      id: 'attacker-card',
      name: '攻击者',
      faction: 'goblin',
      cardType: 'unit',
      unitClass: 'common',
      cost: 2,
      strength: 3,
      life: 3,
      move: 2,
      attackType: 'melee',
      attackRange: 1,
      deckSymbols: [],
      spriteIndex: 0,
    };
    placeTestUnit(state.core, { row: 3, col: 4 }, {
      card: attackerCard,
      owner: '0',
    });

    // 设置攻击阶段
    state.core.phase = 'attack';
    state.core.currentPlayer = '0';
    state.core.players['0'].attackCount = 0;
    state.core.players['0'].hasAttackedEnemy = false;

    // 执行攻击（使用固定随机数确保命中）
    let hitCount = 0;
    const events = executeCommand(
      state,
      {
        type: SW_COMMANDS.DECLARE_ATTACK,
        payload: {
          attacker: { row: 3, col: 4 },
          target: { row: 4, col: 4 },
        },
        playerId: '0',
      },
      {
        random: () => {
          // 新实现：先投护盾骰（2个），再投攻击骰（3个）
          // 前2个骰子：神圣护盾投掷（special 减伤）
          // 后3个骰子：攻击者投掷（全部命中 melee）
          hitCount++;
          if (hitCount <= 2) return 0.75; // 护盾骰子投 special
          return 0.1; // 攻击骰子投 melee
        },
        shuffle: <T>(arr: T[]) => arr,
        d: (max: number) => Math.ceil(max / 2),
        range: (min: number, max: number) => Math.floor((min + max) / 2),
      }
    );

    // 应该有 DAMAGE_REDUCED 事件
    const damageReducedEvents = events.filter(e => e.type === SW_EVENTS.DAMAGE_REDUCED);
    expect(damageReducedEvents.length).toBeGreaterThan(0);

    const shieldEvent = damageReducedEvents.find(
      e => (e.payload as any).sourceAbilityId === 'divine_shield'
    );
    expect(shieldEvent).toBeDefined();
    expect((shieldEvent!.payload as any).sourceUnitId).toBe(colleen.instanceId);
    expect((shieldEvent!.payload as any).condition).toBe('divine_shield');
    
    // 验证护盾骰子结果
    const shieldDice = (shieldEvent!.payload as any).shieldDice;
    expect(shieldDice).toBeDefined();
    expect(shieldDice.length).toBe(2);
  });

  it('神圣护盾减伤后战力最少为1', () => {
    const state = createPaladinState();
    initializeBoard(state);

    // 放置科琳在 [4][2]
    const colleenCard: UnitCard = {
      id: CARD_IDS.PALADIN_COLLEEN,
      name: '科琳',
      faction: 'paladin',
      cardType: 'unit',
      unitClass: 'champion',
      cost: 0,
      strength: 2,
      life: 18,
      move: 2,
      attackType: 'melee',
      attackRange: 1,
      abilities: ['divine_shield'],
      deckSymbols: [],
      spriteIndex: 0,
    };
    placeTestUnit(state.core, { row: 4, col: 2 }, {
      card: colleenCard,
      owner: '1',
    });

    // 放置友方城塞单位在 [4][4]
    const fortressGuardCard: UnitCard = {
      id: CARD_IDS.PALADIN_FORTRESS_GUARD,
      name: '城塞守卫',
      faction: 'paladin',
      cardType: 'unit',
      unitClass: 'common',
      cost: 1,
      strength: 1,
      life: 4,
      move: 1,
      attackType: 'melee',
      attackRange: 1,
      isFortress: true,
      deckSymbols: [],
      spriteIndex: 0,
    };
    placeTestUnit(state.core, { row: 4, col: 4 }, {
      card: fortressGuardCard,
      owner: '1',
    });

    // 放置弱攻击者（只有1点战力）在 [3][4]
    const weakAttackerCard: UnitCard = {
      id: 'attacker-card',
      name: '弱攻击者',
      faction: 'goblin',
      cardType: 'unit',
      unitClass: 'common',
      cost: 1,
      strength: 1,
      life: 2,
      move: 2,
      attackType: 'melee',
      attackRange: 1,
      deckSymbols: [],
      spriteIndex: 0,
    };
    placeTestUnit(state.core, { row: 3, col: 4 }, {
      card: weakAttackerCard,
      owner: '0',
    });

    // 设置攻击阶段
    state.core.phase = 'attack';
    state.core.currentPlayer = '0';
    state.core.players['0'].attackCount = 0;
    state.core.players['0'].hasAttackedEnemy = false;

    // 执行攻击
    let hitCount = 0;
    const events = executeCommand(
      state,
      {
        type: SW_COMMANDS.DECLARE_ATTACK,
        payload: {
          attacker: { row: 3, col: 4 },
          target: { row: 4, col: 4 },
        },
        playerId: '0',
      },
      {
        random: () => {
          hitCount++;
          // 新实现：先投护盾骰（2个），再投攻击骰（1个）
          if (hitCount <= 2) return 0.75; // 护盾骰子投 special
          return 0.1; // 攻击者投 melee
        },
        shuffle: <T>(arr: T[]) => arr,
        d: (max: number) => Math.ceil(max / 2),
        range: (min: number, max: number) => Math.floor((min + max) / 2),
      }
    );

    // 找到攻击事件
    const attackEvent = events.find(e => e.type === SW_EVENTS.UNIT_ATTACKED);
    expect(attackEvent).toBeDefined();
    
    // 即使护盾减伤，实际投掷骰子数（diceCount）应该至少为 1
    // 新实现：神圣护盾减少 effectiveStrength（骰子数），而非 hits
    const diceCount = (attackEvent!.payload as any).diceCount;
    expect(diceCount).toBeGreaterThanOrEqual(1);
  });

  it('非城塞单位不触发神圣护盾', () => {
    const state = createPaladinState();
    initializeBoard(state);

    // 放置科琳在 [4][2]
    const colleenCard: UnitCard = {
      id: CARD_IDS.PALADIN_COLLEEN,
      name: '科琳',
      faction: 'paladin',
      cardType: 'unit',
      unitClass: 'champion',
      cost: 0,
      strength: 2,
      life: 18,
      move: 2,
      attackType: 'melee',
      attackRange: 1,
      abilities: ['divine_shield'],
      deckSymbols: [],
      spriteIndex: 0,
    };
    placeTestUnit(state.core, { row: 4, col: 2 }, {
      card: colleenCard,
      owner: '1',
    });

    // 放置友方非城塞单位在 [4][4]
    const normalUnitCard: UnitCard = {
      id: 'normal-card',
      name: '普通单位',
      faction: 'paladin',
      cardType: 'unit',
      unitClass: 'common',
      cost: 1,
      strength: 2,
      life: 3,
      move: 2,
      attackType: 'melee',
      attackRange: 1,
      deckSymbols: [],
      spriteIndex: 0,
    };
    placeTestUnit(state.core, { row: 4, col: 4 }, {
      card: normalUnitCard,
      owner: '1',
    });

    // 放置攻击者在 [3][4]
    const attackerCard: UnitCard = {
      id: 'attacker-card',
      name: '攻击者',
      faction: 'goblin',
      cardType: 'unit',
      unitClass: 'common',
      cost: 2,
      strength: 3,
      life: 3,
      move: 2,
      attackType: 'melee',
      attackRange: 1,
      deckSymbols: [],
      spriteIndex: 0,
    };
    placeTestUnit(state.core, { row: 3, col: 4 }, {
      card: attackerCard,
      owner: '0',
    });

    // 设置攻击阶段
    state.core.phase = 'attack';
    state.core.currentPlayer = '0';
    state.core.players['0'].attackCount = 0;
    state.core.players['0'].hasAttackedEnemy = false;

    // 执行攻击
    const events = executeCommand(
      state,
      {
        type: SW_COMMANDS.DECLARE_ATTACK,
        payload: {
          attacker: { row: 3, col: 4 },
          target: { row: 4, col: 4 },
        },
        playerId: '0',
      },
      {
        random: () => 0.1, // 攻击者投 melee，无护盾骰子（非城塞单位）
        shuffle: <T>(arr: T[]) => arr,
        d: (max: number) => Math.ceil(max / 2),
        range: (min: number, max: number) => Math.floor((min + max) / 2),
      }
    );

    // 不应该有神圣护盾的 DAMAGE_REDUCED 事件
    const shieldEvents = events.filter(
      e => e.type === SW_EVENTS.DAMAGE_REDUCED && (e.payload as any).sourceAbilityId === 'divine_shield'
    );
    expect(shieldEvents.length).toBe(0);
  });

  it('超过3格距离不触发神圣护盾', () => {
    const state = createPaladinState();
    initializeBoard(state);

    // 放置科琳在 [4][0]
    const colleenCard: UnitCard = {
      id: CARD_IDS.PALADIN_COLLEEN,
      name: '科琳',
      faction: 'paladin',
      cardType: 'unit',
      unitClass: 'champion',
      cost: 0,
      strength: 2,
      life: 18,
      move: 2,
      attackType: 'melee',
      attackRange: 1,
      abilities: ['divine_shield'],
      deckSymbols: [],
      spriteIndex: 0,
    };
    placeTestUnit(state.core, { row: 4, col: 0 }, {
      card: colleenCard,
      owner: '1',
    });

    // 放置友方城塞单位在 [4][4]（距离科琳 4 格，超出范围）
    const fortressGuardCard: UnitCard = {
      id: CARD_IDS.PALADIN_FORTRESS_GUARD,
      name: '城塞守卫',
      faction: 'paladin',
      cardType: 'unit',
      unitClass: 'common',
      cost: 1,
      strength: 1,
      life: 4,
      move: 1,
      attackType: 'melee',
      attackRange: 1,
      isFortress: true,
      deckSymbols: [],
      spriteIndex: 0,
    };
    placeTestUnit(state.core, { row: 4, col: 4 }, {
      card: fortressGuardCard,
      owner: '1',
    });

    // 放置攻击者在 [3][4]
    const attackerCard: UnitCard = {
      id: 'attacker-card',
      name: '攻击者',
      faction: 'goblin',
      cardType: 'unit',
      unitClass: 'common',
      cost: 2,
      strength: 3,
      life: 3,
      move: 2,
      attackType: 'melee',
      attackRange: 1,
      deckSymbols: [],
      spriteIndex: 0,
    };
    placeTestUnit(state.core, { row: 3, col: 4 }, {
      card: attackerCard,
      owner: '0',
    });

    // 设置攻击阶段
    state.core.phase = 'attack';
    state.core.currentPlayer = '0';
    state.core.players['0'].attackCount = 0;
    state.core.players['0'].hasAttackedEnemy = false;

    // 执行攻击
    const events = executeCommand(
      state,
      {
        type: SW_COMMANDS.DECLARE_ATTACK,
        payload: {
          attacker: { row: 3, col: 4 },
          target: { row: 4, col: 4 },
        },
        playerId: '0',
      },
      {
        random: () => 0.1, // 攻击者投 melee，无护盾骰子（距离超出）
        shuffle: <T>(arr: T[]) => arr,
        d: (max: number) => Math.ceil(max / 2),
        range: (min: number, max: number) => Math.floor((min + max) / 2),
      }
    );

    // 不应该有神圣护盾的 DAMAGE_REDUCED 事件（距离超过3格）
    const shieldEvents = events.filter(
      e => e.type === SW_EVENTS.DAMAGE_REDUCED && (e.payload as any).sourceAbilityId === 'divine_shield'
    );
    expect(shieldEvents.length).toBe(0);
  });
});
