import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { RUSSIAN_FAIRY_TALES_BASES, RUSSIAN_FAIRY_TALES_CARDS } from '../../data/factions/russian_fairy_tales';
import {
    isAbilityRuntimeContinuationEvent,
    resumeAbilityRuntimeContinuationEvent,
} from '../../domain/abilityRuntime';
import { getMinionPower } from '../../domain/abilityHelpers';
import { collectBaseAbilityTriggers } from '../../domain/baseAbilityQueue';
import { collectTriggers } from '../../domain/ongoingEffects';
import { getEffectiveBreakpoint } from '../../domain/ongoingModifiers';
import { maybeResolveReactionQueue } from '../../domain/reactionQueue';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import { defaultTestRandom, runCommand } from '../testRunner';
import {
    applyEvents,
    expectRegisteredAbilityContract,
    expectRegisteredInteractionHandlerContract,
    getSimpleChoicePrompt,
    invokeRegisteredAbilityContract,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    resolveCardsReturnedToHand,
    respondToPromptOption,
    respondToPromptOptions,
    triggerBaseAbilityWithMS,
} from '../helpers';

const FIXED_RANDOM = {
    random: () => 0,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(items: T[]) => [...items],
};

const REVERSING_RANDOM = {
    ...FIXED_RANDOM,
    shuffle: <T>(items: T[]) => [...items].reverse(),
};

describe('俄罗斯童话代表性玩法行为', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('静态牌组合同保持 16 张唯一卡面、20 张实体牌、2 张基地和芬尼斯特猎鹰中文名', () => {
        expect(RUSSIAN_FAIRY_TALES_CARDS).toHaveLength(16);
        expect(RUSSIAN_FAIRY_TALES_CARDS.reduce((total, card) => total + card.count, 0)).toBe(20);
        expect(RUSSIAN_FAIRY_TALES_CARDS.map(card => card.previewRef?.index).sort((a, b) => Number(a) - Number(b))).toEqual(
            Array.from({ length: 16 }, (_value, index) => index + 31),
        );
        expect(RUSSIAN_FAIRY_TALES_CARDS.find(card => card.id === 'russian_fairy_tales_finist_the_falcon')?.name).toBe('芬尼斯特猎鹰');
        expect(RUSSIAN_FAIRY_TALES_BASES.map(base => base.id).sort()).toEqual([
            'base_giant_turnip',
            'base_transformation_spring',
        ]);
    });

    it('俄罗斯童话本批 L2 能力入口与交互续算已注册', () => {
        const registrations = [
            ['russian_fairy_tales_transformation', 'onPlay'],
            ['russian_fairy_tales_baba_yaga', 'talent'],
            ['russian_fairy_tales_the_frog_princess', 'talent'],
            ['russian_fairy_tales_the_water_of_life', 'onPlay'],
            ['russian_fairy_tales_fetch_i_know_not_what', 'onPlay'],
            ['russian_fairy_tales_go_i_know_not_whither', 'onPlay'],
            ['russian_fairy_tales_tsar_eagle', 'onPlay'],
            ['russian_fairy_tales_the_gray_wolf', 'talent'],
            ['russian_fairy_tales_foolish_magician', 'onPlay'],
            ['russian_fairy_tales_toad', 'onPlay'],
            ['russian_fairy_tales_mass_transformation', 'onPlay'],
            ['russian_fairy_tales_finist_the_falcon', 'special'],
        ] as const;

        for (const [defId, tag] of registrations) {
            expect(expectRegisteredAbilityContract(defId, tag), `${defId}::${tag}`).toBeTypeOf('function');
        }

        for (const sourceId of [
            'russian_fairy_tales_transformation',
            'russian_fairy_tales_baba_yaga',
            'russian_fairy_tales_the_water_of_life',
            'russian_fairy_tales_fetch_i_know_not_what',
            'russian_fairy_tales_go_i_know_not_whither',
            'russian_fairy_tales_tsar_eagle',
            'russian_fairy_tales_the_gray_wolf',
            'russian_fairy_tales_foolish_magician',
            'russian_fairy_tales_toad',
            'russian_fairy_tales_search_card',
            'russian_fairy_tales_bewitched_transfer',
            'russian_fairy_tales_finist_the_falcon',
        ]) {
            expect(expectRegisteredInteractionHandlerContract(sourceId), sourceId).toBeTypeOf('function');
        }
    });

    it('变化将任意随从放到拥有者牌库底，并让其从牌库顶变出随从到原基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('deck-action', 'russian_fairy_tales_the_water_of_life', 'action', '0'),
                        makeCard('deck-minion', 'russian_fairy_tales_tsar_eagle', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_transformation_spring', [
                    makeMinion('target', 'pirate_first_mate', '0', 2),
                ]),
            ],
        });

        const result = invokeRegisteredAbilityContract('russian_fairy_tales_transformation', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'transformation',
            defId: 'russian_fairy_tales_transformation',
            baseIndex: 0,
            random: REVERSING_RANDOM,
            now: 10,
        });
        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'target',
            'choose minion for 变化',
            '0',
            REVERSING_RANDOM,
        );

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['deck-minion']);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['target', 'deck-action']);
    });

    it('芭芭雅嘎替换后会洗牌目标拥有者的牌库', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('deck-action', 'russian_fairy_tales_the_water_of_life', 'action', '0'),
                        makeCard('deck-minion', 'russian_fairy_tales_tsar_eagle', 'minion', '0'),
                        makeCard('deck-tail', 'russian_fairy_tales_toad', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_transformation_spring', [
                makeMinion('baba', 'russian_fairy_tales_baba_yaga', '0', 5),
                makeMinion('target', 'pirate_first_mate', '0', 2),
            ])],
        });

        const result = invokeRegisteredAbilityContract('russian_fairy_tales_baba_yaga', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'baba',
            defId: 'russian_fairy_tales_baba_yaga',
            baseIndex: 0,
            random: REVERSING_RANDOM,
            now: 12,
        });
        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'target',
            '芭芭雅嘎选择目标随从',
            '0',
            REVERSING_RANDOM,
        );

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['baba', 'deck-minion']);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['target', 'deck-tail', 'deck-action']);
    });

    it('青蛙公主天赋替换宿主后，会把自身转移到新随从且保留已用天赋状态', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('deck-action', 'russian_fairy_tales_the_water_of_life', 'action', '0'),
                        makeCard('deck-minion', 'russian_fairy_tales_tsar_eagle', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_transformation_spring', [
                    makeMinion('host', 'russian_fairy_tales_tsar_eagle', '0', 2, {
                        attachedActions: [{ uid: 'frog-action', defId: 'russian_fairy_tales_the_frog_princess', ownerId: '0', talentUsed: false }],
                    }),
                ]),
            ],
        });

        const used = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'frog-action', baseIndex: 0 },
        } as any, FIXED_RANDOM);

        expect(used.success, used.error).toBe(true);
        expect(used.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['deck-minion']);
        expect(used.finalState.core.bases[0].minions[0].attachedActions).toEqual([
            expect.objectContaining({ uid: 'frog-action', defId: 'russian_fairy_tales_the_frog_princess', talentUsed: true }),
        ]);
        expect(used.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-action', 'host']);
        expect(used.finalState.core.players['0'].discard).toEqual([]);
    });

    it('生命之水把弃牌堆随从放到牌库顶并授予额外行动', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-action', 'russian_fairy_tales_transformation', 'action', '0')],
                    discard: [makeCard('discard-minion', 'russian_fairy_tales_tsar_eagle', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('russian_fairy_tales_the_water_of_life', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'water',
            defId: 'russian_fairy_tales_the_water_of_life',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 20,
        });
        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.cardUid === 'discard-minion',
            'choose discard minion for 生命之水',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['discard-minion', 'deck-action']);
        expect(resolved.finalState.core.players['0'].discard).toEqual([]);
        expect(resolved.events.some(event => event.type === SU_EVENTS.LIMIT_MODIFIED && (event as any).payload.limitType === 'action')).toBe(true);
    });

    it('生命之水处理借来的弃牌堆随从时，按卡面放回当前玩家牌库顶', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('p0-deck', 'russian_fairy_tales_transformation', 'action', '0')],
                    discard: [makeCard('borrowed-water', 'russian_fairy_tales_tsar_eagle', 'minion', '1')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('p1-deck', 'russian_fairy_tales_the_water_of_life', 'action', '1')],
                }),
            },
        });
        const result = invokeRegisteredAbilityContract('russian_fairy_tales_the_water_of_life', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'water-borrowed',
            defId: 'russian_fairy_tales_the_water_of_life',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 21,
        });
        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.cardUid === 'borrowed-water',
            '生命之水选择借来的弃牌堆随从',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['borrowed-water', 'p0-deck']);
        expect(resolved.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['p1-deck']);
    });

    it('我不知道要拿什么展示到两张行动，并可只把选择的行动加入手牌后洗回其余牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('minion-1', 'russian_fairy_tales_tsar_eagle', 'minion', '0'),
                        makeCard('action-1', 'russian_fairy_tales_the_water_of_life', 'action', '0'),
                        makeCard('minion-2', 'russian_fairy_tales_toad', 'minion', '0'),
                        makeCard('action-2', 'russian_fairy_tales_transformation', 'action', '0'),
                        makeCard('tail', 'russian_fairy_tales_baba_yaga', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('russian_fairy_tales_fetch_i_know_not_what', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'fetch',
            defId: 'russian_fairy_tales_fetch_i_know_not_what',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 30,
        });
        expect(result.events.find(event => event.type === SU_EVENTS.REVEAL_DECK_TOP)).toEqual(expect.objectContaining({
            payload: expect.objectContaining({ count: 4 }),
        }));
        const prompt = getSimpleChoicePrompt(result.matchState!, 'russian_fairy_tales_fetch_i_know_not_what');
        const actionOne = prompt.options.find((option: any) => option.value?.cardUid === 'action-1');
        const resolved = respondToPromptOptions(result.matchState!, [actionOne.id], '0', FIXED_RANDOM);

        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['action-1']);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['minion-1', 'minion-2', 'action-2', 'tail']);
    });

    it('愚蠢的魔术师只整理本次抽出的三张牌，不会把原有手牌混入选择', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('hand-a', 'russian_fairy_tales_the_water_of_life', 'action', '0')],
                    deck: [
                        makeCard('draw-a', 'russian_fairy_tales_tsar_eagle', 'minion', '0'),
                        makeCard('draw-b', 'russian_fairy_tales_toad', 'minion', '0'),
                        makeCard('draw-c', 'russian_fairy_tales_baba_yaga', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('russian_fairy_tales_foolish_magician', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'foolish',
            defId: 'russian_fairy_tales_foolish_magician',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 35,
        });
        const drawEvents = result.events.filter(event => !isAbilityRuntimeContinuationEvent(event as any));
        const continuation = result.events.find(event => isAbilityRuntimeContinuationEvent(event as any));

        expect(drawEvents).toEqual([
            expect.objectContaining({
                type: SU_EVENTS.CARDS_DRAWN,
                payload: expect.objectContaining({ cardUids: ['draw-a', 'draw-b', 'draw-c'] }),
            }),
        ]);
        expect(continuation).toBeTruthy();
        expect(result.matchState).toBeUndefined();

        const resumed = resumeAbilityRuntimeContinuationEvent(
            makeMatchState(applyEvents(core, drawEvents as any)),
            continuation as any,
            FIXED_RANDOM,
        );
        const prompt = getSimpleChoicePrompt(resumed!.state, 'russian_fairy_tales_foolish_magician');
        const promptCardUids = new Set(prompt.options.map((option: any) => option.value?.cardUid));
        expect(promptCardUids).toEqual(new Set(['draw-a', 'draw-b', 'draw-c']));

        const selectedOptionIds = [
            prompt.options.find((option: any) => option.value?.cardUid === 'draw-a' && option.value?.placement === 'bottom')!.id,
            prompt.options.find((option: any) => option.value?.cardUid === 'draw-b' && option.value?.placement === 'bottom')!.id,
            prompt.options.find((option: any) => option.value?.cardUid === 'draw-c' && option.value?.placement === 'top')!.id,
        ];
        const resolved = respondToPromptOptions(resumed!.state, selectedOptionIds, '0', FIXED_RANDOM);

        expect(resolved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: SU_EVENTS.CARD_TO_DECK_BOTTOM, payload: expect.objectContaining({ cardUid: 'draw-a' }) }),
            expect.objectContaining({ type: SU_EVENTS.CARD_TO_DECK_BOTTOM, payload: expect.objectContaining({ cardUid: 'draw-b' }) }),
            expect.objectContaining({ type: SU_EVENTS.CARD_TO_DECK_TOP, payload: expect.objectContaining({ cardUid: 'draw-c' }) }),
        ]));
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['hand-a']);
    });

    it('愚蠢的魔术师整理借来的抽牌时，按卡面放回当前玩家牌库', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('borrowed-draw', 'russian_fairy_tales_tsar_eagle', 'minion', '1'),
                        makeCard('draw-b', 'russian_fairy_tales_toad', 'minion', '0'),
                        makeCard('draw-c', 'russian_fairy_tales_baba_yaga', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('russian_fairy_tales_foolish_magician', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'foolish-borrowed',
            defId: 'russian_fairy_tales_foolish_magician',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 36,
        });
        const drawEvents = result.events.filter(event => !isAbilityRuntimeContinuationEvent(event as any));
        const continuation = result.events.find(event => isAbilityRuntimeContinuationEvent(event as any));
        const resumed = resumeAbilityRuntimeContinuationEvent(
            makeMatchState(applyEvents(core, drawEvents as any)),
            continuation as any,
            FIXED_RANDOM,
        );
        const prompt = getSimpleChoicePrompt(resumed!.state, 'russian_fairy_tales_foolish_magician');
        const selectedOptionIds = [
            prompt.options.find((option: any) => option.value?.cardUid === 'borrowed-draw' && option.value?.placement === 'top')!.id,
            prompt.options.find((option: any) => option.value?.cardUid === 'draw-b' && option.value?.placement === 'bottom')!.id,
            prompt.options.find((option: any) => option.value?.cardUid === 'draw-c' && option.value?.placement === 'bottom')!.id,
        ];
        const resolved = respondToPromptOptions(resumed!.state, selectedOptionIds, '0', FIXED_RANDOM);

        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['borrowed-draw', 'draw-b', 'draw-c']);
        expect(resolved.finalState.core.players['1'].deck).toEqual([]);
    });

    it('去看看我妹妹在己方随从打出到附着基地后可抽一张牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw-card', 'russian_fairy_tales_the_water_of_life', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_transformation_spring',
                    minions: [makeMinion('played', 'russian_fairy_tales_tsar_eagle', '0', 2)],
                    ongoingActions: [{ uid: 'sister-action', defId: 'russian_fairy_tales_go_see_my_sister', ownerId: '0', talentUsed: false } as any],
                }),
            ],
        });

        const queued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'played',
            triggerMinionDefId: 'russian_fairy_tales_tsar_eagle',
            triggerMinion: core.bases[0].minions[0],
            random: FIXED_RANDOM,
            now: 40,
        });
        expect(queued?.payload.triggers.map(trigger => trigger.sourceDefId)).toContain('russian_fairy_tales_go_see_my_sister');

        const prompted = maybeResolveReactionQueue(
            makeMatchState({ ...core, triggerQueue: queued!.payload.triggers } as any),
            FIXED_RANDOM,
            41,
        );
        const resolved = respondToPromptOption(
            prompted!.state,
            option => option.value?.triggerId === queued!.payload.triggers[0].id,
            'choose 去看看我妹妹 trigger',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-card']);
    });

    it('我不知道能去何处会为每个其他玩家随机洗回该基地的一个随从', () => {
        const core = makeState({
            turnOrder: ['0', '1', '2'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', { deck: [makeCard('p1-deck', 'russian_fairy_tales_the_water_of_life', 'action', '1')] }),
                '2': makePlayer('2', { deck: [makeCard('p2-deck', 'russian_fairy_tales_the_water_of_life', 'action', '2')] }),
            },
            bases: [makeBase('base_transformation_spring', [
                makeMinion('p1-minion', 'pirate_first_mate', '1', 2),
                makeMinion('p2-minion', 'russian_fairy_tales_tsar_eagle', '2', 2),
            ])],
        });

        const result = invokeRegisteredAbilityContract('russian_fairy_tales_go_i_know_not_whither', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'go',
            defId: 'russian_fairy_tales_go_i_know_not_whither',
            baseIndex: 0,
            targetBaseIndex: 0,
            random: FIXED_RANDOM,
            now: 45,
        });
        const finalCore = applyEvents(core, result.events);

        expect(finalCore.bases[0].minions).toEqual([]);
        expect(finalCore.players['1'].deck.map(card => card.uid)).toEqual(['p1-deck', 'p1-minion']);
        expect(finalCore.players['2'].deck.map(card => card.uid)).toEqual(['p2-deck', 'p2-minion']);
    });

    it('沙皇之鹰既能把对手弃牌堆随从放到其牌库顶，也能选择抽牌', () => {
        const discardCore = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    discard: [makeCard('discard-minion', 'russian_fairy_tales_tsar_eagle', 'minion', '1')],
                }),
            },
        });
        const discardResult = invokeRegisteredAbilityContract('russian_fairy_tales_tsar_eagle', 'onPlay', {
            state: discardCore,
            matchState: makeMatchState(discardCore),
            playerId: '0',
            cardUid: 'eagle',
            defId: 'russian_fairy_tales_tsar_eagle',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 50,
        });
        const discardResolved = respondToPromptOption(
            discardResult.matchState!,
            option => option.value?.mode === 'deckTop',
            '沙皇之鹰选择对手弃牌堆随从',
            '0',
            FIXED_RANDOM,
        );
        expect(discardResolved.finalState.core.players['1'].discard).toEqual([]);
        expect(discardResolved.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['discard-minion']);

        const drawCore = makeState({
            players: {
                '0': makePlayer('0', { deck: [makeCard('draw-card', 'russian_fairy_tales_the_water_of_life', 'action', '0')] }),
                '1': makePlayer('1'),
            },
        });
        const drawResult = invokeRegisteredAbilityContract('russian_fairy_tales_tsar_eagle', 'onPlay', {
            state: drawCore,
            matchState: makeMatchState(drawCore),
            playerId: '0',
            cardUid: 'eagle',
            defId: 'russian_fairy_tales_tsar_eagle',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 51,
        });
        const drawResolved = respondToPromptOption(
            drawResult.matchState!,
            option => option.value?.mode === 'draw',
            '沙皇之鹰选择抽牌',
            '0',
            FIXED_RANDOM,
        );
        expect(drawResolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-card']);
    });

    it('沙皇之鹰处理借来的对手弃牌堆随从时，按卡面放入该对手牌库顶', () => {
        const core = makeState({
            turnOrder: ['0', '1', '2'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    deck: [makeCard('p1-deck', 'russian_fairy_tales_the_water_of_life', 'action', '1')],
                    discard: [makeCard('borrowed-eagle', 'russian_fairy_tales_tsar_eagle', 'minion', '2')],
                }),
                '2': makePlayer('2', {
                    deck: [makeCard('p2-deck', 'russian_fairy_tales_transformation', 'action', '2')],
                }),
            },
        });
        const result = invokeRegisteredAbilityContract('russian_fairy_tales_tsar_eagle', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'eagle-borrowed',
            defId: 'russian_fairy_tales_tsar_eagle',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 52,
        });
        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.cardUid === 'borrowed-eagle',
            '沙皇之鹰选择借来的对手弃牌堆随从',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['borrowed-eagle', 'p1-deck']);
        expect(resolved.finalState.core.players['1'].discard).toEqual([]);
        expect(resolved.finalState.core.players['2'].deck.map(card => card.uid)).toEqual(['p2-deck']);
    });

    it('灰色之狼会回到牌库顶，并把手牌随从作为额外随从打到原基地并放置 +1 指示物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('extra-minion', 'russian_fairy_tales_toad', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_transformation_spring', [
                makeMinion('wolf', 'russian_fairy_tales_the_gray_wolf', '0', 3),
            ])],
        });
        const result = invokeRegisteredAbilityContract('russian_fairy_tales_the_gray_wolf', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'wolf',
            defId: 'russian_fairy_tales_the_gray_wolf',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 52,
        });
        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.cardUid === 'extra-minion',
            '灰色之狼选择额外随从',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['wolf']);
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['extra-minion']);
        expect(resolved.finalState.core.bases[0].minions[0].powerCounters).toBe(1);
    });

    it('白桦木女神响应提交后可寻找白桦木进入手牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('birch-card', 'russian_fairy_tales_the_birch', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_transformation_spring', [
                    makeMinion('birch-woman', 'russian_fairy_tales_the_birch_woman', '0', 2),
                ]),
            ],
        });

        const queued = collectTriggers(core, 'onMinionDiscardedFromBase', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'birch-woman',
            triggerMinionDefId: 'russian_fairy_tales_the_birch_woman',
            triggerMinion: core.bases[0].minions[0],
            random: FIXED_RANDOM,
            now: 42,
        }, { sourceDefIds: ['russian_fairy_tales_the_birch_woman'] });
        expect(queued).toBeDefined();

        const prompted = maybeResolveReactionQueue(
            makeMatchState({ ...core, triggerQueue: queued!.payload.triggers } as any),
            FIXED_RANDOM,
            42,
        );
        const opened = respondToPromptOption(
            prompted!.state,
            option => option.value?.triggerId === queued!.payload.triggers[0].id,
            '白桦木女神可选触发',
            '0',
            FIXED_RANDOM,
        );
        const resolved = respondToPromptOption(
            opened.finalState,
            option => option.value?.cardUid === 'birch-card' && option.value?.mode === 'toHand',
            '白桦木加入手牌',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('birch-card');
        expect(resolved.finalState.core.players['0'].deck.some(card => card.uid === 'birch-card')).toBe(false);
    });

    it('着魔为宿主 +2，并在宿主回手离场后转移到另一个随从', () => {
        const core = makeState({
            bases: [
                makeBase('base_transformation_spring', [
                    makeMinion('host', 'russian_fairy_tales_tsar_eagle', '0', 2, {
                        attachedActions: [{ uid: 'bewitched-action', defId: 'russian_fairy_tales_bewitched', ownerId: '0', talentUsed: false }],
                    }),
                    makeMinion('target', 'russian_fairy_tales_tsar_eagle', '0', 2),
                ]),
            ],
        });

        expect(getMinionPower(core, core.bases[0].minions[0], 0)).toBe(4);

        const returned = {
            type: SU_EVENTS.MINION_RETURNED,
            payload: {
                minionUid: 'host',
                minionDefId: 'russian_fairy_tales_tsar_eagle',
                fromBaseIndex: 0,
                toPlayerId: '0',
                reason: 'test_return',
            },
            timestamp: 50,
        } as any;
        const processed = resolveCardsReturnedToHand(makeMatchState(core), '0', [returned], FIXED_RANDOM, 51);
        const queued = processed.events.find(event => event.type === SU_EVENTS.TRIGGER_QUEUED) as any;
        expect(queued).toBeDefined();
        const prompted = maybeResolveReactionQueue(
            makeMatchState({ ...processed.matchState!.core, triggerQueue: queued.payload.triggers } as any),
            FIXED_RANDOM,
            52,
        );
        const resolved = respondToPromptOption(
            prompted!.state,
            option => option.value?.minionUid === 'target',
            'transfer 着魔',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.finalState.core.bases[0].minions[0].uid).toBe('target');
        expect(resolved.finalState.core.bases[0].minions[0].attachedActions).toEqual([
            expect.objectContaining({ uid: 'bewitched-action', defId: 'russian_fairy_tales_bewitched' }),
        ]);
        expect(resolved.finalState.core.players['0'].discard).toEqual([]);
    });

    it('蟾蜍交给对手后，会把对手在此的另一个随从洗入其拥有者牌库', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_transformation_spring', [
                makeMinion('toad', 'russian_fairy_tales_toad', '0', 0),
                makeMinion('victim', 'pirate_first_mate', '1', 2),
            ])],
        });
        const result = invokeRegisteredAbilityContract('russian_fairy_tales_toad', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'toad',
            defId: 'russian_fairy_tales_toad',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 53,
        });
        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'victim',
            '蟾蜍选择交给对手并洗回目标随从',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.finalState.core.bases[0].minions.map(minion => ({ uid: minion.uid, controller: minion.controller }))).toEqual([
            { uid: 'toad', controller: '1' },
        ]);
        expect(resolved.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['victim']);
    });

    it('弥撒变化把每名玩家手牌放到牌库底后，再抽回同等数量的牌', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('p0-hand-a', 'russian_fairy_tales_toad', 'minion', '0'),
                        makeCard('p0-hand-b', 'russian_fairy_tales_baba_yaga', 'minion', '0'),
                    ],
                    deck: [
                        makeCard('p0-deck-a', 'russian_fairy_tales_the_water_of_life', 'action', '0'),
                        makeCard('p0-deck-b', 'russian_fairy_tales_transformation', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('p1-hand', 'russian_fairy_tales_toad', 'minion', '1')],
                    deck: [makeCard('p1-deck', 'russian_fairy_tales_the_water_of_life', 'action', '1')],
                }),
            },
        });
        const result = invokeRegisteredAbilityContract('russian_fairy_tales_mass_transformation', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'mass',
            defId: 'russian_fairy_tales_mass_transformation',
            baseIndex: 0,
            random: REVERSING_RANDOM,
            now: 54,
        });
        const finalCore = applyEvents(core, result.events);

        expect(finalCore.players['0'].hand.map(card => card.uid)).toEqual(['p0-deck-a', 'p0-deck-b']);
        expect(finalCore.players['0'].deck.map(card => card.uid)).toEqual(['p0-hand-a', 'p0-hand-b']);
        expect(finalCore.players['1'].hand.map(card => card.uid)).toEqual(['p1-deck']);
        expect(finalCore.players['1'].deck.map(card => card.uid)).toEqual(['p1-hand']);
    });

    it('弥撒变化在借来的手牌场景下按真实拥有者归还牌库，并仍让持牌玩家抽回同数量的牌', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('borrowed-hand', 'russian_fairy_tales_toad', 'minion', '1'),
                        makeCard('p0-hand', 'russian_fairy_tales_baba_yaga', 'minion', '0'),
                    ],
                    deck: [
                        makeCard('p0-deck-a', 'russian_fairy_tales_the_water_of_life', 'action', '0'),
                        makeCard('p0-deck-b', 'russian_fairy_tales_transformation', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('p1-deck', 'russian_fairy_tales_the_water_of_life', 'action', '1')],
                }),
            },
        });
        const result = invokeRegisteredAbilityContract('russian_fairy_tales_mass_transformation', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'mass',
            defId: 'russian_fairy_tales_mass_transformation',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 55,
        });
        const finalCore = applyEvents(core, result.events);

        expect(finalCore.players['0'].hand.map(card => card.uid)).toEqual(['p0-deck-a', 'p0-deck-b']);
        expect(finalCore.players['0'].deck.map(card => card.uid)).toEqual(['p0-hand']);
        expect(finalCore.players['0'].hand.some(card => card.uid === 'borrowed-hand')).toBe(false);
        expect(finalCore.players['1'].deck.map(card => card.uid)).toEqual(['p1-deck', 'borrowed-hand']);
        expect(finalCore.players['1'].hand).toEqual([]);
    });

    it('弥撒变化不会把正在打出的源行动卡纳入置底和抽牌范围', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('mass', 'russian_fairy_tales_mass_transformation', 'action', '0'),
                        makeCard('borrowed-hand', 'russian_fairy_tales_toad', 'minion', '1'),
                        makeCard('p0-hand', 'russian_fairy_tales_baba_yaga', 'minion', '0'),
                    ],
                    deck: [
                        makeCard('p0-deck-a', 'russian_fairy_tales_the_water_of_life', 'action', '0'),
                        makeCard('p0-deck-b', 'russian_fairy_tales_transformation', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('p1-deck', 'russian_fairy_tales_the_water_of_life', 'action', '1')],
                }),
            },
        });
        const result = invokeRegisteredAbilityContract('russian_fairy_tales_mass_transformation', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'mass',
            defId: 'russian_fairy_tales_mass_transformation',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 56,
        });
        const finalCore = applyEvents(core, result.events);

        expect(finalCore.players['0'].hand.map(card => card.uid)).toEqual(['mass', 'p0-deck-a', 'p0-deck-b']);
        expect(finalCore.players['0'].deck.map(card => card.uid)).toEqual(['p0-hand']);
        expect(finalCore.players['1'].deck.map(card => card.uid)).toEqual(['p1-deck', 'borrowed-hand']);
    });

    it('巨型芜菁每有一个随从降低 1 临界点', () => {
        const empty = makeState({ bases: [makeBase('base_giant_turnip')] });
        const one = makeState({
            bases: [makeBase('base_giant_turnip', [
                makeMinion('a', 'russian_fairy_tales_tsar_eagle', '0', 2),
            ])],
        });
        const three = makeState({
            bases: [makeBase('base_giant_turnip', [
                makeMinion('a', 'russian_fairy_tales_tsar_eagle', '0', 2),
                makeMinion('b', 'pirate_first_mate', '1', 2),
                makeMinion('c', 'russian_fairy_tales_toad', '0', 0),
            ])],
        });

        expect(getEffectiveBreakpoint(empty, 0)).toBe(30);
        expect(getEffectiveBreakpoint(one, 0)).toBe(29);
        expect(getEffectiveBreakpoint(three, 0)).toBe(27);
    });

    it('变形之泉在随从打出后可把该随从变形成牌库顶随从，并记录每回合一次', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('deck-action', 'russian_fairy_tales_the_water_of_life', 'action', '0'),
                        makeCard('deck-minion', 'russian_fairy_tales_tsar_eagle', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_transformation_spring', [
                    makeMinion('played', 'pirate_first_mate', '0', 2),
                ]),
            ],
        });

        const result = triggerBaseAbilityWithMS('base_transformation_spring', 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            baseDefId: 'base_transformation_spring',
            minionUid: 'played',
            minionDefId: 'pirate_first_mate',
            minionPower: 2,
            random: FIXED_RANDOM,
            now: 60,
        });
        const finalCore = applyEvents(core, result.events);

        expect(finalCore.bases[0].minions.map(minion => minion.uid)).toEqual(['deck-minion']);
        expect(finalCore.players['0'].deck.map(card => card.uid)).toEqual(['deck-action', 'played']);
        expect(finalCore.bases[0].metadata?.transformationSpringUsedTurn_0).toBe(1);
    });

    it('变形之泉通过基地触发收集器可收到正式运行态并进入反应队列', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_transformation_spring', [
                makeMinion('played', 'pirate_first_mate', '0', 2),
            ])],
        });
        const matchState = makeMatchState(core);

        const queued = collectBaseAbilityTriggers({
            core,
            matchState,
            timing: 'onMinionPlayed',
            ownerPlayerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'played',
            triggerMinionDefId: 'pirate_first_mate',
            triggerMinionPower: 2,
            frameId: 'test-frame',
            sourceEventId: 'test-event',
            now: 61,
        });

        expect(queued?.payload.triggers).toEqual(expect.arrayContaining([
            expect.objectContaining({
                sourceDefId: 'base_transformation_spring',
                triggerMinionUid: 'played',
            }),
        ]));
    });

    it('白桦木在拥有者回合开始可自毁，并把白桦木女神作为额外随从打到原基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('birch-woman-card', 'russian_fairy_tales_the_birch_woman', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_transformation_spring', [
                makeMinion('birch', 'russian_fairy_tales_the_birch', '0', 2),
            ])],
        });
        const queued = collectTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            frameId: 'turn-start:0:1',
            sourceEventId: 'turn-start:0:1',
            random: FIXED_RANDOM,
            now: 65,
        });
        expect(queued).toBeDefined();
        const prompted = maybeResolveReactionQueue(
            makeMatchState({ ...core, triggerQueue: queued!.payload.triggers } as any),
            FIXED_RANDOM,
            65,
        );
        const opened = respondToPromptOption(
            prompted!.state,
            option => option.value?.triggerId === queued!.payload.triggers[0].id,
            '选择白桦木回合开始触发',
            '0',
            FIXED_RANDOM,
        );
        const resolved = respondToPromptOption(
            opened.finalState,
            option => option.value?.cardUid === 'birch-woman-card' && option.value?.mode === 'play',
            '白桦木女神作为额外随从打出',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['birch-woman-card']);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toContain('birch');
        expect(resolved.finalState.core.players['0'].deck).toEqual([]);
    });

    it('芬尼斯特猎鹰计分前可从其他基地移动到计分基地', () => {
        const core = makeState({
            scoringEligibleBaseIndices: [1],
            bases: [
                makeBase('base_transformation_spring', [
                    makeMinion('finist', 'russian_fairy_tales_finist_the_falcon', '0', 4),
                ]),
                makeBase('base_giant_turnip'),
            ],
        });

        const result = invokeRegisteredAbilityContract('russian_fairy_tales_finist_the_falcon', 'special', {
            state: core,
            matchState: { ...makeMatchState(core), sys: { ...makeMatchState(core).sys, phase: 'scoreBases' } },
            playerId: '0',
            cardUid: 'finist',
            defId: 'russian_fairy_tales_finist_the_falcon',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 70,
        });
        const finalCore = applyEvents(core, result.events);

        expect(finalCore.bases[0].minions).toEqual([]);
        expect(finalCore.bases[1].minions.map(minion => minion.uid)).toEqual(['finist']);
    });

    it('芬尼斯特猎鹰已在计分基地时可回手并作为额外随从打到另一个基地', () => {
        const core = makeState({
            scoringEligibleBaseIndices: [0],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_transformation_spring', [
                    makeMinion('finist', 'russian_fairy_tales_finist_the_falcon', '0', 4),
                ]),
                makeBase('base_giant_turnip'),
            ],
        });
        const result = invokeRegisteredAbilityContract('russian_fairy_tales_finist_the_falcon', 'special', {
            state: core,
            matchState: { ...makeMatchState(core), sys: { ...makeMatchState(core).sys, phase: 'scoreBases' } },
            playerId: '0',
            cardUid: 'finist',
            defId: 'russian_fairy_tales_finist_the_falcon',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 70,
        });
        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.baseIndex === 1,
            '芬尼斯特猎鹰选择额外打出的基地',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.finalState.core.bases[0].minions).toEqual([]);
        expect(resolved.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['finist']);
    });

    it('被借来控制的芬尼斯特猎鹰应回到控制者手牌后再作为额外随从打出，并保留真实 owner', () => {
        const core = makeState({
            scoringEligibleBaseIndices: [0],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_transformation_spring', [
                    makeMinion('borrowed-finist', 'russian_fairy_tales_finist_the_falcon', '1', 4, { owner: '0' }),
                ]),
                makeBase('base_giant_turnip'),
            ],
        });
        const result = invokeRegisteredAbilityContract('russian_fairy_tales_finist_the_falcon', 'special', {
            state: core,
            matchState: { ...makeMatchState(core), sys: { ...makeMatchState(core).sys, phase: 'scoreBases' } },
            playerId: '1',
            cardUid: 'borrowed-finist',
            defId: 'russian_fairy_tales_finist_the_falcon',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 71,
        });
        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.baseIndex === 1,
            '借来芬尼斯特猎鹰选择额外打出的基地',
            '1',
            FIXED_RANDOM,
        );

        expect(resolved.finalState.core.bases[0].minions).toEqual([]);
        expect(resolved.finalState.core.bases[1].minions).toEqual([
            expect.objectContaining({ uid: 'borrowed-finist', controller: '1', owner: '0' }),
        ]);
        expect(resolved.finalState.core.players['0'].hand).toEqual([]);
        expect(resolved.finalState.core.players['1'].hand).toEqual([]);
    });
});
