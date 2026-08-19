import { describe, expect, it } from 'vitest';

import '../domain';
import { diceThroneFlowHooks } from '../domain/flowHooks';
import { resolveEffectsToEvents, type EffectContext } from '../domain/effects';
import { execute } from '../domain/execute';
import { buildBonusDiceSettlementEvents } from '../domain/executeTokens';
import { reduce } from '../domain/reducer';
import { LIEREN_DICE_FACE_IDS as FACE, STATUS_IDS, TOKEN_IDS } from '../domain/ids';
import type { AbilityEffect, EffectTiming } from '../domain/combat';
import type { DiceThroneCommand, DiceThroneCore, DiceThroneEvent } from '../domain/types';
import { KINDRED_BOND_3, LIEREN_ABILITIES } from '../heroes/lieren/abilities';
import { LIEREN_CARDS } from '../heroes/lieren/cards';
import { createHeroMatchup, createQueuedRandom, fixedRandom } from './test-utils';

const playerIds = ['0', '1'];

const createLierenState = () => createHeroMatchup('lieren', 'monk')(playerIds, fixedRandom);

const applyEvents = (core: DiceThroneCore, events: DiceThroneEvent[]): DiceThroneCore =>
    events.reduce((current, event) => reduce(current, event), core);

const settleBonusDice = (core: DiceThroneCore, timestamp = 200): DiceThroneEvent[] => {
    const settlement = core.pendingBonusDiceSettlement;
    if (!settlement) return [];
    return buildBonusDiceSettlementEvents({
        state: core,
        settlement,
        random: createQueuedRandom([1]),
        timestamp,
        sourceCommandType: 'SKIP_BONUS_DICE_REROLL',
    });
};

const command = (type: DiceThroneCommand['type'], playerId = '0'): DiceThroneCommand => ({
    type,
    playerId,
    payload: {},
    timestamp: 100,
} as DiceThroneCommand);

const enterUpkeep = (core: DiceThroneCore, randomValues: number[]): DiceThroneEvent[] => {
    const result = diceThroneFlowHooks.onPhaseEnter?.({
        state: {
            core,
            sys: { phase: 'discard' },
        },
        from: 'discard',
        to: 'upkeep',
        command: command('ADVANCE_PHASE', core.activePlayerId),
        random: createQueuedRandom(randomValues),
        exitEvents: [],
    } as Parameters<NonNullable<typeof diceThroneFlowHooks.onPhaseEnter>>[0]);
    return (Array.isArray(result) ? result : []) as DiceThroneEvent[];
};

const createContext = (
    state: ReturnType<typeof createLierenState>,
    sourceAbilityId: string,
): EffectContext => ({
    attackerId: '0',
    defenderId: '1',
    sourceAbilityId,
    state: state.core,
    damageDealt: 0,
    timestamp: 100,
});

const resolve = (
    state: ReturnType<typeof createLierenState>,
    sourceAbilityId: string,
    effects: AbilityEffect[],
    timing: EffectTiming,
    randomValues: number[],
): DiceThroneEvent[] => resolveEffectsToEvents(
    effects,
    timing,
    createContext(state, sourceAbilityId),
    { random: createQueuedRandom(randomValues) },
);

const resolveAndSettleBonusDice = (
    state: ReturnType<typeof createLierenState>,
    sourceAbilityId: string,
    effects: AbilityEffect[],
    timing: EffectTiming,
    randomValues: number[],
) => {
    const rollEvents = resolve(state, sourceAbilityId, effects, timing, randomValues);
    const rolledCore = applyEvents(state.core, rollEvents);
    const settlementEvents = settleBonusDice(rolledCore);
    const next = applyEvents(rolledCore, settlementEvents);
    return {
        rollEvents,
        settlementEvents,
        events: [...rollEvents, ...settlementEvents],
        next,
    };
};

const getCard = (cardId: string) => {
    const card = LIEREN_CARDS.find(entry => entry.id === cardId);
    if (!card) throw new Error(`未找到女猎手卡牌 ${cardId}`);
    return card;
};

describe('DiceThrone 女猎手规则矩阵', () => {
    it('流血在持有者维护阶段 1-4 造成 1 点直接伤害，且不移除层数', () => {
        const state = createLierenState();
        state.core.activePlayerId = '0';
        state.core.players['0'].statusEffects[STATUS_IDS.BLEED] = 2;
        const hpBefore = state.core.players['0'].resources.hp;

        const events = enterUpkeep(state.core, [4]);
        const next = applyEvents(state.core, events);

        expect(events).toContainEqual(expect.objectContaining({
            type: 'BONUS_DIE_ROLLED',
            payload: expect.objectContaining({
                playerId: '0',
                value: 4,
                face: FACE.CLAW,
                effectKey: 'bonusDie.effect.lieren.bleed.damage',
            }),
        }));
        expect(events).toContainEqual(expect.objectContaining({
            type: 'DAMAGE_DEALT',
            payload: expect.objectContaining({
                targetId: '0',
                amount: 1,
                actualDamage: 1,
                sourceAbilityId: 'upkeep-bleed',
            }),
        }));
        expect(next.players['0'].resources.hp).toBe(hpBefore - 1);
        expect(next.players['0'].statusEffects[STATUS_IDS.BLEED]).toBe(2);
    });

    it('流血在持有者维护阶段 5-6 移除 1 层，且不造成伤害', () => {
        const state = createLierenState();
        state.core.activePlayerId = '0';
        state.core.players['0'].statusEffects[STATUS_IDS.BLEED] = 2;
        const hpBefore = state.core.players['0'].resources.hp;

        const events = enterUpkeep(state.core, [6]);
        const next = applyEvents(state.core, events);

        expect(events).toContainEqual(expect.objectContaining({
            type: 'BONUS_DIE_ROLLED',
            payload: expect.objectContaining({
                playerId: '0',
                value: 6,
                face: FACE.SABERTOOTH,
                effectKey: 'bonusDie.effect.lieren.bleed.remove',
            }),
        }));
        expect(events.some(event => event.type === 'DAMAGE_DEALT')).toBe(false);
        expect(events).toContainEqual(expect.objectContaining({
            type: 'STATUS_REMOVED',
            payload: expect.objectContaining({
                targetId: '0',
                statusId: STATUS_IDS.BLEED,
                stacks: 1,
            }),
        }));
        expect(next.players['0'].resources.hp).toBe(hpBefore);
        expect(next.players['0'].statusEffects[STATUS_IDS.BLEED]).toBe(1);
    });

    it.each([
        { value: 1, face: FACE.SPEAR, expectedDamage: 1, effectKey: 'bonusDie.effect.lieren.opportunisticStrike.spear' },
        { value: 3, face: FACE.CLAW, expectedDamage: 2, effectKey: 'bonusDie.effect.lieren.opportunisticStrike.claw' },
        { value: 5, face: FACE.NYRAS_BOND, expectedDamage: 0, effectKey: 'bonusDie.effect.lieren.opportunisticStrike.nyrasBond' },
        { value: 6, face: FACE.SABERTOOTH, expectedDamage: 3, effectKey: 'bonusDie.effect.lieren.opportunisticStrike.sabertooth' },
    ])('机会主义打击奖励骰 $face 分支按女猎手骰面结算', ({ value, face, expectedDamage, effectKey }) => {
        const state = createLierenState();
        const card = getCard('card-lieren-opportunistic-strike');

        const { events, next } = resolveAndSettleBonusDice(state, card.id, card.effects, 'immediate', [value]);

        expect(events).toContainEqual(expect.objectContaining({
            type: 'BONUS_DIE_ROLLED',
            payload: expect.objectContaining({ value, face, effectKey }),
        }));
        const bonusDamage = events.find(event => event.type === 'BONUS_DAMAGE_ADDED');
        if (expectedDamage > 0) {
            expect(bonusDamage?.payload).toMatchObject({
                playerId: '0',
                amount: expectedDamage,
                sourceCardId: card.id,
            });
        } else {
            expect(bonusDamage).toBeUndefined();
        }
        if (face === FACE.NYRAS_BOND) {
            expect(next.players['0'].companion?.hp).toBe(7);
        }
    });

    it.each([
        { value: 1, face: FACE.SPEAR, expectedDamage: 1, expectedBond: 0, expectedBleed: 0, effectKey: 'bonusDie.effect.lieren.savageForce.spear' },
        { value: 3, face: FACE.CLAW, expectedDamage: 2, expectedBond: 0, expectedBleed: 0, effectKey: 'bonusDie.effect.lieren.savageForce.claw' },
        { value: 5, face: FACE.NYRAS_BOND, expectedDamage: 0, expectedBond: 1, expectedBleed: 0, effectKey: 'bonusDie.effect.lieren.savageForce.nyrasBond' },
        { value: 6, face: FACE.SABERTOOTH, expectedDamage: 0, expectedBond: 0, expectedBleed: 1, effectKey: 'bonusDie.effect.lieren.savageForce.sabertooth' },
    ])('蛮荒之力奖励骰 $face 分支按女猎手骰面结算', ({ value, face, expectedDamage, expectedBond, expectedBleed, effectKey }) => {
        const state = createLierenState();
        const ability = LIEREN_ABILITIES.find(entry => entry.id === 'savage-force');
        expect(ability).toBeDefined();

        const { events, next } = resolveAndSettleBonusDice(state, 'savage-force', ability!.effects ?? [], 'postDamage', [value]);

        expect(events).toContainEqual(expect.objectContaining({
            type: 'BONUS_DIE_ROLLED',
            payload: expect.objectContaining({ value, face, effectKey }),
        }));
        const bonusDamage = events.find(event => event.type === 'BONUS_DAMAGE_ADDED');
        if (expectedDamage > 0) {
            expect(bonusDamage?.payload).toMatchObject({
                playerId: '0',
                amount: expectedDamage,
            });
        } else {
            expect(bonusDamage).toBeUndefined();
        }
        expect(next.players['0'].tokens[TOKEN_IDS.NYRAS_BOND] ?? 0).toBe(expectedBond);
        expect(next.players['1'].statusEffects[STATUS_IDS.BLEED] ?? 0).toBe(expectedBleed);
    });

    it('突袭五颗奖励骰累计长矛加伤并按利爪施加流血', () => {
        const state = createLierenState();
        const card = getCard('card-lieren-pounce');

        const { events, next } = resolveAndSettleBonusDice(state, card.id, card.effects, 'immediate', [1, 2, 3, 4, 6]);

        expect(events.filter(event => event.type === 'BONUS_DIE_ROLLED')).toHaveLength(5);
        expect(events).toContainEqual(expect.objectContaining({
            type: 'BONUS_DAMAGE_ADDED',
            payload: expect.objectContaining({
                playerId: '0',
                amount: 2,
                sourceCardId: card.id,
            }),
        }));
        expect(events.filter(event => (
            event.type === 'STATUS_APPLIED'
            && event.payload.targetId === '1'
            && event.payload.statusId === STATUS_IDS.BLEED
        ))).toHaveLength(2);
        expect(next.players['1'].statusEffects[STATUS_IDS.BLEED]).toBe(2);
    });

    it('野性利爪默认施加 1 层流血，利爪或剑齿虎施加 2 层流血', () => {
        const defaultEvents = resolveAndSettleBonusDice(
            createLierenState(),
            'card-lieren-savage-claw',
            getCard('card-lieren-savage-claw').effects,
            'immediate',
            [1],
        ).events;
        const clawEvents = resolveAndSettleBonusDice(
            createLierenState(),
            'card-lieren-savage-claw',
            getCard('card-lieren-savage-claw').effects,
            'immediate',
            [3],
        ).events;
        const sabertoothEvents = resolveAndSettleBonusDice(
            createLierenState(),
            'card-lieren-savage-claw',
            getCard('card-lieren-savage-claw').effects,
            'immediate',
            [6],
        ).events;

        expect(defaultEvents).toContainEqual(expect.objectContaining({
            type: 'STATUS_APPLIED',
            payload: expect.objectContaining({ targetId: '1', statusId: STATUS_IDS.BLEED, stacks: 1, newTotal: 1 }),
        }));
        for (const events of [clawEvents, sabertoothEvents]) {
            expect(events).toContainEqual(expect.objectContaining({
                type: 'STATUS_APPLIED',
                payload: expect.objectContaining({ targetId: '1', statusId: STATUS_IDS.BLEED, stacks: 2, newTotal: 2 }),
            }));
        }
    });

    it('妮拉相关技能和卡牌进入运行时生命与妮拉之系结算', () => {
        const customActions = [
            ...LIEREN_ABILITIES.flatMap(ability => [
                ...(ability.effects ?? []),
                ...(ability.variants ?? []).flatMap(variant => variant.effects),
            ]),
            ...LIEREN_CARDS
                .filter(card => card.sourceAtlasIndex !== undefined)
                .flatMap(card => card.effects ?? []),
        ]
            .map(effect => effect.action)
            .filter(action => action?.type === 'custom');

        expect(customActions.length).toBeGreaterThan(0);
        expect(customActions.every(action => (
            action?.type === 'custom'
            && ['lieren-nyra-effect', 'lieren-kindred-bond'].includes(action.customActionId)
        ))).toBe(true);

        const regroup = getCard('card-lieren-regroup');
        const regroupState = createLierenState();
        const regroupEvents = resolve(regroupState, regroup.id, regroup.effects, 'immediate', [1]);
        expect(regroupEvents).toContainEqual(expect.objectContaining({
            type: 'TOKEN_GRANTED',
            payload: expect.objectContaining({ tokenId: 'nyras_bond', newTotal: 1 }),
        }));
        expect(applyEvents(regroupState.core, regroupEvents).players['0'].tokens.nyras_bond).toBe(1);

        const beastForce = LIEREN_ABILITIES.find(ability => ability.id === 'beast-force');
        const healingState = createLierenState();
        healingState.core.players['0'].companion!.hp = 4;
        const healingEvents = resolve(healingState, 'beast-force', beastForce!.effects, 'preDefense', [1]);
        expect(healingEvents).toContainEqual(expect.objectContaining({
            type: 'COMPANION_HEALTH_CHANGED',
            payload: expect.objectContaining({ playerId: '0', companionId: 'nyra', delta: 1 }),
        }));
        expect(applyEvents(healingState.core, healingEvents).players['0'].companion?.hp).toBe(5);
    });

    it('情同骨肉按防御骰面造成反击并治疗妮拉，III 额外计入剑齿虎', () => {
        const setKindredBondDice = (core: DiceThroneCore) => {
            core.players['0'].companion!.hp = 3;
            core.dice = [
                { id: 0, value: 1, symbol: FACE.SPEAR, symbols: [FACE.SPEAR], definitionId: 'lieren-dice', isKept: false, ownerId: '0' },
                { id: 1, value: 3, symbol: FACE.CLAW, symbols: [FACE.CLAW], definitionId: 'lieren-dice', isKept: false, ownerId: '0' },
                { id: 2, value: 5, symbol: FACE.NYRAS_BOND, symbols: [FACE.NYRAS_BOND], definitionId: 'lieren-dice', isKept: false, ownerId: '0' },
                { id: 3, value: 6, symbol: FACE.SABERTOOTH, symbols: [FACE.SABERTOOTH], definitionId: 'lieren-dice', isKept: false, ownerId: '0' },
            ];
            core.rollDiceCount = 4;
            core.rollCount = 1;
            core.rollConfirmed = true;
            core.pendingAttack = {
                attackerId: '1',
                defenderId: '0',
                abilityId: 'test-hit',
                defenseAbilityId: 'kindred-bond',
                bonusDamage: 0,
            } as DiceThroneCore['pendingAttack'];
        };

        const baseState = createLierenState();
        setKindredBondDice(baseState.core);
        const baseAbility = LIEREN_ABILITIES.find(entry => entry.id === 'kindred-bond');
        expect(baseAbility).toBeDefined();
        const baseHpBefore = baseState.core.players['1'].resources.hp;
        const baseEvents = resolve(baseState, 'kindred-bond', baseAbility!.effects ?? [], 'withDamage', []);
        const baseNext = applyEvents(baseState.core, baseEvents);

        expect(baseEvents).toContainEqual(expect.objectContaining({
            type: 'DAMAGE_DEALT',
            payload: expect.objectContaining({
                targetId: '1',
                amount: 3,
                actualDamage: 3,
                damageScope: 'direct',
                sourceAbilityId: 'kindred-bond',
            }),
        }));
        expect(baseEvents).toContainEqual(expect.objectContaining({
            type: 'COMPANION_HEALTH_CHANGED',
            payload: expect.objectContaining({
                playerId: '0',
                companionId: 'nyra',
                delta: 1,
                sourceAbilityId: 'kindred-bond',
            }),
        }));
        expect(baseNext.players['1'].resources.hp).toBe(baseHpBefore - 3);
        expect(baseNext.players['0'].companion?.hp).toBe(4);

        const upgradedState = createLierenState();
        setKindredBondDice(upgradedState.core);
        const upgradedEvents = resolve(upgradedState, 'kindred-bond-3', KINDRED_BOND_3.effects ?? [], 'withDamage', []);
        expect(upgradedEvents).toContainEqual(expect.objectContaining({
            type: 'DAMAGE_DEALT',
            payload: expect.objectContaining({
                targetId: '1',
                amount: 4,
                actualDamage: 4,
                damageScope: 'direct',
                sourceAbilityId: 'kindred-bond-3',
            }),
        }));
    });

    it('原始咆哮与血脉相承按奖励骰面治疗妮拉', () => {
        const primitiveState = createLierenState();
        primitiveState.core.players['0'].companion!.hp = 2;
        const primitive = resolveAndSettleBonusDice(
            primitiveState,
            'card-lieren-primitive-roar',
            getCard('card-lieren-primitive-roar').effects,
            'immediate',
            [6],
        );
        expect(primitive.next.players['0'].companion?.hp).toBe(6);

        const bloodlineState = createLierenState();
        bloodlineState.core.players['0'].companion!.hp = 1;
        const bloodline = resolveAndSettleBonusDice(
            bloodlineState,
            'card-lieren-bloodline',
            getCard('card-lieren-bloodline').effects,
            'immediate',
            [5, 6, 1],
        );
        expect(bloodline.events.filter(event => event.type === 'BONUS_DIE_ROLLED')).toHaveLength(3);
        expect(bloodline.next.players['0'].companion?.hp).toBe(5);
    });

    it('妮拉激活时只为一次进攻伤害增加 2', () => {
        const activeState = createLierenState();
        const attackEffect: AbilityEffect = {
            description: 'test attack',
            timing: 'withDamage',
            action: { type: 'damage', target: 'opponent', value: 3 },
        };
        const activeEvents = resolve(activeState, 'nyra-active-test', [attackEffect], 'withDamage', []);
        expect(activeEvents).toContainEqual(expect.objectContaining({
            type: 'DAMAGE_DEALT',
            payload: expect.objectContaining({ amount: 5 }),
        }));

        activeState.core.players['0'].companion!.hp = 0;
        const inactiveEvents = resolve(activeState, 'nyra-inactive-test', [attackEffect], 'withDamage', []);
        expect(inactiveEvents).toContainEqual(expect.objectContaining({
            type: 'DAMAGE_DEALT',
            payload: expect.objectContaining({ amount: 3 }),
        }));
    });

    it('妮拉之系只治疗妮拉，不会改变女猎手生命', () => {
        const state = createLierenState();
        state.core.players['0'].tokens[TOKEN_IDS.NYRAS_BOND] = 1;
        state.core.players['0'].companion!.hp = 4;
        const heroHp = state.core.players['0'].resources.hp;

        const events = execute(state, {
            ...command('USE_TOKEN'),
            payload: { tokenId: TOKEN_IDS.NYRAS_BOND, amount: 1 },
        });
        const next = applyEvents(state.core, events);

        expect(events).toContainEqual(expect.objectContaining({ type: 'COMPANION_HEALTH_CHANGED' }));
        expect(next.players['0'].companion?.hp).toBe(6);
        expect(next.players['0'].resources.hp).toBe(heroHp);
        expect(next.players['0'].tokens[TOKEN_IDS.NYRAS_BOND]).toBe(0);
    });

    it('妮拉承伤只扣伙伴生命，终极攻击不允许转移', () => {
        const state = createLierenState();
        state.core.players['0'].companion!.hp = 7;
        state.core.pendingDamage = {
            id: 'nyra-redirect-test',
            sourcePlayerId: '1',
            targetPlayerId: '0',
            originalDamage: 4,
            currentDamage: 4,
            sourceAbilityId: 'test-hit',
            responseType: 'beforeDamageReceived',
            responderId: '0',
            isFullyEvaded: false,
        };
        const heroHp = state.core.players['0'].resources.hp;
        const redirectEvents = execute(state, {
            ...command('USE_TOKEN'),
            payload: { tokenId: TOKEN_IDS.NYRA_REDIRECT, amount: 4 },
        });
        const redirected = applyEvents(state.core, redirectEvents);

        expect(redirected.players['0'].companion?.hp).toBe(3);
        expect(redirected.players['0'].resources.hp).toBe(heroHp);
        expect(redirected.pendingDamage).toBeUndefined();

        state.core.pendingAttack = { isUltimate: true } as DiceThroneCore['pendingAttack'];
        const ultimateEvents = execute(state, {
            ...command('USE_TOKEN'),
            payload: { tokenId: TOKEN_IDS.NYRA_REDIRECT, amount: 4 },
        });
        expect(ultimateEvents).toEqual([]);
    });

    it('妮拉之系可在已有伤害响应中分配伤害', () => {
        const state = createLierenState();
        state.core.players['0'].tokens[TOKEN_IDS.NYRAS_BOND] = 1;
        state.core.players['0'].companion!.hp = 5;
        state.core.pendingDamage = {
            id: 'nyra-bond-split-test',
            sourcePlayerId: '1',
            targetPlayerId: '0',
            originalDamage: 4,
            currentDamage: 4,
            sourceAbilityId: 'test-hit',
            responseType: 'beforeDamageReceived',
            responderId: '0',
            isFullyEvaded: false,
        };
        const heroHp = state.core.players['0'].resources.hp;

        const events = execute(state, {
            ...command('USE_TOKEN'),
            payload: { tokenId: TOKEN_IDS.NYRAS_BOND, amount: 2 },
        });
        const next = applyEvents(state.core, events);

        expect(next.players['0'].companion?.hp).toBe(3);
        expect(next.players['0'].resources.hp).toBe(heroHp - 2);
        expect(next.players['0'].tokens[TOKEN_IDS.NYRAS_BOND]).toBe(0);
        expect(next.pendingDamage).toBeUndefined();
    });
});
