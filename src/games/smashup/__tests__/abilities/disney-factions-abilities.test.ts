import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { hasActiveBaseAbility, hasBaseAbility, triggerActiveBaseAbility } from '../../domain/baseAbilities';
import { getEffectiveBreakpoint, getEffectivePower } from '../../domain/ongoingModifiers';
import { SU_EVENTS } from '../../domain/types';
import {
    applyEvents,
    expectRegisteredAbilityContract,
    invokeRegisteredAbilityContract,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    triggerBaseAbilityWithMS,
} from '../helpers';

const FIXED_RANDOM = {
    random: () => 0,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(items: T[]) => [...items],
};

describe('迪士尼四派系代表性玩法行为', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('核心可执行能力和迪士尼基地能力已注册', () => {
        const registrations = [
            ['aladdin_wish', 'onPlay'],
            ['aladdin_genie', 'talent'],
            ['beauty_and_the_beast_be_our_guest', 'talent'],
            ['beauty_and_the_beast_gaston', 'talent'],
            ['nightmare_before_christmas_oogie_boogie', 'onPlay'],
            ['nightmare_before_christmas_winter_surprise', 'onPlay'],
            ['wreck_it_ralph_king_candy', 'talent'],
            ['wreck_it_ralph_i_m_gonna_wreck_it', 'talent'],
        ] as const;

        for (const [defId, tag] of registrations) {
            expect(expectRegisteredAbilityContract(defId, tag), `${defId}::${tag}`).toBeTypeOf('function');
        }

        expect(hasActiveBaseAbility('base_agrabah_bazaar')).toBe(true);
        expect(hasActiveBaseAbility('base_gastons_tavern')).toBe(true);
        expect(hasActiveBaseAbility('base_the_power_strip')).toBe(true);
        expect(hasBaseAbility('base_sultans_palace', 'onMinionPlayed')).toBe(true);
        expect(hasBaseAbility('base_halloween_town', 'afterScoring')).toBe(true);
        expect(hasBaseAbility('base_spiral_hill', 'afterScoring')).toBe(true);
        expect(hasBaseAbility('base_the_dump', 'afterScoring')).toBe(true);
    });

    it('从手牌弃牌会记录本回合弃牌次数，回合开始时清空', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('discard-a', 'beauty_and_the_beast_discover_the_library', 'action', '0'),
                        makeCard('discard-b', 'aladdin_wish', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            cardsDiscardedFromHandThisTurn: { '0': 1 },
        });

        const afterDiscard = applyEvents(core, [{
            type: SU_EVENTS.CARDS_DISCARDED,
            payload: { playerId: '0', cardUids: ['discard-a', 'discard-b'] },
            timestamp: 10,
        } as any]);

        expect(afterDiscard.cardsDiscardedFromHandThisTurn?.['0']).toBe(3);
        expect(afterDiscard.players['0'].hand).toEqual([]);
        expect(afterDiscard.players['0'].discard.map(card => card.uid).sort()).toEqual(['discard-a', 'discard-b']);

        const afterTurnStart = applyEvents(afterDiscard, [{
            type: SU_EVENTS.TURN_STARTED,
            payload: { playerId: '0', turnNumber: 2 },
            timestamp: 11,
        } as any]);
        expect(afterTurnStart.cardsDiscardedFromHandThisTurn).toBeUndefined();
    });

    it('“我们的贵客”只在本回合已从手牌弃牌后抽牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw-card', 'beauty_and_the_beast_belle', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const blocked = invokeRegisteredAbilityContract('beauty_and_the_beast_be_our_guest', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'guest',
            defId: 'beauty_and_the_beast_be_our_guest',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 20,
        });
        expect(blocked.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(false);

        const allowed = invokeRegisteredAbilityContract('beauty_and_the_beast_be_our_guest', 'talent', {
            state: { ...core, cardsDiscardedFromHandThisTurn: { '0': 1 } },
            matchState: makeMatchState({ ...core, cardsDiscardedFromHandThisTurn: { '0': 1 } }),
            playerId: '0',
            cardUid: 'guest',
            defId: 'beauty_and_the_beast_be_our_guest',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 21,
        });
        const afterAllowed = applyEvents(core, allowed.events);
        expect(afterAllowed.players['0'].hand.map(card => card.uid)).toEqual(['draw-card']);
    });

    it('加斯顿提升基地爆破点，并可弃两张牌后离场', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('cost-a', 'aladdin_wish', 'action', '0'),
                        makeCard('cost-b', 'beauty_and_the_beast_discover_the_library', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_gastons_tavern',
                ongoingActions: [
                    { uid: 'gaston-action', defId: 'beauty_and_the_beast_gaston', ownerId: '0' },
                ],
            })],
        });

        expect(getEffectiveBreakpoint(core, 0)).toBe(31);

        const talent = invokeRegisteredAbilityContract('beauty_and_the_beast_gaston', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'gaston-action',
            defId: 'beauty_and_the_beast_gaston',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 30,
        });
        const afterTalent = applyEvents(core, talent.events);
        expect(afterTalent.bases[0].ongoingActions).toEqual([]);
        expect(afterTalent.players['0'].discard.map(card => card.uid).sort()).toEqual([
            'cost-a',
            'cost-b',
            'gaston-action',
        ]);
    });

    it('圣诞夜惊魂角色修正按控制者与宿主关系计算力量', () => {
        const core = makeState({
            bases: [makeBase('base_halloween_town', [
                makeMinion('mayor', 'nightmare_before_christmas_the_mayor_of_halloween_town', '0', 2),
                makeMinion('zero', 'nightmare_before_christmas_zero', '0', 1),
                makeMinion('own-host', 'aladdin_palace_guard', '0', 2, {
                    attachedActions: [
                        { uid: 'garland-own', defId: 'nightmare_before_christmas_monster_garland', ownerId: '0' },
                        { uid: 'costume-own', defId: 'nightmare_before_christmas_sandy_claws_costume', ownerId: '0' },
                    ],
                }),
                makeMinion('enemy-host', 'pirate_first_mate', '1', 2, {
                    attachedActions: [
                        {
                            uid: 'garland-enemy',
                            defId: 'nightmare_before_christmas_monster_garland',
                            ownerId: '0',
                            metadata: { sourceControllerId: '0' },
                        },
                    ],
                }),
                makeMinion('oogie-host', 'shield_agent', '1', 3, {
                    powerCounters: 2,
                    powerModifier: 1,
                    tempPowerModifier: 4,
                    attachedActions: [
                        {
                            uid: 'oogie',
                            defId: 'nightmare_before_christmas_oogie_boogie',
                            ownerId: '0',
                            metadata: { sourceControllerId: '0' },
                        },
                    ],
                }),
            ])],
        });

        expect(getEffectivePower(core, core.bases[0].minions[0], 0)).toBe(3);
        expect(getEffectivePower(core, core.bases[0].minions[1], 0)).toBe(5);
        expect(getEffectivePower(core, core.bases[0].minions[2], 0)).toBe(10);
        expect(getEffectivePower(core, core.bases[0].minions[3], 0)).toBe(0);
        expect(getEffectivePower(core, core.bases[0].minions[4], 0)).toBe(0);
    });

    it('万圣节镇和螺旋山丘在计分后处理角色修正牌', () => {
        const halloweenCore = makeState({
            players: {
                '0': makePlayer('0', { deck: [makeCard('deck-a', 'aladdin_wish', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_halloween_town', [
                makeMinion('host', 'pirate_first_mate', '0', 2, {
                    attachedActions: [
                        { uid: 'garland', defId: 'nightmare_before_christmas_monster_garland', ownerId: '0' },
                    ],
                }),
            ])],
        });
        const halloween = triggerBaseAbilityWithMS('base_halloween_town', 'afterScoring', {
            state: halloweenCore,
            matchState: makeMatchState(halloweenCore),
            playerId: '0',
            baseIndex: 0,
            baseDefId: 'base_halloween_town',
            random: FIXED_RANDOM,
            now: 40,
        });
        const afterHalloween = applyEvents(halloweenCore, halloween.events);
        expect(afterHalloween.bases[0].minions[0].attachedActions).toEqual([]);
        expect(afterHalloween.players['0'].deck.map(card => card.uid)).toEqual(['deck-a', 'garland']);

        const spiralCore = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('discard-mod', 'nightmare_before_christmas_monster_garland', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_spiral_hill', [
                makeMinion('host', 'pirate_first_mate', '0', 2),
            ])],
        });
        const spiral = triggerBaseAbilityWithMS('base_spiral_hill', 'afterScoring', {
            state: spiralCore,
            matchState: makeMatchState(spiralCore),
            playerId: '0',
            baseIndex: 0,
            baseDefId: 'base_spiral_hill',
            random: FIXED_RANDOM,
            now: 41,
        });
        const afterSpiral = applyEvents(spiralCore, spiral.events);
        expect(afterSpiral.players['0'].hand.map(card => card.uid)).toEqual(['discard-mod']);
        expect(afterSpiral.players['0'].discard).toEqual([]);
    });

    it('“不断的惊喜”把最多两张角色牌从弃牌堆洗入牌库', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-a', 'aladdin_wish', 'action', '0')],
                    discard: [
                        makeCard('minion-a', 'beauty_and_the_beast_belle', 'minion', '0'),
                        makeCard('minion-b', 'aladdin_abu', 'minion', '0'),
                        makeCard('left', 'nightmare_before_christmas_monster_garland', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('beauty_and_the_beast_ever_a_surprise', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'surprise',
            defId: 'beauty_and_the_beast_ever_a_surprise',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 50,
        });
        const after = applyEvents(core, result.events);
        expect(after.players['0'].deck.map(card => card.uid)).toEqual(['deck-a', 'minion-a', 'minion-b']);
        expect(after.players['0'].discard.map(card => card.uid)).toEqual(['left']);
    });

    it('阿格拉巴集市弃行动并给己方角色两个 +1 指示物，苏丹皇宫只在首个角色入场时抽牌', () => {
        const bazaarCore = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('action-cost', 'aladdin_wish', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_agrabah_bazaar', [
                makeMinion('guard', 'aladdin_palace_guard', '0', 2),
            ])],
        });
        const bazaar = triggerActiveBaseAbility('base_agrabah_bazaar', {
            state: bazaarCore,
            matchState: makeMatchState(bazaarCore),
            playerId: '0',
            baseIndex: 0,
            baseDefId: 'base_agrabah_bazaar',
            random: FIXED_RANDOM,
            now: 60,
        });
        const afterBazaar = applyEvents(bazaarCore, bazaar.events);
        expect(afterBazaar.players['0'].discard.map(card => card.uid)).toEqual(['action-cost']);
        expect(afterBazaar.bases[0].minions[0].powerCounters).toBe(2);

        const palaceCore = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw-card', 'aladdin_abu', 'minion', '0')],
                    minionsPlayedPerBase: { 0: 1 },
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_sultans_palace', [
                makeMinion('guard', 'aladdin_palace_guard', '0', 2),
            ])],
        });
        const first = triggerBaseAbilityWithMS('base_sultans_palace', 'onMinionPlayed', {
            state: palaceCore,
            matchState: makeMatchState(palaceCore),
            playerId: '0',
            baseIndex: 0,
            baseDefId: 'base_sultans_palace',
            minionUid: 'guard',
            minionDefId: 'aladdin_palace_guard',
            minionPower: 2,
            random: FIXED_RANDOM,
            now: 61,
        });
        const afterFirst = applyEvents(palaceCore, first.events);
        expect(afterFirst.players['0'].hand.map(card => card.uid)).toEqual(['draw-card']);

        const second = triggerBaseAbilityWithMS('base_sultans_palace', 'onMinionPlayed', {
            state: { ...palaceCore, players: { ...palaceCore.players, '0': { ...palaceCore.players['0'], minionsPlayedPerBase: { 0: 2 } } } },
            matchState: makeMatchState(palaceCore),
            playerId: '0',
            baseIndex: 0,
            baseDefId: 'base_sultans_palace',
            minionUid: 'guard',
            minionDefId: 'aladdin_palace_guard',
            minionPower: 2,
            random: FIXED_RANDOM,
            now: 62,
        });
        expect(second.events).toEqual([]);
    });

    it('“我要破坏它！”降低爆破点，糖果国王压制目标角色指示物并在发动者下回合清除', () => {
        const breakpointCore = makeState({
            bases: [makeBase({
                defId: 'base_the_dump',
                ongoingActions: [
                    { uid: 'wreck-it', defId: 'wreck_it_ralph_i_m_gonna_wreck_it', ownerId: '0' },
                ],
            })],
        });
        expect(getEffectiveBreakpoint(breakpointCore, 0)).toBe(17);

        const kingCore = makeState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            bases: [
                makeBase({
                    defId: 'base_the_dump',
                    ongoingActions: [
                        { uid: 'king-candy', defId: 'wreck_it_ralph_king_candy', ownerId: '0' },
                    ],
                    minions: [makeMinion('own-minion', 'wreck_it_ralph_sugar_rush_racer', '0', 2)],
                }),
                makeBase('base_the_power_strip', [
                    makeMinion('target', 'pirate_first_mate', '1', 2, {
                        powerCounters: 3,
                        attachedActions: [
                            { uid: 'enemy-attach', defId: 'nightmare_before_christmas_monster_garland', ownerId: '1' },
                        ],
                    }),
                ]),
            ],
        });

        const talent = invokeRegisteredAbilityContract('wreck_it_ralph_king_candy', 'talent', {
            state: kingCore,
            matchState: makeMatchState(kingCore),
            playerId: '0',
            cardUid: 'king-candy',
            defId: 'wreck_it_ralph_king_candy',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 70,
        });
        const afterTalent = applyEvents(kingCore, talent.events);
        expect(afterTalent.bases[1].ongoingActions[0]).toEqual(expect.objectContaining({
            uid: 'king-candy',
            metadata: expect.objectContaining({ kingCandyTargetMinionUid: 'target' }),
        }));
        expect(afterTalent.bases[1].minions[0].metadata).toEqual(expect.objectContaining({
            kingCandyCounterSuppressedBy: 'king-candy',
            kingCandyCounterSuppressedByPlayerId: '0',
        }));
        expect(getEffectivePower(afterTalent, afterTalent.bases[1].minions[0], 1)).toBe(2);

        const cleared = applyEvents(afterTalent, [{
            type: SU_EVENTS.TURN_STARTED,
            payload: { playerId: '0', turnNumber: 2 },
            timestamp: 71,
        } as any]);
        expect(cleared.bases[1].minions[0].metadata?.kingCandyCounterSuppressedBy).toBeUndefined();
        expect(getEffectivePower(cleared, cleared.bases[1].minions[0], 1)).toBe(8);
    });
});
