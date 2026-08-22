import {
    buildAiDecisionContext,
    getGameAiRuntime,
    resolveNextAiDispatch,
    resolveOnlineAiDecisionView,
    shouldPlayerManuallyResolveSetupSelection,
    type AiDispatchResult,
    type AiLegalAction,
    type ResolvedOnlineAiDecisionView,
} from '../ai';
import type { MatchState } from '../types';
import type { GameEngineConfig } from './engineConfig';
import {
    buildAiProgressMarker,
    buildResponseWindowRecoveryFingerprintHint,
    resolveCurrentPlayerId,
    resolveForceEndTurnForStalledAi,
    resolveOnlineAiCurrentPlayerId,
    shouldInspectSeatStatesForHiddenAiInteraction,
    type ForceEndTurnStalledAiResolution,
} from './onlineAiRecovery';
import { shouldProbeOnlineAiLegalActionOnlyCandidateForHumanTurn } from './onlineAiWatchdogGameSemantics';
import type { OnlineAiWatchdogSeatController } from './onlineAiWatchdogSeatControllers';
import type { OnlineAiRecoveryTracker } from './onlineAiWatchdogTracker';

export type OnlineAiRecoveryCandidateResolverMatch = {
    matchID: string;
    gameId: string;
    state: MatchState<unknown>;
    engineConfig: GameEngineConfig;
};

type OnlineAiDecisionVisibleState =
    | MatchState<unknown>
    | ResolvedOnlineAiDecisionView
    | null
    | undefined;

type ResolveAiDispatch = (args: {
    engineConfig: GameEngineConfig;
    state: MatchState<unknown>;
    matchId: string;
    seatControllers: Record<string, OnlineAiWatchdogSeatController>;
    rulesVersion?: string | null;
    decisionBudgetMs?: number;
    visibleStateResolver?: (playerId: string) => OnlineAiDecisionVisibleState;
}) => Promise<AiDispatchResult>;

type BuildLegalActions = (args: {
    gameId: string;
    matchId: string;
    playerId: string;
    visibleState: MatchState<unknown>;
    rulesVersion: string | null;
    decisionBudgetMs: number;
    source: 'online';
}) => AiLegalAction[];

type ShouldTreatAsManualSetupSelection = (args: {
    engineConfig: GameEngineConfig;
    state: MatchState<unknown>;
    playerId: string;
    seatController: OnlineAiWatchdogSeatController;
    action: AiLegalAction;
}) => boolean;

export type OnlineAiRecoveryCandidateResolverHooks<TMatch extends OnlineAiRecoveryCandidateResolverMatch> = {
    resolvePrivateOverlay: (match: TMatch, playerId: string) => MatchState<unknown>;
    getCurrentTracker: (matchId: string) => OnlineAiRecoveryTracker | undefined;
    buildRecoveryFingerprint: (
        match: TMatch,
        candidate: ForceEndTurnStalledAiResolution,
        progressMarker: string,
    ) => string;
};

export type OnlineAiRecoveryCandidateResolverConfig<TMatch extends OnlineAiRecoveryCandidateResolverMatch> = {
    rulesVersion: string | null;
    hooks: OnlineAiRecoveryCandidateResolverHooks<TMatch>;
    deps?: {
        resolveBaseCandidate?: typeof resolveForceEndTurnForStalledAi;
        resolveAiDispatch?: ResolveAiDispatch;
        buildLegalActions?: BuildLegalActions;
        shouldTreatAsManualSetupSelection?: ShouldTreatAsManualSetupSelection;
        getAiRuntime?: typeof getGameAiRuntime;
        resolveDecisionView?: typeof resolveOnlineAiDecisionView;
    };
};

export class OnlineAiRecoveryCandidateResolver<TMatch extends OnlineAiRecoveryCandidateResolverMatch> {
    private readonly rulesVersion: string | null;
    private readonly hooks: OnlineAiRecoveryCandidateResolverHooks<TMatch>;
    private readonly resolveBaseCandidate: typeof resolveForceEndTurnForStalledAi;
    private readonly resolveAiDispatch: ResolveAiDispatch;
    private readonly buildLegalActions: BuildLegalActions;
    private readonly shouldTreatAsManualSetupSelection: ShouldTreatAsManualSetupSelection;
    private readonly getAiRuntime: typeof getGameAiRuntime;
    private readonly resolveDecisionView: typeof resolveOnlineAiDecisionView;

    constructor(config: OnlineAiRecoveryCandidateResolverConfig<TMatch>) {
        this.rulesVersion = config.rulesVersion;
        this.hooks = config.hooks;
        this.resolveBaseCandidate = config.deps?.resolveBaseCandidate ?? resolveForceEndTurnForStalledAi;
        this.resolveAiDispatch = config.deps?.resolveAiDispatch ?? resolveNextAiDispatch;
        this.buildLegalActions = config.deps?.buildLegalActions ?? ((args) => buildAiDecisionContext(args).legalActions);
        this.shouldTreatAsManualSetupSelection = config.deps?.shouldTreatAsManualSetupSelection
            ?? ((args) => shouldPlayerManuallyResolveSetupSelection(
                args.engineConfig,
                args.state,
                args.playerId,
                args.seatController,
                args.action,
            ));
        this.getAiRuntime = config.deps?.getAiRuntime ?? getGameAiRuntime;
        this.resolveDecisionView = config.deps?.resolveDecisionView ?? resolveOnlineAiDecisionView;
    }

    async resolveCandidate(
        match: TMatch,
        seatControllers: Record<string, OnlineAiWatchdogSeatController>,
    ): Promise<ForceEndTurnStalledAiResolution | null> {
        const needsSeatStates = shouldInspectSeatStatesForHiddenAiInteraction(match.state);
        const seatStates: Record<string, MatchState<unknown> | null | undefined> = needsSeatStates
            ? Object.fromEntries(
                Object.entries(seatControllers)
                    .filter(([, controller]) => controller.type !== 'human')
                    .map(([playerId]) => [playerId, this.hooks.resolvePrivateOverlay(match, playerId)]),
            )
            : {};

        const candidate = this.resolveBaseCandidate({
            sharedState: match.state,
            seatControllers,
            seatStates,
            engineConfig: match.engineConfig,
            gameId: match.gameId,
        }) ?? await this.resolveLegalActionOnlyCandidate(match, seatControllers);

        if (!candidate) {
            return null;
        }

        if (
            (candidate.reason === 'active-turn-legal-only' || candidate.reason === 'seat-legal-only')
            && await this.shouldSuppressForManualSetupSelection(match, candidate.playerId, seatControllers)
        ) {
            return null;
        }

        return this.maybeEscalateResponseWindowCandidate(match, candidate, seatControllers);
    }

    async resolveLegalActionOnlyCandidate(
        match: TMatch,
        seatControllers: Record<string, OnlineAiWatchdogSeatController>,
    ): Promise<ForceEndTurnStalledAiResolution | null> {
        const visibleTurnPlayerId = resolveCurrentPlayerId(match.state);
        const recoveryActorPlayerId = resolveOnlineAiCurrentPlayerId(match.state, {
            engineConfig: match.engineConfig,
            gameId: match.gameId,
        });
        if (!visibleTurnPlayerId || seatControllers[visibleTurnPlayerId]?.type !== 'human') {
            return null;
        }

        if (!shouldProbeOnlineAiLegalActionOnlyCandidateForHumanTurn({
            state: match.state,
            currentPlayerId: visibleTurnPlayerId,
            engineConfig: match.engineConfig,
        })) {
            return null;
        }

        const currentInteraction = match.state.sys?.interaction as { current?: unknown; isBlocked?: unknown } | undefined;
        if (currentInteraction?.current || currentInteraction?.isBlocked === true) {
            return null;
        }

        const currentResponseWindow = (match.state.sys?.responseWindow as { current?: unknown } | undefined)?.current;
        if (currentResponseWindow) {
            return null;
        }

        const aiDispatchResult = await this.resolveAiDispatch({
            engineConfig: match.engineConfig,
            state: match.state,
            matchId: match.matchID,
            seatControllers,
            visibleStateResolver: (playerId) => this.resolveDecisionVisibleState(match, playerId),
        });

        const phase = typeof match.state.sys?.phase === 'string' ? match.state.sys.phase : '';
        if (aiDispatchResult.kind === 'blocked') {
            const playerId = aiDispatchResult.playerId;
            if (
                aiDispatchResult.visibility !== 'private-required'
                || (
                    aiDispatchResult.blockedReason !== 'stale-private-overlay'
                    && aiDispatchResult.blockedReason !== 'missing-private-overlay'
                )
                || playerId === recoveryActorPlayerId
            ) {
                return null;
            }

            const fingerprintHint = [
                'seat-legal-only',
                playerId,
                phase,
                aiDispatchResult.blockedReason,
                aiDispatchResult.blockedKey,
            ].join(':');

            return buildSeatLegalOnlyCandidate(playerId, fingerprintHint);
        }

        if (aiDispatchResult.kind !== 'action') {
            return null;
        }

        const resolution = aiDispatchResult.resolution;
        if (resolution.playerId === recoveryActorPlayerId) {
            return null;
        }

        const fingerprintHint = [
            'seat-legal-only',
            resolution.playerId,
            phase,
            resolution.action.kind,
            resolution.action.actionId,
        ].join(':');

        return buildSeatLegalOnlyCandidate(resolution.playerId, fingerprintHint);
    }

    async shouldSuppressForManualSetupSelection(
        match: TMatch,
        playerId: string,
        seatControllers: Record<string, OnlineAiWatchdogSeatController>,
    ): Promise<boolean> {
        const seatController = seatControllers[playerId];
        const manualSetupSelection = seatController?.type !== 'human'
            && (
                seatController.manualFactionSelection === true
                || seatController.manualSetupSelection === true
            );
        if (!seatController || seatController.type === 'human' || !manualSetupSelection) {
            return false;
        }

        const decisionView = this.resolveDecisionVisibleState(match, playerId);
        const visibleState = decisionView && 'kind' in decisionView && decisionView.kind === 'online-ai-decision-view'
            ? decisionView.visibleState
            : this.hooks.resolvePrivateOverlay(match, playerId);

        const legalActions = this.buildLegalActions({
            gameId: match.engineConfig.gameId,
            matchId: match.matchID,
            playerId,
            visibleState,
            rulesVersion: this.rulesVersion,
            decisionBudgetMs: 250,
            source: 'online',
        });

        return legalActions.length > 0
            && legalActions.every((action) => {
                const commandTypes = action.commands.map((command) => command.type);
                const configured = match.engineConfig.onlineAiRecovery?.shouldTreatActionAsManualSetupSelection?.({
                    actionKind: action.kind,
                    actionId: action.actionId,
                    commandTypes,
                });
                if (configured !== undefined) {
                    return configured;
                }
                return this.shouldTreatAsManualSetupSelection({
                    engineConfig: match.engineConfig,
                    state: match.state,
                    playerId,
                    seatController,
                    action,
                });
            });
    }

    private resolveDecisionVisibleState(match: TMatch, playerId: string): ResolvedOnlineAiDecisionView {
        return this.resolveDecisionView({
            runtime: this.getAiRuntime(match.gameId) ?? null,
            sharedState: match.state,
            privateOverlay: this.hooks.resolvePrivateOverlay(match, playerId),
            playerId,
        });
    }

    private maybeEscalateResponseWindowCandidate(
        match: TMatch,
        candidate: ForceEndTurnStalledAiResolution,
        seatControllers: Record<string, OnlineAiWatchdogSeatController>,
    ): ForceEndTurnStalledAiResolution {
        if (candidate.reason !== 'response-window') {
            return candidate;
        }

        const currentWindow = (match.state.sys as { responseWindow?: { current?: unknown } } | undefined)
            ?.responseWindow?.current as {
                responderQueue?: unknown;
                currentResponderIndex?: unknown;
            } | undefined;
        const responderQueue = Array.isArray(currentWindow?.responderQueue) ? currentWindow.responderQueue : [];
        const responderIndex = typeof currentWindow?.currentResponderIndex === 'number'
            ? currentWindow.currentResponderIndex
            : 0;
        const currentResponderId = typeof responderQueue[responderIndex] === 'string'
            ? responderQueue[responderIndex]
            : null;
        const hasHumanResponder = responderQueue.some((responderId) => {
            const id = typeof responderId === 'string' ? responderId : '';
            return id && seatControllers[id]?.type === 'human';
        });

        const currentTracker = this.hooks.getCurrentTracker(match.matchID);
        const currentProgressMarker = buildAiProgressMarker(match.state, {
            engineConfig: match.engineConfig,
            gameId: match.gameId,
        });
        const currentRecoveryFingerprint = this.hooks.buildRecoveryFingerprint(
            match,
            candidate,
            currentProgressMarker,
        );
        const responseWindowTrackerKey = `${candidate.playerId}:${candidate.reason}:${currentRecoveryFingerprint}`;
        const responseLoopFingerprint = buildResponseWindowRecoveryFingerprintHint(
            match.state,
            currentResponderId ?? candidate.playerId,
            'response-loop',
        );
        const responseLoopTrackerKey = `${candidate.playerId}:response-loop:${responseLoopFingerprint}`;
        const shouldEscalateToResponseLoop = !hasHumanResponder && (
            currentTracker?.key === responseLoopTrackerKey
            || (
                currentTracker?.key === responseWindowTrackerKey
                && (currentTracker.failureCount ?? 0) > 0
            )
        );
        if (!shouldEscalateToResponseLoop) {
            return candidate;
        }

        return {
            ...candidate,
            reason: 'response-loop',
            fingerprintHint: responseLoopFingerprint,
            resolution: {
                playerId: candidate.playerId,
                attemptKey: `force-end-turn:${candidate.playerId}:${responseLoopFingerprint}`,
                source: 'local-ai',
                action: {
                    actionId: `force-end-turn:${responseLoopFingerprint}`,
                    kind: 'force-end-turn',
                    label: '强制结束 AI 回合',
                    commands: [{ type: 'SYS_RESPONSE_WINDOW_FORCE_CLOSE', payload: {} }],
                },
            },
        };
    }
}

function buildSeatLegalOnlyCandidate(
    playerId: string,
    fingerprintHint: string,
): ForceEndTurnStalledAiResolution {
    return {
        playerId,
        reason: 'seat-legal-only',
        legalActionOnly: true,
        fingerprintHint,
        resolution: {
            playerId,
            attemptKey: `force-end-turn:${playerId}:${fingerprintHint}`,
            source: 'local-ai',
            action: {
                actionId: `force-end-turn:${fingerprintHint}`,
                kind: 'force-end-turn',
                label: '服务端代 AI 执行合法动作',
                commands: [],
            },
        },
    };
}
