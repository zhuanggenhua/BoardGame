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
import type { GameEvent, MatchState, PlayerId, RandomFn } from '../types';
import type { EngineSystem } from '../systems/types';
import type {
    MatchStorage,
    StoredMatchState,
    MatchMetadata,
} from './storage';
import { isMatchAuthMetadataProvider } from './storage';
import type {
    MatchPlayerInfo,
    BatchDispatchMeta,
    CommandDispatchMeta,
    ManualForceEndAiPhaseResult,
    ManualSetupSelectionRequest,
    OnlineAiClientTransportDiagnostics,
} from './protocol';
import type {
    TrainingDataRecorder,
} from './trainingData';
import logger, { gameLogger } from '../../../server/logger.js';
import * as aiModule from '../ai';
import {
    buildAiDecisionContext,
    getAiSeatIds,
    getGameAiRuntime,
    resolveOnlineAiDecisionView,
} from '../ai';
import { extractAiInteractionSnapshot, extractAiResponseWindowSnapshot } from '../ai/snapshots';
import {
    createSeededRandom,
    createInitialSystemState,
} from '../pipeline';
import { INTERACTION_COMMANDS, INTERACTION_EVENTS } from '../systems/InteractionSystem';
import { setUndoAiSeatIds } from '../systems/UndoSystem';
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
    resolveForceEndTurnForStalledAi,
    resolveManualForceEndAiPhase,
    resolveForceAdvancePhaseAfterRecovery,
    shouldInspectSeatStatesForHiddenAiInteraction,
    type AiAutoRecoveryAttemptTracker,
    type HiddenInteractionDescriptor,
    type HiddenSimpleChoiceInteraction,
    type ForceEndTurnStalledAiResolution,
} from './onlineAiRecovery';
import { injectTutorialInteractionId } from './tutorialAiCommand';
import type { GameEngineConfig } from './engineConfig';
export type {
    AnyGameEngineConfig,
    GameEngineConfig,
    GameEventTelemetryFormatter,
    GameEventTelemetryRecord,
} from './engineConfig';
import { resolveRuntimeBuildInfo } from '../../lib/feedback/runtimeBuildInfo';
import {
    buildOnlineAiDiagnosticActionLog,
    buildInteractionSelectabilityDiagnostic,
    buildOnlineAiPendingDamageDiagnostic,
    buildOnlineAiRecoveryStateSnapshot as buildOnlineAiRecoveryStateSnapshotJson,
    buildOnlineAiUnsatisfiableInteractionStateSnapshot as buildOnlineAiUnsatisfiableInteractionStateSnapshotJson,
    buildOnlineAiWatchdogBlockerFingerprint,
    resolveOnlineAiRecoveryBlockerFingerprint,
    summarizeOnlineAiRecoveryLegalActions,
    resolveUnsatisfiableReasonFromSelectability,
    type OnlineAiRecoveryAiSummary,
    type OnlineAiRecoveryLegalActionSummary,
} from './onlineAiWatchdogFeedbackDiagnostics';
import {
    OnlineAiCircuitBreaker,
    type OnlineAiCircuitBlockReason,
    type OnlineAiCircuitSnapshot,
    type OnlineAiCircuitSource,
} from './onlineAiCircuitBreaker';
import {
    isOnlineAiWatchdogPublicPregameLegalActionPhase,
    resolveOnlineAiWatchdogAdvancePhaseCommandType,
    shouldProbeOnlineAiLegalActionOnlyCandidateForHumanTurn,
} from './onlineAiWatchdogGameSemantics';
import {
    createOnlineAiActionDelayContext,
    type OnlineAiActionDelayContext,
} from './onlineAiActionDelay';
import {
    executeOnlineAiCommandSequence,
    tryExecuteOnlineAiImmediateAction,
} from './onlineAiExecutor';
import {
    formatOnlineAiCommandFailureReason,
    shouldAutoReportCommandFailure,
} from './commandFailureReason';
import {
    buildCommandFailureFeedbackPayload as buildCommandFailureFeedbackPayloadData,
    type CommandFailureFeedbackPayload,
} from './commandFailureFeedbackPayload';
import { buildOnlineAiCircuitStateSnapshot } from './onlineAiCircuitFeedbackDiagnostics';
import {
    resolveOnlineAiRecoveryPhaseLabel,
    type OnlineAiLegalActionRecoveryResult,
    type OnlineAiRecoveryReportedLegalAction,
} from './onlineAiWatchdogSequenceHelpers';
import { executeOnlineAiLegalActionRecovery } from './onlineAiLegalActionRecoveryExecutor';
import {
    buildOnlineAiWatchdogSeatControllers,
    extractTrustedSetupSeatControllers,
    normalizeOnlineAiWatchdogSeatControllerType,
    resolveRawOnlineAiWatchdogSeatControllers,
    resolveSeatControllerTypeForTraining,
    type GameManifestIndex,
    type OnlineAiSeatControllerType,
} from './onlineAiSeatControllers';
import { isOnlineAiRecoveryStillOwnedByAi } from './onlineAiRecoveryOwnership';
import {
    normalizeFollowUpLegalActionOnlyCandidate,
    resolveOnlineAiRecoveryResolved,
} from './onlineAiRecoveryResolved';
import {
    MANUAL_FORCE_ADVANCE_AFTER_CONFIRMED_ROLL_PREFIX,
    resolveOnlineAiRecoveryDispatch,
} from './onlineAiRecoveryDispatch';
import {
    tryForceUnblockRepeatedOnlineAiRecovery as executeRepeatedRecoveryForceUnblock,
    type OnlineAiRepeatedRecoveryAttempt,
} from './onlineAiRepeatedRecoveryUnblockExecutor';
import {
    resolveOnlineAiRecoveryFingerprint as resolveRecoveryFingerprint,
} from './onlineAiWatchdogSequenceFingerprinting';
import {
    isOnlineAiUnsatisfiableInteractionReason,
    shouldSuppressUnsatisfiableInteractionFeedback,
} from './onlineAiUnsatisfiableInteraction';
import {
    applyMatchPlayerView,
    buildTransportMatchPlayers,
    broadcastProjectedMatchState,
    stripStateForTraining as stripProjectedStateForTraining,
    stripStateForTransport as stripProjectedStateForTransport,
} from './stateProjection';
import { AuthoritativeCommandExecutor } from './authoritativeCommandExecutor';
import { executeAuthoritativeCommandBatch } from './authoritativeBatchExecutor';
import { commitAuthoritativeCommandSuccess } from './authoritativeCommandCommit';
import {
    drainAuthoritativeCommandQueue,
    type AuthoritativeCommandQueueItem,
    type QueuedAuthoritativeCommand,
} from './authoritativeCommandQueue';
import { TrainingDataCapture } from './trainingDataCapture';

// 离线裁决：按交互 kind 选择最小语义正确的兜底命令。
// null 表示该交互不允许离线代裁决，必须保留给真实玩家入口继续处理。
// - simple-choice: 走通用系统取消
const OFFLINE_ADJUDICATION_COMMAND_BY_KIND: Record<string, string | null> = {
    'simple-choice': INTERACTION_COMMANDS.CANCEL,
};

const MANUAL_IMMEDIATE_AI_CONTINUATION_PREFIX = 'manual-immediate-ai-continuation:';

const resolveOfflineAdjudicationCommandType = (
    kind: unknown,
    engineConfig?: GameEngineConfig | null,
): string | null => {
    if (typeof kind !== 'string') {
        return INTERACTION_COMMANDS.CANCEL;
    }
    const configured = engineConfig?.onlineAiRecovery?.offlineAdjudicationCommandByInteractionKind;
    if (configured && Object.prototype.hasOwnProperty.call(configured, kind)) {
        return configured[kind] ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(OFFLINE_ADJUDICATION_COMMAND_BY_KIND, kind)) {
        return OFFLINE_ADJUDICATION_COMMAND_BY_KIND[kind] ?? null;
    }
    return INTERACTION_COMMANDS.CANCEL;
};

const ALLOWED_INJECT_STATE_ENVS = new Set(['test', 'development']);

const canInjectStateInCurrentEnv = (nodeEnv: string | undefined): boolean =>
    typeof nodeEnv === 'string' && ALLOWED_INJECT_STATE_ENVS.has(nodeEnv);

type OnlineAiWatchdogSeatController = aiModule.AiSeatController;

type OnlineAiExecutionTrace = {
    matchId: string;
    gameId: string;
    playerId: string;
    stateIdBefore: number;
    candidateReason: ForceEndTurnStalledAiResolution['reason'] | 'immediate-ai';
    decisionMs: number;
    executionMs: number;
    actionKind: string | null;
    commandTypes: string[];
    outcome: string;
    blockedReason?: string | null;
    commandFailureReason?: string | null;
};

function isAuthorizedManualAiSeatDispatch(match: ActiveMatch, requesterPlayerId: string, targetPlayerId: string): boolean {
    const controllers = extractTrustedSetupSeatControllers(match.metadata.setupData);
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

function isAuthorizedManualOnlineAiRecoveryRequest(
    match: ActiveMatch,
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

    // 旧房间没有 ownerKey 时，前端房主口径仍是 0 号座位。
    return requesterPlayerId === '0';
}

function isManualSetupSelectionRequest(value: unknown): value is ManualSetupSelectionRequest {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }
    const request = value as Record<string, unknown>;
    return typeof request.targetPlayerId === 'string' && request.targetPlayerId.trim().length > 0
        && typeof request.actionKind === 'string' && request.actionKind.trim().length > 0
        && typeof request.selectionId === 'string' && request.selectionId.trim().length > 0;
}

function resolveManualSetupSelectionIdFromAction(
    engineConfig: GameEngineConfig,
    action: aiModule.AiLegalAction,
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

const DEFAULT_ONLINE_AI_RECOVERY_TICK_MS = 500;
const DEFAULT_ONLINE_AI_RECOVERY_TIMEOUT_MS = 8000;
const DEFAULT_ONLINE_AI_RECOVERY_MAX_ADVANCE_STEPS = 16;
const DEFAULT_ONLINE_AI_RECOVERY_MAX_STEPS_PER_SLICE = 3;
const DEFAULT_ONLINE_AI_RECOVERY_FEEDBACK_COOLDOWN_MS = 60_000;
const DEFAULT_ONLINE_AI_RECOVERY_FAILURE_REPORT_THRESHOLD = 2;
const DEFAULT_ONLINE_AI_RECOVERY_REPEATED_ATTEMPT_LIMIT = 3;
const DEFAULT_ONLINE_AI_OVERLAY_RESYNC_COOLDOWN_MS = 1_500;
const DEFAULT_COMMAND_FAILURE_FEEDBACK_COOLDOWN_MS = 60_000;
const DEFAULT_ONLINE_AI_CIRCUIT_WINDOW_MS = 30_000;
const DEFAULT_ONLINE_AI_CIRCUIT_FAILURE_BUDGET = 6;

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
        | 'observed-recovery'
        | 'legal-action-recovered'
        | 'circuit-breaker-tripped';
    severity: 'medium' | 'high';
    status?: 'open' | 'resolved';
    resolvedMethod?: string;
    reason: string;
    trackerKey: string;
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
    if (payload.incidentKind === 'observed-recovery') {
        return '系统观察到原本停住的 AI 座位已经继续推进，并记录了这次恢复现场。';
    }
    return '系统已自动恢复这次在线 AI 步骤，对局已继续运行。';
};

type OnlineAiRecoveryPhaseLabel = ReturnType<typeof resolveOnlineAiRecoveryPhaseLabel>;
type OnlineAiLegalActionMissOutcome = Exclude<OnlineAiLegalActionRecoveryResult['outcome'], 'applied'>;
type OnlineAiLegalActionReportedAction = OnlineAiRecoveryReportedLegalAction;
export const canManualForceAdvanceAfterConfirmedRoll = (
    reportedAction: Pick<OnlineAiLegalActionReportedAction, 'actionKind' | 'metadata'> | null | undefined,
): boolean => reportedAction?.actionKind === 'confirm-roll'
    && reportedAction.metadata?.rollConfirmScope === 'main-roll';

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
    commandQueue: Array<AuthoritativeCommandQueueItem<ExecuteCommandInternalOptions>>;
    /** 最近一次 executeCommandInternal 失败的真实原因，供 batch 回滚后透传给客户端。 */
    lastCommandFailureReason: string | null;
}

type ExecuteCommandInternalOptions = {
    suppressBroadcast?: boolean;
    reportFailureFeedback?: boolean;
    feedbackSource?: CommandFailureFeedbackPayload['feedbackSource'];
    expectedStateID?: number;
    onlineAiCircuitSource?: OnlineAiCircuitSource;
    onlineAiAttemptKey?: string | null;
    clientTransport?: OnlineAiClientTransportDiagnostics | null;
};

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
    onlineAiRecoveryMaxStepsPerSlice?: number;
    onlineAiRecoveryFeedbackCooldownMs?: number;
    onlineAiRecoveryFailureReportThreshold?: number;
    onlineAiRecoveryRepeatedAttemptLimit?: number;
    /** 同一对局+AI座位的失败窗口长度（毫秒） */
    onlineAiCircuitWindowMs?: number;
    /** 同一失败窗口允许的 AI 命令/恢复失败次数 */
    onlineAiCircuitFailureBudget?: number;
    onlineAiFeedbackReporter?: (payload: OnlineAiRecoveryFeedbackPayload) => Promise<void>;
    commandFailureFeedbackCooldownMs?: number;
    commandFailureFeedbackReporter?: (payload: CommandFailureFeedbackPayload) => Promise<void>;
}

function cloneDiagnosticValue(value: unknown): unknown {
    if (value === undefined) {
        return null;
    }
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return '[unserializable-diagnostic-value]';
    }
}

const ONLINE_AI_ATTEMPT_KEY_MAX_LENGTH = 180;
const ONLINE_AI_DIAGNOSTIC_ERROR_MAX_LENGTH = 300;
const ONLINE_AI_STATE_EVENT_KINDS = new Set(['none', 'sync', 'update', 'patch']);
const ONLINE_AI_PATCH_ISSUE_KINDS = new Set(['discontinuity', 'apply-failed']);

function normalizeOnlineAiAttemptKey(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const normalized = value.trim();
    return normalized.length > 0
        ? normalized.slice(0, ONLINE_AI_ATTEMPT_KEY_MAX_LENGTH)
        : null;
}

function normalizeOnlineAiClientTransportDiagnostics(
    value: unknown,
): OnlineAiClientTransportDiagnostics | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const raw = value as Record<string, unknown>;
    if (typeof raw.sentAt !== 'number' || !Number.isFinite(raw.sentAt)) {
        return null;
    }
    const lastStateEventKind = ONLINE_AI_STATE_EVENT_KINDS.has(String(raw.lastStateEventKind))
        ? String(raw.lastStateEventKind) as OnlineAiClientTransportDiagnostics['lastStateEventKind']
        : 'none';
    const rawPatchIssue = raw.lastPatchIssue;
    let lastPatchIssue: OnlineAiClientTransportDiagnostics['lastPatchIssue'] = null;
    if (rawPatchIssue && typeof rawPatchIssue === 'object' && !Array.isArray(rawPatchIssue)) {
        const patchIssue = rawPatchIssue as Record<string, unknown>;
        if (
            ONLINE_AI_PATCH_ISSUE_KINDS.has(String(patchIssue.kind))
            && typeof patchIssue.at === 'number'
            && Number.isFinite(patchIssue.at)
        ) {
            lastPatchIssue = {
                kind: String(patchIssue.kind) as NonNullable<typeof lastPatchIssue>['kind'],
                expectedStateID: typeof patchIssue.expectedStateID === 'number'
                    ? patchIssue.expectedStateID
                    : null,
                receivedStateID: typeof patchIssue.receivedStateID === 'number'
                    ? patchIssue.receivedStateID
                    : null,
                error: typeof patchIssue.error === 'string'
                    ? patchIssue.error.slice(0, ONLINE_AI_DIAGNOSTIC_ERROR_MAX_LENGTH)
                    : null,
                at: patchIssue.at,
            };
        }
    }
    return {
        sentAt: raw.sentAt,
        lastStateEventKind,
        lastStateEventStateID: typeof raw.lastStateEventStateID === 'number'
            ? raw.lastStateEventStateID
            : null,
        lastStateEventAt: typeof raw.lastStateEventAt === 'number'
            ? raw.lastStateEventAt
            : null,
        syncInFlight: raw.syncInFlight === true,
        lastSyncRequestReason: typeof raw.lastSyncRequestReason === 'string'
            ? raw.lastSyncRequestReason.slice(0, ONLINE_AI_DIAGNOSTIC_ERROR_MAX_LENGTH)
            : null,
        lastSyncRequestedAt: typeof raw.lastSyncRequestedAt === 'number'
            ? raw.lastSyncRequestedAt
            : null,
        lastPatchIssue,
    };
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
    private readonly trainingDataCapture: TrainingDataCapture;
    private readonly rulesVersion: string | null;
    private readonly gameManifests: GameManifestIndex;
    private readonly onlineAiRecoveryTickMs: number;
    private readonly onlineAiRecoveryTimeoutMs: number;
    private readonly onlineAiRecoveryMaxAdvanceSteps: number;
    private readonly onlineAiRecoveryMaxStepsPerSlice: number;
    private readonly onlineAiRecoveryFeedbackCooldownMs: number;
    private readonly onlineAiRecoveryFailureReportThreshold: number;
    private readonly onlineAiRecoveryRepeatedAttemptLimit: number;
    private readonly onlineAiCircuitBreaker: OnlineAiCircuitBreaker;
    private readonly onlineAiFeedbackReporter?: GameTransportServerConfig['onlineAiFeedbackReporter'];
    private readonly commandFailureFeedbackCooldownMs: number;
    private readonly commandFailureFeedbackReporter?: GameTransportServerConfig['commandFailureFeedbackReporter'];
    private readonly onlineAiRecoveryTrackers = new Map<string, OnlineAiRecoveryTracker>();
    private readonly onlineAiRepeatedRecoveryAttempts = new Map<string, OnlineAiRepeatedRecoveryAttempt>();
    private readonly onlineAiRecoveryFeedbackCooldown = new Map<string, number>();
    private readonly commandFailureFeedbackCooldown = new Map<string, number>();
    private readonly onlineAiOverlayResyncCooldown = new Map<string, number>();
    private readonly onlineAiRecoveryInFlight = new Set<string>();
    private readonly authoritativeCommandExecutor: AuthoritativeCommandExecutor;
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
        this.rulesVersion = config.rulesVersion ?? null;
        this.gameManifests = config.gameManifests ?? {};
        this.trainingDataCapture = new TrainingDataCapture({
            recorder: config.trainingDataRecorder,
            defaultMinCompletedMatchDurationMs: (
                Number.isFinite(config.trainingDataMinCompletedMatchDurationMs)
                && (config.trainingDataMinCompletedMatchDurationMs ?? 0) > 0
            )
                ? config.trainingDataMinCompletedMatchDurationMs!
                : null,
            rulesVersion: this.rulesVersion,
            gameManifests: this.gameManifests,
            logWarning: (message, payload) => logger.warn(message, payload),
        });
        this.onlineAiRecoveryTickMs = config.onlineAiRecoveryTickMs ?? DEFAULT_ONLINE_AI_RECOVERY_TICK_MS;
        this.onlineAiRecoveryTimeoutMs = config.onlineAiRecoveryTimeoutMs ?? DEFAULT_ONLINE_AI_RECOVERY_TIMEOUT_MS;
        this.onlineAiRecoveryMaxAdvanceSteps = config.onlineAiRecoveryMaxAdvanceSteps ?? DEFAULT_ONLINE_AI_RECOVERY_MAX_ADVANCE_STEPS;
        this.onlineAiRecoveryMaxStepsPerSlice = (
            Number.isFinite(config.onlineAiRecoveryMaxStepsPerSlice)
            && (config.onlineAiRecoveryMaxStepsPerSlice ?? 0) > 0
        )
            ? Math.floor(config.onlineAiRecoveryMaxStepsPerSlice!)
            : DEFAULT_ONLINE_AI_RECOVERY_MAX_STEPS_PER_SLICE;
        this.onlineAiRecoveryFeedbackCooldownMs = config.onlineAiRecoveryFeedbackCooldownMs ?? DEFAULT_ONLINE_AI_RECOVERY_FEEDBACK_COOLDOWN_MS;
        this.onlineAiRecoveryFailureReportThreshold = config.onlineAiRecoveryFailureReportThreshold ?? DEFAULT_ONLINE_AI_RECOVERY_FAILURE_REPORT_THRESHOLD;
        this.onlineAiRecoveryRepeatedAttemptLimit = (
            Number.isFinite(config.onlineAiRecoveryRepeatedAttemptLimit)
            && (config.onlineAiRecoveryRepeatedAttemptLimit ?? 0) > 0
        )
            ? Math.floor(config.onlineAiRecoveryRepeatedAttemptLimit!)
            : DEFAULT_ONLINE_AI_RECOVERY_REPEATED_ATTEMPT_LIMIT;
        this.onlineAiCircuitBreaker = new OnlineAiCircuitBreaker({
            windowMs: config.onlineAiCircuitWindowMs ?? DEFAULT_ONLINE_AI_CIRCUIT_WINDOW_MS,
            failureBudget: config.onlineAiCircuitFailureBudget ?? DEFAULT_ONLINE_AI_CIRCUIT_FAILURE_BUDGET,
        });
        this.onlineAiFeedbackReporter = config.onlineAiFeedbackReporter;
        this.commandFailureFeedbackCooldownMs = config.commandFailureFeedbackCooldownMs ?? DEFAULT_COMMAND_FAILURE_FEEDBACK_COOLDOWN_MS;
        this.commandFailureFeedbackReporter = config.commandFailureFeedbackReporter;
        this.authoritativeCommandExecutor = new AuthoritativeCommandExecutor();
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
                commandMeta?: CommandDispatchMeta,
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
                if (meta.legacyManualAiSeatId) {
                    socket.emit('error', matchID, 'online_ai_server_authority');
                    return;
                }
                if (match && this.resolveOnlineAiSeatControllerType(match, info.playerID) !== 'human') {
                    socket.emit('error', matchID, 'online_ai_server_authority');
                    return;
                }
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
                const expectedStateID = commandMeta?.expectedStateID;
                const commandOptions = typeof expectedStateID === 'number'
                    || Boolean(commandMeta?.onlineAiAttemptKey)
                    || Boolean(commandMeta?.clientTransport)
                    ? {
                        ...(typeof expectedStateID === 'number' ? { expectedStateID } : {}),
                        onlineAiAttemptKey: normalizeOnlineAiAttemptKey(commandMeta?.onlineAiAttemptKey),
                        clientTransport: normalizeOnlineAiClientTransportDiagnostics(commandMeta?.clientTransport),
                    }
                    : undefined;
                if (commandOptions) {
                    await this.handleCommand(
                        matchID,
                        resolvedPlayerId,
                        commandType,
                        tutorialInjectedPayload,
                        commandOptions,
                    );
                } else {
                    await this.handleCommand(
                        matchID,
                        resolvedPlayerId,
                        commandType,
                        tutorialInjectedPayload,
                    );
                }
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
                const match = this.activeMatches.get(matchID);
                if (match && this.resolveOnlineAiSeatControllerType(match, info.playerID) !== 'human') {
                    socket.emit('batch:rejected', matchID, batchId, 'online_ai_server_authority');
                    return;
                }
                await this.handleBatch(socket, matchID, info.playerID, batchId, commands, meta);
            });

            socket.on('manual-setup-selection', async (
                matchID: string,
                request: ManualSetupSelectionRequest,
                credentials?: string,
                acknowledge?: (result: { accepted: boolean; reason?: 'unauthorized' | 'rejected' }) => void,
            ) => {
                if (!matchID || !isManualSetupSelectionRequest(request)) return;
                const info = this.socketIndex.get(socket.id);
                if (!info || info.matchID !== matchID || !info.playerID) return;
                const authorized = await this.validateCommandAuth(matchID, info.playerID, info.credentials ?? credentials);
                if (!authorized) {
                    socket.emit('error', matchID, 'unauthorized');
                    acknowledge?.({ accepted: false, reason: 'unauthorized' });
                    return;
                }
                const match = this.activeMatches.get(matchID);
                if (!match || this.resolveOnlineAiSeatControllerType(match, info.playerID) !== 'human') {
                    socket.emit('error', matchID, 'unauthorized');
                    acknowledge?.({ accepted: false, reason: 'unauthorized' });
                    return;
                }
                const accepted = await this.handleManualSetupSelection(match, info.playerID, request);
                if (!accepted) {
                    socket.emit('error', matchID, 'manual_setup_selection_rejected');
                    acknowledge?.({ accepted: false, reason: 'rejected' });
                    return;
                }
                acknowledge?.({ accepted: true });
            });

            socket.on('manual-force-end-ai-phase', async (
                matchID: string,
                credentials?: string,
                acknowledge?: (result: ManualForceEndAiPhaseResult) => void,
            ) => {
                if (!matchID) return;
                const info = this.socketIndex.get(socket.id);
                if (!info || info.matchID !== matchID || !info.playerID) return;
                const authorized = await this.validateCommandAuth(matchID, info.playerID, info.credentials ?? credentials);
                if (!authorized) {
                    socket.emit('error', matchID, 'unauthorized');
                    acknowledge?.({ accepted: false, reason: 'unauthorized' });
                    return;
                }
                const match = this.activeMatches.get(matchID);
                if (!match || this.resolveOnlineAiSeatControllerType(match, info.playerID) !== 'human') {
                    socket.emit('error', matchID, 'unauthorized');
                    acknowledge?.({ accepted: false, reason: 'unauthorized' });
                    return;
                }

                const result = await this.handleManualForceEndAiPhase(match, info.playerID);
                if (!result.accepted && result.reason === 'unauthorized') {
                    socket.emit('error', matchID, 'unauthorized');
                }
                acknowledge?.(result);
            });

            socket.on('ui:event', (
                matchID: string,
                eventType: string,
                payload: unknown,
            ) => {
                if (!matchID || typeof eventType !== 'string' || eventType.length === 0 || eventType.length > 120) return;
                const info = this.socketIndex.get(socket.id);
                if (!info || info.matchID !== matchID || !info.playerID) return;
                socket.to(`game:${matchID}`).emit('ui:event', matchID, {
                    type: eventType,
                    playerId: info.playerID,
                    payload,
                    sentAt: Date.now(),
                });
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
        this.onlineAiCircuitBreaker.clearMatch(matchID);
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

    private resolveOnlineAiSeatControllerType(
        match: ActiveMatch,
        playerId: string,
    ): OnlineAiSeatControllerType {
        const rawSeatControllers = resolveRawOnlineAiWatchdogSeatControllers(
            match.state,
            match.metadata.setupData,
        );
        return normalizeOnlineAiWatchdogSeatControllerType(
            match.gameId,
            rawSeatControllers?.[playerId],
            this.gameManifests,
        );
    }

    private buildOnlineAiSeatControllers(match: ActiveMatch): Record<string, OnlineAiWatchdogSeatController> {
        return buildOnlineAiWatchdogSeatControllers({
            state: match.state,
            setupData: match.metadata.setupData,
            gameId: match.gameId,
            playerIds: Object.keys(match.metadata.players),
            gameManifests: this.gameManifests,
        }) as Record<string, OnlineAiWatchdogSeatController>;
    }

    /**
     * 人类只提交准备阶段的选择意图；正式命令必须由服务端从当前权威状态重新生成。
     */
    private async handleManualSetupSelection(
        match: ActiveMatch,
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

        const rawSeatControllers = resolveRawOnlineAiWatchdogSeatControllers(
            match.state,
            match.metadata.setupData,
        );
        const rawController = rawSeatControllers?.[targetPlayerId];
        const controllerType = normalizeOnlineAiWatchdogSeatControllerType(
            match.gameId,
            rawController,
            this.gameManifests,
        );
        if (controllerType === 'human' || !aiModule.isManualSetupSelectionEnabledForSeat(rawController)) {
            return false;
        }

        const controller: OnlineAiWatchdogSeatController = {
            ...(rawController as Omit<OnlineAiWatchdogSeatController, 'type'>),
            type: controllerType,
        } as OnlineAiWatchdogSeatController;
        const visibleState = this.applyPlayerView(match, targetPlayerId) as MatchState<unknown>;
        const legalActions = buildAiDecisionContext({
            gameId: match.engineConfig.gameId,
            matchId: match.matchID,
            playerId: targetPlayerId,
            visibleState,
            rulesVersion: this.rulesVersion,
            decisionBudgetMs: 250,
            source: 'online',
        }).legalActions;
        const matchingActions = legalActions.filter((action) => {
            if (action.kind !== actionKind || action.commands.length !== 1) {
                return false;
            }
            const configured = match.engineConfig.onlineAiRecovery?.shouldTreatActionAsManualSetupSelection?.({
                actionKind: action.kind,
                actionId: action.actionId,
                commandTypes: action.commands.map((command) => command.type),
            });
            const isManualSetupAction = configured ?? aiModule.shouldPlayerManuallyResolveSetupSelection(
                match.engineConfig,
                match.state,
                targetPlayerId,
                controller,
                action,
            );
            return isManualSetupAction
                && resolveManualSetupSelectionIdFromAction(match.engineConfig, action) === selectionId;
        });
        if (matchingActions.length !== 1) {
            return false;
        }

        const [command] = matchingActions[0].commands;
        return this.handleCommand(match.matchID, targetPlayerId, command.type, command.payload, {
            expectedStateID: match.stateID,
            onlineAiCircuitSource: 'watchdog',
        });
    }

    private async handleManualForceEndAiPhase(
        match: ActiveMatch,
        requesterPlayerId: string,
    ): Promise<ManualForceEndAiPhaseResult> {
        const seatControllers = this.buildOnlineAiSeatControllers(match);
        if (!isAuthorizedManualOnlineAiRecoveryRequest(match, requesterPlayerId, seatControllers)) {
            return { accepted: false, reason: 'unauthorized' };
        }
        if (match.unloaded) {
            return { accepted: false, reason: 'unavailable' };
        }
        if (match.executing || this.onlineAiRecoveryInFlight.has(match.matchID)) {
            return { accepted: false, reason: 'busy' };
        }

        const manualSeatStates: Record<string, MatchState<unknown> | null | undefined> = Object.fromEntries(
            Object.entries(seatControllers)
                .filter(([, controller]) => controller.type !== 'human')
                .map(([playerId]) => [playerId, this.applyPlayerView(match, playerId) as MatchState<unknown>]),
        );
        const candidate = resolveManualForceEndAiPhase({
            sharedState: match.state,
            seatControllers,
            seatStates: manualSeatStates,
            engineConfig: match.engineConfig,
            gameId: match.gameId,
        }) ?? await this.resolveOnlineAiRecoveryCandidate(match, seatControllers);
        if (!candidate) {
            this.onlineAiRecoveryTrackers.delete(match.matchID);
            return { accepted: false, reason: 'unavailable' };
        }

        const progressMarker = buildAiProgressMarker(match.state, {
            engineConfig: match.engineConfig,
            gameId: match.gameId,
        });
        const recoveryFingerprint = this.buildOnlineAiRecoveryFingerprint(match, candidate, progressMarker);
        const trackerKey = `${candidate.playerId}:${candidate.reason}:${recoveryFingerprint}`;
        const tracker: OnlineAiRecoveryTracker = {
            key: trackerKey,
            firstSeenAt: Date.now(),
            autoSubmittedAt: Date.now(),
            lastReportedFailureReason: null,
            failureCount: 0,
        };
        this.onlineAiRecoveryTrackers.set(match.matchID, tracker);
        this.onlineAiRecoveryInFlight.add(match.matchID);
        try {
            await this.runOnlineAiRecoverySequence(
                match,
                tracker,
                candidate,
                progressMarker,
                seatControllers,
                { allowManualImmediateAiContinuation: true },
            );
        } finally {
            this.onlineAiRecoveryInFlight.delete(match.matchID);
        }

        const markerAfter = buildAiProgressMarker(match.state, {
            engineConfig: match.engineConfig,
            gameId: match.gameId,
        });
        const resolved = await this.hasOnlineAiRecoveryResolved(match, candidate, seatControllers);
        if (resolved || markerAfter !== progressMarker) {
            return { accepted: true };
        }
        return { accepted: false, reason: 'rejected' };
    }

    private async recordOnlineAiCircuitFailure(args: {
        match: ActiveMatch;
        playerId: string;
        source: OnlineAiCircuitSource;
        commandType: string;
        commandPayload?: unknown;
        reason: string;
        expectedStateID?: number | null;
        stateID: number;
        progressMarker?: string | null;
        onlineAiAttemptKey?: string | null;
        clientTransport?: OnlineAiClientTransportDiagnostics | null;
    }): Promise<OnlineAiCircuitSnapshot> {
        const snapshot = this.onlineAiCircuitBreaker.recordFailure({
            matchId: args.match.matchID,
            playerId: args.playerId,
            failure: {
                commandType: args.commandType,
                reason: args.reason,
                expectedStateID: args.expectedStateID,
                stateID: args.stateID,
                progressMarker: args.progressMarker,
                commandSummary: JSON.stringify(cloneDiagnosticValue(args.commandPayload)),
                attemptKey: args.onlineAiAttemptKey ?? null,
                clientTransport: args.clientTransport ?? null,
                source: args.source,
            },
        });
        if (snapshot.tripped && this.onlineAiCircuitBreaker.markCircuitReportConsumed(
            args.match.matchID,
            args.playerId,
        )) {
            const lastFailure = snapshot.recentFailures[snapshot.recentFailures.length - 1];
            const reason = lastFailure?.reason ?? 'failure-budget-exhausted';
            logger.error('[GameTransport] online-ai circuit breaker tripped', {
                matchID: args.match.matchID,
                gameId: args.match.gameId,
                playerID: args.playerId,
                reason,
                failureCount: snapshot.failureCount,
                failureBudget: snapshot.failureBudget,
                stateID: args.match.stateID,
                progressMarker: args.progressMarker ?? null,
            });
            await this.reportOnlineAiRecoveryFeedback({
                matchId: args.match.matchID,
                gameId: args.match.gameId,
                playerId: args.playerId,
                incidentKind: 'circuit-breaker-tripped',
                severity: 'high',
                status: 'open',
                reason,
                trackerKey: `circuit-breaker:${args.playerId}:${snapshot.windowStartedAt}`,
                progressMarker: args.progressMarker ?? buildAiProgressMarker(args.match.state, {
                    engineConfig: args.match.engineConfig,
                    gameId: args.match.gameId,
                }),
                stateSnapshot: buildOnlineAiCircuitStateSnapshot({
                    matchId: args.match.matchID,
                    gameId: args.match.gameId,
                    state: args.match.state,
                    stateID: args.match.stateID,
                    engineConfig: args.match.engineConfig,
                    commandQueue: args.match.commandQueue,
                    snapshot,
                    commandType: args.commandType,
                    commandPayload: args.commandPayload,
                    reason,
                    onlineAiAttemptKey: args.onlineAiAttemptKey,
                    clientTransport: args.clientTransport,
                }),
                actionLog: JSON.stringify({
                    type: 'online-ai-circuit-breaker',
                    reason,
                    recentFailures: snapshot.recentFailures,
                    recoveryCount: snapshot.recoveryCount,
                    queueLength: args.match.commandQueue.length,
                }),
            });
        }
        return snapshot;
    }

    private rejectOnlineAiCircuitCommand(args: {
        match: ActiveMatch;
        playerId: string;
        reason: OnlineAiCircuitBlockReason;
        commandType: string;
        expectedStateID?: number | null;
        onlineAiAttemptKey?: string | null;
        clientTransport?: OnlineAiClientTransportDiagnostics | null;
        snapshot: OnlineAiCircuitSnapshot;
    }): false {
        const failureReason = args.reason === 'stale-epoch' ? 'stale_state' : 'online_ai_circuit_open';
        args.match.lastCommandFailureReason = failureReason;
        logger.warn('[GameTransport] online AI command rejected before pipeline', {
            matchID: args.match.matchID,
            gameId: args.match.gameId,
            playerID: args.playerId,
            commandType: args.commandType,
            expectedStateID: args.expectedStateID ?? null,
            onlineAiAttemptKey: args.onlineAiAttemptKey ?? null,
            clientTransport: args.clientTransport ?? null,
            stateID: args.match.stateID,
            circuitBlockReason: args.reason,
            failureCount: args.snapshot.failureCount,
            failureBudget: args.snapshot.failureBudget,
        });
        const sockets = args.match.connections.get(args.playerId);
        if (sockets) {
            const nsp = this.io.of('/game');
            for (const sid of sockets) {
                nsp.to(sid).emit('error', args.match.matchID, failureReason);
            }
        }
        return false;
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
        const manualSetupSelection = seatController?.type !== 'human'
            && (
                seatController.manualFactionSelection === true
                || seatController.manualSetupSelection === true
            );
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
        void match;
        void candidate;
        // 在线 AI 的正式执行权固定在服务端；浏览器是否有 AI seat socket
        // 不能再决定 AI 何时开始执行。
        return 0;
    }

    private shouldRunImmediateForcedRecoveryAfterLegalActionMiss(args: {
        match: ActiveMatch;
        candidate: ForceEndTurnStalledAiResolution;
        seatControllers: Record<string, OnlineAiWatchdogSeatController>;
        outcome: OnlineAiLegalActionMissOutcome;
        failedCommandType?: string | null;
    }): boolean {
        const { match, candidate, seatControllers, outcome, failedCommandType } = args;
        const recoveryCommands = candidate.resolution.action.commands;
        if (recoveryCommands.length === 0) {
            return false;
        }

        const currentWindow = (match.state.sys as { responseWindow?: { current?: unknown } } | undefined)
            ?.responseWindow?.current as { responderQueue?: unknown } | undefined;
        const responderQueue = Array.isArray(currentWindow?.responderQueue) ? currentWindow.responderQueue : [];
        const hasHumanResponder = responderQueue.some((responderId) => {
            const id = typeof responderId === 'string' ? responderId : '';
            return id.length > 0 && seatControllers[id]?.type === 'human';
        });
        if (hasHumanResponder) {
            return false;
        }

        const isDirectRecoveryCandidate = candidate.legalActionOnly !== true
            && (
                candidate.reason === 'visible-interaction'
                || candidate.reason === 'hidden-interaction'
                || candidate.reason === 'response-window'
                || candidate.reason === 'response-loop'
            );
        if (isDirectRecoveryCandidate) {
            return true;
        }

        const canTreatMissAsExhausted = outcome === 'no-legal-action'
            || (outcome === 'legal-action-command-failed' && !failedCommandType);
        if (!canTreatMissAsExhausted) {
            return false;
        }

        if (candidate.allowForceCommandAfterLegalActionExhausted === true) {
            return true;
        }

        const currentPhase = typeof match.state.sys?.phase === 'string' ? match.state.sys.phase : '';
        return match.engineConfig.onlineAiRecovery?.allowForceCommandAfterLegalActionExhausted?.({
            state: match.state,
            phase: currentPhase,
            previousCandidate: candidate,
            nextCandidate: candidate,
        }) === true;
    }

    private async runOnlineAiImmediateExecution(
        match: ActiveMatch,
        trigger: 'command-succeeded' | 'sync',
    ): Promise<void> {
        if (match.unloaded || match.executing || this.onlineAiRecoveryInFlight.has(match.matchID)) {
            return;
        }

        const seatControllers = this.buildOnlineAiSeatControllers(match);
        const hasAiSeat = Object.values(seatControllers).some((controller) => controller.type !== 'human');
        if (!hasAiSeat) {
            this.onlineAiRecoveryTrackers.delete(match.matchID);
            this.onlineAiCircuitBreaker.clearMatch(match.matchID);
            this.clearOnlineAiRepeatedRecoveryAttemptsForMatch(match.matchID);
            return;
        }

        for (const [playerId, controller] of Object.entries(seatControllers)) {
            if (controller.type === 'human') {
                this.onlineAiCircuitBreaker.clearSeat(match.matchID, playerId);
            }
        }

        match.executing = true;
        this.onlineAiRecoveryInFlight.add(match.matchID);
        try {
            const seenStepKeys = new Set<string>();
            const delayContext = createOnlineAiActionDelayContext();
            const aiSeatCount = Object.values(seatControllers)
                .filter((controller) => controller.type !== 'human')
                .length;
            const publicPregameStepBudget = Math.min(
                this.onlineAiRecoveryMaxAdvanceSteps,
                Math.max(this.onlineAiRecoveryMaxStepsPerSlice, aiSeatCount * 4),
            );
            for (let step = 0; step < this.onlineAiRecoveryMaxAdvanceSteps; step += 1) {
                if (match.unloaded) {
                    return;
                }

                const stepStateIdBefore = match.stateID;
                const stepStartedAt = Date.now();
                const immediateAction = await tryExecuteOnlineAiImmediateAction({
                    match,
                    seatControllers,
                    delayContext,
                    executor: {
                        applyPlayerView: (playerId) => this.applyPlayerView(match, playerId) as MatchState<unknown>,
                        getSeatControllers: () => this.buildOnlineAiSeatControllers(match),
                        executeCommandSequence: (playerId, commands, options) => executeOnlineAiCommandSequence({
                            match,
                            playerId,
                            commands,
                            options,
                            createTrackedRandom,
                            persistState: (storedState) => this.storage.setState(match.matchID, storedState),
                            broadcastState: () => this.broadcastState(match),
                            executeCommand: (command, commandOptions) => this.executeCommandInternal(
                                match,
                                playerId,
                                command.type,
                                command.payload,
                                commandOptions,
                            ),
                        }),
                        clearRecoveryState: () => {
                            this.onlineAiRecoveryTrackers.delete(match.matchID);
                            this.clearOnlineAiRepeatedRecoveryAttemptsForMatch(match.matchID);
                        },
                        broadcastState: () => this.broadcastState(match),
                        emitTrace: emitOnlineAiBatchTrace,
                    },
                });
                if (immediateAction.applied) {
                    this.logOnlineAiExecutionTrace({
                        matchId: match.matchID,
                        gameId: match.gameId,
                        playerId: immediateAction.playerId,
                        stateIdBefore: stepStateIdBefore,
                        candidateReason: 'immediate-ai',
                        decisionMs: immediateAction.decisionMs,
                        executionMs: Date.now() - stepStartedAt - immediateAction.decisionMs,
                        actionKind: immediateAction.actionKind,
                        commandTypes: immediateAction.executedCommandTypes,
                        outcome: `normal:${trigger}`,
                        blockedReason: null,
                        commandFailureReason: immediateAction.commandFailureReason,
                    });
                    continue;
                }

                const candidate = await this.resolveOnlineAiRecoveryCandidate(match, seatControllers);
                if (!candidate) {
                    this.onlineAiRecoveryTrackers.delete(match.matchID);
                    this.clearOnlineAiRepeatedRecoveryAttemptsForMatch(match.matchID);
                    return;
                }
                const publicPregameCandidate = candidate.reason === 'seat-legal-only'
                    && isOnlineAiWatchdogPublicPregameLegalActionPhase({
                        state: match.state,
                        engineConfig: match.engineConfig,
                    });
                const stepBudget = publicPregameCandidate
                    ? publicPregameStepBudget
                    : this.onlineAiRecoveryMaxStepsPerSlice;
                if (step >= stepBudget) {
                    return;
                }

                const progressMarker = buildAiProgressMarker(match.state, {
                    engineConfig: match.engineConfig,
                    gameId: match.gameId,
                });
                const recoveryFingerprint = this.buildOnlineAiRecoveryFingerprint(match, candidate, progressMarker);
                const stepKey = candidate.legalActionOnly === true
                    ? `${candidate.playerId}:${candidate.reason}:${recoveryFingerprint}:${progressMarker}`
                    : `${candidate.playerId}:${candidate.reason}:${recoveryFingerprint}`;
                if (seenStepKeys.has(stepKey)) {
                    return;
                }
                seenStepKeys.add(stepKey);

                const tracker: OnlineAiRecoveryTracker = {
                    key: stepKey,
                    firstSeenAt: Date.now(),
                    autoSubmittedAt: Date.now(),
                    lastReportedFailureReason: null,
                    failureCount: 0,
                };
                this.onlineAiRecoveryTrackers.set(match.matchID, tracker);

                const recoveryStepStateIdBefore = match.stateID;
                const recoveryStepStartedAt = Date.now();
                const actionRecovery = await this.tryRecoverOnlineAiWithLegalAction(
                    match,
                    candidate,
                    tracker,
                    seatControllers,
                    delayContext,
                );
                if (!actionRecovery.applied) {
                    const shouldRunForcedRecovery = this.shouldRunImmediateForcedRecoveryAfterLegalActionMiss({
                        match,
                        candidate,
                        seatControllers,
                        outcome: actionRecovery.outcome,
                        failedCommandType: actionRecovery.failedCommandType,
                    });
                    this.logOnlineAiExecutionTrace({
                        matchId: match.matchID,
                        gameId: match.gameId,
                        playerId: candidate.playerId,
                        stateIdBefore: recoveryStepStateIdBefore,
                        candidateReason: candidate.reason,
                        decisionMs: Date.now() - recoveryStepStartedAt,
                        executionMs: 0,
                        actionKind: null,
                        commandTypes: actionRecovery.executedCommandTypes,
                        outcome: `fallback:${trigger}:${actionRecovery.outcome}`,
                        blockedReason: actionRecovery.blockedReason,
                        commandFailureReason: actionRecovery.commandFailureReason,
                    });
                    if (!shouldRunForcedRecovery) {
                        this.onlineAiRecoveryTrackers.delete(match.matchID);
                        this.clearOnlineAiRepeatedRecoveryAttemptsForMatch(match.matchID);
                        return;
                    }
                    await this.runOnlineAiRecoverySequence(
                        match,
                        tracker,
                        candidate,
                        progressMarker,
                        seatControllers,
                        { reuseExecutionLock: true },
                    );
                    return;
                }

                this.logOnlineAiExecutionTrace({
                    matchId: match.matchID,
                    gameId: match.gameId,
                    playerId: candidate.playerId,
                    stateIdBefore: recoveryStepStateIdBefore,
                    candidateReason: candidate.reason,
                    decisionMs: Date.now() - recoveryStepStartedAt,
                    executionMs: 0,
                    actionKind: actionRecovery.reportedAction?.actionKind ?? null,
                    commandTypes: actionRecovery.executedCommandTypes,
                    outcome: `normal:${trigger}`,
                    blockedReason: null,
                    commandFailureReason: null,
                });
            }
        } finally {
            this.onlineAiRecoveryInFlight.delete(match.matchID);
            if (!match.unloaded) {
                await this.drainCommandQueue(match);
            }
            match.executing = false;
        }
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

            const seatControllers = this.buildOnlineAiSeatControllers(match);

            const hasAiSeat = Object.values(seatControllers).some((controller) => controller.type !== 'human');
            if (!hasAiSeat) {
                this.onlineAiRecoveryTrackers.delete(match.matchID);
                this.onlineAiCircuitBreaker.clearMatch(match.matchID);
                this.clearOnlineAiRepeatedRecoveryAttemptsForMatch(match.matchID);
                continue;
            }
            for (const [playerId, controller] of Object.entries(seatControllers)) {
                if (controller.type === 'human') {
                    this.onlineAiCircuitBreaker.clearSeat(match.matchID, playerId);
                }
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

            const circuitSnapshot = this.onlineAiCircuitBreaker.getSnapshot(
                match.matchID,
                candidate.playerId,
            );
            if (circuitSnapshot.tripped) {
                if (
                    circuitSnapshot.awaitingFreshState
                    && circuitSnapshot.safeUnblockStateID !== null
                    && match.stateID > circuitSnapshot.safeUnblockStateID
                ) {
                    const refreshedAdmission = this.onlineAiCircuitBreaker.admit({
                        matchId: match.matchID,
                        playerId: candidate.playerId,
                        source: 'watchdog',
                        stateID: match.stateID,
                        expectedStateID: match.stateID,
                    });
                    if (!refreshedAdmission.allowed) {
                        continue;
                    }
                } else if (!circuitSnapshot.safeUnblockUsed) {
                    const safeUnblockResult = await this.tryForceUnblockRepeatedOnlineAiRecovery({
                        match,
                        candidate,
                        trackerKey,
                        progressMarker,
                        repeatedAttemptKey,
                        repeatedAttempt,
                        seatControllers,
                    });
                    if (safeUnblockResult.handled) {
                        continue;
                    }
                } else {
                    continue;
                }
            }

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
        options?: { reuseExecutionLock?: boolean; allowManualImmediateAiContinuation?: boolean },
    ): Promise<void> {
        if (match.unloaded) {
            tracker.autoSubmittedAt = null;
            return;
        }
        const reuseExecutionLock = options?.reuseExecutionLock === true;
        if (match.executing && !reuseExecutionLock) {
            tracker.autoSubmittedAt = null;
            return;
        }

        if (!reuseExecutionLock) {
            match.executing = true;
        }
        const advancePhaseCommandType = resolveOnlineAiWatchdogAdvancePhaseCommandType({
            engineConfig: match.engineConfig,
        });
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
        const buildManualImmediateAiContinuationCandidate = (
            expectedPlayerId: string,
            previousActionKind: string | null | undefined,
        ): ForceEndTurnStalledAiResolution | null => {
            if (options?.allowManualImmediateAiContinuation !== true) {
                return null;
            }
            if (previousActionKind !== 'roll-dice') {
                return null;
            }
            if (!expectedPlayerId || seatControllers[expectedPlayerId]?.type === 'human') {
                return null;
            }
            if (hasHumanResponderInCurrentWindow()) {
                return null;
            }
            if (resolveWatchdogCurrentPlayerId() !== expectedPlayerId) {
                return null;
            }

            const marker = buildAiProgressMarker(match.state, {
                engineConfig: match.engineConfig,
                gameId: match.gameId,
            });
            const attemptKey = `${MANUAL_IMMEDIATE_AI_CONTINUATION_PREFIX}${expectedPlayerId}:${marker}`;
            return {
                playerId: expectedPlayerId,
                reason: 'active-turn',
                legalActionOnly: true,
                fingerprintHint: attemptKey,
                resolution: {
                    playerId: expectedPlayerId,
                    attemptKey,
                    source: 'local-ai',
                    action: {
                        actionId: attemptKey,
                        kind: 'manual-immediate-ai-continuation',
                        label: '继续手动强制结束 AI 阶段',
                        commands: [],
                    },
                },
            };
        };
        const buildManualForceAdvanceAfterConfirmedRollCandidate = (
            expectedPlayerId: string,
            previousAction: OnlineAiLegalActionReportedAction | null | undefined,
        ): ForceEndTurnStalledAiResolution | null => {
            if (options?.allowManualImmediateAiContinuation !== true) {
                return null;
            }
            if (!canManualForceAdvanceAfterConfirmedRoll(previousAction)) {
                return null;
            }
            if (!expectedPlayerId || seatControllers[expectedPlayerId]?.type === 'human') {
                return null;
            }
            if (hasHumanResponderInCurrentWindow()) {
                return null;
            }
            if (resolveWatchdogCurrentPlayerId() !== expectedPlayerId) {
                return null;
            }

            const followUpResolution = resolveForceAdvancePhaseAfterRecovery({
                authoritativeState: match.state,
                seatControllers,
                playerId: expectedPlayerId,
                engineConfig: match.engineConfig,
                gameId: match.gameId,
            });
            if (!followUpResolution) {
                return null;
            }

            const marker = buildAiProgressMarker(match.state, {
                engineConfig: match.engineConfig,
                gameId: match.gameId,
            });
            const attemptKey = `${MANUAL_FORCE_ADVANCE_AFTER_CONFIRMED_ROLL_PREFIX}${expectedPlayerId}:${marker}`;
            return {
                playerId: expectedPlayerId,
                reason: 'active-turn',
                fingerprintHint: attemptKey,
                resolution: {
                    ...followUpResolution,
                    attemptKey,
                    action: {
                        ...followUpResolution.action,
                        actionId: attemptKey,
                        kind: 'manual-force-advance-after-confirm',
                        label: '手动强制结束 AI 阶段：确认骰面后推进阶段',
                    },
                },
            };
        };
        const isManualRecoveryContinuationCandidate = (
            value: ForceEndTurnStalledAiResolution,
        ): boolean => typeof value.fingerprintHint === 'string'
            && (
                value.fingerprintHint.startsWith(MANUAL_IMMEDIATE_AI_CONTINUATION_PREFIX)
                || value.fingerprintHint.startsWith(MANUAL_FORCE_ADVANCE_AFTER_CONFIRMED_ROLL_PREFIX)
            );
        const shouldPreserveManualHumanResponseWindowForceClose = (
            expectedCandidate: ForceEndTurnStalledAiResolution,
        ): boolean => {
            if (
                expectedCandidate.reason !== 'response-window'
                || typeof expectedCandidate.fingerprintHint !== 'string'
                || !expectedCandidate.fingerprintHint.startsWith('manual-response-window:')
                || !expectedCandidate.resolution.action.commands.some((command) => command.type === 'SYS_RESPONSE_WINDOW_FORCE_CLOSE')
            ) {
                return false;
            }

            const currentWindow = (match.state.sys as { responseWindow?: { current?: unknown } } | undefined)
                ?.responseWindow?.current as {
                    responderQueue?: unknown;
                    currentResponderIndex?: unknown;
                } | undefined;
            if (!currentWindow) {
                return false;
            }

            const responderQueue = Array.isArray(currentWindow.responderQueue) ? currentWindow.responderQueue : [];
            const responderIndex = typeof currentWindow.currentResponderIndex === 'number'
                ? currentWindow.currentResponderIndex
                : 0;
            const responderId = typeof responderQueue[responderIndex] === 'string'
                ? responderQueue[responderIndex]
                : null;
            if (!responderId || responderId === expectedCandidate.playerId || seatControllers[responderId]?.type !== 'human') {
                return false;
            }

            if (resolveWatchdogCurrentPlayerId() !== expectedCandidate.playerId) {
                return false;
            }

            const currentFingerprint = buildResponseWindowRecoveryFingerprintHint(
                match.state,
                expectedCandidate.playerId,
                'manual-response-window',
            );
            return currentFingerprint === expectedCandidate.fingerprintHint;
        };
        const revalidateRecoveryCandidate = async (
            expectedCandidate: ForceEndTurnStalledAiResolution,
        ): Promise<ForceEndTurnStalledAiResolution | null> => {
            let rawLatestCandidate = await this.resolveOnlineAiRecoveryCandidate(match, seatControllers);
            if (!rawLatestCandidate && shouldPreserveManualHumanResponseWindowForceClose(expectedCandidate)) {
                rawLatestCandidate = expectedCandidate;
            }
            const latestCandidate = rawLatestCandidate
                ? normalizeFollowUpLegalActionOnlyCandidate(rawLatestCandidate, expectedCandidate)
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
        const clearConfiguredLegacyResponseWindowMirror = async (): Promise<boolean> => {
            const legacySourceIds = match.engineConfig.onlineAiRecovery?.legacyResponseWindowMirrorSourceIds ?? [];
            if (legacySourceIds.length === 0) {
                return false;
            }

            const responseWindow = match.state.sys?.responseWindow as {
                current?: {
                    sourceId?: unknown;
                } | null;
            } | undefined;
            const sourceId = typeof responseWindow?.current?.sourceId === 'string'
                ? responseWindow.current.sourceId
                : '';
            if (!sourceId || !legacySourceIds.includes(sourceId)) {
                return false;
            }

            match.state = {
                ...match.state,
                sys: {
                    ...match.state.sys,
                    responseWindow: {
                        ...(match.state.sys?.responseWindow ?? {}),
                        current: undefined,
                    },
                },
            };
            match.stateID += 1;
            match.lastBroadcastedViews.clear();
            await this.storage.setState(match.matchID, {
                G: match.state,
                _stateID: match.stateID,
                randomSeed: match.randomSeed,
                randomCursor: match.getRandomCursor(),
            });
            this.broadcastState(match);

            logger.info('[GameTransport] online-ai-watchdog cleared legacy response-window mirror', {
                matchID: match.matchID,
                gameId: match.gameId,
                playerID: currentCandidate.playerId,
                sourceId,
            });
            return true;
        };
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
        let phaseLabel: OnlineAiRecoveryPhaseLabel = resolveOnlineAiRecoveryPhaseLabel(currentCandidate);
        let totalAdvanceSteps = 0;
        let totalForcedCommands = 0;
        let usedForcedRecoveryCommand = false;
        let lastForcedReason: ForceEndTurnStalledAiResolution['reason'] | null = null;
        let lastForcedPhaseLabel: OnlineAiRecoveryPhaseLabel = phaseLabel;

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
                {
                    reportFailureFeedback: true,
                    feedbackSource: 'online-ai-watchdog',
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
            const delayContext = createOnlineAiActionDelayContext();
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
                const canUseManualImmediateContinuationSlice =
                    isManualRecoveryContinuationCandidate(currentCandidate);
                if (recoverySteps >= this.onlineAiRecoveryMaxStepsPerSlice
                    && !canUseManualImmediateContinuationSlice) {
                    // 后台恢复必须分片执行，避免单个复杂 AI 房间长期独占 Node 事件循环。
                    syncRecoveryTrackerToCandidate(currentCandidate);
                    tracker.firstSeenAt = Date.now();
                    tracker.autoSubmittedAt = null;
                    return;
                }
                phaseLabel = resolveOnlineAiRecoveryPhaseLabel(currentCandidate);
                const markerBeforeStep = buildAiProgressMarker(match.state, {
                    engineConfig: match.engineConfig,
                    gameId: match.gameId,
                });
                const stepStateIdBefore = match.stateID;
                const stepStartedAt = Date.now();
                const currentPlayerIdBeforeStep = resolveWatchdogCurrentPlayerId();
                const stepKeyBefore = buildRecoverySequenceStepKey(currentCandidate.playerId, markerBeforeStep);
                const interactionFingerprintBeforeStep = readCurrentAiInteractionSemanticFingerprint(currentCandidate.playerId);
                const responseWindowFingerprintBeforeStep = readCurrentAiResponseWindowRecoveryFingerprintHint(currentCandidate.playerId);
                const actionRecovery = await this.tryRecoverOnlineAiWithLegalAction(
                    match,
                    currentCandidate,
                    tracker,
                    seatControllers,
                    delayContext,
                );
                this.logOnlineAiExecutionTrace({
                    matchId: match.matchID,
                    gameId: match.gameId,
                    playerId: currentCandidate.playerId,
                    stateIdBefore: stepStateIdBefore,
                    candidateReason: currentCandidate.reason,
                    decisionMs: Date.now() - stepStartedAt,
                    executionMs: 0,
                    actionKind: actionRecovery.reportedAction?.actionKind ?? null,
                    commandTypes: actionRecovery.executedCommandTypes,
                    outcome: actionRecovery.outcome,
                    blockedReason: actionRecovery.blockedReason,
                    commandFailureReason: actionRecovery.applied ? null : actionRecovery.commandFailureReason,
                });
                const blockedFailureReason = actionRecovery.blockedReason === 'stale-private-overlay'
                    ? 'private_overlay_stale'
                    : actionRecovery.blockedReason === 'missing-private-overlay'
                        ? 'private_overlay_missing'
                        : actionRecovery.blockedReason === 'missing-visible-state'
                            ? 'missing_visible_state'
                            : null;
                if (actionRecovery.applied && actionRecovery.reportedAction) {
                    lastUnreportedLegalActionRecovery = actionRecovery.reportedAction;
                }
                const executedCommandTypes = new Set<string>(actionRecovery.executedCommandTypes);

                if (!actionRecovery.applied) {
                    if (
                        isManualRecoveryContinuationCandidate(currentCandidate)
                        && actionRecovery.outcome === 'no-legal-action'
                        && currentCandidate.resolution.action.commands.length === 0
                    ) {
                        break;
                    }
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
                        {
                            reportFailureFeedback: true,
                            feedbackSource: 'online-ai-watchdog',
                        },
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
                if (executedCommandTypes.size > 0) {
                    await clearConfiguredLegacyResponseWindowMirror();
                }
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
                    const noProgressReason = actionRecovery.outcome === 'blocked'
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
                    const manualForceAdvanceCandidate = buildManualForceAdvanceAfterConfirmedRollCandidate(
                        candidate.playerId,
                        actionRecovery.reportedAction,
                    );
                    if (manualForceAdvanceCandidate) {
                        currentCandidate = manualForceAdvanceCandidate;
                        continue;
                    }
                    const manualContinuationCandidate = buildManualImmediateAiContinuationCandidate(
                        candidate.playerId,
                        actionRecovery.reportedAction?.actionKind,
                    );
                    if (manualContinuationCandidate) {
                        currentCandidate = manualContinuationCandidate;
                        continue;
                    }
                    if (candidate.requiresConfirmedAdvancePhase === true) {
                        const followUpResolution = resolveForceAdvancePhaseAfterRecovery({
                            authoritativeState: match.state,
                            seatControllers,
                            playerId: candidate.playerId,
                            engineConfig: match.engineConfig,
                            gameId: match.gameId,
                        });
                        if (followUpResolution) {
                            currentCandidate = {
                                playerId: candidate.playerId,
                                reason: 'active-turn',
                                fingerprintHint: followUpResolution.attemptKey,
                                resolution: followUpResolution,
                            };
                            continue;
                        }
                    }
                    break;
                }
                const shouldRestrictFollowUpToLegalActions = candidate.requiresConfirmedAdvancePhase
                    && (candidate.reason === 'visible-interaction' || candidate.reason === 'hidden-interaction')
                    && nextCandidate.reason === 'active-turn'
                    && currentPlayerIdBeforeStep !== candidate.playerId
                    && resolveWatchdogCurrentPlayerId() === candidate.playerId;
                const seatViewInteractionAfterStep = readCurrentAiSeatViewInteractionRecoveryFingerprintHint(candidate.playerId);
                if (actionRecovery.applied
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
                const manualContinuationCandidate = buildManualImmediateAiContinuationCandidate(
                    candidate.playerId,
                    actionRecovery.reportedAction?.actionKind,
                );
                const manualForceAdvanceCandidate = buildManualForceAdvanceAfterConfirmedRollCandidate(
                    candidate.playerId,
                    actionRecovery.reportedAction,
                );
                if (manualForceAdvanceCandidate) {
                    currentCandidate = manualForceAdvanceCandidate;
                    continue;
                }
                if (manualContinuationCandidate) {
                    currentCandidate = {
                        ...normalizedNextCandidate,
                        legalActionOnly: true,
                        fingerprintHint: manualContinuationCandidate.fingerprintHint,
                    };
                    continue;
                }
                const shouldContinueLegalOnlyActiveTurnExecution =
                    actionRecovery.applied
                    && candidate.reason === 'active-turn-legal-only'
                    && normalizedNextCandidate.reason === 'active-turn'
                    && normalizedNextCandidate.resolution.action.commands.length > 0;
                if (shouldContinueLegalOnlyActiveTurnExecution) {
                    currentCandidate = normalizedNextCandidate;
                    continue;
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
                    resolveOnlineAiRecoveryPhaseLabel(revalidatedCandidate),
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
            if (
                !usedForcedRecoveryCommand
                && !lastUnreportedLegalActionRecovery
                && match.engineConfig.onlineAiRecovery?.reportObservedRecoveryWithoutForcedCommand === true
            ) {
                await this.reportOnlineAiRecoveryFeedback({
                    matchId: match.matchID,
                    gameId: match.gameId,
                    playerId: candidate.playerId,
                    incidentKind: 'observed-recovery',
                    severity: 'medium',
                    status: 'resolved',
                    reason: `${candidate.reason}:observed-progress`,
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
            if (!reuseExecutionLock) {
                match.executing = false;
            }
        }
    }

    private logOnlineAiExecutionTrace(trace: OnlineAiExecutionTrace): void {
        logger.info('[GameTransport] online-ai-execution', trace);
    }

    private async handleOnlineAiRecoveryFailure(
        match: ActiveMatch,
        tracker: OnlineAiRecoveryTracker,
        candidate: ForceEndTurnStalledAiResolution,
        phaseLabel: OnlineAiRecoveryPhaseLabel,
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
        const repeatedAttempt = this.recordOnlineAiRepeatedRecoveryAttempt(match.matchID, tracker.key);

        logger.warn('[GameTransport] online-ai-watchdog failed', {
            matchID: match.matchID,
            gameId: match.gameId,
            playerID: candidate.playerId,
            incidentKey: tracker.key,
            reason,
            phase: phaseLabel,
            failureCount: nextTracker.failureCount,
            repeatedAttemptCount: repeatedAttempt.count,
            repeatedAttemptLimit: this.onlineAiRecoveryRepeatedAttemptLimit,
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

    private async tryForceUnblockRepeatedOnlineAiRecovery(args: {
        match: ActiveMatch;
        candidate: ForceEndTurnStalledAiResolution;
        trackerKey: string;
        progressMarker: string;
        repeatedAttemptKey: string;
        repeatedAttempt: OnlineAiRepeatedRecoveryAttempt | undefined;
        seatControllers: Record<string, OnlineAiWatchdogSeatController>;
    }): Promise<{ handled: boolean; suppressionReason?: string }> {
        return executeRepeatedRecoveryForceUnblock({
            match: args.match,
            candidate: args.candidate,
            progressMarker: args.progressMarker,
            repeatedAttemptKey: args.repeatedAttemptKey,
            repeatedAttempt: args.repeatedAttempt,
            repeatedAttemptLimit: this.onlineAiRecoveryRepeatedAttemptLimit,
            seatControllers: args.seatControllers,
            hooks: {
                getCircuitSnapshot: (matchId, playerId) => this.onlineAiCircuitBreaker.getSnapshot(
                    matchId,
                    playerId,
                ),
                beginSafeUnblock: (matchId, playerId) => this.onlineAiCircuitBreaker.beginSafeUnblock(
                    matchId,
                    playerId,
                ),
                finishSafeUnblock: (payload) => {
                    this.onlineAiCircuitBreaker.finishSafeUnblock(payload);
                },
                executeCommand: (commandType, payload, options) => this.executeCommandInternal(
                    args.match,
                    args.candidate.playerId,
                    commandType,
                    payload,
                    options,
                ),
                reportSuppressed: (payload) => this.reportOnlineAiRepeatedRecoverySuppressed({
                    match: args.match,
                    candidate: args.candidate,
                    trackerKey: args.trackerKey,
                    progressMarker: args.progressMarker,
                    repeatedAttemptKey: args.repeatedAttemptKey,
                    repeatedAttempt: args.repeatedAttempt,
                    suppressionReason: payload.suppressionReason,
                }),
                markRepeatedAttemptReported: (repeatedAttemptKey, repeatedAttempt) => (
                    this.markOnlineAiRepeatedRecoveryAttemptReported(
                        repeatedAttemptKey,
                        repeatedAttempt,
                    )
                ),
                clearRecoveryTracker: () => {
                    this.onlineAiRecoveryTrackers.delete(args.match.matchID);
                },
                reportForceUnblocked: async (payload) => {
                    logger.warn('[GameTransport] online-ai-watchdog force-unblocked repeated recovery', {
                        matchID: args.match.matchID,
                        gameId: args.match.gameId,
                        playerID: args.candidate.playerId,
                        incidentKey: args.trackerKey,
                        reason: payload.reason,
                        repeatedAttemptCount: payload.reportedAttempt.count,
                        repeatedAttemptLimit: this.onlineAiRecoveryRepeatedAttemptLimit,
                        markerBefore: args.progressMarker,
                        markerAfter: payload.markerAfter,
                        commands: payload.forcedCommands,
                    });

                    await this.reportOnlineAiRecoveryFeedback({
                        matchId: args.match.matchID,
                        gameId: args.match.gameId,
                        playerId: args.candidate.playerId,
                        incidentKind: 'repeated-recovery-force-unblocked',
                        severity: 'high',
                        status: 'open',
                        reason: payload.reason,
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
                },
                drainCommandQueue: () => this.drainCommandQueue(args.match),
            },
        });
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
        const seatView = this.applyPlayerView(match, candidate.playerId) as MatchState<unknown>;
        const aiSummary = await this.buildOnlineAiRecoveryAiSummary(match, candidate.playerId, seatView);
        const blockerFingerprint = this.resolveOnlineAiRecoveryFeedbackFingerprint(
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
        const pendingDamage = buildOnlineAiPendingDamageDiagnostic(match.state);
        const blockerFingerprint = this.resolveOnlineAiRecoveryFeedbackFingerprint(
            match,
            candidate,
            trackerKey,
            progressMarker,
            failureReason,
        );
        return buildOnlineAiDiagnosticActionLog({
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

    private resolveOnlineAiRecoveryFeedbackFingerprint(
        match: ActiveMatch,
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

    private buildOnlineAiRecoveryFingerprint(
        match: ActiveMatch,
        candidate: ForceEndTurnStalledAiResolution,
        progressMarker: string,
    ): string {
        return resolveRecoveryFingerprint({
            state: match.state,
            candidate,
            progressMarker,
            engineConfig: match.engineConfig,
        });
    }

    private async hasOnlineAiRecoveryResolved(
        match: ActiveMatch,
        candidate: ForceEndTurnStalledAiResolution,
        seatControllers: Record<string, OnlineAiWatchdogSeatController>,
    ): Promise<boolean> {
        return resolveOnlineAiRecoveryResolved({
            getSharedState: () => match.state,
            candidate,
            seatControllers,
            resolveRecoveryCandidate: () => this.resolveOnlineAiRecoveryCandidate(match, seatControllers),
            applyPlayerView: (playerId) => this.applyPlayerView(match, playerId) as MatchState<unknown>,
        });
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
        const aiSummary = await this.buildOnlineAiRecoveryAiSummary(match, playerId, preCommandSeatView);
        return buildOnlineAiUnsatisfiableInteractionStateSnapshotJson({
            matchId: match.matchID,
            gameId: match.gameId,
            state: match.state,
            seatState: preCommandSeatView,
            playerId,
            reason,
            commandType,
            progressMarker: progressMarkerBefore,
            aiSummary,
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

    private buildCommandFailureAiDiagnostic(args: {
        match: ActiveMatch;
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
                rulesVersion: this.rulesVersion,
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

    private buildCommandFailureFeedbackPayload(args: {
        match: ActiveMatch;
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
        const isOnlineAiRecovery = payload.feedbackSource === 'online-ai-watchdog';
        await this.postInternalSystemFeedback({
            content: `[system][${payload.feedbackSource}] ${payload.commandType} ${payload.reason}`,
            type: 'bug',
            severity: payload.severity,
            source: payload.feedbackSource,
            autoReportKind: isOnlineAiRecovery ? 'online-ai-command-failed' : payload.incidentKind,
            incidentKey: payload.incidentKey,
            gameName: payload.gameId,
            contactInfo: `system:${payload.feedbackSource}`,
            actionLog: payload.actionLog,
            stateSnapshot: payload.stateSnapshot,
            clientContext: {
                route: isOnlineAiRecovery ? 'server-watchdog-command' : 'server-command',
                mode: 'online',
                matchId: payload.matchId,
                playerId: payload.playerId,
                gameId: payload.gameId,
                timezone: 'server',
                ...buildInfo,
            },
            errorContext: {
                source: payload.feedbackSource,
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
        delayContext?: OnlineAiActionDelayContext,
    ): Promise<OnlineAiLegalActionRecoveryResult> {
        const dispatchResult = await resolveOnlineAiRecoveryDispatch({
            engineConfig: match.engineConfig,
            gameId: match.gameId,
            matchId: match.matchID,
            sharedState: match.state,
            candidate,
            seatController: seatControllers[candidate.playerId],
            resolvePrivateOverlay: (playerId) => this.applyPlayerView(match, playerId) as MatchState<unknown>,
            onEmergencyOverlayFallbackRetry: (payload) => {
                logger.warn('[GameTransport] online-ai-watchdog retrying legal-action with emergency playerView', {
                    matchID: match.matchID,
                    gameId: match.gameId,
                    playerID: payload.playerId,
                    reason: payload.reason,
                    blockedReason: payload.blockedReason,
                    blockedKey: payload.blockedKey,
                });
            },
        });
        if (dispatchResult.kind === 'no-legal-action') {
            return { applied: false, resolved: false, blockedReason: null, executedCommandTypes: [], outcome: 'no-legal-action', reportedAction: null };
        }

        if (dispatchResult.kind === 'blocked') {
            logger.info('[GameTransport] online-ai-watchdog legal-action blocked', {
                matchID: match.matchID,
                gameId: match.gameId,
                playerID: dispatchResult.playerId,
                blockedReason: dispatchResult.blockedReason,
                visibility: dispatchResult.visibility,
                blockedKey: dispatchResult.blockedKey,
            });
            if (dispatchResult.shouldTriggerOverlayResync) {
                this.maybeTriggerOnlineAiOverlayResync({
                    match,
                    playerId: dispatchResult.playerId,
                    blockedReason: dispatchResult.blockedReason,
                    blockedKey: dispatchResult.blockedKey,
                    progressMarker: buildAiProgressMarker(match.state, {
                        engineConfig: match.engineConfig,
                        gameId: match.gameId,
                    }),
                });
            }
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
                resolveSeatState: (seatPlayerId) => this.applyPlayerView(match, seatPlayerId) as MatchState<unknown>,
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
            delayContext,
            emitTrace: emitOnlineAiBatchTrace,
            hooks: {
                getLatestSeatController: (playerId) => this.buildOnlineAiSeatControllers(match)[playerId],
                buildProgressMarker: () => buildAiProgressMarker(match.state, {
                    engineConfig: match.engineConfig,
                    gameId: match.gameId,
                }),
                buildRecoveryFingerprint: (progressMarker) => this.buildOnlineAiRecoveryFingerprint(
                    match,
                    candidate,
                    progressMarker,
                ),
                isStillOwnedByRecoveredAi,
                hasRecoveryResolved: () => this.hasOnlineAiRecoveryResolved(match, candidate, seatControllers),
                settleRecoveryResolvedStatus: (resolved) => {
                    if (resolved) {
                        this.onlineAiRecoveryTrackers.delete(match.matchID);
                    } else {
                        tracker.autoSubmittedAt = null;
                        tracker.firstSeenAt = Date.now();
                    }
                },
                resetRecoveryAttempt: () => {
                    tracker.autoSubmittedAt = null;
                },
                validateCommand: (state, commandToValidate) => match.engineConfig.domain.validate(
                    state,
                    commandToValidate,
                ),
                executeCommand: (command) => this.executeCommandInternal(
                    match,
                    resolution.playerId,
                    command.type,
                    command.payload,
                    {
                        suppressBroadcast: true,
                        reportFailureFeedback: true,
                        feedbackSource: 'online-ai-watchdog',
                    },
                ),
                broadcastState: () => this.broadcastState(match),
                onPrecheckDeferred: (payload) => {
                    logger.warn('[GameTransport] online-ai-watchdog authoritative command precheck failed; deferring to pipeline', {
                        matchID: match.matchID,
                        gameId: match.gameId,
                        playerID: payload.playerId,
                        commandType: payload.commandType,
                        error: payload.errorMessage,
                    });
                },
                onAuthoritativeInvalidCommand: async (payload) => {
                    const visibleState = this.stripStateForTraining(
                        this.applyPlayerView(match, payload.playerId),
                    ) as MatchState<unknown>;

                    logger.warn('[GameTransport] online-ai-watchdog skipped authoritative-invalid legal action', {
                        matchID: match.matchID,
                        gameId: match.gameId,
                        playerID: payload.playerId,
                        commandType: payload.command.type,
                        commandPayload: cloneDiagnosticValue(payload.command.payload),
                        reason: payload.commandFailureReason,
                        stateIDBefore: payload.stateIDBefore,
                        progressMarker: payload.progressMarker,
                    });

                    await this.recordOnlineAiCircuitFailure({
                        match,
                        playerId: payload.playerId,
                        source: 'watchdog',
                        commandType: payload.command.type,
                        commandPayload: payload.command.payload,
                        reason: payload.commandFailureReason,
                        stateID: payload.stateIDBefore,
                        progressMarker: payload.progressMarker,
                    });

                    if (shouldAutoReportCommandFailure(payload.commandFailureReason, 'online-ai-watchdog')) {
                        await this.reportCommandFailureFeedback(this.buildCommandFailureFeedbackPayload({
                            match,
                            playerId: payload.playerId,
                            commandType: payload.command.type,
                            reason: payload.commandFailureReason,
                            commandPayload: payload.command.payload,
                            progressMarker: payload.progressMarker,
                            stateIdBefore: payload.stateIDBefore,
                            visibleState,
                            feedbackSource: 'online-ai-watchdog',
                        }));
                    }
                },
                onStoppedAfterOwnershipChanged: (payload) => {
                    logger.info('[GameTransport] online-ai-watchdog stopped legal action after ownership changed', {
                        matchID: match.matchID,
                        gameId: match.gameId,
                        playerID: payload.playerId,
                        incidentKey: tracker.key,
                        actionId: payload.actionId,
                        actionKind: payload.actionKind,
                        executedCommandTypes: payload.executedCommandTypes,
                        resolved: payload.resolved,
                    });
                },
                onRecoveredLegalAction: (payload) => {
                    logger.info('[GameTransport] online-ai-watchdog recovered stalled AI via legal action', {
                        matchID: match.matchID,
                        gameId: match.gameId,
                        playerID: payload.playerId,
                        incidentKey: tracker.key,
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
        await drainAuthoritativeCommandQueue(match, {
            executeQueuedCommand: (activeMatch, command) => this.executeCommandInternal(
                activeMatch,
                command.playerID,
                command.commandType,
                command.payload,
                command.options,
            ),
            rejectStaleQueuedCommand: (activeMatch, command) => this.rejectStaleQueuedCommand(
                activeMatch,
                command,
            ),
            onQueuedExecutionError: (activeMatch, _item, error) => {
                logger.error('[GameTransport] 队列中命令执行异常', {
                    matchID: activeMatch.matchID,
                    error: error instanceof Error ? error.message : String(error),
                });
            },
        });
    }

    private async rejectStaleQueuedCommand(
        match: ActiveMatch,
        command: QueuedAuthoritativeCommand<ExecuteCommandInternalOptions>,
    ): Promise<void> {
        if (this.resolveOnlineAiSeatControllerType(match, command.playerID) !== 'human') {
            const expectedStateID = command.options?.expectedStateID ?? command.stateIDAtEnqueue;
            const circuitSource = command.options?.onlineAiCircuitSource
                ?? (command.options?.feedbackSource === 'online-ai-watchdog' ? 'watchdog' : 'client');
            const circuitAdmission = this.onlineAiCircuitBreaker.admit({
                matchId: match.matchID,
                playerId: command.playerID,
                source: circuitSource,
                expectedStateID,
                stateID: match.stateID,
            });
            if (circuitAdmission.allowed) {
                await this.recordOnlineAiCircuitFailure({
                    match,
                    playerId: command.playerID,
                    source: circuitSource,
                    commandType: command.commandType,
                    commandPayload: command.payload,
                    reason: 'stale_state',
                    expectedStateID,
                    stateID: match.stateID,
                    progressMarker: buildAiProgressMarker(match.state, {
                        engineConfig: match.engineConfig,
                        gameId: match.gameId,
                    }),
                    onlineAiAttemptKey: command.options?.onlineAiAttemptKey,
                    clientTransport: command.options?.clientTransport,
                });
            }
        }
        logger.warn('[GameTransport] dropped stale queued command', {
            matchID: match.matchID,
            playerID: command.playerID,
            commandType: command.commandType,
            stateIDAtEnqueue: command.stateIDAtEnqueue,
            currentStateID: match.stateID,
        });
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
            if (this.resolveOnlineAiSeatControllerType(match, playerID) === 'human') {
                await this.runOnlineAiImmediateExecution(match, 'sync');
            }
        }
    }

    private async handleCommand(
        matchID: string,
        playerID: string,
        commandType: string,
        payload: unknown,
        options?: ExecuteCommandInternalOptions,
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
                    stateIDAtEnqueue: match.stateID,
                    options: {
                        reportFailureFeedback: true,
                        feedbackSource: options?.feedbackSource,
                        expectedStateID: options?.expectedStateID,
                        onlineAiCircuitSource: options?.onlineAiCircuitSource,
                        onlineAiAttemptKey: options?.onlineAiAttemptKey,
                        clientTransport: options?.clientTransport,
                    },
                    resolve,
                });
            });
        }

        let success = false;
        match.executing = true;
        try {
            success = await this.executeCommandInternal(
                match,
                playerID,
                commandType,
                payload,
                {
                    reportFailureFeedback: true,
                    expectedStateID: options?.expectedStateID,
                    onlineAiAttemptKey: options?.onlineAiAttemptKey,
                    clientTransport: options?.clientTransport,
                },
            );
            await this.drainCommandQueue(match);
        } finally {
            match.executing = false;
        }
        if (success) {
            await this.runOnlineAiImmediateExecution(match, 'command-succeeded');
        }
        return success;
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

        let batchSucceeded = false;
        match.executing = true;

        try {
            const batchResult = await executeAuthoritativeCommandBatch({
                match,
                commands,
                tracePrefix: 'handle-batch',
                tracePayload: {
                    matchID,
                    playerID,
                    batchId,
                },
                staleTracePayload: {
                    matchID,
                    playerID,
                    batchId,
                    expectedStateID: meta?.expectedStateID ?? null,
                    actualStateID: match.stateID,
                },
                emitTrace: emitOnlineAiBatchTrace,
                rejectWhenStatePreconditionFails: () => this.rejectBatchWhenStatePreconditionFails(
                    socket,
                    matchID,
                    batchId,
                    match,
                    meta,
                    commands,
                    playerID,
                ),
                executeCommand: (cmd) => this.executeCommandInternal(match, playerID, cmd.type, cmd.payload, {
                    suppressBroadcast: true,
                    reportFailureFeedback: true,
                    onlineAiAttemptKey: normalizeOnlineAiAttemptKey(meta?.onlineAiAttemptKey),
                    clientTransport: normalizeOnlineAiClientTransportDiagnostics(meta?.clientTransport),
                }),
                persistRollbackState: (storedState) => this.storage.setState(matchID, storedState),
                broadcastState: () => this.broadcastState(match),
                buildAuthoritativeState: () => this.stripStateForTransport(match.state, { stripEventStream: true }),
            });

            if (batchResult.status === 'stale-rejected') {
                return;
            }
            if (batchResult.status === 'command-rejected') {
                socket.emit('batch:rejected', matchID, batchId, batchResult.failureReason);
                return;
            }
            // batch:confirmed 是乐观更新的确认响应，客户端已通过本地预测消费了事件
            socket.emit('batch:confirmed', matchID, batchId, batchResult.authoritativeState);
            batchSucceeded = true;
        } finally {
            await this.drainCommandQueue(match);
            match.executing = false;
        }
        if (batchSucceeded) {
            await this.runOnlineAiImmediateExecution(match, 'command-succeeded');
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
        const batchResult = await executeAuthoritativeCommandBatch({
            match,
            commands,
            tracePrefix: 'execute-batch',
            tracePayload: {
                matchID,
                playerID,
                batchId,
            },
            staleTracePayload: {
                matchID,
                playerID,
                batchId,
                expectedStateID: meta?.expectedStateID ?? null,
                actualStateID: match.stateID,
            },
            emitTrace: emitOnlineAiBatchTrace,
            rejectWhenStatePreconditionFails: () => this.rejectBatchWhenStatePreconditionFails(
                socket,
                matchID,
                batchId,
                match,
                meta,
                commands,
                playerID,
            ),
            executeCommand: (cmd) => this.executeCommandInternal(match, playerID, cmd.type, cmd.payload, {
                suppressBroadcast: true,
                reportFailureFeedback: true,
                onlineAiAttemptKey: normalizeOnlineAiAttemptKey(meta?.onlineAiAttemptKey),
                clientTransport: normalizeOnlineAiClientTransportDiagnostics(meta?.clientTransport),
            }),
            persistRollbackState: (storedState) => this.storage.setState(matchID, storedState),
            broadcastState: () => this.broadcastState(match),
            buildAuthoritativeState: () => this.stripStateForTransport(match.state, { stripEventStream: true }),
        });

        if (batchResult.status === 'stale-rejected') {
            return;
        }
        if (batchResult.status === 'command-rejected') {
            socket.emit('batch:rejected', matchID, batchId, batchResult.failureReason);
            return;
        }

        // 批次成功 - 广播最终状态给所有玩家，然后发送确认给发送者
        socket.emit('batch:confirmed', matchID, batchId, batchResult.authoritativeState);
    }

    private async rejectBatchWhenStatePreconditionFails(
        socket: IOSocket,
        matchID: string,
        batchId: string,
        match: ActiveMatch,
        meta?: BatchDispatchMeta,
        commands: Array<{ type: string; payload: unknown }> = [],
        playerID?: string,
    ): Promise<boolean> {
        const expectedStateID = meta?.expectedStateID;
        if (typeof expectedStateID !== 'number') {
            return false;
        }
        if (match.stateID === expectedStateID) {
            return false;
        }

        if (playerID && this.resolveOnlineAiSeatControllerType(match, playerID) !== 'human') {
            const admission = this.onlineAiCircuitBreaker.admit({
                matchId: matchID,
                playerId: playerID,
                source: 'client',
                expectedStateID,
                stateID: match.stateID,
            });
            if (!admission.allowed) {
                socket.emit('batch:rejected', matchID, batchId, admission.reason === 'stale-epoch'
                    ? 'stale_state'
                    : 'online_ai_circuit_open');
                return true;
            }
            await this.recordOnlineAiCircuitFailure({
                match,
                playerId: playerID,
                source: 'client',
                commandType: commands[0]?.type ?? 'batch',
                commandPayload: commands[0]?.payload,
                reason: 'stale_state',
                expectedStateID,
                stateID: match.stateID,
                progressMarker: buildAiProgressMarker(match.state, {
                    engineConfig: match.engineConfig,
                    gameId: match.gameId,
                }),
                onlineAiAttemptKey: normalizeOnlineAiAttemptKey(meta?.onlineAiAttemptKey),
                clientTransport: normalizeOnlineAiClientTransportDiagnostics(meta?.clientTransport),
            });
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

    private stripStateForTransport(viewState: unknown, options?: { stripEventStream?: boolean }): unknown {
        return stripProjectedStateForTransport(viewState, options);
    }

    private stripStateForTraining(viewState: unknown): unknown {
        return stripProjectedStateForTraining(viewState);
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

        match.lastCommandFailureReason = null;
        const { engineConfig, state, random, playerIds } = match;
        const stateIdBefore = match.stateID;
        const progressMarkerBeforeCommand = buildAiProgressMarker(match.state, {
            engineConfig: match.engineConfig,
            gameId: match.gameId,
        });
        const setupSeatControllers = extractTrustedSetupSeatControllers(match.metadata.setupData);
        const seatControllerType = resolveSeatControllerTypeForTraining(setupSeatControllers, playerID);
        const onlineAiSeatControllerType = this.resolveOnlineAiSeatControllerType(match, playerID);
        const onlineAiCircuitSource: OnlineAiCircuitSource = options?.onlineAiCircuitSource
            ?? (options?.feedbackSource === 'online-ai-watchdog' ? 'watchdog' : 'client');

        if (onlineAiSeatControllerType !== 'human') {
            const circuitAdmission = this.onlineAiCircuitBreaker.admit({
                matchId: match.matchID,
                playerId: playerID,
                source: onlineAiCircuitSource,
                expectedStateID: options?.expectedStateID,
                stateID: stateIdBefore,
            });
            if (!circuitAdmission.allowed) {
                return this.rejectOnlineAiCircuitCommand({
                    match,
                    playerId: playerID,
                    reason: circuitAdmission.reason ?? 'circuit-open',
                    commandType,
                    expectedStateID: options?.expectedStateID,
                    onlineAiAttemptKey: options?.onlineAiAttemptKey,
                    clientTransport: options?.clientTransport,
                    snapshot: circuitAdmission.snapshot,
                });
            }
        }

        const preTrainingState = this.stripStateForTraining(this.applyPlayerView(match, playerID)) as MatchState<unknown>;

        const feedbackSource: CommandFailureFeedbackPayload['feedbackSource'] =
            options?.feedbackSource ?? 'player-command-failure';
        const authoritativeCommand = this.authoritativeCommandExecutor.buildCommand({
            playerId: playerID,
            commandType,
            payload,
            seatControllerType,
            preCommandSeatView: preTrainingState,
        });
        let effectiveCommandType = authoritativeCommand.type;
        let effectivePayload = authoritativeCommand.payload;

        if (
            onlineAiSeatControllerType !== 'human'
            && typeof options?.expectedStateID === 'number'
            && options.expectedStateID !== stateIdBefore
        ) {
            match.lastCommandFailureReason = 'stale_state';
            const circuitSnapshot = await this.recordOnlineAiCircuitFailure({
                match,
                playerId: playerID,
                source: onlineAiCircuitSource,
                commandType: effectiveCommandType,
                commandPayload: effectivePayload,
                reason: 'stale_state',
                expectedStateID: options.expectedStateID,
                stateID: stateIdBefore,
                progressMarker: progressMarkerBeforeCommand,
                onlineAiAttemptKey: options?.onlineAiAttemptKey,
                clientTransport: options?.clientTransport,
            });
            logger.warn('[GameTransport] online AI command rejected due to stale state precondition', {
                matchID: match.matchID,
                gameId: engineConfig.gameId,
                playerID,
                commandType: effectiveCommandType,
                commandPayload: cloneDiagnosticValue(effectivePayload),
                expectedStateID: options.expectedStateID,
                actualStateID: stateIdBefore,
                onlineAiAttemptKey: options?.onlineAiAttemptKey ?? null,
                clientTransport: options?.clientTransport ?? null,
                circuitFailureCount: circuitSnapshot.failureCount,
                circuitTripped: circuitSnapshot.tripped,
            });

            const nsp = this.io.of('/game');
            const sockets = match.connections.get(playerID);
            if (sockets) {
                for (const sid of sockets) {
                    nsp.to(sid).emit('error', match.matchID, 'stale_state');
                }
            }
            return false;
        }

        if (
            onlineAiSeatControllerType === 'human'
            && typeof options?.expectedStateID === 'number'
            && options.expectedStateID !== stateIdBefore
        ) {
            match.lastCommandFailureReason = 'stale_state';
            logger.warn('[GameTransport] human command rejected due to stale state precondition', {
                matchID: match.matchID,
                gameId: engineConfig.gameId,
                playerID,
                commandType: effectiveCommandType,
                commandPayload: cloneDiagnosticValue(effectivePayload),
                expectedStateID: options.expectedStateID,
                actualStateID: stateIdBefore,
            });

            const nsp = this.io.of('/game');
            const sockets = match.connections.get(playerID);
            if (sockets) {
                for (const sid of sockets) {
                    nsp.to(sid).emit('error', match.matchID, 'stale_state');
                }
            }
            return false;
        }

        const execution = this.authoritativeCommandExecutor.execute({
            engineConfig,
            state,
            random,
            playerIds,
            playerId: playerID,
            commandType: effectiveCommandType,
            payload: effectivePayload,
            seatControllerType,
            preCommandSeatView: preTrainingState,
        });
        effectiveCommandType = execution.command.type;
        effectivePayload = execution.command.payload;

        if (!execution.success) {
            const failureReason = execution.failureReason;
            match.lastCommandFailureReason = failureReason;
            if (onlineAiSeatControllerType !== 'human') {
                await this.recordOnlineAiCircuitFailure({
                    match,
                    playerId: playerID,
                    source: onlineAiCircuitSource,
                    commandType: effectiveCommandType,
                    commandPayload: effectivePayload,
                    reason: failureReason,
                    expectedStateID: options?.expectedStateID,
                    stateID: stateIdBefore,
                    progressMarker: progressMarkerBeforeCommand,
                    onlineAiAttemptKey: options?.onlineAiAttemptKey,
                    clientTransport: options?.clientTransport,
                });
            }
            gameLogger.commandFailed(
                match.matchID,
                commandType,
                playerID,
                execution.error,
                {
                    gameId: engineConfig.gameId,
                    stateIDBefore: stateIdBefore,
                    progressMarker: progressMarkerBeforeCommand,
                    feedbackSource,
                    commandPayload: cloneDiagnosticValue(effectivePayload),
                },
            );

            // 通知发送者
            const nsp = this.io.of('/game');
            const sockets = match.connections.get(playerID);
            if (sockets) {
                for (const sid of sockets) {
                    nsp.to(sid).emit('error', match.matchID, failureReason);
                }
            }

            if (options?.reportFailureFeedback && shouldAutoReportCommandFailure(failureReason, feedbackSource)) {
                await this.reportCommandFailureFeedback(this.buildCommandFailureFeedbackPayload({
                    match,
                    playerId: playerID,
                    commandType: effectiveCommandType,
                    reason: failureReason,
                    commandPayload: effectivePayload,
                    progressMarker: progressMarkerBeforeCommand,
                    stateIdBefore,
                    visibleState: preTrainingState,
                    feedbackSource,
                }));
            }
            if (
                execution.kind === 'pipeline-exception'
                && effectiveCommandType !== INTERACTION_COMMANDS.CANCEL
            ) {
                // 自动取消 pending interaction（防止游戏卡死）
                // 但如果当前命令本身就是 CANCEL，不能再次递归触发取消.
                await this.cancelInteractionOnError(match, playerID);
                match.lastCommandFailureReason = failureReason;
            }
            return false;
        }

        const result = execution.result;
        const duration = execution.durationMs;
        match.lastCommandFailureReason = null;

        // 记录成功日志
        gameLogger.commandExecuted(match.matchID, effectiveCommandType, playerID, duration);

        // 记录游戏声明的关键事件（用于 bug 追溯）
        let unsatisfiableInteractionFeedback: OnlineAiRecoveryFeedbackPayload | null = null;
        for (const event of result.events) {
            const eventType = (event as GameEvent).type;
            const telemetry = engineConfig.eventTelemetry?.(event as GameEvent);
            if (telemetry) {
                logger.info('game_event', {
                    matchID: match.matchID,
                    gameId: engineConfig.gameId,
                    ...telemetry,
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
                if (isOnlineAiUnsatisfiableInteractionReason(reason)) {
                    const interaction = extractAiInteractionSnapshot(preTrainingState);
                    const sharedInteraction = extractAiInteractionSnapshot(match.state);
                    const sharedSelectability = buildInteractionSelectabilityDiagnostic(sharedInteraction);
                    const seatSelectability = buildInteractionSelectabilityDiagnostic(interaction);
                    const shouldSuppressByDefault = shouldSuppressUnsatisfiableInteractionFeedback({
                        sharedInteraction,
                        seatInteraction: interaction,
                        sharedSelectability,
                        seatSelectability,
                    });
                    const shouldSuppressByGame = engineConfig.onlineAiRecovery?.shouldSuppressUnsatisfiableInteractionFeedback?.({
                        state: preTrainingState,
                        phase: typeof preTrainingState.sys?.phase === 'string'
                            ? preTrainingState.sys.phase
                            : typeof match.state.sys?.phase === 'string'
                                ? match.state.sys.phase
                                : '',
                        playerId: playerID,
                        reason,
                        sharedInteraction,
                        seatInteraction: interaction,
                        sharedSelectability,
                        seatSelectability,
                    }) === true;
                    if (shouldSuppressByDefault || shouldSuppressByGame) {
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
                        actionLog: buildOnlineAiDiagnosticActionLog({
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

        const commitResult = await commitAuthoritativeCommandSuccess({
            match,
            playerId: playerID,
            commandType: effectiveCommandType,
            nextState: result.state,
            createTrackedRandom,
            persistState: (storedState) => this.storage.setState(match.matchID, storedState),
            onCommandSucceeded: this.onCommandSucceeded,
            logRandomCursorRestored: (restoredCursor) => {
                logger.info('[UndoServer] random-cursor-restored', {
                    matchID: match.matchID,
                    restoredCursor,
                });
            },
        });

        if (!commitResult.committed) {
            return false;
        }

        const gameOver = commitResult.gameOver;
        const postTrainingState = this.stripStateForTraining(this.applyPlayerView(match, playerID)) as MatchState<unknown>;
        this.trainingDataCapture.recordDecisionSample({
            match: {
                matchID: match.matchID,
                gameId: match.engineConfig.gameId,
                metadata: match.metadata,
            },
            playerID,
            commandType: effectiveCommandType,
            payload: effectivePayload,
            stateIdBefore,
            stateIdAfter: commitResult.stateIdAfter,
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
            this.onlineAiCircuitBreaker.clearMatch(match.matchID);
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
        if (!commandType) return;

        // 离线裁决必须与玩家命令共用同一串行通道，避免并发写状态
        await this.handleCommand(match.matchID, playerID, commandType, {});
    }

    private broadcastState(match: ActiveMatch): void {
        broadcastProjectedMatchState({ io: this.io, match });
    }

    private applyPlayerView(match: ActiveMatch, playerID: string | null): unknown {
        return applyMatchPlayerView(match, playerID);
    }

    private buildMatchPlayers(match: ActiveMatch): MatchPlayerInfo[] {
        return buildTransportMatchPlayers(match);
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
