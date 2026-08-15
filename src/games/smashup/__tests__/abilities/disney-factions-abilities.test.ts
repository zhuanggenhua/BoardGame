import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { hasActiveBaseAbility, hasBaseAbility, triggerActiveBaseAbility } from '../../domain/baseAbilities';
import { scoreOneBase } from '../../domain';
import { getEffectiveBreakpoint, getEffectivePower } from '../../domain/ongoingModifiers';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import {
    applyEvents,
    expectRegisteredAbilityContract,
    getPromptOptions,
    getReactionPrompt,
    getReactionPromptOptionBySourceDefId,
    getSimpleChoicePrompt,
    invokeRegisteredAbilityContract,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPrompt,
    respondToPromptOptions,
    respondToPromptOption,
    triggerBaseAbilityWithMS,
} from '../helpers';
import { runCommand } from '../testRunner';

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

    it('丛林乐园：计分弃牌后从真实反应选择进入 +1 力量标记', () => {
        const core = makeState({
            bases: [makeBase('base_jungle_paradise', [
                makeMinion('discarded-minion', 'lion_king_simba', '0', 30),
            ]), makeBase('base_the_jungle', [
                makeMinion('target-minion', 'lion_king_zazu', '0', 2),
            ])],
        });
        const result = scoreOneBase(
            core,
            0,
            [],
            '0',
            1000,
            FIXED_RANDOM,
            makeMatchState(core),
        );

        expect(result.matchState).toBeDefined();
        const reactionPrompt = getReactionPrompt(result.matchState!);
        const jungleOption = getReactionPromptOptionBySourceDefId(
            result.matchState!,
            reactionPrompt,
            'base_jungle_paradise',
        );
        const opened = respondToPrompt(result.matchState!, jungleOption.id, '0', FIXED_RANDOM);
        const targetPrompt = getSimpleChoicePrompt(opened.finalState, 'disney_four_factions_prompt');
        const resolved = respondToPromptOption(
            opened.finalState,
            option => option.value?.minionUid === 'target-minion',
            '丛林乐园选择目标随从',
            '0',
            FIXED_RANDOM,
        );

        expect(targetPrompt).toBeTruthy();
        expect(resolved.finalState.core.bases[1].minions.find(minion => minion.uid === 'target-minion')?.powerCounters).toBe(1);
        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.POWER_COUNTER_ADDED,
            payload: expect.objectContaining({ minionUid: 'target-minion', amount: 1 }),
        }));
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

    it('贝儿：天赋让玩家选择摸 1 张牌或弃 1 张手牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('discard-a', 'aladdin_wish', 'action', '0'),
                        makeCard('discard-b', 'beauty_and_the_beast_discover_the_library', 'action', '0'),
                    ],
                    deck: [makeCard('draw-card', 'beauty_and_the_beast_beast', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('test_base', [
                makeMinion('belle', 'beauty_and_the_beast_belle', '0', 4),
            ])],
        });

        const drawPromptResult = invokeRegisteredAbilityContract('beauty_and_the_beast_belle', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'belle',
            defId: 'beauty_and_the_beast_belle',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 22,
        });
        const drawPrompt = getSimpleChoicePrompt(drawPromptResult.matchState!, 'beauty_and_the_beast_belle_talent');
        expect(getPromptOptions(drawPrompt).map(option => option.id)).toEqual(['draw', 'discard:discard-a', 'discard:discard-b']);
        const drawn = respondToPrompt(drawPromptResult.matchState!, 'draw', '0', FIXED_RANDOM);
        expect(drawn.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['discard-a', 'discard-b', 'draw-card']);

        const discardPromptResult = invokeRegisteredAbilityContract('beauty_and_the_beast_belle', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'belle',
            defId: 'beauty_and_the_beast_belle',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 23,
        });
        const discarded = respondToPromptOption(
            discardPromptResult.matchState!,
            option => option.value?.cardUid === 'discard-a',
            '贝儿弃掉指定手牌',
            '0',
            FIXED_RANDOM,
        );
        expect(discarded.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['discard-b']);
        expect(discarded.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['discard-a']);
        expect(discarded.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(false);
    });

    it('野兽：天赋按野兽自身选择弃牌并放置力量指示物，不受同基地其他随从顺序影响', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('keep-card', 'aladdin_wish', 'action', '0'),
                        makeCard('cost-card', 'beauty_and_the_beast_discover_the_library', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('test_base', [
                makeMinion('other-minion', 'beauty_and_the_beast_belle', '0', 5),
                makeMinion('beast', 'beauty_and_the_beast_beast', '0', 4),
            ])],
        });

        const result = invokeRegisteredAbilityContract('beauty_and_the_beast_beast', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'beast',
            defId: 'beauty_and_the_beast_beast',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 24,
        });
        const prompt = getSimpleChoicePrompt(result.matchState!, 'beauty_and_the_beast_discard_hand');
        expect(getPromptOptions(prompt).map(option => option.value?.cardUid)).toEqual(['keep-card', 'cost-card']);

        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.cardUid === 'cost-card',
            '野兽选择弃掉指定手牌',
            '0',
            FIXED_RANDOM,
        );
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['keep-card']);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['cost-card']);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'beast')?.powerCounters).toBe(1);
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
        const prompt = getSimpleChoicePrompt(talent.matchState!, 'beauty_and_the_beast_discard_hand');
        expect(getPromptOptions(prompt).map(option => option.value?.cardUid).filter(Boolean)).toEqual(['cost-a', 'cost-b']);
        const resolved = respondToPromptOptions(
            talent.matchState!,
            ['discard:cost-a', 'discard:cost-b'],
            '0',
            FIXED_RANDOM,
        );
        expect(resolved.finalState.core.bases[0].ongoingActions).toEqual([]);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid).sort()).toEqual([
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

    it('“冬季惊喜”从弃牌堆取回角色修正牌后给出额外行动并回牌库底', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('winter-surprise', 'nightmare_before_christmas_winter_surprise', 'action', '0')],
                    deck: [makeCard('deck-a', 'aladdin_wish', 'action', '0')],
                    discard: [makeCard('discard-mod', 'nightmare_before_christmas_monster_garland', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('nightmare_before_christmas_winter_surprise', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'winter-surprise',
            defId: 'nightmare_before_christmas_winter_surprise',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 45,
        });

        expect(result.events.map(event => event.type)).toEqual([
            SU_EVENTS.CARD_RECOVERED_FROM_DISCARD,
            SU_EVENTS.LIMIT_MODIFIED,
            SU_EVENTS.CARD_TO_DECK_BOTTOM,
        ]);
        const after = applyEvents(core, result.events);
        expect(after.players['0'].hand.map(card => card.uid).sort()).toEqual(['discard-mod']);
        expect(after.players['0'].deck.map(card => card.uid)).toEqual(['deck-a', 'winter-surprise']);
        expect(after.players['0'].discard).toEqual([]);
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

    it('玫瑰花瓣：从手牌弃掉后查看牌库顶并可交换前两张顺序', () => {
        const fillerHand = Array.from({ length: 10 }, (_, index) =>
            makeCard(`filler-${index}`, 'aladdin_wish', 'action', '0'));
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('petals', 'beauty_and_the_beast_petals_of_the_rose', 'action', '0'),
                        ...fillerHand,
                    ],
                    deck: [
                        makeCard('top-a', 'beauty_and_the_beast_belle', 'minion', '0'),
                        makeCard('top-b', 'beauty_and_the_beast_beast', 'minion', '0'),
                        makeCard('tail', 'aladdin_abu', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });
        const matchState = makeMatchState(core);
        matchState.sys.phase = 'draw';

        const discarded = runCommand(matchState, {
            type: SU_COMMANDS.DISCARD_TO_LIMIT,
            playerId: '0',
            payload: { cardUids: ['petals'] },
        }, FIXED_RANDOM);
        expect(discarded.success).toBe(true);
        expect(discarded.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['petals']);

        const reactionPrompt = getReactionPrompt(discarded.finalState);
        const petalsOption = getReactionPromptOptionBySourceDefId(discarded.finalState, reactionPrompt, 'beauty_and_the_beast_petals_of_the_rose');
        const openedPetalsPrompt = respondToPrompt(discarded.finalState, petalsOption.id, '0', FIXED_RANDOM);
        const petalsPrompt = getSimpleChoicePrompt(openedPetalsPrompt.finalState, 'beauty_and_the_beast_petals_of_the_rose');
        const swapped = respondToPromptOption(
            openedPetalsPrompt.finalState,
            option => option.value?.mode === 'swap',
            '玫瑰花瓣交换前两张',
            '0',
            FIXED_RANDOM,
        );

        expect(swapped.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['top-b', 'top-a', 'tail']);
        expect(swapped.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.DECK_INSPECTED,
            payload: expect.objectContaining({ targetPlayerId: '0', inspectorPlayerId: '0', count: 2 }),
        }));
        expect(swapped.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.DECK_REORDERED,
            payload: expect.objectContaining({ playerId: '0', deckUids: ['top-b', 'top-a', 'tail'] }),
        }));
        expect(petalsPrompt).toBeTruthy();
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
