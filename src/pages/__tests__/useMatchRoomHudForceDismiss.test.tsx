/* @vitest-environment happy-dom */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatchState } from '../../engine/types';
import { INTERACTION_COMMANDS } from '../../engine/systems';
import { useMatchRoomHudForceDismiss } from '../useMatchRoomHudForceDismiss';

const mockedRuntimeAdapters = vi.hoisted(() => ({
    tryHandleGameHudForceDismiss: vi.fn(() => false),
    dismissGamePageTransientUi: vi.fn(() => false),
}));

vi.mock('../../games/gameHudRuntimeAdapter', () => ({
    tryHandleGameHudForceDismiss: mockedRuntimeAdapters.tryHandleGameHudForceDismiss,
}));

vi.mock('../../games/pageRuntimeTransientUi', () => ({
    dismissGamePageTransientUi: mockedRuntimeAdapters.dismissGamePageTransientUi,
}));

function buildState(args: {
    currentPlayerId: string;
    phase: string;
    hostStarted?: boolean;
    interactionCurrent?: unknown;
    interactionBlocked?: boolean;
    responseWindowCurrent?: unknown;
    turnNumber?: number;
}): MatchState<unknown> {
    return {
        core: {
            activePlayerId: args.currentPlayerId,
            turnOrder: ['0', '1'],
            currentPlayerIndex: args.currentPlayerId === '0' ? 0 : 1,
            hostStarted: args.hostStarted ?? true,
        },
        sys: {
            phase: args.phase,
            turnNumber: args.turnNumber ?? 3,
            interaction: {
                current: args.interactionCurrent,
                isBlocked: args.interactionBlocked ?? false,
                queue: [],
            },
            responseWindow: {
                current: args.responseWindowCurrent,
            },
            eventStream: {
                nextId: 1,
            },
            decisionEpoch: 0,
        },
    } as MatchState<unknown>;
}

describe('useMatchRoomHudForceDismiss', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockedRuntimeAdapters.tryHandleGameHudForceDismiss.mockReturnValue(false);
        mockedRuntimeAdapters.dismissGamePageTransientUi.mockReturnValue(false);
    });

    it('自己的卡死回合在收口途中再次出现阻塞时，应继续强制解锁并推进到下一玩家', async () => {
        const dispatch = vi.fn();
        const initialState = buildState({
            currentPlayerId: '0',
            phase: 'scoreBases',
            responseWindowCurrent: {
                id: 'score-rw-1',
                windowType: 'afterScoring',
                sourceId: 'scoreBases',
                responderQueue: ['0'],
                currentResponderIndex: 0,
            },
        });

        const { result, rerender } = renderHook((props: {
            state: MatchState<unknown>;
        }) => useMatchRoomHudForceDismiss({
            gameId: 'summonerwars',
            state: props.state,
            dispatch,
            myPlayerId: '0',
            engineConfig: {
                gameId: 'summonerwars',
                onlineAiRecovery: {
                    advancePhaseCommandType: 'sw:end_phase',
                },
            },
        }), {
            initialProps: { state: initialState },
        });

        await act(async () => {
            await result.current();
        });

        expect(dispatch).toHaveBeenNthCalledWith(1, INTERACTION_COMMANDS.FORCE_UNLOCK, {});

        rerender({
            state: buildState({
                currentPlayerId: '0',
                phase: 'scoreBases',
            }),
        });

        await waitFor(() => {
            expect(dispatch).toHaveBeenNthCalledWith(2, 'sw:end_phase', {});
        });

        rerender({
            state: buildState({
                currentPlayerId: '0',
                phase: 'afterCardPlayed',
                responseWindowCurrent: {
                    id: 'score-rw-2',
                    windowType: 'afterCardPlayed',
                    sourceId: 'follow-up',
                    responderQueue: ['0'],
                    currentResponderIndex: 0,
                },
                turnNumber: 4,
            }),
        });

        await waitFor(() => {
            expect(dispatch).toHaveBeenNthCalledWith(3, INTERACTION_COMMANDS.FORCE_UNLOCK, {});
        });

        rerender({
            state: buildState({
                currentPlayerId: '1',
                phase: 'playCards',
                turnNumber: 4,
            }),
        });

        await waitFor(() => {
            expect(dispatch).toHaveBeenCalledTimes(3);
        });
    });

    it('非自己回合的响应死锁只应关闭当前阻塞，不应代替对方推进回合', async () => {
        const dispatch = vi.fn();
        const initialState = buildState({
            currentPlayerId: '1',
            phase: 'scoreBases',
            responseWindowCurrent: {
                id: 'score-rw-offturn',
                windowType: 'afterScoring',
                sourceId: 'scoreBases',
                responderQueue: ['0'],
                currentResponderIndex: 0,
            },
        });

        const { result, rerender } = renderHook((props: {
            state: MatchState<unknown>;
        }) => useMatchRoomHudForceDismiss({
            gameId: 'smashup',
            state: props.state,
            dispatch,
            myPlayerId: '0',
            engineConfig: { gameId: 'smashup' },
        }), {
            initialProps: { state: initialState },
        });

        await act(async () => {
            await result.current();
        });

        expect(dispatch).toHaveBeenCalledTimes(1);
        expect(dispatch).toHaveBeenNthCalledWith(1, INTERACTION_COMMANDS.FORCE_UNLOCK, {});

        rerender({
            state: buildState({
                currentPlayerId: '1',
                phase: 'scoreBases',
            }),
        });

        await waitFor(() => {
            expect(dispatch).toHaveBeenCalledTimes(1);
        });
    });

    it('公开预开局阶段即使卡住，也不应误发阶段推进命令破坏选阵营流程', async () => {
        const dispatch = vi.fn();
        const initialState = buildState({
            currentPlayerId: '0',
            phase: 'factionSelect',
            hostStarted: false,
            interactionCurrent: {
                id: 'pregame-stuck',
                playerId: '0',
            },
        });

        const { result, rerender } = renderHook((props: {
            state: MatchState<unknown>;
        }) => useMatchRoomHudForceDismiss({
            gameId: 'smashup',
            state: props.state,
            dispatch,
            myPlayerId: '0',
            engineConfig: {
                gameId: 'smashup',
                onlineAiRecovery: {
                    publicPregameLegalActionPhases: ['factionSelect'],
                },
            },
        }), {
            initialProps: { state: initialState },
        });

        await act(async () => {
            await result.current();
        });

        expect(dispatch).toHaveBeenCalledTimes(1);
        expect(dispatch).toHaveBeenNthCalledWith(1, INTERACTION_COMMANDS.FORCE_UNLOCK, {});

        rerender({
            state: buildState({
                currentPlayerId: '0',
                phase: 'factionSelect',
                hostStarted: false,
            }),
        });

        await waitFor(() => {
            expect(dispatch).toHaveBeenCalledTimes(1);
        });
    });
});
