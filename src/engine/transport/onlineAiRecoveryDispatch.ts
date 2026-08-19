import * as aiModule from '../ai';
import type { AiResolution, AiSeatController } from '../ai';
import type { MatchState } from '../types';
import type { GameEngineConfig } from './server';
import {
    shouldUseOnlineAiEmergencyOverlayFallback,
    type ForceEndTurnStalledAiResolution,
} from './onlineAiRecovery';

export const MANUAL_FORCE_ADVANCE_AFTER_CONFIRMED_ROLL_PREFIX = 'manual-force-advance-after-confirm:';

type OnlineAiRecoveryDispatchBlockedReason =
    | 'missing-visible-state'
    | 'missing-private-overlay'
    | 'stale-private-overlay';

export type OnlineAiRecoveryDispatchResult =
    | {
        kind: 'action';
        resolution: AiResolution;
        seatController: Exclude<AiSeatController, { type: 'human' }>;
    }
    | {
        kind: 'blocked';
        playerId: string;
        blockedReason: OnlineAiRecoveryDispatchBlockedReason;
        visibility: 'shared' | 'private-required' | 'unknown';
        blockedKey: string;
        shouldTriggerOverlayResync: boolean;
    }
    | {
        kind: 'no-legal-action';
    };

const isPrivateOverlayBlockedReason = (
    reason: OnlineAiRecoveryDispatchBlockedReason,
): reason is 'missing-private-overlay' | 'stale-private-overlay' => (
    reason === 'missing-private-overlay' || reason === 'stale-private-overlay'
);

export async function resolveOnlineAiRecoveryDispatch(args: {
    engineConfig: GameEngineConfig;
    gameId: string;
    matchId: string;
    sharedState: MatchState<unknown>;
    candidate: ForceEndTurnStalledAiResolution;
    seatController: AiSeatController | undefined;
    resolvePrivateOverlay: (playerId: string) => MatchState<unknown>;
    onEmergencyOverlayFallbackRetry?: (payload: {
        playerId: string;
        reason: ForceEndTurnStalledAiResolution['reason'];
        blockedReason: 'missing-private-overlay' | 'stale-private-overlay';
        blockedKey: string;
    }) => void;
}): Promise<OnlineAiRecoveryDispatchResult> {
    const { candidate, seatController } = args;
    if (!seatController || seatController.type === 'human') {
        return { kind: 'no-legal-action' };
    }
    if (candidate.fingerprintHint?.startsWith(MANUAL_FORCE_ADVANCE_AFTER_CONFIRMED_ROLL_PREFIX)) {
        return { kind: 'no-legal-action' };
    }

    const resolveStrictOnlineDecisionView = (playerId: string) => aiModule.resolveOnlineAiDecisionView({
        runtime: aiModule.getGameAiRuntime(args.gameId) ?? null,
        sharedState: args.sharedState,
        privateOverlay: args.resolvePrivateOverlay(playerId),
        playerId,
    });

    let aiDispatchResult = await aiModule.resolveNextAiDispatch({
        engineConfig: args.engineConfig,
        state: args.sharedState,
        matchId: args.matchId,
        seatControllers: {
            [candidate.playerId]: seatController,
        },
        visibleStateResolver: resolveStrictOnlineDecisionView,
    });

    const shouldRetryWithEmergencyOverlay = aiDispatchResult.kind === 'blocked'
        && shouldUseOnlineAiEmergencyOverlayFallback(candidate.reason)
        && isPrivateOverlayBlockedReason(aiDispatchResult.blockedReason);

    if (shouldRetryWithEmergencyOverlay && aiDispatchResult.kind === 'blocked') {
        args.onEmergencyOverlayFallbackRetry?.({
            playerId: candidate.playerId,
            reason: candidate.reason,
            blockedReason: aiDispatchResult.blockedReason,
            blockedKey: aiDispatchResult.blockedKey,
        });

        aiDispatchResult = await aiModule.resolveNextAiDispatch({
            engineConfig: args.engineConfig,
            state: args.sharedState,
            matchId: args.matchId,
            seatControllers: {
                [candidate.playerId]: seatController,
            },
            visibleStateResolver: args.resolvePrivateOverlay,
        });
    }

    if (aiDispatchResult.kind !== 'action') {
        if (aiDispatchResult.kind !== 'blocked') {
            return { kind: 'no-legal-action' };
        }
        return {
            kind: 'blocked',
            playerId: aiDispatchResult.playerId,
            blockedReason: aiDispatchResult.blockedReason,
            visibility: aiDispatchResult.visibility,
            blockedKey: aiDispatchResult.blockedKey,
            shouldTriggerOverlayResync: candidate.reason !== 'response-loop'
                && aiDispatchResult.visibility === 'private-required'
                && isPrivateOverlayBlockedReason(aiDispatchResult.blockedReason),
        };
    }

    const { resolution } = aiDispatchResult;
    if (resolution.playerId !== candidate.playerId || resolution.action.commands.length === 0) {
        return { kind: 'no-legal-action' };
    }

    return {
        kind: 'action',
        resolution,
        seatController,
    };
}
