import React from 'react';
import { act, render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetAppVisibilityForTests, dispatchAppVisibilityChange } from '../../../lib/mobile/appVisibility';

type MockClientInstance = {
    config: any;
    latestState: unknown;
    updateLatestState: ReturnType<typeof vi.fn>;
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    resync: ReturnType<typeof vi.fn>;
    sendCommand: ReturnType<typeof vi.fn>;
    sendBatch: ReturnType<typeof vi.fn>;
    emitStateUpdate: (state: unknown, players?: unknown[], meta?: unknown, randomMeta?: unknown) => void;
    emitConnectionChange: (connected: boolean) => void;
};

const { refreshInteractionOptionsMock, mockClientInstances } = vi.hoisted(() => ({
    refreshInteractionOptionsMock: vi.fn((state: unknown) => ({
        ...(state as Record<string, unknown>),
        __refreshedByUi: true,
    })),
    mockClientInstances: [] as MockClientInstance[],
}));

vi.mock('../client', () => {
    class MockGameTransportClient {
        config: any;
        latestState: unknown;
        updateLatestState = vi.fn((state: unknown) => {
            this.latestState = state;
        });
        connect = vi.fn();
        disconnect = vi.fn();
        resync = vi.fn();
        sendCommand = vi.fn();
        sendBatch = vi.fn();

        constructor(config: any) {
            this.config = config;
            this.latestState = null;
            mockClientInstances.push(this as unknown as MockClientInstance);
        }

        emitStateUpdate(state: unknown, players: unknown[] = [], meta?: unknown, randomMeta?: unknown): void {
            this.config.onStateUpdate?.(state, players, meta, randomMeta);
        }

        emitConnectionChange(connected: boolean): void {
            this.config.onConnectionChange?.(connected);
        }
    }

    return { GameTransportClient: MockGameTransportClient };
});

vi.mock('../../systems/InteractionSystem', () => ({
    refreshInteractionOptions: refreshInteractionOptionsMock,
}));

import { BoardBridge, GameProvider, useGameClient } from '../react';
import { useEventStreamRollback } from '../../hooks/EventStreamRollbackContext';

function StateProbe(): JSX.Element {
    const { state } = useGameClient();
    return <pre data-testid="state">{JSON.stringify(state)}</pre>;
}

function RollbackProbe(): JSX.Element {
    const rollback = useEventStreamRollback();
    return <pre data-testid="rollback">{JSON.stringify(rollback)}</pre>;
}

function BoardHpProbe(props: { G: { core?: { hp?: number } }; playerID?: string | null }): JSX.Element {
    return (
        <div data-testid="board-probe" data-player-id={props.playerID ?? 'null'}>
            {String(props.G.core?.hp ?? 'no-hp')}
        </div>
    );
}

describe('GameProvider transport baseline', () => {
    beforeEach(() => {
        mockClientInstances.length = 0;
        refreshInteractionOptionsMock.mockClear();
        __resetAppVisibilityForTests();
    });

    afterEach(() => {
        cleanup();
    });

    it('writes back authoritative newState to client patch base instead of refreshed render state', () => {
        render(
            <GameProvider
                server="http://127.0.0.1:3000"
                matchId="match-react-authoritative-baseline"
                playerId="0"
            >
                <StateProbe />
            </GameProvider>,
        );

        expect(mockClientInstances).toHaveLength(1);
        const client = mockClientInstances[0]!;

        const authoritativeState = {
            core: { hp: 10 },
            sys: {
                interaction: {
                    current: undefined,
                    queue: [
                        {
                            id: 'owner-only-queued-a',
                            kind: 'simple-choice',
                            playerId: '0',
                        },
                    ],
                    isBlocked: false,
                },
                eventStream: { entries: [], nextId: 1 },
            },
        };

        act(() => {
            client.emitStateUpdate(authoritativeState, [], { stateID: 1, randomCursor: 0 });
        });

        expect(refreshInteractionOptionsMock).toHaveBeenCalledTimes(1);
        expect(refreshInteractionOptionsMock).toHaveBeenCalledWith(authoritativeState);
        expect(client.updateLatestState).toHaveBeenCalledTimes(1);
        expect(client.updateLatestState).toHaveBeenCalledWith(authoritativeState);
        expect(client.latestState).toBe(authoritativeState);
        expect(screen.getByTestId('state').textContent).toContain('__refreshedByUi');
        expect(screen.getByTestId('state').textContent).toContain('owner-only-queued-a');
        expect(client.latestState).not.toEqual(expect.objectContaining({
            __refreshedByUi: true,
        }));
    });

    it('new authoritative state should clear the previous owner-only overlay instead of keeping stale interaction state', () => {
        render(
            <GameProvider
                server="http://127.0.0.1:3000"
                matchId="match-react-owner-only-overlay-reset"
                playerId="0"
            >
                <StateProbe />
            </GameProvider>,
        );

        expect(mockClientInstances).toHaveLength(1);
        const client = mockClientInstances[0]!;

        const staleOverlayState = {
            core: { hp: 10 },
            sys: {
                interaction: {
                    current: {
                        id: 'owner-only-prompt',
                        kind: 'simple-choice',
                        playerId: '0',
                        data: {
                            sourceId: 'owner-only-overlay',
                            title: '仅对房主可见',
                            options: [
                                { id: 'skip', label: '跳过' },
                            ],
                        },
                    },
                    queue: [],
                    isBlocked: true,
                },
                eventStream: { entries: [], nextId: 1 },
            },
        };
        const freshAuthoritativeState = {
            core: { hp: 11 },
            sys: {
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                eventStream: { entries: [], nextId: 2 },
            },
        };

        act(() => {
            client.emitStateUpdate(staleOverlayState, [], { stateID: 1, randomCursor: 0 });
        });

        expect(screen.getByTestId('state').textContent).toContain('owner-only-prompt');
        expect(screen.getByTestId('state').textContent).toContain('owner-only-overlay');

        act(() => {
            client.emitStateUpdate(freshAuthoritativeState, [], { stateID: 2, randomCursor: 0 });
        });

        expect(refreshInteractionOptionsMock).toHaveBeenCalledTimes(2);
        expect(refreshInteractionOptionsMock).toHaveBeenLastCalledWith(freshAuthoritativeState);
        expect(client.updateLatestState).toHaveBeenCalledTimes(2);
        expect(client.updateLatestState).toHaveBeenLastCalledWith(freshAuthoritativeState);
        expect(screen.getByTestId('state').textContent).toContain('"hp":11');
        expect(screen.getByTestId('state').textContent).not.toContain('owner-only-prompt');
        expect(screen.getByTestId('state').textContent).not.toContain('owner-only-overlay');
    });

    it('same-stateID authoritative resync should still clear the previous owner-only overlay', () => {
        render(
            <GameProvider
                server="http://127.0.0.1:3000"
                matchId="match-react-owner-only-overlay-reset-same-stateid"
                playerId="0"
            >
                <StateProbe />
            </GameProvider>,
        );

        expect(mockClientInstances).toHaveLength(1);
        const client = mockClientInstances[0]!;

        const staleOverlayState = {
            core: { hp: 10 },
            sys: {
                interaction: {
                    current: {
                        id: 'owner-only-prompt',
                        kind: 'simple-choice',
                        playerId: '0',
                        data: {
                            sourceId: 'owner-only-overlay',
                            title: '仅对房主可见',
                            options: [
                                { id: 'skip', label: '跳过' },
                            ],
                        },
                    },
                    queue: [],
                    isBlocked: true,
                },
                eventStream: { entries: [], nextId: 1 },
            },
        };
        const sameStateIdResyncedState = {
            core: { hp: 10 },
            sys: {
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                eventStream: { entries: [], nextId: 1 },
            },
        };

        act(() => {
            client.emitStateUpdate(staleOverlayState, [], { stateID: 5, randomCursor: 0 });
        });

        expect(screen.getByTestId('state').textContent).toContain('owner-only-prompt');
        expect(screen.getByTestId('state').textContent).toContain('owner-only-overlay');

        act(() => {
            client.emitStateUpdate(sameStateIdResyncedState, [], { stateID: 5, randomCursor: 0 });
        });

        expect(refreshInteractionOptionsMock).toHaveBeenCalledTimes(2);
        expect(refreshInteractionOptionsMock).toHaveBeenLastCalledWith(sameStateIdResyncedState);
        expect(client.updateLatestState).toHaveBeenCalledTimes(2);
        expect(client.updateLatestState).toHaveBeenLastCalledWith(sameStateIdResyncedState);
        expect(screen.getByTestId('state').textContent).not.toContain('owner-only-prompt');
        expect(screen.getByTestId('state').textContent).not.toContain('owner-only-overlay');
    });

    it('ignores stale authoritative updates whose stateID is older than the latest confirmed state', () => {
        render(
            <GameProvider
                server="http://127.0.0.1:3000"
                matchId="match-react-stale-state-gate"
                playerId="0"
            >
                <StateProbe />
            </GameProvider>,
        );

        expect(mockClientInstances).toHaveLength(1);
        const client = mockClientInstances[0]!;

        const freshState = {
            core: { hp: 20, turn: 2 },
            sys: {
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                eventStream: { entries: [], nextId: 2 },
            },
        };
        const staleState = {
            core: { hp: 5, turn: 1 },
            sys: {
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                eventStream: { entries: [], nextId: 1 },
            },
        };

        act(() => {
            client.emitStateUpdate(freshState, [], { stateID: 2, randomCursor: 0 });
        });

        expect(refreshInteractionOptionsMock).toHaveBeenCalledTimes(1);
        expect(refreshInteractionOptionsMock).toHaveBeenLastCalledWith(freshState);
        expect(client.updateLatestState).toHaveBeenCalledTimes(1);
        expect(client.updateLatestState).toHaveBeenLastCalledWith(freshState);
        expect(screen.getByTestId('state').textContent).toContain('"hp":20');

        act(() => {
            client.emitStateUpdate(staleState, [], { stateID: 1, randomCursor: 0 });
        });

        expect(refreshInteractionOptionsMock).toHaveBeenCalledTimes(1);
        expect(client.updateLatestState).toHaveBeenCalledTimes(1);
        expect(client.latestState).toBe(freshState);
        expect(screen.getByTestId('state').textContent).toContain('"hp":20');
        expect(screen.getByTestId('state').textContent).not.toContain('"hp":5');
    });

    it('resets stale-state tracking on disconnect so a lower post-reconnect stateID is accepted', () => {
        render(
            <GameProvider
                server="http://127.0.0.1:3000"
                matchId="match-react-reconnect-stateid-reset"
                playerId="0"
            >
                <StateProbe />
            </GameProvider>,
        );

        expect(mockClientInstances).toHaveLength(1);
        const client = mockClientInstances[0]!;

        const preDisconnectState = {
            core: { hp: 20, turn: 2 },
            sys: {
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                eventStream: { entries: [], nextId: 2 },
            },
        };
        const postReconnectState = {
            core: { hp: 7, turn: 1 },
            sys: {
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                eventStream: { entries: [], nextId: 1 },
            },
        };

        act(() => {
            client.emitStateUpdate(preDisconnectState, [], { stateID: 5, randomCursor: 0 });
        });

        expect(refreshInteractionOptionsMock).toHaveBeenCalledTimes(1);
        expect(client.updateLatestState).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('state').textContent).toContain('"hp":20');

        act(() => {
            client.emitConnectionChange(false);
        });

        act(() => {
            client.emitConnectionChange(true);
        });

        act(() => {
            client.emitStateUpdate(postReconnectState, [], { stateID: 1, randomCursor: 0 });
        });

        expect(refreshInteractionOptionsMock).toHaveBeenCalledTimes(2);
        expect(refreshInteractionOptionsMock).toHaveBeenLastCalledWith(postReconnectState);
        expect(client.updateLatestState).toHaveBeenCalledTimes(2);
        expect(client.updateLatestState).toHaveBeenLastCalledWith(postReconnectState);
        expect(client.latestState).toBe(postReconnectState);
        expect(screen.getByTestId('state').textContent).toContain('"hp":7');
        expect(screen.getByTestId('state').textContent).not.toContain('"hp":20');
    });

    it('emits a rollback-seq reset signal on reconnect so event cursors can realign to the latest state', () => {
        render(
            <GameProvider
                server="http://127.0.0.1:3000"
                matchId="match-react-reconnect-rollback-signal"
                playerId="0"
            >
                <RollbackProbe />
            </GameProvider>,
        );

        expect(mockClientInstances).toHaveLength(1);
        const client = mockClientInstances[0]!;

        expect(screen.getByTestId('rollback').textContent).toBe('{"watermark":null,"seq":0,"reconcileSeq":0}');

        act(() => {
            client.emitConnectionChange(false);
        });

        expect(screen.getByTestId('rollback').textContent).toBe('{"watermark":null,"seq":0,"reconcileSeq":0}');

        act(() => {
            client.emitConnectionChange(true);
        });

        expect(screen.getByTestId('rollback').textContent).toBe('{"watermark":null,"seq":1,"reconcileSeq":0}');
    });

    it('app-visible 触发 resync 时，在新权威状态回来前不应把 BoardBridge 打回 loading fallback', () => {
        render(
            <GameProvider
                server="http://127.0.0.1:3000"
                matchId="match-react-app-visible-keep-board"
                playerId="0"
            >
                <BoardBridge
                    board={BoardHpProbe}
                    loading={<div data-testid="board-loading">loading</div>}
                />
            </GameProvider>,
        );

        expect(mockClientInstances).toHaveLength(1);
        const client = mockClientInstances[0]!;

        const authoritativeState = {
            core: { hp: 12 },
            sys: {
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                eventStream: { entries: [], nextId: 3 },
            },
        };

        act(() => {
            client.emitStateUpdate(authoritativeState, [{ id: 0, name: 'Alice', isConnected: true }], { stateID: 3, randomCursor: 0 });
        });

        expect(screen.getByTestId('board-probe')).toHaveTextContent('12');
        expect(screen.queryByTestId('board-loading')).toBeNull();

        act(() => {
            dispatchAppVisibilityChange(false);
            dispatchAppVisibilityChange(true);
        });

        expect(client.resync).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('board-probe')).toHaveTextContent('12');
        expect(screen.queryByTestId('board-loading')).toBeNull();
    });

    it('断线后 app-visible 触发 manual-resync 时，在重连完成前也不应把 BoardBridge 打回 loading fallback', () => {
        render(
            <GameProvider
                server="http://127.0.0.1:3000"
                matchId="match-react-app-visible-keep-board-while-disconnected"
                playerId="0"
            >
                <BoardBridge
                    board={BoardHpProbe}
                    loading={<div data-testid="board-loading">loading</div>}
                />
            </GameProvider>,
        );

        expect(mockClientInstances).toHaveLength(1);
        const client = mockClientInstances[0]!;

        const authoritativeState = {
            core: { hp: 21 },
            sys: {
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                eventStream: { entries: [], nextId: 4 },
            },
        };

        act(() => {
            client.emitStateUpdate(authoritativeState, [{ id: 0, name: 'Alice', isConnected: true }], { stateID: 4, randomCursor: 0 });
        });

        expect(screen.getByTestId('board-probe')).toHaveTextContent('21');
        expect(screen.queryByTestId('board-loading')).toBeNull();

        act(() => {
            client.emitConnectionChange(false);
        });

        act(() => {
            dispatchAppVisibilityChange(false);
            dispatchAppVisibilityChange(true);
        });

        expect(client.resync).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('board-probe')).toHaveTextContent('21');
        expect(screen.queryByTestId('board-loading')).toBeNull();
    });
});
