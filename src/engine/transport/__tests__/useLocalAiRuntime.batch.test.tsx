/* @vitest-environment happy-dom */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createInitialSystemState } from '../../pipeline';
import { TRANSPORT_BATCH_COMMAND } from '../../batchDispatchCommand';
import type { MatchState } from '../../types';
import type { GameEngineConfig } from '../engineConfig';
import { createLocalProviderRandom } from '../localProviderBootstrap';
import { useLocalAiRuntime } from '../useLocalAiRuntime';

const config: GameEngineConfig = {
    gameId: 'batch-contract', systems: [], commandTypes: ['ADD', 'REJECT', 'THROW'],
    domain: {
        gameId: 'batch-contract', setup: () => ({ count: 0 }),
        validate: (_, command) => ({ valid: command.type !== 'REJECT', error: 'domain_rejected' }),
        execute: (_, command, random) => {
            random.random();
            if (command.type === 'THROW') throw new Error('executor_failed');
            return [{ type: 'ADDED', payload: {}, timestamp: command.timestamp ?? 0 }];
        },
        reduce: (core) => ({ count: (core as { count: number }).count + 1 }),
        isGameOver: () => undefined,
    },
};

function renderRuntime() {
    const initial: MatchState<unknown> = { core: { count: 0 }, sys: createInitialSystemState(['0', '1'], []) };
    const stateRef = { current: initial };
    const randomRef = { current: createLocalProviderRandom('batch-seed', 3) };
    const setState = vi.fn();
    const hook = renderHook(() => useLocalAiRuntime({
        state: initial, config, seed: 'batch-seed', seatControllers: {},
        localPregameControlledPlayerId: null, setState, stateRef, randomRef,
        setupPlayerIds: ['0', '1'], onCommandRejectedRef: { current: vi.fn() }, automationDisabled: true,
    }));
    return { ...hook, stateRef, randomRef, setState, initial };
}

describe('local business batch atomicity', () => {
    it.each(['REJECT', 'THROW'])('keeps state and random cursor when a later %s fails', (failure) => {
        const runtime = renderRuntime();
        act(() => runtime.result.current.dispatch(TRANSPORT_BATCH_COMMAND, {
            commands: [{ type: 'ADD', payload: {} }, { type: failure, payload: {} }],
        }));
        expect(runtime.stateRef.current).toBe(runtime.initial);
        expect(runtime.randomRef.current.getCursor()).toBe(3);
        expect(runtime.setState).not.toHaveBeenCalled();
    });

    it('publishes the whole action once after all commands succeed', () => {
        const runtime = renderRuntime();
        act(() => runtime.result.current.dispatch(TRANSPORT_BATCH_COMMAND, {
            commands: [{ type: 'ADD', payload: {} }, { type: 'ADD', payload: {} }],
        }));
        expect(runtime.stateRef.current.core).toEqual({ count: 2 });
        expect(runtime.randomRef.current.getCursor()).toBe(5);
        expect(runtime.setState).toHaveBeenCalledTimes(1);
    });
});
