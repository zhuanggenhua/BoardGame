import logger from '../../../server/logger.js';
import {
    buildAiDecisionContext,
    getGameAiRuntime,
    resolveAiActionDecision,
    resolveLocalAiPolicy,
    resolveLocalAiPolicyByPreference,
    type AiSeatController,
} from '../ai';
import { extractAiInteractionSnapshot, extractAiResponseWindowSnapshot } from '../ai/snapshots';
import { INTERACTION_COMMANDS, INTERACTION_EVENTS } from '../systems/InteractionSystem';
import type { GameEvent, MatchState } from '../types';
import {
    buildCommandFailureFeedbackPayload as buildCommandFailureFeedbackPayloadData,
    type CommandFailureFeedbackPayload,
} from './commandFailureFeedbackPayload';
import type { GameEngineConfig } from './engineConfig';
import {
    type ForceEndTurnStalledAiResolution,
} from './onlineAiRecovery';
import {
    extractTrustedSetupSeatControllers,
    resolveRawOnlineAiWatchdogSeatControllers,
    resolveSeatControllerTypeForTraining,
} from './onlineAiSeatControllers';
import {
    isOnlineAiUnsatisfiableInteractionReason,
    shouldSuppressUnsatisfiableInteractionFeedback,
} from './onlineAiUnsatisfiableInteraction';
import {
    buildInteractionSelectabilityDiagnostic,
    buildOnlineAiDiagnosticActionLog,
    buildOnlineAiPendingDamageDiagnostic,
    buildOnlineAiRecoveryStateSnapshot as buildOnlineAiRecoveryStateSnapshotJson,
    buildOnlineAiUnsatisfiableInteractionStateSnapshot as buildOnlineAiUnsatisfiableInteractionStateSnapshotJson,
    buildOnlineAiWatchdogBlockerFingerprint,
    resolveOnlineAiRecoveryBlockerFingerprint,
    resolveUnsatisfiableReasonFromSelectability,
    summarizeOnlineAiRecoveryLegalActions,
    type OnlineAiRecoveryAiSummary,
    type OnlineAiRecoveryLegalActionSummary,
} from './onlineAiWatchdogFeedbackDiagnostics';
import type { OnlineAiRecoveryFeedbackPayload } from './transportFeedbackReporter';

export type OnlineAiFeedbackDiagnosticsMatch = {
    matchID: string;
    gameId: string;
    engineConfig: GameEngineConfig;
    state: MatchState<unknown>;
    metadata: {
        setupData?: unknown;
    };
};

export type OnlineAiFeedbackDiagnosticsBuilderConfig = {
    rulesVersion: string | null;
    applyPlayerView: (
        match: Pick<OnlineAiFeedbackDiagnosticsMatch, 'engineConfig' | 'state'>,
        playerId: string | null,
    ) => MatchState<unknown>;
};

export class OnlineAiFeedbackDiagnosticsBuilder {
    constructor(private readonly config: OnlineAiFeedbackDiagnosticsBuilderConfig) {}

    async buildRecoveryStateSnapshot(
        match: OnlineAiFeedbackDiagnosticsMatch,
        candidate: ForceEndTurnStalledAiResolution,
        trackerKey: string,
        progressMarker: string,
        failureReason?: string,
    ): Promise<string> {
        const seatView = this.config.applyPlayerView(match, candidate.playerId);
        const aiSummary = await this.buildRecoveryAiSummary(match, candidate.playerId, seatView);
        const blockerFingerprint = this.resolveRecoveryFeedbackFingerprint(
            match,
            candidate,
            trackerKey,
            progressMarker,
            failureReason,
        );

        return buildOnlineAiRecoveryStateSnapshotJson({
            matchId: match.matchID,
            gameId: match.gameId,
            state: match.state,
            seatState: seatView,
            candidate,
            trackerKey,
            progressMarker,
            blockerFingerprint,
            aiSummary,
        });
    }

    buildRecoveryActionLog(
        match: OnlineAiFeedbackDiagnosticsMatch,
        candidate: ForceEndTurnStalledAiResolution,
        trackerKey: string,
        progressMarker: string,
        failureReason?: string,
    ): string | undefined {
        const seatView = this.config.applyPlayerView(match, candidate.playerId);
        const sharedInteraction = extractAiInteractionSnapshot(match.state);
        const seatInteraction = extractAiInteractionSnapshot(seatView);
        const responseWindow = extractAiResponseWindowSnapshot(seatView);
        const pendingDamage = buildOnlineAiPendingDamageDiagnostic(match.state);
        const blockerFingerprint = this.resolveRecoveryFeedbackFingerprint(
            match,
            candidate,
            trackerKey,
            progressMarker,
            failureReason,
        );

        return buildOnlineAiDiagnosticActionLog({
            state: match.state,
            playerId: candidate.playerId,
            phase: seatView.sys?.phase ?? match.state.sys?.phase ?? null,
            progressMarker,
            trackerKey,
            reason: candidate.reason,
            blockerFingerprint,
            sharedInteraction,
            interaction: seatInteraction,
            responseWindow,
            pendingDamage,
        });
    }

    async buildUnsatisfiableInteractionStateSnapshot(args: {
        match: OnlineAiFeedbackDiagnosticsMatch;
        playerId: string;
        reason: string;
        commandType: string;
        progressMarkerBefore: string;
        preCommandSeatView: MatchState<unknown>;
    }): Promise<string> {
        const aiSummary = await this.buildRecoveryAiSummary(
            args.match,
            args.playerId,
            args.preCommandSeatView,
        );
        return buildOnlineAiUnsatisfiableInteractionStateSnapshotJson({
            matchId: args.match.matchID,
            gameId: args.match.gameId,
            state: args.match.state,
            seatState: args.preCommandSeatView,
            playerId: args.playerId,
            reason: args.reason,
            commandType: args.commandType,
            progressMarker: args.progressMarkerBefore,
            aiSummary,
        });
    }

    async buildUnsatisfiableInteractionFeedback(args: {
        match: OnlineAiFeedbackDiagnosticsMatch;
        playerId: string;
        seatControllerType: 'human' | 'local-ai' | 'remote-ai';
        commandType: string;
        event: GameEvent;
        progressMarkerBefore: string;
        preCommandSeatView: MatchState<unknown>;
    }): Promise<OnlineAiRecoveryFeedbackPayload | null> {
        const eventType = args.event.type;
        if (
            args.seatControllerType === 'human'
            || (args.commandType !== INTERACTION_COMMANDS.RESPOND && args.commandType !== INTERACTION_COMMANDS.CANCEL)
            || eventType !== INTERACTION_EVENTS.CANCELLED
        ) {
            return null;
        }

        const payload = (args.event as GameEvent & {
            payload?: {
                reason?: unknown;
                interactionId?: unknown;
            };
        }).payload;
        const rawReason = typeof payload?.reason === 'string' ? payload.reason : null;
        const inferredReason = rawReason ?? resolveUnsatisfiableReasonFromSelectability(
            extractAiInteractionSnapshot(args.preCommandSeatView),
        );
        if (!isOnlineAiUnsatisfiableInteractionReason(inferredReason)) {
            return null;
        }

        const interaction = extractAiInteractionSnapshot(args.preCommandSeatView);
        const sharedInteraction = extractAiInteractionSnapshot(args.match.state);
        const sharedSelectability = buildInteractionSelectabilityDiagnostic(sharedInteraction);
        const seatSelectability = buildInteractionSelectabilityDiagnostic(interaction);
        const shouldSuppressByDefault = shouldSuppressUnsatisfiableInteractionFeedback({
            sharedInteraction,
            seatInteraction: interaction,
            sharedSelectability,
            seatSelectability,
        });
        const phase = typeof args.preCommandSeatView.sys?.phase === 'string'
            ? args.preCommandSeatView.sys.phase
            : typeof args.match.state.sys?.phase === 'string'
                ? args.match.state.sys.phase
                : '';
        const shouldSuppressByGame = args.match.engineConfig.onlineAiRecovery
            ?.shouldSuppressUnsatisfiableInteractionFeedback?.({
                state: args.preCommandSeatView,
                phase,
                playerId: args.playerId,
                reason: inferredReason,
                sharedInteraction,
                seatInteraction: interaction,
                sharedSelectability,
                seatSelectability,
            }) === true;
        if (shouldSuppressByDefault || shouldSuppressByGame) {
            return null;
        }

        const responseWindow = extractAiResponseWindowSnapshot(args.preCommandSeatView);
        const pendingDamage = buildOnlineAiPendingDamageDiagnostic(args.match.state);
        const blockerFingerprint = buildOnlineAiWatchdogBlockerFingerprint({
            phase: args.preCommandSeatView.sys?.phase ?? args.match.state.sys?.phase ?? null,
            reason: inferredReason,
            sharedInteraction,
            seatInteraction: interaction,
            responseWindow,
            pendingDamage,
        });
        const trackerKey = [
            args.playerId,
            'unsatisfiable-interaction',
            typeof payload?.interactionId === 'string' ? payload.interactionId : 'unknown',
            inferredReason,
            args.progressMarkerBefore,
        ].join(':');

        return {
            matchId: args.match.matchID,
            gameId: args.match.gameId,
            playerId: args.playerId,
            incidentKind: 'unsatisfiable-interaction-auto-skipped',
            severity: 'medium',
            status: 'open',
            reason: inferredReason,
            trackerKey,
            progressMarker: args.progressMarkerBefore,
            stateSnapshot: await this.buildUnsatisfiableInteractionStateSnapshot({
                match: args.match,
                playerId: args.playerId,
                reason: inferredReason,
                commandType: args.commandType,
                progressMarkerBefore: args.progressMarkerBefore,
                preCommandSeatView: args.preCommandSeatView,
            }),
            actionLog: buildOnlineAiDiagnosticActionLog({
                state: args.preCommandSeatView,
                playerId: args.playerId,
                phase: args.preCommandSeatView.sys?.phase ?? args.match.state.sys?.phase ?? null,
                progressMarker: args.progressMarkerBefore,
                trackerKey,
                blockerFingerprint,
                sharedInteraction,
                interaction,
                responseWindow,
                pendingDamage,
                commandType: args.commandType,
                reason: inferredReason,
            }),
        };
    }

    buildCommandFailureFeedbackPayload(args: {
        match: OnlineAiFeedbackDiagnosticsMatch;
        playerId: string;
        commandType: string;
        reason: string;
        commandPayload: unknown;
        progressMarker: string;
        stateIdBefore: number;
        visibleState: MatchState<unknown>;
        feedbackSource: CommandFailureFeedbackPayload['feedbackSource'];
    }): CommandFailureFeedbackPayload {
        const aiContext = this.buildCommandFailureAiDiagnostic({
            match: args.match,
            playerId: args.playerId,
            visibleState: args.visibleState,
        });
        return buildCommandFailureFeedbackPayloadData({
            matchId: args.match.matchID,
            gameId: args.match.gameId,
            state: args.match.state,
            playerId: args.playerId,
            commandType: args.commandType,
            reason: args.reason,
            commandPayload: args.commandPayload,
            progressMarker: args.progressMarker,
            stateIdBefore: args.stateIdBefore,
            visibleState: args.visibleState,
            feedbackSource: args.feedbackSource,
            aiContext,
        });
    }

    private async buildRecoveryAiSummary(
        match: OnlineAiFeedbackDiagnosticsMatch,
        playerId: string,
        seatView: MatchState<unknown>,
    ): Promise<OnlineAiRecoveryAiSummary> {
        const rawSeatControllers = resolveRawOnlineAiWatchdogSeatControllers(match.state, match.metadata.setupData);
        const seatControllerType = resolveSeatControllerTypeForTraining(rawSeatControllers, playerId);

        try {
            const decisionContext = buildAiDecisionContext({
                gameId: match.engineConfig.gameId,
                matchId: match.matchID,
                playerId,
                visibleState: seatView,
                rulesVersion: this.config.rulesVersion,
                decisionBudgetMs: 250,
                source: 'online',
            });

            const legalActions = summarizeOnlineAiRecoveryLegalActions(decisionContext.legalActions);
            if (seatControllerType === 'human') {
                return {
                    seatControllerType,
                    legalActions,
                    decisionPreview: null,
                };
            }

            const runtime = getGameAiRuntime(match.engineConfig.gameId);
            if (!runtime) {
                return {
                    seatControllerType,
                    legalActions,
                    decisionPreview: null,
                };
            }

            const seatController = rawSeatControllers?.[playerId] as AiSeatController | undefined;
            const previewPolicy = seatControllerType === 'local-ai' && seatController?.type === 'local-ai'
                ? resolveLocalAiPolicy(runtime, seatController)
                : seatControllerType === 'remote-ai'
                    ? resolveLocalAiPolicyByPreference({
                        runtime,
                        preferredPolicyId: seatController && seatController.type === 'remote-ai'
                            ? seatController.fallbackPolicyId
                            : undefined,
                    })
                    : undefined;

            if (!previewPolicy) {
                return {
                    seatControllerType,
                    legalActions,
                    decisionPreview: null,
                };
            }

            try {
                const decision = await Promise.resolve(previewPolicy.decide(decisionContext));
                const chosenAction = resolveAiActionDecision(decisionContext, decision);
                return {
                    seatControllerType,
                    legalActions,
                    decisionPreview: {
                        previewSource: seatControllerType === 'remote-ai' ? 'remote-fallback-policy' : 'seat-policy',
                        policyId: previewPolicy.id,
                        chosenAction: chosenAction ? {
                            actionId: chosenAction.actionId,
                            kind: chosenAction.kind,
                            label: chosenAction.label,
                            commandTypes: chosenAction.commands.map((command) => command.type),
                        } : null,
                        reasoningSummary: typeof decision?.reasoningSummary === 'string' ? decision.reasoningSummary : null,
                        confidence: typeof decision?.confidence === 'number' ? decision.confidence : null,
                        error: null,
                    },
                };
            } catch (error) {
                return {
                    seatControllerType,
                    legalActions,
                    decisionPreview: {
                        previewSource: seatControllerType === 'remote-ai' ? 'remote-fallback-policy' : 'seat-policy',
                        policyId: previewPolicy.id,
                        chosenAction: null,
                        reasoningSummary: null,
                        confidence: null,
                        error: error instanceof Error ? error.message : String(error),
                    },
                };
            }
        } catch (error) {
            logger.warn('[GameTransport] failed to summarize online-ai legal actions for watchdog feedback', {
                matchID: match.matchID,
                gameId: match.gameId,
                playerID: playerId,
                error: error instanceof Error ? error.message : String(error),
            });
            return {
                seatControllerType,
                legalActions: null,
                decisionPreview: null,
            };
        }
    }

    private resolveRecoveryFeedbackFingerprint(
        match: OnlineAiFeedbackDiagnosticsMatch,
        candidate: ForceEndTurnStalledAiResolution,
        trackerKey: string,
        progressMarker: string,
        failureReason?: string,
    ): string | null {
        return resolveOnlineAiRecoveryBlockerFingerprint({
            state: match.state,
            candidate,
            trackerKey,
            progressMarker,
            failureReason,
            engineConfig: match.engineConfig,
        });
    }

    private buildCommandFailureAiDiagnostic(args: {
        match: OnlineAiFeedbackDiagnosticsMatch;
        playerId: string;
        visibleState: MatchState<unknown>;
    }): {
        seatControllerType: 'human' | 'local-ai' | 'remote-ai';
        legalActions: OnlineAiRecoveryLegalActionSummary | null;
    } {
        const seatControllers = extractTrustedSetupSeatControllers(args.match.metadata.setupData);
        const seatControllerType = resolveSeatControllerTypeForTraining(seatControllers, args.playerId);
        if (seatControllerType === 'human') {
            return { seatControllerType, legalActions: null };
        }

        try {
            const decisionContext = buildAiDecisionContext({
                gameId: args.match.gameId,
                matchId: args.match.matchID,
                playerId: args.playerId,
                visibleState: args.visibleState,
                rulesVersion: this.config.rulesVersion,
                decisionBudgetMs: 250,
                source: 'online',
            });
            return {
                seatControllerType,
                legalActions: summarizeOnlineAiRecoveryLegalActions(decisionContext.legalActions),
            };
        } catch (error) {
            logger.warn('[GameTransport] failed to summarize command failure AI context', {
                matchID: args.match.matchID,
                gameId: args.match.gameId,
                playerID: args.playerId,
                error: error instanceof Error ? error.message : String(error),
            });
            return { seatControllerType, legalActions: null };
        }
    }
}
