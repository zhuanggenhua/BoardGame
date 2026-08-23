/* @vitest-environment happy-dom */
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { MatchState } from '../../types';
import { TRANSPORT_BATCH_COMMAND } from '../../batchDispatchCommand';
import { useLocalProviderViewModel } from '../useLocalProviderViewModel';

type TestState = MatchState<{
    activePlayerId: string;
    turnOrder: string[];
    currentPlayerIndex: number;
}>;

const createState = (): TestState => ({
    core: {
        activePlayerId: '0',
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
    },
    sys: {
        schemaVersion: 1,
        phase: 'defensiveRoll',
        turnNumber: 1,
        undo: { snapshots: [], maxSnapshots: 50 },
        interaction: { queue: [] },
        log: { entries: [], maxEntries: 0 },
        eventStream: { entries: [], maxEntries: 200, nextId: 1 },
        actionLog: { entries: [], maxEntries: 50 },
        rematch: { votes: {}, ready: false },
        responseWindow: {},
    },
});

describe('useLocalProviderViewModel', () => {
    it('固定本地视角下，应为 UI dispatch 显式注入 __internalPlayerId', () => {
        const dispatch = vi.fn();
        const { result } = renderHook(() => useLocalProviderViewModel({
            state: createState(),
            dispatch,
            reset: vi.fn(),
            playerIds: ['0', '1'],
            seatControllers: {},
            localPregameControlledPlayerId: null,
            followCurrentTurnPlayer: false,
            localPlayerId: '1',
        }));

        act(() => {
            result.current.dispatch('TOGGLE_DIE_LOCK', { dieId: 0 });
        });

        expect(dispatch).toHaveBeenCalledWith('TOGGLE_DIE_LOCK', {
            dieId: 0,
            __internalPlayerId: '1',
        });
    });

    it('payload 已带 __internalPlayerId 时，不应被本地视角再次覆盖', () => {
        const dispatch = vi.fn();
        const { result } = renderHook(() => useLocalProviderViewModel({
            state: createState(),
            dispatch,
            reset: vi.fn(),
            playerIds: ['0', '1'],
            seatControllers: {},
            localPregameControlledPlayerId: null,
            followCurrentTurnPlayer: false,
            localPlayerId: '1',
        }));

        act(() => {
            result.current.dispatch('TOGGLE_DIE_LOCK', {
                dieId: 0,
                __internalPlayerId: '0',
            });
        });

        expect(dispatch).toHaveBeenCalledWith('TOGGLE_DIE_LOCK', {
            dieId: 0,
            __internalPlayerId: '0',
        });
    });

    it('内部批量命令应逐条执行，并给每条业务命令注入本地视角玩家', () => {
        const dispatch = vi.fn();
        const { result } = renderHook(() => useLocalProviderViewModel({
            state: createState(),
            dispatch,
            reset: vi.fn(),
            playerIds: ['0', '1'],
            seatControllers: {},
            localPregameControlledPlayerId: null,
            followCurrentTurnPlayer: false,
            localPlayerId: '1',
        }));

        act(() => {
            result.current.dispatch(TRANSPORT_BATCH_COMMAND, {
                commands: [
                    { type: 'REROLL_DIE', payload: { dieId: 0 } },
                    { type: 'REROLL_DIE', payload: { dieId: 1 } },
                ],
            });
        });

        expect(dispatch).toHaveBeenCalledTimes(2);
        expect(dispatch).toHaveBeenNthCalledWith(1, 'REROLL_DIE', {
            dieId: 0,
            __internalPlayerId: '1',
        });
        expect(dispatch).toHaveBeenNthCalledWith(2, 'REROLL_DIE', {
            dieId: 1,
            __internalPlayerId: '1',
        });
    });
});
