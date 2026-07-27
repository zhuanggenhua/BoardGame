/**
 * 游戏状态同步服务端
 *
 * 基于 socket.io 实现：
 * - 接收客户端命令 → 执行 pipeline → playerView 过滤 → 广播状态
 * - 管理玩家连接状态
 * - 内置离线交互裁决（断线 → graceMs → 自动 CANCEL_INTERACTION）
 */

import { execSync } from 'node:child_process';
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
import type {
    TrainingCompletedMatch,
    TrainingDataRecorder,
    TrainingDecisionSample,
    TrainingMatchCommitResult,
} from './trainingData';
import { buildTrainingDecisionSample } from './trainingData';
import logger, { gameLogger } from '../../../server/logger.js';
import type { GameManifestEntry } from '../../shared/gameManifest.types';
import * as aiModule from '../ai';
import {
    applyPlayerViewToState,
    buildAiDecisionContext,
    getAiSeatIds,
    getGameAiRuntime,
    resolveOnlineAiDecisionView,
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
    parseDispatchPayloadMeta,
    resolveDispatchActorPlayerId,
} from './dispatchActorResolution';
import {
    applyAiAutoRecoveryRejection,
    buildAiProgressMarker,
    buildMultistepChoiceMetaSemanticSignature,
    buildPendingBonusDiceSettlementSemanticSignature,
    buildPendingDamageSemanticSignature,
    buildInteractionRecoveryFingerprintHint,
    buildInteractionSliderSemanticSignature,
    buildResponseWindowRecoveryFingerprintHint,
    resolveCurrentPlayerId,
    resolveOnlineAiCurrentPlayerId,
    resolveUnsatisfiableReasonFromInteraction,
    resolveForceEndTurnForStalledAi,
    resolveForceAdvancePhaseAfterRecovery,
    shouldInspectSeatStatesForHiddenAiInteraction,
    shouldUseOnlineAiEmergencyOverlayFallback,
    type AiAutoRecoveryAttemptTracker,
    type HiddenInteractionDescriptor,
    type ForceEndTurnStalledAiResolution,
} from './onlineAiRecovery';
import type { LocalPregameControlResolver } from './followCurrentTurnPlayer';
import { injectTutorialInteractionId } from './tutorialAiCommand';
import { resolveRuntimeBuildInfo } from '../../lib/feedback/runtimeBuildInfo';
import {
    buildInteractionSelectabilityDiagnostic,
    resolveUnsatisfiableReasonFromSelectability,
    type InteractionSelectabilityDiagnostic,
} from './onlineAiWatchdogFeedbackDiagnostics';

// 离线裁决：按交互 kind 选择最小语义正确的兜底命令
// - simple-choice: 走通用系统取消
// - dt:*: 走 DiceThrone 领域命令，确保回滚/清理逻辑完整执行
const OFFLINE_ADJUDICATION_COMMAND_BY_KIND: Record<string, string> = {
    'simple-choice': INTERACTION_COMMANDS.CANCEL,
    'dt:card-interaction': INTERACTION_COMMANDS.CANCEL, // 已迁移到 InteractionSystem
    'dt:token-response': 'SKIP_TOKEN_RESPONSE',
    'dt:bonus-dice': 'SKIP_BONUS_DICE_REROLL',
};

const resolveOfflineAdjudicationCommandType = (kind: unknown): string => {
    if (typeof kind !== 'string') {
        return INTERACTION_COMMANDS.CANCEL;
    }
    return OFFLINE_ADJUDICATION_COMMAND_BY_KIND[kind] ?? INTERACTION_COMMANDS.CANCEL;
};

const ALLOWED_INJECT_STATE_ENVS = new Set(['test', 'development']);

const canInjectStateInCurrentEnv = (nodeEnv: string | undefined): boolean =>
    typeof nodeEnv === 'string' && ALLOWED_INJECT_STATE_ENVS.has(nodeEnv);

const extractSetupSeatControllers = (setupData: unknown): Record<string, { type?: unknown } | undefined> | undefined => {
    if (!setupData || typeof setupData !== 'object' || Array.isArray(setupData)) {
        return undefined;
    }

    const rawSeatControllers = (setupData as { seatControllers?: unknown }).seatControllers;
    if (!rawSeatControllers || typeof rawSeatControllers !== 'object' || Array.isArray(rawSeatControllers)) {
        return undefined;
    }

    return rawSeatControllers as Record<string, { type?: unknown } | undefined>;
};

const isOnlineAiExplicitlyDisabled = (setupData: unknown): boolean => (
    Boolean(
        setupData
        && typeof setupData === 'object'
        && !Array.isArray(setupData)
        && (setupData as { enableAi?: unknown }).enableAi === false,
    )
);

const extractTrustedSetupSeatControllers = (setupData: unknown): Record<string, { type?: unknown } | undefined> | undefined => (
    isOnlineAiExplicitlyDisabled(setupData) ? undefined : extractSetupSeatControllers(setupData)
);

const extractStateSeatControllers = (
    state: MatchState<unknown> | undefined,
): Record<string, { type?: unknown } | undefined> | undefined => {
    const core = state?.core;
    if (!core || typeof core !== 'object' || Array.isArray(core)) {
        return undefined;
    }

    const rawSeatControllers = (core as { seatControllers?: unknown }).seatControllers;
    if (!rawSeatControllers || typeof rawSeatControllers !== 'object' || Array.isArray(rawSeatControllers)) {
        return undefined;
    }

    return rawSeatControllers as Record<string, { type?: unknown } | undefined>;
};

const shouldTrustOnlineAiSeatControllersForWatchdog = (setupData: unknown): boolean => {
    if (isOnlineAiExplicitlyDisabled(setupData)) {
        return false;
    }

    if (!setupData || typeof setupData !== 'object' || Array.isArray(setupData)) {
        return false;
    }

    const rawSeatControllers = (setupData as { seatControllers?: unknown }).seatControllers;
    if (!rawSeatControllers || typeof rawSeatControllers !== 'object' || Array.isArray(rawSeatControllers)) {
        return false;
    }

    return Object.values(rawSeatControllers as Record<string, { type?: unknown } | undefined>).some(
        (controller) => controller?.type === 'local-ai' || controller?.type === 'remote-ai',
    );
};

const resolveRawOnlineAiWatchdogSeatControllers = (
    state: MatchState<unknown> | undefined,
    setupData: unknown,
): Record<string, { type?: unknown } | undefined> | undefined => {
    if (isOnlineAiExplicitlyDisabled(setupData)) {
        return undefined;
    }

    const setupSeatControllers = shouldTrustOnlineAiSeatControllersForWatchdog(setupData)
        ? extractSetupSeatControllers(setupData)
        : undefined;
    const stateSeatControllers = extractStateSeatControllers(state);
    if (!setupSeatControllers && !stateSeatControllers) {
        return undefined;
    }

    return {
        ...(setupSeatControllers ?? {}),
        ...(stateSeatControllers ?? {}),
    };
};

type GameManifestIndex = Record<string, Pick<GameManifestEntry, 'ai'> | undefined>;

const normalizeOnlineAiWatchdogSeatControllerType = (
    gameId: string,
    controller: { type?: unknown } | undefined,
    gameManifests: GameManifestIndex,
): 'human' | 'local-ai' | 'remote-ai' => {
    const manifestAi = gameManifests[gameId]?.ai;
    if (controller?.type === 'local-ai') {
        return manifestAi?.localAi === false ? 'human' : 'local-ai';
    }
    if (controller?.type === 'remote-ai') {
        return manifestAi?.remoteAi === false ? 'human' : 'remote-ai';
    }
    return 'human';
};

type OnlineAiWatchdogSeatController = aiModule.AiSeatController;

const DEFAULT_TRAINING_CAPTURE_POLICY = 'human-only' as const;
const DEFAULT_ONLINE_AI_RECOVERY_TICK_MS = 500;
const DEFAULT_ONLINE_AI_RECOVERY_TIMEOUT_MS = 8000;
const DEFAULT_ONLINE_AI_RECOVERY_MAX_ADVANCE_STEPS = 16;
const DEFAULT_ONLINE_AI_RECOVERY_FEEDBACK_COOLDOWN_MS = 60_000;
const DEFAULT_ONLINE_AI_RECOVERY_FAILURE_REPORT_THRESHOLD = 2;
const DEFAULT_ONLINE_AI_RECOVERY_REPEATED_ATTEMPT_LIMIT = 3;
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

type OnlineAiRecoveryTracker = AiAutoRecoveryAttemptTracker & {
    key: string;
    failureCount: number;
};

type OnlineAiRecoveryFeedbackPayload = {
    matchId: string;
    gameId: string;
    playerId: string;
    incidentKind:
        | 'force-end-turn-success'
        | 'force-end-turn-failed'
        | 'repeated-recovery-force-unblocked'
        | 'repeated-recovery-suppressed'
        | 'unsatisfiable-interaction-auto-skipped'
        | 'legal-action-recovered';
    severity: 'medium' | 'high';
    status?: 'open' | 'resolved';
    resolvedMethod?: string;
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

const buildOnlineAiRecoveryResolvedMethod = (
    payload: Pick<OnlineAiRecoveryFeedbackPayload, 'incidentKind'>,
): string => {
    if (payload.incidentKind === 'legal-action-recovered') {
        return '系统已自动找到可执行操作并继续推进该 AI 座位，对局没有停在该步骤。';
    }
    if (payload.incidentKind === 'force-end-turn-success') {
        return '系统已自动推进停滞的 AI 座位，让对局继续进行。';
    }
    return '系统已自动恢复这次在线 AI 步骤，对局已继续运行。';
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

type OnlineAiRepeatedRecoveryAttempt = {
    count: number;
    lastAttemptAt: number;
    reported: boolean;
};

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
    sharedInteraction: AiInteractionSnapshot | null | undefined;
    seatInteraction: AiInteractionSnapshot | null | undefined;
}): boolean => {
    const sharedSelectability = buildInteractionSelectabilityDiagnostic(args.sharedInteraction);
    if (isEmergencySkipOnlySelectability(sharedSelectability)) {
        return true;
    }

    const seatSelectability = buildInteractionSelectabilityDiagnostic(args.seatInteraction);
    return args.sharedInteraction?.kind === 'dt:defender-choice'
        && args.seatInteraction?.kind === 'dt:defender-choice'
        && sharedSelectability?.selectionState === 'no-options'
        && seatSelectability?.selectionState === 'no-options';
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

const normalizeOnlineAiDiagnosticSegment = (value: unknown, fallback: string): string => {
    if (typeof value !== 'string') {
        return fallback;
    }
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9:_-]/g, '');
    return normalized || fallback;
};

const resolveOnlineAiResponseWindowResponderId = (
    responseWindow: AiResponseWindowSnapshot | null | undefined,
): string | null => {
    if (!responseWindow || !Array.isArray(responseWindow.responderQueue)) {
        return null;
    }
    const index = typeof responseWindow.currentResponderIndex === 'number'
        ? responseWindow.currentResponderIndex
        : 0;
    const responderId = responseWindow.responderQueue[index];
    return typeof responderId === 'string' && responderId.trim().length > 0
        ? responderId
        : null;
};

const buildOnlineAiWatchdogBlockerFingerprint = (args: {
    phase?: unknown;
    reason?: unknown;
    sharedInteraction?: AiInteractionSnapshot | null;
    seatInteraction?: AiInteractionSnapshot | null;
    responseWindow?: AiResponseWindowSnapshot | null;
    pendingDamage?: OnlineAiRecoveryPendingDamageDiagnostic | null;
}): string | null => {
    const phase = normalizeOnlineAiDiagnosticSegment(args.phase, 'unknown-phase');
    const reason = normalizeOnlineAiDiagnosticSegment(args.reason, 'unknown-reason');
    const interaction = args.seatInteraction ?? args.sharedInteraction;
    if (interaction) {
        const kind = normalizeOnlineAiDiagnosticSegment(interaction.kind, 'unknown-kind');
        const sourceId = normalizeOnlineAiDiagnosticSegment(
            typeof interaction.sourceId === 'string' ? interaction.sourceId : interaction.id,
            'unknown-source',
        );
        return `${phase}:${reason}:interaction:${kind}:${sourceId}`;
    }
    if (args.responseWindow) {
        const windowType = normalizeOnlineAiDiagnosticSegment(args.responseWindow.windowType, 'unknown-window');
        const sourceId = normalizeOnlineAiDiagnosticSegment(args.responseWindow.sourceId, 'unknown-source');
        const responderId = normalizeOnlineAiDiagnosticSegment(
            resolveOnlineAiResponseWindowResponderId(args.responseWindow),
            'unknown-responder',
        );
        return `${phase}:${reason}:response-window:${windowType}:${sourceId}:${responderId}`;
    }
    if (args.pendingDamage) {
        const responseType = normalizeOnlineAiDiagnosticSegment(args.pendingDamage.responseType, 'unknown-response');
        const sourceAbilityId = normalizeOnlineAiDiagnosticSegment(
            args.pendingDamage.sourceAbilityId,
            'unknown-source-ability',
        );
        const responderId = normalizeOnlineAiDiagnosticSegment(
            args.pendingDamage.responderId,
            'unknown-responder',
        );
        return `${phase}:${reason}:pending-damage:${responseType}:${sourceAbilityId}:${responderId}`;
    }
    return null;
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

function shouldAutoReportCommandFailure(reason: string): boolean {
    return reason === GENERIC_COMMAND_FAILURE_REASON
        || reason === PIPELINE_FAILURE_REASON
        || reason.startsWith(`${PIPELINE_FAILURE_REASON}:`);
}

function resolveCommandFailureFeedbackSeverity(reason: string): CommandFailureFeedbackPayload['severity'] {
    return reason === GENERIC_COMMAND_FAILURE_REASON ? 'medium' : 'high';
}

let cachedServerGitCommitSha: string | null | undefined;

function resolveServerGitCommitSha(): string | undefined {
    if (cachedServerGitCommitSha !== undefined) {
        return cachedServerGitCommitSha || undefined;
    }

    try {
        const commitSha = execSync('git rev-parse --short=12 HEAD', {
            cwd: process.cwd(),
            stdio: ['ignore', 'pipe', 'ignore'],
        }).toString('utf-8').trim();
        cachedServerGitCommitSha = commitSha || null;
    } catch {
        cachedServerGitCommitSha = null;
    }

    return cachedServerGitCommitSha || undefined;
}

function resolveServerFeedbackBuildInfo() {
    const buildInfo = resolveRuntimeBuildInfo(process.env);
    if (buildInfo.appCommitSha) {
        return buildInfo;
    }

    return {
        ...buildInfo,
        appCommitSha: resolveServerGitCommitSha(),
    };
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
        activeTurnLegalActionOnlyPhases?: string[];
        humanTurnLegalActionProbePhases?: string[];
        autoSelectFirstTriggerOnlySimpleChoiceSourceIds?: string[];
        allowForceCommandAfterLegalActionExhausted?: (args: {
            state: MatchState<unknown>;
            phase: string;
            previousCandidate: ForceEndTurnStalledAiResolution;
            nextCandidate: ForceEndTurnStalledAiResolution;
        }) => boolean;
        resolveCurrentPlayerId?: (args: {
            state: MatchState<unknown>;
            phase: string;
            fallbackPlayerId: string | null;
        }) => string | null | undefined;
        resolveManualSetupSelectionTakeoverPlayerId?: (args: {
            sharedState: MatchState<unknown>;
            seatControllers: Record<string, unknown>;
            currentPlayerId: string | null;
        }) => string | null | undefined;
        shouldReleaseManualSetupAttemptFromSharedState?: (args: {
            sharedState: MatchState<unknown>;
            playerId: string;
            actionKind: string;
            selectionId: string;
        }) => boolean | undefined;
        shouldTreatActionAsManualSetupSelection?: (args: {
            actionKind: string;
            actionId: string;
            commandTypes: string[];
        }) => boolean | undefined;
        buildPregameSelectionProgressSignature?: (args: {
            state: MatchState<unknown>;
            phase: string;
            fallbackSignature: string;
        }) => string | undefined;
        buildInteractionRecoveryFingerprintHint?: (args: {
            state: MatchState<unknown>;
            playerId: string;
            phase: string;
            interaction: HiddenInteractionDescriptor | HiddenSimpleChoiceInteraction;
            fallbackFingerprintHint: string;
        }) => string | undefined;
        resolveForcedInteractionCommand?: (args: {
            state: MatchState<unknown>;
            playerId: string;
            phase: string;
            interaction: HiddenInteractionDescriptor | HiddenSimpleChoiceInteraction;
            fallbackCommand: { type: string; payload: unknown } | null;
        }) => { type: string; payload: unknown } | null | undefined;
        resolveSeatLegalOnlyRecovery?: (args: {
            state: MatchState<unknown>;
            phase: string;
        }) => {
            playerId: string;
            command: { type: string; payload: unknown };
            fingerprintHint: string;
            attemptSuffix?: string;
        } | null | undefined;
        shouldSuppressActiveTurnCandidate?: (args: {
            state: MatchState<unknown>;
            phase: string;
            currentPlayerId: string;
            turnNumber: number | null;
        }) => boolean;
        shouldSuppressUnsatisfiableInteractionFeedback?: (args: {
            state: MatchState<unknown>;
            phase: string;
            playerId: string;
            reason: string;
            interaction: unknown;
        }) => boolean;
        offlineAdjudicationCommandByInteractionKind?: Record<string, string>;
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
    /** 对局已被外部销毁/卸载，后台任务不得继续写回状态。 */
    unloaded: boolean;
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
    /** 命令成功后回调（可选），用于刷新大厅摘要等非游戏状态视图 */
    onCommandSucceeded?: (matchID: string, gameName: string, commandType: string) => void;
    trainingDataRecorder?: TrainingDataRecorder;
    trainingDataMinCompletedMatchDurationMs?: number;
    rulesVersion?: string | null;
    gameManifests?: GameManifestIndex;
    onlineAiRecoveryTickMs?: number;
    onlineAiRecoveryTimeoutMs?: number;
    onlineAiRecoveryMaxAdvanceSteps?: number;
    onlineAiRecoveryFeedbackCooldownMs?: number;
    onlineAiRecoveryFailureReportThreshold?: number;
    onlineAiRecoveryRepeatedAttemptLimit?: number;
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
    private readonly onCommandSucceeded?: GameTransportServerConfig['onCommandSucceeded'];
    private readonly trainingDataRecorder?: TrainingDataRecorder;
    private readonly trainingDataMinCompletedMatchDurationMs: number | null;
    private readonly rulesVersion: string | null;
    private readonly gameManifests: GameManifestIndex;
    private readonly onlineAiRecoveryTickMs: number;
    private readonly onlineAiRecoveryTimeoutMs: number;
    private readonly onlineAiRecoveryMaxAdvanceSteps: number;
    private readonly onlineAiRecoveryFeedbackCooldownMs: number;
    private readonly onlineAiRecoveryFailureReportThreshold: number;
    private readonly onlineAiRecoveryRepeatedAttemptLimit: number;
    private readonly onlineAiFeedbackReporter?: GameTransportServerConfig['onlineAiFeedbackReporter'];
    private readonly commandFailureFeedbackCooldownMs: number;
    private readonly commandFailureFeedbackReporter?: GameTransportServerConfig['commandFailureFeedbackReporter'];
    private readonly onlineAiRecoveryTrackers = new Map<string, OnlineAiRecoveryTracker>();
    private readonly onlineAiRepeatedRecoveryAttempts = new Map<string, OnlineAiRepeatedRecoveryAttempt>();
    private readonly onlineAiRecoveryFeedbackCooldown = new Map<string, number>();
    private readonly commandFailureFeedbackCooldown = new Map<string, number>();
    private readonly onlineAiOverlayResyncCooldown = new Map<string, number>();
    private readonly onlineAiRecoveryInFlight = new Set<string>();
    private onlineAiRecoveryTimer: ReturnType<typeof setInterval> | null = null;

    constructor(config: GameTransportServerConfig) {
        this.io = config.io;
        this.storage = config.storage;
        this.gameIndex = new Map(config.games.map((g) => [g.gameId, g]));
        this.activeMatches = new Map();
        this.socketIndex = new Map();
        this.offlineGraceMs = config.offlineGraceMs ?? 30000;
        this.authenticate = config.authenticate;
        this.onGameOver = config.onGameOver;
        this.onCommandSucceeded = config.onCommandSucceeded;
        this.trainingDataRecorder = config.trainingDataRecorder;
        this.trainingDataMinCompletedMatchDurationMs = (
            Number.isFinite(config.trainingDataMinCompletedMatchDurationMs)
            && (config.trainingDataMinCompletedMatchDurationMs ?? 0) > 0
        )
            ? config.trainingDataMinCompletedMatchDurationMs!
            : null;
        this.rulesVersion = config.rulesVersion ?? null;
        this.gameManifests = config.gameManifests ?? {};
        this.onlineAiRecoveryTickMs = config.onlineAiRecoveryTickMs ?? DEFAULT_ONLINE_AI_RECOVERY_TICK_MS;
        this.onlineAiRecoveryTimeoutMs = config.onlineAiRecoveryTimeoutMs ?? DEFAULT_ONLINE_AI_RECOVERY_TIMEOUT_MS;
        this.onlineAiRecoveryMaxAdvanceSteps = config.onlineAiRecoveryMaxAdvanceSteps ?? DEFAULT_ONLINE_AI_RECOVERY_MAX_ADVANCE_STEPS;
        this.onlineAiRecoveryFeedbackCooldownMs = config.onlineAiRecoveryFeedbackCooldownMs ?? DEFAULT_ONLINE_AI_RECOVERY_FEEDBACK_COOLDOWN_MS;
        this.onlineAiRecoveryFailureReportThreshold = config.onlineAiRecoveryFailureReportThreshold ?? DEFAULT_ONLINE_AI_RECOVERY_FAILURE_REPORT_THRESHOLD;
        this.onlineAiRecoveryRepeatedAttemptLimit = (
            Number.isFinite(config.onlineAiRecoveryRepeatedAttemptLimit)
            && (config.onlineAiRecoveryRepeatedAttemptLimit ?? 0) > 0
        )
            ? Math.floor(config.onlineAiRecoveryRepeatedAttemptLimit!)
            : DEFAULT_ONLINE_AI_RECOVERY_REPEATED_ATTEMPT_LIMIT;
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
                const meta = parseDispatchPayloadMeta(payload);
                const match = this.activeMatches.get(matchID);
                const isTutorialActive = !!(match?.state?.sys as Record<string, unknown> | undefined)
                    ?.tutorial && !!(match?.state?.sys as { tutorial?: { active?: boolean } })?.tutorial?.active;
                const resolvedPlayerId = resolveDispatchActorPlayerId({
                    meta,
                    allowInternalOverride: false,
                    allowTutorialOverride: isTutorialActive,
                    fallbackPlayerId: info.playerID,
                });
                const tutorialInjectedPayload = match
                    ? injectTutorialInteractionId({
                        state: match.state,
                        commandType,
                        payload: meta.normalizedPayload,
                        tutorialPlayerId: meta.tutorialOverrideId ?? resolvedPlayerId,
                        isTutorialAiCommand: meta.isTutorialAiCommand,
                    })
                    : meta.normalizedPayload;
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

        const setupSeatControllers = extractTrustedSetupSeatControllers(setupData);
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
    unloadMatch(matchID: string, options?: { disconnectSockets?: boolean }): boolean {
        const match = this.activeMatches.get(matchID);
        if (!match) return false;

        match.unloaded = true;

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
        this.clearOnlineAiRepeatedRecoveryAttemptsForMatch(matchID);
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

        return true;
    }

    private clearOnlineAiRepeatedRecoveryAttemptsForMatch(matchID: string): void {
        const prefix = `${matchID}:`;
        for (const key of this.onlineAiRepeatedRecoveryAttempts.keys()) {
            if (key.startsWith(prefix)) {
                this.onlineAiRepeatedRecoveryAttempts.delete(key);
            }
        }
    }

    private async resolveOnlineAiLegalActionOnlyCandidate(
        match: ActiveMatch,
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

        const currentPhase = typeof match.state.sys?.phase === 'string' ? match.state.sys.phase : '';
        const core = match.state.core as { hostStarted?: unknown } | undefined;
        const isPublicPregameSetup = core?.hostStarted === false && (
            currentPhase === 'factionSelect'
            || (match.gameId === 'summonerwars' && currentPhase === 'summon')
        );
        // 通用保护：当真人是当前操作者时，seat-legal-only 仅允许在两类公开场景触发：
        // 1. defensiveRoll / targetingRoll 这类 off-turn 真人阶段；
        // 2. hostStarted=false 的公开预开局 setup，此时 AI 选阵营/准备不会越权代真人推进。
        const isHumanActiveOffTurnRollPhase = currentPhase === 'defensiveRoll' || currentPhase === 'targetingRoll';
        if (!isHumanActiveOffTurnRollPhase && !isPublicPregameSetup) {
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

        const aiDispatchResult = await aiModule.resolveNextAiDispatch({
            engineConfig: match.engineConfig,
            state: match.state,
            matchId: match.matchID,
            seatControllers,
            visibleStateResolver: (playerId) => resolveOnlineAiDecisionView({
                runtime: getGameAiRuntime(match.gameId) ?? null,
                sharedState: match.state,
                privateOverlay: this.applyPlayerView(match, playerId) as MatchState<unknown>,
                playerId,
            }),
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
        const manualSetupSelection = seatController.manualFactionSelection === true
            || seatController.manualSetupSelection === true;
        if (!seatController || seatController.type === 'human' || !manualSetupSelection) {
            return false;
        }

        const decisionView = resolveOnlineAiDecisionView({
            runtime: getGameAiRuntime(match.gameId) ?? null,
            sharedState: match.state,
            privateOverlay: this.applyPlayerView(match, playerId) as MatchState<unknown>,
            playerId,
        });
        const visibleState = decisionView?.visibleState ?? this.applyPlayerView(match, playerId) as MatchState<unknown>;

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
                return aiModule.shouldPlayerManuallyResolveSetupSelection(
                    match.engineConfig,
                    match.state,
                    playerId,
                    seatController,
                    action,
                );
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
            const currentProgressMarker = buildAiProgressMarker(match.state, {
                engineConfig: match.engineConfig,
                gameId: match.gameId,
            });
            const currentRecoveryFingerprint = this.buildOnlineAiRecoveryFingerprint(match, candidate, currentProgressMarker);
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
        const currentPhase = typeof match.state.sys?.phase === 'string' ? match.state.sys.phase : '';
        const core = match.state.core as { hostStarted?: unknown } | undefined;
        const publicPregameLegalActionPhases = match.engineConfig.onlineAiRecovery?.publicPregameLegalActionPhases ?? [];
        const isPublicPregameLegalAction = candidate.reason === 'seat-legal-only'
            && core?.hostStarted === false
            && publicPregameLegalActionPhases.includes(currentPhase);
        // 商业口径：在线 AI 不应依赖宿主页保持前台/存活。
        // 一旦对应 AI seat 没有 live socket，watchdog 立即接管真正的“对局中 AI 回合/交互”。
        // 公开预开局选择同样不依赖宿主页：这里只执行 AI 自己的合法选择，不会推进真人操作。
        const shouldImmediateTakeover = candidate.reason === 'active-turn'
            || candidate.reason === 'response-window'
            || candidate.reason === 'response-loop'
            || candidate.reason === 'visible-interaction'
            || candidate.reason === 'hidden-interaction'
            || isPublicPregameLegalAction;
        if (liveSeatConnectionCount === 0 && shouldImmediateTakeover) {
            return 0;
        }
        return this.onlineAiRecoveryTimeoutMs;
    }

    private async runOnlineAiRecoveryTick(): Promise<void> {
        const now = Date.now();
        for (const [key, expiresAt] of this.onlineAiRecoveryFeedbackCooldown.entries()) {
            if (expiresAt <= now) {
                this.onlineAiRecoveryFeedbackCooldown.delete(key);
            }
        }
        for (const [key, expiresAt] of this.onlineAiOverlayResyncCooldown.entries()) {
            if (expiresAt <= now) {
                this.onlineAiOverlayResyncCooldown.delete(key);
            }
        }

        for (const match of this.activeMatches.values()) {
            if (this.onlineAiRecoveryInFlight.has(match.matchID)) {
                continue;
            }

            const rawSeatControllers = resolveRawOnlineAiWatchdogSeatControllers(
                match.state,
                match.metadata.setupData,
            );
            const seatControllers = Object.fromEntries(
                Object.keys(match.metadata.players).map((playerId) => {
                    const controller = rawSeatControllers?.[playerId];
                    const normalizedType = normalizeOnlineAiWatchdogSeatControllerType(
                        match.gameId,
                        controller,
                        this.gameManifests,
                    );
                    return [
                        playerId,
                        normalizedType === 'human'
                            ? { type: 'human' as const }
                            : {
                                ...(controller as { policyId?: string; fallbackPolicyId?: string }),
                                type: normalizedType,
                            },
                    ];
                }),
            ) as Record<string, OnlineAiWatchdogSeatController>;

            const hasAiSeat = Object.values(seatControllers).some((controller) => controller.type !== 'human');
            if (!hasAiSeat) {
                this.onlineAiRecoveryTrackers.delete(match.matchID);
                this.clearOnlineAiRepeatedRecoveryAttemptsForMatch(match.matchID);
                continue;
            }

            const candidate = await this.resolveOnlineAiRecoveryCandidate(match, seatControllers);
            if (!candidate) {
                this.onlineAiRecoveryTrackers.delete(match.matchID);
                this.clearOnlineAiRepeatedRecoveryAttemptsForMatch(match.matchID);
                continue;
            }

            const progressMarker = buildAiProgressMarker(match.state, {
                engineConfig: match.engineConfig,
                gameId: match.gameId,
            });
            const recoveryFingerprint = this.buildOnlineAiRecoveryFingerprint(match, candidate, progressMarker);
            const trackerKey = `${candidate.playerId}:${candidate.reason}:${recoveryFingerprint}`;
            const repeatedAttemptKey = this.buildOnlineAiRepeatedRecoveryAttemptKey(match.matchID, trackerKey);
            const repeatedAttempt = this.onlineAiRepeatedRecoveryAttempts.get(repeatedAttemptKey);
            if ((repeatedAttempt?.count ?? 0) >= this.onlineAiRecoveryRepeatedAttemptLimit) {
                this.onlineAiRecoveryTrackers.delete(match.matchID);
                const forceUnblockResult = await this.tryForceUnblockRepeatedOnlineAiRecovery({
                    match,
                    candidate,
                    trackerKey,
                    progressMarker,
                    repeatedAttemptKey,
                    repeatedAttempt,
                    seatControllers,
                });
                if (forceUnblockResult.handled) {
                    continue;
                }
                await this.reportOnlineAiRepeatedRecoverySuppressed({
                    match,
                    candidate,
                    trackerKey,
                    progressMarker,
                    repeatedAttemptKey,
                    repeatedAttempt,
                    suppressionReason: forceUnblockResult.suppressionReason,
                });
                continue;
            }
            const recoveryTimeoutMs = this.resolveOnlineAiRecoveryTimeoutMs(match, candidate);
            if (candidate.reason === 'active-turn'
                && this.hasRecentOnlineAiOverlayResync({
                    matchId: match.matchID,
                    playerId: candidate.playerId,
                    progressMarker,
                })) {
                continue;
            }
            let currentTracker = this.onlineAiRecoveryTrackers.get(match.matchID);

            if (!currentTracker || currentTracker.key !== trackerKey) {
                currentTracker = {
                    key: trackerKey,
                    firstSeenAt: now,
                    autoSubmittedAt: null,
                    lastReportedFailureReason: null,
                    failureCount: 0,
                };
                this.onlineAiRecoveryTrackers.set(match.matchID, currentTracker);
                if (recoveryTimeoutMs > 0) {
                    continue;
                }
            }

            if (currentTracker.autoSubmittedAt || now - currentTracker.firstSeenAt < recoveryTimeoutMs) {
                continue;
            }

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
        if (match.unloaded) {
            tracker.autoSubmittedAt = null;
            return;
        }
        if (match.executing) {
            tracker.autoSubmittedAt = null;
            return;
        }

        match.executing = true;
        const advancePhaseCommandType = match.gameId === 'summonerwars' ? 'sw:end_phase' : 'ADVANCE_PHASE';
        const mapRecoveryCommand = (command?: { type?: string; payload?: unknown }) => {
            if (!command) return { type: 'UNKNOWN', payload: {} };
            if (command.type === 'ADVANCE_PHASE' && advancePhaseCommandType !== 'ADVANCE_PHASE') {
                return { ...command, type: advancePhaseCommandType };
            }
            return command;
        };
        const resolveChainedRecoveryCandidate = async (expectedPlayerId: string): Promise<ForceEndTurnStalledAiResolution | null> => {
            const nextCandidate = await this.resolveOnlineAiRecoveryCandidate(match, seatControllers);
            if (!nextCandidate || nextCandidate.playerId !== expectedPlayerId) {
                return nextCandidate;
            }
            return nextCandidate;
        };
        const revalidateRecoveryCandidate = async (
            expectedCandidate: ForceEndTurnStalledAiResolution,
        ): Promise<ForceEndTurnStalledAiResolution | null> => {
            const rawLatestCandidate = await this.resolveOnlineAiRecoveryCandidate(match, seatControllers);
            const latestCandidate = rawLatestCandidate
                ? this.normalizeFollowUpLegalActionOnlyCandidate(rawLatestCandidate, expectedCandidate)
                : rawLatestCandidate;
            if (!latestCandidate) {
                this.onlineAiRecoveryTrackers.delete(match.matchID);
                tracker.autoSubmittedAt = null;
                return null;
            }

            const stillSameCandidate = latestCandidate.playerId === expectedCandidate.playerId
                && latestCandidate.reason === expectedCandidate.reason
                && latestCandidate.requiresConfirmedAdvancePhase === expectedCandidate.requiresConfirmedAdvancePhase
                && latestCandidate.legalActionOnly === expectedCandidate.legalActionOnly;
            const latestProgressMarker = buildAiProgressMarker(match.state, {
                engineConfig: match.engineConfig,
                gameId: match.gameId,
            });
            const latestRecoveryFingerprint = this.buildOnlineAiRecoveryFingerprint(
                match,
                latestCandidate,
                latestProgressMarker,
            );
            const latestTrackerKey = `${latestCandidate.playerId}:${latestCandidate.reason}:${latestRecoveryFingerprint}`;
            if (!stillSameCandidate || latestTrackerKey !== tracker.key) {
                this.onlineAiRecoveryTrackers.delete(match.matchID);
                tracker.autoSubmittedAt = null;
                return null;
            }

            return latestCandidate;
        };
        const syncRecoveryTrackerToCandidate = (
            nextCandidate: ForceEndTurnStalledAiResolution,
        ): void => {
            const nextProgressMarker = buildAiProgressMarker(match.state, {
                engineConfig: match.engineConfig,
                gameId: match.gameId,
            });
            const nextRecoveryFingerprint = this.buildOnlineAiRecoveryFingerprint(
                match,
                nextCandidate,
                nextProgressMarker,
            );
            const nextTrackerKey = `${nextCandidate.playerId}:${nextCandidate.reason}:${nextRecoveryFingerprint}`;
            if (tracker.key === nextTrackerKey) {
                return;
            }
            tracker.key = nextTrackerKey;
            tracker.lastReportedFailureReason = null;
            tracker.failureCount = 0;
        };
        const hasHumanResponderInCurrentWindow = (): boolean => {
            const currentWindow = (match.state.sys as { responseWindow?: { current?: unknown } } | undefined)
                ?.responseWindow?.current as {
                    responderQueue?: unknown;
                } | undefined;
            if (!currentWindow) {
                return false;
            }
            const responderQueue = Array.isArray(currentWindow.responderQueue) ? currentWindow.responderQueue : [];
            return responderQueue.some((responderId) => {
                const id = typeof responderId === 'string' ? responderId : '';
                return id.length > 0 && seatControllers[id]?.type === 'human';
            });
        };
        const resolveWatchdogCurrentPlayerId = (): string | null => resolveOnlineAiCurrentPlayerId(match.state, {
            engineConfig: match.engineConfig,
            gameId: match.gameId,
        });
        const canExecuteWatchdogAdvancePhase = (playerId: string): boolean => {
            if (!playerId || seatControllers[playerId]?.type === 'human') {
                return false;
            }

            if (resolveWatchdogCurrentPlayerId() !== playerId) {
                return false;
            }

            const interactionState = match.state.sys?.interaction as { current?: unknown; isBlocked?: unknown } | undefined;
            if (interactionState?.current || interactionState?.isBlocked === true) {
                return false;
            }

            if (hasHumanResponderInCurrentWindow()) {
                return false;
            }

            return true;
        };

        let currentCandidate = candidate;
        let phaseLabel = currentCandidate.requiresConfirmedAdvancePhase ? 'recover-interaction' : 'follow-up-advance';
        let totalAdvanceSteps = 0;
        let totalForcedCommands = 0;
        let usedForcedRecoveryCommand = false;
        let lastForcedReason: ForceEndTurnStalledAiResolution['reason'] | null = null;
        let lastForcedPhaseLabel: 'recover-interaction' | 'follow-up-advance' = phaseLabel;

        const isInteractionRecoveryReason = (reason: ForceEndTurnStalledAiResolution['reason']): boolean =>
            reason === 'visible-interaction' || reason === 'hidden-interaction';
        const readCurrentAiInteractionRecoveryFingerprintHint = (playerId: string): string | null => {
            const currentInteraction = (match.state.sys?.interaction as {
                current?: HiddenInteractionDescriptor | HiddenSimpleChoiceInteraction;
            } | undefined)?.current;
            if (!currentInteraction || String(currentInteraction.playerId ?? '') !== playerId) {
                return null;
            }
            return buildInteractionRecoveryFingerprintHint(match.state, currentInteraction, playerId, {
                engineConfig: match.engineConfig,
                gameId: match.gameId,
            });
        };
        const readCurrentAiSeatViewInteractionRecoveryFingerprintHint = (playerId: string): string | null => {
            const playerView = this.applyPlayerView(match, playerId) as MatchState<unknown>;
            const currentInteraction = (playerView.sys?.interaction as {
                current?: HiddenInteractionDescriptor | HiddenSimpleChoiceInteraction;
            } | undefined)?.current;
            if (!currentInteraction || String(currentInteraction.playerId ?? '') !== playerId) {
                return null;
            }
            return buildInteractionRecoveryFingerprintHint(playerView, currentInteraction, playerId, {
                engineConfig: match.engineConfig,
                gameId: match.gameId,
            });
        };
        const readCurrentAiResponseWindowRecoveryFingerprintHint = (playerId: string): string | null => {
            const currentWindow = (match.state.sys?.responseWindow as {
                current?: {
                    responderQueue?: unknown;
                    currentResponderIndex?: unknown;
                };
            } | undefined)?.current;
            if (!currentWindow) {
                return null;
            }

            const responderQueue = Array.isArray(currentWindow.responderQueue) ? currentWindow.responderQueue : [];
            const responderIndex = typeof currentWindow.currentResponderIndex === 'number'
                ? currentWindow.currentResponderIndex
                : 0;
            if (String(responderQueue[responderIndex] ?? '') !== playerId) {
                return null;
            }

            return buildResponseWindowRecoveryFingerprintHint(
                match.state,
                playerId,
                'response-window',
            );
        };
        const readCurrentAiInteractionSemanticFingerprint = (playerId: string): string | null => {
            const currentInteraction = (match.state.sys?.interaction as {
                current?: {
                    id?: unknown;
                    playerId?: unknown;
                    kind?: unknown;
                    data?: {
                        sourceId?: unknown;
                        title?: unknown;
                        slider?: unknown;
                        meta?: unknown;
                        confirmValue?: unknown;
                        allowedDieIds?: unknown;
                        completedDieIds?: unknown;
                        options?: unknown;
                    };
                };
            } | undefined)?.current;
            if (!currentInteraction || String(currentInteraction.playerId ?? '') !== playerId) {
                return null;
            }
            const interactionKind = typeof currentInteraction.kind === 'string' ? currentInteraction.kind : '';
            const interactionId = typeof currentInteraction.id === 'string' ? currentInteraction.id : '';
            const interactionIdSignature = interactionKind === 'compare-roll-choice'
                ? interactionId
                : '';
            const data = currentInteraction.data;
            const options = Array.isArray(data?.options)
                ? data.options.map((option) => {
                    const item = option as {
                        id?: unknown;
                        disabled?: unknown;
                        value?: unknown;
                    };
                    return [
                        typeof item.id === 'string' ? item.id : '',
                        item.disabled === true ? '1' : '0',
                        JSON.stringify(item.value ?? null),
                    ].join(':');
                }).join(',')
                : '';
            const sliderSignature = buildInteractionSliderSemanticSignature(data?.slider);
            const multistepMetaSignature = buildMultistepChoiceMetaSemanticSignature(data?.meta);
            const pendingDamageSignature = buildPendingDamageSemanticSignature(
                (match.state.core as { pendingDamage?: unknown } | undefined)?.pendingDamage,
            );
            const pendingBonusDiceSignature = buildPendingBonusDiceSettlementSemanticSignature(
                (match.state.core as { pendingBonusDiceSettlement?: unknown } | undefined)?.pendingBonusDiceSettlement,
            );
            return [
                interactionKind,
                interactionIdSignature,
                typeof data?.sourceId === 'string' ? data.sourceId : '',
                typeof data?.title === 'string' ? data.title : '',
                sliderSignature,
                multistepMetaSignature,
                pendingDamageSignature,
                pendingBonusDiceSignature,
                Array.isArray(data?.allowedDieIds) ? data.allowedDieIds.join(',') : '',
                Array.isArray(data?.completedDieIds) ? data.completedDieIds.join(',') : '',
                JSON.stringify(data?.confirmValue ?? null),
                options,
            ].join('|');
        };
        const tryHardCancelCurrentAiInteraction = async (
            candidateToCancel: ForceEndTurnStalledAiResolution,
        ): Promise<boolean> => {
            if (!isInteractionRecoveryReason(candidateToCancel.reason)) {
                return false;
            }
            if (!candidateToCancel.playerId || seatControllers[candidateToCancel.playerId]?.type === 'human') {
                return false;
            }

            const currentInteraction = (match.state.sys?.interaction as {
                current?: {
                    id?: unknown;
                    kind?: unknown;
                    playerId?: unknown;
                };
            } | undefined)?.current;
            if (!currentInteraction || String(currentInteraction.playerId ?? '') !== candidateToCancel.playerId) {
                return false;
            }
            if (currentInteraction.kind === 'compare-roll-choice') {
                return false;
            }

            usedForcedRecoveryCommand = true;
            totalForcedCommands += 1;
            lastForcedReason = candidateToCancel.reason;
            lastForcedPhaseLabel = phaseLabel;

            const success = await this.executeCommandInternal(
                match,
                candidateToCancel.playerId,
                INTERACTION_COMMANDS.CANCEL,
                {
                    interactionId: typeof currentInteraction.id === 'string' ? currentInteraction.id : undefined,
                },
            );
            return success;
        };

        try {
            const buildRecoverySequenceStepKey = (playerId: string, progressMarker: string): string => {
                const interactionFingerprint = readCurrentAiInteractionSemanticFingerprint(playerId);
                if (interactionFingerprint) {
                    return `${progressMarker}|interaction:${interactionFingerprint}`;
                }

                const responseWindowFingerprint = readCurrentAiResponseWindowRecoveryFingerprintHint(playerId);
                if (responseWindowFingerprint) {
                    return `${progressMarker}|response-window:${responseWindowFingerprint}`;
                }

                return progressMarker;
            };
            const seenStepKeys = new Set<string>();
            let recoverySteps = 0;
            let allowNaturalAiContinuation = false;
            let lastUnreportedLegalActionRecovery: {
                candidateReason: ForceEndTurnStalledAiResolution['reason'];
                playerId: string;
                actionKind: string;
                actionId: string;
            } | null = null;
            if (currentCandidate.legalActionOnly !== true) {
                const initialCandidate = await revalidateRecoveryCandidate(currentCandidate);
                if (!initialCandidate) {
                    return;
                }
                currentCandidate = initialCandidate;
            }
            seenStepKeys.add(buildRecoverySequenceStepKey(currentCandidate.playerId, progressMarkerBeforeRecovery));

            while (recoverySteps <= this.onlineAiRecoveryMaxAdvanceSteps) {
                phaseLabel = currentCandidate.requiresConfirmedAdvancePhase ? 'recover-interaction' : 'follow-up-advance';
                const markerBeforeStep = buildAiProgressMarker(match.state, {
                    engineConfig: match.engineConfig,
                    gameId: match.gameId,
                });
                const currentPlayerIdBeforeStep = resolveWatchdogCurrentPlayerId();
                const stepKeyBefore = buildRecoverySequenceStepKey(currentCandidate.playerId, markerBeforeStep);
                const interactionFingerprintBeforeStep = readCurrentAiInteractionSemanticFingerprint(currentCandidate.playerId);
                const responseWindowFingerprintBeforeStep = readCurrentAiResponseWindowRecoveryFingerprintHint(currentCandidate.playerId);
                const actionRecovery = await this.tryRecoverOnlineAiWithLegalAction(
                    match,
                    currentCandidate,
                    tracker,
                    seatControllers,
                );
                const blockedFailureReason = actionRecovery.blockedReason === 'stale-private-overlay'
                    ? 'private_overlay_stale'
                    : actionRecovery.blockedReason === 'missing-private-overlay'
                        ? 'private_overlay_missing'
                        : actionRecovery.blockedReason === 'missing-visible-state'
                            ? 'missing_visible_state'
                            : null;
                const actionRecoveryApplied = actionRecovery.applied;
                if (actionRecovery.applied && actionRecovery.reportedAction) {
                    lastUnreportedLegalActionRecovery = actionRecovery.reportedAction;
                }
                const executedCommandTypes = new Set<string>(actionRecovery.executedCommandTypes);

                if (!actionRecoveryApplied) {
                    const shouldPauseAfterForcedInteractionOverlayResync =
                        currentCandidate.reason === 'active-turn'
                        && currentCandidate.legalActionOnly !== true
                        && blockedFailureReason != null
                        && usedForcedRecoveryCommand
                        && isInteractionRecoveryReason(lastForcedReason ?? candidate.reason);
                    if (shouldPauseAfterForcedInteractionOverlayResync) {
                        syncRecoveryTrackerToCandidate(currentCandidate);
                        return;
                    }
                    const recoveryCommands = currentCandidate.resolution.action.commands;
                    const currentPhase = typeof match.state.sys?.phase === 'string' ? match.state.sys.phase : '';
                    const canFallbackToRecoveryCommandAfterActiveTurnNoProgress =
                        currentCandidate.reason === 'active-turn'
                        && currentCandidate.legalActionOnly !== true
                        && actionRecovery.outcome === 'legal-action-command-failed'
                        && !actionRecovery.failedCommandType
                        && recoveryCommands.length > 0
                        && !hasHumanResponderInCurrentWindow()
                        && match.engineConfig.onlineAiRecovery?.allowForceCommandAfterLegalActionExhausted?.({
                            state: match.state,
                            phase: currentPhase,
                            previousCandidate: currentCandidate,
                            nextCandidate: currentCandidate,
                        }) === true;
                    if (actionRecovery.outcome === 'legal-action-command-failed') {
                        if (!canFallbackToRecoveryCommandAfterActiveTurnNoProgress) {
                            const revalidatedCandidate = await revalidateRecoveryCandidate(currentCandidate);
                            if (!revalidatedCandidate) {
                                return;
                            }
                            currentCandidate = revalidatedCandidate;
                            await this.handleOnlineAiRecoveryFailure(
                                match,
                                tracker,
                                currentCandidate,
                                phaseLabel,
                                progressMarkerBeforeRecovery,
                                formatOnlineAiCommandFailureReason(
                                    'legal_action_command_failed',
                                    actionRecovery.failedCommandType,
                                    actionRecovery.commandFailureReason,
                                ),
                            );
                            return;
                        }
                    }
                    const canFallbackToRecoveryCommandAfterLegalActionAttempt =
                        currentCandidate.allowForceCommandAfterLegalActionExhausted === true
                        && currentCandidate.legalActionOnly === true
                        && actionRecovery.outcome === 'no-legal-action'
                        && recoveryCommands.length > 0;
                    if ((currentCandidate.legalActionOnly === true && !canFallbackToRecoveryCommandAfterLegalActionAttempt)
                        || recoveryCommands.length === 0) {
                        const revalidatedCandidate = await revalidateRecoveryCandidate(currentCandidate);
                        if (!revalidatedCandidate) {
                            return;
                        }
                        currentCandidate = revalidatedCandidate;
                        const legalActionUnavailableReason = blockedFailureReason
                            ?? (actionRecovery.outcome === 'legal-action-command-failed'
                                ? formatOnlineAiCommandFailureReason(
                                    'legal_action_command_failed',
                                    actionRecovery.failedCommandType,
                                    actionRecovery.commandFailureReason,
                                )
                                : 'legal_action_unavailable');
                        await this.handleOnlineAiRecoveryFailure(
                            match,
                            tracker,
                            currentCandidate,
                            phaseLabel,
                            progressMarkerBeforeRecovery,
                            legalActionUnavailableReason,
                        );
                        return;
                    }

                    usedForcedRecoveryCommand = true;
                    totalForcedCommands += 1;
                    lastForcedReason = currentCandidate.reason;
                    lastForcedPhaseLabel = phaseLabel;
                    const nextCommand = mapRecoveryCommand(recoveryCommands[0]);
                    const nextCommandType = nextCommand?.type ?? 'UNKNOWN';
                    if (nextCommandType === advancePhaseCommandType
                        && !canExecuteWatchdogAdvancePhase(currentCandidate.playerId)) {
                        await this.handleOnlineAiRecoveryFailure(
                            match,
                            tracker,
                            currentCandidate,
                            phaseLabel,
                            progressMarkerBeforeRecovery,
                            'advance_guard_blocked',
                        );
                        return;
                    }
                    const nextSuccess = await this.executeCommandInternal(
                        match,
                        currentCandidate.playerId,
                        nextCommandType,
                        nextCommand?.payload ?? {},
                    );
                    if (!nextSuccess) {
                        const commandFailureReason = match.lastCommandFailureReason;
                        const revalidatedCandidate = await revalidateRecoveryCandidate(currentCandidate);
                        if (!revalidatedCandidate) {
                            return;
                        }
                        currentCandidate = revalidatedCandidate;
                        await this.handleOnlineAiRecoveryFailure(
                            match,
                            tracker,
                            currentCandidate,
                            phaseLabel,
                            progressMarkerBeforeRecovery,
                            formatOnlineAiCommandFailureReason('command_failed', nextCommandType, commandFailureReason),
                        );
                        return;
                    }
                    executedCommandTypes.add(nextCommandType);

                    if (nextCommandType === advancePhaseCommandType) {
                        totalAdvanceSteps += 1;
                    }
                }

                recoverySteps += 1;
                const attemptedInteractionRespond = executedCommandTypes.has(INTERACTION_COMMANDS.RESPOND);
                const nextMarker = buildAiProgressMarker(match.state, {
                    engineConfig: match.engineConfig,
                    gameId: match.gameId,
                });
                const nextStepKey = buildRecoverySequenceStepKey(currentCandidate.playerId, nextMarker);
                const interactionFingerprintAfterStep = readCurrentAiInteractionSemanticFingerprint(currentCandidate.playerId);
                const interactionRecoveryFingerprintAfterStep = readCurrentAiInteractionRecoveryFingerprintHint(currentCandidate.playerId);
                if (nextStepKey === stepKeyBefore) {
                    if (attemptedInteractionRespond
                        && interactionFingerprintBeforeStep
                        && interactionFingerprintAfterStep === interactionFingerprintBeforeStep
                        && interactionRecoveryFingerprintAfterStep === currentCandidate.fingerprintHint
                        && await tryHardCancelCurrentAiInteraction(currentCandidate)) {
                        const postCancelCandidate = await resolveChainedRecoveryCandidate(candidate.playerId);
                        if (!postCancelCandidate || postCancelCandidate.playerId !== candidate.playerId) {
                            break;
                        }
                        currentCandidate = postCancelCandidate;
                        continue;
                    }
                    const revalidatedCandidate = await revalidateRecoveryCandidate(currentCandidate);
                    if (!revalidatedCandidate) {
                        return;
                    }
                    currentCandidate = revalidatedCandidate;
                    const noProgressReason = !actionRecoveryApplied
                        && actionRecovery.outcome === 'blocked'
                        && blockedFailureReason
                        ? blockedFailureReason
                        : 'no_progress';
                    await this.handleOnlineAiRecoveryFailure(
                        match,
                        tracker,
                        currentCandidate,
                        phaseLabel,
                        progressMarkerBeforeRecovery,
                        noProgressReason,
                    );
                    return;
                }
                if (seenStepKeys.has(nextStepKey)) {
                    const revalidatedCandidate = await revalidateRecoveryCandidate(currentCandidate);
                    if (!revalidatedCandidate) {
                        return;
                    }
                    currentCandidate = revalidatedCandidate;
                    await this.handleOnlineAiRecoveryFailure(
                        match,
                        tracker,
                        currentCandidate,
                        phaseLabel,
                        progressMarkerBeforeRecovery,
                        'loop_detected',
                    );
                    return;
                }
                seenStepKeys.add(nextStepKey);

                const nextCandidate = await resolveChainedRecoveryCandidate(candidate.playerId);
                if (!nextCandidate || nextCandidate.playerId !== candidate.playerId) {
                    break;
                }
                const shouldRestrictFollowUpToLegalActions = candidate.requiresConfirmedAdvancePhase
                    && (candidate.reason === 'visible-interaction' || candidate.reason === 'hidden-interaction')
                    && nextCandidate.reason === 'active-turn'
                    && currentPlayerIdBeforeStep !== candidate.playerId
                    && resolveWatchdogCurrentPlayerId() === candidate.playerId;
                const seatViewInteractionAfterStep = readCurrentAiSeatViewInteractionRecoveryFingerprintHint(candidate.playerId);
                if (actionRecoveryApplied
                    && isInteractionRecoveryReason(candidate.reason)
                    && isInteractionRecoveryReason(currentCandidate.reason)
                    && !responseWindowFingerprintBeforeStep
                    && !seatViewInteractionAfterStep
                    && nextCandidate.reason === 'active-turn'
                    && !shouldRestrictFollowUpToLegalActions) {
                    // visible/hidden interaction 自己已通过 legal action 收口时，
                    // 这一轮 watchdog 的成功点就是“解除交互阻塞”；
                    // 后续普通 active-turn 代打应交给下一轮 candidate，而不是吞掉本次 resolved feedback。
                    allowNaturalAiContinuation = true;
                    break;
                }
                if (attemptedInteractionRespond
                    && isInteractionRecoveryReason(currentCandidate.reason)
                    && isInteractionRecoveryReason(nextCandidate.reason)
                    && interactionFingerprintBeforeStep
                    && interactionFingerprintAfterStep === interactionFingerprintBeforeStep
                    && await tryHardCancelCurrentAiInteraction(nextCandidate)) {
                    const postCancelCandidate = await resolveChainedRecoveryCandidate(candidate.playerId);
                    if (!postCancelCandidate || postCancelCandidate.playerId !== candidate.playerId) {
                        break;
                    }
                    currentCandidate = postCancelCandidate;
                    continue;
                }
                // 响应窗口循环检测：如果刚执行了 RESPONSE_PASS 但同一 AI 的 response-window 立刻重开，
                // 说明 RESPONSE_PASS 无法推进，应升级为 FORCE_CLOSE 强制关闭窗口。
                if (currentCandidate.reason === 'response-window'
                    && executedCommandTypes.has('RESPONSE_PASS')
                    && nextCandidate.reason === 'response-window'
                    && nextCandidate.playerId === candidate.playerId) {
                    const suffix = buildResponseWindowRecoveryFingerprintHint(
                        match.state,
                        candidate.playerId,
                        'response-loop',
                    );
                    currentCandidate = {
                        ...nextCandidate,
                        reason: 'response-loop',
                        fingerprintHint: suffix,
                        resolution: {
                            playerId: candidate.playerId,
                            attemptKey: `force-end-turn:${candidate.playerId}:${suffix}`,
                            source: 'local-ai',
                            action: {
                                actionId: `force-end-turn:${suffix}`,
                                kind: 'force-end-turn',
                                label: '强制结束 AI 回合',
                                commands: [{ type: 'SYS_RESPONSE_WINDOW_FORCE_CLOSE', payload: {} }],
                            },
                        },
                    };
                    continue;
                }
                const currentPhase = typeof match.state.sys?.phase === 'string' ? match.state.sys.phase : '';
                const allowAdvancePhaseFallbackAfterLegalExhausted = shouldRestrictFollowUpToLegalActions
                    && !hasHumanResponderInCurrentWindow()
                    && match.engineConfig.onlineAiRecovery?.allowForceCommandAfterLegalActionExhausted?.({
                        state: match.state,
                        phase: currentPhase,
                        previousCandidate: candidate,
                        nextCandidate,
                    }) === true;
                const normalizedNextCandidate = shouldRestrictFollowUpToLegalActions
                    ? {
                        ...nextCandidate,
                        legalActionOnly: true,
                        ...(allowAdvancePhaseFallbackAfterLegalExhausted
                            ? {
                                allowForceCommandAfterLegalActionExhausted: true,
                            }
                            : {
                                resolution: {
                                    ...nextCandidate.resolution,
                                    action: {
                                        ...nextCandidate.resolution.action,
                                        commands: [],
                                    },
                                },
                            }),
                    }
                    : nextCandidate;
                const hasLiveSeatConnection = (match.connections.get(candidate.playerId)?.size ?? 0) > 0;
                const shouldContinueOfflineLegalOnlyActiveTurnRecovery =
                    actionRecoveryApplied
                    && candidate.reason === 'active-turn-legal-only'
                    && normalizedNextCandidate.reason === 'active-turn'
                    && !hasLiveSeatConnection
                    && normalizedNextCandidate.resolution.action.commands.length > 0;
                if (shouldContinueOfflineLegalOnlyActiveTurnRecovery) {
                    currentCandidate = normalizedNextCandidate;
                    continue;
                }
                // 仅在 AI seat 在线时才交给自然链路继续；离线时需继续 watchdog 收口，避免停在 AI 半回合。
                if (actionRecoveryApplied && normalizedNextCandidate.reason === 'active-turn' && hasLiveSeatConnection) {
                    allowNaturalAiContinuation = true;
                    break;
                }
                if (normalizedNextCandidate.legalActionOnly === true) {
                    syncRecoveryTrackerToCandidate(normalizedNextCandidate);
                }
                currentCandidate = normalizedNextCandidate;
            }

            const markerAfterRecovery = buildAiProgressMarker(match.state, {
                engineConfig: match.engineConfig,
                gameId: match.gameId,
            });
            const unresolvedCandidate = allowNaturalAiContinuation
                ? null
                : await resolveChainedRecoveryCandidate(candidate.playerId);
            if (unresolvedCandidate?.playerId === candidate.playerId) {
                const revalidatedCandidate = await revalidateRecoveryCandidate(unresolvedCandidate);
                if (!revalidatedCandidate) {
                    return;
                }
                await this.handleOnlineAiRecoveryFailure(
                    match,
                    tracker,
                    revalidatedCandidate,
                    revalidatedCandidate.requiresConfirmedAdvancePhase ? 'recover-interaction' : 'follow-up-advance',
                    progressMarkerBeforeRecovery,
                    'blocker_persisted',
                );
                return;
            }
            if (markerAfterRecovery === progressMarkerBeforeRecovery) {
                const revalidatedCandidate = await revalidateRecoveryCandidate(currentCandidate);
                if (!revalidatedCandidate) {
                    return;
                }
                currentCandidate = revalidatedCandidate;
                await this.handleOnlineAiRecoveryFailure(
                    match,
                    tracker,
                    currentCandidate,
                    phaseLabel,
                    progressMarkerBeforeRecovery,
                    'no_progress',
                );
                return;
            }

            const repeatedAttempt = this.recordOnlineAiRepeatedRecoveryAttempt(match.matchID, tracker.key);
            logger.warn('[GameTransport] online-ai-watchdog recovered stalled AI', {
                matchID: match.matchID,
                gameId: match.gameId,
                playerID: candidate.playerId,
                reason: candidate.reason,
                advanceSteps: totalAdvanceSteps,
                repeatedAttemptCount: repeatedAttempt.count,
                markerBefore: progressMarkerBeforeRecovery,
                markerAfter: markerAfterRecovery,
            });

            this.onlineAiRecoveryTrackers.delete(match.matchID);
            if (!usedForcedRecoveryCommand && lastUnreportedLegalActionRecovery) {
                await this.reportOnlineAiRecoveryFeedback({
                    matchId: match.matchID,
                    gameId: match.gameId,
                    playerId: lastUnreportedLegalActionRecovery.playerId,
                    incidentKind: 'legal-action-recovered',
                    severity: 'medium',
                    status: 'resolved',
                    reason: `${lastUnreportedLegalActionRecovery.candidateReason}:legal-action:${lastUnreportedLegalActionRecovery.actionKind}:${lastUnreportedLegalActionRecovery.actionId}`,
                    trackerKey: tracker.key,
                    progressMarker: progressMarkerBeforeRecovery,
                    stateSnapshot: await this.buildOnlineAiRecoveryStateSnapshot(
                        match,
                        candidate,
                        tracker.key,
                        progressMarkerBeforeRecovery,
                    ),
                    actionLog: this.buildOnlineAiRecoveryActionLog(
                        match,
                        candidate,
                        tracker.key,
                        progressMarkerBeforeRecovery,
                    ),
                });
            }
            if (!usedForcedRecoveryCommand) {
                return;
            }
            const reportedReason = lastForcedReason ?? candidate.reason;
            const reportedPhaseLabel = lastForcedReason ? lastForcedPhaseLabel : phaseLabel;
            const reportedSteps = Math.max(totalAdvanceSteps, totalForcedCommands, 1);
            await this.reportOnlineAiRecoveryFeedback({
                matchId: match.matchID,
                gameId: match.gameId,
                playerId: candidate.playerId,
                incidentKind: 'force-end-turn-success',
                severity: 'medium',
                status: 'resolved',
                reason: `${reportedReason}:${reportedPhaseLabel}:steps=${reportedSteps}`,
                trackerKey: tracker.key,
                progressMarker: progressMarkerBeforeRecovery,
                stateSnapshot: await this.buildOnlineAiRecoveryStateSnapshot(
                    match,
                    candidate,
                    tracker.key,
                    progressMarkerBeforeRecovery,
                ),
                actionLog: this.buildOnlineAiRecoveryActionLog(
                    match,
                    candidate,
                    tracker.key,
                    progressMarkerBeforeRecovery,
                ),
            });
        } finally {
            if (!match.unloaded) {
                await this.drainCommandQueue(match);
            }
            match.executing = false;
        }
    }

    private async handleOnlineAiRecoveryFailure(
        match: ActiveMatch,
        tracker: OnlineAiRecoveryTracker,
        candidate: ForceEndTurnStalledAiResolution,
        phaseLabel: 'recover-interaction' | 'follow-up-advance',
        progressMarkerBeforeRecovery: string,
        reason: string,
    ): Promise<void> {
        const rejection = applyAiAutoRecoveryRejection(tracker, reason, Date.now());
        const nextTracker: OnlineAiRecoveryTracker = {
            ...rejection.nextTracker,
            key: tracker.key,
            failureCount: tracker.failureCount + 1,
        };
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
                gameId: match.gameId,
            }),
        });

        if (nextTracker.failureCount >= this.onlineAiRecoveryFailureReportThreshold) {
            await this.reportOnlineAiRecoveryFeedback({
                matchId: match.matchID,
                gameId: match.gameId,
                playerId: candidate.playerId,
                incidentKind: 'force-end-turn-failed',
                severity: 'high',
                reason: `${candidate.reason}:${phaseLabel}:${reason}`,
                trackerKey: tracker.key,
                progressMarker: progressMarkerBeforeRecovery,
                stateSnapshot: await this.buildOnlineAiRecoveryStateSnapshot(
                    match,
                    candidate,
                    tracker.key,
                    progressMarkerBeforeRecovery,
                    reason,
                ),
                actionLog: this.buildOnlineAiRecoveryActionLog(
                    match,
                    candidate,
                    tracker.key,
                    progressMarkerBeforeRecovery,
                    reason,
                ),
            });
        }
    }

    private buildOnlineAiRepeatedRecoveryAttemptKey(matchID: string, trackerKey: string): string {
        return `${matchID}:${trackerKey}`;
    }

    private recordOnlineAiRepeatedRecoveryAttempt(
        matchID: string,
        trackerKey: string,
    ): OnlineAiRepeatedRecoveryAttempt {
        const key = this.buildOnlineAiRepeatedRecoveryAttemptKey(matchID, trackerKey);
        const previous = this.onlineAiRepeatedRecoveryAttempts.get(key);
        const next: OnlineAiRepeatedRecoveryAttempt = {
            count: (previous?.count ?? 0) + 1,
            lastAttemptAt: Date.now(),
            reported: previous?.reported ?? false,
        };
        this.onlineAiRepeatedRecoveryAttempts.set(key, next);
        return next;
    }

    private markOnlineAiRepeatedRecoveryAttemptReported(
        repeatedAttemptKey: string,
        repeatedAttempt: OnlineAiRepeatedRecoveryAttempt | undefined,
    ): OnlineAiRepeatedRecoveryAttempt {
        const next: OnlineAiRepeatedRecoveryAttempt = {
            count: repeatedAttempt?.count ?? this.onlineAiRecoveryRepeatedAttemptLimit,
            lastAttemptAt: Date.now(),
            reported: true,
        };
        this.onlineAiRepeatedRecoveryAttempts.set(repeatedAttemptKey, next);
        return next;
    }

    private resolveRepeatLimitCurrentAiInteraction(args: {
        match: ActiveMatch;
        candidate: ForceEndTurnStalledAiResolution;
        seatControllers: Record<string, OnlineAiWatchdogSeatController>;
    }): { id?: string; kind?: string } | null {
        if (args.candidate.reason !== 'visible-interaction' && args.candidate.reason !== 'hidden-interaction') {
            return null;
        }
        if (!args.candidate.playerId || args.seatControllers[args.candidate.playerId]?.type === 'human') {
            return null;
        }

        const responseWindow = (args.match.state.sys?.responseWindow as { current?: unknown } | undefined)?.current;
        if (responseWindow) {
            return null;
        }

        const currentInteraction = (args.match.state.sys?.interaction as {
            current?: {
                id?: unknown;
                kind?: unknown;
                playerId?: unknown;
            };
        } | undefined)?.current;
        if (!currentInteraction || String(currentInteraction.playerId ?? '') !== args.candidate.playerId) {
            return null;
        }

        const kind = typeof currentInteraction.kind === 'string' ? currentInteraction.kind : undefined;
        if (kind === 'compare-roll-choice') {
            return null;
        }

        return {
            id: typeof currentInteraction.id === 'string' ? currentInteraction.id : undefined,
            kind,
        };
    }

    private async tryForceUnblockRepeatedOnlineAiRecovery(args: {
        match: ActiveMatch;
        candidate: ForceEndTurnStalledAiResolution;
        trackerKey: string;
        progressMarker: string;
        repeatedAttemptKey: string;
        repeatedAttempt: OnlineAiRepeatedRecoveryAttempt | undefined;
        seatControllers: Record<string, OnlineAiWatchdogSeatController>;
    }): Promise<{ handled: boolean; suppressionReason?: string }> {
        if (args.repeatedAttempt?.reported) {
            return { handled: true };
        }
        if (args.match.unloaded) {
            return { handled: false, suppressionReason: 'match_unloaded' };
        }
        if (args.match.executing) {
            return { handled: false, suppressionReason: 'match_executing' };
        }

        args.match.executing = true;
        const forcedCommands: string[] = [];
        try {
            const isInteractionCandidate =
                args.candidate.reason === 'visible-interaction'
                || args.candidate.reason === 'hidden-interaction';
            const currentInteraction = this.resolveRepeatLimitCurrentAiInteraction({
                match: args.match,
                candidate: args.candidate,
                seatControllers: args.seatControllers,
            });
            if (isInteractionCandidate && !currentInteraction) {
                return { handled: false, suppressionReason: 'interaction_not_force_cancel_safe' };
            }
            if (currentInteraction) {
                const cancelSuccess = await this.executeCommandInternal(
                    args.match,
                    args.candidate.playerId,
                    INTERACTION_COMMANDS.CANCEL,
                    {
                        interactionId: currentInteraction.id,
                        reason: 'repeated-recovery-limit',
                    },
                );
                if (!cancelSuccess) {
                    await this.reportOnlineAiRepeatedRecoverySuppressed({
                        match: args.match,
                        candidate: args.candidate,
                        trackerKey: args.trackerKey,
                        progressMarker: args.progressMarker,
                        repeatedAttemptKey: args.repeatedAttemptKey,
                        repeatedAttempt: args.repeatedAttempt,
                        suppressionReason: formatOnlineAiCommandFailureReason(
                            'force_cancel_failed',
                            INTERACTION_COMMANDS.CANCEL,
                            args.match.lastCommandFailureReason,
                        ),
                    });
                    return { handled: true };
                }
                forcedCommands.push(INTERACTION_COMMANDS.CANCEL);
            }

            const advanceResolution = resolveForceAdvancePhaseAfterRecovery({
                authoritativeState: args.match.state,
                seatControllers: args.seatControllers,
                playerId: args.candidate.playerId,
                engineConfig: args.match.engineConfig,
                gameId: args.match.gameId,
            });
            const advanceCommand = advanceResolution?.action.commands[0];
            if (advanceCommand) {
                const advanceSuccess = await this.executeCommandInternal(
                    args.match,
                    args.candidate.playerId,
                    advanceCommand.type,
                    advanceCommand.payload ?? {},
                );
                if (!advanceSuccess) {
                    await this.reportOnlineAiRepeatedRecoverySuppressed({
                        match: args.match,
                        candidate: args.candidate,
                        trackerKey: args.trackerKey,
                        progressMarker: args.progressMarker,
                        repeatedAttemptKey: args.repeatedAttemptKey,
                        repeatedAttempt: args.repeatedAttempt,
                        suppressionReason: formatOnlineAiCommandFailureReason(
                            'force_advance_failed',
                            advanceCommand.type,
                            args.match.lastCommandFailureReason,
                        ),
                    });
                    return { handled: true };
                }
                forcedCommands.push(advanceCommand.type);
            }

            if (forcedCommands.length === 0) {
                return { handled: false, suppressionReason: 'no_safe_force_unblock' };
            }

            const markerAfter = buildAiProgressMarker(args.match.state, {
                engineConfig: args.match.engineConfig,
                gameId: args.match.gameId,
            });
            if (markerAfter === args.progressMarker) {
                await this.reportOnlineAiRepeatedRecoverySuppressed({
                    match: args.match,
                    candidate: args.candidate,
                    trackerKey: args.trackerKey,
                    progressMarker: args.progressMarker,
                    repeatedAttemptKey: args.repeatedAttemptKey,
                    repeatedAttempt: args.repeatedAttempt,
                    suppressionReason: 'force_unblock_no_progress',
                });
                return { handled: true };
            }

            const reportedAttempt = this.markOnlineAiRepeatedRecoveryAttemptReported(
                args.repeatedAttemptKey,
                args.repeatedAttempt,
            );
            const reason = [
                args.candidate.reason,
                `repeat-limit-force-unblock:${reportedAttempt.count}/${this.onlineAiRecoveryRepeatedAttemptLimit}`,
                `commands=${forcedCommands.join('+')}`,
            ].join(':');

            logger.warn('[GameTransport] online-ai-watchdog force-unblocked repeated recovery', {
                matchID: args.match.matchID,
                gameId: args.match.gameId,
                playerID: args.candidate.playerId,
                incidentKey: args.trackerKey,
                reason,
                repeatedAttemptCount: reportedAttempt.count,
                repeatedAttemptLimit: this.onlineAiRecoveryRepeatedAttemptLimit,
                markerBefore: args.progressMarker,
                markerAfter,
                commands: forcedCommands,
            });

            this.onlineAiRecoveryTrackers.delete(args.match.matchID);
            await this.reportOnlineAiRecoveryFeedback({
                matchId: args.match.matchID,
                gameId: args.match.gameId,
                playerId: args.candidate.playerId,
                incidentKind: 'repeated-recovery-force-unblocked',
                severity: 'high',
                status: 'open',
                reason,
                trackerKey: args.trackerKey,
                progressMarker: args.progressMarker,
                stateSnapshot: await this.buildOnlineAiRecoveryStateSnapshot(
                    args.match,
                    args.candidate,
                    args.trackerKey,
                    args.progressMarker,
                    'repeated_recovery_force_unblocked',
                ),
                actionLog: this.buildOnlineAiRecoveryActionLog(
                    args.match,
                    args.candidate,
                    args.trackerKey,
                    args.progressMarker,
                    'repeated_recovery_force_unblocked',
                ),
            });
            return { handled: true };
        } finally {
            if (!args.match.unloaded) {
                await this.drainCommandQueue(args.match);
            }
            args.match.executing = false;
        }
    }

    private async reportOnlineAiRepeatedRecoverySuppressed(args: {
        match: ActiveMatch;
        candidate: ForceEndTurnStalledAiResolution;
        trackerKey: string;
        progressMarker: string;
        repeatedAttemptKey: string;
        repeatedAttempt: OnlineAiRepeatedRecoveryAttempt | undefined;
        suppressionReason?: string;
    }): Promise<void> {
        const repeatedAttempt = args.repeatedAttempt ?? {
            count: this.onlineAiRecoveryRepeatedAttemptLimit,
            lastAttemptAt: Date.now(),
            reported: false,
        };
        if (repeatedAttempt.reported) {
            return;
        }

        const nextRepeatedAttempt: OnlineAiRepeatedRecoveryAttempt = {
            ...repeatedAttempt,
            reported: true,
            lastAttemptAt: Date.now(),
        };
        this.onlineAiRepeatedRecoveryAttempts.set(args.repeatedAttemptKey, nextRepeatedAttempt);
        const reason = [
            args.candidate.reason,
            `repeat-limit:${repeatedAttempt.count}/${this.onlineAiRecoveryRepeatedAttemptLimit}`,
            args.suppressionReason,
        ].filter(Boolean).join(':');

        logger.warn('[GameTransport] online-ai-watchdog suppressed repeated recovery', {
            matchID: args.match.matchID,
            gameId: args.match.gameId,
            playerID: args.candidate.playerId,
            incidentKey: args.trackerKey,
            reason,
            repeatedAttemptCount: repeatedAttempt.count,
            repeatedAttemptLimit: this.onlineAiRecoveryRepeatedAttemptLimit,
            marker: args.progressMarker,
        });

        await this.reportOnlineAiRecoveryFeedback({
            matchId: args.match.matchID,
            gameId: args.match.gameId,
            playerId: args.candidate.playerId,
            incidentKind: 'repeated-recovery-suppressed',
            severity: 'high',
            status: 'open',
            reason,
            trackerKey: args.trackerKey,
            progressMarker: args.progressMarker,
            stateSnapshot: await this.buildOnlineAiRecoveryStateSnapshot(
                args.match,
                args.candidate,
                args.trackerKey,
                args.progressMarker,
                args.suppressionReason ?? 'repeated_recovery_suppressed',
            ),
            actionLog: this.buildOnlineAiRecoveryActionLog(
                args.match,
                args.candidate,
                args.trackerKey,
                args.progressMarker,
                args.suppressionReason ?? 'repeated_recovery_suppressed',
            ),
        });
    }

    private async buildOnlineAiRecoveryStateSnapshot(
        match: ActiveMatch,
        candidate: ForceEndTurnStalledAiResolution,
        trackerKey: string,
        progressMarker: string,
        failureReason?: string,
    ): Promise<string> {
        const interactionState = match.state.sys?.interaction as { isBlocked?: unknown } | undefined;
        const sharedInteraction = extractAiInteractionSnapshot(match.state);
        const seatView = this.applyPlayerView(match, candidate.playerId) as MatchState<unknown>;
        const seatInteraction = extractAiInteractionSnapshot(seatView);
        const sharedInteractionState = (match.state.sys?.interaction as { current?: unknown } | undefined)?.current;
        const seatInteractionState = (seatView.sys?.interaction as { current?: unknown } | undefined)?.current;
        const responseWindow = extractAiResponseWindowSnapshot(match.state);
        const pendingDamage = this.buildOnlineAiPendingDamageDiagnostic(match.state);
        const aiSummary = await this.buildOnlineAiRecoveryAiSummary(match, candidate.playerId, seatView);
        const sharedUnsatisfiableReasonDetailed = resolveUnsatisfiableReasonFromInteraction(
            match.state,
            sharedInteractionState as HiddenInteractionDescriptor | undefined,
        );
        const seatUnsatisfiableReasonDetailed = resolveUnsatisfiableReasonFromInteraction(
            seatView,
            seatInteractionState as HiddenInteractionDescriptor | undefined,
        );
        const sharedUnsatisfiableReason = resolveUnsatisfiableReasonFromSelectability(sharedInteraction)
            ?? sharedUnsatisfiableReasonDetailed;
        const seatUnsatisfiableReason = resolveUnsatisfiableReasonFromSelectability(seatInteraction)
            ?? seatUnsatisfiableReasonDetailed;
        const blockerFingerprint = this.resolveOnlineAiRecoveryFeedbackFingerprint(
            match,
            candidate,
            trackerKey,
            progressMarker,
            failureReason,
        );

        return JSON.stringify({
            matchId: match.matchID,
            gameId: match.gameId,
            playerId: candidate.playerId,
            reason: candidate.reason,
            trackerKey,
            blockerFingerprint,
            phase: match.state.sys?.phase ?? null,
            turnNumber: match.state.sys?.turnNumber ?? null,
            currentPlayerId: resolveCurrentPlayerId(match.state),
            progressMarker,
            recentActionLogTail: this.extractOnlineAiRecoveryActionLogTail(match.state),
            recentEventStreamTail: this.extractOnlineAiRecoveryEventTail(match.state),
            loop: candidate.reason === 'action-loop' ? (candidate.loopInfo ?? null) : null,
            interaction: {
                isBlocked: interactionState?.isBlocked ?? null,
                shared: sharedInteraction,
                sharedSelectability: buildInteractionSelectabilityDiagnostic(sharedInteraction),
                sharedUnsatisfiableReason,
                seat: seatInteraction,
                seatSelectability: buildInteractionSelectabilityDiagnostic(seatInteraction),
                seatUnsatisfiableReason,
            },
            seatControllerType: aiSummary.seatControllerType,
            legalActions: aiSummary.legalActions,
            aiDecisionPreview: aiSummary.decisionPreview,
            responseWindow,
            pendingDamage,
        });
    }

    private async buildOnlineAiRecoveryAiSummary(
        match: ActiveMatch,
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

            const seatController = rawSeatControllers?.[playerId] as aiModule.AiSeatController | undefined;
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
        const sharedInteraction = extractAiInteractionSnapshot(match.state);
        const seatInteraction = extractAiInteractionSnapshot(seatView);
        const responseWindow = extractAiResponseWindowSnapshot(seatView);
        const pendingDamage = this.buildOnlineAiPendingDamageDiagnostic(match.state);
        const blockerFingerprint = this.resolveOnlineAiRecoveryFeedbackFingerprint(
            match,
            candidate,
            trackerKey,
            progressMarker,
            failureReason,
        );
        return this.buildOnlineAiDiagnosticActionLog({
            state: match.state,
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

    private buildOnlineAiPendingDamageDiagnostic(
        state: MatchState<unknown>,
    ): OnlineAiRecoveryPendingDamageDiagnostic | null {
        const pendingDamage = (state.core as {
            pendingDamage?: {
                id?: unknown;
                responderId?: unknown;
                responseType?: unknown;
                currentDamage?: unknown;
                sourceAbilityId?: unknown;
                tokenUsageTotals?: unknown;
            };
        } | undefined)?.pendingDamage;
        return pendingDamage ? {
            id: pendingDamage.id ?? null,
            responderId: pendingDamage.responderId ?? null,
            responseType: pendingDamage.responseType ?? null,
            currentDamage: pendingDamage.currentDamage ?? null,
            sourceAbilityId: pendingDamage.sourceAbilityId ?? null,
            tokenUsageTotals: pendingDamage.tokenUsageTotals ?? null,
        } : null;
    }

    private extractOnlineAiRecoveryFingerprintFromTrackerKey(
        playerId: string,
        reason: string,
        trackerKey: string,
    ): string | null {
        const prefix = `${playerId}:${reason}:`;
        if (!trackerKey.startsWith(prefix)) {
            return null;
        }
        const fingerprint = trackerKey.slice(prefix.length).trim();
        return fingerprint || null;
    }

    private resolveOnlineAiRecoveryFeedbackFingerprint(
        match: ActiveMatch,
        candidate: ForceEndTurnStalledAiResolution,
        trackerKey: string,
        progressMarker: string,
        failureReason?: string,
    ): string | null {
        const baseFingerprint = candidate.fingerprintHint
            ?? this.extractOnlineAiRecoveryFingerprintFromTrackerKey(candidate.playerId, candidate.reason, trackerKey)
            ?? this.buildOnlineAiRecoveryFingerprint(match, candidate, progressMarker);
        const detailedFailureFingerprintSegment = failureReason === 'missing_visible_state'
            ? 'missing-visible-state'
            : failureReason === 'private_overlay_missing'
                ? 'missing-private-overlay'
                : failureReason === 'private_overlay_stale'
                    ? 'stale-private-overlay'
                    : null;
        if (detailedFailureFingerprintSegment) {
            return `${baseFingerprint}:${detailedFailureFingerprintSegment}`;
        }
        return baseFingerprint;
    }

    private buildOnlineAiRecoveryFingerprint(
        match: ActiveMatch,
        candidate: ForceEndTurnStalledAiResolution,
        progressMarker: string,
    ): string {
        const phase = typeof match.state.sys?.phase === 'string' ? match.state.sys?.phase : '';

        if (candidate.reason === 'action-loop') {
            return candidate.fingerprintHint ?? `action-loop:${candidate.playerId}:${phase}`;
        }

        if (candidate.legalActionOnly === true) {
            return candidate.fingerprintHint ?? `legal-action-only:${candidate.playerId}:${phase}`;
        }

        if (candidate.reason === 'visible-interaction' || candidate.reason === 'hidden-interaction') {
            const current = (match.state.sys as { interaction?: { current?: unknown } } | undefined)?.interaction?.current as {
                id?: unknown;
                playerId?: unknown;
                kind?: unknown;
                data?: {
                    title?: unknown;
                    sourceId?: unknown;
                    multi?: { min?: unknown };
                    options?: Array<{ id?: unknown; disabled?: unknown; value?: unknown }>;
                    confirmValue?: unknown;
                    type?: unknown;
                    targetPlayerIds?: unknown;
                    requiresTargetWithStatus?: unknown;
                    transferConfig?: { statusId?: unknown };
                };
            } | undefined;
            if (current) {
                return buildInteractionRecoveryFingerprintHint(match.state, current, candidate.playerId, {
                    engineConfig: match.engineConfig,
                    gameId: match.gameId,
                });
            }
            return candidate.fingerprintHint ?? progressMarker;
        }

        if (candidate.reason === 'response-window' || candidate.reason === 'response-loop') {
            const current = (match.state.sys as { responseWindow?: { current?: unknown } } | undefined)?.responseWindow?.current as {
                id?: unknown;
            } | undefined;
            if (current) {
                return buildResponseWindowRecoveryFingerprintHint(
                    match.state,
                    candidate.playerId,
                    candidate.reason,
                );
            }
            return candidate.fingerprintHint ?? progressMarker;
        }

        if (candidate.reason === 'pending-damage') {
            const pendingDamage = (match.state.core as { pendingDamage?: { id?: unknown; responderId?: unknown; responseType?: unknown } } | undefined)?.pendingDamage;
            const responderId = typeof pendingDamage?.responderId === 'string' ? pendingDamage.responderId : candidate.playerId;
            const pendingId = typeof pendingDamage?.id === 'string' ? pendingDamage?.id : '';
            const responseType = typeof pendingDamage?.responseType === 'string' ? pendingDamage?.responseType : '';
            return `pending-damage:${responderId}:${phase}:${pendingId}:${responseType}`;
        }

        return progressMarker;
    }

    private normalizeFollowUpLegalActionOnlyCandidate(
        candidate: ForceEndTurnStalledAiResolution,
        expectedCandidate: ForceEndTurnStalledAiResolution,
    ): ForceEndTurnStalledAiResolution {
        if (
            expectedCandidate.reason !== 'active-turn'
            || expectedCandidate.legalActionOnly !== true
            || candidate.reason !== 'active-turn'
            || candidate.legalActionOnly === true
        ) {
            return candidate;
        }

        return {
            ...candidate,
            legalActionOnly: true,
            ...(expectedCandidate.allowForceCommandAfterLegalActionExhausted === true
                ? {
                    allowForceCommandAfterLegalActionExhausted: true,
                }
                : {}),
        };
    }

    private async hasOnlineAiRecoveryResolved(
        match: ActiveMatch,
        candidate: ForceEndTurnStalledAiResolution,
        seatControllers: Record<string, OnlineAiWatchdogSeatController>,
    ): Promise<boolean> {
        if (candidate.legalActionOnly === true) {
            const rawNextCandidate = await this.resolveOnlineAiRecoveryCandidate(match, seatControllers);
            const nextCandidate = rawNextCandidate
                ? this.normalizeFollowUpLegalActionOnlyCandidate(rawNextCandidate, candidate)
                : rawNextCandidate;
            if (!nextCandidate || nextCandidate.playerId !== candidate.playerId) {
                return true;
            }
            if (nextCandidate.legalActionOnly !== true) {
                return nextCandidate.reason !== 'response-window' && nextCandidate.reason !== 'response-loop';
            }
            if (nextCandidate.reason !== candidate.reason) {
                return true;
            }
            if (typeof candidate.fingerprintHint === 'string' && candidate.fingerprintHint.length > 0) {
                return nextCandidate.fingerprintHint !== candidate.fingerprintHint;
            }
            return false;
        }

        if (candidate.reason === 'active-turn') {
            const nextCandidate = await this.resolveOnlineAiRecoveryCandidate(match, seatControllers);
            return !nextCandidate
                || nextCandidate.playerId !== candidate.playerId
                || nextCandidate.reason !== 'active-turn';
        }

        if (candidate.reason === 'seat-legal-only') {
            const nextCandidate = await this.resolveOnlineAiRecoveryCandidate(match, seatControllers);
            if (!nextCandidate || nextCandidate.playerId !== candidate.playerId || nextCandidate.reason !== 'seat-legal-only') {
                return true;
            }
            if (typeof candidate.fingerprintHint === 'string' && candidate.fingerprintHint.length > 0) {
                return nextCandidate.fingerprintHint !== candidate.fingerprintHint;
            }
            return false;
        }

        if (candidate.reason === 'visible-interaction') {
            const current = (match.state.sys?.interaction as { current?: { playerId?: unknown } } | undefined)?.current;
            if (current && typeof candidate.fingerprintHint === 'string' && candidate.fingerprintHint.length > 0) {
                const currentFingerprint = buildInteractionRecoveryFingerprintHint(
                    match.state,
                    current as HiddenInteractionDescriptor | HiddenSimpleChoiceInteraction,
                    candidate.playerId,
                );
                if (currentFingerprint !== candidate.fingerprintHint) {
                    return true;
                }
            }
            return String(current?.playerId ?? '') !== candidate.playerId;
        }

        if (candidate.reason === 'hidden-interaction') {
            const sharedInteraction = match.state.sys?.interaction as { current?: unknown; isBlocked?: unknown } | undefined;
            const seatView = this.applyPlayerView(match, candidate.playerId) as MatchState<unknown>;
            const seatInteraction = seatView.sys?.interaction as { current?: { playerId?: unknown }; isBlocked?: unknown } | undefined;

            if (sharedInteraction?.current) {
                const sharedCurrent = sharedInteraction.current as { playerId?: unknown } | undefined;
                if (typeof candidate.fingerprintHint === 'string' && candidate.fingerprintHint.length > 0) {
                    const sharedFingerprint = buildInteractionRecoveryFingerprintHint(
                        match.state,
                        sharedInteraction.current as HiddenInteractionDescriptor | HiddenSimpleChoiceInteraction,
                        candidate.playerId,
                    );
                    if (sharedFingerprint !== candidate.fingerprintHint) {
                        return true;
                    }
                }
                if (String(sharedCurrent?.playerId ?? '') === candidate.playerId) {
                    return false;
                }
            }

            if (seatInteraction?.current) {
                if (typeof candidate.fingerprintHint === 'string' && candidate.fingerprintHint.length > 0) {
                    const seatFingerprint = buildInteractionRecoveryFingerprintHint(
                        seatView,
                        seatInteraction.current as HiddenInteractionDescriptor | HiddenSimpleChoiceInteraction,
                        candidate.playerId,
                    );
                    if (seatFingerprint !== candidate.fingerprintHint) {
                        return true;
                    }
                }
                return String(seatInteraction.current.playerId ?? '') !== candidate.playerId;
            }

            return seatInteraction?.isBlocked !== true;
        }

        if (candidate.reason === 'response-window' || candidate.reason === 'response-loop') {
            const current = (match.state.sys?.responseWindow as {
                current?: {
                    responderQueue?: unknown;
                    currentResponderIndex?: unknown;
                };
            } | undefined)?.current;
            if (!current) {
                return true;
            }

            if (typeof candidate.fingerprintHint === 'string' && candidate.fingerprintHint.length > 0) {
                const currentFingerprint = buildResponseWindowRecoveryFingerprintHint(
                    match.state,
                    candidate.playerId,
                    candidate.reason,
                );
                if (currentFingerprint !== candidate.fingerprintHint) {
                    return true;
                }
            }

            const responderQueue = Array.isArray(current.responderQueue) ? current.responderQueue : [];
            const responderIndex = typeof current.currentResponderIndex === 'number' ? current.currentResponderIndex : 0;
            const responderId = typeof responderQueue[responderIndex] === 'string' ? responderQueue[responderIndex] : '';
            if (!responderId) {
                return false;
            }

            return responderId !== candidate.playerId || seatControllers[responderId]?.type === 'human';
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
        const sharedInteraction = extractAiInteractionSnapshot(match.state);
        const interaction = extractAiInteractionSnapshot(preCommandSeatView);
        const sharedInteractionState = (match.state.sys?.interaction as { current?: unknown } | undefined)?.current;
        const responseWindow = extractAiResponseWindowSnapshot(preCommandSeatView);
        const aiSummary = await this.buildOnlineAiRecoveryAiSummary(match, playerId, preCommandSeatView);
        const sharedUnsatisfiableReasonDetailed = resolveUnsatisfiableReasonFromInteraction(
            match.state,
            sharedInteractionState as HiddenInteractionDescriptor | undefined,
        );
        const seatUnsatisfiableReasonDetailed = resolveUnsatisfiableReasonFromInteraction(
            preCommandSeatView,
            (preCommandSeatView.sys?.interaction as { current?: unknown } | undefined)?.current as HiddenInteractionDescriptor | undefined,
        );
        const sharedUnsatisfiableReason = resolveUnsatisfiableReasonFromSelectability(sharedInteraction)
            ?? sharedUnsatisfiableReasonDetailed;
        const seatUnsatisfiableReason = reason
            ?? resolveUnsatisfiableReasonFromSelectability(interaction)
            ?? seatUnsatisfiableReasonDetailed;
        const blockerFingerprint = buildOnlineAiWatchdogBlockerFingerprint({
            phase: preCommandSeatView.sys?.phase ?? match.state.sys?.phase ?? null,
            reason,
            sharedInteraction,
            seatInteraction: interaction,
            responseWindow,
            pendingDamage: this.buildOnlineAiPendingDamageDiagnostic(match.state),
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
            currentPlayerId: resolveCurrentPlayerId(preCommandSeatView),
            progressMarker: progressMarkerBefore,
            recentActionLogTail: this.extractOnlineAiRecoveryActionLogTail(match.state),
            recentEventStreamTail: this.extractOnlineAiRecoveryEventTail(match.state),
            interaction: {
                shared: sharedInteraction,
                sharedSelectability: buildInteractionSelectabilityDiagnostic(sharedInteraction),
                sharedUnsatisfiableReason,
                seat: interaction,
                seatSelectability: buildInteractionSelectabilityDiagnostic(interaction),
                seatUnsatisfiableReason,
            },
            seatControllerType: aiSummary.seatControllerType,
            legalActions: aiSummary.legalActions,
            aiDecisionPreview: aiSummary.decisionPreview,
            responseWindow,
        });
    }

    private async reportOnlineAiRecoveryFeedback(payload: OnlineAiRecoveryFeedbackPayload): Promise<void> {
        const dedupeKey = payload.incidentKind === 'legal-action-recovered'
            ? `${payload.matchId}:${payload.playerId}:${payload.incidentKind}:${payload.trackerKey}:${payload.progressMarker}`
            : `${payload.matchId}:${payload.playerId}:${payload.incidentKind}:${payload.trackerKey}`;
        const now = Date.now();
        const cooldownUntil = this.onlineAiRecoveryFeedbackCooldown.get(dedupeKey) ?? 0;
        if (cooldownUntil > now) {
            return;
        }
        this.onlineAiRecoveryFeedbackCooldown.set(dedupeKey, now + this.onlineAiRecoveryFeedbackCooldownMs);

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
        interaction?: AiInteractionSnapshot | null;
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
                                sharedSelectability: buildInteractionSelectabilityDiagnostic(args.sharedInteraction),
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
                                seatSelectability: buildInteractionSelectabilityDiagnostic(args.interaction),
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
        const buildInfo = resolveServerFeedbackBuildInfo();
        await this.postInternalSystemFeedback({
            content: `[system][online-ai-watchdog] ${payload.incidentKind} ${payload.reason}`,
            type: 'bug',
            severity: payload.severity,
            ...(payload.status ? { status: payload.status } : {}),
            ...(payload.status === 'resolved'
                ? { resolvedMethod: payload.resolvedMethod || buildOnlineAiRecoveryResolvedMethod(payload) }
                : {}),
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
                ...buildInfo,
            },
            errorContext: {
                source: 'online-ai-watchdog',
                message: payload.reason,
                name: payload.incidentKind,
            },
        });
    }

    private async defaultCommandFailureFeedbackReporter(payload: CommandFailureFeedbackPayload): Promise<void> {
        const buildInfo = resolveServerFeedbackBuildInfo();
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
                ...buildInfo,
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
    ): Promise<{
        applied: boolean;
        resolved: boolean;
        blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay' | null;
        executedCommandTypes: string[];
        outcome: 'applied' | 'blocked' | 'no-legal-action' | 'legal-action-command-failed';
        failedCommandType?: string;
        commandFailureReason?: string | null;
        reportedAction?:
            | {
                candidateReason: ForceEndTurnStalledAiResolution['reason'];
                playerId: string;
                actionKind: string;
                actionId: string;
            }
            | null;
    }> {
        const seatController = seatControllers[candidate.playerId];
        if (!seatController || seatController.type === 'human') {
            return { applied: false, resolved: false, blockedReason: null, executedCommandTypes: [], outcome: 'no-legal-action', reportedAction: null };
        }

        const resolveStrictOnlineDecisionView = (playerId: string) => resolveOnlineAiDecisionView({
            runtime: getGameAiRuntime(match.gameId) ?? null,
            sharedState: match.state,
            privateOverlay: this.applyPlayerView(match, playerId) as MatchState<unknown>,
            playerId,
        });

        const resolveEmergencyPlayerView = (playerId: string) =>
            this.applyPlayerView(match, playerId) as MatchState<unknown>;

        let aiDispatchResult = await aiModule.resolveNextAiDispatch({
            engineConfig: match.engineConfig,
            state: match.state,
            matchId: match.matchID,
            seatControllers: {
                [candidate.playerId]: seatController,
            },
            visibleStateResolver: resolveStrictOnlineDecisionView,
        });

        const canUseEmergencyOverlayFallback = shouldUseOnlineAiEmergencyOverlayFallback(candidate.reason);
        const shouldRetryWithEmergencyOverlay = aiDispatchResult.kind === 'blocked'
            && canUseEmergencyOverlayFallback
            && (
                aiDispatchResult.blockedReason === 'stale-private-overlay'
                || aiDispatchResult.blockedReason === 'missing-private-overlay'
            );

        if (shouldRetryWithEmergencyOverlay) {
            logger.warn('[GameTransport] online-ai-watchdog retrying legal-action with emergency playerView', {
                matchID: match.matchID,
                gameId: match.gameId,
                playerID: candidate.playerId,
                reason: candidate.reason,
                blockedReason: aiDispatchResult.blockedReason,
                blockedKey: aiDispatchResult.blockedKey,
            });

            aiDispatchResult = await aiModule.resolveNextAiDispatch({
                engineConfig: match.engineConfig,
                state: match.state,
                matchId: match.matchID,
                seatControllers: {
                    [candidate.playerId]: seatController,
                },
                visibleStateResolver: resolveEmergencyPlayerView,
            });
        }

        if (aiDispatchResult.kind !== 'action') {
            if (aiDispatchResult.kind === 'blocked') {
                logger.info('[GameTransport] online-ai-watchdog legal-action blocked', {
                    matchID: match.matchID,
                    gameId: match.gameId,
                    playerID: aiDispatchResult.playerId,
                    blockedReason: aiDispatchResult.blockedReason,
                    visibility: aiDispatchResult.visibility,
                    blockedKey: aiDispatchResult.blockedKey,
                });
                if (candidate.reason !== 'response-loop'
                    && aiDispatchResult.visibility === 'private-required'
                    && (aiDispatchResult.blockedReason === 'stale-private-overlay'
                        || aiDispatchResult.blockedReason === 'missing-private-overlay')) {
                    this.maybeTriggerOnlineAiOverlayResync({
                        match,
                        playerId: aiDispatchResult.playerId,
                        blockedReason: aiDispatchResult.blockedReason,
                        blockedKey: aiDispatchResult.blockedKey,
                        progressMarker: buildAiProgressMarker(match.state, {
                            engineConfig: match.engineConfig,
                            gameId: match.gameId,
                        }),
                    });
                }
                return {
                    applied: false,
                    resolved: false,
                    blockedReason: aiDispatchResult.blockedReason,
                    executedCommandTypes: [],
                    outcome: 'blocked',
                    reportedAction: null,
                };
            }
            return { applied: false, resolved: false, blockedReason: null, executedCommandTypes: [], outcome: 'no-legal-action', reportedAction: null };
        }

        const resolution = aiDispatchResult.resolution;
        if (resolution.playerId !== candidate.playerId || resolution.action.commands.length === 0) {
            return { applied: false, resolved: false, blockedReason: null, executedCommandTypes: [], outcome: 'no-legal-action', reportedAction: null };
        }

        const markerBefore = buildAiProgressMarker(match.state, {
            engineConfig: match.engineConfig,
            gameId: match.gameId,
        });
        const recoveryFingerprintBefore = this.buildOnlineAiRecoveryFingerprint(match, candidate, markerBefore);
        const executedCommandTypes: string[] = [];
        const isStillOwnedByRecoveredAi = (playerId: string): boolean => {
            if (!playerId || seatControllers[playerId]?.type === 'human') {
                return false;
            }

            const interactionState = match.state.sys?.interaction as {
                current?: { playerId?: unknown } | null;
                isBlocked?: unknown;
            } | undefined;
            const sharedInteractionPlayerId = typeof interactionState?.current?.playerId === 'string'
                ? interactionState.current.playerId
                : null;
            if (sharedInteractionPlayerId) {
                return sharedInteractionPlayerId === playerId;
            }

            if (interactionState?.current == null && interactionState?.isBlocked === true) {
                const seatView = this.applyPlayerView(match, playerId) as MatchState<unknown>;
                const seatInteraction = seatView.sys?.interaction as {
                    current?: { playerId?: unknown } | null;
                } | undefined;
                const seatInteractionPlayerId = typeof seatInteraction?.current?.playerId === 'string'
                    ? seatInteraction.current.playerId
                    : null;
                return seatInteractionPlayerId === playerId;
            }

            const responseWindow = match.state.sys?.responseWindow as {
                current?: {
                    responderQueue?: unknown;
                    currentResponderIndex?: unknown;
                };
            } | undefined;
            const responderQueue = Array.isArray(responseWindow?.current?.responderQueue)
                ? responseWindow.current.responderQueue
                : [];
            const responderIndex = typeof responseWindow?.current?.currentResponderIndex === 'number'
                ? responseWindow.current.currentResponderIndex
                : 0;
            const responderId = typeof responderQueue[responderIndex] === 'string'
                ? responderQueue[responderIndex]
                : null;
            if (responderId) {
                return responderId === playerId && seatControllers[responderId]?.type !== 'human';
            }

            return resolveOnlineAiCurrentPlayerId(match.state, {
                engineConfig: match.engineConfig,
                gameId: match.gameId,
            }) === playerId;
        };
        for (const command of resolution.action.commands) {
            if (executedCommandTypes.length > 0 && !isStillOwnedByRecoveredAi(resolution.playerId)) {
                this.broadcastState(match);
                const resolved = await this.hasOnlineAiRecoveryResolved(match, candidate, seatControllers);
                if (resolved) {
                    this.onlineAiRecoveryTrackers.delete(match.matchID);
                } else {
                    tracker.autoSubmittedAt = null;
                    tracker.firstSeenAt = Date.now();
                }

                logger.info('[GameTransport] online-ai-watchdog stopped legal action after ownership changed', {
                    matchID: match.matchID,
                    gameId: match.gameId,
                    playerID: resolution.playerId,
                    incidentKey: tracker.key,
                    actionId: resolution.action.actionId,
                    actionKind: resolution.action.kind,
                    executedCommandTypes,
                    resolved,
                });

                return {
                    applied: true,
                    resolved,
                    blockedReason: null,
                    executedCommandTypes,
                    outcome: 'applied',
                    reportedAction: {
                        candidateReason: candidate.reason,
                        playerId: resolution.playerId,
                        actionKind: resolution.action.kind,
                        actionId: resolution.action.actionId,
                    },
                };
            }

            const success = await this.executeCommandInternal(
                match,
                resolution.playerId,
                command.type,
                command.payload,
                { suppressBroadcast: true },
            );
            if (!success) {
                const commandFailureReason = match.lastCommandFailureReason;
                tracker.autoSubmittedAt = null;
                return {
                    applied: false,
                    resolved: false,
                    blockedReason: null,
                    executedCommandTypes,
                    outcome: 'legal-action-command-failed',
                    failedCommandType: command.type,
                    commandFailureReason,
                    reportedAction: null,
                };
            }
            executedCommandTypes.push(command.type);
        }

        const markerAfter = buildAiProgressMarker(match.state, {
            engineConfig: match.engineConfig,
            gameId: match.gameId,
        });
        const recoveryFingerprintAfter = this.buildOnlineAiRecoveryFingerprint(match, candidate, markerAfter);
        if (markerAfter === markerBefore && recoveryFingerprintAfter === recoveryFingerprintBefore) {
            tracker.autoSubmittedAt = null;
            return {
                applied: false,
                resolved: false,
                blockedReason: null,
                executedCommandTypes: [],
                outcome: 'legal-action-command-failed',
                reportedAction: null,
            };
        }

        // legal-action recovery 会串行执行 1..N 条命令，前面用 suppressBroadcast 合并中间态；
        // 一旦最终确实推进了权威状态，这里必须补发一次统一广播，否则房间前端看不到 watchdog 代打后的召唤/推进结果。
        this.broadcastState(match);

        const resolved = await this.hasOnlineAiRecoveryResolved(match, candidate, seatControllers);
        if (resolved) {
            this.onlineAiRecoveryTrackers.delete(match.matchID);
        } else {
            tracker.autoSubmittedAt = null;
            tracker.firstSeenAt = Date.now();
        }

        logger.info('[GameTransport] online-ai-watchdog recovered stalled AI via legal action', {
            matchID: match.matchID,
            gameId: match.gameId,
            playerID: resolution.playerId,
            incidentKey: tracker.key,
            actionId: resolution.action.actionId,
            actionKind: resolution.action.kind,
            markerBefore,
            markerAfter,
            resolved,
        });

        return {
            applied: true,
            resolved,
            blockedReason: null,
            executedCommandTypes,
            outcome: 'applied',
            reportedAction: {
                candidateReason: candidate.reason,
                playerId: resolution.playerId,
                actionKind: resolution.action.kind,
                actionId: resolution.action.actionId,
            },
        };
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
            if (match.unloaded) {
                while (match.commandQueue.length > 0) {
                    match.commandQueue.shift()?.resolve(false);
                }
                return;
            }
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

        match.state = result.state.G as MatchState<unknown>;
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

    private resolveTrainingMinCompletedDurationMs(match: ActiveMatch): number | null {
        const manifestDurationMs = this.gameManifests[
            match.engineConfig.gameId
        ]?.ai?.trainingMinCompletedDurationMs;
        if (Number.isFinite(manifestDurationMs) && (manifestDurationMs ?? 0) > 0) {
            return manifestDurationMs!;
        }
        return this.trainingDataMinCompletedMatchDurationMs;
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

        const matchIdentity = {
            schemaVersion: 1,
            gameId: args.match.engineConfig.gameId,
            matchId: args.match.matchID,
        } as const;
        const isCompleted = args.gameOver !== undefined && args.gameOver !== null;
        const manifest = this.gameManifests[args.match.engineConfig.gameId];
        if (manifest?.ai?.capture === false) {
            if (isCompleted) {
                this.discardPendingTrainingMatch(matchIdentity);
            }
            return;
        }

        const minDurationMs = this.resolveTrainingMinCompletedDurationMs(args.match);
        if (minDurationMs === null) {
            if (isCompleted) {
                this.discardPendingTrainingMatch(matchIdentity);
            }
            return;
        }

        const seatControllers = extractTrustedSetupSeatControllers(args.match.metadata.setupData);
        const seatControllerType = resolveSeatControllerTypeForTraining(seatControllers, args.playerID);
        const capturePolicy = manifest?.ai?.capturePolicy ?? DEFAULT_TRAINING_CAPTURE_POLICY;
        const shouldCaptureCommand = (
            capturePolicy !== 'human-only'
            || seatControllerType === 'human'
        );
        const sample = shouldCaptureCommand
            ? buildTrainingDecisionSample({
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
            })
            : undefined;

        if (!isCompleted) {
            if (sample) {
                this.stageTrainingDecisionSample(sample);
            }
            return;
        }

        const durationMs = this.resolveTrainingMatchDurationMs(args.match);
        if (durationMs === null || durationMs < minDurationMs) {
            this.discardPendingTrainingMatch(matchIdentity);
            return;
        }

        this.commitCompletedTrainingMatch({
            ...matchIdentity,
            completedAt: Date.now(),
            durationMs,
            ...(sample ? { finalSample: sample } : {}),
        });
    }

    private stageTrainingDecisionSample(sample: TrainingDecisionSample): void {
        Promise.resolve(this.trainingDataRecorder?.stageDecisionSample(sample)).catch((error) => {
            this.logTrainingDataFailure('stage', sample, error);
        });
    }

    private commitCompletedTrainingMatch(match: TrainingCompletedMatch): void {
        Promise.resolve(this.trainingDataRecorder?.commitCompletedMatch(match))
            .then((result) => {
                if (!result) return;
                this.logTrainingCommitResult(match, result);
            })
            .catch((error) => {
                this.logTrainingDataFailure('commit', match, error);
            });
    }

    private discardPendingTrainingMatch(
        match: Pick<TrainingCompletedMatch, 'schemaVersion' | 'gameId' | 'matchId'>,
    ): void {
        Promise.resolve(this.trainingDataRecorder?.discardPendingMatch(match)).catch((error) => {
            this.logTrainingDataFailure('discard', match, error);
        });
    }

    private logTrainingCommitResult(
        match: TrainingCompletedMatch,
        result: TrainingMatchCommitResult,
    ): void {
        if (result.status === 'capacity-reached') {
            logger.warn('[GameTransport] training data game capacity reached', {
                matchID: match.matchId,
                gameId: match.gameId,
                pendingBytes: result.pendingBytes,
                gameBytes: result.gameBytes,
                maxBytes: result.maxBytes,
            });
        } else if (result.status === 'failed') {
            logger.warn('[GameTransport] training data match commit skipped after staging failure', {
                matchID: match.matchId,
                gameId: match.gameId,
            });
        }
    }

    private logTrainingDataFailure(
        operation: 'stage' | 'commit' | 'discard',
        context: Pick<TrainingCompletedMatch, 'gameId' | 'matchId'> | TrainingDecisionSample,
        error: unknown,
    ): void {
        logger.warn('[GameTransport] training data capture failed', {
            operation,
            matchID: context.matchId,
            gameId: context.gameId,
            ...('command' in context ? {
                commandType: context.command.type,
                playerID: context.playerId,
            } : {}),
            error: error instanceof Error ? error.message : String(error),
        });
    }

    private async executeCommandInternal(
        match: ActiveMatch,
        playerID: string,
        commandType: string,
        payload: unknown,
        options?: ExecuteCommandInternalOptions,
    ): Promise<boolean> {
        if (match.unloaded) {
            return false;
        }

        const startTime = Date.now();
        match.lastCommandFailureReason = null;
        const { engineConfig, state, random, playerIds } = match;
        const stateIdBefore = match.stateID;
        const preTrainingState = this.stripStateForTraining(this.applyPlayerView(match, playerID)) as MatchState<unknown>;
        const progressMarkerBeforeCommand = buildAiProgressMarker(match.state, {
            engineConfig: match.engineConfig,
            gameId: match.gameId,
        });
        const setupSeatControllers = extractTrustedSetupSeatControllers(match.metadata.setupData);
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
                        pendingDamage: this.buildOnlineAiPendingDamageDiagnostic(match.state),
                    });
                    const trackerKey = `${playerID}:unsatisfiable-interaction:${typeof payload?.interactionId === 'string' ? payload.interactionId : 'unknown'}:${reason}:${progressMarkerBeforeCommand}`;
                    unsatisfiableInteractionFeedback = {
                        matchId: match.matchID,
                        gameId: engineConfig.gameId,
                        playerId: playerID,
                        incidentKind: 'unsatisfiable-interaction-auto-skipped',
                        severity: 'medium',
                        // 应急跳过只表示房间脱困；空选项/全 disabled 的真实交互缺陷仍要保持 open，
                        // 方便后续按反馈里的 sourceId、选项诊断和状态快照修根因。
                        status: 'open',
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
                            pendingDamage: this.buildOnlineAiPendingDamageDiagnostic(match.state),
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

        if (match.unloaded) {
            return false;
        }

        // 持久化
        const storedState: StoredMatchState = {
            G: match.state,
            _stateID: match.stateID,
            randomSeed: match.randomSeed,
            randomCursor: match.getRandomCursor(),
        };
        await this.storage.setState(match.matchID, storedState);
        this.onCommandSucceeded?.(match.matchID, engineConfig.gameId, effectiveCommandType);

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

        const commandType = resolveOfflineAdjudicationCommandType(interaction.kind);

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
        const seatControllers = extractTrustedSetupSeatControllers(match.metadata.setupData);
        const setupData = match.metadata.setupData;
        const ownerKey = setupData && typeof setupData === 'object' && !Array.isArray(setupData)
            ? (setupData as { ownerKey?: string }).ownerKey
            : undefined;
        return Object.entries(match.metadata.players).map(([id, data]) => ({
            id: Number(id),
            name: resolveSeatPlayerDisplayName({
                playerId: id,
                name: data.name,
                seatControllers,
            }),
            isConnected: data.isConnected,
            isOwner: typeof ownerKey === 'string' && ownerKey.length > 0 && data.ownerKey === ownerKey,
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

        const state = setUndoAiSeatIds(
            result.state.G as MatchState<unknown>,
            getAiSeatIds(extractTrustedSetupSeatControllers(result.metadata.setupData)),
        );
        const playerIds = Object.keys(result.metadata.players) as PlayerId[];

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
            unloaded: false,
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
