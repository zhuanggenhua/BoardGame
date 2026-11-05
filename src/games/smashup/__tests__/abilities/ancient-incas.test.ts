import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { ANCIENT_INCAS_BASES, ANCIENT_INCAS_CARDS } from '../../data/factions/ancient_incas';
import { collectTriggers } from '../../domain/ongoingEffects';
import { collectBaseAbilityTriggers } from '../../domain/baseAbilityQueue';
import { getEffectiveBaseAbilitySourceIds } from '../../domain/effectiveBaseAbilities';
import { getEffectiveBreakpoint, getPlayerEffectivePowerOnBase } from '../../domain/ongoingModifiers';
import { maybeResolveReactionQueue } from '../../domain/reactionQueue';
import { SU_EVENTS } from '../../domain/types';
import {
    applyEvents,
    expectRegisteredAbilityContract,
    expectRegisteredInteractionHandlerContract,
    getPromptOption,
    getPromptOptions,
    getSimpleChoicePrompt,
    getPromptsBySourceId,
    expectNoPrompt,
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

const FIXED_RANDOM = {
    random: () => 0,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(items: T[]) => [...items],
};

describe('古代印加人代表性玩法行为', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('静态牌组合同保持 12 张唯一卡面、20 张实体牌、2 张基地', () => {
        expect(ANCIENT_INCAS_CARDS).toHaveLength(12);
        expect(ANCIENT_INCAS_CARDS.reduce((total, card) => total + card.count, 0)).toBe(20);
        expect(ANCIENT_INCAS_CARDS.map(card => card.previewRef?.index).sort((a, b) => Number(a) - Number(b))).toEqual(
            Array.from({ length: 12 }, (_value, index) => index + 47),
        );
        expect(ANCIENT_INCAS_BASES.map(base => base.id).sort()).toEqual([
            'base_cuzcu',
            'base_machu_picchu',
        ]);
    });

    it('古代印加人本批 L2 能力入口与交互续算已注册', () => {
        const registrations = [
            ['ancient_incas_quipu_strings', 'onPlay'],
            ['ancient_incas_llama', 'onPlay'],
            ['ancient_incas_incan_engineer', 'onPlay'],
            ['ancient_incas_sapa_inca', 'onPlay'],
            ['ancient_incas_fortress_walls', 'onPlay'],
            ['ancient_incas_temple_of_the_sun', 'onPlay'],
            ['ancient_incas_signs_in_the_stars', 'onPlay'],
            ['ancient_incas_signs_in_the_stars', 'talent'],
            ['ancient_incas_golden_condor', 'onPlay'],
            ['ancient_incas_ashlar_masonry', 'special'],
            ['ancient_incas_royal_highway', 'onPlay'],
        ] as const;

        for (const [defId, tag] of registrations) {
            expect(expectRegisteredAbilityContract(defId, tag), `${defId}::${tag}`).toBeTypeOf('function');
        }

        for (const sourceId of [
            'ancient_incas_quipu_strings',
            'ancient_incas_llama',
            'ancient_incas_sapa_inca',
            'ancient_incas_golden_condor',
            'ancient_incas_ashlar_masonry',
            'ancient_incas_fortress_walls',
            'ancient_incas_fortress_walls_counter',
            'ancient_incas_sapa_inca_counter',
            'ancient_incas_royal_highway',
            'ancient_incas_royal_highway_move',
        ]) {
            expect(expectRegisteredInteractionHandlerContract(sourceId), sourceId).toBeTypeOf('function');
        }
        expect(expectRegisteredInteractionHandlerContract('ancient_incas_signs_in_the_stars_turn_start')).toBeTypeOf('function');
    });

    it('星星上的征兆把牌库顶基地能力接到当前基地，并随天赋后的新顶牌动态变化', () => {
        const core = makeState({
            baseDeck: ['base_machu_picchu', 'base_cuzcu'],
            bases: [makeBase({
                defId: 'test_base',
                ongoingActions: [{ uid: 'signs', defId: 'ancient_incas_signs_in_the_stars', ownerId: '0' }],
            })],
            players: {
                '0': makePlayer('0', { deck: [makeCard('draw-card', 'ancient_incas_llama', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
        });

        const onPlay = invokeRegisteredAbilityContract('ancient_incas_signs_in_the_stars', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'signs',
            defId: 'ancient_incas_signs_in_the_stars',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 5,
        });
        const active = applyEvents(core, onPlay.events);
        expect(active.bases[0].metadata?.signsInTheStarsSourceUid).toBe('signs');
        expect(getEffectiveBaseAbilitySourceIds(active, 0)).toEqual(['test_base', 'base_machu_picchu']);

        const queued = collectBaseAbilityTriggers({
            core: active,
            timing: 'onActionPlayed',
            ownerPlayerId: '0',
            baseIndex: 0,
            actionTargetBaseIndex: 0,
            actionTargetType: 'base',
            triggerCardUid: 'action',
            triggerCardDefId: 'ancient_incas_temple_of_the_sun',
            triggerCardOwnerId: '0',
            now: 6,
        });
        expect(queued?.payload.triggers.map(trigger => trigger.sourceDefId)).toContain('base_machu_picchu');
        const resolved = maybeResolveReactionQueue(
            makeMatchState({ ...active, triggerQueue: queued!.payload.triggers } as any),
            FIXED_RANDOM,
            6,
        );
        expect(resolved?.state.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-card']);

        const talent = invokeRegisteredAbilityContract('ancient_incas_signs_in_the_stars', 'talent', {
            state: active,
            matchState: makeMatchState(active),
            playerId: '0',
            cardUid: 'signs',
            defId: 'ancient_incas_signs_in_the_stars',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 7,
        });
        const afterTalent = applyEvents(active, talent.events);
        expect(afterTalent.baseDeck).toEqual(['base_cuzcu', 'base_machu_picchu']);
        expect(getEffectiveBaseAbilitySourceIds(afterTalent, 0)).toEqual(['test_base', 'base_cuzcu']);
        expect(collectBaseAbilityTriggers({
            core: afterTalent,
            timing: 'onActionPlayed',
            ownerPlayerId: '0',
            baseIndex: 0,
            actionTargetBaseIndex: 0,
            actionTargetType: 'base',
            triggerCardUid: 'action-2',
            triggerCardDefId: 'ancient_incas_temple_of_the_sun',
            triggerCardOwnerId: '0',
            now: 8,
        })).toBeUndefined();
    });

    it('星星上的征兆在每名玩家回合开始可翻面关闭，下一回合自动恢复，离场后不残留', () => {
        const core = makeState({
            baseDeck: ['base_machu_picchu'],
            bases: [makeBase({
                defId: 'test_base',
                ongoingActions: [{ uid: 'signs', defId: 'ancient_incas_signs_in_the_stars', ownerId: '0' }],
                metadata: {
                    signsInTheStarsSourceUid: 'signs',
                    signsInTheStarsFaceDownUntilTurn: null,
                },
            })],
        });
        const turnStartQueued = collectTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            frameId: 'turn-start:0:1',
            sourceEventId: 'turn-start:0:1',
            random: FIXED_RANDOM,
            now: 10,
        });
        const opponentTurnStartQueued = collectTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            frameId: 'turn-start:1:1',
            sourceEventId: 'turn-start:1:1',
            random: FIXED_RANDOM,
            now: 11,
        });
        expect(opponentTurnStartQueued?.payload.triggers.some(trigger => (
            trigger.sourceCardUid === 'signs'
            && trigger.ownerPlayerId === '1'
        ))).toBe(true);
        const prompted = maybeResolveReactionQueue(
            makeMatchState({ ...core, triggerQueue: turnStartQueued!.payload.triggers } as any),
            FIXED_RANDOM,
            10,
        );
        const selectedTrigger = respondToPromptOption(
            prompted!.state,
            option => option.value?.triggerId === turnStartQueued!.payload.triggers[0].id,
            '选择星星上的征兆回合开始触发',
            '0',
            FIXED_RANDOM,
        );
        const turnedDown = respondToPromptOption(
            selectedTrigger.finalState,
            option => option.value?.faceDown === true,
            '翻面关闭星星上的征兆',
            '0',
            FIXED_RANDOM,
        );
        expect(turnedDown.finalState.core.bases[0].metadata?.signsInTheStarsFaceDownUntilTurn).toBe(1);
        expect(getEffectiveBaseAbilitySourceIds(turnedDown.finalState.core, 0)).toEqual(['test_base']);

        const nextTurn = { ...turnedDown.finalState.core, turnNumber: 2 };
        expect(getEffectiveBaseAbilitySourceIds(nextTurn, 0)).toEqual(['test_base', 'base_machu_picchu']);
        const removed = {
            ...nextTurn,
            bases: [{ ...nextTurn.bases[0], ongoingActions: [] }],
        };
        expect(getEffectiveBaseAbilitySourceIds(removed, 0)).toEqual(['test_base']);
    });

    it('金色秃鹰把选回的行动逐张绑定为不可跳过的额外出牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('condor', 'ancient_incas_golden_condor', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_machu_picchu',
                ongoingActions: [
                    { uid: 'action-a', defId: 'ancient_incas_temple_of_the_sun', ownerId: '0' },
                    { uid: 'action-b', defId: 'ancient_incas_fortress_walls', ownerId: '0' },
                ],
            })],
        });

        const result = invokeRegisteredAbilityContract('ancient_incas_golden_condor', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'condor',
            defId: 'ancient_incas_golden_condor',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 50,
        });
        const prompt = getSimpleChoicePrompt(result.matchState!, 'ancient_incas_golden_condor');
        const selectedIds = [
            getPromptOption(prompt, option => option.value?.cardUid === 'action-a', 'select action-a').id,
            getPromptOption(prompt, option => option.value?.cardUid === 'action-b', 'select action-b').id,
        ];
        const resolved = respondToPromptOptions(result.matchState!, selectedIds, '0', FIXED_RANDOM);
        const limitEvents = resolved.events.filter(event => event.type === SU_EVENTS.LIMIT_MODIFIED) as Array<Extract<SmashUpEvent, { type: typeof SU_EVENTS.LIMIT_MODIFIED }>>;

        expect(limitEvents).toHaveLength(2);
        expect(limitEvents.map(event => event.payload)).toEqual([
            expect.objectContaining({
                reason: 'ancient_incas_golden_condor',
                playTiming: 'immediate',
                restrictToCardUid: 'action-a',
                restrictToCardDefId: 'ancient_incas_temple_of_the_sun',
                allowSkip: false,
            }),
            expect.objectContaining({
                reason: 'ancient_incas_golden_condor',
                playTiming: 'immediate',
                restrictToCardUid: 'action-b',
                restrictToCardDefId: 'ancient_incas_fortress_walls',
                allowSkip: false,
            }),
        ]);

        const interactions = [
            ...getPromptsBySourceId(resolved.finalState, 'smashup_immediate_extra_action'),
            ...getPromptsBySourceId(resolved.finalState, 'smashup_immediate_extra_action_base'),
            ...getPromptsBySourceId(resolved.finalState, 'smashup_immediate_extra_action_minion'),
        ];
        expect(interactions.length).toBeGreaterThanOrEqual(2);
        expect(getPromptOptions(interactions[0]).some(option => option.value?.skip === true)).toBe(false);
        expect(getPromptOptions(interactions[0]).map(option => option.value?.cardUid)).toEqual(['action-a']);
        expect(getPromptOptions(interactions[1]).some(option => option.value?.skip === true)).toBe(false);
        expect(getPromptOptions(interactions[1]).map(option => option.value?.cardUid)).toEqual(['action-b']);
    });

    it('结绳文字从弃牌堆额外打出太阳神庙到基地，并结算太阳神庙抽牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw-card', 'ancient_incas_llama', 'minion', '0')],
                    discard: [makeCard('temple', 'ancient_incas_temple_of_the_sun', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_machu_picchu')],
        });

        const result = invokeRegisteredAbilityContract('ancient_incas_quipu_strings', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'quipu',
            defId: 'ancient_incas_quipu_strings',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.cardUid === 'temple' && option.value?.baseIndex === 0,
            'choose 太阳神庙 for 结绳文字',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.ACTION_PLAYED,
                payload: expect.objectContaining({
                    cardUid: 'temple',
                    defId: 'ancient_incas_temple_of_the_sun',
                    fromDiscard: true,
                    isExtraAction: true,
                }),
            }),
            expect.objectContaining({
                type: SU_EVENTS.ONGOING_ATTACHED,
                payload: expect.objectContaining({ cardUid: 'temple', targetBaseIndex: 0 }),
            }),
        ]));
        expect(resolved.finalState.core.bases[0].ongoingActions.map(action => action.uid)).toEqual(['temple']);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-card']);
        expect(resolved.finalState.core.players['0'].discard).toEqual([]);
    });

    it('印加工程师展示到第一张可打到基地的行动，将其加入手牌并洗回其余牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('top-minion', 'ancient_incas_llama', 'minion', '0'),
                        makeCard('found-action', 'ancient_incas_fortress_walls', 'action', '0'),
                        makeCard('tail-minion', 'ancient_incas_sapa_inca', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('ancient_incas_incan_engineer', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'engineer',
            defId: 'ancient_incas_incan_engineer',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 20,
        });
        const finalCore = applyEvents(core, result.events);

        expect(result.events.find(event => event.type === SU_EVENTS.REVEAL_DECK_TOP)).toEqual(expect.objectContaining({
            payload: expect.objectContaining({ count: 2 }),
        }));
        expect(finalCore.players['0'].hand.map(card => card.uid)).toEqual(['found-action']);
        expect(finalCore.players['0'].deck.map(card => card.uid)).toEqual(['top-minion', 'tail-minion']);
    });

    it('太阳神庙在己方打出另一个行动到同基地后可抽一张牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw-card', 'ancient_incas_llama', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_machu_picchu',
                minions: [],
                ongoingActions: [{ uid: 'temple', defId: 'ancient_incas_temple_of_the_sun', ownerId: '0' }],
            })],
        });

        const queued = collectTriggers(core, 'onActionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            actionTargetBaseIndex: 0,
            actionTargetType: 'base',
            triggerCardUid: 'other-action',
            triggerCardDefId: 'ancient_incas_fortress_walls',
            triggerCardOwnerId: '0',
            random: FIXED_RANDOM,
            now: 30,
        });
        expect(queued?.payload.triggers.map(trigger => trigger.sourceDefId)).toContain('ancient_incas_temple_of_the_sun');

        const prompted = maybeResolveReactionQueue(
            makeMatchState({ ...core, triggerQueue: queued!.payload.triggers } as any),
            FIXED_RANDOM,
            31,
        );
        const selectedTrigger = respondToPromptOption(
            prompted!.state,
            option => option.value?.triggerId === queued!.payload.triggers[0].id,
            'choose 太阳神庙 trigger',
            '0',
            FIXED_RANDOM,
        );

        expect(selectedTrigger.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-card']);
    });

    it('太阳之子响应提交后授予额外行动，并在同回合写入已触发标记', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_machu_picchu', [
                makeMinion('child', 'ancient_incas_child_of_the_sun', '0', 2),
            ])],
        });

        const queued = collectTriggers(core, 'onActionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            actionTargetBaseIndex: 0,
            actionTargetType: 'base',
            triggerCardUid: 'played-action',
            triggerCardDefId: 'ancient_incas_temple_of_the_sun',
            triggerCardOwnerId: '0',
            random: FIXED_RANDOM,
            now: 35,
        });
        const childTrigger = queued?.payload.triggers.find(trigger => trigger.sourceDefId === 'ancient_incas_child_of_the_sun');
        expect(childTrigger).toBeDefined();

        const prompted = maybeResolveReactionQueue(
            makeMatchState({ ...core, triggerQueue: queued!.payload.triggers } as any),
            FIXED_RANDOM,
            36,
        );
        const resolved = respondToPromptOption(
            prompted!.state,
            option => option.value?.triggerId === childTrigger!.id,
            'choose 太阳之子 trigger',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({
                playerId: '0',
                limitType: 'action',
                delta: 1,
                reason: 'ancient_incas_child_of_the_sun',
            }),
        }));
        expect(resolved.finalState.core.players['0'].actionLimit).toBe(2);
        expect(resolved.finalState.core.bases[0].minions[0].metadata?.ancientIncasChildOfTheSunTriggeredTurn).toBe(1);

        const duplicate = collectTriggers(resolved.finalState.core, 'onActionPlayed', {
            state: resolved.finalState.core,
            matchState: resolved.finalState,
            playerId: '0',
            baseIndex: 0,
            actionTargetBaseIndex: 0,
            actionTargetType: 'base',
            triggerCardUid: 'second-action',
            triggerCardDefId: 'ancient_incas_fortress_walls',
            triggerCardOwnerId: '0',
            random: FIXED_RANDOM,
            now: 37,
        });
        expect(duplicate?.payload.triggers.some(trigger => trigger.sourceDefId === 'ancient_incas_child_of_the_sun')).not.toBe(true);
    });

    it('萨帕·印加在己方行动打到基地后给该基地己方随从放置指示物', () => {
        const core = makeState({
            bases: [
                makeBase('base_machu_picchu', [
                    makeMinion('sapa', 'ancient_incas_sapa_inca', '0', 5),
                ]),
                makeBase('base_cuzcu', [
                    makeMinion('target', 'ancient_incas_llama', '0', 2),
                ]),
            ],
        });

        const queued = collectTriggers(core, 'onActionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 1,
            actionTargetBaseIndex: 1,
            actionTargetType: 'base',
            triggerCardUid: 'played-action',
            triggerCardDefId: 'ancient_incas_temple_of_the_sun',
            triggerCardOwnerId: '0',
            random: FIXED_RANDOM,
            now: 40,
        });
        expect(queued?.payload.triggers.map(trigger => trigger.sourceDefId)).toContain('ancient_incas_sapa_inca');

        const resolved = maybeResolveReactionQueue(
            makeMatchState({ ...core, triggerQueue: queued!.payload.triggers } as any),
            FIXED_RANDOM,
            41,
        );

        expect(resolved).toBeDefined();
        const selected = respondToPromptOption(
            resolved!.state,
            option => option.value?.minionUid === 'target' && option.value?.baseIndex === 1,
            'choose 萨帕·印加 counter target',
            '0',
            FIXED_RANDOM,
        );

        expect(selected.finalState.core.bases[1].minions[0].powerCounters).toBe(1);
    });

    it('萨帕·印加只从牌库或弃牌堆检索可打到基地的行动并加入手牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('deck-action', 'ancient_incas_temple_of_the_sun', 'action', '0'),
                        makeCard('deck-minion', 'ancient_incas_llama', 'minion', '0'),
                    ],
                    discard: [
                        makeCard('discard-action', 'ancient_incas_armory', 'action', '0'),
                        makeCard('discard-special', 'ancient_incas_ashlar_masonry', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_machu_picchu')],
        });

        const result = invokeRegisteredAbilityContract('ancient_incas_sapa_inca', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'sapa',
            defId: 'ancient_incas_sapa_inca',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 39,
        });
        const prompt = getSimpleChoicePrompt(result.matchState!, 'ancient_incas_sapa_inca');
        const options = getPromptOptions(prompt);

        expect(options.map(option => option.value?.cardUid)).toEqual(['deck-action', 'discard-action']);
        expect(options.map(option => option.value?.zone)).toEqual(['deck', 'discard']);

        const selected = respondToPromptOption(
            result.matchState!,
            option => option.value?.cardUid === 'discard-action',
            '从弃牌堆检索萨帕·印加行动',
            '0',
            FIXED_RANDOM,
        );

        expect(selected.events.some(event => event.type === SU_EVENTS.CARD_TRANSFERRED)).toBe(true);
        expect(selected.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['discard-action']);
        expect(selected.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['discard-special']);
        expect(selected.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-action', 'deck-minion']);
        expectNoPrompt(selected.finalState);
    });

    it('防护墙打出时只允许给这里的己方随从放置指示物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_cuzcu',
                minions: [
                    makeMinion('own', 'ancient_incas_llama', '0', 2),
                    makeMinion('enemy', 'pirate_first_mate', '1', 2),
                ],
            })],
        });

        const result = invokeRegisteredAbilityContract('ancient_incas_fortress_walls', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'fortress',
            defId: 'ancient_incas_fortress_walls',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 60,
        });
        const prompt = getSimpleChoicePrompt(result.matchState!, 'ancient_incas_fortress_walls');
        const options = getPromptOptions(prompt);

        expect(options.some(option => option.value?.minionUid === 'own')).toBe(true);
        expect(options.some(option => option.value?.minionUid === 'enemy')).toBe(false);
        expect(options.some(option => option.value?.skip === true)).toBe(false);

        const selected = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'own' && option.value?.baseIndex === 0,
            '防护墙打出时选择己方随从',
            '0',
            FIXED_RANDOM,
        );

        expect(selected.finalState.core.bases[0].minions.find(minion => minion.uid === 'own')?.powerCounters).toBe(1);
        expect(selected.finalState.core.bases[0].minions.find(minion => minion.uid === 'enemy')?.powerCounters ?? 0).toBe(0);
        expectNoPrompt(selected.finalState);
    });

    it('防护墙持续效果只响应同基地己方的其它行动，并允许跳过或选择目标', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_cuzcu',
                    minions: [
                        makeMinion('own', 'ancient_incas_llama', '0', 2),
                        makeMinion('enemy', 'pirate_first_mate', '1', 2),
                    ],
                    ongoingActions: [{ uid: 'fortress', defId: 'ancient_incas_fortress_walls', ownerId: '0' }],
                }),
                makeBase('base_machu_picchu'),
            ],
        });

        const buildTriggerContext = (overrides: Record<string, unknown> = {}) => ({
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            actionTargetBaseIndex: 0,
            actionTargetType: 'base' as const,
            triggerCardUid: 'other-action',
            triggerCardDefId: 'ancient_incas_temple_of_the_sun',
            triggerCardOwnerId: '0',
            random: FIXED_RANDOM,
            now: 61,
            ...overrides,
        });

        expect(collectTriggers(core, 'onActionPlayed', buildTriggerContext({
            triggerCardUid: 'fortress',
            triggerCardDefId: 'ancient_incas_fortress_walls',
        }))?.payload.triggers.some(trigger => trigger.sourceDefId === 'ancient_incas_fortress_walls') ?? false).toBe(false);
        expect(collectTriggers(core, 'onActionPlayed', buildTriggerContext({
            playerId: '1',
            triggerCardOwnerId: '1',
        }))?.payload.triggers.some(trigger => trigger.sourceDefId === 'ancient_incas_fortress_walls') ?? false).toBe(false);
        expect(collectTriggers(core, 'onActionPlayed', buildTriggerContext({
            baseIndex: 1,
            actionTargetBaseIndex: 1,
        }))?.payload.triggers.some(trigger => trigger.sourceDefId === 'ancient_incas_fortress_walls') ?? false).toBe(false);

        const queued = collectTriggers(core, 'onActionPlayed', buildTriggerContext());
        const fortressTrigger = queued?.payload.triggers.find(trigger => trigger.sourceDefId === 'ancient_incas_fortress_walls');
        expect(fortressTrigger).toBeTruthy();

        const prompted = maybeResolveReactionQueue(
            makeMatchState({ ...core, triggerQueue: queued!.payload.triggers } as any),
            FIXED_RANDOM,
            62,
        );
        const selectedTrigger = respondToPromptOption(
            prompted!.state,
            option => option.value?.triggerId === fortressTrigger!.id,
            '选择防护墙持续效果',
            '0',
            FIXED_RANDOM,
        );

        const skipped = respondToPromptOption(
            selectedTrigger.finalState,
            option => option.value?.skip === true,
            '跳过防护墙持续效果',
            '0',
            FIXED_RANDOM,
        );
        expect(skipped.finalState.core.bases[0].minions.find(minion => minion.uid === 'own')?.powerCounters ?? 0).toBe(0);
        expectNoPrompt(skipped.finalState);

        const selected = respondToPromptOption(
            selectedTrigger.finalState,
            option => option.value?.minionUid === 'own' && option.value?.baseIndex === 0,
            '选择防护墙持续效果目标',
            '0',
            FIXED_RANDOM,
        );
        expect(selected.finalState.core.bases[0].minions.find(minion => minion.uid === 'own')?.powerCounters).toBe(1);
        expectNoPrompt(selected.finalState);
    });

    it('军械库按同基地其它己方行动提供力量，库斯科每有一个行动降低 3 临界点', () => {
        const core = makeState({
            bases: [makeBase({
                defId: 'base_cuzcu',
                minions: [makeMinion('llama', 'ancient_incas_llama', '0', 2)],
                ongoingActions: [
                    { uid: 'armory', defId: 'ancient_incas_armory', ownerId: '0' },
                    { uid: 'fortress', defId: 'ancient_incas_fortress_walls', ownerId: '0' },
                    { uid: 'temple', defId: 'ancient_incas_temple_of_the_sun', ownerId: '0' },
                ],
            })],
        });

        expect(getEffectiveBreakpoint(core, 0)).toBe(21);
        expect(getPlayerEffectivePowerOnBase(core, core.bases[0], 0, '0')).toBe(6);
    });

    it('马丘比丘在行动打到此基地后让打出者抽一张牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw-card', 'ancient_incas_llama', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_machu_picchu')],
        });

        const result = triggerBaseAbilityWithMS('base_machu_picchu', 'onActionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            baseDefId: 'base_machu_picchu',
            actionTargetBaseIndex: 0,
            actionTargetType: 'base',
            triggerCardUid: 'played-action',
            triggerCardDefId: 'ancient_incas_temple_of_the_sun',
            triggerCardOwnerId: '0',
            random: FIXED_RANDOM,
            now: 50,
        });
        const finalCore = applyEvents(core, result.events);

        expect(finalCore.players['0'].hand.map(card => card.uid)).toEqual(['draw-card']);
    });

    it('皇家公路打出时可把其它基地的己方随从移到这里', () => {
        const core = makeState({
            bases: [
                makeBase('base_machu_picchu'),
                makeBase('base_cuzcu', [
                    makeMinion('llama', 'ancient_incas_llama', '0', 2),
                ]),
            ],
        });

        const result = invokeRegisteredAbilityContract('ancient_incas_royal_highway', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'highway',
            defId: 'ancient_incas_royal_highway',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 60,
        });
        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'llama' && option.value?.toBaseIndex === 0,
            'move 美洲驼 with 皇家公路',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['llama']);
        expect(resolved.finalState.core.bases[1].minions).toEqual([]);
    });

    it('皇家公路打出时列出己方随从的双向移动并允许跳过', () => {
        const core = makeState({
            bases: [
                makeBase('base_machu_picchu', [
                    makeMinion('home', 'ancient_incas_llama', '0', 2),
                ]),
                makeBase('base_cuzcu', [
                    makeMinion('away', 'ancient_incas_llama', '0', 2),
                    makeMinion('enemy', 'ancient_incas_llama', '1', 2),
                ]),
            ],
        });

        const result = invokeRegisteredAbilityContract('ancient_incas_royal_highway', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'highway-bidirectional',
            defId: 'ancient_incas_royal_highway',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 61,
        });
        const prompt = getSimpleChoicePrompt(result.matchState!, 'ancient_incas_royal_highway');
        const moveValues = getPromptOptions(prompt)
            .map(option => option.value)
            .filter(value => value && !value.skip);

        expect(moveValues).toEqual(expect.arrayContaining([
            expect.objectContaining({ minionUid: 'home', fromBaseIndex: 0, toBaseIndex: 1 }),
            expect.objectContaining({ minionUid: 'away', fromBaseIndex: 1, toBaseIndex: 0 }),
        ]));
        expect(moveValues.some(value => value.minionUid === 'enemy')).toBe(false);

        const skipped = respondToPromptOption(
            result.matchState!,
            option => option.value?.skip === true,
            'skip 皇家公路打出时移动',
            '0',
            FIXED_RANDOM,
        );
        expect(skipped.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['home']);
        expect(skipped.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['away', 'enemy']);
        expectNoPrompt(skipped.finalState);
    });

    it('皇家公路持续效果只响应己方在其它基地打出的行动，并可把随从移出此基地', () => {
        const core = makeState({
            bases: [
                makeBase({
                    defId: 'base_machu_picchu',
                    minions: [makeMinion('home', 'ancient_incas_llama', '0', 2)],
                    ongoingActions: [{ uid: 'highway', defId: 'ancient_incas_royal_highway', ownerId: '0' }],
                }),
                makeBase('base_cuzcu', [
                    makeMinion('away', 'ancient_incas_llama', '0', 2),
                ]),
            ],
        });

        const baseActionContext = {
            state: core,
            matchState: makeMatchState(core),
            actionTargetBaseIndex: 1,
            actionTargetType: 'base' as const,
            triggerCardUid: 'action-on-other-base',
            triggerCardDefId: 'ancient_incas_armory',
            triggerCardOwnerId: '0' as const,
            random: FIXED_RANDOM,
            now: 80,
        };
        const queued = collectTriggers(core, 'onActionPlayed', {
            ...baseActionContext,
            playerId: '0',
        });
        expect(queued?.payload.triggers.some(trigger => trigger.sourceDefId === 'ancient_incas_royal_highway')).toBe(true);

        const sameBase = collectTriggers(core, 'onActionPlayed', {
            ...baseActionContext,
            playerId: '0',
            actionTargetBaseIndex: 0,
        });
        expect(sameBase?.payload.triggers.some(trigger => trigger.sourceDefId === 'ancient_incas_royal_highway')).not.toBe(true);

        const opponentAction = collectTriggers(core, 'onActionPlayed', {
            ...baseActionContext,
            playerId: '1',
            triggerCardUid: 'opponent-action',
            triggerCardOwnerId: '1',
        });
        expect(opponentAction?.payload.triggers.some(trigger => trigger.sourceDefId === 'ancient_incas_royal_highway')).not.toBe(true);

        const prompted = maybeResolveReactionQueue(
            makeMatchState({ ...core, triggerQueue: queued!.payload.triggers } as any),
            FIXED_RANDOM,
            81,
        );
        const reactionPrompt = getSimpleChoicePrompt(prompted!.state, 'smashup_reaction_choose');
        const trigger = queued!.payload.triggers.find(item => item.sourceDefId === 'ancient_incas_royal_highway');
        const selectedTrigger = respondToPromptOption(
            prompted!.state,
            option => option.value?.triggerId === trigger?.id,
            'choose 皇家公路持续触发',
            '0',
            FIXED_RANDOM,
        );
        expect(reactionPrompt).toBeDefined();

        const movePrompt = getSimpleChoicePrompt(selectedTrigger.finalState, 'ancient_incas_royal_highway_move');
        expect(getPromptOptions(movePrompt).map(option => option.value)).toEqual(expect.arrayContaining([
            expect.objectContaining({ minionUid: 'home', fromBaseIndex: 0, toBaseIndex: 1 }),
            expect.objectContaining({ minionUid: 'away', fromBaseIndex: 1, toBaseIndex: 0 }),
        ]));

        const moved = respondToPromptOption(
            selectedTrigger.finalState,
            option => option.value?.minionUid === 'home'
                && option.value?.fromBaseIndex === 0
                && option.value?.toBaseIndex === 1,
            'move 己方随从 away from 皇家公路',
            '0',
            FIXED_RANDOM,
        );
        expect(moved.events.some(event => event.type === SU_EVENTS.MINION_MOVED)).toBe(true);
        expect(moved.finalState.core.bases[0].minions).toEqual([]);
        expect(moved.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['away', 'home']);
        expectNoPrompt(moved.finalState);
    });
});
