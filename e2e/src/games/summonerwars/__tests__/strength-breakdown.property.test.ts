/**
 * 召唤师战争 - 战力 Breakdown 属性测试
 *
 * Feature: unified-damage-buff-system
 *
 * **Validates: Requirements 4.1, 4.2, 4.4, 4.5**
 *
 * Property 6: 召唤师战争战力 Breakdown 完整性
 * Property 7: 召唤师战争 DamageSourceResolver 完整性
 * Property 8: 召唤师战争日志向后兼容
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateEffectiveStrength } from '../domain/abilityResolver';
import { abilityRegistry } from '../domain/abilities';
import { swDamageSourceResolver } from '../actionLog';
import { CARD_IDS } from '../domain/ids';
import type {
  SummonerWarsCore,
  BoardUnit,
  BoardCell,
  PlayerState,
  PlayerId,
  UnitCard,
  EventCard,
} from '../domain/types';
import { BOARD_ROWS, BOARD_COLS } from '../config/board';

// ============================================================================
// 辅助函数：构造最小化测试状态
// ============================================================================

/** 创建空棋盘 */
function createEmptyBoard(): BoardCell[][] {
  return Array.from({ length: BOARD_ROWS }, () =>
    Array.from({ length: BOARD_COLS }, () => ({})),
  );
}

/** 创建默认玩家状态 */
function createDefaultPlayer(id: PlayerId, magic = 0): PlayerState {
  return {
    id,
    magic,
    hand: [],
    deck: [],
    discard: [],
    activeEvents: [],
    summonerId: `summoner-${id}`,
    moveCount: 0,
    attackCount: 0,
    hasAttackedEnemy: false,
  };
}

/** 创建最小化游戏状态 */
function createMinimalCore(overrides?: Partial<SummonerWarsCore>): SummonerWarsCore {
  return {
    board: createEmptyBoard(),
    players: {
      '0': createDefaultPlayer('0'),
      '1': createDefaultPlayer('1'),
    },
    phase: 'attack',
    currentPlayer: '0',
    turnNumber: 1,
    selectedFactions: { '0': 'necromancer', '1': 'necromancer' },
    readyPlayers: { '0': true, '1': true },
    hostPlayerId: '0',
    hostStarted: true,
    ...overrides,
  } as SummonerWarsCore;
}

/** 创建基础单位卡 */
function makeUnitCard(overrides?: Partial<UnitCard>): UnitCard {
  return {
    id: 'test-unit',
    cardType: 'unit',
    name: '测试单位',
    unitClass: 'common',
    faction: 'necromancer',
    strength: 2,
    life: 3,
    cost: 1,
    attackType: 'melee',
    attackRange: 1,
    deckSymbols: [],
    ...overrides,
  };
}

/** 创建棋盘单位 */
function makeUnit(overrides?: Partial<BoardUnit>): BoardUnit {
  return {
    instanceId: 'test-unit#1',
    cardId: 'test-unit',
    card: makeUnitCard(),
    owner: '0' as PlayerId,
    position: { row: 4, col: 3 },
    damage: 0,
    boosts: 0,
    hasMoved: false,
    hasAttacked: false,
    ...overrides,
  };
}

/** 放置单位到棋盘 */
function placeUnit(core: SummonerWarsCore, unit: BoardUnit): void {
  core.board[unit.position.row][unit.position.col].unit = unit;
}

// ============================================================================
// 生成器
// ============================================================================

/** 基础战力（1~6，召唤师战争单位战力范围） */
const arbBaseStrength = () => fc.integer({ min: 0, max: 6 });

/** boosts 值（0~3，冲锋加成范围） */
const arbBoosts = () => fc.integer({ min: 0, max: 3 });

/** 魔力值（0~15） */
const arbMagic = () => fc.integer({ min: 0, max: 15 });

// ============================================================================
// Property 6: 召唤师战争战力 Breakdown 完整性
// ============================================================================

describe('Property 6: 召唤师战争战力 Breakdown 完整性', () => {

  /**
   * **Validates: Requirements 4.1, 4.2**
   *
   * 核心不变量：baseStrength + sum(modifiers.value) === finalStrength（Math.max(0,...) 之前）
   * 即 modifiers 完整记录了所有 buff 贡献。
   */
  it('baseStrength + sum(modifiers.value) 等于 finalStrength（无负值截断时）', () => {
    fc.assert(
      fc.property(
        arbBaseStrength(),
        arbBoosts(),
        fc.boolean(), // 是否附加狱火铸剑
        (baseStrength, boosts, hasHellfireBlade) => {
          const core = createMinimalCore();
          const card = makeUnitCard({
            strength: baseStrength,
            abilities: boosts > 0 ? ['charge'] : [],
          });
          const attachedCards: EventCard[] = hasHellfireBlade
            ? [{
              id: CARD_IDS.NECRO_HELLFIRE_BLADE,
              cardType: 'event',
              name: '狱火铸剑',
              faction: 'necromancer',
              cost: 1,
              playPhase: 'any',
              effect: '',
              deckSymbols: [],
            }]
            : [];

          const unit = makeUnit({
            card,
            boosts,
            attachedCards: attachedCards.length > 0 ? attachedCards : undefined,
          });
          placeUnit(core, unit);

          const result = calculateEffectiveStrength(unit, core);

          // 核心属性：baseStrength + sum(modifiers) = finalStrength（在 Math.max(0,...) 之前）
          const modSum = result.modifiers.reduce((sum, m) => sum + m.value, 0);
          const rawStrength = result.baseStrength + modSum;
          expect(result.finalStrength).toBe(Math.max(0, rawStrength));

          // baseStrength 应等于卡牌面板值
          expect(result.baseStrength).toBe(baseStrength);
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 4.2**
   *
   * 狱火铸剑附加时，modifiers 应包含来源为 NECRO_HELLFIRE_BLADE 的 +2 修正。
   */
  it('狱火铸剑附加时 modifiers 包含正确的来源和贡献值', () => {
    fc.assert(
      fc.property(
        arbBaseStrength(),
        (baseStrength) => {
          const core = createMinimalCore();
          const card = makeUnitCard({ strength: baseStrength });
          const unit = makeUnit({
            card,
            attachedCards: [{
              id: CARD_IDS.NECRO_HELLFIRE_BLADE,
              cardType: 'event',
              name: '狱火铸剑',
              faction: 'necromancer',
              cost: 1,
              playPhase: 'any',
              effect: '',
              deckSymbols: [],
            }],
          });
          placeUnit(core, unit);

          const result = calculateEffectiveStrength(unit, core);

          // 应有狱火铸剑修正
          const hellfireMod = result.modifiers.find(m => m.source === CARD_IDS.NECRO_HELLFIRE_BLADE);
          expect(hellfireMod).toBeDefined();
          expect(hellfireMod!.value).toBe(2);
          expect(hellfireMod!.sourceName).toBe('狱火铸剑');

          // 总和一致性
          const modSum = result.modifiers.reduce((sum, m) => sum + m.value, 0);
          expect(result.finalStrength).toBe(Math.max(0, baseStrength + modSum));
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 4.2**
   *
   * 冲锋加成：boosts > 0 时 modifiers 包含 charge 来源。
   */
  it('冲锋加成时 modifiers 包含 charge 来源和正确贡献值', () => {
    fc.assert(
      fc.property(
        arbBaseStrength(),
        fc.integer({ min: 1, max: 3 }), // boosts > 0
        (baseStrength, boosts) => {
          const core = createMinimalCore();
          const card = makeUnitCard({
            strength: baseStrength,
            abilities: ['charge'],
          });
          const unit = makeUnit({ card, boosts });
          placeUnit(core, unit);

          const result = calculateEffectiveStrength(unit, core);

          const chargeMod = result.modifiers.find(m => m.source === 'charge');
          expect(chargeMod).toBeDefined();
          expect(chargeMod!.value).toBe(boosts);

          // 总和一致性
          const modSum = result.modifiers.reduce((sum, m) => sum + m.value, 0);
          expect(result.finalStrength).toBe(Math.max(0, baseStrength + modSum));
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 4.2**
   *
   * 圣洁审判加成：common 单位 + 友方有 holy-judgment 事件卡时 +1 战力。
   */
  it('圣洁审判加成时 modifiers 包含正确来源', () => {
    fc.assert(
      fc.property(
        arbBaseStrength(),
        (baseStrength) => {
          const core = createMinimalCore();
          // 添加圣洁审判事件卡到玩家0的主动事件区
          core.players['0'].activeEvents = [{
            id: CARD_IDS.PALADIN_HOLY_JUDGMENT,
            cardType: 'event',
            name: '圣洁审判',
            faction: 'paladin',
            cost: 1,
            playPhase: 'any',
            effect: '',
            isActive: true,
            charges: 1,
            deckSymbols: [],
          }];

          const card = makeUnitCard({
            strength: baseStrength,
            unitClass: 'common', // 圣洁审判只对士兵生效
          });
          const unit = makeUnit({ card });
          placeUnit(core, unit);

          const result = calculateEffectiveStrength(unit, core);

          const holyMod = result.modifiers.find(m => m.source === CARD_IDS.PALADIN_HOLY_JUDGMENT);
          expect(holyMod).toBeDefined();
          expect(holyMod!.value).toBe(1);

          // 总和一致性
          const modSum = result.modifiers.reduce((sum, m) => sum + m.value, 0);
          expect(result.finalStrength).toBe(Math.max(0, baseStrength + modSum));
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 4.2**
   *
   * 辉光射击加成：每2点魔力+1战力。
   */
  it('辉光射击加成与魔力值正确关联', () => {
    fc.assert(
      fc.property(
        arbBaseStrength(),
        arbMagic(),
        (baseStrength, magic) => {
          const core = createMinimalCore();
          core.players['0'].magic = magic;

          const card = makeUnitCard({
            strength: baseStrength,
            abilities: ['radiant_shot'],
            faction: 'paladin',
          });
          const unit = makeUnit({ card });
          placeUnit(core, unit);

          const result = calculateEffectiveStrength(unit, core);

          const expectedBonus = Math.floor(magic / 2);
          if (expectedBonus > 0) {
            const radiantMod = result.modifiers.find(m => m.source === 'radiant_shot');
            expect(radiantMod).toBeDefined();
            expect(radiantMod!.value).toBe(expectedBonus);
          }

          // 总和一致性
          const modSum = result.modifiers.reduce((sum, m) => sum + m.value, 0);
          expect(result.finalStrength).toBe(Math.max(0, baseStrength + modSum));
        },
      ),
      { numRuns: 200 },
    );
  });
});


// ============================================================================
// Property 7: 召唤师战争 DamageSourceResolver 完整性
// ============================================================================

describe('Property 7: 召唤师战争 DamageSourceResolver 完整性', () => {

  /**
   * **Validates: Requirements 4.4**
   *
   * 所有已注册的能力 ID 都能被 swDamageSourceResolver 解析为非 null 的 SourceLabel。
   */
  it('所有已注册能力 ID 解析为非 null SourceLabel', () => {
    const registeredIds = abilityRegistry.getRegisteredIds();

    fc.assert(
      fc.property(
        fc.constantFrom(...Array.from(registeredIds)),
        (abilityId) => {
          const result = swDamageSourceResolver.resolve(abilityId);
          // 能力注册表中有 name 的技能应能被解析
          const ability = abilityRegistry.get(abilityId);
          if (ability?.name) {
            expect(result).not.toBeNull();
            expect(result!.label).toBeTruthy();
          }
        },
      ),
      { numRuns: Math.min(200, registeredIds.size * 3) },
    );
  });

  /**
   * **Validates: Requirements 4.4**
   *
   * 所有已知的 reason 字符串都能被 swDamageSourceResolver 解析为非 null 的 SourceLabel。
   */
  it('所有已知 reason 字符串解析为非 null SourceLabel', () => {
    const knownReasons = [
      'curse', 'entangle', 'trample', 'ice_shards', 'ice_ram',
      'blood_rune', 'blood_summon', 'revive_undead', 'inaction',
      'stun', 'stun_passthrough', 'holy_protection',
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...knownReasons),
        (reason) => {
          const result = swDamageSourceResolver.resolve(reason);
          expect(result).not.toBeNull();
          expect(result!.label).toBeTruthy();
          // reason 映射应为 i18n key
          expect(result!.isI18n).toBe(true);
        },
      ),
      { numRuns: knownReasons.length * 5 },
    );
  });

  /**
   * **Validates: Requirements 4.4**
   *
   * calculateEffectiveStrength 中使用的所有 buff 来源 ID 都能被 resolver 解析。
   * 覆盖事件卡 ID 和能力 ID 两类来源。
   */
  it('所有 buff 来源 ID（事件卡 + 能力）都能被 resolver 解析', () => {
    // calculateEffectiveStrength 中使用的所有来源 ID
    const buffSourceIds = [
      CARD_IDS.NECRO_HELLFIRE_BLADE,   // 狱火铸剑
      CARD_IDS.TRICKSTER_HYPNOTIC_LURE, // 催眠引诱
      CARD_IDS.GOBLIN_SWARM,            // 成群结队
      CARD_IDS.PALADIN_HOLY_JUDGMENT,   // 圣洁审判
      'charge',                          // 冲锋
      'fortress_elite',                  // 城塞精锐
      'radiant_shot',                    // 辉光射击
      'frost_bolt',                      // 冰霜飞弹
      'greater_frost_bolt',              // 高阶冰霜飞弹
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...buffSourceIds),
        (sourceId) => {
          const result = swDamageSourceResolver.resolve(sourceId);
          expect(result).not.toBeNull();
          expect(result!.label).toBeTruthy();
        },
      ),
      { numRuns: buffSourceIds.length * 5 },
    );
  });
});

// ============================================================================
// Property 8: 召唤师战争日志向后兼容
// ============================================================================

describe('Property 8: 召唤师战争日志向后兼容', () => {

  /**
   * **Validates: Requirements 4.5**
   *
   * 无战力 buff 的单位，calculateEffectiveStrength 返回空 modifiers 数组，
   * 确保 ActionLog 不会生成 breakdown tooltip。
   */
  it('无 buff 单位的 modifiers 为空数组', () => {
    fc.assert(
      fc.property(
        arbBaseStrength(),
        (baseStrength) => {
          const core = createMinimalCore();
          const card = makeUnitCard({ strength: baseStrength });
          const unit = makeUnit({ card, boosts: 0, attachedCards: undefined });
          placeUnit(core, unit);

          const result = calculateEffectiveStrength(unit, core);

          // 无 buff 时 modifiers 应为空
          expect(result.modifiers).toEqual([]);
          // finalStrength 应等于 baseStrength
          expect(result.finalStrength).toBe(Math.max(0, baseStrength));
          expect(result.baseStrength).toBe(baseStrength);
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 4.5**
   *
   * 无 buff 时 baseStrength === finalStrength，确保日志显示普通数值。
   */
  it('无 buff 时 baseStrength 等于 finalStrength', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 6 }),
        (baseStrength) => {
          const core = createMinimalCore();
          const card = makeUnitCard({ strength: baseStrength });
          const unit = makeUnit({ card });
          placeUnit(core, unit);

          const result = calculateEffectiveStrength(unit, core);

          // 无 buff 时两者相等（baseStrength >= 0 时不会被截断）
          if (baseStrength >= 0) {
            expect(result.finalStrength).toBe(result.baseStrength);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 4.5**
   *
   * 有 buff 时 modifiers 非空，确保 ActionLog 会生成 breakdown tooltip。
   * 无 buff 时 modifiers 为空，确保 ActionLog 保持原格式。
   * 这是向后兼容的关键判定条件。
   */
  it('modifiers 非空当且仅当存在实际 buff', () => {
    fc.assert(
      fc.property(
        arbBaseStrength(),
        fc.boolean(), // 是否有狱火铸剑
        (baseStrength, hasHellfireBlade) => {
          const core = createMinimalCore();
          const card = makeUnitCard({ strength: baseStrength });
          const attachedCards: EventCard[] = hasHellfireBlade
            ? [{
              id: CARD_IDS.NECRO_HELLFIRE_BLADE,
              cardType: 'event',
              name: '狱火铸剑',
              faction: 'necromancer',
              cost: 1,
              playPhase: 'any',
              effect: '',
              deckSymbols: [],
            }]
            : [];

          const unit = makeUnit({
            card,
            attachedCards: attachedCards.length > 0 ? attachedCards : undefined,
          });
          placeUnit(core, unit);

          const result = calculateEffectiveStrength(unit, core);

          if (hasHellfireBlade) {
            // 有 buff → modifiers 非空 → ActionLog 使用 breakdown
            expect(result.modifiers.length).toBeGreaterThan(0);
          } else {
            // 无 buff → modifiers 为空 → ActionLog 保持原格式
            expect(result.modifiers).toEqual([]);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
