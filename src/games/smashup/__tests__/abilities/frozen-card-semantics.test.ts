import { beforeEach, describe, expect, it } from 'vitest';

import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { FROZEN_CARDS, FROZEN_BASES } from '../../data/factions/frozen';
import { isAbilityRuntimeContinuationEvent, resumeAbilityRuntimeContinuationEvent } from '../../domain/abilityRuntime';
import { getEffectivePower } from '../../domain/ongoingModifiers';
import { fireTriggers, interceptEvent, isMinionProtected } from '../../domain/ongoingEffects';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import { runCommand } from '../testRunner';
import {
    applyEvents,
    getPromptOptions,
    getSimpleChoicePrompt,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    invokeRegisteredAbilityContract,
    respondToPromptOption,
    respondToPromptOptions,
} from '../helpers';

const FIXED_RANDOM = {
    random: () => 0,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(items: T[]) => [...items],
};

describe('Frozen 全量牌面语义审计', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('录入对象全集保持 15 张牌、2 个基地，基础数值与能力标签一致', () => {
        expect(FROZEN_CARDS.reduce((total, card) => total + card.count, 0)).toBe(20);
        expect(FROZEN_CARDS).toHaveLength(15);
        expect(FROZEN_BASES).toHaveLength(2);
        expect(FROZEN_BASES.map(base => [base.id, base.breakpoint, base.vpAwards])).toEqual([
            ['base_ice_palace', 22, [4, 2, 1]],
            ['base_arendelle', 20, [3, 2, 1]],
        ]);
        expect(FROZEN_CARDS.find(card => card.id === 'frozen_olaf')?.abilityTags).toEqual(['talent']);
        expect(FROZEN_CARDS.find(card => card.id === 'frozen_lock_the_gates')?.abilityTags).toEqual(['ongoing', 'talent']);
    });

    it('迷你雪人只给同基地、己方、力量 5+ 角色放永久力量标记；棉花糖只在艾莎同阵营时加力', () => {
        const core = makeState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            bases: [makeBase('base_arendelle', [
                makeMinion('snowgie-source', 'frozen_snowgie', '0', 2),
                makeMinion('own-high', 'frozen_elsa', '0', 5),
                makeMinion('own-low', 'frozen_olaf', '0', 3),
                makeMinion('enemy-high', 'frozen_elsa', '1', 5),
            ])],
        });

        const snowgie = invokeRegisteredAbilityContract('frozen_snowgie', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'snowgie-source',
            defId: 'frozen_snowgie',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const snowgiePrompt = getSimpleChoicePrompt(snowgie.matchState!, 'disney_four_factions_prompt');
        expect(getPromptOptions(snowgiePrompt).map(option => option.value?.minionUid)).toEqual(['own-high']);
        const snowgieResolved = respondToPromptOption(snowgie.matchState!, option => option.value?.minionUid === 'own-high', '迷你雪人目标', '0', FIXED_RANDOM);
        expect(snowgieResolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'own-high')?.powerCounters).toBe(1);
        expect(snowgieResolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'enemy-high')?.powerCounters ?? 0).toBe(0);

        const marshmallowState = makeState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            bases: [makeBase('base_arendelle', [
                makeMinion('marshmallow', 'frozen_marshmallow', '0', 3),
                makeMinion('elsa', 'frozen_elsa', '0', 5),
                makeMinion('enemy-marshmallow', 'frozen_marshmallow', '1', 3),
            ]), makeBase('test_base_2', [makeMinion('away-marshmallow', 'frozen_marshmallow', '0', 3)])],
        });
        expect(getEffectivePower(marshmallowState, marshmallowState.bases[0].minions[0], 0)).toBe(5);
        expect(getEffectivePower(marshmallowState, marshmallowState.bases[0].minions[2], 0)).toBe(3);
        expect(getEffectivePower(marshmallowState, marshmallowState.bases[1].minions[0], 1)).toBe(3);
    });

    it('雪宝查看牌库顶两张，可任意弃置，其余按选择顺序放回牌库顶；放手吧从顶三张抽一张并处置其余', () => {
        const olafCore = makeState({
            players: { '0': makePlayer('0', { deck: [
                makeCard('olaf-discard', 'frozen_snowgie', 'minion', '0'),
                makeCard('olaf-keep', 'frozen_olaf', 'minion', '0'),
                makeCard('olaf-tail', 'frozen_sven', 'minion', '0'),
            ] }) },
            bases: [makeBase('base_arendelle')],
        });
        const olaf = invokeRegisteredAbilityContract('frozen_olaf', 'talent', {
            state: olafCore,
            matchState: makeMatchState(olafCore),
            playerId: '0',
            cardUid: 'olaf',
            defId: 'frozen_olaf',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 11,
        });
        const olafPrompt = getSimpleChoicePrompt(olaf.matchState!, 'disney_four_factions_prompt');
        expect(getPromptOptions(olafPrompt).map(option => option.value?.cardUid ?? option.id)).toEqual(['olaf-discard', 'olaf-keep', 'skip']);
        const olafResolved = respondToPromptOption(olaf.matchState!, option => option.value?.cardUid === 'olaf-discard', '雪宝弃置牌', '0', FIXED_RANDOM);
        expect(olafResolved.finalState.core.players['0'].discard.map(card => card.uid)).toContain('olaf-discard');
        expect(olafResolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['olaf-keep', 'olaf-tail']);

        const letItGoCore = makeState({
            players: { '0': makePlayer('0', { deck: [
                makeCard('let-top-a', 'frozen_snowgie', 'minion', '0'),
                makeCard('let-top-b', 'frozen_olaf', 'minion', '0'),
                makeCard('let-top-c', 'frozen_sven', 'minion', '0'),
            ] }) },
            bases: [makeBase('base_arendelle')],
        });
        const letItGo = invokeRegisteredAbilityContract('frozen_let_it_go', 'onPlay', {
            state: letItGoCore,
            matchState: makeMatchState(letItGoCore),
            playerId: '0',
            cardUid: 'let-it-go',
            defId: 'frozen_let_it_go',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 12,
        });
        const pickPrompt = getSimpleChoicePrompt(letItGo.matchState!, 'disney_four_factions_prompt');
        const picked = respondToPromptOption(letItGo.matchState!, option => option.value?.cardUid === 'let-top-b', '放手吧抽牌', '0', FIXED_RANDOM);
        const reorderPrompt = getSimpleChoicePrompt(picked.finalState, 'disney_four_factions_prompt');
        const keepOption = getPromptOptions(reorderPrompt).find(option => option.value?.cardUid === 'let-top-a');
        expect(keepOption).toBeDefined();
        const resolved = respondToPromptOptions(picked.finalState, [keepOption.id], '0', FIXED_RANDOM);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('let-top-b');
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toContain('let-top-c');
        expect(resolved.finalState.core.players['0'].deck[0]?.uid).toBe('let-top-a');
        expect(pickPrompt.targetType).toBe('generic');
    });

    it('斯文天赋只能移动己方角色到自己所在基地，或搜索克里斯托弗入手', () => {
        const searchCore = makeState({
            players: { '0': makePlayer('0', { deck: [makeCard('kristoff-card', 'frozen_kristoff', 'minion', '0')] }) },
            bases: [makeBase('base_arendelle', [makeMinion('sven', 'frozen_sven', '0', 3)]), makeBase('base_ice_palace')],
        });
        const search = invokeRegisteredAbilityContract('frozen_sven', 'talent', {
            state: searchCore,
            matchState: makeMatchState(searchCore),
            playerId: '0', cardUid: 'sven', defId: 'frozen_sven', baseIndex: 0, random: FIXED_RANDOM, now: 13,
        });
        const modePrompt = getSimpleChoicePrompt(search.matchState!, 'disney_four_factions_prompt');
        expect(getPromptOptions(modePrompt).map(option => option.value?.mode)).toEqual(['sven_search_kristoff']);
        const searchChoice = respondToPromptOption(search.matchState!, option => option.value?.mode === 'sven_search_kristoff', '斯文搜索克里斯托弗', '0', FIXED_RANDOM);
        const cardPrompt = getSimpleChoicePrompt(searchChoice.finalState, 'disney_four_factions_prompt');
        expect(getPromptOptions(cardPrompt).map(option => option.value?.cardUid)).toEqual(['kristoff-card']);
        const searched = respondToPromptOption(searchChoice.finalState, option => option.value?.cardUid === 'kristoff-card', '斯文取回克里斯托弗', '0', FIXED_RANDOM);
        expect(searched.finalState.core.players['0'].hand.map(card => card.uid)).toContain('kristoff-card');

        const moveCore = makeState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            bases: [makeBase('base_arendelle', [makeMinion('sven', 'frozen_sven', '0', 3)]), makeBase('base_ice_palace', [makeMinion('ally', 'frozen_olaf', '0', 3)])],
        });
        const move = invokeRegisteredAbilityContract('frozen_sven', 'talent', {
            state: moveCore,
            matchState: makeMatchState(moveCore),
            playerId: '0', cardUid: 'sven', defId: 'frozen_sven', baseIndex: 0, random: FIXED_RANDOM, now: 14,
        });
        const moveMode = respondToPromptOption(move.matchState!, option => option.value?.mode === 'sven_move_here', '斯文移动分支', '0', FIXED_RANDOM);
        const moveTarget = getSimpleChoicePrompt(moveMode.finalState, 'disney_four_factions_prompt');
        expect(getPromptOptions(moveTarget).map(option => option.value?.minionUid)).toEqual(['ally']);
        const movedTarget = respondToPromptOption(moveMode.finalState, option => option.value?.minionUid === 'ally', '斯文选择移动角色', '0', FIXED_RANDOM);
        const destinationPrompt = getSimpleChoicePrompt(movedTarget.finalState, 'disney_four_factions_prompt');
        expect(getPromptOptions(destinationPrompt).map(option => option.value?.baseIndex)).toEqual([0]);
        const moved = respondToPromptOption(movedTarget.finalState, option => option.value?.baseIndex === 0, '斯文移动到当前基地', '0', FIXED_RANDOM);
        expect(moved.finalState.core.bases[0].minions.map(minion => minion.uid)).toContain('ally');
        expect(moved.finalState.core.bases[1].minions.map(minion => minion.uid)).not.toContain('ally');
    });

    it('安娜搜索艾莎/克里斯托弗并保护同基地其它己方角色；克里斯托弗与安娜或艾莎同基地时加 2', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { discard: [makeCard('kristoff-card', 'frozen_kristoff', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_arendelle', [
                makeMinion('anna', 'frozen_anna', '0', 4),
                makeMinion('ally', 'frozen_snowgie', '0', 2),
                makeMinion('enemy', 'frozen_snowgie', '1', 2),
                makeMinion('kristoff', 'frozen_kristoff', '0', 4),
                makeMinion('elsa', 'frozen_elsa', '0', 5),
            ])],
        });
        const anna = invokeRegisteredAbilityContract('frozen_anna', 'onPlay', {
            state: core, matchState: makeMatchState(core), playerId: '0', cardUid: 'anna', defId: 'frozen_anna', baseIndex: 0, random: FIXED_RANDOM, now: 15,
        });
        const annaPrompt = getSimpleChoicePrompt(anna.matchState!, 'disney_four_factions_prompt');
        expect(getPromptOptions(annaPrompt).map(option => option.value?.cardUid)).toEqual(['kristoff-card']);
        const annaResolved = respondToPromptOption(anna.matchState!, option => option.value?.cardUid === 'kristoff-card', '安娜搜索克里斯托弗', '0', FIXED_RANDOM);
        expect(annaResolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('kristoff-card');
        expect(isMinionProtected(core, core.bases[0].minions.find(minion => minion.uid === 'ally')!, 0, '1', 'destroy')).toBe(true);
        expect(isMinionProtected(core, core.bases[0].minions.find(minion => minion.uid === 'anna')!, 0, '1', 'destroy')).toBe(false);
        expect(getEffectivePower(core, core.bases[0].minions.find(minion => minion.uid === 'kristoff')!, 0)).toBe(6);
    });

    it('克里斯托弗可从弃牌堆取回棉花糖；艾莎可额外打出雪宝/迷你雪人或取回棉花糖', () => {
        const kristoffCore = makeState({
            players: { '0': makePlayer('0', { discard: [makeCard('marshmallow-card', 'frozen_marshmallow', 'minion', '0')] }) },
            bases: [makeBase('base_arendelle', [makeMinion('kristoff', 'frozen_kristoff', '0', 4)])],
        });
        const kristoff = invokeRegisteredAbilityContract('frozen_kristoff', 'talent', {
            state: kristoffCore, matchState: makeMatchState(kristoffCore), playerId: '0', cardUid: 'kristoff', defId: 'frozen_kristoff', baseIndex: 0, random: FIXED_RANDOM, now: 16,
        });
        const kristoffMode = respondToPromptOption(kristoff.matchState!, option => option.value?.mode === 'kristoff_recover_marshmallow', '克里斯托弗取回棉花糖', '0', FIXED_RANDOM);
        const marshmallowPrompt = getSimpleChoicePrompt(kristoffMode.finalState, 'disney_four_factions_prompt');
        const marshmallow = respondToPromptOption(kristoffMode.finalState, option => option.value?.cardUid === 'marshmallow-card', '克里斯托弗选择棉花糖', '0', FIXED_RANDOM);
        expect(marshmallow.finalState.core.players['0'].hand.map(card => card.uid)).toContain('marshmallow-card');
        expect(marshmallowPrompt.targetType).toBe('discard');

        const elsaCore = makeState({
            players: { '0': makePlayer('0', { hand: [makeCard('snowgie-card', 'frozen_snowgie', 'minion', '0')], discard: [makeCard('elsa-marshmallow', 'frozen_marshmallow', 'minion', '0')] }) },
            bases: [makeBase('base_arendelle', [makeMinion('elsa', 'frozen_elsa', '0', 5)])],
        });
        const elsa = invokeRegisteredAbilityContract('frozen_elsa', 'talent', {
            state: elsaCore, matchState: makeMatchState(elsaCore), playerId: '0', cardUid: 'elsa', defId: 'frozen_elsa', baseIndex: 0, random: FIXED_RANDOM, now: 17,
        });
        const elsaMode = getSimpleChoicePrompt(elsa.matchState!, 'disney_four_factions_prompt');
        expect(getPromptOptions(elsaMode).map(option => option.value?.mode)).toEqual(['elsa_extra_minion', 'elsa_recover_marshmallow']);
        const extra = respondToPromptOption(elsa.matchState!, option => option.value?.mode === 'elsa_extra_minion', '艾莎额外出牌', '0', FIXED_RANDOM);
        const extraCardPrompt = getSimpleChoicePrompt(extra.finalState, 'disney_four_factions_prompt');
        expect(getPromptOptions(extraCardPrompt).map(option => option.value?.cardUid)).toEqual(['snowgie-card']);
    });

    it('真爱的行为先摧毁己方角色，再从弃牌堆额外打出另一个角色；夏天大盛宴先弃牌再回收角色；堆雪人只打出指定三种角色', () => {
        const actCore = makeState({
            players: { '0': makePlayer('0', { discard: [makeCard('discard-minion', 'frozen_snowgie', 'minion', '0')] }) },
            bases: [makeBase('base_arendelle', [makeMinion('sacrifice', 'frozen_olaf', '0', 3)])],
        });
        const act = invokeRegisteredAbilityContract('frozen_act_of_true_love', 'onPlay', {
            state: actCore, matchState: makeMatchState(actCore), playerId: '0', cardUid: 'act', defId: 'frozen_act_of_true_love', baseIndex: 0, random: FIXED_RANDOM, now: 18,
        });
        const sacrificed = respondToPromptOption(act.matchState!, option => option.value?.minionUid === 'sacrifice', '真爱的行为摧毁角色', '0', FIXED_RANDOM);
        expect(sacrificed.events).toContainEqual(expect.objectContaining({ type: SU_EVENTS.MINION_DESTROYED, payload: expect.objectContaining({ minionUid: 'sacrifice' }) }));
        const actContinuation = sacrificed.events.find(event => isAbilityRuntimeContinuationEvent(event as any));
        expect(actContinuation).toBeTruthy();
        const actPromptState = resumeAbilityRuntimeContinuationEvent(
            makeMatchState(applyEvents(
                actCore,
                sacrificed.events.filter(event => !isAbilityRuntimeContinuationEvent(event as any)) as any,
            )),
            actContinuation as any,
            FIXED_RANDOM,
        )?.state;
        const extraCardPrompt = getSimpleChoicePrompt(actPromptState!, 'disney_four_factions_prompt');
        expect(getPromptOptions(extraCardPrompt).map(option => option.value?.cardUid)).toEqual(['discard-minion']);

        const summerCore = makeState({
            players: { '0': makePlayer('0', { hand: [makeCard('summer-cost', 'frozen_let_it_go', 'action', '0')], discard: [makeCard('recover-role', 'frozen_olaf', 'minion', '0')] }) },
            bases: [makeBase('base_arendelle')],
        });
        const summer = invokeRegisteredAbilityContract('frozen_big_summer_blowout', 'onPlay', {
            state: summerCore, matchState: makeMatchState(summerCore), playerId: '0', cardUid: 'summer', defId: 'frozen_big_summer_blowout', baseIndex: 0, random: FIXED_RANDOM, now: 19,
        });
        const summerAfterDiscard = respondToPromptOption(summer.matchState!, option => option.value?.cardUid === 'summer-cost', '夏天大盛宴弃牌', '0', FIXED_RANDOM);
        expect(summerAfterDiscard.success, summerAfterDiscard.error).toBe(true);
        const recoverPrompt = getSimpleChoicePrompt(summerAfterDiscard.finalState, 'disney_four_factions_prompt');
        expect(getPromptOptions(recoverPrompt).map(option => option.value?.cardUid)).toEqual(['recover-role']);
        const summerResolved = respondToPromptOption(summerAfterDiscard.finalState, option => option.value?.cardUid === 'recover-role', '夏天大盛宴回收角色', '0', FIXED_RANDOM);
        expect(summerResolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['recover-role']);

        const snowmanCore = makeState({
            players: { '0': makePlayer('0', { discard: [
                makeCard('snowman-snowgie', 'frozen_snowgie', 'minion', '0'),
                makeCard('snowman-olaf', 'frozen_olaf', 'minion', '0'),
                makeCard('snowman-anna', 'frozen_anna', 'minion', '0'),
            ] }) },
            bases: [makeBase('base_arendelle')],
        });
        const snowman = invokeRegisteredAbilityContract('frozen_do_you_want_to_build_a_snowman', 'onPlay', {
            state: snowmanCore, matchState: makeMatchState(snowmanCore), playerId: '0', cardUid: 'snowman', defId: 'frozen_do_you_want_to_build_a_snowman', baseIndex: 0, random: FIXED_RANDOM, now: 20,
        });
        const snowmanPrompt = getSimpleChoicePrompt(snowman.matchState!, 'disney_four_factions_prompt');
        expect(getPromptOptions(snowmanPrompt).map(option => option.value?.cardUid)).toEqual(['snowman-snowgie', 'snowman-olaf']);
        const snowmanResolved = respondToPromptOption(snowman.matchState!, option => option.value?.cardUid === 'snowman-olaf', '堆雪人额外出牌', '0', FIXED_RANDOM);
        expect(snowmanResolved.events).toContainEqual(expect.objectContaining({ type: SU_EVENTS.LIMIT_MODIFIED, payload: expect.objectContaining({ specificCardUid: 'snowman-olaf', playTiming: 'immediate' }) }));
    });

    it('汉斯逐玩家展示角色并把展示角色洗回各自牌库；驯鹿低力量角色立即额外出牌，高力量牌进入弃牌堆', () => {
        const hansCore = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('hans-role-0', 'frozen_snowgie', 'minion', '0'), makeCard('hans-action-0', 'frozen_let_it_go', 'action', '0')] }),
                '1': makePlayer('1', { hand: [makeCard('hans-role-1', 'frozen_olaf', 'minion', '1'), makeCard('hans-action-1', 'frozen_let_it_go', 'action', '1')] }),
            },
            bases: [makeBase('base_arendelle')],
        });
        const hans = invokeRegisteredAbilityContract('frozen_hans_westergaard', 'onPlay', {
            state: hansCore, matchState: makeMatchState(hansCore), playerId: '0', cardUid: 'hans', defId: 'frozen_hans_westergaard', baseIndex: 0, random: FIXED_RANDOM, now: 21,
        });
        const p0Prompt = getSimpleChoicePrompt(hans.matchState!, 'disney_four_factions_prompt');
        const p1 = respondToPromptOption(hans.matchState!, option => option.value?.cardUid === 'hans-role-0', '汉斯玩家 0 展示', '0', FIXED_RANDOM);
        expect(getSimpleChoicePrompt(p1.finalState, 'disney_four_factions_prompt').playerId).toBe('1');
        const hansResolved = respondToPromptOption(p1.finalState, option => option.value?.cardUid === 'hans-role-1', '汉斯玩家 1 展示角色', '1', FIXED_RANDOM);
        expect(hansResolved.events.filter(event => event.type === SU_EVENTS.HAND_SHUFFLED_INTO_DECK)).toHaveLength(2);
        expect(hansResolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['hans-action-0']);
        expect(hansResolved.finalState.core.players['1'].hand.map(card => card.uid)).toEqual(['hans-action-1']);
        expect(hansResolved.finalState.core.players['0'].deck.map(card => card.uid)).toContain('hans-role-0');
        expect(hansResolved.finalState.core.players['1'].deck.map(card => card.uid)).toContain('hans-role-1');
        expect(p0Prompt.targetType).toBe('generic');

        const reindeerCore = makeState({
            players: { '0': makePlayer('0', { deck: [makeCard('reindeer-low', 'frozen_snowgie', 'minion', '0'), makeCard('reindeer-high', 'frozen_anna', 'minion', '0')] }) },
            bases: [makeBase('base_arendelle')],
        });
        const reindeer = invokeRegisteredAbilityContract('frozen_reindeers_are_better_than_people', 'onPlay', {
            state: reindeerCore, matchState: makeMatchState(reindeerCore), playerId: '0', cardUid: 'reindeer', defId: 'frozen_reindeers_are_better_than_people', baseIndex: 0, random: FIXED_RANDOM, now: 22,
        });
        const reindeerPrompt = getSimpleChoicePrompt(reindeer.matchState!, 'disney_four_factions_prompt');
        const low = respondToPromptOption(reindeer.matchState!, option => option.value?.cardUid === 'reindeer-low', '驯鹿选择低力量角色', '0', FIXED_RANDOM);
        expect(low.events).toContainEqual(expect.objectContaining({ type: SU_EVENTS.LIMIT_MODIFIED, payload: expect.objectContaining({ specificCardUid: 'reindeer-low', powerMax: 3, playTiming: 'immediate' }) }));
        const immediatePrompt = getSimpleChoicePrompt(low.finalState, 'smashup_immediate_extra_minion');
        expect(getPromptOptions(immediatePrompt).map(option => option.value?.cardUid).filter(Boolean)).toEqual(['reindeer-low']);
        expect(reindeerPrompt.targetType).toBe('generic');

        const high = invokeRegisteredAbilityContract('frozen_reindeers_are_better_than_people', 'onPlay', {
            state: reindeerCore, matchState: makeMatchState(reindeerCore), playerId: '0', cardUid: 'reindeer-2', defId: 'frozen_reindeers_are_better_than_people', baseIndex: 0, random: FIXED_RANDOM, now: 23,
        });
        const highResolved = respondToPromptOption(high.matchState!, option => option.value?.cardUid === 'reindeer-high', '驯鹿选择高力量角色', '0', FIXED_RANDOM);
        expect(highResolved.events).toContainEqual(expect.objectContaining({ type: SU_EVENTS.CARDS_MILLED, payload: expect.objectContaining({ cardUids: ['reindeer-high'] }) }));
    });

    it('冻结的港口限制其他玩家本回合第一次打到这里；锁上大门与冰宫提供摧毁保护，并支持牌库顶天赋', () => {
        const portCore = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', { hand: [makeCard('enemy-low', 'frozen_snowgie', 'minion', '1')] }),
            },
            currentPlayerIndex: 1,
            bases: [makeBase({ defId: 'base_arendelle', ongoingActions: [{ uid: 'port', defId: 'frozen_frozen_port', ownerId: '0' }] }), makeBase('base_ice_palace')],
        });
        const blocked = runCommand(makeMatchState(portCore), { type: SU_COMMANDS.PLAY_MINION, playerId: '1', payload: { cardUid: 'enemy-low', baseIndex: 0 } } as any, FIXED_RANDOM);
        expect(blocked.success).toBe(false);
        const otherBase = runCommand(makeMatchState(portCore), { type: SU_COMMANDS.PLAY_MINION, playerId: '1', payload: { cardUid: 'enemy-low', baseIndex: 1 } } as any, FIXED_RANDOM);
        expect(otherBase.success, otherBase.error).toBe(true);

        const lockCore = makeState({
            players: { '0': makePlayer('0', { deck: [makeCard('lock-top', 'frozen_snowgie', 'minion', '0')] }), '1': makePlayer('1') },
            bases: [makeBase({ defId: 'base_arendelle', ongoingActions: [{ uid: 'lock', defId: 'frozen_lock_the_gates', ownerId: '0' }], minions: [makeMinion('ally', 'frozen_snowgie', '0', 2)] })],
        });
        expect(isMinionProtected(lockCore, lockCore.bases[0].minions[0], 0, '0', 'destroy')).toBe(false);
        expect(isMinionProtected(lockCore, lockCore.bases[0].minions[0], 0, '1', 'destroy')).toBe(true);
        const lockTalent = invokeRegisteredAbilityContract('frozen_lock_the_gates', 'talent', {
            state: lockCore, matchState: makeMatchState(lockCore), playerId: '0', cardUid: 'lock', defId: 'frozen_lock_the_gates', baseIndex: 0, random: FIXED_RANDOM, now: 24,
        });
        const lockPrompt = getSimpleChoicePrompt(lockTalent.matchState!, 'disney_four_factions_prompt');
        const lockResolved = respondToPromptOption(lockTalent.matchState!, option => option.value?.mode === 'deck_top_discard', '锁上大门弃牌库顶', '0', FIXED_RANDOM);
        expect(lockResolved.finalState.core.players['0'].discard.map(card => card.uid)).toContain('lock-top');
        expect(lockPrompt.targetType).toBe('button');

        const iceCore = makeState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            bases: [makeBase('base_ice_palace', [makeMinion('enemy', 'frozen_snowgie', '1', 2)])],
        });
        const iceTarget = iceCore.bases[0].minions[0];
        expect(isMinionProtected(iceCore, iceTarget, 0, '0', 'destroy')).toBe(true);
        expect(isMinionProtected(iceCore, iceTarget, 0, '0', 'move')).toBe(true);
        expect(interceptEvent(iceCore, { type: SU_EVENTS.MINION_MOVED, payload: { minionUid: 'enemy', minionDefId: 'frozen_snowgie', fromBaseIndex: 0, toBaseIndex: 0, reason: 'enemy-move', sourcePlayerId: '0' }, timestamp: 25 } as any)).toBeUndefined();
    });

    it('阿伦黛尔在角色打入后让该玩家从牌库顶两张中抽一张、另一张进弃牌堆', () => {
        const core = makeState({
            players: { '0': makePlayer('0', { deck: [makeCard('arendelle-a', 'frozen_snowgie', 'minion', '0'), makeCard('arendelle-b', 'frozen_olaf', 'minion', '0')] }) },
            bases: [makeBase('base_arendelle', [makeMinion('played', 'frozen_sven', '0', 3)])],
        });
        const result = fireTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinion: core.bases[0].minions[0],
            triggerMinionUid: 'played',
            triggerMinionDefId: 'frozen_sven',
            triggerMinionPower: 3,
            random: FIXED_RANDOM,
            now: 26,
        });
        const prompt = getSimpleChoicePrompt(result.matchState!, 'disney_four_factions_prompt');
        expect(getPromptOptions(prompt).map(option => option.value?.cardUid).filter(Boolean)).toEqual(['arendelle-a', 'arendelle-b']);
        const resolved = respondToPromptOption(result.matchState!, option => option.value?.cardUid === 'arendelle-b', '阿伦黛尔抽牌', '0', FIXED_RANDOM);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('arendelle-b');
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toContain('arendelle-a');
    });
});
