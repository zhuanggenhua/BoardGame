import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Game, StorageAPI } from 'boardgame.io';
import { registerOfflineInteractionAdjudication } from '../offlineInteractionAdjudicator';

type FakeSocket = {
    id: string;
    on: (event: string, handler: (...args: any[]) => void) => void;
    emit: (event: string, ...args: any[]) => void;
};

type ConnectionHandler = (socket: FakeSocket) => void;

const createSocket = (id: string): FakeSocket => {
    const handlers: Record<string, (...args: any[]) => void> = {};
    return {
        id,
        on: (event, handler) => {
            handlers[event] = handler;
        },
        emit: (event, ...args) => {
            handlers[event]?.(...args);
        },
    };
};

const setup = () => {
    const connectionHandlers: ConnectionHandler[] = [];
    const io = {
        of: (_name: string) => ({
            on: (event: string, handler: ConnectionHandler) => {
                if (event === 'connection') {
                    connectionHandlers.push(handler);
                }
            },
        }),
    };
    const db = { fetch: vi.fn() } as unknown as StorageAPI.Sync;

    registerOfflineInteractionAdjudication({
        app: { _io: io },
        db,
        auth: {},
        transport: {},
        games: [{ name: 'dicethrone' } as Game],
        graceMs: 3000,
    });

    const connect = (socket: FakeSocket) => {
        const handler = connectionHandlers[0];
        if (!handler) {
            throw new Error('未注册 connection 处理器');
        }
        handler(socket);
    };

    return { connect };
};

describe('offlineInteractionAdjudicator multi-connection', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('多连接仅最后断开触发裁决计时', () => {
        const { connect } = setup();
        const baseCount = vi.getTimerCount();

        const socketA = createSocket('socket-a');
        const socketB = createSocket('socket-b');
        connect(socketA);
        connect(socketB);

        socketA.emit('sync', 'match-1', '0', 'cred');
        socketB.emit('sync', 'match-1', '0', 'cred');
        expect(vi.getTimerCount()).toBe(baseCount);

        socketA.emit('disconnect');
        expect(vi.getTimerCount()).toBe(baseCount);

        socketB.emit('disconnect');
        expect(vi.getTimerCount()).toBe(baseCount + 1);
    });

    it('重连会清除待裁决计时', () => {
        const { connect } = setup();
        const baseCount = vi.getTimerCount();

        const socketA = createSocket('socket-a');
        connect(socketA);
        socketA.emit('sync', 'match-1', '0', 'cred');
        socketA.emit('disconnect');
        expect(vi.getTimerCount()).toBe(baseCount + 1);

        const socketB = createSocket('socket-b');
        connect(socketB);
        socketB.emit('sync', 'match-1', '0', 'cred');
        expect(vi.getTimerCount()).toBe(baseCount);
    });
});
