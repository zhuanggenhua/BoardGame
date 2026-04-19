/**
 * 召唤师战争 - 力量增强显示测试
 * 
 * 测试 getStrengthBoostForDisplay 返回正确的增强值和来源说明
 */

import { describe, it, expect } from 'vitest';
import { getStrengthBoostForDisplay } from '../domain/abilityResolver';
import type { SummonerWarsCore, BoardUnit } from '../domain/types';
import { CARD_IDS } from '../domain/ids';

function createTestCore(): SummonerWarsCore {
  return {
    board: Array(8).fill(null).map(() => Array(12).fill(null).map(() => ({ unit: null, structure: null }))),
    players: {
      '0': {
        faction: 'goblin',
        deck: [],
        hand: [],
        discard: [],
        magic: 0,
        summoner: null,
        moveCount: 0,
        attackCount: 0,
        hasAttackedEnemy: false,
        activeEvents: [],
      },
      '1': {
        faction: 'paladin',
        deck: [],
        hand: [],
        discard: [],
        magic: 0,
        summoner: null,
        moveCount: 0,
        attackCount: 0,
        hasAttackedEnemy: false,
        activeEvents: [],
      },
    },
    phase: 'summon',
    currentPlayer: '0',
    turnNumber: 1,
    selectedUnit: null,
    hostPlayerId: '0',
    hostStarted: true,
    selectedFactions: { '0': 'goblin', '1': 'paladin' },
    readyPlayers: {},
  };
}

function createTestUnit(overrides?: Partial<BoardUnit>): BoardUnit {
  return {
    instanceId: 'test-unit-1',
    owner: '0',
    position: { row: 4, col: 6 },
    damage: 0,
    boosts: 0,
    card: {
      id: 'test-card-1',
      name: '测试单位',
      faction: 'goblin',
      cardType: 'unit',
      unitClass: 'common',
      cost: 1,
      strength: 2,
      life: 3,
      move: 2,
      spriteIndex: 0,
    },
    ...overrides,
  };
}

describe('力量增强显示 - getStrengthBoostForDisplay', () => {
  it('无增强时返回 delta=0, sources=[]', () => {
    const core = createTestCore();
    const unit = createTestUnit();
    
    const result = getStrengthBoostForDisplay(unit, core);
    
    expect(result.delta).toBe(0);
    expect(result.sources).toEqual([]);
  });

  it('狱火铸剑：附加单位提供 +2 战力', () => {
    const core = createTestCore();
    const unit = createTestUnit({
      attachedCards: [{
        id: CARD_IDS.NECRO_HELLFIRE_BLADE,
        name: '狱火铸剑',
        faction: 'necromancer',
        cardType: 'event',
        eventType: 'common',
        cost: 1,
        spriteIndex: 0,
      }],
    });
    
    const result = getStrengthBoostForDisplay(unit, core);
    
    expect(result.delta).toBe(2);
    expect(result.sources).toContain('狱火铸剑 +2');
  });

  it('成群结队：激活事件卡时显示提示', () => {
    const core = createTestCore();
    const unit = createTestUnit({ position: { row: 4, col: 6 } });
    
    // 激活成群结队事件卡
    core.players['0'].activeEvents.push({
      id: CARD_IDS.GOBLIN_SWARM,
      name: '成群结队',
      faction: 'goblin',
      cardType: 'event',
      eventType: 'common',
      cost: 0,
      spriteIndex: 0,
    });
    
    const result = getStrengthBoostForDisplay(unit, core);
    
    // 成群结队不提供固定数值，只显示提示
    expect(result.delta).toBe(0);
    expect(result.sources).toContain('成群结队（攻击时生效）');
  });

  it('城塞精锐：相邻友方城塞单位提供 +1 战力', () => {
    const core = createTestCore();
    const unit = createTestUnit({
      position: { row: 4, col: 6 },
      card: {
        id: CARD_IDS.PALADIN_FORTRESS_ELITE,
        name: '城塞精锐',
        faction: 'paladin',
        cardType: 'unit',
        unitClass: 'common',
        cost: 2,
        strength: 2,
        life: 3,
        move: 2,
        abilities: ['fortress_elite'],
        spriteIndex: 0,
      },
    });
    
    // 添加相邻友方城塞单位
    core.board[4][5] = {
      unit: createTestUnit({
        instanceId: 'fortress-unit-1',
        position: { row: 4, col: 5 },
        card: {
          id: CARD_IDS.PALADIN_FORTRESS_GUARD,
          name: '城塞守卫',
          faction: 'paladin',
          cardType: 'unit',
          unitClass: 'common',
          cost: 1,
          strength: 1,
          life: 4,
          move: 1,
          isFortress: true,
          spriteIndex: 0,
        },
      }),
      structure: null,
    };
    
    const result = getStrengthBoostForDisplay(unit, core);
    
    expect(result.delta).toBe(1);
    expect(result.sources).toContain('城塞精锐 +1');
  });

  it('辉光射击：基于魔力值提供战力加成', () => {
    const core = createTestCore();
    core.players['0'].magic = 6; // 6魔力 -> floor(6/2) = 3战力
    
    const unit = createTestUnit({
      card: {
        id: CARD_IDS.PALADIN_RADIANT_ARCHER,
        name: '辉光射手',
        faction: 'paladin',
        cardType: 'unit',
        unitClass: 'common',
        cost: 2,
        strength: 1,
        life: 2,
        move: 2,
        abilities: ['radiant_shot'],
        spriteIndex: 0,
      },
    });
    
    const result = getStrengthBoostForDisplay(unit, core);
    
    expect(result.delta).toBe(3);
    expect(result.sources).toContain('辉光射击 +3');
  });

  it('多个来源叠加：狱火铸剑 + 成群结队', () => {
    const core = createTestCore();
    const unit = createTestUnit({
      position: { row: 4, col: 6 },
      attachedCards: [{
        id: CARD_IDS.NECRO_HELLFIRE_BLADE,
        name: '狱火铸剑',
        faction: 'necromancer',
        cardType: 'event',
        eventType: 'common',
        cost: 1,
        spriteIndex: 0,
      }],
    });
    
    // 激活成群结队事件卡
    core.players['0'].activeEvents.push({
      id: CARD_IDS.GOBLIN_SWARM,
      name: '成群结队',
      faction: 'goblin',
      cardType: 'event',
      eventType: 'common',
      cost: 0,
      spriteIndex: 0,
    });
    
    const result = getStrengthBoostForDisplay(unit, core);
    
    expect(result.delta).toBe(2); // +2 from hellfire, swarm doesn't add fixed value
    expect(result.sources).toHaveLength(2);
    expect(result.sources).toContain('狱火铸剑 +2');
    expect(result.sources).toContain('成群结队（攻击时生效）');
  });

  it('冰霜飞弹：相邻建筑提供 +1 战力', () => {
    const core = createTestCore();
    const unit = createTestUnit({
      position: { row: 4, col: 6 },
      card: {
        id: CARD_IDS.FROST_FROST_ARCHER,
        name: '冰霜射手',
        faction: 'frost',
        cardType: 'unit',
        unitClass: 'common',
        cost: 2,
        strength: 1,
        life: 2,
        move: 2,
        abilities: ['frost_bolt'],
        spriteIndex: 0,
      },
    });
    
    // 添加相邻建筑
    core.board[4][5] = {
      unit: null,
      structure: {
        cardId: 'structure-1',
        owner: '0',
        damage: 0,
        card: {
          id: 'structure-card-1',
          name: '测试建筑',
          faction: 'frost',
          cardType: 'structure',
          cost: 1,
          life: 3,
          spriteIndex: 0,
        },
      },
    };
    
    const result = getStrengthBoostForDisplay(unit, core);
    
    expect(result.delta).toBe(1);
    expect(result.sources).toContain('冰霜飞弹 +1');
  });

  it('圣洁审判：友方士兵获得 +1 战力', () => {
    const core = createTestCore();
    const unit = createTestUnit({
      owner: '0',
      card: {
        id: 'paladin-knight-1',
        name: '圣堂骑士',
        faction: 'paladin',
        cardType: 'unit',
        unitClass: 'common', // 士兵
        cost: 2,
        strength: 2,
        life: 3,
        move: 2,
        spriteIndex: 0,
      },
    });
    
    // 激活圣洁审判事件卡（有充能）
    core.players['0'].activeEvents.push({
      id: CARD_IDS.PALADIN_HOLY_JUDGMENT,
      name: '圣洁审判',
      faction: 'paladin',
      cardType: 'event',
      eventType: 'common',
      cost: 0,
      charges: 2,
      spriteIndex: 0,
    });
    
    const result = getStrengthBoostForDisplay(unit, core);
    
    expect(result.delta).toBe(1);
    expect(result.sources).toContain('圣洁审判 +1');
  });
});
