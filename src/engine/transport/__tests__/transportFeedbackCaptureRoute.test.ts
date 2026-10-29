import { describe, expect, it, vi } from 'vitest';
import { registerGameSocketRoutes, type GameSocketRouteHooks } from '../transportSocketRouter';

function createHarness(playerId: string | null = '0', authorized = true) {
    let onConnection: any;
    const handlers = new Map<string, (...args: any[]) => unknown>();
    const socket = { id: 'socket', on: (name: string, handler: (...args: any[]) => unknown) => handlers.set(name, handler),
        emit: vi.fn(), to: () => ({ emit: vi.fn() }) };
    const match = { matchID: 'm1', state: { core: { hiddenHand: ['private-card'] }, sys: {} } } as any;
    const capture = vi.fn(async () => ({ accepted: true, captureId: 'opaque-id' }));
    const hooks: GameSocketRouteHooks<any> = {
        getSocketInfo: () => ({ matchID: 'm1', playerID: playerId, credentials: 'seat-secret' }),
        getMatch: id => id === 'm1' ? match : undefined,
        validateCommandAuth: vi.fn(async () => authorized),
        captureFeedbackReplay: capture,
        resolveOnlineAiSeatControllerType: () => 'human', handleSync: vi.fn(), handleCommand: vi.fn(),
        handleBatch: vi.fn(), handleManualSetupSelection: vi.fn(), handleManualForceEndAiPhase: vi.fn(), handleDisconnect: vi.fn(),
    } as any;
    registerGameSocketRoutes({ namespace: { on: (_: string, handler: any) => { onConnection = handler; } } as any, hooks });
    onConnection(socket);
    return { handlers, capture, match };
}

describe('用户反馈权威现场连接权限', () => {
    it('已认证座位可请求服务器内部保存现场，响应不含隐藏状态', async () => {
        const h = createHarness();
        const ack = vi.fn();
        await h.handlers.get('feedback:capture')?.('m1', { phase: 'prepare' }, 'seat-secret', ack);
        expect(h.capture).toHaveBeenCalledWith(h.match, '0', { phase: 'prepare' });
        expect(ack).toHaveBeenCalledWith({ accepted: true, captureId: 'opaque-id' });
        expect(JSON.stringify(ack.mock.calls)).not.toContain('private-card');
    });
    it.each([[null, true], ['0', false]] as const)('旁观者或无效座位凭证不得采集', async (playerId, authorized) => {
        const h = createHarness(playerId, authorized);
        const ack = vi.fn();
        await h.handlers.get('feedback:capture')?.('m1', { phase: 'prepare' }, 'bad-token', ack);
        expect(h.capture).not.toHaveBeenCalled();
        expect(ack).toHaveBeenCalledWith({ accepted: false });
    });
});
