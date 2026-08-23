import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { hasActiveBaseAbility, hasBaseAbility, triggerActiveBaseAbility, triggerBaseAbility } from '../../domain/baseAbilities';
import { fireTriggers } from '../../domain/ongoingEffects';
import { getEffectiveBreakpoint, getEffectivePower } from '../../domain/ongoingModifiers';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import {
    applyEvents,
    expectRegisteredAbilityContract,
    getOptionalSimpleChoicePrompt,
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
    scoreBaseViaFlow,
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
        const result = scoreBaseViaFlow(
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

    it('阿拉丁搜神灯时由玩家在牌库和弃牌堆候选中选择，不自动拿牌库第一张', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-lamp', 'aladdin_the_lamp', 'action', '0')],
                    discard: [makeCard('discard-lamp', 'aladdin_the_lamp', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_agrabah_bazaar')],
        });

        const result = invokeRegisteredAbilityContract('aladdin_aladdin', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'aladdin',
            defId: 'aladdin_aladdin',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 13,
        });

        const prompt = getSimpleChoicePrompt(result.matchState!, 'aladdin_aladdin_search');
        expect(prompt.autoResolveIfSingle).toBe(false);
        expect(getPromptOptions(prompt).map(option => [option.value?.cardUid, option.value?.zone])).toEqual([
            ['deck-lamp', 'deck'],
            ['discard-lamp', 'discard'],
        ]);

        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.cardUid === 'discard-lamp',
            '阿拉丁选择弃牌堆神灯',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('discard-lamp');
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-lamp']);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('discard-lamp');
    });

    it('贾方让其他玩家各自选择弃掉的行动，出牌者再选择要额外打出的行动', () => {
        const core = makeState({
            turnOrder: ['0', '1', '2'],
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('jafar', 'aladdin_jafar', 'action', '0'),
                        makeCard('own-action', 'aladdin_wish', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    hand: [
                        makeCard('p1-first', 'aladdin_cave_of_wonders', 'action', '1'),
                        makeCard('p1-second', 'aladdin_wish', 'action', '1'),
                    ],
                }),
                '2': makePlayer('2', {
                    hand: [makeCard('p2-only', 'aladdin_street_rat', 'action', '2')],
                }),
            },
            bases: [makeBase('base_agrabah_bazaar')],
        });

        const played = invokeRegisteredAbilityContract('aladdin_jafar', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'jafar',
            defId: 'aladdin_jafar',
            random: FIXED_RANDOM,
            now: 20,
        });

        expect(played.events).toEqual([]);
        const p1Prompt = getSimpleChoicePrompt(played.matchState!, 'aladdin_jafar_discard_action');
        expect(p1Prompt.playerId).toBe('1');
        expect(getPromptOptions(p1Prompt).map(option => option.value?.cardUid)).toEqual(['p1-first', 'p1-second']);
        const p1DiscardedSecond = respondToPromptOption(
            played.matchState!,
            option => option.value?.cardUid === 'p1-second',
            '贾方玩家 1 选择第二张行动弃掉',
            '1',
            FIXED_RANDOM,
        );
        expect(p1DiscardedSecond.success).toBe(true);
        expect(p1DiscardedSecond.finalState.core.players['1'].discard.map(card => card.uid)).toContain('p1-second');
        expect(p1DiscardedSecond.finalState.core.players['1'].hand.map(card => card.uid)).toContain('p1-first');

        const p2Prompt = getSimpleChoicePrompt(p1DiscardedSecond.finalState, 'aladdin_jafar_discard_action');
        expect(p2Prompt.playerId).toBe('2');
        expect(getPromptOptions(p2Prompt).map(option => option.value?.cardUid)).toEqual(['p2-only']);
        const p2DiscardedOnly = respondToPromptOption(
            p1DiscardedSecond.finalState,
            option => option.value?.cardUid === 'p2-only',
            '贾方玩家 2 确认唯一行动弃掉',
            '2',
            FIXED_RANDOM,
        );
        expect(p2DiscardedOnly.success).toBe(true);

        const extraPrompt = getSimpleChoicePrompt(p2DiscardedOnly.finalState, 'aladdin_jafar_extra_action');
        const extraCardUids = getPromptOptions(extraPrompt).map(option => option.value?.cardUid).filter(Boolean);
        expect(extraCardUids).toEqual(expect.arrayContaining(['p1-second', 'p2-only', 'own-action']));
        expect(extraCardUids).not.toContain('p1-first');
        const choseP2Discard = respondToPromptOption(
            p2DiscardedOnly.finalState,
            option => option.value?.cardUid === 'p2-only',
            '贾方选择第二名玩家弃掉的行动',
            '0',
            FIXED_RANDOM,
        );

        expect(choseP2Discard.success).toBe(true);
        expect(choseP2Discard.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARD_TRANSFERRED,
            payload: expect.objectContaining({ cardUid: 'p2-only', fromPlayerId: '2', toPlayerId: '0' }),
        }));
        expect(choseP2Discard.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({ limitType: 'action', restrictToCardUid: 'p2-only' }),
        }));
    });

    it('魔毯天赋不自动选择目标基地和同行角色', () => {
        const core = makeState({
            bases: [
                makeBase('base_agrabah_bazaar', [
                    makeMinion('carpet', 'aladdin_carpet', '0', 1),
                    makeMinion('chosen-b', 'aladdin_abu', '0', 2),
                    makeMinion('stay-c', 'aladdin_palace_guard', '0', 2),
                    makeMinion('chosen-d', 'aladdin_jasmine', '0', 3),
                ]),
                makeBase('base_sultans_palace'),
            ],
        });

        const talent = invokeRegisteredAbilityContract('aladdin_carpet', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'carpet',
            defId: 'aladdin_carpet',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 30,
        });

        expect(talent.events).toEqual([]);
        const destinationPrompt = getSimpleChoicePrompt(talent.matchState!, 'aladdin_carpet_destination');
        expect(destinationPrompt.autoResolveIfSingle).toBe(false);
        expect(getPromptOptions(destinationPrompt).map(option => option.value?.baseIndex)).toEqual([1]);

        const choseDestination = respondToPromptOption(
            talent.matchState!,
            option => option.value?.baseIndex === 1,
            '魔毯确认唯一目标基地',
            '0',
            FIXED_RANDOM,
        );
        expect(choseDestination.success).toBe(true);

        const companionPrompt = getSimpleChoicePrompt(choseDestination.finalState, 'aladdin_carpet_companions');
        expect(companionPrompt.autoResolveIfSingle).toBe(false);
        expect(companionPrompt.multi).toMatchObject({ min: 0, max: 2 });
        const companionOptions = getPromptOptions(companionPrompt);
        const selectedIds = companionOptions
            .filter(option => option.value?.minionUid === 'chosen-b' || option.value?.minionUid === 'chosen-d')
            .map(option => option.id);
        expect(selectedIds).toHaveLength(2);

        const resolved = respondToPromptOptions(choseDestination.finalState, selectedIds, '0', FIXED_RANDOM);
        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['stay-c']);
        expect(resolved.finalState.core.bases[1].minions.map(minion => minion.uid).sort()).toEqual(['carpet', 'chosen-b', 'chosen-d']);
    });

    it('茉莉公主弃行动牌作为费用时必须让玩家选择，不自动弃第一张', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('keep-action', 'aladdin_wish', 'action', '0'),
                        makeCard('cost-action', 'aladdin_cave_of_wonders', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_agrabah_bazaar', [
                makeMinion('jasmine', 'aladdin_jasmine', '0', 4),
            ])],
        });

        const talent = invokeRegisteredAbilityContract('aladdin_jasmine', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'jasmine',
            defId: 'aladdin_jasmine',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 31,
        });

        expect(talent.events).toEqual([]);
        const prompt = getSimpleChoicePrompt(talent.matchState!, 'aladdin_discard_action_cost');
        expect(prompt.autoResolveIfSingle).toBe(false);
        expect(getPromptOptions(prompt).map(option => option.value?.cardUid)).toEqual(['keep-action', 'cost-action']);

        const resolved = respondToPromptOption(
            talent.matchState!,
            option => option.value?.cardUid === 'cost-action',
            '茉莉选择第二张行动作为费用',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['keep-action']);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['cost-action']);
        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({ limitType: 'action', reason: 'aladdin_jasmine' }),
        }));
    });

    it('王宫守卫只有一张行动费用时仍等待玩家确认，不自动弃牌加指示物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('only-action', 'aladdin_wish', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_agrabah_bazaar', [
                makeMinion('guard-a', 'aladdin_palace_guard', '0', 2),
                makeMinion('guard-b', 'aladdin_palace_guard', '0', 2),
            ])],
        });

        const talent = invokeRegisteredAbilityContract('aladdin_palace_guard', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'guard-a',
            defId: 'aladdin_palace_guard',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 32,
        });

        const prompt = getSimpleChoicePrompt(talent.matchState!, 'aladdin_discard_action_cost');
        expect(prompt.autoResolveIfSingle).toBe(false);
        expect(getPromptOptions(prompt).map(option => option.value?.cardUid)).toEqual(['only-action']);
        expect(talent.matchState!.core.players['0'].discard).toEqual([]);
        expect(talent.matchState!.core.bases[0].minions.map(minion => minion.powerCounters ?? 0)).toEqual([0, 0]);

        const resolved = respondToPromptOption(
            talent.matchState!,
            option => option.value?.cardUid === 'only-action',
            '王宫守卫确认唯一行动费用',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['only-action']);
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.powerCounters ?? 0)).toEqual([1, 1]);
    });

    it('阿布和奇迹之洞从弃牌堆选行动牌时不自动拿第一张', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-a', 'aladdin_wish', 'action', '0')],
                    discard: [
                        makeCard('first-action', 'aladdin_a_friend_like_me', 'action', '0'),
                        makeCard('chosen-action', 'aladdin_wish', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_agrabah_bazaar', [
                makeMinion('abu', 'aladdin_abu', '0', 3),
            ])],
        });

        const abu = invokeRegisteredAbilityContract('aladdin_abu', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'abu',
            defId: 'aladdin_abu',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 33,
        });
        const abuPrompt = getSimpleChoicePrompt(abu.matchState!, 'aladdin_abu_discard_action');
        expect(abuPrompt.autoResolveIfSingle).toBe(false);
        const choseForTop = respondToPromptOption(
            abu.matchState!,
            option => option.value?.cardUid === 'chosen-action',
            '阿布选择第二张弃牌堆行动置顶',
            '0',
            FIXED_RANDOM,
        );
        expect(choseForTop.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['chosen-action', 'deck-a']);
        expect(choseForTop.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['first-action']);

        const cave = invokeRegisteredAbilityContract('aladdin_cave_of_wonders', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'cave',
            defId: 'aladdin_cave_of_wonders',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 34,
        });
        const cavePrompt = getSimpleChoicePrompt(cave.matchState!, 'aladdin_cave_of_wonders');
        expect(cavePrompt.autoResolveIfSingle).toBe(false);
        const recovered = respondToPromptOption(
            cave.matchState!,
            option => option.value?.cardUid === 'chosen-action',
            '奇迹之洞选择第二张弃牌堆行动入手',
            '0',
            FIXED_RANDOM,
        );
        expect(recovered.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['chosen-action']);
        expect(recovered.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['first-action']);

        const caveNoInteraction = invokeRegisteredAbilityContract('aladdin_cave_of_wonders', 'onPlay', {
            state: core,
            matchState: undefined,
            playerId: '0',
            cardUid: 'cave',
            defId: 'aladdin_cave_of_wonders',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 35,
        });
        expect(caveNoInteraction.events).toEqual([]);
    });

    it('街头混混从其他玩家弃牌堆额外打行动时由玩家选择具体牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    discard: [
                        makeCard('first-action', 'aladdin_a_friend_like_me', 'action', '1'),
                        makeCard('chosen-action', 'aladdin_wish', 'action', '1'),
                    ],
                }),
            },
        });

        const played = invokeRegisteredAbilityContract('aladdin_street_rat', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'street-rat',
            defId: 'aladdin_street_rat',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 35,
        });

        expect(played.events).toEqual([]);
        const prompt = getSimpleChoicePrompt(played.matchState!, 'aladdin_street_rat');
        expect(prompt.autoResolveIfSingle).toBe(false);
        expect(getPromptOptions(prompt).map(option => option.value?.cardUid)).toEqual(['first-action', 'chosen-action']);
        const resolved = respondToPromptOption(
            played.matchState!,
            option => option.value?.cardUid === 'chosen-action',
            '街头混混选择第二张对手弃牌堆行动',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['chosen-action']);
        expect(resolved.finalState.core.players['1'].discard.map(card => card.uid)).toEqual(['first-action']);
        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({ limitType: 'action', restrictToCardUid: 'chosen-action' }),
        }));

        const noInteraction = invokeRegisteredAbilityContract('aladdin_street_rat', 'onPlay', {
            state: core,
            matchState: undefined,
            playerId: '0',
            cardUid: 'street-rat',
            defId: 'aladdin_street_rat',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 36,
        });
        expect(noInteraction.events).toEqual([]);
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

    it('野兽：只有一张可弃手牌时仍等待玩家确认，不自动替玩家弃牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('only-cost', 'aladdin_wish', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('test_base', [
                makeMinion('beast', 'beauty_and_the_beast_beast', '0', 4),
            ])],
        });

        const talent = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'beast', baseIndex: 0 },
        } as any, FIXED_RANDOM);

        expect(talent.success, talent.error).toBe(true);
        const prompt = getSimpleChoicePrompt(talent.finalState, 'beauty_and_the_beast_discard_hand');
        expect(prompt.autoResolveIfSingle).toBe(false);
        expect(getPromptOptions(prompt).map(option => option.value?.cardUid)).toEqual(['only-cost']);
        expect(talent.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['only-cost']);
        expect(talent.finalState.core.players['0'].discard).toEqual([]);
        expect(talent.finalState.core.bases[0].minions.find(minion => minion.uid === 'beast')?.powerCounters ?? 0).toBe(0);

        const resolved = respondToPromptOption(
            talent.finalState,
            option => option.value?.cardUid === 'only-cost',
            '野兽确认弃掉唯一手牌',
            '0',
            FIXED_RANDOM,
        );
        expect(resolved.finalState.core.players['0'].hand).toEqual([]);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['only-cost']);
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

    it('乌基布基移动角色时必须按玩家选择的目的地移动', () => {
        const core = makeState({
            bases: [
                makeBase('base_halloween_town', [
                    makeMinion('oogie-host', 'frozen_anna', '1', 3),
                ]),
                makeBase('base_spiral_hill'),
                makeBase('base_alpha'),
            ],
        });
        const result = invokeRegisteredAbilityContract('nightmare_before_christmas_oogie_boogie', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'oogie',
            defId: 'nightmare_before_christmas_oogie_boogie',
            baseIndex: 0,
            targetMinionUid: 'oogie-host',
            random: FIXED_RANDOM,
            now: 41,
        });
        const prompt = getSimpleChoicePrompt(result.matchState!, 'nightmare_before_christmas_oogie_boogie_move_character');
        expect(prompt.autoResolveIfSingle).toBe(false);
        expect(getPromptOptions(prompt).filter(option => option.value?.targetBaseIndex !== undefined)
            .map(option => option.value?.targetBaseIndex)).toEqual([1, 2]);
        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.targetBaseIndex === 2,
            'move Oogie Boogie host to selected base',
            '0',
            FIXED_RANDOM,
        );
        expect(resolved.events.some(event =>
            event.type === SU_EVENTS.MINION_MOVED
            && (event as any).payload.minionUid === 'oogie-host'
            && (event as any).payload.toBaseIndex === 2,
        )).toBe(true);

        const noInteraction = invokeRegisteredAbilityContract('nightmare_before_christmas_oogie_boogie', 'onPlay', {
            state: core,
            matchState: undefined,
            playerId: '0',
            cardUid: 'oogie',
            defId: 'nightmare_before_christmas_oogie_boogie',
            baseIndex: 0,
            targetMinionUid: 'oogie-host',
            random: FIXED_RANDOM,
            now: 42,
        });
        expect(noInteraction.events).toEqual([]);
    });

    it('圣诞夜惊魂检索或额外打出角色修正牌时必须由玩家选择具体牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('hand-garland', 'nightmare_before_christmas_monster_garland', 'action', '0'),
                        makeCard('hand-costume', 'nightmare_before_christmas_sandy_claws_costume', 'action', '0'),
                    ],
                    discard: [
                        makeCard('discard-garland', 'nightmare_before_christmas_monster_garland', 'action', '0'),
                        makeCard('discard-costume', 'nightmare_before_christmas_sandy_claws_costume', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const jack = invokeRegisteredAbilityContract('nightmare_before_christmas_jack_skellington', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'jack',
            defId: 'nightmare_before_christmas_jack_skellington',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 42,
        });
        const jackPrompt = getSimpleChoicePrompt(jack.matchState!, 'nightmare_before_christmas_jack_skellington_recover');
        expect(jack.events).toEqual([]);
        expect(jackPrompt.autoResolveIfSingle).toBe(false);
        expect(getPromptOptions(jackPrompt).map(option => option.value?.cardUid)).toEqual(['discard-garland', 'discard-costume']);
        const jackResolved = respondToPromptOption(
            jack.matchState!,
            option => option.value?.cardUid === 'discard-costume',
            'jack discard modifier choice',
            '0',
            FIXED_RANDOM,
        );
        expect(jackResolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('discard-costume');
        expect(jackResolved.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['discard-garland']);

        const jackNoInteraction = invokeRegisteredAbilityContract('nightmare_before_christmas_jack_skellington', 'onPlay', {
            state: core,
            matchState: undefined,
            playerId: '0',
            cardUid: 'jack',
            defId: 'nightmare_before_christmas_jack_skellington',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 43,
        });
        expect(jackNoInteraction.events).toEqual([]);

        const sally = invokeRegisteredAbilityContract('nightmare_before_christmas_sally', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'sally',
            defId: 'nightmare_before_christmas_sally',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 43,
        });
        const sallyPrompt = getSimpleChoicePrompt(sally.matchState!, 'nightmare_before_christmas_sally_play_modifier');
        expect(sally.events).toEqual([]);
        expect(sallyPrompt.autoResolveIfSingle).toBe(false);
        expect(getPromptOptions(sallyPrompt).map(option => option.value?.cardUid)).toEqual(['hand-garland', 'hand-costume']);
        const sallyResolved = respondToPromptOption(
            sally.matchState!,
            option => option.value?.cardUid === 'hand-costume',
            'sally hand modifier choice',
            '0',
            FIXED_RANDOM,
        );
        expect(sallyResolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({
                playerId: '0',
                limitType: 'action',
                restrictToCardUid: 'hand-costume',
            }),
        }));
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
        expect(halloween.events).toEqual([]);
        const halloweenPrompt = getSimpleChoicePrompt(halloween.matchState!, 'base_halloween_town_modifiers');
        expect(halloweenPrompt.autoResolveIfSingle).toBe(false);
        expect(getPromptOptions(halloweenPrompt).map(option => option.value?.cardUid)).toEqual(['garland']);
        const halloweenResolved = respondToPromptOptions(
            halloween.matchState!,
            ['modifier-garland'],
            '0',
            FIXED_RANDOM,
        );
        const afterHalloween = halloweenResolved.finalState.core;
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
        expect(spiral.events).toEqual([]);
        const spiralPrompt = getSimpleChoicePrompt(spiral.matchState!, 'base_spiral_hill_modifier');
        expect(spiralPrompt.autoResolveIfSingle).toBe(false);
        expect(getPromptOptions(spiralPrompt).map(option => option.value?.cardUid ?? option.id)).toEqual([
            'skip',
            'discard-mod',
        ]);
        const spiralResolved = respondToPromptOption(
            spiral.matchState!,
            option => option.value?.cardUid === 'discard-mod',
            'spiral hill discard modifier',
            '0',
            FIXED_RANDOM,
        );
        const afterSpiral = spiralResolved.finalState.core;
        expect(afterSpiral.players['0'].hand.map(card => card.uid)).toEqual(['discard-mod']);
        expect(afterSpiral.players['0'].discard).toEqual([]);

        const spiralNoInteraction = triggerBaseAbility('base_spiral_hill', 'afterScoring', {
            state: spiralCore,
            playerId: '0',
            baseIndex: 0,
            baseDefId: 'base_spiral_hill',
            random: FIXED_RANDOM,
            now: 42,
        } as any);
        expect(spiralNoInteraction.events).toEqual([]);
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

        expect(result.events).toEqual([]);
        const prompt = getSimpleChoicePrompt(result.matchState!, 'nightmare_before_christmas_winter_surprise_play_modifier');
        expect(prompt.autoResolveIfSingle).toBe(false);
        expect(getPromptOptions(prompt).map(option => option.value?.cardUid)).toEqual(['discard-mod']);
        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.cardUid === 'discard-mod',
            'winter surprise discard modifier',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.events
            .map(event => event.type)
            .filter(type => type !== 'SYS_INTERACTION_RESOLVED')).toEqual([
            SU_EVENTS.CARD_RECOVERED_FROM_DISCARD,
            SU_EVENTS.LIMIT_MODIFIED,
            SU_EVENTS.CARD_TO_DECK_BOTTOM,
        ]);
        const after = resolved.finalState.core;
        expect(after.players['0'].hand.map(card => card.uid).sort()).toEqual(['discard-mod']);
        expect(after.players['0'].deck.map(card => card.uid)).toEqual(['deck-a', 'winter-surprise']);
        expect(after.players['0'].discard).toEqual([]);

        const noInteraction = invokeRegisteredAbilityContract('nightmare_before_christmas_winter_surprise', 'onPlay', {
            state: core,
            matchState: undefined,
            playerId: '0',
            cardUid: 'winter-surprise',
            defId: 'nightmare_before_christmas_winter_surprise',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 46,
        });
        expect(noInteraction.events.some(event => event.type === SU_EVENTS.CARD_RECOVERED_FROM_DISCARD)).toBe(false);
        expect(noInteraction.events.some(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toBe(false);
        expect(noInteraction.events).toContainEqual(expect.objectContaining({ type: SU_EVENTS.CARD_TO_DECK_BOTTOM }));
    });

    it('“不断的惊喜”按玩家选择把至多两张角色牌从弃牌堆洗入牌库', () => {
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
        expect(result.events).toEqual([]);
        const prompt = getSimpleChoicePrompt(result.matchState!, 'beauty_and_the_beast_ever_a_surprise');
        expect(prompt.autoResolveIfSingle).toBe(false);
        expect(prompt.multi).toMatchObject({ min: 0, max: 2 });
        const resolved = respondToPromptOptions(
            result.matchState!,
            getPromptOptions(prompt)
                .filter(option => option.value?.cardUid === 'minion-b')
                .map(option => option.id),
            '0',
            FIXED_RANDOM,
        );
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-a', 'minion-b']);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['minion-a', 'left']);
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

    it('魔法城堡：回合末抽牌阶段弃到手牌上限仍算当前回合，并且不自动给第一个角色', () => {
        const fillerHand = Array.from({ length: 10 }, (_, index) =>
            makeCard(`castle-filler-${index}`, 'aladdin_wish', 'action', '0'));
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('castle-discard', 'aladdin_wish', 'action', '0'),
                        ...fillerHand,
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_enchanted_castle', [
                makeMinion('first-minion', 'beauty_and_the_beast_belle', '0', 3),
                makeMinion('second-minion', 'beauty_and_the_beast_beast', '0', 5),
            ])],
        });
        const matchState = makeMatchState(core);
        matchState.sys.phase = 'draw';

        const discarded = runCommand(matchState, {
            type: SU_COMMANDS.DISCARD_TO_LIMIT,
            playerId: '0',
            payload: { cardUids: ['castle-discard'] },
        }, FIXED_RANDOM);
        expect(discarded.success).toBe(true);
        expect(discarded.finalState.sys.phase).toBe('draw');
        expect(discarded.finalState.core.currentPlayerIndex).toBe(0);

        const reactionPrompt = getReactionPrompt(discarded.finalState);
        const castleOption = getReactionPromptOptionBySourceDefId(discarded.finalState, reactionPrompt, 'base_enchanted_castle');
        const openedTargetPrompt = respondToPrompt(discarded.finalState, castleOption.id, '0', FIXED_RANDOM);
        const targetPrompt = getSimpleChoicePrompt(openedTargetPrompt.finalState, 'base_enchanted_castle');

        expect(targetPrompt).toBeTruthy();
        expect(targetPrompt.autoResolveIfSingle).toBe(false);
        expect(openedTargetPrompt.finalState.core.bases[0].minions.find(minion => minion.uid === 'first-minion')?.powerCounters ?? 0).toBe(0);
        expect(openedTargetPrompt.finalState.core.bases[0].minions.find(minion => minion.uid === 'second-minion')?.powerCounters ?? 0).toBe(0);

        const resolved = respondToPromptOption(
            openedTargetPrompt.finalState,
            option => option.value?.minionUid === 'second-minion',
            '魔法城堡选择第二个己方角色',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'first-minion')?.powerCounters ?? 0).toBe(0);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'second-minion')?.powerCounters ?? 0).toBe(1);
        expect(resolved.finalState.core.bases[0].metadata?.enchantedCastleDiscardTurn).toBe(1);
        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.POWER_COUNTER_ADDED,
            payload: expect.objectContaining({ minionUid: 'second-minion', amount: 1 }),
        }));
    });

    it('魔法城堡：本回合第二次从手牌弃牌不再打开触发窗口', () => {
        const fillerHand = Array.from({ length: 10 }, (_, index) =>
            makeCard(`castle-second-filler-${index}`, 'aladdin_wish', 'action', '0'));
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('second-discard', 'aladdin_wish', 'action', '0'),
                        ...fillerHand,
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_enchanted_castle', [
                makeMinion('castle-minion', 'beauty_and_the_beast_belle', '0', 3),
            ])],
            cardsDiscardedFromHandThisTurn: { '0': 1 },
        });
        const matchState = makeMatchState(core);
        matchState.sys.phase = 'draw';

        const discarded = runCommand(matchState, {
            type: SU_COMMANDS.DISCARD_TO_LIMIT,
            playerId: '0',
            payload: { cardUids: ['second-discard'] },
        }, FIXED_RANDOM);

        expect(discarded.success).toBe(true);
        expect(discarded.finalState.core.triggerQueue?.some((trigger: any) => trigger.sourceDefId === 'base_enchanted_castle')).not.toBe(true);
        expect(getOptionalSimpleChoicePrompt(discarded.finalState, 'smashup_reaction_choose')).toBeUndefined();
        expect(discarded.finalState.core.bases[0].minions[0].powerCounters ?? 0).toBe(0);
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
        const actionPrompt = getSimpleChoicePrompt(bazaar.matchState!, 'base_agrabah_bazaar');
        expect(getPromptOptions(actionPrompt).map(option => option.value?.cardUid)).toEqual(['action-cost']);
        const choseAction = respondToPromptOption(
            bazaar.matchState!,
            option => option.value?.cardUid === 'action-cost',
            '阿格拉巴集市选择弃掉的行动',
            '0',
            FIXED_RANDOM,
        );
        expect(choseAction.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['action-cost']);
        expect(choseAction.finalState.core.bases[0].minions[0].powerCounters ?? 0).toBe(0);

        const firstCounterPrompt = getSimpleChoicePrompt(choseAction.finalState, 'base_agrabah_bazaar_counter');
        expect(getPromptOptions(firstCounterPrompt).some(option => option.value?.minionUid === 'guard')).toBe(true);
        const firstCounter = respondToPromptOption(
            choseAction.finalState,
            option => option.value?.minionUid === 'guard',
            '阿格拉巴集市第一次放置指示物',
            '0',
            FIXED_RANDOM,
        );
        expect(firstCounter.finalState.core.bases[0].minions[0].powerCounters).toBe(1);

        const secondCounterPrompt = getSimpleChoicePrompt(firstCounter.finalState, 'base_agrabah_bazaar_counter');
        expect(getPromptOptions(secondCounterPrompt).some(option => option.value?.minionUid === 'guard')).toBe(true);
        const secondCounter = respondToPromptOption(
            firstCounter.finalState,
            option => option.value?.minionUid === 'guard',
            '阿格拉巴集市第二次放置指示物',
            '0',
            FIXED_RANDOM,
        );
        expect(secondCounter.finalState.core.bases[0].minions[0].powerCounters).toBe(2);

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
        expect(talent.events).toEqual([]);
        const destinationPrompt = getSimpleChoicePrompt(talent.matchState!, 'wreck_it_ralph_king_candy_destination');
        expect(destinationPrompt.autoResolveIfSingle).toBe(false);
        const choseDestination = respondToPromptOption(
            talent.matchState!,
            option => option.value?.baseIndex === 1,
            '糖果国王选择目标基地',
            '0',
            FIXED_RANDOM,
        );
        const targetPrompt = getSimpleChoicePrompt(choseDestination.finalState, 'wreck_it_ralph_king_candy_target');
        expect(targetPrompt.autoResolveIfSingle).toBe(false);
        const choseTarget = respondToPromptOption(
            choseDestination.finalState,
            option => option.value?.minionUid === 'target',
            '糖果国王选择目标角色',
            '0',
            FIXED_RANDOM,
        );

        const afterTalent = choseTarget.finalState.core;
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

    it('甜蜜冲刺车手触发后必须让玩家选择是否移出当前基地', () => {
        const core = makeState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            bases: [
                makeBase('base_the_dump', [
                    makeMinion('racer', 'wreck_it_ralph_sugar_rush_racer', '0', 2),
                ]),
                makeBase('base_the_power_strip'),
                makeBase('base_alpha'),
            ],
        });

        const prompted = fireTriggers(core, 'onActionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            actionTargetBaseIndex: 0,
            triggerCardDefId: 'wreck_it_ralph_king_candy',
            random: FIXED_RANDOM,
            now: 82,
        });

        expect(prompted.events).toEqual([]);
        const prompt = getSimpleChoicePrompt(prompted.matchState!, 'wreck_it_ralph_sugar_rush_racer_move');
        expect(prompt.autoResolveIfSingle).toBe(false);
        expect(getPromptOptions(prompt).map(option => option.value?.baseIndex ?? (option.value?.skip ? 'skip' : undefined))).toEqual(['skip', 1, 2]);

        const resolved = respondToPromptOption(
            prompted.matchState!,
            option => option.value?.baseIndex === 2,
            '甜蜜冲刺车手选择第三个基地',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual([]);
        expect(resolved.finalState.core.bases[2].minions.map(minion => minion.uid)).toEqual(['racer']);
        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_MOVED,
            payload: expect.objectContaining({ minionUid: 'racer', toBaseIndex: 2 }),
        }));
    });

    it('阿修进场从弃牌堆拿基地修正牌时必须等待玩家选择，不自动拿第一张', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [
                        makeCard('first-modifier', 'wreck_it_ralph_king_candy', 'action', '0'),
                        makeCard('chosen-modifier', 'wreck_it_ralph_research_lab_beacon', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_the_dump')],
        });

        const result = invokeRegisteredAbilityContract('wreck_it_ralph_fix_it_felix_jr', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'felix',
            defId: 'wreck_it_ralph_fix_it_felix_jr',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 72,
        });

        expect(result.events).toEqual([]);
        const prompt = getSimpleChoicePrompt(result.matchState!, 'wreck_it_ralph_fix_it_felix_jr_recover');
        expect(prompt.autoResolveIfSingle).toBe(false);
        expect(getPromptOptions(prompt).map(option => option.value?.cardUid)).toEqual(['first-modifier', 'chosen-modifier']);

        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.cardUid === 'chosen-modifier',
            '阿修选择第二张基地修正牌',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['chosen-modifier']);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['first-modifier']);
    });

    it('薄荷喷发从基地弃牌堆交换基地时必须由玩家选择，不自动换第一张', () => {
        const core = makeState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            bases: [makeBase('base_the_dump')],
            baseDeck: ['base_monkey_lab'],
            baseDiscard: ['base_the_vats', 'base_faceless_city'],
        });

        const result = invokeRegisteredAbilityContract('wreck_it_ralph_mints_eruption', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'mints',
            defId: 'wreck_it_ralph_mints_eruption',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 73,
        });

        expect(result.events).toEqual([]);
        const prompt = getSimpleChoicePrompt(result.matchState!, 'wreck_it_ralph_mints_eruption');
        expect(prompt.autoResolveIfSingle).toBe(false);
        expect(getPromptOptions(prompt).map(option => option.value?.baseDefId)).toEqual(['base_the_vats', 'base_faceless_city']);

        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.baseDefId === 'base_faceless_city',
            '薄荷喷发选择第二个弃牌堆基地',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.bases[0].defId).toBe('base_faceless_city');
        expect(resolved.finalState.core.baseDeck).toEqual(['base_monkey_lab']);
        expect(resolved.finalState.core.baseDiscard).toEqual(['base_the_vats', 'base_the_dump']);
        expect(resolved.events.map(event => event.type)).toContain(SU_EVENTS.BASE_REPLACED);
        expect(resolved.events.map(event => event.type)).toContain(SU_EVENTS.BASE_DECK_SHUFFLED);
    });
});
