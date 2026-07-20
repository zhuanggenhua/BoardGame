import type { MatchState } from '../engine/types';
import type { AiSeatController } from '../engine/ai';
import { createScopedLogger } from '../lib/logger';

export type OnlineAiDebugWindow = Window & {
    __BG_ONLINE_AI_DEBUG__?: {
        getSeatLatestState: (playerId: string) => MatchState<unknown> | null;
        getSeatDecisionState: (playerId: string) => Record<string, unknown> | null;
        getTransportLog: () => Array<Record<string, unknown>>;
        getPerfLog: () => Array<Record<string, unknown>>;
        setSeatLatestStateOverride: (playerId: string, state: MatchState<unknown> | null) => void;
        clearSeatLatestStateOverride: (playerId: string) => void;
        clearAllSeatLatestStateOverrides: () => void;
    };
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

export function summarizeSeatControllerTypes(seatControllers: Record<string, AiSeatController>): Record<string, string> {
    return Object.fromEntries(
        Object.entries(seatControllers)
            .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
            .map(([playerId, controller]) => [playerId, controller.type]),
    );
}
