import { beforeEach, describe, expect, it } from 'vitest';

import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { collectTriggers, fireTriggers } from '../../domain/ongoingEffects';
import { maybeResolveReactionQueue } from '../../domain/reactionQueue';
import { SMASHUP_FACTION_IDS } from '../../domain/ids';
import {
    appendScoringFrameDeferredPayload,
    buildPendingPostScoringActionEvents,
    consumeScoringFrameDeferredPayload,
    createScoringBaseRef,
    createScoringSession,
    setScoringSession,
} from '../../domain/scoringSession';
import { SU_COMMANDS, SU_EVENTS, type SmashUpEvent, type TitanState } from '../../domain/types';
import {
    applyEvents,
    expectNoPrompt,
    getPromptOption,
    getSimpleChoicePrompt,
    invokeRegisteredAbilityContract,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPrompt,
    respondToPromptOption,
    respondToPromptOptions,
} from '../helpers';
import { defaultTestRandom, runCommand } from '../testRunner';
import type { RandomFn } from '../../../../engine/types';

const reverseRandom: RandomFn = {
    ...defaultTestRandom,
    shuffle: <T>(arr: T[]) => [...arr].reverse(),
};

function penguinCore(overrides: Parameters<typeof makeState>[0] = {}) {
    return makeState({
        players: {
            '0': makePlayer('0'),
            '1': makePlayer('1'),
        },
        bases: [makeBase('base_ice_floe')],
        ...overrides,
    });
}

function ongoing(uid: string, defId: string, ownerId = '0') {
    return { uid, defId, ownerId };
}

function emperorTitan(uid = 'emperor-setaside'): TitanState {
    return {
        uid,
        defId: 'penguins_emperor_penguin',
        faction: SMASHUP_FACTION_IDS.PENGUINS,
        ownerId: '0',
        controllerId: '0',
        powerCounters: 0,
        talentUsed: false,
        location: { zone: 'setaside' },
    };
}

beforeEach(() => {
    resetAbilityInit();
    initAllAbilities();
});

function resolveReactionBySourceDefId(state: any, sourceDefId: string) {
    const triggersById = new Map((state.core.triggerQueue ?? []).map((trigger: any) => [trigger.id, trigger]));
    return respondToPromptOption(
        state,
        option => triggersById.get(option.value?.triggerId)?.sourceDefId === sourceDefId,
        sourceDefId,
        '0',
        defaultTestRandom,
    );
}

describe('企鹅派系能力', () => {
    it('冲浪企鹅可移动这里的己方伙伴到另一个合法基地，并支持跳过敌方目标', () => {
        const core = penguinCore({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_ice_floe', [
                    makeMinion('surf', 'penguins_surfing_penguin', '0', 3),
                    makeMinion('ally', 'penguins_baby_penguin', '0', 2),
                    makeMinion('enemy', 'robot_microbot_alpha', '1', 1),
                ]),
                makeBase('base_the_colony'),
                makeBase('base_ice_floe'),
            ],
        });

        const result = invokeRegisteredAbilityContract('penguins_surfing_penguin', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'surf',
            defId: 'penguins_surfing_penguin',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 15,
        });

        const chooseMinion = getSimpleChoicePrompt(result.matchState!, 'penguins_surfing_penguin');
        expect(chooseMinion.options.some((option: any) => option.value?.skip === true)).toBe(true);
        expect(chooseMinion.options.some((option: any) => option.value?.minionUid === 'ally')).toBe(true);
        expect(chooseMinion.options.some((option: any) => option.value?.minionUid === 'enemy')).toBe(false);

        const selectedMinion = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'ally',
            '冲浪企鹅移动己方伙伴',
            '0',
        );
        expect(selectedMinion.success, selectedMinion.error).toBe(true);

        const chooseBase = getSimpleChoicePrompt(selectedMinion.finalState, 'penguins_surfing_penguin_choose_base');
        expect(chooseBase.options.some((option: any) => option.value?.baseIndex === 0)).toBe(false);
        expect(chooseBase.options.some((option: any) => option.value?.baseIndex === 1)).toBe(true);
        expect(chooseBase.options.some((option: any) => option.value?.baseIndex === 2)).toBe(true);

        const resolved = respondToPromptOption(
            selectedMinion.finalState,
            option => option.value?.baseIndex === 1,
            '冲浪企鹅目的基地',
            '0',
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['surf', 'enemy']);
        expect(resolved.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['ally']);
        expectNoPrompt(resolved.finalState);
    });

    it('企鹅司令会从牌库顶额外打出伙伴且不消耗普通出牌额度', () => {
        const core = penguinCore({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('baby-top', 'penguins_baby_penguin', 'minion', '0'),
                        makeCard('secret-rest', 'penguins_secret_mission', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_ice_floe', [
                makeMinion('command', 'penguins_command_penguin', '0', 4),
            ])],
        });

        const result = invokeRegisteredAbilityContract('penguins_command_penguin', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'command',
            defId: 'penguins_command_penguin',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 10,
        });

        expect(result.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.MINION_PLAYED,
                payload: expect.objectContaining({
                    cardUid: 'baby-top',
                    defId: 'penguins_baby_penguin',
                    fromDeck: true,
                    consumesNormalLimit: false,
                }),
            }),
        ]));

        const finalCore = applyEvents(core, result.events);
        expect(finalCore.players['0'].deck.map(card => card.uid)).toEqual(['secret-rest']);
        expect(finalCore.bases[0].minions.map(minion => minion.uid)).toEqual(['command', 'baby-top']);
        expect(finalCore.players['0'].minionsPlayed).toBe(0);
    });

    it('企鹅司令从牌库顶打出时髦企鹅时会经真实命令管线结算水晶礼品', () => {
        const core = penguinCore({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('command', 'penguins_command_penguin', 'minion', '0')],
                    deck: [
                        makeCard('snazzy', 'penguins_snazzy_penguin', 'minion', '0'),
                        makeCard('draw-1', 'penguins_secret_mission', 'action', '0'),
                        makeCard('draw-2', 'penguins_the_hatching', 'action', '0'),
                        makeCard('draw-3', 'penguins_under_the_ice', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_ice_floe',
                minions: [],
                ongoingActions: [ongoing('gift', 'penguins_pebble_gift')],
            })],
        });

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'command', baseIndex: 0 },
        } as any);

        expect(result.success, result.error).toBe(true);
        expect(result.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['command', 'snazzy']);
        expect(result.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-1', 'draw-2', 'draw-3']);
        expect(result.finalState.core.players['0'].deck).toEqual([]);
        expect(result.finalState.core.triggerQueue ?? []).toEqual([]);
        expectNoPrompt(result.finalState);
    });

    it('时髦企鹅只有从牌库顶打出时才抽两张牌', () => {
        const core = penguinCore({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('draw-1', 'penguins_secret_mission', 'action', '0'),
                        makeCard('draw-2', 'penguins_the_hatching', 'action', '0'),
                        makeCard('stay', 'penguins_baby_penguin', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const normal = invokeRegisteredAbilityContract('penguins_snazzy_penguin', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'snazzy',
            defId: 'penguins_snazzy_penguin',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 20,
        });
        expect(normal.events).toEqual([]);

        const fromDeck = invokeRegisteredAbilityContract('penguins_snazzy_penguin', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'snazzy',
            defId: 'penguins_snazzy_penguin',
            baseIndex: 0,
            fromDeck: true,
            random: defaultTestRandom,
            now: 21,
        });
        const finalCore = applyEvents(core, fromDeck.events);
        expect(finalCore.players['0'].hand.map(card => card.uid)).toEqual(['draw-1', 'draw-2']);
        expect(finalCore.players['0'].deck.map(card => card.uid)).toEqual(['stay']);
    });

    it('破壳而出会从牌库顶额外打出伙伴且不消耗普通出牌额度', () => {
        const core = penguinCore({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('hatching-top', 'penguins_baby_penguin', 'minion', '0'),
                        makeCard('after', 'penguins_secret_mission', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('penguins_the_hatching', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'hatching',
            defId: 'penguins_the_hatching',
            baseIndex: 0,
            targetBaseIndex: 0,
            random: defaultTestRandom,
            now: 25,
        });
        const finalCore = applyEvents(core, result.events);

        expect(result.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_PLAYED,
            payload: expect.objectContaining({
                cardUid: 'hatching-top',
                defId: 'penguins_baby_penguin',
                fromDeck: true,
                consumesNormalLimit: false,
            }),
        }));
        expect(finalCore.bases[0].minions.map(minion => minion.uid)).toEqual(['hatching-top']);
        expect(finalCore.players['0'].deck.map(card => card.uid)).toEqual(['after']);
        expect(finalCore.players['0'].minionsPlayed).toBe(0);
    });

    it('企鹅宝宝从牌库顶打出时可额外打出手牌中力量 3 或更少的伙伴', () => {
        const core = penguinCore({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('low', 'penguins_surfing_penguin', 'minion', '0'),
                        makeCard('high', 'penguins_command_penguin', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_ice_floe', [
                makeMinion('baby', 'penguins_baby_penguin', '0', 2),
            ])],
        });

        const result = invokeRegisteredAbilityContract('penguins_baby_penguin', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'baby',
            defId: 'penguins_baby_penguin',
            baseIndex: 0,
            fromDeck: true,
            random: defaultTestRandom,
            now: 30,
        });

        const prompt = getSimpleChoicePrompt(result.matchState!, 'penguins_baby_penguin');
        expect(prompt.options.some((option: any) => option.value?.cardUid === 'low')).toBe(true);
        expect(prompt.options.some((option: any) => option.value?.cardUid === 'high')).toBe(false);

        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.cardUid === 'low',
            '企鹅宝宝额外打出的伙伴',
            '0',
            defaultTestRandom,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['baby', 'low']);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['high']);
    });

    it('跳舞企鹅会替代其他手牌伙伴打出，并把原伙伴放到牌库底', () => {
        const core = penguinCore({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('original', 'penguins_surfing_penguin', 'minion', '0'),
                        makeCard('dancing', 'penguins_dancing_penguin', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'original', baseIndex: 0, replacementHandCardUid: 'dancing' },
        } as any);

        expect(result.success, result.error).toBe(true);
        expect(result.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['dancing']);
        expect(result.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['original']);
        expect(result.finalState.core.players['0'].hand).toEqual([]);
    });

    it('乔装企鹅天赋会将自身置底并从牌库顶额外打出伙伴到原基地', () => {
        const core = penguinCore({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('top-baby', 'penguins_baby_penguin', 'minion', '0'),
                        makeCard('after', 'penguins_secret_mission', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_ice_floe', [
                makeMinion('disguise', 'penguins_disguise_penguin', '0', 3),
            ])],
        });

        const result = invokeRegisteredAbilityContract('penguins_disguise_penguin', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'disguise',
            defId: 'penguins_disguise_penguin',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 35,
        });
        const finalCore = applyEvents(core, result.events);

        expect(finalCore.bases[0].minions.map(minion => minion.uid)).toEqual(['top-baby']);
        expect(finalCore.players['0'].deck.map(card => card.uid)).toEqual(['after', 'disguise']);
        expect(finalCore.players['0'].minionsPlayed).toBe(0);
        expect(result.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_PLAYED,
            payload: expect.objectContaining({
                cardUid: 'top-baby',
                fromDeck: true,
                consumesNormalLimit: false,
                discardPlaySourceId: 'penguins_disguise_penguin',
            }),
        }));
    });

    it('秘密任务会把选中手牌置底、抽等量牌并重洗剩余牌库', () => {
        const core = penguinCore({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('hand-1', 'penguins_surfing_penguin', 'minion', '0'),
                        makeCard('hand-2', 'penguins_secret_mission', 'action', '0'),
                        makeCard('keep', 'penguins_the_hatching', 'action', '0'),
                    ],
                    deck: [
                        makeCard('draw-1', 'penguins_baby_penguin', 'minion', '0'),
                        makeCard('draw-2', 'penguins_snazzy_penguin', 'minion', '0'),
                        makeCard('stay', 'penguins_command_penguin', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('penguins_secret_mission', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'mission',
            defId: 'penguins_secret_mission',
            baseIndex: 0,
            random: reverseRandom,
            now: 40,
        });
        const prompt = getSimpleChoicePrompt(result.matchState!, 'penguins_secret_mission');
        const first = getPromptOption(prompt, option => option.value?.cardUid === 'hand-1', '秘密任务第一张手牌');
        const second = getPromptOption(prompt, option => option.value?.cardUid === 'hand-2', '秘密任务第二张手牌');

        const resolved = respondToPromptOptions(result.matchState!, [first.id, second.id], '0', reverseRandom);

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['keep', 'draw-1', 'draw-2']);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['hand-2', 'hand-1', 'stay']);
    });

    it('反刍企鹅可拿走展示行动并按玩家顺序放回剩余牌库顶', () => {
        const core = penguinCore({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('action-a', 'penguins_secret_mission', 'action', '0'),
                        makeCard('minion-b', 'penguins_baby_penguin', 'minion', '0'),
                        makeCard('action-c', 'penguins_the_hatching', 'action', '0'),
                        makeCard('rest', 'penguins_command_penguin', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('penguins_regurgitating_penguin', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'regurgitating',
            defId: 'penguins_regurgitating_penguin',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 50,
        });
        const choosePrompt = getSimpleChoicePrompt(result.matchState!, 'penguins_regurgitating_penguin');
        const actionC = getPromptOption(choosePrompt, option => option.value?.cardUid === 'action-c', '反刍企鹅拿走行动');
        const chosen = respondToPrompt(result.matchState!, actionC.id, '0');

        expect(chosen.success, chosen.error).toBe(true);
        const orderPrompt = getSimpleChoicePrompt(chosen.finalState, 'penguins_regurgitating_penguin_order');
        const minionB = getPromptOption(orderPrompt, option => option.value?.cardUid === 'minion-b', '反刍企鹅剩余随从');
        const actionA = getPromptOption(orderPrompt, option => option.value?.cardUid === 'action-a', '反刍企鹅剩余行动');
        const ordered = respondToPromptOptions(chosen.finalState, [minionB.id, actionA.id], '0');

        expect(ordered.success, ordered.error).toBe(true);
        expect(ordered.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['action-c']);
        expect(ordered.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['minion-b', 'action-a', 'rest']);
        expectNoPrompt(ordered.finalState);
    });

    it('渴望飞翔的工作可选择打出企鹅帝皇到目标基地', () => {
        const core = penguinCore({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_ice_floe', [
                    makeMinion('wish-host', 'penguins_baby_penguin', '0', 2),
                ]),
                makeBase('base_the_colony'),
            ],
            titans: [emperorTitan()],
        });

        const result = invokeRegisteredAbilityContract('penguins_a_wish_for_wings_that_work', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'wish',
            defId: 'penguins_a_wish_for_wings_that_work',
            baseIndex: 0,
            targetBaseIndex: 1,
            random: defaultTestRandom,
            now: 55,
        });
        const prompt = getSimpleChoicePrompt(result.matchState!, 'penguins_a_wish_for_wings_that_work');
        expect(prompt.options.some((option: any) => option.value?.mode === 'titan')).toBe(true);
        expect(prompt.options.some((option: any) => option.value?.mode === 'power')).toBe(false);

        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.mode === 'titan',
            '渴望飞翔的工作打出企鹅帝皇',
            '0',
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.titans?.find(titan => titan.uid === 'emperor-setaside')?.location).toEqual({
            zone: 'base',
            baseIndex: 1,
            enteredAt: expect.any(Number),
        });
        expect(resolved.finalState.core.players['0'].minionsPlayed).toBe(0);
        expectNoPrompt(resolved.finalState);
    });

    it('渴望飞翔的工作在没有可打出企鹅帝皇时会给目标基地己方伙伴本回合 +1', () => {
        const core = penguinCore({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_ice_floe', [
                    makeMinion('own-a', 'penguins_baby_penguin', '0', 2),
                    makeMinion('own-b', 'penguins_surfing_penguin', '0', 3),
                    makeMinion('enemy', 'robot_microbot_alpha', '1', 1),
                ]),
            ],
        });

        const result = invokeRegisteredAbilityContract('penguins_a_wish_for_wings_that_work', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'wish',
            defId: 'penguins_a_wish_for_wings_that_work',
            baseIndex: 0,
            targetBaseIndex: 0,
            random: defaultTestRandom,
            now: 57,
        });
        const finalCore = applyEvents(core, result.events);

        expect(result.events.filter(event => event.type === SU_EVENTS.TEMP_POWER_ADDED).map(event => event.payload.minionUid)).toEqual(['own-a', 'own-b']);
        expect(finalCore.bases[0].minions.map(minion => ({
            uid: minion.uid,
            tempPowerModifier: minion.tempPowerModifier ?? 0,
        }))).toEqual([
            { uid: 'own-a', tempPowerModifier: 1 },
            { uid: 'own-b', tempPowerModifier: 1 },
            { uid: 'enemy', tempPowerModifier: 0 },
        ]);
    });

    it('我不能区分他们会洗回选中伙伴并额外打出同数量牌库顶伙伴', () => {
        const core = penguinCore({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('new-1', 'penguins_baby_penguin', 'minion', '0'),
                        makeCard('new-2', 'penguins_disguise_penguin', 'minion', '0'),
                        makeCard('after', 'penguins_secret_mission', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_ice_floe', [
                makeMinion('old-1', 'penguins_surfing_penguin', '0', 3),
                makeMinion('old-2', 'penguins_regurgitating_penguin', '0', 2),
                makeMinion('enemy', 'penguins_baby_penguin', '1', 2),
            ])],
        });

        const result = invokeRegisteredAbilityContract('penguins_i_cant_tell_them_apart', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'apart',
            defId: 'penguins_i_cant_tell_them_apart',
            baseIndex: 0,
            targetBaseIndex: 0,
            random: defaultTestRandom,
            now: 60,
        });
        const prompt = getSimpleChoicePrompt(result.matchState!, 'penguins_i_cant_tell_them_apart');
        const old1 = getPromptOption(prompt, option => option.value?.minionUid === 'old-1', '第一个洗回伙伴');
        const old2 = getPromptOption(prompt, option => option.value?.minionUid === 'old-2', '第二个洗回伙伴');
        const resolved = respondToPromptOptions(result.matchState!, [old1.id, old2.id], '0');

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['enemy', 'new-1', 'new-2']);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['after', 'old-1', 'old-2']);
        expect(resolved.finalState.core.players['0'].hand).toEqual([]);
    });

    it('在冰下会随机打出展示牌中的一个伙伴，并把剩余展示牌放到牌库底', () => {
        const core = penguinCore({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('action-a', 'penguins_secret_mission', 'action', '0'),
                        makeCard('chosen', 'penguins_baby_penguin', 'minion', '0'),
                        makeCard('other-minion', 'penguins_snazzy_penguin', 'minion', '0'),
                        makeCard('action-b', 'penguins_the_hatching', 'action', '0'),
                        makeCard('action-c', 'penguins_i_cant_tell_them_apart', 'action', '0'),
                        makeCard('rest', 'penguins_command_penguin', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('penguins_under_the_ice', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'under',
            defId: 'penguins_under_the_ice',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 70,
        });
        const finalCore = applyEvents(core, result.events);

        expect(finalCore.bases[0].minions.map(minion => minion.uid)).toEqual(['chosen']);
        expect(finalCore.players['0'].deck.map(card => card.uid)).toEqual([
            'rest',
            'action-a',
            'other-minion',
            'action-b',
            'action-c',
        ]);
    });

    it('水晶礼品会在控制者从牌库顶把伙伴打到这里后抽一张牌', () => {
        const core = penguinCore({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw', 'penguins_secret_mission', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_ice_floe',
                minions: [makeMinion('played', 'penguins_baby_penguin', '0', 2)],
                ongoingActions: [ongoing('gift', 'penguins_pebble_gift')],
            })],
        });

        const result = fireTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'played',
            triggerMinionDefId: 'penguins_baby_penguin',
            triggerMinionPower: 2,
            triggerMinionFromDeck: true,
            random: defaultTestRandom,
            now: 80,
        });
        const finalCore = applyEvents(core, result.events);

        expect(finalCore.players['0'].hand.map(card => card.uid)).toEqual(['draw']);
        expect(finalCore.players['0'].deck).toEqual([]);
    });

    it('水晶礼品不会为正常从手牌打出的伙伴排入响应队列', () => {
        const core = penguinCore({
            bases: [makeBase({
                defId: 'base_ice_floe',
                minions: [makeMinion('played', 'penguins_command_penguin', '0', 4)],
                ongoingActions: [ongoing('gift', 'penguins_pebble_gift')],
            })],
        });

        const fromHand = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'played',
            triggerMinionDefId: 'penguins_command_penguin',
            triggerMinionPower: 4,
            triggerMinionFromDeck: false,
            random: defaultTestRandom,
            now: 81,
        });
        expect(fromHand).toBeUndefined();

        const fromDeck = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'played',
            triggerMinionDefId: 'penguins_command_penguin',
            triggerMinionPower: 4,
            triggerMinionFromDeck: true,
            random: defaultTestRandom,
            now: 82,
        });

        expect(fromDeck?.payload.triggers.map(trigger => trigger.sourceDefId)).toEqual(['penguins_pebble_gift']);
    });

    it('浮冰主动基地能力会置底这里的己方伙伴并从牌库顶打出伙伴到这里', () => {
        const core = penguinCore({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('new', 'penguins_baby_penguin', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_ice_floe', [
                makeMinion('old', 'penguins_surfing_penguin', '0', 3),
            ])],
        });

        const initial = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_BASE_ABILITY,
            playerId: '0',
            payload: { baseIndex: 0 },
        } as any);
        expect(initial.success, initial.error).toBe(true);
        const prompt = getSimpleChoicePrompt(initial.finalState, 'base_ice_floe');
        const old = getPromptOption(prompt, option => option.value?.minionUid === 'old', '浮冰置底目标');
        const resolved = respondToPrompt(initial.finalState, old.id, '0');

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['new']);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['old']);
    });

    it('浮冰从牌库顶打出的企鹅宝宝会继续打开宝宝手牌额外打出交互', () => {
        const core = penguinCore({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('hand-helper', 'penguins_baby_penguin', 'minion', '0')],
                    deck: [makeCard('top-baby', 'penguins_baby_penguin', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_ice_floe', [
                makeMinion('old', 'penguins_surfing_penguin', '0', 3),
            ])],
        });

        const initial = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_BASE_ABILITY,
            playerId: '0',
            payload: { baseIndex: 0 },
        } as any);
        expect(initial.success, initial.error).toBe(true);
        const prompt = getSimpleChoicePrompt(initial.finalState, 'base_ice_floe');
        const old = getPromptOption(prompt, option => option.value?.minionUid === 'old', '浮冰置底目标');
        const afterIceFloe = respondToPrompt(initial.finalState, old.id, '0');
        expect(afterIceFloe.success, afterIceFloe.error).toBe(true);

        const babyPrompt = getSimpleChoicePrompt(afterIceFloe.finalState, 'penguins_baby_penguin');
        const handHelper = getPromptOption(babyPrompt, option => option.value?.cardUid === 'hand-helper', '企鹅宝宝手牌伙伴');
        const resolved = respondToPrompt(afterIceFloe.finalState, handHelper.id, '0');

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['top-baby', 'hand-helper']);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['old']);
        expect(resolved.finalState.core.players['0'].hand).toEqual([]);
        expectNoPrompt(resolved.finalState);
    });

    it('企鹅殖民地会在本回合第一次打出伙伴到这里后额外打出牌库顶伙伴', () => {
        const core = penguinCore({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('first', 'penguins_snazzy_penguin', 'minion', '0')],
                    deck: [makeCard('top', 'penguins_baby_penguin', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_the_colony')],
        });

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'first', baseIndex: 0 },
        } as any);
        const colonyResolved = resolveReactionBySourceDefId(result.finalState, 'base_the_colony');

        expect(result.success, result.error).toBe(true);
        expect(colonyResolved.success, colonyResolved.error).toBe(true);
        expect(colonyResolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['first', 'top']);
        expect(colonyResolved.finalState.core.players['0'].deck).toEqual([]);
    });

    it('企鹅殖民地额外打出的企鹅宝宝会继续打开宝宝的手牌额外打出交互', () => {
        const core = penguinCore({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('first', 'penguins_snazzy_penguin', 'minion', '0'),
                        makeCard('hand-helper', 'penguins_baby_penguin', 'minion', '0'),
                    ],
                    deck: [makeCard('top-baby', 'penguins_baby_penguin', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_the_colony')],
        });

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'first', baseIndex: 0 },
        } as any);
        const colonyResolved = resolveReactionBySourceDefId(result.finalState, 'base_the_colony');

        expect(result.success, result.error).toBe(true);
        expect(colonyResolved.success, colonyResolved.error).toBe(true);
        const babyPrompt = getSimpleChoicePrompt(colonyResolved.finalState, 'penguins_baby_penguin');
        const handHelper = getPromptOption(babyPrompt, option => option.value?.cardUid === 'hand-helper', '企鹅宝宝手牌伙伴');
        const resolved = respondToPrompt(colonyResolved.finalState, handHelper.id, '0');

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['first', 'top-baby', 'hand-helper']);
        expect(resolved.finalState.core.players['0'].deck).toEqual([]);
        expect(resolved.finalState.core.players['0'].hand).toEqual([]);
        expectNoPrompt(resolved.finalState);
    });

    it('企鹅殖民地额外打出的时髦企鹅会继续结算从牌库顶打出后的抽两张', () => {
        const core = penguinCore({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('first', 'penguins_snazzy_penguin', 'minion', '0')],
                    deck: [
                        makeCard('top-snazzy', 'penguins_snazzy_penguin', 'minion', '0'),
                        makeCard('draw-1', 'penguins_secret_mission', 'action', '0'),
                        makeCard('draw-2', 'penguins_the_hatching', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_the_colony')],
        });

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'first', baseIndex: 0 },
        } as any);
        const colonyResolved = resolveReactionBySourceDefId(result.finalState, 'base_the_colony');

        expect(result.success, result.error).toBe(true);
        expect(colonyResolved.success, colonyResolved.error).toBe(true);
        expect(colonyResolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['first', 'top-snazzy']);
        expect(colonyResolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-1', 'draw-2']);
        expect(colonyResolved.finalState.core.players['0'].deck).toEqual([]);
    });

    it('冰滑道会在计分后为从这里进入弃牌堆的己方伙伴抽牌', () => {
        const core = penguinCore({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('draw-1', 'penguins_secret_mission', 'action', '0'),
                        makeCard('draw-2', 'penguins_the_hatching', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_ice_floe',
                minions: [
                    makeMinion('own-1', 'penguins_surfing_penguin', '0', 3),
                    makeMinion('own-2', 'penguins_baby_penguin', '0', 2),
                    makeMinion('enemy', 'penguins_baby_penguin', '1', 2),
                ],
                ongoingActions: [ongoing('slide', 'penguins_ice_slide')],
            })],
        });

        const result = fireTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 100,
        });
        const finalCore = applyEvents(core, result.events);

        expect(finalCore.players['0'].hand.map(card => card.uid)).toEqual(['draw-1', 'draw-2']);
    });

    it('跳上船会把牌库顶伙伴预约到计分后的替换基地', () => {
        const core = penguinCore({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('top', 'penguins_baby_penguin', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_ice_floe',
                minions: [],
                ongoingActions: [ongoing('leaping', 'penguins_leaping_aboard')],
            })],
        });
        const scoringBaseRef = createScoringBaseRef(core, 0)!;
        const scoringSession = {
            ...createScoringSession(core, [0]),
            currentBaseRef: scoringBaseRef,
            currentStep: 'awaiting-interactions' as const,
        };
        let scoringState = setScoringSession(makeMatchState(core), scoringSession);
        scoringState = appendScoringFrameDeferredPayload(scoringState, {
            deferredEvents: [{
                type: SU_EVENTS.BASE_REPLACED,
                payload: { baseIndex: 0, oldBaseDefId: 'base_ice_floe', newBaseDefId: 'base_the_colony' },
                timestamp: 110,
            }],
        });

        const result = fireTriggers(core, 'afterScoring', {
            state: core,
            matchState: scoringState,
            playerId: '0',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 111,
        });
        const consumed = consumeScoringFrameDeferredPayload(result.matchState!);

        expect(consumed.deferredActions).toEqual([expect.objectContaining({
            kind: 'playMinionOnReplacementBase',
            cardUid: 'top',
            targetBaseDefId: 'base_the_colony',
            baseIndex: 0,
        })]);
        expect(result.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARD_REMOVED_FROM_DECK,
            payload: expect.objectContaining({
                playerId: '0',
                cardUid: 'top',
                reason: 'penguins_leaping_aboard',
            }),
        }));
    });

    it('跳上船预约的牌库顶伙伴不会被同一计分窗口的冰滑道抽走', () => {
        const core = penguinCore({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('top', 'penguins_baby_penguin', 'minion', '0'),
                        makeCard('draw-1', 'penguins_secret_mission', 'action', '0'),
                        makeCard('draw-2', 'penguins_the_hatching', 'action', '0'),
                        makeCard('rest', 'penguins_command_penguin', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_ice_floe',
                    minions: [
                        makeMinion('own-1', 'penguins_surfing_penguin', '0', 3),
                        makeMinion('own-2', 'penguins_command_penguin', '0', 4),
                    ],
                    ongoingActions: [
                        ongoing('leaping', 'penguins_leaping_aboard'),
                        ongoing('slide', 'penguins_ice_slide'),
                    ],
                }),
            ],
            baseDeck: ['base_the_colony'],
        });
        const scoringBaseRef = createScoringBaseRef(core, 0)!;
        const scoringSession = {
            ...createScoringSession(core, [0]),
            currentBaseRef: scoringBaseRef,
            currentStep: 'awaiting-response-window' as const,
        };
        let scoringState = setScoringSession({
            ...makeMatchState(core),
            sys: { ...makeMatchState(core).sys, phase: 'scoreBases' },
        }, scoringSession);
        scoringState = appendScoringFrameDeferredPayload(scoringState, {
            deferredEvents: [{
                type: SU_EVENTS.BASE_REPLACED,
                payload: { baseIndex: 0, oldBaseDefId: 'base_ice_floe', newBaseDefId: 'base_the_colony' },
                timestamp: 120,
            }],
        });

        const frameId = 'score-after:penguins-combined';
        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: scoringState,
            playerId: '0',
            baseIndex: 0,
            frameId,
            sourceEventId: frameId,
            random: defaultTestRandom,
            now: 121,
        });
        expect(queued).toBeDefined();
        if (!queued) throw new Error('企鹅 afterScoring 触发未入队');

        const queuedState = {
            ...scoringState,
            core: applyEvents(scoringState.core, [queued as unknown as SmashUpEvent]),
        };
        const prompted = maybeResolveReactionQueue(queuedState, defaultTestRandom, 122);
        if (!prompted) throw new Error('企鹅 afterScoring 队列未打开触发选择');
        const leapingPrompt = getSimpleChoicePrompt(prompted.state);
        const leapingOption = getPromptOption(leapingPrompt, option =>
            option.value?.kind === 'trigger'
            && option.value.triggerId.includes('penguins_leaping_aboard'),
            '跳上船 afterScoring 触发选择',
        );

        const chosen = respondToPrompt(prompted.state, leapingOption.id, '0', defaultTestRandom);
        expect(chosen.success).toBe(true);
        const resolved = {
            state: chosen.finalState,
            events: [...prompted.events, ...chosen.events] as SmashUpEvent[],
        };
        expect(resolved.state.sys.interaction?.current).toBeUndefined();

        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARD_REMOVED_FROM_DECK,
            payload: expect.objectContaining({ playerId: '0', cardUid: 'top' }),
        }));
        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: expect.objectContaining({ playerId: '0', cardUids: ['draw-1', 'draw-2'] }),
        }));

        const cardRemovedIndex = resolved.events.findIndex(event =>
            event.type === SU_EVENTS.CARD_REMOVED_FROM_DECK
            && (event as SmashUpEvent).payload.playerId === '0'
            && (event as SmashUpEvent).payload.cardUid === 'top',
        );
        const iceSlideDrawIndex = resolved.events.findIndex(event =>
            event.type === SU_EVENTS.CARDS_DRAWN
            && (event as SmashUpEvent).payload.playerId === '0'
            && JSON.stringify((event as SmashUpEvent).payload.cardUids) === JSON.stringify(['draw-1', 'draw-2']),
        );
        const replacementIndex = resolved.events.findIndex(event => event.type === SU_EVENTS.BASE_REPLACED);
        const normalDrawIndex = resolved.events.findIndex(event =>
            event.type === SU_EVENTS.CARDS_DRAWN
            && (event as SmashUpEvent).payload.playerId === '0'
            && ((event as SmashUpEvent).payload.cardUids as string[]).includes('rest'),
        );
        expect(cardRemovedIndex).toBeGreaterThanOrEqual(0);
        expect(iceSlideDrawIndex).toBeGreaterThan(cardRemovedIndex);
        expect(replacementIndex).toBeGreaterThan(iceSlideDrawIndex);
        expect(normalDrawIndex).toBeGreaterThan(replacementIndex);

        const scoringWindowDraws = resolved.events
            .slice(0, replacementIndex)
            .filter(event => event.type === SU_EVENTS.CARDS_DRAWN)
            .map(event => (event as SmashUpEvent).payload.cardUids);
        expect(scoringWindowDraws).toEqual([['draw-1', 'draw-2']]);

        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_PLAYED,
            payload: expect.objectContaining({
                playerId: '0',
                cardUid: 'top',
                baseDefId: 'base_the_colony',
                allowImplicitSource: true,
            }),
        }));
        expect(resolved.state.core.bases[0].defId).toBe('base_the_colony');
        expect(resolved.state.core.bases[0].minions.map(minion => minion.uid)).toEqual(['top']);
        expect(resolved.state.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-1', 'draw-2', 'rest']);
        expect(resolved.state.core.players['0'].deck.map(card => card.uid)).toEqual([]);
    });
});
