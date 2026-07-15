import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { ANCIENT_INCAS_BASES, ANCIENT_INCAS_CARDS } from '../../data/factions/ancient_incas';
import { collectTriggers } from '../../domain/ongoingEffects';
import { getEffectiveBreakpoint, getPlayerEffectivePowerOnBase } from '../../domain/ongoingModifiers';
import { maybeResolveReactionQueue } from '../../domain/reactionQueue';
import { SU_EVENTS } from '../../domain/types';
import {
    applyEvents,
    expectRegisteredAbilityContract,
    expectRegisteredInteractionHandlerContract,
    invokeRegisteredAbilityContract,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPromptOption,
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

        expect(resolved?.state.core.bases[1].minions[0].powerCounters).toBe(1);
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
});
