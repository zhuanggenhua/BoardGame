import { describe, expect, it } from 'vitest';

import type { DiceThroneCore, DiceThroneCommand, DiceThroneEvent } from '../domain/types';
import { execute } from '../domain/execute';
import { reduce } from '../domain/reducer';
import { resolveEffectsToEvents } from '../domain/effects';
import { RESOURCE_IDS } from '../domain/resources';
import { STATUS_IDS, TOKEN_IDS } from '../domain/ids';
import { INITIAL_HEALTH } from '../domain/types';
import { createHeroMatchup, fixedRandom, getCardById } from './test-utils';

const applyEvents = (core: DiceThroneCore, events: DiceThroneEvent[]): DiceThroneCore =>
    events.reduce((current, event) => reduce(current, event), core);

const command = (
    type: DiceThroneCommand['type'],
    playerId: string,
    payload: Record<string, unknown> = {},
): DiceThroneCommand => ({
    type,
    playerId,
    payload,
    timestamp: 100,
} as DiceThroneCommand);

const eventsOfType = <T extends DiceThroneEvent['type']>(events: DiceThroneEvent[], type: T) =>
    events.filter((event): event is Extract<DiceThroneEvent, { type: T }> => event.type === type);

const createVampireLordState = () => createHeroMatchup('vampire_lord', 'monk')(['0', '1'], fixedRandom);

const getAbilityEffects = (core: DiceThroneCore, playerId: string, abilityId: string) => {
    const ability = core.players[playerId].abilities.find(entry => entry.id === abilityId);
    if (!ability?.effects) {
        throw new Error(`找不到吸血鬼领主技能效果: ${abilityId}`);
    }
    return ability.effects;
};

const getAbilityVariantEffects = (core: DiceThroneCore, playerId: string, abilityId: string, variantId: string) => {
    const ability = core.players[playerId].abilities.find(entry => entry.id === abilityId);
    const variant = ability?.variants?.find(entry => entry.id === variantId);
    if (!variant?.effects) {
        throw new Error(`找不到吸血鬼领主技能分支效果: ${abilityId}/${variantId}`);
    }
    return variant.effects;
};

const playVampireLordCard = (cardId: string, options: { cp?: number } = {}) => {
    const state = createVampireLordState();
    state.sys.phase = 'main1';
    state.core.players['0'].resources[RESOURCE_IDS.CP] = options.cp ?? 10;
    state.core.players['0'].hand = [getCardById(cardId)];
    state.core.players['0'].deck = [];
    state.core.players['0'].discard = [];

    const events = execute(
        state,
        command('PLAY_CARD', '0', { cardId }),
        fixedRandom,
    ) as DiceThroneEvent[];
    const next = applyEvents(state.core, events);

    return { events, next };
};

describe('DiceThrone 吸血鬼领主机制实现矩阵', () => {
    it('鲜血盛宴的治疗与鲜血之力获得落到最终 HP / token 状态，并按上限封顶', () => {
        const state = createVampireLordState();
        state.core.players['0'].resources[RESOURCE_IDS.HP] = INITIAL_HEALTH - 6;
        state.core.players['0'].tokens[TOKEN_IDS.BLOOD_POWER] = 4;

        const events = resolveEffectsToEvents(
            getAbilityEffects(state.core, '0', 'blood-feast'),
            'preDefense',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'blood-feast',
                state: state.core,
                damageDealt: 0,
                timestamp: 100,
            },
            { random: fixedRandom },
        );
        const next = applyEvents(state.core, events);

        expect(eventsOfType(events, 'HEAL_APPLIED')).toHaveLength(1);
        expect(eventsOfType(events, 'TOKEN_GRANTED')).toEqual([
            expect.objectContaining({
                payload: expect.objectContaining({
                    targetId: '0',
                    tokenId: TOKEN_IDS.BLOOD_POWER,
                    amount: 1,
                    newTotal: 5,
                    sourceAbilityId: 'blood-feast',
                }),
            }),
        ]);
        expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 4);
        expect(next.players['0'].tokens[TOKEN_IDS.BLOOD_POWER]).toBe(5);
    });

    it('撕裂之爪把流血施加给对手，并通过攻击伤害扣减对手 HP', () => {
        const state = createVampireLordState();
        const effects = getAbilityEffects(state.core, '0', 'rend-claws');

        const preDefenseEvents = resolveEffectsToEvents(
            effects,
            'preDefense',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'rend-claws',
                state: state.core,
                damageDealt: 0,
                timestamp: 100,
            },
            { random: fixedRandom },
        );
        const afterStatus = applyEvents(state.core, preDefenseEvents);
        const damageEvents = resolveEffectsToEvents(
            effects,
            'withDamage',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'rend-claws',
                state: afterStatus,
                damageDealt: 0,
                timestamp: 110,
            },
            { random: fixedRandom },
        );
        const next = applyEvents(afterStatus, damageEvents);

        expect(eventsOfType(preDefenseEvents, 'STATUS_APPLIED')).toEqual([
            expect.objectContaining({
                payload: expect.objectContaining({
                    targetId: '1',
                    statusId: STATUS_IDS.BLEED,
                    stacks: 1,
                    newTotal: 1,
                    sourceAbilityId: 'rend-claws',
                }),
            }),
        ]);
        expect(eventsOfType(damageEvents, 'DAMAGE_DEALT')).toEqual([
            expect.objectContaining({
                payload: expect.objectContaining({
                    targetId: '1',
                    amount: 6,
                    actualDamage: 6,
                    damageScope: 'attack',
                    sourceAbilityId: 'rend-claws',
                }),
            }),
        ]);
        expect(next.players['1'].statusEffects[STATUS_IDS.BLEED]).toBe(1);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 6);
    });

    it('血色杀戮同时获得鲜血之力、施加 2 层流血，并造成 12 点攻击伤害', () => {
        const state = createVampireLordState();
        const effects = getAbilityEffects(state.core, '0', 'bloody-slaughter');

        const preDefenseEvents = resolveEffectsToEvents(
            effects,
            'preDefense',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'bloody-slaughter',
                state: state.core,
                damageDealt: 0,
                timestamp: 100,
            },
            { random: fixedRandom },
        );
        const afterPreDefense = applyEvents(state.core, preDefenseEvents);
        const damageEvents = resolveEffectsToEvents(
            effects,
            'withDamage',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'bloody-slaughter',
                state: afterPreDefense,
                damageDealt: 0,
                timestamp: 110,
            },
            { random: fixedRandom },
        );
        const next = applyEvents(afterPreDefense, damageEvents);

        expect(next.players['0'].tokens[TOKEN_IDS.BLOOD_POWER]).toBe(2);
        expect(next.players['1'].statusEffects[STATUS_IDS.BLEED]).toBe(2);
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 12);
    });

    it('其余基础共享技能把获得标记、流血与攻击伤害落到最终状态', () => {
        const cases = [
            { abilityId: 'mesmerize-power', expectedMesmerize: 1, expectedDamage: 4 },
            { abilityId: 'blood-possessed', expectedBloodPower: 2, expectedDamage: 6 },
            { abilityId: 'blood-thirst', expectedBleed: 1, expectedDamage: 4 },
            { abilityId: 'blood-magic', expectedBloodPower: 2, expectedDamage: 7 },
        ];

        for (const { abilityId, expectedMesmerize = 0, expectedBloodPower = 0, expectedBleed = 0, expectedDamage } of cases) {
            const state = createVampireLordState();
            const effects = getAbilityEffects(state.core, '0', abilityId);
            const preDefenseEvents = resolveEffectsToEvents(
                effects,
                'preDefense',
                {
                    attackerId: '0',
                    defenderId: '1',
                    sourceAbilityId: abilityId,
                    state: state.core,
                    damageDealt: 0,
                    timestamp: 100,
                },
                { random: fixedRandom },
            );
            const afterPreDefense = applyEvents(state.core, preDefenseEvents);
            const damageEvents = resolveEffectsToEvents(
                effects,
                'withDamage',
                {
                    attackerId: '0',
                    defenderId: '1',
                    sourceAbilityId: abilityId,
                    state: afterPreDefense,
                    damageDealt: 0,
                    timestamp: 110,
                },
                { random: fixedRandom },
            );
            const next = applyEvents(afterPreDefense, damageEvents);

            expect(next.players['0'].tokens[TOKEN_IDS.MESMERIZE]).toBe(expectedMesmerize);
            expect(next.players['0'].tokens[TOKEN_IDS.BLOOD_POWER]).toBe(expectedBloodPower);
            expect(next.players['1'].statusEffects[STATUS_IDS.BLEED] ?? 0).toBe(expectedBleed);
            expect(eventsOfType(damageEvents, 'DAMAGE_DEALT')[0]?.payload).toMatchObject({
                targetId: '1',
                amount: expectedDamage,
                actualDamage: expectedDamage,
                damageScope: 'attack',
                sourceAbilityId: abilityId,
            });
            expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - expectedDamage);
        }
    });

    it('不死之身 I / II 防御效果在防御上下文中反击对手并治疗自己', () => {
        const cases = [
            { core: createVampireLordState().core, expectedLevel: 1 },
            { core: playVampireLordCard('upgrade-vampire-lord-undying-2', { cp: 10 }).next, expectedLevel: 2 },
        ];

        for (const { core, expectedLevel } of cases) {
            core.players['0'].resources[RESOURCE_IDS.HP] = INITIAL_HEALTH - 3;
            expect(core.players['0'].abilityLevels['undying']).toBe(expectedLevel);

            const effects = getAbilityEffects(core, '0', 'undying');
            const damageEvents = resolveEffectsToEvents(
                effects,
                'withDamage',
                {
                    attackerId: '0',
                    defenderId: '1',
                    sourceAbilityId: 'undying',
                    state: core,
                    damageDealt: 0,
                    timestamp: 100,
                    isDefensiveContext: true,
                },
                { random: fixedRandom },
            );
            const afterDamage = applyEvents(core, damageEvents);
            const postDamageEvents = resolveEffectsToEvents(
                effects,
                'postDamage',
                {
                    attackerId: '0',
                    defenderId: '1',
                    sourceAbilityId: 'undying',
                    state: afterDamage,
                    damageDealt: 1,
                    timestamp: 110,
                    isDefensiveContext: true,
                },
                { random: fixedRandom },
            );
            const next = applyEvents(afterDamage, postDamageEvents);

            expect(eventsOfType(damageEvents, 'DAMAGE_DEALT')[0]?.payload).toMatchObject({
                targetId: '1',
                amount: 1,
                actualDamage: 1,
                damageScope: 'direct',
                sourceAbilityId: 'undying',
            });
            expect(eventsOfType(postDamageEvents, 'HEAL_APPLIED')[0]?.payload).toMatchObject({
                targetId: '0',
                amount: 1,
                sourceAbilityId: 'undying',
            });
            expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 2);
            expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 1);
        }
    });

    it('血石行动牌扣 CP、进入弃牌堆，并结算催眠、鲜血之力、流血和抽牌', () => {
        const state = createVampireLordState();
        state.sys.phase = 'main1';
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 10;
        state.core.players['0'].hand = [getCardById('card-vampire-lord-bloodstone')];
        state.core.players['0'].deck = [getCardById('card-vampire-lord-blood-surge')];
        state.core.players['0'].discard = [];

        const events = execute(
            state,
            command('PLAY_CARD', '0', { cardId: 'card-vampire-lord-bloodstone' }),
            fixedRandom,
        ) as DiceThroneEvent[];
        const next = applyEvents(state.core, events);

        expect(eventsOfType(events, 'CARD_PLAYED')).toHaveLength(1);
        expect(eventsOfType(events, 'TOKEN_GRANTED').map(event => event.payload)).toEqual([
            expect.objectContaining({ targetId: '0', tokenId: TOKEN_IDS.MESMERIZE, amount: 1, newTotal: 1 }),
            expect.objectContaining({ targetId: '0', tokenId: TOKEN_IDS.BLOOD_POWER, amount: 2, newTotal: 2 }),
        ]);
        expect(eventsOfType(events, 'STATUS_APPLIED')[0]?.payload).toMatchObject({
            targetId: '1',
            statusId: STATUS_IDS.BLEED,
            stacks: 1,
            newTotal: 1,
        });
        expect(eventsOfType(events, 'CARD_DRAWN')[0]?.payload).toMatchObject({
            playerId: '0',
            cardId: 'card-vampire-lord-blood-surge',
            sourceAbilityId: 'card-vampire-lord-bloodstone',
        });
        expect(next.players['0'].resources[RESOURCE_IDS.CP]).toBe(6);
        expect(next.players['0'].tokens[TOKEN_IDS.MESMERIZE]).toBe(1);
        expect(next.players['0'].tokens[TOKEN_IDS.BLOOD_POWER]).toBe(2);
        expect(next.players['1'].statusEffects[STATUS_IDS.BLEED]).toBe(1);
        expect(next.players['0'].hand.map(card => card.id)).toEqual(['card-vampire-lord-blood-surge']);
        expect(next.players['0'].discard.map(card => card.id)).toEqual(['card-vampire-lord-bloodstone']);
    });

    it('主阶段获得类专属行动牌扣费后进入弃牌堆，并授予对应标记', () => {
        const cases = [
            { cardId: 'card-vampire-lord-blood-surge', cpCost: 1, expectedBloodPower: 1, expectedMesmerize: 0 },
            { cardId: 'card-vampire-lord-blood-from-above', cpCost: 1, expectedBloodPower: 1, expectedMesmerize: 0 },
            { cardId: 'card-vampire-lord-gushing-blood', cpCost: 0, expectedBloodPower: 1, expectedMesmerize: 1 },
            { cardId: 'card-vampire-lord-drink-up', cpCost: 0, expectedBloodPower: 2, expectedMesmerize: 0 },
        ];

        for (const { cardId, cpCost, expectedBloodPower, expectedMesmerize } of cases) {
            const { events, next } = playVampireLordCard(cardId, { cp: 10 });

            expect(eventsOfType(events, 'CARD_PLAYED')[0]?.payload).toMatchObject({
                playerId: '0',
                cardId,
                cpCost,
            });
            expect(next.players['0'].resources[RESOURCE_IDS.CP]).toBe(10 - cpCost);
            expect(next.players['0'].tokens[TOKEN_IDS.BLOOD_POWER]).toBe(expectedBloodPower);
            expect(next.players['0'].tokens[TOKEN_IDS.MESMERIZE]).toBe(expectedMesmerize);
            expect(next.players['0'].hand).toHaveLength(0);
            expect(next.players['0'].discard.map(card => card.id)).toEqual([cardId]);
        }
    });

    it('嗜血之爪 II 升级牌替换基础技能并更新升级等级', () => {
        const state = createVampireLordState();
        state.sys.phase = 'main1';
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 10;
        state.core.players['0'].hand = [getCardById('upgrade-vampire-lord-bloodthirsty-claws-2')];

        const events = execute(
            state,
            command('PLAY_CARD', '0', { cardId: 'upgrade-vampire-lord-bloodthirsty-claws-2' }),
            fixedRandom,
        ) as DiceThroneEvent[];
        const next = applyEvents(state.core, events);
        const upgradedAbility = next.players['0'].abilities.find(ability => ability.id === 'bloodthirsty-claws');
        const upgradedFourClaws = upgradedAbility?.variants?.find(variant => variant.id === 'bloodthirsty-claws-2-4');

        expect(eventsOfType(events, 'CP_CHANGED')[0]?.payload).toMatchObject({
            playerId: '0',
            delta: -2,
            newValue: 8,
        });
        expect(eventsOfType(events, 'ABILITY_REPLACED')[0]?.payload).toMatchObject({
            playerId: '0',
            oldAbilityId: 'bloodthirsty-claws',
            cardId: 'upgrade-vampire-lord-bloodthirsty-claws-2',
            newLevel: 2,
        });
        expect(next.players['0'].abilityLevels['bloodthirsty-claws']).toBe(2);
        expect(next.players['0'].upgradeCardByAbilityId['bloodthirsty-claws']).toEqual({
            cardId: 'upgrade-vampire-lord-bloodthirsty-claws-2',
            cpCost: 2,
        });
        expect(upgradedAbility?.id).toBe('bloodthirsty-claws');
        expect(upgradedFourClaws?.effects[0]?.action).toMatchObject({
            type: 'damage',
            target: 'opponent',
            value: 5,
        });
        expect(next.players['0'].resources[RESOURCE_IDS.CP]).toBe(8);
        expect(next.players['0'].hand).toHaveLength(0);
    });

    it('其余普通升级牌扣 CP、替换目标基础技能并写入升级槽', () => {
        const cases = [
            { cardId: 'upgrade-vampire-lord-undying-2', targetAbilityId: 'undying', level: 2, cpCost: 2 },
            { cardId: 'upgrade-vampire-lord-blood-thirst-2-blood-river', targetAbilityId: 'blood-thirst', level: 2, cpCost: 2 },
            { cardId: 'upgrade-vampire-lord-blood-magic-2-flayed', targetAbilityId: 'blood-magic', level: 2, cpCost: 2 },
            { cardId: 'upgrade-vampire-lord-blood-possessed-2-blood-addiction', targetAbilityId: 'blood-possessed', level: 2, cpCost: 2 },
            { cardId: 'upgrade-vampire-lord-rend-claws-2', targetAbilityId: 'rend-claws', level: 2, cpCost: 2 },
            { cardId: 'upgrade-vampire-lord-blood-feast-2-dressed-to-kill', targetAbilityId: 'blood-feast', level: 2, cpCost: 2 },
            { cardId: 'upgrade-vampire-lord-mesmerize-power-2-soul-gaze', targetAbilityId: 'mesmerize-power', level: 2, cpCost: 2 },
        ];

        for (const { cardId, targetAbilityId, level, cpCost } of cases) {
            const { events, next } = playVampireLordCard(cardId, { cp: 10 });

            expect(eventsOfType(events, 'CP_CHANGED')[0]?.payload).toMatchObject({
                playerId: '0',
                delta: -cpCost,
                newValue: 10 - cpCost,
            });
            expect(eventsOfType(events, 'ABILITY_REPLACED')[0]?.payload).toMatchObject({
                playerId: '0',
                oldAbilityId: targetAbilityId,
                cardId,
                newLevel: level,
            });
            expect(next.players['0'].abilityLevels[targetAbilityId]).toBe(level);
            expect(next.players['0'].upgradeCardByAbilityId[targetAbilityId]).toEqual({ cardId, cpCost });
            expect(next.players['0'].abilities.some(ability => ability.id === targetAbilityId)).toBe(true);
            expect(next.players['0'].resources[RESOURCE_IDS.CP]).toBe(10 - cpCost);
            expect(next.players['0'].hand).toHaveLength(0);
        }
    });

    it('嗜血之爪 III 分支通过同一伤害结算入口造成 8 点攻击伤害', () => {
        const state = createVampireLordState();
        const upgradeEvents = resolveEffectsToEvents(
            getCardById('upgrade-vampire-lord-bloodthirsty-claws-3').effects ?? [],
            'immediate',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'upgrade-vampire-lord-bloodthirsty-claws-3',
                state: state.core,
                damageDealt: 0,
                timestamp: 100,
            },
            { random: fixedRandom },
        );
        const upgraded = applyEvents(state.core, upgradeEvents);
        const damageEvents = resolveEffectsToEvents(
            getAbilityVariantEffects(upgraded, '0', 'bloodthirsty-claws', 'bloodthirsty-claws-3-5'),
            'withDamage',
            {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'bloodthirsty-claws',
                state: upgraded,
                damageDealt: 0,
                timestamp: 110,
            },
            { random: fixedRandom },
        );
        const next = applyEvents(upgraded, damageEvents);

        expect(next.players['0'].abilityLevels['bloodthirsty-claws']).toBe(3);
        expect(eventsOfType(damageEvents, 'DAMAGE_DEALT')[0]?.payload).toMatchObject({
            targetId: '1',
            amount: 8,
            actualDamage: 8,
            damageScope: 'attack',
            sourceAbilityId: 'bloodthirsty-claws',
        });
        expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 8);
    });

    it('升级后的共享技能上区效果继续落到 HP、token、流血与攻击伤害', () => {
        const cases = [
            {
                cardId: 'upgrade-vampire-lord-blood-feast-2-dressed-to-kill',
                abilityId: 'blood-feast',
                expectedSelfHp: INITIAL_HEALTH - 4,
                expectedBloodPower: 3,
                expectedBleed: 0,
                expectedDamage: 7,
            },
            {
                cardId: 'upgrade-vampire-lord-rend-claws-2',
                abilityId: 'rend-claws',
                expectedSelfHp: INITIAL_HEALTH - 6,
                expectedBloodPower: 0,
                expectedBleed: 1,
                expectedDamage: 6,
            },
            {
                cardId: 'upgrade-vampire-lord-blood-possessed-2-blood-addiction',
                abilityId: 'blood-possessed',
                expectedSelfHp: INITIAL_HEALTH - 6,
                expectedBloodPower: 2,
                expectedBleed: 0,
                expectedDamage: 8,
            },
            {
                cardId: 'upgrade-vampire-lord-blood-thirst-2-blood-river',
                abilityId: 'blood-thirst',
                expectedSelfHp: INITIAL_HEALTH - 6,
                expectedBloodPower: 0,
                expectedBleed: 2,
                expectedDamage: 6,
            },
            {
                cardId: 'upgrade-vampire-lord-blood-magic-2-flayed',
                abilityId: 'blood-magic',
                expectedSelfHp: INITIAL_HEALTH - 6,
                expectedBloodPower: 2,
                expectedBleed: 0,
                expectedDamage: 8,
            },
            {
                cardId: 'upgrade-vampire-lord-mesmerize-power-2-soul-gaze',
                abilityId: 'mesmerize-power',
                expectedSelfHp: INITIAL_HEALTH - 6,
                expectedBloodPower: 0,
                expectedBleed: 0,
                expectedMesmerize: 1,
                expectedDamage: 5,
            },
        ];

        for (const {
            cardId,
            abilityId,
            expectedSelfHp,
            expectedBloodPower,
            expectedBleed,
            expectedMesmerize = 0,
            expectedDamage,
        } of cases) {
            const { next: upgraded } = playVampireLordCard(cardId, { cp: 10 });
            upgraded.players['0'].resources[RESOURCE_IDS.HP] = INITIAL_HEALTH - 6;
            const effects = getAbilityEffects(upgraded, '0', abilityId);

            const preDefenseEvents = resolveEffectsToEvents(
                effects,
                'preDefense',
                {
                    attackerId: '0',
                    defenderId: '1',
                    sourceAbilityId: abilityId,
                    state: upgraded,
                    damageDealt: 0,
                    timestamp: 100,
                },
                { random: fixedRandom },
            );
            const afterPreDefense = applyEvents(upgraded, preDefenseEvents);
            const damageEvents = resolveEffectsToEvents(
                effects,
                'withDamage',
                {
                    attackerId: '0',
                    defenderId: '1',
                    sourceAbilityId: abilityId,
                    state: afterPreDefense,
                    damageDealt: 0,
                    timestamp: 110,
                },
                { random: fixedRandom },
            );
            const next = applyEvents(afterPreDefense, damageEvents);

            expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(expectedSelfHp);
            expect(next.players['0'].tokens[TOKEN_IDS.BLOOD_POWER]).toBe(expectedBloodPower);
            expect(next.players['0'].tokens[TOKEN_IDS.MESMERIZE]).toBe(expectedMesmerize);
            expect(next.players['1'].statusEffects[STATUS_IDS.BLEED] ?? 0).toBe(expectedBleed);
            expect(eventsOfType(damageEvents, 'DAMAGE_DEALT')[0]?.payload).toMatchObject({
                targetId: '1',
                amount: expectedDamage,
                actualDamage: expectedDamage,
                damageScope: 'attack',
                sourceAbilityId: abilityId,
            });
            expect(next.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - expectedDamage);
        }
    });
});
