import { describe, expect, test } from 'vitest';
import { createReplayAdapter } from '../../../engine/adapter';
import { TheGangDomain, buildShowdownResults } from '../domain';
import { THE_GANG_COMMANDS, type ShowdownPlayerResult, type TheGangCore } from '../domain/types';

const strengthOrder = (left: ShowdownPlayerResult, right: ShowdownPlayerResult) => {
    const categoryDelta = left.strength.category - right.strength.category;
    if (categoryDelta !== 0) return categoryDelta;

    for (let index = 0; index < Math.max(left.strength.ranks.length, right.strength.ranks.length); index += 1) {
        const rankDelta = (left.strength.ranks[index] ?? 0) - (right.strength.ranks[index] ?? 0);
        if (rankDelta !== 0) return rankDelta;
    }

    return 0;
};

const pickCorrectChipByStrength = (core: TheGangCore) => {
    return [...buildShowdownResults(core)]
        .sort(strengthOrder)
        .reduce<Record<string, number>>((chips, result, index) => ({
            ...chips,
            [result.handSlot ? `${result.playerId}:${result.handSlot}` : result.playerId]: index + 1,
        }), {});
};

const confirmProgressForAllPlayers = (
    adapter: ReturnType<typeof createReplayAdapter>,
    state: ReturnType<ReturnType<typeof createReplayAdapter>['setup']>,
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
        }).state;
    }
    return nextState;
};

const startCurrentHeistIfNeeded = (
    adapter: ReturnType<typeof createReplayAdapter>,
    state: ReturnType<ReturnType<typeof createReplayAdapter>['setup']>,
) => state.core.heistStarted
    ? state
    : adapter.execute(state, {
        type: THE_GANG_COMMANDS.START_HEIST,
        playerId: state.core.playerIds[0]!,
        payload: {},
        timestamp: state.core.heistNumber * 1000 + 1,
    }).state;

describe('The Gang 最低自动验证路径', () => {
    test('自动座位可以重复完成三次成功抢劫并触发胜利结算', () => {
        const adapter = createReplayAdapter(TheGangDomain, 'the-gang-auto-path-test');
        let state = adapter.setup(['0', '1', '2']);

        while (!state.core.gameResult) {
            state = startCurrentHeistIfNeeded(adapter, state);

            for (const round of [1, 2, 3]) {
                for (const [index, playerId] of state.core.playerIds.entries()) {
                    state = adapter.execute(state, {
                        type: THE_GANG_COMMANDS.TAKE_CHIP,
                        playerId,
                        payload: { chip: index + 1 },
                        timestamp: state.core.heistNumber * 1000 + round * 10 + index,
                    }).state;
                }

                state = confirmProgressForAllPlayers(
                    adapter,
                    state,
                    THE_GANG_COMMANDS.END_ROUND,
                    state.core.heistNumber * 1000 + round * 100,
                );
            }

            const finalRoundChips = pickCorrectChipByStrength(state.core);
            for (const playerId of state.core.playerIds) {
                state = adapter.execute(state, {
                    type: THE_GANG_COMMANDS.TAKE_CHIP,
                    playerId,
                    payload: { chip: finalRoundChips[playerId] },
                    timestamp: state.core.heistNumber * 1000 + 400 + Number(playerId),
                }).state;
            }

            state = confirmProgressForAllPlayers(
                adapter,
                state,
                THE_GANG_COMMANDS.REVEAL_SHOWDOWN,
                state.core.heistNumber * 1000 + 500,
            );

            if (!state.core.gameResult) {
                state = confirmProgressForAllPlayers(
                    adapter,
                    state,
                    THE_GANG_COMMANDS.START_NEXT_HEIST,
                    state.core.heistNumber * 1000 + 600,
                );
            }
        }

        expect(state.core.successes).toBe(3);
        expect(state.core.failures).toBe(0);
        expect(state.core.phase).toBe('game-over');
        expect(state.core.gameResult).toEqual({ winners: ['0', '1', '2'] });
        expect(state.core.heistHistory).toHaveLength(3);
    });
});
