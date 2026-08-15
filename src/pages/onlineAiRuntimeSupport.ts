import type { AiSeatController } from '../engine/ai';
import type { MatchState } from '../engine/types';
import { createScopedLogger } from '../lib/logger';

export type OnlineAiDebugApi = {
    getSeatLatestState: (playerId: string) => MatchState<unknown> | null;
    getSeatDecisionState: (playerId: string) => Record<string, unknown> | null;
    getTransportLog: () => Array<Record<string, unknown>>;
    getPerfLog: () => Array<Record<string, unknown>>;
    setSeatLatestStateOverride: (playerId: string, state: MatchState<unknown> | null) => void;
    clearSeatLatestStateOverride: (playerId: string) => void;
    clearAllSeatLatestStateOverrides: () => void;
};

export type OnlineAiDebugWindow = Window & {
    __BG_ONLINE_AI_DEBUG__?: OnlineAiDebugApi;
    __BG_MATCHROOM_DEBUG__?: {
        getLiveSnapshot: () => Record<string, unknown> | null;
    };
    __BG_ONLINE_AI_TRANSPORT_LOG__?: Array<Record<string, unknown>>;
    __BG_ONLINE_AI_PERF_LOG__?: Array<Record<string, unknown>>;
};

export const onlineAiPerfLogger = createScopedLogger('ONLINE_AI_PERF');
export const onlineAiTransportLogger = createScopedLogger('ONLINE_AI_TRANSPORT');
export const aiRuntimeTruthLogger = createScopedLogger('AI_RUNTIME_TRUTH');

function shouldEmitOnlineAiConsoleLog(): boolean {
    return import.meta.env.DEV === true;
}

function appendOnlineAiDevLog(kind: 'transport' | 'perf', event: Record<string, unknown>): void {
    if (typeof window === 'undefined' || !import.meta.env.DEV) {
        return;
    }
    const debugWindow = window as OnlineAiDebugWindow;
    const targetKey = kind === 'transport'
        ? '__BG_ONLINE_AI_TRANSPORT_LOG__'
        : '__BG_ONLINE_AI_PERF_LOG__';
    const nextLog = [...(debugWindow[targetKey] ?? []), event].slice(-80);
    debugWindow[targetKey] = nextLog;
}

export function emitOnlineAiPerf(stage: string, payload: Record<string, unknown>): void {
    const event = { stage, ...payload };
    appendOnlineAiDevLog('perf', event);
    if (!shouldEmitOnlineAiConsoleLog()) return;
    console.log('[ONLINE_AI_PERF]', event);
}

export function emitOnlineAiTransport(stage: string, payload: Record<string, unknown>): void {
    const event = { stage, ...payload };
    appendOnlineAiDevLog('transport', event);
    if (!shouldEmitOnlineAiConsoleLog()) return;
    console.log('[ONLINE_AI_TRANSPORT]', event);
}

export function emitAiRuntimeTruth(stage: string, payload: Record<string, unknown>): void {
    if (!shouldEmitOnlineAiConsoleLog()) return;
    console.log('[AI_RUNTIME_TRUTH]', { stage, ...payload });
}

export function installOnlineAiServerDebugApi(args: {
    getLatestState: (playerId: string) => MatchState<unknown> | null;
    getSeatControllers: () => Record<string, AiSeatController>;
}): () => void {
    if (typeof window === 'undefined' || !import.meta.env.DEV) {
        return () => undefined;
    }

    const debugWindow = window as OnlineAiDebugWindow;
    const stateOverrides: Record<string, MatchState<unknown> | null> = {};
    const hasOverride = (playerId: string) => Object.prototype.hasOwnProperty.call(stateOverrides, playerId);
    const api: OnlineAiDebugApi = {
        getSeatLatestState: (playerId: string) => (
            hasOverride(playerId)
                ? stateOverrides[playerId]
                : args.getLatestState(playerId)
        ),
        getSeatDecisionState: (playerId: string) => {
            const perfLog = debugWindow.__BG_ONLINE_AI_PERF_LOG__ ?? [];
            const transportLog = debugWindow.__BG_ONLINE_AI_TRANSPORT_LOG__ ?? [];
            const logEntry = [...perfLog, ...transportLog]
                .reverse()
                .find((entry) => entry.playerId === playerId || entry.aiPlayerId === playerId);
            if (logEntry) {
                return logEntry;
            }
            const seatController = args.getSeatControllers()[playerId];
            const latestState = api.getSeatLatestState(playerId);
            return latestState && seatController?.type !== 'human'
                ? {
                    stage: 'server-authority-observed',
                    playerId,
                    authority: 'server-online-ai-executor',
                }
                : null;
        },
        getTransportLog: () => debugWindow.__BG_ONLINE_AI_TRANSPORT_LOG__ ?? [],
        getPerfLog: () => debugWindow.__BG_ONLINE_AI_PERF_LOG__ ?? [],
        setSeatLatestStateOverride: (playerId: string, state: MatchState<unknown> | null) => {
            stateOverrides[playerId] = state;
        },
        clearSeatLatestStateOverride: (playerId: string) => {
            delete stateOverrides[playerId];
        },
        clearAllSeatLatestStateOverrides: () => {
            for (const playerId of Object.keys(stateOverrides)) {
                delete stateOverrides[playerId];
            }
        },
    };

    debugWindow.__BG_ONLINE_AI_DEBUG__ = api;
    return () => {
        if (debugWindow.__BG_ONLINE_AI_DEBUG__ === api) {
            delete debugWindow.__BG_ONLINE_AI_DEBUG__;
        }
    };
}

export function summarizeSeatControllerTypes(seatControllers: Record<string, AiSeatController>): Record<string, string> {
    return Object.fromEntries(
        Object.entries(seatControllers)
            .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
            .map(([playerId, controller]) => [playerId, controller.type]),
    );
}
