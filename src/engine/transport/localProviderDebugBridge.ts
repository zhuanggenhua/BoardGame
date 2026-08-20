import type { MatchState } from '../types';
import { TestHarness, isTestEnvironment } from '../testing';
import type { GameEngineConfig } from './engineConfig';
import { normalizeStateForConfig } from './stateNormalization';

function buildHarnessDispatchPayload(command: {
    playerId?: string;
    payload?: unknown;
}): unknown {
    if (!command.playerId) {
        return command.payload;
    }

    const payloadRecord = command.payload && typeof command.payload === 'object'
        ? (command.payload as Record<string, unknown>)
        : {};

    return {
        ...payloadRecord,
        __internalPlayerId: command.playerId,
    };
}

export function syncLocalProviderTestHarness(args: {
    config: GameEngineConfig;
    getState: () => MatchState<unknown>;
    setState: (state: MatchState<unknown>) => void;
    dispatch: (type: string, payload: unknown) => void;
}): void {
    if (!isTestEnvironment()) {
        return;
    }

    TestHarness.init();
    const harness = TestHarness.getInstance();

    harness.state.register(
        () => args.getState(),
        (newState) => {
            const nextState = normalizeStateForConfig(
                args.config,
                newState as MatchState<unknown>,
            );
            args.setState(nextState);
        },
    );

    harness.command.register(async (command) => {
        args.dispatch(command.type, buildHarnessDispatchPayload(command));
    });
}

export function exposeLocalProviderDebugBridge(args: {
    dispatch: (type: string, payload: unknown) => void;
    state: MatchState<unknown>;
}): () => void {
    if (typeof window === 'undefined') {
        return () => {};
    }

    const w = window as Window & {
        __BG_LOCAL_DISPATCH__?: typeof args.dispatch;
        __BG_LOCAL_STATE__?: typeof args.state;
    };
    w.__BG_LOCAL_DISPATCH__ = args.dispatch;
    w.__BG_LOCAL_STATE__ = args.state;

    return () => {
        delete w.__BG_LOCAL_DISPATCH__;
        delete w.__BG_LOCAL_STATE__;
    };
}
