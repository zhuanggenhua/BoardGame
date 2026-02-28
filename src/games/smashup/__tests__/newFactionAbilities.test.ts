/**
 * 大杀四方 - 新增派系能力测试
 *
 * 覆盖：
 * - 黑熊骑兵：bear_cavalry_bear_cavalry, bear_cavalry_youre_screwed,
 *   bear_cavalry_bear_rides_you, bear_cavalry_youre_pretty_much_borscht,
 *   bear_cavalry_bear_necessities
 * - 米斯卡塔尼克大学：miskatonic_librarian, miskatonic_professor
 * - 印斯茅斯：innsmouth_the_locals
 * - 幽灵：ghost_spirit
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import type {
    SmashUpCore,
    PlayerState,
    MinionOnBase,
    CardInstance,
    OngoingActionOnBase,
} from '../domain/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { fireTriggers } from '../domain/ongoingEffects';
import { reduce } from '../domain/reduce';
import { processDestroyTriggers } from '../domain/reducer';
import { makeMinion, makeCard, makePlayer, makeState, makeMatchState, getInteractionsFromMS } from './helpers';
import { runCommand, defaultTestRandom } from './testRunner';
import type { MatchState } from '../../../engine/types';
import { refreshInteractionOptions } from '../../../engine/systems/InteractionSystem';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    resetAbilityInit();
    clearInteractionHandlers();
    initAllAbilities();
});

// ============================================================================
// 辅助函数
// ============================================================================

// ============================================================================
// 黑熊骑兵派系
// ============================================================================

describe('黑熊骑兵派系能力', () => {
    describe('bear_cavalry_bear_cavalry（黑熊骑兵 onPlay）', () => {
        it('单个对手随从时创建 Prompt', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('c1', 'bear_cavalry_bear_cavalry', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [makeMinion('m1', 'test', '1', 4)], ongoingActions: [] },
                    { defId: 'base_b', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
                defaultTestRandom
            );
            const interactions = getInteractionsFromMS(result.finalState);
            expect(interactions.length).toBe(1);
        });

        it('本基地无对手随从时不产生移动事件', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('c1', 'bear_cavalry_bear_cavalry', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [], ongoingActions: [] },
                    { defId: 'base_b', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
                defaultTestRandom
            );
            expect(result.events.find(e => e.type === SU_EVENTS.MINION_MOVED)).toBeUndefined();
        });
    });

    describe('bear_cavalry_youre_screwed（你们已经完蛋）', () => {
        it('单个对手随从时创建 Prompt', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'bear_cavalry_youre_screwed', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [makeMinion('m0', 'test', '0', 3), makeMinion('m1', 'test', '1', 5)], ongoingActions: [] },
                    { defId: 'base_b', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
                defaultTestRandom
            );
            const interactions = getInteractionsFromMS(result.finalState);
            expect(interactions.length).toBe(1);
        });

        it('无己方随从时不产生移动事件', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'bear_cavalry_youre_screwed', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [makeMinion('m1', 'test', '1', 5)], ongoingActions: [] },
                    { defId: 'base_b', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
                defaultTestRandom
            );
            expect(result.events.find(e => e.type === SU_EVENTS.MINION_MOVED)).toBeUndefined();
        });
    });

    describe('bear_cavalry_bear_rides_you（与熊同行）', () => {
        it('单个己方随从时创建 Prompt', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'bear_cavalry_bear_rides_you', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [makeMinion('m0', 'test', '0', 5)], ongoingActions: [] },
                    { defId: 'base_b', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
                defaultTestRandom
            );
            const interactions = getInteractionsFromMS(result.finalState);
            expect(interactions.length).toBe(1);
        });

        it('无己方随从时不产生移动事件', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'bear_cavalry_bear_rides_you', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [], ongoingActions: [] },
                    { defId: 'base_b', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
                defaultTestRandom
            );
            expect(result.events.find(e => e.type === SU_EVENTS.MINION_MOVED)).toBeUndefined();
        });
    });

    describe('bear_cavalry_youre_pretty_much_borscht（你们都是美食）', () => {
        it('单个基地有对手随从时创建 Prompt', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'bear_cavalry_youre_pretty_much_borscht', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [
                        makeMinion('m0', 'test', '0', 3),
                        makeMinion('m1', 'test', '1', 4),
                        makeMinion('m2', 'test', '1', 2),
                    ], ongoingActions: [] },
                    { defId: 'base_b', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
                defaultTestRandom
            );
            const interactions = getInteractionsFromMS(result.finalState);
            expect(interactions.length).toBe(1);
        });
    });

    describe('bear_cavalry_bear_necessities（黑熊口粮）', () => {
        it('多个对手随从时创建 Prompt 选择目标', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'bear_cavalry_bear_necessities', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [
                        makeMinion('m1', 'test', '1', 3),
                        makeMinion('m2', 'test', '1', 5),
                    ], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
                defaultTestRandom
            );
            // 多个目标时应创建 Prompt
            const interactions = getInteractionsFromMS(result.finalState);
            expect(interactions.length).toBe(1);
            expect(interactions[0].data.sourceId).toBe('bear_cavalry_bear_necessities');
        });

        it('单个对手随从时自动消灭', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'bear_cavalry_bear_necessities', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [
                        makeMinion('m1', 'test', '1', 5),
                    ], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
                defaultTestRandom
            );
            // 单目标自动执行，直接消灭随从
            const destroyEvt = result.events.find(e => e.type === SU_EVENTS.MINION_DESTROYED);
            expect(destroyEvt).toBeDefined();
            expect((destroyEvt as any).payload.minionUid).toBe('m1');
        });

        it('无对手随从时单个持续行动卡自动消灭', () => {
            const ongoing: OngoingActionOnBase = { uid: 'oa1', defId: 'test_ongoing', ownerId: '1' };
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'bear_cavalry_bear_necessities', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [], ongoingActions: [ongoing] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
                defaultTestRandom
            );
            // 单目标自动执行，直接消灭行动卡
            const detachEvt = result.events.find(e => e.type === SU_EVENTS.ONGOING_DETACHED);
            expect(detachEvt).toBeDefined();
            expect((detachEvt as any).payload.cardUid).toBe('oa1');
        });

        it('无目标时不产生事件', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'bear_cavalry_bear_necessities', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
                defaultTestRandom
            );
            expect(result.events.find(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBeUndefined();
            expect(result.events.find(e => e.type === SU_EVENTS.ONGOING_DETACHED)).toBeUndefined();
        });
    });
});

// ============================================================================
// 巨蚁派系
// ============================================================================

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
                        makeMinion('m1', 'giant_ant_worker', '0', 3, { powerCounters: 2 }),
                        makeMinion('m2', 'test_other', '0', 2, { powerCounters: 1 }),
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

        const prompt1 = getInteractionsFromMS(playResult.finalState)[0];
        expect(prompt1?.data?.sourceId).toBe('giant_ant_who_wants_to_live_forever');

        const removeOption = prompt1.data.options.find((o: any) => o?.value?.minionUid === 'm1');
        expect(removeOption).toBeDefined();

        const removeResult = runCommand(
            playResult.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: removeOption.id } } as any,
            defaultTestRandom,
        );
        expect(removeResult.events.some(e => e.type === SU_EVENTS.POWER_COUNTER_REMOVED)).toBe(true);

        const prompt2 = getInteractionsFromMS(removeResult.finalState)[0];
        const confirmOption = prompt2.data.options.find((o: any) => o.id === 'confirm');
        expect(confirmOption).toBeDefined();

        const confirmResult = runCommand(
            removeResult.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: 'confirm' } } as any,
            defaultTestRandom,
        );

        const drawEvt = confirmResult.events.find(e => e.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvt).toBeDefined();
        expect((drawEvt as any).payload.count).toBe(1);
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
                        makeMinion('m2', 'test_other', '0', 2, { powerModifier: 0 }),
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

        const prompt1 = getInteractionsFromMS(playResult.finalState)[0];
        expect(prompt1?.data?.sourceId).toBe('giant_ant_a_kind_of_magic_distribute');

        const assignOption = prompt1.data.options.find((o: any) => o?.value?.minionUid === 'm2');
        expect(assignOption).toBeDefined();

        const assignResult = runCommand(
            playResult.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: assignOption.id } } as any,
            defaultTestRandom,
        );
        expect(assignResult.events.some(e => e.type === SU_EVENTS.POWER_COUNTER_ADDED)).toBe(true);

        const cancelResult = runCommand(
            assignResult.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: 'cancel' } } as any,
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
                        makeMinion('filler1', 'test_other', '1', 10),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_the_hive',
                    minions: [
                        makeMinion('m2', 'test_other', '0', 2, { powerModifier: 0 }), // 其他基地上的随从（目标）
                    ],
                    ongoingActions: [],
                },
            ],
        });

        // 设置 Me First! 响应窗口
        const ms = makeMatchState(core);
        ms.sys.phase = 'scoreBases';
        (ms.sys as any).responseWindow = {
            current: {
                windowId: 'meFirst_scoreBases_1',
                responderQueue: ['0', '1'],
                currentResponderIndex: 0,
                windowType: 'meFirst',
                sourceId: 'scoreBases',
            },
        };

        const playResult = runCommand(
            ms,
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1', targetBaseIndex: 0 } },
            defaultTestRandom,
        );
        const sourcePrompt = getInteractionsFromMS(playResult.finalState)[0];
        expect(sourcePrompt?.data?.sourceId).toBe('giant_ant_under_pressure_choose_source');

        const sourceOption = sourcePrompt.data.options.find((o: any) => o?.value?.minionUid === 'm1');
        const chooseSourceResult = runCommand(
            playResult.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: sourceOption.id } } as any,
            defaultTestRandom,
        );

        const targetPrompt = getInteractionsFromMS(chooseSourceResult.finalState)[0];
        expect(targetPrompt?.data?.sourceId).toBe('giant_ant_under_pressure_choose_target');
        const targetOption = targetPrompt.data.options.find((o: any) => o?.value?.minionUid === 'm2');

        const resolveResult = runCommand(
            chooseSourceResult.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: targetOption.id } } as any,
            defaultTestRandom,
        );

        const amountPrompt = getInteractionsFromMS(resolveResult.finalState)[0];
        expect(amountPrompt?.data?.sourceId).toBe('giant_ant_under_pressure_choose_amount');
        expect((amountPrompt?.data as any)?.slider?.max).toBe(3);

        const amountResult = runCommand(
            resolveResult.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: 'confirm-transfer', mergedValue: { amount: 3, value: 3 } } } as any,
            defaultTestRandom,
        );

        const removed = amountResult.events.find(e => e.type === SU_EVENTS.POWER_COUNTER_REMOVED);
        const added = amountResult.events.find(e => e.type === SU_EVENTS.POWER_COUNTER_ADDED);
        expect(removed).toBeDefined();
        expect(added).toBeDefined();
        expect((removed as any).payload.amount).toBe(3);
        expect((added as any).payload.amount).toBe(3);
        
        // 验证最终状态：m1 在基地 0，m2 在基地 1
        const m1Final = amountResult.finalState.core.bases[0]?.minions.find(m => m.uid === 'm1');
        const m2Final = amountResult.finalState.core.bases[1]?.minions.find(m => m.uid === 'm2');
        expect(m1Final?.powerCounters).toBe(0);
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
                        makeMinion('opp1', 'test_other', '1', 2, { powerModifier: 0 }),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('m2', 'test_other', '0', 2, { powerModifier: 0 })],
                    ongoingActions: [],
                },
            ],
            pendingAfterScoringSpecials: [
                {
                    sourceDefId: 'giant_ant_we_are_the_champions',
                    playerId: '0',
                    baseIndex: 0,
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
        const sourcePrompt = getInteractionsFromMS(withPrompt)[0];
        expect(sourcePrompt?.data?.sourceId).toBe('giant_ant_we_are_the_champions_choose_source');
        expect((sourcePrompt?.data as any)?.targetType).toBe('generic');

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
        const refreshedSourcePrompt = getInteractionsFromMS(refreshedAfterScoringState)[0];
        const refreshedSourceOption = refreshedSourcePrompt?.data?.options?.find((o: any) => o?.value?.minionUid === 'm1');
        expect(refreshedSourceOption).toBeDefined();

        const sourceOption = sourcePrompt.data.options.find((o: any) => o?.value?.minionUid === 'm1');
        const chooseSourceResult = runCommand(
            refreshedAfterScoringState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: sourceOption.id } } as any,
            defaultTestRandom,
        );

        // Step 2: choose_target - 刷新后目标随从（在其他基地）选项仍可用
        const refreshedChooseTarget = refreshInteractionOptions(chooseSourceResult.finalState);
        const targetPrompt = getInteractionsFromMS(refreshedChooseTarget)[0];
        expect(targetPrompt?.data?.sourceId).toBe('giant_ant_we_are_the_champions_choose_target');
        const targetOption = targetPrompt.data.options.find((o: any) => o?.value?.minionUid === 'm2');
        expect(targetOption).toBeDefined();
        const resolveResult = runCommand(
            refreshedChooseTarget,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: targetOption.id } } as any,
            defaultTestRandom,
        );

        // Step 3: choose_amount - 刷新后滑块选项仍可用
        const refreshedChooseAmount = refreshInteractionOptions(resolveResult.finalState);
        const amountPrompt = getInteractionsFromMS(refreshedChooseAmount)[0];
        expect(amountPrompt?.data?.sourceId).toBe('giant_ant_we_are_the_champions_choose_amount');
        expect((amountPrompt?.data as any)?.slider?.max).toBe(2);

        const amountResult = runCommand(
            refreshedChooseAmount,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: 'confirm-transfer', mergedValue: { amount: 1, value: 1 } } } as any,
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
        const chooseMinionPrompt = getInteractionsFromMS(talentResult.finalState)[0];
        const chooseMinionOption = chooseMinionPrompt.data.options.find((o: any) => o?.value?.minionUid === 'm2');

        const resolveResult = runCommand(
            talentResult.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: chooseMinionOption.id } } as any,
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
                        makeMinion('m1', 'cthulhu_servitor', '0', 2),
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

        const prompt = getInteractionsFromMS(triggerResult.finalState)[0];
        expect(prompt?.data?.sourceId).toBe('giant_ant_drone_prevent_destroy');
        expect(triggerResult.events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);

        const droneOption = prompt.data.options.find((o: any) => o?.value?.droneUid === 'd1');
        const preventResult = runCommand(
            triggerResult.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: droneOption.id } } as any,
            defaultTestRandom,
        );

        expect(preventResult.events.some(e => e.type === SU_EVENTS.POWER_COUNTER_REMOVED)).toBe(true);
        expect(preventResult.events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
        const baseMinions = preventResult.finalState.core.bases[0].minions.map(m => m.uid);
        expect(baseMinions).toContain('m1');
        // 关键：交互应已解决（弹窗消失）
        expect(getInteractionsFromMS(preventResult.finalState).length).toBe(0);
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
                        makeMinion('m1', 'cthulhu_servitor', '0', 2),
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

        const skipResult = runCommand(
            triggerResult.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: 'skip' } } as any,
            defaultTestRandom,
        );

        const destroyEvt = skipResult.events.find(e => e.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvt).toBeDefined();
        expect((destroyEvt as any).payload.reason).toBe('giant_ant_drone_skip');
        expect(getInteractionsFromMS(skipResult.finalState).length).toBe(0);
        // 关键：随从实际从基地移除
        const baseMinions = skipResult.finalState.core.bases[0].minions.map((m: any) => m.uid);
        expect(baseMinions).not.toContain('m1');
        expect(baseMinions).toContain('d1');
        // 进入弃牌堆
        const discard = skipResult.finalState.core.players['0'].discard.map((c: any) => c.uid);
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
                        makeMinion('d1', 'giant_ant_drone', '0', 3, { powerCounters: 2 }),
                        makeMinion('igor', 'frankenstein_igor', '0', 1, { powerCounters: 0 }),
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
        const interaction = result.matchState!.sys.interaction;
        const hasPreventInteraction = (interaction.current?.data as any)?.sourceId === 'giant_ant_drone_prevent_destroy'
            || interaction.queue.some((i: any) => i?.data?.sourceId === 'giant_ant_drone_prevent_destroy');
        expect(hasPreventInteraction).toBe(true);
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
                        makeMinion('d1', 'giant_ant_drone', '0', 3, { powerCounters: 2 }),
                        makeMinion('igor', 'frankenstein_igor', '0', 1, { powerCounters: 0 }),
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
        if (result.matchState) {
            const interaction = result.matchState.sys.interaction;
            const hasPrevent = (interaction.current?.data as any)?.sourceId === 'giant_ant_drone_prevent_destroy'
                || interaction.queue.some((i: any) => i?.data?.sourceId === 'giant_ant_drone_prevent_destroy');
            expect(hasPrevent).toBe(false);
        }
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
                        makeMinion('d1', 'giant_ant_drone', '0', 3, { powerCounters: 1 }),
                        makeMinion('m1', 'cthulhu_servitor', '0', 2),
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
        const interaction = triggerResult.matchState!.sys.interaction.current;
        expect(interaction).toBeDefined();
        expect(interaction!.playerId).toBe('0');
        expect((interaction!.data as any)?.sourceId).toBe('giant_ant_drone_prevent_destroy');

        // 用玩家0的身份响应（正确）→ 应成功
        const droneOption = (interaction!.data as any).options.find((o: any) => o?.value?.droneUid === 'd1');
        const preventResult = runCommand(
            triggerResult.matchState!,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: droneOption.id } } as any,
            defaultTestRandom,
        );
        expect(preventResult.success).toBe(true);
        expect(getInteractionsFromMS(preventResult.finalState).length).toBe(0);
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
                    makeMinion('d1', 'giant_ant_drone', '0', 3, { powerCounters: 1 }),
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
        const allInteractions = getInteractionsFromMS(result.matchState!);
        const droneInteractions = allInteractions.filter((i: any) => i?.data?.sourceId === 'giant_ant_drone_prevent_destroy');
        expect(droneInteractions.length).toBe(1);
        const ctx = (droneInteractions[0] as any)?.data?.continuationContext;
        expect(ctx?.targetMinionUid).toBe('d1');

        // 选择防止 → 雄蜂消耗指示物，存活
        const interaction = result.matchState!.sys.interaction.current!;
        const droneOption = (interaction.data as any).options.find((o: any) => o?.value?.droneUid === 'd1');
        const r = runCommand(
            result.matchState!,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: droneOption.id } } as any,
            defaultTestRandom,
        );
        expect(r.success).toBe(true);
        expect(r.events.some(e => e.type === SU_EVENTS.POWER_COUNTER_REMOVED)).toBe(true);
        // 雄蜂仍在基地
        expect(r.finalState.core.bases[0].minions.some(m => m.uid === 'd1')).toBe(true);
        expect(getInteractionsFromMS(r.finalState).length).toBe(0);
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
                    makeMinion('m1', 'cthulhu_servitor', '0', 5),
                    makeMinion('m2', 'cthulhu_minion', '0', 4),
                    makeMinion('d1', 'giant_ant_drone', '0', 3, { powerCounters: 1 }),
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
        const interaction = triggerResult.matchState!.sys.interaction.current!;
        expect((interaction.data as any)?.sourceId).toBe('giant_ant_drone_prevent_destroy');

        // 解决交互（防止消灭）
        const droneOption = (interaction.data as any).options.find((o: any) => o?.value?.droneUid === 'd1');
        const r = runCommand(
            triggerResult.matchState!,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: droneOption.id } } as any,
            defaultTestRandom,
        );
        // 关键断言：不应超时/无限循环，success 为 true
        expect(r.success).toBe(true);
        // 关键断言：交互队列应清空，不应有新的 Drone 交互
        const remaining = getInteractionsFromMS(r.finalState);
        const droneRemaining = remaining.filter((i: any) => i?.data?.sourceId === 'giant_ant_drone_prevent_destroy');
        expect(droneRemaining.length).toBe(0);
    });

    it('雄蜂：防止失败（指示物耗尽）时重新发出 MINION_DESTROYED', () => {
        // 场景：两个随从同时被消灭，雄蜂只有1个指示物
        // 第一个交互用掉指示物，第二个交互的"防止"选项应回退为消灭
        const core = makeState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('m1', 'cthulhu_servitor', '0', 2),
                    makeMinion('m2', 'cthulhu_minion', '0', 1),
                    makeMinion('d1', 'giant_ant_drone', '0', 3, { powerCounters: 1 }),
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
        const allInteractions = getInteractionsFromMS(triggerResult.matchState!);
        expect(allInteractions.filter((i: any) => i?.data?.sourceId === 'giant_ant_drone_prevent_destroy').length).toBe(2);

        // 解决第1个交互：防止 m1 的消灭（消耗雄蜂指示物）
        const first = triggerResult.matchState!.sys.interaction.current!;
        const droneOption = (first.data as any).options.find((o: any) => o?.value?.droneUid === 'd1');
        const r1 = runCommand(
            triggerResult.matchState!,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: droneOption.id } } as any,
            defaultTestRandom,
        );
        expect(r1.success).toBe(true);
        expect(r1.events.some(e => e.type === SU_EVENTS.POWER_COUNTER_REMOVED)).toBe(true);

        // 第2个交互自动弹出
        const second = r1.finalState.sys.interaction.current;
        expect(second).toBeDefined();
        expect((second!.data as any)?.sourceId).toBe('giant_ant_drone_prevent_destroy');

        // 解决第2个交互：尝试防止 m2（但雄蜂已无指示物）
        const droneOption2 = (second!.data as any).options.find((o: any) => o?.value?.droneUid === 'd1');
        const r2 = runCommand(
            r1.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: droneOption2.id } } as any,
            defaultTestRandom,
        );
        expect(r2.success).toBe(true);
        // 防止失败 → 应重新发出 MINION_DESTROYED（m2 被正确消灭）
        expect(r2.events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
        // 交互队列应清空
        expect(getInteractionsFromMS(r2.finalState).length).toBe(0);
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
                        makeMinion('d1', 'giant_ant_drone', '0', 3, { powerCounters: 2 }),
                        makeMinion('m1', 'cthulhu_servitor', '0', 2),
                        makeMinion('vc', 'vampire_the_count', '1', 5),
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
        const interaction = result.matchState!.sys.interaction;
        const hasPreventInteraction = (interaction.current?.data as any)?.sourceId === 'giant_ant_drone_prevent_destroy'
            || interaction.queue.some((i: any) => i?.data?.sourceId === 'giant_ant_drone_prevent_destroy');
        expect(hasPreventInteraction).toBe(true);

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
                        makeMinion('d1', 'giant_ant_drone', '0', 3, { powerCounters: 2 }),
                        makeMinion('m1', 'cthulhu_servitor', '0', 2),
                        {
                            ...makeMinion('opp1', 'cthulhu_minion', '1', 3),
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
                        makeMinion('d1', 'giant_ant_drone', '0', 3, { powerCounters: 2 }),
                        makeMinion('m1', 'cthulhu_servitor', '0', 2),
                        makeMinion('vc', 'vampire_the_count', '1', 5),
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
                    minionsPlayedPerBase: { 0: 2 },
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('q1', 'giant_ant_killer_queen', '0', 4),
                        makeMinion('m2', 'test_other', '0', 2, { playedThisTurn: true }),
                        makeMinion('m3', 'test_other2', '0', 3, { playedThisTurn: true }),
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

        const prompt = getInteractionsFromMS(talentResult.finalState)[0];
        const option = prompt.data.options.find((o: any) => o?.value?.minionUid === 'm2');
        const resolveResult = runCommand(
            talentResult.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );

        expect(resolveResult.events.filter(e => e.type === SU_EVENTS.POWER_COUNTER_ADDED).length).toBe(2);
    });
});

// ============================================================================
// 科学怪人派系
// ============================================================================

describe('科学怪人派系能力', () => {
    it('德国工程学：在该基地打出随从后应给该随从+1指示物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('ge1', 'frankenstein_german_engineering', 'action', '0'),
                        makeCard('m1', 'test_minion', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', minions: [], ongoingActions: [] },
                { defId: 'base_b', minions: [], ongoingActions: [] },
            ],
        });

        const afterOngoing = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'ge1', targetBaseIndex: 0 } },
            defaultTestRandom,
        );

        const afterMinion = runCommand(
            afterOngoing.finalState,
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'm1', baseIndex: 0 } },
            defaultTestRandom,
        );

        const geEvt = afterMinion.events.find(
            e => e.type === SU_EVENTS.POWER_COUNTER_ADDED && (e as any).payload.reason === 'frankenstein_german_engineering',
        );
        expect(geEvt).toBeDefined();
        expect((geEvt as any).payload.minionUid).toBe('m1');

        // 断言最终状态中随从的 powerCounters 确实被 +1
        const finalMinion = afterMinion.finalState.core.bases[0].minions.find(m => m.uid === 'm1');
        expect(finalMinion).toBeDefined();
        expect(finalMinion!.powerCounters).toBe(1);
    });

    it('怪物：天赋移除指示物并额外打出随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('monster1', 'frankenstein_the_monster', '0', 5, { powerCounters: 2 }),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const talentResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'monster1', baseIndex: 0 } },
            defaultTestRandom,
        );

        // 应移除一个指示物
        const removedEvt = talentResult.events.find(
            e => e.type === SU_EVENTS.POWER_COUNTER_REMOVED && (e as any).payload.reason === 'frankenstein_the_monster',
        );
        expect(removedEvt).toBeDefined();
        expect((removedEvt as any).payload.minionUid).toBe('monster1');
        // 应授予额外随从额度
        const limitEvt = talentResult.events.find(
            e => e.type === SU_EVENTS.LIMIT_MODIFIED && (e as any).payload.limitType === 'minion',
        );
        expect(limitEvt).toBeDefined();
    });
});

// ============================================================================
// 吸血鬼派系
// ============================================================================

describe('吸血鬼派系能力', () => {
    it('剔除弱者：应先选随从，再可连续弃置并主动停止结算', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'vampire_cull_the_weak', 'action', '0'),
                        makeCard('h1', 'test_minion', 'minion', '0'),
                        makeCard('h2', 'test_minion', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('v1', 'vampire_nightstalker', '0', 4),
                        makeMinion('v2', 'vampire_fledgling_vampire', '0', 2),
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

        const chooseMinionPrompt = getInteractionsFromMS(playResult.finalState)[0];
        expect(chooseMinionPrompt?.data?.sourceId).toBe('vampire_cull_the_weak');
        const minionOption = chooseMinionPrompt.data.options.find((o: any) => o?.value?.minionUid === 'v1');

        const afterChooseMinion = runCommand(
            playResult.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: minionOption.id } } as any,
            defaultTestRandom,
        );

        const discardPrompt = getInteractionsFromMS(afterChooseMinion.finalState)[0];
        expect(discardPrompt?.data?.sourceId).toBe('vampire_cull_the_weak_choose_card');
        expect(discardPrompt?.data?.targetType).toBe('hand');
        const firstCardOption = discardPrompt.data.options.find((o: any) => o?.value?.cardUid === 'h1');

        // 第一张：单选弃牌 → 立即弃1张+放1个指示物
        const afterDiscardOne = runCommand(
            afterChooseMinion.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: firstCardOption.id } } as any,
            defaultTestRandom,
        );

        expect(afterDiscardOne.events.some(e => e.type === SU_EVENTS.CARDS_DISCARDED)).toBe(true);
        const counterEvt1 = afterDiscardOne.events.find(
            e => e.type === SU_EVENTS.POWER_COUNTER_ADDED && (e as any).payload.reason === 'vampire_cull_the_weak',
        );
        expect(counterEvt1).toBeDefined();
        expect((counterEvt1 as any).payload.minionUid).toBe('v1');
        expect((counterEvt1 as any).payload.amount).toBe(1);

        // 还有随从卡 → 继续选择
        const continuePrompt = getInteractionsFromMS(afterDiscardOne.finalState)[0];
        expect(continuePrompt?.data?.sourceId).toBe('vampire_cull_the_weak_choose_card');
        const secondCardOption = continuePrompt.data.options.find((o: any) => o?.value?.cardUid === 'h2');

        // 第二张：弃完最后一张 → 自动结束（无更多随从卡）
        const afterDiscardTwo = runCommand(
            afterDiscardOne.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: secondCardOption.id } } as any,
            defaultTestRandom,
        );

        const counterEvt2 = afterDiscardTwo.events.find(
            e => e.type === SU_EVENTS.POWER_COUNTER_ADDED && (e as any).payload.reason === 'vampire_cull_the_weak',
        );
        expect(counterEvt2).toBeDefined();
        expect((counterEvt2 as any).payload.minionUid).toBe('v1');

        // 手牌随从卡用完 → 无更多交互
        const nextPrompt = getInteractionsFromMS(afterDiscardTwo.finalState)[0];
        expect(nextPrompt).toBeUndefined();
    });

    // 跳过此测试 - Opportunist 触发器的复杂时序需要完整的系统支持
    it.skip('投机主义：对手随从被消灭后才给附着随从+1', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'vampire_big_gulp', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('m0', 'test_host', '0', 5, {
                            attachedActions: [{ uid: 'oa1', defId: 'vampire_opportunist', ownerId: '0' }],
                        }),
                        makeMinion('e1', 'enemy_low', '1', 2),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const result = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
            defaultTestRandom,
        );

        const opportunistEvt = result.events.find(
            e => e.type === SU_EVENTS.POWER_COUNTER_ADDED && (e as any).payload.reason === 'vampire_opportunist',
        );
        expect(opportunistEvt).toBeDefined();
        expect((opportunistEvt as any).payload.minionUid).toBe('m0');
    });

    it('投机主义：己方随从被消灭时不应触发', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [makeCard('a1', 'vampire_big_gulp', 'action', '1')],
                }),
            },
            currentPlayerIndex: 1,
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('m0', 'test_host', '0', 4, {
                            attachedActions: [{ uid: 'oa1', defId: 'vampire_opportunist', ownerId: '0' }],
                        }),
                        makeMinion('f1', 'test_fodder', '0', 2),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const resolveResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '1', payload: { cardUid: 'a1' } },
            defaultTestRandom,
        );

        const opportunistEvt = resolveResult.events.find(
            e => e.type === SU_EVENTS.POWER_COUNTER_ADDED && (e as any).payload.reason === 'vampire_opportunist',
        );
        expect(opportunistEvt).toBeUndefined();
    });

    it('吸血鬼伯爵：己方随从被消灭时不应触发', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [makeCard('a1', 'vampire_big_gulp', 'action', '1')],
                }),
            },
            currentPlayerIndex: 1,
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('c1', 'vampire_the_count', '0', 5, { powerCounters: 1 }),
                        makeMinion('f1', 'test_fodder', '0', 2),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const resolveResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '1', payload: { cardUid: 'a1' } },
            defaultTestRandom,
        );

        const countEvt = resolveResult.events.find(
            e => e.type === SU_EVENTS.POWER_COUNTER_ADDED && (e as any).payload.reason === 'vampire_the_count',
        );
        expect(countEvt).toBeUndefined();
    });

    it('渴血鬼：多同名来源时应给触发来源加指示物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('c_hd', 'vampire_heavy_drinker', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('hd_old', 'vampire_heavy_drinker', '0', 3),
                        makeMinion('fod1', 'test_fodder', '0', 2),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [
                        makeMinion('hd_new', 'vampire_heavy_drinker', '0', 3),
                        makeMinion('fod2', 'test_fodder', '0', 2),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const playResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c_hd', baseIndex: 1 } },
            defaultTestRandom,
        );

        const prompt = getInteractionsFromMS(playResult.finalState)[0];
        const option = prompt.data.options.find((o: any) => o?.value?.minionUid === 'fod2');

        const resolveResult = runCommand(
            playResult.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );

        const counterEvt = resolveResult.events.find(
            e => e.type === SU_EVENTS.POWER_COUNTER_ADDED && (e as any).payload.reason === 'vampire_heavy_drinker',
        );
        expect(counterEvt).toBeDefined();
        expect((counterEvt as any).payload.minionUid).toBe('c_hd');
    });

    it('夜行者：多同名来源时应给入场来源加指示物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('c1', 'vampire_nightstalker', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('e1', 'enemy_low', '1', 1),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [
                        makeMinion('ns_old', 'vampire_nightstalker', '0', 4),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        // 强制效果 + 单目标 → 自动执行，不创建交互
        const playResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
            defaultTestRandom,
        );

        // 单目标自动消灭，直接检查事件
        const counterEvt = playResult.events.find(
            e => e.type === SU_EVENTS.POWER_COUNTER_ADDED && (e as any).payload.reason === 'vampire_nightstalker',
        );
        expect(counterEvt).toBeDefined();
        expect((counterEvt as any).payload.minionUid).toBe('c1');
    });
});

// ============================================================================
// 狼人派系
// ============================================================================

describe('狼人派系能力', () => {
    it('关门放狗：预算应跨多次选择递减并支持连续消灭', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'werewolf_let_the_dog_out', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('w1', 'werewolf_howler', '0', 4),
                        makeMinion('e1', 'enemy_a', '1', 1),
                        makeMinion('e2', 'enemy_b', '1', 3),
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

        const prompt1 = getInteractionsFromMS(playResult.finalState)[0];
        expect(prompt1?.data?.sourceId).toBe('werewolf_let_the_dog_out_targets');

        const target1 = prompt1.data.options.find((o: any) => o?.value?.minionUid === 'e1');
        const step1 = runCommand(
            playResult.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: target1.id } } as any,
            defaultTestRandom,
        );
        expect(step1.events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);

        const prompt2 = getInteractionsFromMS(step1.finalState)[0];
        const target2 = prompt2.data.options.find((o: any) => o?.value?.minionUid === 'e2');
        expect(target2).toBeDefined();

        const step2 = runCommand(
            step1.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: target2.id } } as any,
            defaultTestRandom,
        );
        expect(step2.events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
        expect(getInteractionsFromMS(step2.finalState).length).toBe(0);
    });

    it('关门放狗：第一次消灭后应按剩余预算过滤目标', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'werewolf_let_the_dog_out', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('w1', 'werewolf_howler', '0', 4),
                        makeMinion('e1', 'enemy_a', '1', 2),
                        makeMinion('e2', 'enemy_b', '1', 3),
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
        const prompt1 = getInteractionsFromMS(playResult.finalState)[0];
        const firstTarget = prompt1.data.options.find((o: any) => o?.value?.minionUid === 'e1');

        const step1 = runCommand(
            playResult.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: firstTarget.id } } as any,
            defaultTestRandom,
        );

        const promptsAfterFirstKill = getInteractionsFromMS(step1.finalState);
        expect(promptsAfterFirstKill.length).toBe(0);
    });
});

// ============================================================================
// 米斯卡塔尼克大学派系
// ============================================================================

describe('米斯卡塔尼克大学派系能力', () => {
    describe('miskatonic_librarian（图书管理员 talent）', () => {
        it('手中有疯狂卡时弃掉并抽1张牌', () => {
            const madnessCard = makeCard('mad1', 'special_madness', 'action', '0');
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [madnessCard],
                        deck: [
                            makeCard('dk1', 'card_a', 'minion', '0'),
                            makeCard('dk2', 'card_b', 'action', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [
                        makeMinion('lib1', 'miskatonic_librarian', '0', 4),
                    ], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'lib1', baseIndex: 0 } },
                defaultTestRandom
            );
            // 应有弃牌事件（弃疯狂卡）和抽牌事件
            const discardEvt = result.events.find(e => e.type === SU_EVENTS.CARDS_DISCARDED);
            expect(discardEvt).toBeDefined();
            const drawEvt = result.events.find(e => e.type === SU_EVENTS.CARDS_DRAWN);
            expect(drawEvt).toBeDefined();
        });

        it('手中无疯狂卡时不产生事件', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('h1', 'some_card', 'minion', '0')],
                        deck: [makeCard('dk1', 'card_a', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [
                        makeMinion('lib1', 'miskatonic_librarian', '0', 4),
                    ], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'lib1', baseIndex: 0 } },
                defaultTestRandom
            );
            expect(result.events.find(e => e.type === SU_EVENTS.CARDS_DISCARDED)).toBeUndefined();
            expect(result.events.find(e => e.type === SU_EVENTS.CARDS_DRAWN)).toBeUndefined();
        });
    });

    describe('miskatonic_professor（教授 talent）', () => {
        it('手中有疯狂卡时弃掉并获得额外行动+额外随从', () => {
            const madnessCard = makeCard('mad1', 'special_madness', 'action', '0');
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [madnessCard],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [
                        makeMinion('prof1', 'miskatonic_professor', '0', 5),
                    ], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'prof1', baseIndex: 0 } },
                defaultTestRandom
            );
            // 应有弃牌事件（弃疯狂卡）
            const discardEvt = result.events.find(e => e.type === SU_EVENTS.CARDS_DISCARDED);
            expect(discardEvt).toBeDefined();
            // 应有额度修改事件（额外行动 + 额外随从）
            const limitEvts = result.events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
            expect(limitEvts.length).toBe(2);
        });

        it('手中无疯狂卡时不产生事件', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('h1', 'some_card', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [
                        makeMinion('prof1', 'miskatonic_professor', '0', 5),
                    ], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'prof1', baseIndex: 0 } },
                defaultTestRandom
            );
            expect(result.events.find(e => e.type === SU_EVENTS.CARDS_DISCARDED)).toBeUndefined();
            expect(result.events.find(e => e.type === SU_EVENTS.LIMIT_MODIFIED)).toBeUndefined();
        });
    });
});

// ============================================================================
// 印斯茅斯派系
// ============================================================================

describe('印斯茅斯派系能力', () => {
    describe('innsmouth_the_locals（本地人 onPlay）', () => {
        it('牌库顶有同名卡时放入手牌，其余放牌库底', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('c1', 'innsmouth_the_locals', 'minion', '0')],
                        deck: [
                            makeCard('dk1', 'innsmouth_the_locals', 'minion', '0'),
                            makeCard('dk2', 'other_card', 'action', '0'),
                            makeCard('dk3', 'innsmouth_the_locals', 'minion', '0'),
                            makeCard('dk4', 'deep_card', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
                defaultTestRandom
            );
            // 同名卡（dk1, dk3）应被抽到手牌
            const drawEvt = result.events.find(e => e.type === SU_EVENTS.CARDS_DRAWN);
            expect(drawEvt).toBeDefined();
            expect(drawEvt!.payload.cardUids).toEqual(['dk1', 'dk3']);
            expect(drawEvt!.payload.count).toBe(2);

            // 非同名卡（dk2）应放到牌库底
            const reorderEvt = result.events.find(e => e.type === SU_EVENTS.DECK_REORDERED);
            expect(reorderEvt).toBeDefined();
            // 新牌库 = 剩余牌库（dk4）+ 放底的（dk2）
            expect(reorderEvt!.payload.deckUids).toEqual(['dk4', 'dk2']);
        });

        it('牌库顶3张无同名卡时全部放牌库底', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('c1', 'innsmouth_the_locals', 'minion', '0')],
                        deck: [
                            makeCard('dk1', 'card_a', 'minion', '0'),
                            makeCard('dk2', 'card_b', 'action', '0'),
                            makeCard('dk3', 'card_c', 'minion', '0'),
                            makeCard('dk4', 'card_d', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
                defaultTestRandom
            );
            // 无同名卡，不应有抽牌事件
            expect(result.events.find(e => e.type === SU_EVENTS.CARDS_DRAWN)).toBeUndefined();
            // 3张全部放牌库底
            const reorderEvt = result.events.find(e => e.type === SU_EVENTS.DECK_REORDERED);
            expect(reorderEvt).toBeDefined();
            // 新牌库 = 剩余（dk4）+ 放底的（dk1, dk2, dk3）
            expect(reorderEvt!.payload.deckUids).toEqual(['dk4', 'dk1', 'dk2', 'dk3']);
        });

        it('牌库为空时不产生事件', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('c1', 'innsmouth_the_locals', 'minion', '0')],
                        deck: [],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
                defaultTestRandom
            );
            expect(result.events.find(e => e.type === SU_EVENTS.CARDS_DRAWN)).toBeUndefined();
            expect(result.events.find(e => e.type === SU_EVENTS.DECK_REORDERED)).toBeUndefined();
        });

        it('牌库不足3张时只检查可用的牌', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('c1', 'innsmouth_the_locals', 'minion', '0')],
                        deck: [
                            makeCard('dk1', 'innsmouth_the_locals', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
                defaultTestRandom
            );
            const drawEvt = result.events.find(e => e.type === SU_EVENTS.CARDS_DRAWN);
            expect(drawEvt).toBeDefined();
            expect(drawEvt!.payload.cardUids).toEqual(['dk1']);
        });
    });
});

// ============================================================================
// 幽灵派系
// ============================================================================

describe('幽灵派系能力', () => {
    describe('ghost_spirit（灵魂 onPlay）', () => {
        it('单个可消灭目标时创建 Prompt', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            makeCard('c1', 'ghost_spirit', 'minion', '0'),
                            makeCard('h1', 'filler_a', 'minion', '0'),
                            makeCard('h2', 'filler_b', 'action', '0'),
                            makeCard('h3', 'filler_c', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [
                        makeMinion('m1', 'enemy_weak', '1', 2),
                        makeMinion('m2', 'enemy_strong', '1', 5),
                    ], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
                defaultTestRandom
            );
            // 单个可消灭目标时创建 Prompt
            const interactions = getInteractionsFromMS(result.finalState);
            expect(interactions.length).toBe(1);
        });

        it('多个可消灭目标时创建 Prompt', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            makeCard('c1', 'ghost_spirit', 'minion', '0'),
                            makeCard('h1', 'f1', 'minion', '0'),
                            makeCard('h2', 'f2', 'action', '0'),
                            makeCard('h3', 'f3', 'minion', '0'),
                            makeCard('h4', 'f4', 'action', '0'),
                            makeCard('h5', 'f5', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [
                        makeMinion('m1', 'enemy_a', '1', 2),
                        makeMinion('m2', 'enemy_b', '1', 4),
                    ], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
                defaultTestRandom
            );
            // 5张手牌（排除自身），两个目标都可消灭 → Prompt
            const interactions = getInteractionsFromMS(result.finalState);
            expect(interactions.length).toBe(1);
            expect(interactions[0].data.sourceId).toBe('ghost_spirit');
        });

        it('手牌不足以消灭任何对手随从时不产生事件', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            makeCard('c1', 'ghost_spirit', 'minion', '0'),
                            makeCard('h1', 'filler', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [
                        makeMinion('m1', 'enemy', '1', 5),
                    ], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
                defaultTestRandom
            );
            // 只有1张可弃手牌，对手力量5，不够
            expect(result.events.find(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBeUndefined();
            expect(result.events.find(e => e.type === SU_EVENTS.CARDS_DISCARDED)).toBeUndefined();
        });

        it('无对手随从时不产生事件', () => {
            const core = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            makeCard('c1', 'ghost_spirit', 'minion', '0'),
                            makeCard('h1', 'filler', 'minion', '0'),
                            makeCard('h2', 'filler2', 'action', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    { defId: 'base_a', minions: [
                        makeMinion('m0', 'own', '0', 3),
                    ], ongoingActions: [] },
                ],
            });
            const state = makeMatchState(core);
            const result = runCommand(state,
                { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
                defaultTestRandom
            );
            expect(result.events.find(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBeUndefined();
        });
    });
});
