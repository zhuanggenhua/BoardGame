import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { fireTriggers, isCardSuppressed, isMinionProtected, isOperationRestricted } from '../../domain/ongoingEffects';
import { getEffectiveBreakpoint, getEffectivePower } from '../../domain/ongoingModifiers';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import { EXPLORERS_CARDS, GRANNIES_CARDS, ROCK_STARS_CARDS, TEDDY_BEARS_CARDS, WHAT_WERE_WE_THINKING_BASES } from '../../data/factions/what_were_we_thinking';
import {
    applyEvents,
    getPromptOptions,
    getSimpleChoicePrompt,
    expectRegisteredAbilityContract,
    invokeRegisteredAbilityContract,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makeMinionMovedEvent,
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

function baseAbilityCtx(core: ReturnType<typeof makeState>, baseIndex: number, extra: Record<string, unknown> = {}) {
    return {
        state: core,
        matchState: makeMatchState(core),
        baseIndex,
        baseDefId: core.bases[baseIndex].defId,
        playerId: '0',
        now: 10,
        random: FIXED_RANDOM,
        ...extra,
    } as any;
}

describe('我们到底在想什么？摇滚明星代表性玩法行为', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('摇滚明星静态牌组保持 12 张唯一卡面、20 张实体牌和 2 张基地', () => {
        expect(ROCK_STARS_CARDS).toHaveLength(12);
        expect(ROCK_STARS_CARDS.reduce((total, card) => total + card.count, 0)).toBe(20);
        expect(ROCK_STARS_CARDS.map(card => card.previewRef?.index).sort((a, b) => Number(a) - Number(b))).toEqual(
            Array.from({ length: 12 }, (_, index) => index),
        );
        expect(WHAT_WERE_WE_THINKING_BASES.filter(base => base.faction === 'rock_stars').map(base => base.id).sort()).toEqual([
            'base_lake_minnetonka',
            'base_palooza',
        ]);
    });

    it('摇滚明星核心主动能力入口已注册', () => {
        const registrations = [
            ['rock_stars_reunion_tour', 'onPlay'],
            ['rock_stars_rock_of_luuv', 'onPlay'],
            ['rock_stars_guest_star', 'onPlay'],
            ['rock_stars_tour_bus', 'onPlay'],
            ['rock_stars_power_ballad', 'onPlay'],
            ['rock_stars_power_ballad', 'special'],
            ['rock_stars_total_sellout', 'special'],
            ['rock_stars_the_monarch', 'talent'],
            ['rock_stars_classic_rocker', 'talent'],
            ['rock_stars_rick_roll', 'onPlay'],
            ['rock_stars_groupie', 'onPlay'],
        ] as const;

        for (const [defId, tag] of registrations) {
            expect(expectRegisteredAbilityContract(defId, tag), `${defId}::${tag}`).toBeTypeOf('function');
        }
    });

    it('音量开到 11 把低爆破点基地提高到 21，但不降低高爆破点基地', () => {
        const lowCore = makeState({
            bases: [makeBase({
                defId: 'base_out_in_the_woods',
                ongoingActions: [{ uid: 'turn-up', defId: 'rock_stars_turn_up_to_11', ownerId: '0' }],
            })],
        });
        const highCore = makeState({
            bases: [makeBase({
                defId: 'base_lake_minnetonka',
                ongoingActions: [{ uid: 'turn-up', defId: 'rock_stars_turn_up_to_11', ownerId: '0' }],
            })],
        });

        expect(getEffectiveBreakpoint(lowCore, 0)).toBe(21);
        expect(getEffectiveBreakpoint(highCore, 0)).toBe(26);
    });

    it('火热场地只给该基地同控制者随从 +1 持续力量', () => {
        const core = makeState({
            bases: [makeBase({
                defId: 'base_lake_minnetonka',
                minions: [
                    makeMinion('ally', 'rock_stars_groupie', '0', 2),
                    makeMinion('enemy', 'rock_stars_groupie', '1', 2),
                ],
                ongoingActions: [{ uid: 'venue', defId: 'rock_stars_hot_venue', ownerId: '0' }],
            })],
        });

        expect(getEffectivePower(core, core.bases[0].minions[0], 0)).toBe(3);
        expect(getEffectivePower(core, core.bases[0].minions[1], 0)).toBe(2);
    });

    it('力量情歌给目标基地己方随从本回合 +1，敌方随从不受影响', () => {
        const core = makeState({
            bases: [makeBase('base_lake_minnetonka', [
                makeMinion('ally-1', 'rock_stars_groupie', '0', 2),
                makeMinion('ally-2', 'rock_stars_rick_roll', '0', 3),
                makeMinion('enemy', 'rock_stars_groupie', '1', 2),
            ])],
        });

        const result = invokeRegisteredAbilityContract('rock_stars_power_ballad', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'ballad',
            defId: 'rock_stars_power_ballad',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const after = applyEvents(core, result.events);

        expect(after.bases[0].minions.map(minion => [minion.uid, minion.tempPowerModifier ?? 0])).toEqual([
            ['ally-1', 1],
            ['ally-2', 1],
            ['enemy', 0],
        ]);
    });

    it('追星族授予同基地额外打出同名追星族的额度', () => {
        const core = makeState({
            bases: [makeBase('base_lake_minnetonka', [
                makeMinion('groupie', 'rock_stars_groupie', '0', 2),
            ])],
        });

        const result = invokeRegisteredAbilityContract('rock_stars_groupie', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'groupie',
            defId: 'rock_stars_groupie',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const event = result.events.find(candidate => candidate.type === SU_EVENTS.LIMIT_MODIFIED) as any;

        expect(event?.payload).toMatchObject({
            playerId: '0',
            limitType: 'minion',
            delta: 1,
            restrictToBase: 0,
            sameNameOnly: true,
            sameNameDefId: 'rock_stars_groupie',
        });
    });

    it('嘉宾明星检索追星族入手，并额外授予追星族打出额度', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('deck-groupie', 'rock_stars_groupie', 'minion', '0'),
                        makeCard('other', 'rock_stars_rick_roll', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('rock_stars_guest_star', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'guest',
            defId: 'rock_stars_guest_star',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const selected = respondToPromptOption(
            result.matchState!,
            option => option.value?.cardUid === 'deck-groupie',
            'choose deck Groupie',
            '0',
            FIXED_RANDOM,
        );

        expect(selected.success, selected.error).toBe(true);
        expect(selected.finalState.core.players['0'].hand.map(card => card.uid)).toContain('deck-groupie');
        expect(selected.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['other']);
        expect(selected.events.some(event =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && (event as any).payload.sameNameDefId === 'rock_stars_groupie',
        )).toBe(true);
    });

    it('帝王检索追星族入手，但不授予额外出牌额度', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('discard-groupie', 'rock_stars_groupie', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('rock_stars_the_monarch', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'monarch',
            defId: 'rock_stars_the_monarch',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const selected = respondToPromptOption(
            result.matchState!,
            option => option.value?.cardUid === 'discard-groupie',
            'choose discard Groupie',
            '0',
            FIXED_RANDOM,
        );

        expect(selected.success, selected.error).toBe(true);
        expect(selected.finalState.core.players['0'].hand.map(card => card.uid)).toContain('discard-groupie');
        expect(selected.events.some(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toBe(false);
    });

    it('重聚巡演把选中的弃牌堆随从洗回牌库，允许选择 0 张不改动', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-1', 'rock_stars_rick_roll', 'minion', '0')],
                    discard: [
                        makeCard('discard-1', 'rock_stars_groupie', 'minion', '0'),
                        makeCard('discard-2', 'rock_stars_classic_rocker', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const promptResult = invokeRegisteredAbilityContract('rock_stars_reunion_tour', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'reunion',
            defId: 'rock_stars_reunion_tour',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const prompt = getSimpleChoicePrompt(promptResult.matchState!, 'rock_stars_reunion_tour');
        const selectedIds = getPromptOptions(prompt)
            .filter(option => ['discard-1', 'discard-2'].includes(option.value?.cardUid))
            .map(option => option.id);
        const selected = respondToPromptOptions(promptResult.matchState!, selectedIds, '0', FIXED_RANDOM);

        expect(selected.success, selected.error).toBe(true);
        expect(selected.finalState.core.players['0'].deck.map(card => card.uid)).toEqual([
            'deck-1',
            'discard-1',
            'discard-2',
        ]);
        expect(selected.finalState.core.players['0'].discard).toEqual([]);

        const skipped = respondToPromptOptions(promptResult.matchState!, [], '0', FIXED_RANDOM);
        expect(skipped.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-1']);
        expect(skipped.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['discard-1', 'discard-2']);
    });

    it('爱之摇滚从牌库把最多 3 张同名低力量随从加入手牌并洗牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('groupie-1', 'rock_stars_groupie', 'minion', '0'),
                        makeCard('snuggly', 'teddy_bears_snuggly_bear', 'minion', '0'),
                        makeCard('groupie-2', 'rock_stars_groupie', 'minion', '0'),
                        makeCard('high', 'rock_stars_classic_rocker', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('rock_stars_rock_of_luuv', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'luuv',
            defId: 'rock_stars_rock_of_luuv',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const prompt = getSimpleChoicePrompt(result.matchState!, 'rock_stars_rock_of_luuv');
        const selectedIds = getPromptOptions(prompt)
            .filter(option => ['groupie-1', 'groupie-2'].includes(option.value?.cardUid))
            .map(option => option.id);
        const selected = respondToPromptOptions(result.matchState!, selectedIds, '0', FIXED_RANDOM);

        expect(selected.success, selected.error).toBe(true);
        expect(selected.finalState.core.players['0'].hand.map(card => card.uid).sort()).toEqual(['groupie-1', 'groupie-2']);
        expect(selected.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['snuggly', 'high']);

        const skipped = respondToPromptOptions(result.matchState!, [], '0', FIXED_RANDOM);
        expect(skipped.finalState.core.players['0'].hand).toEqual([]);
        expect(skipped.finalState.core.players['0'].deck.map(card => card.uid)).toEqual([
            'groupie-1',
            'snuggly',
            'groupie-2',
            'high',
        ]);
    });

    it('瑞克摇滚和巡演巴士只从低爆破点基地移动己方随从到目标基地', () => {
        const rickCore = makeState({
            bases: [
                makeBase('base_palooza', [
                    makeMinion('rick', 'rock_stars_rick_roll', '0', 3),
                ]),
                makeBase('base_lake_minnetonka', [
                    makeMinion('ally-lower', 'rock_stars_groupie', '0', 2),
                    makeMinion('enemy-lower', 'rock_stars_groupie', '1', 2),
                ]),
                makeBase('base_city_of_gold', [
                    makeMinion('ally-lowest', 'rock_stars_groupie', '0', 2),
                ]),
            ],
        });
        const rick = invokeRegisteredAbilityContract('rock_stars_rick_roll', 'onPlay', {
            state: rickCore,
            matchState: makeMatchState(rickCore),
            playerId: '0',
            cardUid: 'rick',
            defId: 'rock_stars_rick_roll',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const rickPrompt = getSimpleChoicePrompt(rick.matchState!, 'rock_stars_rick_roll');
        expect(getPromptOptions(rickPrompt).some(option => option.value?.minionUid === 'enemy-lower')).toBe(false);
        const rickSelection = getPromptOptions(rickPrompt)
            .filter(option => ['ally-lower', 'ally-lowest'].includes(option.value?.minionUid))
            .map(option => option.id);
        const afterRick = respondToPromptOptions(rick.matchState!, rickSelection, '0', FIXED_RANDOM);
        expect(afterRick.finalState.core.bases[0].minions.map(minion => minion.uid).sort()).toEqual([
            'ally-lower',
            'ally-lowest',
            'rick',
        ].sort());
        const skippedRick = respondToPromptOptions(rick.matchState!, [], '0', FIXED_RANDOM);
        expect(skippedRick.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['rick']);
        expect(skippedRick.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['ally-lower', 'enemy-lower']);

        const busCore = makeState({
            bases: [
                makeBase('base_city_of_gold', [
                    makeMinion('bus-passenger', 'rock_stars_groupie', '0', 2),
                ]),
                makeBase('base_lake_minnetonka'),
                makeBase('base_palooza', [
                    makeMinion('too-high', 'rock_stars_groupie', '0', 2),
                ]),
            ],
        });
        const bus = invokeRegisteredAbilityContract('rock_stars_tour_bus', 'onPlay', {
            state: busCore,
            matchState: makeMatchState(busCore),
            playerId: '0',
            cardUid: 'bus',
            defId: 'rock_stars_tour_bus',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 20,
        });
        const choseTarget = respondToPromptOption(
            bus.matchState!,
            option => option.value?.baseIndex === 1,
            'choose Lake Minnetonka as Tour Bus target',
            '0',
            FIXED_RANDOM,
        );
        const busPrompt = getSimpleChoicePrompt(choseTarget.finalState, 'rock_stars_tour_bus');
        expect(getPromptOptions(busPrompt).some(option => option.value?.minionUid === 'too-high')).toBe(false);
        const moved = respondToPromptOptions(
            choseTarget.finalState,
            getPromptOptions(busPrompt).filter(option => option.value?.minionUid === 'bus-passenger').map(option => option.id),
            '0',
            FIXED_RANDOM,
        );
        expect(moved.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['bus-passenger']);
        const skippedBus = respondToPromptOptions(choseTarget.finalState, [], '0', FIXED_RANDOM);
        expect(skippedBus.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['bus-passenger']);
        expect(skippedBus.finalState.core.bases[1].minions).toEqual([]);
    });

    it('经典摇滚客在 21+ 爆破点基地抽 1，且同回合第二个经典摇滚客不能再用', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw-1', 'rock_stars_groupie', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_lake_minnetonka', [
                makeMinion('classic-1', 'rock_stars_classic_rocker', '0', 4),
                makeMinion('classic-2', 'rock_stars_classic_rocker', '0', 4),
            ])],
        });

        const first = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'classic-1', baseIndex: 0 },
        } as any, FIXED_RANDOM);

        expect(first.success, first.error).toBe(true);
        expect(first.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-1']);
        expect(first.finalState.core.bases[0].minions.find(minion => minion.uid === 'classic-1')?.talentUsed).toBe(true);

        const second = runCommand(first.finalState, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'classic-2', baseIndex: 0 },
        } as any, FIXED_RANDOM);
        expect(second.success).toBe(false);
        expect(second.error).toContain('经典摇滚客');
    });

    it('彻底售罄按计分基地爆破点抽 2 或抽 3', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('draw-1', 'rock_stars_groupie', 'minion', '0'),
                        makeCard('draw-2', 'rock_stars_rick_roll', 'minion', '0'),
                        makeCard('draw-3', 'rock_stars_classic_rocker', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_out_in_the_woods'),
                makeBase('base_lake_minnetonka'),
            ],
        });
        const low = invokeRegisteredAbilityContract('rock_stars_total_sellout', 'special', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'sellout',
            defId: 'rock_stars_total_sellout',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const high = invokeRegisteredAbilityContract('rock_stars_total_sellout', 'special', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'sellout',
            defId: 'rock_stars_total_sellout',
            baseIndex: 1,
            random: FIXED_RANDOM,
            now: 11,
        });

        expect((low.events.find(event => event.type === SU_EVENTS.CARDS_DRAWN) as any)?.payload.cardUids).toEqual(['draw-1', 'draw-2']);
        expect((high.events.find(event => event.type === SU_EVENTS.CARDS_DRAWN) as any)?.payload.cardUids).toEqual(['draw-1', 'draw-2', 'draw-3']);
    });

    it('火热场地回合结束只在本回合该基地打过随从且爆破点 21+ 时抽 1', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw-1', 'rock_stars_groupie', 'minion', '0')],
                    minionsPlayedPerBase: { 0: 1 } as any,
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_lake_minnetonka',
                ongoingActions: [{ uid: 'venue', defId: 'rock_stars_hot_venue', ownerId: '0' }],
            })],
        });

        const triggered = fireTriggers(core, 'onTurnEnd', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            random: FIXED_RANDOM,
            now: 10,
        });
        const after = applyEvents(core, triggered.events);

        expect(after.players['0'].hand.map(card => card.uid)).toEqual(['draw-1']);
    });

    it('明尼通卡湖给打出或移入这里的随从 +1 临时力量', () => {
        const playedCore = makeState({
            bases: [makeBase('base_lake_minnetonka', [
                makeMinion('played', 'rock_stars_groupie', '0', 2),
            ])],
        });
        const played = triggerBaseAbilityWithMS('base_lake_minnetonka', 'onMinionPlayed', baseAbilityCtx(playedCore, 0, {
            minionUid: 'played',
            minionDefId: 'rock_stars_groupie',
        }));
        const afterPlayed = applyEvents(playedCore, played.events);
        expect(afterPlayed.bases[0].minions[0].tempPowerModifier).toBe(1);

        const movedCore = makeState({
            bases: [
                makeBase('base_lake_minnetonka', [
                    makeMinion('moved', 'rock_stars_groupie', '0', 2),
                ]),
                makeBase('base_out_in_the_woods'),
            ],
        });
        const movedEvent = makeMinionMovedEvent({
            minionUid: 'moved',
            minionDefId: 'rock_stars_groupie',
            fromBaseIndex: 1,
            toBaseIndex: 0,
        });
        const triggered = fireTriggers(movedCore, 'onMinionMoved', {
            state: movedCore,
            matchState: makeMatchState(movedCore),
            playerId: '0',
            baseIndex: 0,
            moveFromBaseIndex: 1,
            moveToBaseIndex: 0,
            triggerMinionUid: 'moved',
            triggerMinionDefId: 'rock_stars_groupie',
            random: FIXED_RANDOM,
            now: 20,
        });
        const afterMoved = applyEvents(movedCore, triggered.events);

        expect(afterMoved.bases[0].minions[0].tempPowerModifier).toBe(1);
        expect(movedEvent.type).toBe(SU_EVENTS.MINION_MOVED);
    });

    it('演唱会在计分前依次允许玩家各移动一个自己的随从到这里', () => {
        const core = makeState({
            bases: [
                makeBase('base_palooza'),
                makeBase('base_lake_minnetonka', [
                    makeMinion('p0-minion', 'rock_stars_groupie', '0', 2),
                ]),
                makeBase('base_out_in_the_woods', [
                    makeMinion('p1-minion', 'rock_stars_groupie', '1', 2),
                ]),
            ],
        });

        const result = triggerBaseAbilityWithMS('base_palooza', 'beforeScoring', baseAbilityCtx(core, 0));
        const p0Skipped = respondToPromptOption(
            result.matchState!,
            option => option.value?.skip === true,
            'skip player 0 Palooza move',
            '0',
            FIXED_RANDOM,
        );
        expect(p0Skipped.success, p0Skipped.error).toBe(true);
        expect(p0Skipped.finalState.core.bases[0].minions).toEqual([]);
        expect(p0Skipped.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['p0-minion']);

        const p0Moved = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'p0-minion',
            'move player 0 minion to Palooza',
            '0',
            FIXED_RANDOM,
        );
        expect(p0Moved.success, p0Moved.error).toBe(true);
        expect(p0Moved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['p0-minion']);

        const p1Moved = respondToPromptOption(
            p0Moved.finalState,
            option => option.value?.minionUid === 'p1-minion',
            'move player 1 minion to Palooza',
            '1',
            FIXED_RANDOM,
        );
        expect(p1Moved.success, p1Moved.error).toBe(true);
        expect(p1Moved.finalState.core.bases[0].minions.map(minion => minion.uid).sort()).toEqual([
            'p0-minion',
            'p1-minion',
        ]);
    });
});

describe('我们到底在想什么？泰迪熊代表性玩法行为', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('泰迪熊静态牌组保持 12 张唯一卡面、20 张实体牌和 2 张基地', () => {
        expect(TEDDY_BEARS_CARDS).toHaveLength(12);
        expect(TEDDY_BEARS_CARDS.reduce((total, card) => total + card.count, 0)).toBe(20);
        expect(TEDDY_BEARS_CARDS.map(card => card.previewRef?.index).sort((a, b) => Number(a) - Number(b))).toEqual(
            Array.from({ length: 12 }, (_, index) => index + 12),
        );
        expect(WHAT_WERE_WE_THINKING_BASES.filter(base => base.faction === 'teddy_bears').map(base => base.id).sort()).toEqual([
            'base_out_in_the_woods',
            'base_under_the_bed',
        ]);
    });

    it('泰迪熊核心主动能力入口已注册', () => {
        const registrations = [
            ['teddy_bears_square_deal', 'onPlay'],
            ['teddy_bears_love_overload', 'special'],
            ['teddy_bears_group_hug', 'onPlay'],
            ['teddy_bears_care_package', 'onPlay'],
            ['teddy_bears_sir_squeezes', 'onPlay'],
            ['teddy_bears_tea_party', 'talent'],
        ] as const;

        for (const [defId, tag] of registrations) {
            expect(expectRegisteredAbilityContract(defId, tag), `${defId}::${tag}`).toBeTypeOf('function');
        }
    });

    it('公平交易抽牌直到至少一名其他玩家手牌比你少', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('hand-0', 'teddy_bears_snuggly_bear', 'minion', '0')],
                    deck: [
                        makeCard('draw-1', 'teddy_bears_snuggly_bear', 'minion', '0'),
                        makeCard('draw-2', 'teddy_bears_fun_bear', 'minion', '0'),
                        makeCard('draw-3', 'teddy_bears_lovey_bear', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    hand: [
                        makeCard('p1-a', 'rock_stars_groupie', 'minion', '1'),
                        makeCard('p1-b', 'rock_stars_groupie', 'minion', '1'),
                        makeCard('p1-c', 'rock_stars_groupie', 'minion', '1'),
                    ],
                }),
            },
        });

        const result = invokeRegisteredAbilityContract('teddy_bears_square_deal', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'square',
            defId: 'teddy_bears_square_deal',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const after = applyEvents(core, result.events);

        expect(after.players['0'].hand.map(card => card.uid)).toEqual(['hand-0', 'draw-1', 'draw-2', 'draw-3']);
    });

    it('爱意过载在计分前消灭目标基地力量最高的所有并列随从，并尊重太可爱保护', () => {
        const core = makeState({
            bases: [makeBase({
                defId: 'base_under_the_bed',
                minions: [
                    makeMinion('protected', 'teddy_bears_sir_squeezes', '0', 5),
                    makeMinion('enemy-high', 'teddy_bears_sir_squeezes', '1', 5),
                    makeMinion('enemy-low', 'teddy_bears_fun_bear', '1', 2),
                ],
                ongoingActions: [{ uid: 'too-cute', defId: 'teddy_bears_too_cute', ownerId: '0' }],
            })],
        });

        const result = invokeRegisteredAbilityContract('teddy_bears_love_overload', 'special', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            cardUid: 'overload',
            defId: 'teddy_bears_love_overload',
            baseIndex: 0,
            targetBaseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const after = applyEvents(core, result.events);

        expect(after.bases[0].minions.map(minion => minion.uid).sort()).toEqual(['enemy-low', 'protected']);
    });

    it('集体拥抱给一个己方随从 +X 临时力量，X 为同基地其他随从数量', () => {
        const core = makeState({
            bases: [makeBase('base_under_the_bed', [
                makeMinion('target', 'teddy_bears_fun_bear', '0', 2),
                makeMinion('other-own', 'teddy_bears_snuggly_bear', '0', 1),
                makeMinion('other-enemy', 'rock_stars_groupie', '1', 2),
            ])],
        });

        const result = invokeRegisteredAbilityContract('teddy_bears_group_hug', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'hug',
            defId: 'teddy_bears_group_hug',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const selected = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'target',
            'choose Teddy target for Group Hug',
            '0',
            FIXED_RANDOM,
        );

        expect(selected.success, selected.error).toBe(true);
        expect(selected.finalState.core.bases[0].minions.find(minion => minion.uid === 'target')?.tempPowerModifier).toBe(2);
    });

    it('爱心包裹抽 1 并授予额外随从额度', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw-1', 'teddy_bears_snuggly_bear', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('teddy_bears_care_package', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'care',
            defId: 'teddy_bears_care_package',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const after = applyEvents(core, result.events);

        expect(after.players['0'].hand.map(card => card.uid)).toEqual(['draw-1']);
        expect(result.events.some(event =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && (event as any).payload.reason === 'teddy_bears_care_package',
        )).toBe(true);
    });

    it('泰迪熊野餐阻止其他玩家把自己拥有的力量 2 以下随从打到其他基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('own-low', 'teddy_bears_snuggly_bear', 'minion', '0')],
                }),
                '1': makePlayer('1', {
                    hand: [
                        makeCard('enemy-owned-low', 'teddy_bears_snuggly_bear', 'minion', '1'),
                        makeCard('borrowed-low', 'teddy_bears_snuggly_bear', 'minion', '0'),
                    ],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_under_the_bed',
                    ongoingActions: [{ uid: 'picnic', defId: 'teddy_bears_bear_picnic', ownerId: '0' }],
                }),
                makeBase('base_lake_minnetonka'),
            ],
        });

        expect(isOperationRestricted(core, 1, '1', 'play_minion', {
            minionDefId: 'teddy_bears_snuggly_bear',
            basePower: 1,
            cardUid: 'enemy-owned-low',
        })).toBe(true);
        expect(isOperationRestricted(core, 0, '1', 'play_minion', {
            minionDefId: 'teddy_bears_snuggly_bear',
            basePower: 1,
            cardUid: 'enemy-owned-low',
        })).toBe(false);
        expect(isOperationRestricted(core, 1, '0', 'play_minion', {
            minionDefId: 'teddy_bears_snuggly_bear',
            basePower: 1,
            cardUid: 'own-low',
        })).toBe(false);
        expect(isOperationRestricted(core, 1, '1', 'play_minion', {
            minionDefId: 'teddy_bears_snuggly_bear',
            basePower: 1,
            cardUid: 'borrowed-low',
        })).toBe(false);
    });

    it('抱抱会取消所附随从的能力', () => {
        const core = makeState({
            bases: [makeBase('base_under_the_bed', [
                makeMinion('target', 'rock_stars_classic_rocker', '0', 4, {
                    attachedActions: [{ uid: 'cuddle', defId: 'teddy_bears_cuddle', ownerId: '1' }],
                }),
            ])],
        });

        expect(isCardSuppressed(core, 'target')).toBe(true);
        expect(isCardSuppressed(core, 'cuddle')).toBe(false);
    });

    it('茶会在该基地至少两个随从且有己方随从时抽 1', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw-1', 'teddy_bears_snuggly_bear', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_under_the_bed',
                minions: [
                    makeMinion('own', 'teddy_bears_fun_bear', '0', 2),
                    makeMinion('enemy', 'rock_stars_groupie', '1', 2),
                ],
                ongoingActions: [{ uid: 'tea', defId: 'teddy_bears_tea_party', ownerId: '0' }],
            })],
        });

        const result = invokeRegisteredAbilityContract('teddy_bears_tea_party', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'tea',
            defId: 'teddy_bears_tea_party',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const after = applyEvents(core, result.events);

        expect(after.players['0'].hand.map(card => card.uid)).toEqual(['draw-1']);
    });

    it('挤挤爵士可额外打出至多 3 个、总力量不超过 5 的低力量随从到同基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('snuggly', 'teddy_bears_snuggly_bear', 'minion', '0'),
                        makeCard('fun', 'teddy_bears_fun_bear', 'minion', '0'),
                        makeCard('groupie', 'rock_stars_groupie', 'minion', '0'),
                        makeCard('lovey', 'teddy_bears_lovey_bear', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_under_the_bed', [
                makeMinion('sir', 'teddy_bears_sir_squeezes', '0', 5),
            ])],
        });

        const result = invokeRegisteredAbilityContract('teddy_bears_sir_squeezes', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'sir',
            defId: 'teddy_bears_sir_squeezes',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const prompt = getSimpleChoicePrompt(result.matchState!, 'teddy_bears_sir_squeezes');
        const selectedIds = getPromptOptions(prompt)
            .filter(option => ['snuggly', 'fun', 'groupie'].includes(option.value?.cardUid))
            .map(option => option.id);
        const selected = respondToPromptOptions(result.matchState!, selectedIds, '0', FIXED_RANDOM);

        expect(selected.success, selected.error).toBe(true);
        expect(selected.finalState.core.bases[0].minions.map(minion => minion.uid).sort()).toEqual([
            'fun',
            'groupie',
            'sir',
            'snuggly',
        ].sort());
        expect(selected.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['lovey']);

        const skipped = respondToPromptOptions(result.matchState!, [], '0', FIXED_RANDOM);
        expect(skipped.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['sir']);
        expect(skipped.finalState.core.players['0'].hand.map(card => card.uid)).toEqual([
            'snuggly',
            'fun',
            'groupie',
            'lovey',
        ]);
    });

    it('爱心熊的起始力量提高到同基地对手随从的最高起始力量', () => {
        const core = makeState({
            bases: [makeBase('base_under_the_bed', [
                makeMinion('lovey', 'teddy_bears_lovey_bear', '0', 3),
                makeMinion('enemy-high', 'teddy_bears_sir_squeezes', '1', 5),
                makeMinion('enemy-low', 'rock_stars_groupie', '1', 2),
            ])],
        });

        expect(getEffectivePower(core, core.bases[0].minions[0], 0)).toBe(5);
    });

    it('欢乐熊在其他玩家打出或移动随从到其基地后获得 +1 指示物', () => {
        const playedCore = makeState({
            bases: [makeBase('base_under_the_bed', [
                makeMinion('fun', 'teddy_bears_fun_bear', '0', 2),
                makeMinion('enemy', 'rock_stars_groupie', '1', 2),
            ])],
        });
        const played = fireTriggers(playedCore, 'onMinionPlayed', {
            state: playedCore,
            matchState: makeMatchState(playedCore),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'enemy',
            triggerMinionDefId: 'rock_stars_groupie',
            random: FIXED_RANDOM,
            now: 10,
        });
        const afterPlayed = applyEvents(playedCore, played.events);
        expect(afterPlayed.bases[0].minions.find(minion => minion.uid === 'fun')?.powerCounters).toBe(1);

        const movedCore = makeState({
            bases: [makeBase('base_under_the_bed', [
                makeMinion('fun', 'teddy_bears_fun_bear', '0', 2),
                makeMinion('enemy', 'rock_stars_groupie', '1', 2),
            ])],
        });
        const moved = fireTriggers(movedCore, 'onMinionMoved', {
            state: movedCore,
            matchState: makeMatchState(movedCore),
            playerId: '1',
            baseIndex: 0,
            moveFromBaseIndex: 1,
            moveToBaseIndex: 0,
            triggerMinionUid: 'enemy',
            triggerMinionDefId: 'rock_stars_groupie',
            random: FIXED_RANDOM,
            now: 20,
        });
        const afterMoved = applyEvents(movedCore, moved.events);
        expect(afterMoved.bases[0].minions.find(minion => minion.uid === 'fun')?.powerCounters).toBe(1);
    });

    it('依偎熊在你打出本回合第一个随从后授予同基地同名立即额外打出额度', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('snuggly-hand', 'teddy_bears_snuggly_bear', 'minion', '0')],
                    minionsPlayed: 1,
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_under_the_bed', [
                makeMinion('first', 'teddy_bears_fun_bear', '0', 2),
            ])],
        });

        const triggered = fireTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'first',
            triggerMinionDefId: 'teddy_bears_fun_bear',
            random: FIXED_RANDOM,
            now: 10,
        });
        const event = triggered.events.find(candidate => candidate.type === SU_EVENTS.LIMIT_MODIFIED) as any;

        expect(event?.payload).toMatchObject({
            playerId: '0',
            reason: 'teddy_bears_snuggly_bear',
            restrictToBase: 0,
            sameNameOnly: true,
            sameNameDefId: 'teddy_bears_snuggly_bear',
            playTiming: 'immediate',
        });
    });

    it('床底下在当前玩家向其他基地打出随从后授予这里力量不高于 2 的立即额外随从额度', () => {
        const core = makeState({
            bases: [
                makeBase('base_under_the_bed'),
                makeBase('base_lake_minnetonka', [
                    makeMinion('played', 'rock_stars_groupie', '0', 2),
                ]),
            ],
        });

        const triggered = fireTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 1,
            triggerMinionUid: 'played',
            triggerMinionDefId: 'rock_stars_groupie',
            random: FIXED_RANDOM,
            now: 10,
        });
        const event = triggered.events.find(candidate => candidate.type === SU_EVENTS.LIMIT_MODIFIED) as any;

        expect(event?.payload).toMatchObject({
            playerId: '0',
            reason: 'base_under_the_bed',
            restrictToBase: 0,
            powerMax: 2,
            playTiming: 'immediate',
        });
    });

    it('在森林里计分前给该基地每个随从 +1 临时力量', () => {
        const core = makeState({
            bases: [makeBase('base_out_in_the_woods', [
                makeMinion('own', 'teddy_bears_fun_bear', '0', 2),
                makeMinion('enemy', 'rock_stars_groupie', '1', 2),
            ])],
        });

        const result = triggerBaseAbilityWithMS('base_out_in_the_woods', 'beforeScoring', baseAbilityCtx(core, 0));
        const after = applyEvents(core, result.events);

        expect(after.bases[0].minions.map(minion => [minion.uid, minion.tempPowerModifier ?? 0])).toEqual([
            ['own', 1],
            ['enemy', 1],
        ]);
    });
});

describe('我们到底在想什么？外婆代表性玩法行为', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('外婆静态牌组保持 12 张唯一卡面、20 张实体牌和 2 张基地', () => {
        expect(GRANNIES_CARDS).toHaveLength(12);
        expect(GRANNIES_CARDS.reduce((total, card) => total + card.count, 0)).toBe(20);
        expect(GRANNIES_CARDS.map(card => card.previewRef?.index).sort((a, b) => Number(a) - Number(b))).toEqual(
            Array.from({ length: 12 }, (_, index) => index + 24),
        );
        expect(WHAT_WERE_WE_THINKING_BASES.filter(base => base.faction === 'grannies').map(base => base.id).sort()).toEqual([
            'base_grandmas_house',
            'base_retirement_community',
        ]);
    });

    it('外婆核心主动能力入口已注册', () => {
        const registrations = [
            ['grannies_chicken_soup', 'onPlay'],
            ['grannies_grannys_purse', 'onPlay'],
            ['grannies_always_room_at_grannys', 'special'],
            ['grannies_attic_treasures', 'onPlay'],
            ['grannies_hush_my_stories_are_on', 'onPlay'],
            ['grannies_knitting_circle', 'onPlay'],
            ['grannies_matriarch', 'talent'],
            ['grannies_granny', 'talent'],
            ['grannies_nana', 'onPlay'],
            ['grannies_grandma', 'onPlay'],
        ] as const;

        for (const [defId, tag] of registrations) {
            expect(expectRegisteredAbilityContract(defId, tag), `${defId}::${tag}`).toBeTypeOf('function');
        }
    });

    it('鸡汤把至多两张弃牌堆牌按选择放到牌库顶和牌库底，也允许空选', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-1', 'rock_stars_groupie', 'minion', '0')],
                    discard: [
                        makeCard('soup-top', 'grannies_grandma', 'minion', '0'),
                        makeCard('soup-bottom', 'grannies_chicken_soup', 'action', '0'),
                        makeCard('leftover', 'grannies_nana', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('grannies_chicken_soup', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'soup',
            defId: 'grannies_chicken_soup',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const prompt = getSimpleChoicePrompt(result.matchState!, 'grannies_chicken_soup');
        const selected = respondToPromptOptions(result.matchState!, ['soup-top-top', 'soup-bottom-bottom'], '0', FIXED_RANDOM);

        expect(selected.success, selected.error).toBe(true);
        expect(getPromptOptions(prompt)).toHaveLength(6);
        expect(selected.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['soup-top', 'deck-1', 'soup-bottom']);
        expect(selected.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['leftover']);

        const skipped = respondToPromptOptions(result.matchState!, [], '0', FIXED_RANDOM);
        expect(skipped.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-1']);
        expect(skipped.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['soup-top', 'soup-bottom', 'leftover']);
    });

    it('外婆的钱包展示牌库顶行动，可抓取或放回，并总是授予额外行动', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('top-action', 'grannies_chicken_soup', 'action', '0'),
                        makeCard('next', 'grannies_grandma', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('grannies_grannys_purse', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'purse',
            defId: 'grannies_grannys_purse',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const drawn = respondToPromptOption(result.matchState!, option => option.id === 'draw', 'draw top action', '0', FIXED_RANDOM);

        expect(result.events.some(event =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && (event as any).payload.reason === 'grannies_grannys_purse',
        )).toBe(true);
        expect(drawn.success, drawn.error).toBe(true);
        expect(drawn.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['top-action']);
        expect(drawn.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['next']);

        const nonActionCore = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('top-minion', 'grannies_grandma', 'minion', '0'),
                        makeCard('next-action', 'grannies_chicken_soup', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });
        const nonAction = invokeRegisteredAbilityContract('grannies_grannys_purse', 'onPlay', {
            state: nonActionCore,
            matchState: makeMatchState(nonActionCore),
            playerId: '0',
            cardUid: 'purse',
            defId: 'grannies_grannys_purse',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 20,
        });
        const afterNonAction = applyEvents(nonActionCore, nonAction.events);
        expect(afterNonAction.players['0'].deck.map(card => card.uid)).toEqual(['next-action', 'top-minion']);
    });

    it('奶奶可抓取牌库顶行动或将其作为额外行动打出，非行动则置底', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('top-action', 'grannies_chicken_soup', 'action', '0'),
                        makeCard('next', 'grannies_grandma', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });
        const result = invokeRegisteredAbilityContract('grannies_nana', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'nana',
            defId: 'grannies_nana',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const played = respondToPromptOption(result.matchState!, option => option.id === 'play', 'play revealed action', '0', FIXED_RANDOM);

        expect(played.success, played.error).toBe(true);
        expect(played.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['top-action']);
        expect(played.events.some(event =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && (event as any).payload.restrictToCardUid === 'top-action',
        )).toBe(true);

        const nonActionCore = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('top-minion', 'grannies_grandma', 'minion', '0'),
                        makeCard('next-action', 'grannies_chicken_soup', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });
        const nonAction = invokeRegisteredAbilityContract('grannies_nana', 'onPlay', {
            state: nonActionCore,
            matchState: makeMatchState(nonActionCore),
            playerId: '0',
            cardUid: 'nana',
            defId: 'grannies_nana',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 20,
        });
        const afterNonAction = applyEvents(nonActionCore, nonAction.events);
        expect(afterNonAction.players['0'].deck.map(card => card.uid)).toEqual(['next-action', 'top-minion']);
    });

    it('外婆与祖母都能把牌库顶牌留顶或置底', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('top', 'grannies_chicken_soup', 'action', '0'),
                        makeCard('second', 'grannies_grandma', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });
        const granny = invokeRegisteredAbilityContract('grannies_granny', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'granny',
            defId: 'grannies_granny',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const bottomed = respondToPromptOption(granny.matchState!, option => option.id === 'bottom', 'put top card on bottom', '0', FIXED_RANDOM);
        expect(bottomed.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['second', 'top']);

        const grandma = invokeRegisteredAbilityContract('grannies_grandma', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'grandma',
            defId: 'grannies_grandma',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 20,
        });
        const kept = respondToPromptOption(grandma.matchState!, option => option.id === 'top', 'keep top card', '0', FIXED_RANDOM);
        expect(kept.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['top', 'second']);
    });

    it('女族长展示牌库底两张，抓取随从并弃掉非随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('top', 'grannies_grandma', 'minion', '0'),
                        makeCard('bottom-minion', 'grannies_nana', 'minion', '0'),
                        makeCard('bottom-action', 'grannies_chicken_soup', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('grannies_matriarch', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'matriarch',
            defId: 'grannies_matriarch',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const after = applyEvents(core, result.events);

        expect(after.players['0'].hand.map(card => card.uid)).toEqual(['bottom-minion']);
        expect(after.players['0'].discard.map(card => card.uid)).toEqual(['bottom-action']);
        expect(after.players['0'].deck.map(card => card.uid)).toEqual(['top']);
    });

    it('阁楼宝藏把三张手牌按顺序置底后抽三张', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('hand-1', 'grannies_grandma', 'minion', '0'),
                        makeCard('hand-2', 'grannies_nana', 'minion', '0'),
                        makeCard('hand-3', 'grannies_chicken_soup', 'action', '0'),
                    ],
                    deck: [
                        makeCard('draw-1', 'rock_stars_groupie', 'minion', '0'),
                        makeCard('draw-2', 'teddy_bears_fun_bear', 'minion', '0'),
                        makeCard('draw-3', 'grannies_granny', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('grannies_attic_treasures', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'attic',
            defId: 'grannies_attic_treasures',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const moved = respondToPromptOptions(result.matchState!, ['hand-1', 'hand-2', 'hand-3'], '0', FIXED_RANDOM);

        expect(moved.success, moved.error).toBe(true);
        expect(moved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-1', 'draw-2', 'draw-3']);
        expect(moved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['hand-1', 'hand-2', 'hand-3']);
    });

    it('嘘，我的剧开播了抓取牌库底牌，若为随从则授予该牌的额外随从额度', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('top', 'grannies_chicken_soup', 'action', '0'),
                        makeCard('bottom-minion', 'grannies_grandma', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('grannies_hush_my_stories_are_on', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'hush',
            defId: 'grannies_hush_my_stories_are_on',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const after = applyEvents(core, result.events);

        expect(after.players['0'].hand.map(card => card.uid)).toEqual(['bottom-minion']);
        expect(after.players['0'].deck.map(card => card.uid)).toEqual(['top']);
        expect(result.events.some(event =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && (event as any).payload.specificCardUid === 'bottom-minion',
        )).toBe(true);
    });

    it('家庭聚会在你向附着基地打出随从后展示牌库底牌：随从入手，非随从放顶', () => {
        const minionCore = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('top', 'grannies_chicken_soup', 'action', '0'),
                        makeCard('bottom-minion', 'grannies_grandma', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_grandmas_house',
                minions: [makeMinion('played', 'grannies_grandma', '0', 2)],
                ongoingActions: [{ uid: 'reunion', defId: 'grannies_family_reunion', ownerId: '0' }],
            })],
        });
        const minionTrigger = fireTriggers(minionCore, 'onMinionPlayed', {
            state: minionCore,
            matchState: makeMatchState(minionCore),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'played',
            triggerMinionDefId: 'grannies_grandma',
            random: FIXED_RANDOM,
            now: 10,
        });
        const afterMinion = applyEvents(minionCore, minionTrigger.events);
        expect(afterMinion.players['0'].hand.map(card => card.uid)).toEqual(['bottom-minion']);
        expect(afterMinion.players['0'].deck.map(card => card.uid)).toEqual(['top']);

        const actionCore = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('top-minion', 'grannies_grandma', 'minion', '0'),
                        makeCard('bottom-action', 'grannies_chicken_soup', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_grandmas_house',
                minions: [makeMinion('played', 'grannies_grandma', '0', 2)],
                ongoingActions: [{ uid: 'reunion', defId: 'grannies_family_reunion', ownerId: '0' }],
            })],
        });
        const actionTrigger = fireTriggers(actionCore, 'onMinionPlayed', {
            state: actionCore,
            matchState: makeMatchState(actionCore),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'played',
            triggerMinionDefId: 'grannies_grandma',
            random: FIXED_RANDOM,
            now: 20,
        });
        const afterAction = applyEvents(actionCore, actionTrigger.events);
        expect(afterAction.players['0'].deck.map(card => card.uid)).toEqual(['bottom-action', 'top-minion']);
    });

    it('别惹我的宝贝保护附着基地己方随从不受其他玩家卡牌影响', () => {
        const core = makeState({
            bases: [makeBase({
                defId: 'base_grandmas_house',
                minions: [
                    makeMinion('own', 'grannies_grandma', '0', 2),
                    makeMinion('enemy', 'rock_stars_groupie', '1', 2),
                ],
                ongoingActions: [{ uid: 'dont-mess', defId: 'grannies_dont_mess_with_my_babies', ownerId: '0' }],
            })],
        });
        const own = core.bases[0].minions[0];
        const enemy = core.bases[0].minions[1];

        expect(isMinionProtected(core, own, 0, '1', 'destroy')).toBe(true);
        expect(isMinionProtected(core, own, 0, '1', 'move')).toBe(true);
        expect(isMinionProtected(core, own, 0, '1', 'affect')).toBe(true);
        expect(isMinionProtected(core, own, 0, '1', 'action')).toBe(true);
        expect(isMinionProtected(core, own, 0, '0', 'destroy')).toBe(false);
        expect(isMinionProtected(core, enemy, 0, '0', 'destroy')).toBe(false);
    });

    it('编织小组消灭至多三个场上行动并按数量抽牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('draw-1', 'grannies_grandma', 'minion', '0'),
                        makeCard('draw-2', 'grannies_nana', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_grandmas_house',
                ongoingActions: [{ uid: 'base-action', defId: 'grannies_family_reunion', ownerId: '1' }],
                minions: [makeMinion('target', 'rock_stars_groupie', '1', 2, {
                    attachedActions: [{ uid: 'attached-action', defId: 'teddy_bears_cuddle', ownerId: '1' }],
                })],
            })],
        });

        const result = invokeRegisteredAbilityContract('grannies_knitting_circle', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'knitting',
            defId: 'grannies_knitting_circle',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const destroyed = respondToPromptOptions(result.matchState!, ['base-action', 'attached-action'], '0', FIXED_RANDOM);

        expect(destroyed.success, destroyed.error).toBe(true);
        expect(destroyed.finalState.core.bases[0].ongoingActions).toEqual([]);
        expect(destroyed.finalState.core.bases[0].minions[0].attachedActions).toEqual([]);
        expect(destroyed.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-1', 'draw-2']);
        expect(destroyed.finalState.core.players['1'].discard.map(card => card.uid).sort()).toEqual(['attached-action', 'base-action']);

        const skipped = respondToPromptOptions(result.matchState!, [], '0', FIXED_RANDOM);
        expect(skipped.finalState.core.bases[0].ongoingActions.map(action => action.uid)).toEqual(['base-action']);
        expect(skipped.finalState.core.bases[0].minions[0].attachedActions?.map(action => action.uid)).toEqual(['attached-action']);
        expect(skipped.finalState.core.players['0'].hand).toEqual([]);
    });

    it('外婆家总有地方在计分后把至多三个己方随从放到牌库顶或底', () => {
        const core = makeState({
            bases: [makeBase('base_grandmas_house', [
                makeMinion('own-1', 'grannies_grandma', '0', 2),
                makeMinion('own-2', 'grannies_nana', '0', 3),
                makeMinion('enemy', 'rock_stars_groupie', '1', 2),
            ])],
        });

        const result = invokeRegisteredAbilityContract('grannies_always_room_at_grannys', 'special', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'always-room',
            defId: 'grannies_always_room_at_grannys',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const moved = respondToPromptOptions(result.matchState!, ['own-1-top', 'own-2-bottom'], '0', FIXED_RANDOM);

        expect(moved.success, moved.error).toBe(true);
        expect(moved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['enemy']);
        expect(moved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['own-1', 'own-2']);

        const skipped = respondToPromptOptions(result.matchState!, [], '0', FIXED_RANDOM);
        expect(skipped.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['own-1', 'own-2', 'enemy']);
        expect(skipped.finalState.core.players['0'].deck).toEqual([]);
    });

    it('奶奶家在随从打出后查看牌库顶并允许置底', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('top', 'grannies_chicken_soup', 'action', '0'),
                        makeCard('second', 'grannies_grandma', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_grandmas_house', [
                makeMinion('played', 'grannies_grandma', '0', 2),
            ])],
        });

        const result = triggerBaseAbilityWithMS('base_grandmas_house', 'onMinionPlayed', baseAbilityCtx(core, 0, {
            minionUid: 'played',
            minionDefId: 'grannies_grandma',
        }));
        const bottomed = respondToPromptOption(result.matchState!, option => option.id === 'bottom', 'put top on bottom', '0', FIXED_RANDOM);

        expect(bottomed.success, bottomed.error).toBe(true);
        expect(bottomed.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['second', 'top']);
    });

    it('退休社区在计分后依次允许每名玩家把这里自己的一个随从置顶或置底', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            bases: [makeBase('base_retirement_community', [
                makeMinion('p0-minion', 'grannies_grandma', '0', 2),
                makeMinion('p1-minion', 'rock_stars_groupie', '1', 2),
            ])],
        });

        const result = triggerBaseAbilityWithMS('base_retirement_community', 'afterScoring', baseAbilityCtx(core, 0));
        const p0Skipped = respondToPromptOption(result.matchState!, option => option.value?.skip === true, 'skip retiring p0 minion', '0', FIXED_RANDOM);
        expect(p0Skipped.success, p0Skipped.error).toBe(true);
        expect(p0Skipped.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['p0-minion', 'p1-minion']);
        expect(p0Skipped.finalState.core.players['0'].deck).toEqual([]);

        const p0Moved = respondToPromptOption(result.matchState!, option => option.value?.cardUid === 'p0-minion' && option.value?.mode === 'bottom', 'retire p0 minion', '0', FIXED_RANDOM);
        expect(p0Moved.success, p0Moved.error).toBe(true);
        expect(p0Moved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['p0-minion']);

        const p1Moved = respondToPromptOption(p0Moved.finalState, option => option.value?.cardUid === 'p1-minion' && option.value?.mode === 'top', 'retire p1 minion', '1', FIXED_RANDOM);
        expect(p1Moved.success, p1Moved.error).toBe(true);
        expect(p1Moved.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['p1-minion']);
        expect(p1Moved.finalState.core.bases[0].minions).toEqual([]);
    });
});

describe('我们到底在想什么？探险家代表性玩法行为', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('探险家静态牌组保持 12 张唯一卡面、20 张实体牌和 2 张基地', () => {
        expect(EXPLORERS_CARDS).toHaveLength(12);
        expect(EXPLORERS_CARDS.reduce((total, card) => total + card.count, 0)).toBe(20);
        expect(EXPLORERS_CARDS.map(card => card.previewRef?.index).sort((a, b) => Number(a) - Number(b))).toEqual(
            Array.from({ length: 12 }, (_, index) => index + 36),
        );
        expect(WHAT_WERE_WE_THINKING_BASES.filter(base => base.faction === 'explorers').map(base => base.id).sort()).toEqual([
            'base_ancient_temple',
            'base_city_of_gold',
        ]);
    });

    it('探险家核心主动能力入口已注册', () => {
        const registrations = [
            ['explorers_idaho_smith', 'onPlay'],
            ['explorers_lost_city', 'special'],
            ['explorers_you_call_this_archaeology', 'onPlay'],
            ['explorers_you_call_this_archaeology', 'special'],
            ['explorers_fortune_and_glory', 'onPlay'],
            ['explorers_glory_hound', 'onPlay'],
            ['explorers_it_belongs_in_a_museum', 'onPlay'],
            ['explorers_x_never_marks_the_spot', 'onPlay'],
            ['explorers_i_said_no_camels', 'onPlay'],
            ['explorers_dr_livingstone_i_presume', 'onPlay'],
        ] as const;

        for (const [defId, tag] of registrations) {
            expect(expectRegisteredAbilityContract(defId, tag), `${defId}::${tag}`).toBeTypeOf('function');
        }
    });

    it('爱达荷·史密斯打出基地牌库顶基地，并把自己和所选己方随从移过去', () => {
        const core = makeState({
            bases: [
                makeBase('base_palooza', [
                    makeMinion('idaho', 'explorers_idaho_smith', '0', 5),
                    makeMinion('ally', 'explorers_guide', '0', 4),
                    makeMinion('enemy', 'rock_stars_groupie', '1', 2),
                ]),
                makeBase('base_lake_minnetonka'),
            ],
            baseDeck: ['base_ancient_temple'],
        });

        const result = invokeRegisteredAbilityContract('explorers_idaho_smith', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'idaho',
            defId: 'explorers_idaho_smith',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const prompt = getSimpleChoicePrompt(result.matchState!, 'explorers_idaho_smith');
        const allyOption = getPromptOptions(prompt).find(option => option.value?.minionUid === 'ally');
        const moved = respondToPromptOptions(result.matchState!, [allyOption.id], '0', FIXED_RANDOM);

        expect(moved.success, moved.error).toBe(true);
        expect(moved.finalState.core.bases.map(base => base.defId)).toEqual([
            'base_palooza',
            'base_lake_minnetonka',
            'base_ancient_temple',
        ]);
        expect(moved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['enemy']);
        expect(moved.finalState.core.bases[2].minions.map(minion => minion.uid).sort()).toEqual(['ally', 'idaho']);
        expect(moved.finalState.core.baseDeck).toEqual([]);

        const skipped = respondToPromptOptions(result.matchState!, [], '0', FIXED_RANDOM);
        expect(skipped.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['ally', 'enemy']);
        expect(skipped.finalState.core.bases[2].minions.map(minion => minion.uid)).toEqual(['idaho']);
    });

    it('失落之城选择展示基地置顶并弃掉另一张，同时授予新基地额外随从额度', () => {
        const core = makeState({
            bases: [makeBase('base_palooza')],
            baseDeck: ['base_ancient_temple', 'base_city_of_gold', 'base_lake_minnetonka'],
            baseDiscard: ['base_old_ruin'],
        });

        const result = invokeRegisteredAbilityContract('explorers_lost_city', 'special', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'lost-city',
            defId: 'explorers_lost_city',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const chosen = respondToPromptOption(
            result.matchState!,
            option => option.value?.defId === 'base_city_of_gold',
            'choose City of Gold',
            '0',
            FIXED_RANDOM,
        );

        expect(chosen.success, chosen.error).toBe(true);
        expect(chosen.finalState.core.baseDeck).toEqual(['base_city_of_gold', 'base_lake_minnetonka']);
        expect(chosen.finalState.core.baseDiscard).toEqual(['base_old_ruin', 'base_ancient_temple']);
        expect(chosen.events.some(event =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && (event as any).payload.reason === 'explorers_lost_city'
            && (event as any).payload.restrictToBase === 0,
        )).toBe(true);
    });

    it('你管这叫考古？通过两段 prompt 移动一个己方随从', () => {
        const core = makeState({
            bases: [
                makeBase('base_palooza', [makeMinion('guide', 'explorers_guide', '0', 4)]),
                makeBase('base_lake_minnetonka'),
            ],
        });

        const result = invokeRegisteredAbilityContract('explorers_you_call_this_archaeology', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'archaeology',
            defId: 'explorers_you_call_this_archaeology',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const pickedMinion = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'guide',
            'choose Guide',
            '0',
            FIXED_RANDOM,
        );
        expect(pickedMinion.success, pickedMinion.error).toBe(true);
        const moved = respondToPromptOption(
            pickedMinion.finalState,
            option => option.value?.baseIndex === 1,
            'choose destination base',
            '0',
            FIXED_RANDOM,
        );

        expect(moved.success, moved.error).toBe(true);
        expect(moved.finalState.core.bases[0].minions).toEqual([]);
        expect(moved.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['guide']);
    });

    it('财富与荣耀把来源基地至多两个随从移到目标基地', () => {
        const core = makeState({
            bases: [
                makeBase('base_palooza', [
                    makeMinion('m1', 'explorers_guide', '0', 4),
                    makeMinion('m2', 'explorers_glory_hound', '0', 2),
                    makeMinion('m3', 'rock_stars_groupie', '1', 2),
                ]),
                makeBase('base_lake_minnetonka'),
            ],
        });

        const result = invokeRegisteredAbilityContract('explorers_fortune_and_glory', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'fortune',
            defId: 'explorers_fortune_and_glory',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const pickedSource = respondToPromptOption(result.matchState!, option => option.value?.baseIndex === 0, 'choose source base', '0', FIXED_RANDOM);
        expect(pickedSource.success, pickedSource.error).toBe(true);
        const pickedDestination = respondToPromptOption(pickedSource.finalState, option => option.value?.baseIndex === 1, 'choose destination base', '0', FIXED_RANDOM);
        expect(pickedDestination.success, pickedDestination.error).toBe(true);
        const prompt = getSimpleChoicePrompt(pickedDestination.finalState, 'explorers_fortune_and_glory_minions');
        const ids = getPromptOptions(prompt)
            .filter(option => ['m1', 'm3'].includes(option.value?.minionUid))
            .map(option => option.id);
        const moved = respondToPromptOptions(pickedDestination.finalState, ids, '0', FIXED_RANDOM);

        expect(moved.success, moved.error).toBe(true);
        expect(moved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['m2']);
        expect(moved.finalState.core.bases[1].minions.map(minion => minion.uid).sort()).toEqual(['m1', 'm3']);

        const skipped = respondToPromptOptions(pickedDestination.finalState, [], '0', FIXED_RANDOM);
        expect(skipped.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['m1', 'm2', 'm3']);
        expect(skipped.finalState.core.bases[1].minions).toEqual([]);
    });

    it('向导只在本回合第一次己方随从移动后给该随从临时 +1', () => {
        const firstMoveCore = makeState({
            minionMovesThisTurnByPlayer: { '0': 1 },
            bases: [
                makeBase('base_palooza', [makeMinion('guide', 'explorers_guide', '0', 4)]),
                makeBase('base_city_of_gold', [makeMinion('moved', 'explorers_glory_hound', '0', 2)]),
            ],
        });

        const first = fireTriggers(firstMoveCore, 'onMinionMoved', {
            playerId: '0',
            moveFromBaseIndex: 0,
            moveToBaseIndex: 1,
            triggerMinionUid: 'moved',
            triggerMinionDefId: 'explorers_glory_hound',
            triggerMinion: firstMoveCore.bases[1].minions[0],
            matchState: makeMatchState(firstMoveCore),
            random: FIXED_RANDOM,
            now: 10,
        });
        const afterFirst = applyEvents(firstMoveCore, first.events);

        expect(afterFirst.bases[1].minions[0].tempPowerModifier).toBe(1);

        const secondMoveCore = { ...firstMoveCore, minionMovesThisTurnByPlayer: { '0': 2 } };
        const second = fireTriggers(secondMoveCore, 'onMinionMoved', {
            playerId: '0',
            moveFromBaseIndex: 0,
            moveToBaseIndex: 1,
            triggerMinionUid: 'moved',
            triggerMinionDefId: 'explorers_glory_hound',
            triggerMinion: secondMoveCore.bases[1].minions[0],
            matchState: makeMatchState(secondMoveCore),
            random: FIXED_RANDOM,
            now: 11,
        });

        expect(second.events).toHaveLength(0);
    });

    it('被遗忘的恐怖在己方随从进入本基地后抓牌并转移到另一个基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { deck: [makeCard('drawn', 'explorers_glory_hound', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ defId: 'base_palooza', ongoingActions: [{ uid: 'horror', defId: 'explorers_forgotten_horrors', ownerId: '0' }], minions: [
                    makeMinion('played', 'explorers_guide', '0', 4),
                ] }),
                makeBase('base_lake_minnetonka'),
            ],
        });

        const triggered = fireTriggers(core, 'onMinionPlayed', {
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'played',
            triggerMinionDefId: 'explorers_guide',
            triggerMinion: core.bases[0].minions[0],
            matchState: makeMatchState(core),
            random: FIXED_RANDOM,
            now: 10,
        });
        const drawnCore = applyEvents(core, triggered.events);
        const stateWithDraw = { ...triggered.matchState!, core: drawnCore };
        const transferred = respondToPromptOption(
            stateWithDraw,
            option => option.value?.baseIndex === 1,
            'move Forgotten Horrors',
            '0',
            FIXED_RANDOM,
        );

        expect(transferred.success, transferred.error).toBe(true);
        expect(transferred.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['drawn']);
        expect(transferred.finalState.core.bases[0].ongoingActions).toEqual([]);
        expect(transferred.finalState.core.bases[1].ongoingActions.map(action => action.uid)).toEqual(['horror']);
    });

    it('古墓掠夺者在新基地进场时授予仅限自身的额外随从额度', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('looter', 'explorers_crypt_looter', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_palooza'), makeBase('base_city_of_gold')],
        });

        const triggered = fireTriggers(core, 'onBaseRevealed', {
            playerId: '0',
            baseIndex: 1,
            matchState: makeMatchState(core),
            random: FIXED_RANDOM,
            now: 10,
        });
        const limit = triggered.events.find(event => event.type === SU_EVENTS.LIMIT_MODIFIED) as any;

        expect(limit?.payload).toMatchObject({
            playerId: '0',
            limitType: 'minion',
            reason: 'explorers_crypt_looter',
            restrictToBase: 1,
            specificCardUid: 'looter',
        });
    });

    it('逐名猎犬把一张展示基地留顶并把另一张置底', () => {
        const core = makeState({
            baseDeck: ['base_ancient_temple', 'base_city_of_gold', 'base_palooza'],
        });

        const result = invokeRegisteredAbilityContract('explorers_glory_hound', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'hound',
            defId: 'explorers_glory_hound',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const chosen = respondToPromptOption(result.matchState!, option => option.value?.defId === 'base_city_of_gold', 'choose top base', '0', FIXED_RANDOM);

        expect(chosen.success, chosen.error).toBe(true);
        expect(chosen.finalState.core.baseDeck).toEqual(['base_city_of_gold', 'base_palooza', 'base_ancient_temple']);
    });

    it('它该进博物馆交换两个不同基地的随从', () => {
        const core = makeState({
            bases: [
                makeBase('base_palooza', [makeMinion('a', 'explorers_guide', '0', 4)]),
                makeBase('base_lake_minnetonka', [makeMinion('b', 'rock_stars_groupie', '1', 2)]),
            ],
        });

        const result = invokeRegisteredAbilityContract('explorers_it_belongs_in_a_museum', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'museum',
            defId: 'explorers_it_belongs_in_a_museum',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const prompt = getSimpleChoicePrompt(result.matchState!, 'explorers_it_belongs_in_a_museum');
        const ids = getPromptOptions(prompt)
            .filter(option => ['a', 'b'].includes(option.value?.minionUid))
            .map(option => option.id);
        const swapped = respondToPromptOptions(result.matchState!, ids, '0', FIXED_RANDOM);

        expect(swapped.success, swapped.error).toBe(true);
        expect(swapped.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['b']);
        expect(swapped.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['a']);
    });

    it('X 从不标记地点为每个己方随从选择目标基地并移动', () => {
        const core = makeState({
            bases: [
                makeBase('base_palooza', [makeMinion('a', 'explorers_guide', '0', 4)]),
                makeBase('base_lake_minnetonka', [makeMinion('b', 'explorers_glory_hound', '0', 2)]),
                makeBase('base_ancient_temple'),
            ],
        });

        const result = invokeRegisteredAbilityContract('explorers_x_never_marks_the_spot', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'x',
            defId: 'explorers_x_never_marks_the_spot',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const prompt = getSimpleChoicePrompt(result.matchState!, 'explorers_x_never_marks_the_spot');
        const ids = getPromptOptions(prompt)
            .filter(option => (
                (option.value?.minionUid === 'a' && option.value?.toBaseIndex === 2)
                || (option.value?.minionUid === 'b' && option.value?.toBaseIndex === 2)
            ))
            .map(option => option.id);
        const moved = respondToPromptOptions(result.matchState!, ids, '0', FIXED_RANDOM);

        expect(moved.success, moved.error).toBe(true);
        expect(moved.finalState.core.bases[0].minions).toEqual([]);
        expect(moved.finalState.core.bases[1].minions).toEqual([]);
        expect(moved.finalState.core.bases[2].minions.map(minion => minion.uid).sort()).toEqual(['a', 'b']);
    });

    it('我说了不要骆驼！给所选基地每个己方随从各 1 个 +1 指示物', () => {
        const core = makeState({
            bases: [
                makeBase('base_palooza', [
                    makeMinion('a', 'explorers_guide', '0', 4),
                    makeMinion('b', 'explorers_glory_hound', '0', 2),
                    makeMinion('enemy', 'rock_stars_groupie', '1', 2),
                ]),
            ],
        });

        const result = invokeRegisteredAbilityContract('explorers_i_said_no_camels', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'camels',
            defId: 'explorers_i_said_no_camels',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const chosen = respondToPromptOption(
            result.matchState!,
            option => option.value?.baseIndex === 0 && option.value?.mode === 'counters',
            'choose counters',
            '0',
            FIXED_RANDOM,
        );

        expect(chosen.success, chosen.error).toBe(true);
        expect(chosen.finalState.core.bases[0].minions.map(minion => [minion.uid, minion.powerCounters ?? 0])).toEqual([
            ['a', 1],
            ['b', 1],
            ['enemy', 0],
        ]);

        const drawCore = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('draw-a', 'explorers_guide', 'minion', '0'),
                        makeCard('draw-b', 'explorers_glory_hound', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_palooza', [
                    makeMinion('draw-minion-a', 'explorers_guide', '0', 4),
                    makeMinion('draw-minion-b', 'explorers_glory_hound', '0', 2),
                    makeMinion('draw-enemy', 'rock_stars_groupie', '1', 2),
                ]),
            ],
        });
        const drawResult = invokeRegisteredAbilityContract('explorers_i_said_no_camels', 'onPlay', {
            state: drawCore,
            matchState: makeMatchState(drawCore),
            playerId: '0',
            cardUid: 'camels-draw',
            defId: 'explorers_i_said_no_camels',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 11,
        });
        const drew = respondToPromptOption(
            drawResult.matchState!,
            option => option.value?.baseIndex === 0 && option.value?.mode === 'draw',
            'choose draw',
            '0',
            FIXED_RANDOM,
        );
        expect(drew.success, drew.error).toBe(true);
        expect(drew.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-a', 'draw-b']);
        expect(drew.finalState.core.bases[0].minions.map(minion => [minion.uid, minion.powerCounters ?? 0])).toEqual([
            ['draw-minion-a', 0],
            ['draw-minion-b', 0],
            ['draw-enemy', 0],
        ]);
    });

    it('利文斯通医生把基地上的唯一随从洗回其拥有者牌库', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { deck: [makeCard('deck-card', 'explorers_glory_hound', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_palooza', [makeMinion('lost-minion', 'rock_stars_groupie', '1', 2)]),
            ],
        });

        const result = invokeRegisteredAbilityContract('explorers_dr_livingstone_i_presume', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'livingstone',
            defId: 'explorers_dr_livingstone_i_presume',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const chosen = respondToPromptOption(result.matchState!, option => option.value?.minionUid === 'lost-minion', 'choose lone minion', '0', FIXED_RANDOM);

        expect(chosen.success, chosen.error).toBe(true);
        expect(chosen.finalState.core.bases[0].minions).toEqual([]);
        expect(chosen.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['lost-minion']);
    });

    it('古代神庙和黄金城在回合开始分别结算临时战力与 VP', () => {
        const templeCore = makeState({
            bases: [
                makeBase('base_ancient_temple', [
                    makeMinion('solo', 'explorers_guide', '0', 4),
                    makeMinion('enemy', 'rock_stars_groupie', '1', 2),
                ]),
            ],
        });
        const temple = triggerBaseAbilityWithMS('base_ancient_temple', 'onTurnStart', baseAbilityCtx(templeCore, 0));
        const afterTemple = applyEvents(templeCore, temple.events);

        expect(afterTemple.bases[0].minions.find(minion => minion.uid === 'solo')?.tempPowerModifier).toBe(5);

        const cityCore = makeState({
            bases: [makeBase('base_city_of_gold', [makeMinion('own', 'explorers_glory_hound', '0', 2)])],
        });
        const city = triggerBaseAbilityWithMS('base_city_of_gold', 'onTurnStart', baseAbilityCtx(cityCore, 0));
        const afterCity = applyEvents(cityCore, city.events);

        expect(afterCity.players['0'].vp).toBe(1);
    });
});
