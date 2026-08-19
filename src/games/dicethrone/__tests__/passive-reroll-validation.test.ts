/**
 * 教皇税（Tithes）被动重掷校验测试
 * 验证 isPassiveActionUsable 在各种场景下的正确性
 */

import { describe, it, expect } from 'vitest';
import { isPassiveActionUsable } from '../domain/passiveAbility';
import { PALADIN_TITHES_BASE } from '../heroes/paladin/abilities';
import { ZHANSHUJIA_PASSIVE_ABILITIES } from '../heroes/zhanshujia/tokens';
import { RESOURCE_IDS } from '../domain/resources';
import { TOKEN_IDS } from '../domain/ids';
import type { DiceThroneCore, DiceThroneRollContextKind, Die, HeroState } from '../domain/types';
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

function giveTacticalAdvantageReroll(
    state: DiceThroneCore,
    playerId: string,
): void {
    state.selectedCharacters = { ...state.selectedCharacters, [playerId]: 'zhanshujia' };
    state.players[playerId] = {
        ...state.players[playerId],
        characterId: 'zhanshujia',
        passiveAbilities: ZHANSHUJIA_PASSIVE_ABILITIES,
        tokens: {
            ...state.players[playerId].tokens,
            [TOKEN_IDS.TACTICAL_ADVANTAGE]: 1,
        },
    };
}

function createTacticalAdvantageCurrentRollState(
    kind: DiceThroneRollContextKind,
    options: {
        allowPassiveReroll?: boolean;
        dice?: Die[];
        ownerPlayerId?: string;
        tacticalPlayerId?: string;
    } = {},
): DiceThroneCore {
    const state = createState({
        cp: 5,
        rollCount: 0,
        rollDiceCount: 0,
        activePlayerId: '0',
        dice: [],
    });
    const tacticalPlayerId = options.tacticalPlayerId ?? '0';
    const ownerPlayerId = options.ownerPlayerId ?? '0';
    giveTacticalAdvantageReroll(state, tacticalPlayerId);

    const settlementMode = kind === 'compare'
        ? 'compare'
        : kind === 'evasion'
            ? 'tokenNegate'
            : kind === 'targeting'
                ? 'targetPlayer'
                : kind === 'bonus'
                    ? 'damage'
                    : kind === 'offensive' || kind === 'defensive'
                        ? 'selectAttack'
                        : 'none';

    state.currentRollContext = {
        id: `${kind}:passive-reroll-contract`,
        kind,
        ownerPlayerId,
        targetPlayerId: ownerPlayerId === '0' ? '1' : '0',
        sourceAbilityId: `${kind}-source`,
        phase: kind === 'offensive'
            ? 'offensiveRoll'
            : kind === 'defensive'
                ? 'defensiveRoll'
                : kind === 'targeting'
                    ? 'targetingRoll'
                    : undefined,
        dice: options.dice ?? [{ ...createDie(0, 3), ownerId: ownerPlayerId, isKept: false }],
        status: 'open',
        policy: {
            modifiableBy: 'any',
            rerollableBy: 'any',
            allowPassiveReroll: options.allowPassiveReroll ?? true,
            allowDiceCardTargeting: true,
            ultimateLocked: false,
            blocksPhaseFlow: true,
        },
        settlement: { mode: settlementMode },
        display: { surface: 'diceTray', replayOnly: false },
    };

    return state;
}

function createConfirmedMainRollInterferenceState(phase: 'offensiveRoll' | 'defensiveRoll'): {
    state: DiceThroneCore;
    actorId: string;
} {
    const isDefense = phase === 'defensiveRoll';
    const actorId = isDefense ? '0' : '1';
    const state = createState({
        cp: 5,
        rollCount: 1,
        rollDiceCount: isDefense ? 3 : 5,
        activePlayerId: '0',
        pendingAttack: isDefense
            ? {
                attackerId: '0',
                defenderId: '1',
                isDefendable: true,
                defenseAbilityId: 'duel',
            }
            : null,
    });
    state.rollConfirmed = true;
    giveTacticalAdvantageReroll(state, actorId);
    return { state, actorId };
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
        it('已投掷+有CP+当前骰区有骰子 → 可用', () => {
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

        it('所有骰子都锁定 → 仍可用指定重掷', () => {
            const dice = [1, 2, 3, 4, 5].map((v, i) => createDie(i, v, true));
            const state = createState({ cp: 5, rollCount: 1, dice });
            expect(isPassiveActionUsable(state, '0', 'tithes', REROLL_INDEX, 'offensiveRoll')).toBe(true);
        });

        it('部分骰子锁定 → 可用指定重掷', () => {
            const dice = [
                createDie(0, 1, true),
                createDie(1, 2, true),
                createDie(2, 3, false),
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
        it('防御方已投掷+有CP+当前防御骰区有骰子 → 可用', () => {
            // 防御阶段：3颗活跃骰子，锁定状态不影响指定重掷动作的可用性。
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

        it('进攻方在防御骰确认后的响应窗口可用战术优势重掷对方防御骰', () => {
            const state = createState({
                cp: 5,
                rollCount: 1,
                rollDiceCount: 3,
                activePlayerId: '0',
                pendingAttack: {
                    defenderId: '1',
                    attackerId: '0',
                    isDefendable: true,
                    defenseAbilityId: 'duel',
                },
            });
            state.rollConfirmed = true;
            state.players['0'] = {
                ...state.players['0'],
                characterId: 'zhanshujia',
                passiveAbilities: ZHANSHUJIA_PASSIVE_ABILITIES,
                tokens: { [TOKEN_IDS.TACTICAL_ADVANTAGE]: 1 },
            };

            expect(isPassiveActionUsable(
                state,
                '0',
                'zhanshujia-tactical-advantage',
                1,
                'defensiveRoll',
            )).toBe(false);
            expect(isPassiveActionUsable(
                state,
                '0',
                'zhanshujia-tactical-advantage',
                1,
                'defensiveRoll',
                { responseWindowType: 'afterRollConfirmed' },
            )).toBe(true);
        });

        it('rollDiceCount=0 时当前骰区为空 → 不可用', () => {
            // 防御阶段刚进入，还没选技能，主骰状态里即使有历史骰，也没有当前防御骰区。
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

describe('战术优势当前骰区重投矩阵', () => {
    const TACTICAL_ADVANTAGE_REROLL_INDEX = 1;

    it.each([
        'offensive',
        'defensive',
        'targeting',
        'effect',
        'bonus',
        'evasion',
        'compare',
    ] as const)('当前 %s 骰区允许被动重投时，战术优势可用', (kind) => {
        const state = createTacticalAdvantageCurrentRollState(kind);

        expect(isPassiveActionUsable(
            state,
            '0',
            'zhanshujia-tactical-advantage',
            TACTICAL_ADVANTAGE_REROLL_INDEX,
            'main1',
        )).toBe(true);
    });

    it.each([
        'offensive',
        'defensive',
        'targeting',
        'effect',
        'bonus',
        'evasion',
        'compare',
    ] as const)('当前 %s 骰区允许任意介入时，非骰主的战术优势也可重投', (kind) => {
        const state = createTacticalAdvantageCurrentRollState(kind, {
            ownerPlayerId: '1',
            tacticalPlayerId: '0',
        });

        expect(isPassiveActionUsable(
            state,
            '0',
            'zhanshujia-tactical-advantage',
            TACTICAL_ADVANTAGE_REROLL_INDEX,
            'main1',
        )).toBe(true);
    });

    it.each([
        ['offensiveRoll', '主进攻骰确认后对手响应窗口'],
        ['defensiveRoll', '主防御骰确认后攻击方响应窗口'],
    ] as const)('%s：%s 可用战术优势介入当前骰区', (phase) => {
        const { state, actorId } = createConfirmedMainRollInterferenceState(phase);

        expect(isPassiveActionUsable(
            state,
            actorId,
            'zhanshujia-tactical-advantage',
            TACTICAL_ADVANTAGE_REROLL_INDEX,
            phase,
        )).toBe(false);
        expect(isPassiveActionUsable(
            state,
            actorId,
            'zhanshujia-tactical-advantage',
            TACTICAL_ADVANTAGE_REROLL_INDEX,
            phase,
            { responseWindowType: 'afterRollConfirmed' },
        )).toBe(true);
    });

    it.each([
        ['offensiveRoll', '主进攻骰确认后对手响应窗口'],
        ['defensiveRoll', '主防御骰确认后攻击方响应窗口'],
    ] as const)('%s：%s 不应把教皇税变成对手骰干预', (phase) => {
        const { state, actorId } = createConfirmedMainRollInterferenceState(phase);
        state.selectedCharacters = { ...state.selectedCharacters, [actorId]: 'paladin' };
        state.players[actorId] = {
            ...state.players[actorId],
            characterId: 'paladin',
            passiveAbilities: [PALADIN_TITHES_BASE],
            tokens: {},
        };

        expect(isPassiveActionUsable(
            state,
            actorId,
            'tithes',
            0,
            phase,
            { responseWindowType: 'afterRollConfirmed' },
        )).toBe(false);
    });

    it('当前骰区禁止被动重投时，战术优势不可用', () => {
        const state = createTacticalAdvantageCurrentRollState('bonus', {
            allowPassiveReroll: false,
        });

        expect(isPassiveActionUsable(
            state,
            '0',
            'zhanshujia-tactical-advantage',
            TACTICAL_ADVANTAGE_REROLL_INDEX,
            'main1',
        )).toBe(false);
    });

    it('当前骰区只有锁定骰时，战术优势仍可指定重掷', () => {
        const state = createTacticalAdvantageCurrentRollState('compare', {
            dice: [{ ...createDie(0, 3), ownerId: '0', isKept: true }],
        });

        expect(isPassiveActionUsable(
            state,
            '0',
            'zhanshujia-tactical-advantage',
            TACTICAL_ADVANTAGE_REROLL_INDEX,
            'main1',
        )).toBe(true);
    });

    it('当前骰区禁止骰牌介入时，确认后响应窗口也不能绕过策略重投', () => {
        const state = createTacticalAdvantageCurrentRollState('offensive', {
            ownerPlayerId: '1',
            tacticalPlayerId: '0',
        });
        state.currentRollContext = state.currentRollContext && {
            ...state.currentRollContext,
            status: 'settling',
            policy: {
                ...state.currentRollContext.policy,
                rerollableBy: 'owner',
                allowDiceCardTargeting: false,
            },
        };

        expect(isPassiveActionUsable(
            state,
            '0',
            'zhanshujia-tactical-advantage',
            TACTICAL_ADVANTAGE_REROLL_INDEX,
            'offensiveRoll',
            { responseWindowType: 'afterRollConfirmed' },
        )).toBe(false);
    });
});
