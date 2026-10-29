import { describe, expect, it, vi } from 'vitest';
import type { Server as IOServer, Socket as IOSocket } from 'socket.io';
import {
    registerGameSocketRoutes,
    type GameSocketRouteHooks,
    type GameSocketRouteMatch,
} from '../transportSocketRouter';

type TestMatch = GameSocketRouteMatch & { matchID: string };

function createRouterHarness(args: {
    socketInfo: { matchID: string; playerID: string | null; credentials?: string };
    match?: TestMatch;
    adminUserId?: string | null;
}) {
    let onConnection: ((socket: IOSocket) => void) | undefined;
    const namespace = {
        on: (_event: string, handler: (socket: IOSocket) => void) => {
            onConnection = handler;
        },
    } as unknown as ReturnType<IOServer['of']>;
    const eventHandlers = new Map<string, (...eventArgs: unknown[]) => unknown>();
    const socketEmit = vi.fn();
    const socket = {
        id: 'socket-1',
        on: (event: string, handler: (...eventArgs: unknown[]) => unknown) => {
            eventHandlers.set(event, handler);
        },
        emit: socketEmit,
        to: () => ({ emit: vi.fn() }),
    } as unknown as IOSocket;
    const handleCommand = vi.fn(async () => true);
    const handleAdminDebugCommand = vi.fn(async () => true);
    const hooks: GameSocketRouteHooks<TestMatch> = {
        getSocketInfo: () => args.socketInfo,
        getMatch: () => args.match,
        validateCommandAuth: vi.fn(async () => true),
        validateAdminDebugToken: vi.fn(async (token) => token === 'valid-admin-token' ? args.adminUserId ?? null : null),
        isAdminDebugCommand: (_match, commandType) => commandType.startsWith('SYS_CHEAT_'),
        handleAdminDebugCommand,
        resolveOnlineAiSeatControllerType: () => 'human',
        handleSync: vi.fn(async () => undefined),
        handleCommand,
        handleBatch: vi.fn(async () => undefined),
        handleManualSetupSelection: vi.fn(async () => false),
        handleManualForceEndAiPhase: vi.fn(async () => ({ accepted: false, reason: 'rejected' })),
        handleDisconnect: vi.fn(),
    };

    registerGameSocketRoutes({ namespace, hooks });
    onConnection?.(socket);

    return {
        eventHandlers,
        socketEmit,
        hooks,
        handleCommand,
        handleAdminDebugCommand,
        invoke: async (event: string, ...eventArgs: unknown[]) => eventHandlers.get(event)?.(...eventArgs),
    };
}

describe('transport socket admin debug route', () => {
    it('拒绝普通座位命令通道直接发送作弊调试命令', async () => {
        const harness = createRouterHarness({
            socketInfo: { matchID: 'match-1', playerID: '0', credentials: 'seat-token' },
            match: { matchID: 'match-1', state: { core: {}, sys: {} } },
        });

        await harness.invoke('command', 'match-1', 'SYS_CHEAT_SET_STATE', { state: { score: 10 } }, 'seat-token');

        expect(harness.handleCommand).not.toHaveBeenCalled();
        expect(harness.socketEmit).toHaveBeenCalledWith('error', 'match-1', 'admin_debug_channel_required');
    });

    it('拒绝普通批次通道夹带作弊调试命令', async () => {
        const harness = createRouterHarness({
            socketInfo: { matchID: 'match-1', playerID: '0', credentials: 'seat-token' },
            match: { matchID: 'match-1', state: { core: {}, sys: {} } },
        });

        await harness.invoke(
            'batch',
            'match-1',
            'batch-1',
            [{ type: 'SYS_CHEAT_SET_STATE', payload: { state: { score: 10 } } }],
            'seat-token',
        );

        expect(harness.hooks.handleBatch).not.toHaveBeenCalled();
        expect(harness.socketEmit).toHaveBeenCalledWith('batch:rejected', 'match-1', 'batch-1', 'admin_debug_channel_required');
    });

    it('允许当前管理员从无座位的匹配 socket 执行受保护调试命令', async () => {
        const harness = createRouterHarness({
            socketInfo: { matchID: 'match-1', playerID: null },
            match: { matchID: 'match-1', state: { core: {}, sys: {} } },
            adminUserId: 'admin-42',
        });
        let access: { allowed: boolean } | undefined;
        let commandResult: { accepted: boolean; reason?: string } | undefined;

        await harness.invoke('admin-debug:access', 'valid-admin-token', (result: { allowed: boolean }) => {
            access = result;
        });
        await harness.invoke(
            'admin-debug:command',
            'match-1',
            'SYS_CHEAT_SET_STATE',
            { state: { score: 10 } },
            'valid-admin-token',
            (result: { accepted: boolean; reason?: string }) => {
                commandResult = result;
            },
        );

        expect(access).toEqual({ allowed: true });
        expect(harness.handleAdminDebugCommand).toHaveBeenCalledWith(
            'match-1',
            'admin-42',
            'SYS_CHEAT_SET_STATE',
            { state: { score: 10 } },
        );
        expect(commandResult).toEqual({ accepted: true });
        expect(harness.handleCommand).not.toHaveBeenCalled();
    });

    it('拒绝无效 token 的管理员调试命令且不改状态', async () => {
        const harness = createRouterHarness({
            socketInfo: { matchID: 'match-1', playerID: null },
            match: { matchID: 'match-1', state: { core: {}, sys: {} } },
            adminUserId: 'admin-42',
        });
        let commandResult: { accepted: boolean; reason?: string } | undefined;

        await harness.invoke(
            'admin-debug:command',
            'match-1',
            'SYS_CHEAT_SET_STATE',
            { state: { score: 10 } },
            'forged-token',
            (result: { accepted: boolean; reason?: string }) => {
                commandResult = result;
            },
        );

        expect(harness.handleAdminDebugCommand).not.toHaveBeenCalled();
        expect(commandResult).toEqual({ accepted: false, reason: 'unauthorized' });
    });

    it('普通座位命令仍按现有路径执行', async () => {
        const harness = createRouterHarness({
            socketInfo: { matchID: 'match-1', playerID: '0', credentials: 'seat-token' },
            match: { matchID: 'match-1', state: { core: {}, sys: {} } },
        });

        await harness.invoke('command', 'match-1', 'PLAYER_MOVE', { x: 1 }, 'seat-token');

        expect(harness.handleCommand).toHaveBeenCalledWith('match-1', '0', 'PLAYER_MOVE', { x: 1 });
    });
});
