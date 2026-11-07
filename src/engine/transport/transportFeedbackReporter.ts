import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
    projectFeedbackActionLogText,
    projectFeedbackDiagnosticPacket,
    projectFeedbackReasonCode,
    projectFeedbackSnapshot,
    projectFeedbackSnapshotText,
} from '../../lib/feedback/diagnosticPacket';
import type { FeedbackDiagnosticSnapshots } from '../../lib/feedback/feedbackPayload';
import logger from '../../../server/logger.js';
import { resolveRuntimeBuildInfo } from '../../lib/feedback/runtimeBuildInfo';
import { deliverFeedbackWithRetry, FeedbackDeliveryHttpError } from '../../lib/feedback/feedbackDelivery';
import type { MatchState } from '../types';
import type { CommandFailureFeedbackPayload } from './commandFailureFeedbackPayload';
import type { PrivateFeedbackReplayTrigger } from './feedbackPrivateReplay';

export const DEFAULT_ONLINE_AI_RECOVERY_FEEDBACK_COOLDOWN_MS = 60_000;
export const DEFAULT_COMMAND_FAILURE_FEEDBACK_COOLDOWN_MS = 60_000;

export type OnlineAiRecoveryFeedbackPayload = {
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
    requestId?: string;
    roomId?: string;
    stateId?: number;
    stateRevision?: number;
    decisionEpoch?: number;
    randomCursor?: number;
    diagnosticSnapshots?: FeedbackDiagnosticSnapshots;
    lastCommand?: unknown;
    commandTraceTail?: unknown[];
    privateReplayTrigger?: PrivateFeedbackReplayTrigger;
    privateReplay?: string;
    privateReplayError?: string;
};

export type OnlineAiFeedbackConfig = {
    endpoint: string | null;
    token: string | null;
    disabledReason?: 'missing-endpoint' | 'missing-token';
};

export type InternalSystemFeedbackPost = (body: Record<string, unknown>) => Promise<void>;
export type OnlineAiFeedbackReporter = (payload: OnlineAiRecoveryFeedbackPayload) => Promise<void>;
export type CommandFailureFeedbackReporter = (payload: CommandFailureFeedbackPayload) => Promise<void>;

export type TransportFeedbackCorrelation = Pick<
    OnlineAiRecoveryFeedbackPayload,
    'roomId' | 'requestId' | 'stateId' | 'stateRevision' | 'decisionEpoch'
>;

/**
 * 从服务端权威状态提取反馈现场关联键。
 * 这里只读取运行时已有字段；没有独立 roomId 时不复制或猜测其它标识。
 */
export const resolveTransportFeedbackCorrelation = (args: {
    matchId: string;
    state?: MatchState<unknown>;
    roomId?: string;
    stateId?: number;
    stateRevision?: number;
}): TransportFeedbackCorrelation => {
    const sys = args.state?.sys;
    const interactionId = sys?.interaction?.current?.id;
    const responseWindowId = sys?.responseWindow?.current?.id;
    const roomId = typeof args.roomId === 'string' && args.roomId.trim().length > 0
        ? args.roomId.trim()
        : undefined;
    const requestId = typeof interactionId === 'string' && interactionId.trim().length > 0
        ? interactionId
        : typeof responseWindowId === 'string' && responseWindowId.trim().length > 0
            ? responseWindowId
            : undefined;
    const decisionEpoch = typeof sys?.decisionEpoch === 'number' ? sys.decisionEpoch : undefined;
    const stateRevision = args.stateRevision ?? (typeof sys?.revision === 'number' ? sys.revision : undefined);

    return {
        ...(roomId ? { roomId } : {}),
        ...(requestId ? { requestId } : {}),
        ...(args.stateId !== undefined ? { stateId: args.stateId } : {}),
        ...(stateRevision !== undefined ? { stateRevision } : {}),
        ...(decisionEpoch !== undefined ? { decisionEpoch } : {}),
    };
};

const INTERNAL_FEEDBACK_PATH = '/internal/feedback/system';
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

function parseDiagnosticJson(value?: string): unknown {
    if (!value?.trim()) return undefined;
    try {
        return JSON.parse(value);
    } catch {
        return undefined;
    }
}

const asRecord = (value: unknown): Record<string, unknown> => (
    value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
);

const safeText = (value: unknown): string | undefined => (
    typeof value === 'string' && value.trim().length > 0 ? value.trim().slice(0, 128) : undefined
);

const safeNumber = (value: unknown): number | undefined => (
    typeof value === 'number' && Number.isFinite(value) ? value : undefined
);

function buildServerDiagnosticPacket(args: {
    source: 'server';
    matchId: string;
    gameId: string;
    playerId: string;
    stateSnapshot?: string;
    actionLog?: string;
    requestId?: string;
    roomId?: string;
    stateId?: number;
    stateRevision?: number;
    decisionEpoch?: number;
    randomCursor?: number;
    diagnosticSnapshots?: FeedbackDiagnosticSnapshots;
    lastCommand?: unknown;
    commandTraceTail?: unknown[];
    privateReplayError?: string;
    privateReplayCaptured?: boolean;
}): string {
    const rawSnapshot = asRecord(parseDiagnosticJson(args.stateSnapshot));
    const snapshotsInput = asRecord(rawSnapshot.snapshots);
    const snapshot = projectFeedbackSnapshot(args.diagnosticSnapshots?.at ?? snapshotsInput.at ?? rawSnapshot);
    const beforeSnapshot = projectFeedbackSnapshot(args.diagnosticSnapshots?.before ?? snapshotsInput.before);
    const afterSnapshot = projectFeedbackSnapshot(args.diagnosticSnapshots?.after ?? snapshotsInput.after);
    const randomCursor = args.randomCursor ?? safeNumber(rawSnapshot.randomCursor);
    const actionLog = parseDiagnosticJson(projectFeedbackActionLogText(args.actionLog));
    const actionLogSummary = actionLog && typeof actionLog === 'object' && !Array.isArray(actionLog)
        ? actionLog as Record<string, unknown>
        : {};
    const missingFields = [
        ...(args.matchId ? [] : ['correlation.matchId']),
        ...(args.roomId ? [] : ['correlation.roomId']),
        ...(args.requestId ? [] : ['correlation.requestId']),
        ...(args.stateId === undefined ? ['correlation.stateId'] : []),
        ...(args.stateRevision === undefined ? ['correlation.stateRevision'] : []),
        ...(args.decisionEpoch === undefined ? ['correlation.decisionEpoch'] : []),
        ...(snapshot === undefined ? ['snapshots.at'] : []),
        ...(beforeSnapshot === undefined ? ['snapshots.before'] : []),
        ...(afterSnapshot === undefined ? ['snapshots.after'] : []),
        ...(randomCursor === undefined ? ['randomCursor'] : []),
        ...(!args.privateReplayCaptured || args.privateReplayError ? ['privateReplay'] : []),
    ];
    const replayability = snapshot === undefined ? 'unreplayable' : missingFields.length === 0 ? 'full' : 'partial';
    const lastCommand = args.lastCommand ?? rawSnapshot.lastCommand;
    const commandRecord = asRecord(lastCommand);
    const safeLastCommand = {
        ...(safeText(commandRecord.commandId) ? { commandId: safeText(commandRecord.commandId) } : {}),
        ...(safeText(commandRecord.commandType) ? { commandType: safeText(commandRecord.commandType) } : {}),
        ...(safeText(commandRecord.playerId) ? { playerId: safeText(commandRecord.playerId) } : {}),
        ...(safeNumber(commandRecord.stateId) !== undefined ? { stateId: safeNumber(commandRecord.stateId) } : {}),
        ...(safeNumber(commandRecord.randomCursor) !== undefined ? { randomCursor: safeNumber(commandRecord.randomCursor) } : {}),
        ...(safeNumber(commandRecord.afterStateId) !== undefined ? { afterStateId: safeNumber(commandRecord.afterStateId) } : {}),
        ...(safeNumber(commandRecord.afterRandomCursor) !== undefined ? { afterRandomCursor: safeNumber(commandRecord.afterRandomCursor) } : {}),
    };
    const packet = {
        schemaVersion: 1,
        captureId: 'feedback-server-' + randomUUID(),
        capturedAt: new Date().toISOString(),
        source: args.source,
        collectionStatus: args.privateReplayError || missingFields.length > 0
            ? 'partial'
            : 'complete',
        replayability,
        missingFields,
        correlation: {
            matchId: args.matchId,
            ...(args.roomId ? { roomId: args.roomId } : {}),
            ...(args.requestId ? { requestId: args.requestId } : {}),
            ...(args.stateId !== undefined ? { stateId: args.stateId } : {}),
            ...(args.stateRevision !== undefined ? { stateRevision: args.stateRevision } : {}),
            ...(args.decisionEpoch !== undefined ? { decisionEpoch: args.decisionEpoch } : {}),
        },
        phase: snapshot && typeof snapshot === 'object'
            ? typeof (snapshot as { phase?: unknown }).phase === 'string'
                ? (snapshot as { phase: string }).phase
                : typeof (snapshot as { sys?: { phase?: unknown } }).sys?.phase === 'string'
                    ? (snapshot as { sys: { phase: string } }).sys.phase
                    : undefined
            : undefined,
        snapshots: {
            ...(beforeSnapshot ? { before: beforeSnapshot } : {}),
            at: snapshot,
            ...(afterSnapshot ? { after: afterSnapshot } : {}),
        },
        actionLogTail: Array.isArray(actionLog)
            ? actionLog
            : Array.isArray(actionLogSummary.actionLogTail) ? actionLogSummary.actionLogTail : undefined,
        eventStreamTail: Array.isArray(actionLogSummary.eventStreamTail) ? actionLogSummary.eventStreamTail : undefined,
        collectionErrors: args.privateReplayError ? [args.privateReplayError]
            : args.privateReplayCaptured ? [] : ['private_replay_not_captured'],
        ...(randomCursor !== undefined ? { randomCursor } : {}),
        ...(Object.keys(safeLastCommand).length > 0 ? { lastCommand: safeLastCommand } : {}),
        ...(args.commandTraceTail ? { commandTraceTail: args.commandTraceTail } : {}),
        gameId: args.gameId,
        playerId: args.playerId,
    };
    return JSON.stringify(projectFeedbackDiagnosticPacket(packet) ?? packet);
}

export const buildOnlineAiRecoveryResolvedMethod = (
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

export const normalizeInternalFeedbackEndpoint = (candidate: string): string | null => {
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

export const resolveOnlineAiFeedbackEndpoint = (): string | null => {
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

export const resolveOnlineAiFeedbackConfig = (): OnlineAiFeedbackConfig => {
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

export const postInternalSystemFeedback = async (
    body: Record<string, unknown>,
    config: OnlineAiFeedbackConfig = resolveOnlineAiFeedbackConfig(),
): Promise<void> => {
    const { endpoint, token } = config;
    if (!endpoint || !token) {
        throw new Error(`feedback_delivery_unavailable:${config.disabledReason ?? 'missing-configuration'}`);
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
        throw new FeedbackDeliveryHttpError(response.status);
    }
};

export const buildOnlineAiRecoveryFeedbackRequestBody = (
    payload: OnlineAiRecoveryFeedbackPayload,
): Record<string, unknown> => {
    const buildInfo = resolveServerFeedbackBuildInfo();
    const actionLog = projectFeedbackActionLogText(payload.actionLog);
    const stateSnapshot = projectFeedbackSnapshotText(payload.stateSnapshot);
    const publicReason = projectFeedbackReasonCode(payload.reason) ?? 'diagnostic_available';
    return {
        content: `[system][online-ai-watchdog] ${payload.incidentKind} ${publicReason}`,
        type: 'bug',
        severity: payload.severity,
        ...(payload.status ? { status: payload.status } : {}),
        ...(payload.status === 'resolved'
            ? { resolvedMethod: payload.resolvedMethod || buildOnlineAiRecoveryResolvedMethod(payload) }
            : {}),
        source: 'online-ai-watchdog',
        autoReportKind: payload.incidentKind,
        incidentKey: `${payload.incidentKind}:${payload.playerId}:${publicReason}`,
        gameName: payload.gameId,
        contactInfo: 'system:online-ai-watchdog',
        actionLog,
        stateSnapshot,
        ...(payload.privateReplay ? { privateReplay: payload.privateReplay } : {}),
        diagnosticPacket: buildServerDiagnosticPacket({
            source: 'server',
            matchId: payload.matchId,
            gameId: payload.gameId,
            playerId: payload.playerId,
            stateSnapshot,
            actionLog,
            requestId: payload.requestId,
            roomId: payload.roomId,
            stateId: payload.stateId,
            stateRevision: payload.stateRevision,
            decisionEpoch: payload.decisionEpoch,
            privateReplayError: payload.privateReplayError,
            privateReplayCaptured: Boolean(payload.privateReplay),
            randomCursor: payload.randomCursor,
            diagnosticSnapshots: payload.diagnosticSnapshots,
            lastCommand: payload.lastCommand,
            commandTraceTail: payload.commandTraceTail,
        }),
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
            message: publicReason,
            name: payload.incidentKind,
        },
    };
};

export const buildCommandFailureFeedbackRequestBody = (
    payload: CommandFailureFeedbackPayload,
): Record<string, unknown> => {
    const buildInfo = resolveServerFeedbackBuildInfo();
    const actionLog = projectFeedbackActionLogText(payload.actionLog);
    const stateSnapshot = projectFeedbackSnapshotText(payload.stateSnapshot);
    const isOnlineAiRecovery = payload.feedbackSource === 'online-ai-watchdog';
    const publicReason = projectFeedbackReasonCode(payload.reason) ?? 'command_failed';
    return {
        content: `[system][${payload.feedbackSource}] ${payload.commandType} ${publicReason}`,
        type: 'bug',
        severity: payload.severity,
        source: payload.feedbackSource,
        autoReportKind: isOnlineAiRecovery ? 'online-ai-command-failed' : payload.incidentKind,
        incidentKey: `${payload.commandType}:${payload.playerId}:${payload.stateId ?? 'unknown'}:${publicReason}`,
        gameName: payload.gameId,
        contactInfo: `system:${payload.feedbackSource}`,
        actionLog,
        stateSnapshot,
        ...(payload.privateReplay ? { privateReplay: payload.privateReplay } : {}),
        diagnosticPacket: buildServerDiagnosticPacket({
            source: 'server',
            matchId: payload.matchId,
            gameId: payload.gameId,
            playerId: payload.playerId,
            stateSnapshot,
            actionLog,
            stateId: payload.stateId,
            stateRevision: payload.stateRevision,
            requestId: payload.requestId,
            roomId: payload.roomId,
            decisionEpoch: payload.decisionEpoch,
            privateReplayError: payload.privateReplayError,
            privateReplayCaptured: Boolean(payload.privateReplay),
            randomCursor: payload.randomCursor,
            diagnosticSnapshots: payload.diagnosticSnapshots,
            lastCommand: payload.lastCommand,
            commandTraceTail: payload.commandTraceTail,
        }),
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
            message: publicReason,
            name: payload.commandType,
        },
    };
};

export const defaultOnlineAiFeedbackReporter = async (
    payload: OnlineAiRecoveryFeedbackPayload,
    postFeedback: InternalSystemFeedbackPost = postInternalSystemFeedback,
): Promise<void> => {
    await postFeedback(buildOnlineAiRecoveryFeedbackRequestBody(payload));
};

export const defaultCommandFailureFeedbackReporter = async (
    payload: CommandFailureFeedbackPayload,
    postFeedback: InternalSystemFeedbackPost = postInternalSystemFeedback,
): Promise<void> => {
    await postFeedback(buildCommandFailureFeedbackRequestBody(payload));
};

export class TransportFeedbackReporter {
    private readonly onlineAiRecoveryFeedbackCooldownMs: number;
    private readonly commandFailureFeedbackCooldownMs: number;
    private readonly onlineAiFeedbackReporter: OnlineAiFeedbackReporter;
    private readonly commandFailureFeedbackReporter: CommandFailureFeedbackReporter;
    private readonly now: () => number;
    private readonly onlineAiRecoveryFeedbackCooldown = new Map<string, number>();
    private readonly commandFailureFeedbackCooldown = new Map<string, number>();

    constructor(options: {
        onlineAiRecoveryFeedbackCooldownMs?: number;
        commandFailureFeedbackCooldownMs?: number;
        onlineAiFeedbackReporter?: OnlineAiFeedbackReporter;
        commandFailureFeedbackReporter?: CommandFailureFeedbackReporter;
        postInternalSystemFeedback?: InternalSystemFeedbackPost;
        now?: () => number;
    } = {}) {
        const postOnce = options.postInternalSystemFeedback ?? postInternalSystemFeedback;
        const postFeedback: InternalSystemFeedbackPost = body => deliverFeedbackWithRetry(() => postOnce(body));
        this.onlineAiRecoveryFeedbackCooldownMs = options.onlineAiRecoveryFeedbackCooldownMs
            ?? DEFAULT_ONLINE_AI_RECOVERY_FEEDBACK_COOLDOWN_MS;
        this.commandFailureFeedbackCooldownMs = options.commandFailureFeedbackCooldownMs
            ?? DEFAULT_COMMAND_FAILURE_FEEDBACK_COOLDOWN_MS;
        this.onlineAiFeedbackReporter = options.onlineAiFeedbackReporter
            ?? ((payload) => defaultOnlineAiFeedbackReporter(payload, postFeedback));
        this.commandFailureFeedbackReporter = options.commandFailureFeedbackReporter
            ?? ((payload) => defaultCommandFailureFeedbackReporter(payload, postFeedback));
        this.now = options.now ?? Date.now;
    }

    pruneExpiredOnlineAiRecoveryFeedbackCooldowns(now = this.now()): void {
        for (const [key, expiresAt] of this.onlineAiRecoveryFeedbackCooldown.entries()) {
            if (expiresAt <= now) {
                this.onlineAiRecoveryFeedbackCooldown.delete(key);
            }
        }
    }

    async reportOnlineAiRecoveryFeedback(payload: OnlineAiRecoveryFeedbackPayload): Promise<void> {
        const dedupeKey = payload.incidentKind === 'legal-action-recovered'
            ? `${payload.matchId}:${payload.playerId}:${payload.incidentKind}:${payload.trackerKey}:${payload.progressMarker}`
            : `${payload.matchId}:${payload.playerId}:${payload.incidentKind}:${payload.trackerKey}`;
        const now = this.now();
        const cooldownUntil = this.onlineAiRecoveryFeedbackCooldown.get(dedupeKey) ?? 0;
        if (cooldownUntil > now) {
            return;
        }
        this.onlineAiRecoveryFeedbackCooldown.set(dedupeKey, now + this.onlineAiRecoveryFeedbackCooldownMs);

        try {
            await this.onlineAiFeedbackReporter(payload);
            const publicReason = projectFeedbackReasonCode(payload.reason) ?? 'diagnostic_available';
            logger.info('[GameTransport] online-ai-watchdog feedback reported', {
                matchID: payload.matchId,
                gameId: payload.gameId,
                playerID: payload.playerId,
                incidentKind: payload.incidentKind,
                reason: publicReason,
            });
        } catch (error) {
            this.onlineAiRecoveryFeedbackCooldown.delete(dedupeKey);
            const publicReason = projectFeedbackReasonCode(payload.reason) ?? 'diagnostic_available';
            logger.warn('[GameTransport] online-ai-watchdog feedback failed', {
                matchID: payload.matchId,
                gameId: payload.gameId,
                playerID: payload.playerId,
                incidentKind: payload.incidentKind,
                reason: publicReason,
                error: error instanceof FeedbackDeliveryHttpError ? `http_${error.status}` : 'delivery_failed',
            });
        }
    }

    async reportCommandFailureFeedback(payload: CommandFailureFeedbackPayload): Promise<void> {
        const dedupeKey = `${payload.matchId}:${payload.playerId}:${payload.incidentKind}:${payload.incidentKey}`;
        const now = this.now();
        const cooldownUntil = this.commandFailureFeedbackCooldown.get(dedupeKey) ?? 0;
        if (cooldownUntil > now) {
            return;
        }
        this.commandFailureFeedbackCooldown.set(dedupeKey, now + this.commandFailureFeedbackCooldownMs);

        try {
            await this.commandFailureFeedbackReporter(payload);
            logger.info('[GameTransport] command failure feedback reported', {
                matchID: payload.matchId,
                gameId: payload.gameId,
                playerID: payload.playerId,
                commandType: payload.commandType,
                reason: payload.reason,
                incidentKey: payload.incidentKey,
            });
        } catch (error) {
            this.commandFailureFeedbackCooldown.delete(dedupeKey);
            logger.warn('[GameTransport] command failure feedback failed', {
                matchID: payload.matchId,
                gameId: payload.gameId,
                playerID: payload.playerId,
                commandType: payload.commandType,
                reason: payload.reason,
                incidentKey: payload.incidentKey,
                error: error instanceof FeedbackDeliveryHttpError ? `http_${error.status}` : 'delivery_failed',
            });
        }
    }
}
