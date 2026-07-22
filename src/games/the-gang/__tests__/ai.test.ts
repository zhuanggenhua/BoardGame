import { describe, expect, test } from 'vitest';
import type { AiDecisionContext } from '../../../engine/ai';
import { buildAiDecisionContext } from '../../../engine/ai';
import { createReplayAdapter } from '../../../engine/adapter';
import { resolveNextLocalAiAction } from '../../../engine/ai/localRunner';
import { TheGangDomain } from '../domain';
import { buildTheGangAiLegalActions, theGangAiRuntime } from '../ai';
import { engineConfig } from '../game';
import { THE_GANG_COMMANDS, type PlayingCard, type TheGangCore } from '../domain/types';

const setupState = () => {
    const adapter = createReplayAdapter(TheGangDomain, 'the-gang-ai-test');
    return adapter.setup(['0', '1', '2']);
};

const startHeist = (
    adapter: ReturnType<typeof createReplayAdapter>,
    state: ReturnType<typeof setupState>,
    timestamp = 0,
) => adapter.execute(state, {
    type: THE_GANG_COMMANDS.START_HEIST,
    playerId: '0',
    payload: {},
    timestamp,
}).state as ReturnType<typeof setupState>;

const setupStartedState = () => {
    const adapter = createReplayAdapter(TheGangDomain, 'the-gang-ai-started-test');
    return startHeist(adapter, adapter.setup(['0', '1', '2']));
};

const buildContext = (state: ReturnType<typeof setupState>, playerId = '0'): AiDecisionContext =>
    buildAiDecisionContext({
        gameId: 'the-gang',
        matchId: 'the-gang-ai-test',
        playerId,
        visibleState: state,
        rulesVersion: null,
        decisionBudgetMs: 250,
        source: 'local',
        seatController: { type: 'local-ai' },
    });

const standardCard = (rank: PlayingCard['rank'], suit: PlayingCard['suit']): PlayingCard => ({
    rank,
    suit,
    kind: 'standard',
});

const setupFourPlayerTwoHandFinalRoundState = () => {
    const adapter = createReplayAdapter(TheGangDomain, 'the-gang-ai-two-hand-exit-chip-test');
    let state = adapter.setup(['0', '1', '2', '3']);
    state = adapter.execute(state, {
        type: THE_GANG_COMMANDS.SET_RULES_CONFIG,
        playerId: '0',
        payload: {
            config: {
                gameMode: 'texas-holdem',
                twoHand: true,
                challenges: {},
            },
        },
        timestamp: 1,
    }).state as ReturnType<typeof setupState>;
    state = startHeist(adapter, state, 2);
    return {
        ...state,
        core: {
            ...state.core,
            round: 4,
            phase: 'chip-selection',
            communityCards: [
                standardCard('2', 'clubs'),
                standardCard('7', 'diamonds'),
                standardCard('9', 'hearts'),
                standardCard('J', 'clubs'),
                standardCard('K', 'diamonds'),
            ],
            currentRoundChips: {
                '0:top': 1,
                '0:bottom': 2,
                '1:top': 3,
                '1:bottom': 4,
                '2:top': 5,
                '2:bottom': 6,
                '3:top': 7,
                '3:bottom': 8,
            },
            currentRoundExitChipOwners: [],
        },
    } satisfies ReturnType<typeof setupState>;
};

const confirmProgressForAllPlayers = (
    adapter: ReturnType<typeof createReplayAdapter>,
    state: ReturnType<typeof setupState>,
    type: typeof THE_GANG_COMMANDS.END_ROUND | typeof THE_GANG_COMMANDS.REVEAL_SHOWDOWN | typeof THE_GANG_COMMANDS.START_NEXT_HEIST,
    timestamp: number,
) => {
    let nextState = state;
    for (const [index, playerId] of nextState.core.playerIds.entries()) {
        nextState = adapter.execute(nextState, {
            type,
            playerId,
            payload: {},
            timestamp: timestamp + index,
        }).state as ReturnType<typeof setupState>;
    }
    return nextState;
};

describe('The Gang local AI', () => {
    test('初始配置窗口所有 AI 都等待房主开始抢劫', () => {
        const state = setupState();

        expect(buildTheGangAiLegalActions({ playerId: '0', state })).toEqual([]);
        expect(buildTheGangAiLegalActions({ playerId: '1', state })).toEqual([]);
        expect(buildTheGangAiLegalActions({ playerId: '2', state })).toEqual([]);
    });

    test('房主选筹码后 AI 座位恢复可选筹码动作', () => {
        const adapter = createReplayAdapter(TheGangDomain, 'the-gang-ai-after-owner-chip-test');
        let state = adapter.setup(['0', '1', '2']);
        state = startHeist(adapter, state);
        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.TAKE_CHIP,
            playerId: '0',
            payload: { chip: 1 },
            timestamp: 1,
        }).state;

        const actions = buildTheGangAiLegalActions({ playerId: '1', state });
        expect(actions).toHaveLength(3);
        expect(actions.every((action) => action.kind === 'take-chip')).toBe(true);
        expect(actions.map((action) => action.commands[0]?.type)).toEqual([
            THE_GANG_COMMANDS.TAKE_CHIP,
            THE_GANG_COMMANDS.TAKE_CHIP,
            THE_GANG_COMMANDS.TAKE_CHIP,
        ]);
    });

    test('别人面前的筹码仍会进入空手 AI 候选，已拿筹码的 AI 等待空手玩家补齐', () => {
        const adapter = createReplayAdapter(TheGangDomain, 'the-gang-ai-occupied-chip-test');
        let state = adapter.setup(['0', '1', '2']);
        state = startHeist(adapter, state);
        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.TAKE_CHIP,
            playerId: '0',
            payload: { chip: 2 },
            timestamp: 1,
        }).state;

        const actions = buildTheGangAiLegalActions({ playerId: '1', state });

        expect(actions.map((action) => action.metadata?.chip)).toEqual([1, 2, 3]);

        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.TAKE_CHIP,
            playerId: '1',
            payload: { chip: 2 },
            timestamp: 2,
        }).state;

        expect(state.core.currentRoundChips).toEqual({ '1': 2 });
        expect(buildTheGangAiLegalActions({ playerId: '1', state })
            .filter((action) => action.kind === 'take-chip')
            .map((action) => action.metadata?.chip)).toEqual([]);
        expect(buildTheGangAiLegalActions({ playerId: '0', state })
            .map((action) => action.metadata?.chip)).toEqual([1, 2, 3]);
    });

    test('AI 的筹码被拿走后会重新选筹码并允许全员推进，不会停在缺筹码状态', async () => {
        const adapter = createReplayAdapter(TheGangDomain, 'the-gang-ai-chip-stolen-runner-test');
        let state = adapter.setup(['0', '1', '2']);
        state = startHeist(adapter, state);
        const seatControllers = {
            '0': { type: 'human' as const },
            '1': { type: 'local-ai' as const, minimumActionDelayMs: 0 },
            '2': { type: 'local-ai' as const, minimumActionDelayMs: 0 },
        };

        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.TAKE_CHIP,
            playerId: '1',
            payload: { chip: 2 },
            timestamp: 1,
        }).state;
        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.TAKE_CHIP,
            playerId: '0',
            payload: { chip: 2 },
            timestamp: 2,
        }).state;
        expect(state.core.currentRoundChips).toEqual({ '0': 2 });

        const recoveredAiChip = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'the-gang-ai-chip-stolen-runner-test',
            seatControllers,
        });
        expect(recoveredAiChip?.playerId).toBe('1');
        expect(recoveredAiChip?.action.kind).toBe('take-chip');
        for (const command of recoveredAiChip?.action.commands ?? []) {
            state = adapter.execute(state, {
                type: command.type as typeof THE_GANG_COMMANDS.TAKE_CHIP,
                playerId: recoveredAiChip!.playerId,
                payload: command.payload as { chip: number },
                timestamp: 3,
            }).state;
        }

        const secondAiChip = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'the-gang-ai-chip-stolen-runner-test',
            seatControllers,
        });
        expect(secondAiChip?.playerId).toBe('2');
        expect(secondAiChip?.action.kind).toBe('take-chip');
        for (const command of secondAiChip?.action.commands ?? []) {
            state = adapter.execute(state, {
                type: command.type as typeof THE_GANG_COMMANDS.TAKE_CHIP,
                playerId: secondAiChip!.playerId,
                payload: command.payload as { chip: number },
                timestamp: 4,
            }).state;
        }

        expect(Object.keys(state.core.currentRoundChips).sort()).toEqual(['0', '1', '2']);
        expect(buildTheGangAiLegalActions({ playerId: '1', state })
            .some((action) => action.kind === 'end-round')).toBe(true);
    });

    test('全员选完后 AI 能推进轮次、摊牌并开始下一次抢劫', () => {
        const adapter = createReplayAdapter(TheGangDomain, 'the-gang-ai-progress-test');
        let state = adapter.setup(['0', '1', '2']);
        state = startHeist(adapter, state);

        for (const [index, playerId] of state.core.playerIds.entries()) {
            state = adapter.execute(state, {
                type: THE_GANG_COMMANDS.TAKE_CHIP,
                playerId,
                payload: { chip: index + 1 },
                timestamp: index,
            }).state;
        }

        expect(buildTheGangAiLegalActions({ playerId: '0', state })
            .some((action) => action.kind === 'end-round')).toBe(true);

        for (const round of [1, 2, 3]) {
            if (round > 1) {
                for (const [index, playerId] of state.core.playerIds.entries()) {
                    state = adapter.execute(state, {
                        type: THE_GANG_COMMANDS.TAKE_CHIP,
                        playerId,
                        payload: { chip: index + 1 },
                        timestamp: round * 10 + index,
                    }).state;
                }
            }
            state = confirmProgressForAllPlayers(adapter, state, THE_GANG_COMMANDS.END_ROUND, round * 100);
        }

        for (const [index, playerId] of state.core.playerIds.entries()) {
            state = adapter.execute(state, {
                type: THE_GANG_COMMANDS.TAKE_CHIP,
                playerId,
                payload: { chip: index + 1 },
                timestamp: 400 + index,
            }).state;
        }

        expect(buildTheGangAiLegalActions({ playerId: '0', state })
            .some((action) => action.kind === 'reveal-showdown')).toBe(true);

        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.REVEAL_SHOWDOWN,
            playerId: '0',
            payload: {},
            timestamp: 500,
        }).state;
        expect(state.core.phase).toBe('chip-selection');
        expect(state.core.pendingProgress).toEqual({ kind: 'reveal-showdown', approvals: ['0'] });

        state = confirmProgressForAllPlayers(adapter, state, THE_GANG_COMMANDS.REVEAL_SHOWDOWN, 510);
        expect(state.core.phase).toBe('showdown');

        expect(buildTheGangAiLegalActions({ playerId: '0', state })
            .some((action) => action.kind === 'start-next-heist')).toBe(true);
    });

    test('AI 在手牌调换阶段默认确认不调换', () => {
        const state = setupStartedState();
        const handSwapState: ReturnType<typeof setupState> = {
            ...state,
            core: {
                ...state.core,
                phase: 'hand-swap',
                rules: {
                    ...state.core.rules,
                    config: {
                        ...state.core.rules.config,
                        twoHand: true,
                    },
                },
            },
        };

        const actions = buildTheGangAiLegalActions({ playerId: '1', state: handSwapState });

        expect(actions).toHaveLength(1);
        expect(actions[0]).toMatchObject({
            kind: 'confirm-hand-swap',
            commands: [{
                type: THE_GANG_COMMANDS.CONFIRM_HAND_SWAP,
                payload: {},
            }],
        });
    });

    test('两副手牌 AI 会为上手和下手分别生成选筹码动作', () => {
        const adapter = createReplayAdapter(TheGangDomain, 'the-gang-ai-two-hand-chip-test');
        let state = adapter.setup(['0', '1', '2']);
        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.SET_RULES_CONFIG,
            playerId: '0',
            payload: {
                config: {
                    gameMode: 'texas-holdem',
                    twoHand: true,
                    challenges: {},
                },
            },
            timestamp: 1,
        }).state;
        state = startHeist(adapter, state, 2);

        const actions = buildTheGangAiLegalActions({ playerId: '1', state })
            .filter((action) => action.kind === 'take-chip');

        expect(actions).toHaveLength(12);
        expect(new Set(actions.map((action) => action.metadata?.handSlot))).toEqual(new Set(['top', 'bottom']));
        expect(actions.filter((action) => action.metadata?.handSlot === 'top').map((action) => action.metadata?.chip))
            .toEqual([1, 2, 3, 4, 5, 6]);
        expect(actions.filter((action) => action.metadata?.handSlot === 'bottom').map((action) => action.metadata?.chip))
            .toEqual([1, 2, 3, 4, 5, 6]);

        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.TAKE_CHIP,
            playerId: '1',
            payload: { chip: 2, handSlot: 'top' },
            timestamp: 3,
        }).state;

        const remainingActions = buildTheGangAiLegalActions({ playerId: '1', state })
            .filter((action) => action.kind === 'take-chip');
        expect(new Set(remainingActions.map((action) => action.metadata?.handSlot))).toEqual(new Set(['bottom']));
    });

    test('五人两副手牌 AI 每手生成 0 星和 1-8 星筹码动作且不重复 actionId', () => {
        const adapter = createReplayAdapter(TheGangDomain, 'the-gang-ai-two-hand-zero-chip-test');
        let state = adapter.setup(['0', '1', '2', '3', '4']);
        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.SET_RULES_CONFIG,
            playerId: '0',
            payload: {
                config: {
                    gameMode: 'texas-holdem',
                    twoHand: true,
                    challenges: {},
                },
            },
            timestamp: 1,
        }).state;
        state = startHeist(adapter, state, 2);

        const actions = buildTheGangAiLegalActions({ playerId: '4', state })
            .filter((action) => action.kind === 'take-chip');
        const topActions = actions.filter((action) => action.metadata?.handSlot === 'top');
        const bottomActions = actions.filter((action) => action.metadata?.handSlot === 'bottom');

        expect(actions).toHaveLength(18);
        expect(new Set(actions.map((action) => action.actionId)).size).toBe(actions.length);
        expect(topActions.map((action) => action.metadata?.chip)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
        expect(bottomActions.map((action) => action.metadata?.chip)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    });

    test('四人两副手牌第四轮 AI 先拿撤离筹码，拿够后才允许摊牌', () => {
        const state = setupFourPlayerTwoHandFinalRoundState();
        const actions = buildTheGangAiLegalActions({ playerId: '0', state });

        expect(actions.map((action) => action.kind)).toEqual(['take-exit-chip', 'take-exit-chip']);
        expect(actions.map((action) => action.commands[0])).toEqual([
            { type: THE_GANG_COMMANDS.TAKE_EXIT_CHIP, payload: { handSlot: 'top' } },
            { type: THE_GANG_COMMANDS.TAKE_EXIT_CHIP, payload: { handSlot: 'bottom' } },
        ]);
        expect(theGangAiRuntime.localPolicies?.baseline.decide(buildContext(state, '0'))?.actionId)
            .toBe('take-exit-chip:top');

        const oneExitChipState: ReturnType<typeof setupState> = {
            ...state,
            core: {
                ...state.core,
                currentRoundExitChipOwners: ['0:top'],
            },
        };
        expect(buildTheGangAiLegalActions({ playerId: '0', state: oneExitChipState })
            .map((action) => action.metadata?.handSlot)).toEqual(['bottom']);

        const allExitChipsTakenState: ReturnType<typeof setupState> = {
            ...state,
            core: {
                ...state.core,
                currentRoundExitChipOwners: ['0:top', '1:bottom'],
            },
        };
        const completedActions = buildTheGangAiLegalActions({ playerId: '0', state: allExitChipsTakenState });
        expect(completedActions.some((action) => action.kind === 'take-exit-chip')).toBe(false);
        expect(completedActions.some((action) => action.kind === 'reveal-showdown')).toBe(true);
    });

    test('baseline policy 只返回当前上下文里的合法 actionId', () => {
        const state = setupStartedState();
        const context = buildContext(state, '0');
        const decision = theGangAiRuntime.localPolicies?.baseline.decide(context);

        expect(decision).not.toBeNull();
        expect(context.legalActions.some((action) => action.actionId === decision?.actionId)).toBe(true);
    });

    test('baseline policy 会按当前牌力评估选择对应强弱筹码', () => {
        const state = setupStartedState();
        const core: TheGangCore = {
            ...state.core,
            communityCards: [
                { suit: 'spades', rank: 'A' },
                { suit: 'hearts', rank: 'K' },
                { suit: 'diamonds', rank: 'Q' },
            ],
            players: {
                ...state.core.players,
                '0': {
                    ...state.core.players['0'],
                    pocketCards: [
                        { suit: 'clubs', rank: '2' },
                        { suit: 'diamonds', rank: '7' },
                    ],
                },
                '1': {
                    ...state.core.players['1'],
                    pocketCards: [
                        { suit: 'clubs', rank: 'K' },
                        { suit: 'clubs', rank: '3' },
                    ],
                },
                '2': {
                    ...state.core.players['2'],
                    pocketCards: [
                        { suit: 'clubs', rank: 'A' },
                        { suit: 'diamonds', rank: 'A' },
                    ],
                },
            },
        };
        const rankedState: ReturnType<typeof setupState> = { ...state, core };

        expect(theGangAiRuntime.localPolicies?.baseline.decide(buildContext(rankedState, '0'))?.actionId)
            .toBe('take-chip:1');
        const afterOwnerChipState: ReturnType<typeof setupState> = {
            ...rankedState,
            core: {
                ...rankedState.core,
                currentRoundChips: { '0': 1 },
            },
        };
        expect(theGangAiRuntime.localPolicies?.baseline.decide(buildContext(afterOwnerChipState, '1'))?.actionId)
            .toBe('take-chip:2');
        expect(theGangAiRuntime.localPolicies?.baseline.decide(buildContext(afterOwnerChipState, '2'))?.actionId)
            .toBe('take-chip:3');
    });

    test('本地 AI runner 会在真人操作后连续派发 AI 选筹码与推进确认', async () => {
        const adapter = createReplayAdapter(TheGangDomain, 'the-gang-ai-runner-test');
        let state = adapter.setup(['0', '1', '2']);
        state = startHeist(adapter, state);
        const seatControllers = {
            '0': { type: 'human' as const },
            '1': { type: 'local-ai' as const, minimumActionDelayMs: 0 },
            '2': { type: 'local-ai' as const, minimumActionDelayMs: 0 },
        };

        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.TAKE_CHIP,
            playerId: '0',
            payload: { chip: 1 },
            timestamp: 1,
        }).state;

        const firstAiChip = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'the-gang-ai-runner-test',
            seatControllers,
        });
        expect(firstAiChip?.playerId).toBe('1');
        expect(firstAiChip?.action.kind).toBe('take-chip');
        for (const command of firstAiChip?.action.commands ?? []) {
            state = adapter.execute(state, {
                type: command.type as typeof THE_GANG_COMMANDS.TAKE_CHIP,
                playerId: firstAiChip!.playerId,
                payload: command.payload as { chip: number },
                timestamp: 2,
            }).state;
        }

        const secondAiChip = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'the-gang-ai-runner-test',
            seatControllers,
        });
        expect(secondAiChip?.playerId).toBe('2');
        expect(secondAiChip?.action.kind).toBe('take-chip');
        for (const command of secondAiChip?.action.commands ?? []) {
            state = adapter.execute(state, {
                type: command.type as typeof THE_GANG_COMMANDS.TAKE_CHIP,
                playerId: secondAiChip!.playerId,
                payload: command.payload as { chip: number },
                timestamp: 3,
            }).state;
        }

        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.END_ROUND,
            playerId: '0',
            payload: {},
            timestamp: 4,
        }).state;

        const firstAiApproval = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'the-gang-ai-runner-test',
            seatControllers,
        });
        expect(firstAiApproval?.playerId).toBe('1');
        expect(firstAiApproval?.action.kind).toBe('end-round');
        for (const command of firstAiApproval?.action.commands ?? []) {
            state = adapter.execute(state, {
                type: command.type as typeof THE_GANG_COMMANDS.END_ROUND,
                playerId: firstAiApproval!.playerId,
                payload: {},
                timestamp: 5,
            }).state;
        }

        const secondAiApproval = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'the-gang-ai-runner-test',
            seatControllers,
        });
        expect(secondAiApproval?.playerId).toBe('2');
        expect(secondAiApproval?.action.kind).toBe('end-round');
        for (const command of secondAiApproval?.action.commands ?? []) {
            state = adapter.execute(state, {
                type: command.type as typeof THE_GANG_COMMANDS.END_ROUND,
                playerId: secondAiApproval!.playerId,
                payload: {},
                timestamp: 6,
            }).state;
        }

        expect(state.core.round).toBe(2);
        expect(state.core.communityCards).toHaveLength(3);
        expect(state.core.currentRoundChips).toEqual({});
        expect(state.core.pendingProgress).toBeUndefined();
    });
});
