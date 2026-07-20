import type { MatchState } from '../types';
import type { AiSeatController } from '../ai';
import { createScopedLogger } from '../../lib/logger';
import { resolveCurrentTurnPlayerId } from '../sessionContext';

const localAiPerfLogger = createScopedLogger('LOCAL_AI_PERF');
const aiRuntimeTruthLogger = createScopedLogger('AI_RUNTIME_TRUTH');

function shouldEmitAiConsoleLog(): boolean {
    return import.meta.env?.DEV === true;
}

export const LOCAL_AI_STALL_RECOVERY_GRACE_MS = 1_200;
export const LOCAL_AI_IDLE_RETRY_MS = 120;

export type LocalAiTurnTimeline = {
    turnKey: string;
    turnStartedAt: number;
    decisionReadyAt: number | null;
    firstVisibleCommandLogged: boolean;
    rollCount: number;
    lastRollAt: number | null;
};

export function emitLocalAiPerf(stage: string, payload: Record<string, unknown>): void {
    if (!shouldEmitAiConsoleLog()) return;
    console.log('[LOCAL_AI_PERF]', { stage, ...payload });
}

export function emitAiRuntimeTruth(stage: string, payload: Record<string, unknown>): void {
    if (!shouldEmitAiConsoleLog()) return;
    console.log('[AI_RUNTIME_TRUTH]', { stage, ...payload });
}

export function logLocalAiPerfInfo(stage: string, payload: Record<string, unknown>): void {
    localAiPerfLogger.info(stage, payload);
    emitLocalAiPerf(stage, payload);
}

export function logLocalAiPerfWarn(stage: string, payload: Record<string, unknown>): void {
    localAiPerfLogger.warn(stage, payload);
    emitLocalAiPerf(stage, payload);
}

export function logAiRuntimeTruthInfo(stage: string, payload: Record<string, unknown>): void {
    aiRuntimeTruthLogger.info(stage, payload);
    emitAiRuntimeTruth(stage, payload);
}

export function logAiRuntimeTruthWarn(stage: string, payload: Record<string, unknown>): void {
    aiRuntimeTruthLogger.warn(stage, payload);
    emitAiRuntimeTruth(stage, payload);
}

export function summarizeSeatControllerTypes(
    seatControllers: Record<string, AiSeatController>,
): Record<string, string> {
    return Object.fromEntries(
        Object.entries(seatControllers)
            .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
            .map(([playerId, controller]) => [playerId, controller.type]),
    );
}

export function resolveCoreCurrentPlayerId(core: unknown): string | null {
    return resolveCurrentTurnPlayerId(core);
}

export function ensureLocalAiTurnTimeline(args: {
    timelines: Record<string, LocalAiTurnTimeline>;
    playerId: string;
    matchState: MatchState<unknown>;
    gameId: string;
    seed: string;
}): LocalAiTurnTimeline {
    const {
        timelines,
        playerId,
        matchState,
        gameId,
        seed,
    } = args;
    const phase = matchState.sys?.phase ?? 'unknown';
    const turnNumber = matchState.sys?.turnNumber ?? 'no-turn';
    const nextId = matchState.sys?.eventStream?.nextId ?? 'no-event';
    const turnKey = `${playerId}:${turnNumber}`;
    const existingTimeline = timelines[playerId];
    if (existingTimeline?.turnKey === turnKey) {
        return existingTimeline;
    }
    const nextTimeline: LocalAiTurnTimeline = {
        turnKey,
        turnStartedAt: Date.now(),
        decisionReadyAt: null,
        firstVisibleCommandLogged: false,
        rollCount: 0,
        lastRollAt: null,
    };
    timelines[playerId] = nextTimeline;
    logLocalAiPerfInfo('ai-turn-begin', {
        gameId,
        matchId: `local:${gameId}:${seed}`,
        playerId,
        phase,
        turnNumber,
        turnKey,
        eventStreamNextId: nextId,
    });
    return nextTimeline;
}
