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
    respondToPromptOptions,
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

    it('彩色围巾从手牌打出时抽两张且不生成额外弃牌选择', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('scarf-hand', 'diy_clowns_colorful_scarf', 'action', '0'),
                        makeCard('scarf-keep', 'diy_clowns_confetti_bucket', 'action', '0'),
                    ],
                    deck: [
                        makeCard('scarf-draw-1', 'diy_clowns_clown_girl', 'minion', '0'),
                        makeCard('scarf-draw-2', 'diy_clowns_silent_clown', 'minion', '0'),
                        makeCard('scarf-draw-3', 'diy_clowns_mrs_clown', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        }));

        const result = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'scarf-hand' },
        });

        expect(result.success, result.error).toBe(true);
        expect(result.finalState.core.players['0'].hand.map(card => card.uid)).toEqual([
            'scarf-keep',
            'scarf-draw-1',
            'scarf-draw-2',
        ]);
        expect(result.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['scarf-hand']);
        expect(result.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['scarf-draw-3']);
        expect(result.finalState.sys?.interaction?.current).toBeUndefined();
    });

    it('彩色围巾从弃牌堆打出并弃一张手牌时额外抽一张', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('scarf-fodder', 'diy_clowns_confetti_bucket', 'action', '0')],
                    deck: [
                        makeCard('scarf-extra-1', 'diy_clowns_clown_girl', 'minion', '0'),
                        makeCard('scarf-extra-2', 'diy_clowns_silent_clown', 'minion', '0'),
                        makeCard('scarf-extra-3', 'diy_clowns_mrs_clown', 'minion', '0'),
                    ],
                    discard: [makeCard('scarf-discard', 'diy_clowns_colorful_scarf', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [makeMinion('scarf-silent', 'diy_clowns_silent_clown', '0', 3)])],
        }));

        const result = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'scarf-discard', fromDiscard: true },
        });

        expect(result.success, result.error).toBe(true);
        const prompt = getSimpleChoicePrompt(result.finalState, 'diy_clowns_colorful_scarf');
        expect(prompt.options.some(option => option.value?.cardUid === 'scarf-fodder')).toBe(true);
        expect(prompt.options.some(option => option.value?.skip === true)).toBe(true);

        const resolved = respondToPromptOption(
            result.finalState,
            option => option.value?.cardUid === 'scarf-fodder',
            '彩色围巾弃一张手牌并额外抽牌',
            '0',
            defaultTestRandom,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual([
            'scarf-extra-1',
            'scarf-extra-2',
            'scarf-extra-3',
        ]);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['scarf-fodder']);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['scarf-discard']);
        expect(resolved.finalState.core.players['0'].actionsPlayed).toBe(0);
    });

    it('彩色围巾从弃牌堆打出时可以跳过额外弃牌', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('scarf-skip-1', 'diy_clowns_clown_girl', 'minion', '0'),
                        makeCard('scarf-skip-2', 'diy_clowns_silent_clown', 'minion', '0'),
                        makeCard('scarf-skip-3', 'diy_clowns_mrs_clown', 'minion', '0'),
                    ],
                    discard: [makeCard('scarf-skip', 'diy_clowns_colorful_scarf', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [makeMinion('scarf-silent-skip', 'diy_clowns_silent_clown', '0', 3)])],
        }));

        const result = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'scarf-skip', fromDiscard: true },
        });
        expect(result.success, result.error).toBe(true);

        const skipped = respondToPromptOption(
            result.finalState,
            option => option.value?.skip === true,
            '彩色围巾跳过额外弃牌',
            '0',
            defaultTestRandom,
        );

        expect(skipped.success, skipped.error).toBe(true);
        expect(skipped.finalState.core.players['0'].hand.map(card => card.uid)).toEqual([
            'scarf-skip-1',
            'scarf-skip-2',
        ]);
        expect(skipped.finalState.core.players['0'].discard).toEqual([]);
        expect(skipped.finalState.core.players['0'].deck.map(card => card.uid)).toEqual([
            'scarf-skip-3',
            'scarf-skip',
        ]);
    });

    it('五彩纸屑桶最多弃四张手牌并等量抽牌', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('bucket', 'diy_clowns_confetti_bucket', 'action', '0'),
                        makeCard('bucket-card-1', 'diy_clowns_colorful_scarf', 'action', '0'),
                        makeCard('bucket-card-2', 'diy_clowns_juggling', 'action', '0'),
                        makeCard('bucket-card-3', 'diy_clowns_pie_in_the_face', 'action', '0'),
                        makeCard('bucket-card-4', 'diy_clowns_banana_peel', 'action', '0'),
                        makeCard('bucket-card-5', 'diy_clowns_clown_car', 'action', '0'),
                    ],
                    deck: [
                        makeCard('bucket-draw-1', 'diy_clowns_clown_girl', 'minion', '0'),
                        makeCard('bucket-draw-2', 'diy_clowns_silent_clown', 'minion', '0'),
                        makeCard('bucket-draw-3', 'diy_clowns_mrs_clown', 'minion', '0'),
                        makeCard('bucket-draw-4', 'diy_clowns_slapstick_clown', 'minion', '0'),
                        makeCard('bucket-draw-5', 'diy_clowns_dancing_clown', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'bucket' },
        });
        expect(played.success, played.error).toBe(true);

        const prompt = getSimpleChoicePrompt(played.finalState, 'diy_clowns_confetti_bucket');
        expect(prompt.multi).toEqual({ min: 0, max: 4 });
        expect(prompt.options.map(option => option.value?.cardUid)).toEqual([
            'bucket-card-1',
            'bucket-card-2',
            'bucket-card-3',
            'bucket-card-4',
            'bucket-card-5',
        ]);

        const selectedIds = prompt.options
            .filter(option => ['bucket-card-1', 'bucket-card-2', 'bucket-card-3', 'bucket-card-4'].includes(option.value?.cardUid ?? ''))
            .map(option => option.id);
        const resolved = respondToPromptOptions(played.finalState, selectedIds, '0', defaultTestRandom);

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual([
            'bucket-card-5',
            'bucket-draw-1',
            'bucket-draw-2',
            'bucket-draw-3',
            'bucket-draw-4',
        ]);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toEqual([
            'bucket',
            'bucket-card-1',
            'bucket-card-2',
            'bucket-card-3',
            'bucket-card-4',
        ]);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['bucket-draw-5']);
        expect(resolved.finalState.sys?.interaction?.current).toBeUndefined();
    });

    it('五彩纸屑桶允许选择零张手牌并保持手牌与牌库不变', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('bucket-zero', 'diy_clowns_confetti_bucket', 'action', '0'),
                        makeCard('bucket-keep', 'diy_clowns_colorful_scarf', 'action', '0'),
                    ],
                    deck: [makeCard('bucket-zero-draw', 'diy_clowns_clown_girl', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'bucket-zero' },
        });
        expect(played.success, played.error).toBe(true);
        const prompt = getSimpleChoicePrompt(played.finalState, 'diy_clowns_confetti_bucket');
        expect(prompt.multi).toEqual({ min: 0, max: 1 });

        const skipped = respondToPromptOptions(played.finalState, [], '0', defaultTestRandom);
        expect(skipped.success, skipped.error).toBe(true);
        expect(skipped.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['bucket-keep']);
        expect(skipped.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['bucket-zero']);
        expect(skipped.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['bucket-zero-draw']);
        expect(skipped.finalState.sys?.interaction?.current).toBeUndefined();
    });

    it('五彩纸屑桶没有其他手牌时不生成空选择交互', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('bucket-empty', 'diy_clowns_confetti_bucket', 'action', '0')],
                    deck: [makeCard('bucket-empty-draw', 'diy_clowns_clown_girl', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'bucket-empty' },
        });

        expect(played.success, played.error).toBe(true);
        expect(played.finalState.core.players['0'].hand).toEqual([]);
        expect(played.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['bucket-empty']);
        expect(played.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['bucket-empty-draw']);
        expect(played.finalState.sys?.interaction?.current).toBeUndefined();
    });

    it('馅饼砸脸从手牌打出时只允许选择己方随从并获得+2力量', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('pie-hand', 'diy_clowns_pie_in_the_face', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('pie-own', 'diy_clowns_silent_clown', '0', 3),
                    makeMinion('pie-opponent', 'diy_clowns_slapstick_clown', '1', 5),
                ]),
                makeBase('base_b', [makeMinion('pie-own-2', 'diy_clowns_clown_girl', '0', 2)]),
            ],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'pie-hand' },
        });
        expect(played.success, played.error).toBe(true);
        const prompt = getSimpleChoicePrompt(played.finalState, 'diy_clowns_pie_in_the_face');
        expect(prompt.autoResolveIfSingle).toBe(false);
        expect(prompt.options.map(option => option.value?.minionUid)).toEqual(['pie-own', 'pie-own-2']);
        expect(played.finalState.core.bases[0].minions.find(minion => minion.uid === 'pie-own')?.tempPowerModifier ?? 0).toBe(0);

        const resolved = respondToPromptOption(
            played.finalState,
            option => option.value?.minionUid === 'pie-own-2',
            '馅饼砸脸选择第二个己方随从',
            '0',
            defaultTestRandom,
        );
        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.players['0'].discard.some(card => card.uid === 'pie-hand')).toBe(true);
        expect(resolved.finalState.core.bases[1].minions.find(minion => minion.uid === 'pie-own-2')?.tempPowerModifier).toBe(2);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'pie-opponent')?.tempPowerModifier ?? 0).toBe(0);
        expect(resolved.finalState.sys?.interaction?.current).toBeUndefined();
    });

    it('馅饼砸脸从弃牌堆打出时仍只允许选择己方随从并获得+4力量', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('pie-discard', 'diy_clowns_pie_in_the_face', 'action', '0')],
                    minionsPlayed: 1,
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [
                makeMinion('pie-own-discard', 'diy_clowns_silent_clown', '0', 3),
                makeMinion('pie-opponent-discard', 'diy_clowns_slapstick_clown', '1', 5),
            ])],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'pie-discard', fromDiscard: true },
        });
        expect(played.success, played.error).toBe(true);
        const prompt = getSimpleChoicePrompt(played.finalState, 'diy_clowns_pie_in_the_face');
        expect(prompt.autoResolveIfSingle).toBe(false);
        expect(prompt.options.map(option => option.value?.minionUid)).toEqual(['pie-own-discard']);

        const resolved = respondToPromptOption(
            played.finalState,
            option => option.value?.minionUid === 'pie-own-discard',
            '馅饼砸脸弃牌堆来源选择己方随从',
            '0',
            defaultTestRandom,
        );
        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.players['0'].deck.at(-1)?.uid).toBe('pie-discard');
        expect(resolved.finalState.core.players['0'].discard.some(card => card.uid === 'pie-discard')).toBe(false);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'pie-own-discard')?.tempPowerModifier).toBe(4);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'pie-opponent-discard')?.tempPowerModifier ?? 0).toBe(0);
        expect(resolved.finalState.sys?.interaction?.current).toBeUndefined();
    });

    it('惊吓盒从手牌授予力量不超过3的额外随从额度并在消费后清理限制', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('jack-hand', 'diy_clowns_jack_in_the_box', 'action', '0'),
                        makeCard('jack-eligible-3', 'diy_clowns_silent_clown', 'minion', '0'),
                        makeCard('jack-too-high-4', 'diy_clowns_mrs_clown', 'minion', '0'),
                    ],
                    minionsPlayed: 1,
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [makeMinion('existing', 'diy_clowns_silent_clown', '0', 3)])],
        }));

        const jackPlayed = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'jack-hand' },
        });

        expect(jackPlayed.success, jackPlayed.error).toBe(true);
        expect(jackPlayed.finalState.core.players['0'].minionLimit).toBe(2);
        expect(jackPlayed.finalState.core.players['0'].extraMinionPowerMax).toBe(3);
        expect(jackPlayed.finalState.core.players['0'].extraMinionPowerCaps).toEqual([3]);

        const blocked = runCommand(jackPlayed.finalState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'jack-too-high-4', baseIndex: 0 },
        });
        expect(blocked.success).toBe(false);

        const consumed = runCommand(jackPlayed.finalState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'jack-eligible-3', baseIndex: 0 },
        });
        expect(consumed.success, consumed.error).toBe(true);
        expect(consumed.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['existing', 'jack-eligible-3']);
        expect(consumed.finalState.core.players['0'].minionLimit).toBe(2);
        expect(consumed.finalState.core.players['0'].extraMinionPowerMax).toBeUndefined();
        expect(consumed.finalState.core.players['0'].extraMinionPowerCaps).toBeUndefined();
    });

    it('惊吓盒从弃牌堆打出时把额外随从力量上限提高到4', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('jack-discard-eligible-4', 'diy_clowns_mrs_clown', 'minion', '0'),
                        makeCard('jack-discard-too-high-5', 'diy_clowns_slapstick_clown', 'minion', '0'),
                    ],
                    discard: [makeCard('jack-discard', 'diy_clowns_jack_in_the_box', 'action', '0')],
                    minionsPlayed: 1,
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [makeMinion('jack-source', 'diy_clowns_slapstick_clown', '0', 5)])],
        }));

        const jackPlayed = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'jack-discard', fromDiscard: true },
        });

        expect(jackPlayed.success, jackPlayed.error).toBe(true);
        expect(jackPlayed.finalState.core.players['0'].actionsPlayed).toBe(1);
        expect(jackPlayed.finalState.core.players['0'].minionLimit).toBe(2);
        expect(jackPlayed.finalState.core.players['0'].extraMinionPowerMax).toBe(4);
        expect(jackPlayed.finalState.core.players['0'].extraMinionPowerCaps).toEqual([4]);

        const blocked = runCommand(jackPlayed.finalState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'jack-discard-too-high-5', baseIndex: 0 },
        });
        expect(blocked.success).toBe(false);

        const consumed = runCommand(jackPlayed.finalState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'jack-discard-eligible-4', baseIndex: 0 },
        });
        expect(consumed.success, consumed.error).toBe(true);
        expect(consumed.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual([
            'jack-source',
            'jack-discard-eligible-4',
        ]);
        expect(consumed.finalState.core.players['0'].deck.at(-1)?.uid).toBe('jack-discard');
        expect(consumed.finalState.core.players['0'].extraMinionPowerMax).toBeUndefined();
        expect(consumed.finalState.core.players['0'].extraMinionPowerCaps).toBeUndefined();
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

    it('跳舞小丑天赋先让玩家决定是否打出随机选择的标准行动', () => {
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
        const prompt = getSimpleChoicePrompt(result.finalState, 'diy_clowns_dancing_clown');
        expect(prompt.autoResolveIfSingle).toBe(false);
        expect(prompt.options.some(option => option.value?.skip === true)).toBe(true);
        expect(prompt.options.some(option => option.value?.cardUid === 'scarf1')).toBe(true);
        expect(result.finalState.core.players['0'].discard.some(card => card.uid === 'scarf1')).toBe(true);
        expect(result.finalState.core.players['0'].deck.some(card => card.uid === 'scarf1')).toBe(false);

        const resolved = respondToPromptOption(
            result.finalState,
            option => option.value?.cardUid === 'scarf1',
            '跳舞小丑打出随机行动',
            '0',
            defaultTestRandom,
        );
        expect(resolved.success, resolved.error).toBe(true);
        expect(result.finalState.core.players['0'].actionsPlayed).toBe(0);
        expect(resolved.finalState.core.players['0'].deck.at(-1)?.uid).toBe('scarf1');
        expect(resolved.finalState.core.players['0'].discard.some(card => card.uid === 'scarf1')).toBe(false);
        expect(resolved.events.some(event => event.type === SU_EVENTS.CARD_TO_DECK_BOTTOM)).toBe(true);
    });

    it('跳舞小丑选择跳过时不打出行动，随机行动仍留在弃牌堆', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [
                        makeCard('scarf1', 'diy_clowns_colorful_scarf', 'action', '0'),
                        makeCard('bucket1', 'diy_clowns_confetti_bucket', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [makeMinion('dancing1', 'diy_clowns_dancing_clown', '0', 4)])],
        }));

        const prompted = runCommand(state, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'dancing1', baseIndex: 0 },
        });
        expect(prompted.success, prompted.error).toBe(true);

        const skipped = respondToPromptOption(
            prompted.finalState,
            option => option.value?.skip === true,
            '跳舞小丑跳过',
            '0',
            defaultTestRandom,
        );
        expect(skipped.success, skipped.error).toBe(true);
        expect(skipped.finalState.core.players['0'].actionsPlayed).toBe(0);
        expect(skipped.finalState.core.players['0'].discard.some(card => card.uid === 'scarf1')).toBe(true);
        expect(skipped.finalState.core.players['0'].deck.some(card => card.uid === 'scarf1')).toBe(false);
        expect(skipped.events.some(event => event.type === SU_EVENTS.CARD_TO_DECK_BOTTOM)).toBe(false);
    });

    it('杂耍让每名玩家分别选择牌库顶三张中的行动牌', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('juggling1', 'diy_clowns_juggling', 'action', '0')],
                    deck: [
                        makeCard('p0-minion-a', 'diy_clowns_silent_clown', 'minion', '0'),
                        makeCard('p0-action-a', 'diy_clowns_colorful_scarf', 'action', '0'),
                        makeCard('p0-action-b', 'diy_clowns_confetti_bucket', 'action', '0'),
                        makeCard('p0-tail', 'diy_clowns_clown_girl', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [
                        makeCard('p1-minion-a', 'diy_clowns_silent_clown', 'minion', '1'),
                        makeCard('p1-action-a', 'diy_clowns_colorful_scarf', 'action', '1'),
                        makeCard('p1-action-b', 'diy_clowns_confetti_bucket', 'action', '1'),
                        makeCard('p1-tail', 'diy_clowns_clown_girl', 'minion', '1'),
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

        const p0Prompt = getSimpleChoicePrompt(result.finalState, 'diy_clowns_juggling_pick_action');
        expect(p0Prompt.playerId).toBe('0');
        expect(p0Prompt.options.map(option => option.value?.cardUid)).toEqual(['p0-action-a', 'p0-action-b']);

        const p0Resolved = respondToPromptOption(
            result.finalState,
            option => option.value?.cardUid === 'p0-action-b',
            '杂耍选择第二张行动牌',
            '0',
            defaultTestRandom,
        );
        expect(p0Resolved.success, p0Resolved.error).toBe(true);

        const p1Prompt = getSimpleChoicePrompt(p0Resolved.finalState, 'diy_clowns_juggling_pick_action');
        expect(p1Prompt.playerId).toBe('1');
        expect(p1Prompt.options.map(option => option.value?.cardUid)).toEqual(['p1-action-a', 'p1-action-b']);

        const p1Resolved = respondToPromptOption(
            p0Resolved.finalState,
            option => option.value?.cardUid === 'p1-action-a',
            '杂耍让第二名玩家选择行动牌',
            '1',
            defaultTestRandom,
        );
        expect(p1Resolved.success, p1Resolved.error).toBe(true);
        expect(p1Resolved.finalState.core.players['0'].discard.some(card => card.uid === 'p0-action-b')).toBe(true);
        expect(p1Resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['p0-minion-a', 'p0-action-a', 'p0-tail']);
        expect(p1Resolved.finalState.core.players['1'].discard.some(card => card.uid === 'p1-action-a')).toBe(true);
        expect(p1Resolved.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['p1-minion-a', 'p1-action-b', 'p1-tail']);
        expect(p1Resolved.finalState.sys?.interaction?.current).toBeUndefined();
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

    it('小丑学院第一次打入随从时可选回收标准行动，第二次打入不重复触发', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('academy-minion-1', 'diy_clowns_silent_clown', 'minion', '0'),
                        makeCard('academy-minion-2', 'diy_clowns_clown_girl', 'minion', '0'),
                    ],
                    discard: [
                        makeCard('academy-action-a', 'diy_clowns_colorful_scarf', 'action', '0'),
                        makeCard('academy-action-b', 'diy_clowns_confetti_bucket', 'action', '0'),
                        makeCard('academy-discard-minion', 'diy_clowns_mrs_clown', 'minion', '0'),
                    ],
                    minionLimit: 2,
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_diy_clowns_clown_academy')],
        }));

        const first = runCommand(state, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'academy-minion-1', baseIndex: 0 },
        });
        expect(first.success, first.error).toBe(true);
        const queued = first.events.find((event): event is TriggerQueuedEvent =>
            event.type === SU_EVENTS.TRIGGER_QUEUED
            && event.payload.triggers.some(trigger => trigger.sourceDefId === 'base_diy_clowns_clown_academy'),
        );
        expect(queued).toBeDefined();

        const prompted = maybeResolveReactionQueue(
            makeMatchState({ ...first.finalState.core, triggerQueue: queued!.payload.triggers }),
            defaultTestRandom,
            1,
        );
        expect(prompted).toBeDefined();
        const reactionPrompt = getSimpleChoicePrompt(prompted!.state, 'smashup_reaction_choose');
        expect(reactionPrompt.options.some(option => option.value?.triggerId?.includes('base_diy_clowns_clown_academy'))).toBe(true);
        expect(reactionPrompt.options.some(option => option.value?.kind === 'pass')).toBe(true);

        const accepted = respondToPromptOption(
            prompted!.state,
            option => option.value?.triggerId?.includes('base_diy_clowns_clown_academy'),
            '接受小丑学院回收标准行动',
            '0',
            defaultTestRandom,
        );
        expect(accepted.success, accepted.error).toBe(true);
        const acceptedHand = accepted.finalState.core.players['0'].hand.map(card => card.uid);
        const acceptedDiscard = accepted.finalState.core.players['0'].discard.map(card => card.uid);
        expect(acceptedHand.filter(uid => uid === 'academy-action-a' || uid === 'academy-action-b')).toHaveLength(1);
        expect(acceptedDiscard.filter(uid => uid === 'academy-action-a' || uid === 'academy-action-b')).toHaveLength(1);
        expect(acceptedDiscard).toContain('academy-discard-minion');
        expect(accepted.finalState.core.triggerQueue ?? []).toEqual([]);
        expect(accepted.finalState.sys?.interaction?.current).toBeUndefined();

        const second = runCommand(accepted.finalState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'academy-minion-2', baseIndex: 0 },
        });
        expect(second.success, second.error).toBe(true);
        expect(second.events.some(event =>
            event.type === SU_EVENTS.TRIGGER_QUEUED
            && event.payload.triggers.some(trigger => trigger.sourceDefId === 'base_diy_clowns_clown_academy'),
        )).toBe(false);
        expect(second.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual([
            'academy-minion-1',
            'academy-minion-2',
        ]);
    });

    it('小丑学院可让过且让过后不移动弃牌堆内容', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('academy-skip-minion', 'diy_clowns_silent_clown', 'minion', '0')],
                    discard: [makeCard('academy-skip-action', 'diy_clowns_colorful_scarf', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_diy_clowns_clown_academy')],
        }));

        const first = runCommand(state, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'academy-skip-minion', baseIndex: 0 },
        });
        expect(first.success, first.error).toBe(true);
        const queued = first.events.find((event): event is TriggerQueuedEvent =>
            event.type === SU_EVENTS.TRIGGER_QUEUED
            && event.payload.triggers.some(trigger => trigger.sourceDefId === 'base_diy_clowns_clown_academy'),
        );
        expect(queued).toBeDefined();
        const prompted = maybeResolveReactionQueue(
            makeMatchState({ ...first.finalState.core, triggerQueue: queued!.payload.triggers }),
            defaultTestRandom,
            1,
        );
        const skipped = respondToPromptOption(
            prompted!.state,
            option => option.value?.kind === 'pass',
            '跳过小丑学院',
            '0',
            defaultTestRandom,
        );

        expect(skipped.success, skipped.error).toBe(true);
        expect(skipped.finalState.core.players['0'].hand.map(card => card.uid)).toEqual([]);
        expect(skipped.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['academy-skip-action']);
        expect(skipped.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['academy-skip-minion']);
        expect(skipped.finalState.core.triggerQueue ?? []).toEqual([]);
        expect(skipped.finalState.sys?.interaction?.current).toBeUndefined();
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
