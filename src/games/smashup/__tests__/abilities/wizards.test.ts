import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry, fireTriggers, registerPodOngoingAliases } from '../../domain/ongoingEffects';
import { clearPowerModifierRegistry } from '../../domain/ongoingModifiers';
import type { SmashUpCore, SmashUpEvent } from '../../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import {
    applyEvents,
    expectNoPrompt,
    getPromptMulti,
    getPromptOption,
    getPromptOptions,
    getSimpleChoicePrompt,
    getPromptTargetType,
    getPromptTitle,
    invokeRegisteredAbilityContract,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondCommand,
    respondToPrompt,
    respondToPromptWithMergedValue,
} from '../helpers';
import { defaultTestRandom, runCommand } from '../testRunner';
import { refreshInteractionOptions } from '../../../../engine/systems/InteractionSystem';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearPowerModifierRegistry();
    clearOngoingEffectRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

function execPlayMinion(state: SmashUpCore, playerId: string, cardUid: string, baseIndex: number) {
    const result = runCommand(
        makeMatchState(state),
        {
            type: SU_COMMANDS.PLAY_MINION,
            playerId,
            payload: { cardUid, baseIndex },
        } as any,
        defaultTestRandom,
    );
    return { events: result.events as SmashUpEvent[], matchState: result.finalState };
}

function execPlayAction(state: SmashUpCore, playerId: string, cardUid: string, targetBaseIndex?: number) {
    const result = runCommand(
        makeMatchState(state),
        {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId,
            payload: { cardUid, targetBaseIndex },
        } as any,
        defaultTestRandom,
    );
    return { events: result.events as SmashUpEvent[], matchState: result.finalState };
}

describe('巫师派系能力', () => {
    it('wizard_neophyte: 牌库顶是行动卡时创建 Prompt 选择处理方式', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m1', 'wizard_neophyte', 'minion', '0')],
                    deck: [makeCard('d1', 'test_action', 'action', '0'), makeCard('d2', 'test_minion', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'b1', minions: [], ongoingActions: [] })],
        });

        const { matchState } = execPlayMinion(state, '0', 'm1', 0);
        const prompt = getSimpleChoicePrompt(matchState, 'wizard_neophyte');
        expect(getPromptTargetType(prompt)).toBe('button');
    });

    it('线上反馈 69feac13：POD 学徒在牌库空但弃牌堆有牌时先洗回牌库再揭示顶牌', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m1', 'wizard_neophyte_pod', 'minion', '0')],
                    deck: [],
                    discard: [
                        makeCard('d1', 'wizard_scry_pod', 'action', '0'),
                        makeCard('d2', 'alien_scout_pod', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'b1', minions: [], ongoingActions: [] })],
        });

        const { events, matchState } = execPlayMinion(state, '0', 'm1', 0);
        expect(events.some(e => e.type === SU_EVENTS.DECK_REORDERED)).toBe(true);
        expect(events.some(e => e.type === SU_EVENTS.REVEAL_DECK_TOP)).toBe(true);
        expect(matchState.core.players['0'].deck.map(card => card.uid)).toEqual(['d1', 'd2']);
        expect(matchState.core.players['0'].discard).toEqual([]);
        getSimpleChoicePrompt(matchState, 'wizard_neophyte');
    });

    it('线上反馈 69feac13：女巫在牌库空但弃牌堆有牌时应洗牌并实际抽到手牌', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m1', 'wizard_enchantress', 'minion', '0')],
                    deck: [],
                    discard: [
                        makeCard('d1', 'alien_invasion_pod', 'action', '0'),
                        makeCard('d2', 'alien_scout_pod', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'b1', minions: [], ongoingActions: [] })],
        });

        const { events, matchState } = execPlayMinion(state, '0', 'm1', 0);
        expect(events.map(e => e.type)).toEqual(expect.arrayContaining([
            SU_EVENTS.DECK_RESHUFFLED,
            SU_EVENTS.CARDS_DRAWN,
        ]));
        expect(matchState.core.players['0'].hand.map(card => card.uid)).toContain('d1');
        expect(matchState.core.players['0'].deck.map(card => card.uid)).toEqual(['d2']);
        expect(matchState.core.players['0'].discard).toEqual([]);
    });

    it('线上反馈 69feac13：秘术学习在牌库空但弃牌堆有牌时应洗牌并实际抽牌', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_mystic_studies', 'action', '0')],
                    deck: [],
                    discard: [
                        makeCard('d1', 'alien_invasion_pod', 'action', '0'),
                        makeCard('d2', 'alien_scout_pod', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'b1', minions: [], ongoingActions: [] })],
        });

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        expect(events.map(e => e.type)).toEqual(expect.arrayContaining([
            SU_EVENTS.DECK_RESHUFFLED,
            SU_EVENTS.CARDS_DRAWN,
        ]));
        expect(matchState.core.players['0'].hand.map(card => card.uid)).toEqual(expect.arrayContaining(['d1', 'd2']));
        expect(matchState.core.players['0'].deck).toEqual([]);
    });

    it('wizard_neophyte: 牌库顶不是行动卡时不产生事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m1', 'wizard_neophyte', 'minion', '0')],
                    deck: [makeCard('d1', 'test_minion', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'b1', minions: [], ongoingActions: [] })],
        });

        const { events } = execPlayMinion(state, '0', 'm1', 0);
        const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvents).toHaveLength(0);
    });

    it('wizard_neophyte: 打出 zombie_overrun 时应该先选择目标基地', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m1', 'wizard_neophyte', 'minion', '0')],
                    deck: [
                        makeCard('overrun', 'zombie_overrun', 'action', '0'),
                        makeCard('d2', 'test_minion', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase(), makeBase()],
        });

        const { matchState } = execPlayMinion(state, '0', 'm1', 0);
        expect(getSimpleChoicePrompt(matchState, 'wizard_neophyte')).toBeDefined();

        const playExtraResult = respondToPrompt(matchState, 'play_extra', '0', defaultTestRandom);
        expect(playExtraResult.success).toBe(true);

        const chooseBasePrompt = getSimpleChoicePrompt(playExtraResult.finalState, 'wizard_neophyte_choose_base');
        expect(getPromptTitle(chooseBasePrompt)).toContain('泛滥横行');

        const options = getPromptOptions(chooseBasePrompt);
        expect(options).toHaveLength(2);

        const attachResult = respondToPrompt(playExtraResult.finalState, options[0].id, '0', defaultTestRandom);
        expect(attachResult.success).toBe(true);

        const finalState = attachResult.finalState.core;
        expect(finalState.bases[0].ongoingActions).toHaveLength(1);
        expect(finalState.bases[0].ongoingActions[0].defId).toBe('zombie_overrun');
        expect(finalState.bases[0].ongoingActions[0].ownerId).toBe('0');
        expect(finalState.players['0'].hand.find(card => card.uid === 'overrun')).toBeUndefined();
        expect(finalState.players['0'].actionsPlayed).toBe(0);
    });

    it('wizard_neophyte: 打出 standard 行动卡时不需要选择基地', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m1', 'wizard_neophyte', 'minion', '0')],
                    deck: [
                        makeCard('summon', 'wizard_summon', 'action', '0'),
                        makeCard('d2', 'test_minion', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase()],
        });

        const { matchState } = execPlayMinion(state, '0', 'm1', 0);
        expect(getSimpleChoicePrompt(matchState, 'wizard_neophyte')).toBeDefined();

        const playExtraResult = respondToPrompt(matchState, 'play_extra', '0', defaultTestRandom);
        expect(playExtraResult.success).toBe(true);

        const finalState = playExtraResult.finalState.core;
        expect(finalState.players['0'].discard.find(card => card.uid === 'summon')).toBeDefined();
        expect(finalState.players['0'].minionLimit).toBe(2);
        expect(finalState.players['0'].actionsPlayed).toBe(0);
    });

    it('wizard_mass_enchantment: 单个对手时创建 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_mass_enchantment', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('d1', 'test_action', 'action', '1'), makeCard('d2', 'test_minion', 'minion', '1')],
                }),
            },
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        getSimpleChoicePrompt(matchState, 'wizard_mass_enchantment');
    });

    it('wizard_mass_enchantment: 对手牌库顶变化后不应继续保留过期行动卡候选', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_mass_enchantment', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [
                        makeCard('d1', 'test_action', 'action', '1'),
                        makeCard('d2', 'test_minion', 'minion', '1'),
                    ],
                }),
            },
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        const refreshedState = refreshInteractionOptions({
            ...matchState,
            core: {
                ...matchState.core,
                players: {
                    ...matchState.core.players,
                    '1': {
                        ...matchState.core.players['1'],
                        deck: [
                            makeCard('intrude', 'test_minion', 'minion', '1'),
                            makeCard('d1', 'test_action', 'action', '1'),
                            makeCard('d2', 'test_minion', 'minion', '1'),
                        ],
                    },
                },
            },
        });

        const prompt = getSimpleChoicePrompt(refreshedState, 'wizard_mass_enchantment');
        const optionUids = getPromptOptions(prompt).map(option => option.value?.cardUid).filter(Boolean);
        expect(optionUids).not.toContain('d1');
    });

    it('wizard_mass_enchantment: 对手牌库为空时无事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_mass_enchantment', 'action', '0')],
                }),
                '1': makePlayer('1', { deck: [] }),
            },
        });

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        expect(events.filter(event => event.type === SU_EVENTS.CARDS_DRAWN)).toHaveLength(0);
        expectNoPrompt(matchState);
    });

    it('wizard_portal: 有随从时创建选择 Prompt 让玩家选随从', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_portal', 'action', '0')],
                    deck: [
                        makeCard('d1', 'test_a', 'action', '0'),
                        makeCard('d2', 'test_m', 'minion', '0'),
                        makeCard('d3', 'test_a2', 'action', '0'),
                        makeCard('d4', 'test_m2', 'minion', '0'),
                        makeCard('d5', 'test_a3', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        expect(events.filter(event => event.type === SU_EVENTS.CARDS_DRAWN)).toHaveLength(0);
        const prompt = getSimpleChoicePrompt(matchState, 'wizard_portal_pick');
        expect(getPromptOptions(prompt)).toHaveLength(2);
        expect(getPromptMulti(prompt)).toEqual({ min: 0, max: 2 });
    });

    it('wizard_portal: 牌库为空时无事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_portal', 'action', '0')],
                    deck: [],
                }),
                '1': makePlayer('1'),
            },
        });

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        expect(events.filter(event => event.type === SU_EVENTS.CARDS_DRAWN)).toHaveLength(0);
        expectNoPrompt(matchState);
    });

    it('wizard_portal: 顶部5张全是行动卡时不抽牌但创建排序 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_portal', 'action', '0')],
                    deck: [
                        makeCard('d1', 'test_a', 'action', '0'),
                        makeCard('d2', 'test_a2', 'action', '0'),
                        makeCard('d3', 'test_a3', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        expect(events.filter(event => event.type === SU_EVENTS.CARDS_DRAWN)).toHaveLength(0);
        getSimpleChoicePrompt(matchState, 'wizard_portal_order');
    });

    it('wizard_portal_order: 牌库顶被插入新牌后不应继续保留旧揭示排序候选', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_portal', 'action', '0')],
                    deck: [
                        makeCard('d1', 'test_a', 'action', '0'),
                        makeCard('d2', 'test_a2', 'action', '0'),
                        makeCard('d3', 'test_a3', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        const refreshedState = refreshInteractionOptions({
            ...matchState,
            core: {
                ...matchState.core,
                players: {
                    ...matchState.core.players,
                    '0': {
                        ...matchState.core.players['0'],
                        deck: [
                            makeCard('intrude', 'test_a4', 'action', '0'),
                            ...matchState.core.players['0'].deck,
                        ],
                    },
                },
            },
        });

        const prompt = getSimpleChoicePrompt(refreshedState, 'wizard_portal_order');
        const optionUids = getPromptOptions(prompt).map(option => option.value?.cardUid).filter(Boolean);
        expect(optionUids).not.toContain('d1');
        expect(optionUids).not.toContain('d2');
        expect(optionUids).not.toContain('d3');
    });

    it('wizard_scry: 单张行动卡时创建 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_scry', 'action', '0')],
                    deck: [
                        makeCard('d1', 'test_m', 'minion', '0'),
                        makeCard('d2', 'test_a', 'action', '0'),
                        makeCard('d3', 'test_m2', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        getSimpleChoicePrompt(matchState, 'wizard_scry');
    });

    it('wizard_scry: refresh 后仍应从当前牌库重新生成行动卡候选', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_scry', 'action', '0')],
                    deck: [
                        makeCard('old-action', 'test_a', 'action', '0'),
                        makeCard('old-minion', 'test_m', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        const refreshedState = refreshInteractionOptions({
            ...matchState,
            core: {
                ...matchState.core,
                players: {
                    ...matchState.core.players,
                    '0': {
                        ...matchState.core.players['0'],
                        deck: [
                            makeCard('fresh-action', 'test_a2', 'action', '0'),
                            makeCard('fresh-action-2', 'test_a3', 'action', '0'),
                            makeCard('fresh-minion', 'test_m2', 'minion', '0'),
                        ],
                    },
                },
            },
        });

        const prompt = getSimpleChoicePrompt(refreshedState, 'wizard_scry');
        const optionUids = getPromptOptions(prompt).map(option => option.value?.cardUid).filter(Boolean);
        expect(optionUids).toEqual(['fresh-action', 'fresh-action-2']);
        expect(optionUids).not.toContain('old-action');
    });

    it('wizard_scry: 牌库无行动卡时无事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_scry', 'action', '0')],
                    deck: [makeCard('d1', 'test_m', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        expect(events.filter(event => event.type === SU_EVENTS.CARDS_DRAWN)).toHaveLength(0);
        expectNoPrompt(matchState);
    });

    it('wizard_scry: 召唤→时间法师→占卜→女巫链中，废物利用不应回退成占卜', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a-summon', 'wizard_summon', 'action', '0'),
                        makeCard('m-chrono', 'wizard_chronomage', 'minion', '0'),
                        makeCard('a-scry', 'wizard_scry', 'action', '0'),
                        makeCard('m-enchant', 'wizard_enchantress', 'minion', '0'),
                    ],
                    deck: [
                        makeCard('d-scrap-1', 'steampunk_scrap_diving', 'action', '0'),
                        makeCard('d-change', 'steampunk_change_of_venue', 'action', '0'),
                        makeCard('d-scrap-2', 'steampunk_scrap_diving', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'base_the_homeworld', minions: [], ongoingActions: [] })],
        }));

        const playSummon = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-summon' },
            timestamp: 500,
        } as any, defaultTestRandom);
        expect(playSummon.success).toBe(true);
        expect(playSummon.finalState.core.players['0'].minionLimit).toBe(2);

        const playChronomage = runCommand(playSummon.finalState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'm-chrono', baseIndex: 0 },
            timestamp: 1000,
        } as any, defaultTestRandom);
        expect(playChronomage.success).toBe(true);
        expect(playChronomage.finalState.core.players['0'].actionLimit).toBe(2);

        const playScry = runCommand(playChronomage.finalState, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-scry' },
            timestamp: 2000,
        } as any, defaultTestRandom);
        expect(playScry.success).toBe(true);
        getSimpleChoicePrompt(playScry.finalState, 'wizard_scry');

        const resolveScry = runCommand(playScry.finalState, {
            ...respondCommand('card-0', '0'),
            timestamp: 3000,
        }, defaultTestRandom);
        expect(resolveScry.success).toBe(true);
        expect(resolveScry.finalState.core.players['0'].hand.map(card => card.uid)).toContain('d-scrap-1');
        expect(resolveScry.finalState.core.players['0'].hand.map(card => card.uid)).not.toContain('a-scry');
        expect(resolveScry.finalState.core.players['0'].deck.map(card => card.uid)).not.toContain('d-scrap-1');

        const playEnchantress = runCommand(resolveScry.finalState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'm-enchant', baseIndex: 0 },
            timestamp: 4000,
        } as any, defaultTestRandom);
        expect(playEnchantress.success).toBe(true);

        const finalPlayer = playEnchantress.finalState.core.players['0'];
        const finalHandUids = finalPlayer.hand.map(card => card.uid);
        expect(finalHandUids).toContain('d-scrap-1');
        expect(finalHandUids).toContain('d-change');
        expect(finalHandUids).not.toContain('a-scry');
        expect(finalPlayer.deck.map(card => card.uid)).toEqual(['d-scrap-2']);
    });

    it('wizard_sacrifice: 多个己方随从时创建 Prompt 选择', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_sacrifice', 'action', '0')],
                    deck: [
                        makeCard('d1', 'test1', 'minion', '0'),
                        makeCard('d2', 'test2', 'action', '0'),
                        makeCard('d3', 'test3', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'b1',
                minions: [
                    makeMinion('m0', 'test', '0', 3),
                    makeMinion('m1', 'test', '0', 5, { powerModifier: 0 }),
                ],
            })],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        getSimpleChoicePrompt(matchState, 'wizard_sacrifice');
    });

    it('wizard_sacrifice: 没有己方随从时无事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_sacrifice', 'action', '0')],
                    deck: [makeCard('d1', 'test1', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'b1',
                minions: [makeMinion('m1', 'test', '1', 3)],
            })],
        });

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        expect(events.filter(event => event.type === SU_EVENTS.MINION_DESTROYED)).toHaveLength(0);
        expectNoPrompt(matchState);
    });

    it('wizard_sacrifice: 单个己方随从时创建 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_sacrifice', 'action', '0')],
                    deck: Array.from({ length: 10 }, (_, index) => makeCard(`d${index}`, 'test_card', 'minion', '0')),
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'b1',
                minions: [{ ...makeMinion('m0', 'test', '0', 3), powerModifier: 2 }],
            })],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        getSimpleChoicePrompt(matchState, 'wizard_sacrifice');
    });

    it('wizard_time_loop: off-phase 额外行动必须标记为 immediate', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
        });

        const matchState = makeMatchState(state);
        matchState.sys.phase = 'startTurn';

        const result = invokeRegisteredAbilityContract('wizard_time_loop', 'onPlay', {
            state,
            matchState,
            playerId: '0',
            cardUid: 'a1',
            defId: 'wizard_time_loop',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 0,
        });

        const limitEvents = result.events.filter(event => event.type === SU_EVENTS.LIMIT_MODIFIED);
        expect(limitEvents).toHaveLength(2);
        expect(limitEvents.every(event => (event as any).payload.playTiming === 'immediate')).toBe(true);
    });

    it('wizard_winds_of_change: 洗手牌回牌库抽5张并额外打出一个行动', () => {
        const handCards = [
            makeCard('a1', 'wizard_winds_of_change', 'action', '0'),
            makeCard('h1', 'test1', 'minion', '0'),
            makeCard('h2', 'test2', 'action', '0'),
        ];
        const deckCards = [
            makeCard('d1', 'test3', 'minion', '0'),
            makeCard('d2', 'test4', 'action', '0'),
            makeCard('d3', 'test5', 'minion', '0'),
            makeCard('d4', 'test6', 'action', '0'),
            makeCard('d5', 'test7', 'minion', '0'),
            makeCard('d6', 'test8', 'action', '0'),
        ];
        const state = makeState({
            players: {
                '0': makePlayer('0', { hand: handCards, deck: deckCards }),
                '1': makePlayer('1'),
            },
        });

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        const shuffleEvents = events.filter(event => event.type === SU_EVENTS.HAND_SHUFFLED_INTO_DECK);
        const drawEvents = events.filter(event => event.type === SU_EVENTS.CARDS_DRAWN);
        const limitEvents = events.filter(event => event.type === SU_EVENTS.LIMIT_MODIFIED);

        expect(shuffleEvents).toHaveLength(1);
        expect(drawEvents).toHaveLength(1);
        expect((drawEvents[0] as any).payload.count).toBe(5);
        expect(limitEvents).toHaveLength(1);
        expect((limitEvents[0] as any).payload.limitType).toBe('action');
        expectNoPrompt(matchState);
    });

    it('wizard_winds_of_change: 牌库+手牌不足5张时抽全部', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'wizard_winds_of_change', 'action', '0'),
                        makeCard('h1', 'test', 'minion', '0'),
                    ],
                    deck: [makeCard('d1', 'test', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const { events } = execPlayAction(state, '0', 'a1');
        const drawEvents = events.filter(event => event.type === SU_EVENTS.CARDS_DRAWN);
        expect((drawEvents[0] as any).payload.count).toBe(2);

        const newState = applyEvents(state, events);
        expect(newState.players['0'].hand).toHaveLength(2);
        expect(newState.players['0'].deck).toHaveLength(0);
    });
});

describe('wizard_archmage ongoing 时机', () => {
    beforeEach(() => {
        clearRegistry();
        clearBaseAbilityRegistry();
        clearPowerModifierRegistry();
        clearOngoingEffectRegistry();
        clearInteractionHandlers();
        resetAbilityInit();
        initAllAbilities();
        registerPodOngoingAliases();
    });

    it('onTurnStart 不再直接发额外行动事件', () => {
        const archmage = makeMinion('am-1', 'wizard_archmage', '0', 4);
        const base = makeBase({ minions: [archmage] });
        const state = makeState({ bases: [base] });

        const { events } = fireTriggers(state, 'onTurnStart', {
            state,
            playerId: '0',
            random: defaultTestRandom,
            now: 1000,
        });

        expect(events).toHaveLength(0);
    });

    it('POD 版不在 onTurnStart 触发（POD 为 talent）', () => {
        const archmage = makeMinion('am-pod-1', 'wizard_archmage_pod', '0', 4);
        const base = makeBase({ minions: [archmage] });
        const state = makeState({ bases: [base] });

        const { events } = fireTriggers(state, 'onTurnStart', {
            state,
            playerId: '0',
            random: defaultTestRandom,
            now: 1000,
        });

        expect(events).toHaveLength(0);
    });

    it('非控制者回合同样不触发 onTurnStart 事件', () => {
        const archmage = makeMinion('am-1', 'wizard_archmage', '0', 4);
        const base = makeBase({ minions: [archmage] });
        const state = makeState({ bases: [base] });

        const { events } = fireTriggers(state, 'onTurnStart', {
            state,
            playerId: '1',
            random: defaultTestRandom,
            now: 1000,
        });

        expect(events).toHaveLength(0);
    });

    it('POD 版不在 onMinionPlayed 触发（POD 为 talent）', () => {
        const archmage = makeMinion('am-pod-1', 'wizard_archmage_pod', '0', 4);
        const base = makeBase({ minions: [archmage] });
        const state = makeState({ bases: [base] });

        const { events } = fireTriggers(state, 'onMinionPlayed', {
            state,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'am-pod-1',
            triggerMinionDefId: 'wizard_archmage_pod',
            random: defaultTestRandom,
            now: 1000,
        });

        expect(events).toHaveLength(0);
    });

    it('通过 zombie_they_keep_coming 从弃牌堆打出时，仍应按 onMinionPlayed 授予额外行动', () => {
        const core = makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    factions: ['zombies', 'wizards'] as [string, string],
                    hand: [makeCard('tkc-1', 'zombie_they_keep_coming', 'action', '0')],
                    discard: [makeCard('archmage-1', 'wizard_archmage', 'minion', '0')],
                    actionsPlayed: 0,
                    actionLimit: 1,
                    minionsPlayed: 1,
                    minionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_tar_pits', [])],
        });
        const state = makeMatchState(core);

        const playedAction = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'tkc-1' },
        } as any);

        expect(playedAction.success).toBe(true);

        const prompt = getSimpleChoicePrompt(playedAction.finalState, 'zombie_they_keep_coming');
        const archmageOption = getPromptOption(
            prompt,
            option => option.value?.cardUid === 'archmage-1',
            'archmage discard option',
        );

        const resolved = respondToPromptWithMergedValue(
            playedAction.finalState,
            archmageOption.id,
            { baseIndex: 0 },
            '0',
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.defId === 'wizard_archmage')).toBe(true);
        expect(resolved.finalState.core.players['0'].discard.some(card => card.uid === 'archmage-1')).toBe(false);
        expect(resolved.finalState.core.players['0'].actionLimit).toBe(2);
    });
});
