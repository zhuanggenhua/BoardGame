/**
 * 教皇税（Tithes）被动重掷校验测试
 * 验证 isPassiveActionUsable 在各种场景下的正确性
 */

import { describe, it, expect } from 'vitest';
import { isPassiveActionUsable } from '../domain/passiveAbility';
import { PALADIN_TITHES_BASE } from '../heroes/paladin/abilities';
import { RESOURCE_IDS } from '../domain/resources';
import type { DiceThroneCore, Die, HeroState } from '../domain/types';
import { PALADIN_DICE_FACE_IDS as FACES } from '../domain/ids';

// ============================================================================
// 测试工具
// ============================================================================

function createDie(id: number, value: number, isKept = false): Die {
    const faceMap: Record<number, string> = {
        1: FACES.SWORD, 2: FACES.SWORD,
        3: FACES.HELM, 4: FACES.HELM,
        5: FACES.HEART, 6: FACES.PRAY,
    };
    return {
        id, definitionId: 'paladin-dice', value,
        symbol: faceMap[value] as any,
        symbols: [faceMap[value]],
        isKept,
    };
}

function createState(overrides: {
    cp?: number;
    rollCount?: number;
    rollDiceCount?: number;
    activePlayerId?: string;
    dice?: Die[];
    pendingAttack?: any;
}): DiceThroneCore {
    const cp = overrides.cp ?? 5;
    const player: HeroState = {
        id: '0', characterId: 'paladin',
        resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: cp },
        hand: [], deck: [], discard: [],
        statusEffects: {}, tokens: {}, tokenStackLimits: {},
        damageShields: [], abilities: [], abilityLevels: {},
        upgradeCardByAbilityId: {},
        passiveAbilities: [PALADIN_TITHES_BASE],
    };
    const opponent: HeroState = {
        id: '1', characterId: 'monk',
        resources: { [RESOURCE_IDS.HP]: 50, [RESOURCE_IDS.CP]: 5 },
        hand: [], deck: [], discard: [],
        statusEffects: {}, tokens: {}, tokenStackLimits: {},
        damageShields: [], abilities: [], abilityLevels: {},
        upgradeCardByAbilityId: {},
    };

    return {
        players: { '0': player, '1': opponent },
        selectedCharacters: { '0': 'paladin', '1': 'monk' },
        readyPlayers: { '0': true, '1': true },
        hostPlayerId: '0', hostStarted: true,
        dice: overrides.dice ?? [1, 2, 3, 4, 5].map((v, i) => createDie(i, v)),
        rollCount: overrides.rollCount ?? 1,
        rollLimit: 3,
        rollDiceCount: overrides.rollDiceCount ?? 5,
        rollConfirmed: false,
        activePlayerId: overrides.activePlayerId ?? '0',
        startingPlayerId: '0',
        turnNumber: 1,
        pendingAttack: overrides.pendingAttack ?? null,
        tokenDefinitions: [],
    };
}

// ============================================================================
// 测试套件
// ============================================================================

describe('教皇税被动重掷校验', () => {
    // rerollDie 是 actions[0]
    const REROLL_INDEX = 0;
    // drawCard 是 actions[1]
    const DRAW_INDEX = 1;

    describe('进攻阶段', () => {
        it('已投掷+有CP+有未锁定骰子 → 可用', () => {
            const state = createState({ cp: 5, rollCount: 1 });
            expect(isPassiveActionUsable(state, '0', 'tithes', REROLL_INDEX, 'offensiveRoll')).toBe(true);
        });

        it('已投掷+CP不足 → 不可用', () => {
            const state = createState({ cp: 0, rollCount: 1 });
            expect(isPassiveActionUsable(state, '0', 'tithes', REROLL_INDEX, 'offensiveRoll')).toBe(false);
        });

        it('未投掷(rollCount=0) → 不可用', () => {
            const state = createState({ cp: 5, rollCount: 0 });
            expect(isPassiveActionUsable(state, '0', 'tithes', REROLL_INDEX, 'offensiveRoll')).toBe(false);
        });

        it('所有骰子都锁定 → 不可用', () => {
            const dice = [1, 2, 3, 4, 5].map((v, i) => createDie(i, v, true));
            const state = createState({ cp: 5, rollCount: 1, dice });
            expect(isPassiveActionUsable(state, '0', 'tithes', REROLL_INDEX, 'offensiveRoll')).toBe(false);
        });

        it('部分骰子锁定但有未锁定的 → 可用', () => {
            const dice = [
                createDie(0, 1, true),
                createDie(1, 2, true),
                createDie(2, 3, false),  // 未锁定
                createDie(3, 4, true),
                createDie(4, 5, true),
            ];
            const state = createState({ cp: 5, rollCount: 1, dice });
            expect(isPassiveActionUsable(state, '0', 'tithes', REROLL_INDEX, 'offensiveRoll')).toBe(true);
        });

        it('非当前玩家 → 不可用', () => {
            const state = createState({ cp: 5, rollCount: 1, activePlayerId: '1' });
            expect(isPassiveActionUsable(state, '0', 'tithes', REROLL_INDEX, 'offensiveRoll')).toBe(false);
        });

        it('抽牌动作在进攻阶段 → 可用（timing=anytime）', () => {
            const state = createState({ cp: 5, rollCount: 1 });
            expect(isPassiveActionUsable(state, '0', 'tithes', DRAW_INDEX, 'offensiveRoll')).toBe(true);
        });
    });

    describe('防御阶段', () => {
        it('防御方已投掷+有CP+有未锁定骰子 → 可用', () => {
            // 防御阶段：3颗活跃骰子，前3颗未锁定
            const dice = [
                createDie(0, 1, false),
                createDie(1, 3, false),
                createDie(2, 5, false),
                createDie(3, 2, true),  // rollDiceCount=3 之外
                createDie(4, 4, true),
            ];
            const state = createState({
                cp: 5, rollCount: 1, rollDiceCount: 3, dice,
                activePlayerId: '1',  // 进攻方是 '1'
                pendingAttack: { defenderId: '0', attackerId: '1', isDefendable: true, defenseAbilityId: 'holy-defense' },
            });
            expect(isPassiveActionUsable(state, '0', 'tithes', REROLL_INDEX, 'defensiveRoll')).toBe(true);
        });

        it('防御阶段未投掷(rollCount=0) → 不可用', () => {
            const dice = [
                createDie(0, 1, false),
                createDie(1, 3, false),
                createDie(2, 5, false),
                createDie(3, 2, true),
                createDie(4, 4, true),
            ];
            const state = createState({
                cp: 5, rollCount: 0, rollDiceCount: 3, dice,
                activePlayerId: '1',
                pendingAttack: { defenderId: '0', attackerId: '1', isDefendable: true, defenseAbilityId: 'holy-defense' },
            });
            expect(isPassiveActionUsable(state, '0', 'tithes', REROLL_INDEX, 'defensiveRoll')).toBe(false);
        });

        it('进攻方不能在防御阶段使用重掷 → 不可用', () => {
            const state = createState({
                cp: 5, rollCount: 1, rollDiceCount: 3,
                activePlayerId: '1',
                pendingAttack: { defenderId: '0', attackerId: '1', isDefendable: true, defenseAbilityId: 'holy-defense' },
            });
            // '1' 是进攻方，不是 rollerId
            expect(isPassiveActionUsable(state, '1', 'tithes', REROLL_INDEX, 'defensiveRoll')).toBe(false);
        });

        it('rollDiceCount=0 时所有骰子都是 isKept → 不可用', () => {
            // 防御阶段刚进入，还没选技能，rollDiceCount=0
            const dice = [1, 2, 3, 4, 5].map((v, i) => createDie(i, v, true));
            const state = createState({
                cp: 5, rollCount: 0, rollDiceCount: 0, dice,
                activePlayerId: '1',
                pendingAttack: { defenderId: '0', attackerId: '1', isDefendable: true },
            });
            expect(isPassiveActionUsable(state, '0', 'tithes', REROLL_INDEX, 'defensiveRoll')).toBe(false);
        });
    });

    describe('非投掷阶段', () => {
        it('主要阶段 → 重掷不可用', () => {
            const state = createState({ cp: 5, rollCount: 0 });
            expect(isPassiveActionUsable(state, '0', 'tithes', REROLL_INDEX, 'main1')).toBe(false);
        });

        it('主要阶段 → 抽牌可用（timing=anytime）', () => {
            const state = createState({ cp: 5, rollCount: 0 });
            expect(isPassiveActionUsable(state, '0', 'tithes', DRAW_INDEX, 'main1')).toBe(true);
        });
    });
});
