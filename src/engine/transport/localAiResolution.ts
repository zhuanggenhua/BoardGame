import { resolveNextAiAction, type AiResolution } from '../ai/localRunner';
import type { AiSeatController } from '../ai/types';
import type { MatchState } from '../types';
import type { GameEngineConfig } from './engineConfig';
import {
    resolveOnlineAiCurrentPlayerId,
    resolveForceEndTurnForStalledAi,
    resolveForceSkippableHiddenAiInteraction,
} from './onlineAiRecovery';
import { buildLocalAiSeatStates } from './stateNormalization';
import { logLocalAiPerfInfo } from './localAiDiagnostics';

function resolveLocalAiDecisionBudgetMs(args: {
    state: MatchState<unknown>;
    config: GameEngineConfig;
    seatControllers: Record<string, AiSeatController>;
}): number | undefined {
    const currentAiActorId = resolveOnlineAiCurrentPlayerId(args.state, {
        engineConfig: args.config,
        gameId: args.config.gameId,
    });
    if (!currentAiActorId) {
        return undefined;
    }

    const currentController = args.seatControllers[currentAiActorId];
    if (currentController?.type === 'human') {
        return undefined;
    }

    return currentController?.minimumActionDelayMs === 0 ? 0 : undefined;
}

export function canApplyLocalAiStalledRecovery(args: {
    stalledCandidate: ReturnType<typeof resolveForceEndTurnForStalledAi> | null;
    activePhaseElapsedMs: number | null;
    stallRecoveryGraceMs: number;
}): boolean {
    const { stalledCandidate, activePhaseElapsedMs, stallRecoveryGraceMs } = args;
    return Boolean(
        stalledCandidate
        && stalledCandidate.legalActionOnly !== true
        && (
            stalledCandidate.reason === 'hidden-interaction'
            || stalledCandidate.reason === 'visible-interaction'
            || stalledCandidate.reason === 'response-window'
            || activePhaseElapsedMs === null
            || activePhaseElapsedMs >= stallRecoveryGraceMs
        ),
    );
}

export async function resolveLocalAiActionWithRecovery(args: {
    config: GameEngineConfig;
    state: MatchState<unknown>;
    matchId: string;
    seatControllers: Record<string, AiSeatController>;
    activePhaseElapsedMs: number | null;
    stallRecoveryGraceMs: number;
}): Promise<AiResolution | null> {
    const {
        config,
        state,
        matchId,
        seatControllers,
        activePhaseElapsedMs,
        stallRecoveryGraceMs,
    } = args;

    const resolution = await resolveNextAiAction({
        engineConfig: config,
        state,
        matchId,
        seatControllers,
        decisionBudgetMs: resolveLocalAiDecisionBudgetMs({
            state,
            config,
            seatControllers,
        }),
    });
    if (resolution) {
        return resolution;
    }

    const seatStates = buildLocalAiSeatStates(state, seatControllers);
    const forceSkipCandidate = resolveForceSkippableHiddenAiInteraction({
        sharedState: state,
        seatControllers,
        seatStates,
        engineConfig: config,
        gameId: config.gameId,
    });
    const stalledCandidate = forceSkipCandidate
        ? null
        : resolveForceEndTurnForStalledAi({
            sharedState: state,
            seatControllers,
            seatStates,
            engineConfig: config,
            gameId: config.gameId,
        });

    if (forceSkipCandidate) {
        return forceSkipCandidate.resolution;
    }

    if (canApplyLocalAiStalledRecovery({
        stalledCandidate,
        activePhaseElapsedMs,
        stallRecoveryGraceMs,
    })) {
        return stalledCandidate?.resolution ?? null;
    }

    return null;
}

export function shouldScheduleLocalAiIdleRetry(args: {
    config: GameEngineConfig;
    state: MatchState<unknown>;
    seatControllers: Record<string, AiSeatController>;
}): boolean {
    const currentAiActorId = resolveOnlineAiCurrentPlayerId(args.state, {
        engineConfig: args.config,
        gameId: args.config.gameId,
    });
    return Boolean(
        currentAiActorId
        && args.seatControllers[currentAiActorId]?.type !== 'human',
    );
}

export function handleLocalAiIdleResolution(args: {
    config: GameEngineConfig;
    gameId: string;
    seed: string;
    state: MatchState<unknown>;
    seatControllers: Record<string, AiSeatController>;
    decisionElapsedMs: number;
    activePhaseElapsedMs: number | null;
    isCancelled: () => boolean;
    scheduleRetry: () => void;
    setDelayTimer: (handle: ReturnType<typeof setTimeout> | null) => void;
    idleRetryMs: number;
}): void {
    const shouldPollRetry = shouldScheduleLocalAiIdleRetry({
        config: args.config,
        state: args.state,
        seatControllers: args.seatControllers,
    });
    if (shouldPollRetry) {
        const delayTimer = setTimeout(() => {
            args.setDelayTimer(null);
            if (args.isCancelled()) return;
            args.scheduleRetry();
        }, args.idleRetryMs);
        args.setDelayTimer(delayTimer);
    }

    logLocalAiPerfInfo('idle', {
        gameId: args.gameId,
        matchId: `local:${args.gameId}:${args.seed}`,
        decisionElapsedMs: args.decisionElapsedMs,
        activePhaseElapsedMs: args.activePhaseElapsedMs,
        scheduledRetry: shouldPollRetry,
    });
}
