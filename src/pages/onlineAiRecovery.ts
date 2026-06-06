import { getGameImplementation } from '../games/registry';
import { buildAiProgressMarker } from '../engine/transport/react';
import type { GameEngineConfig } from '../engine/transport/server';
import type { MatchState } from '../engine/types';
import {
    resolveNextAiDispatch,
    resolveOnlineAiDecisionView,
    type AiSeatController,
} from '../engine/ai';
import {
    resolveManualForceEndAiPhase,
    type ForceEndTurnStalledAiResolution,
    type ForceSkippableHiddenAiInteraction,
} from './onlineAiForceSkip';

const STALE_SEAT_RECOVERY_MIN_INTERVAL_MS = 1200;

function shouldPreferManualLegalActionRecoveryForPublicPregame(args: {
    sharedState: MatchState<unknown>;
    candidate: NonNullable<ReturnType<typeof resolveManualForceEndAiPhase>>;
    engineConfig: Pick<GameEngineConfig, 'gameId' | 'onlineAiRecovery'>;
}): boolean {
    if (args.candidate.reason !== 'active-turn') {
        return false;
    }
    if (args.engineConfig.onlineAiRecovery?.publicPregameLegalActionPhases?.length) {
        return false;
    }

    const phase = typeof args.sharedState.sys?.phase === 'string' ? args.sharedState.sys.phase : '';
    return phase === 'factionSelect';
}

export async function resolveManualOnlineAiRecovery(args: {
    engineConfig: Pick<GameEngineConfig, 'gameId' | 'onlineAiRecovery'>;
    matchId: string;
    sharedState: MatchState<unknown>;
    seatControllers: Record<string, AiSeatController>;
    seatStates: Record<string, MatchState<unknown> | null | undefined>;
    resolveDispatchImpl?: typeof resolveNextAiDispatch;
}): Promise<
    | {
        kind: 'force-end-turn';
        candidate: NonNullable<ReturnType<typeof resolveManualForceEndAiPhase>>;
    }
    | {
        kind: 'legal-action';
        resolution: Awaited<ReturnType<typeof resolveNextAiDispatch>> extends { kind: 'action'; resolution: infer R } ? R : never;
    }
    | {
        kind: 'blocked';
        playerId: string;
        blockedKey: string | null;
        blockedReason: string;
    }
    | {
        kind: 'unavailable';
    }
> {
    const candidate = resolveManualForceEndAiPhase({
        sharedState: args.sharedState,
        seatControllers: args.seatControllers,
        seatStates: args.seatStates,
        engineConfig: args.engineConfig,
        gameId: args.engineConfig.gameId,
    });
    if (
        candidate
        && candidate.legalActionOnly !== true
        && !shouldPreferManualLegalActionRecoveryForPublicPregame({
            sharedState: args.sharedState,
            candidate,
            engineConfig: args.engineConfig,
        })
    ) {
        return {
            kind: 'force-end-turn',
            candidate,
        };
    }

    const dispatchImpl = args.resolveDispatchImpl ?? resolveNextAiDispatch;
    const aiDispatchResult = await dispatchImpl({
        engineConfig: args.engineConfig as GameEngineConfig,
        state: args.sharedState,
        matchId: args.matchId,
        seatControllers: args.seatControllers,
        visibleStateResolver: (playerId) => resolveOnlineAiDecisionView({
            runtime: getGameImplementation(args.engineConfig.gameId).ai,
            sharedState: args.sharedState,
            privateOverlay: args.seatStates[playerId],
            playerId,
        }),
    });

    if (aiDispatchResult.kind === 'action') {
        return {
            kind: 'legal-action',
            resolution: aiDispatchResult.resolution,
        };
    }

    if (aiDispatchResult.kind === 'blocked') {
        return {
            kind: 'blocked',
            playerId: aiDispatchResult.playerId,
            blockedKey: aiDispatchResult.blockedKey,
            blockedReason: aiDispatchResult.blockedReason,
        };
    }

    return { kind: 'unavailable' };
}

export function resolveManualBlockedOnlineAiSeatResync(args: {
    playerId: string;
    blockedKey: string | null;
    blockedReason: string;
}): {
    playerId: string;
    reason: 'manual-force-end-blocked';
    meta: {
        blockedKey: string;
        blockedReason: string;
    };
} | null {
    if (!args.blockedKey) {
        return null;
    }
    return {
        playerId: args.playerId,
        reason: 'manual-force-end-blocked',
        meta: {
            blockedKey: args.blockedKey,
            blockedReason: args.blockedReason,
        },
    };
}

export type OnlineAiSeatRecoveryTracker = {
    key: string;
    lastRecoveryAt: number;
};

export function resolveOnlineAiSeatRecoveryAttempt(args: {
    recoveryKey: string;
    now: number;
    lastRecovery: OnlineAiSeatRecoveryTracker | null;
    minIntervalMs?: number;
}): {
    shouldRecover: boolean;
    nextRecovery: OnlineAiSeatRecoveryTracker;
} {
    const minIntervalMs = args.minIntervalMs ?? STALE_SEAT_RECOVERY_MIN_INTERVAL_MS;
    const shouldRecover = !args.lastRecovery
        || args.lastRecovery.key !== args.recoveryKey
        || args.now - args.lastRecovery.lastRecoveryAt >= minIntervalMs;
    return {
        shouldRecover,
        nextRecovery: shouldRecover
            ? {
                key: args.recoveryKey,
                lastRecoveryAt: args.now,
            }
            : args.lastRecovery,
    };
}

export function buildOnlineAiForceEndTurnTrackerKey(args: {
    candidate: Pick<ForceEndTurnStalledAiResolution, 'playerId' | 'reason' | 'fingerprintHint' | 'resolution'>;
    turnNumber?: unknown;
    phase?: unknown;
}): string {
    const turnNumber = args.turnNumber ?? 'no-turn';
    const phase = args.phase ?? 'no-phase';
    const trackerSemanticKey = args.candidate.fingerprintHint ?? args.candidate.resolution.attemptKey;
    return `${args.candidate.playerId}:${args.candidate.reason}:${trackerSemanticKey}:${turnNumber}:${phase}`;
}

export function buildOnlineAiForceSkipTrackerKey(args: {
    candidate: Pick<ForceSkippableHiddenAiInteraction, 'playerId' | 'interactionId' | 'sourceId' | 'title' | 'fingerprintHint' | 'resolution'>;
}): string {
    return args.candidate.fingerprintHint
        ?? `force-skip:${args.candidate.playerId}:${args.candidate.interactionId}:${args.candidate.sourceId ?? 'unknown-source'}:${args.candidate.title ?? 'unknown-title'}:${args.candidate.resolution.attemptKey}`;
}

export function buildOnlineAiIdleSeatRecoveryKey(args: {
    playerId: string;
    authoritativeState: MatchState<unknown>;
    engineConfig?: Pick<GameEngineConfig, 'gameId' | 'onlineAiRecovery'>;
}): string {
    return [
        'idle-active-ai',
        args.playerId,
        buildOnlineAiSeamAwareProgressMarker({
            state: args.authoritativeState,
            engineConfig: args.engineConfig,
        }),
    ].join(':');
}

export function buildOnlineAiSubmitBlockedRecoveryKey(args: {
    playerId: string;
    resolution: {
        attemptKey?: string | null;
        action: {
            kind?: string | null;
        };
    };
    authoritativeState: MatchState<unknown>;
    engineConfig?: Pick<GameEngineConfig, 'gameId' | 'onlineAiRecovery'>;
}): string {
    return [
        'submit-blocked-ai',
        args.playerId,
        args.resolution.action.kind ?? 'unknown-action',
        args.resolution.attemptKey ?? 'unknown-attempt',
        buildOnlineAiSeamAwareProgressMarker({
            state: args.authoritativeState,
            engineConfig: args.engineConfig,
        }),
    ].join(':');
}

export function buildOnlineAiSeamAwareProgressMarker(args: {
    state: MatchState<unknown>;
    engineConfig?: Pick<GameEngineConfig, 'gameId' | 'onlineAiRecovery'>;
}): string {
    return buildAiProgressMarker(args.state, { engineConfig: args.engineConfig });
}

export function buildOnlineAiSeamAwareAttemptMarkers(args: {
    sharedState: MatchState<unknown>;
    seatState: MatchState<unknown> | null | undefined;
    engineConfig?: Pick<GameEngineConfig, 'gameId' | 'onlineAiRecovery'>;
}): {
    sharedMarker: string;
    seatMarker: string | null;
} {
    return {
        sharedMarker: buildOnlineAiSeamAwareProgressMarker({
            state: args.sharedState,
            engineConfig: args.engineConfig,
        }),
        seatMarker: args.seatState
            ? buildOnlineAiSeamAwareProgressMarker({
                state: args.seatState,
                engineConfig: args.engineConfig,
            })
            : null,
    };
}

type OnlineAiSeatStateRecord = Record<string, MatchState<unknown> | null | undefined>;

export function resolveOnlineAiEffectiveSeatState(args: {
    playerId: string;
    seatStateOverrides: OnlineAiSeatStateRecord;
    seatLatestStates: OnlineAiSeatStateRecord;
    engineConfig?: Pick<GameEngineConfig, 'gameId' | 'onlineAiRecovery'>;
}): MatchState<unknown> | null {
    const override = args.seatStateOverrides[args.playerId];
    const latestState = args.seatLatestStates[args.playerId] ?? null;
    if (override !== undefined) {
        if (!shouldRetainOnlineAiSeatOverrideAfterLatestState({
            seatStateOverride: override,
            latestSeatState: latestState,
            engineConfig: args.engineConfig,
        })) {
            return latestState;
        }
        return override ?? null;
    }
    return latestState;
}

export function resolveOnlineAiEffectiveSeatStates(args: {
    playerIds: string[];
    seatStateOverrides: OnlineAiSeatStateRecord;
    seatLatestStates: OnlineAiSeatStateRecord;
    engineConfig?: Pick<GameEngineConfig, 'gameId' | 'onlineAiRecovery'>;
}): Record<string, MatchState<unknown> | null> {
    return Object.fromEntries(
        args.playerIds.map((playerId) => [
            playerId,
            resolveOnlineAiEffectiveSeatState({
                playerId,
                seatStateOverrides: args.seatStateOverrides,
                seatLatestStates: args.seatLatestStates,
                engineConfig: args.engineConfig,
            }),
        ]),
    );
}

export function shouldStageOnlineAiSeatOverrideFromConfirmedState(args: {
    authoritativeState: MatchState<unknown> | unknown;
    latestSeatState: MatchState<unknown> | null | undefined;
    engineConfig?: Pick<GameEngineConfig, 'gameId' | 'onlineAiRecovery'>;
}): boolean {
    const authoritativeState = args.authoritativeState && typeof args.authoritativeState === 'object'
        ? args.authoritativeState as MatchState<unknown>
        : null;
    if (!authoritativeState) {
        return false;
    }
    const latestSeatState = args.latestSeatState ?? null;
    if (!latestSeatState) {
        return true;
    }
    return buildAiProgressMarker(latestSeatState, { engineConfig: args.engineConfig })
        !== buildAiProgressMarker(authoritativeState, { engineConfig: args.engineConfig });
}

function hasSeatScopedBlockingSurface(state: MatchState<unknown> | null): boolean {
    if (!state) {
        return false;
    }
    const currentInteraction = state.sys?.interaction?.current;
    const queuedInteractions = state.sys?.interaction?.queue;
    const responseWindow = state.sys?.responseWindow?.current;
    return Boolean(currentInteraction)
        || (Array.isArray(queuedInteractions) && queuedInteractions.length > 0)
        || Boolean(responseWindow);
}

export function shouldRetainOnlineAiSeatOverrideAfterLatestState(args: {
    seatStateOverride: MatchState<unknown> | null | undefined;
    latestSeatState: MatchState<unknown> | null | undefined;
    engineConfig?: Pick<GameEngineConfig, 'gameId' | 'onlineAiRecovery'>;
}): boolean {
    const override = args.seatStateOverride ?? null;
    if (!override) {
        return false;
    }
    const latestSeatState = args.latestSeatState ?? null;
    if (!latestSeatState) {
        return true;
    }
    if (hasSeatScopedBlockingSurface(override) && !hasSeatScopedBlockingSurface(latestSeatState)) {
        return false;
    }
    return buildAiProgressMarker(latestSeatState, { engineConfig: args.engineConfig })
        !== buildAiProgressMarker(override, { engineConfig: args.engineConfig });
}
