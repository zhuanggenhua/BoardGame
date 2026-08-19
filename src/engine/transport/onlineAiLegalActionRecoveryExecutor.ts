import type { AiResolution, AiSeatController } from '../ai';
import type { Command, MatchState, ValidationResult } from '../types';
import {
    markOnlineAiVisibleActionCompleted,
    waitForOnlineAiActionDelay,
    type OnlineAiActionDelayContext,
    type OnlineAiActionDelayTraceEmitter,
} from './onlineAiActionDelay';
import {
    buildOnlineAiAppliedLegalActionRecoveryResult,
    buildOnlineAiLegalActionCommandFailedResult,
    buildOnlineAiNoLegalActionRecoveryResult,
    type OnlineAiLegalActionRecoveryResult,
} from './onlineAiWatchdogSequenceHelpers';
import { precheckOnlineAiAuthoritativeCommand } from './onlineAiLegalActionCommand';
import type { ForceEndTurnStalledAiResolution } from './onlineAiRecovery';
import type { OnlineAiCommand } from './onlineAiExecutor';

export type OnlineAiLegalActionRecoveryExecutionMatch = {
    matchID: string;
    gameId: string;
    state: MatchState<unknown>;
    stateID: number;
    unloaded: boolean;
    lastCommandFailureReason: string | null;
};

export type OnlineAiLegalActionRecoveryExecutionHooks = {
    getLatestSeatController: (playerId: string) => AiSeatController | undefined;
    buildProgressMarker: () => string;
    buildRecoveryFingerprint: (progressMarker: string) => string;
    isStillOwnedByRecoveredAi: (playerId: string) => boolean;
    hasRecoveryResolved: () => Promise<boolean>;
    settleRecoveryResolvedStatus: (resolved: boolean) => void;
    resetRecoveryAttempt: () => void;
    validateCommand: (state: MatchState<unknown>, command: Command) => ValidationResult;
    executeCommand: (command: OnlineAiCommand) => Promise<boolean>;
    broadcastState: () => void;
    onPrecheckDeferred: (payload: {
        playerId: string;
        commandType: string;
        errorMessage: string;
    }) => void;
    onAuthoritativeInvalidCommand: (payload: {
        playerId: string;
        command: OnlineAiCommand;
        commandFailureReason: string;
        progressMarker: string;
        stateIDBefore: number;
    }) => Promise<void>;
    onStoppedAfterOwnershipChanged: (payload: {
        playerId: string;
        actionId: string;
        actionKind: string;
        executedCommandTypes: string[];
        resolved: boolean;
    }) => void;
    onRecoveredLegalAction: (payload: {
        playerId: string;
        actionId: string;
        actionKind: string;
        markerBefore: string;
        markerAfter: string;
        resolved: boolean;
    }) => void;
};

export async function executeOnlineAiLegalActionRecovery(args: {
    match: OnlineAiLegalActionRecoveryExecutionMatch;
    candidate: ForceEndTurnStalledAiResolution;
    resolution: AiResolution;
    seatController: Exclude<AiSeatController, { type: 'human' }>;
    delayContext?: OnlineAiActionDelayContext;
    emitTrace: OnlineAiActionDelayTraceEmitter;
    hooks: OnlineAiLegalActionRecoveryExecutionHooks;
}): Promise<OnlineAiLegalActionRecoveryResult> {
    const { match, candidate, resolution, hooks } = args;
    const stateIDBeforeDelay = match.stateID;
    const delayResult = await waitForOnlineAiActionDelay({
        matchId: match.matchID,
        gameId: match.gameId,
        playerId: resolution.playerId,
        action: resolution.action,
        controller: args.seatController,
        delayContext: args.delayContext,
        emitTrace: args.emitTrace,
    });
    if (match.unloaded || match.stateID !== stateIDBeforeDelay) {
        return buildOnlineAiNoLegalActionRecoveryResult();
    }
    const latestSeatController = hooks.getLatestSeatController(resolution.playerId);
    if (!latestSeatController || latestSeatController.type === 'human') {
        return buildOnlineAiNoLegalActionRecoveryResult();
    }

    const markerBefore = hooks.buildProgressMarker();
    const recoveryFingerprintBefore = hooks.buildRecoveryFingerprint(markerBefore);
    const executedCommandTypes: string[] = [];

    for (const command of resolution.action.commands) {
        if (executedCommandTypes.length > 0 && !hooks.isStillOwnedByRecoveredAi(resolution.playerId)) {
            hooks.broadcastState();
            const resolved = await hooks.hasRecoveryResolved();
            hooks.settleRecoveryResolvedStatus(resolved);
            hooks.onStoppedAfterOwnershipChanged({
                playerId: resolution.playerId,
                actionId: resolution.action.actionId,
                actionKind: resolution.action.kind,
                executedCommandTypes,
                resolved,
            });
            markOnlineAiVisibleActionCompleted(args.delayContext, delayResult);
            return buildOnlineAiAppliedLegalActionRecoveryResult({
                resolved,
                executedCommandTypes,
                action: {
                    candidateReason: candidate.reason,
                    playerId: resolution.playerId,
                    actionKind: resolution.action.kind,
                    actionId: resolution.action.actionId,
                    metadata: resolution.action.metadata,
                },
            });
        }

        const authoritativePrecheck = precheckOnlineAiAuthoritativeCommand({
            state: match.state,
            playerId: resolution.playerId,
            command,
            validate: hooks.validateCommand,
        });
        if (authoritativePrecheck.kind === 'deferred') {
            hooks.onPrecheckDeferred({
                playerId: resolution.playerId,
                commandType: command.type,
                errorMessage: authoritativePrecheck.errorMessage,
            });
        }

        if (authoritativePrecheck.kind === 'invalid') {
            const commandFailureReason = authoritativePrecheck.commandFailureReason;
            match.lastCommandFailureReason = commandFailureReason;
            const progressMarker = hooks.buildProgressMarker();
            await hooks.onAuthoritativeInvalidCommand({
                playerId: resolution.playerId,
                command,
                commandFailureReason,
                progressMarker,
                stateIDBefore: match.stateID,
            });
            hooks.resetRecoveryAttempt();
            return buildOnlineAiLegalActionCommandFailedResult({
                executedCommandTypes,
                failedCommandType: command.type,
                commandFailureReason,
            });
        }

        const success = await hooks.executeCommand(command);
        if (!success) {
            const commandFailureReason = match.lastCommandFailureReason;
            hooks.resetRecoveryAttempt();
            return buildOnlineAiLegalActionCommandFailedResult({
                executedCommandTypes,
                failedCommandType: command.type,
                commandFailureReason,
            });
        }
        executedCommandTypes.push(command.type);
    }

    const markerAfter = hooks.buildProgressMarker();
    const recoveryFingerprintAfter = hooks.buildRecoveryFingerprint(markerAfter);
    if (markerAfter === markerBefore && recoveryFingerprintAfter === recoveryFingerprintBefore) {
        hooks.resetRecoveryAttempt();
        return buildOnlineAiLegalActionCommandFailedResult();
    }

    hooks.broadcastState();
    const resolved = await hooks.hasRecoveryResolved();
    hooks.settleRecoveryResolvedStatus(resolved);
    hooks.onRecoveredLegalAction({
        playerId: resolution.playerId,
        actionId: resolution.action.actionId,
        actionKind: resolution.action.kind,
        markerBefore,
        markerAfter,
        resolved,
    });

    markOnlineAiVisibleActionCompleted(args.delayContext, delayResult);
    return buildOnlineAiAppliedLegalActionRecoveryResult({
        resolved,
        executedCommandTypes,
        action: {
            candidateReason: candidate.reason,
            playerId: resolution.playerId,
            actionKind: resolution.action.kind,
            actionId: resolution.action.actionId,
            metadata: resolution.action.metadata,
        },
    });
}
