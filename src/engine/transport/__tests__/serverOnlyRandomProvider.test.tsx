// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import msgpackParser from 'socket.io-msgpack-parser';
import { TicTacToeDomain } from '../../../games/tictactoe/domain';
import { ticTacToeLatencyConfig } from '../../../games/tictactoe/latencyConfig';
import { createInitialSystemState } from '../../pipeline';
import type { GameEngineConfig } from '../engineConfig';

const transport = vi.hoisted(() => ({ sockets: [] as any[] }));
vi.mock('socket.io-client', () => ({
  io: () => {
    const listeners = new Map<string, (...args: any[]) => void>();
    const socket = {
      connected: true,
      io: { on: vi.fn() },
      on: vi.fn((name: string, cb: (...args: any[]) => void) => { listeners.set(name, cb); return socket; }),
      off: vi.fn(), once: vi.fn(), emit: vi.fn(),
      removeAllListeners: vi.fn(() => listeners.clear()), disconnect: vi.fn(), connect: vi.fn(),
      receive: (name: string, ...args: any[]) => listeners.get(name)?.(...args),
    };
    transport.sockets.push(socket);
    return socket;
  },
}));
vi.mock('../../../lib/mobile/appVisibility', () => ({ onAppVisible: () => () => undefined }));
vi.mock('../latency/optimisticEngine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../latency/optimisticEngine')>();
  return { ...actual, createOptimisticEngine: vi.fn(actual.createOptimisticEngine) };
});

import { createOptimisticEngine } from '../latency/optimisticEngine';
import { useGameProviderRuntime } from '../useGameProviderRuntime';

const base: GameEngineConfig = { gameId: 'tictactoe', domain: TicTacToeDomain, systems: [], minPlayers: 2, maxPlayers: 2 };
const privateConfig: GameEngineConfig = { ...base, randomSyncPolicy: 'server-only' };
const state = () => ({ core: TicTacToeDomain.setup(['0', '1'], {} as never), sys: createInitialSystemState(['0', '1'], [], 'test') });
const players = [{ id: 0 }, { id: 1 }];
const cells = (result: any) => result.current.value.state?.core?.cells as (string | null)[];

beforeEach(() => { transport.sockets.length = 0; vi.mocked(createOptimisticEngine).mockClear(); });
afterEach(cleanup);

describe('server-only random provider', () => {
  it('无种子 sync 后仍发送命令，等待权威 patch 而不预测', () => {
    const { result } = renderHook(() => useGameProviderRuntime({ server: 'test', matchId: 'private', playerId: '0', engineConfig: privateConfig, latencyConfig: ticTacToeLatencyConfig }));
    const socket = transport.sockets.at(-1)!;
    act(() => socket.receive('connect'));
    // Exercise the production wire parser: undefined positional metadata decodes as null.
    const encoder = new msgpackParser.Encoder();
    const decoder = new msgpackParser.Decoder();
    decoder.on('decoded', (packet: any) => socket.receive(packet.data[0], ...packet.data.slice(1)));
    const encoded = encoder.encode({ type: msgpackParser.PacketType.EVENT, nsp: '/game', data: ['state:sync', 'private', state(), players, undefined, { stateID: 0 }] });
    act(() => encoded.forEach((packet: any) => decoder.add(packet)));
    expect(cells(result)[0]).toBeNull();
    expect(createOptimisticEngine).not.toHaveBeenCalled();
    act(() => { expect(result.current.value.dispatch('CLICK_CELL', { cellId: 0 })).toBe(true); });
    expect(socket.emit).toHaveBeenCalledWith('command', 'private', 'CLICK_CELL', { cellId: 0 }, undefined, { expectedStateID: 0 });
    expect(cells(result)[0]).toBeNull();
    act(() => socket.receive('state:patch', 'private', [{ op: 'replace', path: '/core/cells/0', value: '0' }], players, { stateID: 1 }));
    expect(cells(result)[0]).toBe('0');
  });

  it('同一 provider 从公开种子对局切到 server-only 后不保留预测', () => {
    const { result, rerender } = renderHook(({ config, matchId }) => useGameProviderRuntime({ server: 'test', matchId, playerId: '0', engineConfig: config, latencyConfig: ticTacToeLatencyConfig }), { initialProps: { config: base, matchId: 'public' } });
    const publicSocket = transport.sockets.at(-1)!;
    act(() => { publicSocket.receive('connect'); publicSocket.receive('state:sync', 'public', state(), players, { seed: 'old-public-seed', cursor: 0 }, { stateID: 0 }); });
    act(() => { expect(result.current.value.dispatch('CLICK_CELL', { cellId: 0 })).toBe(true); });
    expect(cells(result)[0]).toBe('0');
    rerender({ config: privateConfig, matchId: 'private' });
    const privateSocket = transport.sockets.at(-1)!;
    act(() => { privateSocket.receive('connect'); privateSocket.receive('state:sync', 'private', state(), players, null, { stateID: 0 }); });
    expect(cells(result)[0]).toBeNull();
    act(() => { expect(result.current.value.dispatch('CLICK_CELL', { cellId: 0 })).toBe(true); });
    expect(privateSocket.emit).toHaveBeenCalledWith('command', 'private', 'CLICK_CELL', { cellId: 0 }, undefined, { expectedStateID: 0 });
    expect(cells(result)[0]).toBeNull();
    act(() => privateSocket.receive('state:patch', 'private', [{ op: 'replace', path: '/core/cells/0', value: '0' }], players, { stateID: 1 }));
    expect(cells(result)[0]).toBe('0');
  });
});
