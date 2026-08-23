import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { getDiscardActionPlayOptions } from '../../domain/discardActionPlayability';
import { maybeResolveReactionQueue } from '../../domain/reactionQueue';
import { SU_COMMANDS, SU_EVENTS, type TriggerQueuedEvent } from '../../domain/types';
import {
    getPromptSourceId,
    getSimpleChoicePrompt,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPromptOption,
} from '../helpers';
import { defaultTestRandom, runCommand } from '../testRunner';

describe('DIY 小丑 abilities', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('滑稽小丑允许从弃牌堆打出无目标标准行动并消耗通常行动', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('scarf1', 'diy_clowns_colorful_scarf', 'action', '0')],
                    deck: [
                        makeCard('draw1', 'diy_clowns_clown_girl', 'minion', '0'),
                        makeCard('draw2', 'diy_clowns_silent_clown', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [makeMinion('slapstick1', 'diy_clowns_slapstick_clown', '0', 5)])],
        }));

        const option = getDiscardActionPlayOptions(state.core, '0').find(entry => entry.card.uid === 'scarf1');
        expect(option?.targetMode).toBe('none');
        expect(option?.consumesNormalLimit).not.toBe(false);

        const result = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'scarf1', fromDiscard: true },
        });
        expect(result.success, result.error).toBe(true);
        expect(result.finalState.core.players['0'].actionsPlayed).toBe(1);
        expect(result.finalState.core.players['0'].discard.some(card => card.uid === 'scarf1')).toBe(false);
        expect(result.finalState.core.players['0'].deck.at(-1)?.uid).toBe('scarf1');
    });

    it('沉默小丑在尚未打出行动时提供额外弃牌堆标准行动', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    actionLimit: 0,
                    discard: [makeCard('scarf1', 'diy_clowns_colorful_scarf', 'action', '0')],
                    deck: [
                        makeCard('draw1', 'diy_clowns_clown_girl', 'minion', '0'),
                        makeCard('draw2', 'diy_clowns_silent_clown', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [makeMinion('silent1', 'diy_clowns_silent_clown', '0', 3)])],
        }));

        const option = getDiscardActionPlayOptions(state.core, '0').find(entry => entry.card.uid === 'scarf1');
        expect(option?.targetMode).toBe('none');
        expect(option?.consumesNormalLimit).toBe(false);

        const result = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'scarf1', fromDiscard: true },
        });
        expect(result.success, result.error).toBe(true);
        expect(result.finalState.core.players['0'].actionsPlayed).toBe(0);
        expect(result.finalState.core.players['0'].deck.at(-1)?.uid).toBe('scarf1');
        expect(result.finalState.core.players['0'].usedDiscardPlayAbilities?.some(id => id.startsWith('diy_clowns_silent_clown:'))).toBe(true);
    });

    it('跳舞小丑天赋随机从弃牌堆打出一张标准行动并放到牌库底', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [
                        makeCard('scarf1', 'diy_clowns_colorful_scarf', 'action', '0'),
                        makeCard('bucket1', 'diy_clowns_confetti_bucket', 'action', '0'),
                    ],
                    deck: [
                        makeCard('draw1', 'diy_clowns_clown_girl', 'minion', '0'),
                        makeCard('draw2', 'diy_clowns_silent_clown', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [makeMinion('dancing1', 'diy_clowns_dancing_clown', '0', 4)])],
        }));

        const result = runCommand(state, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'dancing1', baseIndex: 0 },
        });
        expect(result.success, result.error).toBe(true);
        expect(result.finalState.core.bases[0].minions.find(minion => minion.uid === 'dancing1')?.talentUsed).toBe(true);
        expect(result.finalState.core.players['0'].actionsPlayed).toBe(0);
        expect(result.finalState.core.players['0'].deck.at(-1)?.uid).toBe('scarf1');
        expect(result.events.some(event => event.type === SU_EVENTS.CARD_TO_DECK_BOTTOM)).toBe(true);
    });

    it('杂耍让每名玩家检查牌库顶三张并弃掉其中最靠上的行动', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('juggling1', 'diy_clowns_juggling', 'action', '0')],
                    deck: [
                        makeCard('p0-minion-a', 'diy_clowns_silent_clown', 'minion', '0'),
                        makeCard('p0-minion-b', 'diy_clowns_clown_girl', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [
                        makeCard('p1-minion-a', 'diy_clowns_silent_clown', 'minion', '1'),
                        makeCard('p1-action', 'diy_clowns_colorful_scarf', 'action', '1'),
                        makeCard('p1-minion-b', 'diy_clowns_clown_girl', 'minion', '1'),
                    ],
                }),
            },
        }));

        const result = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'juggling1' },
        });
        expect(result.success, result.error).toBe(true);
        expect(result.finalState.core.players['1'].discard.some(card => card.uid === 'p1-action')).toBe(true);
        expect(result.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['p1-minion-a', 'p1-minion-b']);
        expect(result.events.filter(event => event.type === SU_EVENTS.DECK_INSPECTED)).toHaveLength(2);
    });

    it('麦当劳小丑只有一张行动牌可抽时也必须先让玩家确认', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mcdonald1', 'diy_clowns_mcdonald_clown', 'minion', '0')],
                    deck: [
                        makeCard('top-minion', 'diy_clowns_silent_clown', 'minion', '0'),
                        makeCard('only-action', 'diy_clowns_colorful_scarf', 'action', '0'),
                        makeCard('bottom-minion', 'diy_clowns_clown_girl', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a')],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'mcdonald1', baseIndex: 0 },
        });
        expect(played.success, played.error).toBe(true);
        expect(played.finalState.core.players['0'].hand.some(card => card.uid === 'only-action')).toBe(false);

        const prompt = getSimpleChoicePrompt(played.finalState, 'diy_clowns_mcdonald_clown');
        expect(prompt.autoResolveIfSingle).toBe(false);

        const resolved = respondToPromptOption(
            played.finalState,
            option => option.value?.cardUid === 'only-action',
            '麦当劳小丑唯一行动牌',
            '0',
            defaultTestRandom,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'only-action')).toBe(true);
        expect(resolved.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
    });

    it('小丑金字塔、馅饼砸脸和小丑女的单候选目标都不会自动选择', () => {
        const pyramidState = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('pyramid1', 'diy_clowns_clown_pyramid', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [makeMinion('only-minion', 'diy_clowns_silent_clown', '0', 3)])],
        }));
        const pyramid = runCommand(pyramidState, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'pyramid1', targetBaseIndex: 0 },
        });
        expect(pyramid.success, pyramid.error).toBe(true);
        const pyramidPrompt = getSimpleChoicePrompt(pyramid.finalState, 'diy_clowns_clown_pyramid');
        expect(pyramidPrompt.options.map(option => option.value?.minionUid)).toEqual(['only-minion']);
        expect(pyramidPrompt.autoResolveIfSingle).toBe(false);
        expect(pyramid.finalState.core.bases[0].minions[0].tempPowerModifier ?? 0).toBe(0);

        const pieState = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('pie1', 'diy_clowns_pie_in_the_face', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [makeMinion('pie-target', 'diy_clowns_silent_clown', '0', 3)])],
        }));
        const pie = runCommand(pieState, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'pie1' },
        });
        expect(pie.success, pie.error).toBe(true);
        const piePrompt = getSimpleChoicePrompt(pie.finalState, 'diy_clowns_pie_in_the_face');
        expect(piePrompt.options.map(option => option.value?.minionUid)).toEqual(['pie-target']);
        expect(piePrompt.autoResolveIfSingle).toBe(false);
        expect(pie.finalState.core.bases[0].minions[0].tempPowerModifier ?? 0).toBe(0);

        const girlState = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('girl1', 'diy_clowns_clown_girl', 'minion', '0')],
                    deck: [makeCard('only-deck-action', 'diy_clowns_colorful_scarf', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a')],
        }));
        const girl = runCommand(girlState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'girl1', baseIndex: 0 },
        });
        expect(girl.success, girl.error).toBe(true);
        const girlPrompt = getSimpleChoicePrompt(girl.finalState, 'diy_clowns_clown_girl');
        expect(girlPrompt.options.map(option => option.value?.cardUid)).toEqual(['only-deck-action']);
        expect(girlPrompt.autoResolveIfSingle).toBe(false);
        expect(girl.finalState.core.players['0'].discard.some(card => card.uid === 'only-deck-action')).toBe(false);
    });

    it('小丑夫人在你打出行动后排队每回合一次的抽牌触发', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('scarf1', 'diy_clowns_colorful_scarf', 'action', '0')],
                    deck: [
                        makeCard('draw1', 'diy_clowns_clown_girl', 'minion', '0'),
                        makeCard('draw2', 'diy_clowns_silent_clown', 'minion', '0'),
                        makeCard('mrs-draw', 'diy_clowns_mcdonald_clown', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [makeMinion('mrs1', 'diy_clowns_mrs_clown', '0', 4)])],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'scarf1' },
        });
        expect(played.success, played.error).toBe(true);
        const queued = played.events.find((event): event is TriggerQueuedEvent =>
            event.type === SU_EVENTS.TRIGGER_QUEUED
            && event.payload.triggers.some(trigger => trigger.sourceDefId === 'diy_clowns_mrs_clown'),
        );
        expect(queued).toBeDefined();

        const prompted = maybeResolveReactionQueue(
            makeMatchState({ ...played.finalState.core, triggerQueue: queued!.payload.triggers }),
            defaultTestRandom,
            1,
        );
        const reactionPrompt = getSimpleChoicePrompt(prompted!.state, 'smashup_reaction_choose');
        expect(getPromptSourceId(reactionPrompt)).toBe('smashup_reaction_choose');
        const accepted = respondToPromptOption(prompted!.state, option => option.value?.triggerId?.includes('diy_clowns_mrs_clown'), '小丑夫人触发');
        expect(accepted.success, accepted.error).toBe(true);
        expect(accepted.finalState.core.players['0'].hand.some(card => card.uid === 'mrs-draw')).toBe(true);
        expect(accepted.finalState.core.bases[0].minions.find(minion => minion.uid === 'mrs1')?.metadata?.diyClownsMrsClownUsedTurn).toBe(1);
    });
});
