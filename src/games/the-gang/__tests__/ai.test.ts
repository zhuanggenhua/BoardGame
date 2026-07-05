import { describe, expect, test } from 'vitest';
import type { AiDecisionContext } from '../../../engine/ai';
import { buildAiDecisionContext } from '../../../engine/ai';
import { createReplayAdapter } from '../../../engine/adapter';
import { TheGangDomain } from '../domain';
import { buildTheGangAiLegalActions, theGangAiRuntime } from '../ai';
import '../game';
import { THE_GANG_COMMANDS } from '../domain/types';

const setupState = () => {
    const adapter = createReplayAdapter(TheGangDomain, 'the-gang-ai-test');
    return adapter.setup(['0', '1', '2']);
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

describe('The Gang local AI', () => {
    test('初始抢劫阶段每个 AI 座位都有可选筹码动作', () => {
        const state = setupState();

        for (const playerId of state.core.playerIds) {
            const actions = buildTheGangAiLegalActions({ playerId, state });

            expect(actions).toHaveLength(3);
            expect(actions.every((action) => action.kind === 'take-chip')).toBe(true);
            expect(actions.map((action) => action.commands[0]?.type)).toEqual([
                THE_GANG_COMMANDS.TAKE_CHIP,
                THE_GANG_COMMANDS.TAKE_CHIP,
                THE_GANG_COMMANDS.TAKE_CHIP,
            ]);
        }
    });

    test('其他玩家已占用的筹码不会进入 AI 候选', () => {
        const adapter = createReplayAdapter(TheGangDomain, 'the-gang-ai-occupied-chip-test');
        let state = adapter.setup(['0', '1', '2']);
        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.TAKE_CHIP,
            playerId: '0',
            payload: { chip: 2 },
            timestamp: 1,
        }).state;

        const actions = buildTheGangAiLegalActions({ playerId: '1', state });

        expect(actions.map((action) => action.metadata?.chip)).toEqual([1, 3]);
        expect(actions.some((action) => action.metadata?.chip === 2)).toBe(false);
    });

    test('全员选完后 AI 能推进轮次、摊牌并开始下一次抢劫', () => {
        const adapter = createReplayAdapter(TheGangDomain, 'the-gang-ai-progress-test');
        let state = adapter.setup(['0', '1', '2']);

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
            state = adapter.execute(state, {
                type: THE_GANG_COMMANDS.END_ROUND,
                playerId: '0',
                payload: {},
                timestamp: round * 100,
            }).state;
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

        expect(buildTheGangAiLegalActions({ playerId: '0', state })
            .some((action) => action.kind === 'start-next-heist')).toBe(true);
    });

    test('baseline policy 只返回当前上下文里的合法 actionId', () => {
        const state = setupState();
        const context = buildContext(state, '0');
        const decision = theGangAiRuntime.localPolicies?.baseline.decide(context);

        expect(decision).not.toBeNull();
        expect(context.legalActions.some((action) => action.actionId === decision?.actionId)).toBe(true);
    });
});
