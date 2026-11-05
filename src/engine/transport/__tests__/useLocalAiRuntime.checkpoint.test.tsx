import { StrictMode } from 'react';
import { useLocalProviderSession } from '../useLocalProviderSession';
import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { createGameEngine, createInitialSystemState, createTutorialSystem } from '../../index';
import type { DomainCore, MatchState, Command, GameEvent } from '../../types';
import { createLocalProviderRandom } from '../localProviderBootstrap';
import { useLocalAiRuntime } from '../useLocalAiRuntime';

vi.mock('../localAiAutomationEffect', () => ({ startLocalAiAutomationEffect: () => () => {} }));
type Core = { roll: number; currentPlayerId: string };
const domain: DomainCore<Core, Command, GameEvent> = {
    gameId: 'checkpoint-probe', setup: () => ({ roll: 0, currentPlayerId: '0' }), validate: () => ({ valid: true }),
    execute: (_state, command, random) => command.type === 'ROLL' ? [{ type: 'ROLLED', payload: { value: random.d(1000) }, timestamp: 0 }] : [],
    reduce: (core, event) => event.type === 'ROLLED' ? { ...core, roll: (event.payload as { value: number }).value } : core,
};

it('本地正式提交口跨随机动作回退与重做结果一致，并清除恢复信号', () => {
    const seed = 'local-tutorial-random-checkpoint';
    const systems = [createTutorialSystem<Core>()];
    const config = createGameEngine({ domain, systems, minPlayers: 1, maxPlayers: 1, commandTypes: ['ROLL'] });
    const stateRef: { current: MatchState<unknown> } = { current: { core: { roll: 0, currentPlayerId: '0' }, sys: createInitialSystemState(['0'], systems, seed) } };
    const randomRef = { current: createLocalProviderRandom(seed) };
    const setState = vi.fn();
    const { result } = renderHook(() => useLocalAiRuntime({ state: stateRef.current, config, seed, stateRef, randomRef, setState, seatControllers: {},
        localPregameControlledPlayerId: '0', setupPlayerIds: ['0'], onCommandRejectedRef: { current: undefined }, automationDisabled: true }));
    const send = (type: string, payload: unknown = {}) => act(() => result.current.dispatch(type, payload));
    send('SYS_TUTORIAL_START', { manifest: { id: 'random-checkpoint', steps: [{ id: 'roll', content: 'roll', requireAction: true, allowedCommands: ['ROLL'], advanceOnEvents: [{ type: 'ROLLED' }] }, { id: 'result', content: 'result' }] } });
    send('ROLL');
    const first = (stateRef.current.core as Core).roll;
    const firstCursor = randomRef.current.getCursor();
    expect(stateRef.current.sys.tutorial.step?.id).toBe('result');
    send('SYS_TUTORIAL_PREVIOUS');
    expect(stateRef.current.sys.tutorial.step?.id).toBe('roll');
    expect((stateRef.current.core as Core).roll).toBe(0);
    expect(randomRef.current.getCursor()).toBe(0);
    expect(stateRef.current.sys.undo.restoredRandomCursor).toBeUndefined();
    send('ROLL');
    expect((stateRef.current.core as Core).roll).toBe(first);
    expect(randomRef.current.getCursor()).toBe(firstCursor);
    expect(stateRef.current.sys.tutorial.step?.id).toBe('result');
});

it('StrictMode初始setup与随后游标同源，重复初始化不多消费一次随机序列', () => {
    const seed = 'strict-local-setup-cursor';
    const randomDomain = { ...domain, setup: (_ids: string[], random: import('../../types').RandomFn) => ({ roll: random.d(1000), currentPlayerId: '0' }) };
    const config = createGameEngine({ domain: randomDomain, systems: [], minPlayers: 1, maxPlayers: 1, commandTypes: ['ROLL'] });
    const expected = createLocalProviderRandom(seed);
    const first = expected.d(1000);
    const second = expected.d(1000);
    const { result } = renderHook(() => useLocalProviderSession({ config, numPlayers: 1, seed, setupData: undefined, setupPlayerIds: ['0'], aiSeatIds: [], persistSession: false }), { wrapper: StrictMode });
    expect((result.current.state.core as Core).roll).toBe(first);
    expect(result.current.randomRef.current.getCursor()).toBe(1);
    expect(result.current.randomRef.current.d(1000)).toBe(second);
});
