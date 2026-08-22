import { describe, it, expect } from 'vitest';
import { createDamageCalculation } from '../../../engine/primitives/damageCalculation';
import type { DiceThroneCore } from '../domain/core-types';
import { TOKEN_IDS } from '../domain/ids';
import { validateCommand } from '../domain/commandValidation';
import { execute } from '../domain/execute';
import { checkPlayCard } from '../domain/rules';
import type { DiceThroneEvent } from '../domain/types';
import { BARBARIAN_CARDS } from '../heroes/barbarian/cards';
import { GUNSLINGER_CARDS } from '../heroes/gunslinger/cards';
import { MOON_ELF_CARDS } from '../heroes/moon_elf/cards';
import { NINJA_CARDS } from '../heroes/ninja/cards';
import { PYROMANCER_CARDS } from '../heroes/pyromancer/cards';
import { SAMURAI_CARDS } from '../heroes/samurai/cards';
import { TREANT_CARDS } from '../heroes/treant/cards';
import { reduce } from '../domain/reducer';
import { createInitializedState, createQueuedRandom, fixedRandom } from './test-utils';

const redHotCard = PYROMANCER_CARDS.find(c => c.id === 'card-red-hot')!;
const morePleaseCard = BARBARIAN_CARDS.find(c => c.id === 'card-more-please')!;
const getFiredUpCard = PYROMANCER_CARDS.find(c => c.id === 'card-get-fired-up')!;
const volleyCard = MOON_ELF_CARDS.find(c => c.id === 'volley')!;
const watchOutCard = MOON_ELF_CARDS.find(c => c.id === 'watch-out')!;
const wildWestCard = GUNSLINGER_CARDS.find(c => c.id === 'card-wild-west')!;
const eatMyLeadCard = GUNSLINGER_CARDS.find(c => c.id === 'card-eat-my-lead')!;
const righteousnessCard = SAMURAI_CARDS.find(c => c.id === 'card-righteousness')!;
const zanshinCard = SAMURAI_CARDS.find(c => c.id === 'card-zanshin')!;
const trampleCard = TREANT_CARDS.find(c => c.id === 'treant-card-trample')!;
const soulfireCard = TREANT_CARDS.find(c => c.id === 'treant-card-soulfire')!;
const shurikenCard = NINJA_CARDS.find(c => c.id === 'ninja-card-shuriken')!;

type AttackModifierCase = {
    label: string;
    heroId: string;
    card: unknown;
    tokens?: Record<string, number>;
};

const fourPlayerTargetLockedAttackModifierCases: AttackModifierCase[] = [
    { label: 'barbarian: card-more-please', heroId: 'barbarian', card: morePleaseCard },
    { label: 'pyromancer: card-get-fired-up', heroId: 'pyromancer', card: getFiredUpCard },
    { label: 'moon_elf: volley', heroId: 'moon_elf', card: volleyCard },
    { label: 'moon_elf: watch-out', heroId: 'moon_elf', card: watchOutCard },
    { label: 'gunslinger: card-eat-my-lead', heroId: 'gunslinger', card: eatMyLeadCard },
    { label: 'samurai: card-righteousness', heroId: 'samurai', card: righteousnessCard },
    { label: 'samurai: card-zanshin', heroId: 'samurai', card: zanshinCard },
    { label: 'treant: treant-card-trample', heroId: 'treant', card: trampleCard },
];

const allAttackModifierCases: AttackModifierCase[] = [
    { label: 'barbarian: card-more-please', heroId: 'barbarian', card: morePleaseCard },
    { label: 'pyromancer: card-red-hot', heroId: 'pyromancer', card: redHotCard },
    { label: 'pyromancer: card-get-fired-up', heroId: 'pyromancer', card: getFiredUpCard },
    { label: 'moon_elf: volley', heroId: 'moon_elf', card: volleyCard },
    { label: 'moon_elf: watch-out', heroId: 'moon_elf', card: watchOutCard },
    { label: 'gunslinger: card-wild-west', heroId: 'gunslinger', card: wildWestCard, tokens: { [TOKEN_IDS.LOADED]: 1 } },
    { label: 'gunslinger: card-eat-my-lead', heroId: 'gunslinger', card: eatMyLeadCard },
    { label: 'samurai: card-righteousness', heroId: 'samurai', card: righteousnessCard },
    { label: 'samurai: card-zanshin', heroId: 'samurai', card: zanshinCard },
    { label: 'treant: treant-card-trample', heroId: 'treant', card: trampleCard },
    { label: 'treant: treant-card-soulfire', heroId: 'treant', card: soulfireCard },
    { label: 'ninja: ninja-card-shuriken', heroId: 'ninja', card: shurikenCard },
];

const normalizeTestDice = (dice: unknown[] = [1, 2, 3, 4, 5]) => dice.map((die, index) => {
    const value = typeof die === 'number'
        ? die
        : typeof (die as { value?: unknown })?.value === 'number'
            ? (die as { value: number }).value
            : 1;
    return {
        ...(typeof die === 'object' && die !== null ? die as Record<string, unknown> : {}),
        id: typeof (die as { id?: unknown })?.id === 'number' ? (die as { id: number }).id : index,
        value,
        isKept: (die as { isKept?: boolean })?.isKept ?? false,
    };
});

const makeRuleCheckCore = (overrides: Partial<DiceThroneCore> = {}): DiceThroneCore => ({
    activePlayerId: '0',
    turnNumber: 1,
    turnPhase: 'offensiveRoll',
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
    dice: normalizeTestDice(overrides.dice as unknown[] | undefined) as any,
});

const makeFourPlayerAttackModifierCore = (
    heroId: string,
    card: unknown,
    targetingValue: number,
    extraTokens: Record<string, number> = {},
): DiceThroneCore => makeRuleCheckCore({
    turnPhase: 'targetingRoll',
    dice: [{ value: targetingValue }] as any,
    players: {
        '0': {
            heroId,
            health: 50,
            resources: { cp: 10 },
            hand: [card],
            deck: [],
            discard: [],
            statusEffects: {},
            tokens: extraTokens,
            abilityLevels: {},
            abilities: [],
            upgradeCardByAbilityId: {},
        } as any,
        '1': {
            heroId: 'monk',
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
        '2': {
            heroId: 'samurai',
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
        '3': {
            heroId: 'shadow_thief',
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
    pendingAttack: {
        attackerId: '0',
        defenderId: undefined,
        isDefendable: true,
        sourceAbilityId: 'team-attack-test',
        damageResolved: false,
        resolvedDamage: 0,
        attackDiceFaceCounts: {},
    } as any,
});

const makeFourPlayerAttackModifierOffensiveCore = (
    heroId: string,
    card: unknown,
    extraTokens: Record<string, number> = {},
): DiceThroneCore => makeRuleCheckCore({
    turnPhase: 'offensiveRoll',
    dice: [1, 2, 3, 4, 5] as any,
    players: {
        '0': {
            heroId,
            health: 50,
            resources: { cp: 10 },
            hand: [card],
            deck: [],
            discard: [],
            statusEffects: {},
            tokens: extraTokens,
            abilityLevels: {},
            abilities: [],
            upgradeCardByAbilityId: {},
        } as any,
        '1': {
            heroId: 'monk',
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
        '2': {
            heroId: 'samurai',
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
        '3': {
            heroId: 'shadow_thief',
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
    pendingAttack: {
        attackerId: '0',
        defenderId: undefined,
        isDefendable: true,
        sourceAbilityId: 'team-attack-test',
        damageResolved: false,
        resolvedDamage: 0,
        attackDiceFaceCounts: {},
    } as any,
});

describe('红热攻击修正出牌边界', () => {
    it('没有当前攻击时不能打出攻击修正卡', () => {
        const result = checkPlayCard(makeRuleCheckCore(), '0', redHotCard, 'offensiveRoll');

        expect(result.ok).toBe(false);
        expect((result as any).reason).toBe('attackModifierRequiresSelectedAttack');
    });

    it.each(allAttackModifierCases)('没有当前攻击时攻击修正卡必须先选择技能: %s', ({ heroId, card, tokens }) => {
        const result = checkPlayCard(makeRuleCheckCore({
            players: {
                '0': {
                    heroId,
                    health: 50,
                    resources: { cp: 10 },
                    hand: [card],
                    deck: [],
                    discard: [],
                    statusEffects: {},
                    tokens: tokens ?? {},
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
            pendingAttack: null,
        }), '0', card as any, 'offensiveRoll');

        expect(result.ok).toBe(false);
        expect((result as any).reason).toBe('attackModifierRequiresSelectedAttack');
    });

    it('4 人模式未选定 defender 时，红热仍可先行打出', () => {
        const result = checkPlayCard(makeRuleCheckCore({
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
                '2': {
                    heroId: 'monk',
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
                '3': {
                    heroId: 'samurai',
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
            pendingAttack: {
                attackerId: '0',
                defenderId: undefined,
                isDefendable: true,
                sourceAbilityId: 'meteor',
                damageResolved: false,
                resolvedDamage: 0,
                attackDiceFaceCounts: {},
            } as any,
        }), '0', redHotCard, 'offensiveRoll');

        expect(result.ok).toBe(true);
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

    it.each(allAttackModifierCases)('已有当前攻击时攻击方可在 offensiveRoll 打出攻击修正卡: %s', ({ heroId, card, tokens }) => {
        const result = checkPlayCard(makeRuleCheckCore({
            players: {
                '0': {
                    heroId,
                    health: 50,
                    resources: { cp: 10 },
                    hand: [card],
                    deck: [],
                    discard: [],
                    statusEffects: {},
                    tokens: tokens ?? {},
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
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                isDefendable: true,
                sourceAbilityId: 'attack-test',
                damageResolved: false,
                resolvedDamage: 0,
                attackDiceFaceCounts: {},
            } as any,
        }), '0', card as any, 'offensiveRoll');

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

    it('4 人模式 targetingRoll 掷出 1/2 自动锁定目标后，可在写回 defenderId 前打出再来点儿', () => {
        const result = checkPlayCard(makeRuleCheckCore({
            turnPhase: 'targetingRoll',
            dice: [{ value: 2 }] as any,
            players: {
                '0': {
                    heroId: 'barbarian',
                    health: 50,
                    resources: { cp: 10 },
                    hand: [morePleaseCard],
                    deck: [],
                    discard: [],
                    statusEffects: {},
                    tokens: {},
                    abilityLevels: {},
                    abilities: [],
                    upgradeCardByAbilityId: {},
                } as any,
                '1': {
                    heroId: 'monk',
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
                '2': {
                    heroId: 'samurai',
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
                '3': {
                    heroId: 'shadow_thief',
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
            pendingAttack: {
                attackerId: '0',
                defenderId: undefined,
                isDefendable: true,
                sourceAbilityId: 'barbarian-offense',
                damageResolved: false,
                resolvedDamage: 0,
                attackDiceFaceCounts: {},
            } as any,
        }), '0', morePleaseCard, 'targetingRoll');

        expect(result.ok).toBe(true);
    });

    it('4 人模式 targetingRoll 掷出 5 且尚未选目标时，也允许先打出再来点儿', () => {
        const result = checkPlayCard(makeRuleCheckCore({
            turnPhase: 'targetingRoll',
            dice: [{ value: 5 }] as any,
            players: {
                '0': {
                    heroId: 'barbarian',
                    health: 50,
                    resources: { cp: 10 },
                    hand: [morePleaseCard],
                    deck: [],
                    discard: [],
                    statusEffects: {},
                    tokens: {},
                    abilityLevels: {},
                    abilities: [],
                    upgradeCardByAbilityId: {},
                } as any,
                '1': {
                    heroId: 'monk',
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
                '2': {
                    heroId: 'samurai',
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
                '3': {
                    heroId: 'shadow_thief',
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
            pendingAttack: {
                attackerId: '0',
                defenderId: undefined,
                isDefendable: true,
                sourceAbilityId: 'barbarian-offense',
                damageResolved: false,
                resolvedDamage: 0,
                attackDiceFaceCounts: {},
            } as any,
        }), '0', morePleaseCard, 'targetingRoll');

        expect(result.ok).toBe(true);
    });

    it('4 人模式 targetingRoll 掷出 6 且由攻击方手选目标时，可以先打出再来点儿', () => {
        const result = checkPlayCard(makeRuleCheckCore({
            turnPhase: 'targetingRoll',
            dice: [{ value: 6 }] as any,
            players: {
                '0': {
                    heroId: 'barbarian',
                    health: 50,
                    resources: { cp: 10 },
                    hand: [morePleaseCard],
                    deck: [],
                    discard: [],
                    statusEffects: {},
                    tokens: {},
                    abilityLevels: {},
                    abilities: [],
                    upgradeCardByAbilityId: {},
                } as any,
                '1': {
                    heroId: 'monk',
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
                '2': {
                    heroId: 'samurai',
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
                '3': {
                    heroId: 'shadow_thief',
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
            pendingAttack: {
                attackerId: '0',
                defenderId: undefined,
                isDefendable: true,
                sourceAbilityId: 'barbarian-offense',
                damageResolved: false,
                resolvedDamage: 0,
                attackDiceFaceCounts: {},
            } as any,
        }), '0', morePleaseCard, 'targetingRoll');

        expect(result.ok).toBe(true);
    });

    it('4 人模式 targetingRoll 手选目标窗口也允许红热先行打出', () => {
        const result = checkPlayCard(
            makeFourPlayerAttackModifierCore('pyromancer', redHotCard, 5),
            '0',
            redHotCard,
            'targetingRoll'
        );

        expect(result.ok).toBe(true);
    });

    it('4 人模式 targetingRoll 手选目标窗口也允许荒野西部先行打出', () => {
        const result = checkPlayCard(
            makeFourPlayerAttackModifierCore('gunslinger', wildWestCard, 5, { [TOKEN_IDS.LOADED]: 1 }),
            '0',
            wildWestCard,
            'targetingRoll'
        );

        expect(result.ok).toBe(true);
    });

    it.each(fourPlayerTargetLockedAttackModifierCases)('4 人模式 targetingRoll 自动目标窗口允许攻击修正卡: %s', ({ heroId, card, tokens }) => {
        const result = checkPlayCard(
            makeFourPlayerAttackModifierCore(heroId, card, 2, tokens ?? {}),
            '0',
            card as any,
            'targetingRoll'
        );

        expect(result.ok).toBe(true);
    });

    it('4 人模式 targetingRoll 自动目标窗口打出吃我子弹时，应先挂起奖励骰并在普通确认后结算到自动目标', () => {
        const core = makeFourPlayerAttackModifierCore('gunslinger', eatMyLeadCard, 2);
        (core.players['0'] as any).characterId = 'gunslinger';
        const events = execute(
            { core, sys: { phase: 'targetingRoll' } } as any,
            {
                type: 'PLAY_CARD',
                playerId: '0',
                payload: { cardId: 'card-eat-my-lead' },
                timestamp: 1,
            } as any,
            createQueuedRandom([1, 1, 1, 2, 3]),
        );

        const nextCore = events.reduce(
            (state, event) => reduce(state, event as DiceThroneEvent),
            core,
        );

        expect(nextCore.pendingBonusDiceSettlement?.targetId).toBe('3');
        expect(nextCore.pendingBonusDiceSettlement?.summaryEffectKey).toBe('bonusDie.effect.gunslingerEatMyLead.resultKnockdown');
        expect(nextCore.pendingAttack?.bonusDamage ?? 0).toBe(0);
        expect(nextCore.players['3'].statusEffects.knockdown ?? 0).toBe(0);

        const settledEvents = execute(
            { core: nextCore, sys: { phase: 'targetingRoll' } } as any,
            {
                type: 'SKIP_BONUS_DICE_REROLL',
                playerId: '0',
                payload: {},
                timestamp: 20,
            } as any,
            fixedRandom,
        );
        const settledCore = settledEvents.reduce(
            (state, event) => reduce(state, event as DiceThroneEvent),
            nextCore,
        );

        expect(settledCore.pendingAttack?.bonusDamage).toBe(5);
        expect(settledCore.pendingAttack?.attackModifierBonusDamage).toBe(5);
        expect(settledCore.players['3'].statusEffects.knockdown).toBe(1);
        expect(settledCore.players['2'].statusEffects.knockdown ?? 0).toBe(0);
    });

    it.each(fourPlayerTargetLockedAttackModifierCases)('4 人模式 targetingRoll 手选目标窗口也允许提前打出攻击修正卡: %s', ({ heroId, card, tokens }) => {
        const result = checkPlayCard(
            makeFourPlayerAttackModifierCore(heroId, card, 5, tokens ?? {}),
            '0',
            card as any,
            'targetingRoll'
        );

        expect(result.ok).toBe(true);
    });

    it('4 人模式 targetingRoll 手选目标窗口打出万箭齐发时，不应额外弹出选受击者交互', () => {
        const core = makeFourPlayerAttackModifierCore('moon_elf', volleyCard, 5);
        const events = execute(
            { core, sys: { phase: 'targetingRoll' } } as any,
            {
                type: 'PLAY_CARD',
                playerId: '0',
                payload: { cardId: 'volley' },
                timestamp: 1,
            } as any,
            fixedRandom,
        );

        const interactionEvent = events.find((event) => event.type === 'INTERACTION_REQUESTED') as any;
        expect(interactionEvent).toBeUndefined();

        const nextCore = events.reduce(
            (state, event) => reduce(state, event as DiceThroneEvent),
            core,
        );
        expect(nextCore.pendingAttack?.deferredAttackModifierCardIds).toEqual(['volley']);
    });

    it('4 人模式 offensiveRoll 打出万箭齐发时，不应提前弹出选受击者交互', () => {
        const core = makeFourPlayerAttackModifierOffensiveCore('moon_elf', volleyCard);
        const events = execute(
            { core, sys: { phase: 'offensiveRoll' } } as any,
            {
                type: 'PLAY_CARD',
                playerId: '0',
                payload: { cardId: 'volley' },
                timestamp: 1,
            } as any,
            fixedRandom,
        );

        const interactionEvent = events.find((event) => event.type === 'INTERACTION_REQUESTED') as any;
        expect(interactionEvent).toBeUndefined();

        const nextCore = events.reduce(
            (state, event) => reduce(state, event as DiceThroneEvent),
            core,
        );
        expect(nextCore.pendingAttack?.deferredAttackModifierCardIds).toEqual(['volley']);
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

    it('同一笔攻击连续两次攻击修正时，应累计到当前攻击并进入最终伤害', () => {
        const initial = createInitializedState(['0', '1'], fixedRandom).core;

        const initiated = reduce(initial, {
            type: 'ATTACK_INITIATED',
            payload: {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'meteor',
                isDefendable: false,
            },
            timestamp: 1,
        } as DiceThroneEvent);
        const withRedHot = reduce(initiated, {
            type: 'BONUS_DAMAGE_ADDED',
            payload: {
                playerId: '0',
                amount: 2,
                sourceCardId: 'card-red-hot',
            },
            timestamp: 2,
        } as DiceThroneEvent);
        const withGetFiredUp = reduce(withRedHot, {
            type: 'BONUS_DAMAGE_ADDED',
            payload: {
                playerId: '0',
                amount: 3,
                sourceCardId: 'card-get-fired-up',
            },
            timestamp: 3,
        } as DiceThroneEvent);

        expect(withGetFiredUp.pendingAttack?.bonusDamage).toBe(5);
        expect(withGetFiredUp.pendingAttack?.attackModifierBonusDamage).toBe(5);
        expect(withGetFiredUp.players['0'].pendingBonusDamage).toBeUndefined();

        const damageCalc = createDamageCalculation({
            source: { playerId: '0', abilityId: 'meteor' },
            target: { playerId: '1' },
            baseDamage: 2,
            state: withGetFiredUp as any,
            attackDamageContext: {
                attackerId: '0',
                defenderId: '1',
                bonusDamage: withGetFiredUp.pendingAttack?.bonusDamage ?? 0,
            },
            timestamp: 4,
        });
        const result = damageCalc.resolve();

        expect(result.finalDamage).toBe(7);
        expect(result.modifiers).toEqual(expect.arrayContaining([
            expect.objectContaining({ sourceId: 'attack_modifier', value: 5 }),
        ]));

        const afterDamage = reduce(withGetFiredUp, {
            type: 'DAMAGE_DEALT',
            payload: {
                targetId: '1',
                sourcePlayerId: '0',
                sourceAbilityId: 'meteor',
                amount: result.finalDamage,
                actualDamage: result.finalDamage,
                damageScope: 'attack',
            },
            timestamp: 5,
        } as DiceThroneEvent);

        expect(afterDamage.pendingAttack?.resolvedDamage).toBe(7);

        const resolved = reduce(afterDamage, {
            type: 'ATTACK_RESOLVED',
            payload: {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'meteor',
                totalDamage: result.finalDamage,
            },
            timestamp: 6,
        } as DiceThroneEvent);

        expect(resolved.pendingAttack).toBeNull();
        expect(resolved.lastResolvedAttackDamage).toBe(7);
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
            attackDamageContext: {
                attackerId: '0',
                defenderId: '1',
                bonusDamage: 2,
            },
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
            attackDamageContext: {
                attackerId: '0',
                defenderId: '1',
                bonusDamage: 0,
            },
            timestamp: Date.now(),
        });

        const result = damageCalc.resolve();

        expect(result.finalDamage).toBe(2);
    });
});
