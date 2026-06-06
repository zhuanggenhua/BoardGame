/**
 * 游戏状态同步服务端
 *
 * 基于 socket.io 实现：
 * - 接收客户端命令 → 执行 pipeline → playerView 过滤 → 广播状态
 * - 管理玩家连接状态
 * - 内置离线交互裁决（断线 → graceMs → 自动 CANCEL_INTERACTION）
 */

import type { Server as IOServer, Socket as IOSocket } from 'socket.io';
import type { Command, DomainCore, GameEvent, MatchState, PlayerId, RandomFn } from '../types';
import type { EngineSystem, GameSystemsConfig } from '../systems/types';
import type {
    MatchStorage,
    StoredMatchState,
    MatchMetadata,
} from './storage';
import { isMatchAuthMetadataProvider } from './storage';
import type {
    MatchPlayerInfo,
    BatchDispatchMeta,
} from './protocol';
import type { TrainingDataRecorder, TrainingDecisionSample } from './trainingData';
import { buildTrainingDecisionSample } from './trainingData';
import logger, { gameLogger } from '../../../server/logger.js';
import * as aiModule from '../ai';
import {
    applyPlayerViewToState,
    buildAiDecisionContext,
    getAiSeatIds,
    getGameAiRuntime,
    resolveSeatPlayerDisplayName,
} from '../ai';
import { extractAiInteractionSnapshot, extractAiResponseWindowSnapshot } from '../ai/snapshots';
import type { AiInteractionSnapshot, AiResponseWindowSnapshot } from '../ai/types';
import {
    executePipeline,
    createSeededRandom,
    createInitialSystemState,
    type PipelineConfig,
} from '../pipeline';
import { INTERACTION_COMMANDS, INTERACTION_EVENTS } from '../systems/InteractionSystem';
import { setUndoAiSeatIds } from '../systems/UndoSystem';
import { computeDiff } from './patch';
import { resolveSetupPlayerIds } from './setupPlayerOrder';
import {
    buildAiProgressMarker,
    buildResponseWindowRecoveryFingerprintHint,
    resolveOnlineAiCurrentPlayerId,
    resolveForceEndTurnForStalledAi,
    shouldInspectSeatStatesForHiddenAiInteraction,
    shouldUseOnlineAiEmergencyOverlayFallback,
    type ForceEndTurnStalledAiResolution,
} from './onlineAiRecovery';
import {
    extractSetupSeatControllers,
    resolveOnlineAiWatchdogSeatControllers,
    type GameManifestIndex,
} from './onlineAiWatchdogSeatControllers';
import {
    applyOnlineAiRecoveryFailureToTracker,
    pruneExpiredOnlineAiCooldownEntries,
    type OnlineAiRecoveryTracker,
} from './onlineAiWatchdogTracker';
import {
    buildInteractionSelectabilityDiagnostic,
    resolveOnlineAiRecoveryBlockerFingerprint,
    buildOnlineAiFeedbackDiagnosticsContext,
    buildOnlineAiPendingDamageDiagnostic,
    buildOnlineAiWatchdogBlockerFingerprint,
    resolveUnsatisfiableReasonFromSelectability,
    type InteractionSelectabilityDiagnostic,
    type OnlineAiRecoveryPendingDamageDiagnostic,
} from './onlineAiWatchdogFeedbackDiagnostics';
import { resolveOnlineAiWatchdogSchedulingDecision } from './onlineAiWatchdogScheduling';
import {
    buildOnlineAiRecoveryTrackerSnapshot,
    buildOnlineAiRecoverySequenceStepKey,
    resolveOnlineAiRecoveryFingerprint,
} from './onlineAiWatchdogSequenceFingerprinting';
import {
    resolveChainedOnlineAiRecoveryCandidate,
    resolveRevalidatedOnlineAiRecoveryCandidateFromLiveState,
} from './onlineAiWatchdogCandidateValidation';
import { resolveOnlineAiWatchdogStepBookkeeping } from './onlineAiWatchdogStepBookkeeping';
import {
    shouldProbeOnlineAiLegalActionOnlyCandidateForHumanTurn,
} from './onlineAiWatchdogGameSemantics';
import {
    buildOnlineAiNoLegalActionRecoveryResult,
    buildOnlineAiRecoveryFailureFeedbackMetadata,
    buildOnlineAiRecoveryFollowUpRuntimeSnapshot,
    buildOnlineAiDecisionViewResolvers,
    createOnlineAiRecoveryForcedCommandProgress,
    createOnlineAiRecoverySequenceProgress,
    buildOnlineAiRecoveryStepAfterSnapshot,
    buildOnlineAiRecoveryStepBeforeSnapshot,
    dispatchOnlineAiWithResolvedSeatView,
    executeOnlineAiLegalActionRecoveryCommands,
    finalizeOnlineAiAppliedLegalActionRecovery,
    isOnlineAiPrivateOverlayBlockedReason,
    normalizeOnlineAiRecoveryExpectedLegalActionOnlyCandidate,
    resolveActiveTurnRecoveryResolved,
    resolveOnlineAiRecoveryCompletionFailureDispatchDecision,
    resolveOnlineAiRecoveryFailureDispatchDecision,
    resolveHiddenInteractionRecoveryResolved,
    resolveOnlineAiForcedRecoveryCommandDecisionFromRuntime,
    resolveOnlineAiForcedRecoveryFailureDispatchDecision,
    resolveOnlineAiHardCancelDecisionFromRuntime,
    resolveOnlineAiRecoveryBlockedFailureReason,
    resolveLegalOnlyRecoveryResolved,
    resolveOnlineAiRecoveryPhaseLabel,
    resolveOnlineAiRecoveryFollowUpTransitionFromRuntime,
    resolveOnlineAiRecoveryPauseDecision,
    resolveOnlineAiRecoverySuccessFeedbackDecision,
    recordOnlineAiForcedRecoveryAdvanceStep,
    recordOnlineAiForcedRecoveryCommandAttempt,
    recordOnlineAiRecoveryAppliedLegalAction,
    recordOnlineAiRecoveryStep,
    readHiddenInteractionRecoveryLiveState,
    readResponseWindowRecoveryLiveState,
    readVisibleInteractionRecoveryLiveState,
    resolveOnlineAiLegalActionDispatchDecision,
    resolveOnlineAiVisibleStateForPlayer,
    resolveResponseWindowRecoveryResolved,
    resolveVisibleInteractionRecoveryResolved,
    markOnlineAiRecoveryNaturalContinuation,
    shouldAttemptOnlineAiRecoveryHardCancel,
    syncOnlineAiRecoveryTrackerKey,
    type OnlineAiLegalActionRecoveryResult,
    type OnlineAiRecoveryForceCommandAllowanceResolver,
    type OnlineAiRecoveryForcedCommandProgress,
    type OnlineAiRecoverySequenceProgress,
    type OnlineAiRecoveryStepAfterSnapshot,
    type OnlineAiRecoveryStepBeforeSnapshot,
} from './onlineAiWatchdogSequenceHelpers';
import type { LocalPregameControlResolver } from './followCurrentTurnPlayer';
import { injectTutorialInteractionId } from './tutorialAiCommand';

// 离线裁决：shared 默认只保留通用交互的最小兜底命令。
// 游戏专属交互必须通过 engineConfig.onlineAiRecovery.offlineAdjudicationCommandByInteractionKind 注入，
// 避免 transport shared 长期携带旧游戏命令知识。
const OFFLINE_ADJUDICATION_COMMAND_BY_KIND: Record<string, string> = {
    'simple-choice': INTERACTION_COMMANDS.CANCEL,
};

const resolveOfflineAdjudicationCommandType = (
    kind: unknown,
    engineConfig?: Pick<GameEngineConfig, 'onlineAiRecovery'> | null,
): string => {
    if (typeof kind !== 'string') {
        return INTERACTION_COMMANDS.CANCEL;
    }
    const configured = engineConfig?.onlineAiRecovery?.offlineAdjudicationCommandByInteractionKind?.[kind];
    if (typeof configured === 'string' && configured.length > 0) {
        return configured;
    }
    return OFFLINE_ADJUDICATION_COMMAND_BY_KIND[kind] ?? INTERACTION_COMMANDS.CANCEL;
};

const ALLOWED_INJECT_STATE_ENVS = new Set(['test', 'development']);

const canInjectStateInCurrentEnv = (nodeEnv: string | undefined): boolean =>
    typeof nodeEnv === 'string' && ALLOWED_INJECT_STATE_ENVS.has(nodeEnv);

const DEFAULT_TRAINING_CAPTURE_POLICY = 'human-only' as const;
const DEFAULT_ONLINE_AI_RECOVERY_TICK_MS = 500;
const DEFAULT_ONLINE_AI_RECOVERY_TIMEOUT_MS = 8000;
const DEFAULT_ONLINE_AI_RECOVERY_MAX_ADVANCE_STEPS = 16;
const DEFAULT_ONLINE_AI_RECOVERY_FEEDBACK_COOLDOWN_MS = 60_000;
const DEFAULT_ONLINE_AI_RECOVERY_FAILURE_REPORT_THRESHOLD = 2;
const DEFAULT_ONLINE_AI_OVERLAY_RESYNC_COOLDOWN_MS = 1_500;
const DEFAULT_COMMAND_FAILURE_FEEDBACK_COOLDOWN_MS = 60_000;
const MAX_ONLINE_AI_RECOVERY_LEGAL_ACTIONS = 8;

function resolveSeatControllerTypeForTraining(
    seatControllers: Record<string, { type?: unknown } | undefined> | undefined,
    playerId: string,
): 'human' | 'local-ai' | 'remote-ai' {
    const type = seatControllers?.[playerId]?.type;
    return type === 'local-ai' || type === 'remote-ai' ? type : 'human';
}

type OnlineAiRecoveryFeedbackPayload = {
    matchId: string;
    gameId: string;
    playerId: string;
    incidentKind:
        | 'force-end-turn-success'
        | 'force-end-turn-failed'
        | 'unsatisfiable-interaction-auto-skipped'
        | 'legal-action-recovered';
    severity: 'medium' | 'high';
    status?: 'open' | 'resolved';
    reason: string;
    trackerKey: string;
    progressMarker: string;
    stateSnapshot: string;
    actionLog?: string;
};

type CommandFailureFeedbackPayload = {
    matchId: string;
    gameId: string;
    playerId: string;
    incidentKind: 'command-failed';
    severity: 'medium' | 'high';
    commandType: string;
    reason: string;
    incidentKey: string;
    progressMarker: string;
    stateSnapshot: string;
    actionLog?: string;
};

type PendingTrainingSamples = {
    matchId: string;
    gameId: string;
    samples: TrainingDecisionSample[];
};

const UNSATISFIABLE_INTERACTION_REASONS = new Set([
    'empty-options',
    'all-options-disabled',
    'min-selection-unreachable',
]);

type OnlineAiRecoveryLegalActionSummary = {
    total: number;
    truncated: boolean;
    items: Array<{
        actionId: string;
        kind: string;
        label: string;
        commandTypes: string[];
    }>;
};

type OnlineAiRecoveryDecisionPreview = {
    previewSource: 'seat-policy' | 'remote-fallback-policy';
    policyId: string;
    chosenAction: {
        actionId: string;
        kind: string;
        label: string;
        commandTypes: string[];
    } | null;
    reasoningSummary: string | null;
    confidence: number | null;
    error: string | null;
};

type OnlineAiRecoveryAiSummary = {
    seatControllerType: 'human' | 'local-ai' | 'remote-ai';
    legalActions: OnlineAiRecoveryLegalActionSummary | null;
    decisionPreview: OnlineAiRecoveryDecisionPreview | null;
};

type OnlineAiRecoveryActionLogTailEntry = {
    text?: string;
    type?: unknown;
};

type OnlineAiRecoveryEventTailEntry = {
    type?: string;
    timestamp?: unknown;
    payload?: unknown;
};

type OnlineAiRecoveryHardCancelContinuation =
    | {
        kind: 'not-cancelled' | 'chain-ended';
    }
    | {
        kind: 'continue-with-candidate';
        candidate: ForceEndTurnStalledAiResolution;
    };

type OnlineAiRecoveryPhaseLabel = 'recover-interaction' | 'follow-up-advance';

type OnlineAiRecoverySequenceState = {
    tracker: OnlineAiRecoveryTracker;
    currentCandidate: ForceEndTurnStalledAiResolution;
    forcedCommandProgress: OnlineAiRecoveryForcedCommandProgress;
};

type OnlineAiRecoveryRuntimeBase = {
    matchId: string;
    gameId: string;
    engineConfig: GameEngineConfig;
    readState: () => MatchState<unknown>;
    resolveLatestCandidate: () => Promise<ForceEndTurnStalledAiResolution | null>;
    resolvePrivateOverlay: (playerId: string) => MatchState<unknown>;
    resolveForceCommandAllowance: OnlineAiRecoveryForceCommandAllowanceResolver;
    seatControllers: Record<string, OnlineAiWatchdogSeatController>;
    executeSuppressedCommand: (
        playerId: string,
        commandType: string,
        commandPayload: unknown,
    ) => Promise<{
        success: boolean;
        commandFailureReason?: string | null;
    }>;
    broadcastState: () => void;
    requestOverlayResync: (args: {
        playerId: string;
        blockedReason: 'missing-private-overlay' | 'stale-private-overlay';
        blockedKey: string;
        progressMarker: string;
    }) => void;
    clearStoredTracker: () => void;
};

type OnlineAiRecoverySequenceRuntime = OnlineAiRecoveryRuntimeBase & {
    readHasLiveSeatConnection: (playerId: string) => boolean;
    tryRecoverLegalAction: (
        candidate: ForceEndTurnStalledAiResolution,
        tracker: OnlineAiRecoveryTracker,
    ) => Promise<OnlineAiLegalActionRecoveryResult>;
    readLastCommandFailureReason: () => string | null;
    reportFailure: (
        candidate: ForceEndTurnStalledAiResolution,
        phaseLabel: OnlineAiRecoveryPhaseLabel,
        reason: string,
    ) => Promise<void>;
    executeCommand: (playerId: string, commandType: string, commandPayload: unknown) => Promise<boolean>;
    reportRecoveryFeedbackWithDiagnostics: (args: {
        candidate: ForceEndTurnStalledAiResolution;
        metadata: OnlineAiRecoveryResolvedFeedbackMetadata;
        failureReason?: string;
    }) => Promise<void>;
};

type OnlineAiRecoveryIncidentState = {
    rootCandidate: ForceEndTurnStalledAiResolution;
    progressMarkerBeforeRecovery: string;
};

type OnlineAiRecoverySequenceContext = {
    incident: OnlineAiRecoveryIncidentState;
    sequenceState: OnlineAiRecoverySequenceState;
    runtime: OnlineAiRecoverySequenceRuntime;
};

type OnlineAiRecoveryUnappliedStepResult =
    | {
        kind: 'paused' | 'failed';
    }
    | {
        kind: 'continue';
        executedCommandType: string;
    };

type OnlineAiRecoveryPostStepProgression =
    | {
        kind: 'stop' | 'break' | 'natural-continuation';
    }
    | {
        kind: 'continue-with-candidate';
        candidate: ForceEndTurnStalledAiResolution;
    };

type OnlineAiRecoveryLoopBootstrap = {
    sequenceProgress: OnlineAiRecoverySequenceProgress;
    seenStepKeys: Set<string>;
};

type OnlineAiRecoveryLoopIterationResult = {
    kind: 'stop' | 'break' | 'continue';
    sequenceProgress: OnlineAiRecoverySequenceProgress;
};

type OnlineAiRecoveryHandleUnappliedStepArgs = {
    currentCandidate: ForceEndTurnStalledAiResolution;
    actionRecovery: OnlineAiLegalActionRecoveryResult;
    blockedFailureReason: ReturnType<typeof resolveOnlineAiRecoveryBlockedFailureReason>;
};

type OnlineAiRecoveryAdvanceAfterStepArgs = {
    currentCandidate: ForceEndTurnStalledAiResolution;
    beforeStepSnapshot: OnlineAiRecoveryStepBeforeSnapshot;
    afterStepSnapshot: OnlineAiRecoveryStepAfterSnapshot;
    actionRecoveryApplied: boolean;
    executedCommandTypes: Set<string>;
    seenStepKeys: Set<string>;
    stepBookkeepingDecision: ReturnType<typeof resolveOnlineAiWatchdogStepBookkeeping>;
};

type OnlineAiRecoveryLoopIterationArgs = {
    sequenceProgress: OnlineAiRecoverySequenceProgress;
    seenStepKeys: Set<string>;
};

type OnlineAiRecoveryResolutionRuntime = Pick<
    OnlineAiRecoveryRuntimeBase,
    'readState' | 'resolveLatestCandidate' | 'resolvePrivateOverlay' | 'seatControllers'
>;

const isEmergencySkipOnlySelectability = (
    diagnostic: InteractionSelectabilityDiagnostic | null | undefined,
): boolean => {
    if (!diagnostic) {
        return false;
    }
    return diagnostic.totalOptions === 1
        && diagnostic.enabledOptions === 1
        && diagnostic.disabledOptions === 0
        && diagnostic.selectionState === 'recoverable-option-available'
        && diagnostic.enabledOptionIds[0] === '__emergency_skip__';
};

const shouldSuppressUnsatisfiableInteractionFeedback = (args: {
    engineConfig?: Pick<GameEngineConfig, 'onlineAiRecovery'> | null;
    sharedInteraction: AiInteractionSnapshot | null | undefined;
    seatInteraction: AiInteractionSnapshot | null | undefined;
}): boolean => {
    const sharedSelectability = buildInteractionSelectabilityDiagnostic(args.sharedInteraction);
    if (isEmergencySkipOnlySelectability(sharedSelectability)) {
        return true;
    }

    const seatSelectability = buildInteractionSelectabilityDiagnostic(args.seatInteraction);
    return args.engineConfig?.onlineAiRecovery?.shouldSuppressUnsatisfiableInteractionFeedback?.({
        sharedInteraction: args.sharedInteraction ?? null,
        seatInteraction: args.seatInteraction ?? null,
        sharedSelectability: sharedSelectability ?? null,
        seatSelectability: seatSelectability ?? null,
    }) === true;
};

const shouldTranslateAiEmergencySkipToCancel = (payload: unknown): boolean => {
    if (!payload || typeof payload !== 'object') {
        return false;
    }

    const candidate = payload as {
        optionId?: unknown;
        optionIds?: unknown;
        mergedValue?: unknown;
    };
    if (candidate.optionId === '__emergency_skip__') {
        return true;
    }
    if (
        Array.isArray(candidate.optionIds)
        && candidate.optionIds.length === 1
        && candidate.optionIds[0] === '__emergency_skip__'
    ) {
        return true;
    }

    const mergedValue = candidate.mergedValue as { __emergency_skip__?: unknown } | undefined;
    return mergedValue?.__emergency_skip__ === true;
};

const resolveAiEmergencySkipCancelPayload = (
    preCommandSeatState: MatchState<unknown>,
    payload: unknown,
): { interactionId?: string; reason?: string } | null => {
    if (!shouldTranslateAiEmergencySkipToCancel(payload)) {
        return null;
    }

    const interaction = extractAiInteractionSnapshot(preCommandSeatState);
    if (!interaction) {
        return null;
    }

    const payloadInteractionId = payload && typeof payload === 'object'
        ? (payload as { interactionId?: unknown }).interactionId
        : undefined;
    if (
        typeof payloadInteractionId === 'string'
        && typeof interaction.id === 'string'
        && payloadInteractionId !== interaction.id
    ) {
        return null;
    }

    const options = Array.isArray(interaction.options) ? interaction.options : [];
    const emergencyOption = options.find((option) => option.id === '__emergency_skip__' && option.disabled !== true);
    if (!emergencyOption) {
        return null;
    }

    const reasonFromOption = emergencyOption.value
        && typeof emergencyOption.value === 'object'
        ? (emergencyOption.value as { __emergency_skip_reason__?: unknown }).__emergency_skip_reason__
        : undefined;
    const reason = typeof reasonFromOption === 'string'
        ? reasonFromOption
        : resolveUnsatisfiableReasonFromSelectability(interaction) ?? 'empty-options';

    return {
        interactionId: typeof interaction.id === 'string' ? interaction.id : undefined,
        reason,
    };
};

const summarizeOnlineAiRecoveryLegalActions = (
    legalActions: ReturnType<typeof buildAiDecisionContext>['legalActions'],
): OnlineAiRecoveryLegalActionSummary => ({
    total: legalActions.length,
    truncated: legalActions.length > MAX_ONLINE_AI_RECOVERY_LEGAL_ACTIONS,
    items: legalActions.slice(0, MAX_ONLINE_AI_RECOVERY_LEGAL_ACTIONS).map((action) => ({
        actionId: action.actionId,
        kind: action.kind,
        label: action.label,
        commandTypes: action.commands.map((command) => command.type),
    })),
});

const INTERNAL_FEEDBACK_PATH = '/internal/feedback/system';

const normalizeInternalFeedbackEndpoint = (candidate: string): string | null => {
    const trimmed = candidate.trim().replace(/\/$/, '');
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        return null;
    }
    if (trimmed.includes('/internal/feedback/system')) {
        return trimmed;
    }
    if (trimmed.endsWith('/feedback')) {
        return `${trimmed.replace(/\/feedback$/, '')}${INTERNAL_FEEDBACK_PATH}`;
    }
    return `${trimmed}${INTERNAL_FEEDBACK_PATH}`;
};

const resolveOnlineAiFeedbackEndpoint = (): string | null => {
    const rawCandidates = [
        process.env.FEEDBACK_INTERNAL_API_URL,
        process.env.FEEDBACK_API_URL,
        process.env.VITE_FEEDBACK_API_URL,
        process.env.VITE_BACKEND_URL ? `${process.env.VITE_BACKEND_URL.replace(/\/$/, '')}/feedback` : null,
        process.env.BACKEND_URL ? `${process.env.BACKEND_URL.replace(/\/$/, '')}/feedback` : null,
        process.env.API_SERVER_PORT ? `http://127.0.0.1:${process.env.API_SERVER_PORT}/feedback` : null,
        'http://127.0.0.1:18001/feedback',
    ];
    for (const candidate of rawCandidates) {
        if (!candidate) continue;
        const normalized = normalizeInternalFeedbackEndpoint(candidate);
        if (normalized) return normalized;
    }
    return null;
};

type OnlineAiFeedbackConfig = {
    endpoint: string | null;
    token: string | null;
    disabledReason?: 'missing-endpoint' | 'missing-token';
};

const resolveOnlineAiFeedbackConfig = (): OnlineAiFeedbackConfig => {
    const endpoint = resolveOnlineAiFeedbackEndpoint();
    if (!endpoint) {
        return { endpoint: null, token: null, disabledReason: 'missing-endpoint' };
    }
    const token = process.env.INTERNAL_FEEDBACK_TOKEN;
    const hasExplicitEndpoint = Boolean(process.env.FEEDBACK_INTERNAL_API_URL || process.env.FEEDBACK_API_URL);
    if (!token) {
        const message = '[GameTransport] INTERNAL_FEEDBACK_TOKEN 未配置，已禁用在线 AI 自动反馈';
        if (process.env.NODE_ENV === 'production' || hasExplicitEndpoint) {
            throw new Error(message);
        }
        logger.error(message, { endpoint });
        return { endpoint: null, token: null, disabledReason: 'missing-token' };
    }
    return { endpoint, token };
};

const ONLINE_AI_FEEDBACK_CONFIG = resolveOnlineAiFeedbackConfig();
const ONLINE_AI_FEEDBACK_PERSISTENCE_SUPPRESSED_KINDS = new Set<OnlineAiRecoveryFeedbackPayload['incidentKind']>([
    'force-end-turn-success',
    'legal-action-recovered',
]);

function shouldAutoReportCommandFailure(reason: string): boolean {
    return reason === GENERIC_COMMAND_FAILURE_REASON
        || reason === PIPELINE_FAILURE_REASON
        || reason.startsWith(`${PIPELINE_FAILURE_REASON}:`);
}

function resolveCommandFailureFeedbackSeverity(reason: string): CommandFailureFeedbackPayload['severity'] {
    return reason === GENERIC_COMMAND_FAILURE_REASON ? 'medium' : 'high';
}

function emitOnlineAiBatchTrace(stage: string, payload: Record<string, unknown>): void {
    if (process.env.NODE_ENV === 'production') {
        return;
    }
    console.log('[ONLINE_AI_BATCH_TRACE]', { stage, ...payload });
}

// ============================================================================
// 游戏引擎定义
// ============================================================================

/**
 * 游戏引擎配置
 *
 * 每个游戏注册一个 GameEngineConfig，由 GameTransportServer 统一管理。
 */
export interface GameEngineConfig<
    TCore = unknown,
    TCommand extends Command = Command,
    TEvent extends GameEvent = GameEvent,
> {
    /** 游戏 ID */
    gameId: string;
    /** 领域内核 */
    domain: DomainCore<TCore, TCommand, TEvent>;
    /** 启用的系统 */
    systems: EngineSystem<TCore>[];
    /** 系统配置 */
    systemsConfig?: GameSystemsConfig;
    /** 命令类型列表 */
    commandTypes?: string[];
    /** 玩家数量范围 */
    minPlayers?: number;
    maxPlayers?: number;
    /** 是否禁用撤销 */
    disableUndo?: boolean;
    /** 本地模式开局阶段由游戏声明是否需要代控某个 seat */
    resolveLocalPregameControlledPlayerId?: LocalPregameControlResolver;
    /** 在线 AI watchdog 的游戏级恢复策略 */
    onlineAiRecovery?: {
        advancePhaseCommandType?: string;
        disableFallbackAdvancePhase?: boolean;
        publicPregameLegalActionPhases?: string[];
        humanTurnLegalActionProbePhases?: string[];
        autoSelectFirstTriggerOnlySimpleChoiceSourceIds?: string[];
        resolveCurrentPlayerId?: (args: {
            state: MatchState<unknown>;
            phase: string;
            fallbackPlayerId: string | null;
        }) => string | null;
        resolveManualSetupSelectionTakeoverPlayerId?: (args: {
            sharedState: MatchState<unknown>;
            currentPlayerId: string | null;
            seatControllers: Record<string, {
                type?: unknown;
                manualFactionSelection?: unknown;
            } | undefined>;
            hasManualDispatch: boolean;
        }) => string | null | undefined;
        shouldReleaseManualSetupAttemptFromSharedState?: (args: {
            sharedState: MatchState<unknown>;
            playerId: string;
            actionKind: 'select-faction' | 'setup-select-faction' | 'setup-select-character';
            selectionId: string;
        }) => boolean | undefined;
        resolveManualSetupSelectionActionKindFromCommand?: (args: {
            type: string;
            payload: unknown;
        }) => 'select-faction' | 'setup-select-faction' | 'setup-select-character' | null | undefined;
        resolveManualSetupSelectionId?: (args: {
            actionKind: 'select-faction' | 'setup-select-faction' | 'setup-select-character';
            payload: unknown;
        }) => string | null | undefined;
        buildInteractionRecoveryFingerprintHint?: (args: {
            state: MatchState<unknown>;
            playerId: string;
            phase: string;
            interaction: {
                id?: unknown;
                kind?: unknown;
                data?: Record<string, unknown> | undefined;
            };
            fallbackFingerprintHint: string;
        }) => string | null;
        resolveForcedInteractionCommand?: (args: {
            state: MatchState<unknown>;
            playerId: string;
            interaction: {
                id?: unknown;
                kind?: unknown;
                data?: {
                    options?: unknown;
                    confirmValue?: unknown;
                    sourceId?: unknown;
                } | undefined;
            };
            reason: 'hidden-interaction' | 'visible-interaction';
        }) => {
            type: string;
            payload: Record<string, unknown>;
        } | null;
        resolveSeatLegalOnlyRecovery?: (args: {
            state: MatchState<unknown>;
            phase: string;
        }) => {
            playerId: string;
            fingerprintHint: string;
            attemptSuffix?: string;
            command: {
                type: string;
                payload: Record<string, unknown>;
            };
        } | null;
        shouldSuppressActiveTurnCandidate?: (args: {
            state: MatchState<unknown>;
            phase: string;
            currentPlayerId: string;
            turnNumber: number | null;
        }) => boolean;
        shouldSuppressUnsatisfiableInteractionFeedback?: (args: {
            sharedInteraction: AiInteractionSnapshot | null;
            seatInteraction: AiInteractionSnapshot | null;
            sharedSelectability: InteractionSelectabilityDiagnostic | null;
            seatSelectability: InteractionSelectabilityDiagnostic | null;
        }) => boolean;
        offlineAdjudicationCommandByInteractionKind?: Record<string, string>;
        allowForceCommandAfterLegalActionExhausted?: (args: {
            state: MatchState<unknown>;
            phase: string;
            previousCandidate: ForceEndTurnStalledAiResolution;
            nextCandidate: ForceEndTurnStalledAiResolution;
        }) => boolean;
    };
}

// ============================================================================
// 内部类型
// ============================================================================

/** 运行中的对局上下文 */
interface ActiveMatch {
    matchID: string;
    gameId: string;
    engineConfig: GameEngineConfig;
    state: MatchState<unknown>;
    metadata: MatchMetadata;
    randomSeed: string;
    random: RandomFn;
    getRandomCursor: () => number;
    playerIds: PlayerId[];
    /** 状态版本号（每次命令执行后递增） */
    stateID: number;
    /** 玩家 socket 连接索引：playerID → Set<socketId> */
    connections: Map<string, Set<string>>;
    /** 旁观者 socket 集合 */
    spectatorSockets: Set<string>;
    /** 离线裁决定时器：playerID → timer */
    offlineTimers: Map<string, ReturnType<typeof setTimeout>>;
    /** 每个玩家/旁观者上次广播的 ViewState 缓存，用于 diff 计算 */
    lastBroadcastedViews: Map<string, unknown>;
    /** 最后执行命令的玩家 ID（供 broadcastState 携带到 meta，乐观引擎用于区分自己/对手的命令） */
    lastCommandPlayerId: string | null;
    /** 命令执行锁（串行执行） */
    executing: boolean;
    /** 待执行命令队列（普通命令 + batch 任务共用同一队列保证串行） */
    commandQueue: Array<{
        commandType: string;
        payload: unknown;
        playerID: string;
        options?: ExecuteCommandInternalOptions;
        resolve: (success: boolean) => void;
    } | {
        /** batch 任务标记 */
        _batch: true;
        execute: () => Promise<void>;
        resolve: (success: boolean) => void;
    }>;
    /** 最近一次 executeCommandInternal 失败的真实原因，供 batch 回滚后透传给客户端。 */
    lastCommandFailureReason: string | null;
}

type ExecuteCommandInternalOptions = {
    suppressBroadcast?: boolean;
    reportFailureFeedback?: boolean;
};

const GENERIC_COMMAND_FAILURE_REASON = 'command_failed';
const PIPELINE_FAILURE_REASON = 'pipeline_error';
const MAX_COMMAND_FAILURE_REASON_LENGTH = 500;

function truncateCommandFailureReason(reason: string): string {
    if (reason.length <= MAX_COMMAND_FAILURE_REASON_LENGTH) {
        return reason;
    }
    return `${reason.slice(0, MAX_COMMAND_FAILURE_REASON_LENGTH)}...`;
}

function formatPipelineFailureReason(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    const trimmed = message.trim();
    if (!trimmed) {
        return PIPELINE_FAILURE_REASON;
    }
    return truncateCommandFailureReason(`${PIPELINE_FAILURE_REASON}: ${trimmed}`);
}

function normalizeCommandFailureReason(reason: unknown): string {
    if (typeof reason !== 'string') {
        return GENERIC_COMMAND_FAILURE_REASON;
    }
    const trimmed = reason.trim();
    return trimmed.length > 0 ? truncateCommandFailureReason(trimmed) : GENERIC_COMMAND_FAILURE_REASON;
}

function formatOnlineAiCommandFailureReason(
    reason: string,
    commandType?: string | null,
    commandFailureReason?: string | null,
): string {
    const parts = [reason];
    const normalizedCommandType = typeof commandType === 'string' && commandType.trim().length > 0
        ? commandType.trim()
        : null;
    if (normalizedCommandType) {
        parts.push(normalizedCommandType);
    }

    const normalizedFailureReason = typeof commandFailureReason === 'string' && commandFailureReason.trim().length > 0
        ? commandFailureReason.trim()
        : null;
    if (normalizedFailureReason && normalizedFailureReason !== reason) {
        parts.push(normalizedFailureReason);
    }

    return truncateCommandFailureReason(parts.join(':'));
}

/** socket 关联信息 */
interface SocketInfo {
    matchID: string;
    playerID: string | null;
    credentials?: string;
}

const resolveStoredRandomSeed = (
    state: StoredMatchState,
    matchID: string,
): string => {
    const storedSeed = (state as { randomSeed?: unknown }).randomSeed;
    return typeof storedSeed === 'string' && storedSeed.length > 0 ? storedSeed : matchID;
};

const resolveStoredRandomCursor = (state: StoredMatchState): number => {
    const storedCursor = (state as { randomCursor?: unknown }).randomCursor;
    if (typeof storedCursor !== 'number' || !Number.isFinite(storedCursor) || storedCursor < 0) {
        return 0;
    }
    return Math.floor(storedCursor);
};

const isPlainRecord = (value: unknown): value is Record<string, unknown> => (
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const looksLikeLegacyCoreState = (value: Record<string, unknown>): boolean => (
    'players' in value
    || 'activePlayerId' in value
    || 'hostPlayerId' in value
    || 'currentPlayer' in value
    || 'currentPlayerIndex' in value
    || 'selectedCharacters' in value
);

const rehydrateStoredMatchState = (
    matchID: string,
    engineConfig: GameEngineConfig,
    storedState: unknown,
    playerIds: PlayerId[],
): MatchState<unknown> => {
    const fallbackSys = createInitialSystemState(
        playerIds,
        engineConfig.systems as EngineSystem[],
        matchID,
    );

    if (isPlainRecord(storedState)) {
        const rawCore = isPlainRecord(storedState.core) ? storedState.core : null;
        const rawSys = isPlainRecord(storedState.sys) ? storedState.sys : null;

        if (rawCore) {
            if (!rawSys) {
                logger.warn('[GameTransport] rehydrating match state without sys wrapper', {
                    matchID,
                    gameId: engineConfig.gameId,
                });
            }
            return {
                core: rawCore,
                sys: rawSys ?? fallbackSys,
            };
        }

        if (looksLikeLegacyCoreState(storedState)) {
            logger.warn('[GameTransport] rehydrating legacy bare core state', {
                matchID,
                gameId: engineConfig.gameId,
            });
            return {
                core: storedState,
                sys: fallbackSys,
            };
        }
    }

    return {
        core: {},
        sys: fallbackSys,
    };
};

const createTrackedRandom = (seed: string, initialCursor = 0): { random: RandomFn; getCursor: () => number } => {
    const base = createSeededRandom(seed);
    const normalizedCursor = Number.isFinite(initialCursor) && initialCursor > 0
        ? Math.floor(initialCursor)
        : 0;

    for (let i = 0; i < normalizedCursor; i++) {
        base.random();
    }

    let cursor = normalizedCursor;

    return {
        random: {
            random: () => {
                cursor += 1;
                return base.random();
            },
            d: (max: number) => {
                cursor += 1;
                return Math.floor(base.random() * max) + 1;
            },
            range: (min: number, max: number) => {
                cursor += 1;
                return Math.floor(base.random() * (max - min + 1)) + min;
            },
            shuffle: <T>(array: T[]): T[] => {
                cursor += Math.max(0, array.length - 1);
                // Fisher-Yates shuffle
                const result = [...array];
                for (let i = result.length - 1; i > 0; i--) {
                    const j = Math.floor(base.random() * (i + 1));
                    [result[i], result[j]] = [result[j], result[i]];
                }
                return result;
            },
            getCursor: () => cursor,
        },
        getCursor: () => cursor,
    };
};

// ============================================================================
// GameTransportServer
// ============================================================================

export interface GameTransportServerConfig {
    /** socket.io 服务器实例 */
    io: IOServer;
    /** 存储层 */
    storage: MatchStorage;
    /** 注册的游戏引擎 */
    games: GameEngineConfig[];
    /** 离线裁决宽限期（毫秒），默认 30000 */
    offlineGraceMs?: number;
    /** 认证回调（可选） */
    authenticate?: (
        matchID: string,
        playerID: string,
        credentials: string | undefined,
        metadata: MatchMetadata,
    ) => boolean | Promise<boolean>;
    /** 游戏结束回调（可选） */
    onGameOver?: (matchID: string, gameName: string, gameover: unknown) => void;
    trainingDataRecorder?: TrainingDataRecorder;
    trainingDataMinMatchDurationMs?: number;
    rulesVersion?: string | null;
    gameManifests?: GameManifestIndex;
    onlineAiRecoveryTickMs?: number;
    onlineAiRecoveryTimeoutMs?: number;
    onlineAiRecoveryMaxAdvanceSteps?: number;
    onlineAiRecoveryFeedbackCooldownMs?: number;
    onlineAiRecoveryFailureReportThreshold?: number;
    onlineAiFeedbackReporter?: (payload: OnlineAiRecoveryFeedbackPayload) => Promise<void>;
    commandFailureFeedbackCooldownMs?: number;
    commandFailureFeedbackReporter?: (payload: CommandFailureFeedbackPayload) => Promise<void>;
}

export class GameTransportServer {
    private readonly io: IOServer;
    private readonly storage: MatchStorage;
    private readonly gameIndex: Map<string, GameEngineConfig>;
    private readonly activeMatches: Map<string, ActiveMatch>;
    private readonly socketIndex: Map<string, SocketInfo>;
    private readonly offlineGraceMs: number;
    private readonly authenticate?: GameTransportServerConfig['authenticate'];
    private readonly onGameOver?: GameTransportServerConfig['onGameOver'];
    private readonly trainingDataRecorder?: TrainingDataRecorder;
    private readonly trainingDataMinMatchDurationMs: number;
    private readonly rulesVersion: string | null;
    private readonly gameManifests: GameManifestIndex;
    private readonly onlineAiRecoveryTickMs: number;
    private readonly onlineAiRecoveryTimeoutMs: number;
    private readonly onlineAiRecoveryMaxAdvanceSteps: number;
    private readonly onlineAiRecoveryFeedbackCooldownMs: number;
    private readonly onlineAiRecoveryFailureReportThreshold: number;
    private readonly onlineAiFeedbackReporter?: GameTransportServerConfig['onlineAiFeedbackReporter'];
    private readonly commandFailureFeedbackCooldownMs: number;
    private readonly commandFailureFeedbackReporter?: GameTransportServerConfig['commandFailureFeedbackReporter'];
    private readonly onlineAiRecoveryTrackers = new Map<string, OnlineAiRecoveryTracker>();
    private readonly onlineAiRecoveryFeedbackCooldown = new Map<string, number>();
    private readonly commandFailureFeedbackCooldown = new Map<string, number>();
    private readonly onlineAiOverlayResyncCooldown = new Map<string, number>();
    private readonly onlineAiRecoveryInFlight = new Set<string>();
    private onlineAiRecoveryTimer: ReturnType<typeof setInterval> | null = null;
    private readonly pendingTrainingSamples = new Map<string, PendingTrainingSamples>();
    private readonly eligibleTrainingMatches = new Set<string>();

    constructor(config: GameTransportServerConfig) {
        this.io = config.io;
        this.storage = config.storage;
        this.gameIndex = new Map(config.games.map((g) => [g.gameId, g]));
        this.activeMatches = new Map();
        this.socketIndex = new Map();
        this.offlineGraceMs = config.offlineGraceMs ?? 30000;
        this.authenticate = config.authenticate;
        this.onGameOver = config.onGameOver;
        this.trainingDataRecorder = config.trainingDataRecorder;
        this.trainingDataMinMatchDurationMs = Number.isFinite(config.trainingDataMinMatchDurationMs ?? 0)
            ? Math.max(0, config.trainingDataMinMatchDurationMs ?? 0)
            : 0;
        this.rulesVersion = config.rulesVersion ?? null;
        this.gameManifests = config.gameManifests ?? {};
        this.onlineAiRecoveryTickMs = config.onlineAiRecoveryTickMs ?? DEFAULT_ONLINE_AI_RECOVERY_TICK_MS;
        this.onlineAiRecoveryTimeoutMs = config.onlineAiRecoveryTimeoutMs ?? DEFAULT_ONLINE_AI_RECOVERY_TIMEOUT_MS;
        this.onlineAiRecoveryMaxAdvanceSteps = config.onlineAiRecoveryMaxAdvanceSteps ?? DEFAULT_ONLINE_AI_RECOVERY_MAX_ADVANCE_STEPS;
        this.onlineAiRecoveryFeedbackCooldownMs = config.onlineAiRecoveryFeedbackCooldownMs ?? DEFAULT_ONLINE_AI_RECOVERY_FEEDBACK_COOLDOWN_MS;
        this.onlineAiRecoveryFailureReportThreshold = config.onlineAiRecoveryFailureReportThreshold ?? DEFAULT_ONLINE_AI_RECOVERY_FAILURE_REPORT_THRESHOLD;
        this.onlineAiFeedbackReporter = config.onlineAiFeedbackReporter;
        this.commandFailureFeedbackCooldownMs = config.commandFailureFeedbackCooldownMs ?? DEFAULT_COMMAND_FAILURE_FEEDBACK_COOLDOWN_MS;
        this.commandFailureFeedbackReporter = config.commandFailureFeedbackReporter;
    }

    /** 启动传输层，监听 /game namespace */
    start(): void {
        const nsp = this.io.of('/game');

        nsp.on('connection', (socket: IOSocket) => {
            socket.on('sync', async (
                matchID: string,
                playerID: string | null,
                credentials?: string,
            ) => {
                if (!matchID) return;
                await this.handleSync(socket, matchID, playerID, credentials);
            });

            socket.on('command', async (
                matchID: string,
                commandType: string,
                payload: unknown,
                credentials?: string,
            ) => {
                if (!matchID || !commandType) return;
                const info = this.socketIndex.get(socket.id);
                if (!info || info.matchID !== matchID || !info.playerID) return;
                const authorized = await this.validateCommandAuth(matchID, info.playerID, info.credentials ?? credentials);
                if (!authorized) {
                    socket.emit('error', matchID, 'unauthorized');
                    return;
                }
                // 教程 AI 命令：payload 中携带 __tutorialPlayerId 时，以该 ID 作为执行者
                // 仅在教程模式激活时生效，防止普通玩家伪造 playerId
                const payloadRecord = payload && typeof payload === 'object' ? payload as Record<string, unknown> : null;
                const tutorialOverrideId = typeof payloadRecord?.__internalPlayerId === 'string'
                    ? payloadRecord.__internalPlayerId
                    : typeof payloadRecord?.__tutorialPlayerId === 'string'
                        ? payloadRecord.__tutorialPlayerId
                    : undefined;
                const match = this.activeMatches.get(matchID);
                const isTutorialActive = !!(match?.state?.sys as Record<string, unknown> | undefined)
                    ?.tutorial && !!(match?.state?.sys as { tutorial?: { active?: boolean } })?.tutorial?.active;
                const resolvedPlayerId = (tutorialOverrideId && isTutorialActive)
                    ? tutorialOverrideId
                    : info.playerID;
                // 清除 payload 中的 __tutorialPlayerId，避免传入领域层
                const normalizedPayload = payloadRecord && (
                    '__internalPlayerId' in payloadRecord
                    || '__internalAiCommand' in payloadRecord
                    || '__tutorialPlayerId' in payloadRecord
                    || '__tutorialAiCommand' in payloadRecord
                )
                    ? (() => {
                        const {
                            __internalPlayerId: _ignored0,
                            __internalAiCommand: _ignored1,
                            __tutorialPlayerId: _ignored2,
                            __tutorialAiCommand: _ignored3,
                            ...rest
                        } = payloadRecord;
                        return rest;
                    })()
                    : payload;
                const isTutorialAiCommand = payloadRecord?.__tutorialAiCommand === true;
                const tutorialInjectedPayload = match
                    ? injectTutorialInteractionId({
                        state: match.state,
                        commandType,
                        payload: normalizedPayload,
                        tutorialPlayerId: tutorialOverrideId ?? resolvedPlayerId,
                        isTutorialAiCommand,
                    })
                    : normalizedPayload;
                await this.handleCommand(matchID, resolvedPlayerId, commandType, tutorialInjectedPayload);
            });

            socket.on('batch', async (
                matchID: string,
                batchId: string,
                commands: Array<{ type: string; payload: unknown }>,
                credentials?: string,
                meta?: BatchDispatchMeta,
            ) => {
                if (!matchID || !batchId || !Array.isArray(commands)) return;
                const info = this.socketIndex.get(socket.id);
                if (!info || info.matchID !== matchID || !info.playerID) return;
                const authorized = await this.validateCommandAuth(matchID, info.playerID, info.credentials ?? credentials);
                if (!authorized) {
                    socket.emit('batch:rejected', matchID, batchId, 'unauthorized');
                    return;
                }
                await this.handleBatch(socket, matchID, info.playerID, batchId, commands, meta);
            });

            socket.on('disconnect', () => {
                this.handleDisconnect(socket);
            });

        });

        if (!this.onlineAiRecoveryTimer && this.onlineAiRecoveryTickMs > 0) {
            this.onlineAiRecoveryTimer = setInterval(() => {
                void this.runOnlineAiRecoveryTick();
            }, this.onlineAiRecoveryTickMs);
        }
    }

    // ========================================================================
    // 公共 API（供 REST 路由调用）
    // ========================================================================

    /** 创建对局并初始化状态 */
    async setupMatch(
        matchID: string,
        gameId: string,
        playerIds: PlayerId[],
        seed: string,
        setupData?: unknown,
    ): Promise<{ state: MatchState<unknown>; randomCursor: number } | null> {
        const engineConfig = this.gameIndex.get(gameId);
        if (!engineConfig) return null;

        const setupSeatControllers = extractSetupSeatControllers(setupData);
        const setupPlayerIds = resolveSetupPlayerIds({
            playerIds,
            setupData,
            seatControllers: setupSeatControllers,
        });
        const trackedRandom = createTrackedRandom(seed, 0);
        const core = engineConfig.domain.setup(setupPlayerIds, trackedRandom.random, setupData);
        const sys = createInitialSystemState(
            setupPlayerIds,
            engineConfig.systems as EngineSystem[],
            matchID,
        );
        const state = setUndoAiSeatIds(
            { sys, core },
            getAiSeatIds(setupSeatControllers),
        );
        return {
            state,
            randomCursor: trackedRandom.getCursor(),
        };
    }

    /** 执行命令（供服务端内部调用，如离线裁决） */
    async executeCommand(
        matchID: string,
        playerID: string,
        commandType: string,
        payload: unknown,
    ): Promise<boolean> {
        return this.handleCommand(matchID, playerID, commandType, payload);
    }

    /**
     * 覆盖活跃对局的 metadata 缓存（REST 更新 metadata 后调用）
     */
    updateMatchMetadata(matchID: string, metadata: MatchMetadata): void {
        const active = this.activeMatches.get(matchID);
        if (!active) return;
        active.metadata = metadata;
    }

    private async readFreshAuthMetadata(
        matchID: string,
        fallback?: MatchMetadata,
    ): Promise<MatchMetadata | undefined> {
        if (isMatchAuthMetadataProvider(this.storage)) {
            return (await this.storage.fetchAuthMetadata(matchID)) ?? fallback;
        }
        return (await this.storage.fetch(matchID, { metadata: true })).metadata ?? fallback;
    }

    private mergeActiveMetadata(matchID: string, metadata: MatchMetadata): void {
        const active = this.activeMatches.get(matchID);
        if (!active) return;
        active.metadata = {
            ...active.metadata,
            ...metadata,
            players: metadata.players,
        };
    }

    /**
     * 测试 / 管理接口：校验某个玩家是否有权访问指定对局。
     *
     * 复用与 socket `sync` / `command` 同源的 metadata + authenticate 规则，
     * 避免 `/test` API 仅凭全局 token 绕过座位归属与凭证校验。
     */
    async validateTestAccess(
        matchID: string,
        playerID: string,
        credentials?: string,
        metadata?: MatchMetadata,
    ): Promise<boolean> {
        if (!playerID) return false;

        const resolvedMetadata = metadata ?? (await this.storage.fetch(matchID, { metadata: true })).metadata;
        if (!resolvedMetadata) return false;

        const playerMeta = resolvedMetadata.players[playerID];
        if (!playerMeta) return false;

        const ok = this.authenticate
            ? await this.authenticate(matchID, playerID, credentials, resolvedMetadata)
            : typeof playerMeta.credentials === 'string'
                && playerMeta.credentials.length > 0
                && playerMeta.credentials === credentials;

        if (!ok) return false;

        const active = this.activeMatches.get(matchID);
        if (active) {
            active.metadata = resolvedMetadata;
        }
        return true;
    }

    /**
     * 测试专用：直接注入对局状态
     * 
     * 此方法绕过正常的命令执行流程，直接修改服务器状态并广播到所有客户端。
     * 仅在测试环境使用。
     * 
     * @param matchID 对局 ID
     * @param state 新的对局状态
     */
    async injectState(matchID: string, state: MatchState<unknown>): Promise<void> {
        // 环境检查
        // 仅允许显式 test/development，避免在 staging/preview 中暴露状态注入能力。
        if (!canInjectStateInCurrentEnv(process.env.NODE_ENV)) {
            throw new Error('injectState is only available in test/development environment');
        }

        // 验证状态结构
        if (!state || typeof state !== 'object') {
            throw new Error('Invalid state: must be an object');
        }
        if (!state.core || typeof state.core !== 'object') {
            throw new Error('Invalid state: missing or invalid core');
        }
        if (!state.sys || typeof state.sys !== 'object') {
            throw new Error('Invalid state: missing or invalid sys');
        }

        // 加载或获取活跃对局
        let match = this.activeMatches.get(matchID);
        if (!match) {
            match = await this.loadMatch(matchID);
            if (!match) {
                throw new Error(`Match ${matchID} not found`);
            }
        }

        // 更新状态
        console.log('[DEBUG-inject-state-phase]', JSON.stringify({
            matchID,
            sysPhase: (state.sys as { phase?: unknown } | undefined)?.phase ?? null,
            corePhase: (state.core as { phase?: unknown } | undefined)?.phase ?? null,
            activePlayerId: (state.core as { activePlayerId?: unknown } | undefined)?.activePlayerId ?? null,
        }));
        match.state = state;
        match.stateID += 1;

        // 持久化到存储
        const storedState: StoredMatchState = {
            G: state,
            _stateID: match.stateID,
            randomSeed: match.randomSeed,
            randomCursor: match.getRandomCursor(),
        };
        await this.storage.setState(matchID, storedState);

        // 清空增量同步缓存，确保注入后首次广播为全量
        match.lastBroadcastedViews.clear();

        // 广播到所有客户端
        this.broadcastState(match);

        logger.info(`[TEST] State injected for match ${matchID}`);
    }

    /**
     * 主动断开某个玩家在对局内的所有连接（离座释放权限）
     */
    disconnectPlayer(matchID: string, playerID: string, options?: { disconnectSockets?: boolean }): void {
        const match = this.activeMatches.get(matchID);
        if (!match) return;

        const conns = match.connections.get(playerID);
        if (!conns || conns.size === 0) return;

        const socketIds = new Set(conns);
        match.connections.delete(playerID);
        for (const sid of socketIds) {
            this.socketIndex.delete(sid);
        }

        // 从传输层视角将该玩家标记为离线，并触发离线裁决兜底。
        this.onPlayerFullyDisconnected(match, playerID);

        if (options?.disconnectSockets) {
            const nsp = this.io.of('/game');
            void nsp.in(`game:${matchID}`).fetchSockets()
                .then((sockets) => {
                    for (const socket of sockets) {
                        if (socketIds.has(socket.id)) {
                            socket.disconnect(true);
                        }
                    }
                })
                .catch((error) => {
                    logger.warn('[GameTransport] disconnect player sockets failed', {
                        matchID,
                        playerID,
                        error,
                    });
                });
        }
    }

    /** 卸载活跃对局（销毁房间时调用） */
    unloadMatch(matchID: string, options?: { disconnectSockets?: boolean }): void {
        const match = this.activeMatches.get(matchID);
        if (!match) return;

        for (const timer of match.offlineTimers.values()) {
            clearTimeout(timer);
        }
        match.offlineTimers.clear();

        while (match.commandQueue.length > 0) {
            const queued = match.commandQueue.shift();
            queued?.resolve(false);
        }

        for (const sockets of match.connections.values()) {
            for (const sid of sockets) {
                this.socketIndex.delete(sid);
            }
        }
        for (const sid of match.spectatorSockets) {
            this.socketIndex.delete(sid);
        }

        this.activeMatches.delete(matchID);
        this.onlineAiRecoveryTrackers.delete(matchID);
        this.onlineAiRecoveryInFlight.delete(matchID);
        for (const key of this.onlineAiOverlayResyncCooldown.keys()) {
            if (key.startsWith(`${matchID}:`)) {
                this.onlineAiOverlayResyncCooldown.delete(key);
            }
        }

        if (options?.disconnectSockets) {
            const nsp = this.io.of('/game');
            void nsp.in(`game:${matchID}`).fetchSockets()
                .then((sockets) => {
                    sockets.forEach((s) => {
                        s.emit('error', matchID, 'match_not_found');
                        s.disconnect(true);
                    });
                })
                .catch((error) => {
                    logger.warn('[GameTransport] disconnect room sockets failed', { matchID, error });
                });
        }
    }

    private async resolveOnlineAiLegalActionOnlyCandidate(
        match: ActiveMatch,
        seatControllers: Record<string, OnlineAiWatchdogSeatController>,
    ): Promise<ForceEndTurnStalledAiResolution | null> {
        const currentPlayerId = resolveOnlineAiCurrentPlayerId(match.state, {
            engineConfig: match.engineConfig,
            gameId: match.gameId,
        });
        if (!currentPlayerId || seatControllers[currentPlayerId]?.type !== 'human') {
            return null;
        }
        if (!shouldProbeOnlineAiLegalActionOnlyCandidateForHumanTurn({
            state: match.state,
            currentPlayerId,
            engineConfig: match.engineConfig,
            gameId: match.gameId,
        })) {
            return null;
        }
        const pendingAttack = (match.state.core as { pendingAttack?: { defenderId?: unknown } } | undefined)?.pendingAttack;
        if (currentPhase === 'defensiveRoll' && pendingAttack?.defenderId === currentPlayerId) {
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

        const decisionViewResolvers = buildOnlineAiDecisionViewResolvers({
            runtime: getGameAiRuntime(match.gameId) ?? null,
            sharedState: match.state,
            resolvePrivateOverlay: (playerId) => this.applyPlayerView(match, playerId) as MatchState<unknown>,
        });
        const aiDispatchResult = await dispatchOnlineAiWithResolvedSeatView({
            dispatchResolver: aiModule.resolveNextAiDispatch,
            engineConfig: match.engineConfig,
            state: match.state,
            matchId: match.matchID,
            seatControllers,
            decisionViewResolvers,
            mode: 'strict',
        });

        const phase = typeof match.state.sys?.phase === 'string' ? match.state.sys.phase : '';
        if (aiDispatchResult.kind === 'blocked') {
            const playerId = aiDispatchResult.playerId;
            if (
                aiDispatchResult.visibility !== 'private-required'
                || !isOnlineAiPrivateOverlayBlockedReason(aiDispatchResult.blockedReason)
                || playerId === currentPlayerId
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

        if (aiDispatchResult.kind !== 'action') {
            return null;
        }

        const resolution = aiDispatchResult.resolution;
        if (resolution.playerId === currentPlayerId) {
            return null;
        }

        const fingerprintHint = [
            'seat-legal-only',
            resolution.playerId,
            phase,
            resolution.action.kind,
            resolution.action.actionId,
        ].join(':');

        return {
            playerId: resolution.playerId,
            reason: 'seat-legal-only',
            legalActionOnly: true,
            fingerprintHint,
            resolution: {
                playerId: resolution.playerId,
                attemptKey: `force-end-turn:${resolution.playerId}:${fingerprintHint}`,
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

    private async shouldSuppressOnlineAiWatchdogForManualFactionSelection(
        match: ActiveMatch,
        playerId: string,
        seatControllers: Record<string, OnlineAiWatchdogSeatController>,
    ): Promise<boolean> {
        const seatController = seatControllers[playerId];
        if (!seatController || seatController.type === 'human' || seatController.manualFactionSelection !== true) {
            return false;
        }

        const { visibleState } = resolveOnlineAiVisibleStateForPlayer({
            runtime: getGameAiRuntime(match.gameId) ?? null,
            sharedState: match.state,
            playerId,
            resolvePrivateOverlay: (targetPlayerId) => this.applyPlayerView(match, targetPlayerId) as MatchState<unknown>,
        });

        const legalActions = buildAiDecisionContext({
            gameId: match.engineConfig.gameId,
            matchId: match.matchID,
            playerId,
            visibleState,
            rulesVersion: this.rulesVersion,
            decisionBudgetMs: 250,
            source: 'online',
        }).legalActions;

        return legalActions.length > 0
            && legalActions.every((action) => aiModule.shouldPlayerManuallyResolveFactionSelection(seatController, action));
    }

    private buildOnlineAiRecoveryFingerprint(
        match: ActiveMatch,
        candidate: ForceEndTurnStalledAiResolution,
        progressMarker: string,
    ): string {
        return resolveOnlineAiRecoveryFingerprint({
            state: match.state,
            candidate,
            progressMarker,
            engineConfig: match.engineConfig,
        });
    }

    private async resolveOnlineAiRecoveryCandidate(
        match: ActiveMatch,
        seatControllers: Record<string, OnlineAiWatchdogSeatController>,
    ): Promise<ForceEndTurnStalledAiResolution | null> {
        const needsSeatStates = shouldInspectSeatStatesForHiddenAiInteraction(match.state);
        const seatStates: Record<string, MatchState<unknown> | null | undefined> = needsSeatStates
            ? Object.fromEntries(
                Object.entries(seatControllers)
                    .filter(([, controller]) => controller.type !== 'human')
                    .map(([playerId]) => [playerId, this.applyPlayerView(match, playerId) as MatchState<unknown>]),
            )
            : {};

        const candidate = resolveForceEndTurnForStalledAi({
            sharedState: match.state,
            seatControllers,
            seatStates,
            engineConfig: match.engineConfig,
            gameId: match.gameId,
        }) ?? await this.resolveOnlineAiLegalActionOnlyCandidate(match, seatControllers);

        if (!candidate) {
            return null;
        }

        if ((candidate.reason === 'active-turn-legal-only' || candidate.reason === 'seat-legal-only')
            && await this.shouldSuppressOnlineAiWatchdogForManualFactionSelection(
                match,
                candidate.playerId,
                seatControllers,
            )) {
            return null;
        }

        const currentWindow = (match.state.sys as { responseWindow?: { current?: unknown } } | undefined)
            ?.responseWindow?.current as {
                responderQueue?: unknown;
                currentResponderIndex?: unknown;
                windowType?: unknown;
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
        if (candidate.reason === 'response-window') {
            const currentTracker = this.onlineAiRecoveryTrackers.get(match.matchID);
            const currentTrackerSnapshot = buildOnlineAiRecoveryTrackerSnapshot({
                state: match.state,
                candidate,
                engineConfig: match.engineConfig,
            });
            const responseWindowTrackerKey = currentTrackerSnapshot.trackerKey;
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
            if (shouldEscalateToResponseLoop) {
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

        return candidate;
    }

    private resolveOnlineAiRecoveryTimeoutMs(
        match: ActiveMatch,
        candidate: ForceEndTurnStalledAiResolution,
    ): number {
        const liveSeatConnectionCount = match.connections.get(candidate.playerId)?.size ?? 0;
        // 商业口径：在线 AI 不应依赖宿主页保持前台/存活。
        // 一旦对应 AI seat 没有 live socket，watchdog 立即接管真正的“对局中 AI 回合/交互”。
        // pregame 的 legal-only 选阵营链仍保留原有时序，避免改变既有恢复/反馈语义。
        const shouldImmediateTakeover = candidate.reason === 'active-turn'
            || candidate.reason === 'response-window'
            || candidate.reason === 'response-loop'
            || candidate.reason === 'visible-interaction'
            || candidate.reason === 'hidden-interaction';
        if (liveSeatConnectionCount === 0 && shouldImmediateTakeover) {
            return 0;
        }
        return this.onlineAiRecoveryTimeoutMs;
    }

    private async runOnlineAiRecoveryTick(): Promise<void> {
        const now = Date.now();
        pruneExpiredOnlineAiCooldownEntries(this.onlineAiRecoveryFeedbackCooldown, now);
        pruneExpiredOnlineAiCooldownEntries(this.onlineAiOverlayResyncCooldown, now);

        for (const match of this.activeMatches.values()) {
            if (this.onlineAiRecoveryInFlight.has(match.matchID)) {
                continue;
            }

            const { seatControllers, hasAiSeat } = resolveOnlineAiWatchdogSeatControllers({
                gameId: match.gameId,
                playerIds: Object.keys(match.metadata.players),
                setupData: match.metadata.setupData,
                gameManifests: this.gameManifests,
            });
            const candidate = hasAiSeat
                ? await this.resolveOnlineAiRecoveryCandidate(match, seatControllers)
                : null;
            if (!candidate) {
                const schedulingDecision = resolveOnlineAiWatchdogSchedulingDecision({
                    now,
                    hasAiSeat,
                    hasCandidate: false,
                });
                if (schedulingDecision.kind === 'clear-tracker') {
                    this.onlineAiRecoveryTrackers.delete(match.matchID);
                }
                continue;
            }

            const { progressMarker, trackerKey } = buildOnlineAiRecoveryTrackerSnapshot({
                state: match.state,
                candidate,
                engineConfig: match.engineConfig,
            });
            const recoveryTimeoutMs = this.resolveOnlineAiRecoveryTimeoutMs(match, candidate);
            const schedulingDecision = resolveOnlineAiWatchdogSchedulingDecision({
                now,
                hasAiSeat,
                hasCandidate: true,
                trackerKey,
                recoveryTimeoutMs,
                suppressRecovery: candidate.reason === 'active-turn'
                    && this.hasRecentOnlineAiOverlayResync({
                        matchId: match.matchID,
                        playerId: candidate.playerId,
                        progressMarker,
                    }),
                currentTracker: this.onlineAiRecoveryTrackers.get(match.matchID),
            });

            if (schedulingDecision.kind === 'clear-tracker') {
                this.onlineAiRecoveryTrackers.delete(match.matchID);
                continue;
            }
            if (schedulingDecision.trackerToStore) {
                this.onlineAiRecoveryTrackers.set(match.matchID, schedulingDecision.trackerToStore);
            }
            if (schedulingDecision.kind !== 'launch-recovery') {
                continue;
            }

            const currentTracker = schedulingDecision.tracker;
            currentTracker.autoSubmittedAt = now;
            this.onlineAiRecoveryInFlight.add(match.matchID);
            void this.runOnlineAiRecoverySequence(match, currentTracker, candidate, progressMarker, seatControllers)
                .finally(() => {
                    this.onlineAiRecoveryInFlight.delete(match.matchID);
                });
        }
    }

    private async runOnlineAiRecoverySequence(
        match: ActiveMatch,
        tracker: OnlineAiRecoveryTracker,
        candidate: ForceEndTurnStalledAiResolution,
        progressMarkerBeforeRecovery: string,
        seatControllers: Record<string, OnlineAiWatchdogSeatController>,
    ): Promise<void> {
        if (match.executing) {
            tracker.autoSubmittedAt = null;
            return;
        }

        match.executing = true;
        const rootCandidate = candidate;
        const initialPhaseLabel = resolveOnlineAiRecoveryPhaseLabel(rootCandidate);
        const sequenceState: OnlineAiRecoverySequenceState = {
            tracker,
            currentCandidate: rootCandidate,
            forcedCommandProgress: createOnlineAiRecoveryForcedCommandProgress({
                initialPhaseLabel,
            }),
        };
        const sequenceRuntime = this.createOnlineAiRecoverySequenceRuntime(
            match,
            tracker,
            progressMarkerBeforeRecovery,
            seatControllers,
        );
        const sequenceContext: OnlineAiRecoverySequenceContext = {
            incident: {
                rootCandidate,
                progressMarkerBeforeRecovery,
            },
            sequenceState,
            runtime: sequenceRuntime,
        };

        try {
            const loopBootstrap = await this.bootstrapOnlineAiRecoveryLoop(sequenceContext);
            if (!loopBootstrap) {
                return;
            }
            let sequenceProgress = loopBootstrap.sequenceProgress;
            const seenStepKeys = loopBootstrap.seenStepKeys;

            while (sequenceProgress.recoverySteps <= this.onlineAiRecoveryMaxAdvanceSteps) {
                const iterationResult = await this.runOnlineAiRecoveryLoopIteration(
                    sequenceContext,
                    {
                        sequenceProgress,
                        seenStepKeys,
                    },
                );
                sequenceProgress = iterationResult.sequenceProgress;
                if (iterationResult.kind === 'stop') {
                    return;
                }
                if (iterationResult.kind === 'break') {
                    break;
                }
            }
            await this.finalizeOnlineAiRecoverySequence(sequenceContext, {
                sequenceProgress,
            });
        } finally {
            await this.drainCommandQueue(match);
            match.executing = false;
        }
    }

    private createOnlineAiRecoveryRuntimeBase(
        match: ActiveMatch,
        seatControllers: Record<string, OnlineAiWatchdogSeatController>,
    ): OnlineAiRecoveryRuntimeBase {
        const resolvePrivateOverlay = (playerId: string) => this.applyPlayerView(match, playerId) as MatchState<unknown>;
        return {
            matchId: match.matchID,
            gameId: match.gameId,
            engineConfig: match.engineConfig,
            readState: () => match.state,
            resolveLatestCandidate: () => this.resolveOnlineAiRecoveryCandidate(match, seatControllers),
            resolvePrivateOverlay,
            resolveForceCommandAllowance:
                match.engineConfig.onlineAiRecovery?.allowForceCommandAfterLegalActionExhausted,
            seatControllers,
            executeSuppressedCommand: async (playerId, commandType, commandPayload) => {
                const success = await this.executeCommandInternal(
                    match,
                    playerId,
                    commandType,
                    commandPayload,
                    { suppressBroadcast: true },
                );
                return {
                    success,
                    commandFailureReason: success ? undefined : match.lastCommandFailureReason,
                };
            },
            broadcastState: () => this.broadcastState(match),
            requestOverlayResync: (args) => this.maybeTriggerOnlineAiOverlayResync({
                match,
                playerId: args.playerId,
                blockedReason: args.blockedReason,
                blockedKey: args.blockedKey,
                progressMarker: args.progressMarker,
            }),
            clearStoredTracker: () => {
                this.onlineAiRecoveryTrackers.delete(match.matchID);
            },
        };
    }

    private createOnlineAiRecoverySequenceRuntime(
        match: ActiveMatch,
        tracker: OnlineAiRecoveryTracker,
        progressMarkerBeforeRecovery: string,
        seatControllers: Record<string, OnlineAiWatchdogSeatController>,
    ): OnlineAiRecoverySequenceRuntime {
        return {
            ...this.createOnlineAiRecoveryRuntimeBase(match, seatControllers),
            readHasLiveSeatConnection: (playerId: string) => (match.connections.get(playerId)?.size ?? 0) > 0,
            tryRecoverLegalAction: (candidate, recoveryTracker) => this.tryRecoverOnlineAiWithLegalAction(
                match,
                candidate,
                recoveryTracker,
                seatControllers,
            ),
            readLastCommandFailureReason: () => match.lastCommandFailureReason,
            reportFailure: (
                failureCandidate: ForceEndTurnStalledAiResolution,
                failurePhaseLabel: OnlineAiRecoveryPhaseLabel,
                reason: string,
            ) => this.handleOnlineAiRecoveryFailure(
                match,
                tracker,
                failureCandidate,
                failurePhaseLabel,
                progressMarkerBeforeRecovery,
                reason,
            ),
            executeCommand: (playerId: string, commandType: string, commandPayload: unknown) =>
                this.executeCommandInternal(match, playerId, commandType, commandPayload),
            reportRecoveryFeedbackWithDiagnostics: (args) => this.reportOnlineAiRecoveryFeedbackWithDiagnostics({
                match,
                candidate: args.candidate,
                metadata: args.metadata,
                failureReason: args.failureReason,
            }),
        };
    }

    private async resolveChainedOnlineAiRecoverySequenceCandidate(
        context: OnlineAiRecoverySequenceContext,
    ): Promise<ForceEndTurnStalledAiResolution | null> {
        return resolveChainedOnlineAiRecoveryCandidate(
            await context.runtime.resolveLatestCandidate(),
            context.incident.rootCandidate.playerId,
        );
    }

    private async revalidateOnlineAiRecoverySequenceCandidate(
        context: OnlineAiRecoverySequenceContext,
        expectedCandidate: ForceEndTurnStalledAiResolution,
    ): Promise<ForceEndTurnStalledAiResolution | null> {
        const rawLatestCandidate = await context.runtime.resolveLatestCandidate();
        const revalidatedCandidate = resolveRevalidatedOnlineAiRecoveryCandidateFromLiveState({
            rawLatestCandidate,
            expectedCandidate,
            expectedTrackerKey: context.sequenceState.tracker.key,
            state: context.runtime.readState(),
            progressMarker: buildAiProgressMarker(context.runtime.readState(), {
                engineConfig: context.runtime.engineConfig,
            }),
            engineConfig: context.runtime.engineConfig,
        });
        if (!revalidatedCandidate) {
            context.runtime.clearStoredTracker();
            context.sequenceState.tracker.autoSubmittedAt = null;
            return null;
        }
        return revalidatedCandidate;
    }

    private async applyOnlineAiRecoveryFailureDispatchDecision(
        context: OnlineAiRecoverySequenceContext,
        args: {
            candidate: ForceEndTurnStalledAiResolution;
            phaseLabel: OnlineAiRecoveryPhaseLabel;
            reason: string;
            shouldRevalidateCandidate?: boolean;
        },
    ): Promise<void> {
        if (args.shouldRevalidateCandidate === false) {
            await context.runtime.reportFailure(args.candidate, args.phaseLabel, args.reason);
            return;
        }

        const revalidatedCandidate = await this.revalidateOnlineAiRecoverySequenceCandidate(
            context,
            args.candidate,
        );
        if (!revalidatedCandidate) {
            return;
        }
        await context.runtime.reportFailure(revalidatedCandidate, args.phaseLabel, args.reason);
    }

    private async tryHardCancelCurrentOnlineAiRecoveryInteraction(
        context: OnlineAiRecoverySequenceContext,
        candidateToCancel: ForceEndTurnStalledAiResolution,
    ): Promise<boolean> {
        const hardCancelDecision = resolveOnlineAiHardCancelDecisionFromRuntime({
            state: context.runtime.readState(),
            candidate: candidateToCancel,
            seatControllers: context.runtime.seatControllers,
        });
        if (hardCancelDecision.kind !== 'cancel') {
            return false;
        }

        context.sequenceState.forcedCommandProgress = recordOnlineAiForcedRecoveryCommandAttempt({
            progress: context.sequenceState.forcedCommandProgress,
            candidateReason: candidateToCancel.reason,
            phaseLabel: resolveOnlineAiRecoveryPhaseLabel(candidateToCancel),
        });

        return context.runtime.executeCommand(
            hardCancelDecision.playerId,
            INTERACTION_COMMANDS.CANCEL,
            {
                interactionId: hardCancelDecision.interactionId,
            },
        );
    }

    private async continueOnlineAiRecoveryAfterHardCancel(
        context: OnlineAiRecoverySequenceContext,
        candidateToCancel: ForceEndTurnStalledAiResolution,
    ): Promise<OnlineAiRecoveryHardCancelContinuation> {
        if (!await this.tryHardCancelCurrentOnlineAiRecoveryInteraction(context, candidateToCancel)) {
            return { kind: 'not-cancelled' };
        }

        const postCancelCandidate = await this.resolveChainedOnlineAiRecoverySequenceCandidate(context);
        if (!postCancelCandidate) {
            return { kind: 'chain-ended' };
        }

        return {
            kind: 'continue-with-candidate',
            candidate: postCancelCandidate,
        };
    }

    private async handleUnappliedOnlineAiRecoveryStep(
        context: OnlineAiRecoverySequenceContext,
        args: OnlineAiRecoveryHandleUnappliedStepArgs,
    ): Promise<OnlineAiRecoveryUnappliedStepResult> {
        const currentPhaseLabel = resolveOnlineAiRecoveryPhaseLabel(args.currentCandidate);
        const pauseDecision = resolveOnlineAiRecoveryPauseDecision({
            state: context.runtime.readState(),
            candidate: args.currentCandidate,
            rootCandidateReason: context.incident.rootCandidate.reason,
            blockedFailureReason: args.blockedFailureReason,
            forcedCommandProgress: context.sequenceState.forcedCommandProgress,
            engineConfig: context.runtime.engineConfig,
        });
        if (pauseDecision.kind === 'pause') {
            syncOnlineAiRecoveryTrackerKey(context.sequenceState.tracker, pauseDecision.nextTrackerKey);
            return { kind: 'paused' };
        }

        const forcedRecoveryCommandDecision = resolveOnlineAiForcedRecoveryCommandDecisionFromRuntime({
            gameId: context.runtime.gameId,
            state: context.runtime.readState(),
            seatControllers: context.runtime.seatControllers,
            currentCandidate: args.currentCandidate,
            actionRecovery: args.actionRecovery,
            blockedFailureReason: args.blockedFailureReason,
            resolveForceCommandAllowance: context.runtime.resolveForceCommandAllowance,
            engineConfig: context.runtime.engineConfig,
            formatCommandFailureReason: formatOnlineAiCommandFailureReason,
        });
        const forcedCommandFailureDispatchDecision = resolveOnlineAiForcedRecoveryFailureDispatchDecision({
            forcedRecoveryCommandDecision,
            currentCandidate: args.currentCandidate,
            currentPhaseLabel,
            formatCommandFailureReason: formatOnlineAiCommandFailureReason,
        });
        if (forcedCommandFailureDispatchDecision.kind === 'report-failure') {
            await this.applyOnlineAiRecoveryFailureDispatchDecision(context, forcedCommandFailureDispatchDecision);
            return { kind: 'failed' };
        }

        context.sequenceState.forcedCommandProgress = recordOnlineAiForcedRecoveryCommandAttempt({
            progress: context.sequenceState.forcedCommandProgress,
            candidateReason: args.currentCandidate.reason,
            phaseLabel: currentPhaseLabel,
        });
        const nextSuccess = await context.runtime.executeCommand(
            args.currentCandidate.playerId,
            forcedRecoveryCommandDecision.commandType,
            forcedRecoveryCommandDecision.commandPayload,
        );
        if (!nextSuccess) {
            const commandFailureReason = context.runtime.readLastCommandFailureReason();
            const commandFailureDispatchDecision = resolveOnlineAiForcedRecoveryFailureDispatchDecision({
                forcedRecoveryCommandDecision,
                currentCandidate: args.currentCandidate,
                currentPhaseLabel,
                commandExecutionSucceeded: false,
                commandFailureReason,
                formatCommandFailureReason: formatOnlineAiCommandFailureReason,
            });
            await this.applyOnlineAiRecoveryFailureDispatchDecision(context, commandFailureDispatchDecision);
            return { kind: 'failed' };
        }

        if (forcedRecoveryCommandDecision.shouldCountAdvanceStep) {
            context.sequenceState.forcedCommandProgress = recordOnlineAiForcedRecoveryAdvanceStep(
                context.sequenceState.forcedCommandProgress,
            );
        }

        return {
            kind: 'continue',
            executedCommandType: forcedRecoveryCommandDecision.commandType,
        };
    }

    private async advanceOnlineAiRecoveryAfterStep(
        context: OnlineAiRecoverySequenceContext,
        args: OnlineAiRecoveryAdvanceAfterStepArgs,
    ): Promise<OnlineAiRecoveryPostStepProgression> {
        const currentPhaseLabel = resolveOnlineAiRecoveryPhaseLabel(args.currentCandidate);
        if (args.stepBookkeepingDecision.kind === 'attempt-hard-cancel') {
            const hardCancelContinuation = await this.continueOnlineAiRecoveryAfterHardCancel(
                context,
                args.currentCandidate,
            );
            if (hardCancelContinuation.kind === 'chain-ended') {
                return { kind: 'break' };
            }
            if (hardCancelContinuation.kind === 'continue-with-candidate') {
                return {
                    kind: 'continue-with-candidate',
                    candidate: hardCancelContinuation.candidate,
                };
            }
        }

        const stepFailureDispatchDecision = resolveOnlineAiRecoveryFailureDispatchDecision({
            stepBookkeepingDecision: args.stepBookkeepingDecision,
            currentCandidate: args.currentCandidate,
            currentPhaseLabel,
        });
        if (stepFailureDispatchDecision.kind === 'report-failure') {
            await this.applyOnlineAiRecoveryFailureDispatchDecision(context, stepFailureDispatchDecision);
            return { kind: 'stop' };
        }

        args.seenStepKeys.add(args.afterStepSnapshot.nextStepKey);

        const nextCandidate = await this.resolveChainedOnlineAiRecoverySequenceCandidate(context);
        if (!nextCandidate) {
            return { kind: 'break' };
        }

        const followUpRuntimeSnapshot = buildOnlineAiRecoveryFollowUpRuntimeSnapshot({
            state: context.runtime.readState(),
            seatControllers: context.runtime.seatControllers,
            rootCandidate: context.incident.rootCandidate,
            nextCandidate,
            engineConfig: context.runtime.engineConfig,
            hasLiveSeatConnection: context.runtime.readHasLiveSeatConnection(context.incident.rootCandidate.playerId),
            resolvePrivateOverlay: context.runtime.resolvePrivateOverlay,
            resolveForceCommandAllowance: context.runtime.resolveForceCommandAllowance,
        });
        if (shouldAttemptOnlineAiRecoveryHardCancel({
            attemptedInteractionRespond: args.executedCommandTypes.has(INTERACTION_COMMANDS.RESPOND),
            currentCandidateReason: args.currentCandidate.reason,
            nextCandidateReason: nextCandidate.reason,
            interactionFingerprintBeforeStep: args.beforeStepSnapshot.interactionFingerprintBeforeStep,
            interactionFingerprintAfterStep: args.afterStepSnapshot.interactionFingerprintAfterStep,
        })) {
            const hardCancelContinuation = await this.continueOnlineAiRecoveryAfterHardCancel(context, nextCandidate);
            if (hardCancelContinuation.kind === 'chain-ended') {
                return { kind: 'break' };
            }
            if (hardCancelContinuation.kind === 'continue-with-candidate') {
                return {
                    kind: 'continue-with-candidate',
                    candidate: hardCancelContinuation.candidate,
                };
            }
        }

        const followUpTransition = resolveOnlineAiRecoveryFollowUpTransitionFromRuntime({
            state: context.runtime.readState(),
            rootCandidate: context.incident.rootCandidate,
            currentCandidate: args.currentCandidate,
            nextCandidate,
            currentPlayerIdBeforeStep: args.beforeStepSnapshot.currentPlayerIdBeforeStep,
            currentPlayerIdAfterStep: args.afterStepSnapshot.currentPlayerIdAfterStep,
            actionRecoveryApplied: args.actionRecoveryApplied,
            responseWindowFingerprintBeforeStep: args.beforeStepSnapshot.responseWindowFingerprintBeforeStep,
            seatViewInteractionAfterStep: followUpRuntimeSnapshot.seatViewInteractionAfterStep,
            executedResponsePass: args.executedCommandTypes.has('RESPONSE_PASS'),
            hasHumanResponderInCurrentWindow: followUpRuntimeSnapshot.hasHumanResponderInCurrentWindow,
            hasLiveSeatConnection: followUpRuntimeSnapshot.hasLiveSeatConnection,
            allowForceCommandAfterLegalActionExhaustedRequested:
                followUpRuntimeSnapshot.allowForceCommandAfterLegalActionExhaustedRequested,
            engineConfig: context.runtime.engineConfig,
        });
        if (followUpTransition.kind === 'natural-continuation') {
            return { kind: 'natural-continuation' };
        }
        if (followUpTransition.nextTrackerKey) {
            syncOnlineAiRecoveryTrackerKey(context.sequenceState.tracker, followUpTransition.nextTrackerKey);
        }
        return {
            kind: 'continue-with-candidate',
            candidate: followUpTransition.candidate,
        };
    }

    private async finalizeOnlineAiRecoverySequence(
        context: OnlineAiRecoverySequenceContext,
        args: {
            sequenceProgress: OnlineAiRecoverySequenceProgress;
        },
    ): Promise<void> {
        const currentPhaseLabel = resolveOnlineAiRecoveryPhaseLabel(context.sequenceState.currentCandidate);
        const markerAfterRecovery = buildAiProgressMarker(context.runtime.readState(), {
            engineConfig: context.runtime.engineConfig,
        });
        const unresolvedCandidate = args.sequenceProgress.allowNaturalAiContinuation
            ? null
            : await this.resolveChainedOnlineAiRecoverySequenceCandidate(context);
        const completionFailureDispatchDecision = resolveOnlineAiRecoveryCompletionFailureDispatchDecision({
            rootPlayerId: context.incident.rootCandidate.playerId,
            unresolvedCandidate,
            markerAfterRecovery,
            progressMarkerBeforeRecovery: context.incident.progressMarkerBeforeRecovery,
            currentCandidate: context.sequenceState.currentCandidate,
            currentPhaseLabel,
        });
        if (completionFailureDispatchDecision.kind === 'report-failure') {
            await this.applyOnlineAiRecoveryFailureDispatchDecision(context, completionFailureDispatchDecision);
            return;
        }

        logger.warn('[GameTransport] online-ai-watchdog recovered stalled AI', {
            matchID: context.runtime.matchId,
            gameId: context.runtime.gameId,
            playerID: context.incident.rootCandidate.playerId,
            reason: context.incident.rootCandidate.reason,
            advanceSteps: context.sequenceState.forcedCommandProgress.totalAdvanceSteps,
            markerBefore: context.incident.progressMarkerBeforeRecovery,
            markerAfter: markerAfterRecovery,
        });

        context.runtime.clearStoredTracker();
        const successFeedbackDecision = resolveOnlineAiRecoverySuccessFeedbackDecision({
            forcedCommandProgress: context.sequenceState.forcedCommandProgress,
            sequenceProgress: args.sequenceProgress,
            matchId: context.runtime.matchId,
            gameId: context.runtime.gameId,
            trackerKey: context.sequenceState.tracker.key,
            progressMarker: context.incident.progressMarkerBeforeRecovery,
            rootPlayerId: context.incident.rootCandidate.playerId,
            fallbackReason: context.incident.rootCandidate.reason,
            fallbackPhaseLabel: currentPhaseLabel,
        });
        if (successFeedbackDecision.kind === 'none') {
            return;
        }
        await context.runtime.reportRecoveryFeedbackWithDiagnostics({
            candidate: context.incident.rootCandidate,
            metadata: successFeedbackDecision.metadata,
        });
    }

    private async bootstrapOnlineAiRecoveryLoop(
        context: OnlineAiRecoverySequenceContext,
    ): Promise<OnlineAiRecoveryLoopBootstrap | null> {
        let nextCurrentCandidate = context.sequenceState.currentCandidate;
        if (nextCurrentCandidate.legalActionOnly !== true) {
            const initialCandidate = await this.revalidateOnlineAiRecoverySequenceCandidate(
                context,
                nextCurrentCandidate,
            );
            if (!initialCandidate) {
                return null;
            }
            nextCurrentCandidate = initialCandidate;
        }

        context.sequenceState.currentCandidate = nextCurrentCandidate;
        const seenStepKeys = new Set<string>();
        seenStepKeys.add(buildOnlineAiRecoverySequenceStepKey({
            state: context.runtime.readState(),
            playerId: nextCurrentCandidate.playerId,
            progressMarker: context.incident.progressMarkerBeforeRecovery,
            engineConfig: context.runtime.engineConfig,
        }));

        return {
            sequenceProgress: createOnlineAiRecoverySequenceProgress(),
            seenStepKeys,
        };
    }

    private async runOnlineAiRecoveryLoopIteration(
        context: OnlineAiRecoverySequenceContext,
        args: OnlineAiRecoveryLoopIterationArgs,
    ): Promise<OnlineAiRecoveryLoopIterationResult> {
        const currentCandidate = context.sequenceState.currentCandidate;
        const beforeStepSnapshot = buildOnlineAiRecoveryStepBeforeSnapshot({
            state: context.runtime.readState(),
            playerId: currentCandidate.playerId,
            engineConfig: context.runtime.engineConfig,
        });
        const actionRecovery = await context.runtime.tryRecoverLegalAction(
            currentCandidate,
            context.sequenceState.tracker,
        );
        const blockedFailureReason = resolveOnlineAiRecoveryBlockedFailureReason(actionRecovery.blockedReason);
        const actionRecoveryApplied = actionRecovery.applied;
        let nextSequenceProgress = recordOnlineAiRecoveryAppliedLegalAction({
            progress: args.sequenceProgress,
            reportedAction: actionRecovery.applied ? actionRecovery.reportedAction : null,
        });
        const executedCommandTypes = new Set<string>(actionRecovery.executedCommandTypes);

        if (!actionRecoveryApplied) {
            const recoveryStepResult = await this.handleUnappliedOnlineAiRecoveryStep(context, {
                currentCandidate,
                actionRecovery,
                blockedFailureReason,
            });
            if (recoveryStepResult.kind === 'paused' || recoveryStepResult.kind === 'failed') {
                return {
                    kind: 'stop',
                    sequenceProgress: nextSequenceProgress,
                };
            }
            executedCommandTypes.add(recoveryStepResult.executedCommandType);
        }

        nextSequenceProgress = recordOnlineAiRecoveryStep(nextSequenceProgress);
        const attemptedInteractionRespond = executedCommandTypes.has(INTERACTION_COMMANDS.RESPOND);
        const afterStepSnapshot = buildOnlineAiRecoveryStepAfterSnapshot({
            state: context.runtime.readState(),
            playerId: currentCandidate.playerId,
            engineConfig: context.runtime.engineConfig,
        });
        const stepBookkeepingDecision = resolveOnlineAiWatchdogStepBookkeeping({
            stepKeyBefore: beforeStepSnapshot.stepKeyBefore,
            nextStepKey: afterStepSnapshot.nextStepKey,
            seenStepKeys: args.seenStepKeys,
            attemptedInteractionRespond,
            interactionFingerprintBeforeStep: beforeStepSnapshot.interactionFingerprintBeforeStep,
            interactionFingerprintAfterStep: afterStepSnapshot.interactionFingerprintAfterStep,
            interactionRecoveryFingerprintAfterStep: afterStepSnapshot.interactionRecoveryFingerprintAfterStep,
            currentCandidateFingerprintHint: currentCandidate.fingerprintHint,
            actionRecoveryApplied,
            actionRecoveryOutcome: actionRecovery.outcome,
            blockedFailureReason,
        });
        const postStepProgression = await this.advanceOnlineAiRecoveryAfterStep(context, {
            currentCandidate,
            beforeStepSnapshot,
            afterStepSnapshot,
            actionRecoveryApplied,
            executedCommandTypes,
            seenStepKeys: args.seenStepKeys,
            stepBookkeepingDecision,
        });
        if (postStepProgression.kind === 'stop') {
            return {
                kind: 'stop',
                sequenceProgress: nextSequenceProgress,
            };
        }
        if (postStepProgression.kind === 'break') {
            return {
                kind: 'break',
                sequenceProgress: nextSequenceProgress,
            };
        }
        if (postStepProgression.kind === 'natural-continuation') {
            return {
                kind: 'break',
                sequenceProgress: markOnlineAiRecoveryNaturalContinuation(nextSequenceProgress),
            };
        }

        context.sequenceState.currentCandidate = postStepProgression.candidate;
        return {
            kind: 'continue',
            sequenceProgress: nextSequenceProgress,
        };
    }

    private async handleOnlineAiRecoveryFailure(
        match: ActiveMatch,
        tracker: OnlineAiRecoveryTracker,
        candidate: ForceEndTurnStalledAiResolution,
        phaseLabel: 'recover-interaction' | 'follow-up-advance',
        progressMarkerBeforeRecovery: string,
        reason: string,
    ): Promise<void> {
        const { nextTracker } = applyOnlineAiRecoveryFailureToTracker({
            tracker,
            reason,
            now: Date.now(),
        });
        this.onlineAiRecoveryTrackers.set(match.matchID, nextTracker);

        logger.warn('[GameTransport] online-ai-watchdog failed', {
            matchID: match.matchID,
            gameId: match.gameId,
            playerID: candidate.playerId,
            incidentKey: tracker.key,
            reason,
            phase: phaseLabel,
            failureCount: nextTracker.failureCount,
            markerBefore: progressMarkerBeforeRecovery,
            markerAfter: buildAiProgressMarker(match.state, {
                engineConfig: match.engineConfig,
            }),
        });

        if (nextTracker.failureCount >= this.onlineAiRecoveryFailureReportThreshold) {
            const failureFeedbackMetadata = buildOnlineAiRecoveryFailureFeedbackMetadata({
                matchId: match.matchID,
                gameId: match.gameId,
                playerId: candidate.playerId,
                trackerKey: tracker.key,
                progressMarker: progressMarkerBeforeRecovery,
                candidateReason: candidate.reason,
                phaseLabel,
                reason,
            });
            await this.reportOnlineAiRecoveryFeedbackWithDiagnostics({
                match,
                candidate,
                metadata: failureFeedbackMetadata,
                failureReason: reason,
            });
        }
    }

    private async buildOnlineAiRecoveryStateSnapshot(
        match: ActiveMatch,
        candidate: ForceEndTurnStalledAiResolution,
        trackerKey: string,
        progressMarker: string,
        failureReason?: string,
    ): Promise<string> {
        const interactionState = match.state.sys?.interaction as { isBlocked?: unknown } | undefined;
        const seatView = this.applyPlayerView(match, candidate.playerId) as MatchState<unknown>;
        const diagnosticsContext = buildOnlineAiFeedbackDiagnosticsContext({
            sharedState: match.state,
            seatState: seatView,
        });
        const aiSummary = await this.buildOnlineAiRecoveryAiSummary(match, candidate.playerId, seatView);
        const blockerFingerprint = resolveOnlineAiRecoveryBlockerFingerprint({
            state: match.state,
            candidate,
            trackerKey,
            progressMarker,
            engineConfig: match.engineConfig,
            failureReason,
        });

        return JSON.stringify({
            matchId: match.matchID,
            gameId: match.gameId,
            playerId: candidate.playerId,
            reason: candidate.reason,
            trackerKey,
            blockerFingerprint,
            phase: match.state.sys?.phase ?? null,
            turnNumber: match.state.sys?.turnNumber ?? null,
            currentPlayerId: resolveOnlineAiCurrentPlayerId(match.state, {
                engineConfig: match.engineConfig,
                gameId: match.gameId,
            }),
            progressMarker,
            recentActionLogTail: this.extractOnlineAiRecoveryActionLogTail(match.state),
            recentEventStreamTail: this.extractOnlineAiRecoveryEventTail(match.state),
            loop: candidate.reason === 'action-loop' ? (candidate.loopInfo ?? null) : null,
            interaction: {
                isBlocked: interactionState?.isBlocked ?? null,
                shared: diagnosticsContext.sharedInteraction,
                sharedSelectability: diagnosticsContext.sharedSelectability,
                sharedUnsatisfiableReason: diagnosticsContext.sharedUnsatisfiableReason,
                seat: diagnosticsContext.seatInteraction,
                seatSelectability: diagnosticsContext.seatSelectability,
                seatUnsatisfiableReason: diagnosticsContext.seatUnsatisfiableReason,
            },
            seatControllerType: aiSummary.seatControllerType,
            legalActions: aiSummary.legalActions,
            aiDecisionPreview: aiSummary.decisionPreview,
            responseWindow: diagnosticsContext.sharedResponseWindow,
            pendingDamage: diagnosticsContext.pendingDamage,
        });
    }

    private async buildOnlineAiRecoveryAiSummary(
        match: ActiveMatch,
        playerId: string,
        seatView: MatchState<unknown>,
    ): Promise<OnlineAiRecoveryAiSummary> {
        const setupSeatControllers = extractSetupSeatControllers(match.metadata.setupData);
        const seatControllerType = resolveSeatControllerTypeForTraining(setupSeatControllers, playerId);

        try {
            const decisionContext = buildAiDecisionContext({
                gameId: match.engineConfig.gameId,
                matchId: match.matchID,
                playerId,
                visibleState: seatView,
                rulesVersion: this.rulesVersion,
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

            const runtime = aiModule.getGameAiRuntime(match.engineConfig.gameId);
            if (!runtime) {
                return {
                    seatControllerType,
                    legalActions,
                    decisionPreview: null,
                };
            }

            const seatController = setupSeatControllers?.[playerId] as aiModule.AiSeatController | undefined;
            const previewPolicy = seatControllerType === 'local-ai' && seatController?.type === 'local-ai'
                ? aiModule.resolveLocalAiPolicy(runtime, seatController)
                : seatControllerType === 'remote-ai'
                    ? aiModule.resolveLocalAiPolicyByPreference({
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
                const chosenAction = aiModule.resolveAiActionDecision(decisionContext, decision);
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

    private buildOnlineAiRecoveryActionLog(
        match: ActiveMatch,
        candidate: ForceEndTurnStalledAiResolution,
        trackerKey: string,
        progressMarker: string,
        failureReason?: string,
    ): string | undefined {
        const seatView = this.applyPlayerView(match, candidate.playerId) as MatchState<unknown>;
        const diagnosticsContext = buildOnlineAiFeedbackDiagnosticsContext({
            sharedState: match.state,
            seatState: seatView,
        });
        const blockerFingerprint = resolveOnlineAiRecoveryBlockerFingerprint({
            state: match.state,
            candidate,
            trackerKey,
            progressMarker,
            engineConfig: match.engineConfig,
            failureReason,
        });
        return this.buildOnlineAiDiagnosticActionLog({
            state: match.state,
            phase: seatView.sys?.phase ?? match.state.sys?.phase ?? null,
            progressMarker,
            trackerKey,
            reason: candidate.reason,
            blockerFingerprint,
            sharedInteraction: diagnosticsContext.sharedInteraction,
            sharedSelectability: diagnosticsContext.sharedSelectability,
            interaction: diagnosticsContext.seatInteraction,
            seatSelectability: diagnosticsContext.seatSelectability,
            responseWindow: diagnosticsContext.seatResponseWindow,
            pendingDamage: diagnosticsContext.pendingDamage,
        });
    }

    private async reportOnlineAiRecoveryFeedbackWithDiagnostics(args: {
        match: ActiveMatch;
        candidate: ForceEndTurnStalledAiResolution;
        metadata: Omit<OnlineAiRecoveryFeedbackPayload, 'stateSnapshot' | 'actionLog'>;
        failureReason?: string;
    }): Promise<void> {
        await this.reportOnlineAiRecoveryFeedback({
            ...args.metadata,
            stateSnapshot: await this.buildOnlineAiRecoveryStateSnapshot(
                args.match,
                args.candidate,
                args.metadata.trackerKey,
                args.metadata.progressMarker,
                args.failureReason,
            ),
            actionLog: this.buildOnlineAiRecoveryActionLog(
                args.match,
                args.candidate,
                args.metadata.trackerKey,
                args.metadata.progressMarker,
                args.failureReason,
            ),
        });
    }

    private async hasOnlineAiRecoveryResolved(
        candidate: ForceEndTurnStalledAiResolution,
        runtime: OnlineAiRecoveryResolutionRuntime,
    ): Promise<boolean> {
        const state = runtime.readState();
        if (candidate.legalActionOnly === true) {
            const rawNextCandidate = await runtime.resolveLatestCandidate();
            const nextCandidate = rawNextCandidate
                ? normalizeOnlineAiRecoveryExpectedLegalActionOnlyCandidate({
                    candidate: rawNextCandidate,
                    expectedCandidate: candidate,
                })
                : rawNextCandidate;
            return resolveLegalOnlyRecoveryResolved({
                candidate,
                nextCandidate,
            });
        }

        if (candidate.reason === 'active-turn') {
            const nextCandidate = await runtime.resolveLatestCandidate();
            return resolveActiveTurnRecoveryResolved({
                playerId: candidate.playerId,
                nextCandidate,
            });
        }

        if (candidate.reason === 'seat-legal-only') {
            const nextCandidate = await runtime.resolveLatestCandidate();
            return resolveLegalOnlyRecoveryResolved({
                candidate,
                nextCandidate,
            });
        }

        if (candidate.reason === 'visible-interaction') {
            return resolveVisibleInteractionRecoveryResolved({
                candidate,
                ...readVisibleInteractionRecoveryLiveState({
                    state,
                    playerId: candidate.playerId,
                    engineConfig: runtime.engineConfig,
                }),
            });
        }

        if (candidate.reason === 'hidden-interaction') {
            const seatView = runtime.resolvePrivateOverlay(candidate.playerId);
            return resolveHiddenInteractionRecoveryResolved({
                candidate,
                ...readHiddenInteractionRecoveryLiveState({
                    sharedState: state,
                    seatState: seatView,
                    playerId: candidate.playerId,
                    engineConfig: runtime.engineConfig,
                }),
            });
        }

        if (candidate.reason === 'response-window' || candidate.reason === 'response-loop') {
            const liveState = readResponseWindowRecoveryLiveState({
                state,
                playerId: candidate.playerId,
                reason: candidate.reason,
                seatControllers: runtime.seatControllers,
            });
            if (!liveState.responderId) {
                return true;
            }
            return resolveResponseWindowRecoveryResolved({
                candidate,
                ...liveState,
            });
        }

        return true;
    }

    private async buildUnsatisfiableInteractionStateSnapshot(args: {
        match: ActiveMatch;
        playerId: string;
        reason: string;
        commandType: string;
        progressMarkerBefore: string;
        preCommandSeatView: MatchState<unknown>;
    }): Promise<string> {
        const { match, playerId, reason, commandType, progressMarkerBefore, preCommandSeatView } = args;
        const diagnosticsContext = buildOnlineAiFeedbackDiagnosticsContext({
            sharedState: match.state,
            seatState: preCommandSeatView,
            seatUnsatisfiableReasonOverride: reason,
        });
        const aiSummary = await this.buildOnlineAiRecoveryAiSummary(match, playerId, preCommandSeatView);
        const blockerFingerprint = buildOnlineAiWatchdogBlockerFingerprint({
            phase: preCommandSeatView.sys?.phase ?? match.state.sys?.phase ?? null,
            reason,
            sharedInteraction: diagnosticsContext.sharedInteraction,
            seatInteraction: diagnosticsContext.seatInteraction,
            responseWindow: diagnosticsContext.seatResponseWindow,
            pendingDamage: diagnosticsContext.pendingDamage,
        });

        return JSON.stringify({
            matchId: match.matchID,
            gameId: match.gameId,
            playerId,
            reason,
            commandType,
            blockerFingerprint,
            phase: preCommandSeatView.sys?.phase ?? match.state.sys?.phase ?? null,
            turnNumber: preCommandSeatView.sys?.turnNumber ?? match.state.sys?.turnNumber ?? null,
            currentPlayerId: resolveOnlineAiCurrentPlayerId(preCommandSeatView, {
                engineConfig: match.engineConfig,
                gameId: match.gameId,
            }),
            progressMarker: progressMarkerBefore,
            recentActionLogTail: this.extractOnlineAiRecoveryActionLogTail(match.state),
            recentEventStreamTail: this.extractOnlineAiRecoveryEventTail(match.state),
            interaction: {
                shared: diagnosticsContext.sharedInteraction,
                sharedSelectability: diagnosticsContext.sharedSelectability,
                sharedUnsatisfiableReason: diagnosticsContext.sharedUnsatisfiableReason,
                seat: diagnosticsContext.seatInteraction,
                seatSelectability: diagnosticsContext.seatSelectability,
                seatUnsatisfiableReason: diagnosticsContext.seatUnsatisfiableReason,
            },
            seatControllerType: aiSummary.seatControllerType,
            legalActions: aiSummary.legalActions,
            aiDecisionPreview: aiSummary.decisionPreview,
            responseWindow: diagnosticsContext.seatResponseWindow,
        });
    }

    private async reportOnlineAiRecoveryFeedback(payload: OnlineAiRecoveryFeedbackPayload): Promise<void> {
        const dedupeKey = `${payload.matchId}:${payload.playerId}:${payload.incidentKind}:${payload.trackerKey}`;
        const now = Date.now();
        const cooldownUntil = this.onlineAiRecoveryFeedbackCooldown.get(dedupeKey) ?? 0;
        if (cooldownUntil > now) {
            return;
        }
        this.onlineAiRecoveryFeedbackCooldown.set(dedupeKey, now + this.onlineAiRecoveryFeedbackCooldownMs);

        if (!this.onlineAiFeedbackReporter && this.shouldSuppressOnlineAiFeedbackPersistence(payload)) {
            logger.info('[GameTransport] online-ai-watchdog feedback persistence suppressed', {
                matchID: payload.matchId,
                gameId: payload.gameId,
                playerID: payload.playerId,
                incidentKind: payload.incidentKind,
                reason: payload.reason,
                trackerKey: payload.trackerKey,
            });
            return;
        }

        const reporter = this.onlineAiFeedbackReporter ?? this.defaultOnlineAiFeedbackReporter.bind(this);
        try {
            await reporter(payload);
            logger.info('[GameTransport] online-ai-watchdog feedback reported', {
                matchID: payload.matchId,
                gameId: payload.gameId,
                playerID: payload.playerId,
                incidentKind: payload.incidentKind,
                reason: payload.reason,
                trackerKey: payload.trackerKey,
            });
        } catch (error) {
            logger.warn('[GameTransport] online-ai-watchdog feedback failed', {
                matchID: payload.matchId,
                gameId: payload.gameId,
                playerID: payload.playerId,
                incidentKind: payload.incidentKind,
                reason: payload.reason,
                trackerKey: payload.trackerKey,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    private shouldSuppressOnlineAiFeedbackPersistence(payload: OnlineAiRecoveryFeedbackPayload): boolean {
        return ONLINE_AI_FEEDBACK_PERSISTENCE_SUPPRESSED_KINDS.has(payload.incidentKind);
    }

    private buildCommandFailureFeedbackPayload(args: {
        match: ActiveMatch;
        playerId: string;
        commandType: string;
        reason: string;
        progressMarker: string;
        stateIdBefore: number;
        visibleState: MatchState<unknown>;
    }): CommandFailureFeedbackPayload {
        const incidentKey = [
            args.playerId,
            args.commandType,
            args.reason,
            args.progressMarker,
        ].join(':');
        const phase = typeof args.match.state.sys?.phase === 'string' ? args.match.state.sys.phase : null;
        const turnNumber = typeof args.match.state.sys?.turnNumber === 'number' ? args.match.state.sys.turnNumber : null;

        return {
            matchId: args.match.matchID,
            gameId: args.match.gameId,
            playerId: args.playerId,
            incidentKind: 'command-failed',
            severity: resolveCommandFailureFeedbackSeverity(args.reason),
            commandType: args.commandType,
            reason: args.reason,
            incidentKey,
            progressMarker: args.progressMarker,
            stateSnapshot: JSON.stringify({
                kind: 'command-failure-feedback',
                commandType: args.commandType,
                reason: args.reason,
                progressMarker: args.progressMarker,
                stateIDBefore: args.stateIdBefore,
                phase,
                turnNumber,
                visibleState: args.visibleState,
            }),
            actionLog: this.buildOnlineAiDiagnosticActionLog({
                state: args.match.state,
                phase,
                progressMarker: args.progressMarker,
                commandType: args.commandType,
                reason: args.reason,
            }),
        };
    }

    private async reportCommandFailureFeedback(payload: CommandFailureFeedbackPayload): Promise<void> {
        const dedupeKey = `${payload.matchId}:${payload.playerId}:${payload.incidentKind}:${payload.incidentKey}`;
        const now = Date.now();
        const cooldownUntil = this.commandFailureFeedbackCooldown.get(dedupeKey) ?? 0;
        if (cooldownUntil > now) {
            return;
        }
        this.commandFailureFeedbackCooldown.set(dedupeKey, now + this.commandFailureFeedbackCooldownMs);

        const reporter = this.commandFailureFeedbackReporter ?? this.defaultCommandFailureFeedbackReporter.bind(this);
        try {
            await reporter(payload);
            logger.info('[GameTransport] command failure feedback reported', {
                matchID: payload.matchId,
                gameId: payload.gameId,
                playerID: payload.playerId,
                commandType: payload.commandType,
                reason: payload.reason,
                incidentKey: payload.incidentKey,
            });
        } catch (error) {
            logger.warn('[GameTransport] command failure feedback failed', {
                matchID: payload.matchId,
                gameId: payload.gameId,
                playerID: payload.playerId,
                commandType: payload.commandType,
                reason: payload.reason,
                incidentKey: payload.incidentKey,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    private buildOnlineAiDiagnosticActionLog(args: {
        state: MatchState<unknown>;
        phase?: unknown;
        progressMarker?: string;
        trackerKey?: string;
        blockerFingerprint?: string | null;
        sharedInteraction?: AiInteractionSnapshot | null;
        sharedSelectability?: InteractionSelectabilityDiagnostic | null;
        interaction?: AiInteractionSnapshot | null;
        seatSelectability?: InteractionSelectabilityDiagnostic | null;
        responseWindow?: AiResponseWindowSnapshot | null;
        pendingDamage?: OnlineAiRecoveryPendingDamageDiagnostic | null;
        commandType?: string;
        reason?: string;
    }): string | undefined {
        const actionLogTail = this.extractOnlineAiRecoveryActionLogTail(args.state);
        const eventStreamTail = this.extractOnlineAiRecoveryEventTail(args.state);
        const interactionOptions = (args.interaction?.options ?? []).slice(0, 8);
        const hasSharedInteraction = Boolean(args.sharedInteraction);
        const hasResponseWindow = Boolean(args.responseWindow);
        const hasPendingDamage = Boolean(args.pendingDamage);
        if (
            actionLogTail.length === 0
            && eventStreamTail.length === 0
            && interactionOptions.length === 0
            && !hasSharedInteraction
            && !hasResponseWindow
            && !hasPendingDamage
            && !args.blockerFingerprint
        ) {
            return undefined;
        }
        return JSON.stringify({
            kind: 'online-ai-feedback-diagnostic',
            ...(args.phase !== undefined ? { phase: args.phase } : {}),
            ...(args.progressMarker ? { progressMarker: args.progressMarker } : {}),
            ...(args.trackerKey ? { trackerKey: args.trackerKey } : {}),
            ...(args.blockerFingerprint ? { blockerFingerprint: args.blockerFingerprint } : {}),
            ...(args.commandType ? { commandType: args.commandType } : {}),
            ...(args.reason ? { reason: args.reason } : {}),
            actionLogTail,
            eventStreamTail,
            ...((hasSharedInteraction || args.interaction)
                ? {
                    interaction: {
                        ...(args.sharedInteraction
                            ? {
                                shared: {
                                    id: args.sharedInteraction.id,
                                    kind: args.sharedInteraction.kind,
                                    sourceId: args.sharedInteraction.sourceId,
                                },
                                sharedSelectability: args.sharedSelectability
                                    ?? buildInteractionSelectabilityDiagnostic(args.sharedInteraction),
                            }
                            : {}),
                        ...(args.interaction
                            ? {
                                seat: {
                                    id: args.interaction.id,
                                    kind: args.interaction.kind,
                                    sourceId: args.interaction.sourceId,
                                    options: interactionOptions,
                                },
                                seatSelectability: args.seatSelectability
                                    ?? buildInteractionSelectabilityDiagnostic(args.interaction),
                            }
                            : {}),
                    },
                }
                : {}),
            ...(args.responseWindow ? { responseWindow: args.responseWindow } : {}),
            ...(args.pendingDamage ? { pendingDamage: args.pendingDamage } : {}),
        });
    }

    private extractOnlineAiRecoveryActionLogTail(
        state: MatchState<unknown>,
    ): OnlineAiRecoveryActionLogTailEntry[] {
        const entries = (state.sys?.actionLog as {
            entries?: Array<{ text?: unknown; event?: { type?: unknown } }>;
        } | undefined)?.entries;
        if (!Array.isArray(entries) || entries.length === 0) {
            return [];
        }
        return entries.slice(-5).map((entry) => ({
            text: typeof entry?.text === 'string' ? entry.text : undefined,
            type: entry?.event?.type,
        }));
    }

    private extractOnlineAiRecoveryEventTail(
        state: MatchState<unknown>,
    ): OnlineAiRecoveryEventTailEntry[] {
        const entries = (state.sys?.eventStream as {
            entries?: Array<{ type?: unknown; timestamp?: unknown; payload?: unknown }>;
        } | undefined)?.entries;
        if (!Array.isArray(entries) || entries.length === 0) {
            return [];
        }
        return entries.slice(-5).map((entry) => ({
            type: typeof entry?.type === 'string' ? entry.type : undefined,
            timestamp: entry?.timestamp,
            ...(entry?.payload !== undefined ? { payload: JSON.parse(JSON.stringify(entry.payload)) } : {}),
        }));
    }

    private async postInternalSystemFeedback(body: Record<string, unknown>): Promise<void> {
        const { endpoint, token } = ONLINE_AI_FEEDBACK_CONFIG;
        if (!endpoint || !token) {
            return;
        }
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Feedback-Token': token,
            },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            throw new Error(`feedback_http_${response.status}`);
        }
    }

    private async defaultOnlineAiFeedbackReporter(payload: OnlineAiRecoveryFeedbackPayload): Promise<void> {
        await this.postInternalSystemFeedback({
            content: `[system][online-ai-watchdog] ${payload.incidentKind} ${payload.reason}`,
            type: 'bug',
            severity: payload.severity,
            ...(payload.status ? { status: payload.status } : {}),
            source: 'online-ai-watchdog',
            autoReportKind: payload.incidentKind,
            incidentKey: payload.trackerKey,
            gameName: payload.gameId,
            contactInfo: 'system:online-ai-watchdog',
            actionLog: payload.actionLog,
            stateSnapshot: payload.stateSnapshot,
            clientContext: {
                route: 'server-watchdog',
                mode: 'online',
                matchId: payload.matchId,
                playerId: payload.playerId,
                gameId: payload.gameId,
                timezone: 'server',
            },
            errorContext: {
                source: 'online-ai-watchdog',
                message: payload.reason,
                name: payload.incidentKind,
            },
        });
    }

    private async defaultCommandFailureFeedbackReporter(payload: CommandFailureFeedbackPayload): Promise<void> {
        await this.postInternalSystemFeedback({
            content: `[system][command-failed] ${payload.commandType} ${payload.reason}`,
            type: 'bug',
            severity: payload.severity,
            source: 'player-command-failure',
            autoReportKind: payload.incidentKind,
            incidentKey: payload.incidentKey,
            gameName: payload.gameId,
            contactInfo: 'system:player-command-failure',
            actionLog: payload.actionLog,
            stateSnapshot: payload.stateSnapshot,
            clientContext: {
                route: 'server-command',
                mode: 'online',
                matchId: payload.matchId,
                playerId: payload.playerId,
                gameId: payload.gameId,
                timezone: 'server',
            },
            errorContext: {
                source: 'player-command-failure',
                message: payload.reason,
                name: payload.commandType,
            },
        });
    }

    private async tryRecoverOnlineAiWithLegalAction(
        match: ActiveMatch,
        candidate: ForceEndTurnStalledAiResolution,
        tracker: OnlineAiRecoveryTracker,
        seatControllers: Record<string, OnlineAiWatchdogSeatController>,
    ): Promise<OnlineAiLegalActionRecoveryResult> {
        return this.tryRecoverOnlineAiWithLegalActionFromRuntime(
            candidate,
            tracker,
            this.createOnlineAiRecoveryRuntimeBase(match, seatControllers),
        );
    }

    private async tryRecoverOnlineAiWithLegalActionFromRuntime(
        candidate: ForceEndTurnStalledAiResolution,
        tracker: OnlineAiRecoveryTracker,
        runtime: OnlineAiRecoveryRuntimeBase,
    ): Promise<OnlineAiLegalActionRecoveryResult> {
        const seatController = runtime.seatControllers[candidate.playerId];
        if (!seatController || seatController.type === 'human') {
            return buildOnlineAiNoLegalActionRecoveryResult();
        }
        const decisionViewResolvers = buildOnlineAiDecisionViewResolvers({
            runtime: getGameAiRuntime(runtime.gameId) ?? null,
            sharedState: runtime.readState(),
            resolvePrivateOverlay: runtime.resolvePrivateOverlay,
        });

        let aiDispatchResult = await dispatchOnlineAiWithResolvedSeatView({
            dispatchResolver: aiModule.resolveNextAiDispatch,
            engineConfig: runtime.engineConfig,
            state: runtime.readState(),
            matchId: runtime.matchId,
            seatControllers: {
                [candidate.playerId]: seatController,
            },
            decisionViewResolvers,
            mode: 'strict',
        });

        const canUseEmergencyOverlayFallback = shouldUseOnlineAiEmergencyOverlayFallback(candidate.reason);
        let dispatchDecision = resolveOnlineAiLegalActionDispatchDecision({
            candidateReason: candidate.reason,
            allowEmergencyOverlayRetry: canUseEmergencyOverlayFallback,
            dispatchResult: aiDispatchResult,
        });

        if (dispatchDecision.kind === 'retry-with-emergency-overlay') {
            logger.warn('[GameTransport] online-ai-watchdog retrying legal-action with emergency playerView', {
                matchID: runtime.matchId,
                gameId: runtime.gameId,
                playerID: candidate.playerId,
                reason: candidate.reason,
                blockedReason: dispatchDecision.blocked.blockedReason,
                blockedKey: dispatchDecision.blocked.blockedKey,
            });

            aiDispatchResult = await dispatchOnlineAiWithResolvedSeatView({
                dispatchResolver: aiModule.resolveNextAiDispatch,
                engineConfig: runtime.engineConfig,
                state: runtime.readState(),
                matchId: runtime.matchId,
                seatControllers: {
                    [candidate.playerId]: seatController,
                },
                decisionViewResolvers,
                mode: 'emergency',
            });
            dispatchDecision = resolveOnlineAiLegalActionDispatchDecision({
                candidateReason: candidate.reason,
                allowEmergencyOverlayRetry: false,
                dispatchResult: aiDispatchResult,
            });
        }

        if (dispatchDecision.kind !== 'action') {
            if (dispatchDecision.kind === 'blocked') {
                logger.info('[GameTransport] online-ai-watchdog legal-action blocked', {
                    matchID: runtime.matchId,
                    gameId: runtime.gameId,
                    playerID: dispatchDecision.logContext.playerId,
                    blockedReason: dispatchDecision.logContext.blockedReason,
                    visibility: dispatchDecision.logContext.visibility,
                    blockedKey: dispatchDecision.logContext.blockedKey,
                });
                if (dispatchDecision.overlayResyncRequest) {
                    runtime.requestOverlayResync({
                        playerId: dispatchDecision.overlayResyncRequest.playerId,
                        blockedReason: dispatchDecision.overlayResyncRequest.blockedReason,
                        blockedKey: dispatchDecision.overlayResyncRequest.blockedKey,
                        progressMarker: buildAiProgressMarker(runtime.readState(), {
                            engineConfig: runtime.engineConfig,
                        }),
                    });
                }
                return dispatchDecision.recoveryResult;
            }
            return dispatchDecision.recoveryResult;
        }

        const resolution = dispatchDecision.resolution;
        if (resolution.playerId !== candidate.playerId || resolution.action.commands.length === 0) {
            return buildOnlineAiNoLegalActionRecoveryResult();
        }

        const beforeTrackerSnapshot = buildOnlineAiRecoveryTrackerSnapshot({
            state: runtime.readState(),
            candidate,
            engineConfig: runtime.engineConfig,
        });
        const commandExecution = await executeOnlineAiLegalActionRecoveryCommands({
            candidateReason: candidate.reason,
            resolution,
            beforeTrackerSnapshot,
            readAfterTrackerSnapshot: () => buildOnlineAiRecoveryTrackerSnapshot({
                state: runtime.readState(),
                candidate,
                engineConfig: runtime.engineConfig,
            }),
            executeCommand: (command) => runtime.executeSuppressedCommand(
                resolution.playerId,
                command.type,
                command.payload,
            ),
        });
        if (commandExecution.kind === 'command-failed') {
            tracker.autoSubmittedAt = null;
            return commandExecution.recoveryResult;
        }
        const { beforeTrackerSnapshot: appliedBeforeTrackerSnapshot, afterTrackerSnapshot } = commandExecution;

        // legal-action recovery 会串行执行 1..N 条命令，前面用 suppressBroadcast 合并中间态；
        // 一旦最终确实推进了权威状态，这里必须补发一次统一广播，否则房间前端看不到 watchdog 代打后的召唤/推进结果。
        runtime.broadcastState();

        const resolved = await this.hasOnlineAiRecoveryResolved(candidate, {
            readState: runtime.readState,
            resolveLatestCandidate: runtime.resolveLatestCandidate,
            resolvePrivateOverlay: runtime.resolvePrivateOverlay,
            seatControllers: runtime.seatControllers,
        });
        const finalization = finalizeOnlineAiAppliedLegalActionRecovery({
            recoveryResult: commandExecution.recoveryResult,
            resolution,
            beforeTrackerSnapshot: appliedBeforeTrackerSnapshot,
            afterTrackerSnapshot,
            resolved,
        });
        if (finalization.trackerDisposition === 'delete') {
            runtime.clearStoredTracker();
        } else {
            tracker.autoSubmittedAt = null;
            tracker.firstSeenAt = Date.now();
        }

        logger.info('[GameTransport] online-ai-watchdog recovered stalled AI via legal action', {
            matchID: runtime.matchId,
            gameId: runtime.gameId,
            playerID: finalization.logContext.playerId,
            incidentKey: tracker.key,
            actionId: finalization.logContext.actionId,
            actionKind: finalization.logContext.actionKind,
            markerBefore: finalization.logContext.markerBefore,
            markerAfter: finalization.logContext.markerAfter,
            resolved: finalization.logContext.resolved,
        });

        return finalization.recoveryResult;
    }

    private maybeTriggerOnlineAiOverlayResync(args: {
        match: ActiveMatch;
        playerId: string;
        blockedReason: 'missing-private-overlay' | 'stale-private-overlay';
        blockedKey: string;
        progressMarker: string;
    }): void {
        const now = Date.now();
        const cooldownKey = `${args.match.matchID}:${args.playerId}:${args.blockedKey}:${args.progressMarker}`;
        const cooldownUntil = this.onlineAiOverlayResyncCooldown.get(cooldownKey) ?? 0;
        if (cooldownUntil > now) {
            return;
        }

        this.onlineAiOverlayResyncCooldown.set(cooldownKey, now + DEFAULT_ONLINE_AI_OVERLAY_RESYNC_COOLDOWN_MS);
        logger.warn('[GameTransport] online-ai-watchdog requested overlay resync', {
            matchID: args.match.matchID,
            gameId: args.match.gameId,
            playerID: args.playerId,
            blockedReason: args.blockedReason,
            blockedKey: args.blockedKey,
        });
        this.broadcastState(args.match);
    }

    private hasRecentOnlineAiOverlayResync(args: {
        matchId: string;
        playerId: string;
        progressMarker: string;
    }): boolean {
        const now = Date.now();
        const keySuffix = `:${args.progressMarker}`;
        for (const [cooldownKey, expiresAt] of this.onlineAiOverlayResyncCooldown.entries()) {
            if (expiresAt <= now) {
                continue;
            }
            if (!cooldownKey.startsWith(`${args.matchId}:${args.playerId}:`)) {
                continue;
            }
            if (!cooldownKey.endsWith(keySuffix)) {
                continue;
            }
            return true;
        }
        return false;
    }

    private async drainCommandQueue(match: ActiveMatch): Promise<void> {
        while (match.commandQueue.length > 0) {
            const next = match.commandQueue.shift()!;
            try {
                if ('_batch' in next) {
                    await next.execute();
                    next.resolve(true);
                } else {
                    const queuedSuccess = await this.executeCommandInternal(
                        match,
                        next.playerID,
                        next.commandType,
                        next.payload,
                        next.options,
                    );
                    next.resolve(queuedSuccess);
                }
            } catch (error) {
                logger.error('[GameTransport] 队列中命令执行异常', {
                    matchID: match.matchID,
                    error: error instanceof Error ? error.message : String(error),
                });
                next.resolve(false);
            }
        }
    }

    // ========================================================================
    // 内部处理
    // ========================================================================

    private async handleSync(
        socket: IOSocket,
        matchID: string,
        playerID: string | null,
        credentials?: string,
    ): Promise<void> {
        // 加载或获取活跃对局
        let match = this.activeMatches.get(matchID);
        const reusedActiveMatch = Boolean(match);
        if (!match) {
            match = await this.loadMatch(matchID);
            if (!match) {
                socket.emit('error', matchID, 'match_not_found');
                return;
            }
        }

        // 认证（旁观者无需凭证）。
        // 这里必须基于存储层最新 metadata 做校验，避免 leave/join 后内存缓存滞后。
        if (playerID !== null) {
            const authMetadata = reusedActiveMatch
                ? await this.readFreshAuthMetadata(matchID, match.metadata) ?? match.metadata
                : match.metadata;
            const ok = await this.validateCommandAuth(matchID, playerID, credentials, authMetadata);
            if (!ok) {
                socket.emit('error', matchID, 'unauthorized');
                return;
            }
        }

        // 注册 socket
        const prevInfo = this.socketIndex.get(socket.id);
        if (prevInfo && (prevInfo.matchID !== matchID || prevInfo.playerID !== playerID)) {
            this.removeSocketFromMatch(socket.id, prevInfo);
        }

        this.socketIndex.set(socket.id, { matchID, playerID, credentials });
        socket.join(`game:${matchID}`);

        if (playerID === null) {
            match.spectatorSockets.add(socket.id);
        } else {
            // 更新连接状态
            const conns = match.connections.get(playerID) ?? new Set();
            conns.add(socket.id);
            match.connections.set(playerID, conns);

            // 取消离线裁决定时器
            const timer = match.offlineTimers.get(playerID);
            if (timer) {
                clearTimeout(timer);
                match.offlineTimers.delete(playerID);
            }

            // 更新 metadata 连接状态
            if (match.metadata.players[playerID]) {
                const wasConnected = match.metadata.players[playerID].isConnected === true;
                match.metadata.players[playerID].isConnected = true;
                if (!wasConnected) {
                    match.metadata.updatedAt = Date.now();
                    this.storage.setMetadata(matchID, match.metadata).catch((error) => {
                        logger.warn('[GameTransport] persist connected metadata failed', {
                            matchID,
                            playerID,
                            error,
                        });
                    });
                }
            }
        }

        // 发送当前状态（经 playerView 过滤 + 传输裁剪）
        // state:sync 必须保留 eventStream entries，作为后续 state:patch 的权威基线；
        // 重连后的“避免历史事件重播”由客户端事件游标在 onConnectionChange/reconcile 层处理，
        // 不能再靠裁掉 eventStream 来破坏 patch 连续性。
        const viewState = this.stripStateForTransport(this.applyPlayerView(match, playerID));
        const matchPlayers = this.buildMatchPlayers(match);
        socket.emit('state:sync', matchID, viewState, matchPlayers, {
            seed: match.randomSeed,
            cursor: match.getRandomCursor(),
        }, {
            stateID: match.stateID,
        });

        // 写入缓存，确保后续走 diff 基准正确
        // JSON round-trip 消除 undefined 值的 key，确保缓存结构与客户端（经 socket.io JSON 序列化）一致。
        // 否则 fast-json-patch 的 compare 会对 { key: undefined } → { key: value } 生成 replace 而非 add，
        // 导致客户端 patch 应用失败（路径不存在）。
        match.lastBroadcastedViews.set(playerID ?? 'spectator', JSON.parse(JSON.stringify(viewState)));

        // 通知其他玩家（旁观者不触发玩家连接事件）
        if (playerID !== null) {
            socket.to(`game:${matchID}`).emit('player:connected', matchID, playerID);
        }
    }

    private async handleCommand(
        matchID: string,
        playerID: string,
        commandType: string,
        payload: unknown,
    ): Promise<boolean> {
        const match = this.activeMatches.get(matchID);
        if (!match) return false;

        // 串行执行：如果正在执行，加入队列
        if (match.executing) {
            return new Promise<boolean>((resolve) => {
                match.commandQueue.push({
                    commandType,
                    payload,
                    playerID,
                    options: { reportFailureFeedback: true },
                    resolve,
                });
            });
        }

        match.executing = true;
        try {
            const success = await this.executeCommandInternal(
                match,
                playerID,
                commandType,
                payload,
                { reportFailureFeedback: true },
            );
            await this.drainCommandQueue(match);
            return success;
        } finally {
            match.executing = false;
        }
    }

    /**
     * 处理批量命令（Task 7）
     * 
     * 批次内命令串行执行，任一失败则中止并回滚整个批次。
     * 成功后返回权威状态（已裁剪 EventStream）。
     */
    private async handleBatch(
        socket: IOSocket,
        matchID: string,
        playerID: string,
        batchId: string,
        commands: Array<{ type: string; payload: unknown }>,
        meta?: BatchDispatchMeta,
    ): Promise<void> {
        emitOnlineAiBatchTrace('handle-batch-enter', {
            matchID,
            playerID,
            batchId,
            commandTypes: commands.map((command) => command.type),
            expectedStateID: meta?.expectedStateID ?? null,
        });
        const match = this.activeMatches.get(matchID);
        if (!match) {
            emitOnlineAiBatchTrace('handle-batch-match-missing', { matchID, playerID, batchId });
            socket.emit('batch:rejected', matchID, batchId, 'match_not_found');
            return;
        }

        // 串行执行：如果正在执行，将整个 batch 任务排入队列（与 handleCommand 保持一致）
        if (match.executing) {
            emitOnlineAiBatchTrace('handle-batch-queued', {
                matchID,
                playerID,
                batchId,
                queuedLength: match.commandQueue.length,
            });
            await new Promise<void>((resolve) => {
                match.commandQueue.push({
                    _batch: true,
                    execute: () => this.executeBatchInternal(socket, match, playerID, batchId, commands, meta),
                    resolve: () => resolve(),
                });
            });
            return;
        }

        match.executing = true;
        // 在执行前保存内存快照，用于批次失败时回滚
        // rollbackToStateID 依赖存储层，但存储层只保存最新状态，无法回到中间状态
        const snapshotState = match.state;
        const snapshotStateID = match.stateID;

        try {
            if (this.rejectBatchWhenStatePreconditionFails(socket, matchID, batchId, match, meta)) {
                emitOnlineAiBatchTrace('handle-batch-stale-rejected', {
                    matchID,
                    playerID,
                    batchId,
                    expectedStateID: meta?.expectedStateID ?? null,
                    actualStateID: match.stateID,
                });
                return;
            }
            // 批次内命令串行执行（抑制中间广播，避免客户端收到中间状态导致动画重播）
            for (const cmd of commands) {
                match.lastCommandFailureReason = null;
                const success = await this.executeCommandInternal(match, playerID, cmd.type, cmd.payload, {
                    suppressBroadcast: true,
                    reportFailureFeedback: true,
                });
                if (!success) {
                    const failureReason = match.lastCommandFailureReason ?? GENERIC_COMMAND_FAILURE_REASON;
                    emitOnlineAiBatchTrace('handle-batch-command-failed', {
                        matchID,
                        playerID,
                        batchId,
                        commandType: cmd.type,
                        failureReason,
                    });
                    // 命令失败 - 从内存快照恢复到批次开始前的状态
                    match.state = snapshotState;
                    match.stateID = snapshotStateID;
                    // 持久化回滚后的状态，确保存储层与内存一致
                    const rollbackStored = {
                        G: snapshotState,
                        _stateID: snapshotStateID,
                        randomSeed: match.randomSeed,
                        randomCursor: match.getRandomCursor(),
                    };
                    await this.storage.setState(matchID, rollbackStored);
                    this.broadcastState(match);
                    socket.emit('batch:rejected', matchID, batchId, failureReason);
                    return;
                }
            }

            // 批次成功 - 广播最终状态给所有玩家（包括对手），然后发送确认给发送者
            this.broadcastState(match);
            // batch:confirmed 是乐观更新的确认响应，客户端已通过本地预测消费了事件
            const authoritative = this.stripStateForTransport(match.state, { stripEventStream: true });
            emitOnlineAiBatchTrace('handle-batch-confirmed', {
                matchID,
                playerID,
                batchId,
                stateID: match.stateID,
            });
            socket.emit('batch:confirmed', matchID, batchId, authoritative);
        } finally {
            await this.drainCommandQueue(match);
            match.executing = false;
        }
    }

    /**
     * batch 核心执行逻辑（供 handleBatch 直接调用和队列消费共用）
     * 调用方负责设置/清理 match.executing，此方法不修改 executing 标志。
     */
    private async executeBatchInternal(
        socket: IOSocket,
        match: ActiveMatch,
        playerID: string,
        batchId: string,
        commands: Array<{ type: string; payload: unknown }>,
        meta?: BatchDispatchMeta,
    ): Promise<void> {
        const matchID = match.matchID;
        const snapshotState = match.state;
        const snapshotStateID = match.stateID;

        if (this.rejectBatchWhenStatePreconditionFails(socket, matchID, batchId, match, meta)) {
            emitOnlineAiBatchTrace('execute-batch-stale-rejected', {
                matchID,
                playerID,
                batchId,
                expectedStateID: meta?.expectedStateID ?? null,
                actualStateID: match.stateID,
            });
            return;
        }

        // 批次内命令串行执行（抑制中间广播，避免客户端收到中间状态导致动画重播）
        for (const cmd of commands) {
            match.lastCommandFailureReason = null;
            const success = await this.executeCommandInternal(match, playerID, cmd.type, cmd.payload, {
                suppressBroadcast: true,
                reportFailureFeedback: true,
            });
            if (!success) {
                const failureReason = match.lastCommandFailureReason ?? GENERIC_COMMAND_FAILURE_REASON;
                emitOnlineAiBatchTrace('execute-batch-command-failed', {
                    matchID,
                    playerID,
                    batchId,
                    commandType: cmd.type,
                    failureReason,
                });
                match.state = snapshotState;
                match.stateID = snapshotStateID;
                const rollbackStored = {
                    G: snapshotState,
                    _stateID: snapshotStateID,
                    randomSeed: match.randomSeed,
                    randomCursor: match.getRandomCursor(),
                };
                await this.storage.setState(matchID, rollbackStored);
                this.broadcastState(match);
                socket.emit('batch:rejected', matchID, batchId, failureReason);
                return;
            }
        }

        // 批次成功 - 广播最终状态给所有玩家，然后发送确认给发送者
        this.broadcastState(match);
        const authoritative = this.stripStateForTransport(match.state, { stripEventStream: true });
        emitOnlineAiBatchTrace('execute-batch-confirmed', {
            matchID,
            playerID,
            batchId,
            stateID: match.stateID,
        });
        socket.emit('batch:confirmed', matchID, batchId, authoritative);
    }

    private rejectBatchWhenStatePreconditionFails(
        socket: IOSocket,
        matchID: string,
        batchId: string,
        match: ActiveMatch,
        meta?: BatchDispatchMeta,
    ): boolean {
        const expectedStateID = meta?.expectedStateID;
        if (typeof expectedStateID !== 'number') {
            return false;
        }
        if (match.stateID === expectedStateID) {
            return false;
        }

        logger.warn('[GameTransport] batch rejected due to stale state precondition', {
            matchID,
            batchId,
            expectedStateID,
            actualStateID: match.stateID,
        });
        socket.emit('batch:rejected', matchID, batchId, 'stale_state');
        return true;
    }

    /**
     * 回滚到指定 stateID（从存储层重新加载）
     */
    private async rollbackToStateID(match: ActiveMatch, targetStateID: number): Promise<void> {
        const result = await this.storage.fetch(match.matchID, { state: true });
        if (!result.state || result.state._stateID !== targetStateID) {
            logger.error(`[GameTransport] Rollback failed: state ${targetStateID} not found`);
            return;
        }

        match.state = rehydrateStoredMatchState(
            match.matchID,
            match.engineConfig,
            result.state.G,
            match.playerIds,
        );
        match.stateID = targetStateID;

        // 广播回滚后的状态
        this.broadcastState(match);
    }

    /**
     * 传输前状态裁剪（统一入口）
     *
     * 在 playerView 过滤之后、socket.emit 之前调用，移除客户端不需要的大体积数据：
     * 1. undo.snapshots — 完整 MatchState 深拷贝，客户端只需 length（判断能否撤回）
     *    ⚠️ 安全：快照含所有玩家完整状态（手牌/牌库），不过滤会泄漏隐私信息
     * 2. eventStream.entries — 仅在 batch 确认时清空；正常广播与 state:sync 都保留（客户端需消费事件驱动动画，且 patch baseline 依赖完整 entries）
     * 3. log.entries — 引擎级调试日志（command/event 完整对象），客户端 UI 层不读取
     * 4. tutorial.steps — 客户端只用 step（当前步骤）和 stepIndex，steps 数组只需 length
     *
     * @param options.stripEventStream 是否清空 eventStream.entries（默认 false）
     *   - true: 仅用于 batch:confirmed（乐观确认），客户端不需要历史事件
     *   - false: 用于 state:sync / state:update，客户端需要保留完整 baseline 与事件驱动动画/特效/交互
     */
    private stripStateForTransport(viewState: unknown, options?: { stripEventStream?: boolean }): unknown {
        const serializeTransportState = <T,>(state: T): T => JSON.parse(JSON.stringify(state)) as T;
        const state = viewState as { sys?: Record<string, unknown> };
        if (!state.sys) return serializeTransportState(viewState);

        const sys = state.sys;
        const patches: Record<string, unknown> = {};

        // 1. undo: 清空 snapshots，保留 length 供客户端判断"能否撤回"
        const undo = sys.undo as { snapshots?: unknown[]; maxSnapshots?: number; pendingRequest?: unknown } | undefined;
        if (undo?.snapshots && undo.snapshots.length > 0) {
            patches.undo = {
                ...undo,
                snapshots: [],
                /** 客户端通过此字段判断是否有可撤回的快照 */
                snapshotCount: undo.snapshots.length,
            };
        }

        // 2. eventStream: 仅在 stripEventStream=true 时清空 entries（批次确认）
        //    state:sync / broadcastState 都需要保留 entries：
        //    - state:sync: 作为后续 patch apply 的完整 baseline
        //    - broadcastState: 供客户端 EventStream 消费（如技能触发事件）
        const shouldStripEventStream = options?.stripEventStream ?? false;
        if (shouldStripEventStream) {
            const es = sys.eventStream as { entries?: unknown[]; nextId?: number; maxEntries?: number } | undefined;
            if (es?.entries && es.entries.length > 0) {
                const lastEntry = es.entries[es.entries.length - 1] as { id?: number } | undefined;
                patches.eventStream = {
                    ...es,
                    entries: [],
                    nextId: (lastEntry?.id ?? (es.nextId ?? 1) - 1) + 1,
                };
            }
        }

        // 3. log: LogSystem 已移除，无需裁剪（entries 始终为空）

        // 4. tutorial: 只保留 step + stepIndex + 标量字段，steps 数组替换为空数组 + totalSteps
        const tutorial = sys.tutorial as {
            active?: boolean;
            steps?: unknown[];
            step?: unknown;
            stepIndex?: number;
        } | undefined;
        if (tutorial?.steps && tutorial.steps.length > 0) {
            patches.tutorial = {
                ...tutorial,
                steps: [],
                /** 客户端通过此字段判断 isLastStep */
                totalSteps: tutorial.steps.length,
            };
        }

        // 无需裁剪
        if (Object.keys(patches).length === 0) {
            return serializeTransportState(viewState);
        }

        return serializeTransportState({
            ...state,
            sys: { ...sys, ...patches },
        });
    }

    private stripStateForTraining(viewState: unknown): unknown {
        const stripped = this.stripStateForTransport(viewState, { stripEventStream: true }) as {
            sys?: Record<string, unknown>;
        };

        if (!stripped?.sys) return stripped;

        const sys = stripped.sys;
        const patches: Record<string, unknown> = {};

        const actionLog = sys.actionLog as { entries?: unknown[] } | undefined;
        if (actionLog?.entries && actionLog.entries.length > 0) {
            patches.actionLog = {
                ...actionLog,
                entries: [],
                entryCount: actionLog.entries.length,
            };
        }

        const log = sys.log as { entries?: unknown[] } | undefined;
        if (log?.entries && log.entries.length > 0) {
            patches.log = {
                ...log,
                entries: [],
                entryCount: log.entries.length,
            };
        }

        if (Object.keys(patches).length === 0) return stripped;

        return {
            ...stripped,
            sys: { ...sys, ...patches },
        };
    }

    private resolveTrainingMatchDurationMs(match: ActiveMatch): number | null {
        const createdAt = match.metadata.createdAt;
        if (typeof createdAt !== 'number' || !Number.isFinite(createdAt)) {
            return null;
        }
        return Date.now() - createdAt;
    }

    private isTrainingCaptureEligible(match: ActiveMatch): boolean {
        if (this.trainingDataMinMatchDurationMs <= 0) {
            return true;
        }
        const durationMs = this.resolveTrainingMatchDurationMs(match);
        if (durationMs === null) {
            return false;
        }
        return durationMs >= this.trainingDataMinMatchDurationMs;
    }

    private recordTrainingDecisionSample(args: {
        match: ActiveMatch;
        playerID: string;
        commandType: string;
        payload: unknown;
        stateIdBefore: number;
        stateIdAfter: number;
        preState: unknown;
        postState: unknown;
        gameOver?: unknown;
    }): void {
        if (!this.trainingDataRecorder) return;
        const manifest = this.gameManifests[args.match.engineConfig.gameId];
        if (manifest?.ai?.capture === false) return;
        const seatControllers = extractSetupSeatControllers(args.match.metadata.setupData);
        const seatControllerType = resolveSeatControllerTypeForTraining(seatControllers, args.playerID);
        const capturePolicy = manifest?.ai?.capturePolicy ?? DEFAULT_TRAINING_CAPTURE_POLICY;
        if (capturePolicy === 'human-only' && seatControllerType !== 'human') {
            return;
        }

        const sample = buildTrainingDecisionSample({
            rulesVersion: this.rulesVersion,
            gameId: args.match.engineConfig.gameId,
            matchId: args.match.matchID,
            playerId: args.playerID,
            seatControllerType,
            stateIdBefore: args.stateIdBefore,
            stateIdAfter: args.stateIdAfter,
            commandType: args.commandType,
            payload: args.payload,
            preState: args.preState,
            postState: args.postState,
            legalActions: buildAiDecisionContext({
                gameId: args.match.engineConfig.gameId,
                matchId: args.match.matchID,
                playerId: args.playerID,
                visibleState: args.preState as MatchState<unknown>,
                rulesVersion: this.rulesVersion,
                decisionBudgetMs: 250,
                source: 'online',
            }).legalActions,
            gameOver: args.gameOver,
        });

        const matchId = args.match.matchID;
        if (this.eligibleTrainingMatches.has(matchId)) {
            this.recordTrainingDecisionSampleNow(sample);
            if (args.gameOver) {
                this.eligibleTrainingMatches.delete(matchId);
                this.pendingTrainingSamples.delete(matchId);
            }
            return;
        }

        const pending = this.pendingTrainingSamples.get(matchId) ?? {
            matchId,
            gameId: args.match.engineConfig.gameId,
            samples: [],
        };
        pending.samples.push(sample);
        this.pendingTrainingSamples.set(matchId, pending);

        if (this.isTrainingCaptureEligible(args.match)) {
            this.eligibleTrainingMatches.add(matchId);
            this.flushTrainingDecisionSamples(matchId, args.gameOver);
            if (args.gameOver) {
                this.eligibleTrainingMatches.delete(matchId);
            }
            return;
        }

        if (args.gameOver) {
            this.pendingTrainingSamples.delete(matchId);
        }
    }

    private flushTrainingDecisionSamples(matchID: string, gameOver?: unknown): void {
        const pending = this.pendingTrainingSamples.get(matchID);
        if (!pending || pending.samples.length === 0) {
            this.pendingTrainingSamples.delete(matchID);
            return;
        }

        this.pendingTrainingSamples.delete(matchID);

        for (const sample of pending.samples) {
            if (gameOver && sample.gameOver === undefined) {
                sample.gameOver = gameOver;
            }
            this.recordTrainingDecisionSampleNow(sample, pending);
        }
    }

    private recordTrainingDecisionSampleNow(
        sample: TrainingDecisionSample,
        context?: { matchId: string; gameId: string },
    ): void {
        Promise.resolve(this.trainingDataRecorder?.recordDecisionSample(sample)).catch((error) => {
            logger.warn('[GameTransport] training data capture failed', {
                matchID: context?.matchId ?? sample.matchId,
                gameId: context?.gameId ?? sample.gameId,
                commandType: sample.command.type,
                playerID: sample.playerId,
                error: error instanceof Error ? error.message : String(error),
            });
        });
    }

    private async executeCommandInternal(
        match: ActiveMatch,
        playerID: string,
        commandType: string,
        payload: unknown,
        options?: ExecuteCommandInternalOptions,
    ): Promise<boolean> {
        const startTime = Date.now();
        match.lastCommandFailureReason = null;
        const { engineConfig, state, random, playerIds } = match;
        const stateIdBefore = match.stateID;
        const preTrainingState = this.stripStateForTraining(this.applyPlayerView(match, playerID)) as MatchState<unknown>;
        const progressMarkerBeforeCommand = buildAiProgressMarker(match.state, {
            engineConfig,
            gameId: match.gameId,
        });
        const setupSeatControllers = extractSetupSeatControllers(match.metadata.setupData);
        const seatControllerType = resolveSeatControllerTypeForTraining(setupSeatControllers, playerID);

        let effectiveCommandType = commandType;
        let effectivePayload = payload;
        if (seatControllerType !== 'human' && commandType === INTERACTION_COMMANDS.RESPOND) {
            const cancelPayload = resolveAiEmergencySkipCancelPayload(preTrainingState, payload);
            if (cancelPayload) {
                effectiveCommandType = INTERACTION_COMMANDS.CANCEL;
                effectivePayload = cancelPayload;
            }
        }

        const command: Command = {
            type: effectiveCommandType,
            playerId: playerID,
            payload: effectivePayload,
            timestamp: Date.now(),
        };

        const pipelineConfig: PipelineConfig<unknown, Command, GameEvent> = {
            domain: engineConfig.domain as DomainCore<unknown, Command, GameEvent>,
            systems: engineConfig.systems as EngineSystem<unknown>[],
            systemsConfig: engineConfig.systemsConfig,
        };

        let result;
        try {
            result = executePipeline(pipelineConfig, state, command, random, playerIds);
        } catch (error) {
            const failureReason = formatPipelineFailureReason(error);
            match.lastCommandFailureReason = failureReason;
            gameLogger.commandFailed(
                match.matchID,
                commandType,
                playerID,
                error instanceof Error ? error : new Error(String(error))
            );

            // 通知发送者
            const nsp = this.io.of('/game');
            const sockets = match.connections.get(playerID);
            if (sockets) {
                for (const sid of sockets) {
                    nsp.to(sid).emit('error', match.matchID, failureReason);
                }
            }

            if (options?.reportFailureFeedback && shouldAutoReportCommandFailure(failureReason)) {
                await this.reportCommandFailureFeedback(this.buildCommandFailureFeedbackPayload({
                    match,
                    playerId: playerID,
                    commandType: effectiveCommandType,
                    reason: failureReason,
                    progressMarker: progressMarkerBeforeCommand,
                    stateIdBefore,
                    visibleState: preTrainingState,
                }));
            }

            // 自动取消 pending interaction（防止游戏卡死）
            // 但如果当前命令本身就是 CANCEL，不能再次递归触发取消.
            if (effectiveCommandType !== INTERACTION_COMMANDS.CANCEL) {
                await this.cancelInteractionOnError(match, playerID);
                match.lastCommandFailureReason = failureReason;
            }

            return false;
        }

        const duration = Date.now() - startTime;

        if (!result.success) {
            const failureReason = normalizeCommandFailureReason(result.error);
            match.lastCommandFailureReason = failureReason;
            gameLogger.commandFailed(
                match.matchID,
                commandType,
                playerID,
                new Error(failureReason)
            );

            // 通知发送者
            const nsp = this.io.of('/game');
            const sockets = match.connections.get(playerID);
            if (sockets) {
                for (const sid of sockets) {
                    nsp.to(sid).emit('error', match.matchID, failureReason);
                }
            }

            if (options?.reportFailureFeedback && shouldAutoReportCommandFailure(failureReason)) {
                await this.reportCommandFailureFeedback(this.buildCommandFailureFeedbackPayload({
                    match,
                    playerId: playerID,
                    commandType: effectiveCommandType,
                    reason: failureReason,
                    progressMarker: progressMarkerBeforeCommand,
                    stateIdBefore,
                    visibleState: preTrainingState,
                }));
            }
            return false;
        }

        match.lastCommandFailureReason = null;

        // 记录成功日志
        gameLogger.commandExecuted(match.matchID, effectiveCommandType, playerID, duration);

        // 记录关键游戏事件（用于 bug 追溯）
        let unsatisfiableInteractionFeedback: OnlineAiRecoveryFeedbackPayload | null = null;
        for (const event of result.events) {
            const eventType = (event as GameEvent).type;
            
            // SmashUp: 基地计分
            if (eventType === 'su:base_scored') {
                const payload = ((event as GameEvent).payload ?? {}) as Record<string, unknown>;
                logger.info('game_event', {
                    matchID: match.matchID,
                    gameId: engineConfig.gameId,
                    eventType: 'base_scored',
                    baseDefId: payload.baseDefId,
                    rankings: payload.rankings,
                    timestamp: (event as GameEvent).timestamp,
                });
            }
            
            // SmashUp: VP 授予
            if (eventType === 'su:vp_awarded') {
                const payload = ((event as GameEvent).payload ?? {}) as Record<string, unknown>;
                logger.info('game_event', {
                    matchID: match.matchID,
                    gameId: engineConfig.gameId,
                    eventType: 'vp_awarded',
                    playerId: payload.playerId,
                    amount: payload.amount,
                    reason: payload.reason,
                    timestamp: (event as GameEvent).timestamp,
                });
            }

            if (
                seatControllerType !== 'human'
                && (effectiveCommandType === INTERACTION_COMMANDS.RESPOND || effectiveCommandType === INTERACTION_COMMANDS.CANCEL)
                && eventType === INTERACTION_EVENTS.CANCELLED
            ) {
                const payload = (event as GameEvent & {
                    payload?: {
                        reason?: unknown;
                        interactionId?: unknown;
                    };
                }).payload;
                const rawReason = typeof payload?.reason === 'string' ? payload.reason : null;
                const inferredReason = rawReason ?? resolveUnsatisfiableReasonFromSelectability(
                    extractAiInteractionSnapshot(preTrainingState),
                );
                const reason = inferredReason;
                if (reason && UNSATISFIABLE_INTERACTION_REASONS.has(reason)) {
                    const interaction = extractAiInteractionSnapshot(preTrainingState);
                    const sharedInteraction = extractAiInteractionSnapshot(match.state);
                    if (shouldSuppressUnsatisfiableInteractionFeedback({
                        engineConfig,
                        sharedInteraction,
                        seatInteraction: interaction,
                    })) {
                        continue;
                    }
                    const responseWindow = extractAiResponseWindowSnapshot(preTrainingState);
                    const blockerFingerprint = buildOnlineAiWatchdogBlockerFingerprint({
                        phase: preTrainingState.sys?.phase ?? match.state.sys?.phase ?? null,
                        reason,
                        sharedInteraction,
                        seatInteraction: interaction,
                        responseWindow,
                        pendingDamage: buildOnlineAiPendingDamageDiagnostic(match.state),
                    });
                    const trackerKey = `${playerID}:unsatisfiable-interaction:${typeof payload?.interactionId === 'string' ? payload.interactionId : 'unknown'}:${reason}:${progressMarkerBeforeCommand}`;
                    unsatisfiableInteractionFeedback = {
                        matchId: match.matchID,
                        gameId: engineConfig.gameId,
                        playerId: playerID,
                        incidentKind: 'unsatisfiable-interaction-auto-skipped',
                        severity: 'medium',
                        // 该事件表示 watchdog 已经执行了应急跳过并解除卡死，默认按“已恢复”入库，
                        // 避免把可恢复交互噪音持续堆积为 open 反馈。
                        status: 'resolved',
                        reason,
                        trackerKey,
                        progressMarker: progressMarkerBeforeCommand,
                        stateSnapshot: await this.buildUnsatisfiableInteractionStateSnapshot({
                            match,
                            playerId: playerID,
                            reason,
                            commandType: effectiveCommandType,
                            progressMarkerBefore: progressMarkerBeforeCommand,
                            preCommandSeatView: preTrainingState,
                        }),
                        actionLog: this.buildOnlineAiDiagnosticActionLog({
                            state: preTrainingState,
                            phase: preTrainingState.sys?.phase ?? match.state.sys?.phase ?? null,
                            progressMarker: progressMarkerBeforeCommand,
                            trackerKey,
                            blockerFingerprint,
                            sharedInteraction,
                            interaction,
                            responseWindow,
                            pendingDamage: buildOnlineAiPendingDamageDiagnostic(match.state),
                            commandType: effectiveCommandType,
                            reason,
                        }),
                    };
                }
            }
        }

        // 更新状态
        match.state = result.state;
        match.stateID += 1;
        // 记录最后执行命令的玩家，供 broadcastState 携带到 meta
        match.lastCommandPlayerId = playerID;

        // 撤回恢复：检测 UndoSystem 是否请求重置随机数游标
        const restoredCursor = (result.state.sys?.undo as { restoredRandomCursor?: number } | undefined)?.restoredRandomCursor;
        if (typeof restoredCursor === 'number' && restoredCursor >= 0) {
            // 重建 trackedRandom，从快照记录的游标位置恢复随机序列
            const rebuilt = createTrackedRandom(match.randomSeed, restoredCursor);
            match.random = rebuilt.random;
            match.getRandomCursor = rebuilt.getCursor;
            logger.info('[UndoServer] random-cursor-restored', {
                matchID: match.matchID,
                restoredCursor,
            });

            // 撤回导致大规模状态变更，增量 patch 极易产生无效路径。
            // 清空广播缓存，强制下次 broadcastState 对所有客户端只发送全量状态，
            // 避免客户端 patch 应用失败后触发 resync 的额外延迟。
            match.lastBroadcastedViews.clear();

            // 清除信号，避免持久化到存储层
            match.state = {
                ...match.state,
                sys: {
                    ...match.state.sys,
                    undo: {
                        ...match.state.sys.undo,
                        restoredRandomCursor: undefined,
                    },
                },
            };
        }

        // 持久化
        const storedState: StoredMatchState = {
            G: match.state,
            _stateID: match.stateID,
            randomSeed: match.randomSeed,
            randomCursor: match.getRandomCursor(),
        };
        await this.storage.setState(match.matchID, storedState);

        const gameOver = result.state.sys.gameover;
        const postTrainingState = this.stripStateForTraining(this.applyPlayerView(match, playerID)) as MatchState<unknown>;
        this.recordTrainingDecisionSample({
            match,
            playerID,
            commandType: effectiveCommandType,
            payload: effectivePayload,
            stateIdBefore,
            stateIdAfter: match.stateID,
            preState: preTrainingState,
            postState: postTrainingState,
            gameOver,
        });

        if (unsatisfiableInteractionFeedback) {
            await this.reportOnlineAiRecoveryFeedback(unsatisfiableInteractionFeedback);
        }

        // 广播状态（批次执行期间抑制中间广播，仅在批次完成后统一广播）
        if (!options?.suppressBroadcast) {
            this.broadcastState(match);
        }

        // 检查游戏结束（管线已将结果写入 sys.gameover）
        if (gameOver && !match.metadata.gameover) {
            match.metadata.gameover = gameOver;
            await this.storage.setMetadata(match.matchID, match.metadata);
            this.onGameOver?.(match.matchID, engineConfig.gameId, gameOver);
        }

        return true;
    }

    /**
     * 命令执行异常后，自动取消当前玩家的 pending interaction，防止游戏卡死
     */
    private async cancelInteractionOnError(match: ActiveMatch, playerID: string): Promise<void> {
        const interaction = (match.state.sys as {
            interaction?: {
                current?: { id?: string; kind?: string; playerId?: string };
            };
        })?.interaction?.current;

        if (!interaction || interaction.playerId !== playerID) return;

        const commandType = INTERACTION_COMMANDS.CANCEL;

        // 递归调用 executeCommandInternal 执行取消命令
        // 注意：这里不会无限递归，因为 CANCEL 命令不会抛出异常
        await this.executeCommandInternal(match, playerID, commandType, {
            interactionId: typeof interaction.id === 'string' ? interaction.id : undefined,
        });

        logger.warn('[GameTransport] Auto-cancelled interaction after command error', {
            matchID: match.matchID,
            playerID,
            interactionKind: interaction.kind,
        });
    }

    private handleDisconnect(socket: IOSocket): void {
        const info = this.socketIndex.get(socket.id);
        if (!info) return;

        // 记录断开日志
        gameLogger.socketDisconnected(socket.id, info.matchID, 'client_disconnect');

        this.socketIndex.delete(socket.id);
        this.removeSocketFromMatch(socket.id, info);
    }

    private removeSocketFromMatch(socketId: string, info: SocketInfo): void {
        const match = this.activeMatches.get(info.matchID);
        if (!match) return;

        if (info.playerID === null) {
            match.spectatorSockets.delete(socketId);
            // 最后一个旁观者断开时清理缓存
            if (match.spectatorSockets.size === 0) {
                match.lastBroadcastedViews.delete('spectator');
            }
            return;
        }

        const conns = match.connections.get(info.playerID);
        if (conns) {
            conns.delete(socketId);
            if (conns.size === 0) {
                match.connections.delete(info.playerID);
                this.onPlayerFullyDisconnected(match, info.playerID);
            }
        }
    }

    private onPlayerFullyDisconnected(
        match: ActiveMatch,
        playerID: string,
    ): void {
        // 清理增量同步缓存
        match.lastBroadcastedViews.delete(playerID);

        // 更新 metadata
        if (match.metadata.players[playerID]) {
            match.metadata.players[playerID].isConnected = false;
            this.storage.setMetadata(match.matchID, match.metadata).catch((err) => {
                logger.error(`[GameTransport] setMetadata 失败（断线标记可能未持久化） matchID=${match.matchID} playerID=${playerID}`, err);
            });
        }

        // 通知其他玩家
        const nsp = this.io.of('/game');
        nsp.to(`game:${match.matchID}`).emit('player:disconnected', match.matchID, playerID);

        // 启动离线裁决定时器
        this.scheduleOfflineAdjudication(match, playerID);
    }

    // ========================================================================
    // 离线交互裁决
    // ========================================================================

    private scheduleOfflineAdjudication(
        match: ActiveMatch,
        playerID: string,
    ): void {
        // 清除已有定时器
        const existing = match.offlineTimers.get(playerID);
        if (existing) clearTimeout(existing);

        const timer = setTimeout(() => {
            match.offlineTimers.delete(playerID);
            void this.runOfflineAdjudication(match, playerID);
        }, this.offlineGraceMs);

        match.offlineTimers.set(playerID, timer);
    }

    private async runOfflineAdjudication(
        match: ActiveMatch,
        playerID: string,
    ): Promise<void> {
        // 检查玩家是否仍然离线
        if (match.connections.has(playerID)) return;

        // 检查是否有待处理的交互属于该玩家
        const interaction = (match.state.sys as {
            interaction?: {
                current?: { kind?: string; playerId?: string };
            };
        })
            ?.interaction?.current;
        if (!interaction || interaction.playerId !== playerID) return;

        const commandType = resolveOfflineAdjudicationCommandType(interaction.kind, match.engineConfig);

        // 离线裁决必须与玩家命令共用同一串行通道，避免并发写状态
        await this.handleCommand(match.matchID, playerID, commandType, {});
    }

    // ========================================================================
    // 状态广播
    // ========================================================================

    /**
     * 对单个玩家/旁观者执行增量 diff 并推送状态
     * 
     * - 首次广播 → 全量（state:update）
     * - 后续广播 → 增量（state:patch）或全量（fallback）
     * - 状态无变化 → 不发送
     */
    private emitStateToSockets(
        match: ActiveMatch,
        viewState: unknown,
        cacheKey: string,
        sockets: Set<string>,
        matchPlayers: MatchPlayerInfo[],
        meta: { stateID: number; lastCommandPlayerId?: string; randomCursor: number },
    ): void {
        const nsp = this.io.of('/game');
        const cached = match.lastBroadcastedViews.get(cacheKey);

        if (cached === undefined) {
            // 首次广播 → 全量
            for (const socketId of sockets) {
                nsp.to(socketId).emit('state:update', match.matchID, viewState, matchPlayers, meta);
            }
        } else {
            const diff = computeDiff(cached, viewState);

            if (diff.type === 'full') {
                // Fallback 到全量
                for (const socketId of sockets) {
                    nsp.to(socketId).emit('state:update', match.matchID, viewState, matchPlayers, meta);
                }
            } else if (diff.patches && diff.patches.length > 0) {
                // 增量 patch
                for (const socketId of sockets) {
                    nsp.to(socketId).emit('state:patch', match.matchID, diff.patches, matchPlayers, meta);
                }
            }
            // else: 状态无变化，不发送
        }

        // 始终更新缓存
        // JSON round-trip 消除 undefined 值的 key，确保缓存结构与客户端（经 socket.io JSON 序列化）一致。
        // 否则 fast-json-patch 的 compare 会对 { key: undefined } → { key: value } 生成 replace 而非 add，
        // 导致客户端 patch 应用失败（路径不存在）。
        match.lastBroadcastedViews.set(cacheKey, JSON.parse(JSON.stringify(viewState)));
    }

    private broadcastState(match: ActiveMatch): void {
        const matchPlayers = this.buildMatchPlayers(match);

        // 附带 stateID + lastCommandPlayerId + randomCursor 元数据，供乐观引擎精确匹配和随机数同步
        const meta: { stateID: number; lastCommandPlayerId?: string; randomCursor: number } = {
            stateID: match.stateID,
            randomCursor: match.getRandomCursor(),
        };
        if (match.lastCommandPlayerId) {
            meta.lastCommandPlayerId = match.lastCommandPlayerId;
        }

        // 对每个已连接的玩家发送经 playerView 过滤 + 传输裁剪的状态（增量 diff）
        for (const [playerID, sockets] of match.connections) {
            const viewState = this.stripStateForTransport(this.applyPlayerView(match, playerID));
            this.emitStateToSockets(match, viewState, playerID, sockets, matchPlayers, meta);
        }

        // 旁观者使用 spectator 视图（当前默认完整视图）
        if (match.spectatorSockets.size > 0) {
            const spectatorView = this.stripStateForTransport(this.applyPlayerView(match, null));
            this.emitStateToSockets(match, spectatorView, 'spectator', match.spectatorSockets, matchPlayers, meta);
        }
    }

    private applyPlayerView(match: ActiveMatch, playerID: string | null): unknown {
        return applyPlayerViewToState(match.engineConfig, match.state, playerID);
    }

    private buildMatchPlayers(match: ActiveMatch): MatchPlayerInfo[] {
        const seatControllers = extractSetupSeatControllers(match.metadata.setupData);
        return Object.entries(match.metadata.players).map(([id, data]) => ({
            id: Number(id),
            name: resolveSeatPlayerDisplayName({
                playerId: id,
                name: data.name,
                seatControllers,
            }),
            isConnected: data.isConnected,
        }));
    }

    // ========================================================================
    // 对局加载
    // ========================================================================

    private async loadMatch(matchID: string): Promise<ActiveMatch | undefined> {
        const result = await this.storage.fetch(matchID, { state: true, metadata: true });
        if (!result.state || !result.metadata) return undefined;

        const gameId = result.metadata.gameName;
        const engineConfig = this.gameIndex.get(gameId);
        if (!engineConfig) return undefined;

        const playerIds = Object.keys(result.metadata.players) as PlayerId[];
        const state = setUndoAiSeatIds(
            rehydrateStoredMatchState(
                matchID,
                engineConfig,
                result.state.G,
                playerIds,
            ),
            getAiSeatIds(extractSetupSeatControllers(result.metadata.setupData)),
        );

        const randomSeed = resolveStoredRandomSeed(result.state, matchID);
        const randomCursor = resolveStoredRandomCursor(result.state);
        const trackedRandom = createTrackedRandom(randomSeed, randomCursor);

        const match: ActiveMatch = {
            matchID,
            gameId,
            engineConfig,
            state,
            metadata: result.metadata,
            randomSeed,
            random: trackedRandom.random,
            getRandomCursor: trackedRandom.getCursor,
            playerIds,
            stateID: result.state._stateID,
            lastCommandPlayerId: null,
            connections: new Map(),
            spectatorSockets: new Set(),
            offlineTimers: new Map(),
            lastBroadcastedViews: new Map(),
            executing: false,
            commandQueue: [],
            lastCommandFailureReason: null,
        };

        this.activeMatches.set(matchID, match);
        return match;
    }

    private async validateCommandAuth(
        matchID: string,
        playerID: string,
        credentials?: string,
        metadata?: MatchMetadata,
    ): Promise<boolean> {
        if (!this.authenticate) return true;

        const resolvedMetadata = metadata ?? await this.readFreshAuthMetadata(matchID);
        if (!resolvedMetadata) return false;

        const ok = await this.authenticate(matchID, playerID, credentials, resolvedMetadata);
        if (!ok) return false;

        this.mergeActiveMetadata(matchID, resolvedMetadata);
        return true;
    }
}
