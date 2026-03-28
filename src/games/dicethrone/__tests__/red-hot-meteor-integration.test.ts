import { describe, it, expect } from 'vitest';
import { createDamageCalculation } from '../../../engine/primitives/damageCalculation';
import type { DiceThroneCore } from '../domain/core-types';
import { validateCommand } from '../domain/commandValidation';
import { checkPlayCard } from '../domain/rules';
import type { DiceThroneEvent } from '../domain/types';
import { PYROMANCER_CARDS } from '../heroes/pyromancer/cards';
import { reduce } from '../domain/reducer';
import { createInitializedState, fixedRandom } from './test-utils';

const redHotCard = PYROMANCER_CARDS.find(c => c.id === 'card-red-hot')!;

const makeRuleCheckCore = (overrides: Partial<DiceThroneCore> = {}): DiceThroneCore => ({
    activePlayerId: '0',
    turnNumber: 1,
    turnPhase: 'offensiveRoll',
    dice: [1, 2, 3, 4, 5] as any,
    rollCount: 1,
    rollConfirmed: true,
    rollsRemaining: 0,
    pendingAttack: null,
    pendingInteraction: null,
    lastResolvedAttackDamage: null as any,
    players: {
        '0': {
            heroId: 'pyromancer',
            health: 50,
            resources: { cp: 10 },
            hand: [redHotCard],
            deck: [],
            discard: [],
            statusEffects: {},
            tokens: {},
            abilityLevels: {},
            abilities: [],
            upgradeCardByAbilityId: {},
        } as any,
        '1': {
            heroId: 'barbarian',
            health: 50,
            resources: { cp: 10 },
            hand: [],
            deck: [],
            discard: [],
            statusEffects: {},
            tokens: {},
            abilityLevels: {},
            abilities: [],
            upgradeCardByAbilityId: {},
        } as any,
    } as any,
    ...overrides,
});

describe('红热攻击修正出牌边界', () => {
    it('没有当前攻击时不能打出攻击修正卡', () => {
        const result = checkPlayCard(makeRuleCheckCore(), '0', redHotCard, 'offensiveRoll');

        expect(result.ok).toBe(false);
        expect((result as any).reason).toBe('attackModifierRequiresSelectedAttack');
    });

    it('已有当前攻击时攻击方可以在 offensiveRoll 打出攻击修正卡', () => {
        const result = checkPlayCard(makeRuleCheckCore({
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                isDefendable: true,
                sourceAbilityId: 'meteor',
                damageResolved: false,
                resolvedDamage: 0,
                attackDiceFaceCounts: {},
            } as any,
        }), '0', redHotCard, 'offensiveRoll');

        expect(result.ok).toBe(true);
    });

    it('已有当前攻击时攻击方可以在 defensiveRoll 继续打出攻击修正卡', () => {
        const result = checkPlayCard(makeRuleCheckCore({
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                isDefendable: true,
                sourceAbilityId: 'meteor',
                damageResolved: false,
                resolvedDamage: 0,
                attackDiceFaceCounts: {},
            } as any,
        }), '0', redHotCard, 'defensiveRoll');

        expect(result.ok).toBe(true);
    });

    it('已有当前攻击时防守方不能打出攻击修正卡', () => {
        const result = checkPlayCard(makeRuleCheckCore({
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                isDefendable: true,
                sourceAbilityId: 'meteor',
                damageResolved: false,
                resolvedDamage: 0,
                attackDiceFaceCounts: {},
            } as any,
        }), '1', redHotCard, 'defensiveRoll');

        expect(result.ok).toBe(false);
        expect((result as any).reason).toBe('wrongPhaseForCard');
    });

    it('afterRollConfirmed 鍝嶅簲绐楀彛涓嶅簲鍏佽绾㈢儹', () => {
        const result = validateCommand(
            makeRuleCheckCore({
                turnPhase: 'defensiveRoll',
                pendingAttack: {
                    attackerId: '0',
                    defenderId: '1',
                    isDefendable: true,
                    sourceAbilityId: 'meteor',
                    damageResolved: false,
                    resolvedDamage: 0,
                    attackDiceFaceCounts: {},
                } as any,
            }),
            {
                type: 'PLAY_CARD',
                playerId: '0',
                payload: { cardId: 'card-red-hot' },
            } as any,
            'defensiveRoll',
            undefined,
            'afterRollConfirmed'
        );

        expect(result.valid).toBe(false);
        expect(result.error).toBe('wrongPhaseForCard');
    });

    it('绂诲紑鍝嶅簲绐楀彛鍚庣孩鐑粛鍙湪 defensiveRoll 鎵撳嚭', () => {
        const result = validateCommand(
            makeRuleCheckCore({
                turnPhase: 'defensiveRoll',
                pendingAttack: {
                    attackerId: '0',
                    defenderId: '1',
                    isDefendable: true,
                    sourceAbilityId: 'meteor',
                    damageResolved: false,
                    resolvedDamage: 0,
                    attackDiceFaceCounts: {},
                } as any,
            }),
            {
                type: 'PLAY_CARD',
                playerId: '0',
                payload: { cardId: 'card-red-hot' },
            } as any,
            'defensiveRoll'
        );

        expect(result.valid).toBe(true);
    });
});

describe('红热 + 陨石伤害计算', () => {
    it('先加入 bonusDamage 再发起攻击时，应在 ATTACK_INITIATED 转移到 pendingAttack', () => {
        const initial = createInitializedState(['0', '1'], fixedRandom).core;

        const withQueuedBonus = reduce(initial, {
            type: 'BONUS_DAMAGE_ADDED',
            payload: {
                playerId: '0',
                amount: 2,
                sourceCardId: 'card-red-hot',
            },
            timestamp: 1,
        } as DiceThroneEvent);

        expect(withQueuedBonus.players['0'].pendingBonusDamage).toBe(2);
        expect(withQueuedBonus.pendingAttack).toBeNull();

        const initiated = reduce(withQueuedBonus, {
            type: 'ATTACK_INITIATED',
            payload: {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'meteor',
                isDefendable: false,
            },
            timestamp: 2,
        } as DiceThroneEvent);

        expect(initiated.pendingAttack?.bonusDamage).toBe(2);
        expect(initiated.pendingAttack?.attackModifierBonusDamage).toBe(2);
        expect(initiated.players['0'].pendingBonusDamage).toBeUndefined();
    });

    it('回合切换时应清除未消费的 pendingBonusDamage', () => {
        const initial = createInitializedState(['0', '1'], fixedRandom).core;
        const withQueuedBonus = reduce(initial, {
            type: 'BONUS_DAMAGE_ADDED',
            payload: {
                playerId: '0',
                amount: 2,
                sourceCardId: 'card-red-hot',
            },
            timestamp: 1,
        } as DiceThroneEvent);

        const afterTurnChanged = reduce(withQueuedBonus, {
            type: 'TURN_CHANGED',
            payload: {
                previousPlayerId: '0',
                nextPlayerId: '1',
                turnNumber: 2,
            },
            timestamp: 2,
        } as DiceThroneEvent);

        expect(afterTurnChanged.players['0'].pendingBonusDamage).toBeUndefined();
    });

    it('应把 bonusDamage 加到陨石的火焰精通伤害上', () => {
        const state: Partial<DiceThroneCore> = {
            players: {
                '0': {
                    id: 'player-0',
                    characterId: 'pyromancer',
                    tokens: {
                        fire_mastery: 2,
                    },
                    resources: { hp: 50, cp: 5 },
                    hand: [],
                    deck: [],
                    discard: [],
                    statusEffects: {},
                    tokenStackLimits: {},
                    damageShields: [],
                    abilities: [],
                    abilityLevels: {},
                    upgradeCardByAbilityId: {},
                } as any,
                '1': {
                    id: 'player-1',
                    characterId: 'moon_elf',
                    resources: { hp: 50, cp: 5 },
                    tokens: {},
                    hand: [],
                    deck: [],
                    discard: [],
                    statusEffects: {},
                    tokenStackLimits: {},
                    damageShields: [],
                    abilities: [],
                    abilityLevels: {},
                    upgradeCardByAbilityId: {},
                } as any,
            },
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                isDefendable: false,
                sourceAbilityId: 'meteor',
                bonusDamage: 2,
                damageResolved: false,
                resolvedDamage: 0,
            },
            tokenDefinitions: [],
        };

        const damageCalc = createDamageCalculation({
            source: { playerId: '0', abilityId: 'meteor' },
            target: { playerId: '1' },
            baseDamage: 2,
            state: state as any,
            timestamp: Date.now(),
        });

        const result = damageCalc.resolve();

        expect(result.baseDamage).toBe(2);
        expect(result.finalDamage).toBe(4);

        const bonusDamageModifier = result.modifiers.find(m => m.sourceId === 'attack_modifier');
        expect(bonusDamageModifier).toBeDefined();
        expect(bonusDamageModifier?.value).toBe(2);
    });

    it('没有 bonusDamage 时应只造成火焰精通伤害', () => {
        const state: Partial<DiceThroneCore> = {
            players: {
                '0': {
                    id: 'player-0',
                    characterId: 'pyromancer',
                    tokens: {
                        fire_mastery: 2,
                    },
                    resources: { hp: 50, cp: 5 },
                    hand: [],
                    deck: [],
                    discard: [],
                    statusEffects: {},
                    tokenStackLimits: {},
                    damageShields: [],
                    abilities: [],
                    abilityLevels: {},
                    upgradeCardByAbilityId: {},
                } as any,
                '1': {
                    id: 'player-1',
                    characterId: 'moon_elf',
                    resources: { hp: 50, cp: 5 },
                    tokens: {},
                    hand: [],
                    deck: [],
                    discard: [],
                    statusEffects: {},
                    tokenStackLimits: {},
                    damageShields: [],
                    abilities: [],
                    abilityLevels: {},
                    upgradeCardByAbilityId: {},
                } as any,
            },
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                isDefendable: false,
                sourceAbilityId: 'meteor',
                bonusDamage: 0,
                damageResolved: false,
                resolvedDamage: 0,
            },
            tokenDefinitions: [],
        };

        const damageCalc = createDamageCalculation({
            source: { playerId: '0', abilityId: 'meteor' },
            target: { playerId: '1' },
            baseDamage: 2,
            state: state as any,
            timestamp: Date.now(),
        });

        const result = damageCalc.resolve();

        expect(result.finalDamage).toBe(2);
    });
});
