import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { RUSSIAN_FAIRY_TALES_BASES, RUSSIAN_FAIRY_TALES_CARDS } from '../../data/factions/russian_fairy_tales';
import { getMinionPower } from '../../domain/abilityHelpers';
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
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-action', 'target']);
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

    it('巨型芜菁每有一个随从降低 1 临界点', () => {
        const core = makeState({
            bases: [
                makeBase('base_giant_turnip', [
                    makeMinion('a', 'russian_fairy_tales_tsar_eagle', '0', 2),
                    makeMinion('b', 'pirate_first_mate', '1', 2),
                    makeMinion('c', 'russian_fairy_tales_toad', '0', 0),
                ]),
            ],
        });

        expect(getEffectiveBreakpoint(core, 0)).toBe(27);
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
});
