/* @vitest-environment happy-dom */
import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameEngineConfig } from '../engineConfig';
import type { Command, GameEvent, MatchState } from '../../types';
import type { EngineSystem } from '../../systems/types';
import { LocalGameProvider, useGameClient } from '../react';

type RaceCore = {
    marker: string;
    observedMarker?: string;
};

const raceSystem: EngineSystem<RaceCore> = {
    id: 'local-state-ref-race',
    name: 'Local state ref race test',
    priority: 1,
    beforeCommand: ({ state, command }) => {
        if (command.type === 'MARK_STARTED') {
            return {
                halt: true,
                state: {
                    ...state,
                    core: {
                        ...state.core,
                        marker: 'started',
                    },
                },
            };
        }
        if (command.type === 'OBSERVE_MARKER') {
            return {
                halt: true,
                state: {
                    ...state,
                    core: {
                        ...state.core,
                        observedMarker: state.core.marker,
                    },
                },
            };
        }
        return undefined;
    },
};

const testConfig: GameEngineConfig = {
    gameId: 'local-state-ref-race',
    domain: {
        setup: (): RaceCore => ({ marker: 'initial' }),
        validate: () => ({ valid: true }),
        execute: () => [],
        reduce: (core: RaceCore, _event: GameEvent) => core,
    },
    systems: [raceSystem],
    minPlayers: 1,
    maxPlayers: 1,
    commandTypes: ['MARK_STARTED', 'OBSERVE_MARKER'],
};

function RaceProbe(): JSX.Element {
    const { state, dispatch } = useGameClient<RaceCore>();
    const didMarkRef = useRef(false);

    useLayoutEffect(() => {
        if (didMarkRef.current) {
            return;
        }
        didMarkRef.current = true;
        dispatch('MARK_STARTED', {});
        window.setTimeout(() => {
            dispatch('OBSERVE_MARKER', {});
        }, 0);
    }, [dispatch]);

    return <pre data-testid="race-core">{JSON.stringify((state as MatchState<RaceCore>)?.core)}</pre>;
}

function CapturedDispatchProbe({
    onDispatchReady,
}: {
    onDispatchReady: (dispatch: (type: string, payload: unknown) => void) => void;
}): JSX.Element {
    const { state, dispatch } = useGameClient<RaceCore>();
    const didMarkRef = useRef(false);

    useLayoutEffect(() => {
        onDispatchReady(dispatch as (type: string, payload: unknown) => void);
        if (didMarkRef.current) {
            return;
        }
        didMarkRef.current = true;
        dispatch('MARK_STARTED', {});
    }, [dispatch, onDispatchReady]);

    return <pre data-testid="captured-race-core">{JSON.stringify((state as MatchState<RaceCore>)?.core)}</pre>;
}

function AncestorPassiveDispatchProbe(): JSX.Element {
    const dispatchRef = useRef<((type: string, payload: unknown) => void) | null>(null);
    const didObserveRef = useRef(false);

    useEffect(() => {
        if (didObserveRef.current) {
            return;
        }
        didObserveRef.current = true;
        dispatchRef.current?.('OBSERVE_MARKER', {});
    }, []);

    return (
        <LocalGameProvider config={testConfig} numPlayers={1} seed="local-state-ref-ancestor-race">
            <CapturedDispatchProbe onDispatchReady={(dispatch) => {
                dispatchRef.current = dispatch;
            }} />
        </LocalGameProvider>
    );
}

describe('LocalGameProvider state ref sequencing', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('下一拍命令应基于 layout 阶段已经提交的本地状态', async () => {
        vi.useFakeTimers();

        render(
            <LocalGameProvider config={testConfig} numPlayers={1} seed="local-state-ref-race">
                <RaceProbe />
            </LocalGameProvider>,
        );

        await act(async () => {
            await vi.runOnlyPendingTimersAsync();
        });

        expect(screen.getByTestId('race-core').textContent).toContain('"marker":"started"');
        expect(screen.getByTestId('race-core').textContent).toContain('"observedMarker":"started"');
    });

    it('祖先 passive effect 后续命令不能被 Provider 初始 effect 回拨到旧状态', async () => {
        render(<AncestorPassiveDispatchProbe />);

        await screen.findByTestId('captured-race-core');

        expect(screen.getByTestId('captured-race-core').textContent).toContain('"marker":"started"');
        expect(screen.getByTestId('captured-race-core').textContent).toContain('"observedMarker":"started"');
    });
});
