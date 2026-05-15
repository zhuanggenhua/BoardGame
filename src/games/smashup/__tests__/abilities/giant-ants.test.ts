import { describe, it, expect, beforeAll } from 'vitest';
import { SU_COMMANDS, SU_EVENTS, type SmashUpCore } from '../../domain/types';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry, fireTriggers } from '../../domain/ongoingEffects';
import { startSmashUpReactionSession } from '../../domain/reactionSession';
import { reduce } from '../../domain/reduce';
import { processDestroyTriggers } from '../../domain/reducer';
import {
    createSimpleChoice,
    queueInteraction,
    refreshInteractionOptions,
    resolveInteraction,
} from '../../../../engine/systems/InteractionSystem';
import type { MatchState } from '../../../../engine/types';
import {
    makeMinion,
    makeCard,
    makePlayer,
    makeState,
    makeMatchState,
    getSimpleChoicePrompt,
    getPromptOption,
    getPromptOptions,
    getPromptSliderMax,
    getPromptRuntimeContinuationContext,
    respondToPrompt,
    respondToPromptWithMergedValue,
    cancelPrompt,
    getPromptCountBySourceId,
    expectNoPrompt,
} from '../helpers';
import { runCommand, defaultTestRandom } from '../testRunner';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    resetAbilityInit();
    clearInteractionHandlers();
    initAllAbilities();
});

describe('巨蚁派系能力', () => {
    it('无人想要永生：可逐次移除并在确认后抽牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'giant_ant_who_wants_to_live_forever', 'action', '0')],
                    deck: [
                        makeCard('d1', 'filler_minion_1', 'minion', '0'),
                        makeCard('d2', 'filler_action_2', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('m1', 'giant_ant_worker', '0', 3, { powerModifier: 2 }),
                        makeMinion('m2', 'test_other', '0', 2, { powerModifier: 1 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const playResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
            defaultTestRandom,
        );

        const prompt1 = getSimpleChoicePrompt(playResult.finalState, 'giant_ant_who_wants_to_live_forever');

        const removeOption = getPromptOption(prompt1, o => o?.value?.minionUid === 'm1', 'removeOption');

        const removeResult = respondToPrompt(
            playResult.finalState,
            removeOption.id,
            '0',
            defaultTestRandom,
        );
        expect(removeResult.events.some(e => e.type === SU_EVENTS.POWER_COUNTER_REMOVED)).toBe(true);

        const prompt2 = getSimpleChoicePrompt(removeResult.finalState);
        const confirmOption = getPromptOption(prompt2, o => o.id === 'confirm', 'confirmOption');

        const confirmResult = respondToPrompt(
            removeResult.finalState,
            'confirm',
            '0',
            defaultTestRandom,
        );

        const drawEvt = confirmResult.events.find(e => e.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvt).toBeDefined();
        expect((drawEvt as any).payload.count).toBe(1);
    });

    it('无人想要永生：旧 optionId 不应在最后一个指示物移除后吞掉交互', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'giant_ant_who_wants_to_live_forever', 'action', '0')],
                    deck: [makeCard('d1', 'filler_minion_1', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('m1', 'giant_ant_worker', '0', 3, { powerCounters: 1 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const playResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
            defaultTestRandom,
        );
        expect(playResult.success).toBe(true);

        const prompt1 = getSimpleChoicePrompt(playResult.finalState, 'giant_ant_who_wants_to_live_forever');
        const removeOption = getPromptOption(prompt1, o => o?.value?.minionUid === 'm1', 'removeOption');

        const firstRemoveResult = respondToPrompt(
            playResult.finalState,
            removeOption.id,
            '0',
            defaultTestRandom,
        );
        expect(firstRemoveResult.success).toBe(true);
        expect(firstRemoveResult.events.some(e => e.type === SU_EVENTS.POWER_COUNTER_REMOVED)).toBe(true);

        const staleRespondResult = respondToPrompt(
            firstRemoveResult.finalState,
            removeOption.id,
            '0',
            defaultTestRandom,
        );

        expect(staleRespondResult.success).toBe(false);
        expect(staleRespondResult.error).toBe('无效的选择');
        expect(staleRespondResult.events).toHaveLength(0);
        expect(staleRespondResult.finalState).toEqual(firstRemoveResult.finalState);
        getSimpleChoicePrompt(staleRespondResult.finalState, 'giant_ant_who_wants_to_live_forever');
    });

    it('如同魔法：先移除全部，再可取消并回滚', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'giant_ant_a_kind_of_magic', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('m1', 'giant_ant_worker', '0', 3, { powerCounters: 2 }),
                        makeMinion('m2', 'test_other', '0', 2, { powerCounters: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const playResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
            defaultTestRandom,
        );

        const removedEvt = playResult.events.find(e => e.type === SU_EVENTS.POWER_COUNTER_REMOVED);
        expect(removedEvt).toBeDefined();

        const prompt1 = getSimpleChoicePrompt(playResult.finalState, 'giant_ant_a_kind_of_magic_distribute');

        const assignOption = getPromptOption(prompt1, o => o?.value?.minionUid === 'm2', 'assignOption');

        const assignResult = respondToPrompt(
            playResult.finalState,
            assignOption.id,
            '0',
            defaultTestRandom,
        );
        expect(assignResult.events.some(e => e.type === SU_EVENTS.POWER_COUNTER_ADDED)).toBe(true);

        const cancelResult = respondToPrompt(
            assignResult.finalState,
            'cancel',
            '0',
            defaultTestRandom,
        );

        expect(cancelResult.events.some(e => e.type === SU_EVENTS.CARD_RECOVERED_FROM_DISCARD)).toBe(true);
        expect(cancelResult.events.filter(e => e.type === SU_EVENTS.POWER_COUNTER_ADDED).length).toBeGreaterThan(0);
    });

    it('承受压力：Me First! 窗口中打出，从计分基地上的随从转移力量指示物到其他基地的随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'giant_ant_under_pressure', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_the_jungle',
                    minions: [
                        makeMinion('m1', 'giant_ant_worker', '0', 3, { powerCounters: 3 }), // 计分基地上的随从（来源）
                        makeMinion('filler1', 'test_other', '1', 10, { powerCounters: 0 }),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_the_hive',
                    minions: [
                        makeMinion('m2', 'test_other', '0', 2, { powerCounters: 0 }), // 其他基地上的随从（目标）
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const ms = startSmashUpReactionSession(makeMatchState(core), {
            frameId: 'score-before:0:test',
            frameKind: 'score-before',
            phase: 'optional',
            activePlayerId: '0',
            currentPlayerId: '0',
            consecutivePasses: 0,
            sourceBaseIndex: 0,
            responseWindowType: 'meFirst',
        });
        ms.sys.phase = 'scoreBases';
        ms.sys.responseWindow = { ...(ms.sys.responseWindow ?? {}), current: undefined } as any;

        const playResult = runCommand(
            ms,
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1', targetBaseIndex: 0 } },
            defaultTestRandom,
        );
        const sourcePrompt = getSimpleChoicePrompt(playResult.finalState, 'giant_ant_under_pressure_choose_source');

        const sourceOption = getPromptOption(sourcePrompt, o => o?.value?.minionUid === 'm1', 'source minion');
        const chooseSourceResult = respondToPrompt(
            playResult.finalState,
            sourceOption.id,
            '0',
            defaultTestRandom,
        );

        const targetPrompt = getSimpleChoicePrompt(chooseSourceResult.finalState, 'giant_ant_under_pressure_choose_target');
        const targetOption = getPromptOption(targetPrompt, o => o?.value?.minionUid === 'm2', 'target minion');

        const resolveResult = respondToPrompt(
            chooseSourceResult.finalState,
            targetOption.id,
            '0',
            defaultTestRandom,
        );

        const amountPrompt = getSimpleChoicePrompt(resolveResult.finalState, 'giant_ant_under_pressure_choose_amount');
        expect(getPromptSliderMax(amountPrompt)).toBe(3);

        const amountResult = respondToPromptWithMergedValue(
            resolveResult.finalState,
            'confirm-transfer',
            { amount: 3, value: 3 },
            '0',
            defaultTestRandom,
        );

        const removed = amountResult.events.find(e => e.type === SU_EVENTS.POWER_COUNTER_REMOVED);
        const added = amountResult.events.find(e => e.type === SU_EVENTS.POWER_COUNTER_ADDED);
        expect(removed).toBeDefined();
        expect(added).toBeDefined();
        expect((removed as any).payload.amount).toBe(3);
        expect((removed as any).payload.minionUid).toBe('m1');
        expect((added as any).payload.amount).toBe(3);
        expect((added as any).payload.minionUid).toBe('m2');

        // Me First! 子动作完成后，计分链会继续推进，所以来源随从可能已随计分基地一起离场。
        const m1Final = amountResult.finalState.core.bases[0]?.minions.find(m => m.uid === 'm1');
        const m2Final = amountResult.finalState.core.bases[1]?.minions.find(m => m.uid === 'm2');
        expect(m1Final).toBeUndefined();
        expect(m2Final?.powerCounters).toBe(3);
    });

    it('我们乃最强：计分后触发，来源离场后仍可按快照数量完成转移', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('m1', 'giant_ant_worker', '0', 3, { powerCounters: 2 }),
                        makeMinion('opp1', 'test_other', '1', 2, { powerCounters: 0 }),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('m2', 'test_other', '0', 2, { powerCounters: 0 })],
                    ongoingActions: [],
                },
            ],
            pendingAfterScoringSpecials: [
                {
                    sourceDefId: 'giant_ant_we_are_the_champions',
                    playerId: '0',
                    baseIndex: 0,
                    cardUid: 'champ-1',
                    minionSnapshots: [
                        {
                            uid: 'm1',
                            defId: 'giant_ant_worker',
                            baseIndex: 0,
                            counterAmount: 2,
                        },
                    ],
                },
            ],
        });

        const initialMs = makeMatchState(core);
        const triggerResult = fireTriggers(core, 'afterScoring', {
            state: core,
            matchState: initialMs,
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 5, vp: 3 }],
            random: defaultTestRandom,
            now: 1000,
        });

        const withPrompt = triggerResult.matchState ?? initialMs;
        const sourcePrompt = getSimpleChoicePrompt(withPrompt, 'giant_ant_we_are_the_champions_choose_snapshot_source');
        expect(sourcePrompt?.targetType).toBe('generic');

        // 模拟计分已结算（来源随从离场）后再响应交互
        const scoredCore = reduce(core, {
            type: SU_EVENTS.BASE_SCORED,
            payload: { baseIndex: 0, rankings: [{ playerId: '0', power: 5, vp: 3 }] },
            timestamp: 1001,
        } as any);
        const scoredAndReplacedCore = reduce(scoredCore, {
            type: SU_EVENTS.BASE_REPLACED,
            payload: { baseIndex: 0, oldBaseDefId: 'base_a', newBaseDefId: 'base_c' },
            timestamp: 1002,
        } as any);
        const coreAfterTriggerEvents = triggerResult.events.reduce(
            (acc, evt) => reduce(acc, evt as any),
            scoredAndReplacedCore,
        );
        const afterScoringState: MatchState<SmashUpCore> = {
            ...withPrompt,
            core: coreAfterTriggerEvents,
        };

        // 模拟前端 transport 的实时交互刷新：来源快照选项不应被过滤掉
        const refreshedAfterScoringState = refreshInteractionOptions(afterScoringState);
        const refreshedSourcePrompt = getSimpleChoicePrompt(refreshedAfterScoringState, 'giant_ant_we_are_the_champions_choose_snapshot_source');
        getPromptOption(refreshedSourcePrompt, o => o?.value?.minionUid === 'm1', 'refreshed source minion');

        const sourceOption = getPromptOption(sourcePrompt, o => o?.value?.minionUid === 'm1', 'source snapshot');
        const chooseSourceResult = respondToPrompt(
            refreshedAfterScoringState,
            sourceOption.id,
            '0',
            defaultTestRandom,
        );

        // Step 2: choose_target - 刷新后目标随从（在其他基地）选项仍可用
        const refreshedChooseTarget = refreshInteractionOptions(chooseSourceResult.finalState);
        const targetPrompt = getSimpleChoicePrompt(refreshedChooseTarget, 'giant_ant_we_are_the_champions_choose_target');
        const targetOption = getPromptOption(targetPrompt, o => o?.value?.minionUid === 'm2', 'targetOption');
        const resolveResult = respondToPrompt(
            refreshedChooseTarget,
            targetOption.id,
            '0',
            defaultTestRandom,
        );

        // Step 3: choose_amount - 刷新后滑块选项仍可用
        const refreshedChooseAmount = refreshInteractionOptions(resolveResult.finalState);
        const amountPrompt = getSimpleChoicePrompt(refreshedChooseAmount, 'giant_ant_we_are_the_champions_choose_amount');
        expect(getPromptSliderMax(amountPrompt)).toBe(2);

        const amountResult = respondToPromptWithMergedValue(
            refreshedChooseAmount,
            'confirm-transfer',
            { amount: 1, value: 1 },
            '0',
            defaultTestRandom,
        );

        const removed = amountResult.events.find(e => e.type === SU_EVENTS.POWER_COUNTER_REMOVED);
        const added = amountResult.events.find(e => e.type === SU_EVENTS.POWER_COUNTER_ADDED);
        expect(removed).toBeUndefined();
        expect((added as any).payload.amount).toBe(1);
    });

    it('兵蚁：onPlay 放2指示物；talent 移除1并转移1个指示物给另一个随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('s1', 'giant_ant_soldier', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('m2', 'test_other', '0', 2, { powerModifier: 0 })],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        const playResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 's1', baseIndex: 0 } },
            defaultTestRandom,
        );

        const addEvt = playResult.events.find(e => e.type === SU_EVENTS.POWER_COUNTER_ADDED);
        expect(addEvt).toBeDefined();
        expect((addEvt as any).payload.amount).toBe(2);

        const talentResult = runCommand(
            playResult.finalState,
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 's1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const chooseMinionPrompt = getSimpleChoicePrompt(talentResult.finalState);
        const chooseMinionOption = getPromptOption(chooseMinionPrompt, o => o?.value?.minionUid === 'm2', 'target minion');

        const resolveResult = respondToPrompt(
            talentResult.finalState,
            chooseMinionOption.id,
            '0',
            defaultTestRandom,
        );

        const removed = resolveResult.events.find(e => e.type === SU_EVENTS.POWER_COUNTER_REMOVED);
        const added = resolveResult.events.find(e => e.type === SU_EVENTS.POWER_COUNTER_ADDED && (e as any).payload.minionUid === 'm2');
        expect(removed).toBeDefined();
        expect((removed as any).payload.amount).toBe(1);
        expect(added).toBeDefined();
        expect((added as any).payload.amount).toBe(1);
        expect(resolveResult.events.some(e => e.type === SU_EVENTS.MINION_MOVED)).toBe(false);
    });

    it('雄蜂：onPlay 放置力量指示物（无 talent，持续能力为防消灭）', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('d1', 'giant_ant_drone', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const playResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'd1', baseIndex: 0 } },
            defaultTestRandom,
        );
        expect(playResult.events.some(e => e.type === SU_EVENTS.POWER_COUNTER_ADDED)).toBe(true);
    });

    it('雄蜂：选择防止消灭时，移除指示物并保留被消灭随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('dis1', 'test_minion', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('d1', 'giant_ant_drone', '0', 3, { powerCounters: 1 }),
                        makeMinion('m1', 'cthulhu_servitor', '0', 2, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const triggerResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'm1', baseIndex: 0 } },
            defaultTestRandom,
        );

        const prompt = getSimpleChoicePrompt(triggerResult.finalState, 'giant_ant_drone_prevent_destroy');
        expect(triggerResult.events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);

        const droneOption = getPromptOption(prompt, o => o?.value?.droneUid === 'd1', 'drone option');
        const preventResult = respondToPrompt(
            triggerResult.finalState,
            droneOption.id,
            '0',
            defaultTestRandom,
        );

        expect(preventResult.events.some(e => e.type === SU_EVENTS.POWER_COUNTER_REMOVED)).toBe(true);
        expect(preventResult.events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
        const baseMinions = preventResult.finalState.core.bases[0].minions.map(m => m.uid);
        expect(baseMinions).toContain('m1');
        // 关键：交互应已解决（弹窗消失）
        expectNoPrompt(preventResult.finalState);
    });

    it('尸体商店+雄蜂：选择防止消灭时，应先结算雄蜂且不进入指示物分配', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('body-shop', 'frankenstein_body_shop_pod', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('dok', 'frankenstein_herr_doktor_pod', '0', 2, { powerCounters: 0 }),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [
                        makeMinion('monster', 'frankenstein_the_monster_pod', '0', 4, { powerCounters: 0 }),
                        makeMinion('drone', 'giant_ant_drone_pod', '0', 3, { powerCounters: 1 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'body-shop' } },
            defaultTestRandom,
        );
        expect(play.success).toBe(true);

        const choosePrompt = getSimpleChoicePrompt(play.finalState, 'frankenstein_body_shop');
        const chooseDok = getPromptOption(choosePrompt, entry => entry.value?.minionUid === 'dok', 'chooseDok');

        const afterChoose = respondToPrompt(
            play.finalState,
            chooseDok.id,
            '0',
            defaultTestRandom,
        );
        expect(afterChoose.success).toBe(true);
        expect(afterChoose.events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);

        const pendingPrompt = getSimpleChoicePrompt(afterChoose.finalState, 'giant_ant_drone_prevent_destroy');
        const droneOption = getPromptOption(pendingPrompt, entry => entry.value?.droneUid === 'drone', 'droneOption');

        const prevent = respondToPrompt(
            afterChoose.finalState,
            droneOption.id,
            '0',
            defaultTestRandom,
        );
        expect(prevent.success).toBe(true);
        expect(prevent.events.some(e => e.type === SU_EVENTS.POWER_COUNTER_REMOVED)).toBe(true);
        expect(prevent.events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
        expect(prevent.finalState.core.bases[0].minions.some(m => m.uid === 'dok')).toBe(true);
        expect(prevent.finalState.core.bases[1].minions.find(m => m.uid === 'drone')?.powerCounters).toBe(0);
        expect(prevent.finalState.core.bases[1].minions.find(m => m.uid === 'monster')?.powerCounters ?? 0).toBe(0);
        expectNoPrompt(prevent.finalState);
    });

    it('尸体商店+雄蜂：选择不防止消灭时，应在确认消灭后再进入指示物分配', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('body-shop', 'frankenstein_body_shop_pod', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('dok', 'frankenstein_herr_doktor_pod', '0', 2, { powerCounters: 0 }),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [
                        makeMinion('monster', 'frankenstein_the_monster_pod', '0', 4, { powerCounters: 0 }),
                        makeMinion('drone', 'giant_ant_drone_pod', '0', 3, { powerCounters: 1 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'body-shop' } },
            defaultTestRandom,
        );
        const choosePrompt = getSimpleChoicePrompt(play.finalState, 'frankenstein_body_shop');
        const chooseDok = getPromptOption(choosePrompt, entry => entry.value?.minionUid === 'dok', 'body shop target');

        const afterChoose = respondToPrompt(
            play.finalState,
            chooseDok.id,
            '0',
            defaultTestRandom,
        );

        getSimpleChoicePrompt(afterChoose.finalState, 'giant_ant_drone_prevent_destroy');

        const skip = respondToPrompt(
            afterChoose.finalState,
            'skip',
            '0',
            defaultTestRandom,
        );
        expect(skip.success).toBe(true);
        expect(skip.events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);

        const distributePrompt = getSimpleChoicePrompt(skip.finalState, 'frankenstein_body_shop_distribute');
        const chooseMonster = getPromptOption(distributePrompt, entry => entry.value?.minionUid === 'monster', 'chooseMonster');
        expect(skip.finalState.core.bases[0].minions.some(m => m.uid === 'dok')).toBe(false);
    });

    it('雄蜂：选择跳过时恢复消灭，且不会再次弹出同一拦截交互', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('dis1', 'test_minion', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('d1', 'giant_ant_drone', '0', 3, { powerCounters: 1 }),
                        makeMinion('m1', 'cthulhu_servitor', '0', 2, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const triggerResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'm1', baseIndex: 0 } },
            defaultTestRandom,
        );

        const skipResult = respondToPrompt(
            triggerResult.finalState,
            'skip',
            '0',
            defaultTestRandom,
        );

        const destroyEvt = skipResult.events.find(e => e.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvt).toBeDefined();
        expect((destroyEvt as any).payload.reason).toBe('giant_ant_drone_skip');
        expectNoPrompt(skipResult.finalState);
        // 关键：随从实际从基地移除
        const baseMinions = skipResult.finalState.core.bases[0].minions.map((m: any) => m.uid);
        expect(baseMinions).not.toContain('m1');
        expect(baseMinions).toContain('d1');
        // 进入弃牌堆
        const discard = skipResult.finalState.core.players['0'].discard.map((c: any) => c.uid);
        expect(discard).toContain('m1');
    });

    it('雄蜂：取消交互 视为跳过，恢复消灭并清空交互', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('dis1', 'test_minion', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('d1', 'giant_ant_drone', '0', 3, { powerCounters: 1 }),
                        makeMinion('m1', 'cthulhu_servitor', '0', 2, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const triggerResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'm1', baseIndex: 0 } },
            defaultTestRandom,
        );

        const cancelResult = cancelPrompt(
            triggerResult.finalState,
            '0',
            'empty-options',
            defaultTestRandom,
        );

        const destroyEvt = cancelResult.events.find(e => e.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvt).toBeDefined();
        expect((destroyEvt as any).payload.reason).toBe('giant_ant_drone_skip');
        expectNoPrompt(cancelResult.finalState);
        const baseMinions = cancelResult.finalState.core.bases[0].minions.map((m: any) => m.uid);
        expect(baseMinions).not.toContain('m1');
        expect(baseMinions).toContain('d1');
        const discard = cancelResult.finalState.core.players['0'].discard.map((c: any) => c.uid);
        expect(discard).toContain('m1');
    });

    it('雄蜂+Igor：pendingSave 时 onDestroy 不触发（单元测试 processDestroyTriggers）', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('d1', 'giant_ant_drone', '0', 3, { powerModifier: 2 }),
                        makeMinion('igor', 'frankenstein_igor', '0', 1, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });
        const ms = makeMatchState(core);
        const destroyEvt = {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: { minionUid: 'igor', minionDefId: 'frankenstein_igor', fromBaseIndex: 0, ownerId: '0', reason: 'test' },
            timestamp: 100,
        };
        const result = processDestroyTriggers([destroyEvt] as any, ms, '0' as any, defaultTestRandom, 100);

        // 雄蜂创建了防止消灭交互 → pendingSave
        expect(result.matchState).toBeDefined();
        getSimpleChoicePrompt(result.matchState!, 'giant_ant_drone_prevent_destroy');
        // MINION_DESTROYED 被压制
        expect(result.events.filter((e: any) => e.type === SU_EVENTS.MINION_DESTROYED).length).toBe(0);
        // onDestroy 的 POWER_COUNTER_ADDED 不应出现（pendingSave 时跳过 onDestroy）
        expect(result.events.filter((e: any) => e.type === SU_EVENTS.POWER_COUNTER_ADDED).length).toBe(0);
    });

    it('雄蜂+Igor：reason=drone_skip 时 onDestroy 正常触发且不重复（单元测试 processDestroyTriggers）', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('d1', 'giant_ant_drone', '0', 3, { powerModifier: 2 }),
                        makeMinion('igor', 'frankenstein_igor', '0', 1, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });
        const ms = makeMatchState(core);
        // 模拟用户选择“不防止”后 handler 产生的事件
        const destroyEvt = {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: { minionUid: 'igor', minionDefId: 'frankenstein_igor', fromBaseIndex: 0, ownerId: '0', reason: 'giant_ant_drone_skip' },
            timestamp: 100,
        };
        const result = processDestroyTriggers([destroyEvt] as any, ms, '0' as any, defaultTestRandom, 100);

        // 雄蜂 trigger 跳过（reason check）→ 无 pendingSave
        // MINION_DESTROYED 应保留
        expect(result.events.filter((e: any) => e.type === SU_EVENTS.MINION_DESTROYED).length).toBe(1);
        // Igor 的 onDestroy 应触发一次：POWER_COUNTER_ADDED 给雄蜂
        const pcaEvents = result.events.filter((e: any) => e.type === SU_EVENTS.POWER_COUNTER_ADDED);
        expect(pcaEvents.length).toBe(1);
        // 不应产生新的防止消灭交互
        if (result.matchState) expectNoPrompt(result.matchState);
    });

    it('雄蜂：跨玩家场景 — 对手回合消灭己方随从时，交互属于随从所有者', () => {
        // 场景：玩家1消灭玩家0的随从，雄蜂为玩家0的持续能力
        // 交互应属于玩家0，用 playerId:'0' 响应应成功
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('d1', 'giant_ant_drone', '0', 3, { powerModifier: 1 }),
                        makeMinion('m1', 'cthulhu_servitor', '0', 2, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });
        const ms = makeMatchState(core);

        // 模拟玩家1消灭玩家0的随从
        const destroyEvt = {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: { minionUid: 'm1', minionDefId: 'cthulhu_servitor', fromBaseIndex: 0, ownerId: '0', destroyerId: '1', reason: 'opponent_action' },
            timestamp: 100,
        };
        const triggerResult = processDestroyTriggers([destroyEvt] as any, ms, '1' as any, defaultTestRandom, 100);

        // 交互应属于玩家0（随从所有者），不是玩家1（消灭者）
        expect(triggerResult.matchState).toBeDefined();
        const interaction = getSimpleChoicePrompt(triggerResult.matchState!, 'giant_ant_drone_prevent_destroy');
        expect(interaction.playerId).toBe('0');

        // 用玩家0的身份响应（正确）→ 应成功
        const droneOption = getPromptOption(interaction, o => o?.value?.droneUid === 'd1', 'drone option');
        const preventResult = respondToPrompt(
            triggerResult.matchState!,
            droneOption.id,
            '0',
            defaultTestRandom,
        );
        expect(preventResult.success).toBe(true);
        expectNoPrompt(preventResult.finalState);
        expect(preventResult.events.some(e => e.type === SU_EVENTS.POWER_COUNTER_REMOVED)).toBe(true);
        // 被保护的随从仍在基地
        expect(preventResult.finalState.core.bases[0].minions.some(m => m.uid === 'm1')).toBe(true);
    });

    it('雄蜂：能阻止自己被消灭 — 单独消灭雄蜂时弹出防止交互', () => {
        // 场景：只有雄蜂被消灭，雄蜂有1个指示物，应弹出防止交互
        const core = makeState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('d1', 'giant_ant_drone', '0', 3, { powerModifier: 1 }),
                ],
                ongoingActions: [],
            }],
        });
        const ms = makeMatchState(core);

        const destroyEvents = [
            { type: SU_EVENTS.MINION_DESTROYED, payload: { minionUid: 'd1', minionDefId: 'giant_ant_drone', fromBaseIndex: 0, ownerId: '0', reason: 'action' }, timestamp: 100 },
        ];
        const result = processDestroyTriggers(destroyEvents as any, ms, '0' as any, defaultTestRandom, 100);

        // 应创建 1 个防止交互（雄蜂阻止自己被消灭）
        expect(result.matchState).toBeDefined();
        expect(getPromptCountBySourceId(result.matchState!, 'giant_ant_drone_prevent_destroy')).toBe(1);
        const prompt = getSimpleChoicePrompt(result.matchState!, 'giant_ant_drone_prevent_destroy');
        const runtimeContinuation = getPromptRuntimeContinuationContext(prompt);
        expect(runtimeContinuation?.targetMinionUid).toBe('d1');

        // 选择防止 → 雄蜂消耗指示物，存活
        const droneOption = getPromptOption(prompt, o => o?.value?.droneUid === 'd1', 'drone option');
        const r = respondToPrompt(
            result.matchState!,
            droneOption.id,
            '0',
            defaultTestRandom,
        );
        expect(r.success).toBe(true);
        expect(r.events.some(e => e.type === SU_EVENTS.POWER_COUNTER_REMOVED)).toBe(true);
        // 雄蜂仍在基地
        expect(r.finalState.core.bases[0].minions.some(m => m.uid === 'd1')).toBe(true);
        expectNoPrompt(r.finalState);
    });

    it('雄蜂：scoreBases 阶段（真实基地达临界点）交互解决后不应无限循环', () => {
        // 复现根因：scoreBases 阶段 Drone 交互解决后，
        // FlowSystem.afterEvents 的 onAutoContinueCheck 返回 autoContinue，
        // 重新执行 onPhaseExit('scoreBases') → 同一基地仍达标 → 重新计分 → 循环
        // 使用 base_the_jungle（breakpoint=12），力量刚好达标
        const core = makeState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            bases: [{
                defId: 'base_the_jungle',
                minions: [
                    makeMinion('m1', 'cthulhu_servitor', '0', 5, { powerModifier: 0 }),
                    makeMinion('m2', 'cthulhu_minion', '0', 4, { powerModifier: 0 }),
                    makeMinion('d1', 'giant_ant_drone', '0', 3, { powerModifier: 1 }),
                ],
                ongoingActions: [],
            }],
        });
        // 预创建交互状态（模拟某个 afterScoring/onPhaseEnter 基地能力消灭了 m1）
        const destroyEvents = [
            { type: SU_EVENTS.MINION_DESTROYED, payload: { minionUid: 'm1', minionDefId: 'cthulhu_servitor', fromBaseIndex: 0, ownerId: '0', reason: 'action' }, timestamp: 100 },
        ];
        const ms = makeMatchState(core);
        ms.sys.phase = 'scoreBases';
        const triggerResult = processDestroyTriggers(destroyEvents as any, ms, '0' as any, defaultTestRandom, 100);
        expect(triggerResult.matchState).toBeDefined();
        const interaction = getSimpleChoicePrompt(triggerResult.matchState!, 'giant_ant_drone_prevent_destroy');

        // 解决交互（防止消灭）
        const droneOption = getPromptOption(interaction, o => o?.value?.droneUid === 'd1', 'drone option');
        const r = respondToPrompt(
            triggerResult.matchState!,
            droneOption.id,
            '0',
            defaultTestRandom,
        );
        // 关键断言：不应超时/无限循环，success 为 true
        expect(r.success).toBe(true);
        // 关键断言：交互队列应清空，不应有新的 Drone 交互
        expectNoPrompt(r.finalState);
    });

    it('雄蜂：防止失败（指示物耗尽）时重新发出 MINION_DESTROYED', () => {
        // 场景：两个随从同时被消灭，雄蜂只有1个指示物
        // 第一个交互用掉指示物，第二个交互的"防止"选项应回退为消灭
        const core = makeState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('m1', 'cthulhu_servitor', '0', 2, { powerModifier: 0 }),
                    makeMinion('m2', 'cthulhu_minion', '0', 1, { powerModifier: 0 }),
                    makeMinion('d1', 'giant_ant_drone', '0', 3, { powerModifier: 1 }),
                ],
                ongoingActions: [],
            }],
        });
        const ms = makeMatchState(core);

        // 同时消灭 m1 和 m2（不消灭雄蜂自身）
        const destroyEvents = [
            { type: SU_EVENTS.MINION_DESTROYED, payload: { minionUid: 'm1', minionDefId: 'cthulhu_servitor', fromBaseIndex: 0, ownerId: '0', reason: 'scoring' }, timestamp: 100 },
            { type: SU_EVENTS.MINION_DESTROYED, payload: { minionUid: 'm2', minionDefId: 'cthulhu_minion', fromBaseIndex: 0, ownerId: '0', reason: 'scoring' }, timestamp: 100 },
        ];
        const triggerResult = processDestroyTriggers(destroyEvents as any, ms, '0' as any, defaultTestRandom, 100);

        // 应有 2 个防止交互（为 m1 和 m2 各一个）
        expect(triggerResult.matchState).toBeDefined();
        expect(getPromptCountBySourceId(triggerResult.matchState!, 'giant_ant_drone_prevent_destroy')).toBe(2);

        // 解决第1个交互：防止 m1 的消灭（消耗雄蜂指示物）
        const first = getSimpleChoicePrompt(triggerResult.matchState!, 'giant_ant_drone_prevent_destroy');
        const droneOption = getPromptOption(first, o => o?.value?.droneUid === 'd1', 'first drone option');
        const r1 = respondToPrompt(
            triggerResult.matchState!,
            droneOption.id,
            '0',
            defaultTestRandom,
        );
        expect(r1.success).toBe(true);
        expect(r1.events.some(e => e.type === SU_EVENTS.POWER_COUNTER_REMOVED)).toBe(true);

        // 第2个交互自动弹出
        const second = getSimpleChoicePrompt(r1.finalState, 'giant_ant_drone_prevent_destroy');

        // 解决第2个交互：尝试防止 m2（但雄蜂已无指示物）
        const droneOption2 = getPromptOption(second, o => o?.value?.droneUid === 'd1', 'second drone option');
        const r2 = respondToPrompt(
            r1.finalState,
            droneOption2.id,
            '0',
            defaultTestRandom,
        );
        expect(r2.success).toBe(true);
        // 防止失败 → 应重新发出 MINION_DESTROYED（m2 被正确消灭）
        expect(r2.events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
        // 交互队列应清空
        expectNoPrompt(r2.finalState);
    });

    it('雄蜂+吸血鬼伯爵：pendingSave 时 onMinionDestroyed 触发器的副作用事件被抑制', () => {
        // 场景：玩家0有雄蜂（有指示物），玩家1有吸血鬼伯爵
        // 玩家0的随从被消灭 → 雄蜂创建防止交互 → pendingSave
        // 此时吸血鬼伯爵的 +1 指示物不应触发（消灭尚未确认）
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('d1', 'giant_ant_drone', '0', 3, { powerModifier: 2 }),
                        makeMinion('m1', 'cthulhu_servitor', '0', 2, { powerModifier: 0 }),
                        makeMinion('vc', 'vampire_the_count', '1', 5, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });
        const ms = makeMatchState(core);
        const destroyEvt = {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: { minionUid: 'm1', minionDefId: 'cthulhu_servitor', fromBaseIndex: 0, ownerId: '0', reason: 'action' },
            timestamp: 100,
        };
        const result = processDestroyTriggers([destroyEvt] as any, ms, '1' as any, defaultTestRandom, 100);

        // 雄蜂创建了防止消灭交互 → pendingSave
        expect(result.matchState).toBeDefined();
        getSimpleChoicePrompt(result.matchState!, 'giant_ant_drone_prevent_destroy');

        // 关键断言：吸血鬼伯爵的 POWER_COUNTER_ADDED 不应出现
        const pcaEvents = result.events.filter((e: any) => e.type === SU_EVENTS.POWER_COUNTER_ADDED);
        expect(pcaEvents.length).toBe(0);

        // MINION_DESTROYED 也被压制
        expect(result.events.filter((e: any) => e.type === SU_EVENTS.MINION_DESTROYED).length).toBe(0);
    });

    it('雄蜂+投机主义：pendingSave 时 onMinionDestroyed 触发器的副作用事件被抑制', () => {
        // 场景：玩家0有雄蜂，玩家1有附着了投机主义的随从
        // 玩家0的随从被消灭 → 雄蜂防止 → 投机主义的 +1 不应触发
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('d1', 'giant_ant_drone', '0', 3, { powerModifier: 2 }),
                        makeMinion('m1', 'cthulhu_servitor', '0', 2, { powerModifier: 0 }),
                        {
                            ...makeMinion('opp1', 'cthulhu_minion', '1', 3, { powerModifier: 0 }),
                            attachedActions: [{ uid: 'opp-act', defId: 'vampire_opportunist', ownerId: '1' }],
                        } as any,
                    ],
                    ongoingActions: [],
                },
            ],
        });
        const ms = makeMatchState(core);
        const destroyEvt = {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: { minionUid: 'm1', minionDefId: 'cthulhu_servitor', fromBaseIndex: 0, ownerId: '0', reason: 'action' },
            timestamp: 100,
        };
        const result = processDestroyTriggers([destroyEvt] as any, ms, '1' as any, defaultTestRandom, 100);

        // pendingSave
        expect(result.matchState).toBeDefined();
        // 投机主义的 POWER_COUNTER_ADDED 不应出现
        const pcaEvents = result.events.filter((e: any) => e.type === SU_EVENTS.POWER_COUNTER_ADDED);
        expect(pcaEvents.length).toBe(0);
    });

    it('雄蜂跳过后（drone_skip），吸血鬼伯爵正常获得 +1 指示物', () => {
        // 场景：玩家选择不防止消灭 → reason=giant_ant_drone_skip → 消灭确认
        // 此时吸血鬼伯爵的 onMinionDestroyed 应正常触发
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('d1', 'giant_ant_drone', '0', 3, { powerModifier: 2 }),
                        makeMinion('m1', 'cthulhu_servitor', '0', 2, { powerModifier: 0 }),
                        makeMinion('vc', 'vampire_the_count', '1', 5, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });
        const ms = makeMatchState(core);
        const destroyEvt = {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: { minionUid: 'm1', minionDefId: 'cthulhu_servitor', fromBaseIndex: 0, ownerId: '0', reason: 'giant_ant_drone_skip' },
            timestamp: 100,
        };
        const result = processDestroyTriggers([destroyEvt] as any, ms, '1' as any, defaultTestRandom, 100);

        // 雄蜂跳过 → 无 pendingSave → 消灭确认
        expect(result.events.filter((e: any) => e.type === SU_EVENTS.MINION_DESTROYED).length).toBe(1);
        // 吸血鬼伯爵应获得 +1 指示物
        const pcaEvents = result.events.filter((e: any) => e.type === SU_EVENTS.POWER_COUNTER_ADDED);
        expect(pcaEvents.length).toBeGreaterThanOrEqual(1);
        // 确认是吸血鬼伯爵获得的
        expect(pcaEvents.some((e: any) => e.payload.minionUid === 'vc')).toBe(true);
    });

    it('杀手女皇：满足条件时给目标随从与自身各+1', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    minionsPlayedPerBase: { 0: 1 },
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('q1', 'giant_ant_killer_queen', '0', 4, { powerModifier: 0, playedThisTurn: true }),
                        makeMinion('m2', 'test_other', '0', 2, { powerModifier: 0, playedThisTurn: true }),
                        makeMinion('m3', 'test_other', '0', 3, { powerModifier: 0, playedThisTurn: true }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const talentResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'q1', baseIndex: 0 } },
            defaultTestRandom,
        );

        const prompt = getSimpleChoicePrompt(talentResult.finalState);
        const option = getPromptOption(prompt, o => o?.value?.minionUid === 'm2', 'killer queen target');
        const resolveResult = respondToPrompt(
            talentResult.finalState,
            option.id,
            '0',
            defaultTestRandom,
        );

        expect(resolveResult.events.filter(e => e.type === SU_EVENTS.POWER_COUNTER_ADDED).length).toBe(2);
    });
});
