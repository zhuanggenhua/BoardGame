import { beforeEach, describe, expect, it } from 'vitest';

import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { INTERNATIONAL_INCIDENT_BASES, INTERNATIONAL_INCIDENT_CARDS } from '../../data/factions/international_incident';
import { getDiscardSpecialOptions } from '../../domain/discardSpecialAbilities';
import { isCardSuppressed, isMinionProtected } from '../../domain/ongoingEffects';
import {
    getEffectivePower,
    getPlayerEffectivePowerOnBase,
    getTotalEffectivePowerOnBase,
} from '../../domain/ongoingModifiers';
import { executeTriggerProgramExecutor } from '../../domain/triggerExecutors';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import {
    applyEvents,
    expectRegisteredAbilityContract,
    getFirstPrompt,
    getPromptOptions,
    invokeRegisteredAbilityContract,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPromptOption,
    respondToPromptOptions,
} from '../helpers';
import { runCommand } from '../testRunner';

const FIXED_RANDOM = {
    random: () => 0,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(items: T[]) => [...items],
};

describe('国际事件四派系代表性玩法行为', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('四派系静态牌组合同保持 51 张唯一卡面、80 张实体牌和 8 张基地', () => {
        expect(INTERNATIONAL_INCIDENT_CARDS).toHaveLength(51);
        expect(INTERNATIONAL_INCIDENT_CARDS.reduce((total, card) => total + card.count, 0)).toBe(80);
        expect(INTERNATIONAL_INCIDENT_CARDS.map(card => card.previewRef?.index).sort((a, b) => Number(a) - Number(b))).toEqual(
            Array.from({ length: 51 }, (_unused, index) => index),
        );
        expect(INTERNATIONAL_INCIDENT_BASES).toHaveLength(8);
        expect(INTERNATIONAL_INCIDENT_BASES.map(base => base.previewRef?.index).sort((a, b) => Number(a) - Number(b))).toEqual(
            [8, 9, 10, 11, 12, 13, 14, 15],
        );
    });

    it('代表性主动能力入口已注册', () => {
        const registrations = [
            ['sumo_wrestlers_technique_prize', 'onPlay'],
            ['sumo_wrestlers_yokozuna', 'talent'],
            ['musketeers_en_garde', 'onPlay'],
            ['musketeers_last_stand', 'special'],
            ['mounties_eh', 'special'],
            ['mounties_haich_q', 'talent'],
            ['luchadors_yellow_demon', 'onPlay'],
            ['luchadors_senor_muchoslam', 'talent'],
        ] as const;

        for (const [defId, tag] of registrations) {
            expect(expectRegisteredAbilityContract(defId, tag), `${defId}::${tag}`).toBeTypeOf('function');
        }
    });

    it('相扑手的技术奖给己方唯一随从放置 3 个力量指示物', () => {
        const core = makeState({
            bases: [makeBase('base_the_dohyo', [
                makeMinion('rookie', 'sumo_wrestlers_rookie_sumo', '0', 2),
                makeMinion('enemy', 'musketeers_young_musketeer', '1', 3),
            ])],
        });

        const result = invokeRegisteredAbilityContract('sumo_wrestlers_technique_prize', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'technique',
            defId: 'sumo_wrestlers_technique_prize',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const after = applyEvents(core, result.events);

        expect(after.bases[0].minions[0].powerCounters).toBe(3);
        expect(getEffectivePower(after, after.bases[0].minions[0], 0)).toBe(5);
        expect(after.bases[0].minions[1].powerCounters ?? 0).toBe(0);
    });

    it('相扑手力量满溢可不弃牌给 +2，也可弃 1 张牌改为 +4', () => {
        const plusTwoCore = makeState({
            bases: [makeBase('base_the_dohyo', [
                makeMinion('rookie', 'sumo_wrestlers_rookie_sumo', '0', 2),
            ])],
        });
        const plusTwo = invokeRegisteredAbilityContract('sumo_wrestlers_chikara_mizu', 'onPlay', {
            state: plusTwoCore,
            matchState: makeMatchState(plusTwoCore),
            playerId: '0',
            cardUid: 'chikara-action',
            defId: 'sumo_wrestlers_chikara_mizu',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 12,
        });
        const plusTwoMode = respondToPromptOption(
            plusTwo.matchState!,
            option => option.value?.mode === 'power2',
            '力量满溢 +2 模式',
            '0',
            FIXED_RANDOM,
        );
        expect(plusTwoMode.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.TEMP_POWER_ADDED,
            payload: expect.objectContaining({
                minionUid: 'rookie',
                amount: 2,
                reason: 'sumo_wrestlers_chikara_mizu',
            }),
        }));

        const plusFourCore = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('discard-fodder', 'sumo_wrestlers_grasp_the_belt', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_the_dohyo', [
                makeMinion('rookie', 'sumo_wrestlers_rookie_sumo', '0', 2),
                makeMinion('top-tier', 'sumo_wrestlers_top_tier', '0', 4),
            ])],
        });
        const plusFour = invokeRegisteredAbilityContract('sumo_wrestlers_chikara_mizu', 'onPlay', {
            state: plusFourCore,
            matchState: makeMatchState(plusFourCore),
            playerId: '0',
            cardUid: 'chikara-action',
            defId: 'sumo_wrestlers_chikara_mizu',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 13,
        });
        const target = respondToPromptOption(
            plusFour.matchState!,
            option => option.value?.minionUid === 'rookie',
            '力量满溢目标随从',
            '0',
            FIXED_RANDOM,
        );
        const mode = respondToPromptOption(
            target.finalState,
            option => option.value?.mode === 'discardPower4',
            '力量满溢弃牌 +4 模式',
            '0',
            FIXED_RANDOM,
        );
        const discard = respondToPromptOption(
            mode.finalState,
            option => option.value?.cardUid === 'discard-fodder',
            '力量满溢弃牌目标',
            '0',
            FIXED_RANDOM,
        );
        expect(discard.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: expect.objectContaining({ playerId: '0', cardUids: ['discard-fodder'] }),
            }),
            expect.objectContaining({
                type: SU_EVENTS.TEMP_POWER_ADDED,
                payload: expect.objectContaining({
                    minionUid: 'rookie',
                    amount: 4,
                    reason: 'sumo_wrestlers_chikara_mizu',
                }),
            }),
        ]));
        expect(discard.finalState.core.players['0'].hand).toHaveLength(0);
        expect(discard.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['discard-fodder']);
        expect(discard.finalState.core.bases[0].minions[0].tempPowerModifier).toBe(4);
        expect(getEffectivePower(discard.finalState.core, discard.finalState.core.bases[0].minions[0], 0)).toBe(6);
    });

    it('横纲和战斗麋鹿按来源玩家保护己方随从', () => {
        const yokozunaCore = makeState({
            bases: [makeBase('base_the_dohyo', [
                makeMinion('yokozuna', 'sumo_wrestlers_yokozuna', '0', 6),
                makeMinion('rookie', 'sumo_wrestlers_rookie_sumo', '0', 2),
            ])],
        });

        expect(isMinionProtected(yokozunaCore, yokozunaCore.bases[0].minions[1], 0, '1', 'move')).toBe(true);
        expect(isMinionProtected(yokozunaCore, yokozunaCore.bases[0].minions[1], 0, '0', 'move')).toBe(false);

        const mooseCore = makeState({
            bases: [makeBase('base_great_white_north_eh', [
                makeMinion('host', 'mounties_dudlee', '0', 2, {
                    attachedActions: [{ uid: 'moose', defId: 'mounties_battle_moose', ownerId: '0' }],
                }),
                makeMinion('ally', 'mounties_war_canuck', '0', 3),
                makeMinion('enemy', 'musketeers_young_musketeer', '1', 3),
            ])],
        });

        expect(isMinionProtected(mooseCore, mooseCore.bases[0].minions[1], 0, '1', 'destroy')).toBe(true);
        expect(isMinionProtected(mooseCore, mooseCore.bases[0].minions[1], 0, '0', 'destroy')).toBe(false);
        expect(isMinionProtected(mooseCore, mooseCore.bases[0].minions[2], 0, '0', 'destroy')).toBe(false);
    });

    it('骑警的 Haich-Q 和骑警少校持续力量修正计入有效力量', () => {
        const core = makeState({
            bases: [makeBase({
                defId: 'base_strategic_syrup_reserve',
                ongoingActions: [{ uid: 'haich-q', defId: 'mounties_haich_q', ownerId: '0' }],
                minions: [
                    makeMinion('major', 'mounties_mountie_major', '0', 4),
                    makeMinion('ally', 'mounties_dudlee', '0', 2),
                    makeMinion('enemy-a', 'musketeers_young_musketeer', '1', 3),
                    makeMinion('enemy-b', 'musketeers_young_musketeer', '1', 3),
                ],
            })],
        });

        expect(getEffectivePower(core, core.bases[0].minions[0], 0)).toBe(7);
        expect(getEffectivePower(core, core.bases[0].minions[1], 0)).toBe(3);
        expect(getEffectivePower(core, core.bases[0].minions[2], 0)).toBe(3);
    });

    it('摔角手的强力 Set-Up 和 Flor Loca 按行动控制者加力量', () => {
        const core = makeState({
            bases: [makeBase('base_the_dohyo', [
                makeMinion('flor', 'luchadors_flor_loca', '0', 3),
                makeMinion('ally', 'luchadors_capa_roja', '0', 4),
                makeMinion('host', 'musketeers_young_musketeer', '1', 3, {
                    attachedActions: [{ uid: 'setup', defId: 'luchadors_powerful_set_up', ownerId: '0' }],
                }),
            ])],
        });

        expect(getEffectivePower(core, core.bases[0].minions[0], 0)).toBe(6);
        expect(getEffectivePower(core, core.bases[0].minions[1], 0)).toBe(5);
        expect(getEffectivePower(core, core.bases[0].minions[2], 0)).toBe(3);
    });

    it('压制取消目标随从能力并排除其基地计分力量贡献', () => {
        const core = makeState({
            bases: [makeBase('base_the_squared_circle', [
                makeMinion('flor', 'luchadors_flor_loca', '0', 3),
                makeMinion('pinned', 'musketeers_dartagnan', '1', 4, {
                    attachedActions: [
                        { uid: 'quick', defId: 'luchadors_quick_set_up', ownerId: '0' },
                        { uid: 'pin', defId: 'luchadors_pin', ownerId: '0' },
                    ],
                }),
                makeMinion('enemy-other', 'musketeers_young_musketeer', '1', 3),
            ])],
        });

        expect(isCardSuppressed(core, 'pinned')).toBe(true);
        expect(getEffectivePower(core, core.bases[0].minions[1], 0)).toBe(4);
        expect(getPlayerEffectivePowerOnBase(core, core.bases[0], 0, '1')).toBe(3);
        expect(getTotalEffectivePowerOnBase(core, core.bases[0], 0)).toBe(8);
    });

    it('Muchoslam 先生从弃牌堆回收行动并通过天赋授予额外行动', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('action-in-discard', 'luchadors_tag_team', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_the_dohyo', [
                makeMinion('muchoslam', 'luchadors_senor_muchoslam', '0', 5),
            ])],
        });

        const onPlay = invokeRegisteredAbilityContract('luchadors_senor_muchoslam', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'muchoslam',
            defId: 'luchadors_senor_muchoslam',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 20,
        });
        expect(onPlay.events[0]).toMatchObject({
            type: SU_EVENTS.CARD_RECOVERED_FROM_DISCARD,
            payload: { playerId: '0', cardUids: ['action-in-discard'] },
        });

        const talent = invokeRegisteredAbilityContract('luchadors_senor_muchoslam', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'muchoslam',
            defId: 'luchadors_senor_muchoslam',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 21,
        });
        expect(talent.events[0]).toMatchObject({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: { playerId: '0', limitType: 'action', reason: 'luchadors_senor_muchoslam' },
        });
    });

    it('火枪手连连获胜把两个额外行动都限定到所选随从', () => {
        const core = makeState({
            bases: [makeBase('base_bastion_saint_gervais', [
                makeMinion('target', 'musketeers_dartagnan', '0', 4),
                makeMinion('other', 'musketeers_young_musketeer', '1', 3),
            ])],
        });

        const result = invokeRegisteredAbilityContract('musketeers_on_a_roll', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'on-a-roll',
            defId: 'musketeers_on_a_roll',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 22,
        });
        expect(result.matchState).toBeDefined();

        const response = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'target',
            '连连获胜目标随从',
            '0',
            FIXED_RANDOM,
        );
        expect(response.success).toBe(true);
        const limits = response.events.filter(event => event.type === SU_EVENTS.LIMIT_MODIFIED);
        expect(limits).toHaveLength(2);
        for (const event of limits) {
            expect(event).toMatchObject({
                payload: {
                    playerId: '0',
                    limitType: 'action',
                    reason: 'musketeers_on_a_roll',
                    restrictToMinionUid: 'target',
                },
            });
        }
    });

    it('火枪手等待时机的额外行动限定字段指向随从而不是行动卡实例', () => {
        const core = makeState({
            bases: [makeBase('base_bastion_saint_gervais', [
                makeMinion('target', 'musketeers_dartagnan', '0', 4),
                makeMinion('other', 'musketeers_young_musketeer', '1', 3),
            ])],
        });

        const result = invokeRegisteredAbilityContract('musketeers_biding_time', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'biding-time',
            defId: 'musketeers_biding_time',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 23,
        });
        expect(result.matchState).toBeDefined();

        const response = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'target',
            '等待时机目标随从',
            '0',
            FIXED_RANDOM,
        );
        expect(response.success).toBe(true);
        expect(response.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.TEMP_POWER_ADDED,
                payload: expect.objectContaining({
                    minionUid: 'target',
                    amount: 2,
                    reason: 'musketeers_biding_time',
                }),
            }),
            expect.objectContaining({
                type: SU_EVENTS.LIMIT_MODIFIED,
                payload: expect.objectContaining({
                    playerId: '0',
                    limitType: 'action',
                    reason: 'musketeers_biding_time',
                    restrictToMinionUid: 'target',
                }),
            }),
        ]));
        const limit = response.events.find(event => event.type === SU_EVENTS.LIMIT_MODIFIED);
        expect(limit?.payload).not.toHaveProperty('restrictToCardUid');
    });

    it('火枪手投入战斗把额外行动绑定到刚额外打出的随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('to-battle', 'musketeers_to_battle', 'action', '0'),
                        makeCard('extra-minion', 'musketeers_young_musketeer', 'minion', '0'),
                        makeCard('all-for-one', 'musketeers_all_for_one', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_the_golden_lily')],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'to-battle' } },
            FIXED_RANDOM,
        );
        expect(played.success, played.error).toBe(true);
        expect(played.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.MINION_PLAY_EFFECT_QUEUED,
                payload: expect.objectContaining({
                    playerId: '0',
                    effect: 'grantExtraActionForPlayedMinion',
                    reason: 'musketeers_to_battle',
                }),
            }),
            expect.objectContaining({
                type: SU_EVENTS.LIMIT_MODIFIED,
                payload: expect.objectContaining({
                    playerId: '0',
                    limitType: 'minion',
                    reason: 'musketeers_to_battle',
                    playTiming: 'immediate',
                    consumePendingMinionPlayEffectOnSkip: true,
                }),
            }),
        ]));

        const minionPlayed = respondToPromptOption(
            played.finalState,
            option => option.value?.cardUid === 'extra-minion',
            '投入战斗额外随从',
            '0',
            FIXED_RANDOM,
        );
        expect(minionPlayed.success, minionPlayed.error).toBe(true);
        expect(minionPlayed.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.MINION_PLAYED,
                payload: expect.objectContaining({ cardUid: 'extra-minion' }),
            }),
            expect.objectContaining({
                type: SU_EVENTS.LIMIT_MODIFIED,
                payload: expect.objectContaining({
                    limitType: 'action',
                    reason: 'musketeers_to_battle',
                    playTiming: 'immediate',
                    restrictToMinionUid: 'extra-minion',
                }),
            }),
            expect.objectContaining({
                type: SU_EVENTS.MINION_PLAY_EFFECT_CONSUMED,
                payload: expect.objectContaining({ playerId: '0' }),
            }),
        ]));
        expect(minionPlayed.finalState.core.players['0'].pendingMinionPlayEffects ?? []).toHaveLength(0);

        const actionPlayed = respondToPromptOption(
            minionPlayed.finalState,
            option => option.value?.cardUid === 'all-for-one',
            '投入战斗绑定额外行动',
            '0',
            FIXED_RANDOM,
        );
        expect(actionPlayed.success, actionPlayed.error).toBe(true);
        expect(actionPlayed.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.LIMIT_MODIFIED,
                payload: expect.objectContaining({
                    playerId: '0',
                    limitType: 'action',
                    reason: 'musketeers_to_battle',
                }),
            }),
            expect.objectContaining({
                type: SU_EVENTS.ACTION_PLAYED,
                payload: expect.objectContaining({
                    cardUid: 'all-for-one',
                    targetMinionUid: 'extra-minion',
                }),
            }),
        ]));
        expect(actionPlayed.finalState.core.bases[0].minions[0].attachedActions).toEqual([
            expect.objectContaining({ uid: 'all-for-one', defId: 'musketeers_all_for_one' }),
        ]);
    });

    it('火枪手投入战斗可把预备姿势直接作用到刚额外打出的随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('to-battle', 'musketeers_to_battle', 'action', '0'),
                        makeCard('extra-minion', 'musketeers_young_musketeer', 'minion', '0'),
                        makeCard('en-garde', 'musketeers_en_garde', 'action', '0'),
                    ],
                    deck: [makeCard('drawn', 'musketeers_make_way', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_the_golden_lily')],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'to-battle' } },
            FIXED_RANDOM,
        );
        const minionPlayed = respondToPromptOption(
            played.finalState,
            option => option.value?.cardUid === 'extra-minion',
            '投入战斗额外随从',
            '0',
            FIXED_RANDOM,
        );
        const actionPlayed = respondToPromptOption(
            minionPlayed.finalState,
            option => option.value?.cardUid === 'en-garde',
            '投入战斗绑定预备姿势',
            '0',
            FIXED_RANDOM,
        );

        expect(actionPlayed.success, actionPlayed.error).toBe(true);
        expect(actionPlayed.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.ACTION_PLAYED,
                payload: expect.objectContaining({
                    cardUid: 'en-garde',
                    targetBaseIndex: 0,
                    targetMinionUid: 'extra-minion',
                }),
            }),
            expect.objectContaining({
                type: SU_EVENTS.TEMP_POWER_ADDED,
                payload: expect.objectContaining({
                    minionUid: 'extra-minion',
                    amount: 1,
                    reason: 'musketeers_en_garde',
                }),
            }),
            expect.objectContaining({
                type: SU_EVENTS.CARDS_DRAWN,
                payload: expect.objectContaining({ playerId: '0', cardUids: ['drawn'] }),
            }),
            expect.objectContaining({
                type: SU_EVENTS.TEMP_POWER_ADDED,
                payload: expect.objectContaining({
                    minionUid: 'extra-minion',
                    amount: 1,
                    reason: 'musketeers_young_musketeer',
                }),
            }),
        ]));
        expect(actionPlayed.finalState.core.bases[0].minions[0].tempPowerModifier).toBe(2);
    });

    it('火枪手随从在行动直接影响对应随从后触发各自奖励', () => {
        const affectEvent = {
            type: SU_EVENTS.TEMP_POWER_ADDED,
            payload: {
                minionUid: 'target',
                baseIndex: 0,
                amount: 1,
                reason: 'musketeers_en_garde',
                sourcePlayerId: '0',
                sourceDefId: 'musketeers_en_garde',
                sourceControllerId: '0',
                sourceBaseIndex: 0,
            },
            timestamp: 570,
        } as never;

        const athosCore = makeState({
            bases: [makeBase('base_bastion_saint_gervais', [
                makeMinion('athos', 'musketeers_athos', '0', 4),
                makeMinion('target', 'musketeers_young_musketeer', '0', 3),
            ])],
        });
        const athos = executeTriggerProgramExecutor('onMinionAffected', 'musketeers_athos', {
            state: athosCore,
            matchState: makeMatchState(athosCore),
            timing: 'onMinionAffected',
            playerId: '0',
            sourceDefId: 'musketeers_athos',
            sourceCardUid: 'athos',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            baseIndex: 0,
            triggerMinion: athosCore.bases[0].minions[1],
            triggerMinionUid: 'target',
            affectEvent,
            random: FIXED_RANDOM,
            now: 571,
        });
        expect(athos.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.TEMP_POWER_ADDED,
            payload: expect.objectContaining({ minionUid: 'target', reason: 'musketeers_athos' }),
        }));

        const dartagnanCore = makeState({
            players: {
                '0': makePlayer('0', { deck: [makeCard('drawn', 'musketeers_make_way', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_bastion_saint_gervais', [
                makeMinion('dartagnan', 'musketeers_dartagnan', '0', 4),
            ])],
        });
        const dartagnan = executeTriggerProgramExecutor('onMinionAffected', 'musketeers_dartagnan', {
            state: dartagnanCore,
            matchState: makeMatchState(dartagnanCore),
            timing: 'onMinionAffected',
            playerId: '0',
            sourceDefId: 'musketeers_dartagnan',
            sourceCardUid: 'dartagnan',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            baseIndex: 0,
            triggerMinion: dartagnanCore.bases[0].minions[0],
            triggerMinionUid: 'dartagnan',
            affectEvent: {
                ...(affectEvent as { payload: Record<string, unknown> }),
                payload: { ...(affectEvent as { payload: Record<string, unknown> }).payload, minionUid: 'dartagnan' },
            } as never,
            random: FIXED_RANDOM,
            now: 572,
        });
        expect(dartagnan.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: expect.objectContaining({ playerId: '0', cardUids: ['drawn'] }),
        }));

        const youngCore = makeState({
            bases: [makeBase('base_bastion_saint_gervais', [
                makeMinion('young', 'musketeers_young_musketeer', '0', 3),
            ])],
        });
        const young = executeTriggerProgramExecutor('onMinionAffected', 'musketeers_young_musketeer', {
            state: youngCore,
            matchState: makeMatchState(youngCore),
            timing: 'onMinionAffected',
            playerId: '0',
            sourceDefId: 'musketeers_young_musketeer',
            sourceCardUid: 'young',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            baseIndex: 0,
            triggerMinion: youngCore.bases[0].minions[0],
            triggerMinionUid: 'young',
            affectEvent: {
                ...(affectEvent as { payload: Record<string, unknown> }),
                payload: { ...(affectEvent as { payload: Record<string, unknown> }).payload, minionUid: 'young' },
            } as never,
            random: FIXED_RANDOM,
            now: 573,
        });
        expect(young.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.MINION_METADATA_UPDATED,
                payload: expect.objectContaining({ minionUid: 'young' }),
            }),
            expect.objectContaining({
                type: SU_EVENTS.TEMP_POWER_ADDED,
                payload: expect.objectContaining({ minionUid: 'young', reason: 'musketeers_young_musketeer' }),
            }),
        ]));

        const aramisCore = makeState({
            currentPlayerIndex: 0,
            bases: [makeBase('base_bastion_saint_gervais', [
                makeMinion('aramis', 'musketeers_aramis', '0', 4),
            ])],
        });
        const aramis = executeTriggerProgramExecutor('onMinionAffected', 'musketeers_aramis', {
            state: aramisCore,
            matchState: makeMatchState(aramisCore),
            timing: 'onMinionAffected',
            playerId: '0',
            sourceDefId: 'musketeers_aramis',
            sourceCardUid: 'aramis',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            baseIndex: 0,
            triggerMinion: aramisCore.bases[0].minions[0],
            triggerMinionUid: 'aramis',
            affectEvent: {
                ...(affectEvent as { payload: Record<string, unknown> }),
                payload: { ...(affectEvent as { payload: Record<string, unknown> }).payload, minionUid: 'aramis' },
            } as never,
            random: FIXED_RANDOM,
            now: 574,
        });
        expect(aramis.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.MINION_METADATA_UPDATED,
                payload: expect.objectContaining({ minionUid: 'aramis' }),
            }),
            expect.objectContaining({
                type: SU_EVENTS.LIMIT_MODIFIED,
                payload: expect.objectContaining({
                    playerId: '0',
                    limitType: 'action',
                    reason: 'musketeers_aramis',
                    playTiming: 'immediate',
                    restrictToMinionUid: 'aramis',
                }),
            }),
        ]));
    });

    it('Aramis 的额外行动真实消费时只能直接影响 Aramis 本人', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('en-garde', 'musketeers_en_garde', 'action', '0'),
                        makeCard('biding-time', 'musketeers_biding_time', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_bastion_saint_gervais', [
                makeMinion('aramis', 'musketeers_aramis', '0', 4),
                makeMinion('other', 'musketeers_young_musketeer', '0', 3),
            ])],
        });

        const played = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'en-garde', targetBaseIndex: 0, targetMinionUid: 'aramis' },
            },
            FIXED_RANDOM,
        );
        expect(played.success, played.error).toBe(true);
        expect(played.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.TEMP_POWER_ADDED,
                payload: expect.objectContaining({
                    minionUid: 'aramis',
                    amount: 1,
                    reason: 'musketeers_en_garde',
                }),
            }),
        ]));
        expect(getPromptOptions(getFirstPrompt(played.finalState)).map(option => option.value?.triggerId)).toEqual(expect.arrayContaining([
            expect.stringContaining('musketeers_aramis'),
        ]));

        const aramisTriggered = respondToPromptOption(
            played.finalState,
            option => String(option.value?.triggerId).includes('musketeers_aramis'),
            'Aramis 强制反应',
            '0',
            FIXED_RANDOM,
        );
        expect(aramisTriggered.success, aramisTriggered.error).toBe(true);
        expect(aramisTriggered.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.LIMIT_MODIFIED,
                payload: expect.objectContaining({
                    playerId: '0',
                    limitType: 'action',
                    reason: 'musketeers_aramis',
                    playTiming: 'immediate',
                    restrictToMinionUid: 'aramis',
                }),
            }),
        ]));
        expect(getPromptOptions(getFirstPrompt(aramisTriggered.finalState)).map(option => option.value?.cardUid)).toContain('biding-time');

        const extraAction = respondToPromptOption(
            aramisTriggered.finalState,
            option => option.value?.cardUid === 'biding-time',
            'Aramis 额外行动候选',
            '0',
            FIXED_RANDOM,
        );
        expect(extraAction.success, extraAction.error).toBe(true);
        expect(extraAction.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ACTION_PLAYED,
            payload: expect.objectContaining({
                cardUid: 'biding-time',
                targetBaseIndex: 0,
                targetMinionUid: 'aramis',
            }),
        }));
        expect(extraAction.finalState.core.bases[0].minions.find(minion => minion.uid === 'aramis')?.tempPowerModifier).toBe(3);
        expect(extraAction.finalState.core.bases[0].minions.find(minion => minion.uid === 'other')?.tempPowerModifier ?? 0).toBe(0);
    });

    it('火枪手一为全在多基地候选中只强化所选基地的己方随从并给额外行动', () => {
        const core = makeState({
            bases: [
                makeBase('base_bastion_saint_gervais', [
                    makeMinion('base-zero-ally', 'musketeers_young_musketeer', '0', 3),
                ]),
                makeBase('base_the_golden_lily', [
                    makeMinion('base-one-ally-a', 'musketeers_athos', '0', 4),
                    makeMinion('base-one-ally-b', 'musketeers_porthos', '0', 3),
                    makeMinion('base-one-enemy', 'sumo_wrestlers_rookie_sumo', '1', 2),
                ]),
            ],
        });

        const result = invokeRegisteredAbilityContract('musketeers_one_for_all', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'one-for-all',
            defId: 'musketeers_one_for_all',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 575,
        });
        expect(result.events).toHaveLength(0);
        expect(result.matchState).toBeDefined();

        const selected = respondToPromptOption(
            result.matchState!,
            option => option.value?.baseIndex === 1,
            '一为全目标基地',
            '0',
            FIXED_RANDOM,
        );
        expect(selected.success, selected.error).toBe(true);
        const oneForAllPowerEvents = selected.events.filter(
            event => event.type === SU_EVENTS.TEMP_POWER_ADDED && event.payload.reason === 'musketeers_one_for_all',
        );
        expect(oneForAllPowerEvents.map(event => event.payload.minionUid)).toEqual([
            'base-one-ally-a',
            'base-one-ally-b',
        ]);
        expect(selected.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.TEMP_POWER_ADDED,
            payload: expect.objectContaining({ minionUid: 'base-one-ally-b', reason: 'musketeers_athos' }),
        }));
        expect(selected.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({ playerId: '0', limitType: 'action', reason: 'musketeers_one_for_all' }),
        }));
        expect(selected.finalState.core.bases[0].minions[0].tempPowerModifier ?? 0).toBe(0);
        expect(selected.finalState.core.bases[1].minions.map(minion => minion.tempPowerModifier ?? 0)).toEqual([1, 2, 0]);
    });

    it('火枪手全为一在另一张行动直接影响宿主后 +1，并在回合结束摧毁自身', () => {
        const core = makeState({
            turnNumber: 9,
            bases: [makeBase('base_bastion_saint_gervais', [
                makeMinion('host', 'musketeers_young_musketeer', '0', 3, {
                    attachedActions: [{ uid: 'all-for-one', defId: 'musketeers_all_for_one', ownerId: '0' }],
                }),
            ])],
        });
        const affectEvent = {
            type: SU_EVENTS.TEMP_POWER_ADDED,
            payload: {
                minionUid: 'host',
                baseIndex: 0,
                amount: 1,
                reason: 'musketeers_en_garde',
                sourcePlayerId: '0',
                sourceDefId: 'musketeers_en_garde',
                sourceControllerId: '0',
                sourceBaseIndex: 0,
            },
            timestamp: 580,
        } as never;
        const triggered = executeTriggerProgramExecutor('onMinionAffected', 'musketeers_all_for_one', {
            state: core,
            matchState: makeMatchState(core),
            timing: 'onMinionAffected',
            playerId: '0',
            sourceDefId: 'musketeers_all_for_one',
            sourceCardUid: 'all-for-one',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            baseIndex: 0,
            triggerMinion: core.bases[0].minions[0],
            triggerMinionUid: 'host',
            affectEvent,
            random: FIXED_RANDOM,
            now: 581,
        });
        expect(triggered.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.TEMP_POWER_ADDED,
                payload: expect.objectContaining({ minionUid: 'host', amount: 1, reason: 'musketeers_all_for_one' }),
            }),
            expect.objectContaining({
                type: SU_EVENTS.MINION_METADATA_UPDATED,
                payload: expect.objectContaining({ minionUid: 'host' }),
            }),
        ]));
        const marked = applyEvents(core, triggered.events);
        expect(marked.bases[0].minions[0].tempPowerModifier).toBe(1);

        const turnEnd = executeTriggerProgramExecutor('onTurnEnd', 'musketeers_all_for_one', {
            state: marked,
            matchState: makeMatchState(marked),
            timing: 'onTurnEnd',
            playerId: '0',
            sourceDefId: 'musketeers_all_for_one',
            sourceCardUid: 'all-for-one',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: FIXED_RANDOM,
            now: 582,
        });
        expect(turnEnd.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({
                cardUid: 'all-for-one',
                defId: 'musketeers_all_for_one',
                reason: 'musketeers_all_for_one_turn_end_destroy',
            }),
        }));
        const afterTurnEnd = applyEvents(marked, turnEnd.events);
        expect(afterTurnEnd.bases[0].minions[0].attachedActions).toHaveLength(0);
        expect(afterTurnEnd.players['0'].discard.map(card => card.uid)).toContain('all-for-one');
    });

    it('火枪手情谊信物只搜直接影响随从的行动，并授予额外行动', () => {
        const promptCore = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('deck-direct', 'musketeers_en_garde', 'action', '0'),
                        makeCard('deck-other', 'musketeers_make_way', 'action', '0'),
                    ],
                    discard: [makeCard('discard-direct', 'musketeers_all_for_one', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_bastion_saint_gervais')],
        });
        const promptResult = invokeRegisteredAbilityContract('musketeers_token_of_affection', 'onPlay', {
            state: promptCore,
            matchState: makeMatchState(promptCore),
            playerId: '0',
            cardUid: 'token',
            defId: 'musketeers_token_of_affection',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 575,
        });
        expect(promptResult.matchState).toBeDefined();
        expect(getPromptOptions(getFirstPrompt(promptResult.matchState!)).map(option => option.value?.cardUid)).toEqual([
            undefined,
            'deck-direct',
            'discard-direct',
        ]);

        const skipped = respondToPromptOption(
            promptResult.matchState!,
            option => option.value?.skip === true,
            '情谊信物跳过搜索',
            '0',
            FIXED_RANDOM,
        );
        expect(skipped.success, skipped.error).toBe(true);
        expect(skipped.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(false);
        expect(skipped.events.some(event => event.type === SU_EVENTS.CARD_RECOVERED_FROM_DISCARD)).toBe(false);
        expect(skipped.events.some(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toBe(false);
        expect(skipped.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-direct', 'deck-other']);
        expect(skipped.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['discard-direct']);

        const fromDeck = respondToPromptOption(
            promptResult.matchState!,
            option => option.value?.cardUid === 'deck-direct',
            '情谊信物牌库候选',
            '0',
            FIXED_RANDOM,
        );
        expect(fromDeck.success, fromDeck.error).toBe(true);
        expect(fromDeck.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.CARDS_DRAWN,
                payload: expect.objectContaining({ playerId: '0', cardUids: ['deck-direct'] }),
            }),
            expect.objectContaining({
                type: SU_EVENTS.DECK_REORDERED,
                payload: expect.objectContaining({ playerId: '0', deckUids: ['deck-other'] }),
            }),
            expect.objectContaining({
                type: SU_EVENTS.LIMIT_MODIFIED,
                payload: expect.objectContaining({
                    playerId: '0',
                    limitType: 'action',
                    reason: 'musketeers_token_of_affection',
                }),
            }),
        ]));
        expect(fromDeck.finalState.core.players['0'].hand.map(card => card.uid)).toContain('deck-direct');
        expect(fromDeck.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-other']);

        const discardCore = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('discard-only', 'musketeers_all_for_one', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_bastion_saint_gervais')],
        });
        const fromDiscard = invokeRegisteredAbilityContract('musketeers_token_of_affection', 'onPlay', {
            state: discardCore,
            matchState: makeMatchState(discardCore),
            playerId: '0',
            cardUid: 'token',
            defId: 'musketeers_token_of_affection',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 576,
        });
        expect(fromDiscard.matchState).toBeDefined();
        expect(getPromptOptions(getFirstPrompt(fromDiscard.matchState!)).map(option => option.value?.cardUid)).toEqual([
            undefined,
            'discard-only',
        ]);
        const recoveredDiscard = respondToPromptOption(
            fromDiscard.matchState!,
            option => option.value?.cardUid === 'discard-only',
            '情谊信物唯一弃牌堆候选',
            '0',
            FIXED_RANDOM,
        );
        expect(recoveredDiscard.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.CARD_RECOVERED_FROM_DISCARD,
                payload: expect.objectContaining({ playerId: '0', cardUids: ['discard-only'] }),
            }),
            expect.objectContaining({
                type: SU_EVENTS.LIMIT_MODIFIED,
                payload: expect.objectContaining({
                    playerId: '0',
                    limitType: 'action',
                    reason: 'musketeers_token_of_affection',
                }),
            }),
        ]));
        expect(recoveredDiscard.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['discard-only']);
        expect(recoveredDiscard.finalState.core.players['0'].discard).toHaveLength(0);

        const noCandidateCore = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-ignored', 'musketeers_make_way', 'action', '0')],
                    discard: [makeCard('discard-ignored', 'luchadors_tag_team', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_bastion_saint_gervais')],
        });
        const noCandidate = invokeRegisteredAbilityContract('musketeers_token_of_affection', 'onPlay', {
            state: noCandidateCore,
            matchState: makeMatchState(noCandidateCore),
            playerId: '0',
            cardUid: 'token',
            defId: 'musketeers_token_of_affection',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 577,
        });
        expect(noCandidate.matchState).toBeUndefined();
        expect(noCandidate.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ABILITY_FEEDBACK,
            payload: expect.objectContaining({ playerId: '0', messageKey: 'feedback.no_valid_targets' }),
        }));
    });

    it('摔角手黄色恶魔只搜 Set-Up 行动，点名出局返还己方行动并消灭目标', () => {
        const yellowCore = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('deck-setup', 'luchadors_quick_set_up', 'action', '0'),
                        makeCard('deck-other', 'luchadors_tag_team', 'action', '0'),
                    ],
                    discard: [makeCard('discard-setup', 'luchadors_smart_set_up', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_ringside')],
        });
        const yellow = invokeRegisteredAbilityContract('luchadors_yellow_demon', 'onPlay', {
            state: yellowCore,
            matchState: makeMatchState(yellowCore),
            playerId: '0',
            cardUid: 'yellow',
            defId: 'luchadors_yellow_demon',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 577,
        });
        expect(yellow.matchState).toBeDefined();
        expect(getPromptOptions(getFirstPrompt(yellow.matchState!)).map(option => option.value?.cardUid)).toEqual([
            undefined,
            'deck-setup',
            'discard-setup',
        ]);
        const setupFromDiscard = respondToPromptOption(
            yellow.matchState!,
            option => option.value?.cardUid === 'discard-setup',
            '黄色恶魔弃牌堆 Set-Up 候选',
            '0',
            FIXED_RANDOM,
        );
        expect(setupFromDiscard.success, setupFromDiscard.error).toBe(true);
        expect(setupFromDiscard.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARD_RECOVERED_FROM_DISCARD,
            payload: expect.objectContaining({ playerId: '0', cardUids: ['discard-setup'] }),
        }));

        const countCore = makeState({
            bases: [makeBase('base_the_squared_circle', [
                makeMinion('target', 'musketeers_young_musketeer', '1', 4, {
                    attachedActions: [{ uid: 'setup', defId: 'luchadors_quick_set_up', ownerId: '0' }],
                }),
                makeMinion('other', 'musketeers_young_musketeer', '1', 3),
            ])],
        });
        const outForTheCount = invokeRegisteredAbilityContract('luchadors_out_for_the_count', 'onPlay', {
            state: countCore,
            matchState: makeMatchState(countCore),
            playerId: '0',
            cardUid: 'out-for-the-count',
            defId: 'luchadors_out_for_the_count',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 578,
        });
        expect(outForTheCount.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: expect.objectContaining({
                    cardUid: 'setup',
                    destination: 'hand',
                    reason: 'luchadors_out_for_the_count_return_action',
                }),
            }),
            expect.objectContaining({
                type: SU_EVENTS.MINION_DESTROYED,
                payload: expect.objectContaining({
                    minionUid: 'target',
                    reason: 'luchadors_out_for_the_count',
                }),
            }),
        ]));
        const afterCount = applyEvents(countCore, outForTheCount.events);
        expect(afterCount.players['0'].hand.map(card => card.uid)).toContain('setup');
        expect(afterCount.bases[0].minions.map(minion => minion.uid)).toEqual(['other']);
    });

    it('摔角手廉价欢呼在目标基地存在 Set-Up 时给所选随从 +4', () => {
        const core = makeState({
            bases: [
                makeBase('base_ringside', [
                    makeMinion('setup-host', 'luchadors_yellow_demon', '0', 2, {
                        attachedActions: [{ uid: 'setup', defId: 'luchadors_quick_set_up', ownerId: '0' }],
                    }),
                    makeMinion('boosted-target', 'luchadors_capa_roja', '0', 4),
                ]),
                makeBase('base_the_squared_circle', [
                    makeMinion('plain-target', 'luchadors_flor_loca', '0', 3),
                ]),
            ],
        });

        const result = invokeRegisteredAbilityContract('luchadors_cheap_pop', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'cheap-pop',
            defId: 'luchadors_cheap_pop',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 24,
        });
        expect(result.matchState).toBeDefined();

        const response = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'boosted-target',
            '廉价欢呼 Set-Up 基地目标',
            '0',
            FIXED_RANDOM,
        );
        expect(response.success).toBe(true);
        expect(response.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.TEMP_POWER_ADDED,
            payload: expect.objectContaining({
                minionUid: 'boosted-target',
                amount: 4,
                reason: 'luchadors_cheap_pop',
            }),
        }));
    });

    it('摔角手团队标记在多基地时选择有己方随从的基地并限制额外随从', () => {
        const core = makeState({
            bases: [
                makeBase('base_ringside', [
                    makeMinion('ally-a', 'luchadors_yellow_demon', '0', 2),
                ]),
                makeBase('base_the_squared_circle', [
                    makeMinion('enemy-only', 'musketeers_young_musketeer', '1', 3),
                ]),
                makeBase('base_bastion_saint_gervais', [
                    makeMinion('ally-b', 'luchadors_flor_loca', '0', 3),
                ]),
            ],
        });

        const result = invokeRegisteredAbilityContract('luchadors_tag_team', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'tag-team',
            defId: 'luchadors_tag_team',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 579,
        });
        expect(result.matchState).toBeDefined();
        expect(getPromptOptions(getFirstPrompt(result.matchState!)).map(option => option.value?.baseIndex)).toEqual([0, 2]);

        const selectedBase = respondToPromptOption(
            result.matchState!,
            option => option.value?.baseIndex === 2,
            '团队标记目标基地',
            '0',
            FIXED_RANDOM,
        );
        expect(selectedBase.success, selectedBase.error).toBe(true);
        expect(selectedBase.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({
                playerId: '0',
                limitType: 'minion',
                reason: 'luchadors_tag_team',
                restrictToBase: 2,
            }),
        }));
        expect(selectedBase.finalState.core.players['0'].baseLimitedMinionQuota?.[2]).toBe(1);
        expect(selectedBase.finalState.core.players['0'].baseLimitedMinionQuota?.[0]).toBeUndefined();
    });

    it('Muchoslam先生大战怪物回收可打在随从上的行动，并将其余行动洗入牌库', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-keep', 'luchadors_yellow_demon', 'minion', '0')],
                    discard: [
                        makeCard('playable-on-minion', 'luchadors_pin', 'action', '0'),
                        makeCard('other-action', 'luchadors_tag_team', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_ringside')],
        });

        const result = invokeRegisteredAbilityContract('luchadors_senor_muchoslam_vs_the_monsters', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'muchoslam-vs',
            defId: 'luchadors_senor_muchoslam_vs_the_monsters',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 580,
        });
        expect(result.matchState).toBeDefined();
        const skipped = respondToPromptOptions(result.matchState!, [], '0', FIXED_RANDOM);
        expect(skipped.success, skipped.error).toBe(true);
        expect(skipped.events.some(event => event.type === SU_EVENTS.CARD_RECOVERED_FROM_DISCARD)).toBe(false);
        expect(skipped.events.some(event => event.type === SU_EVENTS.DECK_REORDERED)).toBe(false);
        expect(skipped.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['playable-on-minion', 'other-action']);

        const selectedPrompt = invokeRegisteredAbilityContract('luchadors_senor_muchoslam_vs_the_monsters', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'muchoslam-vs',
            defId: 'luchadors_senor_muchoslam_vs_the_monsters',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 580,
        });
        const selectedIds = getPromptOptions(getFirstPrompt(selectedPrompt.matchState!))
            .filter(option => ['playable-on-minion', 'other-action'].includes(option.value?.cardUid))
            .map(option => option.id);
        const selected = respondToPromptOptions(selectedPrompt.matchState!, selectedIds, '0', FIXED_RANDOM);
        expect(selected.success, selected.error).toBe(true);
        expect(selected.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.CARD_RECOVERED_FROM_DISCARD,
                payload: expect.objectContaining({ playerId: '0', cardUids: ['playable-on-minion'] }),
            }),
            expect.objectContaining({
                type: SU_EVENTS.DECK_REORDERED,
                payload: expect.objectContaining({
                    playerId: '0',
                    deckUids: ['deck-keep', 'other-action'],
                }),
            }),
        ]));

        const after = selected.finalState.core;
        expect(after.players['0'].hand.map(card => card.uid)).toEqual(['playable-on-minion']);
        expect(after.players['0'].deck.map(card => card.uid)).toEqual(['deck-keep', 'other-action']);
        expect(after.players['0'].discard).toHaveLength(0);
    });

    it('聪明 Set-Up 只在宿主基地每回合第一次打出随从后为行动控制者抽牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('drawn-by-smart', 'luchadors_tag_team', 'action', '0')],
                    minionsPlayedPerBase: { 0: 1 },
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_the_squared_circle', [
                makeMinion('host', 'musketeers_dartagnan', '1', 4, {
                    attachedActions: [{ uid: 'smart-setup', defId: 'luchadors_smart_set_up', ownerId: '0' }],
                }),
                makeMinion('played', 'luchadors_yellow_demon', '0', 2),
            ])],
        });

        const firstMinion = executeTriggerProgramExecutor('onMinionPlayed', 'luchadors_smart_set_up', {
            state: core,
            matchState: makeMatchState(core),
            timing: 'onMinionPlayed',
            playerId: '0',
            sourceDefId: 'luchadors_smart_set_up',
            sourceCardUid: 'smart-setup',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'played',
            triggerMinionDefId: 'luchadors_yellow_demon',
            random: FIXED_RANDOM,
            now: 581,
        });
        expect(firstMinion.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: expect.objectContaining({ playerId: '0', cardUids: ['drawn-by-smart'] }),
        }));

        const alreadyUsedThisTurn = {
            ...core,
            players: {
                ...core.players,
                '0': makePlayer('0', {
                    deck: [makeCard('not-drawn', 'luchadors_tag_team', 'action', '0')],
                    minionsPlayedPerBase: { 0: 2 },
                }),
            },
        };
        const secondMinion = executeTriggerProgramExecutor('onMinionPlayed', 'luchadors_smart_set_up', {
            state: alreadyUsedThisTurn,
            matchState: makeMatchState(alreadyUsedThisTurn),
            timing: 'onMinionPlayed',
            playerId: '0',
            sourceDefId: 'luchadors_smart_set_up',
            sourceCardUid: 'smart-setup',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'played',
            triggerMinionDefId: 'luchadors_yellow_demon',
            random: FIXED_RANDOM,
            now: 582,
        });
        expect(secondMinion.events).toHaveLength(0);
    });

    it('Capa Roja 计分前可选择每位其他玩家一个印制力量 3 或以下随从，也可跳过', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
                '2': makePlayer('2'),
            },
            turnOrder: ['0', '1', '2'],
            bases: [makeBase('base_ringside', [
                makeMinion('capa', 'luchadors_capa_roja', '0', 4),
                makeMinion('enemy-small', 'musketeers_young_musketeer', '1', 3),
                makeMinion('enemy-big', 'musketeers_dartagnan', '1', 4),
                makeMinion('enemy-two-small', 'sumo_wrestlers_rookie_sumo', '2', 2),
            ])],
        });

        const skippedPrompt = executeTriggerProgramExecutor('beforeScoring', 'luchadors_capa_roja', {
            state: core,
            matchState: makeMatchState(core),
            timing: 'beforeScoring',
            playerId: '0',
            sourceDefId: 'luchadors_capa_roja',
            sourceCardUid: 'capa',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 583,
        });
        expect(skippedPrompt.events).toHaveLength(0);
        expect(skippedPrompt.matchState).toBeDefined();
        const promptOptions = getPromptOptions(getFirstPrompt(skippedPrompt.matchState!));
        expect(promptOptions.map(option => option.value?.minionUid)).toEqual([
            undefined,
            'enemy-small',
            'enemy-two-small',
        ]);
        expect(promptOptions.some(option => option.value?.skip === true)).toBe(true);

        const skipped = respondToPromptOptions(skippedPrompt.matchState!, [], '0', FIXED_RANDOM);
        expect(skipped.success, skipped.error).toBe(true);
        expect(skipped.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
        expect(skipped.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual([
            'capa',
            'enemy-small',
            'enemy-big',
            'enemy-two-small',
        ]);

        const selectedPrompt = executeTriggerProgramExecutor('beforeScoring', 'luchadors_capa_roja', {
            state: core,
            matchState: makeMatchState(core),
            timing: 'beforeScoring',
            playerId: '0',
            sourceDefId: 'luchadors_capa_roja',
            sourceCardUid: 'capa',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 584,
        });
        const selectedIds = getPromptOptions(getFirstPrompt(selectedPrompt.matchState!))
            .filter(option => ['enemy-small', 'enemy-two-small'].includes(option.value?.minionUid))
            .map(option => option.id);
        const selected = respondToPromptOptions(selectedPrompt.matchState!, selectedIds, '0', FIXED_RANDOM);
        expect(selected.success, selected.error).toBe(true);
        expect(selected.events.filter(event => event.type === SU_EVENTS.MINION_DESTROYED).map(event => event.payload.minionUid)).toEqual([
            'enemy-small',
            'enemy-two-small',
        ]);

        const after = selected.finalState.core;
        expect(after.bases[0].minions.map(minion => minion.uid)).toEqual(['capa', 'enemy-big']);
        expect(after.players['1'].discard.map(card => card.uid)).toContain('enemy-small');
        expect(after.players['2'].discard.map(card => card.uid)).toContain('enemy-two-small');
    });

    it('相扑手补齐头槌、炖肉、身体猛击和大关弃牌触发的权威状态', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('stew-card-a', 'sumo_wrestlers_chikara_mizu', 'action', '0'),
                        makeCard('stew-card-b', 'sumo_wrestlers_grasp_the_belt', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_the_dohyo', [
                    makeMinion('rookie', 'sumo_wrestlers_rookie_sumo', '0', 2),
                    makeMinion('top-tier', 'sumo_wrestlers_top_tier', '0', 4),
                    makeMinion('enemy-a', 'musketeers_young_musketeer', '1', 3, {
                        attachedActions: [{ uid: 'enemy-action', defId: 'musketeers_all_for_one', ownerId: '1' }],
                    }),
                    makeMinion('enemy-b', 'musketeers_young_musketeer', '1', 3),
                ]),
                makeBase('base_heya_training_stable', []),
            ],
        });

        const headButt = invokeRegisteredAbilityContract('sumo_wrestlers_head_butt', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'head-butt',
            defId: 'sumo_wrestlers_head_butt',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 30,
        });
        const afterHeadButt = applyEvents(core, headButt.events);
        expect(afterHeadButt.bases[0].minions[2].attachedActions).toHaveLength(0);
        expect(afterHeadButt.players['1'].discard.map(card => card.uid)).toContain('enemy-action');

        const stew = invokeRegisteredAbilityContract('sumo_wrestlers_bulking_stew', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'stew',
            defId: 'sumo_wrestlers_bulking_stew',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 31,
        });
        expect(stew.matchState).toBeDefined();
        const skippedStew = respondToPromptOptions(stew.matchState!, [], '0', FIXED_RANDOM);
        expect(skippedStew.success, skippedStew.error).toBe(true);
        expect(skippedStew.events.some(event => event.type === SU_EVENTS.CARDS_DISCARDED)).toBe(false);
        expect(skippedStew.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['stew-card-a', 'stew-card-b']);
        expect(skippedStew.finalState.core.bases[0].minions[0].powerCounters ?? 0).toBe(0);

        const selectedStew = invokeRegisteredAbilityContract('sumo_wrestlers_bulking_stew', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'stew',
            defId: 'sumo_wrestlers_bulking_stew',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 31,
        });
        const stewCardIds = getPromptOptions(getFirstPrompt(selectedStew.matchState!))
            .filter(option => ['stew-card-a', 'stew-card-b'].includes(option.value?.cardUid))
            .map(option => option.id);
        const stewTargetPrompt = respondToPromptOptions(selectedStew.matchState!, stewCardIds, '0', FIXED_RANDOM);
        expect(stewTargetPrompt.success, stewTargetPrompt.error).toBe(true);
        const afterStewChoice = respondToPromptOption(
            stewTargetPrompt.finalState,
            option => option.value?.minionUid === 'rookie',
            '炖肉选择承接指示物的相扑新人',
            '0',
            FIXED_RANDOM,
        );
        expect(afterStewChoice.success, afterStewChoice.error).toBe(true);
        const afterStew = afterStewChoice.finalState.core;
        expect(afterStew.players['0'].hand).toHaveLength(0);
        expect(afterStew.players['0'].discard.map(card => card.uid)).toEqual(['stew-card-a', 'stew-card-b']);
        expect(afterStew.bases[0].minions[0].powerCounters).toBe(2);

        const bodySlam = invokeRegisteredAbilityContract('sumo_wrestlers_body_slam', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'body-slam',
            defId: 'sumo_wrestlers_body_slam',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 32,
        });
        const afterBodySlam = applyEvents(core, bodySlam.events);
        expect(afterBodySlam.bases[0].minions.map(minion => minion.uid)).not.toContain('enemy-b');
        expect(afterBodySlam.bases[1].minions.map(minion => minion.uid)).toEqual(['enemy-a', 'enemy-b']);

        const topTier = executeTriggerProgramExecutor('onCardsDiscarded', 'sumo_wrestlers_top_tier', {
            state: core,
            matchState: makeMatchState(core),
            timing: 'onCardsDiscarded',
            playerId: '0',
            sourceDefId: 'sumo_wrestlers_top_tier',
            sourceCardUid: 'top-tier',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            discardedCards: [{ uid: 'stew-card-a', defId: 'sumo_wrestlers_chikara_mizu', ownerId: '0' }],
            discardedFromZone: 'hand',
            random: FIXED_RANDOM,
            now: 33,
        });
        const afterTopTier = applyEvents(core, topTier.events);
        expect(afterTopTier.bases[0].minions[1].powerCounters).toBe(1);
    });

    it('骑警力量肉汁薯条允许至多两个目标，也允许合法候选存在时空选', () => {
        const core = makeState({
            bases: [makeBase('base_strategic_syrup_reserve', [
                makeMinion('ally-a', 'mounties_dudlee', '0', 2),
                makeMinion('ally-b', 'mounties_war_canuck', '0', 3),
                makeMinion('enemy', 'musketeers_young_musketeer', '1', 3),
            ])],
        });

        const skippedPrompt = invokeRegisteredAbilityContract('mounties_power_poutine', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'poutine',
            defId: 'mounties_power_poutine',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 34,
        });
        expect(skippedPrompt.matchState).toBeDefined();
        const skip = respondToPromptOptions(skippedPrompt.matchState!, [], '0', FIXED_RANDOM);
        expect(skip.success, skip.error).toBe(true);
        expect(skip.events.some(event => event.type === SU_EVENTS.TEMP_POWER_ADDED)).toBe(false);
        expect(skip.finalState.core.bases[0].minions.map(minion => minion.tempPowerModifier ?? 0)).toEqual([0, 0, 0]);

        const selectedPrompt = invokeRegisteredAbilityContract('mounties_power_poutine', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'poutine',
            defId: 'mounties_power_poutine',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 35,
        });
        const selectedIds = getPromptOptions(getFirstPrompt(selectedPrompt.matchState!))
            .filter(option => ['ally-a', 'ally-b'].includes(option.value?.minionUid))
            .map(option => option.id);
        const selected = respondToPromptOptions(selectedPrompt.matchState!, selectedIds, '0', FIXED_RANDOM);
        expect(selected.success, selected.error).toBe(true);
        expect(selected.events.filter(event => event.type === SU_EVENTS.TEMP_POWER_ADDED).map(event => event.payload.minionUid)).toEqual([
            'ally-a',
            'ally-b',
        ]);
        expect(selected.finalState.core.bases[0].minions.map(minion => minion.tempPowerModifier ?? 0)).toEqual([2, 2, 0]);
    });

    it('骑警“总是抓住我们的人”移动己方随从并在回合结束消灭标记目标', () => {
        const core = makeState({
            bases: [
                makeBase('base_strategic_syrup_reserve', [
                    makeMinion('war-canuck', 'mounties_war_canuck', '0', 4),
                ]),
                makeBase('base_great_white_north_eh', [
                    makeMinion('enemy', 'musketeers_young_musketeer', '1', 2),
                ]),
            ],
        });

        const result = invokeRegisteredAbilityContract('mounties_always_get_our_man', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'always',
            defId: 'mounties_always_get_our_man',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 40,
        });
        const moved = applyEvents(core, result.events);
        expect(moved.bases[1].minions.map(minion => minion.uid)).toEqual(['enemy', 'war-canuck']);
        expect(moved.bases[1].minions[0].metadata?.internationalIncidentAlwaysGetOurMan).toMatchObject({
            sourcePlayerId: '0',
            turnNumber: 1,
        });

        const turnEnd = executeTriggerProgramExecutor('onTurnEnd', 'mounties_always_get_our_man', {
            state: moved,
            matchState: makeMatchState(moved),
            timing: 'onTurnEnd',
            playerId: '0',
            sourceDefId: 'mounties_always_get_our_man',
            random: FIXED_RANDOM,
            now: 41,
        });
        const afterTurnEnd = applyEvents(moved, turnEnd.events);
        expect(afterTurnEnd.bases[1].minions.map(minion => minion.uid)).toEqual(['war-canuck']);
        expect(afterTurnEnd.players['1'].discard.map(card => card.uid)).toContain('enemy');
    });

    it('骑警北方搬运者可选择移动另一个己方随从到其它基地', () => {
        const core = makeState({
            bases: [
                makeBase('base_strategic_syrup_reserve', [
                    makeMinion('mover', 'mounties_northern_mover', '0', 4),
                    makeMinion('ally', 'mounties_dudlee', '0', 2),
                ]),
                makeBase('base_great_white_north_eh', []),
            ],
        });

        const result = invokeRegisteredAbilityContract('mounties_northern_mover', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'mover',
            defId: 'mounties_northern_mover',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 42,
        });
        expect(result.matchState).toBeDefined();

        const mode = respondToPromptOption(
            result.matchState!,
            option => option.value?.mode === 'move',
            '北方搬运者移动分支',
            '0',
            FIXED_RANDOM,
        );
        expect(mode.success).toBe(true);

        const destination = respondToPromptOption(
            mode.finalState,
            option => option.value?.baseIndex === 1,
            '北方搬运者目标基地',
            '0',
            FIXED_RANDOM,
        );
        expect(destination.success).toBe(true);
        expect(destination.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_MOVED,
            payload: expect.objectContaining({
                minionUid: 'ally',
                fromBaseIndex: 0,
                toBaseIndex: 1,
                reason: 'mounties_northern_mover',
            }),
        }));
        expect(destination.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['mover']);
        expect(destination.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['ally']);
    });

    it('战争骑警的力量持续到自己的下个回合开始再回滚', () => {
        const core = makeState({
            turnNumber: 5,
            currentPlayerIndex: 0,
            bases: [makeBase('base_great_white_north_eh', [
                makeMinion('war-canuck', 'mounties_war_canuck', '0', 3),
                makeMinion('enemy', 'musketeers_young_musketeer', '1', 3),
            ])],
        });

        const result = invokeRegisteredAbilityContract('mounties_war_canuck', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'war-canuck',
            defId: 'mounties_war_canuck',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 43,
        });
        expect(result.events[0]).toMatchObject({
            type: SU_EVENTS.PERMANENT_POWER_ADDED,
            payload: {
                minionUid: 'war-canuck',
                amount: 2,
                expiresOnTurnNumber: 6,
                expiresOnPlayerId: '0',
                reason: 'mounties_war_canuck',
            },
        });

        const powered = applyEvents(core, result.events);
        expect(powered.bases[0].minions[0].powerModifier).toBe(2);
        expect(powered.timedPowerModifiers?.[0]).toMatchObject({
            minionUid: 'war-canuck',
            amount: 2,
            expiresOnTurnNumber: 6,
            expiresOnPlayerId: '0',
        });

        const opponentStarted = applyEvents(powered, [{
            type: SU_EVENTS.TURN_STARTED,
            payload: { playerId: '1', turnNumber: 5 },
            timestamp: 44,
        }]);
        expect(opponentStarted.bases[0].minions[0].powerModifier).toBe(2);

        const ownNextStarted = applyEvents(opponentStarted, [{
            type: SU_EVENTS.TURN_STARTED,
            payload: { playerId: '0', turnNumber: 6 },
            timestamp: 45,
        }]);
        expect(ownNextStarted.bases[0].minions[0].powerModifier).toBe(0);
        expect(ownNextStarted.timedPowerModifiers).toBeUndefined();
    });

    it('摔角手逆转临时夺取带 Set-Up 的随从，并在回合结束归还控制权', () => {
        const core = makeState({
            bases: [makeBase('base_ringside', [
                makeMinion('ally', 'luchadors_yellow_demon', '0', 2),
                makeMinion('target', 'musketeers_young_musketeer', '1', 4, {
                    attachedActions: [{ uid: 'setup', defId: 'luchadors_quick_set_up', ownerId: '0' }],
                }),
                makeMinion('enemy-other', 'musketeers_young_musketeer', '1', 3),
            ])],
        });

        const result = invokeRegisteredAbilityContract('luchadors_reversal', 'special', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'reversal',
            defId: 'luchadors_reversal',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 50,
        });
        expect(result.matchState).toBeDefined();
        const skippedDestroy = respondToPromptOptions(result.matchState!, [], '0', FIXED_RANDOM);
        expect(skippedDestroy.success, skippedDestroy.error).toBe(true);
        expect(skippedDestroy.events.some(event => event.type === SU_EVENTS.ONGOING_DETACHED)).toBe(false);
        const controlled = skippedDestroy.finalState.core;
        expect(controlled.bases[0].minions[1].controller).toBe('0');
        expect(controlled.bases[0].minions[1].attachedActions).toEqual([
            expect.objectContaining({ uid: 'setup', ownerId: '0' }),
        ]);
        expect(controlled.players['0'].discard.map(card => card.uid)).not.toContain('setup');

        const restored = executeTriggerProgramExecutor('onTurnEnd', 'luchadors_reversal', {
            state: controlled,
            matchState: makeMatchState(controlled),
            timing: 'onTurnEnd',
            playerId: '0',
            sourceDefId: 'luchadors_reversal',
            random: FIXED_RANDOM,
            now: 51,
        });
        const afterRestore = applyEvents(controlled, restored.events);
        expect(afterRestore.bases[0].minions[1].controller).toBe('1');
    });

    it('摔角手逆转在没有合法 Set-Up 目标时反馈，并可摧毁目标上任意数量己方行动', () => {
        const noTarget = makeState({
            bases: [makeBase('base_ringside', [
                makeMinion('ally', 'luchadors_yellow_demon', '0', 2),
                makeMinion('enemy', 'musketeers_dartagnan', '1', 4),
            ])],
        });
        const noTargetResult = invokeRegisteredAbilityContract('luchadors_reversal', 'special', {
            state: noTarget,
            matchState: makeMatchState(noTarget),
            playerId: '0',
            cardUid: 'reversal-empty',
            defId: 'luchadors_reversal',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 52,
        });
        expect(noTargetResult.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ABILITY_FEEDBACK,
            payload: expect.objectContaining({ playerId: '0', messageKey: 'feedback.no_valid_targets' }),
        }));

        const multiAction = makeState({
            bases: [makeBase('base_the_dohyo', [
                makeMinion('ally', 'luchadors_yellow_demon', '0', 2),
                makeMinion('target', 'musketeers_young_musketeer', '1', 4, {
                    attachedActions: [
                        { uid: 'quick', defId: 'luchadors_quick_set_up', ownerId: '0' },
                        { uid: 'smart', defId: 'luchadors_smart_set_up', ownerId: '0' },
                        { uid: 'enemy-action', defId: 'musketeers_all_for_one', ownerId: '1' },
                    ],
                }),
            ])],
        });
        const multiActionResult = invokeRegisteredAbilityContract('luchadors_reversal', 'special', {
            state: multiAction,
            matchState: makeMatchState(multiAction),
            playerId: '0',
            cardUid: 'reversal-multi',
            defId: 'luchadors_reversal',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 53,
        });
        expect(multiActionResult.matchState).toBeDefined();
        const selectedActionIds = getPromptOptions(getFirstPrompt(multiActionResult.matchState!))
            .filter(option => ['quick', 'smart'].includes(option.value?.cardUid))
            .map(option => option.id);
        const selectedActions = respondToPromptOptions(multiActionResult.matchState!, selectedActionIds, '0', FIXED_RANDOM);
        expect(selectedActions.success, selectedActions.error).toBe(true);
        const afterMultiAction = selectedActions.finalState.core;
        expect(afterMultiAction.bases[0].minions[1].controller).toBe('0');
        expect(afterMultiAction.bases[0].minions[1].attachedActions).toEqual([
            expect.objectContaining({ uid: 'enemy-action', ownerId: '1' }),
        ]);
        expect(afterMultiAction.players['0'].discard.map(card => card.uid).sort()).toEqual(['quick', 'smart']);
    });

    it('国际事件基地触发覆盖黄金百合、圣热尔韦堡垒和拳击台', () => {
        const golden = makeState({
            players: {
                '0': makePlayer('0', { deck: [makeCard('drawn', 'sumo_wrestlers_rookie_sumo', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_the_golden_lily', [
                makeMinion('ally', 'musketeers_young_musketeer', '0', 3),
            ])],
        });
        const goldenResult = executeTriggerProgramExecutor('onTurnEnd', 'base_the_golden_lily', {
            state: golden,
            matchState: makeMatchState(golden),
            timing: 'onTurnEnd',
            playerId: '0',
            sourceDefId: 'base_the_golden_lily',
            sourceBaseIndex: 0,
            random: FIXED_RANDOM,
            now: 60,
        });
        expect(goldenResult.events[0]).toMatchObject({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId: '0', cardUids: ['drawn'] },
        });

        const bastion = makeState({
            bases: [makeBase('base_bastion_saint_gervais', [
                makeMinion('ally', 'musketeers_young_musketeer', '0', 3),
            ])],
        });
        const affectEvent = {
            type: SU_EVENTS.TEMP_POWER_ADDED,
            payload: {
                minionUid: 'ally',
                baseIndex: 0,
                amount: 1,
                reason: 'musketeers_en_garde',
                sourcePlayerId: '0',
                sourceDefId: 'musketeers_en_garde',
                sourceControllerId: '0',
                sourceBaseIndex: 0,
            },
            timestamp: 61,
        };
        const bastionResult = executeTriggerProgramExecutor('onMinionAffected', 'base_bastion_saint_gervais', {
            state: bastion,
            matchState: makeMatchState(bastion),
            timing: 'onMinionAffected',
            playerId: '0',
            sourceDefId: 'base_bastion_saint_gervais',
            sourceBaseIndex: 0,
            baseIndex: 0,
            triggerMinion: bastion.bases[0].minions[0],
            triggerMinionUid: 'ally',
            affectEvent: affectEvent as never,
            random: FIXED_RANDOM,
            now: 62,
        });
        const afterBastion = applyEvents(bastion, bastionResult.events);
        expect(afterBastion.bases[0].metadata?.internationalIncidentBastionSaintGervaisUsedTurn_0).toBe(1);
        expect(bastionResult.events.some(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toBe(true);

        const bastionSecondSameTurn = executeTriggerProgramExecutor('onMinionAffected', 'base_bastion_saint_gervais', {
            state: afterBastion,
            matchState: makeMatchState(afterBastion),
            timing: 'onMinionAffected',
            playerId: '0',
            sourceDefId: 'base_bastion_saint_gervais',
            sourceBaseIndex: 0,
            baseIndex: 0,
            triggerMinion: afterBastion.bases[0].minions[0],
            triggerMinionUid: 'ally',
            affectEvent: affectEvent as never,
            random: FIXED_RANDOM,
            now: 63,
        });
        expect(bastionSecondSameTurn.events).toHaveLength(0);

        const bastionNextTurn = { ...afterBastion, turnNumber: 2 };
        const bastionNextTurnResult = executeTriggerProgramExecutor('onMinionAffected', 'base_bastion_saint_gervais', {
            state: bastionNextTurn,
            matchState: makeMatchState(bastionNextTurn),
            timing: 'onMinionAffected',
            playerId: '0',
            sourceDefId: 'base_bastion_saint_gervais',
            sourceBaseIndex: 0,
            baseIndex: 0,
            triggerMinion: bastionNextTurn.bases[0].minions[0],
            triggerMinionUid: 'ally',
            affectEvent: affectEvent as never,
            random: FIXED_RANDOM,
            now: 64,
        });
        expect(bastionNextTurnResult.events.some(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toBe(true);

        const squared = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('setup-action', 'luchadors_tag_team', 'action', '0')],
                    minionsPlayedPerBase: { 0: 1 },
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_the_squared_circle', [
                makeMinion('played', 'luchadors_yellow_demon', '0', 2),
            ])],
        });
        const squaredResult = executeTriggerProgramExecutor('onMinionPlayed', 'base_the_squared_circle', {
            state: squared,
            matchState: makeMatchState(squared),
            timing: 'onMinionPlayed',
            playerId: '0',
            sourceDefId: 'base_the_squared_circle',
            sourceBaseIndex: 0,
            baseIndex: 0,
            triggerMinionUid: 'played',
            triggerMinionDefId: 'luchadors_yellow_demon',
            random: FIXED_RANDOM,
            now: 63,
        });
        const afterSquared = applyEvents(squared, squaredResult.events);
        expect(afterSquared.players['0'].hand.map(card => card.uid)).toEqual(['setup-action']);
    });

    it('国际事件剩余基地触发覆盖训练馆、土俵、战略枫糖储备、大白北方和擂台边', () => {
        const heya = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('discarded-at-heya', 'sumo_wrestlers_chikara_mizu', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_heya_training_stable', [
                makeMinion('sumo', 'sumo_wrestlers_rookie_sumo', '0', 2),
            ])],
        });
        const heyaResult = executeTriggerProgramExecutor('onTurnStart', 'base_heya_training_stable', {
            state: heya,
            matchState: makeMatchState(heya),
            timing: 'onTurnStart',
            playerId: '0',
            sourceDefId: 'base_heya_training_stable',
            sourceBaseIndex: 0,
            random: FIXED_RANDOM,
            now: 64,
        });
        expect(heyaResult.events).toHaveLength(0);
        expect(heyaResult.matchState).toBeDefined();
        const skippedHeya = respondToPromptOption(
            heyaResult.matchState!,
            option => option.value?.skip === true,
            '训练馆跳过',
            '0',
            FIXED_RANDOM,
        );
        expect(skippedHeya.success, skippedHeya.error).toBe(true);
        expect(skippedHeya.finalState.core.players['0'].discard).toHaveLength(0);
        expect(skippedHeya.finalState.core.bases[0].minions[0].powerCounters ?? 0).toBe(0);

        const selectedHeyaPrompt = executeTriggerProgramExecutor('onTurnStart', 'base_heya_training_stable', {
            state: heya,
            matchState: makeMatchState(heya),
            timing: 'onTurnStart',
            playerId: '0',
            sourceDefId: 'base_heya_training_stable',
            sourceBaseIndex: 0,
            random: FIXED_RANDOM,
            now: 65,
        });
        const selectedHeya = respondToPromptOption(
            selectedHeyaPrompt.matchState!,
            option => option.value?.cardUid === 'discarded-at-heya' && option.value?.minionUid === 'sumo',
            '训练馆弃牌放置指示物',
            '0',
            FIXED_RANDOM,
        );
        const afterHeya = selectedHeya.finalState.core;
        expect(afterHeya.players['0'].discard.map(card => card.uid)).toContain('discarded-at-heya');
        expect(afterHeya.bases[0].minions[0].powerCounters).toBe(1);

        const dohyo = makeState({
            players: {
                '0': makePlayer('0', { minionsPlayedPerBase: { 0: 1 } }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_the_dohyo', [
                    makeMinion('played-sumo', 'sumo_wrestlers_rookie_sumo', '0', 2),
                    makeMinion('enemy-at-dohyo', 'musketeers_young_musketeer', '1', 3),
                ]),
                makeBase('base_the_golden_lily', []),
            ],
        });
        const dohyoResult = executeTriggerProgramExecutor('onMinionPlayed', 'base_the_dohyo', {
            state: dohyo,
            matchState: makeMatchState(dohyo),
            timing: 'onMinionPlayed',
            playerId: '0',
            sourceDefId: 'base_the_dohyo',
            sourceBaseIndex: 0,
            baseIndex: 0,
            triggerMinionUid: 'played-sumo',
            triggerMinionDefId: 'sumo_wrestlers_rookie_sumo',
            random: FIXED_RANDOM,
            now: 65,
        });
        expect(dohyoResult.events).toHaveLength(0);
        expect(dohyoResult.matchState).toBeDefined();
        const skippedDohyo = respondToPromptOption(
            dohyoResult.matchState!,
            option => option.value?.skip === true,
            '土俵跳过',
            '0',
            FIXED_RANDOM,
        );
        expect(skippedDohyo.finalState.core.bases[0].minions.map(minion => minion.uid)).toContain('enemy-at-dohyo');
        expect(skippedDohyo.finalState.core.bases[1].minions).toHaveLength(0);

        const selectedDohyoPrompt = executeTriggerProgramExecutor('onMinionPlayed', 'base_the_dohyo', {
            state: dohyo,
            matchState: makeMatchState(dohyo),
            timing: 'onMinionPlayed',
            playerId: '0',
            sourceDefId: 'base_the_dohyo',
            sourceBaseIndex: 0,
            baseIndex: 0,
            triggerMinionUid: 'played-sumo',
            triggerMinionDefId: 'sumo_wrestlers_rookie_sumo',
            random: FIXED_RANDOM,
            now: 66,
        });
        const selectedDohyo = respondToPromptOption(
            selectedDohyoPrompt.matchState!,
            option => option.value?.minionUid === 'enemy-at-dohyo' && option.value?.toBaseIndex === 1,
            '土俵移动目标',
            '0',
            FIXED_RANDOM,
        );
        expect(selectedDohyo.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_MOVED,
            payload: expect.objectContaining({
                minionUid: 'enemy-at-dohyo',
                fromBaseIndex: 0,
                toBaseIndex: 1,
                reason: 'base_the_dohyo',
            }),
        }));

        const syrup = makeState({
            bases: [
                makeBase('base_strategic_syrup_reserve', [
                    makeMinion('played-mountie', 'mounties_dudlee', '0', 2),
                ]),
                makeBase('base_great_white_north_eh', [
                    makeMinion('ally-away', 'mounties_war_canuck', '0', 3),
                    makeMinion('enemy-away', 'musketeers_young_musketeer', '1', 3),
                ]),
            ],
        });
        const syrupResult = executeTriggerProgramExecutor('onMinionPlayed', 'base_strategic_syrup_reserve', {
            state: syrup,
            matchState: makeMatchState(syrup),
            timing: 'onMinionPlayed',
            playerId: '0',
            sourceDefId: 'base_strategic_syrup_reserve',
            sourceBaseIndex: 0,
            baseIndex: 0,
            triggerMinionUid: 'played-mountie',
            triggerMinionDefId: 'mounties_dudlee',
            random: FIXED_RANDOM,
            now: 66,
        });
        expect(syrupResult.events).toHaveLength(0);
        expect(syrupResult.matchState).toBeDefined();
        const skippedSyrup = respondToPromptOption(
            syrupResult.matchState!,
            option => option.value?.skip === true,
            '战略枫糖储备跳过',
            '0',
            FIXED_RANDOM,
        );
        expect(skippedSyrup.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['played-mountie']);
        expect(skippedSyrup.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['ally-away', 'enemy-away']);

        const selectedSyrupPrompt = executeTriggerProgramExecutor('onMinionPlayed', 'base_strategic_syrup_reserve', {
            state: syrup,
            matchState: makeMatchState(syrup),
            timing: 'onMinionPlayed',
            playerId: '0',
            sourceDefId: 'base_strategic_syrup_reserve',
            sourceBaseIndex: 0,
            baseIndex: 0,
            triggerMinionUid: 'played-mountie',
            triggerMinionDefId: 'mounties_dudlee',
            random: FIXED_RANDOM,
            now: 67,
        });
        const selectedSyrup = respondToPromptOption(
            selectedSyrupPrompt.matchState!,
            option => option.value?.minionUid === 'enemy-away' && option.value?.fromBaseIndex === 1,
            '战略枫糖储备移动目标',
            '0',
            FIXED_RANDOM,
        );
        expect(selectedSyrup.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_MOVED,
            payload: expect.objectContaining({
                minionUid: 'enemy-away',
                fromBaseIndex: 1,
                toBaseIndex: 0,
                reason: 'base_strategic_syrup_reserve',
            }),
        }));

        const north = makeState({
            bases: [
                makeBase('base_great_white_north_eh', [
                    makeMinion('ally-north', 'mounties_dudlee', '0', 2),
                    makeMinion('enemy-north', 'musketeers_young_musketeer', '1', 3),
                ]),
                makeBase('base_ringside', []),
            ],
        });
        const northResult = executeTriggerProgramExecutor('beforeScoring', 'base_great_white_north_eh', {
            state: north,
            matchState: makeMatchState(north),
            timing: 'beforeScoring',
            playerId: '0',
            sourceDefId: 'base_great_white_north_eh',
            sourceBaseIndex: 0,
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 67,
        });
        expect(northResult.events).toHaveLength(0);
        expect(northResult.matchState).toBeDefined();
        const skippedNorthAlly = respondToPromptOption(
            northResult.matchState!,
            option => option.value?.skip === true,
            '大白北方己方跳过',
            '0',
            FIXED_RANDOM,
        );
        const skippedNorthEnemy = respondToPromptOption(
            skippedNorthAlly.finalState,
            option => option.value?.skip === true,
            '大白北方对手跳过',
            '1',
            FIXED_RANDOM,
        );
        expect(skippedNorthEnemy.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['ally-north', 'enemy-north']);
        expect(skippedNorthEnemy.finalState.core.bases[1].minions).toHaveLength(0);

        const selectedNorthPrompt = executeTriggerProgramExecutor('beforeScoring', 'base_great_white_north_eh', {
            state: north,
            matchState: makeMatchState(north),
            timing: 'beforeScoring',
            playerId: '0',
            sourceDefId: 'base_great_white_north_eh',
            sourceBaseIndex: 0,
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 68,
        });
        const movedAllyNorth = respondToPromptOption(
            selectedNorthPrompt.matchState!,
            option => option.value?.minionUid === 'ally-north' && option.value?.toBaseIndex === 1,
            '大白北方己方移动',
            '0',
            FIXED_RANDOM,
        );
        const movedEnemyNorth = respondToPromptOption(
            movedAllyNorth.finalState,
            option => option.value?.minionUid === 'enemy-north' && option.value?.toBaseIndex === 1,
            '大白北方对手移动',
            '1',
            FIXED_RANDOM,
        );
        const afterNorth = movedEnemyNorth.finalState.core;
        expect(afterNorth.bases[1].minions.map(minion => minion.uid)).toEqual(['ally-north', 'enemy-north']);
        expect(afterNorth.bases[1].minions.map(minion => minion.tempPowerModifier ?? 0)).toEqual([1, 1]);

        const ringside = makeState({
            players: {
                '0': makePlayer('0', { deck: [makeCard('drawn-at-ringside', 'luchadors_tag_team', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_ringside', [
                makeMinion('enemy-target', 'musketeers_young_musketeer', '1', 3),
            ])],
        });
        const ringsideResult = executeTriggerProgramExecutor('onMinionAffected', 'base_ringside', {
            state: ringside,
            matchState: makeMatchState(ringside),
            timing: 'onMinionAffected',
            playerId: '0',
            sourceDefId: 'base_ringside',
            sourceBaseIndex: 0,
            baseIndex: 0,
            triggerMinion: ringside.bases[0].minions[0],
            triggerMinionUid: 'enemy-target',
            affectEvent: {
                type: SU_EVENTS.TEMP_POWER_ADDED,
                payload: {
                    minionUid: 'enemy-target',
                    baseIndex: 0,
                    amount: 2,
                    reason: 'luchadors_cheap_pop',
                    sourcePlayerId: '0',
                    sourceDefId: 'luchadors_cheap_pop',
                    sourceControllerId: '0',
                    sourceBaseIndex: 0,
                },
                timestamp: 68,
            } as never,
            random: FIXED_RANDOM,
            now: 69,
        });
        expect(ringsideResult.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: expect.objectContaining({ playerId: '0', cardUids: ['drawn-at-ringside'] }),
        }));
    });

    it('相扑手表演奖、斗志奖和抓住腰带完成抽牌、分配指示物与移动闭环', () => {
        const performance = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('draw-a', 'sumo_wrestlers_rookie_sumo', 'minion', '0'),
                        makeCard('draw-b', 'sumo_wrestlers_chikara_mizu', 'action', '0'),
                        makeCard('draw-c', 'sumo_wrestlers_grasp_the_belt', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });
        const performanceResult = invokeRegisteredAbilityContract('sumo_wrestlers_performance_prize', 'onPlay', {
            state: performance,
            matchState: makeMatchState(performance),
            playerId: '0',
            cardUid: 'performance',
            defId: 'sumo_wrestlers_performance_prize',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 70,
        });
        const afterPerformance = applyEvents(performance, performanceResult.events);
        expect(afterPerformance.players['0'].hand.map(card => card.uid)).toEqual(['draw-a', 'draw-b', 'draw-c']);

        const fightingSpirit = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('spirit-draw-a', 'sumo_wrestlers_rookie_sumo', 'minion', '0'),
                        makeCard('spirit-draw-b', 'sumo_wrestlers_chikara_mizu', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_the_dohyo', [
                makeMinion('sumo-a', 'sumo_wrestlers_rookie_sumo', '0', 2),
                makeMinion('sumo-b', 'sumo_wrestlers_top_tier', '0', 4),
            ])],
        });
        const fightingSpiritResult = invokeRegisteredAbilityContract('sumo_wrestlers_fighting_spirit_prize', 'onPlay', {
            state: fightingSpirit,
            matchState: makeMatchState(fightingSpirit),
            playerId: '0',
            cardUid: 'spirit',
            defId: 'sumo_wrestlers_fighting_spirit_prize',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 71,
        });
        const spiritPrompt = getFirstPrompt(fightingSpiritResult.matchState!);
        const spiritTarget = getPromptOptions(spiritPrompt).find(option => option.value?.minionUid === 'sumo-a');
        expect(spiritTarget).toBeDefined();
        const afterSpiritChoice = respondToPromptOptions(
            fightingSpiritResult.matchState!,
            [spiritTarget!.id],
            '0',
            FIXED_RANDOM,
        );
        expect(afterSpiritChoice.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.CARDS_DRAWN,
                payload: expect.objectContaining({ playerId: '0', cardUids: ['spirit-draw-a', 'spirit-draw-b'] }),
            }),
            expect.objectContaining({
                type: SU_EVENTS.POWER_COUNTER_ADDED,
                payload: expect.objectContaining({ minionUid: 'sumo-a', amount: 2, reason: 'sumo_wrestlers_fighting_spirit_prize' }),
            }),
        ]));
        expect(afterSpiritChoice.finalState.core.bases[0].minions[0].powerCounters).toBe(2);

        const splitSpiritResult = invokeRegisteredAbilityContract('sumo_wrestlers_fighting_spirit_prize', 'onPlay', {
            state: fightingSpirit,
            matchState: makeMatchState(fightingSpirit),
            playerId: '0',
            cardUid: 'spirit',
            defId: 'sumo_wrestlers_fighting_spirit_prize',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 72,
        });
        const splitSpiritTargets = getPromptOptions(getFirstPrompt(splitSpiritResult.matchState!))
            .filter(option => ['sumo-a', 'sumo-b'].includes(option.value?.minionUid))
            .map(option => option.id);
        const afterSplitSpirit = respondToPromptOptions(
            splitSpiritResult.matchState!,
            splitSpiritTargets,
            '0',
            FIXED_RANDOM,
        );
        expect(afterSplitSpirit.success, afterSplitSpirit.error).toBe(true);
        expect(afterSplitSpirit.events.filter(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED)).toEqual([
            expect.objectContaining({
                payload: expect.objectContaining({ minionUid: 'sumo-a', amount: 1 }),
            }),
            expect.objectContaining({
                payload: expect.objectContaining({ minionUid: 'sumo-b', amount: 1 }),
            }),
        ]);
        expect(afterSplitSpirit.finalState.core.bases[0].minions.map(minion => minion.powerCounters ?? 0)).toEqual([1, 1]);

        const belt = makeState({
            bases: [
                makeBase('base_the_dohyo', [
                    makeMinion('sumo-anchor', 'sumo_wrestlers_rookie_sumo', '0', 2),
                    makeMinion('belt-target', 'musketeers_young_musketeer', '1', 3),
                ]),
                makeBase('base_heya_training_stable', []),
            ],
        });
        const beltResult = invokeRegisteredAbilityContract('sumo_wrestlers_grasp_the_belt', 'onPlay', {
            state: belt,
            matchState: makeMatchState(belt),
            playerId: '0',
            cardUid: 'belt',
            defId: 'sumo_wrestlers_grasp_the_belt',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 72,
        });
        const beltTarget = respondToPromptOption(
            beltResult.matchState!,
            option => option.value?.minionUid === 'belt-target',
            '抓住腰带移动目标',
            '0',
            FIXED_RANDOM,
        );
        const beltDestination = respondToPromptOption(
            beltTarget.finalState,
            option => option.value?.baseIndex === 1,
            '抓住腰带目标基地',
            '0',
            FIXED_RANDOM,
        );
        expect(beltDestination.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['sumo-anchor']);
        expect(beltDestination.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['belt-target']);
    });

    it('火枪手 Porthos 只防其他玩家行动，最后一搏在计分前 +2 并抽牌', () => {
        const porthos = makeState({
            bases: [makeBase('base_bastion_saint_gervais', [
                makeMinion('porthos', 'musketeers_porthos', '0', 5),
            ])],
        });
        expect(isMinionProtected(porthos, porthos.bases[0].minions[0], 0, '1', 'action', { sourceKind: 'action' })).toBe(true);
        expect(isMinionProtected(porthos, porthos.bases[0].minions[0], 0, '0', 'action', { sourceKind: 'action' })).toBe(false);
        expect(isMinionProtected(porthos, porthos.bases[0].minions[0], 0, '1', 'destroy', { sourceKind: 'action' })).toBe(false);

        const lastStand = makeState({
            players: {
                '0': makePlayer('0', { deck: [makeCard('last-draw', 'musketeers_en_garde', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_the_golden_lily', [
                makeMinion('guard', 'musketeers_young_musketeer', '0', 3),
                makeMinion('enemy', 'sumo_wrestlers_rookie_sumo', '1', 2),
            ])],
        });
        const lastStandResult = invokeRegisteredAbilityContract('musketeers_last_stand', 'special', {
            state: lastStand,
            matchState: makeMatchState(lastStand),
            playerId: '0',
            cardUid: 'last-stand',
            defId: 'musketeers_last_stand',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 73,
        });
        const afterLastStand = applyEvents(lastStand, lastStandResult.events);
        expect(afterLastStand.bases[0].minions[0].tempPowerModifier).toBe(2);
        expect(afterLastStand.players['0'].hand.map(card => card.uid)).toEqual(['last-draw']);
        expect(afterLastStand.bases[0].minions[1].tempPowerModifier ?? 0).toBe(0);
    });

    it('骑警嗯？暴露弃牌堆 special，命令结算后 +1、回手且每回合只用一次', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('eh-discard', 'mounties_eh', 'action', '0')],
                    actionsPlayed: 1,
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_strategic_syrup_reserve', [
                    makeMinion('ally-a', 'mounties_dudlee', '0', 2),
                ]),
                makeBase('base_great_white_north_eh', [
                    makeMinion('ally-b', 'mounties_war_canuck', '0', 3),
                    makeMinion('enemy', 'musketeers_young_musketeer', '1', 3),
                ]),
            ],
        });

        const options = getDiscardSpecialOptions(core, '0');
        expect(options).toHaveLength(1);
        expect(options[0]?.sourceId).toBe('mounties_eh');
        expect(options[0]?.allowedBaseIndices).toEqual([0, 1]);
        expect(options[0]?.allowedMinionUids).toEqual(['ally-a', 'ally-b']);

        const resolved = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { discardCardUid: 'eh-discard', baseIndex: 1, targetMinionUid: 'ally-b' },
        } as never, FIXED_RANDOM);

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.sys.interaction?.current).toBeUndefined();
        expect(resolved.finalState.core.bases[1].minions[0].tempPowerModifier).toBe(1);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('eh-discard');
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('eh-discard');
        expect(resolved.finalState.core.players['0'].usedDiscardPlayAbilities).toContain('mounties_eh');
        expect(getDiscardSpecialOptions(resolved.finalState.core, '0')).toHaveLength(0);
    });

    it('骑警带进来、Dudlee、挪过去和北方搬运者补齐移动触发与目标限制', () => {
        const bringIn = makeState({
            bases: [
                makeBase('base_strategic_syrup_reserve', []),
                makeBase('base_great_white_north_eh', [
                    makeMinion('host', 'musketeers_young_musketeer', '1', 3, {
                        attachedActions: [{ uid: 'bring-in', defId: 'mounties_bring_em_in', ownerId: '0' }],
                    }),
                ]),
            ],
        });
        const bringInResult = executeTriggerProgramExecutor('onMinionMoved', 'mounties_bring_em_in', {
            state: bringIn,
            matchState: makeMatchState(bringIn),
            timing: 'onMinionMoved',
            playerId: '0',
            sourceDefId: 'mounties_bring_em_in',
            sourceCardUid: 'bring-in',
            sourceBaseIndex: 1,
            sourceControllerId: '0',
            triggerMinionUid: 'host',
            moveToBaseIndex: 1,
            random: FIXED_RANDOM,
            now: 74,
        });
        expect(bringInResult.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.POWER_COUNTER_ADDED,
            payload: expect.objectContaining({ minionUid: 'host', amount: 1, reason: 'mounties_bring_em_in' }),
        }));

        const dudlee = makeState({
            bases: [
                makeBase('base_strategic_syrup_reserve', [
                    makeMinion('dudlee', 'mounties_dudlee', '0', 2),
                ]),
                makeBase('base_great_white_north_eh', [
                    makeMinion('enemy-here', 'musketeers_young_musketeer', '1', 3),
                ]),
                makeBase('base_ringside', [
                    makeMinion('ally-only', 'mounties_war_canuck', '0', 3),
                ]),
            ],
        });
        const dudleeResult = invokeRegisteredAbilityContract('mounties_dudlee', 'talent', {
            state: dudlee,
            matchState: makeMatchState(dudlee),
            playerId: '0',
            cardUid: 'dudlee',
            defId: 'mounties_dudlee',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 75,
        });
        const dudleePrompt = getFirstPrompt(dudleeResult.matchState!);
        expect(getPromptOptions(dudleePrompt).map(option => option.value?.baseIndex)).toEqual([1]);
        const afterDudlee = respondToPromptOption(
            dudleeResult.matchState!,
            option => option.value?.baseIndex === 1,
            'Dudlee 有敌方随从的目标基地',
            '0',
            FIXED_RANDOM,
        );
        expect(afterDudlee.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['enemy-here', 'dudlee']);
        expect(afterDudlee.finalState.core.bases[1].minions[1].tempPowerModifier).toBe(1);

        const moveAboot = makeState({
            bases: [
                makeBase('base_strategic_syrup_reserve', [
                    makeMinion('mover-a', 'mounties_dudlee', '0', 2),
                ]),
                makeBase('base_great_white_north_eh', [
                    makeMinion('enemy-target-base', 'musketeers_young_musketeer', '1', 3),
                ]),
                makeBase('base_ringside', [
                    makeMinion('mover-b', 'mounties_war_canuck', '0', 3),
                    makeMinion('enemy-other-base', 'sumo_wrestlers_rookie_sumo', '1', 2),
                ]),
            ],
        });
        const moveAbootResult = invokeRegisteredAbilityContract('mounties_move_aboot', 'onPlay', {
            state: moveAboot,
            matchState: makeMatchState(moveAboot),
            playerId: '0',
            cardUid: 'move-aboot',
            defId: 'mounties_move_aboot',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 76,
        });
        const moveAbootTarget = respondToPromptOption(
            moveAbootResult.matchState!,
            option => option.value?.minionUid === 'mover-a',
            '挪过去己方随从目标',
            '0',
            FIXED_RANDOM,
        );
        const moveAbootPrompt = getFirstPrompt(moveAbootTarget.finalState);
        expect(getPromptOptions(moveAbootPrompt).map(option => option.value?.baseIndex)).toEqual([1, 2]);
        const afterMoveAboot = respondToPromptOption(
            moveAbootTarget.finalState,
            option => option.value?.baseIndex === 1,
            '挪过去有敌方随从的目标基地',
            '0',
            FIXED_RANDOM,
        );
        expect(afterMoveAboot.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['enemy-target-base', 'mover-a']);
        expect(afterMoveAboot.finalState.core.bases[1].minions[1].tempPowerModifier).toBe(2);

        const northern = makeState({
            bases: [makeBase('base_strategic_syrup_reserve', [
                makeMinion('northern', 'mounties_northern_mover', '0', 4),
                makeMinion('ally', 'mounties_dudlee', '0', 2),
            ])],
        });
        const northernResult = invokeRegisteredAbilityContract('mounties_northern_mover', 'talent', {
            state: northern,
            matchState: makeMatchState(northern),
            playerId: '0',
            cardUid: 'northern',
            defId: 'mounties_northern_mover',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 77,
        });
        const northernPower = respondToPromptOption(
            northernResult.matchState!,
            option => option.value?.mode === 'power',
            '北方搬运者 +1 分支',
            '0',
            FIXED_RANDOM,
        );
        expect(northernPower.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.TEMP_POWER_ADDED,
            payload: expect.objectContaining({ minionUid: 'ally', amount: 1, reason: 'mounties_northern_mover' }),
        }));
        expect(northernPower.finalState.core.bases[0].minions[1].tempPowerModifier).toBe(1);
    });

    it('骑警 Haich-Q 天赋可把己方随从移入或移出宿主基地', () => {
        const moveIn = makeState({
            bases: [
                makeBase({
                    defId: 'base_strategic_syrup_reserve',
                    ongoingActions: [{ uid: 'haich-q', defId: 'mounties_haich_q', ownerId: '0' }],
                    minions: [makeMinion('host-ally', 'mounties_dudlee', '0', 2)],
                }),
                makeBase('base_great_white_north_eh', [
                    makeMinion('away-ally', 'mounties_war_canuck', '0', 3),
                ]),
            ],
        });
        const moveInResult = invokeRegisteredAbilityContract('mounties_haich_q', 'talent', {
            state: moveIn,
            matchState: makeMatchState(moveIn),
            playerId: '0',
            cardUid: 'haich-q',
            defId: 'mounties_haich_q',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 78,
        });
        const moveInTarget = respondToPromptOption(
            moveInResult.matchState!,
            option => option.value?.minionUid === 'away-ally',
            'Haich-Q 移入目标',
            '0',
            FIXED_RANDOM,
        );
        const moveInPrompt = getFirstPrompt(moveInTarget.finalState);
        expect(getPromptOptions(moveInPrompt).map(option => option.value?.baseIndex)).toEqual([0]);
        const afterMoveIn = respondToPromptOption(
            moveInTarget.finalState,
            option => option.value?.baseIndex === 0,
            'Haich-Q 移入宿主基地',
            '0',
            FIXED_RANDOM,
        );
        expect(afterMoveIn.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['host-ally', 'away-ally']);
        expect(afterMoveIn.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_MOVED,
            payload: expect.objectContaining({ minionUid: 'away-ally', fromBaseIndex: 1, toBaseIndex: 0, reason: 'mounties_haich_q' }),
        }));

        const moveOut = makeState({
            bases: [
                makeBase({
                    defId: 'base_strategic_syrup_reserve',
                    ongoingActions: [{ uid: 'haich-q', defId: 'mounties_haich_q', ownerId: '0' }],
                    minions: [makeMinion('source-ally', 'mounties_dudlee', '0', 2)],
                }),
                makeBase('base_great_white_north_eh', []),
                makeBase('base_ringside', []),
            ],
        });
        const moveOutResult = invokeRegisteredAbilityContract('mounties_haich_q', 'talent', {
            state: moveOut,
            matchState: makeMatchState(moveOut),
            playerId: '0',
            cardUid: 'haich-q',
            defId: 'mounties_haich_q',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 79,
        });
        const moveOutTarget = respondToPromptOption(
            moveOutResult.matchState!,
            option => option.value?.minionUid === 'source-ally',
            'Haich-Q 移出目标',
            '0',
            FIXED_RANDOM,
        );
        const moveOutPrompt = getFirstPrompt(moveOutTarget.finalState);
        expect(getPromptOptions(moveOutPrompt).map(option => option.value?.baseIndex)).toEqual([1, 2]);
        const afterMoveOut = respondToPromptOption(
            moveOutTarget.finalState,
            option => option.value?.baseIndex === 2,
            'Haich-Q 移出到其它基地',
            '0',
            FIXED_RANDOM,
        );
        expect(afterMoveOut.finalState.core.bases[2].minions.map(minion => minion.uid)).toEqual(['source-ally']);
        expect(afterMoveOut.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_MOVED,
            payload: expect.objectContaining({ minionUid: 'source-ally', fromBaseIndex: 0, toBaseIndex: 2, reason: 'mounties_haich_q' }),
        }));
    });

    it('呼叫警徽的打出和计分前 special 都能给一个基地的己方随从放置指示物', () => {
        const onPlayCore = makeState({
            bases: [
                makeBase('base_strategic_syrup_reserve', [
                    makeMinion('mountie-a', 'mounties_dudlee', '0', 2),
                    makeMinion('enemy-a', 'musketeers_young_musketeer', '1', 3),
                ]),
                makeBase('base_great_white_north_eh', [
                    makeMinion('mountie-b', 'mounties_war_canuck', '0', 3),
                    makeMinion('mountie-c', 'mounties_northern_mover', '0', 4),
                ]),
            ],
        });
        const onPlay = invokeRegisteredAbilityContract('mounties_when_calls_the_badge', 'onPlay', {
            state: onPlayCore,
            matchState: makeMatchState(onPlayCore),
            playerId: '0',
            cardUid: 'badge',
            defId: 'mounties_when_calls_the_badge',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 78,
        });
        const badgeTarget = respondToPromptOption(
            onPlay.matchState!,
            option => option.value?.baseIndex === 1,
            '呼叫警徽 onPlay 目标基地',
            '0',
            FIXED_RANDOM,
        );
        expect(badgeTarget.finalState.core.bases[0].minions[0].powerCounters ?? 0).toBe(0);
        expect(badgeTarget.finalState.core.bases[1].minions.map(minion => minion.powerCounters ?? 0)).toEqual([1, 1]);

        const specialCore = makeState({
            bases: [makeBase('base_great_white_north_eh', [
                makeMinion('mountie-special-a', 'mounties_dudlee', '0', 2),
                makeMinion('mountie-special-b', 'mounties_war_canuck', '0', 3),
                makeMinion('enemy-special', 'musketeers_young_musketeer', '1', 3),
            ])],
        });
        const special = invokeRegisteredAbilityContract('mounties_when_calls_the_badge', 'special', {
            state: specialCore,
            matchState: makeMatchState(specialCore),
            playerId: '0',
            cardUid: 'badge-special',
            defId: 'mounties_when_calls_the_badge',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 79,
        });
        const afterSpecial = applyEvents(specialCore, special.events);
        expect(afterSpecial.bases[0].minions.map(minion => minion.powerCounters ?? 0)).toEqual([1, 1, 0]);
    });

    it('快速 Set-Up 真实附着到其他玩家随从后可不使用额外行动，也可再附着一张行动', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('quick', 'luchadors_quick_set_up', 'action', '0'),
                        makeCard('smart', 'luchadors_smart_set_up', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_ringside', [
                makeMinion('ally', 'luchadors_yellow_demon', '0', 2),
                makeMinion('enemy', 'musketeers_young_musketeer', '1', 3),
            ])],
        });

        const playedQuick = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'quick', targetBaseIndex: 0, targetMinionUid: 'enemy' },
            },
            FIXED_RANDOM,
        );
        expect(playedQuick.success, playedQuick.error).toBe(true);
        expect(playedQuick.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.ACTION_PLAYED,
                payload: expect.objectContaining({ cardUid: 'quick', targetMinionUid: 'enemy' }),
            }),
            expect.objectContaining({
                type: SU_EVENTS.LIMIT_MODIFIED,
                payload: expect.objectContaining({ playerId: '0', limitType: 'action', reason: 'luchadors_quick_set_up' }),
            }),
        ]));
        expect(playedQuick.finalState.core.bases[0].minions[1].attachedActions).toEqual([
            expect.objectContaining({ uid: 'quick', defId: 'luchadors_quick_set_up', ownerId: '0' }),
        ]);
        expect(getFirstPrompt(playedQuick.finalState)).toBeUndefined();
        expect(playedQuick.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['smart']);
        expect(playedQuick.finalState.core.players['0'].actionsPlayed).toBe(1);
        expect(playedQuick.finalState.core.players['0'].actionLimit).toBe(2);

        const playedSmart = runCommand(
            playedQuick.finalState,
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'smart', targetBaseIndex: 0, targetMinionUid: 'enemy' },
            },
            FIXED_RANDOM,
        );
        expect(playedSmart.success, playedSmart.error).toBe(true);
        expect(playedSmart.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ACTION_PLAYED,
            payload: expect.objectContaining({ cardUid: 'smart', targetMinionUid: 'enemy' }),
        }));
        expect(playedSmart.finalState.core.bases[0].minions[1].attachedActions).toEqual([
            expect.objectContaining({ uid: 'quick', defId: 'luchadors_quick_set_up', ownerId: '0' }),
            expect.objectContaining({ uid: 'smart', defId: 'luchadors_smart_set_up', ownerId: '0' }),
        ]);
        expect(playedSmart.finalState.core.players['0'].actionsPlayed).toBe(2);
        expect(playedSmart.finalState.core.players['0'].hand).toHaveLength(0);
    });

    it('擂台边能识别压制的真实附着事件并在影响其他玩家随从后抽牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('pin-card', 'luchadors_pin', 'action', '0')],
                    deck: [makeCard('ringside-draw', 'luchadors_tag_team', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_ringside', [
                makeMinion('enemy', 'musketeers_young_musketeer', '1', 3, {
                    attachedActions: [
                        { uid: 'setup-existing', defId: 'luchadors_smart_set_up', ownerId: '0' },
                    ],
                }),
            ])],
        });

        const playedPin = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'pin-card', targetBaseIndex: 0, targetMinionUid: 'enemy' },
            },
            FIXED_RANDOM,
        );

        expect(playedPin.success, playedPin.error).toBe(true);
        expect(playedPin.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.ONGOING_ATTACHED,
                payload: expect.objectContaining({ defId: 'luchadors_pin', targetMinionUid: 'enemy' }),
            }),
            expect.objectContaining({
                type: SU_EVENTS.CARDS_DRAWN,
                payload: expect.objectContaining({ playerId: '0', cardUids: ['ringside-draw'] }),
            }),
        ]));
        expect(playedPin.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['ringside-draw']);
        expect(playedPin.finalState.core.players['0'].deck).toHaveLength(0);
        expect(playedPin.finalState.core.triggerQueue ?? []).toHaveLength(0);
        expect(playedPin.finalState.core.bases[0].minions[0].attachedActions.map(action => action.defId)).toEqual([
            'luchadors_smart_set_up',
            'luchadors_pin',
        ]);
    });

    it('快速 Set-Up 授予额外行动；让路完成移动并给额外行动；廉价欢呼无 Set-Up 时为 +2', () => {
        const quick = makeState();
        const quickResult = invokeRegisteredAbilityContract('luchadors_quick_set_up', 'onPlay', {
            state: quick,
            matchState: makeMatchState(quick),
            playerId: '0',
            cardUid: 'quick-setup',
            defId: 'luchadors_quick_set_up',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 80,
        });
        expect(quickResult.events[0]).toMatchObject({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: { playerId: '0', limitType: 'action', reason: 'luchadors_quick_set_up' },
        });

        const makeWay = makeState({
            bases: [
                makeBase('base_bastion_saint_gervais', [
                    makeMinion('musketeer', 'musketeers_young_musketeer', '0', 3),
                ]),
                makeBase('base_the_golden_lily', []),
            ],
        });
        const makeWayResult = invokeRegisteredAbilityContract('musketeers_make_way', 'onPlay', {
            state: makeWay,
            matchState: makeMatchState(makeWay),
            playerId: '0',
            cardUid: 'make-way',
            defId: 'musketeers_make_way',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 81,
        });
        expect(makeWayResult.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({ playerId: '0', limitType: 'action', reason: 'musketeers_make_way' }),
        }));
        const makeWayTarget = respondToPromptOption(
            makeWayResult.matchState!,
            option => option.value?.minionUid === 'musketeer',
            '让路己方随从目标',
            '0',
            FIXED_RANDOM,
        );
        const makeWayDestination = respondToPromptOption(
            makeWayTarget.finalState,
            option => option.value?.baseIndex === 1,
            '让路目标基地',
            '0',
            FIXED_RANDOM,
        );
        expect(makeWayDestination.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_MOVED,
            payload: expect.objectContaining({ minionUid: 'musketeer', reason: 'musketeers_make_way' }),
        }));
        expect(makeWayDestination.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['musketeer']);

        const cheapPop = makeState({
            bases: [makeBase('base_ringside', [
                makeMinion('luchador', 'luchadors_yellow_demon', '0', 2),
            ])],
        });
        const cheapPopResult = invokeRegisteredAbilityContract('luchadors_cheap_pop', 'onPlay', {
            state: cheapPop,
            matchState: makeMatchState(cheapPop),
            playerId: '0',
            cardUid: 'cheap-pop',
            defId: 'luchadors_cheap_pop',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 82,
        });
        const afterCheapPop = applyEvents(cheapPop, cheapPopResult.events);
        expect(afterCheapPop.bases[0].minions[0].tempPowerModifier).toBe(2);
    });
});
