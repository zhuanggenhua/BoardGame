import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { isAbilityRuntimeContinuationEvent, resumeAbilityRuntimeContinuationEvent } from '../../domain/abilityRuntime';
import { collectTriggers } from '../../domain/ongoingEffects';
import { maybeResolveReactionQueue } from '../../domain/reactionQueue';
import { getEffectiveBreakpoint } from '../../domain/ongoingModifiers';
import { processReturnToHandTriggers } from '../../domain/reducer';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import { ANANSI_TALES_BASES, ANANSI_TALES_CARDS } from '../../data/factions/anansi_tales';
import {
    expectRegisteredAbilityContract,
    applyEvents,
    getSimpleChoicePrompt,
    invokeRegisteredAbilityContract,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPromptOption,
    respondToPromptOptions,
    triggerBaseAbilityWithMS,
} from '../helpers';
import { runCommand } from '../testRunner';

const FIXED_RANDOM = {
    random: () => 0,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(items: T[]) => [...items],
};

function resumeFirstRuntimeContinuation(
    core: ReturnType<typeof makeState>,
    events: unknown[],
) {
    const domainEvents = events.filter(event => !isAbilityRuntimeContinuationEvent(event as any));
    const continuation = events.find(event => isAbilityRuntimeContinuationEvent(event as any));
    if (!continuation) throw new Error('Expected Smash Up ability runtime continuation event.');
    const resumed = resumeAbilityRuntimeContinuationEvent(
        makeMatchState(applyEvents(core, domainEvents as any)),
        continuation as any,
        FIXED_RANDOM,
    );
    if (!resumed) throw new Error('Expected Smash Up ability runtime continuation to resume.');
    return resumed.state;
}

function makeTransferEvent(cardUid: string, defId: string, fromPlayerId = '0', toPlayerId = '1') {
    return {
        type: SU_EVENTS.CARD_TRANSFERRED,
        payload: {
            cardUid,
            defId,
            fromPlayerId,
            toPlayerId,
            ownerId: fromPlayerId,
            reason: 'test_gift',
        },
        timestamp: 100,
    } as any;
}

describe('阿南西传说代表性玩法行为', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('静态牌组合同保持 13 张唯一卡面、20 张实体牌和 2 张基地', () => {
        expect(ANANSI_TALES_CARDS).toHaveLength(13);
        expect(ANANSI_TALES_CARDS.reduce((total, card) => total + card.count, 0)).toBe(20);
        expect(ANANSI_TALES_CARDS.map(card => card.previewRef?.index).sort((a, b) => Number(a) - Number(b))).toEqual(
            Array.from({ length: 13 }, (_, index) => index),
        );
        expect(ANANSI_TALES_BASES.map(base => base.id).sort()).toEqual([
            'base_anansis_web',
            'base_storytellers_hut',
        ]);
    });

    it('行动自身已有目标交互时，阿南西之网触发不得抢在行动目标选择之前', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('broadside-card', 'pirate_broadside', 'action', '0')],
                    deck: [
                        makeCard('draw-1', 'anansi_tales_pot_of_beans', 'action', '0'),
                        makeCard('draw-2', 'anansi_tales_feather_gifts', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_anansis_web', [
                    makeMinion('web-ally', 'anansi_tales_akye_the_turtle', '0', 3),
                    makeMinion('web-enemy', 'ninja_acolyte', '1', 2),
                ]),
                makeBase('base_storytellers_hut'),
            ],
        });

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'broadside-card' },
            timestamp: 1,
        } as any, FIXED_RANDOM);

        const currentSourceId = (result.finalState.sys.interaction?.current?.data as { sourceId?: string } | undefined)?.sourceId;
        expect(currentSourceId).toBe('pirate_broadside_choose_base');
        expect(result.events.some(event => event.type === SU_EVENTS.TRIGGER_QUEUED)).toBe(true);
    });

    it('阿南西传说核心主动能力入口已注册', () => {
        const registrations = [
            ['anansi_tales_anansi_the_spider', 'talent'],
            ['anansi_tales_akye_the_turtle', 'onPlay'],
            ['anansi_tales_the_perfect_gift', 'onPlay'],
            ['anansi_tales_pot_of_beans', 'onPlay'],
            ['anansi_tales_collecting_stories', 'onPlay'],
            ['anansi_tales_ear_of_corn', 'onPlay'],
            ['anansi_tales_pot_of_wisdom', 'onPlay'],
            ['anansi_tales_trading_stories', 'onPlay'],
            ['anansi_tales_let_it_be_full_and_eat', 'onPlay'],
            ['anansi_tales_feather_gifts', 'onPlay'],
        ] as const;

        for (const [defId, tag] of registrations) {
            expect(expectRegisteredAbilityContract(defId, tag), `${defId}::${tag}`).toBeTypeOf('function');
        }
    });

    it('阿克耶海龟可以把一张手牌给另一名玩家并抽 2 张', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('gift-1', 'anansi_tales_trading_stories', 'action', '0')],
                    deck: [
                        makeCard('draw-1', 'anansi_tales_pot_of_beans', 'action', '0'),
                        makeCard('draw-2', 'anansi_tales_feather_gifts', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('anansi_tales_akye_the_turtle', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'turtle',
            defId: 'anansi_tales_akye_the_turtle',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const selected = respondToPromptOption(
            result.matchState!,
            option => option.value?.cardUid === 'gift-1' && option.value?.targetPlayerId === '1',
            'give a hand card to player 1',
            '0',
            FIXED_RANDOM,
        );

        expect(selected.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-1', 'draw-2']);
        expect(selected.finalState.core.players['1'].hand.map(card => card.uid)).toEqual(['gift-1']);
    });

    it('阿克耶海龟在合法候选存在时允许跳过', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('gift-1', 'anansi_tales_trading_stories', 'action', '0')],
                    deck: [makeCard('draw-1', 'anansi_tales_pot_of_beans', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('anansi_tales_akye_the_turtle', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'turtle',
            defId: 'anansi_tales_akye_the_turtle',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 11,
        });
        const skipped = respondToPromptOption(
            result.matchState!,
            option => option.value?.skip === true,
            'skip 阿克耶海龟',
            '0',
            FIXED_RANDOM,
        );

        expect(skipped.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['gift-1']);
        expect(skipped.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['draw-1']);
        expect(skipped.finalState.core.players['1'].hand).toEqual([]);
    });

    it('交易故事可以给出至多三张手牌并按给出数量抽牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('gift-1', 'anansi_tales_pot_of_beans', 'action', '0'),
                        makeCard('gift-2', 'anansi_tales_feather_gifts', 'action', '0'),
                        makeCard('gift-3', 'anansi_tales_let_it_be_full_and_eat', 'action', '0'),
                        makeCard('kept', 'anansi_tales_ear_of_corn', 'action', '0'),
                    ],
                    deck: [
                        makeCard('draw-1', 'anansi_tales_collecting_stories', 'action', '0'),
                        makeCard('draw-2', 'anansi_tales_pot_of_wisdom', 'action', '0'),
                        makeCard('draw-3', 'anansi_tales_the_perfect_gift', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('anansi_tales_trading_stories', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'trading',
            defId: 'anansi_tales_trading_stories',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 20,
        });
        const prompt = getSimpleChoicePrompt(result.matchState!, 'anansi_tales_trading_stories');
        const selectedIds = prompt.options
            .filter((option: any) => ['gift-1', 'gift-2', 'gift-3'].includes(option.value?.cardUid))
            .map((option: any) => option.id);
        const selected = respondToPromptOptions(result.matchState!, selectedIds, '0', FIXED_RANDOM);

        expect(selected.finalState.core.players['0'].hand.map(card => card.uid).sort()).toEqual(
            ['draw-1', 'draw-2', 'draw-3', 'kept'].sort(),
        );
        expect(selected.finalState.core.players['1'].hand.map(card => card.uid).sort()).toEqual(
            ['gift-1', 'gift-2', 'gift-3'].sort(),
        );
    });

    it('玉米穗最多洗回三张弃牌堆行动、获得额外行动并把自己给出', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-card', 'anansi_tales_trading_stories', 'action', '0')],
                    discard: [
                        makeCard('corn-card', 'anansi_tales_ear_of_corn', 'action', '0'),
                        makeCard('recycle-1', 'anansi_tales_pot_of_beans', 'action', '0'),
                        makeCard('recycle-2', 'anansi_tales_pot_of_wisdom', 'action', '0'),
                        makeCard('recycle-3', 'anansi_tales_feather_gifts', 'action', '0'),
                        makeCard('ignored-minion', 'anansi_tales_akye_the_turtle', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('anansi_tales_ear_of_corn', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'corn-card',
            defId: 'anansi_tales_ear_of_corn',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 40,
        });
        const prompt = getSimpleChoicePrompt(result.matchState!, 'anansi_tales_ear_of_corn');
        const selectedIds = prompt.options
            .filter((option: any) => ['recycle-1', 'recycle-2', 'recycle-3'].includes(option.value?.cardUid))
            .map((option: any) => option.id);
        expect(selectedIds).toHaveLength(3);

        const recycled = respondToPromptOptions(result.matchState!, selectedIds, '0', FIXED_RANDOM);
        expect(recycled.success, recycled.error).toBe(true);
        const gifted = respondToPromptOption(
            recycled.finalState,
            option => option.value?.targetPlayerId === '1',
            'gift 玉米穗',
            '0',
            FIXED_RANDOM,
        );

        expect(gifted.finalState.core.players['0'].deck.map(card => card.uid)).toEqual([
            'deck-card',
            'recycle-1',
            'recycle-2',
            'recycle-3',
        ]);
        expect(gifted.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['ignored-minion']);
        expect(gifted.finalState.core.players['1'].hand.map(card => card.uid)).toEqual(['corn-card']);
        expect(gifted.finalState.core.players['0'].actionLimit).toBe(2);
        expect(gifted.finalState.sys?.interaction?.current).toBeFalsy();
    });

    it('智慧之锅按其他玩家数量抽牌、分别给牌并获得额外行动', () => {
        const core = makeState({
            turnOrder: ['0', '1', '2'],
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('hand-card', 'anansi_tales_trading_stories', 'action', '0')],
                    deck: [
                        makeCard('draw-1', 'anansi_tales_pot_of_beans', 'action', '0'),
                        makeCard('draw-2', 'anansi_tales_feather_gifts', 'action', '0'),
                    ],
                    discard: [makeCard('wisdom-card', 'anansi_tales_pot_of_wisdom', 'action', '0')],
                }),
                '1': makePlayer('1'),
                '2': makePlayer('2'),
            },
        });

        const result = invokeRegisteredAbilityContract('anansi_tales_pot_of_wisdom', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'wisdom-card',
            defId: 'anansi_tales_pot_of_wisdom',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 50,
        });
        const promptState = resumeFirstRuntimeContinuation(core, result.events);
        const prompt = getSimpleChoicePrompt(promptState, 'anansi_tales_pot_of_wisdom');
        const playerOneChoice = prompt.options.find((option: any) => (
            option.value?.cardUid === 'hand-card' && option.value?.targetPlayerId === '1'
        ));
        const playerTwoChoice = prompt.options.find((option: any) => (
            option.value?.targetPlayerId === '2' && option.value?.cardUid !== 'hand-card'
        ));
        expect(playerOneChoice).toBeDefined();
        expect(playerTwoChoice).toBeDefined();
        const giftedToPlayerTwoUid = playerTwoChoice!.value.cardUid as string;

        const resolved = respondToPromptOptions(
            promptState,
            [playerOneChoice!.id, playerTwoChoice!.id],
            '0',
            FIXED_RANDOM,
        );
        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid).sort()).toEqual(
            ['draw-1', 'draw-2'].filter(uid => uid !== giftedToPlayerTwoUid).sort(),
        );
        expect(resolved.finalState.core.players['1'].hand.map(card => card.uid)).toEqual(['hand-card']);
        expect(resolved.finalState.core.players['2'].hand.map(card => card.uid)).toEqual([giftedToPlayerTwoUid]);
        expect(resolved.finalState.core.players['0'].actionLimit).toBe(2);
        expect(resolved.finalState.sys?.interaction?.current).toBeFalsy();
    });

    it('让它吃饱先抽两张牌，再把自己放入另一名玩家手中', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('draw-1', 'anansi_tales_pot_of_beans', 'action', '0'),
                        makeCard('draw-2', 'anansi_tales_feather_gifts', 'action', '0'),
                    ],
                    discard: [makeCard('eat-card', 'anansi_tales_let_it_be_full_and_eat', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('anansi_tales_let_it_be_full_and_eat', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'eat-card',
            defId: 'anansi_tales_let_it_be_full_and_eat',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 60,
        });
        const promptState = resumeFirstRuntimeContinuation(core, result.events);
        const gifted = respondToPromptOption(
            promptState,
            option => option.value?.targetPlayerId === '1',
            'gift 让它吃饱',
            '0',
            FIXED_RANDOM,
        );

        expect(gifted.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-1', 'draw-2']);
        expect(gifted.finalState.core.players['0'].discard).toEqual([]);
        expect(gifted.finalState.core.players['1'].hand.map(card => card.uid)).toEqual(['eat-card']);
        expect(gifted.finalState.core.players['0'].actionLimit).toBe(1);
        expect(gifted.finalState.sys?.interaction?.current).toBeFalsy();
    });

    it('羽毛礼物只允许选择己方随从，移动到另一基地后再把自己给出', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('feather-card', 'anansi_tales_feather_gifts', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_anansis_web', [
                    makeMinion('own-minion', 'anansi_tales_akye_the_turtle', '0', 3),
                    makeMinion('enemy-minion', 'pirate_first_mate', '1', 2),
                ]),
                makeBase('base_storytellers_hut'),
            ],
        });

        const result = invokeRegisteredAbilityContract('anansi_tales_feather_gifts', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'feather-card',
            defId: 'anansi_tales_feather_gifts',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 70,
        });
        const sourcePrompt = getSimpleChoicePrompt(result.matchState!, 'anansi_tales_feather_gifts');
        expect(sourcePrompt.options.some((option: any) => option.value?.minionUid === 'own-minion')).toBe(true);
        expect(sourcePrompt.options.some((option: any) => option.value?.minionUid === 'enemy-minion')).toBe(false);

        const moved = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'own-minion' && option.value?.baseIndex === 0,
            '选择己方随从移动',
            '0',
            FIXED_RANDOM,
        );
        const destination = respondToPromptOption(
            moved.finalState,
            option => option.value?.baseIndex === 1,
            '选择羽毛礼物目的基地',
            '0',
            FIXED_RANDOM,
        );
        const gifted = respondToPromptOption(
            destination.finalState,
            option => option.value?.targetPlayerId === '1',
            'gift 羽毛礼物',
            '0',
            FIXED_RANDOM,
        );

        expect(gifted.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['enemy-minion']);
        expect(gifted.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['own-minion']);
        expect(gifted.finalState.core.players['1'].hand.map(card => card.uid)).toEqual(['feather-card']);
        expect(gifted.finalState.core.players['0'].discard).toEqual([]);
        expect(gifted.finalState.sys?.interaction?.current).toBeFalsy();
    });

    it('收集故事会从另一名玩家手中额外打出自己拥有的行动', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [
                        makeCard('borrowed', 'anansi_tales_trading_stories', 'action', '0'),
                        makeCard('owner-card', 'anansi_tales_feather_gifts', 'action', '1'),
                    ],
                }),
            },
        });

        const result = invokeRegisteredAbilityContract('anansi_tales_collecting_stories', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'collecting',
            defId: 'anansi_tales_collecting_stories',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 30,
        });
        const selected = respondToPromptOption(
            result.matchState!,
            option => option.value?.cardUid === 'borrowed' && option.value?.fromPlayerId === '1',
            'play owned action from another hand',
            '0',
            FIXED_RANDOM,
        );

        expect(selected.finalState.core.players['0'].discard.map(card => card.uid)).toContain('borrowed');
        expect(selected.finalState.core.players['0'].hand.map(card => card.uid)).not.toContain('borrowed');
        expect(selected.finalState.core.players['1'].hand.map(card => card.uid)).toEqual(['owner-card']);
        expect(selected.events.some(event =>
            event.type === SU_EVENTS.ACTION_PLAYED
            && (event as any).payload.cardUid === 'borrowed'
            && (event as any).payload.isExtraAction === true,
        )).toBe(true);
    });

    it('完美的礼物从牌库选出的行动会被打出后交给另一名玩家，不会被吞掉', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('selected-action', 'anansi_tales_trading_stories', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('anansi_tales_the_perfect_gift', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'perfect-gift',
            defId: 'anansi_tales_the_perfect_gift',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 40,
        });
        const chosenAction = respondToPromptOption(
            result.matchState!,
            option => option.value?.cardUid === 'selected-action',
            'choose deck action',
            '0',
            FIXED_RANDOM,
        );
        const giftedAction = respondToPromptOption(
            chosenAction.finalState,
            option => option.value?.targetPlayerId === '1',
            'gift selected action',
            '0',
            FIXED_RANDOM,
        );

        expect(giftedAction.finalState.core.players['0'].deck).toEqual([]);
        expect(giftedAction.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('selected-action');
        expect(giftedAction.finalState.core.players['1'].hand.map(card => card.uid)).toEqual(['selected-action']);
    });

    it('蜘蛛阿南西会锁定本回合再次打出同名行动', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('selected-action', 'anansi_tales_trading_stories', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_anansis_web', [
                makeMinion('spider', 'anansi_tales_anansi_the_spider', '0', 5),
            ])],
        });

        const result = invokeRegisteredAbilityContract('anansi_tales_anansi_the_spider', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'spider',
            defId: 'anansi_tales_anansi_the_spider',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 44,
        });
        const chosenAction = respondToPromptOption(
            result.matchState!,
            option => option.value?.cardUid === 'selected-action',
            'choose deck action for 蜘蛛阿南西',
            '0',
            FIXED_RANDOM,
        );
        const giftedAction = respondToPromptOption(
            chosenAction.finalState,
            option => option.value?.targetPlayerId === '1',
            'gift selected action after 蜘蛛阿南西',
            '0',
            FIXED_RANDOM,
        );

        const blockedState = {
            ...giftedAction.finalState,
            core: {
                ...giftedAction.finalState.core,
                players: {
                    ...giftedAction.finalState.core.players,
                    '0': {
                        ...giftedAction.finalState.core.players['0'],
                        hand: [makeCard('copy-action', 'anansi_tales_trading_stories', 'action', '0')],
                    },
                },
            },
        };
        const replayCopy = runCommand(blockedState, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'copy-action' },
            timestamp: 45,
        } as any, FIXED_RANDOM);

        expect(giftedAction.finalState.core.blockedActionDefIdsThisTurn?.['0']).toContain('anansi_tales_trading_stories');
        expect(replayCopy.success).toBe(false);
        expect(replayCopy.error).toContain('本回合不能再打出');
    });
    it('一锅豆子放置两个 +1 指示物后会把自己给另一名玩家', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('beans-card', 'anansi_tales_pot_of_beans', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_storytellers_hut', [
                makeMinion('ally', 'anansi_tales_akye_the_turtle', '0', 3),
            ])],
        });

        const result = invokeRegisteredAbilityContract('anansi_tales_pot_of_beans', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'beans-card',
            defId: 'anansi_tales_pot_of_beans',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 50,
        });
        const counterPlaced = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'ally',
            'place counters on ally',
            '0',
            FIXED_RANDOM,
        );
        const gifted = respondToPromptOption(
            counterPlaced.finalState,
            option => option.value?.targetPlayerId === '1',
            'gift 一锅豆子',
            '0',
            FIXED_RANDOM,
        );

        expect(gifted.finalState.core.bases[0].minions[0].powerCounters).toBe(2);
        expect(gifted.finalState.core.players['1'].hand.map(card => card.uid)).toEqual(['beans-card']);
    });

    it('奥塞波豹在你把牌放进其他玩家手牌后获得 +1 指示物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('gift-1', 'anansi_tales_trading_stories', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_anansis_web', [
                makeMinion('osebo', 'anansi_tales_osebo_the_leopard', '0', 4),
            ])],
        });

        const processed = processReturnToHandTriggers(
            [makeTransferEvent('gift-1', 'anansi_tales_trading_stories')],
            makeMatchState(core),
            '0',
            FIXED_RANDOM,
            60,
        );
        const queued = processed.events.find(event => event.type === SU_EVENTS.TRIGGER_QUEUED) as any;
        expect(queued?.payload.triggers[0].sourceDefId).toBe('anansi_tales_osebo_the_leopard');

        const prompted = maybeResolveReactionQueue(
            makeMatchState({ ...processed.matchState!.core, triggerQueue: queued.payload.triggers } as any),
            FIXED_RANDOM,
            61,
        );

        expect(prompted?.state.core.bases[0].minions[0].powerCounters).toBe(1);
    });

    it('奥尼尼巨蟒只在对手使用借来的牌时开放可选反应并只给己方随从指示物', () => {
        const core = makeState({
            bases: [makeBase('base_anansis_web', [
                makeMinion('onini', 'anansi_tales_onini_the_python', '0', 4),
                makeMinion('ally', 'anansi_tales_akye_the_turtle', '0', 3),
                makeMinion('enemy', 'pirate_first_mate', '1', 2),
            ])],
        });

        const queued = collectTriggers(core, 'onActionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            triggerCardUid: 'borrowed-action',
            triggerCardDefId: 'anansi_tales_trading_stories',
            triggerCardOwnerId: '0',
            random: FIXED_RANDOM,
            now: 70,
        });
        expect(queued?.payload.triggers.map(trigger => trigger.sourceDefId)).toContain('anansi_tales_onini_the_python');

        const prompted = maybeResolveReactionQueue(
            makeMatchState({ ...core, triggerQueue: queued!.payload.triggers } as any),
            FIXED_RANDOM,
            71,
        );
        const selectedTrigger = respondToPromptOption(
            prompted!.state,
            option => option.value?.triggerId === queued!.payload.triggers[0].id,
            'choose 奥尼尼巨蟒 trigger',
            '0',
            FIXED_RANDOM,
        );
        const counterPrompt = getSimpleChoicePrompt(selectedTrigger.finalState, 'anansi_tales_onini_the_python_counter');
        expect(counterPrompt.options.map((option: any) => option.value?.minionUid).sort()).toEqual(['ally', 'onini'].sort());

        const counterPlaced = respondToPromptOption(
            selectedTrigger.finalState,
            option => option.value?.minionUid === 'ally',
            'place 奥尼尼巨蟒 counter',
            '0',
            FIXED_RANDOM,
        );
        expect(counterPlaced.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally')?.powerCounters).toBe(1);

        const ownCardQueued = collectTriggers(core, 'onActionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            triggerCardUid: 'own-action',
            triggerCardDefId: 'pirate_broadside',
            triggerCardOwnerId: '1',
            random: FIXED_RANDOM,
            now: 72,
        });
        expect(ownCardQueued?.payload.triggers.some(trigger => trigger.sourceDefId === 'anansi_tales_onini_the_python')).not.toBe(true);
    });

    it('马布罗大黄蜂可在对手使用借来的牌后从手牌额外打出', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('hornet-card', 'anansi_tales_mboro_hornet', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_anansis_web'), makeBase('base_storytellers_hut')],
        });

        const queued = collectTriggers(core, 'onActionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            triggerCardUid: 'borrowed-action',
            triggerCardDefId: 'anansi_tales_trading_stories',
            triggerCardOwnerId: '0',
            random: FIXED_RANDOM,
            now: 80,
        });
        expect(queued?.payload.triggers.map(trigger => trigger.sourceDefId)).toContain('anansi_tales_mboro_hornet');

        const prompted = maybeResolveReactionQueue(
            makeMatchState({ ...core, triggerQueue: queued!.payload.triggers } as any),
            FIXED_RANDOM,
            81,
        );
        const hornetTrigger = queued!.payload.triggers.find((trigger: any) => trigger.sourceDefId === 'anansi_tales_mboro_hornet');
        const selectedTrigger = respondToPromptOption(
            prompted!.state,
            option => option.value?.triggerId === hornetTrigger.id,
            'choose 马布罗大黄蜂 trigger',
            '0',
            FIXED_RANDOM,
        );
        const played = respondToPromptOption(
            selectedTrigger.finalState,
            option => option.value?.baseIndex === 1,
            'play 马布罗大黄蜂 to second base',
            '0',
            FIXED_RANDOM,
        );

        expect(played.finalState.core.players['0'].hand).toEqual([]);
        expect(played.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['hornet-card']);
        expect(played.events.some(event =>
            event.type === SU_EVENTS.MINION_PLAYED
            && (event as any).payload.consumesNormalLimit === false,
        )).toBe(true);
    });

    it('阿南西之网要求己方随从在场，并且每回合只在首次标准行动后生效', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('web-action', 'anansi_tales_trading_stories', 'action', '0')],
                    deck: [
                        makeCard('draw-1', 'anansi_tales_pot_of_beans', 'action', '0'),
                        makeCard('draw-2', 'anansi_tales_feather_gifts', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_anansis_web', [
                makeMinion('ally', 'anansi_tales_akye_the_turtle', '0', 3),
            ])],
        });

        const result = triggerBaseAbilityWithMS('base_anansis_web', 'onActionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            baseDefId: 'base_anansis_web',
            triggerCardUid: 'web-action',
            triggerCardDefId: 'anansi_tales_trading_stories',
            triggerCardOwnerId: '0',
            random: FIXED_RANDOM,
            now: 90,
        });
        const gifted = respondToPromptOption(
            result.matchState!,
            option => option.value?.targetPlayerId === '1',
            'gift 阿南西之网 action',
            '0',
            FIXED_RANDOM,
        );

        expect(gifted.finalState.core.players['1'].hand.map(card => card.uid)).toEqual(['web-action']);
        expect(gifted.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-1', 'draw-2']);
        expect(gifted.finalState.core.bases[0].metadata?.anansisWebUsedTurn).toBe(1);

        const second = triggerBaseAbilityWithMS('base_anansis_web', 'onActionPlayed', {
            state: {
                ...gifted.finalState.core,
                players: {
                    ...gifted.finalState.core.players,
                    '0': {
                        ...gifted.finalState.core.players['0'],
                        discard: [makeCard('second-action', 'anansi_tales_pot_of_wisdom', 'action', '0')],
                    },
                },
            },
            matchState: gifted.finalState,
            playerId: '0',
            baseIndex: 0,
            baseDefId: 'base_anansis_web',
            triggerCardUid: 'second-action',
            triggerCardDefId: 'anansi_tales_pot_of_wisdom',
            triggerCardOwnerId: '0',
            random: FIXED_RANDOM,
            now: 91,
        });
        expect(second.events).toEqual([]);

        const noMinionCore = makeState({
            players: {
                '0': makePlayer('0', { discard: [makeCard('web-action', 'anansi_tales_trading_stories', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_anansis_web')],
        });
        const noMinion = triggerBaseAbilityWithMS('base_anansis_web', 'onActionPlayed', {
            state: noMinionCore,
            matchState: makeMatchState(noMinionCore),
            playerId: '0',
            baseIndex: 0,
            baseDefId: 'base_anansis_web',
            actionTargetBaseIndex: 0,
            triggerCardUid: 'web-action',
            triggerCardDefId: 'anansi_tales_trading_stories',
            triggerCardOwnerId: '0',
            random: FIXED_RANDOM,
            now: 92,
        });
        expect(noMinion.events).toEqual([]);
    });

    it('故事讲述者小屋会放置持久 counter 并按 counter 降低断点', () => {
        const core = makeState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            bases: [makeBase('base_storytellers_hut')],
        });
        const used = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_BASE_ABILITY,
            playerId: '0',
            payload: { baseIndex: 0 },
            timestamp: 100,
        } as any, FIXED_RANDOM);

        expect(used.success).toBe(true);
        expect(used.finalState.core.bases[0].metadata?.storytellersHutCounters).toBe(1);
        expect(getEffectiveBreakpoint(used.finalState.core, 0)).toBe(22);
        expect(used.finalState.core.players['0'].actionLimit).toBe(2);
    });
});
