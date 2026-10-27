// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameTransportClientConfig } from '../client';
import { useGameProviderRuntime } from '../useGameProviderRuntime';
import { TicTacToeDomain } from '../../../games/tictactoe/domain';
import { createInitialSystemState } from '../../pipeline';
import { ticTacToeLatencyConfig } from '../../../games/tictactoe/latencyConfig';
import type { GameEngineConfig } from '../engineConfig';

const network = vi.hoisted(() => ({ config: null as GameTransportClientConfig | null, send: vi.fn(() => true) }));
vi.mock('../client', () => ({ GameTransportClient: class {
    lastReceivedStateID = 0;
    constructor(config: GameTransportClientConfig) { network.config = config; }
    connect() {}
    disconnect() {}
    canSendCommand() { return true; }
    updateLatestState() {}
    sendCommand = network.send;
    resync() {}
} }));
vi.mock('../../../lib/mobile/appVisibility', () => ({ onAppVisible: () => () => undefined }));

const engineConfig: GameEngineConfig = { gameId: 'tictactoe', domain: TicTacToeDomain, systems: [], minPlayers: 2, maxPlayers: 2 };
const initial = () => ({ core: TicTacToeDomain.setup(['0', '1'], {} as never), sys: createInitialSystemState(['0', '1'], [], 'test') });
beforeEach(() => { network.send.mockClear(); network.config = null; });

describe('公开联机派发的权威版本前置条件', () => {
    it.each([true, false])('第一步不把当前命令本身计入已完成版本，乐观预测=%s', predicted => {
        const config = { ...ticTacToeLatencyConfig, optimistic: { ...ticTacToeLatencyConfig.optimistic!, commandDeterminism: { CLICK_CELL: predicted ? 'deterministic' as const : 'non-deterministic' as const } } };
        const { result } = renderHook(() => useGameProviderRuntime({ server: 'test', matchId: 'test', playerId: '0', engineConfig, latencyConfig: config }));
        act(() => network.config!.onStateUpdate!(initial(), [{ id: 0 }, { id: 1 }], { stateID: 0 }, predicted ? { seed: 'test', cursor: 0 } : undefined));
        act(() => { expect(result.current.value.dispatch('CLICK_CELL', { cellId: 0 })).toBe(true); });
        expect((result.current.value.state?.core as { cells: (string | null)[] }).cells[0]).toBe(predicted ? '0' : null);
        expect(network.send).toHaveBeenCalledWith('CLICK_CELL', { cellId: 0 }, { expectedStateID: 0 });
    });
    it('已有未确认命令时，伴随命令仍等待前一版本，不能削弱过期校验', () => {
        const config = { ...ticTacToeLatencyConfig, optimistic: { ...ticTacToeLatencyConfig.optimistic!, pendingCompanionCommands: ['COMPANION'] } };
        const { result } = renderHook(() => useGameProviderRuntime({ server: 'test', matchId: 'test', playerId: '0', engineConfig, latencyConfig: config }));
        act(() => network.config!.onStateUpdate!(initial(), [{ id: 0 }, { id: 1 }], { stateID: 0 }, { seed: 'test', cursor: 0 }));
        act(() => { result.current.value.dispatch('CLICK_CELL', { cellId: 0 }); });
        act(() => { result.current.value.dispatch('COMPANION', {}); });
        expect(network.send).toHaveBeenLastCalledWith('COMPANION', {}, { expectedStateID: 1 });
    });
});
