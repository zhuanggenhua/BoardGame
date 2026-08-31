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
    canSendCommand: ReturnType<typeof vi.fn>;
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
        canSendCommand = vi.fn(() => true);
        sendCommand = vi.fn(() => true);
        sendBatch = vi.fn(() => true);

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
import { TRANSPORT_BATCH_COMMAND } from '../../batchDispatchCommand';
import { useEventStreamRollback } from '../../hooks/EventStreamRollbackContext';
import { ToastProvider, useToast } from '../../../contexts/ToastContext';

function StateProbe(): JSX.Element {
    const { state } = useGameClient();
    return <pre data-testid="state">{JSON.stringify(state)}</pre>;
}

function RollbackProbe(): JSX.Element {
    const rollback = useEventStreamRollback();
    return <pre data-testid="rollback">{JSON.stringify(rollback)}</pre>;
}

function ToastProbe(): JSX.Element {
    const { toasts } = useToast();
    return <pre data-testid="toasts">{JSON.stringify(toasts)}</pre>;
}

function WaitingPromptProbe({ playerID }: { playerID: string }): JSX.Element {
    const { state } = useGameClient();
    const interaction = (state as any)?.sys?.interaction?.current;

    if (interaction && interaction.playerId !== playerID) {
        return <div>{'正在等待 {{player}}'}</div>;
    }

    return <div data-testid="no-waiting-prompt" />;
}

function DispatchProbe(): JSX.Element {
    const { dispatch } = useGameClient();

    return (
        <button
            data-testid="dispatch-advance-then-interaction"
            onClick={() => {
                dispatch('ADVANCE_PHASE', {});
                dispatch('SYS_INTERACTION_RESPOND', {
                    interactionId: 'sea-dogs-from-base',
                    optionId: 'base_0',
                });
            }}
        >
            dispatch
        </button>
    );
}

function DoubleAdvanceProbe(): JSX.Element {
    const { dispatch } = useGameClient();

    return (
        <button
            data-testid="dispatch-double-advance"
            onClick={() => {
                dispatch('ADVANCE_PHASE', { step: 1 });
                dispatch('ADVANCE_PHASE', { step: 2 });
            }}
        >
            double advance
        </button>
    );
}

function BurstAdvanceProbe({ count }: { count: number }): JSX.Element {
    const { dispatch } = useGameClient();

    return (
        <button
            data-testid="dispatch-burst-advance"
            onClick={() => {
                for (let step = 1; step <= count; step += 1) {
                    dispatch('ADVANCE_PHASE', { step });
                }
            }}
        >
            burst advance
        </button>
    );
}

function TransportBatchProbe(): JSX.Element {
    const { dispatch } = useGameClient();

    return (
        <button
            data-testid="dispatch-transport-batch"
            onClick={() => {
                dispatch(TRANSPORT_BATCH_COMMAND, {
                    commands: [
                        { type: 'REROLL_DIE', payload: { dieId: 0 } },
                        { type: 'REROLL_DIE', payload: { dieId: 1 } },
                        {
                            type: 'SYS_INTERACTION_CONFIRM',
                            payload: { interactionId: 'multi-reroll' },
                        },
                    ],
                });
            }}
        >
            transport batch
        </button>
    );
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

    it('sends an immediate interaction response separately from a queued phase advance', () => {
        render(
            <GameProvider
                server="http://127.0.0.1:3000"
                matchId="match-react-batching-interaction-separation"
                playerId="0"
                latencyConfig={{
                    batching: {
                        enabled: true,
                        windowMs: 50,
                        maxBatchSize: 5,
                        immediateCommands: ['SYS_INTERACTION_RESPOND', 'SYS_INTERACTION_CANCEL'],
                    },
                } as any}
            >
                <DispatchProbe />
            </GameProvider>,
        );

        expect(mockClientInstances).toHaveLength(1);
        const client = mockClientInstances[0]!;

        act(() => {
            screen.getByTestId('dispatch-advance-then-interaction').click();
        });

        expect(client.sendBatch).not.toHaveBeenCalled();
        expect(client.sendCommand).toHaveBeenCalledTimes(2);
        expect(client.sendCommand).toHaveBeenNthCalledWith(1, 'ADVANCE_PHASE', {});
        expect(client.sendCommand).toHaveBeenNthCalledWith(2, 'SYS_INTERACTION_RESPOND', {
            interactionId: 'sea-dogs-from-base',
            optionId: 'base_0',
        });
    });

    it('allows a second optimistic phase advance to build on the latest predicted state', () => {
        let hasPending = false;
        const predictedState = {
            core: { marker: 'predicted-ai-turn' },
            sys: {
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                eventStream: { entries: [], nextId: 1 },
            },
        };
        const mockEngine = {
            hasPendingCommands: vi.fn(() => hasPending),
            reconcile: vi.fn((state: unknown) => {
                hasPending = false;
                return {
                    stateToRender: state,
                    didRollback: false,
                    optimisticEventWatermark: null,
                };
            }),
            setPlayerIds: vi.fn(),
            syncRandom: vi.fn(),
            reset: vi.fn(() => {
                hasPending = false;
            }),
            processCommand: vi.fn(() => {
                hasPending = true;
                return {
                    stateToRender: predictedState,
                    shouldSend: true,
                    animationMode: 'wait-confirm',
                };
            }),
        };
        optimisticEngineControls.engine = mockEngine;

        render(
            <ToastProvider>
                <GameProvider
                    server="http://127.0.0.1:3000"
                    matchId="match-react-block-double-advance"
                    playerId="0"
                    engineConfig={{ domain: {} as any, systems: [] as any[] } as any}
                    latencyConfig={{ optimistic: { enabled: true } } as any}
                >
                    <StateProbe />
                    <DoubleAdvanceProbe />
                </GameProvider>
                <ToastProbe />
            </ToastProvider>,
        );

        expect(mockClientInstances).toHaveLength(1);
        const client = mockClientInstances[0]!;

        act(() => {
            client.emitStateUpdate({
                core: { marker: 'authoritative-start' },
                sys: {
                    interaction: {
                        current: undefined,
                        queue: [],
                        isBlocked: false,
                    },
                    eventStream: { entries: [], nextId: 1 },
                },
            }, [], { stateID: 1, randomCursor: 0 });
        });

        mockEngine.processCommand.mockClear();
        client.sendCommand.mockClear();

        act(() => {
            screen.getByTestId('dispatch-double-advance').click();
        });

        expect(screen.getByTestId('state').textContent).toContain('predicted-ai-turn');
        expect(client.sendCommand).toHaveBeenCalledTimes(2);
        expect(mockEngine.processCommand).toHaveBeenCalledTimes(2);
        expect(client.sendCommand).toHaveBeenLastCalledWith('ADVANCE_PHASE', { step: 2 });
        expect(screen.getByTestId('toasts').textContent).not.toContain('toast.commandQueuedAfterPreviousStep');

        act(() => {
            client.emitStateUpdate({
                core: { marker: 'authoritative-confirmed' },
                sys: {
                    interaction: {
                        current: undefined,
                        queue: [],
                        isBlocked: false,
                    },
                    eventStream: { entries: [], nextId: 2 },
                },
            }, [], { stateID: 2, randomCursor: 0 });
        });

        expect(client.sendCommand).toHaveBeenCalledTimes(2);
        expect(mockEngine.processCommand).toHaveBeenCalledTimes(2);
        expect(client.sendCommand).toHaveBeenLastCalledWith('ADVANCE_PHASE', { step: 2 });
        expect(screen.getByTestId('state').textContent).toContain('authoritative-confirmed');

        mockEngine.processCommand.mockClear();
        client.sendCommand.mockClear();

        act(() => {
            client.emitStateUpdate({
                core: { marker: 'authoritative-queued-confirmed' },
                sys: {
                    interaction: {
                        current: undefined,
                        queue: [],
                        isBlocked: false,
                    },
                    eventStream: { entries: [], nextId: 3 },
                },
            }, [], { stateID: 3, randomCursor: 0 });
        });

        expect(screen.getByTestId('state').textContent).toContain('authoritative-queued-confirmed');

        act(() => {
            screen.getByTestId('dispatch-double-advance').click();
        });
        expect(client.sendCommand).toHaveBeenCalledTimes(2);
        expect(mockEngine.processCommand).toHaveBeenCalledTimes(2);
        expect(client.sendCommand).toHaveBeenLastCalledWith('ADVANCE_PHASE', { step: 2 });
    });

    it('sends each rapid phase advance that remains valid in the predicted chain', () => {
        let hasPending = false;
        const mockEngine = {
            hasPendingCommands: vi.fn(() => hasPending),
            reconcile: vi.fn((state: unknown) => {
                hasPending = false;
                return {
                    stateToRender: state,
                    didRollback: false,
                    optimisticEventWatermark: null,
                };
            }),
            setPlayerIds: vi.fn(),
            syncRandom: vi.fn(),
            reset: vi.fn(() => {
                hasPending = false;
            }),
            processCommand: vi.fn((_type: string, payload: { step?: number }) => {
                hasPending = true;
                return {
                    stateToRender: {
                        core: { marker: `predicted-step-${payload.step}` },
                        sys: {
                            interaction: {
                                current: undefined,
                                queue: [],
                                isBlocked: false,
                            },
                            eventStream: { entries: [], nextId: payload.step ?? 0 },
                        },
                    },
                    shouldSend: true,
                    animationMode: 'wait-confirm',
                };
            }),
        };
        optimisticEngineControls.engine = mockEngine;

        render(
            <ToastProvider>
                <GameProvider
                    server="http://127.0.0.1:3000"
                    matchId="match-react-stress-repeat-advance"
                    playerId="0"
                    engineConfig={{ domain: {} as any, systems: [] as any[] } as any}
                    latencyConfig={{ optimistic: { enabled: true } } as any}
                >
                    <StateProbe />
                    <BurstAdvanceProbe count={20} />
                </GameProvider>
                <ToastProbe />
            </ToastProvider>,
        );

        expect(mockClientInstances).toHaveLength(1);
        const client = mockClientInstances[0]!;

        act(() => {
            client.emitStateUpdate({
                core: { marker: 'authoritative-start' },
                sys: {
                    interaction: {
                        current: undefined,
                        queue: [],
                        isBlocked: false,
                    },
                    eventStream: { entries: [], nextId: 1 },
                },
            }, [], { stateID: 1, randomCursor: 0 });
        });

        mockEngine.processCommand.mockClear();
        client.sendCommand.mockClear();

        act(() => {
            screen.getByTestId('dispatch-burst-advance').click();
        });

        expect(client.sendCommand).toHaveBeenCalledTimes(20);
        expect(mockEngine.processCommand).toHaveBeenCalledTimes(20);
        expect(client.sendCommand).toHaveBeenLastCalledWith('ADVANCE_PHASE', { step: 20 });
        expect(screen.getByTestId('toasts').textContent).not.toContain('toast.commandQueuedAfterPreviousStep');

        act(() => {
            client.emitStateUpdate({
                core: { marker: 'authoritative-first-confirmed' },
                sys: {
                    interaction: {
                        current: undefined,
                        queue: [],
                        isBlocked: false,
                    },
                    eventStream: { entries: [], nextId: 2 },
                },
            }, [], { stateID: 2, randomCursor: 0 });
        });

        expect(client.sendCommand).toHaveBeenCalledTimes(20);
        expect(mockEngine.processCommand).toHaveBeenCalledTimes(20);
        expect(client.sendCommand).toHaveBeenLastCalledWith('ADVANCE_PHASE', { step: 20 });

        act(() => {
            client.emitStateUpdate({
                core: { marker: 'authoritative-second-confirmed' },
                sys: {
                    interaction: {
                        current: undefined,
                        queue: [],
                        isBlocked: false,
                    },
                    eventStream: { entries: [], nextId: 3 },
                },
            }, [], { stateID: 3, randomCursor: 0 });
        });

        expect(client.sendCommand).toHaveBeenCalledTimes(20);
        expect(mockEngine.processCommand).toHaveBeenCalledTimes(20);
    });

    it('drops a deferred serialized command when connection resets before confirmation', () => {
        const authoritativeState = {
            core: { marker: 'authoritative-start' },
            sys: {
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                eventStream: { entries: [], nextId: 1 },
            },
        };
        const mockEngine = {
            hasPendingCommands: vi.fn(() => false),
            reconcile: vi.fn((state: unknown) => ({
                stateToRender: state,
                didRollback: false,
                optimisticEventWatermark: null,
            })),
            setPlayerIds: vi.fn(),
            syncRandom: vi.fn(),
            reset: vi.fn(),
            processCommand: vi.fn(() => ({
                stateToRender: null,
                shouldSend: true,
                animationMode: 'wait-confirm',
            })),
        };
        optimisticEngineControls.engine = mockEngine;

        render(
            <GameProvider
                server="http://127.0.0.1:3000"
                matchId="match-react-clear-deferred-on-disconnect"
                playerId="0"
                engineConfig={{ domain: {} as any, systems: [] as any[] } as any}
                latencyConfig={{
                    optimistic: { enabled: true },
                    batching: {
                        enabled: true,
                        windowMs: 50,
                        maxBatchSize: 5,
                        immediateCommands: ['ADVANCE_PHASE'],
                    },
                } as any}
            >
                <StateProbe />
                <DoubleAdvanceProbe />
            </GameProvider>,
        );

        expect(mockClientInstances).toHaveLength(1);
        const client = mockClientInstances[0]!;

        act(() => {
            client.emitStateUpdate(authoritativeState, [], { stateID: 1, randomCursor: 0 });
        });

        client.sendCommand.mockClear();
        mockEngine.processCommand.mockClear();

        act(() => {
            screen.getByTestId('dispatch-double-advance').click();
        });

        expect(client.sendCommand).toHaveBeenCalledTimes(1);
        expect(client.sendCommand).toHaveBeenLastCalledWith('ADVANCE_PHASE', { step: 1 });

        client.sendCommand.mockClear();
        mockEngine.processCommand.mockClear();

        act(() => {
            client.emitConnectionChange(false);
        });

        act(() => {
            client.emitStateUpdate({
                core: { marker: 'authoritative-after-disconnect' },
                sys: {
                    interaction: {
                        current: undefined,
                        queue: [],
                        isBlocked: false,
                    },
                    eventStream: { entries: [], nextId: 2 },
                },
            }, [], { stateID: 2, randomCursor: 0 });
        });

        expect(client.sendCommand).not.toHaveBeenCalled();
        expect(mockEngine.processCommand).not.toHaveBeenCalled();
        expect(screen.getByTestId('state').textContent).toContain('authoritative-after-disconnect');
    });

    it('sends an interaction transport batch as one server batch without per-command optimistic gating', () => {
        let hasPending = false;
        const mockEngine = {
            hasPendingCommands: vi.fn(() => hasPending),
            reconcile: vi.fn((state: unknown) => {
                hasPending = false;
                return {
                    stateToRender: state,
                    didRollback: false,
                    optimisticEventWatermark: null,
                };
            }),
            setPlayerIds: vi.fn(),
            syncRandom: vi.fn(),
            reset: vi.fn(() => {
                hasPending = false;
            }),
            processCommand: vi.fn(() => {
                hasPending = true;
                return {
                    stateToRender: {
                        core: { marker: 'predicted-single-command' },
                        sys: {
                            interaction: {
                                current: undefined,
                                queue: [],
                                isBlocked: false,
                            },
                            eventStream: { entries: [], nextId: 1 },
                        },
                    },
                    shouldSend: true,
                    animationMode: 'wait-confirm',
                };
            }),
        };
        optimisticEngineControls.engine = mockEngine;

        render(
            <GameProvider
                server="http://127.0.0.1:3000"
                matchId="match-react-transport-batch"
                playerId="0"
                engineConfig={{ domain: {} as any, systems: [] as any[] } as any}
                latencyConfig={{ optimistic: { enabled: true } } as any}
            >
                <TransportBatchProbe />
            </GameProvider>,
        );

        expect(mockClientInstances).toHaveLength(1);
        const client = mockClientInstances[0]!;

        act(() => {
            client.emitStateUpdate({
                core: { marker: 'authoritative-start' },
                sys: {
                    interaction: {
                        current: undefined,
                        queue: [],
                        isBlocked: false,
                    },
                    eventStream: { entries: [], nextId: 1 },
                },
            }, [], { stateID: 1, randomCursor: 0 });
        });

        client.sendCommand.mockClear();
        client.sendBatch.mockClear();
        mockEngine.hasPendingCommands.mockClear();
        mockEngine.processCommand.mockClear();

        act(() => {
            screen.getByTestId('dispatch-transport-batch').click();
        });

        expect(client.sendCommand).not.toHaveBeenCalled();
        expect(mockEngine.processCommand).not.toHaveBeenCalled();
        expect(mockEngine.hasPendingCommands).toHaveBeenCalledTimes(1);
        expect(client.sendBatch).toHaveBeenCalledTimes(1);
        expect(client.sendBatch).toHaveBeenCalledWith(
            expect.any(String),
            [
                { type: 'REROLL_DIE', payload: { dieId: 0 } },
                { type: 'REROLL_DIE', payload: { dieId: 1 } },
                {
                    type: 'SYS_INTERACTION_CONFIRM',
                    payload: { interactionId: 'multi-reroll' },
                },
            ],
            undefined,
            expect.any(Function),
        );
    });

    it('rolls back optimistic render and resyncs when the predicted command is not sent', () => {
        let hasPending = false;
        const authoritativeState = {
            core: { marker: 'authoritative-second-phase' },
            sys: {
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                eventStream: { entries: [], nextId: 1 },
            },
        };
        const predictedState = {
            core: { marker: 'predicted-main-phase-2' },
            sys: {
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                eventStream: { entries: [], nextId: 1 },
            },
        };
        const mockEngine = {
            hasPendingCommands: vi.fn(() => hasPending),
            reconcile: vi.fn((state: unknown) => {
                hasPending = false;
                return {
                    stateToRender: state,
                    didRollback: false,
                    optimisticEventWatermark: null,
                };
            }),
            setPlayerIds: vi.fn(),
            syncRandom: vi.fn(),
            reset: vi.fn(() => {
                hasPending = false;
            }),
            processCommand: vi.fn(() => {
                hasPending = true;
                return {
                    stateToRender: predictedState,
                    shouldSend: true,
                    animationMode: 'wait-confirm',
                };
            }),
        };
        optimisticEngineControls.engine = mockEngine;

        render(
            <GameProvider
                server="http://127.0.0.1:3000"
                matchId="match-react-rollback-unsent-optimistic"
                playerId="0"
                engineConfig={{ domain: {} as any, systems: [] as any[] } as any}
                latencyConfig={{
                    optimistic: { enabled: true },
                    batching: {
                        enabled: true,
                        windowMs: 50,
                        maxBatchSize: 5,
                        immediateCommands: ['ADVANCE_PHASE'],
                    },
                } as any}
            >
                <StateProbe />
                <DoubleAdvanceProbe />
            </GameProvider>,
        );

        expect(mockClientInstances).toHaveLength(1);
        const client = mockClientInstances[0]!;

        act(() => {
            client.emitStateUpdate(authoritativeState, [], { stateID: 1, randomCursor: 0 });
        });

        mockEngine.reset.mockClear();
        client.resync.mockClear();
        client.sendCommand.mockReturnValue(false);

        act(() => {
            screen.getByTestId('dispatch-double-advance').click();
        });

        expect(client.sendCommand).toHaveBeenCalledTimes(1);
        expect(mockEngine.reset).toHaveBeenCalledTimes(1);
        expect(client.resync).toHaveBeenCalledTimes(1);
        expect(client.resync).toHaveBeenLastCalledWith({ force: true });
        expect(screen.getByTestId('state').textContent).toContain('authoritative-second-phase');
        expect(screen.getByTestId('state').textContent).not.toContain('predicted-main-phase-2');

        client.sendCommand.mockClear();
        client.sendCommand.mockReturnValue(true);

        act(() => {
            client.emitStateUpdate(authoritativeState, [], { stateID: 1, randomCursor: 0 });
        });

        act(() => {
            screen.getByTestId('dispatch-double-advance').click();
        });

        expect(client.sendCommand).toHaveBeenCalledTimes(2);
    });

    it('blocks repeated serialized commands even when the first command is not optimistically predicted', () => {
        const authoritativeState = {
            core: { marker: 'authoritative-second-phase' },
            sys: {
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                eventStream: { entries: [], nextId: 1 },
            },
        };
        const mockEngine = {
            hasPendingCommands: vi.fn(() => false),
            reconcile: vi.fn((state: unknown) => ({
                stateToRender: state,
                didRollback: false,
                optimisticEventWatermark: null,
            })),
            setPlayerIds: vi.fn(),
            syncRandom: vi.fn(),
            reset: vi.fn(),
            processCommand: vi.fn(() => ({
                stateToRender: null,
                shouldSend: true,
                animationMode: 'wait-confirm',
            })),
        };
        optimisticEngineControls.engine = mockEngine;

        render(
            <ToastProvider>
                <GameProvider
                    server="http://127.0.0.1:3000"
                    matchId="match-react-block-unpredicted-double-advance"
                    playerId="0"
                    engineConfig={{ domain: {} as any, systems: [] as any[] } as any}
                    latencyConfig={{
                        optimistic: { enabled: true },
                        batching: {
                            enabled: true,
                            windowMs: 50,
                            maxBatchSize: 5,
                            immediateCommands: ['ADVANCE_PHASE'],
                        },
                    } as any}
                >
                    <StateProbe />
                    <DoubleAdvanceProbe />
                </GameProvider>
                <ToastProbe />
            </ToastProvider>,
        );

        expect(mockClientInstances).toHaveLength(1);
        const client = mockClientInstances[0]!;

        act(() => {
            client.emitStateUpdate(authoritativeState, [], { stateID: 1, randomCursor: 0 });
        });

        client.sendCommand.mockClear();
        mockEngine.processCommand.mockClear();

        act(() => {
            screen.getByTestId('dispatch-double-advance').click();
        });

        expect(mockEngine.processCommand).toHaveBeenCalledTimes(1);
        expect(client.sendCommand).toHaveBeenCalledTimes(1);
        expect(client.sendCommand).toHaveBeenLastCalledWith('ADVANCE_PHASE', { step: 1 });
        expect(screen.getByTestId('state').textContent).toContain('authoritative-second-phase');
        expect(screen.getByTestId('toasts').textContent).toContain('toast.commandQueuedAfterPreviousStep');

        client.sendCommand.mockClear();
        mockEngine.processCommand.mockClear();

        act(() => {
            client.emitStateUpdate(authoritativeState, [], { stateID: 2, randomCursor: 0 });
        });

        expect(mockEngine.processCommand).toHaveBeenCalledTimes(1);
        expect(client.sendCommand).toHaveBeenCalledTimes(1);
        expect(client.sendCommand).toHaveBeenLastCalledWith('ADVANCE_PHASE', { step: 2 });
    });

    it('releases serialized commands as soon as an authoritative state arrives', () => {
        const authoritativeState = {
            core: { marker: 'authoritative-start' },
            sys: {
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                eventStream: { entries: [], nextId: 1 },
            },
        };
        const confirmedState = {
            core: { marker: 'authoritative-main2' },
            sys: {
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                eventStream: { entries: [], nextId: 2 },
            },
        };
        const mockEngine = {
            hasPendingCommands: vi.fn(() => false),
            reconcile: vi.fn((state: unknown) => ({
                stateToRender: state,
                didRollback: false,
                optimisticEventWatermark: null,
            })),
            setPlayerIds: vi.fn(),
            syncRandom: vi.fn(),
            reset: vi.fn(),
            processCommand: vi.fn(() => ({
                stateToRender: null,
                shouldSend: true,
                animationMode: 'wait-confirm',
            })),
        };
        optimisticEngineControls.engine = mockEngine;

        render(
            <GameProvider
                server="http://127.0.0.1:3000"
                matchId="match-react-release-advance-on-authoritative-state"
                playerId="0"
                engineConfig={{ domain: {} as any, systems: [] as any[] } as any}
                latencyConfig={{
                    optimistic: { enabled: true },
                    batching: {
                        enabled: true,
                        windowMs: 50,
                        maxBatchSize: 5,
                        immediateCommands: ['ADVANCE_PHASE'],
                    },
                } as any}
            >
                <StateProbe />
                <DoubleAdvanceProbe />
            </GameProvider>,
        );

        expect(mockClientInstances).toHaveLength(1);
        const client = mockClientInstances[0]!;

        act(() => {
            client.emitStateUpdate(authoritativeState, [], { stateID: 1, randomCursor: 0 });
        });

        client.sendCommand.mockClear();
        mockEngine.processCommand.mockClear();

        act(() => {
            screen.getByTestId('dispatch-double-advance').click();
        });

        expect(client.sendCommand).toHaveBeenCalledTimes(1);
        expect(client.sendCommand).toHaveBeenLastCalledWith('ADVANCE_PHASE', { step: 1 });

        act(() => {
            client.emitStateUpdate(confirmedState, [], {
                stateID: 2,
                randomCursor: 0,
                lastCommandPlayerId: '0',
            });
            screen.getByTestId('dispatch-double-advance').click();
        });

        expect(screen.getByTestId('state').textContent).toContain('authoritative-main2');
        expect(client.sendCommand).toHaveBeenCalledTimes(2);
    });

    it('keeps a queued phase advance when its first retry is rejected and retries after resync', () => {
        const authoritativeState = {
            core: { marker: 'authoritative-start' },
            sys: {
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                eventStream: { entries: [], nextId: 1 },
            },
        };
        const mockEngine = {
            hasPendingCommands: vi.fn(() => false),
            reconcile: vi.fn((state: unknown) => ({
                stateToRender: state,
                didRollback: false,
                optimisticEventWatermark: null,
            })),
            setPlayerIds: vi.fn(),
            syncRandom: vi.fn(),
            reset: vi.fn(),
            processCommand: vi.fn(() => ({
                stateToRender: null,
                shouldSend: true,
                animationMode: 'wait-confirm',
            })),
        };
        optimisticEngineControls.engine = mockEngine;

        render(
            <GameProvider
                server="http://127.0.0.1:3000"
                matchId="match-react-retry-queued-advance"
                playerId="0"
                engineConfig={{ domain: {} as any, systems: [] as any[] } as any}
                latencyConfig={{
                    optimistic: { enabled: true },
                    batching: {
                        enabled: true,
                        windowMs: 50,
                        maxBatchSize: 5,
                        immediateCommands: ['ADVANCE_PHASE'],
                    },
                } as any}
            >
                <DoubleAdvanceProbe />
            </GameProvider>,
        );

        const client = mockClientInstances[0]!;
        act(() => {
            client.emitStateUpdate(authoritativeState, [], { stateID: 1, randomCursor: 0 });
            screen.getByTestId('dispatch-double-advance').click();
        });

        expect(client.sendCommand).toHaveBeenCalledTimes(1);
        client.sendCommand.mockReturnValueOnce(false);

        act(() => {
            client.emitStateUpdate(authoritativeState, [], { stateID: 2, randomCursor: 0 });
        });

        expect(client.resync).toHaveBeenCalledWith({ force: true });
        expect(client.sendCommand).toHaveBeenCalledTimes(2);

        client.sendCommand.mockReturnValue(true);
        act(() => {
            client.emitStateUpdate(authoritativeState, [], { stateID: 3, randomCursor: 0 });
        });

        expect(client.sendCommand).toHaveBeenCalledTimes(3);
        expect(client.sendCommand).toHaveBeenLastCalledWith('ADVANCE_PHASE', { step: 2 });
    });

    it('rejects an optimistic command before prediction when transport is not ready', () => {
        const authoritativeState = {
            core: { marker: 'authoritative-second-phase' },
            sys: {
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                eventStream: { entries: [], nextId: 1 },
            },
        };
        const mockEngine = {
            hasPendingCommands: vi.fn(() => false),
            reconcile: vi.fn((state: unknown) => ({
                stateToRender: state,
                didRollback: false,
                optimisticEventWatermark: null,
            })),
            setPlayerIds: vi.fn(),
            syncRandom: vi.fn(),
            reset: vi.fn(),
            processCommand: vi.fn(() => ({
                stateToRender: {
                    core: { marker: 'predicted-main-phase-2' },
                    sys: {
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                        eventStream: { entries: [], nextId: 1 },
                    },
                },
                shouldSend: true,
                animationMode: 'wait-confirm',
            })),
        };
        optimisticEngineControls.engine = mockEngine;

        render(
            <GameProvider
                server="http://127.0.0.1:3000"
                matchId="match-react-reject-before-optimistic"
                playerId="0"
                engineConfig={{ domain: {} as any, systems: [] as any[] } as any}
                latencyConfig={{
                    optimistic: { enabled: true },
                    batching: {
                        enabled: true,
                        windowMs: 50,
                        maxBatchSize: 5,
                        immediateCommands: ['ADVANCE_PHASE'],
                    },
                } as any}
            >
                <StateProbe />
                <DoubleAdvanceProbe />
            </GameProvider>,
        );

        expect(mockClientInstances).toHaveLength(1);
        const client = mockClientInstances[0]!;

        act(() => {
            client.emitStateUpdate(authoritativeState, [], { stateID: 1, randomCursor: 0 });
        });

        client.canSendCommand.mockReturnValue(false);

        act(() => {
            screen.getByTestId('dispatch-double-advance').click();
        });

        expect(mockEngine.processCommand).not.toHaveBeenCalled();
        expect(client.sendCommand).not.toHaveBeenCalled();
        expect(screen.getByTestId('state').textContent).toContain('authoritative-second-phase');
        expect(screen.getByTestId('state').textContent).not.toContain('predicted-main-phase-2');
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
