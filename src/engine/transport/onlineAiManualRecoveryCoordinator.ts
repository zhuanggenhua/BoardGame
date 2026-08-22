import {
    buildAiDecisionContext,
    isManualSetupSelectionEnabledForSeat,
    shouldPlayerManuallyResolveSetupSelection,
    type AiLegalAction,
} from '../ai';
import type { MatchState } from '../types';
import type { GameEngineConfig } from './engineConfig';
import type { MatchMetadata } from './storage';
import type {
    ManualForceEndAiPhaseResult,
    ManualSetupSelectionRequest,
} from './protocol';
import {
    buildAiProgressMarker,
    resolveManualForceEndAiPhase,
    type ForceEndTurnStalledAiResolution,
} from './onlineAiRecovery';
import type { GameManifestIndex, OnlineAiWatchdogSeatController } from './onlineAiWatchdogSeatControllers';
import {
    normalizeOnlineAiWatchdogSeatControllerType,
    resolveRawOnlineAiWatchdogSeatControllers,
} from './onlineAiWatchdogSeatControllers';
import type { OnlineAiRecoveryTracker } from './onlineAiWatchdogTracker';

export type OnlineAiManualRecoveryMatch = {
    matchID: string;
    gameId: string;
    state: MatchState<unknown>;
    stateID: number;
    metadata: MatchMetadata;
    engineConfig: GameEngineConfig;
    unloaded: boolean;
};

export type OnlineAiManualRecoveryCoordinatorHooks<TMatch extends OnlineAiManualRecoveryMatch> = {
    buildSeatControllers: (match: TMatch) => Record<string, OnlineAiWatchdogSeatController>;
    isMatchExecuting: (match: TMatch) => boolean;
    isRecoveryInFlight: (matchId: string) => boolean;
    resolvePrivateOverlay: (match: TMatch, playerId: string) => MatchState<unknown>;
    executeManualSetupCommand: (args: {
        match: TMatch;
        playerId: string;
        commandType: string;
        commandPayload: unknown;
        expectedStateID: number;
    }) => Promise<boolean>;
    resolveRecoveryCandidate: (
        match: TMatch,
        seatControllers: Record<string, OnlineAiWatchdogSeatController>,
    ) => Promise<ForceEndTurnStalledAiResolution | null>;
    buildRecoveryFingerprint: (
        match: TMatch,
        candidate: ForceEndTurnStalledAiResolution,
        progressMarker: string,
    ) => string;
    clearTracker: (matchId: string) => void;
    setTracker: (matchId: string, tracker: OnlineAiRecoveryTracker) => void;
    beginInFlight: (matchId: string) => void;
    finishInFlight: (matchId: string) => void;
    runRecoverySequence: (args: {
        match: TMatch;
        tracker: OnlineAiRecoveryTracker;
        candidate: ForceEndTurnStalledAiResolution;
        progressMarker: string;
        seatControllers: Record<string, OnlineAiWatchdogSeatController>;
        options: { allowManualImmediateAiContinuation: true };
    }) => Promise<void>;
    hasRecoveryResolved: (
        match: TMatch,
        candidate: ForceEndTurnStalledAiResolution,
        seatControllers: Record<string, OnlineAiWatchdogSeatController>,
    ) => Promise<boolean>;
    now?: () => number;
};

export type OnlineAiManualRecoveryCoordinatorConfig<TMatch extends OnlineAiManualRecoveryMatch> = {
    rulesVersion: string | null;
    gameManifests: GameManifestIndex;
    hooks: OnlineAiManualRecoveryCoordinatorHooks<TMatch>;
};

export class OnlineAiManualRecoveryCoordinator<TMatch extends OnlineAiManualRecoveryMatch> {
    private readonly rulesVersion: string | null;
    private readonly gameManifests: GameManifestIndex;
    private readonly hooks: OnlineAiManualRecoveryCoordinatorHooks<TMatch>;

    constructor(config: OnlineAiManualRecoveryCoordinatorConfig<TMatch>) {
        this.rulesVersion = config.rulesVersion;
        this.gameManifests = config.gameManifests;
        this.hooks = config.hooks;
    }

    async handleManualSetupSelection(
        match: TMatch,
        requesterPlayerId: string,
        request: ManualSetupSelectionRequest,
    ): Promise<boolean> {
        const targetPlayerId = request.targetPlayerId.trim();
        const actionKind = request.actionKind.trim();
        const selectionId = request.selectionId.trim();
        if (!targetPlayerId || !actionKind || !selectionId) {
            return false;
        }
        if (!isAuthorizedManualAiSeatDispatch(match, requesterPlayerId, targetPlayerId)) {
            return false;
        }

        const rawSeatControllers = resolveRawOnlineAiWatchdogSeatControllers({
            state: match.state,
            setupData: match.metadata.setupData,
        });
        const rawController = rawSeatControllers?.[targetPlayerId];
        const controllerType = normalizeOnlineAiWatchdogSeatControllerType(
            match.gameId,
            rawController,
            this.gameManifests,
        );
        if (controllerType === 'human' || !isManualSetupSelectionEnabledForSeat(rawController)) {
            return false;
        }

        const controller: OnlineAiWatchdogSeatController = {
            ...(rawController && typeof rawController === 'object' ? rawController : {}),
            type: controllerType,
        } as OnlineAiWatchdogSeatController;
        const visibleState = this.hooks.resolvePrivateOverlay(match, targetPlayerId);
        const legalActions = buildAiDecisionContext({
            gameId: match.engineConfig.gameId,
            matchId: match.matchID,
            playerId: targetPlayerId,
            visibleState,
            rulesVersion: this.rulesVersion,
            decisionBudgetMs: 250,
            source: 'online',
        }).legalActions;
        const matchingActions = legalActions.filter((action) => (
            this.matchesManualSetupSelection({
                match,
                action,
                actionKind,
                selectionId,
                targetPlayerId,
                controller,
            })
        ));
        if (matchingActions.length !== 1) {
            return false;
        }

        const [command] = matchingActions[0].commands;
        return this.hooks.executeManualSetupCommand({
            match,
            playerId: targetPlayerId,
            commandType: command.type,
            commandPayload: command.payload,
            expectedStateID: match.stateID,
        });
    }

    async handleManualForceEndAiPhase(
        match: TMatch,
        requesterPlayerId: string,
    ): Promise<ManualForceEndAiPhaseResult> {
        const seatControllers = this.hooks.buildSeatControllers(match);
        if (!isAuthorizedManualOnlineAiRecoveryRequest(match, requesterPlayerId, seatControllers)) {
            return { accepted: false, reason: 'unauthorized' };
        }
        if (match.unloaded) {
            return { accepted: false, reason: 'unavailable' };
        }
        if (this.hooks.isMatchExecuting(match) || this.hooks.isRecoveryInFlight(match.matchID)) {
            return { accepted: false, reason: 'busy' };
        }

        const manualSeatStates: Record<string, MatchState<unknown> | null | undefined> = Object.fromEntries(
            Object.entries(seatControllers)
                .filter(([, controller]) => controller.type !== 'human')
                .map(([playerId]) => [playerId, this.hooks.resolvePrivateOverlay(match, playerId)]),
        );
        const candidate = resolveManualForceEndAiPhase({
            sharedState: match.state,
            seatControllers,
            seatStates: manualSeatStates,
            engineConfig: match.engineConfig,
            gameId: match.gameId,
        }) ?? await this.hooks.resolveRecoveryCandidate(match, seatControllers);
        if (!candidate) {
            this.hooks.clearTracker(match.matchID);
            return { accepted: false, reason: 'unavailable' };
        }

        const progressMarker = buildAiProgressMarker(match.state, {
            engineConfig: match.engineConfig,
            gameId: match.gameId,
        });
        const recoveryFingerprint = this.hooks.buildRecoveryFingerprint(match, candidate, progressMarker);
        const now = this.hooks.now?.() ?? Date.now();
        const tracker: OnlineAiRecoveryTracker = {
            key: `${candidate.playerId}:${candidate.reason}:${recoveryFingerprint}`,
            firstSeenAt: now,
            autoSubmittedAt: now,
            lastReportedFailureReason: null,
            failureCount: 0,
        };
        this.hooks.setTracker(match.matchID, tracker);
        this.hooks.beginInFlight(match.matchID);
        try {
            await this.hooks.runRecoverySequence({
                match,
                tracker,
                candidate,
                progressMarker,
                seatControllers,
                options: { allowManualImmediateAiContinuation: true },
            });
        } finally {
            this.hooks.finishInFlight(match.matchID);
        }

        const markerAfter = buildAiProgressMarker(match.state, {
            engineConfig: match.engineConfig,
            gameId: match.gameId,
        });
        const resolved = await this.hooks.hasRecoveryResolved(match, candidate, seatControllers);
        return resolved || markerAfter !== progressMarker
            ? { accepted: true }
            : { accepted: false, reason: 'rejected' };
    }

    private matchesManualSetupSelection(args: {
        match: TMatch;
        action: AiLegalAction;
        actionKind: string;
        selectionId: string;
        targetPlayerId: string;
        controller: OnlineAiWatchdogSeatController;
    }): boolean {
        const { match, action, actionKind, selectionId, targetPlayerId, controller } = args;
        if (action.kind !== actionKind || action.commands.length !== 1) {
            return false;
        }
        const configured = match.engineConfig.onlineAiRecovery?.shouldTreatActionAsManualSetupSelection?.({
            actionKind: action.kind,
            actionId: action.actionId,
            commandTypes: action.commands.map((command) => command.type),
        });
        const isManualSetupAction = configured ?? shouldPlayerManuallyResolveSetupSelection(
            match.engineConfig,
            match.state,
            targetPlayerId,
            controller,
            action,
        );
        return isManualSetupAction
            && resolveManualSetupSelectionIdFromAction(match.engineConfig, action) === selectionId;
    }
}

export function isAuthorizedManualAiSeatDispatch(
    match: OnlineAiManualRecoveryMatch,
    requesterPlayerId: string,
    targetPlayerId: string,
): boolean {
    const controllers = resolveRawOnlineAiWatchdogSeatControllers({
        state: match.state,
        setupData: match.metadata.setupData,
    });
    if (controllers?.[targetPlayerId]?.type === 'human') {
        return false;
    }
    const setupData = match.metadata.setupData;
    const ownerKey = setupData && typeof setupData === 'object' && !Array.isArray(setupData)
        ? (setupData as { ownerKey?: unknown }).ownerKey
        : undefined;
    const requesterOwnerKey = match.metadata.players[requesterPlayerId]?.ownerKey;
    return typeof ownerKey === 'string'
        && ownerKey.length > 0
        && requesterOwnerKey === ownerKey;
}

export function isAuthorizedManualOnlineAiRecoveryRequest(
    match: OnlineAiManualRecoveryMatch,
    requesterPlayerId: string,
    seatControllers: Record<string, OnlineAiWatchdogSeatController>,
): boolean {
    const hasAiSeat = Object.values(seatControllers).some((controller) => controller.type !== 'human');
    if (!hasAiSeat) {
        return false;
    }
    const setupData = match.metadata.setupData;
    const ownerKey = setupData && typeof setupData === 'object' && !Array.isArray(setupData)
        ? (setupData as { ownerKey?: unknown }).ownerKey
        : undefined;
    const requesterOwnerKey = match.metadata.players[requesterPlayerId]?.ownerKey;
    if (typeof ownerKey === 'string' && ownerKey.length > 0) {
        return requesterOwnerKey === ownerKey;
    }

    return requesterPlayerId === '0';
}

export function isManualSetupSelectionRequest(value: unknown): value is ManualSetupSelectionRequest {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }
    const request = value as Record<string, unknown>;
    return typeof request.targetPlayerId === 'string' && request.targetPlayerId.trim().length > 0
        && typeof request.actionKind === 'string' && request.actionKind.trim().length > 0
        && typeof request.selectionId === 'string' && request.selectionId.trim().length > 0;
}

export function resolveManualSetupSelectionIdFromAction(
    engineConfig: GameEngineConfig,
    action: AiLegalAction,
): string | null {
    const command = action.commands.length === 1 ? action.commands[0] : null;
    const configured = engineConfig.onlineAiRecovery?.resolveManualSetupSelectionIdFromAction?.({
        actionKind: action.kind,
        actionId: action.actionId,
        command,
    });
    if (configured !== undefined) {
        return typeof configured === 'string' && configured.trim().length > 0 ? configured : null;
    }
    if (!command?.payload || typeof command.payload !== 'object' || Array.isArray(command.payload)) {
        return null;
    }
    const payload = command.payload as Record<string, unknown>;
    if (action.kind === 'setup-select-character') {
        return typeof payload.characterId === 'string' ? payload.characterId : null;
    }
    if (action.kind === 'select-faction' || action.kind === 'setup-select-faction') {
        return typeof payload.factionId === 'string' ? payload.factionId : null;
    }
    return null;
}
