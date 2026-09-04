import { describe, expect, it } from 'vitest';
import { createResponseWindowSystem, RESPONSE_WINDOW_EVENTS } from '../../systems/ResponseWindowSystem';

describe('ResponseWindowSystem（重复打开去重）', () => {
    const createResponseWindowState = (overrides?: {
        current?: {
            id: string;
            windowType: string;
            sourceId?: string;
            responderQueue: string[];
            currentResponderIndex?: number;
            passedPlayers?: string[];
        };
    }) => ({
        core: {},
        sys: {
            phase: 'main2',
            interaction: {
                current: undefined,
                queue: [],
                isBlocked: false,
            },
            responseWindow: {
                current: overrides?.current
                    ? {
                        ...overrides.current,
                        currentResponderIndex: overrides.current.currentResponderIndex ?? 0,
                        passedPlayers: overrides.current.passedPlayers ?? [],
                    }
                    : undefined,
            },
        },
        _stateID: 0,
        randomSeed: 'seed',
        randomCursor: 0,
    });

    it('当前窗口已存在时，语义等价的 OPENED 事件不应重置响应者进度', () => {
        const system = createResponseWindowSystem();
        const state = createResponseWindowState({
            current: {
                id: 'rw-current',
                windowType: 'afterRollConfirmed',
                responderQueue: ['0', '1'],
                currentResponderIndex: 1,
                passedPlayers: ['0'],
            },
        });

        const result = system.afterEvents?.({
            state: state as any,
            events: [{
                type: RESPONSE_WINDOW_EVENTS.OPENED,
                payload: {
                    windowId: 'rw-duplicate',
                    responderQueue: ['0', '1'],
                    windowType: 'afterRollConfirmed',
                },
                timestamp: 1,
            }],
        });

        expect(result).toBeUndefined();
        expect(state.sys.responseWindow.current).toMatchObject({
            id: 'rw-current',
            currentResponderIndex: 1,
            passedPlayers: ['0'],
        });
    });

    it('同一批事件中 CLOSED 后紧接语义等价 OPENED 时，不应立即 reopen', () => {
        const system = createResponseWindowSystem();
        const state = createResponseWindowState({
            current: {
                id: 'rw-before-close',
                windowType: 'afterRollConfirmed',
                responderQueue: ['0'],
            },
        });

        const result = system.afterEvents?.({
            state: state as any,
            events: [
                {
                    type: RESPONSE_WINDOW_EVENTS.CLOSED,
                    payload: {
                        windowId: 'rw-before-close',
                        allPassed: true,
                    },
                    timestamp: 1,
                },
                {
                    type: RESPONSE_WINDOW_EVENTS.OPENED,
                    payload: {
                        windowId: 'rw-reopen-duplicate',
                        responderQueue: ['0'],
                        windowType: 'afterRollConfirmed',
                    },
                    timestamp: 2,
                },
            ],
        });

        expect(result).toBeTruthy();
        expect((result as { state: typeof state }).state.sys.responseWindow.current).toBeUndefined();
    });

    it('同一批事件中 CLOSED 后若出现非响应窗口业务事件，再收到 OPENED 应允许重新打开', () => {
        const system = createResponseWindowSystem();
        const state = createResponseWindowState({
            current: {
                id: 'rw-before-close',
                windowType: 'afterRollConfirmed',
                responderQueue: ['0'],
            },
        });

        const result = system.afterEvents?.({
            state: state as any,
            events: [
                {
                    type: RESPONSE_WINDOW_EVENTS.CLOSED,
                    payload: {
                        windowId: 'rw-before-close',
                        allPassed: true,
                    },
                    timestamp: 1,
                },
                {
                    type: 'ROLL_CONFIRMED',
                    payload: { playerId: '1' },
                    timestamp: 2,
                },
                {
                    type: RESPONSE_WINDOW_EVENTS.OPENED,
                    payload: {
                        windowId: 'rw-reopen-legit',
                        responderQueue: ['0'],
                        windowType: 'afterRollConfirmed',
                    },
                    timestamp: 3,
                },
            ],
        });

        expect(result).toBeTruthy();
        expect((result as { state: typeof state }).state.sys.responseWindow.current).toMatchObject({
            id: 'rw-reopen-legit',
            windowType: 'afterRollConfirmed',
            responderQueue: ['0'],
        });
    });

    it('冷却期内即使出现业务事件，语义等价窗口也不应重复 reopen', () => {
        const system = createResponseWindowSystem({ reopenDedupeCooldownMs: 5 });
        const state = createResponseWindowState({
            current: {
                id: 'rw-before-close',
                windowType: 'afterRollConfirmed',
                responderQueue: ['0'],
            },
        });

        const result = system.afterEvents?.({
            state: state as any,
            events: [
                {
                    type: RESPONSE_WINDOW_EVENTS.CLOSED,
                    payload: {
                        windowId: 'rw-before-close',
                        allPassed: true,
                    },
                    timestamp: 10,
                },
                {
                    type: 'ROLL_CONFIRMED',
                    payload: { playerId: '1' },
                    timestamp: 11,
                },
                {
                    type: RESPONSE_WINDOW_EVENTS.OPENED,
                    payload: {
                        windowId: 'rw-reopen-cooled',
                        responderQueue: ['0'],
                        windowType: 'afterRollConfirmed',
                    },
                    timestamp: 12,
                },
            ],
        });

        expect(result).toBeTruthy();
        expect((result as { state: typeof state }).state.sys.responseWindow.current).toBeUndefined();
    });

    it('冷却期结束后应允许语义等价窗口重新打开', () => {
        const system = createResponseWindowSystem({ reopenDedupeCooldownMs: 5 });
        const state = createResponseWindowState({
            current: {
                id: 'rw-before-close',
                windowType: 'afterRollConfirmed',
                responderQueue: ['0'],
            },
        });

        const result = system.afterEvents?.({
            state: state as any,
            events: [
                {
                    type: RESPONSE_WINDOW_EVENTS.CLOSED,
                    payload: {
                        windowId: 'rw-before-close',
                        allPassed: true,
                    },
                    timestamp: 10,
                },
                {
                    type: 'ROLL_CONFIRMED',
                    payload: { playerId: '1' },
                    timestamp: 11,
                },
                {
                    type: RESPONSE_WINDOW_EVENTS.OPENED,
                    payload: {
                        windowId: 'rw-reopen-after-cooldown',
                        responderQueue: ['0'],
                        windowType: 'afterRollConfirmed',
                    },
                    timestamp: 20,
                },
            ],
        });

        expect(result).toBeTruthy();
        expect((result as { state: typeof state }).state.sys.responseWindow.current).toMatchObject({
            id: 'rw-reopen-after-cooldown',
            windowType: 'afterRollConfirmed',
            responderQueue: ['0'],
        });
    });
});
