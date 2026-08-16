import type { AiResolution } from '../engine/ai';
import type { MatchState } from '../engine/types';
import {
    resolveOnlineAiCurrentPlayerId,
    type OnlineAiRecoveryEngineConfig,
} from '../engine/transport/onlineAiRecovery';

export const ONLINE_AI_NO_PROGRESS_FORCE_END_THRESHOLD = 5;

export type OnlineAiNoProgressLoopTracker = {
    key: string;
    count: number;
    playerId: string;
    actionKind: string;
    actionId: string;
    commandTypes: string[];
    updatedAt: number;
};

function stableSerialize(value: unknown): string {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
    }

    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
        .filter((key) => record[key] !== undefined)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
        .join(',')}}`;
}

function stripTransientSysState(sys: MatchState<unknown>['sys']): Record<string, unknown> {
    if (!sys || typeof sys !== 'object') {
        return {};
    }
    const {
        decisionEpoch: _decisionEpoch,
        eventStream: _eventStream,
        interaction: _interaction,
        responseWindow: _responseWindow,
        ...stableSys
    } = sys as unknown as Record<string, unknown>;
    return stableSys;
}

export function buildOnlineAiEffectiveProgressMarker(args: {
    state: MatchState<unknown>;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
}): string {
    return stableSerialize({
        core: args.state.core,
        currentPlayerId: resolveOnlineAiCurrentPlayerId(args.state, {
            engineConfig: args.engineConfig,
            gameId: args.engineConfig?.gameId,
        }),
        sys: stripTransientSysState(args.state.sys),
    });
}

export function buildOnlineAiNoProgressLoopKey(args: {
    state: MatchState<unknown>;
    playerId: string;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
}): string {
    return [
        args.playerId,
        buildOnlineAiEffectiveProgressMarker({
            state: args.state,
            engineConfig: args.engineConfig,
        }),
    ].join(':');
}

export function resolveOnlineAiNoProgressLoopTracker(args: {
    current: OnlineAiNoProgressLoopTracker | null;
    beforeState: MatchState<unknown>;
    afterState: MatchState<unknown>;
    playerId: string;
    resolution: AiResolution;
    commandTypes: string[];
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
    now?: number;
    threshold?: number;
}): {
    nextTracker: OnlineAiNoProgressLoopTracker | null;
    didProgress: boolean;
    shouldForceEnd: boolean;
} {
    const beforeMarker = buildOnlineAiEffectiveProgressMarker({
        state: args.beforeState,
        engineConfig: args.engineConfig,
    });
    const afterMarker = buildOnlineAiEffectiveProgressMarker({
        state: args.afterState,
        engineConfig: args.engineConfig,
    });
    if (beforeMarker !== afterMarker) {
        return {
            nextTracker: null,
            didProgress: true,
            shouldForceEnd: false,
        };
    }

    const key = buildOnlineAiNoProgressLoopKey({
        state: args.afterState,
        playerId: args.playerId,
        engineConfig: args.engineConfig,
    });
    const count = args.current?.key === key ? args.current.count + 1 : 1;
    const nextTracker: OnlineAiNoProgressLoopTracker = {
        key,
        count,
        playerId: args.playerId,
        actionKind: args.resolution.action.kind,
        actionId: args.resolution.action.actionId,
        commandTypes: args.commandTypes,
        updatedAt: args.now ?? Date.now(),
    };

    return {
        nextTracker,
        didProgress: false,
        shouldForceEnd: count >= (args.threshold ?? ONLINE_AI_NO_PROGRESS_FORCE_END_THRESHOLD),
    };
}

export function shouldForceEndOnlineAiNoProgressLoop(args: {
    tracker: OnlineAiNoProgressLoopTracker | null;
    state: MatchState<unknown>;
    playerId: string;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
    threshold?: number;
}): boolean {
    if (!args.tracker || args.tracker.count < (args.threshold ?? ONLINE_AI_NO_PROGRESS_FORCE_END_THRESHOLD)) {
        return false;
    }
    return args.tracker.key === buildOnlineAiNoProgressLoopKey({
        state: args.state,
        playerId: args.playerId,
        engineConfig: args.engineConfig,
    });
}
