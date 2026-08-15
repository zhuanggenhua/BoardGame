import React from 'react';
import { act, render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
const { appVisibleListeners } = vi.hoisted(() => ({
    appVisibleListeners: [] as Array<() => void>,
}));
const { optimisticEngineControls } = vi.hoisted(() => ({
    optimisticEngineControls: {
        engine: null as any,
    },
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

vi.mock('../latency/optimisticEngine', () => ({
    createOptimisticEngine: vi.fn(() => optimisticEngineControls.engine),
    filterPlayedEvents: vi.fn((state: unknown) => state),
}));

vi.mock('../../systems/InteractionSystem', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../systems/InteractionSystem')>();
    return {
        ...actual,
        refreshInteractionOptions: refreshInteractionOptionsMock,
    };
});

vi.mock('../../../lib/mobile/appVisibility', () => ({
    onAppVisible: (callback: () => void) => {
        appVisibleListeners.push(callback);
        return () => {
            const index = appVisibleListeners.indexOf(callback);
            if (index >= 0) {
                appVisibleListeners.splice(index, 1);
            }
        };
    },
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { defaultValue?: string }) => {
            if (key === 'ui.waiting_for_player') return '正在等待 {{player}}';
            return options?.defaultValue ?? key;
        },
        i18n: { exists: () => false },
    }),
    initReactI18next: {
        type: '3rdParty',
        init: vi.fn(),
    },
}));

import { GameProvider, useGameClient } from '../react';
import { useEventStreamRollback } from '../../hooks/EventStreamRollbackContext';

function StateProbe(): JSX.Element {
    const { state } = useGameClient();
    return <pre data-testid="state">{JSON.stringify(state)}</pre>;
}

function RollbackProbe(): JSX.Element {
    const rollback = useEventStreamRollback();
    return <pre data-testid="rollback">{JSON.stringify(rollback)}</pre>;
}

function WaitingPromptProbe({ playerID }: { playerID: string }): JSX.Element {
    const { state } = useGameClient();
    const interaction = (state as any)?.sys?.interaction?.current;

    if (interaction && interaction.playerId !== playerID) {
        return <div>{'正在等待 {{player}}'}</div>;
    }

    return <div data-testid="no-waiting-prompt" />;
}

describe('GameProvider transport baseline', () => {
    beforeEach(() => {
        mockClientInstances.length = 0;
        refreshInteractionOptionsMock.mockClear();
        appVisibleListeners.length = 0;
        optimisticEngineControls.engine = null;
    });

    afterEach(() => {
        cleanup();
    });

    const runtimeNormalizedEngineConfig = {
        gameId: 'runtime-normalization-test',
        domain: {
            normalizeRuntimeState: (state: any) => ({
                ...state,
                core: {
                    ...state.core,
                    dirtyList: state.core.dirtyList ?? [],
                    transientFlag: undefined,
                    legacyItems: Array.isArray(state.core.legacyItems)
                        ? state.core.legacyItems.map((item: { id?: unknown }) => item.id)
                        : state.core.legacyItems,
                },
            }),
        },
    } as any;

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

    it('normalizes authoritative runtime-guard dirty state before patch baseline and render state', () => {
        render(
            <GameProvider
                server="http://127.0.0.1:3000"
                matchId="match-react-runtime-guard-normalize"
                playerId="0"
                engineConfig={runtimeNormalizedEngineConfig}
            >
                <StateProbe />
            </GameProvider>,
        );

        expect(mockClientInstances).toHaveLength(1);
        const client = mockClientInstances[0]!;

        const dirtyState = {
            core: {
                dirtyList: null,
                transientFlag: null,
                legacyItems: [
                    { id: 'legacy-a' },
                    { id: 'legacy-b' },
                ],
            },
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
            client.emitStateUpdate(dirtyState, [], { stateID: 1, randomCursor: 0 });
        });

        expect(refreshInteractionOptionsMock).toHaveBeenCalledTimes(1);
        expect(refreshInteractionOptionsMock).toHaveBeenLastCalledWith({
            ...dirtyState,
            core: expect.objectContaining({
                dirtyList: [],
                transientFlag: undefined,
                legacyItems: ['legacy-a', 'legacy-b'],
            }),
        });
        expect(client.updateLatestState).toHaveBeenCalledTimes(1);
        expect(client.updateLatestState).toHaveBeenLastCalledWith({
            ...dirtyState,
            core: expect.objectContaining({
                dirtyList: [],
                transientFlag: undefined,
                legacyItems: ['legacy-a', 'legacy-b'],
            }),
        });
        expect(screen.getByTestId('state').textContent).toContain('"dirtyList":[]');
        expect(screen.getByTestId('state').textContent).not.toContain('"transientFlag":null');
        expect(screen.getByTestId('state').textContent).toContain('"legacyItems":["legacy-a","legacy-b"]');
    });

    it('clears stale owner-only current prompt from rendered state when authoritative update closes it', () => {
        render(
            <GameProvider
                server="http://127.0.0.1:3000"
                matchId="match-react-clear-owner-only-current"
                playerId="0"
            >
                <StateProbe />
            </GameProvider>,
        );

        expect(mockClientInstances).toHaveLength(1);
        const client = mockClientInstances[0]!;

        const ownerOnlyPromptState = {
            core: { hp: 10 },
            sys: {
                interaction: {
                    current: {
                        id: 'owner-only-current-a',
                        kind: 'simple-choice',
                        playerId: '0',
                    },
                    queue: [],
                    isBlocked: false,
                },
                eventStream: { entries: [], nextId: 1 },
            },
        };

        act(() => {
            client.emitStateUpdate(ownerOnlyPromptState, [], { stateID: 1, randomCursor: 0 });
        });

        expect(refreshInteractionOptionsMock).toHaveBeenCalledTimes(1);
        expect(refreshInteractionOptionsMock).toHaveBeenLastCalledWith(ownerOnlyPromptState);
        expect(client.updateLatestState).toHaveBeenCalledTimes(1);
        expect(client.updateLatestState).toHaveBeenLastCalledWith(ownerOnlyPromptState);
        expect(screen.getByTestId('state').textContent).toContain('owner-only-current-a');

        const closedPromptState = {
            core: { hp: 9 },
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
            client.emitStateUpdate(closedPromptState, [], { stateID: 2, randomCursor: 0 });
        });

        expect(refreshInteractionOptionsMock).toHaveBeenCalledTimes(2);
        expect(refreshInteractionOptionsMock).toHaveBeenLastCalledWith(closedPromptState);
        expect(client.updateLatestState).toHaveBeenCalledTimes(2);
        expect(client.updateLatestState).toHaveBeenLastCalledWith(closedPromptState);
        expect(client.latestState).toBe(closedPromptState);
        expect(screen.getByTestId('state').textContent).toContain('"hp":9');
        expect(screen.getByTestId('state').textContent).not.toContain('owner-only-current-a');
    });

    it('renders a newly opened owner-only current prompt when authoritative update adds it', () => {
        render(
            <GameProvider
                server="http://127.0.0.1:3000"
                matchId="match-react-open-owner-only-current"
                playerId="0"
            >
                <StateProbe />
            </GameProvider>,
        );

        expect(mockClientInstances).toHaveLength(1);
        const client = mockClientInstances[0]!;

        const baselineState = {
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
            client.emitStateUpdate(baselineState, [], { stateID: 1, randomCursor: 0 });
        });

        expect(refreshInteractionOptionsMock).toHaveBeenCalledTimes(1);
        expect(refreshInteractionOptionsMock).toHaveBeenLastCalledWith(baselineState);
        expect(client.updateLatestState).toHaveBeenCalledTimes(1);
        expect(client.updateLatestState).toHaveBeenLastCalledWith(baselineState);
        expect(screen.getByTestId('state').textContent).not.toContain('owner-only-current-open-a');

        const ownerOnlyPromptState = {
            core: { hp: 11 },
            sys: {
                interaction: {
                    current: {
                        id: 'owner-only-current-open-a',
                        kind: 'simple-choice',
                        playerId: '0',
                        data: {
                            title: '是否获得诅咒金币？',
                            sourceId: 'verdict-command',
                            options: [
                                { id: 'yes', label: '是', value: { gainCursedCoin: true } },
                                { id: 'no', label: '否', value: { gainCursedCoin: false } },
                            ],
                        },
                    },
                    queue: [],
                    isBlocked: false,
                },
                eventStream: { entries: [], nextId: 2 },
            },
        };

        act(() => {
            client.emitStateUpdate(ownerOnlyPromptState, [], { stateID: 2, randomCursor: 0 });
        });

        expect(refreshInteractionOptionsMock).toHaveBeenCalledTimes(2);
        expect(refreshInteractionOptionsMock).toHaveBeenLastCalledWith(ownerOnlyPromptState);
        expect(client.updateLatestState).toHaveBeenCalledTimes(2);
        expect(client.updateLatestState).toHaveBeenLastCalledWith(ownerOnlyPromptState);
        expect(client.latestState).toBe(ownerOnlyPromptState);
        expect(screen.getByTestId('state').textContent).toContain('"hp":11');
        expect(screen.getByTestId('state').textContent).toContain('owner-only-current-open-a');
        expect(screen.getByTestId('state').textContent).toContain('是否获得诅咒金币？');
    });

    it('clears stale hidden-interaction isBlocked from rendered state when authoritative update unblocks it', () => {
        render(
            <GameProvider
                server="http://127.0.0.1:3000"
                matchId="match-react-clear-hidden-isblocked"
                playerId="0"
            >
                <StateProbe />
            </GameProvider>,
        );

        expect(mockClientInstances).toHaveLength(1);
        const client = mockClientInstances[0]!;

        const blockedState = {
            core: { hp: 10 },
            sys: {
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: true,
                },
                eventStream: { entries: [], nextId: 1 },
            },
        };

        act(() => {
            client.emitStateUpdate(blockedState, [], { stateID: 1, randomCursor: 0 });
        });

        expect(refreshInteractionOptionsMock).toHaveBeenCalledTimes(1);
        expect(refreshInteractionOptionsMock).toHaveBeenLastCalledWith(blockedState);
        expect(client.updateLatestState).toHaveBeenCalledTimes(1);
        expect(client.updateLatestState).toHaveBeenLastCalledWith(blockedState);
        expect(screen.getByTestId('state').textContent).toContain('"isBlocked":true');

        const unblockedState = {
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
            client.emitStateUpdate(unblockedState, [], { stateID: 2, randomCursor: 0 });
        });

        expect(refreshInteractionOptionsMock).toHaveBeenCalledTimes(2);
        expect(refreshInteractionOptionsMock).toHaveBeenLastCalledWith(unblockedState);
        expect(client.updateLatestState).toHaveBeenCalledTimes(2);
        expect(client.updateLatestState).toHaveBeenLastCalledWith(unblockedState);
        expect(client.latestState).toBe(unblockedState);
        expect(screen.getByTestId('state').textContent).toContain('"hp":11');
        expect(screen.getByTestId('state').textContent).toContain('"isBlocked":false');
        expect(screen.getByTestId('state').textContent).not.toContain('"isBlocked":true');
    });

    it('removes waiting prompt from rendered UI when authoritative close reaches the non owner page', () => {
        render(
            <GameProvider
                server="http://127.0.0.1:3000"
                matchId="match-react-waiting-close"
                playerId="0"
            >
                <WaitingPromptProbe playerID="0" />
            </GameProvider>,
        );

        expect(mockClientInstances).toHaveLength(1);
        const client = mockClientInstances[0]!;

        const visibleWaitingState = {
            core: { marker: 'prompt-open' },
            sys: {
                interaction: {
                    current: {
                        id: 'spy-discard-visible-current',
                        kind: 'simple-choice',
                        playerId: '1',
                        data: {
                            title: '由 Guest 选择',
                            sourceId: 'shared_visible_prompt',
                            targetType: 'button',
                            options: [
                                { id: 'confirm', label: '确认', value: { chosenBy: '1' }, displayMode: 'button' },
                            ],
                        },
                    },
                    queue: [],
                    isBlocked: false,
                },
                eventStream: { entries: [], nextId: 1 },
            },
        };

        act(() => {
            client.emitStateUpdate(visibleWaitingState, [], { stateID: 1, randomCursor: 0 });
        });

        expect(screen.getByText('正在等待 {{player}}')).toBeInTheDocument();

        const authoritativeClosedState = {
            core: { marker: 'prompt-closed' },
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
            client.emitStateUpdate(authoritativeClosedState, [], { stateID: 2, randomCursor: 0 });
        });

        expect(client.updateLatestState).toHaveBeenLastCalledWith(authoritativeClosedState);
        expect(screen.queryByText('正在等待 {{player}}')).not.toBeInTheDocument();
    });

    it('replaces a stale visible current prompt with hidden blocked state when authoritative update hides it', () => {
        render(
            <GameProvider
                server="http://127.0.0.1:3000"
                matchId="match-react-visible-to-hidden-blocked"
                playerId="0"
            >
                <StateProbe />
            </GameProvider>,
        );

        expect(mockClientInstances).toHaveLength(1);
        const client = mockClientInstances[0]!;

        const visiblePromptState = {
            core: { hp: 10 },
            sys: {
                interaction: {
                    current: {
                        id: 'shared-visible-current-a',
                        kind: 'simple-choice',
                        playerId: '1',
                    },
                    queue: [],
                    isBlocked: false,
                },
                eventStream: { entries: [], nextId: 1 },
            },
        };

        act(() => {
            client.emitStateUpdate(visiblePromptState, [], { stateID: 1, randomCursor: 0 });
        });

        expect(refreshInteractionOptionsMock).toHaveBeenCalledTimes(1);
        expect(refreshInteractionOptionsMock).toHaveBeenLastCalledWith(visiblePromptState);
        expect(client.updateLatestState).toHaveBeenCalledTimes(1);
        expect(client.updateLatestState).toHaveBeenLastCalledWith(visiblePromptState);
        expect(screen.getByTestId('state').textContent).toContain('shared-visible-current-a');
        expect(screen.getByTestId('state').textContent).toContain('"isBlocked":false');

        const hiddenBlockedState = {
            core: { hp: 11 },
            sys: {
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: true,
                },
                eventStream: { entries: [], nextId: 2 },
            },
        };

        act(() => {
            client.emitStateUpdate(hiddenBlockedState, [], { stateID: 2, randomCursor: 0 });
        });

        expect(refreshInteractionOptionsMock).toHaveBeenCalledTimes(2);
        expect(refreshInteractionOptionsMock).toHaveBeenLastCalledWith(hiddenBlockedState);
        expect(client.updateLatestState).toHaveBeenCalledTimes(2);
        expect(client.updateLatestState).toHaveBeenLastCalledWith(hiddenBlockedState);
        expect(client.latestState).toBe(hiddenBlockedState);
        expect(screen.getByTestId('state').textContent).toContain('"hp":11');
        expect(screen.getByTestId('state').textContent).toContain('"isBlocked":true');
        expect(screen.getByTestId('state').textContent).not.toContain('shared-visible-current-a');
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

    it('accepts a lower post-reconnect authoritative close and clears stale owner-only current prompt', () => {
        render(
            <GameProvider
                server="http://127.0.0.1:3000"
                matchId="match-react-reconnect-clear-owner-only-current"
                playerId="0"
            >
                <StateProbe />
            </GameProvider>,
        );

        expect(mockClientInstances).toHaveLength(1);
        const client = mockClientInstances[0]!;

        const preDisconnectPromptState = {
            core: { hp: 20, turn: 2 },
            sys: {
                interaction: {
                    current: {
                        id: 'owner-only-current-reconnect-a',
                        kind: 'simple-choice',
                        playerId: '0',
                    },
                    queue: [],
                    isBlocked: false,
                },
                eventStream: { entries: [], nextId: 2 },
            },
        };

        act(() => {
            client.emitStateUpdate(preDisconnectPromptState, [], { stateID: 5, randomCursor: 0 });
        });

        expect(refreshInteractionOptionsMock).toHaveBeenCalledTimes(1);
        expect(client.updateLatestState).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('state').textContent).toContain('owner-only-current-reconnect-a');

        act(() => {
            client.emitConnectionChange(false);
        });

        act(() => {
            client.emitConnectionChange(true);
        });

        const postReconnectClosedState = {
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
            client.emitStateUpdate(postReconnectClosedState, [], { stateID: 1, randomCursor: 0 });
        });

        expect(refreshInteractionOptionsMock).toHaveBeenCalledTimes(2);
        expect(refreshInteractionOptionsMock).toHaveBeenLastCalledWith(postReconnectClosedState);
        expect(client.updateLatestState).toHaveBeenCalledTimes(2);
        expect(client.updateLatestState).toHaveBeenLastCalledWith(postReconnectClosedState);
        expect(client.latestState).toBe(postReconnectClosedState);
        expect(screen.getByTestId('state').textContent).toContain('"hp":7');
        expect(screen.getByTestId('state').textContent).not.toContain('owner-only-current-reconnect-a');
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

    it('requests resync on app-visible restore so a stale owner-only current prompt can be replaced by authoritative close', () => {
        render(
            <GameProvider
                server="http://127.0.0.1:3000"
                matchId="match-react-app-visible-resync"
                playerId="0"
            >
                <StateProbe />
            </GameProvider>,
        );

        expect(mockClientInstances).toHaveLength(1);
        expect(appVisibleListeners).toHaveLength(1);
        const client = mockClientInstances[0]!;

        const stalePromptState = {
            core: { hp: 10, turn: 2 },
            sys: {
                interaction: {
                    current: {
                        id: 'owner-only-current-app-visible-a',
                        kind: 'simple-choice',
                        playerId: '0',
                    },
                    queue: [],
                    isBlocked: false,
                },
                eventStream: { entries: [], nextId: 1 },
            },
        };

        act(() => {
            client.emitStateUpdate(stalePromptState, [], { stateID: 3, randomCursor: 0 });
        });

        expect(screen.getByTestId('state').textContent).toContain('owner-only-current-app-visible-a');
        expect(client.resync).toHaveBeenCalledTimes(0);

        act(() => {
            appVisibleListeners[0]!();
        });

        expect(client.resync).toHaveBeenCalledTimes(1);

        const authoritativeClosedState = {
            core: { hp: 11, turn: 2 },
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
            client.emitStateUpdate(authoritativeClosedState, [], { stateID: 4, randomCursor: 0 });
        });

        expect(refreshInteractionOptionsMock).toHaveBeenLastCalledWith(authoritativeClosedState);
        expect(client.updateLatestState).toHaveBeenLastCalledWith(authoritativeClosedState);
        expect(screen.getByTestId('state').textContent).toContain('"hp":11');
        expect(screen.getByTestId('state').textContent).not.toContain('owner-only-current-app-visible-a');
    });

    it('clears the non owner waiting prompt when app-visible resync returns an authoritative close with the same stateID', () => {
        render(
            <GameProvider
                server="http://127.0.0.1:3000"
                matchId="match-react-app-visible-waiting-close-same-stateid"
                playerId="0"
            >
                <WaitingPromptProbe playerID="0" />
            </GameProvider>,
        );

        expect(mockClientInstances).toHaveLength(1);
        expect(appVisibleListeners).toHaveLength(1);
        const client = mockClientInstances[0]!;

        const visibleWaitingState = {
            core: { marker: 'waiting-open', turn: 2 },
            sys: {
                interaction: {
                    current: {
                        id: 'spy-discard-app-visible-waiting',
                        kind: 'simple-choice',
                        playerId: '1',
                        data: {
                            title: '由 Guest 选择',
                            sourceId: 'shared_visible_prompt',
                            targetType: 'button',
                            options: [
                                { id: 'confirm', label: '确认', value: { chosenBy: '1' }, displayMode: 'button' },
                            ],
                        },
                    },
                    queue: [],
                    isBlocked: false,
                },
                eventStream: { entries: [], nextId: 1 },
            },
        };

        act(() => {
            client.emitStateUpdate(visibleWaitingState, [], { stateID: 7, randomCursor: 0 });
        });

        expect(screen.getByText('正在等待 {{player}}')).toBeInTheDocument();
        expect(client.resync).toHaveBeenCalledTimes(0);

        act(() => {
            appVisibleListeners[0]!();
        });

        expect(client.resync).toHaveBeenCalledTimes(1);

        const authoritativeClosedState = {
            core: { marker: 'waiting-closed', turn: 2 },
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
            client.emitStateUpdate(authoritativeClosedState, [], { stateID: 7, randomCursor: 0 });
        });

        expect(client.updateLatestState).toHaveBeenLastCalledWith(authoritativeClosedState);
        expect(screen.queryByText('正在等待 {{player}}')).not.toBeInTheDocument();
    });

    it('clears stale owner-only current prompt on optimistic reconcile when authoritative close arrives', () => {
        const mockEngine = {
            hasPendingCommands: vi.fn()
                .mockReturnValueOnce(false)
                .mockReturnValueOnce(true),
            reconcile: vi.fn((state: unknown) => ({
                stateToRender: state,
                didRollback: false,
                optimisticEventWatermark: null,
            })),
            setPlayerIds: vi.fn(),
            syncRandom: vi.fn(),
            reset: vi.fn(),
            processCommand: vi.fn(),
        };
        optimisticEngineControls.engine = mockEngine;

        render(
            <GameProvider
                server="http://127.0.0.1:3000"
                matchId="match-react-optimistic-close-owner-only-current"
                playerId="0"
                engineConfig={{ domain: {} as any, systems: [] as any[] } as any}
                latencyConfig={{ optimistic: { enabled: true } } as any}
            >
                <StateProbe />
                <RollbackProbe />
            </GameProvider>,
        );

        expect(mockClientInstances).toHaveLength(1);
        const client = mockClientInstances[0]!;

        const stalePromptState = {
            core: { hp: 10, turn: 2 },
            sys: {
                interaction: {
                    current: {
                        id: 'owner-only-current-optimistic-a',
                        kind: 'simple-choice',
                        playerId: '0',
                    },
                    queue: [],
                    isBlocked: false,
                },
                eventStream: { entries: [], nextId: 1 },
            },
        };

        act(() => {
            client.emitStateUpdate(stalePromptState, [], { stateID: 3, randomCursor: 0 });
        });

        expect(mockEngine.hasPendingCommands).toHaveBeenCalledTimes(1);
        expect(mockEngine.reconcile).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('state').textContent).toContain('owner-only-current-optimistic-a');
        expect(screen.getByTestId('rollback').textContent).toBe('{"watermark":null,"seq":0,"reconcileSeq":0}');

        const authoritativeClosedState = {
            core: { hp: 11, turn: 2 },
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
            client.emitStateUpdate(authoritativeClosedState, [], { stateID: 4, randomCursor: 0 });
        });

        expect(mockEngine.hasPendingCommands).toHaveBeenCalledTimes(2);
        expect(mockEngine.reconcile).toHaveBeenCalledTimes(2);
        expect(mockEngine.reconcile).toHaveBeenLastCalledWith(authoritativeClosedState, { stateID: 4, randomCursor: 0 });
        expect(client.updateLatestState).toHaveBeenLastCalledWith(authoritativeClosedState);
        expect(screen.getByTestId('state').textContent).toContain('"hp":11');
        expect(screen.getByTestId('state').textContent).not.toContain('owner-only-current-optimistic-a');
        expect(screen.getByTestId('rollback').textContent).toBe('{"watermark":null,"seq":0,"reconcileSeq":1}');
    });
});
