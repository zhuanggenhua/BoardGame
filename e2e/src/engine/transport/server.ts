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
} from './protocol';
import type { TrainingDataRecorder, TrainingDecisionSample } from './trainingData';
import { buildTrainingDecisionSample } from './trainingData';
import logger, { gameLogger } from '../../../server/logger.js';
import { GAME_MANIFEST_BY_ID } from '../../games/manifest';
import * as aiModule from '../ai';
import { applyPlayerViewToState, buildAiDecisionContext, getAiSeatIds, getGameAiRuntime, resolveOnlineAiDecisionView } from '../ai';
import { extractAiInteractionSnapshot, extractAiResponseWindowSnapshot } from '../ai/snapshots';
import type { AiInteractionSnapshot, AiInteractionOptionSnapshot } from '../ai/types';
import {
    executePipeline,
    createSeededRandom,
    createInitialSystemState,
    type PipelineConfig,
} from '../pipeline';
import { INTERACTION_COMMANDS, INTERACTION_EVENTS } from '../systems/InteractionSystem';
import { setUndoAiSeatIds } from '../systems/UndoSystem';
import { computeDiff } from './patch';
import {
    applyAiAutoRecoveryRejection,
    buildAiProgressMarker,
    resolveCurrentPlayerId,
    resolveUnsatisfiableReasonFromInteraction,
    resolveForceEndTurnForStalledAi,
    type AiAutoRecoveryAttemptTracker,
    type HiddenInteractionDescriptor,
    type ForceEndTurnStalledAiResolution,
} from './onlineAiRecovery';

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

const shouldTrustOnlineAiSeatControllersForWatchdog = (setupData: unknown): boolean => {
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

const DEFAULT_TRAINING_CAPTURE_POLICY = 'human-only' as const;
const DEFAULT_ONLINE_AI_RECOVERY_TICK_MS = 500;
const DEFAULT_ONLINE_AI_RECOVERY_TIMEOUT_MS = 8000;
const DEFAULT_ONLINE_AI_RECOVERY_MAX_ADVANCE_STEPS = 16;
const DEFAULT_ONLINE_AI_RECOVERY_FEEDBACK_COOLDOWN_MS = 60_000;
const DEFAULT_ONLINE_AI_RECOVERY_FAILURE_REPORT_THRESHOLD = 2;
const DEFAULT_ONLINE_AI_OVERLAY_RESYNC_COOLDOWN_MS = 1_500;
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

type InteractionSelectabilityDiagnostic = {
    totalOptions: number;
    enabledOptions: number;
    disabledOptions: number;
    minSelectionCount: number;
    enabledOptionIds: string[];
    disabledOptionIds: string[];
    recoverableOptionIds: string[];
    selectionState:
        | 'no-options'
        | 'all-options-disabled'
        | 'recoverable-option-available'
        | 'manual-selection-required';
};

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

const isRecoverableInteractionOption = (option: AiInteractionOptionSnapshot): boolean => {
    const value = option.value as {
        skip?: unknown;
        __cancel__?: unknown;
        done?: unknown;
        __emergency_skip__?: unknown;
    } | undefined;

    return option.id === 'skip'
        || option.id === '__cancel__'
        || option.id === 'done'
        || option.id === '__emergency_skip__'
        || value?.skip === true
        || value?.__cancel__ === true
        || value?.done === true
        || value?.__emergency_skip__ === true;
};

const buildInteractionSelectabilityDiagnostic = (
    snapshot: AiInteractionSnapshot | null | undefined,
): InteractionSelectabilityDiagnostic | null => {
    if (!snapshot) {
        return null;
    }

    const options = Array.isArray(snapshot.options) ? snapshot.options : [];
    const enabledOptions = options.filter((option) => option.disabled !== true);
    const disabledOptions = options.filter((option) => option.disabled === true);
    const multi = snapshot.multi as { min?: unknown } | undefined;
    const minSelectionCount = typeof multi?.min === 'number' ? multi.min : 1;
    const recoverableOptionIds = minSelectionCount === 0
        ? ['__empty_selection__']
        : enabledOptions.filter(isRecoverableInteractionOption).map((option) => option.id);

    const selectionState: InteractionSelectabilityDiagnostic['selectionState'] = options.length === 0
        ? 'no-options'
        : enabledOptions.length === 0
            ? 'all-options-disabled'
            : recoverableOptionIds.length > 0
                ? 'recoverable-option-available'
                : 'manual-selection-required';

    return {
        totalOptions: options.length,
        enabledOptions: enabledOptions.length,
        disabledOptions: disabledOptions.length,
        minSelectionCount,
        enabledOptionIds: enabledOptions.map((option) => option.id),
        disabledOptionIds: disabledOptions.map((option) => option.id),
        recoverableOptionIds,
        selectionState,
    };
};

const resolveUnsatisfiableReasonFromSelectability = (
    snapshot: AiInteractionSnapshot | null | undefined,
): string | null => {
    const diagnostic = buildInteractionSelectabilityDiagnostic(snapshot);
    if (!diagnostic) {
        return null;
    }
    if (diagnostic.totalOptions === 0) {
        return 'empty-options';
    }
    if (diagnostic.enabledOptions === 0) {
        return 'all-options-disabled';
    }
    if (diagnostic.minSelectionCount > 0 && diagnostic.enabledOptions < diagnostic.minSelectionCount) {
        return 'min-selection-unreachable';
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
        resolve: (success: boolean) => void;
    } | {
        /** batch 任务标记 */
        _batch: true;
        execute: () => Promise<void>;
        resolve: (success: boolean) => void;
    }>;
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
    trainingDataRecorder?: TrainingDataRecorder;
    trainingDataMinMatchDurationMs?: number;
    rulesVersion?: string | null;
    onlineAiRecoveryTickMs?: number;
    onlineAiRecoveryTimeoutMs?: number;
    onlineAiRecoveryMaxAdvanceSteps?: number;
    onlineAiRecoveryFeedbackCooldownMs?: number;
    onlineAiRecoveryFailureReportThreshold?: number;
    onlineAiFeedbackReporter?: (payload: OnlineAiRecoveryFeedbackPayload) => Promise<void>;
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
    private readonly onlineAiRecoveryTickMs: number;
    private readonly onlineAiRecoveryTimeoutMs: number;
    private readonly onlineAiRecoveryMaxAdvanceSteps: number;
    private readonly onlineAiRecoveryFeedbackCooldownMs: number;
    private readonly onlineAiRecoveryFailureReportThreshold: number;
    private readonly onlineAiFeedbackReporter?: GameTransportServerConfig['onlineAiFeedbackReporter'];
    private readonly onlineAiRecoveryTrackers = new Map<string, OnlineAiRecoveryTracker>();
    private readonly onlineAiRecoveryFeedbackCooldown = new Map<string, number>();
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
        this.onlineAiRecoveryTickMs = config.onlineAiRecoveryTickMs ?? DEFAULT_ONLINE_AI_RECOVERY_TICK_MS;
        this.onlineAiRecoveryTimeoutMs = config.onlineAiRecoveryTimeoutMs ?? DEFAULT_ONLINE_AI_RECOVERY_TIMEOUT_MS;
        this.onlineAiRecoveryMaxAdvanceSteps = config.onlineAiRecoveryMaxAdvanceSteps ?? DEFAULT_ONLINE_AI_RECOVERY_MAX_ADVANCE_STEPS;
        this.onlineAiRecoveryFeedbackCooldownMs = config.onlineAiRecoveryFeedbackCooldownMs ?? DEFAULT_ONLINE_AI_RECOVERY_FEEDBACK_COOLDOWN_MS;
        this.onlineAiRecoveryFailureReportThreshold = config.onlineAiRecoveryFailureReportThreshold ?? DEFAULT_ONLINE_AI_RECOVERY_FAILURE_REPORT_THRESHOLD;
        this.onlineAiFeedbackReporter = config.onlineAiFeedbackReporter;
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
                await this.handleCommand(matchID, resolvedPlayerId, commandType, normalizedPayload);
            });

            socket.on('batch', async (
                matchID: string,
                batchId: string,
                commands: Array<{ type: string; payload: unknown }>,
                credentials?: string,
            ) => {
                if (!matchID || !batchId || !Array.isArray(commands)) return;
                const info = this.socketIndex.get(socket.id);
                if (!info || info.matchID !== matchID || !info.playerID) return;
                const authorized = await this.validateCommandAuth(matchID, info.playerID, info.credentials ?? credentials);
                if (!authorized) {
                    socket.emit('batch:rejected', matchID, batchId, 'unauthorized');
                    return;
                }
                await this.handleBatch(socket, matchID, info.playerID, batchId, commands);
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

        const trackedRandom = createTrackedRandom(seed, 0);
        const core = engineConfig.domain.setup(playerIds, trackedRandom.random, setupData);
        const sys = createInitialSystemState(
            playerIds,
            engineConfig.systems as EngineSystem[],
            matchID,
        );
        const state = setUndoAiSeatIds(
            { sys, core },
            getAiSeatIds(extractSetupSeatControllers(setupData)),
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
                    sockets.forEach((s) => s.disconnect(true));
                })
                .catch((error) => {
                    logger.warn('[GameTransport] disconnect room sockets failed', { matchID, error });
                });
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

            const rawSeatControllers = shouldTrustOnlineAiSeatControllersForWatchdog(match.metadata.setupData)
                ? extractSetupSeatControllers(match.metadata.setupData)
                : undefined;
            const seatControllers = Object.fromEntries(
                Object.keys(match.metadata.players).map((playerId) => {
                    const controller = rawSeatControllers?.[playerId];
                    return [
                        playerId,
                        controller?.type === 'local-ai' || controller?.type === 'remote-ai'
                            ? controller as { type: 'local-ai' | 'remote-ai' }
                            : { type: 'human' },
                    ];
                }),
            ) as Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>;

            const hasAiSeat = Object.values(seatControllers).some((controller) => controller.type !== 'human');
            if (!hasAiSeat) {
                this.onlineAiRecoveryTrackers.delete(match.matchID);
                continue;
            }

            // 注意：服务端 watchdog 默认只依赖 authoritative shared state。
            // 但某些游戏/实现可能会把“隐藏交互”做成：sharedState.sys.interaction.current === null 且 isBlocked === true，
            // 真实交互只在 playerView（AI seat）里可见。
            // 为了做到“即使 AI seat 未建连也能兜底收口”，这里在检测到疑似隐藏交互阻塞时，
            // 为每个 AI seat 构造一次 playerView 并透传给 resolveForceEndTurnForStalledAi。
            const interactionState = match.state.sys?.interaction as { current?: unknown; isBlocked?: unknown } | undefined;
            const needsSeatStates = interactionState?.current == null && interactionState?.isBlocked === true;
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
            });
            if (!candidate) {
                this.onlineAiRecoveryTrackers.delete(match.matchID);
                continue;
            }

            let effectiveCandidate = candidate;
            const currentWindow = (match.state.sys as { responseWindow?: { current?: unknown } } | undefined)
                ?.responseWindow?.current as {
                    responderQueue?: unknown;
                    currentResponderIndex?: unknown;
                    windowType?: unknown;
                    sourceId?: unknown;
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
            const phase = typeof match.state.sys?.phase === 'string' ? match.state.sys.phase : '';
            const windowType = typeof currentWindow?.windowType === 'string' ? currentWindow.windowType : '';
            const queueSignature = responderQueue
                .map((value) => (typeof value === 'string' ? value : ''))
                .filter((value) => value.length > 0)
                .join('|');
            const isAiTurnBlockedByHumanResponseWindow = candidate.reason === 'active-turn'
                && Boolean(currentWindow)
                && resolveCurrentPlayerId(match.state) === candidate.playerId
                && typeof currentResponderId === 'string'
                && seatControllers[currentResponderId]?.type === 'human';

            if (isAiTurnBlockedByHumanResponseWindow) {
                const suffix = `response-window-human:${candidate.playerId}:${currentResponderId}:${phase}:${windowType}:${queueSignature}`;
                effectiveCandidate = {
                    ...candidate,
                    reason: 'response-window',
                    requiresConfirmedAdvancePhase: true,
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
            }

            const progressMarker = buildAiProgressMarker(match.state);
            const recoveryFingerprint = this.buildOnlineAiRecoveryFingerprint(match, effectiveCandidate, progressMarker);
            const trackerKey = `${effectiveCandidate.playerId}:${effectiveCandidate.reason}:${recoveryFingerprint}`;
            const currentTracker = this.onlineAiRecoveryTrackers.get(match.matchID);

            if (effectiveCandidate.reason === 'response-window' && currentTracker?.key === trackerKey && currentTracker.failureCount > 0) {
                if (!hasHumanResponder) {
                    const responderId = currentResponderId ?? candidate.playerId;
                    const suffix = `response-loop:${responderId}:${phase}:${windowType}:${queueSignature}`;
                    effectiveCandidate = {
                        ...effectiveCandidate,
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
                }
            }

            if (!currentTracker || currentTracker.key !== trackerKey) {
                this.onlineAiRecoveryTrackers.set(match.matchID, {
                    key: trackerKey,
                    firstSeenAt: now,
                    autoSubmittedAt: null,
                    lastReportedFailureReason: null,
                    failureCount: 0,
                });
                continue;
            }

            if (currentTracker.autoSubmittedAt || now - currentTracker.firstSeenAt < this.onlineAiRecoveryTimeoutMs) {
                continue;
            }

            currentTracker.autoSubmittedAt = now;
            this.onlineAiRecoveryInFlight.add(match.matchID);
            void this.runOnlineAiRecoverySequence(match, currentTracker, effectiveCandidate, progressMarker, seatControllers)
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
        seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
    ): Promise<void> {
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
        const resolveChainedRecoveryCandidate = (expectedPlayerId: string): ForceEndTurnStalledAiResolution | null => {
            const interactionState = match.state.sys?.interaction as { current?: unknown; isBlocked?: unknown } | undefined;
            const needsSeatStates = interactionState?.current == null && interactionState?.isBlocked === true;
            const seatStates: Record<string, MatchState<unknown> | null | undefined> = needsSeatStates
                ? Object.fromEntries(
                    Object.entries(seatControllers)
                        .filter(([, controller]) => controller.type !== 'human')
                        .map(([playerId]) => [playerId, this.applyPlayerView(match, playerId) as MatchState<unknown>]),
                )
                : {};
            const nextCandidate = resolveForceEndTurnForStalledAi({
                sharedState: match.state,
                seatControllers,
                seatStates,
            });
            if (!nextCandidate || nextCandidate.playerId !== expectedPlayerId) {
                return nextCandidate;
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
            const isAiTurnBlockedByHumanResponseWindow = nextCandidate.reason === 'active-turn'
                && Boolean(currentWindow)
                && resolveCurrentPlayerId(match.state) === nextCandidate.playerId
                && typeof currentResponderId === 'string'
                && seatControllers[currentResponderId]?.type === 'human';

            if (!isAiTurnBlockedByHumanResponseWindow) {
                return nextCandidate;
            }

            const phase = typeof match.state.sys?.phase === 'string' ? match.state.sys.phase : '';
            const windowType = typeof currentWindow?.windowType === 'string' ? currentWindow.windowType : '';
            const queueSignature = responderQueue
                .map((value) => (typeof value === 'string' ? value : ''))
                .filter((value) => value.length > 0)
                .join('|');
            const suffix = `response-window-human:${nextCandidate.playerId}:${currentResponderId}:${phase}:${windowType}:${queueSignature}`;
            return {
                ...nextCandidate,
                reason: 'response-window',
                requiresConfirmedAdvancePhase: true,
                fingerprintHint: suffix,
                resolution: {
                    playerId: nextCandidate.playerId,
                    attemptKey: `force-end-turn:${nextCandidate.playerId}:${suffix}`,
                    source: 'local-ai',
                    action: {
                        actionId: `force-end-turn:${suffix}`,
                        kind: 'force-end-turn',
                        label: '强制结束 AI 回合',
                        commands: [{ type: 'SYS_RESPONSE_WINDOW_FORCE_CLOSE', payload: {} }],
                    },
                },
            };
        };

        let currentCandidate = candidate;
        let phaseLabel = currentCandidate.requiresConfirmedAdvancePhase ? 'recover-interaction' : 'follow-up-advance';
        let totalAdvanceSteps = 0;
        let usedForcedRecoveryCommand = false;

        try {
            const seenMarkers = new Set<string>([progressMarkerBeforeRecovery]);
            let recoverySteps = 0;
            let allowNaturalAiContinuation = false;

            while (recoverySteps <= this.onlineAiRecoveryMaxAdvanceSteps) {
                phaseLabel = currentCandidate.requiresConfirmedAdvancePhase ? 'recover-interaction' : 'follow-up-advance';
                const markerBeforeStep = buildAiProgressMarker(match.state);
                const actionRecovery = await this.tryRecoverOnlineAiWithLegalAction(
                    match,
                    currentCandidate,
                    tracker,
                    seatControllers,
                );
                const actionRecoveryApplied = actionRecovery.applied;

                if (!actionRecoveryApplied) {
                    const recoveryCommands = currentCandidate.resolution.action.commands;
                    if (currentCandidate.legalActionOnly === true || recoveryCommands.length === 0) {
                        const legalActionUnavailableReason = actionRecovery.blockedReason === 'stale-private-overlay'
                            ? 'private_overlay_stale'
                            : actionRecovery.blockedReason === 'missing-private-overlay'
                                ? 'private_overlay_missing'
                                : actionRecovery.blockedReason === 'missing-visible-state'
                                    ? 'missing_visible_state'
                                    : 'legal_action_unavailable';
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
                    const nextCommand = mapRecoveryCommand(recoveryCommands[0]);
                    const nextCommandType = nextCommand?.type ?? 'UNKNOWN';
                    const nextSuccess = await this.executeCommandInternal(
                        match,
                        currentCandidate.playerId,
                        nextCommandType,
                        nextCommand?.payload ?? {},
                    );
                    if (!nextSuccess) {
                        await this.handleOnlineAiRecoveryFailure(
                            match,
                            tracker,
                            currentCandidate,
                            phaseLabel,
                            progressMarkerBeforeRecovery,
                            'command_failed',
                        );
                        return;
                    }

                    if (nextCommandType === advancePhaseCommandType) {
                        totalAdvanceSteps += 1;
                    }
                }

                recoverySteps += 1;
                const nextMarker = buildAiProgressMarker(match.state);
                if (nextMarker === markerBeforeStep) {
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
                if (seenMarkers.has(nextMarker)) {
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
                seenMarkers.add(nextMarker);

                const nextCandidate = resolveChainedRecoveryCandidate(candidate.playerId);
                if (!nextCandidate || nextCandidate.playerId !== candidate.playerId) {
                    break;
                }
                const shouldRestrictFollowUpToLegalActions = candidate.requiresConfirmedAdvancePhase
                    && (candidate.reason === 'visible-interaction' || candidate.reason === 'hidden-interaction')
                    && nextCandidate.reason === 'active-turn';
                const normalizedNextCandidate = shouldRestrictFollowUpToLegalActions
                    ? {
                        ...nextCandidate,
                        legalActionOnly: true,
                        resolution: {
                            ...nextCandidate.resolution,
                            action: {
                                ...nextCandidate.resolution.action,
                                commands: [],
                            },
                        },
                    }
                    : nextCandidate;
                const hasLiveSeatConnection = (match.connections.get(candidate.playerId)?.size ?? 0) > 0;
                // 仅在 AI seat 在线时才交给自然链路继续；离线时需继续 watchdog 收口，避免停在 AI 半回合。
                if (actionRecoveryApplied && normalizedNextCandidate.reason === 'active-turn' && hasLiveSeatConnection) {
                    allowNaturalAiContinuation = true;
                    break;
                }
                currentCandidate = normalizedNextCandidate;
            }

            const markerAfterRecovery = buildAiProgressMarker(match.state);
            const unresolvedCandidate = allowNaturalAiContinuation
                ? null
                : resolveChainedRecoveryCandidate(candidate.playerId);
            if (unresolvedCandidate?.playerId === candidate.playerId) {
                await this.handleOnlineAiRecoveryFailure(
                    match,
                    tracker,
                    unresolvedCandidate,
                    unresolvedCandidate.requiresConfirmedAdvancePhase ? 'recover-interaction' : 'follow-up-advance',
                    progressMarkerBeforeRecovery,
                    'blocker_persisted',
                );
                return;
            }
            if (markerAfterRecovery === progressMarkerBeforeRecovery) {
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

            logger.warn('[GameTransport] online-ai-watchdog recovered stalled AI', {
                matchID: match.matchID,
                gameId: match.gameId,
                playerID: candidate.playerId,
                reason: candidate.reason,
                advanceSteps: totalAdvanceSteps,
                markerBefore: progressMarkerBeforeRecovery,
                markerAfter: markerAfterRecovery,
            });

            this.onlineAiRecoveryTrackers.delete(match.matchID);
            if (!usedForcedRecoveryCommand) {
                return;
            }
            await this.reportOnlineAiRecoveryFeedback({
                matchId: match.matchID,
                gameId: match.gameId,
                playerId: candidate.playerId,
                incidentKind: 'force-end-turn-success',
                severity: 'medium',
                status: 'resolved',
                reason: `${candidate.reason}:${phaseLabel}:steps=${totalAdvanceSteps}`,
                trackerKey: tracker.key,
                progressMarker: progressMarkerBeforeRecovery,
                stateSnapshot: await this.buildOnlineAiRecoveryStateSnapshot(match, candidate, progressMarkerBeforeRecovery),
                actionLog: this.buildOnlineAiRecoveryActionLog(match),
            });
        } finally {
            await this.drainCommandQueue(match);
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
            markerAfter: buildAiProgressMarker(match.state),
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
                stateSnapshot: await this.buildOnlineAiRecoveryStateSnapshot(match, candidate, progressMarkerBeforeRecovery),
                actionLog: this.buildOnlineAiRecoveryActionLog(match),
            });
        }
    }

    private async buildOnlineAiRecoveryStateSnapshot(
        match: ActiveMatch,
        candidate: ForceEndTurnStalledAiResolution,
        progressMarker: string,
    ): Promise<string> {
        const interactionState = match.state.sys?.interaction as { isBlocked?: unknown } | undefined;
        const sharedInteraction = extractAiInteractionSnapshot(match.state);
        const seatView = this.applyPlayerView(match, candidate.playerId) as MatchState<unknown>;
        const seatInteraction = extractAiInteractionSnapshot(seatView);
        const sharedInteractionState = (match.state.sys?.interaction as { current?: unknown } | undefined)?.current;
        const seatInteractionState = (seatView.sys?.interaction as { current?: unknown } | undefined)?.current;
        const responseWindow = extractAiResponseWindowSnapshot(match.state);
        const pendingDamage = (match.state.core as {
            pendingDamage?: {
                id?: unknown;
                responderId?: unknown;
                responseType?: unknown;
                currentDamage?: unknown;
                sourceAbilityId?: unknown;
                tokenUsageTotals?: unknown;
            };
        } | undefined)?.pendingDamage;
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

        return JSON.stringify({
            matchId: match.matchID,
            gameId: match.gameId,
            playerId: candidate.playerId,
            reason: candidate.reason,
            phase: match.state.sys?.phase ?? null,
            turnNumber: match.state.sys?.turnNumber ?? null,
            currentPlayerId: resolveCurrentPlayerId(match.state),
            progressMarker,
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
            pendingDamage: pendingDamage ? {
                id: pendingDamage.id ?? null,
                responderId: pendingDamage.responderId ?? null,
                responseType: pendingDamage.responseType ?? null,
                currentDamage: pendingDamage.currentDamage ?? null,
                sourceAbilityId: pendingDamage.sourceAbilityId ?? null,
                tokenUsageTotals: pendingDamage.tokenUsageTotals ?? null,
            } : null,
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

    private buildOnlineAiRecoveryActionLog(match: ActiveMatch): string | undefined {
        const entries = (match.state.sys?.actionLog as { entries?: Array<{ text?: unknown; event?: { type?: unknown } }> } | undefined)?.entries;
        if (!Array.isArray(entries) || entries.length === 0) {
            return undefined;
        }
        const tail = entries.slice(-5).map((entry) => ({
            text: typeof entry?.text === 'string' ? entry.text : undefined,
            type: entry?.event?.type,
        }));
        return JSON.stringify(tail);
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

        if (candidate.reason === 'visible-interaction' || candidate.reason === 'hidden-interaction') {
            const current = (match.state.sys as { interaction?: { current?: unknown } } | undefined)?.interaction?.current as {
                id?: unknown;
                playerId?: unknown;
                kind?: unknown;
                data?: {
                    title?: unknown;
                    sourceId?: unknown;
                    multi?: { min?: unknown };
                    options?: Array<{ id?: unknown }>;
                    type?: unknown;
                    targetPlayerIds?: unknown;
                    requiresTargetWithStatus?: unknown;
                    transferConfig?: { statusId?: unknown };
                };
            } | undefined;
            const playerId = typeof current?.playerId === 'string' ? current.playerId : candidate.playerId;
            const kind = typeof current?.kind === 'string' ? current.kind : 'interaction';

            if (kind === 'simple-choice') {
                const title = typeof current?.data?.title === 'string' ? current?.data?.title : '';
                const sourceId = typeof current?.data?.sourceId === 'string' ? current?.data?.sourceId : '';
                const minCount = typeof current?.data?.multi?.min === 'number' ? current?.data?.multi?.min : '';
                const optionCount = Array.isArray(current?.data?.options) ? current?.data?.options?.length : '';
                return `interaction:${playerId}:${phase}:simple-choice:${sourceId}:${title}:${minCount}:${optionCount}`;
            }

            if (kind === 'dt:card-interaction') {
                const interactionType = typeof current?.data?.type === 'string' ? current?.data?.type : '';
                const targetCount = Array.isArray(current?.data?.targetPlayerIds) ? current?.data?.targetPlayerIds?.length : '';
                const requiresStatus = current?.data?.requiresTargetWithStatus ? '1' : '0';
                const transferStatusId = typeof current?.data?.transferConfig?.statusId === 'string'
                    ? current?.data?.transferConfig?.statusId
                    : '';
                return `interaction:${playerId}:${phase}:dt-card:${interactionType}:${targetCount}:${requiresStatus}:${transferStatusId}`;
            }

            const interactionId = typeof current?.id === 'string' ? current?.id : '';
            return `interaction:${playerId}:${phase}:${kind}:${interactionId}`;
        }

        if (candidate.reason === 'response-window' || candidate.reason === 'response-loop') {
            const current = (match.state.sys as { responseWindow?: { current?: unknown } } | undefined)?.responseWindow?.current as {
                id?: unknown;
                windowType?: unknown;
                responderQueue?: unknown;
                currentResponderIndex?: unknown;
            } | undefined;
            if (current) {
                const windowType = typeof current?.windowType === 'string' ? current.windowType : '';
                const responderQueue = Array.isArray(current?.responderQueue) ? current?.responderQueue : [];
                const responderIndex = typeof current?.currentResponderIndex === 'number' ? current.currentResponderIndex : 0;
                const responderId = typeof responderQueue[responderIndex] === 'string'
                    ? responderQueue[responderIndex]
                    : candidate.playerId;
                const queueSignature = responderQueue
                    .map((value) => (typeof value === 'string' ? value : ''))
                    .filter((value) => value.length > 0)
                    .join('|');
                return `${candidate.reason}:${responderId}:${phase}:${windowType}:${queueSignature}`;
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

    private hasOnlineAiRecoveryResolved(
        match: ActiveMatch,
        candidate: ForceEndTurnStalledAiResolution,
        seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
    ): boolean {
        if (candidate.legalActionOnly === true) {
            return resolveCurrentPlayerId(match.state) !== candidate.playerId
                || match.state.sys?.phase !== 'factionSelect';
        }

        if (candidate.reason === 'visible-interaction') {
            const current = (match.state.sys?.interaction as { current?: { playerId?: unknown } } | undefined)?.current;
            return String(current?.playerId ?? '') !== candidate.playerId;
        }

        if (candidate.reason === 'hidden-interaction') {
            const sharedInteraction = match.state.sys?.interaction as { current?: unknown; isBlocked?: unknown } | undefined;
            const seatView = this.applyPlayerView(match, candidate.playerId) as MatchState<unknown>;
            const seatInteraction = seatView.sys?.interaction as { current?: { playerId?: unknown }; isBlocked?: unknown } | undefined;

            if (sharedInteraction?.current) {
                const sharedCurrent = sharedInteraction.current as { playerId?: unknown } | undefined;
                if (String(sharedCurrent?.playerId ?? '') === candidate.playerId) {
                    return false;
                }
            }

            if (seatInteraction?.current) {
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
        const interaction = extractAiInteractionSnapshot(preCommandSeatView);
        const responseWindow = extractAiResponseWindowSnapshot(preCommandSeatView);
        const aiSummary = await this.buildOnlineAiRecoveryAiSummary(match, playerId, preCommandSeatView);
        const seatUnsatisfiableReasonDetailed = resolveUnsatisfiableReasonFromInteraction(
            preCommandSeatView,
            (preCommandSeatView.sys?.interaction as { current?: unknown } | undefined)?.current as HiddenInteractionDescriptor | undefined,
        );
        const seatUnsatisfiableReason = reason
            ?? resolveUnsatisfiableReasonFromSelectability(interaction)
            ?? seatUnsatisfiableReasonDetailed;

        return JSON.stringify({
            matchId: match.matchID,
            gameId: match.gameId,
            playerId,
            reason,
            commandType,
            phase: preCommandSeatView.sys?.phase ?? match.state.sys?.phase ?? null,
            turnNumber: preCommandSeatView.sys?.turnNumber ?? match.state.sys?.turnNumber ?? null,
            currentPlayerId: resolveCurrentPlayerId(preCommandSeatView),
            progressMarker: progressMarkerBefore,
            interaction: {
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
        const dedupeKey = `${payload.matchId}:${payload.playerId}:${payload.incidentKind}:${payload.trackerKey}`;
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

    private async defaultOnlineAiFeedbackReporter(payload: OnlineAiRecoveryFeedbackPayload): Promise<void> {
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
            body: JSON.stringify({
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
            }),
        });
        if (!response.ok) {
            throw new Error(`feedback_http_${response.status}`);
        }
    }

    private async tryRecoverOnlineAiWithLegalAction(
        match: ActiveMatch,
        candidate: ForceEndTurnStalledAiResolution,
        tracker: OnlineAiRecoveryTracker,
        seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
    ): Promise<{
        applied: boolean;
        blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay' | null;
    }> {
        const seatController = seatControllers[candidate.playerId];
        if (!seatController || seatController.type === 'human') {
            return { applied: false, blockedReason: null };
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

        const canUseEmergencyOverlayFallback = candidate.reason === 'active-turn'
            || candidate.reason === 'visible-interaction'
            || candidate.reason === 'hidden-interaction';
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
                if (aiDispatchResult.visibility === 'private-required'
                    && (aiDispatchResult.blockedReason === 'stale-private-overlay'
                        || aiDispatchResult.blockedReason === 'missing-private-overlay')) {
                    this.maybeTriggerOnlineAiOverlayResync({
                        match,
                        playerId: aiDispatchResult.playerId,
                        blockedReason: aiDispatchResult.blockedReason,
                        blockedKey: aiDispatchResult.blockedKey,
                    });
                }
                return {
                    applied: false,
                    blockedReason: aiDispatchResult.blockedReason,
                };
            }
            return { applied: false, blockedReason: null };
        }

        const resolution = aiDispatchResult.resolution;
        if (resolution.playerId !== candidate.playerId || resolution.action.commands.length === 0) {
            return { applied: false, blockedReason: null };
        }

        const markerBefore = buildAiProgressMarker(match.state);
        for (const command of resolution.action.commands) {
            const success = await this.executeCommandInternal(
                match,
                resolution.playerId,
                command.type,
                command.payload,
                { suppressBroadcast: true },
            );
            if (!success) {
                tracker.autoSubmittedAt = null;
                return { applied: false, blockedReason: null };
            }
        }

        const markerAfter = buildAiProgressMarker(match.state);
        if (markerAfter === markerBefore) {
            tracker.autoSubmittedAt = null;
            return { applied: false, blockedReason: null };
        }

        // legal-action recovery 会串行执行 1..N 条命令，前面用 suppressBroadcast 合并中间态；
        // 一旦最终确实推进了权威状态，这里必须补发一次统一广播，否则房间前端看不到 watchdog 代打后的召唤/推进结果。
        this.broadcastState(match);

        const resolved = this.hasOnlineAiRecoveryResolved(match, candidate, seatControllers);
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

        if (resolved) {
            await this.reportOnlineAiRecoveryFeedback({
                matchId: match.matchID,
                gameId: match.gameId,
                playerId: resolution.playerId,
                incidentKind: 'legal-action-recovered',
                severity: 'medium',
                status: 'resolved',
                reason: `${candidate.reason}:legal-action:${resolution.action.kind}:${resolution.action.actionId}`,
                trackerKey: tracker.key,
                progressMarker: markerBefore,
                stateSnapshot: await this.buildOnlineAiRecoveryStateSnapshot(match, candidate, markerBefore),
                actionLog: this.buildOnlineAiRecoveryActionLog(match),
            });
        }

        return { applied: true, blockedReason: null };
    }

    private maybeTriggerOnlineAiOverlayResync(args: {
        match: ActiveMatch;
        playerId: string;
        blockedReason: 'missing-private-overlay' | 'stale-private-overlay';
        blockedKey: string;
    }): void {
        const now = Date.now();
        const cooldownKey = `${args.match.matchID}:${args.playerId}`;
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

    private async drainCommandQueue(match: ActiveMatch): Promise<void> {
        while (match.commandQueue.length > 0) {
            const next = match.commandQueue.shift()!;
            try {
                if ('_batch' in next) {
                    await next.execute();
                    next.resolve(true);
                } else {
                    const queuedSuccess = await this.executeCommandInternal(match, next.playerID, next.commandType, next.payload);
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
        // 重连同步时清空 eventStream entries，避免客户端重播历史事件
        const viewState = this.stripStateForTransport(
            this.applyPlayerView(match, playerID),
            { stripEventStream: true },
        );
        const matchPlayers = this.buildMatchPlayers(match);
        socket.emit('state:sync', matchID, viewState, matchPlayers, {
            seed: match.randomSeed,
            cursor: match.getRandomCursor(),
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
                    resolve,
                });
            });
        }

        match.executing = true;
        try {
            const success = await this.executeCommandInternal(match, playerID, commandType, payload);
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
    ): Promise<void> {
        const match = this.activeMatches.get(matchID);
        if (!match) {
            socket.emit('batch:rejected', matchID, batchId, 'match_not_found');
            return;
        }

        // 串行执行：如果正在执行，将整个 batch 任务排入队列（与 handleCommand 保持一致）
        if (match.executing) {
            await new Promise<void>((resolve) => {
                match.commandQueue.push({
                    _batch: true,
                    execute: () => this.executeBatchInternal(socket, match, playerID, batchId, commands),
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
            // 批次内命令串行执行（抑制中间广播，避免客户端收到中间状态导致动画重播）
            for (const cmd of commands) {
                const success = await this.executeCommandInternal(match, playerID, cmd.type, cmd.payload, { suppressBroadcast: true });
                if (!success) {
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
                    socket.emit('batch:rejected', matchID, batchId, 'command_failed');
                    return;
                }
            }

            // 批次成功 - 广播最终状态给所有玩家（包括对手），然后发送确认给发送者
            this.broadcastState(match);
            // batch:confirmed 是乐观更新的确认响应，客户端已通过本地预测消费了事件
            const authoritative = this.stripStateForTransport(match.state, { stripEventStream: true });
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
    ): Promise<void> {
        const matchID = match.matchID;
        const snapshotState = match.state;
        const snapshotStateID = match.stateID;

        // 批次内命令串行执行（抑制中间广播，避免客户端收到中间状态导致动画重播）
        for (const cmd of commands) {
            const success = await this.executeCommandInternal(match, playerID, cmd.type, cmd.payload, { suppressBroadcast: true });
            if (!success) {
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
                socket.emit('batch:rejected', matchID, batchId, 'command_failed');
                return;
            }
        }

        // 批次成功 - 广播最终状态给所有玩家，然后发送确认给发送者
        this.broadcastState(match);
        const authoritative = this.stripStateForTransport(match.state, { stripEventStream: true });
        socket.emit('batch:confirmed', matchID, batchId, authoritative);
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
     * 2. eventStream.entries — 仅在重连/batch确认时清空；正常广播时保留（客户端需消费事件驱动动画）
     * 3. log.entries — 引擎级调试日志（command/event 完整对象），客户端 UI 层不读取
     * 4. tutorial.steps — 客户端只用 step（当前步骤）和 stepIndex，steps 数组只需 length
     *
     * @param options.stripEventStream 是否清空 eventStream.entries（默认 false）
     *   - true: 用于 state:sync（重连）和 batch:confirmed（乐观确认），客户端不需要历史事件
     *   - false: 用于 state:update（正常广播），客户端需要消费事件驱动动画/特效/交互
     */
    private stripStateForTransport(viewState: unknown, options?: { stripEventStream?: boolean }): unknown {
        const state = viewState as { sys?: Record<string, unknown> };
        if (!state.sys) return viewState;

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

        // 2. eventStream: 仅在 stripEventStream=true 时清空 entries（重连/批次确认）
        //    broadcastState 需要保留 entries，供客户端 EventStream 消费（如技能触发事件）
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
        if (Object.keys(patches).length === 0) return viewState;

        return {
            ...state,
            sys: { ...sys, ...patches },
        };
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
        const manifest = GAME_MANIFEST_BY_ID[args.match.engineConfig.gameId];
        if (manifest && manifest.ai.capture === false) return;
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
        options?: { suppressBroadcast?: boolean },
    ): Promise<boolean> {
        const startTime = Date.now();
        const { engineConfig, state, random, playerIds } = match;
        const stateIdBefore = match.stateID;
        const preTrainingState = this.stripStateForTraining(this.applyPlayerView(match, playerID)) as MatchState<unknown>;
        const progressMarkerBeforeCommand = buildAiProgressMarker(match.state);
        const setupSeatControllers = extractSetupSeatControllers(match.metadata.setupData);
        const seatControllerType = resolveSeatControllerTypeForTraining(setupSeatControllers, playerID);

        const command: Command = {
            type: commandType,
            playerId: playerID,
            payload,
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
                    nsp.to(sid).emit('error', match.matchID, 'pipeline_error');
                }
            }

            // 自动取消 pending interaction（防止游戏卡死）
            await this.cancelInteractionOnError(match, playerID);

            return false;
        }

        const duration = Date.now() - startTime;

        if (!result.success) {
            gameLogger.commandFailed(
                match.matchID,
                commandType,
                playerID,
                new Error(result.error ?? 'command_failed')
            );

            // 通知发送者
            const nsp = this.io.of('/game');
            const sockets = match.connections.get(playerID);
            if (sockets) {
                for (const sid of sockets) {
                    nsp.to(sid).emit('error', match.matchID, result.error ?? 'command_failed');
                }
            }
            return false;
        }

        // 记录成功日志
        gameLogger.commandExecuted(match.matchID, commandType, playerID, duration);

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
                && (commandType === INTERACTION_COMMANDS.RESPOND || commandType === INTERACTION_COMMANDS.CANCEL)
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
                    const trackerKey = `${playerID}:unsatisfiable-interaction:${typeof payload?.interactionId === 'string' ? payload.interactionId : 'unknown'}:${reason}:${progressMarkerBeforeCommand}`;
                    unsatisfiableInteractionFeedback = {
                        matchId: match.matchID,
                        gameId: engineConfig.gameId,
                        playerId: playerID,
                        incidentKind: 'unsatisfiable-interaction-auto-skipped',
                        severity: 'medium',
                        reason,
                        trackerKey,
                        progressMarker: progressMarkerBeforeCommand,
                        stateSnapshot: await this.buildUnsatisfiableInteractionStateSnapshot({
                            match,
                            playerId: playerID,
                            reason,
                            commandType,
                            progressMarkerBefore: progressMarkerBeforeCommand,
                            preCommandSeatView: preTrainingState,
                        }),
                        actionLog: interaction ? JSON.stringify(interaction.options.slice(0, 8)) : undefined,
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
            commandType,
            payload,
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
                current?: { kind?: string; playerId?: string };
            };
        })?.interaction?.current;

        if (!interaction || interaction.playerId !== playerID) return;

        const commandType = INTERACTION_COMMANDS.CANCEL;

        // 递归调用 executeCommandInternal 执行取消命令
        // 注意：这里不会无限递归，因为 CANCEL 命令不会抛出异常
        await this.executeCommandInternal(match, playerID, commandType, {});

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
        return Object.entries(match.metadata.players).map(([id, data]) => ({
            id: Number(id),
            name: data.name,
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

        const state = setUndoAiSeatIds(
            result.state.G as MatchState<unknown>,
            getAiSeatIds(extractSetupSeatControllers(result.metadata.setupData)),
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
            commandQueue: [],
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
