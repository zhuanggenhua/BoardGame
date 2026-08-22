import type { AiSeatController } from '../ai';
import type { MatchState } from '../types';
import { buildAiProgressMarker, resolveOnlineAiCurrentPlayerId, type ForceEndTurnStalledAiResolution } from './onlineAiRecovery';
import { resolveOnlineAiRecoveryDispatch } from './onlineAiRecoveryDispatch';
import { isOnlineAiRecoveryStillOwnedByAi } from './onlineAiRecoveryOwnership';
import {
    executeOnlineAiLegalActionRecovery,
    type OnlineAiLegalActionRecoveryExecutionMatch,
} from './onlineAiLegalActionRecoveryExecutor';
import type { OnlineAiActionDelayContext, OnlineAiActionDelayTraceEmitter } from './onlineAiActionDelay';
import type { GameEngineConfig } from './engineConfig';
import type { OnlineAiCommand } from './onlineAiExecutor';
import type { OnlineAiRecoveryTracker } from './onlineAiWatchdogTracker';
import type {
    OnlineAiLegalActionRecoveryResult,
} from './onlineAiWatchdogSequenceHelpers';
import type { OnlineAiWatchdogSeatController } from './onlineAiWatchdogSeatControllers';

export type OnlineAiLegalActionRecoveryCoordinatorMatch = OnlineAiLegalActionRecoveryExecutionMatch & {
    engineConfig: GameEngineConfig;
};

export type OnlineAiLegalActionRecoveryCoordinatorHooks<TMatch extends OnlineAiLegalActionRecoveryCoordinatorMatch> = {
    resolvePrivateOverlay: (match: TMatch, playerId: string) => MatchState<unknown>;
    getLatestSeatController: (match: TMatch, playerId: string) => AiSeatController | undefined;
    buildRecoveryFingerprint: (
        match: TMatch,
        candidate: ForceEndTurnStalledAiResolution,
        progressMarker: string,
    ) => string;
    hasRecoveryResolved: (
        match: TMatch,
        candidate: ForceEndTurnStalledAiResolution,
        seatControllers: Record<string, OnlineAiWatchdogSeatController>,
    ) => Promise<boolean>;
    settleRecoveryResolvedStatus: (args: {
        match: TMatch;
        tracker: OnlineAiRecoveryTracker;
        resolved: boolean;
    }) => void;
    resetRecoveryAttempt: (tracker: OnlineAiRecoveryTracker) => void;
    executeCommand: (args: {
        match: TMatch;
        playerId: string;
        command: OnlineAiCommand;
    }) => Promise<boolean>;
    broadcastState: (match: TMatch) => void;
    onEmergencyOverlayFallbackRetry: (args: {
        match: TMatch;
        playerId: string;
        reason: ForceEndTurnStalledAiResolution['reason'];
        blockedReason: 'missing-private-overlay' | 'stale-private-overlay';
        blockedKey: string;
    }) => void;
    onLegalActionBlocked: (args: {
        match: TMatch;
        playerId: string;
        blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay';
        visibility: 'shared' | 'private-required' | 'unknown';
        blockedKey: string;
        shouldTriggerOverlayResync: boolean;
        progressMarker: string;
    }) => void;
    onPrecheckDeferred: (args: {
        match: TMatch;
        playerId: string;
        commandType: string;
        errorMessage: string;
    }) => void;
    onAuthoritativeInvalidCommand: (args: {
        match: TMatch;
        playerId: string;
        command: OnlineAiCommand;
        commandFailureReason: string;
        progressMarker: string;
        stateIDBefore: number;
    }) => Promise<void>;
    onStoppedAfterOwnershipChanged: (args: {
        match: TMatch;
        tracker: OnlineAiRecoveryTracker;
        playerId: string;
        actionId: string;
        actionKind: string;
        executedCommandTypes: string[];
        resolved: boolean;
    }) => void;
    onRecoveredLegalAction: (args: {
        match: TMatch;
        tracker: OnlineAiRecoveryTracker;
        playerId: string;
        actionId: string;
        actionKind: string;
        markerBefore: string;
        markerAfter: string;
        resolved: boolean;
    }) => void;
};

export type OnlineAiLegalActionRecoveryCoordinatorConfig<TMatch extends OnlineAiLegalActionRecoveryCoordinatorMatch> = {
    emitTrace: OnlineAiActionDelayTraceEmitter;
    hooks: OnlineAiLegalActionRecoveryCoordinatorHooks<TMatch>;
};

export class OnlineAiLegalActionRecoveryCoordinator<TMatch extends OnlineAiLegalActionRecoveryCoordinatorMatch> {
    private readonly emitTrace: OnlineAiActionDelayTraceEmitter;
    private readonly hooks: OnlineAiLegalActionRecoveryCoordinatorHooks<TMatch>;

    constructor(config: OnlineAiLegalActionRecoveryCoordinatorConfig<TMatch>) {
        this.emitTrace = config.emitTrace;
        this.hooks = config.hooks;
    }

    async tryRecover(args: {
        match: TMatch;
        candidate: ForceEndTurnStalledAiResolution;
        tracker: OnlineAiRecoveryTracker;
        seatControllers: Record<string, OnlineAiWatchdogSeatController>;
        delayContext?: OnlineAiActionDelayContext;
    }): Promise<OnlineAiLegalActionRecoveryResult> {
        const { match, candidate, tracker, seatControllers } = args;
        const dispatchResult = await resolveOnlineAiRecoveryDispatch({
            engineConfig: match.engineConfig,
            gameId: match.gameId,
            matchId: match.matchID,
            sharedState: match.state,
            candidate,
            seatController: seatControllers[candidate.playerId],
            resolvePrivateOverlay: (playerId) => this.hooks.resolvePrivateOverlay(match, playerId),
            onEmergencyOverlayFallbackRetry: (payload) => {
                this.hooks.onEmergencyOverlayFallbackRetry({
                    match,
                    playerId: payload.playerId,
                    reason: payload.reason,
                    blockedReason: payload.blockedReason,
                    blockedKey: payload.blockedKey,
                });
            },
        });
        if (dispatchResult.kind === 'no-legal-action') {
            return {
                applied: false,
                resolved: false,
                blockedReason: null,
                executedCommandTypes: [],
                outcome: 'no-legal-action',
                reportedAction: null,
            };
        }

        if (dispatchResult.kind === 'blocked') {
            this.hooks.onLegalActionBlocked({
                match,
                playerId: dispatchResult.playerId,
                blockedReason: dispatchResult.blockedReason,
                visibility: dispatchResult.visibility,
                blockedKey: dispatchResult.blockedKey,
                shouldTriggerOverlayResync: dispatchResult.shouldTriggerOverlayResync,
                progressMarker: buildAiProgressMarker(match.state, {
                    engineConfig: match.engineConfig,
                    gameId: match.gameId,
                }),
            });
            return {
                applied: false,
                resolved: false,
                blockedReason: dispatchResult.blockedReason,
                executedCommandTypes: [],
                outcome: 'blocked',
                reportedAction: null,
            };
        }

        const { resolution, seatController } = dispatchResult;
        const isStillOwnedByRecoveredAi = (playerId: string): boolean => {
            return isOnlineAiRecoveryStillOwnedByAi({
                playerId,
                sharedState: match.state,
                seatControllers,
                resolveSeatState: (seatPlayerId) => this.hooks.resolvePrivateOverlay(match, seatPlayerId),
                resolveCurrentPlayerId: () => resolveOnlineAiCurrentPlayerId(match.state, {
                    engineConfig: match.engineConfig,
                    gameId: match.gameId,
                }),
            });
        };

        return executeOnlineAiLegalActionRecovery({
            match,
            candidate,
            resolution,
            seatController,
            delayContext: args.delayContext,
            emitTrace: this.emitTrace,
            hooks: {
                getLatestSeatController: (playerId) => this.hooks.getLatestSeatController(match, playerId),
                buildProgressMarker: () => buildAiProgressMarker(match.state, {
                    engineConfig: match.engineConfig,
                    gameId: match.gameId,
                }),
                buildRecoveryFingerprint: (progressMarker) => this.hooks.buildRecoveryFingerprint(
                    match,
                    candidate,
                    progressMarker,
                ),
                isStillOwnedByRecoveredAi,
                hasRecoveryResolved: () => this.hooks.hasRecoveryResolved(match, candidate, seatControllers),
                settleRecoveryResolvedStatus: (resolved) => {
                    this.hooks.settleRecoveryResolvedStatus({
                        match,
                        tracker,
                        resolved,
                    });
                },
                resetRecoveryAttempt: () => {
                    this.hooks.resetRecoveryAttempt(tracker);
                },
                validateCommand: (state, commandToValidate) => match.engineConfig.domain.validate(
                    state,
                    commandToValidate,
                ),
                executeCommand: (command) => this.hooks.executeCommand({
                    match,
                    playerId: resolution.playerId,
                    command,
                }),
                broadcastState: () => this.hooks.broadcastState(match),
                onPrecheckDeferred: (payload) => {
                    this.hooks.onPrecheckDeferred({
                        match,
                        playerId: payload.playerId,
                        commandType: payload.commandType,
                        errorMessage: payload.errorMessage,
                    });
                },
                onAuthoritativeInvalidCommand: (payload) => this.hooks.onAuthoritativeInvalidCommand({
                    match,
                    playerId: payload.playerId,
                    command: payload.command,
                    commandFailureReason: payload.commandFailureReason,
                    progressMarker: payload.progressMarker,
                    stateIDBefore: payload.stateIDBefore,
                }),
                onStoppedAfterOwnershipChanged: (payload) => {
                    this.hooks.onStoppedAfterOwnershipChanged({
                        match,
                        tracker,
                        playerId: payload.playerId,
                        actionId: payload.actionId,
                        actionKind: payload.actionKind,
                        executedCommandTypes: payload.executedCommandTypes,
                        resolved: payload.resolved,
                    });
                },
                onRecoveredLegalAction: (payload) => {
                    this.hooks.onRecoveredLegalAction({
                        match,
                        tracker,
                        playerId: payload.playerId,
                        actionId: payload.actionId,
                        actionKind: payload.actionKind,
                        markerBefore: payload.markerBefore,
                        markerAfter: payload.markerAfter,
                        resolved: payload.resolved,
                    });
                },
            },
        });
    }
}
