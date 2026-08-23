/**
 * 游戏状态同步服务端
 *
 * 基于 socket.io 实现：
 * - 接收客户端命令 → 执行 pipeline → playerView 过滤 → 广播状态
 * - 管理玩家连接状态
 * - 内置离线交互裁决（断线 → graceMs → 自动 CANCEL_INTERACTION）
 */

import type { Server as IOServer, Socket as IOSocket } from 'socket.io';
import type { MatchState, PlayerId } from '../types';
import type {
    MatchStorage,
    MatchMetadata,
} from './storage';
import { isMatchAuthMetadataProvider } from './storage';
import type {
    BatchDispatchMeta,
    ManualForceEndAiPhaseResult,
    ManualSetupSelectionRequest,
    OnlineAiClientTransportDiagnostics,
} from './protocol';
import type {
    TrainingDataRecorder,
} from './trainingData';
import logger, { gameLogger } from '../../../server/logger.js';
import * as aiModule from '../ai';
import { INTERACTION_COMMANDS } from '../systems/InteractionSystem';
import {
    buildAiProgressMarker,
    type ForceEndTurnStalledAiResolution,
} from './onlineAiRecovery';
import type { GameEngineConfig } from './engineConfig';
export type {
    AnyGameEngineConfig,
    GameEngineConfig,
    GameEventTelemetryFormatter,
    GameEventTelemetryRecord,
} from './engineConfig';
import {
    OnlineAiCircuitBreaker,
    type OnlineAiCircuitSnapshot,
    type OnlineAiCircuitSource,
} from './onlineAiCircuitBreaker';
import type { OnlineAiActionDelayContext } from './onlineAiActionDelay';
import {
    executeOnlineAiCommandSequence,
    tryExecuteOnlineAiImmediateAction,
} from './onlineAiExecutor';
import { shouldAutoReportCommandFailure } from './commandFailureReason';
import type { CommandFailureFeedbackPayload } from './commandFailureFeedbackPayload';
import {
    TransportFeedbackReporter,
    type CommandFailureFeedbackReporter,
    type OnlineAiFeedbackReporter,
    type OnlineAiRecoveryFeedbackPayload,
} from './transportFeedbackReporter';
import { OnlineAiCircuitFailureCoordinator } from './onlineAiCircuitFailureCoordinator';
import {
    type OnlineAiLegalActionRecoveryResult,
} from './onlineAiWatchdogSequenceHelpers';
import {
    buildOnlineAiWatchdogSeatControllers,
    extractTrustedSetupSeatControllers,
    normalizeOnlineAiWatchdogSeatControllerType,
    resolveRawOnlineAiWatchdogSeatControllers,
    resolveSeatControllerTypeForTraining,
    type GameManifestIndex,
    type OnlineAiSeatControllerType,
} from './onlineAiSeatControllers';
import { resolveOnlineAiRecoveryResolved } from './onlineAiRecoveryResolved';
import { OnlineAiRepeatedRecoveryCoordinator } from './onlineAiRepeatedRecoveryCoordinator';
import {
    resolveOnlineAiRecoveryFingerprint as resolveRecoveryFingerprint,
} from './onlineAiWatchdogSequenceFingerprinting';
import { TransportStateSynchronizer } from './transportStateSynchronizer';
import { OnlineAiFeedbackDiagnosticsBuilder } from './onlineAiFeedbackDiagnosticsBuilder';
import { OnlineAiRecoveryRuntimeLedger } from './onlineAiRecoveryRuntimeLedger';
import { OnlineAiRecoveryController } from './onlineAiRecoveryController';
import {
    applyOnlineAiRecoveryFailureToTracker,
    type OnlineAiRecoveryTracker,
} from './onlineAiWatchdogTracker';
import { AuthoritativeCommandExecutor } from './authoritativeCommandExecutor';
import { AuthoritativeBatchCoordinator } from './authoritativeBatchCoordinator';
import {
    type QueuedAuthoritativeCommand,
} from './authoritativeCommandQueue';
import { MatchRoomRuntime } from './matchRoomRuntime';
import { TrainingDataCapture } from './trainingDataCapture';
import { OnlineAiLegalActionRecoveryCoordinator } from './onlineAiLegalActionRecoveryCoordinator';
import {
    OnlineAiRecoverySequenceRunner,
    type OnlineAiRecoveryPhaseLabel,
    type OnlineAiRecoverySequenceExecutionTrace,
} from './onlineAiRecoverySequenceRunner';
import { OnlineAiImmediateExecutionRunner } from './onlineAiImmediateExecutionRunner';
import { OnlineAiRecoveryCandidateResolver } from './onlineAiRecoveryCandidateResolver';
import {
    OnlineAiManualRecoveryCoordinator,
} from './onlineAiManualRecoveryCoordinator';
import {
    registerGameSocketRoutes,
} from './transportSocketRouter';
import {
    MatchConnectionLifecycleCoordinator,
    type MatchConnectionSocketInfo,
} from './matchConnectionLifecycleCoordinator';
import {
    MatchRoomRegistry,
    type MatchRoomRegistryActiveMatch,
} from './matchRoomRegistry';
import { createTrackedRandom } from './trackedRandom';
import { MatchRoomUnloadCoordinator } from './matchRoomUnloadCoordinator';
import { AuthoritativeCommandFailureCoordinator } from './authoritativeCommandFailureCoordinator';
import { AuthoritativeCommandStaleRejectionCoordinator } from './authoritativeCommandStaleRejectionCoordinator';
import { AuthoritativeCommandSuccessCoordinator } from './authoritativeCommandSuccessCoordinator';
import { AuthoritativeQueuedCommandStaleRejectionCoordinator } from './authoritativeQueuedCommandStaleRejectionCoordinator';
import { createMatchSetupState } from './matchSetupStateFactory';
import { MatchStateInjectionCoordinator } from './matchStateInjectionCoordinator';

type OnlineAiWatchdogSeatController = aiModule.AiSeatController;

type OnlineAiExecutionTrace = OnlineAiRecoverySequenceExecutionTrace;

const DEFAULT_ONLINE_AI_RECOVERY_TICK_MS = 500;
const DEFAULT_ONLINE_AI_RECOVERY_TIMEOUT_MS = 8000;
const DEFAULT_ONLINE_AI_RECOVERY_MAX_ADVANCE_STEPS = 16;
const DEFAULT_ONLINE_AI_RECOVERY_MAX_STEPS_PER_SLICE = 3;
const DEFAULT_ONLINE_AI_RECOVERY_FAILURE_REPORT_THRESHOLD = 2;
const DEFAULT_ONLINE_AI_RECOVERY_REPEATED_ATTEMPT_LIMIT = 3;
const DEFAULT_ONLINE_AI_CIRCUIT_WINDOW_MS = 30_000;
const DEFAULT_ONLINE_AI_CIRCUIT_FAILURE_BUDGET = 6;

function emitOnlineAiBatchTrace(stage: string, payload: Record<string, unknown>): void {
    if (process.env.NODE_ENV === 'production') {
        return;
    }
    console.log('[ONLINE_AI_BATCH_TRACE]', { stage, ...payload });
}

// ============================================================================
// 内部类型
// ============================================================================

type ExecuteCommandInternalOptions = {
    suppressBroadcast?: boolean;
    reportFailureFeedback?: boolean;
    feedbackSource?: CommandFailureFeedbackPayload['feedbackSource'];
    expectedStateID?: number;
    onlineAiCircuitSource?: OnlineAiCircuitSource;
    onlineAiAttemptKey?: string | null;
    clientTransport?: OnlineAiClientTransportDiagnostics | null;
};

type ActiveMatch = MatchRoomRegistryActiveMatch<ExecuteCommandInternalOptions>;
type SocketInfo = MatchConnectionSocketInfo;

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
    onlineAiFeedbackReporter?: OnlineAiFeedbackReporter;
    commandFailureFeedbackCooldownMs?: number;
    commandFailureFeedbackReporter?: CommandFailureFeedbackReporter;
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

export class GameTransportServer {
    private readonly io: IOServer;
    private readonly storage: MatchStorage;
    private readonly gameIndex: Map<string, GameEngineConfig>;
    private readonly matchRoomRegistry: MatchRoomRegistry<ExecuteCommandInternalOptions>;
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
    private readonly onlineAiRecoveryFailureReportThreshold: number;
    private readonly onlineAiRecoveryRepeatedAttemptLimit: number;
    private readonly onlineAiCircuitBreaker: OnlineAiCircuitBreaker;
    private readonly onlineAiCircuitFailureCoordinator: OnlineAiCircuitFailureCoordinator<ActiveMatch>;
    private readonly transportFeedbackReporter: TransportFeedbackReporter;
    private readonly stateSynchronizer: TransportStateSynchronizer;
    private readonly connectionLifecycleCoordinator: MatchConnectionLifecycleCoordinator<ActiveMatch>;
    private readonly matchRoomUnloadCoordinator: MatchRoomUnloadCoordinator<ActiveMatch>;
    private readonly onlineAiFeedbackDiagnostics: OnlineAiFeedbackDiagnosticsBuilder;
    private readonly onlineAiRecoveryLedger: OnlineAiRecoveryRuntimeLedger;
    private readonly onlineAiRecoveryCandidateResolver: OnlineAiRecoveryCandidateResolver<ActiveMatch>;
    private readonly onlineAiManualRecoveryCoordinator: OnlineAiManualRecoveryCoordinator<ActiveMatch>;
    private readonly onlineAiRepeatedRecoveryCoordinator: OnlineAiRepeatedRecoveryCoordinator<ActiveMatch>;
    private readonly onlineAiRecoverySequenceRunner: OnlineAiRecoverySequenceRunner<ActiveMatch>;
    private readonly onlineAiImmediateExecutionRunner: OnlineAiImmediateExecutionRunner<ActiveMatch>;
    private readonly onlineAiRecoveryController: OnlineAiRecoveryController<ActiveMatch, OnlineAiWatchdogSeatController>;
    private readonly onlineAiLegalActionRecoveryCoordinator: OnlineAiLegalActionRecoveryCoordinator<ActiveMatch>;
    private readonly authoritativeCommandFailureCoordinator: AuthoritativeCommandFailureCoordinator<ActiveMatch>;
    private readonly authoritativeCommandStaleRejectionCoordinator: AuthoritativeCommandStaleRejectionCoordinator<ActiveMatch>;
    private readonly authoritativeBatchCoordinator: AuthoritativeBatchCoordinator<ActiveMatch>;
    private readonly authoritativeQueuedCommandStaleRejectionCoordinator: AuthoritativeQueuedCommandStaleRejectionCoordinator<ActiveMatch>;
    private readonly authoritativeCommandSuccessCoordinator: AuthoritativeCommandSuccessCoordinator<ActiveMatch, OnlineAiRecoveryFeedbackPayload>;
    private readonly authoritativeCommandExecutor: AuthoritativeCommandExecutor;
    private readonly matchStateInjectionCoordinator: MatchStateInjectionCoordinator<ActiveMatch>;
    private onlineAiRecoveryTimer: ReturnType<typeof setInterval> | null = null;

    private get activeMatches(): Map<string, ActiveMatch> {
        return this.matchRoomRegistry.activeMatchesForLegacyAccess();
    }

    constructor(config: GameTransportServerConfig) {
        this.io = config.io;
        this.storage = config.storage;
        this.gameIndex = new Map(config.games.map((g) => [g.gameId, g]));
        this.matchRoomRegistry = new MatchRoomRegistry({
            storage: this.storage,
            gameIndex: this.gameIndex,
        });
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
        this.transportFeedbackReporter = new TransportFeedbackReporter({
            onlineAiRecoveryFeedbackCooldownMs: config.onlineAiRecoveryFeedbackCooldownMs,
            commandFailureFeedbackCooldownMs: config.commandFailureFeedbackCooldownMs,
            onlineAiFeedbackReporter: config.onlineAiFeedbackReporter,
            commandFailureFeedbackReporter: config.commandFailureFeedbackReporter,
        });
        this.onlineAiCircuitFailureCoordinator = new OnlineAiCircuitFailureCoordinator({
            circuitBreaker: this.onlineAiCircuitBreaker,
            hooks: {
                reportRecoveryFeedback: (payload) => (
                    this.transportFeedbackReporter.reportOnlineAiRecoveryFeedback(payload)
                ),
                emitPlayerError: (match, playerId, reason) => {
                    const sockets = match.connections.get(playerId);
                    if (!sockets) {
                        return;
                    }
                    const nsp = this.io.of('/game');
                    for (const sid of sockets) {
                        nsp.to(sid).emit('error', match.matchID, reason);
                    }
                },
            },
        });
        this.stateSynchronizer = new TransportStateSynchronizer(this.io);
        this.matchStateInjectionCoordinator = new MatchStateInjectionCoordinator({
            hooks: {
                getOrLoadMatch: (matchID) => this.matchRoomRegistry.getOrLoad(matchID),
                persistState: (matchID, state) => this.storage.setState(matchID, state),
                clearAllBaselines: (match) => {
                    this.stateSynchronizer.clearAllBaselines(match);
                },
                broadcast: (match) => {
                    this.stateSynchronizer.broadcast(match);
                },
                getNodeEnv: () => process.env.NODE_ENV,
                logInjected: (matchID) => {
                    logger.info(`[TEST] State injected for match ${matchID}`);
                },
            },
        });
        this.connectionLifecycleCoordinator = new MatchConnectionLifecycleCoordinator({
            offlineGraceMs: this.offlineGraceMs,
            hooks: {
                getActiveMatch: (matchID) => this.matchRoomRegistry.get(matchID),
                loadMatch: (matchID) => this.loadMatch(matchID),
                getSocketInfo: (socketId) => this.socketIndex.get(socketId),
                setSocketInfo: (socketId, info) => {
                    this.socketIndex.set(socketId, info);
                },
                deleteSocketInfo: (socketId) => {
                    this.socketIndex.delete(socketId);
                },
                removeSocketFromPreviousMatch: (socketId, info) => {
                    this.removeSocketFromMatch(socketId, info);
                },
                readFreshAuthMetadata: (matchID, fallback) => this.readFreshAuthMetadata(matchID, fallback),
                validateCommandAuth: (matchID, playerID, credentials, metadata) => (
                    this.validateCommandAuth(matchID, playerID, credentials, metadata)
                ),
                persistMetadata: (matchID, metadata) => this.storage.setMetadata(matchID, metadata),
                clearSyncBaseline: (match, playerID) => {
                    this.stateSynchronizer.clearBaseline(match, playerID);
                },
                emitPlayerDisconnected: (matchID, playerID) => {
                    const nsp = this.io.of('/game');
                    nsp.to(`game:${matchID}`).emit('player:disconnected', matchID, playerID);
                },
                logSocketDisconnected: (socketId, matchID, reason) => {
                    gameLogger.socketDisconnected(socketId, matchID, reason);
                },
                executeOfflineAdjudicationCommand: async (match, playerID, commandType) => {
                    await this.handleCommand(match.matchID, playerID, commandType, {});
                },
                syncSocket: (args) => {
                    this.stateSynchronizer.syncSocket(args);
                },
                resolveOnlineAiSeatControllerType: (match, playerID) => (
                    this.resolveOnlineAiSeatControllerType(match, playerID)
                ),
                runOnlineAiImmediateExecution: (match) => this.runOnlineAiImmediateExecution(match, 'sync'),
                onPersistConnectedMetadataFailed: ({ matchID, playerID, error }) => {
                    logger.warn('[GameTransport] persist connected metadata failed', {
                        matchID,
                        playerID,
                        error,
                    });
                },
                onPersistDisconnectedMetadataFailed: ({ matchID, playerID, error }) => {
                    logger.error(
                        `[GameTransport] setMetadata 失败（断线标记可能未持久化） matchID=${matchID} playerID=${playerID}`,
                        error,
                    );
                },
            },
        });
        this.onlineAiFeedbackDiagnostics = new OnlineAiFeedbackDiagnosticsBuilder({
            rulesVersion: this.rulesVersion,
            applyPlayerView: (match, playerId) => (
                this.stateSynchronizer.applyPlayerView(match, playerId) as MatchState<unknown>
            ),
        });
        this.onlineAiRecoveryLedger = new OnlineAiRecoveryRuntimeLedger();
        this.matchRoomUnloadCoordinator = new MatchRoomUnloadCoordinator({
            hooks: {
                getMatch: (matchID) => this.matchRoomRegistry.get(matchID),
                markRuntimeUnloaded: (match) => {
                    this.createMatchRoomRuntime(match).markUnloaded();
                },
                deleteSocketInfo: (socketId) => {
                    this.socketIndex.delete(socketId);
                },
                deleteMatch: (matchID) => this.matchRoomRegistry.delete(matchID),
                clearRecoveryState: (matchID) => {
                    this.onlineAiRecoveryLedger.clearMatch(matchID);
                },
                clearCircuitState: (matchID) => {
                    this.onlineAiCircuitBreaker.clearMatch(matchID);
                },
                fetchRoomSockets: async (matchID) => {
                    const namespace = this.io.of('/game');
                    return namespace.in(`game:${matchID}`).fetchSockets();
                },
                onDisconnectRoomSocketsFailed: (matchID, error) => {
                    logger.warn('[GameTransport] disconnect room sockets failed', { matchID, error });
                },
            },
        });
        this.authoritativeCommandFailureCoordinator = new AuthoritativeCommandFailureCoordinator({
            hooks: {
                recordOnlineAiCircuitFailure: (args) => this.recordOnlineAiCircuitFailure(args),
                logCommandFailed: ({
                    match,
                    requestedCommandType,
                    playerId,
                    error,
                    gameId,
                    stateIdBefore,
                    progressMarker,
                    feedbackSource,
                    commandPayload,
                }) => {
                    gameLogger.commandFailed(
                        match.matchID,
                        requestedCommandType,
                        playerId,
                        error,
                        {
                            gameId,
                            stateIDBefore: stateIdBefore,
                            progressMarker,
                            feedbackSource,
                            commandPayload: cloneDiagnosticValue(commandPayload),
                        },
                    );
                },
                emitPlayerError: (match, playerId, reason) => {
                    const sockets = match.connections.get(playerId);
                    if (!sockets) {
                        return;
                    }
                    const namespace = this.io.of('/game');
                    for (const socketId of sockets) {
                        namespace.to(socketId).emit('error', match.matchID, reason);
                    }
                },
                shouldReportCommandFailureFeedback: shouldAutoReportCommandFailure,
                buildCommandFailureFeedbackPayload: (args) => (
                    this.onlineAiFeedbackDiagnostics.buildCommandFailureFeedbackPayload({
                        match: args.match,
                        playerId: args.playerId,
                        commandType: args.commandType,
                        reason: args.reason,
                        commandPayload: args.commandPayload,
                        progressMarker: args.progressMarker,
                        stateIdBefore: args.stateIdBefore,
                        visibleState: args.visibleState,
                        feedbackSource: args.feedbackSource,
                    })
                ),
                reportCommandFailureFeedback: (payload) => (
                    this.transportFeedbackReporter.reportCommandFailureFeedback(payload)
                ),
                cancelInteractionOnError: (match, playerId) => (
                    this.cancelInteractionOnError(match, playerId)
                ),
            },
        });
        this.authoritativeCommandStaleRejectionCoordinator = new AuthoritativeCommandStaleRejectionCoordinator({
            hooks: {
                recordOnlineAiCircuitFailure: (args) => this.recordOnlineAiCircuitFailure(args),
                emitPlayerError: (match, playerId, reason) => {
                    const sockets = match.connections.get(playerId);
                    if (!sockets) {
                        return;
                    }
                    const namespace = this.io.of('/game');
                    for (const socketId of sockets) {
                        namespace.to(socketId).emit('error', match.matchID, reason);
                    }
                },
            },
        });
        this.authoritativeBatchCoordinator = new AuthoritativeBatchCoordinator({
            hooks: {
                executeCommand: ({
                    match,
                    playerId,
                    command,
                    onlineAiAttemptKey,
                    clientTransport,
                }) => this.executeCommandInternal(match, playerId, command.type, command.payload, {
                    suppressBroadcast: true,
                    reportFailureFeedback: true,
                    onlineAiAttemptKey,
                    clientTransport,
                }),
                restoreRandomCursor: (match, randomCursor) => {
                    const rebuilt = createTrackedRandom(match.randomSeed, randomCursor);
                    match.random = rebuilt.random;
                    match.getRandomCursor = rebuilt.getCursor;
                    match.lastBroadcastedViews.clear();
                },
                persistRollbackState: (match, storedState) => (
                    this.storage.setState(match.matchID, storedState)
                ),
                broadcastState: (match) => this.stateSynchronizer.broadcast(match),
                buildAuthoritativeState: (match) => this.stateSynchronizer.buildAuthoritativeState(match),
                resolveSeatControllerType: (match, playerId) => (
                    this.resolveOnlineAiSeatControllerType(match, playerId)
                ),
                admitOnlineAiCircuitCommand: (args) => this.onlineAiCircuitBreaker.admit(args),
                recordOnlineAiCircuitFailure: (args) => this.recordOnlineAiCircuitFailure(args),
                emitTrace: emitOnlineAiBatchTrace,
            },
        });
        this.authoritativeQueuedCommandStaleRejectionCoordinator = new AuthoritativeQueuedCommandStaleRejectionCoordinator({
            hooks: {
                resolveSeatControllerType: (match, playerId) => (
                    this.resolveOnlineAiSeatControllerType(match, playerId)
                ),
                admitOnlineAiCircuitCommand: (args) => this.onlineAiCircuitBreaker.admit(args),
                recordOnlineAiCircuitFailure: (args) => this.recordOnlineAiCircuitFailure(args),
            },
        });
        this.authoritativeCommandSuccessCoordinator = new AuthoritativeCommandSuccessCoordinator({
            hooks: {
                createTrackedRandom,
                persistState: (match, storedState) => this.storage.setState(match.matchID, storedState),
                buildUnsatisfiableInteractionFeedback: (args) => (
                    this.onlineAiFeedbackDiagnostics.buildUnsatisfiableInteractionFeedback({
                        match: args.match,
                        playerId: args.playerId,
                        seatControllerType: args.seatControllerType,
                        commandType: args.commandType,
                        event: args.event,
                        progressMarkerBefore: args.progressMarkerBefore,
                        preCommandSeatView: args.preCommandSeatView,
                    })
                ),
                buildPostTrainingState: (match, playerId) => this.stateSynchronizer.stripForTraining(
                    this.stateSynchronizer.applyPlayerView(match, playerId),
                ) as MatchState<unknown>,
                trainingDataCapture: this.trainingDataCapture,
                reportOnlineAiRecoveryFeedback: (feedback) => (
                    this.transportFeedbackReporter.reportOnlineAiRecoveryFeedback(feedback)
                ),
                broadcastState: (match) => this.stateSynchronizer.broadcast(match),
                clearOnlineAiCircuitBreaker: (matchID) => this.onlineAiCircuitBreaker.clearMatch(matchID),
                persistMetadata: (match) => this.storage.setMetadata(match.matchID, match.metadata),
            },
            onCommandSucceeded: this.onCommandSucceeded,
            onGameOver: this.onGameOver,
        });
        this.onlineAiRecoveryCandidateResolver = new OnlineAiRecoveryCandidateResolver({
            rulesVersion: this.rulesVersion,
            hooks: {
                resolvePrivateOverlay: (match, playerId) => (
                    this.stateSynchronizer.applyPlayerView(match, playerId) as MatchState<unknown>
                ),
                getCurrentTracker: (matchId) => this.onlineAiRecoveryLedger.getTracker(matchId),
                buildRecoveryFingerprint: (match, candidate, progressMarker) => (
                    this.buildOnlineAiRecoveryFingerprint(match, candidate, progressMarker)
                ),
            },
        });
        this.onlineAiManualRecoveryCoordinator = new OnlineAiManualRecoveryCoordinator({
            rulesVersion: this.rulesVersion,
            gameManifests: this.gameManifests,
            hooks: {
                buildSeatControllers: (match) => this.buildOnlineAiSeatControllers(match),
                isMatchExecuting: (match) => this.createMatchRoomRuntime(match).isExecuting(),
                isRecoveryInFlight: (matchId) => this.onlineAiRecoveryLedger.isInFlight(matchId),
                resolvePrivateOverlay: (match, playerId) => (
                    this.stateSynchronizer.applyPlayerView(match, playerId) as MatchState<unknown>
                ),
                executeManualSetupCommand: ({ match, playerId, commandType, commandPayload, expectedStateID }) => (
                    this.handleCommand(match.matchID, playerId, commandType, commandPayload, {
                        expectedStateID,
                        onlineAiCircuitSource: 'watchdog',
                    })
                ),
                resolveRecoveryCandidate: (match, seatControllers) => (
                    this.resolveOnlineAiRecoveryCandidate(match, seatControllers)
                ),
                buildRecoveryFingerprint: (match, candidate, progressMarker) => (
                    this.buildOnlineAiRecoveryFingerprint(match, candidate, progressMarker)
                ),
                clearTracker: (matchId) => {
                    this.onlineAiRecoveryLedger.clearTracker(matchId);
                },
                setTracker: (matchId, tracker) => {
                    this.onlineAiRecoveryLedger.setTracker(matchId, tracker);
                },
                beginInFlight: (matchId) => {
                    this.onlineAiRecoveryLedger.beginInFlight(matchId);
                },
                finishInFlight: (matchId) => {
                    this.onlineAiRecoveryLedger.finishInFlight(matchId);
                },
                runRecoverySequence: (payload) => this.runOnlineAiRecoverySequence(
                    payload.match,
                    payload.tracker,
                    payload.candidate,
                    payload.progressMarker,
                    payload.seatControllers,
                    payload.options,
                ),
                hasRecoveryResolved: (match, candidate, seatControllers) => (
                    this.hasOnlineAiRecoveryResolved(match, candidate, seatControllers)
                ),
            },
        });
        this.onlineAiRepeatedRecoveryCoordinator = new OnlineAiRepeatedRecoveryCoordinator({
            repeatedAttemptLimit: this.onlineAiRecoveryRepeatedAttemptLimit,
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
                executeCommand: ({ match, playerId, commandType, commandPayload, options }) => (
                    this.executeCommandInternal(
                        match,
                        playerId,
                        commandType,
                        commandPayload,
                        options,
                    )
                ),
                markRepeatedAttemptReported: (repeatedAttemptKey, repeatedAttempt, fallbackCount) => (
                    this.onlineAiRecoveryLedger.markRepeatedAttemptReported(
                        repeatedAttemptKey,
                        repeatedAttempt,
                        fallbackCount,
                    )
                ),
                clearRecoveryTracker: (matchId) => {
                    this.onlineAiRecoveryLedger.clearTracker(matchId);
                },
                reportRecoveryFeedback: (payload) => (
                    this.transportFeedbackReporter.reportOnlineAiRecoveryFeedback(payload)
                ),
                buildRecoveryStateSnapshot: ({ match, candidate, trackerKey, progressMarker, failureReason }) => (
                    this.onlineAiFeedbackDiagnostics.buildRecoveryStateSnapshot(
                        match,
                        candidate,
                        trackerKey,
                        progressMarker,
                        failureReason,
                    )
                ),
                buildRecoveryActionLog: ({ match, candidate, trackerKey, progressMarker, failureReason }) => (
                    this.onlineAiFeedbackDiagnostics.buildRecoveryActionLog(
                        match,
                        candidate,
                        trackerKey,
                        progressMarker,
                        failureReason,
                    )
                ),
                drainCommandQueue: (match) => this.drainCommandQueue(match),
            },
        });
        this.onlineAiLegalActionRecoveryCoordinator = new OnlineAiLegalActionRecoveryCoordinator({
            emitTrace: emitOnlineAiBatchTrace,
            hooks: {
                resolvePrivateOverlay: (match, playerId) => (
                    this.stateSynchronizer.applyPlayerView(match, playerId) as MatchState<unknown>
                ),
                getLatestSeatController: (match, playerId) => this.buildOnlineAiSeatControllers(match)[playerId],
                buildRecoveryFingerprint: (match, candidate, progressMarker) => (
                    this.buildOnlineAiRecoveryFingerprint(match, candidate, progressMarker)
                ),
                hasRecoveryResolved: (match, candidate, seatControllers) => (
                    this.hasOnlineAiRecoveryResolved(match, candidate, seatControllers)
                ),
                settleRecoveryResolvedStatus: ({ match, tracker, resolved }) => {
                    if (resolved) {
                        this.onlineAiRecoveryLedger.clearTracker(match.matchID);
                    } else {
                        tracker.autoSubmittedAt = null;
                        tracker.firstSeenAt = Date.now();
                    }
                },
                resetRecoveryAttempt: (tracker) => {
                    tracker.autoSubmittedAt = null;
                },
                executeCommand: ({ match, playerId, command }) => this.executeCommandInternal(
                    match,
                    playerId,
                    command.type,
                    command.payload,
                    {
                        suppressBroadcast: true,
                        reportFailureFeedback: true,
                        feedbackSource: 'online-ai-watchdog',
                    },
                ),
                broadcastState: (match) => this.stateSynchronizer.broadcast(match),
                onEmergencyOverlayFallbackRetry: ({ match, playerId, reason, blockedReason, blockedKey }) => {
                    logger.warn('[GameTransport] online-ai-watchdog retrying legal-action with emergency playerView', {
                        matchID: match.matchID,
                        gameId: match.gameId,
                        playerID: playerId,
                        reason,
                        blockedReason,
                        blockedKey,
                    });
                },
                onLegalActionBlocked: ({ match, playerId, blockedReason, visibility, blockedKey, shouldTriggerOverlayResync, progressMarker }) => {
                    logger.info('[GameTransport] online-ai-watchdog legal-action blocked', {
                        matchID: match.matchID,
                        gameId: match.gameId,
                        playerID: playerId,
                        blockedReason,
                        visibility,
                        blockedKey,
                    });
                    if (
                        shouldTriggerOverlayResync
                        && (blockedReason === 'missing-private-overlay' || blockedReason === 'stale-private-overlay')
                    ) {
                        this.maybeTriggerOnlineAiOverlayResync({
                            match,
                            playerId,
                            blockedReason,
                            blockedKey,
                            progressMarker,
                        });
                    }
                },
                onPrecheckDeferred: ({ match, playerId, commandType, errorMessage }) => {
                    logger.warn('[GameTransport] online-ai-watchdog authoritative command precheck failed; deferring to pipeline', {
                        matchID: match.matchID,
                        gameId: match.gameId,
                        playerID: playerId,
                        commandType,
                        error: errorMessage,
                    });
                },
                onAuthoritativeInvalidCommand: async ({ match, playerId, command, commandFailureReason, progressMarker, stateIDBefore }) => {
                    const visibleState = this.stateSynchronizer.stripForTraining(
                        this.stateSynchronizer.applyPlayerView(match, playerId),
                    ) as MatchState<unknown>;

                    logger.warn('[GameTransport] online-ai-watchdog skipped authoritative-invalid legal action', {
                        matchID: match.matchID,
                        gameId: match.gameId,
                        playerID: playerId,
                        commandType: command.type,
                        commandPayload: cloneDiagnosticValue(command.payload),
                        reason: commandFailureReason,
                        stateIDBefore,
                        progressMarker,
                    });

                    await this.recordOnlineAiCircuitFailure({
                        match,
                        playerId,
                        source: 'watchdog',
                        commandType: command.type,
                        commandPayload: command.payload,
                        reason: commandFailureReason,
                        stateID: stateIDBefore,
                        progressMarker,
                    });

                    if (shouldAutoReportCommandFailure(commandFailureReason, 'online-ai-watchdog')) {
                        await this.transportFeedbackReporter.reportCommandFailureFeedback(this.onlineAiFeedbackDiagnostics.buildCommandFailureFeedbackPayload({
                            match,
                            playerId,
                            commandType: command.type,
                            reason: commandFailureReason,
                            commandPayload: command.payload,
                            progressMarker,
                            stateIdBefore: stateIDBefore,
                            visibleState,
                            feedbackSource: 'online-ai-watchdog',
                        }));
                    }
                },
                onStoppedAfterOwnershipChanged: ({ match, tracker, playerId, actionId, actionKind, executedCommandTypes, resolved }) => {
                    logger.info('[GameTransport] online-ai-watchdog stopped legal action after ownership changed', {
                        matchID: match.matchID,
                        gameId: match.gameId,
                        playerID: playerId,
                        incidentKey: tracker.key,
                        actionId,
                        actionKind,
                        executedCommandTypes,
                        resolved,
                    });
                },
                onRecoveredLegalAction: ({ match, tracker, playerId, actionId, actionKind, markerBefore, markerAfter, resolved }) => {
                    logger.info('[GameTransport] online-ai-watchdog recovered stalled AI via legal action', {
                        matchID: match.matchID,
                        gameId: match.gameId,
                        playerID: playerId,
                        incidentKey: tracker.key,
                        actionId,
                        actionKind,
                        markerBefore,
                        markerAfter,
                        resolved,
                    });
                },
            },
        });
        this.onlineAiRecoverySequenceRunner = new OnlineAiRecoverySequenceRunner({
            maxAdvanceSteps: this.onlineAiRecoveryMaxAdvanceSteps,
            maxStepsPerSlice: this.onlineAiRecoveryMaxStepsPerSlice,
            hooks: {
                createRoomRuntime: (match) => this.createMatchRoomRuntime(match),
                resolveRecoveryCandidate: (match, seatControllers) => (
                    this.resolveOnlineAiRecoveryCandidate(match, seatControllers)
                ),
                tryRecoverWithLegalAction: ({ match, candidate, tracker, seatControllers, delayContext }) => (
                    this.tryRecoverOnlineAiWithLegalAction(
                        match,
                        candidate,
                        tracker,
                        seatControllers,
                        delayContext,
                    )
                ),
                executeRecoveryCommand: ({ match, playerId, commandType, commandPayload }) => this.executeCommandInternal(
                    match,
                    playerId,
                    commandType,
                    commandPayload,
                    {
                        reportFailureFeedback: true,
                        feedbackSource: 'online-ai-watchdog',
                    },
                ),
                getLastCommandFailureReason: (match) => match.lastCommandFailureReason,
                clearRecoveryProgress: (matchId) => {
                    this.onlineAiRecoveryLedger.clearRecoveryProgress(matchId);
                },
                clearTracker: (matchId) => {
                    this.onlineAiRecoveryLedger.clearTracker(matchId);
                },
                setTracker: (matchId, tracker) => {
                    this.onlineAiRecoveryLedger.setTracker(matchId, tracker);
                },
                recordRepeatedAttempt: (matchId, trackerKey) => (
                    this.onlineAiRecoveryLedger.recordRepeatedAttempt(matchId, trackerKey)
                ),
                clearStateBaselines: (match) => {
                    this.stateSynchronizer.clearAllBaselines(match);
                },
                persistState: (match) => this.storage.setState(match.matchID, {
                    G: match.state,
                    _stateID: match.stateID,
                    randomSeed: match.randomSeed,
                    randomCursor: match.getRandomCursor(),
                }),
                broadcastState: (match) => this.stateSynchronizer.broadcast(match),
                resolvePrivateOverlay: (match, playerId) => (
                    this.stateSynchronizer.applyPlayerView(match, playerId) as MatchState<unknown>
                ),
                handleRecoveryFailure: (payload) => this.handleOnlineAiRecoveryFailure(
                    payload.match,
                    payload.tracker,
                    payload.candidate,
                    payload.phaseLabel,
                    payload.progressMarkerBeforeRecovery,
                    payload.reason,
                ),
                reportRecoverySuccessFeedback: async (payload) => {
                    await this.transportFeedbackReporter.reportOnlineAiRecoveryFeedback({
                        ...payload.metadata,
                        stateSnapshot: await this.onlineAiFeedbackDiagnostics.buildRecoveryStateSnapshot(
                            payload.match,
                            payload.candidate,
                            payload.trackerKey,
                            payload.progressMarkerBeforeRecovery,
                        ),
                        actionLog: this.onlineAiFeedbackDiagnostics.buildRecoveryActionLog(
                            payload.match,
                            payload.candidate,
                            payload.trackerKey,
                            payload.progressMarkerBeforeRecovery,
                        ),
                    });
                },
                logExecutionTrace: (trace) => {
                    this.logOnlineAiExecutionTrace(trace);
                },
                logLegacyResponseWindowMirrorCleared: ({ match, playerId, sourceId }) => {
                    logger.info('[GameTransport] online-ai-watchdog cleared legacy response-window mirror', {
                        matchID: match.matchID,
                        gameId: match.gameId,
                        playerID: playerId,
                        sourceId,
                    });
                },
                logRecoveredStalledAi: ({ match, candidate, totalAdvanceSteps, repeatedAttemptCount, markerBefore, markerAfter }) => {
                    logger.warn('[GameTransport] online-ai-watchdog recovered stalled AI', {
                        matchID: match.matchID,
                        gameId: match.gameId,
                        playerID: candidate.playerId,
                        reason: candidate.reason,
                        advanceSteps: totalAdvanceSteps,
                        repeatedAttemptCount,
                        markerBefore,
                        markerAfter,
                    });
                },
            },
        });
        this.onlineAiImmediateExecutionRunner = new OnlineAiImmediateExecutionRunner({
            maxAdvanceSteps: this.onlineAiRecoveryMaxAdvanceSteps,
            maxStepsPerSlice: this.onlineAiRecoveryMaxStepsPerSlice,
            hooks: {
                createRoomRuntime: (match) => this.createMatchRoomRuntime(match),
                buildSeatControllers: (match) => this.buildOnlineAiSeatControllers(match),
                isRecoveryInFlight: (matchId) => this.onlineAiRecoveryLedger.isInFlight(matchId),
                beginRecoveryInFlight: (matchId) => {
                    this.onlineAiRecoveryLedger.beginInFlight(matchId);
                },
                finishRecoveryInFlight: (matchId) => {
                    this.onlineAiRecoveryLedger.finishInFlight(matchId);
                },
                clearRecoveryProgress: (matchId) => {
                    this.onlineAiRecoveryLedger.clearRecoveryProgress(matchId);
                },
                clearCircuitBreakerMatch: (matchId) => {
                    this.onlineAiCircuitBreaker.clearMatch(matchId);
                },
                clearCircuitBreakerSeat: (matchId, playerId) => {
                    this.onlineAiCircuitBreaker.clearSeat(matchId, playerId);
                },
                executeImmediateAction: ({ match, seatControllers, delayContext }) => tryExecuteOnlineAiImmediateAction({
                    match,
                    seatControllers,
                    delayContext,
                    executor: {
                        applyPlayerView: (playerId) => this.stateSynchronizer.applyPlayerView(match, playerId) as MatchState<unknown>,
                        getSeatControllers: () => this.buildOnlineAiSeatControllers(match),
                        executeCommandSequence: (playerId, commands, options) => executeOnlineAiCommandSequence({
                            match,
                            playerId,
                            commands,
                            options,
                            createTrackedRandom,
                            persistState: (storedState) => this.storage.setState(match.matchID, storedState),
                            broadcastState: () => this.stateSynchronizer.broadcast(match),
                            executeCommand: (command, commandOptions) => this.executeCommandInternal(
                                match,
                                playerId,
                                command.type,
                                command.payload,
                                commandOptions,
                            ),
                        }),
                        clearRecoveryState: () => {
                            this.onlineAiRecoveryLedger.clearRecoveryProgress(match.matchID);
                        },
                        broadcastState: () => this.stateSynchronizer.broadcast(match),
                        emitTrace: emitOnlineAiBatchTrace,
                    },
                }),
                resolveRecoveryCandidate: (match, seatControllers) => (
                    this.resolveOnlineAiRecoveryCandidate(match, seatControllers)
                ),
                buildRecoveryFingerprint: (match, candidate, progressMarker) => (
                    this.buildOnlineAiRecoveryFingerprint(match, candidate, progressMarker)
                ),
                setTracker: (matchId, tracker) => {
                    this.onlineAiRecoveryLedger.setTracker(matchId, tracker);
                },
                tryRecoverWithLegalAction: ({ match, candidate, tracker, seatControllers, delayContext }) => (
                    this.tryRecoverOnlineAiWithLegalAction(
                        match,
                        candidate,
                        tracker,
                        seatControllers,
                        delayContext,
                    )
                ),
                runRecoverySequence: (payload) => this.runOnlineAiRecoverySequence(
                    payload.match,
                    payload.tracker,
                    payload.candidate,
                    payload.progressMarker,
                    payload.seatControllers,
                    payload.options,
                ),
                logExecutionTrace: (trace) => {
                    this.logOnlineAiExecutionTrace(trace);
                },
            },
        });
        this.onlineAiRecoveryController = new OnlineAiRecoveryController({
            ledger: this.onlineAiRecoveryLedger,
            circuitBreaker: this.onlineAiCircuitBreaker,
            repeatedAttemptLimit: this.onlineAiRecoveryRepeatedAttemptLimit,
            hooks: {
                getMatches: () => this.matchRoomRegistry.values(),
                pruneExpiredFeedbackCooldowns: (now) => {
                    this.transportFeedbackReporter.pruneExpiredOnlineAiRecoveryFeedbackCooldowns(now);
                },
                buildSeatControllers: (match) => this.buildOnlineAiSeatControllers(match),
                resolveCandidate: (match, seatControllers) => (
                    this.resolveOnlineAiRecoveryCandidate(match, seatControllers)
                ),
                buildRecoveryFingerprint: (match, candidate, progressMarker) => (
                    this.buildOnlineAiRecoveryFingerprint(match, candidate, progressMarker)
                ),
                resolveRecoveryTimeoutMs: (match, candidate) => (
                    this.resolveOnlineAiRecoveryTimeoutMs(match, candidate)
                ),
                tryForceUnblockRepeatedRecovery: (args) => (
                    this.onlineAiRepeatedRecoveryCoordinator.tryForceUnblock(args)
                ),
                reportRepeatedRecoverySuppressed: (args) => (
                    this.onlineAiRepeatedRecoveryCoordinator.reportSuppressed(args)
                ),
                runRecoverySequence: (args) => this.runOnlineAiRecoverySequence(
                    args.match,
                    args.tracker,
                    args.candidate,
                    args.progressMarker,
                    args.seatControllers,
                ),
            },
        });
        this.authoritativeCommandExecutor = new AuthoritativeCommandExecutor();
    }

    /** 启动传输层，监听 /game namespace */
    start(): void {
        const nsp = this.io.of('/game');
        registerGameSocketRoutes({
            namespace: nsp,
            hooks: {
                getSocketInfo: (socketId) => this.socketIndex.get(socketId),
                getMatch: (matchID) => this.matchRoomRegistry.get(matchID),
                validateCommandAuth: (matchID, playerID, credentials) => (
                    this.validateCommandAuth(matchID, playerID, credentials)
                ),
                resolveOnlineAiSeatControllerType: (match, playerID) => (
                    this.resolveOnlineAiSeatControllerType(match, playerID)
                ),
                handleSync: (socket, matchID, playerID, credentials) => (
                    this.handleSync(socket, matchID, playerID, credentials)
                ),
                handleCommand: (matchID, playerID, commandType, payload, options) => (
                    options
                        ? this.handleCommand(matchID, playerID, commandType, payload, options)
                        : this.handleCommand(matchID, playerID, commandType, payload)
                ),
                handleBatch: (socket, matchID, playerID, batchId, commands, meta) => (
                    this.handleBatch(socket, matchID, playerID, batchId, commands, meta)
                ),
                handleManualSetupSelection: (match, requesterPlayerId, request) => (
                    this.handleManualSetupSelection(match, requesterPlayerId, request)
                ),
                handleManualForceEndAiPhase: (match, requesterPlayerId) => (
                    this.handleManualForceEndAiPhase(match, requesterPlayerId)
                ),
                handleDisconnect: (socket) => {
                    this.handleDisconnect(socket);
                },
            },
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

        return createMatchSetupState({
            matchID,
            engineConfig,
            playerIds,
            seed,
            setupData,
        });
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
        this.matchRoomRegistry.replaceMetadata(matchID, metadata);
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
        this.matchRoomRegistry.mergeMetadata(matchID, metadata);
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

        const active = this.matchRoomRegistry.get(matchID);
        if (active) {
            this.matchRoomRegistry.replaceMetadata(matchID, resolvedMetadata);
        }
        return true;
    }

    async injectState(matchID: string, state: MatchState<unknown>): Promise<void> {
        return this.matchStateInjectionCoordinator.injectState(matchID, state);
    }

    /**
     * 主动断开某个玩家在对局内的所有连接（离座释放权限）
     */
    disconnectPlayer(matchID: string, playerID: string, options?: { disconnectSockets?: boolean }): void {
        const match = this.matchRoomRegistry.get(matchID);
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
        return this.matchRoomUnloadCoordinator.unloadMatch(matchID, options);
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
        return this.onlineAiManualRecoveryCoordinator.handleManualSetupSelection(
            match,
            requesterPlayerId,
            request,
        );
    }

    private async handleManualForceEndAiPhase(
        match: ActiveMatch,
        requesterPlayerId: string,
    ): Promise<ManualForceEndAiPhaseResult> {
        return this.onlineAiManualRecoveryCoordinator.handleManualForceEndAiPhase(
            match,
            requesterPlayerId,
        );
    }

    private async recordOnlineAiCircuitFailure(
        args: Parameters<OnlineAiCircuitFailureCoordinator<ActiveMatch>['recordFailure']>[0],
    ): Promise<OnlineAiCircuitSnapshot> {
        return this.onlineAiCircuitFailureCoordinator.recordFailure(args);
    }

    private rejectOnlineAiCircuitCommand(
        args: Parameters<OnlineAiCircuitFailureCoordinator<ActiveMatch>['rejectCommand']>[0],
    ): false {
        return this.onlineAiCircuitFailureCoordinator.rejectCommand(args);
    }

    private async resolveOnlineAiLegalActionOnlyCandidate(
        match: ActiveMatch,
        seatControllers: Record<string, OnlineAiWatchdogSeatController>,
    ): Promise<ForceEndTurnStalledAiResolution | null> {
        return this.onlineAiRecoveryCandidateResolver.resolveLegalActionOnlyCandidate(
            match,
            seatControllers,
        );
    }

    private async shouldSuppressOnlineAiWatchdogForManualFactionSelection(
        match: ActiveMatch,
        playerId: string,
        seatControllers: Record<string, OnlineAiWatchdogSeatController>,
    ): Promise<boolean> {
        return this.onlineAiRecoveryCandidateResolver.shouldSuppressForManualSetupSelection(
            match,
            playerId,
            seatControllers,
        );
    }

    private async resolveOnlineAiRecoveryCandidate(
        match: ActiveMatch,
        seatControllers: Record<string, OnlineAiWatchdogSeatController>,
    ): Promise<ForceEndTurnStalledAiResolution | null> {
        return this.onlineAiRecoveryCandidateResolver.resolveCandidate(match, seatControllers);
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

    private async runOnlineAiImmediateExecution(
        match: ActiveMatch,
        trigger: 'command-succeeded' | 'sync',
    ): Promise<void> {
        return this.onlineAiImmediateExecutionRunner.run(match, trigger);
    }
    private async runOnlineAiRecoveryTick(): Promise<void> {
        await this.onlineAiRecoveryController.runTick();
    }

    private async runOnlineAiRecoverySequence(
        match: ActiveMatch,
        tracker: OnlineAiRecoveryTracker,
        candidate: ForceEndTurnStalledAiResolution,
        progressMarkerBeforeRecovery: string,
        seatControllers: Record<string, OnlineAiWatchdogSeatController>,
        options?: { reuseExecutionLock?: boolean; allowManualImmediateAiContinuation?: boolean },
    ): Promise<void> {
        return this.onlineAiRecoverySequenceRunner.run({
            match,
            tracker,
            candidate,
            progressMarkerBeforeRecovery,
            seatControllers,
            options,
        });
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
        const { nextTracker } = applyOnlineAiRecoveryFailureToTracker({
            tracker,
            reason,
            now: Date.now(),
        });
        this.onlineAiRecoveryLedger.setTracker(match.matchID, nextTracker);
        const repeatedAttempt = this.onlineAiRecoveryLedger.recordRepeatedAttempt(match.matchID, tracker.key);

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
            await this.transportFeedbackReporter.reportOnlineAiRecoveryFeedback({
                matchId: match.matchID,
                gameId: match.gameId,
                playerId: candidate.playerId,
                incidentKind: 'force-end-turn-failed',
                severity: 'high',
                reason: `${candidate.reason}:${phaseLabel}:${reason}`,
                trackerKey: tracker.key,
                progressMarker: progressMarkerBeforeRecovery,
                stateSnapshot: await this.onlineAiFeedbackDiagnostics.buildRecoveryStateSnapshot(
                    match,
                    candidate,
                    tracker.key,
                    progressMarkerBeforeRecovery,
                    reason,
                ),
                actionLog: this.onlineAiFeedbackDiagnostics.buildRecoveryActionLog(
                    match,
                    candidate,
                    tracker.key,
                    progressMarkerBeforeRecovery,
                    reason,
                ),
            });
        }
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
            applyPlayerView: (playerId) => this.stateSynchronizer.applyPlayerView(match, playerId) as MatchState<unknown>,
        });
    }

    private async tryRecoverOnlineAiWithLegalAction(
        match: ActiveMatch,
        candidate: ForceEndTurnStalledAiResolution,
        tracker: OnlineAiRecoveryTracker,
        seatControllers: Record<string, OnlineAiWatchdogSeatController>,
        delayContext?: OnlineAiActionDelayContext,
    ): Promise<OnlineAiLegalActionRecoveryResult> {
        return this.onlineAiLegalActionRecoveryCoordinator.tryRecover({
            match,
            candidate,
            tracker,
            seatControllers,
            delayContext,
        });
    }

    private maybeTriggerOnlineAiOverlayResync(args: {
        match: ActiveMatch;
        playerId: string;
        blockedReason: 'missing-private-overlay' | 'stale-private-overlay';
        blockedKey: string;
        progressMarker: string;
    }): void {
        const shouldBroadcast = this.onlineAiRecoveryLedger.markOverlayResyncRequested({
            matchId: args.match.matchID,
            playerId: args.playerId,
            blockedKey: args.blockedKey,
            progressMarker: args.progressMarker,
        });
        if (!shouldBroadcast) {
            return;
        }

        logger.warn('[GameTransport] online-ai-watchdog requested overlay resync', {
            matchID: args.match.matchID,
            gameId: args.match.gameId,
            playerID: args.playerId,
            blockedReason: args.blockedReason,
            blockedKey: args.blockedKey,
        });
        this.stateSynchronizer.broadcast(args.match);
    }

    private async drainCommandQueue(match: ActiveMatch): Promise<void> {
        await this.createMatchRoomRuntime(match).drainCommandQueue();
    }

    private createMatchRoomRuntime(match: ActiveMatch): MatchRoomRuntime<ActiveMatch, ExecuteCommandInternalOptions> {
        return new MatchRoomRuntime(match, {
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
        await this.authoritativeQueuedCommandStaleRejectionCoordinator.reject({
            match,
            command,
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
        await this.connectionLifecycleCoordinator.handleSync({
            socket,
            matchID,
            playerID,
            credentials,
        });
    }

    private async handleCommand(
        matchID: string,
        playerID: string,
        commandType: string,
        payload: unknown,
        options?: ExecuteCommandInternalOptions,
    ): Promise<boolean> {
        const match = this.matchRoomRegistry.get(matchID);
        if (!match) return false;
        const roomRuntime = this.createMatchRoomRuntime(match);

        return roomRuntime.executeCommand({
            playerID,
            commandType,
            payload,
            queuedOptions: {
                reportFailureFeedback: true,
                feedbackSource: options?.feedbackSource,
                expectedStateID: options?.expectedStateID,
                onlineAiCircuitSource: options?.onlineAiCircuitSource,
                onlineAiAttemptKey: options?.onlineAiAttemptKey,
                clientTransport: options?.clientTransport,
            },
            directOptions: {
                reportFailureFeedback: true,
                expectedStateID: options?.expectedStateID,
                onlineAiAttemptKey: options?.onlineAiAttemptKey,
                clientTransport: options?.clientTransport,
            },
            executeCommand: (activeMatch, activePlayerID, activeCommandType, activePayload, activeOptions) =>
                this.executeCommandInternal(
                    activeMatch,
                    activePlayerID,
                    activeCommandType,
                    activePayload,
                    activeOptions,
                ),
            onSucceeded: (activeMatch) => this.runOnlineAiImmediateExecution(activeMatch, 'command-succeeded'),
        });
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
        const match = this.matchRoomRegistry.get(matchID);
        if (!match) {
            emitOnlineAiBatchTrace('handle-batch-match-missing', { matchID, playerID, batchId });
            socket.emit('batch:rejected', matchID, batchId, 'match_not_found');
            return;
        }
        const roomRuntime = this.createMatchRoomRuntime(match);

        await roomRuntime.executeBatchTask({
            queuedBatch: {
                _batch: true,
                execute: () => this.executeBatchInternal(socket, match, playerID, batchId, commands, meta),
            },
            onQueued: (queuedLength) => {
                emitOnlineAiBatchTrace('handle-batch-queued', {
                    matchID,
                    playerID,
                    batchId,
                    queuedLength,
                });
            },
            executeBatch: () => this.executeBatchInternal(socket, match, playerID, batchId, commands, meta),
            onSucceeded: (activeMatch) => this.runOnlineAiImmediateExecution(activeMatch, 'command-succeeded'),
        });
    }

    /**
     * batch 核心执行逻辑（供 handleBatch 直接调用和队列消费共用）
     * 调用方负责通过 MatchRoomRuntime 持有/释放执行锁；此方法不修改执行锁。
     */
    private async executeBatchInternal(
        socket: IOSocket,
        match: ActiveMatch,
        playerID: string,
        batchId: string,
        commands: Array<{ type: string; payload: unknown }>,
        meta?: BatchDispatchMeta,
    ): Promise<boolean> {
        return this.authoritativeBatchCoordinator.execute({
            match,
            playerId: playerID,
            batchId,
            commands,
            tracePrefix: 'execute-batch',
            meta,
            emitBatchRejected: (activeMatchID, activeBatchId, reason) => {
                socket.emit('batch:rejected', activeMatchID, activeBatchId, reason);
            },
            emitBatchConfirmed: (activeMatchID, activeBatchId, authoritativeState) => {
                // batch:confirmed 是乐观更新的确认响应，客户端已通过本地预测消费了事件
                socket.emit('batch:confirmed', activeMatchID, activeBatchId, authoritativeState);
            },
        });
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
        this.stateSynchronizer.broadcast(match);
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

        const preTrainingState = this.stateSynchronizer.stripForTraining(this.stateSynchronizer.applyPlayerView(match, playerID)) as MatchState<unknown>;

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

        const staleRejection = await this.authoritativeCommandStaleRejectionCoordinator.rejectIfStale({
            match,
            playerId: playerID,
            commandType: effectiveCommandType,
            commandPayload: effectivePayload,
            seatControllerType: onlineAiSeatControllerType,
            expectedStateID: options?.expectedStateID,
            stateIdBefore,
            progressMarker: progressMarkerBeforeCommand,
            onlineAiCircuitSource,
            onlineAiAttemptKey: options?.onlineAiAttemptKey,
            clientTransport: options?.clientTransport,
        });
        if (staleRejection.rejected) {
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
            return this.authoritativeCommandFailureCoordinator.handleFailure({
                match,
                playerId: playerID,
                requestedCommandType: commandType,
                effectiveCommandType,
                effectivePayload,
                execution,
                onlineAiSeatControllerType,
                onlineAiCircuitSource,
                expectedStateID: options?.expectedStateID,
                onlineAiAttemptKey: options?.onlineAiAttemptKey,
                clientTransport: options?.clientTransport,
                stateIdBefore,
                progressMarkerBeforeCommand,
                preCommandSeatView: preTrainingState,
                feedbackSource,
                reportFailureFeedback: options?.reportFailureFeedback,
            });
        }

        return this.authoritativeCommandSuccessCoordinator.handleSuccess({
            match,
            playerId: playerID,
            commandType: effectiveCommandType,
            commandPayload: effectivePayload,
            execution,
            seatControllerType,
            stateIdBefore,
            progressMarkerBeforeCommand,
            preCommandSeatView: preTrainingState,
            suppressBroadcast: options?.suppressBroadcast,
        });
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
        this.connectionLifecycleCoordinator.handleDisconnect(socket);
    }

    private removeSocketFromMatch(socketId: string, info: SocketInfo): void {
        this.connectionLifecycleCoordinator.removeSocketFromMatch(socketId, info);
    }

    private onPlayerFullyDisconnected(
        match: ActiveMatch,
        playerID: string,
    ): void {
        this.connectionLifecycleCoordinator.onPlayerFullyDisconnected(match, playerID);
    }

    // ========================================================================
    // 离线交互裁决
    // ========================================================================

    private scheduleOfflineAdjudication(
        match: ActiveMatch,
        playerID: string,
    ): void {
        this.connectionLifecycleCoordinator.scheduleOfflineAdjudication(match, playerID);
    }

    private async runOfflineAdjudication(
        match: ActiveMatch,
        playerID: string,
    ): Promise<void> {
        await this.connectionLifecycleCoordinator.runOfflineAdjudication(match, playerID);
    }

    // ========================================================================
    // 对局加载
    // ========================================================================

    private async loadMatch(matchID: string): Promise<ActiveMatch | undefined> {
        return this.matchRoomRegistry.load(matchID);
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
