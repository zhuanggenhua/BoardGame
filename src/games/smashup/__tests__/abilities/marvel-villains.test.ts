import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { fireTriggers, getRegisteredOngoingEffectIds, isBaseAbilitySuppressed, isMinionProtected, isOperationRestricted } from '../../domain/ongoingEffects';
import { getEffectiveBreakpoint, getEffectivePower, getRegisteredModifierIds } from '../../domain/ongoingModifiers';
import { validateActionPlaySemantics } from '../../domain/playLegality';
import { SU_EVENTS } from '../../domain/types';
import { HYDRA_CARDS } from '../../data/factions/hydra';
import { KREE_CARDS } from '../../data/factions/kree';
import { MASTERS_OF_EVIL_CARDS } from '../../data/factions/masters_of_evil';
import { SINISTER_SIX_CARDS } from '../../data/factions/sinister_six';
import {
    applyEvents,
    expectRegisteredAbilityContract,
    invokeRegisteredAbilityContract,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    getPromptMulti,
    getPromptOptions,
    getSimpleChoicePrompt,
    respondToPromptOption,
    respondToPromptOptions,
} from '../helpers';

const FIXED_RANDOM = {
    random: () => 0,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(items: T[]) => [...items],
};

describe('漫威反派四派系代表性玩法行为', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('四个漫威反派派系的主动能力入口已注册', () => {
        const registrations = [
            ['hydra_red_skull', 'talent'],
            ['hydra_hydra_agent', 'onDestroy'],
            ['hydra_hour_of_destiny', 'onPlay'],
            ['kree_minn_erva', 'onPlay'],
            ['kree_relentless_attack', 'talent'],
            ['kree_speed_up', 'onPlay'],
            ['masters_of_evil_absorbing_man', 'talent'],
            ['masters_of_evil_acceptable_losses', 'onPlay'],
            ['masters_of_evil_world_domination', 'talent'],
            ['sinister_six_mysterio', 'talent'],
            ['sinister_six_move_the_goods', 'special'],
            ['sinister_six_reroute_the_power', 'talent'],
        ] as const;

        for (const [defId, tag] of registrations) {
            expect(expectRegisteredAbilityContract(defId, tag), `${defId}::${tag}`).toBeTypeOf('function');
        }
    });

    it('四个漫威反派派系所有 abilityTags 都有局部执行器或持续注册', () => {
        const cards = [
            ...HYDRA_CARDS,
            ...KREE_CARDS,
            ...MASTERS_OF_EVIL_CARDS,
            ...SINISTER_SIX_CARDS,
        ];
        const {
            protectionIds,
            restrictionIds,
            triggerIds,
            baseAbilitySuppressionIds,
        } = getRegisteredOngoingEffectIds();
        const { powerModifierIds, breakpointModifierIds } = getRegisteredModifierIds();

        expect(cards).toHaveLength(49);
        for (const card of cards) {
            for (const tag of card.abilityTags ?? []) {
                if (tag !== 'ongoing') {
                    expect(expectRegisteredAbilityContract(card.id, tag), `${card.id}::${tag}`).toBeTypeOf('function');
                    continue;
                }
                const hasOngoingRegistration =
                    triggerIds.has(card.id)
                    || powerModifierIds.has(card.id)
                    || breakpointModifierIds.has(card.id)
                    || protectionIds.has(card.id)
                    || restrictionIds.has(card.id)
                    || baseAbilitySuppressionIds.has(card.id);
                expect(hasOngoingRegistration, `${card.id}::ongoing`).toBe(true);
            }
        }
    });

    it('九头蛇可通过献祭抽牌、触发低力量额外角色，并计算佐拉和狂热献身力量', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('draw-a', 'hydra_hydra_agent', 'minion', '0'),
                        makeCard('draw-b', 'hydra_hour_of_destiny', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_juice_bar',
                minions: [
                    makeMinion('red', 'hydra_red_skull', '0', 5),
                    makeMinion('zola', 'hydra_arnim_zola', '0', 2),
                    makeMinion('agent', 'hydra_hydra_agent', '0', 2),
                    makeMinion('enemy-low', 'hydra_hydra_agent', '1', 2),
                ],
                ongoingActions: [{ uid: 'devotion', defId: 'hydra_fanatical_devotion', ownerId: '0' }],
            })],
            turnDestroyedMinions: [{ uid: 'gone', defId: 'hydra_hydra_agent', baseIndex: 0, owner: '0', controller: '0' }],
        });

        expect(getEffectivePower(core, core.bases[0].minions[1], 0)).toBe(5);
        expect(getEffectivePower(core, core.bases[0].minions[2], 0)).toBe(4);
        expect(getEffectivePower(core, core.bases[0].minions[3], 0)).toBe(2);

        const talent = invokeRegisteredAbilityContract('hydra_red_skull', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'red',
            defId: 'hydra_red_skull',
            baseIndex: 0,
            targetMinionUid: 'agent',
            random: FIXED_RANDOM,
            now: 10,
        });
        expect(talent.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.MINION_DESTROYED, payload: expect.objectContaining({ minionUid: 'agent' }) }),
            expect.objectContaining({ type: SU_EVENTS.CARDS_DRAWN, payload: expect.objectContaining({ cardUids: ['draw-a'] }) }),
        ]));

        const agentDestroyed = invokeRegisteredAbilityContract('hydra_hydra_agent', 'onDestroy', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'agent',
            defId: 'hydra_hydra_agent',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 11,
        });
        expect(agentDestroyed.events.filter(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toHaveLength(2);
        expect(agentDestroyed.events[0]).toMatchObject({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: { limitType: 'minion', restrictToBase: 0, powerMax: 2 },
        });

        const trigger = fireTriggers(core, 'onMinionDestroyed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            sourceCardUid: 'red',
            sourceDefId: 'hydra_red_skull',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            triggerMinionUid: 'agent',
            triggerMinionDefId: 'hydra_hydra_agent',
            triggerMinion: core.bases[0].minions[2],
            random: FIXED_RANDOM,
            now: 12,
        });
        expect(trigger.events[0]).toMatchObject({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId: '0', count: 1, cardUids: ['draw-a'] },
        });
    });

    it('克里抽牌、额外行动、行动回收和行动数力量修正生效', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    actionsPlayed: 1,
                    extraCardsPlayedThisTurn: 1,
                    deck: [
                        makeCard('draw-a', 'kree_battle_rage', 'action', '0'),
                        makeCard('draw-b', 'kree_kree_sentry', 'minion', '0'),
                        makeCard('draw-c', 'kree_speed_up', 'action', '0'),
                    ],
                    discard: [
                        makeCard('discard-action', 'kree_call_for_backup', 'action', '0'),
                        makeCard('discard-minion', 'kree_kree_sentry', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_juice_bar', [
                makeMinion('sentry', 'kree_kree_sentry', '0', 2),
                makeMinion('ally', 'kree_ronan_the_accuser', '0', 3),
            ])],
        });

        expect(getEffectivePower(core, core.bases[0].minions[0], 0)).toBe(2);
        const afterTwoActionCards = {
            ...core,
            players: {
                ...core.players,
                '0': {
                    ...core.players['0'],
                    actionsPlayed: 1,
                    extraCardsPlayedThisTurn: 1,
                    actionCardsPlayedThisTurn: 2,
                },
            },
        };
        expect(getEffectivePower(afterTwoActionCards, afterTwoActionCards.bases[0].minions[0], 0)).toBe(4);

        const minnErva = invokeRegisteredAbilityContract('kree_minn_erva', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'minn',
            defId: 'kree_minn_erva',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 20,
        });
        expect(minnErva.events[0]).toMatchObject({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { count: 2, cardUids: ['draw-a', 'draw-b'] },
        });

        const ronan = invokeRegisteredAbilityContract('kree_ronan_the_accuser', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'ronan',
            defId: 'kree_ronan_the_accuser',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 21,
        });
        expect(ronan.events[0]).toMatchObject({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: { limitType: 'action', reason: 'kree_ronan_the_accuser' },
        });

        const rage = invokeRegisteredAbilityContract('kree_battle_rage', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'rage',
            defId: 'kree_battle_rage',
            baseIndex: 0,
            targetMinionUid: 'ally',
            random: FIXED_RANDOM,
            now: 22,
        });
        expect(rage.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.TEMP_POWER_ADDED, payload: expect.objectContaining({ minionUid: 'ally', amount: 2 }) }),
            expect.objectContaining({ type: SU_EVENTS.CARDS_DRAWN, payload: expect.objectContaining({ cardUids: ['draw-a'] }) }),
        ]));

        const methods = invokeRegisteredAbilityContract('kree_proven_methods', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'methods',
            defId: 'kree_proven_methods',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 23,
        });
        const methodsPrompt = getSimpleChoicePrompt(methods.matchState!, 'kree_proven_methods');
        expect(getPromptMulti(methodsPrompt)).toMatchObject({ min: 0, max: 1 });
        const methodsOptions = getPromptOptions(methodsPrompt);
        expect(methodsOptions.some(option => option.value?.cardUid === 'discard-action')).toBe(true);
        expect(methodsOptions.some(option => option.value?.cardUid === 'discard-minion')).toBe(false);
        const selectedMethods = respondToPromptOptions(
            methods.matchState!,
            methodsOptions.filter(option => option.value?.cardUid === 'discard-action').map(option => option.id),
            '0',
            FIXED_RANDOM,
        );
        expect(selectedMethods.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.DECK_REORDERED,
                payload: expect.objectContaining({ deckUids: ['discard-action', 'draw-a', 'draw-b', 'draw-c'] }),
            }),
        ]));
    });

    it('九头蛇和克里的检索/回收类行动尊重“至多/任意数量”的玩家选择', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('low-a', 'hydra_hydra_agent', 'minion', '0'),
                        makeCard('action-a', 'kree_speed_up', 'action', '0'),
                        makeCard('high', 'hydra_red_skull', 'minion', '0'),
                        makeCard('action-b', 'kree_call_for_backup', 'action', '0'),
                        makeCard('low-b', 'kree_kree_sentry', 'minion', '0'),
                        makeCard('tail', 'kree_battle_rage', 'action', '0'),
                    ],
                    discard: [
                        makeCard('discard-low-a', 'hydra_hydra_agent', 'minion', '0'),
                        makeCard('discard-low-b', 'kree_kree_sentry', 'minion', '0'),
                        makeCard('discard-high', 'hydra_red_skull', 'minion', '0'),
                        makeCard('discard-action', 'kree_call_for_backup', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_juice_bar')],
        });

        const hour = invokeRegisteredAbilityContract('hydra_hour_of_destiny', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'hour',
            defId: 'hydra_hour_of_destiny',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 24,
        });
        expect(hour.events).toEqual([]);
        const hourPrompt = getSimpleChoicePrompt(hour.matchState!, 'hydra_hour_of_destiny_search');
        expect(getPromptMulti(hourPrompt)).toMatchObject({ min: 0, max: 2 });
        const hourOptions = getPromptOptions(hourPrompt);
        expect(hourOptions.some(option => option.value?.cardUid === 'low-a')).toBe(true);
        expect(hourOptions.some(option => option.value?.cardUid === 'low-b')).toBe(true);
        expect(hourOptions.some(option => option.value?.cardUid === 'high')).toBe(false);
        const selectedHour = respondToPromptOptions(
            hour.matchState!,
            hourOptions.filter(option => option.value?.cardUid === 'low-b').map(option => option.id),
            '0',
            FIXED_RANDOM,
        );
        expect(selectedHour.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.DECK_REORDERED, payload: expect.objectContaining({ deckUids: ['low-b', 'low-a', 'action-a', 'high', 'action-b', 'tail'] }) }),
            expect.objectContaining({ type: SU_EVENTS.CARDS_DRAWN, payload: expect.objectContaining({ cardUids: ['low-b'] }) }),
        ]));

        const reactivate = invokeRegisteredAbilityContract('hydra_reactivate_agents', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'reactivate',
            defId: 'hydra_reactivate_agents',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 25,
        });
        const reactivatePrompt = getSimpleChoicePrompt(reactivate.matchState!, 'hydra_reactivate_agents');
        expect(getPromptMulti(reactivatePrompt)).toMatchObject({ min: 0, max: 2 });
        const reactivateOptions = getPromptOptions(reactivatePrompt);
        expect(reactivateOptions.some(option => option.value?.cardUid === 'discard-high')).toBe(false);
        const selectedReactivate = respondToPromptOptions(
            reactivate.matchState!,
            reactivateOptions.filter(option => option.value?.cardUid === 'discard-low-a').map(option => option.id),
            '0',
            FIXED_RANDOM,
        );
        expect(selectedReactivate.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.CARD_RECOVERED_FROM_DISCARD,
                payload: expect.objectContaining({
                    playerId: '0',
                    cardUids: ['discard-low-a'],
                    reason: 'hydra_reactivate_agents',
                }),
            }),
        ]));

        const reserves = invokeRegisteredAbilityContract('hydra_secret_reserves', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'reserves',
            defId: 'hydra_secret_reserves',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 26,
        });
        const reservesPrompt = getSimpleChoicePrompt(reserves.matchState!, 'hydra_secret_reserves');
        expect(getPromptMulti(reservesPrompt)).toMatchObject({ min: 0, max: 2 });
        const reservesOptions = getPromptOptions(reservesPrompt);
        const selectedReserves = respondToPromptOptions(
            reserves.matchState!,
            reservesOptions.filter(option => option.value?.cardUid === 'discard-low-b').map(option => option.id),
            '0',
            FIXED_RANDOM,
        );
        expect(selectedReserves.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.DECK_REORDERED,
                payload: expect.objectContaining({
                    deckUids: ['low-a', 'action-a', 'high', 'action-b', 'low-b', 'tail', 'discard-low-b'],
                }),
            }),
        ]));

        const prepare = invokeRegisteredAbilityContract('kree_prepare_to_engage', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'prepare',
            defId: 'kree_prepare_to_engage',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 27,
        });
        expect(prepare.events.map(event => event.type)).toEqual([SU_EVENTS.DECK_INSPECTED, SU_EVENTS.REVEAL_DECK_TOP]);
        const preparePrompt = getSimpleChoicePrompt(prepare.matchState!, 'kree_prepare_to_engage');
        expect(getPromptMulti(preparePrompt)).toMatchObject({ min: 0, max: 2 });
        const prepareOptions = getPromptOptions(preparePrompt);
        expect(prepareOptions.map(option => option.value?.cardUid).sort()).toEqual(['action-a', 'action-b']);
        const selectedPrepare = respondToPromptOptions(
            prepare.matchState!,
            prepareOptions.filter(option => option.value?.cardUid === 'action-b').map(option => option.id),
            '0',
            FIXED_RANDOM,
        );
        expect(selectedPrepare.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.DECK_REORDERED, payload: expect.objectContaining({ deckUids: ['action-b', 'low-a', 'action-a', 'high', 'low-b', 'tail'] }) }),
            expect.objectContaining({ type: SU_EVENTS.CARDS_DRAWN, payload: expect.objectContaining({ cardUids: ['action-b'] }) }),
        ]));
    });

    it('邪恶大师直接目标路径会拒绝不符合法定条件的角色', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_juice_bar', [
                makeMinion('own', 'masters_of_evil_absorbing_man', '0', 3),
                makeMinion('small-enemy', 'hydra_hydra_agent', '1', 2),
                makeMinion('big-enemy', 'hydra_red_skull', '1', 5),
            ])],
        });

        const invalidGain = invokeRegisteredAbilityContract('masters_of_evil_gain_the_upper_hand', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'gain',
            defId: 'masters_of_evil_gain_the_upper_hand',
            baseIndex: 0,
            targetMinionUid: 'big-enemy',
            random: FIXED_RANDOM,
            now: 28,
        });
        expect(invalidGain.events).toEqual([]);

        const invalidOwnShockwave = invokeRegisteredAbilityContract('masters_of_evil_sonic_shockwave', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'shock-own',
            defId: 'masters_of_evil_sonic_shockwave',
            baseIndex: 0,
            targetMinionUid: 'own',
            random: FIXED_RANDOM,
            now: 29,
        });
        expect(invalidOwnShockwave.events).toEqual([]);

        const invalidStrongShockwave = invokeRegisteredAbilityContract('masters_of_evil_sonic_shockwave', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'shock-strong',
            defId: 'masters_of_evil_sonic_shockwave',
            baseIndex: 0,
            targetMinionUid: 'big-enemy',
            random: FIXED_RANDOM,
            now: 30,
        });
        expect(invalidStrongShockwave.events).toEqual([]);

        const validShockwave = invokeRegisteredAbilityContract('masters_of_evil_sonic_shockwave', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'shock-small',
            defId: 'masters_of_evil_sonic_shockwave',
            baseIndex: 0,
            targetMinionUid: 'small-enemy',
            random: FIXED_RANDOM,
            now: 31,
        });
        expect(validShockwave.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_DESTROYED,
            payload: expect.objectContaining({ minionUid: 'small-enemy' }),
        }));
    });

    it('邪恶大师按 VP 阈值、摧毁换 VP、计分后 VP 和保护能力结算', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    vp: 8,
                    deck: [makeCard('draw-a', 'masters_of_evil_gain_the_upper_hand', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_juice_bar',
                minions: [
                    makeMinion('zemo', 'masters_of_evil_baron_zemo', '0', 5),
                    makeMinion('mamba', 'masters_of_evil_black_mamba', '0', 3),
                    makeMinion('big', 'masters_of_evil_ulysses_klaw', '0', 4),
                    makeMinion('protected', 'masters_of_evil_absorbing_man', '0', 2, {
                        attachedActions: [{ uid: 'chain', defId: 'masters_of_evil_ball_and_chain', ownerId: '0' }],
                    }),
                    makeMinion('enemy', 'kree_ronan_the_accuser', '1', 3),
                ],
                ongoingActions: [{ uid: 'form', defId: 'masters_of_evil_indestructible_form', ownerId: '0' }],
            })],
        });

        expect(getEffectivePower(core, core.bases[0].minions[1], 0)).toBe(5);
        expect(getEffectivePower(core, core.bases[0].minions[3], 0)).toBe(4);
        expect(isMinionProtected(core, core.bases[0].minions[3], 0, '1', 'destroy')).toBe(true);
        expect(isMinionProtected(core, core.bases[0].minions[3], 0, '0', 'destroy')).toBe(false);
        expect(isMinionProtected(core, core.bases[0].minions[2], 0, '1', 'destroy')).toBe(true);

        const losses = invokeRegisteredAbilityContract('masters_of_evil_acceptable_losses', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'losses',
            defId: 'masters_of_evil_acceptable_losses',
            baseIndex: 0,
            targetMinionUid: 'big',
            random: FIXED_RANDOM,
            now: 30,
        });
        expect(losses.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.MINION_DESTROYED, payload: expect.objectContaining({ minionUid: 'big' }) }),
            expect.objectContaining({ type: SU_EVENTS.VP_AWARDED, payload: { playerId: '0', amount: 1, reason: 'masters_of_evil_acceptable_losses' } }),
        ]));

        const zemoTrigger = fireTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            sourceCardUid: 'zemo',
            sourceDefId: 'masters_of_evil_baron_zemo',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            sourceOwnerPlayerId: '0',
            random: FIXED_RANDOM,
            now: 31,
        });
        expect(zemoTrigger.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.VP_AWARDED, payload: { playerId: '0', amount: 1, reason: 'masters_of_evil_baron_zemo' } }),
            expect.objectContaining({ type: SU_EVENTS.CARD_TO_DECK_BOTTOM, payload: expect.objectContaining({ cardUid: 'zemo' }) }),
        ]));
    });

    it('吸收人没有另一个吸收人时不会创建空选择', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_juice_bar', [
                    makeMinion('absorbing-a', 'masters_of_evil_absorbing_man', '0', 2),
                ]),
            ],
        });

        const result = invokeRegisteredAbilityContract('masters_of_evil_absorbing_man', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'absorbing-a',
            defId: 'masters_of_evil_absorbing_man',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 32,
        });

        expect(result.events).toEqual([]);
        expect(result.matchState).toBeUndefined();
    });

    it('吸收人选择目标时只列出另一个吸收人', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_juice_bar', [
                    makeMinion('absorbing-a', 'masters_of_evil_absorbing_man', '0', 2),
                    makeMinion('absorbing-b', 'masters_of_evil_absorbing_man', '0', 2),
                    makeMinion('zemo', 'masters_of_evil_baron_zemo', '0', 5),
                ]),
            ],
        });

        const result = invokeRegisteredAbilityContract('masters_of_evil_absorbing_man', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'absorbing-a',
            defId: 'masters_of_evil_absorbing_man',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 33,
        });

        const prompt = getSimpleChoicePrompt(result.matchState!, 'marvel_villains_destroy_own_prompt');
        const optionUids = getPromptOptions(prompt).map(option => option.value?.minionUid);
        expect(optionUids).toEqual(['absorbing-b']);
    });

    it('厄运之兆只能打到没有任何角色的基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_juice_bar', [makeMinion('ally', 'masters_of_evil_absorbing_man', '0', 2)]),
                makeBase('base_moon_dumpster'),
            ],
        });

        expect(validateActionPlaySemantics(core, '0', {
            defId: 'masters_of_evil_a_portent_of_doom',
            targetBaseIndex: 0,
        })).toMatchObject({
            valid: false,
            error: '目标基地上不能有任何角色',
        });
        expect(validateActionPlaySemantics(core, '0', {
            defId: 'masters_of_evil_a_portent_of_doom',
            targetBaseIndex: 1,
        })).toEqual({ valid: true });
    });

    it('统治世界在计分后可移动自身到另一基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_juice_bar',
                    ongoingActions: [{ uid: 'world', defId: 'masters_of_evil_world_domination', ownerId: '0' }],
                }),
                makeBase('base_moon_dumpster'),
            ],
        });

        const triggered = fireTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 32,
        });
        const moved = respondToPromptOption(
            triggered.matchState!,
            option => option.value?.baseIndex === 1,
            'world domination destination',
            '0',
            FIXED_RANDOM,
        );
        expect(moved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: expect.objectContaining({ cardUid: 'world', defId: 'masters_of_evil_world_domination' }),
            }),
            expect.objectContaining({
                type: SU_EVENTS.ONGOING_ATTACHED,
                payload: expect.objectContaining({ cardUid: 'world', defId: 'masters_of_evil_world_domination', targetBaseIndex: 1 }),
            }),
        ]));
    });

    it('邪恶六人组降低临界点、低临界点分支、基地能力取消和基地神器移动生效', () => {
        const base = makeBase({
            defId: 'base_juice_bar',
            minions: [
                makeMinion('electro', 'sinister_six_electro', '0', 2),
                makeMinion('sandman', 'sinister_six_sandman', '0', 2),
                makeMinion('enemy', 'kree_kree_sentry', '1', 2),
            ],
            ongoingActions: [
                { uid: 'cover', defId: 'sinister_six_cover_the_exits', ownerId: '0' },
                { uid: 'panic', defId: 'sinister_six_incite_panic', ownerId: '0' },
                { uid: 'witness', defId: 'sinister_six_witness_our_superiority', ownerId: '0' },
            ],
        });
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw-a', 'sinister_six_ambush', 'action', '0')],
                    discard: [makeCard('modifier', 'sinister_six_my_master_plan', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [base, makeBase('base_moon_dumpster')],
        });
        const withoutElectro = makeState({ bases: [{ ...base, minions: base.minions.slice(1) }, makeBase('base_moon_dumpster')] });

        expect(getEffectiveBreakpoint(core, 0)).toBe(getEffectiveBreakpoint(withoutElectro, 0) - 2);
        expect(getEffectivePower(core, core.bases[0].minions[1], 0)).toBe(5);
        expect(getEffectivePower(core, core.bases[0].minions[2], 0)).toBe(1);
        expect(isBaseAbilitySuppressed(core, 0)).toBe(true);
        expect(getEffectiveBreakpoint(core, 0)).toBeLessThanOrEqual(19);
        expect(isOperationRestricted(core, 0, '1', 'play_action', { activationWindow: 'meFirst' })).toBe(true);
        expect(isOperationRestricted(core, 0, '1', 'play_action', { activationWindow: 'afterScoring' })).toBe(true);
        expect(isOperationRestricted(core, 0, '1', 'play_action')).toBe(false);
        expect(isOperationRestricted(core, 0, '0', 'play_action', { activationWindow: 'meFirst' })).toBe(false);
        expect(isOperationRestricted(withoutElectro, 0, '1', 'play_action', { activationWindow: 'meFirst' })).toBe(false);

        const goblin = invokeRegisteredAbilityContract('sinister_six_green_goblin', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'goblin',
            defId: 'sinister_six_green_goblin',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 40,
        });
        expect(goblin.events[0]).toMatchObject({
            type: SU_EVENTS.BREAKPOINT_MODIFIED,
            payload: { baseIndex: 0, delta: -3, reason: 'sinister_six_green_goblin' },
        });

        const vulture = invokeRegisteredAbilityContract('sinister_six_vulture', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'vulture',
            defId: 'sinister_six_vulture',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 41,
        });
        const singleVulturePrompt = getSimpleChoicePrompt(vulture.matchState!, 'sinister_six_vulture');
        const singleVultureOptions = getPromptOptions(singleVulturePrompt);
        expect(singleVultureOptions.some(option => option.value?.skip === true)).toBe(true);
        expect(singleVultureOptions.some(option => option.value?.cardUid === 'modifier')).toBe(true);

        const skippedVulture = respondToPromptOption(
            vulture.matchState!,
            option => option.value?.skip === true,
            '跳过秃鹫单候选',
            '0',
            FIXED_RANDOM,
        );
        expect(skippedVulture.events).not.toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.CARD_TO_DECK_TOP }),
        ]));
        expect(skippedVulture.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['modifier']);
        expect(skippedVulture.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['draw-a']);

        const selectedSingleVulture = respondToPromptOption(
            vulture.matchState!,
            option => option.value?.cardUid === 'modifier',
            '秃鹫选择单候选基地修正',
            '0',
            FIXED_RANDOM,
        );
        expect(selectedSingleVulture.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARD_TO_DECK_TOP,
            payload: expect.objectContaining({ cardUid: 'modifier', defId: 'sinister_six_my_master_plan', ownerId: '0' }),
        }));

        const multiDiscardCore = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [
                        makeCard('cover', 'sinister_six_cover_the_exits', 'action', '0'),
                        makeCard('panic', 'sinister_six_incite_panic', 'action', '0'),
                        makeCard('ambush', 'sinister_six_ambush', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_juice_bar')],
        });
        const selectableVulture = invokeRegisteredAbilityContract('sinister_six_vulture', 'onPlay', {
            state: multiDiscardCore,
            matchState: makeMatchState(multiDiscardCore),
            playerId: '0',
            cardUid: 'vulture-select',
            defId: 'sinister_six_vulture',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 43,
        });
        const vulturePrompt = getSimpleChoicePrompt(selectableVulture.matchState!, 'sinister_six_vulture');
        expect(getPromptOptions(vulturePrompt).some(option => option.value?.cardUid === 'cover')).toBe(true);
        expect(getPromptOptions(vulturePrompt).some(option => option.value?.cardUid === 'panic')).toBe(true);
        expect(getPromptOptions(vulturePrompt).some(option => option.value?.cardUid === 'ambush')).toBe(false);

        const selectedVulture = respondToPromptOption(
            selectableVulture.matchState!,
            option => option.value?.cardUid === 'panic',
            '秃鹫弃牌堆基地修正',
            '0',
            FIXED_RANDOM,
        );
        expect(selectedVulture.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARD_TO_DECK_TOP,
            payload: expect.objectContaining({ cardUid: 'panic', defId: 'sinister_six_incite_panic', ownerId: '0' }),
        }));

        const mysterio = invokeRegisteredAbilityContract('sinister_six_mysterio', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'mysterio',
            defId: 'sinister_six_mysterio',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 42,
        });
        const drawn = respondToPromptOption(
            mysterio.matchState!,
            option => option.value?.mode === 'draw',
            'draw with Mysterio',
            '0',
            FIXED_RANDOM,
        );
        expect(drawn.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.CARDS_DRAWN,
                payload: expect.objectContaining({ playerId: '0', cardUids: ['draw-a'] }),
            }),
        ]));
        const extraModifier = respondToPromptOption(
            mysterio.matchState!,
            option => option.value?.mode === 'extraBaseModifier',
            'extra base modifier with Mysterio',
            '0',
            FIXED_RANDOM,
        );
        expect(extraModifier.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.LIMIT_MODIFIED,
                payload: expect.objectContaining({
                    limitType: 'action',
                    reason: 'sinister_six_mysterio',
                    playTiming: 'immediate',
                    restrictToBase: 0,
                    restrictToBaseModifier: true,
                }),
            }),
        ]));

        const reroute = invokeRegisteredAbilityContract('sinister_six_reroute_the_power', 'talent', {
            state: { ...core, turnNumber: 5, currentPlayerIndex: 0 },
            matchState: makeMatchState({ ...core, turnNumber: 5, currentPlayerIndex: 0 }),
            playerId: '0',
            cardUid: 'reroute',
            defId: 'sinister_six_reroute_the_power',
            baseIndex: 0,
            targetMinionUid: 'sandman',
            random: FIXED_RANDOM,
            now: 43,
        });
        expect(reroute.events[0]).toMatchObject({
            type: SU_EVENTS.PERMANENT_POWER_ADDED,
            payload: {
                minionUid: 'sandman',
                amount: 3,
                expiresOnTurnNumber: 6,
                expiresOnPlayerId: '0',
            },
        });
        const powered = applyEvents({ ...core, turnNumber: 5, currentPlayerIndex: 0 }, reroute.events);
        expect(powered.bases[0].minions.find(minion => minion.uid === 'sandman')?.powerModifier).toBe(3);
        const opponentTurnStarted = applyEvents(powered, [{
            type: SU_EVENTS.TURN_STARTED,
            payload: { playerId: '1', turnNumber: 5 },
            timestamp: 44,
        }]);
        expect(opponentTurnStarted.bases[0].minions.find(minion => minion.uid === 'sandman')?.powerModifier).toBe(3);
        const ownTurnStarted = applyEvents(opponentTurnStarted, [{
            type: SU_EVENTS.TURN_STARTED,
            payload: { playerId: '0', turnNumber: 6 },
            timestamp: 45,
        }]);
        expect(ownTurnStarted.bases[0].minions.find(minion => minion.uid === 'sandman')?.powerModifier).toBe(0);
        expect(ownTurnStarted.timedPowerModifiers).toBeUndefined();
    });

    it('隐藏出口计分后可将至多两个己方角色放到牌库底', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_juice_bar',
                minions: [
                    makeMinion('electro', 'sinister_six_electro', '0', 2),
                    makeMinion('sandman', 'sinister_six_sandman', '0', 2),
                    makeMinion('enemy', 'kree_kree_sentry', '1', 2),
                ],
                ongoingActions: [{ uid: 'cover', defId: 'sinister_six_cover_the_exits', ownerId: '0' }],
            })],
        });

        const triggered = fireTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 46,
        });
        const prompt = getSimpleChoicePrompt(triggered.matchState!, 'marvel_villains_deck_own_minions_prompt');
        const selectedOptionIds = getPromptOptions(prompt)
            .filter(option => ['electro', 'sandman'].includes(option.value?.minionUid))
            .map(option => option.id);
        expect(selectedOptionIds).toHaveLength(2);

        const tucked = respondToPromptOptions(triggered.matchState!, selectedOptionIds, '0', FIXED_RANDOM);
        expect(tucked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.CARD_TO_DECK_BOTTOM, payload: expect.objectContaining({ cardUid: 'electro' }) }),
            expect.objectContaining({ type: SU_EVENTS.CARD_TO_DECK_BOTTOM, payload: expect.objectContaining({ cardUid: 'sandman' }) }),
        ]));
    });

    it('移动货物作为 special 可移动一个基地神器到另一基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_juice_bar',
                    ongoingActions: [{ uid: 'plan', defId: 'sinister_six_my_master_plan', ownerId: '0' }],
                }),
                makeBase('base_moon_dumpster'),
            ],
        });

        const special = invokeRegisteredAbilityContract('sinister_six_move_the_goods', 'special', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'goods',
            defId: 'sinister_six_move_the_goods',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 47,
        });
        const selected = respondToPromptOption(
            special.matchState!,
            option => option.value?.cardUid === 'plan',
            'base modifier source',
            '0',
            FIXED_RANDOM,
        );
        const moved = respondToPromptOption(
            selected.finalState,
            option => option.value?.baseIndex === 1,
            'base modifier destination',
            '0',
            FIXED_RANDOM,
        );
        expect(moved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: expect.objectContaining({ cardUid: 'plan', defId: 'sinister_six_my_master_plan' }),
            }),
            expect.objectContaining({
                type: SU_EVENTS.ONGOING_ATTACHED,
                payload: expect.objectContaining({ cardUid: 'plan', targetBaseIndex: 1 }),
            }),
        ]));
    });
});
